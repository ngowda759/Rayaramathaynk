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
