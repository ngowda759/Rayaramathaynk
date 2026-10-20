-- Migration: Link public.users to Supabase Auth identities for Raya AI administration.
--
-- Additive and non-destructive: no table, column or row is dropped or rewritten.
-- `auth_user_id` is the Supabase Auth user id (auth.users.id) that owns this
-- authorization row. It is NULL for rows that only have the legacy
-- `firestore_id` provenance key, so existing data and the Firebase-based admin
-- path are unaffected.
--
-- Authorization stays keyed off `role` and `active` on this row. Nothing here
-- grants a role; the operator bootstrap script is the only writer of
-- `auth_user_id`/`role`, and it needs the service-role key.
--
-- This migration must sort AFTER every migration already applied in production
-- (currently 20261102000300_seva_final_touches). `supabase db push` refuses an
-- out-of-order file without --include-all, so an older version prefix would make
-- the reviewed push fail.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- One authorization row per Supabase Auth identity. A partial unique index is
-- used (rather than a bare UNIQUE constraint) so the many legacy rows with a
-- NULL auth_user_id do not collide. This index is the integrity control that
-- makes role resolution unambiguous for a given Auth identity.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id
    ON users (auth_user_id)
    WHERE auth_user_id IS NOT NULL;

-- Deliberately NO foreign key to auth.users.
--
-- A cross-schema FK (public.users -> auth.users) cannot be represented by the
-- Prisma schema this repository uses to verify its baseline: `prisma migrate
-- diff --to-config-datasource`, which backs both `prisma:drift` and
-- `prisma:drift:scoped`, aborts with P4002 ("Cross schema references are only
-- allowed when the target schema is listed in the schemas property") as soon as
-- such a constraint exists in the database. Modelling the auth schema in Prisma
-- instead is not safe: Prisma then treats Supabase's auth.users as owned by this
-- repository and proposes ALTERing it.
--
-- Referential integrity is not weakened by omitting the FK. The guard
-- (lib/auth/raya-admin-auth.ts) resolves the caller from a *verified* Supabase
-- session and then looks up public.users by that session's auth_user_id, so a
-- stored value can only ever be the id of an account that can obtain a session.
-- A stale or orphaned value can never match a session and is therefore inert
-- (fail-closed), and a deleted Auth user cannot obtain a session at all.
