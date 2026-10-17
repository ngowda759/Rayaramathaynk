# M04 - Authentication, users, roles and security rules
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs. Verify against the code before acting on any claim.

## Answers questions about

- How does login work end to end, from the form to Firestore?
- How does registration work, and what does a brand-new devotee document look like?
- How does forgot-password work, and is there a reset-password page? (no)
- Is this app on Firebase Auth or Supabase Auth? Which one is live, which is being migrated to?
- Where is the auth state kept, and how do components read the current user?
- What decides that someone is an "admin"? Custom claims, a Firestore field, or an env list?
- Where is `/admin` protected, and is that protection server-side or client-side?
- Why can a non-super-admin open `/admin/users`?
- What do the Firestore security rules allow, collection by collection?
- Which collections are world-writable right now?
- What do the Storage rules allow?
- How does an admin API route verify the caller, and which routes actually do it?
- Why is `POST /api/admin/users/create-admin` dangerous?
- How are ID tokens sent to API routes, and are there any session cookies? (no cookies)
- Where is the admin Users list, its table, its form, and which service backs it?
- How do I add a role, rename a role, or change what a role can see?
- Why does the same user show a different role string in different screens?
- Which files in this module are dead code?
- Where is rate limiting implemented and why does it not work on Vercel?
- What does `docs/SECURITY.md` claim that the code does not do?
- What would a React Native client need from this module?
- Where are the Supabase client factories and who uses them?
- Why do the devotee profile pages silently show nothing?
- Which environment variables does auth need, and which are missing from `.env.example`?

## Purpose and business role

This module is the identity layer of the temple portal. It lets a devotee create an account
(name, email, phone, password), sign in, and reset a forgotten password; it keeps the signed-in
Firebase user plus a mirrored Firestore profile document in React context so every other module can
ask "who is this and what may they do"; and it carries the role model that separates devotees from
priests, office staff, billing users, temple admins and super admins.

It also owns the staff-facing side of identity: the admin Users screen where temple staff accounts
are listed, created, edited and deleted, two bootstrap API routes (`create-admin`, `set-role`) that
exist to promote the very first administrator, and the two policy files that ultimately decide what
any of this can touch - `firestore.rules` and `storage.rules`.

Finally it holds the Supabase client factories (`lib/supabase/*`). Supabase is being adopted as a
data store for other modules; **Supabase Auth is not used anywhere in the repository** - there is no
`supabase.auth.signIn*` call in the codebase. Firebase Auth is the only live authentication system.

The security posture that results is: authentication is real (Firebase), authorization is mostly
decorative in the UI (client-side guards) and is really enforced - where it is enforced at all - by
`firestore.rules`, which has several world-writable holes.

## Code roots

```
app/(auth)/                       login, register, forgot-password pages + split-screen layout
components/auth/                  the four form components plus two route guards
services/auth.service.ts          the live Firebase Auth wrapper (singleton class)
services/user.service.ts          CRUD over the `users` collection for the admin screen
lib/auth.ts                       an unused duplicate of services/auth.service.ts
lib/auth/admin-auth.ts            the real server-side admin token verifier
lib/auth/admin.ts, lib/auth/index.ts   an unused, unsafe second verifier
context/AuthContext.tsx           the auth provider + permission booleans
context/ProfileContext.tsx        the devotee profile/preferences provider
hooks/useAuth.ts                  one-line re-export of useAuthContext
app/admin/users/                  admin Users list, new, edit
components/admin/users/           table, form, stats, role badge, delete dialog
app/api/admin/users/create-admin/route.ts
app/api/admin/users/set-role/route.ts
firestore.rules, storage.rules    the actual enforcement
lib/supabase/{client,server,admin}.ts, app/api/supabase-check/route.ts
utils/redirect.ts                 unused role -> dashboard route mapper
.env.example
```

No files were adopted from the Unassigned list in `.claude/state/inventory/SUMMARY.md`; none of the
eleven unassigned files are auth-related.

One file outside the roots belongs in this picture: `scripts/setup-admin.ts` (`npm run setup-admin`,
`package.json:15`) is the **third** bootstrap path and the only safe one - it uses the Admin SDK and
`db.collection('users').doc(uid).set(...)` with `role:'super_admin'` (`scripts/setup-admin.ts:54-68`).
Its existence is the argument for deleting `create-admin` rather than gating it.

## Entry points

| Route / entry | File | server/client | auth required | What it renders or does |
|---|---|---|---|---|
| `/login` | `app/(auth)/login/page.tsx` | server | no | `<Suspense>` around `LoginForm` (Suspense is needed because `LoginForm` calls `useSearchParams`) |
| `/register` | `app/(auth)/register/page.tsx` | server | no | `GuestOnly` > `RegisterForm` |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx` | server | no | `GuestOnly` > `ForgotPasswordForm` |
| (layout for all three) | `app/(auth)/layout.tsx` | server | no | Two-column shell: temple branding panel (hidden under `lg`) + form column |
| `/admin/users` | `app/admin/users/page.tsx` | client | yes, client-side only | `AdminAuthGuard requiredPermission="users"` > stats + search + `UserTable` |
| `/admin/users/new` | `app/admin/users/new/page.tsx` | server | inherited from admin layout only | Heading + `UserForm` (create mode) |
| `/admin/users/[id]/edit` | `app/admin/users/[id]/edit/page.tsx` | client | inherited from admin layout only | Loads one user via `userService.getUser`, renders `UserForm` in edit mode |
| `POST /api/admin/users/create-admin` | `app/api/admin/users/create-admin/route.ts` | server (route handler) | **none** | Creates a Firebase user and writes a `super_admin` users doc; rate-limited 5/min/IP |
| `POST /api/admin/users/set-role` | `app/api/admin/users/set-role/route.ts` | server (route handler) | **none** | Finds a users doc by email and overwrites its `role`; rate-limited 10/min/IP |
| `GET /api/supabase-check` | `app/api/supabase-check/route.ts` | server (route handler) | none | Reports which Supabase env vars are present and whether the clients instantiate |
| Provider mount | `app/layout.tsx:85-121` | client boundary inside a server layout | n/a | `AuthProvider` > `ProfileProvider` > `AIChatProvider` wraps the whole app |
| Admin gate | `app/admin/layout.tsx:22-31` | server layout, client guard | n/a | `<Suspense>` > `AdminAuthGuard` > `AdminShell` for **every** `/admin/*` page |

There is **no `middleware.ts`** anywhere in the repository (`find . -maxdepth 2 -name middleware.ts`
returns nothing), so no request is ever authorized before it is served.

## Component trees

### Sign-in

```
LoginPage (server)                       app/(auth)/login/page.tsx
└── Suspense fallback=LoginLoading (server)
    └── LoginForm (client)               components/auth/LoginForm.tsx
        ├── Card (client-safe UI)        components/ui/card.tsx
        ├── LoginHeader (server-safe)    components/auth/LoginHeader.tsx  -> next/image logo
        ├── Input x2 (UI kit)            components/ui/input.tsx
        ├── Button (UI kit)              components/ui/button.tsx
        ├── Link -> /forgot-password, /register     next/link
        ├── hooks: useForm(zodResolver), useState(showPassword,isClient),
        │          useRouter, useSearchParams, useAuth
        └── useAuth()                    hooks/useAuth.ts
            └── useAuthContext()         context/AuthContext.tsx
                └── authService.login()  services/auth.service.ts
                    ├── firebase/auth signInWithEmailAndPassword
                    └── firestore setDoc(users/{uid}, {...}, {merge:true})
```

Wrapped by `AuthLayout (server)` - `app/(auth)/layout.tsx`, which renders the branding panel and the
form column.

### Register

```
RegisterPage (server)                    app/(auth)/register/page.tsx
└── GuestOnly (client)                   components/auth/GuestOnly.tsx   [name lies: lets everyone through]
    └── RegisterForm (client)            components/auth/RegisterForm.tsx
        ├── Card / Input x5 / Button     components/ui/*
        ├── hooks: useForm(zod refine password match), useState, useRouter, useAuth
        └── useAuth().register(data)
            └── authService.register()   services/auth.service.ts:37
                ├── createUserWithEmailAndPassword
                ├── updateProfile(displayName)
                ├── sendEmailVerification
                └── setDoc(users/{uid}, {role:"devotee", isApproved:false, ...})
```

### Forgot password

```
ForgotPasswordPage (server)              app/(auth)/forgot-password/page.tsx
└── GuestOnly (client)
    └── ForgotPasswordForm (client)      components/auth/ForgotPasswordForm.tsx
        └── useAuth().forgotPassword(email)
            └── authService.forgotPassword -> sendPasswordResetEmail
```

There is no in-app reset-password page; Firebase's hosted action link handles the reset.

### Admin users (list / create / edit) - shares the admin shell

```
AdminLayout (server)                     app/admin/layout.tsx
└── Suspense
    └── AdminAuthGuard (client)          components/admin/layout/AdminAuthGuard.tsx   [M05]
        └── AdminShell (client)          components/admin/layout/AdminShell.tsx       [M05]
            └── {page}

UsersPage (client)                       app/admin/users/page.tsx
└── AdminAuthGuard requiredPermission="users" (client)   <- second, redundant guard
    └── UsersPageContent (client)
        ├── AdminPageHeader (server-safe) components/admin/common/AdminPageHeader.tsx  [M05]
        │   └── Link -> /admin/users/new > Button
        ├── UserStats (server-safe)       components/admin/users/UserStats.tsx
        │   └── StatCard x4               components/admin/common/StatCard.tsx          [M05]
        ├── SearchBox (client)            components/admin/common/SearchBox.tsx         [M05]
        ├── UserTable (server-safe)       components/admin/users/UserTable.tsx
        │   ├── UserRoleBadge (server-safe)   components/admin/users/UserRoleBadge.tsx
        │   ├── Link -> /admin/users/{id}/edit
        │   └── DeleteUserDialog (client)     components/admin/users/DeleteUserDialog.tsx
        │       └── userService.deleteUser -> deleteDoc(users/{id})
        └── hooks: useEffect(load), useMemo(filter), useState(users,loading,search)
            └── userService.getUsers()    services/user.service.ts:18 -> getDocs(collection "users")

NewUserPage (server)                     app/admin/users/new/page.tsx
└── UserForm (client) mode="create"      components/admin/users/UserForm.tsx
    └── userService.addUser -> addDoc(users)          [doc id is auto-generated, NOT the auth uid]

EditUserPage (client)                    app/admin/users/[id]/edit/page.tsx
├── useParams() -> id
├── userService.getUser(id)
└── UserForm (client) mode="edit"
    └── userService.updateUser -> updateDoc(users/{id})
```

### Provider tree (whole app)

```
RootLayout (server)                      app/layout.tsx
└── A11yProvider (client)                                       [M13]
    └── AuthProvider (client)            context/AuthContext.tsx
        │  state: user (firebase User), profile (UserProfile), loading
        │  effect: initializeAuthPersistence + onAuthStateChanged -> authService.getUserProfile
        │  derived: normalizedRole, canAccessAdmin, canAccessSettings, canAccessFinance,
        │           canManageUsers, canAccessBilling, canAccessAdministration
        └── ProfileProvider (client)     context/ProfileContext.tsx
            │  state: profile (DevoteeProfile), preferences, isLoading
            │  effect: on user change -> profileService.getProfile(uid) (collection "profiles")
            └── AIChatProvider (client)                          [M08/M09]
                └── {children} + Toaster + ChatWidget
```

## Data flow

### 1. Login

1. `LoginForm.onSubmit` (`components/auth/LoginForm.tsx:56`) validates with zod (`email`, `password >= 6`).
2. Calls `login()` from `useAuth()` -> `useAuthContext()` (`hooks/useAuth.ts:6`, `context/AuthContext.tsx:135`).
3. `authService.login(email, password)` (`services/auth.service.ts:76`) calls
   `signInWithEmailAndPassword(auth, ...)`.
4. The same function reads `users/{uid}` (`:88-92`) and re-writes it with `setDoc(..., {merge:true})`,
   preserving existing `name/role/templeId/isApproved`, and stamping `emailVerified` and
   `lastLogin: serverTimestamp()` (`:94-116`). A missing doc also gets `createdAt`.
5. Independently, `onAuthStateChanged` in `AuthContext` (`context/AuthContext.tsx:101`) fires,
   sets `user`, and calls `loadProfile(uid)` -> `authService.getUserProfile` ->
   `getDoc(users/{uid})` (`services/auth.service.ts:131`), putting the doc in `profile`.
6. `AuthContext:156-166` derives `normalizedRole` via `normalizeRole()` (`types/user.ts:21`) and the
   six `canAccess*` booleans.
7. `LoginForm` shows a toast, then after a **2000 ms `setTimeout`** does
   `window.location.href = searchParams.get("redirect") || "/"` (`:61-64`) - a full page reload,
   with no validation of the redirect target.

### 2. Registration

1. `RegisterForm.onSubmit` (`components/auth/RegisterForm.tsx:51`) validates name/email/phone/
   password/confirmPassword with zod.
2. `useAuth().register(data)` -> `authService.register` (`services/auth.service.ts:37`).
3. `createUserWithEmailAndPassword` -> `updateProfile({displayName})` -> `sendEmailVerification`.
4. `setDoc(users/{uid})` writes the full `UserProfile` shape with `role:"devotee"`,
   `templeId:"main"`, `isApproved:false`, `isActive:true`, `emailVerified:false` (`:57-71`).
   Firestore rule `users` create requires `request.resource.data.uid == request.auth.uid`
   (`firestore.rules:39`), which this satisfies.
5. Form pushes to `/login`. Nothing ever checks `emailVerified` or `isApproved` again.

### 3. Admin page access decision

1. Browser requests `/admin/...`; Next renders `app/admin/layout.tsx` (server) and streams the page.
   **No server-side auth check happens** - the markup and JS are sent to anyone.
2. `AdminAuthGuard` (client) mounts, reads `{user, loading, canAccessAdmin}` from `useAuth()`.
3. While `loading || !isClient` it shows a spinner (`AdminAuthGuard.tsx:78-80`).
4. If Firebase config is invalid it shows a "Firebase Not Configured" panel (`:86-111`).
5. If `!user` -> `router.replace('/login?redirect=...')` (`:114-119`).
6. If `!canAccessAdmin` -> `router.replace('/')` (`:122-126`).
7. `requiredPermission` is then checked, but every branch resolves to `canAccessAdmin` (`:129-149`),
   so `"users"` grants the same access as `"admin"`.
8. Data access is what actually stops a non-admin: `userService.getUsers()` hits Firestore directly
   from the browser and `firestore.rules:36` (`allow read: if isAdmin()`) rejects a devotee.

### 4. Server-side admin API verification (the good path)

1. An admin page calls `user.getIdToken()` (e.g. `app/admin/receipts/page.tsx:55`) and sends
   `Authorization: Bearer <idToken>`.
2. The route calls `verifyAdminUser(request)` (`lib/auth/admin-auth.ts:28`).
3. It extracts the bearer token, dynamically imports `@/lib/admin-firebase`, and calls
   `getAuth(adminApp).verifyIdToken(idToken)` (`:45`).
4. It reads `users/{decoded.uid}` with the **Admin SDK** (bypassing rules), rejects a missing doc
   (`:49-52`), rejects `isActive === false` (`:55-58`), normalizes the role and rejects
   `devotee`/`volunteer` (`BLOCKED_ROLES`, `:18`, `:61-64`).
5. Returns `{uid, email, role}` or `null`.
6. Only **five** call sites actually call it - all in the receipts/receipt-sevas area
   (`app/api/admin/receipts/route.ts:2`, `app/api/admin/receipts/[id]/route.ts:2`,
   `app/api/admin/receipts/[id]/pdf/route.ts:2`, `app/api/admin/receipt-sevas/route.ts:2`,
   `app/api/admin/receipt-sevas/[id]/route.ts:2`). A sixth file, `lib/receipt/admin.ts:18`, imports
   only the `ServerAdminUser` **type**. **The two user-management routes in this module do not.**

### 5. Promote a user to an admin role (as built)

1. Anyone `POST`s `{email, role}` to `/api/admin/users/set-role`.
2. `rateLimit('set-role:<ip>', {windowMs:60000, maxRequests:10})` (`route.ts:9-13`) - in-memory only.
3. Email regex + `validRoles = ["devotee","volunteer","admin","billing","super_admin"]` (`:54`).
4. `query(collection(db,'users'), where('email','==',email))` using the **client** Firestore SDK
   (`:63-65`) - so this read/write is subject to `firestore.rules` as an unauthenticated caller and
   will normally be denied at runtime; the route has no auth of its own.
5. `setDoc(users/{firstMatchId}, {role, updatedAt}, {merge:true})` (`:79-82`).

### 6. Devotee profile load (fails silently today)

1. `ProfileProvider` effect (`context/ProfileContext.tsx:70-85`) runs on user change.
2. `profileService.getProfile(uid)` reads `profiles/{uid}` (`services/profile.service.ts:30,78`).
3. `firestore.rules` has **no `match /profiles/...` block**, so the read is denied by default.
4. The catch at `context/ProfileContext.tsx:111-115` logs to console and leaves `profile` null;
   `/profile`, `/favorites`, `/notifications` then render their empty states with no error shown.

## Key files

| File | Lines | Role | Key exports | Notes |
|---|---:|---|---|---|
| `app/(auth)/layout.tsx` | 78 | Split-screen shell for all auth pages | `AuthLayout` | Server component; `next/image` logo, heavy gradient/blur decoration |
| `app/(auth)/login/page.tsx` | 19 | `/login` | `LoginPage` | Suspense needed for `useSearchParams` in the child |
| `app/(auth)/register/page.tsx` | 11 | `/register` | `RegisterPage` | Wraps in `GuestOnly` |
| `app/(auth)/forgot-password/page.tsx` | 11 | `/forgot-password` | `ForgotPasswordPage` | Wraps in `GuestOnly` |
| `components/auth/LoginForm.tsx` | 178 | Sign-in form | `LoginForm` (default) | zod min 6 chars; maps Firebase error codes to toasts; open-redirect at `:61-64` |
| `components/auth/RegisterForm.tsx` | 164 | Sign-up form | `RegisterForm` | `catch (error: any)` at `:64`; "Remember me"-less; no terms checkbox |
| `components/auth/ForgotPasswordForm.tsx` | 90 | Reset request | `ForgotPasswordForm` | Non-enumerating success message (good) |
| `components/auth/GuestOnly.tsx` | 45 | Supposed guest gate | `GuestOnly` | `:42-43` renders children for everyone - a no-op apart from the spinner |
| `components/auth/LoginHeader.tsx` | 38 | Logo + headline for the login card | `LoginHeader` | Pure presentational, uses `next/image` |
| `components/auth/ProtectedRoute.tsx` | 61 | Client route guard | `ProtectedRoute` | **Dead** - no importer anywhere |
| `services/auth.service.ts` | 148 | The live auth API | `authService`, `RegisterData` | Singleton class; register/login/logout/forgotPassword/getUserProfile/currentUser |
| `services/user.service.ts` | 89 | `users` CRUD for admin | `userService` | Maps `data.active ?? true` into both `active` and `isActive`; role defaults to `"Volunteer"` |
| `lib/auth.ts` | 134 | Duplicate of auth.service | `registerUser`,`loginUser`,`logoutUser`,`resetPassword`,`resendVerification` | **Dead** - identical logic to `services/auth.service.ts` |
| `lib/auth/admin-auth.ts` | 76 | Real server-side admin verifier | `verifyAdminUser`, `ServerAdminUser` | `import "server-only"`; Admin SDK `verifyIdToken` + Firestore role check |
| `lib/auth/admin.ts` | 81 | Second, unsafe verifier | `checkAdminAuth`, `isUserAdmin` | **Dead but exported**; dev-mode bypass `:29-31`, "token longer than 10 chars" `:48-50` |
| `lib/auth/index.ts` | 3 | Barrel | re-exports `checkAdminAuth`, `isUserAdmin` | Re-exports only the unsafe module, not `admin-auth` |
| `context/AuthContext.tsx` | 204 | Auth provider + permission booleans | `AuthProvider`, `useAuthContext` | 11 direct importers; `setTimeout(...,0)` around every `setState`; console logs at `:85,96` |
| `context/ProfileContext.tsx` | 270 | Devotee profile, preferences, favourites, bookmarks | `ProfileProvider`, `useProfile` | 10 importers; `getBookmarks: Promise<any[]>` (`:52`); silent catch `:111-115` |
| `hooks/useAuth.ts` | 8 | Ergonomic alias | `useAuth` | 17 importers (mostly admin pages) |
| `app/admin/users/page.tsx` | 106 | Admin user list | `UsersPage` | Loads whole collection, filters in memory, `console.log("Users:", data)` at `:26` |
| `app/admin/users/new/page.tsx` | 14 | Create user | `NewUserPage` | Server component, no own guard |
| `app/admin/users/[id]/edit/page.tsx` | 63 | Edit user | `EditUserPage` | Client; own loading/not-found states |
| `components/admin/users/UserTable.tsx` | 94 | Users table | `UserTable` | Plain `<table>`; no sorting, no pagination, no `scope` attributes |
| `components/admin/users/UserForm.tsx` | 156 | Create/edit form | `UserForm` | **No validation**; role `<select>` with six hardcoded Title Case options `:119-125`; `alert()` on error |
| `components/admin/users/UserStats.tsx` | 44 | Four KPI tiles | `UserStats` | Counts computed by the caller |
| `components/admin/users/UserRoleBadge.tsx` | 32 | Coloured role pill | `UserRoleBadge` | `colors[role]` with no fallback `:26` |
| `components/admin/users/DeleteUserDialog.tsx` | 47 | Delete button | `DeleteUserDialog` | Uses `window.confirm` `:20`; deletes the Firestore doc only, never the Firebase Auth user |
| `app/api/admin/users/create-admin/route.ts` | 95 | Bootstrap a super admin | `POST` | **Unauthenticated**; writes `role:"super_admin"`; hardcoded success message `:85` |
| `app/api/admin/users/set-role/route.ts` | 97 | Change a user's role by email | `POST` | **Unauthenticated**; client SDK writes |
| `firestore.rules` | 280 | The real authorization | - | 40+ collection blocks; duplicate `/settings` match; several `if true` writes |
| `storage.rules` | 17 | Storage authorization | - | `/testimonials/**` is world read **and write** |
| `lib/supabase/client.ts` | 12 | Browser Supabase client | `createClient` | Falls back to `https://placeholder.supabase.co` / `"placeholder"` |
| `lib/supabase/server.ts` | 30 | Cookie-backed server client | `createClient` | `cookies()` from `next/headers`; the only cookie use in the module |
| `lib/supabase/admin.ts` | 19 | Service-role client | `createAdminClient` | Throws when env vars are missing (correct); used by 3 runtime files + 8 scripts |
| `app/api/supabase-check/route.ts` | 56 | Config probe | `GET` | Returns which env vars exist; unauthenticated (booleans only, no values) |
| `utils/redirect.ts` | 27 | Role -> dashboard route | `getDashboardRoute` | **Dead**; targets `/priest`, `/staff`, `/devotee` which do not exist |
| `.env.example` | 57 | Env template | - | Firebase web config, Blob, AI, Supabase; missing all Admin-SDK vars |

## Types and stores

### Types (`types/user.ts`, 95 lines - owned by M10, consumed here)

- `UserRole` - a **13**-member union (`types/user.ts:3-16`) mixing snake_case (`super_admin`, `temple_admin`, `priest`,
  `staff`, `volunteer`, `devotee`, `billing`) and Title Case (`"Super Admin"`, `"Temple Admin"`,
  `"Priest"`, `"Office Staff"`, `"Volunteer"`, `"Billing"`). Note `"admin"` is **not** a member,
  although `set-role` accepts it (`app/api/admin/users/set-role/route.ts:54`) and `normalizeRole`
  maps it (`types/user.ts:32`).
- `NormalizedRole` - the five values access control actually uses:
  `super_admin | admin | billing | volunteer | devotee`.
- `normalizeRole(role)` (`types/user.ts:21-44`) - lowercases, replaces spaces with `_`, folds
  `temple_admin`/`admin`/`priest`/`staff`/`office_staff` into `"admin"`, everything unknown into
  `"devotee"`.
- `UserProfile` - the registration/login document shape (uid, name, email, phone, role, templeId,
  profileImage, isApproved, isActive, emailVerified, lastLogin, createdAt, updatedAt).
- `TempleUser` / `TempleUserCreate` / `TempleUserUpdate` - the admin-screen shape; note it carries
  **both** `active` and `isActive` and has no `uid`, `templeId` or `isApproved`.
- `types/profile.ts` (M10) - `DevoteeProfile`, `UserPreferences`, `Theme`,
  `DEFAULT_USER_PREFERENCES`, used by `ProfileContext`.

### Stores touched by this module

| Store | Path | Read by | Written by |
|---|---|---|---|
| Firestore | `users/{uid}` | `authService.getUserProfile`, `userService.getUsers/getUser`, `verifyAdminUser`, `isUserAdmin`, rules helpers `isAdmin()/isSuperAdmin()/isPriestOrAbove()` | `authService.register/login`, `userService.addUser/updateUser/deleteUser`, both API routes |
| Firestore | `profiles/{uid}` | `ProfileContext` via `profileService` | `profileService.saveProfile/updateProfile` (M10) - **no rule exists** |
| Firestore | `bookmarks` | `ProfileContext.getBookmarks` | `ProfileContext.addBookmark` - **no rule exists** |
| Firebase Auth | user records | `onAuthStateChanged`, `auth.currentUser` | `createUserWithEmailAndPassword`, `updateProfile`, `sendEmailVerification`, `sendPasswordResetEmail`, `signOut` |
| Firebase Auth persistence | `browserLocalPersistence` (IndexedDB/localStorage) | `initializeAuthPersistence` (`lib/firebase.ts:100-121`) | same |
| Firebase Storage | `testimonials/**` and everything else | `storage.rules` | not written from this module |
| Supabase (Postgres) | none directly | `app/api/supabase-check` only instantiates clients | - |
| Supabase cookies | `next/headers` cookie store | `lib/supabase/server.ts:5,12-25` | same |

### Firestore rules summary (`firestore.rules`)

Helpers (`:6-31`): `isAuthenticated()`, `isOwner(userId)`, `isAdmin()` (role in
`['super_admin','temple_admin','admin','Billing']`), `isSuperAdmin()`, `isPriestOrAbove()`
(declared at `:27` and **never used**).

| Collection | read | create | update | delete |
|---|---|---|---|---|
| `users` | owner or admin | authenticated, `uid == auth.uid` | owner (but not `role`/`isApproved`/`isActive`) **or** admin | super admin |
| `announcements`, `events`, `gallery`, `galleryAlbums`, `galleryMedia`, `timings`, `sevas`, `aaradhane`, `aaradhanes`, `temple_areas`, `knowledge`, `knowledge_articles`, `knowledge_categories`, `quotes` | public | admin | admin | admin |
| `receiptSevas` | admin | admin + name non-empty + amount >= 0 | admin + same checks | never |
| `receipts` | admin | never (server/Admin SDK only) | never | never |
| `system` | never | never | never | never |
| `sevaBookings` | owner or admin | authenticated, `userId == auth.uid` | admin | admin |
| `donations` | owner or admin | **any authenticated user, no ownership check** | admin | admin |
| `bills` | authenticated | authenticated | admin | admin |
| `homepage`, `futurePlans`, `trustCommittee`, `members`, `volunteers` | public | admin (`allow write`) | admin | admin |
| `settings` (`:136-139`) | public | admin | admin | admin |
| `settings` (`:231-234`, duplicate block) | public | **anyone** | **anyone** | **anyone** |
| `testimonials` | public | **anyone** | admin | admin |
| `chat_sessions` | public | anyone | anyone | (no delete rule) |
| `page_views` | public | anyone | admin | admin |
| `ai_token_usage`, `ai_latency_records`, `ai_intent_distribution` | public | anyone | admin | admin |
| `unknown_questions` | public | anyone | admin | admin |
| `ai_settings` | public | **anyone** | **anyone** | **anyone** |
| `messages` | public | anyone | admin | admin |
| `feedback` | admin | anyone | admin | admin |
| `profiles`, `bookmarks` | **no rule -> denied** | denied | denied | denied |

Firestore ORs every matching `allow`, so the second `/settings` block at `:231` wins over the first:
settings are world-writable.

### Storage rules (`storage.rules`)

- `testimonials/{allPaths}`: `read: true`, `write: true` (`:5-8`) - unauthenticated upload and
  overwrite, with no size or content-type constraint.
- `{allPaths}`: `read`/`write` for any authenticated user (`:11-14`) - any signed-in devotee can
  overwrite any gallery or profile asset.

## Cross-module dependencies

### This module imports from

| Dependency | Chunk | Used by |
|---|---|---|
| `lib/firebase.ts` (`auth`, `db`, `isFirebaseConfigured`, `getFirebaseConfigStatus`, `initializeAuthPersistence`) | M01/M10 | `services/auth.service.ts`, `services/user.service.ts`, `lib/auth.ts`, `lib/auth/admin.ts`, `context/AuthContext.tsx`, `components/auth/ProtectedRoute.tsx`, both API routes |
| `lib/admin-firebase.ts` (`getAdminApp`, `getAdminFirestore`) | M01/M10 | `lib/auth/admin-auth.ts:42` (dynamic import) |
| `lib/rate-limit.ts` | M01/M12 | both `app/api/admin/users/*` routes |
| `components/ui/{button,card,input,label}` | M01 | all auth forms, `UserForm` |
| `components/admin/common/{AdminPageHeader,SearchBox,StatCard}` | M05 | `app/admin/users/page.tsx`, `UserStats` |
| `components/admin/layout/AdminAuthGuard.tsx` | M05 | `app/admin/users/page.tsx` |
| `services/profile.service.ts`, `types/profile.ts`, `lib/i18n` | M10 / M13 | `context/ProfileContext.tsx` |
| `types/user.ts` | M10 | services, contexts, all admin user components, `utils/redirect.ts` |

### Who imports this module

| Exported from here | Importers (count) | Notable |
|---|---:|---|
| `context/AuthContext.tsx` | 13 | `app/layout.tsx`, `components/admin/layout/AdminHeader.tsx` + `AdminSidebar.tsx` (M05), `components/ai/AIChatProvider.tsx` (M09), `components/common/FavoriteButton.tsx` + `PersonalizedHomepage.tsx` (M02), `context/ProfileContext.tsx`, `hooks/useAuth.ts`, five `(public)` pages (M02/M03) |
| `hooks/useAuth.ts` | 22 | Almost every admin page (`app/admin/page.tsx`, `receipts/*`, `reports`, `media`, `content`, `featured`, `gallery/new`) |
| `context/ProfileContext.tsx` | 10 | `/profile`, `/favorites`, `/notifications`, `/quotes`, `/stotras`, `FavoriteButton`, `PersonalizedHomepage` |
| `lib/auth/admin-auth.ts` | 6 files (5 call `verifyAdminUser`, 1 type-only) | `app/api/admin/receipts/*`, `app/api/admin/receipt-sevas/*`; `lib/receipt/admin.ts:18` imports only `ServerAdminUser` (M07/M12) |
| `lib/supabase/admin.ts` | 5 runtime + 8 scripts | `app/actions/sevas.ts`, `lib/ai/ai-settings/admin-repository.ts`, `services/temple-areas.supabase.service.ts`, `services/settings.service.ts`, `app/api/supabase-check/route.ts` (M08/M11) |
| `lib/supabase/client.ts` | 4 | `services/event.service.ts`, `services/settings.service.ts`, `services/ai-analytics.service.ts`, `lib/ai/ai-settings/repository.ts` |
| `lib/supabase/server.ts` | 2 | `services/temple-areas.supabase.service.ts`, `app/api/supabase-check/route.ts:2` |
| `firestore.rules` / `storage.rules` | n/a | shared with M11 (data model) - every module's writes are governed by them |

`services/auth.service.ts` and `services/user.service.ts` are also claimed by M10 (service layer
catalogue); `context/AuthContext.tsx`, `context/ProfileContext.tsx`, `hooks/useAuth.ts` and
`lib/auth.ts` are also claimed by M01 (app shell).

## How to change it

### Add a field to the user profile (e.g. `whatsappOptIn`)

1. `types/user.ts` - add to `UserProfile` and, if the admin screen needs it, to `TempleUser` /
   `TempleUserCreate`.
2. `services/auth.service.ts:57-71` (register) and `:94-116` (login merge) - write the default.
3. `lib/auth.ts:44-67` - the dead duplicate; either update it too or delete the file (preferred).
4. `services/user.service.ts:22-37` and `:46-59` - map the new field out of the snapshot.
5. `components/admin/users/UserForm.tsx:26-32` state + a new input, and `:119-125` if it is a select.
6. `components/admin/users/UserTable.tsx` - a column, if it should be listed.
7. `firestore.rules:37-38` - if the field must be self-service-immutable, add it to the
   `affectedKeys().hasAny([...])` list next to `role`, `isApproved`, `isActive`.

### Add a new role

1. `types/user.ts:3-16` - add to `UserRole`; `:21-44` - map it in `normalizeRole` (and add to
   `NormalizedRole` at `:19` only if it needs its own permission tier).
2. `context/AuthContext.tsx:158-166` - decide which `canAccess*` booleans it gets.
3. `firestore.rules:15-31` - add the literal string to `isAdmin()` / `isSuperAdmin()` /
   `isPriestOrAbove()` as appropriate. **Use the exact string that gets written to Firestore.**
4. `components/admin/users/UserRoleBadge.tsx:7-21` - add a colour, or the badge renders unstyled.
5. `components/admin/users/UserForm.tsx:119-125` - add the `<option>`.
6. `app/api/admin/users/set-role/route.ts:54` - add to `validRoles`.
7. `lib/auth/admin-auth.ts:18` - decide whether it belongs in `BLOCKED_ROLES`.
8. `utils/redirect.ts:6-24` - only if you revive that file.

### Protect a new admin API route

1. `import { verifyAdminUser } from "@/lib/auth/admin-auth";` (never `@/lib/auth`, which exports the
   unsafe `checkAdminAuth`).
2. First lines of the handler: `const admin = await verifyAdminUser(request); if (!admin) return
   NextResponse.json({ error: "Unauthorized" }, { status: 401 });`
3. Add `rateLimit(...)` from `lib/rate-limit.ts` above it, following
   `app/api/admin/users/set-role/route.ts:8-17`.
4. On the calling page, obtain the token with `const token = await user.getIdToken();` and send
   `Authorization: Bearer ${token}` - see `app/admin/receipts/page.tsx:55`.
5. Use the **Admin SDK** (`getAdminFirestore()`) for the write, not the client `db`, so the write is
   not also subject to client rules.

### Make an existing admin page enforce a finer permission

1. `components/admin/layout/AdminAuthGuard.tsx:129-149` - replace the collapsed switch so each
   `Permission` maps to its own boolean from `useAuth()` (`canManageUsers`, `canAccessFinance`,
   `canAccessSettings`, `canAccessBilling`, `canAccessAdministration`).
2. Pull the extra booleans out of `useAuth()` at `:65`.
3. Pass `requiredPermission` on the page (as `app/admin/users/page.tsx:101` already does).
4. Mirror the rule in `firestore.rules` for the collections that page touches - the guard is
   cosmetic without it.

### Add a new collection safely

1. Add a `match /<collection>/{docId}` block in `firestore.rules` **before** the closing braces, and
   grep for an existing block with the same name first - duplicates are ORed, not overridden.
2. Default to `allow read: if true` only for genuinely public content; otherwise `isAuthenticated()`
   or `isAdmin()`.
3. If the server writes it with the Admin SDK, set `allow write: if false` and say so in a comment,
   as `receipts` does (`firestore.rules:98-105`).
4. Note it in `docs/DATA-MODEL.md` / `docs/FIREBASE.md`.

### Close the unauthenticated bootstrap routes

0. Prefer deletion: `scripts/setup-admin.ts` already does this job server-side with the Admin SDK
   (`npm run setup-admin`, `package.json:15`), so neither route needs to exist. Remove the matching
   entries from `docs/API.md:9-75,169-181` and both Postman collections at the same time (M04-F38).
1. `app/api/admin/users/create-admin/route.ts` - either delete the file (the intended use is
   one-time bootstrap) or gate it behind `verifyAdminUser` **and** a `super_admin` role check, and
   move the user creation to `getAuth(adminApp).createUser()` so the route does not sign the server
   in as the new user and then `signOut(auth)` (`:62-81`).
2. `app/api/admin/users/set-role/route.ts` - same gate, plus switch from the client SDK to
   `getAdminFirestore()`.
3. After gating, re-check `firestore.rules:39-41` still permits what the UI needs.

## Faults, smells and risks

| id | severity | what | evidence | suggested direction |
|---|---|---|---|---|
| M04-F01 | HIGH | `/settings/{docId}` is matched twice; the second block allows `write: if true`, and Firestore ORs allow-rules, so temple settings are world-writable | `firestore.rules:136-139` and `firestore.rules:231-234` | Delete the second block; keep `allow write: if isAdmin()` |
| M04-F02 | HIGH | `ai_settings` is world-readable and world-writable - anyone can rewrite the AI system prompt | `firestore.rules:226-229` | `read: if true; write: if isAdmin()` |
| M04-F03 | HIGH | Storage `testimonials/**` allows unauthenticated `write` with no size or content-type limit - anonymous file upload to the project bucket | `storage.rules:5-8` | Require auth (or a server-signed upload), cap size, allow-list image types |
| M04-F04 | HIGH | `POST /api/admin/users/create-admin` has no authentication at all and writes `role:"super_admin"`; only an in-memory 5/min/IP limiter stands in front of it. The write **succeeds** under the checked-in rules: the route is signed in as the user it just created, so `firestore.rules:39` (`create: if isAuthenticated() && request.resource.data.uid == request.auth.uid`) is satisfied. `vercel.json` has no route exclusions, and `docs/API.md:171` publishes a production curl for it | `app/api/admin/users/create-admin/route.ts:7-79`, `firestore.rules:39`, `vercel.json:1-22`, `docs/API.md:171`, `public/postman_collection.json:986` | Delete the route, or gate with `verifyAdminUser` + super-admin check |
| M04-F05 | MEDIUM | `POST /api/admin/users/set-role` has no authentication and accepts any email and any role including `super_admin`. It is a latent hole rather than a live one: it uses the **client** Firestore SDK as an unauthenticated principal, so `firestore.rules:36` denies the `getDocs` lookup and `:40` denies the `setDoc`, and the route currently answers 500. Any loosening of the `users` rules makes it an instant escalation path | `app/api/admin/users/set-role/route.ts:6-88`, `firestore.rules:36,40` | Same gate; use the Admin SDK for the write - or delete the route |
| M04-F06 | MEDIUM | (Severity is MEDIUM only because the module is dead - `checkAdminAuth`/`isUserAdmin` have zero importers outside `lib/auth/index.ts`. It is a trap, not a live hole.) `checkAdminAuth` returns a fake admin whenever `NODE_ENV === "development"` and no header is present, and otherwise accepts **any** bearer token longer than 10 characters as authenticated | `lib/auth/admin.ts:29-31`, `lib/auth/admin.ts:48-50` | Delete `lib/auth/admin.ts` and point `lib/auth/index.ts` at `admin-auth.ts` |
| M04-F07 | HIGH | `profiles` and `bookmarks` have no rule block, so every devotee profile read/write is denied; the error is swallowed and the UI shows empty states | `services/profile.service.ts:30-31`, `firestore.rules` (no match), `context/ProfileContext.tsx:111-115` | Add owner-scoped rules for both; surface the error instead of only `console.error` |
| M04-F08 | HIGH | Admin authorization is entirely client-side: there is no `middleware.ts`, and `app/admin/layout.tsx` relies on a `"use client"` guard, so all admin markup and JS are served to anonymous visitors | `app/admin/layout.tsx:22-31`, `components/admin/layout/AdminAuthGuard.tsx:1`, no `middleware.ts` in repo | Add a middleware or server-layout session check (Firebase session cookie + Admin SDK verify) |
| M04-F09 | MEDIUM | `AdminAuthGuard` collapses every `requiredPermission` value to `canAccessAdmin`, so a priest or office-staff account can open `/admin/users` even though `canManageUsers` is super-admin-only | `components/admin/layout/AdminAuthGuard.tsx:135-141` vs `context/AuthContext.tsx:164` | Map each permission to its own boolean |
| M04-F10 | MEDIUM | The `withPermission` HOC ignores its `requiredPermission` argument and renders the component unconditionally | `components/admin/layout/AdminAuthGuard.tsx:156-163` | Implement it or delete it before someone trusts it |
| M04-F11 | MEDIUM | `lib/auth.ts` is a full functional duplicate of `services/auth.service.ts` (same Firestore writes, same merge logic) and is imported by nobody | `lib/auth.ts:20-133` vs `services/auth.service.ts:37-129`; no importer in the import graph | Delete `lib/auth.ts` |
| M04-F12 | MEDIUM | `lib/auth/admin.ts` and `lib/auth/index.ts` are dead; the barrel exports only the unsafe verifier, so the safe one is the harder import to find | `lib/auth/index.ts:2`; `verifyAdminUser` importers are all direct-path | Re-export `verifyAdminUser` from the barrel and drop the rest |
| M04-F13 | MEDIUM | `GuestOnly` does not gate guests - it renders children for signed-in users too, so `/register` and `/forgot-password` are reachable while authenticated | `components/auth/GuestOnly.tsx:42-43` | Either redirect authenticated users or rename the component |
| M04-F14 | MEDIUM | `ProtectedRoute` is dead code; devotee pages re-implement the check ad hoc with `isAuthenticated` from `ProfileContext` | `components/auth/ProtectedRoute.tsx` (no importer), `app/(public)/profile/page.tsx:20` | Adopt it everywhere or delete it |
| M04-F15 | MEDIUM | `getDashboardRoute` is unused and routes to `/priest` (`:12`), `/staff` (`:15`) and `/devotee` (`:21`), none of which exist as routes; only `/admin` and `/volunteer` (`:18`, `app/(public)/volunteer/`) resolve | `utils/redirect.ts:3-25`; `ls app` and `ls "app/(public)"` show no `priest`/`staff`/`devotee` segments | Delete, or build the role landing pages it assumes |
| M04-F16 | MEDIUM | Role vocabulary is inconsistent across four places: `UserRole` mixes Title Case and snake_case; `isAdmin()` in rules checks `['super_admin','temple_admin','admin','Billing']`; `UserForm` writes `"Temple Admin"`; `set-role` accepts snake_case only. A user created through the admin UI as "Temple Admin" fails `isAdmin()` | `types/user.ts:3-16`, `firestore.rules:18`, `components/admin/users/UserForm.tsx:119-125`, `app/api/admin/users/set-role/route.ts:54` | Pick snake_case as the stored form, normalize on write, migrate existing docs |
| M04-F17 | MEDIUM | `userService.addUser` uses `addDoc`, so admin-created users get a random document id instead of a Firebase Auth uid; `isOwner(userId)` in the rules can then never match and the user cannot read their own document | `services/user.service.ts:64`, `firestore.rules:35` | Create the Auth user server-side and `setDoc(users/{uid})` |
| M04-F18 | MEDIUM | Open redirect after login: the `redirect` query parameter is passed straight to `window.location.href` with no same-origin check, behind a 2-second `setTimeout` | `components/auth/LoginForm.tsx:61-64` | Validate that the target starts with `/`, and use `router.replace` instead of a full reload |
| M04-F19 | MEDIUM | `create-admin` always answers `"Super Admin created: administrator@rayaramathaynk.com"` regardless of the email actually created | `app/api/admin/users/create-admin/route.ts:85` | Echo the real email, or omit it |
| M04-F20 | MEDIUM | `any` is used in violation of AGENTS.md ("no `any` - use `unknown`") | `components/auth/RegisterForm.tsx:64`, `components/auth/ForgotPasswordForm.tsx:40`, `app/api/admin/users/create-admin/route.ts:87`, `app/api/admin/users/set-role/route.ts:89`, `context/ProfileContext.tsx:52,216,228` | Use `unknown` + narrowing, as `LoginForm.tsx:65-66` already does |
| M04-F21 | MEDIUM | Rate limiting is a per-process in-memory `Map`, which on Vercel means one bucket per warm lambda and none across cold starts - effectively no limit on the two bootstrap routes | `lib/rate-limit.ts:11` | Use a shared store (Upstash/Redis), which `docs/SECURITY.md:423-434` already claims exists |
| M04-F22 | MEDIUM | `docs/SECURITY.md` describes a system that does not exist: authorization middleware (`:113-130`, no `middleware.ts`), Google OAuth "enabled" (`:25`, no provider in code), secure session cookies with 24h expiry (`:28-38`, actual auth state is `browserLocalPersistence` in `lib/firebase.ts:108`), and an 8-character password minimum (`:47`, forms enforce 6) | cited lines; `components/auth/RegisterForm.tsx:28` | Rewrite the doc from the code, or implement what it promises |
| M04-F23 | MEDIUM | `donations` create rule only requires authentication, with no `userId == auth.uid` check, unlike `sevaBookings` | `firestore.rules:119-123` vs `:113-117` | Mirror the `sevaBookings` ownership check |
| M04-F24 | MEDIUM | Email verification and approval are collected but never enforced: `isApproved:false` is written at registration and no code path reads it; `emailVerified` is stored but login and every guard ignore it | `services/auth.service.ts:65,110`; `grep -rn isApproved` finds only writers (`app/api/admin/users/create-admin/route.ts:73`, `lib/auth.ts:56,106`, `scripts/setup-admin.ts:62`, `types/user.ts:61`, `firestore.rules:38`) | Decide the policy and enforce it in `AuthContext` + rules, or drop the fields |
| M04-F25 | LOW | The users list downloads the entire `users` collection to the browser and filters in memory, and logs the full list (names, emails, phones) to the browser console | `app/admin/users/page.tsx:25-26,37-51` | Paginate with a Firestore query; delete the `console.log` |
| M04-F26 | LOW | `UserForm` has no validation at all - an empty name/email can be saved - while the public forms use zod | `components/admin/users/UserForm.tsx:34-56` | Reuse `react-hook-form` + zod as in `RegisterForm` |
| M04-F27 | LOW | `window.confirm` and `alert` are used for destructive confirmation and errors while the rest of the app uses `react-hot-toast` | `components/admin/users/DeleteUserDialog.tsx:20`, `components/admin/users/UserForm.tsx:52` | Use the shared dialog + toast; also required for any RN reuse |
| M04-F28 | LOW | `UserRoleBadge` indexes its colour map with no fallback, so a role written by `set-role` (e.g. `"admin"`, which is not a key) renders an unstyled pill | `components/admin/users/UserRoleBadge.tsx:7-21,26` | Add a default class |
| M04-F29 | LOW | Deleting a user removes only the Firestore document; the Firebase Auth account survives and is recreated on next login by `authService.login` | `components/admin/users/DeleteUserDialog.tsx:27`, `services/auth.service.ts:94` | Delete through an Admin-SDK route that removes both |
| M04-F30 | LOW | `.env.example` omits every server-side credential the code reads: `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID` (`lib/admin-firebase.ts:55-64` falls back to `"invalid-key"`/`"demo-project"`) and `ADMIN_API_KEY` (`lib/auth/admin.ts:42`) | `.env.example:1-57` | Document them (names only) so a fresh clone fails loudly instead of silently |
| M04-F31 | LOW | `lib/supabase/client.ts` falls back to a placeholder URL and key, turning a missing-config error into confusing network failures | `lib/supabase/client.ts:4-5` | Throw, as `lib/supabase/admin.ts:4-6` does |
| M04-F32 | LOW | `docs/SUPABASE_DATABASE_SCHEMA.md` mandates that all Supabase access be server-side behind a Firebase token check, but the browser anon client is imported by four runtime modules | `docs/SUPABASE_DATABASE_SCHEMA.md:339-341`; `services/event.service.ts:2`, `services/settings.service.ts:1`, `services/ai-analytics.service.ts:19`, `lib/ai/ai-settings/repository.ts:1` | Route those reads through API routes, or write the RLS policies the doc assumes |
| M04-F33 | LOW | `AuthContext` wraps every `setState` in `setTimeout(...,0)` and logs auth lifecycle to the console; the deferral adds a frame of "loading" on every auth event and AGENTS.md forbids leftover `console.log` | `context/AuthContext.tsx:85-87,96,105,119,125` | Remove the timers (React 18 batches already) and the logs |
| M04-F34 | LOW | `/api/supabase-check` is unauthenticated; it returns only booleans today, but it is an environment-probe endpoint on the public surface | `app/api/supabase-check/route.ts:5-19` | Gate it behind `verifyAdminUser` or remove it from production builds |
| M04-F35 | LOW | Accessibility: the users table has no `scope` on headers and no caption; the login "Remember me" checkbox at `LoginForm.tsx:145` is unbound (no state, no effect); password-visibility toggles have no `aria-label` | `components/admin/users/UserTable.tsx:18-26`, `components/auth/LoginForm.tsx:128-140,145`, `components/auth/RegisterForm.tsx:126-132` | Add `scope="col"`, labels, and either wire or remove "Remember me" |
| M04-F36 | MEDIUM | The admin "Active" checkbox writes `active`, but every security check reads `isActive`. `TempleUserCreate` carries only `active`; registration and `create-admin` write only `isActive`. Deactivating a staff account in `/admin/users` therefore does **not** revoke their admin API access, and `userService.getUsers` shows every registered user as Active because `data.active` is undefined | `components/admin/users/UserForm.tsx:31`, `types/user.ts:94`, `services/user.service.ts:25,48,64,76` vs `services/auth.service.ts:66`, `app/api/admin/users/create-admin/route.ts:74`, `lib/auth/admin-auth.ts:55`, `firestore.rules:38` | Collapse to one field (`isActive`), migrate existing docs, and add `active` to the rules' immutable-key list until then |
| M04-F37 | MEDIUM | `POST /api/admin/users/create-admin` drives the module-level **client** Firebase Auth singleton from a server route: `createUserWithEmailAndPassword(auth, ...)` then `signOut(auth)`. In a warm serverless instance that `auth` object is shared by every concurrent request, so one caller's sign-in/sign-out races another's, and the `setDoc` at `:65` runs as whichever user is signed in at that moment | `app/api/admin/users/create-admin/route.ts:62,65,81`, `lib/firebase.ts:70,88` | Use `getAuth(adminApp).createUser()` + `getAdminFirestore()`; never use the client SDK in a route handler |
| M04-F38 | MEDIUM | Both unauthenticated bootstrap routes are publicly documented, including a production curl and a Postman collection checked into `public/` and therefore served at the site root. `vercel.json` contains only cache headers, so nothing excludes them from the deployment | `docs/API.md:12-17,55-60,171-181`, `public/postman_collection.json:986,1008`, `postman/Sri_Raghavendra_Swamy_Matha_API.postman_collection.json:1327,1354`, `vercel.json:1-22` | Remove the routes, then the documentation; do not ship an API collection describing unauthenticated admin creation |
| M04-F39 | LOW | `UserStats` counts admins and volunteers by Title Case role strings only, so users created by registration, `set-role` or `create-admin` (snake_case) are never counted - a super admin bootstrapped through the API shows as 0 admins | `app/admin/users/page.tsx:70-79` | Count on `normalizeRole(u.role)` instead of raw strings |
| M04-F40 | LOW | `scripts/setup-admin.ts` - the safe Admin-SDK bootstrap - guards on `CONFIG.adminUid === 'your-firebase-auth-uid'` while the placeholder actually shipped is `'YOUR_UID_FROM_FIREBASE'`, so the guard never fires and an unedited run writes `users/YOUR_UID_FROM_FIREBASE` with `role:'super_admin'` | `scripts/setup-admin.ts:34` vs `:43`; `package.json:15` (`npm run setup-admin`) | Compare against the real placeholder, or validate with a regex |

## Portability notes (React Native / cross-platform)

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| `services/auth.service.ts` | none - `firebase/auth` + `firebase/firestore` modular SDK | **reuse as-is** | Works under `@react-native-firebase` or the JS SDK with `getReactNativePersistence`; only the persistence initialiser differs |
| `types/user.ts`, `normalizeRole` | none | reuse as-is | Pure TypeScript; should become the shared contract |
| `context/AuthContext.tsx` | none in the logic; `initializeAuthPersistence` from `lib/firebase.ts` uses `browserLocalPersistence` | **adapt** | Swap persistence for `getReactNativePersistence(AsyncStorage)`; the rest of the provider is platform-neutral |
| `context/ProfileContext.tsx` | `useRouter` from `next/navigation` (imported `:20`, assigned `:63`, never used), `File` type in `uploadProfileImage` (`:31`) | adapt | Replace `File` with a `{uri, type, name}` asset shape; drop the router import |
| `hooks/useAuth.ts` | none | reuse as-is | One line |
| `components/auth/LoginForm.tsx`, `RegisterForm.tsx`, `ForgotPasswordForm.tsx` | `next/link`, `next/navigation` (`useRouter`, `useSearchParams`), `window.location`, Tailwind classes, DOM `<form>/<input>/<button>` | **rewrite the view, reuse the logic** | zod schemas and the submit handlers port unchanged; the JSX does not. Extract each `onSubmit` into a shared hook first |
| `components/auth/GuestOnly.tsx`, `ProtectedRoute.tsx` | `next/navigation` router, DOM markup | rewrite | Becomes a React Navigation guard / conditional navigator |
| `components/auth/LoginHeader.tsx`, `app/(auth)/layout.tsx` | `next/image`, CSS gradients, `grid lg:grid-cols-2` | rewrite | Pure presentation; RN needs `Image` + `LinearGradient` |
| `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(auth)/forgot-password/page.tsx` | App Router file conventions, `Suspense` + `useSearchParams` | rewrite | Routes become screens |
| `app/admin/users/*`, `components/admin/users/*` | `next/link`, `next/navigation`, HTML `<table>`, `window.confirm`, `alert` | rewrite | Admin CRUD is the least portable part; `FlatList` + a modal replace the table and `confirm` |
| `services/user.service.ts` | none | reuse as-is | Plain Firestore calls |
| `lib/auth/admin-auth.ts` | `server-only`, `NextRequest`, `firebase-admin` | **server-side only** | Stays on the server; the RN client calls the same HTTP routes with the same bearer token |
| `app/api/admin/users/*` | Next route handlers | reuse as endpoints | An RN client can call them unchanged - which is exactly why F04/F05 must be fixed first |
| `lib/supabase/server.ts` | `cookies()` from `next/headers` | rewrite | Cookie-based sessions have no RN equivalent; use the token-based client |
| `lib/supabase/client.ts`, `admin.ts` | none / server env | reuse (client), server-only (admin) | `@supabase/supabase-js` runs in RN with AsyncStorage |
| `firestore.rules`, `storage.rules` | none | reuse as-is | Platform-independent, and the only enforcement both clients share |
| `utils/redirect.ts` | none | reuse if revived | Pure mapping; route names would change |

What a React Native client would need from this module:

1. A platform-neutral `auth-core` package holding `authService`, `types/user.ts` (including
   `normalizeRole`) and the zod schemas currently inlined in the three forms - none of that touches
   the DOM today, so the extraction is mechanical.
2. Persistence injection: `lib/firebase.ts` hardcodes `browserLocalPersistence`; the factory must
   take the persistence strategy as a parameter so RN can pass `getReactNativePersistence`.
3. A real server-side session/authorization layer. Today the only server verification is
   `verifyAdminUser`, used by six receipt routes; everything else trusts a client-side guard that an
   RN app simply would not run. Any second client makes F04, F05 and F08 immediately exploitable.
4. Deep-link handling to replace `?redirect=` and `window.location.href`; the redirect target must be
   validated against an allow-list shared by both clients.
5. An HTTP surface for user management. `userService` talks to Firestore directly from the client;
   that works in RN too, but it means every client depends on `firestore.rules` being right. Moving
   the admin CRUD behind Admin-SDK routes would give both clients one enforcement point.
6. Password reset and email verification already go through Firebase's hosted pages, which work from
   RN without change.

## Coverage

filesExpected 36, filesMentioned 36, omitted: none.

All 36 files in `.claude/state/inventory/M04.json` appear in **Key files** or in a tree/flow. Files
outside the roots that are cited for boundary confirmation only (one import level):
`lib/firebase.ts`, `lib/admin-firebase.ts`, `lib/rate-limit.ts`, `types/user.ts`, `types/profile.ts`,
`services/profile.service.ts`, `components/admin/layout/AdminAuthGuard.tsx`, `app/layout.tsx`,
`app/admin/layout.tsx`, `app/admin/receipts/page.tsx`, and (added in the verify pass)
`scripts/setup-admin.ts`, `vercel.json`, `docs/API.md`, `public/postman_collection.json`,
`tests/functional/09_performance_security.spec.ts`.

## UNCLEAR

- ~~Whether the two bootstrap API routes are reachable in the deployed environment.~~ **Settled
  (verify pass).** No page calls them, but `vercel.json:1-22` contains only cache headers - nothing
  excludes them - and `docs/API.md:171,178` publishes production curls against
  `https://rayaramathaynk.vercel.app`, with the same two requests in `public/postman_collection.json:986,1008`
  (served publicly) and in `tests/functional/09_performance_security.spec.ts:391,426`. Treat both as
  live public endpoints.
- ~~Whether `set-role` can actually write.~~ **Settled statically (verify pass).** It uses the
  *client* Firestore SDK from a server route, so both steps run as an unauthenticated principal:
  `firestore.rules:36` denies the `getDocs` lookup before the write is ever reached, and `:40` would
  deny the `setDoc`. The route answers 500 today. Note that `create-admin` is **not** in the same
  position - it signs in as the user it creates first, so its `setDoc` satisfies `firestore.rules:39`
  and succeeds. An emulator run with the checked-in rules would confirm both.
- **Whether `profiles`/`bookmarks` reads are actually denied in production**, or whether the
  deployed rules differ from the checked-in `firestore.rules`. Settled by: `firebase deploy
  --only firestore:rules --dry-run`, or reading the rules in the Firebase console.
- **Which role strings exist in the live `users` collection.** The mismatch in M04-F16 is only
  harmful if Title Case values were actually written. Settled by: a one-off aggregation over the
  `users` collection (out of scope for this static run).
- **Whether Google OAuth was ever enabled in the Firebase console** (`docs/SECURITY.md:25` claims it
  is). No provider code exists, but console configuration is invisible from the repository.

## Verification log (2026-09-19)

Skeptic pass over this file: 71 distinct cited paths checked on disk (2 apparent misses were prose
fragments and globs, not paths; `middleware.ts` is cited
deliberately as absent and `find . -maxdepth 3 -name middleware.ts` still returns nothing). 31 factual
claims sampled across Entry points, Component trees, Data flow, Types and stores and How to change it;
all 35 fault rows re-opened against the code.

- Data flow 4 said "six call sites use `verifyAdminUser`" -> now five call sites plus one type-only
  import -> `lib/receipt/admin.ts:18` imports `ServerAdminUser` only; the five callers are the
  receipts/receipt-sevas routes at `:2` each.
- Cross-module said `context/AuthContext.tsx` has 11 importers -> now 13 -> `grep -rl` also finds
  `components/common/FavoriteButton.tsx` and `components/common/PersonalizedHomepage.tsx`.
- Cross-module said `hooks/useAuth.ts` has 17 importers -> now 22 -> `grep -rl "@/hooks/useAuth"`
  returns 22 files.
- Cross-module said `lib/supabase/admin.ts` has 3 runtime importers -> now 5 -> also
  `services/settings.service.ts` and `app/api/supabase-check/route.ts:3`.
- Cross-module said `lib/supabase/server.ts` has 1 importer -> now 2 -> `app/api/supabase-check/route.ts:2`
  imports it as well.
- Types said `UserRole` is a 12-member union -> now 13, with a note that `"admin"` is not a member ->
  `types/user.ts:3-16` lists 13 literals; `set-role` (`:54`) nonetheless accepts `"admin"`.
- Portability said `useRouter` in `ProfileContext` is "imported at :20, unused" -> now "imported :20,
  assigned :63, never used" -> `grep -n router context/ProfileContext.tsx` returns only `:63`.
- M04-F04 was correct but understated -> added that the write succeeds under the checked-in rules and
  that the route is publicly documented -> the route signs in as the new user before `setDoc`, so
  `firestore.rules:39` is satisfied; `vercel.json:1-22` excludes nothing; `docs/API.md:171`.
- M04-F05 was HIGH -> DOWNGRADED to MEDIUM -> the route's client-SDK `getDocs` is denied by
  `firestore.rules:36` and its `setDoc` by `:40` for an unauthenticated principal, so it cannot
  escalate today; it stays a latent hole, not a live one.
- M04-F06 was HIGH -> DOWNGRADED to MEDIUM -> `checkAdminAuth`/`isUserAdmin` have zero importers
  outside `lib/auth/index.ts:2`; the code is a trap, not a reachable bypass.
- M04-F15 said `/priest`, `/staff`, `/devotee` do not exist -> now also names `/volunteer` as the one
  non-admin target that *does* resolve -> `app/(public)/volunteer/` exists; `utils/redirect.ts:18`.
- M04-F24 cited `services/auth.service.ts:66` for `isApproved` -> now `:65` (`:66` is `isActive`), and
  the "no reader" claim now carries the full grep result.
- Added M04-F36 (admin "Active" writes `active` while every check reads `isActive`),
  M04-F37 (client Auth singleton driven from a server route), M04-F38 (both bootstrap routes publicly
  documented, Postman collection served from `public/`), M04-F39 (`UserStats` counts Title Case only),
  M04-F40 (`scripts/setup-admin.ts` placeholder guard never fires).
- Coverage: all 36 inventory files were already mentioned. Added `scripts/setup-admin.ts` as an
  in-scope boundary file (the third, and only safe, bootstrap path) plus `vercel.json`, `docs/API.md`,
  `public/postman_collection.json` and `tests/functional/09_performance_security.spec.ts` as evidence
  sources.
- UNCLEAR items 1 and 2 were settled from the repository and are struck through with the evidence;
  items 3-5 (deployed rules, live role strings, Firebase console OAuth config) remain genuinely
  unanswerable from static files.

Claims that survived unchanged include: `/login` is a server page wrapping `LoginForm` in `Suspense`
(`app/(auth)/login/page.tsx:12-17`); `GuestOnly` renders children for everyone
(`components/auth/GuestOnly.tsx:42-43`); `AdminAuthGuard` collapses every permission to
`canAccessAdmin` (`:129-149`) and `withPermission` ignores its argument (`:156-163`); the whole
`firestore.rules` collection table, including the duplicate `/settings` block at `:136-139` and
`:231-234` and world-writable `ai_settings` at `:226-229`; `storage.rules:5-8`; no `middleware.ts`;
`addDoc` in `services/user.service.ts:64`; the open redirect at `components/auth/LoginForm.tsx:61-64`;
and every doc-drift line cited from `docs/SECURITY.md` (`:25`, `:28-41`, `:47`, `:110-130`, `:418-436`).
