# Database Rules — Rayaramathaynk

This document establishes the mandatory data architecture standards, migration rules, and governance policies for database operations in this repository.

---

## 1. Supabase PostgreSQL is the Target Database
* **Primary Authority:** Supabase PostgreSQL is the single target database for all production data.
* **Migration Location:** Authoritative schema migrations reside in `supabase/migrations/` as sequentially timestamped SQL files (e.g., `YYYYMMDDHHMMSS_name.sql`).
* **Multi-Row Operations & Transactions:** Critical transactional business logic (receipt numbering, order creation, day-close calculations, audit tracking) must be implemented as PostgreSQL functions / RPCs called through `lib/seva/server/rpc.ts`.

---

## 2. Prisma & Supabase Migration Coexistence
* **Dual Tooling Strategy:**
  * Raw SQL migrations in `supabase/migrations/` own and define the live database schema, indexes, functions, triggers, and Row Level Security (RLS) policies.
  * Prisma 7 (`prisma/schema.prisma`) is a **typed mirror**, currently scoped to specific domains (Raya AI and User authorization).
* **Do Not Treat Prisma as the Solo Authority:** Never execute `prisma migrate dev` directly against a shared or production database without prior drift analysis.
* **Prisma Driver Adapter:** Prisma connects using `@prisma/adapter-pg` over native `pg`, reading credentials via `prisma.config.ts`.

---

## 3. Schema Inspection & Duplicate Prevention
* **Inspect Before Modifying:** Always inspect existing tables, columns, indexes, and SQL migrations before proposing schema alterations.
* **No Duplicate Objects:** Never create duplicate tables, views, RLS policies, or stored functions that overlap with existing definitions.
* **Check Scope:** Check `lib/supabase/migration-inventory.ts` and `prisma/schema.prisma` to confirm whether an entity is already mapped.

---

## 4. Strict Firestore Freeze (No New Firestore)
* **Zero New Firestore Dependencies:** Under no circumstances should new features, routes, or models add reads or writes to Firebase Firestore.
* **Zero New Firestore Fallbacks:** Do not add fallback reads to Firestore for new services.
* **Prefer Supabase for All New Work:** All new features must store data directly in Supabase PostgreSQL.
* **Treat Firestore as Legacy / Transitional:** Existing Firestore reads are strictly transitional. Touch Firestore code only when actively migrating a collection to Supabase or maintaining existing backward-compatible readers.

---

## 5. Migration & Drift Verification Controls
* **Drift Verification:**
  * Validate that `prisma/schema.prisma` does not drift from Supabase DDL using:
    ```bash
    npm run prisma:drift:scoped
    ```
  * In CI, this is verified automatically via `.github/workflows/prisma-baseline-drift-gate.yml`.
* **Credential-Free In-Process DB Testing:**
  * Test new or modified SQL migrations using the in-process PGlite PostgreSQL runner:
    ```bash
    npm run test:db
    ```
  * This runs all migrations in `supabase/migrations/` sequentially inside WebAssembly Postgres, ensuring DDL syntax and constraint validity without needing live database credentials.

---

## 6. Row Level Security & Access Control
* **Fail-Closed Principle:** RLS must be enabled on every table (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
* **Service Role Access:** Server-side route handlers use `createAdminClient()` from `lib/supabase/admin.ts` (protected by `import "server-only"`), bypassing RLS only after application-layer authentication and authorization checks.
* **Least Privilege:** Public/anon access must be restricted to explicit, read-only SELECT policies where intended for unauthenticated consumption (e.g. public event calendars).

---

## 7. Production Data Protection
* **No Unapproved Production Modifies:** Never execute DDL or DML against production databases without explicit user authorization and a verifiable rollback plan.
* **Use Backed-Up Environments:** Test data manipulations against local PGlite, local Docker Supabase, or verified test instances first.
