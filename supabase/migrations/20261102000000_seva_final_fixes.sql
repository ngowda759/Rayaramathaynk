-- Seva Entry - fixes from the whole-branch review of Phase 1 (A5-FIX, part F2: SQL and server, 2026-10-20).
-- Evidence: the A5-3 final review (H-2, M-1, M-2, M-4 and the LOW items L-1, L-2, L-4, L-5, L-8, L-9, L-11).
--
-- Additive: every migration up to 20261101000000_seva_paper_size_not_null.sql is applied on the owner's test project
-- and frozen, so this file only redefines functions (CREATE OR REPLACE keeps their grants) and adds what is new.
-- Rules as in 20261021000000_seva_functions_issue.sql: plpgsql, SECURITY INVOKER, search_path pinned, EXECUTE for
-- service_role only, business errors as 'SEVA:<code>'. Safe to run more than once. Postgres 15 syntax only.

-- =====================================================================================================
-- H-2. Offline sync prices every fixed seva from the catalogue, never from the PC alone
-- =====================================================================================================

-- The rate of a seva in force at p_at, from its append-only rate history: the newest change at or before p_at, else
-- the rate the first later change replaced, else today's rate (no change since). Any-amount sevas have no rate (null).
CREATE OR REPLACE FUNCTION seva_rate_at(p_seva_id uuid, p_at timestamptz)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_seva sevas%ROWTYPE;
  v_rate numeric;
BEGIN
  SELECT s.* INTO v_seva FROM sevas s WHERE s.id = p_seva_id;
  IF NOT FOUND OR v_seva.any_amount THEN
    RETURN NULL;
  END IF;
  SELECT h.new_amount INTO v_rate
    FROM seva_rate_history h
   WHERE h.seva_id = p_seva_id AND h.changed_at <= p_at
   ORDER BY h.changed_at DESC, h.id DESC
   LIMIT 1;
  IF FOUND THEN
    RETURN v_rate;
  END IF;
  SELECT h.old_amount INTO v_rate
    FROM seva_rate_history h
   WHERE h.seva_id = p_seva_id AND h.changed_at > p_at
   ORDER BY h.changed_at, h.id
   LIMIT 1;
  RETURN coalesce(v_rate, v_seva.amount);
END;
$$;

-- Stores an offline order as printed (DB 8.3). H-2: the catalogue rate of a fixed seva is the PC's cached rate only
-- when that rate is today's rate or the rate in force at issued_at; otherwise (a rate the catalogue never had, or no
-- cached rate at all) it is today's rate. A line whose printed rate differs from the catalogue rate is still stored -
-- the slip was printed and paid - but when it carries no reason, or the seva does not allow a changed amount, it is
-- marked changed with an 'Offline price mismatch' reason, so receipt.amount_changed is audited and the receipt shows
-- in Needs attention (changed_amounts). A missing reason no longer refuses the whole outbox item.
-- M-2: an order whose IST business date is already closed for its counter is still stored, but each receipt writes a
-- receipt.synced_into_closed_day audit row (counted by the synced_into_closed_day card) and the answer carries
-- in_closed_day true.
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
  v_trusted boolean;
  v_in_closed_day boolean;
  v_existing_counter smallint;
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
  SELECT o.id, o.counter_id INTO v_existing, v_existing_counter FROM seva_orders o WHERE o.client_order_id = v_client_order_id;
  IF FOUND THEN
    -- L-8: only this counter's own order comes back; another counter's id is a conflict, never its receipts.
    IF v_existing_counter IS DISTINCT FROM v_device.counter_id THEN
      RAISE EXCEPTION 'SEVA:number_conflict'
        USING DETAIL = jsonb_build_object('field', 'client_order_id', 'reason', 'another counter''s order')::text;
    END IF;
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
  -- M-2: a counter-day already closed when its offline receipts arrive.
  v_in_closed_day := EXISTS (
    SELECT 1 FROM day_closes dc
     WHERE dc.counter_id = v_device.counter_id AND dc.business_date = v_business_date AND dc.status = 'closed'
  );

  -- Every sync of this series and year waits here, so the number checks below see every stored number.
  INSERT INTO receipt_series_years (series_code, year)
  VALUES (v_series, v_year)
  ON CONFLICT (series_code, year) DO NOTHING;
  SELECT y.last_no INTO v_last
    FROM receipt_series_years y
   WHERE y.series_code = v_series AND y.year = v_year
     FOR UPDATE;
  -- L-1: read the PC again under the year-row lock, so a sync racing "Replace this PC" sees it retired.
  SELECT d.* INTO v_device FROM counter_devices d WHERE d.id = v_device.id;

  IF jsonb_typeof(p_order->'receipts') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_order->'receipts') NOT BETWEEN 1 AND 31 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipts')::text;
  END IF;
  -- Printed receipts already stored (same client_receipt_id) are ignored as a duplicate (DB 8.3).
  SELECT r.order_id, o.counter_id INTO v_existing, v_existing_counter
    FROM jsonb_array_elements(p_order->'receipts') AS x(value)
    JOIN seva_receipts r ON r.client_receipt_id = seva_issue_arg_uuid(x.value->>'client_receipt_id', 'client_receipt_id')
    JOIN seva_orders o ON o.id = r.order_id
   WHERE jsonb_typeof(x.value) = 'object'
   LIMIT 1;
  IF FOUND THEN
    IF v_existing_counter IS DISTINCT FROM v_device.counter_id THEN
      RAISE EXCEPTION 'SEVA:number_conflict'
        USING DETAIL = jsonb_build_object('field', 'client_receipt_id', 'reason', 'another counter''s receipt')::text;
    END IF;
    RETURN seva_order_json(v_existing, true);
  END IF;

  -- The PC's group label, 'G-YYMM-OF<n>-NNN' (C-19); it must be this counter's and unused.
  v_group_no := btrim(coalesce(p_order->>'group_no', ''));
  IF v_group_no !~ ('^G-[0-9]{4}-' || v_series || '-[0-9]{3,6}$') THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'group_no')::text;
  END IF;

  -- Who printed these receipts: their numbers carry this person's staff number.
  v_issuer := seva_issue_offline_issuer(p_order->>'issuer_staff_no', p_issuer_role, 'issuer_staff_no', v_issued_at);

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

      -- H-2: the catalogue rate is the PC's cached rate only when the catalogue had it (today's rate, or the rate in
      -- force at issued_at); otherwise today's rate. An any-amount seva, told by its flag, has none. The printed rate
      -- is the typed rate, else the cached rate the PC printed from, else the catalogue rate.
      IF v_seva.any_amount THEN
        v_catalogue := NULL;
        v_trusted := true;
        v_unit := v_unit_in;
      ELSE
        v_trusted := coalesce(v_cached = v_seva.amount OR v_cached = seva_rate_at(v_seva.id, v_issued_at), false);
        v_catalogue := CASE WHEN v_trusted THEN v_cached ELSE v_seva.amount END;
        v_unit := coalesce(v_unit_in, v_cached, v_catalogue);
      END IF;
      IF v_unit IS NULL OR v_unit <= 0 OR v_unit > 99999999.99 THEN
        RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'unit_rate')::text;
      END IF;
      v_changed := v_catalogue IS NOT NULL AND v_unit <> v_catalogue;
      IF v_changed THEN
        -- A change the office can trust: from a catalogue rate, on a seva that allows it, with a reason. Anything else
        -- was printed and paid, so it is stored, but marked with a system reason that says so (and keeps the PC's).
        IF NOT (v_trusted AND v_seva.allow_amount_change AND coalesce(char_length(btrim(v_reason)), 0) >= 3) THEN
          v_reason := 'Offline price mismatch: printed ' || v_unit::text || ', catalogue ' || v_catalogue::text
                      || CASE WHEN NOT v_seva.allow_amount_change THEN ' (this seva does not allow a changed amount)'
                              ELSE '' END
                      || coalesce('; PC reason: ' || nullif(btrim(v_reason), ''), '');
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
        'offline_rate_differs', (NOT v_seva.any_amount AND v_trusted AND v_catalogue <> v_seva.amount),
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
         AND g.device_id = v_device.id
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
    -- M-2: the counter-day of this receipt was closed before it arrived. It is stored (printed and paid), but the
    -- stored close is now short, so the office is told: an audit row per receipt and the synced_into_closed_day card.
    IF v_in_closed_day THEN
      PERFORM seva_audit(
        'receipt.synced_into_closed_day', 'receipt', v_receipt_id::text, v_receipt_no,
        'An offline receipt reached the office after its counter-day was closed',
        NULL,
        jsonb_build_object('business_date', v_business_date, 'counter_id', v_device.counter_id,
                           'total', ((v_receipt.body->>'total')::numeric)::numeric(12,2)::text,
                           'payment_mode', v_payment->>'mode', 'issuer_staff_id', v_issuer.id,
                           'synced_by_staff_id', v_syncer.id),
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
  RETURN seva_order_json(v_order_id, false)
      || CASE WHEN v_in_closed_day THEN jsonb_build_object('in_closed_day', true) ELSE '{}'::jsonb END;
END;
$$;

REVOKE EXECUTE ON FUNCTION seva_rate_at(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_rate_at(uuid, timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_sync_offline_order(jsonb, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_sync_offline_order(jsonb, uuid, uuid, text) TO service_role;

-- =====================================================================================================
-- M-1. An online cancel on a closed day: refused for the counter, a refund due for an admin
-- =====================================================================================================

-- As in 20261021000000_seva_functions_issue.sql, with one change (M-1): in_closed_day is now worked out for every
-- cancel. For an online cancel it is true when the receipt's own business date is already closed for its counter. A
-- receptionist (p_is_admin false) is then refused with SEVA:day_closed, because a closed day changes only after a
-- temple admin reopens it (DB 3.3 row 7). An admin may still cancel, but the cash was already counted and handed over,
-- so a cash cancel in a closed day is refund_state due (cash_back 0), flagged in_closed_day in the answer and in the
-- audit row's after, with closed_business_date. The offline rules are unchanged.
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
  v_closed_date date;
  v_in_closed_day boolean;
  v_late boolean;
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
    -- The canceller is checked per receipt, at the clamped cancel time (below).
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
    IF v_offline THEN
      -- The offboarding rule is checked at v_at, the time the cancel is stored with, not at the raw p_at.
      v_staff := seva_issue_offline_issuer(p_cancelled_by_staff_no::text, p_canceller_role, 'cancelled_by_staff_no', v_at);
    END IF;
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
    -- An offline cancel recorded on a day the counter has already closed is kept, and flagged for the office. M-1: an
    -- online cancel of a receipt whose own business date is closed is refused for the counter and flagged for an admin.
    v_closed_date := CASE WHEN v_offline THEN v_at_date ELSE v_receipt.business_date END;
    v_in_closed_day := EXISTS (
      SELECT 1 FROM day_closes dc
       WHERE dc.counter_id = v_counter_id AND dc.business_date = v_closed_date AND dc.status = 'closed'
    );
    IF v_in_closed_day AND NOT v_offline AND NOT v_is_admin THEN
      RAISE EXCEPTION 'SEVA:day_closed'
        USING DETAIL = jsonb_build_object('business_date', v_closed_date, 'receipt_no', v_receipt.receipt_no)::text;
    END IF;
    -- An offline cancel that reached the server after the online cancel window had closed: more than the window after
    -- the receipt's issue time (A3 gate M-2, re-review N-2). v_at >= issued_at, so this includes arriving more than
    -- the window after the recorded time.
    v_late := v_offline AND v_now > v_receipt.issued_at + make_interval(mins => v_window);
    -- Such a late offline cash cancel, and one recorded in a closed day, are left for the office: the drawer cannot
    -- be trusted to have handed the cash back.
    IF v_mode = 'cash' AND v_receipt.business_date = v_at_date AND NOT v_late AND NOT v_in_closed_day THEN
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
                                               'in_closed_day', v_in_closed_day, 'late_sync', v_late);
      IF v_in_closed_day THEN
        v_after := v_after || jsonb_build_object('closed_business_date', v_at_date);
      END IF;
      v_route_role := seva_issue_actor_role(p_canceller_role);
    ELSIF v_in_closed_day THEN
      v_after := v_after || jsonb_build_object('in_closed_day', true, 'closed_business_date', v_closed_date);
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

REVOKE EXECUTE ON FUNCTION seva_cancel_receipts(uuid[], text, text, uuid, boolean, timestamptz, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_cancel_receipts(uuid[], text, text, uuid, boolean, timestamptz, integer, text) TO service_role;

-- =====================================================================================================
-- M-2. Offline receipts that sync into a closed day are flagged; the close needs the counter online
-- =====================================================================================================

-- As in 20261021000200_seva_functions_admin.sql, plus one card at the end (M-2): synced_into_closed_day, critical,
-- counts the receipt.synced_into_closed_day audit rows written in the period, with their amount and the oldest
-- business date they changed.
CREATE OR REPLACE FUNCTION seva_needs_attention(p_from timestamptz, p_to timestamptz, p_today date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_zone constant text := 'Asia/Kolkata';
  v_from_date date;
  v_to_date date;
  v_now_l timestamp := now() AT TIME ZONE c_zone;
  v_window integer;
  v_threshold numeric;
  v_cards jsonb := '[]'::jsonb;
  v_n integer;
  v_m integer;
  v_k integer;
  v_text text;
  v_num numeric;
  v_last ops_backup_runs%ROWTYPE;
  v_last_ok timestamptz;
  v_size bigint;
  v_entries jsonb;
  v_upi audit_log%ROWTYPE;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_today IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'range')::text;
  END IF;
  v_from_date := (p_from AT TIME ZONE c_zone)::date;
  v_to_date := ((p_to - interval '1 microsecond') AT TIME ZONE c_zone)::date;
  SELECT s.cancel_window_minutes, s.day_close_flag_threshold INTO v_window, v_threshold FROM seva_settings s WHERE s.id = 1;
  v_window := coalesce(v_window, 30);
  v_threshold := coalesce(v_threshold, 0);

  -- changed_amounts: receipts with a changed amount issued in the period.
  SELECT count(*)::int INTO v_n
    FROM seva_receipts r
   WHERE r.has_changed_amount AND NOT r.test_mode AND r.issued_at >= p_from AND r.issued_at < p_to;
  v_cards := v_cards || jsonb_build_object('id', 'changed_amounts', 'level', CASE WHEN v_n > 0 THEN 'attention' ELSE 'ok' END,
                                           'count', v_n, 'detail', '{}'::jsonb);

  -- cancellations: receipts cancelled in the period; those cancelled after the cancel window are named.
  SELECT count(*)::int,
         (count(*) FILTER (WHERE r.cancelled_at > r.issued_at + make_interval(mins => v_window)))::int,
         string_agg(r.receipt_no, ', ' ORDER BY r.cancelled_at)
           FILTER (WHERE r.cancelled_at > r.issued_at + make_interval(mins => v_window))
    INTO v_n, v_m, v_text
    FROM seva_receipts r
   WHERE r.status = 'cancelled' AND NOT r.test_mode AND r.cancelled_at >= p_from AND r.cancelled_at < p_to;
  v_cards := v_cards || jsonb_build_object('id', 'cancellations', 'level', CASE WHEN v_n > 0 THEN 'attention' ELSE 'ok' END,
                                           'count', v_n,
                                           'detail', jsonb_strip_nulls(jsonb_build_object('after_window', v_m,
                                                                                          'after_window_receipts', v_text)));

  -- day_close_difference: closes in the period whose cash or UPI difference passes the threshold (C-26).
  SELECT (count(*) FILTER (WHERE d.cash_difference < -v_threshold OR d.upi_difference < -v_threshold))::int,
         (count(*) FILTER (WHERE NOT (d.cash_difference < -v_threshold OR d.upi_difference < -v_threshold)
                             AND (d.cash_difference > v_threshold OR d.upi_difference > v_threshold)))::int
    INTO v_m, v_k
    FROM day_closes d
   WHERE d.status = 'closed' AND d.business_date BETWEEN v_from_date AND v_to_date;
  v_n := v_m + v_k;
  v_cards := v_cards || jsonb_build_object('id', 'day_close_difference',
                                           'level', CASE WHEN v_m > 0 THEN 'critical' WHEN v_k > 0 THEN 'attention' ELSE 'ok' END,
                                           'count', v_n, 'detail', jsonb_build_object('short', v_m, 'extra', v_k));

  -- day_not_closed: before today, a counter-day with receipts and no closed day close.
  SELECT count(*)::int, min(x.business_date)::text INTO v_n, v_text
    FROM (
      SELECT DISTINCT o.counter_id, r.business_date
        FROM seva_receipts r JOIN seva_orders o ON o.id = r.order_id
       WHERE o.counter_id IS NOT NULL AND NOT r.test_mode AND r.business_date < p_today
    ) x
   WHERE NOT EXISTS (SELECT 1 FROM day_closes d
                      WHERE d.counter_id = x.counter_id AND d.business_date = x.business_date AND d.status = 'closed');
  v_cards := v_cards || jsonb_build_object('id', 'day_not_closed', 'level', CASE WHEN v_n > 0 THEN 'critical' ELSE 'ok' END,
                                           'count', v_n, 'detail', jsonb_strip_nulls(jsonb_build_object('oldest_date', v_text)));

  -- waiting_to_sync: live counter PCs reporting a non-empty outbox, or (during the IST day, 05:00-22:00, for the
  -- day being viewed) seen today but not in the last 10 minutes on a counter whose day is not closed.
  SELECT count(*)::int, coalesce(sum(cd.last_outbox_count), 0)::int INTO v_n, v_m
    FROM counter_devices cd
    JOIN counters c ON c.id = cd.counter_id AND c.active
   WHERE cd.retired_at IS NULL
     AND (cd.last_outbox_count > 0
          OR (v_now_l::date = p_today AND extract(hour FROM v_now_l) BETWEEN 5 AND 21
              AND cd.last_seen_at IS NOT NULL
              AND (cd.last_seen_at AT TIME ZONE c_zone)::date = p_today
              AND cd.last_seen_at < now() - interval '10 minutes'
              AND NOT EXISTS (SELECT 1 FROM day_closes d
                               WHERE d.counter_id = cd.counter_id AND d.business_date = p_today AND d.status = 'closed')));
  v_cards := v_cards || jsonb_build_object('id', 'waiting_to_sync', 'level', CASE WHEN v_n > 0 THEN 'attention' ELSE 'ok' END,
                                           'count', v_n, 'detail', jsonb_build_object('outbox', v_m));

  -- number_gaps: every open gap (DB 8.5).
  SELECT count(*)::int, coalesce(sum(g.to_no - g.from_no + 1), 0)::int INTO v_n, v_m
    FROM receipt_number_gaps g WHERE g.status = 'open';
  v_cards := v_cards || jsonb_build_object('id', 'number_gaps', 'level', CASE WHEN v_n > 0 THEN 'critical' ELSE 'ok' END,
                                           'count', v_n, 'detail', jsonb_build_object('missing_numbers', v_m));

  -- prasadam_pending: pending for today's seva date (with the oldest issue time), plus past seva dates in the period.
  SELECT (count(*) FILTER (WHERE r.seva_date = p_today))::int,
         (count(*) FILTER (WHERE r.seva_date >= v_from_date AND r.seva_date < p_today))::int,
         to_char(min(r.issued_at) FILTER (WHERE r.seva_date = p_today) AT TIME ZONE c_zone, 'HH24:MI')
    INTO v_m, v_k, v_text
    FROM seva_receipts r
   WHERE r.status = 'issued' AND NOT r.test_mode AND r.prasadam_state = 'pending'
     AND r.seva_date <= p_today AND r.seva_date >= least(v_from_date, p_today);
  v_n := v_m + v_k;
  v_cards := v_cards || jsonb_build_object('id', 'prasadam_pending', 'level', CASE WHEN v_n > 0 THEN 'attention' ELSE 'ok' END,
                                           'count', v_n,
                                           'detail', jsonb_strip_nulls(jsonb_build_object('today', v_m, 'past', v_k,
                                                                                          'oldest_today', v_text)));

  -- upi_refunds_due: every receipt whose refund is due (C-20).
  SELECT count(*)::int, coalesce(sum(r.total), 0) INTO v_n, v_num
    FROM seva_receipts r WHERE r.refund_state = 'due' AND NOT r.test_mode;
  v_cards := v_cards || jsonb_build_object('id', 'upi_refunds_due', 'level', CASE WHEN v_n > 0 THEN 'attention' ELSE 'ok' END,
                                           'count', v_n, 'detail', jsonb_build_object('amount', v_num::numeric(12,2)::text));

  -- clock_skew: live counter PCs more than 2 minutes off.
  SELECT count(*)::int, coalesce(max(abs(cd.last_clock_skew_ms::bigint)) / 1000, 0)::int INTO v_n, v_m
    FROM counter_devices cd
   WHERE cd.retired_at IS NULL AND abs(cd.last_clock_skew_ms::bigint) > 120000;
  v_cards := v_cards || jsonb_build_object('id', 'clock_skew', 'level', CASE WHEN v_n > 0 THEN 'attention' ELSE 'ok' END,
                                           'count', v_n, 'detail', jsonb_build_object('max_skew_seconds', v_m));

  -- backup: the last finished nightly backup failed, or the last good one is older than 36 hours, or none ever ran.
  SELECT * INTO v_last FROM ops_backup_runs b WHERE b.finished_at IS NOT NULL ORDER BY b.finished_at DESC, b.id DESC LIMIT 1;
  SELECT max(b.finished_at) INTO v_last_ok FROM ops_backup_runs b WHERE b.ok AND b.finished_at IS NOT NULL;
  v_text := CASE
              WHEN v_last.id IS NULL THEN 'never'
              WHEN v_last.ok IS NOT TRUE THEN 'failed'
              WHEN v_last_ok < now() - interval '36 hours' THEN 'stale'
            END;
  v_cards := v_cards || jsonb_build_object('id', 'backup', 'level', CASE WHEN v_text IS NULL THEN 'ok' ELSE 'critical' END,
                                           'count', CASE WHEN v_text IS NULL THEN 0 ELSE 1 END,
                                           'detail', jsonb_strip_nulls(jsonb_build_object('reason', v_text,
                                                                                          'last_ok_at', v_last_ok)));

  -- database_size: above 400 MB of the 500 MB free plan (DB 7.9).
  v_size := pg_database_size(current_database());
  v_cards := v_cards || jsonb_build_object('id', 'database_size',
                                           'level', CASE WHEN v_size > 400::bigint * 1024 * 1024 THEN 'attention' ELSE 'ok' END,
                                           'count', CASE WHEN v_size > 400::bigint * 1024 * 1024 THEN 1 ELSE 0 END,
                                           'detail', jsonb_build_object('mb', round(v_size / 1048576.0)::int));

  -- in_doubt_duplicates: an offline order that superseded an online order which still has issued receipts (C-53).
  SELECT count(*)::int INTO v_n
    FROM seva_orders o
   WHERE o.supersedes_order_id IS NOT NULL AND NOT o.test_mode
     AND EXISTS (SELECT 1 FROM seva_receipts r WHERE r.order_id = o.supersedes_order_id AND r.status = 'issued');
  v_cards := v_cards || jsonb_build_object('id', 'in_doubt_duplicates', 'level', CASE WHEN v_n > 0 THEN 'attention' ELSE 'ok' END,
                                           'count', v_n, 'detail', '{}'::jsonb);

  -- future_offline: offline receipts received in the period and dated more than 2 minutes after they reached the
  -- server (a PC clock running fast, DB 8.3).
  SELECT count(*)::int INTO v_n
    FROM seva_receipts r JOIN seva_orders o ON o.id = r.order_id
   WHERE r.issued_offline AND NOT r.test_mode
     AND o.received_at >= p_from AND o.received_at < p_to
     AND r.issued_at > o.received_at + interval '2 minutes';
  v_cards := v_cards || jsonb_build_object('id', 'future_offline', 'level', CASE WHEN v_n > 0 THEN 'attention' ELSE 'ok' END,
                                           'count', v_n, 'detail', '{}'::jsonb);

  -- offline_cancels: cancels the outbox sent in the period (receipt.cancel audit rows marked offline), newest first,
  -- each with the receipt, the time recorded on the PC, the time it reached the server, who cancelled and who sent it
  -- (at most 50 entries; count is all of them). The server cannot verify an offline claim, so it shows it: attention
  -- when one was sent by someone other than the canceller, arrived more than the cancel window after its recorded
  -- time (A3 security gate M-2), or was late_sync - it arrived after the receipt's issue time plus the window (A3
  -- re-review N-2).
  SELECT count(*)::int,
         (count(*) FILTER (WHERE x.flagged))::int,
         coalesce(jsonb_agg(jsonb_build_object('receipt_no', x.receipt_no, 'recorded_at', x.recorded_at,
                                               'received_at', x.received_at,
                                               'cancelled_by', coalesce(sc.full_name, ''),
                                               'synced_by', coalesce(ss.full_name, ''), 'flagged', x.flagged)
                            ORDER BY x.id DESC) FILTER (WHERE x.rn <= 50),
                  '[]'::jsonb)
    INTO v_n, v_m, v_entries
    FROM (
      SELECT a.id, a.receipt_no, a.at AS received_at, (a.after ->> 'cancelled_at')::timestamptz AS recorded_at,
             a.actor_staff_id AS canceller_id, (a.after ->> 'synced_by_staff_id')::uuid AS syncer_id,
             (a.actor_staff_id IS DISTINCT FROM (a.after ->> 'synced_by_staff_id')::uuid
              OR a.at > (a.after ->> 'cancelled_at')::timestamptz + make_interval(mins => v_window)
              OR coalesce((a.after ->> 'late_sync')::boolean, false)) AS flagged,
             row_number() OVER (ORDER BY a.id DESC) AS rn
        FROM audit_log a
       WHERE a.action = 'receipt.cancel' AND a.after ->> 'offline' = 'true' AND a.at >= p_from AND a.at < p_to
    ) x
    LEFT JOIN staff sc ON sc.id = x.canceller_id
    LEFT JOIN staff ss ON ss.id = x.syncer_id;
  v_cards := v_cards || jsonb_build_object('id', 'offline_cancels', 'level', CASE WHEN v_m > 0 THEN 'attention' ELSE 'ok' END,
                                           'count', v_n, 'detail', jsonb_build_object('flagged', v_m),
                                           'entries', v_entries);

  -- upi_changed: every change of the counter's UPI payee in the last 30 days (settings.upi_changed rows written by
  -- seva_note_counter_upi), whatever period the dashboard shows, so a change made on a day nobody opened the
  -- dashboard stays on the card (A3 security gate H-1, re-review N-1); count is all of them, the detail names the
  -- latest, masked, and window_days says how far back the card looks.
  SELECT count(*)::int INTO v_n
    FROM audit_log a WHERE a.action = 'settings.upi_changed' AND a.at >= now() - interval '30 days';
  SELECT a.* INTO v_upi
    FROM audit_log a WHERE a.action = 'settings.upi_changed' AND a.at >= now() - interval '30 days'
   ORDER BY a.at DESC, a.id DESC LIMIT 1;
  v_cards := v_cards || jsonb_build_object('id', 'upi_changed', 'level', CASE WHEN v_n > 0 THEN 'attention' ELSE 'ok' END,
                                           'count', v_n,
                                           'detail', jsonb_strip_nulls(jsonb_build_object(
                                             'from_vpa', v_upi.before ->> 'vpa', 'to_vpa', v_upi.after ->> 'vpa',
                                             'changed_at', v_upi.at, 'window_days', 30)));

  -- synced_into_closed_day (A5-FIX M-2): offline receipts that reached the office in the period after their
  -- counter-day was closed; the stored close is short by their amount until an admin reopens and closes it again.
  SELECT count(*)::int, coalesce(sum((a.after ->> 'total')::numeric), 0), min(a.after ->> 'business_date')
    INTO v_n, v_num, v_text
    FROM audit_log a
   WHERE a.action = 'receipt.synced_into_closed_day' AND a.at >= p_from AND a.at < p_to;
  v_cards := v_cards || jsonb_build_object('id', 'synced_into_closed_day',
                                           'level', CASE WHEN v_n > 0 THEN 'critical' ELSE 'ok' END,
                                           'count', v_n,
                                           'detail', jsonb_strip_nulls(jsonb_build_object(
                                             'amount', v_num::numeric(12,2)::text, 'oldest_date', v_text)));

  RETURN v_cards;
END;
$$;

-- As in 20261021000100_seva_functions_ops.sql, plus (M-2) the counter must be online: when its live PC last reported
-- (last_seen_at) more than 2 minutes ago, its "nothing waiting" cannot be trusted and the close is refused with
-- SEVA:outbox_not_empty (detail reason counter_not_seen). A PC that has never reported is not checked. A temple admin
-- may close anyway with p_counter_offline_ok (the route passes it only for an admin); the dayclose.close audit row
-- then carries counter_offline_override and counter_last_seen_at. The old six-argument signature is dropped so no
-- stale overload stays callable; the new argument has a default, so a six-argument call still works.
-- L-9: every count must be a denomination the settings show (cash_denominations.shown), else SEVA:validation (field
-- counts, reason unknown_denomination).
DROP FUNCTION IF EXISTS seva_close_day(smallint, date, jsonb, numeric, text, uuid);
CREATE OR REPLACE FUNCTION seva_close_day(
  p_counter_id smallint,
  p_business_date date,
  p_counts jsonb,
  p_upi_bank_total numeric,
  p_note text,
  p_staff_id uuid,
  p_counter_offline_ok boolean DEFAULT false
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
  v_seen timestamptz;
  v_offline_override boolean := false;
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
  -- L-9: only the denominations the settings show, so an invented value cannot zero a difference and skip the note.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_counts) e
     WHERE NOT EXISTS (SELECT 1 FROM cash_denominations cd
                        WHERE cd.shown AND cd.kind = e.value ->> 'kind' AND cd.value = (e.value ->> 'value')::numeric)
  ) THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', 'counts', 'reason', 'unknown_denomination')::text;
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
  -- M-2: the outbox count is only as fresh as the live PC's last report (a heartbeat a minute).
  SELECT max(d.last_seen_at) INTO v_seen
    FROM counter_devices d
   WHERE d.counter_id = p_counter_id AND d.retired_at IS NULL;
  IF v_seen IS NOT NULL AND v_seen < v_now - interval '2 minutes' THEN
    IF NOT coalesce(p_counter_offline_ok, false) THEN
      RAISE EXCEPTION 'SEVA:outbox_not_empty'
        USING DETAIL = jsonb_build_object('outbox_pending', (v_prep ->> 'outbox_pending')::int,
                                          'reason', 'counter_not_seen', 'last_seen_at', v_seen)::text;
    END IF;
    v_offline_override := true;
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
    ) || CASE WHEN v_offline_override
              THEN jsonb_build_object('counter_offline_override', true, 'counter_last_seen_at', v_seen)
              ELSE '{}'::jsonb END,
    p_staff_id
  );
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION seva_needs_attention(timestamptz, timestamptz, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_needs_attention(timestamptz, timestamptz, date) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_close_day(smallint, date, jsonb, numeric, text, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_close_day(smallint, date, jsonb, numeric, text, uuid, boolean) TO service_role;

-- =====================================================================================================
-- M-4. "Replace this PC" records the unsent numbers in the year of the last slip
-- =====================================================================================================

-- As the six-argument seva_replace_device of 20261021000100_seva_functions_ops.sql, but the last printed slip's IST
-- year is given (p_last_printed_year): this IST year or the one before it (never before 2026). That year's OF row is
-- locked, and the open device_replaced gap and the raised last_no go there, so a PC that died on 31 December holding
-- unsent numbers leaves a gap in that year (DB 8.5: a gap is never hidden) and its late upload is still accepted
-- (DB 8.4), while the new year starts at 000001. The new PC's group-label floor still counts the current year's gaps
-- only: a gap of another year holds labels of that year's months.
CREATE OR REPLACE FUNCTION seva_replace_device(
  p_counter_id smallint,
  p_secret_hash text,
  p_label text,
  p_last_printed_of_no int,
  p_last_printed_year smallint,
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
  v_month smallint;
  v_slip_year smallint;
  v_series text;
  v_last integer;
  v_old uuid;
  v_new uuid;
  v_gap bigint;
  v_group_floor integer;
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
  SELECT p.year, p.month INTO v_year, v_month FROM seva_ist_parts(v_now) p;
  v_slip_year := p_last_printed_year;
  IF v_slip_year IS NULL OR v_slip_year NOT BETWEEN greatest(2026, v_year - 1) AND v_year THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', 'last_printed_year', 'year', v_year)::text;
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

  INSERT INTO receipt_series_years (series_code, year) VALUES (v_series, v_slip_year)
  ON CONFLICT (series_code, year) DO NOTHING;
  SELECT y.last_no INTO v_last
    FROM receipt_series_years y
   WHERE y.series_code = v_series AND y.year = v_slip_year
     FOR UPDATE;

  UPDATE counter_devices
     SET retired_at = v_now,
         retired_by_staff_id = p_staff_id,
         retired_reason = v_reason
   WHERE counter_id = p_counter_id AND retired_at IS NULL
  RETURNING id INTO v_old;

  IF p_last_printed_of_no > v_last THEN
    INSERT INTO receipt_number_gaps (series_code, year, from_no, to_no, cause, detected_at, device_id)
    VALUES (v_series, v_slip_year, v_last + 1, p_last_printed_of_no, 'device_replaced', v_now, v_old)
    RETURNING id INTO v_gap;
    UPDATE receipt_series_years
       SET last_no = p_last_printed_of_no
     WHERE series_code = v_series AND year = v_slip_year;
  END IF;

  -- The labels the old PC (and any PC replaced before it) may have printed but not sent this year: one per missing
  -- OF number of this IST year's open device_replaced gaps.
  SELECT seva_offline_group_floor(p_counter_id, v_old, v_now) + coalesce(sum(g.to_no - g.from_no + 1), 0)::integer
    INTO v_group_floor
    FROM receipt_number_gaps g
   WHERE g.series_code = v_series AND g.year = v_year AND g.cause = 'device_replaced' AND g.status = 'open';

  INSERT INTO counter_devices (counter_id, secret_hash, label, registered_by_staff_id, registered_at,
                               of_group_floor_yymm, of_group_floor_no)
  VALUES (p_counter_id, p_secret_hash, v_label, p_staff_id, v_now,
          lpad((v_year % 100)::text, 2, '0') || lpad(v_month::text, 2, '0'), v_group_floor)
  RETURNING id INTO v_new;

  PERFORM seva_audit(
    'device.replace', 'counter_device', v_new::text, NULL, v_reason,
    jsonb_build_object('device_id', v_old, 'last_of_no', v_last),
    jsonb_build_object(
      'device_id', v_new, 'counter_id', p_counter_id, 'label', v_label, 'series', v_series, 'year', v_slip_year,
      'last_printed_of_no', p_last_printed_of_no, 'last_of_no', greatest(v_last, p_last_printed_of_no),
      'gap_id', v_gap,
      'gap_from', CASE WHEN v_gap IS NOT NULL THEN v_last + 1 END,
      'gap_to', CASE WHEN v_gap IS NOT NULL THEN p_last_printed_of_no END,
      'group_floor', v_group_floor
    ),
    p_staff_id
  );
  RETURN v_new;
END;
$$;

-- The six-argument form keeps its meaning (the slip is of this IST year) and its grants; it calls the form above.
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
BEGIN
  RETURN seva_replace_device(p_counter_id, p_secret_hash, p_label, p_last_printed_of_no,
                             (SELECT p.year FROM seva_ist_parts(now()) p), p_reason, p_staff_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION seva_replace_device(smallint, text, text, int, smallint, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_replace_device(smallint, text, text, int, smallint, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_replace_device(smallint, text, text, int, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_replace_device(smallint, text, text, int, text, uuid) TO service_role;

-- =====================================================================================================
-- L-8. A repeated client id returns the stored order only to its own counter
-- =====================================================================================================

-- As in 20261021000000_seva_functions_issue.sql, with one change (L-8): a repeated client_order_id returns the stored
-- order only when it is this PC's counter's order; another counter's id is SEVA:number_conflict (field
-- client_order_id), so its receipts and QR tokens never go to another counter. (seva_sync_offline_order above does
-- the same for a repeated client_order_id or client_receipt_id.)
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
  v_existing_counter smallint;
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
  SELECT o.id, o.counter_id INTO v_existing, v_existing_counter FROM seva_orders o WHERE o.client_order_id = v_client_order_id;
  IF FOUND THEN
    IF v_existing_counter IS DISTINCT FROM v_device.counter_id THEN
      RAISE EXCEPTION 'SEVA:number_conflict'
        USING DETAIL = jsonb_build_object('field', 'client_order_id', 'reason', 'another counter''s order')::text;
    END IF;
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

REVOKE EXECUTE ON FUNCTION seva_issue_counter_order(jsonb, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_counter_order(jsonb, uuid, uuid) TO service_role;

-- =====================================================================================================
-- L-1. A device_replaced gap belongs to the PC that was retired
-- =====================================================================================================

-- The PC retired by "Replace this PC": only that PC's late upload may fill the gap (seva_sync_offline_order above),
-- not any retired PC of the series. seva_replace_device above sets it; gaps written before this file have none, so no
-- retired PC can fill them (an admin resolves them in the register).
ALTER TABLE receipt_number_gaps ADD COLUMN IF NOT EXISTS device_id uuid REFERENCES counter_devices (id) ON DELETE RESTRICT;
COMMENT ON COLUMN receipt_number_gaps.device_id IS
  'device_replaced gaps: the retired PC whose late upload may fill the gap (A5-FIX L-1); null otherwise';

-- As in 20261021000000_seva_functions_issue.sql, but a gap split in two keeps its device_id (L-1).
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
    INSERT INTO receipt_number_gaps (series_code, year, from_no, to_no, cause, status, detected_at, device_id)
    VALUES (v_gap.series_code, v_gap.year, p_no + 1, v_gap.to_no, v_gap.cause, 'open', v_gap.detected_at, v_gap.device_id);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION seva_issue_fill_gap(bigint, integer, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_fill_gap(bigint, integer, timestamptz) TO service_role;
