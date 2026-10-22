/**
 * @jest-environment node
 *
 * Workflow-completeness guard for every database writer in the repository.
 *
 * The migration-readiness audit found that the repo-wide writer check in
 * `supabase-diagnostics-migration-safety.test.ts` enumerated only *migration*
 * writers, so two classes of database path were invisible to it:
 *
 *   1. the raw `psql` writers (`seva-backup.yml`, `seva-maintenance.yml`), and
 *   2. the read-only-but-connected Prisma drift gate, which accepted an
 *      operator-supplied connection string with no destination verification.
 *
 * This suite enumerates all seven database-writing jobs plus the connection path
 * explicitly, so removing one from the inventory — or removing its guard — fails
 * here. Everything is file- and process-based: no database, no network, no
 * dispatch.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DB_CONNECTION_INVENTORY,
  DB_WRITER_INVENTORY,
  GUARD_COMMANDS,
  commandStatements,
  guardOrderingViolations,
  parseWorkflow,
  postgresCliStatements,
  rawDbClientStatements,
  readPackageScripts,
  readWorkflow,
  referencedScripts,
  scriptTouchesDatabase,
  stepIsDisabled,
  workflowFiles,
} from "./workflow-writer-inventory";

const scripts = readPackageScripts();

const ALL_INVENTORY = [...DB_WRITER_INVENTORY, ...DB_CONNECTION_INVENTORY];

describe("database-writer inventory", () => {
  it("enumerates exactly the seven database-writing jobs", () => {
    // A fixed count is the point: adding an eighth writer means consciously
    // extending this list (and its guard), not silently widening the surface.
    expect(DB_WRITER_INVENTORY).toHaveLength(7);
    expect(DB_WRITER_INVENTORY.map((w) => w.id).sort()).toEqual([
      "ai-knowledge-migration-apply",
      "firestore-batched-migration",
      "firestore-staged-migration",
      "resolve-raya-ai-baseline",
      "seva-backup",
      "seva-maintenance",
      "supabase-migrations",
    ]);
  });

  it("uses only guard scripts that exist and are shared, not re-implemented", () => {
    for (const entry of ALL_INVENTORY) {
      if (entry.guardStyle !== "step") continue;
      expect(`${entry.id}:${GUARD_COMMANDS.includes(entry.guard)}`).toBe(`${entry.id}:true`);
    }
    // Three distinct shared guards, one per credential shape (project ref, API
    // URL, raw database URL), plus the in-script identity check that reuses the
    // same approved-project library. No guard is re-implemented per workflow.
    const stepGuards = ALL_INVENTORY.filter((w) => w.guardStyle === "step").map((w) => w.guard);
    expect(new Set(stepGuards).size).toBe(3);
    expect(stepGuards.every((g) => GUARD_COMMANDS.includes(g))).toBe(true);
  });

  it("keeps backup, migration and maintenance responsibilities separate", () => {
    const byId = new Map(DB_WRITER_INVENTORY.map((w) => [w.id, w]));
    expect(byId.get("seva-backup")?.kind).toBe("backup");
    expect(byId.get("seva-maintenance")?.kind).toBe("purge");
    for (const id of [
      "supabase-migrations",
      "ai-knowledge-migration-apply",
      "firestore-batched-migration",
      "firestore-staged-migration",
    ]) {
      expect(byId.get(id)?.kind).toBe("migration");
    }
    // Only the purge is destructive; nothing else may be marked so.
    expect(DB_WRITER_INVENTORY.filter((w) => w.destructive).map((w) => w.id)).toEqual([
      "seva-maintenance",
    ]);
  });
});

describe.each(DB_WRITER_INVENTORY)("$file ($id)", (entry) => {
  const yaml = readWorkflow(entry.file);
  const jobs = parseWorkflow(yaml);

  it("is a workflow that really executes its writer commands", () => {
    // Non-vacuity: the guard and every command must genuinely be present, so the
    // ordering checks below cannot pass by finding nothing.
    const runBodies = jobs.flatMap((j) => j.steps.map((s) => s.runBody));
    for (const command of [entry.guard, ...entry.commands]) {
      const found = runBodies.some((b) => commandStatements(b, command, scripts).length > 0);
      expect(`${entry.file} ${command}:${found}`).toBe(`${entry.file} ${command}:true`);
    }
  });

  it("runs its destination guard before every database command", () => {
    expect(guardOrderingViolations(yaml, entry.commands, entry.guard, scripts)).toEqual([]);
  });

  it("passes the guarded value through env, never interpolated into the shell", () => {
    const guardSteps = jobs
      .flatMap((j) => j.steps)
      .filter((s) => commandStatements(s.runBody, entry.guard, scripts).length > 0);
    expect(guardSteps.length).toBeGreaterThan(0);
    for (const step of guardSteps) {
      expect(step.runBody).not.toMatch(/\$\{\{\s*inputs\./);
      expect(step.runBody).not.toMatch(/\$\{\{\s*secrets\./);
    }
  });
  it("has the expected environment binding, and never fakes approval", () => {
    const bindings = jobs.map((j) => j.environment).filter(Boolean);
    if (entry.environment === "") {
      expect(bindings).toEqual([]);
    } else {
      expect(bindings).toEqual([entry.environment]);
    }
    // `environment: production` only becomes a human gate once the owner configures
    // required reviewers on that environment. Nothing in the YAML can assert that,
    // so no workflow may *claim* approval is effective.
    expect(yaml).not.toMatch(/environment (?:protection|approval) is (?:enabled|configured|in place)/i);
    expect(yaml).not.toMatch(/required reviewers (?:are|is) configured/i);
  });

  it("does not let an always-run step bypass the guard", () => {
    for (const job of jobs) {
      const guard = job.steps.find(
        (s) => commandStatements(s.runBody, entry.guard, scripts).length > 0,
      );
      if (!guard) continue;
      for (const step of job.steps) {
        const runsCommand = entry.commands.some(
          (c) => commandStatements(step.runBody, c, scripts).length > 0,
        );
        const runsRawCli = entry.rawCli && rawDbClientStatements(step.runBody).length > 0;
        if (!runsCommand && !runsRawCli) continue;
        if (!/\b(always|failure|cancelled)\s*\(/.test(step.if)) continue;
        expect(`${entry.file} ${step.name}:${step.if.includes(`steps.${guard.id}.outcome`)}`).toBe(
          `${entry.file} ${step.name}:true`,
        );
      }
    }
  });
});

describe.each(DB_WRITER_INVENTORY.filter((w) => w.rawCli))(
  "$file ($id) raw psql/pg_dump calls",
  (entry) => {
    const yaml = readWorkflow(entry.file);

    it("is detected in command-substitution and direct forms", () => {
      const statements = parseWorkflow(yaml)
        .flatMap((j) => j.steps.map((s) => s.runBody))
        .flatMap((b) => rawDbClientStatements(b));
      // The purge is `removed="$(psql "$URL" …)"`; the backup has a bare
      // `psql "$URL" …` version probe. Both must be found, or the guard-ordering
      // check for this workflow would be checking nothing.
      expect(statements.length).toBeGreaterThan(0);
      if (entry.id === "seva-maintenance") {
        expect(statements.some((s) => s.includes("$("))).toBe(true);
      }
      if (entry.id === "seva-backup") {
        expect(statements.some((s) => !s.includes("$("))).toBe(true);
      }
    });

    it("excludes the `command -v psql` install check, which never connects", () => {
      for (const job of parseWorkflow(yaml)) {
        for (const step of job.steps) {
          expect(rawDbClientStatements(step.runBody)).not.toContain("command -v psql");
        }
      }
    });

    it("orders the guard before the first raw client call", () => {
      for (const job of parseWorkflow(yaml)) {
        const guard = job.steps.find(
          (s) => commandStatements(s.runBody, entry.guard, scripts).length > 0,
        );
        const firstRaw = job.steps.findIndex((s) => rawDbClientStatements(s.runBody).length > 0);
        if (firstRaw === -1) continue;
        expect(guard).toBeDefined();
        expect(guard!.index).toBeLessThan(firstRaw);
        expect(stepIsDisabled(guard!)).toBe(false);
        expect(guard!.continueOnError).toBe(false);
      }
    });
  },
);

describe("no database writer escapes the inventory", () => {
  /**
   * The inventory must be complete, not merely correct. The detector here is
   * independent of the inventory: it looks for Postgres CLI invocations and for
   * `scripts/` files that actually open a Postgres/Supabase connection. A new
   * writer added without being enumerated is therefore reported even if nobody
   * remembered to update the inventory.
   */
  const KNOWN_FILES = new Set(ALL_INVENTORY.map((w) => w.file));

  it("every workflow that opens a Postgres connection is enumerated", () => {
    const unenumerated: string[] = [];
    for (const file of workflowFiles()) {
      const yaml = readWorkflow(file);
      const bodies = parseWorkflow(yaml)
        .flatMap((j) => j.steps)
        .map((s) => s.runBody);

      const viaCli = bodies.some((b) => postgresCliStatements(b, scripts).length > 0);
      const viaScript = bodies.some((b) =>
        referencedScripts(b).some((rel) => scriptTouchesDatabase(rel)),
      );
      if ((viaCli || viaScript) && !KNOWN_FILES.has(file)) unenumerated.push(file);
    }
    expect(unenumerated).toEqual([]);
  });

  it("the detector actually detects the raw psql writers (non-vacuity)", () => {
    // Guards against a detector that matches nothing and therefore "passes".
    for (const file of ["seva-backup.yml", "seva-maintenance.yml"]) {
      const bodies = parseWorkflow(readWorkflow(file))
        .flatMap((j) => j.steps)
        .map((s) => s.runBody);
      expect(`${file}:${bodies.some((b) => postgresCliStatements(b, scripts).length > 0)}`).toBe(
        `${file}:true`,
      );
    }
    // And it must find a writer even when the inventory entry is removed.
    const known = new Set(
      DB_WRITER_INVENTORY.filter((w) => w.id !== "seva-maintenance")
        .concat(DB_CONNECTION_INVENTORY)
        .map((w) => w.file),
    );
    expect(known.has("seva-maintenance.yml")).toBe(false);
    const bodies = parseWorkflow(readWorkflow("seva-maintenance.yml"))
      .flatMap((j) => j.steps)
      .map((s) => s.runBody);
    expect(bodies.some((b) => postgresCliStatements(b, scripts).length > 0)).toBe(true);
  });

  it("every enumerated workflow actually contains its writer", () => {
    // The converse check: an inventory entry pointing at a workflow that no longer
    // runs the writer is stale and must be corrected.
    for (const entry of ALL_INVENTORY) {
      const runBodies = parseWorkflow(readWorkflow(entry.file)).flatMap((j) =>
        j.steps.map((s) => s.runBody),
      );
      const present =
        runBodies.some((b) => entry.commands.some((c) => commandStatements(b, c, scripts).length > 0)) ||
        (entry.rawCli && runBodies.some((b) => rawDbClientStatements(b).length > 0));
      expect(`${entry.file}:${present}`).toBe(`${entry.file}:true`);
    }
  });

  it("detects a guard removed from a writer (mutation control)", () => {
    const yaml = readWorkflow("seva-maintenance.yml");
    const mutated = yaml.replace(
      /      - name: Guard approved database URL\n(?:.*\n)*?        run: node scripts\/lib\/guard-approved-db-url\.mjs\n/,
      "",
    );
    expect(mutated).not.toBe(yaml);
    expect(
      guardOrderingViolations(
        mutated,
        ["bash scripts/seva/backup.sh"],
        "node scripts/lib/guard-approved-db-url.mjs",
        scripts,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("detects a guard moved after the write (mutation control)", () => {
    const yaml = readWorkflow("seva-maintenance.yml");
    const guardBlock = yaml.match(
      /      - name: Guard approved database URL\n(?:.*\n)*?        run: node scripts\/lib\/guard-approved-db-url\.mjs\n/,
    )?.[0];
    expect(guardBlock).toBeDefined();
    const withoutGuard = yaml.replace(guardBlock!, "");
    // Re-insert the guard immediately before the purge step's `env:` block, which
    // places it after the step that runs psql.
    const mutated = withoutGuard.replace(
      /      - name: Purge devotee profiles not seen for three years\n/,
      "      - name: Purge devotee profiles not seen for three years\n" + guardBlock!,
    );
    expect(mutated).not.toBe(withoutGuard);
    expect(
      guardOrderingViolations(
        mutated,
        ["bash scripts/seva/backup.sh"],
        "node scripts/lib/guard-approved-db-url.mjs",
        scripts,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("detects an always-run write step that bypasses a failed guard (mutation control)", () => {
    // The backup's `if: always()` step is a raw `psql` write, not one of the
    // inventory `commands`, so the check has to see it through the raw-client
    // detector — the same blind spot that hid the Seva writers originally.
    const yaml = readWorkflow("seva-backup.yml");
    const mutated = yaml.replace(
      "if: always() && steps.guard.outcome == 'success'",
      "if: always()",
    );
    expect(mutated).not.toBe(yaml);

    const guard = parseWorkflow(mutated)
      .flatMap((j) => j.steps)
      .find((s) => commandStatements(s.runBody, "node scripts/lib/guard-approved-db-url.mjs", scripts).length > 0);
    const alwaysSteps = parseWorkflow(mutated)
      .flatMap((j) => j.steps)
      .filter((s) => /\balways\s*\(/.test(s.if) && rawDbClientStatements(s.runBody).length > 0);
    expect(alwaysSteps.length).toBeGreaterThan(0);
    for (const step of alwaysSteps) {
      expect(`${step.name}:${step.if.includes(`steps.${guard!.id}.outcome`)}`).toBe(
        `${step.name}:false`,
      );
    }
  });

  it("detects a guard that cannot fail the job (mutation control)", () => {
    const yaml = readWorkflow("seva-backup.yml");
    const mutated = yaml.replace(
      "      - name: Guard approved database URL\n        id: guard\n",
      "      - name: Guard approved database URL\n        id: guard\n        continue-on-error: true\n",
    );
    expect(mutated).not.toBe(yaml);
    const violations = guardOrderingViolations(
      mutated,
      ["bash scripts/seva/backup.sh"],
      "node scripts/lib/guard-approved-db-url.mjs",
      scripts,
    );
    expect(violations.map((v) => v.message).join(" ")).toMatch(/continue-on-error/);
  });
});

describe("the read-only Prisma connection path verifies its destination", () => {
  const entry = DB_CONNECTION_INVENTORY[0];

  it("guards the derived connection string and the operator override", () => {
    const yaml = readWorkflow(entry.file);
    const derive = parseWorkflow(yaml)
      .flatMap((j) => j.steps)
      .find((s) => s.name === "Derive target connection");
    expect(derive).toBeDefined();
    const body = derive!.runBody;

    // Both entry points are guarded: the override, and each derived candidate
    // before the reachability probe opens a connection.
    const guardCalls = commandStatements(body, entry.guard, scripts);
    expect(guardCalls).toHaveLength(1); // the shared guard script, wrapped in guard_url()
    expect(body).toMatch(/guard_url\(\) \{/);
    expect(body).toMatch(/guard_url "\$OVERRIDE"/);
    expect(body).toMatch(/guard_url "\$CAND"/);

    // The guard call must precede the probe in the loop body.
    const guardIdx = body.indexOf('guard_url "$CAND"');
    const probeIdx = body.indexOf("probe-pg-url.mjs");
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(probeIdx).toBeGreaterThan(guardIdx);

    // The guard reads its value from the environment, never argv.
    expect(body).toMatch(/GUARD_DB_URL_VAR=PRISMA_DATABASE_URL_CANDIDATE/);
  });

  it("still refuses to run the probe before verifying the destination", () => {
    const yaml = readWorkflow(entry.file);
    const violations = guardOrderingViolations(yaml, entry.commands, entry.guard, scripts);
    expect(violations).toEqual([]);
  });

  it("is documented as read-only so it is not mistaken for a writer", () => {
    expect(readWorkflow(entry.file)).toMatch(/NEVER writes|does not apply migrations/);
  });
});

describe("destructive purge is treated as a separate authorization problem", () => {
  const purge = DB_WRITER_INVENTORY.find((w) => w.id === "seva-maintenance")!;

  it("is marked destructive and scheduled", () => {
    expect(purge.destructive).toBe(true);
    expect(purge.trigger).toBe("scheduled");
  });

  it("is not treated as authorised by the destination guard or an environment binding", () => {
    const yaml = readWorkflow(purge.file);
    // No environment binding is claimed to authorise deletion.
    expect(parseWorkflow(yaml).map((j) => j.environment).filter(Boolean)).toEqual([]);
    // The workflow itself must say so, so a reader cannot infer the opposite.
    expect(yaml).toMatch(/not authorization to purge|not approval to delete|NOT authorization/i);
  });

  it("remains disabled on the schedule, requiring an authorization a cron cannot supply", () => {
    const yaml = readWorkflow(purge.file);
    const purgeStep = parseWorkflow(yaml)
      .flatMap((j) => j.steps)
      .find((s) => rawDbClientStatements(s.runBody).length > 0);
    expect(purgeStep).toBeDefined();

    // The authorization is carried by the event, not by a value: a `schedule` event
    // has no `inputs`, so `github.event_name` is the only thing that can gate it.
    expect(purgeStep!.runBody).toMatch(/EVENT_NAME/);
    expect(purgeStep!.runBody).toMatch(/workflow_dispatch/);
    expect(purgeStep!.runBody).toMatch(/CONFIRM_PURGE/);
    expect(purgeStep!.runBody).toMatch(/purge-devotee-profiles/);

    // The psql call sits after both checks, so neither can be skipped.
    const guardIdx = purgeStep!.runBody.indexOf("EVENT_NAME");
    const phraseIdx = purgeStep!.runBody.indexOf("CONFIRM_PURGE");
    const psqlIdx = purgeStep!.runBody.indexOf("psql ");
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(phraseIdx).toBeGreaterThan(guardIdx);
    expect(psqlIdx).toBeGreaterThan(phraseIdx);

    // The phrase is not a default input value, so it cannot be supplied by the
    // workflow itself and cannot be pre-filled for an operator.
    expect(yaml).not.toMatch(/confirm_purge:\n(?:.*\n)*?\s+default:/);
    // The event name is read from the runner context, not from an input.
    expect(purgeStep!.runBody).not.toMatch(/\$\{\{\s*inputs\.event/);
  });

  it("reads the phrase from the environment, never interpolated into the shell", () => {
    const yaml = readWorkflow(purge.file);
    const purgeStep = parseWorkflow(yaml)
      .flatMap((j) => j.steps)
      .find((s) => rawDbClientStatements(s.runBody).length > 0)!;
    expect(purgeStep.runBody).not.toMatch(/\$\{\{\s*inputs\.confirm_purge/);
    expect(purgeStep.runBody).toMatch(/"\$CONFIRM_PURGE"/);
  });

  it("names a design document for the explicit authorization", () => {
    const yaml = readWorkflow(purge.file);
    expect(yaml).toMatch(/docs\/SECURITY_DESTRUCTIVE_AUTHORIZATION\.md/);
  });
});

describe("behavioral: a scheduled purge cannot delete anything", () => {
  /**
   * Executes the real purge step body with a stubbed `psql` on PATH, so the gate is
   * proven by running it rather than by reading it. The stub records that it was
   * invoked; if it is never invoked, no deletion happened. No database, no network,
   * no dispatch.
   */
  const purgeBody = parseWorkflow(readWorkflow("seva-maintenance.yml"))
    .flatMap((j) => j.steps)
    .find((s) => rawDbClientStatements(s.runBody).length > 0)!.runBody;

  function runPurge(eventName: string, confirm: string) {
    const dir = mkdtempSync(join(tmpdir(), "purge-gate-"));
    const sentinel = join(dir, "psql-invoked");
    writeFileSync(
      join(dir, "psql"),
      `#!/usr/bin/env bash\nprintf 'psql invoked\\n' > ${JSON.stringify(sentinel)}\necho 0\n`,
    );
    chmodSync(join(dir, "psql"), 0o755);
    try {
      const r = spawnSync("bash", ["-c", purgeBody], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          EVENT_NAME: eventName,
          CONFIRM_PURGE: confirm,
        },
      });
      return { status: r.status, stdout: r.stdout ?? "", invoked: existsSync(sentinel) };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("does not invoke psql on a scheduled run, even with the phrase supplied", () => {
    // A schedule event carries no inputs, so the phrase is empty; assert both the
    // realistic empty value and the hostile case where one is somehow present.
    for (const confirm of ["", "purge-devotee-profiles"]) {
      const r = runPurge("schedule", confirm);
      expect([confirm, r.status, r.invoked]).toEqual([confirm, 0, false]);
      expect(r.stdout).toMatch(/No rows were deleted/);
    }
  });

  it("does not invoke psql on a dispatch without the exact phrase", () => {
    for (const confirm of ["", "purge", "purge-devotee-profiles ", "PURGE-DEVOTEE-PROFILES"]) {
      const r = runPurge("workflow_dispatch", confirm);
      expect([confirm, r.status, r.invoked]).toEqual([confirm, 1, false]);
    }
  });

  it("does not execute a command-substitution payload in the phrase", () => {
    const dir = mkdtempSync(join(tmpdir(), "purge-inject-"));
    const payloadSentinel = join(dir, "pwned");
    try {
      for (const payload of [
        `$(touch ${payloadSentinel})`,
        "`touch " + payloadSentinel + "`",
        `x"; touch ${payloadSentinel}; echo "`,
        `x" && touch ${payloadSentinel} && echo "`,
      ]) {
        const r = runPurge("workflow_dispatch", payload);
        expect([payload, r.status, r.invoked, existsSync(payloadSentinel)]).toEqual([
          payload,
          1,
          false,
          false,
        ]);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("invokes psql only on an explicit dispatch with the exact phrase", () => {
    const r = runPurge("workflow_dispatch", "purge-devotee-profiles");
    expect([r.status, r.invoked]).toEqual([0, true]);
  });
});
