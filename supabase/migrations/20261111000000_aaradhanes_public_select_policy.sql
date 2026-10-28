-- Migration: allow anonymous read of the public Aaradhane records.
--
-- Why this exists
-- ---------------
-- `aaradhanes` is deny-all under RLS
-- (`20261001000000_create_content_tables.sql:196`): a single
-- `FOR ALL TO public USING (false)` policy. `services/aaradhane.service.ts` used to
-- read the Firestore `aaradhane`/`aaradhanes` collections; it now reads this table.
-- With no SELECT policy every anon-key read returns an empty set and no error it can
-- distinguish from "no rows", which would leave the public `/aaradhane` page blank.
--
-- Aaradhane records are published temple content (festival dates, rituals,
-- significance) shown on the public site, exactly like `announcements` and the
-- published `events` rows, so anonymous SELECT is appropriate.
--
-- Scope of the grant
-- ------------------
-- SELECT only, to `anon` and `authenticated`. It is not `FOR ALL`, so no client can
-- INSERT/UPDATE/DELETE. Admin writes go through the service-role client in
-- `services/aaradhane.service.ts`, which bypasses RLS and is unaffected.
--
-- Additive and idempotent: it creates one policy and changes nothing else.

DROP POLICY IF EXISTS "Allow public read of aaradhanes" ON aaradhanes;

CREATE POLICY "Allow public read of aaradhanes"
    ON aaradhanes
    FOR SELECT
    TO anon, authenticated
    USING (true);
