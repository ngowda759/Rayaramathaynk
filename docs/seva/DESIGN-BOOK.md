# Seva Entry - Design Book

Sri Raghavendra Swamy Matha temple portal. One document to plan and build Seva Entry from, without talking to the owner.

## 0. Status and one-screen summary

| Item | Value |
|---|---|
| Status | **SIGNED by the owner on 2026-10-18** (Design Book deck, 11 of 11). Phase 1 built on `feature/seva-entry` (2026-10-18 to 2026-10-20); see "Changes after sign-off". Sign-off answers: stay on Firebase sign-in, built to move later (C-66); build order Phase 1, then website, then app, more windows acceptable; app Android first with email + password; account setup with step-by-step guides; QR page shows the slip's details (C-50). |
| Date | 2026-10-18 (Sunday) |
| Owner | Nikhil (decides); the temple office supplies real data before go-live |
| Written from | `.claude/state/seva/DECISIONS.md` (wins on any conflict), `STATE.md`, `briefs/M6-round-c.md`, `briefs/M6c-dashboard.md`, `design/DATA-MODEL-draft.md` (stale, updated here), `research/R1-payments.md` + `R1V-verify.md` (R1V wins), `R2-counter-setup.md`, `R3-repo-facts.md`, `R4-prior-art-domain.md`, `R5-chart-library.md`, mockups `desk/mockups/{counter,dashboard,settings-devotee}.html`, `desk/architecture.html`, `AGENTS.md`, `docs/rearchitecture/UI-REDESIGN-PLAN.md` sections 2-5, and spot checks of the code (path:line given where used) |
| Labels used | **Owner** = Nikhil decided it (card named). **My call** = decided on his behalf, listed in section 22 as C-nn so he can check it. **Builder's call** = an engineering detail the builder settles. **UNCLEAR** = not known; carries on with a stated assumption. |
| Where it goes next | A builder-check review, then a build plan (superpowers:writing-plans), then Step 2. At Step 2 start this file is committed to `docs/seva/` on `feature/seva-entry` (Step 0 - checkpoints). |

**In plain words.** The temple's seva counter today uses a paper receipt book. Seva Entry replaces it with a fast,
keyboard-driven counter screen on the office Windows PC. The receptionist types the devotee's name (gotra, nakshatra,
rashi and phone are optional), picks sevas by number key or code, picks one or more seva dates, takes cash or UPI once,
and presses one key. The office printer prints one portrait receipt per seva date on the paper size the office picks (A5
by default; A6, one-third A4, 80 or 58 mm rolls, or custom), each with its own receipt number and a QR code. Receipt numbers look like `C1-023-10-2026/000124`: counter series,
staff number, month and year, and a running number that never skips and restarts each January. If the internet drops,
the counter keeps working on its own offline series (`OF1-...`) and sends the receipts when the line returns; an Excel
copy of the day is saved on the PC by itself. At the prasadam counter a volunteer scans the QR (or types the number) and
marks prasadam given, once per receipt. Temple admins get a dashboard (Today / This week / This month / This year),
a receipt register that proves no number is missing, an audit trail, day closes counted by notes and coins, and Excel,
CSV, Tally and print-ready exports. All data lives in Supabase Postgres, reached only by the server; sign-in stays on
Firebase. Phase 2 lets devotees book and pay online by UPI (Cashfree) on the website and in the temple app, built in
full against the gateway's test mode, with online receipts in their own series (`W-WEB-...`, `W-APP-...`). The existing
Receipt Book is extended, not duplicated, and the known security holes are fixed on the way.

## Changes after sign-off

The book was signed on 2026-10-18. What changed while Phase 1 was built (waves A1 to A4S, 2026-10-18 to 2026-10-20),
one line each; the sections named are corrected in place. `DECISIONS.md` and the code win where this list is short.

- 2026-10-19, A3 security work (A3-FIX, A3-FIX2):
  - §3.3: a receptionist cancels only from the registered counter PC; reactivating a super admin needs a super admin.
  - §6.5: search and cancel need the PC for receptionists; devotee search has a per-person rate limit (60 a minute);
    sync accepts a retired PC, for orders inside its gap only; the export GET writes `export.phones_read` on every
    page that includes phones.
  - §7.2: `seva_settings` gains `counter_upi_vpa` and `counter_upi_payee_name` (the last payee read, written only by
    `seva_note_counter_upi`), and the counter UPI change detection is described there.
  - §7.6: new audit actions `settings.upi_changed`, `export.phones_read` and `settings.list_item`; offline cancel
    rows carry `late_sync` and `in_closed_day` in `after`.
  - §7.8: new and changed functions and signatures; a first print only on the PC's own counter or the W series;
    a spoiled reissue only on the PC's own counter; `seva_upsert_seva` sets `firestore_id`.
  - §8.3: offboarding is compared with `status_changed_at`; §8.4: a retired PC reaches the sync route only, with
    orders only.
  - §9.2: search from the PC, with the rate limit; §9.8: the first-print rule.
  - §9.9 and §9.11: a late or closed-day offline cash cancel becomes refund-due, decided by the server's received time
    against the receipt's issue time plus the cancel window.
  - §11: the give answer carries `givenNow`.
  - §12.2: new cards `offline_cancels` and `upi_changed` (a 30-day look-back); §12.6: the server-side phone export
    audit.
  - §13.1: the Firestore id is set by the function; Firestore `sevas` and `settings/financeSettings` writes are super
    admin only.
  - §15.1 and §15.2: the rules changes and the rate limit; §17.4: UPI change detection.
- 2026-10-19, owner card `upi`: the counter UPI id may be changed only by the super admin (as built).
- 2026-10-19, motion and feedback (A4P, owner card `motion-feel`): Lively springs (stiffness 380, damping 22), a loading
  outline on every page, a top progress bar, pending buttons, and reduced motion respected (§18).
- 2026-10-19, the gotra, nakshatra and rashi list page (A4P-5, owner card `lists`): the table `seva_list_items` with
  its guard trigger (§7.2, §13.7); slips print the names kept in the database.
- 2026-10-19, own screens (A4S, deck `shell`): Seva Entry lives at `/seva` with its own frames (header, section rail,
  phone bar), a full-screen counter, role landing, one website-admin menu item, and the old `/admin/receipts/*` and
  `/admin/prasadam` addresses forwarding (D8, C-40, §6.1, §6.4, §9, §11, §12, §13, §17, §18, §20.1).
- 2026-10-20, installable app: one app for every role; manifest `start_url` `/seva` and scope `/seva`; offline, the
  service worker opens the cached counter (§6.1, §20.1).
- 2026-10-20, final-review fixes, SQL and server (A5-FIX F2, `20261102000000_seva_final_fixes.sql`):
  - §8.3, §9.4: offline sync prices a fixed seva from the catalogue (today's rate, or the rate in force at the issue
    time); a line that differs without a trusted rate, a reason, or `allow_amount_change` is stored as printed but
    marked changed with an "Offline price mismatch" reason, never refused.
  - §9.9: an online cancel of a receipt in a closed day is refused for the counter; an admin's cash cancel there is
    refund-due. A receptionist cancels only from the receipt's own counter PC; a spoiled reissue follows the same
    own-receipt and window rule in SQL.
  - §9.10: closing needs the counter PC seen in the last 2 minutes; a temple admin may override (audited, API
    `counterOfflineOk`); only shown denominations are counted. An offline receipt synced into a closed day is
    audited `receipt.synced_into_closed_day` and raises the critical card `synced_into_closed_day` (§12.2).
  - §8.4, §8.5: "Replace this PC" takes the last slip's year (this year or the one before); a `device_replaced` gap
    belongs to the retired PC; gaps are never deleted and only shrink, `last_no` only rises.
  - §7: reasons count only visible characters (3 at least) in checks and forms; view-only staff are refused in SQL
    by every admin and office write function.
- 2026-10-20, final-review fixes, refunds and the paper book (A5-FIX F4, `20261102000100_seva_refunds_paper.sql`):
  - §9.9, §6.5, §7.8: a temple admin or super admin marks a refund-due receipt as refunded (`receipts/refund`,
    `seva_settle_refund`) with the mode (UPI, bank transfer or cash), a reference (unless cash) and a note, from the
    register drawer or today's receipts; audited `receipt.refund_done`, and the "UPI refunds due" card clears (M-3).
  - §8.4, §8.5, §6.5, §7.8: an admin enters each slip of an open gap from the paper book ("Enter from paper book" on
    the register's continuity card, `gaps/[id]/receipts`, `seva_enter_paper_receipt`): the printed number, date,
    devotee, sevas, total and mode; the receipt is stored as the offline receipt it was, the gap shrinks, and it closes
    as entered from the paper book only when its last number is entered. "Resolve" now offers declared lost only;
    `seva_resolve_gap` refuses `entered_from_paper` while a number is missing (M-6).
- 2026-10-20, follow-ups to the final-review fixes (A5-FIX F5, `20261102000200_seva_followups.sql`): a PC reports the
  outbox items the office refused (`counter/refused`, audit `sync.refused`, critical card `sync_refused`) until a temple
  admin sets them aside on the PC with a reason (`counter/refused/set-aside`, `sync.refused_set_aside`); the
  `unprinted_online` card lists online receipts not printed after 10 minutes; the close-day override carries a reason;
  the counter refuses view-only staff in SQL too (§6.5, §9.10, §12.2).
- 2026-10-20, the re-check's leftovers (FINAL-FIX, `20261102000300_seva_final_touches.sql`):
  - docs: the F5 functions, routes and migration are named in the data model, API and migration docs (N-1).
  - §8.3, §9.4: offline sync trusts the PC's cached rate only when it equals the rate in force at the slip's
    `issued_at` (rate history); a lower rate set before the sync is an "Offline price mismatch", audited and on the
    `changed_amounts` card (N-2).
  - §8.6, §12.2: the counter keeps an in-doubt order in its IndexedDB (`meta`) until the office answers, so a reload
    keeps it and the next save reuses its client order id (an earlier day's is let go); the `unprinted_online` card
    looks back over the last 7 business days, not only today (N-3).
  - §9.10: the demo seeder closes each seeded day with the counter-offline override and the reason "Demo data
    seeding", since the counter PC must be closed while it runs (N-6).
  - §7, §9.9, §8.4: the cancel "Other" note (SQL and form) and the "Replace this PC" reason count only visible
    characters, 3 at least, like every other reason (N-8).
- 2026-10-19, configurable paper size (A4S-7, owner card `a5`): presets A5 (default, 148 x 210 mm), A6, one-third A4,
  the 80 mm and 58 mm rolls, and custom; portrait only, one receipt per sheet. It replaces the fixed 99 x 210 mm slip
  (D11, §9.10, §10, §13.2, §21 assumptions, O-05); the Follow-ups `paper` decision is superseded.
- 2026-10-19, two backup keys (owner card `backup-who`): one key for Nikhil and one for the site owner;
  `scripts/seva/backup.sh` takes several recipients (§16.1, §20.2).
- 2026-10-18, backup retention as built (A2): the nightly copy is kept 30 days and the first-of-month copy 90 days,
  the most GitHub allows on default settings; where the 12-month monthly copies live is still open (§16.1, C-57).
- 2026-10-19, demo data: `scripts/seva/seed-demo-data.ts`, guarded and for test projects only (`docs/seva/README.md`).
- 2026-10-20, Onboard staff links an existing website account (owner's go-ahead after go-live testing; §3.2, §3.4,
  §13.6): an email that already has a sign-in answers `existing_account` (with the current role) before any write; on
  "Link this account" (`linkExisting: true`) its uid is used, no login is made and no set-password email goes, the role
  is set, the staff row is made, and a `staff.onboard` audit row records `linked_existing`, `previous_role` and
  `previous_active`. Already staff is refused; a super admin's account is linked only by a super admin. After the
  security review the same day: only a verified, enabled login is linked (`unverified_account`, `disabled_account`
  refused up front, since anyone can register a login for any email); a link's partial failure carries
  `previous_role` and `previous_active`; an existing account with a website admin-console role, or an inactive one,
  is linked only by a super admin (403 `needs_super_admin` for a temple admin).

## 1. Purpose and why

- **The job.** Issue correct, numbered, bilingual seva receipts quickly at the counter, hand over prasadam against them,
  and give the trust an honest, audit-ready record of every rupee (Step 0 - approach; Round A - receipt-book).
- **Why now.** The portal is not live yet (Round B - history), so the module can be designed cleanly: no old receipts to
  migrate, and the Receipt Book that already does about 60% of the job (R3 headline) can move to Supabase and grow.
- **Why not a shop POS.** Prior-art products treat sevas as donations, have no gapless numbering, no void trail and no
  prasadam hand-over tracking (R4 section 1.3). This module is built around those gaps.
- **Why it must be trusted.** "It involves real money" (owner, Round A - supabase). Security comes from server-only
  data access and an append-only audit, not from paying for a bigger plan (Follow-ups - supabase-cost).

## 2. Goals, non-goals, anti-goals

**Goals (Phase 1 unless marked)**

1. A receipt in under 20 seconds for a returning devotee, keyboard only (Round B - counter e, f; Round C - steps).
2. Numbers never conflict and never skip; every cancellation carries a reason (Round A - offline; Round C - numbers).
3. One receipt per seva date; several dates entered once, paid once, printed together (Round C - multidate).
4. Works offline as a fallback, audit-safe, with an automatic Excel copy on the PC (Follow-ups - offline-safe).
5. Prasadam marked given once per receipt, by QR scan or typed number (Round B - prasadam; Round C - prasadam).
6. A dashboard elderly trustees can read: period first, needs attention, tiles, one big chart (Round B - dashboard).
7. Kannada always under English, never beside it (Round B - counter a).
8. Phase 2 (test mode): devotees book and pay by UPI on the website and the Expo app (Step 0 - scope; Round A - devotee).
9. Fix the security holes found in Step 0 (Step 0 - security).
10. Four test layers, written and run by the builder; the owner only takes a quick look (chat 2026-10-18).

**Non-goals (not in this module)**

- Donation receipts and 80G certificates (seva receipts are not donations; see section 14.7).
- Prasadam stock or inventory, expenses, accounting ledgers (Tally export only, no sync).
- Thermal 80 mm printing as the counter's default (Round A - counter-kit: rejected). Since 2026-10-19 the 80 mm and
  58 mm rolls are presets the office may pick (card `a5`, section 10.2).
- Card payments, net banking, wallets online (Round B - devotee: UPI only for now).
- Migrating old receipts (Round B - history: none exist).

**Anti-goals (things this design must never do)**

- Never let a browser talk to Supabase for seva data (Step 0 - database; brief "Database").
- Never reuse, skip or silently delete a receipt number. Never edit an issued receipt's money fields.
- Never put gateway keys in the database or the admin UI (Round A - gateway; mockup Payments).
- Never add a fee to a UPI payment (R1V C1, C2; Round A - fee).
- Never print the devotee's phone number; never show amounts at the prasadam counter (C-31, section 11).
- Never build a second implementation of an existing concept (AGENTS.md "Never").

## 3. Users, roles and permissions

### 3.1 People

| Person | Role | Device | What they do |
|---|---|---|---|
| Receptionist (e.g. Ramesh, staff no. 023) | Receptionist | Counter Windows PC, installed web app | Makes receipts, prints, cancels own within 30 min, closes the day |
| Prasadam volunteer (e.g. Suresh, 031) | Prasadam counter | Phone camera or USB QR scanner on any PC | Scans or types the receipt number, marks prasadam given |
| Office / trustee (e.g. Prakash, 008) | Temple admin | PC or phone | Dashboard, reports, sevas and rates, settings, onboards staff, refunds |
| Trustee who only looks (e.g. Mrs. Kamala, 012) | Temple admin with **view-only** | Phone | Sees everything, changes nothing |
| Nikhil (001) | Super admin | Any | Everything, including offboarding and deleting users |
| Devotee (Phase 2) | Devotee (site sign-in) | Phone or PC, website or temple app | Books online sevas, pays by UPI, keeps e-receipts |

Four staff roles (Round A - roles: Committee folded into Temple admin). View-only switch per temple admin (Round B -
view-only). Active / Inactive status; only active staff sign in (Round B - view-only; Round C - users).

### 3.2 Where roles, staff number and view-only live (My call C-14)

Today auth is a Firebase ID token plus the Firestore `users/{uid}` doc holding `role` and `isActive`
(`lib/auth/admin-auth.ts:53-165`, R3 4.1). Two options were compared:

| | A. Everything in Firestore `users` | B. Split: identity in Firestore, seva profile in Supabase `staff` (chosen) |
|---|---|---|
| Role, isActive | Firestore | Firestore (unchanged single source for the whole admin console) |
| Staff no., view-only, lifecycle | Firestore fields | Supabase `staff` table keyed by Firebase uid |
| Staff no. unique, never reused | App code must enforce | Database `unique` constraint; rows are never deleted |
| Receipts reference the issuer | By copying a string | Foreign key to `staff.id` in the same database |
| Audit of staff changes | Separate store | Same append-only `audit_log` as receipts |
| Effect on the rest of the site | New fields in a shared doc | None; AdminAuthGuard and AuthContext keep reading Firestore |

**Pick B.** The server helper for every seva route checks **both**: Firestore `isActive == true` and an allowed role,
and Supabase `staff.status == 'active'`. Drift between the two can therefore only deny access, never grant it. The only
code path that changes either store is the staff API (section 13.6), which writes Firestore first, then Supabase, then
the audit row, and reports a partial failure loudly. Deactivation also sets the Firebase Auth user `disabled` and revokes
refresh tokens, so an inactive person cannot sign in anywhere (Round B - view-only: "only active can sign in").

New Firestore role values: `receptionist`, `prasadam_counter`. Existing `temple_admin` (and legacy `admin`) and
`super_admin` keep their meaning. Legacy `billing`, `priest`, `staff`, `office_staff` get **no** seva access until a
super admin gives them one of the four roles (My call C-62).

### 3.3 Role x action matrix

R = Receptionist, P = Prasadam counter, TA = Temple admin, TV = Temple admin with view-only, SA = Super admin.
Y = allowed, - = not allowed. The server enforces every cell; the client only hides what is not allowed.

| # | Action | R | P | TA | TV | SA | Source |
|---|---|---|---|---|---|---|---|
| 1 | Use the counter: make and print receipts | Y | - | Y | - | Y | Round A - roles; TA/SA at counter: C-15 |
| 2 | Change one seva's amount on a receipt (reason required) | Y | - | Y | - | Y | Round B - override |
| 3 | Cancel own receipt within the cancel window (30 min), with reason | Y (from the registered counter PC only) | - | Y | - | Y | Round B - cancel; A3 security gate L-2 |
| 4 | Cancel any receipt at any time, with reason | - | - | Y | - | Y | Round B - cancel |
| 5 | Reprint (prints DUPLICATE) | Y (own counter, today) | - | Y | - | Y | brief "Printing" |
| 6 | Close the day for a counter | Y (own counter) | - | Y | - | Y | Round B - cancel / dayclose |
| 7 | Reopen a closed day (reason) | - | - | Y | - | Y | C-24 |
| 8 | Mark prasadam given; undo within 120 s | - | Y | Y | - | Y | Round C - prasadam; C-15, C-27 |
| 9 | Give prasadam before or after the seva date (warning shown) | - | Y | Y | - | Y | Round C - prasadam-day |
| 10 | Reverse a prasadam mark after the undo time (reason) | - | - | Y | - | Y | C-27 |
| 11 | Dashboard, register, reports, audit trail | own counter today only | - | Y | Y | Y | C-59 |
| 12 | Export (Excel, CSV, Tally, print summary) without phone numbers | - | - | Y | Y | Y | C-16 |
| 13 | Export including devotee phone numbers | - | - | Y | - | Y | C-16 |
| 14 | Seva settings, rates (reason on rate change) | - | - | Y | - | Y | Round B - settings |
| 15 | Receipt template, denominations, festival days, counter rules | - | - | Y | - | Y | Round C - cash; M6 decision 6 |
| 16 | Register a counter PC / Replace this PC | - | - | Y | - | Y | settings mockup |
| 17 | Resolve a receipt-number gap | - | - | Y | - | Y | C-52 |
| 18 | Onboard staff as Receptionist, Prasadam counter or Temple admin | - | - | Y | - | Y | Round B - view-only |
| 19 | Give the Super admin role | - | - | - | - | Y | staff mockup |
| 20 | Change another person's role or view-only switch | - | - | Y (not SA, not self) | - | Y | C-17 |
| 21 | Reactivate an inactive person | - | - | Y (not a super admin) | - | Y | C-09; reactivating a super admin needs a super admin (A3 security gate) |
| 22 | Offboard (deactivate) a person, with reason | - | - | - | - | Y | Round B - view-only |
| 23 | Delete a user, with reason | - | - | - | - | Y | Round B - view-only |
| 24 | Payments page (Phase 2): view | - | - | Y | Y | Y | settings mockup |
| 25 | Refund an online payment, with reason | - | - | Y | - | Y | brief "Payments" |
| 26 | Switch the gateway fee rule on or off | - | - | - | - | Y | payments mockup |
| 27 | Book and pay online (Phase 2) | signed-in devotee | | | | | Round B - devotee |

### 3.4 Staff lifecycle

`invited` (onboarded, has not signed in; My call C-08) -> `active` (first successful sign-in) -> `inactive`
(offboarded by a super admin with a reason; cannot sign in; records and staff no. kept; can be reactivated without
re-onboarding) -> `deleted` (super admin, reason, Firebase login removed for good; the `staff` row, name and staff no.
stay for the audit trail; the staff no. is never reused). The drawer's "Active" switch and the "Offboard (deactivate)"
button in the mockup do the same thing, so the build shows one control (C-09).

## 4. Scope by phase

| Phase | In scope |
|---|---|
| **Phase 1** (Step 2, first windows) | Supabase schema and SQL functions; counter (three steps, multi-date, number keys, override, cash and UPI, print, reprint, cancel, spoiled reissue); offline series OF with outbox and Excel copy; device registration and Replace this PC; prasadam counter (scan and type); day close with denominations; dashboard with ECharts; register with continuity; reports (seva summary, festival view, audit trail, day closes); exports (Excel, CSV, Tally, print summary); settings (sevas, receipt template, counters, denominations, festival days, counter rules); staff and roles (onboard, view-only, active/inactive, offboard, delete); security fixes (section 17.4); nightly encrypted backup; four test layers |
| **Phase 2, full, in test mode** (Step 2, last window) | Devotee booking on the website and in the Expo app (`apps/mobile`): sign-in Google or email + password, same devotee fields, real date picker with festival chips, multi-date, UPI only; payment provider adapter with Cashfree (test mode); order, webhook (signature verified), server re-fetch, reconcile, refunds by admin with reason; online series W (W-WEB / W-APP) and test series WT; e-receipts in the account; Payments status page; fee rule (off). Going live is two steps the owner takes later (section 14.6) |
| **Later / out** | Razorpay adapter (C-43); paid SMS / WhatsApp e-receipts (C-44); card payments; scheduled future rate changes (C-35); prasadam offline mode (C-28); shift-wise day close for several receptionists on one counter; import of old paper-register totals for last-year comparisons; donation receipts and 80G; Supabase Pro (only if ever needed, Follow-ups - supabase-cost); QZ Tray or a local print helper (only if kiosk printing fails, R2 s2) |

Budget: the owner approved about four build windows (Step 0 - budget; Round A - budget). Estimate: Phase 1 about two
and a half windows, Phase 2 about one; the build plan recalibrates this.

## 5. Decision register

Every owner decision, with its card. "Owner" rows come from `DECISIONS.md`; "My call" rows point to section 22.

| # | Decision | Source card | Who |
|---|---|---|---|
| D1 | Two design rounds, then a signed Design Book | Step 0 - approach | Owner |
| D2 | Fix the security holes in Phase 1 (self-assigned role, deny-list, committed key, receptionist role) | Step 0 - security | Owner |
| D3 | Database is Supabase (Postgres) | Step 0 - database | Owner |
| D4 | Hardware: Windows PC or laptop, 1 counter, busy day 500+ receipts | Step 0 - hardware | Owner |
| D5 | Scope: Phase 1 + full Phase 2 in test mode | Step 0 - scope | Owner |
| D6 | All 8 ideas: QR at prasadam, day-close tally, returning-devotee fill, Kannada + English receipt, void-with-reason audit, festival-day view, SMS/WhatsApp e-receipt (P2), Tally export | Step 0 - ideas | Owner |
| D7 | `.claude/state/seva/` stays git-ignored; Design Book committed under `docs/` | Step 0 - checkpoints | Owner |
| D8 | Extend the Receipt Book; its storage moves to Supabase; one menu link in the website admin opens its own screens at `/seva` (changed 2026-10-19, deck `shell`) | Round A - receipt-book; deck `shell` | Owner |
| D9 | Supabase Free plan plus our own free backups; security from server-only access; Pro only if ever needed | Round A - supabase; Follow-ups - supabase-cost | Owner |
| D10 | 80 mm thermal rejected; temple header template (name and address centred, photo left and right) and footer on the counter form and the receipt | Round A - counter-kit | Owner |
| D11 | Receipt = one-third A4 slip, portrait, 99 x 210 mm, `@page { size: 99mm 210mm }`, office A4 printer. **Superseded 2026-10-19** by card `a5`: configurable paper size, A5 default, portrait, one receipt per sheet (section 10.2) | Follow-ups - paper; card `a5` | Owner |
| D12 | Offline only as a fallback and only if audit-safe; numbers never conflict; data kept locally; Excel copy on the PC kept in sync automatically | Round A - offline; Follow-ups - offline-safe | Owner |
| D13 | Four roles: Receptionist, Prasadam counter, Temple admin, Super admin | Round A - roles | Owner |
| D14 | Gateway Cashfree, Razorpay as spare | Round A - gateway | Owner |
| D15 | Temple absorbs the online fee | Round A - fee | Owner |
| D16 | Phase 2 on both the website and the Expo app | Round A - devotee | Owner |
| D17 | All four test layers | Round A - tests | Owner |
| D18 | Counter: modern look; Kannada under English everywhere; one step at a time; roomy tiles; same seva on several dates in one go; number keys 1-9; name first, phone last; separate offline series; rashi a searchable dropdown; denominations configurable; coins by value | Round B - counter (a-j) | Owner |
| D19 | Only the name is required; gotra, nakshatra, rashi, phone optional; seva date may be a later day | Round B - fields | Owner |
| D20 | Override = change the price of one seva (qty x new price) | Round B - override | Owner |
| D21 | Portrait slip approved | Round B - receipt | Owner |
| D22 | Calendar year; format `<series>-<staff no.>-<MM-YYYY>/<running no.>` | Round B - numbering | Owner |
| D23 | Receptionist cancels own receipt within 30 minutes; a day-close difference needs a note | Round B - cancel | Owner |
| D24 | Dashboard order: period switch first, needs attention, tiles, big chart with tooltips, details; research chart libraries | Round B - dashboard | Owner |
| D25 | View-only switch; active/inactive; onboarding by temple admin or super admin; offboarding and deleting by super admin only | Round B - view-only; Round C - users | Owner |
| D26 | Prasadam: typing the receipt number is a first-class way beside scanning | Round B - prasadam; Round C - prasadam | Owner |
| D27 | Devotee: Google or email + password; each seva decides if a date is picked; same fields as the counter; real date picker; UPI only | Round B - devotee; Round C - devotee | Owner |
| D28 | No old receipts exist; no migration | Round B - history | Owner |
| D29 | Build with samples; real office details before go-live | Round B - office | Owner |
| D30 | proto.css v2 look approved ("much better") | Round C - look | Owner |
| D31 | Three guided steps plus live summary | Round C - steps | Owner |
| D32 | One receipt per seva date, entered once, paid once, printed together | Round C - multidate | Owner |
| D33 | Running number continues all year, restarts in January, per series C1 / OF1 / W | Round C - numbers | Owner |
| D34 | Apache ECharts | Round C - charts | Owner |
| D35 | Prasadam before the seva date allowed with a warning; after the date allowed with a warning | Round C - prasadam-day | Owner |
| D36 | Architecture diagram approved | Round C - diagram | Owner |
| D37 | Test automation in scope; build tests while quota allows; run slow suites only near the end of a window | Chat 2026-10-18 | Owner |
| D38 | Where roles, staff no. and view-only live | section 3.2 | My call C-14 |
| D39 | Group cancel: all or one date | section 9.9 | My call C-01 |
| D40 | Test-mode online receipts in their own series WT | section 8.1 | My call C-18 |
| D41 | All multi-row writes through SQL functions; APIs at `/api/seva/*` | sections 6, 7 | My call C-40 |
| D42 | Everything else marked "My call" | section 22 | My call |

### 5.1 Where the inputs disagreed, and how it was resolved

| # | Disagreement | Resolution |
|---|---|---|
| 1 | R2 recommends an 80 mm thermal printer and Supabase Pro | Owner rejected 80 mm (Round A - counter-kit; Follow-ups - paper) and chose Free + own backups (Follow-ups - supabase-cost) |
| 2 | R3 lists the Receipt Book code under "leave alone" | Owner chose to extend it with storage moved to Supabase (Round A - receipt-book); same feature, one menu link to its own screens at `/seva` (D8), Firestore implementation replaced (17.2) |
| 3 | DATA-MODEL-draft: financial-year numbers `RM/2026-27/000123`, counters by FY, reserved number blocks for offline, a `committee` role | Calendar year (D22), series C/OF/W (D33), offline uses its own series instead of reserved blocks (D18 g), four roles (D13) |
| 4 | Round B - numbering asked "does the running number restart monthly?"; mockups say "continues all year (to be confirmed)" | Confirmed in Round C - numbers: continues all year, restarts in January |
| 5 | Owner's Round B example `OF12/<user id 023>/2026-2027/000124` is financial-year style | His calendar-year format applies: `OF1-023-10-2026/000007` (M6 decision 4) |
| 6 | Prasadam "another day" mockup has no "Mark given" ("only on the slip's own date") | Round C - prasadam-day: before and after allowed with a warning; built as "Give anyway" (section 11) |
| 7 | R1: UPI MDR in force from 2026-10-15 | R1V: deferred by NPCI on 2026-10-13 to a date after Diwali; R1V used |
| 8 | R1: the temple nets about Rs 250 during the Cashfree offer | R1V: GST on a notional 1.95% is still deducted, about Rs 249.12; R1V used |
| 9 | R3 3.2 and the brief: migrations ship to live on merge | `.github/workflows/supabase-migrations.yml` today runs only on `workflow_dispatch`; treated as "lands on live whenever run"; additive-only unchanged |
| 10 | R5 proposed three tiles (receipts, amount, average) and "previous period = yesterday" | Owner's layout (M6c: Total, Receipts, Cash, UPI, Online) and "yesterday up to the same time" (C-04) |
| 11 | Dashboard mockup compares a part week with the whole of last week, but month and year with the same elapsed span | Like-for-like everywhere (C-13) |
| 12 | Festival view shows "2025 figures from the old register (sample)" although no old receipts exist (D28) | First-year comparisons show "no data"; optional import of paper totals is Later (O-21) |
| 13 | Settings slip preview prints the Kannada temple name first; the counter slip prints English first | English first, Kannada under (C-03) |
| 14 | Architecture F1 says a receipt is "stored with an audit entry" | No audit row for a normal issue; the receipt row is the record (C-36) |
| 15 | Diagram and Step 0 - ideas include an SMS/WhatsApp sender, but the owner does not want extra spending | In-account e-receipts and a free share link; paid sending waits for approval (C-44) |
| 16 | UI-REDESIGN-PLAN proposes serif headings, 8/16 px radii, border-only cards, Noto Serif Kannada | Approved v2 look, scoped to the module (section 18) |
| 17 | proto.css chart colours differ from `app/globals.css` `--chart-*` | Module-scoped tokens (section 18) |
| 18 | AGENTS.md says `npm run type-check` and "Next.js 14" | `package.json` has `typecheck` and Next ^16.2.9; package.json used |
| 19 | AGENTS.md says the database is "Firestore via admin SDK" | Owner decided Supabase (D3) |
| 20 | STATE: private-key blocks in 11 files under `scripts/` | Checked 2026-10-18: 11 tracked files carry the marker, 9 appear to embed key material (values not read) |
| 21 | Audit mockup shows a rate change made on 15 Oct "from 16 Oct" (future-dated); no decision covers scheduled rates | Rates apply when saved (C-35) |
| 22 | Staff mockup has both an Active switch and an Offboard button | One action (C-09) |
| 23 | M3 guessed online receipts share the RM series | Superseded by series W (D33) |
| 24 | R4: rashi is not on the paper receipt, optional; owner made rashi a searchable field everywhere (D18 h) | Captured everywhere, not printed by default (C-02) |
| 25 | Counter mockup uses Aradhane 28-30 Aug 2027; settings show Aradhane 2027 "not set yet" and 2026 dates | Samples only (C-11) |
| 26 | `apps/mobile/lib/api.ts` reads `sevas` with the anon key, but the table is deny-all for anon | Phase 2 app reads through the API (17.1) |
| 27 | Step 0 - checkpoints: the Design Book is committed under `docs/`; this brief writes it under `.claude/state/seva/book/` | This file is the draft; it moves to `docs/seva/` at Step 2 start (STATE) |
| 28 | `desk/architecture.html` footer names an office company, against this repo's boundary rule (CLAUDE.md) | Noted only; not edited (write-only rule) |

## 6. Architecture

### 6.1 Components

Four lanes, as in the approved diagram (`desk/architecture.html`, Round C - diagram).

| Lane | Component | Notes |
|---|---|---|
| People and devices | Counter PC (Windows, Edge or Chrome installed web app, kiosk printing, office A4 printer) | One registered device per counter (C-37) |
| | Prasadam phone or PC (camera or USB scanner) | No device registration |
| | Admin phone or PC | Dashboard on phone works at 390 px |
| | Devotee phone or PC: website and temple app (Phase 2) | |
| App on Vercel (Next.js ^16.2.9, React 19.2.4) | Counter pages `/seva/counter` (full-screen frame) + service worker + IndexedDB outbox + Excel worker | Client components; one installable app for every role (manifest `start_url` and scope `/seva`); offline, the service worker opens the cached counter |
| | Prasadam page `/seva/prasadam` | Phone-first |
| | Module pages under `/seva/*` (own header, section rail, phone bar) and Staff at `/admin/users` | One "Seva Entry" item in the website admin (D8); role landing at `/seva`; old `/admin/receipts/*` and `/admin/prasadam` addresses forward (`next.config.ts`) |
| | Devotee pages under `/sevas/*` and `/r/[token]` (Phase 2) | Extends today's public `/sevas` |
| | API layer: route handlers `app/api/seva/**` | Verify Firebase token -> role allow-list + staff status -> validate (zod) -> service -> SQL function |
| | Server services `lib/seva/server/*` | Only place that calls `createAdminClient()` (`lib/supabase/admin.ts:4-19`) |
| | Payment adapter `lib/seva/payments/*` (Phase 2) | One interface, Cashfree implementation |
| Data: Supabase Postgres | Tables, SQL functions, triggers (section 7) | RLS deny-all; service role only |
| Outside services | Firebase Auth + Firestore `users` | Existing sign-in; role and isActive |
| | Cashfree PG (Phase 2, test mode) | Hosted checkout; signed webhooks |
| | GitHub Actions | CI and the nightly encrypted backup |
| | The counter PC's disk | Excel copy folder |

### 6.2 Flows F1-F5

**F1 Counter receipt (online).**
1. Receptionist fills step 1 (devotee), step 2 (sevas and dates), step 3 (pay). Everything is local until Save.
2. Ctrl+Enter: the counter builds the order with a new `client_order_id` and one `client_receipt_id` per seva date,
   and posts it to `POST /api/seva/counter/orders` with the Firebase ID token and the device header.
3. The route checks token, role, staff status, device; validates with zod; calls `seva_issue_counter_order()`.
4. The SQL function, in one transaction: prices every line from `sevas` (override only where allowed, with a reason),
   groups lines by seva date, takes the next C-series running numbers (row lock), inserts order, receipts and lines,
   sets QR tokens, upserts the devotee profile (only if a phone was given), writes audit rows for exceptions, and returns
   the receipts. A repeated `client_order_id` returns the same receipts (idempotent).
5. The counter prints one slip per receipt in one print job (kiosk printing), then calls
   `POST /api/seva/counter/prints` to record the first print, clears the form and puts the cursor in Name.

**F2 Counter receipt (offline).** Same screens. When the network or the office is unreachable (or "Work offline" is
on), Save takes the next number from this PC's own offline series (`OF1-...`), stores the order in the IndexedDB
outbox, prints at once, and updates the Excel copy. When the connection returns, the outbox sends each order to
`POST /api/seva/counter/sync` in order; `seva_sync_offline_order()` stores it exactly as printed, ignores duplicates
(same `client_receipt_id`), and records any number gap (section 8.5).

**F3 Prasadam.** Volunteer scans the slip QR (or types the number) -> `GET /api/seva/prasadam/lookup` -> receipt with
seva lines and what to hand over (no amounts) -> "Mark given" -> `seva_mark_prasadam()` sets it once; a second scan shows
"Already given at 11:05 by Suresh". A slip for another day shows a warning and needs a second tap (D35).

**F4 Temple admin.** Dashboard and reports read pre-bucketed summaries from SQL functions through `/api/seva/reports/*`;
exports page the data through the API and build the file in the browser (C-41); every export is audited.

**F5 Devotee (Phase 2).** Pick an online seva -> details and dates -> `POST /api/seva/devotee/orders` (server prices
it from `sevas`) -> adapter creates the gateway order -> hosted UPI checkout -> gateway webhook (signature verified,
order re-fetched from the gateway) -> `seva_issue_online_order()` issues W receipts, one per date -> e-receipts with QR
in the account -> prasadam counter as F3.

### 6.3 Technology choices

| Need | Choice | One-line reason |
|---|---|---|
| Database | Supabase Postgres, Free plan | Owner (D3, D9); repo already uses it |
| DB access | `createAdminClient()` service role from server code only | Repo convention (R3 3.1); RLS denies every browser |
| Multi-row writes | Postgres SQL functions called with `.rpc()` | supabase-js has no client transactions; numbering must share the insert's transaction (R2 s6) |
| Validation | `zod` ^4.4.3 (installed, unused today, R3 1.8) | One schema shared by client form and route |
| Auth | Firebase ID token verified server-side (existing) | Owner kept Firebase sign-in; no Supabase Auth bridge needed (R2 s6) |
| Offline | Hand-built IndexedDB outbox with idempotency keys | R2 s5 option (a): single writer, append-only |
| Offline app shell | Service worker scoped to the counter (and prasadam) pages | Next.js PWA guide points to Serwist for caching (R2 s4); library is a Builder's call |
| Installable | Web app manifest for the counter, installed from Edge or Chrome | R2 s4; no app store |
| Silent printing | Browser shortcut with `--kiosk-printing`, office printer as Windows default | R2 s2: free, no extra software (UNVERIFIED on the temple PC) |
| Excel | One xlsx library used in the browser (counter copy and exports) | No xlsx library in the repo (R3 5); Builder's call, e.g. `exceljs` (MIT); load it lazily |
| QR | `qrcode` ^1.5.4 (installed) | R3 1.7 |
| Charts | Apache ECharts 6.x, modular `echarts/core`, SVG renderer, loaded only on the dashboard | Owner (D34); R5 |
| Payments | Provider adapter; Cashfree PG first | Owner (D14); R1, R1V |
| Tests | Jest (unit, route), PGlite (database), Playwright (browser) | Owner (D17); no Docker on this PC (STATE) |
| Backups | GitHub Actions + `pg_dump` + `age` encryption | Free (D9) |

### 6.4 Code layout (new and extended)

```
app/seva/                      (moved from app/admin/receipts and app/admin/prasadam in A4S)  layout.tsx = module gate;
  (counter)/                               full-screen frame: counter/, counter/today/, day-close/
  (desk)/                                  header, section rail and phone bar: page.tsx = dashboard; register/;
                                           [receiptId]/ (+ print/); day-closes/; reports/; seva-settings/; settings/;
                                           prasadam/; create/ (forwards to the counter); payments/ (Phase 2)
app/admin/users/               (extended)  staff and roles (the module links here)
components/seva/shell/         (new)       SevaHeader, SectionRail, PhoneBar, DeskFrame, FocusFrame, SevaGate
lib/seva/routes.ts             (new)       every module address in one constant (SEVA_ROUTES, sevaHomePath)
app/api/seva/**                (new)       route handlers (list in 6.5)
app/(public)/sevas/**          (extended, Phase 2)  booking flow; app/r/[token]/ (new) QR landing
lib/seva/*.ts                  (new)       pure logic: numbering format, grouping by date, amount in words, period maths,
                                           validation schemas, domain lists (nakshatras, rashis, gotras)
lib/seva/server/*.ts           (new)       server-only: auth helper, repositories calling SQL functions
lib/seva/payments/*.ts         (new, P2)   provider interface + cashfree adapter
services/seva/*.service.ts     (new)       browser fetch clients with the Bearer token (pattern of services/receipt.service.ts)
types/seva.ts                  (new)       shared types
components/seva/**             (new)       counter, slip, prasadam, dashboard, settings components
components/charts/EChart.tsx   (new)       thin ECharts client wrapper (R5 s4)
supabase/migrations/2026102x_seva_*.sql    (new)
tests/unit/seva/**, tests/db/**, tests/e2e/seva/**   (new)
```

### 6.5 API surface (all under `app/api/seva/`)

| Route | Method | Who | Purpose |
|---|---|---|---|
| `me` | GET | any staff | Role, staff no., view-only, allowed actions, counter binding |
| `counter/bootstrap` | GET | R, TA, SA + device | Catalogue, settings, header, denominations, festival chips, next numbers, today's totals |
| `counter/orders` | POST | R, TA, SA + device | Issue an online order (F1) |
| `counter/sync` | POST | R, TA, SA + device (a retired PC too: orders inside its gap only, cancels refused) | Send offline orders and offline cancels (F2) |
| `counter/prints` | POST | R, TA, SA + device | Record a print or reprint |
| `counter/heartbeat` | POST | device | Outbox size, clock skew, app version, every 60 s |
| `counter/devices` | POST | TA, SA | Register this PC; Replace this PC |
| `receipts` | GET | TA, TV, SA; R (own counter today) | Register list with filters |
| `receipts/[receiptId]` | GET | as above | One receipt with history |
| `receipts/cancel` | POST | R (own, window, from the registered PC), TA, SA | Cancel one or more receipts |
| `receipts/refund` | POST | TA, SA | Mark refund-due receipts as refunded: mode, reference, note (A5-FIX M-3) |
| `receipts/[receiptId]/reissue` | POST | R (own, window), TA, SA | Spoiled print: cancel and reissue (today's receipts only, 9.8) |
| `devotees/search` | GET | R (from the registered PC), TA, SA | Returning-devotee matches; 60 a minute per person (per server instance) |
| `prasadam/lookup` | GET | P, TA, SA | Find by token or number |
| `prasadam/give`, `prasadam/undo` | POST | P, TA, SA | Mark or undo |
| `day-close` | GET, POST | R (own counter), TA, SA | Prepare and close; `day-close/reopen` TA, SA |
| `reports/*` | GET | TA, TV, SA | dashboard, continuity, seva-summary, festival, audit, day-closes, export pages (a page with phones: TA, SA, and the GET writes `export.phones_read` on every page); `reports/export/audit` POST records the finished file |
| `sevas`, `sevas/[id]`, `sevas/reorder` | GET, POST, PUT | TA, SA (GET also R) | Catalogue |
| `settings/*` | GET, PUT, POST | TA, SA (GET also TV) | receipt template and paper size, rules, denominations, festival days, counters, gotra / nakshatra / rashi lists |
| `staff`, `staff/[id]` | GET, POST, PUT | TA, SA (offboard and delete SA) | Staff and roles |
| `gaps/[id]` | POST | TA, SA | Resolve a number gap |
| `gaps/[id]/receipts` | POST | TA, SA | Enter one slip of the gap from the paper book (A5-FIX M-6) |
| `devotee/orders`, `devotee/orders/[ref]` | POST, GET | signed-in devotee | Phase 2 booking and status |
| `devotee/receipts` | GET | signed-in devotee | My seva bookings |
| `payments/webhook/[provider]` | POST | gateway (signature) | Phase 2 |
| `payments/status`, `payments/refunds`, `payments/fee-rule` | GET, POST | TA, TV (view), SA | Phase 2 |

## 7. Data model

### 7.0 Conventions (R3 3.2-3.6)

- Migrations in `supabase/migrations/YYYYMMDDHHMMSS_snake_case.sql`, idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`
  then `CREATE POLICY`), **additive only** (no drop, no rename, no type change of an existing column).
- Every new table: `ENABLE ROW LEVEL SECURITY`; policy `"Deny all public access to <table>" FOR ALL TO public USING
  (false) WITH CHECK (false)`; `REVOKE ALL ON <table> FROM anon, authenticated`. The service role bypasses RLS.
- Every new function: `SET search_path = public, pg_temp`; `REVOKE EXECUTE ... FROM public, anon, authenticated`;
  `GRANT EXECUTE ... TO service_role`. Functions are `SECURITY INVOKER`.
- Mutable tables get `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`
  and the existing trigger function `update_updated_at_column()`.
- Money: `numeric(10,2)` per line, `numeric(12,2)` for totals; TypeScript works in integer paise.
- Time: `timestamptz` everywhere; business dates are `date` in Asia/Kolkata, computed by the SQL functions, never from
  the server's local zone (the old code used server local time, R3 1.4).
- Primary keys `uuid default gen_random_uuid()` unless stated. "fk" = foreign key `ON DELETE RESTRICT` unless stated.
- `scripts/verify-supabase-migrations.ts` checks declared tables and RLS coverage; it must pass for the new files.

### 7.1 Catalogue

**`sevas` (exists; extend with `ADD COLUMN IF NOT EXISTS`)** - the single catalogue (Round B "history" + brief: Receipt
Book catalogue moves here). Existing columns kept: `id, firestore_id, name, description, category NOT NULL, amount,
duration NOT NULL, image_url, active, display_order, created_at, updated_at` (R3 2.2).

| New column | Type | Rules |
|---|---|---|
| `code` | text | null; check `code ~ '^[A-Z]{2,3}$'`; unique index where not null |
| `name_kn` | text | null; Kannada name |
| `visibility` | text | not null default `'both'`; check in (`counter`,`online`,`both`) (C-38) |
| `multi_date` | boolean | not null default false; "can be booked for several dates" |
| `allow_amount_change` | boolean | not null default true; "counter may change the amount" |
| `any_amount` | boolean | not null default false; check `not any_amount or visibility = 'counter'` (Other Seva / Karnike) |
| `prasadam_given` | boolean | not null default true |
| `prasadam_items` | text | null; what the prasadam counter hands over |
| `income_ledger` | text | null; Tally ledger, default at export "Seva Income - <name>" (C-55) |
| `updated_by_staff_id` | uuid | null fk `staff` |

Also `ALTER COLUMN duration SET DEFAULT 0` (additive). `display_order` doubles as the counter key 1, 2, 3 (settings
mockup "Counter key - also the display order"); `seva_reorder_sevas()` renumbers 1..n. Index `(visibility, active,
display_order)`. Trigger `sevas_rate_history` (AFTER UPDATE OF amount): inserts a `seva_rate_history` row with the reason
from `current_setting('seva.change_reason', true)`, or "changed outside the app" when unset (so the existing seed and
migrate scripts keep working).

**`seva_rate_history`**

| Column | Type | Rules |
|---|---|---|
| `id` | bigint identity | pk |
| `seva_id` | uuid | not null fk `sevas` |
| `old_amount` | numeric(10,2) | null = seva added |
| `new_amount` | numeric(10,2) | not null |
| `reason` | text | not null |
| `changed_by_staff_id` | uuid | null fk `staff` |
| `changed_at` | timestamptz | not null default now() |

Index `(seva_id, changed_at desc)`. Append-only trigger (raise on UPDATE/DELETE).

### 7.2 People, counters and settings

**`staff`**

| Column | Type | Rules |
|---|---|---|
| `id` | uuid | pk |
| `firebase_uid` | text | not null unique |
| `staff_no` | smallint | not null unique; check 1..999; shown as 3 digits (023); never reused |
| `full_name` | text | not null; length 1..80 |
| `email` | text | not null; stored lowercase; unique |
| `view_only` | boolean | not null default false; only meaningful for temple admins |
| `status` | text | not null default `'invited'`; check in (`invited`,`active`,`inactive`,`deleted`) |
| `status_reason` | text | null; check: required when status in (`inactive`,`deleted`) |
| `status_changed_at` | timestamptz | null |
| `status_changed_by_staff_id` | uuid | null fk `staff` |
| `invited_by_staff_id` | uuid | null fk `staff` |
| `invited_at` | timestamptz | null |
| `first_signed_in_at` | timestamptz | null |
| `created_at`, `updated_at` | timestamptz | trigger |

Role is **not** stored here (Firestore is the single source, section 3.2). Rows are never deleted (trigger raises on
DELETE). `seva_next_staff_no()` returns max+1.

**`counters`**

| Column | Type | Rules |
|---|---|---|
| `id` | smallint | pk; check 1..99 (Counter 1 = 1) |
| `name` | text | not null ('Counter 1') |
| `place` | text | null ('Office PC') |
| `opening_float` | numeric(10,2) | not null default 0; check >= 0 (C-25) |
| `active` | boolean | not null default true |
| `created_at`, `updated_at` | timestamptz | trigger |

**`counter_devices`**

| Column | Type | Rules |
|---|---|---|
| `id` | uuid | pk |
| `counter_id` | smallint | not null fk `counters` |
| `secret_hash` | text | not null; SHA-256 hex of a 32-byte random secret kept only on the PC |
| `label` | text | null (browser and PC name) |
| `registered_at` | timestamptz | not null default now() |
| `registered_by_staff_id` | uuid | not null fk `staff` |
| `retired_at`, `retired_by_staff_id`, `retired_reason` | timestamptz, uuid, text | null; reason required when retired |
| `last_seen_at` | timestamptz | null |
| `last_outbox_count` | integer | not null default 0 |
| `last_clock_skew_ms` | integer | null |
| `app_version` | text | null |
| `of_group_floor_yymm`, `of_group_floor_no` | char(4), integer | null; set together by "Replace this PC": the offline group label NNN of IST month YYMM this PC starts after (8.3, 8.4) |

Partial unique index `(counter_id) where retired_at is null`: one live PC per counter.

**`seva_settings`** (one row, `id smallint pk default 1 check (id = 1)`)

| Column | Type | Default / rule |
|---|---|---|
| `temple_name_en`, `temple_name_kn` | text | sample values until the office sends real ones (D29) |
| `address_line1`, `address_line2` | text | |
| `registration_line` | text | null (optional) |
| `photo_left_url`, `photo_right_url` | text | null; uploaded with the existing `components/ui/ImageUploader` |
| `footer_line1`, `footer_line2`, `footer_blessing` | text | blessing sample "ಶ್ರೀ ಗುರುರಾಜೋ ವಿಜಯತೇ" |
| `print_gotra`, `print_nakshatra` | boolean | true |
| `print_rashi` | boolean | false (C-02) |
| `cancel_window_minutes` | smallint | 30; check 0..240 (D23) |
| `cash_difference_note_required` | boolean | true (D23) |
| `amount_change_reason_required` | boolean | true |
| `counter_days_ahead` | smallint | 365 (C-29) |
| `online_days_ahead` | smallint | 90 (C-29) |
| `online_same_day_cutoff` | time | 12:00 (C-29) |
| `prasadam_undo_seconds` | smallint | 120 (C-27) |
| `day_close_flag_threshold` | numeric(10,2) | 0 (C-26) |
| `tally_cash_ledger`, `tally_upi_ledger`, `tally_online_ledger` | text | 'Cash', 'Bank - UPI', 'Gateway clearing' (samples) |
| `tally_columns` | jsonb | null; header names from the temple's Tally mapping (R4 s5) |
| `paper_size` | text | `'a5'`; check in (`a5`,`a6`,`third_a4`,`roll_80`,`roll_58`,`custom`) (card `a5`, section 10.2) |
| `paper_custom_w_mm`, `paper_custom_h_mm` | smallint | null; width 50..216, height 80..356, height >= width; both set when `custom` |
| `counter_upi_vpa`, `counter_upi_payee_name` | text | null; the last counter payee read from Firestore, written only by `seva_note_counter_upi` (never by the settings PUT) |
| `updated_at`, `updated_by_staff_id` | | trigger; audit row on every change |

The counter UPI id and payee name are **not** copied here: the server reads them from the existing finance settings
behind `hooks/useFinanceSettings.ts` and serves them in `counter/bootstrap`. If no UPI id is set, UPI is disabled at the
counter; there is no hard-coded fallback (today `lib/receipt/upi.ts:1` and `components/home/SevaBooking.tsx:114` carry
one, section 17.4). Only a super admin may write that Firestore document (`firestore.rules`, owner card `upi`). Every
read is compared with the last payee recorded in `counter_upi_vpa` / `counter_upi_payee_name`: a change writes one
`settings.upi_changed` audit row (old and new VPA masked to the last 4 characters before `@`) and shows on the Needs
attention card `upi_changed` for 30 days; a read that cannot be recorded is not used (A3 security gate H-1).

**`cash_denominations`**

| Column | Type | Rules |
|---|---|---|
| `id` | smallint identity | pk |
| `kind` | text | check in (`note`,`coin`) |
| `value` | numeric(8,2) | check > 0 and <= 2000 |
| `display_order` | smallint | not null |
| `shown` | boolean | not null default true |
| `created_at`, `updated_at` | | trigger |

Unique `(kind, value)`. Seed: notes 500, 200, 100, 50, 20, 10; coins 20, 10, 5, 2, 1 (Round C - cash; M6 decision 6).

**`festival_days`**: `id uuid pk`, `name_en text not null`, `name_kn text null`, `active boolean not null default
true`, `updated_by_staff_id uuid null fk`, timestamps. **`festival_day_dates`**: `festival_id uuid fk on delete cascade`,
`day date not null`, pk `(festival_id, day)`, index `(day)`. A festival's chip shows in date pickers until its last date
has passed (C-61).

**`seva_list_items`** (A4P-5, owner card `lists`): the gotra, nakshatra and rashi lists temple admins keep. `kind`
(`gotra`,`nakshatra`,`rashi`), `item_id`, `name_en`, `name_kn`, `kn_checked` (true once a person saved the Kannada),
`active`, `display_order`, `updated_at`, `updated_by`; pk `(kind, item_id)`. Seeded from `lib/seva/domain/*`. A guard
trigger (`seva_list_items_guard`) keeps the 27 nakshatras and 12 rashis fixed except their Kannada spelling and refuses
deletes; gotras can be added, renamed and switched off. Written only by `seva_list_item_save`, which audits
`settings.list_item`. Slips and the counter use these names (section 13.7).

### 7.3 Numbering

**`receipt_series`**

| Column | Type | Rules |
|---|---|---|
| `code` | text | pk; check `code ~ '^(C[0-9]{1,2}|OF[0-9]{1,2}|W|WT)$'` |
| `kind` | text | check in (`counter_online`,`counter_offline`,`online`,`online_test`) |
| `counter_id` | smallint | null fk `counters`; check `(kind like 'counter%') = (counter_id is not null)` |
| `active` | boolean | not null default true |
| `created_at` | timestamptz | default now() |

Partial unique `(counter_id, kind) where counter_id is not null`. Seed: C1 and OF1 for Counter 1, W, WT. "Add a counter"
creates C2 and OF2 (settings mockup).

**`receipt_series_years`**: `series_code text fk`, `year smallint check 2026..2100`, `last_no integer not null default 0
check 0..999999`, `updated_at`; pk `(series_code, year)`. One row per series per calendar year; the row lock on UPDATE
serialises allocation (R2 s6: sequences are not gap-free).

**`receipt_number_gaps`**

| Column | Type | Rules |
|---|---|---|
| `id` | bigint identity | pk |
| `series_code`, `year` | text, smallint | fk to `receipt_series_years` |
| `from_no`, `to_no` | integer | check `to_no >= from_no` |
| `cause` | text | check in (`device_replaced`,`missing_in_sync`) |
| `status` | text | default `'open'`; check in (`open`,`entered_from_paper`,`declared_lost`) |
| `detected_at` | timestamptz | default now() |
| `resolved_at`, `resolved_by_staff_id`, `resolution_note` | | note required when status <> 'open' |

**`group_counters`**: `yymm char(4) pk`, `last_no integer not null default 0`. Gives `G-2610-0042` (C-19). Group
numbers are labels, not accounting numbers.

### 7.4 Orders, receipts and lines

**`seva_orders`** (one payment; one devotee; 1..n receipts)

| Column | Type | Rules |
|---|---|---|
| `id` | uuid | pk |
| `group_no` | text | not null unique |
| `client_order_id` | uuid | not null unique (idempotency) |
| `channel` | text | check in (`counter`,`web`,`app`) |
| `counter_id` | smallint | null fk; not null when channel = counter |
| `device_id` | uuid | null fk `counter_devices` |
| `issued_by_staff_id` | uuid | null fk `staff`; not null when channel = counter |
| `devotee_uid` | text | null; Firebase uid for online orders |
| `devotee_name` | text | not null; trimmed length 1..80 |
| `gotra` | text | null; as typed, <= 60 |
| `gotra_id` | smallint | null; matched list id |
| `nakshatra_id` | smallint | null; check 1..27 |
| `nakshatra_text` | text | null; typed fallback |
| `rashi_id` | smallint | null; check 1..12 |
| `rashi_text` | text | null; typed fallback |
| `phone_e164` | text | null; check `~ '^\+91[6-9][0-9]{9}$'` (C-31) |
| `receipts_count` | smallint | check 1..31 (C-30) |
| `amount_total` | numeric(12,2) | check > 0 |
| `payment_mode` | text | check in (`cash`,`upi`,`online`) (C-33) |
| `cash_received` | numeric(12,2) | null; check `>= amount_total` when present |
| `change_returned` | numeric(12,2) | null; equals `cash_received - amount_total` when present |
| `upi_ref_last6` | char(6) | null; check digits; required when mode = upi |
| `upi_seen_confirmed` | boolean | null; must be true when mode = upi |
| `payment_order_id` | uuid | null fk `payment_orders`; required when mode = online |
| `issued_offline` | boolean | not null default false |
| `supersedes_order_id` | uuid | null fk `seva_orders`; set when an offline order replaces an unprinted online one (8.6) |
| `test_mode` | boolean | not null default false |
| `issued_at` | timestamptz | not null (server time online; PC time offline) |
| `received_at` | timestamptz | not null default now() |
| `synced_by_staff_id` | uuid | null fk `staff`; who sent an offline order from the outbox - the person signed in at sync, who may differ from the issuer (`issued_by_staff_id`, the staff no. inside the OF numbers); check: only on an offline order, and a counter order is offline exactly when it is set |
| `created_at` | timestamptz | default now() |

Indexes: `(counter_id, issued_at)`, `(devotee_uid, created_at desc) where devotee_uid is not null`, `(phone_e164)`.
Immutable after insert (trigger raises on UPDATE of any column and on DELETE).

**`seva_receipts`**

| Column | Type | Rules |
|---|---|---|
| `id` | uuid | pk |
| `receipt_no` | text | not null unique (formatted, section 8) |
| `series_code` | text | not null fk `receipt_series` |
| `year` | smallint | IST year of issue |
| `month` | smallint | IST month of issue, check 1..12 (C-06) |
| `running_no` | integer | check 1..999999 |
| `staff_no` | smallint | null for W/WT |
| `order_id` | uuid | not null fk `seva_orders` |
| `position` | smallint | not null; 1..n within the group (display) |
| `client_receipt_id` | uuid | not null unique |
| `seva_date` | date | not null |
| `business_date` | date | not null; IST date of `issued_at` |
| `total` | numeric(12,2) | check > 0; equals the sum of its lines (checked in the function, tested) |
| `status` | text | default `'issued'`; check in (`issued`,`cancelled`) |
| `cancel_reason_code` | text | null; check in the reason list (section 9.9) |
| `cancel_note` | text | null |
| `cancelled_at` | timestamptz | null |
| `cancelled_by_staff_id` | uuid | null fk; all four cancel fields set together when cancelled |
| `refund_state` | text | default `'none'`; check in (`none`,`due`,`processing`,`done`,`failed`) |
| `refund_note` | text | null |
| `replaces_receipt_id` | uuid | null fk `seva_receipts` (spoiled reissue) |
| `qr_token` | text | not null unique; 22-char base64url of 16 random bytes |
| `prasadam_state` | text | check in (`none`,`pending`,`given`) |
| `prasadam_given_at` | timestamptz | null; required when given |
| `prasadam_given_by_staff_id` | uuid | null fk |
| `prasadam_off_date` | text | null; check in (`before`,`after`) |
| `print_count` | smallint | not null default 0 |
| `first_printed_at`, `last_printed_at` | timestamptz | null |
| `issued_at` | timestamptz | not null |
| `issued_by_staff_id` | uuid | null fk |
| `issued_by_name` | text | null; snapshot for printing |
| `issued_offline` | boolean | not null default false |
| `has_changed_amount` | boolean | not null default false |
| `test_mode` | boolean | not null default false |
| `created_at`, `updated_at` | timestamptz | trigger |

Unique `(series_code, year, running_no)`. Indexes: `(business_date)`, `(issued_at desc)`, `(order_id)`, `(status,
business_date)`, `(seva_date) where status = 'issued' and prasadam_state = 'pending'`, `(issued_by_staff_id,
issued_at)`, `(has_changed_amount) where has_changed_amount`. Trigger `seva_receipts_guard` (BEFORE UPDATE): number,
series, year, month, running no., order, seva date, total, QR token, issued fields can never change; status only moves
`issued -> cancelled`; raise on DELETE.

**`seva_receipt_lines`**

| Column | Type | Rules |
|---|---|---|
| `id` | uuid | pk |
| `receipt_id` | uuid | not null fk `seva_receipts` |
| `line_no` | smallint | unique `(receipt_id, line_no)`; check 1..8 (C-30) |
| `seva_id` | uuid | not null fk `sevas` |
| `seva_code` | text | null snapshot |
| `seva_name_en`, `seva_name_kn` | text | snapshots (en not null) |
| `quantity` | smallint | check 1..99 |
| `catalogue_rate` | numeric(10,2) | null for any-amount sevas |
| `unit_rate` | numeric(10,2) | not null; check > 0 |
| `amount` | numeric(12,2) | not null; check `amount = quantity * unit_rate` |
| `amount_changed` | boolean | generated stored: `catalogue_rate is not null and unit_rate <> catalogue_rate` |
| `change_reason` | text | check `not amount_changed or length(trim(change_reason)) >= 3` |
| `prasadam_items` | text | null snapshot |

Indexes `(receipt_id)`, `(seva_id)`. Raise on UPDATE and DELETE.

### 7.5 Day close and devotees

**`day_closes`**

| Column | Type | Rules |
|---|---|---|
| `id` | uuid | pk |
| `counter_id` | smallint | fk; unique `(counter_id, business_date)` |
| `business_date` | date | not null |
| `status` | text | check in (`closed`,`reopened`) |
| `opening_float` | numeric(12,2) | snapshot |
| `receipts_count`, `cancelled_count`, `changed_count` | integer | computed by the function |
| `cash_expected` | numeric(12,2) | float + issued cash receipts of that counter and date |
| `cash_counted` | numeric(12,2) | sum of the counts |
| `cash_difference` | numeric(12,2) | generated `cash_counted - cash_expected` |
| `upi_count` | integer | |
| `upi_expected` | numeric(12,2) | |
| `upi_bank_total` | numeric(12,2) | null; typed from the bank app |
| `upi_difference` | numeric(12,2) | generated `coalesce(upi_bank_total, upi_expected) - upi_expected` |
| `series_ranges` | jsonb | not null; per series: first, last, issued, cancelled, gaps |
| `outbox_pending` | integer | not null; must be 0 to close (C-24) |
| `note` | text | check: length >= 3 when either difference <> 0 (D23) |
| `closed_by_staff_id`, `closed_at` | uuid, timestamptz | not null |
| `reopened_by_staff_id`, `reopened_at`, `reopen_reason` | | null; reason required when reopened |
| `created_at`, `updated_at` | | trigger |

**`day_close_counts`**: `day_close_id uuid fk on delete cascade`, `kind text`, `value numeric(8,2)`, `count integer
check 0..100000`, `amount numeric(12,2) generated (value * count)`, pk `(day_close_id, kind, value)`. Values are
snapshots, so a later change to denominations does not alter old closes.

**`devotee_profiles`** (returning-devotee fill; C-32)

| Column | Type | Rules |
|---|---|---|
| `id` | uuid | pk |
| `phone_e164` | text | not null unique |
| `name` | text | not null |
| `gotra`, `gotra_id`, `nakshatra_id`, `nakshatra_text`, `rashi_id`, `rashi_text` | | as in `seva_orders` |
| `last_seen_at` | timestamptz | not null |
| `visit_count` | integer | not null default 1 |
| `created_at`, `updated_at` | | trigger |

Index `lower(name) text_pattern_ops` for prefix search. Written only by the issue functions, only when a phone is given.
A monthly job deletes profiles not seen for 3 years.

### 7.6 Audit and operations

**`audit_log`** (append-only)

| Column | Type | Rules |
|---|---|---|
| `id` | bigint identity | pk |
| `at` | timestamptz | not null default now() |
| `actor_staff_id` | uuid | null fk `staff` (null for system and gateway) |
| `actor_uid`, `actor_role` | text | null |
| `action` | text | not null (list below) |
| `entity`, `entity_id` | text | not null, null |
| `receipt_no` | text | null; for search |
| `reason` | text | null |
| `before`, `after` | jsonb | null; no phone numbers inside |
| `request_id` | uuid | null |

Indexes `(at desc)`, `(entity, entity_id)`, `(action, at desc)`, `(actor_staff_id, at desc)`. Trigger raises on UPDATE,
DELETE and TRUNCATE; `REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM service_role`. Actions: `receipt.cancel`,
`receipt.reprint`, `receipt.amount_changed`, `receipt.reissue_spoiled`, `receipt.superseded` (C-53),
`receipt.issuer_inactive_at_sync`, `prasadam.given_off_date`,
`prasadam.undo`, `prasadam.reversed`, `dayclose.close`, `dayclose.reopen`, `seva.create`, `seva.update`,
`seva.rate_change`, `settings.update`, `denominations.update`, `festival.update`, `device.register`, `device.replace`,
`gap.resolve`, `staff.onboard`, `staff.role_change`, `staff.view_only_change`, `staff.deactivate`, `staff.reactivate`,
`staff.delete`, `export.download`, `export.phones_read` (the export GET, every page with phones: part, range, cursor),
`settings.upi_changed` (no actor: the change was made in Firestore), `settings.list_item`, `payment.refund`,
`payment.fee_rule_change`, `payment.amount_mismatch`. A normal
receipt issue writes no audit row (C-36). Work done offline and synced later is audited as the person who did it on
the PC, with their role: a synced order's `receipt.amount_changed` rows name its issuer, an offline cancel's
`receipt.cancel` names whoever cancelled (and records the syncer in `after.synced_by_staff_id`). What the sync itself
does (`receipt.superseded`, `receipt.issuer_inactive_at_sync` when that person was offboarded before the sync) names
the person who synced. An offline cancel's `after` also carries `offline`, `cancelled_at`, `in_closed_day` (with
`closed_business_date`) and `late_sync` (it reached the server more than the cancel window after the receipt's issue
time). The demo seeder writes `demo.seed_started` / `demo.seed_finished` on test projects only.

**`ops_backup_runs`**: `id bigint identity pk`, `started_at`, `finished_at`, `ok boolean`, `bytes bigint`, `sha256
text`, `error text`. Written by the backup job; read by Needs attention.

### 7.7 Payments (Phase 2)

**`payment_orders`**

| Column | Type | Rules |
|---|---|---|
| `id` | uuid | pk |
| `order_ref` | text | not null unique; ours, sent to the gateway as its order id |
| `devotee_uid` | text | not null |
| `channel` | text | check in (`web`,`app`) |
| `draft` | jsonb | not null; devotee fields, seva id, dates, server-priced lines |
| `seva_amount` | numeric(12,2) | check > 0 |
| `fee_amount` | numeric(12,2) | not null default 0; check >= 0 (0 while the fee rule is off) |
| `amount_charged` | numeric(12,2) | generated `seva_amount + fee_amount` |
| `provider` | text | check in (`cashfree`,`razorpay`) |
| `provider_mode` | text | check in (`test`,`live`) |
| `provider_order_id` | text | null; unique `(provider, provider_mode, provider_order_id)` |
| `status` | text | check in (`created`,`pending`,`paid`,`failed`,`expired`,`cancelled`) |
| `seva_order_id` | uuid | null unique fk `seva_orders` |
| `expires_at` | timestamptz | not null (created + 30 min) |
| `paid_at`, `last_checked_at` | timestamptz | null |
| `failure_reason` | text | null |
| `created_at`, `updated_at` | | trigger |

Indexes `(devotee_uid, created_at desc)`, `(status, created_at) where status in ('created','pending')`.

**`payments`**: `id uuid pk`, `payment_order_id uuid fk`, `provider_payment_id text not null`, `method text check in
('upi')` (widened later), `amount numeric(12,2)`, `status text check in ('success','failed','pending','user_dropped')`,
`bank_reference text null` (UTR), `payer_vpa_masked text null`, `gateway_fee numeric(10,2) null`, `gateway_tax
numeric(10,2) null`, `verified_at timestamptz`, `raw jsonb` (minimised), `created_at`; unique `(payment_order_id,
provider_payment_id)`.

**`payment_events`**: `id bigint identity pk`, `provider text`, `provider_mode text`, `event_key text not null` (the
gateway's event id, or SHA-256 of the raw body when none), `event_type text`, `signature_ok boolean not null`,
`payment_order_id uuid null`, `received_at default now()`, `processed_at null`, `outcome text null` check in
(`issued`,`duplicate`,`not_paid`,`amount_mismatch`,`unknown_order`,`error`), `error text null`, `payload jsonb`
(minimised); unique `(provider, event_key)`.

**`refunds`**: `id uuid pk`, `payment_order_id uuid fk`, `refund_ref text unique` (ours; idempotency), `amount
numeric(12,2) check > 0`, `receipt_ids uuid[] not null`, `reason text not null check length >= 3`,
`requested_by_staff_id uuid not null fk`, `provider_refund_id text null`, `status text check in
('requested','processing','succeeded','failed')`, `failure_reason text null`, timestamps; index `(payment_order_id)`,
index `(status) where status in ('requested','processing','failed')`.

**`payment_settings`** (one row, id = 1): `fee_rule_enabled boolean not null default false`, `fee_rule jsonb null`
(e.g. flat amount and the methods it applies to; the function rejects any rule naming `upi` or a debit card, R1V),
`updated_at`, `updated_by_staff_id`. Provider and mode come from Vercel env, never from here.

### 7.8 SQL functions (signatures)

All plpgsql, `SECURITY INVOKER`, `search_path` pinned, execute granted to `service_role` only.

```sql
seva_receipt_no(p_series text, p_staff_no smallint, p_channel text, p_month smallint, p_year smallint, p_running int) returns text  -- immutable
seva_take_numbers(p_series text, p_year smallint, p_count int) returns int           -- first running no.; locks the year row
seva_next_group_no(p_issued_at timestamptz) returns text
seva_issue_counter_order(p_order jsonb, p_staff_id uuid, p_device_id uuid) returns jsonb
seva_sync_offline_order(p_order jsonb, p_staff_id uuid, p_device_id uuid, p_issuer_role text) returns jsonb
  -- p_order carries issuer_staff_no; p_staff_id is the syncer; p_issuer_role is the issuer's role read by the route
seva_issue_online_order(p_payment_order_id uuid) returns jsonb
seva_record_prints(p_receipt_ids uuid[], p_staff_id uuid, p_device_id uuid) returns jsonb
  -- a first print only for a receipt of this PC's own counter or of the W series (else SEVA:forbidden)
seva_cancel_receipts(p_receipt_ids uuid[], p_reason_code text, p_note text, p_staff_id uuid, p_is_admin boolean,
                     p_at timestamptz default null, p_cancelled_by_staff_no integer default null,
                     p_canceller_role text default null) returns jsonb
  -- offline cancel: p_cancelled_by_staff_no and p_canceller_role name who cancelled on the PC, p_at when; p_staff_id syncs
seva_settle_refund(p_receipt_ids uuid[], p_mode text, p_reference text, p_note text, p_staff_id uuid) returns jsonb
  -- A5-FIX M-3: refund 'due' -> 'done' with mode (upi | bank_transfer | cash), reference and note; receipt.refund_done
seva_reissue_spoiled(p_receipt_id uuid, p_staff_id uuid, p_device_id uuid, p_qr_token text) returns jsonb
  -- today's receipts of this PC's own counter only (another counter: SEVA:validation)
seva_issue_device(p_device_id uuid, p_allow_retired boolean) returns counter_devices  -- retired only for sync, inside its gap
seva_heartbeat(p_device_id uuid, p_outbox_count int, p_clock_skew_ms int, p_app_version text) returns jsonb
  -- { server_time, of_series, last_of_no, last_of_group_no, day_closed }
seva_offline_group_floor(p_counter_id smallint, p_device_id uuid, p_at timestamptz) returns int  -- 8.3; heartbeat and bootstrap
seva_mark_prasadam(p_receipt_id uuid, p_staff_id uuid, p_confirm_off_date boolean) returns jsonb
seva_undo_prasadam(p_receipt_id uuid, p_staff_id uuid, p_reason text, p_is_admin boolean) returns jsonb
seva_prepare_day_close(p_counter_id smallint, p_business_date date) returns jsonb
seva_close_day(p_counter_id smallint, p_business_date date, p_counts jsonb, p_upi_bank_total numeric, p_note text, p_staff_id uuid) returns uuid
seva_reopen_day(p_day_close_id uuid, p_reason text, p_staff_id uuid) returns void
seva_register_device(p_counter_id smallint, p_secret_hash text, p_label text, p_staff_id uuid) returns uuid
seva_replace_device(p_counter_id smallint, p_secret_hash text, p_label text, p_last_printed_of_no int, p_reason text, p_staff_id uuid) returns uuid
seva_resolve_gap(p_gap_id bigint, p_status text, p_note text, p_staff_id uuid) returns void
  -- A5-FIX M-6: entered_from_paper only when every number of the gap is in the register
seva_enter_paper_receipt(p_gap_id bigint, p_receipt jsonb, p_staff_id uuid) returns jsonb
  -- A5-FIX M-6: one slip of the gap from the paper book; the gap closes as entered_from_paper with its last number
seva_upsert_seva(p_seva jsonb, p_reason text, p_staff_id uuid) returns uuid  -- also sets firestore_id of a new seva
seva_update_settings(p_patch jsonb, p_staff_id uuid) returns void              -- redefined for the paper size
seva_note_counter_upi(p_vpa text, p_payee_name text) returns boolean           -- true when the payee changed (audited)
seva_mask_vpa(p_vpa text) returns text
seva_list_items_get() returns jsonb
seva_list_item_save(p_item jsonb, p_staff_id uuid) returns jsonb
seva_reorder_sevas(p_ids uuid[], p_staff_id uuid) returns void
seva_next_staff_no() returns smallint
seva_audit(p_action text, p_entity text, p_entity_id text, p_receipt_no text, p_reason text, p_before jsonb, p_after jsonb, p_staff_id uuid) returns bigint
seva_continuity(p_from date, p_to date) returns table(series_code text, year smallint, first_no int, last_no int, issued int, cancelled int, open_gaps int)
seva_dashboard(p_from timestamptz, p_to timestamptz, p_prev_from timestamptz, p_prev_to timestamptz, p_bucket text) returns jsonb
seva_needs_attention(p_from timestamptz, p_to timestamptz, p_today date) returns jsonb
```

The full list of the 75 built functions, file by file, is in `docs/DATA-MODEL.md` (Seva Entry section).

```sql
seva_create_payment_order(p_devotee_uid text, p_channel text, p_draft jsonb, p_provider text, p_mode text) returns jsonb  -- prices from sevas
seva_record_payment_event(p_provider text, p_mode text, p_event_key text, p_event_type text, p_signature_ok boolean, p_order_ref text, p_payload jsonb) returns bigint
seva_request_refund(p_payment_order_id uuid, p_receipt_ids uuid[], p_reason text, p_staff_id uuid) returns uuid
```

### 7.9 Migration files and sizing

- Files as built: `20261020000000_seva_core.sql` (staff, counters, devices, series, years, gaps, group counters,
  settings, denominations, festival days, `sevas` columns, rate history, audit log, ops),
  `20261020000100_seva_receipts.sql` (orders, receipts, lines, day closes, counts, devotee profiles),
  `20261020000200_seva_seed.sql` (series C1/OF1/W/WT, Counter 1, denominations, a settings row with sample text), the
  functions in three files `20261021000000_seva_functions_issue.sql`, `20261021000100_seva_functions_ops.sql` and
  `20261021000200_seva_functions_admin.sql`, then `20261029235900_seva_privilege_hardening.sql`,
  `20261030000000_seva_lists.sql` and `20261031000000_seva_paper_size.sql`; in Phase 2 `..._seva_payments.sql`.
  Files up to and including `20261031000000_seva_paper_size.sql` are frozen (applied on the owner's test project: the
  lists file and earlier on 2026-10-19, the paper size file on 2026-10-20): a change is a new, additive file with a
  later timestamp. The first super admin `staff` row (001) is created by a one-off script, not a migration.
- Deploying: today `.github/workflows/supabase-migrations.yml` runs only on `workflow_dispatch` (manual), not on merge
  (R3 3.2 said "on merge"; section 5.1 item 9). Either way a migration lands on the live project, so additive
  only, and each file is first run in PGlite by the database test layer.
- **Size on the Free plan (500 MB, R2 s6).** Estimate per receipt, including its share of lines, order, indexes and
  profile: about 1,345 bytes (650 receipt row and indexes + 1.3 lines x 250 + 0.8 orders x 400 + 50). At 300 receipts
  a day x 365 = 109,500 a year -> about 140 MB a year; at 150,000 a year -> about 192 MB a year (calculated 2026-10-18).
  The whole site shares the 500 MB, and the current database size is unknown (UNCLEAR, open item O-17). Needs
  attention warns at 400 MB; the answer then is archiving old years to the backup or moving to Pro (owner's choice).

## 8. Receipt numbering

### 8.1 Formats (Round B - numbering; Round C - numbers; M6 decision 4)

| Series | Who issues the number | Example | Format |
|---|---|---|---|
| C1, C2 ... | The server, for counter N online | `C1-023-10-2026/000124` | `<Cn>-<staff no. 3 digits>-<MM>-<YYYY>/<running 6 digits>` |
| OF1, OF2 ... | Counter N's own PC while offline | `OF1-023-10-2026/000007` | `<OFn>-<staff no.>-<MM>-<YYYY>/<running>` |
| W | The server, for paid online orders | `W-WEB-10-2026/000045`, `W-APP-10-2026/000046` | `W-<WEB or APP>-<MM>-<YYYY>/<running>`; WEB and APP share one running number (C-07) |
| WT | The server, gateway test mode only | `WT-WEB-10-2026/000001` | as W; never counted in totals, register or exports (C-18) |

- `MM-YYYY` is the month and year the receipt is made, in Asia/Kolkata (C-06), not the seva date.
- The running number is per series, continues through the calendar year, and restarts at 000001 on 1 January (IST).
- Staff no. is the signed-in issuer's number from `staff.staff_no`.
- Uniqueness: `(series_code, year, running_no)` and `receipt_no` are both unique in the database.
- Parsing rule (prasadam typing, search): `^(C|OF)[0-9]{1,2}-[0-9]{3}-[0-9]{2}-[0-9]{4}/[0-9]{6}$` or
  `^(W|WT)-(WEB|APP)-[0-9]{2}-[0-9]{4}/[0-9]{6}$`. The `/` is never put in a URL; URLs use the receipt id or QR token.

### 8.2 Online allocation (C and W series)

Inside `seva_issue_counter_order()` (and `seva_issue_online_order()`): compute the IST year; `INSERT INTO
receipt_series_years (series, year) ... ON CONFLICT DO NOTHING`; `UPDATE ... SET last_no = last_no + n ... RETURNING`
(row lock held to commit); insert the n receipts with consecutive numbers in date order. A failure rolls everything back
together, so no number is ever burned (the old Receipt Book allocated and wrote in two steps and could leave gaps,
R3 1.4). Each counter has its own series, so counters never wait on each other.

### 8.3 Offline allocation (OF series)

- The PC keeps `last_of_no` per year in IndexedDB. Each time it is online it reads the server's last OF number for its
  series (in `counter/bootstrap` and every heartbeat) and sets its own to the higher of the two.
- An offline order takes consecutive numbers from the PC; the slip prints at once.
- On sync, the server accepts the order exactly as printed if the device is the counter's live device and the series is
  that counter's OF series. Number rules: equal to `last_no + 1` -> stored, `last_no` moves on; already stored (same
  `client_receipt_id`) -> ignored as a duplicate; higher than `last_no + 1` -> stored and the missing range is written
  to `receipt_number_gaps` (`missing_in_sync`) and shown in Needs attention; lower but unknown -> stored if it falls in
  an open gap (closing that part of the gap), otherwise refused and flagged.
- The PC clock decides month and year for OF numbers. The heartbeat records clock skew; the counter warns when the PC
  clock is more than 2 minutes off, and the server flags offline receipts dated in the future.
- **Who.** Each offline order carries `issuerStaffNo`, the staff no. of the person signed in when it was made (the one
  inside its OF numbers); each offline cancel carries `cancelledByStaffNo` and the time it was made. Someone else may be
  signed in when the outbox is sent. The server records that person as issuer (or canceller) and the signed-in person
  as the syncer (`seva_orders.synced_by_staff_id`; for a cancel, `synced_by_staff_id` in its audit row). The person
  must be a staff member who may use the counter (3.3 row 1, role read from Firestore by the route) whose staff row is
  active, or inactive because they were offboarded after doing the work - then an audit row
  `receipt.issuer_inactive_at_sync` says so; invited and deleted rows are refused, and so is an inactive person whose
  item's recorded time (`issued_at`, or the cancel's time) is later than their `status_changed_at` (A3 security gate). An offline cancel always follows the
  counter rule: own receipt only, inside the cancel window measured from the receipt's issue time to the cancel's
  recorded time (9.9).
- **Group labels.** An offline order's group label is `G-YYMM-OF<n>-NNN`, numbered by the PC per series and IST month.
  The PC raises its group counter to the server's floor, `last_of_group_no` in every heartbeat and in
  `counter/bootstrap` (`seva_offline_group_floor`): the highest label the office holds for the counter's OF series this
  IST month or, when higher, the floor that "Replace this PC" stored on the device (8.4). So a PC never repeats a label
  (`group_no` is unique), including one a dead PC printed but never sent.

### 8.4 Devices, registration and "Replace this PC"

- **Register.** On a new PC, a temple admin signs in on the counter page, picks the counter, and presses Register. The
  PC creates a 32-byte random secret, keeps it in IndexedDB, and sends only its SHA-256 hash; the server stores the hash
  in `counter_devices`. Every counter call carries `x-seva-device: <device id>.<secret>`; the server hashes and compares.
  Online counter receipts need a live device as well as a signed-in user (C-37).
- **Replace this PC** (settings mockup): on the new PC, a temple admin picks "Move Counter 1 to this PC" and types the
  number on the last slip that came out of the printer. `seva_replace_device()` retires the old device, registers the
  new one, sets the OF `last_no` to the typed number, and records any range between the last number the server received
  and the typed number as an open gap (`device_replaced`). An admin then enters those receipts from the paper slips (one
  by one, "Enter from paper book"; the gap closes when its last number is entered) or declares them lost with a reason
  (C-52). A retired device's later uploads are accepted only for numbers inside that
  gap; anything else is refused and flagged. A retired PC reaches `POST /api/seva/counter/sync` only, and only with
  orders (its cancels are refused); every other route answers `device_unknown` (A3 security gate L-4).
- **Group label floor on replace.** The dead PC may have printed orders it never sent, each with a group label above
  what the office holds. `seva_replace_device()` stores on the new device a floor for the current IST month
  (`of_group_floor_yymm`, `of_group_floor_no`): the old PC's floor (the highest label received this month for the OF
  series, or the old PC's own stored floor when higher) plus the total size of the series' open `device_replaced` gaps
  - every unsent order used at least one OF number of such a gap. The new PC's first label comes after it, and the old
  PC's late upload keeps its own label. The floor is stored once rather than worked out at each heartbeat, so it does
  not creep up while a gap stays open; a second replacement in the same month starts from the replaced PC's floor, so
  resolving an older gap never frees its labels again.

### 8.5 Year rollover, gaps and how they are explained

- The first receipt after midnight on 31 December (IST) creates the new year row; numbers start at 000001.
- Numbers never skip by design: a spoiled print, a wrong entry or a refund is a **cancellation with a reason** that keeps
  its number (Round B - cancel; brief). The register's continuity card proves it per series (section 12.3).
- The only way a gap can appear is lost offline data (a PC dies before sending). Such a gap is never hidden: it is a row
  in `receipt_number_gaps`, critical in Needs attention until resolved, and listed in the day close and the exports.

### 8.6 The in-doubt online save (C-53)

If an online save times out (6 seconds), the counter retries the same `client_order_id` twice. If the office still does
not answer, it asks: "The office did not answer. Print as an offline receipt?" On yes it issues OF numbers under a
new `client_order_id` and records the first one as `supersedes_client_order_id`. If the server had in fact stored the C
order (but the counter never got the reply, so it was never printed), the sync finds that order with `print_count = 0`
on its receipts, cancels them with the system reason "Not printed: connection lost before the reply; reissued offline
as OF1-...", links the new order through `supersedes_order_id`, and stores the OF receipts. If the C receipts were
printed after all (a print was recorded), nothing is cancelled automatically; both stay and Needs attention asks an
admin to cancel one. Every number stays accounted for.

## 9. Counter

Route `/seva/counter` in the full-screen counter frame (the receipt screen, Today's receipts, Close day and Sign out;
no section menu; deck `shell`), designed at 1366 px, keyboard first (M6 Agent A). Layout: temple header band (photo
left, name and address centred, photo right); a slim status strip; a step indicator (1 Devotee - 2 Sevas and dates -
3 Pay and print); the current step large on the left; a sticky "This receipt" summary on the right with the devotee,
lines grouped by date, total and the primary action.

### 9.1 Status strip

Counter name; "Ramesh - 023"; connection pill (Online / Offline - 3 waiting); next number preview (`Next
C1-023-10-2026/000124`, or the OF number when offline); today's count; today's cash and UPI totals; a "Work offline"
switch; "Close day". The next-number preview is informational; the server decides the real number.

### 9.2 Step 1 - Devotee (Round B - counter f, h; Round B - fields)

| Field | Required | Control | Rules |
|---|---|---|---|
| Name | Yes, only required field | Text | Trimmed 1..80 characters; any script |
| Gotra | No | Searchable dropdown, Kannada under each option, "Use '<typed>' as entered" | 56 suggestions from R4 s3 (Kannada UNCERTAIN, proof-read) plus "Not known / ಗೊತ್ತಿಲ್ಲ"; stores typed text + matched id |
| Nakshatra | No | Same | 27 from R4 s2.1; English spelling variants are search aliases |
| Rashi | No | Same | 12 from R4 s2.2 |
| Phone | No, last | Text with +91 | 10-digit Indian mobile 6-9xxxxxxxxx; finds a returning devotee; never printed |

Nakshatra (id - English - Kannada): 1 Ashwini ಅಶ್ವಿನಿ; 2 Bharani ಭರಣಿ; 3 Krittika ಕೃತ್ತಿಕಾ; 4 Rohini ರೋಹಿಣಿ;
5 Mrigashira ಮೃಗಶಿರ; 6 Ardra ಆರ್ದ್ರಾ; 7 Punarvasu ಪುನರ್ವಸು; 8 Pushya ಪುಷ್ಯ; 9 Ashlesha ಆಶ್ಲೇಷಾ; 10 Magha ಮಘಾ;
11 Purva Phalguni ಪೂರ್ವಫಲ್ಗುಣಿ; 12 Uttara Phalguni ಉತ್ತರಫಲ್ಗುಣಿ; 13 Hasta ಹಸ್ತ; 14 Chitra ಚಿತ್ರಾ; 15 Swati ಸ್ವಾತಿ;
16 Vishakha ವಿಶಾಖ; 17 Anuradha ಅನುರಾಧ; 18 Jyeshtha ಜ್ಯೇಷ್ಠ; 19 Mula ಮೂಲ; 20 Purvashadha ಪೂರ್ವಾಷಾಢ;
21 Uttarashadha ಉತ್ತರಾಷಾಢ; 22 Shravana ಶ್ರವಣ; 23 Dhanishtha ಧನಿಷ್ಠ; 24 Shatabhisha ಶತಭಿಷ;
25 Purva Bhadrapada ಪೂರ್ವಾಭಾದ್ರ; 26 Uttara Bhadrapada ಉತ್ತರಾಭಾದ್ರ; 27 Revati ರೇವತಿ (R4 s2.1; 25 and 26 UNCERTAIN).

Rashi (id - English - Kannada): 1 Mesha ಮೇಷ; 2 Vrishabha ವೃಷಭ; 3 Mithuna ಮಿಥುನ; 4 Karkataka ಕರ್ಕಾಟಕ; 5 Simha ಸಿಂಹ;
6 Kanya ಕನ್ಯಾ; 7 Tula ತುಲಾ; 8 Vrishchika ವೃಶ್ಚಿಕ; 9 Dhanu ಧನು; 10 Makara ಮಕರ; 11 Kumbha ಕುಂಭ; 12 Meena ಮೀನ (R4 s2.2).

**Returning devotee.** Typing 3+ letters of a name, or a full phone, calls `devotees/search` (debounced 250 ms) and shows
one suggestion: "Venkatesh Rao - Bharadwaja - Rohini - phone ending 2345 - last visit 2026-09-12" with "Use these
details" / "Not this person" and an Undo after use. A receptionist searches from the registered counter PC only, and
every person is held to 60 searches a minute (per server instance), so the profiles cannot be listed by walking name
prefixes (A3 security gate L-2). Offline, matching uses the PC's cached profiles, where phones are
stored only as a salted hash plus the last 4 digits (C-32).

### 9.3 Step 2 - Sevas and dates (Round B - counter c, d, e; Round C - multidate)

- **Tiles.** Roomy grid (tiles at least 150 px wide, clear gaps). Each tile: number badge (display order 1, 2, 3 ...),
  letter code (e.g. PA), English name, Kannada name under it, price ("Any amount" for Other Seva / Karnike).
- **Adding.** Type a number and Enter in the search box; or press 1-9 while focus is on the tile grid; letters filter by
  code or name; Enter on an empty search moves to step 3.
- **Lines.** Each line: seva, quantity (1-99), Dates control, amount, "Change amount" (only if the seva allows it).
- **Dates control.** A real date picker that can select several dates when the seva is `multi_date`, otherwise one;
  default today; allowed from today to `counter_days_ahead` (365) days; never a past date (C-29). Quick chips for
  configured festival days (e.g. "Aradhane 28 / 29 / 30 Aug"), shown until the festival's last date passes (C-61).
- **Grouping.** The order is grouped by seva date. Each date becomes one receipt; several sevas on the same date share
  that receipt. The summary reads "3 receipts: Sat 28 Aug Rs 610, Sun 29 Aug Rs 105, Mon 30 Aug Rs 105. Total Rs 820."
  Limits: at most 8 lines on one receipt (slip space) and at most 31 receipts in one order (C-30).
- **Other Seva / Karnike.** Counter-only, any amount typed by the receptionist; not counted as a changed amount.

### 9.4 Override - changing an amount (Round B - override)

"Change amount" on a line sets a new **unit price** (quantity x new price). Any positive amount is accepted; the reason
is required (`amount_change_reason_required`). The line shows a "Changed" chip on screen and in the summary, and the
slip marks the changed line (Round B - override: "the line is marked on the receipt and on the dashboard"). The server re-checks: the seva must allow changes; the catalogue
rate is snapshotted beside the new rate; an audit row `receipt.amount_changed` is written; the receipt is flagged for
Needs attention.

### 9.5 Step 3 - Pay and print

- One payment for the whole order (D32): "To pay Rs 820 for 3 receipts, paid together".
- **Cash:** optional "Received" amount; change shown ("Return change Rs 180"); received must be at least the total.
  An order of Rs 2,00,000 or more in cash shows a warning to confirm (C-54).
- **UPI:** the screen shows the temple's UPI QR with the amount inside (`upi://pay?pa=&pn=&am=&cu=INR&tn=<group no>`,
  built with `lib/receipt/upi.ts`); the receptionist types the **last 6 digits** of the UPI reference and ticks "I saw
  the payment succeed on the devotee's phone". Save stays disabled until both are done.
- One mode per order; no split payment (C-33).
- Button: "Save and print 3 receipts" (Ctrl+Enter).

### 9.6 Keyboard

| Key | Effect |
|---|---|
| Enter | In step 1: next field, then step 2. In step 2: in the search box adds the typed number or code; on an empty search goes to step 3 |
| 1-9 | On the tile grid: add the nth seva |
| Ctrl+Enter | Save and print from any step once the order is valid |
| Alt+1 / Alt+2 / Alt+3 | Jump to a step |
| Esc twice (within 2 s) | Clear the order (C-60 lists it as a confirm-worthy default) |
| Arrow keys + Enter | Move and pick in dropdowns, the date picker and tiles |

Focus never leaves the form after printing: the cursor returns to Name.

### 9.7 Validation summary

Client and server share one zod schema. Server-only checks: the device is live; the staff member is active; every seva
exists, is active and is shown on the counter; prices come from the catalogue; changed amounts are allowed and carry a
reason; dates are in range; totals add up; UPI fields are present for UPI; cash received covers the total. Errors come
back as codes with plain messages ("Paaduka Pooja was switched off in Seva settings a moment ago"), never stack traces.

### 9.8 Printing and reprint

- Save -> the receipts come back (online) or are created locally (offline) -> one print job with one page per slip ->
  `window.print()` under kiosk printing -> `counter/prints` records the first print. A first print is part of issuing,
  so it is allowed only for a receipt of this PC's own counter or of the online W series; another counter's receipt
  answers `forbidden`.
- **Reprint** from Today's receipts prints the same slip with the DUPLICATE band (ನಕಲು) and "Reprinted <date time> by
  <staff no.>", same number, same QR. Any second print is a duplicate, even after a jam (C-22). Cancelled receipts cannot
  be reprinted (C-23).
- **Spoiled print** (paper jam or misprint): "Spoiled - cancel and reissue" cancels the receipt with reason "Spoiled
  print" and issues a new number on the same payment, linked by `replaces_receipt_id` (C-21; audit mockup). **Same day
  only:** only a receipt of the counter's current IST business date is reissued, so the new receipt has the same
  business date and today's day close counts the payment once (the spoiled number cancelled, the new one issued, no
  hole in the series). An earlier day's slip is refused (`validation`, field `reissue_only_today`) and the counter
  offers a DUPLICATE reprint instead, which needs no new number. A reissue is also limited to a receipt of this PC's
  own counter.

### 9.9 Today's receipts and cancel (Round B - cancel)

- List of this counter's receipts today, newest first: number, time, devotee, sevas, amount, mode, status; groups shown
  together with each date's number; search by number, name or seva.
- A receptionist can cancel **their own** receipt until `issued_at + cancel_window_minutes` (30); the row shows "Cancel
  until 11:12 AM"; after that "Past 30 minutes: a temple admin can cancel". A temple admin or super admin can cancel any
  receipt at any time.
- **Group cancel:** the dialog offers "All 3 receipts" or "Only 000124, Sat 28 Aug" and so on (C-01).
- **Reason (required):** Wrong seva entered; Wrong date; Wrong amount; Wrong devotee details; Devotee changed their mind;
  Entered twice; Spoiled print (paper jam or misprint); Other (note required). The list is a sample to confirm (C-60).
- **Money back:** cash cancelled the same business day is handed back from the drawer ("Give back Rs 820 in cash");
  `refund_state = done`. UPI cancellations set `refund_state = due`; the office refunds from the bank app and an admin
  marks it done with a note ("Mark refunded" in the register drawer or today's receipts: mode, reference, note). A receipt from an earlier day is refunded by the office, never from today's drawer (C-20).
- Offline, a receipt still in the outbox can be cancelled; the cancel travels in the outbox after the issue. An offline
  cancel is of one's own receipt only, carries the canceller's staff no. (`cancelledByStaffNo`) and the time it was
  made, and is checked at sync against that person and that time, not against whoever is signed in when it is sent
  (8.3): the cancel window runs from the receipt's issue time to the recorded cancel time. The canceller is recorded as
  `cancelled_by_staff_id`; the syncer is recorded in the audit row. The server cannot verify what an outbox says, so
  an offline **cash** cancel that reaches the server later than the receipt's issue time plus the cancel window
  (measured by the server's received time, not the PC's clock), or that falls in a day already closed for that counter,
  is stored with `refund_state = due` instead of `done`: the office checks the drawer and marks it. Needs attention
  lists every offline cancel (card `offline_cancels`) and flags the late ones and those synced by someone else.

### 9.10 Close day (Round B - counter i, j; Round B - cancel; Round C - cash)

One close per counter per business date (C-24), done by the receptionist of that counter or an admin.

1. **Cash.** Expected in the drawer = opening float (C-25) + issued cash receipts of this counter today. Count by
   denomination from settings (notes 500 ... 10; coins by value 20, 10, 5, 2, 1): each row value x count = amount.
   "Manage denominations" links admins to settings.
2. **Difference.** Counted minus expected; any difference needs a note before the day can close (D23).
3. **UPI.** Count and expected amount of UPI receipts; the receptionist types today's total from the temple's bank or
   merchant app; a difference also needs the note.
4. **Sent to the office.** Must show "Nothing is waiting to send"; closing needs the counter online.
5. **Receipt numbers today.** Per series first-last, issued, cancelled with reasons, gaps.
6. **Close day and print summary.** Writes `day_closes` and counts, writes the audit row, prints the summary, and
   saves the day's Excel copy. The summary prints on the receipt paper chosen in settings (section 10.2; owner card
   `a5`).
7. After close the counter shows "Day closed"; a temple admin can reopen with a reason (C-24).

### 9.11 Offline outbox and Excel copy (Round A - offline; Follow-ups - offline-safe)

- **Going offline** happens automatically when a call fails or times out, or by the "Work offline" switch. The strip
  turns amber: "Working offline since 10:12 AM. Receipts still save and print, cash and UPI. They use OF1 ... 3 are
  waiting. They send themselves when the line is back."
- **Outbox** (IndexedDB): each order with its client ids, local numbers, lines, payment and print state, in issue order;
  plus offline cancels. Sending happens on the `online` event, every 30 s while the page is open, and through
  Background Sync where the browser offers it (R2 s5). Each send is idempotent.
- **What works offline:** making and printing receipts, cash and UPI recording (UPI is still checked on the devotee's
  phone), returning-devotee matches from the local copy, Today's receipts, cancel of own receipts (a late or
  closed-day cash cancel becomes refund-due when it arrives, 9.9). **What needs the
  network:** sign-in of a different person, day close, settings, prasadam (C-28).
- **Local data kept:** the catalogue, settings and header photos (as blobs), denominations and festival chips; today's
  receipts (online and offline) for the list and the Excel copy; the outbox; cached devotee profiles (hashed phones).
  Older local receipts are removed after the day is closed and everything is sent.
- **Excel copy:** after the first set-up ("Choose folder", Windows folder picker through the File System Access API),
  the PC writes `<folder>\<YYYY-MM-DD>.xlsx` with every receipt of the day (online and offline), refreshed at most every
  30 s or every 20 receipts and at day close, built in a Web Worker. "Save Excel now" forces it; "Download Excel" works
  any time without a folder. Browsers may ask again for folder permission after a restart: the counter shows a one-click
  "Allow saving to D:\Seva receipts" prompt (UNVERIFIED on the real PC, open item O-08).

### 9.12 Performance at festival peaks

Several thousand receipts a day at Aradhane (Round B - counter d); 500+ on a busy day with one counter (Step 0 -
hardware); more counters can be added (C2, OF2).

| Target | Value | How |
|---|---|---|
| Keystroke to screen | under 50 ms | All step 1-2 work is local; catalogue cached |
| Save to print start (online) | p95 under 1.5 s | One API call, one SQL function, no extra round trips |
| SQL issue function | under 150 ms | One row lock per series; indexes on unique keys only in the hot path |
| Switch to offline | 6 s timeout, 2 retries | Section 8.6 |
| Prasadam lookup on 4G | under 1 s | One indexed lookup by token or number |
| Dashboard load | under 2 s | Pre-bucketed SQL; cached 60 s |

Vercel function and Supabase region should match (Mumbai ideally); both are UNCLEAR (open item O-16). Cold starts can add
about a second (UNVERIFIED); the 60-second heartbeat keeps the counter's functions warm in practice.

## 10. The printed receipt

### 10.1 Content, top to bottom (counter mockup screen 8; D10, D11)

1. Header: Photo 1 left; temple name in English, Kannada under it (C-03); address centred; Photo 2 right.
2. Optional registration line ("Regd. Trust No. ...").
3. On a reprint only: DUPLICATE band "DUPLICATE ನಕಲು".
4. Receipt No. / ರಸೀದಿ ಸಂಖ್ಯೆ: `C1-023-10-2026/000124`; "Issued 18-10-2026, 10:42 AM" (and "Reprinted ... by 023").
5. **Seva date / ಸೇವಾ ದಿನಾಂಕ** - the largest line: "Sat 28 Aug 2027".
6. For a group: "1 of 3 - paid together - group G-2610-0042".
7. Name / ಹೆಸರು; Gotra / ಗೋತ್ರ (with Kannada if matched); Nakshatra / ನಕ್ಷತ್ರ (with Kannada). Rashi / ರಾಶಿ only if
   `print_rashi` is on (off by default, C-02). Phone never (C-31).
8. Lines: seva name in English with Kannada under it, "1 x 105", amount.
9. Total / ಒಟ್ಟು "Rs 610.00"; amount in words, Indian numbering, English ("Rupees Six Hundred Ten only").
10. Payment: "Paid in cash - Rs 820 together for 3 receipts" / "Paid by UPI - ref ending 119042" / "Paid online by UPI".
11. QR (left) and "Show this at the prasadam counter on Sat 28 Aug 2027" with "ಪ್ರಸಾದ ಕೌಂಟರ್‌ನಲ್ಲಿ ತೋರಿಸಿ"
    (Kannada to be proof-read). Sevas without prasadam omit the line, keep the QR.
12. "Issued by: Ramesh (023) - Counter 1" (online: "Booked online - website" or "- temple app").
13. Footer lines ("Please keep this receipt for prasadam.") and the blessing "ಶ್ರೀ ಗುರುರಾಜೋ ವಿಜಯತೇ".

Never changeable after issue: number, date and time, amounts, amount in words, seva date, the group line (mockup "How it
prints"). Header, footer, the prasadam line and which devotee details print come from Settings - Receipts.

### 10.2 Layout and print CSS

- Paper (owner card `a5`, 2026-10-19; replaces the fixed 99 x 210 mm slip of D11): **configurable in Settings -
  Receipts**, portrait only, one receipt per sheet; a group of 3 prints 3 sheets in one job. Presets: **A5 148 x 210 mm
  (default)**, A6 105 x 148 mm, one-third A4 99 x 210 mm, 80 mm roll, 58 mm roll (height fitted to the content plus a
  6 mm tear margin), and custom (width 50-216 mm, height 80-356 mm, height at least the width). Stored in
  `seva_settings.paper_size` and `paper_custom_w_mm` / `paper_custom_h_mm`; a missing or bad value prints on A5. The day
  close summary follows the receipt paper; the board summary stays A4.
- CSS (print): the print job writes one `@page { size: <w>mm <h>mm; margin: 0 }` rule for the chosen paper at print
  time (`lib/seva/print/paper.ts`, `printSlips.ts`); the slip's inner padding replaces the page margin, and a fixed
  page keeps 1 mm of slack so rounding never pushes a slip onto a second sheet. A slip too long for a fixed page is
  shrunk (not below 70%), never clipped.
- Type: Inter for Latin, Noto Sans Kannada for Kannada (already loaded by `app/layout.tsx:24-25`, so no new download).
  The type sizes, the QR size and whether the header photos print are picked per paper (`slipLayout`); no text below
  9 pt, and on A5 the body is about 10 pt with the seva date the largest line. Pure black on white; no light greys or hairlines. Print waits for `document.fonts.ready` and the photos.
- A5 and A6 are standard driver sizes; one-third A4 and custom need a custom form on the Windows driver
  (SETUP-GUIDE A5.3; UNVERIFIED on the temple printer, open item O-05). Kiosk printing sends to the Windows default printer with no dialog (R2 s2).

### 10.3 QR token rules

- Each receipt gets its own `qr_token`: 16 random bytes from a secure generator, base64url (22 characters); never the
  receipt id, never derived from the number; unique in the database.
- The QR encodes `https://<site>/r/<token>` (C-50), error correction M, printed about 26 mm square with a 4-module quiet
  zone (laser prints far sharper than the 203 dpi thermal R2 sized for; test with 2-3 older phones, open item O-06).
- A reprint keeps the same token. A cancelled receipt keeps its token; scanning shows "Cancelled".
- `/r/<token>` without sign-in shows the same details as the printed slip - temple, receipt number, seva date,
  devotee name, gotra, nakshatra, sevas, amounts, payment mode - plus "valid" or "cancelled" and prasadam given or not.
  Never the phone number (owner, Design Book - calls-privacy). A signed-in prasadam user is sent straight to the give screen.
- The prasadam counter's text box accepts the QR URL, the bare token, or a typed receipt number, so a USB scanner that
  "types" the QR and presses Enter works without set-up.

## 11. Prasadam counter

Route `/seva/prasadam` (the prasadam role lands here), phone first (390 px), also usable on a PC with a USB scanner
(Round B - prasadam).

| Screen | When | What it shows | Actions |
|---|---|---|---|
| Scan QR / Type receipt number | Start | Segmented switch, equal weight; camera frame or a number box ("A USB scanner types here and presses Enter for you"); "Given 36" today | Find receipt |
| Ready to give (green) | Issued, today's date, not given | Devotee name, receipt number, time made, each seva with Kannada under it and what to hand over; **no amounts** | **Mark given**, Not now |
| Another day (amber) | Seva date is not today | "This prasadam is for Sat 29 Aug - not today" or "This seva was on Sat 17 Oct (1 day ago)"; group line; "Today's slip is 1 of 3, ending 004812" | **Give anyway** (second tap), Scan next (D35) |
| Marked given | After marking | "Marked given 11:05 - Venkatesh Rao - C1-..."; camera ready | Undo (same person, 120 s; C-27) |
| Already given | Given before | "Given at 11:05 by Suresh. Do not give again. If the devotee disagrees, ask the receptionist." | Scan next |
| Receipt cancelled (red) | Cancelled | Cancelled time, by whom, reason; "If the devotee has a newer slip, scan that one." | Scan next |
| No prasadam | No line gives prasadam | "This seva has no prasadam" | Scan next |
| Not found | No match | "Nothing matches C1-023-10-2026/009999. Check the number and type it again." | Type again, Scan QR instead |

Rules:
- The answer to the caller's own successful give carries `givenNow: true`, so the screen shows "Marked given" with
  Undo; a receipt given earlier answers with `givenNow: false` and shows "Already given".
- Prasadam is marked **once per receipt** (all its lines together). The state moves `pending -> given`; undo returns it
  to `pending` within 120 s by the same person; later only a temple admin can reverse it, with a reason.
- Before and after the seva date: allowed with a warning and a second tap; `prasadam_off_date` records which, and the
  audit gets `prasadam.given_off_date` (D35).
- Typed lookup accepts the full number or a short form: `C1 124`, `C1/124`, or `124` (current year). When the short
  form matches several series, a pick list shows them (C-51).
- Camera scanning uses the browser's `BarcodeDetector` where available, otherwise a small JS decoder (Builder's call).
  HTTPS is required for the camera.
- No offline mode in Phase 1 (C-28): with no connection the page says so and asks the volunteer to check the date on the
  slip by eye and mark it later.

## 12. Dashboard, register, reports, audit, exports

### 12.1 Dashboard (`/seva`, Round B - dashboard; M6c)

Top to bottom, desktop 1366 px and phone 390 px in the same order:

1. Title "Dashboard", date, "as of 18:05", and the **period switch** as a segmented control: Today / This week /
   This month / This year. Every number and chart below follows it.
2. **Needs attention** (section 12.2), each card linking to the right filtered screen.
3. **Summary tiles:** Total collected, Receipts, Cash, UPI, and a quiet Online tile ("starts in Phase 2"), each with the
   change against the previous period.
4. **Collections / ಸಂಗ್ರಹ** - the hero chart: stacked bars by payment mode (cash, UPI, online) per bucket, with the
   previous period as a dashed grey ghost line; tooltips on hover and tap.
5. Details: Top sevas / ಪ್ರಮುಖ ಸೇವೆಗಳು (ranked bars, amount or count, arrow against the previous period); Payment mode /
   ಪಾವತಿ ವಿಧಾನ (donut for Today and Week, 100% stacked bars for Month and Year); Counter rush hours /
   ಕೌಂಟರ್ ದಟ್ಟಣೆ ಸಮಯ (hour x weekday heatmap); Festival peaks / ಹಬ್ಬದ ದಟ್ಟಣೆ (calendar heatmap of the year,
   festival days outlined; on the first screen when Year is chosen, one tap deeper otherwise).

**Metric definitions.**

| Metric | Definition |
|---|---|
| Total collected | Sum of `total` of receipts with status `issued`, `test_mode = false`, issued in the period (by `issued_at`, IST). Cancelled receipts are excluded; a spoiled reissue counts once |
| Receipts | Count of those receipts |
| Cash, UPI, Online | The same, split by the order's payment mode |
| Change | (this period - previous period) / previous period, shown as +n% or -n%; "no data" when the previous period is empty |
| Collections (hero) | By issue time (cash flow), not by seva date (C-63) |
| Top sevas | Sum of line amounts and quantities by seva, issued receipts only, at the amount actually paid |

**Period rules** (all Asia/Kolkata):

| Period | Current span | Compared with | Buckets |
|---|---|---|---|
| Today | 00:00 to now | Yesterday 00:00 to the same clock time (C-04) | By hour, 05:00-22:00 |
| This week | Monday 00:00 to now (C-13) | Last week, Monday to the same weekday and time | By day |
| This month | 1st to now | Last month, 1st to the same day number and time (capped at month end) | By day |
| This year | 1 January to now (calendar year, C-05) | Last year, 1 January to the same date and time | By month |

The mockup compared the whole of last week; like-for-like is used instead (C-13; section 5.1 item 11). In the first
year there is no previous-year data; the tile says so (section 5.1 item 12).

### 12.2 Needs attention rules

| Card | Rule | Level | Links to |
|---|---|---|---|
| Changed amounts | Count of receipts with a changed amount in the period | attention | Register, filter "Changed amount" |
| Cancellations | Count in the period; any cancelled after the 30-minute window is named | attention | Register, filter "Cancelled" |
| Day close short or extra | Any close in the period whose cash or UPI difference exceeds the threshold (default Rs 0, C-26) | critical if short, attention if extra | Day closes |
| Day not closed | Yesterday or earlier, a counter with receipts and no close | critical | Day close |
| Waiting to sync | Counters whose last heartbeat reported a non-empty outbox, or that have not been seen for 10 minutes during the day | attention | Register |
| Number gaps | Any open row in `receipt_number_gaps` | critical | Register continuity |
| Prasadam pending | Issued receipts with prasadam pending whose seva date is today ("oldest 14:10"), plus the count not collected for past dates in the period | attention | Register, filter "Prasadam pending" |
| UPI refunds due | Receipts with `refund_state = due` | attention | Register |
| Clock skew | A counter PC more than 2 minutes off | attention | Settings - Counters |
| Backup | Last nightly backup failed or older than 36 hours | critical | (text only) |
| Database size | Above 400 MB | attention | (text only) |
| Offline cancels (`offline_cancels`) | Every offline cancel in the period: receipt, recorded time, received time, canceller, syncer | attention when the canceller is not the syncer or the cancel arrived late | Register |
| Counter UPI changed (`upi_changed`) | Every change of the counter UPI payee in the last 30 days, whatever period is chosen; names the latest, masked | attention | Audit trail |
| Phase 2: payments | Paid but not issued; pending over 30 minutes; refund failed; possible double payment (same account, seva and dates, two paid orders within 30 minutes) | critical / attention | Payments |

A card with nothing to report shows a calm "0" line (as the mockup's "0 waiting to sync").

### 12.3 Receipts register (`/seva/register`)

Every receipt number in order with its status. Filters: from, to, seva, payment (cash and UPI, cash, UPI, online),
status (issued, cancelled, changed amount, duplicate printed, prasadam pending), search by number or name. **Number
continuity card**, one line per series for the chosen range: "C1 Counter 1 online, C1-023-10-2026/000101 - 000227,
127 numbers, 125 issued, 2 cancelled, Continuous"; OF1 and W the same (W "starts in Phase 2"). Built from
`seva_continuity()`. A row opens the receipt with its history (prints, cancel, prasadam, audit rows). Below 768 px rows
become cards.

### 12.4 Reports (`/seva/reports`)

- **Seva summary:** count and amount per seva for a range against the same days last year; a treemap "Where the money
  comes from / ಸೇವಾ ಪಾಲು" (category, then seva). Counts by **seva date** for planning (C-63). Rate changes show under
  the seva name ("Rate Rs 150 -> Rs 200 from 16 Oct 2026").
- **Festival view:** pick a festival (from festival days) and compare with an earlier year: sevas, amount, prasadam
  handed over vs receipts, receipts per festival day chart, and a plain planning line for prasadam packets.
- **Audit trail:** everything that changed money or rules, newest first, filter by type (rate changes, cancellations,
  changed amounts, day closes, staff) and person; each entry says who, when and why, with a link to the receipt or day.
- **Day closes:** one row per counter per day: receipts, cash expected and counted, UPI expected and confirmed,
  difference badge (balanced, short, extra), closed by; a row opens the detail with counts by denomination and the note.

### 12.5 Charts (ECharts 6.x, D34; R5)

| # | Chart | Where | Phase |
|---|---|---|---|
| 1 | Collections, stacked by mode, previous-period ghost line | Dashboard hero | 1 |
| 2 | Tile sparklines | Dashboard tiles (optional) | 1 |
| 3 | Payment mode donut / 100% bars | Dashboard details | 1 |
| 4 | Top sevas ranked bars | Dashboard details | 1 |
| 5 | Festival peaks calendar heatmap | Dashboard (Year) and festival view | 1 |
| 6 | Counter rush hours heatmap | Dashboard details | 1 |
| 7 | Seva share treemap | Seva summary | 1 |
| 8 | Pace today half-gauge | One tap deeper | Later |

Rules: `echarts/core` with only the series used; loaded with `next/dynamic` only on dashboard and report pages; SVG
renderer; colours read from the module's `--chart-*` tokens with `getComputedStyle`, converted to rgb on a 1x1 canvas
(ECharts cannot parse oklch, R5 s4); re-render on theme change and resize; `animation: false` under
`prefers-reduced-motion: reduce`; tooltips `triggerOn: 'mousemove|click'`, `confine: true`; labels at least 13 px;
amounts with `Intl.NumberFormat('en-IN')`; a visually hidden data table under each chart; "as of HH:MM" note; English
title with Kannada under it. Charts receive small pre-bucketed arrays from the server, never raw receipts.

### 12.6 Exports (`Export` dialog; mockup "Export")

| Format | Content |
|---|---|
| Excel (.xlsx) | One workbook, 7 sheets: Summary; Receipts (receipt no., series, date, time, devotee, seva(s), amount, mode, status, gotra, nakshatra, rashi, seva code, UPI ref last 6, issued by, prasadam); Sevas (with last year); Cancelled and changed; Day closes; Prasadam; Rate changes |
| CSV | One row per seva line (`receipt_no, series, date, seva_code, amount, mode, status, ...`); each ticked part a separate file, zipped |
| Tally import | Two lines per receipt: cash, UPI or online ledger debited, the seva's income ledger credited; cancelled receipts left out; columns Voucher Date, Voucher Type (Receipt), Voucher Number (the receipt no.), Ledger Name, Amount (Dr+/Cr-); header names configurable to the temple's Tally mapping (R4 s5, to confirm with the accountant) |
| Print summary (for the trust board) | A print-styled A4 HTML page, 2 pages, large type: page 1 totals, the Collections chart, needs-attention items; page 2 seva table with last year, day-close differences, cancellations and changed amounts with reasons, rate changes; footer with range, who prepared it and when, and the blessing. "Save as PDF" from the browser gives the PDF (C-42) |

Ranges: Today, This month, Last month, This year, or custom. "Devotee phone numbers" is off by default and offered only
to non-view-only temple admins and super admins (C-16). Files are built in the browser from paged API data (C-41).
Every export writes `export.download` to the audit (format, range, parts, whether phones were included). An export
with phone numbers is also audited on the server: the export GET writes `export.phones_read` (part, range, cursor) on
every page that includes phones, before any row is read, and refuses the page when that write fails (A3 security gate
M-3).

## 13. Settings

All under `/seva/seva-settings`, `/seva/settings/*` and `/admin/users` (Staff stays in the website admin and is linked
from the module); temple admin and super admin
edit, view-only temple admins see read-only. Every save writes an audit row. "Changes apply to receipts made after you
save."

### 13.1 Sevas (`/seva/seva-settings`, extends the old `app/admin/receipts/seva-settings/page.tsx`)

List columns: Key (drag to reorder; it is the counter number key), Code, Seva (English, Kannada under), Rate, Counter /
online / both, Several dates, Prasadam, Active, Edit. Edit drawer: short code (2-3 letters), counter key, name in English,
name in Kannada, rate (when it changes: "Was Rs 1,005. Receipts already made keep their rate." and a required reason),
shown on (Counter, Online, Both), "Can be booked for several dates - each date gets its own receipt", "Counter may change
the amount", "Prasadam given", "What the prasadam counter gives", Active, and the rate history. Other Seva / Karnike is
always counter-only and takes any amount. Sevas are never deleted, only switched off. Rate changes apply when saved
(C-35). A save goes through `seva_upsert_seva`, which also sets a new seva's `firestore_id`; the server then mirrors
the public fields to Firestore `sevas` with the admin SDK (C-39). Client writes to Firestore `sevas` and to
`settings/financeSettings` are super admin only in `firestore.rules` (A3 security gate).

### 13.2 Receipts (template and numbering)

- Numbering preview part by part (series, staff no., month and year, running number) with the four formats of
  section 8.1, and the line "The running number continues all year and starts again on 1 January" (D33).
- **Counters:** list (Counter 1 - Office PC - online C1, offline OF1, last numbers), "+ Add a counter (C2 and OF2)",
  Register this PC, "Replace this PC" (section 8.4), opening float.
- **Header and footer:** temple name English and Kannada, address lines 1-2, registration line (optional), Photo 1
  (left), Photo 2 (right), footer lines 1-2, blessing, which devotee details print (gotra, nakshatra, rashi), and a live
  slip preview. The header is also the band on the counter screen (D10).
- **Counter rules:** cancel window (minutes), note required for a cash difference, reason required for a changed amount,
  days ahead for counter dates, day-close flag threshold.
- **Paper size** (`/seva/settings/receipt`, card `a5`): A5 (default), A6, one-third A4, 80 mm roll, 58 mm roll, or custom
  width and height, with the live preview drawn at that size (section 10.2).

### 13.3 Cash denominations

Notes and coins with values; add (kind, value 1-2,000), remove, reorder, hide; a preview of how day close shows them
("Rs 10 coin x count"). Coins are counted by value (Round B - counter j). Changes apply from the next day close.

### 13.4 Festival days

Named festivals with one or more dates, English and Kannada names; they appear as quick chips in every date picker
(counter and website) until their last date passes. "Copy from festival calendar" offers the dates the website already
knows (source UNCLEAR: the events or panchanga data; Builder's call after checking). Aradhane dates are samples until the
office sends them (C-11).

### 13.5 Payments status (Phase 2)

Status page only: provider and mode (Test mode banner), "Keys found in Vercel - never shown or typed here", last
payment alert time and "signature verified", "Send a test payment" (Rs 1, test mode), the fee rule (off: "The temple
pays the gateway fee. Devotees pay exactly the seva rate."; only a super admin can change it), recent online payments
(time, receipts, devotee, seva and dates, amount, status: paid, checking with bank, failed, paid twice), refunds with
reason, and "Going live: 2 steps" (section 14.6).

### 13.6 Staff and roles (extends `app/admin/users`)

- List: staff no., name and email, role, view-only badge, status (Active, Invited, Inactive), last active; filter All /
  Active / Inactive; "Inactive staff cannot sign in and stay for the audit trail."
- **Onboard staff** (temple admin or super admin): staff no. pre-filled (next free), full name, email, role, view-only
  (temple admins only). The server creates the Firebase Auth user, the Firestore `users` doc (role, `isActive: true`)
  and the `staff` row (`invited`); the client then asks Firebase to send its own set-password email, which costs
  nothing; the person signs in with Google or with that email and a password (C-56).
- **Drawer:** role (only a super admin can give Super admin), view-only switch, status with Deactivate / Reactivate,
  and for super admins only "Offboard (deactivate)" and "Delete user", both needing a reason; delete warns that
  deactivating is usually right and that past receipts keep the name and staff no.
- The existing `app/api/admin/users/create-admin` and `set-role` routes are brought under the same rules (section 17).
- Reactivating a person whose role is Super admin needs a super admin (A3 security gate).

### 13.7 Gotra, nakshatra and rashi lists (`/seva/settings/lists`, A4P-5)

Temple admins add gotras, correct a gotra's English or Kannada name and switch one off; nakshatra and rashi names are
fixed, only their Kannada spelling can be corrected. A Kannada name saved by a person is marked checked; nothing is
deleted. Every change is audited (`settings.list_item`). The counter, slips and reports use these names (the table
`seva_list_items`, section 7.2); view-only temple admins see the page read-only.

## 14. Phase 2: devotee booking and payments

### 14.1 Devotee booking (website and Expo app; D16, D27)

- **Sign in:** Google, or email and password (existing Firebase sign-in on the website; added to `apps/mobile`, which
  has no Firebase today - C-48). Receipts stay in the account under "My seva bookings".
- **Choose a seva:** only sevas with visibility online or both; fixed prices; "Need a different amount? Please visit the
  counter."
- **Details and dates:** the same fields as the counter (name required, gotra, nakshatra, rashi, phone last, optional).
  "Booked before" offers only this account's own earlier details (C-10). Seva dates with a real date picker (one or more
  if the seva allows), festival chips as a shortcut; allowed from today to 90 days ahead; same-day bookings close at
  12:00 (C-29). Each date becomes its own e-receipt.
- **Review and pay:** one clear amount, "No extra charges" (the temple absorbs the fee, D15); "Pay Rs 1,515 by UPI".
- **Checkout:** the gateway's hosted page, **UPI only** (no card option anywhere, Round B - devotee). In the app, the
  website's checkout page opens in an in-app browser and returns to the app by a deep link (C-47).
- **Pending:** "Payment not confirmed yet. Do not pay again. We are checking with the bank." The page re-checks by itself.
- **E-receipts:** one per date, each with its own `W-WEB-...` or `W-APP-...` number and QR, the seva date large, and
  "1 of 3 - paid together - group ..."; a free share link (C-44).

### 14.2 Provider adapter interface

```ts
export interface PaymentProvider {
  readonly name: 'cashfree' | 'razorpay';
  readonly mode: 'test' | 'live';
  createOrder(input: { orderRef: string; amountPaise: number; customer: { uid: string; name: string; phone?: string; email?: string };
                       returnUrl: string; expiresAt: Date }): Promise<{ providerOrderId: string; checkout: { sessionId: string } }>;
  fetchOrder(orderRef: string): Promise<{ status: 'pending' | 'paid' | 'failed' | 'expired'; amountPaise: number;
                       payments: { providerPaymentId: string; method: string; status: string; amountPaise: number; bankReference?: string }[] }>;
  verifyWebhook(rawBody: string, headers: Headers): { eventKey: string; eventType: string; orderRef?: string } | null;
  createRefund(input: { orderRef: string; refundRef: string; amountPaise: number; reason: string }): Promise<{ providerRefundId: string; status: 'processing' | 'succeeded' | 'failed' }>;
  fetchRefund(orderRef: string, refundRef: string): Promise<{ status: 'processing' | 'succeeded' | 'failed'; failureReason?: string }>;
}
```

`lib/seva/payments/index.ts` picks the implementation from `PAYMENTS_PROVIDER` and `PAYMENTS_MODE`. Only the Cashfree
implementation is built now; Razorpay is Later (C-43). Webhook payloads are never trusted for money: they only trigger a
re-fetch.

### 14.3 Sequences

**Order.**
1. Devotee -> `POST /api/seva/devotee/orders` {seva id, dates, devotee fields, channel}.
2. Server: verify Firebase token; check limits (no more than 10 open orders per account per hour); `seva_create_payment_order()`
   prices from `sevas`, checks visibility, dates, cut-off, multi-date; fee 0 while the rule is off; status `created`.
3. Adapter `createOrder` with our `order_ref` and a 30-minute expiry; store `provider_order_id`; status `pending`.
4. Return the checkout session; the client opens the hosted UPI checkout.

**Webhook.**
1. Gateway -> `POST /api/seva/payments/webhook/cashfree`; read the **raw body** first.
2. `verifyWebhook`: Cashfree signs `timestamp + raw body` with HMAC-SHA256 and the secret key, Base64, in
   `x-webhook-signature` (R1V C5; that doc page covers payment forms, so confirm the PG order webhook format in test mode,
   UNCLEAR). Constant-time compare. A bad signature is logged with `signature_ok = false` and answered 401.
3. `seva_record_payment_event()` (unique `event_key`): a duplicate returns 200 at once.
4. `fetchOrder(order_ref)` from the gateway. Only if it says paid, the amount equals `amount_charged`, the currency is
   INR and the order ref matches: `seva_issue_online_order()` issues the W (or WT) receipts, idempotently.
5. Mismatch: no receipt, `payment.amount_mismatch` audit, critical Needs attention. Always answer 200 once recorded, so the
   gateway does not retry forever.

**Reconcile.** The pending page and the admin Payments page re-fetch any order pending for more than 15 seconds since its
last check; a scheduled sweep re-fetches orders pending over 5 minutes and expires those past `expires_at`. Vercel Cron
frequency depends on the plan (UNCLEAR, open item O-16). Money confirmed after expiry or after the seva date has passed
still gets receipts, and the admin is told to decide on a refund (C-45).

**Refund.** Temple admin or super admin -> `POST /api/seva/payments/refunds` {receipt ids or order, reason} ->
`seva_request_refund()` cancels the chosen receipts with reason "Refunded" and creates the `refunds` row -> adapter
`createRefund` with our `refund_ref` (idempotent) -> status from the response and later webhooks or `fetchRefund`. A
failed refund is critical in Needs attention (C-46). Cashfree allows refunds within six months of payment (R1V C5).

### 14.4 Test mode versus live

- Keys and mode live in Vercel env only: `PAYMENTS_PROVIDER=cashfree`, `PAYMENTS_MODE=test|live`, `CASHFREE_APP_ID`,
  `CASHFREE_SECRET_KEY` (names Builder's call). Never in the database, never in the admin UI (D14; mockup).
- Test mode issues receipts in series WT, marked `test_mode`, excluded from totals, register, continuity and exports,
  so live numbering starts clean at W 000001 (C-18).
- The Payments page shows the mode at the top; the devotee checkout shows "Test mode: no real money moves."

### 14.5 E-receipts and messaging

E-receipts live in the account and on the success page. Paid SMS or WhatsApp sending is Later until the owner approves
the cost (C-44); Phase 2 gives a free "Share" link (the devotee's own phone shares it). The old stub
`app/api/admin/receipts/[id]/send/route.ts` is retired (R3 1.1).

### 14.6 Going live in two steps (mockup "Payments")

Prerequisites (owner, section 23): Cashfree account activated for the trust (trust deed or registration certificate,
80G/12A, trust PAN and bank details, R1V C5); written answer from Cashfree on what it charges on UPI up to Rs 2,000;
the CA's answers below. Then: (1) in Vercel, replace the test keys with the live keys and set `PAYMENTS_MODE=live`;
(2) Redeploy. The page shows Live; make one small real payment, check the receipt, then refund it to test refunds.

### 14.7 Legal notes and what the owner must confirm with a CA

Sources: R1V (verified 2026-10-18) where it differs from R1.

- UPI up to Rs 2,000 and RuPay debit: no bank or system provider may impose any charge on payer or payee (S.O. 5067(E),
  2026-09-14). Whether a gateway's "platform fee" is such a charge is UNCLEAR - ask the CA or a lawyer, and ask Cashfree
  in writing (R1V C1).
- UPI MDR of 0.4% above Rs 2,000 is **not live yet**: NPCI deferred it on 2026-10-13 to a date after Diwali to be
  notified (R1V C2). When it starts, merchants cannot pass it to customers.
- No surcharge on any debit card (RBI 2017, still extant, R1V C3). Credit card, net banking, wallets: no RBI ban, but
  any charge must be shown before payment (RBI PA Directions 2025); Visa allows only a flat disclosed fee (R1V C4).
  Hence the fee rule stays off and can never name UPI or a debit card.
- Cashfree's festive offer waives the platform fee on the first Rs 20 lakh for new sign-ups from 2026-07-21, but GST is
  still charged on a notional 1.95%: about Rs 0.88 on a Rs 250 seva, so the temple nets about Rs 249.12 (R1V C5, C7).
- **Confirm with the CA:** (a) seva receipts are not donations and not eligible for 80G unless the auditor says otherwise
  (R4 s4.3) - whether the slip should say "Seva receipt - not a donation"; (b) GST treatment of seva income and of any
  fee; (c) whether the trust holds 12A/80G (needed for gateway onboarding); (d) how long receipts must be kept (this
  design keeps them indefinitely); (e) the cash limit for one person in one day (Income Tax s.269ST, Rs 2,00,000; C-54);
  (f) data-protection duties for devotee details under the Digital Personal Data Protection Act, 2023 and its rules.

## 15. Security and privacy

### 15.1 Controls

| Area | Control |
|---|---|
| Database access | Only server code, only `createAdminClient()` (service role, `import 'server-only'`, `lib/supabase/admin.ts:1`). RLS deny-all and `REVOKE` on every new table; functions executable by `service_role` only |
| Identity | Firebase ID token verified server-side on every call (`getAuth(adminApp).verifyIdToken`), then the Firestore user doc |
| Authorisation | Allow-list per route (section 3.3) in `lib/seva/server/auth.ts`; `lib/auth/admin-auth.ts` `BLOCKED_ROLES` replaced by an explicit allow-list (section 17.4). Unknown, empty or misspelt roles are denied. Staff status must be `active`; view-only blocks every write |
| Counter binding | Device token for every counter call (C-37); a receptionist's devotee search and cancel need it too; a retired PC reaches only the sync route, with orders inside its gap (A3 security gate L-2, L-4); the PC is read only after the sign-in is verified (L-1) |
| Rate limits | `/r/<token>` 30 a minute per IP; devotee search 60 a minute per person; in memory, so per server instance |
| Counter UPI id | Firestore `settings/financeSettings` writable by super admins only; every read compared with the last recorded payee, a change audited (`settings.upi_changed`) and shown in Needs attention (`upi_changed`) |
| Integrity | Prices from the catalogue on the server; immutable receipts and lines (triggers); append-only audit; numbers in the same transaction as the insert |
| Idempotency | `client_order_id`, `client_receipt_id`, webhook `event_key`, `refund_ref` all unique |
| Webhooks | Raw-body HMAC check, constant-time compare, then server re-fetch before any receipt (section 14.3) |
| Secrets | Vercel env only; never in the database, client bundle or logs. The committed service-account key is revoked by the owner and the scripts stop embedding keys (section 17.4) |
| Public surfaces | `/r/<token>`: unguessable 128-bit token; shows what the slip already shows, never the phone; rate-limited per IP. `/api/public/receipts` fixed (section 17.4). Devotee order creation needs sign-in and is rate-limited per account |
| Browser | React escaping; no `dangerouslySetInnerHTML` with user text; Bearer tokens in headers (no cookie session, so no CSRF surface for these routes) |
| Errors and logs | Error codes and plain messages to the client; server logs carry ids, never names or phone numbers |
| Firestore rules | `users` create may not set `role` other than `devotee`, nor `isActive`/`isApproved` (fix for `firestore.rules:39`); `sevas` and `settings/financeSettings` writes super admin only; `isSuperAdmin()` also needs `isActive` not false |

### 15.2 Personal data

| Data | Where | Who sees it | Kept |
|---|---|---|---|
| Devotee name, gotra, nakshatra, rashi | Receipts (Supabase), slip, Excel copy | Receptionist, admins, prasadam (name only) | With the receipt (indefinitely unless the CA says otherwise) |
| Devotee phone | Order and devotee profile (Supabase); hashed + last 4 on the counter PC | Receptionist (last 4 in suggestions), admins | Profile deleted after 3 years unseen (C-32) |
| Online account (uid, email) | Firebase; uid on orders | Admins (email only on the Payments page) | Account lifetime |
| Payer VPA | Masked only | Admins | With the payment |
| Staff email and name | Firebase, Firestore, `staff` | Admins | Kept for audit, even after delete |

Phone numbers never print, never appear in audit JSON, and are excluded from exports unless explicitly ticked by a
permitted person (audited on the server for every page, `export.phones_read`, and for the finished file,
`export.download`). The counter PC holds personal data: it needs a Windows password, an account per PC, and
BitLocker if available (open item O-09). A short notice at the counter and on the booking page says why details are
kept ("to fill them faster next time and to find your receipt"); wording for the owner to approve (O-19).

## 16. Backups and resilience

### 16.1 Layers (D9, D12)

1. **Supabase** itself - the Free plan has no downloadable backups (R2 s6).
2. **Nightly encrypted backup** - GitHub Actions at 02:30 IST: `pg_dump` of the database (seva tables and the rest) using
   a pooler connection string from a repository secret (GitHub runners lack IPv6, so the direct connection may fail -
   UNVERIFIED), compress, encrypt with `age` to two public keys (one for Nikhil, one for the site owner; owner card `backup-who`,
   2026-10-19), either private key opening it alone, the private keys kept offline by their holders, upload as a
   workflow artifact kept 30 days plus the first-of-month copy kept 90 days as built (C-57), and write a row to
   `ops_backup_runs`. The `pg_dump` client version must match the server's (UNCLEAR: config says 15, R3 3.5).
3. **Counter Excel copy** of each day in a chosen folder (section 9.11), plus "Download Excel" any time.
4. **Counter outbox and today's receipts** in IndexedDB.
5. **The paper slips** themselves (numbered) and the printed day-close summary.

Restore drill once a month (and before go-live): restore the latest dump into a scratch database (a second free Supabase
project or an embedded Postgres) and run the continuity check against it. Recovery point: 24 hours for the database;
today's counter receipts are also in the Excel copy, and online payments can be re-fetched from the gateway. Recovery
time: a few hours (new project, restore, update env, redeploy).

### 16.2 Failure scenarios

| Failure | What happens | What staff do |
|---|---|---|
| Internet down at the counter | Offline mode, OF series, outbox, Excel copy | Nothing; it sends itself later |
| Supabase or Vercel down | Same as above for the counter; dashboard and prasadam unavailable | Counter carries on; prasadam checks the slip date by eye |
| Firebase Auth down | Signed-in staff continue (offline if needed); new sign-ins fail | Keep the shift's person signed in |
| Counter PC dies | New PC, "Replace this PC", type the last slip number; any unsent range becomes an open gap | Admin enters those slips from paper or declares them lost |
| Printer jam or misprint | Receipt exists | Spoiled - cancel and reissue (same day only), or reprint (DUPLICATE) |
| Power cut | Outbox and Excel copy survive on disk | Resume; check "waiting" count |
| Gateway down (Phase 2) | Online booking shows "try later"; pending orders reconciled later | Nothing |
| Bad migration or accidental data change | Additive-only migrations; immutable receipts; audit | Restore from backup if ever needed |
| Supabase project paused (7 days idle, R2 s6) | Daily counter use keeps it active; during the build the project may pause | Unpause from the dashboard (UNVERIFIED whether the nightly job counts as activity) |
| Backup job fails | Critical in Needs attention | Builder or owner re-runs the workflow |

## 17. Existing code: extend, replace, leave alone

### 17.1 Extend (keep behaviour, add to it)

| Path | Change |
|---|---|
| `app/admin/receipts/**`, `app/admin/prasadam` (moved to `app/seva/**` in A4S) | `app/seva/layout.tsx`: real permission check for seva pages, module wrapper class `.seva`, own frames; old addresses forward from `next.config.ts` |
| `app/seva/(desk)/page.tsx` (was `app/admin/receipts/page.tsx`) | The seva dashboard (the list moved to `register/`) |
| `app/seva/(desk)/seva-settings/page.tsx` | Writes Supabase through `/api/seva/sevas`; new fields (section 13.1) |
| `app/seva/(desk)/[receiptId]/page.tsx`, `[receiptId]/print/page.tsx` | Read `params.receiptId` from Supabase; slip print view |
| `app/admin/users/**`, `app/api/admin/users/{create-admin,set-role}` | Staff no., view-only, lifecycle, onboarding rules |
| `app/admin/reports/page.tsx` (`:185-332`) | Receipts card links to seva reports; its Firestore receipt CSV is removed |
| `app/(public)/sevas/**`, `components/home/SevaBooking.tsx` (Phase 2) | Booking flow replaced by the gateway-verified flow; today it lets the devotee mark payment "completed" from the browser (`SevaBooking.tsx:182-193`) |
| `app/actions/sevas.ts`, `services/seva.service.ts`, `apps/mobile/lib/api.ts` | Filter `visibility in ('online','both')`; the app's direct anon read of `sevas` returns nothing under deny-all RLS today, so Phase 2 reads through the API |
| `lib/auth/admin-auth.ts` (`:39-43`) | Allow-list; shared verifier used by the seva helper |
| `types/user.ts` (`:3-44`) | Roles `receptionist`, `prasadam_counter`; normaliser cases |
| `context/AuthContext.tsx` (`:155-161`) | Seva capability flags (from `/api/seva/me`) |
| `components/admin/layout/AdminAuthGuard.tsx` (`:8-14`, `:129-143`) | Real permission cases instead of mapping all to `canAccessAdmin` |
| `components/admin/layout/AdminSidebar.tsx` (`:56`), `navigation.ts` (`:55-58`) | One "Seva Entry" item that opens `/seva` (no sub-items; the module has its own section rail); filtering made real; `app/admin/page.tsx` sends seva-only roles to `/seva` |
| `components/ui/button.tsx`, `input.tsx`, `select.tsx`, `switch.tsx`, `card.tsx`, `dialog.tsx` | Token-based variants used by the module (section 18) |
| `lib/receipt/upi.ts` | Reused for the counter UPI link; hard-coded default VPA no longer used by seva code |
| `lib/format.ts` | Reused (`formatCurrency`, `formatDate`) with IST |
| `supabase/migrations/` | New seva files (section 7.9) |
| `jest.config.ts`, `package.json`, `.github/workflows/ci.yml` | Coverage for `lib/seva/**`; `test:db` and `test:e2e:seva` scripts; DB tests in CI |
| `firestore.rules` (`:39`) | Close the users-create self-role hole |

### 17.2 Replace (superseded by the new flow, removed in the same pull request that switches its consumers)

`app/admin/receipts/create/page.tsx` (now `app/seva/(desk)/create/page.tsx`, a redirect to the counter); the old
`/admin/receipts/*` and `/admin/prasadam` pages (moved to `/seva`, their addresses forward, deck `shell`); `app/api/admin/receipts/**` and
`app/api/admin/receipt-sevas/**` (replaced by `/api/seva/*`, C-40); `lib/receipt/admin.ts`, `lib/receipt/numbering.ts`,
`lib/receipt/validation.ts`, `lib/receipt/pdf.ts` (Firestore numbering and the Kannada-less PDF; their tests move with
them); `services/receipt.service.ts`, `services/receiptSeva.service.ts`, `types/receipt.ts`, `types/receiptSeva.ts`,
`types/receipt-extensions.ts` (replaced by `services/seva/*`, `types/seva.ts`);
`app/api/admin/receipts/[id]/send/route.ts` (stub); `scripts/seed-receipt-sevas.ts` (seeds the unread `receiptSevas`
collection, R3 2). Firestore `sevas` stops being written by the Receipt Book; seva settings mirror public fields to it
until its other readers move to Supabase (C-39; readers listed in R3 2.1).

### 17.3 Leave alone

Raya AI (`lib/ai/**`), events, gallery, panchanga, donations, `seva_bookings` table and its migration mappers,
`prisma/**`, other workflows, the public home page. The site-wide UI redesign stays its own project.

### 17.4 Faults fixed in scope

| Fault | Evidence | Fix |
|---|---|---|
| Receipt detail and print pages never load | `app/admin/receipts/[receiptId]/page.tsx:32,35,45` and `[receiptId]/print/page.tsx:33,36,44` read `params.id` while the segment is `receiptId` | Read `params.receiptId`; pages rebuilt on Supabase |
| `/api/public/receipts` leaks personal data | `app/api/public/receipts/route.ts:6,20,28`: unauthenticated search of `sevaBookings` by phone, email, id or payment ref over the latest 1,000 docs (M07-F07) | Phase 1: require a Firebase token and return only the caller's own bookings, minimal fields; Phase 2: replaced by "My seva bookings" |
| Self-assigned role on sign-up | `firestore.rules:39` `allow create: if isAuthenticated() && request.resource.data.uid == request.auth.uid;` (M04-F47) | Create allowed only with role absent or `devotee`, and without `isActive`/`isApproved` escalation; builder checks what sign-up writes |
| Deny-list role check | `lib/auth/admin-auth.ts:39` `BLOCKED_ROLES = {"devotee","volunteer"}`; empty, typo and `"user"` roles pass (M07-F37) | Explicit allow-list of today's admin roles plus the two new ones; everything else denied |
| Committed service-account key | 11 tracked files under `scripts/` contain a private-key marker; 9 of them appear to embed key material (pattern count on 2026-10-18, values not read) (M11-F02) | Owner revokes the key in the Google Cloud console; scripts read credentials from env or the git-ignored `.firebase-adminsdk.json` (`.gitignore:41`); history rewrite optional once revoked |
| Hard-coded UPI fallback | `lib/receipt/upi.ts:1`, `components/home/SevaBooking.tsx:114` | Seva code never falls back; UPI disabled when not configured |
| Role checks inconsistent | `firestore.rules:18` lists `'Billing'` not `'billing'`; `AdminAuthGuard.tsx:129-143` maps everything to `canAccessAdmin` (R3 4.3, 4.5) | Seva pages use real flags; the rules list is noted for the site-wide cleanup |
| Counter UPI id could change unseen (found 2026-10-19, A3 security gate H-1) | `settings/financeSettings` was writable by every admin, and the counter read it without a record | Super admin only in `firestore.rules`; every read compared with `seva_settings.counter_upi_*` (`seva_note_counter_upi`), a change audited and raised in Needs attention |
| Open redirect and `javascript:` on `/login?redirect=` (found 2026-10-20, A4S security gate H-1) | `components/auth/LoginForm.tsx:61-63` assigned `?redirect=` to `window.location.href` unchecked; `AdminAuthGuard.tsx:138-139` relayed a page's own `?redirect=` unchecked | Same-origin path only: `safeReturnPath` (`lib/auth/safe-return.ts`) refuses `//host`, backslashes, whitespace and control characters, schemes and anything not starting with one `/`, and returns the parsed path, query and hash; fallback `/` on sign-in, `/admin` in the guard |

Noted, not fixed here (out of scope): AGENTS.md says `npm run type-check` (the script is `typecheck`) and "Next.js 14"
(package.json has ^16.2.9); `services/settings.service.ts` and `services/event.service.ts` read deny-all tables with the
browser client (R3 3.7); `desk/architecture.html` names an office company in its footer, which breaks this repo's
boundary rule (CLAUDE.md, 2026-10-18).

## 18. UI system for this module

- **Approved look:** proto.css v2 (Round C - look, "much better"): one sans family (Inter with system fallbacks),
  neutral warm-grey ground, temple gold as the single accent (fill with dark ink, never gold text on white), soft cards,
  generous spacing, Kannada always on its own line under the English (`.kn` block, smaller, muted, line-height 1.75),
  13 px text floor for elderly readers.
- **Departures from UI-REDESIGN-PLAN sections 2-5:**

| Topic | UI-REDESIGN-PLAN | This module | Why |
|---|---|---|---|
| Headings | Source Serif 4 + Noto Serif Kannada (4.1) | Inter + Noto Sans Kannada, sans throughout | Owner approved v2 after the serif version looked dated (Round B - counter a; Round C - look) |
| Smallest text | `--text-micro` 12 px (4.1) | 13 px floor | Elderly trustees |
| Radius | 8 px control, 16 px surface (4.3) | 12 px control, 18 px surface | v2 soft cards |
| Elevation | Cards have a border, no shadow (4.4) | Border plus a very soft `--shadow-card` | v2 |
| Kannada placement | Kannada line above English in some components (5.4) | Kannada always under English | Owner, Round B - counter a |
| Chart colours | `--chart-1..5` gold to deep-red ramp (3) | v2: gold, orange, green, blue, deep red | Payment modes need distinct hues |

  Kept from the plan: one accent; focus ring that passes contrast; form control boundary in `--muted-foreground`; one
  primitive per concept; 48 px table rows, sentence-case headers, right-aligned tabular numbers; row cards below 768 px;
  motion only in answer to an action; reduced motion respected.
- **Adding tokens without disturbing the site:** module tokens live in one stylesheet imported by the module layouts and
  scoped to a wrapper class (`.seva`), redefining `--primary`, `--chart-*`, radii and the type scale inside that subtree
  only; the admin shell and public pages keep `app/globals.css`. Light only until the site wires its theme switch; the
  dark token set is kept ready (C-49).
- **No duplicate primitives:** the module uses `components/ui/*` with new token-based variants (the variants
  UI-REDESIGN-PLAN 5.1-5.4 already specifies), so they can become site defaults later. Toasts stay `react-hot-toast`.
- Slip and e-receipt use the same fonts; no new font downloads; no external CSS.
- Contrast: chart gold on white is 1.98:1 (fills only, offset by labels and data tables; C-12).
- **Motion and feedback** (A4P, owner card `motion-feel`, 2026-10-19): Framer Motion springs, "Lively" (stiffness 380,
  damping 22, `lib/seva/motion.ts`) on presses, dialogs, tabs, switches and numbers; a loading outline
  (`loading.tsx` skeleton) on every page, a top progress bar on navigation, and pending buttons and lines for every
  wait, so nothing ever looks frozen. `prefers-reduced-motion` turns the movement off (the content still appears).
- **Module shell** (A4S, deck `shell`, 2026-10-19): Seva Entry has its own frames inside the same website: a header
  (temple name, "Ramesh - 023", Sign out always visible, "Website admin" for admin roles), a section rail on desktop and
  a bottom bar on the phone (`components/seva/shell/*`, sections per role), and the full-screen counter frame (receipt
  screen, Today's receipts, Close day, Sign out). Role landing: receptionist to `/seva/counter`, prasadam counter to
  `/seva/prasadam`, temple admin and super admin to `/seva`.

## 19. Testing strategy and run policy

### 19.1 Four layers (D17)

| Layer | Tool and location | What it proves |
|---|---|---|
| Unit | Jest (`ts-jest`, jsdom), `tests/unit/seva/**` | Number formatting and parsing; grouping by date; amount in words (Indian system); period and bucket maths in IST; validation schemas; outbox ordering and retry; QR token format; Tally row building; Excel sheet building; ECharts option builders; permission matrix (every cell of 3.3) |
| Server / route | Jest with mocks (pattern of `tests/unit/admin-auth.test.ts`, `api-knowledge-routes.test.ts`), `tests/unit/seva/api-*.test.ts` | Every route: 401 without token, 403 for each disallowed role and for view-only writes, device checks, input errors, correct SQL function and arguments; webhook signature good, bad and replayed; refund permissions |
| Database | PGlite (embedded Postgres in Node, no Docker) as a separate Jest config, `tests/db/**`, script `npm run test:db` | Every migration applies cleanly from scratch and twice (idempotent); RLS on and revokes in place; triggers (immutability, append-only audit, rate history); `seva_issue_counter_order` numbering, year rollover, idempotency, pricing, overrides; offline sync rules and gaps; in-doubt supersede; cancel window; prasadam once, undo, off-date; day close maths; continuity; dashboard sums |
| Browser | Playwright, `tests/e2e/seva/**`, config `tests/playwright.config.ts` | Counter flow by keyboard; multi-date group printing; offline (`context.setOffline`), outbox, OF numbers, resend; print layout (Chromium `page.pdf` with CSS page size: one page per receipt at the chosen paper size, checked with `pdf-lib`); dashboard period switch and charts; prasadam scan and typed states; test-mode checkout against a gateway mock |

Notes:
- PGlite runs one connection, so the "two counters at once" test runs against a multi-connection embedded Postgres
  (for example the `embedded-postgres` package, real binaries, no Docker) if PGlite cannot; Builder's call after a spike.
  Supabase roles (`anon`, `authenticated`, `service_role`) are created by the test harness before the migrations.
  PGlite's Postgres version may differ from the live project (UNCLEAR), so no version-specific SQL.
- Browser tests sign in with the Firebase Auth emulator (Java 17 is present for the Firestore emulator, STATE) and
  stub `/api/seva/**` with a stateful fake in the test process; route logic is covered by the route layer and SQL by the
  database layer. One manual full-stack smoke against a separate Supabase test project runs before go-live.
- The gateway mock serves the hosted checkout page and posts signed webhooks with the test secret.

### 19.2 Run policy (chat 2026-10-18)

- After every piece: lint, `npm run typecheck` (not `type-check`), unit and route tests for the touched files.
- Once near the end of each build window: the full unit and route suites, `npm run test:db`, the Playwright seva suite,
  `npm run build`, `npm run verify:supabase-migrations:static`.
- Building tests has priority while quota is available; long suites are not run repeatedly.
- Each window ends with a **test report** (what ran, pass and fail counts, anything skipped and why) and a **10-minute
  manual checklist** for the owner, for example: make a 3-date receipt by keyboard; print it; switch off Wi-Fi and make
  one; switch it on and see it sent; mark prasadam by typing the number; open the dashboard on a phone; check one slip
  with a phone camera.
- CI (`.github/workflows/ci.yml`) adds `npm run test:db`; Playwright stays local until a CI browser job is agreed.

## 20. Rollout and go-live checklist

### 20.1 Rollout steps

1. Step 2 begins: worktree `feature/seva-entry` off `main`; this book committed to `docs/seva/` (STATE).
2. Build Phase 1 against samples (D29); migrations run in PGlite and on a test Supabase project first.
3. The owner revokes the committed service-account key as soon as the scripts stop using it.
4. Office sends real data (open items); the super admin enters sevas, header, photos, festival days, denominations.
5. Printer set-up on the counter PC: the paper size picked in Settings - Receipts (A5 by default; a custom form for
   one-third A4 or a custom size), set as the Windows default; kiosk shortcut to `/seva/counter`; install the app from
   `/seva` (one app for every role); register the PC as Counter 1; choose the Excel folder.
6. Onboard staff; each signs in once (invited -> active).
7. Dry run: one or two days alongside the paper book; compare totals at day close.
8. Go live at the counter (paper book retired the same day, last paper number noted in the audit).
9. Before the first festival: add a second counter if needed, rehearse offline and Replace this PC.
10. Phase 2 stays in test mode until the owner completes section 14.6.

### 20.2 Go-live checklist

- [ ] All migrations applied; `verify:supabase-migrations` passes; RLS on every seva table.
- [ ] Seed: series C1/OF1/W/WT, Counter 1, denominations, real settings row (no "SAMPLE" text left).
- [ ] Real seva list with codes, keys, Kannada names, rates, visibility, multi-date, prasadam items; Kannada proof-read.
- [ ] Staff onboarded with correct roles; legacy roles reviewed (C-62); first super admin is 001.
- [ ] Security fixes merged (section 17.4); key revoked; `/api/public/receipts` closed.
- [ ] Counter PC: Windows password, kiosk shortcut tested (no print dialog), slip prints at the right size, QR scans
      from 2-3 phones, Excel copy writes after a restart.
- [ ] Offline rehearsal: 3 offline receipts sent on reconnect; numbers continuous.
- [ ] Prasadam phone: camera scan and typed number both work.
- [ ] Day close rehearsal with real notes and coins; summary prints.
- [ ] Nightly backup ran twice; a restore drill passed; both `age` private keys (Nikhil's and the site owner's) are
      stored offline by their holders.
- [ ] Dashboard figures match the dry-run paper totals.
- [ ] Owner's 10-minute checklist passed and signed.

## 21. AGENTS.md planning sections

1. **Objective.** Build Seva Entry as in sections 1-2: counter, printing, offline, prasadam, day close, dashboard,
   reports, settings, staff (Phase 1) and devotee booking with UPI in test mode (Phase 2). Success = section 20.2 passes.
   Non-functional: section 9.12 performance; accessibility (keyboard-first counter, contrast, 13 px floor, hidden data
   tables); Kannada under English; offline fallback; no secrets in code.
2. **Existing modules reused.** `createAdminClient()` (`lib/supabase/admin.ts`); `verifyAdminUser` internals
   (`lib/auth/admin-auth.ts`); Firebase admin app; `lib/receipt/upi.ts`; `qrcode`; `zod`; `lib/format.ts`;
   `components/ui/*` and `components/ui/form/*`; `components/admin/common/*` (`AdminPageHeader`, `EmptyState`, `StatCard`
   restyled); `components/ui/ImageUploader`; `react-hot-toast`; `date-fns`; `@tanstack/react-table`;
   `update_updated_at_column()`; the i18n dictionaries (`lib/i18n/dictionaries/{en,kn}.json`) for fixed strings.
3. **Files to modify.** Section 17.1.
4. **New files.** Section 6.4 and 7.9; tests in 19.1.
5. **Impact.** Database: new tables and `sevas` columns, all additive (7.9). APIs: new `/api/seva/*`; old receipt APIs
   removed with their pages (17.2). Auth: new roles; deny-list becomes an allow-list - users with empty or unknown roles
   lose admin access (intended). Public site: `sevas` readers filter by visibility; Phase 2 replaces the booking flow.
   Breaking changes: none for live users (the site is not live, D28).
6. **Risks.** Kiosk printing or custom paper size not working on the temple printer (fallback: a print dialog per job,
   or QZ Tray, R2); File System Access permission prompts after restart; Supabase Free size and pausing (7.9, 16.2);
   PGlite fidelity; Firebase and Supabase drift for staff (fails closed, 3.2); gateway webhook format for PG orders
   (14.3, UNCLEAR); legal questions on gateway fees (14.7); Vercel plan terms for a trust taking payments (UNCLEAR, O-16).
7. **Assumptions.** One counter at first; Chrome or Edge on Windows 10/11; the office printer takes the paper size chosen in
   settings (A5 by default; card `a5`); Firebase stays the sign-in provider; Supabase project reachable from Vercel; Node 24 and
   npm 11 locally; the builder reads `node_modules/next/dist/docs/` after `npm ci` before writing Next.js code (AGENTS.md).
8. **Testing.** Section 19.

## 22. Calls made on the owner's behalf

Each is a decision the owner did not explicitly make. He can accept, change or reject any of them.

| # | Call | Why | Section |
|---|---|---|---|
| C-01 | Cancelling a group: all receipts or any one date | Each date is its own receipt with its own prasadam | 9.9 |
| C-02 | Rashi is captured but not printed on the slip (setting, off by default) | Not on the paper receipt today (R4 s2.2); slip space | 10.1 |
| C-03 | Temple name on the slip: English first, Kannada under it | Matches the global "Kannada under English" rule | 10.1 |
| C-04 | "Today" compares with yesterday up to the same clock time | A fair comparison during the day | 12.1 |
| C-05 | "This year" is the calendar year, compared with the same span last year | Numbers use the calendar year (D22) | 12.1 |
| C-06 | MM-YYYY in the number is the month the receipt is made, not the seva date | Numbers follow issue order | 8.1 |
| C-07 | W-WEB and W-APP share one running number (series W) | One online register | 8.1 |
| C-08 | Staff have an "invited" state until their first sign-in | Shows who has not signed in yet | 3.4 |
| C-09 | The Active switch and "Offboard (deactivate)" are one action (super admin, reason); reactivation by temple admin or super admin | The mockup showed both; reactivation is a form of onboarding | 3.4, 13.6 |
| C-10 | Online "Booked before" offers only the account's own earlier details | Privacy | 14.1 |
| C-11 | Aradhane dates in mockups (28-30 Aug 2026 and 2027) are samples | Real dates from the office | 13.4 |
| C-12 | Chart gold on white (1.98:1) only as a fill, with labels and data tables | Gold is the accent | 18 |
| C-13 | This week = Monday to Sunday; week and month compare like-for-like elapsed time | Consistent comparisons | 12.1 |
| C-14 | Role and isActive stay in Firestore; staff no., view-only and lifecycle in Supabase `staff`; both must say active | Section 3.2 | 3.2 |
| C-15 | Temple admins (not view-only) and super admins may also work the counter; receptionists do not mark prasadam | Cover for absences; keep prasadam separate | 3.3 |
| C-16 | View-only temple admins may export, never with phone numbers; phones only for temple admin or super admin, audited | Looking is allowed; phones are sensitive | 12.6 |
| C-17 | A temple admin may change roles among Receptionist, Prasadam counter and Temple admin, not for super admins or themselves | Prevents self-promotion | 3.3 |
| C-18 | Gateway test-mode receipts use series WT and never count | Keeps the live W series clean | 8.1, 14.4 |
| C-19 | Group number `G-YYMM-NNNN` from the server; offline `G-YYMM-OF1-NNN` | Matches the mockup; offline needs its own | 7.3 |
| C-20 | Same-day cash cancellations are paid from the drawer; UPI and earlier-day cancellations are refunded by the office | Keeps day-close maths per day | 9.9 |
| C-21 | Spoiled print = cancel with reason + reissue a new number on the same payment | Audit mockup; numbers never skip | 9.8 |
| C-22 | Any second print is DUPLICATE, even after a jam | The browser cannot know the paper came out | 9.8 |
| C-23 | Cancelled receipts cannot be reprinted | Avoids a valid-looking cancelled slip | 9.8 |
| C-24 | One day close per counter per date; needs the counter online with nothing waiting; reopen by temple admin with reason | Clean, provable close | 9.10 |
| C-25 | Opening cash float per counter, default Rs 0 | Real drawers start with change | 9.10 |
| C-26 | Every day-close difference is flagged (threshold setting, default Rs 0) | Mockup asked; safest default | 12.2 |
| C-27 | Prasadam undo by the same person within 120 s; later reversal by temple admin with reason | Mistaps happen; misuse should not | 11 |
| C-28 | No prasadam offline mode in Phase 1 | Keeps "given once" reliable | 11 |
| C-29 | Counter dates: today to 365 days ahead, never past. Online: up to 90 days ahead; same-day bookings close at 12:00 | Mockup sample "close at 12:00"; settings | 9.3, 14.1 |
| C-30 | At most 8 seva lines per slip, 31 receipts per order, quantity 1-99 | Slip space; sane limits (no limits today, R3 1.8) | 9.3 |
| C-31 | Phone: 10-digit Indian mobile, stored +91..., never printed | Privacy | 9.2, 10.1 |
| C-32 | Returning-devotee profiles only when a phone is given; offline matching uses hashed phones; deleted after 3 years unseen | Privacy with convenience | 7.5, 9.2 |
| C-33 | One payment mode per order (no split cash + UPI) | Simpler day close | 9.5 |
| C-34 | A changed amount: any positive amount with a reason; flagged in Needs attention. (The slip DOES mark the changed line - that part is the owner's decision, Round B - override.) | Owner's override rule | 9.4 |
| C-35 | Rate changes apply when saved (no future-dated rates), though the audit mockup shows "from 16 Oct" | Simpler, offline-safe | 13.1 |
| C-36 | A normal issue writes no audit row; changes and exceptions do (the diagram said "stored with an audit entry") | The receipt row is the record; saves space on the Free plan | 7.6 |
| C-37 | Online counter receipts need a registered counter PC as well as a signed-in user | Stops counter receipts from other machines | 8.4 |
| C-38 | Existing Supabase sevas get visibility 'both' | The public site keeps working | 7.1 |
| C-39 | No migration of Firestore `sevas` rows; real list entered from the office; public fields mirrored to Firestore until its other readers move | Site not live; avoids breaking Raya AI and other readers | 17.2 |
| C-40 | APIs at `/api/seva/*`; pages at `/seva/*` (moved from `/admin/receipts/*` on 2026-10-19, deck `shell`; the old addresses forward); old receipt APIs removed with their pages | One namespace, no duplicates | 6.5, 17.2 |
| C-41 | Exports and the counter Excel copy are built in the browser from paged data with one Excel library | Avoids server time limits; one code path | 12.6 |
| C-42 | Board summary and day-close summary are print-styled HTML (Save as PDF), not pdf-lib | pdf-lib here cannot print Kannada (R3 1.6) | 12.6 |
| C-43 | Razorpay adapter is Later: switching to Razorpay would need that one adapter written (small) as well as new keys - the Round A card's "new keys, not new code" holds only once it exists | Owner chose "Cashfree, Razorpay as the spare", not "build both" | 14.2 |
| C-44 | Paid SMS/WhatsApp e-receipts wait for cost approval; Phase 2 gives in-account e-receipts and a free share link | "Do not want to spend anything extra" (Round A - supabase) | 14.5 |
| C-45 | Verified money always gets receipts, even late; admin then decides on a refund | Every rupee has a receipt | 14.3 |
| C-46 | A refund cancels the receipts when requested; a failed refund is critical | No prasadam on refunded receipts | 14.3 |
| C-47 | The app opens the website's hosted checkout in an in-app browser | No native gateway SDK in Expo | 14.1 |
| C-48 | The app signs in with Firebase Auth (same accounts as the website) | One identity | 14.1 |
| C-49 | Module look scoped under `.seva`; light only until the site's theme switch exists; token-based variants on existing primitives | No disturbance to the site; no duplicates | 18 |
| C-50 | QR = `https://<site>/r/<token>`; public view shows the slip's own details (owner changed this at sign-off: "mention complete details, that's ok"), never the phone | Phone cameras open it; nothing beyond what the paper already shows | 10.3 |
| C-51 | Typed prasadam lookup accepts short forms (`C1 124`, `124`) for the current year | Typing the full number is slow | 11 |
| C-52 | Lost offline numbers become open gaps; admin enters them from paper or declares them lost | Never hide a gap | 8.4, 8.5 |
| C-53 | In-doubt online save: an unprinted C receipt is cancelled automatically when the OF copy syncs | Numbers stay accounted for | 8.6 |
| C-54 | Cash of Rs 2,00,000 or more in one order needs a confirm (s.269ST; CA to confirm) | Legal caution | 9.5 |
| C-55 | Tally: a ledger per seva plus cash, UPI and online ledgers in settings | Tally needs existing ledgers (R4 s5) | 12.6 |
| C-56 | Invitations use Firebase's own set-password email | Free; no email provider | 13.6 |
| C-57 | Backups kept 30 days, plus a first-of-month copy kept 90 days as built (the most GitHub allows on default settings); where the 12-month monthly copies live is still open with the owner | Free storage limits | 16.1 |
| C-58 | Offline receipts keep the cached rate as printed; rate differences flagged at sync | The printed slip is the truth | 9.11 |
| C-59 | Receptionists see only their counter's today, no dashboard | Need to know | 3.3 |
| C-60 | Cancel reasons (8) and "Esc twice clears" are samples to confirm | From the mockup | 9.6, 9.9 |
| C-61 | Seva date defaults to today; festival chips show until the last date passes | Settings mockup | 9.3, 13.4 |
| C-62 | Legacy roles (billing, priest, staff) get no seva access until given one of the four roles | Allow-list | 3.2 |
| C-63 | Dashboard counts collections by issue time; seva summary and festival view by seva date | Cash flow vs planning | 12.1, 12.4 |
| C-64 | Scheduled jobs (gateway reconcile sweep every 5 minutes, order expiry, monthly devotee-profile purge, nightly backup) run on GitHub Actions calling protected routes or scripts, not Vercel cron | Free, already used by the repo (daily panchanga); Vercel Hobby cron runs at most daily | 14.5, 16 (builder check #7) |
| C-65 | Every receipt has a seva date. A seva whose date the devotee may not pick (and Other Seva / Karnike) takes the booking date; prasadam off-date warnings use it like any other | Keeps one-receipt-per-date grouping, counting and prasadam rules uniform (builder check #8) | 7.1, 9.3, 14.1 |
| C-66 | Staff and devotees get a provider-neutral internal id (uuid); the Firebase uid is stored as an external identity, and every route reads identity through one auth adapter, so a later move to Supabase Auth changes the adapter, not the module | Hedge while the owner decides the sign-in direction (builder check #1; owner card in the Design Book deck) | 3.2, 6.3, 7.2 |

Builder's calls (not for the owner): service-worker library; IndexedDB wrapper; Excel library; camera QR decoder;
PGlite or embedded Postgres for concurrency tests; env variable names; migration timestamps; component split. (The
day-close summary prints on the receipt paper chosen in settings, section 9.10.)

## 23. Open items for the owner and the temple office

| # | Item | Who | Needed by |
|---|---|---|---|
| O-01 | Real seva list: names (English and Kannada), short codes, counter keys, rates, counter/online, several dates allowed, prasadam items, income ledger names | Office | Before go-live |
| O-02 | Header: temple name (English and Kannada), address, registration number, Photo 1 and Photo 2, footer lines, blessing | Office | Before go-live |
| O-03 | Kannada proof-reading: seva names, gotra list (R4 marks all Kannada spellings UNCERTAIN), nakshatras 25-26, receipt words, ನಕಲು, the prasadam line; spelling "Karnike" vs "Kanike" (ಕಾಣಿಕೆ) | Priest or committee member | Before go-live |
| O-04 | Festival dates, Aradhane included | Office | Before go-live |
| O-05 | Printer: model; the paper size chosen in settings (A5 by default; one-third A4 or custom need a custom size from the bypass tray); how slips are cut if not A5 or A6 | Owner | Before the print test |
| O-06 | Test the QR with 2-3 older phones from the printed slip | Owner | Print test |
| O-07 | Kiosk printing shortcut on the real PC (installed app or `--app=` shortcut) | Owner + builder | Print test |
| O-08 | Excel copy folder and whether folder permission survives a restart | Owner | Before go-live |
| O-09 | Counter PC: Windows password, BitLocker if available | Owner | Before go-live |
| O-10 | UPI id and payee name in finance settings; which bank or merchant app shows the day's UPI total | Office | Before go-live |
| O-11 | Opening cash float, if any | Office | Before go-live |
| O-12 | Staff list: names, emails, roles, who is view-only | Owner | Before go-live |
| O-13 | CA questions in 14.7 (80G wording, GST, 12A/80G status, retention, s.269ST, data protection) | Owner | Before Phase 2 live |
| O-14 | Cashfree onboarding documents and a written answer on UPI charges up to Rs 2,000 | Owner | Before Phase 2 live |
| O-15 | Generate the `age` key pair and keep the private key offline | Owner | Before the first backup |
| O-16 | Supabase and Vercel regions; Vercel plan (Hobby is for non-commercial use; cron frequency) | Owner | Step 2 start |
| O-17 | Current Supabase database size (shared 500 MB) | Owner (dashboard, read-only) | Step 2 start |
| O-18 | Revoke the committed service-account key | Owner | When the scripts stop using it |
| O-19 | Approve the short privacy notice for the counter and booking page | Owner | Before go-live |
| O-20 | Paid SMS or WhatsApp e-receipts: wanted, and at what cost? | Owner | Phase 2 |
| O-21 | Last year's totals from the paper register for comparisons (optional) | Office | Optional |
| O-22 | Confirm cancel reasons and whether temple admins should work the counter (C-15, C-60) | Owner | Sign-off |
| O-23 | Approve or change the calls in section 22 | Owner | Sign-off |
| O-24 | Expected yearly receipt volume, to check the size estimate in 7.9 | Office | Step 2 |
| O-25 | Sign off this Design Book | Owner | Before the build plan |

## 24. Glossary

| Word | Meaning |
|---|---|
| Seva (ಸೇವೆ) | A ritual service performed at the matha for a devotee, on a date, for a fixed offering |
| Seva date (ಸೇವಾ ದಿನಾಂಕ) | The day the seva is performed and its prasadam collected; one receipt per seva date |
| Gotra (ಗೋತ್ರ) | The devotee's lineage, said during the seva |
| Nakshatra (ನಕ್ಷತ್ರ) | The devotee's birth star, one of 27 |
| Rashi (ರಾಶಿ) | The devotee's moon sign, one of 12 |
| Prasadam / prasada (ಪ್ರಸಾದ) | Blessed offering handed to the devotee after the seva (e.g. phala-mantrakshate, laddu) |
| Mantrakshate | Blessed rice given as prasadam |
| Aradhane (ಆರಾಧನೆ) | The annual commemoration of the saint, usually three days; the busiest time (also spelt Aaradhane, Aradhana) |
| Karnike / Kanike (ಕಾಣಿಕೆ) | An offering of any amount; "Other Seva / Karnike" takes any amount at the counter |
| Archane, Abhisheka, Pooja, Utsava | Kinds of seva: chanting with offerings, ritual bathing, worship, procession |
| Matha | The monastery and temple institution |
| Receipt / Receipt No. (ರಸೀದಿ / ರಸೀದಿ ಸಂಖ್ಯೆ) | The numbered slip a devotee keeps |
| Total (ಒಟ್ಟು), Cash (ನಗದು), Cancelled (ರದ್ದು), Duplicate (ನಕಲು) | Words printed on slips |
| Series | The first part of a receipt number: C1 (counter 1 online), OF1 (counter 1 offline), W (online), WT (online test) |
| Running number | The six-digit count within a series and calendar year |
| Staff no. | A person's three-digit number (023), never reused |
| Group | The receipts of one order paid together ("1 of 3 - paid together") |
| Day close | Counting the drawer and matching UPI at the end of the day for one counter |
| Denomination | A note or coin value used in the count |
| Outbox | Receipts made offline waiting on the PC to be sent |
| Idempotency key | A unique id that makes a repeated request harmless |
| Kiosk printing | A browser started with `--kiosk-printing` prints without a dialog |
| PWA / installed web app | A website installed on Windows like an app |
| RLS | Postgres row-level security; here it denies every browser |
| Service role | The server-only Supabase key that bypasses RLS |
| UPI, UTR | India's instant payment system; the bank's reference number for a payment |
| MDR | Merchant discount rate, the fee a merchant's bank charges |
| PA | Payment aggregator (a gateway such as Cashfree) |
| 80G, 12A | Income-tax registrations of a charitable trust |
| CA | Chartered accountant |
| Tally voucher, ledger | Accounting entries in TallyPrime |
| DPDP Act | India's Digital Personal Data Protection Act, 2023 |

END OF REPORT
