# Seva Entry - module guide and runbook

Seva Entry is the temple's seva counter: receipts on the office PC, prasadam hand-over, day close, the dashboard,
register, reports, exports, settings and staff roles. It lives at `/seva` in the website. Written 2026-10-20 (Tuesday)
from the code at the end of Phase 1.

| Read this | For |
|---|---|
| `docs/seva/DESIGN-BOOK.md` | The signed spec, with its "Changes after sign-off" |
| `docs/seva/SETUP-GUIDE.md` | Click-by-click account set-up: Part A for the developer's test accounts, Part B for the site owner after the merge |
| `docs/seva/HANDOVER-NOTES.md` | The Kannada proof-read list and the site-wide issues found while testing |
| `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/UI-GUIDELINES.md`, `docs/ADMIN-GUIDELINES.md`, `docs/SUPABASE_MIGRATIONS.md` | Each has a "Seva Entry" section |

## Module map

| Folder | What is in it |
|---|---|
| `app/seva/` | The pages. `layout.tsx` is the module gate (sign-in, role, tokens). `(counter)/` is the full-screen frame: `counter/`, `counter/today/`, `day-close/`. `(desk)/` has the header, section rail and phone bar: the dashboard (`page.tsx`), `register/`, `[receiptId]/` and its `print/`, `day-closes/`, `reports/**`, `seva-settings/`, `settings/**`, `prasadam/`, `create/` (forwards to the counter) |
| `app/r/[token]/` | The public QR page a slip's code opens |
| `app/api/seva/` | The route handlers (list in `docs/API.md`) |
| `components/seva/` | The screens' parts: `counter/`, `today/`, `dayclose/`, `prasadam/`, `dashboard/`, `register/`, `reports/`, `export/`, `settings/`, `staff/`, `receipt/`, `slip/`, `shell/` (the frames), `motion/` (springs, skeletons, pending buttons), `ui/` |
| `lib/seva/` | Pure logic shared by browser and server: numbering, money, grouping, amount in words, schemas, permissions, routes (`routes.ts`), motion, strings (`strings/`, English and Kannada), domain lists (`domain/`), counter state (`counter/`), offline outbox and allocator (`offline/`), Excel copy (`excel/`), exports (`export/`), print and paper size (`print/`), charts (`charts/`) |
| `lib/seva/server/` | Server only: the route guard (`auth.ts`), the identity adapter (`identity.ts`), the PC check (`device.ts`), `rpc.ts`, and one service per area |
| `services/seva/` | Browser clients that call `/api/seva/*` with the sign-in token |
| `types/seva.ts` | Shared types |
| `styles/seva/` | `tokens.css` (the `.seva` tokens) and `print.css` |
| `supabase/migrations/` | The nine `..._seva_*.sql` files (`docs/SUPABASE_MIGRATIONS.md`) |
| `scripts/seva/` | `create-first-super-admin.ts` (staff 001), `backup.sh` and `verify-backup.sh` (nightly backup and restore drill), `seed-demo-data.ts` (test projects only) |
| `public/seva-counter.webmanifest`, `public/seva-sw.js` | The installable app and its service worker |
| `.github/workflows/seva-backup.yml`, `seva-maintenance.yml` | The nightly encrypted backup and the monthly purge of old devotee profiles |
| `tests/unit/seva/`, `tests/db/`, `tests/rules/`, `tests/e2e/seva/` | Unit and route tests (Jest), database tests (PGlite), Firestore rules tests, browser tests (Playwright) |

## Runbook

Each entry says who does it and where. "Temple admin" below means a temple admin who is not view-only, or a super
admin.

### Resolve a receipt number gap

A gap is a range of receipt numbers the office never received, almost always because a counter PC died or was replaced
before it sent its offline receipts. It stays as a critical **Number gaps** card in Needs attention until resolved.

1. Open **Register** (`/seva/register`) and look at the number continuity card: it names the series and the missing
   range (for example OF1 000045 - 000047).
2. Find the paper slips with those numbers (the counter drawer, the devotees' copies, the day's printed summary).
3. For each gap, click it on the continuity card and choose:
   - **Entered from the paper book** when the slips were found and their receipts are now entered, or
   - **Declared lost** when they cannot be found.
   Write a note of at least 3 characters (who checked, what was found).
4. The gap closes, the card clears, and the audit trail records `gap.resolve` with the note.

If the old PC comes back to life with its outbox, it may still send the orders inside its gap; the server accepts
them there and nowhere else. Check the register before declaring a range lost.

### Replace a counter PC

Use this when the counter PC is broken, stolen or swapped.

1. On the new PC, open the counter address (`/seva/counter`) and sign in as a temple admin.
2. Open **Receipt settings** > **Counters** (`/seva/settings/counters`) and choose **Replace this PC** for the counter.
3. Type the number on the **last slip the old PC printed** (take it from the printer tray or the drawer) and a reason.
4. The old PC is retired; this PC takes over the counter's series. Any range between the last number the office
   received and the number you typed becomes an open gap: resolve it as above.
5. Install the app and the kiosk shortcut on the new PC (below, and `docs/seva/SETUP-GUIDE.md` A5), and choose the Excel
   folder again.

A retired PC can no longer issue receipts. It may only send its unsent offline orders inside its gap.

### Reopen a closed day

A day close is final for the receptionist. If it was closed with a wrong count or before a late receipt:

1. A temple admin opens the Close day page for that counter and day by typing its address in the browser:
   `/seva/day-close?counterId=<n>&date=<YYYY-MM-DD>` (the counter number and date are on the **Day closes** page,
   `/seva/day-closes`). On the counter PC itself, **Close day** opens today's. The rows on **Day closes** do not link
   to this page yet; that link is a follow-up (`docs/seva/HANDOVER-NOTES.md`, "Seva Entry follow-ups").
2. The page shows "Day closed". Click **Reopen** and write the reason.
3. The receptionist (or the admin) corrects what was wrong and closes the day again from **Close day**
   (`/seva/day-close`). Both the reopen and the new close are in the audit trail.

### Restore drill (once a month)

Whoever holds a backup key checks that the latest nightly backup opens: `docs/seva/SETUP-GUIDE.md` B8. It downloads the
newest `seva-<date>` artifact from the backup workflow and runs
`bash scripts/seva/verify-backup.sh <file>.dump.age <key file>`, which checks the checksum, decrypts and lists the
archive, and prints only counts. Do it once before go-live and then monthly; a failed drill is told to the site owner
at once.

### The printer jams or a slip is spoiled

1. Do not issue a new receipt for the same payment.
2. If the slip came out readable but crumpled, open **Today's receipts** (`/seva/counter/today`) and **Reprint**: the
   same number prints again with the DUPLICATE ನಕಲು band.
3. If the slip is unusable (jam, misprint, wrong paper), use **Spoiled - cancel and reissue** on that receipt (today's
   receipts of this counter only): the spoiled number is cancelled with the reason "Spoiled print" and the same payment
   gets the next number. No money changes hands.
4. A slip from an earlier day can only be reprinted as a DUPLICATE.
5. If nothing prints at all: check paper and the Windows default printer, then reprint. The receipt is already saved;
   it is never lost because the printer failed.

### Push a new migration to a test project

The developer pushes every new migration to his own test project himself (the build never does it):

1. Open a terminal in the repository folder (the project was linked once with `npx supabase login` and
   `npx supabase link --project-ref <ref>`).
2. `npx supabase db push --dry-run` lists only the new files.
3. `npx supabase db push`, then answer `Y`.

Applied files are never edited; a change is always a new file with a later timestamp. On the live project the site
owner runs the **Deploy Supabase Migrations** workflow (SETUP-GUIDE B1). Details: `docs/SUPABASE_MIGRATIONS.md`.

### Seed demo data on a test project

`scripts/seva/seed-demo-data.ts` fills a **test** project with realistic receipts, prasadam, cancellations and day
closes, so the dashboard, reports and charts can be tried. Never run it against the live project.

1. **Close the counter page first**: every counter tab on every PC, then wait 3 minutes. An open counter would not
   learn the offline numbers the seeder writes and could reuse one; the script refuses while a counter PC was seen in
   the last minutes.
2. Dry run: `npx tsx scripts/seva/seed-demo-data.ts --project-ref <ref> --yes-this-is-a-test-project --dry-run`
3. Then the same without `--dry-run` (options: `--days 90`, `--seed 108`, `--staff-no 1`, `--counter 1`,
   `--no-festival`; a second run needs `--again`).

Its guards refuse the run unless `--project-ref` matches the project in `NEXT_PUBLIC_SUPABASE_URL` and
`--yes-this-is-a-test-project` is given, and whenever `NODE_ENV=production`, `VERCEL` or `CI` is set. It writes only
through the module's own SQL functions, never touches a day that already has a close, and prints no key. Because the
counter PC is closed while it runs, each seeded day is closed with the admin's "counter not seen" override and the
reason "Demo data seeding" (in the `dayclose.close` audit row). After it, open the counter page fresh while online so
it picks up the new last numbers.

### Install the app on the counter PC and on phones

Seva Entry is one installable app for every role (manifest `start_url` and scope `/seva`).

- **Counter PC:** in Edge, open `/seva/counter`, sign in, click the **App available** icon in the address bar and
  **Install**; pin it to the taskbar. For silent printing, start it from the kiosk shortcut
  (`msedge.exe --kiosk-printing --app=https://<site>/seva/counter`, SETUP-GUIDE A5.6 and A5.7). Offline, the app
  opens the cached counter, so receipts can still be made in the OF series.
- **Phones (prasadam volunteers, trustees):** open `https://<site>/seva` in Chrome (Android) and choose **Install app**
  or **Add to Home screen** from the menu; in Safari (iPhone) use **Share** > **Add to Home Screen**. The app opens at
  `/seva` and takes each person to their page. Only the counter works offline.

### Choose the paper size

1. A temple admin opens **Receipt settings** > **Receipts** (`/seva/settings/receipt`) > **Receipt paper**.
2. Pick **A5** (148 x 210 mm, the default), **A6** (105 x 148 mm), **One-third A4** (99 x 210 mm), **80 mm roll**,
   **58 mm roll**, or **Custom** (width 50-216 mm, height 80-356 mm; the height at least the width). Every size is
   portrait, one receipt per sheet; the preview redraws at that size.
3. Save. Reload the counter page on the counter PC so it picks up the new size.
4. Set the same paper on the counter PC's printer (A5 and A6 are driver sizes; one-third A4 and custom need a custom
   form, SETUP-GUIDE A5.3) and print one test receipt.

The day close summary follows the receipt paper; the board summary export stays A4.
