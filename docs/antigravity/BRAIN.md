# Project Brain — Rayaramathaynk

## 1. Project Purpose & Repository
* **Project Name:** Sri Raghavendra Swamy Matha Web Portal (Rayaramathaynk)
* **Repository:** `ngowda759/Rayaramathaynk`
* **Default / Production Branch:** `main`
* **Current Working Branch:** `antigravity-work`
* **Purpose:** Complete digital management system and public presence for Sri Raghavendra Swamy Matha. Serves devotees, temple administrators, priests, and counter staff.
* **Core Capabilities:**
  * Public portal: Temple history, events, daily poojas, gallery, donations, quotes, panchanga calendar.
  * Counter operations (Seva Entry): Keyboard-first counter terminal, receipt issuance (online & offline), prasadam distribution, day-close reconciliation, financial reports.
  * Devotee services: Seva bookings, e-receipts, testimonials, volunteer registration.
  * Raya AI: Intelligent conversational assistant answering temple questions in English and Kannada.
  * Admin dashboard: Content management, user role-based access control, analytics, and AI settings.

---

## 2. Technology Stack
* **Framework:** Next.js 16 (`16.2.9`, App Router, React 19 (`19.2.4`), TypeScript 5.9 (Strict mode))
* **Styling & UI:** Tailwind CSS 4, Radix UI primitives, `@base-ui/react`, Lucide React, Framer Motion, Tiptap rich-text editor, ECharts
* **Database & ORM:**
  * **Target Database:** Supabase (PostgreSQL with Supavisor pooler, `@supabase/ssr`, `@supabase/supabase-js`)
  * **ORM & Typed Access:** Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`)
  * **Legacy Datastore:** Firebase Firestore & Firebase Admin SDK (`firebase`, `firebase-admin`)
* **Storage:** Vercel Blob Storage, Firebase Storage
* **Deployment & CI/CD:** Vercel, GitHub Actions

---

## 3. High-Level Architecture
The repository adheres to a strict layered design:
1. **Presentation Layer (`app/` & `components/`):**
   * Server Components by default for SEO, security, and performance.
   * Client Components (`"use client"`) isolated to interactive boundaries (counter terminals, forms, chat widgets).
2. **API & Route Layer (`app/api/**`):**
   * Next.js Route Handlers exposing JSON REST endpoints.
   * Server-only authentication guards enforcing role-based permissions before business logic execution.
3. **Domain & Services Layer (`services/**` & `lib/**`):**
   * Service/Repository pattern encapsulates business rules and data transformations.
   * UI components never execute raw database queries or direct external API calls.
4. **Data Layer:**
   * Supabase PostgreSQL is the primary authority for Seva Counter, AI settings, and migrated content.
   * Scoped Prisma models provide type safety for Raya AI and user authorization.

---

## 4. Major Modules
| Module | Path | Primary Datastore | Purpose |
|---|---|---|---|
| **Public Website** | `app/(public)/**` | Supabase / Firestore fallback | Homepage, about, events, sevas, donations, gallery |
| **Seva Entry (Counter)** | `app/seva/**` | Supabase PostgreSQL | Office PC counter receipts, offline caching, prasadam counter, day-close |
| **Admin Portal** | `app/admin/**` | Supabase / Firebase | Operations dashboard, events, users, quotes, settings, reports |
| **Raya AI Console** | `app/admin/ai/**` | Supabase PostgreSQL | Prompt engineering, knowledge base approval, analytics, settings |
| **Calendar & Panchanga**| `app/calendar/**` | Supabase / Static | Ekadashi, temple festival calendars, daily spiritual timings |

---

## 5. Raya AI Architecture
* **Retrieval-First Design:** Strict zero-hallucination policy. Factual information (timings, sevas, events, quotes, history) must be fetched from structured repositories.
* **Fallback Hierarchy:**
  $$\text{Structured Repositories} \longrightarrow \text{Knowledge Base Articles} \longrightarrow \text{Context-Augmented LLM} \longrightarrow \text{Static Deterministic Message}$$
* **Multi-Provider LLM Engine (`lib/ai/provider.ts`):** Supports OpenAI (`gpt-4o-mini`), Google Gemini (`gemini-1.5-flash`), Anthropic Claude (`claude-3-haiku`), and OpenRouter.
* **Language Support:** English, Kannada (Unicode `\u0C80-\u0CFF`), and mixed script handling with transliteration and intent detection.

---

## 6. Authentication Architecture
* **General / Legacy Admin & Public:** Firebase Authentication issues client JWTs. Protected API routes verify tokens via Firebase Admin SDK and authorize against Supabase `public.users` (`firestore_id`).
* **Raya AI Admin (`/admin/ai/*`):** Authenticates directly via Supabase Auth sessions (`@supabase/ssr`).
* **Seva Counter Identity:** Uses a provider-neutral identity adapter (`lib/seva/server/identity.ts`) linking external UIDs to the Supabase `staff` table.

---

## 7. Database Architecture
* **Supabase PostgreSQL (Authoritative Target):** Governed by raw SQL migrations in `supabase/migrations/` with transaction-safe stored procedures/RPCs (`seva_issue_counter_order`, `seva_mark_prasadam`, etc.) and Row Level Security (RLS).
* **Prisma 7 Baseline:** Scoped mirror for Raya AI and user authorization in `prisma/schema.prisma` with zero-credential CI drift verification.
* **Firestore (Transitional/Legacy):** Being retired in structured phases; holds legacy documents and unmigrated collections.

---

## 8. Deployment Architecture
* **Hosting:** Vercel Production Environment.
* **CI/CD:** GitHub Actions `.github/workflows/ci.yml` validates linting, type safety, unit tests, in-process PostgreSQL tests (`@electric-sql/pglite`), server boundaries, and Next.js production builds.
* **CD Pipeline:** `.github/workflows/deploy.yml` triggers upon push to `main`, deploying prebuilt artifacts via Vercel CLI.

---

## 9. Important Architectural Principles
1. **Server Components First:** Keep bundle sizes minimal; use client components only when interactivity or browser APIs are required.
2. **Server-Only Boundaries:** All database access, secrets, and server clients enforce `import "server-only"`.
3. **Fail-Closed Security:** Unauthorized or unverified requests fail with explicit error handling; RLS is strictly enforced.
4. **No Direct UI-to-Database Calls:** All UI data fetching flows through designated service abstractions.
5. **Preserve Migration Continuity:** Never introduce new Firestore dependencies or bypass Supabase migration baselines.
