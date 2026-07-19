<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 🚀 Repository Onboarding Instructions

**Before starting any task, you must understand the repository before making changes.**

---

## 📚 Required Reading Order

Read these documents **in order** before implementing any feature, enhancement, bug fix, or refactoring:

1. **`AGENTS.md`** ← *(You are here)*
2. **`docs/ARCHITECTURE.md`** — System design and data flow
3. **`docs/CODING-STANDARDS.md`** — Code style and conventions
4. **`docs/UI-GUIDELINES.md`** — Visual design standards
5. **`docs/DATA-MODEL.md`** — Firestore collections and schemas
6. **`docs/ADMIN-GUIDELINES.md`** — Admin UI patterns
7. **`docs/AI-GUIDELINES.md`** — *(When modifying Raya AI)*
8. **`docs/CONTENT-GUIDELINES.md`** — Content standards
9. **`docs/SECURITY.md`** — Security policies

These documents are the **authoritative source of truth**. If implementation conflicts with documentation, follow the documentation instead of assumptions.

---

## 💡 Development Philosophy

**Always extend the existing system.**

Do not replace, rewrite, duplicate, or bypass existing architecture unless explicitly instructed.

Your objective is to improve the platform while preserving **consistency**, **maintainability**, and **backward compatibility**.

---

## 📋 Before Writing Code

- [ ] **Understand the business objective**
- [ ] **Review the existing implementation**
- [ ] **Identify reusable components**, services, hooks, utilities, and patterns
- [ ] **Identify the impact** on existing features
- [ ] **Ask for clarification** only if a requirement is genuinely ambiguous

---

## 🎯 Implementation Principles

### Always:

- Follow the established architecture
- Reuse existing components and services
- Follow repository coding standards
- Maintain consistency with the existing UI and UX
- Keep implementations modular and scalable
- Design for future extensibility
- Avoid introducing technical debt

### Never:

- Create duplicate implementations
- Hardcode configuration or business logic
- Use shortcuts that bypass architecture
- Introduce breaking changes
- Ignore existing patterns because they appear "simpler"

---

## ✅ Definition of Done

A task is complete **only** when:

- [ ] Functional requirements are **fully implemented**
- [ ] Existing functionality **continues to work**
- [ ] The feature **integrates naturally** with the rest of the platform
- [ ] Any required **documentation is updated**
- [ ] The implementation is **production-ready**

> ⚠️ **Do not consider a task complete simply because the requested functionality appears to work.**

---

## 🏗️ Architectural Mindset

When implementing new functionality:

- **Prefer extending existing modules** over creating new ones
- **Build reusable components**
- **Design for future growth**
- **Keep business logic separated** from presentation
- **Keep the admin experience consistent** across all modules
- **Ensure Raya AI can leverage new knowledge** where appropriate

---

## 📤 Expected Output

Every completed implementation should **leave the repository in a better state** than before, with improved:

- ✅ Maintainability
- ✅ Consistency
- ✅ Extensibility

**Not just additional code.**

---

## 📖 Documentation Authority

If this repository contains documentation under `/docs/`, those documents are the **authoritative source of truth** and **must be read** before making implementation decisions.

---

---

# 🤖 AI Agent Contract

**This is the first file every AI coding agent must read.**
Answers: "How should an AI contribute to this repository?"

---

## 📖 Project Overview

**Project:** Sri Raghavendra Swamy Matha Website (Rayaramathaynk)
**Type:** Temple management system with public-facing website and admin dashboard
**Core Features:** Event management, Seva bookings, donations, gallery, AI assistant (Raya AI), Panchanga calendar

### Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| Icons | Lucide React |
| UI Components | shadcn/ui |
| Backend | Firebase (Auth, Firestore, Storage) |
| AI | Hybrid retrieval (Firebase + LLM fallback) |
| Deployment | Vercel |

---

## 🏛️ Architecture Principles

1. **Server Components First** — Default to Server Components for performance and SEO
2. **Repository Pattern** — All data access through services in `/services/`
3. **No Direct Firebase Calls** — Use services only
4. **Structured Retrieval for AI** — Facts from repositories, not LLM knowledge
5. **Mobile-First** — Responsive design across all breakpoints

---

## 📋 Before Writing Code

- [ ] **Review existing codebase** — understand patterns, conventions, existing solutions
- [ ] **Follow existing architecture** — don't deviate without discussion
- [ ] **Reuse existing components** — check `components/` and `services/` first
- [ ] **Read relevant docs** — check `docs/` for architecture, API, and guidelines
- [ ] **Check types** — understand type definitions in `types/`

---

## ✅ Definition of Done

Every feature/enhancement must satisfy:

- [ ] **Code Complete** — All functionality implemented, no placeholders or TODOs
- [ ] **Type Safe** — No `any` types, proper TypeScript strict mode compliance
- [ ] **Responsive** — Works on mobile, tablet, and desktop
- [ ] **Accessible** — Semantic HTML, ARIA labels, keyboard navigation
- [ ] **Tested** — Unit/integration tests added or updated
- [ ] **Builds** — `npm run build` succeeds
- [ ] **Lints** — `npm run lint` passes
- [ ] **Types Check** — `npm run type-check` passes
- [ ] **No Hydration Errors** — Server/client markup must match
- [ ] **No Console Errors** — Production-ready error handling
- [ ] **Documented** — Update docs if adding significant features
- [ ] **Backward Compatible** — Existing functionality not broken

---

## 📁 File Structure

```
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication routes
│   ├── (public)/          # Public routes
│   ├── admin/             # Admin dashboard
│   ├── calendar/          # Calendar pages
│   └── api/               # API routes
├── components/            # Reusable UI components
│   ├── ui/                # Base UI (shadcn/ui)
│   ├── admin/             # Admin-specific
│   ├── events/            # Feature-specific
│   └── layout/            # Layout components
├── services/              # Business logic & data fetching
├── types/                 # TypeScript type definitions
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and AI modules
└── docs/                  # Documentation
```

---

## 🎯 Do's and Don'ts

### ✅ Do

- Use existing components from `components/ui/`
- Follow naming conventions (see CODING-STANDARDS.md)
- Add types for all props and return values
- Use Server Components by default
- Handle loading and error states
- Optimize images with next/image
- Use the `lib/formStyles.ts` design tokens

### ❌ Don't

- Use `any` type — use `unknown` for truly unknown types
- Make direct Firebase calls — use services only
- Create duplicate components — check existing first
- Leave console.log statements
- Hardcode credentials or secrets
- Skip error handling
- Use inline styles — use Tailwind classes

---

## 🔧 Development Workflow

1. **Understand** — Review codebase, read relevant docs
2. **Plan** — Break down into minimal, focused changes
3. **Implement** — Follow conventions, reuse components
4. **Test** — Verify locally, add tests
5. **Validate** — Build, lint, type-check
6. **Commit** — Descriptive commit message
7. **Push** — Only after all validation passes

---

## 🧪 Testing Expectations

| Type | Location | When |
|------|----------|------|
| Unit | `tests/unit/` | Utility functions, components |
| Integration | `tests/functional/` | API routes, services |
| E2E | `tests/*.spec.ts` | User flows |

**Run before commit:**
```bash
npm run build && npm run lint && npm run type-check
```

---

## 🔐 Security Requirements

- **Never commit secrets** — Use environment variables
- **Validate all inputs** — Server-side validation required
- **Use least privilege** — Firebase rules follow need-to-know
- **Sanitize data** — Escape user content before display
- **HTTPS only** — All external requests must be secure

---

## ⚡ Performance Expectations

- **First Contentful Paint** < 1.5s
- **Largest Contentful Paint** < 2.5s
- **Bundle size** — Keep client components minimal
- **Images** — Always use `next/image` with proper sizing
- **Caching** — Leverage ISR and client caching

---

## 📝 Pull Request Requirements

PRs should include:

- **Title** — Clear, concise description
- **Description** — What, why, and how
- **Testing** — How the feature was tested
- **Screenshots** — UI changes
- **Breaking Changes** — If any
- **Related Issues** — Link to issues

---

## 🔍 Quick Reference Table

| Category | Standard |
|----------|----------|
| TypeScript | Strict mode, no `any` |
| Components | Server Components default, `"use client"` when needed |
| Styling | Tailwind CSS |
| State | Server Components + React Context |
| Data | Services in `/services/`, types in `/types/` |
| API | Route Handlers in `app/api/` |
| Auth | Firebase Auth via `services/auth.service.ts` |
| Database | Firestore via admin SDK |
| AI | Hybrid retrieval (see docs/AI-GUIDELINES.md) |
| Testing | Jest + Playwright |

---

## 📚 Required Reading

Before contributing, read these docs:

1. `docs/CODING-STANDARDS.md` — How code should be written
2. `docs/ARCHITECTURE.md` — How the project is designed
3. `docs/AI-GUIDELINES.md` — Raya AI guidelines
4. `docs/UI-GUIDELINES.md` — Visual design standards
5. `docs/DATA-MODEL.md` — Firestore collections and schemas
