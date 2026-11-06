# Current Repository State — Rayaramathaynk

**Audit Date:** 2026-11-06  
**Current Branch:** `antigravity-work` (tracking `origin/antigravity-work`)  
**Working Tree Status:** Clean prior to `docs/antigravity/` creation  

This document captures the verified operational state of the codebase. Items are explicitly tagged as **[CURRENT]**, **[TRANSITIONAL]**, **[LEGACY]**, **[KNOWN ISSUE]**, or **[NOT YET VERIFIED]**.

---

## 1. Technology Stack & Runtime

| Component | Specification | Status |
|---|---|---|
| **Framework** | Next.js 16 (`16.2.9`), App Router | **[CURRENT]** |
| **Core Libraries** | React 19 (`19.2.4`), TypeScript 5.9 (`strict: true`) | **[CURRENT]** |
| **Styling** | Tailwind CSS 4, `@base-ui/react`, Radix UI primitives | **[CURRENT]** |
| **Authoritative DB** | Supabase (PostgreSQL with Supavisor pooler) | **[CURRENT]** |
| **ORM / Mirror** | Prisma 7.10.0 (`@prisma/client`, `@prisma/adapter-pg`) | **[CURRENT]** |
| **Legacy Datastore** | Firebase Firestore (v12.15 client / v14.1 admin) | **[LEGACY]** |
| **Hosting & CI** | Vercel (Production), GitHub Actions (Ubuntu 22) | **[CURRENT]** |

---

## 2. Database & Migration State

* **Supabase Migrations [CURRENT]:**
  * 45+ migrations exist under `supabase/migrations/` spanning initial core tables, temple areas, sevas, seva bookings, settings, seva counter receipts/orders, fail-closed RLS assertions, and function execution guards.
* **Prisma Baseline [CURRENT]:**
  * Defined in `prisma/schema.prisma` and configured in `prisma.config.ts`.
  * Scoped exclusively to the Raya AI domain (`ai_settings`, `ai_knowledge`, `chat_sessions`, `chat_messages`, `unknown_questions`, `ai_intent_distribution`, `ai_latency_records`) and authorization models (`users`, `profiles`).
  * Generates client to `generated/prisma`.
* **Seva Counter Engine [CURRENT]:**
  * Fully operates on Supabase PostgreSQL tables and SQL functions (`seva_issue_counter_order`, `seva_mark_prasadam`, `seva_close_day`).
* **Content & Reader Cutover [TRANSITIONAL]:**
  * Core content, aaradhane, and events are migrated to Supabase tables, but several background retrieval files retain fallback readers.
* **Legacy Firestore Footprint [LEGACY]:**
  * Residual Firestore imports in `services/chat.service.ts` (for feedback, volunteer requests), `services/knowledge-workflow.service.ts`, and legacy import/coverage endpoints.

---

## 3. Authentication & Authorization State

* **Raya AI Admin Console (`/admin/ai/*`) [CURRENT]:**
  * Runs on native Supabase Auth sessions via `@supabase/ssr`.
  * Handled via `components/admin/layout/AdminAuthGuard.tsx` and dedicated routes (`/admin/ai/login`, `/admin/ai/reset-password`).
* **General Admin Console (`/admin/*`) [TRANSITIONAL]:**
  * Authenticates using Firebase Auth client tokens.
  * Server-side route handlers ([lib/auth/admin-auth.ts](file:///c:/Projects/Rayaramathaynk/lib/auth/admin-auth.ts)) verify the Firebase ID token using Firebase Admin SDK, then query Supabase `public.users` (`firestore_id` = Firebase UID) to enforce `role` and `active = true`.
* **Seva Counter Identity [CURRENT]:**
  * Abstracted via `lib/seva/server/identity.ts`, mapping authenticated external UIDs to `public.staff` records in Supabase.

---

## 4. Raya AI State

* **Retrieval-First Pipeline [CURRENT]:**
  * Implemented in `lib/ai/` and `app/api/chat/route.ts`.
  * Queries structured services (timings, sevas, events, panchanga, quotes) and Supabase `ai_knowledge` before invoking LLM generation.
* **Multi-Provider LLM Engine [CURRENT]:**
  * Configured in `lib/ai/provider.ts` supporting OpenAI, Google Gemini, Anthropic Claude, and OpenRouter with streaming capability.
* **Observability & Analytics [CURRENT]:**
  * Latency, unknown queries, and intent distributions are tracked into Supabase tables.

---

## 5. Testing & CI/CD State

* **Unit Testing [CURRENT]:**
  * Jest test suite (`npm test`) with `jest-environment-jsdom` covering components and utility modules.
* **In-Process Database Testing [CURRENT]:**
  * Uses `@electric-sql/pglite` (`npm run test:db`) configured in `jest.db.config.ts` to run all Supabase migrations in-memory without live credentials.
* **E2E Testing [CURRENT]:**
  * Playwright test suites configured for Seva counter and AI UAT.
* **CI Pipeline (`.github/workflows/ci.yml`) [CURRENT]:**
  * Enforces linting, typechecking, unit tests, in-process DB tests, server boundary tests (`scripts/test-boundary.sh`), and Next.js build.
* **CD Pipeline (`.github/workflows/deploy.yml`) [CURRENT]:**
  * Builds and deploys prebuilt assets to Vercel upon push to `main`.
* **Drift Verification (`.github/workflows/prisma-baseline-drift-gate.yml`) [CURRENT]:**
  * Read-only workflow comparing `prisma/schema.prisma` against live Supabase schema.

---

## 6. Known Issues & Operational Flags

1. **[KNOWN ISSUE] Missing Local Dependencies (`node_modules`):**
   * `node_modules` is not installed in the local workspace.
   * `npm run typecheck`, `npm run lint`, and `npm test` cannot execute locally until `npm ci` is run.
2. **[KNOWN ISSUE] Windows PowerShell Script Execution Policy:**
   * Direct execution of `npm` in Windows PowerShell invokes `npm.ps1`, which is blocked by system execution policies (`PSSecurityException`).
   * Workaround: Execute via `cmd /c npm ...` or launch a command prompt shell.
3. **[KNOWN ISSUE] Auth Account Synchronization Requirement:**
   * If an admin account exists in Firebase Auth but has not been populated in Supabase `public.users` (with matching `firestore_id`), admin requests are rejected with `403 user_not_found`.
   * Diagnostic script available: `npm run diagnose:raya-admin-login`.
4. **[KNOWN ISSUE] Documentation Placeholders:**
   * `docs/DEPLOYMENT.md` is currently empty (0 lines).
   * `docs/FIRESTORE_SUPABASE_MIGRATION_STATUS.md` is a 1-line unpopulated placeholder.
5. **[NOT YET VERIFIED] Local Emulator Runtime:**
   * Firebase emulators and local Supabase CLI runtime have not been started or validated in this session.

---

## 7. Important Architectural Risks

* **Schema Drift Risk:** Raw migrations in `supabase/migrations/` vs. `prisma/schema.prisma` can drift if DDL changes are added without running `npm run prisma:drift:scoped`.
* **Dual-Store Synchronization Risk:** Operating two datastores (Supabase and Firestore) during active migration requires ensuring write-integrity and avoiding stale reads in transitional services.
