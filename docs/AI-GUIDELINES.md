# AI Guidelines (Raya AI)

**Project:** Sri Raghavendra Swamy Matha Website
**Last Updated:** 2026-07-19

---

## Overview

Raya AI is the official AI assistant for Sri Raghavendra Swamy Matha. This document defines the guidelines for AI development, response generation, and knowledge management. It answers: "How should the AI behave?"

---

## Core Principles

### 1. Retrieval-First Philosophy

**Never rely on LLM knowledge for temple facts.**

```typescript
// ✅ Correct - Get data from Firebase
const timings = await settingsService.getTimings();
const response = `The temple opens at ${timings.morningOpen}...`;

// ❌ Wrong - Let LLM generate facts
const response = "The temple opens at around 6 AM..."; // May be wrong!
```

### 2. No Hallucinations

Temple facts must come from structured repositories:

| Fact Type | Source |
|-----------|--------|
| Temple timings | `settings` collection |
| Seva details | `sevas` collection |
| Event schedules | `events` collection |
| Donations | `donations` collection |
| History/philosophy | `knowledge` collection |

### 3. Fallback Chain

When structured data is unavailable, use this fallback order:

```
1. Repository (Firebase collections)
     ↓
2. Knowledge Base (Articles)
     ↓
3. LLM Response (with context)
     ↓
4. Static Response (default message)
```

### 4. Language Support

Support for English, Kannada, and mixed language:

```typescript
type Language = "en" | "kn" | "mixed";

// Kannada Unicode range: U+0C80 to U+0CFF
const KANNADA_RANGE = /[\u0C80-\u0CFF]/;
```

---

## Intent Detection

### Supported Intents

| Intent | Description | Repository |
|--------|-------------|------------|
| `TEMPLE_TIMINGS` | Opening/closing hours | settings |
| `SPECIAL_SEVAS` | Special sevas | sevas |
| `DAILY_POOJA` | Daily poojas | sevas |
| `SEVA_BOOKING` | Book a seva | actions |
| `DONATION` | Donation information | donations |
| `DONATION_PURPOSE` | Donation purposes | donations |
| `DONATION_80G` | 80G certificate | donations |
| `ANNOUNCEMENTS` | Current announcements | announcements |
| `PANCHANGA` | Today's panchanga | panchanga |
| `DAILY_QUOTE` | Today's devotional quote | quotes |
| `TEMPLE_HISTORY` | History of temple | knowledge |
| `SRI_RAGHAVENDRA` | About the saint | knowledge |
| `MADHWA_PHILOSOPHY` | Philosophy | knowledge |
| `GURU_PARAMPARA` | Guru lineage | knowledge |
| `VISITOR_GUIDELINES` | How to visit | settings |
| `DRESS_CODE` | What to wear | settings |
| `FAQ` | Frequently asked | knowledge |
| `TESTIMONIAL` | Share experience | actions |
| `VOLUNTEER` | Volunteer info | knowledge |
| `GENERAL_GREETING` | Hello/namaste | static |
| `THANKS` | Thank you | static |
| `GOODBYE` | Goodbye | static |
| `OUT_OF_SCOPE` | Not related | static |

### Intent Detection Flow

```
User Message
     ↓
Normalize (lowercase, trim)
     ↓
Language Detection (en/kn/mixed)
     ↓
Pattern Matching (keyword-based)
     ↓
Intent + Confidence Score
```

### DAILY_QUOTE Intent

The `DAILY_QUOTE` intent provides today's devotional quote from the Quote Engine. This intent:

- **Never generates quotes** - Always retrieves from `QuoteService`
- **Supports multilingual queries** - English, Kannada, and mixed language
- **Includes awareness features** - Festival, Thursday, and Panchanga awareness
- **Supports follow-up queries** - "another quote", "one more", etc.

#### Supported Query Patterns

**English:**
- "today's quote", "quote of the day", "daily quote"
- "devotional quote", "spiritual quote"
- "rayaru quote", "guru quote", "raghavendra quote"
- "verse of the day", "today's blessing"
- "daily prayer", "sloka", "stotra"
- "mangalashtakam", "another quote", "one more"

**Kannada (ಕನ್ನಡ):**
- "ಇಂದಿನ ಉಲ್ಲೇಖ", "ದಿನದ ಉಲ್ಲೇಖ"
- "ಇಂದಿನ ಶ್ಲೋಕ", "ಇಂದಿನ ಸಂದೇಶ"
- "ರಾಯರ ಸಂದೇಶ", "ಗುರು ಸಂದೇಶ"
- "ಇಂದಿನ ಆಶೀರ್ವಾದ", "ಇಂದಿನ ಪ್ರಾರ್ಥನೆ"
- "ರಾಯರ ಶ್ಲೋಕ", "ಮಂಗಳಾಷ್ಟಕ"
- "ಮತ್ತೊಂದು ಉಲ್ಲೇಖ", "ಇನ್ನೊಂದು ಶ್ಲೋಕ"

#### Response Features

**Festival Awareness:**
When the quote is selected for a festival, includes:
> "Today's quote is selected specially for Sri Raghavendra Aradhana."

**Thursday Awareness:**
When the quote is from Guru Vandana category on Thursday:
> "Today is Thursday, so today's devotional message comes from Guru Vandana."

**Panchanga Awareness:**
When the quote was selected due to Panchanga rules:
> "Today's Panchanga has influenced the devotional quote selection."

#### Response Format

```typescript
{
  content: string;      // Formatted quote with awareness messages
  intent: "DAILY_QUOTE";
  confidence: 95;     // High confidence for quote queries
  source: "repository"; // Always from QuoteService
  usesLLM: false;      // Never generates content
  debugInfo?: {
    quoteId: string;
    category: string;
    reason: string;
    ruleApplied: string;
    cacheHit: boolean;
  };
}
```

---

## Response Generation

### Response Structure

```typescript
interface AIResponse {
  content: string;
  intent: Intent;
  confidence: number;      // 0-100
  source: SourceType;      // repository, knowledge_base, llm, fallback
  language: Language;
  usesLLM: boolean;
  metadata?: {
    citations?: string[];
    relatedLinks?: string[];
  };
}
```

### Confidence Levels

| Level | Score | Action |
|-------|-------|--------|
| High | 80-100 | Return direct response |
| Medium | 50-79 | Return with source citation |
| Low | < 50 | Log unknown question, return fallback |

### Response Templates

#### English Template

```typescript
const enTemplates = {
  greeting: "Namaste! I am Raya, your temple assistant. How can I help you today?",
  timings: "The temple timings are:\nMorning: {morningOpen} - {morningClose}\nEvening: {eveningOpen} - {eveningClose}",
  donation: "Thank you for your generosity! You can contribute via:\n1. UPI: {upiId}\n2. Bank Transfer\n3. Cash at the counter",
};
```

#### Kannada Template

```typescript
const knTemplates = {
  greeting: "ನಮಸ್ತೆ! ನಾನು ರಾಯ, ನಿಮ್ಮ ದೇವಸ್ಥಾನದ ಸಹಾಯಕ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
  timings: "ದೇವಸ್ಥಾನದ ಸಮಯ:\nಬೆಳಿಗೆ: {morningOpen} - {morningClose}\nಸಂಜೆ: {eveningOpen} - {eveningClose}",
};
```

---

## Knowledge Centre Integration

### Knowledge Article Structure

```typescript
interface KnowledgeArticle {
  id: string;
  title: {
    en: string;
    kn: string;
  };
  content: {
    en: string;
    kn: string;
  };
  category: string;
  tags: string[];
  keywords: {
    en: string[];
    kn: string[];
  };
  lastUpdated: Timestamp;
}
```

### Knowledge Categories

| Category | Content |
|----------|---------|
| `history` | Temple history |
| `philosophy` | Madhwa philosophy |
| `guru_parampara` | Guru lineage |
| `festivals` | Festival information |
| `rituals` | Pooja procedures |
| `faq` | Common questions |
| `visiting` | Visitor guidelines |

### Knowledge Retrieval

```typescript
async function searchKnowledge(query: string, language: Language) {
  // 1. Normalize query
  const normalized = query.toLowerCase().trim();
  
  // 2. Search by keywords
  const articles = await knowledgeRepository.search({
    keywords: { [language]: normalized },
    limit: 5,
  });
  
  // 3. Return best match
  return articles[0] || null;
}
```

---

## Source Citations

Always cite the source of information:

```typescript
function formatResponse(data: any, source: string): string {
  return `${data.content}

📖 Source: ${source}
`;
}
```

### Citation Format

```
📖 Source: Temple Records, updated {date}
```

---

## Error Handling

### Unknown Questions

Log unknown questions for admin review:

```typescript
interface UnknownQuestionLog {
  id: string;
  question: string;
  language: Language;
  sessionId: string;
  timestamp: Timestamp;
  confidence: number;
  reviewed: boolean;
  reviewedBy?: string;
  addedToKnowledge?: boolean;
}
```

### Error Responses

```typescript
const errorResponses = {
  serviceUnavailable: {
    en: "I'm having trouble accessing temple information right now. Please try again later.",
    kn: "ಪ್ರಸ್ತುತ ದೇವಸ್ಥಾನದ ಮಾಹಿತಿಯನ್ನು ಪಡೆಯುವಲ್ಲಿ ತೊಂದರೆ ಇದೆ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  },
  rateLimited: {
    en: "Too many requests. Please wait a moment before asking another question.",
    kn: "ಹೆಚ್ಚಿನ ವಿನಂತಿಗಳು. ಇನ್ನೊಂದು ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳುವ ಮೊದಲು ದಯವಿಟ್ಟು ಕಾಯಿರಿ.",
  },
};
```

---

## Conversation Memory

### Session Management

```typescript
interface ChatSession {
  id: string;
  userId?: string;
  messages: ChatMessage[];
  context: {
    lastIntent?: Intent;
    lastLanguage?: Language;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Context Window

- Maintain last 10 messages for context
- Reset context on session timeout (30 minutes)
- Clear context on user request

---

## Prompt Design

### System Prompt Template

```typescript
const systemPrompt = `You are Raya, the AI assistant for Sri Raghavendra Swamy Matha.

Guidelines:
1. Always use temple data from Firebase, never hallucinate
2. Support English, Kannada, and mixed language
3. Be respectful and devotional in tone
4. Cite sources when providing factual information
5. Redirect out-of-scope questions gracefully

Current temple information:
- Timings: {timings}
- Current events: {events}
- Active announcements: {announcements}
`;
```

---

## Development Guidelines

### Adding New Intents

1. Add intent to `lib/ai/intent/types.ts`
2. Add keywords in `lib/ai/intent/patterns.ts`
3. Add retrieval logic in `lib/ai/retrieval/`
4. Add response template
5. Add tests

### Adding New Knowledge

1. Create article in Firebase `knowledge` collection
2. Add keywords for searchability
3. Update patterns if needed
4. Test with sample queries

### Testing

```bash
# Run AI-specific tests
npm test -- --testPathPattern=ai

# Test intent detection
npm test -- --testPathPattern=intent

# Test knowledge retrieval
npm test -- --testPathPattern=knowledge
```

---

## Monitoring & Analytics

### Metrics to Track

| Metric | Description |
|--------|-------------|
| Total conversations | Daily/weekly/monthly |
| Intent distribution | Most common intents |
| Confidence scores | Average confidence per intent |
| Unknown questions | Questions needing review |
| Response time | Average response latency |
| Language distribution | en/kn/mixed ratio |
| Error rate | Failed requests percentage |

### Logging

```typescript
// Log all AI interactions
await analyticsService.log({
  event: 'ai_message',
  properties: {
    intent,
    confidence,
    source,
    language,
    responseTime,
  },
});
```

---

## Troubleshooting

### High Hallucination Rate

**Symptoms:** LLM generates incorrect temple information.

**Solution:**
1. Verify `AI_HYBRID_MODE=true` in environment
2. Check intent detection is working
3. Ensure repositories have data
4. Review retrieval logs

### Slow Response Time

**Symptoms:** Responses take > 5 seconds.

**Solution:**
1. Check Firebase connection
2. Verify Panchanga files accessible
3. Review knowledge base search time
4. Check LLM API latency

### Intent Misclassification

**Symptoms:** Wrong intent detected.

**Solution:**
1. Review keyword patterns in `patterns.ts`
2. Check unknown question logs
3. Add more specific keywords
4. Lowercase/normalization issues?

---

*Document maintained by: Development Team*
