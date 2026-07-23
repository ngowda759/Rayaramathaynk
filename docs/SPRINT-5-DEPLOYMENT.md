# Sprint 5: Deployment Documentation

## Overview

Sprint 5 adds digital signage capabilities, admin enhancements, and comprehensive documentation for the Temple Platform v2.0.

## New Routes

### Public Routes

| Route | Description |
|-------|-------------|
| `/display` | Digital signage display optimized for TV screens |

### Admin Routes

| Route | Description |
|-------|-------------|
| `/admin/library` | Manage digital library content |
| `/admin/stotras` | Manage stotra library |
| `/admin/media` | Manage videos, audio, and documents |

## Module 15: Digital Signage

### Features
- TV-optimized fullscreen display
- Today's Panchanga (Tithi, Nakshatra, Yoga, Karana)
- Temple timings with current activity highlight
- Upcoming events display
- Daily quote with meaning
- Announcements section
- Gallery slideshow (10-second intervals)
- Live clock with date
- Fullscreen mode toggle
- Auto-refresh (5 minutes)

### Technical Details
```tsx
// /app/(public)/display/page.tsx
// Client-side rendering for live updates
// Auto-refresh via setInterval
// Fullscreen API for TV displays
```

### Usage
1. Navigate to `/display` on a TV or kiosk
2. Click "Fullscreen" for fullscreen mode
3. Toggle "Auto-refresh" as needed

## Module 19: Admin Enhancements

### Library Management (`/admin/library`)
- CRUD operations for library content
- Content types: Articles, Books, PDF, Audio, Video, Images
- Category filtering
- Search functionality
- View count tracking
- Status management (draft/published)

### Stotra Management (`/admin/stotras`)
- Manage stotra collection
- Support for Kannada, Sanskrit, English
- Audio and PDF attachments
- Popular flag for featured stotras
- Category organization

### Media Management (`/admin/media`)
- Upload and manage media files
- Support for videos, audio, documents
- Folder organization
- Grid and table view modes
- URL copy functionality

## Module 20: Documentation

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Public Routes                             │
│  /, /events, /gallery, /knowledge, /calendar, /aaradhane   │
│  /quotes, /stotras, /live, /timeline, /search, /display  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Admin Portal                              │
│  /admin/* - Content management, AI settings, Reports        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Routes (/api/*)                       │
│  /api/chat, /api/search, /api/events, /api/quotes, etc.  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Firebase Services                         │
│  Firestore (database), Auth (users), Storage (files)       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI Integration                            │
│  Multi-source retrieval, Intent detection, Action registry │
└─────────────────────────────────────────────────────────────┘
```

### Folder Structure

```
├── app/
│   ├── (public)/          # Public-facing pages
│   │   ├── events/
│   │   ├── gallery/
│   │   ├── knowledge/
│   │   ├── quotes/
│   │   ├── stotras/
│   │   ├── live/
│   │   ├── timeline/
│   │   ├── search/
│   │   └── display/       # Digital signage
│   ├── admin/             # Admin portal
│   │   ├── library/       # Library management
│   │   ├── stotras/      # Stotra management
│   │   └── media/        # Media management
│   └── api/               # API routes
├── components/
│   ├── common/            # Shared components
│   │   └── Search/        # Global search
│   └── ai/                # AI components
├── lib/
│   └── ai/
│       ├── actions/       # AI action registry
│       ├── intent/        # Intent detection
│       └── knowledge/    # Knowledge base
├── services/              # Business logic
├── hooks/                 # React hooks
└── types/                # TypeScript types
```

### Public Routes Summary

| Route | Purpose | Features |
|-------|---------|----------|
| `/` | Homepage | Personalized content, featured events |
| `/events` | Events listing | Filters, search, upcoming events |
| `/gallery` | Photo gallery | Albums, lightbox, downloads |
| `/knowledge` | Articles | Categories, AI summaries |
| `/calendar` | Panchanga & festivals | Daily panchanga, festival calendar |
| `/aaradhane` | Daily prayers | Live stream, schedule |
| `/quotes` | Daily quotes | Categories, random, favorites |
| `/stotras` | Stotra library | Kannada/Sanskrit/English, audio |
| `/live` | Live darshan | YouTube/Facebook, upcoming |
| `/timeline` | Temple history | Interactive scrolling |
| `/search` | Global search | Ctrl+K, autocomplete |
| `/display` | Digital signage | TV-optimized display |

### API Routes Summary

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | AI chatbot interaction |
| `/api/search` | GET | Global search |
| `/api/events` | GET/POST | Events CRUD |
| `/api/quotes` | GET | Quote retrieval |
| `/api/knowledge` | GET | Knowledge articles |
| `/api/ai/*` | Various | AI analytics, settings |

### AI Integration

The AI system uses a hybrid retrieval-first approach:

1. **Structured Retrieval**: Queries knowledge base from Firestore
2. **Intent Detection**: Classifies user intent
3. **Action Registry**: Executes actions based on intent
4. **Fallback**: Safe error responses (no hallucination)

```typescript
// lib/ai/actions/actionRegistry.ts
export type ActionType =
  | "navigate"
  | "share"
  | "calendar"
  | "notification"
  | "open_gallery"
  | "open_library"
  | "book_seva"
  | "make_donation"
  // ...
```

### Search Architecture

Global search uses a unified index:

```typescript
// /api/search
// Query parameters: q (query), types (filter), grouped (format)
// Sources: Events, Articles, Quotes, Stotras, Gallery, Pages
```

Features:
- Debounced autocomplete (300ms)
- Recent searches (localStorage)
- Popular searches
- Keyboard navigation
- Type filters

### Localization Strategy

Supported locales:
- `en` - English
- `kn` - Kannada

```typescript
// types/locale.ts
export type Locale = "en" | "kn";
```

Translation keys stored in Firestore for admin management.

### Accessibility

- Semantic HTML elements
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus indicators
- Reduced motion support

### Performance Optimizations

- Server Components by default
- Dynamic imports for client components
- Image optimization with next/image
- Lazy loading for below-fold content
- ISR for static content

### Extension Points

| Extension | Location | Purpose |
|----------|----------|---------|
| AI Actions | `lib/ai/actions/` | Add new actions |
| Search Sources | `services/search.service.ts` | Add search types |
| Intent Patterns | `lib/ai/intent/` | Add intent detection |
| Components | `components/` | Reusable UI |
| Services | `services/` | Business logic |

## Testing Checklist

- [ ] Digital signage displays correctly on TV
- [ ] Fullscreen mode works
- [ ] Auto-refresh functions properly
- [ ] Admin CRUD operations work
- [ ] Search returns relevant results
- [ ] AI actions execute correctly

## Deployment Notes

1. Enable Firestore indexes for search queries
2. Configure Firebase Storage for media uploads
3. Set up AI provider API keys (if using LLM)
4. Configure notification push credentials
5. Test digital signage on target display resolution
