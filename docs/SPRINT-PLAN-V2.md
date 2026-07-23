# Temple Platform v2.0 - Sprint Plan

**Project:** Sri Raghavendra Swamy Matha Website (Rayaramathaynk)
**Version:** 2.0
**Last Updated:** 2026-07-23

---

## Overview

This document outlines the comprehensive sprint plan for transforming the existing website into a comprehensive digital platform for devotees while preserving the current architecture.

### Sprint Structure

| Sprint | Focus | Modules | Branch |
|--------|-------|---------|--------|
| Sprint 1 | Foundation | Multi-language, Devotee Profile, Accessibility, Performance | sprint-1-foundation |
| Sprint 2 | User Engagement | Favorites, Notification Center, Homepage Personalization | sprint-2-user-engagement |
| Sprint 3 | Content & Media | Library, Stotras, Quotes, Learning, Timeline, Media, Live | sprint-3-content-media |
| Sprint 4 | Intelligence | AI Knowledge, AI Actions, Global Search | sprint-4-intelligence |
| Sprint 5 | Deployment | Digital Signage, Admin, Documentation | sprint-5-deployment |

---

## Sprint 1: Foundation

### Module 14 — Multi-language Framework

Prepare for multi-language support with English, Kannada, and Sanskrit.

**Features:**
- Translation Provider (i18n infrastructure)
- Language Switcher (UI component)
- Locale Routing (/en/, /kn/, /sa/)
- Content Localization (translations stored in Firestore)
- Date/time formatting per locale

**Files to Create:**
```
lib/i18n/
├── index.ts                    # Main export
├── provider.tsx                # TranslationProvider component
├── context.tsx                 # I18nContext
├── config.ts                   # Supported locales, default config
├── useTranslation.ts           # Hook for translations
├── useLocale.ts                # Hook for current locale
├── useDirection.ts             # Hook for RTL/LTR
├── i18n-dictionaries.ts        # Dictionary types
└── dictionaries/
    ├── en.json                 # English translations
    ├── kn.json                 # Kannada translations
    └── sa.json                 # Sanskrit translations

components/common/
├── LanguageSwitcher.tsx        # Language selector UI
└── LocaleProvider.tsx          # Client-side locale context

hooks/
├── usePreferredLanguage.ts      # Detect user's preferred language
└── useDateFormatter.ts         # Format dates per locale
```

**Firestore Collections:**
```
translations/
├── {locale}/
│   └── {namespace}/
│       └── {key}: string
```

**Integration Points:**
- `app/layout.tsx` - Add LocaleProvider
- `next.config.ts` - Configure i18n routing
- Navigation components - Add language switcher

---

### Module 1 — Devotee Profile

Implement optional devotee profile with personalized experience.

**Features:**
- Google Login (OAuth)
- Email Login (existing Firebase Auth)
- Profile Photo (Firebase Storage)
- Name and Contact Info
- Preferred Language selection
- Timezone selection
- Notification Preferences
- Theme Preference (light/dark/system)
- Device Preferences

**Routes to Create:**
```
app/(public)/
├── profile/
│   ├── page.tsx                # Profile overview
│   ├── settings/
│   │   └── page.tsx            # Account settings
│   └── preferences/
│       └── page.tsx            # User preferences
```

**Files to Create:**
```
types/
├── profile.ts                   # Profile types

services/
├── profile.service.ts           # Profile CRUD operations

context/
├── ProfileContext.tsx           # User preferences context

components/
├── profile/
│   ├── ProfileCard.tsx          # Profile display
│   ├── ProfileEditForm.tsx      # Edit profile form
│   ├── ProfileAvatar.tsx        # Avatar with upload
│   ├── PreferencesForm.tsx      # Preferences settings
│   ├── LanguagePreference.tsx   # Language selector
│   ├── TimezoneSelector.tsx     # Timezone dropdown
│   ├── ThemeToggle.tsx          # Theme switcher
│   └── NotificationSettings.tsx  # Notification preferences

app/(auth)/
├── login/
│   └── page.tsx                 # Enhanced login with Google option
```

**Firestore Collections:**
```
users/
├── {userId}/
│   ├── preferences: {
│   │   language: "en" | "kn" | "sa"
│   │   timezone: string
│   │   theme: "light" | "dark" | "system"
│   │   notifications: {
│   │   │   email: boolean
│   │   │   push: boolean
│   │   │   dailyPanchanga: boolean
│   │   │   dailyQuote: boolean
│   │   │   events: boolean
│   │   │   festivals: boolean
│   │   │   liveStream: boolean
│   │   │   }
│   │   }
│   └── recentViews: string[]     # Content IDs
```

---

### Module 17 — Accessibility

Improve accessibility across the site.

**Features:**
- Keyboard Navigation (Tab, Arrow keys, Enter)
- Screen Reader Labels (aria-label, aria-describedby)
- High Contrast Support (prefers-contrast media query)
- Focus Indicators (visible focus rings)
- Reduced Motion Support (prefers-reduced-motion)
- ARIA Labels (landmarks, live regions)
- Semantic HTML (proper heading hierarchy)

**Files to Create/Modify:**
```
hooks/
├── useAccessibility.ts          # Accessibility utilities
└── useFocusManagement.ts        # Focus trap/manage

components/common/
├── A11yProvider.tsx             # Accessibility context
├── SkipLink.tsx                 # Skip to content link
├── VisuallyHidden.tsx           # Screen reader only text
├── FocusTrap.tsx                # Trap focus in modals
├── LiveRegion.tsx               # ARIA live announcements
└── KeyboardShortcuts.tsx        # Keyboard shortcut help

styles/
└── a11y.css                    # High contrast, focus styles
```

**Modifications:**
- `components/layout/Navbar.tsx` - Add keyboard nav, aria labels
- `components/layout/Footer.tsx` - Semantic structure
- All form components - Add proper labels
- All buttons - Add aria-label where needed
- Modal components - Focus trap implementation

---

### Module 18 — Performance

Optimize for fast loading and smooth interactions.

**Features:**
- Image Optimization (next/image, WebP, lazy loading)
- Video Loading (lazy, poster, placeholder)
- Dynamic Imports (code splitting)
- Caching Strategy (ISR, client cache)
- Search Index Optimization
- Lazy Components (Suspense boundaries)
- Virtual Lists (for large data)

**Files to Create:**
```
lib/
├── optimize/
│   ├── images.ts               # Image optimization utils
│   ├── video.ts                # Video lazy loading
│   └── prefetch.ts             # Link prefetching

components/common/
├── LazyLoad.tsx                # Lazy loading wrapper
├── VirtualList.tsx             # Virtualized list
├── ImageWithBlur.tsx           # Blur-up image loading
├── SkeletonLoader.tsx          # Loading placeholders
└── OptimizedVideo.tsx          # Lazy video player

hooks/
├── useIntersectionObserver.ts  # Lazy loading trigger
├── useVirtualScroll.ts         # Virtual scroll logic
└── usePrefetch.ts             # Prefetch links on hover
```

**Modifications:**
- `next.config.ts` - Image optimization config
- `app/layout.tsx` - Add prefetch hints
- Gallery components - Virtual scrolling
- Event lists - Lazy loading
- Quote display - Optimized images

---

## Sprint 2: User Engagement

### Module 2 — Favorites
### Module 3 — Notification Center
### Module 16 — Homepage Personalization

---

## Sprint 3: Content & Media

### Module 4 — Digital Library
### Module 5 — Stotra Library
### Module 6 — Daily Quote Enhancement
### Module 7 — Learning Center
### Module 8 — Live Darshan
### Module 9 — Media Center
### Module 10 — Temple Timeline

---

## Sprint 4: Intelligence

### Module 11 — AI Knowledge Platform
### Module 12 — AI Actions
### Module 13 — Search Everywhere

---

## Sprint 5: Deployment

### Module 15 — Digital Signage
### Module 19 — Admin Enhancements
### Module 20 — Documentation

---

## Implementation Dependencies

```
Sprint 1 (Foundation)
├── Multi-language framework (core infrastructure)
├── Devotee Profile (user preferences)
├── Accessibility (base improvements)
└── Performance (optimization layer)
    │
    ▼
Sprint 2 (User Engagement)
├── Favorites (requires Profile)
├── Notification Center (requires Device Platform)
└── Homepage Personalization (requires Profile & Favorites)
    │
    ▼
Sprint 3 (Content & Media)
├── All content modules (use foundation)
└── Timeline (uses Accessibility)
    │
    ▼
Sprint 4 (Intelligence)
├── AI Knowledge (requires Library, Quotes, etc.)
├── AI Actions (requires Device Platform)
└── Global Search (uses all content)
    │
    ▼
Sprint 5 (Deployment)
├── Digital Signage (standalone)
├── Admin Enhancements (manages all content)
└── Documentation (complete)
```

---

## Testing Strategy

### Unit Tests
- Services: Profile, Favorites, Notification services
- Hooks: useTranslation, useDevice, useAccessibility
- Utils: Date formatting, locale detection

### Integration Tests
- Authentication flow (Google, Email)
- Profile CRUD operations
- Language switching persistence
- Notification subscription

### E2E Tests
- Complete signup/login flow
- Profile update workflow
- Language change persistence
- Accessibility audit (axe-core)

### Performance Tests
- Lighthouse scores (target: 90+)
- Core Web Vitals (LCP < 2.5s)
- Bundle size monitoring

---

## Success Metrics

### Sprint 1
- [ ] Multi-language: Language switcher functional, translations load correctly
- [ ] Profile: Login, profile view, preferences save
- [ ] Accessibility: WCAG 2.1 AA compliance
- [ ] Performance: Lighthouse score 90+

### Sprint 2
- [ ] Favorites: CRUD operations, cross-device sync
- [ ] Notifications: Push subscription, scheduled notifications
- [ ] Personalization: Homepage adapts to user preferences

### Sprint 3
- [ ] Library: Searchable, categorized content
- [ ] Stotras: Multi-format support (text, audio, PDF)
- [ ] Media: Video player, audio streaming

### Sprint 4
- [ ] AI: Knowledge retrieval from all content
- [ ] Actions: Executeable via AI chat
- [ ] Search: Real-time results across all content

### Sprint 5
- [ ] Digital Signage: TV-optimized display
- [ ] Admin: Full content management
- [ ] Documentation: Complete API and architecture docs

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Firebase Auth complexity | Medium | Use existing auth patterns |
| Translation maintenance | High | Automate extraction, use namespaces |
| Performance budget | Medium | Monitor bundle size, lazy load |
| Accessibility edge cases | Medium | Test with screen readers |
| AI hallucination | High | Retrieval-first, citations required |

---

## Non-Goals

The following are explicitly **NOT** in scope:

- ERP systems
- Inventory management
- Accounting modules
- Purchase orders
- Salary management
- Queue management
- Advanced Seva booking
- Donation processing
- Internal staff management
- Temple operations automation

---

*Document maintained by: Development Team*
