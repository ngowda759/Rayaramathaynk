/**
 * @jest-environment node
 *
 * scripts/seva/seed-demo-data.ts - the guards that keep the demo seeder off anything but a named TEST project.
 * checkGuards() is pure: it reads the arguments and the environment it is given, so no database is touched.
 */
import {
  checkGuards,
  counterAdvice,
  DemoSeedError,
  parseTimestamp,
  retryingRpc,
  SeedRpcError,
  stopAdvice,
  type RawRpcResult,
} from "../../../scripts/seva/seed-demo-data";

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

describe("seed-demo-data helpers", () => {
  it("reads last_seen_at as Supabase and as Postgres text give it", () => {
    expect(parseTimestamp("2026-10-19T04:30:00.5+00:00")?.toISOString()).toBe("2026-10-19T04:30:00.500Z");
    expect(parseTimestamp("2026-10-19 10:00:00.123+05:30")?.toISOString()).toBe("2026-10-19T04:30:00.123Z");
    expect(parseTimestamp("2026-10-19 04:30:00+00")?.toISOString()).toBe("2026-10-19T04:30:00.000Z");
    expect(parseTimestamp("")).toBeNull();
    expect(parseTimestamp("not a time")).toBeNull();
  });

  function raw(answers: (RawRpcResult | Error)[]): { call: (fn: string) => Promise<RawRpcResult>; calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      call: async (fn: string) => {
        calls.push(fn);
        const next = answers.shift();
        if (next instanceof Error) throw next;
        return next ?? { data: null, error: null };
      },
    };
  }
  const noSleep = async (): Promise<void> => undefined;

  it("retries a safe call after a network or database failure and returns the later answer", async () => {
    const r = raw([new Error("fetch failed"), { data: null, error: { code: "57P01" } }, { data: { duplicate: true }, error: null }]);
    const rpc = retryingRpc((fn) => r.call(fn), noSleep);
    await expect(rpc("seva_sync_offline_order", {})).resolves.toEqual({ duplicate: true });
    expect(r.calls).toHaveLength(3);
  });

  it("gives up after 3 tries, naming the code only", async () => {
    const r = raw([0, 1, 2].map(() => ({ data: null, error: { code: "08006", message: "secret text" } })));
    const rpc = retryingRpc((fn) => r.call(fn), noSleep);
    const error = await rpc("seva_mark_prasadam", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SeedRpcError);
    expect((error as Error).message).toBe("seva_mark_prasadam failed: database code 08006");
    expect(r.calls).toHaveLength(3);
  });

  it("never repeats prints, the festival or the audit markers, nor a business refusal", async () => {
    for (const fn of ["seva_record_prints", "seva_save_festival", "seva_audit"]) {
      const r = raw([{ data: null, error: { code: "08006" } }, { data: "late", error: null }]);
      await expect(retryingRpc((f) => r.call(f), noSleep)(fn, {})).rejects.toBeInstanceOf(SeedRpcError);
      expect(r.calls).toEqual([fn]);
    }
    const r = raw([{ data: null, error: { message: "SEVA:number_conflict", details: "{}" } }, { data: "late", error: null }]);
    const error = await retryingRpc((f) => r.call(f), noSleep)("seva_sync_offline_order", {}).catch((e: unknown) => e);
    expect((error as SeedRpcError).code).toBe("number_conflict");
    expect(r.calls).toHaveLength(1);
  });

  it("says which date was in progress and what to do next", () => {
    const past = stopAdvice({ date: "2026-08-14", what: "syncing its receipts" }, "2026-10-19");
    expect(past).toContain("Stopped while working on 2026-08-14 (syncing its receipts).");
    expect(past).toContain("close it on the Close day page and run again with --again");
    const today = stopAdvice({ date: "2026-10-19", what: "giving prasadam" }, "2026-10-19");
    expect(today).toContain("Stopped while working on 2026-10-19 (giving prasadam).");
    expect(today).toContain("Prasadam page");
    expect(counterAdvice("OF1", 5074)).toBe(
      "Before using the counter, open the counter page fresh while online. It will pick up OF1 last number 5074. " +
        "Do not use Work offline in a tab that was open during seeding.",
    );
  });
});
