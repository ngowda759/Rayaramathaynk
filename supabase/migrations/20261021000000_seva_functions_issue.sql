-- Seva Entry, Phase 1 - SQL functions for issuing counter receipts, storing offline orders, recording prints,
-- cancelling with a reason and the spoiled-print reissue (plan Task A2-1).
-- Spec: docs/seva/DESIGN-BOOK.md 7.8 (signatures), 8.2 (online numbers), 8.3 (offline numbers), 8.4 (retired PC),
-- 8.6 (in-doubt save), 9.4 (changed amount), 9.5 (payment), 9.8 (print, reprint, spoiled), 9.9 (cancel).
-- Depends on 20261020000000_seva_core.sql and 20261020000100_seva_receipts.sql.
--
-- Rules for this file (DB 7.0 and the plan's global constraints):
--   * Idempotent: CREATE OR REPLACE FUNCTION, safe to run twice. The only drops are DROP FUNCTION IF EXISTS of a
--     signature this branch replaced, so a call with the old arguments can never reach an older body. No table is
--     dropped or altered.
--   * Postgres 15: no MERGE ... RETURNING, ANY_VALUE, JSON_TABLE, SQL/JSON constructors or pg_input_is_valid.
--   * Every function: plpgsql, SECURITY INVOKER, search_path pinned, EXECUTE for service_role only.
--   * Each public function runs as one transaction: any error rolls every row and every number back together, so a
--     receipt number is never burned. No dynamic SQL. The time is read once through now(); IST year, month and
--     business date only through seva_ist_parts().
--   * Business errors: RAISE EXCEPTION 'SEVA:<code>' USING DETAIL = '<json>' (codes in lib/seva/errors.ts).
--   * Money is rupees: numeric(10,2) per unit rate, numeric(12,2) per line and total; returned as strings ('820.00').
--   * Any-amount sevas (Other Seva / Karnike) are stored as amount 0.00 with any_amount = true: they are told by the
--     any_amount flag, never by the amount.
--   * The devotee phone is never returned and never written to the audit trail (C-16, C-31).
--   * Functions named seva_issue_* are helpers of the functions in this file.

-- =====================================================================================================
-- 1. Input helpers: one JSON value as a typed value, or SEVA:validation naming the field
-- =====================================================================================================

CREATE OR REPLACE FUNCTION seva_issue_arg_uuid(p_text text, p_field text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', p_field)::text;
  END IF;
  RETURN p_text::uuid;
END;
$$;

-- Rupees: digits with at most two decimals ('820', '820.5', '820.00'), never negative.
CREATE OR REPLACE FUNCTION seva_issue_arg_money(p_text text, p_field text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_text !~ '^[0-9]{1,10}(\.[0-9]{1,2})?$' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', p_field)::text;
  END IF;
  RETURN round(p_text::numeric, 2);
END;
$$;

CREATE OR REPLACE FUNCTION seva_issue_arg_int(p_text text, p_field text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_text !~ '^-?[0-9]{1,9}$' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', p_field)::text;
  END IF;
  RETURN p_text::integer;
END;
$$;

-- A calendar date 'YYYY-MM-DD' that really exists (no 30 February).
CREATE OR REPLACE FUNCTION seva_issue_arg_date(p_text text, p_field text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parts text[];
  v_year integer;
  v_month integer;
  v_day integer;
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;
  v_parts := regexp_match(p_text, '^([0-9]{4})-([0-9]{2})-([0-9]{2})$');
  IF v_parts IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', p_field)::text;
  END IF;
  v_year := v_parts[1]::integer;
  v_month := v_parts[2]::integer;
  v_day := v_parts[3]::integer;
  IF v_year NOT BETWEEN 2000 AND 2200
     OR v_month NOT BETWEEN 1 AND 12
     OR v_day < 1
     OR v_day > date_part('day', make_date(v_year, v_month, 1) + interval '1 month' - interval '1 day')::integer THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', p_field)::text;
  END IF;
  RETURN make_date(v_year, v_month, v_day);
END;
$$;

-- An ISO-8601 instant with its zone ('2026-10-18T05:00:00.000Z', '2026-10-18T10:30:00+05:30').
CREATE OR REPLACE FUNCTION seva_issue_arg_ts(p_text text, p_field text)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_at timestamptz;
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}(:?[0-9]{2})?)$' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', p_field)::text;
  END IF;
  BEGIN
    v_at := p_text::timestamptz;
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', p_field)::text;
  END;
  RETURN v_at;
END;
$$;

-- Trimmed text; blank is "not given" (NULL); longer than p_max characters is refused.
CREATE OR REPLACE FUNCTION seva_issue_arg_text(p_text text, p_field text, p_max integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
BEGIN
  IF v_text IS NOT NULL AND char_length(v_text) > p_max THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', p_field)::text;
  END IF;
  RETURN v_text;
END;
$$;

-- =====================================================================================================
-- 2. Who and where: the staff member, the counter PC, its series and its day
-- =====================================================================================================

-- The staff member making the call must exist and be active (SEVA:staff_inactive).
CREATE OR REPLACE FUNCTION seva_issue_staff(p_staff_id uuid)
RETURNS staff
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_staff staff%ROWTYPE;
BEGIN
  SELECT s.* INTO v_staff FROM staff s WHERE s.id = p_staff_id;
  IF NOT FOUND OR v_staff.status <> 'active' THEN
    RAISE EXCEPTION 'SEVA:staff_inactive' USING DETAIL = '{}';
  END IF;
  RETURN v_staff;
END;
$$;

-- The person who made an offline order or an offline cancel on the PC, named by the staff number the outbox item
-- carries (an order's issuer_staff_no, the one inside its OF numbers; a cancel's cancelled_by_staff_no). Someone else
-- may sync it later. That person must be a staff member who may use the counter (DB 3.3 row 1): a receptionist,
-- temple admin or super admin who is not view-only, whose staff row is active, or inactive because they were
-- offboarded after the work was done on the PC (the caller audits that case). An invited or deleted row is refused.
-- The role is kept in Firestore, not here (DB 3.2), so the route reads it for this staff member and passes it as
-- p_role ('receptionist' | 'prasadam_counter' | 'temple_admin' | 'super_admin'; null when unknown). Anything else is
-- SEVA:validation naming p_field.
DROP FUNCTION IF EXISTS seva_issue_offline_issuer(text, text);
CREATE OR REPLACE FUNCTION seva_issue_offline_issuer(p_staff_no text, p_role text, p_field text)
RETURNS staff
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_no integer;
  v_staff staff%ROWTYPE;
BEGIN
  v_no := seva_issue_arg_int(p_staff_no, p_field);
  IF v_no IS NULL OR v_no NOT BETWEEN 1 AND 999 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', p_field)::text;
  END IF;
  SELECT s.* INTO v_staff FROM staff s WHERE s.staff_no = v_no;
  IF NOT FOUND OR v_staff.status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', p_field, 'reason', 'not an active or offboarded staff member')::text;
  END IF;
  IF v_staff.view_only OR p_role IS NULL OR p_role NOT IN ('receptionist', 'temple_admin', 'super_admin') THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', p_field, 'reason', 'may not use the counter')::text;
  END IF;
  RETURN v_staff;
END;
$$;

-- Sets the transaction setting seva.actor_role, which seva_audit writes as actor_role, and returns the value it had
-- (null when it was never set). An audit row written for someone other than the caller - the issuer of a synced
-- order, the person who cancelled offline - carries that person's role; the caller then puts the old value back.
-- Null p_role leaves actor_role empty.
CREATE OR REPLACE FUNCTION seva_issue_actor_role(p_role text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before text := current_setting('seva.actor_role', true);
BEGIN
  PERFORM set_config('seva.actor_role', coalesce(p_role, ''), true);
  RETURN v_before;
END;
$$;

-- The registered counter PC. It must be live (retired_at is null) unless p_allow_retired: only an offline sync may
-- come from a retired PC, and then only for numbers inside its device_replaced gap (DB 8.4).
CREATE OR REPLACE FUNCTION seva_issue_device(p_device_id uuid, p_allow_retired boolean)
RETURNS counter_devices
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_device counter_devices%ROWTYPE;
BEGIN
  SELECT d.* INTO v_device FROM counter_devices d WHERE d.id = p_device_id;
  IF NOT FOUND OR (v_device.retired_at IS NOT NULL AND NOT coalesce(p_allow_retired, false)) THEN
    RAISE EXCEPTION 'SEVA:device_unknown' USING DETAIL = '{}';
  END IF;
  RETURN v_device;
END;
$$;

-- The counter's active series of one kind: 'counter_online' (C<n>) or 'counter_offline' (OF<n>).
CREATE OR REPLACE FUNCTION seva_issue_counter_series(p_counter_id smallint, p_kind text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
BEGIN
  SELECT rs.code INTO v_code
    FROM receipt_series rs
   WHERE rs.counter_id = p_counter_id AND rs.kind = p_kind AND rs.active;
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'series')::text;
  END IF;
  RETURN v_code;
END;
$$;

-- A counter-day closed in day_closes refuses issuing until a temple admin reopens it (C-24).
CREATE OR REPLACE FUNCTION seva_issue_check_day_open(p_counter_id smallint, p_business_date date)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM day_closes dc
     WHERE dc.counter_id = p_counter_id AND dc.business_date = p_business_date AND dc.status = 'closed'
  ) THEN
    RAISE EXCEPTION 'SEVA:day_closed' USING DETAIL = jsonb_build_object('business_date', p_business_date)::text;
  END IF;
END;
$$;

-- =====================================================================================================
-- 3. Numbers (DB 8.2, C-19)
-- =====================================================================================================

-- Takes p_count consecutive running numbers of a series for an IST calendar year and returns the first. The UPDATE
-- holds the year row's lock until commit, so numbers are never shared and, because a failure rolls the UPDATE back
-- with everything else, never skipped (sequences are not gap-free, R2 s6).
CREATE OR REPLACE FUNCTION seva_take_numbers(p_series text, p_year smallint, p_count int)
RETURNS int
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_last integer;
BEGIN
  IF p_count IS NULL OR p_count NOT BETWEEN 1 AND 999999 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'count')::text;
  END IF;
  IF p_year IS NULL OR p_year NOT BETWEEN 2026 AND 2100 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'year')::text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM receipt_series rs WHERE rs.code = p_series) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'series')::text;
  END IF;

  INSERT INTO receipt_series_years (series_code, year)
  VALUES (p_series, p_year)
  ON CONFLICT (series_code, year) DO NOTHING;

  UPDATE receipt_series_years y
     SET last_no = y.last_no + p_count
   WHERE y.series_code = p_series AND y.year = p_year AND y.last_no + p_count <= 999999
  RETURNING y.last_no INTO v_last;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', 'running_no', 'reason', 'the series has no numbers left this year')::text;
  END IF;
  RETURN v_last - p_count + 1;
END;
$$;

-- Next online group label 'G-YYMM-NNNN' for the IST month of p_issued_at (C-19). Labels, not accounting numbers; past
-- 9999 in a month the number simply grows ('G-2610-10000') rather than being cut.
CREATE OR REPLACE FUNCTION seva_next_group_no(p_issued_at timestamptz)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year smallint;
  v_month smallint;
  v_yymm char(4);
  v_n integer;
BEGIN
  IF p_issued_at IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'issued_at')::text;
  END IF;
  SELECT p.year, p.month INTO v_year, v_month FROM seva_ist_parts(p_issued_at) AS p;
  v_yymm := lpad((v_year % 100)::text, 2, '0') || lpad(v_month::text, 2, '0');

  INSERT INTO group_counters (yymm) VALUES (v_yymm) ON CONFLICT (yymm) DO NOTHING;
  UPDATE group_counters g SET last_no = g.last_no + 1 WHERE g.yymm = v_yymm RETURNING g.last_no INTO v_n;

  RETURN 'G-' || v_yymm || '-' || CASE WHEN v_n < 10000 THEN lpad(v_n::text, 4, '0') ELSE v_n::text END;
END;
$$;

-- =====================================================================================================
-- 4. Order parts: devotee, payment, returning-devotee profile
-- =====================================================================================================

-- The devotee block of p_order, checked and normalised (DB 9.2): name trimmed 1..80 characters in any script; gotra,
-- nakshatra and rashi optional (texts up to 60 characters, ids within their lists); phone optional, +91 mobile only.
CREATE OR REPLACE FUNCTION seva_issue_devotee(p_devotee jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_gotra_id integer;
  v_nakshatra_id integer;
  v_rashi_id integer;
  v_phone text;
BEGIN
  IF p_devotee IS NULL OR jsonb_typeof(p_devotee) <> 'object' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'devotee')::text;
  END IF;

  v_name := btrim(coalesce(p_devotee->>'name', ''));
  IF char_length(v_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'name')::text;
  END IF;

  v_gotra_id := seva_issue_arg_int(p_devotee->>'gotra_id', 'gotra_id');
  IF v_gotra_id IS NOT NULL AND v_gotra_id NOT BETWEEN 0 AND 32767 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'gotra_id')::text;
  END IF;
  v_nakshatra_id := seva_issue_arg_int(p_devotee->>'nakshatra_id', 'nakshatra_id');
  IF v_nakshatra_id IS NOT NULL AND v_nakshatra_id NOT BETWEEN 1 AND 27 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'nakshatra_id')::text;
  END IF;
  v_rashi_id := seva_issue_arg_int(p_devotee->>'rashi_id', 'rashi_id');
  IF v_rashi_id IS NOT NULL AND v_rashi_id NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'rashi_id')::text;
  END IF;

  v_phone := nullif(btrim(coalesce(p_devotee->>'phone_e164', '')), '');
  IF v_phone IS NOT NULL AND v_phone !~ '^\+91[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'phone_e164')::text;
  END IF;

  RETURN jsonb_build_object(
    'name', v_name,
    'gotra', seva_issue_arg_text(p_devotee->>'gotra', 'gotra', 60),
    'gotra_id', v_gotra_id,
    'nakshatra_id', v_nakshatra_id,
    'nakshatra_text', seva_issue_arg_text(p_devotee->>'nakshatra_text', 'nakshatra_text', 60),
    'rashi_id', v_rashi_id,
    'rashi_text', seva_issue_arg_text(p_devotee->>'rashi_text', 'rashi_text', 60),
    'phone_e164', v_phone
  );
END;
$$;

-- The payment block of p_order (DB 9.5, C-33): one mode per order, cash or UPI. Cash received, when typed, must
-- cover the total (SEVA:cash_short) and the change is stored; UPI needs the last 6 digits of the reference and the
-- "I saw the payment succeed" tick (SEVA:upi_details_required).
CREATE OR REPLACE FUNCTION seva_issue_payment(p_payment jsonb, p_total numeric)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mode text;
  v_cash numeric;
  v_ref text;
  v_seen boolean;
BEGIN
  IF p_payment IS NULL OR jsonb_typeof(p_payment) <> 'object' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'payment')::text;
  END IF;
  v_mode := p_payment->>'mode';
  IF v_mode IS NULL OR v_mode NOT IN ('cash', 'upi') THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'payment.mode')::text;
  END IF;

  IF v_mode = 'cash' THEN
    v_cash := seva_issue_arg_money(p_payment->>'cash_received', 'cash_received');
    IF v_cash IS NOT NULL AND v_cash < p_total THEN
      RAISE EXCEPTION 'SEVA:cash_short'
        USING DETAIL = jsonb_build_object('total', p_total::text, 'cash_received', v_cash::text)::text;
    END IF;
    RETURN jsonb_build_object('mode', 'cash', 'cash_received', v_cash, 'change_returned', v_cash - p_total,
                              'upi_ref_last6', NULL, 'upi_seen_confirmed', NULL);
  END IF;

  v_ref := p_payment->>'upi_ref_last6';
  v_seen := CASE WHEN jsonb_typeof(p_payment->'upi_seen_confirmed') = 'boolean'
                 THEN (p_payment->'upi_seen_confirmed')::boolean ELSE false END;
  IF v_ref IS NULL OR v_ref !~ '^[0-9]{6}$' OR NOT v_seen THEN
    RAISE EXCEPTION 'SEVA:upi_details_required' USING DETAIL = '{}';
  END IF;
  RETURN jsonb_build_object('mode', 'upi', 'cash_received', NULL, 'change_returned', NULL,
                            'upi_ref_last6', v_ref, 'upi_seen_confirmed', true);
END;
$$;

-- Returning-devotee profile (C-32), written only when a phone is given: one row per phone, visit_count + 1. Details
-- the counter left empty this time keep their earlier values.
CREATE OR REPLACE FUNCTION seva_issue_save_profile(p_devotee jsonb, p_seen_at timestamptz)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_devotee->>'phone_e164' IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO devotee_profiles AS dp (phone_e164, name, gotra, gotra_id, nakshatra_id, nakshatra_text, rashi_id,
                                      rashi_text, last_seen_at, visit_count)
  VALUES (
    p_devotee->>'phone_e164',
    p_devotee->>'name',
    p_devotee->>'gotra',
    (p_devotee->>'gotra_id')::smallint,
    (p_devotee->>'nakshatra_id')::smallint,
    p_devotee->>'nakshatra_text',
    (p_devotee->>'rashi_id')::smallint,
    p_devotee->>'rashi_text',
    p_seen_at,
    1
  )
  ON CONFLICT (phone_e164) DO UPDATE SET
    name = EXCLUDED.name,
    gotra = CASE WHEN EXCLUDED.gotra IS NOT NULL OR EXCLUDED.gotra_id IS NOT NULL THEN EXCLUDED.gotra ELSE dp.gotra END,
    gotra_id = CASE WHEN EXCLUDED.gotra IS NOT NULL OR EXCLUDED.gotra_id IS NOT NULL
                    THEN EXCLUDED.gotra_id ELSE dp.gotra_id END,
    nakshatra_id = CASE WHEN EXCLUDED.nakshatra_id IS NOT NULL OR EXCLUDED.nakshatra_text IS NOT NULL
                        THEN EXCLUDED.nakshatra_id ELSE dp.nakshatra_id END,
    nakshatra_text = CASE WHEN EXCLUDED.nakshatra_id IS NOT NULL OR EXCLUDED.nakshatra_text IS NOT NULL
                          THEN EXCLUDED.nakshatra_text ELSE dp.nakshatra_text END,
    rashi_id = CASE WHEN EXCLUDED.rashi_id IS NOT NULL OR EXCLUDED.rashi_text IS NOT NULL
                    THEN EXCLUDED.rashi_id ELSE dp.rashi_id END,
    rashi_text = CASE WHEN EXCLUDED.rashi_id IS NOT NULL OR EXCLUDED.rashi_text IS NOT NULL
                      THEN EXCLUDED.rashi_text ELSE dp.rashi_text END,
    last_seen_at = greatest(dp.last_seen_at, EXCLUDED.last_seen_at),
    visit_count = dp.visit_count + 1;
END;
$$;

-- =====================================================================================================
-- 5. Receipt parts: key checks, lines, line audits, gap filling
-- =====================================================================================================

-- p_receipts is the prepared receipt list of one order. Client receipt ids and QR tokens are unique within the order
-- and new to the database; with p_one_per_date, two receipts never share a seva date (one receipt per date, DB 9.3).
CREATE OR REPLACE FUNCTION seva_issue_check_receipt_keys(p_receipts jsonb, p_one_per_date boolean)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer := jsonb_array_length(p_receipts);
BEGIN
  IF p_one_per_date
     AND (SELECT count(DISTINCT x.value->>'seva_date') FROM jsonb_array_elements(p_receipts) AS x(value)) <> v_count THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', 'seva_date', 'reason', 'one receipt per seva date')::text;
  END IF;
  IF (SELECT count(DISTINCT x.value->>'client_receipt_id') FROM jsonb_array_elements(p_receipts) AS x(value)) <> v_count
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_receipts) AS x(value)
         JOIN seva_receipts r ON r.client_receipt_id = (x.value->>'client_receipt_id')::uuid
     ) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'client_receipt_id')::text;
  END IF;
  IF (SELECT count(DISTINCT x.value->>'qr_token') FROM jsonb_array_elements(p_receipts) AS x(value)) <> v_count
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_receipts) AS x(value)
         JOIN seva_receipts r ON r.qr_token = x.value->>'qr_token'
     ) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'qr_token')::text;
  END IF;
END;
$$;

-- Writes a receipt's prepared lines, numbered 1..n in the order given.
CREATE OR REPLACE FUNCTION seva_issue_write_lines(p_receipt_id uuid, p_lines jsonb)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO seva_receipt_lines (receipt_id, line_no, seva_id, seva_code, seva_name_en, seva_name_kn, quantity,
                                  catalogue_rate, unit_rate, amount, change_reason, prasadam_items)
  SELECT p_receipt_id,
         l.ord::smallint,
         (l.value->>'seva_id')::uuid,
         l.value->>'code',
         l.value->>'name_en',
         l.value->>'name_kn',
         (l.value->>'quantity')::smallint,
         (l.value->>'catalogue_rate')::numeric,
         (l.value->>'unit_rate')::numeric,
         (l.value->>'amount')::numeric,
         l.value->>'change_reason',
         l.value->>'prasadam_items'
    FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS l(value, ord);
END;
$$;

-- One audit row receipt.amount_changed per line whose unit rate differs from its catalogue rate (DB 9.4), and, for an
-- offline line, one per cached rate that differs from today's catalogue (C-58) - that second kind records both rates
-- and does not mark the receipt as changed.
CREATE OR REPLACE FUNCTION seva_issue_audit_lines(p_receipt_id uuid, p_receipt_no text, p_lines jsonb, p_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_line record;
BEGIN
  FOR v_line IN
    SELECT l.value AS body, l.ord FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS l(value, ord) ORDER BY l.ord
  LOOP
    IF coalesce((v_line.body->>'changed')::boolean, false) THEN
      PERFORM seva_audit(
        'receipt.amount_changed', 'receipt', p_receipt_id::text, p_receipt_no, v_line.body->>'change_reason',
        jsonb_build_object('line_no', v_line.ord, 'seva_id', v_line.body->'seva_id',
                           'catalogue_rate', v_line.body->>'catalogue_rate'),
        jsonb_build_object('line_no', v_line.ord, 'seva_id', v_line.body->'seva_id',
                           'quantity', (v_line.body->>'quantity')::integer, 'unit_rate', v_line.body->>'unit_rate',
                           'amount', v_line.body->>'amount'),
        p_staff_id
      );
    END IF;
    IF coalesce((v_line.body->>'offline_rate_differs')::boolean, false) THEN
      PERFORM seva_audit(
        'receipt.amount_changed', 'receipt', p_receipt_id::text, p_receipt_no,
        'The offline rate differs from today''s catalogue rate',
        jsonb_build_object('line_no', v_line.ord, 'seva_id', v_line.body->'seva_id',
                           'catalogue_rate', v_line.body->>'today_rate'),
        jsonb_build_object('line_no', v_line.ord, 'seva_id', v_line.body->'seva_id',
                           'offline_rate', v_line.body->>'catalogue_rate', 'unit_rate', v_line.body->>'unit_rate'),
        p_staff_id
      );
    END IF;
  END LOOP;
END;
$$;

-- A late offline number p_no arrived inside open gap p_gap_id (DB 8.3): the gap shrinks from either end or splits in
-- two; a gap whose last missing number arrives becomes received_late with its resolution note (every gap that is no
-- longer open carries a note).
CREATE OR REPLACE FUNCTION seva_issue_fill_gap(p_gap_id bigint, p_no integer, p_at timestamptz)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gap receipt_number_gaps%ROWTYPE;
BEGIN
  SELECT g.* INTO v_gap FROM receipt_number_gaps g WHERE g.id = p_gap_id FOR UPDATE;
  IF NOT FOUND OR v_gap.status <> 'open' OR p_no NOT BETWEEN v_gap.from_no AND v_gap.to_no THEN
    RAISE EXCEPTION 'SEVA:number_conflict' USING DETAIL = jsonb_build_object('running_no', p_no)::text;
  END IF;

  IF v_gap.from_no = v_gap.to_no THEN
    UPDATE receipt_number_gaps g
       SET status = 'received_late', resolved_at = p_at, resolution_note = 'Arrived in a later sync'
     WHERE g.id = p_gap_id;
  ELSIF p_no = v_gap.from_no THEN
    UPDATE receipt_number_gaps g SET from_no = p_no + 1 WHERE g.id = p_gap_id;
  ELSIF p_no = v_gap.to_no THEN
    UPDATE receipt_number_gaps g SET to_no = p_no - 1 WHERE g.id = p_gap_id;
  ELSE
    UPDATE receipt_number_gaps g SET to_no = p_no - 1 WHERE g.id = p_gap_id;
    INSERT INTO receipt_number_gaps (series_code, year, from_no, to_no, cause, status, detected_at)
    VALUES (v_gap.series_code, v_gap.year, p_no + 1, v_gap.to_no, v_gap.cause, 'open', v_gap.detected_at);
  END IF;
END;
$$;

-- =====================================================================================================
-- 6. The order as the counter reads it back
-- =====================================================================================================

-- { order_id, group_no, duplicate, receipts: [...] } - each receipt is the IssuedReceipt wire type in snake_case with
-- amounts as numeric strings; the route converts to paise and adds the Kannada list names. No phone number.
CREATE OR REPLACE FUNCTION seva_order_json(p_order_id uuid, p_duplicate boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order seva_orders%ROWTYPE;
  v_counter_name text;
  v_receipts jsonb;
BEGIN
  SELECT o.* INTO v_order FROM seva_orders o WHERE o.id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('order_id', p_order_id)::text;
  END IF;
  SELECT c.name INTO v_counter_name FROM counters c WHERE c.id = v_order.counter_id;

  SELECT coalesce(jsonb_agg(
           jsonb_build_object(
             'id', r.id,
             'client_receipt_id', r.client_receipt_id,
             'receipt_no', r.receipt_no,
             'series_code', r.series_code,
             'seva_date', r.seva_date,
             'business_date', r.business_date,
             'group_no', v_order.group_no,
             'position', r.position,
             'count', v_order.receipts_count,
             'order_total', v_order.amount_total::text,
             'total', r.total::text,
             'lines', (
               SELECT coalesce(jsonb_agg(
                        jsonb_build_object(
                          'line_no', l.line_no,
                          'seva_id', l.seva_id,
                          'code', l.seva_code,
                          'name_en', l.seva_name_en,
                          'name_kn', l.seva_name_kn,
                          'quantity', l.quantity,
                          'catalogue_rate', l.catalogue_rate::text,
                          'unit_rate', l.unit_rate::text,
                          'amount', l.amount::text,
                          'changed', l.amount_changed,
                          'change_reason', l.change_reason,
                          'prasadam_items', l.prasadam_items
                        ) ORDER BY l.line_no), '[]'::jsonb)
                 FROM seva_receipt_lines l
                WHERE l.receipt_id = r.id
             ),
             'payment', jsonb_build_object(
               'mode', v_order.payment_mode,
               'upi_ref_last6', v_order.upi_ref_last6,
               'cash_received', v_order.cash_received::text,
               'change_returned', v_order.change_returned::text
             ),
             'devotee', jsonb_build_object(
               'name', v_order.devotee_name,
               'gotra', v_order.gotra,
               'gotra_id', v_order.gotra_id,
               'nakshatra_id', v_order.nakshatra_id,
               'nakshatra_text', v_order.nakshatra_text,
               'rashi_id', v_order.rashi_id,
               'rashi_text', v_order.rashi_text
             ),
             'qr_token', r.qr_token,
             'issued_at', r.issued_at,
             'issued_by', jsonb_build_object('name', r.issued_by_name, 'staff_no', r.staff_no),
             'counter_name', v_counter_name,
             'channel', v_order.channel,
             'issued_offline', r.issued_offline,
             'status', r.status,
             'cancel_reason_code', r.cancel_reason_code,
             'refund_state', r.refund_state,
             'print_count', r.print_count,
             'prasadam', r.prasadam_state,
             'has_changed_amount', r.has_changed_amount,
             'replaces_receipt_id', r.replaces_receipt_id
           ) ORDER BY r.position, r.created_at, r.receipt_no), '[]'::jsonb)
    INTO v_receipts
    FROM seva_receipts r
   WHERE r.order_id = p_order_id;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'group_no', v_order.group_no,
    'duplicate', coalesce(p_duplicate, false),
    'receipts', v_receipts
  );
END;
$$;

-- =====================================================================================================
-- 7. Issue a counter order online (DB 8.2, 9.3-9.7)
-- =====================================================================================================

-- p_order follows the SQL JSON contract in the plan (Shared contracts):
--   { client_order_id, supersedes_client_order_id?, expected_total,
--     devotee: { name, gotra, gotra_id, nakshatra_id, nakshatra_text, rashi_id, rashi_text, phone_e164 },
--     payment: { mode, cash_received, upi_ref_last6, upi_seen_confirmed },
--     receipts: [{ client_receipt_id, seva_date, qr_token, lines: [{ seva_id, quantity, unit_rate, change_reason }] }] }
-- Prices come from the catalogue; nothing is written unless the whole order is valid and expected_total equals the
-- computed total (SEVA:price_changed). Receipts take consecutive C<n> numbers in seva-date order. A repeated
-- client_order_id returns the stored order with duplicate = true. A normal issue writes no audit row (C-36).
CREATE OR REPLACE FUNCTION seva_issue_counter_order(p_order jsonb, p_staff_id uuid, p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_year smallint;
  v_month smallint;
  v_today date;
  v_staff staff%ROWTYPE;
  v_device counter_devices%ROWTYPE;
  v_series text;
  v_client_order_id uuid;
  v_existing uuid;
  v_days_ahead integer;
  v_devotee jsonb;
  v_payment jsonb;
  v_expected numeric;
  v_receipt record;
  v_line record;
  v_seva sevas%ROWTYPE;
  v_client_receipt_id uuid;
  v_seva_date date;
  v_qr text;
  v_quantity integer;
  v_unit_in numeric;
  v_unit numeric;
  v_catalogue numeric;
  v_changed boolean;
  v_reason text;
  v_amount numeric;
  v_lines jsonb;
  v_receipt_total numeric;
  v_receipt_changed boolean;
  v_receipt_prasadam boolean;
  v_prepared jsonb := '[]'::jsonb;
  v_rates jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_count integer;
  v_group_no text;
  v_first integer;
  v_order_id uuid;
  v_position integer := 0;
  v_running integer;
  v_receipt_no text;
  v_receipt_id uuid;
BEGIN
  IF p_order IS NULL OR jsonb_typeof(p_order) <> 'object' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'order')::text;
  END IF;
  v_client_order_id := seva_issue_arg_uuid(p_order->>'client_order_id', 'client_order_id');
  IF v_client_order_id IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'client_order_id')::text;
  END IF;

  v_staff := seva_issue_staff(p_staff_id);
  v_device := seva_issue_device(p_device_id, false);

  -- One order per client_order_id (Review Focus 3). The lock makes a concurrent retry wait for the first call to
  -- commit, then return what it stored.
  PERFORM pg_advisory_xact_lock(hashtextextended('seva_order:' || v_client_order_id::text, 0));
  SELECT o.id INTO v_existing FROM seva_orders o WHERE o.client_order_id = v_client_order_id;
  IF FOUND THEN
    RETURN seva_order_json(v_existing, true);
  END IF;

  SELECT p.year, p.month, p.business_date INTO v_year, v_month, v_today FROM seva_ist_parts(v_now) AS p;
  PERFORM seva_issue_check_day_open(v_device.counter_id, v_today);
  v_series := seva_issue_counter_series(v_device.counter_id, 'counter_online');

  SELECT s.counter_days_ahead INTO v_days_ahead FROM seva_settings s WHERE s.id = 1;
  v_days_ahead := coalesce(v_days_ahead, 365);

  v_devotee := seva_issue_devotee(p_order->'devotee');
  v_expected := seva_issue_arg_money(p_order->>'expected_total', 'expected_total');
  IF v_expected IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'expected_total')::text;
  END IF;
  IF jsonb_typeof(p_order->'receipts') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_order->'receipts') NOT BETWEEN 1 AND 31 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipts')::text;
  END IF;

  -- Check and price every receipt and line before anything is written.
  FOR v_receipt IN
    SELECT r.value AS body, r.ord FROM jsonb_array_elements(p_order->'receipts') WITH ORDINALITY AS r(value, ord)
     ORDER BY r.ord
  LOOP
    IF jsonb_typeof(v_receipt.body) <> 'object' THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipts')::text;
    END IF;
    v_client_receipt_id := seva_issue_arg_uuid(v_receipt.body->>'client_receipt_id', 'client_receipt_id');
    IF v_client_receipt_id IS NULL THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'client_receipt_id')::text;
    END IF;
    v_seva_date := seva_issue_arg_date(v_receipt.body->>'seva_date', 'seva_date');
    IF v_seva_date IS NULL THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'seva_date')::text;
    END IF;
    v_qr := v_receipt.body->>'qr_token';
    IF v_qr IS NULL OR v_qr !~ '^[A-Za-z0-9_-]{22}$' THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'qr_token')::text;
    END IF;
    -- Counter seva dates run from the IST business date to counter_days_ahead days later, never a past date (C-29).
    IF v_seva_date < v_today OR v_seva_date > v_today + v_days_ahead THEN
      RAISE EXCEPTION 'SEVA:date_out_of_range'
        USING DETAIL = jsonb_build_object('seva_date', v_seva_date, 'first', v_today,
                                          'last', v_today + v_days_ahead)::text;
    END IF;
    IF jsonb_typeof(v_receipt.body->'lines') IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_receipt.body->'lines') NOT BETWEEN 1 AND 8 THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'lines')::text;
    END IF;

    v_lines := '[]'::jsonb;
    v_receipt_total := 0;
    v_receipt_changed := false;
    v_receipt_prasadam := false;
    FOR v_line IN
      SELECT l.value AS body FROM jsonb_array_elements(v_receipt.body->'lines') WITH ORDINALITY AS l(value, ord)
       ORDER BY l.ord
    LOOP
      IF jsonb_typeof(v_line.body) <> 'object' THEN
        RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'lines')::text;
      END IF;
      v_quantity := seva_issue_arg_int(v_line.body->>'quantity', 'quantity');
      IF v_quantity IS NULL OR v_quantity NOT BETWEEN 1 AND 99 THEN
        RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'quantity')::text;
      END IF;
      v_unit_in := seva_issue_arg_money(v_line.body->>'unit_rate', 'unit_rate');
      v_reason := seva_issue_arg_text(v_line.body->>'change_reason', 'change_reason', 200);

      SELECT s.* INTO v_seva FROM sevas s WHERE s.id = seva_issue_arg_uuid(v_line.body->>'seva_id', 'seva_id');
      IF NOT FOUND THEN
        RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'seva_id')::text;
      END IF;
      IF NOT v_seva.active THEN
        RAISE EXCEPTION 'SEVA:seva_inactive' USING DETAIL = jsonb_build_object('name', v_seva.name)::text;
      END IF;
      IF v_seva.visibility NOT IN ('counter', 'both') THEN
        RAISE EXCEPTION 'SEVA:seva_not_on_counter' USING DETAIL = jsonb_build_object('name', v_seva.name)::text;
      END IF;
      v_rates := v_rates || jsonb_build_array(jsonb_build_object(
        'seva_id', v_seva.id,
        'rate', CASE WHEN v_seva.any_amount THEN NULL ELSE v_seva.amount::text END
      ));

      IF v_seva.any_amount THEN
        -- Told by the flag: the stored 0.00 is never a price. The typed amount is the price and never a change.
        v_catalogue := NULL;
        v_unit := v_unit_in;
        IF v_unit IS NULL THEN
          RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'unit_rate')::text;
        END IF;
      ELSE
        v_catalogue := v_seva.amount;
        IF v_unit_in IS NULL THEN
          v_unit := v_catalogue;
        ELSE
          IF NOT v_seva.allow_amount_change THEN
            RAISE EXCEPTION 'SEVA:amount_change_not_allowed' USING DETAIL = jsonb_build_object('name', v_seva.name)::text;
          END IF;
          v_unit := v_unit_in;
        END IF;
      END IF;
      IF v_unit <= 0 OR v_unit > 99999999.99 THEN
        RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'unit_rate')::text;
      END IF;

      v_changed := v_catalogue IS NOT NULL AND v_unit <> v_catalogue;
      IF v_changed THEN
        -- A changed amount always needs a reason of at least 3 characters. The table check
        -- seva_receipt_lines_change_reason (DB 7.4) requires one whatever seva_settings.amount_change_reason_required
        -- says, so that setting cannot relax it here.
        IF coalesce(char_length(v_reason), 0) < 3 THEN
          RAISE EXCEPTION 'SEVA:change_reason_required' USING DETAIL = jsonb_build_object('name', v_seva.name)::text;
        END IF;
      ELSE
        v_reason := NULL;
      END IF;

      v_amount := v_quantity * v_unit;
      v_receipt_total := v_receipt_total + v_amount;
      v_receipt_changed := v_receipt_changed OR v_changed;
      v_receipt_prasadam := v_receipt_prasadam OR v_seva.prasadam_given;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'seva_id', v_seva.id,
        'code', v_seva.code,
        'name_en', v_seva.name,
        'name_kn', v_seva.name_kn,
        'quantity', v_quantity,
        'catalogue_rate', v_catalogue,
        'unit_rate', v_unit,
        'amount', v_amount,
        'changed', v_changed,
        'change_reason', v_reason,
        'prasadam_items', v_seva.prasadam_items
      ));
    END LOOP;

    v_prepared := v_prepared || jsonb_build_array(jsonb_build_object(
      'ord', v_receipt.ord,
      'client_receipt_id', v_client_receipt_id,
      'seva_date', v_seva_date,
      'qr_token', v_qr,
      'total', v_receipt_total,
      'changed', v_receipt_changed,
      'prasadam', v_receipt_prasadam,
      'lines', v_lines
    ));
    v_total := v_total + v_receipt_total;
  END LOOP;

  v_count := jsonb_array_length(v_prepared);
  PERFORM seva_issue_check_receipt_keys(v_prepared, true);
  IF v_total > 9999999999.99 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'total')::text;
  END IF;
  IF v_total <> v_expected THEN
    RAISE EXCEPTION 'SEVA:price_changed'
      USING DETAIL = jsonb_build_object(
        'lines', (SELECT jsonb_agg(DISTINCT x.value) FROM jsonb_array_elements(v_rates) AS x(value))
      )::text;
  END IF;
  v_payment := seva_issue_payment(p_order->'payment', v_total);

  -- Everything is valid: take the numbers and write. A failure from here on still rolls back the numbers too.
  v_group_no := seva_next_group_no(v_now);
  v_first := seva_take_numbers(v_series, v_year, v_count);

  INSERT INTO seva_orders (group_no, client_order_id, channel, counter_id, device_id, issued_by_staff_id, devotee_name,
                           gotra, gotra_id, nakshatra_id, nakshatra_text, rashi_id, rashi_text, phone_e164,
                           receipts_count, amount_total, payment_mode, cash_received, change_returned, upi_ref_last6,
                           upi_seen_confirmed, issued_offline, issued_at)
  VALUES (v_group_no, v_client_order_id, 'counter', v_device.counter_id, v_device.id, v_staff.id, v_devotee->>'name',
          v_devotee->>'gotra', (v_devotee->>'gotra_id')::smallint, (v_devotee->>'nakshatra_id')::smallint,
          v_devotee->>'nakshatra_text', (v_devotee->>'rashi_id')::smallint, v_devotee->>'rashi_text',
          v_devotee->>'phone_e164', v_count, v_total, v_payment->>'mode', (v_payment->>'cash_received')::numeric,
          (v_payment->>'change_returned')::numeric, v_payment->>'upi_ref_last6',
          (v_payment->>'upi_seen_confirmed')::boolean, false, v_now)
  RETURNING id INTO v_order_id;

  FOR v_receipt IN
    SELECT x.value AS body FROM jsonb_array_elements(v_prepared) WITH ORDINALITY AS x(value, ord)
     ORDER BY (x.value->>'seva_date')::date, x.ord
  LOOP
    v_position := v_position + 1;
    v_running := v_first + v_position - 1;
    v_receipt_no := seva_receipt_no(v_series, v_staff.staff_no, NULL, v_month, v_year, v_running);
    INSERT INTO seva_receipts (receipt_no, series_code, year, month, running_no, staff_no, order_id, position,
                               client_receipt_id, seva_date, business_date, total, qr_token, prasadam_state, issued_at,
                               issued_by_staff_id, issued_by_name, issued_offline, has_changed_amount)
    VALUES (v_receipt_no, v_series, v_year, v_month, v_running, v_staff.staff_no, v_order_id, v_position,
            (v_receipt.body->>'client_receipt_id')::uuid, (v_receipt.body->>'seva_date')::date, v_today,
            (v_receipt.body->>'total')::numeric, v_receipt.body->>'qr_token',
            CASE WHEN (v_receipt.body->>'prasadam')::boolean THEN 'pending' ELSE 'none' END,
            v_now, v_staff.id, v_staff.full_name, false, (v_receipt.body->>'changed')::boolean)
    RETURNING id INTO v_receipt_id;
    PERFORM seva_issue_write_lines(v_receipt_id, v_receipt.body->'lines');
    PERFORM seva_issue_audit_lines(v_receipt_id, v_receipt_no, v_receipt.body->'lines', v_staff.id);
  END LOOP;

  PERFORM seva_issue_save_profile(v_devotee, v_now);
  RETURN seva_order_json(v_order_id, false);
END;
$$;

-- =====================================================================================================
-- 8. Store an offline order exactly as printed (DB 8.3, 8.4, 8.6)
-- =====================================================================================================

-- p_order is the issue contract plus issuer_staff_no, issued_at, group_no, receipts[].running_no,
-- receipts[].receipt_no and receipts[].lines[].cached_rate. The PC already printed and was paid, so the order is
-- stored as printed: the catalogue rate of each line is the PC's cached rate, and seva dates and the catalogue are not
-- re-checked. What is checked: the PC is this counter's (a retired PC only inside its device_replaced gap), the issuer
-- may use the counter and is active, or inactive because offboarded after issuing (seva_issue_offline_issuer;
-- p_issuer_role is that person's role, read by the route), every number is in the counter's OF series and equals
-- seva_receipt_no() of its parts with the issuer's staff number, and the number fits the series (next number, a jump
-- that opens a missing_in_sync gap, or a late number inside an open gap). The issuer is recorded as
-- issued_by_staff_id and is the actor of the per-line audit rows (receipt.amount_changed), with p_issuer_role as
-- their actor_role; p_staff_id, the person signed in when the outbox is sent (it may be someone else), is recorded as
-- synced_by_staff_id and is the actor of what the sync itself does: receipt.superseded, and one
-- receipt.issuer_inactive_at_sync per receipt when the issuer is inactive. A repeat of the order, or of its printed
-- receipts under another order id, returns the stored order with duplicate = true.
DROP FUNCTION IF EXISTS seva_sync_offline_order(jsonb, uuid, uuid);
CREATE OR REPLACE FUNCTION seva_sync_offline_order(p_order jsonb, p_staff_id uuid, p_device_id uuid, p_issuer_role text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_syncer staff%ROWTYPE;
  v_issuer staff%ROWTYPE;
  v_device counter_devices%ROWTYPE;
  v_series text;
  v_client_order_id uuid;
  v_existing uuid;
  v_issued_at timestamptz;
  v_year smallint;
  v_month smallint;
  v_business_date date;
  v_last integer;
  v_group_no text;
  v_devotee jsonb;
  v_payment jsonb;
  v_expected numeric;
  v_receipt record;
  v_line record;
  v_seva sevas%ROWTYPE;
  v_client_receipt_id uuid;
  v_seva_date date;
  v_qr text;
  v_running integer;
  v_receipt_no text;
  v_quantity integer;
  v_unit_in numeric;
  v_cached numeric;
  v_unit numeric;
  v_catalogue numeric;
  v_changed boolean;
  v_reason text;
  v_amount numeric;
  v_lines jsonb;
  v_receipt_total numeric;
  v_receipt_changed boolean;
  v_receipt_prasadam boolean;
  v_prepared jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_count integer;
  v_supersedes uuid;
  v_superseded_order uuid;
  v_gap receipt_number_gaps%ROWTYPE;
  v_order_id uuid;
  v_position integer := 0;
  v_receipt_id uuid;
  v_first_no text;
  v_note text;
  v_old record;
  v_route_role text;
BEGIN
  IF p_order IS NULL OR jsonb_typeof(p_order) <> 'object' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'order')::text;
  END IF;
  v_client_order_id := seva_issue_arg_uuid(p_order->>'client_order_id', 'client_order_id');
  IF v_client_order_id IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'client_order_id')::text;
  END IF;

  v_syncer := seva_issue_staff(p_staff_id);
  v_device := seva_issue_device(p_device_id, true);

  PERFORM pg_advisory_xact_lock(hashtextextended('seva_order:' || v_client_order_id::text, 0));
  SELECT o.id INTO v_existing FROM seva_orders o WHERE o.client_order_id = v_client_order_id;
  IF FOUND THEN
    RETURN seva_order_json(v_existing, true);
  END IF;

  -- The PC clock decides the month and year of OF numbers (DB 8.3).
  v_issued_at := seva_issue_arg_ts(p_order->>'issued_at', 'issued_at');
  IF v_issued_at IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'issued_at')::text;
  END IF;
  SELECT p.year, p.month, p.business_date INTO v_year, v_month, v_business_date FROM seva_ist_parts(v_issued_at) AS p;
  IF v_year NOT BETWEEN 2026 AND 2100 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'issued_at')::text;
  END IF;
  v_series := seva_issue_counter_series(v_device.counter_id, 'counter_offline');

  -- Every sync of this series and year waits here, so the number checks below see every stored number.
  INSERT INTO receipt_series_years (series_code, year)
  VALUES (v_series, v_year)
  ON CONFLICT (series_code, year) DO NOTHING;
  SELECT y.last_no INTO v_last
    FROM receipt_series_years y
   WHERE y.series_code = v_series AND y.year = v_year
     FOR UPDATE;

  IF jsonb_typeof(p_order->'receipts') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_order->'receipts') NOT BETWEEN 1 AND 31 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipts')::text;
  END IF;
  -- Printed receipts already stored (same client_receipt_id) are ignored as a duplicate (DB 8.3).
  SELECT r.order_id INTO v_existing
    FROM jsonb_array_elements(p_order->'receipts') AS x(value)
    JOIN seva_receipts r ON r.client_receipt_id = seva_issue_arg_uuid(x.value->>'client_receipt_id', 'client_receipt_id')
   WHERE jsonb_typeof(x.value) = 'object'
   LIMIT 1;
  IF FOUND THEN
    RETURN seva_order_json(v_existing, true);
  END IF;

  -- The PC's group label, 'G-YYMM-OF<n>-NNN' (C-19); it must be this counter's and unused.
  v_group_no := btrim(coalesce(p_order->>'group_no', ''));
  IF v_group_no !~ ('^G-[0-9]{4}-' || v_series || '-[0-9]{3,6}$') THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'group_no')::text;
  END IF;

  -- Who printed these receipts: their numbers carry this person's staff number.
  v_issuer := seva_issue_offline_issuer(p_order->>'issuer_staff_no', p_issuer_role, 'issuer_staff_no');

  v_devotee := seva_issue_devotee(p_order->'devotee');
  v_expected := seva_issue_arg_money(p_order->>'expected_total', 'expected_total');
  IF v_expected IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'expected_total')::text;
  END IF;

  FOR v_receipt IN
    SELECT r.value AS body, r.ord FROM jsonb_array_elements(p_order->'receipts') WITH ORDINALITY AS r(value, ord)
     ORDER BY r.ord
  LOOP
    IF jsonb_typeof(v_receipt.body) <> 'object' THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipts')::text;
    END IF;
    v_client_receipt_id := seva_issue_arg_uuid(v_receipt.body->>'client_receipt_id', 'client_receipt_id');
    IF v_client_receipt_id IS NULL THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'client_receipt_id')::text;
    END IF;
    v_seva_date := seva_issue_arg_date(v_receipt.body->>'seva_date', 'seva_date');
    IF v_seva_date IS NULL THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'seva_date')::text;
    END IF;
    v_qr := v_receipt.body->>'qr_token';
    IF v_qr IS NULL OR v_qr !~ '^[A-Za-z0-9_-]{22}$' THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'qr_token')::text;
    END IF;
    v_running := seva_issue_arg_int(v_receipt.body->>'running_no', 'running_no');
    IF v_running IS NULL OR v_running NOT BETWEEN 1 AND 999999 THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'running_no')::text;
    END IF;
    v_receipt_no := v_receipt.body->>'receipt_no';
    IF v_receipt_no IS NULL THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipt_no')::text;
    END IF;
    IF split_part(v_receipt_no, '-', 1) <> v_series THEN
      RAISE EXCEPTION 'SEVA:number_conflict'
        USING DETAIL = jsonb_build_object('receipt_no', v_receipt_no, 'reason', 'not this counter''s offline series')::text;
    END IF;
    IF v_receipt_no <> seva_receipt_no(v_series, v_issuer.staff_no, NULL, v_month, v_year, v_running) THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipt_no', 'receipt_no', v_receipt_no)::text;
    END IF;
    IF jsonb_typeof(v_receipt.body->'lines') IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_receipt.body->'lines') NOT BETWEEN 1 AND 8 THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'lines')::text;
    END IF;

    v_lines := '[]'::jsonb;
    v_receipt_total := 0;
    v_receipt_changed := false;
    v_receipt_prasadam := false;
    FOR v_line IN
      SELECT l.value AS body FROM jsonb_array_elements(v_receipt.body->'lines') WITH ORDINALITY AS l(value, ord)
       ORDER BY l.ord
    LOOP
      IF jsonb_typeof(v_line.body) <> 'object' THEN
        RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'lines')::text;
      END IF;
      v_quantity := seva_issue_arg_int(v_line.body->>'quantity', 'quantity');
      IF v_quantity IS NULL OR v_quantity NOT BETWEEN 1 AND 99 THEN
        RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'quantity')::text;
      END IF;
      v_unit_in := seva_issue_arg_money(v_line.body->>'unit_rate', 'unit_rate');
      v_cached := seva_issue_arg_money(v_line.body->>'cached_rate', 'cached_rate');
      v_reason := seva_issue_arg_text(v_line.body->>'change_reason', 'change_reason', 200);

      SELECT s.* INTO v_seva FROM sevas s WHERE s.id = seva_issue_arg_uuid(v_line.body->>'seva_id', 'seva_id');
      IF NOT FOUND THEN
        RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'seva_id')::text;
      END IF;

      -- The catalogue rate is the rate the PC printed from (its cached rate); an any-amount seva, told by its flag,
      -- has none.
      v_catalogue := CASE WHEN v_seva.any_amount THEN NULL ELSE v_cached END;
      v_unit := coalesce(v_unit_in, v_catalogue);
      IF v_unit IS NULL OR v_unit <= 0 OR v_unit > 99999999.99 THEN
        RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'unit_rate')::text;
      END IF;
      v_changed := v_catalogue IS NOT NULL AND v_unit <> v_catalogue;
      IF v_changed THEN
        IF coalesce(char_length(v_reason), 0) < 3 THEN
          RAISE EXCEPTION 'SEVA:change_reason_required' USING DETAIL = jsonb_build_object('name', v_seva.name)::text;
        END IF;
      ELSE
        v_reason := NULL;
      END IF;

      v_amount := v_quantity * v_unit;
      v_receipt_total := v_receipt_total + v_amount;
      v_receipt_changed := v_receipt_changed OR v_changed;
      v_receipt_prasadam := v_receipt_prasadam OR v_seva.prasadam_given;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'seva_id', v_seva.id,
        'code', v_seva.code,
        'name_en', v_seva.name,
        'name_kn', v_seva.name_kn,
        'quantity', v_quantity,
        'catalogue_rate', v_catalogue,
        'unit_rate', v_unit,
        'amount', v_amount,
        'changed', v_changed,
        'change_reason', v_reason,
        'prasadam_items', v_seva.prasadam_items,
        -- C-58: the PC's rate differs from today's catalogue rate. Audited, never a changed amount.
        'offline_rate_differs', (NOT v_seva.any_amount AND v_catalogue IS NOT NULL AND v_catalogue <> v_seva.amount),
        'today_rate', CASE WHEN v_seva.any_amount THEN NULL ELSE v_seva.amount::text END
      ));
    END LOOP;

    v_prepared := v_prepared || jsonb_build_array(jsonb_build_object(
      'ord', v_receipt.ord,
      'client_receipt_id', v_client_receipt_id,
      'seva_date', v_seva_date,
      'qr_token', v_qr,
      'running_no', v_running,
      'receipt_no', v_receipt_no,
      'total', v_receipt_total,
      'changed', v_receipt_changed,
      'prasadam', v_receipt_prasadam,
      'lines', v_lines
    ));
    v_total := v_total + v_receipt_total;
  END LOOP;

  v_count := jsonb_array_length(v_prepared);
  PERFORM seva_issue_check_receipt_keys(v_prepared, false);
  IF (SELECT count(DISTINCT x.value->>'running_no') FROM jsonb_array_elements(v_prepared) AS x(value)) <> v_count THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'running_no')::text;
  END IF;
  IF v_total > 9999999999.99 OR v_total <> v_expected THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'expected_total')::text;
  END IF;
  v_payment := seva_issue_payment(p_order->'payment', v_total);
  IF EXISTS (SELECT 1 FROM seva_orders o WHERE o.group_no = v_group_no) THEN
    RAISE EXCEPTION 'SEVA:number_conflict' USING DETAIL = jsonb_build_object('field', 'group_no', 'group_no', v_group_no)::text;
  END IF;

  -- In-doubt save (DB 8.6): the C order this offline order replaces, when the office did store it.
  v_supersedes := seva_issue_arg_uuid(p_order->>'supersedes_client_order_id', 'supersedes_client_order_id');
  IF v_supersedes IS NOT NULL THEN
    SELECT o.id INTO v_superseded_order
      FROM seva_orders o
     WHERE o.client_order_id = v_supersedes
       AND o.channel = 'counter'
       AND NOT o.issued_offline
       AND o.counter_id = v_device.counter_id;
  END IF;

  INSERT INTO seva_orders (group_no, client_order_id, channel, counter_id, device_id, issued_by_staff_id, devotee_name,
                           gotra, gotra_id, nakshatra_id, nakshatra_text, rashi_id, rashi_text, phone_e164,
                           receipts_count, amount_total, payment_mode, cash_received, change_returned, upi_ref_last6,
                           upi_seen_confirmed, issued_offline, supersedes_order_id, issued_at, synced_by_staff_id)
  VALUES (v_group_no, v_client_order_id, 'counter', v_device.counter_id, v_device.id, v_issuer.id, v_devotee->>'name',
          v_devotee->>'gotra', (v_devotee->>'gotra_id')::smallint, (v_devotee->>'nakshatra_id')::smallint,
          v_devotee->>'nakshatra_text', (v_devotee->>'rashi_id')::smallint, v_devotee->>'rashi_text',
          v_devotee->>'phone_e164', v_count, v_total, v_payment->>'mode', (v_payment->>'cash_received')::numeric,
          (v_payment->>'change_returned')::numeric, v_payment->>'upi_ref_last6',
          (v_payment->>'upi_seen_confirmed')::boolean, true, v_superseded_order, v_issued_at, v_syncer.id)
  RETURNING id INTO v_order_id;

  -- Numbers in running order; positions follow them (the PC numbered the receipts in printing order).
  FOR v_receipt IN
    SELECT x.value AS body FROM jsonb_array_elements(v_prepared) AS x(value)
     ORDER BY (x.value->>'running_no')::integer
  LOOP
    v_position := v_position + 1;
    v_running := (v_receipt.body->>'running_no')::integer;
    v_receipt_no := v_receipt.body->>'receipt_no';
    IF v_position = 1 THEN
      v_first_no := v_receipt_no;
    END IF;

    IF EXISTS (
      SELECT 1 FROM seva_receipts r WHERE r.series_code = v_series AND r.year = v_year AND r.running_no = v_running
    ) THEN
      RAISE EXCEPTION 'SEVA:number_conflict'
        USING DETAIL = jsonb_build_object('receipt_no', v_receipt_no, 'reason', 'the number is already used')::text;
    END IF;

    IF v_device.retired_at IS NOT NULL THEN
      -- A retired PC's late upload is accepted only inside a device_replaced gap (DB 8.4).
      SELECT g.* INTO v_gap
        FROM receipt_number_gaps g
       WHERE g.series_code = v_series AND g.year = v_year AND g.status = 'open' AND g.cause = 'device_replaced'
         AND v_running BETWEEN g.from_no AND g.to_no
       ORDER BY g.id
       LIMIT 1
         FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'SEVA:device_unknown'
          USING DETAIL = jsonb_build_object('receipt_no', v_receipt_no,
                                            'reason', 'a retired PC may only send numbers inside its replaced range')::text;
      END IF;
      PERFORM seva_issue_fill_gap(v_gap.id, v_running, v_now);
    ELSIF v_running = v_last + 1 THEN
      v_last := v_running;
    ELSIF v_running > v_last + 1 THEN
      INSERT INTO receipt_number_gaps (series_code, year, from_no, to_no, cause, detected_at)
      VALUES (v_series, v_year, v_last + 1, v_running - 1, 'missing_in_sync', v_now);
      v_last := v_running;
    ELSE
      SELECT g.* INTO v_gap
        FROM receipt_number_gaps g
       WHERE g.series_code = v_series AND g.year = v_year AND g.status = 'open'
         AND v_running BETWEEN g.from_no AND g.to_no
       ORDER BY g.id
       LIMIT 1
         FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'SEVA:number_conflict'
          USING DETAIL = jsonb_build_object('receipt_no', v_receipt_no,
                                            'reason', 'below the last number and outside every open gap')::text;
      END IF;
      PERFORM seva_issue_fill_gap(v_gap.id, v_running, v_now);
    END IF;

    INSERT INTO seva_receipts (receipt_no, series_code, year, month, running_no, staff_no, order_id, position,
                               client_receipt_id, seva_date, business_date, total, qr_token, prasadam_state, issued_at,
                               issued_by_staff_id, issued_by_name, issued_offline, has_changed_amount)
    VALUES (v_receipt_no, v_series, v_year, v_month, v_running, v_issuer.staff_no, v_order_id, v_position,
            (v_receipt.body->>'client_receipt_id')::uuid, (v_receipt.body->>'seva_date')::date, v_business_date,
            (v_receipt.body->>'total')::numeric, v_receipt.body->>'qr_token',
            CASE WHEN (v_receipt.body->>'prasadam')::boolean THEN 'pending' ELSE 'none' END,
            v_issued_at, v_issuer.id, v_issuer.full_name, true, (v_receipt.body->>'changed')::boolean)
    RETURNING id INTO v_receipt_id;
    PERFORM seva_issue_write_lines(v_receipt_id, v_receipt.body->'lines');
    -- The issuer printed these amounts: their audit rows name the issuer and the issuer's role, not the syncer's.
    v_route_role := seva_issue_actor_role(p_issuer_role);
    PERFORM seva_issue_audit_lines(v_receipt_id, v_receipt_no, v_receipt.body->'lines', v_issuer.id);
    PERFORM seva_issue_actor_role(v_route_role);
    IF v_issuer.status = 'inactive' THEN
      PERFORM seva_audit(
        'receipt.issuer_inactive_at_sync', 'receipt', v_receipt_id::text, v_receipt_no,
        'The issuer was offboarded before this offline receipt reached the office',
        NULL,
        jsonb_build_object('issuer_staff_id', v_issuer.id, 'issuer_staff_no', v_issuer.staff_no,
                           'synced_by_staff_id', v_syncer.id, 'during', 'order'),
        v_syncer.id
      );
    END IF;
  END LOOP;

  UPDATE receipt_series_years y
     SET last_no = v_last
   WHERE y.series_code = v_series AND y.year = v_year AND y.last_no <> v_last;

  -- The replaced C order: cancelled only when none of its receipts was ever printed. If one was printed both orders
  -- stay, linked, and Needs attention asks an admin to cancel one (DB 8.6).
  IF v_superseded_order IS NOT NULL THEN
    PERFORM 1 FROM seva_receipts r WHERE r.order_id = v_superseded_order FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM seva_receipts r WHERE r.order_id = v_superseded_order AND r.print_count > 0) THEN
      v_note := 'Not printed: connection lost before the reply; reissued offline as ' || v_first_no;
      FOR v_old IN
        SELECT r.id, r.receipt_no FROM seva_receipts r
         WHERE r.order_id = v_superseded_order AND r.status = 'issued'
         ORDER BY r.position, r.receipt_no
      LOOP
        UPDATE seva_receipts r
           SET status = 'cancelled',
               cancel_reason_code = 'not_printed_connection_lost',
               cancel_note = v_note,
               cancelled_at = v_now,
               cancelled_by_staff_id = v_syncer.id
         WHERE r.id = v_old.id;
        PERFORM seva_audit(
          'receipt.superseded', 'receipt', v_old.id::text, v_old.receipt_no, v_note,
          jsonb_build_object('status', 'issued'),
          jsonb_build_object('status', 'cancelled', 'cancel_reason_code', 'not_printed_connection_lost',
                             'superseded_by_order_id', v_order_id, 'superseded_by_receipt_no', v_first_no),
          v_syncer.id
        );
      END LOOP;
    END IF;
  END IF;

  PERFORM seva_issue_save_profile(v_devotee, v_issued_at);
  RETURN seva_order_json(v_order_id, false);
END;
$$;

-- =====================================================================================================
-- 9. Prints and reprints (DB 9.8, C-22, C-23)
-- =====================================================================================================

-- Records one print of each receipt (an id given twice counts once). The first print sets print_count 1; any later
-- print is a duplicate (the slip carries the DUPLICATE band) and writes audit receipt.reprint. A cancelled receipt is
-- never printed again (SEVA:cannot_reprint_cancelled). Who may reprint is checked by the route (DB 3.3 row 5).
CREATE OR REPLACE FUNCTION seva_record_prints(p_receipt_ids uuid[], p_staff_id uuid, p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_staff staff%ROWTYPE;
  v_device counter_devices%ROWTYPE;
  v_id uuid;
  v_receipt seva_receipts%ROWTYPE;
  v_new_count smallint;
  v_out jsonb := '[]'::jsonb;
BEGIN
  v_staff := seva_issue_staff(p_staff_id);
  v_device := seva_issue_device(p_device_id, false);
  IF p_receipt_ids IS NULL OR cardinality(p_receipt_ids) NOT BETWEEN 1 AND 31
     OR array_position(p_receipt_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipt_ids')::text;
  END IF;

  FOR v_id IN
    SELECT u.id FROM unnest(p_receipt_ids) WITH ORDINALITY AS u(id, ord) GROUP BY u.id ORDER BY min(u.ord)
  LOOP
    SELECT r.* INTO v_receipt FROM seva_receipts r WHERE r.id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('receipt_id', v_id)::text;
    END IF;
    IF v_receipt.status = 'cancelled' THEN
      RAISE EXCEPTION 'SEVA:cannot_reprint_cancelled'
        USING DETAIL = jsonb_build_object('receipt_no', v_receipt.receipt_no)::text;
    END IF;

    UPDATE seva_receipts r
       SET print_count = r.print_count + 1,
           first_printed_at = coalesce(r.first_printed_at, v_now),
           last_printed_at = v_now
     WHERE r.id = v_id
    RETURNING r.print_count INTO v_new_count;

    IF v_receipt.print_count > 0 THEN
      PERFORM seva_audit(
        'receipt.reprint', 'receipt', v_id::text, v_receipt.receipt_no, NULL,
        jsonb_build_object('print_count', v_receipt.print_count),
        jsonb_build_object('print_count', v_new_count, 'counter_id', v_device.counter_id, 'device_id', v_device.id),
        v_staff.id
      );
    END IF;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id', v_id,
      'receipt_no', v_receipt.receipt_no,
      'print_count', v_new_count,
      'duplicate', v_receipt.print_count > 0,
      'last_printed_at', v_now
    ));
  END LOOP;

  RETURN jsonb_build_object('receipts', v_out);
END;
$$;

-- =====================================================================================================
-- 10. Cancel with a reason (DB 9.9, C-20, D23)
-- =====================================================================================================

-- Cancels each receipt (an id given twice counts once) with one of the eight counter reasons; 'other' needs a note
-- of at least 3 characters. Without p_is_admin the canceller must be the issuer and inside the cancel window, checked
-- at coalesce(p_at, now()) held between issued_at and now(): p_at is when an offline cancel happened on the PC, and
-- only an offline cancel may pass it - p_at without p_cancelled_by_staff_no is SEVA:validation (field at), so an
-- online caller can never move the window back. A temple admin or super admin (p_is_admin, decided by the route) cancels any receipt at any time. Money back: cash
-- cancelled on the receipt's own IST business date is handed back from the drawer (refund_state done); cash from an
-- earlier day, UPI and online are refunded by the office (due). One audit row receipt.cancel per receipt. All or
-- nothing.
--
-- An offline cancel sent by the outbox (DB 9.9, 9.11) passes p_cancelled_by_staff_no, the staff no. of the person who
-- cancelled on the PC, p_canceller_role, that person's role as the route reads it, and p_at (required). p_staff_id is
-- then the person who syncs, who may be someone else. The canceller is checked like an offline issuer
-- (seva_issue_offline_issuer: may use the counter; active, or inactive because offboarded since) and always under the
-- counter rule - own receipt, inside the window up to p_at - because offline only one's own receipts are cancelled;
-- p_is_admin is not used. The canceller is recorded as cancelled_by_staff_id and is the actor of receipt.cancel (with
-- p_canceller_role as actor_role, and offline and synced_by_staff_id in its after); an inactive canceller adds
-- receipt.issuer_inactive_at_sync by the syncer. When the IST business date of the cancel's recorded time is already
-- closed for the receipt's counter (day_closes status closed), the cancel is still stored - the slip was cancelled on
-- the PC - but flagged for the office: in_closed_day true in the answer and in the audit row's after, which also
-- carries closed_business_date. Every receipt of the answer carries in_closed_day (false for an online cancel).
DROP FUNCTION IF EXISTS seva_cancel_receipts(uuid[], text, text, uuid, boolean, timestamptz);
CREATE OR REPLACE FUNCTION seva_cancel_receipts(
  p_receipt_ids uuid[],
  p_reason_code text,
  p_note text,
  p_staff_id uuid,
  p_is_admin boolean,
  p_at timestamptz DEFAULT NULL,
  p_cancelled_by_staff_no integer DEFAULT NULL,
  p_canceller_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_staff staff%ROWTYPE;
  v_syncer staff%ROWTYPE;
  v_offline boolean := p_cancelled_by_staff_no IS NOT NULL;
  v_note text;
  v_is_admin boolean := coalesce(p_is_admin, false);
  v_window integer;
  v_id uuid;
  v_receipt seva_receipts%ROWTYPE;
  v_mode text;
  v_counter_id smallint;
  v_at timestamptz;
  v_at_date date;
  v_in_closed_day boolean;
  v_refund text;
  v_refund_note text;
  v_after jsonb;
  v_route_role text;
  v_cash_back numeric := 0;
  v_out jsonb := '[]'::jsonb;
BEGIN
  v_staff := seva_issue_staff(p_staff_id);
  -- Only an offline cancel carries the time it was made; anyone else is measured to now().
  IF NOT v_offline AND p_at IS NOT NULL THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', 'at', 'reason', 'only an offline cancel carries its own time')::text;
  END IF;
  IF v_offline THEN
    v_syncer := v_staff;
    IF p_at IS NULL THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'at')::text;
    END IF;
    v_staff := seva_issue_offline_issuer(p_cancelled_by_staff_no::text, p_canceller_role, 'cancelled_by_staff_no');
    v_is_admin := false;
  END IF;
  IF p_reason_code IS NULL OR p_reason_code NOT IN (
    'wrong_seva', 'wrong_date', 'wrong_amount', 'wrong_devotee', 'changed_mind', 'entered_twice', 'spoiled_print', 'other'
  ) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'reason_code')::text;
  END IF;
  v_note := seva_issue_arg_text(p_note, 'note', 500);
  IF p_reason_code = 'other' AND coalesce(char_length(v_note), 0) < 3 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'note')::text;
  END IF;
  IF p_receipt_ids IS NULL OR cardinality(p_receipt_ids) NOT BETWEEN 1 AND 31
     OR array_position(p_receipt_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipt_ids')::text;
  END IF;
  SELECT s.cancel_window_minutes INTO v_window FROM seva_settings s WHERE s.id = 1;
  v_window := coalesce(v_window, 30);

  FOR v_id IN
    SELECT u.id FROM unnest(p_receipt_ids) WITH ORDINALITY AS u(id, ord) GROUP BY u.id ORDER BY min(u.ord)
  LOOP
    SELECT r.* INTO v_receipt FROM seva_receipts r WHERE r.id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('receipt_id', v_id)::text;
    END IF;
    IF v_receipt.status = 'cancelled' THEN
      RAISE EXCEPTION 'SEVA:already_cancelled' USING DETAIL = jsonb_build_object('receipt_no', v_receipt.receipt_no)::text;
    END IF;

    v_at := least(greatest(coalesce(p_at, v_now), v_receipt.issued_at), v_now);
    IF NOT v_is_admin THEN
      IF v_receipt.issued_by_staff_id IS DISTINCT FROM v_staff.id THEN
        RAISE EXCEPTION 'SEVA:forbidden' USING DETAIL = jsonb_build_object('receipt_no', v_receipt.receipt_no)::text;
      END IF;
      IF v_at > v_receipt.issued_at + make_interval(mins => v_window) THEN
        RAISE EXCEPTION 'SEVA:cancel_window_passed'
          USING DETAIL = jsonb_build_object('receipt_no', v_receipt.receipt_no,
                                            'until', v_receipt.issued_at + make_interval(mins => v_window))::text;
      END IF;
    END IF;

    SELECT o.payment_mode, o.counter_id INTO v_mode, v_counter_id FROM seva_orders o WHERE o.id = v_receipt.order_id;
    SELECT p.business_date INTO v_at_date FROM seva_ist_parts(v_at) AS p;
    -- An offline cancel recorded on a day the counter has already closed is kept, and flagged for the office.
    v_in_closed_day := v_offline AND EXISTS (
      SELECT 1 FROM day_closes dc
       WHERE dc.counter_id = v_counter_id AND dc.business_date = v_at_date AND dc.status = 'closed'
    );
    IF v_mode = 'cash' AND v_receipt.business_date = v_at_date THEN
      v_refund := 'done';
      v_refund_note := 'Given back from the drawer';
      v_cash_back := v_cash_back + v_receipt.total;
    ELSE
      v_refund := 'due';
      v_refund_note := NULL;
    END IF;

    UPDATE seva_receipts r
       SET status = 'cancelled',
           cancel_reason_code = p_reason_code,
           cancel_note = v_note,
           cancelled_at = v_at,
           cancelled_by_staff_id = v_staff.id,
           refund_state = v_refund,
           refund_note = v_refund_note
     WHERE r.id = v_id;

    v_after := jsonb_build_object('status', 'cancelled', 'cancel_reason_code', p_reason_code, 'refund_state', v_refund,
                                  'cancelled_at', v_at, 'by_admin', v_is_admin);
    IF v_offline THEN
      -- The person who cancelled on the PC is the actor, with their role; the syncer is recorded beside it.
      v_after := v_after || jsonb_build_object('offline', true, 'synced_by_staff_id', v_syncer.id,
                                               'in_closed_day', v_in_closed_day);
      IF v_in_closed_day THEN
        v_after := v_after || jsonb_build_object('closed_business_date', v_at_date);
      END IF;
      v_route_role := seva_issue_actor_role(p_canceller_role);
    END IF;
    PERFORM seva_audit(
      'receipt.cancel', 'receipt', v_id::text, v_receipt.receipt_no,
      p_reason_code || coalesce(': ' || v_note, ''),
      jsonb_build_object('status', 'issued', 'refund_state', v_receipt.refund_state),
      v_after,
      v_staff.id
    );
    IF v_offline THEN
      PERFORM seva_issue_actor_role(v_route_role);
      IF v_staff.status = 'inactive' THEN
        PERFORM seva_audit(
          'receipt.issuer_inactive_at_sync', 'receipt', v_id::text, v_receipt.receipt_no,
          'The issuer was offboarded before this offline cancel reached the office',
          NULL,
          jsonb_build_object('issuer_staff_id', v_staff.id, 'issuer_staff_no', v_staff.staff_no,
                             'synced_by_staff_id', v_syncer.id, 'during', 'cancel'),
          v_syncer.id
        );
      END IF;
    END IF;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id', v_id,
      'receipt_no', v_receipt.receipt_no,
      'status', 'cancelled',
      'refund_state', v_refund,
      'refund_note', v_refund_note,
      'cancelled_at', v_at,
      'total', v_receipt.total::text,
      'in_closed_day', v_in_closed_day
    ));
  END LOOP;

  RETURN jsonb_build_object('receipts', v_out, 'cash_back', round(v_cash_back, 2)::text);
END;
$$;

-- =====================================================================================================
-- 11. Spoiled print: cancel and reissue on the same payment (DB 9.8, C-21)
-- =====================================================================================================

-- The receipt jammed or misprinted: it is cancelled with reason spoiled_print (no money moves, so refund_state stays
-- none) and a new receipt takes the next number of this counter's C series on the same order, with the same seva
-- date, position, total and lines, a new QR token (made in TypeScript, qr.ts) and replaces_receipt_id pointing at
-- the spoiled one. Only a receipt of the current IST business date is reissued (SEVA:validation, field
-- reissue_only_today, otherwise): an earlier day's slip is reprinted as a DUPLICATE instead, which needs no new
-- number. So the new receipt has today's business date, the same as the spoiled one, and today's day close counts
-- the payment once: the spoiled number as cancelled, the new one as issued. Audit receipt.reissue_spoiled.
-- Returns the order (seva_order_json) plus new_receipt_id and replaced_receipt_id.
CREATE OR REPLACE FUNCTION seva_reissue_spoiled(p_receipt_id uuid, p_staff_id uuid, p_device_id uuid, p_qr_token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_year smallint;
  v_month smallint;
  v_today date;
  v_staff staff%ROWTYPE;
  v_device counter_devices%ROWTYPE;
  v_old seva_receipts%ROWTYPE;
  v_channel text;
  v_series text;
  v_running integer;
  v_receipt_no text;
  v_new_id uuid;
BEGIN
  v_staff := seva_issue_staff(p_staff_id);
  v_device := seva_issue_device(p_device_id, false);
  IF p_qr_token IS NULL OR p_qr_token !~ '^[A-Za-z0-9_-]{22}$'
     OR EXISTS (SELECT 1 FROM seva_receipts r WHERE r.qr_token = p_qr_token) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'qr_token')::text;
  END IF;

  SELECT r.* INTO v_old FROM seva_receipts r WHERE r.id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('receipt_id', p_receipt_id)::text;
  END IF;
  IF v_old.status = 'cancelled' THEN
    RAISE EXCEPTION 'SEVA:already_cancelled' USING DETAIL = jsonb_build_object('receipt_no', v_old.receipt_no)::text;
  END IF;
  SELECT o.channel INTO v_channel FROM seva_orders o WHERE o.id = v_old.order_id;
  IF v_channel IS DISTINCT FROM 'counter' THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', 'receipt_id', 'reason', 'only counter receipts are reissued')::text;
  END IF;

  SELECT p.year, p.month, p.business_date INTO v_year, v_month, v_today FROM seva_ist_parts(v_now) AS p;
  IF v_old.business_date <> v_today THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', 'reissue_only_today', 'receipt_no', v_old.receipt_no,
                                        'business_date', v_old.business_date)::text;
  END IF;
  PERFORM seva_issue_check_day_open(v_device.counter_id, v_today);
  v_series := seva_issue_counter_series(v_device.counter_id, 'counter_online');
  v_running := seva_take_numbers(v_series, v_year, 1);
  v_receipt_no := seva_receipt_no(v_series, v_staff.staff_no, NULL, v_month, v_year, v_running);

  UPDATE seva_receipts r
     SET status = 'cancelled',
         cancel_reason_code = 'spoiled_print',
         cancel_note = 'Spoiled print; reissued as ' || v_receipt_no,
         cancelled_at = v_now,
         cancelled_by_staff_id = v_staff.id
   WHERE r.id = v_old.id;

  INSERT INTO seva_receipts (receipt_no, series_code, year, month, running_no, staff_no, order_id, position,
                             client_receipt_id, seva_date, business_date, total, replaces_receipt_id, qr_token,
                             prasadam_state, prasadam_given_at, prasadam_given_by_staff_id, prasadam_off_date,
                             issued_at, issued_by_staff_id, issued_by_name, issued_offline, has_changed_amount,
                             test_mode)
  VALUES (v_receipt_no, v_series, v_year, v_month, v_running, v_staff.staff_no, v_old.order_id, v_old.position,
          gen_random_uuid(), v_old.seva_date, v_today, v_old.total, v_old.id, p_qr_token,
          v_old.prasadam_state, v_old.prasadam_given_at, v_old.prasadam_given_by_staff_id, v_old.prasadam_off_date,
          v_now, v_staff.id, v_staff.full_name, false, v_old.has_changed_amount, v_old.test_mode)
  RETURNING id INTO v_new_id;

  INSERT INTO seva_receipt_lines (receipt_id, line_no, seva_id, seva_code, seva_name_en, seva_name_kn, quantity,
                                  catalogue_rate, unit_rate, amount, change_reason, prasadam_items)
  SELECT v_new_id, l.line_no, l.seva_id, l.seva_code, l.seva_name_en, l.seva_name_kn, l.quantity, l.catalogue_rate,
         l.unit_rate, l.amount, l.change_reason, l.prasadam_items
    FROM seva_receipt_lines l
   WHERE l.receipt_id = v_old.id;

  PERFORM seva_audit(
    'receipt.reissue_spoiled', 'receipt', v_old.id::text, v_old.receipt_no, 'Spoiled print',
    jsonb_build_object('receipt_id', v_old.id, 'receipt_no', v_old.receipt_no, 'status', 'issued'),
    jsonb_build_object('status', 'cancelled', 'new_receipt_id', v_new_id, 'new_receipt_no', v_receipt_no),
    v_staff.id
  );

  RETURN seva_order_json(v_old.order_id, false)
      || jsonb_build_object('new_receipt_id', v_new_id, 'replaced_receipt_id', v_old.id);
END;
$$;

-- =====================================================================================================
-- 12. Function privileges: service_role only
-- =====================================================================================================

REVOKE EXECUTE ON FUNCTION seva_issue_arg_uuid(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_arg_uuid(text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_arg_money(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_arg_money(text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_arg_int(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_arg_int(text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_arg_date(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_arg_date(text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_arg_ts(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_arg_ts(text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_arg_text(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_arg_text(text, text, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_staff(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_staff(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_offline_issuer(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_offline_issuer(text, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_actor_role(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_actor_role(text) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_device(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_device(uuid, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_counter_series(smallint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_counter_series(smallint, text) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_check_day_open(smallint, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_check_day_open(smallint, date) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_take_numbers(text, smallint, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_take_numbers(text, smallint, int) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_next_group_no(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_next_group_no(timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_devotee(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_devotee(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_payment(jsonb, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_payment(jsonb, numeric) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_save_profile(jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_save_profile(jsonb, timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_check_receipt_keys(jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_check_receipt_keys(jsonb, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_write_lines(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_write_lines(uuid, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_audit_lines(uuid, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_audit_lines(uuid, text, jsonb, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_fill_gap(bigint, integer, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_fill_gap(bigint, integer, timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_order_json(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_order_json(uuid, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_counter_order(jsonb, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_counter_order(jsonb, uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_sync_offline_order(jsonb, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_sync_offline_order(jsonb, uuid, uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_record_prints(uuid[], uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_record_prints(uuid[], uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_cancel_receipts(uuid[], text, text, uuid, boolean, timestamptz, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_cancel_receipts(uuid[], text, text, uuid, boolean, timestamptz, integer, text) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_reissue_spoiled(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_reissue_spoiled(uuid, uuid, uuid, text) TO service_role;
