-- =====================================================================================================
-- REVIEW-ONLY MIGRATION PROPOSAL: NOT FOR PRODUCTION APPLICATION
-- =====================================================================================================
-- Document: docs/auth/proposed-migrations/20261201000000_phase4_staff_identity_decouple_proposal.sql
-- Status: REVIEW ONLY — DO NOT APPLY TO PRODUCTION
-- Target Phase: Phase 4 Firebase Decommissioning (Pending 14-day zero-fallback observation window)
--
-- PURPOSE:
-- Safely transition `public.staff` from:
--   CURRENT:   firebase_uid text NOT NULL UNIQUE
--   TOWARD:    auth_user_id uuid UNIQUE (canonical Supabase Auth identity)
--
-- SAFETY INVARIANTS:
-- 1. DO NOT drop the firebase_uid column.
-- 2. DO NOT delete or alter any existing staff identity records.
-- 3. DO NOT disable or remove `seva_staff_guard`.
-- 4. Preserve immutability for all existing assigned `firebase_uid` and `auth_user_id` identifiers.
-- 5. Support both legacy and modern staff records during Phase 4 transition.
-- =====================================================================================================

-- -----------------------------------------------------------------------------------------------------
-- 1. Pre-condition Safety Check (Must be verified by operator prior to execution)
-- -----------------------------------------------------------------------------------------------------
-- Ensure zero active staff rows have a NULL auth_user_id before decoupling:
DO $$
DECLARE
  v_unmigrated_count integer;
BEGIN
  SELECT count(*) INTO v_unmigrated_count
  FROM public.staff
  WHERE status IN ('active', 'invited')
    AND auth_user_id IS NULL;

  IF v_unmigrated_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: % active/invited staff members lack auth_user_id. Reconcile identities first.', v_unmigrated_count;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------------------------------
-- 2. Relax NOT NULL Constraint on public.staff.firebase_uid
-- -----------------------------------------------------------------------------------------------------
-- Allows future staff onboarding to create rows with Supabase Auth identities without requiring Firebase UIDs.
ALTER TABLE public.staff ALTER COLUMN firebase_uid DROP NOT NULL;

-- Update the check constraint to permit NULL while continuing to forbid empty whitespace strings:
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_firebase_uid_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_firebase_uid_check CHECK (firebase_uid IS NULL OR btrim(firebase_uid) <> '');

-- -----------------------------------------------------------------------------------------------------
-- 3. Update Trigger Function: seva_staff_guard()
-- -----------------------------------------------------------------------------------------------------
-- Protects immutability of both legacy (firebase_uid) and canonical (auth_user_id) identities.
CREATE OR REPLACE FUNCTION seva_staff_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'seva guard: staff rows are never deleted; set status to deleted with a reason instead'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.staff_no IS DISTINCT FROM OLD.staff_no THEN
    RAISE EXCEPTION 'seva guard: a staff number never changes and is never reused'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Immutability for legacy firebase_uid: Once assigned, it cannot be changed or cleared
  IF OLD.firebase_uid IS NOT NULL AND NEW.firebase_uid IS DISTINCT FROM OLD.firebase_uid THEN
    RAISE EXCEPTION 'seva guard: a staff login (firebase_uid) never changes; invite a new staff member instead'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Immutability for canonical auth_user_id: Once assigned, it cannot be changed or cleared
  IF OLD.auth_user_id IS NOT NULL AND NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
    RAISE EXCEPTION 'seva guard: a staff login (auth_user_id) never changes; invite a new staff member instead'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD.status = 'deleted' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'seva guard: a deleted staff member stays deleted; invite a new staff member instead'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------------------------------
-- 4. Update Stored Procedure: seva_staff_onboard()
-- -----------------------------------------------------------------------------------------------------
-- Updates onboarding procedure to support auth_user_id natively while accepting optional firebase_uid.
CREATE OR REPLACE FUNCTION seva_staff_onboard(p_staff jsonb, p_actor uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid text;
  v_auth_user_id uuid;
  v_name text;
  v_email text;
  v_no integer;
  v_view_only boolean;
  v_id uuid;
BEGIN
  PERFORM seva_admin_require_actor(p_actor);
  PERFORM seva_admin_check_keys(p_staff, ARRAY['firebase_uid', 'auth_user_id', 'full_name', 'email', 'staff_no', 'view_only']);

  BEGIN
    v_uid := btrim(p_staff ->> 'firebase_uid');
    v_name := btrim(p_staff ->> 'full_name');
    v_email := lower(btrim(p_staff ->> 'email'));
    v_no := (p_staff ->> 'staff_no')::integer;
    v_view_only := coalesce((p_staff ->> 'view_only')::boolean, false);
    IF p_staff ? 'auth_user_id' AND p_staff ->> 'auth_user_id' IS NOT NULL AND btrim(p_staff ->> 'auth_user_id') <> '' THEN
      v_auth_user_id := (p_staff ->> 'auth_user_id')::uuid;
    END IF;
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'staff', 'reason', 'type')::text;
  END;

  -- Require either a valid Supabase auth_user_id or legacy firebase_uid
  IF v_auth_user_id IS NULL AND (v_uid IS NULL OR v_uid = '') THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'auth_user_id', 'reason', 'required')::text;
  END IF;

  IF v_name IS NULL OR v_name = '' OR char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'full_name')::text;
  END IF;
  IF v_email IS NULL OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'email')::text;
  END IF;

  LOCK TABLE staff IN SHARE ROW EXCLUSIVE MODE;

  IF v_auth_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM staff s WHERE s.auth_user_id = v_auth_user_id) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'auth_user_id', 'reason', 'taken')::text;
  END IF;
  IF v_uid IS NOT NULL AND v_uid <> '' AND EXISTS (SELECT 1 FROM staff s WHERE s.firebase_uid = v_uid) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'firebase_uid', 'reason', 'taken')::text;
  END IF;
  IF EXISTS (SELECT 1 FROM staff s WHERE s.email = v_email) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'email', 'reason', 'taken')::text;
  END IF;

  IF v_no IS NULL THEN
    v_no := seva_next_staff_no();
  ELSIF v_no NOT BETWEEN 1 AND 999 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'staff_no')::text;
  ELSIF EXISTS (SELECT 1 FROM staff s WHERE s.staff_no = v_no) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'staff_no', 'reason', 'taken')::text;
  END IF;

  INSERT INTO staff (
    firebase_uid,
    auth_user_id,
    staff_no,
    full_name,
    email,
    view_only,
    status,
    invited_by_staff_id,
    invited_at
  )
  VALUES (
    NULLIF(v_uid, ''),
    v_auth_user_id,
    v_no::smallint,
    v_name,
    v_email,
    v_view_only,
    'invited',
    p_actor,
    now()
  )
  RETURNING id INTO v_id;

  PERFORM seva_audit('staff.onboard', 'staff', v_id::text, NULL, NULL, NULL,
                     jsonb_build_object('staff_no', v_no, 'full_name', v_name, 'view_only', v_view_only,
                                        'status', 'invited', 'has_auth_user_id', v_auth_user_id IS NOT NULL),
                     p_actor);
  RETURN v_id;
END;
$$;

-- =====================================================================================================
-- ROLLBACK STRATEGY (If rollback to legacy NOT NULL is ever required):
-- =====================================================================================================
-- 1. Identify any staff records created during decoupled operation where firebase_uid is NULL:
--    SELECT id, email, auth_user_id FROM public.staff WHERE firebase_uid IS NULL;
-- 2. Backfill a synthetic or preserved unique identifier for any NULL rows:
--    UPDATE public.staff SET firebase_uid = 'legacy-sync-' || id::text WHERE firebase_uid IS NULL;
-- 3. Restore NOT NULL constraint:
--    ALTER TABLE public.staff ALTER COLUMN firebase_uid SET NOT NULL;
-- 4. Restore original seva_staff_guard() and seva_staff_onboard() from 20261020000000_seva_core.sql.
