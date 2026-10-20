# Data Model Documentation

**Project:** Sri Raghavendra Swamy Matha Website
**Last Updated:** 2026-07-19

---

## Overview

This document describes the Firestore data model, including collections, schemas, relationships, and indexes. It answers: "How is data structured?"

---

## Database Overview

### Firebase Services

| Service | Purpose |
|---------|---------|
| **Firestore** | Primary database for all application data |
| **Firebase Auth** | User authentication |
| **Firebase Storage** | File storage (images, videos, documents) |

### Database Rules

- Public read for non-sensitive data (timings, events, announcements)
- Authenticated read for user-specific data
- Admin-only write for all collections
- Role-based access control via `role` field

---

## Collections

### 1. `users`

User profiles and authentication data.

```typescript
interface User {
  id: string;                    // Firebase Auth UID
  email: string;                 // Required, unique
  name: string;                  // Display name
  phone?: string;                // Optional contact
  role: UserRole;                // Access level
  templeId: string;              // Associated temple
  profileImage?: string;         // Storage URL
  isApproved: boolean;           // Admin approval status
  isActive: boolean;            // Account status
  emailVerified: boolean;        // Email verification
  lastLogin?: Timestamp;         // Last login time
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type UserRole = 
  | "super_admin"      // Full access
  | "temple_admin"     // Temple management
  | "priest"           // Ritual management
  | "staff"            // Daily operations
  | "volunteer"        // Limited access
  | "devotee";         // Public user
```

**Indexes:**
- `email` (unique)
- `templeId, role`
- `isActive, role`

**Security:**
- Users can read/write own profile
- Admins can read/write all

---

### 2. `sevas`

Available sevas (services) at the temple.

```typescript
interface Seva {
  id: string;
  name: {
    en: string;
    kn: string;
  };
  description: {
    en: string;
    kn: string;
  };
  category: SevaCategory;
  amount: number;               // INR
  duration: number;              // Minutes
  imageUrl?: string;            // Storage URL
  active: boolean;              // Available for booking
  displayOrder: number;         // Sort order
  maxPerDay?: number;           // Daily limit
  requiresAdvanceBooking: boolean;
  bookingWindowDays: number;     // How far in advance
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type SevaCategory = 
  | "daily_pooja"
  | "special_pooja"
  | "homam"
  | "archana"
  | "seva"
  | "Others";
```

**Indexes:**
- `category, active, displayOrder`
- `active, displayOrder`

**Relationships:**
- Referenced by `sevaBookings.sevaId`

---

### 3. `sevaBookings`

Seva booking records.

```typescript
interface SevaBooking {
  id: string;
  sevaId: string;               // Reference to Seva
  sevaTitle: string;            // Denormalized name
  sevaAmount: number;            // Denormalized amount
  
  // Devotee info
  devoteeName: string;
  devoteeEmail: string;
  devoteePhone: string;
  gotra?: string;               // Hindu family lineage
  nakshatra?: string;           // Birth star
  
  // Booking details
  preferredDate: string;        // YYYY-MM-DD
  preferredTime?: string;       // HH:MM (optional)
  notes?: string;
  
  // Status
  status: BookingStatus;
  statusHistory: StatusChange[];
  
  // Payment
  paymentStatus: PaymentStatus;
  paymentId?: string;
  paymentMode?: PaymentMode;
  
  // Admin
  bookedBy: string;             // User ID who created
  confirmedBy?: string;          // Admin who confirmed
  confirmedAt?: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type BookingStatus = 
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

type PaymentStatus = 
  | "pending"
  | "paid"
  | "refunded"
  | "failed";

type PaymentMode = 
  | "cash"
  | "upi"
  | "card"
  | "netbanking"
  | "bank_transfer";

interface StatusChange {
  from: BookingStatus;
  to: BookingStatus;
  changedBy: string;
  changedAt: Timestamp;
  reason?: string;
}
```

**Indexes:**
- `sevaId, preferredDate`
- `devoteeEmail, preferredDate`
- `status, preferredDate`
- `createdAt, status`

**Relationships:**
- References `sevas.id`
- References `users.id`

---

### 4. `events`

Temple events and festivals.

```typescript
interface TempleEvent {
  id: string;
  title: {
    en: string;
    kn: string;
  };
  description: {
    en: string;
    kn: string;
  };
  
  // Location
  location: string;
  
  // Timing
  startDate: Timestamp;
  endDate: Timestamp;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  
  // Classification
  category: EventCategory;
  type: EventType;
  
  // Media
  imageUrl?: string;
  videoUrl?: string;
  
  // Display
  featured: boolean;
  published: boolean;
  displayOrder: number;
  
  // Status
  status: EventStatus;
  
  // SEO
  metaTitle?: string;
  metaDescription?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type EventCategory = 
  | "festival"
  | "pooja"
  | "lecture"
  | "cultural"
  | "special"
  | "regular";

type EventType = 
  | "upcoming"
  | "ongoing"
  | "completed";

type EventStatus = 
  | "draft"
  | "published"
  | "cancelled";
```

**Indexes:**
- `status, published, startDate`
- `featured, published`
- `category, published, startDate`

---

### 5. `gallery`

Photo and video gallery items.

```typescript
interface GalleryItem {
  id: string;
  title: string;
  description?: string;
  
  // Media
  type: MediaType;
  url: string;                   // Storage URL
  thumbnailUrl?: string;         // For videos
  
  // Organization
  category: GalleryCategory;
  tags: string[];
  
  // Display
  featured: boolean;
  active: boolean;
  displayOrder: number;
  
  // Metadata
  uploadedBy: string;           // User ID
  uploadedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type MediaType = "image" | "video";

type GalleryCategory = 
  | "temple"
  | "events"
  | "festivals"
  | "priests"
  | "architecture"
  | "rituals"
  | " devotees"
  | "other";
```

**Indexes:**
- `category, active, displayOrder`
- `featured, active`

---

### 6. `announcements`

Public announcements and notices.

```typescript
interface Announcement {
  id: string;
  title: string;
  content: string;
  
  // Classification
  type: AnnouncementType;
  priority: number;              // Higher = more important
  
  // Display
  active: boolean;
  pinned: boolean;
  
  // Timing
  publishedAt: Timestamp;
  expiresAt?: Timestamp;
  
  // Target
  targetAudience: Audience;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type AnnouncementType = 
  | "info"
  | "alert"
  | "event"
  | "festival"
  | "important"
  | "maintenance";

type Audience = 
  | "all"
  | "devotees"
  | "visitors"
  | "staff";
```

**Indexes:**
- `active, publishedAt`
- `type, active, priority`

---

### 7. `donations`

Donation records.

```typescript
interface Donation {
  id: string;
  
  // Donor info
  donorName: string;
  donorEmail: string;
  donorPhone: string;
  donorAddress?: string;
  pan?: string;                  // For 80G
  
  // Donation details
  amount: number;                // INR
  purpose: DonationPurpose;
  campaignId?: string;           // For campaigns
  message?: string;
  
  // Payment
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  paymentId?: string;
  transactionId?: string;
  
  // Receipt
  receiptNumber: string;
  receiptUrl?: string;
  
  // 80G Certificate
  eligible80G: boolean;
  certificateNumber?: string;
  certificateUrl?: string;
  
  // Admin
  collectedBy?: string;
  collectedAt?: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  adminRemarks?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type DonationPurpose = 
  | "general"
  | "annadan"
  | "seva"
  | "donation_box"
  | "hundi"
  | "building_fund"
  | "trust_fund"
  | "festival"
  | "other";
```

**Indexes:**
- `donorEmail, createdAt`
- `paymentStatus, createdAt`
- `purpose, createdAt`
- `receiptNumber` (unique)

**Relationships:**
- References `donationCampaigns.id` (optional)

---

### 8. `donationCampaigns`

Active donation campaigns.

```typescript
interface DonationCampaign {
  id: string;
  title: {
    en: string;
    kn: string;
  };
  description: {
    en: string;
    kn: string;
  };
  
  // Goal
  goalAmount: number;
  currentAmount: number;         // Denormalized total
  
  // Dates
  startDate: Timestamp;
  endDate: Timestamp;
  active: boolean;
  
  // Media
  imageUrl?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes:**
- `active, endDate`

---

### 9. `settings`

Temple settings and configuration.

```typescript
interface TempleSettings {
  id: string;                    // Always "main"
  
  // Basic info
  templeName: {
    en: string;
    kn: string;
  };
  templeAddress: string;
  templePhone: string;
  templeEmail: string;
  
  // Location
  coordinates: {
    lat: number;
    lng: number;
  };
  googleMapsUrl?: string;
  
  // Timings
  timings: {
    morningOpen: string;         // "05:30"
    morningClose: string;
    eveningOpen: string;
    eveningClose: string;
  };
  
  // Contact
  contactPerson?: string;
  emergencyPhone?: string;
  
  // Social
  socialLinks: {
    website?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    twitter?: string;
  };
  
  // Bank details (for donations)
  bankDetails: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    branchName: string;
    ifscCode: string;
    upiId?: string;
  };
  
  // 80G
  tanNumber?: string;
  eightyGUrl?: string;
  
  updatedAt: Timestamp;
}
```

**Indexes:**
- No additional indexes needed (single document)

---

### 10. `knowledge`

Knowledge base articles for AI.

```typescript
interface KnowledgeArticle {
  id: string;
  
  // Content
  title: {
    en: string;
    kn: string;
  };
  content: {
    en: string;
    kn: string;
  };
  summary?: {
    en: string;
    kn: string;
  };
  
  // Organization
  category: KnowledgeCategory;
  tags: string[];
  
  // Search
  keywords: {
    en: string[];
    kn: string[];
  };
  
  // Display
  featured: boolean;
  active: boolean;
  
  // Metadata
  author: string;
  lastReviewed?: Timestamp;
  reviewedBy?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type KnowledgeCategory = 
  | "history"
  | "philosophy"
  | "guru_parampara"
  | "festivals"
  | "rituals"
  | "visiting"
  | "faq"
  | "other";
```

**Indexes:**
- `category, active`
- `active, keywords.en`
- `active, keywords.kn`
- `featured, active`

---

### 11. `chat_sessions`

AI chat session records.

```typescript
interface ChatSession {
  id: string;
  
  // User
  userId?: string;               // Anonymous if null
  sessionToken?: string;
  
  // Messages
  messages: ChatMessage[];
  
  // Context
  lastIntent?: string;
  lastLanguage?: string;
  
  // Stats
  messageCount: number;
  
  // Status
  status: "active" | "ended";
  
  createdAt: Timestamp;
  endedAt?: Timestamp;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  
  // AI metadata
  intent?: string;
  confidence?: number;
  source?: string;
  language?: string;
  
  timestamp: Timestamp;
}
```

**Indexes:**
- `userId, createdAt`
- `createdAt, status`

---

### 12. `aaradhane`

Aaradhane (deity worship schedule).

```typescript
interface Aaradhane {
  id: string;
  
  // Schedule
  dayOfWeek: number;             // 0 = Sunday, 6 = Saturday
  name: {
    en: string;
    kn: string;
  };
  description?: {
    en: string;
    kn: string;
  };
  
  // Timing
  startTime: string;             // "06:00"
  endTime: string;
  
  // Display
  active: boolean;
  displayOrder: number;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes:**
- `dayOfWeek, active`
- `active, displayOrder`

---

### 13. `panchanga`

Daily panchanga (Hindu calendar) data.

```typescript
interface Panchanga {
  id: string;                    // Date in YYYY-MM-DD format
  date: string;
  
  // Calendar data
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  sunrise: string;
  sunset: string;
  
  // Special days
  isFestival: boolean;
  festivalName?: string;
  isEkadashi: boolean;
  ekadashiName?: string;
  
  // Shubha/Ashubha
  rahuKaal: string;
  yamaganda: string;
  abhijitMuhurta?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes:**
- `date` (unique)
- `isEkadashi, date`

---

### 14. `unknown_questions`

Questions that AI couldn't answer well.

```typescript
interface UnknownQuestion {
  id: string;
  
  // Question
  question: string;
  language: "en" | "kn" | "mixed";
  
  // AI response
  detectedIntent?: string;
  confidence?: number;
  aiResponse?: string;
  
  // Session
  sessionId?: string;
  userId?: string;
  
  // Review
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  
  // Resolution
  addedToKnowledge: boolean;
  knowledgeArticleId?: string;
  
  createdAt: Timestamp;
}
```

**Indexes:**
- `reviewed, createdAt`
- `addedToKnowledge, reviewed`

---

## Relationships Diagram

```
users (1) ←→ (N) users
   │
   ├──→ users (createdBy)
   ├──→ users (confirmedBy)
   ├──→ users (collectedBy)
   │
   └──→ (N) sevaBookings
              │
              └──→ (1) sevas
              
donations (N) ←→ (1) donationCampaigns
   │
   └──→ (N) users (collectedBy, approvedBy)

sevas (1) ←→ (N) sevaBookings

chat_sessions (1) ←→ (N) chat_messages
   │
   └──→ (1) users (userId)
```

---

## Validation Rules

### Required Fields

| Collection | Required Fields |
|------------|----------------|
| users | email, name, role |
| sevas | name, category, amount |
| sevaBookings | devoteeName, devoteeEmail, sevaId, preferredDate |
| events | title, startDate, endDate |
| donations | donorName, donorEmail, amount, purpose |
| announcements | title, content |

### Field Constraints

| Field | Constraint |
|-------|-----------|
| email | Valid email format |
| phone | 10 digits |
| amount | > 0 |
| date | YYYY-MM-DD format |
| time | HH:MM format |

---

*Document maintained by: Development Team*

---

## Seva Entry (Supabase Postgres)

Seva Entry - the counter receipts, prasadam, day close, reports and staff module - keeps its data in **Supabase
Postgres**, not Firestore. Sign-in and the `users` role document stay in Firebase. The full design is
`docs/seva/DESIGN-BOOK.md` §7; this section is written from the migrations as built (2026-10-20).

**Rules for every seva table**

- Created by the migrations `supabase/migrations/2026102*_seva_*.sql` and `2026103*_seva_*.sql` (list in
  `docs/SUPABASE_MIGRATIONS.md`).
- Row level security is on and has no policies, and `anon` and `authenticated` have every privilege revoked: no
  browser can read or write a seva table. Only server code reaches them, through `createAdminClient()` (service role).
- Every write of more than one row goes through a `seva_*` SQL function in one transaction (called with `.rpc()` by
  `lib/seva/server/rpc.ts`). Functions are `SECURITY INVOKER`, pin `search_path`, and are executable by `service_role`
  only. Business errors are raised as `SEVA:<code>` with a JSON detail.
- Money is `numeric(12,2)` rupees in the database and whole paise in the API. Times are `timestamptz`; business dates
  are IST dates.
- Issued receipts, their lines and orders cannot have their money fields changed (guard triggers); `audit_log` is
  append-only; nothing that a receipt points at is ever deleted.

### Tables

| Table | Holds | Key columns |
|---|---|---|
| `staff` | Seva profile of each staff member (role and active flag stay in Firestore `users`) | `firebase_uid` (unique), `staff_no` (1-999, never reused), `full_name`, `email`, `view_only`, `status` (`invited`, `active`, `inactive`, `deleted`), `status_reason`, `status_changed_at` (offboarding time, used to refuse later offline work) |
| `counters` | Counters (Counter 1 = 1) | `name`, `place`, `opening_float`, `active` |
| `counter_devices` | Registered counter PCs | `counter_id`, `secret_hash` (SHA-256 of the PC's secret), `label`, `retired_at` / `retired_reason`, `last_seen_at`, `last_outbox_count`, `last_clock_skew_ms`, `app_version`, `of_group_floor_yymm` / `of_group_floor_no` |
| `seva_settings` | One row (id 1): slip header and footer, which devotee details print, counter rules, Tally ledgers, the receipt paper size, and the last counter UPI payee read | `temple_name_en` / `_kn`, `print_gotra` / `_nakshatra` / `_rashi`, `cancel_window_minutes` (30), `counter_days_ahead`, `prasadam_undo_seconds` (120), `day_close_flag_threshold`, `tally_*`, `paper_size` (`a5` default, `a6`, `third_a4`, `roll_80`, `roll_58`, `custom`), `paper_custom_w_mm` / `_h_mm`, `counter_upi_vpa` / `counter_upi_payee_name` (written only by `seva_note_counter_upi`) |
| `cash_denominations` | Notes and coins counted at day close | `kind` (`note`, `coin`), `value`, `display_order`, `shown`; unique `(kind, value)` |
| `festival_days` | Named festivals | `name_en`, `name_kn`, `active` |
| `festival_day_dates` | The dates of each festival | `festival_id`, `day` |
| `receipt_series` | Receipt series: `C<n>` (counter online), `OF<n>` (counter offline), `W` (online), `WT` (online test) | `code`, `kind`, `counter_id`, `active` |
| `receipt_series_years` | The last running number per series per calendar year (row-locked when numbers are taken) | `series_code`, `year`, `last_no` |
| `receipt_number_gaps` | Missing number ranges, never hidden | `series_code`, `year`, `from_no`, `to_no`, `cause` (`device_replaced`, `missing_in_sync`), `status` (`open`, then `entered_from_paper` or `declared_lost`), `resolution_note` |
| `group_counters` | Group label numbers per IST month (`G-YYMM-NNNN`) | `yymm`, `last_no` |
| `seva_rate_history` | Every rate change of a seva | `seva_id`, `old_amount`, `new_amount`, `reason`, `changed_by_staff_id` |
| `audit_log` | Append-only audit of everything that changed money, rules or people (never a phone number: stripped by a trigger) | `at`, `actor_staff_id`, `actor_role`, `action`, `entity`, `entity_id`, `receipt_no`, `reason`, `before`, `after` |
| `ops_backup_runs` | One row per nightly backup run | `started_at`, `finished_at`, `ok`, `bytes`, `error` |
| `seva_orders` | One order = what was paid once (one or more receipts) | `group_no`, `client_order_id` (idempotency), `channel`, `counter_id`, `device_id`, `issued_by_staff_id`, devotee fields, `phone_e164`, `amount_total`, `payment_mode`, `issued_offline`, `supersedes_order_id`, `synced_by_staff_id`, `test_mode` |
| `seva_receipts` | One receipt per seva date | `receipt_no` (unique, e.g. `C1-023-10-2026/000124`), `series_code`, `year`, `running_no`, `order_id`, `client_receipt_id`, `seva_date`, `business_date`, `total`, `status` (`issued`, `cancelled`), cancel fields, `refund_state` (`none`, `due`, `processing`, `done`, `failed`), `replaces_receipt_id`, `qr_token`, `prasadam_state` (`none`, `pending`, `given`), print counts |
| `seva_receipt_lines` | The sevas on a receipt, priced from the catalogue | `seva_id`, `seva_code`, `seva_name_en` / `_kn`, `quantity`, `catalogue_rate`, `unit_rate`, `amount`, `amount_changed`, `change_reason` |
| `day_closes` | One close per counter per business date | `counter_id`, `business_date`, `status` (`closed`, `reopened`), cash and UPI expected, counted and difference, `series_ranges`, `note`, closed and reopened by |
| `day_close_counts` | The count of each note and coin at a close | `day_close_id`, `kind`, `value`, `count`, `amount` |
| `devotee_profiles` | Returning-devotee details, only when a phone was given; purged after three years unseen | `phone_e164` (unique), `name`, `gotra`, `nakshatra_id`, `rashi_id`, `last_seen_at`, `visit_count` |
| `seva_list_items` | The gotra, nakshatra and rashi lists temple admins keep | `kind`, `item_id`, `name_en`, `name_kn`, `kn_checked`, `active`, `display_order`; a guard trigger keeps nakshatras and rashis fixed except their Kannada and refuses deletes |

The existing `sevas` table gains `code`, `name_kn`, `visibility` (`counter`, `online`, `both`), `multi_date`,
`allow_amount_change`, `any_amount`, `prasadam_given`, `prasadam_items`, `income_ledger` and `updated_by_staff_id`;
its rate changes are recorded by a trigger. Firestore `sevas` still receives a mirror of the public fields for the
website's other readers.

### SQL functions

Grouped by migration file. Helpers (`seva_issue_arg_*`, `*_require_*`, `*_guard`, JSON builders) are internal to the
other functions; the route code calls the rest through `callRpc`.

| File | Functions |
|---|---|
| `20261020000000_seva_core.sql` | `seva_forbid_change`, `seva_staff_guard`, `seva_sevas_rate_history` (triggers); `seva_ist_parts`, `seva_receipt_no` (the number format); `seva_strip_phones`, `seva_audit_log_strip_phones` (no phone in the audit); `seva_audit` (writes one audit row); `seva_next_staff_no` |
| `20261020000100_seva_receipts.sql` | `seva_receipts_guard` (issued receipts and lines cannot change their money fields) |
| `20261021000000_seva_functions_issue.sql` | `seva_issue_counter_order` (F1), `seva_sync_offline_order` (F2), `seva_record_prints`, `seva_cancel_receipts`, `seva_reissue_spoiled`, `seva_take_numbers`, `seva_next_group_no`, `seva_order_json`; helpers `seva_issue_arg_uuid`, `seva_issue_arg_money`, `seva_issue_arg_int`, `seva_issue_arg_date`, `seva_issue_arg_ts`, `seva_issue_arg_text`, `seva_issue_staff`, `seva_issue_offline_issuer`, `seva_issue_actor_role`, `seva_issue_device`, `seva_issue_counter_series`, `seva_issue_check_day_open`, `seva_issue_devotee`, `seva_issue_payment`, `seva_issue_save_profile`, `seva_issue_check_receipt_keys`, `seva_issue_write_lines`, `seva_issue_audit_lines`, `seva_issue_fill_gap` |
| `20261021000100_seva_functions_ops.sql` | `seva_mark_prasadam`, `seva_undo_prasadam`, `seva_register_device`, `seva_replace_device`, `seva_offline_group_floor`, `seva_resolve_gap`, `seva_heartbeat`, `seva_prepare_day_close`, `seva_close_day`, `seva_reopen_day`; helper `seva_ops_require_staff` |
| `20261021000200_seva_functions_admin.sql` | `seva_upsert_seva` (also sets a new seva's `firestore_id`), `seva_reorder_sevas`, `seva_update_settings`, `seva_note_counter_upi`, `seva_mask_vpa`, `seva_save_denominations`, `seva_save_festival`, `seva_add_counter`, `seva_update_counter`, `seva_staff_onboard`, `seva_staff_update`, `seva_mark_signed_in`, `seva_purge_devotee_profiles`, `seva_report_totals`, `seva_continuity`, `seva_dashboard`, `seva_needs_attention`, `seva_seva_summary`, `seva_report_festival_part`, `seva_festival_report`; helpers `seva_admin_require_actor`, `seva_admin_check_keys`, `seva_admin_diff`, `seva_admin_seva_json` |
| `20261030000000_seva_lists.sql` | `seva_list_items_get`, `seva_list_item_save` (audits `settings.list_item`), `seva_list_items_guard` (trigger) |
| `20261031000000_seva_paper_size.sql` | `seva_update_settings` again, adding the paper size fields |
| `20261102000000_seva_final_fixes.sql` | final-review fixes (A5-FIX F2): `seva_rate_at` (a seva's rate in force at a time, from `seva_rate_history`); `seva_sync_offline_order` again (H-2 prices fixed sevas from the catalogue; M-2 flags a closed day); `seva_cancel_receipts` again (M-1 closed day; L-4 `p_device_id`, the PC recorded in the audit row); `seva_needs_attention` again (card `synced_into_closed_day`); `seva_close_day` again (M-2 counter online, admin override `p_counter_offline_ok`); `seva_replace_device` with the last slip's year `p_last_printed_year` (M-4; the six-argument form means this year); `seva_issue_counter_order` again (L-8); `seva_issue_fill_gap` again and the new column `receipt_number_gaps.device_id`, the retired PC that alone may fill a `device_replaced` gap (L-1); guard triggers `seva_gaps_guard` and `seva_series_years_guard` (L-2: a gap is never deleted and only shrinks while open, `last_no` only rises; `DELETE` and `TRUNCATE` revoked from `service_role`); `seva_admin_require_actor` and `seva_ops_require_staff` again (L-5: refuse a view-only staff id); `seva_reissue_spoiled` with `p_is_admin` (L-5: own receipt inside the cancel window unless admin); `seva_visible_length` (L-11: a reason counts only visible characters; the checks `receipt_number_gaps_note_required`, `day_closes_reopen_reason`, `day_closes_difference_note` and `seva_receipt_lines_change_reason` ask for 3 of them, `NOT VALID` for older rows) |
| `20261102000100_seva_refunds_paper.sql` | refunds and the paper book (A5-FIX F4): `seva_settle_refund` (M-3: an admin marks refund-due receipts as refunded with the mode, a reference and a note; `refund_state` `done`, audit `receipt.refund_done`); `seva_enter_paper_receipt` (M-6: an admin enters one slip of an open gap from the paper book under its printed number, audit `receipt.entered_from_paper`; the gap shrinks through `seva_issue_fill_gap` and closes as `entered_from_paper` with its last number); `seva_resolve_gap` again (M-6: `entered_from_paper` only when every number of the gap is in the register; the note counts visible characters) |
| `20261102000200_seva_followups.sql` | follow-ups to the final-review fixes (A5-FIX F5): `seva_issue_staff` and `seva_issue_offline_issuer` again (L-5: the counter refuses a view-only staff id; the maker of an offline order is checked as at its time); `seva_needs_attention` again (card `unprinted_online`: online C receipts with no print after 10 minutes; card `sync_refused`; `synced_into_closed_day` also counts paper-book slips entered into a closed day); `seva_refused_item_json` (checks one office-refused outbox item a PC reports and puts it in audit form); `seva_note_sync_refused` (audit `sync.refused` for an outbox item the office refused, once per item); `seva_note_refused_set_aside` (audit `sync.refused_set_aside` when a temple admin set a refused item aside on the PC, with the reason, once per item; takes it off the `sync_refused` card); `seva_close_day` again (M-2: the admin override carries `p_counter_offline_reason`, 3 visible characters, in the `dayclose.close` audit row) |
| `20261102000300_seva_final_touches.sql` | the re-check's leftovers (FINAL-FIX): `seva_sync_offline_order` again (N-2: a fixed seva's catalogue rate is the rate in force at `issued_at`, and the PC's cached rate is trusted only when it equals that rate, so a rate lowered before the sync never makes a lower price trusted); `seva_needs_attention` again (N-3: the `unprinted_online` card looks back over today's business date and the 7 before it, not only today) |

`20261020000200_seva_seed.sql` seeds series C1, OF1, W and WT, Counter 1, the denominations and a settings row with
SAMPLE text; `20261029235900_seva_privilege_hardening.sql` revokes `TRIGGER` and `REFERENCES` on the guarded tables.
The first super admin `staff` row (001) is created by `scripts/seva/create-first-super-admin.ts`, not by a migration.

### Audit actions

`receipt.cancel` (an offline cancel's `after` carries `offline`, `cancelled_at`, `in_closed_day`, `late_sync` and
`synced_by_staff_id`), `receipt.reprint`, `receipt.amount_changed`, `receipt.reissue_spoiled`, `receipt.superseded`,
`receipt.issuer_inactive_at_sync`, `prasadam.given_off_date`, `prasadam.undo`, `prasadam.reversed`, `dayclose.close`,
`dayclose.reopen`, `seva.create`, `seva.update`, `seva.rate_change`, `settings.update`, `settings.upi_changed`,
`settings.list_item`, `denominations.update`, `festival.update`, `device.register`, `device.replace`, `gap.resolve`,
`staff.onboard`, `staff.role_change`, `staff.view_only_change`, `staff.deactivate`, `staff.reactivate`,
`staff.delete`, `export.download`, `export.phones_read`. A normal receipt issue writes no audit row; the receipt row is
the record. The demo seeder writes `demo.seed_started` / `demo.seed_finished` on test projects only.
