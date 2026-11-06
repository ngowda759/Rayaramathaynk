# System Architecture — Rayaramathaynk

This document details the software architecture, data flow, component hierarchies, and infrastructural boundaries of the Rayaramathaynk repository. It explicitly distinguishes between **CURRENT**, **TRANSITIONAL**, and **LEGACY** subsystems.

---

## 1. Next.js App Router Structure

The project uses Next.js 16 with the App Router, organized by audience and operational domain:

```
app/
├── (auth)/                 # Public user authentication routes (login, register, reset)
├── (public)/               # Public-facing devotee pages (home, about, sevas, events, donations, gallery)
├── admin/                  # Main temple administration portal (protected by AdminAuthGuard)
│   ├── ai/                 # Raya AI administration console (native Supabase Auth)
│   ├── aaradhane/          # Aaradhane schedule management
│   ├── events/             # Event creation and calendar management
│   ├── donations/          # Donation tracking and 80G receipting
│   ├── users/              # Role assignment and user management
│   └── settings/           # Temple settings, timings, finance
├── seva/                   # Dedicated Seva Counter module (desk & counter shells)
│   ├── (counter)/          # Full-screen POS counter receipt terminal
│   └── (desk)/             # Back-office seva dashboard, register, reports, prasadam desk
├── calendar/               # Temple panchanga & festival calendar
└── api/                    # Next.js Route Handlers (JSON REST endpoints)
    ├── admin/              # Privileged administrative endpoints
    ├── ai/                 # Raya AI analytics, settings, and knowledge management
    ├── chat/               # Devotee conversational AI endpoint
    ├── seva/               # Counter orders, offline sync, day-close, prasadam
    └── [public]/           # Public endpoints (events, sevas, quotes, testimonials)
```

---

## 2. Data Flow Architecture

Every operational domain follows a strict 4-tier flow:
$$\text{User / Client Interaction} \longrightarrow \text{API Route Handler} \longrightarrow \text{Domain Service Layer} \longrightarrow \text{Database Layer}$$

1. **Client Boundary (`components/`):**
   * Uses React 19 Client Components only where local state, event listeners, or browser APIs (IndexedDB, Service Worker) are required.
   * Calls API Route Handlers via `fetch` with bearer tokens or session cookies.
2. **API Layer (`app/api/**/route.ts`):**
   * Validates request payloads using Zod or typed schemas.
   * Authenticates caller via server-only guards (`verifyAdminUserResult` or `requireSevaActor`).
   * Never contains inline SQL or raw database connections; delegates to domain services.
3. **Domain Service Layer (`services/` and `lib/**/server/`):**
   * Implements business rules, validation, re-pricing, and transaction orchestration.
   * Enforces `import "server-only"` to prevent secret leakage to client bundles.
4. **Data Layer (Supabase PostgreSQL / Prisma / Firestore):**
   * Performs database reads, writes, and RPC calls.

---

## 3. Database Layer: Supabase, PostgreSQL & Prisma

### 3.1 Authoritative Target Database: Supabase PostgreSQL [CURRENT]
* **Source of Truth:** Managed SQL migrations located in `supabase/migrations/` (45+ migrations).
* **Connection Pooling:** Connected via Supavisor (port `5432` / `6543`) using connection strings provided in `SUPABASE_DB_URL` and `PRISMA_DATABASE_URL`.
* **RPC Stored Procedures:** All critical multi-row operations (e.g., counter receipt issuance, number allocation, prasadam marking) execute as atomic database functions (`seva_issue_counter_order`, `seva_mark_prasadam`, `seva_close_day`) via `lib/seva/server/rpc.ts`.
* **Security:** Row Level Security (RLS) is enabled across all tables, backed by fail-closed assertion migrations (`f_a16_fail_closed_rls_assertion.sql`).

### 3.2 Scoped ORM: Prisma 7 [CURRENT / TRANSITIONAL]
* **Configuration:** Defined in `prisma.config.ts` and `prisma/schema.prisma`.
* **Scope:** Scoped strictly to the **Raya AI domain** and **User/Profile authorization** models.
* **Driver Adapter:** Employs `@prisma/adapter-pg` over native `pg`.
* **Client Artifact:** Generated to `generated/prisma` via `npm run prisma:generate`.
* **Drift Protection:** Validated in CI using `prisma migrate diff` through `.github/workflows/prisma-baseline-drift-gate.yml` and `scripts/lib/check-baseline-drift-scope.mjs`.

### 3.3 Legacy Datastore: Firebase Firestore [LEGACY / TRANSITIONAL]
* **Status:** Being systematically replaced by Supabase.
* **Remaining Dependencies:**
  * User profiles for legacy public devotees.
  * Historical feedback, volunteer submissions, and legacy testimonials.
  * Secondary fallback for unmigrated announcements and quotes.
* **Rule:** No new Firestore dependencies or fallbacks may be introduced.

---

## 4. Authentication Architecture

```
                  ┌───────────────────────────────────────────────┐
                  │                 Incoming Request              │
                  └───────────────────────┬───────────────────────┘
                                          │
                   Route Type?            │
          ┌───────────────────────────────┼──────────────────────────────┐
          ▼                               ▼                              ▼
  [/admin/ai/*]                    [/api/admin/*]                  [/api/seva/*]
Supabase Auth Session           Firebase Auth Bearer            Seva Identity Adapter
  (via @supabase/ssr)           (via Firebase Admin)            (External UID mapping)
          │                               │                              │
          ▼                               ▼                              ▼
  Verify Session                  Verify ID Token               Lookup in Supabase
          │                               │                         public.staff
          ▼                               ▼                              │
  Check Supabase                  Verify Role in                         ▼
   public.users                 Supabase public.users             Enforce Seva Role
(role & active=true)             (role & active=true)           (can() permission map)
```

1. **Raya AI Administration [CURRENT]:** Native Supabase Auth using email/password and secure PKCE password reset (`lib/supabase/client.ts`, `lib/supabase/server.ts`).
2. **Main Admin Console [TRANSITIONAL]:** Firebase client token verified by server-side Firebase Admin SDK; role authorization checked against Supabase `public.users` table (`lib/auth/admin-auth.ts`).
3. **Seva Counter [CURRENT]:** Provider-neutral identity adapter (`lib/seva/server/identity.ts`) maps the verified token UID to Supabase `public.staff`. Requires both account activation and valid staff assignment.

---

## 5. Raya AI Flow & Architecture

```
Devotee Query ──> /api/chat ──> Rate Limiter ──> Intent & Language Detector
                                                          │
          ┌───────────────────────────────────────────────┘
          ▼
Structured Retrieval Layer
├── Settings Service   ──> Temple hours, darshan timings
├── Sevas Service      ──> Seva list, costs, descriptions
├── Events Service     ──> Upcoming festivals, schedules
├── Panchanga Service  ──> Daily tithi, nakshatra, masa
├── Quotes Service     ──> Daily spiritual thoughts
└── Knowledge Base     ──> Markdown articles from Supabase ai_knowledge
          │
          ├── [All facts found] ──────────> Response Composer ─────────> Formatted Markdown
          └── [Contextual reasoning needed] ──> Multi-Provider LLM ────> Devotee Answer
                                                (OpenAI / Gemini / Claude)
```

* **Intent Detection (`lib/ai/intent/`):** Pattern matching and keyword classification with Kannada Unicode and English transliteration handling.
* **Retrieval Registry (`lib/ai/retrieval/`):** Queries database entities before invoking any LLM, guaranteeing fact accuracy.
* **Provider Dispatcher (`lib/ai/provider.ts`):** Dynamic provider switching across OpenAI, Google Gemini, Anthropic Claude, and OpenRouter.
* **Observability:** Logs latency metrics (`ai_latency_records`), intent distributions (`ai_intent_distribution`), and unrecognized queries (`unknown_questions`) to Supabase.

---

## 6. Seva Entry Counter Architecture [CURRENT]

The Seva Counter module (`app/seva/`) operates as a mission-critical POS terminal:
* **Dual Operation Mode:**
  * **Online Mode:** Submits orders directly to `POST /api/seva/counter/orders`. Invokes `seva_issue_counter_order` PostgreSQL RPC to reprice items, increment receipt series, and commit in a single transaction.
  * **Offline Mode:** If connectivity drops, issues offline receipts in the local `OF` series, persists data to browser IndexedDB, prints receipts immediately, and streams daily backup entries to a local Excel file via Web Worker.
* **Sync Engine (`/api/seva/counter/sync`):** Replays offline transactions upon reconnection without generating number collisions.
* **Prasadam Desk (`/seva/prasadam`):** QR/barcode scanning (`/r/<token>`) triggering `seva_mark_prasadam` RPC to record distribution without exposing financial totals.

---

## 7. CI/CD & Deployment Pipeline

* **Continuous Integration (`.github/workflows/ci.yml`):**
  * Target: Ubuntu Latest on Node.js 22.
  * Pipeline steps: `npm run lint` $\rightarrow$ `npm run typecheck` $\rightarrow$ `npm test` $\rightarrow$ `npm run test:db` (in-process PGlite PostgreSQL) $\rightarrow$ `./scripts/test-boundary.sh` $\rightarrow$ `npm run build`.
* **Continuous Deployment (`.github/workflows/deploy.yml`):**
  * Trigger: Push to `main`.
  * Actions: Authenticates to Vercel, pulls production environment variables, builds with `vercel build --prod`, and deploys prebuilt assets with `vercel deploy --prebuilt --prod`.
* **Database Drift Gate (`.github/workflows/prisma-baseline-drift-gate.yml`):**
  * Performs read-only diff of `prisma/schema.prisma` against live Supabase database via session pooler prior to applying migrations.
