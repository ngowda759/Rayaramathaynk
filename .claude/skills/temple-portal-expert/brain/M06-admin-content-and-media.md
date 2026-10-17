# M06 - Admin console - content, events, gallery, media and library
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs. Verify against the code before acting on any claim.

## Answers questions about

- How does an admin create or edit a temple event end to end, and where does that event actually get stored?
- Why do event dates break when saved (Firestore `Timestamp` written into a Supabase column)?
- Which of the six `/admin/gallery/*` routes are live, which are duplicates, and which one does the sidebar link to?
- How does image/video upload work - Firebase Storage, Vercel Blob, or files committed to `public/`?
- Why do uploads and the "Vercel Blob Videos" panel silently do nothing?
- Where is the gallery album vs media data model (`galleryAlbums` / `galleryMedia`) and what are the default seven fallback images?
- Where is the admin left-hand menu actually defined (answer: the inline `allNavigation` array in
  `components/admin/layout/AdminSidebar.tsx:37`, **not** `components/admin/layout/navigation.ts`,
  which has no importer) and why are `/admin/media`, `/admin/content`, `/admin/library`,
  `/admin/quotes`, `/admin/stotras` and `/admin/shlokas` unreachable from it?
- Where is tiptap used, how is rich-text content stored, and is it sanitised on the public side?
- Which admin pages are real CRUD and which are mock screens with hardcoded arrays?
- Which datastore backs each content module (Firestore vs Supabase vs static `data/*.ts` vs `public/`)?
- How do the quote admin screens talk to `/api/admin/quotes/*`, and why can't you edit or delete a quote from the quotes list?
- What does `/api/revalidate` do and who actually calls it after a content change?
- How are testimonials approved, and why are there two separate testimonial code paths?
- Where are temple-explorer areas managed and why do two near-identical API route trees exist for them?
- What validation exists on each admin form, and which forms have none?
- Which files in this module are dead code that can be deleted?
- What auth protects the admin content APIs (answer: nothing at the route level)?
- Which pieces of this module would survive a move to React Native and which would have to be rewritten?
- How do I add a new field to a gallery item / an event / an announcement?
- How do I add a new admin content page and wire it into the menu?
- What does `lib/gallery.ts` do and who uses it (public homepage, not admin)?
- Why does the admin gallery show seven images that cannot be edited?

## Purpose and business role

This module is the content-editing half of the temple admin console. It is what a temple
administrator opens to publish an event, add photographs of a Rathotsava, post an announcement
banner, curate devotional quotes shown on the homepage, approve devotee testimonials, and describe
the physical areas of the temple for the public "Temple Explorer".

In practice the module is three layers of sediment rather than one design:

1. **Working Firestore/Supabase CRUD** - events (Supabase `events`), announcements (Firestore
   `announcements`), gallery albums and media (Firestore `galleryAlbums` / `galleryMedia`), quotes
   (Firestore `quotes`, via API routes), temple areas (Supabase `temple_areas`), testimonials
   (Firestore `testimonials`).
2. **Half-finished screens** - the media library (`/admin/media`), the content dashboard
   (`/admin/content`) and several duplicate gallery routes, which render but read the wrong
   collections or have no-op buttons.
3. **Pure mock screens** - `/admin/library` and `/admin/stotras` are hardcoded arrays; `/admin/shlokas`
   edits a copy of the static `data/shlokas.ts` file in React state and loses everything on reload.

The upload story is the single biggest gap: there is no upload API route anywhere in the repo. Every
upload path calls `@vercel/blob` directly from a client component using a server-only token, so
image and video upload cannot work in a deployed build. Media in practice arrives by committing
files into `public/images/temple` and typing the path into a text field.

## Code roots

From `.claude/state/chunks.json` (chunk M06):

```
app/admin/events              app/admin/gallery             app/admin/media
app/admin/announcements       app/admin/content             app/admin/library
app/admin/quotes              app/admin/testimonials        app/admin/shlokas
app/admin/stotras             app/admin/temple-areas
components/admin/events       components/admin/gallery      components/admin/announcements
services/storage.service.ts   services/gallery.service.ts   lib/gallery.ts
app/api/storage               app/api/gallery               app/api/admin/quotes
app/api/admin/temple-areas    app/api/temple-areas          app/api/testimonials
app/api/announcements         app/api/events                app/api/revalidate
types/gallery.ts  types/event.ts  types/quote.ts  types/announcement.ts
```

**Adopted from the Unassigned list** (`.claude/state/inventory/SUMMARY.md`):

- `components/admin/RichTextEditor.tsx` - the repo's only tiptap editor; it belongs to the
  "rich text" focus question of this chunk. It is dead code (see M06-F11).

Deliberately **not** adopted: `scripts/export-events.ts`, `scripts/import-events.ts`,
`scripts/generate-events-firestore.ts` (event data migration scripts - tooling, belongs with M11/M15),
`components/admin/AdminSidebar.tsx`, `components/admin/AdminHeader.tsx`, `components/admin/DashboardCard.tsx`
(admin shell - M05).

**If you are here about events, read this.** The three event scripts are now documented in
[M11](M11-data-model-persistence-and-migration.md) - *Code roots* (the adopted-file table) and
*Data flow*. They matter to this module because they write the **same Firestore `events`
collection** that `/admin/events` edits, from outside the admin UI and outside any service:
`scripts/export-events.ts:51,84` generates aaradhane events from the Panchanga files and writes
`data/exports/aaradhane-events-<year>.json`; `scripts/import-events.ts:64` `add()`s each row of that
file into `events` with **no de-duplication**, so running it twice doubles the calendar;
`scripts/generate-events-firestore.ts` does both jobs in one pass against a hardcoded
`TARGET_YEAR = 2026` (`:53`). An unexplained duplicate event in `/admin/events` is almost always one
of these having been run, not an admin action. The generator engine itself is M14.

## Entry points

All `/admin/*` routes sit under `app/admin/layout.tsx`, which wraps children in
`AdminAuthGuard` (`app/admin/layout.tsx:24`) and `AdminShell`. There is **no `middleware.ts`** in the
repo, so the only gate is that client-side guard. Every API route below is completely unauthenticated.

| Route or entry | File | server/client | Auth required | What it renders or does |
|---|---|---|---|---|
| `/admin/events` | `app/admin/events/page.tsx` | client | AdminAuthGuard only | Event list + stats + search; loads via `eventService.getEvents()` |
| `/admin/events` (skeleton) | `app/admin/events/loading.tsx` | server | — | Route-level loading skeleton |
| `/admin/events/new` | `app/admin/events/new/page.tsx` | server | AdminAuthGuard only | Heading + `<EventForm />` |
| `/admin/events/[id]/edit` | `app/admin/events/[id]/edit/page.tsx` | server | AdminAuthGuard only | `await eventService.getEvent(id)`, `notFound()` if missing, `<EventForm mode="edit">` |
| `/admin/gallery` | `app/admin/gallery/page.tsx` | client | AdminAuthGuard only | `<AdminPageWrapper>` + `<GalleryDashboard />` — **the only gallery route in the sidebar** |
| `/admin/gallery/media` | `app/admin/gallery/media/page.tsx` | client | AdminAuthGuard only | Same `<GalleryDashboard />`, different heading. Duplicate; nothing links to it |
| `/admin/gallery/new` | `app/admin/gallery/new/page.tsx` | client | AdminAuthGuard only | `<GalleryForm mode="create">` → `galleryService.createImage`. Linked from `/admin/content` (`content/page.tsx:236,479`) and from the admin quick-search (`components/admin/dashboard/AdminSearchResults.tsx:34`), not from the sidebar |
| `/admin/gallery/[id]/edit` | `app/admin/gallery/[id]/edit/page.tsx` | client | AdminAuthGuard only | `<GalleryForm mode="edit">` → `galleryService.updateImage` |
| `/admin/gallery/create` | `app/admin/gallery/create/page.tsx` | server | AdminAuthGuard only | `<CreateImage />` — parallel, hand-rolled create form. Unlinked |
| `/admin/gallery/edit/[id]` | `app/admin/gallery/edit/[id]/page.tsx` | server | AdminAuthGuard only | `<EditImage imageId>` — parallel edit form. Only `GalleryTable.tsx` (dead) links here |
| `/admin/media` | `app/admin/media/page.tsx` | client | AdminAuthGuard only | "Media Library" browser over `galleryMedia` + `galleryAlbums`; Upload button is a no-op |
| `/admin/content` | `app/admin/content/page.tsx` | client | AdminAuthGuard only | Content dashboard: counts, recent items, drafts, quick-action links |
| `/admin/library` | `app/admin/library/page.tsx` | client | AdminAuthGuard only | Mock library table over `SAMPLE_ITEMS`; no persistence |
| `/admin/announcements` | `app/admin/announcements/page.tsx` | client | AdminAuthGuard only | `CrudTable` over `announcementService.getAnnouncements()` |
| `/admin/announcements/new` | `app/admin/announcements/new/page.tsx` | client | AdminAuthGuard only | `<AnnouncementForm mode="create">` |
| `/admin/announcements/[id]/edit` | `app/admin/announcements/[id]/edit/page.tsx` | client | AdminAuthGuard only | `<AnnouncementForm mode="edit">` |
| `/admin/quotes` | `app/admin/quotes/page.tsx` | client | AdminAuthGuard only | Quote list, filters, import/export/seed/cache dialogs |
| `/admin/quotes/new` | `app/admin/quotes/new/page.tsx` | client | AdminAuthGuard only | 600-line quote form → `POST /api/admin/quotes` |
| `/admin/quotes/[id]/edit` | `app/admin/quotes/[id]/edit/page.tsx` | client | AdminAuthGuard only | Near-identical form → `PUT /api/admin/quotes/[id]` |
| `/admin/testimonials` | `app/admin/testimonials/page.tsx` | client | AdminAuthGuard only | Testimonial cards, approve/reject/edit, modal form |
| `/admin/shlokas` | `app/admin/shlokas/page.tsx` | client | AdminAuthGuard only | In-memory editor seeded from `data/shlokas.ts` |
| `/admin/stotras` | `app/admin/stotras/page.tsx` | client | AdminAuthGuard only | Mock stotra grid over `SAMPLE_STOTRAS` |
| `/admin/temple-areas` | `app/admin/temple-areas/page.tsx` | client | AdminAuthGuard only | Temple-explorer area CRUD via `/api/admin/temple-areas` |
| `GET /api/storage/videos` | `app/api/storage/videos/route.ts` | server | **none** | `storageService.listVideos()` → Blob listing. No in-repo caller |
| `GET,DELETE /api/gallery/local-assets` | `app/api/gallery/local-assets/route.ts` | server | **none** | Lists / deletes files under `public/images/temple` and `public/videos` |
| `GET,POST,PATCH,DELETE /api/admin/quotes` | `app/api/admin/quotes/route.ts` | server | **none** | Quote list, create, bulk update, bulk delete |
| `GET,PUT,DELETE /api/admin/quotes/[id]` | `app/api/admin/quotes/[id]/route.ts` | server | **none** | Single-quote read/update/delete + cache clear |
| `POST,GET /api/admin/quotes/bulk` | `app/api/admin/quotes/bulk/route.ts` | server | **none** | Bulk import (with `mode:"validate"`) and JSON export |
| `POST /api/admin/quotes/cache` | `app/api/admin/quotes/cache/route.ts` | server | **none** | `quoteService.clearCache()` |
| `POST /api/admin/quotes/seed` | `app/api/admin/quotes/seed/route.ts` | server | **none** | `quoteService.seedDefaultQuotes()` |
| `GET,POST /api/admin/temple-areas` | `app/api/admin/temple-areas/route.ts` | server | **none** | Supabase `temple_areas` list / create |
| `GET,PUT,DELETE /api/admin/temple-areas/[id]` | `app/api/admin/temple-areas/[id]/route.ts` | server | **none** | Single area CRUD |
| `GET,POST /api/temple-areas` | `app/api/temple-areas/route.ts` | server | **none** | Public list (`getPublicAreas`) **plus an unauthenticated create** |
| `GET,PUT,DELETE /api/temple-areas/[id]` | `app/api/temple-areas/[id]/route.ts` | server | **none** | Public read plus unauthenticated update/delete |
| `POST,GET /api/testimonials` | `app/api/testimonials/route.ts` | server | **none** | Submit / list approved testimonials via `chat.service`. No in-repo caller |
| `GET,POST /api/announcements` | `app/api/announcements/route.ts` | server | **none** | Announcement list/create. No in-repo caller |
| `GET,PATCH,DELETE /api/announcements/[id]` | `app/api/announcements/[id]/route.ts` | server | **none** | Single announcement. No in-repo caller |
| `GET,POST /api/events` | `app/api/events/route.ts` | server | **none** | Event list/create. No in-repo caller |
| `GET,PATCH,DELETE /api/events/[id]` | `app/api/events/[id]/route.ts` | server | **none** | Single event. No in-repo caller |
| `POST /api/revalidate` | `app/api/revalidate/route.ts` | server | **none** | `revalidatePath()` for the posted paths. Only caller is `components/admin/settings/homepage/useHomepageForm.ts:91` (M05) |

## Component trees

### Shared admin frame (drawn once, applies to every `/admin/*` page below)

```
AdminLayout (server) app/admin/layout.tsx
└── Suspense
    └── AdminAuthGuard (client) components/admin/layout/AdminAuthGuard.tsx     [M05]
        └── AdminShell (client) components/admin/layout/AdminShell.tsx          [M05]
            ├── AdminSidebar (client) components/admin/layout/AdminSidebar.tsx  [M05]
            │   └── allNavigation[] declared INLINE in that file, line 37       [M05]
            │       (components/admin/layout/navigation.ts has no importer - dead; see M06-F29)
            ├── <main id="main-content">{page}</main>
            └── GoUpButton (client)                                             [M01]
```

`components/admin/AdminSidebar.tsx` is a second, unused sidebar (only `components/admin/layout/AdminSidebar.tsx`
is mounted, via `AdminShell.tsx:5`). There are in fact **three** menu definitions in the repo and only
one is live: the inline `allNavigation` array in `components/admin/layout/AdminSidebar.tsx:37`
(mounted), `components/admin/layout/navigation.ts` (no importer anywhere) and
`components/admin/AdminSidebar.tsx:86` (unused component). The live list *does* link
`/admin/testimonials` (`AdminSidebar.tsx:68`) and `/admin/temple-areas` ("Temple Explorer",
`AdminSidebar.tsx:88`); its "Shlokas" entry points at `/admin/settings/shlokas` (`:72`), a different
route, so `/admin/shlokas` is unreachable from the menu. `/admin/media`, `/admin/content`,
`/admin/library`, `/admin/quotes` and `/admin/stotras` appear in no menu at all.

### Events

```
EventsPage (client) app/admin/events/page.tsx
├── AdminPageHeader (server) components/admin/common/AdminPageHeader.tsx          [M05]
│   └── Button > Link -> /admin/events/new
├── EventStats (server) components/admin/events/EventStats.tsx
│   └── StatCard x4 components/admin/common/StatCard.tsx                          [M05]
├── SearchBox (client) components/admin/common/SearchBox.tsx                      [M05]
└── EventTable (client) components/admin/events/EventTable.tsx
    └── CrudTable<TempleEvent> (client) components/admin/crud/CrudTable.tsx       [M05]
        ├── createCrudColumns(eventColumns, actions) components/admin/crud/createCrudColumns.tsx
        └── CrudTableCell -> TableActions (onEdit -> router.push, onDelete -> eventService.deleteEvent)
    hooks: useState(deletingId), useRouter
    services: eventService.deleteEvent  (services/event.service.ts -> Supabase 'events')
utils: getEventStatus, sortEventsByDate (utils/event.ts)                          [M01]

NewEventPage (server) app/admin/events/new/page.tsx
└── EventForm (client) components/admin/events/EventForm.tsx

EditEventPage (server) app/admin/events/[id]/edit/page.tsx
├── await eventService.getEvent(id)  -> notFound() when null
└── EventForm (client) mode="edit" initialData={event}

EventForm (client) components/admin/events/EventForm.tsx
├── Input/Label/Button (components/ui/*)                                          [M01]
├── local helpers toJsDate / toDateTimeInputs / toTimestamp (lines 19-68)
├── hand-rolled validate() (line 94) - NOT the zod schema in EventSchema.ts
└── eventService.addEvent | updateEvent -> router.push('/admin/events'); router.refresh()
```

Unmounted event components: `EventSearch.tsx`, `EventStatusBadge.tsx`, `DeleteEventDialog.tsx`,
`EventSchema.ts`.

### Gallery (the live path)

```
AdminGalleryPage (client) app/admin/gallery/page.tsx
└── AdminPageWrapper (client)                                                     [M05]
    ├── AdminPageHeader (server)                                                  [M05]
    └── GalleryDashboard (client) components/admin/gallery/GalleryDashboard.tsx
        ├── load(): Promise.all([
        │       galleryService.getAlbums(),      -> Firestore galleryAlbums
        │       galleryService.getMedia(),       -> Firestore galleryMedia (falls back to DEFAULT_GALLERY_IMAGES)
        │       storageService.listVideos()      -> @vercel/blob list()  [fails in browser, .catch(()=>[])]
        │     ])
        ├── GalleryStats (client) GalleryStats.tsx          albums/media/featured/videos cards
        ├── GalleryToolbar (client) GalleryToolbar.tsx      Refresh | New Album | "Add Media" (no handler)
        ├── AlbumGrid (client) AlbumGrid.tsx
        │   └── next/image cover + Pencil/Trash2 icon Buttons
        ├── MediaGrid (client) MediaGrid.tsx
        │   ├── MediaCard (client) MediaCard.tsx x N        next/image or Video icon
        │   ├── MediaDialog (client) MediaDialog.tsx
        │   │   ├── Select album / type / category (components/ui/select.tsx)      [M01]
        │   │   ├── ImageUploader (client) components/ui/ImageUploader.tsx         [M01]
        │   │   │   └── storageService.uploadBase64Image -> @vercel/blob put()
        │   │   └── VideoUploader (client) components/ui/VideoUploader.tsx         [M01]
        │   │       └── storageService.uploadVideo       -> @vercel/blob put()
        │   └── DeleteDialog (client) DeleteDialog.tsx
        ├── VideosManager (client) VideosManager.tsx
        │   └── storageService.deleteFile(url)            -> @vercel/blob del()
        ├── AlbumDialog (client) AlbumDialog.tsx          -> galleryService.createAlbum/updateAlbum
        └── DeleteDialog (client)                         -> galleryService.deleteAlbum
```

### Gallery (the three parallel, mostly-unlinked paths)

```
GalleryMediaPage (client) app/admin/gallery/media/page.tsx  -> same GalleryDashboard  (duplicate route)

NewGalleryPage (client) app/admin/gallery/new/page.tsx
└── GalleryForm (client) components/admin/gallery/GalleryForm.tsx
    └── FormContainer/FormSection/FormTextField/FormTextArea/FormSelectField/
        FormNumberField/FormSwitchField/FormActions (components/ui/form/*)         [M01]
    hooks: useAuth (for uploadedBy), useRouter
    service: galleryService.createImage(data, user?.email ?? "admin")

EditGalleryPage (client) app/admin/gallery/[id]/edit/page.tsx
└── GalleryForm mode="edit"   <- galleryService.getImageById / updateImage

CreateGalleryPage (server) app/admin/gallery/create/page.tsx
└── CreateImage (client) components/admin/gallery/CreateImage.tsx   [raw Input/Select/Switch, own validate()]

EditGalleryPage (server) app/admin/gallery/edit/[id]/page.tsx
└── EditImage (client) components/admin/gallery/EditImage.tsx       [raw inputs, own validate()]

GalleryTable (client) components/admin/gallery/GalleryTable.tsx     [DEAD - no importer]
└── components/ui/table.tsx primitives; moveOrder / toggleFeatured / delete via galleryService

LocalGalleryAssets (client) components/admin/gallery/LocalGalleryAssets.tsx  [DEAD - no importer]
└── fetch('/api/gallery/local-assets') DELETE; galleryService.createImage
```

### Announcements

```
AnnouncementsPage (client) app/admin/announcements/page.tsx
├── AdminPageHeader + Button > Link -> /admin/announcements/new
├── SearchBox (client)
└── CrudTable<Announcement> (client)  columns = announcementColumns (app/admin/announcements/columns.ts)
        actions: onEdit -> router.push(.../edit), onDelete -> announcementService.deleteAnnouncement

NewAnnouncementPage / EditAnnouncementPage (client)
└── AnnouncementForm (client) components/admin/announcements/AnnouncementForm.tsx
    └── FormContainer > FormSection > FormTextField(title) / FormTextArea(message) /
        FormTextField(link) / FormSwitchField(isActive) / FormActions
    service: announcementService.addAnnouncement | updateAnnouncement -> Firestore 'announcements'
```

### Quotes

```
QuotesPage (client) app/admin/quotes/page.tsx
├── AdminPageHeader (Export / Import / Seed Default / Add Quote)
├── stats cards           <- GET /api/quotes/stats            [route owned by M08/M12]
├── Badge row per category
├── SearchBox + DropdownMenu filters + "Clear Cache"  -> POST /api/admin/quotes/cache
├── CrudTable<Quote> columns = quoteColumns (app/admin/quotes/columns.tsx)
│      NOTE: quoteColumns has no `actions` column, so the onEdit/onDelete passed here never render
├── Dialog "Import Quotes"  -> POST /api/admin/quotes/bulk
└── Dialog "Rotation Preview" -> GET /api/quotes/preview?days=7

NewQuotePage (client) app/admin/quotes/new/page.tsx        -> POST /api/admin/quotes
EditQuotePage (client) app/admin/quotes/[id]/edit/page.tsx -> GET/PUT/DELETE /api/admin/quotes/[id]
  both: Input/Textarea/Label/Select/Checkbox/Tabs (components/ui/*), local QuoteFormData,
        local validate(), festivalOptions/weekdayOptions/languageOptions const arrays.
        The two files are ~90% identical (diff is load-on-mount, PUT vs POST, and a delete button).
```

### The remaining single-file pages

```
MediaLibraryPage (client) app/admin/media/page.tsx
├── useAuth() (profile unused)
├── loadMedia(): getDocs(collection(db,'galleryMedia')) + getDocs(collection(db,'galleryAlbums'))
│      maps data.url || data.imageUrl  <- Firestore actually stores `imagePath`
├── defaultMedia[] hardcoded (/images/Hero.jpg, /images/gallery/sample1.jpg, sample2.jpg)
├── grid view / list view toggle, folder + type filters, search
├── detail modal with copy-URL
└── "Upload Media" button - no onClick

ContentDashboardPage (client) app/admin/content/page.tsx
├── useAuth() (profile unused)
├── getCountFromServer over events / announcements / gallery / sevas / poojas / knowledge /
│      testimonials / volunteer_requests
├── recent + draft lists from events / announcements / knowledge
├── contentCards[] -> /admin/events, /admin/announcements, /admin/gallery, /admin/sevas,
│      /admin/pooja, /admin/knowledge (+ addHref, one of which - /admin/knowledge/new - does not exist)
└── nav tiles -> /admin/media, /admin/featured, /admin/settings, /

LibraryAdminPage (client) app/admin/library/page.tsx     SAMPLE_ITEMS[] only; Add/Edit/Delete are no-ops
StotrasAdminPage (client) app/admin/stotras/page.tsx     SAMPLE_STOTRAS[] only; Add/Edit/Delete are no-ops
ShlokasAdminPage (client) app/admin/shlokas/page.tsx     useState(shlokasData from data/shlokas.ts); edits are in-memory

TestimonialsPage (client) app/admin/testimonials/page.tsx
├── testimonial.service: getAllTestimonials / createTestimonial / updateTestimonial /
│      deleteTestimonial / approveTestimonial / rejectTestimonial  -> Firestore 'testimonials'
├── filter tabs all | pending | approved | rejected
├── card grid with next/image (getImageSrc prefixes /images/testimonials/)
└── modal form (name, location, quote, years, image path)

TempleAreasPage (client) app/admin/temple-areas/page.tsx
├── fetch('/api/admin/temple-areas')            -> Supabase temple_areas
├── grouped by category (sanctum|halls|facilities|gardens|historical)
├── Dialog edit/create -> PUT/POST /api/admin/temple-areas[/:id]
└── Dialog delete      -> DELETE /api/admin/temple-areas/:id
```

## Data flow

### 1. Create a temple event

1. Admin opens `/admin/events/new` (`app/admin/events/new/page.tsx:3`), which renders `EventForm`.
2. `EventForm` keeps flat string state for `startDate`/`startTime`/`endDate`/`endTime`
   (`components/admin/events/EventForm.tsx:81`).
3. Submit → `validate()` (`EventForm.tsx:94`) checks title ≥ 3, description ≥ 10, location ≥ 2,
   both dates present, end ≥ start. On failure it calls `alert()` (`EventForm.tsx:134`).
4. `toTimestamp(date, time)` builds a **Firestore `Timestamp`** (`EventForm.tsx:59-68`).
5. `eventService.addEvent({... startDate: Timestamp, published: true, status: "Upcoming" })`
   (`EventForm.tsx:160`).
6. `services/event.service.ts:70` maps to snake_case and `supabase.from('events').insert(...)` -
   `start_date` receives the `Timestamp` object, not an ISO string (see M06-F06).
7. `router.push("/admin/events"); router.refresh()` (`EventForm.tsx:175`). **No** `revalidatePath`
   call, so the public `/events` ISR cache is not invalidated.

### 2. Add a gallery photo through the dashboard

1. `/admin/gallery` → `GalleryDashboard` → `MediaGrid` → "+ Add Media" (`MediaGrid.tsx:69`) opens
   `MediaDialog`.
2. For `type === "photo"`, `MediaDialog` renders `ImageUploader` (`MediaDialog.tsx:260`).
3. `ImageUploader` validates type and `maxSizeMB` (10 here), converts the file to base64 and calls
   `storageService.uploadBase64Image(base64, filename, "gallery")`
   (`components/ui/ImageUploader.tsx:67`).
4. `storage.service.ts:69` calls `put(pathname, blob, { access: 'public' })` from `@vercel/blob`.
   **This runs in the browser** and needs `BLOB_READ_WRITE_TOKEN`, which is server-only
   (`.env.example:20`) → the upload fails (M06-F01). The returned URL would have gone into
   `imagePath`.
5. `handleSave()` (`MediaDialog.tsx:115`) calls `MediaGrid.saveMedia` → `galleryService.createMedia(data, "admin")`
   (`MediaGrid.tsx:41`, hardcoded uploader).
6. `gallery.service.ts:219` `addDoc(collection(db,'galleryMedia'), { albumId: media.albumId ?? "temple",
   type: media.type ?? "photo", ...media, uploadedBy, uploadedAt: serverTimestamp() })`.
7. `onRefresh()` re-runs `GalleryDashboard.load()`.

The workaround actually in use: commit the file to `public/images/temple/`, then type
`/images/temple/<file>.jpg` into the "Image Path" field of `GalleryForm` / `CreateImage`.

### 3. Publish an announcement

1. `/admin/announcements/new` → `AnnouncementForm` (`components/admin/announcements/AnnouncementForm.tsx`).
2. `validate()` (`AnnouncementForm.tsx:63`) requires title and message.
3. `handleCreate` → `announcementService.addAnnouncement(data)`
   (`app/admin/announcements/new/page.tsx:24`).
4. `services/announcement.service.ts:58` `addDoc(collection(db,'announcements'), {...,
   createdAt: serverTimestamp(), updatedAt: serverTimestamp()})` - browser Firestore SDK, so
   Firestore rules are the only server-side check.
5. `toast.success(...)`, `router.push("/admin/announcements")`.
6. The public consumer is `components/home/AnnouncementBar.tsx:17`, which calls
   `announcementService.getActiveAnnouncements()` - the same collection filtered on
   `isActive == true` (`announcement.service.ts:48`) - and passes the result as a prop to
   `components/home/AnnouncementMarquee.tsx` (`AnnouncementBar.tsx:38`), which fetches nothing itself.

### 4. Create a devotional quote

1. `/admin/quotes/new` → local `QuoteFormData` state (`app/admin/quotes/new/page.tsx:83`).
2. `validate()` (`new/page.tsx:174`) requires title, category, source and at least one of
   kannada / sanskrit / translationEnglish.
3. `fetch("/api/admin/quotes", { method: "POST", body: JSON.stringify({...formData, slug}) })`
   (`new/page.tsx:210`).
4. `app/api/admin/quotes/route.ts:44` re-checks title/category/source, reads the caller's identity
   from an **unverified `x-user-email` header** (`route.ts:46`) and calls
   `quoteService.createQuote({...body, createdBy: userEmail})`.
5. `services/quote.service.ts:367` `addDoc(collection(db,'quotes'), ...)` (Firestore, client SDK
   imported into a server route).
6. Redirect to `/admin/quotes`; the list re-fetches `GET /api/admin/quotes`.

### 5. Manage a temple-explorer area

1. `/admin/temple-areas` `loadAreas()` → `GET /api/admin/temple-areas`
   (`app/admin/temple-areas/page.tsx:45`).
2. `app/api/admin/temple-areas/route.ts:6` → `templeAreasService.getAreas()`.
3. `services/temple-areas.service.ts:4` re-exports `templeAreasSupabaseService`, which queries
   Supabase table `temple_areas` (`services/temple-areas.supabase.service.ts:6,16`).
4. Save → `PUT|POST /api/admin/temple-areas[/:id]` (`page.tsx:99`) → `updateArea` / `addArea`.
5. The public Temple Explorer reads the same data through the parallel route
   `/api/temple-areas` (`components/temple-explorer/TempleExplorer.tsx:44`).

### 6. Manage assets already committed to `public/`

1. `GET /api/gallery/local-assets` scans `public/images/temple` and `public/videos` with `fs.readdirSync`
   (`app/api/gallery/local-assets/route.ts:31-35`).
2. `LocalGalleryAssets` renders them, offering "Copy path", "Add to gallery"
   (`galleryService.createImage` with category `Temple Infrastructure`,
   `LocalGalleryAssets.tsx:71`) and "Delete file" (`DELETE /api/gallery/local-assets`,
   `LocalGalleryAssets.tsx:47`).
3. The DELETE handler normalises the path, restricts it to `/images/temple/` or `/videos/`, then
   `fs.unlinkSync` (`route.ts:46-57`). No auth check, and on Vercel the filesystem is read-only.
4. **`LocalGalleryAssets` has no importer**, so step 2-3 is unreachable from the UI today.
   `lib/gallery.ts:21 getTempleGalleryImages()` does the same directory scan for the *public*
   homepage (`app/(public)/page.tsx`, `components/home/TempleGalleryPreview.tsx`).

## Key files

| File | Lines | Role | Key exports | Notes |
|---|---:|---|---|---|
| `app/admin/events/page.tsx` | 115 | Event list screen | `EventsPage` | client; stats computed in-render from `utils/event.ts` |
| `app/admin/events/columns.ts` | 36 | Event table columns | `eventColumns` | includes an `actions` column |
| `app/admin/events/loading.tsx` | 25 | Route skeleton | `Loading` | only `loading.tsx` in this module |
| `app/admin/events/new/page.tsx` | 20 | Create page shell | `NewEventPage` | server component |
| `app/admin/events/[id]/edit/page.tsx` | 42 | Edit page shell | `EditEventPage` | server component awaiting `eventService.getEvent` |
| `components/admin/events/EventForm.tsx` | 337 | The only real event form | `EventForm` | hand-rolled validation, `alert()` on error |
| `components/admin/events/EventSchema.ts` | 26 | zod schema | `eventSchema`, `EventFormValues` | **dead** - nothing imports it |
| `components/admin/events/EventTable.tsx` | 65 | CrudTable wrapper | `EventTable` | `confirm()` before delete |
| `components/admin/events/EventStats.tsx` | 55 | 4 stat cards | `EventStats` | server component |
| `components/admin/events/EventSearch.tsx` | 24 | Search input | `EventSearch` | **dead** - page uses shared `SearchBox` |
| `components/admin/events/EventStatusBadge.tsx` | 20 | Status pill | `EventStatusBadge` | **dead** |
| `components/admin/events/DeleteEventDialog.tsx` | 50 | Delete button | `DeleteEventDialog` | **dead** |
| `app/admin/gallery/page.tsx` | 21 | Gallery entry (linked) | `AdminGalleryPage` | wraps `GalleryDashboard` |
| `app/admin/gallery/media/page.tsx` | 18 | Duplicate gallery entry | `GalleryMediaPage` | same dashboard, unlinked |
| `app/admin/gallery/new/page.tsx` | 56 | Create via `GalleryForm` | `NewGalleryPage` | linked from `/admin/content` and `AdminSearchResults.tsx:34`, never from the sidebar |
| `app/admin/gallery/[id]/edit/page.tsx` | 107 | Edit via `GalleryForm` | `EditGalleryPage` | client, `useParams` |
| `app/admin/gallery/create/page.tsx` | 21 | Create via `CreateImage` | `metadata`, `CreateGalleryPage` | unlinked duplicate |
| `app/admin/gallery/edit/[id]/page.tsx` | 34 | Edit via `EditImage` | `generateMetadata`, `EditGalleryPage` | unlinked duplicate |
| `app/admin/gallery/columns.ts` | 38 | Gallery table columns | `galleryColumns` | **dead** - no importer |
| `components/admin/gallery/GalleryDashboard.tsx` | 202 | Gallery orchestrator | `GalleryDashboard` | calls Blob `listVideos` from the client |
| `components/admin/gallery/GalleryStats.tsx` | 91 | Album/media/featured/video cards | `GalleryStats` | own card markup, not `StatCard` |
| `components/admin/gallery/GalleryToolbar.tsx` | 53 | Refresh / New Album / Add Media | `GalleryToolbar` | "Add Media" button has no handler (line 43) |
| `components/admin/gallery/AlbumGrid.tsx` | 111 | Album cards | `AlbumGrid` | `next/image` with `fill` |
| `components/admin/gallery/AlbumDialog.tsx` | 182 | Album create/edit modal | `AlbumDialog` | no validation at all |
| `components/admin/gallery/MediaGrid.tsx` | 132 | Media cards + dialogs | `MediaGrid` | `createMedia(data, "admin")` hardcoded |
| `components/admin/gallery/MediaCard.tsx` | 104 | Single media card | `MediaCard` | videos render an icon, not a preview |
| `components/admin/gallery/MediaDialog.tsx` | 346 | Media create/edit modal | `MediaDialog` | hosts `ImageUploader` / `VideoUploader`; no validation |
| `components/admin/gallery/DeleteDialog.tsx` | 67 | Generic confirm modal | `DeleteDialog` | reused for album and media |
| `components/admin/gallery/VideosManager.tsx` | 170 | Vercel Blob video panel | `VideosManager` | `storageService.deleteFile` from the client |
| `components/admin/gallery/GalleryForm.tsx` | 257 | Shared gallery form (form-kit) | `GalleryForm` | validates title / imagePath / altText |
| `components/admin/gallery/CreateImage.tsx` | 308 | Parallel create form | `CreateImage` | raw shadcn inputs, own validate |
| `components/admin/gallery/EditImage.tsx` | 299 | Parallel edit form | `EditImage` | raw shadcn inputs, own validate |
| `components/admin/gallery/GalleryTable.tsx` | 339 | Table view with order/feature toggles | `GalleryTable` | **dead**; the only linker of `/admin/gallery/edit/[id]` |
| `components/admin/gallery/LocalGalleryAssets.tsx` | 219 | `public/` asset browser | `LocalGalleryAssets` | **dead** |
| `components/admin/gallery/constants.ts` | 10 | Category select options | `galleryCategoryOptions` | derived from `GALLERY_CATEGORIES` |
| `app/admin/media/page.tsx` | 499 | Media library browser | `MediaLibraryPage` | reads wrong field names; upload is a no-op |
| `app/admin/content/page.tsx` | 556 | Content dashboard | `ContentDashboardPage` | counts wrong collections/fields |
| `app/admin/library/page.tsx` | 240 | Digital library (mock) | `LibraryAdminPage` | `SAMPLE_ITEMS`, no persistence |
| `app/admin/announcements/page.tsx` | 124 | Announcement list | `AnnouncementsPage` | `CrudTable` + toast |
| `app/admin/announcements/columns.ts` | 30 | Announcement columns | `announcementColumns` | `isActive` formatter |
| `app/admin/announcements/new/page.tsx` | 60 | Create shell | `NewAnnouncementPage` | |
| `app/admin/announcements/[id]/edit/page.tsx` | 127 | Edit shell | `EditAnnouncementPage` | client `useParams` load |
| `components/admin/announcements/AnnouncementForm.tsx` | 166 | Announcement form | `AnnouncementForm` | cleanest form in the module |
| `app/admin/quotes/page.tsx` | 566 | Quote console | `QuotesPage` | import/export/seed/cache/preview dialogs |
| `app/admin/quotes/columns.tsx` | 134 | Quote columns | `quoteColumns` | **no `actions` column** (M06-F05) |
| `app/admin/quotes/new/page.tsx` | 603 | Quote create form | `NewQuotePage` | duplicated by the edit page |
| `app/admin/quotes/[id]/edit/page.tsx` | 663 | Quote edit form | `EditQuotePage` | ~90% identical to the create page |
| `app/admin/testimonials/page.tsx` | 750 | Testimonial moderation | `TestimonialsPage` | approve / reject / edit / delete, image by path |
| `app/admin/shlokas/page.tsx` | 376 | Shloka editor | `ShlokasAdminPage` | in-memory only, seeded from `data/shlokas.ts` |
| `app/admin/stotras/page.tsx` | 202 | Stotra grid (mock) | `StotrasAdminPage` | `SAMPLE_STOTRAS`, buttons inert |
| `app/admin/temple-areas/page.tsx` | 472 | Temple-explorer area CRUD | `TempleAreasPage` | the only Supabase-backed admin screen here besides events |
| `services/storage.service.ts` | 340 | Vercel Blob wrapper | `UploadFolder`, `ReportFileType`, `SaveReportOptions`, `storageService` | also used by `/api/reports/*` (M05) |
| `services/gallery.service.ts` | 259 | Firestore album+media repository | `DEFAULT_GALLERY_IMAGES`, `galleryService` | `getImages`/`createImage`/`updateImage`/`deleteImage` are aliases |
| `lib/gallery.ts` | 47 | `public/images/temple` scanner | `GalleryItem`, `getTempleGalleryImages` | used by the *public* homepage, not admin |
| `app/api/storage/videos/route.ts` | 38 | Blob video listing | `GET` | no in-repo caller |
| `app/api/gallery/local-assets/route.ts` | 63 | `public/` asset list + delete | `GET`, `DELETE` | unauthenticated file deletion |
| `app/api/admin/quotes/route.ts` | 146 | Quote list/create/bulk | `GET`,`POST`,`PATCH`,`DELETE` | `filters: any`, `error: any` |
| `app/api/admin/quotes/[id]/route.ts` | 85 | Single quote | `GET`,`PUT`,`DELETE` | clears cache after write |
| `app/api/admin/quotes/bulk/route.ts` | 96 | Import/export | `POST`,`GET` | category whitelist duplicated inline (line 30) |
| `app/api/admin/quotes/cache/route.ts` | 25 | Cache clear | `POST` | |
| `app/api/admin/quotes/seed/route.ts` | 26 | Seed defaults | `POST` | seeds `DEFAULT_QUOTES_DATA` |
| `app/api/admin/temple-areas/route.ts` | 35 | Area list/create | `GET`,`POST` | `{success, ...}` envelope |
| `app/api/admin/temple-areas/[id]/route.ts` | 55 | Single area | `GET`,`PUT`,`DELETE` | |
| `app/api/temple-areas/route.ts` | 33 | Public area list + create | `GET`,`POST` | duplicate of the admin route, bare envelope |
| `app/api/temple-areas/[id]/route.ts` | 52 | Public single area | `GET`,`PUT`,`DELETE` | unauthenticated write |
| `app/api/testimonials/route.ts` | 60 | Testimonial submit/list | `POST`,`GET` | uses `chat.service`, not `testimonial.service` |
| `app/api/announcements/route.ts` | 30 | Announcement list/create | `GET`,`POST` | unused |
| `app/api/announcements/[id]/route.ts` | 50 | Single announcement | `GET`,`PATCH`,`DELETE` | unused |
| `app/api/events/route.ts` | 33 | Event list/create | `GET`,`POST` | unused; accepts `date` or `startDate` |
| `app/api/events/[id]/route.ts` | 50 | Single event | `GET`,`PATCH`,`DELETE` | unused |
| `app/api/revalidate/route.ts` | 45 | ISR revalidation | `POST` | one caller, in M05 |
| `types/gallery.ts` | 94 | Gallery types | `GalleryCategory`, `GALLERY_CATEGORIES`, `GalleryAlbum`, `GalleryMedia`, `GalleryMediaRequest`, `GalleryStats`, `GalleryImage`, `GalleryImageRequest` | `GalleryImage*` are back-compat aliases |
| `types/event.ts` | 41 | Event type | `EventStatus`, `TempleEvent` | still typed with Firestore `Timestamp` |
| `types/quote.ts` | 494 | Quote types + seed data | `QuoteCategory` … `QUOTE_CATEGORIES`, `FESTIVAL_QUOTE_MAP`, `WEEKDAY_QUOTE_MAP`, `DEFAULT_QUOTES_DATA` | seed data living in `types/` |
| `types/announcement.ts` | 17 | Announcement types | `Announcement`, `AnnouncementRequest` | |
| `components/admin/RichTextEditor.tsx` *(adopted)* | 235 | tiptap WYSIWYG | `RichTextEditor` | **dead** - no importer anywhere |

## Types and stores

### Types used

| Type file | Owner | Used by |
|---|---|---|
| `types/event.ts` | M06 | `EventForm`, `EventTable`, `eventColumns`, `event.service`, public event pages |
| `types/gallery.ts` | M06 | `gallery.service`, every `components/admin/gallery/*`, `hooks/useGallery.ts` (M01), public gallery |
| `types/announcement.ts` | M06 | `AnnouncementForm`, `announcement.service`, `AnnouncementBar`/`AnnouncementMarquee` (M02) |
| `types/quote.ts` | M06 | quote admin pages, `quote.service` (M10), `/api/quotes/*` (M08/M12), `DailyQuoteWidget` (M02) |
| `types/crud.ts` | M05 | all four `columns.ts` files |
| `types/homepage.ts` | M02 | `app/admin/testimonials/page.tsx` (`Testimonial`) |
| `types/temple-explorer.ts` | M02 | `app/admin/temple-areas/page.tsx` (`TempleArea`, `CATEGORY_LABELS`, `CATEGORY_COLORS`) |
| `types/shlokas.ts` | M03 | `app/admin/shlokas/page.tsx` (`Shloka`) |

### Stores touched

| Store | Kind | Read by | Written by |
|---|---|---|---|
| Firestore `galleryAlbums` | collection | `galleryService.getAlbums/getAlbum`, `/admin/media` | `AlbumDialog` → `createAlbum`/`updateAlbum`/`deleteAlbum` |
| Firestore `galleryMedia` | collection | `galleryService.getMedia/getMediaByAlbum/getFeaturedMedia/getMediaById`, `/admin/media` | `MediaDialog`, `GalleryForm`, `CreateImage`, `EditImage`, `LocalGalleryAssets` (dead) |
| Firestore `announcements` | collection | `announcementService.getAnnouncements/getActive/getAnnouncement` | `AnnouncementForm` via service; `/api/announcements` (unused) |
| Firestore `quotes` | collection | `quoteService.getQuotes/getQuoteById/getQuoteBySlug` via `/api/admin/quotes*` | quote create/edit/bulk/seed routes |
| Firestore `testimonials` | collection | `testimonial.service.getAllTestimonials`, `chat.service.getApprovedTestimonials` | testimonial admin page, `POST /api/testimonials` |
| Firestore `events`, `gallery`, `sevas`, `poojas`, `knowledge`, `volunteer_requests` | collections | `/admin/content` counts only | — (`gallery` does not exist; see M06-F08) |
| Supabase `events` | table | `eventService.getEvents/getEvent` | `EventForm` via `addEvent`/`updateEvent`; `EventTable` delete |
| Supabase `temple_areas` | table | `templeAreasService.getAreas/getPublicAreas/getArea` | `/admin/temple-areas` via `/api/admin/temple-areas` |
| Vercel Blob `gallery/`, `gallery/videos/`, `testimonials/`, `reports/` | object store | `storageService.listVideos/listFiles/listReports`, `/api/storage/videos` | `uploadBase64Image`, `uploadFile`, `uploadVideo`, `saveReport` (all currently broken from the client) |
| `public/images/temple`, `public/videos` | filesystem | `lib/gallery.ts:21`, `GET /api/gallery/local-assets` | `DELETE /api/gallery/local-assets` (unlink) |
| `data/shlokas.ts` | static module | `/admin/shlokas` initial state | never written |
| In-file constants (`SAMPLE_ITEMS`, `SAMPLE_STOTRAS`, `defaultMedia`, `DEFAULT_GALLERY_IMAGES`) | hardcoded | library / stotras / media / gallery fallback | — |

## Cross-module dependencies

### This module imports (by chunk)

| From chunk | What |
|---|---|
| M05 (admin shell & CRUD framework) | `components/admin/common/AdminPageHeader.tsx`, `AdminPageWrapper.tsx`, `SearchBox.tsx`, `StatCard.tsx`; `components/admin/crud/CrudTable.tsx` → `createCrudColumns.tsx` → `CrudTableCell.tsx` → `TableActions.tsx`, `StatusBadge.tsx`; `types/crud.ts`; the `app/admin/layout.tsx` frame |
| M01 (shared UI kit / utils) | `components/ui/{button,input,label,textarea,select,switch,checkbox,dialog,dropdown-menu,badge,tabs,table}`; `components/ui/form/*` (8 files); `components/ui/ImageUploader.tsx`, `VideoUploader.tsx`; `hooks/useAuth.ts`; `utils/event.ts`; `lib/firebase.ts` |
| M10 (service layer) | `services/event.service.ts`, `services/announcement.service.ts`, `services/quote.service.ts`, `services/testimonial.service.ts`, `services/temple-areas.service.ts` (→ `temple-areas.supabase.service.ts`), `services/chat.service.ts` |
| M11 (persistence) | Supabase clients behind `event.service` and `temple-areas.supabase.service`; Firestore rules governing every client-SDK write in this module |
| M02 / M03 (public site) | `types/homepage.ts` (`Testimonial`), `types/temple-explorer.ts`, `types/shlokas.ts`, `data/shlokas.ts` |

### Who imports this module

| Importer | What it takes |
|---|---|
| `app/(public)/page.tsx`, `components/home/TempleGalleryPreview.tsx` (M02) | `lib/gallery.ts` `getTempleGalleryImages()` |
| `app/(public)/gallery/page.tsx`, `app/(public)/display/page.tsx`, `app/(public)/favorites/page.tsx` (M02/M03), `app/admin/assistant/page.tsx` (M09), `services/search.service.ts` (M10) | `services/gallery.service.ts` |
| `app/api/reports/list/route.ts`, `app/api/reports/save/route.ts` (M05), `components/ui/ImageUploader.tsx`, `components/ui/VideoUploader.tsx` (M01), `services/testimonial.service.ts:304` (M10, dynamic `await import`) | `services/storage.service.ts` |
| `components/home/AnnouncementBar.tsx`, `AnnouncementMarquee.tsx` (M02), `services/announcement.service.ts`, `services/daily-spiritual.service.ts`, `services/proof-report/database-export.service.ts` (M10/M14), `types/daily-spiritual.ts` | `types/announcement.ts` |
| `app/(public)/events/[id]/page.tsx`, `components/events/EventCard.tsx`, `EventGrid.tsx` (M02), `services/event.service.ts`, `services/search.service.ts`, `services/proof-report/database-export.service.ts`, `utils/event.ts` | `types/event.ts` |
| `hooks/useGallery.ts` (M01), `app/(public)/display/page.tsx`, `services/search.service.ts`, `services/proof-report/database-export.service.ts` | `types/gallery.ts` |
| `app/api/quotes/*` (M08/M12), `components/home/DailyQuoteWidget.tsx` (M02), `lib/ai/generator.ts` (M08), `services/quote.service.ts` (M10) | `types/quote.ts` |
| `components/temple-explorer/TempleExplorer.tsx` (M02) | `GET /api/temple-areas` |
| `components/admin/settings/homepage/useHomepageForm.ts` (M05) | `POST /api/revalidate` |

## How to change it

### Recipe 1 - add a field to a gallery media item (e.g. `credit`)

1. `types/gallery.ts` - add `credit?: string` to `GalleryMedia` (line 42) and to `GalleryMediaRequest` (line 59).
2. `services/gallery.service.ts` - nothing to change; `createMedia` (line 219) and `updateMedia`
   (line 229) spread the request object. Confirm Firestore rules allow the new key.
3. `components/admin/gallery/MediaDialog.tsx` - add state near line 51, reset it in the effect at
   line 64, include it in the `onSave` payload at line 116, add the field to the JSX.
4. `components/admin/gallery/GalleryForm.tsx` - add to `formData` (line 41) and add a `FormTextField`.
5. If you keep them: mirror in `CreateImage.tsx` and `EditImage.tsx` (two more copies).
6. Public read side: `app/(public)/gallery/page.tsx` (M02) and `hooks/useGallery.ts` (M01).

### Recipe 2 - add a field to an event

1. `types/event.ts` - add the property to `TempleEvent`.
2. `services/event.service.ts` - add the snake_case mapping in `mapSupabaseEventToTempleEvent`
   (line 21), `addEvent`'s `eventToInsert` (line 72) and `updateEvent`'s `updateData` (line 99).
3. Add the column to the Supabase `events` table (M11 owns the migration).
4. `components/admin/events/EventForm.tsx` - state (line 81), `validate()` (line 94), the two
   service payloads (lines 150 and 160), and the JSX.
5. `app/admin/events/columns.ts` if it should show in the list.
6. `components/admin/events/EventSchema.ts` is **not** wired up - either wire it or leave it alone.

### Recipe 3 - add a new admin content page

1. Create `app/admin/<thing>/page.tsx` with `"use client"` if it fetches on mount.
2. Compose with `AdminPageHeader` + `SearchBox` + `CrudTable` (the announcements page is the
   cleanest template: `app/admin/announcements/page.tsx`).
3. Create `app/admin/<thing>/columns.ts` exporting `CrudColumn<T>[]` - **include a
   `{ key: "actions", type: "actions" }` entry**, otherwise the edit/delete buttons never render.
4. Put data access in `services/<thing>.service.ts` (M10), never inline Firestore calls in the page.
5. Add the route to the inline `allNavigation` array in `components/admin/layout/AdminSidebar.tsx:37`
   (M05) under the right group. Editing `components/admin/layout/navigation.ts` does nothing - that
   file has no importer (M06-F29).
6. If the page changes public content, `POST /api/revalidate` with the affected paths.

### Recipe 4 - add an entry to the admin menu

Edit the inline `allNavigation` array in `components/admin/layout/AdminSidebar.tsx:37` (M05) - that
is the only list the mounted sidebar reads. Groups there are `Dashboard`, `Temple Operations`,
`Finance`, `Content`, `Administration`, `AI Management`; `icon` is a string key resolved by the
`iconMap` in the same file (`AdminSidebar.tsx:11`).

Two other menu files exist and are both inert: `components/admin/layout/navigation.ts` (no importer
anywhere in the repo - editing it changes nothing) and `components/admin/AdminSidebar.tsx` (a stale
unused sidebar component). Do not edit either; delete them.

### Recipe 5 - make uploads actually work

1. Add a new upload route handler under `app/api/` (server) that reads the multipart body and calls
   `storageService.uploadFile` / `uploadVideo`; the server route is where `BLOB_READ_WRITE_TOKEN`
   is available.
2. Enforce type and size **server-side** there (the current checks are only in
   `components/ui/ImageUploader.tsx:41,48` and `VideoUploader.tsx:45`).
3. Change `ImageUploader`/`VideoUploader` to `fetch("/api/upload", { method: "POST", body: formData })`
   instead of importing `services/storage.service.ts`.
4. Replace `GalleryDashboard.tsx:52`'s direct `storageService.listVideos()` with
   `fetch("/api/storage/videos")` (that route already exists and is unused).
5. Replace `VideosManager.tsx:37`'s `storageService.deleteFile` with a new authenticated
   `DELETE /api/storage/videos` handler.

### Recipe 6 - change what "published" means for an event

`EventForm.tsx` currently hardcodes `published: true` on both create (line 166) and update
(line 157), and `status: "Upcoming"` on create (line 168). To add a real draft/publish flow: add a
switch to the form, stop hardcoding, surface `published` in `app/admin/events/columns.ts`, and make
`eventService.getPublishedEvents` (`services/event.service.ts:130`) the only reader on the public side.

### Recipe 7 - add a quote category

1. `types/quote.ts` - extend `QuoteCategory` and `QUOTE_CATEGORIES` (the admin selects read from it).
2. `app/admin/quotes/columns.tsx` - add entries to `categoryColors` (line 8) and `categoryLabels` (line 17);
   both are exhaustive `Record<QuoteCategory, string>` so TypeScript will flag the omission.
3. `app/api/admin/quotes/bulk/route.ts:30` - the validate mode has the category list **hardcoded
   inline**; update it there too or the import validator will reject the new category.

### Recipe 8 - give the content APIs auth

There is no `middleware.ts`. Add one matching `/api/admin/:path*` (and the write verbs of
`/api/temple-areas`, `/api/events`, `/api/announcements`, `/api/gallery/local-assets`), verify the
Firebase ID token server-side via `lib/admin-firebase.ts` / `lib/firebase-admin-rest.ts` (M10), and
delete the `x-user-email` header trust at `app/api/admin/quotes/route.ts:46`.

## Faults, smells and risks

| id | sev | what | evidence | suggested direction |
|---|---|---|---|---|
| M06-F01 | HIGH | Media upload cannot work in production: `@vercel/blob` `put()` is called from client components with a server-only token, and there is no upload API route anywhere in `app/api`. | `services/storage.service.ts:6,69`; `components/ui/ImageUploader.tsx:8,67`; `components/ui/VideoUploader.tsx:8,61`; `.env.example:20` (`BLOB_READ_WRITE_TOKEN`, no `NEXT_PUBLIC_`) | Add a server-side `POST /api/upload` route, move all Blob calls behind it, validate type/size server-side (Recipe 5). |
| M06-F02 | HIGH | `GalleryDashboard` (a client component) imports `storage.service` and calls `listVideos()`, swallowing the failure with `.catch(() => [])`, so the Videos panel is permanently empty and no error is shown. `VideosManager` deletes Blob objects the same way. | `components/admin/gallery/GalleryDashboard.tsx:6,52`; `components/admin/gallery/VideosManager.tsx:6,37` | Call `GET /api/storage/videos`; add an authenticated delete route. |
| M06-F03 | HIGH | Every API route in this module is unauthenticated. `POST/PUT/DELETE /api/temple-areas` lets anonymous callers create, edit and delete temple areas; `/api/admin/quotes*` trusts an unverified `x-user-email` header for `createdBy`. `docs/QUOTE-ENGINE.md:486` claims admin endpoints "require auth". | `app/api/temple-areas/route.ts:14`; `app/api/temple-areas/[id]/route.ts:23,39`; `app/api/admin/quotes/route.ts:46`; no `middleware.ts` in the repo | Add middleware + server-side token verification (Recipe 8); delete the write verbs from the public temple-areas route. |
| M06-F04 | HIGH | `DELETE /api/gallery/local-assets` unlinks files from `public/` with no auth. It is also dead weight on Vercel, where the deployment filesystem is read-only. | `app/api/gallery/local-assets/route.ts:38-57` | Remove the handler, or gate it behind admin auth and a dev-only guard. |
| M06-F05 | HIGH | Quotes cannot be edited or deleted from the list: `quoteColumns` has no `{type:"actions"}` column, and `createCrudColumns` only renders the columns it is given, so the `onEdit`/`onDelete` handlers passed to `CrudTable` are unreachable. | `app/admin/quotes/columns.tsx:26-133` (no `actions` key); `components/admin/crud/createCrudColumns.tsx:18`; `app/admin/quotes/page.tsx:452` | Append an `actions` column, as `app/admin/events/columns.ts:30` does. |
| M06-F06 | HIGH | `EventForm` builds Firestore `Timestamp` objects and hands them to a **Supabase**-backed service, which writes them straight into `start_date` / `end_date`. `types/event.ts` still declares these fields as `Timestamp`. | `components/admin/events/EventForm.tsx:59-68,154,170`; `services/event.service.ts:2,77-78`; `types/event.ts:1,18-19`. The read path lies the other way: `mapSupabaseEventToTempleEvent` (`event.service.ts:26-27`) assigns the raw Supabase `start_date`/`end_date` strings into the `Timestamp`-typed fields, so every consumer of `TempleEvent.startDate` receives a string the type says is a `Timestamp` | Change `TempleEvent.startDate/endDate` to ISO strings, convert in the form, and keep a single date helper. |
| M06-F07 | HIGH | Three "management" screens persist nothing. `/admin/library` and `/admin/stotras` are hardcoded arrays whose Add/Edit/Delete buttons have no handlers; `/admin/shlokas` mutates React state seeded from the static `data/shlokas.ts`, losing everything on reload. | `app/admin/library/page.tsx:29,87,217-222` (its `setItems` is never called, and its "Add Content" button calls `setShowModal(true)` at line 117 although the `showModal` flag is read nowhere - no modal exists in the file, so the button does nothing visible); `app/admin/stotras/page.tsx:28,76,181-186` (the only `onClick` in the file is the category filter at line 121); `app/admin/shlokas/page.tsx:20,57,83,104`. `/admin/shlokas` is also redundant: the sidebar's "Shlokas" entry points at `/admin/settings/shlokas` (M05), a working editor that seeds from the same `data/shlokas.ts` and persists through `setDoc` (`app/admin/settings/shlokas/page.tsx:7,8,13`) | Either back them with a service + collection, or remove the routes so admins are not misled - `/admin/shlokas` can go today, the linked settings screen already does the job. |
| M06-F08 | HIGH | The content dashboard's numbers are wrong by construction: it counts a `gallery` collection that does not exist (data lives in `galleryMedia`), filters announcements on `active` when the field is `isActive`, and filters events on a string `date` field when events live in Supabase with `start_date`. | `app/admin/content/page.tsx:90,92,93`; `services/gallery.service.ts:6`; `services/announcement.service.ts:48`; `services/event.service.ts:46` | Replace the inline Firestore counting with service calls (`galleryService.getStats()` already exists, line 248). |
| M06-F09 | MEDIUM | `/admin/media` reads `data.url \|\| data.imageUrl` from `galleryMedia`, but the service writes `imagePath`, so every gallery item renders with an empty `src`. Its `onError` fallback points at `/images/placeholder.png`, which does not exist, and two of three `defaultMedia` entries point at `/images/gallery/sample1.jpg` / `sample2.jpg`, which also do not exist. | `app/admin/media/page.tsx:87,298-300,55-57`; `types/gallery.ts:49`; `public/images/gallery/` contains only `Naveen-testimonial.png` | Read `imagePath`, add the placeholder asset, or delete the page in favour of the gallery dashboard. |
| M06-F10 | MEDIUM | Six gallery routes and three parallel form implementations for one job. `/admin/gallery` and `/admin/gallery/media` render the identical dashboard; `GalleryForm` (form-kit), `CreateImage` and `EditImage` (raw inputs) duplicate the same fields and validation three times; only `/admin/gallery` is in the sidebar. | `app/admin/gallery/page.tsx:16` vs `app/admin/gallery/media/page.tsx:14`; `components/admin/gallery/GalleryForm.tsx:82` vs `CreateImage.tsx:47` vs `EditImage.tsx:55`; the live menu lists only `/admin/gallery` (`components/admin/layout/AdminSidebar.tsx:66`) | Keep `/admin/gallery` + `/admin/gallery/new` + `/admin/gallery/[id]/edit` on `GalleryForm`; delete the rest. |
| M06-F11 | MEDIUM | tiptap is a dependency (5 `@tiptap/*` packages) and `RichTextEditor.tsx` exists, but nothing imports it. There is **no rich-text field anywhere in this module** - every long-form field is a plain `<textarea>`, content is stored as plain text, and consequently no sanitisation layer exists or is needed today. | `components/admin/RichTextEditor.tsx:3-7` (only self-references in a repo-wide grep); `package-lock.json:18-22`; `EventForm.tsx:210`, `AnnouncementForm.tsx:115` use textareas | Decide: wire the editor into event/announcement descriptions *with* a sanitiser on the render side, or delete the component and the five packages. |
| M06-F12 | MEDIUM | Dead code: eight files in this module have no importer. | `components/admin/events/EventSchema.ts`, `EventSearch.tsx`, `EventStatusBadge.tsx`, `DeleteEventDialog.tsx`; `app/admin/gallery/columns.ts`; `components/admin/gallery/GalleryTable.tsx`, `LocalGalleryAssets.tsx`; `components/admin/RichTextEditor.tsx` — all verified with a repo-wide grep of `app components lib services hooks types utils` | Delete, or wire `EventSchema` into `EventForm` (it is the only zod schema in the module). |
| M06-F13 | MEDIUM | `/api/temple-areas/*` is a near-verbatim copy of `/api/admin/temple-areas/*` - same service, same verbs, different response envelope (`{success, areas}` vs bare arrays). | `app/api/temple-areas/route.ts:1-32` vs `app/api/admin/temple-areas/route.ts:1-34` | Keep one admin route (write) and one public read-only route; delete the duplicated write verbs. |
| M06-F14 | MEDIUM | Six API routes have no caller in the repo: `/api/events`, `/api/events/[id]`, `/api/announcements`, `/api/announcements/[id]`, `/api/testimonials`, `/api/storage/videos`. The admin screens bypass them and call the browser Firestore/Supabase SDKs directly, so route-level validation never runs. | grep over `app components lib services hooks` finds no `fetch("/api/events…")`, `"/api/announcements"`, `"/api/testimonials"` or `"/api/storage/videos"` | Either route the admin screens through them (gaining server-side validation and auth) or delete them. |
| M06-F15 | MEDIUM | No cache invalidation after a content write. `/api/revalidate` exists but its only caller is the homepage settings form in M05; saving an event, announcement, gallery item or quote never revalidates the public pages. | `app/api/revalidate/route.ts:10`; only caller `components/admin/settings/homepage/useHomepageForm.ts:91`; `EventForm.tsx:175-176` uses `router.refresh()` only | Call `POST /api/revalidate` with the affected public paths from each save handler. |
| M06-F16 | MEDIUM | AGENTS.md forbids `any` and direct Firebase calls outside services; both are violated here. `/admin/media` and `/admin/content` import `firebase/firestore` and query collections inline; `types/gallery.ts` uses `any` for timestamps; the quote routes use `error: any` and `filters: any`. | `app/admin/media/page.tsx:25-36,81`; `app/admin/content/page.tsx:13-14,89`; `types/gallery.ts:38,39,52`; `app/api/admin/quotes/route.ts:18,34` | Move reads into `galleryService`; type timestamps as `Timestamp \| string`; type route errors as `unknown`. |
| M06-F17 | MEDIUM | `app/admin/events/[id]/edit/page.tsx` is a server component that awaits `eventService.getEvent`, but that service instantiates the **browser** Supabase client at module scope. | `app/admin/events/[id]/edit/page.tsx:17`; `services/event.service.ts:2-4` (`createClient` from `@/lib/supabase/client`) | Use the server Supabase client (`lib/supabase/server.ts`) for server-side reads, or make the page a client component like its gallery counterpart. |
| M06-F18 | MEDIUM | `galleryService.getMedia()` returns seven hardcoded `DEFAULT_GALLERY_IMAGES` whenever Firestore is empty **or throws**, so the admin gallery shows phantom rows with ids `default-1..7` that cannot be edited or deleted, and a Firestore outage looks like success. | `services/gallery.service.ts:9,151-173` | Return `[]` and surface the error; keep the defaults for the public site only, if at all. |
| M06-F19 | MEDIUM | No server-side validation on any gallery or album write. `AlbumDialog` and `MediaDialog` save whatever is in state - empty title, empty slug, empty image path all persist. | `components/admin/gallery/AlbumDialog.tsx:74-85`; `components/admin/gallery/MediaDialog.tsx:115-136` | Share the `GalleryForm.validate()` rules, or move writes behind a validated API route. |
| M06-F20 | LOW | Inconsistent error UX: `alert()`/`confirm()` in the event and gallery dashboard paths, `react-hot-toast` in the announcement, quote, testimonial and temple-area paths. | `EventForm.tsx:134,145,179`; `EventTable.tsx:29,42`; `GalleryDashboard.tsx:94,110`; `VideosManager.tsx:31,41`; vs `app/admin/announcements/page.tsx:31` | Standardise on toast plus the shared `DeleteDialog` that already exists in this module. |
| M06-F21 | LOW | `GalleryToolbar`'s "Add Media" button has no `onClick`; the working one lives inside `MediaGrid`. | `components/admin/gallery/GalleryToolbar.tsx:43-46`; working button at `components/admin/gallery/MediaGrid.tsx:69` | Wire it to `MediaGrid`'s dialog or remove it. |
| M06-F22 | LOW | Uploader identity is faked in two places: `MediaGrid` passes the literal `"admin"` and `MediaDialog` sets `uploadedBy: "admin"`, so `galleryMedia.uploadedBy` is meaningless for anything created via the dashboard. `GalleryForm`'s path does it correctly with `useAuth`. | `components/admin/gallery/MediaGrid.tsx:43`; `components/admin/gallery/MediaDialog.tsx:126`; correct version at `app/admin/gallery/new/page.tsx:26` | Thread `useAuth().user.email` through the dashboard. |
| M06-F23 | LOW | `quotes/new` and `quotes/[id]/edit` are ~600 lines each and ~90% identical (a `diff` shows the delta is load-on-mount, POST vs PUT, and a delete button). | `app/admin/quotes/new/page.tsx` (603 lines) vs `app/admin/quotes/[id]/edit/page.tsx` (663 lines) | Extract a `QuoteForm` component the way announcements and gallery already do. |
| M06-F24 | LOW | Accessibility gaps: icon-only action buttons carry no accessible name; `MediaDialog`, `AlbumDialog` and the temple-area dialog use `<Label>` without `htmlFor`; `CrudTableCell` renders a bare `<img>` for image columns instead of `next/image`. | `components/admin/gallery/AlbumGrid.tsx:86-100`; `components/admin/gallery/MediaCard.tsx:79-93`; `components/admin/gallery/AlbumDialog.tsx:100-146`; `components/admin/crud/CrudTableCell.tsx:81` | Add `aria-label` to icon buttons, `htmlFor`/`id` pairs on labels, swap in `next/image`. |
| M06-F25 | LOW | Debug logging left in production code paths, including on every upload. | `services/storage.service.ts:66,75,99,124,138,146`; `components/admin/gallery/GalleryDashboard.tsx:55,63`; `services/event.service.ts:43` | Strip or gate behind a logger. |
| M06-F26 | LOW | `types/quote.ts` is 494 lines because `DEFAULT_QUOTES_DATA`, `FESTIVAL_QUOTE_MAP` and `WEEKDAY_QUOTE_MAP` (seed and config data) live in the types folder. | `types/quote.ts:362` | Move seed data next to the other seed files or into the data folder; keep `types/` to types. |
| M06-F27 | LOW | `TempleEvent.status` is marked "Legacy (will be removed later)" yet is still written on create, still a table column, and the list page computes a *different* status at render time from the dates. | `types/event.ts:35-36`; `components/admin/events/EventForm.tsx:168`; `app/admin/events/page.tsx:44-58`; `app/admin/events/columns.ts:25` | Drop the stored field and derive status everywhere, or stop deriving and maintain the field. |
| M06-F28 | LOW | `/admin/content` links to `/admin/knowledge/new`, which does not exist (`app/admin/knowledge` has no `new` route). | `app/admin/content/page.tsx:263`; `ls app/admin/knowledge` shows only `page.tsx` | Point at `/admin/knowledge` or create the route. |
| M06-F29 | MEDIUM | The admin menu is defined three times and only one copy is live, so any nav edit has a two-in-three chance of doing nothing. `components/admin/layout/navigation.ts` has **no importer anywhere in the repo** (grep for `layout/navigation` and `from "./navigation"` over `app components lib hooks` returns nothing) yet it reads like the canonical nav; the mounted sidebar uses an inline `allNavigation` array, and `components/admin/AdminSidebar.tsx` is a third, unused copy. The three lists disagree: `navigation.ts:92` points "Shlokas" at `/admin/shlokas`, the live one points it at `/admin/settings/shlokas`. | `components/admin/layout/AdminSidebar.tsx:37` (inline `allNavigation`, read at `:108`, no import of `navigation`); `components/admin/layout/navigation.ts` (0 importers); `components/admin/AdminSidebar.tsx:86` | Delete `navigation.ts` and `components/admin/AdminSidebar.tsx`, or make the mounted sidebar import `navigation.ts` and keep one list. |
| M06-F30 | MEDIUM | The Supabase `events` table is addressed through a legacy `firestore_id` column, never its own id: `getEvent`, `updateEvent` and `deleteEvent` all filter `.eq('firestore_id', id)`, `addEvent` mints one with `crypto.randomUUID()`, and `TempleEvent.id` is mapped back out of it. A half-finished Firestore→Supabase migration is frozen into every event query. | `services/event.service.ts:23,58,71,114,123` | Decide on the real key, backfill it, and drop `firestore_id` (M11 owns the migration). |
| M06-F31 | LOW | `/admin/media` imports Firebase Storage (`storage` from `lib/firebase.ts`, plus `ref`, `listAll`, `getDownloadURL`, `deleteObject`) and never calls any of it, so a third storage backend is pulled into the client bundle for nothing. It is the only trace of Firebase Storage in this module - real uploads target Vercel Blob (broken, M06-F01) and real assets live in `public/`. | `app/admin/media/page.tsx:25,36` (the four `firebase/storage` symbols appear on the import line and nowhere else in the 499-line file); `lib/firebase.ts:90,220` | Delete the imports, or finish the page against one storage backend. |

## Portability notes (React Native / cross-platform)

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| `types/gallery.ts`, `types/event.ts`, `types/announcement.ts`, `types/quote.ts` | none | **reuse as-is** | Pure TypeScript; the shared contract a native client needs. `types/event.ts:1` imports Firestore `Timestamp`, which is available in the RN Firebase SDK but should become a string anyway (M06-F06). |
| `services/gallery.service.ts` | `firebase/firestore` web SDK via `lib/firebase.ts` | **adapt** | Logic is portable; swap the import for `@react-native-firebase/firestore` or call an HTTP API. |
| `services/event.service.ts`, `temple-areas.supabase.service.ts` | `@supabase/supabase-js` browser client | **adapt** | `supabase-js` runs in RN, but needs an AsyncStorage adapter and a server-side variant for SSR. |
| `services/storage.service.ts` | `@vercel/blob`, `atob`, `Blob`, `Buffer`, `File` | **rewrite** | `atob` and `Blob` are browser globals; the whole thing should be behind an upload API that RN posts multipart form data to. |
| `lib/gallery.ts`, `app/api/gallery/local-assets/route.ts` | Node `fs`, `path`, `process.cwd()` | **rewrite / server-only** | Filesystem scanning of `public/` has no native equivalent; expose it as an API if it must survive. |
| All 21 `app/admin/**/page.tsx` | Next App Router file routing, `"use client"`, `next/navigation` (`useRouter`, `useParams`), `next/link`, Server Components, `generateMetadata`, `notFound()`, `loading.tsx` | **rewrite** | Routing and the server/client split are Next-specific; screens must be re-expressed in React Navigation / Expo Router. |
| Every Tailwind `className` in this module | Tailwind CSS + DOM | **rewrite** | ~11.8k lines are styled with utility classes on `div`/`table`/`section`. NativeWind can carry much of it, but `table`, `overflow-x-auto`, `sticky`, `line-clamp`, `group-hover:` and gradient utilities have no native analogue. |
| `CrudTable` / `createCrudColumns` / `CrudTableCell` (M05, used by 3 pages here) | `@tanstack/react-table`, `<table>` markup | **adapt** | `@tanstack/react-table` is headless and runs in RN; the `<table>` renderer must become a `FlatList`. |
| `MediaDialog`, `AlbumDialog`, `DeleteDialog`, temple-area dialogs | Radix `@/components/ui/dialog` (DOM portals, focus trap) | **rewrite** | Radix is DOM-only; use RN `Modal` or a native sheet library. |
| `AlbumGrid`, `MediaCard`, `/admin/media`, `/admin/testimonials` image rendering | `next/image` (`fill`, `object-cover`, `onError`) | **adapt** | Map to RN `Image`/`expo-image` with `resizeMode`; `fill` + parent `relative` has no direct equivalent. |
| `VideosManager`, `LocalGalleryAssets` video preview | `<video>` element, `preload="metadata"` | **rewrite** | Use `expo-av` / `react-native-video`. |
| `ImageUploader`, `VideoUploader` file pickers | `<input type="file">`, `FileReader`, base64 | **rewrite** | Use `expo-image-picker` / `expo-document-picker`; keep the same base64-or-multipart contract with the (not yet existing) upload API. |
| `LocalGalleryAssets.handleCopy`, `/admin/media` copy-URL, `/admin/shlokas` copy | `navigator.clipboard` | **adapt** | `expo-clipboard`. |
| `EventForm` date/time inputs | `<input type="date">`, `<input type="time">` | **rewrite** | Native date/time pickers; the `toTimestamp`/`toDateTimeInputs` helpers (`EventForm.tsx:40-68`) are portable logic worth extracting. |
| `alert()` / `confirm()` (events, gallery dashboard, videos) | `window` globals | **rewrite** | RN `Alert.alert`. Another reason to standardise on toast + `DeleteDialog`. |
| `handleExport` in `/admin/quotes` | `Blob`, `URL.createObjectURL`, synthetic `<a>` click | **rewrite** | Use `expo-file-system` + `expo-sharing`. `app/admin/quotes/page.tsx:224-230`. |
| `/api/admin/quotes*`, `/api/admin/temple-areas*`, `/api/revalidate` | Next Route Handlers | **reuse as-is (as a server)** | A native client can call these unchanged once they are authenticated. `/api/revalidate` is meaningless to a native client. |
| `components/admin/RichTextEditor.tsx` | tiptap / ProseMirror (contentEditable) | **rewrite** | ProseMirror is DOM-only. Since nothing imports it (M06-F11), the cheapest port is deletion. |
| `react-hot-toast` | DOM portal | **adapt** | Swap for `react-native-toast-message`. |
| `lucide-react` icons | SVG DOM | **adapt** | `lucide-react-native` has the same names. |

**What a React Native admin client would need from this module.** First, a real HTTP API: today the
admin screens talk to Firestore and Supabase directly from the browser, and the six API routes that
do exist are unused and unauthenticated. A native client cannot reuse the browser Firestore
transport reliably and should not embed Supabase write logic, so the CRUD for events, gallery
albums/media, announcements, quotes, testimonials and temple areas must be exposed as authenticated
routes with server-side validation (the `/api/admin/quotes/*` family is the closest existing model).
Second, an upload endpoint - `POST /api/upload` returning a public URL - because the current
client-side Blob calls cannot work on any platform (M06-F01). Third, the four type files in this
chunk should be published as a shared package: they are already pure and are what both clients agree
on, once `TempleEvent`'s Firestore `Timestamp` becomes an ISO string. Fourth, a handful of pure
helpers worth hoisting out of components before the port: `EventForm`'s date conversions
(`EventForm.tsx:19-68`), `storageService.generateFilename`/`sanitizeFilename`
(`storage.service.ts:194,207`), the `formatFileSize` duplicated in
`app/api/storage/videos/route.ts:32` and `VideosManager.tsx:19`, and the tag comma-splitting repeated
in `GalleryForm.tsx:119`, `MediaDialog.tsx:129` and `CreateImage.tsx`. Everything else in this module
is a Next-routed, Tailwind-styled, Radix-dialogged screen and is a rewrite.

## Coverage

filesExpected 75, filesMentioned 76 (all 75 inventory files plus the adopted
`components/admin/RichTextEditor.tsx`), omitted: none.

Every inventory file has at least one row in **Key files**; the larger ones also appear in
**Entry points**, **Component trees**, **Data flow** or **Faults**.

## UNCLEAR

- **Is `/api/testimonials` called from outside the repo?** No in-repo `fetch` targets it, but it
  looks like the public chat/testimonial widget's intended endpoint. Settled by checking the
  deployed site's network traffic or the chat widget in M09.
- **Does Supabase's `events` table actually accept the Firestore `Timestamp` object that `EventForm`
  sends (M06-F06)?** Static reading says it would be serialised as `{seconds, nanoseconds}` JSON and
  rejected or coerced by a `timestamptz` column. Settled by the table DDL in the Supabase migration
  files (M11) or one live insert.
- **Whether `galleryMedia` documents in the live database use `imagePath` (what the service writes)
  or `url`/`imageUrl` (what `/admin/media` reads).** Settled by the Firestore dump in
  `.claude/state` / the `firestore:dump` output, which this run may not read.
- **Whether `/admin/media`, `/admin/content`, `/admin/library`, `/admin/stotras`, `/admin/quotes` and
  `/admin/shlokas` were deliberately removed from the sidebar or never added.** (`/admin/testimonials`
  and `/admin/temple-areas` *are* in the live menu - `components/admin/layout/AdminSidebar.tsx:68,88`.)
  The dead `navigation.ts` lists `/admin/shlokas` where the live menu lists `/admin/settings/shlokas`,
  which suggests the nav was rewritten and entries were dropped rather than never added. Settled by
  the project history docs in M15.
- **Whether `data/shlokas.ts` is meant to be the permanent store for shlokas** (making
  `/admin/shlokas` a preview tool) **or whether a `shlokas` collection was planned.** Settled by
  `docs/DATA-MODEL.md` (M11) or the public shloka page in M03.

## Verification log (2026-09-19)

Skeptic pass over this file: 250 path citations checked (0 broken, 0 line numbers out of range),
76 line counts in **Key files** checked (0 wrong), 31 factual claims re-derived from the code,
all 28 original findings re-opened, inventory diffed against disk (75 files on disk under the chunk
roots, 75 in the inventory, 75 mentioned here). Changes made:

- Admin menu was said to live in `components/admin/layout/navigation.ts` -> that file has **no
  importer anywhere**; the live menu is the inline `allNavigation` array in
  `components/admin/layout/AdminSidebar.tsx:37`, read at `:108`. Fixed in the shared-frame tree,
  Recipe 3 step 5, Recipe 4, and the M06-F10 evidence -> evidence: grep for `layout/navigation` and
  `from "./navigation"` over `app components lib hooks` returns nothing; `AdminShell.tsx:5` mounts
  `./AdminSidebar`.
- "`/admin/testimonials` and `/admin/temple-areas` are unreachable from the menu", and
  "`components/admin/AdminSidebar.tsx` is the only place `/admin/testimonials` is linked from a nav
  file" -> both are in the **live** menu -> evidence: `components/admin/layout/AdminSidebar.tsx:68`
  (Testimonials), `:88` (Temple Explorer -> `/admin/temple-areas`).
- `/admin/shlokas` was implicitly treated as menu-reachable -> the live menu's "Shlokas" entry points
  at `/admin/settings/shlokas`, a different and actually-persisting screen -> evidence:
  `AdminSidebar.tsx:72`; `app/admin/settings/shlokas/page.tsx:7,8,13` (`getDoc`/`setDoc`). Added to
  M06-F07.
- "`/admin/gallery/new` is linked only from `/admin/content`" -> also linked from the admin
  quick-search -> evidence: `components/admin/dashboard/AdminSearchResults.tsx:34`;
  `app/admin/content/page.tsx:236,479`. Fixed in Entry points and Key files.
- "`AnnouncementBar.tsx` and `AnnouncementMarquee.tsx` read the same collection" -> only
  `AnnouncementBar` fetches; the marquee is presentational and takes a prop -> evidence:
  `components/home/AnnouncementBar.tsx:17,38`; `components/home/AnnouncementMarquee.tsx:7,12`.
- `services/storage.service.ts` consumer list was incomplete -> added the dynamic importer ->
  evidence: `services/testimonial.service.ts:304,314`.
- M06-F06 held only the write path -> added the read path, which breaks the same type in the other
  direction -> evidence: `services/event.service.ts:26-27` assigns Supabase strings into the
  `Timestamp`-typed `startDate`/`endDate`.
- M06-F07 evidence strengthened for `/admin/library` -> its `setItems` is never called and
  `setShowModal(true)` at line 117 drives a modal that does not exist (`showModal` is read nowhere);
  `/admin/stotras` has no `onClick` other than the category filter at line 121.
- M06-F28 evidence said `ls app/admin/knowledge` "shows no `new`" -> stated precisely: the directory
  contains only `page.tsx`.
- New finding **M06-F29** (MEDIUM): three menu definitions, only one live, and they disagree.
- New finding **M06-F30** (MEDIUM): every event query keys off a legacy `firestore_id` column ->
  evidence: `services/event.service.ts:23,58,71,114,123`.
- New finding **M06-F31** (LOW): `/admin/media` imports Firebase Storage and never uses it - a third
  storage backend in the bundle -> evidence: `app/admin/media/page.tsx:25,36`.

Re-checked and left alone (spot-checked against the code, correct as written): the 39/75
client-vs-server split; `AdminAuthGuard` at `app/admin/layout.tsx:24` and the absence of
`middleware.ts`; all eight dead files in M06-F12 (`galleryColumns` confirmed by symbol grep, not just
path grep); the missing `actions` column in `app/admin/quotes/columns.tsx` against
`createCrudColumns.tsx:18` and `app/admin/quotes/page.tsx:452`; every `EventForm` line reference
(validate at 94, alerts at 134/145/179, `published: true` at 157 and 166, `status` at 168, push at
175); the seven `DEFAULT_GALLERY_IMAGES` and the three ways `getMedia` falls back to them
(`gallery.service.ts:155,164,171`); the wrong collection/field names in `app/admin/content/page.tsx:89-93`;
the missing `/images/placeholder.png`, `sample1.jpg` and `sample2.jpg`; the unauthenticated write
verbs on `/api/temple-areas` and the `fs.unlinkSync` in `/api/gallery/local-assets`; the six
uncalled API routes; the five `@tiptap/*` packages against a `RichTextEditor.tsx` nobody imports;
and every line reference in Recipes 1, 2, 5 and 7.

**Gap-closure pass (2026-09-19).** `components/admin/RichTextEditor.tsx` (adopted) re-confirmed
dead: `grep -rn "RichTextEditor" app components lib services hooks types utils scripts tests`
returns only its own definition at `:52,:59,:64`, and it is the only file in the repository calling
tiptap's `useEditor` (`grep -rln "useEditor\|@tiptap" components app lib` -> 1 file). A pointer to
M11's event scripts was added under *Code roots*, because those scripts write the `events`
collection this module's admin pages edit. Coverage is unchanged at 75 + 1 adopted.
