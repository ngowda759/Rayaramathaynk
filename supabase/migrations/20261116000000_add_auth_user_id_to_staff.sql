-- Migration: Add auth_user_id to public.staff for Supabase Authentication identity unification.
--
-- Phase 2 Identity Unification:
-- Additive and non-destructive: no table, column or row is dropped or rewritten.
-- `auth_user_id` is the Supabase Auth user id (auth.users.id) that owns this staff row.
-- It is nullable and unique.
--
-- Compatibility & Safety Guarantees:
-- 1. `firebase_uid` remains NOT NULL, UNIQUE, and protected by `seva_staff_guard`.
-- 2. No existing `firebase_uid` values are modified or removed.
-- 3. `seva_staff_guard` remains active and untouched; it continues enforcing
--    immutability of `id`, `staff_no`, and `firebase_uid`.
-- 4. The new `auth_user_id` column can be populated without triggering the
--    immutability check in `seva_staff_guard` because the trigger specifically checks:
--    `NEW.firebase_uid IS DISTINCT FROM OLD.firebase_uid`.
-- 5. Deliberately NO foreign key to auth.users: a cross-schema FK makes
--    `prisma migrate diff` abort with P4002. Referential integrity is maintained
--    at the application guard layer.
-- 6. No changes to RLS policies, grants, triggers, or F-A16 security definitions.

ALTER TABLE public.staff
    ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;
