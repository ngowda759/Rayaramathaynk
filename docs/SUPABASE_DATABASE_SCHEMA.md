# Supabase Database Schema Design

## 1. Architecture Overview
This document outlines the proposed migration of the application data layer from Firebase Firestore to Supabase PostgreSQL.
The migration strategy involves:
- Keeping Firebase Authentication and Firebase Storage intact.
- Moving Firestore data to PostgreSQL tables.
- Mapping document structures to relational structures, applying normalization where real relationships exist, but retaining JSONB for complex unstructured/nested data.
- Creating a `firestore_id` column on all migrated tables to preserve migration traceability and ensure validation of record counts.

## 2. Application Domains & Firestore Collection Inventory

The existing Firestore collections can be logically grouped into the following application domains:

* **Users & Roles**: `users`, `profiles`, `members`, `volunteers`, `volunteer_requests`
* **Sevas & Bookings**: `sevas`, `sevaBookings`
* **Poojas**: `dailyPoojas`
* **Events & Festivals**: `events`, `aaradhane`
* **Donations**: `donations`, `donation_campaigns`
* **Content & Information**: `homepage`, `settings`, `announcements`, `knowledge`
* **Gallery**: `galleryAlbums`, `galleryMedia`
* **Testimonials**: `testimonials`
* **AI & Chat**: `chat_sessions`, `chat_messages`, `unknown_questions`, `ai_intent_distribution`, `ai_latency_records`
* **Billing/Finance**: `bills`

### Verification Status:
*   **VERIFIED (Used in Codebase):** `users`, `profiles`, `members`, `volunteers`, `volunteer_requests`, `sevas`, `sevaBookings`, `dailyPoojas`, `events`, `aaradhane`, `donations`, `donation_campaigns`, `homepage`, `settings`, `announcements`, `knowledge`, `galleryAlbums`, `galleryMedia`, `testimonials`, `chat_sessions`, `unknown_questions`, `ai_intent_distribution`, `ai_latency_records`, `bills`.
*   **INFERRED / ASSUMED:** `chat_messages` is part of a subcollection or nested model but is explicitly created dynamically in codebase via `COLLECTIONS.CHAT_MESSAGES`.

## 3. Complete Table List & Firestore → PostgreSQL Mapping

| Firestore Collection | PostgreSQL Table | Reason | Difficulty |
|----------------------|------------------|--------|------------|
| `users`              | `users`          | Direct 1:1 mapping of users | Easy |
| `profiles`           | `profiles`       | User profiles extending Auth/User | Easy |
| `sevas`              | `sevas`          | 1:1 mapping for Seva catalogue | Easy |
| `dailyPoojas`        | `daily_poojas`   | 1:1 mapping of daily poojas | Easy |
| `events`             | `events`         | Core temple events | Moderate (Timestamp conversion) |
| `donations`          | `donations`      | Record of donations | Easy |
| `donation_campaigns` | `donation_campaigns` | Campaigns for donations | Easy |
| `galleryAlbums`      | `gallery_albums` | 1:1 Album mapping | Easy |
| `galleryMedia`       | `gallery_media`  | 1:1 Media mapping (w/ FK to album) | Moderate |
| `testimonials`       | `testimonials`   | 1:1 Testimonial mapping | Easy |
| `aaradhane`          | `aaradhanes`     | Aaradhane events mapping | Moderate (Nested arrays) |

*Note: Some AI and logging tables are left out of this initial core migration list, as they are often ephemeral or better suited for gradual migration. Settings collections might be migrated to a generic key-value table or dedicated single-row tables.*

## 4. Detailed Schema Proposals

### 4.1. Table: `sevas`
Mapped from `sevas` collection. Verified against `types/seva.ts`.

| Column | PostgreSQL Type | Nullable | Source Field | Notes |
|--------|-----------------|----------|--------------|-------|
| `id` | `uuid` | No | N/A | Primary Key, default `gen_random_uuid()` |
| `firestore_id` | `text` | Yes | document ID | Unique constraint. Preserved for traceability |
| `name` | `text` | No | `name` | |
| `description` | `text` | No | `description` | |
| `category` | `text` | No | `category` | |
| `amount` | `numeric(10,2)` | No | `amount` | |
| `duration` | `integer` | No | `duration` | |
| `image_url` | `text` | Yes | `imageUrl` | |
| `active` | `boolean` | No | `active` | Default `true` |
| `display_order` | `integer` | No | `displayOrder` | Default `0` |
| `created_at` | `timestamptz` | No | `createdAt` | Converted from ISO string / Timestamp |
| `updated_at` | `timestamptz` | No | `updatedAt` | Converted from ISO string / Timestamp |

### 4.2. Table: `daily_poojas`
Mapped from `dailyPoojas` collection. Verified against `types/pooja.ts`.

| Column | PostgreSQL Type | Nullable | Source Field | Notes |
|--------|-----------------|----------|--------------|-------|
| `id` | `uuid` | No | N/A | Primary Key, default `gen_random_uuid()` |
| `firestore_id` | `text` | Yes | document ID | Unique constraint. |
| `title` | `text` | No | `title` | |
| `description` | `text` | No | `description` | |
| `start_time` | `text` | No | `startTime` | |
| `duration` | `text` | No | `duration` | |
| `category` | `text` | No | `category` | Matches `PoojaCategory` type |
| `seva_amount` | `numeric(10,2)` | No | `sevaAmount` | Default `0` |
| `is_active` | `boolean` | No | `isActive` | Default `true` |
| `display_order` | `integer` | No | `displayOrder` | Default `0` |
| `days` | `text[]` | No | `days` | Array of days |
| `notes` | `text` | Yes | `notes` | |
| `created_by` | `text` | Yes | `createdBy` | Loose reference (email) |
| `created_at` | `timestamptz` | No | `createdAt` | Converted from ISO string / Timestamp |

### 4.3. Table: `events`
Mapped from `events` collection. Verified against `types/event.ts`.

| Column | PostgreSQL Type | Nullable | Source Field | Notes |
|--------|-----------------|----------|--------------|-------|
| `id` | `uuid` | No | N/A | Primary Key, default `gen_random_uuid()` |
| `firestore_id` | `text` | Yes | document ID | Unique constraint. |
| `title` | `text` | No | `title` | |
| `description` | `text` | No | `description` | |
| `location` | `text` | No | `location` | |
| `start_date` | `timestamptz` | No | `startDate` | Converted from Firestore Timestamp |
| `end_date` | `timestamptz` | No | `endDate` | Converted from Firestore Timestamp |
| `start_time` | `text` | Yes | `startTime` | |
| `end_time` | `text` | Yes | `endTime` | |
| `featured` | `boolean` | No | `featured` | Default `false` |
| `published` | `boolean` | No | `published` | Default `false` |
| `category` | `text` | Yes | `category` | |
| `image_url` | `text` | Yes | `imageUrl` | |
| `status` | `text` | No | `status` | Legacy field |
| `created_at` | `timestamptz` | No | `createdAt` | Default `now()` |
| `updated_at` | `timestamptz` | No | `updatedAt` | Default `now()` |

### 4.4. Table: `users`
Mapped from `users` collection. Verified against `types/user.ts`.

| Column | PostgreSQL Type | Nullable | Source Field | Notes |
|--------|-----------------|----------|--------------|-------|
| `id` | `uuid` | No | N/A | Primary Key, default `gen_random_uuid()` |
| `firestore_id` | `text` | Yes | document ID | Unique constraint. |
| `uid` | `text` | Yes | `uid` | Loose ref to Firebase Auth. *Note: Only present on `UserProfile`, but `TempleUser` uses `id` for standard list.* |
| `name` | `text` | No | `name` | |
| `email` | `text` | No | `email` | |
| `phone` | `text` | No | `phone` | |
| `role` | `text` | No | `role` | Matches `UserRole` |
| `active` | `boolean` | No | `active` | Includes `isActive` |
| `created_at` | `timestamptz` | No | `createdAt` | Converted from Timestamp |
| `updated_at` | `timestamptz` | No | `updatedAt` | Converted from Timestamp |

### 4.5. Table: `profiles`
Mapped from `profiles` collection. Verified against `types/profile.ts`.

| Column | PostgreSQL Type | Nullable | Source Field | Notes |
|--------|-----------------|----------|--------------|-------|
| `id` | `uuid` | No | N/A | Primary Key, default `gen_random_uuid()` |
| `firestore_id` | `text` | Yes | document ID | Unique constraint. |
| `uid` | `text` | No | `uid` | Loose ref to Firebase Auth |
| `name` | `text` | No | `name` | |
| `email` | `text` | No | `email` | |
| `phone` | `text` | Yes | `phone` | |
| `profile_image` | `text` | Yes | `profileImage` | |
| `bio` | `text` | Yes | `bio` | |
| `gotra` | `text` | Yes | `gotra` | |
| `nakshatra` | `text` | Yes | `nakshatra` | |
| `preferences` | `jsonb` | No | `preferences` | Complex nested object |
| `favorites` | `text[]` | No | `favorites` | Array of references |
| `recently_viewed` | `text[]` | No | `recentlyViewed` | Array of references |
| `bookmarks` | `jsonb` | No | `bookmarks` | Array of nested objects |
| `created_at` | `timestamptz` | No | `createdAt` | |
| `updated_at` | `timestamptz` | No | `updatedAt` | |

### 4.6. Table: `donations`
Mapped from `donations` collection. Verified against `types/donation.ts`.

| Column | PostgreSQL Type | Nullable | Source Field | Notes |
|--------|-----------------|----------|--------------|-------|
| `id` | `uuid` | No | N/A | Primary Key, default `gen_random_uuid()` |
| `firestore_id` | `text` | Yes | document ID | Unique constraint. |
| `donor_name` | `text` | No | `donorName` | |
| `email` | `text` | No | `email` | |
| `phone` | `text` | No | `phone` | |
| `address` | `text` | No | `address` | |
| `amount` | `numeric(10,2)` | No | `amount` | |
| `purpose` | `text` | No | `purpose` | |
| `campaign_id` | `uuid` | No | `campaignId` | Foreign Key to `donation_campaigns.id` |
| `message` | `text` | No | `message` | |
| `payment_mode` | `text` | No | `paymentMode` | |
| `status` | `text` | No | `status` | |
| `receipt_number` | `text` | No | `receiptNumber` | |
| `admin_remarks` | `text` | No | `adminRemarks` | |
| `collected_by` | `text` | No | `collectedBy` | |
| `collected_at` | `timestamptz` | Yes | `collectedAt` | |
| `created_at` | `timestamptz` | No | `createdAt` | |
| `updated_at` | `timestamptz` | No | `updatedAt` | |

### 4.7. Table: `donation_campaigns`
Mapped from `donation_campaigns` collection. Verified against `types/donationCampaign.ts`.

| Column | PostgreSQL Type | Nullable | Source Field | Notes |
|--------|-----------------|----------|--------------|-------|
| `id` | `uuid` | No | N/A | Primary Key, default `gen_random_uuid()` |
| `firestore_id` | `text` | Yes | document ID | Unique constraint. |
| `title` | `text` | No | `title` | |
| `description` | `text` | No | `description` | |
| `image_url` | `text` | No | `imageUrl` | |
| `suggested_amount` | `numeric(10,2)` | No | `suggestedAmount` | |
| `active` | `boolean` | No | `active` | |
| `display_order` | `integer` | No | `displayOrder` | |
| `created_at` | `timestamptz` | No | `createdAt` | |
| `updated_at` | `timestamptz` | No | `updatedAt` | |

### 4.8. Table: `gallery_albums`
Mapped from `galleryAlbums` collection. Verified against `types/gallery.ts`.

| Column | PostgreSQL Type | Nullable | Source Field | Notes |
|--------|-----------------|----------|--------------|-------|
| `id` | `uuid` | No | N/A | Primary Key, default `gen_random_uuid()` |
| `firestore_id` | `text` | Yes | document ID | Unique constraint. |
| `title` | `text` | No | `title` | |
| `slug` | `text` | No | `slug` | |
| `description` | `text` | No | `description` | |
| `cover_image` | `text` | No | `coverImage` | |
| `active` | `boolean` | No | `active` | |
| `display_order` | `integer` | No | `displayOrder` | |
| `created_at` | `timestamptz` | Yes | `createdAt` | |
| `updated_at` | `timestamptz` | Yes | `updatedAt` | |

### 4.9. Table: `gallery_media`
Mapped from `galleryMedia` collection. Verified against `types/gallery.ts`.

| Column | PostgreSQL Type | Nullable | Source Field | Notes |
|--------|-----------------|----------|--------------|-------|
| `id` | `uuid` | No | N/A | Primary Key, default `gen_random_uuid()` |
| `firestore_id` | `text` | Yes | document ID | Unique constraint. |
| `album_id` | `uuid` | No | `albumId` | Foreign Key to `gallery_albums.id` |
| `title` | `text` | No | `title` | |
| `description` | `text` | No | `description` | |
| `category` | `text` | No | `category` | Matches `GalleryCategory` |
| `type` | `text` | No | `type` | e.g. "photo", "video" |
| `image_path` | `text` | No | `imagePath` | |
| `video_url` | `text` | Yes | `videoUrl` | |
| `alt_text` | `text` | No | `altText` | |
| `is_featured` | `boolean` | No | `isFeatured` | |
| `display_order` | `integer` | No | `displayOrder` | |
| `tags` | `text[]` | No | `tags` | Array of text |
| `uploaded_by` | `text` | No | `uploadedBy` | Loose ref (email/uid) |
| `uploaded_at` | `timestamptz` | Yes | `uploadedAt` | |

### 4.10. Table: `testimonials`
Mapped from `testimonials` collection. Verified against `types/homepage.ts` / `services/testimonial.service.ts`.

| Column | PostgreSQL Type | Nullable | Source Field | Notes |
|--------|-----------------|----------|--------------|-------|
| `id` | `uuid` | No | N/A | Primary Key, default `gen_random_uuid()` |
| `firestore_id` | `text` | Yes | document ID | Unique constraint. |
| `name` | `text` | No | `name` | |
| `location` | `text` | No | `location` | |
| `quote` | `text` | No | `quote` | |
| `years` | `text` | No | `years` | |
| `image` | `text` | Yes | `image` | |
| `phone` | `text` | Yes | `phone` | |
| `approved` | `boolean` | Yes | `approved` | Default `false` |
| `rejected` | `boolean` | Yes | `rejected` | Default `false` |
| `rejection_reason` | `text` | Yes | `rejectionReason` | |
| `submitted_by` | `text` | Yes | `submittedBy` | "admin" or "public" |
| `created_at` | `timestamptz` | Yes | `createdAt` | |

### 4.11. Table: `aaradhanes`
Mapped from `aaradhane` collection. Verified against `types/aaradhane.ts`.

| Column | PostgreSQL Type | Nullable | Source Field | Notes |
|--------|-----------------|----------|--------------|-------|
| `id` | `uuid` | No | N/A | Primary Key, default `gen_random_uuid()` |
| `firestore_id` | `text` | Yes | document ID | Unique constraint. |
| `title` | `text` | No | `title` | |
| `guru_name` | `text` | No | `guruName` | |
| `dates` | `text[]` | No | `dates` | Array of dates |
| `description` | `text` | No | `description` | |
| `significance` | `text` | No | `significance` | |
| `rituals` | `text[]` | No | `rituals` | Array of texts |
| `offerings` | `text[]` | No | `offerings` | Array of texts |
| `image_url` | `text` | No | `imageUrl` | |
| `seva_details` | `jsonb` | No | `sevaDetails` | Array of objects (id, name, price, description) |
| `is_upcoming` | `boolean` | No | `isUpcoming` | |
| `display_order` | `integer` | No | `displayOrder` | |
| `created_by` | `text` | No | `createdBy` | Loose ref |
| `created_at` | `timestamptz` | No | `createdAt` | Converted from string/Timestamp |

## 5. Important Data-Conversion Issues (Special Types)

- **Firestore Timestamp / serverTimestamp()**: Converted to PostgreSQL `timestamptz` (Timestamp with time zone). Legacy data must convert the Firestore Timestamp (`{ _seconds, _nanoseconds }` or similar object formats) to an ISO string or epoch during the ETL process.
- **Arrays**: Converted to native PostgreSQL arrays (e.g., `text[]` for `days` in `dailyPoojas`, `tags` in `galleryMedia`).
- **Nested Objects**: Converted to `jsonb` columns (e.g., complex settings, preferences, `seva_details`). Do not over-normalize single-use complex structures.
- **Missing/Optional Fields**: Represented as `NULL` in Postgres unless a strict `DEFAULT` is defined.
- **Numbers**: Amounts mapped to `numeric(10,2)` to prevent precision loss. Order/display fields mapped to `integer`.

## 6. Relationships & Foreign Keys

- Most Firestore relationships are loose (e.g., storing a string `userId` or `albumId`).
- When migrating to PostgreSQL:
  - `gallery_media.album_id` should become a Foreign Key pointing to `gallery_albums.id`. *(Verified usage in `types/gallery.ts`)*
  - `sevaBookings.sevaId` should become a Foreign Key pointing to `sevas.id`. *(Verified usage in `types/seva-booking.ts`)*
  - `donations.campaign_id` should become a Foreign Key pointing to `donation_campaigns.id`. *(Verified usage in `types/donation.ts`)*
  - `users.uid` / `profiles.uid` / `sevaBookings.userId` should loosely point to Firebase Auth UIDs. Since we are NOT migrating Firebase Auth to Supabase Auth yet, this should remain a loose `text` reference to the Firebase UID, NOT a PostgreSQL foreign key to a Supabase `auth.users` table. *(Verified in code that `userId` or `uid` relies on `firebase-admin`)*

## 7. RLS / Security Considerations

**CRITICAL:** Firebase Authentication remains the active auth provider. We are NOT migrating to Supabase Auth in this phase.

Because the PostgreSQL database will not have direct knowledge of the Firebase Auth JWTs natively via Supabase Auth (unless custom JWT integration is set up), the initial RLS strategy must be:
- **Server-Side Access**: The Next.js backend (API Routes, Server Actions, Services) will connect to PostgreSQL using a securely stored Service Role Key or a dedicated API user role.
- **Database Schema**: RLS will be **ENABLED** on all tables but kept restrictive (`false` for all public access).
- **Access Strategy**: All database interactions will occur Server-Side, where the backend validates the Firebase Auth ID Token (via `firebase-admin`) before performing SQL operations.
- Do NOT implement unsafe public-write policies. Supabase Anon keys must only have read access to public, non-sensitive data (like `events` or `sevas`) if absolutely necessary, but preferably, all data flows through the Next.js server to guarantee unified Firebase Auth checks.

## 8. Firestore ID Strategy (Traceability)

Every migrated table must contain:
`firestore_id text UNIQUE`

This is crucial for:
1. Validating migration integrity: `SELECT COUNT(*) FROM sevas WHERE firestore_id IS NOT NULL` vs Firestore document count.
2. Idempotent migrations: Upserting data during the migration phase based on `firestore_id`.
3. Legacy URL support: Redirecting old URLs that use Firestore IDs to the new UUIDs.

## 9. Indexes & Constraints

- **Primary Keys**: `uuid` using `gen_random_uuid()`.
- **Unique Constraints**: `firestore_id` must be unique.
- **Foreign Keys**: `gallery_media(album_id)` -> `gallery_albums(id)`, `donations(campaign_id)` -> `donation_campaigns(id)`, `seva_bookings(seva_id)` -> `sevas(id)`.
- **Indexes**:
  - `events(start_date)` for upcoming event queries.
  - `sevas(display_order)` for UI ordering.
  - `daily_poojas(display_order)` for UI ordering.
  - `gallery_albums(display_order)`
  - `donation_campaigns(display_order)`

## 10. Migration Order & Risk Assessment

**Recommended Migration Order (Based on dependencies):**
1. Independent reference tables (`users`, `profiles`, `sevas`, `daily_poojas`, `gallery_albums`, `donation_campaigns`). (LOW RISK)
2. Dependent tables (`events`, `aaradhanes`, `gallery_media` [depends on albums], `testimonials`, `donations` [depends on campaigns], `sevaBookings` [depends on sevas/users]). (MEDIUM RISK - Requires careful FK mapping)
3. High-velocity data (`chat_sessions`, `messages`). (HIGH RISK)

**Risk Assessment:**
- **Low Risk**: Content-driven collections (`sevas`, `events`) are easy to migrate and mostly read-heavy.
- **Medium Risk**: Converting Firestore Timestamps correctly during ETL scripts requires careful handling of timezones and object structures.
- **High Risk**: Identity and Auth mapping. Misunderstanding the relationship between the Firebase Auth UID and PostgreSQL records could lead to broken access. Mitigation: Keep all DB access server-side and validate Firebase Auth tokens explicitly in the API layer before querying Supabase.
