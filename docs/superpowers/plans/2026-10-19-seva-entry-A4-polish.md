# Seva Entry - Wave A4P: motion and instant feedback (polish)

Written 2026-10-19 (Monday) after the owner tried the A4 screens on his PC. The six-step check passed. His feedback:

- "the website looks very choppy"
- he loves spring-action animations: "let it move, let the website look more lively, if not funky"
- "every interaction, if something is loading then I need to see the loading screen. Otherwise I expect it to be
  instant with an animation"

He chose the **Lively** spring in the motion demo (`$STATE/desk/mockups/motion.html`).

Rules for every task:
- Standing rules: `$STATE/briefs/build/BUILD-RULES.md`.
- Use the existing `framer-motion` ^12.42.0 (already a dependency). No new package.
- Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-link-status.md` and the loading.js and
  template.js file conventions before using them.
- Animate only `transform` and `opacity`. No layout thrash, and nothing moves while a person types.
- Respect `prefers-reduced-motion`: `MotionConfig reducedMotion="user"`; charts already turn `animation` off.
- Keyboard flow, focus order and every existing test stay as they are. Update a test only when it waited on a fixed
  timing that motion changes, and say so in the report.
- Elderly-friendly: no motion longer than about 450 ms before content is readable. Nothing blinks.

## Task A4P-1: Motion and loading foundation

Tier: **Opus high** - cross-cutting primitives that every screen will use; navigation feedback in Next 16.

**Files:**
- **Create:**
  - `lib/seva/motion.ts`
  - `components/seva/motion/{SevaMotion,Pressable,Reveal,AnimatedNumber,PendingButton,RouteProgress,SevaLink,PageSkeleton,MotionDialog}.tsx`
  - `hooks/seva/useAsyncAction.ts`
  - `app/admin/receipts/template.tsx`
  - a `loading.tsx` in EVERY route folder under `app/admin/receipts/` (including `[receiptId]`, `[receiptId]/print`,
    `counter/today`, each `reports/*` and `settings/*`) and in `app/admin/prasadam/`
- **Modify:**
  - `app/admin/receipts/layout.tsx` and `app/admin/prasadam/layout.tsx`: wrap in `SevaMotion` and `RouteProgress`
  - `components/seva/ui/{Segmented,Chip,StatusPill,SearchSelect}.tsx`
  - `lib/seva/charts/options.ts`
  - the seva items in `components/admin/layout/AdminSidebar.tsx`, which use `SevaLink`
- **Test:**
  - `tests/unit/seva/motion-foundation.test.tsx`
  - `tests/unit/seva/loading-files.test.ts`
  - `tests/e2e/seva/motion-loading.spec.ts`

**Interfaces (produces):**
- `SPRING = { type: 'spring', stiffness: 380, damping: 22, mass: 1 }`, the owner's Lively choice.
- `PRESS = { scale: 0.94, transition: { type: 'spring', stiffness: 900, damping: 40 } }`.
- `enterVariants` (opacity 0, y 18, scale 0.96, to 1), `staggerChildren(0.055)`, `slideIn` (x 24, to 0).
- `SevaMotion`: `LazyMotion features={domAnimation} strict` and `MotionConfig reducedMotion="user" transition={SPRING}`.
  Use `m.*`, not `motion.*`, inside it.
- `Pressable`: an `m.button` with `whileTap={PRESS}` that forwards every button prop.
- `Reveal` / `Stagger` for lists.
- `AnimatedNumber({ value, format })`: a spring count. It always ends exactly on `value`, keeps `tabular-nums`, uses
  the module's Indian grouping, and screen readers get the final value only.
- `useAsyncAction(fn)`: returns `{ run, pending, error }`.
  - `pending` turns true in the same event as the click, before any await.
  - A second `run` while pending is ignored.
  - `pending` stays visible for at least 300 ms, so it never flickers.
- `PendingButton`: `Pressable` with a spinner and a pending label (from the screen's strings, for example "Saving..."),
  plus `aria-busy` and `disabled` while pending.
- `SevaLink`: `next/link` plus `useLinkStatus`. It reports pending to a small context. `RouteProgress` shows a 3 px
  bar fixed at the top (the module's primary or saffron token) within one frame of a pending link, and it finishes
  with a spring.
- `navigateWithProgress(router, href)`: the same feedback for code that calls `router.push`.
- `PageSkeleton({ variant: 'dashboard' | 'list' | 'form' | 'detail' | 'counter' })`: shimmer blocks shaped like each
  screen. They use the module's tokens, never fixed colours.
- `MotionDialog`: animates the dialog the module already uses (scale 0.92 to 1, y 24 to 0, scrim fade, exit
  included).
  - It must not change `components/ui/dialog`, which other modules use.
  - It keeps focus trapping and Escape.
- `Segmented`: a sliding pill using `layoutId`, plus press feedback. Its API stays unchanged.
- `Chip` / `StatusPill`: press feedback, and a spring when the status changes.
- `SearchSelect`: the list opens with a spring and the options stagger in. Typing never waits on animation.
- `charts/options.ts`:
  - Bars use `animationEasing: 'backOut'` and `animationDuration: 700`, with a 30 ms stagger per data index.
  - Lines and pies use `cubicOut`.
  - Updates use `animationDurationUpdate: 500` and `animationEasingUpdate: 'cubicInOut'`.
  - Under reduced motion, keep `animation: false`.

**Steps:**
1. Write the failing tests first:
   - `it('uses the owner-chosen Lively spring (380/22/1)')`
   - `it('PendingButton shows the spinner and aria-busy in the same tick as the click and ignores a second click')`
   - `it('PendingButton keeps the pending state visible for at least 300 ms')`
   - `it('AnimatedNumber ends exactly on the value and shows it at once under reduced motion')`
   - `it('Segmented keeps its keyboard behaviour and marks the moving pill')`
   - `it('every route folder under app/admin/receipts and app/admin/prasadam has a loading.tsx')`, a file-system
     scan
   - `it('bar charts animate with backOut and turn animation off under reduced motion')`
   - e2e `test('a slow page shows the top bar and its outline within 200 ms of the click')`: delay the fake API for
     the register by 800 ms, then click Register in the sidebar
2. Run them and see them fail.
3. Implement.
4. Run the tests again, plus `npm run typecheck` and eslint on the changed files.
5. Commit: `feat(seva): spring motion and instant loading foundation`.

## Task A4P-2: Counter, today's receipts and close day move and never freeze

Tier: **Opus high** - the busiest screens; motion must never slow typing.

**Files:**
- **Modify** what is needed under `components/seva/counter/*`, `components/seva/today/*`,
  `components/seva/dayclose/*` and `hooks/seva/useCounter.ts`, plus their strings.
- **Tests:** the matching unit tests, and `tests/e2e/seva/{counter,counter-today,day-close}.spec.ts`.

**Consumes:** everything A4P-1 produces.

**Behaviour:**
- **Steps:** a step change slides (`AnimatePresence mode="popLayout"`, `slideIn`). Focus still lands where it does
  today.
- **Seva tiles:** they stagger in on load. A picked tile pops.
- **Order lines:** added and removed lines animate (`layout` plus `AnimatePresence`).
- **Summary:** the totals, change and "Return change Rs N" use `AnimatedNumber`.
- **Save and print:** a `PendingButton`. "Saving..." shows at once. The in-doubt dialog and the printed panel use
  `MotionDialog` and Reveal, with a tick that pops.
- **Devotee search:** a small inline spinner in the field while the search runs.
- **Status strip:** the connection pill and the "N waiting" count spring when they change. The offline banner slides
  down.
- **Today's receipts:**
  - Rows stagger in.
  - Search and filter changes show an inline pending line, never a blank list.
  - The cancel, reprint and spoiled actions are `PendingButton`s.
  - The cancel dialog uses `MotionDialog`.
- **Close day:**
  - Denomination totals and differences use `AnimatedNumber`.
  - Submit and Reopen are `PendingButton`s.
  - Moving between steps slides.

**Steps:**
1. Write the failing tests first:
   - `it('Save and print shows Saving... before the API answers and blocks a double save')`
   - `it('cancel shows its pending state and the dialog animates out on success')`
   - e2e: with the fake API delayed by 800 ms, `test('saving shows Saving... within 150 ms and the printed panel after')`
   - e2e: `test('the keyboard-only 3-date receipt still works')`
2. Implement.
3. Run the task's unit tests and these three e2e specs on local emulators, as the A4 gate did.
4. Commit: `feat(seva): spring motion and pending states on the counter, today and close day`.

## Task A4P-3: Dashboard, register, reports and export

Tier: **Opus high** - data-heavy screens; switching must keep the old data visible while new data loads.

**Files:**
- **Modify** under `components/seva/{dashboard,register,reports,export}/*` and their pages.
- **Tests:** the matching unit tests, and `tests/e2e/seva/{dashboard,register-reports,export}.spec.ts`.

**Behaviour:**
- **Period switch:** uses `useTransition`. While new data loads, the old tiles and charts stay, dimmed, with a small
  spinner beside the switch. They are never blank and never frozen.
- **Tiles:** `AnimatedNumber`.
- **Attention cards:** they stagger in.
- **Charts:** they animate on first draw and on data change, through the options from A4P-1.
- **Register:**
  - Rows stagger in.
  - Filter, search and page changes show an inline pending line.
  - The receipt drawer uses `MotionDialog`, or the drawer equivalent.
- **Reports:** the tabs get the sliding indicator.
- **Export:** a progress bar with "part n of m" while it pages through the data. The download buttons are
  `PendingButton`s.

**Steps:**
1. Write the failing tests first:
   - `it('switching the period keeps the previous tiles visible and marks them pending')`
   - e2e with an 800 ms delay: `test('period switch never shows a blank dashboard')` and
     `test('export shows progress while it pages')`
2. Implement.
3. Run the unit tests and the three e2e specs.
4. Commit: `feat(seva): spring motion and pending states on the dashboard, register, reports and export`.

## Task A4P-4: Settings, staff, prasadam, receipt detail and the public QR page

Tier: **Opus high** - many small forms; the phone-first prasadam screen must stay fast.

**Files:**
- **Modify** under `components/seva/{settings,staff,prasadam,receipt}/*`, plus `app/r/[token]/page.tsx` and its
  component.
- **Tests:** the matching unit tests, and `tests/e2e/seva/{settings-sevas,settings-receipt,staff,prasadam}.spec.ts`.

**Behaviour:**
- **Every Save:** a `PendingButton`, then a short success line that pops in.
- **List items:** added, removed or reordered items animate.
- **Register / Replace this PC:** pending states.
- **Staff:** rows stagger in. The drawer and the onboard dialog use `MotionDialog`.
- **Prasadam:**
  - Each scan or lookup result card springs in with its state colour.
  - Give is a `PendingButton`.
  - "Marked given" pops a tick.
  - Undo is a `PendingButton`.
- **Receipt detail:** the print button shows a pending state.
- **Public QR page:** one gentle Reveal only; it is a public page, so keep it light.

**Steps:**
1. Write the failing tests first: `it('a settings save shows Saving... and then the saved line')`, and the prasadam
   give / undo pending tests.
2. Implement.
3. Run the unit tests and the four e2e specs.
4. Commit: `feat(seva): spring motion and pending states on settings, staff, prasadam and receipts`.

## Task A4P-6: Tidy the open LOW items and the two-key backup

Tier: **Opus medium**.

1. **`RegisterThisPc` with office-refused items.** Say plainly that office-refused items are waiting and who can
   clear them. They count in `pendingCount`, but no screen can clear them.
2. **`ReplaceThisPc` `send()`:** repeat the reason-length check.
3. **`StaffList.tsx`:** head the row notices with the shared `partial_failure` message, as the drawer now does.
4. **Two backup keys.** The owner chose a key for himself and one for the site owner (2026-10-19).
   - `scripts/seva/backup.sh` takes several age recipients: `SEVA_BACKUP_AGE_RECIPIENT` holds space- or
     comma-separated public keys, and each one is passed as `-r`.
   - Update `verify-backup.sh` notes, and SETUP-GUIDE B6 and B7, to match.
   - Test the script's argument building, using the repository's existing shell-test approach, or a small node test
     of the parsing if there is none.
5. **Commit:** `fix(seva): tidy A4 review notes and allow two backup keys`.

## Wave A4P gate

Run:
- typecheck, lint, jest and the DB suite
- EVERY seva Playwright spec, including `motion-loading.spec.ts`
- one extra Playwright run of `smoke.spec.ts` and `dashboard.spec.ts` with `reducedMotion: 'reduce'`, which must pass
  with no console errors

The owner's check, on this PC: open the counter, the dashboard and the register, click around, and say whether it now
feels smooth and alive with no frozen moments.
