-- Seva Entry, Phase 1 - privilege hardening for the guarded seva tables (security review after Wave A1).
--
-- Why: a role holding TRIGGER on a table can add its own trigger there. On audit_log, the service role could add a
-- BEFORE INSERT trigger named to fire after audit_log_strip_phones and write a phone number back into before/after;
-- on the other guarded tables, a trigger firing after a guard could change NEW once the guard has checked it.
-- REFERENCES lets a role tie these tables to objects of its own. The app never needs either privilege: the service
-- role reads and writes through the seva functions and plain SELECT/INSERT/UPDATE, and migrations run as the owner.
--
-- Additive and idempotent (REVOKE of a privilege not held is a no-op). Postgres 15. Sorts after every A2 migration.
-- Covers audit_log and every seva table that carries guard triggers (staff, seva_rate_history, seva_orders,
-- seva_receipts, seva_receipt_lines, day_closes).

REVOKE TRIGGER, REFERENCES ON TABLE
  audit_log,
  staff,
  seva_rate_history,
  seva_orders,
  seva_receipts,
  seva_receipt_lines,
  day_closes
FROM service_role, anon, authenticated;
