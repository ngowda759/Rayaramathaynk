-- Seva Entry - the receipt paper size is never null (A4S security gate, L-2, 2026-10-20).
--
-- Additive: 20261031000000_seva_paper_size.sql is already applied on the owner's test project and is frozen, so this
-- new file closes the gap its CHECK left (`paper_size IS NULL OR ...`). The API cannot send a null and every reader
-- falls back to A5, so this is defence in depth: no null can reach the row or the settings audit trail.
-- Safe to run more than once. Postgres 15 syntax only.

UPDATE seva_settings SET paper_size = 'a5' WHERE paper_size IS NULL;

ALTER TABLE seva_settings ALTER COLUMN paper_size SET DEFAULT 'a5';
ALTER TABLE seva_settings ALTER COLUMN paper_size SET NOT NULL;
