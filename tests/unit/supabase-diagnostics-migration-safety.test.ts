/**
 * @jest-environment node
 *
 * Guard rails for the Supabase connectivity diagnostic and the production
 * migration workflow. Everything here reads files or spawns scripts that touch
 * nothing: no database, no GitHub API, no network.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(__dirname, "../..");
const diagnostic = resolve(root, "scripts/diagnose-supabase-connectivity.ts");
const guard = resolve(root, "scripts/lib/guard-approved-project.mjs");
const approvedLib = resolve(root, "scripts/lib/approved-project.mjs");
const workflow = resolve(root, ".github/workflows/supabase-migrations.yml");

const APPROVED = "kvrkraqjuyxbraccxntk";

/**
 * Extract every `run:` shell script body from a workflow YAML file.
 *
 * Deliberately regex-based rather than YAML-parser based: no YAML library is a
 * declared dependency of this project, and a transitive one would be fragile.
 * `run:` blocks here are all literal block scalars, which this handles.
 */
function runBlocks(yaml: string): string[] {
  const lines = yaml.split("\n");
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)run:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const indent = m[1].length;
    const inline = m[2];
    if (inline && !inline.startsWith("|") && !inline.startsWith(">")) {
      blocks.push(inline);
      continue;
    }
    const body: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "") {
        body.push("");
        continue;
      }
      const lead = line.length - line.trimStart().length;
      if (lead <= indent) break;
      body.push(line.slice(indent + 2));
    }
    blocks.push(body.join("\n"));
  }
  return blocks;
}

/** Return the shell body of the named workflow step, dedented. */
function extractStepScript(yaml: string, stepName: string): string {
  const lines = yaml.split("\n");
  const start = lines.findIndex((l) => l.trim() === `- name: ${stepName}`);
  if (start === -1) throw new Error(`step not found: ${stepName}`);
  for (let i = start; i < lines.length && i < start + 40; i++) {
    const m = /^(\s*)run:\s*\|?\s*$/.exec(lines[i]) || /^(\s*)run:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const indent = m[1].length;
    const body: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "") {
        body.push("");
        continue;
      }
      const lead = line.length - line.trimStart().length;
      if (lead <= indent) break;
      body.push(line.slice(indent + 2));
    }
    return body.join("\n");
  }
  throw new Error(`no run: block in step: ${stepName}`);
}

/**
 * Run the "Check confirmation phrase" step exactly as GitHub would: the step body
 * with its configured env var supplied through the environment, not substituted
 * into the text. Returns the exit status and whether the injected payload touched
 * the sentinel.
 */
function runConfirmStep(confirmValue: string) {
  const script = extractStepScript(readFileSync(workflow, "utf8"), "Check confirmation phrase");
  // Read the env var name from the step rather than assuming it, so renaming the
  // variable cannot silently make this helper test nothing.
  const envName =
    /^\s*([A-Za-z_][A-Za-z0-9_]*):\s*\$\{\{\s*inputs\.confirm\s*\}\}\s*$/m.exec(
      readFileSync(workflow, "utf8"),
    )?.[1] ?? "CONFIRM_PHRASE";
  const sentinel = resolve(root, `.injection-sentinel-${process.pid}`);
  spawnSync("rm", ["-f", sentinel]);
  // Provide a payload that would create the sentinel if it were ever evaluated.
  const payload = confirmValue.replace(/__SENTINEL__/g, sentinel);
  const r = spawnSync("bash", ["-c", script], {
    cwd: root,
    env: { ...process.env, [envName]: payload },
    encoding: "utf8",
  });
  const injected = spawnSync("test", ["-f", sentinel]).status === 0;
  spawnSync("rm", ["-f", sentinel]);
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, injected };
}

/** Evaluate an expression against the approved-project library in a real node process. */
function evalInLib(expr: string): unknown {
  const url = pathToFileURL(approvedLib).href;
  const r = spawnSync(
    "node",
    ["--input-type=module", "-e", `import * as m from ${JSON.stringify(url)}; process.stdout.write(JSON.stringify(${expr}))`],
    { cwd: root, encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`lib eval failed: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

/** Spawn the diagnostic with a clean Supabase environment plus `env`. */
function runDiagnostic(env: Record<string, string | undefined>) {
  const base = { ...process.env };
  for (const k of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DB_URL",
    "SUPABASE_PROJECT_REF",
  ]) {
    delete base[k];
  }
  return spawnSync("npx", ["--no-install", "tsx", diagnostic], {
    cwd: root,
    env: { ...base, ...env },
    encoding: "utf8",
  });
}

function runGuard(env: Record<string, string | undefined>) {
  const base = { ...process.env };
  delete base.SUPABASE_PROJECT_REF;
  return spawnSync("node", [guard], { cwd: root, env: { ...base, ...env }, encoding: "utf8" });
}

describe("approved-project library", () => {
  it("names exactly one approved project and derives its URL", () => {
    expect(evalInLib("m.APPROVED_PROJECT_REF")).toBe(APPROVED);
    expect(evalInLib("m.APPROVED_PROJECT_URL")).toBe(`https://${APPROVED}.supabase.co`);
  });

  it("fingerprints without containing the original value", () => {
    const fp = evalInLib("m.fingerprint(m.APPROVED_PROJECT_REF)") as string;
    expect(fp).toMatch(/^[0-9a-f]{12}$/);
    expect(fp).not.toContain(APPROVED);
    expect(evalInLib('m.fingerprint("")')).toBe("(empty)");
  });

  it("derives the ref from a pooler DB URL username and from a direct host", () => {
    expect(
      evalInLib(`m.refFromDbUrl("postgresql://postgres.${APPROVED}:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres")`),
    ).toBe(APPROVED);
    expect(evalInLib(`m.refFromDbUrl("postgresql://postgres:pw@db.${APPROVED}.supabase.co:5432/postgres")`)).toBe(APPROVED);
    expect(evalInLib('m.refFromDbUrl("not-a-url")')).toBe("");
  });

  it("derives the ref from a Supabase API URL", () => {
    expect(evalInLib(`m.refFromSupabaseUrl("https://${APPROVED}.supabase.co")`)).toBe(APPROVED);
    expect(evalInLib('m.refFromSupabaseUrl("https://example.com")')).toBe("");
  });

  it("embeds no credential literal", () => {
    const src = readFileSync(approvedLib, "utf8");
    expect(src).not.toMatch(/postgresql:\/\/[^$]*:[^$@]*@/);
    expect(src).not.toMatch(/eyJ[A-Za-z0-9._-]{20,}/);
  });
});

describe("connectivity diagnostic exits non-zero when it cannot verify the project", () => {
  it("fails closed when no project-ref source is configured", () => {
    const r = runDiagnostic({});
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/No project-ref source is configured/);
    expect(r.stdout).toMatch(/1 check\(s\) failed/);
  });

  it("fails on a mismatched project ref and does not probe any layer", () => {
    const r = runDiagnostic({ SUPABASE_PROJECT_REF: "aaaaaaaaaaaaaaaaaaaa" });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/does not resolve to the approved project/);
    // Identity failed, so the probe sections must be skipped entirely.
    expect(r.stdout).not.toMatch(/REST \/ PostgREST data path/);
    expect(r.stdout).not.toMatch(/Auth admin API/);
  });

  it("fails when the API URL points at a different project", () => {
    const r = runDiagnostic({
      SUPABASE_PROJECT_REF: APPROVED,
      NEXT_PUBLIC_SUPABASE_URL: "https://bbbbbbbbbbbbbbbbbbbb.supabase.co",
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/NEXT_PUBLIC_SUPABASE_URL \(ref from host\): present but no project ref|does not resolve to the approved project/);
  });

  it("verifies identity, then still fails when required keys are missing", () => {
    const r = runDiagnostic({
      SUPABASE_PROJECT_REF: APPROVED,
      NEXT_PUBLIC_SUPABASE_URL: `https://${APPROVED}.supabase.co`,
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/resolve to the approved project/);
    expect(r.stdout).toMatch(/Need both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/);
    expect(r.stdout).toMatch(/check\(s\) failed/);
  });

  it("never exits 0 unconditionally and never claims success on failure", () => {
    const src = readFileSync(diagnostic, "utf8");
    // No bare `process.exit(0)` anywhere: the old code always reported success.
    expect(src).not.toMatch(/process\.exit\(0\)/);
    // The crash handler must not swallow failures.
    expect(src).toMatch(/process\.exitCode = 1/);
  });

  it("prints no credential and does not log the raw ref as evidence", () => {
    const src = readFileSync(diagnostic, "utf8");
    expect(src).not.toMatch(/console\.(log|error)\([^)]*(serviceKey|dbUrl|projectRef)/);
    // The key is sent in request headers (required) but never printed.
    expect(src).not.toMatch(/console\.(log|error)\([^)]*\$\{serviceKey\}/);
    // The ref is compared and fingerprinted, never echoed as a value.
    expect(src).toMatch(/fingerprint/);
  });

  it("documents why the ref cannot be un-masked in CI logs", () => {
    const src = readFileSync(diagnostic, "utf8");
    expect(src).toMatch(/masks/i);
    expect(src).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("project ref guard refuses anything but the approved project", () => {
  it("refuses when the ref is missing", () => {
    const r = runGuard({});
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/REFUSING: SUPABASE_PROJECT_REF is not set/);
  });

  it("refuses a malformed ref", () => {
    const r = runGuard({ SUPABASE_PROJECT_REF: "too-short" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/not a valid 20-character project ref/);
  });

  it("refuses a well-formed but unapproved ref, and leaks no ref value", () => {
    const r = runGuard({ SUPABASE_PROJECT_REF: "zzzzzzzzzzzzzzzzzzzz" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/not the approved production project/);
    expect(r.stderr).not.toContain("zzzzzzzzzzzzzzzzzzzz");
  });

  it("passes only for the approved ref", () => {
    const r = runGuard({ SUPABASE_PROJECT_REF: APPROVED });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/guard passed/);
  });

  it("reads the ref from the environment, not from argv", () => {
    const src = readFileSync(guard, "utf8");
    expect(src).toMatch(/process\.env\.SUPABASE_PROJECT_REF/);
    expect(src).not.toMatch(/process\.argv/);
  });
});

describe("migration workflow safety properties", () => {
  const wf = readFileSync(workflow, "utf8");

  it("is dispatch-only and never runs on push or a schedule", () => {
    expect(wf).toMatch(/workflow_dispatch/);
    expect(wf).not.toMatch(/^\s{2}push:/m);
    expect(wf).not.toMatch(/^\s{2}schedule:/m);
  });

  it("is bound to the production environment for human approval", () => {
    expect(wf).toMatch(/environment:\s*production/);
  });

  it("serialises runs with a concurrency group", () => {
    expect(wf).toMatch(/concurrency:/);
    expect(wf).toMatch(/group:\s*supabase-migrations-production/);
    expect(wf).toMatch(/cancel-in-progress:\s*false/);
  });

  it("requires a typed confirmation phrase via a quoted environment variable", () => {
    expect(wf).toMatch(/apply-supabase-migrations/);
    expect(wf).toMatch(/confirmation phrase did not match/);
    // The input is routed through step-level env and compared as a quoted shell
    // variable, never interpolated into the script text.
    expect(wf).toMatch(/CONFIRM_PHRASE:\s*\$\{\{\s*inputs\.confirm\s*\}\}/);
    expect(wf).toMatch(/if \[\[ "\$CONFIRM_PHRASE" != "apply-supabase-migrations" \]\]; then/);
  });

  it("never interpolates untrusted inputs into any run: shell block", () => {
    // Regression guard for the shell-injection class: `${{ inputs.x }}` inside a
    // `run:` script is substituted as text, so a value like `$(...)` or `; ...`
    // executes and `$(echo apply-supabase-migrations)` can even satisfy a check.
    for (const block of runBlocks(wf)) {
      expect(block).not.toMatch(/\$\{\{\s*inputs\./);
      expect(block).not.toMatch(/\$\{\{\s*github\.event\.inputs\./);
    }
  });

  it("runs the project-ref guard before any database-changing command", () => {
    // Match the step commands, not prose in the header comment.
    const guardAt = wf.indexOf("run: node scripts/lib/guard-approved-project.mjs");
    const linkAt = wf.indexOf("run: supabase link --project-ref");
    const dryRunAt = wf.indexOf("run: npm run supabase:migrations:dry-run");
    const pushAt = wf.indexOf("run: npm run supabase:migrations:push");
    expect(guardAt).toBeGreaterThan(-1);
    expect(linkAt).toBeGreaterThan(-1);
    expect(dryRunAt).toBeGreaterThan(-1);
    expect(pushAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(linkAt);
    expect(guardAt).toBeLessThan(dryRunAt);
    expect(guardAt).toBeLessThan(pushAt);
  });

  it("keeps least-privilege permissions", () => {
    expect(wf).toMatch(/permissions:\s*\n\s*contents:\s*read/);
    expect(wf).not.toMatch(/contents:\s*write/);
    expect(wf).not.toMatch(/pull-requests:\s*write/);
  });

  it("hardcodes no credential or project ref", () => {
    expect(wf).not.toMatch(/eyJ[A-Za-z0-9._-]{20,}/);
    expect(wf).not.toMatch(/postgresql:\/\//);
    // The approved ref belongs in scripts/lib/approved-project.mjs only.
    expect(wf).not.toMatch(new RegExp(APPROVED));
  });

  it("notes that environment protection must be configured by the owner", () => {
    expect(wf).toMatch(/required reviewers|protection rules/i);
  });
});

describe("confirmation step is injection-proof (behavioral)", () => {
  const sentinelPayloads: Array<[string, string]> = [
    ["command substitution", "$(touch __SENTINEL__)"],
    ["backtick substitution", "`touch __SENTINEL__`"],
    ["semicolon separator", 'x"; touch __SENTINEL__; echo "'],
    ["logical AND", 'x" && touch __SENTINEL__ && echo "'],
    ["pipeline", 'x" | touch __SENTINEL__ #'],
    ["newline separator", 'x"\ntouch __SENTINEL__\n"'],
    ["forged phrase via substitution", "$(echo apply-supabase-migrations)"],
    ["forged phrase via backticks", "`echo apply-supabase-migrations`"],
    ["single-quote breakout", "'; touch __SENTINEL__; echo '"],
    ["backslash escape", 'x\\"; touch __SENTINEL__; echo "'],
  ];

  it.each(sentinelPayloads)("rejects %s without executing it", (_label, payload) => {
    const r = runConfirmStep(payload);
    expect(r.status).not.toBe(0);
    expect(r.injected).toBe(false);
    expect(r.stdout).not.toMatch(/apply-supabase-migrations/);
  });

  it("rejects empty, whitespace, wrong-case and near-miss values", () => {
    for (const v of ["", " ", "APPLY-SUPABASE-MIGRATIONS", "apply-supabase-migration", " apply-supabase-migrations", "apply-supabase-migrations ", "-apply-supabase-migrations"]) {
      const r = runConfirmStep(v);
      expect(r.status).not.toBe(0);
    }
  });

  it("accepts the exact phrase and nothing more", () => {
    const r = runConfirmStep("apply-supabase-migrations");
    expect(r.status).toBe(0);
    expect(r.injected).toBe(false);
  });
});

describe("ref extraction fails closed on malformed and ambiguous values", () => {
  const BAD = "aaaaaaaaaaaaaaaaaaaa";

  it("rejects refs never found in a real Supabase URL shape", () => {
    const cases: Array<[string, string]> = [
      ["hostname suffix", `https://${APPROVED}.supabase.co.evil.com`],
      ["userinfo trick", `https://${APPROVED}.supabase.co@evil.com`],
      ["path-only mention", `https://evil.com/${APPROVED}.supabase.co`],
      ["prefixed label", `https://evil-${APPROVED}.supabase.co`],
      ["extra label", `https://a.b.supabase.co`],
      ["wrong suffix", `https://${APPROVED}.supabase.io`],
      ["not a url", "not a url"],
      ["empty", ""],
    ];
    for (const [label, value] of cases) {
      expect([label, evalInLib(`m.refFromSupabaseUrl(${JSON.stringify(value)})`)]).toEqual([label, ""]);
    }
  });

  it("refuses ambiguous DB URLs where username and host disagree", () => {
    const ambiguous = [
      `postgresql://postgres.${APPROVED}:pw@db.${BAD}.supabase.co:5432/postgres`,
      `postgresql://postgres.${BAD}:pw@db.${APPROVED}.supabase.co:5432/postgres`,
    ];
    for (const url of ambiguous) {
      expect(evalInLib(`m.refFromDbUrl(${JSON.stringify(url)})`)).toBe("");
      const analysis = evalInLib(`m.analyzeDbUrlRef(${JSON.stringify(url)})`) as {
        ambiguous: boolean;
        ref: string;
      };
      expect(analysis.ambiguous).toBe(true);
      expect(analysis.ref).toBe("");
    }
  });

  it("resolves unambiguously only when sources agree", () => {
    const bothAgree = `postgresql://postgres.${APPROVED}:pw@db.${APPROVED}.supabase.co:5432/postgres`;
    expect(evalInLib(`m.refFromDbUrl(${JSON.stringify(bothAgree)})`)).toBe(APPROVED);
    const analysis = evalInLib(`m.analyzeDbUrlRef(${JSON.stringify(bothAgree)})`) as {
      ambiguous: boolean;
    };
    expect(analysis.ambiguous).toBe(false);
  });

  it("rejects malformed, unrecognised and partially-matching DB URLs", () => {
    const cases = [
      `postgresql://postgres.${APPROVED}EXTRA:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`,
      `postgresql://postgres.ZZ${APPROVED}:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`,
      `postgresql://u:p@h/d?x=postgres.${APPROVED}`,
      `postgresql://p:pw@db.${APPROVED}.supabase.co.evil.com:5432/db`,
      "postgresql://bad host/pw",
      "not a url",
      "",
    ];
    for (const url of cases) {
      expect([url, evalInLib(`m.refFromDbUrl(${JSON.stringify(url)})`)]).toEqual([url, ""]);
    }
  });

  it("flags a malformed DB URL distinctly from an unrecognised one", () => {
    const malformed = evalInLib('m.analyzeDbUrlRef("postgresql://bad host/pw")') as {
      malformed: boolean;
      ambiguous: boolean;
    };
    expect(malformed.malformed).toBe(true);
    expect(malformed.ambiguous).toBe(false);
    const unrecognised = evalInLib('m.analyzeDbUrlRef("postgresql://u:p@h:5432/db")') as {
      malformed: boolean;
      ref: string;
    };
    expect(unrecognised.malformed).toBe(false);
    expect(unrecognised.ref).toBe("");
  });
});

// --- Destination guard for write-capable Firestore migration workflows -------
// Every workflow that can write to Supabase must verify the destination project
// before any database-changing command. The Firestore migration workflows
// authenticate with a URL + service key (not a ref), so they need the URL guard.
describe("write-capable migration workflows verify the destination project", () => {
  const urlGuard = resolve(root, "scripts/lib/guard-approved-supabase-url.mjs");

  const DEST_WRITING_WORKFLOWS = [
    "firestore-batched-migration.yml",
    "firestore-staged-migration.yml",
  ];
  const GUARDED_REF_WORKFLOWS = [
    "supabase-migrations.yml",
    "ai-knowledge-migration-apply.yml",
  ];

  it.each(GUARDED_REF_WORKFLOWS)("%s runs the project-ref guard before any db command", (file) => {
    const wf = readFileSync(resolve(root, ".github/workflows", file), "utf8");
    const guardAt = wf.indexOf("run: node scripts/lib/guard-approved-project.mjs");
    expect(guardAt).toBeGreaterThan(-1);
    const applyAt = wf.indexOf("run: node scripts/apply-ai-knowledge-migration.mjs");
    if (applyAt > -1) expect(guardAt).toBeLessThan(applyAt);
  });

  it.each(DEST_WRITING_WORKFLOWS)(
    "%s runs the URL guard before any migration script",
    (file) => {
      const wf = readFileSync(resolve(root, ".github/workflows", file), "utf8");
      const guardAt = wf.indexOf("run: node scripts/lib/guard-approved-supabase-url.mjs");
      expect(guardAt).toBeGreaterThan(-1);

      // The guard must precede the first script that can touch the destination.
      const scriptMarkers = [
        "npx tsx scripts/migrate-all-batched.ts",
        "npx tsx scripts/migrate-staged-phase1.ts",
        "node scripts/apply-ai-knowledge-migration.mjs",
        "npx tsx scripts/fetch-checkpoint.ts",
      ];
      for (const marker of scriptMarkers) {
        const at = wf.indexOf(marker);
        if (at > -1) expect(guardAt).toBeLessThan(at);
      }
    },
  );

  it.each(DEST_WRITING_WORKFLOWS)("%s passes the URL via env, never interpolated into a shell", (file) => {
    const wf = readFileSync(resolve(root, ".github/workflows", file), "utf8");
    const block = /- name: Guard approved Supabase project\n([\s\S]*?)\n\n/.exec(wf)?.[0] ?? "";
    expect(block).toMatch(/NEXT_PUBLIC_SUPABASE_URL:\s*\$\{\{\s*secrets\.NEXT_PUBLIC_SUPABASE_URL\s*\}\}/);
    expect(block).not.toMatch(/\$\{\{\s*inputs\./);
  });

  describe("URL guard refuses anything but the approved project", () => {
    function runUrlGuard(env: Record<string, string>) {
      return spawnSync("node", [urlGuard], { cwd: root, env: { ...process.env, ...env }, encoding: "utf8" });
    }

    it("refuses when the URL is missing", () => {
      const r = runUrlGuard({ NEXT_PUBLIC_SUPABASE_URL: "" });
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/is not set/);
    });

    it("refuses a hostname-suffix spoof", () => {
      const r = runUrlGuard({ NEXT_PUBLIC_SUPABASE_URL: `https://${APPROVED}.supabase.co.evil.com` });
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/does not resolve to a Supabase project ref/);
    });

    it("refuses a well-formed but unapproved project, and leaks no URL", () => {
      const other = "https://zzzzzzzzzzzzzzzzzzzz.supabase.co";
      const r = runUrlGuard({ NEXT_PUBLIC_SUPABASE_URL: other });
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/not the approved production project/);
      expect(r.stderr).not.toContain(other);
    });

    it("passes for the approved project", () => {
      const r = runUrlGuard({ NEXT_PUBLIC_SUPABASE_URL: `https://${APPROVED}.supabase.co` });
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/guard passed/);
    });

    it("reads the URL from the environment, not from argv, and hardcodes no ref", () => {
      const src = readFileSync(urlGuard, "utf8");
      expect(src).toMatch(/process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
      expect(src).not.toMatch(/process\.argv/);
      expect(src).not.toMatch(new RegExp(APPROVED));
    });
  });
});
