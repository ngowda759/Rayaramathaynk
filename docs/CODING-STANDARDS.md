# Coding Standards

This document outlines the coding conventions and standards for this project.

## 📁 Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `EventCard.tsx` |
| Hooks | camelCase + `use` prefix | `useAuth.ts` |
| Services | `*.service.ts` | `event.service.ts` |
| Types/Interfaces | PascalCase | `types/event.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| Files (utils/helpers) | camelCase | `formatDate.ts` |

## 🏗️ Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication routes
│   ├── (public)/          # Public routes
│   ├── admin/             # Admin dashboard
│   └── api/               # API routes
├── components/            # Reusable UI components
│   ├── ui/                # Base UI components (shadcn/ui)
│   ├── admin/             # Admin-specific components
│   ├── events/            # Feature-specific components
│   └── layout/            # Layout components
├── services/              # Business logic & data fetching
├── types/                 # TypeScript type definitions
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and helpers
└── docs/                  # Documentation
```

## 📦 Component Guidelines

### Server vs Client Components

- **Default to Server Components** — better performance, SEO, and smaller bundles
- **Use `"use client"` only when needed:**
  - Event listeners (`onClick`, `onChange`, etc.)
  - `useState`, `useEffect`, `useRef`
  - Browser-only APIs
  - Third-party client libraries

### Component Structure

```tsx
// 1. Imports (external, then internal)
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import type { Event } from "@/types/event"

// 2. Type definitions (if component-specific)
interface EventCardProps {
  event: Event
  variant?: "default" | "compact"
}

// 3. Component definition
export function EventCard({ event, variant = "default" }: EventCardProps) {
  // 4. Hooks (if client component)
  // 5. Logic
  // 6. Render
  return (
    <div className="...">
      {/* ... */}
    </div>
  )
}
```

## 🛡️ TypeScript Guidelines

- **No `any`** — use `unknown` for truly unknown types
- **Explicit return types** for functions exported from modules
- **Use `interface` for object shapes** — `type` for unions/intersections
- **Leverage type inference** for local variables

```tsx
// ✅ Good
function getEventById(id: string): Promise<Event | null> { ... }
interface UserProfile { name: string; email: string }

// ❌ Avoid
function getEventById(id: any): any { ... }
const user: any = getUser()
```

## 🎨 Styling Guidelines

- **Use Tailwind CSS** — configured in `components.json`
- **Use design tokens** from `lib/formStyles.ts` for consistent theming
- **Mobile-first responsive design** — `sm:`, `md:`, `lg:`, `xl:` prefixes
- **Avoid arbitrary values** — use predefined spacing/color tokens

## 🧪 Testing Guidelines

- **Unit tests**: Components and utility functions in `tests/unit/`
- **Integration tests**: API routes, services in `tests/functional/`
- **E2E tests**: User flows in `tests/*.spec.ts`
- **Naming**: `*.test.ts` or `*.spec.ts`

## ✅ Pre-commit Checklist

Before every commit, verify:

1. [ ] `npm run build` succeeds
2. [ ] `npm run lint` passes
3. [ ] `npm run type-check` passes
4. [ ] All tests pass
5. [ ] No console.log statements
6. [ ] No hardcoded secrets or credentials
7. [ ] Types are properly defined (no `any`)
