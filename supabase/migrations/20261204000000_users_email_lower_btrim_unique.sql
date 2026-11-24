-- N-05: case-insensitive, whitespace-trimmed uniqueness for public.users.email.
-- `email` is NOT NULL (20261001000000_create_content_tables.sql), so NULL handling is not required.
-- lower(btrim(email)) matches the application's trim().toLowerCase() comparison semantics.
-- Additive only: no data is changed and no column/constraint is removed.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_btrim_key
  ON public.users (lower(btrim(email)));
