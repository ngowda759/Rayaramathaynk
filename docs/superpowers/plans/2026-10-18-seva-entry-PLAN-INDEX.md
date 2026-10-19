# Seva Entry - build plan index

Written 2026-10-18 (Sunday) from the signed Design Book (`.claude/state/seva/book/DESIGN-BOOK.md`, committed as `docs/seva/DESIGN-BOOK.md` in Task A0-1). Build order is the owner's: Plan A (Phase 1), then Plan B (Phase 2 website + Cashfree test mode), then Plan C (Android app).

## The plan files

| File | What it is |
|---|---|
| `2026-10-18-seva-entry-plan-A-phase1.md` | Plan A part 1 of 2, full detail: header, Global Constraints, Review Focus, how to run, file map, shared contracts, waves A0-A2 |
| `2026-10-18-seva-entry-plan-A-phase1-part2.md` | Plan A part 2 of 2, full detail: waves A3-A5 and the self-review. **Split by wave because Plan A passed 2,200 lines** (about 2,640 lines in all) |
| `2026-10-18-seva-entry-plan-B-phase2-web.md` | Plan B, full detail (detailed 2026-10-19 against the code at `f0f8aec`): header, Global Constraints, gateway facts to check, Review Focus, file map, shared contracts, waves B0-B3 (16 tasks), self-review and what changed from the outline. One file - about 1,250 lines, under the 2,200-line split point |
| `2026-10-18-seva-entry-plan-C-android.md` | Plan C outline, same level |

All paths inside the plans are relative to the worktree `D:/Onboarding/Repos/POCs/seva-entry` (branch `feature/seva-entry` off `main`, created in Task A0-1; the main checkout is never switched). Test reports and build notes go to `.claude/state/seva/test-reports/` and `.claude/state/seva/build/` (git-ignored).

## How the waves run

- Tasks inside a wave are independent and run in parallel, each in its own task worktree; a wave starts when every task of the previous wave is merged into `feature/seva-entry` and the wave gate passed. All npm packages for Plan A are installed once in A0-2 so no parallel task touches the lock file.
- After each task: only that task's tests, `npm run typecheck` and eslint on the changed files. The DB suite and Playwright run once per wave, at the gate (owner's run policy, D37).
- Each wave ends with `<wave>-TEST-REPORT.md` and a 10-minute owner checklist (in the plan at the end of each wave).

## Waves, tasks, dependencies and tiers

Tier key (complexity card): **S** = Sonnet, **M** = Opus medium, **H** = Opus high, **X** = Opus xhigh. Each task's one-line reason is next to its tier in the plan.

| Wave | Needs | Tasks (tier) | Gate |
|---|---|---|---|
| **A0** Setup (sequential) | - | A0-1 Worktree, branch, committed spec (S); A0-2 Install, baseline, all new packages, PGlite harness (H) | Baseline report; no owner checklist |
| **A1** Foundations | A0 | A1-1 Schema, guard triggers, base SQL helpers, seed (X); A1-2 Money, numbering, IST time, grouping, amount in words, QR tokens (M); A1-3 Nakshatra/rashi/gotra data, zod schemas, wire types, error codes (M); A1-4 Role allow-list, new roles, Firestore users-create rule (X); A1-5 Committed key out of scripts, public receipts leak, receipt page params (X); A1-6 Module tokens and shared UI controls (H) | Wave gate + **security gate** (Opus xhigh review of A1-4, A1-5, A1-1 RLS) + owner checklist |
| **A2** Core logic | A1 | A2-1 SQL issue/sync/prints/cancel/reissue (X); A2-2 SQL prasadam/devices/gaps/heartbeat/day close (H); A2-3 SQL catalogue/settings/staff/reports/attention (H); A2-4 Identity adapter, permission matrix, route guard, RPC, HTTP client (X); A2-5 Counter order engine (H); A2-6 Offline engine (X); A2-7 Export builders (M); A2-8 Nightly encrypted backup + monthly purge (X); A2-9 Owner SETUP-GUIDE (H); A2-10 Chart foundation (M); A2-11 Slip and print engine (H); A2-12 Playwright + Firebase emulator harness, fake API (H) | Wave gate (first Playwright smoke) + owner checklist |
| **A3** API and shell | A2 | A3-1 Counter routes (H); A3-2 Receipt, devotee, prasadam, gap routes (H); A3-3 Day-close and report routes (M); A3-4 Catalogue and settings routes + Firestore mirror (M); A3-5 Staff routes + legacy user routes + first super admin (X); A3-6 Module shell, navigation, role landing (H); A3-7 Counter Excel copy, service worker, manifest (H) | Wave gate + **security gate** (Opus xhigh review of every `/api/seva/*` route against DB §3.3) + owner checklist |
| **A4** Screens | A3 | A4-1 Counter screens (H); A4-2 Today's receipts, cancel, reprint, spoiled (H); A4-3 Close day (M); A4-4 Receipt detail/print + public QR page (M); A4-5 Prasadam counter (H); A4-6 Dashboard (H); A4-7 Register, continuity, reports, day closes (H); A4-8 Export + board summary (M); A4-9 Settings: sevas, festivals, denominations (M); A4-10 Settings: receipt template, counters, devices, rules (H); A4-11 Staff and roles (H) | Wave gate + **owner gate**: the DB §19.2 10-minute checklist on a preview build |
| **A5** Switch-over and final | A4 (A5-3 after A5-1 and A5-2) | A5-1 Retire the Firestore Receipt Book code (H); A5-2 Documentation (H); A5-3 Final verification and whole-branch review (X) | Final report + **owner gate**: merge now or after Plan B |
| **B0** Setup (sequential) | A5 | B0-1 Gateway facts check + SETUP-GUIDE A4.1 and B9 (H); B0-2 Packages, env names, Postgres 15 test runner (M) | Report; no owner checklist beyond reading the facts summary |
| **B1** Core | B0 | B1-1 Payment tables and SQL functions (X); B1-2 Provider interface, Cashfree adapter, gateway mock (X); B1-3 Booking rules, schemas, wire types, error codes (M); B1-4 Payment orchestration with injected dependencies (X); B1-5 Google sign-in, CSP for Google and Cashfree, e2e devotee account (H) | Wave gate |
| **B2** API | B1 | B2-1 Devotee routes: catalogue, order, status, checkout, My seva bookings, booked before (X); B2-2 Payment webhook (X); B2-3 Payments page routes: status, refunds, fee rule, test payment (H); B2-4 Reconcile sweep on GitHub Actions (H); B2-5 Payment cards in Needs attention (M) | Wave gate + **security gate** (webhook signature, idempotency, amount and currency against the server's order, no client-trusted amounts, ownership, secrets) |
| **B3** Screens + e2e | B2 (B3-4 after B3-1 and B3-2) | B3-1 Website booking flow (H); B3-2 My seva bookings, e-receipts, old public receipts retired (M); B3-3 Admin Payments page (H); B3-4 Test-mode end to end, DB flow test, docs (H) | Wave gate + **owner gate** (10-minute test payment on the preview site) |
| **C0** Setup | B3 | C0-1 SETUP-GUIDE: Expo account and Android preview build (H) | - |
| **C1** Foundations | C0 | C1-1 Firebase email + password sign-in in the app (H); C1-2 Seva API client, catalogue through the API (M) | Wave gate |
| **C2** Screens | C1 | C2-1 Booking screens (H); C2-2 In-app checkout + deep-link return (H); C2-3 My bookings and e-receipts (M) | Wave gate |
| **C3** Verification | C2 | C3-1 App tests, EAS Android preview build, docs (H) | **Owner gate** (install the APK, pay in test mode) |

**Task count per wave:** A0 2, A1 6, A2 12, A3 7, A4 11, A5 3 (Plan A **41**: 1 S, 10 M, 21 H, 9 X); B0 2, B1 5, B2 5, B3 4 (Plan B **16**: 4 M, 7 H, 5 X - was 13 in the outline; see "Changed from the outline" at the end of Plan B); C0 1, C1 2, C2 3, C3 1 (Plan C **7**: 2 M, 5 H). Total **64**.

## Reviewer gates

- **Every task:** a spec-compliance review, then a code-quality review (superpowers:subagent-driven-development), at the implementer's tier or higher - a cheaper checker would confirm whatever it is shown (complexity card).
- **Security gates (Opus xhigh):** after A1 (allow-list, Firestore rule, key removal, RLS), after A3 (every seva route against the DB §3.3 matrix, device token, view-only), in A5-3 (whole branch), after B2 (webhook, devotee routes, refunds).
- **Owner gates:** after A4 (10-minute checklist), A5 (merge decision), B3 (test payment), C3 (APK). Before A5-3's full-stack smoke Nikhil gives an explicit go-ahead and supplies his own Supabase and Firebase test projects (SETUP-GUIDE A1, A2).
- A new failure at a wave gate gets a fix task (Opus high) before the next wave starts.

## Window estimate

**Calibration.** Step 1 (design: about 16 Opus agents producing heavy HTML) used about 17% of window 1 plus about 40% of window 2 = about 57% of one window, so about 3.6% of a window per Opus agent including orchestration. Build agents run more turns (tests, type checks), so a task's implementer is costed at: Sonnet 0.5%, Opus medium 2.5%, Opus high 4%, Opus xhigh 6%. Each task adds a review pair (1.2%) and orchestration (0.4%); fixes add 15% of the implementer cost; each wave gate costs 3-5% (5% when Playwright and the build run on UI waves); each security gate 2.5%. The range is -10% / +30% of the point estimate. The owner's window is roughly USD 300-440 of usage.

**Per wave** (percent of one 5-hour window = implementers + reviews + orchestration + fixes + gate + security gate):

| Wave | Tasks | Calculation | Estimate |
|---|---|---|---|
| A0 | 2 | 4.5 + 2.4 + 0.8 + 0.7 + 0 | 8% |
| A1 | 6 | 27.0 + 7.2 + 2.4 + 4.0 + 3 + 2.5 | 46% |
| A2 | 12 | 53.0 + 14.4 + 4.8 + 7.9 + 3 | 83% |
| A3 | 7 | 27.0 + 8.4 + 2.8 + 4.0 + 4 + 2.5 | 49% |
| A4 | 11 | 38.0 + 13.2 + 4.4 + 5.7 + 5 | 66% |
| A5 | 3 | 14.0 + 3.6 + 1.2 + 2.1 + 5 | 26% |
| **Plan A** | **41** | | **about 2.8 windows** (range 2.5-3.6), about USD 840-1,230 |
| B0 | 2 | 6.5 + 2.4 + 0.8 + 1.0 + 0 | 11% |
| B1 | 5 | 24.5 + 6.0 + 2.0 + 3.7 + 3 | 39% |
| B2 | 5 | 22.5 + 6.0 + 2.0 + 3.4 + 4 + 2.5 | 40% |
| B3 | 4 | 14.5 + 4.8 + 1.6 + 2.2 + 5 | 28% |
| **Plan B** | **16** | 68.0 + 19.2 + 6.4 + 10.2 + 12 + 2.5 = 118.3 | **about 1.2 windows** (range 1.05-1.55), about USD 355-520 (was 0.95 for the 13-task outline) |
| C0-C3 | 7 | 25.0 + 8.4 + 2.8 + 3.8 + 11 | **about 0.5 window** (range 0.45-0.7), about USD 150-225 |
| **All** | **64** | | **about 4.5 windows** (range 4.0-5.85), about USD 1,345-1,975 |

**How that maps onto real windows** (waves should not straddle a window when avoidable; A2's twelve tasks are independent and can be split):

| Build window | Work | Load |
|---|---|---|
| 1 | A0, A1, and about half of A2's tasks | ~95% |
| 2 | Rest of A2, A2 gate, A3 | ~90% |
| 3 | A4 part 1 (owner's split, DECISIONS 2026-10-19) | done |
| 4 | A4 part 2 (A4-6..A4-10), A4 gate and owner gate, A5 | per Plan A |
| 5 | Plan B waves B0, B1, B2 and the B2 security gate (Plan B already detailed, 2026-10-19) | ~90% |
| 6 | B3 and its owner gate (~28%), then Plan C (detail it first, ~3%; ~50%) | ~80% |

Rows 3-6 updated 2026-10-19 when Plan B was detailed (16 tasks instead of 13; Plan B no longer fits one window). So: **plan on six build windows, the sixth about four-fifths used**; the Design Book's earlier figure (Phase 1 about 2.5, Phase 2 about 1) was close for Phase 1 and low for Phase 2 because the app is now its own plan. The owner said more windows are fine (Design Book deck `cut-order`). Ask for the remaining percentage at every wave boundary (working style).

## Owner actions the build waits on

Two people (corrected 2026-10-19, GUIDE-FIX): **you** = Nikhil, who builds on his fork `nikhilmn01/Rayaramathaynk`
(remote `origin`) with his own new, empty, free accounts; **the site owner** (`ngowda759`, remote `upstream`), who holds
the live Vercel, Firebase and any live Supabase project and his repository's GitHub secrets. Changes reach the site owner
only through a pull request he merges. Nothing below assumes Nikhil can see or join any of the site owner's accounts.
Section ids are the rewritten SETUP-GUIDE's (its 0.4 maps the old numbers).

**You (test accounts)**

| When | Action | Guide |
|---|---|---|
| Now | Create your own Supabase account, organisation and `seva-test` project (Mumbai), push the tables, fill `.env.local` | SETUP-GUIDE A1 |
| Before the A4 owner gate | Your own Firebase test project (Spark): email sign-in (and Google for Plan B), Firestore, the site's rules, key file and `.env.local` | A2 |
| A4 owner gate | Check the screens with your own Supabase and Firebase test projects, either on this PC (`http://localhost:3000`, the builder starts it) or on your own Vercel preview of the fork (allow pushing `feature/seva-entry` to `origin`); staff 001 on the test projects | A3 |
| Before the A5-3 full-stack smoke | Your explicit go-ahead; the smoke uses your A1 and A2 test projects and your `.env.local` | A1, A2 |
| During Plan B waves B1-B2 (needed by the B3 owner gate, not before) | Your Cashfree test account; test keys and `PAYMENTS_PROVIDER`/`PAYMENTS_MODE` in **your** Vercel project's **Preview**; Protection Bypass for Automation on your Vercel project; Google sign-in on in **your** Firebase test project with your preview host authorised | A4.1 (written in B0-1) |
| B3 owner gate | Allow pushing `feature/seva-entry` to your fork for a preview; make the test payment, refund, Rs 1 test payment | A4.1; Plan B's B3 checklist |
| Before Plan C | Your Expo account | A4.2 (C0-1) |
| Go-live at the temple | The counter PC | A5 |

**Site owner (after merge)**

| When | Action | Guide |
|---|---|---|
| Right after merging Plan A | Apply the new Supabase tables on the live project (and note its size and region, O-16, O-17) | B1 |
| Right after merging | Publish the new Firestore rules on the live Firebase project | B2 |
| After merging, not before | Make a new Firebase key, put it in his GitHub secrets and Vercel, then revoke the old key (O-18) | B3 |
| After merging | Check the live Vercel names, function region and plan (O-16) | B4 |
| After B1-B4 | Make himself staff 001 on the live site | B5 |
| Before the first nightly backup | Choose who holds the `age` backup key (two keys, site owner only, or Nikhil only; USB or password manager) and make it (O-15) | B6 |
| After B6 | `SEVA_BACKUP_AGE_RECIPIENT` and `SEVA_BACKUP_DB_URL` as secrets on his repository; first backup run | B7 |
| Monthly, first before go-live | Restore drill (whoever holds a key) | B8 |
| After merging Plan B to `main` | `SEVA_CRON_SECRET` in his Vercel and as a secret on his repository, `SEVA_SITE_URL` as a variable (the 5-minute sweep runs only from `main`) | B9 (written in B0-1) |
| Before going live (Phase 2) | The temple's Cashfree account and activation papers, written answer on UPI charges, CA answers, Vercel plan (O-16: Hobby is non-commercial); live keys and `PAYMENTS_MODE=live` in his Vercel | B9 |

**Both / office**

| When | Action | Guide |
|---|---|---|
| Before go-live (not in these plans) | Office data O-01 to O-12, CA answers O-13, printer test O-05 to O-08 | Design Book §23 |

## Assumptions made while planning (for the owner to confirm or change)

1. The two new roles (receptionist, prasadam counter) reach only `/api/seva/*`, not the older `/api/admin/*` routes (least privilege; the book's wording "allow-list plus the two new ones" would have let a receptionist call admin routes such as set-role).
2. The public QR page `/r/<token>` is built in Plan A (A4-4), because Phase 1 slips already print that QR; the book listed it under Phase 2.
3. Three SQL signatures gain one parameter each (`seva_cancel_receipts` + `p_at` for offline cancels, `seva_reissue_spoiled` + `p_qr_token`, `seva_undo_prasadam` + `p_is_admin`), and helper functions are added for settings, staff, heartbeat, reports, IST parts and the profile purge.
4. QR tokens are made in TypeScript (server for online receipts, the PC for offline ones) from 16 secure random bytes, not in SQL, so offline and online tokens are identical in kind and no database extension is needed.
5. A gap filled by a late sync is closed with a new status `received_late` (the book's list had only open / entered from paper / declared lost).
6. An offline receipt printed at an older cached rate is stored at the printed rate with an audit note, and is not counted as a "changed amount" (C-58 says "flagged at sync" without saying how).
7. Tally export writes one debit line and one credit line per income ledger, so a receipt with two different sevas has three lines (the book says "two lines per receipt").
8. Module wording lives in per-area string files (`lib/seva/strings/*.ts`) rather than the shared i18n JSON, so parallel tasks do not collide.
9. The seva browser tests use their own Playwright config (`tests/e2e/seva/playwright.config.ts`) with the Firebase emulators and a `demo-` project, leaving the site's existing Playwright projects untouched.
10. A closed counter-day refuses new receipts until a temple admin reopens it; re-closing a reopened day updates the same close record.
11. The monthly backup copy is kept 90 days (the most GitHub keeps artifacts on default settings); the 12-month destination of C-57 is still open.
12. Background Sync is not used: a service worker has no sign-in token to send with, so the outbox sends on reconnect and every 30 s while the counter page is open.
13. The brief's phrase "the PGlite-free nothing" is read as: the guide tells the owner that local database tests need no account or set-up (SETUP-GUIDE section 6).
14. The old receipt list at `/admin/receipts` is replaced by the dashboard; its list moves to the new register (the book's 17.1), and the old Firestore pages are deleted in A5-1.
15. (A2-FIX, A2-FIX2, decided while building Wave A2) Offline work is recorded as the person who did it on the PC, not
    whoever is signed in when the outbox is sent: an offline order carries `issuerStaffNo`, an offline cancel
    `cancelledByStaffNo`; the syncer is kept separately (`seva_orders.synced_by_staff_id`; for a cancel, in its audit
    row). That person may be offboarded since (staff row `inactive`: accepted, audit `receipt.issuer_inactive_at_sync`);
    invited and deleted people and roles that may not use the counter are refused. `seva_sync_offline_order` gains
    `p_issuer_role` and `seva_cancel_receipts` gains `p_cancelled_by_staff_no` and `p_canceller_role`; the sync route
    reads those roles from Firestore. Offline cancels always follow the counter rule (own receipt, window measured to
    the cancel's recorded time).
16. (A2-FIX2) A spoiled print is reissued on the day it was issued only (an earlier day's slip gets a DUPLICATE
    reprint, which needs no new number), so the day close counts each payment once and the series has no hole.
17. (A2-FIX, A2-FIX2) Offline group labels never repeat after "Replace this PC": the heartbeat and the bootstrap return
    `lastOfGroupNo`, and the new PC gets a stored floor = the old PC's floor + the open `device_replaced` gap sizes
    (`counter_devices.of_group_floor_yymm/no`), so labels the dead PC printed but never sent stay free for its late
    upload.

## Plan B: assumptions and open questions (written 2026-10-19, for the owner to confirm or change)

- **U-1 Payer mobile for UPI.** Cashfree's create-order most likely needs a customer phone (check CF-3 in B0-1). The
  plan asks for a "mobile number for the UPI payment" on the review step, pre-filled from the devotee's phone, sent only
  to the gateway and never stored. The devotee's own phone on the receipt stays optional, as decided. If CF-3 shows the
  phone is optional, B1-3 makes `payerPhone` optional and the review step hides it.
- **U-2 One seva per online order, quantity 1 per date** (the mockup's "Rs 505 per date - Pay Rs 1,515"). Several sevas
  in one online payment is not built.
- **U-3 Online receipts do not create returning-devotee profiles** at the counter; "Booked before" reads only the
  account's own earlier orders (C-10).
- **U-4 "Send a test payment"** uses the refund right (temple admin or super admin, not view-only) instead of a new
  permission row; it works only in test mode and issues no receipt.
- **U-5 A failed refund has no "try again" button**: it is a critical card, and the runbook says to refund from the
  Cashfree dashboard and note it. A refund that never reached Cashfree (network) is retried by the sweep with the same
  reference.
- **U-6 Previews and payment alerts:** the site sends Cashfree its own alert address per order, built from Vercel's
  branch URL with the protection-bypass value (V-1, V-2); nothing is typed into Cashfree's webhook settings for tests.
- **U-7 The 5-minute sweep runs only from `main`** (GitHub schedules); on the preview, the return page and the Payments
  page re-check by themselves, so the B3 test does not need the sweep.
- **U-8 Vercel plan (O-16):** previews in test mode move no money; taking real payments on Hobby is outside Vercel's
  non-commercial terms, so the plan question returns at go-live (SETUP-GUIDE B9).
