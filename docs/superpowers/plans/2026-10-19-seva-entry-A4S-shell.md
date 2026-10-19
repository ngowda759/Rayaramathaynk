# Seva Entry - Wave A4S: Seva Entry gets its own screens

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Written 2026-10-19 (Monday), against the worktree at `2a8a4ed` (A4P closed).

**Goal:** Seva Entry opens at its own address, `/seva`, inside the same website, with its own header, its own
section menu, and a full-screen counter. It keeps the same sign-in, the same APIs and the same data.

**Architecture:** The 52 route files under `app/admin/receipts/**` and `app/admin/prasadam/**` move with `git mv`
into `app/seva/`, under two route groups:
- `(counter)` is the full-screen counter frame.
- `(desk)` is the frame with the header and the section rail.

One constant, `lib/seva/routes.ts`, names every address. `next.config.ts` forwards the old addresses and keeps the
query. Page bodies, components, hooks, APIs and the database do not change.

**Tech Stack:** Next.js 16.2.10 App Router (route groups, layouts, templates, `redirects()`), React 19, the existing
`framer-motion` layer from A4P-1, Tailwind with the module tokens in `styles/seva/tokens.css`, Jest and Playwright.

**Spec:**
- The owner's decisions on desk deck `shell` (2026-10-19, `$STATE/DECISIONS.md`):
  - choice B: own screens at `/seva` in the same website
  - when = now
  - counter = focus
- The approved look: `$STATE/desk/mockups/shell.html`, with four views:
  - temple admin on a desktop
  - receptionist at the counter
  - two phones
  - the website admin's single menu item
- The plan brief: `$STATE/briefs/build/A4S-PLAN-BRIEF.md`.
- The Design Book `docs/seva/DESIGN-BOOK.md` still governs everything else. Its wording is updated in A5-2; the list
  is at the end of this plan.

## Global Constraints

- Standing rules: `$STATE/briefs/build/BUILD-RULES.md`.
  - `cd` into the worktree in every command.
  - Commit with `-- <paths>`.
  - Run no Playwright and no `npm run build` unless the task says so.
  - The boundary rule is strict.
- No new package. Use the existing `framer-motion` ^12.42.0 and the A4P-1 primitives:
  - `SevaLink`, `RouteProgress`, `RoutePending`, `PendingButton`, `MotionDialog` and `pageVariants`
  - `SPRING` = 380 / 22 / 1
- Animate only `transform` and `opacity`. Respect `prefers-reduced-motion`.
- Every label is English with Kannada under it (`Bilingual`, `Bi`). Kannada added in this wave is proposed text for
  the temple office's proof-read (O-03).
- Use the module tokens only, never fixed colours. The colours come from the approved mockup:
  - **Desk header:** `--card`.
  - **Counter header:** `--maroon` with white text. The small line under the temple name uses `--gold-light`.
  - **Current rail item:** `--primary-soft`, with an inset 3 px `--primary-press` bar.
  - **Sign out:** outlined in `--maroon` (white on the counter header).
- The tap target is at least 44 px. The keyboard order follows the screen: header, then rail, then content.
- The counter's keyboard map, the focus after a save, and every existing test stay as they are.
- `/r/<token>` (the slip QR codes) and every `/api/seva/*` address stay unchanged.
- The old Firestore API `/api/admin/receipts/**` is not touched. A5-1 removes it.
- Next 16 allows one `next dev` per project (lockfile; `02-guides/upgrading/version-16.md`, "Concurrent dev and
  build"). The owner's site runs from this worktree on :3000. Never stop it, and never start another dev server. Only
  the orchestrator stops it, with the owner's OK, before a Playwright run.

## Review Focus

These five cases are not in the spec, and are the most likely to hurt a person using the screens. Each has its test
in the task that owns the code.

1. **A signed-out person opens a deep `/seva` link** (a bookmark, or the installed counter after the session ended).
   They should come back to that page after signing in, not to `/admin`. Today `AdminAuthGuard` sends everyone to
   `/login?redirect=/admin`. Tests: A4S-2 (guard) and A4S-6 (e2e).
2. **An old bookmark with a receipt id and a query**, for example `/admin/receipts/<uuid>/print?copy=1` or
   `/admin/receipts/register?status=changed`. It should open the same page under `/seva` with the same query. Tests:
   A4S-1 (rules) and A4S-6 (e2e).
3. **The counter PC already has the app installed from the old address.** The old service worker at
   `/admin/receipts/counter` must not keep serving a stale page, and the new counter must still open offline. Test:
   A4S-4.
4. **A person with no seva role** (billing, priest, staff), or **a seva profile that is still loading or failed**,
   opening `/seva`. They should see the header with Sign out, no section items, and the page's own "no access"
   message, never a blank or crashed frame. Test: A4S-2.
5. **Printing a page that is not a slip**: the board summary, the day-close summary and the receipt print page. The
   page should print without the header, the rail or the phone bar. Test: A4S-2 (the frame parts are `print:hidden`).

## Decisions (two approaches compared each time)

- **`app/seva/` or `app/(seva)/seva/`.**
  - The advisor proposed an outer `(seva)` group. It would have no layout of its own and would only add a folder
    level.
  - **Chosen:** `app/seva/`. The two inner groups do the real work.
- **One client layout that switches the frame on `usePathname()`, or two route groups.**
  - A switch would need a list of counter paths kept in sync by hand. It would also render the wrong frame for a
    moment on a slow profile.
  - **Chosen:** route groups. The folder decides the frame (`app/seva/(counter)/layout.tsx` and
    `app/seva/(desk)/layout.tsx`).
  - Moving between groups does not reload the page, because there is only one root layout (`route-groups.md`,
    caveats).
  - The page template moves into each group. Otherwise it would remount the frame on every move.
- **Forwarding in `next.config.ts` `redirects()`, in `proxy.ts`, or with redirect pages.**
  - Config redirects are checked before the filesystem, and they keep the query (`redirects.md`). They need no
    code.
  - `proxy.ts` would add work to every request. Redirect pages would mean 23 more files.
  - **Chosen:** `redirects()`, with three literal rules. `next.config.ts` does not import `lib/seva/routes.ts`,
    because module resolution in `next.config.ts` is limited (`05-config/02-typescript.md` line 110), and a failed
    import would stop the server. A unit test pins the rules to `SEVA_ROUTES`.
  - The rules use `permanent: false` (307) until go-live. A cached 308 would outlive a revert while the owner is still
    reviewing.
- **Staff: a link to `/admin/users`, or a re-export at `/seva/staff`.**
  - A re-export would put the website's Users page, with its "All accounts" tab, inside the module frame.
  - **Chosen:** the rail links to `/admin/users`, and the page opens in the website admin. There is one
    implementation, as the brief allows.
- **The counter app's manifest `id`: keep it or change it.**
  - Keeping `/admin/receipts/counter` would leave an address that no longer exists as the app's identity.
  - **Chosen:** `/seva/counter`. Today the app is installed only for testing, on the owner's PC, so he installs it
    once more (gate step).
- **Who owns the new shell strings.** Run 2 has three tasks that need new words. So A4S-1 adds all of them to
  `lib/seva/strings/shell.ts`, and no parallel task touches that file.

## How the runs go

| Run | Tasks (tier) | Runs after | Parallel? |
|---|---|---|---|
| 1 | A4S-1 Move, routes constant, forwarding (H) | A4P closed (`2a8a4ed`) | alone: every later task builds on the new tree |
| 2 | A4S-2 Module frames (H); A4S-3 Role landing and one website menu item (M); A4S-4 The installed counter moves (M); A4S-5 Links inside the seva components (S) | Run 1 merged | yes, on disjoint files (see each task's Files) |
| 3 | A4S-6 Browser tests at the new addresses, and the full run (H) | Run 2 merged | alone |
| Gate | Wave gate, then the owner's check | Run 3 | - |

After Run 1, every page works at `/seva`. Links that are not yet updated still work through the forwarding rules, so
the owner's running site never breaks between runs.

Tier key: **S** Sonnet, **M** Opus medium, **H** Opus high.

---

## Task A4S-1: Move the pages to /seva, one routes constant, the old addresses forward

Tier: **H** - 52 files move at once, every later task builds on the new tree, and a slip breaks every page.

**Files:**
- **Move** with `git mv`, so history is kept:
  - `app/admin/receipts/layout.tsx` -> `app/seva/layout.tsx`
  - `app/admin/receipts/template.tsx` -> `app/seva/template.tsx`. A4S-2 moves it into the groups.
  - `app/admin/receipts/counter/` (with `today/`) and `app/admin/receipts/day-close/` -> `app/seva/(counter)/counter/`
    and `app/seva/(counter)/day-close/`
  - everything else under `app/admin/receipts/` -> the same relative path under `app/seva/(desk)/`:
    - `page.tsx` and `loading.tsx`
    - `[receiptId]/**`
    - `create/`, `day-closes/`, `register/`, `seva-settings/`
    - `reports/**`, `settings/**`
  - `app/admin/prasadam/` -> `app/seva/(desk)/prasadam/`
  - Afterwards `app/admin/receipts/` and `app/admin/prasadam/` no longer exist.
- **Create:** `lib/seva/routes.ts`
- **Modify:**
  - `app/seva/layout.tsx`:
    - Wrap everything in `<Suspense>`, with the same fallback as `app/admin/layout.tsx`. `AdminAuthGuard` reads
      `useSearchParams`, and the build needs the boundary.
    - Keep `AdminAuthGuard requiredPermission="billing"`, `SevaMeProvider`, `SevaMotion`, the `.seva` div,
      `RouteProgress` and `PrintRoot`.
    - Put `<main id="main-content" tabIndex={-1}>` around `children`. This is the skip link's target, which
      `app/admin/layout.tsx` used to give.
  - `app/seva/(desk)/prasadam/layout.tsx`: keep only `AdminAuthGuard requiredPermission="sevaPrasadam"`. The
    providers now come from `app/seva/layout.tsx`; keeping them here would show two progress bars.
  - Every moved file that names an old address (32 files, 42 places). These are:
    - the dashboard's `router.replace` with `?period=` and its `COUNTER_PATH`
    - the print page's back link
    - `settings/page.tsx`'s redirect
    - the create page's links
    - the doc comments in the loading files

    Each one uses `SEVA_ROUTES`, `receiptPath` or `receiptPrintPath`.
  - `next.config.ts`: add `redirects()`.
  - `lib/seva/motion.ts`: the roots `RECEIPTS` and `PRASADAM` become `SEVA_ROUTES.dashboard` and
    `SEVA_ROUTES.prasadam`. The relative skeleton table stays as it is.
  - `lib/seva/strings/reports.ts` (`REPORTS.tabs[].href`) and `lib/seva/strings/settings.ts` (`SETTINGS_TABS[].href`):
    use the `SEVA_ROUTES` values.
  - `lib/seva/strings/shell.ts`: add the strings listed under Produces.
- **Test:**
  - **Create:**
    - `tests/unit/seva/routes.test.ts`
    - `tests/unit/seva/legacy-redirects.test.ts`
  - **Modify** (import paths, mocked `usePathname` values and expected addresses):
    - `loading-files.test.ts`: the root becomes `app/seva`, with the same rule (a folder with `page.tsx` has a
      `loading.tsx`)
    - `motion-foundation.test.tsx`, `dashboard-period.test.tsx`
    - `no-firestore-receipt-links.test.ts`: only the file paths
    - `prasadam-page.test.tsx`, `prasadam-result.test.tsx`
    - `receipt-detail.test.tsx`: the imports, the pathname, and the print page's back link
    - `receipt-pages-params.test.tsx`, `register-pending.test.tsx`, `reports-pending.test.tsx`,
      `reports-tabs.test.tsx`

    All of them are in `tests/unit/seva/`.

**Interfaces:**
- **Consumes:** `SevaRole` from `@/types/seva`.
- **Produces, in `lib/seva/routes.ts`:**
  - `SEVA_ROUTES`, an `as const` object:
    - `dashboard: '/seva'`
    - `counter: '/seva/counter'`, `today: '/seva/counter/today'`
    - `dayClose: '/seva/day-close'`, `dayCloses: '/seva/day-closes'`
    - `register: '/seva/register'`
    - `reports: '/seva/reports'`, `reportsFestival`, `reportsAudit`, `reportsExport`, `reportsSummary`
      (`/seva/reports/<name>`)
    - `sevaSettings: '/seva/seva-settings'`
    - `settings: '/seva/settings'`, plus `settingsReceipt`, `settingsCounters`, `settingsRules`,
      `settingsDenominations`, `settingsFestivalDays`, `settingsLists` (`/seva/settings/<folder name>`)
    - `prasadam: '/seva/prasadam'`
    - `create: '/seva/create'`
    - `staff: '/admin/users'`, `websiteAdmin: '/admin'`, `signIn: '/login'`
  - `receiptPath(receiptId: string): string` returns `/seva/${encodeURIComponent(receiptId)}`.
  - `receiptPrintPath(receiptId: string): string` returns `${receiptPath(id)}/print`.
  - `prasadamTokenPath(token: string): string` returns `/seva/prasadam?token=${encodeURIComponent(token)}`.
  - `isSevaPath(pathname: string): boolean` is true for `/seva` and `/seva/...` only.
  - `sevaHomePath(role: SevaRole | null | undefined): string` returns `counter` for `receptionist`, `prasadam` for
    `prasadam_counter`, and `dashboard` for everyone else.
  - `signInPath(returnTo: string): string` returns `/login?redirect=${encodeURIComponent(returnTo)}`.
- **Produces, in `lib/seva/strings/shell.ts`:**
  - `SHELL_NAV.sevaEntry` = `{ en: 'Seva Entry', kn: 'ಸೇವಾ ನಮೂದು' }`
  - `SHELL_FRAME: Record<..., Bi>` with:
    - `templeName` 'Sri Raghavendra Swamy Matha' / 'ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ'
    - `counterTitle` 'Seva Counter' / 'ಸೇವಾ ಕೌಂಟರ್'
    - `signOut` 'Sign out' / 'ಸೈನ್ ಔಟ್'
    - `signingOut` 'Signing out...' / 'ಸೈನ್ ಔಟ್ ಆಗುತ್ತಿದೆ...'
    - `websiteAdmin` 'Website admin' / 'ವೆಬ್‌ಸೈಟ್ ನಿರ್ವಹಣೆ'
    - `more` 'More' / 'ಇನ್ನಷ್ಟು'
    - `sectionsLabel` 'Seva Entry sections' / 'ಸೇವಾ ನಮೂದು ವಿಭಾಗಗಳು'
    - `opensWebsiteAdmin` 'Opens in the website admin' / 'ವೆಬ್‌ಸೈಟ್ ನಿರ್ವಹಣೆಯಲ್ಲಿ ತೆರೆಯುತ್ತದೆ'
- **Produces, in `next.config.ts` `redirects()`,** exactly these three rules:
  - `/admin/receipts` -> `/seva`
  - `/admin/receipts/:path+` -> `/seva/:path+`
  - `/admin/prasadam` -> `/seva/prasadam`

  Each rule has `permanent: false`. `headers()` is unchanged.
- **Behaviour kept:** `isSevaHref` and `skeletonFor` in `lib/seva/motion.ts` keep their signatures and now answer for
  `/seva` paths. `isSevaHref('/sevas')` is false: `/sevas` is the public seva page.

**Steps:**
- [ ] 1. Write the failing tests:
  - `routes.test.ts`:
    - `it('puts every Seva Entry page under /seva and keeps Staff at /admin/users')`: every value except `staff`,
      `websiteAdmin` and `signIn` satisfies `isSevaPath`.
    - `it('encodes the receipt id in receipt and print addresses')`: `receiptPath('a b/c')` is `'/seva/a%20b%2Fc'`
      and `receiptPrintPath('r1')` is `'/seva/r1/print'`.
    - `it('sends a receptionist to the counter, a prasadam volunteer to the prasadam page and everyone else to the dashboard')`.
      Cover `temple_admin`, `super_admin` and `null`.
    - `it('isSevaPath is true for /seva and below, false for /sevas, /seva-x and /admin/receipts')`.
    - `it('signInPath carries the page and its query')`:
      `signInPath('/seva/counter?x=1')` is `'/login?redirect=%2Fseva%2Fcounter%3Fx%3D1'`.
  - `legacy-redirects.test.ts` (import `nextConfig` from `@/next.config`):
    - `it('forwards /admin/receipts and every page below it to the same page under /seva, temporarily')`:
      `await nextConfig.redirects!()` equals the three rules.
    - `it('every page that was under /admin/receipts or /admin/prasadam has a page at its forwarded address')`.
      Keep a fixed list of the 23 old page addresses, with `[receiptId]` as a segment. Map each with the rules. Then
      scan `app/seva/**/page.tsx`, dropping `(group)` folders from each path, and the mapped address must be in the
      set.
    - `it('keeps the security headers on every path')`.
  - `motion-foundation.test.tsx`:
    - `it('skeletonFor and isSevaHref know the /seva pages')`. Use the cases on lines 38-44, rewritten to `/seva`.
    - Add `isSevaHref('/sevas') === false` and `isSevaHref('/admin/receipts') === false`.
- [ ] 2. Run them and see them fail. Run:
  `cd /d/Onboarding/Repos/POCs/seva-entry && npx jest --ci --watchman=false --forceExit tests/unit/seva/routes.test.ts tests/unit/seva/legacy-redirects.test.ts tests/unit/seva/motion-foundation.test.tsx`.
  Expected: FAIL, because `lib/seva/routes` is not found and `redirects` is undefined.
- [ ] 3. Run the `git mv` commands for the mapping above. Make the folders first with `mkdir -p 'app/seva/(counter)'
  'app/seva/(desk)'`, and quote every path that has brackets or parentheses.
- [ ] 4. Create `lib/seva/routes.ts`, add the redirects, the strings and the layout changes, and replace every old
  address in the moved files, `motion.ts` and the two tab lists. Then check with
  `git grep -nE "/admin/(receipts|prasadam)" -- app/seva lib/seva`. Expected: no output.
- [ ] 5. Update the import paths and expectations in the eleven unit test files listed above.
- [ ] 6. Refresh the generated route types, then run the type check:
  `npx next typegen && npm run typecheck`. Expected: 0 errors.
  - `next typegen` writes `.next/types`, which still names the old pages. It does not start a server.
  - If `typegen` refuses because of the dev lock, skip it.
  - Errors that are only in `.next/**` are generated files. The owner's running site rewrites `.next/dev/types`. List
    these errors as "generated, not mine".
- [ ] 7. Run the whole seva unit folder. This task touches every page, so the whole folder is in scope:
  `npx jest --ci --watchman=false --forceExit tests/unit/seva`. Expected: every suite passes.
- [ ] 8. Run `npx eslint <changed files>`. Expected: no errors.
- [ ] 9. Commit with the old and new folders in the path list, so the moves are recorded:
  `git commit -F <msg> -- app/admin/receipts app/admin/prasadam app/seva lib/seva/routes.ts lib/seva/motion.ts lib/seva/strings/reports.ts lib/seva/strings/settings.ts lib/seva/strings/shell.ts next.config.ts tests/unit/seva`.
  - Message: `refactor(seva): move Seva Entry pages to /seva with one routes constant and forwarding from the old addresses`.

**Note for the orchestrator:** the owner's site on :3000 reloads by itself. A change to `next.config.ts` restarts it
by itself. Tell him the screens now live at `/seva`.

## Task A4S-2: Module frames - header, section rail, phone bar and the full-screen counter

Tier: **H** - a new frame around every screen, with role-dependent parts, the skip link, keyboard order, print and
the motion layer.

**Files:**
- **Create:**
  - `components/seva/shell/sections.ts`
  - `components/seva/shell/SevaHeader.tsx`
  - `components/seva/shell/SectionRail.tsx`
  - `components/seva/shell/PhoneBar.tsx`
  - `components/seva/shell/DeskFrame.tsx`
  - `components/seva/shell/FocusFrame.tsx`
  - `components/seva/shell/PageTransition.tsx`: the body of today's template (`RoutePending` around an
    `m.div variants={pageVariants}`)
  - `app/seva/(desk)/layout.tsx`, which renders `<DeskFrame>{children}</DeskFrame>`
  - `app/seva/(counter)/layout.tsx`, which renders `<FocusFrame>{children}</FocusFrame>`
  - `app/seva/(counter)/template.tsx`, which is `export { PageTransition as default }`
- **Move:** `git mv app/seva/template.tsx 'app/seva/(desk)/template.tsx'`, and reduce it to the same re-export.
- **Modify:**
  - `app/seva/layout.tsx`:
    - Its `<main>` moves into the frames.
    - It passes `returnTo` (the `usePathname()` value plus the search string) to `AdminAuthGuard`.
  - `components/admin/layout/AdminAuthGuard.tsx`:
    - Add an optional prop `returnTo?: string`.
    - When it is set and nobody is signed in, use `router.replace(signInPath(returnTo))`.
    - Without it, the behaviour is exactly as today (`searchParams.get('redirect') || '/admin'`).
- **Test:** `tests/unit/seva/seva-frame.test.tsx`

**Interfaces:**
- **Consumes:**
  - `SEVA_ROUTES`, `signInPath` and `isSevaPath` (A4S-1)
  - `SHELL_NAV` and `SHELL_FRAME` (A4S-1)
  - `sevaNavColumn(role, viewOnly)` and `type SevaNavColumn` from `@/components/admin/layout/navigation`. These stay
    unchanged; A4S-3 keeps them.
  - `useSevaMe()` (`me`, `loading`, `error`) and `useAuth()` (`sevaRole`, `logout`)
  - `STAFF_ROLE_LABEL` and `staffNoText` from `lib/seva/strings/staff.ts`
  - `SevaLink`, `PendingButton`, `MotionDialog` and `useAsyncAction`
- **Produces, in `components/seva/shell/sections.ts`:**
  - `type SevaSectionId = 'dashboard' | 'counter' | 'prasadam' | 'register' | 'dayCloses' | 'reports' | 'sevaSettings' | 'settings' | 'staff'`
  - `interface SevaSection { id; label: Bi; href: string; icon: LucideIcon; columns: readonly SevaNavColumn[]; phone: boolean; leavesModule?: true }`
  - `SEVA_SECTIONS`, in this order:

    | Section | Label | href | Columns | Notes |
    |---|---|---|---|---|
    | dashboard | `SHELL_NAV.dashboard` | `/seva` | TA, TV, SA | phone |
    | counter | `SHELL_NAV.counter` | | R, TA, SA | |
    | prasadam | `SHELL_NAV.prasadam` | | P, TA, SA | |
    | register | `SHELL_NAV.register` | | TA, TV, SA | phone |
    | dayCloses | `SHELL_NAV.dayCloses` | | TA, TV, SA | |
    | reports | `SHELL_NAV.reports` | | TA, TV, SA | phone |
    | sevaSettings | `SHELL_NAV.sevaSettings` | | TA, TV, SA | |
    | settings | `SHELL_NAV.receiptSettings` | | TA, TV, SA | |
    | staff | `SHELL_NAV.staffRoles` | `SEVA_ROUTES.staff` | TA, SA | `leavesModule` |

    The columns are the same as today's `RECEIPT_BOOK_PAGES`, `PRASADAM_PAGE` and `STAFF_PAGE` in `navigation.ts`.
  - `sectionsFor(column: SevaNavColumn | null): SevaSection[]`. `null` gives `[]`.
  - `currentSectionId(pathname: string): SevaSectionId | null`:
    - `/seva` exactly gives `dashboard`.
    - Otherwise, the longest section `href` that the path equals or starts with followed by `/`.
    - `/seva/counter/**` and `/seva/day-close` give `counter`.
    - Any other `/seva/<x>` (one receipt, its print page, the old create page) gives `register`.
    - A path outside `/seva` gives `null`.
- **Produces, components:**
  - `SevaHeader({ variant: 'desk' | 'focus', sections: SevaSection[] })`
  - `SectionRail({ sections, current })`
  - `PhoneBar({ sections, current, showWebsiteAdmin })`
  - `DeskFrame({ children })` and `FocusFrame({ children })`
  - `PageTransition({ children })`

**Behaviour:**
- **Column.** Both frames use the AdminSidebar rule:
  `me ? sevaNavColumn(me.role, me.viewOnly) : sevaNavColumn(sevaRole, null)`. While the profile loads, a temple
  admin gets the view-only column, so the frame fails closed.
- **`SevaHeader`.** It has `print:hidden` and wraps on narrow widths.
  - **Left side:**
    - the temple logo, `next/image` `/images/logos/ynk_matha_logo.png`, 34 px, round
    - `SHELL_FRAME.templeName`
    - a small line under the name. It is `SHELL_NAV.sevaEntry` on the desk header. On the counter header it is
      `SHELL_FRAME.counterTitle`, plus ` · <me.counter.name>` when the PC is a registered counter.
  - **Who:** `me.name · staffNoText(me.staffNo)` and `STAFF_ROLE_LABEL[me.role]`. Nothing is shown while `me` is
    null.
  - **Counter header links** (focus variant):
    - Today's receipts (`SEVA_ROUTES.today`) and Close day (`SEVA_ROUTES.dayClose`), for columns R, TA and SA
    - `SHELL_NAV.sevaEntry` (`SEVA_ROUTES.dashboard`), for columns TA and SA, as the way back
  - **Desk header links:**
    - Website admin (`SEVA_ROUTES.websiteAdmin`), for columns TA, TV and SA
    - when the person has exactly one section (a receptionist on a receipt page, a prasadam volunteer), a link to
      that section
  - **Sign out:**
    - It is always shown: while the profile loads, after it fails, and for a person with no seva role.
    - It is a `PendingButton` with the pending label `SHELL_FRAME.signingOut`.
    - It runs `logout()`, then `router.replace(signInPath(SEVA_ROUTES.dashboard))`.
  - **Link types:** module links are `SevaLink`. Website admin and Staff are plain `next/link`, and they leave the
    module.
  - **Colours:** the desk header is `--card`, and the counter header is `--maroon` with white text (see Global
    Constraints).
- **`SectionRail`.**
  - It is `<nav aria-label={SHELL_FRAME.sectionsLabel.en}>` with `print:hidden`. It shows only from `md` up, and is
    220 px wide.
  - Each item has a lucide icon and a `Bilingual` label. The current item has `aria-current="page"`.
  - The current-item highlight is an `m.span` with `layoutId="seva-rail-indicator"`, in the same pattern as the
    reports tabs.
  - The Staff item carries `SHELL_FRAME.opensWebsiteAdmin` as its `title`.
  - The rail is not rendered when the person has one section or none.
- **`PhoneBar`.**
  - It shows below `md` only. It is fixed to the bottom and has `print:hidden`.
  - Its items are the person's sections with `phone: true`. Add a **More** button when any other section, or Website
    admin, is left.
  - More opens a `MotionDialog` listing the rest, with Website admin last.
  - The current item, or More when the current section is inside it, has `aria-current="page"`.
  - The bar is not rendered when the person has one section or none. The content gets `pb-20 md:pb-0` only when the
    bar is shown.
  - A temple admin's bar shows Dashboard, Register, Reports and More, as in the mockup.
- **`DeskFrame`.** It renders the desk header, then a grid of the rail and `<main id="main-content" tabIndex={-1}>`,
  then `PhoneBar`.
- **`FocusFrame`.** It renders the counter header, then a full-width `<main id="main-content" tabIndex={-1}>`. It has
  no rail and no bar at any width.
- **One `main#main-content` per page.** The page transition sits in each group's template, inside the frame, so the
  header and rail never remount when moving between pages.

**Steps:**
- [ ] 1. Write the failing tests in `seva-frame.test.tsx`. Mock `useSevaMe`, `useAuth` and `next/navigation` the way
  `shell.test.tsx` does.
  - `it('shows a temple admin the header with name, staff number, role, Website admin and Sign out, and the rail in order')`.
    The rail hrefs are, in order: `/seva`, `/seva/counter`, `/seva/prasadam`, `/seva/register`, `/seva/day-closes`,
    `/seva/reports`, `/seva/seva-settings`, `/seva/settings`, `/admin/users`. The header shows `Lakshmi · 002`.
  - `it('gives a view-only temple admin no Counter, Prasadam or Staff, and assumes view-only until the seva profile loads')`.
  - `it('marks the open section with aria-current, and Register for a receipt page')`, with the pathname
    `/seva/2b1c9a3e-0000-4000-8000-000000000001`.
  - `it('the counter frame has no rail and no phone bar, and shows Today's receipts, Close day and Sign out')` for a
    receptionist. A temple admin also gets the Seva Entry link, and a receptionist does not.
  - `it('a prasadam volunteer gets no rail and no phone bar, only the header with Sign out')`.
  - `it('on a phone a temple admin gets Dashboard, Register, Reports and More, and More lists the rest with Website admin last')`.
  - `it('Sign out shows Signing out... at once, signs out and goes to /login?redirect=%2Fseva')`.
  - `it('Sign out is there for a person with no seva role, while the profile loads and after it fails')`.
  - `it('every page has exactly one main#main-content, and the header, rail and bar are print:hidden')`.
  - `it('AdminAuthGuard sends a signed-out visitor back to the page they opened when returnTo is set, and to /admin as before without it')`.
  - `it('the page transition lives in each group template, so the frame does not remount')`. This is a file check:
    - `app/seva/template.tsx` does not exist.
    - Both group templates re-export `PageTransition`.
- [ ] 2. Run it and see it fail:
  `npx jest --ci --watchman=false --forceExit tests/unit/seva/seva-frame.test.tsx`. Expected: FAIL (modules not found).
- [ ] 3. Implement.
- [ ] 4. Run it again, plus `tests/unit/seva/shell.test.tsx`. That file's `AdminAuthGuard` case must still pass,
  unchanged. Then run `npm run typecheck` and eslint on the changed files. Expected: all pass, 0 errors.
- [ ] 5. Commit `components/seva/shell`, `app/seva`, `components/admin/layout/AdminAuthGuard.tsx` and the test, with:
  `feat(seva): own header, section rail, phone bar and full-screen counter for Seva Entry`.

## Task A4S-3: Role landing and one website admin menu item

Tier: **M** - small changes to existing navigation, with existing tests to follow.

**Files:**
- **Modify:**
  - `components/admin/layout/navigation.ts`
  - `components/admin/layout/AdminSidebar.tsx`
  - `components/admin/layout/AdminHeader.tsx`
  - `app/seva/(desk)/page.tsx`: only its receptionist redirect block, near `isReceptionist`
- **Test:**
  - `tests/unit/seva/shell.test.tsx`
  - `tests/unit/seva/dashboard-period.test.tsx`

**Interfaces:**
- **Consumes:** `SEVA_ROUTES`, `sevaHomePath` and `SHELL_NAV.sevaEntry` (A4S-1).
- **Keeps unchanged** (A4S-2 uses them): `type SevaNavColumn` and `sevaNavColumn(role, viewOnly)`.
- **Produces:**
  - `sevaLandingPath(role): string | null` returns `SEVA_ROUTES.counter` for a receptionist, `SEVA_ROUTES.prasadam`
    for a prasadam volunteer, and `null` for everyone else. `app/admin/page.tsx` already calls it, and that file needs
    no change.
  - `withSevaNavigation(groups, { column })`. The `administrationShown` input goes away; AdminSidebar is its only
    caller.
    - When `column` is null, the groups come back unchanged.
    - Otherwise, the item whose href is `SEVA_ROUTES.dashboard` becomes one item with no children:
      `{ title: 'Seva Entry', titleKn, href: '/seva', icon: 'receipt' }`.
    - A receptionist and a prasadam volunteer get one group with only that item.
  - `RECEIPT_BOOK_PAGES`, `PRASADAM_PAGE`, `STAFF_PAGE` and `RECEIPT_BOOK_HREF` are removed. Their job has moved to
    `components/seva/shell/sections.ts`. `git grep` shows no other user apart from `shell.test.tsx`.

**Behaviour:**
- **Website admin menus.** In the `navigation` export and in AdminSidebar's `allNavigation`, the Finance item
  "Receipt Book" (`/admin/receipts`) becomes "Seva Entry" (`SEVA_ROUTES.dashboard`). The item's position stays the
  same.
  - AdminSidebar already opens seva hrefs with `SevaLink`, through `isSevaHref`, which A4S-1 updated.
  - Staff is no longer added to the website sidebar. It lives in the module rail.
- **Header search** (`AdminHeader`):
  - "receipt", "prasadam" and "seva entry" open `SEVA_ROUTES.dashboard`. These checks come before the existing
    "seva" check.
  - "seva" still opens `/admin/sevas`.
- **Opening `/seva`.** The dashboard page's receptionist redirect becomes:
  `const home = sevaHomePath(me?.role); if (me && home !== SEVA_ROUTES.dashboard) router.replace(home)`.
  - A receptionist lands on the counter, and a prasadam volunteer on the prasadam page.
  - Until then the existing skeleton stays, so the dashboard never flashes.
- **Temple admins and super admins** keep the website dashboard at `/admin`. The one Seva Entry item opens `/seva`.

**Steps:**
- [ ] 1. Write the failing tests:
  - In `shell.test.tsx`:
    - `it('shows a receptionist and a prasadam volunteer only the one Seva Entry item')`
    - `it('gives a temple admin and a super admin one Seva Entry item in Finance, with no Receipt Book sub-items')`
    - `it('names the counter for a receptionist, the prasadam page for a volunteer and nothing for others')`, with
      `'/seva/counter'` and `'/seva/prasadam'`
    - `it('header search for receipt, prasadam or seva entry opens /seva, and seva still opens /admin/sevas')`
    - Update the URL list at lines 135-142. Keep `it('keeps the existing sections for an existing billing user')` and
      the super admin Administration case as they are.
  - In `dashboard-period.test.tsx`: `it('sends a receptionist to /seva/counter and a prasadam volunteer to /seva/prasadam from /seva')`.
- [ ] 2. Run them and see them fail:
  `npx jest --ci --watchman=false --forceExit tests/unit/seva/shell.test.tsx tests/unit/seva/dashboard-period.test.tsx`.
- [ ] 3. Implement.
- [ ] 4. Run the two files again, then `npm run typecheck` and eslint on the changed files.
- [ ] 5. Commit with: `feat(seva): one Seva Entry item in the website admin and role landing at /seva`.

## Task A4S-4: The installed counter moves to /seva

Tier: **M** - small files, but an installed app and an old service worker on the counter PC must not strand the
counter.

**Files:**
- **Modify:**
  - `public/seva-counter.webmanifest`
  - `public/seva-sw.js`
  - `components/seva/counter/RegisterServiceWorker.tsx`
- **Test:**
  - **Modify:** `tests/unit/seva/sw-routes.test.ts`
  - **Create:** `tests/unit/seva/register-service-worker.test.tsx`

**Interfaces:**
- **Consumes:** `SEVA_ROUTES.counter` (A4S-1).
- **Produces:**
  - `SEVA_SW_SCOPE = SEVA_ROUTES.counter`
  - `LEGACY_SW_SCOPE = '/admin/receipts/counter'`, exported for the test. This is one of only two places where the old
    address may still appear (see A4S-6).
  - `module.exports` of `seva-sw.js` gains `SEVA_CACHE`.

**Behaviour:**
- **Manifest:** `id` and `start_url` are `/seva/counter`, and `scope` is `/seva`. Close day and Today's receipts then
  stay inside the app window. Website admin opens in the browser.
- **Service worker** (`seva-sw.js`):
  - `COUNTER_PATH = '/seva/counter'`.
  - `SEVA_SW_VERSION = '2'`, so `activate` deletes `seva-counter-1`, which holds the old address.
  - The `routeRequest` rules are unchanged. Only `/seva/counter` and the pages below it are network-first.
  - The registration scope stays the counter, so no other page is ever served from the cache. That is the same as
    today.
- **`RegisterServiceWorker`** (production only, as today):
  - Before registering, call `navigator.serviceWorker.getRegistrations()`.
  - `unregister()` each registration whose scope path is `LEGACY_SW_SCOPE` or below it. Leave every other
    registration alone.
  - Then register `/seva-sw.js` with `SEVA_SW_SCOPE`.

**Steps:**
- [ ] 1. Write the failing tests:
  - In `sw-routes.test.ts`, rewrite lines 12-47 for `/seva`:
    - `it('serves counter navigations under /seva/counter network-first')`
    - `it('lets /seva, /seva/register, /seva/counterfeit and the old /admin/receipts/counter go to the network')`
    - `it('the manifest installs Seva Counter at /seva/counter with scope /seva')`
    - `it('uses cache version 2, so the copy of the old counter address is dropped')`
  - In `register-service-worker.test.tsx`:
    - `it('registers /seva-sw.js for the /seva/counter scope in production')`
    - `it('unregisters an old worker left at /admin/receipts/counter and keeps every other worker')`
    - `it('does nothing in development')`
- [ ] 2. Run them and see them fail:
  `npx jest --ci --watchman=false --forceExit tests/unit/seva/sw-routes.test.ts tests/unit/seva/register-service-worker.test.tsx`.
- [ ] 3. Implement.
- [ ] 4. Run the tests again, then `npm run typecheck` and eslint on the `.tsx` file.
- [ ] 5. Commit with: `feat(seva): the counter installs from /seva and drops its old service worker`.

## Task A4S-5: Links inside the seva components

Tier: **S** - mechanical: each fixed address becomes a `SEVA_ROUTES` value, and the tests say exactly what every link
must be.

**Files:**
- **Modify:**
  - `components/seva/counter/{PrintedPanel,RegisterPrompt,StatusStrip}.tsx`
  - `components/seva/dashboard/{NeedsAttention,SummaryTiles}.tsx`
  - `components/seva/dayclose/CashCount.tsx`
  - `components/seva/export/ExportForm.tsx`
  - `components/seva/receipt/PrasadamShortcut.tsx`
  - `components/seva/register/ReceiptDrawer.tsx`
  - `components/seva/reports/AuditTrail.tsx`
  - `lib/seva/dashboard/attention-text.ts`

  That is 11 files and 20 places.
- **Test:**
  - **Create:** `tests/unit/seva/seva-links.test.tsx`
  - **Modify:**
    - `attention-text.test.ts`
    - `forms-pending.test.tsx`: the `PrintLink` fixture href
    - `public-receipt-view.test.tsx`
    - `receipt-detail.test.tsx`: only the prasadam shortcut expectation at line 230
    - `no-firestore-receipt-links.test.ts`

    All of them are in `tests/unit/seva/`.

**Interfaces:**
- **Consumes:** `SEVA_ROUTES`, `receiptPath` and `prasadamTokenPath` (A4S-1).
- **Produces:** nothing new.

**Behaviour:**
- `NeedsAttention` compares with `SEVA_ROUTES.dayCloses` and `SEVA_ROUTES.settings`.
- `ExportForm` opens `${SEVA_ROUTES.reportsSummary}?${query}`.
- `PrasadamShortcut` uses `prasadamTokenPath(token)`. This includes the public `/r/<token>` page.
- `ReceiptDrawer` and `AuditTrail` use `receiptPath(id)`.
- **`no-firestore-receipt-links.test.ts`:** its `RECEIPT_LINK` pattern must also match `receiptPath(`,
  `receiptPrintPath(` and `` `/seva/${ ``. Otherwise the test passes on nothing once the literal
  `/admin/receipts/${` is gone.

**Steps:**
- [ ] 1. Write the failing tests:
  - In `attention-text.test.ts`, every expected `href` becomes the `/seva` address, written as a literal (for example
    `'/seva/register?status=changed'`), so the test pins the address.
  - In `seva-links.test.tsx`:
    - `it('every seva component link points under /seva')`: render each of the ten components with minimal props, and
      check each `href`.
    - `it('Print summary opens /seva/reports/summary with the range')`
  - In `no-firestore-receipt-links.test.ts`: `it('the receipt link check still finds the receipt links the register and audit trail make')`.
    It expects at least `components/seva/register/ReceiptDrawer.tsx` and `components/seva/reports/AuditTrail.tsx`.
- [ ] 2. Run them and see them fail:
  `npx jest --ci --watchman=false --forceExit tests/unit/seva/attention-text.test.ts tests/unit/seva/seva-links.test.tsx tests/unit/seva/no-firestore-receipt-links.test.ts`.
- [ ] 3. Implement, then update the other three test files.
- [ ] 4. Run the six test files, then `npm run typecheck` and eslint on the changed files.
- [ ] 5. Commit with: `refactor(seva): seva screens link to their /seva addresses`.

## Task A4S-6: Browser tests at the new addresses, and the full run

Tier: **H** - 12 specs and a fixture change, the frame gets browser checks, and this run is the wave's proof.

**Files:**
- **Modify:** in `tests/e2e/seva/`:
  - `{counter-today,counter,dashboard,day-close,export,motion-loading,prasadam,register-reports,settings-lists,settings-receipt,settings-sevas,shell}.spec.ts`
  - `fixtures/counter.ts`
- **Create:**
  - `tests/e2e/seva/seva-frame.spec.ts`
  - `tests/unit/seva/no-old-addresses.test.ts`
- **Report:** `$STATE/test-reports/A4S-TEST-REPORT.md`

**Interfaces:**
- **Consumes:**
  - `SEVA_ROUTES`, imported relatively as `../../../lib/seva/routes`, the same way the specs import `lib/seva/time`
    today
  - `SHELL_FRAME.sectionsLabel` (A4S-1)
  - the frame behaviour of A4S-2
  - the landing of A4S-3

**Behaviour:**
- **Addresses.** Specs open pages through `SEVA_ROUTES`. A check whose subject is the address itself (landing,
  forwarding, return after sign-in) compares with a literal.
- **Rail selector.** The site-sidebar selector (`aside` with a `nav`) in `shell.spec.ts:44` and
  `motion-loading.spec.ts:37` becomes `page.getByRole('navigation', { name: 'Seva Entry sections' })`.
- **`shell.spec.ts`:**
  - From `/admin`, a receptionist lands on `/seva/counter` and a prasadam volunteer on `/seva/prasadam`.
  - The per-role sidebar screenshots become per-role rail screenshots, opened at `/seva`, with new marks:
    - receptionist and prasadam volunteer: no rail
    - temple admin: shows `/seva/counter`, hides nothing
    - view-only temple admin: shows `/seva/register`, hides `/seva/counter`
    - super admin: shows `/admin/users`
- **`seva-frame.spec.ts`** (desktop):
  - `test('a receptionist signs in and lands on the full-screen counter with no section menu')`: no rail; Today's
    receipts, Close day and Sign out are visible.
  - `test('a temple admin opening /seva sees the dashboard, the rail and Website admin')`
  - `test('Sign out is visible on the counter, the dashboard, the register, the prasadam page and a receipt page')`
  - `test('old bookmarks forward with their query')`:
    - `/admin/receipts/register?status=changed` -> `/seva/register?status=changed`
    - `/admin/prasadam?token=X` -> `/seva/prasadam?token=X`
    - `/admin/receipts` -> `/seva`
  - `test('a signed-out visit to /seva/register comes back to it after sign-in')`
- **Phone.** The phone project runs only `(prasadam|dashboard).*\.spec\.ts`, so the phone checks go into those specs,
  each skipped on desktop:
  - `test('phone: a temple admin gets Dashboard, Register, Reports and More, and More opens the rest')` in
    `dashboard.spec.ts`
  - `test('phone: a prasadam volunteer sees only the header with Sign out and the scan screen')` in
    `prasadam.spec.ts`
- **`no-old-addresses.test.ts`:** `it('no source file names /admin/receipts or /admin/prasadam except the forwarding rules and the old worker clean-up')`.
  - It scans the git-tracked files under `app`, `components`, `lib`, `hooks`, `services`, `context`, `types` and
    `public`.
  - It allows `next.config.ts` and `components/seva/counter/RegisterServiceWorker.tsx`.
  - It ignores `/api/admin/receipts` (the Firestore API that A5-1 removes).

**Steps:**
- [ ] 1. Write the new spec and the unit guard, and update the twelve specs and the fixture.
- [ ] 2. Run `npx jest --ci --watchman=false --forceExit tests/unit/seva/no-old-addresses.test.ts`. Expected: PASS.
  If it fails, a Run 2 task missed an address: report it as UNCLEAR with the file and line, and do not fix it here.
- [ ] 3. Ask the orchestrator to stop the owner's :3000 site, with his OK. Next 16 lets only one `next dev` run per
  project, and the harness starts its own on :3100.
- [ ] 4. Run every seva spec, desktop and phone:
  `npx -y firebase-tools@13.35.1 emulators:exec --only auth,firestore --project demo-seva "playwright test -c tests/e2e/seva/playwright.config.ts --workers=2"`.
  Expected: every test passes. A4P had 92, so the total is at least 92, plus the new ones.
- [ ] 5. Run the A4P reduced-motion check again: `smoke.spec.ts` and `dashboard.spec.ts` with
  `reducedMotion: 'reduce'`, with no console errors.
- [ ] 6. Write `A4S-TEST-REPORT.md`, with the counts per project and each failure with its cause. The orchestrator
  restarts the owner's site.
- [ ] 7. Commit the specs, the fixture and the unit guard, with:
  `test(seva): browser tests at the /seva addresses and the module frame`.

## Task A4S-7: Configurable receipt paper size (runs in Run 2)

Tier: **H** - the printed slip is the module's most visible output; page size, layout and printing must stay exact.

**The owner's decision (2026-10-19, card `a5`):** "keep it configurable: A5, or a 3-inch 80 mm receipt, or even more
standard sizes. Definitely all in portrait orientation, and a single receipt per sheet." This replaces the fixed
one-third-A4 slip (99 x 210 mm, Follow-ups card `paper`).

**Files:**
- **Create:**
  - `supabase/migrations/20261031000000_seva_paper_size.sql`. It is a NEW, additive migration. Every earlier migration
    has already been pushed to the owner's test project, so earlier files are frozen.
  - `lib/seva/print/paper.ts`
  - `tests/unit/seva/paper-size.test.ts`
  - `tests/db/seva-paper-size.test.ts`
- **Modify:**
  - `styles/seva/print.css`
  - `components/seva/slip/*`, including `ReceiptSlip.tsx`
  - `lib/seva/print/*`, which holds `printSlips` and the slip model
  - `components/seva/dayclose/DayCloseSummaryPrint.tsx`
  - the receipt-template settings page under `app/seva/(desk)/settings/receipt/` and its components under
    `components/seva/settings/`
  - `lib/seva/strings/receipt-settings.ts`
  - the settings schema in `lib/seva/schemas.ts`
  - `lib/seva/server/settings.ts`, and the counter bootstrap's slip settings in `lib/seva/server/counter.ts`
  - `types/seva*.ts`
  - `tests/e2e/seva/{counter-print,settings-receipt}.spec.ts`: page-size assertions only. Do not change their URLs;
    A4S-6 owns those in Run 3.

**Paper sizes:** all portrait, one receipt per sheet.

| id | Size | Notes |
|---|---|---|
| `a5` | 148 x 210 mm | **default** |
| `a6` | 105 x 148 mm | |
| `third_a4` | 99 x 210 mm | today's slip |
| `roll_80` | 80 mm wide | thermal roll, height fitted to the content |
| `roll_58` | 58 mm wide | thermal roll, height fitted to the content |
| `custom` | width 50-216 mm, height 80-356 mm | height must be at least the width, so it stays portrait |

- **Storage:**
  - The setting is stored in `seva_settings` as new nullable columns `paper_size text` (CHECK in the list) and
    `paper_custom_w_mm` / `paper_custom_h_mm` (smallint, CHECK on the ranges), with default `a5`.
  - It is changed only through the settings PATCH (`settings.edit`; view-only gets 403) and audited like the other
    slip settings.
- **Page size:**
  - `@page { size: <w>mm <h>mm; margin: 0 }` is generated from the setting at print time.
  - For a roll, measure the rendered slip and set the height to its content height plus a 6 mm tear margin, before
    `window.print()`.
  - Kiosk printing is unchanged.
- **Layout per size:**
  - **A5:** roomier, with larger text: amount at least 16 pt, name at least 13 pt. The temple header shows the name and
    address centred, with Photo 1 and Photo 2 left and right.
  - **A6 and one-third A4:** today's layout.
  - **Rolls:**
    - The header stacks: the photos are small, or hidden at 58 mm when they would push the text below 9 pt.
    - The QR is at least 22 mm at 80 mm and at least 18 mm at 58 mm.
    - Lines wrap.
  - **Everywhere:** no clipped text, and Kannada stays under the English.
- **Multi-date:** a receipt for several dates still prints one page per date, in one print job.
- **The settings page:**
  - a paper-size choice with a small live preview at the chosen size (reusing the existing slip preview)
  - the custom fields, shown only for `custom`
  - an "only portrait, one receipt per sheet" note
- **The day-close summary** prints on the same paper setting, flowing onto more pages when it is long.
- **The board summary** stays on A4.

**Steps:**
1. Write the failing tests first:
   - unit:
     - `it('builds the @page size for every preset and a custom size, always portrait')`
     - `it('refuses a custom size that would be landscape or out of range')`
     - `it('fits a roll page height to the content plus the tear margin')`
     - `it('A5 uses the larger type and keeps both photos')`
     - `it('58 mm hides the photos only when text would fall below 9 pt')`
   - DB:
     - `it('defaults paper_size to a5 and refuses an unknown size or a landscape custom size')`
     - `it('a view-only temple admin cannot change the paper size')`
   - e2e (assertions only): the printed PDF page is 148 x 210 mm by default, and 80 mm wide after choosing `roll_80`
2. Implement.
3. Run the unit and DB tests, `npm run typecheck` and eslint. Do NOT run Playwright; the Run 3 gate does.
4. Commit: `feat(seva): configurable receipt paper size - A5 default, A6, one-third A4, 80/58 mm rolls, custom`.

**Owner step:** after the build, the owner pushes the new migration to his test project with one command, which the
orchestrator gives him.

## Wave A4S gate

- **Checks:**
  - `npm run typecheck`: 0.
  - `npm run lint`: no new problems against A4P's count of 722.
  - `npx jest --ci --watchman=false --forceExit`: all.
  - `npm run test:db`: no SQL changed, so this only confirms.
  - `npm run build`: it must pass. This catches a missing Suspense boundary around `useSearchParams` and a bad route
    group. Next 16 lets `build` run beside the owner's `next dev`.
- **A4S-6's Playwright run** counts for the gate if no code changed after it. Otherwise run every seva spec again.
- **Restore** `next-env.d.ts` after any dev or Playwright run.
- **Review:** one Opus high whole-wave review against this plan and the mockup. A new failure gets a fix task (H)
  before A5.

**The owner's check, on this PC** (`http://localhost:3000`; the orchestrator restarts the site). Sign in as each
role:
1. **Receptionist:** lands on the full-screen counter. It shows only Today's receipts, Close day and Sign out, with no
   section menu.
2. **Temple admin, then super admin:** `/seva` opens on the dashboard with the rail. Website admin goes to the
   website's admin, which shows one "Seva Entry" item under Finance.
3. **Prasadam volunteer,** on a phone or a narrow window: only the header and the scan screen.
4. **Sign out** is visible on every Seva Entry screen, for every role.
5. **Old bookmarks:** open `http://localhost:3000/admin/receipts/register` and `/admin/prasadam`. They forward to
   `/seva/...`.
6. **Counter app:** uninstall the old "Seva Counter" app if it is installed. Open `/seva/counter` in Edge and install
   it again. It opens full screen at `/seva/counter`.

## Changes to other plans (made in the commit of this plan)

- **Plan B** (`2026-10-18-seva-entry-plan-B-phase2-web.md`), four places. All of them now point to `/seva/payments`:
  - **File map** (line 116): `app/seva/(desk)/payments/page.tsx`.
  - **B2-5** (line 932): the attention link is `SEVA_ROUTES.payments` (`/seva/payments`). B2-5 adds that route
    name to `lib/seva/routes.ts`, because B2 runs before B3.
  - **B3-3** (lines 1102-1103):
    - The page goes in `app/seva/(desk)/payments/page.tsx`, with its `loading.tsx`.
    - `components/seva/shell/sections.ts` gains a "Payments" section after Reports, with columns TA, TV and SA. This
      replaces the item in `navigation.ts`.
- **Plan A part 2**, wave A5:
  - **A5-1** (lines 887 and 910): `app/seva/(desk)/create/page.tsx` redirects to `/seva/counter`, and the website
    reports page links to `/seva/reports`.
  - **A5-3** (line 966): the client-Supabase grep reads `app/seva` instead of the two old folders.

## Design Book wording to change (for A5-2, not this wave)

- **§5, D8:** "it keeps its menu place" becomes "the website admin keeps one menu link to its own screens at /seva".
- **§22, C-40:** "pages keep `/admin/receipts/*`" becomes "pages at `/seva/*`; old addresses forward".
- **Route mentions** to change to `/seva` addresses:
  - §6.1 (three rows)
  - §6.4 (the `app/admin/receipts/` and `app/admin/prasadam/` lines become `app/seva/(counter|desk)/`)
  - §9 (the counter route)
  - §11 (the prasadam route)
  - §12.1, §12.3 and §12.4 (the headings)
  - §13 and §13.1 (the settings routes)
  - §17.2 (the create page)
  - §17.4 (the receipt page paths)
- **§17.1:**
  - the receipts layout row becomes `app/seva/layout.tsx`
  - the `AdminSidebar` / `navigation.ts` row becomes "one Seva Entry item"
  - add rows for `components/seva/shell/*` and `lib/seva/routes.ts`
- **§18:** add a "module shell" bullet: the header with the person and Sign out, the section rail (desktop), the
  bottom bar (phone), and the full-screen counter.
- **§20.1 step 5:** "install the web app from `/seva/counter`; it opens full screen".
- **SETUP-GUIDE** lines 610 and 623: the counter address and the kiosk shortcut end with `/seva/counter`.

## Self-review

- **Spec coverage.** Each of the brief's items has a task:
  - choice B: A4S-1 and A4S-2
  - focus counter: A4S-2 `FocusFrame` and A4S-6
  - one routes constant: A4S-1
  - forwarding with the query: A4S-1 and A4S-6
  - role landing: A4S-3
  - one site menu item: A4S-3
  - PWA scope and start: A4S-4
  - the service worker caches only counter pages: A4S-4
  - Staff linked: A4S-2 `sections.ts`
  - the motion layer kept: A4S-1 (`motion.ts`) and A4S-2 (templates in the groups)
  - Plan B patched: done
  - Design Book list: above
  - owner gate: above
- **Ownership.** No two Run 2 tasks share a file:
  - A4S-2 owns `components/seva/shell/**`, `app/seva/layout.tsx`, the group layouts and templates, and
    `AdminAuthGuard`.
  - A4S-3 owns `navigation.ts`, `AdminSidebar`, `AdminHeader`, `app/seva/(desk)/page.tsx`, `shell.test.tsx` and
    `dashboard-period.test.tsx`.
  - A4S-4 owns the manifest, the service worker, `RegisterServiceWorker` and its two tests.
  - A4S-5 owns the ten components, `attention-text.ts` and its five tests.
  - Test files that A4S-1 touched are touched again only in a later run.
- **Names.** `SEVA_ROUTES`, `receiptPath`, `receiptPrintPath`, `prasadamTokenPath`, `isSevaPath`, `sevaHomePath`,
  `signInPath`, `SHELL_FRAME` and `SHELL_NAV.sevaEntry` are spelt the same way in every task that uses them.
  `sevaNavColumn` and `SevaNavColumn` stay in `navigation.ts`.
