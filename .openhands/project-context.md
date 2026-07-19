# Project Context

This file provides persistent context for all OpenHands agent sessions.

---

## Project Overview

**Project:** Sri Raghavendra Swamy Matha Website (Rayaramathaynk)
**Type:** Temple management system with public-facing website and AI assistant
**Repository:** https://github.com/ngowda759/Rayaramathaynk

### Core Features
- Public website with event listings, gallery, donations
- Admin dashboard for content management
- Raya AI - temple AI assistant (English + Kannada)
- Panchanga calendar integration
- Seva booking system

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [AGENTS.md](../AGENTS.md) | AI agent contract - read first! |
| [docs/CODING-STANDARDS.md](../docs/CODING-STANDARDS.md) | How code should be written |
| [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) | How project is designed |
| [docs/AI-GUIDELINES.md](../docs/AI-GUIDELINES.md) | How Raya AI should behave |
| [docs/DATA-MODEL.md](../docs/DATA-MODEL.md) | Firestore collections |
| [docs/ADMIN-GUIDELINES.md](../docs/ADMIN-GUIDELINES.md) | Admin UI patterns |
| [docs/UI-GUIDELINES.md](../docs/UI-GUIDELINES.md) | Visual design standards |
| [docs/CONTENT-GUIDELINES.md](../docs/CONTENT-GUIDELINES.md) | Content standards |
| [docs/SECURITY.md](../docs/SECURITY.md) | Security policies |
| [docs/ROADMAP.md](../docs/ROADMAP.md) | Project evolution |

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + shadcn/ui |
| Animation | Framer Motion |
| Icons | Lucide React |
| Database | Firebase Firestore |
| Auth | Firebase Auth |
| Storage | Firebase Storage |
| AI | Hybrid retrieval (Firebase + LLM) |
| Deployment | Vercel |

---

## Key Patterns

### Data Access
```typescript
// ✅ Always use services
const events = await eventService.getAll();

// ❌ Never access Firestore directly
const snap = await firestore.collection('events').get();
```

### Components
```typescript
// ✅ Server Components by default
export default async function EventsPage() { ... }

// ❌ Client components only when needed
'use client';
export function EventCard() { ... }
```

### TypeScript
```typescript
// ✅ No any - use proper types
function getEvent(id: string): Promise<Event | null>

// ❌ Avoid any
function getEvent(id: any): any
```

---

## Development Commands

```bash
# Development
npm run dev

# Build
npm run build

# Lint
npm run lint

# Type check
npm run type-check

# Test
npm test
```

---

## Definition of Done

Every feature must satisfy:
- [ ] Code complete, no TODOs
- [ ] TypeScript strict compliance
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] Accessibility (ARIA, keyboard nav)
- [ ] Tests added/updated
- [ ] Build passes
- [ ] Lint passes
- [ ] Type check passes
- [ ] No console errors
- [ ] Backward compatible

---

## Current Version

**v1.5 — Intelligence** (Current)
- See [ROADMAP.md](../docs/ROADMAP.md) for details

---

*This context is auto-loaded for every OpenHands session.*
