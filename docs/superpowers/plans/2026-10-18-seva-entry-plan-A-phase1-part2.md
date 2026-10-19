# Seva Entry Phase 1 Implementation Plan (Plan A, part 2 of 2 - waves A3 to A5 and the self-review)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Seva Entry Phase 1 - Supabase-backed counter receipts (online and offline), the 99 x 210 mm slip, prasadam hand-over, day close, dashboard, register, reports, exports, settings, staff and roles, nightly backup, and the Phase 1 security fixes - by extending the existing Receipt Book.

**Architecture:** as in part 1 - pages call only `app/api/seva/**`; each route verifies identity through the adapter, checks role, staff status and device, validates with zod and calls one SQL function; pure TypeScript in `lib/seva/*`; IndexedDB outbox and `OF` series offline.

**Tech Stack:** as in part 1.

**Spec:** `docs/seva/DESIGN-BOOK.md` (signed 2026-10-18), cited as "DB §n"; `$STATE/DECISIONS.md` wins on conflict.

**Part 1** is `2026-10-18-seva-entry-plan-A-phase1.md`: paths (`$MAIN`, `$STATE`, `$WT`), waves A0 to A2, and the sections every task here depends on.

## Global Constraints

Exactly as in part 1 (they apply verbatim to every task below). Give each implementer part 1's **Global Constraints** and **Shared contracts** sections together with the task text.

## Review Focus

As in part 1. The tests that pin its five lines in this part: A3-2 `short form matching two series returns a choose list`; A4-1 `price change reloads the catalogue and prints nothing`, `Ctrl+Enter twice posts once`, `Kannada name prints on the slip`; A4-5 `scanner-typed URL in the number box finds the receipt`.

---

## Wave A3 - API and app shell (7 tasks in parallel; needs A2)

All route files follow one shape (pattern of `tests/unit/seed-ai-settings-route.test.ts` for their tests): `requireSevaActor(req, action, opts)` -> parse the body or query with the zod schema (400 `validation` with the first issue's message) -> call the area repository in `lib/seva/server/<area>.ts` -> `sevaJson(...)`; any thrown error -> `sevaErrorResponse(err)`. Route tests start with `/** @jest-environment node */`, mock `server-only`, mock `@/lib/seva/server/auth` (`requireSevaActor`) and `@/lib/seva/server/rpc` (`callRpc`) or `@/lib/supabase/admin`, import the handler and call it with `new NextRequest(...)`.

### Task A3-1: Counter routes - me, bootstrap, orders, sync, prints, heartbeat, devices

Tier: **Opus high** - the hot path; thin over A2 but the conversions and permission contexts must be exact.

**Files:**
- Create: `app/api/seva/me/route.ts`, `app/api/seva/counter/bootstrap/route.ts`, `counter/orders/route.ts`, `counter/sync/route.ts`, `counter/prints/route.ts`, `counter/heartbeat/route.ts`, `counter/devices/route.ts`
- Create: `lib/seva/server/counter.ts`, `lib/seva/server/finance.ts`, `services/seva/counter.service.ts`, `services/seva/me.service.ts`
- Modify (A2-FIX2): `types/seva.ts` - `CounterBootstrap` gains `lastOfGroupNo: number` (update its fixtures: `tests/unit/seva/offline-fixtures.ts` `bootstrap()`, the fake API's bootstrap in `tests/e2e/seva/fixtures/fake-api.ts`)
- Test: `tests/unit/seva/api-counter.test.ts`, `tests/unit/seva/counter-convert.test.ts`

**Interfaces:**
- Consumes: A2-4 (`requireSevaActor`, `callRpc`, `sevaJson`, `sevaErrorResponse`, `sevaFetch`), A2-1/A2-2/A2-3 function names, schemas (A1-3), `fromPaise`/`toPaise` (A1-2), `NAKSHATRAS`/`RASHIS`/`GOTRAS` (A1-3).
- Produces:
```ts
// lib/seva/server/counter.ts
export function toSqlOrder(p: CounterOrderPayload): Record<string, unknown>;          // SQL JSON contract; paise -> '505.00'
export function toSqlOfflineOrder(p: OfflineOrderPayload): Record<string, unknown>;
export function fromSqlIssue(row: unknown): IssueResponse;                           // numerics -> paise; gotra/nakshatra/rashi Kannada from the domain lists
export async function loadBootstrap(actor: SevaActor, device: { id: string; counterId: number }): Promise<CounterBootstrap>;
// lib/seva/server/finance.ts
export async function readCounterUpi(): Promise<{ vpa: string; payeeName: string } | null>;  // Firestore settings/financeSettings: upi.enabled, upi.id, upi.displayName; null when disabled or empty - never a default VPA
// services/seva/counter.service.ts (browser)
export function counterApi(token: () => Promise<string>, device: () => string | null): {
  bootstrap(): Promise<CounterBootstrap>; issue(p: CounterOrderPayload): Promise<IssueResponse>; sync(items: OutboxItem[]): Promise<SyncResponse>;
  prints(receiptIds: string[]): Promise<{ receipts: { id: string; printCount: number; duplicate: boolean }[] }>;
  heartbeat(b: { outboxCount: number; clockSkewMs: number; appVersion: string }): Promise<HeartbeatAnswer>;  // lib/seva/offline/heartbeat.ts: { serverTime, ofSeries, lastOfNo, lastOfGroupNo, dayClosed }
  registerDevice(b: { counterId: number; secretHash: string; label: string }): Promise<{ deviceId: string }>;
  replaceDevice(b: { counterId: number; secretHash: string; label: string; lastPrintedOfNo: number; reason: string }): Promise<{ deviceId: string }> };
export function meApi(token: () => Promise<string>, device: () => string | null): { get(): Promise<SevaMe> };
```
Route rules: `me` (any staff, device optional; calls `seva_mark_signed_in` when the staff row is `invited`); `bootstrap` (`counter.issue`, device required; catalogue = active sevas with visibility counter or both, ordered by key; festival chips whose last date is today or later; `upi` null with `upiDisabledReason: 'not_configured'` when finance settings have no UPI id; `lastOfNo` and `lastOfGroupNo` - the latter from `seva_offline_group_floor(counter, device, now())`, the same floor as the heartbeat, so a new PC that goes offline right after "Replace this PC" never repeats a group label; the counter page (A4-1) raises its OF and group counters from both with `raiseOfflineFloor` / `raiseOfflineGroupFloor`); `orders` (`counter.issue` + device); `sync` (`counter.issue` + device; items processed in `seq` order: orders through `seva_sync_offline_order`, cancels through `seva_cancel_receipts` with `p_at` after resolving `clientReceiptIds` to ids; a business error answers that item with its code and continues, any other error stops and answers 503); `prints` (first print needs `counter.issue`; when any receipt already has `print_count >= 1` the call needs `receipt.reprint` with the own-counter/today context); `heartbeat` (`counter.heartbeat` + device; answers `lastOfGroupNo` from the SQL `last_of_group_no`); `devices` (`device.register`; body `{ action: 'register' | 'replace', ... }`).

Sync - who did the work (A2-FIX, A2-FIX2; DB 8.3): the signed-in caller is only the syncer (`p_staff_id`). For an order, look up the staff row by `payload.issuerStaffNo` -> `staff.firebase_uid` -> Firestore `users/{uid}` -> `mapFirestoreRole(role)` and pass it as `p_issuer_role`; for a cancel do the same with `cancelledByStaffNo` and pass `p_cancelled_by_staff_no`, `p_canceller_role`, `p_at = item.at` and `p_is_admin = false`. Pass null for the role when `isActive` is false while the staff row is still `active` (the two stores disagree, and drift may only deny, DB 3.2), or when there is no `users` doc or no seva role. An issuer offboarded after the work (staff row `inactive`, `isActive` false) keeps the role they had, so the SQL function can accept them and write `receipt.issuer_inactive_at_sync`; an unknown staff no. is passed through and refused by SQL (`validation`). The route never decides acceptance itself.

- [ ] **Step 1: Write the failing tests**

```ts
it('passes rupee strings and the expected total to seva_issue_counter_order')   // callRpc('seva_issue_counter_order', { p_order: { expected_total: '820.00', receipts: [{ lines: [{ unit_rate: null }] }] }, ... })
it('converts the SQL answer to paise and adds Kannada names')                    // fromSqlIssue: total '610.00' -> 61000; nakshatra_id 4 -> nakshatraKn 'ರೋಹಿಣಿ'
it('answers 400 validation for a bad body')                                       // { error: { code: 'validation' } }
it('answers 409 with a plain message for price_changed')
it('passes through the guard response when the device header is missing')         // guard mocked to return 403 device_required
it('bootstrap leaves out online-only sevas and past festival chips')
it('bootstrap disables UPI when no UPI id is configured')                         // upi null, upiDisabledReason 'not_configured'
it('me marks an invited staff member active once')
it('sync stores orders and cancels in order and reports each item')
it('sync passes the issuer\'s and the canceller\'s role, not the syncer\'s')       // p_issuer_role / p_cancelled_by_staff_no + p_canceller_role from users/{uid} of that staff no.; null on store drift
it('sync stops with 503 on a non-business error')
it('a reprint needs receipt.reprint with the own-counter context')                // guard called with action 'receipt.reprint' and ctx.counterIdOfDevice
it('heartbeat returns the server time, the OF floor and the group label floor')   // lastOfNo, lastOfGroupNo
it('bootstrap returns lastOfNo and lastOfGroupNo')
it('only temple admins and super admins register devices')                       // guard called with 'device.register'
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/api-counter.test.ts tests/unit/seva/counter-convert.test.ts`.

- [ ] **Step 3: Implement** the routes, repository and browser clients.

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add app/api/seva/me app/api/seva/counter lib/seva/server/counter.ts lib/seva/server/finance.ts services/seva tests/unit/seva
git commit -m "feat(seva): add counter API routes - me, bootstrap, orders, sync, prints, heartbeat, devices"
```

### Task A3-2: Receipt, devotee, prasadam and gap routes; public receipt reader

Tier: **Opus high** - lookups must never leak amounts or phones; short-form parsing has edge cases.

**Files:**
- Create: `app/api/seva/receipts/route.ts`, `receipts/[receiptId]/route.ts`, `receipts/cancel/route.ts`, `receipts/[receiptId]/reissue/route.ts`, `devotees/search/route.ts`, `prasadam/lookup/route.ts`, `prasadam/give/route.ts`, `prasadam/undo/route.ts`, `gaps/[id]/route.ts`
- Create: `lib/seva/server/receipts.ts`, `lib/seva/server/prasadam.ts`, `lib/seva/server/public-receipt.ts`, `types/seva-receipts.ts`, `types/seva-prasadam.ts`, `services/seva/receipts.service.ts`, `services/seva/prasadam.service.ts`
- Test: `tests/unit/seva/api-receipts.test.ts`, `tests/unit/seva/api-prasadam.test.ts`, `tests/unit/seva/public-receipt.test.ts`

**Interfaces:**
- Consumes: A2-4, A2-1/A2-2 functions, `parseLookupInput`, `newQrToken` (A1-2), schemas (A1-3).
- Produces:
```ts
// types/seva-receipts.ts
export interface ReceiptListItem { id: string; receiptNo: string; series: string; businessDate: string; issuedAt: string; devoteeName: string;
  sevas: string; totalPaise: number; mode: PaymentMode; status: 'issued' | 'cancelled'; changed: boolean; printCount: number;
  prasadam: 'none' | 'pending' | 'given'; groupNo: string; position: number; count: number; issuedByStaffId: string | null;
  cancelDeadline: string | null; refundState: 'none' | 'due' | 'processing' | 'done' | 'failed' }
export interface ReceiptDetail extends IssuedReceipt { history: { at: string; action: string; by: string | null; reason: string | null }[];
  cancel: { at: string; by: string; reasonCode: CancelReasonCode; note: string | null } | null; refundState: ReceiptListItem['refundState'] }
export interface PublicReceipt { templeNameEn: string; templeNameKn: string; receiptNo: string; sevaDate: string; devoteeName: string;
  gotra: string | null; nakshatra: string | null; lines: { nameEn: string; nameKn: string | null; quantity: number; amountPaise: number }[];
  totalPaise: number; mode: PaymentMode; status: 'valid' | 'cancelled'; prasadam: 'none' | 'pending' | 'given' }   // never the phone (C-50)
// types/seva-prasadam.ts
export interface PrasadamReceipt { id: string; receiptNo: string; devoteeName: string; sevaDate: string; issuedAt: string; groupLine: string | null;
  lines: { nameEn: string; nameKn: string | null; quantity: number; prasadamItems: string | null }[] }    // no amounts, no phone
export type PrasadamLookupResult =
  | { state: 'ready'; receipt: PrasadamReceipt }
  | { state: 'another_day'; receipt: PrasadamReceipt; offDate: 'before' | 'after'; days: number; todaysSlip: { receiptNo: string; position: number; count: number } | null }
  | { state: 'already_given'; receipt: PrasadamReceipt; givenAt: string; givenBy: string }
  | { state: 'cancelled'; receipt: PrasadamReceipt; cancelledAt: string; cancelledBy: string; reason: string }
  | { state: 'no_prasadam'; receipt: PrasadamReceipt }
  | { state: 'choose'; options: { receiptId: string; receiptNo: string; sevaDate: string; devoteeName: string }[] }
  | { state: 'not_found'; query: string };
export async function getPublicReceiptByToken(token: string): Promise<PublicReceipt | null>;   // lib/seva/server/public-receipt.ts
// services/seva/receipts.service.ts and prasadam.service.ts (browser)
export function receiptsApi(token: () => Promise<string>, device: () => string | null): {
  list(q: { from?: string; to?: string; sevaId?: string; mode?: PaymentMode; status?: string; q?: string; cursor?: string }): Promise<{ rows: ReceiptListItem[]; nextCursor: string | null }>;
  get(id: string): Promise<ReceiptDetail>; cancel(b: { receiptIds: string[]; reasonCode: CancelReasonCode; note?: string }): Promise<{ receipts: ReceiptListItem[] }>;
  reissue(id: string): Promise<IssueResponse>; searchDevotees(q: { name?: string; phone?: string }): Promise<{ name: string; gotra: string | null;
  gotraId: number | null; nakshatraId: number | null; rashiId: number | null; phoneLast4: string | null; lastVisit: string }[]>;
  resolveGap(id: number, b: { status: 'entered_from_paper' | 'declared_lost'; note: string }): Promise<void> };
export function prasadamApi(token: () => Promise<string>): { lookup(q: string): Promise<PrasadamLookupResult>;
  give(b: { receiptId: string; confirmOffDate: boolean }): Promise<PrasadamLookupResult>; undo(b: { receiptId: string; reason?: string }): Promise<void> };
```
Rules: `receipts` GET - `receipts.list`; a receptionist must send the device header and is limited to that counter and today's business date; filters `from, to, sevaId, mode, status (issued | cancelled | changed | duplicate | prasadam_pending), q (number or name), cursor`; test-mode rows excluded; never a phone. `devotees/search` (`devotees.search`) answers `{ name, gotra, gotraId, nakshatraId, rashiId, phoneLast4, lastVisit }[]` (at most 5), never the full phone. `receipts/cancel` computes `p_is_admin = can(actor, 'receipt.cancel_any')`. `reissue` makes the QR token with `newQrToken()`. `prasadam/lookup?q=` uses `parseLookupInput` with the current IST year; a short form that matches several receipts answers `choose`. `gaps/[id]` (`gap.resolve`).

- [ ] **Step 1: Write the failing tests**

```ts
it('limits a receptionist\'s list to their counter and today')            // query built with counter_id = device counter and business_date = today
it('never returns phone numbers in lists or search')                       // Object.keys excludes phone, phone_e164
it('search returns at most five matches with the last four digits only')
it('cancel passes p_is_admin from the actor\'s rights')
it('reissue sends a fresh 22-character QR token')
it('lookup resolves a scanner-typed URL with a trailing new line')         // 'https://x/r/<token>\n'
it('short form matching two series returns a choose list')                 // '124' matches C1 and OF1 -> state 'choose' with 2 options
it('lookup answers carry no amounts')                                      // JSON.stringify(result) has no 'amount' / 'total' / 'Paise'
it('maps each SQL prasadam state to its screen state')                     // ready, another_day(before 2 days), already_given, cancelled, no_prasadam, not_found
it('undo after the undo time requires prasadam.reverse')
it('public reader returns slip details without the phone and null for an unknown token')
it('resolving a gap needs gap.resolve and a note')
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/api-receipts.test.ts tests/unit/seva/api-prasadam.test.ts tests/unit/seva/public-receipt.test.ts`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add app/api/seva/receipts app/api/seva/devotees app/api/seva/prasadam app/api/seva/gaps lib/seva/server/receipts.ts lib/seva/server/prasadam.ts lib/seva/server/public-receipt.ts types/seva-receipts.ts types/seva-prasadam.ts services/seva tests/unit/seva
git commit -m "feat(seva): add receipt, devotee search, prasadam and gap API routes"
```

### Task A3-3: Day-close and report routes

Tier: **Opus medium** - thin routes over A2-2/A2-3 with permission checks pinned by tests.

**Files:**
- Create: `app/api/seva/day-close/route.ts` (GET prepare, POST close), `day-close/reopen/route.ts`, `app/api/seva/reports/dashboard/route.ts`, `reports/continuity/route.ts`, `reports/seva-summary/route.ts`, `reports/festival/route.ts`, `reports/audit/route.ts`, `reports/day-closes/route.ts`, `reports/export/route.ts`, `reports/export/audit/route.ts`
- Create: `lib/seva/server/reports.ts`, `lib/seva/server/dayclose.ts`, `services/seva/reports.service.ts`, `services/seva/dayclose.service.ts`
- Test: `tests/unit/seva/api-reports.test.ts`, `tests/unit/seva/api-dayclose.test.ts`

**Interfaces:**
- Consumes: `periodRange` (A1-2), A2-2/A2-3 functions and types, A2-7 row types.
- Produces: `GET /api/seva/reports/dashboard?period=` -> `{ data: DashboardData; attention: NeedsAttentionCard[] }` with `Cache-Control: private, max-age=60`; `GET .../continuity?from&to` -> `ContinuityRow[]`; `GET .../export?part=receipts|lines|sevas|cancelled|dayCloses|prasadam|rateChanges&from&to&cursor&includePhones` -> `{ rows: unknown[]; nextCursor: string | null }` (1000 rows a page, test mode excluded); `POST .../export/audit` `{ format, from, to, parts, includePhones }` -> writes `export.download`; `GET /api/seva/day-close?counterId&date` -> `DayClosePrep`; `POST` `{ counterId, businessDate, counts, upiBankTotalPaise, note }` -> `{ dayCloseId }`; `POST day-close/reopen` `{ dayCloseId, reason }`. Browser clients: `reportsApi(token)` -> `{ dashboard(period: Period); continuity(from, to); sevaSummary(from, to); festival(festivalId, compareYear); audit(f: { type?: string; staffId?: string; from?: string; to?: string; cursor?: string }); dayCloses(from, to); export(p: { part: string; from: string; to: string; cursor?: string; includePhones: boolean }); exportAudit(b: { format: 'xlsx' | 'csv' | 'tally' | 'print'; from: string; to: string; parts: string[]; includePhones: boolean }) }` and `dayCloseApi(token, device)` -> `{ prepare(p?: { counterId?: number; date?: string }): Promise<DayClosePrep>; close(b): Promise<{ dayCloseId: string }>; reopen(dayCloseId: string, reason: string): Promise<void> }`.
- Rules: reports need `reports.view` (receptionists refused, C-59); `includePhones=true` needs `export.with_phones`; a receptionist's day close is limited to the device's counter and today; reopen needs `dayclose.reopen`.

- [ ] **Step 1: Write the failing tests**

```ts
it('passes like-for-like IST bounds for the week to seva_dashboard')   // from Monday 00:00 IST
it('caches the dashboard for 60 seconds privately')
it('refuses reports to receptionists and allows view-only temple admins') // guard action 'reports.view'
it('refuses phone numbers in exports without export.with_phones')
it('pages exports 1000 rows at a time and excludes test mode')
it('writes the export audit with format, range, parts and the phone flag')
it('limits a receptionist\'s day close to their counter and today')
it('maps difference_note_required and outbox_not_empty to 400 and 409')
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/api-reports.test.ts tests/unit/seva/api-dayclose.test.ts`.

- [ ] **Step 3: Implement.** Register, audit and export reads use the query builder (read-only); writes only through functions.

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add app/api/seva/day-close app/api/seva/reports lib/seva/server/reports.ts lib/seva/server/dayclose.ts services/seva tests/unit/seva
git commit -m "feat(seva): add day-close and report API routes"
```

### Task A3-4: Catalogue and settings routes (with the Firestore sevas mirror)

Tier: **Opus medium** - CRUD over A2-3 functions; one judgement point (the mirror) is fixed below.

**Files:**
- Create: `app/api/seva/sevas/route.ts` (GET, POST), `sevas/[id]/route.ts` (PUT), `sevas/reorder/route.ts`, `app/api/seva/settings/template/route.ts`, `settings/rules/route.ts`, `settings/denominations/route.ts`, `settings/festivals/route.ts`, `settings/festivals/[id]/route.ts`, `settings/counters/route.ts`, `settings/counters/[id]/route.ts`
- Create: `lib/seva/server/catalogue.ts`, `lib/seva/server/settings.ts`, `services/seva/catalogue.service.ts`, `services/seva/settings.service.ts`
- Test: `tests/unit/seva/api-catalogue.test.ts`, `tests/unit/seva/api-settings.test.ts`

**Interfaces:**
- Consumes: A2-3 functions, schemas (A1-3), `getAdminFirestore()`.
- Produces: `catalogueApi(token)` `{ list(): Promise<CatalogueSeva[]>; save(s: SevaUpsert, reason?: string): Promise<{ id: string }>; reorder(ids: string[]): Promise<void>; history(id: string): Promise<{ oldPaise: number | null; newPaise: number; reason: string; by: string; at: string }[]> }` and `settingsApi(token)` `{ getTemplate, saveTemplate, getRules, saveRules, getDenominations, saveDenominations, listFestivals, saveFestival, listCounters, addCounter, updateCounter }`.
- Mirror (C-39): after every successful `seva_upsert_seva`, write the public fields `{ name, description, amount, active, displayOrder, category, duration, imageUrl, updatedAt }` to Firestore `sevas/{firestore_id}` (for a new seva `firestore_id` is set to its Supabase id inside the function call payload). A mirror failure does not undo the Supabase save; it answers 200 with `{ mirror: 'failed' }` and logs the seva id.
- Rules: GET sevas `sevas.read` (receptionists too); writes `sevas.edit` / `settings.edit` (view-only refused by the guard).

- [ ] **Step 1: Write the failing tests**

```ts
it('lets receptionists read the catalogue and refuses their writes')
it('needs a reason when the rate changes')                       // 400 change_reason_required
it('mirrors only public fields to Firestore sevas')
it('reports a failed mirror without undoing the save')
it('refuses a denomination above Rs 2,000 or of an unknown kind')
it('adding a counter returns its new C and OF series')
it('refuses view-only temple admins on every write')             // guard -> 403 view_only
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/api-catalogue.test.ts tests/unit/seva/api-settings.test.ts`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add app/api/seva/sevas app/api/seva/settings lib/seva/server/catalogue.ts lib/seva/server/settings.ts services/seva tests/unit/seva
git commit -m "feat(seva): add catalogue and settings API routes with the Firestore sevas mirror"
```

### Task A3-5: Staff routes, the legacy user routes under the same rules, and the first super admin

Tier: **Opus xhigh** - role grants and account lifecycle across two stores; partial failures must be loud (DB §3.2, §3.4, §13.6, C-17).

**Files:**
- Create: `app/api/seva/staff/route.ts` (GET list, POST onboard), `app/api/seva/staff/[id]/route.ts` (PUT)
- Create: `lib/seva/server/staff.ts`, `types/seva-staff.ts`, `services/seva/staff.service.ts`, `scripts/seva/create-first-super-admin.ts`
- Modify: `app/api/admin/users/create-admin/route.ts`, `app/api/admin/users/set-role/route.ts`
- Test: `tests/unit/seva/api-staff.test.ts`, `tests/unit/seva/legacy-user-routes.test.ts`

**Interfaces:**
- Consumes: `IdentityAdapter` (A2-4), `can` (A2-4), A2-3 staff functions, schemas (A1-3).
- Produces:
```ts
// types/seva-staff.ts
export interface StaffMember { id: string; staffNo: number; fullName: string; email: string; role: SevaRole | null; viewOnly: boolean;
  status: 'invited' | 'active' | 'inactive' | 'deleted'; lastActiveAt: string | null; invitedAt: string | null; firstSignedInAt: string | null }
// services/seva/staff.service.ts
export function staffApi(token: () => Promise<string>): { list(filter: 'all' | 'active' | 'inactive'): Promise<StaffMember[]>; nextStaffNo(): Promise<number>;
  onboard(b: { fullName: string; email: string; role: SevaRole; viewOnly: boolean; staffNo?: number }): Promise<{ staffId: string; staffNo: number }>;
  update(id: string, b: { role?: SevaRole; viewOnly?: boolean; status?: 'active' | 'inactive' | 'deleted'; reason?: string }): Promise<void> };
```
Order of writes for onboard: identity `createLogin` -> `setAccessProfile({ role, isActive: true, email, displayName })` -> `seva_staff_onboard` -> (audit inside the function). For an update: identity first (`setAccessProfile`, `setLoginEnabled(false)` on deactivate, `deleteLogin` on delete), then `seva_staff_update`, then `seva_audit('staff.role_change', ...)` for role changes. Any step failing after an earlier one succeeded answers 502 `partial_failure` with `{ done: [...], failed: '<step>' }` - never silent. The client then calls Firebase `sendPasswordResetEmail` for the invite (C-56; A4-11). Legacy routes: `set-role` and `create-admin` apply `can(..., 'staff.change_role' | 'staff.grant_super_admin', { targetRole, targetStaffId, newRole })` and audit when the target has a staff row. The script takes `--email <address>` and makes staff 001 for that existing Firebase user (role `super_admin`, status `active`), idempotently; it reads credentials through `loadServiceAccount()` (A1-5).

- [ ] **Step 1: Write the failing tests**

```ts
it('onboards with the next staff number and an invited status')
it('only a super admin can give the super admin role')                 // temple admin -> 403
it('a temple admin cannot change their own role or a super admin\'s')  // C-17
it('only a super admin can deactivate or delete, and a reason is required') // 403; 400 validation
it('deactivation disables the login and revokes sessions before marking inactive') // adapter.setLoginEnabled(uid, false) called before seva_staff_update
it('a temple admin can reactivate')
it('reports a partial failure loudly')                                  // Supabase step throws -> 502 partial_failure with done ['identity'] and failed 'staff'
it('lists staff with their Firestore role and no phone')
it('legacy set-role refuses a temple admin granting super_admin')
it('legacy set-role audits a change for someone with a staff row')
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/api-staff.test.ts tests/unit/seva/legacy-user-routes.test.ts`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add app/api/seva/staff app/api/admin/users lib/seva/server/staff.ts types/seva-staff.ts services/seva/staff.service.ts scripts/seva/create-first-super-admin.ts tests/unit/seva
git commit -m "feat(seva): add staff onboarding and lifecycle routes; bring legacy user routes under the role rules"
```

### Task A3-6: Module shell - layouts, `useSevaMe`, navigation per role, role landing

Tier: **Opus high** - touches the site-wide admin shell; must add real seva checks without changing existing users' access.

**Files:**
- Modify: `app/admin/receipts/layout.tsx:12` (wrap in `SevaMeProvider` and `<div className="seva">`, import `styles/seva/tokens.css` and `styles/seva/print.css`, render `PrintRoot`), `context/AuthContext.tsx:155-161` (add `sevaRole: SevaRole | null` from `mapFirestoreRole(profile.role)`), `components/admin/layout/AdminAuthGuard.tsx:8-14,129-143` (add cases `sevaCounter`, `sevaPrasadam`, `sevaAdmin` with real checks; **existing cases unchanged**), `components/admin/layout/AdminSidebar.tsx:56` and `components/admin/layout/navigation.ts:55-58` (Receipt Book sub-items per role), `app/admin/page.tsx` (send receptionists to `/admin/receipts/counter` and prasadam volunteers to `/admin/prasadam` before any Firestore count runs)
- Create: `app/admin/prasadam/layout.tsx`, `hooks/seva/useSevaMe.tsx`, `components/seva/shell/SevaGate.tsx`, `lib/seva/strings/shell.ts`
- Test: `tests/unit/seva/shell.test.tsx`, `tests/e2e/seva/shell.spec.ts`

**Interfaces:**
- Consumes: `meApi` (A3-1 - same wave: use the `SevaMe` type and `sevaFetch('/api/seva/me')` directly), `mapFirestoreRole`, `can` (A2-4), `PrintRoot` (A2-11), `getDeviceCredentials`, `deviceHeader`, `openSevaDb` (A2-6).
- Produces:
```ts
export function SevaMeProvider(p: { children: React.ReactNode }): JSX.Element;   // loads /api/seva/me with the device header when one is stored
export function useSevaMe(): { me: SevaMe | null; loading: boolean; error: string | null; can(action: SevaAction, ctx?: PermissionContext): boolean; reload(): Promise<void> };
export function SevaGate(p: { action: SevaAction; children: React.ReactNode }): JSX.Element;  // 'You do not have access to this page.' (bilingual) when not allowed
```
Navigation (labels English, Kannada under): Receipt Book -> Dashboard `/admin/receipts` (TA, TV, SA), Counter `/admin/receipts/counter` (R, TA, SA), Today's receipts `/admin/receipts/counter/today` (R, TA, SA), Close day `/admin/receipts/day-close` (R, TA, SA), Register `/admin/receipts/register` (TA, TV, SA), Reports `/admin/receipts/reports` (TA, TV, SA), Day closes `/admin/receipts/day-closes` (TA, TV, SA), Seva settings `/admin/receipts/seva-settings` (TA, TV, SA), Receipt settings `/admin/receipts/settings` (TA, TV, SA); Prasadam `/admin/prasadam` (P, TA, SA); Staff and roles stays at `/admin/users` (TA, SA). Pages created later link correctly once their tasks merge.

- [ ] **Step 1: Write the failing tests**

```ts
it('shows a receptionist Counter, Today\'s receipts and Close day only')
it('shows a prasadam volunteer only Prasadam')
it('shows a temple admin every seva item; a view-only one no Counter')
it('keeps the existing sections for an existing billing user')        // snapshot of the non-seva sections unchanged
it('SevaGate hides a page the person may not use')
it('useSevaMe.can follows the permission matrix')
it('AuthContext maps temple_admin and admin to temple_admin and billing to null')
// e2e shell.spec.ts (fake API)
test('a receptionist landing on /admin goes to the counter')
test('a prasadam volunteer landing on /admin goes to the prasadam page')
test('saves a sidebar screenshot per role')        // only when SEVA_SHOTS_DIR is set; the wave gate sets it to $STATE/test-reports/A3-shots
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/shell.test.tsx`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add app/admin/receipts/layout.tsx app/admin/prasadam/layout.tsx app/admin/page.tsx context/AuthContext.tsx components/admin/layout hooks/seva components/seva/shell lib/seva/strings/shell.ts tests/unit/seva tests/e2e/seva/shell.spec.ts
git commit -m "feat(seva): add the module shell, per-role navigation and role landing"
```

### Task A3-7: Counter Excel copy, service worker and install manifest

Tier: **Opus high** - browser APIs with permission prompts (File System Access, service worker); bounded and test-pinned.

**Files:**
- Create: `lib/seva/excel/excel.worker.ts`, `lib/seva/excel/folder.ts`, `lib/seva/excel/copyScheduler.ts`, `lib/seva/excel/download.ts`, `public/seva-sw.js`, `public/seva-counter.webmanifest`, `app/admin/receipts/counter/layout.tsx` (metadata `manifest: '/seva-counter.webmanifest'` and the service-worker registration island), `components/seva/counter/RegisterServiceWorker.tsx`
- Test: `tests/unit/seva/excel-copy.test.ts`, `tests/unit/seva/sw-routes.test.ts`

**Interfaces:**
- Consumes: `buildDayWorkbook`, `ExportReceiptRow` (A2-7); `openSevaDb`, `todaysReceipts` (A2-6).
- Produces:
```ts
export type FolderStatus = 'not_set' | 'ready' | 'needs_permission' | 'unsupported';
export async function chooseExcelFolder(db): Promise<{ name: string } | null>;     // showDirectoryPicker({ mode: 'readwrite', id: 'seva-receipts' }); handle kept in IDB 'files'
export async function excelFolderStatus(db): Promise<FolderStatus>;
export async function allowExcelFolder(db): Promise<boolean>;                    // requestPermission - call only from a click
export async function writeDayCopy(db, date: string, bytes: ArrayBuffer): Promise<'written' | 'needs_permission' | 'not_set'>;  // '<YYYY-MM-DD>.xlsx'
export function createExcelCopyScheduler(deps: { db; getRows(date: string): Promise<ExportReceiptRow[]>; build(rows: ExportReceiptRow[]): Promise<ArrayBuffer>;
  clock: () => Date; onStatus(s: FolderStatus | 'written'): void }): { noteReceipts(n: number): void; flushNow(): Promise<void>; stop(): void };
  // writes when dirty every 30 s, after every 20 receipts, and on flushNow (day close, "Save Excel now")
export function issuedToExportRow(r: IssuedReceipt): ExportReceiptRow;
export async function downloadDayExcel(rows: ExportReceiptRow[], meta: { date: string; counterName: string }): Promise<void>;  // '<YYYY-MM-DD> <counter>.xlsx'
```
Service worker (`public/seva-sw.js`, plain JS, scope `/admin/receipts/counter`): cache `seva-counter-<version>`; `routeRequest(url, mode)` returns `'network-first'` for navigations to `/admin/receipts/counter*`, `'cache-first'` for `/_next/static/*` and the manifest and icons, `'bypass'` for `/api/*` and everything else; old caches deleted on activate; `module.exports = { routeRequest }` when `module` exists (for the test). Manifest: name "Seva Counter", `start_url` and `scope` `/admin/receipts/counter`, `display: standalone`, the site's existing icons.

- [ ] **Step 1: Write the failing tests**

```ts
it('writes after 20 receipts and after 30 seconds, only when something changed') // jest fake timers
it('reports unsupported when the browser has no folder picker')
it('reports needs_permission when permission is prompt')
it('flushNow writes at once')
it('maps an issued receipt to an export row without the phone')
it('routes counter pages network-first, static files cache-first and API calls straight through')
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/excel-copy.test.ts tests/unit/seva/sw-routes.test.ts`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add lib/seva/excel public/seva-sw.js public/seva-counter.webmanifest app/admin/receipts/counter/layout.tsx components/seva/counter/RegisterServiceWorker.tsx tests/unit/seva
git commit -m "feat(seva): add the counter Excel copy, service worker and install manifest"
```

**Wave A3 gate - owner's 10-minute checklist**
1. Read the A3 test report summary and the security review note (gate after A3).
2. Look at the sidebar screenshots per role saved with the report (`$STATE/test-reports/A3-shots/`) and confirm each person sees the right menu.
3. When convenient, follow SETUP-GUIDE section 1 to create the Supabase test project (needed before the A5 smoke test).

---

## Wave A4 - Screens (11 tasks in parallel; needs A3)

Every page sits inside the A3-6 shell (`.seva` wrapper, `useSevaMe`, `SevaGate`), uses `Bilingual` for every visible label (Kannada under English), loads data only through `services/seva/*`, and shows loading, empty and error states (error text = the `message` from the API). Each task's e2e specs use `createFakeSevaApi` and `signInAs` (A2-12) and add their own fixtures in their own file. Strings go in the task's own `lib/seva/strings/<area>.ts` (Kannada flagged for proof-reading, O-03). Pages that other screens link to read these query parameters: register `?status=issued|cancelled|changed|duplicate|prasadam_pending&from&to&q`, dashboard `?period=today|week|month|year`.

### Task A4-1: Counter screens - three steps, summary, status strip, save and print, offline behaviour

Tier: **Opus high** - the busiest screen; keyboard flow, offline UX and printing come together here.

Mockups: `counter.html#counter`, `#counter-sevas`, `#counter-pay`, `#printed`, `#offline`.

**Files:**
- Create: `app/admin/receipts/counter/page.tsx`, `hooks/seva/useCounter.ts`, `components/seva/counter/{CounterScreen,TempleHeaderBand,StatusStrip,StepIndicator,DevoteeStep,SevasStep,SevaTiles,DatesControl,AmountChangeDialog,PayStep,UpiPanel,ReceiptSummary,PrintedPanel,OfflineBanner,InDoubtDialog,RegisterPrompt,DayClosedNotice}.tsx`, `lib/seva/strings/counter.ts`
- Test: `tests/unit/seva/counter-ui.test.tsx`, `tests/e2e/seva/counter.spec.ts`, `tests/e2e/seva/counter-offline.spec.ts`, `tests/e2e/seva/counter-print.spec.ts`

**Interfaces:**
- Consumes: `counterReducer`, `resolveKey`, `buildCounterOrderPayload`, `selectGroups`, `selectCanSave`, `profileToDraft` (A2-5); `createCounterSubmitter`, `runSync`, `startHeartbeat`, `connectionStore`, `findProfiles`, `cacheProfile`, `rememberReceipts`, device helpers (A2-6); `toSlipModel`, `printSlips` (A2-11); `createExcelCopyScheduler`, `excelFolderStatus`, `chooseExcelFolder`, `allowExcelFolder`, `downloadDayExcel`, `issuedToExportRow` (A3-7); `counterApi`, `meApi` (A3-1); `receiptsApi` devotee search (A3-2); `SearchSelect`, `Segmented`, `Chip`, `StatusPill` (A1-6); `NAKSHATRAS`, `RASHIS`, `GOTRAS` (A1-3); `buildUpiPaymentUrl` (`lib/receipt/upi.ts`, called with the VPA and payee from bootstrap - never its default).
- Produces: `useCounter(): { state; dispatch; groups; canSave; save(): Promise<void>; connection: ConnectionState; nextNumberPreview: string; bootstrap: CounterBootstrap | null; excel: { status: FolderStatus | 'written'; choose(): Promise<void>; allow(): Promise<void>; saveNow(): Promise<void>; download(): Promise<void> } }`.

Behaviour: layout and copy per DB §9.1-9.6 and §9.11 (header band from `bootstrap.slip`; strip with counter, "Ramesh - 023", connection pill, next number preview, today's count and cash/UPI totals, "Work offline" switch, "Close day" link to `/admin/receipts/day-close`; a warning "This PC clock is N minutes off" in the strip when the heartbeat skew exceeds 2 minutes; step 1 name first and phone last with the returning-devotee suggestion (search debounced 250 ms after 3 letters or a full phone; online through `devotees/search`, offline through `findProfiles`) "Use these details" / "Not this person" and Undo; a "Changed" chip on changed lines in the step and the summary; step 2 roomy tiles at least 150 px wide with number badge, code, English and Kannada names and price, search box, lines with quantity, dates control (multi-date where allowed, festival chips) and "Change amount"; step 3 cash with "Return change Rs 180" or UPI QR with the amount, last-6 box and the "I saw the payment succeed" tick; button "Save and print 3 receipts"). After a save: `printSlips`, `prints` for the ids, cache the profile, note receipts to the Excel scheduler, clear the form, focus Name. Without device credentials show `RegisterPrompt` (temple admins get a link to `/admin/receipts/settings/counters`; receptionists read "Ask a temple admin to register this PC"). A closed day shows `DayClosedNotice` and no save. The short privacy line under step 1 is sample text for approval (O-19). Every 30 s and on the `online` event run `runSync`.

- [ ] **Step 1: Write the failing tests**

```ts
// counter-ui.test.tsx
it('summarises a group in one line')     // '3 receipts: Sat 28 Aug Rs 610, Sun 29 Aug Rs 105, Mon 30 Aug Rs 105. Total Rs 820.'
it('shows the offline strip text with the waiting count') // 'Working offline since 10:12 AM. ... 3 are waiting. ...'
it('disables UPI with a reason when the counter has no UPI id')
// counter.spec.ts (desktop)
test('makes a 3-date receipt by keyboard only')        // fake got one POST with 3 receipts; 'C1-023-...' numbers shown; focus back in Name
test('Ctrl+Enter twice posts once')                   // fake.requests filtered to /counter/orders has length 1
test('number keys and codes add sevas')
test('UPI needs six digits and the tick before Save enables')
test('price change reloads the catalogue and prints nothing') // failNext('/api/seva/counter/orders', { status: 409, code: 'price_changed' }) -> message shown, bootstrap requested again, window.print not called, form kept
test('Kannada name prints on the slip')                // name 'ವೆಂಕಟೇಶ' -> #seva-print-root contains it
test('an unregistered PC shows the register prompt')
// counter-print.spec.ts
test('prints one 99 x 210 mm page per slip')           // window.print stubbed; emulateMedia print; page.pdf({ preferCSSPageSize: true }) -> pdf-lib: 3 pages, each 280.6 x 595.3 pt (+-1)
// counter-offline.spec.ts
test('works offline with OF numbers and sends them on reconnect') // context.setOffline(true) -> 'OF1-023-' on the slip, '1 waiting'; setOffline(false) -> fake got /counter/sync with 1 item; '0 waiting'
test('asks before printing offline when the office does not answer') // failNext timeout x3 -> dialog 'The office did not answer. Print as an offline receipt?' -> Yes -> OF slip
test('Work offline switch never calls the office')
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/counter-ui.test.tsx` (the e2e specs run at the wave gate).

- [ ] **Step 3: Implement** the page, hook and components to match the mockup screens named above.

- [ ] **Step 4: Run the unit test and see it pass**, then `npm run typecheck` (the e2e specs written here run at the wave gate).

- [ ] **Step 5: Commit**

```bash
git add app/admin/receipts/counter/page.tsx hooks/seva/useCounter.ts components/seva/counter lib/seva/strings/counter.ts tests/unit/seva tests/e2e/seva
git commit -m "feat(seva): add the counter screens - three steps, summary, offline and printing"
```

### Task A4-2: Today's receipts - list, cancel (group or one date), reprint, spoiled reissue

Tier: **Opus high** - money-back wording, window rules and offline cancels.

Mockups: `counter.html#recent`, the cancel dialog `cancel-dlg`.

**Files:**
- Create: `app/admin/receipts/counter/today/page.tsx`, `components/seva/today/{TodayList,CancelDialog,ReprintButton,SpoiledDialog}.tsx`, `lib/seva/strings/today.ts`
- Test: `tests/unit/seva/cancel-dialog.test.tsx`, `tests/e2e/seva/counter-today.spec.ts`

**Interfaces:**
- Consumes: `receiptsApi` (list, cancel, reissue - A3-2), `counterApi.prints` (A3-1), `todaysReceipts`, `enqueueCancel`, `connectionStore` (A2-6), `toSlipModel`, `printSlips` (A2-11), `cancelDeadline` (A1-2), `can` via `useSevaMe` (A3-6).
- Produces: nothing used by other tasks.

Behaviour: DB §9.8-9.9 - newest first; groups shown together with each date's number; search by number, name or seva; "Cancel until 11:12 AM" or "Past 30 minutes: a temple admin can cancel"; group cancel offers "All 3 receipts" or "Only 000124, Sat 28 Aug" (C-01); eight reasons (C-60), "Other" needs a note; cash cancelled the same day shows "Give back Rs 820 in cash"; UPI shows "Refund due - the office refunds from the bank app"; reprint prints the DUPLICATE slip; cancelled rows have no reprint; "Spoiled - cancel and reissue" asks once and prints the new number, and is offered only for receipts of today's IST business date (A2-FIX2: the server refuses others with `validation` / `reissue_only_today`; an earlier day's slip gets the DUPLICATE reprint). Offline: list merges local receipts; a cancel is queued with `enqueueCancel` (own receipts inside the window only) carrying `cancelledByStaffNo` = the signed-in person's staff no.

- [ ] **Step 1: Write the failing tests**

```ts
it('offers all receipts of the group or each date alone')
it('needs a note when the reason is Other')
it('shows the money-back line for cash and the refund-due line for UPI')
it('shows the cancel deadline inside the window and the admin note after it')
test('reprint prints a DUPLICATE slip with the same number')     // print root contains 'DUPLICATE' and 'ನಕಲು'
test('a cancelled receipt cannot be reprinted')
test('spoiled reissue prints a new number and marks the old one cancelled')
test('an offline cancel is queued and sent on reconnect')
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/cancel-dialog.test.tsx`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck` (the e2e specs written here run at the wave gate).

- [ ] **Step 5: Commit**

```bash
git add app/admin/receipts/counter/today components/seva/today lib/seva/strings/today.ts tests/unit/seva tests/e2e/seva
git commit -m "feat(seva): add today's receipts with cancel, reprint and spoiled reissue"
```

### Task A4-3: Close day page

Tier: **Opus medium** - the maths is in SQL (A2-2); this is a guided form.

Mockup: `counter.html#dayclose`.

**Files:**
- Create: `app/admin/receipts/day-close/page.tsx`, `components/seva/dayclose/{CashCount,UpiCheck,SentCheck,SeriesSummary,DayCloseSummaryPrint}.tsx`, `lib/seva/strings/dayclose.ts`
- Test: `tests/unit/seva/cash-count.test.tsx`, `tests/e2e/seva/day-close.spec.ts`

**Interfaces:**
- Consumes: `dayCloseApi` (A3-3), `counterApi.heartbeat` (A3-1), `pendingCount`, `todaysReceipts`, `pruneClosedDays` (A2-6), `buildDayWorkbook` (A2-7), `writeDayCopy`, `issuedToExportRow` (A3-7), `formatRupees` (A1-2).
- Produces: nothing used by other tasks.

Behaviour: DB §9.10 steps 1-7 in order. Denominations from `DayClosePrep.denominations`; coins listed by value ("Rs 10 coin x count"); a difference shows "Short Rs 80" / "Extra Rs 20" and the Close button waits for a note; "Sent to the office" must read "Nothing is waiting to send" (send a heartbeat first; with waiting items show the count and a "Send now" button); per-series first-last, issued, cancelled and gaps; Close prints the summary (print-styled HTML; A4 or slips per the printer test, DB §9.10 step 6), writes the day's Excel copy, then removes local receipts of earlier days that are already sent (`pruneClosedDays`); temple admins see "Reopen" with a reason on a closed day.

- [ ] **Step 1: Write the failing tests**

```ts
it('adds up notes and coins by value')            // 3 x Rs 500 + 2 x Rs 10 coin -> 'Rs 1,520'
it('shows short or extra against the expected cash and needs a note')
test('cannot close while receipts are waiting to send')
test('closing prints the summary and saves the Excel copy')
test('a temple admin can reopen with a reason')
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/cash-count.test.tsx`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck` (the e2e specs written here run at the wave gate).

- [ ] **Step 5: Commit**

```bash
git add app/admin/receipts/day-close components/seva/dayclose lib/seva/strings/dayclose.ts tests/unit/seva tests/e2e/seva
git commit -m "feat(seva): add the close-day page with denomination count and summary"
```

### Task A4-4: Receipt detail and print pages on Supabase; the public QR page

Tier: **Opus medium** - two rebuilt pages and one small public page over A3-2.

Mockups: `counter.html#receipt`, the register drawer in `dashboard.html#register`.

**Files:**
- Rewrite: `app/admin/receipts/[receiptId]/page.tsx`, `app/admin/receipts/[receiptId]/print/page.tsx`
- Create: `app/r/[token]/page.tsx` (Server Component), `components/seva/receipt/{ReceiptHistory,PublicReceiptView,PrasadamShortcut}.tsx`, `lib/seva/strings/receipt.ts`
- Test: `tests/unit/seva/public-receipt-view.test.tsx`, `tests/unit/seva/receipt-detail.test.tsx`

**Interfaces:**
- Consumes: `receiptsApi.get` (A3-2), `getPublicReceiptByToken` (A3-2), `rateLimit` (A2-4), `toSlipModel`, `ReceiptSlip`, `printSlips` (A2-11).
- Produces: nothing used by other tasks.

Behaviour: the detail page reads `params.receiptId` (a uuid) and shows the slip, payment, prasadam state and history (prints, cancel, prasadam, audit rows). The print page prints the slip (a reprint through `counterApi.prints` rules). `/r/<token>`: rate limit 30 requests a minute per IP (`headers()` `x-forwarded-for`, best effort per instance); shows exactly `PublicReceipt` with "Valid" or "Cancelled" and prasadam given or not, never the phone (C-50); unknown token -> "This receipt was not found." with status 404; a client island shows "Open in the prasadam counter" when `useSevaMe` says the visitor may give prasadam (DB §10.3).

- [ ] **Step 1: Write the failing tests**

```ts
it('public view shows the slip details and Valid, and never a phone')
it('public view shows Cancelled for a cancelled receipt')
it('detail page loads by params.receiptId and lists the history newest first')
it('shows the prasadam shortcut only to people who may give prasadam')
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/public-receipt-view.test.tsx tests/unit/seva/receipt-detail.test.tsx`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/receipts/[receiptId]" "app/r/[token]" components/seva/receipt lib/seva/strings/receipt.ts tests/unit/seva
git commit -m "feat(seva): rebuild receipt detail and print pages on Supabase and add the public QR page"
```

### Task A4-5: Prasadam counter

Tier: **Opus high** - phone-first screens with camera access and eight states; no amounts may ever show.

Mockups: `settings-devotee.html#scan`, `#scan-type`, `#scan-ok`, `#scan-future`, `#scan-marked`, `#scan-given`, `#scan-cancelled`, `#scan-notfound`.

**Files:**
- Create: `app/admin/prasadam/page.tsx`, `components/seva/prasadam/{ScanTypeSwitch,CameraScanner,NumberEntry,ResultCard,ChooseReceipt,GivenToday}.tsx`, `lib/seva/prasadam/camera.ts`, `lib/seva/strings/prasadam.ts`
- Test: `tests/unit/seva/prasadam-result.test.tsx`, `tests/e2e/seva/prasadam.spec.ts` (phone project)

**Interfaces:**
- Consumes: `prasadamApi` (lookup, give, undo - A3-2), `PrasadamLookupResult` (A3-2), `Segmented` (A1-6), `useSevaMe` (A3-6).
- Produces: `startScanner(video: HTMLVideoElement, onCode: (text: string) => void): Promise<() => void>` - `BarcodeDetector` (`qr_code`) where available, else `jsqr` on canvas frames every 200 ms; HTTPS needed (DB §11).

Behaviour: DB §11 table - equal-weight switch Scan QR / Type receipt number; the number box accepts a USB scanner ("A USB scanner types here and presses Enter for you"); "Given 36" today; green ready card with each seva (Kannada under) and what to hand over, **no amounts**; amber another-day card with "Give anyway" (second tap); marked card with Undo for 120 s (same person); already given "Given at 11:05 by Suresh. Do not give again. ..."; red cancelled card; no-prasadam card; not-found text with the typed value; a pick list for ambiguous short forms. Offline: "No connection. Check the date on the slip by eye and mark it later." (C-28). `?token=` in the URL (from `/r/<token>`) looks up at once.

- [ ] **Step 1: Write the failing tests**

```ts
it('renders each lookup state with its colour and actions')     // table over the 7 states
it('never renders an amount')                                   // no text matching /Rs\s?\d/ in any state
test('typed number -> ready -> Mark given -> Undo within the time')
test('a second lookup says already given, by whom and when')
test('a slip for another day needs Give anyway')
test('scanner-typed URL in the number box finds the receipt')   // fill 'https://site/r/<token>' + Enter
test('an ambiguous short number shows a pick list')
test('offline shows the check-by-eye message')
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/prasadam-result.test.tsx`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck` (the e2e specs written here run at the wave gate).

- [ ] **Step 5: Commit**

```bash
git add app/admin/prasadam/page.tsx components/seva/prasadam lib/seva/prasadam lib/seva/strings/prasadam.ts tests/unit/seva tests/e2e/seva
git commit -m "feat(seva): add the prasadam counter with QR scan and typed lookup"
```

### Task A4-6: Dashboard

Tier: **Opus high** - the trustees' main screen; order, charts and accessibility rules are exact.

Mockups: `dashboard.html#home`, `#home-phone`.

**Files:**
- Rewrite: `app/admin/receipts/page.tsx` (the old Firestore list moves to the register in A4-7)
- Create: `components/seva/dashboard/{PeriodSwitch,NeedsAttention,SummaryTiles,HeroChart,DetailCharts}.tsx`, `lib/seva/dashboard/attention-text.ts`, `lib/seva/strings/dashboard.ts`
- Test: `tests/unit/seva/attention-text.test.ts`, `tests/unit/seva/summary-tiles.test.tsx`, `tests/e2e/seva/dashboard.spec.ts` (desktop and phone)

**Interfaces:**
- Consumes: `reportsApi.dashboard` (A3-3), `DashboardData`, `NeedsAttentionCard` (A2-3), `EChart` (dynamic, `ssr: false`), option builders, `readChartColors` (A2-10), `Segmented` (A1-6).
- Produces: `attentionText(card: NeedsAttentionCard): { title: string; titleKn: string; line: string; href: string | null }` - DB §12.2 links (changed amounts -> `/admin/receipts/register?status=changed`, cancellations -> `?status=cancelled`, gaps -> register continuity, prasadam -> `?status=prasadam_pending`, day close -> `/admin/receipts/day-closes`, clock skew -> `/admin/receipts/settings/counters`).

Behaviour: DB §12.1 order, same on desktop (1366 px) and phone (390 px): title, date and "as of 18:05" with the period switch first; Needs attention; tiles Total collected, Receipts, Cash, UPI and a quiet Online tile "starts in Phase 2", each with "+12%" / "-5%" or "no data"; the Collections hero chart; details (top sevas, payment mode, rush hours, festival peaks - on the first screen for This year). Data refreshes when the period changes; switching stays under 2 s with the 60-second cache. Receptionists are sent to the counter (C-59). An "Export" link goes to `/admin/receipts/reports/export`.

- [ ] **Step 1: Write the failing tests**

```ts
it('writes each attention card and links it to the right filtered screen')
it('shows change against the previous period or no data')   // prev 1000, now 1120 -> '+12%'; prev null -> 'no data'
test('the period switch comes first and drives every number')  // click 'This week' -> fake got period=week; tiles change
test('desktop and phone show the same order')                 // section headings order equal in both projects
test('each chart has a hidden data table')
test('a receptionist is sent to the counter')
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/attention-text.test.ts tests/unit/seva/summary-tiles.test.tsx`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck` (the e2e specs written here run at the wave gate).

- [ ] **Step 5: Commit**

```bash
git add app/admin/receipts/page.tsx components/seva/dashboard lib/seva/dashboard lib/seva/strings/dashboard.ts tests/unit/seva tests/e2e/seva
git commit -m "feat(seva): add the seva dashboard with period switch, needs attention, tiles and charts"
```

### Task A4-7: Register, number continuity and gaps, reports (seva summary, festival view, audit trail), day closes

Tier: **Opus high** - several dense screens; continuity and gap handling are audit-critical.

Mockups: `dashboard.html#register`, `#sevas`, `#range`, `#fest`, `#audit`, `#dayclose`.

**Files:**
- Create: `app/admin/receipts/register/page.tsx`, `app/admin/receipts/reports/layout.tsx` (tabs: Seva summary, Festival view, Audit trail, Export, Board summary), `app/admin/receipts/reports/page.tsx` (Seva summary), `reports/festival/page.tsx`, `reports/audit/page.tsx`, `app/admin/receipts/day-closes/page.tsx`
- Create: `components/seva/register/{RegisterFilters,RegisterTable,ReceiptCards,ContinuityCard,GapResolveDialog,ReceiptDrawer}.tsx`, `components/seva/reports/{SevaSummary,FestivalView,AuditTrail,DayCloseList,DayCloseDetail}.tsx`, `lib/seva/strings/reports.ts`
- Test: `tests/unit/seva/continuity-card.test.tsx`, `tests/e2e/seva/register-reports.spec.ts`

**Interfaces:**
- Consumes: `receiptsApi` (list, get, resolve gap - A3-2), `reportsApi` (continuity, seva summary, festival, audit, day closes - A3-3), `EChart`, `treemapOption`, `festivalBarsOption` (A2-10), `ReceiptListItem` (A3-2), `ContinuityRow` (A2-3).
- Produces: the reports layout's tab list (the Export and Board summary tabs point at pages built by A4-8).

Behaviour: DB §12.3-12.4. Register filters (from, to, seva, payment, status, search) map to the list query; rows below 768 px become cards; a row opens the drawer with history. Continuity card text per series, for example "C1 Counter 1 online, C1-023-10-2026/000101 - 000227, 127 numbers, 125 issued, 2 cancelled, Continuous"; W shows "starts in Phase 2"; an open gap is critical with "Resolve" (temple admin) -> dialog: entered from paper / declared lost + note. Seva summary by seva date with last year ("no data" in the first year) and rate-change lines under the seva name; treemap "Where the money comes from / ಸೇವಾ ಪಾಲು". Festival view per DB §12.4. Audit trail filters by type and person; each entry says who, when, why with a link. Day closes list with balanced / short / extra badges and a detail with counts and the note.

- [ ] **Step 1: Write the failing tests**

```ts
it('writes the continuity line for a continuous series and flags an open gap')
test('filters map to the list query and the status filter from a link is applied') // goto '?status=changed' -> fake got status=changed
test('a temple admin resolves a gap with a note')
test('rows become cards on a phone')
test('audit trail filters by type')
test('day closes show balanced, short and extra')
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/continuity-card.test.tsx`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck` (the e2e specs written here run at the wave gate).

- [ ] **Step 5: Commit**

```bash
git add app/admin/receipts/register app/admin/receipts/reports/layout.tsx app/admin/receipts/reports/page.tsx app/admin/receipts/reports/festival app/admin/receipts/reports/audit app/admin/receipts/day-closes components/seva/register components/seva/reports lib/seva/strings/reports.ts tests/unit/seva tests/e2e/seva
git commit -m "feat(seva): add the receipts register with continuity, the reports and the day-close list"
```

### Task A4-8: Export page and the board print summary

Tier: **Opus medium** - wiring A2-7 builders to paged data; formats are fixed.

Mockup: `dashboard.html#export`.

**Files:**
- Create: `app/admin/receipts/reports/export/page.tsx`, `app/admin/receipts/reports/summary/page.tsx` (print-styled A4, two pages), `components/seva/export/{ExportForm,BoardSummary}.tsx`, `lib/seva/export/collect.ts`, `lib/seva/strings/export.ts`
- Test: `tests/unit/seva/export-collect.test.ts`, `tests/e2e/seva/export.spec.ts`

**Interfaces:**
- Consumes: `reportsApi.export`, `reportsApi.exportAudit` (A3-3), `buildExportWorkbook`, `lineCsv`, `tallyRows`, `buildCsv`, `zipFiles` (A2-7), `heroOption` (A2-10).
- Produces: `collectExportData(p: { from: string; to: string; parts: string[]; includePhones: boolean }, api): Promise<ExportData>` (pages until `nextCursor` is null).

Behaviour: DB §12.6. Ranges Today, This month, Last month, This year, custom; formats Excel (seven sheets), CSV (ticked parts zipped), Tally import, Print summary (opens `/admin/receipts/reports/summary?from&to`; large type; page 1 totals, the Collections chart and needs-attention items; page 2 seva table with last year, day-close differences, cancellations and changed amounts with reasons, rate changes; footer with range, who prepared it and when, and the blessing; "Save as PDF" from the browser, C-42). "Devotee phone numbers" checkbox off by default and shown only to people with `export.with_phones`. Every download posts the export audit.

- [ ] **Step 1: Write the failing tests**

```ts
it('pages through every part until nextCursor is null')
test('the phone checkbox is hidden for a view-only temple admin')
test('Excel download has seven sheets')                     // read the downloaded file with exceljs
test('CSV parts download as one zip; Tally has its header row')
test('every download writes the export audit')
test('the board summary prints on two A4 pages')            // page.pdf with preferCSSPageSize -> 2 pages of 595.3 x 841.9 pt
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/export-collect.test.ts`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck` (the e2e specs written here run at the wave gate).

- [ ] **Step 5: Commit**

```bash
git add app/admin/receipts/reports/export app/admin/receipts/reports/summary components/seva/export lib/seva/export/collect.ts lib/seva/strings/export.ts tests/unit/seva tests/e2e/seva
git commit -m "feat(seva): add Excel, CSV and Tally export and the board print summary"
```

### Task A4-9: Settings - sevas, festival days, cash denominations

Tier: **Opus medium** - CRUD screens over A3-4 with the rules in DB §13.1, §13.3, §13.4.

Mockups: `settings-devotee.html#sevas` (with `sevas-drawer`), `#festival-days`, `#cash-denominations`.

**Files:**
- Rewrite: `app/admin/receipts/seva-settings/page.tsx`
- Create: `app/admin/receipts/settings/layout.tsx` (tabs: Receipts, Counters, Counter rules, Denominations, Festival days), `settings/denominations/page.tsx`, `settings/festival-days/page.tsx`, `components/seva/settings/{SevaTable,SevaDrawer,RateHistory,FestivalEditor,DenominationEditor}.tsx`, `lib/seva/strings/settings.ts`
- Test: `tests/unit/seva/seva-drawer.test.tsx`, `tests/e2e/seva/settings-sevas.spec.ts`

**Interfaces:**
- Consumes: `catalogueApi`, `settingsApi` (A3-4), `useSevaMe` (A3-6), `components/ui/ImageUploader` (existing).
- Produces: the settings tab layout used by A4-10's pages.

Behaviour: list columns Key (drag to reorder; it is the counter number key), Code, Seva (English, Kannada under), Rate, Counter / online / both, Several dates, Prasadam, Active, Edit. Drawer fields per DB §13.1; a rate change shows "Was Rs 1,005. Receipts already made keep their rate." and needs a reason; Other Seva / Karnike is counter-only with any amount; sevas are switched off, never deleted. Festival days with one or more dates and Kannada names; "Copy from festival calendar" is built only if an existing festival date source is found in `lib/aaradhane/` or `data/` (check first; otherwise leave the button out and record that in the wave report - DB §13.4 says the source is UNCLEAR). Denominations: add (kind, value 1-2,000), hide, reorder, preview "Rs 10 coin x count"; "Changes apply from the next day close". View-only temple admins see everything read-only.

- [ ] **Step 1: Write the failing tests**

```ts
it('needs a reason when the rate changes and shows the old rate')
it('forces Other Seva to counter-only with any amount')
test('dragging a seva changes its counter key')
test('a denomination of Rs 2,500 is refused')
test('a festival with three dates appears as a chip source')
test('view-only temple admins cannot edit')
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/seva-drawer.test.tsx`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck` (the e2e specs written here run at the wave gate).

- [ ] **Step 5: Commit**

```bash
git add app/admin/receipts/seva-settings app/admin/receipts/settings/layout.tsx app/admin/receipts/settings/denominations app/admin/receipts/settings/festival-days components/seva/settings lib/seva/strings/settings.ts tests/unit/seva tests/e2e/seva
git commit -m "feat(seva): add seva, festival-day and denomination settings"
```

### Task A4-10: Settings - receipt template and numbering, counters and devices, counter rules

Tier: **Opus high** - device registration handles the counter's secret; the slip preview must match the real slip.

Mockup: `settings-devotee.html#receipt-settings` (`rs-replace`, header/footer editor).

**Files:**
- Create: `app/admin/receipts/settings/page.tsx` (redirects to `settings/receipt`), `settings/receipt/page.tsx`, `settings/counters/page.tsx`, `settings/rules/page.tsx`, `components/seva/settings/{NumberingPreview,HeaderFooterEditor,SlipPreview,CounterList,RegisterThisPc,ReplaceThisPc,CounterRulesForm}.tsx`
- Test: `tests/unit/seva/numbering-preview.test.tsx`, `tests/e2e/seva/settings-receipt.spec.ts`

**Interfaces:**
- Consumes: `settingsApi` (A3-4), `counterApi.registerDevice`, `counterApi.replaceDevice` (A3-1), `newDeviceSecret`, `sha256HexBrowser`, `saveDeviceCredentials`, `openSevaDb` (A2-6), `toSlipModel`, `ReceiptSlip` (A2-11), `formatReceiptNo` (A1-2), `ImageUploader`.
- Produces: nothing used by other tasks (A4-1 links to `/admin/receipts/settings/counters`).

Behaviour: DB §13.2. Numbering preview part by part with the four formats and the line "The running number continues all year and starts again on 1 January". Header and footer editor with a live slip preview (English name first, Kannada under, C-03), photos through `ImageUploader`, which devotee details print. Counters: list with series and last numbers, "+ Add a counter (C2 and OF2)", opening float, "Register this PC" (the PC makes a 32-byte secret, sends only its SHA-256, stores the secret locally), "Replace this PC" (type the number on the last slip that came out and a reason; warns that any unsent range becomes a gap). Counter rules: cancel window, note for a cash difference, reason for a changed amount, days ahead, day-close flag threshold.

- [ ] **Step 1: Write the failing tests**

```ts
it('previews the four numbering formats and the yearly restart line')
test('register this PC sends only the hash and stores the secret locally')  // request body secretHash /^[0-9a-f]{64}$/, no 'secret' field
test('replace this PC needs the last slip number and a reason')
test('the slip preview follows the header fields')
test('counter rules save and are audited')                                 // fake got PUT /settings/rules
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/numbering-preview.test.tsx`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck` (the e2e specs written here run at the wave gate).

- [ ] **Step 5: Commit**

```bash
git add app/admin/receipts/settings/page.tsx app/admin/receipts/settings/receipt app/admin/receipts/settings/counters app/admin/receipts/settings/rules components/seva/settings tests/unit/seva tests/e2e/seva
git commit -m "feat(seva): add receipt template, numbering preview, counters and device registration settings"
```

### Task A4-11: Staff and roles

Tier: **Opus high** - the UI for role grants and offboarding; must mirror the server rules exactly.

Mockups: `settings-devotee.html#staff`, `onboard-dialog`, `staff-drawer`.

**Files:**
- Modify: `app/admin/users/page.tsx` (tabs: "Staff and roles" first, the existing account list second as "All accounts"), `app/admin/users/new/page.tsx` (opens the onboard dialog on the staff tab), `components/admin/users/UserRoleBadge.tsx` (labels for the four seva roles)
- Create: `components/seva/staff/{StaffList,OnboardDialog,StaffDrawer}.tsx`, `lib/seva/strings/staff.ts`
- Test: `tests/unit/seva/staff-drawer.test.tsx`, `tests/e2e/seva/staff.spec.ts`

**Interfaces:**
- Consumes: `staffApi` (A3-5), `useSevaMe` (A3-6), Firebase client `sendPasswordResetEmail` (C-56).
- Produces: nothing used by other tasks.

Behaviour: DB §13.6 and §3.4. List: staff no., name and email, role, view-only badge, status (Active, Invited, Inactive), last active; filter All / Active / Inactive; the line "Inactive staff cannot sign in and stay for the audit trail." Onboard: staff no. pre-filled, full name, email, role (Super admin offered only to super admins), view-only (temple admins only); after success the client sends Firebase's set-password email and says so. Drawer: role, view-only, Reactivate (temple admin or super admin); "Offboard (deactivate)" and "Delete user" only for super admins, each needing a reason; delete warns "Deactivating is usually right. Past receipts keep the name and staff no." A partial failure shows which step failed.

- [ ] **Step 1: Write the failing tests**

```ts
it('offers Super admin only to super admins and view-only only for temple admins')
it('needs a reason to offboard or delete and warns before delete')
test('onboarding pre-fills the next staff number and sends the set-password email')
test('a temple admin does not see Offboard or Delete')
test('a partial failure names the step that failed')
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/staff-drawer.test.tsx`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck` (the e2e specs written here run at the wave gate).

- [ ] **Step 5: Commit**

```bash
git add app/admin/users components/admin/users/UserRoleBadge.tsx components/seva/staff lib/seva/strings/staff.ts tests/unit/seva tests/e2e/seva
git commit -m "feat(seva): add staff onboarding, roles, view-only and offboarding screens"
```

**Wave A4 gate - owner's 10-minute checklist (DB §19.2)** - on the Vercel preview of `feature/seva-entry` pointed at the Supabase test project (the orchestrator asks before pushing), or on the builder's PC:
1. Make a 3-date receipt using only the keyboard.
2. Print it (office printer if set up, otherwise Save as PDF) and check the slip size and Kannada.
3. Switch off Wi-Fi and make one receipt; switch it on and see "0 waiting".
4. At the prasadam page, type the number from a slip and mark prasadam given.
5. Open the dashboard on your phone and switch the period.
6. Scan one slip's QR with your phone camera and check the details page shows no phone number.

---

## Wave A5 - Switch-over, documentation and final verification (A5-1 and A5-2 in parallel, then A5-3)

### Task A5-1: Retire the Firestore Receipt Book code and point its consumers at the new flow

Tier: **Opus high** - wide deletion across pages, APIs, services and tests; must leave nothing importing the old modules (DB §17.2, C-40).

**Files:**
- Delete: `app/api/admin/receipts/**` (includes the `send` stub), `app/api/admin/receipt-sevas/**`, `lib/receipt/admin.ts`, `lib/receipt/numbering.ts`, `lib/receipt/validation.ts`, `lib/receipt/pdf.ts`, `services/receipt.service.ts`, `services/receiptSeva.service.ts`, `types/receipt.ts`, `types/receiptSeva.ts`, `types/receipt-extensions.ts`, `scripts/seed-receipt-sevas.ts`, `tests/unit/receipt-numbering.test.ts`, `tests/unit/receipt-validation.test.ts`, and the PDF cases of `tests/unit/receipt-payment.test.ts` (keep its UPI URL cases - `lib/receipt/upi.ts` stays, the counter uses it)
- Modify: `app/seva/(desk)/create/page.tsx` (redirect to `/seva/counter`; wave A4S moved the module to `/seva`), `app/admin/reports/page.tsx:103,185-332` (remove the Firestore receipt loader and CSV; the Receipts card links to `/seva/reports`), `app/actions/sevas.ts` and `services/seva.service.ts` (filter `visibility in ('online','both')`), `package.json` (remove the `seed-receipt-sevas` script)
- Test: `tests/unit/seva/public-sevas-visibility.test.ts`, `tests/unit/seva/no-old-receipt-imports.test.ts`

**Interfaces:**
- Consumes: everything from A3/A4 that replaces these files.
- Produces: no import of the deleted paths anywhere.

- [ ] **Step 1: Write the failing tests**

```ts
it('the public seva action returns only online and both sevas')         // mocked createAdminClient query has .in('visibility', ['online','both'])
it('no file imports the retired Receipt Book modules')                   // scan app, components, services, lib, hooks, types, tests for '@/lib/receipt/(admin|numbering|validation|pdf)', '@/services/receipt(Seva)?.service', '@/types/receipt'
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/public-sevas-visibility.test.ts tests/unit/seva/no-old-receipt-imports.test.ts`.

- [ ] **Step 3: Delete and modify** as listed; find every importer first with `git grep -n "lib/receipt/\|receipt.service\|receiptSeva.service\|types/receipt"`.

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck` and `npm test -- tests/unit/receipt-payment.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add -A app/api/admin "app/seva/(desk)/create" app/admin/reports app/actions/sevas.ts services lib/receipt types scripts tests package.json
git commit -m "refactor(seva): retire the Firestore Receipt Book code; public sevas follow visibility"
```

### Task A5-2: Documentation updates

Tier: **Opus high** - documents written from the built code and the book; must stay accurate.

**Files:**
- Modify: `docs/ARCHITECTURE.md` (Seva Entry section: lanes, flows F1-F4, server-only Supabase access, identity adapter), `docs/DATA-MODEL.md` (every seva table and function), `docs/API.md` (every `/api/seva/*` route with method, who, body and answer), `docs/SECURITY.md` (allow-list, device token, RLS deny-all, audit, backups, the key revocation), `docs/UI-GUIDELINES.md` (module tokens under `.seva`, Kannada under English, 13 px floor, the departures table of DB §18), `docs/ADMIN-GUIDELINES.md` (Receipt Book pages and who sees them), `docs/SUPABASE_MIGRATIONS.md` (the six seva files and how they were tested), `docs/CHANGELOG.md`
- Create: `docs/seva/README.md` (module map; runbook: resolve a number gap, replace a counter PC, reopen a day, restore drill pointer, what to do when the printer jams)
- Test: `tests/unit/seva/docs-coverage.test.ts`

**Interfaces:**
- Consumes: the merged code of waves A1-A4 and A5-1.
- Produces: docs only. AGENTS.md's `type-check` wording and "Next.js 14" stay as they are (noted, out of scope, DB §17.4).

- [ ] **Step 1: Write the failing test**

```ts
it('DATA-MODEL.md names every seva table')     // every 'create table if not exists public.<name>' in *_seva_*.sql appears in docs/DATA-MODEL.md
it('API.md names every seva route')            // every app/api/seva/**/route.ts path (as /api/seva/...) appears in docs/API.md
it('docs name no office company or its theme') // boundary words check over the changed docs
```

- [ ] **Step 2: Run it and see it fail**: `npx jest tests/unit/seva/docs-coverage.test.ts`.

- [ ] **Step 3: Write the docs.**

- [ ] **Step 4: Run it and see it pass.**

- [ ] **Step 5: Commit**

```bash
git add docs tests/unit/seva/docs-coverage.test.ts
git commit -m "docs(seva): document the seva module - architecture, data model, API, security, UI, runbook"
```

### Task A5-3: Final verification and whole-branch review

Tier: **Opus xhigh** - the last gate before the owner's dry run; reviews security, money and numbering across the branch.

**Files:**
- Create (git-ignored): `$STATE/test-reports/A-FINAL-TEST-REPORT.md`
- Modify: only files a finding requires, each fix as its own commit with a test.

**Interfaces:**
- Consumes: the whole branch.
- Produces: the final report with: every suite's counts (unit, route, database, rules, e2e, build, static migration check, `./scripts/test-boundary.sh`); performance against DB §9.12 (time of `seva_issue_counter_order` over 200 runs in PGlite as a rough indicator, Save-to-print time in Playwright with the fake API, dashboard load) - measured, not asserted; the DB §20.2 go-live checklist with each line marked "done in the build", "owner action" or "not yet"; the Review Focus list with the test that pins each line; open items still needed from the office (O-01...O-12); the owner's 10-minute checklist.

- [ ] **Step 1: Run every suite in `$WT`**

`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run test:rules`, `npm run test:e2e:seva`, `npm run verify:supabase-migrations:static`, `npm run build`, `bash ./scripts/test-boundary.sh`. Expected: all pass except failures already in the A0 baseline.

- [ ] **Step 2: Whole-branch review**

Review `git diff main...feature/seva-entry` against the Design Book: every row of DB §3.3 enforced on the server; no browser path to Supabase (`git grep -n "lib/supabase/client" -- app/seva components/seva hooks/seva services/seva` returns nothing); no phone in any slip, prasadam answer, audit JSON or default export; no secret values; no office-company naming. Record each finding with file:line, fix it test-first, commit.

- [ ] **Step 3: Full-stack smoke (only with the owner's go-ahead in that session)**

With the Supabase test project from SETUP-GUIDE section 1 and the owner's own `.env.local` in `$WT` (never copied by the builder): apply the six seva migrations to the test project, create staff 001 with `scripts/seva/create-first-super-admin.ts`, run the counter once end to end against it, and record the result. Without the go-ahead, mark it "not yet" in the report.

- [ ] **Step 4: Write the final report** with the contents listed under Produces.

- [ ] **Step 5: Commit** any fixes (each already committed in Step 2); the report itself is git-ignored.

**Wave A5 gate - owner's 10-minute checklist**
1. Read the final report's first page (suite counts and the go-live checklist status).
2. Repeat the A4 checklist on the full-stack smoke build if Step 3 ran.
3. Generate the backup key (SETUP-GUIDE section 4) and set the two backup secrets; the next night's run should appear in "Needs attention" as a fresh backup.
4. Decide whether to merge `feature/seva-entry` now or after Plan B.

---

## Self-review (writing-plans checklist, run 2026-10-18)

**1. Spec coverage.** Each Design Book section mapped to its tasks:

| DB section | Tasks |
|---|---|
| §2 goals 1-7, 9, 10 | A2-5, A4-1 (1); A1-1, A2-1, A2-6 (2); A1-2, A2-1, A2-5 (3); A2-6, A3-7, A4-1 (4); A2-2, A3-2, A4-5 (5); A2-3, A2-10, A4-6 (6); A1-6 (7); A1-4, A1-5, A2-4, A3-5 (9); A0-2, A1-4, A2-12 (10) |
| §3 roles, matrix, lifecycle | A1-4, A2-3, A2-4, A3-1 (`me`), A3-5, A3-6, A4-11 |
| §6 architecture, API surface (Phase 1 rows) | A2-4, A3-1 to A3-5 |
| §7 data model, functions, migrations | A1-1, A2-1, A2-2, A2-3, A3-5 (first super admin script) |
| §8 numbering, devices, rollover, in-doubt | A1-1, A1-2, A2-1, A2-2, A2-6, A4-1, A4-10 |
| §9 counter, override, pay, keyboard, print, cancel, close day, offline | A2-5, A2-6, A2-11, A3-7, A4-1, A4-2, A4-3 |
| §10 slip, print CSS, QR | A1-2, A2-11, A4-4 |
| §11 prasadam | A2-2, A3-2, A4-5 |
| §12 dashboard, attention, register, reports, charts, exports | A2-3, A2-7, A2-10, A3-3, A4-6, A4-7, A4-8 |
| §13.1-13.4, 13.6 settings and staff | A2-3, A3-4, A3-5, A4-9, A4-10, A4-11 |
| §15 security and privacy | A1-4, A1-5, A2-4, A3-2, A4-4, Global Constraints |
| §16 backups | A2-8, A2-9 (§5 restore drill) |
| §17 extend / replace / faults | A1-4, A1-5, A1-6, A3-4 (mirror), A3-6, A4-4, A4-6, A4-9, A4-11, A5-1 |
| §18 UI system | A1-6, every A4 task |
| §19 tests and run policy | A0-2, A1-4, A2-12, How to run this plan, wave gates |
| §20 rollout and go-live | A2-9 (counter PC), A5-3 (checklist status) |
| §13.5, §14 (Phase 2) | Plan B; the app parts in Plan C |

Gaps found while reviewing and fixed in this plan: the counter's clock-skew warning, the 250 ms returning-devotee search and the "Changed" chip were missing from A4-1 (added); local receipts were never pruned after a close (A4-3 now calls `pruneClosedDays`); receptionists landing on `/admin` would hit Firestore counts their role cannot read (A3-6 redirects them); the slip print root was cleared before a test could render it to PDF (A2-11 clears on `afterprint`); A4 tasks consumed `receiptsApi`, `prasadamApi`, `reportsApi` and `dayCloseApi` methods no task defined (named in A3-2 and A3-3); parallel tasks in A1 imported each other (A1-2 now throws `RangeError` and owns `Period`; A1-3 uses the QR regex literal); several A2/A3 tasks would have edited `types/seva.ts` at once (area DTO files instead); per-task Playwright runs contradicted the run policy (removed; only the harness task runs its smoke spec); DB §17.1 asks to reuse `lib/format.ts` but its output does not match the slip text (A1-2 explains and leaves it unchanged).

Deliberately not built in Plan A (with reason): Background Sync (a service worker has no Firebase token to send with; the outbox sends on `online` and every 30 s while the page is open); dashboard tile sparklines (optional, DB §12.5 row 2); the pace gauge (Later); a two-connection concurrency test (counters use separate series; W-series contention is a Plan B spike); performance targets (measured in A5-3, not asserted).

**2. Step scan.** Every test step names its tests with the spec's values; every code step gives the file and signature; commands have expected results; the one algorithm the signatures do not determine (the counter submitter) is given as pseudo-code in A2-6. No "TBD", "handle edge cases" or "add appropriate validation" lines.

**3. Type consistency.** Checked across tasks: `CounterOrderPayload`, `OfflineOrderPayload`, `IssuedReceipt`, `IssueResponse`, `OutboxItem`, `SyncResponse`, `CounterBootstrap`, `SevaMe`, `SevaActor`, `SevaAction`, `PermissionContext`, `SlipSettings`, `SlipModel`, `DayClosePrep`, `DashboardData`, `NeedsAttentionCard`, `ContinuityRow`, `ExportReceiptRow`, `PrasadamLookupResult`, `ReceiptListItem`, `StaffMember`, `FolderStatus`; functions `requireSevaActor`, `callRpc`, `sevaJson`, `sevaErrorResponse`, `sevaFetch`, `counterApi`, `meApi`, `receiptsApi`, `prasadamApi`, `reportsApi`, `dayCloseApi`, `catalogueApi`, `settingsApi`, `staffApi`, `groupLinesByDate`, `periodRange`, `parseLookupInput`, `takeOfflineNumbers`, `createCounterSubmitter`, `toSlipModel`, `printSlips`, `buildDayWorkbook`, `createExcelCopyScheduler`, `useSevaMe`. SQL names match DB §7.8 except the three marked extensions (`p_at`, `p_qr_token`, `p_is_admin`) and the added functions listed in A2-2 and A2-3.

**4. Review Focus.** Five lines above, each with its pinned tests: A2-1 / A2-6 / A4-1 (catalogue change); A1-1 / A1-2 / A2-1 / A2-3 / A2-6 (midnight and clock); A2-1 / A2-5 / A2-6 / A4-1 (double submit); A1-2 / A3-2 / A4-5 (lookup input); A1-3 / A2-11 / A4-1 (devotee text).

**5. Proportion.** Plan A is about 2,640 lines in two files against the 1,846-line spec (about 1.4 times), split by wave because it passed 2,200 lines. Most of the length is test names with the spec's values and the cross-task Interfaces blocks that parallel implementers need; code blocks are signatures and assertions, not bodies.

**Execution handoff (for the orchestrator).** Recommended method: **subagent-driven**, because the waves hold up to 12 independent tasks whose only coupling is the Interfaces blocks, and a shipped mistake in numbering, money or roles costs more than a fresh reviewer per task. Plan complete and saved to `.claude/state/seva/plan/2026-10-18-seva-entry-plan-A-phase1.md` and `...-plan-A-phase1-part2.md` (copied to `docs/superpowers/plans/` by Task A0-1); the owner reviews it and confirms before Step 2 starts.

END OF REPORT
