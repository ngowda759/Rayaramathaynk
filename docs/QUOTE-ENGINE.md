# Devotional Quote Engine Documentation

**Project:** Sri Raghavendra Swamy Matha Website
**Feature:** Intelligent Devotional Quote Engine
**Last Updated:** 2026-07-21

---

## Overview

The Devotional Quote Engine is an intelligent system that automatically selects and displays the most appropriate devotional verse, prayer, or teaching based on the temple calendar, Panchanga, festivals, weekdays, and configurable rules.

The system replaces the existing hardcoded quote rotation with a fully data-driven approach that requires no code changes when adding new quotes.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Quote Engine Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────────────────────┐    │
│  │   Admin Portal   │───▶│      Quote Service               │    │
│  │  /admin/quotes  │    │  quote.service.ts               │    │
│  └─────────────────┘    │                                 │    │
│                          │  - Calendar-aware selection     │    │
│  ┌─────────────────┐     │  - Festival detection           │    │
│  │ Homepage Widget │◀───│  - Weekday rules              │    │
│  │ DailyQuoteWidget│     │  - Panchanga awareness         │    │
│  └─────────────────┘     │  - Deterministic rotation      │    │
│                          │  - Caching                     │    │
│  ┌─────────────────┐     └───────────────┬─────────────────┘    │
│  │   Raya AI       │                   │                       │
│  │ Integration     │◀─────────────────┘                       │
│  └─────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Firestore                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    quotes                                │    │
│  │  - raghavendra_stotra (priority 5)                    │    │
│  │  - mangalashtakam (priority 2-3)                      │    │
│  │  - guru_vandana (priority 4)                          │    │
│  │  - authentic_teachings (priority 6)                   │    │
│  │  - madhwa_philosophy (priority 7)                     │    │
│  │  - devotional_sayings (priority 8)                    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quote Categories

| Category | Priority | Description | Auto-Trigger |
|----------|----------|-------------|--------------|
| `raghavendra_stotra` | 5 | Sri Raghavendra Stotra verses | Daily rotation |
| `mangalashtakam` | 2-3 | Mangalashtakam verses | Aradhana, Guru Purnima |
| `guru_vandana` | 4 | Guru Vandana prayers | Thursdays |
| `authentic_teachings` | 6 | Teachings from Sri Raghavendra | Daily rotation |
| `madhwa_philosophy` | 7 | Dvaita philosophy principles | Saturday |
| `devotional_sayings` | 8 | General devotional content | Fallback only |

---

## Selection Algorithm

The quote selection follows this priority order:

```
1. Festival Quote (if today is a festival)
   ↓
2. Event-specific Quote (if event has dedicated quotes)
   ↓
3. Guru Purnima Quote (if Guru Purnima)
   ↓
4. Thursday Guru Vandana (if Thursday)
   ↓
5. Sri Raghavendra Stotra (daily verse)
   ↓
6. Authentic Teachings
   ↓
7. Madhwa Philosophy
   ↓
8. Devotional Sayings (fallback)
   ↓
9. Random Active Quote
```

### Deterministic Rotation

The rotation uses date-based selection to ensure:
- **Same date = Same quote** (deterministic)
- **No repetition** until all quotes in category are shown
- **Year-independent** calculation

```typescript
// Example: Date-based index calculation
const dateNum = dateStr.split("-").join("").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
const index = dateNum % quotes.length;
return quotes[index];
```

---

## Firestore Schema

### Collection: `quotes`

```typescript
interface Quote {
  id: string;                    // Firestore document ID
  slug: string;                  // URL-friendly identifier
  
  // Content
  title: string;                // Quote title
  category: QuoteCategory;       // Category enum
  priority: number;              // 1-10 (lower = higher priority)
  language: QuoteLanguage;       // en | kn | sa | mixed
  
  content: {
    kannada?: string;            // Kannada text
    sanskrit?: string;           // Sanskrit/Devanagari text
    transliteration?: string;    // IAST transliteration
    translationEnglish?: string;// English translation
  };
  
  source: string;               // Source attribution
  author?: string;               // Author name
  verseNumber?: number;         // Verse/stanza number
  
  // Organization
  tags: string[];              // Search tags
  active: boolean;              // Is available
  featured: boolean;             // Priority display
  
  // Display Rules
  festivalOnly: boolean;        // Festival-specific only
  festivalNames: FestivalName[]; // Associated festivals
  weekdayOnly: Weekday | null;   // Specific weekday (0-6)
  panchangaRules?: PanchangaRules;
  
  // Date Range
  displayFrom?: string;         // ISO date
  displayTo?: string;           // ISO date
  
  // Selection
  displayWeight: number;        // Higher = more likely
  rotationGroup?: string;       // Non-repetition group
  
  // Stats
  stats?: {
    viewCount: number;
    lastViewedAt?: string;
  };
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}
```

### Indexes Required

```json
{
  "quotes": [
    { "fields": [["active", "asc"], ["priority", "asc"]] },
    { "fields": [["category", "asc"], ["active", "asc"]] },
    { "fields": [["featured", "asc"], ["active", "asc"]] },
    { "fields": [["festivalOnly", "asc"], ["active", "asc"]] },
    { "fields": [["weekdayOnly", "asc"]] }
  ]
}
```

---

## API Endpoints

### Public APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/quotes` | GET | Get quotes with filters |
| `/api/quotes/today` | GET | Get today's quote |
| `/api/quotes/featured` | GET | Get featured quotes |
| `/api/quotes/random` | GET | Get random quote |
| `/api/quotes/category/[category]` | GET | Get by category |
| `/api/quotes/festival/[festival]` | GET | Get by festival |
| `/api/quotes/search?q=` | GET | Search quotes |
| `/api/quotes/preview` | GET | Preview rotation |
| `/api/quotes/stats` | GET | Get statistics |
| `/api/quotes/tags` | GET | Get all tags |

### Admin APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/quotes` | GET | List all (admin) |
| `/api/admin/quotes` | POST | Create quote |
| `/api/admin/quotes` | PATCH | Bulk update |
| `/api/admin/quotes` | DELETE | Bulk delete |
| `/api/admin/quotes/[id]` | GET | Get single |
| `/api/admin/quotes/[id]` | PUT | Update single |
| `/api/admin/quotes/[id]` | DELETE | Delete single |
| `/api/admin/quotes/bulk` | GET | Export quotes |
| `/api/admin/quotes/bulk` | POST | Import quotes |
| `/api/admin/quotes/seed` | POST | Seed defaults |
| `/api/admin/quotes/cache` | POST | Clear cache |

---

## Homepage Integration

### Component: `DailyQuoteWidget`

```tsx
import { DailyQuoteWidget } from "@/components/home/DailyQuoteWidget";

// Usage
<DailyQuoteWidget 
  initialQuote={existingQuote}
  className="my-custom-class"
/>
```

### Features
- Loading skeleton
- Error state with retry
- Multilingual display (Kannada, Sanskrit, English)
- Verse number badge
- Category indicator
- Featured star badge
- Responsive design

---

## Admin Portal

### URL: `/admin/quotes`

**Features:**
- CRUD operations
- Bulk import/export (JSON)
- Category filtering
- Search functionality
- Featured toggle
- Active/Inactive status
- Festival assignment
- Weekday assignment
- Preview rotation (next 7 days)
- Statistics dashboard

### Adding a New Quote

1. Navigate to `/admin/quotes`
2. Click "Add Quote"
3. Fill in:
   - Title (required)
   - Category (required)
   - Source (required)
   - Content in Kannada/Sanskrit/English
   - Tags for search
4. Configure display rules:
   - Festival-specific?
   - Weekday-specific?
   - Priority level?
5. Save

### Bulk Import

1. Click "Import"
2. Paste JSON array of quotes
3. Click "Import"
4. Review results

```json
[
  {
    "title": "Quote Title",
    "category": "raghavendra_stotra",
    "source": "Source Name",
    "content": {
      "kannada": "ಕನ್ನಡ ಪಠ್ಯ",
      "translationEnglish": "English translation"
    }
  }
]
```

---

## AI Integration

### Intent: `DAILY_QUOTE`

**Trigger Keywords:**
- "today's quote"
- "rayaru quote"
- "guru quote"
- "verse for today"
- "daily inspiration"
- "ಇಂದಿನ ಶ್ಲೋಕ"

**Response Format:**
```typescript
{
  quote: Quote;
  context: {
    category: QuoteCategory;
    reason: string;  // "Sri Raghavendra Stotra - Daily verse"
  };
}
```

### AI Response Example

> 🙏 Here is today's devotional inspiration:
>
> **ಶ್ರೀಪೂರ್ಣಬೋಧ-ಗುರು-ತೀರ್ಥ-ಪಯೋಽಬ್ಧಿ-ಪಾರಾ**
>
> *Translation:* Salutations to the ocean of perfect knowledge...
>
> 📖 Source: Sri Raghavendra Stotra, Verse 1
> 🏷️ Category: Sri Raghavendra Stotra

---

## Seed Script

Run the seed script to populate initial quotes:

```bash
npx ts-node --project tsconfig.scripts.json scripts/seed-quotes.ts
```

**Seeded Content:**
- 8 verses from Sri Raghavendra Stotra
- 8 verses from Sri Raghavendra Mangalashtakam
- 4 Guru Vandana prayers
- 5 Madhwa Philosophy principles
- 5 Authentic Teachings
- 3 Devotional Sayings

---

## Caching

- **Duration:** 24 hours
- **Invalidation:** Automatic at midnight (IST)
- **Manual Clear:** Via `/api/admin/quotes/cache` (POST)

---

## Festival Mapping

| Festival | Quote Category |
|----------|----------------|
| Sri Raghavendra Aradhana | Mangalashtakam |
| Guru Purnima | Mangalashtakam |
| Vyasa Pooja | Mangalashtakam |
| Brahmotsava | Mangalashtakam |
| Thursday (any) | Guru Vandana |
| Saturday | Madhwa Philosophy |

---

## Weekday Mapping

| Day | Category |
|-----|---------|
| Sunday | Raghavendra Stotra |
| Monday | Authentic Teachings |
| Tuesday | Raghavendra Stotra |
| Wednesday | Authentic Teachings |
| Thursday | Guru Vandana |
| Friday | Raghavendra Stotra |
| Saturday | Madhwa Philosophy |

---

## Testing

```bash
# Run unit tests
npm test -- --testPathPattern=quote

# Test API endpoints
curl http://localhost:3000/api/quotes/today

# Test admin endpoints (requires auth)
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/admin/quotes
```

---

## Adding New Categories

1. Add to `QuoteCategory` enum in `types/quote.ts`
2. Add category info to `QUOTE_CATEGORIES` array
3. Update selection logic in `quote.service.ts`
4. Add admin UI filters if needed

---

## Performance Considerations

- **Caching:** Daily quote cached to minimize reads
- **Indexing:** Firestore indexes for common queries
- **Pagination:** Limit results for list views
- **Lazy Loading:** Homepage widget loads on demand

---

## Error Handling

| Error | Response |
|-------|----------|
| No quotes found | Empty array with 200 status |
| Invalid category | 400 with valid options |
| Quote not found | 404 |
| Firebase error | 500 with error details |

---

## Future Enhancements

- [ ] Panchanga-aware quote selection
- [ ] User preference for language
- [ ] Quote of the day email
- [ ] Social media sharing
- [ ] Audio recitation integration
- [ ] Multi-language search

---

*Document maintained by: Development Team*
