# M07 - Admin console: sevas, bookings, poojas, aaradhane, donations, billing, receipts, calendar

> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs; refreshed 2026-10-18 against HEAD 424fdb8 (see Refresh log). Verify against the code before acting on any claim.

## Answers questions about

- "How does the Receipt Book work end to end, from Create Receipt to the printed PDF?"
- "Where do receipt numbers come from, and can two receipts collide?"
- "Why does `/admin/receipts/<id>` spin forever / show 'Receipt not found'?"
- "What is the difference between `/admin/sevas`, `/admin/seva-bookings` and `/admin/bookings`?"
- "Where is the seva catalogue that the Receipt Book uses actually stored?"
- "How does an admin confirm / complete / cancel a seva booking, and who is allowed to?"
- "Is there a payment gateway anywhere, or is money handled manually?"
- "How does the UPI QR on the receipt screen get generated?"
- "How does Billing work, and why do all my invoices have the same number?"
- "Where are billing settings (invoice prefix, GSTIN, company details) stored?"
- "How do donations get recorded, marked received and reconciled?"
- "How is the Daily Pooja schedule edited, and where is it stored?"
- "How is Aaradhane created/edited, and where does the Aaradhane generator boundary sit (M14)?"
- "Where is the admin Ekadashi / Festival calendar edited, and does it actually save?"
- "Which API routes in this module have no authentication, and which of them actually work?"
- "Why are the collection totals on the admin Reports page wrong?"
- "Which Firestore collections does the admin finance area read and write?"
- "Where is the admin menu defined and why are `/admin/calendar/*` and `/admin/seva-bookings` not in it?"
- "What breaks if we move the admin console to React Native / a shared React client?"
- "Which files in this module are dead code?"
- "What does `requiredPermission=\"billing\"` actually enforce?"
- "How do I add a field to a receipt, a bill, a pooja or an aaradhane?"
- "How do I add a new admin CRUD page in this area?"
- "Which routes here still return a blanket 401, and what is `requireAdminUser` / `verifyAdminUserResult`?"
- "Does the mobile app (`apps/mobile`) show anything an admin edits in this module?"

## Purpose and business role

This module is the back-office the temple staff use for everything that involves a devotee
transaction or a scheduled ritual. It covers five loosely-coupled areas:

1. **Receipt Book** (`/admin/receipts`) - the only area built to a modern standard. A counter
   clerk records a devotee, picks sevas from a priced catalogue, shows a UPI QR, and issues a
   numbered receipt. Numbering, pricing and totals are computed server-side; the browser can never
   supply a price. Receipts render as an HTML print page and as a pdf-lib PDF.
2. **Billing** (`/admin/billing`) - a generic GST-style invoice module (customer, line items, tax,
   discount, payments, balance due). It is feature-flagged off by default and is markedly less
   finished than the Receipt Book: it talks to Firestore straight from the browser and its invoice
   numbering is broken.
3. **Bookings and donations** (`/admin/bookings`, `/admin/seva-bookings`, `/admin/donations`) -
   review queues for what devotees submit on the public site. Purely manual reconciliation: an
   admin flips a status and, for donations, types a receipt number. There is no payment gateway
   anywhere in this module; UPI is a QR the devotee scans out-of-band and a reference string typed
   back in.
4. **Ritual scheduling** (`/admin/pooja`, `/admin/aaradhane`) - CRUD over the daily pooja timetable
   and the Aaradhane (guru commemoration) records that feed the public calendar and the generator
   engine in M14.
5. **Calendar editing** (`/admin/calendar/ekadashi`, `/admin/calendar/festivals`) - two orphan
   pages that pretend to save and do not.

`/admin/sevas` is a trap: despite the path, it is the **Member / Volunteer** register, not a seva
catalogue.

## Code roots

From `.claude/state/chunks.json` (id M07):

```
app/admin/sevas            app/admin/seva-bookings     app/admin/bookings
app/admin/pooja            app/admin/aaradhane         app/admin/donations
app/admin/billing          app/admin/receipts          app/admin/calendar
components/admin/sevas     components/admin/pooja      components/admin/aaradhane
components/admin/bookings  components/admin/donations
services/billing.service.ts  services/receipt.service.ts  services/receiptSeva.service.ts
app/api/bookings           app/api/donations           app/api/admin/receipts
app/api/admin/receipt-sevas  app/api/admin/aaradhane   app/api/public/receipts
types/billing.ts  types/receipt.ts  types/receipt-extensions.ts  types/receiptSeva.ts
types/seva-booking.ts  types/finance.ts  types/donation.ts
```

**Adopted from Unassigned:** none. `components/admin/AdminSidebar.tsx` and
`components/admin/AdminHeader.tsx` are listed as unassigned in
`.claude/state/inventory/SUMMARY.md`, but they are *dead duplicates* of
`components/admin/layout/AdminSidebar.tsx` / `AdminHeader.tsx` which M05 owns - see M07-F20. Left
with M05.

**Boundary files read one level out (owned elsewhere, cited but not owned):**
`lib/receipt/admin.ts`, `lib/receipt/numbering.ts`, `lib/receipt/validation.ts`,
`lib/receipt/upi.ts`, `lib/receipt/pdf.ts` (M14), `lib/auth/admin-auth.ts` (M04),
`components/admin/layout/AdminAuthGuard.tsx`, `components/admin/layout/AdminSidebar.tsx` (M05),
`services/sevaBooking.service.ts`, `services/donation.service.ts`, `services/pooja.service.ts`,
`services/aaradhane.service.ts`, `services/volunteer.service.ts` (M10), `firestore.rules` (M04/M11),
`hooks/useFinanceSettings.ts` (M01/M05), `data/calendar.ts` (M11/M14).

## Entry points

| Route / entry | File | server/client | Auth required | What it renders or does |
|---|---|---|---|---|
| `/admin/sevas` | `app/admin/sevas/page.tsx` | client (`"use client"`) | admin shell guard only | **Member / Volunteer register** (tabs, search, print-selected). Not sevas. |
| `/admin/sevas/new?tab=` | `app/admin/sevas/new/page.tsx` | client | shell guard | Create member or volunteer |
| `/admin/sevas/[id]/edit?tab=` | `app/admin/sevas/[id]/edit/page.tsx` | client | shell guard | Edit member or volunteer |
| `/admin/seva-bookings` | `app/admin/seva-bookings/page.tsx` | client | shell guard | "Special Sevas" booking queue, inline Confirm/Cancel/Complete. Not in sidebar. |
| `/admin/bookings` | `app/admin/bookings/page.tsx` | client | shell guard | Bookings list via shared `CrudTable`, status + payment filters |
| `/admin/bookings/[id]` | `app/admin/bookings/[id]/page.tsx` | client | shell guard | Booking detail, status buttons |
| `/admin/pooja` | `app/admin/pooja/page.tsx` | client | shell guard | Daily pooja list + stats |
| `/admin/pooja/create` | `app/admin/pooja/create/page.tsx` | **server** | shell guard | Wraps `<CreatePooja />`, exports `metadata` |
| `/admin/pooja/edit/[id]` | `app/admin/pooja/edit/[id]/page.tsx` | **server (async)** | shell guard | Awaits `params`, wraps `<EditPooja poojaId />` |
| `/admin/aaradhane` | `app/admin/aaradhane/page.tsx` | client | shell guard | Aaradhane list + stats |
| `/admin/aaradhane/create` | `app/admin/aaradhane/create/page.tsx` | **server** | shell guard | Wraps `<CreateAaradhane />` |
| `/admin/aaradhane/edit/[id]` | `app/admin/aaradhane/edit/[id]/page.tsx` | **server (async)** | shell guard | Wraps `<EditAaradhane aaradhaneId />` |
| `/admin/donations` | `app/admin/donations/page.tsx` | client | shell guard | Donation list, 3 stat tiles, status filter |
| `/admin/donations/[id]` | `app/admin/donations/[id]/page.tsx` | client | shell guard | Donation detail + mark received/failed |
| `/admin/billing` (layout) | `app/admin/billing/layout.tsx` | client | `AdminAuthGuard requiredPermission="billing"` | Wraps all billing pages |
| `/admin/billing` | `app/admin/billing/page.tsx` | client | guard (again, nested) | Invoice list, 5 stat tiles; renders a "module disabled" panel unless `settings/financeSettings.billingEnabled` |
| `/admin/billing/create` | `app/admin/billing/create/page.tsx` | client | layout guard | Invoice composer |
| `/admin/billing/settings` | `app/admin/billing/settings/page.tsx` | client | layout guard | Invoice prefix/number, company info, notes |
| `/admin/billing/[id]` | **does not exist** | - | - | `app/admin/billing/page.tsx:332` pushes to it -> 404 |
| `/admin/receipts` (layout) | `app/admin/receipts/layout.tsx` | client | `AdminAuthGuard requiredPermission="billing"` | Wraps all receipt pages |
| `/admin/receipts` | `app/admin/receipts/page.tsx` | client | layout guard + ID token | Receipt list, 4 stat tiles, date/seva filters, paging |
| `/admin/receipts/create` | `app/admin/receipts/create/page.tsx` | client | layout guard + ID token | Two-step details -> UPI QR -> issue |
| `/admin/receipts/[receiptId]` | `app/admin/receipts/[receiptId]/page.tsx` | client | layout guard + ID token | Receipt detail, Print, Download PDF. **Broken - reads `params.id`** |
| `/admin/receipts/[receiptId]/print` | `app/admin/receipts/[receiptId]/print/page.tsx` | client | layout guard + ID token | Print-stylesheet receipt, auto `window.print()`. **Same bug** |
| `/admin/receipts/seva-settings` | `app/admin/receipts/seva-settings/page.tsx` | client | layout guard + ID token | Receipt seva catalogue CRUD (no delete, only disable) |
| `/admin/calendar/ekadashi` | `app/admin/calendar/ekadashi/page.tsx` | client | shell guard | Ekadashi editor. **PUTs to `/api/calendar`, which does not exist** |
| `/admin/calendar/festivals` | `app/admin/calendar/festivals/page.tsx` | client | shell guard | Festival editor. Same non-existent API |
| `GET/POST /api/bookings` | `app/api/bookings/route.ts` | route handler | **none** | List all bookings / create booking. Inert: client SDK server-side, so the list is always empty (M07-F42) |
| `GET/PATCH/DELETE /api/bookings/[id]` | `app/api/bookings/[id]/route.ts` | route handler | **none** | Read / update status+payment / delete. Inert - rules deny, 500 (M07-F42) |
| `GET/POST /api/donations` | `app/api/donations/route.ts` | route handler | **none** | List all donations / record donation. Inert: list is always empty (M07-F42) |
| `GET/PATCH/DELETE /api/donations/[id]` | `app/api/donations/[id]/route.ts` | route handler | **none** | Read / update / delete. Inert - rules deny, 500 (M07-F42) |
| `GET/POST /api/admin/receipts` | `app/api/admin/receipts/route.ts` | route handler | `verifyAdminUser` (Bearer ID token) | Paged list / aggregated report / create receipt |
| `GET /api/admin/receipts/[id]` | `app/api/admin/receipts/[id]/route.ts` | route handler | `verifyAdminUser` | One receipt |
| `GET /api/admin/receipts/[id]/pdf` | `app/api/admin/receipts/[id]/pdf/route.ts` | route handler | `verifyAdminUser` | PDF bytes (`Content-Type: application/pdf`) via `buildReceiptPdf` |
| `POST /api/admin/receipts/[id]/send` | `app/api/admin/receipts/[id]/send/route.ts` | route handler | **none** | **Stub: `return Response.json({success:true})`** |
| `GET/POST /api/admin/receipt-sevas` | `app/api/admin/receipt-sevas/route.ts` | route handler | `verifyAdminUser` | List / create catalogue seva |
| `PUT /api/admin/receipt-sevas/[id]` | `app/api/admin/receipt-sevas/[id]/route.ts` | route handler | `verifyAdminUser` | Update catalogue seva (no DELETE by design) |
| `GET/POST /api/admin/aaradhane` | `app/api/admin/aaradhane/route.ts` | route handler | `verifyAdminUser` (Bearer ID token) since da7a1fc, 2026-09-20 | List / create aaradhane. `createdBy` now = `admin.email` (`:41`), no longer the `x-user-email` header. GET answers for an admin; POST still goes through the client-SDK service and is denied by the rules (M07-F42). Nothing in the app calls it |
| `GET/PUT/DELETE /api/admin/aaradhane/[id]` | `app/api/admin/aaradhane/[id]/route.ts` | route handler | **none** | Read / update / delete aaradhane. GET works; writes denied (M07-F42) |
| `GET /api/public/receipts?search=` | `app/api/public/receipts/route.ts` | route handler | **none, public** | Substring search over `sevaBookings`, returns devotee PII |

"shell guard" = whatever `app/admin/layout.tsx` (M05) applies; this module adds nothing of its own
except the two `requiredPermission="billing"` layouts, which are no-ops (M07-F06).

## Component trees

### A. Receipt Book - create (the reference flow)

```
CreateReceiptPage (client)            app/admin/receipts/create/page.tsx
├─ layout: ReceiptsLayout (client)    app/admin/receipts/layout.tsx
│  └─ AdminAuthGuard requiredPermission="billing"   components/admin/layout/AdminAuthGuard.tsx
├─ hooks
│  ├─ useAuth()                       hooks/useAuth.ts          -> firebase user, user.getIdToken()
│  └─ useFinanceSettings()            hooks/useFinanceSettings.ts -> settings/financeSettings.upi
├─ step "details"
│  ├─ AdminPageHeader (client)        components/admin/common/AdminPageHeader.tsx
│  ├─ Input / Textarea (client)       components/ui/input.tsx, components/ui/textarea.tsx
│  ├─ native <select> per line, options from receiptSevaService.getActiveSevas(token)
│  └─ validateReceiptCreateInput()    lib/receipt/validation.ts  (same fn the server runs)
├─ step "pay"
│  ├─ buildUpiPaymentUrl()            lib/receipt/upi.ts   -> "upi://pay?pa=..&am=.."
│  ├─ dynamic import("qrcode") -> QRCode.toDataURL -> <img src={dataUrl}>   (line 270)
│  └─ Button (client)                 components/ui/button.tsx
└─ services
   ├─ receiptSevaService              services/receiptSeva.service.ts -> GET /api/admin/receipt-sevas
   └─ receiptService.createReceipt    services/receipt.service.ts     -> POST /api/admin/receipts
                                        -> lib/receipt/admin.ts createReceiptWithAdmin
                                          -> Firestore `sevas` (rate lookup)
                                          -> Firestore `system/receiptCounter` (transaction)
                                          -> Firestore `receipts` (write)
```

### B. Receipt Book - list / detail / print / catalogue

```
ReceiptsPage (client)                 app/admin/receipts/page.tsx
├─ AdminPageHeader, SearchBox (client)  components/admin/common/*
├─ Input type=date x2, <select> sevas
├─ formatDate()                       lib/format.ts
└─ receiptService.getReceipts()       -> GET /api/admin/receipts?from&to&sevaId&page&pageSize

ReceiptDetailPage (client)            app/admin/receipts/[receiptId]/page.tsx
├─ receiptService.getReceipt(id)      -> GET /api/admin/receipts/[id]
└─ receiptService.getReceiptPdf(id)   -> GET /api/admin/receipts/[id]/pdf -> Blob -> <a download>
                                         (server: lib/receipt/pdf.ts buildReceiptPdf, pdf-lib)

ReceiptPrintPage (client)             app/admin/receipts/[receiptId]/print/page.tsx
└─ inline <style>@media print{...}</style> + window.print() after 300ms

SevaSettingsPage (client)             app/admin/receipts/seva-settings/page.tsx
├─ FormDialog (client)                components/admin/common/FormDialog.tsx
├─ validateReceiptSevaInput()         lib/receipt/validation.ts
└─ receiptSevaService.createSeva / updateSeva -> /api/admin/receipt-sevas[/id]
```

### C. Billing

```
BillingLayout (client)                app/admin/billing/layout.tsx
└─ AdminAuthGuard requiredPermission="billing"
   └─ BillingPage (client)            app/admin/billing/page.tsx
      └─ AdminAuthGuard (SECOND, redundant)  -> BillingPageContent (client)
         ├─ useFinanceSettings()      hooks/useFinanceSettings.ts
         ├─ getDoc(settings/financeSettings) directly via firebase/firestore  (lines 49-51)
         ├─ billingService.getBills() services/billing.service.ts -> Firestore `bills` (client SDK)
         └─ raw <table>, getStatusBadge(), Intl.NumberFormat currency

CreateBillPage (client)               app/admin/billing/create/page.tsx
├─ getDoc(settings/financeSettings) for invoicePrefix / invoiceNumber / defaultDueDays
└─ billingService.createBill(input, prefix, number)  -> addDoc(`bills`)

BillingSettingsPage (client)          app/admin/billing/settings/page.tsx
└─ setDoc(settings/financeSettings, {billing, billingEnabled:true}, {merge:true})
```

### D. Bookings (two parallel UIs over one collection)

```
BookingsPage (client)                 app/admin/bookings/page.tsx
├─ SearchBox + 2 native <select> filters
├─ CrudTable<SevaBooking> (client)    components/admin/crud/CrudTable.tsx   [M05 framework]
│  └─ columns: bookingColumns         app/admin/bookings/columns.tsx
└─ sevaBookingService                 services/sevaBooking.service.ts -> Firestore `sevaBookings`
   └─ actions: onView -> /admin/bookings/[id]; onEdit -> updateStatus("confirmed"); onDelete

BookingDetailPage (client)            app/admin/bookings/[id]/page.tsx
└─ statusConfig / paymentStatusConfig maps -> lucide icons -> Confirm / Complete / Cancel buttons

AdminSevasPage (client)               app/admin/seva-bookings/page.tsx   [duplicate UI, own <table>]
└─ same sevaBookingService, inline Confirm / Cancel / Complete

-- DEAD, not routable --
BookingPage (client)                  components/admin/bookings/[id]/page.tsx
└─ BookingDetails (client)            components/admin/bookings/BookingDetails.tsx
   └─ BookingStatusBadge (client)     components/admin/bookings/BookingStatusBadge.tsx
```

### E. Donations

```
DonationsPage (client)                app/admin/donations/page.tsx
├─ 3 stat tiles computed client-side from the full list
├─ CrudTable<DonationRecord>          components/admin/crud/CrudTable.tsx   [M05]
│  └─ donationColumns                 app/admin/donations/columns.ts
└─ donationService                    services/donation.service.ts -> Firestore `donations`

DonationPage (client)                 app/admin/donations/[id]/page.tsx
└─ DonationDetails (client)           components/admin/donations/DonationDetails.tsx
   ├─ DonationStatusBadge (client)    components/admin/donations/DonationStatusBadge.tsx
   └─ updateStatus() -> donationService.updateDonationStatus -> window.location.reload()
```

### F. Pooja and Aaradhane (shared shape)

```
PoojaPage (client)                    app/admin/pooja/page.tsx
├─ PoojaStats (client)                components/admin/pooja/PoojaStats.tsx
│  └─ StatCard (client)               components/admin/common/StatCard.tsx  -> poojaService.getStats()
├─ SearchBox (client)
└─ PoojaTable (client)                components/admin/pooja/PoojaTable.tsx
   ├─ Table/Dialog primitives         components/ui/table.tsx, components/ui/dialog.tsx
   └─ poojaService.updatePooja / deletePooja -> Firestore `dailyPoojas`

CreatePoojaPage (server) -> CreatePooja (client)   components/admin/pooja/CreatePooja.tsx
   └─ Select/Switch/Label primitives; poojaService.createPooja(data, user.email)
EditPoojaPage (server)   -> EditPooja (client)     components/admin/pooja/EditPooja.tsx
   └─ poojaService.getPoojaById / updatePooja  (no days, no displayOrder - see M07-F13)

AaradhanePage (client)                app/admin/aaradhane/page.tsx
├─ AaradhaneStats (client)            components/admin/aaradhane/AaradhaneStats.tsx
└─ AaradhaneTable (client)            components/admin/aaradhane/AaradhaneTable.tsx
   └─ aaradhaneService -> Firestore `aaradhane` (+ fallback `aaradhanes`)
CreateAaradhanePage (server) -> CreateAaradhane (client)  components/admin/aaradhane/CreateAaradhane.tsx
   └─ ImageUploader (client)          components/ui/ImageUploader.tsx
EditAaradhanePage (server)   -> EditAaradhane (client)    components/admin/aaradhane/EditAaradhane.tsx
```

### G. Calendar editors (orphans)

```
EkadashiAdminPage (client)            app/admin/calendar/ekadashi/page.tsx
├─ seed state from static `calendar.ekadashi`   data/calendar.ts   [M11/M14]
└─ fetch("/api/calendar", {method:"PUT"})  -> 404, result ignored -> local state only

FestivalsAdminPage (client)           app/admin/calendar/festivals/page.tsx   (identical shape)
```

## Data flow

### 1. Issue a receipt (the one hardened money path)

1. `app/admin/receipts/create/page.tsx:57-72` - on mount, `useAuth()` gives a Firebase user;
   `user.getIdToken()` -> `receiptSevaService.getActiveSevas(token)`.
2. `services/receiptSeva.service.ts:37-58` - `GET /api/admin/receipt-sevas` with
   `Authorization: Bearer <idToken>`; filters `active` and sorts by `displayOrder` client-side.
3. `app/api/admin/receipt-sevas/route.ts:21-47` - `verifyAdminUser(request)`
   (`lib/auth/admin-auth.ts:186`, since 2026-09 a null-returning wrapper over
   `verifyAdminUserResult` at `:50`) then reads Firestore collection **`sevas`** through the Admin SDK.
4. Clerk fills devotee + lines; `goToPay()` runs `validateReceiptCreateInput`
   (`lib/receipt/validation.ts:23`) and switches to `step="pay"`.
5. `app/admin/receipts/create/page.tsx:96-119` - `buildUpiPaymentUrl` (`lib/receipt/upi.ts:9`)
   builds `upi://pay?...&am=<total>`; `qrcode` is dynamically imported and the QR is rendered as a
   data-URL `<img>`. **Nothing is charged; the devotee pays out of band.**
6. `confirmPayment()` -> `receiptService.createReceipt(input, token)`
   (`services/receipt.service.ts:146`) -> `POST /api/admin/receipts`.
   The payload carries only `{sevaId, quantity}` per line - no rates, no totals
   (`types/receipt.ts:30-43` documents this deliberately).
7. `app/api/admin/receipts/route.ts:148-172` - `verifyAdminUser`, then
   `createReceiptWithAdmin(body, admin)` (`lib/receipt/admin.ts:66`).
8. `lib/receipt/admin.ts:78-111` - for each line, read `sevas/{sevaId}`, reject unknown/disabled/
   invalid-amount, snapshot `sevaName` + `rate`, compute `amount = quantity * rate`.
9. `lib/receipt/admin.ts:45-58` - `db.runTransaction` on `system/receiptCounter`:
   `nextSequenceForYear` (`lib/receipt/numbering.ts:29`) then
   `formatReceiptNumber` -> `RM-2026-000123`. Atomic, per-year, resets each January.
10. `lib/receipt/admin.ts:121-141` - write `receipts/{auto}` with `items`, `sevaIds[]` (for the
    seva filter), `subtotal`, `totalAmount`, `createdBy = admin.email || admin.uid`.
11. Response `{id, receiptNumber}` -> success panel. **The success panel offers no link to the new
    receipt**, and the detail page it would link to is broken anyway (M07-F01).

### 2. Print / download a receipt

1. `app/admin/receipts/[receiptId]/page.tsx:84` - Print pushes to `.../print`;
   `app/admin/receipts/[receiptId]/print/page.tsx:46-50` calls `window.print()` 300 ms after load,
   with an inline `@media print` stylesheet that hides everything outside `.print-area`.
2. Download -> `receiptService.getReceiptPdf(id, token)` (`services/receipt.service.ts:130`) ->
   `GET /api/admin/receipts/[id]/pdf`.
3. `app/api/admin/receipts/[id]/pdf/route.ts:45-69` - `verifyAdminUser`, load the receipt, load
   temple contact via `loadTempleContact()` (line 24), call `buildReceiptPdf`
   (`lib/receipt/pdf.ts:176`, pdf-lib, M14), return an `application/pdf` response with
   `Content-Disposition: inline`.
4. **Both step-1 pages never load anything** because they read `params.id` while the segment is
   `[receiptId]` - see M07-F01.

### 3. Create an invoice (Billing)

1. `app/admin/billing/create/page.tsx:43-65` - `getDoc(settings/financeSettings)` straight from the
   browser; take `billing.invoicePrefix`, `billing.invoiceNumber`, `billing.defaultDueDays`.
2. Clerk adds line items; subtotal/total are computed in the component (line 94-95). Tax is *never*
   applied here even though `BillItem.taxRate` exists.
3. `billingService.createBill(input, invoicePrefix, invoiceNumber)`
   (`services/billing.service.ts:141`).
4. `services/billing.service.ts:160` - `generateInvoiceNumber(prefix, number)` -> `INV01001`, then
   `addDoc(collection(db,"bills"), billData)` using the **client** Firebase SDK.
5. Nothing anywhere increments `settings.financeSettings.billing.invoiceNumber`. Only a human
   editing `/admin/billing/settings` changes it -> **every invoice gets the same number**
   (M07-F02).
6. `createdBy` is written as `""` (`services/billing.service.ts:181`) - no audit trail.

### 4. Record a payment against a bill

1. `billingService.addPayment(billId, payment)` (`services/billing.service.ts:232`).
2. Read the bill, append `{...payment, id: Date.now().toString()}`, recompute
   `amountPaid`, `balanceDue = totalAmount - amountPaid`, set `paymentStatus` to `partial`/`paid`,
   promote `draft` -> `sent`.
3. Single `updateDoc`, **read-modify-write with no transaction** - two concurrent payments lose
   one (M07-F44, not F03). There is no UI that calls `addPayment` / `recordPayment` today; the code is
   reachable only from a future screen.

### 5. Move a seva booking through its lifecycle

Statuses (`types/seva-booking.ts:1-7`): `pending | confirmed | completed | cancelled`, with a
separate `paymentStatus: pending | completed | failed`.

1. Devotee submits on the public site (M03) -> `sevaBookingService.createBooking` forces
   `status:"pending"`, `paymentStatus:"pending"` (`services/sevaBooking.service.ts:36`).
2. Admin opens `/admin/bookings` or `/admin/seva-bookings`; both call
   `sevaBookingService.getAllBookings()` -> Firestore `sevaBookings` ordered by `createdAt desc`,
   **whole collection, no paging**.
3. Confirm/Complete/Cancel -> `sevaBookingService.updateBookingStatus(id, status)` -> `updateDoc`
   with the **client** SDK. `firestore.rules:117` allows update only for `isAdmin()`, so that is
   where the real authorisation lives.
4. There is **no state machine**: `app/admin/bookings/[id]/page.tsx:218-248` lets you jump from
   `cancelled` straight to `completed`. `CrudTable`'s `onEdit` on the list page is wired to
   "set confirmed" (`app/admin/bookings/page.tsx:191-195`), so the pencil icon silently confirms.
5. **No notification of any kind** is sent on a status change - no email, no WhatsApp, no
   in-app notification. `hooks/useDonationNotifications.ts` exists for donations (M01/M03) but
   nothing equivalent is called here.
6. `PATCH /api/bookings/[id]` offers the same transitions over HTTP with **no auth at all**
   (`app/api/bookings/[id]/route.ts:35-54`).

### 6. Reconcile a donation

1. Devotee submits (public site) -> `donationService.createDonation` forces `status:"pending"`,
   `receiptNumber:""`, `collectedBy:""` (`services/donation.service.ts:39`).
2. `/admin/donations` lists everything; three tiles are computed in the browser over the whole
   collection (`app/admin/donations/page.tsx:116-126`).
3. "Mark Received" -> `donationService.updateDonationStatus(id,"received")` which also stamps
   `collectedAt: serverTimestamp()` - but **never sets `collectedBy` or `receiptNumber`**. There is
   no UI field for either, so `DonationDetails` always renders "Receipt No. -"
   (`components/admin/donations/DonationDetails.tsx:88-93`).
4. Donations and the Receipt Book are **completely disconnected**: marking a donation received does
   not create a receipt, and `receipts` has no donation link.

### 7. Edit the Ekadashi / Festival calendar (does nothing)

1. `app/admin/calendar/ekadashi/page.tsx:14` seeds state from the static `calendar.ekadashi`
   array in `data/calendar.ts`.
2. Add/Update/Delete build a new array and `await fetch("/api/calendar", {method:"PUT"})`
   (lines 34, 62, 80). **`app/api/calendar` does not exist.**
3. `fetch` to a missing route resolves with a 404 response rather than throwing, so the `catch`
   never fires and the console message at line 40 never prints. The list updates locally and is
   lost on refresh, with no error shown (M07-F04).
4. The sidebar instead points at `/admin/settings/ekadashi-calendar` and
   `/admin/settings/festival-calendar` (`components/admin/layout/AdminSidebar.tsx:77-78`), which
   are a *different*, working implementation writing `settings/ekadashiCalendar` in Firestore.
5. **How this feeds the public calendar: it does not.** The public pages import the same static
   module directly - `app/calendar/page.tsx:3` (`import { calendar } from "@/data/calendar"`), and
   so do `components/calendar/EkadashiTable.tsx`, `FestivalTable.tsx`, `NextEkadashiCard.tsx` and
   `lib/festival-utils.ts` (M11). So the only way an admin edit reaches a devotee today is through
   `/admin/settings/{ekadashi,festival}-calendar` (M05) *if* the public components are migrated to
   read `settings/*`; `app/admin/calendar/*` can never reach them, because nothing persists.

## Key files

| File | Lines | Role | Key exports | Notes |
|---|---:|---|---|---|
| `app/admin/sevas/page.tsx` | 258 | Member/Volunteer register | `VolunteerPage` | Route name lies; `window.open` print; `handleDelete` uses `window.confirm` |
| `app/admin/sevas/columns.ts` | 91 | Column defs | `memberColumns`, `volunteerColumns` | Nothing seva-related; table below renders hard-coded `<td>`s anyway |
| `app/admin/sevas/new/page.tsx` | 177 | Create member/volunteer | `NewMemberVolunteerPage` | `Suspense` wrapper for `useSearchParams`; `value: any` at :35 |
| `app/admin/sevas/[id]/edit/page.tsx` | 242 | Edit member/volunteer | `EditMemberVolunteerPage` | Near-duplicate of the create page |
| `components/admin/sevas/SevaForm.tsx` | 181 | Seva create/edit form | `SevaForm` | **Dead** - no importer |
| `components/admin/sevas/DeleteSevaDialog.tsx` | 72 | Delete confirm modal | `DeleteSevaDialog` | **Dead** - no importer |
| `components/admin/sevas/constants.ts` | 21 | Seva category options | `sevaCategoryOptions` | Only used by the dead `SevaForm` |
| `app/admin/seva-bookings/page.tsx` | 207 | Booking queue #2 | `AdminSevasPage` | Hand-rolled table; component name says "Sevas"; not in sidebar |
| `app/admin/bookings/page.tsx` | 203 | Booking queue #1 | `BookingsPage` | Uses shared `CrudTable`; `onEdit` == confirm |
| `app/admin/bookings/columns.tsx` | 74 | Booking columns | `bookingColumns` | `.tsx` because formatters return JSX |
| `app/admin/bookings/[id]/page.tsx` | 254 | Booking detail | `BookingDetailPage` | Optimistic local `setBooking` after update |
| `components/admin/bookings/[id]/page.tsx` | 89 | **Dead** detail page | `BookingPage` | A `page.tsx` under `components/` - never routed |
| `components/admin/bookings/BookingDetails.tsx` | 143 | Detail card | `BookingDetails` | Only the dead page imports it; `window.location.reload()` at :34 |
| `components/admin/bookings/BookingStatusBadge.tsx` | 32 | Status pill | `BookingStatusBadge` | Reachable only via the dead page |
| `app/admin/donations/page.tsx` | 219 | Donation list | `DonationsPage` | Tiles computed in-browser over the whole collection |
| `app/admin/donations/columns.ts` | 61 | Donation columns | `donationColumns` | Emoji status formatters |
| `app/admin/donations/[id]/page.tsx` | 85 | Donation detail | `DonationPage` | Thin wrapper |
| `components/admin/donations/DonationDetails.tsx` | 157 | Detail card | `DonationDetails` | `window.location.reload()` at :34; no remarks/receipt input |
| `components/admin/donations/DonationStatusBadge.tsx` | 27 | Status pill | `DonationStatusBadge` | - |
| `app/admin/billing/layout.tsx` | 17 | Billing guard | `BillingLayout` | `requiredPermission="billing"` (no-op) |
| `app/admin/billing/page.tsx` | 374 | Invoice list | `BillingPage` | Second nested guard; `style.text` leaked into `className` at :133; View -> 404 |
| `app/admin/billing/create/page.tsx` | 366 | Invoice composer | `CreateBillPage` | Reads settings via raw `getDoc`; tax ignored |
| `app/admin/billing/settings/page.tsx` | 326 | Billing settings | `BillingSettingsPage` | `setDoc` forces `billingEnabled: true` at :80 |
| `app/admin/receipts/layout.tsx` | 16 | Receipts guard | `ReceiptsLayout` | Same no-op permission |
| `app/admin/receipts/page.tsx` | 311 | Receipt list | `ReceiptsPage` | Stats + text search only over the current page |
| `app/admin/receipts/create/page.tsx` | 520 | Two-step issue flow | `CreateReceiptPage` | `onSubmit={goToPay}` without `preventDefault` at :320; raw `<img>` at :270 |
| `app/admin/receipts/[receiptId]/page.tsx` | 229 | Receipt detail | `ReceiptDetailPage` | Reads `params.id` - never loads |
| `app/admin/receipts/[receiptId]/print/page.tsx` | 145 | Print view | `ReceiptPrintPage` | Same param bug; temple address hard-coded at :73,:138 |
| `app/admin/receipts/seva-settings/page.tsx` | 297 | Catalogue CRUD | `SevaSettingsPage` | Disable-not-delete by design; unused `router` at :41 |
| `app/admin/calendar/ekadashi/page.tsx` | 240 | Ekadashi editor | `EkadashiAdminPage` | PUTs to missing `/api/calendar` |
| `app/admin/calendar/festivals/page.tsx` | 263 | Festival editor | `FestivalsAdminPage` | Copy of the above with one extra field |
| `app/admin/pooja/page.tsx` | 72 | Pooja list | `PoojaPage` | Client-side filter over all poojas |
| `app/admin/pooja/create/page.tsx` | 21 | Create shell | `CreatePoojaPage`, `metadata` | Server Component |
| `app/admin/pooja/edit/[id]/page.tsx` | 34 | Edit shell | `EditPoojaPage`, `generateMetadata` | Async Server Component, awaits `params` |
| `components/admin/pooja/CreatePooja.tsx` | 315 | Pooja create form | `CreatePooja` | `category as any` at :91; requires `user.email` |
| `components/admin/pooja/EditPooja.tsx` | 180 | Pooja edit form | `EditPooja` | Loses `days`/`displayOrder`; category is free text |
| `components/admin/pooja/PoojaTable.tsx` | 267 | Pooja table | `PoojaTable` | Reorder = two sequential writes, no transaction |
| `components/admin/pooja/PoojaStats.tsx` | 70 | 4 stat cards | `PoojaStats` | Own fetch of `poojaService.getStats()` |
| `app/admin/aaradhane/page.tsx` | 80 | Aaradhane list | `AaradhanePage` | - |
| `app/admin/aaradhane/create/page.tsx` | 21 | Create shell | `CreateAaradhanePage` | Server Component |
| `app/admin/aaradhane/edit/[id]/page.tsx` | 34 | Edit shell | `EditAaradhanePage` | Server Component |
| `components/admin/aaradhane/CreateAaradhane.tsx` | 442 | Aaradhane create | `CreateAaradhane` | `// TEMPORARY` auth fallback at :116; `alert()` at :112,:140 |
| `components/admin/aaradhane/EditAaradhane.tsx` | 464 | Aaradhane edit | `EditAaradhane` | Mutates the loaded object at :45-53; near-duplicate of create |
| `components/admin/aaradhane/AaradhaneTable.tsx` | 322 | Table + 2 dialogs | `AaradhaneTable` | `err: any` at :55; reorder = two writes |
| `components/admin/aaradhane/AaradhaneStats.tsx` | 74 | 4 stat cards | `AaradhaneStats` | "Next Event" tile shows "Yes"/"None" |
| `services/billing.service.ts` | 286 | Bills repository | `billingService` | **Client** Firebase SDK; `substr` (deprecated) at :149,:199 |
| `services/receipt.service.ts` | 169 | Receipt HTTP client | `receiptService`, `ReceiptListParams`, `ReceiptReport` | `any` at :85; dead ternary at :23 |
| `services/receiptSeva.service.ts` | 98 | Catalogue HTTP client | `receiptSevaService` | `any` at :50; no `deleteSeva` by design |
| `app/api/bookings/route.ts` | 41 | Bookings collection API | `GET`, `POST` | No auth; past-date check only |
| `app/api/bookings/[id]/route.ts` | 56 | Booking item API | `GET`, `PATCH`, `DELETE` | No auth; no status whitelist |
| `app/api/donations/route.ts` | 30 | Donations collection API | `GET`, `POST` | No auth; only `amount > 0` validated |
| `app/api/donations/[id]/route.ts` | 50 | Donation item API | `GET`, `PATCH`, `DELETE` | No auth; `PATCH` forwards the raw body |
| `app/api/admin/receipts/route.ts` | 173 | Receipt list + report + create | `GET`, `POST`, `dynamic`, `revalidate` | `setHours(23,59,999)` bug at :49; report totals are page-scoped |
| `app/api/admin/receipts/[id]/route.ts` | 38 | Receipt read | `GET`, `dynamic` | Guarded |
| `app/api/admin/receipts/[id]/pdf/route.ts` | 74 | PDF render | `GET`, `dynamic` | Picks an arbitrary `settings` doc at :27 |
| `app/api/admin/receipts/[id]/send/route.ts` | 2 | Email/WhatsApp delivery | `POST` | **Stub returning success**; nothing calls it |
| `app/api/admin/receipt-sevas/route.ts` | 89 | Catalogue list/create | `GET`, `POST`, `dynamic`, `revalidate` | Writes to `sevas`, injects `duration:30`, `category:"Special"` at :79-81 |
| `app/api/admin/receipt-sevas/[id]/route.ts` | 69 | Catalogue update | `PUT`, `dynamic` | `current as any` at :48 |
| `app/api/admin/aaradhane/route.ts` | 60 | Aaradhane list/create | `GET`, `POST` | `verifyAdminUser` at :11 and :37 (da7a1fc); POST parses the body at :36 before the auth check (M07-F45) |
| `app/api/admin/aaradhane/[id]/route.ts` | 87 | Aaradhane item | `GET`, `PUT`, `DELETE` | No auth; unvalidated body |
| `app/api/public/receipts/route.ts` | 84 | Public booking lookup | `GET`, `dynamic` | Unauthenticated PII search over `sevaBookings` |
| `types/billing.ts` | 92 | Bill model | `Bill`, `BillItem`, `BillPayment`, `BillStatus`, `PaymentStatus`, `BillCreateInput`, `BillUpdateInput` | Money as `number`; imports `firebase/firestore` types |
| `types/receipt.ts` | 44 | Receipt model | `Receipt`, `ReceiptItem`, `ReceiptCreateInput`, `PaymentMode` | `PaymentMode = "upi"` only |
| `types/receipt-extensions.ts` | 13 | Delivery status | `DeliveryStatus`, `DeliveryInfo`, `ReceiptDelivery` | **Unused** - `Receipt` inlines the same shape |
| `types/receiptSeva.ts` | 15 | Catalogue model | `ReceiptSeva`, `ReceiptSevaInput` | - |
| `types/seva-booking.ts` | 37 | Booking model | `SevaBooking`, `SevaBookingStatus`, `PaymentStatus`, `SevaBookingRequest` | Dates are `string`; `PaymentStatus` name clashes with `types/billing.ts` |
| `types/finance.ts` | 105 | Finance settings | `FinanceSettings`, `BillingSettings`, `SpecialSeva`, `defaultFinanceSettings` | `specialSevas` duplicates `defaultDonationPurposes` |
| `types/donation.ts` | 119 | Donation model | `DonationRecord`, `DonationRequest`, `DonationStatus`, `PaymentMode`, `DonationPurpose`, `paymentModeOptions`, `defaultDonationPurposes` | Second `PaymentMode` in the codebase; **no `userId`** |

## Types and stores

### Types used

Owned: `types/billing.ts`, `types/receipt.ts`, `types/receipt-extensions.ts`,
`types/receiptSeva.ts`, `types/seva-booking.ts`, `types/finance.ts`, `types/donation.ts`.
Borrowed: `types/crud.ts` (`CrudColumn`, M05), `types/volunteer.ts` (`Member`, `Volunteer`, M06/M10),
`types/pooja.ts` (`DailyPooja`, `PoojaStats`, `POOJA_CATEGORIES`, `WEEKDAYS`),
`types/aaradhane.ts` (`Aaradhane`, `AaradhaneSeva`, `AaradhaneStats`),
`types/calendar.ts` (`Ekadashi`, `Festival`, `CalendarData`), `types/seva.ts` (only by dead
`SevaForm`).

### Stores touched

| Store | Kind | Read by | Written by | Notes |
|---|---|---|---|---|
| `receipts` | Firestore | `GET /api/admin/receipts`, `/[id]`, `/[id]/pdf` (Admin SDK) | `lib/receipt/admin.ts` only | `firestore.rules:102` blocks all client writes |
| `system/receiptCounter` | Firestore | receipt transaction | receipt transaction | `firestore.rules:108` denies read+write to clients |
| `sevas` | Firestore | `/api/admin/receipt-sevas` GET, rate lookup in `lib/receipt/admin.ts` | `/api/admin/receipt-sevas` POST/PUT | **This is the receipt catalogue.** `firestore.rules:76` makes it world-readable |
| `receiptSevas` | Firestore | nothing | nothing | Hardened in `firestore.rules:85` but never used - dead rules |
| `bills` | Firestore | `billingService` (client SDK) | `billingService` (client SDK) | `firestore.rules:142-144`: any authenticated user may read and create |
| `settings/financeSettings` | Firestore | `/admin/billing*`, `hooks/useFinanceSettings.ts` | `/admin/billing/settings` | Holds `billing.*`, `upi.*`, `bankTransfer.*`, `specialSevas[]` |
| `settings/*` (arbitrary doc) | Firestore | `app/api/admin/receipts/[id]/pdf/route.ts:27` | - | `orderBy("updatedAt","desc").limit(1)` - picks whichever doc was touched last |
| `sevaBookings` | Firestore | `sevaBookingService`, `/api/bookings`, `/api/public/receipts` | `sevaBookingService`, `/api/bookings` | `firestore.rules:113-117` |
| `donations` | Firestore | `donationService`, `/api/donations` | same | `firestore.rules:119-122`; owner rule keys off `userId`, which the type lacks |
| `dailyPoojas` | Firestore | `poojaService` | `poojaService` | Reached only through the client SDK |
| `aaradhane` / `aaradhanes` | Firestore | `aaradhaneService` (tries both) | `aaradhaneService`, `/api/admin/aaradhane` | Two collections for one entity - `services/aaradhane.service.ts:16-17` |
| `members`, `volunteers` | Firestore | `memberService`, `volunteerService` | same | Reached from `/admin/sevas` |
| `data/calendar.ts` | static TS module | `/admin/calendar/*` | nothing | Editing the page cannot persist |
| `settings/ekadashiCalendar`, `settings/festivalCalendar` | Firestore | `/admin/settings/*-calendar` (M05) | same | The *working* calendar editors |

## Cross-module dependencies

**Imports from other chunks**

| Target | Chunk | Used for |
|---|---|---|
| `lib/receipt/admin.ts`, `numbering.ts`, `validation.ts`, `upi.ts`, `pdf.ts` | M14 | Receipt creation, numbering, validation, UPI link, PDF |
| `lib/auth/admin-auth.ts` (`verifyAdminUser`) | M04 | Auth on the receipt, receipt-seva and (since da7a1fc) aaradhane collection routes. The file now also exports `verifyAdminUserResult` (`:50`, typed failure reason + status) and `requireAdminUser` (`:198`, ready-made `NextResponse`); no M07 route uses either yet (M07-F45) |
| `lib/admin-firebase.ts` (`getAdminFirestore`) | M01/M10 | Admin SDK access in route handlers |
| `lib/firebase.ts` (`db`) | M01/M10 | Client SDK in `billing.service.ts` and the billing pages |
| `services/sevaBooking.service.ts`, `donation.service.ts`, `pooja.service.ts`, `aaradhane.service.ts`, `volunteer.service.ts` | M10 (aaradhane also M14) | All non-receipt data access |
| `components/admin/crud/CrudTable.tsx`, `components/admin/common/*` (`AdminPageHeader`, `SearchBox`, `StatCard`, `FormDialog`), `components/admin/layout/AdminAuthGuard.tsx` | M05 | Admin CRUD framework and shell |
| `components/ui/*` (`button`, `input`, `textarea`, `table`, `dialog`, `select`, `switch`, `label`, `ImageUploader`, `form/*`) | M01 | UI kit |
| `hooks/useAuth.ts`, `hooks/useFinanceSettings.ts` | M01/M04/M05 | Firebase user + ID token, finance settings |
| `lib/format.ts` (`formatDate`) | M01 | Receipt list dates |
| `data/calendar.ts` | M11/M14 | Seed data for the orphan calendar editors |
| `types/crud.ts`, `types/volunteer.ts`, `types/pooja.ts`, `types/aaradhane.ts`, `types/calendar.ts`, `types/seva.ts` | M05/M06/M10/M14 | Shapes |
| `react-hot-toast`, `lucide-react`, `qrcode` (dynamic) | vendor | Toasts, icons, QR |

**Imported by other chunks** (from `.claude/state/inventory/import-graph.json`)

| File | Importers |
|---|---|
| `services/receipt.service.ts` | `app/admin/reports/page.tsx` (M05) |
| `types/receipt.ts` | `app/admin/reports/page.tsx`, `lib/receipt/admin.ts`, `lib/receipt/pdf.ts`, `lib/receipt/validation.ts`, `lib/services/email.ts`, `lib/services/whatsapp.ts` |
| `types/seva-booking.ts` | `app/admin/reports/page.tsx`, `services/sevaBooking.service.ts` |
| `types/donation.ts` | `app/admin/reports/page.tsx`, `components/home/DonationForm.tsx` (M02/M03), `services/donation.service.ts`, `services/proof-report/database-export.service.ts` (M14/M15) |
| `types/finance.ts` | `app/admin/settings/finance/page.tsx` (M05), `hooks/useFinanceSettings.ts` |
| `types/receiptSeva.ts` | `lib/receipt/validation.ts` |
| `types/billing.ts`, `types/receipt-extensions.ts` | nobody outside this module |

**Boundary with M14 (Aaradhane generator):** this module only does CRUD on `aaradhane` documents.
The generator that derives yearly Aaradhane dates lives in `services/aaradhane.service.ts` helpers
and the `.github/workflows/aaradhane.yml` job, both owned by M14. Admin screens here neither
trigger nor display the generator's output; `isUpcoming` is a manually-toggled boolean on the form
(`components/admin/aaradhane/CreateAaradhane.tsx:28`), and the service also computes one from
`dates` (`services/aaradhane.service.ts:20`). Those two can disagree.

## How to change it

### Add a field to a receipt (e.g. `gotra`)

1. `types/receipt.ts` - add to `Receipt` and, if the clerk types it, to `ReceiptCreateInput`.
2. `lib/receipt/validation.ts` - extend `validateReceiptCreateInput` and
   `sanitizeReceiptCreateInput` (both run on client and server).
3. `lib/receipt/admin.ts` - add it to `receiptDoc` around line 121.
4. `services/receipt.service.ts` - map it in `docToReceipt` (line 12), or it silently disappears
   on read.
5. `app/admin/receipts/create/page.tsx` - state + input + include it in the `input` object at
   line 174.
6. `app/admin/receipts/[receiptId]/page.tsx` and `app/admin/receipts/[receiptId]/print/page.tsx` - render it.
7. `lib/receipt/pdf.ts` (M14) - render it in the PDF if it belongs there.

### Add a seva to the receipt catalogue programmatically

Write to Firestore collection **`sevas`**, not `receiptSevas`. Required fields are `name`,
`amount`, `active`, `displayOrder`; `app/api/admin/receipt-sevas/route.ts:79-81` also stamps
`duration`, `category`, `imageUrl` so the doc stays compatible with the public seva list.

### Add an admin page to this area

1. Create `app/admin/<area>/page.tsx` with `"use client"` (every list page here is client-side).
2. Compose `AdminPageHeader` + `SearchBox` + `CrudTable<T>` with a sibling `columns.ts(x)` -
   copy `app/admin/donations/` which is the cleanest example.
3. Data access through a service in `services/`; never call `firebase/firestore` from the page
   (`app/admin/billing/page.tsx:13-14` is the counter-example, not the pattern).
4. Add the entry to `components/admin/layout/AdminSidebar.tsx` `allNavigation` (declared at line 37) -
   **not** `components/admin/AdminSidebar.tsx`, which is dead.
5. If it is money-related, wrap it in `app/admin/<area>/layout.tsx` with
   `<AdminAuthGuard requiredPermission="billing">` and be aware the permission is not yet enforced
   (M07-F06).

### Add a booking status

1. `types/seva-booking.ts:1-5` - extend `SevaBookingStatus`.
2. `app/admin/bookings/columns.tsx:52-67` - add the formatter case.
3. `app/admin/bookings/[id]/page.tsx:12-17` - add to `statusConfig` (a missing key falls back to
   `pending`, so it fails quietly).
4. `components/admin/bookings/BookingStatusBadge.tsx:7-19` - `styles` is a `Record<Status,string>`,
   so TypeScript will force you here.
5. `app/admin/seva-bookings/page.tsx:153-163` - the duplicate colour ladder.
6. `app/api/bookings/[id]/route.ts:43` - it forwards whatever string it is given; add a whitelist
   while you are there.

### Make invoice numbers unique

1. `services/billing.service.ts:141` - replace the `invoiceNumber` parameter with a Firestore
   transaction on a counter doc, mirroring `lib/receipt/admin.ts:45-58`.
2. Move `createBill` behind a server route (`app/api/admin/bills/route.ts`) guarded by
   `verifyAdminUser`, because the client SDK cannot be trusted with a counter.
3. `app/admin/billing/create/page.tsx:127-130` - stop passing prefix/number from the browser.
4. `firestore.rules:142-146` - tighten `bills` to `isAdmin()` for read and create.

### Make the calendar editors save

1. Either delete `app/admin/calendar/` and keep `/admin/settings/{ekadashi,festival}-calendar`
   (recommended - they already persist to `settings/*`), or
2. Create `app/api/calendar/route.ts` with a `PUT` guarded by `verifyAdminUser` that writes
   `settings/ekadashiCalendar` / `settings/festivalCalendar`, and make both pages read from
   Firestore instead of `data/calendar.ts` and surface `response.ok === false`.

### Wire up receipt delivery

1. `app/api/admin/receipts/[id]/send/route.ts` - replace the stub: verify the admin, load the
   receipt, call `sendEmail` (`lib/services/email.ts`) and/or `sendWhatsApp`
   (`lib/services/whatsapp.ts`), then write `emailDelivery` / `whatsappDelivery` onto the receipt
   doc - the fields already exist in `types/receipt.ts:26-27` and `types/receipt-extensions.ts`.
2. Add a `sendReceipt(id, token)` method to `services/receipt.service.ts` and a button on
   `app/admin/receipts/[receiptId]/page.tsx`.

## Faults, smells and risks

| id | sev | what | evidence | suggested direction |
|---|---|---|---|---|
| M07-F01 | HIGH | **STILL OPEN (2026-10-18).** Receipt detail and print pages read `params.id` while the route segment is `[receiptId]`, so `params.id` is `undefined`, the loader returns before its `finally`, and both pages hang on a spinner / "Loading receipt..." forever. Every issued receipt is unviewable, unprintable and undownloadable from the UI. | `app/admin/receipts/[receiptId]/page.tsx:32,35`; `app/admin/receipts/[receiptId]/print/page.tsx:33,36`; folder is `app/admin/receipts/[receiptId]/` | Use `params.receiptId` (or rename the segment to `[id]`); add an error state so a missing id is not silently a spinner |
| M07-F02 | HIGH | **STILL OPEN (2026-10-18).** Invoice numbers never increment. `createBill` formats `prefix + settings.billing.invoiceNumber`, and nothing writes the counter back, so every invoice in `bills` carries the same number until a human edits Billing Settings. | `services/billing.service.ts:141-160`; `app/admin/billing/create/page.tsx:127-130`; `app/admin/billing/settings/page.tsx:180-185` (only manual editor) | Allocate in a Firestore transaction on a counter doc, server-side, as `lib/receipt/admin.ts:45-58` already does |
| M07-F03 | HIGH | **STILL OPEN (2026-10-18).** Bills are created, read, updated and deleted from the browser with the client Firebase SDK, and `firestore.rules` lets **any authenticated user** read every invoice and create new ones. Customer name, email, phone, address and GSTIN are exposed to every logged-in devotee. | `services/billing.service.ts:17,184`; `firestore.rules:142-144` (`allow read: if isAuthenticated(); allow create: if isAuthenticated();`) | Move billing behind `/api/admin/bills` with `verifyAdminUser`; set the rules to `isAdmin()` |
| M07-F04 | HIGH | **STILL OPEN (2026-10-18).** The admin Ekadashi and Festival editors PUT to `/api/calendar`, which does not exist. `fetch` resolves 404 rather than throwing, so the `catch` never runs, no error is shown, and the edit is lost on refresh while the UI reports success. | `app/admin/calendar/ekadashi/page.tsx:34,39-41`; `app/admin/calendar/festivals/page.tsx:31,36-38`; `ls app/api` has no `calendar` | Delete these two pages in favour of `/admin/settings/{ekadashi,festival}-calendar`, or implement the route and check `response.ok` |
| M07-F05 | MEDIUM | **STILL OPEN (2026-10-18), narrowed:** `/api/admin/aaradhane` (GET+POST) gained `verifyAdminUser` in da7a1fc (`app/api/admin/aaradhane/route.ts:11,37`); the other five remain unguarded. Original: `/api/bookings`, `/api/bookings/[id]`, `/api/donations`, `/api/donations/[id]`, `/api/admin/aaradhane` and `/api/admin/aaradhane/[id]` have no authentication at all. **Corrected 2026-09-19:** they are not exploitable today only by accident - each one delegates to a service built on the *client* Firebase SDK (`services/sevaBooking.service.ts:1-2`, `donation.service.ts:1-2`, `aaradhane.service.ts:12-13`), which runs server-side with no signed-in user, so `firestore.rules:113-123` denies the privileged operations: `GET /api/bookings` and `GET /api/donations` return `[]` (the services swallow the permission error), and `PATCH`/`DELETE` throw into a 500. Only `GET /api/admin/aaradhane` really answers, because `aaradhane` is `allow read: if true` public data. The hole becomes real the moment anyone swaps these services to the Admin SDK, as `/api/public/receipts` already does (M07-F07). | `app/api/bookings/route.ts:2,4,6`; `app/api/bookings/[id]/route.ts:21`; `app/api/donations/route.ts:2,4`; `app/api/donations/[id]/route.ts:37`; `app/api/admin/aaradhane/[id]/route.ts:40,67`; `services/sevaBooking.service.ts:40-50`; `firestore.rules:113-123` (the former `app/api/admin/aaradhane/route.ts:9,30` citation is fixed - now guarded at `:11,37`) | Gate every remaining one with `requireAdminUser` (`lib/auth/admin-auth.ts:198`) *before* moving them to the Admin SDK, keeping only the devotee-facing `POST` paths open with rate limiting. See also M07-F42 - as written these six routes are inert |
| M07-F06 | HIGH | **STILL OPEN (2026-10-18).** `requiredPermission="billing"` is decorative: every case in `AdminAuthGuard`'s switch assigns `hasPermission = canAccessAdmin`, so any admin-capable role reaches Billing and the Receipt Book. | `components/admin/layout/AdminAuthGuard.tsx:130-144` (`case "billing": hasPermission = canAccessAdmin`) | Implement a real role->permission map; until then do not claim finance screens are restricted |
| M07-F07 | HIGH | **STILL OPEN (2026-10-18).** `GET /api/public/receipts?search=` is unauthenticated and scans the 1000 newest `sevaBookings`, returning up to 20 full records - name, email, phone, payment reference - for any substring. A two-character query enumerates devotee contact details. | `app/api/public/receipts/route.ts:6,20,28,45-64` | Require an exact match on a non-guessable token (booking id + phone), rate limit, and return only the fields a devotee needs |
| M07-F08 | HIGH | **STILL OPEN (2026-10-18).** `POST /api/admin/receipts/[id]/send` is a two-line stub that returns `{success:true}` without sending anything, and `lib/services/email.ts` (nodemailer over `EMAIL_HOST/PORT/USER/PASS`, attaching `buildReceiptPdf` output) and `lib/services/whatsapp.ts` (WhatsApp Cloud API over `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID`) are fully written but dead - both are real dependencies (`package.json:82` nodemailer, `:110` @types/nodemailer - moved from `:56`/`:81` by the 2026-09/10 Prisma/Supabase dependency additions). The `emailDelivery` / `whatsappDelivery` fields on `Receipt` are never written. | `app/api/admin/receipts/[id]/send/route.ts:1`; `lib/services/email.ts:1-10`; `lib/services/whatsapp.ts:1-8`; no importer of either (`grep -rl "lib/services/email\|lib/services/whatsapp"` over app/components/lib/services/hooks/scripts returns nothing, re-run 2026-10-18); `types/receipt.ts:26-27` | Either implement it (see "Wire up receipt delivery") or delete the route, the two lib files and the unused types so nobody builds on a lie |
| M07-F09 | HIGH | **STILL OPEN (2026-10-18).** `firestore.rules` hardens a `receiptSevas` collection that no code touches, while the catalogue actually lives in `sevas`, which is `allow read: if true` - world-readable, and the validation rules (non-empty name, non-negative amount, no delete) are never applied. | `firestore.rules:85-95` vs `app/api/admin/receipt-sevas/route.ts:13` (`= "sevas"`) and `lib/receipt/admin.ts:32` | Point the rules at `sevas`, or migrate the catalogue to `receiptSevas`. Do not leave both |
| M07-F10 | HIGH | **STILL OPEN (2026-10-18).** `/admin/sevas` is the Member/Volunteer register, not a seva catalogue: the page component is `VolunteerPage`, it uses `memberService`/`volunteerService`, and its columns file exports `memberColumns`/`volunteerColumns`. The real seva-catalogue components exist but are orphaned. | `app/admin/sevas/page.tsx:9,11,13,122`; `app/admin/sevas/columns.ts:4,48`; `components/admin/sevas/SevaForm.tsx:25` and `DeleteSevaDialog.tsx:12` have no importer | Move the register to `/admin/members`, and either wire `SevaForm`/`DeleteSevaDialog` into a real `/admin/sevas` or delete them |
| M07-F11 | MEDIUM | **STILL OPEN (2026-10-18).** Two full booking UIs over one collection: `/admin/bookings` (CrudTable) and `/admin/seva-bookings` (hand-rolled table). They duplicate the status ladder and the colour scheme, and only one is in the sidebar. A third, dead copy sits under `components/`. | `app/admin/bookings/page.tsx:182`; `app/admin/seva-bookings/page.tsx:10,88-200`; `components/admin/bookings/[id]/page.tsx:13`; sidebar lists only `/admin/bookings` (`components/admin/layout/AdminSidebar.tsx:57`) | Keep `/admin/bookings`; delete `/admin/seva-bookings` and the whole `components/admin/bookings/[id]` folder |
| M07-F12 | MEDIUM | **STILL OPEN (2026-10-18).** No booking state machine and no notifications. Any status can jump to any other, `CrudTable`'s pencil silently confirms, and nothing informs the devotee of a confirmation or cancellation. | `app/admin/bookings/[id]/page.tsx:218-248`; `app/admin/bookings/page.tsx:191-195`; no notification call anywhere in the module | Add allowed-transition guards in `sevaBookingService`, and a notification hook on confirm/cancel |
| M07-F13 | MEDIUM | **STILL OPEN (2026-10-18).** `EditPooja` cannot edit `days` or `displayOrder`, and turns `category` - a `PoojaCategory` union with a `<Select>` on the create form - into a free-text `<Input>` cast with `as PoojaCategory`. An editor can write a category that no filter matches. | `components/admin/pooja/EditPooja.tsx:68-77,129-136` vs `components/admin/pooja/CreatePooja.tsx:21,171-180,205-209,248` | Share one `PoojaForm` between create and edit, as `SevaForm` was clearly meant to do |
| M07-F14 | MEDIUM | **STILL OPEN (2026-10-18).** `CreateAaradhane` falls back to `"admin@temple.com"` when no user is signed in, over a `// TEMPORARY ... for testing` comment, forging the audit trail. It also reports errors with `alert()`. | `components/admin/aaradhane/CreateAaradhane.tsx:116-117,112,140` | Require `user.email`, as `CreatePooja.tsx:78-81` already does; replace `alert` with `react-hot-toast` |
| M07-F15 | MEDIUM | **STILL OPEN (2026-10-18).** `aaradhaneService` reads and deletes across two collections, `aaradhane` and `aaradhanes`, chosen by fallback. Which one a record lands in depends on history, and `firestore.rules` duplicates the rule block for both. | `services/aaradhane.service.ts:16-17,164,175,249,262`; `firestore.rules:125,130` | Pick one, migrate, delete the other and its rule |
| M07-F16 | MEDIUM | **STILL OPEN (2026-10-18).** Reordering poojas and aaradhanes issues two independent `updateDoc` calls with no transaction. A failure between them leaves two rows with the same `displayOrder`. | `components/admin/pooja/PoojaTable.tsx:70-77`; `components/admin/aaradhane/AaradhaneTable.tsx:74-81` | Use a Firestore batch/transaction, or a single server action |
| M07-F17 | MEDIUM | **STILL OPEN (2026-10-18).** Receipt list statistics and search are page-scoped but presented as totals. "Total Receipts", "Total Amount" and "Collected Today" are computed over the 50 rows currently loaded, and `SearchBox` filters only those rows. `hasMore` is guessed from `data.length === pageSize`. | `app/admin/receipts/page.tsx:45,85-96,98-109` | Compute totals server-side - but note the existing `report=true` aggregate at `app/api/admin/receipts/route.ts:67` is itself broken and must be fixed first (M07-F41). Also make search a server parameter: `ReceiptListParams.search` is sent (`services/receipt.service.ts:62`) but the route never reads it |
| M07-F18 | MEDIUM | **STILL OPEN (2026-10-18).** The receipt "to" date filter is wrong: `toDate.setHours(23,59,999)` sets **seconds** to 999, pushing the boundary to roughly 00:15 the next day, so receipts from the following morning leak into the range. | `app/api/admin/receipts/route.ts:49` | `setHours(23,59,59,999)` |
| M07-F19 | MEDIUM | **STILL OPEN (2026-10-18).** The receipt PDF picks its temple header from whichever document in the whole `settings` collection was updated last, so editing homepage or finance settings can change what prints on a receipt. | `app/api/admin/receipts/[id]/pdf/route.ts:27` (`db.collection("settings").orderBy("updatedAt","desc").limit(1)`) | Read a named doc, e.g. `settings/templeSettings`, and keep `FALLBACK_TEMPLE` as the only fallback |
| M07-F20 | MEDIUM | **STILL OPEN (2026-10-18).** Dead code across the module: `components/admin/sevas/{SevaForm,DeleteSevaDialog,constants}`, `components/admin/bookings/{[id]/page,BookingDetails,BookingStatusBadge}`, `types/receipt-extensions.ts`, `lib/services/{email,whatsapp}.ts`, plus the duplicate `components/admin/AdminSidebar.tsx` / `AdminHeader.tsx`. Roughly 600 lines that read as live features. | no importers found by `grep -rn` for each; `components/admin/bookings/[id]/page.tsx` is a `page.tsx` outside `app/` | Delete, or wire up deliberately |
| M07-F21 | MEDIUM | **STILL OPEN (2026-10-18).** `/admin/calendar/ekadashi`, `/admin/calendar/festivals` and `/admin/seva-bookings` are not in the sidebar, so they are only reachable by typing a URL - yet they are fully rendered pages that appear to work. | `components/admin/layout/AdminSidebar.tsx:45-90` lists neither | Remove the routes, or add them to the nav once they actually persist |
| M07-F22 | MEDIUM | **STILL OPEN (2026-10-18).** AGENTS.md forbids `any`, yet the module uses it in **eleven places across ten files**, including on money paths. | `services/receipt.service.ts:85`; `services/receiptSeva.service.ts:50`; `app/api/admin/receipts/route.ts:79,85`; `app/api/admin/receipt-sevas/[id]/route.ts:48`; `components/admin/pooja/CreatePooja.tsx:91`; `components/admin/aaradhane/AaradhaneTable.tsx:55`; `app/admin/sevas/new/page.tsx:35`; `app/admin/sevas/[id]/edit/page.tsx:82`; `app/admin/billing/page.tsx:122,139` | Replace with `unknown` + narrowing, or the real types that already exist |
| M07-F23 | MEDIUM | **STILL OPEN (2026-10-18).** AGENTS.md says "No Direct Firebase Calls - use services only", but three billing pages import `doc`/`getDoc`/`setDoc` from `firebase/firestore` directly. | `app/admin/billing/page.tsx:13-14,49-51`; `app/admin/billing/create/page.tsx:8-9,47-48`; `app/admin/billing/settings/page.tsx:7-8,45-46,75-84` | Route through `hooks/useFinanceSettings.ts` / a `financeSettings.service` |
| M07-F24 | MEDIUM | **STILL OPEN (2026-10-18).** Donation reconciliation is incomplete: `receiptNumber` and `adminRemarks` are rendered read-only and no screen can set them; `collectedBy` is on the model and written as `""` on create but **never rendered anywhere** (`grep collectedBy` hits only `types/donation.ts:36,50` and `services/donation.service.ts:29,39`), and `updateDonationStatus` never writes it. Donations are also completely disconnected from the Receipt Book. | `types/donation.ts:32-38`; `services/donation.service.ts:29,39,66-69`; `components/admin/donations/DonationDetails.tsx:88-93,106-114` | Add the fields to the detail form; on "received", issue a receipt through `createReceiptWithAdmin` |
| M07-F25 | MEDIUM | **STILL OPEN (2026-10-18).** `firestore.rules` grants devotees read of their own donations via `isOwner(resource.data.userId)`, but `DonationRecord` has no `userId` and `createDonation` never writes one, so the rule can only ever deny. | `firestore.rules:120`; `types/donation.ts:13-42`; `services/donation.service.ts:39` | Persist `userId` on create, or drop the owner clause and say donations are admin-only |
| M07-F26 | MEDIUM | **STILL OPEN (2026-10-18).** `AdminAuthGuard` is applied twice on `/admin/billing` - once in the layout and again inside the page - doubling the auth round-trip and the loading spinner. | `app/admin/billing/layout.tsx:12` and `app/admin/billing/page.tsx:369` | Keep the layout guard only |
| M07-F27 | MEDIUM | **STILL OPEN (2026-10-18).** Money is plain JavaScript `number` throughout (`sevaAmount`, `amount`, `rate`, `subtotal`, `totalAmount`, `balanceDue`). Any non-integer rate makes `quantity * rate` and the running sums drift, and `Math.max(0, newBalanceDue)` hides a negative residue instead of flagging an overpayment. | `types/billing.ts:42-47`; `types/receipt.ts:19-20`; `lib/receipt/validation.ts:6-16`; `services/billing.service.ts:245-261` | Store paise as integers, or round to 2 dp at every boundary; validate that a payment never exceeds the balance |
| M07-F28 | LOW | **STILL OPEN (2026-10-18).** `getStatusBadge` interpolates `style.text` - a label like `"Draft"` - into `className`, so every badge carries a junk class such as `Draft`. It is cosmetic only - the colour still lands because `bg` already bundles both (`bg: "bg-stone-100 text-stone-700"`) - but it will collide the day someone adds a real `text` colour. | `app/admin/billing/page.tsx:122-137` (`${style.bg} ${style.text}` where `text: "Draft"`) | Rename the field to `label`, or put the colour class in `bg` |
| M07-F29 | LOW | **STILL OPEN (2026-10-18).** The receipt create form is `<form onSubmit={goToPay}>`, and `goToPay()` takes no event and never calls `preventDefault()`, so submitting by pressing Enter triggers a native form submission and a full page reload, losing the entered receipt. | `app/admin/receipts/create/page.tsx:156-163,320` | `function goToPay(e: React.FormEvent) { e.preventDefault(); ... }` |
| M07-F30 | LOW | **STILL OPEN (2026-10-18).** Saving Billing Settings unconditionally writes `billingEnabled: true`, silently turning the whole billing module on for everyone. | `app/admin/billing/settings/page.tsx:76-84` | Leave the flag to Finance Settings, or expose it as an explicit toggle on this page |
| M07-F31 | LOW | **STILL OPEN (2026-10-18).** `app/admin/billing/page.tsx:332` navigates to `/admin/billing/${bill.id}`, but `app/admin/billing/` contains only `create/`, `settings/`, `layout.tsx` and `page.tsx`. Every "View" click is a 404. | `ls app/admin/billing` | Build the detail page or remove the button |
| M07-F32 | LOW | **STILL OPEN (2026-10-18).** `formatPdfAmount` is defined twice with the same body, and every page redefines its own `formatCurrency`. Currency formatting is duplicated at least six times. | `lib/receipt/upi.ts:35` and `lib/receipt/pdf.ts:197`; `formatCurrency` in `app/admin/receipts/{page,create/page,[receiptId]/page,[receiptId]/print/page,seva-settings/page}.tsx` and `app/admin/billing/page.tsx:148` | One `lib/format.ts` helper (the file already exists) |
| M07-F33 | LOW | **STILL OPEN (2026-10-18).** `BookingDetails` and `DonationDetails` refresh with `window.location.reload()` after a mutation - a full document reload instead of re-fetching state. | `components/admin/bookings/BookingDetails.tsx:34`; `components/admin/donations/DonationDetails.tsx:34` | Lift state or call `router.refresh()` |
| M07-F34 | LOW | **STILL OPEN (2026-10-18).** `services/receipt.service.ts:23` reads `paymentMode: data.paymentMode === "upi" ? "upi" : "upi"` - a ternary with identical branches that silently rewrites any future payment mode to UPI. | `services/receipt.service.ts:23` | Decide whether non-UPI modes are ever coming; if yes, widen `PaymentMode` and map honestly |
| M07-F35 | LOW | **STILL OPEN (2026-10-18).** Accessibility gaps on the hand-written tables: bulk-select checkboxes with no label, icon-only action buttons with only a `title`, `key={index}` on editable calendar rows, and native `<select>` filters with no `<label>`. | `app/admin/sevas/page.tsx:182-187,229-245`; `app/admin/billing/page.tsx:331-353`; `app/admin/calendar/ekadashi/page.tsx:165`; `app/admin/bookings/page.tsx:127-152` | Add `aria-label` on icon buttons and checkboxes, label the filters, key rows by a stable id |
| M07-F36 | LOW | **STILL OPEN (2026-10-18).** Every list loads its whole collection into the browser and filters there - bookings, donations, poojas, aaradhanes, bills, members/volunteers. Only receipts paginate. | `app/admin/bookings/page.tsx:29-31,45-71`; `app/admin/donations/page.tsx:26-28,44-70`; `app/admin/billing/page.tsx:31,70-84`; `services/sevaBooking.service.ts:43` | Push search/filter/paging into the services and the rules-level queries |
| M07-F37 | LOW | **MOVED (2026-10-18)** - see evidence. `verifyAdminUser` uses a blocklist (`devotee`, `volunteer`) rather than an allowlist, so a user whose `role` is empty, misspelled or newly invented passes as an admin on every receipt route. | **MOVED (2026-10-18)** to `lib/auth/admin-auth.ts:39` (`BLOCKED_ROLES`) and `:147-156` (check) after the file was restructured into `verifyAdminUserResult`; logic unchanged, still a blocklist. Was `lib/auth/admin-auth.ts:18,60-64` | Invert to an explicit allowlist of admin roles |
| M07-F38 | LOW | **STILL OPEN (2026-10-18).** Errors are swallowed into `console.error` on most non-receipt paths, leaving the UI in a silent empty state - `app/admin/pooja/page.tsx:19-21`, `PoojaStats:18`, `AaradhaneStats:19`, `EditPooja:52,80`, `EditAaradhane:56`. | as listed | Surface a toast or an inline error region; `react-hot-toast` is already a dependency |
| M07-F39 | LOW | **STILL OPEN (2026-10-18).** `services/billing.service.ts` uses the deprecated `String.prototype.substr` and `Date.now().toString()` as an id, which collides for two items created in the same millisecond. | `services/billing.service.ts:149,199,242` | `crypto.randomUUID()` |
| M07-F40 | LOW | **STILL OPEN (2026-10-18).** Doc-vs-code drift in `docs/DATA-MODEL.md`: it documents `sevas` as the public catalogue with a `SevaCategory` union (line 76-118) and never mentions `receipts`, `bills`, `system/receiptCounter` or `dailyPoojas`; it also names the booking field `devoteeName` (line 821) where the code uses `userName`. | `docs/DATA-MODEL.md:76-118,820-823` vs `types/seva-booking.ts:15` and `firestore.rules:102,108,142` | Regenerate the data-model doc from the rules file and the services |
| M07-F41 | HIGH | **STILL OPEN (2026-10-18).** **The receipt report aggregates exactly one receipt.** `getReceiptReport` sends only `from`, `to` and `report=true` - never `pageSize`. In the route, `Number(url.searchParams.get("pageSize"))` on an absent param is `Number(null) === 0`, which *passes* `Number.isInteger`, so the `: 50` default never fires and `pageSize` clamps to `Math.min(Math.max(0,1),10000) === 1`. The query then runs `.limit(1)` and the whole summary / seva-wise / timeline aggregate is computed over that single newest receipt. Every collection total on the admin Reports page is wrong, silently, with no error. | `services/receipt.service.ts:88-95` (no `pageSize` in the query); `app/api/admin/receipts/route.ts:31,36` (`rawPageSize`), `:58-61` (`.limit(pageSize)`), `:67-132` (aggregate over `receipts`) | Guard with `rawPageSize > 0`, and for `report=true` ignore paging entirely - aggregate the full filtered range (or use a Firestore aggregation query) |
| M07-F42 | MEDIUM | **STILL OPEN (2026-10-18).** The six unauthenticated route handlers of M07-F05 are not merely unguarded, they are **inert**: they delegate to client-SDK services that have no credentials on the server, so the rules deny them. `GET /api/bookings` and `GET /api/donations` always answer `[]` because `getAllBookings` / `getDonations` catch the permission error and return an empty array; `PATCH` / `DELETE` throw into a 500. Nothing in the app calls them - the admin pages use the services directly - so they are dead surface that reads as a working API. **2026-10-18:** `GET /api/admin/aaradhane` now needs an admin Bearer token (da7a1fc) but is still uncalled (`grep -rn "api/admin/aaradhane"` hits only the route files' own comments); its POST still runs `aaradhaneService.createAaradhane` on the client SDK, so even an authenticated admin gets a 500. | `app/api/bookings/route.ts:2,6`; `services/sevaBooking.service.ts:1-2,40-50`; `services/donation.service.ts:1-2,43-51`; `firestore.rules:114,120` | Delete them, or rebuild them on `getAdminFirestore()` **behind** `verifyAdminUser` - they are the natural API layer for a React Native client (see Portability notes) |
| M07-F43 | MEDIUM | **STILL OPEN (2026-10-18).** `aaradhaneService.deleteAaradhane`'s fallback to the `aaradhanes` collection is unreachable. Firestore's `deleteDoc` resolves successfully on a missing document, so the first `try` always returns at line 252 and the second branch is dead. A record that lives only in `aaradhanes` is never deleted, yet `AaradhaneTable` shows "Aaradhane deleted successfully" and the row returns on refresh. | `services/aaradhane.service.ts:244-273` (esp. `:250-252` then `:260-270`); `components/admin/aaradhane/AaradhaneTable.tsx:52-54` | Read the doc first to decide the collection, or delete from both; better, finish the M07-F15 migration to one collection. File is owned by M10/M14 - route the fix there |
| M07-F44 | MEDIUM | **STILL OPEN (2026-10-18).** `billingService.addPayment` is a read-modify-write with no transaction: it reads the bill, appends to `payments` and writes back recomputed `amountPaid` / `balanceDue` in a single `updateDoc`. Two concurrent payments lose one, and the bill's money silently disagrees with its receipts. (Data flow 4 previously mis-attributed this to M07-F03.) | `services/billing.service.ts:232-265` (`getBill` at `:237`, `updateDoc` at `:258`) | Wrap in `runTransaction`, or move billing behind a server route as M07-F03 proposes |
| M07-F45 | LOW | **NEW (2026-10-18).** Every guarded route in this module still calls the backwards-compatible `verifyAdminUser`, which collapses all the failure reasons of the new `verifyAdminUserResult` (missing/expired/invalid token, missing profile, inactive user, blocked role, *Firebase Admin not configured*) into `null`, so each route answers a blanket 401 - a server misconfiguration that M04 now reports as 503 looks like a bad login here. The AI-settings routes adopted the richer helpers in the same period; the Receipt Book did not. Separately, the newly guarded `POST /api/admin/aaradhane` parses the JSON body before checking auth, so an anonymous caller with a malformed body gets a 500 instead of a 401. | `lib/auth/admin-auth.ts:50,186-191,198-215`; `app/api/admin/receipts/route.ts:21,149`; `app/api/admin/receipts/[id]/route.ts:21`; `app/api/admin/receipts/[id]/pdf/route.ts:49`; `app/api/admin/receipt-sevas/route.ts:22,55`; `app/api/admin/receipt-sevas/[id]/route.ts:22`; `app/api/admin/aaradhane/route.ts:11,36-37` | Make `const auth = await requireAdminUser(request); if (!auth.ok) return auth.response;` the first statement of each handler |

## Portability notes (React Native / cross-platform)

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| `types/*.ts` (all seven) | none | **reuse as-is** | Except `types/billing.ts:1`, which imports `Timestamp`/`FieldValue` from `firebase/firestore` - swap for ISO strings at the boundary |
| `lib/receipt/validation.ts`, `lib/receipt/numbering.ts`, `lib/receipt/upi.ts` | none | **reuse as-is** | Pure functions; the UPI deep link is *more* useful on mobile (`Linking.openURL`) |
| `services/receipt.service.ts`, `services/receiptSeva.service.ts` | `fetch` + relative `BASE_URL` | **adapt** | `fetch` exists in RN; only the base URL must become absolute and configurable |
| `services/billing.service.ts` | `firebase/firestore` web SDK, `@/lib/firebase` | **adapt** | Use `@react-native-firebase/firestore` or, better, move it behind an HTTP route first (see M07-F03) |
| All route handlers under `app/api/**` | `next/server` (`NextRequest`, `NextResponse`), `server-only`, Node `Buffer`/`fs` | **reuse as the backend** | These stay on the server and become the mobile client's API. No rewrite needed - only auth hardening |
| `lib/receipt/pdf.ts` | Node `fs/promises`, `pdf-lib`, filesystem font/logo loading | **reuse server-side** | A mobile client should download the PDF from `/api/admin/receipts/[id]/pdf`, never generate it locally |
| Every `app/admin/**/page.tsx` | `"use client"`, `next/navigation` (`useRouter`, `useParams`, `useSearchParams`), `next/link`, Tailwind classes, `<table>`/`<div>`/`<select>` | **rewrite** | Web DOM and Next routing throughout. Business logic is thin; the JSX is not portable |
| `app/admin/pooja/{create,edit}` and `app/admin/aaradhane/{create,edit}` shells | Server Components, `Metadata`, `generateMetadata`, `notFound()` | **rewrite** | Server Components have no RN equivalent; the inner `Create*`/`Edit*` client components carry the real logic and port more easily |
| `components/admin/{pooja,aaradhane,bookings,donations,sevas}/*` | Tailwind, `lucide-react`, `components/ui/*` (DOM), `react-hot-toast` | **rewrite** | Extract the handlers and validation into hooks first; the markup is a loss |
| Receipt print page | `window.print()`, `@media print` CSS, `position:absolute` | **rewrite** | No print pipeline in RN - use the PDF endpoint plus `expo-print` / share sheet |
| Receipt PDF download | `window.URL.createObjectURL`, `document.createElement("a")`, `a.click()` | **rewrite** | Replace with `expo-file-system` download + `Sharing.shareAsync` |
| UPI QR generation | `await import("qrcode")` -> canvas data URL -> `<img>` | **adapt** | Swap for `react-native-qrcode-svg`; the URL builder in `lib/receipt/upi.ts` is already shared |
| Member/volunteer print | `window.open` + `document.write` | **rewrite** | Build a PDF server-side instead |
| `window.confirm` / `window.alert` delete guards | DOM dialogs | **rewrite** | `Alert.alert`; note `PoojaTable`/`AaradhaneTable` already use a proper `Dialog`, so copy that pattern |
| `AdminAuthGuard`, `useAuth`, ID-token fetch | `next/navigation` redirects | **adapt** | The token mechanics (`user.getIdToken()` -> `Authorization: Bearer`) port unchanged; only the redirect does not |
| `data/calendar.ts` | none | **reuse as-is** | Plain data - but see M07-F04 before relying on it |

**Status of `apps/mobile` (2026-10-18).** The Expo app added in 2026-09/10 (`0cb71b6`, `5813fc9`) imports no file of this module and calls none of its routes. It reads Supabase tables directly with the anon client (`apps/mobile/lib/api.ts:5` `sevas`, `:28` `daily_poojas`). Those tables are one-off ETL copies of the Firestore `sevas` collection (the Receipt Book catalogue that `/api/admin/receipt-sevas` writes) and of `dailyPoojas` (what `/admin/pooja` writes), made by `scripts/migrate-sevas.ts:44` and `scripts/migrate-daily-poojas.ts:46`. So a devotee on the phone sees data an admin authored here, but only as of the last migration run: nothing in this module writes Supabase, and an edit in `/admin/pooja` or Seva Settings does not reach the app until the script is run again. Receipts, bookings, donations, bills and aaradhane are not on the phone at all.

**What a React Native client would need from this module.** The Receipt Book is already almost
API-first and is the natural first mobile screen: `GET/POST /api/admin/receipts`,
`GET /api/admin/receipts/[id]`, `GET /api/admin/receipts/[id]/pdf` and
`GET/POST/PUT /api/admin/receipt-sevas` are all token-authenticated JSON, and
`services/receipt.service.ts` / `receiptSeva.service.ts` are thin `fetch` wrappers that move over
with a base-URL change. `lib/receipt/validation.ts` and `lib/receipt/upi.ts` should be lifted into
a shared `packages/core` so the phone runs the same rules as the server.

Everything else needs an API layer built before a mobile client is possible: bookings, donations,
poojas, aaradhanes, members and bills are reached straight from the browser through the Firebase
web SDK, with authorisation delegated entirely to `firestore.rules`. Either add
`/api/admin/{bookings,donations,poojas,aaradhane,bills}` route handlers guarded by
`verifyAdminUser` - which also fixes M07-F03 and M07-F05 - or standardise on
`@react-native-firebase` and accept that the rules file is the only access control. The first is
strongly preferable: it gives one enforcement point for web and mobile, and it is where the
server-side money logic already lives.

Three things must not be ported to the device under any circumstances: receipt-number allocation
(`lib/receipt/admin.ts:45-58`), seva-rate resolution and total computation
(`lib/receipt/admin.ts:78-117`), and PDF rendering. The current architecture already keeps all
three server-side; preserve that boundary.

## Coverage

filesExpected 68, filesMentioned 68, omitted: none (re-counted 2026-10-18 from the regenerated `.claude/state/inventory/M07.json`: no files added or deleted, one modified).

Every file in `.claude/state/inventory/M07.json` has a row in **Key files**. All cited paths were
checked against disk by script on 2026-09-19. Four strings that look like paths are deliberately
not on disk and are labelled as such where they appear: `app/api/calendar` and
`app/api/calendar/route.ts` (the missing route behind M07-F04), `app/api/admin/bills/route.ts`
(proposed in a recipe), and `/admin/billing/[id]` (the 404 in M07-F31).

## UNCLEAR

- **UNCLEAR: whether `/admin/seva-bookings` or `/admin/bookings` is the intended survivor.** Both
  are live routes over `sevaBookings`; only `/admin/bookings` is in the sidebar
  (`components/admin/layout/AdminSidebar.tsx:57`), but `/admin/seva-bookings` has the friendlier
  inline workflow. A product decision, not a code question.
- **UNCLEAR: whether `sevas` is meant to be one collection or two.** The public seva list (M03),
  the Receipt Book catalogue and `docs/DATA-MODEL.md:76` all describe `sevas` differently, and
  `app/api/admin/receipt-sevas/route.ts:79-81` pads new docs with `duration`/`category`/`imageUrl`
  to keep the public list happy. Settled by reading what `lib/sevas.ts` and the public seva page
  (M03) expect.
- **UNCLEAR: whether Billing is meant to ship at all.** It is disabled by default
  (`types/finance.ts:48`), has no detail page, no payment UI, broken numbering and weaker security
  than the Receipt Book, which covers the same ground for seva money. Settled by asking whether the
  temple issues GST invoices to vendors.
- **Partly settled 2026-10-18: whether the `bills` rules are intentional.** `allow create: if isAuthenticated()`
  (`firestore.rules:144`) arrived in `a0576c6` (2026-07-10, "Add settings and bills collections to
  Firestore rules ... This fixes the 'Failed to load/save settings' error"), unchanged since. It was a
  quick unblock for the billing screens, not a devotee self-billing design - so M07-F03 stands and
  tightening to `isAdmin()` breaks nothing intended.
- **UNCLEAR: how `Aaradhane.isUpcoming` is supposed to be maintained.** It is a manual switch on
  both admin forms and also derived from `dates` inside `services/aaradhane.service.ts:20`.
  Whichever the M14 generator writes should win; the forms should then show it read-only.

## Verification log (2026-09-19)

Skeptic pass over this file: 262 path tokens extracted and checked on disk (252 real, 8 are globs or
the deliberately-missing paths already labelled under Coverage), 129 `path:line` citations checked
for range and 40+ opened and read. Changes made:

- F05 severity HIGH -> MEDIUM, claim rewritten -> the six routes are unauthenticated **but not
  exploitable as written**, because they call client-SDK services that have no server-side
  credentials and `firestore.rules:114,120` deny the reads and writes -> `services/sevaBooking.service.ts:1-2,40-50`, `services/donation.service.ts:1-2,43-51`, `lib/firebase.ts:1-3`.
- New finding M07-F41 (HIGH) added: the `report=true` aggregate runs with `pageSize === 1`, so the
  admin Reports page totals cover one receipt -> `services/receipt.service.ts:88-95` sends no
  `pageSize`, `app/api/admin/receipts/route.ts:31,36` turns the absent param into `Number(null) === 0`,
  which passes `Number.isInteger`, clamping to 1 at `:58-61`.
- New finding M07-F42 (MEDIUM) added: those same six routes are inert and uncalled -> evidence as F05.
- New finding M07-F43 (MEDIUM) added: `deleteAaradhane`'s `aaradhanes` fallback is unreachable
  because `deleteDoc` resolves on a missing doc -> `services/aaradhane.service.ts:244-273`.
- New finding M07-F44 (MEDIUM) added: `addPayment` read-modify-write race, which Data flow 4 had
  mis-attributed to F03 -> `services/billing.service.ts:232-265`.
- Data flow 4 step 3 cross-reference "(M07-F03)" -> "(M07-F44, not F03)" -> `services/billing.service.ts:258`.
- F08 evidence thinned out -> now names nodemailer / WhatsApp Cloud API and the env vars each dead
  file expects -> `lib/services/email.ts:1-10`, `lib/services/whatsapp.ts:1-8`, `package.json:56,81`.
- F17 suggested direction claimed the `report=true` aggregate was a ready-made fix -> now flags that
  the aggregate is itself broken (F41) -> `app/api/admin/receipts/route.ts:67`.
- F22 "seven places" -> "eleven places across ten files", missing `app/admin/sevas/[id]/edit/page.tsx:82`
  added -> full `any` sweep of the module roots returns 11 hits.
- F24 claimed `collectedBy` is rendered -> corrected: it is written as `""` on create and rendered
  nowhere -> `grep -rn collectedBy` hits only `types/donation.ts:36,50` and `services/donation.service.ts:29,39`.
- F28 said the badge loses its text colour -> corrected to cosmetic-only, because `bg` already
  carries `text-stone-700` etc. -> `app/admin/billing/page.tsx:123-128,133`.
- Entry-points table: the six no-auth route rows now say which of them actually answer -> `firestore.rules:114,120,126`.
- "Add an admin page" recipe said `allNavigation` is "around line 45" -> "declared at line 37" ->
  `components/admin/layout/AdminSidebar.tsx:37`.
- Two bullets added to "Answers questions about" for the two new questions this file now answers.
- Data flow 7 gained step 5, which actually answers the chunk's focus question "how does the admin
  calendar feed the public calendar" -> it does not; the public pages import the same static module
  (`app/calendar/page.tsx:3`, plus `components/calendar/EkadashiTable.tsx`, `FestivalTable.tsx`,
  `NextEkadashiCard.tsx`, `lib/festival-utils.ts`).
- Two path shorthands expanded to full paths so the path script reports zero broken citations:
  the ellipsis shorthand for the print page -> `app/admin/receipts/[receiptId]/print/page.tsx`, in
  the "add a field to a receipt" recipe and in this log.

Checked and left unchanged (spot checks that held): F01 (`app/admin/receipts/[receiptId]/page.tsx:32,35`
and `app/admin/receipts/[receiptId]/print/page.tsx:33,36` both read `params.id` under a `[receiptId]` segment, and the detail page's
early `return` does skip its `finally`), F02, F03, F04 (`app/api` has no `calendar` directory),
F06 (`AdminAuthGuard.tsx:129-142`), F07, F09, F10, F11, F12, F13, F14, F15, F16, F18, F19, F20
(no importer for any of the nine files), F21, F23, F25, F26, F27, F29-F40; the receipt issue flow
(`lib/receipt/admin.ts:32,45-58,66,78-90,118-141`), the Server/Client markers on the pooja and
aaradhane shells, the `sevas` vs `receiptSevas` store split, and the 68/68 coverage count.

## Refresh log (2026-10-18)

Delta for M07 (`.claude/state/delta/2026-10-18/delta.json` perModule.M07): 0 added, 0 deleted, 1
modified (`app/api/admin/aaradhane/route.ts`). Confirmed by `diff -rq --strip-trailing-cr` of every
M07 root against the 2026-09-19 snapshot: that file is the only difference. Boundary files re-diffed:
only `lib/auth/admin-auth.ts`, `lib/admin-firebase.ts` and `package.json` changed; `firestore.rules`,
`AdminAuthGuard.tsx`, `AdminSidebar.tsx`, `lib/receipt/*`, every borrowed service and
`docs/DATA-MODEL.md` are byte-identical, so every other `path:line` citation still lands.

- Entry points, `/api/admin/aaradhane`: "no auth, trusts `x-user-email`" -> `verifyAdminUser` on GET and POST, `createdBy = admin.email` -> `app/api/admin/aaradhane/route.ts:11,37,41`.
- Key files, same route: 53 lines, "No auth; trusts `x-user-email` at :33" -> 60 lines, guarded, body parsed before auth -> `wc -l`, `:36-37`.
- Data flow 1 step 3: `verifyAdminUser` at `lib/auth/admin-auth.ts:28` -> wrapper at `:186` over `verifyAdminUserResult` at `:50` -> `lib/auth/admin-auth.ts`.
- Cross-module dependencies: `admin-auth.ts` row now names `verifyAdminUserResult` / `requireAdminUser` and the aaradhane route as a consumer -> `lib/auth/admin-auth.ts:50,198`.
- M07-F05: six unguarded routes -> five (aaradhane collection route fixed by da7a1fc; `[id]` still open); stale evidence `route.ts:9,30` removed; direction now names `requireAdminUser` -> STILL OPEN, narrowed.
- M07-F08: `package.json:56,81` -> `package.json:82,110`; importer grep re-run, still none -> STILL OPEN.
- M07-F37: `lib/auth/admin-auth.ts:18,60-64` -> `:39,147-156`, logic unchanged -> MOVED.
- M07-F42: added that `GET /api/admin/aaradhane` now needs a token but is still uncalled and its POST still 500s -> `grep -rn "api/admin/aaradhane"` hits only the route files -> STILL OPEN.
- M07-F01..F04, F06, F07, F09..F36, F38..F41, F43, F44: evidence re-checked (files byte-identical to snapshot modulo CRLF) -> STILL OPEN.
- New M07-F45 (LOW): guarded routes use the null-collapsing `verifyAdminUser`, so 503/403 become 401; aaradhane POST parses body before auth -> `lib/auth/admin-auth.ts:186-191`, `app/api/admin/aaradhane/route.ts:36-37`.
- Portability notes: added the `apps/mobile` status - no code or route consumed; it reads Supabase `sevas` / `daily_poojas`, ETL copies of data this module's admin screens write -> `apps/mobile/lib/api.ts:5,28`, `scripts/migrate-sevas.ts:44`, `scripts/migrate-daily-poojas.ts:46`.
- Answers questions about: two questions added (auth helper status; mobile visibility).
- UNCLEAR on `bills` rules: "cannot read history (not a git repository)" -> history read: introduced in `a0576c6` (2026-07-10) as an unblock fix, unchanged since -> `git log -- firestore.rules`.
- Coverage: 68/68 re-counted from today's inventory; header line notes the refresh.

Commits that drove the changes: `da7a1fc` (2026-09-20, "Raya AI Production Hardening" - guarded the
aaradhane route and other fake-admin endpoints); the `lib/auth/admin-auth.ts` restructure and the
`package.json` Prisma/Supabase additions arrived in other modules' commits (M04/M16) and only moved
line numbers here. No other commit since 2026-09-19 touches an M07 root (`git log --since=2026-09-19`
over all roots lists only da7a1fc).

- UNCLEAR: whether the Supabase `sevas` / `daily_poojas` tables are meant to become the system of record for the Receipt Book catalogue and pooja timetable. If so, `/api/admin/receipt-sevas` and `services/pooja.service.ts` (M10) will need to write Supabase, and the receipt rate lookup in `lib/receipt/admin.ts` must follow; today nothing in this module touches Supabase.
- Path check by script 2026-10-18: 133 path tokens, 3 missing, all deliberately absent and labelled under Coverage (`app/api/calendar`, `app/api/calendar/route.ts`, `app/api/admin/bills/route.ts`); one extensionless citation fixed (`hooks/useFinanceSettings` -> `hooks/useFinanceSettings.ts` in M07-F23).
