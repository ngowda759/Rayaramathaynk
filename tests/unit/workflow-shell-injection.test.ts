/**
 * @jest-environment node
 *
 * Repository-wide guard against GitHub Actions expression injection.
 *
 * `${{ ... }}` inside a `run:` block is substituted into the script *text* before
 * the shell parses it, so an untrusted value is not data — it is code. A value
 * such as `$(...)`, backticks, `;`, `|` or `&&` executes, and a value like
 * `$(echo <expected phrase>)` can even satisfy an equality check against it.
 *
 * Two independent checks:
 *   1. static  — no untrusted expression is interpolated into any run: block;
 *   2. behavioral — the confirmation gates are executed for real, with
 *      metacharacter payloads, proving nothing executes and the gate still fails.
 *
 * Nothing here touches a database, the network, or a production workflow.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, unlinkSync } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const wfDir = resolve(root, ".github/workflows");

/**
 * Expressions that carry attacker-controlled or step-derived data. Secrets and
 * `github.repository`/`github.ref` are deliberately absent: they are trusted and
 * are normally passed through `env:` anyway.
 */
const UNTRUSTED = new RegExp(
  String.raw`\$\{\{[^}]*\b(` +
    [
      String.raw`inputs\.`,
      String.raw`github\.event\.inputs\.`,
      String.raw`steps\.`,
      String.raw`needs\.`,
      String.raw`matrix\.`,
      String.raw`env\.`,
      // event payloads that can contain author-supplied text
      String.raw`github\.event\.(pull_request|issue|comment|review|discussion|commits|head_commit|workflow_run|client_payload)\b`,
    ].join("|") +
    String.raw`)`,
);

type RunBlock = { file: string; line: number; body: string };

/** Every `run:` script body in a workflow, with its 1-based start line. */
export function runBlocks(file: string, yaml: string): RunBlock[] {
  const lines = yaml.split("\n");
  const out: RunBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)run:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const indent = m[1].length;
    const inline = m[2];
    if (inline && !inline.startsWith("|") && !inline.startsWith(">")) {
      out.push({ file, line: i + 1, body: inline });
      continue;
    }
    const body: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "") {
        body.push("");
        continue;
      }
      if (line.length - line.trimStart().length <= indent) break;
      body.push(line.slice(indent + 2));
    }
    out.push({ file, line: i + 1, body: body.join("\n") });
  }
  return out;
}

/** All untrusted interpolations found in a workflow's run: blocks. */
export function findUnsafeInterpolations(file: string, yaml: string): RunBlock[] {
  return runBlocks(file, yaml).filter((b) => UNTRUSTED.test(b.body));
}

function workflowFiles(): string[] {
  return readdirSync(wfDir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();
}

/** The step's own `env:` mapping and `run:` body, resolved from the YAML text. */
function stepScript(
  yaml: string,
  stepName: string,
): { env: Record<string, string>; body: string } {
  const lines = yaml.split("\n");
  const start = lines.findIndex((l) => l.trim() === `- name: ${stepName}`);
  if (start === -1) throw new Error(`step not found: ${stepName}`);
  const stepIndent = lines[start].length - lines[start].trimStart().length;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;
    const ind = lines[i].length - lines[i].trimStart().length;
    if (ind <= stepIndent && lines[i].trimStart().startsWith("- ")) {
      end = i;
      break;
    }
  }
  const block = lines.slice(start, end);

  const env: Record<string, string> = {};
  const envAt = block.findIndex((l) => l.trim() === "env:");
  if (envAt !== -1) {
    const envIndent = block[envAt].length - block[envAt].trimStart().length;
    for (let i = envAt + 1; i < block.length; i++) {
      if (block[i].trim() === "") continue;
      const ind = block[i].length - block[i].trimStart().length;
      if (ind <= envIndent) break;
      const mm = /^\s*([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(block[i]);
      if (mm) env[mm[1]] = mm[2].trim();
    }
  }

  const runAt = block.findIndex((l) => /^\s*run:\s*\|?\s*$/.test(l));
  if (runAt === -1) throw new Error(`no run: block in step: ${stepName}`);
  const runIndent = block[runAt].length - block[runAt].trimStart().length;
  const body: string[] = [];
  for (let i = runAt + 1; i < block.length; i++) {
    if (block[i].trim() === "") {
      body.push("");
      continue;
    }
    const ind = block[i].length - block[i].trimStart().length;
    if (ind <= runIndent) break;
    body.push(block[i].slice(runIndent + 2));
  }
  return { env, body: body.join("\n") };
}

/**
 * Execute a `run:` step the way GitHub would: the body verbatim, with the step's
 * `env:` supplied as environment variables (expressions resolved to test values),
 * never substituted into the script text.
 */
function execStep(
  file: string,
  stepName: string,
  inputValues: Record<string, string>,
): { status: number | null; stderr: string; stdout: string } {
  const yaml = readFileSync(resolve(wfDir, file), "utf8");
  const { env, body } = stepScript(yaml, stepName);
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    const m = /^\$\{\{\s*(?:inputs|github\.event\.inputs)\.([A-Za-z0-9_-]+)\s*\}\}$/.exec(value);
    if (m) resolved[key] = inputValues[m[1]] ?? "";
    else resolved[key] = value;
  }
  const r = spawnSync("bash", ["-c", body], {
    cwd: root,
    env: { ...process.env, ...resolved },
    encoding: "utf8",
  });
  return { status: r.status, stderr: r.stderr ?? "", stdout: r.stdout ?? "" };
}

describe("static: no untrusted expression is interpolated into a run: block", () => {
  it("the detector actually detects a known-vulnerable snippet", () => {
    // Guards against a regex that matches nothing and therefore "passes" vacuously.
    const bad = [
      "jobs:",
      "  x:",
      "    steps:",
      "      - name: Check",
      "        run: |",
      '          if [ "${{ inputs.confirm }}" != "ok" ]; then exit 1; fi',
    ].join("\n");
    expect(findUnsafeInterpolations("synthetic.yml", bad)).toHaveLength(1);
    const bad2 = ['        run: echo "${{ github.event.inputs.batch }}"'].join("\n");
    expect(findUnsafeInterpolations("synthetic.yml", bad2)).toHaveLength(1);
  });

  it("every workflow in the repository is clean", () => {
    const offenders: string[] = [];
    for (const file of workflowFiles()) {
      const yaml = readFileSync(resolve(wfDir, file), "utf8");
      for (const b of findUnsafeInterpolations(file, yaml)) {
        offenders.push(`${b.file}:${b.line} -> ${b.body.split("\n")[0].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("production-capable workflows pin third-party actions to full commit SHAs", () => {
    const productionCapable = [
      "supabase-migrations.yml",
      "ai-knowledge-migration-apply.yml",
      "resolve-raya-ai-baseline.yml",
      "firestore-batched-migration.yml",
      "firestore-staged-migration.yml",
      "firestore-production-export.yml",
      "aaradhane.yml",
    ];
    const unpinned: string[] = [];
    for (const file of productionCapable) {
      const yaml = readFileSync(resolve(wfDir, file), "utf8");
      for (const line of yaml.split("\n")) {
        const m = /^\s*uses:\s*(\S+)\s*(?:#\s*(.*))?$/.exec(line);
        if (!m) continue;
        const ref = m[1];
        if (ref.startsWith("./")) continue; // local actions
        const at = ref.lastIndexOf("@");
        const version = at === -1 ? "" : ref.slice(at + 1);
        if (!/^[0-9a-f]{40}$/.test(version)) {
          unpinned.push(`${file}: ${ref}`);
        }
      }
    }
    expect(unpinned).toEqual([]);
  });
});

describe("behavioral: confirmation gates cannot execute injected commands", () => {
  const gates: Array<[string, string, string]> = [
    [
      "supabase-migrations.yml",
      "Check confirmation phrase",
      "apply-supabase-migrations",
    ],
    [
      "ai-knowledge-migration-apply.yml",
      "Check confirmation phrase",
      "apply-create-ai-knowledge",
    ],
    [
      "resolve-raya-ai-baseline.yml",
      "Check confirmation phrase",
      "resolve-baseline-raya-ai",
    ],
  ];

  const sentinelFor = (id: string) => resolve(root, `.inj-${id}-${process.pid}`);

  const metacharacterPayloads = (sentinel: string): Array<[string, string]> => [
    ["command substitution", `$(touch ${sentinel})`],
    ["backtick substitution", "`touch " + sentinel + "`"],
    ["semicolon separator", `x"; touch ${sentinel}; echo "`],
    ["logical AND", `x" && touch ${sentinel} && echo "`],
    ["pipeline", `x" | touch ${sentinel} #`],
    ["newline separator", `x"\ntouch ${sentinel}\n"`],
    ["unquoted glob", `*`],
    ["single-quote breakout", `'; touch ${sentinel}; echo '`],
    ["backslash escape", `x\\"; touch ${sentinel}; echo "`],
    ["forged phrase via substitution", "$(echo PLACEHOLDER)"],
    ["forged phrase via backticks", "`echo PLACEHOLDER`"],
  ];

  it.each(gates)(
    "%s rejects metacharacter and command-substitution payloads without executing them",
    (file, step, phrase) => {
      const sentinel = sentinelFor(file.split(".")[0]);
      if (existsSync(sentinel)) unlinkSync(sentinel);
      try {
        for (const [label, raw] of metacharacterPayloads(sentinel)) {
          const payload = raw.replace(/PLACEHOLDER/g, phrase);
          const r = execStep(file, step, { confirm: payload });
          expect([file, label, r.status !== 0]).toEqual([file, label, true]);
          expect(existsSync(sentinel)).toBe(false);
        }
      } finally {
        if (existsSync(sentinel)) unlinkSync(sentinel);
      }
    },
  );

  it.each(gates)("%s rejects empty, whitespace, case and near-miss values", (file, step) => {
    for (const v of [
      "",
      " ",
      "APPLY",
      "apply",
      " apply-supabase-migrations",
      "apply-supabase-migrations ",
      "-apply-supabase-migrations",
      "apply-supabase-migrations\nextra",
    ]) {
      const r = execStep(file, step, { confirm: v });
      expect([file, v, r.status !== 0]).toEqual([file, v, true]);
    }
  });

  it.each(gates)("%s accepts only its exact phrase", (file, step, phrase) => {
    const r = execStep(file, step, { confirm: phrase });
    expect([file, r.status]).toEqual([file, 0]);
  });

  it.each(gates)("%s reads the phrase from the environment, not the script text", (file, step) => {
    const yaml = readFileSync(resolve(wfDir, file), "utf8");
    const { env, body } = stepScript(yaml, step);
    const values = Object.values(env);
    expect(values.some((v) => v.includes("inputs.confirm"))).toBe(true);
    expect(body).not.toMatch(/inputs\.confirm/);
    expect(body).toMatch(/\$\{?[A-Za-z_]/); // references a shell variable
  });
});
