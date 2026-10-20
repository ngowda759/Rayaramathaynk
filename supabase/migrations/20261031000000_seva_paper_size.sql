-- Seva Entry - configurable receipt paper size (plan A4S-7; owner's decision 2026-10-19, card a5).
--
-- Additive: every earlier seva migration is already applied on the owner's test project, so nothing there is edited.
-- Safe to run more than once (the DB tests apply every seva migration twice). Postgres 15 syntax only.
--
-- Sizes, all portrait, one receipt a sheet:
--   a5 148 x 210 mm (default) | a6 105 x 148 mm | third_a4 99 x 210 mm (the old fixed slip)
--   roll_80 / roll_58  thermal rolls, height fitted to the content at print time
--   custom  width 50-216 mm, height 80-356 mm, height at least the width

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Columns and checks on the one seva_settings row
-- ---------------------------------------------------------------------------------------------------------------

ALTER TABLE seva_settings ADD COLUMN IF NOT EXISTS paper_size text DEFAULT 'a5';
ALTER TABLE seva_settings ADD COLUMN IF NOT EXISTS paper_custom_w_mm smallint;
ALTER TABLE seva_settings ADD COLUMN IF NOT EXISTS paper_custom_h_mm smallint;

-- The existing row predates the column default only if the column already existed without it; keep it on A5 then.
UPDATE seva_settings SET paper_size = 'a5' WHERE paper_size IS NULL;

ALTER TABLE seva_settings DROP CONSTRAINT IF EXISTS seva_settings_paper_size_check;
ALTER TABLE seva_settings ADD CONSTRAINT seva_settings_paper_size_check
  CHECK (paper_size IS NULL OR paper_size IN ('a5', 'a6', 'third_a4', 'roll_80', 'roll_58', 'custom'));

ALTER TABLE seva_settings DROP CONSTRAINT IF EXISTS seva_settings_paper_custom_w_check;
ALTER TABLE seva_settings ADD CONSTRAINT seva_settings_paper_custom_w_check
  CHECK (paper_custom_w_mm IS NULL OR paper_custom_w_mm BETWEEN 50 AND 216);

ALTER TABLE seva_settings DROP CONSTRAINT IF EXISTS seva_settings_paper_custom_h_check;
ALTER TABLE seva_settings ADD CONSTRAINT seva_settings_paper_custom_h_check
  CHECK (paper_custom_h_mm IS NULL OR paper_custom_h_mm BETWEEN 80 AND 356);

-- Portrait: a custom height is never less than its width.
ALTER TABLE seva_settings DROP CONSTRAINT IF EXISTS seva_settings_paper_custom_portrait_check;
ALTER TABLE seva_settings ADD CONSTRAINT seva_settings_paper_custom_portrait_check
  CHECK (paper_custom_w_mm IS NULL OR paper_custom_h_mm IS NULL OR paper_custom_h_mm >= paper_custom_w_mm);

-- A custom size names both sides.
ALTER TABLE seva_settings DROP CONSTRAINT IF EXISTS seva_settings_paper_custom_complete_check;
ALTER TABLE seva_settings ADD CONSTRAINT seva_settings_paper_custom_complete_check
  CHECK (paper_size IS DISTINCT FROM 'custom' OR (paper_custom_w_mm IS NOT NULL AND paper_custom_h_mm IS NOT NULL));

-- ---------------------------------------------------------------------------------------------------------------
-- 2. seva_update_settings: the three paper columns join the patchable keys, and a view-only actor is refused
-- ---------------------------------------------------------------------------------------------------------------

-- Same as 20261021000200 with the paper columns added. The API already refuses a view-only person (settings.edit,
-- 403); the function now refuses one too, so the database never takes a settings change from a view-only staff row.
CREATE OR REPLACE FUNCTION seva_update_settings(p_patch jsonb, p_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_keys constant text[] := ARRAY['temple_name_en', 'temple_name_kn', 'address_line1', 'address_line2',
    'registration_line', 'photo_left_url', 'photo_right_url', 'footer_line1', 'footer_line2', 'footer_blessing',
    'print_gotra', 'print_nakshatra', 'print_rashi', 'cancel_window_minutes', 'cash_difference_note_required',
    'amount_change_reason_required', 'counter_days_ahead', 'online_days_ahead', 'online_same_day_cutoff',
    'prasadam_undo_seconds', 'day_close_flag_threshold', 'tally_cash_ledger', 'tally_upi_ledger',
    'tally_online_ledger', 'tally_columns', 'paper_size', 'paper_custom_w_mm', 'paper_custom_h_mm'];
  v_old seva_settings%ROWTYPE;
  v_new seva_settings%ROWTYPE;
  v_diff jsonb;
BEGIN
  PERFORM seva_admin_require_actor(p_staff_id);
  IF EXISTS (SELECT 1 FROM staff s WHERE s.id = p_staff_id AND s.view_only) THEN
    RAISE EXCEPTION 'SEVA:forbidden' USING DETAIL = jsonb_build_object('reason', 'view_only')::text;
  END IF;
  PERFORM seva_admin_check_keys(p_patch, c_keys);

  SELECT * INTO v_old FROM seva_settings s WHERE s.id = 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'seva_settings')::text;
  END IF;

  BEGIN
    SELECT * INTO v_new FROM jsonb_populate_record(v_old, p_patch);
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'settings', 'reason', 'type')::text;
  END;

  v_diff := seva_admin_diff(to_jsonb(v_old), to_jsonb(v_new), c_keys);
  IF v_diff -> 'after' = '{}'::jsonb THEN
    RETURN;
  END IF;

  BEGIN
    UPDATE seva_settings s
       SET temple_name_en = v_new.temple_name_en, temple_name_kn = v_new.temple_name_kn,
           address_line1 = v_new.address_line1, address_line2 = v_new.address_line2,
           registration_line = v_new.registration_line, photo_left_url = v_new.photo_left_url,
           photo_right_url = v_new.photo_right_url, footer_line1 = v_new.footer_line1,
           footer_line2 = v_new.footer_line2, footer_blessing = v_new.footer_blessing,
           print_gotra = v_new.print_gotra, print_nakshatra = v_new.print_nakshatra, print_rashi = v_new.print_rashi,
           cancel_window_minutes = v_new.cancel_window_minutes,
           cash_difference_note_required = v_new.cash_difference_note_required,
           amount_change_reason_required = v_new.amount_change_reason_required,
           counter_days_ahead = v_new.counter_days_ahead, online_days_ahead = v_new.online_days_ahead,
           online_same_day_cutoff = v_new.online_same_day_cutoff,
           prasadam_undo_seconds = v_new.prasadam_undo_seconds,
           day_close_flag_threshold = v_new.day_close_flag_threshold,
           tally_cash_ledger = v_new.tally_cash_ledger, tally_upi_ledger = v_new.tally_upi_ledger,
           tally_online_ledger = v_new.tally_online_ledger, tally_columns = v_new.tally_columns,
           paper_size = v_new.paper_size, paper_custom_w_mm = v_new.paper_custom_w_mm,
           paper_custom_h_mm = v_new.paper_custom_h_mm,
           updated_by_staff_id = p_staff_id
     WHERE s.id = 1;
  EXCEPTION WHEN integrity_constraint_violation THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'settings', 'reason', 'rule')::text;
  END;

  PERFORM seva_audit('settings.update', 'seva_settings', '1', NULL, NULL, v_diff -> 'before', v_diff -> 'after',
                     p_staff_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION seva_update_settings(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_update_settings(jsonb, uuid) TO service_role;
