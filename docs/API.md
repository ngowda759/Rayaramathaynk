# API Documentation

Base URL: `https://rayaramathaynk.vercel.app/api`

---

## Admin User Management

### 1. Create Super Admin
Creates a new super admin user with Firebase Authentication and Firestore.

**Endpoint:** `POST /api/admin/users/create-admin`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "securePassword123",
  "name": "Admin Name"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Super Admin created: administrator@rayaramathaynk.com"
}
```

**Response (Error - 400):**
```json
{
  "error": "Email, password, and name are required"
}
```

**Response (Error - 500):**
```json
{
  "error": "Failed to create admin"
}
```

---

### 2. Set User Role
Updates the role of an existing user in Firestore.

**Endpoint:** `POST /api/admin/users/set-role`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "role": "super_admin"
}
```

**Available Roles:**
- `super_admin` - Full system access
- `admin` - Admin access
- `priest` - Priest access
- `user` - Regular user (default)

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "User user@example.com has been set as super_admin",
  "userId": "firebase-uid-123"
}
```

**Response (Error - 404):**
```json
{
  "error": "User not found. Please ensure the user has logged in at least once."
}
```

**Response (Error - 400):**
```json
{
  "error": "Email and role are required"
}
```

---

## Gallery

### 3. Get Local Gallery Assets
Retrieves all images and videos from local `public/images/temple` and `public/videos` directories.

**Endpoint:** `GET /api/gallery/local-assets`

**Response (Success - 200):**
```json
{
  "localImages": [
    {
      "id": "img-temple1.jpg",
      "src": "/images/temple/temple1.jpg",
      "title": "Temple Exterior",
      "alt": "Temple Exterior"
    }
  ],
  "localVideos": [
    {
      "id": "vid-ceremony.mp4",
      "src": "/videos/ceremony.mp4",
      "title": "Morning Ceremony",
      "alt": "Morning Ceremony"
    }
  ]
}
```

---

### 4. Delete Local Gallery Asset
Deletes a file from the local filesystem.

**Endpoint:** `DELETE /api/gallery/local-assets`

**Request Body:**
```json
{
  "src": "/images/temple/temple1.jpg"
}
```

**Response (Success - 200):**
```json
{
  "success": true
}
```

**Response (Error - 403):**
```json
{
  "error": "Unauthorized path"
}
```

**Response (Error - 404):**
```json
{
  "error": "File not found"
}
```

---

## Usage Examples

### Create Admin with cURL
```bash
curl -X POST https://rayaramathaynk.vercel.app/api/admin/users/create-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"newadmin@rayaramathaynk.com","password":"securePassword123","name":"New Admin"}'
```

### Set User Role with cURL
```bash
curl -X POST https://rayaramathaynk.vercel.app/api/admin/users/set-role \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","role":"admin"}'
```

### Get Gallery Assets with cURL
```bash
curl https://rayaramathaynk.vercel.app/api/gallery/local-assets
```

### Delete Gallery Asset with cURL
```bash
curl -X DELETE https://rayaramathaynk.vercel.app/api/gallery/local-assets \
  -H "Content-Type: application/json" \
  -d '{"src":"/images/temple/temple1.jpg"}'
```

---

## Notes

- All admin endpoints require appropriate authentication/authorization on the client side
- User must have logged in at least once before their role can be set
- Gallery delete is restricted to `/images/temple/` and `/videos/` directories only
- File names are normalized (hyphens/underscores replaced with spaces) for display titles

---

## Seva Entry (`/api/seva/*`)

The seva counter, prasadam counter, dashboard, reports, settings and staff screens of Seva Entry call these route
handlers under `app/api/seva/`. The spec is `docs/seva/DESIGN-BOOK.md` (§6.5); this list is written from the code as
built on 2026-10-20.

**Common rules**

- **Sign-in:** every call sends `Authorization: Bearer <Firebase ID token>`. The guard
  (`requireSevaActor`, `lib/seva/server/auth.ts`) checks, in order: the token (401 `unauthenticated`), the Firestore
  profile's `isActive` and role (403 `staff_inactive` / `forbidden`), the Supabase `staff` row's status (403), the
  counter PC when the route needs one (403 `device_required` / `device_unknown`), view-only (403 `view_only` on every
  write), then the role x action allow-list (`lib/seva/permissions.ts`, 403 `forbidden`).
- **Counter PC:** counter calls also send `x-seva-device: <device id>.<secret>`; the server keeps only the SHA-256 of
  the secret (`lib/seva/server/device.ts`). "PC" below means a live registered counter PC.
- **Who:** R = Receptionist, P = Prasadam counter, TA = Temple admin, TV = Temple admin with view-only, SA = Super admin.
- **Bodies** are JSON and validated with zod (`lib/seva/schemas.ts` and the schemas in `lib/seva/server/*`). Money is
  in paise (whole numbers). Dates are `YYYY-MM-DD` in India time (IST).
- **Answers** are JSON with `Cache-Control: no-store` (the dashboard alone is cached 60 s in the viewer's browser).
  Errors are `{ "error": { "code", "message", "detail"? } }` with the code's status (`lib/seva/errors.ts`):
  400 `validation`, `change_reason_required`, `date_out_of_range`, `cash_short`, `upi_details_required`,
  `difference_note_required`; 401 `unauthenticated`; 403 `forbidden`, `view_only`, `staff_inactive`,
  `device_required`, `device_unknown`, `cancel_window_passed`; 404 `not_found`; 409 `seva_inactive`,
  `seva_not_on_counter`, `price_changed`, `amount_change_not_allowed`, `already_cancelled`, `cannot_reprint_cancelled`,
  `outbox_not_empty`, `day_already_closed`, `day_closed`, `number_conflict`, `device_exists`; 429 `rate_limited`;
  502 `partial_failure`; 500 `internal` (never with database text). Phone numbers are never in an answer except an
  export page that asked for them.

### Who am I

| Route | Who | Body / query | Answer |
|---|---|---|---|
| `GET /api/seva/me` | any staff (an invited person too; the first call marks them active) | - (a PC header is used when sent) | role, staff no., name, view-only, allowed actions, and the PC's counter when a live PC header came with the call |

### Counter

| Route | Who | Body / query | Answer |
|---|---|---|---|
| `GET /api/seva/counter/bootstrap` | R, TA, SA + PC | - | catalogue, settings and slip header (with the paper size), lists, denominations, festival chips, next numbers, the offline number and group-label floors, today's totals and the counter UPI payee (cash only when none) |
| `POST /api/seva/counter/orders` | R, TA, SA + PC | `CounterOrderPayload`: `clientOrderId`, `devotee` (name required; gotra, nakshatra, rashi, phone optional), `lines` (1-8: `sevaId`, `quantity`, `unitRatePaise`?, `changeReason`?, `sevaDate`, `clientReceiptId`, `qrToken`), `payment` (cash or UPI), `expectedTotalPaise`, `supersedesClientOrderId`? | the issued order: one receipt per seva date with numbers and QR tokens (`IssueResponse`); the same `clientOrderId` again answers the same receipts; any catalogue change refuses the whole order (`price_changed`, `seva_inactive`, ...) |
| `POST /api/seva/counter/prints` | R, TA, SA + PC | `{ receiptIds }` (1-31) | the print counts; a first print only for this PC's counter or the W series; a second print is a DUPLICATE and needs `receipt.reprint` (R: own counter, today) |
| `POST /api/seva/counter/sync` | R, TA, SA + PC (a retired PC too) | `{ items }`: offline orders (`kind: 'order'`, `seq`, the order with `issuerStaffNo`, `issuedAt`, `groupNo`, the printed numbers) and offline cancels, in `seq` order | one result per item; a business refusal does not stop the rest; any other failure answers 503 with the results so far. A retired PC may send only orders inside its replaced range |
| `POST /api/seva/counter/heartbeat` | R, TA, SA + PC, every 60 s | outbox size, clock skew, app version | server time, the OF number floor, the group-label floor, whether today is closed for the counter |
| `POST /api/seva/counter/refused` | R, TA, SA + PC (a retired PC too) | `{ items }` (1-200): the outbox items the office refused, as the PC recorded them: `seq`, `kind` (`order` or `cancel`), `code`, `receiptNos` (up to 100), `totalPaise`, `refusedAt`? | `{ results: [{ seq, duplicate }] }`; each item becomes one `sync.refused` audit row (once) and shows on the `sync_refused` card (A5-FIX F5-1, M-5) |
| `POST /api/seva/counter/refused/set-aside` | TA, SA (not view-only) + PC (a retired PC too) | `{ items }` (1-200): the refused items as above, each with `reason` (3-500 visible characters) and `setAsideAt` | `{ results: [{ seq, duplicate }] }`; each item becomes one `sync.refused_set_aside` audit row (once) and leaves the `sync_refused` card |
| `POST /api/seva/counter/devices` | TA, SA (no PC header: the PC is not registered yet) | `{ action: 'register', counterId, secretHash, label }` or `{ action: 'replace', counterId, secretHash, label, lastPrintedOfNo, reason }` | the new device id; "replace" retires the old PC and opens a gap for any unsent range |

### Receipts and devotees

| Route | Who | Body / query | Answer |
|---|---|---|---|
| `GET /api/seva/receipts` | TA, TV, SA every counter; R from the PC, that counter's receipts of today only | `from`, `to`, `sevaId`, `mode`, `status` (`issued`, `cancelled`, `changed`, `duplicate`, `prasadam_pending`), `q` (number or name), `cursor` | register rows and `nextCursor`; test-mode receipts left out |
| `GET /api/seva/receipts/[receiptId]` | as the list (R: a receipt of the PC's counter and today) | - | one receipt with its history (prints, cancel, prasadam, audit rows); 404 only after the guard |
| `POST /api/seva/receipts/cancel` | R own receipt inside the cancel window, from the PC; TA, SA any receipt, any time | `{ receiptIds, reasonCode, note? }` (`other` needs a note) | the cancelled receipts as register rows (`refundState` `done` = cash handed back, `due` = the office refunds) |
| `POST /api/seva/receipts/refund` | TA, SA (not view-only) | `{ receiptIds, mode: 'upi' or 'bank_transfer' or 'cash', reference (4+ characters unless cash), note (3+ characters) }` | the receipts as register rows, `refundState` `done`; a receipt whose refund is not due is refused (audited `receipt.refund_done`, A5-FIX M-3) |
| `POST /api/seva/receipts/[receiptId]/reissue` | R own receipt inside the window; TA, SA; always from the PC | - | the order as the counter reads it, with the next number of this counter on the same payment; today's receipts of this PC's counter only (`validation` / `reissue_only_today` otherwise) |
| `GET /api/seva/devotees/search` | R from the PC, TA, SA; 60 a minute per person | `name` (3+ letters, prefix) or `phone` (full mobile) | up to five matches `{ name, gotra, gotraId, nakshatraId, rashiId, phoneLast4, lastVisit }`; never the full phone |

### Prasadam

| Route | Who | Body / query | Answer |
|---|---|---|---|
| `GET /api/seva/prasadam/lookup` | P, TA, SA | `q`: the QR URL, the bare token, a full receipt number or a short form (`C1 124`, `C1/124`, `124`) | the screen to show (ready, another day, already given, cancelled, no prasadam, not found, or `choose` among several series); no amounts, no phone |
| `POST /api/seva/prasadam/give` | P, TA, SA (`confirmOffDate: true` needs `prasadam.give_off_date`) | `{ receiptId, confirmOffDate }` | `another_day` first for a slip of another date; after a give, `already_given` with `givenNow: true` for the caller's own give |
| `POST /api/seva/prasadam/undo` | the giver within the undo time (120 s); after that TA, SA with a reason | `{ receiptId, reason? }` | the receipt back to pending |

### Day close and number gaps

| Route | Who | Body / query | Answer |
|---|---|---|---|
| `GET /api/seva/day-close` | R for the PC's counter and today; TA, SA any counter and date | `counterId`? (none = the PC's own counter), `date` | what the close-day screen shows: expected cash and UPI, series ranges, outbox state (`DayClosePrep`) |
| `POST /api/seva/day-close` | as above | `{ counterId?, businessDate, counts, upiBankTotalPaise?, note? }` (a difference needs the note) | `{ dayCloseId }` |
| `POST /api/seva/day-close/reopen` | TA, SA | `{ dayCloseId, reason }` | the day reopened (audited) |
| `POST /api/seva/gaps/[id]` | TA, SA | `{ status: 'entered_from_paper' or 'declared_lost', note }` (3+ characters) | the gap resolved (audited); `entered_from_paper` is refused (`receipts_missing`) until every number of the gap is in the register (A5-FIX M-6) |
| `POST /api/seva/gaps/[id]/receipts` | TA, SA (not view-only) | `{ receiptNo (as printed), issuedOn, sevaDate, devotee, lines [{ sevaId, quantity, unitRatePaise? }], totalPaise, payment { mode: 'cash' } or { mode: 'upi', upiRefLast6 }, note }` | `{ receipt (a register row), gapStatus: 'open' or 'entered_from_paper' }`; one slip of the gap entered from the paper book (audited `receipt.entered_from_paper`, A5-FIX M-6) |

### Reports and exports

| Route | Who | Body / query | Answer |
|---|---|---|---|
| `GET /api/seva/reports/dashboard` | TA, TV, SA | `period` = `today`, `week`, `month`, `year` | `{ data, attention }`: tiles, chart buckets and the Needs attention cards; cached 60 s in the viewer's browser, keyed on the sign-in |
| `GET /api/seva/reports/continuity` | TA, TV, SA | `from`, `to` | one row per series: first and last number, issued, cancelled, open gaps |
| `GET /api/seva/reports/seva-summary` | TA, TV, SA | `from`, `to` | count and amount per seva by seva date, with last year |
| `GET /api/seva/reports/festival` | TA, TV, SA | `festivalId`, `compareYear` | the festival view |
| `GET /api/seva/reports/audit` | TA, TV, SA | `type`, `staffId`, `from`, `to`, `cursor` | audit rows, newest first, and `nextCursor`; no phone numbers |
| `GET /api/seva/reports/day-closes` | TA, TV, SA | `from`, `to` | one row per counter per day with its counts |
| `GET /api/seva/reports/export` | TA, TV, SA (`includePhones=true`: TA and SA, not view-only) | `part`, `from`, `to`, `cursor`, `includePhones` | `{ rows, nextCursor }`, 1,000 rows a page; with phones, every page first writes an `export.phones_read` audit row (part, range, cursor) and refuses when that write fails |
| `POST /api/seva/reports/export/audit` | as the export | `{ format: 'xlsx' or 'csv' or 'tally' or 'print', from, to, parts, includePhones }` | records the finished file as `export.download` |

### Catalogue and settings

| Route | Who | Body / query | Answer |
|---|---|---|---|
| `GET /api/seva/sevas` | R, TA, TV, SA | - | the whole catalogue in counter-key order |
| `POST /api/seva/sevas` | TA, SA | a seva: `code`, `nameEn`, `nameKn`, `ratePaise` or `anyAmount`, `visibility` (`counter`, `online`, `both`), `multiDate`, `allowAmountChange`, `prasadamGiven`, `prasadamItems`, `category`, `incomeLedger`, `active` | the seva; its public fields are then mirrored to Firestore `sevas` (a failed mirror answers 200 with `mirror: 'failed'`) |
| `GET /api/seva/sevas/[id]` | R, TA, TV, SA | - | the seva's rate history |
| `PUT /api/seva/sevas/[id]` | TA, SA | as POST; a rate change needs `reason` | the seva (mirrored as above) |
| `PUT /api/seva/sevas/reorder` | TA, SA | `{ ids }` in the new counter-key order | - |
| `GET /api/seva/settings/template` | TA, TV, SA | - | slip header, footer, which devotee details print, the paper size |
| `PUT /api/seva/settings/template` | TA, SA | any of those fields, including `paperSize` (`a5`, `a6`, `third_a4`, `roll_80`, `roll_58`, `custom`) and `paperCustomWidthMm` / `paperCustomHeightMm` (portrait); other keys refused | the saved settings |
| `GET /api/seva/settings/rules` | TA, TV, SA | - | counter rules and Tally ledger names (the cash-difference note and changed-amount reason are always required, never exposed) |
| `PUT /api/seva/settings/rules` | TA, SA | any of those fields; other keys refused | the saved settings |
| `GET /api/seva/settings/denominations` | TA, TV, SA | - | the notes and coins day close counts |
| `PUT /api/seva/settings/denominations` | TA, SA | `{ items: [{ kind, valuePaise, displayOrder, shown }] }` (Rs 0.01 to Rs 2,000) | the saved list |
| `GET /api/seva/settings/festivals` | TA, TV, SA | - | festivals with their dates |
| `POST /api/seva/settings/festivals` | TA, SA | `{ nameEn, nameKn, active, dates }` | the festival |
| `PUT /api/seva/settings/festivals/[id]` | TA, SA | as POST; the dates replace its dates | the festival |
| `GET /api/seva/settings/counters` | TA, TV, SA | - | counters with their C and OF series |
| `POST /api/seva/settings/counters` | TA, SA | `{ name, place }` | the next counter and its new series |
| `PUT /api/seva/settings/counters/[id]` | TA, SA | `{ name?, place?, openingFloatPaise?, active? }` | the counter |
| `GET /api/seva/settings/lists` | TA, TV, SA | - | the gotra, nakshatra and rashi lists |
| `POST /api/seva/settings/lists` | TA, SA | `{ kind: 'gotra', id?, nameEn?, nameKn?, active? }` (add or change a gotra) or `{ kind: 'nakshatra' or 'rashi', id, nameKn }` (Kannada only) | the saved item (audited as `settings.list_item`) |

The counter UPI id is not a seva setting: it is read from Firestore `settings/financeSettings` (super admin only).

### Staff

| Route | Who | Body / query | Answer |
|---|---|---|---|
| `GET /api/seva/staff` | TA (not view-only), SA | `filter` = `all`, `active`, `inactive`; or `view=next-staff-no` | the staff list with roles, or the next free staff number |
| `POST /api/seva/staff` | TA (not view-only; roles below super admin), SA | `{ fullName, email, role, viewOnly, staffNo? }` | 201 with the new person; the browser then sends Firebase's own set-password email |
| `PUT /api/seva/staff/[id]` | TA (roles and view-only below super admin, reactivate a non-super-admin); SA (give Super admin, reactivate a super admin, deactivate, delete) | `{ role?, viewOnly?, status? ('active', 'inactive', 'deleted'), reason? }` (deactivate and delete need a reason) | the person; a step that fails after an earlier one went through answers 502 `partial_failure` with what was done |

### Public QR page (not an API route)

`/r/<token>` (`app/r/[token]/page.tsx`) shows a receipt's slip details and whether it is valid, cancelled and given,
never the phone, without sign-in; 30 requests a minute per IP.

Phase 2 adds `devotee/*` and `payments/*` routes (Plan B).
