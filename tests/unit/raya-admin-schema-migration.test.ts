/**
 * Structural tests for the `users.auth_user_id` migration.
 *
 * These read the SQL and the Prisma schema from disk and assert the safety
 * properties that were verified by hand against a Postgres 17 instance built
 * from the repo's own migrations (see docs/RAYA_AI_SUPABASE_NATIVE_AUTH.md §5):
 *
 *   - the column is a UUID and nullable,
 *   - uniqueness is a *partial* unique index (so the many legacy NULL rows do not
 *     collide),
 *   - there is deliberately NO foreign key to auth.users (a cross-schema FK makes
 *     the Prisma drift gate abort with P4002),
 *   - the migration is additive and does not drop/truncate/rewrite data,
 *   - the version sorts after every migration already applied in production,
 *   - the Prisma model mirrors the column.
 *
 * They cannot replace applying the migration to the real project; they exist so
 * the file cannot silently lose one of these properties.
 */

import fs from "fs";
import path from "path";

const MIGRATION = "supabase/migrations/20261103000000_add_auth_user_id_to_users.sql";
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

  it("has NO foreign key to auth.users (a cross-schema FK breaks the Prisma drift gate)", () => {
    // A public.users -> auth.users FK makes `prisma migrate diff` (the command
    // behind prisma:drift and prisma:drift:scoped) abort with P4002, because
    // Prisma cannot introspect a cross-schema reference unless the auth schema is
    // declared — and declaring it makes Prisma treat Supabase's auth.users as
    // owned by this repository. Integrity is instead provided by the partial
    // unique index plus the guard, which only ever resolves a *verified* session.
    expect(sqlCode).not.toMatch(/REFERENCES\s+auth\.users/i);
    expect(sqlCode).not.toMatch(/users_auth_user_id_fkey/i);
    expect(sqlCode).not.toMatch(/pg_constraint/i);
  });

  it("is idempotent: every statement is guarded", () => {
    // The column and index use IF NOT EXISTS.
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS");
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS");
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

describe("migration ordering (supabase db push rejects out-of-order files)", () => {
  // Production's applied ledger ends at 20261102000300_seva_final_touches (31
  // applied migrations, max version 20261102000300). `supabase db push` aborts
  // with "Found local migration files to be inserted before the last migration on
  // remote database" unless --include-all is passed, and the repo's
  // supabase:migrations:push script is deliberately bare. This guard fails if a
  // future edit renames this migration back to an out-of-order version.
  const LAST_APPLIED_IN_PRODUCTION = "20261102000300";
  const version = MIGRATION.match(/migrations\/(\d+)_/)?.[1] ?? "";

  it("sorts after the last migration already applied in production", () => {
    expect(version).not.toBe("");
    expect(version > LAST_APPLIED_IN_PRODUCTION).toBe(true);
  });

  it("is a pending migration, not one production has already applied", () => {
    // `supabase db push` applies the *pending* migrations (those newer than the
    // remote ledger) in filename order. The original form of this guard asserted
    // this file "is the newest local migration", which fails the moment any
    // legitimate newer migration lands and does not express what `db push`
    // requires. What matters is that this migration is itself pending (so it will
    // be applied) and sorts after the remote ledger (so it is not out of order).
    const versions = fs
      .readdirSync(path.join(process.cwd(), "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.split("_")[0]);
    const pending = versions.filter((v) => v > LAST_APPLIED_IN_PRODUCTION).sort();

    expect(pending).toContain(version);
    // Exactly one file may hold this version, or `db push` cannot order them.
    expect(versions.filter((v) => v === version)).toHaveLength(1);
  });
});

describe("Prisma mirrors users.auth_user_id", () => {
  it("does not declare the auth schema or model auth.users", () => {
    // Regression guard for the drift gate (prisma:drift / prisma:drift:scoped).
    // Declaring `schemas = ["public", "auth"]` silences P4002 but makes Prisma
    // treat Supabase's auth.users as owned by this repository, so `migrate diff`
    // proposes ALTERing it and the scoped checker sees `users` twice (auth.users
    // and public.users both @@map("users")). The FK is therefore omitted instead.
    expect(prisma).not.toMatch(/schemas\s*=\s*\[[^\]]*"auth"/);
    expect(prisma).not.toMatch(/@@schema\("auth"\)/);
  });

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
