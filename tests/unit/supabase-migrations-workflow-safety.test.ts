/**
 * @jest-environment node
 *
 * Safety suite for the redesigned production migration workflow
 * (`.github/workflows/supabase-migrations.yml`) and its pending-migration parser
 * and reviewed allowlist (`scripts/lib/pending-migrations.mjs`,
 * `scripts/lib/check-pending-migrations.mjs`).
 *
 * The workflow may only apply migrations through an explicit, reviewed, confirmed
 * `apply` mode:
 *
 *   - the default mode is `dry-run`, which never executes the apply command;
 *   - `apply` requires the exact confirmation phrase `apply-supabase-migrations`;
 *   - the apply command lives in one step gated on `if: ${{ inputs.mode == 'apply' }}`;
 *   - the project-ref guard runs before any database-changing command;
 *   - the pending set is parsed from the dry-run bullet section (never the
 *     box-drawn `migration list` output) and checked against an allowlist, so an
 *     unapproved or unexpected pending migration fails the run before the apply.
 *
 * Everything here reads files or spawns scripts that touch nothing: no database,
 * no network, no GitHub API, no workflow dispatch. The parser is exercised against
 * a *captured* CLI 1.200.0 dry-run output, not a live command.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  commandStatements,
  guardOrderingViolations,
  parseWorkflow,
  readPackageScripts,
} from "./workflow-writer-inventory";

const root = resolve(__dirname, "../..");
const workflowPath = resolve(root, ".github/workflows/supabase-migrations.yml");
const parserLib = resolve(root, "scripts/lib/pending-migrations.mjs");
const checker = resolve(root, "scripts/lib/check-pending-migrations.mjs");
const migrationsDir = resolve(root, "supabase/migrations");

const workflow = readFileSync(workflowPath, "utf8");
const scripts = readPackageScripts();

const APPLY_COMMAND = "supabase db push --include-all";
const DRY_RUN_COMMAND = "supabase db push --dry-run --include-all";
const GUARD_COMMAND = "node scripts/lib/guard-approved-project.mjs";
const CONFIRM_PHRASE = "apply-supabase-migrations";

const steps = () => parseWorkflow(workflow).flatMap((j) => j.steps);

/**
 * Captured output of `supabase db push --dry-run --include-all` on the pinned CLI
 * 1.200.0, for a database with four pending migrations. The bullet format is fixed
 * by the CLI's `confirmPushAll` (`fmt.Sprintf(" • %s\n", filename)`), preceded by
 * the `Would push these migrations:` header. This is a static fixture: no CLI is
 * invoked and nothing is contacted.
 */
const CAPTURED_DRY_RUN_OUTPUT = [
  "DRY RUN: migrations will *not* be pushed to the database.",
  "Would push these migrations:",
  " • 20261109000000_create_members_table.sql",
  " • 20261109000001_create_volunteers_table.sql",
  " • 20261116000000_add_auth_user_id_to_staff.sql",
  " • 20261201000000_add_is_approved_to_users.sql",
  "Finished supabase db push.",
].join("\n");

/** Evaluate an expression against the parser module in a real node process. */
function evalParser(expr: string): unknown {
  const url = pathToFileURL(parserLib).href;
  const r = spawnSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `import * as m from ${JSON.stringify(url)}; process.stdout.write(JSON.stringify(${expr}))`,
    ],
    { cwd: root, encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`parser eval failed: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

/** Run the allowlist checker against a dry-run output string. */
function runChecker(
  output: string,
  extraEnv: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), "pending-check-"));
  try {
    const outFile = join(dir, "dry-run.txt");
    writeFileSync(outFile, output);
    const r = spawnSync("node", [checker], {
      cwd: root,
      env: {
        ...process.env,
        DRY_RUN_OUTPUT_FILE: outFile,
        GITHUB_OUTPUT: join(dir, "github-output.txt"),
        ...extraEnv,
      },
      encoding: "utf8",
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readMigration(name: string): string {
  return readFileSync(join(migrationsDir, name), "utf8");
}

function executableSql(sql: string): string {
  return sql.replace(/^\s*--.*$/gm, "");
}

// --- (a) Obsolete marker migrations remain no-op ------------------------------

describe("(a) obsolete members/volunteers marker migrations are no-op", () => {
  const markers = [
    "20261109000000_create_members_table.sql",
    "20261109000001_create_volunteers_table.sql",
  ];

  it.each(markers)("%s keeps its version prefix and executes nothing", (name) => {
    const sql = readMigration(name);
    expect(sql).toMatch(/^--\s*Migration:\s*\S+/);
    expect(executableSql(sql)).not.toMatch(
      /\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|TRUNCATE)\b/i,
    );
  });

  it("the markers are on the allowlist (they are safe no-ops)", () => {
    const approved = evalParser("m.APPROVED_PENDING_MIGRATIONS") as string[];
    expect(approved).toContain("20261109000000");
    expect(approved).toContain("20261109000001");
  });
});

// --- (b) Fresh-DB migration ordering remains safe -----------------------------

describe("(b) fresh-database migration ordering is safe", () => {
  const AUTHORITATIVE = "20261110000000_fresh_supabase_native_content.sql";

  it("the authoritative creator is the only declarer of members and volunteers", () => {
    const sql = readMigration(AUTHORITATIVE);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS[\s\S]*\bmembers\b/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS[\s\S]*\bvolunteers\b/i);
    for (const marker of [
      "20261109000000_create_members_table.sql",
      "20261109000001_create_volunteers_table.sql",
    ]) {
      expect(executableSql(readMigration(marker))).not.toMatch(/CREATE\s+TABLE/i);
    }
  });

  it("the obsolete markers sort before the authoritative creator", () => {
    const ordered = [
      "20261109000000_create_members_table.sql",
      "20261109000001_create_volunteers_table.sql",
      AUTHORITATIVE,
    ].sort();
    expect(ordered.indexOf(AUTHORITATIVE)).toBe(2);
  });
});

// --- (c) Workflow default mode is dry-run -------------------------------------

describe("(c) the workflow defaults to dry-run", () => {
  it("declares a `mode` choice input defaulting to dry-run with both options", () => {
    expect(workflow).toMatch(/mode:/);
    expect(workflow).toMatch(/type:\s*choice/);
    expect(workflow).toMatch(/- dry-run/);
    expect(workflow).toMatch(/- apply/);
    expect(workflow).toMatch(/default:\s*dry-run/);
  });

  it("declares an optional `confirm` string input", () => {
    expect(workflow).toMatch(/confirm:/);
    // `required: false` (not true) so a dry-run dispatch needs no phrase.
    expect(workflow).toMatch(/confirm:[\s\S]{0,200}?required:\s*false/);
  });

  it("is dispatch-only and never runs on push or a schedule", () => {
    expect(workflow).toMatch(/workflow_dispatch/);
    expect(workflow).not.toMatch(/^\s{2}push:/m);
    expect(workflow).not.toMatch(/^\s{2}schedule:/m);
  });
});

// --- (d) The apply command is present exactly once ----------------------------

describe("(d) the apply command appears exactly once", () => {
  it("occurs in exactly one step, and only there", () => {
    const hits = steps().flatMap((s) =>
      commandStatements(s.runBody, APPLY_COMMAND, scripts).map(() => s.name),
    );
    expect(hits).toHaveLength(1);
  });

  it("the dry-run command is a distinct command, not the apply command", () => {
    const dryRunHits = steps().flatMap((s) =>
      commandStatements(s.runBody, DRY_RUN_COMMAND, scripts).map(() => s.name),
    );
    expect(dryRunHits).toHaveLength(1);
    // The apply pattern must not match the dry-run invocation.
    const dryRunStep = steps().find((s) => s.runBody.includes(DRY_RUN_COMMAND))!;
    expect(commandStatements(dryRunStep.runBody, APPLY_COMMAND, scripts)).toHaveLength(0);
  });
});

// --- (e) The apply command is behind the apply-mode gate ----------------------

describe("(e) the apply command is behind `if: ${{ inputs.mode == 'apply' }}`", () => {
  it("the step running the apply command carries the apply-mode condition", () => {
    const applySteps = steps().filter(
      (s) => commandStatements(s.runBody, APPLY_COMMAND, scripts).length > 0,
    );
    expect(applySteps).toHaveLength(1);
    expect(applySteps[0].if).toContain("inputs.mode == 'apply'");
  });

  it("post-apply verification is gated on apply mode too", () => {
    const verify = steps().find((s) => s.name === "Verify Supabase migrations");
    expect(verify).toBeDefined();
    expect(verify!.if).toContain("inputs.mode == 'apply'");
  });
});

// --- (f) The confirmation phrase is required for apply ------------------------

describe("(f) apply additionally requires the exact confirmation phrase", () => {
  it("compares the phrase through a quoted environment variable", () => {
    expect(workflow).toMatch(/CONFIRM_PHRASE:\s*\$\{\{\s*inputs\.confirm\s*\}\}/);
    expect(workflow).toMatch(
      new RegExp(`if \\[\\[ "\\$CONFIRM_PHRASE" != "${CONFIRM_PHRASE}" \\]\\]; then`),
    );
  });

  it("the confirmation step is itself gated on apply mode", () => {
    const confirm = steps().find((s) => s.name === "Check confirmation phrase");
    expect(confirm).toBeDefined();
    expect(confirm!.if).toContain("inputs.mode == 'apply'");
  });

  it("never interpolates untrusted inputs into a run: block", () => {
    for (const step of steps()) {
      expect(step.runBody).not.toMatch(/\$\{\{\s*inputs\./);
      expect(step.runBody).not.toMatch(/\$\{\{\s*github\.event\.inputs\./);
    }
  });

  it("behaviorally rejects a missing/incorrect phrase and accepts the exact one", () => {
    const confirm = steps().find((s) => s.name === "Check confirmation phrase")!;
    const run = (value: string) =>
      spawnSync("bash", ["-c", confirm.runBody], {
        cwd: root,
        env: { ...process.env, CONFIRM_PHRASE: value },
        encoding: "utf8",
      }).status;
    expect(run("")).not.toBe(0);
    expect(run("apply")).not.toBe(0);
    expect(run("APPLY-SUPABASE-MIGRATIONS")).not.toBe(0);
    expect(run(` ${CONFIRM_PHRASE}`)).not.toBe(0);
    expect(run("$(echo apply-supabase-migrations)")).not.toBe(0);
    expect(run(CONFIRM_PHRASE)).toBe(0);
  });
});

// --- (g) Project-ref guard runs before any DB-changing command ----------------

describe("(g) the project-ref guard runs before any database-changing command", () => {
  it("has no guard-ordering violations", () => {
    const violations = guardOrderingViolations(
      workflow,
      ["supabase link", "supabase db push"],
      GUARD_COMMAND,
      scripts,
    );
    expect(violations).toEqual([]);
  });

  it("really contains the guard and the database commands (non-vacuity)", () => {
    for (const command of [GUARD_COMMAND, "supabase link", "supabase db push"]) {
      const found = steps().some(
        (s) => commandStatements(s.runBody, command, scripts).length > 0,
      );
      expect(`${command}:${found}`).toBe(`${command}:true`);
    }
  });

  it("keeps the project-ref guard before the dry-run and apply steps by step order", () => {
    const ordered = steps();
    const guard = ordered.findIndex(
      (s) => commandStatements(s.runBody, GUARD_COMMAND, scripts).length > 0,
    );
    const dryRun = ordered.findIndex(
      (s) => commandStatements(s.runBody, DRY_RUN_COMMAND, scripts).length > 0,
    );
    const apply = ordered.findIndex(
      (s) => commandStatements(s.runBody, APPLY_COMMAND, scripts).length > 0,
    );
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(dryRun);
    expect(guard).toBeLessThan(apply);
  });
});

// --- (h) The dry-run pending parser parses real CLI output --------------------

describe("(h) the pending parser reads the dry-run bullet section", () => {
  it("extracts exactly the four known pending versions from captured CLI output", () => {
    const versions = evalParser(
      `m.parsePendingVersions(${JSON.stringify(CAPTURED_DRY_RUN_OUTPUT)})`,
    );
    expect(versions).toEqual([
      "20261109000000",
      "20261109000001",
      "20261116000000",
      "20261201000000",
    ]);
  });

  it("reports the header as seen for captured output", () => {
    const parsed = evalParser(
      `m.parsePendingOutput(${JSON.stringify(CAPTURED_DRY_RUN_OUTPUT)})`,
    ) as { status: string; headerSeen: boolean; versions: string[] };
    expect(parsed.status).toBe("pending");
    expect(parsed.headerSeen).toBe(true);
    expect(parsed.versions).toHaveLength(4);
  });

  it("tolerates ANSI bold escapes the CLI emits on a colour TTY", () => {
    const ansi = `Would push these migrations:\n \u001b[1m• 20261116000000_add_auth_user_id_to_staff.sql\u001b[0m\nFinished supabase db push.\n`;
    expect(evalParser(`m.parsePendingVersions(${JSON.stringify(ansi)})`)).toEqual([
      "20261116000000",
    ]);
  });

  it("recognizes the CLI's explicit up-to-date line as `up-to-date`", () => {
    const upToDate = "DRY RUN: migrations will *not* be pushed to the database.\nRemote database is up to date.";
    const parsed = evalParser(`m.parsePendingOutput(${JSON.stringify(upToDate)})`) as {
      status: string;
      headerSeen: boolean;
      upToDateSeen: boolean;
      versions: string[];
    };
    expect(parsed.status).toBe("up-to-date");
    expect(parsed.upToDateSeen).toBe(true);
    expect(parsed.headerSeen).toBe(false);
    expect(parsed.versions).toEqual([]);
  });

  it("does not parse the box-drawn `migration list` table", () => {
    // The previous parser grepped the box-drawn `supabase migration list` output,
    // whose format is human-facing and unstable. These box lines must yield nothing.
    const boxDrawn = [
      "        LOCAL      │     REMOTE     │     TIME (UTC)",
      "  ─────────────────┼────────────────┼──────────────────────",
      "   20261109000000  │                │ 2026-11-09 00:00:00",
      "   20261116000000  │                │ 2026-11-16 00:00:00",
    ].join("\n");
    expect(evalParser(`m.parsePendingVersions(${JSON.stringify(boxDrawn)})`)).toEqual([]);
  });

  it("does not rely on fixed line numbers", () => {
    const shifted = `\n\n${CAPTURED_DRY_RUN_OUTPUT}`;
    expect(evalParser(`m.parsePendingVersions(${JSON.stringify(shifted)})`)).toHaveLength(4);
  });

  it("the parser contains no live-command or network call", () => {
    const src = readFileSync(parserLib, "utf8");
    expect(src).not.toMatch(/child_process|execSync|spawnSync|fetch\(|https?:\/\//);
    // It reads the dry-run output only through the captured string argument.
    expect(src).not.toMatch(/process\.argv|readFileSync/);
  });
});

// --- (i) An unexpected migration fails closed ---------------------------------

describe("(i) an unexpected/unapproved migration fails closed", () => {
  it("the checker exits non-zero when the withheld migration is pending", () => {
    const r = runChecker(CAPTURED_DRY_RUN_OUTPUT);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/unapproved pending migration/i);
    expect(r.stderr).toMatch(/20261201000000/);
  });

  it("exits zero when only approved migrations are pending", () => {
    const approvedOnly = [
      "Would push these migrations:",
      " • 20261109000000_create_members_table.sql",
      " • 20261109000001_create_volunteers_table.sql",
      " • 20261116000000_add_auth_user_id_to_staff.sql",
      "Finished supabase db push.",
    ].join("\n");
    const r = runChecker(approvedOnly);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/on the reviewed allowlist/);
  });

  it("exits non-zero for a wholly unknown version", () => {
    const unknown = [
      "Would push these migrations:",
      " • 20270101000000_something_new.sql",
      "Finished supabase db push.",
    ].join("\n");
    const r = runChecker(unknown);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Unexpected \/ unreviewed: 20270101000000/);
  });

  it("fails closed when the CLI printed a header but no bullets parsed (format drift)", () => {
    const drift = "Would push these migrations:\n (unparseable)\n";
    const r = runChecker(drift);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/no migration bullets parsed/i);
  });

  it("fails closed when the dry-run output file is missing", () => {
    const r = spawnSync("node", [checker], {
      cwd: root,
      env: { ...process.env, DRY_RUN_OUTPUT_FILE: "/nonexistent/path/dry-run.txt" },
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/could not read the dry-run output/i);
  });
});

// --- (l) Fail-closed recognition of the dry-run output ------------------------

describe("(l) the parser and checker fail closed on unrecognized output", () => {
  const parse = (output: string) =>
    evalParser(`m.parsePendingOutput(${JSON.stringify(output)})`) as {
      status: string;
      versions: string[];
      headerSeen: boolean;
      upToDateSeen: boolean;
      malformedBulletLines: string[];
      reason: string | null;
    };

  it("classifies empty output as unrecognized", () => {
    expect(parse("").status).toBe("unrecognized");
    expect(parse("\n\n").status).toBe("unrecognized");
  });

  it("classifies arbitrary text as unrecognized", () => {
    expect(parse("hello world\nsome unrelated log lines\n").status).toBe("unrecognized");
    expect(parse("fatal: not a git repository").status).toBe("unrecognized");
  });

  it("classifies the dry-run banner alone as unrecognized", () => {
    const banner = "DRY RUN: migrations will *not* be pushed to the database.";
    const parsed = parse(banner);
    expect(parsed.status).toBe("unrecognized");
    expect(parsed.upToDateSeen).toBe(false);
  });

  it("classifies truncated output as unrecognized", () => {
    // A section cut off mid-header, and a header with no bullets yet.
    expect(parse("Would push these migr").status).toBe("unrecognized");
    expect(parse("Would push these migrations:").status).toBe("unrecognized");
  });

  it("classifies an altered/missing pending header as unrecognized", () => {
    const altered = [
      "Would push these migrations", // trailing colon removed
      " • 20261116000000_add_auth_user_id_to_staff.sql",
    ].join("\n");
    expect(parse(altered).status).toBe("unrecognized");

    const missing = " • 20261116000000_add_auth_user_id_to_staff.sql";
    expect(parse(missing).status).toBe("unrecognized");
  });

  it("classifies a pending header with zero parsed bullets as unrecognized", () => {
    const parsed = parse("Would push these migrations:\n (unparseable)\n");
    expect(parsed.status).toBe("unrecognized");
    expect(parsed.headerSeen).toBe(true);
    expect(parsed.versions).toEqual([]);
  });

  it("classifies malformed bullet lines as unrecognized and reports them", () => {
    const malformed = [
      "Would push these migrations:",
      " • 20261116000000_add_auth_user_id_to_staff.sql",
      " • 20261201000000_add_is_approved_to_users", // missing .sql
    ].join("\n");
    const parsed = parse(malformed);
    expect(parsed.status).toBe("unrecognized");
    expect(parsed.malformedBulletLines).toHaveLength(1);
    expect(parsed.malformedBulletLines[0]).toContain("20261201000000");
  });

  it("recognizes a valid explicit up-to-date output", () => {
    const upToDate =
      "DRY RUN: migrations will *not* be pushed to the database.\nRemote database is up to date.";
    expect(parse(upToDate).status).toBe("up-to-date");
    // The exact single line is enough on its own.
    expect(parse("Remote database is up to date.").status).toBe("up-to-date");
  });

  it("recognizes a valid pending output with approved versions", () => {
    const approvedOnly = [
      "Would push these migrations:",
      " • 20261109000000_create_members_table.sql",
      " • 20261109000001_create_volunteers_table.sql",
      " • 20261116000000_add_auth_user_id_to_staff.sql",
      "Finished supabase db push.",
    ].join("\n");
    const parsed = parse(approvedOnly);
    expect(parsed.status).toBe("pending");
    expect(parsed.versions).toHaveLength(3);
  });

  // --- checker exit codes ---

  it("the checker exits non-zero for empty output", () => {
    const r = runChecker("");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/not recognized|unrecognized/i);
  });

  it("the checker exits non-zero for arbitrary text", () => {
    const r = runChecker("nothing to see here\n");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/unrecognized|not recognized/i);
  });

  it("the checker exits non-zero for banner-only output", () => {
    const r = runChecker("DRY RUN: migrations will *not* be pushed to the database.\n");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/unrecognized|not recognized/i);
  });

  it("the checker exits non-zero for truncated output", () => {
    expect(runChecker("Would push these migrations:\n").status).toBe(1);
    expect(runChecker("Would push these migr").status).toBe(1);
  });

  it("the checker exits non-zero for an altered/missing header", () => {
    expect(runChecker("Would push these migrations\n • 20261116000000_x.sql\n").status).toBe(1);
    expect(runChecker(" • 20261116000000_x.sql\n").status).toBe(1);
  });

  it("the checker exits non-zero for malformed bullet lines", () => {
    const malformed = [
      "Would push these migrations:",
      " • 20261109000000_create_members_table.sql",
      " • 20261116000000_add_auth_user_id_to_staff", // missing .sql
    ].join("\n");
    const r = runChecker(malformed);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/malformed/i);
  });

  it("the checker exits zero for valid explicit up-to-date output", () => {
    const r = runChecker("Remote database is up to date.\n");
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/up to date/i);
  });

  it("the checker exits zero for a valid pending section with approved versions", () => {
    const approvedOnly = [
      "Would push these migrations:",
      " • 20261109000000_create_members_table.sql",
      " • 20261109000001_create_volunteers_table.sql",
      " • 20261116000000_add_auth_user_id_to_staff.sql",
      "Finished supabase db push.",
    ].join("\n");
    expect(runChecker(approvedOnly).status).toBe(0);
  });

  it("the checker exits non-zero for a withheld pending migration", () => {
    const withheld = [
      "Would push these migrations:",
      " • 20261116000000_add_auth_user_id_to_staff.sql",
      " • 20261201000000_add_is_approved_to_users.sql",
      "Finished supabase db push.",
    ].join("\n");
    const r = runChecker(withheld);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/20261201000000/);
    expect(r.stderr).toMatch(/awaiting production catalog verification/i);
  });

  it("the checker exits non-zero for an unknown pending migration", () => {
    const unknown = [
      "Would push these migrations:",
      " • 20270101000000_something_new.sql",
      "Finished supabase db push.",
    ].join("\n");
    const r = runChecker(unknown);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Unexpected \/ unreviewed: 20270101000000/);
  });

  it("publishes the parse status to $GITHUB_OUTPUT", () => {
    const dir = mkdtempSync(join(tmpdir(), "pending-status-"));
    try {
      const outFile = join(dir, "dry-run.txt");
      const ghFile = join(dir, "github-output.txt");
      writeFileSync(outFile, "Remote database is up to date.\n");
      const r = spawnSync("node", [checker], {
        cwd: root,
        env: { ...process.env, DRY_RUN_OUTPUT_FILE: outFile, GITHUB_OUTPUT: ghFile },
        encoding: "utf8",
      });
      expect(r.status).toBe(0);
      expect(readFileSync(ghFile, "utf8")).toMatch(/^status=up-to-date$/m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("never infers up-to-date from the absence of the header", () => {
    // Regression guard for the exact bug: a header-less, non-empty output that is not
    // the explicit up-to-date line must NOT be treated as "nothing to do".
    for (const output of ["", "some log output", "DRY RUN: migrations will *not* be pushed to the database."]) {
      expect(parse(output).status).not.toBe("up-to-date");
      expect(runChecker(output).status).toBe(1);
    }
  });
});

// --- (m) A pending result requires the CLI completion line --------------------

describe("(m) a pending result requires the CLI completion line", () => {
  const parse = (output: string) =>
    evalParser(`m.parsePendingOutput(${JSON.stringify(output)})`) as {
      status: string;
      versions: string[];
      finishedSeen: boolean;
      unexpectedTerminator: string | null;
      reason: string | null;
    };

  const BULLETS = [
    "Would push these migrations:",
    " • 20261109000000_create_members_table.sql",
    " • 20261116000000_add_auth_user_id_to_staff.sql",
  ].join("\n");

  it("exposes the FINISHED_MESSAGE constant", () => {
    expect(evalParser("m.FINISHED_MESSAGE")).toBe("Finished supabase db push.");
  });

  it("valid pending output + completion line is `pending`", () => {
    const parsed = parse(`${BULLETS}\nFinished supabase db push.`);
    expect(parsed.status).toBe("pending");
    expect(parsed.versions).toEqual(["20261109000000", "20261116000000"]);
    expect(parsed.finishedSeen).toBe(true);
    expect(parsed.unexpectedTerminator).toBeNull();
  });

  it("valid pending output WITHOUT the completion line is `unrecognized`", () => {
    const parsed = parse(BULLETS);
    expect(parsed.status).toBe("unrecognized");
    expect(parsed.finishedSeen).toBe(false);
    expect(parsed.reason).toMatch(/completion line/i);
  });

  it("valid pending output + an unexpected terminator is `unrecognized`", () => {
    const parsed = parse(`${BULLETS}\nError: connection reset by peer`);
    expect(parsed.status).toBe("unrecognized");
    expect(parsed.finishedSeen).toBe(false);
    expect(parsed.unexpectedTerminator).toBe("Error: connection reset by peer");
    expect(parsed.reason).toMatch(/unexpected line/i);
  });

  it("truncated output after the bullets is `unrecognized`", () => {
    // The completion line cut off mid-way.
    const parsed = parse(`${BULLETS}\nFinished supabase db pu`);
    expect(parsed.status).toBe("unrecognized");
    expect(parsed.finishedSeen).toBe(false);
  });

  it("does not treat parsed bullets alone as a successful run", () => {
    // Regression guard: a run that printed bullets but never completed must fail.
    const parsed = parse(BULLETS);
    expect(parsed.status).not.toBe("pending");
    expect(parsed.versions).toEqual([]);
  });

  it("the checker exits zero only when the completion line is present", () => {
    expect(runChecker(`${BULLETS}\nFinished supabase db push.`).status).toBe(0);
    expect(runChecker(BULLETS).status).toBe(1);
    expect(runChecker(`${BULLETS}\nError: boom`).status).toBe(1);
    expect(runChecker(`${BULLETS}\nFinished supabase db pu`).status).toBe(1);
  });

  it("the checker reports an unrecognized status for a missing completion line", () => {
    const r = runChecker(BULLETS);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/unrecognized|not recognized/i);
    expect(r.stderr).toMatch(/completion line/i);
  });
});

// --- (j) Allowlist integrity --------------------------------------------------

describe("(j) the reviewed allowlist is explicit and intact", () => {
  const approved = evalParser("m.APPROVED_PENDING_MIGRATIONS") as string[];
  const withheld = evalParser("m.AWAITING_VERIFICATION") as string[];

  it("approves exactly the three reviewed migrations", () => {
    expect(approved).toEqual([
      "20261109000000",
      "20261109000001",
      "20261116000000",
    ]);
  });

  it("withholds the users.is_approved migration pending catalog verification", () => {
    expect(withheld).toContain("20261201000000");
    // It must NOT be approved: production catalog verification is still outstanding.
    expect(approved).not.toContain("20261201000000");
  });

  it("is frozen so it cannot be mutated at run time", () => {
    expect(() => evalParser("(m.APPROVED_PENDING_MIGRATIONS.push('x'), 'ok')")).toThrow();
  });

  it("approves only versions that exist as migration files", () => {
    const files = readdirSync(migrationsDir);
    for (const version of approved) {
      const present = files.some((f) => f.startsWith(`${version}_`) && f.endsWith(".sql"));
      expect(`${version}:${present}`).toBe(`${version}:true`);
    }
  });
});

// --- (k) The dry-run path cannot execute the apply command --------------------

describe("(k) a dry-run cannot reach the apply command", () => {
  it("every step that runs the apply command is gated on apply mode", () => {
    const applySteps = steps().filter(
      (s) => commandStatements(s.runBody, APPLY_COMMAND, scripts).length > 0,
    );
    expect(applySteps.length).toBeGreaterThan(0);
    for (const step of applySteps) {
      expect(step.if).toContain("inputs.mode == 'apply'");
    }
  });

  it("the dry-run step body never contains the apply command", () => {
    const dryRunStep = steps().find(
      (s) => commandStatements(s.runBody, DRY_RUN_COMMAND, scripts).length > 0,
    );
    expect(dryRunStep).toBeDefined();
    expect(dryRunStep!.runBody).not.toContain(APPLY_COMMAND);
    // And it is not gated on apply mode: it runs in both modes.
    expect(dryRunStep!.if).not.toContain("inputs.mode == 'apply'");
  });

  it("no non-apply step is enabled when the mode is not apply", () => {
    // Evaluate the gate the way GitHub would: `inputs.mode == 'apply'` is false for
    // a dry-run, so a step carrying that condition never runs.
    const isEnabled = (ifExpr: string, mode: string) => {
      if (!ifExpr) return true;
      if (ifExpr.includes("inputs.mode == 'apply'")) return mode === "apply";
      return true;
    };
    const applyRuns = steps()
      .filter((s) => commandStatements(s.runBody, APPLY_COMMAND, scripts).length > 0)
      .some((s) => isEnabled(s.if, "dry-run"));
    expect(applyRuns).toBe(false);
  });

  it("documents the two modes and the confirmation requirement", () => {
    expect(workflow).toMatch(/dry-run/i);
    expect(workflow).toMatch(/apply/i);
    expect(workflow).toContain(CONFIRM_PHRASE);
    expect(workflow).toMatch(/allowlist/i);
    expect(workflow).toMatch(/project-ref guard/i);
    expect(workflow).toMatch(/no automatic production migration path/i);
  });
});
