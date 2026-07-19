<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 🏛️ Default Engineering Standards

These standards are **always assumed** for any feature or enhancement. All contributors and AI agents must follow these guidelines.

## 📋 Before Writing Code

- [ ] **Review existing codebase** before making changes — understand patterns, conventions, and existing solutions
- [ ] **Follow existing architecture** and coding conventions
- [ ] **Reuse existing components and services** where possible — avoid reinventing the wheel
- [ ] **Read relevant documentation** in `docs/`, `types/`, and service files for context

## 🛠️ Code Quality

- [ ] **Production-ready code only** — no placeholders, TODOs, or skeleton implementations
- [ ] **Full TypeScript type safety** — avoid `any`, use proper interfaces and types
- [ ] **Maintain backward compatibility** — don't break existing functionality
- [ ] **Follow naming conventions:**
  - Components: `PascalCase` (e.g., `EventCard.tsx`)
  - Hooks: `camelCase` (e.g., `useAuth.ts`)
  - Services: `*.service.ts` (e.g., `event.service.ts`)
  - Types: `types/` directory
  - Constants: `lib/constants.ts`

## 🎨 UI/UX & Design

- [ ] **Responsive design** — work across desktop, tablet, and mobile
- [ ] **Accessibility (a11y)** — semantic HTML, ARIA labels, keyboard navigation
- [ ] **SEO best practices** — proper meta tags, structured content, semantic markup
- [ ] **Performance optimization** — minimize bundle size, lazy loading, image optimization
- [ ] **Avoid regressions** — test visual consistency

## 🧪 Testing & Validation

- [ ] **Add or update tests** as appropriate (unit, integration, e2e)
- [ ] **Verify zero errors:**
  - Build passes
  - Lint passes
  - TypeScript compiles without errors
  - No hydration mismatches
  - No console errors
- [ ] **Validate complete user flow** — end-to-end testing of new features
- [ ] **Run existing test suite** — ensure no regressions

## 🚀 Before Merging/Pushing

- [ ] **Thoroughly verified** — all checks pass locally
- [ ] **Clean git state** — no unnecessary files staged
- [ ] **Descriptive commit messages** — explain *why*, not just *what*
- [ ] **No secrets or credentials** committed accidentally

## 📝 Documentation

- [ ] **Document new configuration** only when necessary
- [ ] **Document seed data** if it affects behavior
- [ ] **Update relevant docs** in `docs/` when adding significant features

---

## 🔍 Quick Reference

| Category | Standard |
|----------|----------|
| TypeScript | Strict mode, no `any` |
| Components | Server Components by default, client only when needed |
| Styling | Tailwind CSS via `components.json` |
| State | Server Components + React Context, avoid prop drilling |
| Data Fetching | Server Components or Server Actions |
| API | REST via Next.js Route Handlers in `app/api/` |
| Auth | Firebase Auth via `services/auth.service.ts` |
| Database | Firestore via admin SDK for server-side |
| Testing | Jest + Playwright |
| Linting | ESLint with Next.js rules |
