# Seva Entry - Temple app booking on Android (Plan C) - OUTLINE

> **For agentic workers:** this is an outline. Before its window, expand each task with superpowers:writing-plans into full steps (failing test, run, implement signature, run, commit), then execute with superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax once expanded.

**Goal:** Devotees book online sevas and pay by UPI (Cashfree, test mode) from the existing Expo temple app on Android, signing in with email and password, and keep their e-receipts in the app - the same server flow as the website, with receipts in the `W-APP` / `WT-APP` series.

**Architecture:** The app (`apps/mobile`, Expo SDK ~57, expo-router, its own `package.json` and lock file, not a workspace) signs in with the Firebase JS SDK (same accounts as the website, C-48) and calls the website's `/api/seva/devotee/*` routes with the Firebase ID token as a Bearer header. It never talks to Supabase for seva data. Payment opens the website's hosted checkout page in an in-app browser and returns to the app by a deep link (C-47); the app then polls the order status route.

**Tech Stack:** Expo ~57, React Native 0.86, expo-router, `firebase` (JS SDK, added), `@react-native-async-storage/async-storage` (present), `expo-web-browser` and `expo-linking` (present), `react-native-svg` (added, for the QR), `jest-expo` (added, tests), EAS Build for the Android preview build.

**Spec:** `docs/seva/DESIGN-BOOK.md` §14.1 (website and app), §14.3, §5.1 item 26, §17.1 (`apps/mobile/lib/api.ts`); decisions D16, D27; owner sign-off "app: Android first; email + password (Google later; iPhone waits - Apple fee)" (DECISIONS.md, Design Book deck `app`); calls C-47, C-48. Mobile background: `docs/rearchitecture/` React Native report (Option B, Expo).

## Global Constraints

Plan A's and Plan B's Global Constraints apply. In addition:

- **Android only** in this plan; no iOS build, no Apple account. **Email + password** sign-in only (Google sign-in later).
- App scheme is the existing `rayaramathaynk` (`apps/mobile/app.json`); Android package `com.rayaramathaynk.mobile`. The payment return deep link is `rayaramathaynk://pay-return?ref=<order_ref>`.
- The app never holds gateway keys and never decides that a payment succeeded: only the server's order status counts.
- Seva data comes only through the website's API (the anon Supabase read in `apps/mobile/lib/api.ts:3-14` returns nothing under deny-all RLS, DB §5.1 item 26). Other app tabs (events, gallery, Raya AI) are out of scope.
- Same devotee fields and rules as the website (name required; gotra, nakshatra, rashi searchable; phone last and optional; 90 days ahead; same-day closes at 12:00 IST; one e-receipt per date).
- Kannada under English in every label; text at least 13 px equivalent.

## Review Focus (to pin when the plan is expanded)

1. **The devotee leaves the in-app browser without finishing, or the deep link never fires** -> the app shows "Payment not confirmed yet. Do not pay again." and keeps checking the order status; no duplicate order on retry.
2. **Expired Firebase ID token on a long session** -> the API client refreshes the token once and retries; a 401 after refresh signs the devotee out with a plain message.
3. **No network / flaky 4G** -> booking screens keep the typed details; submitting shows a retry, never a half-created payment.
4. **Deep link with a ref that is not this devotee's order** -> the status route answers only for the owner; the app shows "We could not find that booking."
5. **Old app version after a server change** -> the API answers a clear `validation` error the app shows as text; the app sends its version in a header for later checks.

## Dependencies on Plans A and B

Starts after Plan B's wave B3 is merged. Needs: `/api/seva/devotee/orders` (POST with `channel: 'app'`), `/api/seva/devotee/orders/[ref]`, `/api/seva/devotee/receipts` (B2-1); the website checkout page that the app opens (B3-1 - add `?return=app` handling there if B3-1 did not); the `W-APP` / `WT-APP` issue path (B1-1); catalogue read for online sevas (Plan A A3-4 `GET /api/seva/sevas` is staff-only, so C1-2 adds a public read route or B2-1's flow exposes `GET /api/seva/devotee/sevas`); wire types and domain lists (A1-3); the QR URL rule (A1-2).

---

## Wave C0 - Setup

### C0-1: SETUP-GUIDE A4.2 - Expo account and the Android preview build
- Tier: **Opus high** - a click-by-click guide for someone who has never used Expo; check expo.dev's current screens and EAS docs on the web first (cite URL + date; mark unconfirmed steps UNVERIFIED).
- Files: `docs/seva/SETUP-GUIDE.md` (replace the A4.2 placeholder).
- Content: create a free Expo account, create the project link for `apps/mobile`, give the builder access, run an EAS preview build for Android (APK), install the APK on an Android phone (allow installs from this source), and where the build list lives; the free plan's build queue may be slow (UNVERIFIED limits, check the pricing page).
- Test intent: `tests/unit/seva/setup-guide.test.ts` extended - A4.2 cites a checked source and holds no secrets.

## Wave C1 - Foundations (2 tasks in parallel; needs C0)

### C1-1: Firebase email + password sign-in in the app
- Tier: **Opus high** - auth persistence on React Native and the shared accounts with the website.
- Files: `apps/mobile/package.json` (add `firebase`, `jest-expo`, `react-native-svg` via `npx expo install`), `apps/mobile/lib/firebase.ts` (`initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` - confirm the import path for the installed `firebase` major on its docs), `apps/mobile/app/(auth)/sign-in.tsx`, `sign-up.tsx`, `forgot.tsx`, `apps/mobile/lib/auth.tsx` (`AuthProvider`, `useAuth(): { user; signIn(email, password); signUp(...); signOut(); getIdToken(): Promise<string> }`), `apps/mobile/jest.config.js`, tests.
- Config: `EXPO_PUBLIC_FIREBASE_*` env names (same Firebase project as the website), `EXPO_PUBLIC_SITE_URL`.
- Test intent: sign-in success and wrong-password message; session survives an app restart (persistence mocked); `getIdToken(true)` used after a 401; sign-up writes the `users/{uid}` doc only with fields the Plan A Firestore rule allows (no role, or `devotee`).

### C1-2: Seva API client and catalogue through the API
- Tier: **Opus medium** - a typed fetch client over existing routes.
- Files: `apps/mobile/lib/seva-api.ts` (`sevaApi(getToken): { onlineSevas(); createOrder(body); orderStatus(ref); myReceipts() }`, Bearer header, app version header `x-seva-app-version`, one token refresh on 401), `apps/mobile/lib/seva-types.ts` (generated copy of the wire types the app uses), `scripts/seva/sync-mobile-types.ts` (copies the listed types from `types/seva*.ts` with a "generated - do not edit" header), Modify `apps/mobile/lib/api.ts` (`fetchSevas` reads the online catalogue through the API), and on the web side the public catalogue route if Plan B did not add one (`app/api/seva/devotee/sevas/route.ts`, online/both, active, no sign-in needed), tests.
- Test intent: the client sends the Bearer and version headers; a 401 refreshes once then signs out; the generated types match the web types (a test re-runs the generator and diffs); `fetchSevas` no longer calls Supabase.

## Wave C2 - Screens (3 tasks in parallel; needs C1)

### C2-1: Booking screens
- Tier: **Opus high** - the main flow on a small screen; same rules as the website.
- Mockups: `settings-devotee.html#d-sevas`, `#d-details`, `#d-review` (phone frames).
- Files: `apps/mobile/app/sevas/index.tsx` (online sevas), `apps/mobile/app/sevas/[id].tsx` (rework: details, devotee fields with searchable nakshatra / rashi / gotra pickers using the shared domain lists, phone last), `apps/mobile/app/sevas/review.tsx`, `apps/mobile/components/seva/*`, date picker with several dates where allowed and festival chips, tests.
- Test intent: only the name is required; dates limited to 90 days and the 12:00 same-day cutoff; review shows "No extra charges" and the exact total; the order is created with `channel: 'app'`.

### C2-2: Checkout in the in-app browser and the return deep link
- Tier: **Opus high** - payment hand-off and return; never trusts the client for success.
- Files: `apps/mobile/lib/checkout.ts` (`openCheckout(orderRef): Promise<'returned' | 'dismissed'>` with `WebBrowser.openAuthSessionAsync('<site>/sevas/checkout/<ref>?return=app', 'rayaramathaynk://pay-return')`), `apps/mobile/app/pay-return.tsx` (reads `ref`, polls `orderStatus` every 3 s up to 2 minutes, then "Payment not confirmed yet. Do not pay again. We are checking with the bank."), `apps/mobile/app/sevas/pending.tsx`, `success.tsx`, tests.
- Test intent: a dismissed browser goes to the pending screen and keeps checking; a paid status shows success with the receipts; a foreign or unknown ref shows "We could not find that booking."; no second order is created on retry (Review Focus 1, 4).

### C2-3: My bookings and e-receipts with QR
- Tier: **Opus medium** - display of existing data.
- Files: `apps/mobile/app/(tabs)/bookings.tsx` (new tab "My seva bookings"), `apps/mobile/components/seva/EReceipt.tsx` (seva date large, receipt number `W-APP-...` / `WT-APP-...`, "1 of 3 - paid together", QR rendered from the server's SVG string with `SvgXml`, Share via React Native `Share` with the `/r/<token>` link), tests.
- Test intent: one card per receipt; QR encodes `<site>/r/<token>`; no phone shown; Kannada under English on every label.

## Wave C3 - Verification

### C3-1: App tests, Android preview build and documentation
- Tier: **Opus high** - first real Android build and an end-to-end payment in test mode.
- Files: `apps/mobile/eas.json` (profile `preview`: Android APK), `docs/MOBILE_COMPLETION_MATRIX.md` (seva booking rows), `docs/seva/README.md` (app section), `$STATE/test-reports/C-TEST-REPORT.md` (git-ignored).
- Steps in outline: run `npm test` and `npm run typecheck` in `apps/mobile`; run an EAS preview build (needs the owner's Expo account from C0-1); install on an Android phone; book two dates and pay with a Cashfree test UPI id; confirm two `WT-APP` e-receipts appear in the app and on the website account.
- Owner's 10-minute checklist: install the APK; sign in with email and password; book a seva for two dates; pay in test mode; see the two e-receipts; scan one QR at the prasadam page.

**Plan C gates.** C1 gate: app unit tests + web typecheck; C2 gate: app unit tests; C3 gate: the build and the owner checklist above.

**Window estimate:** about 0.5 of a window (range 0.45-0.7; 7 tasks - 5 Opus high, 2 medium; calculation in `PLAN-INDEX.md`). EAS cloud build waiting time is not counted (it costs no usage). Detail each task with superpowers:writing-plans at the start of the Plan C window.

END OF REPORT
