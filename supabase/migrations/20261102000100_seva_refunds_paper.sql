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
