# Temple Portal — Product and System Overview

**Repository:** `temple-portal` (`package.json:2`) · **Date of this document:** 2026-09-19, refreshed 2026-10-18
**Audience:** anyone joining the project who needs to know what it is before how it works.
**Companion:** [TECHNICAL-GUIDE.md](./TECHNICAL-GUIDE.md) for the engineering view.

---

## What changed since 2026-09-19

*Added 2026-10-18 against commit `424fdb8`; sentences further down that the refresh made wrong
were corrected in place.*

- **A mobile app exists.** `apps/mobile` (Expo 57, React Native 0.86, built 2026-09-30) has seven
  tabs and a seva modal, and no login, booking or payment. It reads Supabase directly with the anon
  key, from tables that deny all access or do not exist, so only the Raya AI tab (`POST /api/chat`)
  shows anything ([M17](../../.claude/skills/temple-portal-expert/brain/M17-mobile-app-prisma-and-ai-loop.md)).
- **Prisma arrived unused.** A Prisma 7 schema mirrors nine Supabase tables; nothing imports its client (M17).
- **Raya AI was rewritten and moved to Supabase.** A 192-line orchestrator over a retrieval registry
  and a response composer replaced the 1,191-line generator; settings, knowledge, chat and analytics
  moved to Supabase. Still no LLM call, and the admin knowledge screens still write Firestore (M08, M09).
- **Migration progress.** A unit-tested ETL library with batched and staged runs; 9 new Supabase
  migrations (24 tables). Bookings, donations, receipts and most settings still live in Firestore (M11).
- **CI, but no deploy gate.** `ci.yml` (2026-10-03) runs lint, typecheck, tests and build on every push
  and pull request, yet the deploy does not wait for it; 22 workflows, five of them a bot development
  loop in `.ai/`. 21 of 97 route files now verify a token, against 5 of 95 before (M12, M15, M17).

---

## What this is, and who it is for

This is the web platform of the **Sri Raghavendra Swamy Matha** at Rayara Matha, Yelahanka
(13.1005 N, 77.5963 E, Asia/Kolkata). It is one Next.js application serving three audiences at once.

**Devotees** are the public audience. They arrive to read about the Matha and its guru parampara,
check today's panchanga and the festival calendar, browse events and the photo gallery, request a
seva, make a donation, look up a receipt, and ask questions of *Raya AI*, a chat assistant that
answers from the temple's own facts rather than from a language model's memory.

**Temple administrators** — counter clerks, office staff, priests, trustees — use an admin console
at `/admin` to publish events and announcements, curate the gallery, maintain the seva catalogue and
the daily pooja timetable, work the booking and donation queues, issue numbered seva receipts, and
edit the copy the public site renders.

**The trust** is the third, indirect audience: the receipt book, the reports screen and the donation
ledger exist so the institution can account for what it receives.

Two facts of the temple context shape the whole system. **Money is manual** — there is no payment
gateway anywhere in the repository; a devotee is shown a UPI ID, pays out of band, and types a
reference back into the form. And **dates are lunar** — the Matha's nineteen Guru Aaradhanes fall on
lunar tithis, so a Python job computes a full Hindu almanac (panchanga) for the temple's coordinates
and commits it into the repository as JSON.

---

## The feature map

**Public information site** — `/`, `/about`, `/trust`, `/guruparampara`, `/journey`, `/timeline`,
`/facilities`, `/future-plans`, `/testimonials`, `/volunteer`, `/live`, `/gallery`, `/events`,
`/search`. The home page is a long scroll: announcement marquee, hero, daily spiritual dashboard,
panchanga, map, upcoming events, recommendations, gallery preview, testimonials, social bar. Its
content comes from four different places — Firestore CMS documents, a Supabase table, checked-in
TypeScript constants, and static files on disk. Detail in
[M02](../../.claude/skills/temple-portal-expert/brain/M02-public-information-pages.md).

**Devotional content and transactions** — `/sevas`, `/pooja`, `/donation`, `/receipts`,
`/aaradhane`, `/quotes`, `/shlokas`, `/stotras`, `/qr`, `/display`, `/temple-explorer`,
`/calendar`, `/knowledge`. This is where a devotee transacts: browse and book a seva, donate, look
up a receipt by phone number, read shlokas and stotras, walk a virtual temple tour. `/display` is a
kiosk board meant to run on a screen inside the temple. Detail in
[M03](../../.claude/skills/temple-portal-expert/brain/M03-public-devotional-and-transactions.md).

**Member features** — `/profile`, `/profile/settings`, `/profile/preferences`, `/favorites`,
`/notifications`. A signed-in devotee keeps a profile (gotra, nakshatra, photo), bookmarks content,
and sets language, theme and notification preferences. Sign-in, registration and password reset live
at `/login`, `/register`, `/forgot-password`. Detail in
[M04](../../.claude/skills/temple-portal-expert/brain/M04-auth-users-and-security.md).

**Admin console** — `/admin` and its 82 sub-routes (83 `page.tsx` files under `app/admin/`): a
sidebar shell around a dashboard,
fourteen settings pages, content and media management, and the devotional-operations back office.
The Receipt Book (`/admin/receipts`) is the most carefully built part of the application — numbering,
pricing and totals are computed on the server and the browser can never supply a price.
Detail in [M05](../../.claude/skills/temple-portal-expert/brain/M05-admin-platform-and-settings.md),
[M06](../../.claude/skills/temple-portal-expert/brain/M06-admin-content-and-media.md) and
[M07](../../.claude/skills/temple-portal-expert/brain/M07-admin-devotional-operations.md).

**Raya AI** — a floating chat widget on every page, backed by `POST /api/chat`, plus an admin
console at `/admin/ai` — a hub and eleven sub-pages. It classifies a question into one of 42 intents, retrieves the matching
facts from Supabase (the AI settings and knowledge tables, since October 2026), Firestore (events and
other domains) or the panchanga files, and formats a bilingual English/Kannada answer. Detail in
[M08](../../.claude/skills/temple-portal-expert/brain/M08-raya-ai-engine.md) and
[M09](../../.claude/skills/temple-portal-expert/brain/M09-raya-ai-console-and-knowledge-workflow.md).

**Calendar and panchanga** — `/calendar`, `/calendar/ekadashi`, `/calendar/festivals`, and the
panchanga block on the home page and the kiosk display. A GitHub Actions cron runs a Python job four
times a day to refresh today's almanac; a yearly job regenerates the Aaradhane dates. Detail in
[M14](../../.claude/skills/temple-portal-expert/brain/M14-domain-engines-panchanga-aaradhane-receipts-reports.md).

**Receipts and billing** — `/admin/receipts`, `/admin/billing`, and the public lookup at
`/receipts`. Receipts render as a print page and as a pdf-lib PDF with a UPI QR code. Billing is a
separate GST-style invoice module, feature-flagged off.

**Device features** — share, add-to-calendar, directions, browser notifications, QR scanning and
generation, plus English/Kannada/Sanskrit dictionaries and accessibility primitives. Detail in
[M13](../../.claude/skills/temple-portal-expert/brain/M13-device-capabilities-i18n-and-pwa.md).

**Mobile app** (added 2026-09-30) — `apps/mobile`, a read-only Expo app for devotees: temple
information, daily poojas, sevas, events, gallery and Raya AI. It shares no code with the web app.
Detail in [M17](../../.claude/skills/temple-portal-expert/brain/M17-mobile-app-prisma-and-ai-loop.md).

---

## Two journeys, end to end

### A devotee books a seva

1. **Page** — `/sevas` (`app/(public)/sevas/page.tsx`, a Server Component) renders the navbar and the
   `SevaBooking` client component.
2. **Component** — `components/home/SevaBooking.tsx` mounts and calls `sevaService.getAllSevas()`.
3. **Service** — `services/seva.service.ts:9` calls the server action `getAllSevasAction()`
   (`app/actions/sevas.ts:4`).
4. **Store** — the action reads the **Supabase** `sevas` table with the service-role client; on any
   throw it falls back to the **Firestore** `sevas` collection (`services/seva.service.ts:30-39`).
5. **Component** — the devotee picks a seva and a date; `handleSubmitClick()`
   (`SevaBooking.tsx:127`) requires a login, a seva and a date, and nothing else.
6. **Service → store** — `handleBooking()` (`:146`) calls `sevaBookingService.createBooking()`
   (`services/sevaBooking.service.ts:34`), which writes a Firestore `sevaBookings` document with
   `status: "pending"`.
7. **Component** — a dialog shows the temple's UPI ID from `useFinanceSettings()`, falling back to a
   hardcoded literal (`SevaBooking.tsx:114`). The devotee pays in their own UPI app and types the
   reference back.
8. **Service → store** — `handleSavePaymentReference()` (`:181`) calls
   `sevaBookingService.updatePayment()` (`services/sevaBooking.service.ts:81`), which sets
   `paymentStatus: "completed"` **from the browser**, with nothing verifying the transaction.
9. **Admin** — the booking surfaces in `/admin/bookings` and `/admin/seva-bookings` for manual
   reconciliation.

### An administrator publishes an event

1. **Page** — the admin signs in at `/login` (`app/(auth)/login/page.tsx`); `services/auth.service.ts:82`
   authenticates against Firebase Auth and `:133` loads the `users/{uid}` profile that carries the
   role.
2. **Page** — `/admin/events/new` (`app/admin/events/new/page.tsx`, a Server Component) renders
   `<EventForm mode="create">`.
3. **Component** — `components/admin/events/EventForm.tsx` collects title, dates, location, image and
   the `published` flag.
4. **Service → store** — `eventService.createEvent()` (`services/event.service.ts`) writes the
   **Supabase** `events` table through the anon client.
5. **Page** — the public `/events` route renders `EventGrid` (`components/events/EventGrid.tsx:29`),
   which calls `eventService.getPublishedEvents()` (`services/event.service.ts:130`) and downloads the
   whole table, then filters and sorts in JavaScript.
6. **Component** — `EventCard` renders each row; the detail page `/events/[id]` reads the same table
   by `firestore_id`.

Both journeys work in outline and break in detail. Step 8 of the first lets anyone mark a booking
paid. In the second, `EventForm` builds Firestore `Timestamp` objects and hands them to a
Supabase-backed service, and the event detail page calls `.toDate()` on what Supabase returns as an
ISO string, so it throws for every event (`app/(public)/events/[id]/page.tsx:63`). The 2026-10-18
check adds a deeper problem: the repository's `events` table carries a deny-all RLS policy, so the
anon client's reads and writes return nothing unless the live database differs from the migrations
(M06-F36).

---

## The module map

The codebase — 929 source files, 178,106 lines on 2026-10-18 (818 and 158,773 on 2026-09-19) — is
divided into sixteen code modules, M01-M15 plus M17 (added 2026-10-18 for the mobile app, Prisma and
the `.ai/` loop), each with a verified brain file under
[`.claude/skills/temple-portal-expert/brain/`](../../.claude/skills/temple-portal-expert/brain/).
One more brain file, M16, owns no code: it is the field-level index across all of them.

| ID | Module | In one line | Brain file |
|---|---|---|---|
| M01 | Foundation and UI kit | Root layout, provider stack, design tokens, shared components, `lib/` utilities | [M01](../../.claude/skills/temple-portal-expert/brain/M01-foundation-and-ui-kit.md) |
| M02 | Public information pages | Home page and the twenty institutional and discovery routes | [M02](../../.claude/skills/temple-portal-expert/brain/M02-public-information-pages.md) |
| M03 | Public devotional and transactions | Sevas, donations, receipts, member pages, calendar, knowledge | [M03](../../.claude/skills/temple-portal-expert/brain/M03-public-devotional-and-transactions.md) |
| M04 | Auth, users and security | Firebase Auth, the role model, Firestore and Storage rules | [M04](../../.claude/skills/temple-portal-expert/brain/M04-auth-users-and-security.md) |
| M05 | Admin platform and settings | Admin shell, dashboard, CRUD framework, fourteen settings pages | [M05](../../.claude/skills/temple-portal-expert/brain/M05-admin-platform-and-settings.md) |
| M06 | Admin content and media | Events, gallery, announcements, quotes, testimonials, uploads | [M06](../../.claude/skills/temple-portal-expert/brain/M06-admin-content-and-media.md) |
| M07 | Admin devotional operations | Bookings, donations, poojas, aaradhane, billing, the Receipt Book | [M07](../../.claude/skills/temple-portal-expert/brain/M07-admin-devotional-operations.md) |
| M08 | Raya AI engine | Intent detection, retrieval, answer templates, the chat API | [M08](../../.claude/skills/temple-portal-expert/brain/M08-raya-ai-engine.md) |
| M09 | Raya AI console and knowledge workflow | Chat widget, `/admin/ai`, the editorial workflow, AI UAT | [M09](../../.claude/skills/temple-portal-expert/brain/M09-raya-ai-console-and-knowledge-workflow.md) |
| M10 | Services and types catalogue | 54 services and 42 type files — the repository layer as built | [M10](../../.claude/skills/temple-portal-expert/brain/M10-services-and-types-catalogue.md) |
| M11 | Data model, persistence and migration | Firestore collections, Supabase tables, rules, indexes, seeds | [M11](../../.claude/skills/temple-portal-expert/brain/M11-data-model-persistence-and-migration.md) |
| M12 | API layer | 97 route handlers and two server-action files — the whole HTTP surface | [M12](../../.claude/skills/temple-portal-expert/brain/M12-api-layer.md) |
| M13 | Device capabilities, i18n and PWA | Share, location, notifications, QR, dictionaries, accessibility | [M13](../../.claude/skills/temple-portal-expert/brain/M13-device-capabilities-i18n-and-pwa.md) |
| M14 | Domain engines | Panchanga, festivals, the Aaradhane generator, receipt PDFs, reports | [M14](../../.claude/skills/temple-portal-expert/brain/M14-domain-engines-panchanga-aaradhane-receipts-reports.md) |
| M15 | Testing, CI/CD and repo health | 50 Playwright specs, 52 Jest unit files, 22 workflows, documentation health | [M15](../../.claude/skills/temple-portal-expert/brain/M15-testing-ci-tooling-and-repo-health.md) |
| M16 | Collection and table field catalogue | Every field of all 64 Firestore collections and 24 Supabase tables, with its writers and readers | [M16](../../.claude/skills/temple-portal-expert/brain/M16-collection-field-catalogue.md) |
| M17 | Mobile app, Prisma, AI loop, root reports | The Expo app in `apps/mobile`, the unused Prisma mirror, the `.ai/` bot development loop and six new root reports | [M17](../../.claude/skills/temple-portal-expert/brain/M17-mobile-app-prisma-and-ai-loop.md) |

---

## The honest state of the platform

The site renders, the admin console is navigable, and the Receipt Book genuinely works. Everything
else needs qualifying. The platform is **mid-migration from Firestore to Supabase and stopped
halfway**: Supabase owns events, site settings, temple areas and, since October 2026, the Raya AI
data; Firestore owns almost everything else; and several domains — sevas, social links, knowledge,
unknown questions and the AI dashboards — are read from one store while being written to the other,
so an administrator's edits never reach the page that shows them. Twelve Supabase tables hold
migrated or copied data that no web code reads (three of them are read only by the mobile app), and several of
the tables the code *does* read are locked to deny-all, so those reads return nothing and the
services swallow the error. Authorization is the second systemic gap: the request-time interceptor
`proxy.ts` authorizes nothing, the admin gate is a client-side React guard, and 76 of the 97 API
route files perform no identity check (88 of 95 on 2026-09-19) — including routes that mint a
super-admin or rewrite any role (both latent today, M04-F04, M04-F05) and one that returns devotee
phone numbers; the AI settings routes are now guarded. A third of the code is scaffolding: the entire
knowledge-approval workflow (about 2,000 lines) has no reachable UI, the nine device widgets have no
consumers, the 825 translated strings are never rendered because no i18n provider is mounted, the
LLM provider abstraction is fully written but its only call site is commented out, and several admin
screens (`/admin/library`, `/admin/stotras`, `/admin/calendar/*`) persist nothing at all. Finally,
the quality apparatus is thin: since 2026-10-03 CI runs lint, typecheck, tests and the build, but the
deploy workflow does not wait for it, lint passes partly because 35 files carry a blanket
`eslint-disable`, the Playwright config points at a directory that does not exist, and the
`no-explicit-any` rule the coding standards rest on is switched off for the whole source tree.

Those are the conditions to design around, not reasons to start over: the domain modelling, the
receipt engine, the panchanga pipeline and the intent catalogue are real assets.

For the data layer specifically, read
[M11](../../.claude/skills/temple-portal-expert/brain/M11-data-model-persistence-and-migration.md)
for which store owns what and
[M16](../../.claude/skills/temple-portal-expert/brain/M16-collection-field-catalogue.md) for the
fields inside it — every field of all 64 Firestore collections and 24 Supabase tables, with the
`path:line` of everything that writes or reads it, and the nineteen collections that have no
TypeScript type at all.

---

## Where to go next

- **[TECHNICAL-GUIDE.md](./TECHNICAL-GUIDE.md)** — stack, runtime topology, repository layout,
  request lifecycles with `file:line`, component trees, the store catalogue, the AI pipeline, build
  and deployment, and a "where to look" table.
- **The expert skill** — [`.claude/skills/temple-portal-expert/`](../../.claude/skills/temple-portal-expert/README.md).
  Start at its [MIND-MAP](../../.claude/skills/temple-portal-expert/MIND-MAP.md), which routes a
  question to one of the seventeen brain files (linked in the module map above); each is the verified,
  evidence-backed record of what a module actually does, including a faults table with `path:line`
  evidence. M16 is the field-level catalogue across all of them.
- **The re-architecture reports** — in [`docs/rearchitecture/`](../rearchitecture/):
  [REACT-NATIVE-MIGRATION-AND-FAULTS.md](../rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md)
  (the portability analysis and the consolidated fault report),
  [UI-REDESIGN-PLAN.md](../rearchitecture/UI-REDESIGN-PLAN.md) and the rendered
  [ui-redesign-specimens.html](../rearchitecture/ui-redesign-specimens.html).
- **The existing `docs/` corpus** — graded in the documentation-health table in
  [M15](../../.claude/skills/temple-portal-expert/brain/M15-testing-ci-tooling-and-repo-health.md).
  [ARCHITECTURE.md](../ARCHITECTURE.md), [DATA-MODEL.md](../DATA-MODEL.md),
  [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) and
  [RAYA_AI_ARCHITECTURE.md](../RAYA_AI_ARCHITECTURE.md) are stale — Next.js 14, pre-Supabase;
  [CHANGELOG.md](../CHANGELOG.md) and [DEPLOYMENT.md](../DEPLOYMENT.md) are 0 bytes. Where a
  document and the code disagree, the code is the truth.
