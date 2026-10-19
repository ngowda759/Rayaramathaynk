# Architecture Documentation

**Project:** Sri Raghavendra Swamy Matha Website
**Last Updated:** 2026-07-19

---

## Overview

This document describes the system architecture, data flow, and component hierarchy. It answers: "How is the project designed?"

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (Next.js 14)                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      App Router (Server Components)                   │   │
│  │   ├── Route Groups: (auth), (public), admin, calendar               │   │
│  │   └── Layouts: root, group-specific layouts                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Client Components (Client Boundary)                │   │
│  │   ├── Interactive UI (useState, useEffect, event handlers)           │   │
│  │   └── AI Chat Interface                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          API Layer (Next.js Route Handlers)                   │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   /api/chat │  │ /api/gallery│  │ /api/admin/*│  │  /api/*      │       │
│  │   (AI Chat) │  │  (Gallery)  │  │   (Admin)   │  │  (General)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Services Layer (Business Logic)                     │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │event.service │  │seva.service  │  │donation.svc │  │ user.service │       │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │chat.service  │  │auth.service  │  │gallery.svc  │  │settings.svc  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Data Layer (Firestore)                              │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   events    │  │    sevas     │  │  donations   │  │    users    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   gallery   │  │announcements │  │   settings   │  │  knowledge   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                        │
│  │chat_sessions│  │  aaradhane   │  │   panchanga  │                        │
│  └──────────────┘  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Folder Responsibilities

### `app/` — Next.js App Router

| Directory | Purpose |
|-----------|---------|
| `app/(auth)/` | Authentication pages (login, register, forgot-password) |
| `app/(public)/` | Public-facing pages (home, about, donation, events, gallery, sevas) |
| `app/admin/` | Admin dashboard and management pages |
| `app/calendar/` | Temple calendar (Ekadashi, festivals) |
| `app/api/` | API Route Handlers |

### `components/` — React Components

| Directory | Purpose |
|-----------|---------|
| `components/ui/` | Base UI components (shadcn/ui primitives) |
| `components/admin/` | Admin-specific components |
| `components/events/` | Event-related components |
| `components/home/` | Homepage-specific components |
| `components/layout/` | Layout components (Header, Footer, Navbar) |
| `components/common/` | Shared components used across features |
| `components/calendar/` | Calendar-specific components |
| `components/auth/` | Authentication components |
| `components/ai/` | AI chat components |

### `services/` — Business Logic

All data access goes through services. Never call Firestore directly.

| Service | Purpose |
|---------|---------|
| `event.service.ts` | Event CRUD operations |
| `seva.service.ts` | Seva CRUD operations |
| `sevaBooking.service.ts` | Booking management |
| `donation.service.ts` | Donation processing |
| `user.service.ts` | User management |
| `auth.service.ts` | Authentication |
| `gallery.service.ts` | Gallery management |
| `announcement.service.ts` | Announcements |
| `settings.service.ts` | Temple settings |
| `chat.service.ts` | AI chat operations |
| `content.service.ts` | Knowledge base content |

### `types/` — TypeScript Definitions

All TypeScript interfaces and types for data models.

### `lib/` — Utilities

| Directory | Purpose |
|-----------|---------|
| `lib/ai/` | AI/ML components (intent, retrieval, knowledge) |
| `lib/auth/` | Auth utilities |
| `lib/settings/` | Settings utilities |
| `lib/reports/` | Report generation |
| `lib/options.ts` | Select/dropdown options |

---

## Data Flow

### Public Page Data Flow

```
User Request → Server Component → Service Layer → Firestore → Render HTML
```

### Admin Page Data Flow

```
Admin Request → API Route → Service Layer → Admin SDK → Firestore → JSON Response
```

### AI Chat Flow

```
User Message → API Route → Intent Detection → Structured Retrieval → Knowledge Base → Response
```

---

## Authentication

### Flow

1. Firebase Auth handles user authentication
2. Auth state managed via `AuthContext.tsx`
3. Protected routes check auth state
4. Admin routes check user role

### User Roles

```typescript
type UserRole = "super_admin" | "temple_admin" | "priest" | "staff" | "volunteer" | "devotee";
```

---

## AI Architecture (Raya AI)

See `docs/AI-GUIDELINES.md` for detailed AI documentation.

### Key Principles

1. **Retrieval-First** — Facts from Firebase repositories
2. **No Hallucination** — Structured data only
3. **Fallback Chain** — Repository → Knowledge Base → LLM → Static
4. **Language Support** — English, Kannada, mixed

---

## Repository Pattern

### Service Interface

```typescript
// All services follow this pattern
interface IService<T> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}
```

### Example

```typescript
// ✅ Correct - Using service
const events = await eventService.getAll();

// ❌ Wrong - Direct Firestore call
const snapshot = await firestore.collection('events').get();
```

---

## API Routes

### Pattern

```
app/api/[resource]/[action]/route.ts
```

### Examples

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/users/create-admin` | POST | Create admin user |
| `/api/admin/users/set-role` | POST | Update user role |
| `/api/gallery/local-assets` | GET | Get local gallery assets |

---

## Component Hierarchy

```
Root Layout (app/layout.tsx)
     │
     ├── Public Layout (app/(public)/layout.tsx)
     │     ├── Header → Navbar
     │     ├── Main Content
     │     └── Footer
     │
     ├── Auth Layout (app/(auth)/layout.tsx)
     │     └── Auth Pages
     │
     ├── Admin Layout (app/admin/layout.tsx)
     │     ├── Sidebar
     │     ├── Header
     │     └── Content
     │
     └── Calendar Layout (app/calendar/layout.tsx)
           └── Calendar Content
```

---

## State Management

| Type | When to Use |
|------|-------------|
| Server Components | Default — data fetching, SEO-critical content |
| React Context | Shared state across component tree (Auth, Theme) |
| Local State (`useState`) | Component-specific state |
| URL State | Filters, pagination, navigation |
| Service Layer | Server data, Firestore queries |

---

## Error Handling

### Client-Side

```typescript
try {
  await eventService.getById(id);
} catch (error) {
  // Handle error - show toast, redirect, etc.
}
```

### Server-Side

```typescript
// In Route Handlers
return NextResponse.json(
  { error: 'Event not found' },
  { status: 404 }
);
```

---

## Performance Patterns

### Server Components

- Default choice for all data fetching
- Automatic streaming with Suspense
- Cached with Next.js cache

### Client Components

- Only when interaction needed
- Dynamic imports for large components
- Lazy loading for below-fold content

### Caching Strategy

| Data | Cache Duration |
|------|----------------|
| Static pages | ISR (revalidate: 3600) |
| Dynamic pages | On-demand revalidation |
| API routes | No cache (real-time) |
| Images | CDN cache |

---

## Security

### Client-Side

- Environment variables prefixed with `NEXT_PUBLIC_`
- No sensitive data in client code
- Input sanitization

### Server-Side

- Admin SDK for privileged operations
- Server-side validation
- Rate limiting on sensitive endpoints

### Firestore Rules

- Authenticated users can only read/write their own data
- Admin operations require role check
- Public data has read-only access

---

*Document maintained by: Development Team*

---

## Seva Entry (counter receipts module)

Seva Entry replaces the temple's paper receipt book: a keyboard-first counter on the office PC, a prasadam counter, a
dashboard, a receipt register, reports, exports, settings and staff roles. It extends the old Receipt Book, whose
Firestore code is retired by plan task A5-1. The signed spec is `docs/seva/DESIGN-BOOK.md`; the module map and runbook are
`docs/seva/README.md`. Written from the code on 2026-10-20.

### Lanes

| Lane | What runs there |
|---|---|
| People and devices | The counter PC (Windows, Edge or Chrome, the installed app, kiosk printing); the prasadam phone or PC (camera or USB scanner); admins' phones and PCs |
| App on Vercel (this Next.js app) | Module pages under `/seva` (`app/seva/**`): the full-screen counter frame (`(counter)`: counter, today's receipts, close day) and the desk frame (`(desk)`: dashboard, register, receipt pages, reports, settings, prasadam) with its own header, section rail and phone bar (`components/seva/shell/*`). Staff stays at `/admin/users`. Route handlers `app/api/seva/**`; server services `lib/seva/server/*`; pure logic `lib/seva/*`; browser clients `services/seva/*` |
| Data | Supabase Postgres: the seva tables and `seva_*` SQL functions (see `docs/DATA-MODEL.md`) |
| Outside services | Firebase Auth and Firestore `users` (sign-in, role, `isActive`); Firestore `settings/financeSettings` (the counter UPI id) and a mirror of `sevas`; GitHub Actions (CI, the nightly encrypted backup `seva-backup.yml`, the monthly purge `seva-maintenance.yml`); the counter PC's disk (the Excel copy) |

All module addresses come from one constant, `SEVA_ROUTES` in `lib/seva/routes.ts`. The website admin has one
"Seva Entry" menu item; `/seva` sends each role to its landing page (`sevaHomePath`): receptionist to `/seva/counter`,
prasadam counter to `/seva/prasadam`, temple admin and super admin to the dashboard. The old `/admin/receipts/*` and
`/admin/prasadam` addresses forward to `/seva` from `next.config.ts`.

### Server-only data access

- The browser never talks to Supabase for seva data. Route handlers verify the caller and then call services in
  `lib/seva/server/*`, the only code that calls `createAdminClient()` (service role, `import "server-only"`).
- Every multi-row write is one `seva_*` SQL function called through `callRpc` (`lib/seva/server/rpc.ts`), so receipt
  numbers are taken in the same transaction as the insert. `SEVA:<code>` errors become typed `SevaError`s; any other
  database error becomes `internal` and only its code is logged.
- Every route starts with the guard `requireSevaActor` (`lib/seva/server/auth.ts`) and the allow-list `can()` of
  `lib/seva/permissions.ts`; the browser uses the same `can()` only to hide what is not allowed.

### Identity adapter

`lib/seva/server/identity.ts` is the only seva code that knows the sign-in provider (`lib/seva/server/identity-firebase.ts`
today). Everything else works with a provider-neutral `externalUid` (stored as `staff.firebase_uid`) and an access
profile (`role`, `isActive`). The adapter verifies the request's token, reads the access profile, creates, enables,
disables and deletes logins. Moving away from Firebase later means a new adapter, not new routes. A person is let in
only when both stores agree: Firestore `isActive` and an allowed role, and Supabase `staff.status = 'active'`.

### Flows

- **F1 Counter receipt (online).** The counter (`components/seva/counter/*`, state in `lib/seva/counter/*`) builds the
  order with a `client_order_id` and one `client_receipt_id` per seva date, and posts it with the sign-in token and the
  PC header to `POST /api/seva/counter/orders`. `seva_issue_counter_order` re-prices every line from the catalogue,
  takes the next numbers of the counter's C series, writes order, receipts and lines, and answers the receipts; a
  repeat of the same order answers the same receipts. The PC prints one page per receipt (`lib/seva/print/*`, the
  paper size from settings) and records the first print with `POST /api/seva/counter/prints`.
- **F2 Counter receipt (offline).** When the office cannot be reached, the PC numbers the receipt in its own OF series
  (`lib/seva/offline/*`), stores it in the IndexedDB outbox, prints at once, and keeps an Excel copy of the day in a
  chosen folder (`lib/seva/excel/*`, a Web Worker). When the line is back, the outbox goes to
  `POST /api/seva/counter/sync`; `seva_sync_offline_order` stores each order exactly as printed, ignores duplicates and
  records any number gap.
- **F3 Prasadam.** The volunteer scans the QR (`/r/<token>`) or types the number on `/seva/prasadam`;
  `GET /api/seva/prasadam/lookup` answers the screen to show (no amounts), and `POST /api/seva/prasadam/give` marks it
  given once per receipt (`seva_mark_prasadam`).
- **F4 Temple admin.** The dashboard and reports read pre-bucketed summaries from SQL functions through
  `/api/seva/reports/*`; exports page the data through the API and build Excel, CSV, Tally and the board summary in the
  browser; every export is audited.
- **F5 Devotee (Phase 2, not built yet).** Online booking and UPI payments through a provider adapter (Plan B).

### Installable app and service worker

Seva Entry installs as one app for every role (`public/seva-counter.webmanifest`: `start_url` and `scope` `/seva`).
The service worker `public/seva-sw.js`, registered by `components/seva/counter/RegisterServiceWorker.tsx`, caches only
the counter page and its files; offline, an app start opens the cached counter so the counter PC can keep issuing OF
receipts. Every other page needs the network.
