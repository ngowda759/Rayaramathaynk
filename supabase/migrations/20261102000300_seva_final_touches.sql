-- Seva Entry - the re-check's leftovers (FINAL-FIX, 2026-10-20).
--
-- Additive: every migration up to 20261102000000_seva_final_fixes.sql is applied on the owner's test project and
-- frozen; 20261102000100_seva_refunds_paper.sql and 20261102000200_seva_followups.sql come before this file. This file
-- only redefines functions (CREATE OR REPLACE keeps their grants), each from its newest definition, and adds NOT VALID
-- checks. Rules as in 20261021000000_seva_functions_issue.sql: plpgsql, SECURITY INVOKER, search_path pinned, EXECUTE
-- for service_role only, business errors as 'SEVA:<code>'. Safe to run more than once. Postgres 15 syntax only.

-- =====================================================================================================
-- N-2. Offline sync trusts a cached rate only when it is the rate in force at the line's issued_at
-- =====================================================================================================

-- As in 20261102000000_seva_final_fixes.sql, with one change (N-2): the catalogue rate of a fixed seva is always the
-- rate in force at issued_at (seva_rate_at), and the PC's cached rate is trusted only when it equals that rate. Before,
-- a cached rate equal to today's rate was trusted too, so a rate lowered between the print and the sync let a slip
-- printed at the old, higher rate be stored at the lower one with no flag. Now that line is stored as printed but
-- marked changed with the 'Offline price mismatch' reason, audited receipt.amount_changed, and counted by the
-- changed_amounts card.
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

      -- H-2, N-2: the catalogue rate is the rate in force at issued_at (seva_rate_at, from the rate history). The PC's
      -- cached rate is trusted only when it equals that rate: today's rate never makes a lower price trusted. An
      -- any-amount seva, told by its flag, has none. The printed rate is the typed rate, else the cached rate the PC
      -- printed from, else the catalogue rate.
      IF v_seva.any_amount THEN
        v_catalogue := NULL;
        v_trusted := true;
        v_unit := v_unit_in;
      ELSE
        v_catalogue := seva_rate_at(v_seva.id, v_issued_at);
        v_trusted := coalesce(v_cached = v_catalogue, false);
        v_unit := coalesce(v_unit_in, v_cached, v_catalogue);
      END IF;
      IF v_unit IS NULL OR v_unit <= 0 OR v_unit > 99999999.99 THEN
        RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'unit_rate')::text;
      END IF;
      v_changed := v_catalogue IS NOT NULL AND v_unit <> v_catalogue;
      IF v_changed THEN
        -- A change the office can trust: from a catalogue rate, on a seva that allows it, with a reason. Anything else
        -- was printed and paid, so it is stored, but marked with a system reason that says so (and keeps the PC's).
        IF NOT (v_trusted AND v_seva.allow_amount_change AND seva_visible_length(v_reason) >= 3) THEN
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

REVOKE EXECUTE ON FUNCTION seva_sync_offline_order(jsonb, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_sync_offline_order(jsonb, uuid, uuid, text) TO service_role;
