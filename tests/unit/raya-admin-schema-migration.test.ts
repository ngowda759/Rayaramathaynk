/**
 * Structural tests for the `users.auth_user_id` migration.
 *
 * These read the SQL and the Prisma schema from disk and assert the safety
 * properties that were verified by hand against a Postgres 16 instance built
 * from the repo's own migrations (see docs/RAYA_AI_SUPABASE_NATIVE_AUTH.md §5):
 *
 *   - the column is a UUID and nullable,
 *   - uniqueness is a *partial* unique index (so the many legacy NULL rows do not
 *     collide),
 *   - the FK targets auth.users(id) with ON DELETE SET NULL,
 *   - the migration is additive and does not drop/truncate/rewrite data,
 *   - the Prisma model mirrors the column.
 *
 * They cannot replace applying the migration to the real project; they exist so
 * the file cannot silently lose one of these properties.
 */

import fs from "fs";
import path from "path";

const MIGRATION = "supabase/migrations/20261022000000_add_auth_user_id_to_users.sql";
const sql = fs.readFileSync(path.join(process.cwd(), MIGRATION), "utf8");
/** SQL with `--` line comments removed, so assertions test statements not prose. */
const sqlCode = sql
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");
const prisma = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");

describe("users.auth_user_id migration", () => {
  it("adds the column as a nullable uuid", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS auth_user_id uuid/i);
    // Nullable: no NOT NULL on the new column.
    expect(sql).not.toMatch(/auth_user_id uuid[^;]*NOT NULL/i);
  });

  it("enforces uniqueness with a partial unique index, not a bare UNIQUE", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id/i);
    expect(sql).toMatch(/WHERE auth_user_id IS NOT NULL/i);
    // A bare UNIQUE constraint would collide across the many legacy NULL rows.
    expect(sql).not.toMatch(/CONSTRAINT\s+\S*auth_user_id\S*\s+UNIQUE/i);
  });

  it("references auth.users(id) with ON DELETE SET NULL", () => {
    expect(sql).toMatch(/REFERENCES auth\.users\s*\(\s*id\s*\)/i);
    expect(sql).toMatch(/ON DELETE SET NULL/i);
  });

  it("is idempotent: every statement is guarded", () => {
    // The column and index use IF NOT EXISTS; the FK is wrapped in a catalog check.
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS");
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS");
    expect(sql).toMatch(/pg_constraint WHERE conname = 'users_auth_user_id_fkey'/);
  });

  it("is additive and non-destructive", () => {
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
    expect(sql).not.toMatch(/DROP\s+COLUMN/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
    expect(sql).not.toMatch(/UPDATE\s+users\s+SET/i);
    expect(sql).not.toMatch(/ALTER COLUMN/i);
    expect(sql).not.toMatch(/DROP\s+CONSTRAINT/i);
  });

  it("does not redefine the table or touch its existing columns", () => {
    expect(sqlCode).not.toMatch(/CREATE\s+TABLE/i);
    // It must not grant a role or flip `active`.
    expect(sqlCode).not.toMatch(/\brole\b/i);
    expect(sqlCode).not.toMatch(/\bactive\b/i);
  });
});

describe("Prisma mirrors users.auth_user_id", () => {
  it("declares authUserId as a nullable uuid with the exact index name", () => {
    expect(prisma).toMatch(
      /authUserId\s+String\?\s+@unique\(map:\s*"idx_users_auth_user_id"\)\s+@map\("auth_user_id"\)\s+@db\.Uuid/
    );
  });

  it("keeps the long-standing users columns unchanged", () => {
    // role default and active default must not have been altered by this change.
    expect(prisma).toMatch(/role\s+String\s+@default\("user"\)/);
    expect(prisma).toMatch(/active\s+Boolean\s+@default\(true\)/);
    expect(prisma).toMatch(/firestoreId\s+String\?\s+@unique\s+@map\("firestore_id"\)/);
  });
});

describe("public.users least-privilege backing", () => {
  const contentSql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20261001000000_create_content_tables.sql"),
    "utf8"
  );

  it("has RLS enabled with a deny-all policy for the public role", () => {
    // The guard reads/writes through the service-role key; anon and authenticated
    // browser clients must not reach the authorization table at all.
    expect(contentSql).toMatch(/ALTER TABLE users ENABLE ROW LEVEL SECURITY/i);
    expect(contentSql).toMatch(/POLICY "Deny all public access to users" ON users FOR ALL TO public USING \(false\)/i);
  });

  it("does not let the new column weaken the deny-all policy", () => {
    // The migration adds a column and an index; it must not add a permissive policy.
    expect(sqlCode).not.toMatch(/CREATE POLICY/i);
    expect(sqlCode).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
    expect(sqlCode).not.toMatch(/GRANT\s+/i);
  });
});
