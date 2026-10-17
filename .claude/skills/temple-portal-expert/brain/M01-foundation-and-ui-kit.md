# M01 - App shell, design tokens, shared UI kit and utilities
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs. Verify against the code before acting on any claim.

## Answers questions about

- "What wraps every page in this app?" - the root layout, its provider stack and font setup (`app/layout.tsx`).
- "Where are the colours / design tokens defined and which ones are actually used?"
- "Why does the site look amber/orange when the CSS says gold?" - the three competing colour systems.
- "Is there a dark mode?" - a full dark palette exists and nothing ever turns it on.
- "Which shadcn / base-ui primitives exist, which are hand-rolled, which are dead?"
- "Where is the site navigation defined and how do I add a menu item?"
- "Why is the header/footer not in a layout file?" - every public page imports them itself.
- "How does auth state reach a component?" - `AuthContext` -> `useAuth`.
- "What is the difference between `AuthContext.profile` and `ProfileContext.profile`?"
- "Which Firebase entry point do I use on the client vs the server?" - `lib/firebase.ts` vs `lib/admin-firebase.ts` vs `lib/firebase-admin-rest.ts`.
- "What does `proxy.ts` do and is it the middleware?" - Next 16 renamed middleware; it tracks page views and sets a second CSP.
- "Why are there two sets of security headers?" - `next.config.ts` and `proxy.ts` both set CSP, differently.
- "How do I add a form field to an admin form?" - the `components/ui/form/*` framework.
- "Which toast system is live?" - `react-hot-toast`; the shadcn toast in `components/ui/toast.tsx` is wired to nothing.
- "Why do my tabs all show at once?" - `components/ui/tabs.tsx` is a non-functional stub.
- "Why does the dropdown menu never close?" - `components/ui/dropdown-menu.tsx` is a `div`, not a menu.
- "What animation vocabulary should I use?" - three exist; `lib/animations.ts` is dead.
- "Where is `cn()` / `formatDate` / `formatCurrency`?" - and which of the three `formatDate`s to pick.
- "How is rate limiting done?" - in-process `Map`, ineffective on serverless.
- "What did the docs promise that the code never built?" - the doc-vs-code drift table.
- "Which parts of the shell survive a move to React Native and which do not?"
- "What is dead code in the foundation layer?" - 22 source files with no importer (~2,358 lines).
- "Where do accessibility helpers live and do they work?" - `A11yProvider`, `hooks/a11y/index.ts`.
- "What are the build/lint/type-check settings?" - `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`.

## Purpose and business role

M01 is the foundation layer of the Sri Raghavendra Swamy Matha portal (`package.json:2` names it `temple-portal`). It owns
everything that is not a feature: the HTML document and provider stack every devotee and admin page boots through, the
CSS custom properties and Tailwind v4 theme that define the temple's visual identity, the shared component kit that the
public site (M02/M03) and the admin console (M05-M07) both draw from, the global React contexts that carry the signed-in
devotee's identity and preferences, and the small `lib/` utilities that wrap Firebase, formatting, rate limiting and
configuration.

For a devotee it is invisible but decisive: it sets the fonts (including Kannada script support), the sticky header they
navigate with, the footer with the temple's phone and address, the toast that confirms a booking, and the skip link and
reduced-motion handling that make the site usable with a keyboard or with vestibular sensitivity. For an admin it
supplies the form controls, tables, dialogs and uploaders that every CRUD screen is built from. For the system it is the
single place Firebase is initialised, the only place security headers are declared, and the boundary between client SDK
and server SDK access to Firestore.

It is also the layer with the most accumulated drift: two parallel design systems, three colour vocabularies, three date
formatters, two auth implementations, two search components, two toast systems, and a documented token file
(`lib/formStyles.ts`) that no code imports.

## Code roots

From `.claude/state/chunks.json` (id `M01`):

```
app/layout.tsx          app/globals.css
components/ui/**        components/layout/**      components/common/**
context/**              hooks/**                  utils/**
lib/*.ts  lib/*.tsx
proxy.ts  next.config.ts  tsconfig.json  postcss.config.mjs
components.json  eslint.config.mjs  package.json
```

Adopted from the Unassigned list in `.claude/state/inventory/SUMMARY.md`:

- `components/debug/ClientEnvDebug.tsx` - an orphan shell-level debug component (no importer) that renders the public
  Firebase env vars to the page. It belongs with the app shell because that is the only thing it touches.

Explicitly **not** mine, though one level away: `lib/i18n/**` (M13), `lib/settings/temple.ts` (M05/M11),
`lib/ai/**` (M08), `services/**` and `types/**` (M10), `components/admin/**` (M05), `components/ai/**` (M09),
`components/search/GlobalSearch.tsx` (M02/M13 - see `M01-F19`), `components/analytics/PageViewTracker.tsx` (M13).

## Entry points

| Route or entry | File | server/client | auth required | What it renders or does |
|---|---|---|---|---|
| every route (`/*`) | `app/layout.tsx` | server | no | `<html>`/`<body>`, three next/font families, site `metadata`, and the provider stack `A11yProvider > AuthProvider > ProfileProvider > AIChatProvider` plus `SkipLink`, `LiveRegion`, `react-hot-toast` `<Toaster>` and `<ChatWidget>` (`app/layout.tsx:78-126`) |
| every route (styles) | `app/globals.css` | n/a | no | Font stacks, Tailwind v4 `@theme inline`, the light and dark token sets, and ~40 hand-written temple utility classes |
| every request | `proxy.ts` | server (Next 16 "proxy", the renamed middleware) | no | Writes a `page_views` doc per non-static GET and sets a second, older set of security headers (`proxy.ts:84-121`) |
| build/runtime config | `next.config.ts` | n/a | n/a | `images.remotePatterns` for unsplash + two vercel-blob hosts, and eight security headers incl. CSP for `/:path*` (`next.config.ts:38-63`). **That is the whole file**: no `redirects()`, no `rewrites()`, no `experimental` block, no `typescript`/`eslint` build overrides (verified 2026-09-19 by grep) |
| shell for 28 public pages | `components/layout/Navbar.tsx` + `components/layout/Footer.tsx` | client | no | Imported page-by-page, not by a layout (see `M01-F05`) |
| public route group | `app/(public)/layout.tsx` (owned by M02) | server | no | Renders only `<PageViewTracker/>`, `<main id="main-content">` and `GoUpButton` - **no header, no footer** |
| admin route group | `app/admin/layout.tsx` (owned by M05) | server | yes (AdminAuthGuard) | Wraps `AdminShell` and reuses M01's `GoUpButton` |
| debug | `components/debug/ClientEnvDebug.tsx` | client | no | Dumps `NEXT_PUBLIC_FIREBASE_*` to the DOM; no route mounts it |

There is no `middleware.ts` in the repo; `proxy.ts` at the root is Next 16's replacement (`package.json:55` pins
`next: ^16.2.9`). **UNCLEAR**: whether `proxy.ts` is picked up automatically in this exact Next version - `node_modules`
is absent so `node_modules/next/dist/docs/` could not be read, and no `config`/`matcher` export exists to confirm.

## Component trees

### 1. The root shell - every page in the app

```
RootLayout (server)                         app/layout.tsx:73
└─ <html lang="en" suppressHydrationWarning>
   └─ <body class="{inter} {playfair} {notoSansKannada} antialiased bg-stone-50 text-stone-900">   :80
      └─ A11yProvider (client)              components/common/A11yProvider.tsx:16
         ├─ hooks: useHighContrast, useKeyboardNavigationMode   hooks/a11y/index.ts:11,230
         ├─ SkipLink (client)               components/common/A11yProvider.tsx:79
         ├─ LiveRegion (client)             components/common/A11yProvider.tsx:168   (listens for "a11y-announce"; nothing dispatches it)
         ├─ AuthProvider (client)           context/AuthContext.tsx:54
         │  ├─ lib/firebase.ts  -> auth, initializeAuthPersistence
         │  └─ services/auth.service.ts (M10) -> getUserProfile  -> Firestore `users`
         │     └─ ProfileProvider (client)  context/ProfileContext.tsx:57
         │        ├─ services/profile.service.ts (M10) -> `profiles` / bookmarks
         │        └─ AIChatProvider (client)  components/ai/AIChatProvider.tsx (M09)
         │           ├─ {children}          ← the route's own layout + page
         │           ├─ Toaster (react-hot-toast)   app/layout.tsx:91   ← the live toast system
         │           └─ ChatWidget (client) components/ai/ChatWidget.tsx (M09)
         └─ <div role="status" aria-live="polite" class="sr-only">   A11yProvider.tsx:54  ← second live region
```

Note the two live regions (`A11yProvider.tsx:54` and the mounted `LiveRegion` at `app/layout.tsx:85`) and that
`AIChatProvider` from M09 is hard-wired into the root layout, so the AI widget loads on every route including admin.

### 2. Public page chrome (repeated in 28 pages, e.g. `app/(public)/about/page.tsx:5,6,137,376`)

```
PublicLayout (server)                       app/(public)/layout.tsx
├─ PageViewTracker (client)                 components/analytics/PageViewTracker.tsx:30   (M13)
├─ <main id="main-content" tabIndex={-1}>
│  └─ PageComponent (client, mostly)        app/(public)/<x>/page.tsx                     (M02/M03)
│     ├─ Navbar (client)                    components/layout/Navbar.tsx:46      ← imported by the PAGE, not the layout
│     │  ├─ next/link, next/image, usePathname
│     │  ├─ useEffect -> settingsService.getSocialLinks()   Navbar.tsx:64-76   (M05/M10 -> `settings`)
│     │  ├─ menuItems[] + 4 dropdown arrays  Navbar.tsx:16-44
│     │  ├─ desktop <nav class="hidden lg:flex">  Navbar.tsx:182-431
│     │  └─ mobile panel (second full copy of the same menu)  Navbar.tsx:442-629
│     ├─ ...page sections...
│     └─ Footer (client)                    components/layout/Footer.tsx:59
│        ├─ useEffect -> getDoc(doc(db,"settings","footer"))  Footer.tsx:63-82  ← direct Firestore, no service
│        └─ defaultData{} incl. quickLinks/sevasLinks/calendarLinks  Footer.tsx:27-57  ← third copy of the menu
└─ GoUpButton (client)                      components/ui/GoUpButton.tsx:8  (window.scrollY + framer-motion)
```

### 3. The admin form framework (shared by M05/M06/M07 CRUD screens)

```
FormContainer (client)                      components/ui/form/FormContainer.tsx:6   <form class="space-y-8 max-w-5xl">
└─ FormSection (server)                     components/ui/form/FormSection.tsx:9     <section> + title + description
   ├─ FormTextField (client)                components/ui/form/FormTextField.tsx:13  own label markup (does NOT use FormGroup)
   ├─ FormTextArea (client)                 components/ui/form/FormTextArea.tsx:16   └─ FormGroup
   ├─ FormNumberField (client)              components/ui/form/FormNumberField.tsx:16└─ FormGroup
   ├─ FormSelectField (client)              components/ui/form/FormSelectField.tsx:24└─ FormGroup, native <select>
   ├─ FormSwitchField (client)              components/ui/form/FormSwitchField.tsx:13└─ FormGroup, native checkbox
   ├─ ImageUploader (client)                components/ui/ImageUploader.tsx:20  -> services/storage.service.ts (M10)
   └─ VideoUploader (client)                components/ui/VideoUploader.tsx:18  -> services/storage.service.ts (M10)
└─ FormActions (client)                     components/ui/form/FormActions.tsx:12    -> Button (outline | submit)
        └─ Button (client)                  components/ui/button.tsx:21
```

`FormGroup` (`components/ui/form/FormGroup.tsx:16`) is the label + helper + error shell; four of the five fields use it,
`FormTextField` duplicates it inline.

### 4. Overlay primitives

```
Dialog (client)                             components/ui/dialog.tsx:10   @base-ui/react/dialog
└─ DialogContent  :51
   ├─ DialogPortal -> DialogOverlay (Backdrop)  :27,:35
   └─ DialogPrimitive.Popup
      ├─ DialogHeader > DialogTitle / DialogDescription   :92,:129,:142
      ├─ {children}
      ├─ DialogClose render=<Button variant="ghost" size="icon-sm">  :72-85
      └─ DialogFooter (optional trailing Close)  :102

Select (client)                             components/ui/select.tsx:9    @base-ui/react/select
└─ SelectTrigger > SelectValue + ChevronDownIcon   :31
└─ SelectContent -> Portal > Positioner > Popup > List  :59
   ├─ SelectScrollUpButton / SelectScrollDownButton  :152,:171
   ├─ SelectGroup > SelectLabel  :11,:98
   ├─ SelectItem > ItemText + ItemIndicator(CheckIcon)  :111
   └─ SelectSeparator  :139
```

### 5. Animation wrappers (all client, all framer-motion)

```
AnimateIn / StaggerIn / StaggerItem         components/ui/AnimateIn.tsx:58,102,142   -> useReducedMotion
PageTransition / PageLoader / SectionTransition  components/ui/PageTransition.tsx:12,57,102  -> usePathname, useReducedMotion
MicroInteractions: AnimatedButton, AnimatedCard, IconButton, AnimatedInput,
                   AnimatedToggle, AnimatedCheckbox, AnimatedLink   components/ui/MicroInteractions.tsx:16..338
DeepaFlame (canvas + rAF)                   components/ui/DeepaFlame.tsx:21
FloatingParticles / FloatingElement / FloatingDots (canvas + rAF)  components/ui/FloatingParticles.tsx:29
barrel: components/ui/animations.ts:1-15    ← re-exports all of the above; nothing imports the barrel
             (note: the barrel uses `export ... from`, which the import graph does not record, so
              AnimateIn/MicroInteractions/TempleCard show 0 importers there and are dead either way)
```

## Design tokens - the complete list (focus question 2)

Added by verification 2026-09-19 because the focus question asks for the tokens themselves, not their location.
Everything below is from `app/globals.css` unless noted. **This is the list the UI redesign works from.**

**Fonts.** Three `:root` stacks at `:1-5` (`--font-inter`, `--font-heading: "Playfair Display", serif`,
`--font-kannada: "Noto Sans Kannada", var(--font-inter)`), plus three `next/font` CSS variables emitted by
`app/layout.tsx:13-29` (`--font-inter`, `--font-heading`, `--font-kannada`) - the same three names, declared twice, and
`@theme inline:87-89` then maps `--font-sans`/`--font-mono`/`--font-heading` to variables that do not exist (F15).

**Colour - 31 semantic colour tokens + `--radius` + 9 temple extensions = 41 `:root` declarations**, all colours
`oklch`, all at `app/globals.css:128-193`:

| Group | Tokens | Notable values |
|---|---|---|
| Base | `--background`, `--foreground` | `oklch(0.985 0.015 95)` warm off-white / `oklch(0.25 0.02 50)` |
| Surfaces | `--card`, `--card-foreground`, `--popover`, `--popover-foreground` | card is pure white `oklch(1 0 0)` |
| Primary | `--primary`, `--primary-foreground` | **`--primary: oklch(0.75 0.16 80)` = temple gold**, not the orange the Buttons use (F11) |
| Secondary | `--secondary`, `--secondary-foreground` | |
| Muted | `--muted`, `--muted-foreground` | |
| Accent | `--accent`, `--accent-foreground` | saffron `oklch(0.92 0.06 60)` |
| Status | `--destructive` | `oklch(0.55 0.2 25)`; there is **no** success/warning/info token |
| Form/edges | `--border`, `--input`, `--ring` | `--ring` = `--primary` |
| Charts | `--chart-1` … `--chart-5` | gold → deep red ramp |
| Sidebar | `--sidebar`, `-foreground`, `-primary`, `-primary-foreground`, `-accent`, `-accent-foreground`, `-border`, `-ring` (8) | declared for a shadcn Sidebar that does not exist (F45) |
| Temple extensions | `--temple-gold`, `-gold-light`, `-gold-dark`, `--temple-saffron`, `-saffron-light`, `--temple-deep-red`, `--temple-maroon`, `--temple-cream`, `--temple-warm-white` (9) | consumed only by the hand-written utility classes below |

`.dark` at `:195-228` redeclares 31 of the same names and is never activated (F13).

**Radius - one scalar and a derived scale.** `--radius: 0.75rem` (`app/globals.css:171`); `@theme inline` at
`app/globals.css:119-125` derives
`--radius-sm` (×0.6), `-md` (×0.8), `-lg` (×1), `-xl` (×1.4), `-2xl` (×1.8), `-3xl` (×2.2), `-4xl` (×2.6).
Components ignore it and hardcode `rounded-lg`/`rounded-2xl`/`rounded-3xl`.

**Shadow - there are no shadow tokens.** No `--shadow-*` custom property exists anywhere. Eight literal `box-shadow`
/ `text-shadow` declarations are baked into utility classes (`:318, :337, :384, :388, :392, :397, :436, :609`) and
everything else uses Tailwind's `shadow-lg`/`shadow-2xl` defaults. A redesign that wants an elevation scale must
create one.

**Spacing.** No spacing tokens; Tailwind v4 defaults only (no `tailwind.config.*` exists).

**Hand-written utility classes.** 61 class selectors in `app/globals.css` (≈40 distinct names), grouped:
scroll (`.scrollbar-thin`, `.scrollbar-hide`, `.smooth-scroll`, `.overscroll-contain`), script
(`.kannada-text`, `.sanskrit-content`, `.shloka-text`, `.font-kannada`), backgrounds (`.bg-sacred-gradient`,
`.bg-temple-hero`, `.bg-temple-card`), glow (`.glow-gold`, `.glow-gold-intense`, `.glow-saffron`, `.text-glow-gold`,
`.text-gradient-gold`, `.btn-glow-hover`), borders (`.border-sacred`, `.border-sacred-light`,
`.border-sacred-gradient`, `.border-ornament`), cards (`.temple-card`, `.temple-card-glass`), dividers/patterns
(`.sacred-divider`, `.sacred-pattern`, `.underline-animate`), motion (`.animate-pulse-ring`,
`.animate-float-gentle`, `.animate-shimmer`, `.animate-flicker`, `.section-fade-in`, 6 `@keyframes`), a11y
(`.sr-only:focus-visible`, `.focus-ring-temple`), loading (`.skeleton-temple`).

**The token system is not what ships.** Measured 2026-09-19: **5,471** literal `amber-*`/`orange-*`/`stone-*` class
occurrences under `components/` + `app/`, and `app/layout.tsx:81` pins `bg-stone-50 text-stone-900` on `<body>`
over the token rule at `app/globals.css:234-236` (F12).

## Data flow

### Flow 1 - Application boot and sign-in state

1. `app/layout.tsx:73` renders on the server; `next/font` injects `--font-inter`, `--font-heading`, `--font-kannada`
   (`app/layout.tsx:13-29`) as body classes.
2. `AuthProvider` mounts client-side (`context/AuthContext.tsx:82`). It reads the module singleton `auth` from
   `lib/firebase.ts:220`. If `auth` is null it gives up and sets `loading=false` (`AuthContext.tsx:84-89`).
3. `initializeAuthPersistence(auth)` (`lib/firebase.ts:100`) sets `browserLocalPersistence`, falling back to session.
4. `onAuthStateChanged` fires (`AuthContext.tsx:101`); on a user it calls `loadProfile(uid)` ->
   `authService.getUserProfile(uid)` (M10) -> Firestore collection `users`.
5. Role booleans are derived synchronously from `profile.role` via `normalizeRole` from `types/user.ts`
   (`AuthContext.tsx:156-166`): `canAccessAdmin`, `canAccessSettings`, `canAccessFinance`, `canManageUsers`,
   `canAccessBilling`, `canAccessAdministration`.
6. `ProfileProvider` observes `user` (`context/ProfileContext.tsx:70-85`) and calls
   `profileService.getProfile(uid)`; if absent it **creates** a profile with `profileService.saveProfile`
   (`ProfileContext.tsx:99-109`).
7. Consumers read it through `useAuth()` (`hooks/useAuth.ts:5`, a one-line alias of `useAuthContext`) or
   `useProfile()` (`ProfileContext.tsx:261`).

### Flow 2 - Rendering a public page's chrome

1. The page component itself imports `Navbar` and `Footer` (e.g. `app/(public)/about/page.tsx:5-6`).
2. `Navbar` mounts, runs `settingsService.getSocialLinks()` (`Navbar.tsx:67`) -> `settings` collection, to replace one
   hardcoded YouTube URL (`Navbar.tsx:55`). This is one Firestore read per page load per visitor.
3. `Footer` mounts and calls `getDoc(doc(db, "settings", "footer"))` directly (`Footer.tsx:70-71`), merging over
   `defaultData` (`Footer.tsx:27-57`). A second Firestore read per page load.
4. Scroll listeners drive the sticky header state (`Navbar.tsx:85-93`) and `GoUpButton` visibility
   (`GoUpButton.tsx:11-18`).

### Flow 3 - Page-view analytics (runs twice)

1. `proxy.ts:105-111` intercepts every non-static, non-API GET and calls `trackPageView`, which `addDoc`s into
   `page_views` using the **client** Firebase SDK inside the proxy runtime (`proxy.ts:58-76`).
2. Independently, `app/(public)/layout.tsx` renders `PageViewTracker`, which on every pathname change calls
   `trackPageView` from `services/pageviews.service.ts` (`components/analytics/PageViewTracker.tsx:11-25`).
3. Both write to Firestore. `CLAUDE.md` records `page_views` at ~47k documents against a 50k/day free-tier read budget;
   this double-write is the mechanism.

### Flow 4 - Uploading an image from an admin form

1. Admin drops a file on `ImageUploader` (`components/ui/ImageUploader.tsx:91`) or picks one (`:99`).
2. `handleFile` validates type and `maxSizeMB` (default 5) (`:40-51`).
3. The file is read to a base64 data URL with `FileReader` (`:82-89`).
4. `storageService.generateFilename(...)` then `storageService.uploadBase64Image(base64, filename, folder)`
   (`:61-71`) - `services/storage.service.ts` (M10), which fronts Vercel Blob.
5. The returned `result.url` is handed back through `onChange(url)`; the form stores a URL string.
6. `VideoUploader` (`components/ui/VideoUploader.tsx:61`) calls `storageService.uploadVideo(file)` with a **fake**
   progress bar driven by `setInterval` (`:56-58`).

### Flow 5 - Showing a toast

1. Live path: any component does `import toast from "react-hot-toast"` (e.g.
   `components/common/FavoriteButton.tsx:7,55`) and the `<Toaster>` mounted at `app/layout.tsx:91` renders it with
   inline style tokens (white bg, 12px radius, `#16a34a`/`#dc2626` icons).
2. Dead path: `components/ui/toast.tsx:142` exports a shadcn-style `toast()`/`useToast()` reducer store;
   `components/ui/use-toast.ts` re-exports it; `components/ui/toaster.tsx:13` renders it - and **nothing imports
   `toaster.tsx`**, so this 325-line system never reaches the DOM. `ToastViewport` even returns `null`
   (`toast.tsx:274`).

### Flow 6 - Server-side Firestore access

1. Route handlers/server code that need elevated access call `getAdminFirestore()` (`lib/admin-firebase.ts:115`),
   which tries env credentials, then `firebase-admin.json` on disk, then ADC (`:54-100`).
2. A second server path exists: `lib/firebase-admin-rest.ts` (guarded by `import "server-only"`, `:5`) mints a
   Google access token via `google-auth-library` and speaks the Firestore REST v1 API directly
   (`:9-25`, `addDocument`/`updateDocument`/`deleteDocument`/`getDocuments`).
3. A third, unintended path: `lib/firebase.ts:95` initialises the **client** SDK `db` on the server too, so any server
   component or route that imports `db` reads Firestore as an unauthenticated client subject to `firestore.rules`.

## Key files

| File | Lines | Role | Key exports | Notes |
|---|---:|---|---|---|
| `app/layout.tsx` | 128 | Root document + provider stack | `metadata`, `RootLayout` | Server component; hardcodes `bg-stone-50 text-stone-900` on `<body>`, bypassing the CSS tokens (`:81`) |
| `app/globals.css` | 717 | All design tokens + 40 utility classes | - | `@import "tailwindcss"` sits at line 77, **after** 76 lines of CSS rules |
| `next.config.ts` | 66 | Images + security headers | `nextConfig` | CSP allows `'unsafe-inline' 'unsafe-eval'` for scripts (`:34`) |
| `proxy.ts` | 122 | Next 16 proxy (ex-middleware) | `proxy` (default) | Hardcoded Firebase config fallbacks (`:8-13`); second CSP (`:38`) |
| `tsconfig.json` | 2 (minified) | strict TS, `@/*` paths | - | `exclude: ["node_modules","tests/**/*","jest.config.ts","scripts/**/*"]` - tests and scripts are never type-checked |
| `eslint.config.mjs` | 38 | next core-web-vitals + ts | `eslintConfig` | Turns `@typescript-eslint/no-explicit-any` **off** for `services/ types/ hooks/ scripts/ app/ components/ lib/` (`:18-34`) |
| `package.json` | 100 | Deps and scripts | - | Next 16.2.9, React 19.2.4, Tailwind 4, `@base-ui/react` 1.6, framer-motion 12; script is `typecheck`, docs say `type-check` |
| `components.json` | 26 | shadcn CLI config | - | `style: "base-rhea"`, `rsc: true`, `baseColor: "neutral"`, empty `tailwind.config` (v4, no config file) |
| `postcss.config.mjs` | 8 | Tailwind v4 postcss plugin | `config` | - |
| `components/ui/button.tsx` | 66 | **The** button (86 importers) | `Button` | Hand-rolled; hardcoded `orange-600`/`stone-700`, ignores the token system |
| `components/ui/card.tsx` | 64 | Plain card set | `Card`,`CardHeader`,`CardTitle`,`CardDescription`,`CardContent`,`CardFooter` | Hardcoded `stone-200`/white; no variants despite docs |
| `components/ui/input.tsx` | 45 | Input with label+error (40 importers) | `Input` | Wraps itself in a `div.space-y-2`, so `className="hidden"` hides only the input |
| `components/ui/textarea.tsx` | 37 | Token-styled textarea (24 importers) | `Textarea` | Mixes tokens (`bg-input/50`) with `border-stone-300` |
| `components/ui/label.tsx` | 21 | shadcn label (15 importers) | `Label` | Pure tokens |
| `components/ui/badge.tsx` | 53 | base-ui `useRender` badge | `Badge`, `badgeVariants` | Calls a hook but has **no** `"use client"` |
| `components/ui/select.tsx` | 202 | base-ui select, full portal/positioner | 10 `Select*` | The most correct primitive in the kit |
| `components/ui/switch.tsx` | 33 | base-ui switch | `Switch` | Pure tokens, `sm`/`default` sizes |
| `components/ui/checkbox.tsx` | 44 | base-ui checkbox | `Checkbox`, `CheckboxIndicator` | - |
| `components/ui/dialog.tsx` | 170 | base-ui dialog | 10 `Dialog*` | `if (isControlled && !open) return null` (`:14`) short-circuits base-ui's own state and kills exit animation |
| `components/ui/dropdown-menu.tsx` | 144 | **Stub** menu | 8 `DropdownMenu*` | Plain `div`s, no open state, no portal, no keyboard, no ARIA |
| `components/ui/tabs.tsx` | 77 | **Stub** tabs | `Tabs`,`TabsList`,`TabsTrigger`,`TabsContent` | `value` discarded, `data-state="active"` hardcoded (`:44`) |
| `components/ui/table.tsx` | 117 | shadcn table | 8 `Table*` | Token-based, horizontal scroll wrapper |
| `components/ui/toast.tsx` | 286 | Second (dead) toast system | `reducer`, `ToastProps`, `useToast`, `toast`, `Toast*` | `ToastViewport` returns null; `toast-close=""` is an invalid DOM attribute (`:262`) |
| `components/ui/toaster.tsx` | 36 | Renderer for the dead toast system | `Toaster` | No importer |
| `components/ui/use-toast.ts` | 3 | Re-export shim | - | - |
| `components/ui/spinner.tsx` | 6 | Orange spinner | `Spinner` (default) | No importer |
| `components/ui/TempleButton.tsx` | 126 | Decorative gradient button | `TempleButton` (default) | `outline` variant uses the non-existent class `border-gradient-to-r` (`:60`) |
| `components/ui/TempleCard.tsx` | 174 | Decorative card set | `TempleCard`(default),`TempleCardHeader/Content/Footer` | Uses a raw `<a href>` (`:92`) instead of `next/link`; no importer |
| `components/ui/AnimateIn.tsx` | 163 | Viewport reveal wrappers | `AnimateIn`,`StaggerIn`,`StaggerItem` | Reachable only via the unused barrel |
| `components/ui/PageTransition.tsx` | 141 | Route/section transitions | `PageTransition`,`PageLoader`,`SectionTransition` | `SectionTransition` animates to `{...getInitialPosition(), y:0, x:0}` - the spread is immediately overridden (`:123`) |
| `components/ui/MicroInteractions.tsx` | 358 | 7 animated primitives | `AnimatedButton`,`AnimatedCard`,`IconButton`,`AnimatedInput`,`AnimatedToggle`,`AnimatedCheckbox`,`AnimatedLink` | A third button and a third input; no importer |
| `components/ui/DeepaFlame.tsx` | 257 | Canvas diya flame | `DeepaFlame` | `<canvas>` + `requestAnimationFrame`; used by one M02 page |
| `components/ui/FloatingParticles.tsx` | 300 | Canvas particle field | `FloatingParticles`,`FloatingElement`,`FloatingDots` | Canvas + rAF; 30 particles by default |
| `components/ui/GoUpButton.tsx` | 54 | Scroll-to-top FAB | `GoUpButton` | Used by both the public and admin layouts |
| `components/ui/ImageUploader.tsx` | 211 | Drag/drop image upload | `ImageUploader` (default) | Uses raw `<img>` (`:132`,`:138`), base64 round-trip |
| `components/ui/VideoUploader.tsx` | 225 | Drag/drop video upload | `VideoUploader` (default) | Simulated progress (`:56-58`) |
| `components/ui/animations.ts` | 15 | Barrel over 5 animation modules | re-exports | No `"use client"`, no importer |
| `components/ui/form/FormContainer.tsx` | 23 | `<form>` shell | `FormContainer` (default) | - |
| `components/ui/form/FormSection.tsx` | 32 | Titled card section | `FormSection` (default) | Only server component in the form kit |
| `components/ui/form/FormGroup.tsx` | 54 | label/helper/error shell | `FormGroup` (default) | - |
| `components/ui/form/FormTextField.tsx` | 59 | Text input | `FormTextField` (default) | Duplicates `FormGroup` markup inline |
| `components/ui/form/FormTextArea.tsx` | 53 | Textarea | `FormTextArea` (default) | - |
| `components/ui/form/FormNumberField.tsx` | 53 | Number input | `FormNumberField` (default) | Misindented prop `error` at `:18` |
| `components/ui/form/FormSelectField.tsx` | 70 | Native select | `SelectOption`, `FormSelectField` (default) | Not the base-ui `Select` |
| `components/ui/form/FormSwitchField.tsx` | 41 | Native checkbox "switch" | `FormSwitchField` (default) | Not the base-ui `Switch`; hardcodes the labels "Active"/"Inactive" |
| `components/ui/form/FormActions.tsx` | 39 | Cancel/Submit row | `FormActions` (default) | - |
| `components/layout/Navbar.tsx` | 634 | Public sticky header | `Navbar` (default) | 5 hardcoded menu arrays; desktop and mobile menus duplicated; no auth awareness |
| `components/layout/Footer.tsx` | 269 | Public footer | `Footer` (default) | Direct Firestore read (`:70`); unused `loading` state (`:61`) |
| `components/common/A11yProvider.tsx` | 242 | A11y context + helpers | `A11yProvider`,`useA11y`,`SkipLink`,`VisuallyHidden`,`FocusTrap`,`LiveRegion`,`HighContrastIndicator`,`KeyboardShortcutsHelp` | `FocusTrap` reads `children.props.ref` (`:127`) and is a no-op; `announce()` pushes JSON into a live region (`:39`) |
| `components/common/SkeletonLoader.tsx` | 154 | Skeleton set | `Skeleton`,`CardSkeleton`,`ListSkeleton`,`ProfileSkeleton`,`TableSkeleton`,`ContentSkeleton` | Uses `bg-stone-200`, not the `.skeleton-temple` class in globals.css |
| `components/common/SectionHeading.tsx` | 24 | h2 + subtitle | `SectionHeading` (default) | 8 importers; only server component in `common/` |
| `components/common/FavoriteButton.tsx` | 146 | Heart toggle | `FavoriteButton`,`FavoriteIcon` | Reads `favorites`, writes `bookmarks` - the two never agree |
| `components/common/LanguageSwitcher.tsx` | 140 | Locale picker | `LanguageSwitcher` (+default), `LanguageBadge` | The best-behaved dropdown in the repo (`aria-haspopup`, `role="listbox"`, `aria-selected`) |
| `components/common/OptimizedImage.tsx` | 76 | next/image + blur-in | `OptimizedImage`,`generateBlurPlaceholder` | `generateBlurPlaceholder` uses `Buffer` in a `"use client"` file; no importer |
| `components/common/LazyLoad.tsx` | 70 | IntersectionObserver gate | `LazyLoad`,`LazyComponent` | `LazyComponent` renders with no props; no importer |
| `components/common/PersonalizedHomepage.tsx` | 344 | Signed-in dashboard blocks | `PersonalizedHomepage`,`PersonalizedCard` | Calls event/quote/knowledge services; no importer |
| `components/common/Search/GlobalSearch.tsx` | 379 | Search overlay | `GlobalSearch` | Duplicate of `components/search/GlobalSearch.tsx` (350 lines); **neither** is imported |
| `components/debug/ClientEnvDebug.tsx` (adopted) | 22 | Env var dump | default | Prints the public Firebase config to the page; no route mounts it |
| `context/AuthContext.tsx` | 204 | Firebase auth + role flags | `AuthProvider`,`useAuthContext` | 13 importers; `console.log` at `:85`,`:96` |
| `context/ProfileContext.tsx` | 270 | Devotee profile + preferences | `ProfileProvider`,`useProfile` | 10 importers; `useRouter`/`useCallback` imported unused (`:9`,`:20`,`:63`); `any` at `:52`,`:216`,`:228` |
| `hooks/useAuth.ts` | 8 | Alias for `useAuthContext` | `useAuth` | 22 importers |
| `hooks/a11y/index.ts` | 314 | 8 accessibility hooks | `useHighContrast`,`useAccessibleColors`,`useFocusTrap`,`useKeyboardNavigation`,`useAnnounce`,`useSkipLink`,`useKeyboardNavigationMode`,`useRovingTabIndex` | Only 2 of 8 are used, both by `A11yProvider`; `useRovingTabIndex(items: any[])` (`:261`) |
| `hooks/useReducedMotion.ts` | 53 | prefers-reduced-motion | `useReducedMotion`,`useMotionConfig` | Returns a boolean - the docs' destructuring example is wrong |
| `hooks/useInViewAnimation.ts` | 105 | In-view / scroll / parallax | `useInViewAnimation`,`useScrollProgress`,`useParallax` | Non-passive-free scroll handlers; no importer |
| `hooks/useGallery.ts` | 77 | Live gallery listener | `useGallery` | `onSnapshot` on `galleryMedia` directly - no service; no importer |
| `hooks/useHomepage.ts` | 77 | Homepage config listener | `useHomepage` | Dynamic-imports firebase inside the effect (`:26-27`) |
| `hooks/useFinanceSettings.ts` | 73 | Finance settings | `useFinanceSettings` | Direct `getDoc` on `settings/financeSettings` (`:22`) |
| `hooks/useDonationNotifications.ts` | 99 | Recent donations | `useDonationNotifications` | Polls Firestore every 60s for 20 docs (`:75`) |
| `hooks/useCrudTable.ts` | 30 | TanStack table wrapper | `useCrudTable` | No importer |
| `utils/event.ts` | 150 | Event status/date helpers | `getEventStatus`,`getDaysLeft`,`sortEventsByDate`,`getFeaturedEvents`,`getUpcomingEvents`,`getOngoingEvents`,`getCompletedEvents` | The only real logic in `utils/` |
| `utils/redirect.ts` | 27 | Role -> dashboard route | `getDashboardRoute` | Roles `temple_admin`/`priest`/`staff` do not match `normalizeRole`'s vocabulary; no importer |
| `lib/firebase.ts` | 222 | Client Firebase singleton (78 importers) | `getFirebaseConfigStatus`,`initializeAuthPersistence`,`getNextUpcomingEvent`,`app`,`auth`,`db`,`storage`,`isFirebaseConfigured`,`validateFirebaseConfig` | Hardcoded prod config fallbacks (`:58-64`); `getNextUpcomingEvent` reads the whole `events` collection (`:156`) |
| `lib/admin-firebase.ts` | 158 | firebase-admin bootstrap | `initializeAdminApp`,`getAdminFirestore`,`isAdminAvailable`,`getInitError`,`getAdminApp`,`getAdmin`,`adminApp`,`adminDb` | Falls back to `"invalid-key"` and reads `NEXT_PUBLIC_FIREBASE_PRIVATE_KEY` (`:56`) |
| `lib/firebase-admin-rest.ts` | 144 | Firestore REST v1 admin | `addDocument`,`updateDocument`,`deleteDocument`,`getDocuments` | `import "server-only"`; `require()` inside ESM (`:10`); numbers always serialise as `integerValue` (`:122`) |
| `lib/rate-limit.ts` | 128 | In-memory limiter | `RateLimitConfig`,`RateLimitResult`,`rateLimit`,`getClientIP`,`createRateLimitResponse` | Per-instance `Map` (`:11`); module-scope `setInterval` (`:29`) |
| `lib/utils.ts` | 26 | `cn` + a `formatDate` (22 importers) | `cn`,`formatDate` | `cn` = clsx + tailwind-merge |
| `lib/format.ts` | 85 | INR/date/number formatters | `formatCurrency`,`formatDate`,`formatDateTime`,`formatBoolean`,`formatNumber` | The most complete `formatDate`; handles serialised Timestamps |
| `lib/date.ts` | 14 | Timestamp date formatter | `formatEventDate` | Third date formatter; no importer |
| `lib/formStyles.ts` | 3 | The documented "design tokens" | `formControlClass` | **No importer**; AGENTS.md:297 and docs/CODING-STANDARDS.md:94 both mandate it |
| `lib/animations.ts` | 288 | 25 framer-motion variants | `ANIMATION_DURATION`,`EASING`,`fadeIn`…`createStaggerChildren` | **No importer**; every component redefines its own variants |
| `lib/auth.ts` | 134 | Second auth implementation | `registerUser`,`loginUser`,`logoutUser`,`resetPassword`,`resendVerification` | **No importer**; duplicates `services/auth.service.ts` and writes `users` docs client-side |
| `lib/config.ts` | 17 | Site config | `SITE` | Duplicates `lib/constants.ts`; no importer |
| `lib/constants.ts` | 7 | Temple config | `TEMPLE` | Same lat/lon/timezone as `SITE`; no importer |
| `lib/options.ts` | 7 | Seva category options | `sevaCategories` | No importer |
| `lib/sevas.ts` | 91 | Hardcoded seva list + fs scan | `SevaItem`,`getSevas` | Prices (`₹501`…) hardcoded in `lib/`; `readdirSync` at `:1` |
| `lib/gallery.ts` | 47 | fs scan of `public/images/temple` | `GalleryItem`,`getTempleGalleryImages` | Node-only, no `server-only` guard |
| `lib/festival-utils.ts` | 171 | Calendar -> Festival transform | `transformFestivals`,`getAllFestivals` | Reads `data/calendar.ts` (M11/M14) |
| `lib/panchanga-cache.ts` | 47 | Panchanga fallback | `PanchangaData`,`getCachedPanchanga`,`getPanchangaWithFallback` | `getCachedPanchanga` always returns em-dashes - a cache that caches nothing |
| `lib/crud-columns.tsx` | 28 | CrudColumn -> TanStack ColumnDef | `createCrudColumns` | Imports `components/admin/crud/CrudTableCell` (M05); no importer |

## Types and stores

**Types consumed from M10/others** (M01 defines almost no domain types of its own):

| Type | From | Used by |
|---|---|---|
| `UserProfile`, `UserRole`, `NormalizedRole`, `normalizeRole` | `types/user.ts` | `context/AuthContext.tsx:19`, `utils/redirect.ts:1` |
| `DevoteeProfile`, `UserPreferences`, `Theme`, `DEFAULT_USER_PREFERENCES` | `types/profile.ts` | `context/ProfileContext.tsx:13-18` |
| `Locale` | `lib/i18n` (M13) | `context/ProfileContext.tsx:19`, `components/common/LanguageSwitcher.tsx:4` |
| `GalleryMedia` | `types/gallery.ts` | `hooks/useGallery.ts:13` |
| `HomepageConfig` | `types/homepage.ts` | `hooks/useHomepage.ts:5` |
| `FinanceSettings`, `defaultFinanceSettings` | `types/finance.ts` | `hooks/useFinanceSettings.ts:6` |
| `TempleEvent`, `EventStatus` | `types/event.ts` | `utils/event.ts:2` |
| `Festival` | `types/festival.ts` | `lib/festival-utils.ts:6` |
| `CrudColumn` | `types/crud.ts` | `lib/crud-columns.tsx:4` |
| `UploadFolder` | `services/storage.service.ts` | `components/ui/ImageUploader.tsx:8` |

**Types defined in M01**: `SelectOption` (`components/ui/form/FormSelectField.tsx:10`), `ToastProps`
(`components/ui/toast.tsx:197`), `NextEventInfo` (`lib/firebase.ts:125`), `RateLimitConfig`/`RateLimitResult`
(`lib/rate-limit.ts:32,37`), `PanchangaData` (`lib/panchanga-cache.ts:1`), `GalleryItem` (`lib/gallery.ts:15`),
`SevaItem` (`lib/sevas.ts:15`), `A11yContextType` (`components/common/A11yProvider.tsx:6`), `FooterData`
(`components/layout/Footer.tsx:11`), `DropdownItem` (`components/layout/Navbar.tsx:10`).

**Stores touched directly by M01 code**:

| Store | Path | Access | Where |
|---|---|---|---|
| Firestore `page_views` | collection | write (addDoc) | `proxy.ts:72` |
| Firestore `settings/footer` | document | read | `components/layout/Footer.tsx:70-71` |
| Firestore `settings/financeSettings` | document | read | `hooks/useFinanceSettings.ts:22-23` |
| Firestore `settings` (social links) | via `settingsService` | read | `components/layout/Navbar.tsx:67` |
| Firestore `galleryMedia` | collection | read (onSnapshot) | `hooks/useGallery.ts:36,42` |
| Firestore `homepage/config` | document | read (onSnapshot) | `hooks/useHomepage.ts:36` |
| Firestore `donations` | collection | read (getDocs, 60s poll) | `hooks/useDonationNotifications.ts:32-38` |
| Firestore `events` | collection | read (full scan) | `lib/firebase.ts:156` |
| Firestore `users` | document | read+write | `lib/auth.ts:44,86,92` (dead code) |
| Firebase Auth | - | read/write | `context/AuthContext.tsx`, `lib/auth.ts` |
| Vercel Blob | via `storageService` | write | `components/ui/ImageUploader.tsx:67`, `components/ui/VideoUploader.tsx:61` |
| Filesystem `public/images/temple` | `readdirSync` | read | `lib/gallery.ts:22-29` |
| Filesystem `public/images` (sevas) | `readdirSync` | read | `lib/sevas.ts:1` |
| `localStorage` `recentSearches` | browser | read/write | `components/common/Search/GlobalSearch.tsx:48,57,187` |
| `data/calendar.ts` | static module | read | `lib/festival-utils.ts:7` |
| In-process `Map` | memory | read/write | `lib/rate-limit.ts:11` |

No Supabase access exists in M01 (the `@supabase/*` packages in `package.json:37-38` are used by M11).

## Cross-module dependencies

**M01 imports from other chunks** (from `.claude/state/inventory/import-graph.json`):

| M01 file | Imports | Owner |
|---|---|---|
| `app/layout.tsx` | `components/ai/AIChatProvider.tsx`, `components/ai/ChatWidget.tsx` | M09 |
| `context/AuthContext.tsx` | `services/auth.service.ts`, `types/user.ts` | M04 / M10 |
| `context/ProfileContext.tsx` | `services/profile.service.ts`, `types/profile.ts`, `lib/i18n/index.ts` | M03 / M10 / M13 |
| `components/layout/Navbar.tsx` | `services/settings.service.ts` | M05 / M10 |
| `components/ui/ImageUploader.tsx`, `components/ui/VideoUploader.tsx` | `services/storage.service.ts` | M06 / M10 |
| `components/common/PersonalizedHomepage.tsx` | `services/event.service.ts`, `services/quote.service.ts`, `services/knowledge.service.ts` | M02 / M03 / M08 / M10 |
| `components/common/LanguageSwitcher.tsx` | `lib/i18n/index.ts` | M13 |
| `hooks/useHomepage.ts` | `services/homepage.service.ts`, `types/homepage.ts` | M02 / M10 |
| `hooks/useGallery.ts`, `hooks/useFinanceSettings.ts` | `types/gallery.ts`, `types/finance.ts` | M06 / M07 / M10 |
| `utils/event.ts`, `utils/redirect.ts` | `types/event.ts`, `types/user.ts` | M06 / M10 |
| `lib/festival-utils.ts` | `types/festival.ts`, `data/calendar.ts` | M10 / M11 / M14 |
| `lib/crud-columns.tsx` | `components/admin/crud/CrudTableCell.tsx`, `types/crud.ts` | M05 |

**Who imports M01** (importer counts from the graph; the heaviest first):

| M01 file | Importers | Consuming chunks |
|---|---:|---|
| `components/ui/button.tsx` | 86 | M01-M07, M13 |
| `lib/firebase.ts` | 78 | M01-M12, M14, M15 |
| `components/ui/input.tsx` | 40 | M01-M07 |
| `components/layout/Navbar.tsx` / `Footer.tsx` | 29 each | M02, M03, M13 |
| `components/ui/textarea.tsx` | 24 | M02, M05, M06, M07 |
| `hooks/useAuth.ts` | 22 | M02, M04, M05, M06, M07 |
| `lib/utils.ts` (`cn`) | 22 | M01, M05, M09, M13 |
| `components/ui/label.tsx` | 15 | M01, M04, M06, M07 |
| `components/ui/dialog.tsx` | 14 | M06, M07, M13 |
| `context/AuthContext.tsx` | 13 | M01-M05, M09, M13 |
| `components/ui/form/FormSection.tsx` | 12 | M05, M06, M07 |
| `components/ui/form/FormTextField.tsx` / `FormTextArea.tsx` | 10 each | M05, M06, M07 |
| `components/ui/switch.tsx` | 10 | M02, M06, M07, M13 |
| `context/ProfileContext.tsx` | 10 | M01, M02, M03, M13 |
| `lib/admin-firebase.ts` | 9 | M07, M08, M12, M14 |
| `components/ui/select.tsx` | 8 | M02, M06, M07 |
| `components/common/SectionHeading.tsx` | 8 | M02, M03 |
| `components/ui/table.tsx`, `ImageUploader.tsx` | 3 each | M06, M07 |
| `lib/format.ts` | 3 | M05, M07 |
| `lib/rate-limit.ts` | 2 | M04, M12 |
| `lib/firebase-admin-rest.ts` | 2 | M09, M12 |
| `lib/panchanga-cache.ts` | 1 | M08 |

`components/ui/button.tsx` and `lib/firebase.ts` are the two true chokepoints: changing either touches every chunk.

## How to change it

### Recipe A - Add a top-level navigation item

1. `components/layout/Navbar.tsx:16` - add to `menuItems` (flat link) **or** to one of `guruParamparaDropdown` (`:21`),
   `calendarDropdown` (`:27`), `aboutDropdown` (`:32`), `onlineServicesDropdown` (`:39`), or the in-render
   `eventsDropdown` (`:78`).
2. If it is a new dropdown: add `useState` (near `:50-54`), a `useRef` (near `:56-60`), a clause in the click-outside
   effect (`:123-144`), an `isXActive` predicate (`:146-150`), the desktop block (pattern at `:206-244`), and the mobile
   block (pattern at `:475-498`). Two renders, always.
3. `components/layout/Footer.tsx:36-54` - mirror it into `quickLinks` / `sevasLinks` / `calendarLinks` if it should
   appear in the footer, and remember Firestore `settings/footer` can override the whole object (`Footer.tsx:73`).
4. Create the route under `app/(public)/<slug>/page.tsx` (M02/M03) and, because there is no shared chrome, import
   `Navbar` and `Footer` into that page yourself.

### Recipe B - Add a field to an admin form

1. `components/ui/form/` - reuse `FormTextField` / `FormTextArea` / `FormNumberField` / `FormSelectField` /
   `FormSwitchField`. Only add a new file if none fit.
2. A new field must wrap `FormGroup` (`components/ui/form/FormGroup.tsx:16`) for label/required/helper/error, and use the
   same control classes; the canonical string lives in `lib/formStyles.ts:1` - import it instead of re-pasting the
   classes (four files currently re-paste them).
3. Wire it into the page's form under a `FormSection`, and extend the matching type in `types/` (M10) and the service
   (M10) so the value persists.

### Recipe C - Change a colour or a radius

1. Decide which system you are touching. Ranked by real-world reach:
   - **Hardcoded Tailwind classes** (`amber-*`, `orange-*`, `stone-*`) in components - this is what users actually see.
   - `app/globals.css:128-193` `:root` tokens - drive base-ui primitives (`badge`, `switch`, `select`, `dialog`, `table`).
   - `app/globals.css:184-192` `--temple-*` extensions - only used by the hand-written utility classes below.
2. Radius: `--radius: 0.75rem` (`app/globals.css:171`) feeds the `--radius-sm…4xl` scale (`:119-125`). Component-level
   radii (`rounded-2xl`, `rounded-3xl`) are hardcoded and ignore it.
3. `app/layout.tsx:81` hardcodes `bg-stone-50 text-stone-900` on `<body>`, overriding `@layer base` `bg-background`
   (`app/globals.css:234-236`). Remove that to make the token system take effect.
4. Grep before shipping: `grep -rno "amber-[0-9]\{2,3\}\|orange-[0-9]\{2,3\}\|stone-[0-9]\{2,3\}" components app | wc -l`
   - **measured 2026-09-19: 5,471 literal palette-class occurrences** under `components/` + `app/`. That, not the
   token block, is the redesign's true surface area.

### Recipe D - Add a new provider to the app shell

1. `app/layout.tsx:6-10` - import it.
2. Insert it inside the existing nesting (`:83-123`). Order matters: anything needing auth must sit inside
   `AuthProvider`; anything needing the devotee profile inside `ProfileProvider`.
3. Mark the provider file `"use client"`; `app/layout.tsx` itself must stay a server component to keep `metadata`.
4. If the provider holds state that re-renders often, memoise its `value` - neither `AuthContext` nor `ProfileContext`
   does, so every consumer re-renders on any change.

### Recipe E - Add a shared UI primitive

1. Check `components/ui/` first - the kit already has two buttons (`button.tsx`, `TempleButton.tsx`), three inputs
   (`input.tsx`, `FormTextField.tsx`, `AnimatedInput`), two cards and two toasts.
2. Prefer `@base-ui/react` (the style in `components.json:3` is `base-rhea`) and token classes
   (`bg-primary`, `text-muted-foreground`, `border-border`), not literal palette classes.
3. Any component calling a hook - including base-ui's `useRender` - needs `"use client"` at the top
   (`components/ui/badge.tsx` is the counter-example).
4. Export named, not default; the kit is inconsistent and the default exports force import renaming.

### Recipe F - Change a security header or the CSP

1. `next.config.ts:3-36` is the authoritative list applied to `/:path*`.
2. `proxy.ts:32-39` sets an **older, narrower** copy on every response. Update both or, better, delete the proxy copy.
3. Test both header sets: a directive present in one and absent in the other will behave differently depending on which
   layer wins for a given path.

### Recipe G - Add a global hook or context consumer

1. Hooks live flat in `hooks/` (`hooks/a11y/` is the only subfolder). Name `useX.ts`, mark `"use client"`.
2. Data-fetching hooks must call a service in `services/` (M10) - `useGallery`, `useFinanceSettings` and `Footer` break
   this rule and talk to `firebase/firestore` directly; do not copy them, copy `hooks/useHomepage.ts`'s service usage.
3. Export the hook, then consume via `useAuth()` / `useProfile()` for identity rather than re-reading Firebase.

## Faults, smells and risks

| id | sev | What | Evidence | Direction |
|---|---|---|---|---|
| M01-F01 | HIGH | Production Firebase config (apiKey, projectId, appId, senderId) hardcoded as env fallbacks in two files, so the app silently runs against the live project when env vars are missing | `lib/firebase.ts:58-64`, `proxy.ts:8-13` | Fail fast on missing env; delete the literals; rotate if the repo was ever public |
| M01-F02 | HIGH | Admin SDK accepts `NEXT_PUBLIC_FIREBASE_PRIVATE_KEY` and falls back to the literal `"invalid-key"`, so `clientEmail && privateKey` can pass with no real key; a `NEXT_PUBLIC_` private key would be bundled to the browser | `lib/admin-firebase.ts:56-58` | Read only `FIREBASE_PRIVATE_KEY`; throw when absent |
| M01-F03 | HIGH | `components/ui/tabs.tsx` is a non-functional stub: `TabsTrigger` hardcodes `data-state="active"` and discards `value`; `TabsContent` discards `value` and always renders, so every panel shows at once | `components/ui/tabs.tsx:36-52`, `:54-68`; consumers `app/admin/quotes/new/page.tsx:20`, `app/admin/quotes/[id]/edit/page.tsx:20` | Replace with `@base-ui/react` Tabs, or add real state |
| M01-F04 | HIGH | `components/ui/dropdown-menu.tsx` is a set of plain `div`s: no open/close state, no portal, no positioning, no keyboard, no `role="menu"`; content renders permanently | `components/ui/dropdown-menu.tsx:8-40`; consumers `app/admin/quotes/page.tsx`, `components/device/LocationButton.tsx` | Replace with the base-ui menu primitive |
| M01-F05 | HIGH | The public route group renders no header or footer; 28 page files plus `components/home/HomeClient.tsx` (29 importers) import `Navbar`/`Footer` individually, so chrome changes require touching 29 files and every page re-mounts the header. **Only 24 of the 28 pages are inside `app/(public)/`**; `app/calendar/page.tsx`, `app/calendar/ekadashi/page.tsx`, `app/calendar/festivals/page.tsx` and `app/knowledge/page.tsx` sit outside it with no layout of their own, so a `(public)/layout.tsx` fix does not cover them | `app/(public)/layout.tsx:1-18`; 29 files match `components/layout/Navbar` (24 under `app/(public)/`, 4 under `app/calendar` + `app/knowledge`, 1 `components/home/HomeClient.tsx`) | Move `Navbar`/`Footer` into `app/(public)/layout.tsx`, **and** either move `calendar/` + `knowledge/` into the `(public)` group or give them a shared layout |
| M01-F06 | HIGH | Two independent page-view writers run on every public GET (proxy + client tracker), doubling Firestore writes on the collection already at ~47k docs against a 50k/day free-tier budget | `proxy.ts:105-111`, `components/analytics/PageViewTracker.tsx:11-25`; quota note in `CLAUDE.md` | Keep one; the proxy path also uses the client SDK inside the proxy runtime |
| M01-F07 | HIGH | Direct Firestore access from a component and two hooks, violating AGENTS.md "No Direct Firebase Calls - Use services only" | `components/layout/Footer.tsx:8-9,70-71`; `hooks/useFinanceSettings.ts:4-5,22-23`; `hooks/useGallery.ts:4-12,36-47` | Route through `settings.service` / `gallery.service` |
| M01-F08 | HIGH | Two conflicting CSPs and header sets are emitted - a broad one from `next.config.ts` and an older narrower one from the proxy; both allow `'unsafe-inline' 'unsafe-eval'` for scripts | `next.config.ts:33-34`, `proxy.ts:38` | Single source; drop `unsafe-eval`, move to nonces |
| M01-F09 | HIGH | `FavoriteButton` reads favourite state from `profile.favorites` but writes to the bookmarks store, so the heart never reflects a save and repeated clicks create duplicate bookmarks | `components/common/FavoriteButton.tsx:36,61-79` vs `context/ProfileContext.tsx:203-205,213-217` | Pick one store; derive `isFav` from what the button writes |
| M01-F10 | HIGH | `eslint.config.mjs` disables `@typescript-eslint/no-explicit-any` across `app/ components/ hooks/ lib/ services/ types/ scripts/` - i.e. the whole codebase - directly contradicting AGENTS.md and docs/CODING-STANDARDS.md "No `any`" | `eslint.config.mjs:18-34` vs `AGENTS.md` Quick Reference, `docs/CODING-STANDARDS.md:76` | Re-enable, fix by module, keep narrow per-file overrides |
| M01-F11 | MEDIUM | Three parallel colour systems: oklch tokens in `:root`, `--temple-*` extensions, and literal `amber-*`/`orange-*`/`stone-*` classes in components. The "primary" token is gold; the primary Button is `orange-600` | `app/globals.css:140,184-192` vs `components/ui/button.tsx:34`, `TempleButton.tsx:44` | One token layer; components consume tokens only |
| M01-F12 | MEDIUM | `<body>` hardcodes `bg-stone-50 text-stone-900`, overriding the `@layer base` token rule and neutralising the token system at the document level | `app/layout.tsx:81` vs `app/globals.css:234-236` | Remove the literal classes |
| M01-F13 | MEDIUM | A complete dark palette (**31** custom properties, counted 2026-09-19) exists under `.dark`, and no code ever adds the `dark` class; `ProfileContext.updateTheme` persists a `Theme` that nothing applies | `app/globals.css:195-228`; `context/ProfileContext.tsx:158-163`; no `.dark` toggle found in `app components hooks lib context` | Either wire a theme switch to `<html class>` or delete the dark block |
| M01-F14 | MEDIUM | `@import "tailwindcss"` and three other `@import`s appear at line 77, after 76 lines of real CSS; the CSS spec requires `@import` first, and behaviour then depends on the bundler | `app/globals.css:1-80` | Move all `@import`s to the top |
| M01-F15 | MEDIUM | `@theme inline` maps `--font-sans: var(--font-sans)` (self-referential, never defined), `--font-mono: var(--font-geist-mono)` (never defined) and `--font-heading: var(--font-sans)`, which fights the `:root` `--font-heading: "Playfair Display"` set at line 3 | `app/globals.css:3,87-89` | Map to the next/font variables actually emitted by `app/layout.tsx:13-29` |
| M01-F16 | MEDIUM | `lib/formStyles.ts` - named by AGENTS.md and docs/CODING-STANDARDS.md as *the* design tokens - has zero importers; its exact class string is re-pasted in four form fields | `lib/formStyles.ts:1`; `AGENTS.md:297`; `docs/CODING-STANDARDS.md:94`; duplicates at `FormTextField.tsx:39-46`, `FormTextArea.tsx:38-47`, `FormNumberField.tsx:38-47`, `FormSelectField.tsx:46-55` | Import it, or promote a real token module |
| M01-F17 | MEDIUM | `lib/animations.ts` defines 25 shared framer-motion variants and easing scales and is imported by nothing; every animated component redefines its own variants inline | `lib/animations.ts:4-288`; zero importers in `.claude/state/inventory/import-graph.json` | Adopt it or delete it; the redesign should not add a fourth vocabulary |
| M01-F18 | MEDIUM | An entire second toast system (reducer + components + renderer, 325 lines) is dead: `components/ui/toaster.tsx` has no importer, `ToastViewport` returns `null`, and `react-hot-toast` is the live system. `sonner` is also a dependency with zero usages | `components/ui/toast.tsx:274`, `components/ui/toaster.tsx:13`, `app/layout.tsx:91`, `package.json:68` | Delete the dead system and the unused dependency |
| M01-F19 | MEDIUM | Two full `GlobalSearch` implementations (379 + 350 lines) exist and neither is imported by any page, while `/api/search` is implemented | `components/common/Search/GlobalSearch.tsx:71`, `components/search/GlobalSearch.tsx:30`; `app/api/search/route.ts` exists | Keep one, mount it in the header, delete the other |
| M01-F20 | MEDIUM | `lib/auth.ts` is a second, unused auth implementation that writes `users` documents from the client, duplicating `services/auth.service.ts`, which `AuthContext` actually uses | `lib/auth.ts:20-133`; `context/AuthContext.tsx:14-17`; zero importers | Delete |
| M01-F21 | MEDIUM | `FocusTrap` derives its container from `(children as any)?.props?.ref` - not a real React API - so the guard never engages and modals are not trapped, despite the app advertising a11y support | `components/common/A11yProvider.tsx:120-163` | Use a `useRef` on a wrapper element, or the existing `useFocusTrap` hook (`hooks/a11y/index.ts:54`) |
| M01-F22 | MEDIUM | Two live regions are mounted at once, and `A11yProvider.announce()` pushes `JSON.stringify({message,priority})` into one of them, so a screen reader reads raw JSON; nothing ever dispatches the `a11y-announce` event the other one listens for, so it is permanently empty | `components/common/A11yProvider.tsx:39,54-63,168-192`; `app/layout.tsx:85`; no dispatcher found | One region, plain text, one `announce()` API |
| M01-F23 | MEDIUM | The Navbar's five dropdowns are `<button>` + conditional `<div>` with no `aria-expanded`, `aria-haspopup`, `role="menu"`, Escape handling or arrow-key navigation - the docs mandate all four | `components/layout/Navbar.tsx:207-218,248-259,300-310,352-362,392-401`; `docs/UI-GUIDELINES.md` "Keyboard Navigation" | Copy the pattern from `components/common/LanguageSwitcher.tsx:73-87` or use base-ui Menu |
| M01-F24 | MEDIUM | The desktop and mobile menus are two hand-maintained copies of the same five link arrays, ~190 lines each; the footer holds a third copy | `components/layout/Navbar.tsx:182-431` vs `:442-629`; `components/layout/Footer.tsx:36-54` | One `navigation.ts` config consumed by all three renders |
| M01-F25 | MEDIUM | `lib/rate-limit.ts` keeps counters in a per-process `Map`, so on Vercel's serverless/edge fan-out each instance has its own window - the limiter does not limit | `lib/rate-limit.ts:11,28-30` | Upstash/Redis, or the platform's own limiter |
| M01-F26 | MEDIUM | `getNextUpcomingEvent()` reads the entire `events` collection and filters in JS, on a project already near its read quota; it is also domain logic living in `lib/` rather than a service | `lib/firebase.ts:156,164-199` | Query with `where`/`orderBy`/`limit`; move to `event.service.ts` |
| M01-F27 | MEDIUM | `useDonationNotifications` polls Firestore every 60 seconds for 20 documents for as long as the tab is open, regardless of visibility | `hooks/useDonationNotifications.ts:32-38,75` | `onSnapshot`, or poll only when `document.visibilityState === "visible"` |
| M01-F28 | MEDIUM | Context values are rebuilt on every render in both global providers (no `useMemo`/`useCallback`), so all 13 + 10 consumer trees re-render on any auth or profile change | `context/AuthContext.tsx:168-187`, `context/ProfileContext.tsx:231-254` (note `useCallback` is imported at `:9` and never used) | Memoise the value and the callbacks |
| M01-F29 | MEDIUM | `components/ui/badge.tsx` calls base-ui's `useRender` hook but has no `"use client"` directive, so importing it from a Server Component will fail at runtime | `components/ui/badge.tsx:1-8,36` | Add `"use client"` |
| M01-F30 | MEDIUM | Raw `<img>` used in the shared uploader instead of `next/image`, against AGENTS.md's "Optimize images with next/image" | `components/ui/ImageUploader.tsx:132,138` | Use `next/image` or document the exception |
| M01-F31 | MEDIUM | `components/debug/ClientEnvDebug.tsx` renders the Firebase client configuration to the page; it is orphaned but one import away from shipping. **And the same pattern already ships**: `app/debug/page.tsx` (M05's chunk) is a live, unauthenticated route at `/debug` that prints `NEXT_PUBLIC_FIREBASE_API_KEY` and the first 20 characters of the server-only `OPENAI_API_KEY` | `components/debug/ClientEnvDebug.tsx:4-18`; `app/debug/page.tsx:4-5,26,33` | Delete both; if a diagnostics page is wanted, gate it behind `AdminAuthGuard` and never render secret-bearing env |
| M01-F32 | LOW | Three date formatters with different signatures and one dead: `formatDate` in `lib/utils.ts:8`, `formatDate`/`formatDateTime` in `lib/format.ts:45,61`, `formatEventDate` in `lib/date.ts:3` | as cited | Keep `lib/format.ts`; re-export or delete the others |
| M01-F33 | LOW | `lib/config.ts` (`SITE`) and `lib/constants.ts` (`TEMPLE`) hold the same lat/lon/timezone under different names, and neither is imported | `lib/config.ts:1-16`, `lib/constants.ts:1-6` | One config module |
| M01-F34 | LOW | Business data hardcoded in `lib/`: seva names, prices (`₹501`, `₹301`…) and durations, plus a filesystem scan | `lib/sevas.ts:24-45`; `lib/gallery.ts:22` | Move to Firestore/services; both are Node-only and lack a `server-only` guard |
| M01-F35 | LOW | `lib/panchanga-cache.ts` presents itself as a cache but `getCachedPanchanga` always returns em-dash placeholders | `lib/panchanga-cache.ts:11-21`; consumed by M08 | Rename to `panchanga-fallback`, or implement |
| M01-F36 | LOW | `utils/redirect.ts` switches on roles (`temple_admin`, `priest`, `staff`) that do not exist in `normalizeRole`'s vocabulary used by `AuthContext`; it is also unused | `utils/redirect.ts:6-25` vs `context/AuthContext.tsx:156-166` | Align with `types/user.ts` or delete |
| M01-F37 | LOW | `console.log` left in shipped shell code, against the pre-commit checklist | `context/AuthContext.tsx:85,96`; `lib/firebase.ts:110,117,147,153,158,201,208`; `hooks/useHomepage.ts:30,58` | Remove or gate behind a debug flag |
| M01-F38 | LOW | Dead imports and state: `useRouter`/`useCallback` in `ProfileContext`, `loading` state in `Footer`, `getApps` in `admin-firebase` | `context/ProfileContext.tsx:9,20,63`; `components/layout/Footer.tsx:61`; `lib/admin-firebase.ts:11` | Remove |
| M01-F39 | LOW | `TempleButton`'s `outline` variant uses `border-gradient-to-r`, which is not a Tailwind class, so the variant has no border | `components/ui/TempleButton.tsx:60` | Use a real border or a gradient-border wrapper |
| M01-F40 | LOW | `SectionTransition` spreads the initial offset into its `animate` target and then overrides it with `y:0, x:0`, so the spread is pointless and the intent is unclear | `components/ui/PageTransition.tsx:123` | Simplify to `{opacity:1, x:0, y:0}` |
| M01-F41 | LOW | `VideoUploader` shows a fabricated progress bar driven by a timer rather than real upload progress | `components/ui/VideoUploader.tsx:55-64` | Use a real progress event or an indeterminate spinner |
| M01-F42 | LOW | `tsconfig.json` excludes `tests/**/*` and `scripts/**/*`, so `npm run typecheck` never sees them | `tsconfig.json` (`exclude`) | Type-check tests and scripts in CI |
| M01-F43 | LOW | **22** source files in M01 have no importer (**2,358 lines** of dead code), including `MicroInteractions.tsx` (358), `Search/GlobalSearch.tsx` (379), `PersonalizedHomepage.tsx` (344), `lib/animations.ts` (288), `lib/auth.ts` (134), `TempleCard.tsx` (174), `AnimateIn.tsx` (163), `useInViewAnimation.ts` (105), `OptimizedImage.tsx` (76), `useGallery.ts` (77), `LazyLoad.tsx` (70), `toaster.tsx` (36), `useCrudTable.ts` (30), `crud-columns.tsx` (28), `utils/redirect.ts` (27), `lib/config.ts` (17), `ui/animations.ts` (15), `lib/date.ts` (14), `lib/constants.ts` (7), `lib/options.ts` (7), `spinner.tsx` (6), `lib/formStyles.ts` (3) | reverse map of `.claude/state/inventory/import-graph.json`; the graph lists 25 zero-importer M01 files, but `app/layout.tsx`, `proxy.ts` and `next.config.ts` are framework entry points, not dead | Delete or adopt deliberately before the redesign multiplies the confusion |
| M01-F44 | LOW | `useToast`'s subscribe effect lists `[state]` as its dependency, so it unsubscribes and resubscribes on every state change | `components/ui/toast.tsx:174-182` | `[]` (moot if F18 deletes the file) |
| M01-F45 | LOW | Documented components and APIs that do not exist: `<DataTable>`/`<DataTableHeader>`, shadcn `<Sidebar>` primitives, Card variants `flat`/`bordered`, Button sizes `md`/`lg`, `font-family: var(--font-sans)`, `const { reducedMotion } = useReducedMotion()` (the hook returns a boolean), and `npm run type-check` (the script is `typecheck`) | `docs/UI-GUIDELINES.md` (Tables, Navigation, Cards, Buttons, Typography, Reduced Motion sections) vs `components/ui/table.tsx:107-116`, `components/ui/card.tsx`, `components/ui/button.tsx:17`, `app/globals.css:87`, `hooks/useReducedMotion.ts:9`, `package.json:11`; `docs/PROJECT_STRUCTURE.md:64` lists a `components/shared/` folder that does not exist | Rewrite the docs from the code, not the other way round |
| M01-F46 | LOW | AGENTS.md declares "Next.js 14 (App Router)" while the project runs Next 16.2.9 / React 19.2.4 with the `proxy.ts` convention and Tailwind v4 (no `tailwind.config.*`) | `AGENTS.md` Tech Stack table vs `package.json:55,59,92`; `proxy.ts`; no `tailwind.config.*` at the repo root | Update AGENTS.md; it is the first file every agent reads |
| M01-F47 | MEDIUM | The globally mounted `SkipLink` always targets `#main-content`, but only `app/(public)/layout.tsx` and `app/admin/layout.tsx` render an element with that id. On `/calendar`, `/calendar/ekadashi`, `/calendar/festivals`, `/knowledge`, `/debug` and every `(auth)` route the skip link resolves to nothing, so the first keyboard stop on those pages is a dead link | `app/layout.tsx:84` + `components/common/A11yProvider.tsx:79-95`; only two `main-content` ids exist (`app/(public)/layout.tsx:12`, `app/admin/layout.tsx:26`); `app/(auth)/layout.tsx:10` renders `<main>` with no id | Put `<main id="main-content">` in every route-group layout, or give `(auth)`/`calendar`/`knowledge` layouts of their own |
| M01-F48 | LOW | `lib/auth.ts` (the dead duplicate of F20) and the directory `lib/auth/` with its own `index.ts` barrel both exist, so the specifier `@/lib/auth` is ambiguous and resolves to the **dead file**, silently shadowing `lib/auth/index.ts` (`checkAdminAuth`, `isUserAdmin`). Nothing imports the bare specifier today, so it is latent, not live | `lib/auth.ts:1`; `lib/auth/index.ts:2`; zero matches for `"@/lib/auth"` (all real importers write `@/lib/auth/admin-auth`) | Deleting `lib/auth.ts` per F20 removes the ambiguity |

**Server-Components-first (focus question 8), measured 2026-09-19**: of the **50** `.tsx` files in M01's inventory,
**42** carry `"use client"` and **8** do not. The eight without the directive are `app/layout.tsx`,
`components/ui/badge.tsx` (incorrectly - see F29), `components/ui/card.tsx`, `components/ui/textarea.tsx`,
`components/ui/spinner.tsx`, `components/ui/form/FormSection.tsx`, `components/common/SectionHeading.tsx` and
`lib/crud-columns.tsx` (a `.tsx` helper, not a component, that returns JSX wrapping the client
`components/admin/crud/CrudTableCell.tsx`). Add the two non-component modules `components/ui/animations.ts` and
`components/ui/use-toast.ts` and nothing else in M01 is server-side. Both global contexts and both layout
components are client. `app/layout.tsx`
is the one meaningful server component, and it immediately mounts a four-deep client provider stack, so in practice the
entire tree below `<body>` hydrates. The documented "Server Components First" principle (`AGENTS.md`,
`docs/CODING-STANDARDS.md`) is aspirational, not descriptive.

## Portability notes (React Native / cross-platform)

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| `app/layout.tsx` | Next App Router, `next/font/google`, `Metadata`, `<html>/<body>` | rewrite | RN has no document; becomes a `NavigationContainer` + provider stack. The provider *order* is the reusable part |
| `app/globals.css` (717 lines) | CSS, Tailwind v4, `oklch()`, `@theme`, pseudo-elements, `backdrop-filter`, keyframes | rewrite | RN has no CSS. Extract the token values into a TS theme object; `oklch` must be converted to hex/rgb |
| `components/ui/button.tsx`, `card.tsx`, `input.tsx`, `textarea.tsx`, `label.tsx`, `badge.tsx` | Tailwind classes, DOM tags | rewrite (keep the prop API) | Variant/size prop shapes port; markup and classes do not. NativeWind would carry most class names but not `focus-visible`, `peer-*`, `[&>svg]` selectors |
| `@base-ui/react` primitives (`select`, `dialog`, `switch`, `checkbox`, `table`) | DOM portals, positioning, `data-*` CSS selectors | rewrite | base-ui is DOM-only; use RN `Modal`, `Picker`, `Switch`, `FlatList` |
| `components/ui/tabs.tsx`, `dropdown-menu.tsx` | - | rewrite (they are stubs anyway) | Nothing worth porting; F03/F04 |
| `components/ui/form/*` | DOM `<form>`, `<input>`, `<select>`, `<textarea>` | rewrite (keep the composition) | `FormSection > FormGroup > control` is a good structure; controls become `TextInput`/`Picker`/`Switch` |
| `components/layout/Navbar.tsx` | `next/link`, `next/image`, `usePathname`, `document.body.style`, `window.scrollY`, sticky CSS | rewrite | But `menuItems` + the four dropdown arrays (`:16-44`) are plain data and should be extracted to a shared `navigation.ts` that both clients consume |
| `components/layout/Footer.tsx` | DOM, `next/image`, `mailto:`/`tel:` hrefs, gradients | rewrite | `FooterData` shape and the `settings/footer` document are reusable; `tel:`/`mailto:` become `Linking.openURL` |
| `components/ui/GoUpButton.tsx` | `window.scrollY`, `window.scrollTo` | rewrite | `ScrollView.scrollTo` + `onScroll` |
| `components/ui/DeepaFlame.tsx`, `FloatingParticles.tsx` | `<canvas>`, `CanvasRenderingContext2D`, `requestAnimationFrame` | rewrite | Needs `react-native-skia` or Lottie; the particle maths ports as-is |
| framer-motion (`AnimateIn`, `PageTransition`, `MicroInteractions`, `TempleCard`, `GoUpButton`, `Footer`) | `framer-motion` v12 web build | rewrite | Use `react-native-reanimated` / `moti`. The variant *definitions* in `lib/animations.ts` are plain objects and largely translate |
| `components/common/A11yProvider.tsx`, `hooks/a11y/index.ts` | `matchMedia`, `document` listeners, `aria-live`, focus/Tab semantics | rewrite | RN uses `AccessibilityInfo` and `accessibilityLiveRegion`; the hook API names can stay |
| `hooks/useReducedMotion.ts` | `window.matchMedia` | adapt | `AccessibilityInfo.isReduceMotionEnabled()` behind the same boolean return |
| `hooks/useInViewAnimation.ts` | `IntersectionObserver`, `window.scrollY` | rewrite | `onViewableItemsChanged` / `onScroll` |
| `components/common/LazyLoad.tsx` | `IntersectionObserver` | rewrite | `FlatList` windowing |
| `components/common/OptimizedImage.tsx` | `next/image`, `Buffer` | rewrite | `expo-image` |
| `components/ui/ImageUploader.tsx`, `VideoUploader.tsx` | `FileReader`, `DragEvent`, `<input type=file>`, `<video>` | rewrite | `expo-image-picker` + the same `storageService` contract |
| `components/common/Search/GlobalSearch.tsx` | `localStorage`, `useRouter` | rewrite | `AsyncStorage` + RN navigation (and it is dead today) |
| `context/AuthContext.tsx`, `context/ProfileContext.tsx` | `"use client"`, `next/navigation` | **adapt - highest-value reuse** | The provider logic, role predicates and profile actions are platform-neutral once `browserLocalPersistence` becomes `getReactNativePersistence` and the unused `useRouter` goes |
| `hooks/useAuth.ts`, `useGallery.ts`, `useHomepage.ts`, `useFinanceSettings.ts`, `useDonationNotifications.ts`, `useCrudTable.ts` | none intrinsic (Firebase JS SDK works in RN) | reuse as-is / light adapt | Once they call services instead of `firebase/firestore` directly |
| `utils/event.ts`, `lib/format.ts`, `lib/utils.ts` (`cn`), `lib/festival-utils.ts`, `lib/panchanga-cache.ts` | none (`cn` only matters with NativeWind) | **reuse as-is** | Pure TS; the cleanest shared layer in M01 |
| `lib/firebase.ts` | `typeof window`, `browserLocalPersistence` | adapt | Swap persistence; keep the singleton shape |
| `lib/admin-firebase.ts`, `lib/firebase-admin-rest.ts`, `lib/rate-limit.ts`, `lib/gallery.ts`, `lib/sevas.ts` | `fs`, `path`, `server-only`, Node runtime | server-only, never ships | Must stay behind HTTP APIs |
| `proxy.ts`, `next.config.ts`, `postcss.config.mjs`, `components.json` | Next/Tailwind build | not applicable | Replaced by the RN/Expo toolchain |

**What a React Native client would need from M01**

1. A platform-neutral **theme package**: the token values from `app/globals.css:128-193` plus `--temple-*` as a TS
   object (hex, not `oklch`), a spacing/radius scale, and the typography scale - consumed by both web and native.
2. A shared **navigation manifest** extracted from `Navbar.tsx:16-44` and `Footer.tsx:36-54`, so three copies become one
   data file that a web `<nav>` and an RN drawer both render.
3. The **contexts as a shared package**: `AuthContext` and `ProfileContext` with their service calls, minus
   `"use client"` and `next/navigation`, plus a persistence adapter per platform.
4. **HTTP endpoints instead of direct Firestore reads**: `settings/footer`, `settings/financeSettings`, social links,
   `galleryMedia` and `homepage/config` are read from the client today; a native app needs them behind
   `app/api/*` (M12) so the read path, rules and caching are identical on both clients.
5. A **primitive contract** - the prop shapes of `Button`, `Card`, `Input`, `FormField`, `Dialog`, `Select` - agreed
   once and implemented twice, so feature code is written against names, not against Tailwind strings. Today the same
   concept exists under three names (`Button`/`TempleButton`/`AnimatedButton`), which would triple the porting cost.
6. A **motion vocabulary** picked before porting: `lib/animations.ts`'s durations and easings map cleanly to Reanimated;
   the inline per-component variants do not.

## Coverage

filesExpected 88, filesMentioned 89 (all 88 inventory files plus the adopted `components/debug/ClientEnvDebug.tsx`).

Omitted in depth (mentioned in the Key files table but not read line-by-line): none of the inventory files were skipped
entirely. Read by structure rather than in full, because of size: `components/ui/DeepaFlame.tsx` (257, canvas loop),
`components/ui/FloatingParticles.tsx` (300, canvas loop), `components/common/PersonalizedHomepage.tsx` (344, dead),
`components/common/Search/GlobalSearch.tsx` (379, dead), `hooks/a11y/index.ts` (314, 6 of 8 hooks dead),
`lib/animations.ts` (288, dead), `lib/festival-utils.ts` (171), `utils/event.ts` (150),
`components/layout/Footer.tsx:120-235` (repetitive link lists).

Not mine, referenced only to fix a boundary: `app/(public)/layout.tsx`, `app/admin/layout.tsx`,
`components/analytics/PageViewTracker.tsx`, `components/search/GlobalSearch.tsx`, `services/*.service.ts`, `types/*.ts`,
`lib/i18n`, `docs/UI-GUIDELINES.md`, `docs/CODING-STANDARDS.md`, `docs/PROJECT_STRUCTURE.md`, `AGENTS.md`.

## UNCLEAR

- **Is `proxy.ts` actually executed?** It exports a default `async function proxy(request: NextRequest)` and there is no
  `middleware.ts`, which matches Next 16's rename, but `node_modules/next/dist/docs/` is absent so the convention could
  not be confirmed, and there is no `config`/`matcher` export. Settled by: reading the installed Next 16 docs, or a
  single request against a dev server and checking for a new `page_views` document.
- **Which toast the product team intends.** `react-hot-toast` is mounted, a full shadcn toast system is dead, and
  `sonner` is installed and unused. Settled by a product decision, then deletion of the other two.
- **Whether dark mode is wanted.** `ProfileContext.updateTheme` persists a theme and the CSS exists, but no toggle.
  Settled by asking whether devotees were ever meant to see a dark temple site.
- **Which `GlobalSearch` is the intended one** (`components/common/Search/` 379 lines vs `components/search/` 350 lines)
  and why neither is mounted although `/api/search` exists. Settled by git history - not available here, this is not a
  git repository.
- **Whether the hardcoded Firebase API key in `lib/firebase.ts:58` and `proxy.ts:8` has been exposed publicly.** A
  Firebase web apiKey is not a secret by design, but the paired projectId/appId identify the live project and the
  fallbacks defeat environment separation. Settled by the repository's publication history and the Firebase console's
  API-key restrictions.
- **Whether `@vercel/analytics` (`package.json:46`) is meant to be mounted.** It is a dependency and nothing in the root
  layout or any M01 file imports it. Settled by checking the Vercel project settings.

## Verification log (2026-09-19)

Adversarial pass over this file against the code. 229 `path:line` citations extracted by script and resolved;
36 factual claims re-opened in the code; all 48 faults re-examined; inventory coverage re-diffed.
Report: `.claude/state/verify/M01.md`.

- Dead-code count "25+ source files with no importer" -> **22 files / 2,358 lines**, with the 22 named -> the
  import-graph reverse map lists 25 zero-importer M01 files, but `app/layout.tsx`, `proxy.ts` and `next.config.ts`
  are framework entry points, not dead (F43, and the bullet in "Answers questions about").
- Server/client split "48 component files, 40 `use client`" -> **50 `.tsx` files, 42 client, 8 server**, and
  `lib/crud-columns.tsx` added to the server list it had omitted -> counted over `.claude/state/inventory/M01.json`.
- F05 said "28 page files" and implied one layout fix -> now states 29 importers, of which only **24** are under
  `app/(public)/`; `app/calendar/page.tsx`, `app/calendar/ekadashi/page.tsx`, `app/calendar/festivals/page.tsx` and
  `app/knowledge/page.tsx` have **no layout at all**, so a `(public)/layout.tsx` fix misses them -> `find app -name
  layout.tsx` returns only `app/layout.tsx`, `app/(auth)`, `app/(public)`, `app/admin*`.
- F10 cited `docs/CODING-STANDARDS.md:80` (a blank line) -> **`:76`**, the actual "No `any`" bullet.
- F13 said the dark palette has "34 custom properties" -> **31** -> counted declarations in `app/globals.css:195-228`.
- F31 called `ClientEnvDebug` "one import away from shipping" -> it is, but the same exposure **already ships** as the
  live unauthenticated route `app/debug/page.tsx` (M05's chunk), which prints `NEXT_PUBLIC_FIREBASE_API_KEY` and the
  first 20 chars of the server-only `OPENAI_API_KEY` -> `app/debug/page.tsx:4-5,26,33`.
- Animation barrel cited as `components/ui/animations.ts:1-16` -> **`:1-15`**, plus a note that the import graph does
  not record `export … from` re-exports -> `components/ui/animations.ts` is 15 lines and its graph entry is `[]`.
- Recipe C told the reader to run a grep for the redesign surface -> the grep is now **run**: 5,471 literal
  `amber-*`/`orange-*`/`stone-*` occurrences under `components/` + `app/`.
- Focus question 2 asked for the tokens themselves and the file only pointed at line ranges -> new section
  **"Design tokens - the complete list"** enumerating 41 `:root` declarations, the font stacks, the radius scale, the
  absence of any shadow or spacing token, and the 61 utility-class selectors.
- Focus question 7 asked about redirects and experimental flags and the file was silent -> the Entry points row for
  `next.config.ts` now records that **none exist**.
- **NEW M01-F47 (MEDIUM)**: the global `SkipLink` targets `#main-content`, which only `app/(public)/layout.tsx:12` and
  `app/admin/layout.tsx:26` render; on `/calendar/*`, `/knowledge`, `/debug` and all `(auth)` routes it is a dead link.
- **NEW M01-F48 (LOW)**: `lib/auth.ts` and the directory `lib/auth/` (with `lib/auth/index.ts`) both exist, so
  `@/lib/auth` resolves to the dead file and shadows the admin barrel; latent, since nothing uses the bare specifier.

Everything else held. Spot-verified and CONFIRMED unchanged: the provider stack and its order
(`app/layout.tsx:83-121`), all 25 importer counts in "Who imports M01" (exact matches against the import graph), every
line count in the Key files table, all five Navbar array line numbers and the in-render `eventsDropdown` at `:78`,
F01-F04, F06-F09, F11, F12, F14-F30, F32-F42, F44-F46. Path script re-run after these edits: no broken repo path
remains - the only unresolved strings are deliberate (`middleware.ts` and `node_modules/next/dist/docs/`, cited
because they are absent; glob and `<slug>` placeholders; npm package names; Firestore document paths; CSS classes).
