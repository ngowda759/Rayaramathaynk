# Raya AI Enhancements Roadmap

**Version:** 1.0  
**Date:** July 2026  
**Status:** In Progress

---

## Overview

This document tracks all enhancements planned and implemented for Raya AI, the chatbot assistant for Sri Raghavendra Swamy Matha.

---

## Phase 1: Core Improvements (High Impact, Low Effort)

| # | Enhancement | Description | Status | PR |
|---|-------------|-------------|--------|-----|
| 1 | Confidence-based Fallback | When intent confidence < 60%, show FAQ instead of wrong answer | ✅ Done | #76 |
| 2 | Response Length Limits | Cap responses at 500 chars to prevent hallucinations | ✅ Done | #76 |
| 3 | Unknown Question Logging | Auto-log questions with low confidence to Firestore | ✅ Done | #79 |
| 4 | Kannada Transliteration | Support typing "samaya" for "ಸಮಯ" | ✅ Done | #79 |

---

## Phase 2: Conversation Memory

| # | Enhancement | Description | Status | PR |
|---|-------------|-------------|--------|-----|
| 5 | Session Context | Remember last topic for follow-ups ("timings" → "evening timings?") | ✅ Done | #79 |
| 6 | User Preferences | Remember language choice (EN/KN) per session | ✅ Done | #79 |
| 7 | Conversation History | Store last 20 messages for context | ✅ Done | #79 |

---

## Phase 3: Analytics Dashboard

| # | Enhancement | Description | Status | PR |
|---|-------------|-------------|--------|-----|
| 8 | Intent Accuracy Tracking | Track correct/incorrect intent detection | 📋 Todo | - |
| 9 | Unknown Questions Report | Weekly digest of unanswered questions | 📋 Todo | - |
| 10 | User Satisfaction | Thumbs up/down buttons | 📋 Todo | - |
| 11 | Fallback Rate Metric | Monitor how often bot says "I don't know" | 📋 Todo | - |

---

## Phase 4: Intent Detection (ML-powered)

| # | Enhancement | Description | Status | PR |
|---|-------------|-------------|--------|-----|
| 12 | Semantic Embeddings | Use OpenAI/sentence-transformers for better matching | 📋 Todo | - |
| 13 | Learning from Corrections | When admin corrects intent, improve detection | 📋 Todo | - |
| 14 | Fuzzy Matching | Handle typos and spelling variations | 📋 Todo | - |

---

## Phase 5: User Experience

| # | Enhancement | Description | Status | PR |
|---|-------------|-------------|--------|-----|
| 15 | Quick Action Buttons | "Timings" "Events" "Donate" "Seva" | 📋 Todo | - |
| 16 | Typing Indicator | Show "Raya is typing..." | 📋 Todo | - |
| 17 | Streaming Responses | Show answer as it generates | 📋 Todo | - |
| 18 | Suggested Questions | "People also ask..." | 📋 Todo | - |

---

## Phase 6: Content Management

| # | Enhancement | Description | Status | PR |
|---|-------------|-------------|--------|-----|
| 19 | Knowledge Article Tags | Auto-tag articles by category | 📋 Todo | - |
| 20 | Content Freshness | Show "Updated X days ago" | 📋 Todo | - |
| 21 | Related Questions | Link similar questions to same answer | 📋 Todo | - |

---

## Implementation Details

### Phase 1: Core Improvements

#### 1. Confidence-based Fallback ✅
- **Status:** Implemented in PR #76
- **Logic:** When intent confidence < 60%, return FAQ response instead
- **File:** `lib/ai/generator.ts`

#### 2. Response Length Limits ✅
- **Status:** Implemented in PR #76
- **Logic:** Cap responses at 500 characters
- **File:** `lib/ai/generator.ts`

#### 3. Unknown Question Logging ✅
- **Status:** Implemented in PR #79
- **Logic:** Log all questions with confidence < 60% to Firestore
- **Collections:** `unknown_questions` in Firestore
- **Fields:** question, intent, confidence, language, timestamp, sessionId
- **File:** `services/analytics.service.ts`

#### 4. Kannada Transliteration ✅
- **Status:** Implemented
- **Logic:** Support Romanized Kannada (e.g., "samaya" → "ಸಮಯ")
- **File:** `lib/ai/intent/transliteration.ts`
- **Features:**
  - Common word mappings (namaskara, darshan, seva, etc.)
  - Vowel combinations (aa, ii, ee, oo, ai, au)
  - Consonant combinations (sh, ch, th, ng, ny, tt, dd, etc.)

### Phase 2: Conversation Memory

#### 5-7. Session & Conversation Memory ✅
- **Status:** Implemented
- **Files:** 
  - `services/conversation.service.ts` - Session management
  - `app/api/chat/route.ts` - Session integration
- **Features:**
  - Session context tracking (last topic/intent)
  - Follow-up detection ("timings" → uses previous context)
  - Language preference memory (remembers EN/KN choice)
  - Conversation history storage (last 20 messages)
  - Auto-create new session if none provided

---

## Testing

All enhancements should be tested with:
- Unit tests in `tests/unit/`
- Integration tests in `tests/integration/`
- Playwright E2E tests in `tests/ai-uat/`

Run tests:
```bash
npm run test:ai-uat:jest
```

---

## Rollback Plan

If any enhancement causes issues:
1. Revert the specific commit
2. Run tests to verify
3. Deploy to production

---

*Document maintained by: Development Team*  
*Last Updated: July 2026*
