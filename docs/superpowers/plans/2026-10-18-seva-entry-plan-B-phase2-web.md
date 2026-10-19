# Seva Entry Phase 2 (website + Cashfree test mode) Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in devotees book online sevas on the website and pay by UPI through Cashfree in test mode, with server-verified payments, W/WT e-receipts (one per seva date), refunds by admins, a Payments status page and payment cards in Needs attention - built in full, so going live is the site owner's two steps (DB §14.6; SETUP-GUIDE B9).

**Who sets up what (corrected 2026-10-19, GUIDE-FIX):** every test step of this plan uses **Nikhil's own** new, free accounts - his Cashfree test account, his own Firebase test project (SETUP-GUIDE A2) and his own Vercel project of the fork `nikhilmn01/Rayaramathaynk` (A3) - never the live site's. Everything live (Vercel production env, GitHub secrets and variables, the live Cashfree account) belongs to the **site owner** (`ngowda759`) and happens only after he merges the pull request (SETUP-GUIDE Part B). Old guide section numbers map to the new ids in SETUP-GUIDE 0.4 (8 -> A4.1, 10 -> B9).

**Architecture:** Same shape as Plan A: pages call only `app/api/seva/**`; every money write is one SQL function; the gateway sits behind one `PaymentProvider` interface (`lib/seva/payments/*`, DB §14.2) with a Cashfree implementation picked by `PAYMENTS_PROVIDER` / `PAYMENTS_MODE`. The payment orchestration (`lib/seva/payments/core.ts`) takes its provider, SQL caller and clock as arguments, so the same code runs in routes, in the reconcile sweep and in a database flow test. A webhook never creates a receipt from its payload: it is verified (raw-body HMAC), recorded once by event key, and only triggers a server re-fetch of the order from the gateway; receipts are issued only when the re-fetched order is paid in full, in INR, for our own order ref (DB §14.3).

**Tech Stack:** Plan A's stack (Next ^16.2.9, React 19.2.4, TypeScript strict, Supabase Postgres through `createAdminClient()`, Firebase Auth, zod ^4, Jest 29 + ts-jest, PGlite, Playwright with the Firebase emulators) plus: Cashfree PG over plain `fetch` (no server SDK), the Cashfree browser checkout loader `@cashfreepayments/cashfree-js` and, for tests only, `embedded-postgres` (a real Postgres 15 for the two-connection tests and a Postgres 15 migration check) - both installed once in B0-2.

**Spec:** `docs/seva/DESIGN-BOOK.md` ("DB §n"): §3.3 rows 24-27, §4 (Phase 2 row), §6.2 F5, §6.5 (Phase 2 rows), §7.7, §7.8 (payment functions), §12.1 (Online tile), §12.2 (payments row), §13.5, §14, §15, §17.4 (`/api/public/receipts`), §19; calls C-07, C-10, C-18, C-29, C-43 to C-47, C-64. `$STATE/DECISIONS.md` wins on any conflict: UPI only (no card anywhere), the temple absorbs the fee, one e-receipt per seva date, W-WEB/W-APP numbering with WT in test mode, Google or email + password sign-in, the same devotee fields as the counter. Gateway facts: `$STATE/research/R1-payments.md` and `R1V-verify.md` (R1V wins); only what R1V verified is used as fact - everything else is a numbered check that B0-1 settles before any gateway code (see **Gateway facts** below). Visual reference: `$STATE/desk/mockups/settings-devotee.html` (screens `d-signin`, `d-sevas`, `d-details`, `d-review`, `d-checkout`, `d-pending`, `d-success`, `payments`, `refund-dialog`).

**Paths used in this plan**
- `$MAIN` = `D:/Onboarding/Repos/POCs/General Purpose POCs Git Connected` (never switched, staged or committed by a build agent).
- `$STATE` = `$MAIN/.claude/state/seva` (git-ignored; read by absolute path).
- `$WT` = `D:/Onboarding/Repos/POCs/seva-entry` (worktree on `feature/seva-entry`). **Every relative path below is relative to `$WT`.**
- Standing rules for every build agent: `$STATE/briefs/build/BUILD-RULES.md` (cd into `$WT` in every shell command; commit with `git commit -F <msgfile> -- <paths>` plus the two trailer lines; never `git add -A`).

**Built on (code as of `f0f8aec`, 2026-10-19).** Plan B starts after Plan A's wave A5 is merged. Facts this plan relies on, read from the code:
- `seva_orders.payment_order_id` exists without a foreign key; `seva_orders_online_payment` requires it when `payment_mode = 'online'`; `seva_orders` is immutable after insert (trigger `seva_forbid_change`), so the link is written in the same insert.
- `seva_receipts.refund_state` is `none | due | processing | done | failed`; cancelling a UPI or online receipt through `seva_cancel_receipts` sets `due`, and the `upi_refunds_due` card counts `due` receipts (test mode excluded). The receipt guard lets `refund_state` and `refund_note` change after a cancel; cancel fields are fixed once cancelled.
- Series `W` (`online`) and `WT` (`online_test`) are seeded; `seva_receipt_no` already formats `W-WEB-MM-YYYY/NNNNNN`; receipts in W/WT carry `staff_no` null.
- Reusable SQL: `seva_take_numbers`, `seva_next_group_no`, `seva_issue_devotee`, `seva_issue_write_lines`, `seva_order_json(p_order_id uuid, p_duplicate boolean)`, `seva_audit` (phones stripped at every depth by `seva_strip_phones`), `seva_ist_parts`. Settings already hold `online_days_ahead` (90) and `online_same_day_cutoff` ('12:00').
- Grants pattern: plpgsql, `SECURITY INVOKER`, `SET search_path = public, pg_temp`, `REVOKE EXECUTE ... FROM public, anon, authenticated`, `GRANT EXECUTE ... TO service_role`; and since `20261029235900_seva_privilege_hardening.sql`, guarded tables also `REVOKE TRIGGER, REFERENCES ... FROM service_role, anon, authenticated`. New migrations sort after `20261029235900`.
- Server helpers: `requireSevaActor(req, action, opts)` with device modes `required | required_for_receptionist | optional` and `retiredDevice: 'allow'` (only the outbox sync); `getIdentityAdapter().verifyRequest(req)` -> `{ externalUid, email } | null` (throws `internal` when Firebase is unreachable); `callRpc<T>(fn, args)` (only `seva_*`; `SEVA:<code>` -> `SevaError`); `sevaJson`, `sevaErrorResponse`; `rateLimit(key, { limit, windowMs })` (per server instance; used per person by `devotees/search`); `parseInput`, `readJson`, `queryOf`, `Row` helpers in `lib/seva/server/read.ts`; `fromSqlIssue` (seva_order_json -> `IssueResponse`), `fromSqlAttention`, `loadDashboard` in `lib/seva/server/reports.ts`. `slipSettings(row)` and `festivalChips(rows, today)` are private in `lib/seva/server/counter.ts` (B2-1 exports them).
- `permissions.ts` already has `payments.view` (TA, TV, SA), `payments.refund` (TA, SA), `payments.fee_rule` (SA).
- Needs attention cards carry `{ id, level, count, detail, entries? }`; `offline_cancels` (with entries) and `upi_changed` were added after the outline was written. Phone exports write `export.phones_read` on every page (A3 gate M-3). `settings/financeSettings` is super-admin only and holds the counter's UPI payee - Plan B never reads gateway settings from it.
- The site has **no Google sign-in today** (`services/auth.service.ts` has email + password only; `buildSignInProfileWrite` in `lib/auth/sign-in-profile.ts` is the profile merge every sign-in must use). The site's CSP (`next.config.ts:34` and `proxy.ts:49`, two copies) allows neither Google's sign-in frame nor Cashfree.
- The e2e harness (`tests/e2e/seva/fixtures/*`): `signInAs(page, role)` for five staff roles; `createFakeSevaApi(seed)` with `extend(handlers)` whose handlers run before the role checks; every `/api/seva/**` call in the browser is answered by the fake.
- The repo is public, so GitHub Actions minutes are free; a `schedule` trigger runs only from the default branch (`main`).

## Global Constraints

Plan A's Global Constraints apply verbatim (`2026-10-18-seva-entry-plan-A-phase1.md`, section "Global Constraints"); give each implementer that section, this one and **Shared contracts** below together with the task text. In addition:

- **UPI only** online: the gateway order restricts payment methods to UPI; no card, net banking or wallet anywhere in the UI or the API (DECISIONS Round B - devotee). The fee rule stays **off**, and `seva_set_fee_rule` refuses any rule naming `upi` or a debit card (R1V C1-C4). The fee is 0 on every UPI order whatever the rule says. Review copy: "No extra charges" (D15).
- **Keys and mode live only in Vercel env:** `PAYMENTS_PROVIDER=cashfree`, `PAYMENTS_MODE=test|live`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`; test-only `CASHFREE_API_BASE_URL` (refused when the mode is `live`); reconcile `SEVA_CRON_SECRET`. Never in the database, the admin UI, the client bundle, a thrown error, an audit row or a log line. The Payments page says only "Keys found in Vercel - never shown or typed here".
- **Test mode** issues series **WT** (`WT-WEB-...`, `WT-APP-...`), `test_mode = true`, excluded from totals, register, continuity and exports (C-18); the Payments page shows "Test mode" at the top and the devotee checkout shows "Test mode: no real money moves."
- **W numbers:** `W-WEB-MM-YYYY/NNNNNN` and `W-APP-...` share one running number per calendar year (C-07); one receipt per seva date; issued only after the gateway confirms the full amount in INR for our order ref; never from a webhook payload.
- **Online booking rules:** one seva per order, quantity 1 per date (mockup "Rs 505 per date ... Pay Rs 1,515"); dates from today to `online_days_ahead` (90) days ahead; same-day bookings close at `online_same_day_cutoff` (12:00 IST) - 11:59 open, 12:00 closed (C-29); several dates only where the seva is multi-date, at most 31; only active sevas with visibility `online` or `both` and a fixed price ("Need a different amount? Please visit the counter."). Prices always come from `sevas` on the server; an amount sent by the client is ignored.
- **Devotee fields** are the counter's (`devoteeSchema`: name required 1-80, gotra, nakshatra, rashi, phone optional and normalised to `+91XXXXXXXXXX`). The **payer mobile** for UPI is asked separately on the review step (pre-filled from the devotee phone), sent to the gateway only, never stored by us (see UNCLEAR U-1 in the index).
- **Rate limit:** at most **10 open orders per account per hour** (`created`/`pending` orders created in the last 60 minutes), enforced in SQL so it holds across server instances (DB §14.3).
- **Every rupee gets a receipt:** money confirmed after expiry or after a seva date has passed still issues receipts, flags `late_reason`, and raises a card; an admin decides on a refund (C-45). A refund cancels the chosen receipts with reason `refunded` when requested; a failed refund is critical in Needs attention (C-46). Refunds only within 180 days of payment (R1V C5: six months).
- **Order lifetime:** our `order_ref` is the gateway's order id; expiry 30 minutes after creation; the pending page and the Payments page re-check an order at most once per 15 s (throttled in SQL); the scheduled sweep re-checks orders pending over 5 minutes and expires those past `expires_at` after asking the gateway first.
- **Webhooks:** raw body read first; HMAC-SHA256 over `timestamp + rawBody` with the secret key, Base64, constant-time compare (R1V C5 - confirmed for PG orders in B0-1, check CF-7); a bad signature is recorded as `signature_ok = false` under an `unsigned:` key and answered 401 (at most 30 recorded per IP per minute); a recorded, processed event key answers 200 at once; everything else answers 200 once recorded, whatever the outcome, so the gateway does not retry forever.
- **Privacy:** payment rows keep a masked payer VPA only; event payloads are minimised to ids and statuses (no names, phones or emails); the account email is shown only on the Payments page (DB §15.2).
- **Boundary:** this repo is a standalone temple POC; never bring in any office-work theme, company name, logo, presentation skill, pending-items page or office-repository convention. Pages use this site's own look (`app/globals.css` tokens and the `.seva` module tokens).
- **Jest** always runs as `npx jest --ci --watchman=false --forceExit <paths>`; DB tests as `npm run test:db -- --ci --watchman=false --forceExit <paths>`. **SQL is Postgres 15 only** (no `MERGE ... RETURNING`, `ANY_VALUE`, `JSON_TABLE`, SQL/JSON constructors or other 16+ syntax); the B0-2 Postgres 15 runner applies every seva migration on a real Postgres 15 at each wave gate.

## Gateway facts (verified vs to check in B0-1)

Verified (R1V, 2026-10-18), used as fact: webhook signing is HMAC-SHA256 over `timestamp + rawBody` with the PG secret key, Base64, compared with `x-webhook-signature`, timestamp in `x-webhook-timestamp` (shown on the payment-forms page, not yet the PG page); refund API `POST /orders/{order_id}/refunds`, API version `2026-01-01`, refunds within six months of payment; test environment usable before activation; trust onboarding needs trust deed or registration certificate, 80G/12A, trust PAN and bank details.

**Not verified - each is a check B0-1 settles, with URL and date, in `docs/seva/PAYMENTS-FACTS.md`:**

| Id | Check | What the plan assumes until then |
|---|---|---|
| CF-1 | PG base URLs | sandbox `https://sandbox.cashfree.com/pg`, production `https://api.cashfree.com/pg` |
| CF-2 | Auth and version headers | `x-client-id`, `x-client-secret`, `x-api-version: 2026-01-01` |
| CF-3 | Create order body and answer | `order_id` (3-50 chars, letters, digits, `-`, `_`), `order_amount` (number, rupees), `order_currency: 'INR'`, `customer_details.{customer_id, customer_name, customer_phone (required, 10 digits), customer_email}`, `order_meta.{return_url, notify_url, payment_methods: 'upi'}`, `order_expiry_time` (ISO-8601 with offset); answer `cf_order_id`, `payment_session_id`, `order_status: 'ACTIVE'` |
| CF-4 | Get order | `GET /orders/{order_id}` -> `order_status` `ACTIVE | PAID | EXPIRED | TERMINATED | TERMINATION_REQUESTED`, `order_amount`, `order_currency`, `order_id`, `cf_order_id`; unknown order -> 404 |
| CF-5 | Order payments | `GET /orders/{order_id}/payments` -> `[{ cf_payment_id, payment_status SUCCESS|FAILED|PENDING|USER_DROPPED|NOT_ATTEMPTED|..., payment_amount, payment_group 'upi', bank_reference, payment_completion_time, payment_method.upi.upi_id }]` |
| CF-6 | Refund create and get | body `{ refund_amount, refund_id, refund_note }` (`refund_id` 3-40 chars), answer `cf_refund_id`, `refund_status SUCCESS|PENDING|CANCELLED|ONHOLD`; `GET /orders/{order_id}/refunds/{refund_id}` |
| CF-7 | PG webhook format | headers `x-webhook-signature`, `x-webhook-timestamp`, and an event id header (`x-idempotency-key`?) - else the event key is SHA-256 of the raw body (DB §7.7); body `{ type, event_time, data: { order: { order_id, ... }, payment: {...}, refund?: { refund_id, ... } } }`; types `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `PAYMENT_USER_DROPPED_WEBHOOK`, `REFUND_STATUS_WEBHOOK` |
| CF-8 | Browser checkout | npm `@cashfreepayments/cashfree-js`: `load({ mode: 'sandbox' | 'production' })` then `checkout({ paymentSessionId, redirectTarget: '_self' })`; the script and page hosts it uses (for the CSP) |
| CF-9 | Sandbox UPI test ids | one id that succeeds, one that fails (for the owner's checklist and SETUP-GUIDE A4.1) |
| CF-10 | Per-order `notify_url` | honoured in sandbox, so no dashboard webhook set-up is needed for previews |
| CF-11 | `return_url` | must be https; whether `{order_id}` is substituted (the plan does not rely on it) |
| V-1 | Vercel system env | `VERCEL_ENV` (`preview`), `VERCEL_BRANCH_URL` (host without scheme) available to functions |
| V-2 | Preview protection | Deployment Protection blocks outside callers on previews; "Protection Bypass for Automation" lets a caller pass `x-vercel-protection-bypass=<secret>` as a query parameter; the secret is exposed to functions as `VERCEL_AUTOMATION_BYPASS_SECRET` |
| F-1 | Google sign-in | Firebase console path to enable Google; authorized domains for preview hosts; CSP hosts `signInWithPopup` needs (`https://apis.google.com`, `https://<project>.firebaseapp.com`, `https://accounts.google.com`) |
| G-1 | GitHub schedules | `schedule` runs from the default branch only; 5-minute minimum; disabled after 60 days without repository activity on public repos |

If B0-1 marks any row DIFFERENT, it stops and reports UNCLEAR with the evidence; the orchestrator patches the affected task text in this plan (and commits that patch) before wave B1 starts. No implementer improvises a gateway format.

## Review Focus

The five input classes the spec implies but feature tests would not naturally hit, most likely first. Each is pinned in its owning task by the test named.

1. **Webhook replays, duplicates and out-of-order events** (the same success event three times; a `PAYMENT_FAILED` event arriving after the success; an event whose first processing crashed). Expected: exactly one set of receipts; a processed duplicate answers 200 at once; a crashed one is processed again; a failure event never undoes paid receipts. Pinned: B1-1 `a processed event key is a duplicate, an errored one is processed again`; B1-4 `a failed status after paid leaves the order paid`; B2-2 `a replayed webhook answers 200 and issues nothing new`.
2. **Amount, currency or order-ref mismatch from the gateway** (one paisa short, `USD`, another order's id, a payment for an order we never made). Expected: no receipt, audit `payment.amount_mismatch`, `needs_review` set, critical card, webhook still 200. Pinned: B1-1 `refuses to issue when the confirmed amount, currency or ref differs`; B1-4 `does not issue on a one-paisa, currency or ref mismatch and flags the order`; B2-2 `an unknown order is recorded and answered 200`; B2-5 `a mismatch counts as paid but not issued`.
3. **Money confirmed late** (after the 30-minute expiry, after the sweep marked the order expired, or for a seva date already past). Expected: receipts issued, `late_reason` set, attention card, admin decides on a refund (C-45). Pinned: B1-1 `issues for an expired order confirmed paid and marks after_expiry`, `marks seva_date_passed`; B2-4 `the sweep issues for an expired order the gateway says is paid`; B2-5 `paid late raises an attention card`.
4. **The devotee closes the browser mid-payment, presses Back, or pays twice** (two tabs, a second booking for the same dates). Expected: the checkout refuses to open the gateway again once the order is paid, failed or expired; the return page keeps checking by itself and says "Do not pay again"; two paid orders for the same account, seva and dates within 30 minutes raise "possible double payment" and show "Paid twice" on the Payments page. Pinned: B2-1 `checkout info is refused once the order is paid, failed or expired`; B2-5 `two paid orders for the same seva and dates within 30 minutes raise possible double payment`; B2-3 `marks the later of a double payment as paid_twice`; B3-4 e2e `return page keeps checking and shows the receipts when paid`.
5. **Two confirmations at the same moment** (webhooks for two different orders together; the webhook and the pending page confirming the same order together). Expected: W numbers consecutive and unique; one order is issued once. Pinned (real Postgres 15, two connections, B0-2 runner): B1-1 `two orders issued at once get consecutive W numbers` and `one order confirmed twice at once issues one set`.

Also on the B2 security gate's list (each pinned): another account's order ref (B2-1 `another account's order ref answers 404`), forged webhook floods (B2-2 `records at most 30 unsigned events per IP per minute`), client-sent amounts (B2-1 `uses the server price when the client sends an amount`).

---

## How to run this plan

- **Waves** as in Plan A: tasks inside a wave run in parallel, each in its own task worktree cut from `feature/seva-entry` (Plan A "How to run this plan"); a wave starts when every task of the previous wave is merged and its gate passed. Exceptions: **B0-2 starts after B0-1** (it needs CF-8), and **B3-4 starts after B3-1 and B3-2 are merged** (its browser test drives their pages).
- **Packages** are installed only in B0-2; no later task edits `package.json` dependencies or `package-lock.json`.
- **Per-task test policy:** only that task's own tests, `npm run typecheck`, `npx eslint <changed files>` (BUILD-RULES).
- **Commit** once per task in `$WT`: `git add <the task's paths>` then `git commit -F <msgfile> -- <the same paths>`; the message file holds the subject given in the task, a blank line, and the two trailer lines from BUILD-RULES.
- **Wave gate** (once per wave, in `$WT` after merging): `npm run typecheck`, `npm run lint`, `npx jest --ci --watchman=false --forceExit`, `npm run test:db -- --ci --watchman=false --forceExit` (includes the Postgres 15 runner from B0-2), `npm run verify:supabase-migrations:static`, `npm run build`, plus `npm run test:e2e:seva` in B3. Write `$STATE/test-reports/<wave>-TEST-REPORT.md` (commands, counts, new failures, skips and why, the wave's owner checklist). A new failure gets a fix task (Opus high) before the next wave.

## File structure

| Area | Files | Responsibility | Task |
|---|---|---|---|
| Facts | `docs/seva/PAYMENTS-FACTS.md` | Checked gateway, Vercel, Firebase and GitHub facts with sources | B0-1 |
| Setup guide | `docs/seva/SETUP-GUIDE.md` A4.1 and B9 | A4.1 (Nikhil, own accounts): Cashfree test account, Google sign-in in his Firebase test project, preview access on his Vercel project of the fork. B9 (site owner, after merge): reconcile secret and variable, going live | B0-1 |
| Test DB | `tests/db/pg15.ts`, `tests/db/harness.ts` (exports) | Real Postgres 15 for two-connection tests and the PG15 migration check | B0-2 |
| Schema + SQL | `supabase/migrations/20261101000000_seva_payments.sql`, `20261101000100_seva_functions_payments.sql`, `20261101000200_seva_payment_attention.sql` | Payment tables, order/issue/refund/event functions; payment attention cards | B1-1, B2-5 |
| Provider | `lib/seva/payments/{types,index,cashfree,signature}.ts` | Interface, env selection, Cashfree adapter, HMAC check | B1-2 |
| Orchestration | `lib/seva/payments/core.ts`, `lib/seva/server/payments.ts`, `lib/seva/issue-json.ts` | Start order, confirm, refund, refund sync (injected deps); default deps; the pure issue-answer mapper moved out of `counter.ts` | B1-4 |
| Webhook, sweep | `lib/seva/payments/{webhook,reconcile}.ts` | Webhook handling; scheduled sweep | B2-2, B2-4 |
| Devotee rules | `lib/seva/devotee/rules.ts`, `lib/seva/schemas.ts`, `lib/seva/errors.ts`, `types/seva-devotee.ts`, `types/seva-payments.ts` | Dates, cut-off, draft, schemas, codes, wire types | B1-3 |
| Server reads | `lib/seva/server/{devotee,payments-admin}.ts` | Devotee and Payments-page reads | B2-1, B2-3 |
| API | `app/api/seva/devotee/**`, `app/api/seva/payments/**` | Thin routes | B2-1..B2-4 |
| Browser clients | `services/seva/{devotee,payments}.service.ts` | `sevaFetch` wrappers | B2-1, B2-3 |
| Sign-in | `services/auth.service.ts`, `context/AuthContext.tsx`, `app/(auth)/{login,register}/page.tsx`, `next.config.ts`, `proxy.ts` | Google sign-in; CSP for Google and Cashfree | B1-5 |
| Pages | `app/(public)/sevas/**`, `app/(public)/profile/seva-bookings/page.tsx`, `app/seva/(desk)/payments/page.tsx` (A4S: `/seva/payments`), `components/seva/{devotee,payments}/*`, `lib/seva/strings/{devotee,payments}.ts` | Booking flow, My seva bookings, Payments page | B3-1..B3-3 |
| Ops | `.github/workflows/seva-payments-reconcile.yml` | 5-minute sweep (default branch only) | B2-4 |
| Tests | `tests/support/cashfree-mock.ts`, `tests/unit/seva/*payments*`, `tests/db/seva-payments*.test.ts`, `tests/e2e/seva/fixtures/{devotee,fake-devotee,fake-payments,cashfree-checkout}.ts`, `tests/e2e/seva/*.spec.ts` | Mock gateway, unit/route/DB/browser tests | per task |

## Shared contracts

A task implementer sees only their own task; these names cross tasks. Owning task in brackets.

```ts
// lib/seva/payments/types.ts [B1-2] - DB §14.2, with five extensions marked (+)
export type ProviderName = 'cashfree' | 'razorpay';
export type ProviderMode = 'test' | 'live';
export interface ProviderPayment { providerPaymentId: string; method: string; status: 'success' | 'failed' | 'pending' | 'user_dropped';
  amountPaise: number; bankReference?: string; payerVpaMasked?: string; paidAt?: string }
export interface ProviderOrder { status: 'pending' | 'paid' | 'failed' | 'expired'; amountPaise: number;
  currency: string /* + */; orderRef: string /* + */; providerOrderId: string /* + */; payments: ProviderPayment[] }
export interface VerifiedWebhook { eventKey: string; eventType: string; orderRef?: string; refundRef?: string /* + */;
  payload: Record<string, string | number | null> /* + minimised: ids and statuses only */ }
export interface PaymentProvider {
  readonly name: ProviderName;
  readonly mode: ProviderMode;
  createOrder(input: { orderRef: string; amountPaise: number; customer: { uid: string; name: string; phone?: string; email?: string };
    returnUrl: string; notifyUrl: string /* + */; expiresAt: Date }): Promise<{ providerOrderId: string; checkout: { sessionId: string } }>;
  fetchOrder(orderRef: string): Promise<ProviderOrder>;           // unknown order -> ProviderError('not_found')
  verifyWebhook(rawBody: string, headers: Headers): VerifiedWebhook | null;   // null = bad or missing signature
  createRefund(input: { orderRef: string; refundRef: string; amountPaise: number; reason: string }):
    Promise<{ providerRefundId: string; status: 'processing' | 'succeeded' | 'failed' }>;
  fetchRefund(orderRef: string, refundRef: string): Promise<{ status: 'processing' | 'succeeded' | 'failed'; failureReason?: string; providerRefundId?: string }>;
}
export class ProviderError extends Error {        // message never holds a key, a header or a response body
  constructor(public kind: 'not_found' | 'unavailable' | 'rejected' | 'not_configured', public httpStatus: number | null, message: string);
}

// lib/seva/payments/index.ts [B1-2] - import 'server-only'
export interface PaymentsEnv { provider: ProviderName; mode: ProviderMode; keysPresent: boolean }
export function readPaymentsEnv(env?: NodeJS.ProcessEnv): PaymentsEnv;          // never throws; mode defaults to 'test'
export function getPaymentProvider(env?: NodeJS.ProcessEnv): PaymentProvider;   // ProviderError('not_configured') when keys or mode missing, provider 'razorpay', or CASHFREE_API_BASE_URL set in live
export function paymentsBaseUrl(env?: NodeJS.ProcessEnv): string;   // VERCEL_ENV=preview + VERCEL_BRANCH_URL -> 'https://<branch url>'; else NEXT_PUBLIC_SITE_URL; no trailing slash; ProviderError('not_configured') if neither
export function webhookUrl(env?: NodeJS.ProcessEnv): string;        // `${base}/api/seva/payments/webhook/cashfree`, plus `?x-vercel-protection-bypass=<VERCEL_AUTOMATION_BYPASS_SECRET>` only when VERCEL_ENV=preview and the secret is set

// lib/seva/payments/core.ts [B1-4] - no 'server-only', no env reads: everything comes in through deps
export type RpcFn = <T>(fn: string, args: Record<string, unknown>) => Promise<T>;
export interface PaymentDeps { provider: PaymentProvider; rpc: RpcFn; now: () => Date; baseUrl: string; notifyUrl: string }
export interface PaymentOrderRow { id: string; orderRef: string; devoteeUid: string; channel: 'web' | 'app'; purpose: 'seva' | 'probe';
  status: 'created' | 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled'; amountPaise: number; mode: ProviderMode;
  providerOrderId: string | null; sevaOrderId: string | null; expiresAt: string; paidAt: string | null; lastCheckedAt: string | null;
  lateReason: 'after_expiry' | 'seva_date_passed' | null; needsReview: 'amount_mismatch' | null; sevaNameEn: string | null;
  sevaNameKn: string | null; dates: string[]; createdAt: string }
export interface StartOrderInput { uid: string; email: string | null; channel: 'web' | 'app'; draft: SqlPaymentDraft;
  payerPhone: string /* +91XXXXXXXXXX */; customerName: string }
export interface StartedOrder { orderRef: string; amountPaise: number; expiresAt: string; testMode: boolean; checkoutUrl: string /* '/sevas/checkout/<ref>?k=<key>' */ }
export type ConfirmOutcome = 'issued' | 'already_issued' | 'probe_paid' | 'not_paid' | 'expired' | 'failed' | 'amount_mismatch' | 'unknown_order' | 'throttled';
export function startPaymentOrder(deps: PaymentDeps, input: StartOrderInput): Promise<StartedOrder>;
export function confirmPaymentOrder(deps: PaymentDeps, orderRef: string, opts?: { minIntervalSeconds?: number }):
  Promise<{ outcome: ConfirmOutcome; order: PaymentOrderRow | null; issue: IssueResponse | null }>;
export function requestRefund(deps: PaymentDeps, input: { paymentOrderId: string; receiptIds: string[]; reason: string; staffId: string }): Promise<RefundRow>;
export function syncRefund(deps: PaymentDeps, orderRef: string, refundRef: string): Promise<RefundRow>;
export interface RefundRow { id: string; refundRef: string; orderRef: string; amountPaise: number; status: 'requested' | 'processing' | 'succeeded' | 'failed';
  receiptIds: string[]; reason: string; failureReason: string | null }
export function fromSqlPaymentOrder(raw: unknown): PaymentOrderRow;     // SevaError('internal') on a malformed row

// lib/seva/server/payments.ts [B1-4] - import 'server-only'
export function defaultPaymentDeps(): PaymentDeps;   // getPaymentProvider(), callRpc, () => new Date(), paymentsBaseUrl(), webhookUrl()
export function paymentsAvailable(): boolean;        // readPaymentsEnv().keysPresent && base URL resolvable

// lib/seva/devotee/rules.ts [B1-3] (pure)
export interface OnlineDateBounds { today: string; min: string; max: string; todayOpen: boolean }
export function onlineDateBounds(now: Date, daysAhead: number, cutoff: string /* 'HH:MM' IST */): OnlineDateBounds;
export function checkOnlineDates(dates: string[], bounds: OnlineDateBounds, multiDate: boolean):
  { ok: true; dates: string[] /* sorted, unique */ } | { ok: false; code: 'date_out_of_range' | 'same_day_closed' | 'validation'; date?: string };
export interface SqlPaymentDraft { purpose: 'seva' | 'probe'; client_order_id: string; seva_id: string | null;
  devotee: Record<string, string | number | null> /* the counter's p_order.devotee keys, see A2-1 */;
  receipts: { client_receipt_id: string; seva_date: string; qr_token: string }[] }
export function buildDevoteeDraft(req: DevoteeOrderRequest, ids: { clientOrderId: string; receipts: { clientReceiptId: string; qrToken: string }[] }): SqlPaymentDraft;
export const MAX_ONLINE_DATES = 31;
```

```ts
// types/seva-devotee.ts [B1-3] - wire types (camelCase, integer paise, 'YYYY-MM-DD')
export interface OnlineSeva { id: string; nameEn: string; nameKn: string | null; ratePaise: number; multiDate: boolean; category: string; prasadamItems: string | null }
export interface OnlineCatalogue { sevas: OnlineSeva[]; bounds: OnlineDateBounds; sameDayCutoff: string;
  festivalChips: { name: string; nameKn: string | null; dates: string[] }[]; mode: 'test' | 'live'; paymentsAvailable: boolean }
export interface DevoteeOrderRequest { sevaId: string; dates: string[]; devotee: DevoteeInput; payerPhone: string; channel: 'web' | 'app' }
export type DevoteeOrderCreated = StartedOrder;
export interface DevoteeOrderStatus { orderRef: string; state: PaymentOrderRow['status']; amountPaise: number; testMode: boolean;
  sevaNameEn: string; sevaNameKn: string | null; dates: string[]; createdAt: string; expiresAt: string; lastCheckedAt: string | null;
  receipts: IssuedReceipt[]; slip: SlipSettings | null /* set when receipts are */; siteUrl: string }
export interface CheckoutInfo { orderRef: string; sessionId: string; mode: 'test' | 'live'; amountPaise: number; sevaNameEn: string;
  dates: string[]; channel: 'web' | 'app'; expiresAt: string }
export interface MyBookings { slip: SlipSettings; siteUrl: string; receipts: IssuedReceipt[] /* newest first; WT ones carry seriesCode 'WT' */;
  waiting: DevoteeOrderStatus[] /* created or pending, newest first */ }
export type BookedBefore = DevoteeInput[];   // this account's own earlier details, newest first, at most 5, distinct (C-10)

// types/seva-payments.ts [B1-3] - admin Payments page
export type PaymentRowStatus = 'paid' | 'checking' | 'failed' | 'expired' | 'paid_twice';
export interface RecentPayment { orderRef: string; paymentOrderId: string; at: string; receiptNos: string[]; receiptIds: string[];
  refundableReceiptIds: string[]; devoteeName: string; accountEmail: string | null; sevaNameEn: string; dates: string[];
  amountPaise: number; status: PaymentRowStatus; testMode: boolean; probe: boolean; lateReason: string | null; needsReview: boolean }
export interface RefundItem { refundRef: string; orderRef: string; amountPaise: number; reason: string;
  status: 'requested' | 'processing' | 'succeeded' | 'failed'; requestedBy: string; at: string; receiptNos: string[];
  devoteeName: string; failureReason: string | null }
export interface FeeRule { enabled: boolean; rule: { amountPaise: number; methods: ('credit_card' | 'net_banking' | 'wallet')[] } | null }
export interface PaymentsOverview { provider: 'cashfree'; mode: 'test' | 'live'; keysPresent: boolean;
  lastWebhook: { at: string; signatureOk: boolean } | null; feeRule: FeeRule; recent: RecentPayment[] /* last 7 days */; refunds: RefundItem[] }
export interface RefundRequest { paymentOrderId: string; receiptIds: string[]; reason: string }
```

```sql
-- SQL JSON contract [B1-1]. Money in SQL is numeric; JSON carries amounts as numeric strings ('1515.00'); routes convert with toPaise().
-- p_draft for seva_create_payment_order (built by buildDevoteeDraft, plus two server-added keys):
--   { purpose: 'seva'|'probe', client_order_id, seva_id, devotee: { name, gotra, gotra_id, nakshatra_id, nakshatra_text,
--     rashi_id, rashi_text, phone_e164 }, receipts: [{ client_receipt_id, seva_date, qr_token }],
--     account_email, checkout_key_hash /* hex SHA-256 of the checkout key */ }
--   'probe' (the Payments page's Rs 1 test payment): test mode only; seva_id null, receipts [], devotee { name: 'Test payment' }.
-- The stored draft adds the server-priced lines per receipt in seva_issue_write_lines' shape:
--   { seva_id, code, name_en, name_kn, quantity: 1, catalogue_rate, unit_rate, amount, change_reason: null, prasadam_items, prasadam_given }
-- seva_payment_order_json(p_id) -> { id, order_ref, devotee_uid, channel, purpose, status, amount: '1515.00', mode: 'test'|'live',
--   provider_order_id, seva_order_id, expires_at, paid_at, last_checked_at, late_reason, needs_review, seva_name_en,
--   seva_name_kn, dates: ['YYYY-MM-DD'], created_at }
-- Every function below that returns an order returns seva_payment_order_json; seva_issue_online_order returns
--   seva_order_json(seva_order_id, duplicate) || { late_reason } for a seva order, or { probe: true, order: <order json> } for a probe.
```

New error codes [B1-3] (`lib/seva/errors.ts`; SQL raises them as `SEVA:<code>` - B1-1 may land first, the route layer maps unknown codes to `internal` until B1-3 merges), with status and exact message:

| Code | HTTP | Message |
|---|---|---|
| `same_day_closed` | 400 | `Same-day bookings close at 12:00. Pick tomorrow or a later date.` (the time from detail `cutoff`) |
| `seva_not_online` | 409 | `This seva is booked at the counter only.` |
| `too_many_open_orders` | 429 | `You have 10 bookings waiting for payment. Finish one or wait for it to expire, then try again.` |
| `payments_unavailable` | 503 | `Online payment is not available right now. Please visit the counter.` |
| `gateway_error` | 502 | `The payment gateway did not answer. Try again in a minute.` |
| `order_expired` | 409 | `This payment has expired or is already settled. Start the booking again if you have not paid.` |
| `amount_mismatch` | 409 | `The payment does not match the booking. The office has been told.` |
| `already_refunded` | 409 | `A refund for this receipt is already under way or done.` |
| `refund_window_passed` | 409 | `This payment is older than six months, so it cannot be refunded online.` |
| `fee_rule_refused` | 400 | `A fee can never be added to UPI or debit card payments.` |
| `test_mode_only` | 409 | `Test payments work only in test mode.` |

---

## Wave B0 - Setup (sequential: B0-1, then B0-2)

### Task B0-1: Gateway facts check and SETUP-GUIDE A4.1 and B9

Tier: **Opus high** - web research against vendors' own pages, then a click-by-click guide for readers who have never used Cashfree, Vercel protection settings or Firebase providers (DECISIONS "accounts": "has no clue about these platforms").

**Files:**
- Create: `docs/seva/PAYMENTS-FACTS.md`
- Modify: `docs/seva/SETUP-GUIDE.md` (replace the A4.1 outline with the full click-by-click steps for Nikhil's own accounts; replace the B9 outline with the site owner's steps)
- Test: `tests/unit/seva/payments-facts.test.ts`, `tests/unit/seva/setup-guide.test.ts` (extend)

**Interfaces:**
- Consumes: the **Gateway facts** table above; R1V (verified rows); SETUP-GUIDE writing rules (section 0: numbered steps, "What you should see now:" lines, `(source: <url>, checked <date>)`, "Tell me it is done" in Part A and "Tell Nikhil it is done" in Part B, never a secret in chat; every account step starts from the sign-up screen and assumes nothing exists).
- Produces: `docs/seva/PAYMENTS-FACTS.md` - one `### <Id>` block per check (CF-1..CF-11, V-1, V-2, F-1, G-1), each with `Verdict: CONFIRMED | DIFFERENT | UNVERIFIED`, the exact values found (header names, paths, field names, enum values, hosts), `(source: <url>, checked 2026-10-DD)`, and `Plan impact:` (none, or the task text that must change). Later tasks read their CF/V/F rows from this file. SETUP-GUIDE A4.1 for Nikhil (his own test accounts) and B9 for the site owner.

- [ ] **Step 1: Write the failing tests**

```ts
// payments-facts.test.ts
it('has a block for every check id')            // ['CF-1'..'CF-11','V-1','V-2','F-1','G-1'] each as '### <id>'
it('gives every block a verdict and a checked source') // /Verdict: (CONFIRMED|DIFFERENT|UNVERIFIED)/ and /\(source: https:\/\/[^)]+, checked 2026-\d\d-\d\d\)/ per block
it('holds no secret material')                   // no 'PRIVATE KEY', 'AGE-SECRET-KEY', 'eyJ', /cfsk_/i, /TEST[0-9a-f]{20,}/
// setup-guide.test.ts - headings unchanged; HANDS_ON gains 'A4' and 'B9'
it('cites a checked vendor source in A4.1 and B9')
it('keeps A4.2 as the outline for Plan C')               // replaces the A4/B9 "Written in Plan B" part of the outline test
it('A4.1 names the four Vercel settings and the Preview environment only of Nikhil\'s own Vercel project') // PAYMENTS_PROVIDER, PAYMENTS_MODE, CASHFREE_APP_ID, CASHFREE_SECRET_KEY, 'Preview'
it('A4.1 never asks for the secret key in chat')         // no line pairs 'Secret Key' with 'send me' / 'paste here' / 'chat'
it('B9 lists the two going-live steps for the site owner') // 'replace the test keys with the live keys', 'PAYMENTS_MODE=live', 'Redeploy'
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --ci --watchman=false --forceExit tests/unit/seva/payments-facts.test.ts tests/unit/seva/setup-guide.test.ts`. Expected: FAIL (file missing; A4.1 and B9 still outlines).

- [ ] **Step 3: Check every row on the vendors' own pages and write `docs/seva/PAYMENTS-FACTS.md`**

Use only primary pages (cashfree.com/docs, vercel.com/docs, firebase.google.com/docs, docs.github.com), record the URL and today's date per row. A value the page does not show stays UNVERIFIED with what was searched. Any DIFFERENT row: stop after writing the file and report UNCLEAR naming the row and the plan text it changes.

- [ ] **Step 4: Write SETUP-GUIDE A4.1 and B9**

A4.1 (Nikhil, on his own new accounts only - never the live site's) subsections, each numbered steps with "What you should see now:", vendor sources, and UNVERIFIED marks where screens could not be confirmed:
- A4.1.1 Create a Cashfree merchant account from the sign-up page (what it asks for; test mode works before activation - R1V C5).
- A4.1.2 Switch the dashboard to Test mode and find the test App ID and Secret Key (where they are; copy each straight into his Vercel project, never into chat).
- A4.1.3 Put them in **his own Vercel project of the fork** (SETUP-GUIDE A3) for **Preview only**: `PAYMENTS_PROVIDER=cashfree`, `PAYMENTS_MODE=test`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` (mark it Sensitive), then redeploy his preview.
- A4.1.4 Let Cashfree reach his preview: turn on Vercel's Protection Bypass for Automation (V-2) in his own Vercel project - nothing to copy; the site adds it to the payment alert address itself.
- A4.1.5 Google sign-in in **his own Firebase test project** (F-1; enabled in A2.3 step 4 if he did it then) and his preview host added to that project's Authorized domains.
- A4.1.6 Payment alerts need no set-up: the site sends its own alert address with each order (CF-10); where to see delivered alerts in the Cashfree dashboard.
- A4.1.7 The test UPI ids (CF-9) and how to pay with them on his preview (used in the B3 owner checklist).
- "Tell me it is done": `Section A4 done - test keys in my Vercel Preview <yes/no>, bypass on <yes/no>, Google sign-in on <yes/no>`.

B9 (the site owner, after he merges; written to him, forwardable as it is; read-only until go-live): prerequisites (the temple's own Cashfree account with trust activation papers per R1V C5; Cashfree's written answer on UPI charges up to Rs 2,000; the CA questions of DB §14.7; Vercel plan per O-16 - Hobby is non-commercial); after Plan B is merged to `main`: a long random `SEVA_CRON_SECRET` in **his** Vercel project (Production) and the same value as a secret on **his** repository, plus the repository variable `SEVA_SITE_URL` (G-1: the 5-minute sweep runs only from `main`); then the two steps of DB §14.6: (1) in his Vercel replace the test keys with the live keys and set `PAYMENTS_MODE=live`, (2) Redeploy; then one small real payment, check the receipt, refund it. "Tell Nikhil it is done": `Section B9 done - ...`.

- [ ] **Step 5: Run the tests and see them pass** (same command). Expected: PASS.

- [ ] **Step 6: Commit** - paths: `docs/seva/PAYMENTS-FACTS.md docs/seva/SETUP-GUIDE.md tests/unit/seva/payments-facts.test.ts tests/unit/seva/setup-guide.test.ts`; subject: `docs(seva): check the Cashfree, Vercel and Firebase facts and write SETUP-GUIDE A4.1 and B9`.

### Task B0-2: Packages, env names and the Postgres 15 test runner

Tier: **Opus medium** - two installs and a spike with a defined fallback; the runner is small but must work on this Windows PC and on Linux CI.

**Files:**
- Modify: `package.json`, `package-lock.json` (`@cashfreepayments/cashfree-js` as a dependency - exact name from PAYMENTS-FACTS CF-8; `embedded-postgres` as a devDependency pinned to its latest **15.x** release from `npm view embedded-postgres versions`), `.env.example` (names only, with one comment line each: `PAYMENTS_PROVIDER`, `PAYMENTS_MODE`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_API_BASE_URL` "tests only; refused in live", `SEVA_CRON_SECRET`), `tests/db/harness.ts` (export `SUPABASE_ROLES_SQL`, `BASE_FILES`, `MIGRATIONS_DIR`; no behaviour change)
- Create: `tests/db/pg15.ts`
- Test: `tests/db/pg15-migrations.test.ts`

**Interfaces:**
- Consumes: `sevaMigrationFiles()`, `SUPABASE_ROLES_SQL`, `BASE_FILES` (harness).
- Produces:
```ts
// tests/db/pg15.ts (ESM, DB jest config)
export interface Pg15 { url: string; stop(): Promise<void> }
export async function startPg15(opts?: { port?: number }): Promise<Pg15>;   // fresh data dir under os.tmpdir(), user 'postgres', port 54329 + jest worker id; createDatabase('seva')
export async function migratedPg15(): Promise<Pg15>;                        // startPg15 + extensions uuid-ossp and pgcrypto + SUPABASE_ROLES_SQL + BASE_FILES + every seva migration, via `pg` Client
```
Migration slots for this plan (fixed here): `20261101000000_seva_payments.sql`, `20261101000100_seva_functions_payments.sql` (B1-1), `20261101000200_seva_payment_attention.sql` (B2-5) - all after `20261029235900_seva_privilege_hardening.sql`.

- [ ] **Step 1: Write the failing test**

```ts
// pg15-migrations.test.ts - per-test timeout 180_000
it('runs a real Postgres 15')                                  // select current_setting('server_version_num')::int between 150000 and 159999
it('applies every seva migration on Postgres 15, twice')       // migratedPg15(); then apply each seva file again -> no error (idempotent)
it('keeps RLS on and anon/authenticated revoked on every seva table') // pg_class.relrowsecurity true; has_table_privilege('anon', t, 'SELECT') false
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm run test:db -- --ci --watchman=false --forceExit tests/db/pg15-migrations.test.ts`. Expected: FAIL (`tests/db/pg15.ts` missing).

- [ ] **Step 3: Install the two packages, write the env names and `startPg15` / `migratedPg15`**

`npm install @cashfreepayments/cashfree-js@<exact version>` and `npm install -D embedded-postgres@<exact 15.x version>` (no `^`). If the Postgres binary cannot start on this PC or lacks `uuid-ossp`/`pgcrypto`, uninstall `embedded-postgres`, keep the Cashfree install, and report **UNCLEAR** with the error text; the orchestrator then drops the two B1-1 concurrency tests and Review Focus 5 is covered by review of the row locks.

- [ ] **Step 4: Run it and see it pass** (same command), then `npm run typecheck`. Expected: PASS, 3 tests.

- [ ] **Step 5: Commit** - paths: `package.json package-lock.json .env.example tests/db/harness.ts tests/db/pg15.ts tests/db/pg15-migrations.test.ts`; subject: `chore(seva): add the Cashfree checkout loader, payment env names and a Postgres 15 test runner`.

**Wave B0 gate:** `$STATE/test-reports/B0-TEST-REPORT.md` with the facts verdict counts and the PG15 test result. Owner checklist (2 minutes): read PAYMENTS-FACTS' verdict summary; when convenient, Nikhil follows SETUP-GUIDE A4.1.1-A4.1.5 on his own Cashfree, Vercel (fork) and Firebase test accounts (needed before the B3 owner gate, not before B1).

---

## Wave B1 - Core (5 tasks in parallel; needs B0)

### Task B1-1: Payment tables and SQL functions

Tier: **Opus xhigh** - money, numbering and idempotency in one transaction; the live project will run this SQL, and a wrong answer issues or loses real receipts.

**Files:**
- Create: `supabase/migrations/20261101000000_seva_payments.sql`, `supabase/migrations/20261101000100_seva_functions_payments.sql`
- Test: `tests/db/seva-payments.test.ts`, `tests/db/seva-payments-refunds.test.ts`, `tests/db/seva-payments-concurrency.test.ts` (Postgres 15 runner)

**Interfaces:**
- Consumes: `seva_take_numbers`, `seva_next_group_no`, `seva_issue_devotee`, `seva_issue_write_lines`, `seva_order_json`, `seva_audit`, `seva_ist_parts`, `seva_receipt_no` (Plan A); fixtures `seedStaff`, `seedSeva` (with `visibility`, `multiDate`, `anyAmount`); `migratedPg15()` (B0-2).
- Produces - tables (DB §7.7 with additions marked +):
  - `payment_orders`: DB §7.7 columns, plus `purpose text not null default 'seva' check in ('seva','probe')` (+), `checkout_key_hash text not null` (+), `checkout_session_id text` (+), `account_email text` (+), `late_reason text check in ('after_expiry','seva_date_passed')` (+), `needs_review text check in ('amount_mismatch')` (+); `provider_mode` drives test mode; check `purpose = 'seva' OR provider_mode = 'test'`.
  - `payments`, `payment_events` (outcome adds `refund_updated`, `ignored`, `probe_paid`; check `signature_ok OR event_key LIKE 'unsigned:%'`), `refunds`, `payment_settings` (one seeded row, id 1, `fee_rule_enabled false`).
  - `ALTER TABLE seva_orders ADD CONSTRAINT seva_orders_payment_order_fk FOREIGN KEY (payment_order_id) REFERENCES payment_orders (id) ON DELETE RESTRICT NOT VALID;` then `VALIDATE CONSTRAINT` (guarded by a `pg_constraint` existence check so the file runs twice).
  - Every new table: RLS deny-all policy, `REVOKE ALL ... FROM anon, authenticated`, `REVOKE TRIGGER, REFERENCES ... FROM service_role, anon, authenticated`; mutable tables get the `update_updated_at_column()` trigger.
- Produces - functions:
```sql
seva_payment_order_json(p_id uuid) returns jsonb                                           -- Shared contracts shape
seva_create_payment_order(p_devotee_uid text, p_channel text, p_draft jsonb, p_provider text, p_mode text) returns jsonb
  -- prices from sevas (active, visibility online|both, not any_amount -> seva_not_online / seva_inactive); dates via
  -- seva_settings.online_days_ahead and online_same_day_cutoff in IST (date_out_of_range / same_day_closed); one receipt per
  -- date, multi-date only if sevas.multi_date (validation), max 31; devotee via seva_issue_devotee; fee 0; status 'created';
  -- expires_at = now() + 30 min; order_ref 'SV' || IST YYMM || 12 upper-case hex from gen_random_uuid(); rate limit
  -- (10 created/pending orders for the uid in the last hour -> too_many_open_orders); probe: p_mode 'test' only
  -- (test_mode_only), amount 1.00. Audit payment.order_created (no devotee details). Returns seva_payment_order_json.
seva_mark_payment_order(p_order_ref text, p_status text, p_provider_order_id text, p_payments jsonb,
                        p_failure text default null, p_checkout_session_id text default null) returns jsonb
  -- transitions: created -> pending|paid|failed|expired; pending -> pending|paid|failed|expired; failed|expired -> paid (C-45);
  -- paid -> paid only (other targets leave it paid and return it unchanged); anything else SEVA:validation {field:'status'}.
  -- p_payments [{ provider_payment_id, method:'upi', amount:'1515.00', status, bank_reference, payer_vpa_masked, paid_at }]
  -- upserted on (payment_order_id, provider_payment_id); paid sets paid_at = max(success paid_at) or now(); unknown ref -> not_found
seva_claim_payment_check(p_order_ref text, p_min_interval_seconds int) returns boolean    -- sets last_checked_at = now() only if null or older; true when claimed
seva_issue_online_order(p_payment_order_id uuid, p_confirmed jsonb) returns jsonb
  -- SELECT ... FOR UPDATE on the order first. p_confirmed { amount, currency, order_ref, paid_at }. Not paid -> SEVA:validation
  -- {field:'status'}; amount <> amount_charged, currency <> 'INR' or order_ref <> ours -> SEVA:amount_mismatch (writes nothing);
  -- already issued -> seva_order_json(seva_order_id, true); probe -> { probe: true, order }. Otherwise: series WT when
  -- provider_mode 'test' else W; channel WEB/APP from payment_orders.channel; numbers in seva-date order from
  -- seva_take_numbers(series, IST year, n); seva_orders (channel web|app, devotee_uid, payment_mode 'online',
  -- payment_order_id, test_mode, issued_at now(), counter/device/staff null, amount_total = seva_amount, client_order_id
  -- from the draft); receipts (staff_no null, business_date IST today, issued_by_name 'Online booking', qr_token and
  -- client_receipt_id from the draft, prasadam pending when a line gives prasadam); lines from the stored draft (the price
  -- paid, even if the catalogue changed since); payment_orders.seva_order_id set; late_reason 'after_expiry' when
  -- paid_at > expires_at, else 'seva_date_passed' when the first seva date < IST today; no devotee_profiles write.
  -- Audits payment.issued, plus payment.paid_late when late. Returns seva_order_json(..., false) || { late_reason }
seva_flag_payment_mismatch(p_payment_order_id uuid, p_detail jsonb) returns void          -- needs_review 'amount_mismatch' + audit payment.amount_mismatch (detail: expected, got, currency, ref)
seva_record_payment_event(p_provider text, p_mode text, p_event_key text, p_event_type text, p_signature_ok boolean,
                          p_order_ref text, p_payload jsonb) returns jsonb
  -- { event_id, duplicate }: INSERT ... ON CONFLICT (provider, event_key) DO NOTHING; on conflict duplicate = true when the
  -- existing row has processed_at set and outcome <> 'error', or it is unsigned; otherwise the existing id, duplicate false.
  -- Links payment_order_id from p_order_ref when it exists.
seva_finish_payment_event(p_event_id bigint, p_outcome text, p_error text) returns void   -- processed_at now(), outcome, error (<= 200 chars)
seva_request_refund(p_payment_order_id uuid, p_receipt_ids uuid[], p_reason text, p_staff_id uuid) returns jsonb
  -- staff active; reason >= 3 chars (validation); order paid (validation) and paid_at within 180 days (refund_window_passed);
  -- each receipt belongs to the order's seva order: issued -> cancelled with reason 'refunded', cancel_note = reason,
  -- refund_state 'processing'; cancelled with refund_state 'due' -> refund_state 'processing'; processing|done ->
  -- already_refunded; anything else validation. Probe: empty p_receipt_ids, amount = amount_charged. Sum of
  -- non-failed refunds <= amount_charged. refund_ref 'RF' || IST YYMM || 12 hex. Audits payment.refund_requested and
  -- receipt.cancel per newly cancelled receipt. Returns { refund_id, refund_ref, order_ref, amount, receipt_ids }
seva_update_refund(p_refund_ref text, p_status text, p_provider_refund_id text, p_failure text) returns jsonb
  -- requested -> processing|succeeded|failed; processing -> succeeded|failed; failed -> processing|succeeded; same status ->
  -- no change; succeeded is final. Receipts: processing -> 'processing'; succeeded -> 'done', refund_note
  -- 'Refunded online <refund_ref>'; failed -> 'failed'. Audits payment.refund_succeeded / payment.refund_failed. Returns the refund row json
seva_payments_due_for_check(p_now timestamptz, p_limit int) returns jsonb
  -- { orders: [order_ref] (status created|pending, created_at <= p_now - 5 min, oldest first),
  --   refunds: [{ order_ref, refund_ref, status }] (requested older than 2 min, or processing) }, each list at most p_limit
seva_set_fee_rule(p_enabled boolean, p_rule jsonb, p_staff_id uuid) returns void
  -- p_rule { amount: '5.00', methods: [...] }; methods non-empty subset of credit_card, net_banking, wallet; any method text
  -- containing 'upi' or 'debit' -> fee_rule_refused; enabled needs a rule; audit payment.fee_rule_change before/after
seva_devotee_bookings(p_devotee_uid text, p_limit int) returns jsonb   -- { orders: [seva_order_json ...] newest first, waiting: [seva_payment_order_json ...] created|pending }
seva_devotee_booked_before(p_devotee_uid text, p_limit int) returns jsonb  -- distinct devotee details from this uid's seva_orders, newest first
```
All functions: the Plan A function rules (grants, `SEVA:<code>` errors, one transaction, no dynamic SQL), Postgres 15 only.

- [ ] **Step 1: Write the failing tests**

```ts
// seva-payments.test.ts - fixtures: staff 008 'Prakash'; PAA 'Paaduka Pooja' 505 online, multi-date, prasadam; PAN 105 visibility 'counter';
// KAR any-amount; settings online_days_ahead 90, cutoff '12:00'; draft with dates D+1, D+2, D+3
it('prices an order from the catalogue and ignores any amount in the draft')   // amount '1515.00', fee 0, amount_charged '1515.00', status 'created'
it('makes an SV order ref and expires it 30 minutes after creation')           // /^SV\d{4}[0-9A-F]{12}$/, expires_at - created_at = 30 min
it('refuses counter-only and any-amount sevas')                                // SEVA:seva_not_online for PAN and KAR
it('refuses a switched-off seva')                                              // SEVA:seva_inactive
it('refuses past dates and dates beyond 90 days')                              // SEVA:date_out_of_range
it('closes same-day booking at 12:00 IST')                                     // now 11:59 IST + today -> ok; 12:00 IST -> SEVA:same_day_closed
it('allows several dates only for a multi-date seva')                          // single-date seva + 2 dates -> SEVA:validation
it('refuses the 11th open order in an hour for one account')                   // 10 ok, 11th SEVA:too_many_open_orders; another uid ok
it('allows a probe only in test mode, for Rs 1')                               // live -> SEVA:test_mode_only; test -> amount '1.00'
it('moves an order through created, pending and paid and stores payments')     // payments row with payer_vpa_masked, bank_reference
it('lets money win after failed or expired')                                   // expired -> paid allowed; paid -> expired returns paid unchanged
it('claims a status check at most once per interval')                          // true, then false within 15 s, true after
it('issues WT receipts in test mode, one per date, in date order')             // 'WT-WEB-<MM>-<YYYY>/000001'..000003, totals '505.00', positions 1..3, seva_orders.payment_mode 'online', test_mode true
it('issues W-APP and W-WEB from one running number')                           // web order -> W-WEB-.../000001, app order -> W-APP-.../000002
it('repeated issue returns the same receipts')                                 // duplicate true, same ids; receipt_series_years.last_no unchanged
it('refuses to issue when the confirmed amount, currency or ref differs')      // '1514.99', 'USD', other ref -> SEVA:amount_mismatch; no seva_orders row
it('refuses to issue an order that is not paid')                               // SEVA:validation field status
it('issues for an expired order confirmed paid and marks after_expiry')        // late_reason 'after_expiry'; audit payment.paid_late
it('marks seva_date_passed when the first seva date is already past')
it('keeps test receipts out of the dashboard, continuity and online tile')     // seva_dashboard online '0.00' with only WT; W order counts
it('a probe paid issues nothing')                                              // { probe: true }; seva_order_id null
it('flags a mismatch for review with an audit row')                            // needs_review 'amount_mismatch'; audit payment.amount_mismatch
it('a processed event key is a duplicate, an errored one is processed again')  // finish 'issued' -> duplicate true; finish 'error' -> duplicate false, same id
it('records unsigned events under unsigned keys only')                         // signature_ok false with key 'abc' -> check violation; 'unsigned:abc' ok
it('lists orders and refunds due for a check')
it('lists this account\'s bookings and earlier details only')                  // uid A sees its own; uid B none
it('the prasadam counter can mark a W receipt given')                          // seva_mark_prasadam on a WT receipt -> 'given'
// seva-payments-refunds.test.ts
it('refund cancels issued receipts with reason refunded and sets processing')  // cancel_reason_code 'refunded', refund_state 'processing', refunds.amount '505.00'
it('refunds a receipt already cancelled with refund due')                       // keeps its cancel reason; refund_state 'processing'
it('refuses a second refund of the same receipt')                               // SEVA:already_refunded
it('needs a reason of three characters')                                       // SEVA:validation
it('refuses refunds after 180 days')                                            // SEVA:refund_window_passed
it('never refunds more than was paid')
it('success marks receipts done with the refund ref; failure marks them failed')
it('refund status updates are idempotent and succeeded is final')
it('refuses a fee rule naming UPI or a debit card')                             // methods ['upi'] / ['debit_card'] / ['rupay_debit'] -> SEVA:fee_rule_refused
it('stores a flat fee rule for credit cards and audits the change')
// seva-payments-concurrency.test.ts (migratedPg15, two pg Clients, per-test timeout 180_000)
it('two orders issued at once get consecutive W numbers')                      // two paid live orders, Promise.all of two issues -> numbers {1,2,3} for 1+2 dates, no duplicates, no gap
it('one order confirmed twice at once issues one set')                         // Promise.all of the same issue on two connections -> one seva_orders row, one duplicate answer
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm run test:db -- --ci --watchman=false --forceExit tests/db/seva-payments.test.ts tests/db/seva-payments-refunds.test.ts tests/db/seva-payments-concurrency.test.ts`. Expected: FAIL (tables and functions do not exist).

- [ ] **Step 3: Implement the two migrations** with the tables and functions above.

- [ ] **Step 4: Run them and see them pass** (same command), then `npm run test:db -- --ci --watchman=false --forceExit tests/db/pg15-migrations.test.ts tests/db/seva-schema.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** - paths: the two migrations and three test files; subject: `feat(seva): add payment tables and SQL functions for online orders, issue, events and refunds`.

### Task B1-2: Payment provider adapter, Cashfree implementation and the gateway mock

Tier: **Opus xhigh** - signature checks, money calls and secrets; formats come from B0-1's facts file, not memory.

**Files:**
- Create: `lib/seva/payments/types.ts`, `lib/seva/payments/index.ts`, `lib/seva/payments/cashfree.ts`, `lib/seva/payments/signature.ts`, `tests/support/cashfree-mock.ts`
- Test: `tests/unit/seva/payments-cashfree.test.ts`, `tests/unit/seva/payments-env.test.ts`, `tests/unit/seva/cashfree-mock.test.ts` (all `/** @jest-environment node */`)

**Interfaces:**
- Consumes: `docs/seva/PAYMENTS-FACTS.md` rows CF-1..CF-7, V-1, V-2; `fromPaise`, `toPaise` (`lib/seva/money.ts`).
- Produces: `types.ts` and `index.ts` exactly as in **Shared contracts**, plus:
```ts
// lib/seva/payments/signature.ts
export function verifyCashfreeSignature(rawBody: string, timestamp: string, signature: string, secret: string): boolean; // base64(HMAC-SHA256(secret, timestamp + rawBody)), timingSafeEqual on equal-length buffers, false on any malformed input
// lib/seva/payments/cashfree.ts (no 'server-only'; secrets only through config)
export interface CashfreeConfig { appId: string; secretKey: string; mode: ProviderMode; baseUrl?: string; fetch?: typeof fetch; timeoutMs?: number /* default 8000 */ }
export function createCashfreeProvider(config: CashfreeConfig): PaymentProvider;
export function maskVpa(vpa: string): string;               // 'venkatesh@okhdfc' -> 've*******@okhdfc'; no '@' -> '***'
// tests/support/cashfree-mock.ts
export interface CashfreeMock { fetch: typeof fetch; calls: { method: string; path: string; headers: Record<string, string>; body: unknown }[];
  pay(orderRef: string, opts?: { amountPaise?: number; currency?: string; status?: 'SUCCESS' | 'FAILED' | 'USER_DROPPED'; paidAt?: string }): void;
  expire(orderRef: string): void; refundResult(refundRef: string, status: 'SUCCESS' | 'PENDING' | 'CANCELLED'): void;
  failNext(path: string, status: number): void;
  webhook(type: string, orderRef: string, opts?: { refundRef?: string; tamper?: boolean; eventId?: string }): { rawBody: string; headers: Headers } }
export function createCashfreeMock(opts: { appId: string; secretKey: string; now?: () => Date }): CashfreeMock;
```
Mapping (per CF rows): `order_amount` = `Number(fromPaise(amountPaise))`; answers back through `toPaise(String(n))`; `order_status` `PAID`->paid, `ACTIVE`->pending, `EXPIRED`->expired, `TERMINATED`/`TERMINATION_REQUESTED`->failed, anything else pending; payment `SUCCESS`->success, `FAILED`->failed, `USER_DROPPED`->user_dropped, others pending; refund `SUCCESS`->succeeded, `PENDING`/`ONHOLD`->processing, `CANCELLED`->failed. `customer_id` = uid with characters outside `[A-Za-z0-9_-]` replaced by `_`, max 50; `customer_phone` = the 10 digits after `+91`. `payment_methods: 'upi'` on every create. Refund `refund_id` = our `refundRef`. Event key = the event id header named in CF-7 when present, else `sha256:<hex of raw body>`. 404 -> `ProviderError('not_found', 404)`; network error, timeout or 5xx -> `'unavailable'`; other 4xx -> `'rejected'`; error messages are `cashfree <operation> failed (<status>)` only.

- [ ] **Step 1: Write the failing tests**

```ts
// payments-cashfree.test.ts (against createCashfreeMock().fetch)
it('creates an order with UPI only, rupees with two decimals and our order ref') // body.order_id 'SV2610ABCDEF012345', order_amount 1515, order_currency 'INR', order_meta.payment_methods 'upi', notify_url and return_url passed
it('sends the client id, secret and API version headers to the test base URL')  // https://sandbox.cashfree.com/pg/orders, x-api-version per CF-2
it('sends the phone as ten digits and a safe customer id')                        // '+919845012345' -> '9845012345'; uid 'a.b/c' -> 'a_b_c'
it('maps order statuses to paid, pending, expired and failed')
it('returns amount, currency, ref and masked payments from fetchOrder')          // amountPaise 151500, currency 'INR', payerVpaMasked 've*******@okhdfc'
it('throws not_found for an unknown order and unavailable for a 503')
it('times out after 8 seconds as unavailable')
it('never puts the secret key or app id in an error message')                   // message and String(error) exclude both
it('creates a refund with our refund ref as its id and maps refund statuses')
it('verifies a webhook signed by the mock and reads its order and refund refs') // eventType 'PAYMENT_SUCCESS_WEBHOOK', orderRef, payload has no customer fields
it('rejects a changed byte, a missing header and a wrong secret')               // verifyWebhook -> null
it('uses the event id header as the key, else sha256 of the body')
it('verifyCashfreeSignature matches a known vector')                             // secret 'test_secret', ts '1700000000', body '{"a":1}' -> the base64 computed with node:crypto in the test
// payments-env.test.ts
it('picks Cashfree in test mode from env and reports keys present')
it('refuses razorpay, missing keys and a base URL override in live')            // ProviderError kind 'not_configured'
it('readPaymentsEnv never throws and defaults to test')
it('builds the preview base URL from VERCEL_BRANCH_URL and the production one from NEXT_PUBLIC_SITE_URL')
it('adds the protection bypass to the webhook URL only on previews')
// cashfree-mock.test.ts
it('refuses calls without the right client id and secret')                      // 401
it('pays an order and lists its payment')
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --ci --watchman=false --forceExit tests/unit/seva/payments-cashfree.test.ts tests/unit/seva/payments-env.test.ts tests/unit/seva/cashfree-mock.test.ts`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement** the five files with the signatures and mapping above (plain `fetch` with `AbortController`; `node:crypto` `createHmac`, `createHash`, `timingSafeEqual`).

- [ ] **Step 4: Run them and see them pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit** - paths: the five source files and three tests; subject: `feat(seva): add the payment provider interface, the Cashfree adapter and a gateway mock`.

### Task B1-3: Devotee booking rules, schemas, wire types and error codes

Tier: **Opus medium** - rules fixed by the spec; pure code.

**Files:**
- Create: `lib/seva/devotee/rules.ts`, `types/seva-devotee.ts`, `types/seva-payments.ts`
- Modify: `lib/seva/schemas.ts` (add `devoteeOrderSchema`, `refundRequestSchema`, `feeRuleSchema`, `orderRefSchema`, `checkoutKeySchema` and their `z.infer` types), `lib/seva/errors.ts` (the eleven codes, statuses and messages of **Shared contracts**)
- Test: `tests/unit/seva/devotee-rules.test.ts`, `tests/unit/seva/schemas-devotee.test.ts`, `tests/unit/seva/errors.test.ts` (extend)

**Interfaces:**
- Consumes: `devoteeSchema` and its phone rule, `addDays`, `businessDate`, `istParts` (`lib/seva/time.ts`), `DevoteeInput`, `IssuedReceipt`, `SlipSettings` (`types/seva.ts`).
- Produces: `rules.ts`, `types/seva-devotee.ts`, `types/seva-payments.ts` as in **Shared contracts**; schemas:
```ts
export const devoteeOrderSchema;   // { sevaId: guid, dates: 'YYYY-MM-DD'[] 1..31, devotee: devoteeSchema, payerPhone: required Indian mobile -> '+91XXXXXXXXXX', channel: 'web'|'app' }; unknown keys stripped (a client amount is dropped, never an error)
export const refundRequestSchema;  // { paymentOrderId: guid, receiptIds: guid[] 0..31 (unique), reason: trimmed 3..200 }
export const feeRuleSchema;        // { enabled: boolean, rule: { amountPaise: int 1..10000, methods: ('credit_card'|'net_banking'|'wallet')[] 1..3 } | null }
export const orderRefSchema;       // /^SV\d{4}[0-9A-F]{12}$/
export const checkoutKeySchema;    // isQrToken shape: 22 chars [A-Za-z0-9_-]
```
`buildDevoteeDraft` maps the devotee exactly as the counter's `toSqlOrder` maps `devotee` (A3-1, `lib/seva/server/counter.ts:191`) and adds `purpose: 'seva'`.

- [ ] **Step 1: Write the failing tests**

```ts
// devotee-rules.test.ts
it('allows today until 11:59 IST and closes it at 12:00')       // now 2026-10-19T06:29:00Z -> todayOpen true, min '2026-10-19'; 06:30:00Z -> false, min '2026-10-20'
it('allows dates up to 90 days ahead')                           // max '2027-01-17' for today '2026-10-19'
it('uses the IST date near midnight')                            // 2026-10-19T18:31:00Z -> today '2026-10-20'
it('refuses past, beyond-90 and closed same-day dates')          // codes date_out_of_range, same_day_closed
it('allows several dates only for a multi-date seva and sorts them') // ['2026-10-23','2026-10-21'] -> ['2026-10-21','2026-10-23']; duplicates removed; 2 dates on a single-date seva -> validation
it('refuses more than 31 dates')
it('builds a draft with one receipt per date and the counter devotee keys') // phone_e164 '+919845012345', gotra_id, nakshatra_id; receipts[i].seva_date sorted
// schemas-devotee.test.ts
it('normalises the payer mobile and the devotee phone like the counter') // '98450 12345' / '+91 98450-12345' / '09845012345' -> '+919845012345'
it('needs a name of 1 to 80 characters and keeps Kannada names')
it('drops an amount sent by the client')                         // parse({..., amountPaise: 100}) has no amountPaise
it('refuses an unknown channel and more than 31 dates')
it('refund requests need a reason of three characters')
it('fee rules can name only credit card, net banking and wallet') // 'upi' -> issue
// errors.test.ts
it('maps the payment codes to their statuses and messages')     // same_day_closed 400 'Same-day bookings close at 12:00. Pick tomorrow or a later date.', too_many_open_orders 429, payments_unavailable 503, gateway_error 502
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --ci --watchman=false --forceExit tests/unit/seva/devotee-rules.test.ts tests/unit/seva/schemas-devotee.test.ts tests/unit/seva/errors.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the rules, types, schemas and codes.

- [ ] **Step 4: Run them and see them pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit** - paths: the three new files, `lib/seva/schemas.ts`, `lib/seva/errors.ts`, three tests; subject: `feat(seva): add online booking rules, devotee and payment schemas, wire types and error codes`.

### Task B1-4: Payment orchestration (start, confirm, refund) with injected dependencies

Tier: **Opus xhigh** - the money decision itself: when a gateway answer becomes receipts, and what a mismatch does.

**Files:**
- Create: `lib/seva/payments/core.ts`, `lib/seva/server/payments.ts`, `lib/seva/issue-json.ts`
- Modify: `lib/seva/server/counter.ts` (move `fromSqlIssue` and the private helpers only it uses into `lib/seva/issue-json.ts`; `counter.ts` imports shared helpers from there and re-exports `fromSqlIssue`, so every existing importer keeps working)
- Test: `tests/unit/seva/payments-core.test.ts` (`@jest-environment node`; real `createCashfreeProvider` on `createCashfreeMock().fetch`, `rpc` a `jest.fn` per test), `tests/unit/seva/api-counter.test.ts` (run unchanged, must still pass)

**Interfaces:**
- Consumes: `PaymentProvider`, `ProviderError`, `getPaymentProvider`, `paymentsBaseUrl`, `webhookUrl` (B1-2); the SQL contract and function names (B1-1); `SqlPaymentDraft` (B1-3); `fromSqlIssue` (today in `lib/seva/server/counter.ts`, which imports `server-only`; this task moves it to the pure `lib/seva/issue-json.ts` so `core.ts` stays importable from the ESM database tests); `newQrToken` (`lib/seva/qr.ts`); `toPaise`, `fromPaise`; `SevaError`.
- Produces: everything under `lib/seva/payments/core.ts` and `lib/seva/server/payments.ts` in **Shared contracts**. Decisions:
  - `startPaymentOrder`: checkout key = `newQrToken()`, its SHA-256 hex goes into the draft as `checkout_key_hash`, `account_email` = input email; `seva_create_payment_order(uid, channel, draft, provider.name, provider.mode)`; then `provider.createOrder({ orderRef, amountPaise, customer: { uid, name: customerName, phone: payerPhone, email }, returnUrl: baseUrl + '/sevas/checkout/' + ref + '/return' + (channel === 'app' ? '?return=app' : ''), notifyUrl, expiresAt })`; then `seva_mark_payment_order(ref, 'pending', providerOrderId, '[]', null, sessionId)`. A `ProviderError` marks the order `failed` with `p_failure 'gateway_create_failed'` and throws `SevaError('gateway_error')`. `checkoutUrl` = `/sevas/checkout/<ref>?k=<key>`.
  - `confirmPaymentOrder`: when `opts.minIntervalSeconds` is given, `seva_claim_payment_check` first (false -> outcome `throttled`, order as stored). `provider.fetchOrder(ref)`: `not_found` -> `unknown_order` when we have no such ref, else the order stays as it is and the outcome is `not_paid`. Then `seva_mark_payment_order` with the mapped status and payments. Issue only when status `paid` **and** `currency === 'INR'` **and** `orderRef === ours` **and** `amountPaise === order.amountPaise` **and** some payment has `status 'success'` with that amount; otherwise, if the gateway says paid, `seva_flag_payment_mismatch` and outcome `amount_mismatch`. `seva_issue_online_order` answers map to `issued`, `already_issued` (duplicate) or `probe_paid`. A gateway `failed`/`expired` never moves an order that is already paid.
  - `requestRefund`: `seva_request_refund`, then `provider.createRefund` with our `refund_ref`; `ProviderError('unavailable')` leaves the refund `requested` (the sweep retries with the same ref); `rejected` -> `seva_update_refund(ref, 'failed', null, 'rejected by gateway')`; otherwise `seva_update_refund` with the answer.
  - `syncRefund`: `provider.fetchRefund` -> `seva_update_refund`.
  - `defaultPaymentDeps()` throws `SevaError('payments_unavailable')` when `getPaymentProvider` throws `not_configured`.

- [ ] **Step 1: Write the failing tests**

```ts
it('starts an order: SQL first, then the gateway with our ref, then pending with the session') // rpc call order: seva_create_payment_order, seva_mark_payment_order('pending', cf id, '[]', null, session)
it('sends the return URL to the checkout return page, with return=app for the app')
it('stores only the hash of the checkout key and returns the key in the checkout URL') // draft.checkout_key_hash = sha256(key); checkoutUrl '/sevas/checkout/<ref>?k=<key>'
it('marks the order failed and answers gateway_error when the gateway is down')
it('issues when the gateway says paid in full in INR for our ref')                // seva_issue_online_order called with { amount: '1515.00', currency: 'INR', order_ref }
it('does not issue on a one-paisa, currency or ref mismatch and flags the order') // 151499 / 'USD' / other ref -> seva_flag_payment_mismatch, outcome amount_mismatch, no issue call
it('does not issue when no successful payment carries the amount')
it('a failed status after paid leaves the order paid')                            // Review Focus 1
it('answers already_issued for a second confirm')
it('answers throttled inside the check interval without calling the gateway')
it('answers unknown_order for a ref we never made')
it('a paid probe issues no receipts')                                             // outcome probe_paid
it('a refund calls the gateway with our refund ref and stores its answer')
it('a refund stays requested when the gateway is unreachable')
it('a refund rejected by the gateway is marked failed')
it('syncRefund stores the gateway refund status')
it('defaultPaymentDeps answers payments_unavailable without keys')
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --ci --watchman=false --forceExit tests/unit/seva/payments-core.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** `core.ts` (no env, no `server-only`, nothing imported from `lib/seva/server/*`), `server/payments.ts` (`import 'server-only'`, wires the defaults) and the `issue-json.ts` move.

- [ ] **Step 4: Run it and see it pass**: `npx jest --ci --watchman=false --forceExit tests/unit/seva/payments-core.test.ts tests/unit/seva/api-counter.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** - paths: the three created files, `lib/seva/server/counter.ts` and the test; subject: `feat(seva): add the payment orchestration - start, confirm against the gateway, refund`.

### Task B1-5: Google sign-in on the website, the CSP for Google and Cashfree, and the e2e devotee account

Tier: **Opus high** - touches sign-in and the site-wide Content-Security-Policy; must keep the Firestore rules' profile-write contract.

**Files:**
- Modify: `services/auth.service.ts` (add `loginWithGoogle()`), `context/AuthContext.tsx` (expose `loginWithGoogle: () => Promise<void>`), `app/(auth)/login/page.tsx` and `app/(auth)/register/page.tsx` ("Continue with Google" button above the email form), `next.config.ts` and `proxy.ts` (the same CSP additions in both), `tests/e2e/seva/global-setup.ts` (create `e2e-devotee@example.test`, password `E2E_PASSWORD`, `users/{uid}` with `role: 'devotee'`, `isActive: true`)
- Create: `tests/e2e/seva/fixtures/devotee.ts`
- Test: `tests/unit/auth-google.test.ts`, `tests/unit/seva/csp.test.ts`

**Interfaces:**
- Consumes: `buildSignInProfileWrite` (`lib/auth/sign-in-profile.ts`); PAYMENTS-FACTS F-1 and CF-8 hosts; `E2E_PASSWORD`, the login form's `input[name="email"]` flow (`fixtures/auth.ts`).
- Produces:
```ts
// services/auth.service.ts
async loginWithGoogle(): Promise<UserCredential>;   // signInWithPopup(auth, new GoogleAuthProvider()); then the same merge write as login(), typedEmail = user.email ?? ''
// tests/e2e/seva/fixtures/devotee.ts
export const E2E_DEVOTEE_EMAIL = 'e2e-devotee@example.test';
export async function signInAsDevotee(page: Page, redirect: string): Promise<void>;   // same /login flow as signInAs
```
CSP additions (both files; exact hosts from F-1 and CF-8): `script-src` + `https://apis.google.com` + the Cashfree SDK host; `frame-src` + `https://*.firebaseapp.com https://accounts.google.com` + any Cashfree frame host; `connect-src` + the Cashfree hosts the SDK calls. No `form-action` is added. `fixtures/auth.ts` is not changed (the devotee is not an `E2ERole`).

- [ ] **Step 1: Write the failing tests**

```ts
// auth-google.test.ts (mocks firebase/auth and firebase/firestore)
it('signs in with a Google popup and creates a devotee profile on first sign-in') // setDoc merge payload role 'devotee', isActive true
it('keeps an existing profile\'s role and active flag')                          // existing role 'temple_admin' -> payload has no role/isActive/isApproved
it('the login page shows Continue with Google')                                  // render login page, button name /Continue with Google/
// csp.test.ts
it('next.config and proxy send the same Content-Security-Policy')
it('allows Google sign-in frames and scripts')                                   // frame-src has https://*.firebaseapp.com and https://accounts.google.com; script-src https://apis.google.com
it('allows the Cashfree checkout hosts and nothing broader')                     // each host from PAYMENTS-FACTS CF-8 present; no '*' alone, no 'https:' alone
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --ci --watchman=false --forceExit tests/unit/auth-google.test.ts tests/unit/seva/csp.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the service method, context field, two buttons, CSP edits, global-setup account and `devotee.ts` fixture.

- [ ] **Step 4: Run them and see them pass** (same command), then `npx jest --ci --watchman=false --forceExit tests/unit/seva/shell.test.tsx` (the context type change). Expected: PASS.

- [ ] **Step 5: Commit** - paths: the eight modified/created source files and two tests; subject: `feat(site): add Google sign-in, allow Google and Cashfree in the CSP, and an e2e devotee account`.

**Wave B1 gate - owner's 5-minute checklist**
1. Read `B1-TEST-REPORT.md`: the DB suite (with the two Postgres 15 concurrency tests) and the unit suite pass.
2. If not done yet, Nikhil follows SETUP-GUIDE A4.1 on his own accounts (Cashfree test keys in the Preview of his own Vercel project of the fork, bypass on that project, Google sign-in and the preview host in his own Firebase test project).

---

## Wave B2 - API (5 tasks in parallel; needs B1)

### Task B2-1: Devotee routes - online catalogue, order, status, checkout, My seva bookings, booked before

Tier: **Opus xhigh** - creates money orders for any signed-in member of the public; ownership checks on every read.

**Files:**
- Create: `lib/seva/server/devotee.ts`, `app/api/seva/devotee/sevas/route.ts` (GET, no sign-in), `app/api/seva/devotee/orders/route.ts` (POST), `app/api/seva/devotee/orders/[ref]/route.ts` (GET), `app/api/seva/devotee/checkout/[ref]/route.ts` (GET, no sign-in, key in `?k=`), `app/api/seva/devotee/receipts/route.ts` (GET), `app/api/seva/devotee/booked-before/route.ts` (GET), `services/seva/devotee.service.ts`, `tests/e2e/seva/fixtures/fake-devotee.ts`
- Modify: `lib/seva/server/counter.ts` (export `slipSettings` and `festivalChips`; no behaviour change)
- Test: `tests/unit/seva/api-devotee.test.ts`, `tests/unit/seva/fake-devotee.test.ts`

**Interfaces:**
- Consumes: `getIdentityAdapter().verifyRequest` (A2-4); `startPaymentOrder`, `confirmPaymentOrder`, `defaultPaymentDeps`, `paymentsAvailable`, `fromSqlPaymentOrder` (B1-4); `readPaymentsEnv` (B1-2); `devoteeOrderSchema`, `orderRefSchema`, `checkoutKeySchema`, `onlineDateBounds`, `buildDevoteeDraft` (B1-3); `seva_devotee_bookings`, `seva_devotee_booked_before` (B1-1); `fromSqlIssue`, `slipSettings`, `festivalChips`; `newQrToken`; `rateLimit`; `sevaJson`, `sevaErrorResponse`, `parseInput`, `readJson`; `createFakeSevaApi(...).extend` (A2-12).
- Produces:
```ts
// lib/seva/server/devotee.ts (import 'server-only')
export type DevoteeResult = { ok: true; uid: string; email: string | null } | { ok: false; response: NextResponse };
export async function requireDevotee(req: NextRequest): Promise<DevoteeResult>;   // verifyRequest only; null -> 401 unauthenticated; provider down -> 500
export async function loadOnlineCatalogue(now: Date): Promise<OnlineCatalogue>;
export async function loadOrderStatusForDevotee(uid: string, orderRef: string, now: Date): Promise<DevoteeOrderStatus>; // not this uid's -> SevaError('not_found'); created|pending -> confirmPaymentOrder(ref, { minIntervalSeconds: 15 }) first
export async function loadCheckoutInfo(orderRef: string, key: string): Promise<CheckoutInfo>;  // sha256(key) vs checkout_key_hash in constant time, else not_found; status not created|pending or expires_at past -> order_expired
export async function loadMyBookings(uid: string): Promise<MyBookings>;
export async function loadBookedBefore(uid: string): Promise<BookedBefore>;
// services/seva/devotee.service.ts
export function devoteeApi(token: () => Promise<string>): { createOrder(body: DevoteeOrderRequest): Promise<DevoteeOrderCreated>;
  orderStatus(ref: string): Promise<DevoteeOrderStatus>; myBookings(): Promise<MyBookings>; bookedBefore(): Promise<BookedBefore> };
export async function fetchOnlineCatalogue(): Promise<OnlineCatalogue>;                           // no token
export async function fetchCheckoutInfo(ref: string, key: string): Promise<CheckoutInfo>;         // no token
// tests/e2e/seva/fixtures/fake-devotee.ts
export interface FakeDevotee { orders: Map<string, DevoteeOrderStatus & { key: string; sessionId: string }>; pay(ref: string): void; fail(ref: string): void; expire(ref: string): void }
export function installDevoteeFake(fake: FakeSevaApi, seed?: { catalogue?: OnlineCatalogue; now?: string }): FakeDevotee; // extend() handlers for the six devotee routes; pay() issues WT-WEB receipts, one per date
```
Route rules: `POST devotee/orders` - `requireDevotee`, a per-uid in-memory limit of 20 calls a minute (`rateLimit('devotee.orders:'+uid, { limit: 20, windowMs: 60_000 })`, first line; SQL holds the real 10-an-hour rule), `paymentsAvailable()` else 503, body through `devoteeOrderSchema`, then `startPaymentOrder`; answers 201 `DevoteeOrderCreated`. The answer never carries a key, a provider order id or a session id. `GET devotee/sevas` - `Cache-Control: public, s-maxage=60`. Every other devotee route - `Cache-Control: no-store`.

- [ ] **Step 1: Write the failing tests**

```ts
// api-devotee.test.ts (mocks: identity adapter, callRpc, server/payments deps with a fake provider)
it('answers 401 without a sign-in on orders, status, receipts and booked-before')
it('serves the online catalogue without sign-in, online and both only, with bounds and mode') // PAN (counter) absent; bounds.todayOpen per cutoff
it('creates an order and answers the amount, expiry, test flag and checkout URL only')        // 201; body keys exactly orderRef, amountPaise, expiresAt, testMode, checkoutUrl
it('uses the server price when the client sends an amount')                                   // body amountPaise 100 -> draft has no amount; answer 151500
it('answers 429 too_many_open_orders from SQL')
it('answers 503 payments_unavailable without keys')
it('another account\'s order ref answers 404')
it('re-checks a pending order with the gateway at most once per 15 seconds')                  // two GETs within 15 s -> one fetchOrder
it('returns the receipts and slip settings once issued')
it('checkout info needs the right key')                                                         // wrong key -> 404
it('checkout info is refused once the order is paid, failed or expired')                      // 409 order_expired
it('lists only this account\'s receipts and waiting orders')
it('booked before returns only this account\'s details')                                      // C-10
// fake-devotee.test.ts (through fake.handle)
it('creates, pays and lists an order with one WT-WEB receipt per date')
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --ci --watchman=false --forceExit tests/unit/seva/api-devotee.test.ts tests/unit/seva/fake-devotee.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the server module, six routes (`export const dynamic = 'force-dynamic'`; params as `Promise<{ ref: string }>`), browser client and fake, and the two exports in `counter.ts`.

- [ ] **Step 4: Run them and see them pass** (same command), then `npx jest --ci --watchman=false --forceExit tests/unit/seva/api-counter.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** - paths: the listed files and tests; subject: `feat(seva): add devotee routes for online sevas, orders, status, checkout and My seva bookings`.

### Task B2-2: Payment webhook

Tier: **Opus xhigh** - the trust boundary with the gateway.

**Files:**
- Create: `lib/seva/payments/webhook.ts`, `app/api/seva/payments/webhook/[provider]/route.ts`
- Test: `tests/unit/seva/payments-webhook.test.ts` (node env, real Cashfree adapter on the mock), `tests/unit/seva/api-webhook.test.ts`

**Interfaces:**
- Consumes: `VerifiedWebhook`, `createCashfreeMock` (B1-2); `confirmPaymentOrder`, `syncRefund`, `defaultPaymentDeps` (B1-4); `seva_record_payment_event`, `seva_finish_payment_event` (B1-1); `rateLimit` (route only). The caller's IP is the first entry of `x-forwarded-for`, else `'unknown'` (a small private function in the route, as `app/r/[token]/page.tsx:30` does privately).
- Produces:
```ts
// lib/seva/payments/webhook.ts (no 'server-only')
export interface WebhookAnswer { status: 200 | 401 | 404; outcome: 'issued' | 'duplicate' | 'not_paid' | 'amount_mismatch' | 'unknown_order' | 'refund_updated' | 'ignored' | 'error' | 'bad_signature' | 'probe_paid' }
export async function handleWebhook(deps: PaymentDeps, providerParam: string, rawBody: string, headers: Headers,
  opts: { allowUnsignedRecord: boolean }): Promise<WebhookAnswer>;
```
Order of work: `providerParam !== deps.provider.name` -> 404, nothing recorded. `verifyWebhook` null -> when `allowUnsignedRecord`, record `signature_ok false` under `unsigned:<sha256 hex>` (payload `{}`); answer 401 `bad_signature`. Valid -> `seva_record_payment_event` (payload = the minimised payload); duplicate -> 200 `duplicate`. Then by event type: payment types with an `orderRef` -> `confirmPaymentOrder(ref)` (no throttle); refund types with both refs -> `syncRefund`; others -> `ignored`. `seva_finish_payment_event(id, outcome, error)`; any thrown error -> outcome `error` with the error's code only. Always 200 after recording. The route reads `await req.text()` before anything else, runs on Node (`export const runtime = 'nodejs'`), passes `allowUnsignedRecord = rateLimit('webhook-unsigned:' + ip, { limit: 30, windowMs: 60_000 })`, and answers `{ ok: true }` / `{ error: ... }` JSON with `no-store`. It does not call `requireSevaActor`.

- [ ] **Step 1: Write the failing tests**

```ts
// payments-webhook.test.ts (rpc against an in-memory fake of the four SQL calls, provider = real adapter on the mock)
it('a signed success webhook re-fetches the order and issues')            // outcome issued; fetchOrder called; issue rpc called once
it('never issues from the payload: a paid webhook for an unpaid order issues nothing') // mock order ACTIVE, webhook says SUCCESS -> not_paid
it('a replayed webhook answers 200 and issues nothing new')                // second delivery -> duplicate, no fetch
it('an errored event is processed again on redelivery')
it('a bad signature answers 401 and is recorded under an unsigned key')    // record rpc args: signature_ok false, key 'unsigned:<hex>'
it('records at most 30 unsigned events per IP per minute')                 // 31st -> 401, no rpc
it('an unknown order is recorded and answered 200')                        // outcome unknown_order
it('a mismatched amount is recorded and answered 200')                     // outcome amount_mismatch
it('a refund webhook syncs the refund')                                    // outcome refund_updated
it('an unknown provider answers 404 and records nothing')
// api-webhook.test.ts (route level)
it('reads the raw body before parsing and passes the headers through')
it('answers JSON with no-store and never a stack trace')
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --ci --watchman=false --forceExit tests/unit/seva/payments-webhook.test.ts tests/unit/seva/api-webhook.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** `webhook.ts` and the route.

- [ ] **Step 4: Run them and see them pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit** - paths: the two files and two tests; subject: `feat(seva): add the payment webhook - signature, record once, re-fetch before any receipt`.

### Task B2-3: Payments page routes - status, refunds, fee rule, test payment

Tier: **Opus high** - money controls over B1's tested functions; permissions per DB §3.3 rows 24-26.

**Files:**
- Create: `lib/seva/server/payments-admin.ts`, `app/api/seva/payments/status/route.ts` (GET), `app/api/seva/payments/refunds/route.ts` (POST), `app/api/seva/payments/fee-rule/route.ts` (GET, PUT), `app/api/seva/payments/test-payment/route.ts` (POST), `services/seva/payments.service.ts`, `tests/e2e/seva/fixtures/fake-payments.ts`
- Test: `tests/unit/seva/api-payments.test.ts`, `tests/unit/seva/payments-admin.test.ts`

**Interfaces:**
- Consumes: `requireSevaActor` (actions `payments.view`, `payments.refund`, `payments.fee_rule`); `requestRefund`, `startPaymentOrder`, `confirmPaymentOrder`, `defaultPaymentDeps` (B1-4); `readPaymentsEnv` (B1-2); `refundRequestSchema`, `feeRuleSchema` (B1-3); `seva_set_fee_rule`; read-only `createAdminClient().from(...)` over `payment_orders`, `payments`, `payment_events`, `refunds`, `payment_settings`, `seva_orders`, `seva_receipts`, `staff`.
- Produces:
```ts
// lib/seva/server/payments-admin.ts (import 'server-only')
export async function loadPaymentsOverview(now: Date): Promise<PaymentsOverview>;   // current mode's orders of the last 7 days, newest first, at most 100; refreshes up to 5 pending orders through confirmPaymentOrder(ref, { minIntervalSeconds: 15 })
export function markDoublePayments(rows: RecentPayment[], devotees: Map<string, string>): RecentPayment[]; // pure: same uid, seva, dates, both paid, within 30 min -> the later 'paid_twice'
export async function readFeeRule(): Promise<FeeRule>;
export async function saveFeeRule(actor: SevaActor, rule: FeeRule): Promise<FeeRule>;
// services/seva/payments.service.ts
export function paymentsApi(token: () => Promise<string>): { overview(): Promise<PaymentsOverview>; refund(body: RefundRequest): Promise<RefundItem>;
  feeRule(): Promise<FeeRule>; saveFeeRule(rule: FeeRule): Promise<FeeRule>; testPayment(): Promise<{ checkoutUrl: string }> };
// tests/e2e/seva/fixtures/fake-payments.ts
export function installPaymentsFake(fake: FakeSevaApi, seed?: Partial<PaymentsOverview>): { overview: PaymentsOverview };
```
Routes: `status` GET `payments.view` (TA, TV, SA); `refunds` POST `payments.refund` (TA, SA; view-only refused by the guard) -> `RefundItem`; `fee-rule` GET `payments.view`, PUT `payments.fee_rule` (SA only); `test-payment` POST `payments.refund`, test mode only (`test_mode_only` in live) -> a probe order for the caller's uid, answers `{ checkoutUrl }`. `PaymentsOverview` never carries a key, an app id or a secret - only `keysPresent`.

- [ ] **Step 1: Write the failing tests**

```ts
// api-payments.test.ts (guard and rpc mocked per route)
it('status is open to TA, TV and SA and closed to receptionist and prasadam') // 403 for R and P
it('status shows keysPresent and never a key value')                          // JSON.stringify(body) contains neither env value
it('refund needs payments.refund and a reason')                               // TV -> 403 view_only; reason 'ok' -> 400 validation
it('refund passes the receipts and reason through and answers the refund')    // seva_request_refund args
it('fee rule PUT by a temple admin answers 403; a super admin saves it')
it('fee rule naming UPI answers 400 fee_rule_refused')
it('test payment works only in test mode')                                   // live -> 409 test_mode_only
// payments-admin.test.ts
it('maps orders to paid, checking, failed and expired')
it('marks the later of a double payment as paid_twice')                       // two paid orders, same uid/seva/dates, 12 minutes apart
it('does not mark orders 31 minutes apart or for other dates')
it('lists refundable receipts: issued, or cancelled with refund due')
it('shows the last webhook time and whether its signature was verified')
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --ci --watchman=false --forceExit tests/unit/seva/api-payments.test.ts tests/unit/seva/payments-admin.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the module, four routes, client and fake.

- [ ] **Step 4: Run them and see them pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit** - paths: the listed files and tests; subject: `feat(seva): add Payments page routes - status, refunds, fee rule and test payment`.

### Task B2-4: Reconcile sweep on a GitHub Actions schedule

Tier: **Opus high** - an unattended job behind a shared secret (C-64) that can issue receipts.

**Files:**
- Create: `lib/seva/payments/reconcile.ts`, `app/api/seva/payments/reconcile/route.ts` (POST), `.github/workflows/seva-payments-reconcile.yml`
- Test: `tests/unit/seva/payments-reconcile.test.ts`, `tests/unit/seva/api-reconcile.test.ts`, `tests/unit/seva/workflow-reconcile.test.ts`

**Interfaces:**
- Consumes: `confirmPaymentOrder`, `syncRefund`, `defaultPaymentDeps` (B1-4); `seva_payments_due_for_check`, `seva_mark_payment_order` (B1-1); `ProviderError`.
- Produces:
```ts
// lib/seva/payments/reconcile.ts (no 'server-only')
export interface ReconcileReport { checked: number; issued: number; expired: number; refundsChecked: number; refundsRetried: number; errors: number }
export async function reconcileSweep(deps: PaymentDeps, opts?: { limit?: number /* 20 */ }): Promise<ReconcileReport>;
// app/api/seva/payments/reconcile/route.ts
export function cronSecretMatches(header: string | null, secret: string | undefined): boolean; // false when either is empty; timingSafeEqual over SHA-256 of both
```
Sweep rules: for each due order, `confirmPaymentOrder(ref)` (no throttle); if the outcome is `not_paid` and `expires_at` is past, `seva_mark_payment_order(ref, 'expired', null, '[]')`; an order the gateway never created (`unknown_order` from `not_found` while ours is `created`) -> `failed` with `gateway_create_failed`. Refunds: `requested` -> `createRefund` again with the same ref (via a small `retryRefund` in this file using `seva_update_refund`); `processing` -> `syncRefund`. One failing order never stops the others (`errors` counts them). The route: header `x-seva-cron` checked against `SEVA_CRON_SECRET` with `cronSecretMatches` -> else 401 `unauthenticated`; answers the report (counts only). Workflow: `on: schedule: - cron: '*/5 * * * *'` and `workflow_dispatch`; `permissions: {}`; `concurrency: { group: seva-payments-reconcile, cancel-in-progress: false }`; one job, `timeout-minutes: 3`, `runs-on: ubuntu-latest`, one step that exits 0 with a notice when `SEVA_CRON_SECRET` or `SEVA_SITE_URL` is empty, else `curl -fsS --max-time 60 -X POST -H "x-seva-cron: $SEVA_CRON_SECRET" "$SEVA_SITE_URL/api/seva/payments/reconcile"` with both passed through `env:` from `secrets.SEVA_CRON_SECRET` and `vars.SEVA_SITE_URL` (never interpolated into the script text).

- [ ] **Step 1: Write the failing tests**

```ts
// payments-reconcile.test.ts (fake rpc + real adapter on the mock)
it('re-checks orders pending over 5 minutes and issues the paid ones')
it('expires an order past expires_at only after the gateway says it is not paid')
it('the sweep issues for an expired order the gateway says is paid')         // Review Focus 3; outcome issued with late_reason
it('marks an order the gateway never created as failed')
it('retries a requested refund with the same refund ref and polls processing ones')
it('one failing order does not stop the sweep')                               // errors 1, others processed
// api-reconcile.test.ts
it('answers 401 for a missing, wrong or empty secret')                        // SEVA_CRON_SECRET unset -> 401 even with an empty header
it('answers the counts only')
// workflow-reconcile.test.ts (reads the YAML as text)
it('runs every 5 minutes and on demand with no permissions')
it('passes the secret through env, never inline in the script')              // no '${{ secrets.' inside a run: block
it('skips quietly when the secret or site URL is missing')
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --ci --watchman=false --forceExit tests/unit/seva/payments-reconcile.test.ts tests/unit/seva/api-reconcile.test.ts tests/unit/seva/workflow-reconcile.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the sweep, route and workflow.

- [ ] **Step 4: Run them and see them pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit** - paths: the three files and three tests; subject: `feat(seva): add the payments reconcile sweep and its 5-minute GitHub Actions schedule`.

### Task B2-5: Payment cards in Needs attention

Tier: **Opus medium** - one new SQL function and mapper changes; the existing attention function is not touched.

**Files:**
- Create: `supabase/migrations/20261101000200_seva_payment_attention.sql`
- Modify: `types/seva-reports.ts` (five `NeedsAttentionId` values), `lib/seva/server/reports.ts` (`NEEDS_ATTENTION_IDS` gains them; `loadDashboard` also calls `seva_payment_attention` with the period span and `readPaymentsEnv().mode`, and appends its cards after the existing ones), `lib/seva/dashboard/attention-text.ts` (A4-6: titles, Kannada titles, lines, link `SEVA_ROUTES.payments` = `/seva/payments`; B2-5 adds `payments: '/seva/payments'` to `lib/seva/routes.ts`, because A4S moved the module to `/seva` and B3-3 builds the page later)
- Test: `tests/db/seva-attention-payments.test.ts`, `tests/unit/seva/attention-text.test.ts` (extend), `tests/unit/seva/api-reports.test.ts` (extend)

**Interfaces:**
- Consumes: B1-1 tables; `fromSqlAttention`, `loadDashboard`; `readPaymentsEnv`.
- Produces:
```sql
seva_payment_attention(p_from timestamptz, p_to timestamptz, p_mode text) returns jsonb   -- array of 5 cards in this order, only orders with provider_mode = p_mode:
--  payments_paid_not_issued  critical  status 'paid', purpose 'seva', seva_order_id null, paid_at older than 2 minutes (any date); detail { mismatch: <count with needs_review> }
--  payments_pending_long     attention status created|pending, created_at older than 30 minutes
--  payments_refund_failed    critical  refunds status 'failed' (any date)
--  payments_double           attention pairs: same devotee_uid, same draft seva_id and sorted dates, both paid, paid_at within 30 minutes, later one in [p_from, p_to)
--  payments_paid_late        attention late_reason not null, paid_at in [p_from, p_to), with receipts still issued (no refund requested)
-- each { id, level ('ok' with count 0 when nothing), count, detail }
```
```ts
export type NeedsAttentionId = /* existing ids */ | 'payments_paid_not_issued' | 'payments_pending_long' | 'payments_refund_failed' | 'payments_double' | 'payments_paid_late';
```
Texts (English; Kannada flagged for proof-reading, O-03): "Paid but no receipt yet" / "{n} online payments are paid but have no receipt. Check them now."; "Payments still checking" / "{n} online payments have waited more than 30 minutes."; "Refund failed" / "{n} refunds failed. Refund them from the Cashfree dashboard and note it here."; "Possible double payment" / "{n} devotees may have paid twice for the same seva and dates."; "Paid late" / "{n} payments arrived after the booking expired or the seva date passed. Decide on a refund."

- [ ] **Step 1: Write the failing tests**

```ts
// seva-attention-payments.test.ts
test.each(['payments_paid_not_issued', 'payments_pending_long', 'payments_refund_failed', 'payments_double', 'payments_paid_late'])(
  'raises %s from its fixture', ...)                                   // level and count 1
it('a mismatch counts as paid but not issued')                        // detail.mismatch 1
it('two paid orders for the same seva and dates within 30 minutes raise possible double payment') // 31 minutes -> 0
it('paid late raises an attention card')                              // Review Focus 3
it('counts only the current mode')                                    // test-mode fixtures with p_mode 'live' -> all ok/0
it('shows calm zero cards when nothing is wrong')
it('the Online tile counts W receipts and never WT')                  // seva_dashboard tiles.online '505.00' with one W and one WT
// attention-text.test.ts
it('writes each payment card and links it to the Payments page')
// api-reports.test.ts
it('the dashboard answer carries the payment cards after the others')
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm run test:db -- --ci --watchman=false --forceExit tests/db/seva-attention-payments.test.ts` and `npx jest --ci --watchman=false --forceExit tests/unit/seva/attention-text.test.ts tests/unit/seva/api-reports.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the migration and the three modifications.

- [ ] **Step 4: Run them and see them pass** (same commands). Expected: PASS.

- [ ] **Step 5: Commit** - paths: the migration, three modified files, three tests; subject: `feat(seva): add payment cards to Needs attention`.

**Wave B2 gate + security gate (Opus xhigh)**

Besides the wave gate commands, a fresh Opus xhigh reviewer checks, with file:line evidence, and writes `$STATE/test-reports/B2-SECURITY-REVIEW.md`:
1. **Webhook signature:** raw body read before any parse; HMAC over `timestamp + rawBody` with the secret key, Base64, `timingSafeEqual` on equal-length buffers; no path issues receipts without a valid signature or a server re-fetch; the provider param is matched before anything is recorded.
2. **Idempotency:** `payment_events (provider, event_key)` unique; a processed duplicate does nothing; `seva_issue_online_order` locks the order row (`FOR UPDATE`) and returns the same receipts on repeat; `refund_ref` unique and reused on retry; `client_order_id`/`client_receipt_id` unique.
3. **Amount and currency against the server's order:** receipts only when the re-fetched gateway order is paid, `currency = 'INR'`, our `order_ref`, the amount equal to `amount_charged`, and a successful payment of that amount - checked in TypeScript and again in SQL.
4. **No client-trusted amounts:** prices only from `sevas` in `seva_create_payment_order`; a client amount is stripped by the schema; the gateway is told our amount; the fee is 0 on UPI.
5. **Ownership:** every devotee read filters by the verified uid; checkout info needs the key (hash compared in constant time); another account's ref answers 404.
6. **Secrets and privacy:** no key, app id or bypass secret in responses, errors, logs, audit rows or the client bundle (`git grep` for the env names under `app/`, `components/`, `services/`); event payloads minimised; VPA masked.
7. **Permissions:** rows 24-27 of DB §3.3 on every new route; view-only blocks refunds, fee rule and test payment; the reconcile route needs the secret and nothing else opens it.
8. **Postgres 15:** the three new migrations use no 16+ syntax (read the SQL; the PG15 runner passed).
Findings get a fix task (Opus high) before B3.

Owner checklist (5 minutes): read the security review's summary line and the B2 test report counts.

---

## Wave B3 - Screens and end-to-end (B3-1, B3-2, B3-3 in parallel; B3-4 after B3-1 and B3-2; needs B2)

Every new public page uses the site's public layout (`Navbar`, `Footer`) and this site's tokens; the booking pages sit inside a `.seva` wrapper so module tokens and `Bilingual` labels (Kannada under English) apply; text floor 13 px; loading, empty and error states (error text = the API's `message`). Strings go in one file per task so parallel tasks never collide: `lib/seva/strings/devotee.ts` (B3-1), `lib/seva/strings/devotee-bookings.ts` (B3-2), `lib/seva/strings/payments.ts` (B3-3). Browser tests use `createFakeSevaApi` with `installDevoteeFake` / `installPaymentsFake` and stub the Cashfree script with `stubCashfreeCheckout` (B3-1).

### Task B3-1: Website booking flow - online sevas, details and dates, review, checkout, return page

Tier: **Opus high** - the public money flow; replaces the old Firestore booking whose browser marked payments "completed" (`components/home/SevaBooking.tsx:182-193`).

**Files:**
- Modify: `app/(public)/sevas/page.tsx` (render `OnlineSevaList` instead of `SevaBooking`)
- Create: `app/(public)/sevas/book/[sevaId]/page.tsx`, `app/(public)/sevas/checkout/[ref]/page.tsx`, `app/(public)/sevas/checkout/[ref]/return/page.tsx`, `components/seva/devotee/{OnlineSevaList,BookingSteps,DevoteeDetailsForm,DatesPicker,ReviewPay,TestModeBanner,CheckoutLauncher,PaymentReturn}.tsx`, `lib/seva/devotee/checkout-client.ts`, `lib/seva/strings/devotee.ts`, `tests/e2e/seva/fixtures/cashfree-checkout.ts`
- Test: `tests/unit/seva/devotee-booking.test.tsx`, `tests/unit/seva/checkout-client.test.ts`, `tests/e2e/seva/devotee-booking.spec.ts`

**Interfaces:**
- Consumes: `fetchOnlineCatalogue`, `fetchCheckoutInfo`, `devoteeApi` (B2-1); `installDevoteeFake` (B2-1); `signInAsDevotee` (B1-5); `useAuth`; `checkOnlineDates`, `MAX_ONLINE_DATES` (B1-3); `SearchSelect`, `Bilingual`, `Segmented` (A1-6); nakshatra/rashi/gotra lists (A1-3); `formatRupees`, `formatSevaDate`; mockups `d-signin`, `d-sevas`, `d-details`, `d-review`, `d-checkout`, `d-pending`, `d-success`.
- Produces:
```ts
// lib/seva/devotee/checkout-client.ts ('use client' helper)
export async function openCashfreeCheckout(info: CheckoutInfo): Promise<void>;  // load({ mode: info.mode === 'live' ? 'production' : 'sandbox' }) then checkout({ paymentSessionId: info.sessionId, redirectTarget: '_self' }) per CF-8
// tests/e2e/seva/fixtures/cashfree-checkout.ts
export async function stubCashfreeCheckout(page: Page, opts: { onPay: (sessionId: string) => void }): Promise<void>; // page.route on the CF-8 script URL -> a fake loader whose checkout() opens a local stub page with "Pay"; Pay calls onPay and navigates to the order's return URL
// components/seva/devotee/PaymentReturn.tsx
export function PaymentReturn(props: { orderRef: string; returnToApp: boolean }): JSX.Element;  // polls orderStatus every 5 s for 10 minutes; app channel -> link and redirect to 'rayaramathaynk://pay-return?ref=<ref>'
```
Behaviour (DB §14.1, mockups): `/sevas` lists online sevas with rate "Rs 505 per date", "Book", and "Need a different amount? Please visit the counter."; a signed-out "Book" goes to `/login?redirect=/sevas/book/<id>` (Google or email + password). Step 1 Details: name (required), gotra, nakshatra and rashi as searchable dropdowns, phone last (optional); "Booked before" chips fill from `bookedBefore()`. Step 2 Dates: a real date picker limited to `bounds.min`..`bounds.max`, festival chips as shortcuts, several dates only for a multi-date seva; after 12:00 IST today is disabled with "Same-day bookings close at 12:00." Step 3 Review: devotee summary, "You pay Rs 1,515", "No extra charges - 3 e-receipts, one per date", payer mobile (pre-filled), button "Pay Rs 1,515 by UPI"; `TestModeBanner` "Test mode: no real money moves." whenever `mode === 'test'`. Pay -> `createOrder` -> navigate to `checkoutUrl`. The checkout page loads `CheckoutInfo` and calls `openCashfreeCheckout`; a refused order shows the API message and a link to My seva bookings, never a second gateway attempt. The return page shows pending ("Payment not confirmed yet. Do not pay again. We are checking with the bank.", a manual "Check status") until paid, then success: one e-receipt card per date with its own number and QR (uses B3-2's `EReceipt` when merged; until then a plain list - B3-4 checks the final look), "All stay in your account under My seva bookings."

- [ ] **Step 1: Write the failing tests**

```ts
// devotee-booking.test.tsx (RTL, devoteeApi mocked)
it('lists only online sevas with their rate per date and the counter note')
it('needs a name and keeps the phone optional')
it('disables today after 12:00 IST and dates past 90 days')
it('offers several dates only for a multi-date seva')
it('fills details from Booked before')
it('reviews the total with No extra charges and Pay Rs 1,515 by UPI')   // 3 dates x 505
it('shows the test-mode banner in test mode only')
it('never sends an amount in the order body')                           // createOrder body keys: sevaId, dates, devotee, payerPhone, channel
// checkout-client.test.ts
it('opens the sandbox checkout in test mode and production in live')    // mocked loader: load({mode:'sandbox'}), checkout({paymentSessionId, redirectTarget:'_self'})
// devotee-booking.spec.ts (desktop)
test('signed-out Book goes to sign-in and back to the booking')
test('books two dates and opens the gateway with the session')         // fake orders POST body dates 2; stubbed checkout received the session id
test('a paid order opened again shows the message, not the gateway')
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --ci --watchman=false --forceExit tests/unit/seva/devotee-booking.test.tsx tests/unit/seva/checkout-client.test.ts`. Expected: FAIL. (The e2e spec runs at the wave gate.)

- [ ] **Step 3: Implement** the pages, components, helper, strings and the e2e stub.

- [ ] **Step 4: Run them and see them pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit** - paths: the listed files and tests; subject: `feat(seva): add the website booking flow with UPI checkout and the payment return page`.

### Task B3-2: My seva bookings, e-receipts and share link; retire the old public receipts

Tier: **Opus medium** - reuses the slip model; one retirement with a redirect.

**Files:**
- Create: `app/(public)/profile/seva-bookings/page.tsx`, `components/seva/devotee/{MyBookings,EReceipt,ShareLink}.tsx`, `lib/seva/strings/devotee-bookings.ts`
- Modify: `app/(public)/receipts/page.tsx` (becomes a redirect to `/profile/seva-bookings`), `app/(public)/profile/page.tsx` (a "My seva bookings" link)
- Delete: `app/api/public/receipts/route.ts`, `tests/unit/seva/public-receipts-route.test.ts` (DB §17.4: replaced by My seva bookings)
- Test: `tests/unit/seva/e-receipt.test.tsx`, `tests/unit/seva/my-bookings.test.tsx`, `tests/unit/seva/public-receipts-page.test.tsx` (rewrite: redirect)

**Interfaces:**
- Consumes: `devoteeApi().myBookings()` (B2-1); `toSlipModel` (`lib/seva/print/slip-model.ts`) for the content; `receiptQrUrl`; `qrcode` `toDataURL`; `formatSevaDate`, `formatRupees`.
- Produces:
```ts
export function EReceipt(props: { receipt: IssuedReceipt; slip: SlipSettings; siteUrl: string }): JSX.Element;   // temple header, receipt number, seva date large, devotee, lines, total, '1 of 3 - paid together - group G-2610-0042', QR, 'Test receipt - no real money' for series WT, 'Cancelled - refunded' when so; never a phone
export function ShareLink(props: { url: string; title: string }): JSX.Element;   // navigator.share when present, else clipboard copy with 'Link copied'
```

- [ ] **Step 1: Write the failing tests**

```ts
// e-receipt.test.tsx
it('shows its own number, the seva date large and its QR for /r/<token>') // QR data from receiptQrUrl(siteUrl, token)
it('shows 1 of 3 - paid together - group')
it('marks WT receipts as test receipts')
it('never shows the phone')                                               // devotee with phone -> no '98450'
it('shows a refunded receipt as cancelled - refunded')
// my-bookings.test.tsx
it('lists the signed-in account\'s receipts newest first and waiting payments with Check status')
it('share uses the Web Share API and falls back to copying')
// public-receipts-page.test.tsx
it('the old receipts page redirects to My seva bookings')
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --ci --watchman=false --forceExit tests/unit/seva/e-receipt.test.tsx tests/unit/seva/my-bookings.test.tsx tests/unit/seva/public-receipts-page.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement**; check with `git grep -n "api/public/receipts"` that nothing else calls the deleted route.

- [ ] **Step 4: Run them and see them pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit** - paths: the created, modified and deleted files and tests (stage deletions with `git add -u <paths>`); subject: `feat(seva): add My seva bookings with e-receipts and share links; retire the old public receipts route`.

### Task B3-3: Admin Payments page

Tier: **Opus high** - refunds and the fee rule are money controls; the page must never show a key.

**Files:**
- Create: `app/seva/(desk)/payments/page.tsx` and its `loading.tsx` (address `/seva/payments`, wave A4S), `components/seva/payments/{ProviderStatus,RecentPayments,RefundDialog,FeeRuleCard,GoingLive}.tsx`, `lib/seva/strings/payments.ts`
- Modify (uses `SEVA_ROUTES.payments`, added in B2-5): `components/seva/shell/sections.ts` (section "Payments" after Reports, `href SEVA_ROUTES.payments`, columns TA, TV, SA; since A4S the module rail, not `navigation.ts`, lists the sections), `lib/seva/strings/shell.ts` (`SHELL_NAV.payments`)
- Test: `tests/unit/seva/payments-page.test.tsx`, `tests/unit/seva/shell.test.tsx` (extend), `tests/e2e/seva/payments.spec.ts`

**Interfaces:**
- Consumes: `paymentsApi` and `installPaymentsFake` (B2-3); `useSevaMe`, `SevaGate` (A3-6); `can()`; mockups `settings-devotee.html#payments`, `#refund-dialog`.
- Produces: the page. Content (DB §13.5, mockup): a mode banner first ("Test mode" / "Live"); "Online seva payments through Cashfree, UPI only."; Connection card "Cashfree, test mode - Hosted checkout. UPI details never touch our website." and "Keys found in Vercel - Never shown or typed here." (or "Keys missing in Vercel" in red); "Last payment alert: today 11:52 - Signature verified" (or "Signature failed"); "Send a test payment" (test mode only; opens the returned checkout URL); Fee rule card "Fee rule off - The temple pays the gateway fee. Devotees pay exactly the seva rate." with the switch enabled only for a super admin ("Only a super admin can change this."); Recent online payments (last 7 days: time, receipt numbers, devotee, account email, seva and dates, amount, status chip Paid / Checking with bank / Failed / Expired / Paid twice, "Paid late" and "Needs review" marks, Refund button for TA/SA); Refunds list (amount, receipt numbers, reason in quotes, by whom, status); RefundDialog "Refund Rs 505 to Venkatesh Rao?" with receipt checkboxes, "Reason for the refund (required)", confirm disabled under 3 characters, success toast "Refund of Rs 505 sent - Reaches Venkatesh Rao in 5-7 working days."; "Going live: 2 steps" (DB §14.6 text). View-only temple admins see everything with no Refund, Send or switch.

- [ ] **Step 1: Write the failing tests**

```ts
// payments-page.test.tsx
it('shows the mode banner first and Keys found in Vercel without any key')
it('shows the last alert time and Signature verified')
it('labels statuses paid, checking with bank, failed, expired and paid twice')
it('refund needs a reason of three characters and sends the chosen receipts')
it('only a super admin can switch the fee rule')
it('view-only sees no Refund, Send a test payment or switch')
it('Send a test payment shows only in test mode')
// shell.test.tsx
it('shows Payments to TA, TV and SA only')
// payments.spec.ts (desktop)
test('temple admin refunds one receipt with a reason')
test('view-only temple admin cannot refund')
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --ci --watchman=false --forceExit tests/unit/seva/payments-page.test.tsx tests/unit/seva/shell.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement** the page, components, strings and the sidebar item.

- [ ] **Step 4: Run them and see them pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit** - paths: the listed files and tests; subject: `feat(seva): add the admin Payments page with refunds, fee rule and going-live steps`.

### Task B3-4: Test-mode end-to-end, database flow test, retirement and documentation

Tier: **Opus high** - proves the whole chain (route logic, adapter, SQL) and the browser flow, then records how to run payments.

**Files:**
- Create: `tests/db/rpc-bridge.ts`, `tests/db/seva-payments-flow.test.ts`, `tests/e2e/seva/checkout-test-mode.spec.ts`
- Modify: `docs/API.md`, `docs/SECURITY.md`, `docs/DATA-MODEL.md`, `docs/seva/README.md` (payments runbook)
- Delete: `components/home/SevaBooking.tsx` (no importer is left after B3-1 and B3-2; confirm with `git grep -n "home/SevaBooking"`)
- Test: the two test files above

**Interfaces:**
- Consumes: `freshDb` (PGlite), fixtures (A1-1); `startPaymentOrder`, `confirmPaymentOrder`, `requestRefund`, `syncRefund` (B1-4); `handleWebhook` (B2-2); `reconcileSweep` (B2-4); `createCashfreeProvider`, `createCashfreeMock` (B1-2); `stubCashfreeCheckout` (B3-1); `installDevoteeFake` (B2-1); `signInAsDevotee` (B1-5).
- Produces:
```ts
// tests/db/rpc-bridge.ts
export function pgliteRpc(db: PGlite): RpcFn;   // 'select <fn>(p_a => $1, p_b => $2, ...) as r' with values in order (JSON values as objects); an error message 'SEVA:<code>' -> SevaError(code, parsed DETAIL); anything else rethrown
```
The flow test imports only modules without `server-only` (`core.ts`, `webhook.ts`, `reconcile.ts`, `cashfree.ts`) and builds `PaymentDeps` by hand: `{ provider: createCashfreeProvider({ appId: 'test_app', secretKey: 'test_secret', mode: 'test', baseUrl: 'https://sandbox.cashfree.com/pg', fetch: mock.fetch }), rpc: pgliteRpc(db), now, baseUrl: 'https://preview.example.test', notifyUrl: 'https://preview.example.test/api/seva/payments/webhook/cashfree' }`.

- [ ] **Step 1: Write the failing tests**

```ts
// seva-payments-flow.test.ts (PGlite + mock gateway + real orchestration)
it('book two dates, pay, webhook: two WT receipts in date order')           // 'WT-WEB-<MM>-<YYYY>/000001', '/000002'; payment_orders.status 'paid'; dashboard online '0.00'
it('the prasadam counter finds and marks a WT receipt by its number')        // seva_mark_prasadam -> 'given'
it('a replayed webhook changes nothing')                                     // receipt_series_years.last_no unchanged; outcome duplicate
it('a webhook claiming payment for an unpaid order issues nothing')
it('an order paid after expiry still gets receipts and an attention card')   // sweep -> issued, late_reason 'after_expiry'; seva_payment_attention payments_paid_late count 1
it('a one-paisa short payment issues nothing and raises paid but not issued') // detail.mismatch 1
it('a refund cancels the receipt, then the refund webhook marks it done')    // cancel_reason_code 'refunded'; refund_state 'done'
// checkout-test-mode.spec.ts (desktop; fake API + Cashfree stub)
test('book, pay in the stub, return page keeps checking and shows the receipts when paid') // first status pending ("Do not pay again"), fake.pay(ref), then two WT-WEB e-receipts
test('My seva bookings lists both receipts with share links to /r/<token>')
test('the test-mode banner shows on review, checkout and the receipts')
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm run test:db -- --ci --watchman=false --forceExit tests/db/seva-payments-flow.test.ts`. Expected: FAIL (`rpc-bridge.ts` missing).

- [ ] **Step 3: Implement** the bridge, delete `SevaBooking.tsx`, and write the docs: `docs/API.md` (every `devotee/*` and `payments/*` route: method, who, body, answer, error codes); `docs/SECURITY.md` (webhook trust boundary, idempotency keys, secrets, the reconcile secret, Vercel preview bypass); `docs/DATA-MODEL.md` (the five payment tables and their functions); `docs/seva/README.md` payments runbook: a failed refund, a possible double payment, paid but not issued (how to check in the Cashfree dashboard, then the Payments page), running the sweep by hand (`workflow_dispatch`), and switching test to live (SETUP-GUIDE B9, the site owner's).

- [ ] **Step 4: Run them and see them pass**: the DB command above; then `npm run test:e2e:seva -- --grep "checkout-test-mode|devotee-booking|payments"` (this task's and the wave's specs); `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** - paths: the created and modified files and the deletion; subject: `test(seva): add the test-mode payment flow end to end and the payments runbook; retire the old booking widget`.

**Wave B3 gate - full suites, then the owner gate**

Run every wave-gate command including `npm run test:e2e:seva` and `npm run build`; write `B3-TEST-REPORT.md`. Then the preview: the orchestrator asks Nikhil to allow pushing `feature/seva-entry` to his fork (`origin`) for a preview on his own Vercel project (or uses the existing preview branch there), after SETUP-GUIDE A3 and A4.1 are done. Nothing here touches the site owner's Vercel, Firebase or Cashfree.

**Owner's 10-minute checklist (a test payment on the preview site)**
1. Open the preview site, go to Special Sevas, press Book on a multi-date seva, and sign in with Google (or email + password). You come back to the booking.
2. Fill a name, pick two dates (try today after 12:00: it is closed), and on Review check "Test mode: no real money moves", "No extra charges" and "Pay Rs <2 x rate> by UPI".
3. Pay on Cashfree's test page with the success test UPI id from SETUP-GUIDE A4.1.7. You land on "Payment not confirmed yet. Do not pay again." and within a minute see two e-receipts numbered `WT-WEB-...`.
4. Open My seva bookings: both receipts are there; Share one and open the link on your phone - it shows the `/r/...` page without your phone number.
5. In the admin area open Payments: "Test mode" at the top, "Keys found in Vercel", the last payment alert with "Signature verified", and your payment as Paid.
6. Refund one of the two receipts with a reason. It shows as refunded within a few minutes; the other receipt stays valid.
7. Press "Send a test payment" and pay Rs 1 the same way; it shows as Paid with no receipt.
8. Open the dashboard: Total collected, Online and the register did not change (test mode never counts); Needs attention has no payment card in red.
9. Reply in chat: `B3 checklist done - receipts <yes/no>, refund <yes/no>, totals unchanged <yes/no>`.

---

## Self-review (writing-plans checklist, run 2026-10-19)

**1. Spec coverage.**

| Spec item | Tasks |
|---|---|
| DB §14.1 sign-in (Google or email + password) | B1-5, B3-1 |
| §14.1 online sevas only, fixed prices, counter note | B1-1, B2-1, B3-1 |
| §14.1 same fields, Booked before (C-10), date picker, chips, 90 days, 12:00 cut-off (C-29), multi-date | B1-3, B1-1, B2-1, B3-1 |
| §14.1 review "No extra charges", "Pay Rs ... by UPI"; UPI-only hosted checkout | B1-2 (UPI only on create), B3-1 |
| §14.1 pending page re-checks by itself; e-receipts per date with QR and share (C-44) | B2-1, B3-1, B3-2 |
| §14.2 adapter, env selection, Cashfree only (C-43) | B1-2 |
| §14.3 order sequence, rate limit, 30-minute expiry | B1-1, B1-4, B2-1 |
| §14.3 webhook: raw body, HMAC, record once, re-fetch, amount/currency/ref, 200 | B1-2, B1-4, B2-2 |
| §14.3 reconcile (15 s throttle, 5-minute sweep, expiry, late money C-45) | B1-1, B2-1, B2-3, B2-4 |
| §14.3 refunds (reason, cancel `refunded`, idempotent ref, failed is critical C-46, six months) | B1-1, B1-4, B2-3, B2-5, B3-3 |
| §14.4 env-only keys, WT series, test banner (C-18) | B0-2, B1-2, B1-1, B3-1, B3-3 |
| §14.5 e-receipts in the account; send stub retired | B3-2 (stub: Plan A A5-1) |
| §14.6 going live in two steps; §14.7 legal prerequisites | B0-1 (SETUP-GUIDE B9), B3-3 (GoingLive) |
| §13.5 Payments status page | B2-3, B3-3 |
| §12.1 Online tile never counts WT; §12.2 payments row | B1-1, B2-5 |
| §3.3 rows 24-27 | B2-1, B2-3, B3-3 |
| §7.7 tables, §7.8 functions | B1-1 |
| §15.1 webhook, idempotency, secrets, public surfaces; §15.2 payer VPA masked, email only on Payments page | B1-1, B1-2, B2-2, B2-3 + B2 security gate |
| §17.4 `/api/public/receipts` replaced by My seva bookings | B3-2 |
| §19 test layers: route tests, DB tests, webhook good/bad/replayed, gateway mock e2e | every task; B3-4 |
| C-07 shared W number; C-47 app opens website checkout (return=app) | B1-1; B1-4, B3-1 |
| C-64 GitHub Actions sweep | B2-4 |

**2. Step scan.** Every step names a file, a signature, a test with spec values, or a command with its expected result. Bodies are given only for the order of work in the webhook and orchestration (decisions, not code). Formats not verified are routed through PAYMENTS-FACTS rather than written as fact.

**3. Type consistency.** Checked across tasks: `PaymentProvider`, `ProviderOrder`, `VerifiedWebhook`, `ProviderError`, `PaymentDeps`, `RpcFn`, `PaymentOrderRow`, `ConfirmOutcome`, `StartedOrder` (= `DevoteeOrderCreated`), `RefundRow`, `SqlPaymentDraft`, `OnlineDateBounds`, `OnlineCatalogue`, `DevoteeOrderStatus`, `CheckoutInfo`, `MyBookings`, `BookedBefore`, `PaymentsOverview`, `RecentPayment`, `RefundItem`, `FeeRule`, `RefundRequest`; SQL names `seva_create_payment_order`, `seva_mark_payment_order`, `seva_claim_payment_check`, `seva_issue_online_order`, `seva_flag_payment_mismatch`, `seva_record_payment_event`, `seva_finish_payment_event`, `seva_request_refund`, `seva_update_refund`, `seva_payments_due_for_check`, `seva_set_fee_rule`, `seva_devotee_bookings`, `seva_devotee_booked_before`, `seva_payment_order_json`, `seva_payment_attention`; card ids `payments_*`.

**4. Review Focus.** Five classes listed with their pinned tests; IDOR, unsigned floods and client amounts pinned for the security gate.

**5. Proportion.** About 1,250 lines for 16 tasks against DB §14's ~110 lines plus §7.7-7.8 and §13.5; the length is in Interfaces and test names, not code bodies.

**Changed from the outline (2026-10-18), and why:**
- 13 -> **16 tasks**: B0-1 also checks the gateway facts (the user's rule: everything unverified is a B0 check); B1-4 (orchestration with injected dependencies) is split out so routes, webhook, sweep and a DB flow test share one tested core; B1-5 adds Google sign-in, which the site does not have today (the outline assumed it existed), plus the CSP that blocks both Google and Cashfree now; B2-3 splits the Payments-page routes from the webhook; B2-4 / B2-5 renumbered.
- `seva_needs_attention` is **not replaced**: a separate `seva_payment_attention` avoids copying a ~210-line function that A3 hardening keeps changing (`offline_cancels`, `upi_changed`).
- `seva_expire_payment_orders` is dropped: expiring without asking the gateway first could expire paid orders; the sweep asks, then marks.
- `seva_record_payment_event` returns `{ event_id, duplicate }` (not a bare id); `seva_request_refund` returns the refund json; `seva_issue_online_order` takes the confirmed gateway values to re-check in SQL. `PaymentProvider` gains `notifyUrl`, `currency`, `orderRef`, `providerOrderId`, `refundRef` and a minimised `payload` (needed for the amount/currency/ref check and per-order alert addresses on previews).
- No webhook timestamp window: replays are harmless (recorded once, payload never trusted, only a re-fetch), and the timestamp unit and retry behaviour are unverified (CF-7).
- A per-order checkout key lets the checkout page work without sign-in, which the Android app's in-app browser needs (Plan C C2-2 opens `/sevas/checkout/<ref>?return=app`).
- The payer mobile is asked at review (Cashfree's create-order likely requires a phone, CF-3), not stored; see UNCLEAR U-1 in the index.
- Refunds also cover online receipts already cancelled with `refund_state 'due'` (the register's cancel sets `due` for online receipts since A2).
- Preview webhooks: Vercel's preview protection would answer the gateway 401, so the alert address carries the automation bypass (V-2) and the base URL comes from `VERCEL_BRANCH_URL` (V-1).
- Concurrency (Review Focus 5) runs on a real Postgres 15 (`embedded-postgres`), which also checks every seva migration on Postgres 15 at each gate.

END OF REPORT
