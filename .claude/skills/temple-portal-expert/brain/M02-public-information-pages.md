# M02 - Public site - home and information pages
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs; refreshed 2026-10-18 against HEAD `424fdb8` (see Refresh log). Verify against the code before acting on any claim.

## Answers questions about

- "What is on the home page and in what order?" - the exact section sequence lives in one file, `components/home/HomeClient.tsx`.
- "Where does the hero title / temple-open status / hero stats come from?" - Firestore `homepage/config` via `hooks/useHomepage.ts`.
- "Why does the public site show spinners, defaults and empty bands until JS loads?" - almost every public page is `"use client"` and fetches in effects; the HTML is server-rendered but holds only loading states and inline defaults (not a blank page); see Faults M02-F01.
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
- "Which components use framer-motion and how heavily?" - 28 files import it; 101 `<motion.*>` elements across 26 files plus 12 `<AnimatePresence>` in 7 (2026-10-18 recount); matters for React Native.
- "What is the festival countdown beside Upcoming Events on the home page?" - `components/festival/FestivalCountdownWrapper.tsx` -> `FestivalCountdown.tsx`: the next *major* festival from the checked-in `data/calendar.ts`, computed in the browser, no fetch (Data flow 8; added 2026-10-06, `ee8390c`).
- "What are the Live Updates feed and the photo highlights on `/live`?" - both hardcoded placeholders: `MOCK_UPDATES` in `components/festival/FestivalLiveUpdates.tsx` and four Unsplash stock photos (`MOCK_PHOTOS`) in `app/(public)/live/page.tsx`; see M02-F42.
- "What does the festival 'What to Expect' guide / Photo Highlights on `/calendar/festivals` show?" - `components/festival/FestivalGuide.tsx` (static `SAMPLE_GUIDE_SECTIONS`) and `FestivalPhotoHighlights.tsx` fed three local images inline from `FestivalExperience.tsx:79-103`.
- "Does the mobile app (`apps/mobile`) use this module?" - not its code; it reads the same Supabase `events` table directly and a *different* gallery store - Portability notes.
- "What card / hero / section-header / spacing / type styles are actually used?" - the visual inventory section.
- "Which pages are dead, orphaned or duplicated?" - `/live`, `/journey`, `/timeline`, `/volunteer`, `/search`, `/pages/notifications`, `/pages/settings` carry no Navbar/Footer link; only `/search`, `/pages/notifications` and `/pages/settings` have no inbound link anywhere (`/live`, `/timeline`, `/notifications` are deep-linked by Raya AI, `lib/ai/actions/actionRegistry.ts:102-106`; `/volunteer` by the AI composer, `lib/ai/composer/composer.ts:337`; `/journey` only by an admin featured card, `app/admin/featured/page.tsx:76`).
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
| `/timeline` | `app/(public)/timeline/page.tsx` | client | none | Hardcoded `TIMELINE_EVENTS` (`:29`), category filter, a 500 ms timer (`:194`) that flips a `loading` state nothing reads. No Navbar/Footer. |
| `/facilities` | `app/(public)/facilities/page.tsx` | client | none | Facilities grid from Firestore `settings/facilities` (`:126`). |
| `/future-plans` | `app/(public)/future-plans/page.tsx` | client | none | Plans list from Firestore `settings/futurePlans` (`:108`). Emerald/teal palette - the only page that is not amber. |
| `/testimonials` | `app/(public)/testimonials/page.tsx` | client | none | Approved testimonials grid + modal + submission modal + a QR block. |
| `/testimonials/submit` | `app/(public)/testimonials/submit/page.tsx` | client | none | Thin wrapper around `TestimonialSubmissionForm`. |
| `/volunteer` | `app/(public)/volunteer/page.tsx` | client | none | Static service list + form -> `POST /api/volunteer` (`:44`). |
| `/live` | `app/(public)/live/page.tsx` | client | none | Live darshan tabs, no Navbar/Footer. **100% mock data** (`SAMPLE_STREAMS:39-96`, 5 streams; the four YouTube ones use videoId `dQw4w9WgXcQ`, the fifth is a Facebook entry with no URL). Since 2026-10-06 the live tab is a 2/3 + 1/3 grid with a mock `<FestivalLiveUpdates/>` feed (`:329`), and a `<FestivalPhotoHighlights/>` strip of four Unsplash stock photos (`MOCK_PHOTOS:99-124`, rendered `:480`) closes the page. |
| `/gallery` | `app/(public)/gallery/page.tsx` | client | none | 7 hardcoded local images + Vercel Blob `list()` called from the browser (`:41`). |
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

Not an entry point but worth knowing: `components/festival/FestivalExperience` (and its children, now
including `FestivalPhotoHighlights` and `FestivalGuide`) is rendered by `app/calendar/festivals/page.tsx`
(M14's route); since 2026-10-06 `FestivalCountdownWrapper` is rendered on the home page by
`components/home/UpcomingEvents.tsx:8`, and `FestivalLiveUpdates` + `FestivalPhotoHighlights` by `/live`; and `components/home/SevaBooking|SevaReceipt|DonationForm|DonationCTA|TempleTimings`
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
   ├─ UpcomingEvents (client)  components/home/UpcomingEvents.tsx   (lg: 8/12 events + 4/12 countdown, since 2026-10-06)
   │  ├─ EventGrid limit={4} (client)  components/events/EventGrid.tsx   (was limit={6} until ee8390c)
   │  │  ├─ eventService.getUpcomingEvents(4)  services/event.service.ts
   │  │  │  └─ Supabase table events  (createClient from lib/supabase/client)  [M11]
   │  │  └─ EventCard (client) x n  components/events/EventCard.tsx
   │  │     └─ useShare / useLocation / useNotifications  lib/device        [M13]
   │  └─ FestivalCountdownWrapper (client)  components/festival/FestivalCountdownWrapper.tsx
   │     ├─ getAllFestivals()  lib/festival-utils.ts -> data/calendar.ts    [M14]  (static, no fetch)
   │     ├─ getFeaturedFestival()  types/festival.ts  (next isMajor festival)
   │     └─ FestivalCountdown (client)  components/festival/FestivalCountdown.tsx
   │        └─ null until mounted; 1 s setInterval -> calculateCountdown(); 2 <motion.*> + AnimatePresence
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
├─ LOCAL_IMAGES const (7 hardcoded /images/temple/*.jpg)      :22
├─ list({prefix:"gallery/videos/"}) from @vercel/blob         :41  (server-only SDK, called in browser)
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
   ├─ fetch(`/api/search?q=..&types=<tab>&grouped=true`)   :78
   │  └─ app/api/search/route.ts [M12] -> searchAll()  services/search.service.ts
   │     ├─ knowledgeService.searchKnowledge()   lib/ai/knowledge  [M08]  (Supabase ai_knowledge since fdaff98, 2026-10-06)
   │     ├─ eventService.getEvents()             Supabase events
   │     └─ galleryService.getMedia()            Firestore galleryMedia (or DEFAULT_GALLERY_IMAGES)
   ├─ SEARCH_TYPES tabs: all|events|articles|quotes|stotras|gallery|pages   :30
   └─ result rows: raw <img> thumbnail + <a href>                          :251
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
├─ static `volunteerServices` list :14 + ui/{button,input,textarea}      [M01]
├─ react-hot-toast for feedback
└─ POST /api/volunteer :44 -> `submitVolunteerRequest()` services/chat.service.ts:260   [M12/M10]

LiveDarshanPage (client)  app/(public)/live/page.tsx     ← no Navbar, no Footer, no Breadcrumb
├─ SAMPLE_STREAMS :39-96 (hardcoded, 5 entries) · MOCK_PHOTOS :99-124 (4 images.unsplash.com URLs)
├─ setTimeout(500) :133 flips a `loading` state that is never read (no spinner renders)
├─ tabs live|upcoming|past -> next/image thumbnails + YouTube embed
│  └─ live tab: lg:grid-cols-3 -> streams (col-span-2) + FestivalLiveUpdates (col-span-1) :329
│     └─ FestivalLiveUpdates (client)  components/festival/FestivalLiveUpdates.tsx  MOCK_UPDATES :17-47, raw <img> :103
└─ FestivalPhotoHighlights photos={MOCK_PHOTOS} :480  components/festival/FestivalPhotoHighlights.tsx (next/image fill)

JourneyPage (client)  app/(public)/journey/page.tsx
└─ Navbar · Breadcrumb · SectionHeading [M01] · static phase cards · next/image · Footer   (no data source)

TimelinePage (client)  app/(public)/timeline/page.tsx    ← no Navbar, no Footer
├─ TIMELINE_EVENTS :29 (hardcoded) + CATEGORIES :176
├─ setTimeout(500) :194 flips a `loading` state that is never read (no spinner renders)
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
├─ StatCard :111 / SeasonGrid :135 (local)
├─ FestivalGrid (client)  components/festival/FestivalGrid.tsx
│  ├─ grid|list view + month filter ; StatBadge :190 ; FestivalListItem :200
│  └─ FestivalCard (client)  components/festival/FestivalCard.tsx
├─ FestivalPhotoHighlights (no directive; server-safe)  components/festival/FestivalPhotoHighlights.tsx   :79-103
│  └─ 3 inline local photos: /images/aaradhane/*.jpg x2, /images/temple/Seva.jpg   (d2c1b01)
└─ FestivalGuide (no directive; static)  components/festival/FestivalGuide.tsx   :104-105
   └─ SAMPLE_GUIDE_SECTIONS :12-74 (schedule, rituals, cultural, facilities, prasada - hardcoded)
Data: getAllFestivals() from lib/festival-utils.ts and types/festival.ts   [M14]

Home-page countdown (rendered from components/home/UpcomingEvents.tsx, see the / tree)
FestivalCountdownWrapper (client) -> useMemo(getFeaturedFestival(getAllFestivals())) -> FestivalCountdown (client)
```
Three countdown implementations now coexist: dead `components/home/EventCountdown.tsx` (rewritten in
`ee8390c` but still imported by nothing), `FeaturedFestival`'s private `CountdownUnit`, and the new
`FestivalCountdown` - see M02-F46.

## Data flow

**1. Home page first paint**
1. Request hits `app/(public)/page.tsx` (server, ISR 60 s).
2. `getTempleGalleryImages()` (`lib/gallery.ts:21`) does `readdirSync(public/images/temple)` and returns `{image,title,size}[]`.
3. `dailySpiritualService.getDashboardData()` (M03) is awaited inside try/catch; on failure `dashboardData` stays `null` and the dashboard band shows a **permanent three-card skeleton**: `loading` is `useState(!initialData)` with no setter (`components/home/DailySpiritualDashboard.tsx:266`, rendered `:277`), so the `if (!data) return null` at `:309` is unreachable (M02-F49).
4. Both are serialised into `<HomeClient galleryImages dashboardData>`; from here the tree is client-only.
5. In the browser `Hero` mounts, `useHomepage()` sets the hardcoded defaults and `loading=false` on a `setTimeout(0)` (`hooks/useHomepage.ts:16-21`) and then opens an `onSnapshot` on `homepage/config` (`:36-37`). So the full-height spinner (`Hero.tsx:61-67`) is what the server HTML and the first client frame show; after one tick the hero renders `getDefaultConfig()` copy ("Welcome to Rayara Math") and swaps to the CMS values when the snapshot lands - a flash of default content, not a spinner until the snapshot. `Panchanga` calls `useHomepage()` too, so the home page opens **two** listeners on the same document.
6. `AnnouncementBar` fires `getActiveAnnouncements()`; `Panchanga` fetches `/data/panchanga/current.json`; `UpcomingEvents -> EventGrid` calls Supabase; `RecommendationsSection` calls `/api/recommendations`; `Testimonials` calls Firestore; `SocialBar` calls `settingsService`. **Six round-trips in this step, seven with the step-5 snapshot, all after hydration.** (Since 2026-10-06 the `UpcomingEvents` band also mounts `FestivalCountdown`, which fetches nothing but renders `null` until a post-mount `setTimeout(0)` (`FestivalCountdown.tsx:18-34`) - one more late reflow inside the same band.)

**2. Events listing**
1. `EventGrid` mounts (`components/events/EventGrid.tsx:29`).
2. `eventService.getPublishedEvents()` (`services/event.service.ts:130`) -> `getEvents()` -> `supabase.from('events').select('*')` - **no filter, no limit; the whole table is downloaded** - then `mapSupabaseEventToTempleEvent` (`:21`) maps snake_case columns to the `TempleEvent` shape, filters `published !== false` and sorts by `startDate`.
3. `getUpcomingEvents(max)` additionally filters `endDate >= now` and `slice(0, max)`.
4. Without `limit` (`/events`), `EventGrid` filters *again* client-side by `startDate >= now` into upcoming/past; with `limit` (home page) it renders `events` unfiltered (`EventGrid.tsx:114-121`) in a `sm:grid-cols-2 lg:grid-cols-3` grid (`:116`).
   All of this runs in the browser against `*.supabase.co`, a host neither CSP's `connect-src` allows (`next.config.ts:34`, `proxy.ts:38`) - see M02-F48.
5. `EventCard` renders; `toDate()` (`:15`) defensively handles string | number | Date | Firestore Timestamp.

**3. Event detail**
1. `app/(public)/events/[id]/page.tsx:20` calls `eventService.getEvent(id)` -> `supabase.from('events').select('*').eq('firestore_id', id).single()`.
2. `PGRST116` is mapped to `null` -> "Event Not Found" screen.
3. On success the component executes `const startDate = event.startDate.toDate();` (`:63`). `startDate` is an ISO **string** from Supabase, so this throws `TypeError: event.startDate.toDate is not a function`. See M02-F02.

**4. Testimonial submission**
1. Devotee opens the modal from `/testimonials` or `/testimonials/submit` -> `TestimonialSubmissionForm`.
2. Photo is read to a base64 data URL in the browser. (`generatePhotoFilename()` at `TestimonialSubmissionForm.tsx:15` looks like it names the file but is **never called** - see M02-F40.)
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
1. `RecommendationsSection` mounts -> `fetch('/api/recommendations')` (`:39`), defaulting to `type=homepage`.
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
     `knowledgeService.searchKnowledge` -> `searchArticles()` in `lib/ai/knowledge/repository.ts:152`
     (since `fdaff98`, 2026-10-06, it loads every row of the Supabase table `ai_knowledge` instead
     of Firestore `knowledge`, keeping the same JS scoring), which splits the
     query into **words** and adds, per word, title **+10** (`:174`), content **+5** (`:182`) and
     keyword **+15** (`:191`), drops anything under **10** (`:205`) and passes its own
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

**8. Home-page festival countdown** (added 2026-10-06, `ee8390c`)
1. `UpcomingEvents` renders `<FestivalCountdownWrapper/>` (`components/home/UpcomingEvents.tsx:52`) in a `lg:col-span-4` column (`:51`) beside `EventGrid limit={4}` (`:37`).
2. The wrapper runs `getAllFestivals()` (`lib/festival-utils.ts:168`, which transforms the checked-in `data/calendar.ts`) and `getFeaturedFestival()` (`types/festival.ts:86`: the earliest festival dated today or later whose name matches `MAJOR_FESTIVALS` in `lib/festival-utils.ts`) inside a `useMemo` (`FestivalCountdownWrapper.tsx:9-12`). No network, no CMS.
3. If no major festival is left in the data the wrapper returns `null` (`:14-16`). The last *major* festival in `data/calendar.ts` is Mahashivaratri on `2027-03-06` (`data/calendar.ts:52`; the file's later dates - Holi `2027-03-22`, ekadashi `2027-04-02` - are not major), so the column goes empty from 2027-03-07, 140 days after 2026-10-18 (M02-F47).
4. `FestivalCountdown` seeds state with `calculateCountdown()` (`types/festival.ts:100`; its `isToday` branch was fixed in the same commit), returns `null` until mounted (`:32-34`), then ticks every second (`:22-24`). It shows days/hours/minutes, or "Today is the Day!" / "Festival has passed".

## Key files

| File | Lines | Role | Key exports | Notes |
|---|---:|---|---|---|
| `app/(public)/layout.tsx` | 19 | Public shell | `PublicLayout` | Server. Only tracker + go-up button; no chrome. |
| `app/(public)/page.tsx` | 30 | Home entry | `Home`, `revalidate` | The only ISR page in the chunk. |
| `app/(public)/about/page.tsx` | 380 | About the Matha | `AboutPage` | Direct Firestore `settings/aboutUs`. 7 sections. |
| `app/(public)/trust/page.tsx` | 223 | Trust committee | `TrustCommitteePage` | Direct Firestore `settings/trustCommittee`. Links to missing `/contact` (`:210`). |
| `app/(public)/guruparampara/page.tsx` | 113 | Lineage page | `GuruparamparaPage` | Server; hardcoded "17 / 800+" stats. |
| `app/(public)/journey/page.tsx` | 346 | Devotee journey | `JourneyPage` | Entirely static; unreachable from any nav. |
| `app/(public)/timeline/page.tsx` | 390 | Temple history | `TimelinePage` | Hardcoded events, fake loader, no Navbar/Footer, orphaned. |
| `app/(public)/facilities/page.tsx` | 284 | Facilities | `FacilitiesPage` | Direct Firestore `settings/facilities`. |
| `app/(public)/future-plans/page.tsx` | 246 | Roadmap | `FuturePlansPage` | Direct Firestore `settings/futurePlans`; emerald palette outlier. |
| `app/(public)/testimonials/page.tsx` | 323 | Testimonials | `TestimonialsPage` | Grid + detail modal + submit modal + QR block. |
| `app/(public)/testimonials/submit/page.tsx` | 76 | Submit alias | `TestimonialsSubmitPage` | Duplicates the modal path on `/testimonials`. |
| `app/(public)/volunteer/page.tsx` | 251 | Volunteer sign-up | `VolunteerPage` | `POST /api/volunteer`; orphaned from nav. |
| `app/(public)/live/page.tsx` | 485 | Live darshan | `LiveDarshanPage` | All mock; rickroll video id; orphaned. Since 2026-10-06 also a mock live-updates feed and four Unsplash stock photos (M02-F42). |
| `app/(public)/gallery/page.tsx` | 103 | Gallery | `GalleryPage` | Client-side `@vercel/blob` `list()`; hardcoded local images. Imports `DEFAULT_GALLERY_IMAGES` (`:10`) and never uses it - the catch path falls back to `LOCAL_IMAGES` only (`:68`). Line 1 is a blanket `/* eslint-disable */` (M02-F45). |
| `app/(public)/events/page.tsx` | 30 | Events list | `EventsPage` | Server shell around a client grid. |
| `app/(public)/events/[id]/page.tsx` | 186 | Event detail | `EventDetailPage` | `.toDate()` crash at `:63`; no Navbar/Footer. |
| `app/(public)/search/page.tsx` | 310 | Search | `SearchPage` | Broken type filters; raw `<img>`; no chrome. |
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
| `components/home/UpcomingEvents.tsx` | 59 | Events band | `UpcomingEvents` | 8/12 + 4/12 grid: `EventGrid limit={4}` (`:37`, was 6) beside `FestivalCountdownWrapper` (`:52`), since `ee8390c`. |
| `components/home/GallerySection.tsx` | 86 | Gallery band | `GallerySection` | **Missing `"use client"`** while importing framer-motion. |
| `components/home/GalleryPreviewClient.tsx` | 243 | Lightbox grid | `GalleryPreviewClient` | 11 `<motion.*>` nodes; locks `document.body.style.overflow` (`:39`). |
| `components/home/FullGallery.tsx` | 182 | Full gallery grid | `GalleryGrid` | File name and export name disagree. |
| `components/home/Testimonials.tsx` | 335 | Carousel | `Testimonials` | 6 s autoplay, arrow-key nav, 8 `<motion.*>` nodes; links to `/testimonials` (`:294`) - the only inbound link that page has. |
| `components/home/TestimonialSubmissionForm.tsx` | 430 | Submit form | `TestimonialSubmissionForm` | Base64 photo, HTTPS check (`:83`), raw `<img>` preview (`:293`). |
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
| `components/home/EventCountdown.tsx` | 149 | Countdown | `EventCountdown` | Dead; overlaps `FeaturedFestival`'s `CountdownUnit` and the new `FestivalCountdown`. Rewritten in `ee8390c` (state now seeded in the `useState` initialiser, `:43-46`) yet still imported by nothing. |
| `components/home/FloatingContact.tsx` | 125 | Floating FAB | `FloatingContact` | Dead; 8 `<motion.*>` nodes. |
| `components/events/EventGrid.tsx` | 123 | Event list | `EventGrid` | Two filter passes; `limit` changes the whole layout. |
| `components/events/EventCard.tsx` | 268 | Event card | `EventCard` | Share/Calendar/Notify/Directions; never renders `event.imageUrl`. |
| `components/guru/InteractiveGuruParampara.tsx` | 537 | Guru explorer | `InteractiveGuruParampara` | 3 view modes, search, filters; 8 `<motion.*>` nodes; data from `types/guru.ts`. |
| `components/search/GlobalSearch.tsx` | 351 | Command palette | `GlobalSearch` | Dead; the better search UI, unused. A **second** dead copy lives outside the chunk at `components/common/Search/GlobalSearch.tsx:71`, and its `router.push("/search")` (`:100`) is the only code in the repo that navigates to `/search`. |
| `components/festival/FestivalExperience.tsx` | 198 | Festival page body | `FestivalExperience` | Entered from M14's `/calendar/festivals`. Since 2026-10 also renders `FestivalPhotoHighlights` (`:79`) and `FestivalGuide` (`:105`). |
| `components/festival/FeaturedFestival.tsx` | 157 | Hero festival | `FeaturedFestival` | Countdown. |
| `components/festival/FestivalGrid.tsx` | 240 | Festival grid/list | `FestivalGrid` | Month filter, view toggle. |
| `components/festival/FestivalCard.tsx` | 95 | Festival card | `FestivalCard` | |
| `components/festival/FestivalCountdown.tsx` | 134 | Festival countdown card | `FestivalCountdown` | *Added 2026-10-06 (`ee8390c`).* Rendered on the home page via the wrapper; `null` until mounted; 2 `<motion.*>` + 1 `<AnimatePresence>`; ignores reduced motion. |
| `components/festival/FestivalCountdownWrapper.tsx` | 24 | Countdown data shim | `FestivalCountdownWrapper` | *Added 2026-10-06.* Picks the next major festival from `data/calendar.ts` in a `useMemo`; imported only by `components/home/UpcomingEvents.tsx:8`. |
| `components/festival/FestivalLiveUpdates.tsx` | 123 | "Live Updates" feed | `FestivalLiveUpdates`, `FestivalUpdate`, `UpdateType` | *Added 2026-10-06 (`f353d51`).* Hardcoded `MOCK_UPDATES` (`:17-47`) labelled "Real-time updates"; raw `<img>` (`:103`) of the missing `/images/temple-hero.jpg`. Only importer `app/(public)/live/page.tsx:21`. |
| `components/festival/FestivalPhotoHighlights.tsx` | 61 | Photo grid | `FestivalPhotoHighlights` | *Added 2026-10-06/07 (`108d980`, `293e874`, `6fc2ac7`).* Props-only, no directive, `next/image fill`; caption on hover only. Used by `FestivalExperience.tsx:79` (local images) and `/live` (`:480`, Unsplash stock). Uses `gray-*`, not the module's `stone-*`. |
| `components/festival/FestivalGuide.tsx` | 115 | "What to Expect" guide | `FestivalGuide` | *Added 2026-10-07 (`4b00109`, merged `d2c1b01`).* Static `SAMPLE_GUIDE_SECTIONS` (`:12-74`): schedule, rituals, cultural, facilities, prasada; same text for every festival. |
| `components/recommendation/RecommendationsSection.tsx` | 209 | Recs band | `RecommendationsSection` | `grid`/`list`/`carousel` variants; skeleton + empty state. |
| `components/recommendation/RecommendationCard.tsx` | 106 | Rec card | `RecommendationCard` | Raw `<img>` (`:65`). |
| `hooks/useHomepage.ts` | 78 | CMS config hook | `useHomepage` | Live `onSnapshot` on `homepage/config` (`:36-37`); exactly 3 consumers, all in this chunk (`Hero`, `Panchanga`, `TempleTimings`); the M05 editor uses `useHomepageForm` -> `homepageService`, not this hook. Each call opens its own listener. |
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
| `types/festival.ts` | `Festival`, `getFeaturedFestival`, `calculateCountdown` (its `isToday` branch fixed in `ee8390c`), `MONTH_NAMES` |
| `components/festival/FestivalLiveUpdates.tsx` | `FestivalUpdate`, `UpdateType` - exported from a component file, not from `types/` (added 2026-10-06) |
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
| Vercel Blob | `gallery/videos/*` | R | - | `app/(public)/gallery/page.tsx:41` |
| Vercel Blob | `images/testimonials/*` | - | W | `services/testimonial.service.ts:314` via `storage.service` |
| Static file | `public/data/panchanga/current.json` | R | - | `components/home/Panchanga.tsx:69` |
| Static module | `data/calendar.ts` (via `lib/festival-utils.getAllFestivals`) | R | - | `components/festival/FestivalCountdownWrapper.tsx:10` - home-page countdown, bundled into the client (added 2026-10-06) |
| Supabase | `ai_knowledge` | R | - | indirectly, through `knowledgeService` -> `lib/ai/knowledge/repository.ts` for search and recommendations (was Firestore `knowledge` until `fdaff98`) |
| Remote images | `images.unsplash.com` | R | - | `app/(public)/live/page.tsx:99-124` (`MOCK_PHOTOS`); allowed by `next.config.ts` `images.remotePatterns` |
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
| M14 (domain engines) | `lib/festival-utils` (+ `data/calendar` behind it - now also on the home page via `FestivalCountdownWrapper`), `types/festival`, `components/calendar/Breadcrumb`, `public/data/panchanga/*` |

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
| `apps/mobile` (Expo) | **nothing** - no import of any M02 file; it queries Supabase directly (`apps/mobile/lib/api.ts`), see Portability notes |

## How to change it

**Add a section to the home page**
1. Create `components/home/<Name>.tsx` with `"use client"` at the top (the whole home tree is client).
2. Import it in `components/home/HomeClient.tsx` and place it between two `<SacredDivider/>` calls - order in that file *is* the page order.
3. If it needs server data, fetch in `app/(public)/page.tsx` and pass it down as a prop (the pattern used by `dashboardData`); do not add an eighth client round-trip.
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
3. `app/(public)/search/page.tsx:30` - add the tab **using the same id string** as the `SearchResultType`, not a plural variant.

**Retire a dead component safely**
1. Confirm with `.claude/state/inventory/import-graph.json` that nothing imports it.
2. Check the live twin first: `TempleGalleryPreview` -> `GallerySection`, `SocialConnect` -> `SocialBar`, `DailyQuoteWidget` -> the private copy in `DailySpiritualDashboard`, `GlobalSearch` -> `/search`, `EventCountdown` -> `components/festival/FestivalCountdown.tsx`. Move any better behaviour across before deleting.

**Change the home-page festival countdown**
1. Which festival: `getFeaturedFestival()` (`types/festival.ts:86`) and the `MAJOR_FESTIVALS` name list in `lib/festival-utils.ts`; the dates come from `data/calendar.ts` (M14), which must be extended each year or the column goes blank (M02-F47).
2. Look and ticking: `components/festival/FestivalCountdown.tsx`; placement and column split: `components/home/UpcomingEvents.tsx:14-54`.
3. Prefer reusing this component over reviving `components/home/EventCountdown.tsx`, then delete the dead one.

**Change the visual language of a band**
1. There are no shared card/section primitives in this module - each band re-declares its own classes. Introduce `components/ui/Section.tsx` and `components/ui/Card.tsx` first, then migrate band by band starting with `GallerySection`, `UpcomingEvents` and `Testimonials`, which share an identical header block.

## Faults, smells and risks

| id | Sev | What | Evidence | Direction |
|---|---|---|---|---|
| M02-F01 | HIGH | The entire public site is client-rendered. `app/(public)/page.tsx:25` renders `HomeClient`, which is `"use client"`; 16 of the 20 files under `app/(public)` in this chunk start with `"use client"` - only the layout, `/`, `/guruparampara` and `/events` are server files, and three of those four immediately hand off to a client subtree. ARCHITECTURE.md:137 documents "Server Component -> Service Layer -> Firestore -> Render HTML" and AGENTS.md mandates Server Components first. | `components/home/HomeClient.tsx:1`; 16/20 files carry `hasUseClient` in `.claude/state/inventory/M02.json` (2026-10-18 regeneration; `head -1` no longer works for four of them because line 1 is now `/* eslint-disable */`) | Push data fetching into the server pages and keep only interactive leaves as client components. **STILL OPEN (2026-10-18). Still 16 of 20; the five new festival components add three more `"use client"` files (`FestivalCountdown`, `FestivalCountdownWrapper`, `FestivalLiveUpdates`).** |
| M02-F02 | HIGH | Event detail page crashes for every event. `event.startDate` arrives from Supabase as an ISO string but the page calls the Firestore `Timestamp` API on it. | `app/(public)/events/[id]/page.tsx:63` (`event.startDate.toDate()`) vs `services/event.service.ts:27` (`startDate: event.start_date`) | Use the existing `toDate()` helper from `components/events/EventGrid.tsx:15` and fix `types/event.ts:18`. **STILL OPEN (2026-10-18). Page unchanged; evidence `event.service.ts:26` corrected to `:27`.** |
| M02-F03 | HIGH | Five of the six search type filters return nothing. The UI sends `types=events\|articles\|quotes\|stotras\|pages`; `SearchResultType` is `knowledge\|guru\|event\|festival\|gallery\|faq\|announcement`, and `searchAll` only runs a branch when `filters.types.includes(<service id>)`. Only `gallery` is spelled the same on both sides and works. The grouped result keys also never match `SEARCH_TYPES`, so headings fall back to the raw key. | `app/(public)/search/page.tsx:30` and `:78` vs `types/search.ts:6-13`, `services/search.service.ts:34-61` and `:357` | Single source of truth: derive the tabs from `SEARCH_TYPE_CONFIG`. **STILL OPEN (2026-10-18). Lines moved +1 by the `/* eslint-disable */` header (`6408c1d`).** |
| M02-F04 | HIGH | `@vercel/blob`'s `list()` - a server SDK needing `BLOB_READ_WRITE_TOKEN` - is called from a `"use client"` page. It either throws (so gallery videos never appear and the page silently falls back to 7 local images) or the write-capable token has been exposed to the browser. | `app/(public)/gallery/page.tsx:2` (`"use client"`) + `:41`; token declared in `.env.example:20` | Move the listing into a route handler (`app/api/gallery/videos`) and fetch that. **STILL OPEN (2026-10-18). `list()` still at `:41`; `.env.example:20` still declares the token unprefixed.** |
| M02-F05 | HIGH | `GET /api/volunteer` returns every volunteer request - names, phone numbers, e-mail addresses - with no authentication. The public `/volunteer` form feeds it. | `app/api/volunteer/route.ts:58-68`; submitted from `app/(public)/volunteer/page.tsx:44` | Require an admin session, or move the read to `/api/admin/*`. **STILL OPEN (2026-10-18). `app/api/volunteer/route.ts:58-68` unchanged.** |
| M02-F06 | HIGH | Unauthenticated browser writes to Firestore. `submitTestimonial` writes name, location, quote **and phone number** straight from the client with no server-side validation, rate limit or captcha. | `services/testimonial.service.ts:287` -> `:246` (`addDoc`) | Route through a server action / API route with validation and throttling; revisit the `testimonials` security rule (M04). **STILL OPEN (2026-10-18). Only a whitespace change in the service.** |
| M02-F07 | HIGH | `/live` ships placeholder content to production: five invented streams - the four YouTube ones all pointing at id `dQw4w9WgXcQ`, the fifth a Facebook entry with no URL (`:63-71`) - with invented view counts, presented as real temple broadcasts. Raya AI deep-links to it (`lib/ai/actions/actionRegistry.ts:102`, `:249`), so devotees do reach it. | `app/(public)/live/page.tsx:39-96` (5 `id:` entries) | Back it with real data or remove the route. **STILL OPEN (2026-10-18), and worse: `f353d51`/`108d980` added more mock content to the same page - see M02-F42.** |
| M02-F08 | HIGH | Zero per-route SEO metadata. No `export const metadata` or `generateMetadata` anywhere under `app/(public)`, on a site whose whole purpose is public discovery; every page inherits the single global block in `app/layout.tsx:31`, so all 20 routes share one title and description. | `grep -rn "export const metadata\|generateMetadata" "app/(public)/"` returns nothing; `app/layout.tsx:31` | Convert the content pages to Server Components and add per-route metadata + OpenGraph. **STILL OPEN (2026-10-18). The grep still returns nothing.** |
| M02-F09 | HIGH | Four public pages call Firestore directly, violating AGENTS.md "No Direct Firebase Calls - use services only" and ARCHITECTURE.md:100. | `app/(public)/about/page.tsx:112`, `trust/page.tsx:61`, `facilities/page.tsx:126`, `future-plans/page.tsx:108` | One `settingsContentService` with four typed getters. **STILL OPEN (2026-10-18). All four `doc(db, "settings", ...)` lines unchanged.** |
| M02-F10 | MEDIUM | Persistence is split: events live in Supabase while announcements, gallery, testimonials and homepage config live in Firestore, with no documented boundary. `types/event.ts:18` still types the columns as firebase `Timestamp`. | `services/event.service.ts:2-4` vs `services/gallery.service.ts:2` | Decide the target store per entity and record it in DATA-MODEL.md; retype `TempleEvent` dates as `string`. **STILL OPEN (2026-10-18). `types/event.ts:18` still `Timestamp`. The split widened: `apps/mobile` reads gallery from Supabase `gallery_albums`/`gallery_media` while this module reads Firestore `galleryAlbums`/`galleryMedia` (Portability notes).** |
| M02-F11 | MEDIUM | 11 dead modules in this chunk - imported by nothing: `DailyQuoteWidget`, `EventCountdown`, `FeaturedSevas` (+ its client half), `FloatingContact`, `QuickServices`, `SocialConnect`, `TempleGalleryPreview`, `TempleInfo`, `GlobalSearch`, `hooks/useGallery.ts`, `hooks/useInViewAnimation.ts` - about 1,800 lines. | `.claude/state/inventory/import-graph.json` reverse index | Delete, or promote (`GlobalSearch` is better than the shipped `/search` UI). **STILL OPEN (2026-10-18). All eleven still have zero importers; `EventCountdown` was even edited (`ee8390c`) while dead.** |
| M02-F12 | MEDIUM | Eight routes are unreachable from site chrome - `/live`, `/journey`, `/timeline`, `/volunteer`, `/search`, `/notifications`, `/pages/notifications`, `/pages/settings` appear in neither `Navbar` nor `Footer`. **They are not all dead:** Raya AI deep-links `/live`, `/timeline` and `/notifications` (`lib/ai/actions/actionRegistry.ts:102-106`, `:249`), the AI composer offers `/volunteer` (`lib/ai/composer/composer.ts:337`), and an admin featured card can point at `/journey` (`app/admin/featured/page.tsx:76`). Only `/search`, `/pages/notifications` and `/pages/settings` have no inbound link anywhere in the repo. | `components/layout/Navbar.tsx:17-82`, `components/layout/Footer.tsx:36-53`; repo-wide grep for each href | Link the four AI-reachable routes from the nav (an AI-only entry point is invisible to search engines and to anyone not using the assistant); delete or link the three truly unreferenced ones. **STILL OPEN (2026-10-18). Navbar/Footer unchanged; featured-card line moved `:75` -> `:76`.** |
| M02-F13 | MEDIUM | Duplicate preference pages with divergent storage: `/notifications` persists through `ProfileContext`, `/pages/notifications` through `localStorage`, and `/pages/settings` duplicates `/profile/settings`. A devotee can set the same toggle in two places and see two answers. | `app/(public)/notifications/page.tsx:88` (`useProfile()`), `app/(public)/pages/notifications/page.tsx:101` (`STORAGE_KEY`), `app/(public)/pages/settings/page.tsx:37` (`STORAGE_KEY`) | Keep the profile-backed one; delete the `pages/` tree. **STILL OPEN (2026-10-18).** |
| M02-F14 | MEDIUM | `components/home/GallerySection.tsx` imports `framer-motion`, `next/link` and uses hooks-free motion without a `"use client"` directive. It works only because its single importer is already a client component; any server importer breaks the build. | `components/home/GallerySection.tsx:1-5` (no directive), imported at `components/home/HomeClient.tsx:5` | Add the directive. **STILL OPEN (2026-10-18).** |
| M02-F15 | MEDIUM | `services/event.service.ts` downloads the **entire** `events` table on every listing - `select('*')` with no filter, no `published` predicate, no pagination - then filters in JS, twice (service + `EventGrid`). | `services/event.service.ts:46`; second pass `components/events/EventGrid.tsx:45` | Push `published`, date range and `limit` into the Supabase query. **STILL OPEN (2026-10-18). Note `apps/mobile/lib/api.ts:15-24` already pushes `published` and ordering into the query - the fix exists in the repo, just not here.** |
| M02-F16 | MEDIUM | `highlightKeywords` interpolates user input into a `RegExp` with no escaping and returns an HTML string - regex-injection / ReDoS, and XSS if ever fed to `dangerouslySetInnerHTML`. | `services/search.service.ts:389-391` | Escape the input or highlight by index instead of regex. **STILL OPEN (2026-10-18).** |
| M02-F17 | MEDIUM | Seven independent client fetches fire after home-page hydration (announcements, homepage config snapshot - opened twice, by `Hero` and `Panchanga` -, panchanga JSON, Supabase events, recommendations API, testimonials, social links). Each has its own spinner or empty band, so the page reflows repeatedly. | `Hero.tsx:63` full-height spinner, `AnnouncementBar.tsx:34` returns `null`, `SocialBar.tsx:34` empty band, `EventGrid.tsx:57` | Fetch on the server in `page.tsx` and pass down. **STILL OPEN (2026-10-18). Plus one more late reflow: `FestivalCountdown` renders `null` until mounted (`components/festival/FestivalCountdown.tsx:32-34`).** |
| M02-F18 | MEDIUM | Temple identity data is hardcoded in components while the CMS already has fields for it (`templeAddress`, `contactPhone` in `HomepageConfig`). `HomeClient` renders `<TempleMap/>` with no props, so the prop defaults always win. | `components/home/TempleMap.tsx:13-17` (lat/lon/templeAddress/phone defaults); `components/home/HomeClient.tsx:52`; `services/homepage.service.ts:109` (`templeAddress`) and `:111` (`contactPhone`) | Wire the CMS values through. **STILL OPEN (2026-10-18).** |
| M02-F19 | MEDIUM | `services/testimonial.service.ts` is browser-only: `getFirebaseDb()` returns `null` whenever `window` is undefined, so any server-side or API use silently yields defaults/empties instead of failing. | `services/testimonial.service.ts:12` | Use the admin SDK path on the server, or make the service isomorphic. **STILL OPEN (2026-10-18).** |
| M02-F20 | MEDIUM | Accessibility: 51 `<button>` elements against 11 `aria-*` attributes and a single `role=` in the whole chunk. The testimonial modal and the gallery lightbox trap no focus and declare no `role="dialog"`. | counted over the 76 chunk files (unchanged by the 2026-10 additions); `components/home/Testimonials.tsx:232+`, `components/home/GalleryPreviewClient.tsx:39-70` | Add dialog semantics, focus trap and labels; audit against UI-GUIDELINES.md:397. **STILL OPEN (2026-10-18). Counts unchanged (51 / 11 / 1).** |
| M02-F21 | MEDIUM | `prefers-reduced-motion` is honoured in 3 of the 28 files that import framer-motion (2026-10-18; the new `FestivalCountdown` does not honour it either), while UI-GUIDELINES.md:354 says "Always respect". `SacredDivider` spins two rings forever (60 s and 45 s, `repeat: Infinity`) on the home page regardless, and it is rendered eight times per home page. | `useReducedMotion` present only in `components/home/Hero.tsx`, `TempleInfo.tsx`, `TempleTimings.tsx`; `components/home/SacredDivider.tsx:29-40` | Centralise motion in a wrapper that reads the preference once. **STILL OPEN (2026-10-18).** |
| M02-F22 | MEDIUM | Fabricated content presented as real. `DEFAULT_TESTIMONIALS` (four named devotees with quotes and photo paths) renders whenever Firestore is empty or unreachable, indistinguishable from genuine submissions - on the home page, on `/testimonials` (which imports the constant directly at `:10`), and in the admin list. | `services/testimonial.service.ts:32-66`, returned at `:140`, `:166`, `:169`, `:178`, `:192`, `:210`, `:219` | Render an empty state instead of invented people. **STILL OPEN (2026-10-18). All seven return sites unchanged.** |
| M02-F23 | MEDIUM | Broken internal link on a live page: `/trust` links to `/contact`, which does not exist (`app/contact` and `app/(public)/contact` are both absent). `QuickServices` has two more, but it is dead. | `app/(public)/trust/page.tsx:210`; `ls app` shows no `contact` | Point at `/about#visit` or create the route. **STILL OPEN (2026-10-18). `app/contact` and `app/(public)/contact` still absent.** |
| M02-F24 | MEDIUM | `/events?filter=past` is linked from the navbar but `EventGrid` never reads `useSearchParams`; the link lands on the default "upcoming" view. | `components/layout/Navbar.tsx:82` vs `components/events/EventGrid.tsx:27` | Read the query param into the filter state. **STILL OPEN (2026-10-18).** |
| M02-F25 | LOW | Hydration risk: both `pages/*` routes initialise `useState` from `localStorage` inside the initialiser, so the server-rendered markup uses defaults and the client uses stored values. | `app/(public)/pages/notifications/page.tsx:105`, `app/(public)/pages/settings/page.tsx:50` | Read storage in an effect after mount. **STILL OPEN (2026-10-18).** |
| M02-F26 | LOW | `Hero` hand-rolls scroll tracking with `new MotionValue(0)` and a manual scroll listener "to avoid hydration errors", duplicating framer-motion's `useScroll` and the unused `hooks/useInViewAnimation.ts`. | `components/home/Hero.tsx:28-58` vs `hooks/useInViewAnimation.ts:48` | Use `useScroll`/`useTransform` or the existing hook. **STILL OPEN (2026-10-18).** |
| M02-F27 | LOW | 87 `console.log`/`error`/`warn` calls across the chunk, including one that prints an entire Firestore payload. AGENTS.md forbids leftover `console.log`. | counted over the 76 files (still 87 on 2026-10-18); worst case `services/homepage.service.ts:41` | Replace with a logger gated on `NODE_ENV`. **STILL OPEN (2026-10-18), and now hidden from lint by M02-F45.** |
| M02-F28 | LOW | 21 `any` usages in a strict-mode codebase that forbids `any`. | e.g. `services/announcement.service.ts:20`, `services/homepage.service.ts:65`, `components/events/EventCard.tsx:15`, `app/(public)/notifications/page.tsx:100` | Type the Firestore snapshots and date unions. **STILL OPEN (2026-10-18).** |
| M02-F29 | LOW | `SevaReceipt.printReceipt()` replaces `document.body.innerHTML`, prints, then restores it - this destroys and remounts the whole React tree and loses all event handlers. | `components/home/SevaReceipt.tsx:93-100` | Print through a CSS `@media print` block or a hidden iframe. **STILL OPEN (2026-10-18).** |
| M02-F30 | LOW | Dead loading state: `/timeline` and `/live` both run `setTimeout(() => setLoading(false), 500)` over hardcoded arrays, but neither page ever reads `loading` - no spinner renders; the timer only forces one wasted re-render and misleads readers into thinking there is a load path. (Corrected 2026-10-18: earlier text said it showed a spinner.) | `app/(public)/timeline/page.tsx:187`, `:194`; `app/(public)/live/page.tsx:128`, `:133` - the only two `loading` occurrences in each file | Delete the state and the timers. **STILL OPEN (2026-10-18). Both timers still present; lines moved.** |
| M02-F31 | LOW | Content data lives in `types/`. `types/guru.ts` holds 17 guru biographies plus four query functions; `types/festival.ts` similarly. | `types/guru.ts:64` (`GURU_BIOGRAPHIES`), `:322-343` | Move to `data/` or a service, leaving types in `types/`. **STILL OPEN (2026-10-18).** |
| M02-F32 | LOW | Content errors in the hardcoded timeline: "Entered Brindavan Brindavan Brindavan at Mantap" and a 1622 Brindavana entry attributed to Sri Raghavendra Swamy (born 1595 per the same file's first entry), contradicting the biography data in `types/guru.ts`. | `app/(public)/timeline/page.tsx:48` (`year: "1622"`), `:50` (the triple "Brindavan") | Have the Matha verify the timeline and move it into the CMS. **STILL OPEN (2026-10-18). Lines moved +1.** |
| M02-F33 | LOW | `recommendation.service.getUpcomingEvents()` is a stub returning `[]`, so no event is ever recommended even though the UI advertises event recommendations. | `services/recommendation.service.ts:226-229` | Call `eventService.getUpcomingEvents()`. **STILL OPEN (2026-10-18).** |
| M02-F34 | LOW | `getCategoryUrl()` routes `faq` results to `/knowledge/faq`, a route that does not exist (`app/knowledge` has only `page.tsx`, `article/`, `[category]/`). | `services/search.service.ts:346`; `ls app/knowledge` | Point at `/knowledge` or add the route. **STILL OPEN (2026-10-18). `app/knowledge` still has only `page.tsx`, `article/`, `[category]/`.** |
| M02-F35 | LOW | Naming traps for anyone changing this code: `components/home/FullGallery.tsx` default-exports `GalleryGrid`; `services/volunteer.service.ts` has nothing to do with the `/volunteer` page (that goes through `services/chat.service`); `DailyQuoteWidget` exists twice (a dead file and a private function inside `DailySpiritualDashboard.tsx:230`). | `components/home/FullGallery.tsx:48`; `services/volunteer.service.ts:83` vs `app/api/volunteer/route.ts:2` | Rename on the next touch. **STILL OPEN (2026-10-18). `FullGallery.tsx` line moved `:47` -> `:48`.** |
| M02-F36 | LOW | `services/gallery.service.ts` exposes five alias methods (`getImages`, `getImageById`, `createImage`, `updateImage`, `deleteImage`) that just forward to the `*Media` versions - two vocabularies for one collection. | `services/gallery.service.ts:175,215,225,234,243` | Pick one and deprecate the other. **STILL OPEN (2026-10-18).** |
| M02-F37 | LOW | `services/content.service.ts` is an AI knowledge-content utility (auto-tagging, freshness, related questions) with its only consumer in `app/api/admin/content/route.ts`; it has no relationship to the public information pages it is grouped with. | `services/content.service.ts:6` imports `lib/ai/knowledge/types`; `app/api/admin/content/route.ts:17` is the sole importer | Reassign to the Raya AI chunk. **STILL OPEN (2026-10-18).** |
| M02-F38 | MEDIUM | `searchAll()` never searches gurus or announcements although both are declared `SearchResultType`s, `groupResultsByType()` allocates a bucket for each and `getCategoryUrl()` routes both. A devotee searching "Raghavendra" gets knowledge articles but never the guru biography that `types/guru.ts` already holds - and `SEARCH_TYPE_CONFIG` advertises the types in the suggestions UI. | `services/search.service.ts:34-61` has branches for `knowledge`, `event`, `festival`, `gallery`, `faq` only, vs `types/search.ts:6-13` and `services/search.service.ts:361-367` | Add `searchGurus()` over `GURU_BIOGRAPHIES` and `searchAnnouncements()` over `announcementService`, or narrow `SearchResultType`. **STILL OPEN (2026-10-18).** |
| M02-F39 | LOW | `app/(public)/gallery/page.tsx:10` imports `DEFAULT_GALLERY_IMAGES` and never uses it. When the Vercel Blob `list()` throws (see M02-F04) the catch block falls back to the 7 hardcoded `LOCAL_IMAGES` only, so the Firestore-backed gallery defaults are silently unreachable from `/gallery`. | `app/(public)/gallery/page.tsx:10` vs `:68` | Delete the import or use it in the fallback. **STILL OPEN (2026-10-18). Lines moved +1.** |
| M02-F40 | LOW | `generatePhotoFilename(name, phone)` is defined in `components/home/TestimonialSubmissionForm.tsx:15` and never called - the filename that actually reaches Vercel Blob is built inline in the service. Anyone changing the naming scheme will edit the dead copy. | `components/home/TestimonialSubmissionForm.tsx:15` (only occurrence in the file) vs `services/testimonial.service.ts:306-309` | Delete the dead function or call it from the service. **STILL OPEN (2026-10-18). Line moved +1.** |
| M02-F41 | LOW | Two dead `GlobalSearch` implementations exist: `components/search/GlobalSearch.tsx` (in this chunk) and `components/common/Search/GlobalSearch.tsx` (outside it). Neither is imported anywhere. The second one's `router.push("/search")` is the **only** navigation to `/search` in the repository, which is why that route is unreachable. | `components/common/Search/GlobalSearch.tsx:72`, `:101`; repo-wide grep for both import paths returns 0 | Pick one, wire it into `Navbar`, delete the other. **STILL OPEN (2026-10-18). Evidence lines in the out-of-chunk copy moved `:71`/`:100` -> `:72`/`:101`; still imported by nothing.** |
| M02-F42 | HIGH | *New 2026-10-06.* More fabricated content on `/live`, presented as real. `FestivalLiveUpdates` shows four hardcoded `MOCK_UPDATES` ("The grand Mangalarati has concluded with thousands of devotees participating") under the heading "Real-time updates from the temple" and the footer "Updates are refreshed automatically" - nothing fetches or refreshes; timestamps are faked as "5 / 45 / 120 / 180 minutes ago". The same page closes with `MOCK_PHOTOS`: four `images.unsplash.com` stock photos captioned as Matha events ("Special Alankara for Sri Raghavendra Swamy", "Maha Mangalarati during Aradhana"). | `components/festival/FestivalLiveUpdates.tsx:17-47`, `:57`, `:118`; `app/(public)/live/page.tsx:99-124`, `:329`, `:480` | Feed both from the CMS (or remove them) together with M02-F07; never caption stock photography as temple events. **NEW (2026-10-18).** |
| M02-F43 | MEDIUM | *New 2026-10-06.* Hydration mismatch on `/live`. `MOCK_UPDATES` timestamps are computed with `Date.now()` at module evaluation and rendered with `toLocaleTimeString([], ...)`; the server render (separate module instance, server time zone) and the browser produce different strings, which AGENTS.md's "No Hydration Errors" forbids. | `components/festival/FestivalLiveUpdates.tsx:20`, `:27`, `:35`, `:42` (module-scope `Date.now()`), rendered at `:83` | Format times after mount, or ship real ISO timestamps and format in an effect. **NEW (2026-10-18).** |
| M02-F44 | LOW | *New 2026-10-06.* Broken image: the new live-updates photo item points at `/images/temple-hero.jpg`, which does not exist under `public/images` (the same missing file is the thumbnail of every `SAMPLE_STREAMS` entry). It is also a fourth raw `<img>` in the chunk. The `/live` and `/timeline` heroes also reference a missing `/images/p pattern.svg` through a Tailwind arbitrary value that contains a space, so the class never even parses (added by verification 2026-10-18). | `components/festival/FestivalLiveUpdates.tsx:31`, `:103`; `app/(public)/live/page.tsx:44`, `:169`; `app/(public)/timeline/page.tsx:229`; `ls public/images/temple-hero.jpg "public/images/p pattern.svg"` -> no such file (both) | Point at an existing asset (e.g. `/images/Hero.jpg`) and use `next/image`. **NEW (2026-10-18).** |
| M02-F45 | MEDIUM | *New 2026-10-03.* Lint switched off instead of fixed: `6408c1d` ("chore: fix CI pipeline errors for baseline") put a file-wide `/* eslint-disable */` on line 1 of eight files in this chunk, so `npm run lint` (an AGENTS.md Definition-of-Done gate) passes while the `console.*` (M02-F27), `any` (M02-F28) and raw-`<img>` findings in those files are no longer reported. | line 1 of `app/(public)/gallery/page.tsx`, `app/(public)/search/page.tsx`, `app/(public)/timeline/page.tsx`, `app/(public)/volunteer/page.tsx`, `components/home/FullGallery.tsx`, `components/home/TestimonialSubmissionForm.tsx`, `components/recommendation/RecommendationsSection.tsx`, `hooks/useHomepage.ts` | Replace each blanket disable with targeted `eslint-disable-next-line <rule>` comments, then fix the underlying issues. **NEW (2026-10-18).** |
| M02-F46 | LOW | *New 2026-10-06.* Three countdown implementations: the new `FestivalCountdown` (home page), `FeaturedFestival`'s private `CountdownUnit` (`/calendar/festivals`), and the dead `EventCountdown` - which `ee8390c` rewrote anyway, now seeding the clock in the `useState` initialiser so it would hydrate-mismatch if ever revived. `FestivalCountdown` duplicates the `FeaturedFestival` card's gradient and data source rather than reusing it. | `components/festival/FestivalCountdown.tsx:12-34`; `components/festival/FeaturedFestival.tsx:14-18`, `:145`; `components/home/EventCountdown.tsx:43-46` | Keep one countdown primitive (a `useCountdown` hook + one unit component); delete `EventCountdown`. **NEW (2026-10-18).** |
| M02-F47 | LOW | *New 2026-10-06.* The home-page countdown expires with the data. It only considers festivals in the checked-in `data/calendar.ts`; the last one matching `MAJOR_FESTIVALS` is Mahashivaratri on `2027-03-06` (corrected 2026-10-18 by verification: `2027-04-02`, the file's last date, is an ekadashi, and Holi on `2027-03-22` is not major). From 2027-03-07 - 140 days after 2026-10-18 - `FestivalCountdownWrapper` returns `null` and the `lg:col-span-4` column beside the events is left empty - silently, with no CMS fallback. | `components/festival/FestivalCountdownWrapper.tsx:9-16`; `types/festival.ts:86-95`; `lib/festival-utils.ts:12-23` (`MAJOR_FESTIVALS`); `data/calendar.ts:52` | Source festivals from a maintained store (M14) or collapse the column when there is nothing to show. **NEW (2026-10-18).** |
| M02-F48 | HIGH | *Added by verification 2026-10-18.* The site's Content-Security-Policy blocks this module's browser-side Supabase calls. Both CSPs (the `next.config.ts` header on `/:path*` and the second one `proxy.ts` sets on every response) list `connect-src` hosts for Firebase, Google, Stripe, the LLM APIs and Vercel Blob, but **no `*.supabase.co`**. `services/event.service.ts` creates a *browser* Supabase client (`:2-4`), so `EventGrid` (home band and `/events`) and `/events/[id]` fetch from a host the browser must refuse wherever these headers are served: the home band and `/events` fall to "No Events" (the `try/finally` in `EventGrid.tsx:31-39` has no catch), and `/events/[id]` shows "Event not found" - which would also hide the M02-F02 crash. The proxy CSP additionally omits YouTube from `frame-src` and Vercel Blob from `img-src`, which would block the `/live` and gallery embeds and Blob-hosted testimonial photos if that header is the one enforced. Static evidence only - not observed in a running browser. | `next.config.ts:34` and `proxy.ts:38` (`connect-src` lists, no supabase); `next.config.ts:55-60` (`source: "/:path*"`); `proxy.ts:113-116`; `services/event.service.ts:2-4`; `components/events/EventGrid.tsx:31-39` | Add `https://*.supabase.co` (and `wss:` for realtime) to `connect-src`, collapse to one CSP (M01-F08), or move event reads behind `/api/events` so the browser only talks to `'self'`. |
| M02-F49 | LOW | *Added by verification 2026-10-18.* If `dailySpiritualService.getDashboardData()` throws, the home page shows a skeleton forever: `DailySpiritualDashboard` holds `loading` as `useState(!initialData)` with no setter and never fetches on its own, so `null` data means a permanent three-card pulse. `if (!data) return null` is unreachable, and ISR (`revalidate = 60`) keeps serving that HTML for up to a minute. | `app/(public)/page.tsx:18-23`; `components/home/DailySpiritualDashboard.tsx:265-266`, `:277`, `:309` | Derive `loading` from nothing, so `null` renders an empty state or nothing, or add a client retry. |
| M02-F50 | LOW | *Added by verification 2026-10-18.* `ee8390c` cut the home events band to `EventGrid limit={4}` but kept EventGrid's `sm:grid-cols-2 lg:grid-cols-3` grid. At `lg` four cards lay out as 3 + 1, leaving a lone card on the second row, and three cards share a column that is now only 8/12 wide. | `components/home/UpcomingEvents.tsx:15`, `:37`; `components/events/EventGrid.tsx:116` | Pass a column count, or use `lg:grid-cols-2` when a `limit` is given. |

### Visual inventory for the redesign

Measured across the 76 files of this chunk (re-counted 2026-10-18 with the same greps; the 2026-09-19 figures on the 71-file snapshot reproduce exactly, so every delta below comes from the five new festival components and the `/live` + `UpcomingEvents` edits):

- **Radii:** `rounded-full` x163, `rounded-xl` x91, `rounded-2xl` x85, `rounded-3xl` x53, `rounded-lg` x49, plus one-off `rounded-[32px]` x10, `rounded-[30px]` x3, `rounded-[36px]` x1. UI-GUIDELINES.md:92 defines a 6-step scale; the code uses ad-hoc pixel values on top of it.
- **Shadows:** `shadow-lg` x66, `shadow-sm` x42, `shadow-2xl` x20, `shadow-xl` x16, `shadow-md` x14, plus an arbitrary `shadow-[0_0_15px_rgba(251,191,36,0.3)]`. The docs define four levels; `shadow-2xl` is not one of them.
- **Type scale:** `text-sm` x209, `text-lg` x87, `text-xs` x60, `text-2xl` x56, `text-4xl` x38, `text-xl` x37, `text-3xl` x29, `text-5xl` x21, `text-6xl` x7, `text-base` x3. `h1` sizes range from `text-2xl` (`/search`) to `text-6xl` (Hero) - no consistent page-title size.
- **Gradients:** 20 `from-amber-600`, 17 `from-amber-500`, 16 `from-amber-50`, 10 `from-amber-400`, 9 `from-amber-700`; the `QuickServices` tiles introduce eight unrelated hues (pink, indigo, sky, violet, teal, emerald, rose, cyan) and `/future-plans` is entirely emerald/teal. The 2026-10 festival components add two more outliers: `FestivalPhotoHighlights` uses the `gray-*` ramp instead of `stone-*`, and `FestivalLiveUpdates` colour-codes items red/blue/green. The amber -> orange diagonal gradient appears on virtually every hero, CTA card and primary button.
- **Vertical rhythm:** `py-24` x11, `py-20` x14, `py-16` x23, `py-12` x20 - four different band heights with no rule for which to use.
- **Container widths:** `max-w-7xl` x36, `max-w-4xl` x21, `max-w-3xl` x18, `max-w-2xl` x13, `max-w-6xl` x9. `/search` and `/timeline` use `max-w-4xl` and `/live` uses `max-w-6xl` (corrected 2026-10-18: `/live` never used `max-w-4xl`) while every other page uses `max-w-7xl`, so the site changes width as you navigate - and `/live` now changes width *within* the page, its new photo strip sitting in a `max-w-7xl` box (`app/(public)/live/page.tsx:479`) under `max-w-6xl` content.
- **Repeated section-header pattern** (copy-pasted, not componentised): amber pill badge in caps -> `text-5xl font-bold text-stone-900` h2 -> `text-lg text-stone-600` paragraph, wrapped in a `motion.div` with `initial={{opacity:0,y:25}} whileInView viewport={{once:true}}`. Seen in `UpcomingEvents.tsx:16` (now left-aligned in an 8/12 column, `text-4xl lg:text-5xl`), `GallerySection.tsx:34`, `TempleGalleryPreview.tsx:17`, `Testimonials.tsx:124`, `TempleMap.tsx:25`.
- **Hero pattern:** `bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900`, a background image at `opacity-10`, a `bg-white/20 backdrop-blur` icon circle, white h1, amber-100 subtitle. Identical on `/trust`, `/facilities`, `/journey`, `/guruparampara`, `/volunteer` (orange variant), `/timeline` (red variant), `/future-plans` (emerald variant).
- **Card pattern:** `rounded-3xl border border-amber-100 bg-white p-8 shadow-lg` with `hover:-translate-y-2 hover:shadow-2xl`. Every card in the module re-declares this string; there is no `Card` primitive in use here.
- **Images:** 17 `next/image` uses against 4 raw `<img>` (`app/(public)/search/page.tsx:251`, `components/home/TestimonialSubmissionForm.tsx:293`, `components/recommendation/RecommendationCard.tsx:65`, `components/festival/FestivalLiveUpdates.tsx:103`). `EventCard` renders no image at all even though `TempleEvent.imageUrl` exists.
- **Motion load:** 28 of the 76 files import `framer-motion`; 101 `<motion.*>` elements across 26 files, plus 12 `<AnimatePresence>` in 7 files (the additions are all `FestivalCountdown`) and 7 motion-hook calls (`useTransform`/`useScroll`/`useInView`). Heaviest: Hero 13, GalleryPreviewClient 11, FloatingContact 8, TempleTimings 8, InteractiveGuruParampara 8, SacredDivider 8, Testimonials 8, TempleInfo 6, DailySpiritualDashboard 5, TempleMap 4, FestivalGrid 3, FestivalCountdown 2. (Counts are opening `<motion.x` tags, reproducible with `grep -o "<motion\.[a-zA-Z]*"`.)

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
| Every `components/**` file in the chunk | Tailwind class strings, `next/image`, `next/link`, `framer-motion`, `lucide-react`, DOM APIs | **rewrite** | 101 `<motion.*>` nodes (2026-10-18 count; the old "117" was never reproducible) -> Reanimated; Tailwind -> NativeWind or StyleSheet; `next/image` -> `expo-image`; `next/link` -> navigation. |
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
| `components/festival/FestivalCountdownWrapper.tsx` logic | none (pure `getAllFestivals` + `getFeaturedFestival`) | **adapt** | The selection logic is portable; the markup in `FestivalCountdown.tsx` (Tailwind, framer-motion, `backdrop-blur`) is a rewrite. |
| `components/festival/{FestivalGuide,FestivalLiveUpdates,FestivalPhotoHighlights}.tsx` | Tailwind, `next/image`, raw `<img>` | **rewrite** (markup) | `FestivalGuide` content is static data worth extracting first; the other two carry only mock data (M02-F42). |

**What `apps/mobile` actually does today (added 2026-09-30, `0cb71b6` / `5813fc9`).** The Expo app imports
nothing from this module - no service, hook, type or component. `apps/mobile/lib/api.ts` talks to
Supabase directly: `fetchEvents()` (`:15-24`) reads the same `events` table as `services/event.service.ts`
but filters `published = true` and orders by `start_date` in the query (the fix M02-F15 asks for), and
formats dates itself with `date-fns`, so it does not inherit M02-F02. `fetchGalleryAlbums()` (`:37-45`)
reads Supabase `gallery_albums` + `gallery_media`, whereas this module's `services/gallery.service.ts:5`
reads Firestore `galleryAlbums`/`galleryMedia` - the two clients can show different galleries
(M02-F10). `fetchWebsiteSettings()` (`:47-56`) reads Supabase `website_settings` key
`temple_information`, not the Firestore `homepage/config` or `settings/*` documents this module reads.
The tabs `apps/mobile/app/(tabs)/{index,events,gallery,temple}.tsx` are therefore a parallel
re-implementation, not a consumer of M02.

**What a React Native client would need from this module**

1. A read API that does not exist today: `GET /api/public/homepage`, `/api/public/announcements`, `/api/public/testimonials`, `/api/public/settings/{aboutUs|trustCommittee|facilities|futurePlans}`. Only events, search, recommendations and quotes have HTTP endpoints today; everything else is reachable only by importing a service that talks to Firestore directly from the client.
2. The shared types package (`types/event`, `types/homepage`, `types/gallery`, `types/search`, `types/recommendation`, `types/guru`, `types/festival`) extracted so web and native compile against the same contracts - and `TempleEvent.startDate` corrected to `string` first, otherwise both clients inherit M02-F02.
3. The static content currently embedded in page files (timeline entries, journey phases, volunteer service list, live-stream placeholders) moved into the CMS or a `data/` package; today a native app would have to re-type all of it.
4. A platform-agnostic capability layer. `lib/device` (M13) is already the right shape - `useShare`, `useLocation`, `useNotifications` - and `EventCard`, `Panchanga` and `TempleInfo` depend on nothing more than that, so their behaviour ports cleanly even though their markup does not.
5. A design-token layer. Right now the visual language exists only as Tailwind class strings copy-pasted per component; there is nothing a native renderer can import. Extracting tokens (the amber ramp, radii, band spacing, the section-header and card recipes) is a prerequisite for both the redesign and the native client, and is the single highest-leverage refactor in this chunk.

## Coverage

filesExpected 76, filesMentioned 76 (plus 1 adopted file, `components/analytics/PageViewTracker.tsx`), omitted: none. (2026-10-18: today's `.claude/state/inventory/M02.json` lists 76 files = the 71 of 2026-09-19 + the five added `components/festival/*` files, all five now in Key files; nothing was deleted.)

Read fully: all 71 files were opened or structurally parsed (exports, imports, JSX tree, hooks, service calls, motion/img counts). Files over 300 lines read by structure rather than line by line: `Hero.tsx`, `SevaBooking.tsx`, `DonationForm.tsx`, `TestimonialSubmissionForm.tsx`, `InteractiveGuruParampara.tsx`, `DailySpiritualDashboard.tsx`, `Panchanga.tsx`, `Testimonials.tsx`, `testimonial.service.ts`, `recommendation.service.ts`, `search.service.ts`, `content.service.ts`, `live/page.tsx`, `timeline/page.tsx`, `about/page.tsx`, `journey/page.tsx`, `pages/settings/page.tsx`.

Boundary files read one level out to confirm claims (not owned by M02): `components/layout/Navbar.tsx`, `components/layout/Footer.tsx`, `lib/gallery.ts`, `types/event.ts`, `types/guru.ts`, `app/api/search/route.ts`, `app/api/recommendations/route.ts`, `app/api/volunteer/route.ts`, `app/layout.tsx`, `app/calendar/festivals/page.tsx`, `docs/UI-GUIDELINES.md`, `docs/ARCHITECTURE.md`.

## UNCLEAR

- UNCLEAR: whether `BLOB_READ_WRITE_TOKEN` is exposed to the browser in the deployed environment. `.env.example:20` declares it unprefixed, which suggests it is not, which in turn means `app/(public)/gallery/page.tsx:41` always throws and the gallery silently shows only the 7 local images. Settled by running the app with real env vars and watching the network tab, which this run may not do.
- UNCLEAR: whether `/events/[id]` is reachable in production at all, or whether the crash at `:63` is masked because no event row survives `getPublishedEvents()` - or because the CSP blocks the browser's Supabase request before any row arrives (M02-F48, added 2026-10-18). Settled by querying the Supabase `events` table and loading the page with the production headers.
- UNCLEAR: whether the Firestore `settings/*` documents (`aboutUs`, `trustCommittee`, `facilities`, `futurePlans`) actually exist, or whether all four pages have only ever rendered their inline defaults. `docs/DATA-MODEL.md` would need to be cross-checked against a live dump.
- UNCLEAR: which store is authoritative for events going forward. `services/event.service.ts` writes to Supabase, `types/event.ts` still describes Firestore `Timestamp`s, and the Supabase table keys rows by a column literally named `firestore_id` - a half-finished migration whose intended end state is not written down anywhere I could find.
- UNCLEAR: whether the `/pages/*` routes are an abandoned earlier iteration or an intentional unauthenticated alternative to `/profile/*`. Git history (available since 2026-10-18) shows both `pages/*` routes arrived on 2026-07-23 in `7ea0200` ("add device capabilities and actions framework") and `/profile/settings` the same day in `a9f49c2`; neither message states the intent, and nothing links to them.
- UNCLEAR: whether the 1622 Brindavana date (`app/(public)/timeline/page.tsx:48`) and the triple-"Brindavan" string (`:50`) are a typo or a deliberate transcription; only the Matha can confirm the correct dates.

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

## Refresh log (2026-10-18)

Refreshed against HEAD `424fdb8` (branch `feature/temple-portal-knowledge-base`) from the delta in
`.claude/state/delta/2026-10-18/delta.json` (`perModule.M02`: 5 added, 0 deleted, 14 modified). Every
modified file was diffed against the 2026-09-19 snapshot with `diff --strip-trailing-cr`. Eight of the 14
changed only by a one-line header, one by whitespace and one by an escaped apostrophe; the real changes are in `/live`,
`UpcomingEvents`, `EventCountdown` and `FestivalExperience`.

What was true -> what is true now -> evidence:

- Home page: `UpcomingEvents` wrapped `EventGrid limit={6}` -> an 8/12 + 4/12 grid with `EventGrid limit={4}` and a new `FestivalCountdownWrapper` -> `components/home/UpcomingEvents.tsx:37`, `:52` (`ee8390c`). Home tree, Key files, Data flow 1 and new Data flow 8 updated.
- `components/festival/*` held 4 files rendered only by `/calendar/festivals` -> 9 files; `FestivalCountdown(+Wrapper)` render on `/`, `FestivalLiveUpdates` + `FestivalPhotoHighlights` on `/live`, `FestivalPhotoHighlights` + `FestivalGuide` on `/calendar/festivals` -> `grep -rn "FestivalCountdown\|FestivalLiveUpdates\|FestivalPhotoHighlights\|FestivalGuide" app components` (import lines only); five Key-files rows, festival tree, Entry-points note.
- `/live` was streams-only mock data -> also a mock "Live Updates" side feed and four Unsplash stock photos captioned as Matha events -> `app/(public)/live/page.tsx:99-124`, `:329`, `:480` (`f353d51`, `108d980`, merged `a99a658`). New faults M02-F42, F43, F44.
- `FestivalExperience` ended with Festivals-by-Season -> also Photo Highlights (3 local images) and the static "What to Expect" guide -> `components/festival/FestivalExperience.tsx:79-105` (`4b00109`, `d2c1b01`); local StatCard/SeasonGrid moved `:78`/`:102` -> `:111`/`:135`.
- `EventCountdown` was dead -> still dead, but rewritten to seed state in the `useState` initialiser -> `components/home/EventCountdown.tsx:43-46` (`ee8390c`). New fault M02-F46.
- `types/festival.ts` `calculateCountdown` treated any `daysRemaining === 0` as today -> explicit start-of-day `isToday` comparison -> `types/festival.ts:100-145` (`ee8390c`). Types table updated.
- Eight files had no lint suppression -> line 1 is `/* eslint-disable */` -> gallery, search, timeline, volunteer pages, `FullGallery`, `TestimonialSubmissionForm`, `RecommendationsSection`, `useHomepage` (`6408c1d`). Every cited line in those files moved +1 and was updated; new fault M02-F45.
- Data flow 7 cited `lib/ai/knowledge/repository.ts:168/190/198/207/221` over Firestore `knowledge` -> `searchArticles` `:152`, +10 `:174`, +5 `:182`, +15 `:191`, threshold `:205`, over Supabase `ai_knowledge` -> `fdaff98` (M08 change, same scoring). Search tree and Stores table updated.
- Stores table lacked the static calendar module, the knowledge table and remote images -> rows added for `data/calendar.ts`, Supabase `ai_knowledge`, `images.unsplash.com`.
- Portability said nothing about `apps/mobile` -> it imports nothing from M02 and reads Supabase `events`, `gallery_albums`/`gallery_media`, `website_settings` directly -> `apps/mobile/lib/api.ts:15-56`. `mobileConsumesThisModule = false`. F10 and F15 statuses note the gallery-store split and the mobile query that already does what F15 asks.
- Claims corrected that were already wrong on 2026-09-19: F02 cited `services/event.service.ts:26` -> `:27`; F41 cited `components/common/Search/GlobalSearch.tsx:71`/`:100` -> `:72`/`:101`; Visual inventory said `/live` uses `max-w-4xl` -> it uses `max-w-6xl` (snapshot and today); Portability said "117 motion nodes" -> 101; F12 `app/admin/featured/page.tsx:75` -> `:76`.
- Line-number moves only (fault still open): F03, F04, F05 (volunteer `:44`), F07 (`:39-96`), F30 (`:194`, `:133`), F32 (`:48`, `:50`), F35 (`:48`), F39 (`:10`, `:68`), F40 (`:15`); Entry points, trees, Key files, Data flows 4 and 6 to match.
- Visual inventory re-counted over 76 files (the 71-file baseline reproduced exactly first): motion 99/25 -> 101/26, AnimatePresence 11/6 -> 12/7, importers 27 -> 28, `next/image` 16 -> 17, raw `<img>` 3 -> 4, plus radii, shadows, type scale, widths. F21 now "3 of 28".
- Faults: 41 rows re-checked: 0 FIXED, 41 STILL OPEN (several with moved lines), 6 NEW (F42-F47).
- Answers-questions: four topics added (home countdown, `/live` feed and photos, festival guide/highlights, mobile app). How-to: added "Change the home-page festival countdown". Coverage 71/71 -> 76/76.

Commits that drove the biggest changes: `ee8390c` (festival countdown on home, `EventCountdown` rewrite,
`UpcomingEvents` layout), `f353d51` (`FestivalLiveUpdates` + `/live` layout), `108d980` / `293e874` /
`6fc2ac7` / `a99a658` (`FestivalPhotoHighlights`, Unsplash `MOCK_PHOTOS` on `/live`), `4b00109` / `d2c1b01`
(`FestivalGuide`, local photo highlights in `FestivalExperience`), `6408c1d` (blanket eslint-disable),
`fdaff98` (knowledge store moved to Supabase, M08). The 2026-09-19 commits `22d7a18`, `9581e51`, `54efe2c`,
`f5582d2` touched `gallery/page.tsx` and `testimonial.service.ts` but net to no change against the snapshot.

- UNCLEAR: whether the `/live` mock feed and stock photos were meant as a design preview awaiting a CMS (the commit messages call them "components", no follow-up wiring exists) or are intended to ship as is.
- UNCLEAR: whether Supabase `gallery_albums`/`gallery_media` (read by `apps/mobile`) and Firestore `galleryAlbums`/`galleryMedia` (read by `services/gallery.service.ts`) are kept in sync by any job; no sync code was found in this chunk.

## Verification log (2026-10-18)

Skeptic pass over the refreshed file against HEAD `424fdb8` (`git log -1` shows `3d6aa9d`, a docs-only commit on top of it). 324 distinct backticked path tokens were re-checked (345 after these edits; the re-run gives zero real misses). The only misses are the deliberately absent or illustrative ones: `components/ui/Section.tsx`, `app/api/gallery/videos`, `app/contact`, `app/(public)/contact`, `public/images/temple-hero.jpg`, the `<Name>` template and the `A|B|C` shorthand. 33 claims were re-derived from code, all 50 fault rows were re-opened, and the 76-file inventory was re-diffed (none unmentioned). The delta claim held: 14 modified, 5 added, 8 header-only, 1 whitespace, 1 apostrophe. The visual-inventory recount reproduced: 101/26 motion, 12/7 AnimatePresence, 28 importers, 17 `<Image>`, 4 `<img>`, 51/11/1 button/aria/role, 87 console.

- Answers: "the whole public site renders blank until JS loads" -> spinners, defaults and empty bands in server-rendered HTML -> `"use client"` pages are still server-rendered; `Hero.tsx:61-67` returns a spinner section, not nothing.
- Answers: "the rest are deep-linked by Raya AI" -> per-route sources (AI registry, AI composer, admin featured card) -> `lib/ai/composer/composer.ts:337`, `app/admin/featured/page.tsx:76`.
- Data flow 1 step 3: "dashboard section renders nothing" on failure -> a permanent skeleton -> `DailySpiritualDashboard.tsx:266`, `:277`, `:309`. New fault M02-F49.
- Data flow 1 step 5: "spinner until the snapshot arrives" -> spinner for one tick, then the default config, then the CMS values; two listeners (Hero + Panchanga) -> `hooks/useHomepage.ts:16-21`, `:36-37`.
- Data flow 1 step 6 / F17 / How-to: "six" round-trips while listing seven -> seven -> the F17 list itself.
- Data flow 2 step 4: "EventGrid filters again" -> only without `limit`; the home band renders unfiltered -> `EventGrid.tsx:114-121`.
- Data flow 8 / F47: the column empties after "`2027-04-02`" -> after Mahashivaratri `2027-03-06`, i.e. from 2027-03-07, 140 days from today -> `data/calendar.ts:52`, `lib/festival-utils.ts:12-23`; `2027-04-02` is an ekadashi.
- Entry points / F07: "5 streams, all `dQw4w9WgXcQ`" -> four YouTube entries with that id, plus one Facebook entry with no URL -> `app/(public)/live/page.tsx:63-71`.
- F30 / timeline and live trees: "fake spinner" -> the `loading` state is never read, so no spinner renders -> `live/page.tsx:128`, `:133`; `timeline/page.tsx:187`, `:194` (the only `loading` hits).
- Volunteer tree: `services/chat.service.ts:206` -> `:260` (the line moved after 2026-09-19 and the refresh missed it) -> `grep -n submitVolunteerRequest services/chat.service.ts`.
- Key files `hooks/useHomepage.ts`: "+ `HomepageForm.tsx` in M05" -> exactly 3 consumers, all in M02 -> `HomepageForm.tsx:9` imports `useHomepageForm`, not `useHomepage`. This was wrong since the 2026-09-19 log.
- F18: `services/homepage.service.ts:108` -> `:109` (`templeAddress`) -> `grep -n templeAddress`.
- F44: extended with the missing `/images/p pattern.svg` -> `live/page.tsx:169`, `timeline/page.tsx:229`.
- New M02-F48 (HIGH): neither CSP's `connect-src` allows Supabase, so the browser-side events reads are blocked -> `next.config.ts:34`, `proxy.ts:38`, `services/event.service.ts:2-4`.
- New M02-F50 (LOW): `limit={4}` in a 3-column grid leaves an orphan card -> `EventGrid.tsx:116`, `UpcomingEvents.tsx:37`.

Re-verified unchanged: F01-F06, F08-F16, F19-F29 and F31-F46 at the cited lines. Among the refresh's new rows, F42 is confirmed (stock-photo captions `live/page.tsx:99-124`; "Real-time updates" `FestivalLiveUpdates.tsx:57`; "refreshed automatically" `:118`). F43 is also confirmed and is worse than stated: module-scope `Date.now()` on the server is frozen when the module first loads, so the server's "minutes ago" times drift by hours. F45 is confirmed: exactly 8 chunk files carry a line-1 `/* eslint-disable */` added by `6408c1d` on 2026-10-03. F46 is confirmed.
