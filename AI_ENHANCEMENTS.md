# Raya AI Enhancement Roadmap

> Comprehensive plan to improve Raya AI chatbot capabilities

---

## 🚀 Enhancement Phases

### Phase 1: Core Improvements (High Impact, Low Effort)

| # | Enhancement | Description | Files to Change | Priority |
|---|-------------|-------------|-----------------|----------|
| 1 | **Confidence-based Fallback** | When intent confidence < 60%, show FAQ instead of wrong answer | `lib/ai/generator.ts` | HIGH |
| 2 | **Response Length Limits** | Cap responses at 500 chars to prevent hallucinations | `lib/ai/generator.ts` | HIGH |
| 3 | **Unknown Question Logging** | Auto-log questions with low confidence to Firestore | `lib/ai/generator.ts`, new collection | HIGH |
| 4 | **Kannada Transliteration** | Support typing "samaya" for "ಸಮಯ" | `lib/ai/intent/patterns.ts` | MEDIUM |

#### Implementation Details

**1. Confidence-based Fallback**
```typescript
// In generateResponse():
if (intentResult.confidence < 60) {
  return handleFAQIntent(message, language); // Show helpful FAQ instead
}
```

**2. Response Length Limits**
```typescript
const MAX_RESPONSE_LENGTH = 500;
function truncateResponse(content: string): string {
  if (content.length > MAX_RESPONSE_LENGTH) {
    return content.substring(0, MAX_RESPONSE_LENGTH) + 
           "... (Contact temple office for more info)";
  }
  return content;
}
```

**3. Unknown Question Logging**
```typescript
// New collection: unknown_questions
interface UnknownQuestion {
  id: string;
  question: string;
  detectedIntent: string;
  confidence: number;
  language: string;
  timestamp: Date;
  timesAsked: number;
  status: 'pending' | 'reviewed';
}
```

**4. Kannada Transliteration**
```typescript
const KANNADA_TRANSLITERATION = {
  'samaya': 'ಸಮಯ',   // time
  'matha': 'ಮಠ',      // math
  'pooja': 'ಪೂಜೆ',   // worship
  'seva': 'ಸೇವೆ',    // service
  // etc.
};
```

---

### Phase 2: Conversation Memory

| # | Enhancement | Description | Files to Change | Priority |
|---|-------------|-------------|-----------------|----------|
| 5 | **Session Context** | Remember last topic for follow-ups ("timings" → "evening timings?") | New `lib/ai/conversation.ts` | HIGH |
| 6 | **User Preferences** | Remember language choice (EN/KN) per session | Firestore sessions collection | MEDIUM |
| 7 | **Conversation History** | Store last 5 messages for context | Client + Server | MEDIUM |

#### Implementation Details

**5. Session Context**
```typescript
// lib/ai/conversation.ts
interface ConversationContext {
  sessionId: string;
  lastIntent: Intent | null;
  lastTopic: string | null;
  languagePreference: 'en' | 'kn' | 'mixed';
  messageHistory: Message[];
}

function enhanceWithContext(query: string, context: ConversationContext): string {
  // If user asks "evening?" after "morning timings", add context
  if (context.lastTopic === 'timings' && query === 'evening') {
    return 'evening temple timings';
  }
  return query;
}
```

**6. User Preferences (Firestore)**
```typescript
// Collection: chat_sessions/{sessionId}
{
  sessionId: string;
  userId?: string;
  languagePreference: 'en' | 'kn' | 'mixed';
  lastIntent: string;
  lastTopic: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### Phase 3: Analytics Dashboard

| # | Enhancement | Description | Files to Change | Priority |
|---|-------------|-------------|-----------------|----------|
| 8 | **Intent Accuracy Tracking** | Track correct/incorrect intent detection | New `analytics` API | HIGH |
| 9 | **Unknown Questions Report** | Weekly digest of unanswered questions | Admin page | HIGH |
| 10 | **User Satisfaction** | Thumbs up/down buttons | Chat UI | MEDIUM |
| 11 | **Fallback Rate Metric** | Monitor how often bot says "I don't know" | Dashboard | MEDIUM |

#### Implementation Details

**8. Intent Accuracy Tracking**
```typescript
// New collection: chat_analytics
{
  id: string;
  sessionId: string;
  query: string;
  detectedIntent: string;
  detectedConfidence: number;
  finalIntent?: string; // corrected by admin
  userFeedback?: 'helpful' | 'not_helpful';
  responseTime: number;
  timestamp: Timestamp;
}
```

**9. Unknown Questions Report**
```typescript
// API: /api/analytics/unknown-questions
// Aggregates questions with confidence < 50%
// Returns weekly report for admin review
```

**10. User Satisfaction**
```typescript
// Chat UI feedback buttons
const feedback = await saveFeedback({
  query,
  intent,
  helpful: true/false
});
```

---

### Phase 4: Intent Detection (ML-powered)

| # | Enhancement | Description | Files to Change | Priority |
|---|-------------|-------------|-----------------|----------|
| 12 | **Semantic Embeddings** | Use OpenAI/sentence-transformers for better matching | New `lib/ai/semantic.ts` | HIGH |
| 13 | **Learning from Corrections** | When admin corrects intent, improve detection | Training pipeline | MEDIUM |
| 14 | **Fuzzy Matching** | Handle typos and spelling variations | `lib/ai/intent/detector.ts` | HIGH |

#### Implementation Details

**12. Semantic Embeddings**
```typescript
// lib/ai/semantic.ts
import OpenAI from 'openai';

const openai = new OpenAI();

async function findSemanticMatch(query: string, intents: Intent[]) {
  const queryEmbedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  
  // Compare with stored intent embeddings
  // Return best match above threshold
}
```

**14. Fuzzy Matching**
```typescript
// Using fuse.js for fuzzy matching
import Fuse from 'fuse.js';

const fuse = new Fuse(keywords, {
  threshold: 0.3,  // Allow 30% variance
  includeScore: true,
});

function fuzzyMatch(query: string, keywords: string[]): Match[] {
  return fuse.search(query);
}
```

---

### Phase 5: User Experience

| # | Enhancement | Description | Files to Change | Priority |
|---|-------------|-------------|-----------------|----------|
| 15 | **Quick Action Buttons** | "Timings" "Events" "Donate" "Seva" | Chat component | HIGH |
| 16 | **Typing Indicator** | Show "Raya is typing..." | Chat component | MEDIUM |
| 17 | **Streaming Responses** | Show answer as it generates | API + UI | MEDIUM |
| 18 | **Suggested Questions** | "People also ask..." | Chat UI | LOW |

#### Implementation Details

**15. Quick Action Buttons**
```tsx
// Chat component
const quickActions = [
  { label: '🕐 Timings', query: 'Temple timings' },
  { label: '📅 Events', query: 'Upcoming events' },
  { label: '🙏 Sevas', query: 'Available sevas' },
  { label: '💝 Donate', query: 'How to donate' },
];
```

**16. Typing Indicator**
```tsx
// In chat component
const [isTyping, setIsTyping] = useState(false);

// Show when waiting for response
{isTyping && <div className="typing-indicator">Raya is typing...</div>}
```

---

### Phase 6: Content Management

| # | Enhancement | Description | Files to Change | Priority |
|---|-------------|-------------|-----------------|----------|
| 19 | **Knowledge Article Tags** | Auto-tag articles by category | `lib/ai/knowledge/` | MEDIUM |
| 20 | **Content Freshness** | Show "Updated X days ago" | Articles UI | LOW |
| 21 | **Related Questions** | Link similar questions to same answer | Knowledge base | LOW |

---

## 📁 File Changes Summary

```
Modified Files:
├── lib/ai/generator.ts              (fallback logic, length limits)
├── lib/ai/intent/detector.ts        (fuzzy matching)
├── lib/ai/intent/patterns.ts        (kannada transliteration)
├── components/chat/Chat.tsx          (quick buttons, typing indicator)
├── app/admin/ai/page.tsx             (analytics dashboard)

New Files:
├── lib/ai/conversation.ts             (session memory)
├── lib/ai/analytics.ts               (tracking metrics)
├── lib/ai/semantic.ts                (embeddings - optional)
├── lib/ai/transliteration.ts         (kannada transliteration)
├── app/api/chat-analytics/route.ts   (analytics API)
├── app/api/sessions/route.ts         (session management)
├── types/analytics.ts                (analytics types)
├── types/conversation.ts             (conversation types)
```

---

## ⏱️ Effort Estimate

| Phase | Effort | Impact | Weeks | Status |
|-------|--------|--------|-------|--------|
| Phase 1 | 2-3 days | High | 1 | TODO |
| Phase 2 | 3-4 days | High | 1-2 | TODO |
| Phase 3 | 2-3 days | Medium | 1 | TODO |
| Phase 4 | 1-2 weeks | Very High | 2-3 | TODO |
| Phase 5 | 2-3 days | Medium | 1 | TODO |
| Phase 6 | 1-2 weeks | Medium | 2 | TODO |

---

## 🎯 Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Intent Detection Accuracy | > 95% | ~80% |
| Response Relevance | > 90% | ~70% |
| Fallback Rate | < 10% | ~25% |
| User Satisfaction | > 85% | Unknown |
| Unknown Question Reduction | -50% | N/A |

---

## 📋 Firestore Collections Needed

```javascript
// New collections for enhancements

1. chat_sessions
{
  sessionId: string,
  userId?: string,
  languagePreference: 'en' | 'kn' | 'mixed',
  lastIntent: string,
  lastTopic: string,
  messageHistory: Message[],
  createdAt: Timestamp,
  updatedAt: Timestamp
}

2. chat_analytics
{
  id: string,
  sessionId: string,
  query: string,
  detectedIntent: string,
  detectedConfidence: number,
  finalIntent?: string,
  userFeedback?: 'helpful' | 'not_helpful',
  responseTime: number,
  timestamp: Timestamp
}

3. unknown_questions
{
  id: string,
  question: string,
  questionLower: string,
  detectedIntent: string,
  confidence: number,
  language: string,
  timesAsked: number,
  status: 'pending' | 'in_review' | 'resolved' | 'added_to_knowledge',
  response?: string,
  notes?: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## 🔧 Dependencies

```json
{
  "dependencies": {
    "fuse.js": "^7.0.0",        // Fuzzy matching
    "openai": "^4.0.0",          // Embeddings (optional)
    "@tensorflow/tfjs": "^4.0.0" // Local ML (optional)
  }
}
```

---

*Last Updated: July 2026*
*Maintained by: AI Enhancement Team*
