# Seva Entry Phase 2 (website + Cashfree test mode) Implementation Plan (Plan B) - OUTLINE

> **For agentic workers:** this is an outline. Before its window, expand each task with superpowers:writing-plans into full steps (failing test, run, implement signature, run, commit), then execute with superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax once expanded.

**Goal:** Let signed-in devotees book online sevas on the website and pay by UPI through Cashfree in test mode, with server-verified payments, W/WT e-receipts (one per seva date), refunds by admins, and a Payments status page - built in full so going live is two owner steps (DB §14.6).

**Architecture:** Same shape as Plan A: pages call only `app/api/seva/**`; money writes go through SQL functions; the gateway sits behind one `PaymentProvider` interface (`lib/seva/payments/*`, DB §14.2) with a Cashfree implementation chosen by `PAYMENTS_PROVIDER` / `PAYMENTS_MODE`. A webhook never creates a receipt from its payload: it is verified (raw-body HMAC), recorded idempotently, and only triggers a server re-fetch of the order from the gateway (DB §14.3).

**Tech Stack:** Plan A's stack plus Cashfree PG (REST, test/sandbox mode) and the Cashfree web checkout SDK (`@cashfreepayments/cashfree-js`, added in B0-2).

**Spec:** `docs/seva/DESIGN-BOOK.md` §4 (Phase 2 row), §6.2 F5, §6.5 (Phase 2 rows), §7.7, §7.8 (payment functions), §12.2 (payments row), §13.5, §14, §15; decisions D14, D15, D16, D27; calls C-07, C-10, C-18, C-29, C-43 to C-47, C-64. `$STATE/research/R1-payments.md` and `R1V-verify.md` (R1V wins).

## Global Constraints

Plan A's Global Constraints apply verbatim (`2026-10-18-seva-entry-plan-A-phase1.md`). In addition:

- **UPI only** online; no card, net banking or wallet anywhere (Round B - devotee). The fee rule stays **off**; any rule naming `upi` or a debit card is refused by the SQL function (R1V C1-C4). The checkout says "No extra charges" (D15).
- **Keys and mode live only in Vercel env:** `PAYMENTS_PROVIDER=cashfree`, `PAYMENTS_MODE=test|live`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` (names final in B0-2). Never in the database, the admin UI, the client bundle or logs.
- **Test mode** issues series **WT** (`WT-WEB-...`, `WT-APP-...`), `test_mode = true`, excluded from totals, register, continuity and exports (C-18); the Payments page and the checkout show "Test mode: no real money moves."
- **W numbers:** `W-WEB-MM-YYYY/NNNNNN` and `W-APP-...` share one running number (C-07); one receipt per seva date, issued only after the gateway confirms the full amount in INR.
- **Online dates:** today to 90 days ahead; same-day bookings close at 12:00 IST (C-29). Only sevas with visibility `online` or `both`; fixed prices only ("Need a different amount? Please visit the counter.").
- **Rate limit:** at most 10 open orders per account per hour (DB §14.3).
- **Every rupee gets a receipt:** money confirmed after expiry or after the seva date still issues receipts; an admin decides on a refund (C-45). A refund cancels the chosen receipts with reason `refunded` when requested; a failed refund is critical in Needs attention (C-46).
- Cashfree's current PG API and webhook formats are **UNCLEAR for PG orders** in the spec (DB §14.3): the first step of B1-2 confirms them on Cashfree's own docs (URL + date) before any code.

## Review Focus (to pin when the plan is expanded)

1. **Webhook replay, duplicates and out-of-order events** -> one set of receipts; duplicates answer 200 at once. Pin in B1-1 (`seva_record_payment_event` unique `event_key`) and B2-2 (route).
2. **Amount, currency or order-ref mismatch from the gateway** -> no receipt, `payment.amount_mismatch` audit, critical attention, still 200. Pin in B2-2.
3. **Paid after expiry, or for a seva date already past** -> receipts issued, admin told (C-45). Pin in B1-1 and B2-3.
4. **The devotee closes the browser or app mid-payment / pays twice** -> pending page re-checks by itself; "possible double payment" attention (same account, seva and dates, two paid orders within 30 minutes). Pin in B2-1, B2-4.
5. **Two webhooks for different orders at the same moment** -> W numbers stay consecutive and unique (row lock in `seva_take_numbers`). Pin in B1-1 with a two-connection test (spike `embedded-postgres` if PGlite cannot hold two sessions; Plan A deferred this here).

## Dependencies on Plan A

Plan B starts after Plan A's wave A5 is merged. It reuses: tables and seed W/WT series (A1-1; `seva_orders.payment_order_id` and its online check); `seva_take_numbers`, `seva_next_group_no`, the receipt insert pattern (A2-1); the dashboard and attention functions (A2-3, extended here); the identity adapter and actor guard (A2-4 - devotees get a new `requireDevotee` helper); wire types, schemas and the domain lists (A1-3); `toSlipModel` / `ReceiptSlip` (A2-11) for e-receipts; `getPublicReceiptByToken` and `/r/<token>` (A3-2, A4-4); `SearchSelect`, `Segmented`, tokens (A1-6); the Playwright harness and fake API (A2-12); SETUP-GUIDE (A2-9, section 8 is written here).

---

## Wave B0 - Setup (sequential)

### B0-1: SETUP-GUIDE section 8 - Cashfree test account
- Tier: **Opus high** - a click-by-click guide for someone who has never used Cashfree; must check Cashfree's current screens on the web first (cite URL + date; mark unconfirmed steps UNVERIFIED).
- Files: `docs/seva/SETUP-GUIDE.md` (replace the section 8 placeholder; add `## 10. Going live with Cashfree (later)` describing DB §14.6's two steps and the prerequisites of §14.7 / O-13, O-14).
- Content: create a merchant account, switch to test (sandbox) mode, find the test App ID and Secret Key, put them in Vercel env for Preview only, set the webhook URL `https://<preview-site>/api/seva/payments/webhook/cashfree`, make a test UPI payment with Cashfree's test UPI ids.
- Test intent: `tests/unit/seva/setup-guide.test.ts` extended - section 8 and 10 headings exist, cite a checked source, contain no secret material.

### B0-2: Dependencies, env names and migration slot
- Tier: **Sonnet** - one install and name-only edits.
- Files: `package.json`, `package-lock.json` (`@cashfreepayments/cashfree-js`), `.env.example` (names only: `PAYMENTS_PROVIDER`, `PAYMENTS_MODE`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `SEVA_CRON_SECRET`), and decide the migration names `20261101000000_seva_payments.sql`, `20261101000100_seva_functions_payments.sql` (use the build date; keep the order after Plan A's files).
- Test intent: `npm run typecheck` unchanged.

## Wave B1 - Core (3 tasks in parallel; needs B0)

### B1-1: Payment tables and SQL functions
- Tier: **Opus xhigh** - money and numbering; lands on the live project.
- Files: `supabase/migrations/20261101000000_seva_payments.sql` (`payment_orders`, `payments`, `payment_events`, `refunds`, `payment_settings` per DB §7.7, RLS deny-all, seed `payment_settings` row; add the foreign key `seva_orders.payment_order_id -> payment_orders(id)` as `NOT VALID` then `VALIDATE`); `..._seva_functions_payments.sql`; `tests/db/seva-payments.test.ts`.
- Interfaces (DB §7.8): `seva_create_payment_order(p_devotee_uid text, p_channel text, p_draft jsonb, p_provider text, p_mode text) returns jsonb` (prices from `sevas`, visibility, 90-day and 12:00 rules, multi-date; fee 0 while off; `order_ref` ours; status `created`; expiry +30 min); `seva_record_payment_event(p_provider, p_mode, p_event_key, p_event_type, p_signature_ok, p_order_ref, p_payload) returns bigint` (unique `(provider, event_key)`; a duplicate returns the existing id with a flag); `seva_issue_online_order(p_payment_order_id uuid) returns jsonb` (idempotent; W or WT by mode; `W-WEB`/`W-APP` by channel; one receipt per date; `issued_by_staff_id` null, `devotee_uid` set); `seva_request_refund(p_payment_order_id uuid, p_receipt_ids uuid[], p_reason text, p_staff_id uuid) returns uuid` (cancels with `refunded`, creates the `refunds` row with our `refund_ref`); plus new `seva_mark_payment_order(p_order_ref text, p_status text, p_provider_order_id text, p_payments jsonb) returns jsonb`, `seva_expire_payment_orders() returns int`, `seva_set_fee_rule(p_enabled boolean, p_rule jsonb, p_staff_id uuid) returns void` (refuses `upi` and debit cards), `seva_update_refund(p_refund_ref text, p_status text, p_provider_refund_id text, p_failure text) returns void`.
- Test intent: server pricing ignores client amounts; online-only and any-amount sevas refused; same-day after 12:00 refused; repeated issue returns the same receipts; test mode issues WT and the dashboard/continuity/register exclude it; W-WEB and W-APP share numbers; paid after expiry still issues; refund cancels with `refunded` and is idempotent by `refund_ref`; fee rule naming UPI refused; two concurrent issues keep W numbers consecutive (Review Focus 5).

### B1-2: Payment provider adapter and the Cashfree implementation, with a gateway mock
- Tier: **Opus xhigh** - signature checks and money calls; the PG webhook format must be confirmed first.
- Files: `lib/seva/payments/types.ts` (the `PaymentProvider` interface of DB §14.2 verbatim), `lib/seva/payments/index.ts` (`getPaymentProvider(): PaymentProvider` from env), `lib/seva/payments/cashfree.ts`, `lib/seva/payments/signature.ts` (`verifyCashfreeSignature(rawBody: string, timestamp: string, signature: string, secret: string): boolean` - HMAC-SHA256 of timestamp + raw body, Base64, `timingSafeEqual`), `tests/support/cashfree-mock.ts` (an HTTP mock of the order, payments, refunds endpoints and a signed-webhook sender), `tests/unit/seva/payments-cashfree.test.ts`.
- First step: confirm on Cashfree's developer docs (record URL + date in the commit body) the PG base URLs for sandbox and production, the API version header, create order (`order_meta.payment_methods` restricted to UPI), fetch order and its payments, create and fetch refunds, and the PG webhook signature headers and payload shape.
- Test intent: amounts sent in rupees with two decimals from integer paise; UPI-only payment methods on create; `fetchOrder` maps statuses (`PAID`/`ACTIVE`/`EXPIRED`...) to `paid | pending | expired | failed`; a valid signature passes, a changed byte or a replayed old timestamp fails; refunds use our `refund_ref` as the idempotency key; secrets never appear in thrown errors.

### B1-3: Devotee booking rules (pure)
- Tier: **Opus medium** - rules fixed by the spec.
- Files: `lib/seva/devotee/rules.ts` (`onlineDateBounds(now: Date, daysAhead: number, cutoff: string): { min: string; max: string; todayOpen: boolean }`, `buildDevoteeDraft(...)`), `lib/seva/schemas.ts` (add `devoteeOrderSchema`: seva id, dates, devotee fields as the counter, channel `web | app`), `types/seva-devotee.ts` (`DevoteeOrderRequest`, `DevoteeOrderStatus`, `MyBooking`), `tests/unit/seva/devotee-rules.test.ts`.
- Test intent: 90-day bound; 12:00 IST cutoff for today (11:59 open, 12:00 closed); multi-date only where the seva allows; same devotee fields and phone normalisation as the counter.

## Wave B2 - API (4 tasks in parallel; needs B1)

### B2-1: Devotee order, status and "My seva bookings" routes
- Tier: **Opus xhigh** - creates money orders for public users.
- Files: `app/api/seva/devotee/orders/route.ts` (POST), `devotee/orders/[ref]/route.ts` (GET - re-fetches from the gateway when pending and last checked over 15 s ago), `devotee/receipts/route.ts` (GET), `lib/seva/server/devotee.ts` (`requireDevotee(req): Promise<{ ok: true; uid: string; email: string | null } | { ok: false; response: NextResponse }>` through the identity adapter), `services/seva/devotee.service.ts`, `tests/unit/seva/api-devotee.test.ts`; Modify `app/api/public/receipts/route.ts` (now answers from "My seva bookings" or is retired, DB §17.4).
- Test intent: 401 without sign-in; the 11th open order in an hour gets 429; the server price is used even if the client sends one; the response carries the checkout session, never keys; status re-fetch throttled to once per 15 s; "Booked before" returns only this account's earlier details (C-10); a devotee sees only their own receipts.

### B2-2: Webhook, refunds, payments status and fee-rule routes
- Tier: **Opus xhigh** - the trust boundary with the gateway.
- Files: `app/api/seva/payments/webhook/[provider]/route.ts` (reads the raw body first), `payments/refunds/route.ts` (POST TA/SA with reason), `payments/status/route.ts` (GET TA/TV/SA), `payments/fee-rule/route.ts` (GET; PUT SA only), `lib/seva/server/payments.ts`, `services/seva/payments.service.ts`, `tests/unit/seva/api-webhook.test.ts`, `tests/unit/seva/api-payments.test.ts`.
- Test intent: bad signature -> 401 and an event row with `signature_ok = false`; duplicate event -> 200 at once with no second issue (Review Focus 1); paid + matching amount -> receipts issued; amount or currency mismatch -> no receipt, audit, 200 (Review Focus 2); unknown order -> recorded, 200; refund needs `payments.refund` and a reason; fee rule PUT by a temple admin -> 403; status page never shows keys, only "Keys found in Vercel".

### B2-3: Reconcile sweep and expiry on a schedule
- Tier: **Opus high** - scheduled job with a shared secret (C-64).
- Files: `app/api/seva/payments/reconcile/route.ts` (POST; header `x-seva-cron: <SEVA_CRON_SECRET>`, constant-time compare), `.github/workflows/seva-payments-reconcile.yml` (`cron: '*/5 * * * *'` and `workflow_dispatch`; calls the route on the configured site URL), `tests/unit/seva/api-reconcile.test.ts`, workflow text test.
- Test intent: wrong or missing secret -> 401; re-fetches orders pending over 5 minutes; expires orders past `expires_at`; money confirmed after expiry still issues receipts and raises attention (Review Focus 3); refunds in `processing` are polled with `fetchRefund`.

### B2-4: Payments in Needs attention
- Tier: **Opus medium** - extends one SQL function and one mapper.
- Files: new migration `..._seva_attention_payments.sql` (`CREATE OR REPLACE FUNCTION seva_needs_attention` adding: paid but not issued, pending over 30 minutes, refund failed, possible double payment), `types/seva-reports.ts` (new `NeedsAttentionId` values), `lib/seva/dashboard/attention-text.ts` (texts and links to the Payments page), `tests/db/seva-attention-payments.test.ts`.
- Test intent: each new card raised by its fixture; the Online tile on the dashboard now counts W receipts and never WT.

## Wave B3 - Screens and end-to-end (4 tasks in parallel; needs B2)

### B3-1: Devotee booking flow on the website
- Tier: **Opus high** - the public money flow; replaces today's browser-marked "completed" payment (`components/home/SevaBooking.tsx:182-193`).
- Mockups: `settings-devotee.html#d-signin`, `#d-sevas`, `#d-details`, `#d-review`, `#d-checkout`, `#d-pending`, `#d-success`.
- Files: `app/(public)/sevas/**` (choose, details, review, checkout, pending, success pages), `components/seva/devotee/*`, Modify `components/home/SevaBooking.tsx` (route to the new flow), `lib/seva/strings/devotee.ts`, e2e `tests/e2e/seva/devotee-booking.spec.ts`.
- Test intent: sign-in with Google or email + password (existing site sign-in); same fields as the counter with rashi as a searchable dropdown; real date picker with festival chips, several dates where allowed; review says "No extra charges" and "Pay Rs 1,515 by UPI"; test-mode banner; the checkout opens Cashfree's hosted page (gateway mock in e2e); pending page re-checks by itself and says "Do not pay again"; success shows one e-receipt per date with `WT-WEB-...` in test mode.

### B3-2: My seva bookings and e-receipts
- Tier: **Opus medium** - reuses the slip model.
- Files: `app/(public)/profile/seva-bookings/page.tsx` (or the existing profile area - check `app/(public)/profile/*` first), `components/seva/devotee/EReceipt.tsx` (the slip model on screen, seva date large, "1 of 3 - paid together - group ...", QR), `components/seva/devotee/ShareLink.tsx` (Web Share API, falls back to copy; free, C-44), tests.
- Test intent: lists only the signed-in account's receipts; each e-receipt shows its own number and QR; share link points at `/r/<token>`; no phone shown.

### B3-3: Admin Payments page
- Tier: **Opus high** - refunds and the fee rule are money controls.
- Mockup: `settings-devotee.html#payments`, `refund-dialog`.
- Files: `app/admin/receipts/payments/page.tsx`, `components/seva/payments/{ProviderStatus,RecentPayments,RefundDialog,FeeRuleCard,GoingLive}.tsx`, sidebar item (TA, TV, SA), e2e `tests/e2e/seva/payments.spec.ts`.
- Test intent: mode banner at the top; "Keys found in Vercel - never shown or typed here"; last webhook time and "signature verified"; "Send a test payment" (Rs 1, test mode only); recent payments with statuses paid / checking with bank / failed / paid twice; refund needs a reason; fee rule text "The temple pays the gateway fee. Devotees pay exactly the seva rate." and only a super admin can change it; "Going live: 2 steps".

### B3-4: Test-mode end-to-end and documentation
- Tier: **Opus high** - proves the whole flow against the mock and records it.
- Files: `tests/e2e/seva/checkout-test-mode.spec.ts` (fake API off for payments: uses `tests/support/cashfree-mock.ts` serving the hosted page and posting signed webhooks), `docs/API.md`, `docs/SECURITY.md`, `docs/DATA-MODEL.md`, `docs/seva/README.md` (payments runbook: refund, double payment, reconcile).
- Test intent: book two dates -> pay in the mock -> webhook -> two WT e-receipts -> prasadam lookup finds them; a replayed webhook changes nothing; an expired order paid late still gets receipts and an attention card.

**Plan B gates.** B1 gate: DB suite + unit; B2 gate: + security review (Opus xhigh) of webhook and devotee routes; B3 gate: full suites + Playwright + build; owner's 10-minute checklist: (1) on the preview site, book a seva for two dates and pay with a Cashfree test UPI id; (2) see two `WT-WEB` e-receipts; (3) refund one from the Payments page with a reason; (4) check the dashboard totals did not change (test mode never counts).

**Window estimate:** about 0.95 of a window (range 0.85-1.2; 13 tasks - 4 Opus xhigh, 5 high, 3 medium, 1 Sonnet; calculation in `PLAN-INDEX.md`). Detail each task with superpowers:writing-plans at the start of the Plan B window.

END OF REPORT
