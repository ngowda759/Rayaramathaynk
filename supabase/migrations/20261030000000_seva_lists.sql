-- Seva Entry - the gotra, nakshatra and rashi lists temple admins keep up to date (plan A4P-5; owner's card `lists`,
-- 2026-10-19). Until now the lists lived only in code (lib/seva/domain/*); this table holds them, seeded with the same
-- ids, so a temple admin can:
--   * add a gotra (ids from 1000 up, so they never meet the built-in 0-56) and correct its English or Kannada name;
--   * hide a gotra, never delete it - receipts and devotee profiles keep gotra_id;
--   * correct the Kannada spelling of a nakshatra (27) or rashi (12); their English names and ids are fixed.
-- Every change is audited as settings.list_item with before and after. Saving a Kannada name marks it checked
-- (kn_checked), for the temple's proof-reading of the Kannada names (O-03); the seed starts every name unchecked.
--
-- Rules (DB 7.0): additive and idempotent, Postgres 15 only. RLS on with no policies and no grants for anon or
-- authenticated: only server code using the service role reads or writes. The service role gets SELECT, INSERT and
-- UPDATE only - no DELETE or TRUNCATE (nothing is ever deleted), and no TRIGGER or REFERENCES, as
-- 20261029235900_seva_privilege_hardening.sql does for the guarded tables. Functions: plpgsql, SECURITY INVOKER,
-- search_path pinned, EXECUTE for service_role only. Which role may call them (settings.edit) is checked by the route.

-- =====================================================================================================
-- 1. Table
-- =====================================================================================================

CREATE TABLE IF NOT EXISTS seva_list_items (
  kind text NOT NULL CHECK (kind IN ('gotra', 'nakshatra', 'rashi')),
  item_id smallint NOT NULL,
  name_en text NOT NULL CHECK (char_length(btrim(name_en)) BETWEEN 1 AND 60),
  name_kn text CHECK (name_kn IS NULL OR char_length(btrim(name_kn)) BETWEEN 1 AND 60),
  kn_checked boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES staff (id) ON DELETE RESTRICT,
  CONSTRAINT seva_list_items_pkey PRIMARY KEY (kind, item_id),
  -- The ids the receipts tables accept (seva_orders / seva_devotee_profiles checks).
  CONSTRAINT seva_list_items_id_range CHECK (
    (kind = 'gotra' AND item_id >= 0)
    OR (kind = 'nakshatra' AND item_id BETWEEN 1 AND 27)
    OR (kind = 'rashi' AND item_id BETWEEN 1 AND 12)
  ),
  -- Only gotras can be hidden.
  CONSTRAINT seva_list_items_only_gotras_hide CHECK (kind = 'gotra' OR active)
);

-- One English name per list, whatever its case (the save function gives the friendly error; this is the backstop).
CREATE UNIQUE INDEX IF NOT EXISTS seva_list_items_name_key ON seva_list_items (kind, lower(name_en));

CREATE OR REPLACE TRIGGER update_seva_list_items_updated_at
  BEFORE UPDATE ON seva_list_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Guard (security review A4P, L-1): even a direct service-role UPDATE, which skips seva_list_item_save and its audit,
-- can never move a row to another list or id, nor change a nakshatra's or rashi's English name or hide it. Their
-- Kannada spelling and the checked mark stay editable; a gotra's names and its active flag stay editable.
CREATE OR REPLACE FUNCTION seva_list_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.kind IS DISTINCT FROM OLD.kind OR NEW.item_id IS DISTINCT FROM OLD.item_id THEN
    RAISE EXCEPTION 'seva guard: a list item''s kind and id never change; add a new gotra instead'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.kind <> 'gotra'
     AND (NEW.name_en IS DISTINCT FROM OLD.name_en OR NEW.active IS DISTINCT FROM OLD.active) THEN
    RAISE EXCEPTION 'seva guard: the English name and the active flag of a % are fixed', OLD.kind
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER seva_list_items_guard
  BEFORE UPDATE ON seva_list_items
  FOR EACH ROW EXECUTE FUNCTION seva_list_items_guard();

-- =====================================================================================================
-- 2. Seed: the built-in lists of lib/seva/domain/{gotras,nakshatras,rashis}.ts with the same ids. A row already there
--    is left alone, so running this again never undoes a temple admin's change.
-- =====================================================================================================

INSERT INTO seva_list_items (kind, item_id, name_en, name_kn, display_order) VALUES
  ('gotra', 0, 'Not known', 'ಗೊತ್ತಿಲ್ಲ', 0),
  ('gotra', 1, 'Kashyapa', 'ಕಾಶ್ಯಪ', 1),
  ('gotra', 2, 'Bharadwaja', 'ಭಾರದ್ವಾಜ', 2),
  ('gotra', 3, 'Vasishtha', 'ವಸಿಷ್ಠ', 3),
  ('gotra', 4, 'Vishvamitra', 'ವಿಶ್ವಾಮಿತ್ರ', 4),
  ('gotra', 5, 'Gautama', 'ಗೌತಮ', 5),
  ('gotra', 6, 'Atri', 'ಆತ್ರೇಯ', 6),
  ('gotra', 7, 'Jamadagni', 'ಜಮದಗ್ನಿ', 7),
  ('gotra', 8, 'Agastya', 'ಅಗಸ್ತ್ಯ', 8),
  ('gotra', 9, 'Angirasa', 'ಆಂಗೀರಸ', 9),
  ('gotra', 10, 'Bhargava', 'ಭಾರ್ಗವ', 10),
  ('gotra', 11, 'Kaundinya', 'ಕೌಂಡಿನ್ಯ', 11),
  ('gotra', 12, 'Shandilya', 'ಶಾಂಡಿಲ್ಯ', 12),
  ('gotra', 13, 'Vatsa', 'ವತ್ಸ', 13),
  ('gotra', 14, 'Harita', 'ಹಾರೀತ', 14),
  ('gotra', 15, 'Kaushika', 'ಕೌಶಿಕ', 15),
  ('gotra', 16, 'Gargya', 'ಗಾರ್ಗ್ಯ', 16),
  ('gotra', 17, 'Maudgalya', 'ಮೌದ್ಗಲ್ಯ', 17),
  ('gotra', 18, 'Chyavana', 'ಚ್ಯವನ', 18),
  ('gotra', 19, 'Aurva', 'ಔರ್ವ', 19),
  ('gotra', 20, 'Shaunaka', 'ಶೌನಕ', 20),
  ('gotra', 21, 'Parashara', 'ಪರಾಶರ', 21),
  ('gotra', 22, 'Upamanyu', 'ಔಪಮನ್ಯವ', 22),
  ('gotra', 23, 'Kanva', 'ಕಾಣ್ವ', 23),
  ('gotra', 24, 'Kautsa', 'ಕೌತ್ಸ', 24),
  ('gotra', 25, 'Shaktya', 'ಶಾಕ್ತ್ಯ', 25),
  ('gotra', 26, 'Sankritya', 'ಸಾಂಕೃತ್ಯ', 26),
  ('gotra', 27, 'Ambarisha', 'ಅಂಬರೀಷ', 27),
  ('gotra', 28, 'Mandhatri', 'ಮಾಂಧಾತೃ', 28),
  ('gotra', 29, 'Kakshivata', 'ಕಾಕ್ಷೀವತ', 29),
  ('gotra', 30, 'Dairghatamasa', 'ದೈರ್ಘತಮಸ', 30),
  ('gotra', 31, 'Aushanasa', 'ಔಶನಸ', 31),
  ('gotra', 32, 'Brihaspati', 'ಬಾರ್ಹಸ್ಪತ್ಯ', 32),
  ('gotra', 33, 'Avatsara', 'ಆವತ್ಸಾರ', 33),
  ('gotra', 34, 'Asita', 'ಆಸಿತ', 34),
  ('gotra', 35, 'Daivala', 'ದೈವಲ', 35),
  ('gotra', 36, 'Daivarata', 'ದೈವರಾತ', 36),
  ('gotra', 37, 'Madhuchchhandasa', 'ಮಾಧುಚ್ಛಂದಸ', 37),
  ('gotra', 38, 'Gathina', 'ಗಾಥಿನ', 38),
  ('gotra', 39, 'Aindra', 'ಐಂದ್ರ', 39),
  ('gotra', 40, 'Maitravaruna', 'ಮೈತ್ರಾವರುಣ', 40),
  ('gotra', 41, 'Daivodasa', 'ದೈವೋದಾಸ', 41),
  ('gotra', 42, 'Vainya', 'ವೈನ್ಯ', 42),
  ('gotra', 43, 'Parthya', 'ಪಾರ್ಥ', 43),
  ('gotra', 44, 'Gartsamada', 'ಗಾರ್ತ್ಸಮದ', 44),
  ('gotra', 45, 'Markandeya', 'ಮಾರ್ಕಂಡೇಯ', 45),
  ('gotra', 46, 'Vishnuvriddha', 'ವಿಷ್ಣುವೃದ್ಧ', 46),
  ('gotra', 47, 'Vadhryashva', 'ವಾಧ್ರ್ಯಶ್ವ', 47),
  ('gotra', 48, 'Lohitaksha', 'ಲೋಹಿತಾಕ್ಷ', 48),
  ('gotra', 49, 'Kevala Angirasa', 'ಕೇವಲ ಆಂಗೀರಸ', 49),
  ('gotra', 50, 'Kevala Bhargava', 'ಕೇವಲ ಭಾರ್ಗವ', 50),
  ('gotra', 51, 'Naidhruva', 'ನೈಧ್ರುವ', 51),
  ('gotra', 52, 'Gavishthira', 'ಗವಿಷ್ಠಿರ', 52),
  ('gotra', 53, 'Yuvanashva', 'ಯುವನಾಶ್ವ', 53),
  ('gotra', 54, 'Sankhyayana', 'ಶಾಂಖ್ಯಾಯನ', 54),
  ('gotra', 55, 'Kapi', 'ಕಪಿ', 55),
  ('gotra', 56, 'Dhananjaya', 'ಧನಂಜಯ', 56),
  ('nakshatra', 1, 'Ashwini', 'ಅಶ್ವಿನಿ', 1),
  ('nakshatra', 2, 'Bharani', 'ಭರಣಿ', 2),
  ('nakshatra', 3, 'Krittika', 'ಕೃತ್ತಿಕಾ', 3),
  ('nakshatra', 4, 'Rohini', 'ರೋಹಿಣಿ', 4),
  ('nakshatra', 5, 'Mrigashira', 'ಮೃಗಶಿರ', 5),
  ('nakshatra', 6, 'Ardra', 'ಆರ್ದ್ರಾ', 6),
  ('nakshatra', 7, 'Punarvasu', 'ಪುನರ್ವಸು', 7),
  ('nakshatra', 8, 'Pushya', 'ಪುಷ್ಯ', 8),
  ('nakshatra', 9, 'Ashlesha', 'ಆಶ್ಲೇಷಾ', 9),
  ('nakshatra', 10, 'Magha', 'ಮಘಾ', 10),
  ('nakshatra', 11, 'Purva Phalguni', 'ಪೂರ್ವಫಲ್ಗುಣಿ', 11),
  ('nakshatra', 12, 'Uttara Phalguni', 'ಉತ್ತರಫಲ್ಗುಣಿ', 12),
  ('nakshatra', 13, 'Hasta', 'ಹಸ್ತ', 13),
  ('nakshatra', 14, 'Chitra', 'ಚಿತ್ರಾ', 14),
  ('nakshatra', 15, 'Swati', 'ಸ್ವಾತಿ', 15),
  ('nakshatra', 16, 'Vishakha', 'ವಿಶಾಖ', 16),
  ('nakshatra', 17, 'Anuradha', 'ಅನುರಾಧ', 17),
  ('nakshatra', 18, 'Jyeshtha', 'ಜ್ಯೇಷ್ಠ', 18),
  ('nakshatra', 19, 'Mula', 'ಮೂಲ', 19),
  ('nakshatra', 20, 'Purvashadha', 'ಪೂರ್ವಾಷಾಢ', 20),
  ('nakshatra', 21, 'Uttarashadha', 'ಉತ್ತರಾಷಾಢ', 21),
  ('nakshatra', 22, 'Shravana', 'ಶ್ರವಣ', 22),
  ('nakshatra', 23, 'Dhanishtha', 'ಧನಿಷ್ಠ', 23),
  ('nakshatra', 24, 'Shatabhisha', 'ಶತಭಿಷ', 24),
  ('nakshatra', 25, 'Purva Bhadrapada', 'ಪೂರ್ವಾಭಾದ್ರ', 25),
  ('nakshatra', 26, 'Uttara Bhadrapada', 'ಉತ್ತರಾಭಾದ್ರ', 26),
  ('nakshatra', 27, 'Revati', 'ರೇವತಿ', 27),
  ('rashi', 1, 'Mesha', 'ಮೇಷ', 1),
  ('rashi', 2, 'Vrishabha', 'ವೃಷಭ', 2),
  ('rashi', 3, 'Mithuna', 'ಮಿಥುನ', 3),
  ('rashi', 4, 'Karkataka', 'ಕರ್ಕಾಟಕ', 4),
  ('rashi', 5, 'Simha', 'ಸಿಂಹ', 5),
  ('rashi', 6, 'Kanya', 'ಕನ್ಯಾ', 6),
  ('rashi', 7, 'Tula', 'ತುಲಾ', 7),
  ('rashi', 8, 'Vrishchika', 'ವೃಶ್ಚಿಕ', 8),
  ('rashi', 9, 'Dhanu', 'ಧನು', 9),
  ('rashi', 10, 'Makara', 'ಮಕರ', 10),
  ('rashi', 11, 'Kumbha', 'ಕುಂಭ', 11),
  ('rashi', 12, 'Meena', 'ಮೀನ', 12)
ON CONFLICT (kind, item_id) DO NOTHING;

-- =====================================================================================================
-- 3. Functions
-- =====================================================================================================

-- Every row of the three lists (hidden gotras included) as a JSON array, ordered by kind, display order and id.
CREATE OR REPLACE FUNCTION seva_list_items_get()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN coalesce(
    (SELECT jsonb_agg(to_jsonb(i) - ARRAY['updated_at', 'updated_by'] ORDER BY i.kind, i.display_order, i.item_id)
       FROM seva_list_items i),
    '[]'::jsonb);
END;
$$;

-- Adds or changes one list item, { kind, item_id?, name_en?, name_kn?, active? }, and returns the saved row.
--   * No item_id: a new gotra (only gotras can be added), id = the highest gotra id + 1, from 1000 up; name_en needed.
--   * A nakshatra or rashi: only name_kn may be given (SEVA:validation otherwise).
--   * A gotra's English name must not match another gotra's in any case, hidden ones included.
--   * Saving name_kn marks it checked, even when the spelling is unchanged (that is how an admin confirms it).
-- Audits settings.list_item on entity 'seva_list_items', entity id '<kind>:<item_id>', with what changed.
-- Requires an active actor. There is no delete.
CREATE OR REPLACE FUNCTION seva_list_item_save(p_item jsonb, p_staff_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kind text;
  v_id integer;
  v_is_new boolean;
  v_old seva_list_items%ROWTYPE;
  v_new seva_list_items%ROWTYPE;
  v_diff jsonb;
BEGIN
  PERFORM seva_admin_require_actor(p_staff_id);
  PERFORM seva_admin_check_keys(p_item, ARRAY['kind', 'item_id', 'name_en', 'name_kn', 'active']);

  v_kind := CASE WHEN jsonb_typeof(p_item -> 'kind') = 'string' THEN p_item ->> 'kind' END;
  IF v_kind IS NULL OR v_kind NOT IN ('gotra', 'nakshatra', 'rashi') THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'kind')::text;
  END IF;
  -- Nakshatra and rashi names and ids are fixed: only the Kannada spelling can be corrected.
  IF v_kind <> 'gotra' AND (p_item ? 'name_en' OR p_item ? 'active') THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', CASE WHEN p_item ? 'name_en' THEN 'name_en' ELSE 'active' END,
                                        'reason', 'fixed')::text;
  END IF;
  IF p_item ? 'name_en' AND jsonb_typeof(p_item -> 'name_en') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'name_en')::text;
  END IF;
  IF p_item ? 'name_kn' AND jsonb_typeof(p_item -> 'name_kn') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'name_kn')::text;
  END IF;
  IF p_item ? 'active' AND jsonb_typeof(p_item -> 'active') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'active')::text;
  END IF;
  IF p_item ? 'item_id' AND jsonb_typeof(p_item -> 'item_id') <> 'null' THEN
    IF jsonb_typeof(p_item -> 'item_id') <> 'number' THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'item_id')::text;
    END IF;
    BEGIN
      v_id := (p_item ->> 'item_id')::integer;
    EXCEPTION WHEN data_exception THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'item_id')::text;
    END;
  END IF;
  v_is_new := v_id IS NULL;
  IF v_is_new AND v_kind <> 'gotra' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'item_id', 'reason', 'required')::text;
  END IF;

  -- One writer at a time, so the next gotra id and the duplicate-name check stay true until commit.
  LOCK TABLE seva_list_items IN SHARE ROW EXCLUSIVE MODE;

  IF v_is_new THEN
    SELECT greatest(999, coalesce(max(i.item_id), 0)) + 1, coalesce(max(i.display_order), 0) + 1
      INTO v_id, v_new.display_order
      FROM seva_list_items i
     WHERE i.kind = 'gotra';
    IF v_id > 32767 THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'item_id', 'reason', 'limit')::text;
    END IF;
    v_new.kind := 'gotra';
    v_new.item_id := v_id::smallint;
    v_new.name_en := btrim(p_item ->> 'name_en');
    v_new.name_kn := CASE WHEN p_item ? 'name_kn' THEN btrim(p_item ->> 'name_kn') END;
    v_new.kn_checked := p_item ? 'name_kn';
    v_new.active := coalesce((p_item ->> 'active')::boolean, true);
  ELSE
    SELECT * INTO v_old FROM seva_list_items i WHERE i.kind = v_kind AND i.item_id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SEVA:not_found' USING DETAIL = jsonb_build_object('entity', 'list_item')::text;
    END IF;
    IF NOT (p_item ? 'name_en' OR p_item ? 'name_kn' OR p_item ? 'active') THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'item', 'reason', 'empty')::text;
    END IF;
    v_new := v_old;
    IF p_item ? 'name_en' THEN
      v_new.name_en := btrim(p_item ->> 'name_en');
    END IF;
    IF p_item ? 'name_kn' THEN
      v_new.name_kn := btrim(p_item ->> 'name_kn');
      v_new.kn_checked := true;
    END IF;
    IF p_item ? 'active' THEN
      v_new.active := (p_item ->> 'active')::boolean;
    END IF;
  END IF;

  IF v_new.name_en IS NULL OR v_new.name_en = '' OR char_length(v_new.name_en) > 60 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'name_en')::text;
  END IF;
  IF p_item ? 'name_kn' AND (v_new.name_kn = '' OR char_length(v_new.name_kn) > 60) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'name_kn')::text;
  END IF;
  IF v_kind = 'gotra' AND EXISTS (
    SELECT 1
      FROM seva_list_items i
     WHERE i.kind = 'gotra' AND i.item_id <> v_new.item_id AND lower(i.name_en) = lower(v_new.name_en)
  ) THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'name_en', 'reason', 'duplicate')::text;
  END IF;

  IF v_is_new THEN
    INSERT INTO seva_list_items (kind, item_id, name_en, name_kn, kn_checked, active, display_order, updated_by)
    VALUES (v_new.kind, v_new.item_id, v_new.name_en, v_new.name_kn, v_new.kn_checked, v_new.active,
            v_new.display_order, p_staff_id)
    RETURNING * INTO v_new;
    PERFORM seva_audit('settings.list_item', 'seva_list_items', v_new.kind || ':' || v_new.item_id, NULL, NULL, NULL,
                       to_jsonb(v_new) - ARRAY['updated_at', 'updated_by'], p_staff_id);
  ELSE
    v_diff := seva_admin_diff(to_jsonb(v_old), to_jsonb(v_new), ARRAY['name_en', 'name_kn', 'kn_checked', 'active']);
    IF v_diff -> 'after' = '{}'::jsonb THEN
      RETURN to_jsonb(v_old) - ARRAY['updated_at', 'updated_by'];
    END IF;
    UPDATE seva_list_items i
       SET name_en = v_new.name_en,
           name_kn = v_new.name_kn,
           kn_checked = v_new.kn_checked,
           active = v_new.active,
           updated_by = p_staff_id
     WHERE i.kind = v_old.kind AND i.item_id = v_old.item_id
    RETURNING * INTO v_new;
    PERFORM seva_audit('settings.list_item', 'seva_list_items', v_new.kind || ':' || v_new.item_id, NULL, NULL,
                       v_diff -> 'before', v_diff -> 'after', p_staff_id);
  END IF;

  RETURN to_jsonb(v_new) - ARRAY['updated_at', 'updated_by'];
END;
$$;

-- =====================================================================================================
-- 4. Privileges
-- =====================================================================================================

ALTER TABLE seva_list_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE seva_list_items FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE seva_list_items TO service_role;
-- No TRIGGER: a trigger of the service role's own could otherwise change NEW after seva_list_items_guard checked it.
REVOKE TRIGGER, REFERENCES ON TABLE seva_list_items FROM service_role, anon, authenticated;

REVOKE EXECUTE ON FUNCTION seva_list_items_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_list_items_guard() TO service_role;

REVOKE EXECUTE ON FUNCTION seva_list_items_get() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_list_items_get() TO service_role;
REVOKE EXECUTE ON FUNCTION seva_list_item_save(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_list_item_save(jsonb, uuid) TO service_role;
