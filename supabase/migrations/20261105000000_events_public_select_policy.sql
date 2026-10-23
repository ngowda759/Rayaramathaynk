-- Migration: allow anonymous read of *published* events.
--
-- Why this exists
-- ---------------
-- `events` is deny-all under RLS
-- (`20260907112632_create_core_tables.sql:81,98-102`): a single
-- `FOR ALL TO public USING (false)` policy. No later migration adds a SELECT
-- policy. Every client-side reader that uses the anon key therefore receives an
-- empty result *and* no error it can distinguish from "no rows" — which is why
-- `services/event.service.ts` `getEvents()` caught the denial and returned `[]`,
-- leaving the public events list and the homepage upcoming-events strip blank.
--
-- The readers are intentionally split by authorisation need (see
-- `docs/PR-D4c_READER_CUTOVER.md` §3.2):
--
--   * the public list and homepage read published rows with the anon key and rely
--     on this policy;
--   * the admin list needs unpublished rows, which anon must never see, so it
--     reads through a server route using the service-role client instead. This
--     migration deliberately does **not** grant that access to anon.
--
-- Scope of the grant
-- ------------------
-- SELECT only, to `anon` and `authenticated`, and only rows with
-- `published = true`. It is not `FOR ALL`, so no client can INSERT/UPDATE/DELETE.
-- It is not a draft-leaking policy: `published = false` rows stay invisible to
-- every non-service role, so an unpublished event cannot be enumerated.
--
-- Additive and idempotent: it creates one policy and changes nothing else. It
-- does not enable the Aaradhane writer, does not backfill, and does not touch any
-- other table. `aaradhanes` (deny-all, `20261001000000_create_content_tables.sql:196`)
-- is a separate table and is deliberately left alone.
--
-- Status: prepared, NOT applied. Applying it is an owner action, gated on the
-- cutover review. Until it is applied the readers stay on the empty-store
-- behaviour; the accompanying tests assert the policy text, not a live database.

DROP POLICY IF EXISTS "Allow public read of published events" ON events;

CREATE POLICY "Allow public read of published events"
    ON events
    FOR SELECT
    TO anon, authenticated
    USING (published = true);
