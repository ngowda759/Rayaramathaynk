# Seva Entry Phase 1 Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Seva Entry Phase 1 - Supabase-backed counter receipts (online and offline), the 99 x 210 mm slip, prasadam hand-over, day close, dashboard, register, reports, exports, settings, staff and roles, nightly backup, and the Phase 1 security fixes - by extending the existing Receipt Book.

**Architecture:** Pages under `/admin/receipts/*` and `/admin/prasadam` call only route handlers under `app/api/seva/**`. Every route verifies the Firebase ID token through one identity adapter (C-66), checks the role allow-list, the Supabase `staff` status and, for counter calls, the registered-device token; validates with zod; and calls one Postgres SQL function (`.rpc()` on `createAdminClient()`) that does the whole write in one transaction. Pure TypeScript in `lib/seva/*` owns formatting, grouping, periods, file builders and the counter's offline outbox (IndexedDB, own `OF` series).

**Tech Stack:** Next.js ^16.2.9 (App Router), React 19.2.4, TypeScript strict, Tailwind, Supabase Postgres (`@supabase/supabase-js` ^2.116, service role only), Firebase Auth + Firestore `users` (`firebase-admin` ^14), zod ^4.4.3, qrcode ^1.5.4, Apache ECharts 6, exceljs 4, idb 8, fflate, jsqr, Jest 29 + ts-jest, PGlite (database tests), Playwright ^1.61 with the Firebase Auth/Firestore emulators.

**Spec:** `docs/seva/DESIGN-BOOK.md` (signed 2026-10-18; copied from `$STATE/book/DESIGN-BOOK.md` in Task A0-1). Cited below as "DB §n". `$STATE/DECISIONS.md` wins on any conflict. Existing-code facts with path:line: `$STATE/research/R3-repo-facts.md` ("R3"). Visual reference (approved look, proto.css v2): `$STATE/desk/mockups/counter.html`, `dashboard.html`, `settings-devotee.html`, `proto.css`; screen ids are named per task as `file#screen`. Domain lists: `$STATE/research/R4-prior-art-domain.md` ("R4"). Charts: `$STATE/research/R5-chart-library.md` ("R5").

**Paths used in this plan**
- `$MAIN` = `D:/Onboarding/Repos/POCs/General Purpose POCs Git Connected` (the main checkout; never switch its branch - other sessions use it).
- `$STATE` = `$MAIN/.claude/state/seva` (git-ignored; read by absolute path; never copied into git).
- `$WT` = `D:/Onboarding/Repos/POCs/seva-entry` (worktree on `feature/seva-entry`). **Every relative path below is relative to `$WT`.**
- Test reports and build notes go to `$STATE/test-reports/` and `$STATE/build/` (git-ignored, per D7).

## Global Constraints

Every task's requirements include these. Values are copied from the spec.

- **Stack facts:** Next ^16.2.9, React 19.2.4 (`package.json`); the type-check script is `npm run typecheck` (not `type-check`). Before writing Next.js code read `node_modules/next/dist/docs/` (AGENTS.md) - Task A0-2 condenses what this plan needs into `$STATE/build/NEXT16-NOTES.md`. Route-handler dynamic params are a Promise: `{ params }: { params: Promise<{ id: string }> }` then `const { id } = await params;` (`app/api/admin/aaradhane/[id]/route.ts:10-13`).
- **TypeScript:** strict, no `any` (use `unknown`), no `console.log` left in code, no inline styles (Tailwind classes or the module stylesheet), Server Components by default and `"use client"` only where needed.
- **Database access:** only server code, only `createAdminClient()` from `lib/supabase/admin.ts` (`import 'server-only'`). No browser ever talks to Supabase for seva data (DB §2 anti-goals).
- **Migrations:** `supabase/migrations/YYYYMMDDHHMMSS_snake_case.sql`, idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` then `CREATE POLICY`, `CREATE OR REPLACE FUNCTION`), **additive only** - no drop, no rename, no type change of an existing column (DB §7.0). SQL must run on Postgres 15 (live config says 15, R3 3.5): no `MERGE ... RETURNING`, no `ANY_VALUE`, no `JSON_TABLE`.
- **Every new table:** `ENABLE ROW LEVEL SECURITY`; policy `"Deny all public access to <table>" FOR ALL TO public USING (false) WITH CHECK (false)`; `REVOKE ALL ON <table> FROM anon, authenticated`. Mutable tables carry `created_at`/`updated_at timestamptz not null default now()` and the existing trigger function `update_updated_at_column()`.
- **Every new function:** plpgsql, `SECURITY INVOKER`, `SET search_path = public, pg_temp`, `REVOKE EXECUTE ... FROM public, anon, authenticated`, `GRANT EXECUTE ... TO service_role`. Business errors are raised as `RAISE EXCEPTION 'SEVA:<code>' USING DETAIL = '<json>'` with `<code>` from `lib/seva/errors.ts`.
- **Money:** `numeric(10,2)` per line, `numeric(12,2)` for totals in SQL; TypeScript and the wire format use **integer paise**; routes convert with `fromPaise()` / `toPaise()`.
- **Time:** `timestamptz` everywhere; business dates, months and years are computed in **Asia/Kolkata**, in SQL through `seva_ist_parts()` and in TypeScript through `lib/seva/time.ts` - never the server's local zone.
- **Receipt numbers** (DB §8.1): `C1-023-10-2026/000124`, `OF1-023-10-2026/000007`, `W-WEB-10-2026/000045` / `W-APP-...`, `WT-WEB-10-2026/000001`. `MM-YYYY` = IST month of issue (C-06). Running number per series per calendar year, restarts at 000001 on 1 January IST. Never reused, never skipped, never silently deleted.
- **Limits:** name trimmed 1-80 chars any script; gotra text <= 60; at most 8 lines per receipt, 31 receipts per order, quantity 1-99 (C-30); counter seva dates today to `counter_days_ahead` (365) days, never past (C-29); cancel window 30 min (D23); prasadam undo 120 s by the same person (C-27); cash order of Rs 2,00,000 or more needs a confirm (C-54).
- **Privacy:** the devotee phone is never printed, never in audit JSON, never in prasadam responses, excluded from exports unless a non-view-only temple admin or super admin ticks it (audited) (C-16, C-31). No amounts at the prasadam counter. Server logs carry ids and codes only, never names or phones.
- **Authorisation:** explicit allow-list; unknown, empty or misspelt roles are denied; staff status must be `active` in Supabase and `isActive` in Firestore; view-only blocks every write; the server enforces every cell of DB §3.3, the client only hides.
- **Errors:** routes return `{ "error": { "code": "<code>", "message": "<plain English>" } }` with the code's HTTP status; never a stack trace.
- **UI:** the approved proto.css v2 look scoped under the `.seva` wrapper (C-49): Inter + Noto Sans Kannada (already loaded by `app/layout.tsx:24-25`, no new font downloads, no external CSS), **Kannada always on its own line under the English**, 13 px text floor, radii 12 px control / 18 px surface, gold accent as a fill with dark ink (never gold text on white), light only. Reuse `components/ui/*` with token-based variants - no duplicate primitives; toasts stay `react-hot-toast`.
- **Slip print CSS (DB §10.2):** `@page { size: 99mm 210mm; margin: 5mm; }`, `.slip { width: 89mm; height: 199mm; break-after: page; overflow: hidden; }`; body 10 pt, seva date 18 pt bold, receipt number 12 pt bold, total 14 pt bold, Kannada never below 10 pt; pure black on white.
- **Boundary:** this repo is a standalone temple POC. Never bring in, mention or name any office-work theme, company name, logo, presentation skill, pending-items page or office-repository convention (the full list is in `$STATE/briefs/RULES.md`). Pages use this site's own look (`app/globals.css` tokens and the module tokens above).
- **Secrets:** never print, copy or commit secret values; never copy `.env*` files or `.firebase-adminsdk.json` into the worktree; env var names only.
- **Commits:** conventional messages (`feat(seva): ...`, `fix(seva): ...`, `test(seva): ...`, `docs(seva): ...`), ending with the executing session's attribution lines. Never push unless the owner asks.

## Review Focus

The five input classes the spec implies but no feature test would naturally exercise, most likely to bite first. Each has a pinned test in the owning task (named).

1. **The catalogue changes between loading the counter and pressing Save** (a rate edited or a seva switched off in Seva settings). Expected: no receipt is issued, no slip prints, the receptionist sees the plain message ("Paaduka Pooja was switched off in Seva settings a moment ago" / "The rate changed - check the total"), the counter reloads the catalogue and keeps the typed order. Pinned: A2-1 `rejects an order whose expected total no longer matches the catalogue`; A2-6 `business errors never fall back to offline`; A4-1 e2e `price change reloads the catalogue and prints nothing`.
2. **Times near midnight IST and a wrong PC clock** (receipt at 23:59:59 vs 00:00:01 IST; 31 December to 1 January; PC clock off by minutes while offline). Expected: business date, MM-YYYY and the yearly restart follow IST; offline numbers use the PC clock but the server flags offline receipts dated more than 2 minutes in the future and the counter warns when skew exceeds 2 minutes. Pinned: A1-2 `businessDate switches at 18:30 UTC`; A1-1 `seva_ist_parts converts at the IST day boundary`; A2-1 `sync accepts a 1 January OF number in the new year`; A2-6 `offline numbers take month and year from the PC clock in IST`; A2-3 `needs attention lists future-dated offline receipts and clock skew`.
3. **Double submission** (Ctrl+Enter pressed twice, a retry after a timeout that actually succeeded, the outbox resending after a partial sync, the counter open in two tabs). Expected: exactly one set of receipts and numbers. Pinned: A2-1 `repeated client_order_id returns the same receipts`; A2-5 `save is ignored while a submit is in flight`; A2-6 `two tabs never get the same offline number`; A4-1 e2e `Ctrl+Enter twice posts once`.
4. **Messy lookup input at the prasadam counter** (USB scanner typing the QR URL plus Enter, lower-case or spaced receipt numbers, `C1 124`, a bare `124` matching two series, a cancelled or superseded slip). Expected: the right screen every time, a pick list when ambiguous, never a crash. Pinned: A1-2 `parseLookupInput` table; A3-2 `short form matching two series returns a choose list`; A4-5 e2e `scanner-typed URL in the number box finds the receipt`.
5. **Real devotee text** (Kannada names, leading/trailing spaces, 81-character names, emoji, phones typed as `98450 12345`, `+91 98450-12345`, `09845012345`). Expected: name trimmed and kept in any script; phone normalised to `+919845012345` or refused with a plain message; phone never printed. Pinned: A1-3 `devoteeSchema` table; A2-11 `slip never contains the phone`; A4-1 e2e `Kannada name prints on the slip`.

---

## How to run this plan

- **Waves.** Tasks inside a wave are independent and may run in parallel. A wave starts when every task of the previous wave is merged into `feature/seva-entry` and its gate has passed. The index (`PLAN-INDEX.md`) lists dependencies, tiers and estimates.
- **Parallel workspaces.** Each parallel task runs in its own worktree cut from `feature/seva-entry` at wave start: `git -C $WT worktree add -b seva/<task-id> D:/Onboarding/Repos/POCs/seva-wt/<task-id> feature/seva-entry`, with `node_modules` linked to `$WT/node_modules` (`New-Item -ItemType Junction -Path <wt>/node_modules -Target $WT/node_modules`). All new packages are installed once in Task A0-2, so no later task edits `package.json` dependencies or `package-lock.json`. The orchestrator merges each approved branch (`git merge --no-ff seva/<task-id>`) and removes its worktree.
- **Per-task test policy (DB §19.2, D37).** After each task: only that task's own tests (`npx jest <its files>`, or `npm run test:db -- <its files>` for database tasks), `npm run typecheck`, and `npx eslint <changed files>`. No full suites, no build, no Playwright inside a task.
- **Wave gate (once per wave, in `$WT` after merging).** Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run verify:supabase-migrations:static`, `npm run build`, plus `npm run test:e2e:seva` from wave A2 on and `npm run test:rules` in waves A1 and A5. Write `$STATE/test-reports/<wave>-TEST-REPORT.md`: commands run, pass/fail counts, failures new since the A0 baseline, anything skipped and why, and the wave's 10-minute owner checklist (given at the end of each wave below). A new failure gets a fix task (Opus high) before the next wave starts.
- **Reviews.** Every task: spec-compliance review, then code-quality review (subagent-driven-development). Reviewers run at the implementer's tier or higher. Security gates (Opus xhigh) after waves A1, A3 and A5 - see the index.

## File structure

New and changed files, by responsibility. Each task's **Files** block is authoritative; this map shows where things live.

| Area | Files | Responsibility |
|---|---|---|
| Schema | `supabase/migrations/20261020000000_seva_core.sql`, `..._000100_seva_receipts.sql`, `..._000200_seva_seed.sql` | Tables, constraints, guard triggers, base helper functions, seed |
| SQL functions | `supabase/migrations/20261021000000_seva_functions_issue.sql`, `..._000100_seva_functions_ops.sql`, `..._000200_seva_functions_admin.sql` | Issue, sync, print, cancel, reissue / prasadam, devices, gaps, day close / catalogue, settings, staff, reports |
| Pure domain | `lib/seva/{money,numbering,time,grouping,amount-words,qr,schemas,errors,permissions}.ts`, `lib/seva/domain/*.ts`, `lib/seva/strings/*.ts` | No I/O; shared by client and server |
| Counter engine | `lib/seva/counter/{state,keyboard,payload}.ts` | Order reducer, key map, payload builder |
| Offline | `lib/seva/offline/*.ts`, `public/seva-sw.js`, `public/seva-counter.webmanifest` | IndexedDB, device credentials, OF allocator, outbox, submitter, sync, heartbeat |
| Files out | `lib/seva/export/*.ts`, `lib/seva/excel/*.ts` | CSV, Tally, zip, xlsx workbooks, counter Excel copy |
| Print | `components/seva/slip/*`, `lib/seva/print/*`, `styles/seva/print.css` | Slip model, slip component, print job |
| Charts | `components/charts/EChart.tsx`, `lib/seva/charts/*.ts` | ECharts wrapper, colour tokens, option builders |
| Server | `lib/seva/server/*.ts` | Identity adapter, actor guard, device check, RPC wrapper, per-area repositories |
| API | `app/api/seva/**/route.ts` | Thin route handlers (DB §6.5) |
| Browser clients | `services/seva/*.service.ts` | `fetch` with Bearer token and device header |
| UI | `styles/seva/tokens.css`, `components/seva/**`, `hooks/seva/*`, `app/admin/receipts/**`, `app/admin/prasadam/**`, `app/r/[token]/page.tsx` | Module pages and components |
| Tests | `tests/unit/seva/**`, `tests/db/**`, `tests/rules/**`, `tests/e2e/seva/**` | Four layers (DB §19.1) |
| Ops | `.github/workflows/seva-backup.yml`, `seva-maintenance.yml`, `scripts/seva/*` | Nightly encrypted backup, monthly purge, first super admin |
| Docs | `docs/seva/DESIGN-BOOK.md`, `docs/seva/SETUP-GUIDE.md`, `docs/seva/README.md`, existing `docs/*.md` | Spec, owner guides, module docs |

## Shared contracts

A task implementer sees only their own task. These names cross tasks; use them exactly. The owning task is in brackets.

```ts
// types/seva.ts  [A1-3]  - wire types: camelCase, money in integer paise, dates 'YYYY-MM-DD', times ISO-8601 strings
export type SevaRole = 'receptionist' | 'prasadam_counter' | 'temple_admin' | 'super_admin';
export type PaymentMode = 'cash' | 'upi' | 'online';
// Period ('today' | 'week' | 'month' | 'year') is exported by lib/seva/time.ts [A1-2]; import it from there.
export type CancelReasonCode = 'wrong_seva' | 'wrong_date' | 'wrong_amount' | 'wrong_devotee' | 'changed_mind'
  | 'entered_twice' | 'spoiled_print' | 'other' | 'not_printed_connection_lost' | 'refunded';
export interface CatalogueSeva { id: string; code: string | null; key: number; nameEn: string; nameKn: string | null;
  ratePaise: number | null /* null = any amount */; multiDate: boolean; allowAmountChange: boolean; prasadamGiven: boolean;
  prasadamItems: string | null; visibility: 'counter' | 'online' | 'both'; active: boolean; category: string; incomeLedger: string | null }
export interface DevoteeInput { name: string; gotra?: { text: string; id?: number }; nakshatra?: { id?: number; text?: string };
  rashi?: { id?: number; text?: string }; phone?: string /* normalised +91XXXXXXXXXX */ }
export interface CounterLineInput { sevaId: string; quantity: number; unitRatePaise?: number /* only when changed or any-amount */; changeReason?: string }
export interface CounterReceiptInput { clientReceiptId: string; sevaDate: string; qrToken: string; lines: CounterLineInput[] }
export interface CounterOrderPayload { clientOrderId: string; devotee: DevoteeInput; receipts: CounterReceiptInput[];
  payment: { mode: 'cash' | 'upi'; cashReceivedPaise?: number; upiRefLast6?: string; upiSeenConfirmed?: boolean };
  expectedTotalPaise: number; supersedesClientOrderId?: string }
export interface OfflineOrderPayload extends Omit<CounterOrderPayload, 'receipts'> { issuedAt: string; groupNo: string;
  receipts: (Omit<CounterReceiptInput, 'lines'> & { runningNo: number; receiptNo: string;
    lines: (CounterLineInput & { cachedRatePaise: number | null })[] })[] }
export interface IssuedLine { lineNo: number; sevaId: string; code: string | null; nameEn: string; nameKn: string | null;
  quantity: number; unitRatePaise: number; amountPaise: number; changed: boolean; prasadamItems: string | null }
export interface IssuedReceipt { id: string | null /* null until an offline receipt syncs */; clientReceiptId: string;
  receiptNo: string; seriesCode: string; sevaDate: string; groupNo: string; position: number; count: number;
  orderTotalPaise: number; totalPaise: number; lines: IssuedLine[]; payment: { mode: PaymentMode; upiRefLast6?: string };
  devotee: { name: string; gotra?: string; gotraKn?: string; nakshatra?: string; nakshatraKn?: string; rashi?: string; rashiKn?: string };
  qrToken: string; issuedAt: string; issuedBy: { name: string; staffNo: number | null }; counterName: string | null;
  channel: 'counter' | 'web' | 'app'; issuedOffline: boolean; status: 'issued' | 'cancelled'; printCount: number;
  prasadam: 'none' | 'pending' | 'given' }
export interface IssueResponse { orderId: string; groupNo: string; duplicate: boolean; receipts: IssuedReceipt[] }
export type OutboxItem =
  | { seq: number; kind: 'order'; payload: OfflineOrderPayload }
  | { seq: number; kind: 'cancel'; clientReceiptIds: string[]; reasonCode: CancelReasonCode; note?: string; at: string };
export interface SyncResponse { results: { seq: number; ok: boolean; duplicate?: boolean; code?: string }[] }
export interface SlipSettings { templeNameEn: string; templeNameKn: string; addressLine1: string; addressLine2: string;
  registrationLine: string | null; photoLeftUrl: string | null; photoRightUrl: string | null; footerLine1: string;
  footerLine2: string; footerBlessing: string; printGotra: boolean; printNakshatra: boolean; printRashi: boolean }
export interface CounterBootstrap { counter: { id: number; name: string; onlineSeries: string; offlineSeries: string };
  catalogue: CatalogueSeva[]; slip: SlipSettings; rules: { cancelWindowMinutes: number; amountChangeReasonRequired: boolean;
  counterDaysAhead: number; cashDifferenceNoteRequired: boolean }; denominations: { kind: 'note' | 'coin'; valuePaise: number }[];
  festivalChips: { name: string; nameKn: string | null; dates: string[] }[]; nextNumbers: { series: string; nextRunningNo: number }[];
  lastOfNo: number; today: { businessDate: string; receipts: number; cashPaise: number; upiPaise: number; dayClosed: boolean };
  upi: { vpa: string; payeeName: string } | null; upiDisabledReason: 'not_configured' | null; serverTime: string; siteUrl: string }
export interface SevaMe { staffId: string; staffNo: number; name: string; role: SevaRole; viewOnly: boolean;
  actions: SevaAction[]; counter: CounterBootstrap['counter'] | null /* set when a live device header came with the call */ }
// Area DTOs live in their own files so parallel tasks never edit types/seva.ts after A1-3:
// types/seva-dayclose.ts [A2-2] DayClosePrep; types/seva-reports.ts [A2-3] DashboardData, NeedsAttentionCard, ContinuityRow;
// types/seva-export.ts [A2-7] ExportReceiptRow, ExportLineRow, ExportData; types/seva-prasadam.ts [A3-2] PrasadamLookupResult;
// types/seva-receipts.ts [A3-2] ReceiptListItem, ReceiptDetail, PublicReceipt; types/seva-staff.ts [A3-5] StaffMember.
```

```ts
// lib/seva/permissions.ts [A2-4] - one action per row of DB §3.3, plus read actions
export type SevaAction =
  | 'counter.issue' | 'counter.change_amount' | 'receipt.cancel_own' | 'receipt.cancel_any' | 'receipt.reprint'
  | 'dayclose.close' | 'dayclose.reopen' | 'prasadam.give' | 'prasadam.give_off_date' | 'prasadam.reverse'
  | 'reports.view' | 'export.basic' | 'export.with_phones' | 'sevas.edit' | 'settings.edit' | 'device.register'
  | 'gap.resolve' | 'staff.onboard' | 'staff.grant_super_admin' | 'staff.change_role' | 'staff.reactivate'
  | 'staff.deactivate' | 'staff.delete' | 'payments.view' | 'payments.refund' | 'payments.fee_rule'
  | 'receipts.list' | 'sevas.read' | 'devotees.search' | 'counter.heartbeat' | 'me';
export interface SevaActor { staffId: string; uid: string; role: SevaRole; viewOnly: boolean; staffNo: number; name: string }
export interface PermissionContext { counterIdOfDevice?: number; receiptCounterId?: number; receiptBusinessDate?: string;
  todayBusinessDate?: string; receiptIssuedByStaffId?: string; withinCancelWindow?: boolean; targetRole?: SevaRole;
  targetStaffId?: string; newRole?: SevaRole }
export function can(actor: Pick<SevaActor, 'role' | 'viewOnly' | 'staffId'>, action: SevaAction, ctx?: PermissionContext): boolean;
export function mapFirestoreRole(raw: unknown): SevaRole | null; // 'temple_admin' and legacy 'admin' -> temple_admin; others outside the four -> null (C-62)
export function isWriteAction(action: SevaAction): boolean;
```

```ts
// SQL JSON contract [A2-1]: routes convert the wire payload to snake_case and rupees strings with fromPaise().
// p_order for seva_issue_counter_order:
// { client_order_id, supersedes_client_order_id?, expected_total: '820.00',
//   devotee: { name, gotra, gotra_id, nakshatra_id, nakshatra_text, rashi_id, rashi_text, phone_e164 },
//   payment: { mode: 'cash'|'upi', cash_received, upi_ref_last6, upi_seen_confirmed },
//   receipts: [{ client_receipt_id, seva_date, qr_token, lines: [{ seva_id, quantity, unit_rate /* null = catalogue */, change_reason }] }] }
// p_order for seva_sync_offline_order adds: issuer_staff_no, issued_at, group_no, receipts[].running_no,
//   receipts[].receipt_no, receipts[].lines[].cached_rate.
// Both return: { order_id, group_no, duplicate, receipts: [ <IssuedReceipt in snake_case, amounts as numeric strings> ] }
```

---

## Wave A0 - Setup (sequential)

### Task A0-1: Worktree, branch and committed spec

Tier: **Sonnet** - git commands and file copies; nothing to judge.

**Files:**
- Create: `docs/seva/DESIGN-BOOK.md` (copy of `$STATE/book/DESIGN-BOOK.md`)
- Create: `docs/superpowers/plans/2026-10-18-seva-entry-plan-A-phase1.md`, `2026-10-18-seva-entry-plan-A-phase1-part2.md`, `2026-10-18-seva-entry-plan-B-phase2-web.md`, `2026-10-18-seva-entry-plan-C-android.md`, `2026-10-18-seva-entry-PLAN-INDEX.md` (copies of `$STATE/plan/*`)

**Interfaces:**
- Consumes: nothing.
- Produces: branch `feature/seva-entry` checked out at `$WT`; the spec at `docs/seva/DESIGN-BOOK.md`.

- [ ] **Step 1: Create the worktree without touching the main checkout**

Run (PowerShell):
```powershell
git -C "$MAIN" fetch origin main
git -C "$MAIN" worktree add -b feature/seva-entry "D:/Onboarding/Repos/POCs/seva-entry" origin/main
git -C "D:/Onboarding/Repos/POCs/seva-entry" status --short --branch
git -C "$MAIN" branch --show-current
```
Expected: `## feature/seva-entry` with no changes; the main checkout's branch is unchanged (it was `feature/temple-portal-knowledge-base` on 2026-10-18). Record the base commit (`git -C $WT rev-parse HEAD`) for the baseline report.

- [ ] **Step 2: Copy the signed book and the four plan files**

`Copy-Item "$STATE/book/DESIGN-BOOK.md" "$WT/docs/seva/DESIGN-BOOK.md"` (create the folder first); copy `$STATE/plan/2026-10-18-seva-entry-plan-*.md` to `$WT/docs/superpowers/plans/` and `$STATE/plan/PLAN-INDEX.md` to `$WT/docs/superpowers/plans/2026-10-18-seva-entry-PLAN-INDEX.md`.

- [ ] **Step 3: Verify the copies**

Run: `Get-Content "$WT/docs/seva/DESIGN-BOOK.md" -TotalCount 1; Get-Content "$WT/docs/seva/DESIGN-BOOK.md" -Tail 1`
Expected: `# Seva Entry - Design Book` and `END OF REPORT`. Each plan file's last line is also `END OF REPORT`.

- [ ] **Step 4: Commit**

```bash
git -C $WT add docs/seva/DESIGN-BOOK.md docs/superpowers/plans/
git -C $WT commit -m "docs(seva): add the signed Design Book and the build plans"
```

### Task A0-2: Install, baseline, new dependencies and test harnesses

Tier: **Opus high** - a spike on PGlite fidelity plus judgement about which pre-existing failures are noise; bounded scope.

**Files:**
- Modify: `package.json` (dependencies, scripts), `package-lock.json`, `jest.config.ts` (add `lib/seva/**/*.ts` to `collectCoverageFrom`), `.github/workflows/ci.yml` (step `Database tests: npm run test:db` after `Test`)
- Create: `jest.db.config.ts`, `tests/db/harness.ts`, `tests/db/harness.test.ts`
- Create (git-ignored): `$STATE/test-reports/A0-BASELINE.md`, `$STATE/build/NEXT16-NOTES.md`

**Interfaces:**
- Consumes: Task A0-1 worktree.
- Produces:
```ts
// tests/db/harness.ts
export type DbRole = 'anon' | 'authenticated' | 'service_role';
export function sevaMigrationFiles(): string[];                       // supabase/migrations/*_seva_*.sql sorted by name
export async function freshDb(): Promise<PGlite>;                     // roles, Supabase default privileges, base files, all seva files
export async function applyMigrationFile(db: PGlite, file: string): Promise<void>;
export async function asRole<T>(db: PGlite, role: DbRole, fn: (db: PGlite) => Promise<T>): Promise<T>; // SET ROLE, RESET ROLE in finally
```
- Scripts added now (configs come later where noted): `"test:db": "jest -c jest.db.config.ts --runInBand"`, `"test:rules": "firebase emulators:exec --only firestore --project demo-seva \"jest -c jest.rules.config.ts --runInBand\""` (config in A1-4), `"test:e2e:seva": "firebase emulators:exec --only auth,firestore --project demo-seva \"playwright test -c tests/e2e/seva/playwright.config.ts\""` (config in A2-12).

- [ ] **Step 1: Install and fetch the browser**

Run in `$WT`: `npm ci` then `npx playwright install chromium`. Expected: both exit 0 (`postinstall` runs `prisma generate`). Do not copy any `.env*` file into `$WT`.

- [ ] **Step 2: Condense the Next.js 16 docs this plan needs**

Read the guides under `node_modules/next/dist/docs/` on route handlers, dynamic segments, `next/dynamic`, metadata (manifest), caching of route handlers and the PWA/service-worker guide. Write `$STATE/build/NEXT16-NOTES.md` (at most 60 lines; each fact with its doc file path). Expected: it confirms the `params: Promise<...>` form used in the repo.

- [ ] **Step 3: Record the baseline (do not fix anything)**

Run each and capture the exit code and failing names: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Write `$STATE/test-reports/A0-BASELINE.md`: base commit, `node -v`, `npm -v`, per command the exit code, test counts and the list of pre-existing failures (names only). If `build` fails only for missing env values, record that and the variable names it asked for.

- [ ] **Step 4: Add every package the plan needs, in one go**

```powershell
npm install echarts@^6.1.0 exceljs@^4.4.0 idb@^8 fflate@^0.8 jsqr@^1.4.0
npm install -D @electric-sql/pglite fake-indexeddb@^6 @firebase/rules-unit-testing
```
Use the current release of `@electric-sql/pglite` and `@firebase/rules-unit-testing` with a caret. Add the three scripts above. Record the installed versions in the baseline report.

- [ ] **Step 5: Write the failing harness test** (`tests/db/harness.test.ts`)

```ts
it('creates the three Supabase roles', async () => {
  const db = await freshDb();
  const r = await db.query<{ rolname: string }>(`select rolname from pg_roles where rolname in ('anon','authenticated','service_role') order by 1`);
  expect(r.rows.map((x) => x.rolname)).toEqual(['anon', 'authenticated', 'service_role']);
});
it('service_role bypasses RLS and anon does not', async () => {
  // create table t (id int) with RLS + deny-all policy, insert one row as the owner
  expect(await asRole(db, 'service_role', count('t'))).toBe(1);
  expect(await asRole(db, 'anon', count('t'))).toBe(0);
});
it('has the base objects the seva files depend on', async () => {
  // to_regclass('public.sevas') is not null; to_regprocedure('update_updated_at_column()') is not null
});
it('lists seva migrations in name order', () => {
  expect(sevaMigrationFiles()).toEqual([...sevaMigrationFiles()].sort());
});
```
(`count(table)` is a small local helper returning `select count(*)::int` for the given table.)

- [ ] **Step 6: Run it and see it fail**

Run: `npm run test:db -- tests/db/harness.test.ts`. Expected: FAIL - `Cannot find module './harness'` (or the db config is missing).

- [ ] **Step 7: Implement `jest.db.config.ts` and `tests/db/harness.ts`**

`jest.db.config.ts`: preset `ts-jest`, `testEnvironment: 'node'`, `testMatch: ['**/tests/db/**/*.test.ts']`, the `@/` mapper, `testTimeout: 30000`. Harness: PGlite with the `uuid_ossp` and `pgcrypto` contrib extensions; create `anon`, `authenticated` (NOLOGIN) and `service_role` (NOLOGIN BYPASSRLS); `GRANT USAGE ON SCHEMA public` and `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES, SEQUENCES, FUNCTIONS TO anon, authenticated, service_role` (Supabase's defaults, so the seva REVOKEs are what the tests prove); apply `20260907112632_create_core_tables.sql` and `20260908120000_create_sevas_table.sql`, then every seva file. Spike: try every existing migration in order once and list the ones PGlite rejects in the baseline report (only the two base files are required). If `@electric-sql/pglite` will not load under ts-jest, first add `transformIgnorePatterns: ['/node_modules/(?!@electric-sql/pglite)']`; if it still fails, switch `test:db` to `node --experimental-vm-modules node_modules/jest/bin/jest.js -c jest.db.config.ts --runInBand` with `extensionsToTreatAsEsm: ['.ts']`, and record the choice in NEXT16-NOTES.

- [ ] **Step 8: Run it and see it pass**

Run: `npm run test:db -- tests/db/harness.test.ts`. Expected: 4 passed.

- [ ] **Step 9: CI and coverage**

Add the `Database tests` step to `.github/workflows/ci.yml` after `Test`; add `"lib/seva/**/*.ts"` to `collectCoverageFrom`. Run `npm run typecheck`. Expected: no errors beyond the baseline.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json jest.config.ts jest.db.config.ts tests/db .github/workflows/ci.yml
git commit -m "test(seva): add PGlite database harness, test scripts and module dependencies"
```

**Wave A0 gate:** the baseline report exists; no owner checklist (nothing visible yet).

---

## Wave A1 - Foundations (6 tasks in parallel; needs A0)

### Task A1-1: Seva schema, guard triggers, base SQL helpers and seed

Tier: **Opus xhigh** - fully specified (DB §7) but the tables land on the live project and cannot be dropped later (additive only), and RLS is the security boundary.

**Files:**
- Create: `supabase/migrations/20261020000000_seva_core.sql` - `staff`, `counters`, `counter_devices`, `receipt_series`, `receipt_series_years`, `receipt_number_gaps`, `group_counters`, `seva_settings`, `cash_denominations`, `festival_days`, `festival_day_dates`, `seva_rate_history`, `audit_log`, `ops_backup_runs`; the new `sevas` columns; functions `seva_ist_parts`, `seva_receipt_no`, `seva_audit`, `seva_next_staff_no`; triggers.
- Create: `supabase/migrations/20261020000100_seva_receipts.sql` - `seva_orders`, `seva_receipts`, `seva_receipt_lines`, `day_closes`, `day_close_counts`, `devotee_profiles`; guard triggers.
- Create: `supabase/migrations/20261020000200_seva_seed.sql` - series C1/OF1/W/WT, Counter 1 ('Counter 1', 'Office PC'), denominations, one `seva_settings` row with sample text (`'SAMPLE - '` prefix on every temple text so the go-live check can find leftovers).
- Create: `tests/db/fixtures.ts`, `tests/db/seva-schema.test.ts`

**Interfaces:**
- Consumes: `freshDb`, `asRole` (A0-2).
- Produces: every table and column exactly as DB §7.1-7.6, with these decisions: `receipt_number_gaps.status` check is (`open`, `entered_from_paper`, `declared_lost`, `received_late`) - `received_late` marks a gap closed by a late sync; `seva_orders.payment_order_id` is a plain `uuid` column with check `payment_mode <> 'online' or payment_order_id is not null` (the foreign key to `payment_orders` is added by Plan B); `seva_receipts.cancel_reason_code` check uses the ten `CancelReasonCode` values.
```sql
seva_ist_parts(p_at timestamptz) returns table(year smallint, month smallint, business_date date)  -- immutable
seva_receipt_no(p_series text, p_staff_no smallint, p_channel text, p_month smallint, p_year smallint, p_running int) returns text -- immutable
seva_audit(p_action text, p_entity text, p_entity_id text, p_receipt_no text, p_reason text, p_before jsonb, p_after jsonb, p_staff_id uuid) returns bigint
seva_next_staff_no() returns smallint
```
```ts
// tests/db/fixtures.ts
export async function seedStaff(db: PGlite, p: { staffNo: number; name: string; uid: string; status?: 'invited' | 'active' }): Promise<string>;
export async function seedSeva(db: PGlite, p: { code: string; nameEn: string; amount: string | null; key?: number;
  multiDate?: boolean; anyAmount?: boolean; visibility?: 'counter' | 'online' | 'both'; allowAmountChange?: boolean;
  prasadamGiven?: boolean }): Promise<string>;
export async function seedDevice(db: PGlite, p: { counterId?: number; staffId: string; secretHash?: string }): Promise<string>;
```

- [ ] **Step 1: Write the failing schema tests** (`tests/db/seva-schema.test.ts`)

```ts
it('applies every seva migration twice without error')            // apply sevaMigrationFiles() again on the same db
it('enables RLS with the deny-all policy on all 20 seva tables')     // pg_class.relrowsecurity and pg_policies.policyname = 'Deny all public access to <t>'
it('refuses anon and authenticated on every seva table')             // asRole('anon', select 1 from <t>) rejects /permission denied/
it('lets only service_role execute seva functions')                  // has_function_privilege('anon', 'seva_audit(text,text,text,text,text,jsonb,jsonb,uuid)', 'execute') = false
it('keeps audit_log append-only even for service_role')              // insert ok; update, delete, truncate each reject
it('never deletes staff and keeps staff_no unique in 1..999')        // delete rejects; duplicate staff_no rejects; 1000 rejects
it('guards issued receipts')                                         // update total/receipt_no/seva_date/qr_token rejects; status cancelled->issued rejects; delete rejects
it('keeps orders and lines immutable')                               // update or delete on seva_orders / seva_receipt_lines rejects
it('checks line maths and changed-amount reasons')                   // amount <> quantity*unit_rate rejects; catalogue 105 + unit 150 + no reason rejects; with reason 'Devotee offered more' ok and amount_changed = true
it('writes rate history with the session reason or a default')       // set_config('seva.change_reason','Office revision',true) then update amount -> row with that reason; without it -> 'changed outside the app'
it('gives existing and new sevas visibility both')                   // insert into sevas without visibility -> 'both'
it('seeds series, Counter 1, 11 denominations and one settings row, idempotently')
it('formats the four receipt series')                                // seva_receipt_no('C1',23,null,10,2026,124) = 'C1-023-10-2026/000124'; ('OF1',23,null,10,2026,7) = 'OF1-023-10-2026/000007'; ('W',null,'WEB',10,2026,45) = 'W-WEB-10-2026/000045'; ('WT',null,'APP',1,2027,1) = 'WT-APP-01-2027/000001'
it('seva_ist_parts converts at the IST day boundary')                // '2026-12-31 18:29:59+00' -> (2026,12,'2026-12-31'); '2026-12-31 18:30:00+00' -> (2027,1,'2027-01-01')
it('accepts only Indian mobiles in phone_e164')                      // '+919845012345' ok; '+915123456789' and '9845012345' reject
it('checks series codes')                                            // 'C100' rejects; 'OF12' ok; one live device per counter (second unretired device rejects)
it('seva_next_staff_no returns max + 1, starting at 1')
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm run test:db -- tests/db/seva-schema.test.ts`. Expected: FAIL (relations do not exist).

- [ ] **Step 3: Write the three migration files**

Follow DB §7.0-7.6 column by column. Guard triggers: `seva_receipts_guard` (BEFORE UPDATE: the columns listed in DB §7.4 never change; `status` only `issued -> cancelled` and then the four cancel fields must be set together; BEFORE DELETE raises), `seva_orders` and `seva_receipt_lines` raise on UPDATE and DELETE, `staff` raises on DELETE, `audit_log` raises on UPDATE/DELETE/TRUNCATE plus `REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM service_role`, `seva_rate_history` append-only, `sevas_rate_history` AFTER UPDATE OF amount (reason from `current_setting('seva.change_reason', true)`, default `'changed outside the app'`). `ALTER TABLE sevas ALTER COLUMN duration SET DEFAULT 0`. Indexes as listed in DB §7. Seed with `ON CONFLICT DO NOTHING`.

- [ ] **Step 4: Run them and see them pass**

Run: `npm run test:db -- tests/db/seva-schema.test.ts`. Expected: all pass.

- [ ] **Step 5: Static migration check**

Run: `npm run verify:supabase-migrations:static`. Expected: the 20 new tables are listed and "Tables WITHOUT RLS" does not name any of them.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/2026102000*_seva_*.sql tests/db/fixtures.ts tests/db/seva-schema.test.ts
git commit -m "feat(seva): add seva schema, guard triggers and seed"
```

### Task A1-2: Domain core - money, numbering, IST time, grouping, amount in words, QR tokens

Tier: **Opus medium** - every rule is pinned by the spec and the test values below.

**Files:**
- Create: `lib/seva/money.ts`, `lib/seva/numbering.ts`, `lib/seva/time.ts`, `lib/seva/grouping.ts`, `lib/seva/amount-words.ts`, `lib/seva/qr.ts`
- Test: `tests/unit/seva/money.test.ts`, `numbering.test.ts`, `time.test.ts`, `grouping.test.ts`, `amount-words.test.ts`, `qr.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
// money.ts
export function toPaise(rupees: string | number): number;          // throws RangeError('invalid_amount') on NaN, negative, > 2 decimals
export function fromPaise(paise: number): string;                   // 10550 -> '105.50' (for SQL numeric)
export function formatRupees(paise: number, opts?: { decimals?: boolean }): string; // en-IN grouping, 'Rs ' prefix
// numbering.ts
export interface ReceiptNoParts { series: string; staffNo: number | null; channel: 'WEB' | 'APP' | null; month: number; year: number; running: number }
export function formatReceiptNo(p: ReceiptNoParts): string;
export function parseReceiptNo(s: string): ReceiptNoParts | null;  // DB §8.1 regexes, after trim + upper-case
export type LookupQuery = { kind: 'token'; token: string } | { kind: 'number'; receiptNo: string }
  | { kind: 'short'; series: string | null; running: number; year: number } | { kind: 'invalid' };
export function parseLookupInput(raw: string, opts: { year: number }): LookupQuery;
export function formatGroupNo(p: { yymm: string; n: number }): string;                   // 'G-2610-0042'
export function formatOfflineGroupNo(p: { yymm: string; series: string; n: number }): string; // 'G-2610-OF1-007' (C-19)
// time.ts
export const IST = 'Asia/Kolkata';
export type Period = 'today' | 'week' | 'month' | 'year';
export function istParts(d: Date): { year: number; month: number; day: number; hour: number; minute: number; weekday: number /* 1 = Monday */ };
export function businessDate(d: Date): string;                      // 'YYYY-MM-DD' in IST
export function istStartOfDay(date: string): Date;                  // '2026-10-18' -> 2026-10-17T18:30:00.000Z
export interface PeriodRange { from: Date; to: Date; prevFrom: Date; prevTo: Date; bucket: 'hour' | 'day' | 'month' }
export function periodRange(period: Period, now: Date): PeriodRange;  // DB §12.1 table, like-for-like (C-04, C-13)
export function hourBuckets(): string[];                            // '05'..'22'
export function sevaDateBounds(today: string, daysAhead: number): { min: string; max: string };
export function addDays(date: string, n: number): string;
export function formatSevaDate(date: string): string;               // 'Sat 28 Aug 2027'
export function cancelDeadline(issuedAtIso: string, windowMinutes: number): Date;
// grouping.ts
export interface CounterLine { key: string; sevaId: string; quantity: number; unitRatePaise: number;
  catalogueRatePaise: number | null; changeReason?: string; dates: string[] }
export interface ReceiptGroup { sevaDate: string; lines: (Omit<CounterLine, 'dates'> & { amountPaise: number })[]; totalPaise: number }
export type GroupResult = { ok: true; receipts: ReceiptGroup[]; totalPaise: number }
  | { ok: false; code: 'no_lines' | 'too_many_lines_on_date' | 'too_many_receipts'; date?: string };
export function groupLinesByDate(lines: CounterLine[]): GroupResult; // dates ascending; lines keep entry order
// amount-words.ts
export function amountInWords(paise: number): string;               // Indian system, English
// qr.ts
export function newQrToken(): string;                               // 16 bytes from crypto.getRandomValues, base64url, 22 chars
export function isQrToken(s: string): boolean;                      // /^[A-Za-z0-9_-]{22}$/
export function receiptQrUrl(siteUrl: string, token: string): string;
```

- [ ] **Step 1: Write the failing tests**

```ts
// money
expect(toPaise('105')).toBe(10500); expect(toPaise('105.5')).toBe(10550); expect(toPaise(105.55)).toBe(10555);
expect(() => toPaise('1.005')).toThrow(); expect(() => toPaise(-1)).toThrow();
expect(fromPaise(10550)).toBe('105.50');
expect(formatRupees(61000)).toBe('Rs 610.00'); expect(formatRupees(82000, { decimals: false })).toBe('Rs 820');
expect(formatRupees(20000000, { decimals: false })).toBe('Rs 2,00,000');
// numbering
expect(formatReceiptNo({ series: 'C1', staffNo: 23, channel: null, month: 10, year: 2026, running: 124 })).toBe('C1-023-10-2026/000124');
expect(formatReceiptNo({ series: 'W', staffNo: null, channel: 'APP', month: 10, year: 2026, running: 46 })).toBe('W-APP-10-2026/000046');
expect(parseReceiptNo(' c1-023-10-2026/000124 ')?.running).toBe(124); expect(parseReceiptNo('C1-23-10-2026/000124')).toBeNull();
test.each([
  ['https://site.example/r/AbCdEfGhIjKlMnOpQrStUv\n', { kind: 'token', token: 'AbCdEfGhIjKlMnOpQrStUv' }],
  ['AbCdEfGhIjKlMnOpQrStUv', { kind: 'token', token: 'AbCdEfGhIjKlMnOpQrStUv' }],
  [' of1-023-10-2026/000007', { kind: 'number', receiptNo: 'OF1-023-10-2026/000007' }],
  ['C1 124', { kind: 'short', series: 'C1', running: 124, year: 2026 }],
  ['c1/124', { kind: 'short', series: 'C1', running: 124, year: 2026 }],
  ['124', { kind: 'short', series: null, running: 124, year: 2026 }],
  ['hello', { kind: 'invalid' }], ['', { kind: 'invalid' }],
])('parseLookupInput(%j)', (raw, want) => expect(parseLookupInput(raw, { year: 2026 })).toEqual(want));
expect(formatGroupNo({ yymm: '2610', n: 42 })).toBe('G-2610-0042');
expect(formatOfflineGroupNo({ yymm: '2610', series: 'OF1', n: 7 })).toBe('G-2610-OF1-007');
// time - now = 2026-10-18T12:30+05:30 (a Sunday)
const now = new Date('2026-10-18T07:00:00Z');
it('businessDate switches at 18:30 UTC', () => {
  expect(businessDate(new Date('2026-10-18T18:29:59Z'))).toBe('2026-10-18');
  expect(businessDate(new Date('2026-10-18T18:30:00Z'))).toBe('2026-10-19');
});
expect(periodRange('today', now)).toEqual({ from: new Date('2026-10-17T18:30:00Z'), to: now,
  prevFrom: new Date('2026-10-16T18:30:00Z'), prevTo: new Date('2026-10-17T07:00:00Z'), bucket: 'hour' });
expect(periodRange('week', now).from).toEqual(new Date('2026-10-11T18:30:00Z'));      // Monday 12 Oct 00:00 IST
expect(periodRange('week', now).prevTo).toEqual(new Date('2026-10-11T07:00:00Z'));    // last Sunday 12:30 IST
expect(periodRange('month', now).prevFrom).toEqual(new Date('2026-08-31T18:30:00Z')); // 1 Sep 00:00 IST
expect(periodRange('year', now).prevTo).toEqual(new Date('2025-10-18T07:00:00Z'));
expect(periodRange('month', new Date('2026-03-31T04:30:00Z')).prevTo).toEqual(new Date('2026-02-28T18:30:00Z')); // capped at month end
expect(hourBuckets()).toHaveLength(18);
expect(sevaDateBounds('2026-10-18', 365)).toEqual({ min: '2026-10-18', max: '2027-10-18' });
expect(formatSevaDate('2027-08-28')).toBe('Sat 28 Aug 2027');
// grouping - the book's example: Panchamrutha 105 on 28, 29, 30 Aug and Paaduka Pooja 505 on 28 Aug
const r = groupLinesByDate([pan(['2027-08-30', '2027-08-28', '2027-08-29']), paa(['2027-08-28'])]);
expect(r.ok && r.receipts.map((g) => [g.sevaDate, g.totalPaise])).toEqual([['2027-08-28', 61000], ['2027-08-29', 10500], ['2027-08-30', 10500]]);
expect(r.ok && r.totalPaise).toBe(82000);
expect(groupLinesByDate(nineLinesOn('2027-08-28'))).toEqual({ ok: false, code: 'too_many_lines_on_date', date: '2027-08-28' });
expect(groupLinesByDate([pan(thirtyTwoDates)])).toEqual({ ok: false, code: 'too_many_receipts' });
// amount in words
expect(amountInWords(61000)).toBe('Rupees Six Hundred Ten only');
expect(amountInWords(10000000)).toBe('Rupees One Lakh only');
expect(amountInWords(25000500)).toBe('Rupees Two Lakh Fifty Thousand Five only');
expect(amountInWords(1000000000)).toBe('Rupees One Crore only');
expect(amountInWords(10550)).toBe('Rupees One Hundred Five and Fifty Paise only');
// qr
expect(isQrToken(newQrToken())).toBe(true); expect(new Set(Array.from({ length: 1000 }, newQrToken)).size).toBe(1000);
expect(receiptQrUrl('https://site.example', 'AbCdEfGhIjKlMnOpQrStUv')).toBe('https://site.example/r/AbCdEfGhIjKlMnOpQrStUv');
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest tests/unit/seva/money.test.ts tests/unit/seva/numbering.test.ts tests/unit/seva/time.test.ts tests/unit/seva/grouping.test.ts tests/unit/seva/amount-words.test.ts tests/unit/seva/qr.test.ts`. Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the six modules with the signatures above**

IST maths with a fixed +05:30 offset (India has no daylight saving; one helper converts both ways and every function uses it). This task imports nothing from other A1 tasks. Short-form lookup year = `opts.year`. `formatRupees` uses `Intl.NumberFormat('en-IN', { minimumFractionDigits, maximumFractionDigits })` with the `Rs ` prefix: the existing `formatCurrency` in `lib/format.ts:4` prints the rupee glyph with variable decimals, and `formatDate`/`formatDateTime` (`:45`, `:61`) have no IST time zone, so they do not meet the slip's exact text (DB §10.1) - leave `lib/format.ts` unchanged and say so in the commit body.

- [ ] **Step 4: Run them and see them pass** (same command). Then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add lib/seva/money.ts lib/seva/numbering.ts lib/seva/time.ts lib/seva/grouping.ts lib/seva/amount-words.ts lib/seva/qr.ts tests/unit/seva
git commit -m "feat(seva): add money, numbering, IST time, grouping, amount-in-words and QR token helpers"
```

### Task A1-3: Domain data, zod schemas, wire types, error codes and shared strings

Tier: **Opus medium** - data and shapes copied from the spec; the schema rules are pinned by the tests below.

**Files:**
- Create: `lib/seva/domain/nakshatras.ts`, `lib/seva/domain/rashis.ts`, `lib/seva/domain/gotras.ts`, `lib/seva/domain/options.ts`
- Create: `lib/seva/schemas.ts`, `lib/seva/errors.ts`, `types/seva.ts`, `lib/seva/strings/common.ts`
- Test: `tests/unit/seva/domain.test.ts`, `schemas.test.ts`, `errors.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `types/seva.ts` exactly as **Shared contracts**, plus:
```ts
// domain
export interface DomainOption { id: number; en: string; kn: string; aliases: string[] }
export const NAKSHATRAS: readonly DomainOption[];   // 27, ids and spellings verbatim from DB §9.2 (25, 26 marked UNCERTAIN in a comment)
export const RASHIS: readonly DomainOption[];       // 12, DB §9.2
export const GOTRAS: readonly DomainOption[];       // id 0 'Not known' / 'ಗೊತ್ತಿಲ್ಲ', then the 56 from R4 §3 (Kannada UNCERTAIN, O-03)
export function searchOptions(options: readonly DomainOption[], query: string): DomainOption[]; // case-insensitive prefix on en, kn and aliases; exact match first
// schemas (zod v4)
export const devoteeSchema;            // -> DevoteeInput; name trimmed 1..80; phone normalised to +91XXXXXXXXXX (10-digit Indian mobile starting 6-9)
export const counterOrderSchema;       // -> CounterOrderPayload; 1..31 receipts, 1..8 lines, quantity 1..99, uuid ids, qrToken /^[A-Za-z0-9_-]{22}$/
export const offlineOrderSchema;       // -> OfflineOrderPayload; receiptNo a string of at most 40 chars (the SQL function checks it against its parts)
// This task imports nothing from A1-2 (they run in parallel); the qrToken regex is the same literal as isQrToken.
export const syncRequestSchema;        // { items: OutboxItem[] } 1..200
export const cancelSchema;             // { receiptIds: uuid[1..31]; reasonCode: CancelReasonCode (not the two system codes); note? } 'other' needs note >= 3
export const prasadamGiveSchema, prasadamUndoSchema, dayCloseSchema, sevaUpsertSchema, settingsPatchSchema,
  denominationsSchema, festivalSchema, counterSchema, deviceRegisterSchema, staffOnboardSchema, staffUpdateSchema,
  gapResolveSchema, exportAuditSchema;  // field rules from DB §7 checks and §13
// errors
export type SevaErrorCode = 'unauthenticated' | 'forbidden' | 'view_only' | 'staff_inactive' | 'device_required'
  | 'device_unknown' | 'validation' | 'seva_inactive' | 'seva_not_on_counter' | 'price_changed'
  | 'amount_change_not_allowed' | 'change_reason_required' | 'date_out_of_range' | 'cash_short' | 'upi_details_required'
  | 'cancel_window_passed' | 'already_cancelled' | 'cannot_reprint_cancelled' | 'outbox_not_empty' | 'day_already_closed'
  | 'day_closed' | 'difference_note_required' | 'number_conflict' | 'device_exists' | 'not_found' | 'rate_limited'
  | 'partial_failure' | 'internal';
export class SevaError extends Error { constructor(public code: SevaErrorCode, public detail?: Record<string, unknown>) }
export function sevaErrorStatus(code: SevaErrorCode): number;   // 401, 403, 400, 404, 409, 429, 502 (partial_failure), 500
export function sevaErrorMessage(code: SevaErrorCode, detail?: Record<string, unknown>): string; // plain English, e.g. seva_inactive + { name } -> '<name> was switched off in Seva settings a moment ago.'
// strings/common.ts - printed and shared words, en with kn under (Kannada to be proof-read, O-03)
export const COMMON: { receiptNo: Bi; sevaDate: Bi; name: Bi; gotra: Bi; nakshatra: Bi; rashi: Bi; total: Bi; cash: Bi;
  cancelled: Bi; duplicate: Bi; showAtPrasadam: Bi /* 'Show this at the prasadam counter' / 'ಪ್ರಸಾದ ಕೌಂಟರ್‌ನಲ್ಲಿ ತೋರಿಸಿ' */ };
export type Bi = { en: string; kn: string };
```

- [ ] **Step 1: Write the failing tests**

```ts
expect(NAKSHATRAS).toHaveLength(27); expect(NAKSHATRAS[3]).toMatchObject({ id: 4, en: 'Rohini', kn: 'ರೋಹಿಣಿ' });
expect(RASHIS).toHaveLength(12); expect(RASHIS[11]).toMatchObject({ id: 12, en: 'Meena', kn: 'ಮೀನ' });
expect(GOTRAS[0]).toMatchObject({ id: 0, en: 'Not known' }); expect(GOTRAS).toHaveLength(57);
expect(searchOptions(NAKSHATRAS, 'roh')[0].en).toBe('Rohini');
expect(searchOptions(NAKSHATRAS, 'krithika')[0].en).toBe('Krittika');   // alias
expect(searchOptions(RASHIS, 'ಮೇ')[0].en).toBe('Mesha');                 // Kannada prefix
test.each([
  ['  ವೆಂಕಟೇಶ  ', 'ok', 'ವೆಂಕಟೇಶ'], ['Venkatesh Rao 🙏', 'ok', 'Venkatesh Rao 🙏'],
  ['x'.repeat(81), 'error', null], ['   ', 'error', null],
])('devotee name %j', (name, kind, want) => { /* devoteeSchema.safeParse({ name }) */ });
test.each([
  ['98450 12345', '+919845012345'], ['+91 98450-12345', '+919845012345'], ['09845012345', '+919845012345'],
  ['5845012345', null], ['abc', null], ['984501234', null],
])('phone %j', (phone, want) => { /* want null -> issue code 'invalid_phone' with message 'Enter a 10-digit mobile number' */ });
it('refuses 9 lines on one receipt, quantity 0 and 100, and 32 receipts')
it('needs 6 digits and the tick for UPI')     // { mode: 'upi', upiRefLast6: '11904' } fails; '119042' + upiSeenConfirmed true passes
it('needs a note when the cancel reason is other')
it('refuses the system cancel codes from clients')   // reasonCode 'refunded' fails cancelSchema
it('maps every error code to a status and a message') // loop over the code list; status in [400,401,403,404,409,429,500,502]; message non-empty and contains no 'Error:' or stack text
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest tests/unit/seva/domain.test.ts tests/unit/seva/schemas.test.ts tests/unit/seva/errors.test.ts`. Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the modules**

Copy nakshatra and rashi names verbatim from DB §9.2; gotras and English spelling variants (aliases) from R4 §2.1 and §3. `types/seva.ts` holds only types (no runtime code). Schemas infer their output types and are checked against `types/seva.ts` with `satisfies z.ZodType<CounterOrderPayload>` (or an equivalent compile-time assertion).

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add lib/seva/domain lib/seva/schemas.ts lib/seva/errors.ts lib/seva/strings/common.ts types/seva.ts tests/unit/seva
git commit -m "feat(seva): add nakshatra, rashi and gotra data, zod schemas, wire types and error codes"
```

### Task A1-4: Role allow-list, the two new roles and the Firestore users-create rule

Tier: **Opus xhigh** - security fix on the admin boundary of the whole site (DB §17.4, M04-F47, M07-F37).

**Files:**
- Modify: `lib/auth/admin-auth.ts:39-43,147-156` (allow-list), `types/user.ts:3-44` (roles + normaliser), `firestore.rules:39` (users create), `components/admin/users/UserRoleBadge.tsx:20` (colours for the new roles)
- Create: `jest.rules.config.ts`, `tests/rules/users-create.test.ts`
- Test: `tests/unit/admin-auth.test.ts` (extend), `tests/unit/seva/user-roles.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ADMIN_CONSOLE_ROLES = new Set(['super_admin', 'temple_admin', 'admin', 'billing', 'priest', 'staff', 'office_staff'])` in `admin-auth.ts`; server `normalizeRole` trims, lower-cases and replaces spaces with `_`. `UserRole` gains `'receptionist' | 'prasadam_counter'`; `NormalizedRole` gains the same two values. **Decision:** the two new roles are *not* in the generic admin allow-list - they reach only `/api/seva/*` (through A2-4's guard), so a receptionist can never call `/api/admin/users/set-role` and similar routes.

- [ ] **Step 1: Check what sign-up writes**

Run: `git grep -n "users\"" -- context lib app components services | Select-String -Pattern "setDoc|addDoc"` and read each hit. Expected: the list of fields a self-sign-up writes to `users/{uid}`. The rule below must allow exactly those with safe values.

- [ ] **Step 2: Write the failing tests**

```ts
// tests/unit/admin-auth.test.ts (extend, same mocks as the file already uses)
test.each(['', 'user', 'devotee', 'Devotee ', 'volunteer', 'receptionist', 'prasadam_counter', 'superadmin'])(
  'role %j is refused with 403 insufficient_role', async (role) => { /* verifyAdminUserResult -> { ok: false, reason: 'insufficient_role', status: 403 } */ });
test.each(['super_admin', 'temple_admin', 'Temple Admin', 'admin', 'billing', 'priest', 'staff', 'office_staff'])(
  'role %j is allowed', async (role) => { /* ok: true */ });
// tests/unit/seva/user-roles.test.ts
expect(normalizeRole('receptionist')).toBe('receptionist'); expect(normalizeRole('Prasadam Counter' as UserRole)).toBe('prasadam_counter');
// tests/rules/users-create.test.ts (@firebase/rules-unit-testing, project 'demo-seva', rules from firestore.rules)
it('denies creating own user doc with role super_admin')      // assertFails
it('denies role temple_admin, receptionist and billing on create')
it('denies isApproved true on create')
it('allows create with no role, or role devotee, with the fields sign-up writes')
it('denies creating a doc for another uid')
```

- [ ] **Step 3: Run them and see them fail**

Run: `npx jest tests/unit/admin-auth.test.ts tests/unit/seva/user-roles.test.ts` (role tests fail) and `npm run test:rules` (rules tests fail: create with super_admin succeeds today).

- [ ] **Step 4: Implement**

Replace `BLOCKED_ROLES` with `ADMIN_CONSOLE_ROLES` and `if (!ADMIN_CONSOLE_ROLES.has(role))`. Rule (adjust only to match Step 1's real fields):
```
allow create: if isAuthenticated() && request.resource.data.uid == request.auth.uid
  && (!('role' in request.resource.data) || request.resource.data.role == 'devotee')
  && (!('isApproved' in request.resource.data) || request.resource.data.isApproved == false)
  && (!('isActive' in request.resource.data) || request.resource.data.isActive == true);
```
`jest.rules.config.ts`: `testEnvironment: 'node'`, `testMatch: ['**/tests/rules/**/*.test.ts']`. The `'Billing'` capitalisation at `firestore.rules:18` is noted, not changed (DB §17.4).

- [ ] **Step 5: Run them and see them pass** (same commands), then `npm run typecheck` (fix any exhaustive switch on `NormalizedRole` the new values reveal - e.g. `context/AuthContext.tsx` - so receptionists count as admin-console users on the client: `canAccessAdmin` stays "not devotee and not volunteer").

- [ ] **Step 6: Commit**

```bash
git add lib/auth/admin-auth.ts types/user.ts firestore.rules components/admin/users/UserRoleBadge.tsx jest.rules.config.ts tests/rules tests/unit
git commit -m "fix(security): allow-list admin roles, add seva roles, block self-assigned roles on sign-up"
```

### Task A1-5: Remove the committed service-account key, close the public receipts leak, fix the receipt pages

Tier: **Opus xhigh** - secrets handling and a public personal-data leak.

**Files:**
- Create: `scripts/lib/admin-credentials.ts`, `scripts/lib/admin-credentials.cjs`, `lib/auth/verify-id-token.ts`
- Modify: the 11 tracked files under `scripts/` that carry a private-key marker - `check-about-us.ts`, `check-trust-committee.ts`, `dump-firestore-live.ts`, `import-events.ts`, `seed-poojas.js`, `seed-poojas.ts`, `seed-sevas.js`, `seed-sevas.ts`, `seed-trust-committee.ts`, `update-finance-settings.js`, `update-finance-settings.ts`
- Modify: `app/api/public/receipts/route.ts`, `app/admin/receipts/[receiptId]/page.tsx:23-45`, `app/admin/receipts/[receiptId]/print/page.tsx:33-44`
- Test: `tests/unit/seva/no-embedded-keys.test.ts`, `tests/unit/seva/verify-id-token.test.ts`, `tests/unit/seva/public-receipts-route.test.ts`, `tests/unit/seva/receipt-pages-params.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
// lib/auth/verify-id-token.ts (server-only)
export async function verifyBearerIdToken(request: Request): Promise<{ uid: string; email: string | null } | null>;
// scripts/lib/admin-credentials.ts and .cjs (same behaviour)
export function loadServiceAccount(): { projectId: string; clientEmail: string; privateKey: string };
// reads env FIREBASE_SERVICE_ACCOUNT_JSON (JSON text) first, else the git-ignored .firebase-adminsdk.json at the repo root,
// else throws 'Set FIREBASE_SERVICE_ACCOUNT_JSON or add .firebase-adminsdk.json (git-ignored).'
```

**Secret-handling rule for this task:** never open the 11 files in full and never print a key. View them only through a Node one-off that prints the file with every line between `BEGIN PRIVATE KEY` and `END PRIVATE KEY` and every `private_key` / `private_key_id` value replaced by `<redacted>`. Make the replacement with a script, not by pasting key text into an Edit.

- [ ] **Step 1: Write the failing tests**

```ts
// no-embedded-keys: reads every `git ls-files scripts` file
it('no tracked script embeds a private key')   // content does not match /PRIVATE KEY-----/ nor /"private_key"\s*:\s*"-----/ ; on failure report file names only
// verify-id-token (mock firebase-admin/auth and @/lib/admin-firebase like tests/unit/admin-auth.test.ts)
it('returns null without a Bearer header'); it('returns null for an invalid token'); it('returns uid and email for a valid token')
// public receipts route (@jest-environment node)
it('answers 401 with code unauthenticated when no token is sent')
it('returns only the caller\'s own bookings, newest first, at most 20')    // Firestore query filtered on the owner field (check types/seva-booking.ts for its name)
it('returns only id, sevaTitle, preferredDate, status, paymentStatus and amount')  // Object.keys of each row; no phone, email or payment reference
// receipt pages
it('detail page loads the receipt from params.receiptId')   // mock next/navigation useParams -> { receiptId: 'r1' }; expect getReceipt called with 'r1'
it('print page loads the receipt from params.receiptId')
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest tests/unit/seva/no-embedded-keys.test.ts tests/unit/seva/verify-id-token.test.ts tests/unit/seva/public-receipts-route.test.ts tests/unit/seva/receipt-pages-params.test.tsx`. Expected: FAIL (11 files flagged; modules missing; route returns data without a token; pages read `params.id`).

- [ ] **Step 3: Implement**

Each script gets `const sa = loadServiceAccount();` in place of the embedded object (the `.js` twins require the `.cjs` loader). The public route uses `verifyBearerIdToken` and the admin Firestore, filtered to the caller. The two pages read `params.receiptId` (the Supabase rebuild comes in A4-4).

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add scripts lib/auth/verify-id-token.ts app/api/public/receipts/route.ts "app/admin/receipts/[receiptId]" tests/unit/seva
git commit -m "fix(security): load the service account from env or a git-ignored file, require sign-in for public receipts, fix receipt page params"
```

After merge the owner revokes the old key (SETUP-GUIDE B3, Task A2-9; open item O-18). History rewrite is optional and not part of this plan.

### Task A1-6: Module tokens and shared UI primitives

Tier: **Opus high** - visual judgement against the approved mockups, bounded to tokens and five small components.

**Files:**
- Create: `styles/seva/tokens.css` (every custom property of `$STATE/desk/mockups/proto.css` v2, scoped under `.seva`; base `.seva` font stack Inter then Noto Sans Kannada, 13 px floor, `.kn` block style: own line, smaller, muted, line-height 1.75; light only, the dark set kept under `.seva[data-theme="dark"]` and unused)
- Create: `components/seva/ui/Bilingual.tsx`, `SearchSelect.tsx`, `Segmented.tsx`, `Chip.tsx`, `StatusPill.tsx`
- Modify: `components/ui/button.tsx`, `input.tsx`, `select.tsx`, `switch.tsx`, `card.tsx`, `dialog.tsx` - add token-based variants named in UI-REDESIGN-PLAN §5.1-5.4 (`docs/rearchitecture/UI-REDESIGN-PLAN.md`) without changing any default variant
- Test: `tests/unit/seva/ui-primitives.test.tsx`, `tests/unit/seva/tokens-css.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
export function Bilingual(p: { en: string; kn?: string | null; as?: 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'label' | 'th'; className?: string; htmlFor?: string }): JSX.Element;
// English first; Kannada in <span className="kn" lang="kn"> on its own line after it; nothing when kn is empty
export interface SearchOption { value: string; en: string; kn?: string; aliases?: string[] }
export function SearchSelect(p: { id: string; label: { en: string; kn?: string }; options: readonly SearchOption[];
  value: { value?: string; text: string } | null; onChange(v: { value?: string; text: string } | null): void;
  allowTyped?: boolean; placeholder?: string; onEnterNext?(): void; disabled?: boolean }): JSX.Element;
// ARIA combobox + listbox; ArrowUp/Down + Enter pick; Esc closes; with allowTyped an extra option "Use '<typed>' as entered"
export function Segmented<T extends string>(p: { name: string; label: string; options: { value: T; en: string; kn?: string }[];
  value: T; onChange(v: T): void }): JSX.Element;   // radiogroup, arrow keys move
export function Chip(p: { tone: 'neutral' | 'attention' | 'critical' | 'ok'; children: React.ReactNode }): JSX.Element;
export function StatusPill(p: { tone: 'online' | 'offline' | 'closed'; children: React.ReactNode }): JSX.Element;
// button variants added: 'seva-primary' | 'seva-secondary' | 'seva-ghost' | 'seva-danger'
```

- [ ] **Step 1: Write the failing tests**

```ts
it('Bilingual puts Kannada after English with lang="kn"')       // container.textContent order; querySelector('[lang="kn"]')
it('SearchSelect finds by prefix and alias and picks with the keyboard')  // type 'krith' -> option 'Krittika'; ArrowDown, Enter -> onChange({ value: '3', text: 'Krittika' })
it('SearchSelect offers the typed text when allowTyped')        // type 'Kashyapa Rishi', Enter -> onChange({ text: 'Kashyapa Rishi' })
it('SearchSelect closes on Escape and calls onEnterNext after a pick')
it('Segmented moves with arrow keys and reports the value')
it('keeps the default button classes unchanged')               // buttonVariants() default equals the string captured before the change
// tokens-css.test.ts reads styles/seva/tokens.css
it('scopes every token under .seva')                           // no ':root' selector in the file
it('never sets a font size below 13px')                         // every px value in font-size declarations and --text-* tokens >= 13
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest tests/unit/seva/ui-primitives.test.tsx tests/unit/seva/tokens-css.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the stylesheet and components with the signatures above; match the counter mockup's controls (`counter.html#counter` gotra/nakshatra/rashi combos) for spacing and states.

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add styles/seva components/seva/ui components/ui tests/unit/seva
git commit -m "feat(seva): add module tokens under .seva and shared bilingual, search-select and segmented controls"
```

**Wave A1 gate - owner's 10-minute checklist**
1. Read the A1 test report summary (top 10 lines).
2. Check the Kannada lists printed in the report (27 nakshatras, 12 rashis, 57 gotras) for spelling; mark any wrong one (O-03).
3. Confirm the 11 scripts no longer hold the key: the report shows `no-embedded-keys` passing. Then follow SETUP-GUIDE B3 (the site owner's step after the merge) to revoke the old key.
4. Read the one-paragraph note in the report on who can reach `/api/admin/*` now (seven roles) and who reaches only the seva pages (receptionist, prasadam counter).

---

## Wave A2 - Core logic (12 tasks in parallel; needs A1)

### Task A2-1: SQL functions - issue, offline sync, prints, cancel, spoiled reissue

Tier: **Opus xhigh** - money and gap-free numbering in one transaction; the rules interact (idempotency, gaps, supersede) and a wrong answer costs real money and audit trust.

**Files:**
- Create: `supabase/migrations/20261021000000_seva_functions_issue.sql`
- Test: `tests/db/seva-issue.test.ts`, `tests/db/seva-sync.test.ts`, `tests/db/seva-cancel.test.ts`

**Interfaces:**
- Consumes: A1-1 tables, `seva_ist_parts`, `seva_receipt_no`, `seva_audit`; fixtures.
- Produces (DB §7.8, with three decided extensions marked +):
```sql
seva_take_numbers(p_series text, p_year smallint, p_count int) returns int      -- first running no.; INSERT ... ON CONFLICT DO NOTHING, then UPDATE ... RETURNING (row lock to commit)
seva_next_group_no(p_issued_at timestamptz) returns text                          -- 'G-YYMM-NNNN' from group_counters (IST month)
seva_issue_counter_order(p_order jsonb, p_staff_id uuid, p_device_id uuid) returns jsonb
seva_sync_offline_order(p_order jsonb, p_staff_id uuid, p_device_id uuid, p_issuer_role text) returns jsonb
  -- A2-FIX/A2-FIX2: p_order carries issuer_staff_no; p_staff_id is the syncer (synced_by_staff_id); p_issuer_role is the
  -- issuer's role read by the route. Issuer: may use the counter, staff row active or inactive (inactive -> audit
  -- receipt.issuer_inactive_at_sync); line audits name the issuer with p_issuer_role as actor_role
seva_record_prints(p_receipt_ids uuid[], p_staff_id uuid, p_device_id uuid) returns jsonb   -- { receipts: [{ id, print_count, duplicate, last_printed_at }] }
seva_cancel_receipts(p_receipt_ids uuid[], p_reason_code text, p_note text, p_staff_id uuid, p_is_admin boolean,
                     p_at timestamptz default null, p_cancelled_by_staff_no integer default null,
                     p_canceller_role text default null) returns jsonb   -- + p_at: when the cancel happened (offline cancels); window checked at coalesce(p_at, now()), never earlier than issued_at nor later than now()
  -- A2-FIX2: an outbox cancel passes p_cancelled_by_staff_no + p_canceller_role (who cancelled on the PC) and p_at
  -- (required); p_staff_id is then the syncer. Canceller checked like an offline issuer, counter rule always (own receipt,
  -- window to p_at); recorded as cancelled_by_staff_id and receipt.cancel actor; syncer in after.synced_by_staff_id
seva_reissue_spoiled(p_receipt_id uuid, p_staff_id uuid, p_device_id uuid, p_qr_token text) returns jsonb  -- + p_qr_token (tokens are made in TypeScript, see qr.ts)
  -- A2-FIX2: today's receipts only (business_date = the IST business date), else validation field reissue_only_today
```
JSON shapes: **Shared contracts / SQL JSON contract**. Rules decided here (beyond DB §8-9):
- Every function reads time once through `now()` and IST parts through `seva_ist_parts(now())`.
- Device must be live (`retired_at is null`) for its counter; staff `status = 'active'`; else `SEVA:device_unknown` / `SEVA:staff_inactive`.
- A counter-day with a `day_closes` row in status `closed` refuses issuing: `SEVA:day_closed`.
- Line pricing: `unit_rate` null -> `sevas.amount`; non-null on a fixed-rate seva -> needs `allow_amount_change` (else `amount_change_not_allowed`) and, when it differs and `amount_change_reason_required`, a reason of at least 3 characters (else `change_reason_required`); any-amount sevas need `unit_rate` and store `catalogue_rate` null. The seva must be active (`seva_inactive`, detail `{"name": ...}`) and visible on the counter (`seva_not_on_counter`).
- `expected_total` must equal the computed total, else `SEVA:price_changed` with detail `{"lines":[{"seva_id","rate"}]}` - nothing is written.
- Seva dates from the IST business date to `+ counter_days_ahead`, else `date_out_of_range`.
- Receipts get consecutive numbers in seva-date order, position 1..n; `prasadam_state = 'pending'` when any line's seva gives prasadam, else `'none'`.
- Devotee profile upsert only when `phone_e164` is given (`visit_count + 1`, `last_seen_at`).
- Each changed line writes audit `receipt.amount_changed` (reason = the line's reason); a normal issue writes no audit row (C-36).
- Sync (DB §8.3): the order's series must be the device counter's OF series and every `receipt_no` must equal `seva_receipt_no(...)` of its parts (`validation` otherwise); numbering outcomes per DB §8.3, with a number inside an open gap shrinking or splitting the gap and a fully filled gap set to `received_late`; a retired device is accepted only inside its open `device_replaced` gap; `catalogue_rate` = the line's `cached_rate`, and when it differs from today's `sevas.amount` an audit `receipt.amount_changed` row records both (C-58) without setting `has_changed_amount`.
- Supersede (DB §8.6): when `supersedes_client_order_id` names a stored C order whose receipts all have `print_count = 0`, cancel them with `not_printed_connection_lost` and note `'Not printed: connection lost before the reply; reissued offline as <first OF number>'`, set `supersedes_order_id`, audit `receipt.superseded`; if any was printed, cancel nothing.
- Cancel refund state: cash cancelled on the same IST business date -> `done` with `refund_note 'Given back from the drawer'`; cash from an earlier day, UPI and online -> `due` (C-20). Audit `receipt.cancel` per receipt.

- [ ] **Step 1: Write the failing tests**

```ts
// seva-issue.test.ts - fixtures: staff 023 'Ramesh', device on Counter 1, sevas PAN 105 (multi-date, prasadam), PAA 505, KAR any-amount counter-only
it('issues one receipt per seva date with consecutive C1 numbers')   // book example -> receipt_no C1-023-<MM>-<YYYY>/000001..3 in date order, totals '610.00','105.00','105.00', positions 1..3, one order total '820.00'
it('prices lines from the catalogue when unit_rate is null')
it('repeated client_order_id returns the same receipts')             // second call: duplicate = true, same ids; receipt_series_years.last_no still 3
it('rejects an order whose expected total no longer matches the catalogue') // expected_total '800.00' -> SEVA:price_changed; no rows in seva_orders; last_no unchanged
it('rejects a switched-off seva and a seva not shown on the counter') // SEVA:seva_inactive (detail name 'Paaduka Pooja'), SEVA:seva_not_on_counter
it('allows a changed amount only where permitted and with a reason') // amount_change_not_allowed; change_reason_required; ok -> has_changed_amount true + one receipt.amount_changed audit row
it('takes any amount for Other Seva without marking it changed')
it('refuses past dates and dates beyond counter_days_ahead')         // SEVA:date_out_of_range
it('checks cash received and stores the change')                     // cash_received '1000.00' on '820.00' -> change_returned '180.00'; '800.00' -> SEVA:cash_short
it('needs six UPI digits and the confirmation')                      // SEVA:upi_details_required
it('refuses a retired device, an inactive staff member and a closed day')
it('upserts the devotee profile only when a phone is given')         // two orders with the same phone -> visit_count 2; no phone -> no profile row
it('keeps numbers per series and per year')                          // seva_take_numbers('C1',2026,3)=1, again =4, ('C1',2027,1)=1, ('OF1',2026,1)=1
it('burns no number when an order fails')                            // failing order between two good ones -> numbers 1 and 2, no gap
it('sets prasadam pending only when a line gives prasadam')
// seva-sync.test.ts
it('stores an offline order exactly as printed')                     // receipt_no, issued_at, issued_offline true, last_no moves on
it('ignores a duplicate client_receipt_id')
it('records a missing_in_sync gap when numbers jump')                // last 3, receives 6 -> gap 4..5 open
it('fills an open gap with a late number and marks it received_late when full')
it('refuses a lower number outside any gap and a number from another counter series') // SEVA:number_conflict
it('accepts a retired device only inside its device_replaced gap')
it('sync accepts a 1 January OF number in the new year')             // issued_at '2026-12-31T18:31:00Z', 'OF1-023-01-2027/000001' -> year 2027, month 1
it('refuses a receipt number that does not match its parts')          // SEVA:validation
it('audits an offline rate that differs from today\'s catalogue')     // cached 100 vs catalogue 105 -> audit row, has_changed_amount false
it('cancels an unprinted superseded C order and links the OF order')
it('leaves a printed superseded C order alone')
// seva-cancel.test.ts
it('first print sets print_count 1; a second print is a duplicate and is audited') // receipt.reprint audit on the second
it('refuses to print a cancelled receipt')                           // SEVA:cannot_reprint_cancelled
it('lets the issuer cancel inside the window and hands cash back the same day') // refund_state 'done'
it('refuses the issuer after the window and refuses other people\'s receipts')  // SEVA:cancel_window_passed, SEVA:forbidden
it('lets an admin cancel any receipt at any time')
it('sets refund due for UPI and for cash from an earlier day')
it('needs a note for reason other and refuses a second cancel')     // SEVA:validation, SEVA:already_cancelled
it('uses p_at for the window of an offline cancel')
it('spoiled reissue cancels with spoiled_print and issues the next number on the same order') // same seva_date and lines, replaces_receipt_id set, audit receipt.reissue_spoiled
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm run test:db -- tests/db/seva-issue.test.ts tests/db/seva-sync.test.ts tests/db/seva-cancel.test.ts`. Expected: FAIL (functions do not exist).

- [ ] **Step 3: Implement the functions** with the signatures and rules above, in one migration file. Each function is one transaction (plpgsql body); no dynamic SQL.

- [ ] **Step 4: Run them and see them pass** (same command).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261021000000_seva_functions_issue.sql tests/db/seva-issue.test.ts tests/db/seva-sync.test.ts tests/db/seva-cancel.test.ts
git commit -m "feat(seva): add SQL functions for issuing, offline sync, prints, cancel and spoiled reissue"
```

### Task A2-2: SQL functions - prasadam, devices, gaps, heartbeat, day close

Tier: **Opus high** - bounded rules, pinned by tests; money maths for day close.

**Files:**
- Create: `supabase/migrations/20261021000100_seva_functions_ops.sql`, `types/seva-dayclose.ts`
- Test: `tests/db/seva-prasadam.test.ts`, `tests/db/seva-devices.test.ts`, `tests/db/seva-dayclose.test.ts`

**Interfaces:**
- Consumes: A1-1 tables and helpers.
- Produces:
```sql
seva_mark_prasadam(p_receipt_id uuid, p_staff_id uuid, p_confirm_off_date boolean) returns jsonb
  -- { state: 'given'|'already_given'|'needs_confirm'|'cancelled'|'no_prasadam', off_date?: 'before'|'after', days?: int,
  --   given_at?: timestamptz, given_by_name?: text }
seva_undo_prasadam(p_receipt_id uuid, p_staff_id uuid, p_reason text, p_is_admin boolean default false) returns jsonb  -- + p_is_admin
seva_register_device(p_counter_id smallint, p_secret_hash text, p_label text, p_staff_id uuid) returns uuid
seva_replace_device(p_counter_id smallint, p_secret_hash text, p_label text, p_last_printed_of_no int, p_reason text, p_staff_id uuid) returns uuid
seva_resolve_gap(p_gap_id bigint, p_status text, p_note text, p_staff_id uuid) returns void
seva_heartbeat(p_device_id uuid, p_outbox_count int, p_clock_skew_ms int, p_app_version text) returns jsonb   -- new: { server_time, of_series, last_of_no, last_of_group_no, day_closed }
  -- last_of_group_no = seva_offline_group_floor(counter, device, now()) (A2-FIX2): the highest offline group label NNN
  -- ('G-YYMM-OF<n>-NNN') held for the counter's OF series this IST month, or the floor "Replace this PC" stored on the
  -- device when higher; the PC raises its group counter to it
seva_offline_group_floor(p_counter_id smallint, p_device_id uuid, p_at timestamptz) returns int   -- A2-FIX2; also read by counter/bootstrap
-- A2-FIX2: seva_replace_device also stores the new PC's group label floor (counter_devices.of_group_floor_yymm/no) =
-- the old PC's floor + the total size of the OF series' open device_replaced gaps (DB 8.4)
seva_prepare_day_close(p_counter_id smallint, p_business_date date) returns jsonb
seva_close_day(p_counter_id smallint, p_business_date date, p_counts jsonb, p_upi_bank_total numeric, p_note text, p_staff_id uuid) returns uuid
seva_reopen_day(p_day_close_id uuid, p_reason text, p_staff_id uuid) returns void
```
```ts
// types/seva-dayclose.ts
export interface DayClosePrep { counterId: number; businessDate: string; status: 'open' | 'closed' | 'reopened';
  openingFloatPaise: number; receipts: number; cancelled: number; changed: number; cashExpectedPaise: number;
  upiCount: number; upiExpectedPaise: number; outboxPending: number;
  seriesRanges: { series: string; first: string | null; last: string | null; issued: number; cancelled: number; openGaps: number }[];
  denominations: { kind: 'note' | 'coin'; valuePaise: number }[] }
```
Decisions: `p_counts` = `[{ "kind": "note", "value": 500, "count": 3 }, ...]`; values are snapshotted. Closing needs `counter_devices.last_outbox_count = 0` for the live device (`outbox_not_empty`). A difference in cash or UPI needs a note of at least 3 characters (`difference_note_required`). One row per counter and date: a second close of a `closed` day raises `day_already_closed`; closing a `reopened` day updates the same row and replaces its counts. Off-date prasadam compares the receipt's `seva_date` with the IST business date.

- [ ] **Step 1: Write the failing tests**

```ts
// prasadam
it('marks prasadam once and reports who gave it')                // second call -> already_given with given_at and given_by_name 'Suresh'
it('needs a second tap before or after the seva date and records which') // confirm false -> needs_confirm, off_date 'before', days 2; confirm true -> given, prasadam_off_date 'before', audit prasadam.given_off_date
it('refuses cancelled receipts and receipts without prasadam')    // states 'cancelled', 'no_prasadam'
it('undoes by the same person within the undo time')              // -> pending; audit prasadam.undo
it('after the undo time needs an admin and a reason')             // prasadam_undo_seconds = 0: non-admin -> SEVA:forbidden; admin + reason -> pending, audit prasadam.reversed
// devices and gaps
it('registers one live device per counter')                      // second register -> SEVA:device_exists; audit device.register
it('replace retires the old device, raises the OF floor and opens a device_replaced gap') // server last OF 5, typed 9 -> gap 6..9 open, last_no 9, audit device.replace
it('replace with the server\'s own last number opens no gap')
it('resolving a gap needs a note and records who and when')      // audit gap.resolve
it('heartbeat stores outbox count, skew and version and returns the OF floor')
// day close - float Rs 500; Counter 1 today: cash 610 and 105 (105 cancelled), UPI 505; Counter 2 cash 200
it('prepares expected cash from the float plus this counter\'s issued cash receipts') // cash_expected '1110.00', upi_expected '505.00', receipts 2, cancelled 1
it('needs a note when cash or UPI differs')                      // counted 1100 -> SEVA:difference_note_required; with note ok, cash_difference '-10.00'
it('needs an empty outbox')                                      // last_outbox_count 2 -> SEVA:outbox_not_empty
it('stores counts with snapshot values and generated amounts')   // 2 x 500 note + 11 x 10 coin -> amounts 1000, 110
it('allows one close per counter and date, and closing again after a reopen') // SEVA:day_already_closed; reopen without reason -> SEVA:validation; reopen + close updates the same row; audits dayclose.close / dayclose.reopen
it('lists series ranges with first, last, issued, cancelled and open gaps')
```

- [ ] **Step 2: Run them and see them fail**: `npm run test:db -- tests/db/seva-prasadam.test.ts tests/db/seva-devices.test.ts tests/db/seva-dayclose.test.ts`.

- [ ] **Step 3: Implement** the functions above and `types/seva-dayclose.ts`.

- [ ] **Step 4: Run them and see them pass.**

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261021000100_seva_functions_ops.sql types/seva-dayclose.ts tests/db/seva-prasadam.test.ts tests/db/seva-devices.test.ts tests/db/seva-dayclose.test.ts
git commit -m "feat(seva): add SQL functions for prasadam, devices, gaps, heartbeat and day close"
```

### Task A2-3: SQL functions - catalogue, settings, staff, reports, needs attention

Tier: **Opus high** - many small functions plus reporting maths; bounded, test-pinned.

**Files:**
- Create: `supabase/migrations/20261021000200_seva_functions_admin.sql`, `types/seva-reports.ts`
- Test: `tests/db/seva-admin.test.ts`, `tests/db/seva-reports.test.ts`

**Interfaces:**
- Consumes: A1-1 tables and helpers.
- Produces:
```sql
seva_upsert_seva(p_seva jsonb, p_reason text, p_staff_id uuid) returns uuid    -- sets seva.change_reason for the rate trigger; audit seva.create / seva.update / seva.rate_change
seva_reorder_sevas(p_ids uuid[], p_staff_id uuid) returns void                  -- display_order 1..n
-- (seva_next_staff_no() already exists from A1-1)
seva_update_settings(p_patch jsonb, p_staff_id uuid) returns void               -- audit settings.update with before/after
seva_save_denominations(p_rows jsonb, p_staff_id uuid) returns void             -- audit denominations.update
seva_save_festival(p_festival jsonb, p_staff_id uuid) returns uuid              -- { id?, name_en, name_kn, active, days: [date] }; audit festival.update
seva_add_counter(p_name text, p_place text, p_staff_id uuid) returns smallint   -- next id, series C<n> and OF<n>
seva_update_counter(p_counter_id smallint, p_patch jsonb, p_staff_id uuid) returns void  -- name, place, opening_float, active
seva_staff_onboard(p_staff jsonb, p_actor uuid) returns uuid                    -- status invited; staff_no given or next free; audit staff.onboard
seva_staff_update(p_staff_id uuid, p_patch jsonb, p_reason text, p_actor uuid) returns void  -- view_only, status transitions; audit staff.view_only_change / staff.deactivate / staff.reactivate / staff.delete
seva_mark_signed_in(p_staff_id uuid) returns void                               -- invited -> active, first_signed_in_at, once
seva_purge_devotee_profiles() returns int                                       -- last_seen_at older than 3 years
seva_continuity(p_from date, p_to date) returns table(series_code text, year smallint, first_no int, last_no int, issued int, cancelled int, open_gaps int)
seva_dashboard(p_from timestamptz, p_to timestamptz, p_prev_from timestamptz, p_prev_to timestamptz, p_bucket text) returns jsonb
seva_needs_attention(p_from timestamptz, p_to timestamptz, p_today date) returns jsonb
seva_seva_summary(p_from date, p_to date) returns jsonb       -- by seva date (C-63), with the same days last year and rate changes in range
seva_festival_report(p_festival_id uuid, p_compare_year smallint) returns jsonb
```
```ts
// types/seva-reports.ts (route A3-3 maps SQL numerics to paise)
export interface DashboardTotals { totalPaise: number; receipts: number; cashPaise: number; upiPaise: number; onlinePaise: number }
export interface DashboardData { period: Period; asOf: string; tiles: DashboardTotals & { prev: DashboardTotals | null };
  hero: { buckets: { key: string; label: string; cashPaise: number; upiPaise: number; onlinePaise: number }[]; prev: { key: string; totalPaise: number }[] };
  topSevas: { sevaId: string; nameEn: string; nameKn: string | null; amountPaise: number; quantity: number; prevAmountPaise: number }[];
  mode: { cashPaise: number; upiPaise: number; onlinePaise: number }; rush: { dow: number; hour: number; count: number }[];
  calendar: { date: string; totalPaise: number }[]; festivalDates: string[] }
export type NeedsAttentionId = 'changed_amounts' | 'cancellations' | 'day_close_difference' | 'day_not_closed' | 'waiting_to_sync'
  | 'number_gaps' | 'prasadam_pending' | 'upi_refunds_due' | 'clock_skew' | 'backup' | 'database_size' | 'in_doubt_duplicates' | 'future_offline';
export interface NeedsAttentionCard { id: NeedsAttentionId; level: 'ok' | 'attention' | 'critical'; count: number; detail: Record<string, string | number> }
export interface ContinuityRow { series: string; year: number; counterName: string | null; firstNo: string | null; lastNo: string | null;
  numbers: number; issued: number; cancelled: number; openGaps: number }
```
Metric rules: DB §12.1 (issued, `test_mode = false`, by `issued_at` in IST, cancelled excluded, spoiled reissue counted once); Needs attention rules: DB §12.2, plus `in_doubt_duplicates` (an OF order whose `supersedes_order_id` order still has issued receipts) and `future_offline` (offline receipts with `issued_at > received_at + 2 minutes`). Database size uses `pg_database_size(current_database())`, attention above 400 MB.

- [ ] **Step 1: Write the failing tests**

```ts
// seva-admin.test.ts
it('creates a seva and audits seva.create'); it('refuses a duplicate code')
it('a rate change needs a reason and writes history with that reason') // seva_rate_history.reason = 'Office revision'; audit seva.rate_change
it('forces Other Seva (any amount) to counter-only')
it('reorders sevas to 1..n'); it('audits settings changes with before and after')
it('replaces denominations and audits'); it('saves a festival with its dates')
it('adding a counter creates C2 and OF2')
it('onboards an invited staff member with the next free number')
it('needs a reason to deactivate or delete, and audits each status change')
it('mark signed in moves invited to active once')
it('purges profiles unseen for three years')
// seva-reports.test.ts - fixture today: cash 610, cash 105 (cancelled), UPI 505, one test_mode 1000; yesterday 10:00 cash 200
it('dashboard totals exclude cancelled and test-mode receipts')   // totalPaise-equivalent '1115.00', receipts 2, cash '610.00', upi '505.00'
it('uses the previous span given by the caller')                   // prev total '200.00' when prev span covers yesterday 10:00
it('buckets by IST hour, day or month')
it('ranks top sevas by the amount actually paid')
test.each(['changed_amounts', 'number_gaps', 'day_not_closed', 'waiting_to_sync', 'clock_skew', 'backup', 'prasadam_pending',
  'upi_refunds_due', 'in_doubt_duplicates', 'future_offline', 'day_close_difference'])(
  'needs attention raises %s from its fixture', ...)            // each card's level and count
it('needs attention lists future-dated offline receipts and clock skew') // Review Focus 2
it('shows calm zero cards when nothing is wrong')                  // every card level 'ok', count 0
it('continuity reports first, last, issued, cancelled and open gaps per series')
it('seva summary counts by seva date and includes last year')
it('festival report compares with an earlier year')
```

- [ ] **Step 2: Run them and see them fail**: `npm run test:db -- tests/db/seva-admin.test.ts tests/db/seva-reports.test.ts`.

- [ ] **Step 3: Implement** the functions and `types/seva-reports.ts`.

- [ ] **Step 4: Run them and see them pass.**

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261021000200_seva_functions_admin.sql types/seva-reports.ts tests/db/seva-admin.test.ts tests/db/seva-reports.test.ts
git commit -m "feat(seva): add SQL functions for catalogue, settings, staff, dashboard and needs attention"
```

### Task A2-4: Identity adapter, permission matrix, seva actor guard, RPC wrapper, browser HTTP client

Tier: **Opus xhigh** - the authorisation boundary of every seva route (DB §3.3, §15.1, C-66).

**Files:**
- Create: `lib/seva/permissions.ts`, `lib/seva/server/identity.ts`, `lib/seva/server/identity-firebase.ts`, `lib/seva/server/auth.ts`, `lib/seva/server/device.ts`, `lib/seva/server/rpc.ts`, `lib/seva/server/respond.ts`, `lib/seva/server/rate-limit.ts`, `services/seva/http.ts`
- Test: `tests/unit/seva/permissions.test.ts`, `tests/unit/seva/seva-auth.test.ts`, `tests/unit/seva/rpc.test.ts`, `tests/unit/seva/http-client.test.ts`

**Interfaces:**
- Consumes: `verifyBearerIdToken` (A1-5), `SevaError`, `sevaErrorStatus`, `sevaErrorMessage` (A1-3), `staff` and `counter_devices` tables (A1-1), `createAdminClient()`, `getAdminFirestore()` (`lib/admin-firebase.ts:157`), `getAdminApp()` (`:182`).
- Produces: `permissions.ts` exactly as **Shared contracts**, plus:
```ts
// lib/seva/server/identity.ts - the only place that knows the sign-in provider (C-66)
export interface IdentityAdapter {
  verifyRequest(req: Request): Promise<{ externalUid: string; email: string | null } | null>;
  getAccessProfile(externalUid: string): Promise<{ role: unknown; isActive: boolean } | null>;  // Firestore users/{uid}
  createLogin(input: { email: string; displayName: string }): Promise<{ externalUid: string }>;
  setAccessProfile(externalUid: string, patch: { role?: string; isActive?: boolean; email?: string; displayName?: string }): Promise<void>;
  setLoginEnabled(externalUid: string, enabled: boolean): Promise<void>;  // false also revokes refresh tokens
  deleteLogin(externalUid: string): Promise<void>;
}
export function getIdentityAdapter(): IdentityAdapter;          // Firebase implementation from identity-firebase.ts; tests inject a fake with setIdentityAdapterForTests()
// lib/seva/server/auth.ts
export type ActorResult = { ok: true; actor: SevaActor; device: { id: string; counterId: number } | null } | { ok: false; response: NextResponse };
export async function requireSevaActor(req: NextRequest, action: SevaAction,
  opts?: { device?: 'required' | 'optional'; ctx?: PermissionContext }): Promise<ActorResult>;
// order of checks: token -> access profile (isActive) -> mapFirestoreRole -> staff row by firebase_uid (status active; 'invited' allowed only for action 'me')
// -> device (header x-seva-device '<deviceId>.<secret>', sha256 hex compare, retired_at null) -> view-only blocks isWriteAction -> can(actor, action, ctx)
// lib/seva/server/device.ts
export async function verifyDeviceHeader(header: string | null): Promise<{ id: string; counterId: number } | null>;
export function sha256Hex(text: string): string;                 // node:crypto
// lib/seva/server/rpc.ts
export async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T>;  // maps 'SEVA:<code>' (+ DETAIL json) to SevaError; anything else -> SevaError('internal')
// lib/seva/server/respond.ts
export function sevaJson<T>(data: T, init?: { status?: number; headers?: Record<string, string> }): NextResponse;
export function sevaErrorResponse(err: unknown): NextResponse;    // { error: { code, message } } + status; logs code and a request id only
// lib/seva/server/rate-limit.ts - best effort, per server instance
export function rateLimit(key: string, opts: { limit: number; windowMs: number }): boolean;
// services/seva/http.ts (browser)
export class SevaClientError extends Error { code: string; status: number }
export async function sevaFetch<T>(path: string, init: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown; token: string;
  deviceHeader?: string | null; timeoutMs?: number; signal?: AbortSignal }): Promise<T>;   // timeout -> code 'timeout' status 0; network -> 'network' status 0
```

- [ ] **Step 1: Write the failing tests**

```ts
// permissions.test.ts - a literal copy of DB §3.3 rows 1-26 as [action, R, P, TA, TV, SA]
const MATRIX: [SevaAction, string, string, string, string, string][] = [
  ['counter.issue', 'Y', '-', 'Y', '-', 'Y'], ['counter.change_amount', 'Y', '-', 'Y', '-', 'Y'],
  ['receipt.cancel_own', 'Y', '-', 'Y', '-', 'Y'], ['receipt.cancel_any', '-', '-', 'Y', '-', 'Y'],
  ['receipt.reprint', 'Y', '-', 'Y', '-', 'Y'], ['dayclose.close', 'Y', '-', 'Y', '-', 'Y'],
  ['dayclose.reopen', '-', '-', 'Y', '-', 'Y'], ['prasadam.give', '-', 'Y', 'Y', '-', 'Y'],
  ['prasadam.give_off_date', '-', 'Y', 'Y', '-', 'Y'], ['prasadam.reverse', '-', '-', 'Y', '-', 'Y'],
  ['reports.view', '-', '-', 'Y', 'Y', 'Y'], ['export.basic', '-', '-', 'Y', 'Y', 'Y'],
  ['export.with_phones', '-', '-', 'Y', '-', 'Y'], ['sevas.edit', '-', '-', 'Y', '-', 'Y'],
  ['settings.edit', '-', '-', 'Y', '-', 'Y'], ['device.register', '-', '-', 'Y', '-', 'Y'],
  ['gap.resolve', '-', '-', 'Y', '-', 'Y'], ['staff.onboard', '-', '-', 'Y', '-', 'Y'],
  ['staff.grant_super_admin', '-', '-', '-', '-', 'Y'], ['staff.change_role', '-', '-', 'Y', '-', 'Y'],
  ['staff.reactivate', '-', '-', 'Y', '-', 'Y'], ['staff.deactivate', '-', '-', '-', '-', 'Y'],
  ['staff.delete', '-', '-', '-', '-', 'Y'], ['payments.view', '-', '-', 'Y', 'Y', 'Y'],
  ['payments.refund', '-', '-', 'Y', '-', 'Y'], ['payments.fee_rule', '-', '-', '-', '-', 'Y'],
];
test.each(MATRIX)('%s follows DB 3.3', ...)        // 130 assertions with a context that satisfies the row's conditions
it('limits a receptionist\'s reprint and close to their own counter and today')
it('limits a receptionist\'s own cancel to the window')
it('stops a temple admin changing a super admin, themself, or granting super admin') // C-17
it('lets receptionists list only with an own-counter, today context')            // receipts.list
it('maps Firestore roles: temple_admin and admin -> temple_admin; billing, priest, staff, user, "" -> null') // C-62
// seva-auth.test.ts (@jest-environment node; fake IdentityAdapter; mocked createAdminClient)
it('401 unauthenticated without a token')
it('403 staff_inactive when Firestore isActive is false')
it('403 forbidden for a legacy role such as billing')
it('403 forbidden when no staff row exists')
it('403 staff_inactive when Firestore says active but staff says inactive')    // drift fails closed (DB §3.2)
it('allows invited staff only for the me action')
it('403 view_only for a view-only temple admin on a write action')
it('403 device_required without the device header when required')
it('403 device_unknown for a wrong secret or a retired device')
it('returns the actor with staff number and the device counter on success')
// rpc.test.ts
it('maps SEVA:price_changed with DETAIL json to SevaError(price_changed, detail)')
it('maps an unknown database error to internal without leaking its text')
// http-client.test.ts (mock fetch)
it('sends Bearer and x-seva-device headers and parses JSON')
it('turns { error: { code, message } } into SevaClientError')
it('times out with code timeout'); it('reports a network failure with code network')
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/permissions.test.ts tests/unit/seva/seva-auth.test.ts tests/unit/seva/rpc.test.ts tests/unit/seva/http-client.test.ts`.

- [ ] **Step 3: Implement** the modules (`import 'server-only'` in every `lib/seva/server/*` file).

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add lib/seva/permissions.ts lib/seva/server services/seva/http.ts tests/unit/seva
git commit -m "feat(seva): add identity adapter, permission matrix, seva route guard, RPC wrapper and HTTP client"
```

### Task A2-5: Counter order engine (pure)

Tier: **Opus high** - the keyboard-first state machine behind the busiest screen; bounded, pure, test-pinned.

**Files:**
- Create: `lib/seva/counter/state.ts`, `lib/seva/counter/keyboard.ts`, `lib/seva/counter/payload.ts`
- Test: `tests/unit/seva/counter-state.test.ts`, `counter-keyboard.test.ts`, `counter-payload.test.ts`

**Interfaces:**
- Consumes: `groupLinesByDate`, `CounterLine`, `sevaDateBounds`, `toPaise` (A1-2); `CatalogueSeva`, `DevoteeInput`, `CounterOrderPayload` (A1-3).
- Produces:
```ts
export type CounterStep = 1 | 2 | 3;
export interface DevoteeDraft { name: string; gotra: { value?: string; text: string } | null; nakshatra: { value?: string; text: string } | null;
  rashi: { value?: string; text: string } | null; phone: string }
export interface PaymentDraft { mode: 'cash' | 'upi'; cashReceived: string; upiRefLast6: string; upiSeenConfirmed: boolean }
export interface CounterState { step: CounterStep; today: string; devotee: DevoteeDraft; lines: CounterLine[]; payment: PaymentDraft;
  escArmedAt: number | null; submitting: boolean; confirmLargeCash: boolean; search: string }
export type CounterAction =
  | { type: 'setDevotee'; patch: Partial<DevoteeDraft> } | { type: 'applyProfile'; devotee: DevoteeDraft }
  | { type: 'setSearch'; text: string } | { type: 'addByKey'; key: number } | { type: 'addByCode'; code: string }
  | { type: 'removeLine'; lineKey: string } | { type: 'setQuantity'; lineKey: string; quantity: number }
  | { type: 'setDates'; lineKey: string; dates: string[] } | { type: 'changeAmount'; lineKey: string; unitRatePaise: number; reason: string }
  | { type: 'goStep'; step: CounterStep } | { type: 'setPayment'; patch: Partial<PaymentDraft> } | { type: 'confirmLargeCash' }
  | { type: 'escape'; at: number } | { type: 'submitStarted' } | { type: 'submitFinished'; ok: boolean } | { type: 'reset'; today: string };
export interface CatalogueIndex { byId: Map<string, CatalogueSeva>; byKey: Map<number, CatalogueSeva>; byCode: Map<string, CatalogueSeva> }
export function indexCatalogue(c: CatalogueSeva[]): CatalogueIndex;
export function initialCounterState(today: string): CounterState;
export function counterReducer(cat: CatalogueIndex, counterDaysAhead: number): (s: CounterState, a: CounterAction) => CounterState;
export function selectGroups(s: CounterState): GroupResult;
export type SaveBlock = 'no_name' | 'no_lines' | 'group_error' | 'reason_missing' | 'amount_missing' | 'upi_incomplete' | 'cash_short' | 'large_cash_unconfirmed' | 'submitting';
export function selectCanSave(s: CounterState): { ok: true } | { ok: false; block: SaveBlock };
// keyboard.ts
export type KeyZone = 'name' | 'field' | 'search' | 'tiles' | 'pay' | 'other';
export function resolveKey(e: { key: string; ctrlKey: boolean; altKey: boolean; zone: KeyZone }, s: CounterState, now: number):
  CounterAction | { type: 'save' } | { type: 'focusNext' } | null;
// payload.ts
export function buildCounterOrderPayload(s: CounterState, ids: { clientOrderId: string; clientReceiptIds: string[]; qrTokens: string[] }): CounterOrderPayload;
export function profileToDraft(p: { name: string; gotra?: string; gotraId?: number; nakshatraId?: number; rashiId?: number; phoneLast4?: string }): DevoteeDraft;
```

- [ ] **Step 1: Write the failing tests**

```ts
it('adds the seva whose counter key is pressed on the tile grid')     // resolveKey({ key: '2', zone: 'tiles' }) -> addByKey 2 -> line for display_order 2
it('adds by typed number or code from the search box with Enter')     // search 'PA' + Enter -> Paaduka; '3' + Enter -> key 3
it('moves to step 3 on Enter with an empty search')
it('jumps steps with Alt+1, Alt+2, Alt+3')
it('clears the order on Esc twice within 2 seconds only')             // escape at 0 and 1500 -> reset; 0 and 2500 -> not reset
it('defaults a new line to today and refuses past dates')
it('allows several dates only on multi-date sevas')
it('needs a reason for a changed amount and a typed amount for any-amount sevas') // selectCanSave -> reason_missing / amount_missing
it('needs six UPI digits and the tick before saving')                // upi_incomplete
it('blocks when cash received is below the total')                    // cash_short
it('asks to confirm cash of Rs 2,00,000 or more')                     // large_cash_unconfirmed until confirmLargeCash (C-54)
it('save is ignored while a submit is in flight')                     // after submitStarted, resolveKey(Ctrl+Enter) -> null and selectCanSave -> submitting
it('builds a payload grouped by date with unitRatePaise only on changed or any-amount lines')
it('puts the expected total in the payload')                          // expectedTotalPaise 82000 for the book example
it('fills step 1 from a returning devotee and can undo it')           // applyProfile then setDevotee back
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/counter-state.test.ts tests/unit/seva/counter-keyboard.test.ts tests/unit/seva/counter-payload.test.ts`.

- [ ] **Step 3: Implement** the three modules with the signatures above (no React, no I/O).

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add lib/seva/counter tests/unit/seva
git commit -m "feat(seva): add the counter order reducer, key map and payload builder"
```

### Task A2-6: Offline engine - IndexedDB, device credentials, OF allocator, outbox, submitter, sync, heartbeat

Tier: **Opus xhigh** - audit-critical numbering across tabs and network failures (D12, DB §8.3, §8.6, §9.11).

**Files:**
- Create: `lib/seva/offline/db.ts`, `device.ts`, `allocator.ts`, `outbox.ts`, `submitter.ts`, `sync.ts`, `heartbeat.ts`, `connection.ts`, `profiles.ts`, `local-receipts.ts`
- Test: `tests/unit/seva/offline-allocator.test.ts`, `offline-outbox.test.ts`, `offline-submitter.test.ts`, `offline-sync.test.ts`, `offline-profiles.test.ts` (each starts with `import 'fake-indexeddb/auto'`)

**Interfaces:**
- Consumes: `formatReceiptNo`, `formatOfflineGroupNo`, `istParts`, `businessDate` (A1-2); wire types (A1-3); `SevaClientError` shape (A2-4 - injected through `deps.api`, not imported).
- Produces:
```ts
// db.ts - database 'seva-counter', version 1
export interface SevaDbSchema extends DBSchema { meta: { key: string; value: unknown }; outbox: { key: number; value: OutboxItem };
  today: { key: string; value: IssuedReceipt & { businessDate: string; sent: boolean }; indexes: { byDate: string } };
  catalogue: { key: 'current'; value: CounterBootstrap }; profiles: { key: string; value: CachedProfile }; files: { key: string; value: FileSystemDirectoryHandle } }
export function openSevaDb(): Promise<IDBPDatabase<SevaDbSchema>>;
// device.ts
export function newDeviceSecret(): string;                                          // 32 random bytes, base64url
export async function sha256HexBrowser(text: string): Promise<string>;              // crypto.subtle
export async function getDeviceCredentials(db): Promise<{ deviceId: string; secret: string } | null>;
export async function saveDeviceCredentials(db, c: { deviceId: string; secret: string }): Promise<void>;
export function deviceHeader(c: { deviceId: string; secret: string }): string;     // '<deviceId>.<secret>'
// allocator.ts - one readwrite transaction on meta key `of:<series>:<year>` so two tabs never share a number
export async function takeOfflineNumbers(db, p: { series: string; year: number; count: number }): Promise<number>; // first running no.
export async function raiseOfflineFloor(db, p: { series: string; year: number; serverLastNo: number }): Promise<void>;
export async function takeOfflineGroupNo(db, p: { yymm: string; series: string }): Promise<string>;
// outbox.ts
export async function enqueueOrder(db, payload: OfflineOrderPayload): Promise<number>;
export async function enqueueCancel(db, c: Omit<Extract<OutboxItem, { kind: 'cancel' }>, 'seq'>): Promise<number>;
export async function pendingItems(db): Promise<OutboxItem[]>; export async function markSent(db, seq: number): Promise<void>;
export async function pendingCount(db): Promise<number>;
// submitter.ts - the one non-obvious algorithm in this task
export type SubmitResult = { mode: 'online' | 'offline'; receipts: IssuedReceipt[] } | { mode: 'cancelled' };
export function createCounterSubmitter(deps: { db; api: { issue(p: CounterOrderPayload): Promise<IssueResponse> };
  clock: () => Date; askPrintOffline: () => Promise<boolean>; staff: () => { name: string; staffNo: number };
  counter: () => { name: string; offlineSeries: string }; catalogue: () => CounterBootstrap;
  isForcedOffline: () => boolean; newIds: () => { clientOrderId: string } }): { submit(p: CounterOrderPayload): Promise<SubmitResult> };
// sync.ts / heartbeat.ts / connection.ts / profiles.ts / local-receipts.ts
export async function runSync(deps: { db; api: { sync(items: OutboxItem[]): Promise<SyncResponse> } }): Promise<{ sent: number; refused: { seq: number; code: string }[]; stoppedBy: 'network' | null }>;
export function startHeartbeat(deps: { api: { heartbeat(b: { outboxCount: number; clockSkewMs: number; appVersion: string }): Promise<{ serverTime: string; ofSeries: string; lastOfNo: number; dayClosed: boolean }> };
  db; clock: () => Date; intervalMs?: number; onResult(r: { skewMs: number; dayClosed: boolean }): void }): () => void;   // 60 s default
export interface ConnectionState { status: 'online' | 'offline'; since: string | null; waiting: number; forced: boolean }
export const connectionStore: { get(): ConnectionState; subscribe(fn: (s: ConnectionState) => void): () => void;
  setForcedOffline(on: boolean): void; markOnline(): void; markOffline(at: Date): void; setWaiting(n: number): void };
export interface CachedProfile { phoneHash: string; phoneLast4: string; name: string; gotra?: string; gotraId?: number; nakshatraId?: number; rashiId?: number; lastSeen: string }
export async function cacheProfile(db, p: Omit<CachedProfile, 'phoneHash' | 'phoneLast4'> & { phoneE164: string }): Promise<void>; // salted SHA-256, salt per device in meta
export async function findProfiles(db, q: { name?: string; phoneE164?: string }): Promise<CachedProfile[]>;
export async function rememberReceipts(db, receipts: IssuedReceipt[], sent: boolean): Promise<void>;
export async function todaysReceipts(db, businessDate: string): Promise<IssuedReceipt[]>;
export async function pruneClosedDays(db, beforeDate: string): Promise<void>;     // only receipts already sent
```
Submit algorithm:
```text
if isForcedOffline() -> goOffline(no supersede)
try api.issue(p) with a 6000 ms timeout; on 'timeout' | 'network' | status >= 500 retry the SAME clientOrderId twice more
  success -> mark online, rememberReceipts(sent = true), return online
  SevaClientError with status 400-499 -> rethrow (never print offline for a business error)
after 3 failures -> if await askPrintOffline() is false -> return cancelled
goOffline: new clientOrderId; supersedesClientOrderId = old id (only when an online attempt was made);
  first = takeOfflineNumbers(series, IST year of clock(), receipts.length); groupNo = takeOfflineGroupNo(yymm of clock());
  build IssuedReceipt[] locally (formatReceiptNo with IST month/year of clock(), cached rates, cachedRatePaise per line);
  enqueueOrder; rememberReceipts(sent = false); markOffline; return offline
```

- [ ] **Step 1: Write the failing tests**

```ts
it('two tabs never get the same offline number')               // Promise.all of two takeOfflineNumbers(count 2) -> first numbers 1 and 3 (in some order)
it('raises the floor to the server number but never lowers it')
it('offline numbers take month and year from the PC clock in IST') // clock 2026-12-31T18:31:00Z -> 'OF1-023-01-2027/000001'
it('saves online when the office answers')
it('retries the same client order id twice on timeout, then asks to print offline') // api.issue called 3 times with one clientOrderId
it('prints offline with OF numbers and records what it supersedes')                 // outbox has 1 order with supersedesClientOrderId
it('returns cancelled and queues nothing when the receptionist says no')
it('business errors never fall back to offline')                // api throws { status: 409, code: 'price_changed' } -> submit rejects; outbox empty
it('goes straight to offline when Work offline is on')          // api.issue never called; no supersede
it('sends the outbox in order and stops at a network error')    // runSync with items 1..3, network fails on 2 -> sent 1, stoppedBy 'network'
it('treats a duplicate answer as sent')
it('heartbeat raises the offline floor and reports clock skew')
it('never stores a plain phone number in the profile cache')    // read raw IDB record: no field equals '+919845012345'; phoneLast4 '2345'
it('finds cached profiles by name prefix and by phone')
it('keeps unsent receipts when pruning a closed day')
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/offline-`.

- [ ] **Step 3: Implement** with `idb`; all randomness from `crypto.getRandomValues`; no React.

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add lib/seva/offline tests/unit/seva
git commit -m "feat(seva): add the counter's offline engine - outbox, OF numbers, submitter, sync and heartbeat"
```

### Task A2-7: Export builders - CSV, Tally, zip, Excel workbooks (pure)

Tier: **Opus medium** - shapes pinned by DB §12.6 and the tests.

**Files:**
- Create: `types/seva-export.ts`, `lib/seva/export/columns.ts`, `lib/seva/export/csv.ts`, `lib/seva/export/tally.ts`, `lib/seva/export/zip.ts`, `lib/seva/excel/workbook.ts`
- Test: `tests/unit/seva/export-csv.test.ts`, `export-tally.test.ts`, `excel-workbook.test.ts` (`@jest-environment node`)

**Interfaces:**
- Consumes: `formatRupees`, `fromPaise` (A1-2).
- Produces:
```ts
// types/seva-export.ts
export interface ExportReceiptRow { receiptNo: string; series: string; date: string; time: string; devoteeName: string; sevas: string;
  amountPaise: number; mode: PaymentMode; status: 'issued' | 'cancelled'; gotra: string; nakshatra: string; rashi: string;
  sevaCodes: string; upiRefLast6: string; issuedBy: string; prasadam: 'none' | 'pending' | 'given'; changed: boolean;
  cancelReason: string; incomeLedgers: { ledger: string; amountPaise: number }[]; phone?: string }
export interface ExportLineRow { receiptNo: string; series: string; date: string; sevaCode: string; sevaName: string; quantity: number;
  unitRatePaise: number; amountPaise: number; mode: PaymentMode; status: 'issued' | 'cancelled'; incomeLedger: string; phone?: string }
export interface ExportData { range: { from: string; to: string; label: string }; preparedBy: string; preparedAt: string;
  summary: { label: string; value: string }[]; receipts: ExportReceiptRow[]; lines: ExportLineRow[];
  sevas: { name: string; count: number; amountPaise: number; lastYearCount: number | null; lastYearAmountPaise: number | null }[];
  cancelledChanged: ExportReceiptRow[]; dayCloses: Record<string, string | number>[]; prasadam: Record<string, string | number>[];
  rateChanges: { seva: string; oldPaise: number | null; newPaise: number; reason: string; by: string; at: string }[] }
// builders
export const RECEIPT_COLUMNS: readonly string[];   // Receipt no., Series, Date, Time, Devotee, Seva(s), Amount, Mode, Status, Gotra, Nakshatra, Rashi, Seva code, UPI ref (last 6), Issued by, Prasadam [, Phone]
export function receiptSheetRows(rows: ExportReceiptRow[], opts: { includePhones: boolean }): (string | number)[][];
export function buildCsv(header: readonly string[], rows: (string | number)[][]): string;   // RFC 4180, CRLF, UTF-8 BOM
export function lineCsv(rows: ExportLineRow[], opts: { includePhones: boolean }): string;   // receipt_no, series, date, seva_code, amount, mode, status, ...
export interface TallyLedgers { cash: string; upi: string; online: string }
export interface TallyColumnNames { date: string; type: string; number: string; ledger: string; amount: string }
export function tallyRows(rows: ExportReceiptRow[], ledgers: TallyLedgers, cols?: Partial<TallyColumnNames>): string[][];
export function zipFiles(files: { name: string; content: string | Uint8Array }[]): Uint8Array;  // fflate zipSync
export async function buildExportWorkbook(data: ExportData, opts: { includePhones: boolean }): Promise<ArrayBuffer>;
export async function buildDayWorkbook(rows: ExportReceiptRow[], meta: { date: string; counterName: string }): Promise<ArrayBuffer>;
```
Decision on Tally (DB §12.6 gives "two lines per receipt"): one debit line for the receipt total on the cash, UPI or online ledger, then one credit line per distinct income ledger on that receipt (a one-seva receipt is exactly two lines). Default income ledger name `Seva Income - <seva name>` (C-55).

- [ ] **Step 1: Write the failing tests**

```ts
it('quotes commas, quotes and new lines, keeps Kannada and starts with a BOM')   // 'Rao, "Venkatesh"\n' -> "\"Rao, \"\"Venkatesh\"\"\n\""
it('leaves the phone column out unless includePhones')
it('writes Tally lines: debit cash, credit the seva income ledger')              // 610 cash -> ['18-10-2026','Receipt','C1-023-10-2026/000124','Cash','610.00'] then [...,'Seva Income - Paaduka Pooja','-610.00']
it('writes one credit per income ledger on a multi-seva receipt')
it('leaves cancelled receipts out of Tally and applies custom column names')
it('builds the export workbook with the seven sheets in order')                // reload with exceljs: ['Summary','Receipts','Sevas','Cancelled and changed','Day closes','Prasadam','Rate changes']
it('round-trips a Kannada devotee name through xlsx')
it('builds the day workbook with Summary and Receipts sheets')
it('zips several CSV parts')                                                   // fflate unzipSync -> names and contents match
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/export-csv.test.ts tests/unit/seva/export-tally.test.ts tests/unit/seva/excel-workbook.test.ts`.

- [ ] **Step 3: Implement**; amounts in sheets as numbers with two decimals; dates as text `DD-MM-YYYY` (Tally) and real dates in xlsx.

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add types/seva-export.ts lib/seva/export lib/seva/excel/workbook.ts tests/unit/seva
git commit -m "feat(seva): add CSV, Tally, zip and Excel workbook builders"
```

### Task A2-8: Nightly encrypted backup and monthly maintenance workflows

Tier: **Opus xhigh** - the backup holds every devotee's details; secret handling and encryption must be right (D9, DB §16.1, C-57, C-64).

**Files:**
- Create: `.github/workflows/seva-backup.yml`, `.github/workflows/seva-maintenance.yml`, `scripts/seva/backup.sh`, `scripts/seva/verify-backup.sh`
- Test: `tests/unit/seva/workflows.test.ts`

**Interfaces:**
- Consumes: `ops_backup_runs` (A1-1), `seva_purge_devotee_profiles()` (A2-3, called by name).
- Produces: repository secrets the owner sets (names only): `SEVA_BACKUP_DB_URL` (Supabase *session* pooler connection string, port 5432 - the transaction pooler cannot run `pg_dump`), `SEVA_BACKUP_AGE_RECIPIENT` (the `age` public key; the private key stays offline with the owner, O-15).

Decisions:
- `seva-backup.yml`: `on: schedule: cron '0 21 * * *'` (02:30 IST) and `workflow_dispatch`; `permissions: contents: read`; ubuntu-latest; install `age` and the PostgreSQL client whose major version equals the server's (`psql -Atc 'show server_version_num'` with the default client first, then install `postgresql-client-<major>` from the PGDG apt repository); run `scripts/seva/backup.sh`; upload `seva-<YYYY-MM-DD>.dump.age` and its `.sha256` with `retention-days: 30`; on the 1st of the month upload a second artifact `seva-monthly-<YYYY-MM>` with `retention-days: 90` (the most GitHub allows on default settings; the 12-month destination of C-57 stays UNCLEAR for the owner).
- `backup.sh`: `set -euo pipefail` (never `set -x`); `pg_dump --format=custom --no-owner --no-privileges "$SEVA_BACKUP_DB_URL" | age -r "$SEVA_BACKUP_AGE_RECIPIENT" > file`; size and SHA-256; insert one `ops_backup_runs` row (started, finished, ok, bytes, sha256, error) in an `if: always()` step so failures are recorded too. Secrets only through `env:`; never echoed.
- `verify-backup.sh <file> <identity-file>`: decrypt with `age -d -i` and run `pg_restore --list`; prints only counts (for the owner's restore drill, SETUP-GUIDE B8).
- `seva-maintenance.yml`: `cron '30 21 1 * *'` (03:00 IST on the 1st) runs `psql "$SEVA_BACKUP_DB_URL" -c "select seva_purge_devotee_profiles();"`.

- [ ] **Step 1: Write the failing tests** (read the files as text)

```ts
it('runs the backup at 02:30 IST and on demand')            // contains "cron: '0 21 * * *'" and 'workflow_dispatch'
it('runs the monthly purge on the 1st')                    // "cron: '30 21 1 * *'" and 'seva_purge_devotee_profiles()'
it('grants read-only repository permissions')               // 'contents: read'; no 'contents: write'
it('never traces or echoes secrets')                        // no 'set -x'; no line with 'echo' and '${{ secrets.' or '$SEVA_BACKUP'
it('encrypts a custom-format dump with age')               // backup.sh contains '--format=custom' and 'age -r'
it('records failed runs too')                              // workflow has an 'if: always()' step that writes ops_backup_runs
it('keeps daily copies 30 days and monthly copies 90 days')
it('scripts parse as bash')                                // when `bash` is on PATH: bash -n exits 0 for both scripts (skip with a logged reason otherwise)
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/workflows.test.ts`.

- [ ] **Step 3: Implement** the two workflows and two scripts.

- [ ] **Step 4: Run them and see them pass.**

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/seva-backup.yml .github/workflows/seva-maintenance.yml scripts/seva/backup.sh scripts/seva/verify-backup.sh tests/unit/seva/workflows.test.ts
git commit -m "feat(seva): add nightly encrypted database backup and monthly devotee-profile purge"
```

### Task A2-9: Owner SETUP-GUIDE (Plan A sections)

Tier: **Opus high** - a document from a brief, written for someone who has never used these platforms; needs current vendor screens checked on the web.

**Files:**
- Create: `docs/seva/SETUP-GUIDE.md`
- Test: `tests/unit/seva/setup-guide.test.ts`

**Interfaces:**
- Consumes: env and secret names from A2-8 and the stack (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `SEVA_BACKUP_DB_URL`, `SEVA_BACKUP_AGE_RECIPIENT`, `NEXT_PUBLIC_SITE_URL`).
- Produces: sections with these exact headings (Plans B and C append theirs):
  `## 0. How to use this guide`, `## 1. Supabase test project for the build`, `## 2. Vercel access and settings`, `## 3. Revoke the old Firebase key`, `## 4. Backup secrets and the age key`, `## 5. Restore drill (once a month)`, `## 6. Local database tests need no set-up`, `## 7. The counter PC`, `## 8. Cashfree test account (Phase 2)` (placeholder line "Written in Plan B"), `## 9. Expo account (Android app)` (placeholder line "Written in Plan C").

Writing rules (put them in section 0 too): **before writing each platform section, open the vendor's current documentation on the web and cite each source as `(source: <URL>, checked 2026-MM-DD)`**; any step you could not confirm is marked `UNVERIFIED`; one action per numbered step; button and menu names in bold exactly as on screen; after each important step, a line "You should now see ...". Never ask the owner to paste a secret into chat or into git; secrets go into Vercel, GitHub secrets or the PC's git-ignored files only.

Content decisions: section 1 - create a *separate* Supabase project for the build (region Mumbai `ap-south-1`, O-16), keep the live project untouched, apply migrations with the Supabase CLI against that project ref from the PC, note the current database size (O-17); section 2 - add the builder to the Vercel team, add env names per environment, check the function region (O-16) and the Hobby plan's non-commercial terms; section 3 - Google Cloud console: IAM, Service accounts, Keys, delete the old key id, create a new key saved as `.firebase-adminsdk.json` in the repo folder (git-ignored) and as GitHub/Vercel secret `FIREBASE_SERVICE_ACCOUNT_JSON` where scripts need it (O-18); section 4 - install `age` on Windows, `age-keygen -o seva-backup-key.txt`, put the public key in GitHub secret `SEVA_BACKUP_AGE_RECIPIENT`, store the key file offline on two USB drives, add `SEVA_BACKUP_DB_URL` (O-15); section 5 - download the latest artifact, run `scripts/seva/verify-backup.sh`; section 6 - PGlite runs inside Node, no Docker and no account; section 7 - printer custom paper 99 x 210 mm on the bypass tray as the Windows default (O-05), kiosk shortcut `msedge.exe --kiosk-printing --app=https://<site>/admin/receipts/counter` (O-07), install the app, register the PC, choose the Excel folder (O-08), Windows password and BitLocker (O-09).

- [ ] **Step 1: Write the failing test**

```ts
it('has the ten sections in order')              // exact headings above
it('cites a checked vendor source in sections 1 to 4') // each section body matches /\(source: https?:\/\/[^)]+, checked 2026-\d\d-\d\d\)/
it('contains no secret material')               // no 'PRIVATE KEY', no 'AGE-SECRET-KEY', no 'eyJ' (JWT prefix)
it('names no office company or its theme')       // case-insensitive check against the boundary words in RULES.md
```

- [ ] **Step 2: Run it and see it fail**: `npx jest tests/unit/seva/setup-guide.test.ts`.

- [ ] **Step 3: Research each platform's current screens, then write the guide.**

- [ ] **Step 4: Run it and see it pass.**

- [ ] **Step 5: Commit**

```bash
git add docs/seva/SETUP-GUIDE.md tests/unit/seva/setup-guide.test.ts
git commit -m "docs(seva): add the owner's step-by-step setup guide (Supabase, Vercel, key revocation, backups, counter PC)"
```

### Task A2-10: Chart foundation - ECharts wrapper, colour tokens, option builders

Tier: **Opus medium** - R5 fixes the library and rules; option shapes are pinned by tests.

**Files:**
- Create: `components/charts/EChart.tsx`, `lib/seva/charts/register.ts`, `lib/seva/charts/colors.ts`, `lib/seva/charts/options.ts`
- Test: `tests/unit/seva/chart-options.test.ts`, `tests/unit/seva/chart-colors.test.ts`

**Interfaces:**
- Consumes: `formatRupees` (A1-2), `Period` (A1-2), `Bilingual` (A1-6), the `--chart-1..5` tokens in `styles/seva/tokens.css` (A1-6).
- Produces:
```ts
// components/charts/EChart.tsx ("use client"; pages load it with next/dynamic { ssr: false })
export default function EChart(p: { option: EChartsCoreOption; height: number; title: { en: string; kn?: string }; asOf: string;
  table: { caption: string; columns: string[]; rows: (string | number)[][] } }): JSX.Element;
// renders the bilingual title, the chart (SVG renderer), 'as of HH:MM', and a visually hidden <table> with the same data;
// re-renders on resize and on prefers-reduced-motion / theme changes
// lib/seva/charts/register.ts - echarts/core with BarChart, LineChart, PieChart, HeatmapChart, TreemapChart and the
// Grid, Tooltip, Legend, VisualMap, Calendar, Dataset components, SVGRenderer - nothing else
export function readChartColors(el: HTMLElement): string[];   // --chart-1..5 -> 'rgb(r, g, b)' via a 1x1 canvas (ECharts cannot read oklch)
type Opts = { colors: string[]; reducedMotion: boolean };
export function heroOption(d: DashboardData['hero'], o: Opts): EChartsCoreOption;          // stacked bars cash/UPI/online + dashed grey previous line
export function topSevasOption(d: { rows: { name: string; value: number; prev: number }[]; metric: 'amount' | 'count' }, o: Opts): EChartsCoreOption;
export function modeOption(d: DashboardData['mode'], period: Period, o: Opts): EChartsCoreOption;  // donut for today/week, 100% bars for month/year
export function rushOption(d: DashboardData['rush'], o: Opts): EChartsCoreOption;          // hour x weekday heatmap
export function calendarOption(d: { year: number; days: DashboardData['calendar']; festivals: string[] }, o: Opts): EChartsCoreOption;
export function treemapOption(d: { categories: { name: string; children: { name: string; value: number }[] }[] }, o: Opts): EChartsCoreOption;
export function festivalBarsOption(d: { days: { label: string; thisYear: number; compareYear: number | null }[] }, o: Opts): EChartsCoreOption;
```
(`DashboardData` from `types/seva-reports.ts` is created by A2-3 in this same wave: declare these input shapes locally in `options.ts` with the same field names, and switch to the shared type in A4-6.)

- [ ] **Step 1: Write the failing tests**

```ts
it('hero has three stacked bar series and one dashed previous-period line')
it('tooltips trigger on mousemove and click and stay inside the chart')   // tooltip.triggerOn 'mousemove|click', confine true
it('labels are at least 13 px')                                          // every axisLabel/label fontSize >= 13
it('tooltip amounts use Indian grouping')                                 // formatter output contains 'Rs 1,00,000'
it('turns animation off for reduced motion')
it('uses a donut for today and week, 100% bars for month and year')
it('reads chart colours as rgb from the tokens')                          // mocked canvas getImageData -> 'rgb(201, 150, 40)'
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/chart-options.test.ts tests/unit/seva/chart-colors.test.ts`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add components/charts/EChart.tsx lib/seva/charts tests/unit/seva
git commit -m "feat(seva): add the ECharts wrapper, colour tokens and chart option builders"
```

### Task A2-11: Receipt slip and print engine

Tier: **Opus high** - the printed record; content order and privacy rules are exact (DB §10).

**Files:**
- Create: `lib/seva/print/slip-model.ts`, `lib/seva/print/printSlips.ts`, `components/seva/slip/ReceiptSlip.tsx`, `components/seva/slip/SlipQr.tsx`, `components/seva/slip/PrintRoot.tsx`, `styles/seva/print.css`
- Test: `tests/unit/seva/slip-model.test.ts`, `tests/unit/seva/slip.test.tsx`

**Interfaces:**
- Consumes: `amountInWords`, `formatRupees`, `formatSevaDate`, `receiptQrUrl` (A1-2); `IssuedReceipt`, `SlipSettings`, `COMMON` strings (A1-3); `Bilingual` (A1-6).
- Produces:
```ts
export interface SlipModel { header: { nameEn: string; nameKn: string; address: string[]; registration: string | null; photoLeft: string | null; photoRight: string | null };
  duplicate: { at: string; byStaffNo: string } | null; receiptNo: string; issuedLine: string; sevaDateLine: string;
  groupLine: string | null; devotee: { label: { en: string; kn: string }; value: string; valueKn?: string }[];
  lines: { nameEn: string; nameKn: string | null; qtyRate: string; amount: string; changed: boolean }[];
  total: string; totalWords: string; paymentLine: string; qrUrl: string; prasadamLine: { en: string; kn: string; date: string } | null;
  issuedBy: string; footer: string[]; blessing: string }
export function toSlipModel(r: IssuedReceipt, s: SlipSettings, opts: { siteUrl: string; reprint?: { at: Date; byStaffNo: number } }): SlipModel;
export function ReceiptSlip(p: { model: SlipModel }): JSX.Element;      // DB §10.1 order, class 'slip'
export function SlipQr(p: { url: string }): JSX.Element;                // qrcode SVG, errorCorrectionLevel 'M', margin 4 modules, 26 mm square
export function PrintRoot(): JSX.Element;                               // portal target #seva-print-root, visible only in @media print
export async function printSlips(models: SlipModel[]): Promise<void>;   // render into PrintRoot, await document.fonts.ready and every <img>, window.print();
                                                                        // the root is cleared on the window 'afterprint' event or at the start of the next print (so tests can render it to PDF)
```

- [ ] **Step 1: Write the failing tests**

```ts
it('builds the group line for 1 of 3')               // 'Paid together - 1 of 3 - group G-2610-0042'
it('makes the seva date the big line')               // sevaDateLine 'Sat 28 Aug 2027'
it('writes the total in words')                      // 'Rupees Six Hundred Ten only'
it('describes cash for a group and UPI by its last six digits') // 'Paid in cash - Rs 820 together for 3 receipts'; 'Paid by UPI - ref ending 119042'
it('leaves rashi out unless print_rashi is on')
it('slip never contains the phone')                  // render with a receipt whose order had a phone: textContent has no '9845012345' and no '2345' run; SlipModel has no phone field
it('marks a changed line')                           // lines[i].changed true and the rendered row carries the 'Changed' marker
it('shows the DUPLICATE band only on a reprint')     // 'DUPLICATE' and 'ನಕಲು' plus 'Reprinted <date time> by 023'
it('drops the prasadam line but keeps the QR when no seva gives prasadam')
it('encodes the /r/<token> URL with error correction M') // mock qrcode; called with ('https://site.example/r/<token>', { errorCorrectionLevel: 'M', margin: 4 })
it('prints the English temple name before the Kannada one')
it('issued-by line names the counter or the online channel') // 'Issued by: Ramesh (023) - Counter 1'
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/slip-model.test.ts tests/unit/seva/slip.test.tsx`.

- [ ] **Step 3: Implement**; `print.css` holds the exact slip CSS from **Global Constraints** and the type sizes; match `counter.html#receipt` (`rcpt-original`).

- [ ] **Step 4: Run them and see them pass**, then `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add lib/seva/print components/seva/slip styles/seva/print.css tests/unit/seva
git commit -m "feat(seva): add the 99 x 210 mm receipt slip and the print engine"
```

### Task A2-12: Browser test harness - Firebase emulators, seva Playwright config, fake API

Tier: **Opus high** - test infrastructure that every UI task depends on; judgement on a stateful fake.

**Files:**
- Modify: `firebase.json` (add `"emulators": { "auth": { "port": 9099 }, "firestore": { "port": 8080 }, "ui": { "enabled": false }, "singleProjectMode": true }`), `lib/firebase.ts` (when `process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1"`, call `connectAuthEmulator(auth, 'http://127.0.0.1:9099')` and `connectFirestoreEmulator(db, '127.0.0.1', 8080)` once)
- Create: `tests/e2e/seva/playwright.config.ts`, `tests/e2e/seva/global-setup.ts`, `tests/e2e/seva/fixtures/auth.ts`, `tests/e2e/seva/fixtures/fake-api.ts`, `tests/e2e/seva/fixtures/data.ts`, `tests/e2e/seva/smoke.spec.ts`
- Test: `tests/unit/seva/fake-api.test.ts`

**Interfaces:**
- Consumes: wire types (A1-3), error codes (A1-3).
- Produces:
```ts
// fixtures/auth.ts
export type E2ERole = 'receptionist' | 'prasadam_counter' | 'temple_admin' | 'temple_admin_view_only' | 'super_admin';
export const E2E_PASSWORD = 'Password-123';
export function e2eEmail(role: E2ERole): string;                      // `e2e-${role}@example.test`
export async function signInAs(page: Page, role: E2ERole): Promise<void>;   // drives the site's own email + password sign-in page
// fixtures/fake-api.ts - routes every /api/seva/** request of the page to an in-memory model
export interface FakeState { catalogue: CatalogueSeva[]; receipts: IssuedReceipt[]; lastNo: Record<string, number>; me: Record<E2ERole, SevaMe>;
  dashboard: unknown; settings: unknown; staff: unknown[]; dayClosed: boolean }
export interface FakeSevaApi { state: FakeState; requests: { method: string; path: string; body: unknown }[];
  install(page: Page): Promise<void>; failNext(pathPrefix: string, kind: 'timeout' | 'network' | { status: number; code: string }): void;
  setNow(iso: string): void; extend(handlers: Record<string, (req: { method: string; path: string; body: unknown }) => unknown>): void }
export function createFakeSevaApi(seed?: Partial<FakeState>): FakeSevaApi;
```
Config decisions: `testDir: '.'` (this folder), `webServer: { command: 'npm run dev -- -p 3100', port: 3100, env: { NEXT_PUBLIC_FIREBASE_EMULATORS: '1', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-seva', NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-key', NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-seva.firebaseapp.com', ...other NEXT_PUBLIC_FIREBASE_* as demo values }, reuseExistingServer: false, timeout: 180000 }`; projects `desktop` (Chrome, 1366 x 768) and `phone` (Pixel 5, 390 px wide, `testMatch: /(prasadam|dashboard).*\.spec\.ts/`); `globalSetup` creates the five accounts in the Auth emulator (REST `accounts:signUp` with key `demo-key`) and writes each `users/{uid}` doc (role, `isActive: true`; `temple_admin_view_only` gets role `temple_admin`) in the Firestore emulator (REST with header `Authorization: Bearer owner`). The fake implements every Phase 1 row of DB §6.5 with simple semantics: sequential numbers per series, idempotent `clientOrderId`, cancel, prints, prasadam states, day close, fixtures for reports, settings and staff. UI tasks add their own fixtures through `extend`, in their own files.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/seva/fake-api.test.ts - drive the fake's handler function directly (no browser)
it('issues sequential C1 numbers and repeats the same receipts for a repeated clientOrderId')
it('fails the next matching call once with the given kind')
it('records every request')
// tests/e2e/seva/smoke.spec.ts
test('a receptionist can sign in and open the admin shell', async ({ page }) => { /* signInAs(page, 'receptionist'); goto('/admin'); expect no page errors */ });
```

- [ ] **Step 2: Run them and see them fail**: `npx jest tests/unit/seva/fake-api.test.ts`.

- [ ] **Step 3: Implement** the config, setup, fixtures and the emulator hook.

- [ ] **Step 4: Run them and see them pass**: `npx jest tests/unit/seva/fake-api.test.ts`; then once `npm run test:e2e:seva -- smoke.spec.ts` - the one Playwright run allowed inside a task, because this task *is* the harness. Expected: 1 passed (Java 17 is present for the Firestore emulator).

- [ ] **Step 5: Commit**

```bash
git add firebase.json lib/firebase.ts tests/e2e/seva tests/unit/seva/fake-api.test.ts
git commit -m "test(seva): add the Firebase-emulator Playwright harness and the fake seva API"
```

**Wave A2 gate - owner's 10-minute checklist**
1. Read the A2 test report summary.
2. Open `docs/seva/SETUP-GUIDE.md` B3 and revoke the old Firebase key (about 5 minutes).
3. Read B6 (two keys, two holders; chosen 2026-10-19 on owner card `backup-who`).
4. Check five amount-in-words samples listed in the report (for example Rs 2,50,005 -> "Rupees Two Lakh Fifty Thousand Five only").

---

Waves A3, A4 and A5 and the self-review continue in `2026-10-18-seva-entry-plan-A-phase1-part2.md` (the plan was split by wave because it is longer than 2,200 lines).

END OF REPORT
