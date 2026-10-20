# M05 - Admin console: shell, dashboard, CRUD framework and settings
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs. Verify against the code before acting on any claim. Refreshed 2026-10-18 against code HEAD `424fdb8` - see the Refresh log at the end.

## Answers questions about

- How the `/admin` shell is put together, and what wraps every admin page
- Where the admin sidebar menu items are defined (and why editing `navigation.ts` changes nothing)
- How admin auth gating works, why `requiredPermission` is decorative, and where role checks really happen
- Why some sidebar links do a full page reload instead of a client navigation
- What each dashboard widget on `/admin` shows and where its number comes from
- Why the dashboard's "Donors" / "Total ₹" / "Avg ₹" tiles are always zero
- What the generic CRUD framework (`components/admin/crud`) actually provides, and which admin pages use it
- Which CRUD helpers are duplicated (`lib/crud-columns.tsx` vs `createCrudColumns.tsx`) and which copy is live
- How a settings sub-page is built - the copy-pasted `doc(db, "settings", "<name>")` + `getDoc`/`setDoc` pattern
- Which Firestore `settings/*` documents exist, which public page reads each, and which are orphans nobody reads
- Why "Save" on `/admin/settings` (the Site Settings page) always fails in the browser
- How Site Settings writes now route through the `app/actions/settings.ts` server action (since 2026-10-13), and why that action still rejects every save made from the page
- The difference between `/admin/settings`, `/admin/settings/*` and `/admin/website-settings/temple-information`
- What `/admin/featured` does and why it is unreachable from the menu - and which other routes are
- Which UI patterns the admin actually uses today (tables, forms, modals, toasts, stat tiles) and which "shared" component is dead, i.e. what a redesign is really replacing
- What the Reports page computes, why `services/report.service.ts` is dead, and what `/api/reports/*` is really for
- Which admin components are dead code (never imported) and safe to delete
- Which toast library is actually in use (react-hot-toast, not the documented sonner)
- What Homepage Settings does differently from every other settings page (it is the one correctly layered module)
- Which admin/debug routes should not ship (`/admin/test`, `/admin/test-firebase`, `/debug`)
- Where the admin header search box routes to and which of its targets are dead links
- What in this module would not survive a port to React Native
- Whether the mobile app (`apps/mobile`) reads anything the admin console writes (it does not - it reads a Supabase `website_settings` table that nothing in the repo creates or writes)

## Purpose and business role

M05 is the operator's cockpit for the Sri Raghavendra Swamy Matha portal. Temple staff, trustees and
the super-admin sign in at `/login`, land on `/admin`, and use this module to see how the site is
doing and to edit the site's own content and configuration. It owns four things:

1. **The shell** - the sidebar, the top bar, the auth gate and the page chrome that every other
   admin module (M06 content, M07 devotional operations, M09 AI console, M04 users) renders inside.
2. **The dashboard** at `/admin` - a single client page that counts Firestore collections and pulls
   page-view and AI analytics to give a "how is the temple website doing" overview.
3. **The generic CRUD framework** - `CrudTable` + `CrudColumn` + `StatusBadge` + `TableActions`,
   intended as the one way to build an admin list page. In practice only four list pages use it.
4. **Settings** - fourteen pages under `/admin/settings` (the chunk entry in `chunks.json` says
   "16 settings sub-pages"; the real count on disk is **13 sub-directories** + the root
   `app/admin/settings/page.tsx` + `app/admin/settings/layout.tsx`, plus one more page under
   `app/admin/website-settings`) that edit the copy, timings, contact
   details, social links, trust committee, facilities, future plans and finance/UPI configuration
   that the public site renders. Plus a fifth, parallel "website-settings" experiment.

The module is where the platform's architecture rules are broken hardest: twelve of the fourteen
settings pages talk to Firestore directly from a `"use client"` page, and the dashboard does the
same. Roughly a third of the components in this chunk have zero importers.

## Code roots

From `chunks.json` (id M05):

```
app/admin/layout.tsx            app/admin/page.tsx
app/admin/settings/**           app/admin/website-settings/**
app/admin/reports/              app/admin/featured/
app/admin/test/                 app/admin/test-firebase/
app/debug/
components/admin/layout/        components/admin/common/
components/admin/crud/          components/admin/dashboard/
components/admin/settings/      components/admin/reports/
hooks/useCrudTable.ts           hooks/useFinanceSettings.ts
lib/crud-columns.tsx
types/crud.ts  types/settings.ts  types/dashboard.ts
services/settings.service.ts    services/dashboard.service.ts
services/dashboard.service.client.ts   services/report.service.ts
app/api/dashboard/              app/api/reports/
website-settings/               homepage/
```

**Adopted from the Unassigned list** (`.claude/state/inventory/SUMMARY.md`), because they are
admin-shell/debug files that belong nowhere else and are all dead code:

- `components/admin/AdminSidebar.tsx` (177 lines) - superseded by `components/admin/layout/AdminSidebar.tsx`
- `components/admin/AdminHeader.tsx` (31 lines) - superseded by `components/admin/layout/AdminHeader.tsx`
- `components/admin/DashboardCard.tsx` (34 lines) - superseded by `components/admin/common/StatCard.tsx`
- `components/debug/ClientEnvDebug.tsx` (22 lines) - orphan sibling of `app/debug/page.tsx`

`components/admin/RichTextEditor.tsx` was left unassigned deliberately - it is a content-editing
component and belongs with M06, not with the shell.

## Entry points

| Route / entry | File | server/client | Auth required | What it renders or does |
|---|---|---|---|---|
| `/admin/*` (layout) | `app/admin/layout.tsx` | server | via `AdminAuthGuard` child | `Suspense` → `AdminAuthGuard` → `AdminShell` → `<main id="main-content">` + `GoUpButton` |
| `/admin` | `app/admin/page.tsx` | client | inherited | Dashboard: 6 mini-stats, Website Analytics, AI Assistant, Donations, Quick Actions |
| `/admin/settings` (layout) | `app/admin/settings/layout.tsx` | client | `AdminAuthGuard requiredPermission="settings"` | Second, redundant guard around all settings pages |
| `/admin/settings` | `app/admin/settings/page.tsx` | client | third guard, inline | Site Settings form → **Supabase** `site_settings`; writes go through the server action `app/actions/settings.ts` (since 2026-10-13). Save still fails from the browser (M05-F02) |
| `/admin/settings/about` | `app/admin/settings/about/page.tsx` | client | inherited | Edits Firestore `settings/aboutUs`; read by `app/(public)/about/page.tsx:112` |
| `/admin/settings/facilities` | `app/admin/settings/facilities/page.tsx` | client | inherited | `settings/facilities`; read by `app/(public)/facilities/page.tsx:126` |
| `/admin/settings/future-plans` | `app/admin/settings/future-plans/page.tsx` | client | inherited | `settings/futurePlans`; read by `app/(public)/future-plans/page.tsx:108` |
| `/admin/settings/trust-committee` | `app/admin/settings/trust-committee/page.tsx` | client | inherited | `settings/trustCommittee`; read by `app/(public)/trust/page.tsx:61` |
| `/admin/settings/footer` | `app/admin/settings/footer/page.tsx` | client | inherited | `settings/footer`; read by `components/layout/Footer.tsx:70` |
| `/admin/settings/finance` | `app/admin/settings/finance/page.tsx` | client | inherited | `settings/financeSettings`; read by `hooks/useFinanceSettings.ts:22` |
| `/admin/settings/homepage` | `app/admin/settings/homepage/page.tsx` | client | inherited | The one properly layered page: → `HomepageSettings` → `HomepageForm` → `homepageService` |
| `/admin/settings/social-links` | `app/admin/settings/social-links/page.tsx` | client | inherited | Writes Firestore `settings/socialLinks` - **orphan**, public reads Supabase (M05-F03) |
| `/admin/settings/guru-parampara` | `app/admin/settings/guru-parampara/page.tsx` | client | inherited | Writes `settings/guruParampara` - **orphan** (M05-F04) |
| `/admin/settings/shlokas` | `app/admin/settings/shlokas/page.tsx` | client | inherited | Writes `settings/shlokas` - **orphan**, public uses `data/shlokas.ts` (M05-F04) |
| `/admin/settings/puja-schedule` | `app/admin/settings/puja-schedule/page.tsx` | client | inherited | Writes `settings/poojaSchedule` - **orphan** (M05-F04) |
| `/admin/settings/ekadashi-calendar` | `app/admin/settings/ekadashi-calendar/page.tsx` | client | inherited | Writes `settings/ekadashiCalendar` - **orphan** (M05-F04) |
| `/admin/settings/festival-calendar` | `app/admin/settings/festival-calendar/page.tsx` | client | inherited | Writes `settings/festivalCalendar` - **orphan** (M05-F04) |
| `/admin/website-settings/temple-information` | `app/admin/website-settings/temple-information/page.tsx` | **server** | inherited | Reads `website-settings/temple.json`; the form only `console.log`s (M05-F05) |
| `/admin/reports` | `app/admin/reports/page.tsx` | client | `AdminAuthGuard requiredPermission="admin"` | Revenue/donation/booking/receipt summary, date-range filter, CSV export, `window.print()` |
| `/admin/featured` | `app/admin/featured/page.tsx` | client | inherited | Featured-content editor on Firestore `featuredContent`. **Not in any menu** (M05-F06) |
| `/admin/test` | `app/admin/test/page.tsx` | client | inherited | Button that writes a junk doc to Firestore `test` collection. Should not ship |
| `/admin/test-firebase` | `app/admin/test-firebase/page.tsx` | client | inherited | Dumps Firebase config validation + raw `events` docs. Should not ship |
| `/debug` | `app/debug/page.tsx` | client | **none** - outside `/admin` | Prints env-var presence incl. an `OPENAI_API_KEY` prefix expression. Should not ship (M05-F07) |
| `GET /api/dashboard/daily-spiritual` | `app/api/dashboard/daily-spiritual/route.ts` | server route | **none** | `dailySpiritualService.getDashboardData()`; `force-dynamic`, no-store. No caller in the repo |
| `GET /api/reports/list` | `app/api/reports/list/route.ts` | server route | **none** | Lists Vercel Blob report files. Used only by `tests/reports/save-reports.spec.ts:166` |
| `POST /api/reports/save` | `app/api/reports/save/route.ts` | server route | **none** | Uploads screenshot/pdf/json/excel/markdown to Vercel Blob. Caller: `lib/reports/report-saver.ts:33` |

## Component trees

### 1. The admin shell (wraps every page in M05, M06, M07, M09 and `/admin/users`)

```
AdminLayout (server)                      app/admin/layout.tsx
└── Suspense fallback=AdminLoading (server, inline)
    └── AdminAuthGuard (client)           components/admin/layout/AdminAuthGuard.tsx
        │   hooks: useAuth() -> {user, loading, canAccessAdmin}   [M04]
        │           useRouter, useSearchParams                    (next/navigation)
        │   lib:   getFirebaseConfigStatus()                      lib/firebase.ts [M01/M10]
        │   states: LoadingSpinner | "Firebase Not Configured" | redirect /login | redirect /
        └── AdminShell (client)           components/admin/layout/AdminShell.tsx
            │   state: isSidebarOpen; document.addEventListener("keydown") for ESC
            ├── AdminSidebar (client)     components/admin/layout/AdminSidebar.tsx
            │   │   hooks: usePathname(), useAuthContext()        context/AuthContext.tsx [M01/M04]
            │   │   data: allNavigation - HARDCODED inline at lines 37-104
            │   │   anim: framer-motion motion.div / motion.aside / AnimatePresence
            │   ├── desktop <aside> (lg:flex, lg:w-68)  -> raw <a href> links (full reload)
            │   └── mobile motion.aside (drawer)        -> <button onClick=window.location.href>
            ├── AdminHeader (client)      components/admin/layout/AdminHeader.tsx
            │   │   hooks: useAuthContext() {user, profile, normalizedRole, canAccessSettings, logout}
            │   │   anim: framer-motion for the avatar menu
            │   ├── menu button (lg:hidden) -> onMenuClick
            │   ├── next/image logo + role badge
            │   ├── <form onSubmit=handleSearch>  keyword -> router.push (AdminHeader.tsx:58-78)
            │   ├── NotificationDropdown (client)  components/admin/layout/NotificationDropdown.tsx
            │   │       hook: useDonationNotifications()  hooks/useDonationNotifications.ts [M01/M03]
            │   │       -> list of recent donations, markAsRead / markAllAsRead
            │   └── avatar menu -> /admin/settings, /, logout()
            └── <main className="flex-1 p-4 pb-20 lg:p-6 lg:pb-6">
                └── {children}            (the page)
                    + <main id="main-content" tabIndex={-1}> from app/admin/layout.tsx:26  <-- nested <main>, M05-F14
                    + GoUpButton (client)  components/ui/GoUpButton.tsx [M01]
```

### 2. Dashboard `/admin`

```
DashboardPage (client)                    app/admin/page.tsx
│   hooks: useAuth() -> profile           hooks/useAuth.ts [M01/M04]
│          useState<PublicAnalyticsStats>, useEffect (single fetch on mount)
│   direct data access (NO service layer):
│     getCountFromServer(collection(db,"users"|"volunteers"|"members"|"donations"
│                                      |"sevaBookings"|"events"|"chat_sessions"))   page.tsx:100-108
│     getCountFromServer(query(events, where("date",">=",now)))                     page.tsx:111
│     getDocs(query(donations, where("status","==","completed")))                   page.tsx:172  <-- M05-F01
│   service: getAnalyticsSummary(30)      services/pageviews.service.ts [M10/M15]
│   fetch:   GET /api/ai/analytics                                                  page.tsx:117 [M08]
├── header row: greeting + Refresh (window.location.reload) + Link "/" 
├── MiniStat x6 (client, inline at page.tsx:45)   Users / Volunteers / Donors / Events / Bookings / AI Chats
├── SectionCard "Website Analytics" (client, inline at page.tsx:59)   <-- shadows components/admin/common/SectionCard.tsx
│   ├── 6 raw <div> tiles: Page Views, Visitors, Session, Bounce, Weekly Active, New Signups
│   ├── Top Pages list          <- pageviews.service
│   ├── Traffic sources         <- pageviews.service
│   └── Devices breakdown       <- pageviews.service
└── grid lg:grid-cols-3
    ├── SectionCard "AI Assistant"  - conversations / success rate / latency / languages / top intents
    ├── SectionCard "Donations"     - Total ₹ / Avg ₹ / count   (first two always 0, M05-F01)
    └── SectionCard "Quick Actions" - 4 next/link cards + link to /ai/analytics
```

Note: `components/admin/dashboard/` (`StatsGrid`, `WelcomeBanner`, `QuickActionCard`,
`AdminSearchResults`) is an **unused alternative dashboard** - zero importers. So are
`services/dashboard.service.ts`, `services/dashboard.service.client.ts` and `types/dashboard.ts`
(only `StatsGrid` imports the type).

### 3. The generic CRUD framework (drawn once; the pages that use it are listed after)

```
<some admin list page> (client)
├── AdminPageHeader (server component, no "use client")   components/admin/common/AdminPageHeader.tsx
│       gradient icon tile + title + description + optional action slot     (58 importers - the most reused file in the repo)
├── SearchBox (client)                                    components/admin/common/SearchBox.tsx
│       controlled <input type="search">, amber focus ring
└── CrudTable<T> (client)                                 components/admin/crud/CrudTable.tsx
    │   useReactTable({ data, columns: createCrudColumns(columns, actions), getCoreRowModel })
    │   props: data: T[], columns: CrudColumn<T>[], actions?: CrudTableActions<T>, emptyMessage
    ├── createCrudColumns (server)                        components/admin/crud/createCrudColumns.tsx
    │       CrudColumn<T>[] -> TanStack ColumnDef<T>[]; header span, accessorFn, enableSorting
    └── CrudTableCell (server)                            components/admin/crud/CrudTableCell.tsx
        │   priority: column.render > column.formatter > column.type switch
        │   formatters from lib/format.ts [M01]: formatCurrency, formatNumber, formatDate,
        │                                        formatDateTime, formatBoolean
        ├── type "status"  -> StatusBadge (server)        components/admin/crud/StatusBadge.tsx
        │       10 hardcoded English statuses -> pill classes; unknown -> stone fallback
        ├── type "image"   -> raw <img>  (NOT next/image)   CrudTableCell.tsx:81
        └── type "actions" -> TableActions (client)       components/admin/crud/TableActions.tsx
                Eye / Pencil / Trash2 icon buttons wired to actions.onView/onEdit/onDelete
```

**Pages that use `CrudTable`** (4): `app/admin/announcements/page.tsx:8`,
`app/admin/bookings/page.tsx:7`, `app/admin/donations/page.tsx:7`, `app/admin/quotes/page.tsx:16`,
plus `components/admin/events/EventTable.tsx:6`.

**Half-adopted** (define `CrudColumn<T>[]` against `types/crud.ts` but never render `CrudTable`):
`app/admin/sevas/columns.ts` - imported at `app/admin/sevas/page.tsx:11`, which then hand-rolls a
`<table>` at `:178`; `app/admin/gallery/columns.ts` - zero importers. See M05-F37.

**Pages that reinvent the table** (everything else): `app/admin/sevas`, `app/admin/receipts`,
`app/admin/billing`, `app/admin/pooja`, `app/admin/aaradhane`, `app/admin/seva-bookings`,
`app/admin/users`, `app/admin/featured`, all of `app/admin/ai/*`. They import `SearchBox` and
`AdminPageHeader` but hand-roll their own `<table>` markup.

**Never used at all**: `components/admin/crud/index.ts` (exports only `CrudToolbar`),
`CrudToolbar.tsx`, `hooks/useCrudTable.ts`, `lib/crud-columns.tsx`.

### 4. A typical settings sub-page (twelve pages share this exact shape)

```
<Name>SettingsPage (client)               app/admin/settings/<slug>/page.tsx
│   const COLLECTION = "settings"; const DOCUMENT = "<docId>";
│   useState<FormShape>(hardcoded defaults)
│   useEffect -> getDoc(doc(db, COLLECTION, DOCUMENT))            <-- direct Firestore, no service
│   save()    -> setDoc(doc(db, COLLECTION, DOCUMENT), {...state, updatedAt}, {merge:true})
│   feedback  -> toast.success / toast.error   (react-hot-toast)
├── AdminPageHeader (server)
├── hand-rolled <input>/<textarea> fields using components/ui/input.tsx + textarea.tsx [M01]
│   (array sections get local add/remove/reorder handlers - no shared list editor)
└── Save button (local `saving` state, no dirty tracking, no optimistic UI, no confirm-on-leave)
```

Exact line anchors for the `getDoc`/`setDoc` pair in each page:
about `129/153`, ekadashi-calendar `65/89`, facilities `143/166`, festival-calendar `59/82`,
finance `27/72`, footer `90/115`, future-plans `117/153`, guru-parampara `174/197`,
puja-schedule `88/111`, shlokas `61/84`, social-links `66/89`, trust-committee `56/79`.

### 5. Homepage Settings - the one correctly layered settings page

```
HomepageSettingsPage (client)             app/admin/settings/homepage/page.tsx
│   useState refreshKey -> remounts the form after a save
├── AdminPageHeader (server)
└── HomepageSettings (client)             components/admin/settings/HomepageSettings.tsx
    └── HomepageForm (client)             components/admin/settings/homepage/HomepageForm.tsx
        │   hook: useHomepageForm()       components/admin/settings/homepage/useHomepageForm.ts
        │     - loads via homepageService.getHomepage()        services/homepage.service.ts [M02/M10]
        │     - defaults from ./constants.ts (DEFAULT_HOMEPAGE_CONFIG)
        │     - validates via ./validation.ts validateHomepageForm()
        │     - saves via homepageService.saveHomepage()  -> Firestore homepage/config
        │     - then POST /api/revalidate { paths: ["/"] }     useHomepageForm.ts:91
        ├── FormContainer / FormActions    components/ui/form/* [M01]
        ├── HeroSection (client)           FormSection + FormTextField
        ├── ContactInfoSection (client)    FormSection + FormTextField + FormTextArea
        ├── AnnouncementSection (client)   FormSection + FormTextArea
        ├── TimingsSection (client)        FormSection + FormTextField + FormTextArea
        ├── DashboardSpecialSection (client)
        ├── DashboardQuoteSection (client)
        └── TestimonialsSection (client)   just a next/link out to /admin/testimonials [M06]
```

### 6. Website Settings (a parallel, half-built experiment)

```
TempleInformationPage (SERVER)            app/admin/website-settings/temple-information/page.tsx
│   await getTempleSettings()             lib/settings/temple.ts -> import website-settings/temple.json
└── TempleInformationForm (client)        components/admin/settings/TempleInformationForm.tsx
    └── TempleDetailsCard (client)        components/admin/settings/sections/TempleDetailsCard.tsx
        │   react-hook-form useForm<TempleDetailsForm>
        │   submit(data) { console.log("Temple Details", data); }   <-- never persists, TempleDetailsCard.tsx:36
        └── SettingsCard (server)         components/admin/settings/SettingsCard.tsx
                shadcn Card / CardHeader / CardContent / CardFooter [M01]
```

### 7. Reports `/admin/reports`

```
AdminReportsPage (client)                 app/admin/reports/page.tsx:574
└── AdminAuthGuard requiredPermission="admin"
    └── ReportsPageContent (client)
        │   hook: useAuth() -> user (for user.getIdToken())
        │   services: receiptService.getReceiptReport(range, idToken)   [M07/M10]
        │             receiptService.getReceipts({...export:true}, idToken)
        │             donationService.getDonations()                    [M03/M10]
        │             sevaBookingService.getAllBookings()               [M03/M10]
        │   NOTE: services/report.service.ts computes this same summary and is never imported
        ├── AdminPageHeader (server)
        ├── date-range pill group: today | week | month | quarter | year (+ custom inputs)
        ├── Export CSV  -> Blob + document.createElement("a").click()   page.tsx:259-267
        ├── Print       -> window.print()                               page.tsx:182
        └── ReportCard x4 (server)         components/admin/reports/ReportCard.tsx
                Total Revenue / Donations / Seva bookings / Receipt collection
                + seva-wise and timeline tables from receiptReport
```

### 8. Featured content `/admin/featured`

```
FeaturedContentPage (client)              app/admin/featured/page.tsx
│   hook: useAuth() -> profile
│   /* eslint-disable */ at :1 - whole-file lint opt-out since 2026-10-03 (M05-F38)
│   direct Firestore: getDocs(query(collection(db,"featuredContent"), orderBy("priority")))  :108
│                     getDocs(collection(db,"events"|"announcements"|"sevas"|"knowledge"))   :144-147
│                     addDoc / updateDoc / deleteDoc on "featuredContent"                     :218/:235
│   local defaultFeatured[] seeds the UI when Firestore is empty                              :68-92
├── hand-rolled toolbar (Plus / Save / reorder ArrowUp-ArrowDown)
├── item rows with next/image thumbnails + ToggleLeft/ToggleRight active switch
└── "Add" modal - a raw fixed-overlay div, not FormDialog, not a shadcn Dialog
```

### 9. Admin UI patterns actually in use (the inventory a redesign starts from)

A note on the `(server)` markers above: they mean **the file does not declare `"use client"`**.
Every one of them (`AdminPageHeader`, `createCrudColumns`, `CrudTableCell`, `StatusBadge`,
`SettingsCard`, `ReportCard`, `SectionCard`) is imported by a `"use client"` parent, so at runtime
they are all client components and all ship in the browser bundle. Only `app/admin/layout.tsx` and
`app/admin/website-settings/temple-information/page.tsx` are true Server Components in M05.

| Pattern | What is actually used | Where | Competing / dead alternative |
|---|---|---|---|
| Page title | `AdminPageHeader` - gradient icon tile + h1 + description + action slot | `components/admin/common/AdminPageHeader.tsx` (58 importers) | `common/PageHeader.tsx` (dead) |
| Tables | `CrudTable` on 4 pages + `EventTable`; hand-rolled `<table>` everywhere else | `components/admin/crud/CrudTable.tsx` | `CrudToolbar` + `crud/index.ts` (dead), `hooks/useCrudTable.ts` (dead) |
| Search | `SearchBox` controlled `<input type="search">`, amber focus ring | `components/admin/common/SearchBox.tsx:30-40` (13 importers) | `common/SearchBar.tsx` (dead) |
| Stat tile | `StatCard`; the dashboard instead re-declares `MiniStat` inline | `components/admin/common/StatCard.tsx`; `app/admin/page.tsx:45` | `dashboard/StatsGrid.tsx`, `admin/DashboardCard.tsx` (both dead) |
| Card / section | `SectionCard` re-declared inline on the dashboard; `SettingsCard` wraps shadcn `Card` for website-settings only | `app/admin/page.tsx:59`; `components/admin/settings/SettingsCard.tsx` | `common/SectionCard.tsx`, `common/AdminCard.tsx` (both dead) |
| Modals | One `FormDialog` importer (`app/admin/receipts/seva-settings/page.tsx:9`); `/admin/featured` hand-rolls a `fixed inset-0` overlay | `components/admin/common/FormDialog.tsx:20-37` | shadcn `Dialog` in `components/ui` is never used in admin |
| Forms | Two families: hand-rolled `<input>`/`<textarea>` + local `useState` (the twelve settings pages), and `components/ui/form/*` + a hook (homepage settings only). `react-hook-form` appears once, in `TempleDetailsCard` | `app/admin/settings/*/page.tsx`; `components/admin/settings/homepage/*` | - |
| Toasts | **`react-hot-toast`** - 66 files; `<Toaster>` mounted at `app/layout.tsx:91` | `import toast from "react-hot-toast"` | `sonner@^2.0.7` is installed with **zero** imports (M05-F24); `docs/ADMIN-GUIDELINES.md:688` documents sonner |
| Confirm | No shared confirm component. `TableActions` deletes immediately. Where confirmation does exist it is the bare global `confirm(...)` - 10 call sites in 9 settings pages: `about:190`, `ekadashi-calendar:121`, `facilities:205,231`, `festival-calendar:115`, `finance:133`, `future-plans:195`, `guru-parampara:237`, `shlokas:124`, `trust-committee:121` (all under `app/admin/settings/`) | `components/admin/crud/TableActions.tsx:52-63` | M05-F22 |
| Buttons | `components/ui/button.tsx` (shadcn) | | `common/AdminButton.tsx`, `common/ActionButton.tsx` (both dead) |
| Loading | Bespoke spinner markup, duplicated (M05-F32) | `app/admin/layout.tsx:14`, `AdminAuthGuard.tsx:27` | no skeletons anywhere in the module |
| Empty state | `EmptyState` + presets, 1 admin importer; `CrudTable` has its own `emptyMessage` row | `components/admin/common/EmptyState.tsx`; `CrudTable.tsx:55-64` | - |
| Motion | `framer-motion` in `AdminSidebar` and `AdminHeader` only | | |
| Colour | Amber/orange hardcoded in Tailwind class strings, no design tokens | see Recipe F | |

## Data flow

### Flow 1 - Loading and saving a settings page (e.g. About Us)

1. Admin opens `/admin/settings/about`. `AdminLayout` (`app/admin/layout.tsx:23`) mounts
   `AdminAuthGuard`, which calls `useAuth()` and blocks on `loading`.
2. `AdminAuthGuard` checks `getFirebaseConfigStatus()` (`lib/firebase.ts`), then `user`, then
   `canAccessAdmin` (`components/admin/layout/AdminAuthGuard.tsx:83/114/122`). Failures
   `router.replace("/login?redirect=...")` or `router.replace("/")`.
3. `app/admin/settings/layout.tsx:12` wraps the page in a **second** `AdminAuthGuard` with
   `requiredPermission="settings"` - which resolves to the same `canAccessAdmin` boolean
   (`AdminAuthGuard.tsx:135-141`), so it adds nothing.
4. `AboutUsSettingsPage`'s `useEffect` runs `getDoc(doc(db, "settings", "aboutUs"))`
   (`app/admin/settings/about/page.tsx:129-130`) straight from the browser and `setState`s the form.
5. Admin edits fields, clicks Save → `setDoc(docRef, {...state, updatedAt}, {merge:true})`
   (`page.tsx:152-153`) → `toast.success("About Us saved successfully!")` (`page.tsx:158`).
6. The public page `app/(public)/about/page.tsx:112` reads the same document on its own
   `getDoc(doc(db, "settings", "aboutUs"))`. There is no revalidation hop and no shared service; the
   read and the write are two independent copies of the same Firestore path string.

### Flow 2 - Dashboard load

1. `DashboardPage` mounts (client) and its single `useEffect` fires `fetchPublicStats()`
   (`app/admin/page.tsx:92`).
2. Seven `getCountFromServer` aggregate queries run in `Promise.all` over `users`, `volunteers`,
   `members`, `donations`, `sevaBookings`, `events`, `chat_sessions` (`page.tsx:100-108`), then an
   eighth for upcoming events (`page.tsx:111`).
3. `fetch("/api/ai/analytics")` (M08) fills latency, success rate, language split and top intents
   (`page.tsx:117-141`). Failures are swallowed to `console.warn`.
4. `getAnalyticsSummary(30)` from `services/pageviews.service.ts` (M10/M15) fills page views,
   visitors, session duration, bounce, traffic sources and device split (`page.tsx:156`).
5. `getDocs(query(collection(db,"donations"), where("status","==","completed")))` (`page.tsx:172`)
   is meant to fill donor count and revenue. `DonationStatus` in `types/donation.ts:1-4` is
   `"pending" | "received" | "failed"` - `"completed"` is not a member, so the snapshot is always
   empty and the Donations card always shows ₹0 / ₹0.
6. One `setPublicStats(...)` re-render; the catch branch resets every field to zero.
7. The "Refresh" control does `window.location.reload()` (`page.tsx:237`), not a refetch.

### Flow 3 - Homepage Settings save (the reference pattern)

1. `useHomepageForm()` loads `homepageService.getHomepage()` into `formData`, merged over
   `DEFAULT_HOMEPAGE_CONFIG` (`components/admin/settings/homepage/useHomepageForm.ts:35-41`).
2. `updateField(key, value)` writes state and clears that field's error (`useHomepageForm.ts:55`).
3. Submit → `validateHomepageForm(formData)` (`components/admin/settings/homepage/validation.ts:3`)
   → on errors, abort and render them inline through `FormTextField`.
4. `homepageService.saveHomepage(formData)` writes Firestore `homepage/config`
   (`services/homepage.service.ts`, M02/M10).
5. `POST /api/revalidate { paths: ["/"] }` (`useHomepageForm.ts:91`) busts the public homepage cache.
6. Status banner shown for 5s; `onSaved()` bumps `refreshKey` in `app/admin/settings/homepage/page.tsx:20`,
   remounting the form so it re-reads from Firestore.

### Flow 4 - Site Settings save (broken)

1. `/admin/settings` loads through `settingsService.getSettings()`, which uses the **browser**
   Supabase client and reads `site_settings` (`services/settings.service.ts:41-47`). This works.
2. Submit calls `settingsService.updateSettings(id, payload)` or `createSettings(payload)`
   (`app/admin/settings/page.tsx:69-71`).
3. Since 2026-10-13 (`54024a1`, hardened by five BOT-004 commits on 2026-10-14) both methods
   dynamically `import("@/app/actions/settings")` and call the `"use server"` actions
   `createSettingsAction` / `updateSettingsAction` (`services/settings.service.ts:69-77`). The
   service-role client (`lib/supabase/admin.ts`, now `import 'server-only'` at `:1`) is created on
   the server, so the old "missing env var in the browser" failure is gone.
4. Each action first runs `verifyAdminForAction()` (`app/actions/settings.ts:26-35`): it rebuilds a
   `NextRequest` from `headers()` and calls `checkAdminAuth` (`lib/auth/admin.ts:20-53`), which
   returns `null` unless the request carries `Authorization: Bearer <token>` (`lib/auth/admin.ts:25-29`).
   A server-action POST from the browser carries cookies, not an `Authorization` header, and the page
   passes no ID token - so the action throws `"Unauthorized"` (`app/actions/settings.ts:40-42`, `:75-77`).
   Even with a token, `isUserAdmin` accepts only `role === "admin"` (`lib/auth/admin.ts:71`), not
   `super_admin`, and it reads `users/{uid}` with the client Firestore SDK on the server.
5. The page catches, logs, and shows `"Unable to save settings. Please try again."`
   (`app/admin/settings/page.tsx:78`). The save still cannot succeed from this page (M05-F02) - only
   the reason changed. The zod validation in the action (`app/actions/settings.ts:10-20`) never runs.

### Flow 5 - Reports: build the summary and export CSV

1. Date-range pill sets `dateRange`; `getDateRange()` turns it into `{startDate, endDate}`
   (`app/admin/reports/page.tsx:60-91`).
2. `user.getIdToken()` → `receiptService.getReceiptReport({from,to}, idToken)`
   (`page.tsx:102-109`) hits the receipts API in M07 with a bearer token.
3. `donationService.getDonations()` and `sevaBookingService.getAllBookings()` fetch **everything**,
   then the page filters client-side by `createdAt` (`page.tsx:116-130`).
4. Cards render from the derived `summary` object; seva-wise and timeline tables render from
   `receiptReport`.
5. Export → `receiptService.getReceipts({..., pageSize: 10000, export: true}, idToken)`, rows joined
   into CSV, `new Blob(...)` + a synthetic `<a download>` click (`page.tsx:259-267`).
6. Print → `window.print()` with `print:hidden` utility classes on the controls (`page.tsx:182`).

### Flow 6 - Admin navigation

1. `AdminSidebar` reads the hardcoded `allNavigation` array (`components/admin/layout/AdminSidebar.tsx:37-104`)
   and passes it through `getFilteredNavigation()` (`:107`), which only ever drops the whole
   "Administration" group when `canAccessAdministration` is false. The other three permission
   arguments are accepted and ignored (`:110`, `filteredItems = section.items`).
2. Desktop items render as raw `<a href={item.href}>` (`:218`) - a full document navigation, losing
   the client router and re-running the auth gate every click.
3. Mobile items render as `<button onClick={() => { onClose(); window.location.href = item.href; }}>`
   (`:349-352`) - same full reload.
4. `components/admin/layout/navigation.ts`, `icons.ts` and `types.ts` define the same menu in a
   clean data shape and are imported by nothing.

## Key files

| File | Lines | Role | Key exports | Notes |
|---|---:|---|---|---|
| `app/admin/layout.tsx` | 35 | Admin route-group layout | `AdminLayout` | Only non-client page file in the shell; nests a second `<main>` |
| `app/admin/page.tsx` | 386 | Dashboard | `DashboardPage` | Direct Firestore; no services; two inline components |
| `app/admin/settings/layout.tsx` | 17 | Settings guard | `SettingsLayout` | Redundant second `AdminAuthGuard` |
| `app/admin/settings/page.tsx` | 170 | Site Settings (Supabase) | `AdminSettingsPage` | Save always fails (M05-F02); third nested guard |
| `app/admin/settings/about/page.tsx` | 666 | About Us editor | `AboutUsSettingsPage` | Largest settings page; `settings/aboutUs` |
| `app/admin/settings/facilities/page.tsx` | 536 | Facilities editor | `FacilitiesSettingsPage` | `settings/facilities` |
| `app/admin/settings/finance/page.tsx` | 491 | UPI / bank / special sevas / billing | `FinanceSettingsPage` | `settings/financeSettings`; `updateField` uses `any` path walking (`:91`). **This page is not the only writer of the document** - `scripts/update-finance-settings.ts` and its compiled twin `.js` `set()` the whole doc from the command line, overwriting whatever an admin saved, and both carry a hardcoded service-account key. Both are owned by M11 (`M11-F02`, `M11-F32`) |
| `app/admin/settings/guru-parampara/page.tsx` | 453 | Guru lineage editor | `GuruParamparaSettingsPage` | Orphan doc |
| `app/admin/settings/social-links/page.tsx` | 451 | Social links editor | `SocialLinksSettingsPage` | Writes Firestore; public reads Supabase (M05-F03) |
| `app/admin/settings/puja-schedule/page.tsx` | 460 | Daily pooja schedule | `PujaScheduleSettingsPage` | Orphan doc |
| `app/admin/settings/footer/page.tsx` | 437 | Footer content | `FooterSettingsPage` | Has a local `removeUndefined(obj: any)` helper (`:130`) |
| `app/admin/settings/future-plans/page.tsx` | 426 | Future plans editor | `FuturePlansSettingsPage` | `settings/futurePlans` |
| `app/admin/settings/shlokas/page.tsx` | 384 | Shlokas editor | `ShlokasSettingsPage` | Orphan; public uses `data/shlokas.ts` |
| `app/admin/settings/trust-committee/page.tsx` | 349 | Trust committee editor | `TrustCommitteeSettingsPage` | `settings/trustCommittee` |
| `app/admin/settings/festival-calendar/page.tsx` | 310 | Festival calendar editor | `FestivalCalendarSettingsPage` | Orphan doc |
| `app/admin/settings/ekadashi-calendar/page.tsx` | 306 | Ekadashi calendar editor | `EkadashiCalendarSettingsPage` | Orphan doc |
| `app/admin/settings/homepage/page.tsx` | 25 | Homepage settings entry | `HomepageSettingsPage` | Thin - the model to copy |
| `app/admin/website-settings/temple-information/page.tsx` | 20 | Temple info (server) | `TempleInformationPage` | Only server page in the module |
| `app/admin/reports/page.tsx` | 621 | Reports & analytics | `AdminReportsPage` | Two `as any` casts (`:446`, `:451`) |
| `app/admin/featured/page.tsx` | 595 | Featured content editor | `FeaturedContentPage` | Unreachable from the menu; 5 unbounded `getDocs`; whole-file `/* eslint-disable */` at `:1` since 2026-10-03 (M05-F38) |
| `app/admin/test/page.tsx` | 44 | Firestore write smoke test | `FirebaseTestPage` | Writes to a `test` collection |
| `app/admin/test-firebase/page.tsx` | 66 | Firebase config dump | `TestFirebasePage` | 4 `any` usages |
| `app/debug/page.tsx` | 48 | Env-var debug page | `DebugPage` | **Unauthenticated route** |
| `app/api/dashboard/daily-spiritual/route.ts` | 25 | Daily spiritual dashboard API | `GET`, `dynamic`, `revalidate` | No auth; no caller in-repo |
| `app/api/reports/list/route.ts` | 31 | List blob reports | `GET`, `runtime` | No auth |
| `app/api/reports/save/route.ts` | 115 | Save blob report | `POST`, `runtime`, `maxDuration` | No auth; accepts arbitrary base64 |
| `components/admin/layout/AdminShell.tsx` | 57 | Sidebar+header frame | `AdminShell` | `lg:pl-64` (`:48`) vs sidebar `lg:w-68` (`AdminSidebar.tsx:162`) - M05-F13 |
| `components/admin/layout/AdminAuthGuard.tsx` | 164 | Auth + permission gate | `AdminAuthGuard`, `withPermission` | `withPermission` ignores its permission arg (`:156-163`) |
| `components/admin/layout/AdminSidebar.tsx` | 381 | Sidebar (desktop + mobile drawer) | `AdminSidebar` | Nav hardcoded; `<a>` not `Link`; desktop and mobile menus duplicated wholesale |
| `components/admin/layout/AdminHeader.tsx` | 250 | Top bar, search, avatar menu | `AdminHeader` | Search routes to `/admin/timings` which does not exist |
| `components/admin/layout/NotificationDropdown.tsx` | 136 | Donation alerts bell | `NotificationDropdown` | `hasError` state is never set |
| `components/admin/layout/navigation.ts` | 144 | Declarative nav data | `navigation` | **Dead** - zero importers |
| `components/admin/layout/icons.ts` | 35 | Icon name → lucide map | `icons` | **Dead** - zero importers |
| `components/admin/layout/types.ts` | 11 | Nav item/group types | `NavigationItem`, `NavigationGroup` | **Dead** - zero importers |
| `components/admin/common/AdminPageHeader.tsx` | 41 | Standard page title block | `AdminPageHeader` | 58 importers - the module's real public API |
| `components/admin/common/SearchBox.tsx` | 44 | Standard admin search input | `SearchBox` | 13 importers |
| `components/admin/common/StatCard.tsx` | 40 | Stat tile | `StatCard` | 5 importer files - 4 live (`AaradhaneStats`, `EventStats`, `PoojaStats`, `UserStats`) + the dead `dashboard/StatsGrid.tsx:12` |
| `components/admin/common/EmptyState.tsx` | 111 | Empty-state block + presets | `EmptyState` (+ presets) | 1 real admin importer |
| `components/admin/common/FormDialog.tsx` | 39 | Bare modal shell | `FormDialog` | 1 importer; no focus trap, no ESC, no aria |
| `components/admin/common/AdminPageWrapper.tsx` | 57 | Error boundary (class) | `AdminPageWrapper` | 1 importer (`app/admin/gallery/page.tsx`) |
| `components/admin/common/AdminErrorBoundary.tsx` | 58 | Error boundary (class) | `AdminErrorBoundary` | **Dead**; duplicates the above; prints stack traces to users |
| `components/admin/common/AdminButton.tsx` | 171 | Styled button + framer-motion | `AdminButton` | **Dead** - duplicates `components/ui/button.tsx` |
| `components/admin/common/AdminCard.tsx` | 107 | Card + header/body/footer | `AdminCard`, `AdminCardHeader`, … | **Dead** - duplicates `components/ui/card.tsx` |
| `components/admin/common/AdminInput.tsx` | 153 | Input + textarea with label/error | `AdminInput`, `AdminTextarea` | **Dead** - duplicates `components/ui/input.tsx` |
| `components/admin/common/PageHeader.tsx` | 36 | Alternative page title block | `PageHeader` | **Dead** - duplicates `AdminPageHeader` |
| `components/admin/common/SearchBar.tsx` | 32 | Alternative search input | `SearchBar` | **Dead** - duplicates `SearchBox` |
| `components/admin/common/SectionCard.tsx` | 22 | Titled card | `SectionCard` | **Dead** - and shadowed by an inline copy in `app/admin/page.tsx:59` |
| `components/admin/common/ActionButton.tsx` | 34 | Button wrapper | `ActionButton` | **Dead** |
| `components/admin/common/AdminAssistant.tsx` | 237 | Stats + recommendations panel | `AdminAssistant` | Used only by `app/admin/assistant/page.tsx` (M09) |
| `components/admin/crud/CrudTable.tsx` | 91 | TanStack table wrapper | `CrudTable` | No sorting UI, no pagination, no selection, no loading skeleton |
| `components/admin/crud/CrudTableCell.tsx` | 121 | Cell renderer by column type | `CrudTableCell` | `type:"image"` uses raw `<img>` (`:81`) |
| `components/admin/crud/createCrudColumns.tsx` | 41 | CrudColumn → TanStack ColumnDef | `createCrudColumns` | The live copy |
| `components/admin/crud/StatusBadge.tsx` | 76 | Status pill | `StatusBadge` | Keys are English display strings, not enum values |
| `components/admin/crud/TableActions.tsx` | 67 | View/Edit/Delete icon buttons | `TableActions` | No confirm on delete |
| `components/admin/crud/CrudToolbar.tsx` | 74 | Search + refresh + add toolbar | `CrudToolbar` | **Dead** except via `index.ts` |
| `components/admin/crud/index.ts` | 2 | Barrel | `CrudToolbar` | **Dead**; exports only one of six files |
| `components/admin/dashboard/StatsGrid.tsx` | 33 | 8-tile stat grid | `StatsGrid` | **Dead** |
| `components/admin/dashboard/WelcomeBanner.tsx` | 44 | Gradient greeting banner | `WelcomeBanner` | **Dead**; greets "Administrator", no profile |
| `components/admin/dashboard/QuickActionCard.tsx` | 28 | Quick-action link card | `QuickActionCard` | **Dead** |
| `components/admin/dashboard/AdminSearchResults.tsx` | 139 | Search results panel | `AdminSearchResults` | **Dead** - the header search never renders results |
| `components/admin/reports/ReportCard.tsx` | 44 | Report metric card | `ReportCard` | Used 4x on `/admin/reports` |
| `components/admin/settings/HomepageSettings.tsx` | 27 | Homepage settings wrapper | `HomepageSettings` | Pure passthrough over `HomepageForm` |
| `components/admin/settings/homepage/HomepageForm.tsx` | 110 | Form shell + sections | `HomepageForm` | |
| `components/admin/settings/homepage/useHomepageForm.ts` | 135 | Load / validate / save hook | `useHomepageForm` | 3 `console.log`s left in (`:85`, `:87`, `:96`) plus a `console.warn` (`:97`) |
| `components/admin/settings/homepage/validation.ts` | 56 | Hand-written validators | `validateHomepageForm`, `hasHomepageValidationErrors` | No zod, unlike the documented pattern |
| `components/admin/settings/homepage/constants.ts` | 125 | `DEFAULT_HOMEPAGE_CONFIG` | `DEFAULT_HOMEPAGE_CONFIG` | Hardcoded temple copy lives here |
| `components/admin/settings/homepage/types.ts` | 37 | Form + error types | `HomepageFormData`, `HomepageSettingsProps`, `HomepageValidationErrors` | Error keys hand-listed, drift-prone |
| `components/admin/settings/homepage/HeroSection.tsx` | 165 | Hero fields | `HeroSection` | |
| `components/admin/settings/homepage/TimingsSection.tsx` | 232 | Timings fields | `TimingsSection` | Largest section |
| `components/admin/settings/homepage/ContactInfoSection.tsx` | 98 | Contact fields | `ContactInfoSection` | |
| `components/admin/settings/homepage/DashboardSpecialSection.tsx` | 87 | Dashboard special fields | `DashboardSpecialSection` | |
| `components/admin/settings/homepage/AnnouncementSection.tsx` | 62 | Announcement fields | `AnnouncementSection` | |
| `components/admin/settings/homepage/DashboardQuoteSection.tsx` | 58 | Daily quote fields | `DashboardQuoteSection` | |
| `components/admin/settings/homepage/TestimonialsSection.tsx` | 39 | Link out to testimonials | `TestimonialsSection` | Takes no props; just a `next/link` |
| `components/admin/settings/SettingsCard.tsx` | 39 | shadcn Card wrapper | `SettingsCard` | Used only by `TempleDetailsCard` |
| `components/admin/settings/TempleInformationForm.tsx` | 20 | Temple info form shell | `TempleInformationForm` | |
| `components/admin/settings/sections/TempleDetailsCard.tsx` | 73 | Temple name/subtitle/logo form | `TempleDetailsCard` | Submit is `console.log` (`:36`) |
| `hooks/useCrudTable.ts` | 30 | TanStack table hook | `useCrudTable` | **Dead** - `CrudTable` calls `useReactTable` itself |
| `hooks/useFinanceSettings.ts` | 73 | Read finance settings | `useFinanceSettings` | Duplicates the load logic of `app/admin/settings/finance/page.tsx:26-51` verbatim |
| `lib/crud-columns.tsx` | 28 | CrudColumn → ColumnDef | `createCrudColumns` | **Dead** - older copy, drops `actions` |
| `types/crud.ts` | 104 | CRUD framework types | `CrudColumnType`, `CrudColumn`, `CrudTableActions`, `CrudAction` | `width`/`align` declared but never honoured by `CrudTable` |
| `types/settings.ts` | 13 | Supabase site settings types | `SiteSettings`, `SiteSettingsPayload` | `updatedAt?: any` (`:9`) |
| `types/dashboard.ts` | 11 | Dashboard counters | `DashboardStats` | Only the dead `StatsGrid`/services use it |
| `services/settings.service.ts` | 118 | Supabase site settings + social links | `settingsService`, `SocialLinksData` | Reads use the browser Supabase client; `createSettings`/`updateSettings` now delegate to the server actions in `app/actions/settings.ts` (`:69-77`), which still reject browser saves (M05-F02) |
| `services/dashboard.service.ts` | 44 | Aggregate counts | `dashboardService` | **Dead** |
| `services/dashboard.service.client.ts` | 48 | Same counts via full `getDocs` | `dashboardService` | **Dead** and pathological - reads every doc to count |
| `services/report.service.ts` | 67 | Revenue/donation/booking summary | `reportService` | **Dead** - `/admin/reports` recomputes it inline |
| `website-settings/temple.json` | 30 | Static temple record | (JSON) | Read via `lib/settings/temple.ts`; never written |
| `homepage/config` | 11 | **A JSON file, not a directory** (456 bytes in git, 467 on a Windows CRLF checkout; no extension) at the repo root | (JSON) | A hand-dropped export of the Firestore `homepage/config` document (heroTitle, timings, announcement, `festivalDate: "2026-08-14"`). Nothing imports it; the live document is read through `homepageService` and `services/proof-report/database-export.service.ts:86` |
| `components/admin/AdminSidebar.tsx` *(adopted)* | 177 | Old sidebar | `AdminSidebar` | **Dead** duplicate |
| `components/admin/AdminHeader.tsx` *(adopted)* | 31 | Old header | `AdminHeader` | **Dead** duplicate |
| `components/admin/DashboardCard.tsx` *(adopted)* | 34 | Old stat card | `DashboardCard` | **Dead** duplicate of `StatCard` |
| `components/debug/ClientEnvDebug.tsx` *(adopted)* | 22 | Env dump component | `ClientEnvDebug` | **Dead**; would print all `NEXT_PUBLIC_FIREBASE_*` |

## Types and stores

### Types owned here

| Type | File | Used by |
|---|---|---|
| `CrudColumnType`, `CrudColumn<T>`, `CrudTableActions<T>`, `CrudAction<T>` | `types/crud.ts` | `CrudTable`, `CrudTableCell`, `createCrudColumns`, and the `columns.ts`/`columns.tsx` files in M06 (`announcements`, `events`, `gallery`, `quotes`) and M07 (`bookings`, `donations`, `sevas`) |
| `SiteSettings`, `SiteSettingsPayload` | `types/settings.ts` | `services/settings.service.ts`, `app/admin/settings/page.tsx`, `services/proof-report/database-export.service.ts` (M10/M14), `app/actions/settings.ts` (M12/M15) |
| `DashboardStats` | `types/dashboard.ts` | Only the dead `dashboard.service*.ts` and `StatsGrid` |
| `HomepageFormData`, `HomepageSettingsProps`, `HomepageValidationErrors` | `components/admin/settings/homepage/types.ts` | The homepage settings module only |

### Types consumed from elsewhere

`HomepageConfig` (`types/homepage.ts`, M10) · `TempleSettings` (`types/temple.ts`, M10) ·
`FinanceSettings`, `SpecialSeva`, `defaultFinanceSettings` (`types/finance.ts`, M07/M10) ·
`DonationRecord`, `DonationStatus` (`types/donation.ts`, M07/M10) · `SevaBooking`
(`types/seva-booking.ts`) · `Receipt`, `ReceiptReport` (`types/receipt.ts`, `services/receipt.service.ts`) ·
`ReportSummary` (`types/report.ts`, M10/M14).

### Stores touched

| Store | Path / table | R | W | Touched by |
|---|---|:-:|:-:|---|
| Firestore | `settings/aboutUs` | ✓ | ✓ | `app/admin/settings/about/page.tsx:129,153`; public read `app/(public)/about/page.tsx:112` |
| Firestore | `settings/facilities` | ✓ | ✓ | `app/admin/settings/facilities/page.tsx:143,166`; public read `app/(public)/facilities/page.tsx:126` |
| Firestore | `settings/futurePlans` | ✓ | ✓ | `app/admin/settings/future-plans/page.tsx:117,153`; public read `app/(public)/future-plans/page.tsx:108` |
| Firestore | `settings/trustCommittee` | ✓ | ✓ | `app/admin/settings/trust-committee/page.tsx:56,79`; public read `app/(public)/trust/page.tsx:61` |
| Firestore | `settings/footer` | ✓ | ✓ | `app/admin/settings/footer/page.tsx:90,115`; public read `components/layout/Footer.tsx:70` |
| Firestore | `settings/financeSettings` | ✓ | ✓ | `app/admin/settings/finance/page.tsx:27,72`; read by `hooks/useFinanceSettings.ts:22`, `app/admin/billing/*`, `app/admin/receipts/create` (M07), `components/home/DonationCTA|DonationForm|SevaBooking` (M02) |
| Firestore | `settings/socialLinks` | ✓ | ✓ | `app/admin/settings/social-links/page.tsx:66,89` - **no reader** (public uses Supabase) |
| Firestore | `settings/guruParampara` | ✓ | ✓ | `app/admin/settings/guru-parampara/page.tsx:174,197` - **no reader** (the `guruParampara` *collection* used by `lib/aaradhane/firestore-source.ts:22` is a different path) |
| Firestore | `settings/shlokas` | ✓ | ✓ | `app/admin/settings/shlokas/page.tsx:61,84` - **no reader** (public `/shlokas` imports `data/shlokas.ts:8`) |
| Firestore | `settings/poojaSchedule` | ✓ | ✓ | `app/admin/settings/puja-schedule/page.tsx:88,111` - **no reader** |
| Firestore | `settings/ekadashiCalendar` | ✓ | ✓ | `app/admin/settings/ekadashi-calendar/page.tsx:65,89` - **no reader** |
| Firestore | `settings/festivalCalendar` | ✓ | ✓ | `app/admin/settings/festival-calendar/page.tsx:59,82` - **no reader** |
| Firestore | `homepage/config` | ✓ | ✓ | via `homepageService` (M02/M10) from `useHomepageForm.ts:35,86` |
| Firestore | `featuredContent` | ✓ | ✓ | `app/admin/featured/page.tsx:108,218,235` - **no reader anywhere else** (`lib/supabase/migration-inventory.ts:59` lists it for migration review; that is a manifest, not a reader) |
| Firestore | `users`, `volunteers`, `members`, `donations`, `sevaBookings`, `events`, `chat_sessions` | ✓ | | `app/admin/page.tsx:100-111,172` (counts only) |
| Firestore | `events`, `announcements`, `sevas`, `knowledge` | ✓ | | `app/admin/featured/page.tsx:144-147` (full-collection reads to populate a picker) |
| Firestore | `gallery`, `announcements`, `timings`, `sevas` | ✓ | | the dead `services/dashboard.service*.ts` |
| Firestore | `test` | | ✓ | `app/admin/test/page.tsx:15` - junk writes |
| Supabase | `site_settings` | ✓ | ✓ | read `services/settings.service.ts:43`; writes in the server action `app/actions/settings.ts:53,109` (M12/M15) |
| Supabase | `social_links` | ✓ | | `services/settings.service.ts:83`; consumed by `components/home/SocialBar.tsx`, `components/layout/Navbar.tsx`, `app/(public)/display/page.tsx` |
| Static JSON | `website-settings/temple.json` | ✓ | | `lib/settings/temple.ts:1` |
| Vercel Blob | report files | ✓ | ✓ | `app/api/reports/list`, `app/api/reports/save` via `services/storage.service.ts` (M06/M10) |

## Cross-module dependencies

### M05 imports from

| Chunk | What |
|---|---|
| M01 (foundation/UI kit) | `components/ui/button.tsx`, `card.tsx`, `input.tsx`, `textarea.tsx`, `GoUpButton.tsx`, `components/ui/form/{FormContainer,FormActions,FormSection,FormTextField,FormTextArea}`, `lib/utils.ts` (`cn`), `lib/format.ts` |
| M01/M04 (auth) | `hooks/useAuth.ts`, `context/AuthContext.tsx` - `canAccessAdmin`, `canAccessAdministration`, `canAccessSettings`, `canAccessFinance`, `canManageUsers`, `normalizedRole`, `logout` |
| M01/M10 | `lib/firebase.ts` - `db`, `isFirebaseConfigured`, `getFirebaseConfigStatus`, `validateFirebaseConfig` |
| M01/M03 | `hooks/useDonationNotifications.ts` (notification bell) |
| M02/M10 | `services/homepage.service.ts` |
| M03/M10 | `services/donation.service.ts`, `services/sevaBooking.service.ts` |
| M03/M11 | `data/shlokas.ts` |
| M04/M11 | `lib/supabase/client.ts`. The service-role `lib/supabase/admin.ts` is no longer imported by M05 (until 2026-10-13 it was, dynamically); it is now reached only through `app/actions/settings.ts` |
| M12/M15 | `app/actions/settings.ts` - `createSettingsAction`, `updateSettingsAction`, dynamically imported at `services/settings.service.ts:70,75`; they depend on `lib/auth/admin.ts` (`checkAdminAuth`, `isUserAdmin`) and `lib/supabase/admin.ts` |
| M06/M10 | `services/storage.service.ts` (report blob routes) |
| M07/M10 | `services/receipt.service.ts`, `types/{donation,finance,receipt,seva-booking}.ts` |
| M08 | `GET /api/ai/analytics` (fetched, not imported) |
| M10 | `lib/settings/temple.ts`, `types/homepage.ts`, `types/temple.ts` |
| M10/M14 | `services/daily-spiritual.service.ts`, `types/report.ts` |
| M10/M15 | `services/pageviews.service.ts` |
| M11/M14 | `data/calendar.ts` |

### Who imports M05

| Chunk | What it takes |
|---|---|
| M01 | `services/settings.service.ts` ← `components/layout/Navbar.tsx` |
| M02 | `hooks/useFinanceSettings.ts` ← `components/home/{DonationCTA,DonationForm,SevaBooking}.tsx`; `services/settings.service.ts` ← `components/home/SocialBar.tsx` |
| M03 | `services/settings.service.ts` ← `app/(public)/display/page.tsx` |
| M04 | `AdminPageHeader`, `SearchBox`, `AdminAuthGuard`, `StatCard` ← `app/admin/users/*` |
| M06 | `AdminPageHeader` (11 pages), `SearchBox`, `CrudTable`, `AdminPageWrapper`, `StatCard`, `types/crud.ts` ← announcements / events / gallery / quotes / temple-areas |
| M07 | `AdminPageHeader` (13 pages), `SearchBox`, `CrudTable`, `FormDialog`, `StatCard`, `AdminAuthGuard`, `hooks/useFinanceSettings.ts`, `types/crud.ts` ← aaradhane / billing / bookings / donations / pooja / receipts / seva-bookings / sevas |
| M09 | `AdminPageHeader` (10 pages), `EmptyState`, `AdminAssistant` ← `app/admin/ai/*`, `app/admin/assistant`, `app/admin/knowledge` |
| M10/M14 | `types/settings.ts` ← `services/proof-report/database-export.service.ts` |

**The boundary in one line:** M05 owns the shell and the shared admin primitives
(`AdminPageHeader`, `SearchBox`, `StatCard`, `AdminAuthGuard`, `CrudTable`, `types/crud.ts`); every
other admin chunk consumes them and owns its own domain pages and services.

## How to change it

### Recipe A - Add a new admin page under an existing menu group

1. `app/admin/<slug>/page.tsx` - `"use client"` (or a server component if you can), default-export
   the page. The shell and auth gate are already applied by `app/admin/layout.tsx`.
2. Open with `<AdminPageHeader title=… description=… action={…} />` from
   `components/admin/common/AdminPageHeader.tsx`.
3. Add the menu entry to the `allNavigation` array in
   `components/admin/layout/AdminSidebar.tsx:37-104`. **Not** `navigation.ts` - that file is dead.
   Pick an `icon` key that exists in the `iconMap` at `AdminSidebar.tsx:12-34`, or the entry falls
   back to the dashboard icon.
4. If the page must be restricted, add it inside the `"Administration"` group - that is the only
   group `getFilteredNavigation` (`AdminSidebar.tsx:107`) actually hides. Route-level protection
   needs a real check; `requiredPermission` on `AdminAuthGuard` does not discriminate.
5. If the header search should find it, add a keyword branch to `handleSearch` in
   `components/admin/layout/AdminHeader.tsx:63-75`.

### Recipe B - Add a new settings page that the public site reads

1. Decide the document id, e.g. `settings/donationsPolicy`.
2. **Preferred** (follow the homepage module, not the other eleven): add read/write methods to a
   service under `services/` mirroring `services/homepage.service.ts`, then build
   `components/admin/settings/<slug>/` with a `use<Slug>Form.ts` hook + `validation.ts` +
   section components using `components/ui/form/*`, and a 25-line
   `app/admin/settings/<slug>/page.tsx` that renders `AdminPageHeader` + the form.
3. If you must match the existing twelve instead, copy
   `app/admin/settings/trust-committee/page.tsx` (the shortest complete example), change
   `COLLECTION`/`DOCUMENT` at the top, and rewrite the state shape and JSX.
4. Add the sidebar entry per Recipe A step 3.
5. Wire the **public consumer** in the same change - otherwise you have created another orphan
   document (see M05-F04). Search the public route for an existing `doc(db, "settings", …)` read.
6. Update the Firestore rules for the new document if the rules enumerate ids
   (`firestore.rules`, M04/M11).

### Recipe C - Add a field to an existing settings page

1. Re-read `app/admin/settings/<slug>/page.tsx` from disk.
2. Add the key to the local state interface and to the `useState` defaults near the top.
3. Add the input in the JSX, bound to `settings.<key>` / `setSettings`.
4. Nothing else is needed on write - `setDoc(..., {merge:true})` persists whatever is in state.
5. Add the field to the public consumer's read and render. Do not assume the document already has
   it; every consumer must default it, since old documents will not.

### Recipe D - Build an admin list page on the CRUD framework

1. Create `app/admin/<module>/columns.ts` exporting `const columns: CrudColumn<T>[]` (see
   `app/admin/donations/columns.ts` for a working example). Use `type` for built-in rendering,
   `formatter` for value-level tweaks, `render` for full control, and one `{ key: "actions",
   type: "actions" }` column last.
2. In the page: `const [search, setSearch] = useState("")`, filter your rows in a `useMemo`.
3. Render `<AdminPageHeader/>`, `<SearchBox value onChange/>`, then
   `<CrudTable data={filtered} columns={columns} actions={{onView,onEdit,onDelete}} emptyMessage=…/>`.
4. If a status column is involved, make sure the value you pass matches one of the ten keys in
   `components/admin/crud/StatusBadge.tsx:12-53` (they are capitalised English words, not the
   lowercase enum values used in the types) - otherwise every badge renders stone-grey.
5. Delete confirmation is **your** responsibility; `TableActions` fires `onDelete` immediately.

### Recipe E - Add a dashboard widget

1. Add the field to the `PublicAnalyticsStats` interface at `app/admin/page.tsx:17-43` **and** to
   both the initial `useState` object (`:79-89`) and the catch-branch reset object (`:214-224`) -
   they are three hand-maintained copies of the same shape.
2. Fetch inside `fetchPublicStats` (`:92`). Prefer adding a method to a service over another inline
   `getCountFromServer`.
3. Render a `<MiniStat …/>` (`:45`) or a new `<SectionCard …>` (`:59`).
4. If the widget needs a server-side aggregate, add a route under `app/api/dashboard/` following
   `daily-spiritual/route.ts`, and add an auth check - that route has none.

### Recipe F - Change the admin colour scheme / chrome

Amber-orange is hardcoded in Tailwind class strings, not tokens. The files to touch, in order:
`components/admin/layout/AdminShell.tsx:40` (page background gradient),
`components/admin/layout/AdminSidebar.tsx:162,164,167,190,224` (sidebar surface, rail, active pill),
`components/admin/layout/AdminHeader.tsx:91,127,167` (header bar, search focus ring, avatar),
`components/admin/common/AdminPageHeader.tsx:18-19` (title icon tile),
`components/admin/common/SearchBox.tsx:39` (input), `app/admin/layout.tsx:12-15` and
`components/admin/layout/AdminAuthGuard.tsx:25-27,39,88` (four copies of the same loading spinner).

### Recipe G - Retire the dead admin components

1. Confirm zero importers: `grep -rn "<Name>" --include=*.tsx --include=*.ts . | grep -v node_modules`.
2. Delete in this order (no file below is imported by anything):
   `components/admin/layout/{navigation.ts,icons.ts,types.ts}`,
   `components/admin/{AdminSidebar.tsx,AdminHeader.tsx,DashboardCard.tsx}`,
   `components/admin/common/{AdminButton,AdminCard,AdminInput,AdminErrorBoundary,PageHeader,SearchBar,SectionCard,ActionButton}.tsx`,
   `components/admin/dashboard/{StatsGrid,WelcomeBanner,QuickActionCard,AdminSearchResults}.tsx`,
   `components/admin/crud/{index.ts,CrudToolbar.tsx}`, `hooks/useCrudTable.ts`,
   `lib/crud-columns.tsx`, `services/dashboard.service.ts`, `services/dashboard.service.client.ts`,
   `services/report.service.ts`, `components/debug/ClientEnvDebug.tsx`, and the stray
   `homepage/config` JSON file at the repo root (it is a file, not a directory - see M05-F35).
3. `types/dashboard.ts` only survives if you keep `StatsGrid`; otherwise it goes too.
4. Remove `sonner` from `package.json:95` - it has zero imports repo-wide.

## Faults, smells and risks

| id | sev | what | evidence | suggested direction | status (2026-10-18) |
|---|---|---|---|---|---|
| M05-F01 | HIGH | Dashboard donation revenue, average and donor count are permanently zero: the query filters `status == "completed"`, but `DonationStatus` is `"pending" \| "received" \| "failed"`. | `app/admin/page.tsx:172` vs `types/donation.ts:1-4` (`services/report.service.ts:14` correctly uses `"received"`) | Use `"received"`; better, move the aggregation into `donationService` so the enum is applied in one place | STILL OPEN |
| M05-F02 | HIGH | Saving Site Settings can never succeed. *Until 2026-10-13* the client page's service imported the Supabase **service-role** client, which throws in the browser. *Since `54024a1`* the service calls the server actions in `app/actions/settings.ts`, so the service-role client now runs server-side - but the action's guard demands an `Authorization: Bearer` header that a browser server-action POST never carries, and the page sends no ID token, so every save throws `"Unauthorized"` and the page shows the same "Unable to save settings" message. Even a tokened call is refused for `super_admin`, because `isUserAdmin` accepts only `role === "admin"`. The new unit test mocks `checkAdminAuth` away, so it cannot see this. | `app/admin/settings/page.tsx:69-71,78` → `services/settings.service.ts:69-77` → `app/actions/settings.ts:26-35,39-42,74-77` → `lib/auth/admin.ts:25-29,71`; mock at `tests/unit/bot-004-action.test.ts:19-29` | Have the page pass `await user.getIdToken()` as an action argument and verify it with the Admin SDK inside the action (or POST to an authenticated route handler - `app/api/admin/settings/route.ts` still does not exist); accept `super_admin` as well as `admin` | STILL OPEN - mechanism changed by `54024a1` (and the 2026-10-14 BOT-004 follow-ups); see the row |
| M05-F03 | HIGH | Social links are edited in Firestore `settings/socialLinks` but every consumer reads the Supabase `social_links` table. Admin edits have no effect on the site. | write: `app/admin/settings/social-links/page.tsx:33,89`; read: `services/settings.service.ts:83` used by `components/home/SocialBar.tsx:12`, `components/layout/Navbar.tsx:8`, `app/(public)/display/page.tsx:19`. Since 2026-09-19 `scripts/migrate-settings.ts:29,68` (M11) copies the Firestore doc into `social_links` once, at migration time - it does not keep the two in step | Pick one store; point the admin page at `settingsService` | STILL OPEN - read anchor MOVED to `services/settings.service.ts:83` |
| M05-F04 | HIGH | Five more settings documents have no reader anywhere: `settings/guruParampara`, `settings/shlokas`, `settings/poojaSchedule`, `settings/ekadashiCalendar`, `settings/festivalCalendar`. Staff can spend an afternoon editing content that never appears. | writes at `guru-parampara/page.tsx:197`, `shlokas/page.tsx:84`, `puja-schedule/page.tsx:111`, `ekadashi-calendar/page.tsx:89`, `festival-calendar/page.tsx:82`; public `/shlokas` reads `data/shlokas.ts:8`; public `/guruparampara` has no Firestore read at all | Either wire the public pages to these docs or remove the admin pages; do not ship both halves disconnected | STILL OPEN |
| M05-F05 | MEDIUM | `/admin/website-settings/temple-information` is a dead end: the form's submit handler is `console.log`, and `updateTempleSettings` is a stub with a "we'll replace this with Firestore later" comment. | `components/admin/settings/sections/TempleDetailsCard.tsx:36`; `lib/settings/temple.ts:7-10` | Delete the route and `website-settings/temple.json`, or finish it against `settings/` | STILL OPEN |
| M05-F06 | MEDIUM | `/admin/featured` exists, writes a `featuredContent` collection, and is reachable by nobody: it is absent from the sidebar and from the header search, and no public page reads `featuredContent`. | `app/admin/featured/page.tsx:108`; absent from `AdminSidebar.tsx:37-104`; grep for `featuredContent` finds only dump scripts. It is not the only unreachable route - see M05-F36 | Decide: wire it to the homepage hero or delete it | STILL OPEN - anchor MOVED to `app/admin/featured/page.tsx:108` |
| M05-F07 | HIGH | `/debug` sits outside `/admin`, so no auth guard applies (the repo has no `middleware.ts`; its Next 16 equivalent `proxy.ts` only sets security headers and tracks page views - it gates no route, `proxy.ts:84-120`), and it renders env-variable presence including an `OPENAI_API_KEY.substring(0,20)` expression. `/admin/test` writes junk into a `test` Firestore collection; `/admin/test-firebase` dumps raw `events` documents and config validation. | `app/debug/page.tsx:5,26`; `app/admin/test/page.tsx:15`; `app/admin/test-firebase/page.tsx:30`; `proxy.ts:84-120` has no auth branch | Delete all three (and `components/debug/ClientEnvDebug.tsx`) before any production deploy. **Mechanism note:** `OPENAI_API_KEY` is not `NEXT_PUBLIC_`, so it is replaced with `undefined` in the *client* bundle - the leak is not via the browser JS. But `app/debug/page.tsx` is a `"use client"` page with no `dynamic` export, so Next.js still server-renders/prerenders it, and on that pass `process.env.OPENAI_API_KEY` is the real value, which lands in the HTML payload. Confirm against an actual `next build` output before or after deleting the page | STILL OPEN - "no middleware" wording corrected: `proxy.ts` exists and gates nothing |
| M05-F08 | HIGH | Three report/dashboard API routes have no authentication or rate limiting. `POST /api/reports/save` accepts an arbitrary base64 body and writes it to Vercel Blob storage. | `app/api/reports/save/route.ts:27`, `app/api/reports/list/route.ts:11`, `app/api/dashboard/daily-spiritual/route.ts:7` - none verify a token | Add the admin token check used by `app/api/admin/*` routes (M12), or move save/list behind a server action | STILL OPEN |
| M05-F09 | HIGH | AGENTS.md forbids direct Firebase calls outside services ("No Direct Firebase Calls - Use services only"). Twelve settings pages, the dashboard, the featured page, both test pages and `hooks/useFinanceSettings.ts` all import `firebase/firestore` and `@/lib/firebase` directly. | `AGENTS.md` "Architecture Principles" #3; e.g. `app/admin/settings/about/page.tsx:7`, `app/admin/page.tsx:13`, `app/admin/featured/page.tsx:29-40`, `hooks/useFinanceSettings.ts:4` | Introduce a single `settingsService.getDoc/saveDoc(docId)` and migrate the twelve pages page-by-page | STILL OPEN - featured anchor MOVED to `:29-40` |
| M05-F10 | MEDIUM | `AdminAuthGuard`'s `requiredPermission` is decorative - every case in the switch assigns `hasPermission = canAccessAdmin`, so a `staff` user passes a `"finance"` gate. The exported `withPermission` HOC ignores its permission argument entirely. | `components/admin/layout/AdminAuthGuard.tsx:129-148` and `:156-163` | Wire the switch to the real capability booleans already on `AuthContext` (`canAccessFinance`, `canAccessSettings`, `canManageUsers`) | STILL OPEN |
| M05-F11 | MEDIUM | Sidebar permission filtering is a no-op except for the whole "Administration" group; three of the four arguments to `getFilteredNavigation` are accepted and never read. Finance and AI groups are shown to every admin-capable role. | `components/admin/layout/AdminSidebar.tsx:107-126` (`const filteredItems = section.items;` at `:110`) | Attach a `requires` capability to each nav item and filter on it | STILL OPEN |
| M05-F12 | MEDIUM | The sidebar navigates with raw `<a href>` on desktop and `window.location.href` on mobile, forcing a full document reload, re-running Firebase auth and re-mounting the shell on every menu click. | `AdminSidebar.tsx:218` and `:349-352` | Replace both with `next/link`; the mobile drawer can call `onClose()` in `onClick` and still use `Link` | STILL OPEN |
| M05-F13 | MEDIUM | Layout width mismatch: the desktop sidebar is `lg:w-68` (17rem / 272px) while the content column is padded `lg:pl-64` (16rem / 256px), so the sidebar overlaps the content by 16px at every `lg` breakpoint. | `components/admin/layout/AdminSidebar.tsx:162` vs `components/admin/layout/AdminShell.tsx:48` | Pick one width token and use it in both | STILL OPEN |
| M05-F14 | MEDIUM | Nested `<main>` landmarks: `AdminShell` renders `<main className="flex-1 …">` and `app/admin/layout.tsx` renders `<main id="main-content">` inside it. Two `main` elements is invalid and breaks skip-links and screen-reader landmark navigation. | `components/admin/layout/AdminShell.tsx:50` and `app/admin/layout.tsx:26` | Keep the outer one, give it `id="main-content" tabIndex={-1}`, make the inner a `div` | STILL OPEN |
| M05-F15 | MEDIUM | Roughly 25 components/services in this chunk have zero importers: the entire `components/admin/dashboard/` folder, seven of `components/admin/common/`, all three `components/admin/layout/{navigation,icons,types}` files, `components/admin/crud/{index,CrudToolbar}`, `hooks/useCrudTable.ts`, `lib/crud-columns.tsx`, both `dashboard.service*.ts`, `report.service.ts`, and the four adopted files. ~1,600 lines. | grep counts: `AdminButton`/`AdminCard`/`AdminInput`/`AdminErrorBoundary`/`StatsGrid`/`WelcomeBanner`/`QuickActionCard`/`AdminSearchResults` = 0 importers each; `navigation.ts`/`icons.ts`/`types.ts` = 0 | Recipe G | STILL OPEN |
| M05-F16 | MEDIUM | Three live implementations of the same idea coexist: `createCrudColumns` in `components/admin/crud/createCrudColumns.tsx` (used) and `lib/crud-columns.tsx` (dead, drops `actions`); `AdminPageWrapper` and `AdminErrorBoundary` (two error boundaries); `SearchBox` and `SearchBar`; `AdminPageHeader` and `PageHeader`; `SectionCard` as a file *and* re-declared inline in the dashboard. | `lib/crud-columns.tsx:9` vs `components/admin/crud/createCrudColumns.tsx:14`; `app/admin/page.tsx:59` vs `components/admin/common/SectionCard.tsx:8` | Keep one of each; the surviving name should be the one with importers | STILL OPEN |
| M05-F17 | MEDIUM | `hooks/useFinanceSettings.ts:22-47` is a verbatim copy of the load-and-merge block in `app/admin/settings/finance/page.tsx:26-51`, including the identical eleven-line billing-defaults fallback. Any schema change must be made twice. | both files, same shape | Have the finance page consume the hook | STILL OPEN |
| M05-F18 | MEDIUM | `services/report.service.ts` implements exactly the revenue/donation/booking summary that `/admin/reports` recomputes inline, and is imported by nothing. The reports page also fetches *all* donations and *all* bookings and filters by date in the browser. | `services/report.service.ts:7-63` vs `app/admin/reports/page.tsx:116-130` | Push date filtering into the services and call `reportService.getSummary(range)` | STILL OPEN |
| M05-F19 | MEDIUM | `app/admin/featured/page.tsx:144-147` loads the complete `events`, `announcements`, `sevas` and `knowledge` collections in the browser just to populate a picker, with no limit, pagination or projection. `services/dashboard.service.client.ts:24-25` reads every document of eight collections purely to `snapshot.size` them. | those lines | Use `getCountFromServer` / server-side search; delete the client dashboard service | STILL OPEN - anchor MOVED to `app/admin/featured/page.tsx:144-147` |
| M05-F20 | MEDIUM | `CrudTable` is a table skeleton only: no sorting UI (`enableSorting` is set but no header is clickable), no pagination, no row selection, no loading skeleton, and `CrudColumn.width` / `.align` are declared in the type and never read. ADMIN-GUIDELINES.md specifies all of these. | `components/admin/crud/CrudTable.tsx:25-89`; `types/crud.ts:40-45`; `docs/ADMIN-GUIDELINES.md:82-208` | Either grow the framework to the documented `DataTable` contract or amend the doc | STILL OPEN |
| M05-F21 | MEDIUM | `StatusBadge` keys on capitalised English display strings (`"Active"`, `"Paid"`, `"Cancelled"`) while the domain enums are lowercase (`"received"`, `"confirmed"`, `"pending"`). Any column that passes a raw enum renders the grey fallback, and the component is untranslatable. | `components/admin/crud/StatusBadge.tsx:12-53` vs `types/donation.ts:1-4` | Key on the enum value, map to a label through an i18n dictionary | STILL OPEN |
| M05-F22 | MEDIUM | `TableActions` calls `onDelete` with no confirmation. ADMIN-GUIDELINES.md:370-388 requires a confirm dialog for destructive actions. Where confirmation exists elsewhere it is the bare global `confirm(...)`, not `window.confirm` and not a dialog component - 10 call sites across 9 settings pages (e.g. `app/admin/settings/finance/page.tsx:133`, `about/page.tsx:190`, `facilities/page.tsx:205,231`). | `components/admin/crud/TableActions.tsx:52-63`; doc at `docs/ADMIN-GUIDELINES.md:370` | Add a shared confirm dialog and route all deletes through it | STILL OPEN |
| M05-F23 | MEDIUM | Doc-vs-code drift in ADMIN-GUIDELINES.md: the prescribed sidebar tree (`:16-49`) matches neither `AdminSidebar.tsx` nor `navigation.ts`; `usePermissions()` (`:347`) does not exist in `hooks/`; `createAuditLog` / audit logging (`:481-558`) exists nowhere in admin code; the toast example imports `sonner` (`:688`) while all 66 call sites use `react-hot-toast`. | `docs/ADMIN-GUIDELINES.md` lines cited; `ls hooks/` has no `usePermissions.ts`; `grep -rn "from \"sonner\"" = 0 files` | Rewrite ADMIN-GUIDELINES.md against the code, or raise the code to it - but one of the two has to move | STILL OPEN |
| M05-F24 | LOW | `sonner@^2.0.7` is a declared dependency with zero imports repo-wide, shipped alongside `react-hot-toast@^2.6.0` which is the one actually mounted in `app/layout.tsx:91`. | `package.json:90,95`; grep for `sonner` imports = 0 | Drop the dependency | STILL OPEN - MOVED to `package.json:90,95` |
| M05-F25 | LOW | Twelve `any` usages remain in M05 (thirteen on 2026-09-19) in a repo whose AGENTS.md says "No `any` types". | `app/admin/settings/finance/page.tsx:91`, `app/admin/settings/footer/page.tsx:130,137`, `app/admin/reports/page.tsx:446,451`, `app/admin/test-firebase/page.tsx:8,9,32,33`, `components/admin/common/AdminErrorBoundary.tsx:20`, `components/admin/settings/homepage/useHomepageForm.ts:110`, `types/settings.ts:9`. The thirteenth, `services/settings.service.ts:98`, moved with the write code to `app/actions/settings.ts:100` (outside M05) | Type them; `types/settings.ts:9` should be `string \| null` | STILL OPEN - one site MOVED out of M05 to `app/actions/settings.ts:100` |
| M05-F26 | LOW | Leftover `console.log`s in production paths, against AGENTS.md "Leave console.log statements - Don't". | `components/admin/settings/homepage/useHomepageForm.ts:85,87,96`; `app/admin/settings/finance/page.tsx:71`; `components/admin/settings/sections/TempleDetailsCard.tsx:36`; `app/admin/test/page.tsx:13,20` | Remove or route through a logger | STILL OPEN |
| M05-F27 | LOW | `AdminErrorBoundary` renders `error.stack` verbatim to the user and invites them to send it to the developer; `AdminPageWrapper` renders `error.message`. Neither reports to any monitoring service. | `components/admin/common/AdminErrorBoundary.tsx:36-41`; `components/admin/common/AdminPageWrapper.tsx:42` | One boundary, generic message, real error reporting | STILL OPEN |
| M05-F28 | LOW | `FormDialog` is a bare fixed overlay: no focus trap, no ESC handler, no `role="dialog"`, no `aria-modal`, no backdrop click. The "Add" modal in `app/admin/featured/page.tsx` does not even use it. | `components/admin/common/FormDialog.tsx:20-37` | Replace with the shadcn `Dialog` primitive from `components/ui` (M01) | STILL OPEN |
| M05-F29 | LOW | `NotificationDropdown` declares `hasError` state and an early `return null` on it, but nothing ever calls `setHasError`. The mobile search button in `AdminHeader` has an `aria-label` and no `onClick`. | `components/admin/layout/NotificationDropdown.tsx:25,40-42`; `components/admin/layout/AdminHeader.tsx:146-151` | Remove the dead state; either implement mobile search or remove the button | STILL OPEN |
| M05-F30 | LOW | The header's "search" is a keyword-to-route jump table, and one of its targets, `/admin/timings`, does not exist (there is no `app/admin/timings` directory). `components/admin/dashboard/AdminSearchResults.tsx` - a real results panel - is dead. | `components/admin/layout/AdminHeader.tsx:69`; `ls app/admin` has no `timings` | Wire `AdminSearchResults` to a real search, or fix the jump table | STILL OPEN |
| M05-F31 | LOW | `AdminAuthGuard` is applied up to three times on a single settings page - once in `app/admin/layout.tsx:24`, again in `app/admin/settings/layout.tsx:12`, again inside `app/admin/settings/page.tsx:165`. Three auth subscriptions, three spinner states. | those three lines | Keep the layout guard only | STILL OPEN |
| M05-F32 | LOW | The spinner markup is copy-pasted **twice inside M05** (six times repo-wide), and the amber page-background gradient **five times inside M05** (nine times repo-wide). | spinner `w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin`: `app/admin/layout.tsx:14`, `components/admin/layout/AdminAuthGuard.tsx:27` (M05) + `app/(auth)/login/page.tsx:7`, `components/auth/GuestOnly.tsx:15`, `components/auth/LoginForm.tsx:95`, `components/auth/ProtectedRoute.tsx:18` (M01/M04). Gradient `from-amber-50/50 via-orange-50/30 to-stone-50`: `app/admin/layout.tsx:12`, `AdminAuthGuard.tsx:25,39,88`, `AdminShell.tsx:40` (M05) + `app/(auth)/layout.tsx:10`, `app/(auth)/login/page.tsx:6`, `components/auth/GuestOnly.tsx:13`, `components/auth/ProtectedRoute.tsx:16` | Extract `<AdminLoading/>` and an `admin-surface` utility - and put them in `components/ui/`, not `components/admin/`, since the auth screens share both | STILL OPEN |
| M05-F33 | LOW | The settings pages have no unsaved-changes protection: no dirty tracking, no `beforeunload`, no route-change confirm. A staff member who edits the 666-line About Us form and clicks a sidebar link (which does a full page reload, M05-F12) loses everything silently. | any settings page; `AdminSidebar.tsx:218` | Track dirty state and guard navigation | STILL OPEN |
| M05-F34 | LOW | `app/admin/settings/page.tsx` (Supabase `site_settings`: temple name, contact email/phone, address, footer text, welcome message) overlaps heavily with `app/admin/settings/footer` (Firestore `settings/footer`), the homepage form's `ContactInfoSection`, and `website-settings/temple.json`. Four places claim to own the temple's name and contact details. | `types/settings.ts:1-10`; `components/admin/settings/homepage/types.ts:24-28`; `website-settings/temple.json:2-23` | Declare one owner of temple identity and have the rest read it | STILL OPEN |
| M05-F35 | LOW | `homepage/config` is a **stray 456-byte JSON file** (extensionless) committed at the repository root - a hand-dropped export of the Firestore `homepage/config` document. Nothing imports it, it is not `.gitignore`d, and it will drift silently from the live document that `homepageService` actually serves. | `homepage/config` (`file` reports "JSON text data"); `grep -rn "homepage/config"` finds only `services/proof-report/database-export.service.ts:86`, which reads the *Firestore* doc, not this file | Delete the file, or move it into a new fixtures folder under `scripts/` and give it a `.json` extension if it is meant as a seed | STILL OPEN |
| M05-F36 | MEDIUM | Three admin routes in this chunk are absent from `allNavigation` entirely, not just `/admin/featured`: `/admin/settings` (Site Settings) is reachable only from the header avatar menu and the `"setting"` search keyword, and `/admin/website-settings/temple-information` is reachable from nothing at all. Staff cannot find either without typing the URL. | `grep -n '"/admin/settings"' components/admin/layout/AdminSidebar.tsx` = 0 hits; same for `website-settings` and `/admin/featured`; the only links are `components/admin/layout/AdminHeader.tsx:215` (avatar menu) and `:73` (search jump table) | Either add the entries under "Administration" or delete the orphan routes; `website-settings` is a dead end anyway (M05-F05) | STILL OPEN |
| M05-F37 | LOW | `types/crud.ts` is used as a data shape by modules that never feed it to `CrudTable`, so the column model is half-adopted: `app/admin/sevas/page.tsx:11` imports `memberColumns`/`volunteerColumns` and then hand-rolls a `<table>` at `:178`, and `app/admin/gallery/columns.ts` defines `CrudColumn` columns with zero importers. | a grep for imports of `types/crud.ts` lists 7 `columns.*` files; only announcements / bookings / donations / quotes (and `EventTable.tsx:11` for events) also import `CrudTable` | Finish the adoption in sevas and gallery, or drop the unused columns files | STILL OPEN |
| M05-F38 | LOW | `/admin/featured` now opens with a blanket `/* eslint-disable */`, added by a "fix CI pipeline errors" commit. The whole 595-line page - direct Firestore, unbounded reads, hand-rolled modal - is exempt from lint, so `npm run lint` passing says nothing about it. The same commit added the identical blanket directive to 34 other files outside M05 (35 in all). | `app/admin/featured/page.tsx:1`; `git show --stat 6408c1d` | Remove the directive and fix or narrowly disable the specific rules; or delete the page (M05-F06) | NEW (2026-10-18) - introduced by `6408c1d` |
| M05-F39 | MEDIUM | The mobile app (`apps/mobile`, added 2026-09-30) reads temple identity from a Supabase `website_settings` table (`key = 'temple_information'`) that nothing in the repository creates, migrates or writes - no admin page, no migration script, no Prisma model. Its home and temple tabs fall back to "Unavailable". This is a fifth claimant of temple identity on top of the four in M05-F34. | `apps/mobile/lib/api.ts:47-55`, `apps/mobile/lib/types.ts:1-13`; repo-wide grep for `website_settings` (excluding `.claude`) = that one file | Point the mobile read at the store M05-F34 settles on (e.g. `site_settings`), or add the table and an admin editor for it | NEW (2026-10-18) - introduced by `0cb71b6` / `5813fc9` |

## Portability notes (React Native / cross-platform)

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| `app/admin/layout.tsx` | Next App Router file convention, `Suspense` boundary, `<main>` | rewrite | RN has no file-router; becomes a navigator (stack/drawer) |
| `AdminShell` | `document.addEventListener("keydown")`, Tailwind classes, `lg:` breakpoints | rewrite | No DOM, no CSS; the drawer is `@react-navigation/drawer` |
| `AdminSidebar` | `framer-motion` `motion.aside`/`AnimatePresence`, `usePathname`, `next/image`, raw `<a>`, `window.location.href`, `lg:` classes | rewrite | Every dependency is web-only. The `allNavigation` **data** (`:37-104`) is portable and should be extracted to a shared `navigation.ts` first |
| `AdminHeader` | `framer-motion`, `next/image`, `next/link`, `useRouter`, `document` listeners, ⌘K binding, `<form onSubmit>` | rewrite | The `handleSearch` keyword→route table (`:63-75`) is portable logic |
| `AdminAuthGuard` | `next/navigation` `useRouter`/`useSearchParams`, `router.replace` | adapt | The decision logic (loading → config → user → capability) is platform-neutral; swap the navigation calls for RN navigation |
| `NotificationDropdown` | `document.addEventListener("mousedown")`, `next/link`, absolute-positioned dropdown | rewrite | `formatTimeAgo` (`:8-20`) is pure and reusable as-is |
| `app/admin/page.tsx` (dashboard) | `window.location.reload()`, `next/link`, Tailwind grid, lucide-react icons | rewrite UI / reuse logic | `firebase/firestore` web SDK works in RN via `@react-native-firebase` or the JS SDK; the `fetchPublicStats` body is portable if lifted into a service |
| `CrudTable` / `createCrudColumns` | `@tanstack/react-table` (headless, portable) but renders `<table>/<thead>/<tr>/<td>` | adapt | Keep the column model and `useReactTable`; swap the renderer for `FlatList` + row components. This is the single highest-leverage shared abstraction |
| `CrudTableCell` | raw `<img>` at `:81`, `<>` fragments of strings | adapt | Switch on `column.type` is portable; `img` → `Image`, bare strings must be wrapped in `<Text>` |
| `StatusBadge` | `clsx` + Tailwind class strings | adapt | Move the status→style map to token objects (`{bg, fg, border}`) instead of class strings |
| `TableActions` | `components/ui/button.tsx` (shadcn/Radix, DOM-only) | rewrite | Icon buttons are trivial in RN; lucide-react → `lucide-react-native` |
| `AdminPageHeader`, `StatCard`, `ReportCard`, `SectionCard`, `EmptyState`, `QuickActionCard` | Tailwind classes, lucide-react, gradients | rewrite | Small presentational components; the fastest path is a parallel RN set sharing only props types |
| `FormDialog` | `position: fixed` overlay | rewrite | RN `Modal` |
| Homepage settings module (`useHomepageForm`, `validation.ts`, `constants.ts`, `types.ts`) | none - pure TS | **reuse as-is** | The hook depends only on `homepageService` and `fetch`. This is the template for every other settings page |
| `validateHomepageForm` | none | reuse as-is | Pure function |
| `hooks/useFinanceSettings.ts` | `firebase/firestore` JS SDK | reuse as-is | Works in RN with the JS SDK; no DOM |
| `services/settings.service.ts` | `@supabase/supabase-js` (RN-compatible) for reads; writes are a dynamic `import()` of the Next server actions in `app/actions/settings.ts` | adapt | Reads are portable as-is. Server actions are a Next-only RPC an RN client cannot call - writes need an HTTP route (and the M05-F02 auth fix) first |
| `services/report.service.ts`, `dashboard.service.ts` | none - pure data | reuse as-is | Already platform-neutral (and currently dead) |
| `types/crud.ts` | `ReactNode` in `formatter`/`render`/`icon` | adapt | `ReactNode` exists in RN too; the type file is portable verbatim |
| `types/settings.ts`, `types/dashboard.ts` | none | reuse as-is | |
| Reports CSV export | `Blob`, `URL.createObjectURL`, `document.createElement("a")`, `window.print()` | rewrite | RN needs `react-native-fs` + `react-native-share`; print becomes a server-rendered PDF |
| `app/api/reports/*`, `app/api/dashboard/*` | Next route handlers, `Buffer`, Vercel Blob | reuse as-is (as API) | These stay on the server; an RN client calls them over HTTP |
| `app/admin/website-settings/temple-information/page.tsx` | React Server Component + `await` in the component body | rewrite | RSC has no RN equivalent; fetch in a hook instead |
| `lib/settings/temple.ts` | `import` of a JSON file | reuse as-is | Metro bundles JSON |
| `/debug`, `/admin/test`, `/admin/test-firebase` | - | delete | Should not exist on either platform |

**What a React Native admin client would need from this module.** First, an HTTP or service seam
that does not exist today: twelve settings pages reach into `firebase/firestore` from inside the
component, so there is nothing for a second client to call. The minimum is a
`settingsService.get(docId)` / `settingsService.save(docId, data)` pair plus a
`dashboardService.getStats()` that actually gets used, and authenticated route handlers in front of
both. Second, the navigation model has to leave the sidebar: `allNavigation` at
`AdminSidebar.tsx:37-104` is the one true menu definition and it is trapped inside a web component -
lift it into `components/admin/layout/navigation.ts` (which already exists and is dead), add a
`requires` capability per item, and both clients can drive a menu from it. Third, the CRUD column
model (`types/crud.ts` + `createCrudColumns`) is the most valuable portable asset here: TanStack
Table is headless, so a shared `columns.ts` per module can feed a web `<table>` and an RN
`FlatList` from the same definition - but `StatusBadge` and `CrudTableCell` must stop emitting
Tailwind class strings and emit style tokens instead. Fourth, the homepage settings module
(hook + validation + constants + types) is already platform-neutral and should be the pattern the
other thirteen settings pages are refactored into before any port begins. Fifth, Firebase Auth
state is consumed through `useAuth`/`AuthContext` in M04; RN needs the same context backed by
`@react-native-firebase/auth`, exposing the identical capability booleans, or every guard in this
module has to be rewritten.

**What `apps/mobile` consumes from M05 today (2026-10-18): nothing.** The Expo app added on
2026-09-30 imports no M05 file, calls no M05 route (`/api/dashboard/*`, `/api/reports/*`) and reads
no M05-owned store. Its closest overlap is temple identity: `fetchWebsiteSettings()` reads a Supabase
`website_settings` row keyed `temple_information` (`apps/mobile/lib/api.ts:47-55`) - a table that no
admin page, migration or Prisma model in this repo writes (M05-F39). The admin-side equivalents are
`site_settings` (`/admin/settings`), `settings/footer`, the homepage `ContactInfoSection` and
`website-settings/temple.json` (M05-F34).

## Coverage

- `filesExpected` 88 (from `.claude/state/inventory/M05.json` `totals.files`, regenerated 2026-10-18 -
  unchanged, the 2026-10-18 delta added and deleted nothing in M05), plus 4 adopted from the
  Unassigned list = 92 files in scope.
- `filesMentioned` 92 of 92. Every inventory file appears at least as a row in **Key files**, and
  the four adopted files are named in **Code roots**, **Key files** and M05-F15.
  *(Verified 2026-09-19 and again 2026-10-18 by script: 0 of the 88 inventory paths are unmentioned.)*
- Omitted: none. Files read only structurally rather than line-by-line (all >300 lines, all twelve
  sharing one verified pattern): `app/admin/settings/about/page.tsx` (666),
  `app/admin/settings/facilities/page.tsx` (536), `app/admin/settings/finance/page.tsx` (491, read
  1-140), `app/admin/settings/puja-schedule/page.tsx` (460),
  `app/admin/settings/guru-parampara/page.tsx` (453),
  `app/admin/settings/social-links/page.tsx` (451), `app/admin/settings/footer/page.tsx` (437),
  `app/admin/settings/future-plans/page.tsx` (426), `app/admin/settings/shlokas/page.tsx` (384),
  `app/admin/settings/trust-committee/page.tsx` (349),
  `app/admin/settings/festival-calendar/page.tsx` (310),
  `app/admin/settings/ekadashi-calendar/page.tsx` (306), `app/admin/featured/page.tsx` (594),
  `app/admin/reports/page.tsx` (621), `app/admin/settings/about/page.tsx`. For each, the
  `COLLECTION`/`DOCUMENT` constants, the `getDoc`/`setDoc` line numbers, the toast calls and the
  import list were extracted by grep and are cited above.

## UNCLEAR

- **Whether the orphan `settings/*` documents (M05-F04) are dead or merely early.** No public reader
  exists in the repository today. What would settle it: a Firestore dump showing whether those
  documents have non-default content and recent `updatedAt` values (`npm run firestore:dump` per the
  project CLAUDE.md), plus a product decision on whether `/guruparampara`, `/shlokas` and the
  calendar pages are meant to become CMS-driven.
- **Whether `/admin/settings` (Supabase `site_settings`) or the Firestore `settings/*` documents are
  the intended future of settings.** Both are actively coded; `settings.service.ts` is the only
  settings *service* but covers the smallest surface. What would settle it: the Supabase migration
  plan referenced in the project CLAUDE.md. *(2026-10-18:)* `scripts/migrate-settings.ts`, owned by M11
  and rewritten since 2026-09-19, maps `settings/socialLinks` -> `social_links` and the site-settings
  doc -> `site_settings`, and parks every other `settings/*` doc as JSONB in `settings_documents`
  (`scripts/migrate-settings.ts:29,68,95,138-140`). No application code reads `settings_documents`
  yet, so the migration settles storage, not ownership.
- **Whether the `AdminAuthGuard` permission switch (M05-F10) is a stub or a deliberate flattening.**
  All five non-`admin` cases assign the same boolean, which reads like scaffolding. What would
  settle it: the role→capability matrix in M04's `AuthContext` and `lib/auth.ts` against the
  documented matrix at `docs/ADMIN-GUIDELINES.md:334-343`.
- **Whether `/api/dashboard/daily-spiritual` has an external consumer.** It is `force-dynamic`,
  `no-store`, and no file in the repository fetches it. What would settle it: deployment/analytics
  logs, or a kiosk/display client outside this repo (`app/(public)/display/page.tsx` is the likely
  candidate but does not call it).
- **Whether `lg:w-68` is intentional** (M05-F13). Tailwind v4's dynamic spacing scale makes `w-68`
  resolve to 17rem, so it compiles - but `lg:pl-64` on the sibling does not match. What would settle
  it: a rendered screenshot at ≥1024px, which this run cannot produce.

## Verification log (2026-09-19)

Skeptic pass over the builder's file: 300 cited path tokens extracted by script and existence-checked,
202 `path:line` anchors dumped with ±3 lines of context and read, 28 factual claims re-derived from
source, all 35 original findings re-opened at their evidence, and the 88-file inventory diffed against
the text. Every change below is one line: *what was wrong -> what it says now -> evidence*.

**Paths.** 300 tokens checked, 0 genuinely broken. Five apparent misses were regex artefacts or
deliberate "does not exist" claims and were left alone: `components/home/DonationCTA` (split of
`DonationCTA|DonationForm|SevaBooking`), `services/dashboard.service` (split of `dashboard.service*.ts`),
`components/services` (prose "25 components/services"), `app/api/admin/settings/route.ts` (stated as
"does not exist yet"), `app/admin/timings` (the point of M05-F30).

**Corrections made**

- Component tree cross-ref said the nested `<main>` was **M05-F08** -> now **M05-F14** -> the nested-`<main>` row is F14; F08 is the unauthenticated API routes.
- Key files row for `AdminShell.tsx` said the width mismatch was **M05-F09** -> now **M05-F13**, with both anchors inline -> F09 is the direct-Firebase violation; `AdminShell.tsx:48` vs `AdminSidebar.tsx:162`.
- `components/admin/common/SearchBox.tsx` listed as **32 lines** -> now **44** -> `.claude/state/inventory/M05.json`; `wc -l` = 44.
- `StatCard` listed as **4 importers** -> now **5 importer files, 4 live + the dead `StatsGrid`** -> `grep -rn "common/StatCard"` returns AaradhaneStats, StatsGrid, EventStats, PoojaStats, UserStats.
- `useHomepageForm.ts` note said **4 `console.log`s** -> now **3 `console.log` + 1 `console.warn`** -> `grep -n "console.log" components/admin/settings/homepage/useHomepageForm.ts` = `:85,:87,:96`; `console.warn` at `:97`.
- **M05-F35 was wrong**: `homepage/config` called "an empty directory ... containing nothing" -> it is a **456-byte extensionless JSON file** at the repo root holding an export of the Firestore `homepage/config` document -> `file homepage/config` reports "JSON text data"; `ls -la homepage` shows one file, no subdirectory. Key files row and Recipe G step 2 corrected to match.
- **M05-F32 counts were wrong**: "spinner four times, gradient six times" -> now **spinner 2x in M05 / 6x repo-wide, gradient 5x in M05 / 9x repo-wide**, each site listed -> `grep -rn "border-t-amber-600 rounded-full animate-spin"` = 6 hits, `grep -rn "from-amber-50/50 via-orange-50/30 to-stone-50"` = 9 hits. The two cited "spinner" sites `AdminAuthGuard.tsx:39,88` are gradient backgrounds on `AccessDenied` / the Firebase-not-configured screen, not spinners.
- **M05-F22 mis-named the API**: "`window.confirm`" at one site -> now the **bare global `confirm(...)`, 10 call sites in 9 settings pages**, enumerated -> `grep -rn "confirm(" app/admin/settings` returns about:190, ekadashi-calendar:121, facilities:205,231, festival-calendar:115, finance:133, future-plans:195, guru-parampara:237, shlokas:124, trust-committee:121.
- **M05-F07 mechanism sharpened** (severity unchanged, HIGH): the claim that `/debug` "renders an `OPENAI_API_KEY` prefix" is right about the source but not about the channel -> added that non-`NEXT_PUBLIC_` env is stripped from the *client* bundle, so the exposure is through the server-render / prerender pass of this `"use client"` page, which is where `process.env.OPENAI_API_KEY` is real -> `app/debug/page.tsx:1,5,26`; no `dynamic` export on the page; `next.config.ts` declares no `env` passthrough. Also confirmed there is **no `middleware.ts` anywhere in the repo**, so nothing gates `/debug` at the edge either.
- Purpose §4 restated the chunk entry's "16 settings sub-pages" without reconciling it -> now states the real count: **13 sub-directories + root `page.tsx` + `layout.tsx`**, plus one page under `app/admin/website-settings` -> `ls -d app/admin/settings/*/` = 13; `find app/admin/website-settings -type f` = 1.

**Findings added**

- **M05-F36** (MEDIUM) - `/admin/settings` and `/admin/website-settings/temple-information` are also absent from `allNavigation`, not just `/admin/featured`; Site Settings survives only on the avatar menu (`AdminHeader.tsx:215`) and the `"setting"` search keyword (`:73`), temple-information on nothing.
- **M05-F37** (LOW) - `types/crud.ts` is half-adopted: `app/admin/sevas/page.tsx:11` imports `CrudColumn` definitions then hand-rolls a `<table>` at `:178`; `app/admin/gallery/columns.ts` has zero importers.

**Section added**

- **Component trees §9 - "Admin UI patterns actually in use"** -> chunk focus question 8 ("admin UI patterns actually in use ... for the redesign") had its answer scattered across trees and findings with no single place to read it. The new table names the live component for each pattern, its dead competitor, and the sonner-vs-react-hot-toast outcome. It also states the convention behind the `(server)` markers: they mean "no `"use client"` in the file", and every such component in M05 except `app/admin/layout.tsx` and `app/admin/website-settings/temple-information/page.tsx` is pulled into the client bundle by a client parent.

**Re-verified unchanged (spot checks that survived the attempt to break them)**

M05-F01 (`app/admin/page.tsx:172` is `where("status","==","completed")`; `types/donation.ts:1-4` has no
`completed`; `services/report.service.ts:14` uses `"received"`) · M05-F02 (`settings.service.ts:72,96`
both `await import("@/lib/supabase/admin")`; `lib/supabase/admin.ts:4` throws on a missing
`SUPABASE_SERVICE_ROLE_KEY`; `app/admin/settings/page.tsx:1` is `"use client"`) · M05-F03 (write
`social-links/page.tsx:33,89`; read `settings.service.ts:121` `from("social_links")`, consumed at
`SocialBar.tsx:12`, `Navbar.tsx:8`, `display/page.tsx:19`) · M05-F04 (grep for each of the five doc
ids across `app components services hooks lib data` returns only the admin writer; the `guruParampara`
hit in `lib/aaradhane/firestore-source.ts:22` is a top-level *collection*, a different path) ·
M05-F05, F06, F08, F09, F10 (`AdminAuthGuard.tsx:129-148` every case assigns `canAccessAdmin`;
`:156-163` `withPermission` ignores its argument) · F11 (`getFilteredNavigation` at `:107`,
`const filteredItems = section.items;` at `:110`; only `canAccessAdministration` of the four
parameters is read) · F12, F13, F14, F15 (26 files, 1,604 lines by `wc`), F16, F17
(`useFinanceSettings.ts:22-47` is byte-identical to `finance/page.tsx:26-51` apart from the catch
branch), F18, F19, F20, F21 (`StatusBadge` does no case normalisation - `STATUS_STYLES[status] ??
fallback` at `:57`), F23 (`hooks/` has no `usePermissions.ts`; `createAuditLog` = 0 hits repo-wide;
`docs/ADMIN-GUIDELINES.md:688` imports `sonner`), F24 (`package.json:63,68`; 0 sonner imports; 66
`react-hot-toast` files; `app/layout.tsx:3,91`), F25 (all 13 `any` sites open at the cited lines),
F26, F27, F28, F29, F30 (`app/admin` has no `timings` directory), F31, F33, F34. All 24
`getDoc`/`setDoc` anchors for the twelve settings pages open on the right statement. All
`docs/ADMIN-GUIDELINES.md` line references (`:16,:49,:82,:208,:334,:343,:347,:370,:388,:481,:558,:688`)
land on the sections claimed.

**Gap-closure pass (2026-09-19).** The four files adopted from the Unassigned list
(`components/admin/AdminHeader.tsx`, `AdminSidebar.tsx`, `DashboardCard.tsx`,
`components/debug/ClientEnvDebug.tsx`) were re-checked and are still dead: a repo-wide grep for each
name over `app components lib services hooks types utils scripts tests` finds only the definition
itself, and `.claude/state/inventory/import-graph.json:1199,1200,1283,1722` lists each with an empty
import edge. The live pair is `components/admin/layout/AdminHeader.tsx` and
`.../AdminSidebar.tsx`, imported by `components/admin/layout/AdminShell.tsx:4-5`. Coverage is
unchanged at 92 of 92. One cross-reference added: the *Key files* row for
`app/admin/settings/finance/page.tsx` now names the two command-line writers of the same
`settings/financeSettings` document, which live in M11.

## Refresh log (2026-10-18)

Scope: `perModule.M05` in `.claude/state/delta/2026-10-18/delta.json` = 0 added, 0 deleted, 3 modified
(`app/admin/featured/page.tsx`, `homepage/config`, `services/settings.service.ts`). A script diff
(CR-insensitive) of all 88 inventory files plus the 4 adopted files against the 2026-09-19 snapshot
confirmed those are the only M05 files that differ, and `homepage/config` differs only in line endings
(the git blob is unchanged since `e095208`; this Windows clone checks it out CRLF, 456 -> 467 bytes).
Every external file a fault cites (`types/donation.ts`, `docs/ADMIN-GUIDELINES.md`, `AGENTS.md`,
`app/layout.tsx`, the public `about`/`facilities`/`future-plans`/`trust` pages, `Footer.tsx`,
`SocialBar.tsx`, `Navbar.tsx`, `lib/settings/temple.ts`, the auth spinner files, the CRUD consumer
pages) is unchanged except `package.json` (lines shifted), `app/(public)/display/page.tsx` (two JSX
entity escapes only, `:19` import unchanged) and `scripts/migrate-settings.ts` (rewritten, M11).

**Changes made** (*what was true -> what is true now -> evidence*)

- Site Settings writes imported `lib/supabase/admin.ts` in the browser -> they dynamically import the `"use server"` actions `createSettingsAction`/`updateSettingsAction` from `app/actions/settings.ts` -> `services/settings.service.ts:69-77`; `git show 54024a1`. Flow 4 steps 3-5, Entry points, Key files, Stores, Cross-module and Portability rows rewritten to match.
- `services/settings.service.ts` was 156 lines with `site_settings` writes at `:76,:107` and `social_links` read at `:121` -> 118 lines (inventory count; `wc -l` 117), read-only, `social_links` read at `:83` -> `cat -n services/settings.service.ts`.
- M05-F02 said the save fails on a missing service-role env var in the browser -> the save still fails, now because the action's `checkAdminAuth` needs an `Authorization: Bearer` header the browser server-action call never sends, and `isUserAdmin` admits only `role === "admin"` -> `app/actions/settings.ts:26-35,39-42`; `lib/auth/admin.ts:25-29,71`; the unit test mocks the guard (`tests/unit/bot-004-action.test.ts:19-29`). Status STILL OPEN.
- M05-F25 counted 13 `any` sites including `services/settings.service.ts:98` -> 12 in M05; that site moved to `app/actions/settings.ts:100` -> `grep -n any app/actions/settings.ts`.
- `app/admin/featured/page.tsx` gained `/* eslint-disable */` at `:1`, so every featured anchor shifted +1: `:107`->`:108`, `:143-146`->`:144-147`, `:217/:234`->`:218/:235`, `:67-91`->`:68-92`, `:29-39`->`:29-40` -> `git show 6408c1d -- app/admin/featured/page.tsx`; `grep -n getDocs app/admin/featured/page.tsx`. Updated in tree 8, Stores, M05-F06, F09, F19. Line count 594 -> 595 (inventory).
- M05-F07 said "there is no `middleware.ts` anywhere in the repo", implying nothing runs at the edge -> `proxy.ts` (the Next 16 name for middleware) has existed since 2026-07-18 and runs on every request, but only sets security headers and tracks page views; it gates no route -> `proxy.ts:84-120`; `git log -1 -- proxy.ts` = `78fde8c`. (This was already true on 2026-09-19 - a correction, not a code change.)
- M05-F24 / Recipe G cited `package.json:63,68` -> `package.json:90,95` (Prisma and migration scripts added above them); `sonner` still has 0 imports, `react-hot-toast` still 66 files -> `grep -n sonner package.json`; repo grep.
- M05-F03 evidence gained the M11 migration path: `scripts/migrate-settings.ts:29,68` now copies Firestore `settings/socialLinks` into Supabase `social_links` once; the admin page still writes Firestore. UNCLEAR #2 updated to the rewritten migrator (`:29,68,95,138-140`, `settings_documents` JSONB catch-all with no app reader).
- `featuredContent` reader check: new hit `lib/supabase/migration-inventory.ts:59` (classification `REVIEW`) - a manifest, not a reader; M05-F06 holds.
- Types table: `SiteSettingsPayload` gained a consumer, `app/actions/settings.ts` (M12/M15).
- `homepage/config` row: size restated as 456 bytes in git / 467 on this CRLF checkout.
- Faults table: added a `status (2026-10-18)` column; F01-F37 all STILL OPEN (F03, F06, F09, F19, F24, F25 with MOVED anchors; F02 with a changed mechanism; F07 with corrected wording). Dead-code counts re-run: every component listed in M05-F15 / Recipe G still has 0 importers; `AdminPageHeader` 58, `SearchBox` 13, `StatCard` 5 files, `CrudTable` 4 pages + `EventTable`, `FormDialog` 1.
- Added **M05-F38** (LOW): blanket `/* eslint-disable */` on `/admin/featured` from commit `6408c1d`.
- Added **M05-F39** (MEDIUM): `apps/mobile/lib/api.ts:47-55` reads a Supabase `website_settings` table that nothing in the repo defines or writes.
- Portability: added "What `apps/mobile` consumes from M05 today" - nothing; noted that server actions are not callable from RN.
- Answers questions about: added the server-action save path and the mobile `website_settings` question.
- Coverage: 88 inventory files (regenerated 2026-10-18, unchanged) + 4 adopted = 92; 0 unmentioned by script.
- Path check (script, 2026-10-18): 221 backticked path tokens; 20 are folder-relative shorthands (e.g. `common/PageHeader.tsx`, `about/page.tsx`) that each resolve under the table's stated folder; the other 6 are deliberate absences or split tokens left as on 2026-09-19 (`app/api/admin/settings/route.ts`, `app/admin/timings`, `components/home/DonationCTA`, `services/dashboard.service`, `components/services`, `.../AdminSidebar.tsx`). 0 broken.

**Commits that drove the changes:** `54024a1` (2026-10-13, BOT-004: settings writes moved to
`app/actions/settings.ts`), `d87bfd1`, `3a0313e`, `0ba7b0e`, `44a660a`, `498b672` (2026-10-14,
BOT-004 authorization hardening of that action - all outside M05's roots), `6408c1d` (2026-10-03,
blanket eslint-disable on the featured page), `0cb71b6` / `5813fc9` (2026-09-30, the Expo app that
reads `website_settings`).

**UNCLEAR**

- UNCLEAR: whether any caller ever reaches the action's `api-admin` bypass (`app/actions/settings.ts:33`). It needs `Authorization: Bearer $ADMIN_API_KEY` on a server-action POST, which no script in the repo sends; the comment says "server-side script integrations". Settling it needs the BOT-004 design notes (`docs/BOT_004_ANALYTICS_MIGRATION_REPORT.md`, not read here).
- UNCLEAR: the raw `role` string stored for the super-admin in Firestore `users/{uid}` (`AuthContext` normalises it to `super_admin`, `context/AuthContext.tsx:162-166`). If the stored value is `"admin"` the second F02 blocker disappears; a Firestore dump would settle it.
- UNCLEAR: whether Firestore rules let the unauthenticated server-side client SDK read `users/{uid}` inside `isUserAdmin` (`lib/auth/admin.ts:64`). If they do not, the action rejects even a valid token.
