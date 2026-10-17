# M13 - Device capabilities, notifications, location, QR, share, i18n and offline/PWA behaviour
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs. Verify against the code before acting on any claim.

## Answers questions about

- "How does the device capability layer work - what does `@/lib/device` actually give me?"
- "Where is platform/browser/mobile detection done, and is it SSR-safe?"
- "How do permissions work - camera, location, notifications, clipboard - and where is the permission dialog?"
- "How do notifications work? Is this web push / FCM, or something else? Do reminders survive a page reload?"
- "Where are notification preferences stored, and why are there two notification pages?"
- "How does 'Get Directions' / distance-to-temple work, and where does the temple's lat/long live?"
- "How does sharing work - native Web Share, WhatsApp fallback, clipboard copy?"
- "How is 'Add to calendar' implemented - Google/Outlook/ICS?"
- "How does QR scanning work, which library, and where does it come from?"
- "How are QR codes generated, and what is the payload format?"
- "Is this app a PWA? Is there a manifest, a service worker, offline caching, an install prompt?"
- "What languages does the site support (English / Kannada / Sanskrit), and how do I switch language?"
- "Why do the Kannada translations never show up on the site?"
- "How is the Kannada font wired (Noto Sans Kannada / `--font-kannada`)?"
- "Where is `prefers-reduced-motion` handled, and which components respect it?"
- "What accessibility hooks exist (focus trap, roving tabindex, announce, skip link) and who uses them?"
- "What device telemetry is collected and where does it go?"
- "What does `services/ux.service.ts` do and who calls it?"
- "Which files in `components/device/` are actually rendered anywhere?"
- "Why would the camera and geolocation not work in production?"
- "What is in `public/` - icons, images, documents - and what is missing?"
- "Which parts of this module survive a move to React Native, and which must be rewritten?"

## Purpose and business role

This module is the portal's **native-capability layer**: the code that lets a devotee use their phone's
hardware and OS features from the website. It is meant to cover seven capabilities - device/capability
detection, permissions, geolocation and navigation to the temple, native share (WhatsApp/Telegram/etc.),
add-to-calendar for events and sevas, browser notifications and reminders, and camera QR scanning plus QR
generation for printable codes. On top of that it carries the site's **internationalisation** (English,
Kannada, Sanskrit dictionaries), the **accessibility** primitives (reduced motion, high contrast, focus
management) and everything under `public/`.

The intent, visible in `lib/device/index.ts:1-14`, was a portable abstraction "for web and future native
mobile packaging (Capacitor/React Native)". In practice the module is **largely built but barely wired
in**. The 9 presentational components in `components/device/` have zero consumers anywhere in the app;
the 825 translated strings in `lib/i18n/dictionaries/` are never rendered because no `I18nProvider` is
ever mounted; the analytics service has no callers; and the "PWA" has no manifest, no service worker and
no offline page. What *is* live is a thin slice: five feature components and two settings pages call
`useShare`, `useLocation`, `useNotifications`, `useDevice`, `useCapabilities`; `/qr` renders printable QR
codes; and `/notifications` plus `/pages/notifications` present notification preferences.

## Code roots

Owned (from `.claude/state/chunks.json`, chunk `M13`):

```
lib/device/                      capability layer (services + hooks + qr)
components/device/               presentational device widgets (all currently unused)
lib/i18n/                        locales, dictionaries, React context
types/device.ts                  all device types + DEFAULT_DEVICE_SETTINGS
services/device-analytics.service.ts
services/ux.service.ts
app/(public)/qr/page.tsx
app/(public)/notifications/page.tsx
app/(public)/pages/notifications/page.tsx
public/                          static assets (68 files)
hooks/useReducedMotion.ts
hooks/a11y/index.ts
```

No files adopted from the Unassigned list - none of the 11 unassigned files belong to this module.

Boundary files read one level out, **not owned**: `app/layout.tsx`, `next.config.ts`,
`components/common/LanguageSwitcher.tsx`, `components/common/A11yProvider.tsx`, `package.json`,
`app/globals.css`.

## Entry points

| Route / entry | File | server/client | auth required | What it renders or does |
|---|---|---|---|---|
| `/qr` | `app/(public)/qr/page.tsx` | client (`"use client"` line 1) | no | Two printable URL QR cards (site URL, testimonial-submit URL) with Download / Print / Share |
| `/notifications` | `app/(public)/notifications/page.tsx` | client | **yes** (renders a sign-in wall if `!user`, line 126) | Notification Centre: 7 preference toggles persisted through `ProfileContext`, browser-permission banner, scheduled-reminder list, test notification |
| `/pages/notifications` | `app/(public)/pages/notifications/page.tsx` | client | no | A *second*, competing notification-preferences page: 8 toggles persisted to `localStorage` key `temple-notification-preferences` |
| `@/lib/device` (barrel) | `lib/device/index.ts` | **no `"use client"`** but re-exports client hooks and 8 client component modules | n/a | The public API every consumer imports |
| `@/lib/device/hooks` (barrel) | `lib/device/hooks/index.ts` | no directive; children are client | n/a | Hook-only barrel used by `components/device/*` |
| `@/lib/i18n` (barrel) | `lib/i18n/index.ts` | no directive | n/a | Locale config + `I18nProvider` + `useTranslation` |
| `@/hooks/a11y` | `hooks/a11y/index.ts` | **no `"use client"`, but every export is a hook touching `document`** | n/a | Accessibility hooks; consumed by `components/common/A11yProvider.tsx` |
| `@/hooks/useReducedMotion` | `hooks/useReducedMotion.ts` | client | n/a | `prefers-reduced-motion` matchMedia hook |
| `services/ux.service.ts` | same | server-side (called from `app/api/chat/route.ts:26`) | n/a | Quick actions + suggested questions for Raya AI, with `labelKn` Kannada labels |

There is **no** `app/manifest.ts`, no `public/manifest.json`, no `public/sw.js`, no `next-pwa` - verified by
`find public app -iname "manifest*" -o -iname "sw.js" -o -iname "service-worker*"` (empty) and by grepping
`next.config.ts` and `package.json` for `manifest|serviceWorker|workbox|next-pwa` (no hits).

## Component trees

### 1. `/qr` - printable QR codes

```
QRPage (client)                              app/(public)/qr/page.tsx:145
├── Navbar (client)                          components/layout/Navbar.tsx            [M02]
├── Breadcrumb (client)                      components/calendar/Breadcrumb.tsx      [M05]
├── SacredDivider (client)                   components/home/SacredDivider.tsx       [M02]
├── QRCodeCard (client, local)               app/(public)/qr/page.tsx:22
│   ├── hook useURLQRCodeGenerator           lib/device/qr/QRCode.tsx:433
│   │   └── generateURLQRCodeDataUrl         lib/device/qr/QRCode.tsx:414
│   │       └── dynamic import("qrcode")     -> data: URL (client-only)
│   ├── hook useShare                        lib/device/hooks/useShare.ts:29
│   │   └── shareService                     lib/device/share/index.ts:143
│   ├── Button (client)                      components/ui/button.tsx                [M01]
│   ├── handleDownload -> <a download>       app/(public)/qr/page.tsx:27
│   ├── handlePrint -> window.open + document.write   app/(public)/qr/page.tsx:38
│   └── handleShare -> fetch(dataUrl)->Blob->File-> navigator.share  app/(public)/qr/page.tsx:78
└── Footer (client)                          components/layout/Footer.tsx            [M02]
```

Note: `QRCodeDisplay`, `CompactQRCode` and `QRScannerResult` also live in `lib/device/qr/QRCode.tsx` but
have **no consumers** - only the URL-based generator is used.

### 2. `/notifications` - notification centre (profile-backed)

```
NotificationCenterPage (client)              app/(public)/notifications/page.tsx:87
├── useAuthContext                           context/AuthContext.tsx                 [M01]
├── useProfile -> preferences,               context/ProfileContext.tsx              [M02]
│   updateNotificationPreferences            -> services/profile.service.ts -> Firestore `profiles`
├── useNotifications                         lib/device/hooks/useNotifications.tsx:34
│   ├── useNotificationPermission            lib/device/hooks/usePermissions.ts:140
│   │   └── usePermission("notifications")   lib/device/hooks/usePermissions.ts:26
│   │       ├── queryPermission              lib/device/permissions/index.ts:87
│   │       └── getPermissionManager()       lib/device/permissions/index.ts:326
│   └── notificationsService                 lib/device/notifications/index.ts:284
├── CardSkeleton (client)                    components/common/SkeletonLoader.tsx    [M01]  (imported, never rendered)
├── Link (next/link) x2 -> /login, /register
└── NOTIFICATION_TYPES[] (local const, 7 entries)  app/(public)/notifications/page.tsx:34
```

### 3. `/pages/notifications` - notification preferences (localStorage-backed, duplicate)

```
NotificationPreferencesPage (client)         app/(public)/pages/notifications/page.tsx:103
├── Navbar / Breadcrumb / Footer                                                     [M02, M05]
├── useNotifications (from "@/lib/device")   lib/device/hooks/useNotifications.tsx:34
├── Switch (client)                          components/ui/switch.tsx                [M01]
├── Button (client)                          components/ui/button.tsx                [M01]
├── preferenceItems[] (local const, 8 entries)  app/(public)/pages/notifications/page.tsx:49
└── handleSave -> localStorage["temple-notification-preferences"]          line 143
                + notifications.scheduleEventReminder("daily-panchanga", ...)  line 151
```

### 4. The device-widget framework (built, **zero consumers**)

Every component below is exported from `components/device/index.ts`; eight of the nine are also
re-exported from `lib/device/index.ts:90-136` (`FloatingActionBar` is **not**). None of them is rendered
anywhere in `app/` or `components/` - verified by grepping all 19 exported names outside
`components/device/`, 0 hits. They share one shape: a `"use client"` component that
calls one device hook and renders shadcn `Button`/`Dialog`/`Switch` plus lucide icons.

```
<DeviceWidget> (client)                      components/device/*.tsx
├── one hook from lib/device/hooks           (useShare | useLocation | useAddToCalendar |
│                                             useNotifications | useQRScanner | usePermissionWithDialog |
│                                             useCapabilities)
├── Button / Dialog / Card / Switch          components/ui/*                          [M01]
└── lucide-react icons
```

| Component file | Hook it drives | Exports |
|---|---|---|
| `components/device/ShareButton.tsx` | `useShare`, `useShareContent` | `ShareButton`, `ShareIconButton`, `ShareDropdown` |
| `components/device/LocationButton.tsx` | `useLocation` | `LocationButton`, `SimpleLocationButton` |
| `components/device/DirectionsButton.tsx` | `useLocation` | `DirectionsButton`, `DirectionsLink` |
| `components/device/CalendarButton.tsx` | `useAddToCalendar` | `CalendarButton`, `SimpleCalendarButton` |
| `components/device/NotificationToggle.tsx` | `useNotifications` | `NotificationToggle`, `NotificationBell`, `NotifyMeButton`, `NotificationStatus` |
| `components/device/QRScanner.tsx` | `useQRScanner` | `QRScanner`, `QRScannerButton`, `CompactQRScanner` |
| `components/device/PermissionDialog.tsx` | `usePermissionWithDialog`, `usePermission` | `PermissionDialog`, `PermissionCard`, `PermissionGate`, `PermissionRequestButton` |
| `components/device/CapabilityBadge.tsx` | `useCapabilities` | `CapabilityBadge`, `CapabilityGrid`, `CapabilityGroup`, `DeviceCapabilitiesSummary` |
| `components/device/FloatingActionBar.tsx` | `useDevice` + `useActionRegistry` | `FloatingActionBar`, `CompactActionBar`, `StickyActionBar` |

### 5. What actually consumes this module today

```
components/home/TempleInfo.tsx     (client)  -> useLocation, useShare        [M02]
components/home/Panchanga.tsx      (client)  -> useShare, useNotifications   [M02/M05]
components/home/DailyQuoteWidget.tsx(client) -> useShare                     [M06]
components/events/EventCard.tsx    (client)  -> useShare, useLocation, useNotifications [M04]
app/(public)/pages/settings/page.tsx(client) -> useDevice, useCapabilities, useNotifications [M02]
app/(public)/qr/page.tsx            (client)  -> useShare                     (own route)
app/(public)/pages/notifications/   (client)  -> useNotifications             (own route)
app/(public)/notifications/page.tsx (client)  -> useNotifications, imported direct from
                                                 lib/device/hooks/useNotifications (not the barrel)
app/layout.tsx (server)                      -> A11yProvider -> hooks/a11y (useHighContrast, useKeyboardNavigationMode)
components/home/Hero|TempleInfo|TempleTimings,
components/ui/AnimateIn|DeepaFlame|FloatingParticles|
MicroInteractions|PageTransition             -> hooks/useReducedMotion       [M01/M02]
app/api/chat/route.ts (server)               -> services/ux.service.ts       [M09]
```

## Data flow

### Flow A - Share an event (the most-used path)

1. User taps a share control in `components/events/EventCard.tsx:7` (imports `useShare` from `@/lib/device`).
2. `useShare()` (`lib/device/hooks/useShare.ts:30`) reads `useCapability("shareSupported")`
   (`lib/device/hooks/useDevice.ts:96` -> `getCapabilities()` -> `isShareSupported()`,
   `lib/device/capabilities/index.ts:98`).
3. `share(data)` calls `shareService.shareNative(data)` (`lib/device/share/index.ts:20`) ->
   `navigator.share(data)`.
4. If native share is absent or rejected, it falls back to `shareService.copyToClipboard(data.url)`
   (`lib/device/share/index.ts:77`), which uses `navigator.clipboard.writeText` and, failing that, a
   hidden `<textarea>` + `document.execCommand("copy")`.
5. `setLastShareProvider("native" | "copy")`. **No store is written and no analytics event is emitted.**
   Provider-specific sharing (`shareVia`) opens a `window.open` intent URL for WhatsApp / Facebook /
   Twitter / LinkedIn / Telegram / mailto (`lib/device/share/index.ts:40-75`).

### Flow B - Distance and directions to the temple

1. `useLocation()` (`lib/device/hooks/useLocation.ts:54`) seeds `templeLocation` from
   `locationService.getTempleLocation()`, which is `DEFAULT_DEVICE_SETTINGS.templeLocation`
   (`types/device.ts:265`, lat `13.096788188005597`, lng `77.58461022456063`).
2. `getCurrentLocation()` checks `useLocationPermission()`; if `isPrompt` it calls
   `requestPermission("location")` (`lib/device/permissions/index.ts:125`, location branch `:144-160`), which *is* the browser prompt -
   it calls `navigator.geolocation.getCurrentPosition` purely to trigger it.
3. `locationService.getCurrentPosition()` (`lib/device/location/index.ts:44`) wraps
   `navigator.geolocation.getCurrentPosition` in a promise and maps `GeolocationPosition` ->
   `LocationPosition` via `positionToLocationPosition` (`lib/device/location/index.ts:251`).
4. Distance is computed locally with the Haversine formula (`lib/device/location/index.ts:114`), ETA at a
   hard-coded 40 km/h (`lib/device/location/index.ts:148`).
5. `openNavigation(app)` (`lib/device/location/index.ts:198`) `window.open`s a Google / Apple / Waze
   deep link. **No store touched at any step; position is never persisted.**

### Flow C - Schedule an event reminder ("Notify me")

1. Caller invokes `useNotifications().scheduleEventReminder(eventId, title, date, minutesBefore)`
   (`lib/device/hooks/useNotifications.tsx:70`).
2. That delegates to `notificationsService.scheduleEventReminder`
   (`lib/device/notifications/index.ts:139`), which computes `eventDate - minutesBefore` and calls
   `schedule()` (`lib/device/notifications/index.ts:106`).
3. `schedule()` stores the record in an **in-memory `Map`** and arms a raw `setTimeout(delay)`.
4. When the timeout fires it calls `show()` (`lib/device/notifications/index.ts:64`), which constructs
   `new Notification(title, {...})` and auto-closes it after 5 s.
5. **There is no store.** The `Map` and the `setTimeout` die on navigation, reload or tab close. There is
   no service worker, no push subscription, no FCM token, no Firestore write. A reminder set for tomorrow
   morning will never fire.
6. Separately, `/notifications` writes the *preference* booleans through
   `useProfile().updateNotificationPreferences` -> `services/profile.service.ts` -> Firestore `profiles`
   [M02], and `/pages/notifications` writes its own copy to `localStorage`.

### Flow D - QR scan (camera)

1. `useQRScanner()` (`lib/device/hooks/useQRScanner.ts:51`) calls `qrScanner.loadLibrary()` on mount.
2. `loadLibrary()` (`lib/device/qr/scanner.ts:62`) injects
   `<script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js">` into `document.head`.
   `html5-qrcode` is **not** in `package.json` - it is a runtime CDN fetch.
3. The **hook**, not the service, asks for permission: `useQRScanner.start()` calls
   `useCameraPermission().request()` (`lib/device/hooks/useQRScanner.ts:141-157`) ->
   `requestPermission("camera")` (`lib/device/permissions/index.ts:125`) ->
   `navigator.mediaDevices.getUserMedia({video:true})` (`lib/device/permissions/index.ts:140`). Only then
   does it call `qrScanner.start(elementId, callbacks, ...)` (`lib/device/qr/scanner.ts:107-166`), which does
   `new window.Html5Qrcode(elementId)` then `.start(cameraId, {fps, qrbox}, onDecode)`.
   `lib/device/qr/scanner.ts` itself never touches the permission API.
4. Decoded text -> `QRCodeResult {text, timestamp}` -> `onScan` callback -> component state.
5. No store. **This path cannot work in production**: `next.config.ts:29` sets
   `Permissions-Policy: camera=(), microphone=(), geolocation=()` (camera and geolocation disabled
   site-wide) and `next.config.ts:33` sets a CSP whose `script-src` is `'self' 'unsafe-inline'
   'unsafe-eval'` - `unpkg.com` is not allowed, so the library never loads.

### Flow E - QR generation (printable)

1. `/qr` builds two `URLQRCodeData` objects from the hard-coded `SITE_URL`
   (`app/(public)/qr/page.tsx:15` = `https://rayaramathaynk.vercel.app`).
2. `useURLQRCodeGenerator` (`lib/device/qr/QRCode.tsx:434`) -> `generateURLQRCodeDataUrl`
   (`lib/device/qr/QRCode.tsx:414`) -> dynamic `import("qrcode")` -> `QRCode.toDataURL(url, {width, margin:2,
   color:{dark:"#1c1917", light:"#ffffff"}})`.
3. The data URL is rendered in a plain `<img>` (eslint-disabled `@next/next/no-img-element`).
4. Download writes an `<a download>`; Print opens a popup and `document.write`s a full HTML document
   (`app/(public)/qr/page.tsx:46`); Share converts the data URL to a `File` and calls `navigator.share`.
5. The other payload format, used only by the unreferenced `QRCodeDisplay`, is
   `RAYAMATHA:<TYPE>:<ID>` (`createQRPayload`, `lib/device/qr/QRCode.tsx:80`), parsed back in
   `QRScannerResult` (`parseQRData`, `lib/device/qr/QRCode.tsx:323`).

### Flow F - Language switch (broken end to end)

1. `components/common/LanguageSwitcher.tsx:4` imports `useLocale` from `@/lib/i18n`; it is rendered by
   `app/(public)/profile/page.tsx:115` and `app/(public)/profile/preferences/page.tsx:144`.
2. `useLocale()` (`lib/i18n/context.tsx:158`) calls `useI18n()` (`:142`), which **throws**
   `"useI18n must be used within an I18nProvider"` when the context is undefined
   (`lib/i18n/context.tsx:146`).
3. `I18nProvider` is defined at `lib/i18n/context.tsx:53` and re-exported at `lib/i18n/index.ts:36` -
   and is **mounted nowhere**. `app/layout.tsx:84-88` wraps the tree in `A11yProvider` / `AuthProvider` /
   `ProfileProvider` / `AIChatProvider` only.
4. Consequently the whole dictionary pipeline (`getDictionary` ->
   `import("./dictionaries/<locale>.json")`, `lib/i18n/dictionaries.ts:421-433`) is dead, and there are
   **zero** `t("...")` call sites in `app/` or `components/`.
5. The only locale value that reaches a store is `ProfileContext` / `services/profile.service.ts:28`,
   which import the `Locale` *type* and persist a preferred language on the profile [M02].

## Key files

### `lib/device/` - capability layer (21 files, 5,217 lines)

| File | Lines | Role | Key exports | Notes |
|---|---|---|---|---|
| `lib/device/index.ts` | 143 | Public barrel for the whole module | re-exports everything | **No `"use client"`** yet re-exports 8 client component modules (`:90-136`); importing `useShare` from here pulls all device widgets into the bundle |
| `lib/device/capabilities/index.ts` | 259 | UA/feature detection | `getCapabilities`, `getDeviceInfo`, `detectPlatform`, `detectBrowser`, `isTouchDevice`, `capabilityFlags`, 11 `is*Supported` | Every function guards `typeof window === "undefined"`; `isInstallPromptSupported()` always returns `true` (`:163`) |
| `lib/device/permissions/index.ts` | 383 | Permission query/request + change subscription | `queryPermission`, `requestPermission`, `PermissionManager`, `getPermissionManager`, `getPermissionInfo` | `PermissionManager.startAutoRecheck` polls every 30 s (line 297); local `PermissionState` shadows the DOM type |
| `lib/device/notifications/index.ts` | 285 | Browser Notification wrapper + in-memory scheduler | `notificationsService` | `setTimeout`-based; nothing persists; no click handler; test icon `/favicon.ico` does not exist in `public/` |
| `lib/device/location/index.ts` | 290 | Geolocation, Haversine distance, map deep links | `locationService`, `LocationOptions` | `watchId` kept on the singleton, so two `useLocation()` consumers fight over one watch |
| `lib/device/share/index.ts` | 144 | Web Share + 6 intent-URL fallbacks + clipboard | `shareService` | `share()` returns `false` even when the clipboard fallback succeeded (`:116`) |
| `lib/device/calendar/index.ts` | 219 | Google/Outlook URLs, ICS generation and download | `calendarService` | `generateAppleCalendarUrl` computes two unused vars (`:31-32`) and leaks an object URL (`:36`); ICS times are always UTC `Z`, with no all-day (`VALUE=DATE`) handling |
| `lib/device/settings.ts` | 197 | Device settings singleton, Firestore-backed | `deviceSettingsService` | `initialize()` is **never called anywhere**, so Firestore `settings/device` is never read; `update()` calls `updateDoc` directly from `lib/` |
| `lib/device/actions.ts` | 409 | Registry #1: AI-invocable actions | `deviceActionRegistry`, `useDeviceActions`, `DeviceActionType` | **Zero consumers.** `DeviceActionType` declares 14 values (`:9-23`) but only 11 are registered (`:110-345`). Declares a hook (`useDeviceActions`, `:382`) without `"use client"` |
| `lib/device/actions/index.ts` | 330 | Registry #2: context-driven hook API, 16 executors | `useActionRegistry` (`:78`), `generateShareText`, `getShareProviders`, `createCalendarEvent` | Used only by the unused `FloatingActionBar`; same import specifier family as `actions.ts` |
| `lib/device/qr/scanner.ts` | 349 | html5-qrcode wrapper (camera) | `qrScanner`, `QRScannerCallbacks` | CDN script injection; `type Html5QrcodeConstructor = any` (line 10); `switchCamera` (`:249`) hard-codes element id `"qr-reader"` (`:266`) |
| `lib/device/qr/QRCode.tsx` | 465 | QR generation + display + result parser | `useURLQRCodeGenerator`, `generateURLQRCodeDataUrl`, `QRCodeDisplay`, `CompactQRCode`, `QRScannerResult`, `generateQRId`, `createQRPayload` | Only the URL generator is consumed; `useQRCodeGenerator` depends on the object `data` (`:124`) so it regenerates on every render of an inline literal |
| `lib/device/hooks/useDevice.ts` | 342 | Device info, capabilities, online, PWA install, orientation, battery, connection | `useDevice`, `useCapabilities`, `useOnlineStatus`, `useCapability`, `usePWAInstall`, `useOrientation`, `useBattery`, `useConnection` | Imports `useSyncExternalStore` and never uses it (line 8); `usePWAInstall` exists but there is no manifest for the browser to offer an install |
| `lib/device/hooks/usePermissions.ts` | 256 | Permission hooks | `usePermission`, `usePermissions`, 4 typed wrappers, `usePermissionWithDialog`, `usePermissionSummary` | `usePermissions` effect keys on `types.join(",")` - a lint-suppressed dependency hack (line 119) |
| `lib/device/hooks/useNotifications.tsx` | 157 | Notification hook + context provider | `useNotifications`, `NotificationProvider`, `useNotificationContext` | Polls `getScheduled().length` every **1000 ms** (line 45); `NotificationProvider` is never mounted |
| `lib/device/hooks/useLocation.ts` | 292 | Location hook + distance | `useLocation`, `useTempleDistance` | `permission` object is in the `useCallback` deps, so `getCurrentLocation` changes identity on each permission tick |
| `lib/device/hooks/useShare.ts` | 203 | Share hook + templated content share | `useShare`, `useShareContent` | `useShareContent` recomputes `shareText` every render; its local `isSharing` (`:139`) is set three times but is absent from both `UseShareContentReturn` and the return object (`:189-202`) |
| `lib/device/hooks/useQRScanner.ts` | 297 | Scanner lifecycle | `useQRScanner` | Cleans up with `qrScanner.stop()` on unmount |
| `lib/device/hooks/useCalendar.ts` | 151 | Calendar hook | `useCalendar`, `useAddToCalendar` | `useAddToCalendar` builds a new `event` object each render |
| `lib/device/hooks/index.ts` | 40 | Hook barrel | - | Also re-exports `useActionRegistry` from `@/lib/device/actions/index` |
| `lib/device/types/index.ts` | 6 | `export * from "@/types/device"` | - | Pure indirection; nothing imports it |

### `components/device/` - widgets (10 files: 9 widgets + barrel, 2,629 lines) - **all unused**

| File | Lines | Role | Key exports |
|---|---|---|---|
| `components/device/FloatingActionBar.tsx` | 422 | Mobile action bar wired to `useActionRegistry` | `FloatingActionBar`, `CompactActionBar`, `StickyActionBar`, `ActionBarAction`, `FloatingActionBarProps`, `StickyActionBarProps` |
| `components/device/ShareButton.tsx` | 379 | Share button + provider dropdown | `ShareButton`, `ShareIconButton`, `ShareDropdown` |
| `components/device/QRScanner.tsx` | 339 | Full scanner UI (dialog, torch, camera switch, file upload) | `QRScanner`, `QRScannerButton`, `CompactQRScanner` |
| `components/device/CapabilityBadge.tsx` | 308 | Capability badges / grid / summary | `CapabilityBadge`, `CapabilityGrid`, `CapabilityGroup`, `DeviceCapabilitiesSummary` |
| `components/device/PermissionDialog.tsx` | 303 | Permission prompts and gate | `PermissionDialog`, `PermissionCard`, `PermissionGate`, `PermissionRequestButton` |
| `components/device/NotificationToggle.tsx` | 260 | Notification toggles / bell / notify-me | `NotificationToggle`, `NotificationBell`, `NotifyMeButton`, `NotificationStatus` |
| `components/device/DirectionsButton.tsx` | 215 | Directions CTA | `DirectionsButton`, `DirectionsLink` |
| `components/device/CalendarButton.tsx` | 194 | Add-to-calendar with provider dialog | `CalendarButton`, `SimpleCalendarButton` |
| `components/device/LocationButton.tsx` | 163 | Location / distance CTA | `LocationButton`, `SimpleLocationButton` |
| `components/device/index.ts` | 46 | Barrel | - |

### `lib/i18n/` - internationalisation (7 files, 1,797 lines)

| File | Lines | Role | Key exports | Notes |
|---|---|---|---|---|
| `lib/i18n/config.ts` | 108 | Locale registry | `locales` (`["en","kn","sa"]`), `defaultLocale`, `localeNames`, `localeNativeNames`, `localeFlags`, `localeDirections`, `localeConfigs`, `isValidLocale`, `getLocaleFromPath` | `getLocaleFromPath` (`:94-103`) implies a `/[locale]/...` route segment that **does not exist** - there is no `app/[locale]` directory |
| `lib/i18n/context.tsx` | 228 | React provider, `t()`, date formatters | `I18nProvider`, `useI18n`, `useTranslation`, `useLocale`, `useDirection`, `useDateFormatter` | Never mounted; `direction` hard-codes `sa` as RTL (line 124), contradicting `localeDirections.sa === "ltr"`; `getNestedValue(obj: any, ...)` (line 27) |
| `lib/i18n/dictionaries.ts` | 434 | Dictionary types + lazy loaders | `Dictionary`, 25 section interfaces, `dictionaryLoaders`, `getDictionary` | Loaders `import()` the three JSON files; falls back to `en` on error |
| `lib/i18n/dictionaries/en.json` | 328 | English strings | - | 25 top-level sections, 275 leaf strings |
| `lib/i18n/dictionaries/kn.json` | 328 | Kannada strings | - | 275 leaves, **0 identical to English** - genuinely translated |
| `lib/i18n/dictionaries/sa.json` | 328 | Sanskrit strings | - | 275 leaves, 2 identical to English |
| `lib/i18n/index.ts` | 43 | Barrel | - | - |

### Other owned files

| File | Lines | Role | Key exports | Notes |
|---|---|---|---|---|
| `types/device.ts` | 297 | All device types and defaults | `DeviceInfo`, `Capabilities`, `PermissionState/Type/RequestResult`, `Coordinates`, `LocationPosition`, `TempleLocation`, `ShareData/Provider/Options`, `CalendarEvent/Provider`, `NotificationOptions/Type`, `ScheduledNotification`, `QRScannerOptions/Result/State`, `DeviceSettings`, `DEFAULT_DEVICE_SETTINGS` | Temple coordinates, address, phone and all six share templates are hard-coded here (lines 265-296) |
| `services/device-analytics.service.ts` | 232 | Event queue for device telemetry | `deviceAnalytics`, `trackDeviceEvent`, `DeviceEventType`, `DeviceAnalyticsEvent` | **Zero consumers.** `processQueue()` splices the batch and only `console.log`s it in dev - events are discarded. `setInterval` at line 35 is never cleared |
| `services/ux.service.ts` | 366 | Quick actions + suggested questions for Raya AI, keyed by `Intent` | `getQuickActions`, `getSuggestedQuestions`, `getGreetingWithActions`, `getResponseMetadata`, `QuickAction`, `SuggestedQuestion` | The one place Kannada strings reach users: every action carries `labelKn`/`textKn`. Consumed by `app/api/chat/route.ts:26` [M09] |
| `hooks/useReducedMotion.ts` | 53 | `prefers-reduced-motion` | `useReducedMotion`, `useMotionConfig` | Used by 8 components (`components/home/{Hero,TempleInfo,TempleTimings}.tsx`, `components/ui/{AnimateIn,DeepaFlame,FloatingParticles,MicroInteractions,PageTransition}.tsx`); matches `docs/UI-GUIDELINES.md:354` |
| `hooks/a11y/index.ts` | 314 | Accessibility hooks | `useHighContrast`, `useAccessibleColors`, `useFocusTrap`, `useKeyboardNavigation`, `useAnnounce`, `useSkipLink`, `useKeyboardNavigationMode`, `useRovingTabIndex` | **No `"use client"`**; only `useHighContrast` and `useKeyboardNavigationMode` have a consumer (`components/common/A11yProvider.tsx:4`); `useRovingTabIndex(items: any[])` (line 261) |
| `app/(public)/qr/page.tsx` | 270 | Printable QR page | `QRPage` | Hard-coded `SITE_URL` (line 15) disagrees with `metadataBase` in `app/layout.tsx:32` (`https://www.srsmathaynk.com`) |
| `app/(public)/notifications/page.tsx` | 379 | Notification centre | `NotificationCenterPage` | `useState<any[]>` (line 100); unescaped `doesn't` in JSX |
| `app/(public)/pages/notifications/page.tsx` | 291 | Duplicate preferences page | `NotificationPreferencesPage` | localStorage-only; the info note admits it |

### `public/` - 68 files, grouped

| Group | Count | Contents |
|---|---|---|
| `public/*.svg` (root) | 5 | `favicon.svg`, `file.svg`, `globe.svg`, `next.svg`, `window.svg` - three are unmodified Next.js starter assets |
| `public/*.json` (root) | 1 | `postman_collection.json` (34 KB API collection shipped to the public web root) |
| `public/data/panchanga/` | 1 | `current.json` - **live data, not a static asset**: written by the CI job `.github/workflows/panchanga.yml:43` and fetched at runtime by `components/home/Panchanga.tsx:70` and `app/(public)/display/page.tsx:121` [M05] |
| `public/documents/` | 5 | `.gitkeep` only in `calendars/`, `forms/`, `newsletters/`, `seva-lists/` + root - all empty |
| `public/icons/` | 1 | `.gitkeep` - **empty**; no PWA icon set exists |
| `public/images/` (root files) | 10 | `Annadana.jpg`, `Hero-m.jpg`, `Hero-s.jpg`, `hero.jpg`, `Maha Mangalarati.jpg`, `panchamruta.jpg`, `pattern.png`, `raghavendra_swamy.jpg`, `raghavendra_swamy.png`, `deepa.svg` |
| `public/images/committee/` | 14 | 13 `.png` portraits + `.gitignore` |
| `public/images/temple/` | 8 | `Ananda.jpg`, `Bhakti.jpg`, `Prahallada 1.jpg`, `Prasada.jpg`, `Seva.jpg`, `Shraddha.jpg`, `Tapas.jpg` + `.gitkeep` |
| `public/images/aaradhane/` (+ `2026/`) | 4 | `355-Aaradhana-mohotsava.jpg`, `355-aaradhane-ynk-mutt.jpg`, `2026/Booklet.pdf`, `.gitkeep` |
| `public/images/logos/` | 3 | `social-preview.png`, `ynk_matha_logo.png`, `.gitkeep` |
| `public/images/chatbot/` | 1 | `Raya-Bot.png` |
| `public/images/gallery/` | 2 | `Naveen-testimonial.png`, `.gitkeep` |
| `public/images/testimonials/` | 2 | `Naveen-testimonial.png`, `.gitignore` |
| `public/testimonials/` | 2 | `Naveen-testimonial.png`, `.gitkeep` |
| `public/avatars/` | 1 | `deepa.jpg` |
| Empty placeholder dirs | 8 | `.gitkeep` only in `images/{avatars,banners,deities,events,poojas,priests,sevas}` and `videos/` |
| **Absent** | - | no `manifest.json`, no `sw.js`, no `robots.txt`, no `sitemap.xml`, no `offline.html`, no `favicon.ico` (though `app/layout.tsx:67` links one), no maskable icons |

By extension: 21 `.png`, 17 `.jpg`, 6 `.svg`, 2 `.json`, 1 `.pdf`, 21 extension-less (`.gitkeep`/`.gitignore`).

## Types and stores

**Types used**

- `types/device.ts` - the single source for this module (`DeviceInfo`, `Capabilities`, `PermissionType`,
  `PermissionState`, `Coordinates`, `LocationPosition`, `TempleLocation`, `ShareData`, `ShareProvider`,
  `CalendarEvent`, `CalendarProvider`, `NotificationOptions`, `ScheduledNotification`, `NotificationType`,
  `CameraDirection`, `QRScannerOptions`, `QRCodeResult`, `QRScannerState`, `DeviceSettings`,
  `DEFAULT_DEVICE_SETTINGS`).
- `lib/i18n/config.ts` - `Locale`, `LocaleCode`, `LocaleConfig`.
- `lib/i18n/dictionaries.ts` - `Dictionary` and 25 section interfaces.
- `lib/ai/intent/types` - `Intent`, imported by `services/ux.service.ts:6` [M09].

**Stores touched**

| Store | Kind | Path | Read | Write |
|---|---|---|---|---|
| `settings/device` | Firestore doc | `lib/device/settings.ts:53`, `:89` | via `initialize()` - **never called** | via `update()` with `updateDoc` (fails if the doc is absent) |
| `profiles` (notification preferences) | Firestore, via `ProfileContext` [M02] | `app/(public)/notifications/page.tsx:89` | yes | yes (`updateNotificationPreferences`) |
| `localStorage["temple-notification-preferences"]` | browser | `app/(public)/pages/notifications/page.tsx:101` | yes (`:107`) | yes (`:143`) |
| `localStorage["temple-device-settings"]` | browser | `app/(public)/pages/settings/page.tsx:37` [M02] | yes | yes |
| `localStorage["preferred-locale"]` | browser | `lib/i18n/context.tsx:25` | yes | yes (dead - no provider) |
| In-memory `Map` of scheduled notifications | process memory | `lib/device/notifications/index.ts:10` | yes | yes (lost on reload) |
| In-memory analytics queue | process memory | `services/device-analytics.service.ts:26` | - | written then discarded |
| `lib/i18n/dictionaries/{en,kn,sa}.json` | static file | `lib/i18n/dictionaries.ts:421-433` | lazy `import()` - dead | - |
| `public/*` | static file | served by Next | yes | - |

There is **no** Supabase table, no push-subscription store, no FCM token collection, and no device-analytics
collection anywhere in this module.

## Cross-module dependencies

**This module imports from other chunks**

| Import | From chunk | Used by |
|---|---|---|
| `@/components/ui/button`, `card`, `dialog`, `switch`, `select` | M01 (design system) | every `components/device/*.tsx`, `lib/device/qr/QRCode.tsx` |
| `@/lib/utils` (`cn`) | M01 | `lib/device/qr/QRCode.tsx:21` |
| `@/lib/firebase` (`db`) | M01/M12 | `lib/device/settings.ts:47` (dynamic import) |
| `@/components/layout/Navbar`, `Footer` | M02 | `/qr`, `/pages/notifications` |
| `@/components/calendar/Breadcrumb` | M05 | `/qr`, `/pages/notifications` |
| `@/components/home/SacredDivider` | M02 | `/qr` |
| `@/context/AuthContext`, `@/context/ProfileContext` | M01 / M02 | `app/(public)/notifications/page.tsx` |
| `@/components/common/SkeletonLoader` | M01 | `app/(public)/notifications/page.tsx` (imported, unused) |
| `@/lib/ai/intent/types` (`Intent`) | M09 | `services/ux.service.ts` |
| `react-hot-toast`, `lucide-react`, `qrcode` | npm | widely |

**Who imports this module**

| Consumer | Chunk | What it takes |
|---|---|---|
| `components/home/TempleInfo.tsx` | M02 | `useLocation`, `useShare`, `useReducedMotion` |
| `components/home/Panchanga.tsx` | M05 | `useShare`, `useNotifications` |
| `components/home/DailyQuoteWidget.tsx` | M06 | `useShare` |
| `components/events/EventCard.tsx` | M04 | `useShare`, `useLocation`, `useNotifications` |
| `app/(public)/pages/settings/page.tsx` | M02 | `useDevice`, `useCapabilities`, `useNotifications` |
| `components/home/Hero.tsx`, `TempleTimings.tsx`, `components/ui/{AnimateIn,DeepaFlame,FloatingParticles,MicroInteractions,PageTransition}.tsx` | M01/M02 | `useReducedMotion` |
| `components/common/A11yProvider.tsx` | M01 | `useHighContrast`, `useKeyboardNavigationMode` |
| `components/common/LanguageSwitcher.tsx` | M01/M02 | `useLocale`, `locales`, `localeNames`, `localeFlags` (throws - see M13-F02) |
| `context/ProfileContext.tsx`, `services/profile.service.ts` | M02 | the `Locale` *type* only |
| `app/api/chat/route.ts` | M09 | `getResponseMetadata`, `getQuickActions`, `getSuggestedQuestions` |

`app/(public)/notifications/page.tsx` and `app/(public)/pages/notifications/page.tsx` are shared with M02;
`app/(public)/qr/page.tsx` is shared with M03 (per `.claude/state/inventory/SUMMARY.md:48-50`).

## How to change it

### R1 - Add a new device capability (e.g. vibration)

1. `types/device.ts` - add `vibrationSupported: boolean` to `Capabilities`.
2. `lib/device/capabilities/index.ts` - add `isVibrationSupported()` and a line in `getCapabilities()`
   and in `capabilityFlags`.
3. `lib/device/vibration/index.ts` - new singleton service in the shape of `shareService`
   (guard `typeof window === "undefined"`, return booleans, never throw).
4. `lib/device/hooks/useVibration.ts` - `"use client"` hook that wraps the service.
5. `lib/device/hooks/index.ts` and `lib/device/index.ts` - export both.
6. `lib/device/hooks/useDevice.ts` - add the field to the `useCapabilities` initial state object
   (it is a literal, not derived, so a missing field silently reads `undefined`).

### R2 - Add a new notification type

1. `types/device.ts` - extend `NotificationType`.
2. `lib/device/notifications/index.ts` - add a `case` in `showForType` (`:236`).
3. `app/(public)/notifications/page.tsx` - add an entry to `NOTIFICATION_TYPES` (`:34`) **and**
   `app/(public)/pages/notifications/page.tsx` `preferenceItems` (`:49`) plus `defaultPreferences` (`:38`) -
   the two lists are separate.
4. `types/profile.ts` + `services/profile.service.ts` [M02] - add the preference key, or the toggle
   writes a field the profile schema does not know.

### R3 - Change the temple's location, phone or share templates

1. `types/device.ts:265` - `DEFAULT_DEVICE_SETTINGS.templeLocation` / `shareTemplates`. This is the only
   value that reaches runtime today.
2. If you want the Firestore-backed override to work, call `deviceSettingsService.initialize()` from a
   client provider mounted in `app/layout.tsx`, then have `locationService.setTempleLocation(...)` subscribe
   to `deviceSettingsService.subscribe(...)`. Neither wire exists now.
3. Change `updateDoc` to `setDoc(..., {merge:true})` in `lib/device/settings.ts:90` so the first write
   creates the doc.

### R4 - Actually render one of the device widgets (e.g. `ShareButton` on an event page)

1. Import from `@/components/device` (**not** `@/lib/device`) to avoid dragging the whole barrel in.
2. Ensure the host page or component is a client component; all widgets are `"use client"`.
3. If the widget uses camera or geolocation, first relax `next.config.ts:29`
   `Permissions-Policy` (see M13-F01) or it will silently do nothing.
4. Add the widget to a test under `tests/` - none of these components has any test today.

### R5 - Turn i18n on

1. Create a client provider component that renders `I18nProvider` (`lib/i18n/context.tsx:53`) and mount
   it in `app/layout.tsx` inside `<body>`, outside `AuthProvider`.
2. Fix `lib/i18n/context.tsx:124` to read `localeDirections[locale]` instead of hard-coding `sa` as RTL.
3. Replace hard-coded JSX text with `t("section.key")` - there are ~1,089 literal text nodes across 174
   of the 355 `.tsx` files today and **zero** `t(` call sites.
4. Add any new key to all three of `lib/i18n/dictionaries/{en,kn,sa}.json` and to the matching interface
   in `lib/i18n/dictionaries.ts`, or `getNestedValue` returns `undefined` and `t()` echoes the key.
5. Apply `className="font-kannada"` (defined in `app/globals.css:60`) to Kannada text, or rely on the
   `--font-kannada` stack already set on `body` fallbacks. The font itself is loaded with `next/font`
   (`Noto_Sans_Kannada`, `app/layout.tsx:24-27`) and exposed as the CSS variable `--font-kannada`, which
   `app/globals.css:4` puts ahead of Inter in the `body`, heading and `.font-kannada` stacks
   (`:14`, `:19`, `:26`, `:44`, `:54`, `:61`). The Kannada font is therefore wired correctly and is the one
   part of the i18n story that actually works - `tests/kannada-font-validation.spec.ts` covers it.

### R6 - Make the app an installable PWA

1. Add `app/manifest.ts` (Next 16 metadata route) with `name`, `short_name`, `start_url`, `display:
   "standalone"`, `theme_color`, and an `icons` array.
2. Generate 192/512 px and maskable icons into `public/icons/` - the folder exists but holds only
   `.gitkeep`.
3. Add a service worker (a `public/sw.js` plus a registration effect, or `next-pwa`) - nothing registers
   one today, and `isServiceWorkerSupported()` (`lib/device/capabilities/index.ts:86`) only reports
   browser support, it never registers.
4. Only then does `usePWAInstall` (`lib/device/hooks/useDevice.ts:104`) have a `beforeinstallprompt` to
   catch.
5. For reminders that survive a reload, move scheduling out of `setTimeout` into the service worker plus
   a real push subscription, and persist subscriptions server-side.

### R7 - Add a new accessibility hook

1. Add it to `hooks/a11y/index.ts` - and add `"use client"` at the top of that file first (M13-F09).
2. Surface it through `components/common/A11yProvider.tsx` [M01] if it needs to be app-wide.
3. Use `useReducedMotion` from `hooks/useReducedMotion.ts` rather than re-implementing the media query -
   `A11yProvider.tsx:22-34` already duplicates it.

## Faults, smells and risks

| id | severity | what | evidence | suggested direction |
|---|---|---|---|---|
| M13-F01 | HIGH | `Permissions-Policy: camera=(), microphone=(), geolocation=()` disables camera and geolocation for the whole origin, so every geolocation and QR-scanning feature in this module is dead in production | `next.config.ts:29-30` (value string on `:30`); consumers `lib/device/location/index.ts:44`, `lib/device/permissions/index.ts:140` (camera `getUserMedia`) and `:147` (`geolocation.getCurrentPosition`) | Change to `camera=(self), geolocation=(self)` if these features are wanted; otherwise delete the location/QR code paths rather than shipping dead UI |
| M13-F02 | HIGH | `useI18n()` throws when no provider is present, and `I18nProvider` is mounted nowhere - yet `LanguageSwitcher` (which calls `useLocale` -> `useI18n`) is rendered on two profile pages, so those pages crash | `lib/i18n/context.tsx:146`, `lib/i18n/context.tsx:53`; `app/layout.tsx:84-88` has no `I18nProvider`; `components/common/LanguageSwitcher.tsx:4`, rendered at `app/(public)/profile/page.tsx:115` and `app/(public)/profile/preferences/page.tsx:144` | Mount `I18nProvider` in the root layout, or make `useI18n` return a default context instead of throwing |
| M13-F03 | HIGH | The "notification" system is `setTimeout` over an in-memory `Map`. No service worker, no Web Push, no FCM, no persistence - every scheduled reminder is lost on reload, navigation or tab close, while the UI promises "you'll be notified" | `lib/device/notifications/index.ts:103-127` (`setTimeout` + `Map`), `:10`; UI claims at `app/(public)/notifications/page.tsx:359-372`, `components/device/FloatingActionBar.tsx:128` | Either implement Web Push with a service worker and a server-side subscription store, or relabel the feature as "reminder while this tab is open" |
| M13-F04 | HIGH | QR scanning loads `html5-qrcode` from `unpkg.com` at runtime; the package is not a dependency, and the site CSP `script-src 'self' 'unsafe-inline' 'unsafe-eval'` does not allow unpkg, so the script is blocked in production | `lib/device/qr/scanner.ts:78`; `html5-qrcode` absent from `package.json`; CSP at `next.config.ts:33` | Add `html5-qrcode` (or `@zxing/browser`) as a real dependency and `import()` it, removing the CDN and the CSP conflict |
| M13-F05 | HIGH | All 9 widgets in `components/device/` (2,629 lines incl. the barrel) have zero consumers; `lib/device/actions.ts` (409 lines, `deviceActionRegistry`/`useDeviceActions`) has zero consumers; `services/device-analytics.service.ts` (232 lines) has zero consumers; `QRCodeDisplay`/`CompactQRCode`/`QRScannerResult` (`lib/device/qr/QRCode.tsx:132-360`, ~230 lines) have zero consumers. Roughly **3,500** lines of dead code in an 11,845-line chunk | grep of all 19 widget export names outside `components/device/` returns 0 hits; `deviceActionRegistry`, `useDeviceActions`, `deviceAnalytics`, `trackDeviceEvent`, `QRCodeDisplay`, `CompactQRCode`, `QRScannerResult` each appear only at their own definition and in `lib/device/index.ts`; `components/device/FloatingActionBar.tsx:88` is the only consumer of `useActionRegistry` and is itself unused | Decide per widget: wire it into a page, or delete it. Dead UI code is where drift and false documentation start |
| M13-F06 | HIGH | `lib/device/index.ts` has no `"use client"` but re-exports 8 client component modules alongside the hooks (`FloatingActionBar` is the one widget it does not re-export). A page importing only `useShare` from `@/lib/device` pulls every device widget, `Dialog`, `Card`, `Switch` and the full lucide icon set into its client bundle | `lib/device/index.ts:90-136`; consumers `components/home/DailyQuoteWidget.tsx:7`, `components/events/EventCard.tsx:7`, `app/(public)/pages/settings/page.tsx:12`, `app/(public)/qr/page.tsx:11`, `components/home/TempleInfo.tsx:19`, `components/home/Panchanga.tsx:19`, `app/(public)/pages/notifications/page.tsx:12` | Split the barrel: `@/lib/device` for services and hooks, `@/components/device` for UI, and never re-export components from `lib/` |
| M13-F07 | MEDIUM | Two competing notification-preference pages with different key sets and different stores - `/notifications` (7 keys, Firestore `profiles`) and `/pages/notifications` (8 keys, `localStorage`). A user toggling one sees nothing change in the other | `app/(public)/notifications/page.tsx:34-84` vs `app/(public)/pages/notifications/page.tsx:38-99` (`defaultPreferences` `:38`, `preferenceItems` `:49`); storage key at `:101` | Keep the profile-backed page, redirect `/pages/notifications` to it, delete the duplicate |
| M13-F08 | MEDIUM | Two device-settings stores plus a third page-local one: `deviceSettingsService` (Firestore `settings/device`), `localStorage["temple-device-settings"]`, and a page-local `DeviceSettings` interface that shadows the exported type | `lib/device/settings.ts:196` vs `app/(public)/pages/settings/page.tsx:30-42` vs `types/device.ts:235` | Single source: read defaults from `deviceSettingsService`, persist per-user overrides on the profile |
| M13-F09 | MEDIUM | `hooks/a11y/index.ts` declares eight React hooks that call `document`, `window.matchMedia` and `useState`, but has no `"use client"` directive. Importing it from a Server Component is a build error waiting to happen | `hooks/a11y/index.ts:1-6` (no directive) vs `:14`, `:88`, `:186`, `:220` | Add `"use client"` to the file |
| M13-F10 | MEDIUM | `deviceSettingsService.initialize()` is never called, so the Firestore `settings/device` document is never read and every admin-configurable value (temple location, share templates, navigation app, reminder offsets) silently falls back to hard-coded defaults | `lib/device/settings.ts:38` defines it; zero call sites repo-wide; `types/device.ts:265` holds the effective values | Call it from a client provider at layout level, or drop the Firestore path and keep the constants |
| M13-F11 | MEDIUM | `deviceSettingsService.update()` uses `updateDoc`, which throws if `settings/device` does not exist; the error is swallowed by a `console.warn`, so an admin save appears to succeed and is lost on reload | `lib/device/settings.ts:85-95` | Use `setDoc(..., { merge: true })` and surface the failure to the caller |
| M13-F12 | MEDIUM | Direct Firestore calls from `lib/` violate AGENTS.md ("No Direct Firebase Calls - Use services only"; services live in `/services/`) | `lib/device/settings.ts:45-53`, `:85-91`; rule at `AGENTS.md` §Architecture Principles | Move persistence into `services/device-settings.service.ts` and keep `lib/device` presentation-free |
| M13-F13 | MEDIUM | Three separate always-on timers: notification count polled every 1 s per mounted hook, permissions re-queried every 30 s, analytics queue flushed every 5 s and never cleared. On a page with three `useNotifications()` consumers that is 3 timers/second doing nothing | `lib/device/hooks/useNotifications.tsx:45`; `lib/device/permissions/index.ts:297` (started at `lib/device/hooks/usePermissions.ts:114`); `services/device-analytics.service.ts:35` | Replace polling with subscriptions (`useSyncExternalStore` is already imported and unused at `lib/device/hooks/useDevice.ts:8`); clear the analytics interval |
| M13-F14 | MEDIUM | `services/device-analytics.service.ts` collects eight event types and then throws them away - `processQueue()` splices the batch and only `console.log`s it in development. No endpoint, no store | `services/device-analytics.service.ts:186-206` | Either post to an endpoint (or Vercel Analytics, already a dependency) or delete the service |
| M13-F15 | MEDIUM | 825 translated strings (275 keys x en/kn/sa, Kannada 0% identical to English) are unreachable: zero `t("...")` call sites in `app/` or `components/`, and, by a rough JSX-text-node scan, on the order of a thousand literal English text nodes across the 361 `.tsx` files under `app/ components/ lib/ hooks/ context/` (the exact node count is a heuristic; the zero `t()` call sites is not). `docs/ARCHITECTURE.md:180` claims "Language Support - English, Kannada, mixed" | `lib/i18n/dictionaries/kn.json` (328 lines, 275 leaves, 0 identical to `en.json`; `sa.json` has 2 identical); `grep -rn 't("' app components` returns 0 and `grep -rn '= useTranslation()' app components` returns 0; `docs/ARCHITECTURE.md:180` | Either wire i18n up (R5) or state plainly in the docs that the UI is English-only and the AI layer is bilingual |
| M13-F16 | MEDIUM | `direction` is computed as `locale === "sa" ? "rtl" : "ltr"`, marking Sanskrit (Devanagari, left-to-right) as right-to-left, and contradicting `localeDirections.sa === "ltr"` in the same module | `lib/i18n/context.tsx:124` vs `lib/i18n/config.ts:30-34` | Read `localeDirections[locale]` |
| M13-F17 | MEDIUM | No PWA assets at all: no `manifest.json`/`app/manifest.ts`, no service worker, no offline page, no icon set (`public/icons/` holds only `.gitkeep`), no `robots.txt`, no `sitemap.xml`. Yet the module ships `usePWAInstall`, `isServiceWorkerSupported`, `pwaSupported`, `installPromptSupported` and an offline indicator | `find public app -iname "manifest*" -o -iname "sw.js"` empty; `ls public/icons` = `.gitkeep`; `lib/device/hooks/useDevice.ts:104`, `lib/device/capabilities/index.ts:86` | Ship a manifest + icons + service worker (R6), or remove the install/offline affordances |
| M13-F18 | MEDIUM | `app/layout.tsx:67` links `/favicon.ico` and `notificationsService.showTest()` uses `icon: "/favicon.ico"`, but the file does not exist in `public/` (only `favicon.svg`) - a 404 on every page and a missing notification icon | `app/layout.tsx:67`; `lib/device/notifications/index.ts:98`; `ls public/` shows `favicon.svg` only | Add `public/favicon.ico` or drop both references |
| M13-F19 | MEDIUM | `/qr` hard-codes `SITE_URL = "https://rayaramathaynk.vercel.app"` while the app's `metadataBase` is `https://www.srsmathaynk.com`. Printed QR codes point at a preview deployment | `app/(public)/qr/page.tsx:15` vs `app/layout.tsx:32` | Derive from `NEXT_PUBLIC_SITE_URL` or `metadataBase` |
| M13-F20 | MEDIUM | `locationService` keeps a single `watchId` on the singleton. Two components calling `useLocation({watchPosition:true})` overwrite each other's watch, and `clearWatch()` from one stops the other | `lib/device/location/index.ts:16` (`private watchId`), `:72-99` (`watchPosition` overwrites it), `:104-109` (`clearWatch` nulls it) | Return the watch id to the caller and clear it per-subscriber, or refcount |
| M13-F21 | MEDIUM | `app/(public)/qr/page.tsx:46` builds a print document with `document.write` and interpolates `data.title` / `data.description` unescaped. Safe today because both values are local constants, but it is a stored-XSS sink the moment those come from Firestore | `app/(public)/qr/page.tsx:38-75` | Build the print DOM with `createElement`/`textContent`, or use a print stylesheet instead of a popup |
| M13-F22 | LOW | `any` used in four places, against AGENTS.md "No `any` type - use `unknown`" | `lib/device/qr/scanner.ts:10` (`type Html5QrcodeConstructor = any`), `lib/i18n/context.tsx:27` (`obj: any`), `hooks/a11y/index.ts:261` (`items: any[]`), `app/(public)/notifications/page.tsx:100` (`useState<any[]>`) | Type them: `unknown` + narrowing, `ScheduledNotification[]`, a generic `<T,>` for roving tabindex |
| M13-F23 | LOW | Two parallel action registries under near-identical specifiers - `lib/device/actions.ts` (class + `deviceActionRegistry`, 14 declared AI action types) and `lib/device/actions/index.ts` (hook + `useActionRegistry`, 16 executor functions). `lib/device/index.ts` re-exports both, resolving one by file and one by directory | `lib/device/index.ts:40-42`; `lib/device/actions.ts:41`; `lib/device/actions/index.ts:78` | Keep one. The hook version is the only one with a (dead) consumer; the class version is the one Raya AI was meant to call |
| M13-F24 | LOW | `shareService.share()` returns `false` even after the clipboard fallback succeeded and `onCopySuccess` fired, so callers report failure on a successful share | `lib/device/share/index.ts:100-116` | Return `true` when the fallback copy succeeds (`useShare` at `lib/device/hooks/useShare.ts:55-65` already does this correctly - the service and the hook disagree) |
| M13-F25 | LOW | `generateAppleCalendarUrl` computes `startDate`/`endDate` and never uses them, and creates an object URL that is never revoked | `lib/device/calendar/index.ts:29-36` | Delete the dead lines; revoke the URL, or call `downloadICS` which already does |
| M13-F26 | LOW | ICS output stamps every time as UTC. **The trailing `Z` is preserved** (`toISOString()` -> strip `-`, `:` and `.mmm` leaves `20260919T103000Z`), so a *timed* event is correct in any client - an earlier reading that IST events land 5h30 early is wrong. The real gap is that there is no all-day handling at all: `generateICS` always emits `DTSTART:<utc>`/`DTEND:<utc>` and never `DTSTART;VALUE=DATE:`, so an all-day Aaradhane becomes a timed event offset by the UTC delta; there is also no `VTIMEZONE`/`TZID`, which rules out recurring or floating-time entries later | `lib/device/calendar/index.ts:201-203` (`formatDateForICS` keeps the `Z`), `:67-84` (`DTSTART`/`DTEND` unconditional, no `VALUE=DATE`) | Add an `allDay` branch emitting `DTSTART;VALUE=DATE:YYYYMMDD`; keep UTC for timed events |
| M13-F27 | LOW | `qrScanner.switchCamera()` restarts the scanner into the hard-coded element id `"qr-reader"`, ignoring the `elementId` the caller started with, so switching cameras inside `CompactQRScanner` (`elementId="qr-compact"`) targets a node that does not exist | `lib/device/qr/scanner.ts:249` (`switchCamera`), `:266` (`await this.start("qr-reader", ...)`) vs `lib/device/hooks/useQRScanner.ts:55` (default `elementId`) / `:174` (honours the caller's id) and `components/device/QRScanner.tsx:310` (`elementId = "qr-compact"`) | Store the element id on the service at `start()` and reuse it |
| M13-F28 | LOW | `useQRCodeGenerator(data, size)` lists the object `data` in its effect deps; callers passing an inline object literal regenerate the QR code on every render | `lib/device/qr/QRCode.tsx:124` (`}, [data, size]`) | Depend on `data.type`/`data.id`, as `useURLQRCodeGenerator` already does at `:461` (`}, [data.url, size]`) |
| M13-F29 | LOW | `getLocaleFromPath` assumes a `/[locale]/...` route structure, but no `app/[locale]` segment exists; the function is dead and misleading | `lib/i18n/config.ts:94-103`; no `app/[locale]` directory | Delete it, or implement locale routing |
| M13-F30 | LOW | Duplicate assets and starter cruft in `public/`: `Naveen-testimonial.png` exists in three directories, `raghavendra_swamy` in both `.jpg` and `.png`, and `next.svg` / `file.svg` / `window.svg` / `globe.svg` are unmodified Next.js starter files. `postman_collection.json` (34 KB) is publicly served | `public/images/gallery/`, `public/images/testimonials/`, `public/testimonials/`; `public/*.svg`; `public/postman_collection.json` | Delete the starter SVGs and duplicates; move the Postman collection out of the web root |
| M13-F31 | LOW | Reduced-motion logic implemented twice: `hooks/useReducedMotion.ts` and, independently, inside `components/common/A11yProvider.tsx` | `hooks/useReducedMotion.ts:12-33` vs `components/common/A11yProvider.tsx:22-34` | Have `A11yProvider` consume `useReducedMotion` |
| M13-F32 | LOW | Six of the eight accessibility hooks (`useFocusTrap`, `useKeyboardNavigation`, `useAnnounce`, `useSkipLink`, `useRovingTabIndex`, `useAccessibleColors`) have no consumer, while the app has custom dropdowns and dialogs that would need exactly them | `hooks/a11y/index.ts`; only `useHighContrast` and `useKeyboardNavigationMode` imported (`components/common/A11yProvider.tsx:4`) | Wire `useFocusTrap` into the dialog components, or remove the unused hooks |
| M13-F33 | LOW | No tests anywhere in this chunk - no unit test for the Haversine maths, the ICS escaping, the QR payload parser or the dictionary loader, against AGENTS.md's "Tested" definition of done | no file under `tests/` references `lib/device` or `lib/i18n`. The one adjacent test is `tests/kannada-font-validation.spec.ts`, which checks rendered font stacks, not this code | Start with the pure functions: `calculateDistance`, `escapeICSText`, `generateShareText`, `getNestedValue`, `parseQRData` |
| M13-F34 | LOW | Unescaped entity in JSX (`doesn't`) will fail `react/no-unescaped-entities` under `npm run lint` | `app/(public)/notifications/page.tsx:183` | Use `&apos;` |
| M13-F35 | LOW | Browser notifications have no click handler, so tapping one does nothing - it cannot deep-link to the event or seva it announces | `lib/device/notifications/index.ts:64-89` creates the `Notification` and never assigns `onclick` | Assign `notification.onclick` to focus the window and route to `data.url` |
| M13-F36 | MEDIUM | The `/notifications` info panel makes three promises that nothing in the repository keeps: "Email notifications are sent regardless of browser permissions", "Festival reminders are sent 7 days before the event" and "Event reminders are sent 30 minutes before start time". There is no reminder scheduler beyond the in-memory `setTimeout`, no cron or API route under `app/api/` that sends reminders, and the only email sender in the repo is a donation-receipt function | `app/(public)/notifications/page.tsx:357-372`; the only scheduler is `lib/device/notifications/index.ts:119` (`setTimeout`); `ls app/api` has no reminder/cron route; `lib/services/email.ts:5` is `sendEmail(receipt: Receipt)` only | Delete the three claims until a server-side scheduler and a reminder email template exist |
| M13-F37 | LOW | `lib/device/actions.ts` declares 14 `DeviceActionType` values but registers handlers for only 11. `share_quote`, `notify_seva` and `share_daily_panchanga` are dispatchable names with no handler, so `execute()` on them fails at runtime rather than at compile time | `lib/device/actions.ts:9-23` (14 union members) vs the 11 `this.register(...)` calls at `:110`, `:125`, `:141`, `:168`, `:189`, `:221`, `:249`, `:275`, `:300`, `:318`, `:345` | Register the three missing handlers or drop them from the union |
| M13-F38 | LOW | `useShareContent` sets `isSharing` in three code paths but neither `UseShareContentReturn` nor the returned object exposes it, so a consumer of the templated share hook has no way to show a spinner - unlike `useShare`, which does return it | `lib/device/hooks/useShare.ts:139` (state), `:165`, `:178`, `:186` (writes), `:118-131` (interface) and `:189-202` (return) omit it; contrast `lib/device/hooks/useShare.ts:92` | Add `isSharing` to the interface and the return object |

## Portability notes (React Native / cross-platform)

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| `types/device.ts` | none | **reuse as-is** | Pure TypeScript; the natural contract between a web and a native client |
| `lib/device/location/index.ts` distance/ETA/format maths | none | **reuse as-is** | `calculateDistance`, `formatDistance`, `calculateETA`, `formatETA` are pure |
| `lib/device/calendar/index.ts` ICS string builder | `Blob`, `URL.createObjectURL`, `document.createElement` for download | **adapt** | `generateICS` and `escapeICSText` are pure and portable; the download path becomes `expo-file-system` + `Sharing.shareAsync`, and add-to-calendar becomes `expo-calendar` (which writes directly, no URL scheme needed) |
| `lib/device/share/index.ts` | `navigator.share`, `navigator.clipboard`, `document.execCommand`, `window.open` | **rewrite** | RN: `Share.share()` from `react-native`, `expo-clipboard`, `Linking.openURL` for provider intents. `generateShareText` is pure and reusable |
| `lib/device/capabilities/index.ts` | `navigator.userAgent`, `navigator.vendor`, `window.screen`, `"x" in navigator` | **rewrite** | RN has `Platform.OS`, `Device.deviceType` (expo-device); UA sniffing has no meaning. Keep the `Capabilities` shape, replace every detector |
| `lib/device/permissions/index.ts` | `navigator.permissions`, `getUserMedia`, `Notification.requestPermission` | **rewrite** | RN uses per-module permission APIs (`expo-camera`, `expo-location`, `expo-notifications`) plus `PermissionsAndroid`. The `PermissionType`/`PermissionState` vocabulary and `getPermissionInfo` copy survive |
| `lib/device/notifications/index.ts` | `Notification` constructor, `setTimeout` scheduling | **rewrite** | `expo-notifications` schedules OS-level notifications that survive app termination - strictly better than the current in-memory scheme, and it is the piece a native app is most worth building for |
| `lib/device/qr/scanner.ts` | CDN `<script>`, `document`, `window.Html5Qrcode` | **rewrite** | `expo-camera`'s `onBarcodeScanned` or `react-native-vision-camera`. Drop the CDN entirely |
| `lib/device/qr/QRCode.tsx` generation | `qrcode` npm -> data URL, `<img>`, `<a download>` | **adapt** | `react-native-qrcode-svg` renders the same payloads; `generateQRId`, `createQRPayload` and the `parseQRData` logic are pure and reusable |
| `lib/device/settings.ts` | dynamic `import("firebase/firestore")` | **adapt** | The subscribe/notify singleton is platform-neutral; swap the Firestore client and give it an `AsyncStorage` cache |
| `lib/device/hooks/*.ts(x)` | `"use client"`, `window`/`navigator` inside effects | **adapt** | The hook *signatures* (`useShare`, `useLocation`, `useNotifications`, `usePermission`, `useQRScanner`, `useCalendar`) are the right cross-platform seam. Keep them; re-point each to a native service. `useBattery`, `useConnection`, `useOrientation`, `usePWAInstall`, `useOnlineStatus` map to `expo-battery`, `@react-native-community/netinfo`, `expo-screen-orientation`, and nothing (no install prompt on a store app) |
| `components/device/*.tsx` (11 files) | Tailwind `className`, `lucide-react`, shadcn `Dialog`/`Card`/`Switch`, `@/components/ui/*` | **rewrite** | No DOM, no Tailwind classes, no shadcn in RN. Since all eleven are already unused, deleting them is cheaper than porting them |
| `lib/device/qr/QRCode.tsx` display components | `<img>`, `<div>`, Tailwind | **rewrite** | Same reason |
| `lib/i18n/config.ts`, `dictionaries.ts`, `dictionaries/*.json` | none (dynamic `import()` of JSON works in Metro) | **reuse as-is** | The strongest asset in this chunk for a native client: 275 keys x 3 locales, ready to share |
| `lib/i18n/context.tsx` | `localStorage`, `document.documentElement.lang` | **adapt** | Replace `localStorage` with `AsyncStorage`/`expo-secure-store`, drop the `document` line, seed the default from `expo-localization`. `getNestedValue`/`interpolate` are pure |
| `hooks/useReducedMotion.ts` | `window.matchMedia` | **adapt** | RN: `AccessibilityInfo.isReduceMotionEnabled()` + its change event. Same boolean contract |
| `hooks/a11y/index.ts` | `document.querySelectorAll`, `document.activeElement`, `document.createElement`, `matchMedia`, Tab-key semantics | **rewrite** | Focus traps, roving tabindex and skip links are DOM concepts. RN equivalents: `AccessibilityInfo.announceForAccessibility`, `accessibilityRole`/`accessibilityLabel`, `accessibilityViewIsModal` |
| `services/device-analytics.service.ts` | none (only `window` guard) | **reuse as-is** | Pure queue; it just needs a destination |
| `services/ux.service.ts` | none | **reuse as-is** | Pure data keyed by `Intent`, already bilingual; a native chat UI can use it verbatim |
| `app/(public)/qr/page.tsx`, `/notifications`, `/pages/notifications` | `next/link`, App Router, Tailwind, `document.write`, `window.open`, `localStorage` | **rewrite** | Screens are per-platform. The preference *schema* and the notification-type lists should move to shared constants first |
| `public/*` | Next static serving, `/`-rooted URLs | **adapt** | Images become bundled assets or remote URLs; `public/icons/` would finally need to be populated for app icons and splash screens |

**What a React Native client would need from this module.** Three things, in order. First, the shared
contract: `types/device.ts` and `lib/i18n/` should be lifted into a platform-neutral package that both the
web app and the RN app depend on - they are already free of DOM types. Second, a real API for anything
that must outlive a session: notification subscriptions, device settings and analytics currently have no
server endpoint at all, so a native client would have nothing to talk to. Adding
`services/device-settings.service.ts` and a push-subscription endpoint benefits the web app too (M13-F03,
M13-F10, M13-F14). Third, keep the hook layer as the seam: `useShare`, `useLocation`, `useNotifications`,
`useCalendar`, `useQRScanner` and `usePermission` already hide their implementations behind stable
signatures, so an RN build can supply `lib/device/*.native.ts` implementations and reuse every consumer
component's logic unchanged.

The honest summary is that this chunk is the *easiest* part of the portal to move, because so little of it
is actually wired in. The pure logic (distance, ICS, share templates, QR payloads, 825 translated strings)
ports for free; the browser API wrappers are thin enough to swap for Expo modules one file at a time; and
the 2,829 lines of unused Tailwind widgets - the only genuinely unportable part - can be deleted rather
than ported. A native client would also *fix* the module's two worst faults for free: OS-level scheduled
notifications replace the doomed `setTimeout` scheduler, and native camera/location permissions replace the
CSP- and Permissions-Policy-blocked web paths.

## Coverage

filesExpected 114, filesMentioned 114, omitted: none.

- 46 source files: every one has a row in **Key files** and appears in at least one flow, tree or fault row.
- 68 files under `public/`: covered by the grouped table in **Key files** (per the brief's allowance to
  group trivially similar files). Individual images were counted and classified by extension and directory,
  never opened, per RULES.md.

## UNCLEAR

- **UNCLEAR: whether `app/(public)/pages/` is a live route group or abandoned scaffolding.** Both
  `/pages/notifications` and `/pages/settings` exist under it and duplicate pages elsewhere
  (`/notifications`, and profile preferences). Nothing in `components/layout/Navbar.tsx` appears to link to
  them. Settling it: check the production sitemap or analytics for traffic to `/pages/*`, or ask the owner
  whether `/pages/*` was an early draft.
- **UNCLEAR: whether the `Permissions-Policy` in `next.config.ts:29` is deliberate hardening or an
  oversight.** If deliberate, roughly a third of this module (QR scanning, geolocation, distance-to-temple,
  directions-from-here) is intentionally disabled and should be deleted; if an oversight, it is a one-line
  fix. Settling it: ask whoever added the security headers.
- **UNCLEAR: which notification-preference schema is authoritative.** `/notifications` uses 7 keys
  (`dailyPanchanga, dailyQuote, events, festivals, aaradhane, liveStream, announcements`);
  `/pages/notifications` uses 8 (`dailyPanchanga, dailyQuote, upcomingEvents, festivals, aaradhane,
  sevaReminders, donationReceipts, announcements`). Settling it: read the `profiles` document shape in
  `types/profile.ts` / `services/profile.service.ts` [M02] and treat that as truth.
- **UNCLEAR: whether the Firestore `settings/device` document exists at all.** `initialize()` is never
  called, so nothing in the running app would have created it, and the write path uses `updateDoc`, which
  requires it to pre-exist. Settling it: inspect the Firestore console or a `firestore:dump` MANIFEST for a
  `settings/device` doc.
- **UNCLEAR: whether the Sanskrit (`sa`) locale is a real product requirement.** It has a complete 275-key
  dictionary but `docs/ARCHITECTURE.md:180` names only "English, Kannada, mixed". Settling it: ask the
  content owner before either finishing or deleting `sa`.

## Verification log (2026-09-19)

Skeptic pass over this brain file: 201 distinct `path` / `path:line` citations extracted and checked by
script, 34 factual claims re-opened against the code, all 35 original findings re-tested, and the 114-file
inventory diffed against the file. Every path in the file exists except the seven cited **as absent or
as files to create** (`app/manifest.ts`, `public/manifest.json`, `public/sw.js`, `public/favicon.ico`,
`lib/device/vibration/index.ts`, `lib/device/hooks/useVibration.ts`, `services/device-settings.service.ts`).
No line number now points outside its file.

Line-reference drift (symbol was right, line was stale):

- `isShareSupported` capabilities/index.ts:92 -> :98 -> grep `^export function isShareSupported` = 98
- `isInstallPromptSupported` "line ~155" -> :163 -> :155 is `isOfflineSupported`; `return true` at :166
- `shareNative` share/index.ts:15 -> :20; `copyToClipboard` :79 -> :77; `shareVia` :36-74 -> :40-75
- `share()` returns false "line ~113" -> :116
- `requestPermission("location")` permissions/index.ts:141 -> :125 (fn) / :144-160 (location branch)
- `getUserMedia` permissions/index.ts:129 -> :140; `getPermissionManager` :334 -> :326; `queryPermission` :86 -> :87
- `usePermission` usePermissions.ts:22 -> :26; `useNotificationPermission` :136 -> :140
- `useLocation` / `useQRScanner` entry lines :49 -> :51 (`useQRScanner`)
- `calculateDistance` location/index.ts:110 -> :114; `calculateETA` :147 -> :148; `openNavigation` :193 -> :198
- `GeolocationPosition` mapping location/index.ts:238 -> :251 (`positionToLocationPosition`); :238 is `getDirectionsUrl`
- `watchId` location/index.ts:17 -> :16; `watchPosition` :68-98 -> :72-99; `clearWatch` :101-107 -> :104-109
- `scheduleEventReminder` notifications/index.ts:131 -> :139; `schedule()` :103 -> :106; `show()` :62 -> :64
- `showForType` "line ~205" -> :236
- `createQRPayload` QRCode.tsx:76 -> :80; `parseQRData` :322 -> :323
- `useQRCodeGenerator` deps QRCode.tsx:115 -> :124; `useURLQRCodeGenerator` deps :456 -> :461, entry :434 -> :433
- `switchCamera` scanner.ts:246 -> :249, and the hard-coded `"qr-reader"` it restarts into is at :266
- `useActionRegistry` actions/index.ts:75 -> :78
- `useLocale` i18n/context.tsx:161 -> :158; `getLocaleFromPath` config.ts:90-99 -> :94-103
- `QRPage` qr/page.tsx:141 -> :145; `useShare` hook useShare.ts:30 -> :29
- `NotificationPreferencesPage` pages/notifications:97 -> :103; `preferenceItems` :44 -> :49;
  `STORAGE_KEY` :94 -> :101; `handleSave` "line 132" -> :143 (localStorage) and :151 (reminder)
- `NOTIFICATION_TYPES` notifications/page.tsx:33 -> :34

Counts corrected:

- "11 presentational components in `components/device/`" -> **9** widgets in **10** files ->
  `ls components/device` = 9 `.tsx` + `index.ts`
- "components/device 2,829 lines" -> **2,629** -> per-file sum; the chunk total 11,845 was already right,
  so the 2,829 was a typo, not a miscount
- "lib/device 5,220 lines" -> **5,217** -> per-file sum over the 21 files
- "`lib/device/index.ts` re-exports 9 client component modules" -> **8**; `FloatingActionBar` is exported
  only from `components/device/index.ts` -> `lib/device/index.ts:90-136` lists 8 component modules
- "`actions.ts` 12 AI action types" -> **14 declared, 11 registered** -> `lib/device/actions.ts:9-23` vs
  11 `this.register(` calls
- "`actions/index.ts` 7 action types" -> **16 executors** -> `UseActionRegistryReturn`, :58-75
- "F05 ~3,900 dead lines" -> **~3,500** -> 2,629 + 409 + 232 + ~230
- `public/` per-directory table rebuilt: images root 9 -> 10, committee 13 -> 14, temple 7 -> 8,
  aaradhane 3 -> 4, logos 2 -> 3, the four testimonial/avatar dirs split into rows, empty placeholder dirs
  11 -> 8. The old rows summed to 63, not 68; the new rows sum to 68. The by-extension line was already
  correct (21 png / 17 jpg / 6 svg / 2 json / 1 pdf / 21 extension-less = 68)
- "174 of 355 `.tsx` files" -> the repo has **361** `.tsx` files under `app components lib hooks context`;
  the literal-text-node figure is flagged as a heuristic. The load-bearing half (0 `t(` and 0
  `useTranslation()` call sites) was re-run and confirmed

Claims refuted and rewritten:

- **Flow D step 3** said `qrScanner.start()` requests camera permission. It does not - `lib/device/qr/scanner.ts`
  never touches the permission API (no `getUserMedia`, no `requestPermission` in the file). The request is made
  by the hook at `lib/device/hooks/useQRScanner.ts:141-157` via `useCameraPermission().request()`. Rewritten.
- **Flow B step 3** credited `lib/device/location/index.ts:238` with the `GeolocationPosition` mapping; :238 is
  `getDirectionsUrl`. The mapping is `positionToLocationPosition` at :251. Rewritten.
- **M13-F26** claimed IST events land 5h30 early. Refuted: `formatDateForICS` (`lib/device/calendar/index.ts:201-203`)
  strips only `-`, `:` and `.mmm` from `toISOString()`, so the trailing `Z` survives and `DTSTART:20260919T103000Z`
  is a valid UTC stamp that every client converts correctly. The finding was rewritten around the defect that
  *is* real: no all-day (`VALUE=DATE`) branch, so an all-day Aaradhane becomes a timed event. Kept at LOW.
- **Component tree 4** said all the widgets are re-exported from `lib/device/index.ts`. `FloatingActionBar` is not.
  Corrected, which also matters for M13-F06's bundle argument.

Findings added:

- **M13-F36** (MEDIUM) - `/notifications` promises email notifications, 7-day festival reminders and 30-minute
  event reminders; none exists. `app/(public)/notifications/page.tsx:357-372`; no reminder route under
  `app/api/`; `lib/services/email.ts:5` sends donation receipts only.
- **M13-F37** (LOW) - `DeviceActionType` declares 14 values, 11 are registered; `share_quote`, `notify_seva`,
  `share_daily_panchanga` have no handler. `lib/device/actions.ts:9-23` vs the 11 `this.register(` calls.
- **M13-F38** (LOW) - `useShareContent` sets `isSharing` three times and never returns it.
  `lib/device/hooks/useShare.ts:139`, `:165`, `:178`, `:186` vs `:118-131` and `:189-202`.

Coverage additions:

- `public/data/panchanga/current.json` was listed as a static asset. It is live data written by
  `.github/workflows/panchanga.yml:43` and fetched at runtime by `components/home/Panchanga.tsx:70` and
  `app/(public)/display/page.tsx:121`. Row annotated.
- The Kannada-font focus question was answered only as "apply `.font-kannada`". Added the loading path:
  `next/font`'s `Noto_Sans_Kannada` at `app/layout.tsx:24-27` -> `--font-kannada` -> `app/globals.css:4`,
  `:14`, `:19`, `:26`, `:44`, `:54`, `:61`, and the existing `tests/kannada-font-validation.spec.ts`.
- "What actually consumes this module today" omitted the three routes in this chunk that import it.
  Added, including that `app/(public)/notifications/page.tsx:7` imports `useNotifications` directly from
  `lib/device/hooks/useNotifications` rather than through the barrel.
- The 67 inventory files the brain never names literally are all `public/` binaries covered by the grouped
  table; no source file in `.claude/state/inventory/M13.json` is unmentioned.

Confirmed unchanged (spot-checked, no edit needed): M13-F01 (`next.config.ts:29-30` verbatim),
M13-F02 (`app/layout.tsx:83-88` has A11yProvider/AuthProvider/ProfileProvider/AIChatProvider and no
`I18nProvider`; no `error.tsx` anywhere in `app/`, so the throw is not caught), M13-F03, M13-F04,
M13-F09, M13-F10, M13-F11, M13-F13, M13-F14, M13-F16, M13-F17, M13-F18, M13-F19, M13-F21, M13-F22,
M13-F24, M13-F25, M13-F30, M13-F31, M13-F32, M13-F34, M13-F35, and the dictionary arithmetic
(275 leaves x 3, 25 sections, kn 0 identical, sa 2 identical) which re-ran exactly.
