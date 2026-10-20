-- Seva Entry - follow-ups to the final-review fixes (A5-FIX, part F5, 2026-10-20).
--
-- Additive: every migration up to 20261102000000_seva_final_fixes.sql is applied on the owner's test project and
-- frozen, and 20261102000100_seva_refunds_paper.sql (F4) comes before this file. This file only redefines functions
-- (CREATE OR REPLACE keeps their grants), each from its newest definition, and adds what is new.
-- Rules as in 20261021000000_seva_functions_issue.sql: plpgsql, SECURITY INVOKER, search_path pinned, EXECUTE for
-- service_role only, business errors as 'SEVA:<code>'. Safe to run more than once. Postgres 15 syntax only.

-- =====================================================================================================
-- L-5 (rest). The counter's staff check refuses view-only staff in SQL too
-- =====================================================================================================

-- As in 20261021000000_seva_functions_issue.sql, plus (L-5): a view-only staff member is refused with SEVA:forbidden
-- (reason view_only), as seva_admin_require_actor and seva_ops_require_staff already do. Its callers are the counter
-- writes: an online order, the outbox sync (for the person sending it), prints, cancels and reissues. The person who
-- made an offline order or cancel is checked by seva_issue_offline_issuer below, not here.
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
  IF v_staff.view_only THEN
    RAISE EXCEPTION 'SEVA:forbidden' USING DETAIL = jsonb_build_object('reason', 'view_only')::text;
  END IF;
  RETURN v_staff;
END;
$$;

-- As in 20261021000000_seva_functions_issue.sql, with one change (L-5): a person who is view-only now but made the
-- order or cancel on the PC before they became view-only is accepted, as an offboarded person is. When they became
-- view-only is the time of their newest staff.view_only_change audit row that switched it on (the staff table keeps
-- no such time). p_at must be known and not later than it; someone view-only from the start (no such row) is refused.
CREATE OR REPLACE FUNCTION seva_issue_offline_issuer(p_staff_no text, p_role text, p_field text, p_at timestamptz)
RETURNS staff
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_no integer;
  v_staff staff%ROWTYPE;
  v_view_only_since timestamptz;
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
  IF p_role IS NULL OR p_role NOT IN ('receptionist', 'temple_admin', 'super_admin') THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', p_field, 'reason', 'may not use the counter')::text;
  END IF;
  IF v_staff.view_only THEN
    SELECT max(a.at) INTO v_view_only_since
      FROM audit_log a
     WHERE a.action = 'staff.view_only_change' AND a.entity = 'staff' AND a.entity_id = v_staff.id::text
       AND a.after ->> 'view_only' = 'true';
    IF p_at IS NULL OR v_view_only_since IS NULL OR p_at > v_view_only_since THEN
      RAISE EXCEPTION 'SEVA:validation'
        USING DETAIL = jsonb_build_object('field', p_field, 'reason', 'may not use the counter')::text;
    END IF;
  END IF;
  IF v_staff.status = 'inactive'
     AND (p_at IS NULL OR v_staff.status_changed_at IS NULL OR p_at > v_staff.status_changed_at) THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', p_field, 'reason', 'offboarded before this was done on the PC')::text;
  END IF;
  RETURN v_staff;
END;
$$;

REVOKE EXECUTE ON FUNCTION seva_issue_staff(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_staff(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_issue_offline_issuer(text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_issue_offline_issuer(text, text, text, timestamptz) TO service_role;

-- =====================================================================================================
-- F5-2. Needs attention: online (C series) receipts of today with no print record after 10 minutes
-- =====================================================================================================

-- As in 20261102000000_seva_final_fixes.sql, plus one card at the end: unprinted_online.
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
  v_at timestamptz;
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

  -- unprinted_online (F5-2, from H-3): online (C series) counter receipts of today's business date, still issued,
  -- with no print record (print_count 0) more than 10 minutes after they were issued - an in-doubt save whose slip
  -- never came out, or a print that failed. receipts names up to 50 of them, oldest first.
  SELECT count(*)::int,
         string_agg(x.receipt_no, ', ' ORDER BY x.issued_at, x.receipt_no) FILTER (WHERE x.rn <= 50),
         min(x.issued_at)
    INTO v_n, v_text, v_at
    FROM (
      SELECT r.receipt_no, r.issued_at, row_number() OVER (ORDER BY r.issued_at, r.receipt_no) AS rn
        FROM seva_receipts r JOIN seva_orders o ON o.id = r.order_id
       WHERE o.channel = 'counter' AND NOT r.issued_offline AND NOT r.test_mode
         AND r.status = 'issued' AND r.print_count = 0
         AND r.business_date = p_today AND r.issued_at < now() - interval '10 minutes'
    ) x;
  v_cards := v_cards || jsonb_build_object('id', 'unprinted_online',
                                           'level', CASE WHEN v_n > 0 THEN 'attention' ELSE 'ok' END,
                                           'count', v_n,
                                           'detail', jsonb_strip_nulls(jsonb_build_object(
                                             'receipts', v_text, 'oldest_at', v_at)));

  RETURN v_cards;
END;
$$;

REVOKE EXECUTE ON FUNCTION seva_needs_attention(timestamptz, timestamptz, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_needs_attention(timestamptz, timestamptz, date) TO service_role;
