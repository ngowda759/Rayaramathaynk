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

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- One authorization row per Supabase Auth identity. A partial unique index is
-- used (rather than a bare UNIQUE constraint) so the many legacy rows with a
-- NULL auth_user_id do not collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id
    ON users (auth_user_id)
    WHERE auth_user_id IS NOT NULL;

-- Referential integrity to Supabase Auth. Deleting an auth user detaches the
-- authorization row (SET NULL) instead of deleting application data.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_user_id_fkey'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_auth_user_id_fkey
            FOREIGN KEY (auth_user_id)
            REFERENCES auth.users (id)
            ON DELETE SET NULL;
    END IF;
END
$$;
