-- Backfill `staff.auth_user_id` from `staff.firebase_uid` so every staff row is linked to its Supabase Auth
-- identity. This is the data step that lets the application stop reading `staff.firebase_uid` entirely.
--
-- Background: the `firebase_uid` column predates the Supabase migration but, on this project, already holds the
-- Supabase Auth UUID (it was carried over from `auth.users.id`). Verified against production on 2026-11-16:
-- two staff rows, both with a UUID-valued `firebase_uid`; the one row that lacked `auth_user_id` (staff_no 2,
-- status 'invited', never signed in) had `firebase_uid` equal to its `users.auth_user_id`.
--
-- Safety:
--   * additive and idempotent - only fills rows where `auth_user_id IS NULL`, and only from a UUID-shaped value,
--     so a second run changes nothing and a legacy non-UUID Firebase id is left alone (never linked to nothing);
--   * does not touch `firebase_uid`, `staff_no` or `status`, so `seva_staff_guard` (which forbids changing the
--     staff login key and staff number) is satisfied;
--   * `auth_user_id` is UNIQUE, and `firebase_uid` is UNIQUE, so the source values cannot collide.
UPDATE public.staff
   SET auth_user_id = firebase_uid
 WHERE auth_user_id IS NULL
   AND firebase_uid ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
