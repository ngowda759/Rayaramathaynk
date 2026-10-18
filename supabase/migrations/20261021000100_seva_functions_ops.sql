-- Seva Entry, Phase 1 - SQL functions for prasadam, counter devices, number gaps, the heartbeat and day close.
-- Spec: docs/seva/DESIGN-BOOK.md 7.5, 7.8, 8.3-8.5, 9.10 and 11; plan Task A2-2. Depends on the 20261020* seva files.
--
-- Same rules as the schema files: additive and idempotent (CREATE OR REPLACE only), Postgres 15, plpgsql,
-- SECURITY INVOKER, search_path pinned, EXECUTE for service_role only. Each function is one transaction. Business
-- errors are raised as 'SEVA:<code>' (codes in lib/seva/errors.ts) with JSON in DETAIL. Money comes back as numeric
-- strings with two decimals ('1110.00'); routes convert to paise. Business dates are IST (seva_ist_parts).
-- Who may call what (DB 3.3) is checked by the routes; these functions check the staff member is active.

-- =====================================================================================================
-- 0. Shared check
-- =====================================================================================================

-- Returns the staff member's name, or raises SEVA:staff_inactive when the id is unknown or the status is not active.
CREATE OR REPLACE FUNCTION seva_ops_require_staff(p_staff_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_status text;
BEGIN
  SELECT s.full_name, s.status INTO v_name, v_status FROM staff s WHERE s.id = p_staff_id;
  IF NOT FOUND OR v_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'SEVA:staff_inactive' USING DETAIL = '{}';
  END IF;
  RETURN v_name;
END;
$$;

-- =====================================================================================================
-- 1. Prasadam (DB 11, C-27, D35)
-- =====================================================================================================

-- Marks a receipt's prasadam given, once per receipt. Returns
--   { state: 'given'|'already_given'|'needs_confirm'|'cancelled'|'no_prasadam', off_date?: 'before'|'after',
--     days?: int, given_at?: timestamptz, given_by_name?: text }
-- A seva date other than the IST business date needs p_confirm_off_date (the second tap); 'before' means today is
-- before the seva date. An off-date give records prasadam_off_date and writes audit prasadam.given_off_date; a give on
-- the seva date writes no audit row. No amounts and no phone number are returned.
CREATE OR REPLACE FUNCTION seva_mark_prasadam(p_receipt_id uuid, p_staff_id uuid, p_confirm_off_date boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_today date;
  v_name text;
  v_r seva_receipts%ROWTYPE;
  v_given_by text;
  v_off text;
  v_days integer;
BEGIN
  v_name := seva_ops_require_staff(p_staff_id);
  SELECT p.business_date INTO v_today FROM seva_ist_parts(v_now) p;

  SELECT * INTO v_r FROM seva_receipts r WHERE r.id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'receipt')::text;
  END IF;

  IF v_r.status = 'cancelled' THEN
    RETURN jsonb_build_object('state', 'cancelled');
  END IF;
  IF v_r.prasadam_state = 'none' THEN
    RETURN jsonb_build_object('state', 'no_prasadam');
  END IF;
  IF v_r.prasadam_state = 'given' THEN
    SELECT s.full_name INTO v_given_by FROM staff s WHERE s.id = v_r.prasadam_given_by_staff_id;
    RETURN jsonb_strip_nulls(jsonb_build_object(
      'state', 'already_given',
      'given_at', v_r.prasadam_given_at,
      'given_by_name', v_given_by
    ));
  END IF;

  IF v_r.seva_date > v_today THEN
    v_off := 'before';
    v_days := v_r.seva_date - v_today;
  ELSIF v_r.seva_date < v_today THEN
    v_off := 'after';
    v_days := v_today - v_r.seva_date;
  END IF;

  IF v_off IS NOT NULL AND NOT coalesce(p_confirm_off_date, false) THEN
    RETURN jsonb_build_object('state', 'needs_confirm', 'off_date', v_off, 'days', v_days);
  END IF;

  UPDATE seva_receipts
     SET prasadam_state = 'given',
         prasadam_given_at = v_now,
         prasadam_given_by_staff_id = p_staff_id,
         prasadam_off_date = v_off
   WHERE id = v_r.id;

  IF v_off IS NOT NULL THEN
    PERFORM seva_audit(
      'prasadam.given_off_date', 'receipt', v_r.id::text, v_r.receipt_no, NULL,
      jsonb_build_object('prasadam_state', 'pending'),
      jsonb_build_object('prasadam_state', 'given', 'off_date', v_off, 'days', v_days,
                         'seva_date', v_r.seva_date, 'given_on', v_today),
      p_staff_id
    );
  END IF;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'state', 'given',
    'off_date', v_off,
    'days', v_days,
    'given_at', v_now,
    'given_by_name', v_name
  ));
END;
$$;

-- Moves a given prasadam back to pending. The person who gave it may undo inside seva_settings.prasadam_undo_seconds
-- (audit prasadam.undo); anyone else, or after that time, needs p_is_admin and a reason of at least 3 characters
-- (audit prasadam.reversed), else SEVA:forbidden / SEVA:validation. Returns { state: 'pending' }.
CREATE OR REPLACE FUNCTION seva_undo_prasadam(
  p_receipt_id uuid,
  p_staff_id uuid,
  p_reason text,
  p_is_admin boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_r seva_receipts%ROWTYPE;
  v_undo_seconds integer;
  v_action text;
BEGIN
  PERFORM seva_ops_require_staff(p_staff_id);

  SELECT * INTO v_r FROM seva_receipts r WHERE r.id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'receipt')::text;
  END IF;
  IF v_r.prasadam_state IS DISTINCT FROM 'given' THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', 'prasadam_state', 'reason', 'not_given')::text;
  END IF;

  SELECT st.prasadam_undo_seconds INTO v_undo_seconds FROM seva_settings st WHERE st.id = 1;
  v_undo_seconds := coalesce(v_undo_seconds, 120);

  IF v_r.prasadam_given_by_staff_id = p_staff_id
     AND v_now < v_r.prasadam_given_at + make_interval(secs => v_undo_seconds) THEN
    v_action := 'prasadam.undo';
  ELSE
    IF NOT coalesce(p_is_admin, false) THEN
      RAISE EXCEPTION 'SEVA:forbidden' USING DETAIL = jsonb_build_object('reason', 'undo_time_passed')::text;
    END IF;
    IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'reason')::text;
    END IF;
    v_action := 'prasadam.reversed';
  END IF;

  UPDATE seva_receipts
     SET prasadam_state = 'pending',
         prasadam_given_at = NULL,
         prasadam_given_by_staff_id = NULL,
         prasadam_off_date = NULL
   WHERE id = v_r.id;

  PERFORM seva_audit(
    v_action, 'receipt', v_r.id::text, v_r.receipt_no, v_reason,
    jsonb_build_object('prasadam_state', 'given', 'given_at', v_r.prasadam_given_at,
                       'given_by_staff_id', v_r.prasadam_given_by_staff_id, 'off_date', v_r.prasadam_off_date),
    jsonb_build_object('prasadam_state', 'pending'),
    p_staff_id
  );

  RETURN jsonb_build_object('state', 'pending');
END;
$$;

-- =====================================================================================================
-- 2. Counter devices and number gaps (DB 8.3-8.5, C-52)
-- =====================================================================================================

-- Registers a counter PC. Only the SHA-256 hex of its secret is stored. One live PC per counter: a second register
-- raises SEVA:device_exists (use seva_replace_device). Audit device.register (never the hash).
CREATE OR REPLACE FUNCTION seva_register_device(
  p_counter_id smallint,
  p_secret_hash text,
  p_label text,
  p_staff_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_label text := nullif(btrim(coalesce(p_label, '')), '');
  v_id uuid;
BEGIN
  PERFORM seva_ops_require_staff(p_staff_id);
  IF p_secret_hash IS NULL OR p_secret_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'secret_hash')::text;
  END IF;
  IF v_label IS NOT NULL AND char_length(v_label) > 80 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'label')::text;
  END IF;

  -- The counter row lock serialises register and replace for one counter.
  PERFORM 1 FROM counters c WHERE c.id = p_counter_id AND c.active FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'counter')::text;
  END IF;

  IF EXISTS (SELECT 1 FROM counter_devices d WHERE d.counter_id = p_counter_id AND d.retired_at IS NULL) THEN
    RAISE EXCEPTION 'SEVA:device_exists' USING DETAIL = jsonb_build_object('counter_id', p_counter_id)::text;
  END IF;

  INSERT INTO counter_devices (counter_id, secret_hash, label, registered_by_staff_id)
  VALUES (p_counter_id, p_secret_hash, v_label, p_staff_id)
  RETURNING id INTO v_id;

  PERFORM seva_audit(
    'device.register', 'counter_device', v_id::text, NULL, NULL, NULL,
    jsonb_build_object('counter_id', p_counter_id, 'label', v_label),
    p_staff_id
  );
  RETURN v_id;
END;
$$;

-- "Replace this PC" (DB 8.4): retires the counter's live PC (if any), registers the new one, and raises the counter's
-- OF floor for the current IST year to the number on the last slip printed (p_last_printed_of_no). When that number
-- is above the server's last OF number, the range in between (server last + 1 .. typed) becomes an open
-- 'device_replaced' gap. A typed number at or below the server's never lowers the floor and opens no gap.
-- Needs a reason of at least 3 characters. Audit device.replace.
CREATE OR REPLACE FUNCTION seva_replace_device(
  p_counter_id smallint,
  p_secret_hash text,
  p_label text,
  p_last_printed_of_no int,
  p_reason text,
  p_staff_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_label text := nullif(btrim(coalesce(p_label, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_year smallint;
  v_series text;
  v_last integer;
  v_old uuid;
  v_new uuid;
  v_gap bigint;
BEGIN
  PERFORM seva_ops_require_staff(p_staff_id);
  IF p_secret_hash IS NULL OR p_secret_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'secret_hash')::text;
  END IF;
  IF v_label IS NOT NULL AND char_length(v_label) > 80 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'label')::text;
  END IF;
  IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'reason')::text;
  END IF;
  IF p_last_printed_of_no IS NULL OR p_last_printed_of_no NOT BETWEEN 0 AND 999999 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'last_printed_of_no')::text;
  END IF;

  PERFORM 1 FROM counters c WHERE c.id = p_counter_id AND c.active FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'counter')::text;
  END IF;

  SELECT s.code INTO v_series
    FROM receipt_series s
   WHERE s.counter_id = p_counter_id AND s.kind = 'counter_offline';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'receipt_series')::text;
  END IF;

  SELECT p.year INTO v_year FROM seva_ist_parts(v_now) p;
  INSERT INTO receipt_series_years (series_code, year) VALUES (v_series, v_year)
  ON CONFLICT (series_code, year) DO NOTHING;
  SELECT y.last_no INTO v_last
    FROM receipt_series_years y
   WHERE y.series_code = v_series AND y.year = v_year
     FOR UPDATE;

  UPDATE counter_devices
     SET retired_at = v_now,
         retired_by_staff_id = p_staff_id,
         retired_reason = v_reason
   WHERE counter_id = p_counter_id AND retired_at IS NULL
  RETURNING id INTO v_old;

  INSERT INTO counter_devices (counter_id, secret_hash, label, registered_by_staff_id, registered_at)
  VALUES (p_counter_id, p_secret_hash, v_label, p_staff_id, v_now)
  RETURNING id INTO v_new;

  IF p_last_printed_of_no > v_last THEN
    INSERT INTO receipt_number_gaps (series_code, year, from_no, to_no, cause, detected_at)
    VALUES (v_series, v_year, v_last + 1, p_last_printed_of_no, 'device_replaced', v_now)
    RETURNING id INTO v_gap;
    UPDATE receipt_series_years
       SET last_no = p_last_printed_of_no
     WHERE series_code = v_series AND year = v_year;
  END IF;

  PERFORM seva_audit(
    'device.replace', 'counter_device', v_new::text, NULL, v_reason,
    jsonb_build_object('device_id', v_old, 'last_of_no', v_last),
    jsonb_build_object(
      'device_id', v_new, 'counter_id', p_counter_id, 'label', v_label, 'series', v_series, 'year', v_year,
      'last_printed_of_no', p_last_printed_of_no, 'last_of_no', greatest(v_last, p_last_printed_of_no),
      'gap_id', v_gap,
      'gap_from', CASE WHEN v_gap IS NOT NULL THEN v_last + 1 END,
      'gap_to', CASE WHEN v_gap IS NOT NULL THEN p_last_printed_of_no END
    ),
    p_staff_id
  );
  RETURN v_new;
END;
$$;

-- Resolves an open gap as 'entered_from_paper' or 'declared_lost' with a note of at least 3 characters. 'received_late'
-- is set only by the offline sync. Records who and when; audit gap.resolve.
CREATE OR REPLACE FUNCTION seva_resolve_gap(p_gap_id bigint, p_status text, p_note text, p_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_g receipt_number_gaps%ROWTYPE;
BEGIN
  PERFORM seva_ops_require_staff(p_staff_id);
  IF p_status IS NULL OR p_status NOT IN ('entered_from_paper', 'declared_lost') THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'status')::text;
  END IF;
  IF v_note IS NULL OR char_length(v_note) < 3 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'note')::text;
  END IF;

  SELECT * INTO v_g FROM receipt_number_gaps g WHERE g.id = p_gap_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'gap')::text;
  END IF;
  IF v_g.status <> 'open' THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', 'status', 'reason', 'already_resolved')::text;
  END IF;

  UPDATE receipt_number_gaps
     SET status = p_status,
         resolved_at = v_now,
         resolved_by_staff_id = p_staff_id,
         resolution_note = v_note
   WHERE id = v_g.id;

  PERFORM seva_audit(
    'gap.resolve', 'receipt_number_gap', v_g.id::text, NULL, v_note,
    jsonb_build_object('status', v_g.status),
    jsonb_build_object('status', p_status, 'series', v_g.series_code, 'year', v_g.year,
                       'from_no', v_g.from_no, 'to_no', v_g.to_no, 'cause', v_g.cause),
    p_staff_id
  );
END;
$$;

-- The counter's heartbeat (DB 8.3): stores outbox count, clock skew and app version on the live device and returns
-- { server_time, of_series, last_of_no, day_closed } - the server's last OF number this IST year (0 when none yet)
-- and whether today's day close for the counter is closed. A retired or unknown device gets SEVA:device_unknown.
CREATE OR REPLACE FUNCTION seva_heartbeat(
  p_device_id uuid,
  p_outbox_count int,
  p_clock_skew_ms int,
  p_app_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_version text := nullif(btrim(coalesce(p_app_version, '')), '');
  v_counter smallint;
  v_year smallint;
  v_today date;
  v_series text;
  v_last integer;
  v_closed boolean;
BEGIN
  IF p_outbox_count IS NULL OR p_outbox_count < 0 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'outbox_count')::text;
  END IF;
  IF v_version IS NOT NULL AND char_length(v_version) > 40 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'app_version')::text;
  END IF;

  SELECT d.counter_id INTO v_counter
    FROM counter_devices d
   WHERE d.id = p_device_id AND d.retired_at IS NULL
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:device_unknown' USING DETAIL = '{}';
  END IF;

  UPDATE counter_devices
     SET last_seen_at = v_now,
         last_outbox_count = p_outbox_count,
         last_clock_skew_ms = p_clock_skew_ms,
         app_version = v_version
   WHERE id = p_device_id;

  SELECT p.year, p.business_date INTO v_year, v_today FROM seva_ist_parts(v_now) p;
  SELECT s.code INTO v_series FROM receipt_series s WHERE s.counter_id = v_counter AND s.kind = 'counter_offline';
  SELECT y.last_no INTO v_last FROM receipt_series_years y WHERE y.series_code = v_series AND y.year = v_year;
  v_closed := EXISTS (
    SELECT 1 FROM day_closes dc
     WHERE dc.counter_id = v_counter AND dc.business_date = v_today AND dc.status = 'closed'
  );

  RETURN jsonb_build_object(
    'server_time', v_now,
    'of_series', v_series,
    'last_of_no', coalesce(v_last, 0),
    'day_closed', v_closed
  );
END;
$$;

-- =====================================================================================================
-- 3. Day close (DB 7.5, 9.10, C-24, C-25, D23)
-- =====================================================================================================

-- What the close-day screen shows for one counter and IST business date. Counts and amounts cover the receipts of
-- orders made at this counter on that date (test-mode receipts excluded):
--   receipts / cancelled / changed = issued receipts / cancelled receipts / issued receipts with a changed amount;
--   cash_expected = the counter's opening float + issued cash receipts; upi_count / upi_expected = issued UPI receipts;
--   outbox_pending = the live device's last reported outbox count (0 without a live device);
--   series_ranges = the counter's C and OF series: first and last receipt number of the day, issued and cancelled
--   counts (as above) and the series' open gaps (any year: an unresolved gap stays visible until resolved);
--   denominations = the shown cash denominations in display order.
-- Returns { counter_id, business_date, status ('open'|'closed'|'reopened'), opening_float, receipts, cancelled,
--   changed, cash_expected, upi_count, upi_expected, outbox_pending, series_ranges: [{ series, first, last, issued,
--   cancelled, open_gaps }], denominations: [{ kind, value }] } with money as numeric strings.
CREATE OR REPLACE FUNCTION seva_prepare_day_close(p_counter_id smallint, p_business_date date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_float numeric(10,2);
  v_status text;
  v_receipts integer;
  v_cancelled integer;
  v_changed integer;
  v_cash numeric(12,2);
  v_upi_count integer;
  v_upi numeric(12,2);
  v_outbox integer;
  v_ranges jsonb;
  v_denoms jsonb;
BEGIN
  IF p_business_date IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'business_date')::text;
  END IF;

  SELECT c.opening_float INTO v_float FROM counters c WHERE c.id = p_counter_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'counter')::text;
  END IF;

  SELECT dc.status INTO v_status
    FROM day_closes dc
   WHERE dc.counter_id = p_counter_id AND dc.business_date = p_business_date;

  SELECT count(*) FILTER (WHERE r.status = 'issued'),
         count(*) FILTER (WHERE r.status = 'cancelled'),
         count(*) FILTER (WHERE r.status = 'issued' AND r.has_changed_amount),
         coalesce(sum(r.total) FILTER (WHERE r.status = 'issued' AND o.payment_mode = 'cash'), 0),
         count(*) FILTER (WHERE r.status = 'issued' AND o.payment_mode = 'upi'),
         coalesce(sum(r.total) FILTER (WHERE r.status = 'issued' AND o.payment_mode = 'upi'), 0)
    INTO v_receipts, v_cancelled, v_changed, v_cash, v_upi_count, v_upi
    FROM seva_receipts r
    JOIN seva_orders o ON o.id = r.order_id
   WHERE o.counter_id = p_counter_id
     AND r.business_date = p_business_date
     AND NOT r.test_mode;

  SELECT coalesce(max(d.last_outbox_count), 0) INTO v_outbox
    FROM counter_devices d
   WHERE d.counter_id = p_counter_id AND d.retired_at IS NULL;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'series', s.code,
           'first', day.first_no,
           'last', day.last_no,
           'issued', coalesce(day.issued, 0),
           'cancelled', coalesce(day.cancelled, 0),
           'open_gaps', (SELECT count(*) FROM receipt_number_gaps g WHERE g.series_code = s.code AND g.status = 'open')
         ) ORDER BY CASE s.kind WHEN 'counter_online' THEN 0 ELSE 1 END, s.code), '[]'::jsonb)
    INTO v_ranges
    FROM receipt_series s
    LEFT JOIN LATERAL (
      SELECT (array_agg(r.receipt_no ORDER BY r.year, r.running_no))[1] AS first_no,
             (array_agg(r.receipt_no ORDER BY r.year DESC, r.running_no DESC))[1] AS last_no,
             count(*) FILTER (WHERE r.status = 'issued') AS issued,
             count(*) FILTER (WHERE r.status = 'cancelled') AS cancelled
        FROM seva_receipts r
        JOIN seva_orders o ON o.id = r.order_id
       WHERE r.series_code = s.code
         AND o.counter_id = p_counter_id
         AND r.business_date = p_business_date
         AND NOT r.test_mode
    ) day ON true
   WHERE s.counter_id = p_counter_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object('kind', cd.kind, 'value', cd.value::text)
                            ORDER BY cd.display_order, cd.kind, cd.value DESC), '[]'::jsonb)
    INTO v_denoms
    FROM cash_denominations cd
   WHERE cd.shown;

  RETURN jsonb_build_object(
    'counter_id', p_counter_id,
    'business_date', p_business_date,
    'status', coalesce(v_status, 'open'),
    'opening_float', v_float::text,
    'receipts', v_receipts,
    'cancelled', v_cancelled,
    'changed', v_changed,
    'cash_expected', (v_float + v_cash)::numeric(12,2)::text,
    'upi_count', v_upi_count,
    'upi_expected', v_upi::numeric(12,2)::text,
    'outbox_pending', v_outbox,
    'series_ranges', v_ranges,
    'denominations', v_denoms
  );
END;
$$;

-- Closes one counter's IST business date. p_counts = [{ "kind": "note"|"coin", "value": 500, "count": 3 }, ...];
-- the values are stored as given (snapshots), each (kind, value) once. The expected figures come from
-- seva_prepare_day_close at this moment. Needs the live device's outbox empty (SEVA:outbox_not_empty) and, when cash
-- or UPI differs, a note of at least 3 characters (SEVA:difference_note_required; the table check enforces this
-- always). One row per counter and date: a closed day raises SEVA:day_already_closed; a reopened day is closed again
-- on the same row with its counts replaced. Audit dayclose.close. Returns the day close id.
CREATE OR REPLACE FUNCTION seva_close_day(
  p_counter_id smallint,
  p_business_date date,
  p_counts jsonb,
  p_upi_bank_total numeric,
  p_note text,
  p_staff_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_today date;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_el jsonb;
  v_value numeric;
  v_count numeric;
  v_counted numeric(12,2) := 0;
  v_prep jsonb;
  v_expected numeric(12,2);
  v_upi_expected numeric(12,2);
  v_existing day_closes%ROWTYPE;
  v_found boolean;
  v_id uuid;
BEGIN
  PERFORM seva_ops_require_staff(p_staff_id);
  SELECT p.business_date INTO v_today FROM seva_ist_parts(v_now) p;
  IF p_business_date IS NULL OR p_business_date > v_today THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'business_date')::text;
  END IF;
  IF p_upi_bank_total IS NOT NULL AND (p_upi_bank_total < 0 OR p_upi_bank_total <> round(p_upi_bank_total, 2)) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'upi_bank_total')::text;
  END IF;

  -- Validate the counts.
  IF p_counts IS NULL OR jsonb_typeof(p_counts) <> 'array' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'counts')::text;
  END IF;
  FOR v_el IN SELECT e.value FROM jsonb_array_elements(p_counts) e LOOP
    IF jsonb_typeof(v_el) <> 'object'
       OR NOT coalesce(v_el ->> 'kind' IN ('note', 'coin'), false)
       OR coalesce(jsonb_typeof(v_el -> 'value'), '') <> 'number'
       OR coalesce(jsonb_typeof(v_el -> 'count'), '') <> 'number' THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'counts')::text;
    END IF;
    v_value := (v_el ->> 'value')::numeric;
    v_count := (v_el ->> 'count')::numeric;
    IF v_value <= 0 OR v_value > 2000 OR v_value <> round(v_value, 2)
       OR v_count < 0 OR v_count > 100000 OR v_count <> trunc(v_count) THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'counts')::text;
    END IF;
    v_counted := v_counted + v_value * v_count;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_array_elements(p_counts) e)
     <> (SELECT count(DISTINCT (e.value ->> 'kind', (e.value ->> 'value')::numeric)) FROM jsonb_array_elements(p_counts) e) THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', 'counts', 'reason', 'duplicate_denomination')::text;
  END IF;

  -- The counter row lock serialises closes of one counter.
  PERFORM 1 FROM counters c WHERE c.id = p_counter_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'counter')::text;
  END IF;

  SELECT * INTO v_existing
    FROM day_closes dc
   WHERE dc.counter_id = p_counter_id AND dc.business_date = p_business_date
     FOR UPDATE;
  v_found := FOUND;
  IF v_found AND v_existing.status = 'closed' THEN
    RAISE EXCEPTION 'SEVA:day_already_closed'
      USING DETAIL = jsonb_build_object('day_close_id', v_existing.id)::text;
  END IF;

  v_prep := seva_prepare_day_close(p_counter_id, p_business_date);
  IF (v_prep ->> 'outbox_pending')::int > 0 THEN
    RAISE EXCEPTION 'SEVA:outbox_not_empty'
      USING DETAIL = jsonb_build_object('outbox_pending', (v_prep ->> 'outbox_pending')::int)::text;
  END IF;

  v_expected := (v_prep ->> 'cash_expected')::numeric;
  v_upi_expected := (v_prep ->> 'upi_expected')::numeric;
  IF (v_counted <> v_expected OR (p_upi_bank_total IS NOT NULL AND p_upi_bank_total <> v_upi_expected))
     AND coalesce(char_length(v_note), 0) < 3 THEN
    RAISE EXCEPTION 'SEVA:difference_note_required'
      USING DETAIL = jsonb_build_object(
        'cash_difference', (v_counted - v_expected)::text,
        'upi_difference', (coalesce(p_upi_bank_total, v_upi_expected) - v_upi_expected)::numeric(12,2)::text
      )::text;
  END IF;

  IF v_found THEN
    UPDATE day_closes
       SET status = 'closed',
           opening_float = (v_prep ->> 'opening_float')::numeric,
           receipts_count = (v_prep ->> 'receipts')::int,
           cancelled_count = (v_prep ->> 'cancelled')::int,
           changed_count = (v_prep ->> 'changed')::int,
           cash_expected = v_expected,
           cash_counted = v_counted,
           upi_count = (v_prep ->> 'upi_count')::int,
           upi_expected = v_upi_expected,
           upi_bank_total = p_upi_bank_total,
           series_ranges = v_prep -> 'series_ranges',
           outbox_pending = (v_prep ->> 'outbox_pending')::int,
           note = v_note,
           closed_by_staff_id = p_staff_id,
           closed_at = v_now
     WHERE id = v_existing.id;
    v_id := v_existing.id;
    DELETE FROM day_close_counts dcc WHERE dcc.day_close_id = v_id;
  ELSE
    INSERT INTO day_closes (counter_id, business_date, status, opening_float, receipts_count, cancelled_count,
                            changed_count, cash_expected, cash_counted, upi_count, upi_expected, upi_bank_total,
                            series_ranges, outbox_pending, note, closed_by_staff_id, closed_at)
    VALUES (p_counter_id, p_business_date, 'closed', (v_prep ->> 'opening_float')::numeric,
            (v_prep ->> 'receipts')::int, (v_prep ->> 'cancelled')::int, (v_prep ->> 'changed')::int,
            v_expected, v_counted, (v_prep ->> 'upi_count')::int, v_upi_expected, p_upi_bank_total,
            v_prep -> 'series_ranges', (v_prep ->> 'outbox_pending')::int, v_note, p_staff_id, v_now)
    RETURNING id INTO v_id;
  END IF;

  INSERT INTO day_close_counts (day_close_id, kind, value, count)
  SELECT v_id, e.value ->> 'kind', (e.value ->> 'value')::numeric, (e.value ->> 'count')::numeric::int
    FROM jsonb_array_elements(p_counts) e;

  PERFORM seva_audit(
    'dayclose.close', 'day_close', v_id::text, NULL, v_note,
    CASE WHEN v_found THEN jsonb_build_object('status', v_existing.status) END,
    jsonb_build_object(
      'status', 'closed', 'counter_id', p_counter_id, 'business_date', p_business_date,
      'receipts', (v_prep ->> 'receipts')::int, 'cancelled', (v_prep ->> 'cancelled')::int,
      'cash_expected', v_expected::text, 'cash_counted', v_counted::text,
      'cash_difference', (v_counted - v_expected)::text,
      'upi_expected', v_upi_expected::text, 'upi_bank_total', p_upi_bank_total::numeric(12,2)::text
    ),
    p_staff_id
  );
  RETURN v_id;
END;
$$;

-- Reopens a closed day with a reason of at least 3 characters (C-24). The row and its counts are kept until the
-- day is closed again. Audit dayclose.reopen.
CREATE OR REPLACE FUNCTION seva_reopen_day(p_day_close_id uuid, p_reason text, p_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_dc day_closes%ROWTYPE;
BEGIN
  PERFORM seva_ops_require_staff(p_staff_id);
  IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'reason')::text;
  END IF;

  SELECT * INTO v_dc FROM day_closes dc WHERE dc.id = p_day_close_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'day_close')::text;
  END IF;
  IF v_dc.status <> 'closed' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'status', 'reason', 'not_closed')::text;
  END IF;

  UPDATE day_closes
     SET status = 'reopened',
         reopened_by_staff_id = p_staff_id,
         reopened_at = v_now,
         reopen_reason = v_reason
   WHERE id = v_dc.id;

  PERFORM seva_audit(
    'dayclose.reopen', 'day_close', v_dc.id::text, NULL, v_reason,
    jsonb_build_object('status', 'closed'),
    jsonb_build_object('status', 'reopened', 'counter_id', v_dc.counter_id, 'business_date', v_dc.business_date),
    p_staff_id
  );
END;
$$;

-- =====================================================================================================
-- 4. Function privileges: service_role only
-- =====================================================================================================

REVOKE EXECUTE ON FUNCTION seva_ops_require_staff(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_ops_require_staff(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_mark_prasadam(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_mark_prasadam(uuid, uuid, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_undo_prasadam(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_undo_prasadam(uuid, uuid, text, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_register_device(smallint, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_register_device(smallint, text, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_replace_device(smallint, text, text, int, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_replace_device(smallint, text, text, int, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_resolve_gap(bigint, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_resolve_gap(bigint, text, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_heartbeat(uuid, int, int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_heartbeat(uuid, int, int, text) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_prepare_day_close(smallint, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_prepare_day_close(smallint, date) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_close_day(smallint, date, jsonb, numeric, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_close_day(smallint, date, jsonb, numeric, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_reopen_day(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_reopen_day(uuid, text, uuid) TO service_role;
