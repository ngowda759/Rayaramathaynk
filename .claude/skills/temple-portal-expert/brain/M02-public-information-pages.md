# M02 - Public site - home and information pages
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs. Verify against the code before acting on any claim.

## Answers questions about

- "What is on the home page and in what order?" - the exact section sequence lives in one file, `components/home/HomeClient.tsx`.
- "Where does the hero title / temple-open status / hero stats come from?" - Firestore `homepage/config` via `hooks/useHomepage.ts`.
- "Why does the whole public site render blank until JS loads?" - almost every public page is `"use client"`; see Faults M02-F01.
- "Which public pages are Server Components?" - only three; everything else is a client page.
- "Where is the announcement marquee / scrolling red bar defined?"
- "How do events get listed and where do they actually come from?" - Supabase `events`, not Firestore, via `services/event.service.ts`.
- "Why does `/events/<id>` crash?" - `event.startDate.toDate()` on a Supabase ISO string.
- "How does the gallery work and where do the videos come from?" - local `public/images/temple` + a client-side Vercel Blob `list()` that cannot work in the browser.
- "How does search work end to end?" - `/search` page -> `/api/search` -> `services/search.service.ts` -> knowledge + events + gallery.
- "Why does the Events filter on /search always return nothing?" - type-id mismatch (`events` vs `event`).
- "How are search results scored and ordered?" - Data flow 7, *Search ranking*: the per-type integer bonuses, why knowledge and FAQ rows outrank events, and the uncapped category-filter branch.
- "What is `/pages/settings` and does anything link to it?" - Entry points: a localStorage-only device-settings page with no inbound link anywhere.
- "How do recommendations on the home page get chosen?" - `/api/recommendations` -> `services/recommendation.service.ts` -> festivals + gurus + knowledge.
- "Where do testimonials come from and how does a devotee submit one?"
- "Which components use framer-motion and how heavily?" - 27 files import it; 99 `<motion.*>` elements across 25 files plus 11 `<AnimatePresence>` in 6; matters for React Native.
- "What card / hero / section-header / spacing / type styles are actually used?" - the visual inventory section.
- "Which pages are dead, orphaned or duplicated?" - `/live`, `/journey`, `/timeline`, `/volunteer`, `/search`, `/pages/notifications`, `/pages/settings` carry no Navbar/Footer link; only `/search`, `/pages/notifications` and `/pages/settings` have no inbound link anywhere (the rest are deep-linked by Raya AI, `lib/ai/actions/actionRegistry.ts:102-106`).
- "Which components in `components/home` are imported by nothing?"
- "Where is temple address / phone / map coordinates hardcoded?" - `components/home/TempleMap.tsx`.
- "Which public pages write directly to Firestore from the browser?"
- "Where is the daily Panchanga on the home page read from?" - static `public/data/panchanga/current.json`.
- "Which public page has SEO metadata?" - none of them.
- "What does the `(public)` layout actually do?" - page-view tracking + a go-up button, nothing else.
- "Where would a React Native client get this module's data?" - portability section.

## Purpose and business role

M02 is the public face of the Sri Raghavendra Swamy Matha (Rayaramatha) portal: everything an
unauthenticated devotee sees before they book a seva or donate. It carries the home page (hero,
daily spiritual dashboard, panchanga, map, upcoming events, recommendations, gallery preview,
testimonials, social bar), the institutional/"about the Matha" pages (about, trust committee,
guru parampara, journey, timeline, facilities, future plans), the participation pages
(testimonials + submission, volunteer sign-up), and the browse/discovery surfaces (events list and
detail, gallery, global search, live darshan).

Editorially it is a hybrid: some content is CMS-driven (Firestore `homepage/config` and four
`settings/*` documents an admin edits in M05/M06), some is Supabase-backed (events), some is
checked-in TypeScript constants (guru biographies, timeline entries, journey phases, volunteer
service list), and some is outright placeholder data shipped to production (the live-darshan page
and the default testimonials). The module is the single largest concentration of animation and
visual styling in the repository and is therefore the primary subject of the UI redesign.

## Code roots

From `.claude/state/chunks.json` (id M02):

```
app/(public)/layout.tsx          app/(public)/page.tsx
app/(public)/about               app/(public)/trust           app/(public)/guruparampara
app/(public)/journey             app/(public)/timeline        app/(public)/facilities
app/(public)/future-plans        app/(public)/testimonials    app/(public)/volunteer
app/(public)/live                app/(public)/gallery         app/(public)/events
app/(public)/search              app/(public)/notifications   app/(public)/pages
components/home                  components/events            components/guru
components/search                components/festival          components/recommendation
hooks/useHomepage.ts             hooks/useGallery.ts          hooks/useInViewAnimation.ts
services/homepage.service.ts     services/gallery.service.ts  services/event.service.ts
services/testimonial.service.ts  services/volunteer.service.ts services/search.service.ts
services/recommendation.service.ts services/content.service.ts services/announcement.service.ts
```

**Adopted from the Unassigned list:** `components/analytics/PageViewTracker.tsx` - it is rendered by
`app/(public)/layout.tsx:11` and by nothing else in this repository, so it is documented here.

## Entry points

| Route | File | Server/Client | Auth | What it renders / does |
|---|---|---|---|---|
| `(public)` layout | `app/(public)/layout.tsx` | server | none | `<PageViewTracker/>`, `<main id="main-content" tabIndex={-1}>`, `<GoUpButton/>`. No Navbar/Footer - every page supplies its own. |
| `/` | `app/(public)/page.tsx` | **server** (`revalidate = 60`) | none | Reads temple images off disk (`lib/gallery.getTempleGalleryImages`) and `dailySpiritualService.getDashboardData()`, then hands both to the client tree `HomeClient`. |
| `/about` | `app/(public)/about/page.tsx` | client | none | 7 CMS sections read from Firestore `settings/aboutUs` (`:112`), defaults baked in. |
| `/trust` | `app/(public)/trust/page.tsx` | client | none | Trust committee member cards from Firestore `settings/trustCommittee` (`:61`). |
| `/guruparampara` | `app/(public)/guruparampara/page.tsx` | **server** | none | Static hero + `<InteractiveGuruParampara/>` (client). Hero hardcodes "17 Gurus / 800+ Years" (`:45`,`:50`). |
| `/journey` | `app/(public)/journey/page.tsx` | client | none | Fully static "devotee journey" phases; no data source. |
| `/timeline` | `app/(public)/timeline/page.tsx` | client | none | Hardcoded `TIMELINE_EVENTS` (`:27`), category filter, fake 500 ms loader (`:192`). No Navbar/Footer. |
| `/facilities` | `app/(public)/facilities/page.tsx` | client | none | Facilities grid from Firestore `settings/facilities` (`:126`). |
| `/future-plans` | `app/(public)/future-plans/page.tsx` | client | none | Plans list from Firestore `settings/futurePlans` (`:108`). Emerald/teal palette - the only page that is not amber. |
| `/testimonials` | `app/(public)/testimonials/page.tsx` | client | none | Approved testimonials grid + modal + submission modal + a QR block. |
| `/testimonials/submit` | `app/(public)/testimonials/submit/page.tsx` | client | none | Thin wrapper around `TestimonialSubmissionForm`. |
| `/volunteer` | `app/(public)/volunteer/page.tsx` | client | none | Static service list + form -> `POST /api/volunteer` (`:43`). |
| `/live` | `app/(public)/live/page.tsx` | client | none | Live darshan tabs, no Navbar/Footer. **100% mock data** (`SAMPLE_STREAMS:37-94`, 5 streams, videoId `dQw4w9WgXcQ`). |
| `/gallery` | `app/(public)/gallery/page.tsx` | client | none | 7 hardcoded local images + Vercel Blob `list()` called from the browser (`:40`). |
| `/events` | `app/(public)/events/page.tsx` | **server** | none | Navbar + Breadcrumb + SectionHeading + `<EventGrid/>` (client, fetches). |
| `/events/[id]` | `app/(public)/events/[id]/page.tsx` | client | none | Event detail. Reads the id with `useParams()`, fetches on mount. Crashes at `:63`. |
| `/search` | `app/(public)/search/page.tsx` | client | none | Search box + type tabs + grouped results. No Navbar/Footer. Wrapped in `<Suspense>` for `useSearchParams`. |
| `/notifications` | `app/(public)/notifications/page.tsx` | client | soft (`useAuthContext():87`/`useProfile():88`) | Notification centre backed by **ProfileContext** preferences + scheduled local notifications. No Navbar/Footer. |
| `/pages/notifications` | `app/(public)/pages/notifications/page.tsx` | client | none | A *second* notification preferences page backed by **localStorage** (`STORAGE_KEY:100`). |
| `/pages/settings` | `app/(public)/pages/settings/page.tsx` | client | none | Device settings (nav app, calendar provider, reminder lead time) in localStorage (`:36`). Fully described below. |

**`/pages/settings` in full** (it was previously listed as an orphan with no description). A 338-line
client page, `DeviceSettingsPage` (`app/(public)/pages/settings/page.tsx:45`). It renders `Navbar`,
`Breadcrumb current="Device Settings"`, four cards and `Footer`:

1. **Device Information** (`:111-135`) - platform, and the other read-only fields from `useDevice()`.
2. **Device Capabilities** (`:140-182`) - six Supported / Not Supported rows driven by
   `useCapabilities()`: camera, GPS, share, notification, calendar, clipboard (`:147,153,159,165,171,177`).
3. **Preferences** (`:186-268`) - three `Select`s writing the page-local `DeviceSettings` interface
   (`:30-34`): `defaultNavigationApp` (google/apple/waze), `defaultCalendarProvider`
   (google/apple/outlook), `reminderMinutesBefore`.
4. **Notifications** (`:270-301`) - permission state from `useNotifications()` plus a *Request
   permission* button and the scheduled-reminder count.

Persistence is **localStorage only**: `STORAGE_KEY = "temple-device-settings"` (`:37`), read in the
`useState` initialiser (`:50-62`, the hydration risk in M02-F25) and written by `handleSave()`
(`:81`) behind a cosmetic 500 ms `setTimeout` before the success toast. Nothing is sent to Firestore
or Supabase, so the settings do not follow the devotee to another device - and nothing in the app
reads `"temple-device-settings"` back: `grep -rn "temple-device-settings" app components lib
services hooks` returns only this file.

**Nothing links to it.** `grep -rn "pages/settings" app components lib` returns no `href`, `push()`
or `redirect()` anywhere - it is one of the three genuinely unreferenced routes in M02-F12, and it
duplicates `/profile/settings` (M02-F13). The device hooks it consumes belong to **M13** - see
M13-F08 for the three competing device-settings stores, and M13-F06 for the barrel import at `:12`
that pulls the whole device widget set into this page's bundle.

Not an entry point but worth knowing: `components/festival/*` is rendered by `app/calendar/festivals/page.tsx`
(M14's route), and `components/home/SevaBooking|SevaReceipt|DonationForm|DonationCTA|TempleTimings`
are rendered by M03's `/sevas`, `/receipts`, `/donation`, `/pooja` routes.

## Component trees

### `/` home page

```
Home (server)  app/(public)/page.tsx
├─ lib/gallery.getTempleGalleryImages()          fs.readdirSync(public/images/temple)   [M01]
├─ dailySpiritualService.getDashboardData()      services/daily-spiritual.service.ts    [M03]
└─ HomeClient (client)  components/home/HomeClient.tsx
   ├─ PageTransition (client)  components/ui/PageTransition.tsx            [M01]
   ├─ Navbar (client)          components/layout/Navbar.tsx                [M01]
   ├─ AnnouncementBar (client) components/home/AnnouncementBar.tsx
   │  └─ announcementService.getActiveAnnouncements()  services/announcement.service.ts
   │     └─ Firestore  announcements  where isActive == true, orderBy createdAt desc
   │  └─ AnnouncementMarquee (client)  components/home/AnnouncementMarquee.tsx
   │     └─ inline <style> CSS @keyframes marquee (25 s loop)
   ├─ Hero (client)            components/home/Hero.tsx
   │  ├─ useHomepage()         hooks/useHomepage.ts -> Firestore homepage/config (onSnapshot)
   │  ├─ useReducedMotion()    hooks/useReducedMotion.ts                    [M01]
   │  ├─ FloatingParticles / FloatingDots  components/ui/FloatingParticles.tsx [M01]
   │  ├─ DeepaFlame x2 (canvas) components/ui/DeepaFlame.tsx                [M01]
   │  ├─ TempleButton x6       components/ui/TempleButton.tsx               [M01]
   │  └─ next/image (fill, priority) for homepage.heroImage || /images/Hero.jpg
   ├─ SacredDivider (client) variant="mandala"  components/home/SacredDivider.tsx
   ├─ DailySpiritualDashboard (client)  components/home/DailySpiritualDashboard.tsx
   │  ├─ FeaturedAnnouncementBanner (local fn :49)
   │  ├─ TempleStatusCard  (local fn :81)
   │  ├─ FeaturedEventWidget (local fn :178)
   │  └─ DailyQuoteWidget   (local fn :230 - NOT the file components/home/DailyQuoteWidget.tsx)
   ├─ SacredDivider variant="lotus"
   ├─ Panchanga (client)       components/home/Panchanga.tsx
   │  ├─ useHomepage()  -> homepage.panchanga  (CMS fallback values)
   │  ├─ fetch("/data/panchanga/current.json", {cache:"no-store"})  public/data/panchanga/current.json [M14]
   │  └─ useShare(), useNotifications()  lib/device                        [M13]
   ├─ SacredDivider variant="lotus"
   ├─ TempleMap (client)       components/home/TempleMap.tsx   (props defaulted, never passed)
   │  └─ <iframe> maps.google.com embed at hardcoded 13.0967,77.5846
   ├─ SacredDivider variant="mandala"
   ├─ UpcomingEvents (client)  components/home/UpcomingEvents.tsx
   │  └─ EventGrid limit={6} (client)  components/events/EventGrid.tsx
   │     ├─ eventService.getUpcomingEvents(6)  services/event.service.ts
   │     │  └─ Supabase table events  (createClient from lib/supabase/client)  [M11]
   │     └─ EventCard (client) x n  components/events/EventCard.tsx
   │        └─ useShare / useLocation / useNotifications  lib/device        [M13]
   ├─ SacredDivider variant="lotus"
   ├─ <section> RecommendationsSection (client)  components/recommendation/RecommendationsSection.tsx
   │  ├─ fetch("/api/recommendations")  -> services/recommendation.service.ts
   │  └─ RecommendationCard (client) x n  components/recommendation/RecommendationCard.tsx  (raw <img> :65)
   ├─ SacredDivider variant="mandala"
   ├─ GallerySection (NO "use client" but uses framer-motion)  components/home/GallerySection.tsx
   │  └─ GalleryPreviewClient (client)  components/home/GalleryPreviewClient.tsx
   │     └─ lightbox: next/image + document.body.style.overflow + keydown listener
   ├─ SacredDivider variant="om"
   ├─ Testimonials (client)    components/home/Testimonials.tsx
   │  ├─ getApprovedTestimonials()  services/testimonial.service.ts -> Firestore testimonials
   │  ├─ 6 s autoplay carousel (AnimatePresence, custom direction variants)
   │  └─ TestimonialSubmissionForm (client, modal)  components/home/TestimonialSubmissionForm.tsx
   ├─ SacredDivider variant="diya"
   ├─ SocialBar (client)       components/home/SocialBar.tsx
   │  └─ settingsService.getSocialLinks()  services/settings.service.ts     [M10]
   └─ Footer (client)          components/layout/Footer.tsx                [M01]
```

### `/events` and `/events/[id]`

```
EventsPage (server)  app/(public)/events/page.tsx
├─ Navbar [M01] · Breadcrumb components/calendar/Breadcrumb.tsx [M14] · SectionHeading [M01]
└─ EventGrid (client, no limit)  components/events/EventGrid.tsx
   ├─ eventService.getPublishedEvents()  -> Supabase events
   ├─ <select> upcoming|past filter (client state only; ignores ?filter= in the URL)
   └─ EventCard (client) x n  - Share / Calendar / Notify / Directions buttons, no image

EventDetailPage (client)  app/(public)/events/[id]/page.tsx
├─ useParams() -> id
├─ eventService.getEvent(id)  -> Supabase events where firestore_id = id
└─ hero + details card + description + donation CTA   (renders no Navbar or Footer)
```

### `/gallery`

```
GalleryPage (client)  app/(public)/gallery/page.tsx
├─ Navbar · Breadcrumb · Footer [M01/M14]
├─ LOCAL_IMAGES const (7 hardcoded /images/temple/*.jpg)      :21
├─ list({prefix:"gallery/videos/"}) from @vercel/blob         :40  (server-only SDK, called in browser)
└─ GalleryGrid (client)  components/home/FullGallery.tsx   (default export named GalleryGrid)
   ├─ type filter all|photos|videos + year filter
   ├─ next/image for photos, <iframe> YouTube embed or <video> for videos
   └─ SectionHeading [M01]
```

### `/search`

```
SearchPage (client)  app/(public)/search/page.tsx
└─ <Suspense> -> SearchContent (client)
   ├─ useSearchParams().get("q")
   ├─ fetch(`/api/search?q=..&types=<tab>&grouped=true`)   :77
   │  └─ app/api/search/route.ts [M12] -> searchAll()  services/search.service.ts
   │     ├─ knowledgeService.searchKnowledge()   lib/ai/knowledge  [M08]
   │     ├─ eventService.getEvents()             Supabase events
   │     └─ galleryService.getMedia()            Firestore galleryMedia (or DEFAULT_GALLERY_IMAGES)
   ├─ SEARCH_TYPES tabs: all|events|articles|quotes|stotras|gallery|pages   :29
   └─ result rows: raw <img> thumbnail + <a href>                          :250
```
`components/search/GlobalSearch.tsx` implements a far richer command-palette search (Cmd+K,
suggestions, click-outside, recent searches) and is **imported by nothing**.

### `/guruparampara`

```
GuruparamparaPage (server)  app/(public)/guruparampara/page.tsx
├─ Navbar · Breadcrumb · hero (hardcoded stats) · intro · closing block · Footer
└─ InteractiveGuruParampara (client)  components/guru/InteractiveGuruParampara.tsx
   ├─ GURU_BIOGRAPHIES (17 entries) from types/guru.ts        <- data living in a types file
   ├─ searchGurus / getMajorGurus / getFeaturedGurus  (also types/guru.ts)
   ├─ view modes: cards | timeline | list ; filter: all | major | minor | founder
   └─ local subcomponents: StatCard :234 · GuruCard :249 · TimelineItem :397 · ListItem :471
```

### CMS-backed static pages (one shape, four pages)

`/about`, `/trust`, `/facilities`, `/future-plans` all follow the identical shape and should be
refactored together:

```
Page (client)
├─ const defaultData = { ...full copy inlined... }
├─ useState(defaultData) + useState(loading=true)
├─ useEffect -> doc(db, "settings", "<key>") + getDoc     <- DIRECT Firestore, no service
├─ Navbar · Breadcrumb
├─ hero <section> (amber-700 -> orange-600 -> amber-900 gradient, Hero.jpg at opacity-10)
├─ n content <section>s, each: icon chip + h2 + prose/grid
├─ CTA <section> (gradient card, one button)
└─ Footer
```
Keys: about -> `settings/aboutUs`, trust -> `settings/trustCommittee`,
facilities -> `settings/facilities`, future-plans -> `settings/futurePlans`.

### The remaining nine routes (added by verification - no tree existed for these)

All nine are `"use client"`. Three of them render no site chrome at all.

```
TestimonialsPage (client)  app/(public)/testimonials/page.tsx
├─ Navbar · Breadcrumb · SacredDivider · Footer          [M01/M14 + this chunk]
├─ getApprovedTestimonials() + DEFAULT_TESTIMONIALS  services/testimonial.service.ts  :10
├─ next/image avatar grid -> detail modal (no role="dialog")
├─ TestimonialSubmissionForm (modal)  components/home/TestimonialSubmissionForm.tsx
└─ QR block :206 -> Link to /qr :217                      [M03]

TestimonialsSubmitPage (client)  app/(public)/testimonials/submit/page.tsx
└─ Navbar · Breadcrumb · SacredDivider · TestimonialSubmissionForm · Footer   (no data of its own)

VolunteerPage (client)  app/(public)/volunteer/page.tsx
├─ Navbar · Breadcrumb · Footer
├─ static `volunteerServices` list :13 + ui/{button,input,textarea}      [M01]
├─ react-hot-toast for feedback
└─ POST /api/volunteer :43 -> `submitVolunteerRequest()` services/chat.service.ts:206   [M12/M10]

LiveDarshanPage (client)  app/(public)/live/page.tsx     ← no Navbar, no Footer, no Breadcrumb
├─ SAMPLE_STREAMS :37-94 (hardcoded, 5 entries)
├─ setTimeout(500) fake loader :103
└─ tabs live|upcoming|past -> next/image thumbnails + YouTube embed

JourneyPage (client)  app/(public)/journey/page.tsx
└─ Navbar · Breadcrumb · SectionHeading [M01] · static phase cards · next/image · Footer   (no data source)

TimelinePage (client)  app/(public)/timeline/page.tsx    ← no Navbar, no Footer
├─ TIMELINE_EVENTS :28 (hardcoded) + CATEGORIES :175
├─ setTimeout(500) fake loader :192
└─ category filter -> vertical timeline rail + next/image

NotificationCenterPage (client)  app/(public)/notifications/page.tsx   ← no Navbar, no Footer
├─ useAuthContext() :87  [M04] · useProfile() :88  [M03] · useNotifications() lib/device  [M13]
├─ NOTIFICATION_TYPES :34 (static config) · CardSkeleton [M01]
└─ toggles -> updateNotificationPreferences() -> ProfileContext (Firestore profile doc)

NotificationPreferencesPage (client)  app/(public)/pages/notifications/page.tsx
└─ Navbar · Breadcrumb · ui/{button,switch} · useNotifications() [M13] · localStorage :101 · Footer

DeviceSettingsPage (client)  app/(public)/pages/settings/page.tsx
└─ Navbar · Breadcrumb · ui/{button,select} · useDevice/useCapabilities/useNotifications [M13] · localStorage :37 · Footer
```

### Festival components (rendered by M14's `/calendar/festivals`)

```
FestivalExperience (client)  components/festival/FestivalExperience.tsx
├─ FeaturedFestival (client)  components/festival/FeaturedFestival.tsx  (+ CountdownUnit :145)
├─ StatCard :78 / SeasonGrid :102 (local)
└─ FestivalGrid (client)  components/festival/FestivalGrid.tsx
   ├─ grid|list view + month filter ; StatBadge :190 ; FestivalListItem :200
   └─ FestivalCard (client)  components/festival/FestivalCard.tsx
Data: getAllFestivals() from lib/festival-utils.ts and types/festival.ts   [M14]
```

## Data flow

**1. Home page first paint**
1. Request hits `app/(public)/page.tsx` (server, ISR 60 s).
2. `getTempleGalleryImages()` (`lib/gallery.ts:21`) does `readdirSync(public/images/temple)` and returns `{image,title,size}[]`.
3. `dailySpiritualService.getDashboardData()` (M03) is awaited inside try/catch; on failure `dashboardData` stays `null` and the dashboard section renders nothing.
4. Both are serialised into `<HomeClient galleryImages dashboardData>`; from here the tree is client-only.
5. In the browser `Hero` mounts, `useHomepage()` sets defaults on a `setTimeout(0)` then opens an `onSnapshot` on `homepage/config`; until the snapshot arrives the hero shows a full-height spinner (`Hero.tsx:63`).
6. `AnnouncementBar` fires `getActiveAnnouncements()`; `Panchanga` fetches `/data/panchanga/current.json`; `UpcomingEvents -> EventGrid` calls Supabase; `RecommendationsSection` calls `/api/recommendations`; `Testimonials` calls Firestore; `SocialBar` calls `settingsService`. **Six independent client round-trips after hydration.**

**2. Events listing**
1. `EventGrid` mounts (`components/events/EventGrid.tsx:29`).
2. `eventService.getPublishedEvents()` (`services/event.service.ts:130`) -> `getEvents()` -> `supabase.from('events').select('*')` - **no filter, no limit; the whole table is downloaded** - then `mapSupabaseEventToTempleEvent` (`:21`) maps snake_case columns to the `TempleEvent` shape, filters `published !== false` and sorts by `startDate`.
3. `getUpcomingEvents(max)` additionally filters `endDate >= now` and `slice(0, max)`.
4. `EventGrid` filters *again* client-side by `startDate >= now` into upcoming/past.
5. `EventCard` renders; `toDate()` (`:15`) defensively handles string | number | Date | Firestore Timestamp.

**3. Event detail**
1. `app/(public)/events/[id]/page.tsx:20` calls `eventService.getEvent(id)` -> `supabase.from('events').select('*').eq('firestore_id', id).single()`.
2. `PGRST116` is mapped to `null` -> "Event Not Found" screen.
3. On success the component executes `const startDate = event.startDate.toDate();` (`:63`). `startDate` is an ISO **string** from Supabase, so this throws `TypeError: event.startDate.toDate is not a function`. See M02-F02.

**4. Testimonial submission**
1. Devotee opens the modal from `/testimonials` or `/testimonials/submit` -> `TestimonialSubmissionForm`.
2. Photo is read to a base64 data URL in the browser. (`generatePhotoFilename()` at `TestimonialSubmissionForm.tsx:14` looks like it names the file but is **never called** - see M02-F40.)
3. `submitTestimonial()` (`services/testimonial.service.ts:287`) builds `<sanitizedName>_<cleanPhone>.jpg` inline (`:306-309`) and uploads the base64 to Vercel Blob at `images/testimonials/<file>` (`:314`) via `storageService.uploadBase64Image` (M10), then calls `createTestimonial()`.
4. `createTestimonial()` (`:246`) `addDoc`s (`:277`) into Firestore `testimonials` with `approved:false, submittedBy:"public"` plus the devotee's **phone number**.
5. `createTestimonialNotification()` (`:346`) `addDoc`s an admin notification into Firestore `notifications` (`:361`).
6. An admin approves it in M06; `getApprovedTestimonials()` (`:134`) then returns it to `components/home/Testimonials.tsx` and `/testimonials`.

**5. Global search**
1. `/search` submits -> `fetch('/api/search?q=..&types=<tab>&grouped=true')`.
2. `app/api/search/route.ts:29` splits `types` into `SearchResultType[]` and calls `searchAll()`.
3. `searchAll()` (`services/search.service.ts:22`) fans out to `searchKnowledge` (`:34`), `searchEvents` (`:40`), `searchFestivals` (`:46`), `searchGallery` (`:52`), `searchFAQs` (`:58`), scores each match (title +20, description +10, category +15), sorts, caps at 20 (`:73`). There is **no** `searchGurus` or `searchAnnouncements` branch even though both are `SearchResultType`s - see M02-F38.
4. `groupResultsByType()` (`:357`) buckets into the seven `SearchResultType` keys.
5. The page renders one `<section>` per returned key. Five of the six non-"all" tab ids (`events`, `articles`, `quotes`, `stotras`, `pages`) do not exist as `SearchResultType`s, so those tabs produce zero rows; only `gallery` matches on both sides and works. See M02-F03.

**6. Recommendations**
1. `RecommendationsSection` mounts -> `fetch('/api/recommendations')` (`:38`), defaulting to `type=homepage`.
2. `getHomepageRecommendations()` (`services/recommendation.service.ts:444`) pushes: the next upcoming festival from `getAllFestivals()` (M14), the `raghavendra-teertha` biography from `GURU_BIOGRAPHIES`, and up to 4 knowledge articles from `knowledgeService` (M08).
3. `getUpcomingEvents()` inside the same service (`:226`) is a **stub that returns `[]`** with the comment "This would typically come from the event service" - so no real event ever appears in a recommendation.
4. Cards render with `reason` badges (`trending`, `popular`, ...).

**7. Search ranking** - how `services/search.service.ts` scores and orders what flow 5 returns.
There is no index and no search engine: every branch downloads its whole collection and scores in
memory with integer bonuses.

1. **Guard.** `searchAll()` returns `[]` for a query under 2 characters (`search.service.ts:27`).
   `maxResultsPerType` defaults to **3** (`:25`), and `app/api/search/route.ts:32` calls
   `searchAll(query, filters)` without a third argument - so the live cap is 3 per type.
2. **Per-type scoring.** Each branch lowercases the query once and compares with `includes()` -
   substring, not word, matching, so `"seva"` matches `"Sevakarta"`:
   - `searchEvents` (`:104`): `eventService.getEvents()`, keep rows whose title *or* description
     contains the query (`:113-119`), then title **+20**, description **+10** (`:122-124`).
   - `searchFestivals` (`:150`): the same `getEvents()` call again - a second full fetch - narrowed
     to `category === "festival"` or a title containing "utsav"/"festival" (`:158-163`), then the
     same +20 / +10 (`:175-177`).
   - `searchGallery` (`:203`): `galleryService.getMedia()`, then title **+20**, category **+15**,
     description **+10** (`:224-228`) - category outranks description here and nowhere else.
   - `searchKnowledge` (`:79`) and `searchFAQs` (`:255`): both delegate to
     `knowledgeService.searchKnowledge` -> `lib/ai/knowledge/repository.ts:168`, which splits the
     query into **words** and adds, per word, title **+10** (`:190`), content **+5** (`:198`) and
     keyword **+15** (`:207`), drops anything under **10** (`:221`) and passes its own
     `relevanceScore` and `matchedKeywords` straight through. `searchFAQs` re-runs that whole search
     and then filters `category === "faq"` (`:263`), so a query with no FAQ hit still pays for it,
     and any FAQ article appears **twice** - once as `knowledge`, once as `faq`, with the identical
     score.
3. **Sort.** All branches are concatenated and sorted once, descending on `relevanceScore`
   (`:64`) - see the caveat below.
4. **Category filter.** If `filters.categories` is non-empty the sorted list is filtered by
   `r.category?.includes(cat)` and **returned immediately** (`:67-71`), skipping step 5.
5. **Cap.** Otherwise the list is truncated to the first **20** results (`:73`).
6. **Grouping.** `groupResultsByType()` (`:357`) buckets the survivors into the seven
   `SearchResultType` keys for the page.

**Two caveats a reader needs.** (a) The scores are **not comparable across types**: an event scores
at most 30 from two substring tests, while a knowledge article accumulates 10/5/15 *per query word*
and routinely passes 50, so knowledge and FAQ rows dominate the merged list for any multi-word
query. (b) The category-filter branch at `:67` returns an **uncapped** list, so filtering by
category can return more rows than the unfiltered search does. Neither behaviour is a crash, so
neither shows up as a fault - but both change what a devotee sees first.

## Key files

| File | Lines | Role | Key exports | Notes |
|---|---:|---|---|---|
| `app/(public)/layout.tsx` | 19 | Public shell | `PublicLayout` | Server. Only tracker + go-up button; no chrome. |
| `app/(public)/page.tsx` | 30 | Home entry | `Home`, `revalidate` | The only ISR page in the chunk. |
| `app/(public)/about/page.tsx` | 380 | About the Matha | `AboutPage` | Direct Firestore `settings/aboutUs`. 7 sections. |
| `app/(public)/trust/page.tsx` | 223 | Trust committee | `TrustCommitteePage` | Direct Firestore `settings/trustCommittee`. Links to missing `/contact` (`:210`). |
| `app/(public)/guruparampara/page.tsx` | 113 | Lineage page | `GuruparamparaPage` | Server; hardcoded "17 / 800+" stats. |
| `app/(public)/journey/page.tsx` | 346 | Devotee journey | `JourneyPage` | Entirely static; unreachable from any nav. |
| `app/(public)/timeline/page.tsx` | 389 | Temple history | `TimelinePage` | Hardcoded events, fake loader, no Navbar/Footer, orphaned. |
| `app/(public)/facilities/page.tsx` | 284 | Facilities | `FacilitiesPage` | Direct Firestore `settings/facilities`. |
| `app/(public)/future-plans/page.tsx` | 246 | Roadmap | `FuturePlansPage` | Direct Firestore `settings/futurePlans`; emerald palette outlier. |
| `app/(public)/testimonials/page.tsx` | 323 | Testimonials | `TestimonialsPage` | Grid + detail modal + submit modal + QR block. |
| `app/(public)/testimonials/submit/page.tsx` | 76 | Submit alias | `TestimonialsSubmitPage` | Duplicates the modal path on `/testimonials`. |
| `app/(public)/volunteer/page.tsx` | 250 | Volunteer sign-up | `VolunteerPage` | `POST /api/volunteer`; orphaned from nav. |
| `app/(public)/live/page.tsx` | 440 | Live darshan | `LiveDarshanPage` | All mock; rickroll video id; orphaned. |
| `app/(public)/gallery/page.tsx` | 102 | Gallery | `GalleryPage` | Client-side `@vercel/blob` `list()`; hardcoded local images. Imports `DEFAULT_GALLERY_IMAGES` (`:9`) and never uses it - the catch path falls back to `LOCAL_IMAGES` only (`:67`). |
| `app/(public)/events/page.tsx` | 30 | Events list | `EventsPage` | Server shell around a client grid. |
| `app/(public)/events/[id]/page.tsx` | 186 | Event detail | `EventDetailPage` | `.toDate()` crash at `:63`; no Navbar/Footer. |
| `app/(public)/search/page.tsx` | 309 | Search | `SearchPage` | Broken type filters; raw `<img>`; no chrome. |
| `app/(public)/notifications/page.tsx` | 379 | Notification centre | `NotificationCenterPage` | Profile-backed; shared with M13. |
| `app/(public)/pages/notifications/page.tsx` | 291 | Notification prefs (dup) | `NotificationPreferencesPage` | localStorage-backed; shared with M13. |
| `app/(public)/pages/settings/page.tsx` | 339 | Device settings (dup) | `DeviceSettingsPage` | localStorage-backed; duplicates `/profile/settings`. |
| `components/home/HomeClient.tsx` | 89 | Home composition | `HomeClient` | The one file that defines home-page section order. |
| `components/home/Hero.tsx` | 372 | Hero | `Hero` | 13 `<motion.*>` nodes, canvas flames, hand-rolled scroll parallax (`:33-58`). |
| `components/home/AnnouncementBar.tsx` | 44 | Announcement fetch | `AnnouncementBar` | Returns `null` while loading -> layout shift. |
| `components/home/AnnouncementMarquee.tsx` | 67 | Marquee render | `AnnouncementMarquee` | Inline `<style>` keyframes; `#7A1024` is the only non-amber hex in the module. |
| `components/home/SacredDivider.tsx` | 102 | Section divider | `SacredDivider` | 4 variants; two rings spin forever (60 s / 45 s). |
| `components/home/DailySpiritualDashboard.tsx` | 352 | 3-card daily strip | `DailySpiritualDashboard` | Props-only; holds four local subcomponents. |
| `components/home/Panchanga.tsx` | 385 | Panchanga panel | `Panchanga` | Static JSON + CMS fallback; share/notify actions. |
| `components/home/TempleMap.tsx` | 132 | Map + address | `TempleMap` | Lat/lon/address/phone hardcoded as prop defaults (`:14-16`). |
| `components/home/UpcomingEvents.tsx` | 51 | Events band | `UpcomingEvents` | Wraps `EventGrid limit={6}`. |
| `components/home/GallerySection.tsx` | 86 | Gallery band | `GallerySection` | **Missing `"use client"`** while importing framer-motion. |
| `components/home/GalleryPreviewClient.tsx` | 243 | Lightbox grid | `GalleryPreviewClient` | 11 `<motion.*>` nodes; locks `document.body.style.overflow` (`:39`). |
| `components/home/FullGallery.tsx` | 181 | Full gallery grid | `GalleryGrid` | File name and export name disagree. |
| `components/home/Testimonials.tsx` | 335 | Carousel | `Testimonials` | 6 s autoplay, arrow-key nav, 8 `<motion.*>` nodes; links to `/testimonials` (`:294`) - the only inbound link that page has. |
| `components/home/TestimonialSubmissionForm.tsx` | 429 | Submit form | `TestimonialSubmissionForm` | Base64 photo, HTTPS check (`:82`), raw `<img>` preview (`:292`). |
| `components/home/SocialBar.tsx` | 100 | Social strip | `SocialBar` | Renders an empty 8-unit band until links load. |
| `components/home/SevaBooking.tsx` | 685 | Seva booking flow | `SevaBooking` | Largest file in the chunk; owned editorially by M03 (`/sevas`, `/receipts`). |
| `components/home/SevaReceipt.tsx` | 278 | Receipt/print | `SevaReceipt` | Prints by swapping `document.body.innerHTML` (`:95-100`). |
| `components/home/DonationForm.tsx` | 460 | Donation form | `DonationForm` | Used by M03 `/donation`; UPI deep links. |
| `components/home/DonationCTA.tsx` | 130 | Donation banner | `DonationCTA` | Used by M03 `/pooja`. |
| `components/home/TempleTimings.tsx` | 280 | Timings panel | `TempleTimings` | Used by M03 `/pooja`; reads `useHomepage()`. |
| `components/home/FeaturedSevas.tsx` | 9 | Server shim | `FeaturedSevas` | Reads `lib/sevas` at module scope; **imported by nothing**. |
| `components/home/FeaturedSevasClient.tsx` | 120 | Seva cards | `FeaturedSevasClient` | Only reachable through the dead shim. |
| `components/home/TempleInfo.tsx` | 307 | Contact/info block | `TempleInfo` | Dead. Hardcodes `TEMPLE_PHONE`. |
| `components/home/QuickServices.tsx` | 161 | 8-tile service grid | `QuickServices` | Dead. Two tiles point at the missing `/contact`. |
| `components/home/SocialConnect.tsx` | 118 | Social block | `SocialConnect`, `SocialIcons` | Dead; overlaps `SocialBar`. |
| `components/home/TempleGalleryPreview.tsx` | 77 | Gallery band (v1) | `TempleGalleryPreview` | Dead; near-duplicate of `GallerySection`. |
| `components/home/DailyQuoteWidget.tsx` | 265 | Quote card | `DailyQuoteWidget` | Dead; `DailySpiritualDashboard` has its own private copy. |
| `components/home/EventCountdown.tsx` | 147 | Countdown | `EventCountdown` | Dead; overlaps `FeaturedFestival`'s `CountdownUnit`. |
| `components/home/FloatingContact.tsx` | 125 | Floating FAB | `FloatingContact` | Dead; 8 `<motion.*>` nodes. |
| `components/events/EventGrid.tsx` | 123 | Event list | `EventGrid` | Two filter passes; `limit` changes the whole layout. |
| `components/events/EventCard.tsx` | 268 | Event card | `EventCard` | Share/Calendar/Notify/Directions; never renders `event.imageUrl`. |
| `components/guru/InteractiveGuruParampara.tsx` | 537 | Guru explorer | `InteractiveGuruParampara` | 3 view modes, search, filters; 8 `<motion.*>` nodes; data from `types/guru.ts`. |
| `components/search/GlobalSearch.tsx` | 351 | Command palette | `GlobalSearch` | Dead; the better search UI, unused. A **second** dead copy lives outside the chunk at `components/common/Search/GlobalSearch.tsx:71`, and its `router.push("/search")` (`:100`) is the only code in the repo that navigates to `/search`. |
| `components/festival/FestivalExperience.tsx` | 165 | Festival page body | `FestivalExperience` | Entered from M14's `/calendar/festivals`. |
| `components/festival/FeaturedFestival.tsx` | 157 | Hero festival | `FeaturedFestival` | Countdown. |
| `components/festival/FestivalGrid.tsx` | 240 | Festival grid/list | `FestivalGrid` | Month filter, view toggle. |
| `components/festival/FestivalCard.tsx` | 95 | Festival card | `FestivalCard` | |
| `components/recommendation/RecommendationsSection.tsx` | 208 | Recs band | `RecommendationsSection` | `grid`/`list`/`carousel` variants; skeleton + empty state. |
| `components/recommendation/RecommendationCard.tsx` | 106 | Rec card | `RecommendationCard` | Raw `<img>` (`:65`). |
| `hooks/useHomepage.ts` | 77 | CMS config hook | `useHomepage` | Live `onSnapshot` on `homepage/config` (`:35-36`); 3 consumers in this chunk (`Hero`, `Panchanga`, `TempleTimings`) + `components/admin/settings/homepage/HomepageForm.tsx` in M05. |
| `hooks/useGallery.ts` | 77 | Gallery listener | `useGallery` | Dead; `onSnapshot` on `galleryMedia`. |
| `hooks/useInViewAnimation.ts` | 105 | Scroll hooks | `useInViewAnimation`, `useScrollProgress`, `useParallax` | Dead; `Hero` re-implements the same logic inline. |
| `services/homepage.service.ts` | 171 | Homepage CMS | `homepageService` | `getHomepage`, `saveHomepage`, `getDefaultConfig` (83 lines of defaults). |
| `services/announcement.service.ts` | 85 | Announcements CRUD | `announcementService` | Firestore `announcements`. |
| `services/event.service.ts` | 154 | Events repo | `eventService` | **Supabase**, not Firestore. Module-scope `createClient()` (`:4`). |
| `services/gallery.service.ts` | 259 | Gallery repo | `galleryService`, `DEFAULT_GALLERY_IMAGES` | Firestore `galleryAlbums`/`galleryMedia`; 5 alias methods (`getImages`, `createImage`, ...). |
| `services/testimonial.service.ts` | 467 | Testimonials repo | 11 named exports | Browser-only (`getFirebaseDb` returns `null` when `window` is undefined, `:12`). |
| `services/volunteer.service.ts` | 127 | Members/volunteers master data | `memberService`, `volunteerService` | **Not** used by `/volunteer`; only by admin seva pages. |
| `services/search.service.ts` | 410 | Search engine | 5 named exports | Naive `includes()` scoring; `highlightKeywords` builds an unescaped RegExp (`:389`). |
| `services/recommendation.service.ts` | 497 | Recommendations | 3 named exports | Event pool stubbed to `[]` (`:226`). |
| `services/content.service.ts` | 371 | AI content tooling | 8 named exports | Belongs to the Raya AI knowledge domain, not to these pages; only consumer is `app/api/admin/content/route.ts`. |
| `components/analytics/PageViewTracker.tsx` | 54 | Page-view beacon | `PageViewTracker` | *Adopted.* `trackPageView()` on every route change -> `page_views` (~47k docs, see RULES quota note). |

## Types and stores

**Types consumed**

| Type module | Used for |
|---|---|
| `types/homepage.ts` | `HomepageConfig`, `Testimonial` |
| `types/announcement.ts` | `Announcement`, `AnnouncementRequest` |
| `types/event.ts` | `TempleEvent` - declares `startDate: Timestamp` (firebase) although the data is a Supabase string |
| `types/gallery.ts` | `GalleryAlbum`, `GalleryMedia`, `GalleryMediaRequest` |
| `types/volunteer.ts` | `Member`, `Volunteer` (+ request shapes) |
| `types/search.ts` | `SearchResult`, `SearchResultType`, `SearchFilters`, `SearchSuggestion`, `SEARCH_TYPE_CONFIG` |
| `types/recommendation.ts` | `RecommendationItem`, `RecommendationType`, `UserBehavior`, `DEFAULT_RECOMMENDATION_CONFIG` |
| `types/guru.ts` | `GuruBiography` **and 17 rows of content data** plus `getGuruById`/`getFeaturedGurus`/`getMajorGurus`/`searchGurus` |
| `types/festival.ts` | `Festival`, `getFeaturedFestival`, `MONTH_NAMES` |
| `types/daily-spiritual.ts` | `DailySpiritualDashboard` payload |
| `types/quote.ts` | `Quote` (dead `DailyQuoteWidget`) |
| `lib/ai/knowledge/types` | `KnowledgeArticle`, `KnowledgeCategory` (content.service) |

**Stores touched**

| Store | Path / table | R | W | Where |
|---|---|:-:|:-:|---|
| Firestore | `homepage/config` | R | W | `services/homepage.service.ts`, `hooks/useHomepage.ts` (onSnapshot) |
| Firestore | `announcements` | R | W | `services/announcement.service.ts` (writes only from admin) |
| Firestore | `settings/aboutUs` | R | - | `app/(public)/about/page.tsx:112` (direct) |
| Firestore | `settings/trustCommittee` | R | - | `app/(public)/trust/page.tsx:61` (direct) |
| Firestore | `settings/facilities` | R | - | `app/(public)/facilities/page.tsx:126` (direct) |
| Firestore | `settings/futurePlans` | R | - | `app/(public)/future-plans/page.tsx:108` (direct) |
| Firestore | `galleryAlbums`, `galleryMedia` | R | W | `services/gallery.service.ts`, `hooks/useGallery.ts` |
| Firestore | `testimonials` | R | W | `services/testimonial.service.ts:5` (`TESTIMONIALS_COLLECTION`) - **public browser writes** |
| Firestore | `notifications` | - | W | `services/testimonial.service.ts:361` - admin alert written by the public submission path |
| Firestore | `members`, `volunteers` | R | W | `services/volunteer.service.ts` (admin only) |
| Firestore | `page_views` | - | W | `components/analytics/PageViewTracker.tsx` via `services/pageviews.service` |
| Supabase | `events` | R | W | `services/event.service.ts` (key `firestore_id`, snake_case columns) |
| Vercel Blob | `gallery/videos/*` | R | - | `app/(public)/gallery/page.tsx:40` |
| Vercel Blob | `images/testimonials/*` | - | W | `services/testimonial.service.ts:314` via `storage.service` |
| Static file | `public/data/panchanga/current.json` | R | - | `components/home/Panchanga.tsx:69` |
| Filesystem | `public/images/temple/*` | R | - | `lib/gallery.ts:22` (`readdirSync` at request time) |
| localStorage | `temple-notification-preferences`, `temple-device-settings` | R | W | `app/(public)/pages/notifications/page.tsx:101`, `app/(public)/pages/settings/page.tsx:37` |

## Cross-module dependencies

**This module imports from**

| Chunk | What |
|---|---|
| M01 (shell / UI kit) | `components/layout/Navbar`, `components/layout/Footer`, `components/ui/{TempleButton,button,input,textarea,select,switch,PageTransition,DeepaFlame,FloatingParticles,GoUpButton}`, `components/common/{SectionHeading,SkeletonLoader}`, `hooks/useReducedMotion`, `lib/gallery`, `lib/sevas` |
| M03 (bookings / member) | `services/daily-spiritual.service`, `services/seva.service`, `services/sevaBooking.service`, `services/donation.service`, `hooks/useFinanceSettings`, `hooks/useAuth`, `context/ProfileContext` |
| M04 (auth) | `context/AuthContext` (notification centre) |
| M08 (Raya AI) | `services/knowledge.service` (search + recommendations), `lib/ai/knowledge/types` (content.service) |
| M10 (service layer) | `services/settings.service`, `services/storage.service`, `services/pageviews.service`, `services/chat.service` (through `/api/volunteer`) |
| M11 (persistence) | `lib/firebase`, `lib/supabase/client` |
| M12 (API routes) | `/api/search`, `/api/search/suggestions`, `/api/recommendations`, `/api/volunteer`, `/api/quotes/today` |
| M13 (device) | `lib/device` - `useShare`, `useLocation`, `useNotifications`, `useDevice`, `useCapabilities` |
| M14 (domain engines) | `lib/festival-utils`, `types/festival`, `components/calendar/Breadcrumb`, `public/data/panchanga/*` |

**Who imports this module**

| Importer | What it takes |
|---|---|
| M03 `app/(public)/sevas`, `/receipts` | `components/home/SevaBooking`, `SevaReceipt` |
| M03 `app/(public)/donation` | `components/home/DonationForm` |
| M03 `app/(public)/pooja` | `components/home/DonationCTA`, `TempleTimings` |
| M03 `app/(public)/favorites`, `/display` | `services/gallery.service`, `services/event.service` |
| M03 `app/(public)/qr` | `components/home/SacredDivider` |
| M06 admin gallery/events/announcements/testimonials | `services/{gallery,event,announcement,testimonial}.service` |
| M07 admin sevas | `services/volunteer.service` |
| M09 `app/admin/assistant` | `services/gallery.service`, `services/event.service` |
| M12 `app/api/{events,announcements,search,recommendations}` | the matching services |
| M14 `app/calendar/festivals` | `components/festival/FestivalExperience` |
| M05 `components/admin/settings/homepage/useHomepageForm.ts` | `services/homepage.service` |
| M10 `services/quote.service`, `services/search.service` | `services/event.service` |

## How to change it

**Add a section to the home page**
1. Create `components/home/<Name>.tsx` with `"use client"` at the top (the whole home tree is client).
2. Import it in `components/home/HomeClient.tsx` and place it between two `<SacredDivider/>` calls - order in that file *is* the page order.
3. If it needs server data, fetch in `app/(public)/page.tsx` and pass it down as a prop (the pattern used by `dashboardData`); do not add a seventh client round-trip.
4. Match the band contract: `<section className="... py-24">` > `<div className="mx-auto max-w-7xl px-6">` > pill badge + `text-5xl` h2 + `text-lg` subtitle.

**Add a new CMS-backed information page (about/trust/facilities/future-plans family)**
1. Add the Firestore document under `settings/<key>` and its admin editor in M05/M06.
2. Copy `app/(public)/facilities/page.tsx` as the closest template; keep the inline `defaultData` so the page renders with Firebase off.
3. **Preferred fix while you are there:** add a `get<Key>()` method to a service instead of calling `doc(db, ...)` in the page - the current four pages violate AGENTS.md.
4. Add the route to `NAV` in `components/layout/Navbar.tsx` (around `:33`) and to `quickLinks` in `components/layout/Footer.tsx` (`:37`), or the page will be orphaned like `/journey`.
5. Add `export const metadata` - no public page has any today.

**Add a field to the homepage CMS config (e.g. a new hero stat)**
1. `types/homepage.ts` - add the field to `HomepageConfig`.
2. `services/homepage.service.ts:84` - add a default inside `getDefaultConfig()`; anything missing there is `undefined` in every consumer.
3. `components/admin/settings/homepage/useHomepageForm.ts` (M05) - add the form control.
4. Consume it in `components/home/Hero.tsx` / `Panchanga.tsx` / `TempleTimings.tsx` via `useHomepage()`; always with a `??` fallback.

**Add a field to an event**
1. Supabase migration for the `events` table (M11), snake_case column.
2. `types/event.ts` - add the camelCase field.
3. `services/event.service.ts` - `mapSupabaseEventToTempleEvent` (`:21`), `addEvent` (`:70`) and the `updateEvent` whitelist (`:98-112`) each need a line; forgetting the whitelist silently drops updates.
4. Render it in `components/events/EventCard.tsx` and `app/(public)/events/[id]/page.tsx`.
5. Update the admin form in M06.

**Add a searchable content type**
1. `types/search.ts` - add the id to `SearchResultType` and a `SEARCH_TYPE_CONFIG` entry.
2. `services/search.service.ts` - write a `search<Type>()` helper, call it from `searchAll()` (`:22`), add the key to the `grouped` object in `groupResultsByType()` (`:357`) and a case in `getCategoryUrl()` (`:333`).
3. `app/(public)/search/page.tsx:29` - add the tab **using the same id string** as the `SearchResultType`, not a plural variant.

**Retire a dead component safely**
1. Confirm with `.claude/state/inventory/import-graph.json` that nothing imports it.
2. Check the live twin first: `TempleGalleryPreview` -> `GallerySection`, `SocialConnect` -> `SocialBar`, `DailyQuoteWidget` -> the private copy in `DailySpiritualDashboard`, `GlobalSearch` -> `/search`. Move any better behaviour across before deleting.

**Change the visual language of a band**
1. There are no shared card/section primitives in this module - each band re-declares its own classes. Introduce `components/ui/Section.tsx` and `components/ui/Card.tsx` first, then migrate band by band starting with `GallerySection`, `UpcomingEvents` and `Testimonials`, which share an identical header block.

## Faults, smells and risks

| id | Sev | What | Evidence | Direction |
|---|---|---|---|---|
| M02-F01 | HIGH | The entire public site is client-rendered. `app/(public)/page.tsx:25` renders `HomeClient`, which is `"use client"`; 16 of the 20 files under `app/(public)` in this chunk start with `"use client"` - only the layout, `/`, `/guruparampara` and `/events` are server files, and three of those four immediately hand off to a client subtree. ARCHITECTURE.md:137 documents "Server Component -> Service Layer -> Firestore -> Render HTML" and AGENTS.md mandates Server Components first. | `components/home/HomeClient.tsx:1`; 16/20 files carry `hasUseClient` in `.claude/state/inventory/M02.json`, confirmed by `head -1` on each | Push data fetching into the server pages and keep only interactive leaves as client components. |
| M02-F02 | HIGH | Event detail page crashes for every event. `event.startDate` arrives from Supabase as an ISO string but the page calls the Firestore `Timestamp` API on it. | `app/(public)/events/[id]/page.tsx:63` (`event.startDate.toDate()`) vs `services/event.service.ts:26` (`startDate: event.start_date`) | Use the existing `toDate()` helper from `components/events/EventGrid.tsx:15` and fix `types/event.ts:18`. |
| M02-F03 | HIGH | Five of the six search type filters return nothing. The UI sends `types=events\|articles\|quotes\|stotras\|pages`; `SearchResultType` is `knowledge\|guru\|event\|festival\|gallery\|faq\|announcement`, and `searchAll` only runs a branch when `filters.types.includes(<service id>)`. Only `gallery` is spelled the same on both sides and works. The grouped result keys also never match `SEARCH_TYPES`, so headings fall back to the raw key. | `app/(public)/search/page.tsx:29` and `:77` vs `types/search.ts:6-13`, `services/search.service.ts:34-61` and `:357` | Single source of truth: derive the tabs from `SEARCH_TYPE_CONFIG`. |
| M02-F04 | HIGH | `@vercel/blob`'s `list()` - a server SDK needing `BLOB_READ_WRITE_TOKEN` - is called from a `"use client"` page. It either throws (so gallery videos never appear and the page silently falls back to 7 local images) or the write-capable token has been exposed to the browser. | `app/(public)/gallery/page.tsx:1` + `:40`; token declared in `.env.example:20` | Move the listing into a route handler (`app/api/gallery/videos`) and fetch that. |
| M02-F05 | HIGH | `GET /api/volunteer` returns every volunteer request - names, phone numbers, e-mail addresses - with no authentication. The public `/volunteer` form feeds it. | `app/api/volunteer/route.ts:58-68`; submitted from `app/(public)/volunteer/page.tsx:43` | Require an admin session, or move the read to `/api/admin/*`. |
| M02-F06 | HIGH | Unauthenticated browser writes to Firestore. `submitTestimonial` writes name, location, quote **and phone number** straight from the client with no server-side validation, rate limit or captcha. | `services/testimonial.service.ts:287` -> `:246` (`addDoc`) | Route through a server action / API route with validation and throttling; revisit the `testimonials` security rule (M04). |
| M02-F07 | HIGH | `/live` ships placeholder content to production: five invented streams, all pointing at YouTube id `dQw4w9WgXcQ`, with invented view counts, presented as real temple broadcasts. Raya AI deep-links to it (`lib/ai/actions/actionRegistry.ts:102`, `:249`), so devotees do reach it. | `app/(public)/live/page.tsx:37-94` (5 `id:` entries) | Back it with real data or remove the route. |
| M02-F08 | HIGH | Zero per-route SEO metadata. No `export const metadata` or `generateMetadata` anywhere under `app/(public)`, on a site whose whole purpose is public discovery; every page inherits the single global block in `app/layout.tsx:31`, so all 20 routes share one title and description. | `grep -rn "export const metadata\|generateMetadata" "app/(public)/"` returns nothing; `app/layout.tsx:31` | Convert the content pages to Server Components and add per-route metadata + OpenGraph. |
| M02-F09 | HIGH | Four public pages call Firestore directly, violating AGENTS.md "No Direct Firebase Calls - use services only" and ARCHITECTURE.md:100. | `app/(public)/about/page.tsx:112`, `trust/page.tsx:61`, `facilities/page.tsx:126`, `future-plans/page.tsx:108` | One `settingsContentService` with four typed getters. |
| M02-F10 | MEDIUM | Persistence is split: events live in Supabase while announcements, gallery, testimonials and homepage config live in Firestore, with no documented boundary. `types/event.ts:18` still types the columns as firebase `Timestamp`. | `services/event.service.ts:2-4` vs `services/gallery.service.ts:2` | Decide the target store per entity and record it in DATA-MODEL.md; retype `TempleEvent` dates as `string`. |
| M02-F11 | MEDIUM | 11 dead modules in this chunk - imported by nothing: `DailyQuoteWidget`, `EventCountdown`, `FeaturedSevas` (+ its client half), `FloatingContact`, `QuickServices`, `SocialConnect`, `TempleGalleryPreview`, `TempleInfo`, `GlobalSearch`, `hooks/useGallery.ts`, `hooks/useInViewAnimation.ts` - about 1,800 lines. | `.claude/state/inventory/import-graph.json` reverse index | Delete, or promote (`GlobalSearch` is better than the shipped `/search` UI). |
| M02-F12 | MEDIUM | Eight routes are unreachable from site chrome - `/live`, `/journey`, `/timeline`, `/volunteer`, `/search`, `/notifications`, `/pages/notifications`, `/pages/settings` appear in neither `Navbar` nor `Footer`. **They are not all dead:** Raya AI deep-links `/live`, `/timeline` and `/notifications` (`lib/ai/actions/actionRegistry.ts:102-106`, `:249`), the AI composer offers `/volunteer` (`lib/ai/composer/composer.ts:337`), and an admin featured card can point at `/journey` (`app/admin/featured/page.tsx:75`). Only `/search`, `/pages/notifications` and `/pages/settings` have no inbound link anywhere in the repo. | `components/layout/Navbar.tsx:17-82`, `components/layout/Footer.tsx:36-53`; repo-wide grep for each href | Link the four AI-reachable routes from the nav (an AI-only entry point is invisible to search engines and to anyone not using the assistant); delete or link the three truly unreferenced ones. |
| M02-F13 | MEDIUM | Duplicate preference pages with divergent storage: `/notifications` persists through `ProfileContext`, `/pages/notifications` through `localStorage`, and `/pages/settings` duplicates `/profile/settings`. A devotee can set the same toggle in two places and see two answers. | `app/(public)/notifications/page.tsx:88` (`useProfile()`), `app/(public)/pages/notifications/page.tsx:101` (`STORAGE_KEY`), `app/(public)/pages/settings/page.tsx:37` (`STORAGE_KEY`) | Keep the profile-backed one; delete the `pages/` tree. |
| M02-F14 | MEDIUM | `components/home/GallerySection.tsx` imports `framer-motion`, `next/link` and uses hooks-free motion without a `"use client"` directive. It works only because its single importer is already a client component; any server importer breaks the build. | `components/home/GallerySection.tsx:1-5` (no directive), imported at `components/home/HomeClient.tsx:5` | Add the directive. |
| M02-F15 | MEDIUM | `services/event.service.ts` downloads the **entire** `events` table on every listing - `select('*')` with no filter, no `published` predicate, no pagination - then filters in JS, twice (service + `EventGrid`). | `services/event.service.ts:46`; second pass `components/events/EventGrid.tsx:45` | Push `published`, date range and `limit` into the Supabase query. |
| M02-F16 | MEDIUM | `highlightKeywords` interpolates user input into a `RegExp` with no escaping and returns an HTML string - regex-injection / ReDoS, and XSS if ever fed to `dangerouslySetInnerHTML`. | `services/search.service.ts:389-391` | Escape the input or highlight by index instead of regex. |
| M02-F17 | MEDIUM | Six independent client fetches fire after home-page hydration (announcements, homepage config snapshot, panchanga JSON, Supabase events, recommendations API, testimonials, social links). Each has its own spinner or empty band, so the page reflows repeatedly. | `Hero.tsx:63` full-height spinner, `AnnouncementBar.tsx:34` returns `null`, `SocialBar.tsx:34` empty band, `EventGrid.tsx:57` | Fetch on the server in `page.tsx` and pass down. |
| M02-F18 | MEDIUM | Temple identity data is hardcoded in components while the CMS already has fields for it (`templeAddress`, `contactPhone` in `HomepageConfig`). `HomeClient` renders `<TempleMap/>` with no props, so the prop defaults always win. | `components/home/TempleMap.tsx:13-17` (lat/lon/templeAddress/phone defaults); `components/home/HomeClient.tsx:52`; `services/homepage.service.ts:108` and `:111` | Wire the CMS values through. |
| M02-F19 | MEDIUM | `services/testimonial.service.ts` is browser-only: `getFirebaseDb()` returns `null` whenever `window` is undefined, so any server-side or API use silently yields defaults/empties instead of failing. | `services/testimonial.service.ts:12` | Use the admin SDK path on the server, or make the service isomorphic. |
| M02-F20 | MEDIUM | Accessibility: 51 `<button>` elements against 11 `aria-*` attributes and a single `role=` in the whole chunk. The testimonial modal and the gallery lightbox trap no focus and declare no `role="dialog"`. | counted over the 71 chunk files; `components/home/Testimonials.tsx:232+`, `components/home/GalleryPreviewClient.tsx:39-70` | Add dialog semantics, focus trap and labels; audit against UI-GUIDELINES.md:397. |
| M02-F21 | MEDIUM | `prefers-reduced-motion` is honoured in 3 of the 27 files that import framer-motion, while UI-GUIDELINES.md:354 says "Always respect". `SacredDivider` spins two rings forever (60 s and 45 s, `repeat: Infinity`) on the home page regardless, and it is rendered eight times per home page. | `useReducedMotion` present only in `components/home/Hero.tsx`, `TempleInfo.tsx`, `TempleTimings.tsx`; `components/home/SacredDivider.tsx:29-40` | Centralise motion in a wrapper that reads the preference once. |
| M02-F22 | MEDIUM | Fabricated content presented as real. `DEFAULT_TESTIMONIALS` (four named devotees with quotes and photo paths) renders whenever Firestore is empty or unreachable, indistinguishable from genuine submissions - on the home page, on `/testimonials` (which imports the constant directly at `:10`), and in the admin list. | `services/testimonial.service.ts:32-66`, returned at `:140`, `:166`, `:169`, `:178`, `:192`, `:210`, `:219` | Render an empty state instead of invented people. |
| M02-F23 | MEDIUM | Broken internal link on a live page: `/trust` links to `/contact`, which does not exist (`app/contact` and `app/(public)/contact` are both absent). `QuickServices` has two more, but it is dead. | `app/(public)/trust/page.tsx:210`; `ls app` shows no `contact` | Point at `/about#visit` or create the route. |
| M02-F24 | MEDIUM | `/events?filter=past` is linked from the navbar but `EventGrid` never reads `useSearchParams`; the link lands on the default "upcoming" view. | `components/layout/Navbar.tsx:82` vs `components/events/EventGrid.tsx:27` | Read the query param into the filter state. |
| M02-F25 | LOW | Hydration risk: both `pages/*` routes initialise `useState` from `localStorage` inside the initialiser, so the server-rendered markup uses defaults and the client uses stored values. | `app/(public)/pages/notifications/page.tsx:105`, `app/(public)/pages/settings/page.tsx:50` | Read storage in an effect after mount. |
| M02-F26 | LOW | `Hero` hand-rolls scroll tracking with `new MotionValue(0)` and a manual scroll listener "to avoid hydration errors", duplicating framer-motion's `useScroll` and the unused `hooks/useInViewAnimation.ts`. | `components/home/Hero.tsx:28-58` vs `hooks/useInViewAnimation.ts:48` | Use `useScroll`/`useTransform` or the existing hook. |
| M02-F27 | LOW | 87 `console.log`/`error`/`warn` calls across the chunk, including one that prints an entire Firestore payload. AGENTS.md forbids leftover `console.log`. | counted over the 71 files; worst case `services/homepage.service.ts:41` | Replace with a logger gated on `NODE_ENV`. |
| M02-F28 | LOW | 21 `any` usages in a strict-mode codebase that forbids `any`. | e.g. `services/announcement.service.ts:20`, `services/homepage.service.ts:65`, `components/events/EventCard.tsx:15`, `app/(public)/notifications/page.tsx:100` | Type the Firestore snapshots and date unions. |
| M02-F29 | LOW | `SevaReceipt.printReceipt()` replaces `document.body.innerHTML`, prints, then restores it - this destroys and remounts the whole React tree and loses all event handlers. | `components/home/SevaReceipt.tsx:93-100` | Print through a CSS `@media print` block or a hidden iframe. |
| M02-F30 | LOW | Fake loading states: `/timeline` and `/live` both run `setTimeout(() => setLoading(false), 500)` over hardcoded arrays, showing a spinner for data that is already in the bundle. | `app/(public)/timeline/page.tsx:192`, `app/(public)/live/page.tsx:102` | Delete the timers. |
| M02-F31 | LOW | Content data lives in `types/`. `types/guru.ts` holds 17 guru biographies plus four query functions; `types/festival.ts` similarly. | `types/guru.ts:64` (`GURU_BIOGRAPHIES`), `:322-343` | Move to `data/` or a service, leaving types in `types/`. |
| M02-F32 | LOW | Content errors in the hardcoded timeline: "Entered Brindavan Brindavan Brindavan at Mantap" and a 1622 Brindavana entry attributed to Sri Raghavendra Swamy (born 1595 per the same file's first entry), contradicting the biography data in `types/guru.ts`. | `app/(public)/timeline/page.tsx:48-51` | Have the Matha verify the timeline and move it into the CMS. |
| M02-F33 | LOW | `recommendation.service.getUpcomingEvents()` is a stub returning `[]`, so no event is ever recommended even though the UI advertises event recommendations. | `services/recommendation.service.ts:226-229` | Call `eventService.getUpcomingEvents()`. |
| M02-F34 | LOW | `getCategoryUrl()` routes `faq` results to `/knowledge/faq`, a route that does not exist (`app/knowledge` has only `page.tsx`, `article/`, `[category]/`). | `services/search.service.ts:346`; `ls app/knowledge` | Point at `/knowledge` or add the route. |
| M02-F35 | LOW | Naming traps for anyone changing this code: `components/home/FullGallery.tsx` default-exports `GalleryGrid`; `services/volunteer.service.ts` has nothing to do with the `/volunteer` page (that goes through `services/chat.service`); `DailyQuoteWidget` exists twice (a dead file and a private function inside `DailySpiritualDashboard.tsx:230`). | `components/home/FullGallery.tsx:47`; `services/volunteer.service.ts:83` vs `app/api/volunteer/route.ts:2` | Rename on the next touch. |
| M02-F36 | LOW | `services/gallery.service.ts` exposes five alias methods (`getImages`, `getImageById`, `createImage`, `updateImage`, `deleteImage`) that just forward to the `*Media` versions - two vocabularies for one collection. | `services/gallery.service.ts:175,215,225,234,243` | Pick one and deprecate the other. |
| M02-F37 | LOW | `services/content.service.ts` is an AI knowledge-content utility (auto-tagging, freshness, related questions) with its only consumer in `app/api/admin/content/route.ts`; it has no relationship to the public information pages it is grouped with. | `services/content.service.ts:6` imports `lib/ai/knowledge/types`; `app/api/admin/content/route.ts:17` is the sole importer | Reassign to the Raya AI chunk. |
| M02-F38 | MEDIUM | `searchAll()` never searches gurus or announcements although both are declared `SearchResultType`s, `groupResultsByType()` allocates a bucket for each and `getCategoryUrl()` routes both. A devotee searching "Raghavendra" gets knowledge articles but never the guru biography that `types/guru.ts` already holds - and `SEARCH_TYPE_CONFIG` advertises the types in the suggestions UI. | `services/search.service.ts:34-61` has branches for `knowledge`, `event`, `festival`, `gallery`, `faq` only, vs `types/search.ts:6-13` and `services/search.service.ts:361-367` | Add `searchGurus()` over `GURU_BIOGRAPHIES` and `searchAnnouncements()` over `announcementService`, or narrow `SearchResultType`. |
| M02-F39 | LOW | `app/(public)/gallery/page.tsx:9` imports `DEFAULT_GALLERY_IMAGES` and never uses it. When the Vercel Blob `list()` throws (see M02-F04) the catch block falls back to the 7 hardcoded `LOCAL_IMAGES` only, so the Firestore-backed gallery defaults are silently unreachable from `/gallery`. | `app/(public)/gallery/page.tsx:9` vs `:67` | Delete the import or use it in the fallback. |
| M02-F40 | LOW | `generatePhotoFilename(name, phone)` is defined in `components/home/TestimonialSubmissionForm.tsx:14` and never called - the filename that actually reaches Vercel Blob is built inline in the service. Anyone changing the naming scheme will edit the dead copy. | `components/home/TestimonialSubmissionForm.tsx:14` (only occurrence in the file) vs `services/testimonial.service.ts:306-309` | Delete the dead function or call it from the service. |
| M02-F41 | LOW | Two dead `GlobalSearch` implementations exist: `components/search/GlobalSearch.tsx` (in this chunk) and `components/common/Search/GlobalSearch.tsx` (outside it). Neither is imported anywhere. The second one's `router.push("/search")` is the **only** navigation to `/search` in the repository, which is why that route is unreachable. | `components/common/Search/GlobalSearch.tsx:71`, `:100`; repo-wide grep for both import paths returns 0 | Pick one, wire it into `Navbar`, delete the other. |

### Visual inventory for the redesign

Measured across the 71 files of this chunk:

- **Radii:** `rounded-full` x157, `rounded-xl` x87, `rounded-2xl` x82, `rounded-3xl` x52, `rounded-lg` x47, plus one-off `rounded-[32px]` x9, `rounded-[30px]` x3, `rounded-[36px]` x1. UI-GUIDELINES.md:92 defines a 6-step scale; the code uses ad-hoc pixel values on top of it.
- **Shadows:** `shadow-lg` x66, `shadow-sm` x39, `shadow-2xl` x19, `shadow-xl` x16, `shadow-md` x12, plus an arbitrary `shadow-[0_0_15px_rgba(251,191,36,0.3)]`. The docs define four levels; `shadow-2xl` is not one of them.
- **Type scale:** `text-sm` x201, `text-lg` x87, `text-xs` x56, `text-2xl` x53, `text-4xl` x37, `text-xl` x33, `text-3xl` x27, `text-5xl` x21, `text-6xl` x7, `text-base` x2. `h1` sizes range from `text-2xl` (`/search`) to `text-6xl` (Hero) - no consistent page-title size.
- **Gradients:** 19 `from-amber-600`, 17 `from-amber-500`, 16 `from-amber-50`, 10 `from-amber-400`, 9 `from-amber-700`; the `QuickServices` tiles introduce eight unrelated hues (pink, indigo, sky, violet, teal, emerald, rose, cyan) and `/future-plans` is entirely emerald/teal. The amber -> orange diagonal gradient appears on virtually every hero, CTA card and primary button.
- **Vertical rhythm:** `py-24` x11, `py-20` x14, `py-16` x23, `py-12` x20 - four different band heights with no rule for which to use.
- **Container widths:** `max-w-7xl` x35, `max-w-4xl` x21, `max-w-3xl` x19, `max-w-2xl` x12, `max-w-6xl` x9. `/search`, `/timeline` and `/live` use `max-w-4xl` while every other page uses `max-w-7xl`, so the site changes width as you navigate.
- **Repeated section-header pattern** (copy-pasted, not componentised): amber pill badge in caps -> `text-5xl font-bold text-stone-900` h2 -> `text-lg text-stone-600` paragraph, wrapped in a `motion.div` with `initial={{opacity:0,y:25}} whileInView viewport={{once:true}}`. Seen in `UpcomingEvents.tsx:13`, `GallerySection.tsx:34`, `TempleGalleryPreview.tsx:17`, `Testimonials.tsx:124`, `TempleMap.tsx:25`.
- **Hero pattern:** `bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900`, a background image at `opacity-10`, a `bg-white/20 backdrop-blur` icon circle, white h1, amber-100 subtitle. Identical on `/trust`, `/facilities`, `/journey`, `/guruparampara`, `/volunteer` (orange variant), `/timeline` (red variant), `/future-plans` (emerald variant).
- **Card pattern:** `rounded-3xl border border-amber-100 bg-white p-8 shadow-lg` with `hover:-translate-y-2 hover:shadow-2xl`. Every card in the module re-declares this string; there is no `Card` primitive in use here.
- **Images:** 16 `next/image` uses against 3 raw `<img>` (`app/(public)/search/page.tsx:250`, `components/home/TestimonialSubmissionForm.tsx:292`, `components/recommendation/RecommendationCard.tsx:65`). `EventCard` renders no image at all even though `TempleEvent.imageUrl` exists.
- **Motion load:** 27 of the 71 files import `framer-motion`; 99 `<motion.*>` elements across 25 files, plus 11 `<AnimatePresence>` in 6 files and 7 motion-hook calls (`useTransform`/`useScroll`/`useInView`). Heaviest: Hero 13, GalleryPreviewClient 11, FloatingContact 8, TempleTimings 8, InteractiveGuruParampara 8, SacredDivider 8, Testimonials 8, TempleInfo 6, DailySpiritualDashboard 5, TempleMap 4. (Counts are opening `<motion.x` tags, reproducible with `grep -o "<motion\.[a-zA-Z]*"`.)

## Portability notes (React Native / cross-platform)

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| `services/{event,gallery,announcement,homepage,volunteer}.service.ts` | Firebase JS SDK / `@supabase/supabase-js` - both run in RN | **reuse as-is** | Pure data access; only `lib/firebase` and `lib/supabase/client` init needs an RN variant. |
| `services/search.service.ts`, `recommendation.service.ts`, `content.service.ts` | none | **reuse as-is** | Pure functions over service output. |
| `services/testimonial.service.ts` | `typeof window === "undefined"` guard (`:12`) | **adapt** | `window` exists in RN's Hermes as `global`, but the guard and the `import("firebase/firestore")` dynamic imports should be replaced with static ones. |
| `types/*` consumed here | none | **reuse as-is** | Ship as a shared package - the natural seam for a monorepo. |
| `types/guru.ts`, `types/festival.ts` content arrays | none | **reuse as-is** | Content data; move to `data/` first. |
| `hooks/useHomepage.ts` | none (`onSnapshot` works in RN) | **reuse as-is** | |
| `hooks/useGallery.ts` | none | **reuse as-is** (currently dead) | |
| `hooks/useInViewAnimation.ts` | `window.addEventListener("scroll")`, `getBoundingClientRect`, framer-motion `useInView` | **rewrite** | Needs `onScroll` from RN `ScrollView` / Reanimated. |
| `app/(public)/**/page.tsx` (all 20) | Next.js App Router, `useParams`, `useSearchParams`, Server Components, `revalidate` | **rewrite** | Routing model is entirely different; only the JSX-to-data mapping is reusable as a spec. |
| `app/(public)/layout.tsx` | Next.js layout convention | **rewrite** | Becomes a navigator wrapper. |
| Every `components/**` file in the chunk | Tailwind class strings, `next/image`, `next/link`, `framer-motion`, `lucide-react`, DOM APIs | **rewrite** | 117 motion nodes -> Reanimated; Tailwind -> NativeWind or StyleSheet; `next/image` -> `expo-image`; `next/link` -> navigation. |
| `components/home/AnnouncementMarquee.tsx` | inline `<style>` + CSS `@keyframes` | **rewrite** | No CSS engine in RN; use Reanimated or `react-native-marquee`. |
| `components/home/SacredDivider.tsx`, `Testimonials.tsx` decorations | inline `<svg>` | **adapt** | `react-native-svg` takes the same paths. |
| `components/home/TempleMap.tsx` | `<iframe>` Google Maps embed | **rewrite** | `react-native-maps` or a Maps deep link. |
| `components/home/FullGallery.tsx` video tiles | `<iframe>` YouTube embed, `<video>` | **rewrite** | `react-native-youtube-iframe` / `expo-av`. |
| `components/home/SevaReceipt.tsx` printing | `document.body.innerHTML`, `window.print()` | **rewrite** | `expo-print` / share sheet. |
| `components/home/GalleryPreviewClient.tsx` lightbox | `document.body.style.overflow`, `keydown` listener | **rewrite** | Modal + gesture handler. |
| `components/home/Hero.tsx` | `window.scrollY`, `MotionValue`, canvas `DeepaFlame`, particles | **rewrite** | Heaviest single component in the module. |
| `components/events/EventCard.tsx` actions | `window.open` Google Calendar URL, `navigator.share` via `lib/device` | **adapt** | `lib/device` (M13) already abstracts share/location/notifications; give it RN implementations and the card logic survives. |
| `app/(public)/gallery/page.tsx` blob listing | `@vercel/blob` server SDK | **rewrite** | Must become an API call in any case - see M02-F04. |
| `components/analytics/PageViewTracker.tsx` | `usePathname`, `document.referrer`, `navigator.userAgent` | **rewrite** | Navigation-listener based analytics. |
| `app/(public)/pages/*` localStorage | `localStorage` | **adapt** | `AsyncStorage`; same keys and shapes. |
| `lib/gallery.ts` (imported by `page.tsx`) | `fs.readdirSync` | **rewrite** | No filesystem listing of bundled assets; needs a manifest or a Blob/Firestore-backed list. |

**What a React Native client would need from this module**

1. A read API that does not exist today: `GET /api/public/homepage`, `/api/public/announcements`, `/api/public/testimonials`, `/api/public/settings/{aboutUs|trustCommittee|facilities|futurePlans}`. Only events, search, recommendations and quotes have HTTP endpoints today; everything else is reachable only by importing a service that talks to Firestore directly from the client.
2. The shared types package (`types/event`, `types/homepage`, `types/gallery`, `types/search`, `types/recommendation`, `types/guru`, `types/festival`) extracted so web and native compile against the same contracts - and `TempleEvent.startDate` corrected to `string` first, otherwise both clients inherit M02-F02.
3. The static content currently embedded in page files (timeline entries, journey phases, volunteer service list, live-stream placeholders) moved into the CMS or a `data/` package; today a native app would have to re-type all of it.
4. A platform-agnostic capability layer. `lib/device` (M13) is already the right shape - `useShare`, `useLocation`, `useNotifications` - and `EventCard`, `Panchanga` and `TempleInfo` depend on nothing more than that, so their behaviour ports cleanly even though their markup does not.
5. A design-token layer. Right now the visual language exists only as Tailwind class strings copy-pasted per component; there is nothing a native renderer can import. Extracting tokens (the amber ramp, radii, band spacing, the section-header and card recipes) is a prerequisite for both the redesign and the native client, and is the single highest-leverage refactor in this chunk.

## Coverage

filesExpected 71, filesMentioned 71 (plus 1 adopted file, `components/analytics/PageViewTracker.tsx`), omitted: none.

Read fully: all 71 files were opened or structurally parsed (exports, imports, JSX tree, hooks, service calls, motion/img counts). Files over 300 lines read by structure rather than line by line: `Hero.tsx`, `SevaBooking.tsx`, `DonationForm.tsx`, `TestimonialSubmissionForm.tsx`, `InteractiveGuruParampara.tsx`, `DailySpiritualDashboard.tsx`, `Panchanga.tsx`, `Testimonials.tsx`, `testimonial.service.ts`, `recommendation.service.ts`, `search.service.ts`, `content.service.ts`, `live/page.tsx`, `timeline/page.tsx`, `about/page.tsx`, `journey/page.tsx`, `pages/settings/page.tsx`.

Boundary files read one level out to confirm claims (not owned by M02): `components/layout/Navbar.tsx`, `components/layout/Footer.tsx`, `lib/gallery.ts`, `types/event.ts`, `types/guru.ts`, `app/api/search/route.ts`, `app/api/recommendations/route.ts`, `app/api/volunteer/route.ts`, `app/layout.tsx`, `app/calendar/festivals/page.tsx`, `docs/UI-GUIDELINES.md`, `docs/ARCHITECTURE.md`.

## UNCLEAR

- UNCLEAR: whether `BLOB_READ_WRITE_TOKEN` is exposed to the browser in the deployed environment. `.env.example:20` declares it unprefixed, which suggests it is not, which in turn means `app/(public)/gallery/page.tsx:40` always throws and the gallery silently shows only the 7 local images. Settled by running the app with real env vars and watching the network tab, which this run may not do.
- UNCLEAR: whether `/events/[id]` is reachable in production at all, or whether the crash at `:63` is masked because no event row survives `getPublishedEvents()`. Settled by querying the Supabase `events` table.
- UNCLEAR: whether the Firestore `settings/*` documents (`aboutUs`, `trustCommittee`, `facilities`, `futurePlans`) actually exist, or whether all four pages have only ever rendered their inline defaults. `docs/DATA-MODEL.md` would need to be cross-checked against a live dump.
- UNCLEAR: which store is authoritative for events going forward. `services/event.service.ts` writes to Supabase, `types/event.ts` still describes Firestore `Timestamp`s, and the Supabase table keys rows by a column literally named `firestore_id` - a half-finished migration whose intended end state is not written down anywhere I could find.
- UNCLEAR: whether the `/pages/*` routes are an abandoned earlier iteration or an intentional unauthenticated alternative to `/profile/*`. No commit history is available (this is not a git repository), and nothing links to them.
- UNCLEAR: whether the 1622 Brindavana date and the triple-"Brindavan" string in `app/(public)/timeline/page.tsx:48` are a typo or a deliberate transcription; only the Matha can confirm the correct dates.

## Verification log (2026-09-19)

Skeptic pass over this file: 186 path and `path:line` citations re-checked against disk, 28 claims
re-derived from the code, all 37 findings re-opened, the 71-file inventory re-diffed. No cited file
was missing. Changes made:

- F01 said "17 of 20 routes start with `use client`" -> now "16 of 20", and `page.tsx:26` -> `:25`. Evidence: `head -1` on each of the 20 `app/(public)` files in `.claude/state/inventory/M02.json` gives 16 with the directive.
- F03 and Data flow 5 said *every* non-"all" search tab returns nothing -> now "five of the six"; `gallery` is spelled identically on both sides and works. Evidence: `app/(public)/search/page.tsx:29` vs `types/search.ts:6-13`.
- F07 / Entry points: `SAMPLE_STREAMS:36` and `36-93` -> `:37-94`. Evidence: `sed -n '37,94p' app/(public)/live/page.tsx`.
- F08: added that `app/layout.tsx:31` supplies one global metadata block, so the gap is *per-route* metadata, not all metadata.
- F12 called eight routes "orphaned" -> now distinguishes the four Raya AI deep-links it, one an admin card points at, and the three with no inbound link at all. Evidence: `lib/ai/actions/actionRegistry.ts:102-106`, `:249`; `lib/ai/composer/composer.ts:337`; `app/admin/featured/page.tsx:75`. This changes the direction from "delete" to "expose in nav".
- F13 / Entry points: `notifications/page.tsx:85` -> `:88` (`useProfile()`); `pages/notifications:100` -> `:101`; `pages/settings:36` -> `:37`. Evidence: `sed -n` on each.
- F18: `TempleMap.tsx:14-16` -> `:13-17` (the `phone` default is at :17); `HomeClient.tsx:57` -> `:52` (`:57` is a `SacredDivider`). Evidence: `cat -n components/home/HomeClient.tsx`.
- F21: "3 of the 26 animating files" -> "3 of the 27 files that import framer-motion". Evidence: recount script, 27 importers.
- F22: return sites `:140`/`:165` -> the seven actual return sites `:140,166,169,178,192,210,219`, and noted `/testimonials` imports the constant directly. Evidence: `grep -n DEFAULT_TESTIMONIALS services/testimonial.service.ts`.
- F34: `search.service.ts:333` -> `:346` (`:333` is the `switch`, the `/knowledge/faq` return is at `:346`).
- Visual inventory said "117 framer-motion nodes across 26 files" - not reproducible under any counting -> now "99 `<motion.*>` across 25 files + 11 `<AnimatePresence>` in 6 + 27 importers", with per-file figures corrected (Hero 16->13, GalleryPreviewClient 13->11, FloatingContact 11->8, InteractiveGuruParampara 11->8). All other visual-inventory counts (radii, shadows, type scale, spacing, widths, `<img>` vs `next/image`, buttons/aria/role, console, `any`) re-ran exactly as written.
- Key files: `PageViewTracker.tsx` 55 -> 54 lines. All other 72 line counts matched the inventory exactly.
- Data flow 4 said `generatePhotoFilename()` builds the upload filename - it is never called; the name is built inline at `services/testimonial.service.ts:306-309` and uploaded at `:314` (was cited as `:305`). New finding M02-F40.
- Data flow 5: added the missing `searchGurus`/`searchAnnouncements` gap. New finding M02-F38.
- Stores: added Firestore `notifications` (written by the public testimonial path, `services/testimonial.service.ts:361`), which the table omitted.
- `hooks/useHomepage.ts` "3 consumers" -> 3 in this chunk plus `components/admin/settings/homepage/HomepageForm.tsx` (M05).
- Coverage gap: the chunk's focus question asks for a component tree for *every* page; nine routes had none. Added the "remaining nine routes" tree block, which also records that `/live`, `/timeline` and `/notifications` render no Navbar or Footer.
- New findings added with `path:line` evidence: M02-F38 (search never covers gurus/announcements), M02-F39 (dead `DEFAULT_GALLERY_IMAGES` import), M02-F40 (dead `generatePhotoFilename`), M02-F41 (a second dead `GlobalSearch` whose `router.push("/search")` is the only route into `/search`).

Re-verified unchanged (spot-checked against code): F02 `.toDate()` at `events/[id]/page.tsx:63` on `event.start_date`; F04 `list()` at `gallery/page.tsx:40` in a `"use client"` file; F05 unauthenticated `GET` at `app/api/volunteer/route.ts:58` returning spread Firestore docs; F06 `addDoc` at `testimonial.service.ts:277`; F09 the four `doc(db,"settings",...)` calls at `about:112`, `trust:61`, `facilities:126`, `future-plans:108`; F11 all eleven modules have zero importers by exact path; F15 `select('*')` with no filter at `event.service.ts:45`; F16 unescaped `new RegExp` at `search.service.ts:389`; F17 all six client fetch sites; F19 `typeof window === "undefined"` at `testimonial.service.ts:12`; F20 exactly one `role=` in the chunk and no `role="dialog"`; F23 no `contact` directory under `app` or `app/(public)`; F24 `Navbar.tsx:82` is `/events?filter=past` while `EventGrid` never reads `useSearchParams`; F25 both `useState` localStorage initialisers; F29 `document.body.innerHTML` swap at `SevaReceipt.tsx:95-100`; F30 both 500 ms timers; F31 `GURU_BIOGRAPHIES` at `types/guru.ts:64`; F32 the triple-"Brindavan" string at `timeline/page.tsx:48`; F33 the `return []` stub at `recommendation.service.ts:226-229`; F36 the five alias methods at `gallery.service.ts:175,215,225,234,243`; F37 the single `content.service` consumer at `app/api/admin/content/route.ts:17`.

**Gap-closure pass (2026-09-19).** Two topics the mind map listed as unowned now live here, and the
file inventory is unchanged (71 + 1 adopted, as Coverage states):

- **Data flow 7, *Search ranking*** - the scoring and ordering inside `services/search.service.ts`,
  read line by line (`:22-73` for the merge, `:104-277` for the five branches) together with
  `lib/ai/knowledge/repository.ts:168-226`, which supplies the knowledge and FAQ scores. Records two
  behaviours no fault covers: the scores are not comparable across types, and the
  `filters.categories` branch at `:67-71` returns before the 20-row cap at `:73`.
- **`/pages/settings` described in full** under Entry points: the four cards with their line ranges,
  the localStorage-only persistence (`STORAGE_KEY` at `:37`), and the grep that shows nothing links
  to the route and nothing reads the key back.
