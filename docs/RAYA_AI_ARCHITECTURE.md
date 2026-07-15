# Raya AI Architecture Documentation

**Version:** 2.0  
**Date:** 2026-07-15  
**Status:** Production Ready

---

## 1. Overview

Raya AI is the official AI assistant for Sri Raghavendra Swamy Matha. This document describes the hybrid retrieval architecture that ensures production-grade accuracy by making Firebase the single source of truth.

### Key Principles

1. **No Hallucination** - Temple facts come from structured repositories, not LLM knowledge
2. **Structured Retrieval** - Data is retrieved from appropriate repositories based on intent
3. **Fallback Chain** - Multiple layers ensure reliability
4. **Language Support** - Full support for English, Kannada, and mixed language
5. **Supabase Ready** - Architecture designed for future Supabase migration without code changes

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  AIChatProvider → ChatWindow → ChatInput → MessageBubble               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API Route: /api/chat                               │
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        Intent Detection                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │  │
│  │  │   English   │  │   Kannada   │  │   Mixed     │                  │  │
│  │  │   Patterns  │  │   Patterns  │  │   Language  │                  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│                                    ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     Response Generation                                 │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                  Structured Retrieval                            │  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │  │  │
│  │  │  │Settings │ │ Events  │ │  Sevas  │ │Panchanga│              │  │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘              │  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                          │  │  │
│  │  │  │Announce │ │Donation │ │Aaradhane│                           │  │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘                          │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                    │                                    │  │
│  │                                    ▼                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                    Knowledge Base                                 │  │  │
│  │  │         (Articles, History, FAQ, Philosophy)                     │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                    │                                    │  │
│  │                                    ▼                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                   Response Formatter                              │  │  │
│  │  │            (Structured → Natural Language)                        │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│                                    ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    LLM Fallback (Optional)                           │  │
│  │              (When structured retrieval unavailable)                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Firebase                                          │
│                                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 │
│  │   Repository    │  │   Repository   │  │   Repository   │                 │
│  │   Collections  │  │   Collections  │  │   Collections  │                 │
│  ├────────────────┤  ├────────────────┤  ├────────────────┤                 │
│  │   settings     │  │    events      │  │    sevas       │                 │
│  │   timings     │  │  announcements │  │    donations   │                 │
│  │   aaradhane   │  │   knowledge    │  │   testimonials │                 │
│  └────────────────┘  └────────────────┘  └────────────────┘                 │
│                                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 │
│  │   Tracking    │  │   Admin        │  │   Logs         │                 │
│  │   Collections │  │   Collections  │  │   Collections  │                 │
│  ├────────────────┤  ├────────────────┤  ├────────────────┤                 │
│  │chat_sessions  │  │   admin        │  │ unknown_ques   │                 │
│  │   messages    │  │   feedback     │  │   logs         │                 │
│  └────────────────┘  └────────────────┘  └────────────────┘                 │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Intent Flow

```
User Message
     │
     ▼
┌─────────────────┐
│ Normalize Text  │  (Lowercase, trim)
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Language Detect │  (en, kn, mixed)
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Pattern Match  │  (Priority-ordered)
└─────────────────┘
     │
     ▼
┌─────────────────┐
│Intent Detected  │  (20+ intents)
└─────────────────┘
     │
     ├─────────────────────┐
     ▼                     ▼
┌──────────┐        ┌──────────────┐
│Out Scope?│        │Structured   │
│  Check   │        │Retrieval     │
└──────────┘        └──────────────┘
     │                     │
     │ No                  │
     ▼                     ▼
┌──────────┐        ┌──────────────┐
│ Generate │        │Knowledge Base│
│Response  │        │   Lookup     │
└──────────┘        └──────────────┘
     │                     │
     └──────────┬──────────┘
                ▼
       ┌─────────────────┐
       │Format Response │
       │(Natural Lang)   │
       └─────────────────┘
```

---

## 4. Retrieval Flow

```
Intent Detected
     │
     ▼
┌─────────────────────┐
│  Get Context Data   │
│                     │
│  ┌────────────────┐ │
│  │ Intent Mapping │ │
│  │    Rules       │ │
│  └────────────────┘ │
└─────────────────────┘
     │
     ├─────┬─────┬─────┬─────┐
     ▼     ▼     ▼     ▼     ▼
┌──────┐┌────┐┌─────┐┌────┐┌────┐
│Templ ││Evnt ││Sevas││Pcha ││Knwl │
│Settngs││Repo ││Repo ││Repo ││Base │
└──────┘└────┘└─────┘└────┘└────┘
     │
     ▼
┌─────────────────────┐
│   Response Context  │
│                     │
│  - Temple Settings  │
│  - Events List     │
│  - Sevas List      │
│  - Panchanga       │
│  - Knowledge       │
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│  Generate Response  │
│                     │
│  - Format Data     │
│  - Apply Language  │
│  - Add Metadata    │
└─────────────────────┘
```

---

## 5. Repository Structure

### 5.1 Settings Repository

**Collection:** `settings`, `timings`

**Data Retrieved:**
- Temple name
- Address
- Phone number
- Email
- Morning timings
- Evening timings
- Google Maps URL

**Used By:**
- TEMPLE_TIMINGS
- CONTACT_INFORMATION
- LOCATION
- ADDRESS

### 5.2 Events Repository

**Collection:** `events`

**Data Retrieved:**
- Event title
- Event description
- Start/end dates
- Event times
- Location
- Featured status
- Category

**Used By:**
- UPCOMING_EVENTS
- FESTIVAL_INFO

### 5.3 Sevas Repository

**Collection:** `sevas`

**Data Retrieved:**
- Seva name
- Description
- Category
- Amount
- Duration
- Active status

**Used By:**
- SPECIAL_SEVAS
- DAILY_POOJA

### 5.4 Panchanga Repository

**Data Source:** `public/data/panchanga/{year}/{date}.json`

**Data Retrieved:**
- Date
- Tithi
- Nakshatra
- Yoga
- Karana
- Sunrise
- Sunset

**Used By:**
- PANCHANGA

### 5.5 Announcements Repository

**Collection:** `announcements`

**Data Retrieved:**
- Title
- Message
- Link
- Active status
- Created date

**Used By:**
- ANNOUNCEMENTS

### 5.6 Donations Repository

**Collection:** (From settings + static)

**Data Retrieved:**
- Donation purposes
- Payment methods
- 80G status
- Website URL

**Used By:**
- DONATION
- DONATION_PURPOSE
- DONATION_80G

### 5.7 Aaradhane Repository

**Collection:** `aaradhane`

**Data Retrieved:**
- Title
- Guru name
- Dates
- Description
- Significance
- Rituals

**Used By:**
- NEXT_AARADHANE

### 5.8 Knowledge Repository

**Collection:** `knowledge`

**Structure:**
```typescript
{
  id: string;
  slug: string;
  title: string;
  category: KnowledgeCategory;
  keywords: string[];
  content: string;
  language: "en" | "kn" | "mixed";
  approved: boolean;
  lastReviewed?: Date;
}
```

**Categories:**
- temple_history
- sri_raghavendra
- sri_madhvacharya
- guru_parampara
- brindavana
- mantralaya
- daily_pooja
- special_sevas
- dress_code
- donation_info
- visitor_guidelines
- faq
- madhwa_philosophy

**Used By:**
- TEMPLE_HISTORY
- SRI_RAGHAVENDRA
- MADHWA_PHILOSOPHY
- FAQ
- And other knowledge-based queries

---

## 6. Intent Definitions

| Intent | Category | Requires Structured Data | Source |
|--------|----------|------------------------|---------|
| TEMPLE_TIMINGS | temple_info | Yes | Settings |
| CONTACT_INFORMATION | temple_info | Yes | Settings |
| LOCATION | temple_info | Yes | Settings |
| ADDRESS | temple_info | Yes | Settings |
| UPCOMING_EVENTS | events | Yes | Events |
| NEXT_AARADHANE | events | Yes | Aaradhane |
| FESTIVAL_INFO | events | Yes | Events |
| SPECIAL_SEVAS | sevas | Yes | Sevas |
| DAILY_POOJA | sevas | Yes | Sevas |
| SEVA_BOOKING | sevas | No | Action |
| DONATION | donations | Yes | Donations |
| DONATION_PURPOSE | donations | Yes | Donations |
| DONATION_80G | donations | Yes | Donations |
| ANNOUNCEMENTS | announcements | Yes | Announcements |
| PANCHANGA | panchanga | Yes | Panchanga |
| TEMPLE_HISTORY | knowledge | No | Knowledge |
| SRI_RAGHAVENDRA | knowledge | No | Knowledge |
| MADHWA_PHILOSOPHY | knowledge | No | Knowledge |
| GURU_PARAMPARA | knowledge | No | Knowledge |
| VISITOR_GUIDELINES | visitor | Yes | Settings |
| DRESS_CODE | visitor | Yes | Settings |
| FAQ | faq | No | Knowledge |
| TESTIMONIAL | actions | No | Action |
| VOLUNTEER | actions | No | Knowledge |
| GENERAL_GREETING | general | No | Static |
| THANKS | general | No | Static |
| GOODBYE | general | No | Static |
| OUT_OF_SCOPE | out_of_scope | No | Static |

---

## 7. Confidence & Source Attribution

### 7.1 Confidence Levels

| Level | Score | Description |
|-------|-------|-------------|
| High | 80-100 | Direct repository data |
| Medium | 50-79 | Knowledge base match |
| Low | 0-49 | Fallback, LLM, or uncertain |

### 7.2 Source Types

| Source | Description |
|--------|-------------|
| repository | From Firebase collections |
| knowledge_base | From knowledge articles |
| llm | Generated by LLM |
| fallback | Default/emergency response |

### 7.3 Response Metadata

```typescript
interface AIResponseResult {
  content: string;
  intent: Intent;
  confidence: number;    // 0-100
  source: RetrievalType;  // repository, knowledge_base, llm, fallback
  usesLLM: boolean;
  language: "en" | "kn" | "mixed";
}
```

---

## 8. Language Support

### 8.1 Detection

Kannada Unicode range: U+0C80 to U+0CFF

```typescript
function detectLanguage(message: string): "en" | "kn" | "mixed" {
  const hasKannada = /[\u0C80-\u0CFF]/.test(message);
  if (!hasKannada) return "en";
  
  // Check for mixed by looking for English words
  const englishWords = message.match(/\b(the|is|what|when|how)\b/gi);
  if (englishWords && englishWords.length > 2) {
    return "mixed";
  }
  return "kn";
}
```

### 8.2 Intent Keywords

Each intent includes keywords in both English and Kannada:

```typescript
{
  intent: Intent.TEMPLE_TIMINGS,
  keywords: {
    en: ["timing", "timings", "time", "schedule", "open", "close", ...],
    kn: ["ಸಮಯ", "ತೆರೆಯಲು", "ಮುಚ್ಚಲು", "ಎಷ್ಟು ಹೊತ್ತು", ...]
  }
}
```

### 8.3 Response Templates

Responses are generated in the detected language with appropriate templates.

---

## 9. Unknown Question Logging

### 9.1 Log Entry Structure

```typescript
interface UnknownQuestionLog {
  id: string;
  question: string;
  timestamp: number;
  sessionId: string;
  detectedIntent: Intent;
  confidence: number;
  language: "en" | "kn" | "mixed";
  userAgent?: string;
  ip?: string;
  reviewed: boolean;
  reviewedBy?: string;
  addedToKnowledge: boolean;
}
```

### 9.2 Collection

**Collection:** `unknown_questions`

### 9.3 Triggers

- Confidence < 50%
- No matching knowledge articles
- Knowledge base lookup failure
- Intent = UNKNOWN

### 9.4 Admin Review

Unknown questions are stored for admin review to:
- Add new knowledge articles
- Improve intent patterns
- Fix data gaps

---

## 10. Supabase Migration

### 10.1 Migration Strategy

The architecture is designed to support Supabase as a drop-in replacement for Firebase:

1. **Repositories** abstract all data access
2. **No direct Firebase calls** from UI components
3. **Repository interface** remains the same regardless of backend

### 10.2 Changes Required for Supabase

1. Update `lib/firebase.ts` → `lib/supabase.ts`
2. Update `lib/ai/retrieval/*.ts` to use Supabase client
3. Update `lib/ai/knowledge/repository.ts` to use Supabase client
4. Update `services/*.ts` to use Supabase client

### 10.3 No Code Changes Required

- Intent detection
- Response generation
- API routes
- UI components

These remain unchanged during migration.

---

## 11. File Structure

```
lib/ai/
├── index.ts                    # Main exports
├── provider.ts                 # AI provider abstraction (OpenAI, Gemini, etc.)
├── settings.ts                 # AI settings from Firebase
├── systemPrompt.ts            # Original system prompt
├── prompt-refactored.ts       # V2 prompt without hardcoded facts
├── firebaseChat.ts           # Firebase fallback responses
├── languageDetector.ts        # Language detection utility
├── generator.ts               # Hybrid response generator
├── unknown-logger.ts         # Unknown question logging
│
├── intent/
│   ├── index.ts             # Exports
│   ├── types.ts             # Intent types, enums
│   ├── patterns.ts          # Keyword patterns
│   └── detector.ts          # Intent detection engine
│
├── retrieval/
│   ├── index.ts             # Exports & context builder
│   ├── types.ts             # Retrieval types
│   ├── settings.ts          # Settings repository
│   ├── events.ts           # Events repository
│   ├── sevas.ts            # Sevas repository
│   ├── announcements.ts     # Announcements repository
│   ├── panchanga.ts        # Panchanga repository
│   ├── donations.ts        # Donations repository
│   └── aaradhane.ts        # Aaradhane repository
│
└── knowledge/
    ├── index.ts             # Exports & helpers
    ├── types.ts             # Knowledge types
    ├── seed.ts             # Seed articles
    └── repository.ts       # Firebase operations
```

---

## 12. Environment Variables

```env
# AI Provider Configuration
AI_PROVIDER=openai  # openai, gemini, claude, openrouter
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Hybrid Mode (default: true)
AI_HYBRID_MODE=true  # Set to false to disable hybrid retrieval
```

---

## 13. Testing

### 13.1 Test Categories

1. **Unit Tests** - Intent detection, knowledge base, response generation
2. **Integration Tests** - API routes, Firebase operations
3. **E2E Tests** - Full conversation flows

### 13.2 Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### 13.3 Test Files

```
tests/
├── unit/
│   ├── intent.test.ts              # Intent detection tests
│   ├── knowledge.test.ts           # Knowledge base tests
│   └── response-generator.test.ts # Response generation tests
└── functional/
    └── ... (existing functional tests)
```

---

## 14. Monitoring & Analytics

### 14.1 Response Metadata

Each response includes metadata for analytics:

- Intent distribution
- Confidence scores
- Response sources
- Language distribution
- Error rates

### 14.2 Logging

- Unknown question logging
- Low confidence warnings
- Retrieval failures
- API errors

---

## 15. Future Enhancements

1. **Semantic Search** - Use embeddings for better knowledge matching
2. **Voice Input** - Speech-to-text for accessibility
3. **Multi-language** - Add Hindi support
4. **Conversation Context** - Maintain context across multiple turns
5. **Caching** - Redis for frequent queries
6. **Rate Limiting** - Per-user rate limiting

---

## 16. Troubleshooting

### 16.1 High Hallucination Rate

**Symptoms:** LLM generates incorrect temple information

**Solution:** Check that:
1. `AI_HYBRID_MODE=true` is set
2. Intent detection is working (check logs)
3. Repositories have data
4. No errors in retrieval

### 16.2 Slow Response Time

**Symptoms:** Responses take > 3 seconds

**Solution:** Check that:
1. Caching is working
2. Firebase connection is stable
3. Panchanga files are accessible
4. No network issues

### 16.3 Intent Misclassification

**Symptoms:** Wrong intent detected frequently

**Solution:**
1. Check keyword patterns in `lib/ai/intent/patterns.ts`
2. Review unknown question logs
3. Add missing keywords

---

*Document maintained by: Development Team*  
*Last Updated: 2026-07-15*
