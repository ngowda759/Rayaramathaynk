# Seva Entry - build plan index

Written 2026-10-18 (Sunday) from the signed Design Book (`.claude/state/seva/book/DESIGN-BOOK.md`, committed as `docs/seva/DESIGN-BOOK.md` in Task A0-1). Build order is the owner's: Plan A (Phase 1), then Plan B (Phase 2 website + Cashfree test mode), then Plan C (Android app).

## The plan files

| File | What it is |
|---|---|
| `2026-10-18-seva-entry-plan-A-phase1.md` | Plan A part 1 of 2, full detail: header, Global Constraints, Review Focus, how to run, file map, shared contracts, waves A0-A2 |
| `2026-10-18-seva-entry-plan-A-phase1-part2.md` | Plan A part 2 of 2, full detail: waves A3-A5 and the self-review. **Split by wave because Plan A passed 2,200 lines** (about 2,640 lines in all) |
| `2026-10-18-seva-entry-plan-B-phase2-web.md` | Plan B outline: task titles, files, interfaces, dependencies, test intent - detailed with superpowers:writing-plans at the start of its window |
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
| **B0** Setup | A5 | B0-1 SETUP-GUIDE: Cashfree test account, going live (H); B0-2 Package, env names, migration slots (S) | - |
| **B1** Core | B0 | B1-1 Payment tables and SQL functions (X); B1-2 Provider adapter + Cashfree + gateway mock (X); B1-3 Devotee booking rules (M) | Wave gate |
| **B2** API | B1 | B2-1 Devotee order/status/receipts routes (X); B2-2 Webhook, refunds, status, fee rule (X); B2-3 Reconcile sweep on GitHub Actions (H); B2-4 Payments in Needs attention (M) | Wave gate + **security gate** (webhook and devotee routes) |
| **B3** Screens + e2e | B2 | B3-1 Website booking flow (H); B3-2 My seva bookings and e-receipts (M); B3-3 Admin Payments page (H); B3-4 Test-mode end-to-end + docs (H) | Wave gate + **owner gate** (test payment on the preview site) |
| **C0** Setup | B3 | C0-1 SETUP-GUIDE: Expo account and Android preview build (H) | - |
| **C1** Foundations | C0 | C1-1 Firebase email + password sign-in in the app (H); C1-2 Seva API client, catalogue through the API (M) | Wave gate |
| **C2** Screens | C1 | C2-1 Booking screens (H); C2-2 In-app checkout + deep-link return (H); C2-3 My bookings and e-receipts (M) | Wave gate |
| **C3** Verification | C2 | C3-1 App tests, EAS Android preview build, docs (H) | **Owner gate** (install the APK, pay in test mode) |

**Task count per wave:** A0 2, A1 6, A2 12, A3 7, A4 11, A5 3 (Plan A **41**: 1 S, 10 M, 21 H, 9 X); B0 2, B1 3, B2 4, B3 4 (Plan B **13**: 1 S, 3 M, 5 H, 4 X); C0 1, C1 2, C2 3, C3 1 (Plan C **7**: 2 M, 5 H). Total **61**.

## Reviewer gates

- **Every task:** a spec-compliance review, then a code-quality review (superpowers:subagent-driven-development), at the implementer's tier or higher - a cheaper checker would confirm whatever it is shown (complexity card).
- **Security gates (Opus xhigh):** after A1 (allow-list, Firestore rule, key removal, RLS), after A3 (every seva route against the DB §3.3 matrix, device token, view-only), in A5-3 (whole branch), after B2 (webhook, devotee routes, refunds).
- **Owner gates:** after A4 (10-minute checklist), A5 (merge decision), B3 (test payment), C3 (APK). Before A5-3's full-stack smoke the owner gives an explicit go-ahead and supplies the Supabase test project (SETUP-GUIDE section 1).
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
| B0-B3 | 13 | 52.0 + 15.6 + 5.2 + 7.8 + 11 + 2.5 | **about 0.95 window** (range 0.85-1.2), about USD 280-415 |
| C0-C3 | 7 | 25.0 + 8.4 + 2.8 + 3.8 + 11 | **about 0.5 window** (range 0.45-0.7), about USD 150-225 |
| **All** | **61** | | **about 4.2 windows** (range 3.8-5.5), about USD 1,270-1,860 (range 1,140-2,420) |

**How that maps onto real windows** (waves should not straddle a window when avoidable; A2's twelve tasks are independent and can be split):

| Build window | Work | Load |
|---|---|---|
| 1 | A0, A1, and about half of A2's tasks | ~95% |
| 2 | Rest of A2, A2 gate, A3 | ~90% |
| 3 | A4, A5 | ~92% |
| 4 | Plan B (detail it first with writing-plans, ~5%) | ~100% |
| 5 | Plan C (detail it first, ~3%) | ~55% |

So: **plan on five build windows, the fifth about half used**; the Design Book's earlier figure (Phase 1 about 2.5, Phase 2 about 1) was close for Phase 1 and low for Phase 2 because the app is now its own plan. The owner said more windows are fine (Design Book deck `cut-order`). Ask for the remaining percentage at every wave boundary (working style).

## Owner actions the build waits on

| When | Action | Guide |
|---|---|---|
| After A1 merges | Revoke the old Firebase service-account key (O-18) | SETUP-GUIDE section 3 (written in A2-9) |
| During A3 | Create the Supabase test project for the build (O-16, O-17) | Section 1 |
| Before A5 ends | Generate the `age` backup key; set `SEVA_BACKUP_DB_URL` and `SEVA_BACKUP_AGE_RECIPIENT` (O-15) | Section 4 |
| A4 owner gate | Allow pushing `feature/seva-entry` for a Vercel preview, or check on the builder's PC | Section 2 |
| Before Plan B | Cashfree test account and test keys in Vercel Preview | Section 8 (B0-1) |
| Before Plan C | Expo account | Section 9 (C0-1) |
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

END OF REPORT
