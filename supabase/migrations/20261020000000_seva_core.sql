-- Seva Entry, Phase 1 - core tables, catalogue columns on `sevas`, base helper functions and guard triggers.
-- Spec: docs/seva/DESIGN-BOOK.md section 7 (7.0 conventions, 7.1 catalogue, 7.2 people/counters/settings,
-- 7.3 numbering, 7.6 audit and operations).
--
-- Rules for this file (DB 7.0):
--   * Additive and idempotent: IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS then CREATE POLICY.
--     Nothing existing is dropped, renamed or retyped. Safe to run twice.
--   * Must run on Postgres 15 (the live Supabase project).
--   * Every table: RLS on, a deny-all policy, no grants for anon/authenticated. Only server code using the
--     service role (which bypasses RLS) reads or writes these tables.
--   * Every function: plpgsql, SECURITY INVOKER, search_path pinned, EXECUTE for service_role only.
--   * Business errors are raised as 'SEVA:<code>' (codes in lib/seva/errors.ts) with JSON in DETAIL.
--     Guard triggers raise 'seva guard: ...' (a programming error, never a user mistake).

-- =====================================================================================================
-- 1. Guard trigger functions used by this file (and by 20261020000100_seva_receipts.sql)
-- =====================================================================================================

-- Raises on any UPDATE, DELETE or TRUNCATE it is attached to: for history tables whose rows never change.
CREATE OR REPLACE FUNCTION seva_forbid_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'seva guard: % on % is not allowed', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation',
          HINT = 'Rows in this table are kept for the audit trail and never change.';
END;
$$;

-- Staff rows are never deleted (status 'deleted' keeps the row) and a staff number never changes (DB 3.4, 7.2).
-- The login a staff number belongs to (firebase_uid) never changes either, and 'deleted' is final: delete removes
-- the login for good, so the row (and the receipts that point at it) can never be handed to another identity.
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
  IF NEW.firebase_uid IS DISTINCT FROM OLD.firebase_uid THEN
    RAISE EXCEPTION 'seva guard: a staff login (firebase_uid) never changes; invite a new staff member instead'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.status = 'deleted' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'seva guard: a deleted staff member stays deleted; invite a new staff member instead'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================================================================
-- 2. People, counters and settings (DB 7.2)
-- =====================================================================================================

-- The role is NOT stored here: Firestore users/{uid}.role is the single source (DB 3.2).
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text NOT NULL UNIQUE CHECK (btrim(firebase_uid) <> ''),
  staff_no smallint NOT NULL UNIQUE CHECK (staff_no BETWEEN 1 AND 999),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 80 AND btrim(full_name) <> ''),
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND btrim(email) <> ''),
  view_only boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'inactive', 'deleted')),
  status_reason text,
  status_changed_at timestamptz,
  status_changed_by_staff_id uuid REFERENCES staff (id) ON DELETE RESTRICT,
  invited_by_staff_id uuid REFERENCES staff (id) ON DELETE RESTRICT,
  invited_at timestamptz,
  first_signed_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_status_reason_required
    CHECK (status NOT IN ('inactive', 'deleted') OR coalesce(btrim(status_reason), '') <> '')
);

CREATE OR REPLACE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER seva_staff_guard
  BEFORE UPDATE OR DELETE ON staff
  FOR EACH ROW EXECUTE FUNCTION seva_staff_guard();

CREATE OR REPLACE TRIGGER seva_staff_no_truncate
  BEFORE TRUNCATE ON staff
  FOR EACH STATEMENT EXECUTE FUNCTION seva_forbid_change();

CREATE TABLE IF NOT EXISTS counters (
  id smallint PRIMARY KEY CHECK (id BETWEEN 1 AND 99),
  name text NOT NULL CHECK (btrim(name) <> ''),
  place text,
  opening_float numeric(10,2) NOT NULL DEFAULT 0 CHECK (opening_float >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER update_counters_updated_at
  BEFORE UPDATE ON counters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- A registered counter PC. Only the SHA-256 hex of its 32-byte secret is stored (DB 8.4).
CREATE TABLE IF NOT EXISTS counter_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counter_id smallint NOT NULL REFERENCES counters (id) ON DELETE RESTRICT,
  secret_hash text NOT NULL CHECK (secret_hash ~ '^[0-9a-f]{64}$'),
  label text,
  registered_at timestamptz NOT NULL DEFAULT now(),
  registered_by_staff_id uuid NOT NULL REFERENCES staff (id) ON DELETE RESTRICT,
  retired_at timestamptz,
  retired_by_staff_id uuid REFERENCES staff (id) ON DELETE RESTRICT,
  retired_reason text,
  last_seen_at timestamptz,
  last_outbox_count integer NOT NULL DEFAULT 0 CHECK (last_outbox_count >= 0),
  last_clock_skew_ms integer,
  app_version text,
  -- Set by "Replace this PC" (DB 8.3, 8.4): the offline group label NNN ('G-YYMM-OF<n>-NNN') of IST month YYMM that
  -- this PC must start after, so it never repeats a label the PC it replaced printed but never sent.
  of_group_floor_yymm char(4) CHECK (of_group_floor_yymm ~ '^[0-9]{2}(0[1-9]|1[0-2])$'),
  of_group_floor_no integer CHECK (of_group_floor_no >= 0),
  CONSTRAINT counter_devices_retired_reason_required
    CHECK (retired_at IS NULL OR coalesce(btrim(retired_reason), '') <> ''),
  CONSTRAINT counter_devices_group_floor_pair
    CHECK ((of_group_floor_yymm IS NULL) = (of_group_floor_no IS NULL))
);

-- One live PC per counter.
CREATE UNIQUE INDEX IF NOT EXISTS counter_devices_one_live_per_counter
  ON counter_devices (counter_id) WHERE retired_at IS NULL;

-- One row (id = 1). Temple texts are seeded as 'SAMPLE - ...' until the office sends the real ones (D29).
CREATE TABLE IF NOT EXISTS seva_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  temple_name_en text NOT NULL,
  temple_name_kn text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text NOT NULL,
  registration_line text,
  photo_left_url text,
  photo_right_url text,
  footer_line1 text NOT NULL,
  footer_line2 text NOT NULL,
  footer_blessing text NOT NULL,
  print_gotra boolean NOT NULL DEFAULT true,
  print_nakshatra boolean NOT NULL DEFAULT true,
  print_rashi boolean NOT NULL DEFAULT false,
  cancel_window_minutes smallint NOT NULL DEFAULT 30 CHECK (cancel_window_minutes BETWEEN 0 AND 240),
  cash_difference_note_required boolean NOT NULL DEFAULT true,
  amount_change_reason_required boolean NOT NULL DEFAULT true,
  counter_days_ahead smallint NOT NULL DEFAULT 365 CHECK (counter_days_ahead >= 0),
  online_days_ahead smallint NOT NULL DEFAULT 90 CHECK (online_days_ahead >= 0),
  online_same_day_cutoff time NOT NULL DEFAULT '12:00',
  prasadam_undo_seconds smallint NOT NULL DEFAULT 120 CHECK (prasadam_undo_seconds >= 0),
  day_close_flag_threshold numeric(10,2) NOT NULL DEFAULT 0 CHECK (day_close_flag_threshold >= 0),
  tally_cash_ledger text NOT NULL DEFAULT 'Cash',
  tally_upi_ledger text NOT NULL DEFAULT 'Bank - UPI',
  tally_online_ledger text NOT NULL DEFAULT 'Gateway clearing',
  tally_columns jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_staff_id uuid REFERENCES staff (id) ON DELETE RESTRICT
);

CREATE OR REPLACE TRIGGER update_seva_settings_updated_at
  BEFORE UPDATE ON seva_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS cash_denominations (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('note', 'coin')),
  value numeric(8,2) NOT NULL CHECK (value > 0 AND value <= 2000),
  display_order smallint NOT NULL,
  shown boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cash_denominations_kind_value_key UNIQUE (kind, value)
);

CREATE OR REPLACE TRIGGER update_cash_denominations_updated_at
  BEFORE UPDATE ON cash_denominations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS festival_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL CHECK (btrim(name_en) <> ''),
  name_kn text,
  active boolean NOT NULL DEFAULT true,
  updated_by_staff_id uuid REFERENCES staff (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER update_festival_days_updated_at
  BEFORE UPDATE ON festival_days
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS festival_day_dates (
  festival_id uuid NOT NULL REFERENCES festival_days (id) ON DELETE CASCADE,
  day date NOT NULL,
  PRIMARY KEY (festival_id, day)
);

CREATE INDEX IF NOT EXISTS idx_festival_day_dates_day ON festival_day_dates (day);

-- =====================================================================================================
-- 3. Numbering (DB 7.3, section 8)
-- =====================================================================================================

-- C<n>/OF<n> belong to counter n; W is the online series, WT the gateway test series.
CREATE TABLE IF NOT EXISTS receipt_series (
  code text PRIMARY KEY CHECK (code ~ '^(C[0-9]{1,2}|OF[0-9]{1,2}|W|WT)$'),
  kind text NOT NULL CHECK (kind IN ('counter_online', 'counter_offline', 'online', 'online_test')),
  counter_id smallint REFERENCES counters (id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receipt_series_counter_matches_kind
    CHECK ((kind LIKE 'counter%') = (counter_id IS NOT NULL)),
  CONSTRAINT receipt_series_code_matches_kind
    CHECK (
      (kind = 'counter_online' AND code = 'C' || counter_id::text)
      OR (kind = 'counter_offline' AND code = 'OF' || counter_id::text)
      OR (kind = 'online' AND code = 'W')
      OR (kind = 'online_test' AND code = 'WT')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS receipt_series_one_per_counter_kind
  ON receipt_series (counter_id, kind) WHERE counter_id IS NOT NULL;

-- One row per series per IST calendar year; the row lock on UPDATE serialises allocation (gap-free).
CREATE TABLE IF NOT EXISTS receipt_series_years (
  series_code text NOT NULL REFERENCES receipt_series (code) ON DELETE RESTRICT,
  year smallint NOT NULL CHECK (year BETWEEN 2026 AND 2100),
  last_no integer NOT NULL DEFAULT 0 CHECK (last_no BETWEEN 0 AND 999999),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (series_code, year)
);

CREATE OR REPLACE TRIGGER update_receipt_series_years_updated_at
  BEFORE UPDATE ON receipt_series_years
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- The only way a number can go missing is lost offline data; such a range is recorded here, never hidden.
-- 'received_late' marks a gap closed by a late sync.
CREATE TABLE IF NOT EXISTS receipt_number_gaps (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  series_code text NOT NULL,
  year smallint NOT NULL,
  from_no integer NOT NULL CHECK (from_no BETWEEN 1 AND 999999),
  to_no integer NOT NULL CHECK (to_no BETWEEN 1 AND 999999),
  cause text NOT NULL CHECK (cause IN ('device_replaced', 'missing_in_sync')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'entered_from_paper', 'declared_lost', 'received_late')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by_staff_id uuid REFERENCES staff (id) ON DELETE RESTRICT,
  resolution_note text,
  CONSTRAINT receipt_number_gaps_range CHECK (to_no >= from_no),
  CONSTRAINT receipt_number_gaps_note_required
    CHECK (status = 'open' OR coalesce(btrim(resolution_note), '') <> ''),
  CONSTRAINT receipt_number_gaps_series_year_fkey FOREIGN KEY (series_code, year)
    REFERENCES receipt_series_years (series_code, year) ON DELETE RESTRICT
);

-- Group labels G-YYMM-NNNN (C-19); labels, not accounting numbers.
CREATE TABLE IF NOT EXISTS group_counters (
  yymm char(4) PRIMARY KEY CHECK (yymm ~ '^[0-9]{2}(0[1-9]|1[0-2])$'),
  last_no integer NOT NULL DEFAULT 0 CHECK (last_no >= 0)
);

-- =====================================================================================================
-- 4. Catalogue: new columns on the existing `sevas` table, and its rate history (DB 7.1)
-- =====================================================================================================

ALTER TABLE sevas ADD COLUMN IF NOT EXISTS code text
  CONSTRAINT sevas_code_format CHECK (code ~ '^[A-Z]{2,3}$');
ALTER TABLE sevas ADD COLUMN IF NOT EXISTS name_kn text;
ALTER TABLE sevas ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'both'
  CONSTRAINT sevas_visibility_check CHECK (visibility IN ('counter', 'online', 'both'));
ALTER TABLE sevas ADD COLUMN IF NOT EXISTS multi_date boolean NOT NULL DEFAULT false;
ALTER TABLE sevas ADD COLUMN IF NOT EXISTS allow_amount_change boolean NOT NULL DEFAULT true;
ALTER TABLE sevas ADD COLUMN IF NOT EXISTS any_amount boolean NOT NULL DEFAULT false;
ALTER TABLE sevas ADD COLUMN IF NOT EXISTS prasadam_given boolean NOT NULL DEFAULT true;
ALTER TABLE sevas ADD COLUMN IF NOT EXISTS prasadam_items text;
ALTER TABLE sevas ADD COLUMN IF NOT EXISTS income_ledger text;
ALTER TABLE sevas ADD COLUMN IF NOT EXISTS updated_by_staff_id uuid REFERENCES staff (id) ON DELETE RESTRICT;
ALTER TABLE sevas ALTER COLUMN duration SET DEFAULT 0;

-- Any-amount sevas (Other Seva / Karnike) are counter-only (C-38).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'sevas_any_amount_counter_only' AND conrelid = 'public.sevas'::regclass
  ) THEN
    ALTER TABLE sevas
      ADD CONSTRAINT sevas_any_amount_counter_only CHECK (NOT any_amount OR visibility = 'counter');
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS sevas_code_key ON sevas (code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sevas_visibility_active_order ON sevas (visibility, active, display_order);

-- Append-only. old_amount null = seva added.
CREATE TABLE IF NOT EXISTS seva_rate_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seva_id uuid NOT NULL REFERENCES sevas (id) ON DELETE RESTRICT,
  old_amount numeric(10,2),
  new_amount numeric(10,2) NOT NULL,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  changed_by_staff_id uuid REFERENCES staff (id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seva_rate_history_seva_changed ON seva_rate_history (seva_id, changed_at DESC);

CREATE OR REPLACE TRIGGER seva_rate_history_append_only
  BEFORE UPDATE OR DELETE ON seva_rate_history
  FOR EACH ROW EXECUTE FUNCTION seva_forbid_change();

CREATE OR REPLACE TRIGGER seva_rate_history_no_truncate
  BEFORE TRUNCATE ON seva_rate_history
  FOR EACH STATEMENT EXECUTE FUNCTION seva_forbid_change();

-- Writes a rate-history row whenever sevas.amount changes, from any writer. The reason comes from the
-- transaction setting seva.change_reason (set by seva_upsert_seva), else 'changed outside the app', so the
-- existing seed and migrate scripts keep working. seva.change_staff_id (a staff uuid), when set the same way,
-- records who made the change.
CREATE OR REPLACE FUNCTION seva_sevas_rate_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reason text := nullif(btrim(coalesce(current_setting('seva.change_reason', true), '')), '');
  v_staff_text text := nullif(btrim(coalesce(current_setting('seva.change_staff_id', true), '')), '');
  v_staff uuid;
BEGIN
  IF v_staff_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_staff := v_staff_text::uuid;
  END IF;
  INSERT INTO seva_rate_history (seva_id, old_amount, new_amount, reason, changed_by_staff_id)
  VALUES (NEW.id, OLD.amount, NEW.amount, coalesce(v_reason, 'changed outside the app'), v_staff);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER sevas_rate_history
  AFTER UPDATE OF amount ON sevas
  FOR EACH ROW
  WHEN (OLD.amount IS DISTINCT FROM NEW.amount)
  EXECUTE FUNCTION seva_sevas_rate_history();

-- =====================================================================================================
-- 5. Audit and operations (DB 7.6)
-- =====================================================================================================

-- Append-only, even for the service role. No phone numbers inside before/after.
CREATE TABLE IF NOT EXISTS audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor_staff_id uuid REFERENCES staff (id) ON DELETE RESTRICT,
  actor_uid text,
  actor_role text,
  action text NOT NULL CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity text NOT NULL,
  entity_id text,
  receipt_no text,
  reason text,
  before jsonb,
  after jsonb,
  request_id uuid
);

CREATE INDEX IF NOT EXISTS idx_audit_log_at ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_at ON audit_log (action, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_at ON audit_log (actor_staff_id, at DESC);

CREATE OR REPLACE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION seva_forbid_change();

CREATE OR REPLACE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION seva_forbid_change();

-- Written by the nightly backup job; read by Needs attention.
CREATE TABLE IF NOT EXISTS ops_backup_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  ok boolean,
  bytes bigint,
  sha256 text,
  error text
);

-- =====================================================================================================
-- 6. Base helper functions (DB 7.8)
-- =====================================================================================================

-- IST (Asia/Kolkata) year, month and business date of an instant. Never uses the session time zone.
CREATE OR REPLACE FUNCTION seva_ist_parts(p_at timestamptz)
RETURNS TABLE (year smallint, month smallint, business_date date)
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_local timestamp := p_at AT TIME ZONE 'Asia/Kolkata';
BEGIN
  year := date_part('year', v_local)::smallint;
  month := date_part('month', v_local)::smallint;
  business_date := v_local::date;
  RETURN NEXT;
END;
$$;

-- Formats a receipt number (DB 8.1):
--   C<n>/OF<n>: <series>-<staff no. 3 digits>-<MM>-<YYYY>/<running 6 digits>   e.g. C1-023-10-2026/000124
--   W/WT:       <series>-<WEB|APP>-<MM>-<YYYY>/<running 6 digits>              e.g. W-WEB-10-2026/000045
CREATE OR REPLACE FUNCTION seva_receipt_no(
  p_series text,
  p_staff_no smallint,
  p_channel text,
  p_month smallint,
  p_year smallint,
  p_running int
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_middle text;
BEGIN
  IF p_month IS NULL OR p_month NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'month')::text;
  END IF;
  IF p_year IS NULL OR p_year NOT BETWEEN 2026 AND 2100 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'year')::text;
  END IF;
  IF p_running IS NULL OR p_running NOT BETWEEN 1 AND 999999 THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'running_no')::text;
  END IF;

  IF p_series ~ '^(C|OF)[0-9]{1,2}$' THEN
    IF p_staff_no IS NULL OR p_staff_no NOT BETWEEN 1 AND 999 THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'staff_no')::text;
    END IF;
    v_middle := lpad(p_staff_no::text, 3, '0');
  ELSIF p_series IN ('W', 'WT') THEN
    IF p_channel IS NULL OR p_channel NOT IN ('WEB', 'APP') THEN
      RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'channel')::text;
    END IF;
    v_middle := p_channel;
  ELSE
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'series')::text;
  END IF;

  RETURN p_series || '-' || v_middle || '-' || lpad(p_month::text, 2, '0') || '-' || p_year::text
      || '/' || lpad(p_running::text, 6, '0');
END;
$$;

-- Returns p with every key whose lower-cased name contains 'phone' or 'mobile' removed (phone, Phone, PHONE,
-- phone_e164, phoneE164, phoneNumber, devotee_phone, mobile, ...) at every depth: inside objects, arrays, objects in
-- arrays and arrays in objects. Scalars and JSON null come back unchanged; SQL NULL gives NULL. Applied by seva_audit
-- and by the audit_log_strip_phones trigger so no phone number ever reaches the append-only audit trail
-- (DB 7.6, 15.2, C-16).
-- Only keys are matched, never values: callers must never pass a phone number under any other key name or as a plain
-- (array or scalar) value, because it would not be removed.
CREATE OR REPLACE FUNCTION seva_strip_phones(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text := jsonb_typeof(p);
  v_out jsonb;
BEGIN
  IF v_type = 'object' THEN
    SELECT coalesce(jsonb_object_agg(e.key, seva_strip_phones(e.value)), '{}'::jsonb)
      INTO v_out
      FROM jsonb_each(p) AS e(key, value)
     WHERE strpos(lower(e.key), 'phone') = 0
       AND strpos(lower(e.key), 'mobile') = 0;
    RETURN v_out;
  ELSIF v_type = 'array' THEN
    SELECT coalesce(jsonb_agg(seva_strip_phones(a.value) ORDER BY a.ord), '[]'::jsonb)
      INTO v_out
      FROM jsonb_array_elements(p) WITH ORDINALITY AS a(value, ord);
    RETURN v_out;
  END IF;
  RETURN p;
END;
$$;

-- Enforces the phone rule at the table: every row inserted into audit_log, by seva_audit, by service_role directly or
-- by the owner, has phone keys stripped from before and after (DB 7.6, 15.2, C-16).
CREATE OR REPLACE FUNCTION seva_audit_log_strip_phones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.before := seva_strip_phones(NEW.before);
  NEW.after := seva_strip_phones(NEW.after);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER audit_log_strip_phones
  BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION seva_audit_log_strip_phones();

-- Writes one audit row and returns its id. The actor's Firebase uid is looked up from staff. Optional transaction
-- settings seva.actor_role and seva.request_id (a uuid) fill actor_role and request_id when the caller set them.
-- Phone keys are dropped from before/after at every depth by seva_strip_phones (no phone numbers in the audit trail,
-- C-16, DB 7.6 and 15.2).
CREATE OR REPLACE FUNCTION seva_audit(
  p_action text,
  p_entity text,
  p_entity_id text,
  p_receipt_no text,
  p_reason text,
  p_before jsonb,
  p_after jsonb,
  p_staff_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid text;
  v_role text := nullif(btrim(coalesce(current_setting('seva.actor_role', true), '')), '');
  v_request_text text := nullif(btrim(coalesce(current_setting('seva.request_id', true), '')), '');
  v_request uuid;
  v_id bigint;
BEGIN
  IF p_action IS NULL OR p_action !~ '^[a-z_]+\.[a-z_]+$' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'action')::text;
  END IF;
  IF coalesce(btrim(p_entity), '') = '' THEN
    RAISE EXCEPTION 'SEVA:validation' USING DETAIL = jsonb_build_object('field', 'entity')::text;
  END IF;

  IF p_staff_id IS NOT NULL THEN
    SELECT s.firebase_uid INTO v_uid FROM staff s WHERE s.id = p_staff_id;
  END IF;
  IF v_request_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_request := v_request_text::uuid;
  END IF;

  INSERT INTO audit_log (actor_staff_id, actor_uid, actor_role, action, entity, entity_id, receipt_no, reason,
                         before, after, request_id)
  VALUES (
    p_staff_id, v_uid, v_role, p_action, p_entity, p_entity_id, p_receipt_no, p_reason,
    seva_strip_phones(p_before),
    seva_strip_phones(p_after),
    v_request
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Next staff number: max + 1, starting at 1. Numbers are never reused because staff rows are never deleted.
CREATE OR REPLACE FUNCTION seva_next_staff_no()
RETURNS smallint
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next integer;
BEGIN
  SELECT coalesce(max(s.staff_no), 0) + 1 INTO v_next FROM staff s;
  IF v_next > 999 THEN
    RAISE EXCEPTION 'SEVA:validation'
      USING DETAIL = jsonb_build_object('field', 'staff_no', 'reason', 'all staff numbers 001-999 are used')::text;
  END IF;
  RETURN v_next::smallint;
END;
$$;

-- =====================================================================================================
-- 7. Row level security: deny all to the public roles (the service role bypasses RLS)
-- =====================================================================================================

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE counter_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE seva_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_denominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE festival_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE festival_day_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_series_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_number_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE seva_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_backup_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all public access to staff" ON staff;
CREATE POLICY "Deny all public access to staff" ON staff
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to counters" ON counters;
CREATE POLICY "Deny all public access to counters" ON counters
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to counter_devices" ON counter_devices;
CREATE POLICY "Deny all public access to counter_devices" ON counter_devices
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to seva_settings" ON seva_settings;
CREATE POLICY "Deny all public access to seva_settings" ON seva_settings
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to cash_denominations" ON cash_denominations;
CREATE POLICY "Deny all public access to cash_denominations" ON cash_denominations
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to festival_days" ON festival_days;
CREATE POLICY "Deny all public access to festival_days" ON festival_days
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to festival_day_dates" ON festival_day_dates;
CREATE POLICY "Deny all public access to festival_day_dates" ON festival_day_dates
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to receipt_series" ON receipt_series;
CREATE POLICY "Deny all public access to receipt_series" ON receipt_series
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to receipt_series_years" ON receipt_series_years;
CREATE POLICY "Deny all public access to receipt_series_years" ON receipt_series_years
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to receipt_number_gaps" ON receipt_number_gaps;
CREATE POLICY "Deny all public access to receipt_number_gaps" ON receipt_number_gaps
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to group_counters" ON group_counters;
CREATE POLICY "Deny all public access to group_counters" ON group_counters
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to seva_rate_history" ON seva_rate_history;
CREATE POLICY "Deny all public access to seva_rate_history" ON seva_rate_history
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to audit_log" ON audit_log;
CREATE POLICY "Deny all public access to audit_log" ON audit_log
  FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public access to ops_backup_runs" ON ops_backup_runs;
CREATE POLICY "Deny all public access to ops_backup_runs" ON ops_backup_runs
  FOR ALL TO public USING (false) WITH CHECK (false);

REVOKE ALL ON staff FROM anon, authenticated;
REVOKE ALL ON counters FROM anon, authenticated;
REVOKE ALL ON counter_devices FROM anon, authenticated;
REVOKE ALL ON seva_settings FROM anon, authenticated;
REVOKE ALL ON cash_denominations FROM anon, authenticated;
REVOKE ALL ON festival_days FROM anon, authenticated;
REVOKE ALL ON festival_day_dates FROM anon, authenticated;
REVOKE ALL ON receipt_series FROM anon, authenticated;
REVOKE ALL ON receipt_series_years FROM anon, authenticated;
REVOKE ALL ON receipt_number_gaps FROM anon, authenticated;
REVOKE ALL ON group_counters FROM anon, authenticated;
REVOKE ALL ON seva_rate_history FROM anon, authenticated;
REVOKE ALL ON audit_log FROM anon, authenticated;
REVOKE ALL ON ops_backup_runs FROM anon, authenticated;

-- audit_log stays append-only even for the service role (the trigger above also raises for the owner).
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM service_role;

-- Supabase's default privileges also grant the identity sequences to anon and authenticated: take those back.
DO $$
DECLARE
  v_seq text;
BEGIN
  FOREACH v_seq IN ARRAY ARRAY[
    pg_get_serial_sequence('public.cash_denominations', 'id'),
    pg_get_serial_sequence('public.receipt_number_gaps', 'id'),
    pg_get_serial_sequence('public.seva_rate_history', 'id'),
    pg_get_serial_sequence('public.audit_log', 'id'),
    pg_get_serial_sequence('public.ops_backup_runs', 'id')
  ] LOOP
    IF v_seq IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon, authenticated', v_seq);
    END IF;
  END LOOP;
END;
$$;

-- =====================================================================================================
-- 8. Function privileges: service_role only
-- =====================================================================================================

REVOKE EXECUTE ON FUNCTION seva_forbid_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_forbid_change() TO service_role;
REVOKE EXECUTE ON FUNCTION seva_staff_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_staff_guard() TO service_role;
REVOKE EXECUTE ON FUNCTION seva_sevas_rate_history() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_sevas_rate_history() TO service_role;
REVOKE EXECUTE ON FUNCTION seva_ist_parts(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_ist_parts(timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_receipt_no(text, smallint, text, smallint, smallint, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_receipt_no(text, smallint, text, smallint, smallint, int) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_strip_phones(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_strip_phones(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_audit_log_strip_phones() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_audit_log_strip_phones() TO service_role;
REVOKE EXECUTE ON FUNCTION seva_audit(text, text, text, text, text, jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_audit(text, text, text, text, text, jsonb, jsonb, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION seva_next_staff_no() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seva_next_staff_no() TO service_role;
