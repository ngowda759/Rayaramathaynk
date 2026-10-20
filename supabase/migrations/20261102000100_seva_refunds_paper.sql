-- Seva Entry - refund settling and paper-book entry (A5-FIX, part F4, 2026-10-20).
-- Evidence: the A5-3 final review, findings M-3 (a refund that is due can never be settled) and M-6 ("Entered from the
-- paper book" closes a gap, but nothing can enter those receipts).
--
-- Additive: every migration up to 20261102000000_seva_final_fixes.sql is applied on the owner's test project and
-- frozen, so this file adds new functions and redefines only what it names below (CREATE OR REPLACE keeps grants).
-- Rules as in 20261021000000_seva_functions_issue.sql: plpgsql, SECURITY INVOKER, search_path pinned, EXECUTE for
-- service_role only, business errors as 'SEVA:<code>'. Safe to run more than once. Postgres 15 syntax only.

-- =====================================================================================================
-- M-3. An admin marks a refund-due receipt as refunded
-- =====================================================================================================

-- DB 9.9: a UPI cancel, or a cash cancel the drawer could not hand back (an earlier day, a closed day, a late offline
-- cancel), leaves the receipt cancelled with refund_state 'due'. The office pays the money back outside the module
-- and an admin records it here: p_mode is how it was paid back ('upi', 'bank_transfer' or 'cash'), p_reference the
-- bank or UPI reference (required unless cash, up to 60 characters), p_note at least 3 visible characters (up to 500).
-- Every receipt named must be cancelled with refund_state 'due' (else SEVA:validation, reason not_refund_due, naming
-- the receipt), so a refund is recorded once. Each receipt becomes refund_state 'done' with a refund_note that reads
-- "Refunded by UPI, ref <reference>: <note>", and writes a receipt.refund_done audit row (before: due; after: done,
-- mode, reference, amount). The upi_refunds_due Needs attention card counts 'due' receipts, so it clears.
-- The route allows temple admins and super admins (receipt.cancel_any); here a view-only or inactive staff id is
-- refused (seva_ops_require_staff). Answers { receipts: [{ id, receipt_no, refund_state, refund_note, total }],
-- refunded_total }.
CREATE OR REPLACE FUNCTION seva_settle_refund(
  p_receipt_ids uuid[],
  p_mode text,
  p_reference text,
  p_note text,
  p_staff_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids uuid[];
  v_note text := btrim(coalesce(p_note, ''));
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_mode_label text;
  v_refund_note text;
  v_receipt record;
  v_found integer;
  v_answer jsonb := '[]'::jsonb;
  v_total numeric := 0;
BEGIN
  PERFORM seva_ops_require_staff(p_staff_id);

  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO v_ids FROM unnest(p_receipt_ids) AS x WHERE x IS NOT NULL;
  IF cardinality(v_ids) NOT BETWEEN 1 AND 31 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipt_ids')::text;
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('upi', 'bank_transfer', 'cash') THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'mode')::text;
  END IF;
  IF (p_mode <> 'cash' AND (v_reference IS NULL OR seva_visible_length(v_reference) < 4))
     OR char_length(coalesce(v_reference, '')) > 60 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'reference')::text;
  END IF;
  IF seva_visible_length(v_note) < 3 OR char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'note')::text;
  END IF;

  v_mode_label := CASE p_mode WHEN 'upi' THEN 'by UPI' WHEN 'bank_transfer' THEN 'by bank transfer' ELSE 'in cash' END;
  v_refund_note := 'Refunded ' || v_mode_label || coalesce(', ref ' || v_reference, '') || ': ' || v_note;

  -- Lock every named receipt in one order, so two settles of overlapping receipts cannot deadlock.
  PERFORM 1 FROM seva_receipts r WHERE r.id = ANY (v_ids) ORDER BY r.id FOR UPDATE;
  SELECT count(*) INTO v_found FROM seva_receipts r WHERE r.id = ANY (v_ids);
  IF v_found <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'receipt')::text;
  END IF;

  FOR v_receipt IN
    SELECT r.id, r.receipt_no, r.status, r.refund_state, r.refund_note, r.total
      FROM seva_receipts r
     WHERE r.id = ANY (v_ids)
     ORDER BY r.receipt_no
  LOOP
    IF v_receipt.status <> 'cancelled' OR v_receipt.refund_state <> 'due' THEN
      RAISE EXCEPTION 'SEVA:validation'
        USING DETAIL = jsonb_build_object('field', 'receipt_ids', 'reason', 'not_refund_due',
                                          'receipt_no', v_receipt.receipt_no)::text;
    END IF;

    UPDATE seva_receipts r
       SET refund_state = 'done',
           refund_note = v_refund_note,
           updated_at = now()
     WHERE r.id = v_receipt.id;

    PERFORM seva_audit(
      'receipt.refund_done', 'receipt', v_receipt.id::text, v_receipt.receipt_no, v_note,
      jsonb_build_object('refund_state', v_receipt.refund_state, 'refund_note', v_receipt.refund_note),
      jsonb_build_object('refund_state', 'done', 'mode', p_mode, 'reference', v_reference,
                         'amount', v_receipt.total::numeric(12,2)::text),
      p_staff_id
    );

    v_total := v_total + v_receipt.total;
    v_answer := v_answer || jsonb_build_array(jsonb_build_object(
      'id', v_receipt.id,
      'receipt_no', v_receipt.receipt_no,
      'refund_state', 'done',
      'refund_note', v_refund_note,
      'total', v_receipt.total::numeric(12,2)::text
    ));
  END LOOP;

  RETURN jsonb_build_object('receipts', v_answer, 'refunded_total', v_total::numeric(12,2)::text);
END;
$$;

REVOKE EXECUTE ON FUNCTION seva_settle_refund(uuid[], text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_settle_refund(uuid[], text, text, text, uuid) TO service_role;

-- =====================================================================================================
-- M-6. Entering a gap's receipts from the paper book
-- =====================================================================================================

-- C-52, DB 8.4-8.5: the numbers of an open gap were printed on slips that never reached the office (a dead PC, a lost
-- outbox). A temple admin or super admin types each slip in from the paper book: p_receipt is
--   { receipt_no   the number printed on the slip, e.g. 'OF1-023-10-2026/000007' (series, issuer's staff no., month,
--                  year, running number); it must lie inside open gap p_gap_id, be unused, and name a staff member,
--     issued_on    the date on the slip (not after today, IST); its month and year must be those of the number,
--     seva_date, devotee { name, gotra, ..., phone_e164 }, lines [{ seva_id, quantity, unit_rate }] (1..8; unit_rate
--     is the amount printed, else the catalogue rate in force on that date), expected_total (the slip's total),
--     payment { mode 'cash' | 'upi', cash_received?, upi_ref_last6 (UPI) }, qr_token (made by the route),
--     note         where the slip was found, e.g. 'Paper book page 12' (3 visible characters at least) }.
-- The receipt is stored as the offline receipt it was: one order of one receipt on the series' counter, issued_offline,
-- issued by the slip's staff member at noon IST of issued_on (the slip has no time), synced_by_staff_id = the admin, a
-- new server group label. A line whose printed amount differs from the catalogue rate is marked changed with the reason
-- 'Entered from the paper book: printed X, catalogue Y' (audited receipt.amount_changed). The number is taken out of
-- the gap through seva_issue_fill_gap (the gap shrinks or splits); when it is the gap's last number, the gap is
-- resolved here as entered_from_paper with the note and audited gap.resolve. So a gap closes as entered_from_paper only
-- when every number in it was entered. Audit receipt.entered_from_paper (after: gap, number, issuer, total, mode,
-- in_closed_day - the counter-day was already closed, so its stored close does not count this money). Locks the series
-- year row before the gap, as the offline sync does. Answers seva_order_json plus gap_status ('open' while other
-- numbers of the gap are still missing, else 'entered_from_paper').
CREATE OR REPLACE FUNCTION seva_enter_paper_receipt(p_gap_id bigint, p_receipt jsonb, p_staff_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_today date;
  v_gap receipt_number_gaps%ROWTYPE;
  v_note text;
  v_receipt_no text;
  v_parts text[];
  v_staff_no integer;
  v_no_month integer;
  v_no_year integer;
  v_running integer;
  v_issued_on date;
  v_issued_at timestamptz;
  v_year smallint;
  v_month smallint;
  v_business_date date;
  v_issuer staff%ROWTYPE;
  v_counter_id smallint;
  v_seva_date date;
  v_qr text;
  v_devotee jsonb;
  v_payment jsonb;
  v_expected numeric;
  v_line record;
  v_seva sevas%ROWTYPE;
  v_quantity integer;
  v_unit numeric;
  v_catalogue numeric;
  v_changed boolean;
  v_reason text;
  v_amount numeric;
  v_lines jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_any_changed boolean := false;
  v_prasadam boolean := false;
  v_in_closed_day boolean;
  v_order_id uuid;
  v_receipt_id uuid;
  v_gap_status text := 'open';
BEGIN
  PERFORM seva_ops_require_staff(p_staff_id);
  IF p_receipt IS NULL OR jsonb_typeof(p_receipt) <> 'object' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipt')::text;
  END IF;
  v_note := btrim(coalesce(p_receipt->>'note', ''));
  IF seva_visible_length(v_note) < 3 OR char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'note')::text;
  END IF;

  SELECT g.* INTO v_gap FROM receipt_number_gaps g WHERE g.id = p_gap_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'gap')::text;
  END IF;
  IF v_gap.status <> 'open' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'gap', 'reason', 'already_resolved')::text;
  END IF;

  -- The number on the slip: <series>-<staff no.>-<MM>-<YYYY>/<running>, in the gap's series.
  v_receipt_no := btrim(coalesce(p_receipt->>'receipt_no', ''));
  v_parts := regexp_match(v_receipt_no, '^((?:C|OF)[0-9]{1,2})-([0-9]{3})-([0-9]{2})-([0-9]{4})/([0-9]{6})$');
  IF v_parts IS NULL OR v_parts[1] <> v_gap.series_code THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', 'receipt_no', 'reason', 'not_this_series')::text;
  END IF;
  v_staff_no := v_parts[2]::integer;
  v_no_month := v_parts[3]::integer;
  v_no_year := v_parts[4]::integer;
  v_running := v_parts[5]::integer;
  IF v_no_month NOT BETWEEN 1 AND 12 OR v_running < 1 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipt_no', 'reason', 'format')::text;
  END IF;

  -- The date on the slip: not after today; the number's month and year are the slip's.
  SELECT p.business_date INTO v_today FROM seva_ist_parts(v_now) AS p;
  v_issued_on := seva_issue_arg_date(p_receipt->>'issued_on', 'issued_on');
  IF v_issued_on IS NULL OR v_issued_on > v_today THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'issued_on')::text;
  END IF;
  v_issued_at := (v_issued_on::timestamp + time '12:00') AT TIME ZONE 'Asia/Kolkata';
  SELECT p.year, p.month, p.business_date INTO v_year, v_month, v_business_date FROM seva_ist_parts(v_issued_at) AS p;
  IF v_month <> v_no_month OR v_year <> v_no_year THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', 'issued_on', 'reason', 'not_the_month_of_the_number')::text;
  END IF;
  IF v_year <> v_gap.year OR v_running NOT BETWEEN v_gap.from_no AND v_gap.to_no THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipt_no', 'reason', 'outside_gap')::text;
  END IF;

  -- The person whose staff number the slip carries printed it (never an invited person, who never signed in).
  SELECT s.* INTO v_issuer FROM staff s WHERE s.staff_no = v_staff_no AND s.status <> 'invited';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', 'receipt_no', 'reason', 'unknown_staff_no')::text;
  END IF;
  IF v_receipt_no <> seva_receipt_no(v_gap.series_code, v_issuer.staff_no, NULL, v_month, v_year, v_running) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipt_no', 'reason', 'format')::text;
  END IF;
  SELECT rs.counter_id INTO v_counter_id FROM receipt_series rs WHERE rs.code = v_gap.series_code;
  IF v_counter_id IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipt_no', 'reason', 'not_a_counter_series')::text;
  END IF;

  v_seva_date := seva_issue_arg_date(p_receipt->>'seva_date', 'seva_date');
  IF v_seva_date IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'seva_date')::text;
  END IF;
  v_qr := p_receipt->>'qr_token';
  IF v_qr IS NULL OR v_qr !~ '^[A-Za-z0-9_-]{22}$' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'qr_token')::text;
  END IF;
  v_devotee := seva_issue_devotee(p_receipt->'devotee');
  v_expected := seva_issue_arg_money(p_receipt->>'expected_total', 'expected_total');
  IF v_expected IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'expected_total')::text;
  END IF;

  -- The lines as printed; the catalogue rate is the one in force on the slip's date (seva_rate_at).
  IF jsonb_typeof(p_receipt->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_receipt->'lines') NOT BETWEEN 1 AND 8 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'lines')::text;
  END IF;
  FOR v_line IN
    SELECT l.value AS body FROM jsonb_array_elements(p_receipt->'lines') WITH ORDINALITY AS l(value, ord) ORDER BY l.ord
  LOOP
    IF jsonb_typeof(v_line.body) <> 'object' THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'lines')::text;
    END IF;
    v_quantity := seva_issue_arg_int(v_line.body->>'quantity', 'quantity');
    IF v_quantity IS NULL OR v_quantity NOT BETWEEN 1 AND 99 THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'quantity')::text;
    END IF;
    SELECT s.* INTO v_seva FROM sevas s WHERE s.id = seva_issue_arg_uuid(v_line.body->>'seva_id', 'seva_id');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'seva_id')::text;
    END IF;
    v_catalogue := CASE WHEN v_seva.any_amount THEN NULL ELSE seva_rate_at(v_seva.id, v_issued_at) END;
    v_unit := coalesce(seva_issue_arg_money(v_line.body->>'unit_rate', 'unit_rate'), v_catalogue);
    IF v_unit IS NULL OR v_unit <= 0 OR v_unit > 99999999.99 THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'unit_rate')::text;
    END IF;
    v_changed := v_catalogue IS NOT NULL AND v_unit <> v_catalogue;
    v_reason := CASE WHEN v_changed
                     THEN 'Entered from the paper book: printed ' || v_unit::numeric(12,2)::text
                          || ', catalogue ' || v_catalogue::numeric(12,2)::text
                END;
    v_amount := v_quantity * v_unit;
    v_total := v_total + v_amount;
    v_any_changed := v_any_changed OR v_changed;
    v_prasadam := v_prasadam OR v_seva.prasadam_given;
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
  IF v_total > 9999999999.99 OR v_total <> v_expected THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'expected_total')::text;
  END IF;
  -- The slip records a payment already taken: a UPI one needs the reference the slip shows.
  v_payment := seva_issue_payment(
    CASE WHEN jsonb_typeof(p_receipt->'payment') = 'object'
         THEN (p_receipt->'payment') || jsonb_build_object('upi_seen_confirmed', true)
    END,
    v_total
  );

  -- The same locks as the offline sync, in the same order: the series year row, then the gap.
  INSERT INTO receipt_series_years (series_code, year)
  VALUES (v_gap.series_code, v_gap.year)
  ON CONFLICT (series_code, year) DO NOTHING;
  PERFORM 1 FROM receipt_series_years y WHERE y.series_code = v_gap.series_code AND y.year = v_gap.year FOR UPDATE;
  SELECT g.* INTO v_gap FROM receipt_number_gaps g WHERE g.id = p_gap_id FOR UPDATE;
  IF v_gap.status <> 'open' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'gap', 'reason', 'already_resolved')::text;
  END IF;
  IF v_running NOT BETWEEN v_gap.from_no AND v_gap.to_no THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'receipt_no', 'reason', 'outside_gap')::text;
  END IF;
  IF EXISTS (
    SELECT 1 FROM seva_receipts r
     WHERE r.series_code = v_gap.series_code AND r.year = v_gap.year AND r.running_no = v_running
  ) THEN
    RAISE EXCEPTION 'SEVA:number_conflict'
      USING DETAIL = jsonb_build_object('receipt_no', v_receipt_no, 'reason', 'the number is already used')::text;
  END IF;

  v_in_closed_day := EXISTS (
    SELECT 1 FROM day_closes dc
     WHERE dc.counter_id = v_counter_id AND dc.business_date = v_business_date AND dc.status = 'closed'
  );

  INSERT INTO seva_orders (group_no, client_order_id, channel, counter_id, device_id, issued_by_staff_id, devotee_name,
                           gotra, gotra_id, nakshatra_id, nakshatra_text, rashi_id, rashi_text, phone_e164,
                           receipts_count, amount_total, payment_mode, cash_received, change_returned, upi_ref_last6,
                           upi_seen_confirmed, issued_offline, issued_at, synced_by_staff_id)
  VALUES (seva_next_group_no(v_issued_at), gen_random_uuid(), 'counter', v_counter_id, v_gap.device_id, v_issuer.id,
          v_devotee->>'name', v_devotee->>'gotra', (v_devotee->>'gotra_id')::smallint,
          (v_devotee->>'nakshatra_id')::smallint, v_devotee->>'nakshatra_text', (v_devotee->>'rashi_id')::smallint,
          v_devotee->>'rashi_text', v_devotee->>'phone_e164', 1, v_total, v_payment->>'mode',
          (v_payment->>'cash_received')::numeric, (v_payment->>'change_returned')::numeric,
          v_payment->>'upi_ref_last6', (v_payment->>'upi_seen_confirmed')::boolean, true, v_issued_at, p_staff_id)
  RETURNING id INTO v_order_id;

  INSERT INTO seva_receipts (receipt_no, series_code, year, month, running_no, staff_no, order_id, position,
                             client_receipt_id, seva_date, business_date, total, qr_token, prasadam_state, issued_at,
                             issued_by_staff_id, issued_by_name, issued_offline, has_changed_amount)
  VALUES (v_receipt_no, v_gap.series_code, v_year, v_month, v_running, v_issuer.staff_no, v_order_id, 1,
          gen_random_uuid(), v_seva_date, v_business_date, v_total, v_qr,
          CASE WHEN v_prasadam THEN 'pending' ELSE 'none' END,
          v_issued_at, v_issuer.id, v_issuer.full_name, true, v_any_changed)
  RETURNING id INTO v_receipt_id;
  PERFORM seva_issue_write_lines(v_receipt_id, v_lines);
  PERFORM seva_issue_audit_lines(v_receipt_id, v_receipt_no, v_lines, p_staff_id);

  -- Out of the gap: the last missing number closes it as entered_from_paper; otherwise the gap shrinks or splits.
  IF v_gap.from_no = v_gap.to_no THEN
    UPDATE receipt_number_gaps g
       SET status = 'entered_from_paper',
           resolved_at = v_now,
           resolved_by_staff_id = p_staff_id,
           resolution_note = v_note
     WHERE g.id = v_gap.id;
    PERFORM seva_audit(
      'gap.resolve', 'receipt_number_gap', v_gap.id::text, NULL, v_note,
      jsonb_build_object('status', 'open'),
      jsonb_build_object('status', 'entered_from_paper', 'series', v_gap.series_code, 'year', v_gap.year,
                         'from_no', v_gap.from_no, 'to_no', v_gap.to_no, 'cause', v_gap.cause),
      p_staff_id
    );
    v_gap_status := 'entered_from_paper';
  ELSE
    PERFORM seva_issue_fill_gap(v_gap.id, v_running, v_now);
  END IF;

  PERFORM seva_audit(
    'receipt.entered_from_paper', 'receipt', v_receipt_id::text, v_receipt_no, v_note,
    NULL,
    jsonb_build_object('gap_id', v_gap.id, 'series', v_gap.series_code, 'running_no', v_running,
                       'issued_on', v_issued_on, 'issuer_staff_no', v_issuer.staff_no,
                       'total', v_total::numeric(12,2)::text, 'payment_mode', v_payment->>'mode',
                       'counter_id', v_counter_id, 'in_closed_day', v_in_closed_day),
    p_staff_id
  );

  PERFORM seva_issue_save_profile(v_devotee, v_issued_at);
  RETURN seva_order_json(v_order_id, false) || jsonb_build_object('gap_status', v_gap_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION seva_enter_paper_receipt(bigint, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_enter_paper_receipt(bigint, jsonb, uuid) TO service_role;

-- As in 20261021000100_seva_functions_ops.sql (the newest definition), with two changes:
-- - M-6: 'entered_from_paper' is accepted only when every number of the gap is already in the register; otherwise
--   SEVA:validation (field status, reason receipts_missing). The receipts are entered one by one with
--   seva_enter_paper_receipt, which closes the gap itself when its last number is entered.
-- - L-11: the note counts only visible characters (seva_visible_length), as the table check does.
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
  v_present integer;
BEGIN
  PERFORM seva_ops_require_staff(p_staff_id);
  IF p_status IS NULL OR p_status NOT IN ('entered_from_paper', 'declared_lost') THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'status')::text;
  END IF;
  IF v_note IS NULL OR seva_visible_length(v_note) < 3 THEN
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
  IF p_status = 'entered_from_paper' THEN
    SELECT count(*) INTO v_present
      FROM seva_receipts r
     WHERE r.series_code = v_g.series_code AND r.year = v_g.year AND r.running_no BETWEEN v_g.from_no AND v_g.to_no;
    IF v_present < v_g.to_no - v_g.from_no + 1 THEN
      RAISE EXCEPTION 'SEVA:validation'
        USING DETAIL = jsonb_build_object('field', 'status', 'reason', 'receipts_missing',
                                          'missing', v_g.to_no - v_g.from_no + 1 - v_present)::text;
    END IF;
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
