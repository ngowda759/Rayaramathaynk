# M03 - Public site: devotional content, bookings, donations and member pages
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs; refreshed 2026-10-18 against HEAD `424fdb8` (see Refresh log). Verify against the code before acting on any claim.

## Answers questions about

- How does seva booking work end to end - browse, select, book, pay, receipt?
- Where is the payment gateway? (there isn't one - it is self-attested UPI)
- How does the donation form work, what does it validate, and where does the donation go?
- Why do `/donation/success` and `/donation/failure` never appear?
- Where does a devotee find their receipt, and who else can see it?
- What can a signed-in devotee do - profile, settings, preferences, favorites?
- How are the profile pages auth-gated? (client-side `isAuthenticated` check only)
- Where do quotes on `/quotes` come from? (hardcoded array, **not** `quote.service.ts`)
- What does the 1040-line `services/quote.service.ts` actually serve?
- Where do shlokas and stotras come from, and why does `/shlokas` go blank at 11 PM?
- What drives the public calendar (`/calendar`, `/calendar/ekadashi`, `/calendar/festivals`)?
- How is the Knowledge Centre built - server or client, and where does the HTML come from?
- What is `/temple-explorer` and where does its data live? (Supabase `temple_areas`)
- What is `/display` for? (unauthenticated lobby digital-signage screen)
- What is `/qr` and how are the QR images produced?
- What is at `/ai` and where does the Raya AI engine actually live? (M08 - boundary here)
- Which files in this module are dead code?
- Which pages are reachable only by typing the URL?
- Which pieces would break in React Native and what a mobile client would need instead.
- Does the Temple Explorer show accessibility information, and where does it come from? (it renders a block for `area.accessibility`, but no Supabase column feeds it - M03-F35)
- Does the Expo app in `apps/mobile` use any of this module? (no code and no API route - it reads the Supabase `sevas` and `daily_poojas` tables directly; see Portability notes)
- Why do several files in this module start with `/* eslint-disable */`? (CI baseline commit `6408c1d` - M03-F36)

## Purpose and business role

This module is the devotee-facing half of the temple portal: everything a visitor or a
signed-in devotee uses to *consume* devotional content and to *transact* with the temple.
It covers four groups.

1. **Transactions.** Seva browsing and booking (`/sevas`, `/pooja`), e-donations (`/donation`)
   and receipt lookup (`/receipts`). Both money flows are "manual UPI": the site records an
   intent in Firestore, shows the temple's UPI id, and the devotee types back a transaction
   reference that the app trusts. No gateway, no webhook, no server-side verification.
2. **Devotional content.** Shlokas, stotras, quotes, aaradhane (guru aradhana services),
   the Knowledge Centre and the temple calendar. Sources are inconsistent: a static TS file
   for shlokas and the calendar, hardcoded arrays inside the page for quotes and stotras,
   Firestore for aaradhane and knowledge articles.
3. **Member pages.** Profile, account settings, preferences (language/theme/timezone/
   notification/device toggles) and favorites, all on top of `ProfileContext` ->
   `profile.service.ts` -> Firestore `profiles` and `bookmarks`.
4. **Ancillary screens.** Temple Explorer (virtual tour, Supabase-backed), `/display`
   (a kiosk/signage board meant to run on a TV in the temple), `/qr` (printable QR codes)
   and `/ai/analytics` (a public read-out of the Raya AI dashboard).

## Code roots

```
app/(public)/sevas          app/(public)/pooja            app/(public)/donation
app/(public)/receipts       app/(public)/aaradhane        app/(public)/quotes
app/(public)/shlokas        app/(public)/stotras          app/(public)/qr
app/(public)/favorites      app/(public)/profile          app/(public)/display
app/(public)/temple-explorer                              app/(public)/ai
app/calendar                app/knowledge
components/temple-explorer  components/calendar           components/knowledge
services/seva.service.ts            services/sevaBooking.service.ts
services/pooja.service.ts           services/donation.service.ts
services/donationCampaign.service.ts services/quote.service.ts
services/profile.service.ts         services/temple-areas.service.ts
services/temple-areas.supabase.service.ts
hooks/useDonationNotifications.ts
lib/sevas.ts  lib/options.ts
data/sevas.ts data/poojas.ts data/shlokas.ts data/timings.ts
```

No files were adopted from the Unassigned list - none of the 11 unassigned files
(`.claude/state/inventory/SUMMARY.md:27`) belong to this module.

## Entry points

`app/(public)/*` sits under `app/(public)/layout.tsx` (PageViewTracker + `<main id="main-content">`
+ GoUpButton). `app/calendar/*` and `app/knowledge/*` are **outside** that group, so they get
neither the page-view tracker nor the go-up button.

| Route | File | server/client | auth required | What it renders / does |
|---|---|---|---|---|
| `/sevas` | `app/(public)/sevas/page.tsx` | server | no (booking needs login) | Navbar + `SevaBooking` (M05) |
| `/pooja` | `app/(public)/pooja/page.tsx` | server | no | `TempleTimings` + `DonationCTA` (M05) |
| `/donation` | `app/(public)/donation/page.tsx` | server | no | Hero + `DonationForm` (M05) |
| `/donation/success` | `app/(public)/donation/success/page.tsx` | server | no | Static thank-you. **Orphan - nothing links here** |
| `/donation/failure` | `app/(public)/donation/failure/page.tsx` | server | no | Static failure. **Orphan** |
| `/receipts` | `app/(public)/receipts/page.tsx` | client | **no** | Two tabs: search receipts via `/api/public/receipts`, or create a booking |
| `/aaradhane` | `app/(public)/aaradhane/page.tsx` | client | no | Countdown + upcoming/past aaradhane from Firestore |
| `/quotes` | `app/(public)/quotes/page.tsx` | client | no | Quote archive from a **hardcoded array** |
| `/shlokas` | `app/(public)/shlokas/page.tsx` | client | no | Accordion over `data/shlokas.ts`; blocked after 23:00 |
| `/stotras` | `app/(public)/stotras/page.tsx` | client | no | Stotra library from a **hardcoded array** |
| `/qr` | `app/(public)/qr/page.tsx` | client | no | Two generated QR cards + download/print/share |
| `/favorites` | `app/(public)/favorites/page.tsx` | client | yes (client check) | Bookmarks from `ProfileContext.getBookmarks()` |
| `/profile` | `app/(public)/profile/page.tsx` | client | yes (client check) | Profile header, counters, notification summary |
| `/profile/settings` | `app/(public)/profile/settings/page.tsx` | client | yes (client check) | Edit name/phone/bio/gotra/nakshatra + photo |
| `/profile/preferences` | `app/(public)/profile/preferences/page.tsx` | client | yes (client check) | Language, theme, timezone, 7 notification + 4 device toggles |
| `/display` | `app/(public)/display/page.tsx` | client | **no** | Kiosk signage: clock, panchanga, announcements, quote, gallery slideshow |
| `/temple-explorer` | `app/(public)/temple-explorer/page.tsx` | server | no | Hero + `TempleExplorer` (client) |
| `/ai/analytics` | `app/(public)/ai/analytics/page.tsx` | client | **no** | Public read-out of `/api/ai/analytics` + `/api/public/stats` |
| `/calendar` | `app/calendar/page.tsx` | server | no | Two cards -> ekadashi / festivals, counts from `data/calendar.ts` |
| `/calendar/ekadashi` | `app/calendar/ekadashi/page.tsx` | client | no | Search + `NextEkadashiCard` + `EkadashiTable` + `window.print()` |
| `/calendar/festivals` | `app/calendar/festivals/page.tsx` | client | no | `FestivalExperience` (M05/M06) over `lib/festival-utils` |
| `/knowledge` | `app/knowledge/page.tsx` | server (`revalidate = 3600`) | no | `KnowledgeCentreClient` with server-fetched data |
| `/knowledge/[category]` | `app/knowledge/[category]/page.tsx` | server | no | `KnowledgeCategoryClient`; 404 on unknown slug |
| `/knowledge/article/[slug]` | `app/knowledge/article/[slug]/page.tsx` | server | no | `KnowledgeArticleClient`; `generateMetadata` from the article |

There is **no** `app/(public)/ai/page.tsx` - `/ai` itself 404s. Only `/ai/analytics` exists.
The Raya AI chat engine, its API routes and its widget belong to **M08**; this module only
consumes `/api/ai/analytics` from the browser.

## Component trees

### Seva booking (`/sevas`, and the "Create New Receipt" tab of `/receipts`)

```
SevasPage (server) app/(public)/sevas/page.tsx
├─ Navbar (client) components/layout/Navbar.tsx            [M05]
├─ Breadcrumb (server) components/calendar/Breadcrumb.tsx
├─ SectionHeading (server) components/common/SectionHeading.tsx [M05]
├─ SevaBooking (client) components/home/SevaBooking.tsx     [M05 - owns the form]
│   ├─ hooks: useAuth (M04), useFinanceSettings (M07), 20+ useState
│   ├─ sevaService.getAllSevas()      services/seva.service.ts:9
│   │     -> getAllSevasAction()      app/actions/sevas.ts:4  -> Supabase `sevas`
│   │     -> fallback Firestore `sevas`
│   ├─ sevaBookingService.createBooking()  services/sevaBooking.service.ts:34 -> Firestore `sevaBookings`
│   ├─ sevaBookingService.updatePayment()  services/sevaBooking.service.ts:81
│   └─ SevaReceipt (client) components/home/SevaReceipt.tsx  [M05]
└─ Footer (client) components/layout/Footer.tsx             [M05]
```

### Donation (`/donation`)

```
DonationPage (server) app/(public)/donation/page.tsx
├─ Navbar (client) / Breadcrumb (server)
├─ DonationForm (client) components/home/DonationForm.tsx   [M05 - owns the form]
│   ├─ useFinanceSettings() (M07) -> upiEnabled, upiDetails, bankDetails, specialSevas
│   ├─ hand-rolled validation: DonationForm.tsx:83 (name, email, phone, amount truthy only)
│   ├─ donationService.createDonation()  services/donation.service.ts:37 -> Firestore `donations`
│   └─ in-page payment dialog (UPI deep link `upi://pay?...` DonationForm.tsx:68)
└─ Footer (client)
```

### Receipts (`/receipts`)

```
PublicReceiptsPage (client) app/(public)/receipts/page.tsx
├─ tab "search"
│   ├─ Input / Button (client) components/ui/*               [M05]
│   ├─ handleSearch() receipts/page.tsx:38 -> GET /api/public/receipts?search=...
│   │       -> app/api/public/receipts/route.ts:20 admin Firestore, `sevaBookings`, substring match
│   └─ SevaReceipt (client) components/home/SevaReceipt.tsx  [M05] - modal
└─ tab "create" -> SevaBooking (client)  [same tree as /sevas]
```

### Member pages (`/profile`, `/profile/settings`, `/profile/preferences`, `/favorites`)

All four are client components sharing one data spine:

```
<page> (client)
├─ useProfile()      context/ProfileContext.tsx            [M04]
│    └─ profileService.*  services/profile.service.ts
│         ├─ Firestore `profiles/{uid}`  (get/save/update/preferences/favorites/recentlyViewed)
│         ├─ Firestore `bookmarks`        (add/remove/get, filtered by uid)
│         └─ Firebase Storage `profiles/{uid}/{timestamp}.{ext}`  profile.service.ts:196,216
├─ useAuthContext()  context/AuthContext.tsx               [M04]
└─ guard: early return of a sign-in card (client-only; `proxy.ts` does not gate these routes).
     `/profile`, `/profile/settings`, `/profile/preferences` test `!isAuthenticated`
     (`profile/page.tsx:23`, `settings/page.tsx:33`, `preferences/page.tsx:38`);
     `/favorites` tests `!user` from `useAuthContext` instead (`favorites/page.tsx:108`)
```

- `ProfilePage` -> `LanguageSwitcher` (M05), `next/image`, seven hardcoded notification rows (`profile/page.tsx:256`).
- `ProfileSettingsPage` -> uncontrolled file input -> `uploadProfileImage(file)`; 5 MB client check at `profile/settings/page.tsx:75`.
- `ProfilePreferencesPage` -> `THEMES` / `TIMEZONES` from `types/profile`, toggle buttons with `role="switch"`.
- `FavoritesPage` -> `getBookmarks()` -> `CardSkeleton` (M05) -> `next/image` cards.

### Public calendar

```
TempleCalendarPage (server) app/calendar/page.tsx
├─ data/calendar.ts  (static: year 2026, "Sri Parabhava", 19 ekadashi + 24 festivals)
└─ two next/link cards -> /calendar/ekadashi, /calendar/festivals

EkadashiPage (client) app/calendar/ekadashi/page.tsx
├─ CalendarHero (server) components/calendar/CalendarHero.tsx
├─ Breadcrumb (server)
├─ NextEkadashiCard (client) components/calendar/NextEkadashiCard.tsx  -> data/calendar.ts
├─ CalendarSearch (client) components/calendar/CalendarSearch.tsx      [controlled input]
├─ "Print Schedule" button -> window.print()  ekadashi/page.tsx:41
└─ EkadashiTable (client) components/calendar/EkadashiTable.tsx        -> data/calendar.ts

FestivalsPage (client) app/calendar/festivals/page.tsx
├─ CalendarHero / Breadcrumb
└─ FestivalExperience (client) components/festival/FestivalExperience.tsx  [M05/M06]
       (NOTE: components/calendar/FestivalTable.tsx is the older widget and is now dead)
```

`components/calendar/CalendarCenter.tsx` (262 lines, countdown + two cards) is imported by
nobody - dead.

### Knowledge Centre

```
KnowledgeCentrePage (server, revalidate 3600) app/knowledge/page.tsx
├─ knowledgeService.getKnowledgeCentreData()     [M09]
└─ KnowledgeCentreClient (client) components/knowledge/KnowledgeCentreClient.tsx
    ├─ localStorage bookmarks + recently-viewed (KnowledgeCentreClient.tsx:40,106)
    ├─ debounced search -> GET /api/knowledge/search?q=  (:96)
    ├─ navigator.share / clipboard (:155,162), window.print() (:168)
    └─ framer-motion sections, next/link to /knowledge/<slug>

CategoryPage (server) app/knowledge/[category]/page.tsx
└─ KnowledgeCategoryClient (client)  - sidebar of other categories + article cards

ArticlePage (server) app/knowledge/article/[slug]/page.tsx
└─ KnowledgeArticleClient (client)
    ├─ localStorage bookmarks + language toggle en/kn (:42,55)
    └─ dangerouslySetInnerHTML={{ __html: formatContent(content) }}  (:267, formatter at :339)
```

Neither `[category]` nor `article/[slug]` renders Navbar/Footer, unlike `/knowledge`.

### Temple Explorer

```
TempleExplorerPage (server) app/(public)/temple-explorer/page.tsx
└─ TempleExplorer (client) components/temple-explorer/TempleExplorer.tsx
    ├─ fetch('/api/temple-areas')  (:46)
    │    -> app/api/temple-areas/route.ts:6 -> templeAreasService.getPublicAreas()
    │    -> services/temple-areas.service.ts:4 = templeAreasSupabaseService
    │    -> Supabase table `temple_areas`
    ├─ category sidebar (CATEGORY_LABELS from types/temple-explorer)
    ├─ AnimatePresence map panel -> Google Maps <iframe> (:183)
    ├─ AreaCard (client, :306) grid/list
    ├─ AreaDetailPanel (client, :376) desktop panel + mobile modal
    │    └─ "Accessibility Information" block (:461-500) - renders only when `area.accessibility`
    │       is set, which Supabase rows never are (M03-F35); added 2026-10-06 in `11a532f`
    └─ QuickInfoPanel (client, :507) - timings/location/contact from types/temple-explorer constants
```

### Digital signage `/display`

```
DigitalSignagePage (client) app/(public)/display/page.tsx
├─ 8 useEffect hooks; 3 of them own a setInterval:
│     1 s clock (:54), 10 s gallery slideshow (:172), 5 min window.location.reload() (:183)
├─ dailySpiritualService.getDashboardData()   [M05/M14]  -> quote + featured event
├─ settingsService.getSocialLinks()           [M07]      -> YouTube URL
├─ galleryService.getImages()                 [M06]      -> slideshow photos
├─ fetch('/data/panchanga/current.json')  (:121)         -> static panchanga file [M14]
└─ document.documentElement.requestFullscreen() (:203)
```

### QR codes `/qr`

```
QRPage (client) app/(public)/qr/page.tsx
├─ SacredDivider (M05), Navbar, Footer, Breadcrumb
└─ QRCodeCard (client, local, :23) x2
    ├─ useURLQRCodeGenerator(data, size)   lib/device/qr/QRCode.tsx   [M13]
    ├─ useShare()                          lib/device                 [M13]
    ├─ download: document.createElement('a') (:29)
    └─ print: window.open + document.write of an HTML string (:40)
```

### AI analytics `/ai/analytics`

```
PublicAnalyticsPage (client) app/(public)/ai/analytics/page.tsx
├─ local chart primitives: StatCard (:86), PieChart (:105, inline SVG), LineChart (:170), HealthIndicator (:248)
├─ fetch('/api/ai/analytics')   (:294)   [M08 owns the route and the engine]
├─ fetch('/api/public/stats')   (:337)   [M12]
└─ 60 s polling interval (:353)
```

### The remaining devotional and member pages

These five have no sub-components of their own worth a diagram - each is one large client
component - so the tree is the import list plus where the data comes from.

```
AaradhanePage (client) app/(public)/aaradhane/page.tsx
├─ Navbar / Footer (client) [M05]          - no Breadcrumb, no SectionHeading
├─ CountdownTimer (client, local, :57)     - used at :258
├─ aaradhaneService.getAaradhanes() (:129) [M07] -> Firestore, 3 collections (see M03-F30)
└─ framer-motion + next/image + next/link

QuotesPage (client) app/(public)/quotes/page.tsx
├─ (no Navbar, no Footer - M03-F22)
├─ useProfile() [M04] -> FavoriteButton (client) components/common/FavoriteButton.tsx [M05]
└─ SAMPLE_QUOTES const (:29) -> useState (:76); fake 500 ms load (:85); handleExplain stub (:126)

StotrasPage (client) app/(public)/stotras/page.tsx
├─ (no Navbar, no Footer)
├─ useProfile() [M04] -> FavoriteButton [M05], CardSkeleton components/common/SkeletonLoader.tsx [M05]
└─ SAMPLE_STOTRAS const (:40) -> useState (:106); fake 500 ms load (:113)

ShlokasPage (client) app/(public)/shlokas/page.tsx
├─ Navbar / Breadcrumb / SectionHeading / Footer  - the full house chrome
├─ gate: useState(() => new Date().getHours() < 23) (:14-17), early return at :28 (M03-F18)
└─ data/shlokas.ts (static) -> category filter + accordion

FavoritesPage (client) app/(public)/favorites/page.tsx
├─ (no Navbar, no Footer)
├─ useProfile().getBookmarks() [M04] -> profileService -> Firestore `bookmarks`
├─ useAuthContext().user [M04] -> guard at :108
├─ TYPE_CONFIG icon/label/colour map (:41-50) -> filter tabs -> next/image cards
└─ CardSkeleton [M05]; four service imports that are never called (:9-12, M03-F19)
```

## Data flow

### 1. Seva booking + "payment" + receipt

1. `/sevas` renders `SevaBooking` (client).
2. On mount, `sevaService.getAllSevas()` (`services/seva.service.ts:9`) calls the server action
   `getAllSevasAction()` (`app/actions/sevas.ts:4`) which reads Supabase `sevas` with the
   **admin (service-role) client**; on any throw it falls back to Firestore `sevas`
   (`seva.service.ts:30-39`).
3. Devotee picks a seva, fills name/email/phone/gotra/nakshatra/raashi/date/notes.
   `handleSubmitClick()` (`SevaBooking.tsx:127`) requires login, a seva and a date - nothing else.
4. `handleBooking()` (`SevaBooking.tsx:146`) mints a **client-side** reference
   `SVA-${Date.now().toString(36).toUpperCase()}` (`SevaBooking.tsx:152`) and calls
   `sevaBookingService.createBooking()` (`services/sevaBooking.service.ts:34`), which writes a
   Firestore `sevaBookings` doc with `status:"pending"`, `paymentStatus:"pending"`.
   The `SVA-...` reference is **never persisted**.
5. A payment dialog shows the UPI id from `useFinanceSettings()`, falling back to the
   hardcoded `"9886364462@ptsbi"` (`SevaBooking.tsx:114`). `openUPIApp()` only copies the id
   to the clipboard; after a 5 s countdown a "payment reference" input appears.
6. `handleSavePaymentReference()` (`SevaBooking.tsx:181`) calls
   `sevaBookingService.updatePayment()` (`SevaBooking.tsx:190` -> `sevaBooking.service.ts:81`) which sets
   `paymentStatus:"completed"`, `status:"confirmed"`, `paymentDate = now` - **from the browser,
   with no verification of the transaction id**.
7. `SevaReceipt` renders using the in-memory `SVA-...` ref, not the stored doc id.

### 2. Donation

1. `/donation` renders `DonationForm` (client).
2. `handleSubmit()` (`DonationForm.tsx:78`) checks only that `donorName`, `email`, `phone`,
   `amount` are truthy (`:83`). No zod, no react-hook-form, no email/phone/amount format check,
   no upper bound, no server-side validation.
3. `donationService.createDonation()` (`services/donation.service.ts:37`) writes Firestore
   `donations` with `status:"pending"`, `receiptNumber:""`.
4. The `DON-...` reference minted at `DonationForm.tsx:98` is kept in state only.
5. A dialog offers UPI (`upi://pay?pa=...&am=...`, `:68`) or bank details. "Done" just resets
   the form (`:126`). The user is **never** routed to `/donation/success` or `/donation/failure`.
6. An admin later marks the donation received (`updateDonationStatus`, `donation.service.ts:66`,
   M07). `hooks/useDonationNotifications.ts` polls `donations` every 60 s for the admin bell.

### 3. Receipt lookup

1. `/receipts` search tab, `handleSearch()` (`receipts/page.tsx:38`) -> `GET /api/public/receipts?search=<q>`.
2. `app/api/public/receipts/route.ts:19` gets the **admin** Firestore handle, pulls the newest
   1000 `sevaBookings` and substring-matches `userPhone`, `userEmail`, doc id and
   `paymentReference` (`:39-42`), returning up to 20 records with names, emails and phones.
3. Results render as cards; clicking one opens `SevaReceipt` as a modal.

### 4. Preferences update

1. A toggle in `/profile/preferences` calls `updateNotificationPreferences({[key]: !current})`
   (`preferences/page.tsx:83`).
2. `ProfileContext.updateNotificationPreferences` (`context/ProfileContext.tsx:166`) forwards at
   `:171` to `profileService.updatePreferences()` (`services/profile.service.ts:154`) which does a merged
   `updateDoc` on `profiles/{uid}` and bumps `updatedAt`.
3. Context state updates; `toast.error` only on failure (success toasts only for language/
   timezone/theme).

### 5. Temple Explorer load

1. `TempleExplorer` mounts -> `fetch('/api/temple-areas')` (`TempleExplorer.tsx:46`).
2. `app/api/temple-areas/route.ts:6` -> `templeAreasService.getPublicAreas()` ->
   `temple-areas.supabase.service.ts:35` -> anon Supabase client (RLS) on `temple_areas`,
   ordered by `order`.
3. Rows mapped snake_case -> camelCase (`mapToTempleArea`, `:169`). Empty result renders a
   "Coming Soon" panel (`TempleExplorer.tsx:201-209`, heading at `:206`), never the `TEMPLE_AREAS` defaults that
   `temple-areas.supabase.service.ts:4` imports but never uses.
4. `mapToTempleArea` (`temple-areas.supabase.service.ts:169-185`) copies 13 fields and no `accessibility`,
   and the table has no such column in either migration that creates it
   (`supabase/migrations/20240523000000_create_temple_areas.sql:1-16`, `supabase/migrations/20240915_create_temple_areas.sql:1-18`).
   The only accessibility data lives in the `TEMPLE_AREAS` defaults
   (`types/temple-explorer.ts:94,183,207,251` - 4 of the 11 areas), which the running app never reads; only the
   seed scripts do, and the Supabase one now fails on those 4 rows (M03-F38). So the detail panel's accessibility block
   (`TempleExplorer.tsx:461-500`) never renders (M03-F35).

### 6. Knowledge article render

1. `app/knowledge/article/[slug]/page.tsx:32` awaits `knowledgeService.getArticlePageData(slug)`
   on the server; `notFound()` when null.
2. `KnowledgeArticleClient` receives it as a prop, reads language + bookmarks from
   `localStorage`, and injects `formatContent(content)` through `dangerouslySetInnerHTML`
   (`:267`). `formatContent` (`:339`) converts `#`/`-` prefixes to `<h2>`/`<ul>` and wraps the
   rest in `<p>` - **with no escaping of the source text**.

## Key files

| File | Lines | Role | Key exports | Notes |
|---|---|---|---|---|
| `app/(public)/sevas/page.tsx` | 35 | Special sevas landing | `SevasPage` | Server; thin wrapper over `SevaBooking` |
| `app/(public)/pooja/page.tsx` | 31 | Daily pooja schedule | `PoojaPage` | Server; `TempleTimings` + `DonationCTA`; ignores `poojaService` |
| `app/(public)/donation/page.tsx` | 65 | Donation landing | `DonationPage` | Server; inline-style background image |
| `app/(public)/donation/success/page.tsx` | 49 | Thank-you screen | `DonationSuccessPage` | Orphan; claims an emailed receipt that is never sent |
| `app/(public)/donation/failure/page.tsx` | 65 | Failure screen | `DonationFailurePage` | Orphan; hardcoded support email |
| `app/(public)/receipts/page.tsx` | 213 | Receipt search + booking | `PublicReceiptsPage` | Client; local `SevaBookingRecord` interface duplicating `types/seva-booking` |
| `app/(public)/aaradhane/page.tsx` | 578 | Aaradhane services | `AaradhanePage` | Client; local `CountdownTimer` (`:57`), framer-motion, `aaradhaneService` (M07) |
| `app/(public)/quotes/page.tsx` | 359 | Quote archive | `QuotesPage` | Client; `SAMPLE_QUOTES` at `:29`; `handleExplain` is a 1.5 s stub (`:126`) |
| `app/(public)/shlokas/page.tsx` | 195 | Shloka accordion | `ShlokasPage` | Client; time-gated `hour < 23` (`:14`) |
| `app/(public)/stotras/page.tsx` | 400 | Stotra library | `StotrasPage` | Client; `SAMPLE_STOTRAS` at `:40`; fake 500 ms loading (`:113`) |
| `app/(public)/qr/page.tsx` | 270 | Printable QR codes | `QRPage` | Client; hardcoded `SITE_URL` (`:15`); `document.write` print |
| `app/(public)/favorites/page.tsx` | 282 | Saved bookmarks | `FavoritesPage` | Client; imports 4 services it never calls (`:9-12`); file-wide `/* eslint-disable */` at `:1` (M03-F36) |
| `app/(public)/profile/page.tsx` | 296 | Profile home | `ProfilePage` | Client; no Navbar/Footer; camera button is decorative (`:98`) |
| `app/(public)/profile/settings/page.tsx` | 300 | Edit account | `ProfileSettingsPage` | Client; `useState` seeded from `profile` - stale until remount; file-wide `/* eslint-disable */` at `:1` |
| `app/(public)/profile/preferences/page.tsx` | 314 | Preferences | `ProfilePreferencesPage` | Client; `updateLanguage(locale as any)` (`:58`) |
| `app/(public)/display/page.tsx` | 433 | Kiosk signage | `DigitalSignagePage` | Client; 8 `useEffect`s, 3 intervals, full page reload every 5 min, `dashboardData: any` |
| `app/(public)/temple-explorer/page.tsx` | 68 | Virtual tour page | `TempleExplorerPage` | Server hero + client explorer |
| `app/(public)/ai/analytics/page.tsx` | 690 | Public AI dashboard | `PublicAnalyticsPage` | Client; own SVG chart primitives; boundary to M08 |
| `app/calendar/page.tsx` | 177 | Calendar hub | `TempleCalendarPage` | Server; counts from `data/calendar.ts` |
| `app/calendar/ekadashi/page.tsx` | 58 | Ekadashi schedule | `EkadashiPage` | Client only for one `useState` + `window.print()` |
| `app/calendar/festivals/page.tsx` | 39 | Festival calendar | `FestivalsPage` | Client; uses `FestivalExperience`, not the local `FestivalTable` |
| `app/knowledge/page.tsx` | 25 | Knowledge Centre | `metadata`, `revalidate`, `KnowledgeCentrePage` | Only ISR page in the module (`revalidate = 3600`) |
| `app/knowledge/[category]/page.tsx` | 55 | Category listing | `generateMetadata`, `CategoryPage` | Two sequential awaits (`:43`,`:44`) |
| `app/knowledge/article/[slug]/page.tsx` | 40 | Article page | `generateMetadata`, `ArticlePage` | `getArticlePageData` called twice per request (`:13`,`:32`) |
| `components/temple-explorer/TempleExplorer.tsx` | 590 | Explorer UI | `TempleExplorer` (default) | Client; 4 local sub-components; Google Maps iframe; accessibility block in `AreaDetailPanel` (`:461-500`, never fed - M03-F35); file-wide `/* eslint-disable */` at `:1` |
| `components/calendar/Breadcrumb.tsx` | 59 | Breadcrumb | `Breadcrumb` (default) | Server; the most-reused file here (13 external importers) |
| `components/calendar/CalendarHero.tsx` | 32 | Calendar hero band | `CalendarHero` (default) | Server; pure props |
| `components/calendar/CalendarSearch.tsx` | 33 | Search box | `CalendarSearch` (default) | Client; controlled, no debounce |
| `components/calendar/NextEkadashiCard.tsx` | 122 | Next-ekadashi card | `NextEkadashiCard` (default) | Client; `new Date()` at render -> hydration risk |
| `components/calendar/EkadashiTable.tsx` | 144 | Ekadashi table | `EkadashiTable` (default) | Client; desktop `<table>` + mobile card list |
| `components/calendar/FestivalTable.tsx` | 135 | Festival table | `FestivalTable` (default) | **Dead** - no importer |
| `components/calendar/CalendarCenter.tsx` | 262 | Calendar hub section | `CalendarCenter` (default) | **Dead** - no importer; own `CountdownCard` |
| `components/knowledge/KnowledgeCentreClient.tsx` | 501 | Knowledge hub UI | `KnowledgeCentreClient` (default) | Client; localStorage bookmarks, search API, print/share; file-wide `/* eslint-disable */` at `:1` |
| `components/knowledge/KnowledgeCategoryClient.tsx` | 158 | Category UI | `KnowledgeCategoryClient` (default) | Client only for framer-motion; otherwise static |
| `components/knowledge/KnowledgeArticleClient.tsx` | 366 | Article UI | `KnowledgeArticleClient` (default) | Client; `dangerouslySetInnerHTML` + local `formatContent` |
| `services/seva.service.ts` | 91 | Seva CRUD | `sevaService` | Supabase-first with Firestore fallback; its write methods target Firestore and have no caller (the live Firestore `sevas` writer is `/api/admin/receipt-sevas`) |
| `services/sevaBooking.service.ts` | 93 | Booking CRUD | `sevaBookingService` | Firestore `sevaBookings`; `updatePayment` is the trust hole |
| `services/pooja.service.ts` | 101 | Daily pooja CRUD | `poojaService` | Firestore `dailyPoojas`; **not used by `/pooja`** - admin only |
| `services/donation.service.ts` | 83 | Donation CRUD | `donationService` | Firestore `donations`; tolerant `docToDonation` mapping |
| `services/donationCampaign.service.ts` | 142 | Campaign CRUD | `donationCampaignService` | Firestore `donation_campaigns`; **no importer - dead** |
| `services/quote.service.ts` | 1040 | Quote engine | `quoteService` | Firestore `quotes`, calendar-aware selection, module-level cache; `/quotes` does not use it |
| `services/profile.service.ts` | 413 | Profile + bookmarks | `profileService` | Firestore `profiles`, `bookmarks`; Firebase Storage images |
| `services/temple-areas.service.ts` | 5 | Alias | `templeAreasService` | Re-export of the Supabase service |
| `services/temple-areas.supabase.service.ts` | 193 | Temple areas | `TempleAreasSupabaseService`, `templeAreasSupabaseService` | Supabase `temple_areas`; admin client for writes, anon for public reads |
| `hooks/useDonationNotifications.ts` | 99 | Recent-donation feed | `useDonationNotifications` | Client; 60 s polling, 7-day filter; used by the **admin** bell |
| `lib/sevas.ts` | 91 | Seva tiles from images | `SevaItem`, `getSevas` | Server-only (`fs.readdirSync`); prices/durations assigned by array index |
| `lib/options.ts` | 7 | Seva category options | `sevaCategories` | **No importer - dead** |
| `data/shlokas.ts` | 251 | Shloka corpus | `Shloka`, `shlokas`, `shlokaCategories` | 17 shlokas, Kannada verses; also read by two admin pages |
| `data/sevas.ts` | 2 | - | (none) | **Empty file** |
| `data/poojas.ts` | 2 | - | (none) | **Empty file** |
| `data/timings.ts` | 2 | - | (none) | **Empty file** |

## Types and stores

**Types consumed** (all outside this module's roots):
`types/seva.ts` (`Seva`, `SevaRequest`), `types/seva-booking.ts` (`SevaBooking`,
`SevaBookingRequest`, `SevaBookingStatus`, `PaymentStatus`), `types/pooja.ts`
(`DailyPooja`, `PoojaStats`), `types/donation.ts` (`DonationRecord`, `DonationRequest`,
`DonationStatus`, `PaymentMode`, `paymentModeOptions`), `types/donationCampaign.ts`,
`types/quote.ts`, `types/profile.ts` (`DevoteeProfile`, `UserPreferences`, `THEMES`,
`TIMEZONES`, `DEFAULT_USER_PREFERENCES`, `Bookmark`), `types/temple-explorer.ts`
(`TempleArea`, `AccessibilityInfo` (added 2026-10-06, `:6-12`), `CATEGORY_LABELS`, `CATEGORY_COLORS`, `TEMPLE_COORDINATES`, `TEMPLE_TIMINGS`),
`types/knowledge.ts`, `types/aaradhane.ts`, `types/gallery.ts`, `types/calendar.ts`.
Locally declared duplicates: `SevaBookingRecord` (`receipts/page.tsx:14`), `Quote`
(`quotes/page.tsx:20`), `Stotra` (`stotras/page.tsx:24`), `FavoriteItem`
(`favorites/page.tsx:30`), `LivePanchanga` (`display/page.tsx:24`), `AnalyticsData` /
`PublicStats` (`ai/analytics/page.tsx:28,66`), `DonationNotification`
(`useDonationNotifications.ts:6`).

**Stores touched**

| Store | Kind | Read by | Written by |
|---|---|---|---|
| `sevas` | Supabase table | `getAllSevasAction`, `getSevaByIdAction` (`app/actions/sevas.ts`); since 2026-09-30 also `apps/mobile/lib/api.ts:3` and `apps/mobile/app/sevas/[id].tsx:22` (anon client) | no app code; only the one-off migration scripts (`scripts/migrate-sevas.ts:115`, `scripts/seed-supabase-sevas.ts:150`) |
| `sevas` | Firestore | `sevaService.getAllSevas/getSevaById` fallback; also the receipt book (`lib/receipt/admin.ts:32,81`, M07) | the admin receipt-seva API: `POST /api/admin/receipt-sevas` (`app/api/admin/receipt-sevas/route.ts:75`) and `PUT .../[id]` (`app/api/admin/receipt-sevas/[id]/route.ts:55`), driven by `app/admin/receipts/seva-settings/page.tsx:102,105` via `services/receiptSeva.service.ts`. `sevaService.createSeva/updateSeva/deleteSeva` exist but have **no caller** |
| `sevaBookings` | Firestore | `sevaBookingService.getAll/ByUser/ById`, `/api/public/receipts` | `createBooking`, `updateBookingStatus`, `updatePayment`, `deleteBooking` |
| `dailyPoojas` | Firestore | `poojaService.getPoojas/getPoojaById/getStats` | `createPooja`, `updatePooja`, `deletePooja` (admin only) |
| `donations` | Firestore | `donationService.getDonations/getDonationById`, `useDonationNotifications` | `createDonation`, `updateDonationStatus`, `updateDonation`, `deleteDonation` |
| `donation_campaigns` | Firestore | `donationCampaignService.*` (unreached) | same (unreached) |
| `quotes` | Firestore | `quoteService.getQuotes/getQuoteById/getQuoteBySlug/selectQuote/...` | `createQuote`, `updateQuote`, `deleteQuote`, `bulkImport`, `seedDefaultQuotes`, `incrementViewCount` |
| `profiles` | Firestore | `profileService.getProfile` | `saveProfile`, `updateProfile`, `updatePreferences`, `addFavorite`, `removeFavorite`, `addRecentlyViewed` |
| `bookmarks` | Firestore | `profileService.getBookmarks`, `isFavorited` | `addBookmark`, `removeBookmark` |
| `temple_areas` | Supabase table | `getAreas`, `getPublicAreas`, `getArea`, `getPublicArea` | `addArea`, `updateArea`, `deleteArea` (no `accessibility` column - M03-F35) |
| Firebase Storage `profiles/{uid}/{timestamp}.{ext}` (`profile.service.ts:216`) | blob | `getDownloadURL` | `uploadBytes`, `deleteObject` |
| `data/calendar.ts` | static TS | 10 importers: `/calendar`, `NextEkadashiCard`, `EkadashiTable`, `FestivalTable`, `CalendarCenter`, `lib/festival-utils.ts`, and 4 admin screens (`app/admin/calendar/ekadashi`, `app/admin/calendar/festivals`, `app/admin/settings/ekadashi-calendar`, `app/admin/settings/festival-calendar`) | code edit only - the admin screens POST to `/api/calendar`, which does not exist (see M03-F33) |
| `data/shlokas.ts` | static TS | `/shlokas`, two admin pages | code edit only |
| `public/data/panchanga/current.json` | static JSON | `/display` via `fetch` | M14 workflow |
| `public/images/sevas/*` | filesystem | `lib/sevas.getSevas()` (`readdirSync`) | - |
| `localStorage` | browser | knowledge bookmarks + language (`KnowledgeCentreClient`, `KnowledgeArticleClient`) | same |

## Cross-module dependencies

**This module imports from:**

| Target | Chunk | Used by |
|---|---|---|
| `components/layout/Navbar.tsx`, `Footer.tsx` | M05 | 15 pages each |
| `components/home/SevaBooking.tsx`, `SevaReceipt.tsx`, `DonationForm.tsx`, `DonationCTA.tsx`, `TempleTimings.tsx`, `SacredDivider.tsx` | M05 | `/sevas`, `/receipts`, `/donation`, `/pooja`, `/qr` |
| `components/common/SectionHeading.tsx`, `SkeletonLoader.tsx`, `FavoriteButton.tsx`, `LanguageSwitcher.tsx` | M05 | sevas/pooja/receipts/shlokas, stotras/favorites, quotes/stotras, profile |
| `components/ui/button.tsx`, `input.tsx` | M05 | `/receipts`, `/qr` |
| `components/festival/FestivalExperience.tsx`, `lib/festival-utils.ts` | M05/M06 | `/calendar/festivals` |
| `context/AuthContext.tsx`, `context/ProfileContext.tsx` | M04 | profile x3, favorites, quotes, stotras |
| `lib/firebase.ts` | M01 | 8 services/hooks |
| `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `app/actions/sevas.ts` | M01/M11 | temple-areas service, seva service |
| `lib/device/index.ts`, `lib/device/qr/QRCode.tsx` | M13 | `/qr` |
| `lib/i18n/index.ts` | M05 | `profile.service.ts` |
| `services/aaradhane.service.ts` | M07 | `/aaradhane` |
| `services/knowledge.service.ts` | M09 | 3 knowledge pages + `/favorites` |
| `services/daily-spiritual.service.ts`, `services/settings.service.ts`, `services/gallery.service.ts`, `services/event.service.ts` | M05/M06/M07 | `/display`, `/favorites` |
| `data/calendar.ts` | M06 | calendar pages/components |
| `/api/ai/analytics` | **M08** | `/ai/analytics` (fetch only - the AI engine stays in M08) |
| `/api/public/stats` | M12 | `/ai/analytics` |
| `/api/knowledge/search` | M09 | `KnowledgeCentreClient` |
| `/api/temple-areas` | M12 | `TempleExplorer` |
| `/api/public/receipts` | M12 | `/receipts` |

**Other modules import from this one:**

| File | Imported by |
|---|---|
| `components/calendar/Breadcrumb.tsx` | 13 pages across M02/M05/M06 (`about`, `events`, `facilities`, `future-plans`, `gallery`, `guruparampara`, `journey`, `pages/notifications`, `pages/settings`, `testimonials`, `testimonials/submit`, `trust`, `volunteer`) |
| `services/seva.service.ts` | `components/home/SevaBooking.tsx` (M05), `app/admin/assistant/page.tsx` (M12) |
| `services/sevaBooking.service.ts` | 11 importers - admin bookings/reports (M07/M12), `/api/bookings*`, `report.service.ts`, `SevaBooking.tsx` |
| `services/pooja.service.ts` | 6 admin pooja importers (M07) |
| `services/donation.service.ts` | 8 importers - admin donations (M07), `/api/donations*`, `report.service.ts`, `DonationForm.tsx` |
| `services/quote.service.ts` | 18 importers - 15 quote API routes (M06/M12), `PersonalizedHomepage` (M05), `services/daily-spiritual.service.ts:22` (relative import), plus in-module `app/(public)/favorites/page.tsx:10` which imports it and never calls it. `lib/ai/generator.ts` (M08) dropped its import in `356de70` (2026-09-19) |
| `services/profile.service.ts` | `context/ProfileContext.tsx` (M04) only |
| `services/temple-areas.service.ts` | 4 API routes (M12) |
| `hooks/useDonationNotifications.ts` | `components/admin/layout/NotificationDropdown.tsx` (M12) |
| `lib/sevas.ts` | `components/home/FeaturedSevas.tsx`, `FeaturedSevasClient.tsx` (M05) |
| `data/shlokas.ts` | `app/admin/settings/shlokas/page.tsx`, `app/admin/shlokas/page.tsx` (M07) |

## How to change it

### Add a field to a seva booking (e.g. `preferredTime`)
1. `types/seva-booking.ts` - add to `SevaBooking` (the `SevaBookingRequest` Omit picks it up).
2. `services/sevaBooking.service.ts:7` - map it in `docToBooking` with a default.
3. `components/home/SevaBooking.tsx` - add state, an input, and the field in the
   `createBooking({...})` call at `:155`.
4. `app/api/public/receipts/route.ts:45` - add it to the returned shape if it must appear on receipts.
5. `components/home/SevaReceipt.tsx` - add the prop and render it; update both call sites
   (`SevaBooking.tsx` and `app/(public)/receipts/page.tsx:195`).
6. `docs/DATA-MODEL.md` §3 - update the schema (it is already wrong; see M03-F12).

### Add a new public devotional page (e.g. `/bhajans`)
1. Create `app/(public)/bhajans/page.tsx`. Decide server vs client: keep it a Server Component
   unless it needs state.
2. Render `Navbar`, `Breadcrumb` (`components/calendar/Breadcrumb.tsx`), `SectionHeading`,
   `Footer` - that is the house pattern for this module.
3. Put content in a service under `services/` (not a `SAMPLE_*` const in the page - see
   M03-F02/F03).
4. Add the link to `components/layout/Navbar.tsx` - the arrays are `menuItems` (`:16`),
   `guruParamparaDropdown` (`:21`), `calendarDropdown` (`:27`), `aboutDropdown` (`:32`),
   `onlineServicesDropdown` (`:39`) and `eventsDropdown` (built in the component, `:78`) -
   and `components/layout/Footer.tsx` (`:36-55`), otherwise the route is orphaned.

### Point `/quotes` at the real quote engine
1. Delete `SAMPLE_QUOTES` (`app/(public)/quotes/page.tsx:29`) and the local `Quote` interface (`:20`).
2. Import `Quote` from `types/quote.ts`.
3. Replace the fake load (`:85`) with `fetch('/api/quotes?...')` - the routes already exist
   (`app/api/quotes/route.ts`, `/today`, `/random`, `/search`, `/category/[category]`, `/tags`).
   Do **not** import `quoteService` into a client component: it opens a Firestore client
   connection and carries a module-level cache.
4. Wire `handleExplain` (`:126`) to an AI route owned by M08, or remove the button.

### Change the UPI destination or add a real gateway
1. Finance settings live in M07 (`useFinanceSettings`, `settings.service.ts`).
2. Remove the hardcoded fallback `"9886364462@ptsbi"` from **both**
   `components/home/SevaBooking.tsx:114` and `components/home/DonationForm.tsx:66`.
3. For a real gateway: add a server route that creates an order, and move
   `sevaBookingService.updatePayment` (`services/sevaBooking.service.ts:81`) behind a
   server-side webhook handler. Client code must never set `paymentStatus:"completed"`.
4. Then wire `DonationForm` to redirect to `/donation/success` / `/donation/failure`
   (the pages already exist and are currently unreachable).

### Add a temple-explorer area field
1. Supabase: add the column to `temple_areas`.
2. `types/temple-explorer.ts` - add to `TempleArea`.
3. `services/temple-areas.supabase.service.ts` - `mapToTempleArea` (`:169`), `addArea`
   insert object (`:102`), `updateArea` conditional block (`:128`).
4. `components/temple-explorer/TempleExplorer.tsx` - render it in `AreaCard` (`:306`) or
   `AreaDetailPanel` (`:376`).
5. The admin form `app/admin/temple-areas/page.tsx` (form defaults at `:313`, `:331`) so the field can be edited, and
   `scripts/seed-temple-areas-supabase.ts:45-55`, which spreads every `TEMPLE_AREAS` key into the upsert -
   a type field without a column breaks the seed (M03-F38). Two migrations create `temple_areas` with
   different `id` types (`20240523000000_...` UUID, `20240915_...` TEXT plus `image_url`/`has360_view`);
   `mapToTempleArea` reads the 20240915 columns, so add the new column against that shape.

All five steps matter: `accessibility` (commit `11a532f`) did only steps 2 and 4, so the UI exists and
nothing ever reaches it (M03-F35).

### Change the ekadashi / festival calendar
1. Edit `data/calendar.ts` - it is a static TS module, so a code edit and a redeploy is the
   only thing that changes it. The admin screens at `app/admin/calendar/ekadashi` and
   `app/admin/calendar/festivals` look like an editor but POST to `/api/calendar`, a route
   that does not exist in `app/api/` - the write 404s and the change is lost on reload
   (see M03-F14 / M03-F33).
2. `components/calendar/EkadashiTable.tsx` and `NextEkadashiCard.tsx` read it directly; no
   other change is needed.

### Gate a page behind login properly
1. Client-only guards (`profile/page.tsx:23` on `isAuthenticated`, `favorites/page.tsx:108`
   on `user`) hide UI but do not
   protect data; the Firestore rules are the real gate.
2. To harden: move the page to a Server Component and apply the same session guard the admin
   area uses in `app/admin/layout.tsx` (M04 owns that pattern), calling `redirect('/login')`.
   There is no `middleware.ts`; its Next 16 replacement `proxy.ts` exists (`proxy.ts:84`) but only sets
   security headers and tracks page views - it never redirects (`proxy.ts:94-95`). Adding an auth
   redirect there is a new decision (M01 owns `proxy.ts`).

## Faults, smells and risks

| id | sev | What | Evidence | Direction | Status 2026-10-18 |
|---|---|---|---|---|---|
| M03-F01 | HIGH | Payment status is set by the browser. `updatePayment` writes `paymentStatus:"completed"` + `status:"confirmed"` from client code on a user-typed reference; nothing verifies the transaction. Anyone can mark a booking paid. | `services/sevaBooking.service.ts:81-84` (writes `paymentDate` and `status:"confirmed"` at `:83`), called from `components/home/SevaBooking.tsx:190` inside `handleSavePaymentReference` (`:181`) | Move payment confirmation to a server route/webhook; make the client field write-once and unverified until an admin or gateway confirms | STILL OPEN |
| M03-F02 | HIGH | `/api/public/receipts` is unauthenticated and substring-matches phone/email across the newest 1000 bookings, returning up to 20 records with names, emails and phone numbers. A two-digit query leaks strangers' PII. | `app/api/public/receipts/route.ts:6,28,39-44`; called from `app/(public)/receipts/page.tsx:53` | Require an exact match plus a second factor (booking id + phone), or OTP; never return other devotees' contact details | STILL OPEN |
| M03-F03 | HIGH | `POST /api/temple-areas` and `PUT`/`DELETE /api/temple-areas/[id]` have no auth check and run through the Supabase **service-role** client, so any visitor can create, edit or delete temple areas. | `app/api/temple-areas/route.ts:14-31`, `app/api/temple-areas/[id]/route.ts:23,39`; admin client at `services/temple-areas.supabase.service.ts:98,129,159` | Delete the write verbs from the public route (the admin equivalents already exist at `/api/admin/temple-areas`) or add the admin session guard | STILL OPEN |
| M03-F04 | HIGH | Hardcoded UPI id `"9886364462@ptsbi"` as a fallback payee in two payment paths. If finance settings fail to load, money is directed at a literal in the source. | `components/home/SevaBooking.tsx:114`, `components/home/DonationForm.tsx:66` | Fail closed - disable the pay button when `upiDetails.id` is missing | STILL OPEN |
| M03-F05 | HIGH | `/quotes` ignores the entire quote engine and renders 5 hardcoded quotes; the "AI Explanation" button is a 1500 ms `setTimeout` that produces nothing. Docs describe this page's data as Firestore-driven. | `app/(public)/quotes/page.tsx:29,76,126-131`; engine at `services/quote.service.ts:494,670`; `docs/QUOTE-ENGINE.md:11` | Fetch from the existing `/api/quotes*` routes; remove or implement the AI button | STILL OPEN |
| M03-F06 | MEDIUM | `/stotras` likewise renders 5 hardcoded stotras with a fake 500 ms loading state; there is no stotra service or collection at all. `audioUrl`/`pdfUrl` are declared but never populated, so Play/PDF never render. | `app/(public)/stotras/page.tsx:40,106,113,363,372` | Back it with a Firestore collection + admin CRUD, or state plainly that it is seed content | STILL OPEN |
| M03-F07 | MEDIUM | Article HTML is injected without escaping. `formatContent` builds raw HTML from Firestore article content and it goes into `dangerouslySetInnerHTML`. Stored XSS if an admin account or the collection is compromised. | `components/knowledge/KnowledgeArticleClient.tsx:267,339-365` | Sanitize (DOMPurify) or render markdown through a safe renderer | STILL OPEN |
| M03-F08 | MEDIUM | `/donation/success` and `/donation/failure` are unreachable - `DonationForm` shows an in-page dialog and never navigates. The success page also promises "A receipt has been sent to your email address", which nothing sends. | `app/(public)/donation/success/page.tsx:20-22`; no `donation/success` or `donation/failure` reference anywhere in `app`, `components`, `lib` or `services` - the only references in the repo are direct `page.goto` calls in `tests/e2e/donations/donations.spec.ts:175,188` and `tests/e2e/user-journeys/user-journeys.spec.ts:118,126`, which navigate to the URLs rather than exercising a link | Route the form to them, or delete both pages and the email claim | STILL OPEN |
| M03-F09 | MEDIUM | Client-mint receipt references are never persisted. `SVA-...` and `DON-...` are generated in the browser, shown on the receipt, and never written to Firestore, so the paper trail cannot be matched to a record. | `components/home/SevaBooking.tsx:152` vs `services/sevaBooking.service.ts:36`; `components/home/DonationForm.tsx:98` vs `services/donation.service.ts:39` | Generate the reference server-side and store it (`receiptNumber` already exists on `DonationRecord`) | STILL OPEN |
| M03-F10 | MEDIUM | Donation validation is four truthiness checks and nothing else - no email format, no phone format, no amount range or numeric guard, and no server-side validation at all (the service writes straight to Firestore from the client). | `components/home/DonationForm.tsx:83-93`, `services/donation.service.ts:37`; AGENTS.md "Validate all inputs - Server-side validation required" | Add zod schemas shared by client and a server route; write donations through an API route | STILL OPEN |
| M03-F11 | MEDIUM | Profile/favorites auth is a client-side early return. The bundle and any data the component fetches are not protected by it, and there is no `middleware.ts` (the Next 16 `proxy.ts` never redirects, `proxy.ts:94-95`). The four pages do not even agree on the predicate: three test `isAuthenticated` from `useProfile`, `/favorites` tests `user` from `useAuthContext`, so the two can disagree while the profile document is still loading. | `app/(public)/profile/page.tsx:23` (`!isAuthenticated`), `profile/settings/page.tsx:33` (`!isAuthenticated`), `profile/preferences/page.tsx:38` (`!isAuthenticated`), `favorites/page.tsx:108` (`!user`) | Guard in a server layout with `redirect('/login')` (the `app/admin/layout.tsx` pattern); keep the client check only as UX | MOVED - `profile/settings/page.tsx:33`, `favorites/page.tsx:108` (+1 line from `6408c1d`); fault unchanged |
| M03-F12 | MEDIUM | `docs/DATA-MODEL.md` and the code disagree on `sevaBookings`: doc says `devoteeName/devoteeEmail/devoteePhone`, `statusHistory`, `bookedBy`, `confirmedBy`, `paymentMode`, `paymentStatus:"paid"`; code has `userName/userEmail/userPhone`, `raashi`, `paymentReference/paymentMethod` and `paymentStatus:"completed"`, and no history fields. | `docs/DATA-MODEL.md:122-170` vs `types/seva-booking.ts:1-31`, `services/sevaBooking.service.ts:7-31` | Regenerate the doc from the types, or migrate the code to the documented schema | STILL OPEN |
| M03-F13 | MEDIUM | `docs/DATA-MODEL.md` names the campaign collection `donationCampaigns`; the code uses `donation_campaigns`. The doc also gives `donations` fields (`donorEmail`, `donorPhone`, `pan`, `eligible80G`, `paymentId`, `transactionId`) that `DonationRecord` does not have. | `docs/DATA-MODEL.md:800,385-420` vs `services/donationCampaign.service.ts:21`, `types/donation.ts:13-42` | Pick one naming and one schema; 80G fields are a real gap for a temple | STILL OPEN |
| M03-F14 | MEDIUM | The public calendar is a static TS file pinned to `year: 2026` / "Sri Parabhava" (19 ekadashi from 2026-07-11 to 2027-04-02, 24 festivals to 2027-03-22). Nothing at runtime can change it - the admin screens that look like editors do not work (M03-F33) - and "More Spiritual Calendars Coming Soon" is hardcoded copy. | `data/calendar.ts:3-12` and `:29-55`, `app/calendar/page.tsx:29,148-168` | Move ekadashi/festival data to Firestore behind the existing admin calendar screens | STILL OPEN |
| M03-F15 | MEDIUM | Dead code: three files with no importer anywhere and three empty data files. | `components/calendar/CalendarCenter.tsx` (262 lines), `components/calendar/FestivalTable.tsx` (135), `services/donationCampaign.service.ts` (142), `lib/options.ts` (7), `data/sevas.ts`, `data/poojas.ts`, `data/timings.ts` (all 0-1 lines); verified by `.claude/state/inventory/import-graph.json` and a repo-wide grep | Delete, or wire `donationCampaignService` into the donation form's `campaignId` (currently a const `""` at `DonationForm.tsx:23`) | STILL OPEN |
| M03-F16 | MEDIUM | Nine routes are unreachable from the site chrome: `/quotes`, `/stotras`, `/receipts`, `/qr`, `/display`, `/favorites`, `/profile`, `/calendar` (hub) and `/ai/analytics` appear in neither Navbar nor Footer. | `components/layout/Navbar.tsx:17-43,80`, `components/layout/Footer.tsx:38-53` | Add them to the nav/user menu or retire them | STILL OPEN |
| M03-F17 | MEDIUM | `/display` is a public unauthenticated page that reloads the whole document every 5 minutes. It runs 8 `useEffect` hooks, 3 of which hold a live `setInterval` (1 s clock, 10 s slideshow, 5 min reload); `dashboardData` is typed `any`. On a lobby TV it is fine, but it is also world-readable and expensive. | `app/(public)/display/page.tsx:46` (`useState<any>`), `:53-58` (1 s), `:118-121` (panchanga fetch), `:170-178` (10 s), `:181-188` (5 min `window.location.reload()`) | Put it behind a token or a `/kiosk` route; replace the full reload with data refetch | STILL OPEN |
| M03-F18 | MEDIUM | `/shlokas` availability is decided by `new Date().getHours()` inside a client component's lazy `useState`. During SSR that is the server clock (UTC on Vercel), during hydration the device clock - a guaranteed mismatch near the boundary, and the rule itself is undocumented product behaviour. | `app/(public)/shlokas/page.tsx:14-17,28` | Compute in `useEffect` after mount, or drop the gate | STILL OPEN |
| M03-F19 | LOW | `/favorites` imports `eventService`, `quoteService`, `galleryService` and `knowledgeService` and calls none of them; `removingId`/`setRemovingId` is never read or set, and three imported icons (`Filter`, `X`, `Loader2`) are never rendered - the rest are used through the `TYPE_CONFIG` map at `:41-50`. Pulling `quoteService` into a client bundle drags in 1040 lines and the Firestore client. | `app/(public)/favorites/page.tsx:9-12` (four unused service imports), `:14-26` vs `:41-50` (icons), `:61` (`removingId`) | Remove the dead imports | MOVED - `app/(public)/favorites/page.tsx:9-12`; fault unchanged and now also hidden from lint (M03-F36) |
| M03-F20 | LOW | 23 `any` occurrences across the module, against AGENTS.md "No `any` type". Worst offenders are the `docToX(docSnap: any)` mappers and `dashboardData: any`. | Counted over the 51 inventory files: `services/quote.service.ts` (7), `services/temple-areas.supabase.service.ts` (3), `app/(public)/display/page.tsx` (2), `services/donation.service.ts` (2), `services/donationCampaign.service.ts` (2), + 7 files with 1 each (`profile/preferences/page.tsx`, `TempleExplorer.tsx`, `seva.service.ts`, `sevaBooking.service.ts`, `pooja.service.ts`, `profile.service.ts`, `useDonationNotifications.ts`) = 23 | Type the Firestore snapshots (`QueryDocumentSnapshot`) and the dashboard payload | STILL OPEN |
| M03-F21 | LOW | Nested `<main>`: `app/(public)/layout.tsx:12` renders `<main id="main-content">` and **24** child pages under `(public)` render their own `<main>` - 11 of them in this module (`sevas`, `pooja`, `donation`, `donation/success`, `donation/failure`, `receipts`, `aaradhane`, `shlokas`, `qr`, `temple-explorer`, `ai/analytics`). Two `main` landmarks per page breaks screen-reader landmark navigation. `app/calendar/*` also uses `<main>` but sits outside `(public)`, so it does not nest. | `app/(public)/layout.tsx:12` vs `app/(public)/sevas/page.tsx:11`, `donation/page.tsx:11`, `pooja/page.tsx:12`, `qr/page.tsx:163` | Drop `<main>` from the pages or from the layout | STILL OPEN |
| M03-F22 | LOW | Layout is inconsistent. Seven public pages import neither Navbar nor Footer: `/quotes`, `/stotras`, `/favorites`, `/profile`, `/profile/settings`, `/profile/preferences` and `/display` (the last deliberately, as a kiosk). `/knowledge` renders them but `/knowledge/[category]` and `/knowledge/article/[slug]` do not, and neither do their client components. `app/calendar/*` and `app/knowledge/*` sit outside `(public)` so they lose `PageViewTracker` and `GoUpButton`. | Repo-wide grep for `from "@/components/layout/Navbar"`: 29 importers, none of them the seven pages above; `app/knowledge/page.tsx:4,19` vs `app/knowledge/[category]/page.tsx` (no Navbar import) and `components/knowledge/KnowledgeCategoryClient.tsx` (no Navbar import); `app/(public)/layout.tsx:11,15` | Move chrome into a shared layout and move `calendar`/`knowledge` into `(public)` | STILL OPEN |
| M03-F23 | LOW | `services/quote.service.ts:243` defines `isCacheValid()` which nothing calls; `getTodaysQuote` does its own check (`:672`) and therefore ignores `CACHE_DURATION`. The cache is module-level, so in a serverless deploy it is per-instance and unshared. | `services/quote.service.ts:39,243,672,694` | Delete the dead helper; move the cache to `unstable_cache`/Redis if it is meant to be shared | STILL OPEN |
| M03-F24 | LOW | `app/knowledge/article/[slug]/page.tsx` calls `getArticlePageData(slug)` twice per request - once in `generateMetadata` (`:13`) and once in the page (`:32`). `[category]/page.tsx` also awaits two service calls sequentially. | `app/knowledge/article/[slug]/page.tsx:13,32`; `app/knowledge/[category]/page.tsx:43-44` | Wrap the fetch in React `cache()`; use `Promise.all` for the category pair | STILL OPEN |
| M03-F25 | LOW | `services/seva.service.ts` reads through a Supabase server action but all writes go to Firestore, so admin edits never reach the table that `getAllSevas` reads. Its own `createSeva/updateSeva/deleteSeva` have no caller; the live writer is the admin receipt-seva API, which also writes Firestore `sevas`. Supabase `sevas` changes only when a migration script is re-run. Dual-write drift is silent. | `services/seva.service.ts:11,44` (read Supabase) vs `:74,79,84` (Firestore write methods, uncalled); live writer `app/api/admin/receipt-sevas/route.ts:75`, `app/api/admin/receipt-sevas/[id]/route.ts:55` | Finish the Supabase migration for sevas or revert reads to Firestore | STILL OPEN |
| M03-F26 | LOW | `lib/sevas.ts` invents prices and durations by array index over whatever image files exist in `public/images/sevas`, so a devotee-facing price is a function of filename sort order. | `lib/sevas.ts:24-25,74-79` | Drive the featured-seva tiles from the `sevas` table like the booking form does | STILL OPEN |
| M03-F27 | LOW | `/pooja` never uses `poojaService`; the schedule shown comes from `TempleTimings` (M05) while the `dailyPoojas` collection is admin-only. Two sources of truth for pooja timings. | `app/(public)/pooja/page.tsx:21` vs `services/pooja.service.ts:40`; `poojaService` importers are all under `app/admin`/`components/admin` | Render `/pooja` from `poojaService.getPoojas()` | STILL OPEN |
| M03-F28 | LOW | `temple-areas.supabase.service.ts` imports `TEMPLE_AREAS as DEFAULT_TEMPLE_AREAS` and never uses it, so an empty table shows "Coming Soon" instead of the bundled defaults; `mapToTempleAreas` passes an unbound method to `rows.map`. | `services/temple-areas.supabase.service.ts:4,188`; `components/temple-explorer/TempleExplorer.tsx:202` | Use the defaults as a fallback or drop the import; bind with an arrow function | MOVED - `components/temple-explorer/TempleExplorer.tsx:202`; worse now: the unused defaults are the only source of accessibility data (M03-F35) |
| M03-F29 | LOW | `/qr` hardcodes the deployment URL `https://rayaramathaynk.vercel.app` and builds a print document with `document.write` of an unescaped template string containing `data.title`/`data.description`. | `app/(public)/qr/page.tsx:15-16,46-74` | Read the origin from env/`window.location.origin`; build the print DOM with elements | STILL OPEN |
| M03-F30 | LOW | Aaradhane reads from two collections (`aaradhane`, then `aaradhanes`) plus `events` as a third fallback, so which rows the page shows depends on which collection happens to be non-empty. | `services/aaradhane.service.ts:16-18,164,175` (M07 file, surfaced by `app/(public)/aaradhane/page.tsx:129`) | Consolidate to one collection and migrate | STILL OPEN |
| M03-F31 | LOW | `ProfileSettingsPage` seeds its form `useState` from `profile` at first render only, so after the profile loads (or is edited elsewhere) the inputs keep stale values until the component remounts. | `app/(public)/profile/settings/page.tsx:25-29` | Sync with `useEffect` on `profile`, or use `key={profile?.uid}` | MOVED - `app/(public)/profile/settings/page.tsx:25-29`; fault unchanged |
| M03-F32 | LOW | `/ai/analytics` publishes AI operational telemetry - conversation counts, unique users, latency, error rate, health status - to anonymous visitors, and polls it every 60 s. | `app/(public)/ai/analytics/page.tsx:294,337,353` | Decide deliberately what is public; the admin twin already exists at `app/admin/ai/analytics` | STILL OPEN |
| M03-F33 | MEDIUM | The admin calendar editors write to a route that does not exist. `app/admin/calendar/ekadashi/page.tsx` and `app/admin/calendar/festivals/page.tsx` each `fetch("/api/calendar", { method: "POST" })` on add, edit and delete - six call sites - but there is no `app/api/calendar/` directory anywhere in the repo. The POST 404s, the `catch` swallows it, local `useState` updates, and the edit disappears on reload. This is what actually makes the public calendar unmaintainable (M03-F14), not the absence of a screen. | `app/admin/calendar/ekadashi/page.tsx:34,62,80`, `app/admin/calendar/festivals/page.tsx:31,60,79`; `ls app/api` lists 23 directories, none named `calendar` | Either build `app/api/calendar/route.ts` backed by Firestore and have `data/calendar.ts` become a seed, or delete the two admin screens so nobody believes the calendar is editable | STILL OPEN |
| M03-F34 | MEDIUM | Knowledge deep links are built with the wrong path. Previous/next article links and the Knowledge Centre's bookmark and recently-viewed lists point at `/knowledge/<article-slug>`, which resolves to the `[category]` route; that route looks the segment up in `KNOWLEDGE_CATEGORY_CONFIG` by `slug` and calls `notFound()` when it misses, so every one of these links 404s. The same files get it right elsewhere with `/knowledge/article/<slug>`. | Broken: `components/knowledge/KnowledgeArticleClient.tsx:275,291`, `components/knowledge/KnowledgeCentreClient.tsx:301,336`. Correct: `KnowledgeArticleClient.tsx:315`, `KnowledgeCentreClient.tsx:463,484`, `KnowledgeCategoryClient.tsx:123,141`. Route guard: `app/knowledge/[category]/page.tsx:32-38` | Change the four call sites to `/knowledge/article/${slug}`; `KnowledgeCentreClient.tsx:364` is correct as-is because it links a category slug | MOVED - `components/knowledge/KnowledgeCentreClient.tsx:301,336`; fault unchanged |
| M03-F35 | MEDIUM | Temple Explorer accessibility info (AI-004) can never appear. `AreaDetailPanel` renders an "Accessibility Information" block when `area.accessibility` is set, but the page reads only Supabase `temple_areas`, which has no accessibility column, and `mapToTempleArea` does not map one. The only populated `accessibility` objects are in the `TEMPLE_AREAS` defaults, which the running app never reads (M03-F28); only the seed scripts read them (M03-F38). No admin form edits it either (`app/admin/temple-areas/page.tsx` has no such field). | `components/temple-explorer/TempleExplorer.tsx:461-500`; `types/temple-explorer.ts:6-12,28,94,183,207,251`; `services/temple-areas.supabase.service.ts:169-185`; `supabase/migrations/20240523000000_create_temple_areas.sql:1-16` and `supabase/migrations/20240915_create_temple_areas.sql:1-18` (neither has the column); introduced by `11a532f` (2026-10-06) | Add an `accessibility JSONB` column, map it in `mapToTempleArea`/`addArea`/`updateArea`, and add it to the admin temple-areas form | NEW (2026-10-18) |
| M03-F36 | LOW | File-wide `/* eslint-disable */` was added to four module files to get CI green, so `npm run lint` no longer reports their unused imports (M03-F19), `any`s (M03-F20) or hook-dependency issues. The same commit committed `lint.txt`, `lint2.txt` and `lint_files.txt` at the repo root. | `app/(public)/favorites/page.tsx:1`, `app/(public)/profile/settings/page.tsx:1`, `components/knowledge/KnowledgeCentreClient.tsx:1`, `components/temple-explorer/TempleExplorer.tsx:1` (also `context/ProfileContext.tsx:1`, M04); commit `6408c1d` (2026-10-03) | Remove the blanket disables and fix or narrowly suppress each rule with `eslint-disable-next-line` | NEW (2026-10-18) |
| M03-F37 | LOW | The Expo app reads seva and pooja data straight from Supabase while the web admin writes them to Firestore, so admin edits never reach the phone. Mobile lists sevas from Supabase `sevas` and daily poojas from Supabase `daily_poojas`; the admin receipt-seva API writes Firestore `sevas` and `poojaService` (from `components/admin/pooja/*`) writes Firestore `dailyPoojas`. Pooja timings now have three sources (`TempleTimings` on `/pooja`, Firestore `dailyPoojas`, Supabase `daily_poojas`). Mobile also looks a seva up by `id` where the web action uses `firestore_id`. | `apps/mobile/lib/api.ts:3-13,26-35`, `apps/mobile/app/sevas/[id].tsx:22-25`; `app/api/admin/receipt-sevas/route.ts:75`, `app/api/admin/receipt-sevas/[id]/route.ts:55`; `services/pooja.service.ts:16`, `components/admin/pooja/CreatePooja.tsx:85`; `app/actions/sevas.ts:13`; mobile added in `0cb71b6` (2026-09-30) | Finish the Supabase migration for both write paths (extends M03-F25/F27), or give mobile an HTTP API over the same services the web uses | NEW (2026-10-18) |
| M03-F38 | LOW | Commit `11a532f` broke the Supabase temple-areas seed for 4 of 11 areas. `scripts/seed-temple-areas-supabase.ts` strips five keys from each `TEMPLE_AREAS` entry and spreads the rest into the upsert, so `accessibility` (now present on `garbhagriha`, `kalyana-mantapa`, `bhajan-mantapa`, `anna-dana-shetra`) is sent as a column that neither migration defines. PostgREST rejects those rows, the script logs and continues, and a fresh environment seeds 7 areas. | `scripts/seed-temple-areas-supabase.ts:43-57` (destructure at `:45`, `...data` at `:54`, upsert at `:57`); `types/temple-explorer.ts:94,183,207,251`; `supabase/migrations/20240915_create_temple_areas.sql:1-18`, `supabase/migrations/20240523000000_create_temple_areas.sql:1-16` | Add the `accessibility JSONB` column (fixes M03-F35 too), or strip `accessibility` in the seed until it exists. The script is owned by M11 | NEW (verify 2026-10-18) |

## Portability notes (React Native / cross-platform)

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| All 24 page files | Next.js App Router file routing, `app/(public)` groups, Server Components, `next/link`, `next/image` | **rewrite** | Routing and the server/client split have no RN equivalent; screens become React Navigation routes |
| Every visual style | Tailwind class strings, gradients, `backdrop-blur`, `line-clamp`, arbitrary background-image URL classes | **rewrite** | No CSS in RN; needs NativeWind or a StyleSheet port. Gradients need `expo-linear-gradient` |
| `services/*.ts` (seva, sevaBooking, pooja, donation, donationCampaign, quote, profile) | `firebase/firestore` web SDK, `@/lib/firebase` | **adapt** | Logic is platform-agnostic; swap the web SDK for `@react-native-firebase/firestore` or call an HTTP API. `profile.service.ts` also uses `firebase/storage` |
| `services/temple-areas.supabase.service.ts` | `@supabase/ssr` cookie-based server client, service-role admin client | **rewrite** | Server-only; a mobile client must go through an HTTP API, never the admin key |
| `lib/sevas.ts` | Node `fs.readdirSync`, `process.cwd()` | **rewrite** | Filesystem scan; must become a data query |
| `app/actions/sevas.ts` | `"use server"` server actions | **rewrite** | Server actions are Next-only; expose as REST |
| `hooks/useDonationNotifications.ts` | `typeof window` check, dynamic `import("firebase/firestore")` | **adapt** | Polling logic reusable; drop the window guard, use a static import |
| `components/calendar/*` (Breadcrumb, Hero, Search, NextEkadashiCard, EkadashiTable, FestivalTable) | `next/link`, `<table>`, Tailwind | **adapt** | Pure presentational logic; `EkadashiTable`'s desktop `<table>` becomes a `FlatList`; the date maths in `NextEkadashiCard.tsx:6-39` is fully portable |
| `components/knowledge/KnowledgeArticleClient.tsx` | `dangerouslySetInnerHTML`, `window.print()`, `navigator.share`, `localStorage` | **rewrite** | Needs `react-native-render-html` or markdown; `expo-print`, `Share` API, `AsyncStorage` |
| `components/knowledge/KnowledgeCentreClient.tsx` | same + `window.location.origin`, framer-motion | **rewrite** | Motion -> Reanimated; search/debounce/bookmark logic is portable |
| `components/temple-explorer/TempleExplorer.tsx` | Google Maps `<iframe>`, framer-motion `AnimatePresence`, hover styles | **rewrite** | iframe -> `react-native-maps`; the hover-only affordances need touch equivalents |
| `app/(public)/qr/page.tsx` | `document.createElement`, `window.open`, `document.write`, `navigator.share`, `<img src=dataURL>` | **rewrite** | Use `react-native-qrcode-svg` + `expo-sharing`/`expo-print` |
| `app/(public)/display/page.tsx` | `document.requestFullscreen`, `window.location.reload()`, `<iframe>` YouTube | **rewrite** | Kiosk-only; arguably should not ship to mobile at all |
| `app/calendar/ekadashi/page.tsx` "Print Schedule" | `window.print()` | **rewrite** | `expo-print` |
| `/quotes`, `/stotras` share/copy | `navigator.share`, `navigator.clipboard` | **adapt** | RN `Share` + `@react-native-clipboard/clipboard`; already funnelled through small handlers |
| `app/(public)/profile/settings/page.tsx` photo upload | `<input type="file">`, `File`, `confirm()` | **rewrite** | `expo-image-picker` + `Alert.alert` |
| `app/(public)/ai/analytics/page.tsx` charts | inline `<svg>` paths | **adapt** | Geometry maths (`:105-247`) ports directly onto `react-native-svg` |
| `framer-motion` (aaradhane, temple-explorer, knowledge x3, CalendarCenter) | DOM animation | **rewrite** | `react-native-reanimated` / `moti` |
| `react-hot-toast` (receipts, profile x2, qr, SevaBooking, DonationForm) | DOM portal | **adapt** | Swap for `react-native-toast-message`; call sites are one-liners |
| `types/*` consumed here | none | **reuse as-is** | Fully portable |
| Date/format helpers (`formatDate` in aaradhane, EkadashiTable, FestivalTable, NextEkadashiCard, display) | `Intl.DateTimeFormat` | **reuse as-is** | Available in Hermes with `Intl` enabled; note the four near-duplicate copies |

**`apps/mobile` today (added 2026-09-30, commits `0cb71b6`, `5813fc9`).** The Expo app imports no code
and calls no API route from this module. It reads two of this module's domains directly from
Supabase with the anon client: the seva catalogue (`apps/mobile/lib/api.ts:3-13`, the same
`active && amount > 0`, `display_order` rule as `SevaBooking.tsx:63-67`) and a seva detail screen
(`apps/mobile/app/sevas/[id].tsx:22`) that says "Contact temple authorities for booking" (`:73`) -
no booking, payment, donation, receipt, profile or content screen exists on mobile. It also reads
Supabase `daily_poojas` (`api.ts:26-35`), a table the web `/pooja` page and `poojaService` never touch
(M03-F37).

A React Native client would need, from this module: **(a)** a real HTTP API for every write -
booking creation, payment confirmation, donation creation, profile/preferences updates,
bookmarks - because the mobile app cannot use server actions and must not hold the Supabase
service-role key; **(b)** the `types/` package extracted as a shared workspace so
`SevaBooking`, `DonationRecord`, `DevoteeProfile`, `TempleArea`, `Quote` and `Shloka` are
declared once; **(c)** the pure logic lifted out of the pages into that shared package -
next-ekadashi selection, countdown maths, category/search filtering, the quote-selection
algorithm in `services/quote.service.ts:494-745`, and the article formatter; **(d)** a single
content service so shlokas, stotras and quotes stop being hardcoded per-page arrays -
today a mobile app would have to duplicate `SAMPLE_QUOTES` and `SAMPLE_STOTRAS` verbatim;
**(e)** a payment integration, since "copy the UPI id and type back a reference" is not a flow
that survives an app-store review.

## Coverage

filesExpected 51, filesMentioned 51, omitted: none. (Re-counted 2026-10-18 from the regenerated
`.claude/state/inventory/M03.json`: still 51 files; no file added or deleted under the chunk roots.)

All 51 inventory files appear in **Key files**; `data/sevas.ts`, `data/poojas.ts` and
`data/timings.ts` are listed only to record that they are empty (0-1 bytes) and unimported.
Files read but not owned (boundary confirmation, one import level): `components/home/SevaBooking.tsx`,
`components/home/DonationForm.tsx`, `app/(public)/layout.tsx`, `app/actions/sevas.ts`,
`app/api/temple-areas/route.ts`, `app/api/temple-areas/[id]/route.ts`,
`app/api/public/receipts/route.ts`, `context/ProfileContext.tsx`, `services/aaradhane.service.ts`,
`types/seva-booking.ts`, `types/donation.ts`, `data/calendar.ts`, `components/layout/Navbar.tsx`,
`components/layout/Footer.tsx`.

## UNCLEAR

- **Is `/display` meant to be public?** It has no auth and no robots directive, but it is
  clearly a lobby screen. Settled by asking the temple, or by checking whether a kiosk device
  is provisioned.
- **Was `/ai` supposed to host a chat page?** The chunk brief names `app/(public)/ai` as an
  entry point but only `ai/analytics/page.tsx` exists, so `/ai` 404s. Settled by checking
  M08's route inventory for where the public chat widget is mounted (it may be a floating
  widget in the root layout rather than a page).
- **Which store is authoritative for `sevas` - Supabase or Firestore?** `seva.service.ts`
  reads Supabase first and writes Firestore only. Settled by the migration notes in
  `AGENTS.md` (Firestore dump / Supabase migration tooling) plus a row count on both.
- **Does `/donation` ever produce an 80G receipt?** `DonationRecord` has `receiptNumber` but
  no PAN or `eligible80G`, while `docs/DATA-MODEL.md:385-420` specifies them. Settled by the
  admin receipts module (M07) - it may generate them from a different record.
- **Whether the 23:00 shloka cutoff is a product rule or leftover debug.** No doc mentions it.
  Settled by asking the temple.

## Verification log (2026-09-19)

Skeptic pass over this brain file: 198 path citations resolved (0 broken), 32 claims sampled,
32 findings re-opened against the code. Changes made, one line each.

**Refuted claims corrected**

1. Profile image storage path was `profile-images/{uid}/...` -> now `profiles/{uid}/{timestamp}.{ext}`, cited `profile.service.ts:196,216` -> evidence: `services/profile.service.ts:216` builds `` `profiles/${uid}/${Date.now()}.${fileExtension}` ``; the string `profile-images` appears nowhere in the file. Fixed in the member-pages tree and in the Stores table.
2. All four member pages were described as guarding on `if (!isAuthenticated)` -> now says three test `isAuthenticated` and `/favorites` tests `user` -> evidence: `app/(public)/favorites/page.tsx:107` is `if (!user) {`, with `user` from `useAuthContext` (`:54`); `profile/page.tsx:23`, `settings/page.tsx:32`, `preferences/page.tsx:38` are `if (!isAuthenticated)`.
3. M03-F01 cited the `updatePayment` call at `SevaBooking.tsx:186` -> now `:190` (function `handleSavePaymentReference` at `:181`) -> evidence: `components/home/SevaBooking.tsx:190` is `await sevaBookingService.updatePayment(bookingId, {`; `:186` is blank.
4. `/display` was "6 useEffect timers" / "six concurrent timers" -> now 8 `useEffect` hooks of which 3 hold a `setInterval` -> evidence: `app/(public)/display/page.tsx` has `useEffect` at :53, :61, :73, :88, :103, :118, :170, :181 and `setInterval` only at :54 (1 s), :172 (10 s), :183 (5 min). Fixed in the tree and in M03-F17.
5. M03-F21 said 15 child pages render their own `<main>` -> now 24 under `(public)`, 11 of them in this module -> evidence: `grep -rl "<main" "app/(public)"` returns 25 files including `layout.tsx`.
6. M03-F20's breakdown ended "+ 8 more files with 1 each" -> now names `donationCampaign.service.ts` (2) and the 7 single-occurrence files -> evidence: script count over the 51 inventory files gives 7/3/2/2/2 + 7x1 = 23, which matches the headline number.
7. Cross-module table said `quote.service.ts` has 18 importers with `daily-spiritual.service.ts` among them -> now 19, and the reason for the miscount is named -> evidence: `services/daily-spiritual.service.ts:22` imports it relatively (`from "./quote.service"`), and `app/(public)/favorites/page.tsx:9` is an in-module importer; 15 API routes + `PersonalizedHomepage` + `lib/ai/generator.ts` + those two = 19.
8. M03-F14 said "No admin path updates it" -> now says nothing at runtime can change it *because* the admin editors POST to a route that does not exist, cross-referenced to the new M03-F33 -> evidence: `app/admin/calendar/ekadashi/page.tsx:34,62,80` and `festivals/page.tsx:31,60,79` fetch `/api/calendar`; `app/api/` contains 23 directories and none is `calendar`. Same correction applied to the "Change the ekadashi / festival calendar" recipe.
9. M03-F22 listed only `/profile*` and `/favorites` as chrome-less -> now names all seven (`/quotes`, `/stotras`, `/favorites`, `/profile`, `/profile/settings`, `/profile/preferences`, `/display`) -> evidence: 29 importers of `@/components/layout/Navbar`, none of which are those files.
10. The "add a new public page" recipe said to edit `navItems` at `Navbar.tsx:17` -> now names the six real arrays -> evidence: `components/layout/Navbar.tsx:16` declares `menuItems`; there is no `navItems` identifier in the file.
11. Stores table listed 5 readers of `data/calendar.ts` -> now 10, including the four admin screens and `lib/festival-utils.ts` -> evidence: repo grep for `from "@/data/calendar"`.
12. M03-F08's evidence claimed no reference to `donation/success` anywhere -> now scoped to app code, with the two e2e specs named -> evidence: `tests/e2e/donations/donations.spec.ts:175,188` and `tests/e2e/user-journeys/user-journeys.spec.ts:118,126` navigate to the URLs directly. The finding itself stands: no app code links there.
13. Seva Firestore fallback cited `seva.service.ts:32-39` -> now `:30-39` -> evidence: the `// Fallback to Firestore` comment is at `:30`.
14. Temple Explorer empty state cited `TempleExplorer.tsx:200` -> now `:199-207` with the heading at `:204` -> evidence: `:199` is the `areas.length === 0` branch, the literal "Coming Soon" is at `:204`.
15. Data flow 4 said `ProfileContext.tsx:165` forwards to `updatePreferences` -> now names the function `updateNotificationPreferences` at `:165` forwarding at `:170` -> evidence: `context/ProfileContext.tsx:165-170`.
16. M03-F19 said "several icons are unused" -> now names `Filter`, `X`, `Loader2` and notes the rest are used through `TYPE_CONFIG` -> evidence: `app/(public)/favorites/page.tsx:40-49` maps `Calendar`, `BookOpen`, `ImageIcon`, `QuoteIcon`, `Music`, `Video` into config entries; only those three never appear in JSX.

**Findings added**

17. M03-F33 (MEDIUM) - the admin calendar editors POST to `/api/calendar`, which does not exist, so calendar edits 404 and vanish on reload -> evidence: `app/admin/calendar/ekadashi/page.tsx:34,62,80`, `app/admin/calendar/festivals/page.tsx:31,60,79`, and the absence of `app/api/calendar/`.
18. M03-F34 (MEDIUM) - knowledge previous/next, bookmark and recently-viewed links use `/knowledge/<article-slug>`, which hits the `[category]` route and 404s -> evidence: `components/knowledge/KnowledgeArticleClient.tsx:275,291` and `KnowledgeCentreClient.tsx:300,335` versus the correct `/knowledge/article/${slug}` at `KnowledgeArticleClient.tsx:315` and `KnowledgeCentreClient.tsx:462,483`; the guard is `app/knowledge/[category]/page.tsx:32-38`.

**Coverage added**

19. Focus question 8 asked for a component tree per page; five pages had none -> added "The remaining devotional and member pages" with trees for `/aaradhane`, `/quotes`, `/stotras`, `/shlokas`, `/favorites` -> evidence: each page's import list in `.claude/state/inventory/M03.json` plus the cited line numbers.

**Checked and left alone** (confirmed against the code, no edit needed)

M03-F02 (`app/api/public/receipts/route.ts:6,28,39-44`, cap of 20 at `:67`), M03-F03 (`app/api/temple-areas/route.ts:14-31`, `[id]/route.ts:23,39`, `createAdminClient()` at `temple-areas.supabase.service.ts:98,129,159`), M03-F04, M03-F05, M03-F06, M03-F07, M03-F09, M03-F10, M03-F12, M03-F13, M03-F15 (all six dead/empty files verified to have no importer), M03-F16, M03-F18, M03-F23, M03-F24, M03-F25, M03-F26, M03-F27, M03-F28, M03-F29, M03-F30, M03-F31, M03-F32. The entry-point table's server/client column matches `hasUseClient` on all 24 page files. Coverage is genuinely 51/51: walking the chunk roots on disk returns exactly the 51 inventory paths, and every `fetch(` in the module hits an API route the brain already names.

**Gap-closure pass (2026-09-19)**

20. Data flow 1, step 4 quoted the client-minted booking reference as
    `SVA-${Date.now().toString(36)}`; the code also calls `.toUpperCase()`. Corrected to
    `SVA-${Date.now().toString(36).toUpperCase()}` and cited at `components/home/SevaBooking.tsx:152`,
    so a reader grepping for the literal now finds it. Reported by the cold-user QA in
    `.claude/state/verify/V1-skill-qa.md`.

## Refresh log (2026-10-18)

Delta for M03: 0 added, 0 deleted, 6 modified (`.claude/state/delta/2026-10-18/delta.json` perModule.M03).
Every modified file was diffed against the 2026-09-19 snapshot with `diff --strip-trailing-cr`.
Out-of-root files the faults cite were diffed too: all unchanged except `context/ProfileContext.tsx`
(+1 line) and `components/festival/FestivalExperience.tsx` (M05/M06, not cited by line).

**Changes, one line each (what was true -> what is true now -> evidence)**

1. `TempleExplorer.tsx` had no accessibility UI, 547 lines -> `AreaDetailPanel` has an "Accessibility Information" block, 590 lines -> `components/temple-explorer/TempleExplorer.tsx:461-500`, `types/temple-explorer.ts:6-12,28`; commit `11a532f`. Tree, Key files, Types, Data flow 5 step 4 and the "Add a temple-explorer area field" recipe updated.
2. Temple Explorer line citations -> fetch `:44`->`:46`, iframe `:181`->`:183`, `AreaCard` `:304`->`:306`, `AreaDetailPanel` `:374`->`:376`, `QuickInfoPanel` `:464`->`:507`, empty state `:199-207`/`:204`->`:201-209`/`:206` -> `grep -n` on the file.
3. Favorites, profile settings and Knowledge Centre citations all moved +1 -> a file-wide `/* eslint-disable */` was inserted at line 1 -> `favorites/page.tsx:108` guard, `:9-12` imports, `:30` `FavoriteItem`; `settings/page.tsx:33` guard, `:75` 5 MB check, `:25-29` seeding; `KnowledgeCentreClient.tsx:40,96,106,155,162,168,301,336,364,463,484`; commit `6408c1d`.
4. `ProfileContext.tsx:165/:170` -> `:166/:171` -> same eslint-disable insertion in `context/ProfileContext.tsx:1`.
5. Key files line counts: favorites 281->282, settings 299->300, KnowledgeCentreClient 500->501, TempleExplorer 547->590 -> line count of each file today.
6. `/display` and `/quotes` changed only cosmetically (`'` -> `&apos;`, `"` -> `&quot;` for `react/no-unescaped-entities`) -> no claim affected, no line moved -> `display/page.tsx:267,383`, `quotes/page.tsx:191,256`.
7. `/display` Key files note said "6 timers" (contradicting the corrected tree) -> "8 `useEffect`s, 3 intervals" -> Verification log item 4 already established this; the Key files row had been missed.
8. "There is no root `middleware.ts`" (three places) -> still true, but the Next 16 equivalent `proxy.ts` exists and does not redirect -> `proxy.ts:84,94-95`. Pre-existing omission (the file is unchanged since the snapshot), corrected now.
9. `quote.service.ts` had 19 importers including `lib/ai/generator.ts` -> 18; generator no longer imports it -> repo grep; commit `356de70`.
10. Supabase `sevas` had web readers only -> also read by `apps/mobile` -> `apps/mobile/lib/api.ts:3`, `apps/mobile/app/sevas/[id].tsx:22`; Stores table and Portability notes updated.
11. Faults table gained a "Status 2026-10-18" column: 29 STILL OPEN, 5 MOVED (F11, F19, F28, F31, F34 - evidence lines shifted, faults unchanged), 0 FIXED. Every STILL OPEN row's evidence lines were confirmed unmoved; the evidence files are byte-identical to the snapshot except `quotes/page.tsx` (F05) and `display/page.tsx` (F17), which changed only by in-line entity escaping (item 6).
12. Added M03-F35 (accessibility UI never fed), M03-F36 (blanket eslint-disable), M03-F37 (mobile reads Supabase while web writes Firestore).
13. Answers questions about: three topics added (accessibility, `apps/mobile`, eslint-disable).
14. Re-checked and unchanged: Breadcrumb importers (same set as the snapshot), `sevaBooking` 11, `pooja` 6, `donation` 8, `profile` 1, `temple-areas` 4 importers, `data/calendar.ts` 10 readers; `any` count still 23 across the 51 files; 25 files under `app/(public)` contain `<main`; 29 Navbar importers; `app/api` still has 23 directories and no `calendar`.

15. Path check by script (every backticked or bare repo path, 391 + 95 citations): 0 broken. The paths that do not resolve are deliberately absent or not file paths: `app/(public)/ai/page.tsx`, `app/api/calendar/` and `app/api/calendar/route.ts` (described as missing), `app/(public)/bhajans/page.tsx` (hypothetical recipe), `services/*.ts` (glob), and import specifiers `lib/festival-utils`, `types/profile`, `types/seva-booking`, `lib/sevas.getSevas()`.

**Commits that drove the changes:** `11a532f` (2026-10-06, temple-explorer accessibility), `6408c1d` (2026-10-03, CI baseline - eslint-disable and entity escaping), `0cb71b6` / `5813fc9` (2026-09-30, `apps/mobile`), `356de70` (2026-09-19, generator stopped importing quote.service).

**UNCLEAR**

- Whether `11a532f` meant accessibility to come from a future Supabase column or from the bundled defaults. The commit touched only the type and the UI; no migration or admin form. Settled by the author or the AI-004 ticket.
- Whether `mobileConsumesThisModule` should count a shared Supabase table. Recorded as yes (it reads the seva catalogue this module's `seva.service.ts` serves), but no code or route of this module is imported.

## Verification log (2026-10-18)

Skeptic pass over the 2026-10-18 refresh at HEAD `3d6aa9d` (a docs-only commit on top of `424fdb8`; no application file differs). 169 unique paths / 517 citations checked, 0 broken; 33 claims sampled (26 confirmed, 7 refuted); all 37 refreshed fault rows re-opened; report at `.claude/state/verify/M03-2026-10-18.md`. Changes, one line each:

1. Stores table, Firebase Storage row still said `profile-images/{uid}` although the 2026-09-19 log (item 1) claimed it was fixed -> now `profiles/{uid}/{timestamp}.{ext}` -> `services/profile.service.ts:216`.
2. Stores table, Firestore `sevas` "written by `sevaService.create/update/delete` (admin)" -> those methods have no caller; the writer is `/api/admin/receipt-sevas` (POST `route.ts:75`, PUT `[id]/route.ts:55`) from `app/admin/receipts/seva-settings/page.tsx:102,105`; the receipt book also reads it -> repo grep for `createSeva|updateSeva|deleteSeva|sevaService.`; `lib/receipt/admin.ts:32`.
3. Stores table, Supabase `sevas` "written by -" -> only by one-off migration scripts -> `scripts/migrate-sevas.ts:115`, `scripts/seed-supabase-sevas.ts:150`.
4. Key files `seva.service.ts` note, M03-F25 and M03-F37 relied on the uncalled `sevaService` write methods -> now cite the live receipt-seva writer (and `components/admin/pooja/CreatePooja.tsx:85` for `dailyPoojas`) -> same evidence as item 2. Faults unchanged in substance.
5. Data flow 5 and M03-F35 said the `TEMPLE_AREAS` defaults are read by nothing -> the running app never reads them, but `scripts/seed-temple-areas-supabase.ts:43` and `scripts/seed-temple-areas.ts:35` do -> repo grep for `TEMPLE_AREAS`.
6. Data flow 5 and M03-F35 cited one migration -> two migrations create `temple_areas` (`20240523000000_...` UUID id, `20240915_...` TEXT id with `image_url`/`has360_view`); neither has `accessibility` -> `supabase/migrations/20240915_create_temple_areas.sql:1-18`.
7. Recipe "Add a temple-explorer area field" stopped at four steps -> step 5 added (admin form `app/admin/temple-areas/page.tsx`, seed script) plus the two-migration caveat -> `app/admin/temple-areas/page.tsx:313,331`, `scripts/seed-temple-areas-supabase.ts:45-55`.
8. Refresh log item 11 said every STILL OPEN evidence file was unchanged -> `quotes/page.tsx` (F05) and `display/page.tsx` (F17) changed in-line (entity escaping); no cited line moved -> `diff --strip-trailing-cr` against the snapshot.
9. Added M03-F38 (LOW): `11a532f` makes the Supabase temple-areas seed send an `accessibility` key the table lacks, so 4 of 11 default areas fail to seed -> `scripts/seed-temple-areas-supabase.ts:45,54,57`, `types/temple-explorer.ts:94,183,207,251`.

Checked and left alone: the TempleExplorer line map (`:46,:183,:201-209,:306,:376,:461-500,:507`), the +1 shifts in favorites/settings/KnowledgeCentreClient/ProfileContext, line counts (split-on-newline convention, same as 2026-09-19), `proxy.ts:84,94-95`, 18 `quote.service` importers, `356de70`/`6408c1d`/`11a532f`/`0cb71b6`/`5813fc9` dates and contents, the `apps/mobile` reads (it also calls `/api/chat`, M08 - not this module), 23 `any`, 25 `<main` files, 29 Navbar importers, 23 `app/api` dirs, 51/51 coverage, and M03-F01..F37 evidence.
