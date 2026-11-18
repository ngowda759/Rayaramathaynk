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
5. **`docs/DATA-MODEL.md`** — Database tables and schemas
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

## 📝 Mandatory Planning Phase

**Before writing or modifying any code, produce an implementation plan that includes:**

### 1. Objective
- Clear statement of what needs to be accomplished
- Success criteria
- Non-functional requirements (performance, accessibility, etc.)

### 2. Existing Modules to Be Reused
- List components, services, hooks, utilities that will be reused
- Explain how each will be used

### 3. Files to Be Modified
- List existing files that need changes
- Brief description of changes per file

### 4. New Files to Be Created
- List new files (if any)
- Purpose of each file
- Where it fits in the architecture

### 5. Impact Analysis
- Effects on existing features
- Database schema changes (if any)
- API changes
- Breaking changes assessment

### 6. Risks
- Technical risks
- Compatibility risks
- Performance concerns

### 7. Assumptions
- What is assumed to be true
- Dependencies on external systems

### 8. Testing Strategy
- Unit tests
- Integration tests
- Manual testing steps
- Edge cases to verify

---

> ⚠️ **Do not begin implementation until this analysis is complete.**

> ⚠️ **If the task would violate the documented architecture or standards, explain why and propose an alternative instead of proceeding.**

---

## ⚖️ Decision Validation

**When there are multiple valid implementation approaches:**

1. **Compare at least two approaches**
   - List pros and cons of each approach

2. **Explain why the chosen approach is preferred**
   - Align with repository architecture
   - Consider maintainability
   - Consider long-term scalability

3. **Select the solution that best aligns with:**
   - Repository architecture
   - Maintainability
   - Long-term scalability

---

> ⚠️ **Do not choose an approach solely because it is the quickest to implement.**

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
| Backend | Supabase (Auth, PostgreSQL, Storage) |
| AI | Hybrid retrieval (Supabase + LLM fallback) |
| Deployment | Vercel |

---

## 🏛️ Architecture Principles

1. **Server Components First** — Default to Server Components for performance and SEO
2. **Repository Pattern** — All data access through services in `/services/`
3. **No Direct Supabase Calls** — Use services only
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
- Make direct Supabase calls — use services only
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
- **Use least privilege** — Supabase Row Level Security follows need-to-know
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
| Auth | Supabase Auth via `services/auth.service.ts` |
| Database | Supabase PostgreSQL via the service-role client |
| AI | Hybrid retrieval (see docs/AI-GUIDELINES.md) |
| Testing | Jest + Playwright |

---

## 📚 Required Reading

Before contributing, read these docs:

1. `docs/CODING-STANDARDS.md` — How code should be written
2. `docs/ARCHITECTURE.md` — How the project is designed
3. `docs/AI-GUIDELINES.md` — Raya AI guidelines
4. `docs/UI-GUIDELINES.md` — Visual design standards
5. `docs/DATA-MODEL.md` — Database tables and schemas

---

## 📊 Completion Report

**When implementation is finished, provide a completion report that includes:**

### 1. Summary of Changes
- Brief description of what was implemented
- Problem solved
- Feature delivered

### 2. Files Modified
- List all existing files that were modified
- Brief description of changes per file

### 3. New Files Created
- List all new files
- Purpose of each file
- Line count

### 4. Architecture Decisions
- Key decisions made during implementation
- Trade-offs considered
- Why the chosen approach was preferred

### 5. Backward Compatibility Impact
- Effects on existing functionality
- Migration requirements (if any)
- Breaking changes (if any)

### 6. Documentation Updated
- List documentation files updated
- Changes made to each

### 7. Remaining Limitations (if any)
- Known issues
- Features not implemented
- Scope cut

### 8. Recommended Future Improvements
- Enhancements for future consideration
- Technical debt to address
- Performance optimizations

---

> ✅ **Provide this completion report when marking a task as complete.**

---

# 🦸 Superpowers Engineering Workflow (v7.0.2)

**Purpose:** Integrate the Superpowers plugin into the existing Rayaramathaynk engineering contract.

Superpowers supplements this repository's existing instructions. It does not replace, override, weaken, or bypass any existing architectural, coding, security, testing, documentation, or deployment requirements.

## 1. Mandatory Skill Discovery

At the beginning of every development task:

- Invoke `using-superpowers` to establish the available workflow.
- Identify the applicable Superpowers skills.
- Use the installed Superpowers skills rather than manually improvising an equivalent process.
- If a required skill is unavailable, explicitly report the limitation and follow the existing repository contract.

Installed version: Superpowers 7.0.2.

## 2. Requirement Analysis and Brainstorming

For new features, architectural changes, significant enhancements, and design decisions:

- Invoke `brainstorming` before implementation.
- Understand the business objective and acceptance criteria.
- Inspect existing implementations and reusable modules.
- Evaluate at least two viable approaches when multiple approaches exist.
- Explain trade-offs and recommend the approach best aligned with repository architecture.
- Obtain clarification or approval when requirements or architectural decisions require user input.

Do not use brainstorming to bypass the mandatory planning requirements already established in this file.

## 3. Mandatory Implementation Planning

Before changing application code:

- Invoke `writing-plans`.
- Produce the complete implementation plan required by this AGENTS.md.
- Break work into small, independently verifiable steps.
- Identify affected files, dependencies, risks, regression scenarios and validation commands.
- Identify database and migration implications.
- Ensure all changes respect the existing architecture.

Do not start implementation until the mandatory planning phase is complete.

## 4. Test-Driven Development

Use `test-driven-development` for feature development and bug fixes.

Follow the cycle:

1. RED: Write a test demonstrating the expected behavior or regression.
2. GREEN: Implement the minimum change needed to pass.
3. REFACTOR: Improve implementation while keeping tests passing.

Requirements:

- Add regression tests for identified bugs.
- Cover relevant edge cases and failure scenarios.
- Use existing test infrastructure and repository conventions.
- Do not weaken or remove existing tests merely to make a change pass.
- Do not claim test coverage without actual test evidence.

## 5. Systematic Debugging

Whenever unexpected behavior, test failures, or production defects are encountered:

- Invoke `systematic-debugging`.
- Reproduce the issue.
- Gather evidence.
- Identify the underlying root cause.
- Evaluate potential contributing factors.
- Implement a targeted correction.
- Add regression coverage.

Avoid speculative patches, unrelated refactoring, and repeated changes without evidence.

## 6. Implementation Execution

Use the appropriate execution skill:

- `executing-plans` for sequential implementation.
- `subagent-driven-development` for suitable independent implementation tasks.
- `dispatching-parallel-agents` for genuinely independent work.
- `using-git-worktrees` when isolation is beneficial.

All execution must follow existing repository conventions.

Requirements:

- Keep changes focused and minimal.
- Reuse existing components, services, utilities and types.
- Maintain backward compatibility.
- Never bypass the service/repository architecture.
- Never introduce unnecessary dependencies.
- Keep application changes separate from unrelated formatting or cleanup.

Parallel agents must not independently modify the same files without coordination.

## 7. Verification Before Completion

Always invoke `verification-before-completion` before reporting implementation as complete.

Run applicable checks and inspect their actual output.

Baseline validation:

```bash
npm run type-check
npm run lint
npm run build
```

Also run relevant:

- Unit tests.
- Integration tests.
- End-to-end tests.
- Security checks.
- Migration validation, where applicable.
- Accessibility and responsive UI checks, where applicable.

Requirements:

- Report commands actually executed.
- Report passed, failed, skipped and blocked checks separately.
- Investigate failures rather than hiding them.
- Never claim a successful build or test without evidence.
- Distinguish locally verified behavior from production-verified behavior.

## 8. Independent Code and Security Review

For significant changes, invoke:

- `requesting-code-review`
- `receiving-code-review`

Review must independently evaluate:

- Architectural consistency.
- Security and authorization.
- Authentication and access control.
- Supabase RLS and data integrity.
- Input validation and error handling.
- Performance and scalability.
- Backward compatibility.
- Test quality.
- Accessibility and responsive behavior.

Address material findings before considering the implementation ready.

For security-sensitive changes, obtain an explicit security-focused review rather than relying solely on the implementation agent's self-assessment.

## 9. Git, Branch and Pull Request Discipline

For application code changes:

- Use a dedicated, appropriately named feature or fix branch.
- Keep commits focused and descriptive.
- Do not commit unrelated changes.
- Do not overwrite or discard existing user changes.
- Prepare a pull request with a clear title, implementation summary, testing evidence and relevant screenshots.
- Verify applicable CI checks before requesting completion.

Use `finishing-a-development-branch` when implementation and verification are complete.

## 10. Explicit User Approval and Production Safety

The following operations ALWAYS require explicit user approval:

- Merging a pull request.
- Deploying to production.
- Executing production database migrations.
- Modifying production database records.
- Running production seed or initialization scripts.
- Changing production authentication, authorization or security configuration.
- Deleting production data or resources.

Additional requirements:

- Never infer approval from a general request to implement a feature.
- Never perform destructive or irreversible operations without approval.
- Prefer read-only production diagnostics.
- Clearly explain the expected impact and rollback strategy before requesting approval.
- Stop and wait for approval before performing the operation.

Creating a feature branch, implementing approved code changes, running local tests and preparing a PR do not authorize production operations or PR merging.

## 11. Mandatory Completion Report

Every completed development task must follow the existing completion-report format in this AGENTS.md.

Additionally include:

- Superpowers skills invoked.
- Implementation plan completed.
- Tests added or modified.
- Actual verification commands and results.
- Independent review findings and resolutions.
- CI and PR status.
- Any operations requiring further user approval.
- Remaining risks or limitations.

Never mark incomplete or unverified work as complete.

## 12. Priority and Conflict Resolution

The following priority applies:

1. Explicit user instructions and approvals.
2. Existing repository security and architectural requirements.
3. Existing AGENTS.md development contract.
4. Relevant repository documentation.
5. Superpowers workflow recommendations.

Superpowers must always operate within the repository's established engineering contract.

If a skill recommendation conflicts with an existing repository requirement, follow the repository requirement and explain the conflict.

---

**Final principle:**

Understand → Brainstorm → Plan → Test → Implement → Debug → Verify → Review → PR → Obtain approval for integration and production operations.

Quality, security, data integrity and maintainability take priority over implementation speed.
