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
 *   - it is a `ddl_command_end` trigger on exactly the same tags, so it sees the
 *     enabler's effect and fires only where the enabler would have;
 *   - it raises (does not log-and-continue) when a `public` table has RLS off;
 *   - it REFUSES TO INSTALL when there is no enabled enabler, because installing it
 *     without one would block every future public table creation;
 *   - it keeps the tight `search_path` and needs no elevated right.
 *
 * The behavioural counterpart lives in `tests/db/f-a16-least-privilege.test.ts`.
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

/** The body of the assertion function only, so the precondition is not in scope. */
const assertionBody =
  sql.match(/CREATE OR REPLACE FUNCTION public\.f_a16_assert_public_rls\(\)[\s\S]*?\n\$\$;/i)?.[0] ?? "";

describe("F-A16-03 fail-closed RLS assertion", () => {
  it("does not weaken or remove the platform event trigger", () => {
    // The finding explicitly forbids "weaken or remove the event trigger as a
    // workaround". `ensure_rls` must not be dropped or disabled here.
    expect(sql).not.toMatch(/DROP\s+EVENT\s+TRIGGER\s+(IF\s+EXISTS\s+)?ensure_rls/i);
    expect(sql).not.toMatch(/ALTER\s+EVENT\s+TRIGGER\s+ensure_rls\s+(DISABLE|RENAME)/i);
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
    expect(assertionBody).toMatch(/RAISE EXCEPTION/i);
    // The assertion itself must not swallow the failure. (The precondition block is
    // allowed a NOTICE on the success path, which is why only the body is checked.)
    expect(assertionBody).not.toMatch(/RAISE\s+(LOG|WARNING|NOTICE|INFO)/i);
    expect(assertionBody).not.toMatch(/EXCEPTION\s+WHEN/i);
  });

  it("checks the RLS flag on the created object by oid", () => {
    // Reading by `cmd.objid` avoids a name-shadowing false pass.
    expect(assertionBody).toMatch(/c\.oid\s*=\s*cmd\.objid/i);
    expect(assertionBody).toMatch(/relrowsecurity/i);
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

  describe("precondition (installing this guard without an enabler is a hazard)", () => {
    it("looks up an enabled ddl_command_end trigger that calls rls_auto_enable", () => {
      expect(sql).toMatch(/FROM pg_catalog\.pg_event_trigger/i);
      expect(sql).toMatch(/e\.evtname/i);
      expect(sql).toMatch(/evt\.evtfoid::regprocedure::text LIKE '%rls_auto_enable%'|e\.evtfoid::regprocedure::text LIKE '%rls_auto_enable%'/i);
      expect(sql).toMatch(/evtenabled/i);
    });

    it("raises when no enabler exists", () => {
      expect(sql).toMatch(
        /RAISE EXCEPTION 'F-A16-03: no ddl_command_end event trigger calls rls_auto_enable\(\)'/i
      );
    });

    it("raises when the enabler exists but is disabled", () => {
      expect(sql).toMatch(
        /RAISE EXCEPTION 'F-A16-03: the RLS enabler trigger % exists but is not enabled'/i
      );
    });

    it("runs the precondition before creating the trigger", () => {
      const preconditionAt = sql.search(/RAISE EXCEPTION 'F-A16-03: no ddl_command_end/);
      const createAt = sql.search(/CREATE EVENT TRIGGER f_a16_assert_public_rls/);
      expect(preconditionAt).toBeGreaterThan(-1);
      expect(createAt).toBeGreaterThan(-1);
      expect(preconditionAt).toBeLessThan(createAt);
    });
  });
});
