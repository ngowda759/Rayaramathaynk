-- Seva Entry, Phase 1 - orders, receipts, lines, day close and devotee profiles, with their guard triggers.
-- Spec: docs/seva/DESIGN-BOOK.md 7.4 and 7.5. Depends on 20261020000000_seva_core.sql.
-- Same rules as the core file: additive, idempotent, Postgres 15, deny-all RLS, service role only.
--
-- What never changes after issue (DB 7.4, 8.5): an order and its lines are immutable; a receipt keeps its
-- number, parts, seva date, total, QR token and issue fields for ever; it can only move from issued to
-- cancelled (with a reason), and it is never deleted. Mistakes are cancellations that keep their number.

-- =====================================================================================================
-- 1. Receipt guard
-- =====================================================================================================

CREATE OR REPLACE FUNCTION seva_receipts_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_col text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'seva guard: receipts are never deleted; cancel with a reason instead'
      USING ERRCODE = 'restrict_violation';
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  FOREACH v_col IN ARRAY ARRAY[
    'id', 'receipt_no', 'series_code', 'year', 'month', 'running_no', 'staff_no', 'order_id', 'position',
    'client_receipt_id', 'seva_date', 'business_date', 'total', 'replaces_receipt_id', 'qr_token',
    'issued_at', 'issued_by_staff_id', 'issued_by_name', 'issued_offline', 'has_changed_amount', 'test_mode',
    'created_at'
  ] LOOP
    IF (v_new -> v_col) IS DISTINCT FROM (v_old -> v_col) THEN
      RAISE EXCEPTION 'seva guard: seva_receipts.% never changes after issue', v_col
        USING ERRCODE = 'restrict_violation';
    END IF;
  END LOOP;

  IF OLD.status = 'cancelled' THEN
    IF NEW.status IS DISTINCT FROM 'cancelled' THEN
      RAISE EXCEPTION 'seva guard: a cancelled receipt stays cancelled'
        USING ERRCODE = 'restrict_violation';
    END IF;
    FOREACH v_col IN ARRAY ARRAY['cancel_reason_code', 'cancel_note', 'cancelled_at', 'cancelled_by_staff_id'] LOOP
      IF (v_new -> v_col) IS DISTINCT FROM (v_old -> v_col) THEN
        RAISE EXCEPTION 'seva guard: seva_receipts.% is fixed once the receipt is cancelled', v_col
          USING ERRCODE = 'restrict_violation';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================================================================
-- 2. Orders, receipts and lines (DB 7.4)
-- =====================================================================================================

-- One payment, one devotee, 1..31 receipts (one per seva date). payment_order_id gets its foreign key to
-- payment_orders in the Phase 2 payments migration.
CREATE TABLE IF NOT EXISTS seva_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_no text NOT NULL UNIQUE,
  client_order_id uuid NOT NULL UNIQUE,
  channel text NOT NULL CHECK (channel IN ('counter', 'web', 'app')),
  counter_id smallint REFERENCES counters (id) ON DELETE RESTRICT,
  device_id uuid REFERENCES counter_devices (id) ON DELETE RESTRICT,
  issued_by_staff_id uuid REFERENCES staff (id) ON DELETE RESTRICT,
  devotee_uid text,
  devotee_name text NOT NULL CHECK (char_length(devotee_name) BETWEEN 1 AND 80 AND btrim(devotee_name) <> ''),
  gotra text CHECK (char_length(gotra) <= 60),
  gotra_id smallint CHECK (gotra_id >= 0),
  nakshatra_id smallint CHECK (nakshatra_id BETWEEN 1 AND 27),
  nakshatra_text text,
  rashi_id smallint CHECK (rashi_id BETWEEN 1 AND 12),
  rashi_text text,
  phone_e164 text CHECK (phone_e164 ~ '^\+91[6-9][0-9]{9}$'),
  receipts_count smallint NOT NULL CHECK (receipts_count BETWEEN 1 AND 31),
  amount_total numeric(12,2) NOT NULL CHECK (amount_total > 0),
  payment_mode text NOT NULL CHECK (payment_mode IN ('cash', 'upi', 'online')),
  cash_received numeric(12,2),
  change_returned numeric(12,2),
  upi_ref_last6 char(6) CHECK (upi_ref_last6 ~ '^[0-9]{6}$'),
  upi_seen_confirmed boolean,
  payment_order_id uuid,
  issued_offline boolean NOT NULL DEFAULT false,
  supersedes_order_id uuid REFERENCES seva_orders (id) ON DELETE RESTRICT,
  test_mode boolean NOT NULL DEFAULT false,
  issued_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seva_orders_counter_fields
    CHECK (channel <> 'counter' OR (counter_id IS NOT NULL AND issued_by_staff_id IS NOT NULL)),
  CONSTRAINT seva_orders_cash_received CHECK (cash_received IS NULL OR cash_received >= amount_total),
  CONSTRAINT seva_orders_change_returned
    CHECK (
      (cash_received IS NULL AND change_returned IS NULL)
      OR (cash_received IS NOT NULL AND change_returned = cash_received - amount_total)
    ),
  CONSTRAINT seva_orders_upi_details
    CHECK (payment_mode <> 'upi' OR (upi_ref_last6 IS NOT NULL AND upi_seen_confirmed IS TRUE)),
  CONSTRAINT seva_orders_online_payment CHECK (payment_mode <> 'online' OR payment_order_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_seva_orders_counter_issued ON seva_orders (counter_id, issued_at);
CREATE INDEX IF NOT EXISTS idx_seva_orders_devotee_created
  ON seva_orders (devotee_uid, created_at DESC) WHERE devotee_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seva_orders_phone ON seva_orders (phone_e164);

CREATE OR REPLACE TRIGGER seva_orders_immutable
  BEFORE UPDATE OR DELETE ON seva_orders
  FOR EACH ROW EXECUTE FUNCTION seva_forbid_change();

CREATE OR REPLACE TRIGGER seva_orders_no_truncate
  BEFORE TRUNCATE ON seva_orders
  FOR EACH STATEMENT EXECUTE FUNCTION seva_forbid_change();

CREATE TABLE IF NOT EXISTS seva_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no text NOT NULL UNIQUE
    CHECK (receipt_no ~ '^((C|OF)[0-9]{1,2}-[0-9]{3}|(W|WT)-(WEB|APP))-[0-9]{2}-[0-9]{4}/[0-9]{6}$'),
  series_code text NOT NULL REFERENCES receipt_series (code) ON DELETE RESTRICT,
  year smallint NOT NULL CHECK (year BETWEEN 2026 AND 2100),
  month smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  running_no integer NOT NULL CHECK (running_no BETWEEN 1 AND 999999),
  staff_no smallint CHECK (staff_no BETWEEN 1 AND 999),
  order_id uuid NOT NULL REFERENCES seva_orders (id) ON DELETE RESTRICT,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 31),
  client_receipt_id uuid NOT NULL UNIQUE,
  seva_date date NOT NULL,
  business_date date NOT NULL,
  total numeric(12,2) NOT NULL CHECK (total > 0),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  cancel_reason_code text CHECK (cancel_reason_code IN (
    'wrong_seva', 'wrong_date', 'wrong_amount', 'wrong_devotee', 'changed_mind', 'entered_twice',
    'spoiled_print', 'other', 'not_printed_connection_lost', 'refunded'
  )),
  cancel_note text,
  cancelled_at timestamptz,
  cancelled_by_staff_id uuid REFERENCES staff (id) ON DELETE RESTRICT,
  refund_state text NOT NULL DEFAULT 'none' CHECK (refund_state IN ('none', 'due', 'processing', 'done', 'failed')),
  refund_note text,
  replaces_receipt_id uuid REFERENCES seva_receipts (id) ON DELETE RESTRICT,
  qr_token text NOT NULL UNIQUE CHECK (qr_token ~ '^[A-Za-z0-9_-]{22}$'),
  prasadam_state text NOT NULL DEFAULT 'none' CHECK (prasadam_state IN ('none', 'pending', 'given')),
  prasadam_given_at timestamptz,
  prasadam_given_by_staff_id uuid REFERENCES staff (id) ON DELETE RESTRICT,
  prasadam_off_date text CHECK (prasadam_off_date IN ('before', 'after')),
  print_count smallint NOT NULL DEFAULT 0 CHECK (print_count >= 0),
  first_printed_at timestamptz,
  last_printed_at timestamptz,
  issued_at timestamptz NOT NULL,
  issued_by_staff_id uuid REFERENCES staff (id) ON DELETE RESTRICT,
  issued_by_name text,
  issued_offline boolean NOT NULL DEFAULT false,
  has_changed_amount boolean NOT NULL DEFAULT false,
  test_mode boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seva_receipts_series_running_key UNIQUE (series_code, year, running_no),
  -- The formatted number always agrees with its stored parts (DB 8.1).
  CONSTRAINT seva_receipts_number_matches_parts
    CHECK (
      receipt_no = series_code || '-'
        || CASE WHEN staff_no IS NOT NULL THEN lpad(staff_no::text, 3, '0') ELSE split_part(receipt_no, '-', 2) END
        || '-' || lpad(month::text, 2, '0') || '-' || year::text || '/' || lpad(running_no::text, 6, '0')
    ),
  -- C/OF numbers carry the issuer's staff number; W/WT numbers do not.
  CONSTRAINT seva_receipts_staff_no_by_series CHECK ((staff_no IS NULL) = (series_code IN ('W', 'WT'))),
  -- Cancel fields are set together, and only on a cancelled receipt.
  CONSTRAINT seva_receipts_cancel_fields
    CHECK (
      (status = 'issued' AND cancel_reason_code IS NULL AND cancel_note IS NULL
        AND cancelled_at IS NULL AND cancelled_by_staff_id IS NULL)
      OR (status = 'cancelled' AND cancel_reason_code IS NOT NULL
        AND cancelled_at IS NOT NULL AND cancelled_by_staff_id IS NOT NULL)
    ),
  CONSTRAINT seva_receipts_other_needs_note
    CHECK (cancel_reason_code IS DISTINCT FROM 'other' OR coalesce(char_length(btrim(cancel_note)), 0) >= 3),
  CONSTRAINT seva_receipts_prasadam_given_at CHECK (prasadam_state <> 'given' OR prasadam_given_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_seva_receipts_business_date ON seva_receipts (business_date);
CREATE INDEX IF NOT EXISTS idx_seva_receipts_issued_at ON seva_receipts (issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_seva_receipts_order ON seva_receipts (order_id);
CREATE INDEX IF NOT EXISTS idx_seva_receipts_status_business_date ON seva_receipts (status, business_date);
CREATE INDEX IF NOT EXISTS idx_seva_receipts_prasadam_pending
  ON seva_receipts (seva_date) WHERE status = 'issued' AND prasadam_state = 'pending';
CREATE INDEX IF NOT EXISTS idx_seva_receipts_issuer_issued ON seva_receipts (issued_by_staff_id, issued_at);
CREATE INDEX IF NOT EXISTS idx_seva_receipts_changed_amount
  ON seva_receipts (has_changed_amount) WHERE has_changed_amount;

CREATE OR REPLACE TRIGGER update_seva_receipts_updated_at
  BEFORE UPDATE ON seva_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER seva_receipts_guard
  BEFORE UPDATE OR DELETE ON seva_receipts
  FOR EACH ROW EXECUTE FUNCTION seva_receipts_guard();

CREATE OR REPLACE TRIGGER seva_receipts_no_truncate
  BEFORE TRUNCATE ON seva_receipts
  FOR EACH STATEMENT EXECUTE FUNCTION seva_forbid_change();

CREATE TABLE IF NOT EXISTS seva_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES seva_receipts (id) ON DELETE RESTRICT,
  line_no smallint NOT NULL CHECK (line_no BETWEEN 1 AND 8),
  seva_id uuid NOT NULL REFERENCES sevas (id) ON DELETE RESTRICT,
  seva_code text,
  seva_name_en text NOT NULL,
  seva_name_kn text,
  quantity smallint NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  catalogue_rate numeric(10,2),
  unit_rate numeric(10,2) NOT NULL CHECK (unit_rate > 0),
  amount numeric(12,2) NOT NULL,
  amount_changed boolean GENERATED ALWAYS AS (catalogue_rate IS NOT NULL AND unit_rate <> catalogue_rate) STORED,
  change_reason text,
  prasadam_items text,
  CONSTRAINT seva_receipt_lines_receipt_line_key UNIQUE (receipt_id, line_no),
  CONSTRAINT seva_receipt_lines_amount CHECK (amount = quantity * unit_rate),
  -- A changed amount (unit rate differs from the catalogue rate) needs a reason of at least 3 characters.
  CONSTRAINT seva_receipt_lines_change_reason
    CHECK (
      catalogue_rate IS NULL OR unit_rate = catalogue_rate
      OR coalesce(char_length(btrim(change_reason)), 0) >= 3
    )
);

CREATE INDEX IF NOT EXISTS idx_seva_receipt_lines_receipt ON seva_receipt_lines (receipt_id);
CREATE INDEX IF NOT EXISTS idx_seva_receipt_lines_seva ON seva_receipt_lines (seva_id);

CREATE OR REPLACE TRIGGER seva_receipt_lines_immutable
  BEFORE UPDATE OR DELETE ON seva_receipt_lines
  FOR EACH ROW EXECUTE FUNCTION seva_forbid_change();

CREATE OR REPLACE TRIGGER seva_receipt_lines_no_truncate
  BEFORE TRUNCATE ON seva_receipt_lines
  FOR EACH STATEMENT EXECUTE FUNCTION seva_forbid_change();

-- =====================================================================================================
-- 3. Day close and devotees (DB 7.5)
-- =====================================================================================================

CREATE TABLE IF NOT EXISTS day_closes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counter_id smallint NOT NULL REFERENCES counters (id) ON DELETE RESTRICT,
  business_date date NOT NULL,
  status text NOT NULL DEFAULT 'closed' CHECK (status IN ('closed', 'reopened')),
  opening_float numeric(12,2) NOT NULL DEFAULT 0 CHECK (opening_float >= 0),
  receipts_count integer NOT NULL DEFAULT 0 CHECK (receipts_count >= 0),
  cancelled_count integer NOT NULL DEFAULT 0 CHECK (cancelled_count >= 0),
  changed_count integer NOT NULL DEFAULT 0 CHECK (changed_count >= 0),
  cash_expected numeric(12,2) NOT NULL,
  cash_counted numeric(12,2) NOT NULL CHECK (cash_counted >= 0),
  cash_difference numeric(12,2) GENERATED ALWAYS AS (cash_counted - cash_expected) STORED,
  upi_count integer NOT NULL DEFAULT 0 CHECK (upi_count >= 0),
  upi_expected numeric(12,2) NOT NULL DEFAULT 0,
  upi_bank_total numeric(12,2),
  upi_difference numeric(12,2) GENERATED ALWAYS AS (coalesce(upi_bank_total, upi_expected) - upi_expected) STORED,
  series_ranges jsonb NOT NULL,
  outbox_pending integer NOT NULL CHECK (outbox_pending >= 0),
  note text,
  closed_by_staff_id uuid NOT NULL REFERENCES staff (id) ON DELETE RESTRICT,
  closed_at timestamptz NOT NULL,
  reopened_by_staff_id uuid REFERENCES staff (id) ON DELETE RESTRICT,
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT day_closes_counter_date_key UNIQUE (counter_id, business_date),
  -- Nothing may be waiting in the counter's outbox when a day is closed (C-24).
  CONSTRAINT day_closes_outbox_empty CHECK (status <> 'closed' OR outbox_pending = 0),
  -- A cash or UPI difference needs a note of at least 3 characters (D23).
  CONSTRAINT day_closes_difference_note
    CHECK (
      (cash_counted = cash_expected AND (upi_bank_total IS NULL OR upi_bank_total = upi_expected))
      OR coalesce(char_length(btrim(note)), 0) >= 3
    ),
  CONSTRAINT day_closes_reopen_reason
    CHECK (
      status <> 'reopened'
      OR (reopened_at IS NOT NULL AND reopened_by_staff_id IS NOT NULL AND coalesce(btrim(reopen_reason), '') <> '')
    )
);

CREATE OR REPLACE TRIGGER update_day_closes_updated_at
  BEFORE UPDATE ON day_closes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- A day close is a cash record: it is never deleted (a reopen keeps the row), so its counted notes and coins in
-- day_close_counts are protected from loss through ON DELETE CASCADE from day_closes. They are not frozen: a re-close
-- after a reopen replaces them by design, and day_close_counts itself carries no delete guard.
CREATE OR REPLACE TRIGGER seva_day_closes_no_delete
  BEFORE DELETE ON day_closes
  FOR EACH ROW EXECUTE FUNCTION seva_forbid_change();

CREATE OR REPLACE TRIGGER seva_day_closes_no_truncate
  BEFORE TRUNCATE ON day_closes
  FOR EACH STATEMENT EXECUTE FUNCTION seva_forbid_change();

-- Counted notes and coins; values are snapshots, so later denomination changes never alter old closes.
CREATE TABLE IF NOT EXISTS day_close_counts (
  day_close_id uuid NOT NULL REFERENCES day_closes (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('note', 'coin')),
  value numeric(8,2) NOT NULL CHECK (value > 0),
  count integer NOT NULL CHECK (count BETWEEN 0 AND 100000),
  amount numeric(12,2) GENERATED ALWAYS AS (value * count) STORED,
  PRIMARY KEY (day_close_id, kind, value)
);

-- Returning-devotee fill (C-32): written only by the issue functions, only when a phone is given.
CREATE TABLE IF NOT EXISTS devotee_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL UNIQUE CHECK (phone_e164 ~ '^\+91[6-9][0-9]{9}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80 AND btrim(name) <> ''),
  gotra text CHECK (char_length(gotra) <= 60),
  gotra_id smallint CHECK (gotra_id >= 0),
  nakshatra_id smallint CHECK (nakshatra_id BETWEEN 1 AND 27),
  nakshatra_text text,
  rashi_id smallint CHECK (rashi_id BETWEEN 1 AND 12),
  rashi_text text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  visit_count integer NOT NULL DEFAULT 1 CHECK (visit_count >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devotee_profiles_name_prefix ON devotee_profiles (lower(name) text_pattern_ops);

CREATE OR REPLACE TRIGGER update_devotee_profiles_updated_at
  BEFORE UPDATE ON devotee_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================================
-- 4. Row level security: deny all to the public roles (the service role bypasses RLS)
-- =====================================================================================================

ALTER TABLE seva_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE seva_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE seva_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_close_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE devotee_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all public access to seva_orders" ON seva_orders;
CREATE POLICY "Deny all public access to seva_orders" ON seva_orders
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to seva_receipts" ON seva_receipts;
CREATE POLICY "Deny all public access to seva_receipts" ON seva_receipts
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to seva_receipt_lines" ON seva_receipt_lines;
CREATE POLICY "Deny all public access to seva_receipt_lines" ON seva_receipt_lines
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to day_closes" ON day_closes;
CREATE POLICY "Deny all public access to day_closes" ON day_closes
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to day_close_counts" ON day_close_counts;
CREATE POLICY "Deny all public access to day_close_counts" ON day_close_counts
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to devotee_profiles" ON devotee_profiles;
CREATE POLICY "Deny all public access to devotee_profiles" ON devotee_profiles
  FOR ALL TO public USING (false) WITH CHECK (false);

REVOKE ALL ON seva_orders FROM anon, authenticated;
REVOKE ALL ON seva_receipts FROM anon, authenticated;
REVOKE ALL ON seva_receipt_lines FROM anon, authenticated;
REVOKE ALL ON day_closes FROM anon, authenticated;
REVOKE ALL ON day_close_counts FROM anon, authenticated;
REVOKE ALL ON devotee_profiles FROM anon, authenticated;

-- =====================================================================================================
-- 5. Function privileges: service_role only
-- =====================================================================================================

REVOKE EXECUTE ON FUNCTION seva_receipts_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_receipts_guard() TO service_role;
