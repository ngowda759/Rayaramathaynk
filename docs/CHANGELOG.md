# Changelog

## Unreleased - Seva Entry, Phase 1 (branch `feature/seva-entry`, 2026-10-18 to 2026-10-20)

The paper receipt book becomes **Seva Entry**: a seva counter, prasadam counter and office dashboard at `/seva`, with
its data in Supabase Postgres. Spec: `docs/seva/DESIGN-BOOK.md`; guide and runbook: `docs/seva/README.md`.

### Added

- Counter (`/seva/counter`): three guided steps (devotee, sevas and dates, pay and print), number keys and codes,
  one receipt per seva date paid once, cash and UPI, a changed amount with a reason, returning-devotee fill,
  printing without a dialog, DUPLICATE reprints, spoiled-slip reissue (same day), cancel with a reason, close day by
  notes and coins.
- Receipt numbers such as `C1-023-10-2026/000124` per series (counter C, offline OF, online W, test WT), never
  skipped, restarting each January; number gaps recorded and resolved with a note.
- Offline fallback: the counter's own OF series, an IndexedDB outbox that sends itself, and an automatic Excel copy of
  the day on the PC.
- Registered counter PCs (device token) and "Replace this PC".
- Prasadam counter (`/seva/prasadam`): scan the QR or type the number, once per receipt, warnings for another day,
  undo; the public QR page `/r/<token>`.
- Dashboard with a period switch, Needs attention, tiles and ECharts charts; receipts register with number continuity;
  reports (seva summary, festival view, audit trail, day closes); Excel, CSV, Tally and board-summary exports.
- Settings: sevas and rates, receipt header and footer, the receipt paper size (A5 default, A6, one-third A4, 80 and
  58 mm rolls, custom), counters, counter rules, denominations, festival days, and the gotra, nakshatra and rashi
  lists.
- Staff and roles: Receptionist, Prasadam counter, Temple admin (with a view-only switch), Super admin; onboard,
  deactivate, reactivate, delete.
- Own screens at `/seva` with a header, section rail, phone bar and a full-screen counter; role landing; one app to
  install for every role.
- Lively spring motion, loading outlines on every page, a top progress bar and pending buttons; reduced motion
  respected.
- Nightly encrypted backup to two keys, a restore-drill script, a monthly purge of old devotee profiles, and a guarded
  demo-data seeder for test projects.
- Nine Supabase migrations (`supabase/migrations/2026102*_seva_*.sql`, `2026103*_seva_*.sql`) and four test layers
  (unit, database on PGlite, Firestore rules, Playwright).

### Changed

- The Receipt Book's pages moved from `/admin/receipts/*` and `/admin/prasadam` to `/seva`; the old addresses forward.
  The website admin has one "Seva Entry" menu item.
- The admin role check uses an allow-list; Firestore rules no longer let a new user give themselves a role, and
  `sevas` and `settings/financeSettings` are written by super admins only.
- The one-off scripts under `scripts/` read the Firebase key from the environment or a git-ignored file instead of
  carrying it.

### Removed before the merge (plan task A5-1)

- The Firestore Receipt Book code (`app/api/admin/receipts/**`, the Firestore numbering, validation and PDF in
  `lib/receipt/*`, `services/receipt.service.ts` and its types); its consumers point at the new flow, and the public
  seva list follows each seva's visibility (counter, online or both).

### Site owner, after the merge

Run the migrations, publish the Firestore rules, replace and revoke the old Firebase key, set the backup keys and
secrets, and make staff 001: `docs/seva/SETUP-GUIDE.md` Part B.
