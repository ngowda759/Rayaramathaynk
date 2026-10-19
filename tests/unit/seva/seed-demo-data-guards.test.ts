/**
 * @jest-environment node
 *
 * scripts/seva/seed-demo-data.ts - the guards that keep the demo seeder off anything but a named TEST project.
 * checkGuards() is pure: it reads the arguments and the environment it is given, so no database is touched.
 */
import { checkGuards, DemoSeedError } from "../../../scripts/seva/seed-demo-data";

const REF = "abcdefghijklmnopqrst";
const KEY = "service-role-key-that-must-never-be-printed";

function env(extra: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return { NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_SERVICE_ROLE_KEY: KEY, ...extra };
}

const GOOD = ["--project-ref", REF, "--yes-this-is-a-test-project"];

function refusal(argv: readonly string[], environment: Record<string, string | undefined>): string {
  try {
    checkGuards(argv, environment);
  } catch (error) {
    expect(error).toBeInstanceOf(DemoSeedError);
    const message = (error as Error).message;
    expect(message).not.toContain(KEY);
    return message;
  }
  throw new Error("checkGuards did not refuse");
}

describe("seed-demo-data guards", () => {
  it("accepts the matching ref with the confirmation flag, with the defaults", () => {
    const ok = checkGuards(GOOD, env());
    expect(ok.kind).toBe("run");
    if (ok.kind !== "run") return;
    expect(ok.url).toBe(`https://${REF}.supabase.co`);
    expect(ok.key).toBe(KEY);
    expect(ok.options).toMatchObject({ days: 90, again: false, dryRun: false, staffNo: 1, counterId: 1, festival: true });
  });

  it("reads --days, --seed, --again, --dry-run and --no-festival", () => {
    const ok = checkGuards([...GOOD, "--days", "5", "--seed", "7", "--again", "--dry-run", "--no-festival"], env());
    expect(ok.kind === "run" && ok.options).toMatchObject({ days: 5, seed: 7, again: true, dryRun: true, festival: false });
  });

  it("refuses a ref that is not the project in NEXT_PUBLIC_SUPABASE_URL", () => {
    expect(refusal(["--project-ref", "zzzzzzzzzzzzzzzzzzzz", "--yes-this-is-a-test-project"], env())).toMatch(/does not match/);
  });

  it("refuses a URL whose host only contains the ref", () => {
    const message = refusal(GOOD, env({ NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co.example.com` }));
    expect(message).toMatch(/does not match/);
  });

  it("refuses without --project-ref", () => {
    expect(refusal(["--yes-this-is-a-test-project"], env())).toMatch(/--project-ref/);
  });

  it("refuses without --yes-this-is-a-test-project", () => {
    expect(refusal(["--project-ref", REF], env())).toMatch(/--yes-this-is-a-test-project/);
  });

  it("refuses when CI is set", () => {
    expect(refusal(GOOD, env({ CI: "true" }))).toMatch(/CI/);
  });

  it("refuses when VERCEL is set", () => {
    expect(refusal(GOOD, env({ VERCEL: "1" }))).toMatch(/VERCEL/);
  });

  it("refuses when NODE_ENV is production", () => {
    expect(refusal(GOOD, env({ NODE_ENV: "production" }))).toMatch(/production/);
  });

  it("refuses without the Supabase URL or key, naming the variables only", () => {
    expect(refusal(GOOD, env({ SUPABASE_SERVICE_ROLE_KEY: undefined }))).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(refusal(GOOD, env({ NEXT_PUBLIC_SUPABASE_URL: "" }))).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("refuses an unknown argument and an out-of-range --days", () => {
    expect(refusal([...GOOD, "--force"], env())).toMatch(/Unknown argument/);
    expect(refusal([...GOOD, "--days", "0"], env())).toMatch(/--days/);
    expect(refusal([...GOOD, "--days", "400"], env())).toMatch(/--days/);
  });

  it("answers --help without needing any flag", () => {
    expect(checkGuards(["--help"], {}).kind).toBe("help");
  });
});
