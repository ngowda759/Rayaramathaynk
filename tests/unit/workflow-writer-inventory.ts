/**
 * Shared inventory of every GitHub Actions job that reaches a database, plus the
 * parsers the workflow-completeness tests use to prove a destination guard runs
 * before the first connection or write.
 *
 * This module is deliberately dependency-free (no YAML library is a declared
 * dependency) and does no I/O beyond reading the files it is pointed at: no
 * database, no network, no workflow dispatch.
 *
 * The inventory is the single source of truth for "which workflows can touch a
 * database". Both the completeness test in this file's sibling
 * (`workflow-db-writer-guards.test.ts`) and the repo-wide scan in
 * `supabase-diagnostics-migration-safety.test.ts` derive their expectations from
 * here, so a writer cannot be guarded in one place and forgotten in the other.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export const workflowsDir = resolve(__dirname, "../..", ".github/workflows");

/**
 * Statement prefixes that still execute the following command.
 *
 * A writer wrapped in a form the scanner does not look inside is a writer the
 * completeness and guard-ordering checks never see. Two classes are handled:
 *
 *  - shell conditions (`if`, `then`, `!`) and `xargs`, because each runs the
 *    command exactly like a bare one; and
 *  - command *wrappers* — `sudo`, `exec`, `nice`, `nohup`, `setsid`, `ionice`,
 *    `stdbuf`, `env`, `timeout`, `xargs`, `command -p` — because each ultimately
 *    executes the command that follows it. Optional flags (and `timeout`'s
 *    duration, `env`'s `NAME=value` assignments, `sudo`'s user/group) are consumed
 *    so the real command is reached.
 *
 * `command` is restricted to `-p`/`--` (which still run the command) so the
 * lookup forms `command -v`/`-V`, which do not connect, stay excluded.
 */

/**
 * The arguments a wrapper accepts before the real command. Permissive on purpose:
 * flags (`-u postgres`, `-n 10`, `-k 5`), `NAME=value` assignments, durations and
 * bare values. The wrapper alternation is followed by an anchored known-command
 * match, so permissiveness cannot manufacture a match where no `psql`/`pg_dump`/
 * `pg_restore` token exists — the regex engine backtracks to let the command match.
 */
const WRAP_ARGS = "(?:\\s+(?:-\\S+|[A-Za-z0-9_./:=@+,-]+))*";

/**
 * `xargs`'s arguments before the command it runs. Like `WRAP_ARGS`, but a handful
 * of options take a *separate* value (`xargs -I {}`, `xargs -n 1`, `xargs -a file`,
 * `xargs -P 4`, `xargs -s`, `xargs -E`, `xargs -d`, `xargs -L`), which a bare
 * `-\S+` run cannot consume. The value-taking options are listed first so the
 * placeholder/value token is not mistaken for the command.
 *
 * A bare command word (`xargs echo psql`) is deliberately *not* consumed: `xargs`
 * runs `echo`, not `psql`, so treating that as a writer would be a false positive.
 */
const XARGS_ARGS = "(?:\\s+(?:-[InPsEadL]\\s+\\S+|-[^\\s]+))*";

const CMD_WRAPPERS = [
  "sudo" + WRAP_ARGS,
  "exec",
  "nice" + WRAP_ARGS,
  "nohup",
  "setsid",
  "ionice" + WRAP_ARGS,
  "stdbuf" + WRAP_ARGS,
  "timeout" + WRAP_ARGS,
  "env" + WRAP_ARGS,
  "xargs" + XARGS_ARGS,
  "command(?:\\s+(?:-p|--))?",
  "if",
  "then",
  "!",
];

/**
 * An optional path in front of the command name — absolute (`/usr/bin/psql`,
 * `/usr/lib/postgresql/15/bin/psql`) or relative (`./psql`, `../bin/psql`,
 * `bin/psql`). Without this a path-qualified invocation is a way to run a writer
 * the anchored `^psql` test misses entirely.
 */
const CMD_PATH = "(?:(?:/|\\.{1,2}/)?(?:[-A-Za-z0-9._+]+/)*)";

const CMD_PREFIX =
  "(?:[A-Za-z_][A-Za-z0-9_]*=\\S*\\s+)*" +
  `(?:(?:${CMD_WRAPPERS.join("|")})\\s+)*` +
  CMD_PATH;

/**
 * A command-substitution prefix: an assignment whose value is a substitution
 * (`removed="$(psql …)"`, `` removed=`psql …` ``), or the substitution opener on
 * its own (`"$(psql …"`, `` `psql …` ``).
 *
 * The Seva purge and the backup's version probe both capture `psql` output this
 * way. Without this prefix the statement begins with `removed="$(psql`, so an
 * anchored `^psql` test misses the write entirely — the false negative this
 * module exists to close. Both the `$( )` and backtick forms are recognised.
 */
const SUBST_PREFIX = '(?:(?:[A-Za-z_][A-Za-z0-9_]*=)?(?:"\\$\\(' + "|`))?";

/**
 * A shell variable whose name denotes a database connection string.
 *
 * Matching only `*DB_URL` (the names the current workflows happen to use) left a
 * hole in the A-2h invariant: a `psql "$DATABASE_URL" …` call added after the guard,
 * reading a *different* secret, was invisible to both `rawDbClientStatements` and
 * `dbUrlVarIn`, so it was never ordered against the guard. Any conventional
 * connection-string variable name is recognised instead: a `URL`/`URI`/`DSN`/`CONN`
 * substring or the word `DATABASE` (covers `DATABASE_URL`, `SUPABASE_DB_URL`,
 * `PG_URL`, `SEVA_BACKUP_DB_URL`, `DIRECT_CONN`).
 */
const DB_URL_VAR = "[A-Za-z_][A-Za-z0-9_]*(?:URL|URI|DSN|CONN|DATABASE)[A-Za-z0-9_]*";

export interface Step {
  name: string;
  id: string;
  /** The step's `if:` condition, resolved from outside the `run:` body. */
  if: string;
  continueOnError: boolean;
  uses: string;
  runBody: string;
  index: number;
}

export interface Job {
  name: string;
  /** The job's `environment:` binding, if any. */
  environment: string;
  steps: Step[];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build the anchored pattern that matches `command` as a whole command.
 *
 * Whitespace between the tokens is matched as `\s+` rather than a single literal
 * space, and an argument may be wrapped in quotes (the shell removes them before
 * execution, so `--project "tsconfig.scripts.json"` runs the same command as the
 * unquoted form). Matching the literal text alone made the quoted form a way to
 * run a writer that the scanner never saw.
 */
function commandPattern(command: string): string {
  const tokens = command.split(/\s+/).map(escapeRegExp);
  const body = tokens.join('"?\\s+"?');
  return `^${SUBST_PREFIX}${CMD_PREFIX}${body}(?:\\s|$|["']|\\))`;
}

/**
 * Parse a workflow into jobs, each with its ordered steps.
 *
 * Regex-based on purpose: no YAML library is a declared dependency. Step-level
 * keys are read from the text *outside* the shell body so a `run:` line that
 * happens to look like `if:` or `id:` cannot be mistaken for a key.
 */
export function parseWorkflow(yaml: string): Job[] {
  const lines = yaml.split("\n");

  const jobsIndex = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (jobsIndex === -1) return [];

  const jobStarts: { name: string; line: number }[] = [];
  for (let i = jobsIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) break; // next top-level key
    const m = /^ {2}([A-Za-z0-9_.-]+):\s*$/.exec(line);
    if (m) jobStarts.push({ name: m[1], line: i });
  }

  const jobs: Job[] = [];
  for (let j = 0; j < jobStarts.length; j++) {
    const from = jobStarts[j].line;
    const to = jobStarts[j + 1]?.line ?? lines.length;
    const chunk = lines.slice(from, to);

    const envMatch = /^ {4}environment:\s*(\S+)\s*$/.exec(
      chunk.find((l) => /^ {4}environment:/.test(l)) ?? "",
    );

    // A step is a `- ` list item at indent >= 4 inside the job.
    const stepStarts: number[] = [];
    for (let i = 0; i < chunk.length; i++) {
      const line = chunk[i];
      if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
      const indent = line.length - line.trimStart().length;
      if (/^-\s/.test(line.trim()) && indent >= 4) stepStarts.push(i);
    }

    const steps: Step[] = [];
    for (let s = 0; s < stepStarts.length; s++) {
      const stepFrom = stepStarts[s];
      const stepTo = stepStarts[s + 1] ?? chunk.length;
      const body = chunk.slice(stepFrom, stepTo);

      const runIdx = body.findIndex((l) => /^\s*run:\s*/.test(l));
      let runEnd = -1;
      let runBody = "";
      if (runIdx >= 0) {
        const m = /^(\s*)run:\s*(.*)$/.exec(body[runIdx]);
        if (m) {
          const runIndent = m[1].length;
          const inline = m[2];
          if (inline && !inline.startsWith("|") && !inline.startsWith(">")) {
            runBody = inline;
            runEnd = runIdx + 1;
          } else {
            const out: string[] = [];
            let k = runIdx + 1;
            for (; k < body.length; k++) {
              const l = body[k];
              if (l.trim() === "") {
                out.push("");
                continue;
              }
              if (l.length - l.trimStart().length <= runIndent) break;
              out.push(l.slice(runIndent + 2));
            }
            runBody = out.join("\n");
            runEnd = k;
          }
        }
      }
      // Keys are read only from outside the shell body, so a `run:` line such as
      // `echo "id: x"` cannot be read as a step key.
      const keyRegion = body.filter((_, i) => i < runIdx || i >= runEnd).join("\n");

      steps.push({
        name: /^\s*-\s*name:\s*(.*)$/.exec(body[0])?.[1]?.trim() ?? "",
        id: /^\s*id:\s*(\S+)\s*$/m.exec(keyRegion)?.[1] ?? "",
        if: /^\s*if:\s*(.*)$/m.exec(keyRegion)?.[1]?.trim() ?? "",
        continueOnError: /^\s*continue-on-error:\s*true\s*$/m.test(keyRegion),
        uses: /^\s*uses:\s*(\S+)/m.exec(keyRegion)?.[1] ?? "",
        runBody,
        index: s,
      });
    }

    jobs.push({ name: jobStarts[j].name, environment: envMatch?.[1] ?? "", steps });
  }
  return jobs;
}

/** Split a shell body into the individual commands it may run. */
export function shellStatements(body: string): string[] {
  const split = (s: string) =>
    s
      .split(/\n|;|&&|\|\||\|/)
      .map((p) => p.trim())
      .filter(Boolean);

  const out = split(body);
  // Unwrap nested shells so a command hidden inside `bash -c '…'`, `sh -c "…"`,
  // `eval …` or `xargs …` is seen as the command it is. Without this, those forms
  // are a way to run a writer the inventory scan never looks inside. Iterated to a
  // fixpoint (bounded) so `bash -c 'bash -c "psql …"'` does not hide behind one
  // layer of unwrapping.
  const nestedRe = /^(?:sudo\s+)?(?:(?:bash|sh|zsh|dash)\s+-[a-z]*c|eval)\s+(.*)$/;
  for (let depth = 0; depth < 5; depth++) {
    let unwrapped = 0;
    for (const statement of [...out]) {
      const inner = nestedRe.exec(statement)?.[1];
      if (!inner) continue;
      for (const part of split(inner)) {
        const stripped = part.replace(/^['"]|['"]$/g, "").trim();
        if (stripped && !out.includes(stripped)) {
          out.push(stripped);
          unwrapped++;
        }
      }
    }
    if (unwrapped === 0) break;
  }
  return out;
}

/**
 * Statement indices within `body` that actually invoke `command`, directly,
 * through a command substitution, or through an npm script whose value starts
 * with `command`.
 */
export function commandStatements(
  body: string,
  command: string,
  scripts: Record<string, string>,
): number[] {
  const statements = shellStatements(body);
  const direct = new RegExp(commandPattern(command));
  const hits: number[] = [];
  statements.forEach((s, i) => {
    if (direct.test(s)) hits.push(i);
  });
  for (const [name, value] of Object.entries(scripts)) {
    if (!String(value).trim().startsWith(command)) continue;
    const alias = new RegExp(commandPattern(`npm run ${name}`));
    statements.forEach((s, i) => {
      if (alias.test(s) && !hits.includes(i)) hits.push(i);
    });
  }
  return hits.sort((a, b) => a - b);
}

/** The npm scripts declared by package.json, used to resolve `npm run x` aliases. */
export function readPackageScripts(): Record<string, string> {
  return (JSON.parse(readFileSync(resolve(__dirname, "../..", "package.json"), "utf8")).scripts ??
    {}) as Record<string, string>;
}

/**
 * Whether a step's `if:` makes it never run in practice.
 *
 * Only expressions that reduce to a literal `false` are treated as disabling, so
 * a legitimate condition such as `!cancelled()` or `inputs.dry_run == false` is
 * not a false positive. A trailing YAML comment and the `!true` / quoted forms are
 * handled, because each of those is a way to write "never" that a plain
 * `=== "false"` comparison would miss.
 */
export function stepIsDisabled(step: Step): boolean {
  if (!step.if) return false;
  const normalized = step.if
    .replace(/\s+#.*$/, "") // trailing YAML comment
    .replace(/^\$\{\{/, "")
    .replace(/\}\}$/, "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
  return normalized === "false" || normalized === "!true";
}

/**
 * Whether a step's `if:` can run it after an earlier step failed.
 *
 * `always()`, `failure()` and `cancelled()` all override the default "only when
 * every earlier step succeeded" rule. A write step using one of them runs even
 * when the guard refused the destination — the ordering alone is not protection,
 * so the condition must also name the guard's outcome.
 */
export function runsRegardlessOfEarlierFailure(step: Step): boolean {
  return /\b(always|failure|cancelled)\s*\(/.test(step.if);
}

/**
 * `psql` / `pg_dump` / `pg_restore` statements that reach a database, in any
 * supported invocation form: a bare call, an environment-prefixed call, a
 * `sudo`/`exec`/`command` wrapper, or a command substitution whose captured
 * output is assigned to a shell variable.
 */
export function rawDbClientStatements(body: string): string[] {
  return shellStatements(body).filter(
    (s) =>
      new RegExp(`^${SUBST_PREFIX}${CMD_PREFIX}(psql|pg_dump|pg_restore)(?:\\s|$)`).test(s) &&
      new RegExp(`\\$\\{?(${DB_URL_VAR})\\}?`).test(s),
  );
}

export interface WriterEntry {
  /** Stable id, used to detect a writer being dropped from the inventory. */
  id: string;
  /** Workflow file name under .github/workflows/. */
  file: string;
  /** What the writer does, for failure messages. */
  kind: "migration" | "backup" | "purge" | "baseline" | "connect" | "writer";
  /** Commands that reach the database (guards excluded). */
  commands: string[];
  /** Raw `psql`/`pg_dump`/`pg_restore` statements, when the writer uses them. */
  rawCli: boolean;
  /** The approved-* guard that must run first. */
  guard: string;
  /** The secret the guard reads, for the env-only assertion. */
  guardVar: string;
  /**
   * Whether the workflow is destructive. A destructive writer is never
   * authorised by a destination guard alone (see docs/SECURITY_DESTRUCTIVE_AUTHORIZATION.md).
   */
  destructive: boolean;
  /** `manual` = workflow_dispatch only; `scheduled` also runs on cron. */
  trigger: "manual" | "scheduled";
  /** Expected job-level environment binding, or "" for none. */
  environment: string;
  /**
   * How the destination is verified: by a dedicated guard step, or inside the
   * script itself through the same shared approved-project library (the
   * connectivity diagnostic verifies identity before it opens any connection).
   */
  guardStyle: "step" | "in-script";
  /**
   * Expected workflow-level `concurrency.group`, or "" when the workflow is not
   * expected to serialise. Two overlapping runs of the same database writer can
   * interleave writes, so every writer either declares a group here or states
   * deliberately that it has none.
   */
  concurrencyGroup: string;
}

/**
 * Every job in the repository that opens a database connection or writes to a
 * database, with the guard that must run before it.
 *
 * Adding a writer here without a guard, or adding a guarded workflow and
 * forgetting this list, both fail the completeness test.
 */
export const DB_WRITER_INVENTORY: WriterEntry[] = [
  {
    id: "aaradhane-generate",
    file: "aaradhane.yml",
    kind: "writer",
    // The writer itself. Only the `--apply` path reaches Supabase, and this
    // workflow never passes it (see the containment note in the YAML), but the
    // command is enumerated so removing the guard — or wiring `--apply` in — is
    // caught rather than passing silently.
    commands: ["npx ts-node --project tsconfig.scripts.json scripts/generate-aaradhane.ts"],
    rawCli: false,
    guard: "node scripts/lib/guard-approved-supabase-url.mjs",
    guardVar: "NEXT_PUBLIC_SUPABASE_URL",
    destructive: false,
    trigger: "scheduled",
    environment: "production",
    guardStyle: "step",
    concurrencyGroup: "aaradhane-generate",
  },
  {
    id: "supabase-migrations",
    file: "supabase-migrations.yml",
    kind: "migration",
    commands: ["supabase link", "supabase db push"],
    rawCli: false,
    guard: "node scripts/lib/guard-approved-project.mjs",
    guardVar: "SUPABASE_PROJECT_REF",
    destructive: false,
    trigger: "manual",
    environment: "production",
    guardStyle: "step",
    concurrencyGroup: "supabase-migrations-production",
  },
  {
    id: "ai-knowledge-migration-apply",
    file: "ai-knowledge-migration-apply.yml",
    kind: "migration",
    commands: ["node scripts/apply-ai-knowledge-migration.mjs"],
    rawCli: false,
    guard: "node scripts/lib/guard-approved-project.mjs",
    guardVar: "SUPABASE_PROJECT_REF",
    destructive: false,
    trigger: "manual",
    environment: "production",
    guardStyle: "step",
    concurrencyGroup: "ai-knowledge-migration-apply",
  },
  {
    id: "resolve-raya-ai-baseline",
    file: "resolve-raya-ai-baseline.yml",
    kind: "baseline",
    commands: ["node scripts/resolve-baseline-raya-ai.mjs"],
    rawCli: false,
    guard: "node scripts/lib/guard-approved-project.mjs",
    guardVar: "SUPABASE_PROJECT_REF",
    destructive: false,
    trigger: "manual",
    environment: "production",
    guardStyle: "step",
    concurrencyGroup: "resolve-raya-ai-baseline",
  },
  {
    id: "firestore-batched-migration",
    file: "firestore-batched-migration.yml",
    kind: "migration",
    commands: [
      "npx tsx scripts/fetch-checkpoint.ts",
      "npx tsx scripts/migrate-all-batched.ts",
    ],
    rawCli: false,
    guard: "node scripts/lib/guard-approved-supabase-url.mjs",
    guardVar: "NEXT_PUBLIC_SUPABASE_URL",
    destructive: false,
    trigger: "manual",
    environment: "production",
    guardStyle: "step",
    concurrencyGroup: "",
  },
  {
    id: "firestore-staged-migration",
    file: "firestore-staged-migration.yml",
    kind: "migration",
    commands: [
      "npx tsx scripts/dump-firestore-staged.ts",
      "npx tsx scripts/migrate-staged-phase1.ts",
    ],
    rawCli: false,
    guard: "node scripts/lib/guard-approved-supabase-url.mjs",
    guardVar: "NEXT_PUBLIC_SUPABASE_URL",
    destructive: false,
    trigger: "manual",
    environment: "production",
    guardStyle: "step",
    concurrencyGroup: "",
  },
  {
    // Nightly encrypted backup. Writes a row to public.ops_backup_runs on every
    // run and streams pg_dump through the same connection string.
    id: "seva-backup",
    file: "seva-backup.yml",
    kind: "backup",
    commands: ["bash scripts/seva/backup.sh"],
    rawCli: true,
    guard: "node scripts/lib/guard-approved-db-url.mjs",
    guardVar: "SEVA_BACKUP_DB_URL",
    destructive: false,
    trigger: "scheduled",
    // No environment binding: a reviewer-gated environment would stall the nightly
    // schedule. The guard, not an approval prompt, is the control on the schedule.
    environment: "",
    guardStyle: "step",
    concurrencyGroup: "seva-backup",
  },
  {
    // Monthly destructive purge of devotee profiles. DELETEs rows.
    id: "seva-maintenance",
    file: "seva-maintenance.yml",
    kind: "purge",
    commands: ["bash scripts/seva/backup.sh"],
    rawCli: true,
    guard: "node scripts/lib/guard-approved-db-url.mjs",
    guardVar: "SEVA_BACKUP_DB_URL",
    destructive: true,
    trigger: "scheduled",
    environment: "",
    guardStyle: "step",
    concurrencyGroup: "seva-maintenance",
  },
];

/** The guard scripts the repository uses to verify a database destination. */
export const GUARD_COMMANDS = [
  "node scripts/lib/guard-approved-project.mjs",
  "node scripts/lib/guard-approved-supabase-url.mjs",
  "node scripts/lib/guard-approved-db-url.mjs",
  "node scripts/lib/guard-test-project.mjs",
];

/**
 * Read-only database connection paths.
 *
 * These do not mutate anything, so they are not "writers", but they still open a
 * production Postgres session and must therefore verify the destination first.
 * Kept separate from `DB_WRITER_INVENTORY` so the writer count stays meaningful.
 */
export const DB_CONNECTION_INVENTORY: WriterEntry[] = [
  {
    // Diffs prisma/schema.prisma against the live target. Read-only, but it opens
    // a real Postgres session (the reachability probe, then `prisma migrate diff`)
    // and accepts an operator-supplied URL override — previously with no
    // destination verification at all.
    id: "prisma-baseline-drift-gate",
    file: "prisma-baseline-drift-gate.yml",
    kind: "connect",
    commands: [
      "node scripts/lib/probe-pg-url.mjs",
      "node scripts/lib/dump-ai-catalog.mjs",
      "npm run prisma:drift:scoped",
      "npm run prisma:drift",
    ],
    rawCli: false,
    guard: "node scripts/lib/guard-approved-db-url.mjs",
    guardVar: "PRISMA_DATABASE_URL_CANDIDATE",
    destructive: false,
    trigger: "manual",
    environment: "",
    guardStyle: "step",
    concurrencyGroup: "",
  },
  {
    // Read-only connectivity diagnostic. It opens a Postgres session and probes
    // the REST and Auth layers, but verifies project identity first and skips
    // every probe when identity cannot be confirmed. The verification lives in
    // the script, which reuses the same approved-project library as the guard
    // scripts rather than duplicating the ref comparison.
    id: "diagnose-supabase-connectivity",
    file: "diagnose-supabase-connectivity.yml",
    kind: "connect",
    commands: ["npx tsx scripts/diagnose-supabase-connectivity.ts"],
    rawCli: false,
    guard: "scripts/lib/approved-project.mjs",
    guardVar: "SUPABASE_PROJECT_REF",
    destructive: false,
    trigger: "manual",
    environment: "",
    guardStyle: "in-script",
    concurrencyGroup: "",
  },
  {
    // Test-only migration verification. Runs `supabase migration list` and
    // `supabase db push --dry-run` against a dedicated TEST project: it links and
    // inspects, but never applies (no `db push`, no seed, no SQL write). It is
    // enumerated here because `supabase link`/`migration` are Postgres-connecting
    // commands; the destination guard refuses anything but an allow-listed test
    // project and always refuses the approved production project.
    id: "supabase-migrations-test",
    file: "supabase-migrations-test.yml",
    kind: "connect",
    commands: [
      "supabase link",
      "supabase migration list",
      "supabase db push",
    ],
    rawCli: false,
    guard: "node scripts/lib/guard-test-project.mjs",
    guardVar: "TEST_SUPABASE_PROJECT_REF",
    destructive: false,
    trigger: "manual",
    // No environment binding: this verifies a test project, and there is no
    // production credential in the file to gate.
    environment: "",
    guardStyle: "step",
    concurrencyGroup: "supabase-migrations-test",
  },
  {
    // F-A16 production catalog audit. Read-only: it executes a fixed SELECT/SHOW
    // catalog file inside an explicit `BEGIN READ ONLY` transaction with
    // `default_transaction_read_only=on` and a SELECT/WITH/SHOW allowlist in the
    // runner. It opens a Postgres session over the IPv4 session pooler (the direct
    // host is IPv6-only), so it verifies the destination before the first
    // connection, exactly like the Prisma drift gate. Output is encrypted before
    // upload because the repository is public.
    id: "f-a16-production-catalog-audit",
    file: "f-a16-production-catalog-audit.yml",
    kind: "connect",
    commands: [
      "node scripts/lib/probe-pg-url.mjs",
      "node scripts/lib/run-catalog-audit.mjs",
    ],
    rawCli: false,
    guard: "node scripts/lib/guard-approved-db-url.mjs",
    guardVar: "PRISMA_DATABASE_URL_CANDIDATE",
    destructive: false,
    trigger: "manual",
    environment: "f-a16-catalog-audit",
    guardStyle: "step",
    concurrencyGroup: "f-a16-catalog-audit",
  },
];

export function readWorkflow(file: string): string {
  return readFileSync(resolve(workflowsDir, file), "utf8");
}

/**
 * Statement shapes that reach a Postgres database through a CLI.
 *
 * Used by the completeness check as an inventory-independent detector: it must
 * find a workflow even when nobody remembered to add that workflow to the
 * inventory. Firestore paths are deliberately out of scope — they are tracked as
 * the separate scheduled-writer problem (backlog B-1), not as Postgres writers.
 */
export const POSTGRES_CLI_RE = new RegExp(
  `^${SUBST_PREFIX}${CMD_PREFIX}(?:` +
    [
      "psql|pg_dump|pg_restore",
      "supabase\\s+(?:link|db\\s+push|migration)",
      "npx\\s+prisma\\s+(?:migrate|db)",
      "prisma\\s+(?:migrate|db)",
      "node\\s+scripts\\/lib\\/(?:probe-pg-url|dump-ai-catalog)\\.mjs",
    ].join("|") +
    `)(?:\\s|$)`,
);

/**
 * Whether an npm script's value, when run, reaches a database.
 *
 * Two shapes are recognised, because both appear in this repository:
 *   - the value *is* a Postgres CLI command (`prisma migrate diff …`,
 *     `supabase db push`, `psql …`);
 *   - the value *invokes* a `scripts/…` file that opens a connection
 *     (`npx tsx scripts/migrate-core-to-supabase.ts`).
 *
 * Resolving the alias matters: `npm run migrate:core` is invisible to a scan for
 * literal `psql`/`prisma` text, so without this a workflow that switched from a
 * direct command to an npm alias would silently leave the inventory.
 */
function npmScriptValueReachesDatabase(value: string): boolean {
  const v = String(value ?? "").trim();
  if (!v) return false;
  if (/^(npx\s+)?(prisma|supabase|psql|pg_dump|pg_restore)\s/.test(v)) return true;
  return referencedScripts(v).some(scriptTouchesDatabase);
}

/**
 * Statements that reach Postgres through an npm script alias, resolved through
 * package.json (for example `npm run prisma:drift` -> `prisma migrate diff`).
 */
export function postgresCliStatements(
  body: string,
  scripts: Record<string, string>,
): string[] {
  const aliasTargets = Object.entries(scripts)
    .filter(([, value]) => npmScriptValueReachesDatabase(value))
    .map(([name]) => name);
  return shellStatements(body).filter((s) => {
    if (POSTGRES_CLI_RE.test(s)) return true;
    return aliasTargets.some((name) =>
      new RegExp(`^${SUBST_PREFIX}${CMD_PREFIX}npm\\s+run\\s+${escapeRegExp(name)}(?:\\s|$)`).test(s),
    );
  });
}

/**
 * Repository-relative `scripts/` paths referenced by a shell body.
 *
 * Deliberately narrow: only files that exist on disk are returned, so a path in a
 * comment or an echo cannot drive the check.
 */
export function referencedScripts(body: string): string[] {
  const out = new Set<string>();
  const SCRIPT_PATH = /(?:^|[\s"'(])(scripts\/[A-Za-z0-9_./-]+\.(?:ts|mjs|js|sh))/g;

  for (const m of body.matchAll(SCRIPT_PATH)) {
    out.add(m[1]);
  }

  // An npm alias is an indirection around the same script. A workflow that runs
  // `npm run generate:aaradhane` names no `scripts/…` path at all, so without
  // resolving the alias the writer would be invisible to the completeness check —
  // and the guard-ordering check never runs. Resolve every `npm run <name>` through
  // package.json and collect the scripts it reaches, so the alias cannot hide a
  // writer. Aliases that invoke another alias are followed to a bounded depth.
  const scripts = readPackageScripts();
  const seen = new Set<string>();
  const queue = [...body.matchAll(/npm\s+run\s+([A-Za-z0-9:_-]+)/g)].map((m) => m[1]);
  while (queue.length > 0) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const value = scripts[name];
    if (typeof value !== "string") continue;
    for (const m of value.matchAll(SCRIPT_PATH)) {
      out.add(m[1]);
    }
    for (const m of value.matchAll(/npm\s+run\s+([A-Za-z0-9:_-]+)/g)) queue.push(m[1]);
  }

  return [...out];
}

/**
 * Signals that a script opens a Postgres/Supabase connection or writes to one.
 *
 * Postgres-specific on purpose: a Firebase/Firestore-only script such as
 * `scripts/generate-aaradhane.ts` must not match, or the completeness check would
 * start reporting the (separately tracked) Firestore writers.
 */
const DB_SIGNALS = [
  /new\s+Client\s*\(/,
  /new\s+Pool\s*\(/,
  /from\s+["']pg["']/,
  /from\s+["']postgres["']/,
  /\bpg_dump\b/,
  /\bpsql\b/,
  /\bpg_restore\b/,
  /createAdminClient/,
  /@supabase\/supabase-js/,
  /\bsupabase\.from\(/,
  /\bprisma\b/,
  // The shared connection helper. A script that reaches Postgres only through
  // `resolveTargetConnection` would otherwise be invisible here; this is how the
  // ai_knowledge apply script connects.
  /target-connection\.mjs/,
  /resolveTargetConnection/,
];

/** Whether the script at `rel` (repo-relative) contains a Postgres signal. */
export function scriptTouchesDatabase(rel: string): boolean {
  // A guard verifies a destination; it never opens one. Excluding it keeps the
  // detector reporting "this workflow reaches a database" rather than "this
  // workflow mentions a database".
  if (/^scripts\/lib\/guard-approved-/.test(rel)) return false;
  let source: string;
  try {
    source = readFileSync(resolve(__dirname, "../..", rel), "utf8");
  } catch {
    return false;
  }
  return DB_SIGNALS.some((re) => re.test(source));
}

export function workflowFiles(): string[] {
  return readdirSync(workflowsDir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();
}

/**
 * The database-URL environment variable a raw client statement connects with.
 *
 * `psql "$SEVA_BACKUP_DB_URL" …` -> "SEVA_BACKUP_DB_URL". Returns "" when the
 * statement names no recognisable variable.
 */
export function dbUrlVarIn(statement: string): string {
  return new RegExp(`\\$\\{?(${DB_URL_VAR})\\}?`).exec(statement)?.[1] ?? "";
}

/**
 * Whether a step's `if:` can reduce how often the step runs.
 *
 * `always()`, `success()` and `!cancelled()` are *run-guaranteeing* for a guard:
 * they never cause the guard to be skipped while a later, default-condition
 * database step still runs. Anything else — a literal `false`, or a condition the
 * checker cannot evaluate such as `github.event_name == 'push'` or
 * `inputs.dry_run == false` — may be false at run time, which would skip the guard
 * while leaving the write in place. Those are reported rather than guessed about.
 */
export function guardIfMaySkip(ifExpr: string): boolean {
  const normalized = String(ifExpr ?? "")
    .replace(/\s+#.*$/, "")
    .replace(/^\$\{\{/, "")
    .replace(/\}\}$/, "")
    .trim();
  if (!normalized) return false;
  const guaranteeing = [
    "always()",
    "success()",
    "!cancelled()",
    "!failure()",
    "!cancelled() && !failure()",
    "!failure() && !cancelled()",
  ];
  return !guaranteeing.includes(normalized);
}

export interface OrderingViolation {
  job: string;
  message: string;
}

/**
 * Every way a job can run one of `commands` without having run `guardCommand`
 * first, inside the same job.
 *
 * Ordering compares (step index, statement index), not raw text offset, so a
 * guard that is present as text but disabled, `continue-on-error`, echoed rather
 * than executed, or moved after the command is reported. A write step whose `if:`
 * runs regardless of earlier failure must also name the guard's outcome, since
 * `always()` would otherwise bypass a failed guard.
 *
 * When `guardVar` is supplied, two further invariants are enforced:
 *
 *   - the guard step must be unconditional. Any `if:` on a destination guard is a
 *     potential bypass and there is no legitimate reason for one, so a conditional
 *     guard is reported rather than guessed about (a condition such as
 *     `github.event_name == 'push'` is never true for the dispatch/schedule events
 *     these workflows actually use, and no static check can evaluate it);
 *   - a raw `psql`/`pg_dump`/`pg_restore` statement must connect with the same
 *     variable the guard verified. A psql call reading a *different* secret than
 *     the guarded one is unverified even though a guard step ran earlier in the
 *     job.
 */
export function guardOrderingViolations(
  yaml: string,
  commands: string[],
  guardCommand: string,
  scripts: Record<string, string>,
  guardVar?: string,
): OrderingViolation[] {
  const jobs = parseWorkflow(yaml);
  const violations: OrderingViolation[] = [];

  for (const job of jobs) {
    let guardStep: Step | null = null;
    let guardStmt = -1;
    for (const step of job.steps) {
      const hits = commandStatements(step.runBody, guardCommand, scripts);
      if (hits.length > 0) {
        guardStep = step;
        guardStmt = hits[0];
        break;
      }
    }

    // A guard whose condition may be false at run time can be skipped while the
    // write below it still runs. Only run-guaranteeing conditions are accepted;
    // everything else (a literal `false`, or a condition such as
    // `github.event_name == 'push'` that no static check can evaluate) is reported.
    if (guardStep && guardIfMaySkip(guardStep.if)) {
      violations.push({
        job: job.name,
        message: `guard is conditional (if: ${guardStep.if}) and may be skipped`,
      });
    }

    // A guard invoked through a shell function can be shadowed. The verified
    // wrapper is defined once, then a later definition of the same name — whose
    // body need not mention the guard at all — replaces it. The guard command text
    // is still present and still ordered first, so every other check passes while
    // the guard no longer runs. Report any guard-wrapping function name that is
    // defined more than once in the job.
    const shellText = job.steps.map((s) => s.runBody).join("\n");
    const defRe = /(?:^|\n)[ \t]*([A-Za-z_][A-Za-z0-9_]*)[ \t]*\(\)[ \t]*\{/g;
    const defs: { name: string; start: number; bodyStart: number }[] = [];
    for (let m = defRe.exec(shellText); m; m = defRe.exec(shellText)) {
      defs.push({ name: m[1], start: m.index, bodyStart: m.index + m[0].length });
    }
    const defCounts = new Map<string, number>();
    const guardWrapperNames = new Set<string>();
    defs.forEach((def, i) => {
      defCounts.set(def.name, (defCounts.get(def.name) ?? 0) + 1);
      const end = i + 1 < defs.length ? defs[i + 1].start : shellText.length;
      if (shellText.slice(def.bodyStart, end).includes(guardCommand)) {
        guardWrapperNames.add(def.name);
      }
    });
    for (const name of guardWrapperNames) {
      const count = defCounts.get(name) ?? 0;
      if (count > 1) {
        violations.push({
          job: job.name,
          message: `guard wrapper "${name}" is defined ${count} times; a later definition shadows the verified guard`,
        });
      }
    }

    // Raw client statements are writers in their own right, and may read a
    // different credential than the guarded one.
    if (guardVar) {
      for (const step of job.steps) {
        for (const statement of rawDbClientStatements(step.runBody)) {
          const used = dbUrlVarIn(statement);
          if (used && used !== guardVar) {
            violations.push({
              job: job.name,
              message:
                `raw database command in step "${step.name}" connects with ${used}, ` +
                `but the guard verified ${guardVar}`,
            });
          }
        }
      }
    }

    for (const command of commands) {
      let writeStep: Step | null = null;
      let writeStmt = -1;
      for (const step of job.steps) {
        const hits = commandStatements(step.runBody, command, scripts);
        if (hits.length > 0) {
          writeStep = step;
          writeStmt = hits[0];
          break;
        }
      }
      if (!writeStep) continue;

      if (!guardStep) {
        violations.push({ job: job.name, message: `runs "${command}" with no guard step` });
        continue;
      }
      const afterGuard =
        guardStep.index < writeStep.index ||
        (guardStep.index === writeStep.index && guardStmt < writeStmt);
      if (!afterGuard) {
        violations.push({
          job: job.name,
          message: `"${command}" (step ${writeStep.index}) does not run after the guard (step ${guardStep.index})`,
        });
        continue;
      }
      if (stepIsDisabled(guardStep)) {
        violations.push({ job: job.name, message: `guard is disabled by if: ${guardStep.if}` });
      }
      if (guardStep.continueOnError) {
        violations.push({
          job: job.name,
          message: "guard is continue-on-error, so it cannot fail the job",
        });
      }
      // `always()` / `failure()` / `cancelled()` on a write step override the
      // default "only when every earlier step succeeded" rule, so a failed guard
      // would not stop the write. The step must then depend on the guard's outcome,
      // which requires the guard to have an id.
      if (runsRegardlessOfEarlierFailure(writeStep)) {
        if (guardStep.id === "") {
          violations.push({
            job: job.name,
            message:
              `"${command}" runs regardless of earlier failure (if: ${writeStep.if}) but the guard ` +
              "step has no id, so the write cannot depend on its outcome",
          });
        } else if (!writeStep.if.includes(`steps.${guardStep.id}.outcome`)) {
          violations.push({
            job: job.name,
            message:
              `"${command}" runs regardless of earlier failure (if: ${writeStep.if}) but does not ` +
              `depend on steps.${guardStep.id}.outcome, so it would run even when the guard refused`,
          });
        }
      }
    }
  }
  return violations;
}
