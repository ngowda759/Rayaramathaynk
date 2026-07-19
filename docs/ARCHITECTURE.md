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
