-- Seva Entry, Phase 1 - SQL functions for the catalogue, settings, counters, staff, dashboard, needs attention,
-- number continuity and reports (Task A2-3).
-- Spec: docs/seva/DESIGN-BOOK.md 3.4 (staff lifecycle), 7.1-7.6 (tables), 7.8 (signatures), 12.1 (metrics),
-- 12.2 (needs attention), 12.3 (continuity), 12.4 (reports), 13 (settings). Depends on the A1 seva migrations.
--
-- Rules for this file (DB 7.0):
--   * Additive and idempotent: CREATE OR REPLACE FUNCTION only. Must run on Postgres 15.
--   * Every function: plpgsql, SECURITY INVOKER, search_path pinned, EXECUTE for service_role only.
--   * Business errors are raised as 'SEVA:<code>' (codes in lib/seva/errors.ts) with JSON in DETAIL.
--   * Writes take the acting staff member's id and refuse anyone whose staff status is not 'active'. Which role may
--     call what (DB 3.3) is checked by the route before it calls these functions.
--   * Report amounts are returned as numeric strings with two decimals ('1115.00'); routes convert them to paise.
--   * Business dates, hours and months are Asia/Kolkata, never the session time zone.

-- =====================================================================================================
-- 1. Shared helpers for this file
-- =====================================================================================================

-- Raises SEVA:staff_inactive unless p_staff_id names a staff member whose status is 'active'.
CREATE OR REPLACE FUNCTION seva_admin_require_actor(p_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_staff_id IS NULL OR NOT EXISTS (SELECT 1 FROM staff s WHERE s.id = p_staff_id AND s.status = 'active') THEN
    RAISE EXCEPTION 'SEVA:staff_inactive' USING DETAIL = '{}';
  END IF;
END;
$$;

-- Raises SEVA:validation naming the first key of p_obj that is not in p_allowed (and when p_obj is not an object).
CREATE OR REPLACE FUNCTION seva_admin_check_keys(p_obj jsonb, p_allowed text[])
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text;
BEGIN
  IF p_obj IS NULL OR jsonb_typeof(p_obj) <> 'object' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'body')::text;
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_obj) LOOP
    IF NOT v_key = ANY (p_allowed) THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', v_key, 'reason', 'unknown')::text;
    END IF;
  END LOOP;
END;
$$;

-- The keys whose values differ between p_before and p_after, as a pair of objects {before: {...}, after: {...}}.
CREATE OR REPLACE FUNCTION seva_admin_diff(p_before jsonb, p_after jsonb, p_keys text[])
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text;
  v_b jsonb := '{}'::jsonb;
  v_a jsonb := '{}'::jsonb;
BEGIN
  FOREACH v_key IN ARRAY p_keys LOOP
    IF (p_before -> v_key) IS DISTINCT FROM (p_after -> v_key) THEN
      v_b := v_b || jsonb_build_object(v_key, coalesce(p_before -> v_key, 'null'::jsonb));
      v_a := v_a || jsonb_build_object(v_key, coalesce(p_after -> v_key, 'null'::jsonb));
    END IF;
  END LOOP;
  RETURN jsonb_build_object('before', v_b, 'after', v_a);
END;
$$;

-- A catalogue row as it is written to the audit trail (amount as a numeric string).
CREATE OR REPLACE FUNCTION seva_admin_seva_json(p sevas)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN jsonb_build_object(
    'code', p.code, 'name', p.name, 'name_kn', p.name_kn, 'description', p.description, 'category', p.category,
    'amount', p.amount::numeric(10,2)::text, 'visibility', p.visibility, 'multi_date', p.multi_date,
    'allow_amount_change', p.allow_amount_change, 'any_amount', p.any_amount, 'prasadam_given', p.prasadam_given,
    'prasadam_items', p.prasadam_items, 'income_ledger', p.income_ledger, 'active', p.active,
    'display_order', p.display_order
  );
END;
$$;

-- =====================================================================================================
-- 2. Catalogue (DB 7.1, 13.1)
-- =====================================================================================================

-- Creates (no id) or updates (id) one seva. Keys: id, code, name_en, name_kn, description, category, amount,
-- visibility, multi_date, allow_amount_change, any_amount, prasadam_given, prasadam_items, income_ledger, active,
-- display_order. A rate change on an existing seva needs a reason of at least 3 characters; it is passed to the
-- sevas_rate_history trigger through seva.change_reason / seva.change_staff_id. An any-amount seva (Other Seva) is
-- always counter-only (C-38). A new seva gets a rate-history row with old_amount null (DB 7.1).
-- The Firestore mirror's document id (firestore_id, C-39) is set here and never by the caller: a new seva takes its
-- own id, and a row written elsewhere without one gets its id on its next save; a migrated row keeps its own. So the
-- catalogue code never writes the table directly (A3 security gate L-5).
-- Audits seva.create, or seva.update (fields other than the rate) and seva.rate_change.
CREATE OR REPLACE FUNCTION seva_upsert_seva(p_seva jsonb, p_reason text, p_staff_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_keys constant text[] := ARRAY['id', 'code', 'name_en', 'name_kn', 'description', 'category', 'amount',
    'visibility', 'multi_date', 'allow_amount_change', 'any_amount', 'prasadam_given', 'prasadam_items',
    'income_ledger', 'active', 'display_order'];
  c_diff_keys constant text[] := ARRAY['code', 'name', 'name_kn', 'description', 'category', 'visibility',
    'multi_date', 'allow_amount_change', 'any_amount', 'prasadam_given', 'prasadam_items', 'income_ledger',
    'active', 'display_order'];
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_id uuid;
  v_old sevas%ROWTYPE;
  v_new sevas%ROWTYPE;
  v_is_new boolean := true;
  v_rate_changed boolean := false;
  v_diff jsonb;
BEGIN
  PERFORM seva_admin_require_actor(p_staff_id);
  PERFORM seva_admin_check_keys(p_seva, c_keys);

  IF p_seva ? 'id' AND jsonb_typeof(p_seva -> 'id') <> 'null' THEN
    BEGIN
      v_id := (p_seva ->> 'id')::uuid;
    EXCEPTION WHEN data_exception THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'id')::text;
    END;
    SELECT * INTO v_old FROM sevas s WHERE s.id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'seva')::text;
    END IF;
    v_is_new := false;
    v_new := v_old;
  ELSE
    v_new.description := '';
    v_new.category := 'Seva';
    v_new.duration := 0;
    v_new.active := true;
    v_new.visibility := 'both';
    v_new.multi_date := false;
    v_new.allow_amount_change := true;
    v_new.any_amount := false;
    v_new.prasadam_given := true;
  END IF;

  BEGIN
    IF p_seva ? 'code' THEN v_new.code := upper(nullif(btrim(p_seva ->> 'code'), '')); END IF;
    IF p_seva ? 'name_en' THEN v_new.name := btrim(p_seva ->> 'name_en'); END IF;
    IF p_seva ? 'name_kn' THEN v_new.name_kn := nullif(btrim(p_seva ->> 'name_kn'), ''); END IF;
    IF p_seva ? 'description' THEN v_new.description := coalesce(btrim(p_seva ->> 'description'), ''); END IF;
    IF p_seva ? 'category' THEN v_new.category := btrim(p_seva ->> 'category'); END IF;
    IF p_seva ? 'amount' THEN v_new.amount := (p_seva ->> 'amount')::numeric(10,2); END IF;
    IF p_seva ? 'visibility' THEN v_new.visibility := p_seva ->> 'visibility'; END IF;
    IF p_seva ? 'multi_date' THEN v_new.multi_date := (p_seva ->> 'multi_date')::boolean; END IF;
    IF p_seva ? 'allow_amount_change' THEN v_new.allow_amount_change := (p_seva ->> 'allow_amount_change')::boolean; END IF;
    IF p_seva ? 'any_amount' THEN v_new.any_amount := (p_seva ->> 'any_amount')::boolean; END IF;
    IF p_seva ? 'prasadam_given' THEN v_new.prasadam_given := (p_seva ->> 'prasadam_given')::boolean; END IF;
    IF p_seva ? 'prasadam_items' THEN v_new.prasadam_items := nullif(btrim(p_seva ->> 'prasadam_items'), ''); END IF;
    IF p_seva ? 'income_ledger' THEN v_new.income_ledger := nullif(btrim(p_seva ->> 'income_ledger'), ''); END IF;
    IF p_seva ? 'active' THEN v_new.active := (p_seva ->> 'active')::boolean; END IF;
    IF p_seva ? 'display_order' THEN v_new.display_order := (p_seva ->> 'display_order')::integer; END IF;
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'seva', 'reason', 'type')::text;
  END;

  IF v_new.name IS NULL OR v_new.name = '' OR char_length(v_new.name) > 80 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'name_en')::text;
  END IF;
  IF v_new.code IS NOT NULL AND v_new.code !~ '^[A-Z]{2,3}$' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'code')::text;
  END IF;
  IF v_new.category IS NULL OR v_new.category = '' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'category')::text;
  END IF;
  IF v_new.visibility IS NULL OR v_new.visibility NOT IN ('counter', 'online', 'both') THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'visibility')::text;
  END IF;
  IF v_new.multi_date IS NULL OR v_new.allow_amount_change IS NULL OR v_new.any_amount IS NULL
     OR v_new.prasadam_given IS NULL OR v_new.active IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'seva', 'reason', 'missing')::text;
  END IF;
  -- display_order is checked only when the caller sends it. An edit that leaves it out keeps the stored value, even
  -- a legacy 0 from migrated rows (the column default), so a rename or rate change on those rows still works.
  IF p_seva ? 'display_order' THEN
    IF v_new.display_order IS NULL OR v_new.display_order < 1 THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'display_order')::text;
    END IF;
  ELSIF v_is_new THEN
    SELECT coalesce(max(s.display_order), 0) + 1 INTO v_new.display_order FROM sevas s;
  END IF;

  -- Other Seva / Karnike takes any amount and is counter-only (C-38); its stored rate is not used.
  IF v_new.any_amount THEN
    v_new.visibility := 'counter';
    IF v_is_new THEN
      v_new.amount := 0;
    ELSIF NOT p_seva ? 'amount' THEN
      v_new.amount := v_old.amount;
    END IF;
  END IF;
  IF v_new.amount IS NULL OR (NOT v_new.any_amount AND v_new.amount <= 0) OR v_new.amount < 0 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'amount')::text;
  END IF;

  IF v_new.code IS NOT NULL
     AND EXISTS (SELECT 1 FROM sevas s WHERE s.code = v_new.code AND s.id IS DISTINCT FROM v_id) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'code', 'reason', 'duplicate')::text;
  END IF;

  IF NOT v_is_new THEN
    v_rate_changed := v_new.amount IS DISTINCT FROM v_old.amount;
    IF v_rate_changed AND (v_reason IS NULL OR char_length(v_reason) < 3) THEN
      RAISE EXCEPTION 'SEVA:change_reason_required' USING DETAIL = jsonb_build_object('field', 'reason')::text;
    END IF;
  END IF;

  BEGIN
    IF v_is_new THEN
      v_id := gen_random_uuid();
      INSERT INTO sevas (id, firestore_id, name, description, category, amount, duration, active, display_order, code,
                         name_kn, visibility, multi_date, allow_amount_change, any_amount, prasadam_given,
                         prasadam_items, income_ledger, updated_by_staff_id)
      VALUES (v_id, v_id::text, v_new.name, v_new.description, v_new.category, v_new.amount, 0, v_new.active,
              v_new.display_order, v_new.code, v_new.name_kn, v_new.visibility, v_new.multi_date,
              v_new.allow_amount_change, v_new.any_amount, v_new.prasadam_given, v_new.prasadam_items,
              v_new.income_ledger, p_staff_id)
      RETURNING * INTO v_new;
      v_id := v_new.id;
      IF NOT v_new.any_amount THEN
        INSERT INTO seva_rate_history (seva_id, old_amount, new_amount, reason, changed_by_staff_id)
        VALUES (v_id, NULL, v_new.amount, coalesce(v_reason, 'Seva added'), p_staff_id);
      END IF;
    ELSE
      -- The rate-history trigger reads these transaction-local settings; they are cleared again below.
      PERFORM set_config('seva.change_reason', coalesce(v_reason, ''), true);
      PERFORM set_config('seva.change_staff_id', p_staff_id::text, true);
      UPDATE sevas s
         SET name = v_new.name, description = v_new.description, category = v_new.category, amount = v_new.amount,
             active = v_new.active, display_order = v_new.display_order, code = v_new.code, name_kn = v_new.name_kn,
             visibility = v_new.visibility, multi_date = v_new.multi_date,
             allow_amount_change = v_new.allow_amount_change, any_amount = v_new.any_amount,
             prasadam_given = v_new.prasadam_given, prasadam_items = v_new.prasadam_items,
             income_ledger = v_new.income_ledger, updated_by_staff_id = p_staff_id,
             firestore_id = coalesce(s.firestore_id, s.id::text)
       WHERE s.id = v_id
      RETURNING * INTO v_new;
      PERFORM set_config('seva.change_reason', '', true);
      PERFORM set_config('seva.change_staff_id', '', true);
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'code', 'reason', 'duplicate')::text;
    WHEN check_violation OR not_null_violation THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'seva')::text;
  END;

  IF v_is_new THEN
    PERFORM seva_audit('seva.create', 'sevas', v_id::text, NULL, v_reason, NULL, seva_admin_seva_json(v_new), p_staff_id);
  ELSE
    v_diff := seva_admin_diff(seva_admin_seva_json(v_old), seva_admin_seva_json(v_new), c_diff_keys);
    IF v_diff -> 'after' <> '{}'::jsonb THEN
      PERFORM seva_audit('seva.update', 'sevas', v_id::text, NULL, v_reason, v_diff -> 'before', v_diff -> 'after',
                         p_staff_id);
    END IF;
    IF v_rate_changed THEN
      PERFORM seva_audit('seva.rate_change', 'sevas', v_id::text, NULL, v_reason,
                         jsonb_build_object('amount', v_old.amount::numeric(10,2)::text),
                         jsonb_build_object('amount', v_new.amount::numeric(10,2)::text), p_staff_id);
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

-- Renumbers display_order (the counter key) 1..n in the given order; sevas not listed follow in their old order.
-- Audits seva.update with the order before and after.
CREATE OR REPLACE FUNCTION seva_reorder_sevas(p_ids uuid[], p_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n integer := coalesce(cardinality(p_ids), 0);
  v_before jsonb;
  v_after jsonb;
BEGIN
  PERFORM seva_admin_require_actor(p_staff_id);
  IF v_n = 0 OR array_position(p_ids, NULL) IS NOT NULL
     OR (SELECT count(DISTINCT x) FROM unnest(p_ids) AS u(x)) <> v_n THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'ids')::text;
  END IF;

  PERFORM 1 FROM sevas s ORDER BY s.id FOR UPDATE;
  IF (SELECT count(*) FROM sevas s WHERE s.id = ANY (p_ids)) <> v_n THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'seva')::text;
  END IF;

  SELECT jsonb_agg(s.id ORDER BY s.display_order, s.created_at, s.id) INTO v_before
    FROM sevas s WHERE s.id = ANY (p_ids);

  WITH listed AS (
    SELECT u.x AS id, u.ord::integer AS ord FROM unnest(p_ids) WITH ORDINALITY AS u(x, ord)
  ),
  rest AS (
    SELECT s.id, v_n + (row_number() OVER (ORDER BY s.display_order, s.created_at, s.id))::integer AS ord
      FROM sevas s WHERE NOT (s.id = ANY (p_ids))
  ),
  all_rows AS (
    SELECT listed.id, listed.ord FROM listed UNION ALL SELECT rest.id, rest.ord FROM rest
  )
  UPDATE sevas s
     SET display_order = a.ord, updated_by_staff_id = p_staff_id
    FROM all_rows a
   WHERE s.id = a.id AND s.display_order IS DISTINCT FROM a.ord;

  SELECT jsonb_agg(u.x ORDER BY u.ord) INTO v_after FROM unnest(p_ids) WITH ORDINALITY AS u(x, ord);
  PERFORM seva_audit('seva.update', 'sevas', NULL, NULL, NULL, jsonb_build_object('order', v_before),
                     jsonb_build_object('order', v_after), p_staff_id);
END;
$$;

-- =====================================================================================================
-- 3. Settings, denominations, festival days, counters (DB 7.2, 13.2-13.4)
-- =====================================================================================================

-- Applies a partial update to the single seva_settings row. Only the listed columns may be patched. Audits
-- settings.update with the changed columns before and after; a patch that changes nothing writes no audit row.
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
    'tally_online_ledger', 'tally_columns'];
  v_old seva_settings%ROWTYPE;
  v_new seva_settings%ROWTYPE;
  v_diff jsonb;
BEGIN
  PERFORM seva_admin_require_actor(p_staff_id);
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
           updated_by_staff_id = p_staff_id
     WHERE s.id = 1;
  EXCEPTION WHEN integrity_constraint_violation THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'settings', 'reason', 'rule')::text;
  END;

  PERFORM seva_audit('settings.update', 'seva_settings', '1', NULL, NULL, v_diff -> 'before', v_diff -> 'after',
                     p_staff_id);
END;
$$;

-- A UPI id (VPA) as the audit trail shows it: every character before '@' masked except the last 4, the provider's
-- handle kept ('srirayaramatha@okaxis' -> '**********atha@okaxis'). Null stays null.
CREATE OR REPLACE FUNCTION seva_mask_vpa(p_vpa text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_at integer;
  v_local text;
BEGIN
  IF p_vpa IS NULL THEN
    RETURN NULL;
  END IF;
  v_at := strpos(p_vpa, '@');
  v_local := CASE WHEN v_at = 0 THEN p_vpa ELSE left(p_vpa, v_at - 1) END;
  RETURN repeat('*', greatest(char_length(v_local) - 4, 0)) || right(v_local, 4)
      || CASE WHEN v_at = 0 THEN '' ELSE substr(p_vpa, v_at) END;
END;
$$;

-- The counter's UPI payee as the server has just read it from Firestore settings/financeSettings (DB 7.2; null VPA =
-- UPI off or not set). Compared with the values last recorded in seva_settings: when the VPA or the payee name differs
-- - the first payee ever read included - the new values are stored and one audit row settings.upi_changed is written
-- with the old and new VPA masked (seva_mask_vpa) and the payee names; the Needs attention card upi_changed reads it.
-- An unchanged read writes nothing. The row lock makes two counters reading the same change at once write one row.
-- Nobody acts here - the change was made in Firestore - so the audit row has no actor. Returns true when a change was
-- recorded. (A3 security gate H-1.)
CREATE OR REPLACE FUNCTION seva_note_counter_upi(p_vpa text, p_payee_name text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vpa text := nullif(btrim(coalesce(p_vpa, '')), '');
  v_name text := nullif(btrim(coalesce(p_payee_name, '')), '');
  v_old seva_settings%ROWTYPE;
BEGIN
  IF v_vpa IS NOT NULL AND (char_length(v_vpa) > 330 OR v_vpa !~ '^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$') THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'vpa')::text;
  END IF;
  IF v_vpa IS NULL THEN
    v_name := NULL;
  END IF;
  -- The counter falls back to the VPA itself when the finance settings carry no display name.
  IF char_length(v_name) > 330 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'payee_name')::text;
  END IF;

  SELECT * INTO v_old FROM seva_settings s WHERE s.id = 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'seva_settings')::text;
  END IF;
  IF v_old.counter_upi_vpa IS NOT DISTINCT FROM v_vpa AND v_old.counter_upi_payee_name IS NOT DISTINCT FROM v_name THEN
    RETURN false;
  END IF;

  UPDATE seva_settings s SET counter_upi_vpa = v_vpa, counter_upi_payee_name = v_name WHERE s.id = 1;
  PERFORM seva_audit(
    'settings.upi_changed', 'seva_settings', '1', NULL,
    'The counter UPI payee changed in the finance settings',
    jsonb_build_object('vpa', seva_mask_vpa(v_old.counter_upi_vpa), 'payee_name', v_old.counter_upi_payee_name),
    jsonb_build_object('vpa', seva_mask_vpa(v_vpa), 'payee_name', v_name),
    NULL
  );
  RETURN true;
END;
$$;

-- Replaces the cash denominations with p_rows, in order: [{ kind: 'note'|'coin', value: 1..2000, shown?: bool }].
-- Rows not listed are removed (old day closes keep their own snapshots). Audits denominations.update.
CREATE OR REPLACE FUNCTION seva_save_denominations(p_rows jsonb, p_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row jsonb;
  v_kind text;
  v_value numeric(8,2);
  v_shown boolean;
  v_kinds text[] := ARRAY[]::text[];
  v_values numeric[] := ARRAY[]::numeric[];
  v_shows boolean[] := ARRAY[]::boolean[];
  v_before jsonb;
  v_after jsonb;
BEGIN
  PERFORM seva_admin_require_actor(p_staff_id);
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'rows')::text;
  END IF;

  FOR v_row IN SELECT e.r FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS e(r, ord) ORDER BY e.ord LOOP
    PERFORM seva_admin_check_keys(v_row, ARRAY['kind', 'value', 'shown']);
    BEGIN
      v_kind := v_row ->> 'kind';
      v_value := (v_row ->> 'value')::numeric(8,2);
      v_shown := coalesce((v_row ->> 'shown')::boolean, true);
    EXCEPTION WHEN data_exception THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'value')::text;
    END;
    IF v_kind IS NULL OR v_kind NOT IN ('note', 'coin') THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'kind')::text;
    END IF;
    IF v_value IS NULL OR v_value <= 0 OR v_value > 2000 THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'value')::text;
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_kinds, v_values) AS u(k, v) WHERE u.k = v_kind AND u.v = v_value) THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'value', 'reason', 'duplicate')::text;
    END IF;
    v_kinds := v_kinds || v_kind;
    v_values := v_values || v_value::numeric;
    v_shows := v_shows || v_shown;
  END LOOP;

  LOCK TABLE cash_denominations IN SHARE ROW EXCLUSIVE MODE;
  SELECT jsonb_agg(jsonb_build_object('kind', d.kind, 'value', d.value::text, 'shown', d.shown) ORDER BY d.display_order, d.id)
    INTO v_before FROM cash_denominations d;

  DELETE FROM cash_denominations d
   WHERE NOT EXISTS (SELECT 1 FROM unnest(v_kinds, v_values) AS u(k, v) WHERE u.k = d.kind AND u.v = d.value);
  INSERT INTO cash_denominations (kind, value, display_order, shown)
  SELECT u.k, u.v, u.ord::smallint, u.s FROM unnest(v_kinds, v_values, v_shows) WITH ORDINALITY AS u(k, v, s, ord)
  ON CONFLICT (kind, value) DO UPDATE SET display_order = EXCLUDED.display_order, shown = EXCLUDED.shown;

  SELECT jsonb_agg(jsonb_build_object('kind', u.k, 'value', u.v::numeric(8,2)::text, 'shown', u.s) ORDER BY u.ord)
    INTO v_after FROM unnest(v_kinds, v_values, v_shows) WITH ORDINALITY AS u(k, v, s, ord);

  PERFORM seva_audit('denominations.update', 'cash_denominations', NULL, NULL, NULL, v_before, v_after, p_staff_id);
END;
$$;

-- Creates or updates a festival with its dates: { id?, name_en, name_kn?, active?, days: ['YYYY-MM-DD', ...] }.
-- The dates given replace the festival's dates. Audits festival.update.
CREATE OR REPLACE FUNCTION seva_save_festival(p_festival jsonb, p_staff_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_old festival_days%ROWTYPE;
  v_name_en text;
  v_name_kn text;
  v_active boolean;
  v_days date[];
  v_before jsonb;
  v_after jsonb;
BEGIN
  PERFORM seva_admin_require_actor(p_staff_id);
  PERFORM seva_admin_check_keys(p_festival, ARRAY['id', 'name_en', 'name_kn', 'active', 'days']);

  BEGIN
    IF p_festival ? 'id' AND jsonb_typeof(p_festival -> 'id') <> 'null' THEN
      v_id := (p_festival ->> 'id')::uuid;
    END IF;
    v_name_en := btrim(p_festival ->> 'name_en');
    v_name_kn := nullif(btrim(p_festival ->> 'name_kn'), '');
    v_active := coalesce((p_festival ->> 'active')::boolean, true);
    IF jsonb_typeof(p_festival -> 'days') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'days')::text;
    END IF;
    SELECT array_agg(DISTINCT (e.d)::date ORDER BY (e.d)::date) INTO v_days
      FROM jsonb_array_elements_text(p_festival -> 'days') AS e(d);
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'festival', 'reason', 'type')::text;
  END;

  IF v_name_en IS NULL OR v_name_en = '' OR char_length(v_name_en) > 80 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'name_en')::text;
  END IF;
  IF coalesce(cardinality(v_days), 0) = 0 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'days')::text;
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT * INTO v_old FROM festival_days f WHERE f.id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'festival')::text;
    END IF;
    SELECT jsonb_build_object('name_en', v_old.name_en, 'name_kn', v_old.name_kn, 'active', v_old.active,
             'days', coalesce(jsonb_agg(fd.day ORDER BY fd.day), '[]'::jsonb))
      INTO v_before FROM festival_day_dates fd WHERE fd.festival_id = v_id;
    UPDATE festival_days f
       SET name_en = v_name_en, name_kn = v_name_kn, active = v_active, updated_by_staff_id = p_staff_id
     WHERE f.id = v_id;
    DELETE FROM festival_day_dates fd WHERE fd.festival_id = v_id;
  ELSE
    INSERT INTO festival_days (name_en, name_kn, active, updated_by_staff_id)
    VALUES (v_name_en, v_name_kn, v_active, p_staff_id)
    RETURNING id INTO v_id;
  END IF;

  INSERT INTO festival_day_dates (festival_id, day) SELECT v_id, d FROM unnest(v_days) AS u(d);

  v_after := jsonb_build_object('name_en', v_name_en, 'name_kn', v_name_kn, 'active', v_active, 'days', to_jsonb(v_days));
  PERFORM seva_audit('festival.update', 'festival_days', v_id::text, NULL, NULL, v_before, v_after, p_staff_id);
  RETURN v_id;
END;
$$;

-- Adds the next counter (id = highest + 1, at most 99) with its series C<n> (online) and OF<n> (offline).
-- Audits settings.update on entity 'counters'.
CREATE OR REPLACE FUNCTION seva_add_counter(p_name text, p_place text, p_staff_id uuid)
RETURNS smallint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_place text := nullif(btrim(coalesce(p_place, '')), '');
  v_id integer;
BEGIN
  PERFORM seva_admin_require_actor(p_staff_id);
  IF v_name = '' OR char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'name')::text;
  END IF;

  LOCK TABLE counters IN SHARE ROW EXCLUSIVE MODE;
  SELECT coalesce(max(c.id), 0) + 1 INTO v_id FROM counters c;
  IF v_id > 99 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'counter', 'reason', 'limit')::text;
  END IF;

  INSERT INTO counters (id, name, place) VALUES (v_id::smallint, v_name, v_place);
  INSERT INTO receipt_series (code, kind, counter_id)
  VALUES ('C' || v_id, 'counter_online', v_id::smallint), ('OF' || v_id, 'counter_offline', v_id::smallint);

  PERFORM seva_audit('settings.update', 'counters', v_id::text, NULL, NULL, NULL,
                     jsonb_build_object('name', v_name, 'place', v_place, 'opening_float', '0.00', 'active', true,
                                        'online_series', 'C' || v_id, 'offline_series', 'OF' || v_id),
                     p_staff_id);
  RETURN v_id::smallint;
END;
$$;

-- Changes a counter's name, place, opening float or active flag. Audits settings.update with what changed.
CREATE OR REPLACE FUNCTION seva_update_counter(p_counter_id smallint, p_patch jsonb, p_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old counters%ROWTYPE;
  v_new counters%ROWTYPE;
  v_diff jsonb;
BEGIN
  PERFORM seva_admin_require_actor(p_staff_id);
  PERFORM seva_admin_check_keys(p_patch, ARRAY['name', 'place', 'opening_float', 'active']);

  SELECT * INTO v_old FROM counters c WHERE c.id = p_counter_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'counter')::text;
  END IF;
  v_new := v_old;

  BEGIN
    IF p_patch ? 'name' THEN v_new.name := btrim(p_patch ->> 'name'); END IF;
    IF p_patch ? 'place' THEN v_new.place := nullif(btrim(p_patch ->> 'place'), ''); END IF;
    IF p_patch ? 'opening_float' THEN v_new.opening_float := (p_patch ->> 'opening_float')::numeric(10,2); END IF;
    IF p_patch ? 'active' THEN v_new.active := (p_patch ->> 'active')::boolean; END IF;
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'counter', 'reason', 'type')::text;
  END;

  IF v_new.name IS NULL OR v_new.name = '' OR char_length(v_new.name) > 80 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'name')::text;
  END IF;
  IF v_new.opening_float IS NULL OR v_new.opening_float < 0 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'opening_float')::text;
  END IF;
  IF v_new.active IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'active')::text;
  END IF;

  v_diff := seva_admin_diff(
    jsonb_build_object('name', v_old.name, 'place', v_old.place, 'opening_float', v_old.opening_float::text,
                       'active', v_old.active),
    jsonb_build_object('name', v_new.name, 'place', v_new.place, 'opening_float', v_new.opening_float::text,
                       'active', v_new.active),
    ARRAY['name', 'place', 'opening_float', 'active']);
  IF v_diff -> 'after' = '{}'::jsonb THEN
    RETURN;
  END IF;

  UPDATE counters c
     SET name = v_new.name, place = v_new.place, opening_float = v_new.opening_float, active = v_new.active
   WHERE c.id = p_counter_id;

  PERFORM seva_audit('settings.update', 'counters', p_counter_id::text, NULL, NULL, v_diff -> 'before',
                     v_diff -> 'after', p_staff_id);
END;
$$;

-- =====================================================================================================
-- 4. Staff (DB 3.4, 7.2, 13.6) - the role lives in Firestore; this is the seva profile and lifecycle
-- =====================================================================================================

-- Onboards a staff member as 'invited': { firebase_uid, full_name, email, staff_no?, view_only? }. The staff number
-- is the one given (if free) or the next one (max + 1, never reused). Audits staff.onboard.
CREATE OR REPLACE FUNCTION seva_staff_onboard(p_staff jsonb, p_actor uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid text;
  v_name text;
  v_email text;
  v_no integer;
  v_view_only boolean;
  v_id uuid;
BEGIN
  PERFORM seva_admin_require_actor(p_actor);
  PERFORM seva_admin_check_keys(p_staff, ARRAY['firebase_uid', 'full_name', 'email', 'staff_no', 'view_only']);

  BEGIN
    v_uid := btrim(p_staff ->> 'firebase_uid');
    v_name := btrim(p_staff ->> 'full_name');
    v_email := lower(btrim(p_staff ->> 'email'));
    v_no := (p_staff ->> 'staff_no')::integer;
    v_view_only := coalesce((p_staff ->> 'view_only')::boolean, false);
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'staff', 'reason', 'type')::text;
  END;

  IF v_uid IS NULL OR v_uid = '' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'firebase_uid')::text;
  END IF;
  IF v_name IS NULL OR v_name = '' OR char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'full_name')::text;
  END IF;
  IF v_email IS NULL OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'email')::text;
  END IF;

  -- Serialises onboarding so two people never get the same next number.
  LOCK TABLE staff IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (SELECT 1 FROM staff s WHERE s.firebase_uid = v_uid) THEN
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

  INSERT INTO staff (firebase_uid, staff_no, full_name, email, view_only, status, invited_by_staff_id, invited_at)
  VALUES (v_uid, v_no::smallint, v_name, v_email, v_view_only, 'invited', p_actor, now())
  RETURNING id INTO v_id;

  PERFORM seva_audit('staff.onboard', 'staff', v_id::text, NULL, NULL, NULL,
                     jsonb_build_object('staff_no', v_no, 'full_name', v_name, 'view_only', v_view_only,
                                        'status', 'invited'),
                     p_actor);
  RETURN v_id;
END;
$$;

-- Changes a staff member's view-only switch and/or status: { view_only?, status?: 'active'|'inactive'|'deleted' }.
--   inactive (offboard) and deleted need a reason of at least 3 characters; deleted is final (DB 3.4).
--   active from inactive reactivates (back to 'invited' if the person never signed in).
-- Audits staff.view_only_change, staff.deactivate, staff.reactivate, staff.delete.
CREATE OR REPLACE FUNCTION seva_staff_update(p_staff_id uuid, p_patch jsonb, p_reason text, p_actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_old staff%ROWTYPE;
  v_view_only boolean;
  v_status text;
  v_target text;
  v_action text;
BEGIN
  PERFORM seva_admin_require_actor(p_actor);
  PERFORM seva_admin_check_keys(p_patch, ARRAY['view_only', 'status']);

  SELECT * INTO v_old FROM staff s WHERE s.id = p_staff_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'staff')::text;
  END IF;
  IF v_old.status = 'deleted' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'status', 'reason', 'deleted')::text;
  END IF;

  BEGIN
    v_view_only := (p_patch ->> 'view_only')::boolean;
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'view_only')::text;
  END;
  IF p_patch ? 'view_only' AND v_view_only IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'view_only')::text;
  END IF;
  v_status := p_patch ->> 'status';
  IF p_patch ? 'status' AND (v_status IS NULL OR v_status NOT IN ('active', 'inactive', 'deleted')) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'status')::text;
  END IF;

  IF v_view_only IS NOT NULL AND v_view_only IS DISTINCT FROM v_old.view_only THEN
    UPDATE staff s SET view_only = v_view_only WHERE s.id = p_staff_id;
    PERFORM seva_audit('staff.view_only_change', 'staff', p_staff_id::text, NULL, v_reason,
                       jsonb_build_object('view_only', v_old.view_only), jsonb_build_object('view_only', v_view_only),
                       p_actor);
  END IF;

  IF v_status IS NULL THEN
    RETURN;
  END IF;

  IF v_status = 'active' THEN
    IF v_old.status <> 'inactive' THEN
      RETURN; -- already active or invited
    END IF;
    v_target := CASE WHEN v_old.first_signed_in_at IS NULL THEN 'invited' ELSE 'active' END;
    v_action := 'staff.reactivate';
  ELSE
    IF v_status = v_old.status THEN
      RETURN;
    END IF;
    IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
      -- validation on field 'reason', not change_reason_required: that code's message is about a changed amount.
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'reason')::text;
    END IF;
    v_target := v_status;
    v_action := CASE v_status WHEN 'inactive' THEN 'staff.deactivate' ELSE 'staff.delete' END;
  END IF;

  UPDATE staff s
     SET status = v_target, status_reason = v_reason, status_changed_at = now(), status_changed_by_staff_id = p_actor
   WHERE s.id = p_staff_id;

  PERFORM seva_audit(v_action, 'staff', p_staff_id::text, NULL, v_reason,
                     jsonb_build_object('status', v_old.status), jsonb_build_object('status', v_target), p_actor);
END;
$$;

-- First successful sign-in: invited -> active and first_signed_in_at, once. Never reactivates an inactive or
-- deleted person.
CREATE OR REPLACE FUNCTION seva_mark_signed_in(p_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE staff s
     SET status = 'active', first_signed_in_at = coalesce(s.first_signed_in_at, now()), status_changed_at = now()
   WHERE s.id = p_staff_id AND s.status = 'invited';
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM staff s WHERE s.id = p_staff_id) THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'staff')::text;
  END IF;
END;
$$;

-- Deletes returning-devotee profiles not seen for 3 years (C-32; monthly job). Returns how many were removed.
CREATE OR REPLACE FUNCTION seva_purge_devotee_profiles()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n integer;
BEGIN
  DELETE FROM devotee_profiles p WHERE p.last_seen_at < now() - interval '3 years';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- =====================================================================================================
-- 5. Reports (DB 12.1-12.4). Counted receipts: status 'issued', not test mode (C-18).
-- =====================================================================================================

-- Totals of issued, non-test receipts issued in [p_from, p_to), split by the order's payment mode (DB 12.1).
CREATE OR REPLACE FUNCTION seva_report_totals(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v jsonb;
BEGIN
  SELECT jsonb_build_object(
           'total', coalesce(sum(r.total), 0)::numeric(12,2)::text,
           'receipts', count(*),
           'cash', coalesce(sum(r.total) FILTER (WHERE o.payment_mode = 'cash'), 0)::numeric(12,2)::text,
           'upi', coalesce(sum(r.total) FILTER (WHERE o.payment_mode = 'upi'), 0)::numeric(12,2)::text,
           'online', coalesce(sum(r.total) FILTER (WHERE o.payment_mode = 'online'), 0)::numeric(12,2)::text)
    INTO v
    FROM seva_receipts r
    JOIN seva_orders o ON o.id = r.order_id
   WHERE r.status = 'issued' AND NOT r.test_mode AND NOT o.test_mode
     AND r.issued_at >= p_from AND r.issued_at < p_to;
  RETURN v;
END;
$$;

-- Number continuity per series and IST year for receipts whose business date is in [p_from, p_to] (DB 12.3), with
-- the open gaps of each series-year in those years (a series-year with open gaps but no receipts in range is listed
-- with null first/last).
CREATE OR REPLACE FUNCTION seva_continuity(p_from date, p_to date)
RETURNS TABLE (series_code text, year smallint, first_no int, last_no int, issued int, cancelled int, open_gaps int)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'range')::text;
  END IF;
  RETURN QUERY
  WITH rec AS (
    SELECT sr.series_code AS s_code, sr.year AS s_year, min(sr.running_no) AS f_no, max(sr.running_no) AS l_no,
           (count(*) FILTER (WHERE sr.status = 'issued'))::int AS n_issued,
           (count(*) FILTER (WHERE sr.status = 'cancelled'))::int AS n_cancelled
      FROM seva_receipts sr
     WHERE sr.business_date BETWEEN p_from AND p_to
     GROUP BY sr.series_code, sr.year
  ),
  gap AS (
    SELECT g.series_code AS s_code, g.year AS s_year, count(*)::int AS n_gaps
      FROM receipt_number_gaps g
     WHERE g.status = 'open'
       AND g.year BETWEEN extract(year FROM p_from)::int AND extract(year FROM p_to)::int
     GROUP BY g.series_code, g.year
  )
  SELECT coalesce(rec.s_code, gap.s_code), coalesce(rec.s_year, gap.s_year), rec.f_no, rec.l_no,
         coalesce(rec.n_issued, 0), coalesce(rec.n_cancelled, 0), coalesce(gap.n_gaps, 0)
    FROM rec
    FULL JOIN gap ON gap.s_code = rec.s_code AND gap.s_year = rec.s_year
   ORDER BY 1, 2;
END;
$$;

-- Dashboard data for [p_from, p_to) with an optional previous span [p_prev_from, p_prev_to) chosen by the caller
-- (like-for-like, DB 12.1, C-04, C-13). p_bucket: 'hour' (05:00-22:00 IST of each day, plus any other hour with
-- data), 'day' or 'month'. Bucket keys: 'YYYY-MM-DD HH24:00' / 'YYYY-MM-DD' / 'YYYY-MM' (IST). The previous span is
-- shifted onto the current keys (by whole days for hour/day buckets, by whole months for month buckets) for the
-- ghost line. Collections are by issue time (cash flow, C-63).
CREATE OR REPLACE FUNCTION seva_dashboard(
  p_from timestamptz,
  p_to timestamptz,
  p_prev_from timestamptz,
  p_prev_to timestamptz,
  p_bucket text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_zone constant text := 'Asia/Kolkata';
  v_from_l timestamp;
  v_last_l timestamp;
  v_prev_l timestamp;
  v_step interval;
  v_fmt text;
  v_label text;
  v_shift interval;
  v_has_prev boolean := p_prev_from IS NOT NULL OR p_prev_to IS NOT NULL;
  v_tiles jsonb;
  v_buckets jsonb;
  v_ghost jsonb := '[]'::jsonb;
  v_top jsonb;
  v_rush jsonb;
  v_calendar jsonb;
  v_festivals jsonb;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'range')::text;
  END IF;
  IF p_bucket IS NULL OR p_bucket NOT IN ('hour', 'day', 'month') THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'bucket')::text;
  END IF;
  IF v_has_prev AND (p_prev_from IS NULL OR p_prev_to IS NULL OR p_prev_to <= p_prev_from) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'previous_range')::text;
  END IF;

  v_from_l := p_from AT TIME ZONE c_zone;
  v_last_l := (p_to - interval '1 microsecond') AT TIME ZONE c_zone;
  v_step := ('1 ' || p_bucket)::interval;
  v_fmt := CASE p_bucket WHEN 'hour' THEN 'YYYY-MM-DD HH24:00' WHEN 'day' THEN 'YYYY-MM-DD' ELSE 'YYYY-MM' END;
  v_label := CASE p_bucket WHEN 'hour' THEN 'HH24:00' WHEN 'day' THEN 'DD Mon' ELSE 'Mon' END;

  v_tiles := seva_report_totals(p_from, p_to);
  IF v_has_prev THEN
    v_tiles := v_tiles || jsonb_build_object('prev', seva_report_totals(p_prev_from, p_prev_to));
    v_prev_l := p_prev_from AT TIME ZONE c_zone;
    IF p_bucket = 'month' THEN
      v_shift := make_interval(months =>
        ((extract(year FROM v_from_l) - extract(year FROM v_prev_l)) * 12
          + extract(month FROM v_from_l) - extract(month FROM v_prev_l))::int);
    ELSE
      v_shift := make_interval(days => (v_from_l::date - v_prev_l::date));
    END IF;
  ELSE
    v_tiles := v_tiles || jsonb_build_object('prev', NULL);
  END IF;

  -- Hero: one bucket per slot, stacked by mode.
  WITH cur AS (
    SELECT date_trunc(p_bucket, r.issued_at AT TIME ZONE c_zone) AS slot, o.payment_mode AS mode, r.total
      FROM seva_receipts r JOIN seva_orders o ON o.id = r.order_id
     WHERE r.status = 'issued' AND NOT r.test_mode AND NOT o.test_mode
       AND r.issued_at >= p_from AND r.issued_at < p_to
  ),
  slots AS (
    SELECT gs.slot FROM generate_series(date_trunc(p_bucket, v_from_l), date_trunc(p_bucket, v_last_l), v_step) AS gs(slot)
     WHERE p_bucket <> 'hour'
    UNION
    SELECT d.day + make_interval(hours => h.h)
      FROM generate_series(date_trunc('day', v_from_l), date_trunc('day', v_last_l), interval '1 day') AS d(day),
           generate_series(5, 22) AS h(h)
     WHERE p_bucket = 'hour'
    UNION
    SELECT cur.slot FROM cur
  )
  SELECT jsonb_agg(jsonb_build_object(
           'key', to_char(s.slot, v_fmt), 'label', to_char(s.slot, v_label),
           'cash', coalesce((SELECT sum(c.total) FROM cur c WHERE c.slot = s.slot AND c.mode = 'cash'), 0)::numeric(12,2)::text,
           'upi', coalesce((SELECT sum(c.total) FROM cur c WHERE c.slot = s.slot AND c.mode = 'upi'), 0)::numeric(12,2)::text,
           'online', coalesce((SELECT sum(c.total) FROM cur c WHERE c.slot = s.slot AND c.mode = 'online'), 0)::numeric(12,2)::text)
         ORDER BY s.slot)
    INTO v_buckets
    FROM slots s;

  IF v_has_prev THEN
    WITH prev AS (
      SELECT date_trunc(p_bucket, r.issued_at AT TIME ZONE c_zone) + v_shift AS slot, r.total
        FROM seva_receipts r JOIN seva_orders o ON o.id = r.order_id
       WHERE r.status = 'issued' AND NOT r.test_mode AND NOT o.test_mode
         AND r.issued_at >= p_prev_from AND r.issued_at < p_prev_to
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'key', b ->> 'key',
             'total', coalesce((SELECT sum(p.total) FROM prev p WHERE to_char(p.slot, v_fmt) = b ->> 'key'), 0)::numeric(12,2)::text)
           ORDER BY e.ord), '[]'::jsonb)
      INTO v_ghost
      FROM jsonb_array_elements(v_buckets) WITH ORDINALITY AS e(b, ord);
  END IF;

  -- Top sevas by the amount actually paid on issued receipts.
  WITH cur AS (
    SELECT l.seva_id, sum(l.amount) AS amount, sum(l.quantity)::int AS quantity
      FROM seva_receipt_lines l
      JOIN seva_receipts r ON r.id = l.receipt_id
      JOIN seva_orders o ON o.id = r.order_id
     WHERE r.status = 'issued' AND NOT r.test_mode AND NOT o.test_mode
       AND r.issued_at >= p_from AND r.issued_at < p_to
     GROUP BY l.seva_id
     ORDER BY sum(l.amount) DESC, l.seva_id
     LIMIT 10
  ),
  prev AS (
    SELECT l.seva_id, sum(l.amount) AS amount
      FROM seva_receipt_lines l
      JOIN seva_receipts r ON r.id = l.receipt_id
      JOIN seva_orders o ON o.id = r.order_id
     WHERE v_has_prev AND r.status = 'issued' AND NOT r.test_mode AND NOT o.test_mode
       AND r.issued_at >= p_prev_from AND r.issued_at < p_prev_to
     GROUP BY l.seva_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'seva_id', c.seva_id, 'name_en', s.name, 'name_kn', s.name_kn,
           'amount', c.amount::numeric(12,2)::text, 'quantity', c.quantity,
           'prev_amount', coalesce(p.amount, 0)::numeric(12,2)::text)
         ORDER BY c.amount DESC, s.display_order, c.seva_id), '[]'::jsonb)
    INTO v_top
    FROM cur c
    JOIN sevas s ON s.id = c.seva_id
    LEFT JOIN prev p ON p.seva_id = c.seva_id;

  -- Counter rush: counter visits (orders with an issued receipt) by IST ISO weekday (Monday 1) and hour.
  SELECT coalesce(jsonb_agg(jsonb_build_object('dow', x.dow, 'hour', x.hr, 'count', x.n) ORDER BY x.dow, x.hr), '[]'::jsonb)
    INTO v_rush
    FROM (
      SELECT extract(isodow FROM o.issued_at AT TIME ZONE c_zone)::int AS dow,
             extract(hour FROM o.issued_at AT TIME ZONE c_zone)::int AS hr,
             count(*)::int AS n
        FROM seva_orders o
       WHERE o.channel = 'counter' AND NOT o.test_mode
         AND o.issued_at >= p_from AND o.issued_at < p_to
         AND EXISTS (SELECT 1 FROM seva_receipts r WHERE r.order_id = o.id AND r.status = 'issued' AND NOT r.test_mode)
       GROUP BY 1, 2
    ) x;

  -- Daily totals for the calendar heatmap (IST business date of issue).
  SELECT coalesce(jsonb_agg(jsonb_build_object('date', x.d, 'total', x.t::numeric(12,2)::text) ORDER BY x.d), '[]'::jsonb)
    INTO v_calendar
    FROM (
      SELECT r.business_date AS d, sum(r.total) AS t
        FROM seva_receipts r JOIN seva_orders o ON o.id = r.order_id
       WHERE r.status = 'issued' AND NOT r.test_mode AND NOT o.test_mode
         AND r.issued_at >= p_from AND r.issued_at < p_to
       GROUP BY r.business_date
    ) x;

  SELECT coalesce(jsonb_agg(DISTINCT fd.day ORDER BY fd.day), '[]'::jsonb)
    INTO v_festivals
    FROM festival_day_dates fd
    JOIN festival_days f ON f.id = fd.festival_id AND f.active
   WHERE fd.day BETWEEN v_from_l::date AND v_last_l::date;

  RETURN jsonb_build_object(
    'as_of', now(),
    'bucket', p_bucket,
    'tiles', v_tiles,
    'hero', jsonb_build_object('buckets', coalesce(v_buckets, '[]'::jsonb), 'prev', v_ghost),
    'top_sevas', v_top,
    'mode', jsonb_build_object('cash', v_tiles -> 'cash', 'upi', v_tiles -> 'upi', 'online', v_tiles -> 'online'),
    'rush', v_rush,
    'calendar', v_calendar,
    'festival_dates', v_festivals
  );
END;
$$;

-- Needs attention cards (DB 12.2) for the period [p_from, p_to) and the IST business date p_today. Returns a JSON
-- array of { id, level: 'ok'|'attention'|'critical', count, detail } in a fixed order (offline_cancels also carries
-- entries); a card with nothing to report is level 'ok' with count 0.
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
  -- when one was sent by someone other than the canceller, or arrived more than the cancel window after its recorded
  -- time (A3 security gate M-2).
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
              OR a.at > (a.after ->> 'cancelled_at')::timestamptz + make_interval(mins => v_window)) AS flagged,
             row_number() OVER (ORDER BY a.id DESC) AS rn
        FROM audit_log a
       WHERE a.action = 'receipt.cancel' AND a.after ->> 'offline' = 'true' AND a.at >= p_from AND a.at < p_to
    ) x
    LEFT JOIN staff sc ON sc.id = x.canceller_id
    LEFT JOIN staff ss ON ss.id = x.syncer_id;
  v_cards := v_cards || jsonb_build_object('id', 'offline_cancels', 'level', CASE WHEN v_m > 0 THEN 'attention' ELSE 'ok' END,
                                           'count', v_n, 'detail', jsonb_build_object('flagged', v_m),
                                           'entries', v_entries);

  -- upi_changed: the counter's UPI payee changed in the period (settings.upi_changed rows written by
  -- seva_note_counter_upi); the detail names the latest change, masked (A3 security gate H-1).
  SELECT count(*)::int INTO v_n
    FROM audit_log a WHERE a.action = 'settings.upi_changed' AND a.at >= p_from AND a.at < p_to;
  SELECT a.* INTO v_upi
    FROM audit_log a WHERE a.action = 'settings.upi_changed' AND a.at >= p_from AND a.at < p_to
   ORDER BY a.id DESC LIMIT 1;
  v_cards := v_cards || jsonb_build_object('id', 'upi_changed', 'level', CASE WHEN v_n > 0 THEN 'attention' ELSE 'ok' END,
                                           'count', v_n,
                                           'detail', jsonb_strip_nulls(jsonb_build_object(
                                             'from_vpa', v_upi.before ->> 'vpa', 'to_vpa', v_upi.after ->> 'vpa',
                                             'changed_at', v_upi.at)));

  RETURN v_cards;
END;
$$;

-- Seva summary by seva date (C-63) for [p_from, p_to], with the same days one year earlier and the rate changes
-- made in the range (DB 12.4). Amounts are what was actually paid on issued receipts.
CREATE OR REPLACE FUNCTION seva_seva_summary(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ly_from date;
  v_ly_to date;
  v_sevas jsonb;
  v_totals jsonb;
  v_rates jsonb;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'range')::text;
  END IF;
  v_ly_from := (p_from - interval '1 year')::date;
  v_ly_to := (p_to - interval '1 year')::date;

  WITH t AS (
    SELECT l.seva_id, r.id AS receipt_id, (r.seva_date BETWEEN p_from AND p_to) AS cur, l.quantity, l.amount
      FROM seva_receipt_lines l
      JOIN seva_receipts r ON r.id = l.receipt_id
     WHERE r.status = 'issued' AND NOT r.test_mode
       AND (r.seva_date BETWEEN p_from AND p_to OR r.seva_date BETWEEN v_ly_from AND v_ly_to)
  ),
  a AS (
    SELECT t.seva_id,
           (count(DISTINCT t.receipt_id) FILTER (WHERE t.cur))::int AS receipts,
           coalesce(sum(t.quantity) FILTER (WHERE t.cur), 0)::int AS quantity,
           coalesce(sum(t.amount) FILTER (WHERE t.cur), 0) AS amount,
           (count(DISTINCT t.receipt_id) FILTER (WHERE NOT t.cur))::int AS ly_receipts,
           coalesce(sum(t.quantity) FILTER (WHERE NOT t.cur), 0)::int AS ly_quantity,
           coalesce(sum(t.amount) FILTER (WHERE NOT t.cur), 0) AS ly_amount
      FROM t
     GROUP BY t.seva_id
  )
  SELECT
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
              'seva_id', a.seva_id, 'name_en', s.name, 'name_kn', s.name_kn, 'category', s.category,
              'receipts', a.receipts, 'quantity', a.quantity, 'amount', a.amount::numeric(12,2)::text,
              'last_year', jsonb_build_object('receipts', a.ly_receipts, 'quantity', a.ly_quantity,
                                              'amount', a.ly_amount::numeric(12,2)::text))
            ORDER BY a.amount DESC, s.display_order, a.seva_id), '[]'::jsonb)
       FROM a JOIN sevas s ON s.id = a.seva_id),
    (SELECT jsonb_build_object(
              'receipts', (count(DISTINCT t.receipt_id) FILTER (WHERE t.cur))::int,
              'amount', coalesce(sum(t.amount) FILTER (WHERE t.cur), 0)::numeric(12,2)::text,
              'last_year_receipts', (count(DISTINCT t.receipt_id) FILTER (WHERE NOT t.cur))::int,
              'last_year_amount', coalesce(sum(t.amount) FILTER (WHERE NOT t.cur), 0)::numeric(12,2)::text)
       FROM t)
    INTO v_sevas, v_totals;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'seva_id', h.seva_id, 'name_en', s.name, 'old_amount', h.old_amount::numeric(10,2)::text,
           'new_amount', h.new_amount::numeric(10,2)::text, 'changed_at', h.changed_at, 'reason', h.reason)
         ORDER BY h.changed_at, h.id), '[]'::jsonb)
    INTO v_rates
    FROM seva_rate_history h
    JOIN sevas s ON s.id = h.seva_id
   WHERE h.old_amount IS NOT NULL
     AND (h.changed_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN p_from AND p_to;

  RETURN jsonb_build_object('from', p_from, 'to', p_to, 'last_year_from', v_ly_from, 'last_year_to', v_ly_to,
                            'sevas', v_sevas, 'totals', v_totals, 'rate_changes', v_rates);
END;
$$;

-- One side of the festival report: issued receipts whose seva date is one of p_dates.
CREATE OR REPLACE FUNCTION seva_report_festival_part(p_dates date[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_head jsonb;
  v_sevas jsonb;
  v_days jsonb;
BEGIN
  SELECT jsonb_build_object(
           'receipts', count(*)::int,
           'amount', coalesce(sum(r.total), 0)::numeric(12,2)::text,
           'prasadam_receipts', (count(*) FILTER (WHERE r.prasadam_state IN ('pending', 'given')))::int,
           'prasadam_given', (count(*) FILTER (WHERE r.prasadam_state = 'given'))::int)
    INTO v_head
    FROM seva_receipts r
   WHERE r.status = 'issued' AND NOT r.test_mode AND r.seva_date = ANY (p_dates);

  SELECT coalesce(jsonb_agg(jsonb_build_object('seva_id', x.seva_id, 'name_en', s.name, 'name_kn', s.name_kn,
                                               'quantity', x.quantity, 'amount', x.amount::numeric(12,2)::text)
                            ORDER BY x.amount DESC, s.display_order, x.seva_id), '[]'::jsonb)
    INTO v_sevas
    FROM (
      SELECT l.seva_id, sum(l.quantity)::int AS quantity, sum(l.amount) AS amount
        FROM seva_receipt_lines l JOIN seva_receipts r ON r.id = l.receipt_id
       WHERE r.status = 'issued' AND NOT r.test_mode AND r.seva_date = ANY (p_dates)
       GROUP BY l.seva_id
    ) x
    JOIN sevas s ON s.id = x.seva_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'date', d.day,
           'receipts', (SELECT count(*)::int FROM seva_receipts r
                         WHERE r.status = 'issued' AND NOT r.test_mode AND r.seva_date = d.day),
           'amount', (SELECT coalesce(sum(r.total), 0)::numeric(12,2)::text FROM seva_receipts r
                       WHERE r.status = 'issued' AND NOT r.test_mode AND r.seva_date = d.day))
         ORDER BY d.day), '[]'::jsonb)
    INTO v_days
    FROM unnest(p_dates) AS d(day);

  RETURN jsonb_build_object('dates', (SELECT coalesce(jsonb_agg(d.day ORDER BY d.day), '[]'::jsonb) FROM unnest(p_dates) AS d(day)))
         || v_head || jsonb_build_object('sevas', v_sevas, 'per_day', v_days);
END;
$$;

-- Festival view (DB 12.4): the festival's dates in its latest year against an earlier year - the festival's own
-- dates in that year when it has some, otherwise the same days of that year. Counted by seva date (C-63).
CREATE OR REPLACE FUNCTION seva_festival_report(p_festival_id uuid, p_compare_year smallint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_f festival_days%ROWTYPE;
  v_year integer;
  v_cur date[];
  v_cmp date[];
BEGIN
  SELECT * INTO v_f FROM festival_days f WHERE f.id = p_festival_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'festival')::text;
  END IF;
  SELECT max(extract(year FROM fd.day))::int INTO v_year FROM festival_day_dates fd WHERE fd.festival_id = p_festival_id;
  IF v_year IS NULL THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'days')::text;
  END IF;
  IF p_compare_year IS NULL OR p_compare_year >= v_year THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'compare_year')::text;
  END IF;

  SELECT array_agg(fd.day ORDER BY fd.day) INTO v_cur
    FROM festival_day_dates fd WHERE fd.festival_id = p_festival_id AND extract(year FROM fd.day) = v_year;
  SELECT array_agg(fd.day ORDER BY fd.day) INTO v_cmp
    FROM festival_day_dates fd WHERE fd.festival_id = p_festival_id AND extract(year FROM fd.day) = p_compare_year;
  IF v_cmp IS NULL THEN
    SELECT array_agg(DISTINCT (d.day - make_interval(years => v_year - p_compare_year))::date
                     ORDER BY (d.day - make_interval(years => v_year - p_compare_year))::date) INTO v_cmp
      FROM unnest(v_cur) AS d(day);
  END IF;

  RETURN jsonb_build_object(
    'festival', jsonb_build_object('id', v_f.id, 'name_en', v_f.name_en, 'name_kn', v_f.name_kn),
    'year', v_year,
    'compare_year', p_compare_year,
    'current', seva_report_festival_part(v_cur),
    'compare', seva_report_festival_part(v_cmp)
  );
END;
$$;

-- =====================================================================================================
-- 6. Function privileges: service_role only
-- =====================================================================================================

REVOKE EXECUTE ON FUNCTION seva_admin_require_actor(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_admin_require_actor(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_admin_check_keys(jsonb, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_admin_check_keys(jsonb, text[]) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_admin_diff(jsonb, jsonb, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_admin_diff(jsonb, jsonb, text[]) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_admin_seva_json(sevas) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_admin_seva_json(sevas) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_upsert_seva(jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_upsert_seva(jsonb, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_reorder_sevas(uuid[], uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_reorder_sevas(uuid[], uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_update_settings(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_update_settings(jsonb, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_mask_vpa(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_mask_vpa(text) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_note_counter_upi(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_note_counter_upi(text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_save_denominations(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_save_denominations(jsonb, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_save_festival(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_save_festival(jsonb, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_add_counter(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_add_counter(text, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_update_counter(smallint, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_update_counter(smallint, jsonb, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_staff_onboard(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_staff_onboard(jsonb, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_staff_update(uuid, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_staff_update(uuid, jsonb, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_mark_signed_in(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_mark_signed_in(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_purge_devotee_profiles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_purge_devotee_profiles() TO service_role;
REVOKE EXECUTE ON FUNCTION seva_report_totals(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_report_totals(timestamptz, timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_continuity(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_continuity(date, date) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_dashboard(timestamptz, timestamptz, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_dashboard(timestamptz, timestamptz, timestamptz, timestamptz, text) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_needs_attention(timestamptz, timestamptz, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_needs_attention(timestamptz, timestamptz, date) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_seva_summary(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_seva_summary(date, date) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_report_festival_part(date[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_report_festival_part(date[]) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_festival_report(uuid, smallint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_festival_report(uuid, smallint) TO service_role;
