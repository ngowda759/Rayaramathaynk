# Phase 2 Migration Readiness Review

Based on the authenticated READ-ONLY production Firestore inventory, this document details the readiness review for the active collections designated for Phase 2 migration consideration.

## Methodology
For each collection, we analysed:
1.  **Production Document Count**: Verified from the recent read-only script.
2.  **Code Usage**: Whether the Next.js/mobile app actively reads/writes this collection.
3.  **Destination Model**: If a PostgreSQL table exists in Supabase.
4.  **Schema Match**: Required transformations for timestamps, object structures, etc.
5.  **Classification**: `MIGRATE`, `EXCLUDE`, `SPECIAL MIGRATION`, or `DEFER`.

---

## Detailed Analysis

### 1. `donations`
- **Firestore Count:** 1
- **Code Usage:** Used in `app/admin/donations`, public donation flows, and AI responses. Mapped to `types/donation.ts`.
- **Destination Model:** `donations` (Exists in `supabase/migrations/20261001000000_create_content_tables.sql`)
- **Required Mapper:** Exists in `scripts/migrate-content-to-supabase.ts` via `mapDonation`.
- **Risks:** FK relationships to `campaign_id` might be loose strings instead of UUIDs. The migration script uses idempotency via `firestore_id`.
- **Classification:** `MIGRATE`

### 2. `sevaBookings`
- **Firestore Count:** 8
- **Code Usage:** Used in `app/admin/seva-bookings` and public booking flows. Tracked in `types/seva-booking.ts`.
- **Destination Model:** `seva_bookings` (Exists in `supabase/migrations/20260920000000_create_seva_bookings.sql`)
- **Required Mapper:** Likely needed (script `migrate:seva-bookings` mentioned in `FIRESTORE_MIGRATION.md`).
- **Risks:** Loose references to `userId` (Firebase Auth UID) and `sevaId`. `firestore_id` based idempotency is supported.
- **Classification:** `MIGRATE`

### 3. `announcements`
- **Firestore Count:** 2
- **Code Usage:** Used in public UI (LiveRegion, dashboard) and Admin UI (`/admin/announcements`).
- **Destination Model:** None explicitly defined in migrations (checked `docs/SUPABASE_DATABASE_SCHEMA.md` and `supabase/migrations/`).
- **Classification:** `DEFER` (Missing destination schema).

### 4. `volunteers`
- **Firestore Count:** 3
- **Code Usage:** Used in admin tracking (`app/admin/users/page.tsx`). Note: `volunteer_requests` is already classified as MIGRATE, but `volunteers` is separate.
- **Destination Model:** None explicitly defined in schema.
- **Classification:** `DEFER` (Missing destination schema).

### 5. `members`
- **Firestore Count:** 1
- **Code Usage:** Mentioned in `types/profile.ts` or trust committee logic, but no clear standalone destination table exists outside of settings documents.
- **Destination Model:** None explicitly defined.
- **Classification:** `DEFER` (Missing destination schema).

### 6. `settings`
- **Firestore Count:** 10
- **Code Usage:** Heavily used via `settings.service.ts` for temple information, contact details, social links, and AI context.
- **Destination Model:** Split between `site_settings`, `social_links`, and `settings_documents` (JSONB).
- **Required Mapper:** Handled uniquely by `scripts/migrate-settings.ts` and `mapSettingsDocument`.
- **Risks:** Relies on robust validation logic to separate `site_settings` from other docs without failing. Idempotency is supported via `firestore_id`.
- **Classification:** `SPECIAL MIGRATION`

### 7. `homepage`
- **Firestore Count:** 1
- **Code Usage:** Holds homepage specific configs (e.g., hero banners, layout toggles).
- **Destination Model:** None explicitly defined as a dedicated table.
- **Classification:** `SPECIAL MIGRATION` (Should be routed to `settings_documents` JSONB table using the settings logic, but currently missing from the settings migration script).

### 8. `feedback`
- **Firestore Count:** 2
- **Code Usage:** Used by AI Analytics (`app/admin/ai/analytics`).
- **Destination Model:** None explicitly defined in migrations.
- **Classification:** `DEFER` (Missing destination schema).

### 9. `quotes`
- **Firestore Count:** 35
- **Code Usage:** Very active (`app/admin/quotes/page.tsx`, public `/quotes`, API routes). Seed scripts exist.
- **Destination Model:** None explicitly defined in migrations.
- **Classification:** `DEFER` (Missing destination schema, though highly active).

### 10. `timings`
- **Firestore Count:** 1
- **Code Usage:** Used for Temple Timings logic and AI retrieval.
- **Destination Model:** None explicitly defined in migrations.
- **Classification:** `DEFER` (Missing destination schema).

### 11. `ai_settings`
- **Firestore Count:** 1
- **Code Usage:** Seeded via `scripts/seed-ai-settings.ts`, drives Raya AI configurations.
- **Destination Model:** None explicitly defined.
- **Classification:** `DEFER` (Missing destination schema).

### 12. `messages`
- **Firestore Count:** 103
- **Code Usage:** Used heavily for AI chat history. Note: `chat_messages` is the target for `messages` (per `scripts/migrate-ai-to-supabase.ts`), but `messages` itself was held in REVIEW.
- **Destination Model:** `chat_messages` (mapped via `mapChatMessage`).
- **Classification:** `MIGRATE` (Script and mapper already exist for this mapping).

---

## Summary Table

| Collection | Firestore Count | Code Usage | Destination | Classification | Mapper Needed | Schema Change Needed | Risk | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `donations` | 1 | High (`/admin/donations`, UI) | `donations` | MIGRATE | Exists (`mapDonation`) | No | Low | Include in batch |
| `sevaBookings` | 8 | High (`/admin/seva-bookings`, UI) | `seva_bookings` | MIGRATE | Yes | No | Low | Include in batch |
| `settings` | 10 | High (`settings.service.ts`) | Split (`site_settings`, etc) | SPECIAL MIGRATION | Exists (`migrate-settings`) | No | Medium | Execute standalone |
| `messages` | 103 | High (AI Chat history) | `chat_messages` | MIGRATE | Exists (`mapChatMessage`) | No | Low | Include in batch |
| `homepage` | 1 | Med (UI configs) | `settings_documents`? | SPECIAL MIGRATION | Yes | No | Low | Update settings script to handle |
| `announcements` | 2 | High (UI, Admin) | None | DEFER | Yes | Yes | High | Create schema & mapper first |
| `quotes` | 35 | High (`/admin/quotes`, UI) | None | DEFER | Yes | Yes | High | Create schema & mapper first |
| `timings` | 1 | High (AI, UI) | None | DEFER | Yes | Yes | High | Create schema & mapper first |
| `volunteers` | 3 | Low (Admin tracking) | None | DEFER | Yes | Yes | High | Clarify vs `volunteer_requests` |
| `members` | 1 | Low (Trust/Admin) | None | DEFER | Yes | Yes | High | Clarify scope |
| `feedback` | 2 | Med (AI Analytics) | None | DEFER | Yes | Yes | High | Create schema & mapper first |
| `ai_settings`| 1 | Med (AI Config) | None | DEFER | Yes | Yes | High | Create schema & mapper first |
