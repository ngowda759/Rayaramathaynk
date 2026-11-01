/**
 * @jest-environment node
 *
 * F-A16-03 — structural guard for the proposed fail-closed RLS assertion.
 *
 * The assertion is additive: it adds a second event trigger that verifies the
 * post-condition of the platform's `ensure_rls`. These tests read the SQL from disk
 * and pin the properties that keep it a *strengthening* rather than a change of
 * behaviour:
 *
 *   - it does not drop, alter, rename or weaken `ensure_rls` / `rls_auto_enable`;
 *   - it is an `ddl_command_end` trigger on exactly the same tags, so it sees the
 *     enabler's effect;
 *   - it raises (does not log-and-continue) when a `public` table has RLS off;
 *   - it keeps the tight `search_path` and needs no elevated right.
 *
 * The behavioural counterpart lives in `tests/db/f-a16-rls-fail-closed.test.ts`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const FILE = "supabase/migrations/20261115000100_f_a16_fail_closed_rls_assertion.sql";

const raw = readFileSync(path.join(ROOT, FILE), "utf8");
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

describe("F-A16-03 fail-closed RLS assertion", () => {
  it("does not weaken or remove the platform event trigger", () => {
    // The finding explicitly forbids "weaken or remove the event trigger as a
    // workaround". `ensure_rls` must not be dropped or disabled here.
    expect(sql).not.toMatch(/DROP\s+EVENT\s+TRIGGER\s+(IF\s+EXISTS\s+)?ensure_rls/i);
    expect(sql).not.toMatch(/ALTER\s+EVENT\s+TRIGGER\s+ensure_rls/i);
    expect(sql).not.toMatch(/DISABLE\s+TRIGGER/i);
    // It may *mention* them in comments, but must not redefine the function.
    expect(sql).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(public\.)?rls_auto_enable/i);
  });

  it("adds its own trigger on the same ddl_command_end tags as the enabler", () => {
    expect(sql).toMatch(/CREATE EVENT TRIGGER f_a16_assert_public_rls/i);
    expect(sql).toMatch(/ON ddl_command_end/i);
    expect(sql).toMatch(/WHEN TAG IN \('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO'\)/i);
    // Dropped first so a re-run does not fail on "trigger already exists".
    expect(sql).toMatch(/DROP EVENT TRIGGER IF EXISTS f_a16_assert_public_rls/i);
  });

  it("raises an exception instead of logging and continuing", () => {
    expect(sql).toMatch(/RAISE EXCEPTION/i);
    // The failure must be an exception; a bare RAISE LOG/WARNING would be fail-open.
    expect(sql).not.toMatch(/RAISE\s+(LOG|WARNING|NOTICE|INFO)/i);
  });

  it("checks the RLS flag on the created object by oid", () => {
    // Reading by `cmd.objid` avoids a name-shadowing false pass.
    expect(sql).toMatch(/c\.oid\s*=\s*cmd\.objid/i);
    expect(sql).toMatch(/relrowsecurity/i);
  });

  it("keeps the secure search_path and needs no elevated right", () => {
    expect(sql).toMatch(/SET search_path = pg_catalog/i);
    // SECURITY INVOKER (the default) is required: the assertion only reads catalogs.
    expect(sql).not.toMatch(/SECURITY DEFINER/i);
  });

  it("revokes the default PUBLIC EXECUTE on its own function", () => {
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.f_a16_assert_public_rls\(\) FROM PUBLIC, anon, authenticated/i
    );
  });

  it("is idempotent", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_a16_assert_public_rls/i);
    expect(sql).toMatch(/DROP EVENT TRIGGER IF EXISTS f_a16_assert_public_rls/i);
  });

  it("is not marked as applied anywhere", () => {
    expect(raw).toMatch(/Status: PROPOSED\. NOT APPLIED/);
  });
});
