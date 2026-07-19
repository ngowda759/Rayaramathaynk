# Code Review Checklist

Use this checklist when reviewing code changes or before committing.

---

## Pre-Commit Checklist

### Code Quality

- [ ] **No TODOs or placeholders** in production code
- [ ] **No console.log statements** (use proper logging)
- [ ] **No commented-out code** (delete instead)
- [ ] **No hardcoded values** (use constants/config)
- [ ] **No secrets or credentials** in code
- [ ] **Proper error handling** in place
- [ ] **Types are defined** for all props and return values
- [ ] **No `any` types** — use proper type definitions

### TypeScript

- [ ] **Strict mode compliant** — run `npm run type-check`
- [ ] **Explicit return types** for exported functions
- [ ] **Interfaces used** for object shapes
- [ ] **Union types** for discrete values
- [ ] **No type assertions** without good reason

### React Components

- [ ] **Server Components by default** — only use `"use client"` when needed
- [ ] **Props properly typed**
- [ ] **Loading states** for async operations
- [ ] **Error boundaries** where appropriate
- [ ] **Accessibility** — ARIA labels, semantic HTML

### Styling

- [ ] **Tailwind CSS** — no inline styles
- [ ] **Responsive design** — works on mobile, tablet, desktop
- [ ] **Design tokens** — use established spacing, colors
- [ ] **No arbitrary values** — use predefined tokens

### Testing

- [ ] **Unit tests** for utility functions
- [ ] **Component tests** where appropriate
- [ ] **Test coverage** not significantly decreased
- [ ] **Tests pass** — run `npm test`

### Validation

- [ ] **Build passes** — `npm run build`
- [ ] **Lint passes** — `npm run lint`
- [ ] **Type check passes** — `npm run type-check`
- [ ] **No console errors** in browser
- [ ] **No hydration mismatches**

---

## Pull Request Checklist

### Description

- [ ] **Title** is clear and descriptive
- [ ] **Description** explains what and why
- [ ] **Screenshots/recordings** for UI changes
- [ ] **Breaking changes** documented
- [ ] **Related issues** linked

### Code Changes

- [ ] **Focused changes** — one feature/fix per PR
- [ ] **No unrelated changes**
- [ ] **Consistent formatting** (prettier)
- [ ] **Descriptive commit messages**

### Review

- [ ] **Self-review** completed
- [ ] **Code reviewed** by team (if required)
- [ ] **Documentation updated** (if needed)
- [ ] **Tests added/updated**

---

## AI-Specific Review

When reviewing AI-related code:

### Intent Detection

- [ ] **Keywords properly defined** in patterns.ts
- [ ] **Language support** for en/kn/mixed
- [ ] **Confidence thresholds** appropriate
- [ ] **Fallback handling** in place

### Retrieval

- [ ] **No hallucinations** — data from Firebase
- [ ] **Proper error handling** for missing data
- [ ] **Source citations** included
- [ ] **Fallback chain** works correctly

### Response Generation

- [ ] **Response templates** properly formatted
- [ ] **Language detection** working
- [ ] **Error responses** user-friendly
- [ ] **Rate limiting** in place

---

## Security Review

### Data Handling

- [ ] **Input validation** on all user inputs
- [ ] **Output sanitization** for XSS prevention
- [ ] **No secrets** in client code
- [ ] **Proper authorization** checks

### AI Safety

- [ ] **Prompt injection** prevention
- [ ] **Input sanitization** for user messages
- [ ] **Output validation** for AI responses
- [ ] **Rate limiting** on AI endpoints

---

## Performance Review

### Bundles

- [ ] **No unnecessary dependencies**
- [ ] **Dynamic imports** for large components
- [ ] **Tree-shaking** working
- [ ] **Bundle size** not significantly increased

### Runtime

- [ ] **No memory leaks** (event listeners cleaned up)
- [ ] **Efficient queries** (indexes used)
- [ ] **Caching** where appropriate
- [ ] **Lazy loading** for below-fold content

---

*Use this checklist before every commit and PR.*
