# M14 - Domain engines: Panchanga calendar and festivals, Aaradhane generator, receipt PDFs, proof reports
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs. Verify against the code before acting on any claim.

## Answers questions about

- How the 730 daily Panchanga JSON files in `data/panchanga/` are produced, by what Python code, and on what schedule.
- What a Panchanga day file actually contains (exact field names) and which fields the app never uses.
- Why the homepage Panchanga widget shows `—` placeholders, and where `getCachedPanchanga` comes from.
- Which panchanga file the running website reads (`public/data/panchanga/current.json`) vs which 730 files only scripts read.
- When the Panchanga data runs out and what breaks on that date.
- How festivals and Ekadashi dates are stored, transformed and displayed, and whether an admin can really edit them.
- Why an admin edit on the festival calendar never shows up on the public calendar page.
- How the Aaradhane generator turns a lunar date (masa + paksha + tithi) into a Gregorian date, and the tithi-numbering convention it depends on.
- Where the 19 Guru Aaradhane records live (three copies) and which one the generator actually reads.
- What the January GitHub Actions run does, and why a first-time year generation never reaches Firestore.
- How a seva receipt number is allocated without collisions, and where the transaction lives.
- How the receipt PDF is drawn (pdf-lib, Helvetica only), why Kannada names disappear from it, and why the logo may not render.
- Where the UPI payment deep link / QR is built and which page renders it.
- Whether "send receipt by email / WhatsApp" works end to end.
- What the proof-report engine crawls, validates and emits, and how many headless browsers it starts.
- What is in the `reports/` folder, who wrote it and whether any of it can be regenerated today.
- Which parts of this module are Python, which are Node-only scripts, and which are pure logic.
- What a React Native client could reuse from these engines and what must move behind an API.

## Purpose and business role

M14 is the set of *domain engines* — the code that computes temple-specific facts rather than
rendering pages or storing CRUD records. Four engines live here.

1. **Panchanga** (Hindu almanac): a Python job computes tithi, nakshatra, yoga, karana, masa,
   sunrise/sunset and the inauspicious windows (Rahu Kalam, Yama Gandam, Gulika Kalam, Abhijit
   Muhurat) for the temple's exact coordinates (13.1005N, 77.5963E, Asia/Kolkata), writes them as
   JSON, and commits them to the repository. Devotees read today's values on the home page and the
   lobby display; Raya AI answers "what is today's tithi" from the same file.
2. **Festivals and Ekadashi**: a hand-maintained static list (`data/calendar.ts`) of 24 festivals and
   19 Ekadashi dates for samvatsara *Sri Parabhava*, enriched at read time with descriptions,
   deities, season and "is this a major festival" flags for the festival experience pages.
3. **Aaradhane generator**: the Matha's 19 Guru Aaradhanes fall on lunar dates, so their Gregorian
   dates move every year. Once a year a job matches each Guru's (lunar month, paksha, tithi) against
   the Panchanga data for the target year and writes/updates `events` documents in Firestore, so the
   events calendar is correct without anyone re-typing dates.
4. **Receipts and reports**: server-side seva receipt creation (atomic numbering, server-resolved
   prices), an A4 PDF renderer, a UPI payment deep link, plus two reporting stacks — a Playwright
   "proof report" that crawls the public site and produces an HTML+PDF evidence pack, and a folder
   of one-off lint/test reports generated in a sandbox that no longer exists.

## Code roots

```
lib/panchanga-cache.ts            lib/festival-utils.ts          lib/date.ts
data/panchanga/{2026,2027}/*.json data/calendar.ts
data/aaradhane/gurus.ts           data/aaradhane/aaradhanaes.json
scripts/panchanga.py              scripts/generate_panchanga.py  .github/workflows/panchanga.yml
services/daily-spiritual.service.ts   app/api/dashboard/daily-spiritual/route.ts
types/calendar.ts  types/festival.ts  types/daily-spiritual.ts
lib/aaradhane/*.ts (6 files)      services/aaradhane.service.ts
types/aaradhane.ts  types/aaradhane-generator.ts
scripts/generate-aaradhane.ts     .github/workflows/aaradhane.yml
AARADHANE_GENERATOR.md            AARADHANE_QUICKREF.md
lib/receipt/*.ts (5 files)
lib/reports/report-saver.ts       services/proof-report/*.ts (13 files)
types/proof-report.ts  types/report.ts
scripts/generate-proof-report.ts  scripts/save-report.ts
reports/ (generate_lint_reports.py + 9 result/summary files)
```

Adopted from Unassigned: none. No Unassigned file belongs here.

Not owned but constantly referenced (one-level boundary, owned elsewhere):
`public/data/panchanga/current.json` (the only panchanga file the site reads),
`components/home/Panchanga.tsx` (M02), `lib/ai/retrieval/panchanga.ts` (M08),
`app/api/admin/receipts/**` (M07/M12), `lib/services/email.ts`, `lib/services/whatsapp.ts` (M13/M12),
`app/api/reports/{save,list}/route.ts` (M05/M12).

Chunk docs graded against the code: `docs/PANCHANGA.md` (427 lines — accurate on the file layout
`:17-36`, the coordinates `:40-49` and the schema `:63-237`; its "API Endpoints" section `:53-61`
documents the static asset URL, not a route, and there is no `app/api/**/panchanga` route in the
repo; its cron list `:270-273` is wrong — see **M14-F42**) and `docs/AARADHANE_GENERATOR.md`
(376 lines — see **M14-F10**, **M14-F21**, **M14-F22**).

## Entry points

| Route or entry | File | server/client | Auth | What it renders or does |
|---|---|---|---|---|
| `GET /api/dashboard/daily-spiritual` | `app/api/dashboard/daily-spiritual/route.ts` | server (force-dynamic, `revalidate = 0`) | none | Temple open/closed status, daily quote, featured event, announcements. **No panchanga in the payload** despite the name. |
| `GET /data/panchanga/current.json` | static file `public/data/panchanga/current.json` | static asset | none | Today's full panchanga; fetched client-side by `components/home/Panchanga.tsx:70` and `app/(public)/display/page.tsx:121`. |
| `python scripts/panchanga.py` | `scripts/panchanga.py` | CLI (Python 3.11 + `panchang` pip pkg) | n/a | Prints today's panchanga JSON; with `--year N --output DIR` writes 365/366 day files. |
| `python scripts/generate_panchanga.py` | `scripts/generate_panchanga.py` | CLI | n/a | Shells out to `panchanga.py`, pretty-prints result into `public/data/panchanga/current.json`. |
| workflow `Generate Daily Panchanga` | `.github/workflows/panchanga.yml` | GitHub Actions | repo `contents: write` | 4 crons/day → runs `generate_panchanga.py` → commits `current.json` → Vercel redeploys. |
| `npm run generate:aaradhane` | `scripts/generate-aaradhane.ts` (`npx tsx`) | Node CLI | Firebase Admin creds for writes | Generates a year of Aaradhane events and upserts them into Firestore `events`. |
| workflow `Generate Yearly Aaradhane Events` | `.github/workflows/aaradhane.yml` | GitHub Actions, cron `30 3 1 1 *` | `FIREBASE_SERVICE_ACCOUNT` secret | Jan 1: ensure panchanga for next year, then run the generator. |
| `npm run generate:proof-report` | `scripts/generate-proof-report.ts` | Node CLI + Playwright | none | Crawls the public site, writes proof-report.html + .pdf + a screenshots/ folder into `reports/` (run-time outputs; none of them are committed today). |
| `npm run save:report` | `scripts/save-report.ts` | Node CLI + Playwright | none | Screenshot/PDF one URL and POST it to `http://localhost:3000/api/reports/save`. |
| `python reports/generate_lint_reports.py` | `reports/generate_lint_reports.py` | CLI (needs `openpyxl`) | n/a | Parses `reports/lint-output.txt` into JSON/xlsx/markdown. Hardcoded `/workspace/project/...` paths — will not run here. |
| `buildReceiptPdf(receipt)` | `lib/receipt/pdf.ts:176` | server (Node: `fs/promises`) | caller enforces | Returns receipt PDF bytes; called by the admin PDF route, email and WhatsApp senders. |
| `createReceiptWithAdmin(input, admin)` | `lib/receipt/admin.ts:66` | server (`import "server-only"`) | verified admin | Validates, re-prices from catalogue, allocates number in a transaction, writes `receipts` doc. |

## Component trees

These engines are mostly non-visual. Three trees matter.

### 1. Home-page panchanga strip (the only devotee-facing panchanga UI)

```
HomePage (server)                        app/(public)/page.tsx            [M02]
└── HomeClient (client)                  components/home/HomeClient.tsx   [M02]
    └── Panchanga (client)               components/home/Panchanga.tsx    [M02]
        ├── useHomepage()                hooks/useHomepage.ts             [M01]
        │     └── homepageService.getHomepage()  -> Firestore settings doc  (CMS override values)
        ├── useEffect -> fetch("/data/panchanga/current.json", {cache:"no-store"})   components/home/Panchanga.tsx:69
        ├── useShare(), useNotifications()        lib/device                [M13]
        └── renders tithi / nakshatra / yoga / karana / sunrise / sunset / rahuKalam / gulikaKalam / masa
              live value ?? CMS value ?? "—"      (DEFAULT_PLACEHOLDER, components/home/Panchanga.tsx:23)
```

`lib/panchanga-cache.ts` is **not** in this tree. Its only consumer is the AI retrieval layer
(`lib/ai/retrieval/panchanga.ts:6`), where `getCachedPanchanga()` is the all-`—` fallback when the
JSON file cannot be read.

### 2. Calendar / festival pages (static data, Server Components)

```
CalendarPage (server)                    app/calendar/page.tsx
├── imports { calendar }                 data/calendar.ts            (static, compiled in)
├── CalendarCenter (client)              components/calendar/CalendarCenter.tsx
├── NextEkadashiCard (client)            components/calendar/NextEkadashiCard.tsx   -> calendar.ekadashi.find(...)
├── EkadashiTable (client)               components/calendar/EkadashiTable.tsx      -> calendar.ekadashi.filter(...)
└── FestivalTable (client)               components/calendar/FestivalTable.tsx      -> calendar.festivals.filter(...)

FestivalsPage (server)                   app/calendar/festivals/page.tsx
└── getAllFestivals()                    lib/festival-utils.ts:168
      └── transformFestivals(calendar)   lib/festival-utils.ts:94
            -> Festival[]                types/festival.ts:6
    └── FestivalExperience (client)      components/festival/FestivalExperience.tsx
        ├── FeaturedFestival (client)    components/festival/FeaturedFestival.tsx  -> calculateCountdown()  types/festival.ts:100
        └── FestivalGrid (client)        components/festival/FestivalGrid.tsx      -> MONTH_NAMES           types/festival.ts:169
```

Nothing in this tree reads Firestore. The admin "festival calendar" screens write to Firestore and
are never read back here — see finding **M14-F01**.

### 3. Daily-spiritual dashboard

```
HomePage / DisplayPage (server)          app/(public)/page.tsx, app/(public)/display/page.tsx
└── dailySpiritualService.getDashboardData()      services/daily-spiritual.service.ts:419
    ├── getTempleStatus()                :89   -> homepageService.getHomepage()  [M02]  + IST clock math (:45)
    ├── getFeaturedEvent()               :224  -> homepage config, else Firestore `events` (:281)
    ├── getActiveAnnouncements()         :382  -> Firestore `announcements`
    ├── getDailyQuote()                  :181  -> homepage config, else quoteService.getTodaysQuote()  [M06]
    └── getAnnouncement2()               :406  -> homepage config
        (all five run in Promise.all, :426)
```

### 4. Proof-report engine (no UI; a service graph)

```
scripts/generate-proof-report.ts
└── new ProofReportService(baseUrl, outputDir)     services/proof-report/proof-report.service.ts:44
    ├── CrawlerService            crawler.service.ts:10        chromium #1  - discoverPublicRoutes() hardcodes 17 routes (:67-85)
    ├── ScreenshotService         screenshot.service.ts:6      chromium #2  - PNG per route into a screenshots/ folder under the output dir
    ├── AccessibilityService      accessibility.service.ts:7   chromium #3  - hand-rolled checks, no axe-core
    ├── SEOService                seo.service.ts:7             chromium #4
    ├── LinkValidatorService      link-validator.service.ts:6  fetch() HEAD/GET per link
    ├── ImageValidatorService     image-validator.service.ts:6 fetch() per image
    ├── ContentQualityService     content-quality.service.ts:7 duplicate/placeholder/short-page detection
    ├── TempleValidatorService    temple-validator.service.ts:8 temple-specific "is timings/poojas/seva price present"
    ├── DatabaseExportService     database-export.service.ts:14 client Firebase SDK -> events, announcements, sevas, dailyPoojas, donations, galleryAlbums, galleryMedia
    ├── SeedReaderService         seed-reader.service.ts:5     reads seed/ai/*.json from disk
    ├── HtmlGeneratorService      html-generator.service.ts:8  855-line template-literal HTML with inline CSS
    └── PdfGeneratorService       pdf-generator.service.ts:7   chromium #5  - prints the HTML to A4 PDF
```

## Data flow

### Flow A - today's panchanga reaches a devotee

1. GitHub Actions cron fires (`.github/workflows/panchanga.yml:6-9`, four crons: 23:30, 21:30, 06:30, 08:30 UTC).
2. Sparse checkout of `scripts/` + `public/data/`, Python 3.11, `pip install panchang` (`panchanga.yml:20-32`).
3. `python scripts/generate_panchanga.py` (`panchanga.yml:35`) subprocess-runs `scripts/panchanga.py` and captures stdout (`generate_panchanga.py:19-26`).
4. `panchanga.py:36 compute_panchanga()` calls `panchang.panchang.compute(date, Location(13.1005, 77.5963, "Asia/Kolkata"))` and serialises tithi/nakshatra/yoga/karana/masa/samvat/sun + four time windows (`panchanga.py:39-108`).
5. Result is written pretty-printed to `public/data/panchanga/current.json` (`generate_panchanga.py:32-33`).
6. Workflow commits and pushes the file; Vercel redeploys (`panchanga.yml:43-51`).
7. Browser loads the home page; `components/home/Panchanga.tsx:69` fetches `/data/panchanga/current.json` with `cache:"no-store"` and merges it over the CMS values, falling back to `"—"`.
8. Independently, Raya AI reads the same file server-side with `fs.readFileSync` (`lib/ai/retrieval/panchanga.ts:42-45`) and falls back to `getCachedPanchanga()` (`lib/panchanga-cache.ts:11`) — which returns all `"—"`.

**Panchanga day-file schema** (identical in `data/panchanga/{year}/{date}.json` and `public/data/panchanga/current.json`;
field names verified against `data/panchanga/2026/2026-06-15.json` and emitted by `scripts/panchanga.py:39-108`):

```
metadata      { generator: "Rayara Panchanga Engine", version, generated_at, ... }   # current.json also carries valid_for, timezone
date          "2026-06-15"
location      { latitude: 13.1005, longitude: 77.5963, timezone: "Asia/Kolkata" }
weekday       { english, sanskrit, number }
sun           { sunrise, sunset, day_duration_hours }        # ISO strings with +05:30 offset
tithi         { number 1-30, name "Krishna Amavasya", paksha "Shukla"|"Krishna", start, end }
nakshatra     { number, name, pada, lord, start, end }
yoga          { number, name, start, end }
karana        { number, name, start, end }
masa          { number, name "Jyeṣṭha" (diacritics), is_adhik: bool, paksha }
samvat        { vikram, shaka, samvatsara }
rahu_kalam / yama_gandam / gulika_kalam / abhijit_muhurat
              { name, start, end, is_auspicious }
durmuhurta / varjyam / amrita_kalam    # arrays, empty in every sampled file
```

Only four of these branches are consumed anywhere: `date`, `tithi`, `masa`, `nakshatra`
(`lib/aaradhane/panchanga.ts:42-54` types exactly those), plus `yoga`, `karana` and `sun`
in the home-page widget. `samvat`, `weekday`, `location`, `metadata`, `durmuhurta`, `varjyam`
and `amrita_kalam` are written and never read. The `tithi.number` is the continuous 1-30
numbering the `+15` rule in `lib/aaradhane/panchanga.ts:151-155` depends on, and
`masa.is_adhik` is the field finding **M14-F32** turns on.

### Flow B - a year of Aaradhane events

1. `npm run generate:aaradhane -- --year 2027` → `scripts/generate-aaradhane.ts:49 main()`; sets `process.env.TZ = "Asia/Kolkata"` (`:27`).
2. Asserts `data/panchanga/2027/` exists and counts the files (`generate-aaradhane.ts:91-104`).
3. Default path (no `--firestore`): loads `GURU_AARADHANES` from `data/aaradhane/gurus.ts` (`:146`) — 19 records — and maps them to `GuruParamparaRecord` shape (`:175-189`).
   With `--firestore`: `lib/aaradhane/generator.ts:41 generateAaradhanaeEvents()` reads Firestore `guruParampara/aaradhanaes` instead (`lib/aaradhane/firestore-source.ts:33`).
4. `loadYearlyPanchanga(2027)` (`lib/aaradhane/panchanga.ts:64`) reads and `JSON.parse`s **all 365 files** into a `Map<date, {date, tithi, masa, nakshatra}>`.
5. Per Guru, `findDatesForLunarDate()` (`lib/aaradhane/panchanga.ts:115`) scans that map: normalise masa name (strip diacritics, `:189`), match paksha, and match tithi where Krishna-paksha tithis are `15 + tithiNumber` (`:151-155`). Multi-day Aaradhanes take the first match plus N-1 consecutive calendar days (`:163-179`).
6. `generateEventsFromGurus()` (`lib/aaradhane/local-generator.ts:25`, or the Firestore twin at `lib/aaradhane/generator.ts:122`) builds a `GeneratedAaradhaneEvent` with `eventKey = "<guruId>-<year>"` (`generator.ts:211`), a generated English description (`:263`) and default Kannada rituals/offerings (`:220-231`).
7. `validateGeneratedEvents()` (`local-generator.ts:170` / `generator.ts:407`) asserts exactly 3 Sri Raghavendra events with Poorva/Madhya/Uttara phases, valid in-year dates and unique keys. Failures are printed as warnings only — the run continues.
8. Unless `--dry-run`, `updateFirestoreWithAdmin(events, year, true)` (`lib/aaradhane/firestore-admin.ts:107`) queries `events` where `autoGenerated == true && year == Y && category == "Aaradhane"` (`:30-36`), then per event either updates the existing doc (`:215`) or creates a new one (`:229`). `eventToFirestoreDocument()` (`lib/aaradhane/generator.ts:313`) converts to Firestore `Timestamp`s and derives `status` from today's date (`:345`).
9. The public site then reads those `events` docs through `services/aaradhane.service.ts` (`:158 getAaradhanes`, falling back across the `aaradhane` and `aaradhanes` collections, then `eventDocToAaradhane` at `:77`).

### Flow C - issuing a seva receipt

1. Admin fills `app/admin/receipts/create/page.tsx`; the client pre-validates with `validateReceiptCreateInput` (`lib/receipt/validation.ts:23`) and renders a UPI QR from `buildUpiPaymentUrl` (`lib/receipt/upi.ts:9`) — the link is built at `create/page.tsx:99` and turned into a data URL by a dynamically imported `qrcode` package at `:108-109`, drawn as an `<img>` at `:270`. The QR is client-side only; nothing about it reaches the PDF.
2. `POST /api/admin/receipts` → `createReceiptWithAdmin(input, admin)` (`lib/receipt/admin.ts:66`).
3. Server re-validates, then `sanitizeReceiptCreateInput` (`validation.ts:108`).
4. For every line, the server re-reads the seva from Firestore `sevas` and rejects unknown/disabled/invalid-price sevas (`admin.ts:79-102`); rate and name are snapshotted into the item so later price edits do not rewrite history.
5. Totals recomputed server-side: `computeItemAmount` / `computeReceiptTotals` (`validation.ts:6,10`).
6. `allocateNextReceiptNumber` (`admin.ts:45`) runs a Firestore transaction on `system/receiptCounter`, `nextSequenceForYear` (`numbering.ts:29`) resets to 1 on a year change, `formatReceiptNumber` (`numbering.ts:8`) yields `RM-2026-000001`.
7. Receipt doc written to `receipts` with `createdBy = admin.email ?? admin.uid` (`admin.ts:121-139`).
8. `GET /api/admin/receipts/[id]/pdf` loads the doc plus temple contact from the newest `settings` doc, then `buildReceiptPdf` (`lib/receipt/pdf.ts:176`) draws a 612x792pt page with pdf-lib: gold bar, logo, meta block, item table, totals, notes.
9. Delivery: `lib/services/email.ts:5 sendEmail()` (nodemailer + PDF attachment) and `lib/services/whatsapp.ts:4 sendWhatsApp()` exist, but **nothing calls them** — `app/api/admin/receipts/[id]/send/route.ts` is a one-line stub returning `{success:true}`.

### Flow D - proof report

1. `npm run generate:proof-report`; base URL from `PROOF_REPORT_BASE_URL` or a hardcoded all-hands sandbox URL (`scripts/generate-proof-report.ts:27-28`); output dir `reports/` (`:31-32`).
2. `ProofReportService.generate()` (`services/proof-report/proof-report.service.ts:64`) starts five Chromium instances (`:74-78`).
3. Crawl 17 hardcoded routes (`crawler.service.ts:67-85`), each producing a `PageInfo` (title, headings, meta, visible text, images, links, tables, lists, buttons, forms, contact info).
4. Screenshots, accessibility, SEO, link and image validation, content quality, temple validation, Firestore export, AI seed read (`proof-report.service.ts:99-131`).
5. `calculateSummary` (`:200`) counts errors/warnings and shells `git rev-parse HEAD` for the commit hash (`:230`).
6. `HtmlGeneratorService.generate` writes proof-report.html into the output dir (`html-generator.service.ts:15`), `PdfGeneratorService.generate` prints it to proof-report.pdf (`pdf-generator.service.ts:21`). Neither output, nor the screenshots folder, is present in this checkout — the report has not been generated here.
7. All five browsers closed in `finally` (`proof-report.service.ts:181-188`).

## Key files

| File | Lines | Role | Key exports | Notes |
|---|---:|---|---|---|
| `scripts/panchanga.py` | 185 | The actual almanac engine | `compute_panchanga`, `main` | Only real astronomy in the repo; wraps pip pkg `panchang`. Lat/lon/tz hardcoded at `:19-21`. `--year` writes a whole year. |
| `scripts/generate_panchanga.py` | 42 | CI wrapper | `main` | Subprocess + re-serialise into `public/data/panchanga/current.json`. Cannot generate a year (doc error messages claim it can). |
| `.github/workflows/panchanga.yml` | 53 | Daily refresh | — | 4 crons; commits `current.json` back to the default branch. |
| `data/panchanga/{2026,2027}/*.json` | 730 files, 3.1 MB | Pre-computed almanac | — | `2026-01-01` … `2027-12-31`. Read **only** by `lib/aaradhane/panchanga.ts`; never shipped to the browser. |
| `lib/panchanga-cache.ts` | 47 | Placeholder fallback | `PanchangaData`, `getCachedPanchanga`, `getPanchangaWithFallback` | Returns all `"—"`. Despite the name there is no cache. `getPanchangaWithFallback` is exported but unused. |
| `data/calendar.ts` | 56 | Static festival/Ekadashi list | `calendar` | Year 2026, samvatsara `Sri Parabhava`; 19 Ekadashi + 24 festival rows, last entry 2027-03-22. |
| `types/calendar.ts` | 17 | Shapes for the above | `Ekadashi`, `Festival`, `CalendarData` | `Festival` here collides by name with `types/festival.ts:6` `Festival` — different shapes. |
| `lib/festival-utils.ts` | 171 | Enrichment layer | `transformFestivals`, `getAllFestivals` | Four hardcoded lookup tables (major list, descriptions, deities, significance/practices) keyed by exact English name. |
| `types/festival.ts` | 194 | Rich festival model + helpers | `Festival`, `getUpcomingFestivals`, `getFeaturedFestival`, `calculateCountdown`, `getFestivalsByMonth`, `getSeasonColor`, `MONTH_NAMES` | `getSeasonColor` returns Tailwind gradient class strings — presentation inside a types file. |
| `lib/date.ts` | 14 | Firestore `Timestamp` → `dd MMM yyyy` | `formatEventDate` | **Dead code**: no importer anywhere (import-graph shows zero). |
| `services/daily-spiritual.service.ts` | 446 | Homepage dashboard aggregate | `dailySpiritualService` | IST clock via `Intl` (`:45`); temple-hours string parsing (`:27`); one `any` at `:74` (the file's only one). Does not include panchanga. |
| `app/api/dashboard/daily-spiritual/route.ts` | 25 | HTTP wrapper | `GET`, `dynamic`, `revalidate` | `no-store` headers; public, no auth. |
| `types/daily-spiritual.ts` | 156 | Dashboard shapes + defaults | `TempleStatus`, `PanchangaSummary`, `DailyQuote`, `DailySpiritualDashboard`, `DEFAULT_QUOTES`, `DEFAULT_PRASADA` | `PanchangaSummary` (`:28`) and `PrasadaInfo`/`DEFAULT_PRASADA` are declared but never produced by the service. |
| `data/aaradhane/gurus.ts` | 392 | Master Guru dataset (19 records) | `GURU_AARADHANES`, `GURU_AARADHANE_BY_ID`, `getAaradhanaesForGuru`, `getRaghavendraAaradhanes`, `getMajorAaradhanes`, `AARADHANE_COUNT`, plus its own `LunarMonth`/`Paksha`/`Tithi`/`AaradhanePhase`/`GuruImportance` types | Type aliases duplicate `types/aaradhane-generator.ts:10-25` verbatim. Default source for the generator. |
| `data/aaradhane/aaradhanaes.json` | 274 | Same 19 records as JSON | — | `totalCount: 19`. No importer — it is the seed payload / documentation copy. |
| `lib/aaradhane/panchanga.ts` | 257 | Lunar→Gregorian matching | `LOCATION`, `loadYearlyPanchanga`, `hasYearlyPanchanga`, `findDatesForLunarDate`, `getDateRangeString`, `getTithiDisplayName`, types | Node-only (`fs`, `path`, `process.cwd()`). The tithi `+15` convention (`:151`) is the single most load-bearing rule in the module. |
| `lib/aaradhane/generator.ts` | 461 | Firestore-backed generator | `generateAaradhanaeEvents`, `generateEventsFromGurus`, `eventToFirestoreDocument`, `printGenerateSummary`, `validateGeneratedEvents` | Imports `firebase/firestore` `Timestamp`. |
| `lib/aaradhane/local-generator.ts` | 213 | Firestore-free twin | `generateEventsFromGurus`, `printGenerateSummary`, `validateGeneratedEvents` | ~90% duplicate of `generator.ts` minus the config object. The default CLI path uses this one. |
| `lib/aaradhane/firestore-source.ts` | 111 | Reads `guruParampara/aaradhanaes` | `getGuruParamparaRecords`, `getGuruParamparaById`, `hasGuruParamparaData`, `getGuruAaradhaneCount` | Client SDK (`@/lib/firebase`) used from a Node script — depends on public read rules. |
| `lib/aaradhane/firestore-admin.ts` | 300 | Admin-SDK upsert into `events` | `getExistingAutoGeneratedEventsAdmin`, `updateFirestoreWithAdmin`, `printUpdateSummary` | The path actually used for writes (`generate-aaradhane.ts:230`). |
| `lib/aaradhane/firestore.ts` | 490 | Client-SDK upsert into `events` | `getExistingAutoGeneratedEvents`, `findEventByKey`, `updateFirestoreEvents`, `printUpdateSummary`, `batchUpdateFirestoreEvents` | **Dead code**: no importer. Duplicates `firestore-admin.ts` and adds an unused batch path. Still cited as a "key component" in `docs/AARADHANE_GENERATOR.md:177`. |
| `lib/aaradhane/firestore-rest.ts` | 118 | Raw Firestore REST client | `FirestoreDocument`, `FirestoreRestClient`, `firestoreClient` | **Dead code**: no importer. Hardcodes `PROJECT_ID = "sri-raghavendra-mutt"` (`:6`) and writes with an API key. |
| `types/aaradhane-generator.ts` | 286 | Generator contracts | `GuruParamparaRecord`, `GeneratedAaradhaneEvent`, `GenerateResult`, `FirestoreEventDocument`, `ExistingEvent`, `EventUpdateResult`, `UpdateResult`, `GeneratorConfig`, lunar enums | Well-typed; the only `Timestamp` import ties it to `firebase/firestore`. |
| `types/aaradhane.ts` | 30 | Runtime Aaradhane display model | `Aaradhane`, `AaradhaneSeva`, `AaradhaneStats` | `dates: string[]` — display strings, not ISO dates, once produced by `eventDocToAaradhane`. |
| `services/aaradhane.service.ts` | 284 | Read/CRUD for the public + admin Aaradhane pages | `aaradhaneService` | Reads three collections (`aaradhane`, `aaradhanes`, `events`), `any` in four helpers (`:32`, `:50`, `:77`). |
| `scripts/generate-aaradhane.ts` | 347 | Generator CLI | — | Flags `--year --dry-run --check --seed --firestore --help`. Help text advertises `npm run export:aaradhane`, which does not exist in `package.json`. |
| `.github/workflows/aaradhane.yml` | 281 | Yearly job | — | 130 lines of inline Python duplicating `panchanga.py`. Writes the service account to `firebase-admin-key.json` in the workspace (`:232`). |
| `AARADHANE_GENERATOR.md` | 251 | Operator setup guide (repo root) | — | Duplicate of, and partly contradicting, `docs/AARADHANE_GENERATOR.md` (376 lines). |
| `AARADHANE_QUICKREF.md` | 67 | Command cheat-sheet | — | Lists `npm run export:aaradhane` (missing) and `python scripts/generate_panchanga.py --year` (unsupported flag). |
| `lib/receipt/numbering.ts` | 37 | Receipt number format | `DEFAULT_RECEIPT_PREFIX`, `DEFAULT_STARTING_SEQUENCE`, `formatReceiptNumber`, `parseReceiptYear`, `nextSequenceForYear` | Pure, unit-tested, zero platform dependency. |
| `lib/receipt/validation.ts` | 133 | Shared client+server validation | `RECEIPT_PAYMENT_MODE`, `computeItemAmount`, `computeReceiptTotals`, `validateReceiptCreateInput`, `validateReceiptSevaInput`, `sanitize*` | Pure. Hand-rolled email check (`:49-70`). `paymentMode` is forced to `"upi"` — no cash/card path exists. |
| `lib/receipt/upi.ts` | 41 | UPI deep link | `DEFAULT_UPI_ID`, `DEFAULT_UPI_PAYEE`, `buildUpiPaymentUrl`, `formatPdfAmount` | Real UPI VPA hardcoded at `:1`. `formatPdfAmount` is byte-identical to the one in `pdf.ts:197`. |
| `lib/receipt/admin.ts` | 142 | Server-only receipt creation | `CreateReceiptResult`, `createReceiptWithAdmin` | The best-written file in the module: `server-only`, transaction, server-side re-pricing. |
| `lib/receipt/pdf.ts` | 226 | A4 receipt renderer | `ReceiptTempleContact`, `ReceiptPdfOptions`, `buildReceiptPdf`, `formatPdfAmount` | pdf-lib + `StandardFonts.Helvetica`. `toAscii` (`:37`) destroys all non-Latin text. Several bugs — see F07/F08/F09. |
| `lib/reports/report-saver.ts` | 291 | Playwright screenshot/PDF → blob storage | `ReportMetadata`, `SaveReportResponse`, `captureAndSaveScreenshot`, `exportAndSavePdf`, `captureFullReport`, `ReportSaver`, `createReportSaver` | No production importer; the only importer anywhere is `tests/reports/save-reports.spec.ts:18`. Uses a relative `fetch('/api/reports/save')` from Node (`:33`), which cannot resolve. |
| `services/proof-report/proof-report.service.ts` | 271 | Orchestrator | `ProofReportService` | 11 injected services, 5 Chromium launches, `any` throughout `calculateSummary` (`:200-211`). |
| `services/proof-report/crawler.service.ts` | 350 | Page scraper | `CrawlerService` | Route list hardcoded (`:66-85`) — new public routes are silently never audited. |
| `services/proof-report/screenshot.service.ts` | 84 | Full-page PNGs | `ScreenshotService` | Own browser; writes into a screenshots/ folder under the output dir (`proof-report.service.ts:47`). |
| `services/proof-report/accessibility.service.ts` | 169 | A11y heuristics | `AccessibilityService` | No axe-core; checks alt text, empty headings, labels, long paragraphs. Launches a browser it barely needs. |
| `services/proof-report/seo.service.ts` | 177 | SEO heuristics | `SEOService` | Title/meta/og/canonical/large-image checks. |
| `services/proof-report/link-validator.service.ts` | 134 | Link liveness | `LinkValidatorService` | Plain `fetch` (`:59`); no concurrency cap or retry. |
| `services/proof-report/image-validator.service.ts` | 123 | Image liveness/size | `ImageValidatorService` | Plain `fetch` (`:41`). |
| `services/proof-report/content-quality.service.ts` | 118 | Duplicate/placeholder/short-page detection | `ContentQualityService` | `calculateSimilarity` (`:101`) is O(n²) over page text. |
| `services/proof-report/temple-validator.service.ts` | 160 | Temple-domain completeness checks | `TempleValidatorService` | Checks timings, poojas, seva prices, contact, donation, festival, guru, brindavana, map, emergency. |
| `services/proof-report/database-export.service.ts` | 160 | Firestore snapshot for the report | `DatabaseExportService` | Client SDK with `NEXT_PUBLIC_*` env (`:26-31`); reads 7 collections (`:78-84`), each `.catch(() => ({docs: []}))`. |
| `services/proof-report/seed-reader.service.ts` | 136 | Reads `seed/ai/*.json` | `SeedReaderService` | Pure fs walk. |
| `services/proof-report/html-generator.service.ts` | 856 | The report document | `HtmlGeneratorService` | One giant template literal with inline CSS (`:28`); 12 `generate*Section` methods; `escapeHtml` at `:846`. |
| `services/proof-report/pdf-generator.service.ts` | 66 | HTML → A4 PDF | `PdfGeneratorService` | Chromium print. |
| `types/proof-report.ts` | 324 | All report shapes | `PageInfo`, `ImageInfo`, `FormInfo`, `FormField`, `ContactInfo`, `ScreenshotInfo`, `AccessibilityIssue`, `SEOIssue`, `LinkValidationResult`, `ImageValidationResult`, `ContentQualityIssue`, `TempleValidationIssue`, `SeedArticle`, `DatabaseContent`, `ProofReportSummary`, `TableOfContentsItem`, `ProofReportData` | Clean discriminated string unions; the best type file here. |
| `types/report.ts` | 28 | Admin revenue/booking/donation rollups | `RevenueReport`, `BookingReport`, `DonationReport`, `ReportSummary` | Unrelated to proof reports; only consumer is `services/report.service.ts:4` [M10]. |
| `scripts/generate-proof-report.ts` | 83 | Proof-report CLI | — | Default base URL is a dead all-hands.dev sandbox (`:28`). |
| `scripts/save-report.ts` | 166 | Ad-hoc screenshot/PDF uploader | — | Hardcoded `http://localhost:3000/api/reports/save` (`:26`). |
| `reports/generate_lint_reports.py` | 440 | Lint output → JSON/xlsx/markdown | `generate_json_report`, `generate_lint_excel`, `generate_lint_summary_md`, `generate_executive_summary`, `generate_bug_report` | Absolute `/workspace/project/Rayaramathaynk/...` paths (`:16`); needs `openpyxl`. Unrunnable in this checkout. |
| `reports/lint_results.json` | 1235 | Lint snapshot 2026-07-13 | — | 60 issues: 12 errors, 48 warnings, 60 files. |
| `reports/LintReport.md` | 147 | Human-readable lint write-up | — | Generated from `lint_results.json`; frozen at 2026-07-13. |
| `reports/LintExecutiveSummary.md` | 94 | Management-level lint summary | — | Same generation run, same freeze date. |
| `reports/test_results.json` | 173 | Route smoke test, 29 pages | — | 25 passed, 4 failed. |
| `reports/TESTING_SUMMARY.md` | 245 | Overall QA narrative | — | Static history; nothing regenerates it. |
| `reports/SPRINT2_TESTING_SUMMARY.md` | 228 | Sprint 2 QA narrative | — | Static history. |
| `reports/SPRINT3_TESTING_SUMMARY.md` | 339 | Sprint 3 QA narrative | — | Static history. |
| `reports/SPRINT4_TESTING_SUMMARY.md` | 319 | Sprint 4 QA narrative | — | Static history. |
| `reports/SPRINT5_TESTING_SUMMARY.md` | 305 | Sprint 5 QA narrative | — | Static history. |

Also present in `reports/` but outside the inventory (not opened — binary/bulk): `LintBugReport.xlsx`,
`LintIssues.xlsx`, `lint-output.txt`.

## Types and stores

**Types owned:** `types/calendar.ts`, `types/festival.ts`, `types/daily-spiritual.ts`,
`types/aaradhane.ts`, `types/aaradhane-generator.ts`, `types/proof-report.ts`, `types/report.ts`.
**Types consumed from elsewhere:** `types/receipt.ts` (`Receipt`, `ReceiptCreateInput`, `ReceiptItem`,
`PaymentMode`), `types/receiptSeva.ts` (`ReceiptSevaInput`), `types/announcement.ts`, `types/event.ts`,
`types/seva.ts`, `types/gallery.ts`, `types/pooja.ts`, `types/settings.ts`, `types/homepage.ts`,
`types/donation.ts` — all M10/M11.

| Store | Kind | Accessed by | R/W |
|---|---|---|---|
| `data/panchanga/{year}/{date}.json` (730 files) | repo files | `lib/aaradhane/panchanga.ts:64,101` | read (scripts only) |
| `public/data/panchanga/current.json` | static asset | `components/home/Panchanga.tsx:70`, `app/(public)/display/page.tsx:121`, `lib/ai/retrieval/panchanga.ts:42` | read; written by `scripts/generate_panchanga.py:32` |
| `data/calendar.ts` | compiled-in constant | calendar + festival pages, `lib/festival-utils.ts:7`, 4 admin pages | read only |
| `data/aaradhane/gurus.ts` | compiled-in constant | `scripts/generate-aaradhane.ts:146`, `scripts/export-events.ts:27`, `scripts/generate-events-firestore.ts:17`, `tests/unit/aaradhane/gurus.test.ts` | read only |
| `data/aaradhane/aaradhanaes.json` | repo file | nothing | — |
| Firestore `guruParampara/aaradhanaes` | Firestore doc | `lib/aaradhane/firestore-source.ts:33,74,96` | read (seeded by `scripts/seed-guru-parampara.ts`) |
| Firestore `events` | collection | `lib/aaradhane/firestore-admin.ts:30,215,229`; `lib/aaradhane/firestore.ts` (dead); `services/aaradhane.service.ts:18`; `services/daily-spiritual.service.ts:293,331`; `database-export.service.ts:78` | read + write |
| Firestore `aaradhane` / `aaradhanes` | collections | `services/aaradhane.service.ts:164,175,199,210,227,240,249,262` | read + write |
| Firestore `announcements` | collection | `services/daily-spiritual.service.ts:388`, `database-export.service.ts:79` | read |
| Firestore `receipts` | collection | `lib/receipt/admin.ts:138`, `app/api/admin/receipts/[id]/pdf/route.ts:55` | read + write |
| Firestore `sevas` | collection | `lib/receipt/admin.ts:80` (price lookup), `database-export.service.ts:80` | read |
| Firestore `system/receiptCounter` | doc | `lib/receipt/admin.ts:46-53` | read + write (transaction) |
| Firestore `settings` | collection | `app/api/admin/receipts/[id]/pdf/route.ts:27`; admin festival/ekadashi pages write `settings/festivalCalendar` and `settings/ekadashiCalendar` | read + write |
| Firestore `dailyPoojas`, `donations`, `galleryAlbums`, `galleryMedia` | collections | `database-export.service.ts:81-84` | read |
| `seed/ai/*.json` | repo files | `services/proof-report/seed-reader.service.ts:23` | read |
| `reports/` | repo folder | proof-report + lint scripts | write |
| Vercel Blob | external storage | `app/api/reports/save|list` via `services/storage.service.ts` [M10] | write + list |

## Cross-module dependencies

**This module imports:**

| From | What | Chunk |
|---|---|---|
| `@/lib/firebase` (`db`) | `firestore-source.ts:12`, `aaradhane.service.ts:13`, `daily-spiritual.service.ts:6` | M10 |
| `@/lib/admin-firebase` (`getAdminFirestore`) | `firestore-admin.ts:9`, `lib/receipt/admin.ts:16` | M10 |
| `@/lib/auth/admin-auth` (`ServerAdminUser`) | `lib/receipt/admin.ts:18` | M04 |
| `./homepage.service`, `./quote.service` | `daily-spiritual.service.ts:21-22` | M02 / M06 |
| `@/types/receipt`, `@/types/receiptSeva` | receipt engine | M10 |
| `@/types/{event,seva,gallery,announcement,pooja,settings,homepage,donation}` | `database-export.service.ts:5-12` | M10/M11 |
| `firebase/firestore` `Timestamp` | `lib/date.ts:1`, `generator.ts:9`, `types/aaradhane-generator.ts:8` | M10 |
| `playwright` / `@playwright/test` | proof-report services, `report-saver.ts:6`, `save-report.ts:11` | M15 |
| `pdf-lib`, `nodemailer` (indirect) | `lib/receipt/pdf.ts:3` | — |

**This module is imported by:**

| Consumer | What it takes | Chunk |
|---|---|---|
| `lib/ai/retrieval/panchanga.ts:6` | `getCachedPanchanga`, `PanchangaData` | M08 |
| `app/calendar/festivals/page.tsx:8`, `services/recommendation.service.ts:15` | `getAllFestivals` | M02 / M10 |
| `components/festival/*` (4 files) | `types/festival.ts` helpers | M02 |
| `app/calendar/page.tsx`, `components/calendar/*` (4), `app/admin/calendar/*` (2), `app/admin/settings/*-calendar` (2) | `data/calendar.ts` | M02 / M07 |
| `app/(public)/page.tsx`, `app/(public)/display/page.tsx`, `app/api/dashboard/daily-spiritual/route.ts` | `dailySpiritualService` | M02 / M05 |
| `app/(public)/aaradhane/page.tsx`, `app/admin/aaradhane/page.tsx`, `app/admin/assistant/page.tsx`, `app/api/admin/aaradhane/**`, `components/admin/aaradhane/*` (4) | `aaradhaneService` | M03 / M07 / M12 |
| `app/api/admin/receipts/[id]/pdf/route.ts:4`, `lib/services/email.ts:3`, `lib/services/whatsapp.ts:2` | `buildReceiptPdf` | M12 / M13 |
| `app/admin/receipts/create/page.tsx:16,19`, `app/admin/receipts/seva-settings/page.tsx:16`, `app/api/admin/receipt-sevas/**` | `validateReceipt*`, `buildUpiPaymentUrl` | M07 / M12 |
| `services/report.service.ts:4` | `types/report.ts` | M10 |
| `tests/unit/aaradhane/{gurus,generator,panchanga}.test.ts`, `tests/unit/receipt-{numbering,payment,validation}.test.ts` | the pure engines | M15 |

## How to change it

### 1. Extend the Panchanga coverage past 2027-12-31 (do this before Q4 2027)
1. `pip install panchang` locally (Python 3.11).
2. `python scripts/panchanga.py --year 2028 --pretty` → writes `data/panchanga/2028/*.json` (`scripts/panchanga.py:139-170`). Do **not** use `generate_panchanga.py`; it has no `--year`.
3. Commit the 366 files (2028 is a leap year — the script handles it at `:146`).
4. Sanity check: `node -e "..."` count of files, and open one file to confirm `masa`/`tithi` are non-null.
5. No code change is needed; `loadYearlyPanchanga` discovers the directory by name (`lib/aaradhane/panchanga.ts:65`).

### 2. Add or edit a Guru Aaradhane
1. Add the record to `data/aaradhane/gurus.ts` (`GURU_AARADHANES` array) — id, guruName, title, paramparaNumber, lunarMonth, paksha, tithiNumber (1-15, *not* 16-30), tithi, durationDays, importance.
2. Mirror it into `data/aaradhane/aaradhanaes.json` so the two copies do not drift.
3. If the Firestore path is in use, also update `guruParampara/aaradhanaes` (`scripts/seed-guru-parampara.ts`).
4. Update `tests/unit/aaradhane/gurus.test.ts` counts.
5. Preview: `npm run generate:aaradhane -- --year 2027 --dry-run`.
6. Apply: same command without `--dry-run` (needs Firebase Admin credentials).

### 3. Add a field to the generated Aaradhane event
1. `types/aaradhane-generator.ts` — add to `GeneratedAaradhaneEvent` and `FirestoreEventDocument`.
2. `lib/aaradhane/local-generator.ts` `generateSingleEvent` (`:77`) — populate it.
3. `lib/aaradhane/generator.ts` `generateSingleEvent` (`:183`) — populate it **again** (the two are duplicates).
4. `lib/aaradhane/generator.ts` `eventToFirestoreDocument` (`:313`) — map it into the Firestore doc.
5. `services/aaradhane.service.ts` `eventDocToAaradhane` (`:77`) and `types/aaradhane.ts` — surface it to the UI.
6. Firestore rules/indexes in M11 if it is queried.

### 4. Change the festival list so the public site actually shows it
Today the public pages read the compiled constant, so:
1. Edit `data/calendar.ts` (`festivals` / `ekadashi` arrays) and redeploy — this is the only path that works.
2. If instead you want the admin screens to matter, make `lib/festival-utils.ts:168 getAllFestivals()` async and read `settings/festivalCalendar` first, falling back to `calendar`; then update `app/calendar/page.tsx` and `components/calendar/{FestivalTable,EkadashiTable,NextEkadashiCard,CalendarCenter}.tsx` to consume it, and delete the in-memory-only editors at `app/admin/calendar/festivals/page.tsx` and `app/admin/calendar/ekadashi/page.tsx`.
3. Add descriptions/deities for any new festival name to the tables in `lib/festival-utils.ts:28,60,126,141`, otherwise it renders `"Celebration of <name>"`.

### 5. Add a field to the receipt PDF
1. `types/receipt.ts` (M10) — add the field.
2. `lib/receipt/validation.ts` — validate and sanitize it.
3. `lib/receipt/admin.ts:121` — persist it on the receipt doc.
4. `lib/receipt/pdf.ts` — draw it in `drawMeta` (`:92`) or `drawNotes` (`:154`); remember `toAscii` (`:37`) will strip anything non-Latin, and the layout uses absolute y-constants (`:83-90`) that you must extend rather than reuse.
5. `app/admin/receipts/create/page.tsx` (M07) — collect it.

### 6. Add a new check to the proof report
1. Add the issue type to `types/proof-report.ts` (a new union member + result interface + a field on `ProofReportData`).
2. Create `services/proof-report/<name>.service.ts` following `content-quality.service.ts` (no browser needed unless you must evaluate in-page).
3. Register it in the constructor and `generate()` of `services/proof-report/proof-report.service.ts:44,64`, and include its counts in `calculateSummary` (`:200`).
4. Add a `generate<Name>Section` method to `services/proof-report/html-generator.service.ts` and a `buildTableOfContents` entry (`proof-report.service.ts:256`).

### 7. Point the proof report at a real environment
1. Set `PROOF_REPORT_BASE_URL` (the default at `scripts/generate-proof-report.ts:28` is a dead sandbox).
2. Extend the route list at `services/proof-report/crawler.service.ts:66` — it does not discover routes from the App Router tree despite the comment.

## Faults, smells and risks

| id | sev | What | Evidence | Direction |
|---|---|---|---|---|
| M14-F01 | HIGH | Admin festival/Ekadashi edits are invisible to devotees. The settings screens persist to `settings/festivalCalendar` / `settings/ekadashiCalendar`, but every public calendar component imports the compiled constant — and a repo-wide grep for those two document names finds **only the two writer pages**: nothing in the codebase ever reads them back. | write: `app/admin/settings/festival-calendar/page.tsx:29-30`, `app/admin/settings/ekadashi-calendar/page.tsx:29`; read: `app/calendar/page.tsx:3`, `components/calendar/FestivalTable.tsx:20`, `components/calendar/EkadashiTable.tsx:18`, `lib/festival-utils.ts:7`; `grep -rn "festivalCalendar\|ekadashiCalendar"` → 2 writers + one unrelated i18n key | Make the calendar read Firestore with the static list as fallback (recipe 4). |
| M14-F02 | HIGH | Two more admin "calendar" pages edit state in React only — add/edit/delete a festival and it is gone on reload. No Firestore call at all. | `app/admin/calendar/festivals/page.tsx:9-16` (only `useState`), `app/admin/calendar/ekadashi/page.tsx` (grep for `setDoc`/`getDoc` returns nothing) | Delete these two pages or wire them to the same settings docs as the `/admin/settings/*-calendar` pair. |
| M14-F03 | HIGH | Panchanga data ends `2027-12-31`. From 2028-01-01 the Aaradhane generator throws (`Panchanga data not found`) and no Aaradhane events can be produced. 468 days of runway as of 2026-09-19. | `data/panchanga/2027/2027-12-31.json` is the last file; `lib/aaradhane/panchanga.ts:68-71` | Generate 2028+ now (recipe 1), and add a CI check that fails when fewer than 400 future days exist. |
| M14-F04 | HIGH | The receipt PDF silently mangles Kannada/Devanagari. Only `StandardFonts.Helvetica` is embedded and `toAscii` replaces every non-Latin character with a space — devotee names, seva names and notes in Kannada come out blank. | `lib/receipt/pdf.ts:37-40`, `:185-186`; `lib/receipt/upi.ts:31-34` admits the rupee glyph problem | Embed a Unicode TTF (Noto Sans Kannada) with `@pdf-lib/fontkit` and delete `toAscii`. |
| M14-F05 | HIGH | "Send receipt" is a stub. `app/api/admin/receipts/[id]/send/route.ts` is a single line returning `{success:true}`; `lib/services/email.ts:5` and `lib/services/whatsapp.ts:4` have zero callers, so the admin UI reports success while nothing is sent. | `app/api/admin/receipts/[id]/send/route.ts` (whole file); import-graph shows no importer of either sender | Wire the route to `sendEmail`/`sendWhatsApp`, or make it return 501 until it is implemented. |
| M14-F06 | HIGH | The Aaradhane workflow never writes Firestore on the first run for a new year: the live-update step is gated on `check_panchanga.outputs.exists == 'true'`, which is evaluated *before* the generate-panchanga step, so a year whose data had to be generated only ever gets a dry run. | `.github/workflows/aaradhane.yml:84-85` (generate if not exists) vs `:238` (dry-run if not exists) and `:244` (live only if exists) | Re-check for data after generation, or commit the generated year and run the update unconditionally. |
| M14-F07 | HIGH | The receipt logo is embedded into a throwaway `PDFDocument` and then drawn on a different document — pdf-lib images are document-scoped, so this either throws or produces a broken XObject. | `lib/receipt/pdf.ts:221-225` creates a new `PDFDocument` inside `embedFromBytes`, whose result is drawn at `:76` on the receipt's page. The path is always taken, not a rare fallback: the third candidate in the chain at `:203-208` is `public/images/logos/ynk_matha_logo.png`, which exists on disk, so `loadLogoBytes` returns a foreign-document `PDFImage` on every render | Pass the receipt `PDFDocument` into `embedFromBytes` and call `pdf.embedPng(bytes)` on it. |
| M14-F08 | MEDIUM | Receipt PDF draws the "Address" label at the same y as the email row and never draws the address value. | `lib/receipt/pdf.ts:104-110` (both use `metaY`) | Advance `metaY` per row and render `receipt.devoteeAddress`. |
| M14-F09 | MEDIUM | Receipt PDF has no overflow handling: a single fixed page, absolute y-constants, no pagination. Enough items and rows render off the bottom or over the footer. | `lib/receipt/pdf.ts:83-90` constants, `:113-133` `drawItems` decrements `y` unbounded, `:187` one `addPage` | Add a page break when `y < MARGIN + 80`. |
| M14-F10 | MEDIUM | `lib/aaradhane/firestore.ts` (490 lines) and `lib/aaradhane/firestore-rest.ts` (118) are dead — no importer anywhere — yet `docs/AARADHANE_GENERATOR.md:177` documents `firestore.ts` as a key component. | grep for `aaradhane/firestore"`/`firestore-rest` outside the folder returns nothing; `lib/aaradhane/firestore-admin.ts` is the only path used (`scripts/generate-aaradhane.ts:230`) | Delete both and fix the doc. |
| M14-F11 | MEDIUM | `local-generator.ts` and `generator.ts` are near-identical copies of `generateSingleEvent`, `printGenerateSummary` and `validateGeneratedEvents`; a fix in one silently misses the other. | `lib/aaradhane/local-generator.ts:77-132` vs `lib/aaradhane/generator.ts:183-258`; `:134` vs `:370`; `:170` vs `:407` | Extract the pure core and let both entry points call it; the only real difference is the Firestore source. |
| M14-F12 | MEDIUM | The Guru dataset exists three times — `data/aaradhane/gurus.ts`, `data/aaradhane/aaradhanaes.json`, Firestore `guruParampara/aaradhanaes` — with no sync check. The lunar enums are also declared twice. | `data/aaradhane/gurus.ts:11-26` duplicates `types/aaradhane-generator.ts:10-25`; JSON copy has `totalCount: 19` matching the 19 TS records today | Make the JSON the single source and derive the TS constant, or add a test asserting the three agree. |
| M14-F13 | MEDIUM | Service-account JSON is written to the workspace as `firebase-admin-key.json` and never removed, and the `export GOOGLE_APPLICATION_CREDENTIALS` in that step does not survive to later steps (the live step re-declares it as a step `env` at `:247`, so the practical damage is the leftover key file, not a broken run). | `.github/workflows/aaradhane.yml:232-233`, `:247` | Use a temp path outside the checkout plus an `always()` cleanup step. |
| M14-F14 | MEDIUM | `.github/workflows/aaradhane.yml` embeds 130 lines of Python that re-implement `scripts/panchanga.py` and depend on `from panchanga import compute, Location` resolving to the script's own imports. Any change to `panchanga.py` silently desynchronises the workflow. | `.github/workflows/aaradhane.yml:94-218` vs `scripts/panchanga.py:36-108` | Call `python scripts/panchanga.py --year $TARGET_YEAR` instead. |
| M14-F15 | MEDIUM | `lib/reports/report-saver.ts` calls `fetch('/api/reports/save')` with a relative URL from Node/Playwright, where relative URLs are invalid — so every export path in the file throws at the first save. No production code imports it; the only importer is a Playwright spec, which therefore exercises a code path that cannot work. | `lib/reports/report-saver.ts:33`; sole importer `tests/reports/save-reports.spec.ts:18` | Take a base URL parameter as `scripts/save-report.ts:26` does, or delete the file and the spec together. |
| M14-F16 | MEDIUM | `scripts/generate-proof-report.ts` defaults to a dead third-party sandbox host; `scripts/save-report.ts` hardcodes `localhost:3000`. | `scripts/generate-proof-report.ts:28`, `scripts/save-report.ts:26` | Require the env var and fail fast when it is absent. |
| M14-F17 | MEDIUM | The proof report launches five separate Chromium instances for one run (crawler, screenshots, a11y, SEO, PDF), each also opening its own pages. Slow and memory-hungry; a11y/SEO barely need a browser. | `chromium.launch` at `accessibility.service.ts:11`, `crawler.service.ts:19`, `pdf-generator.service.ts:11`, `screenshot.service.ts:20`, `seo.service.ts:11`; all five started at `proof-report.service.ts:74-78` | Share one `Browser` through the orchestrator. |
| M14-F18 | MEDIUM | Proof-report crawling is a hardcoded list of **17** routes while the repo has 47 non-admin `page.tsx` files, so most of the public site is never audited — and the comment at `:66` claims the routes are "discovered from the app directory structure". | `services/proof-report/crawler.service.ts:66` (the comment), `:67-85` (the 17 literals); `find app -name page.tsx \| grep -v /admin/ \| wc -l` = 47 | Enumerate `app/**/page.tsx` at runtime, or read the sitemap. |
| M14-F19 | MEDIUM | AGENTS.md forbids `any`, but the module uses it freely, including in the summary maths and every PDF drawing helper. | `services/daily-spiritual.service.ts:74`; `services/aaradhane.service.ts:32,50,77`; `services/proof-report/proof-report.service.ts:204-211`; `lib/receipt/pdf.ts:54,58,68,92,113,138,154`; `lib/aaradhane/firestore-rest.ts:11,81` | Type the Firestore snapshots and pdf-lib `PDFPage`. |
| M14-F20 | MEDIUM | `data/panchanga` ships 3.1 MB / 730 JSON files inside the repo that no runtime code reads — only build-time scripts. They are still part of every clone, checkout and Vercel build context. | `lib/aaradhane/panchanga.ts:65` is the only reader; site reads `public/data/panchanga/current.json` | Move to a release artifact or a Firestore/Supabase table, or at least exclude from the deploy bundle. |
| M14-F21 | MEDIUM | Docs promise commands that do not exist or do not work: `npm run export:aaradhane` is absent from `package.json`; `python scripts/generate_panchanga.py` is repeatedly cited as the way to generate a year, but it has no `--year` flag. | `AARADHANE_QUICKREF.md:13`, `AARADHANE_GENERATOR.md:59`; error text at `lib/aaradhane/panchanga.ts:70` and `scripts/generate-aaradhane.ts:97`; `package.json` scripts list | Fix the error strings to `python scripts/panchanga.py --year N` and either add `export:aaradhane` (wrapping `scripts/export-events.ts`) or drop the mention. |
| M14-F22 | MEDIUM | Two overlapping Aaradhane operator guides (`AARADHANE_GENERATOR.md` 251 lines at the repo root vs `docs/AARADHANE_GENERATOR.md` 376 lines) with different section sets and different command sets. | headings differ throughout; root doc has "Option B: Export to JSON", the docs/ copy does not | Keep the `docs/` copy, delete the root one (AGENTS.md makes `docs/` authoritative). |
| M14-F23 | MEDIUM | `reports/generate_lint_reports.py` is unrunnable: absolute `/workspace/project/Rayaramathaynk/...` paths from a foreign sandbox, plus an undeclared `openpyxl` dependency. The reports it produced are frozen at 2026-07-13, two months stale as of 2026-09-19. | `reports/generate_lint_reports.py:16`; `reports/lint_results.json` `timestamp: 2026-07-13T07:20:32` | Parameterise the paths, or delete the script and keep the outputs as history. |
| M14-F24 | LOW | `formatPdfAmount` is defined twice with identical bodies and both are exported. | `lib/receipt/pdf.ts:197` and `lib/receipt/upi.ts:35` | Keep the `upi.ts` one; re-export from `pdf.ts`. |
| M14-F25 | LOW | `lib/panchanga-cache.ts` is named a cache but caches nothing — it returns em dashes. `getPanchangaWithFallback` has no caller. | `lib/panchanga-cache.ts:11-21`, `:23`; only importer is `lib/ai/retrieval/panchanga.ts:6` | Rename to `panchanga-placeholder.ts` or fold into the AI retrieval module. |
| M14-F26 | LOW | `lib/date.ts` `formatEventDate` is dead — zero importers — and duplicates formatting that exists in `lib/aaradhane/panchanga.ts:214` and `lib/receipt/pdf.ts:62`. | import-graph: `lib/date.ts <-` (empty) | Delete, or make it the single date formatter. |
| M14-F27 | LOW | `types/daily-spiritual.ts` declares `PanchangaSummary`, `PrasadaInfo` and `DEFAULT_PRASADA`, none of which the daily-spiritual service ever produces — so the "daily spiritual" API deliberately named after panchanga returns no panchanga. | `types/daily-spiritual.ts:28,58,150` vs `services/daily-spiritual.service.ts:434-441` | Either populate them from `current.json` server-side (which would also fix the client-side fetch in the home page) or remove them. |
| M14-F28 | LOW | `services/aaradhane.service.ts` reads and deletes across three collection names (`aaradhane`, `aaradhanes`, `events`) with silent per-collection try/catch — data can exist in any of them and a delete may no-op. | `services/aaradhane.service.ts:16-18`, `:164-186`, `:244-270` | Pick one collection, migrate, remove the fallbacks. |
| M14-F29 | LOW | Real contact details and a live UPI VPA are hardcoded in source: `9886364462@ptsbi`, `ngowda759@gmail.com`, `+91 9886364462`. Changing the temple's UPI id requires a code deploy. | `lib/receipt/upi.ts:1-2`, `lib/receipt/pdf.ts:23`, `app/api/admin/receipts/[id]/pdf/route.ts:16-22` | Move to the `settings` doc that the PDF route already reads. |
| M14-F30 | LOW | Firestore project id hardcoded in a dead REST client: `sri-raghavendra-mutt`. | `lib/aaradhane/firestore-rest.ts:6` | Delete with F10. |
| M14-F31 | LOW | `findDatesForLunarDate` iterates the whole 365-entry map per Guru (19 × 365 scans per run). The multi-day date add (`new Date(iso)` → `setDate(getDate()+i)` → `toISOString().slice(0,10)`) is **correct under `TZ=Asia/Kolkata`**, which `scripts/generate-aaradhane.ts:27` pins; it silently duplicates or skips a day only if the process TZ observes DST (verified: TZ=America/New_York turns `2026-03-07 +3d` into `03-07, 03-08, 03-08`). A latent trap for any caller that does not pin the TZ. | `lib/aaradhane/panchanga.ts:124`, `:171-175`; TZ pinned at `scripts/generate-aaradhane.ts:27` | Index the map by `masa\|paksha\|tithi`; add days on the date parts, not through the local clock. |
| M14-F32 | **HIGH** | Adhik (leap) masa is parsed (`is_adhik`) but never read when matching, and the match returns `matchingDates.slice(0,1)` — the *earliest* date, which in an adhik year is the leap month. This is not hypothetical: `data/panchanga/2026` contains 30 adhik Jyeṣṭha days (2026-05-17 → 06-15) followed by the nija Jyeṣṭha (06-16 → 07-14), and three Gurus sit in Jyeṣṭha (`gurus.ts:115,271,331`) — including Sri Raghavendra Swamy himself (Jyeṣṭha Shukla Ekadashi, `gurus.ts:331-333`). Replaying the match over the committed 2026 data yields 2026-05-26 (adhik) instead of 2026-06-25 (nija): the Matha's single most important Aaradhane, 30 days early. 2027 has no adhik masa, so the bug is dormant this year and returns whenever one does. | `lib/aaradhane/panchanga.ts:36` declares `is_adhik`; `findDatesForLunarDate` (`:115-183`) never reads it; `:182` `slice(0,1)`; adhik run counted by script over `data/panchanga/2026` | Filter on `is_adhik === false` (nija masa) unless a Guru record opts into adhik, and add a regression test over the 2026 data. |
| M14-F33 | LOW | Validation failures in the generator are printed as warnings and the run proceeds to write Firestore. | `scripts/generate-aaradhane.ts:204-211` then `:228` | Exit non-zero on validation errors unless `--force`. |
| M14-F34 | LOW | `types/festival.ts` mixes presentation into a types module: `getSeasonColor` returns Tailwind gradient class names. | `types/festival.ts:149-164` | Move to `lib/festival-utils.ts` or a UI helper. |
| M14-F35 | LOW | Two different `Festival` interfaces (`types/calendar.ts:6` = `{date, festival}`, `types/festival.ts:6` = the rich model) — a constant import-confusion trap. | both files | Rename the calendar one to `CalendarFestivalEntry`. |
| M14-F36 | LOW | Festival enrichment is keyed on exact English strings, so `"Mahanavami & Vijayadashami"` (`data/calendar.ts:41`) matches neither `FESTIVAL_DESCRIPTIONS` entry and falls back to `"Celebration of ..."`. | `lib/festival-utils.ts:110` vs `data/calendar.ts:41`; `"Varamahalakshmi & Yajur Upakarma"` at `:33` has the same problem | Key on a slug stored in the data, not on the display name. |
| M14-F37 | LOW | The a11y service claims accessibility coverage but implements a handful of heuristics with no axe-core, so a green proof report says little. | `services/proof-report/accessibility.service.ts:1-20` (no axe import), issue union at `types/proof-report.ts:56` | Add `@axe-core/playwright`. |
| M14-F38 | LOW | `services/proof-report/database-export.service.ts` initialises its own Firebase app from `NEXT_PUBLIC_*` env instead of going through the services layer, violating the AGENTS.md "no direct Firebase calls" rule. | `database-export.service.ts:26-31`, `:53`, `:78-84` | Call the existing event/seva/gallery services. |
| M14-F39 | LOW | `link-validator` and `image-validator` fire unbounded concurrent `fetch`es with no retry or rate limit — on a large site this self-DoSes the target. | `link-validator.service.ts:59`, `image-validator.service.ts:41` | Add a concurrency pool. |
| M14-F40 | LOW | `content-quality.service.ts:101 calculateSimilarity` compares page texts pairwise, O(n²) over full visible text. | `services/proof-report/content-quality.service.ts:101` | Hash/shingle the paragraphs instead. |
| M14-F41 | MEDIUM | The temple contact the PDF route carefully loads from the newest `settings` doc never appears on the receipt. `buildReceiptPdf` merges `options.temple` at `:179` but uses it only for the PDF *metadata* title (`:181`); the visible header draws two string literals (`:79-80`) and the footer contact line reads `DEFAULT_TEMPLE` directly (`:171`). Editing the temple's name, address, phone or email in settings changes nothing a devotee can see. | `lib/receipt/pdf.ts:179`, `:181`, `:79-80`, `:171`; loader at `app/api/admin/receipts/[id]/pdf/route.ts:24-43` | Pass `temple` into `drawHeader`/`drawNotes` and delete `DEFAULT_TEMPLE`'s use as a draw source. |
| M14-F42 | LOW | `docs/PANCHANGA.md` documents three daily crons (02:00, 11:00, 14:30 IST = 20:30, 05:30, 09:00 UTC); the workflow actually has four, at 23:30, 21:30, 06:30 and 08:30 UTC. Not one of the three documented times exists in the file. | `docs/PANCHANGA.md:270-273` vs `.github/workflows/panchanga.yml:6-9` | Regenerate the schedule section from the workflow, or drop the times and link the file. |
| M14-F43 | MEDIUM | `truncate` is the receipt PDF's only overflow guard and it does not loop: it removes exactly four characters and appends `"..."` regardless of how far over the width the text is, so a long note still overruns the page. It is applied to the notes field only — seva names, devotee name, email and address are drawn unmeasured. | `lib/receipt/pdf.ts:42-47` (single-shot `safe.length - 4`), sole call site `:166`; unmeasured draws at `:100`, `:106`, `:126` | Loop while `widthOfTextAtSize > maxWidth`, and run every user-supplied string through it. |

## Portability notes (React Native / cross-platform)

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| `lib/receipt/numbering.ts` | none | **reuse as-is** | Pure string/number logic, already unit-tested. |
| `lib/receipt/validation.ts` | none | **reuse as-is** | Pure; already designed to run on both sides. |
| `lib/receipt/upi.ts` | `URLSearchParams` (available in RN/Hermes) | **reuse as-is** | `upi://pay?...` deep links work better on native than on web — `Linking.openURL` instead of a QR. |
| `types/festival.ts` helpers (`calculateCountdown`, `getUpcomingFestivals`, `getFestivalsByMonth`) | none | **reuse as-is** | Pure date maths. Only `getSeasonColor` (Tailwind strings) must be dropped. |
| `types/calendar.ts`, `types/aaradhane*.ts`, `types/daily-spiritual.ts`, `types/proof-report.ts`, `types/report.ts` | `firebase/firestore` `Timestamp` in `types/aaradhane-generator.ts:8` only | **reuse as-is** (one import to isolate) | Plain interfaces. |
| `data/calendar.ts`, `data/aaradhane/gurus.ts` | none | **reuse as-is** | Plain constants; bundle them or fetch them. |
| `lib/festival-utils.ts` | none (imports only the constant + types) | **reuse as-is** | `toLocaleDateString("en-IN")` needs `Intl` — enable `hermes-intl` or ship a polyfill. |
| `lib/panchanga-cache.ts` | none | **reuse as-is** | Trivial. |
| `lib/date.ts` | `firebase/firestore` `Timestamp` | **adapt** | Take a `Date`/epoch instead of a Firestore `Timestamp`. |
| `services/daily-spiritual.service.ts` | Firebase Web SDK (`@/lib/firebase`), `Intl.DateTimeFormat` with `Asia/Kolkata` | **adapt** | Time logic is portable; the Firestore reads should move behind `/api/dashboard/daily-spiritual` so the app just fetches JSON. |
| `services/aaradhane.service.ts` | Firebase Web SDK | **adapt** | Same: consume `/api/admin/aaradhane` + a public read endpoint rather than the SDK. |
| `lib/aaradhane/panchanga.ts` | `fs`, `path`, `process.cwd()` | **rewrite** | Filesystem-bound. On device, either ship a pre-computed year as a bundled asset/SQLite table or expose `GET /api/panchanga/:date`. |
| `lib/aaradhane/generator.ts`, `local-generator.ts` | reach `fs` through `./panchanga`; `generator.ts` also imports `firebase/firestore` | **adapt** | The matching algorithm itself is pure — extract it from the loaders and it runs anywhere. |
| `lib/aaradhane/firestore*.ts` | `firebase-admin`, Node `fetch` with service credentials | **rewrite / server-only** | Admin credentials must never reach a mobile client. |
| `lib/receipt/pdf.ts` | `fs/promises`, `pdf-lib`, `process.cwd()` | **rewrite or keep server-side** | Keep on the server and have the app download the PDF from `/api/admin/receipts/[id]/pdf`. If it must run on device, swap to `react-native-pdf-lib`/`expo-print` and re-implement the layout. |
| `lib/receipt/admin.ts` | `server-only`, `firebase-admin`, transactions | **server-only, never ported** | The atomic counter is the whole point. |
| `lib/reports/report-saver.ts`, `services/proof-report/*`, `scripts/save-report.ts`, `scripts/generate-proof-report.ts` | Playwright, Chromium, `fs`, `child_process` | **not applicable** | Build/QA tooling; never ships in any client. |
| `scripts/panchanga.py`, `generate_panchanga.py`, `reports/generate_lint_reports.py` | CPython + `panchang` + `openpyxl` | **not applicable** | Stays in CI. This is the only non-JavaScript part of the whole product. |
| `public/data/panchanga/current.json` | served as a Next static asset | **adapt** | An RN app can fetch the same URL, but it should go behind a versioned API so a stale CDN copy is detectable. |
| `.github/workflows/*.yml` | GitHub Actions + repo write | **not applicable** | Pipeline. |

**What a React Native client would need from M14:**

1. A panchanga endpoint — `GET /api/panchanga?date=YYYY-MM-DD` returning the file contents (today plus an arbitrary date), replacing the direct `/data/panchanga/current.json` fetch and giving the app an offline-cacheable, versioned payload.
2. A calendar endpoint returning festivals and Ekadashi as data (Firestore-backed, per F01), so the app does not compile a copy of `data/calendar.ts` that can never be corrected without a store release.
3. Aaradhane events already arrive as ordinary `events` documents — no new work; the generator stays a server job.
4. The pure packages — `lib/receipt/{numbering,validation,upi}.ts`, `types/festival.ts` helpers, `lib/festival-utils.ts` and the lunar-matching core of the Aaradhane generator — should be hoisted into a shared workspace package (`packages/domain`) that both the Next app and the RN app import; they have zero platform dependencies today and that should be enforced by lint.
5. Receipts: expose `GET /api/receipts/[id]/pdf` with a signed URL. The device downloads and shares the PDF; it never renders one and never sees a service account.
6. The proof-report and lint tooling stays entirely on CI and is irrelevant to the client.

## Coverage

filesExpected 62, filesMentioned 62, omitted: none.

Read fully: all TypeScript under `lib/receipt`, `lib/aaradhane`, `lib/panchanga-cache.ts`,
`lib/festival-utils.ts`, `lib/date.ts`, `data/calendar.ts`, all four owned `types/*` panchanga/aaradhane
files, both Python panchanga scripts, both workflows, `services/daily-spiritual.service.ts`,
`services/proof-report/proof-report.service.ts`, `lib/reports/report-saver.ts`,
`scripts/generate-aaradhane.ts`, `scripts/generate-proof-report.ts`.
Read by structure (exports, class shape, key lines): `services/aaradhane.service.ts`,
`lib/aaradhane/firestore.ts`, `lib/aaradhane/firestore-admin.ts`, `services/proof-report/*` (12 remaining),
`types/proof-report.ts`, `scripts/save-report.ts`, `reports/generate_lint_reports.py`, `data/aaradhane/gurus.ts`.
Sampled, per the no-bulk rule: 1 of the 730 files in `data/panchanga` (`2026/2026-01-01.json`), plus
`public/data/panchanga/current.json`; the rest counted by script (365 + 365, 3.1 MB, range 2026-01-01
to 2027-12-31). `data/aaradhane/aaradhanaes.json` read by key/count only.
Reports read by headings and JSON summary fields only, not line by line: `reports/LintReport.md`,
`reports/LintExecutiveSummary.md`, `reports/TESTING_SUMMARY.md`, `reports/SPRINT2_TESTING_SUMMARY.md`,
`reports/SPRINT3_TESTING_SUMMARY.md`, `reports/SPRINT4_TESTING_SUMMARY.md`,
`reports/SPRINT5_TESTING_SUMMARY.md`, `reports/lint_results.json`, `reports/test_results.json`. `reports/*.xlsx` and `reports/lint-output.txt` were not
opened (binary/bulk; the xlsx files are outside the inventory anyway).

## UNCLEAR

- UNCLEAR: whether Firestore `guruParampara/aaradhanaes` is actually populated in the live project. The CLI defaults to the local file (`scripts/generate-aaradhane.ts:164-191`) and only `--firestore` reads Firestore; no read-only check was possible under this run's no-network rule. Settled by `npm run generate:aaradhane -- --check`.
- UNCLEAR: whether the 2026 and 2027 Aaradhane events currently in Firestore were produced by this generator or hand-entered. `autoGenerated: true` on the `events` docs would settle it (`lib/aaradhane/firestore-admin.ts:30-36`).
- UNCLEAR: whether `.github/workflows/panchanga.yml` has ever run successfully — the four crons and the sparse checkout look right, but `public/data/panchanga/current.json` is dated `2026-09-18`, one day before today, which is consistent with a working job but also with a single manual run. The commit history would settle it (this checkout is not a git repository, so it could not be checked).
- UNCLEAR: whether `lib/receipt/pdf.ts` currently produces a usable PDF at all, given F07. Without `node_modules` no run was possible; generating one receipt PDF in a dev environment would settle it.
- UNCLEAR: which of the two "Panchanga engines" the temple treats as authoritative when today's entry in the committed `data/panchanga/2026/` set and `public/data/panchanga/current.json` disagree (they are produced by the same code but at different times and the 730-file set is never regenerated). Spot-checking `data/panchanga/2026/2026-09-18.json` against `current.json` would settle it — not done here because the sample budget for that directory was spent.

## Verification log (2026-09-19)

Skeptic pass over the builder's file: 259 distinct path / `path:line` citations extracted and checked
(0 broken, 0 line numbers past end of file — the five "missing" hits are the globs
`tests/unit/receipt-{...}`, `types/aaradhane*.ts`, `lib/aaradhane/firestore*.ts`, the prospective
`data/panchanga/2028/*.json` and the proposed `packages/domain`, all intentional). 32 factual claims
re-derived from the code; 40 findings re-opened at their cited evidence. Every change below.

- Crawler route count said 21 -> says 17, and the evidence line moved from `:65-85`/`:66` to `:66` (comment) + `:67-85` (the literals) -> `services/proof-report/crawler.service.ts:67-85` lists 17 entries: `''`, `/aaradhane`, `/about`, `/donation`, `/events`, `/facilities`, `/future-plans`, `/gallery`, `/guruparampara`, `/pooja`, `/sevas`, `/shlokas`, `/testimonials`, `/trust`, `/calendar`, `/calendar/ekadashi`, `/calendar/festivals`. Fixed in the component tree, Flow D step 3, the key-files row and **M14-F18**.
- **M14-F18** had no measure of what is missed -> now carries it -> `find app -name page.tsx | grep -v /admin/ | wc -l` = 47 non-admin pages against 17 crawled.
- **M14-F32** severity LOW -> **HIGH**, with a replay instead of a hypothetical -> `data/panchanga/2026` holds 30 adhik Jyeṣṭha days (2026-05-17 -> 06-15) before the nija Jyeṣṭha (06-16 -> 07-14); `data/aaradhane/gurus.ts:115,271,331` put three Gurus in Jyeṣṭha, one of them Sri Raghavendra Swamy (Shukla, tithi 11, `:331-333`); replaying `findDatesForLunarDate`'s own predicate over the committed 2026 files returns `2026-05-26` (adhik), `2026-05-27` (adhik), `2026-06-25` (nija), and `:182 slice(0,1)` takes the first — 30 days early on the Matha's principal Aaradhane. 2027 has zero adhik days, so it is dormant this year.
- **M14-F31** claimed the multi-day date add "can shift a day" on IST dates -> now states it is correct under the pinned TZ and breaks only under DST -> executed both: `TZ=Asia/Kolkata` gives `2026-06-25, 06-26, 06-27` and `2026-12-31, 2027-01-01, 01-02`; `TZ=America/New_York` gives `2026-03-07, 03-08, 03-08`. `scripts/generate-aaradhane.ts:27` pins `Asia/Kolkata`, which has no DST, so the only live callers are safe.
- **M14-F15** and the key-files row called `lib/reports/report-saver.ts` dead with "no importer" -> now "no production importer; sole importer `tests/reports/save-reports.spec.ts:18`" -> `grep -rn "report-saver"` returns that one line. The relative-`fetch` half stands at `:33`.
- **M14-F19** and the `services/daily-spiritual.service.ts` key-files row cited `any` at `:74,204` -> `:74` only -> `grep -n "any" services/daily-spiritual.service.ts` returns exactly one line, 74.
- **M14-F17** evidence `{...}.service.ts:11-19` did not cover all five -> replaced with the per-file lines -> `chromium.launch` at accessibility `:11`, crawler `:19`, pdf-generator `:11`, screenshot `:20`, seo `:11`, all started at `proof-report.service.ts:74-78`.
- **M14-F13** implied the run breaks without the export -> now notes the live step re-declares the variable -> `.github/workflows/aaradhane.yml:247` sets `GOOGLE_APPLICATION_CREDENTIALS` as step env; the leftover `firebase-admin-key.json` (`:232`) is the real residue.
- **M14-F01** had writer/reader evidence but no proof of the gap -> now records that nothing reads the docs at all -> `grep -rn "festivalCalendar\|ekadashiCalendar"` over `*.ts`/`*.tsx` returns the two writer pages and one unrelated i18n key in `lib/i18n/dictionaries.ts:115`.
- **M14-F07** did not say whether the broken logo path is actually reached -> now says it always is -> `public/images/logos/ynk_matha_logo.png` exists, and it is the third candidate in `lib/receipt/pdf.ts:203-208`.
- "Answers questions about" promised the panchanga day file's exact field names, which appeared nowhere -> a full schema block now follows Flow A -> derived from `data/panchanga/2026/2026-06-15.json` (2nd of the 3 permitted samples) and `scripts/panchanga.py:39-108`; it also records that `samvat`, `weekday`, `location`, `metadata`, `durmuhurta`, `varjyam` and `amrita_kalam` have no reader.
- `docs/PANCHANGA.md`, one of the chunk's two graded docs, was never mentioned -> a paragraph now grades it under Code roots -> 427 lines; layout `:17-36`, coordinates `:40-49` and schema `:63-237` match the code; "API Endpoints" `:53-61` documents a static asset, and no `app/api/**/panchanga` route exists (`find app/api -ipath "*panchanga*"` is empty).
- Flow C step 1 named the UPI URL builder but not where the QR is drawn -> now cites it -> `app/admin/receipts/create/page.tsx:99` builds the link, `:108-109` dynamically imports `qrcode` and calls `toDataURL`, `:270` renders the `<img>`.
- Added **M14-F41** (MEDIUM): the `settings`-driven temple contact never reaches the page -> `lib/receipt/pdf.ts:179` merges `options.temple`, `:181` is its only use; header literals at `:79-80`, footer `DEFAULT_TEMPLE` at `:171`; loader at `app/api/admin/receipts/[id]/pdf/route.ts:24-43`.
- Added **M14-F42** (LOW): documented vs actual panchanga cron schedule -> `docs/PANCHANGA.md:270-273` (three crons) vs `.github/workflows/panchanga.yml:6-9` (four, none matching).
- Added **M14-F43** (MEDIUM): `truncate` removes exactly four characters once -> `lib/receipt/pdf.ts:42-47`, sole call site `:166`; devotee name `:100`, email `:106` and seva names `:126` are drawn unmeasured.

Re-derived and left unchanged because they held (spot list): receipt numbering transaction
(`lib/receipt/admin.ts:45-58` + `numbering.ts:8,29`), server-side re-pricing (`admin.ts:79-111`),
the `+15` Krishna tithi rule (`lib/aaradhane/panchanga.ts:151-155`), the workflow gating bug
(`aaradhane.yml:84-85` vs `:238`/`:244`), the send-receipt stub (one-line file) with
`lib/services/email.ts:3` / `whatsapp.ts:2` importing `buildReceiptPdf` and no caller of either,
the three dead modules (`lib/aaradhane/firestore.ts`, `firestore-rest.ts`, `lib/date.ts` — zero
importers repo-wide), `data/calendar.ts` counts (19 Ekadashi, 24 festivals, last 2027-03-22),
the verbatim enum duplication (`gurus.ts:11-26` vs `types/aaradhane-generator.ts:10-25`),
`export:aaradhane` absent from `package.json`, `generate_panchanga.py` having no `--year`,
and the 468-day panchanga runway (2026-09-19 -> 2027-12-31, computed).

Still UNCLEAR after this pass: all five of the builder's items stand — none could be closed without
running code, the network or git. The 2028 gap (**M14-F03**) and the adhik-masa mis-dating
(**M14-F32**) are the two items with a real clock on them.
