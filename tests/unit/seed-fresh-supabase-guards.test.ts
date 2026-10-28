/**
 * @jest-environment node
 *
 * `scripts/seed-fresh-supabase.ts` — the guards that keep the fresh initialization off
 * the approved production project.
 *
 * The script is executed as a real child process (`npx tsx … --dry-run`) with a
 * controlled environment, exactly as the other guard suites in this repository do.
 * `--dry-run` prints the plan and writes nothing, so no database, network or
 * credential is involved: every assertion here is about the guard's exit code and
 * message. The approved ref is read from the shared library in a child process so the
 * test cannot drift from the value the guard compares against.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(__dirname, "../..");
const script = resolve(root, "scripts/seed-fresh-supabase.ts");
const approvedLib = resolve(root, "scripts/lib/approved-project.mjs");

/**
 * The approved production ref, read from the shared library in a real node process.
 * ts-jest cannot load an `.mjs` module, so the value is fetched the same way the
 * migration-safety suite does rather than duplicated here.
 */
const APPROVED_PROJECT_REF = (() => {
  const r = spawnSync(
    "node",
    ["--input-type=module", "-e", `import * as m from ${JSON.stringify(pathToFileURL(approvedLib).href)}; process.stdout.write(m.APPROVED_PROJECT_REF)`],
    { cwd: root, encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`could not read the approved ref: ${r.stderr}`);
  return r.stdout.trim();
})();

const TEST_REF = "abcdefghijklmnopqrst";
/** A sentinel password that must never be echoed by the guard. */
const PW_SENTINEL = "sup3rs3cret-pw-must-not-leak";

/** Run the seed script with a clean Supabase environment plus the given overrides. */
function run(args: string[], env: Record<string, string | undefined> = {}) {
  const base: Record<string, string | undefined> = { ...process.env };
  for (const key of [
    "NODE_ENV",
    "VERCEL",
    "CI",
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DB_PASSWORD",
    "SUPABASE_POOLER_HOST",
  ]) {
    delete base[key];
  }
  return spawnSync("npx", ["--no-install", "tsx", script, ...args], {
    cwd: root,
    env: { ...base, ...env } as NodeJS.ProcessEnv,
    encoding: "utf8",
  });
}

const dryRun = (args: string[]) => [...args, "--dry-run"];

describe("seed-fresh-supabase production guards", () => {
  it("refuses the approved production ref even with the test-project confirmation", () => {
    const r = run(
      dryRun(["--project-ref", APPROVED_PROJECT_REF, "--yes-this-is-a-test-project"]),
      { NEXT_PUBLIC_SUPABASE_URL: `https://${APPROVED_PROJECT_REF}.supabase.co` },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/approved production project/i);
    // The ref value itself is never printed; only a fingerprint.
    expect(r.stderr).not.toContain(APPROVED_PROJECT_REF);
  });

  it("accepts an unapproved test ref whose URL matches", () => {
    const r = run(
      dryRun(["--project-ref", TEST_REF, "--yes-this-is-a-test-project"]),
      { NEXT_PUBLIC_SUPABASE_URL: `https://${TEST_REF}.supabase.co` },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Dry run complete/);
  });

  it("refuses a project ref that looks like production", () => {
    const ref = "prodxyzabcdefghijklm";
    const r = run(dryRun(["--project-ref", ref, "--yes-this-is-a-test-project"]), {
      NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/looks like production/i);
  });

  it("refuses when NEXT_PUBLIC_SUPABASE_URL names a different project", () => {
    const r = run(
      dryRun(["--project-ref", TEST_REF, "--yes-this-is-a-test-project"]),
      { NEXT_PUBLIC_SUPABASE_URL: `https://${APPROVED_PROJECT_REF}.supabase.co` },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/does not match/i);
  });

  it("refuses a URL that only contains the ref as a host suffix", () => {
    const r = run(
      dryRun(["--project-ref", TEST_REF, "--yes-this-is-a-test-project"]),
      { NEXT_PUBLIC_SUPABASE_URL: `https://${TEST_REF}.supabase.co.example.com` },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/does not match/i);
  });

  it("refuses a URL that hides the ref in userinfo", () => {
    const r = run(
      dryRun(["--project-ref", TEST_REF, "--yes-this-is-a-test-project"]),
      { NEXT_PUBLIC_SUPABASE_URL: `https://${TEST_REF}.supabase.co@evil.example.com` },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/does not match/i);
  });

  it("refuses a --project-ref run without the confirmation flag", () => {
    const r = run(dryRun(["--project-ref", TEST_REF]), {
      NEXT_PUBLIC_SUPABASE_URL: `https://${TEST_REF}.supabase.co`,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--yes-this-is-a-test-project/);
  });

  it("refuses a DATABASE_URL that resolves to the approved project (pooler username)", () => {
    const r = run(dryRun(["--local"]), {
      DATABASE_URL: `postgresql://postgres.${APPROVED_PROJECT_REF}:${PW_SENTINEL}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/approved production project/i);
    expect(r.stderr).not.toContain(PW_SENTINEL);
    expect(r.stderr).not.toContain(APPROVED_PROJECT_REF);
  });

  it("refuses a DATABASE_URL that resolves to the approved project (direct hostname)", () => {
    const r = run(dryRun(["--local"]), {
      DATABASE_URL: `postgresql://postgres:${PW_SENTINEL}@db.${APPROVED_PROJECT_REF}.supabase.co:5432/postgres`,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/approved production project/i);
    expect(r.stderr).not.toContain(PW_SENTINEL);
  });

  it("refuses an ambiguous DATABASE_URL that names two different projects", () => {
    const r = run(dryRun(["--local"]), {
      DATABASE_URL: `postgresql://postgres.${APPROVED_PROJECT_REF}:pw@db.${TEST_REF}.supabase.co:5432/postgres`,
    });
    expect(r.status).toBe(1);
  });

  it("still refuses when NODE_ENV=production, VERCEL or CI is set", () => {
    for (const key of ["NODE_ENV", "VERCEL", "CI"] as const) {
      const r = run(dryRun(["--local"]), {
        DATABASE_URL: "postgresql://postgres:pw@localhost:5432/postgres",
        [key]: key === "NODE_ENV" ? "production" : "1",
      });
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/production initialization is a separate/i);
    }
  });
});
