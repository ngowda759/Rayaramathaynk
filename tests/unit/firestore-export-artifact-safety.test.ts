/**
 * @jest-environment node
 *
 * Guards the Firestore production export against re-introducing a public PII leak.
 *
 * The export writes decoded production documents — receipts, contacts, messages —
 * to `data/firestore-dump/*.json` and `data/firestore-export/*.ndjson`. This
 * repository is public, and an Actions artifact on a public repository is
 * world-readable, so uploading those paths unconditionally exposes personal data.
 *
 * Two independent checks:
 *   1. static  — no artifact upload of the raw export paths is un-gated;
 *   2. behavioral — the containment policy script is executed for real across the
 *      publish/private/token matrix, proving it fails closed.
 *
 * Nothing here runs the export workflow, touches Firestore, or reads real data.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "../..");
const wfDir = resolve(root, ".github/workflows");
const EXPORT_WF = resolve(wfDir, "firestore-production-export.yml");

/**
 * The raw-export directory roots. Any upload of these paths can expose decoded
 * production documents, so it must be policy-gated.
 */
const RAW_EXPORT_ROOT = /^data\/firestore-(dump|export)\b/;

/**
 * Every `path:` value in an upload step's `with:` block that would sweep a raw
 * export *directory* (or a glob over one) rather than upload a single named file.
 *
 * Regression: matching only a bare `data/firestore-dump/` line missed the inline
 * forms `path: data/firestore-dump/**`, `path: data/firestore-dump` and a nested
 * `path: data/firestore-export/records/`, each of which still sweeps raw data.
 * A literal single filename such as `.../MANIFEST.json` is a targeted upload and
 * is not a sweep. A *glob* that merely ends in an extension (`*.ndjson`,
 * `*.json`) is still a sweep: the earlier extension check exempted it, which let
 * an extension-qualified glob past the un-gated-upload check.
 */
export function rawExportDirPaths(withBlock: string): string[] {
  const lines = withBlock.split("\n");
  const values: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*path:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const inline = m[1].trim();
    if (inline && !inline.startsWith("|") && !inline.startsWith(">")) {
      values.push(inline);
      continue;
    }
    const indent = lines[i].length - lines[i].trimStart().length;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === "") continue;
      if (lines[j].length - lines[j].trimStart().length <= indent) break;
      values.push(lines[j].trim());
    }
  }
  return values.filter((p) => {
    if (!RAW_EXPORT_ROOT.test(p)) return false;
    // Any glob or brace/bracket expansion sweeps more than one file.
    if (/[*?[\]{}]/.test(p)) return true;
    // Otherwise: a literal path with no extension is a directory sweep; a
    // literal path ending in an extension names one file and is not a sweep.
    return !/\.[a-z0-9]+$/i.test(p);
  });
}

export interface ParsedStep {
  name: string;
  uses?: string;
  if?: string;
  withRaw?: string;
  envRaw?: string;
  runBody?: string;
}

/**
 * Minimal, dependency-free step splitter. Splits on lines that open a new list item
 * at the `steps:` level (`- name:` / `- uses:`) and keeps each chunk's raw text, so
 * assertions read the real YAML rather than a re-serialised approximation.
 */
export function parseSteps(yaml: string): ParsedStep[] {
  const lines = yaml.split("\n");
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*- (name|uses):/.test(lines[i])) starts.push(i);
  }
  const steps: ParsedStep[] = [];
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s];
    const to = s + 1 < starts.length ? starts[s + 1] : lines.length;
    const chunk = lines.slice(from, to);
    const joined = chunk.join("\n");
    const name = /^\s*- name:\s*(.*)$/.exec(chunk[0])?.[1]?.trim() ?? "";
    const uses = /^\s*uses:\s*(\S+)/m.exec(joined)?.[1];
    const ifLine = /^\s*if:\s*(.*)$/m.exec(joined)?.[1]?.trim();
    const withIdx = chunk.findIndex((l) => /^\s*with:\s*$/.test(l));
    const envIdx = chunk.findIndex((l) => /^\s*env:\s*$/.test(l));
    const runIdx = chunk.findIndex((l) => /^\s*run:\s*/.test(l));
    steps.push({
      name,
      uses,
      if: ifLine,
      withRaw: withIdx >= 0 ? chunk.slice(withIdx).join("\n") : undefined,
      envRaw: envIdx >= 0 ? chunk.slice(envIdx).join("\n") : undefined,
      runBody: runIdx >= 0 ? chunk.slice(runIdx).join("\n") : undefined,
    });
  }
  return steps;
}

function workflowFiles(): string[] {
  return readdirSync(wfDir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();
}

/** A scratch directory for GITHUB_OUTPUT, cleaned up with the test suite. */
const scratch = mkdtempSync(join(tmpdir(), "export-artifact-test-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
let fileSeq = 0;
function tmpFile(): string {
  return join(scratch, `github_output_${fileSeq++}.txt`);
}

describe("Firestore export artifact containment", () => {
  const yaml = readFileSync(EXPORT_WF, "utf8");
  const steps = parseSteps(yaml);

  it("is dispatch-only and requests no write permission", () => {
    expect(/^\s*workflow_dispatch:/m.test(yaml)).toBe(true);
    const permsBlock = /^permissions:\n((?:\s+.*\n)*)/m.exec(yaml)?.[1] ?? "";
    expect(permsBlock).not.toMatch(/:\s*write/);
  });

  it("has at least one artifact upload step", () => {
    const uploads = steps.filter((s) => /upload-artifact@/.test(s.uses ?? ""));
    expect(uploads.length).toBeGreaterThan(0);
  });

  it.each(workflowFiles())(
    "%s: no un-gated artifact upload of raw export paths",
    (file) => {
      const text = readFileSync(resolve(wfDir, file), "utf8");
      for (const step of parseSteps(text)) {
        if (!/upload-artifact@/.test(step.uses ?? "")) continue;
        const withBlock = step.withRaw ?? "";
        // Only a directory/glob upload can sweep the whole export; a targeted
        // single file such as MANIFEST.json cannot.
        if (rawExportDirPaths(withBlock).length === 0) continue;
        // Any upload of a raw export directory must be conditional on the policy
        // output, so it cannot fire on a public repository by default.
        expect(step.if ?? "").toContain("upload_policy");
      }
    },
  );

  it("gates the raw-data upload on the policy output and keeps the MANIFEST upload unconditional", () => {
    const rawUpload = steps.find(
      (s) =>
        /upload-artifact@/.test(s.uses ?? "") &&
        rawExportDirPaths(s.withRaw ?? "").length > 0,
    );
    expect(rawUpload).toBeDefined();
    expect(rawUpload!.if).toBe("steps.upload_policy.outputs.allow == 'true'");

    const manifestUpload = steps.find(
      (s) =>
        /upload-artifact@/.test(s.uses ?? "") &&
        (s.withRaw ?? "").includes("MANIFEST.json"),
    );
    expect(manifestUpload).toBeDefined();
    expect(manifestUpload!.if).toBeUndefined();
    // The MANIFEST upload must not also sweep a raw export directory.
    expect(rawExportDirPaths(manifestUpload!.withRaw ?? "")).toEqual([]);
  });

  it("contains a step that hard-fails when publication is requested but not allowed", () => {
    const refusal = steps.find((s) => /Refuse unsafe/i.test(s.name));
    expect(refusal).toBeDefined();
    expect(refusal!.runBody).toMatch(/exit\s+1/);
  });

  it("defaults publish_artifact to false", () => {
    expect(yaml).toMatch(/publish_artifact:[\s\S]*?default:\s*false/);
  });

  it("treats inline-glob and nested-directory uploads as raw-data sweeps", () => {
    // Regression: matching only a bare `data/firestore-dump/` line let these forms
    // slip past the un-gated-upload check while still sweeping raw documents.
    const sweeps = [
      "        with:\n          name: x\n          path: data/firestore-dump/**",
      "        with:\n          name: x\n          path: data/firestore-dump",
      "        with:\n          name: x\n          path: data/firestore-export/*",
      "        with:\n          name: x\n          path: data/firestore-export/records/",
      "        with:\n          name: x\n          path: |\n            data/firestore-dump/",
    ];
    for (const block of sweeps) {
      expect([block, rawExportDirPaths(block).length > 0]).toEqual([block, true]);
    }
    // A targeted single file is not a sweep and must not be flagged.
    const targeted = "        with:\n          name: x\n          path: data/firestore-dump/MANIFEST.json";
    expect(rawExportDirPaths(targeted)).toEqual([]);
  });

  it("treats extension-qualified globs as sweeps but literal files as targeted", () => {
    // Regression: the extension check exempted `*.ndjson` / `*.json`, so a glob
    // that sweeps every raw record still counted as a "targeted single file".
    const sweeps = [
      "        with:\n          name: x\n          path: data/firestore-dump/*.ndjson",
      "        with:\n          name: x\n          path: data/firestore-dump/*.json",
      "        with:\n          name: x\n          path: data/firestore-export/records/*.ndjson",
      "        with:\n          name: x\n          path: data/firestore-dump/record?.json",
      "        with:\n          name: x\n          path: data/firestore-dump/{a,b}.json",
    ];
    for (const block of sweeps) {
      expect([block, rawExportDirPaths(block).length > 0]).toEqual([block, true]);
    }
    // Literal single files stay targeted, including the MANIFEST the workflow uploads.
    const targeted = [
      "        with:\n          name: x\n          path: data/firestore-dump/MANIFEST.json",
      "        with:\n          name: x\n          path: data/firestore-export/MANIFEST.json",
    ];
    for (const block of targeted) {
      expect([block, rawExportDirPaths(block)]).toEqual([block, []]);
    }
  });
});

describe("artifact upload policy script (behavioral)", () => {
  const steps = parseSteps(readFileSync(EXPORT_WF, "utf8"));
  const policyStep = steps.find((s) => /Evaluate artifact upload policy/i.test(s.name));
  const refusalStep = steps.find((s) => /Refuse unsafe/i.test(s.name));

  /** The `run:` block with its `run:`/`|` header stripped, de-indented. */
  function runBody(step: ParsedStep): string {
    const raw = step.runBody ?? "";
    const body = raw.split("\n").slice(1); // drop the `run: |` line
    const indented = body.filter((l) => l.trim() !== "");
    const indent = Math.min(...indented.map((l) => l.length - l.trimStart().length));
    return body.map((l) => l.slice(indent)).join("\n");
  }

  function runPolicy(env: Record<string, string>) {
    const script = runBody(policyStep!);
    const outFile = tmpFile();
    const r = spawnSync("bash", ["-c", script], {
      env: { PATH: process.env.PATH, GITHUB_OUTPUT: outFile, ...env },
      encoding: "utf8",
    });
    const emitted = existsSync(outFile) ? readFileSync(outFile, "utf8") : "";
    const allow = /allow=(\w+)/.exec(emitted)?.[1] ?? "(none)";
    return { code: r.status, allow, stdout: r.stdout, stderr: r.stderr };
  }

  it("refuses raw publication by default", () => {
    const r = runPolicy({ INPUT_PUBLISH_ARTIFACT: "false", REPO_PRIVATE: "true", PUBLISH_TOKEN: "tok" });
    expect(r.code).toBe(0);
    expect(r.allow).toBe("false");
  });

  it("refuses raw publication on a public repository even when explicitly requested", () => {
    const r = runPolicy({ INPUT_PUBLISH_ARTIFACT: "true", REPO_PRIVATE: "false", PUBLISH_TOKEN: "tok" });
    expect(r.allow).toBe("false");
    expect(r.stdout).toMatch(/public repository/i);
  });

  it("refuses raw publication on a private repository when no destination is configured", () => {
    const r = runPolicy({ INPUT_PUBLISH_ARTIFACT: "true", REPO_PRIVATE: "true", PUBLISH_TOKEN: "" });
    expect(r.allow).toBe("false");
  });

  it("allows raw publication only on a private repository with a configured destination", () => {
    const r = runPolicy({ INPUT_PUBLISH_ARTIFACT: "true", REPO_PRIVATE: "true", PUBLISH_TOKEN: "tok" });
    expect(r.allow).toBe("true");
  });

  it("treats empty/absent inputs as the safe default (fail closed)", () => {
    const r = runPolicy({});
    expect(r.allow).toBe("false");
  });

  it("the refusal step exits non-zero so the job fails loudly", () => {
    expect(runBody(refusalStep!)).toMatch(/exit\s+1/);
    const r = spawnSync("bash", ["-c", runBody(refusalStep!)], { encoding: "utf8" });
    expect(r.status).not.toBe(0);
  });
});
