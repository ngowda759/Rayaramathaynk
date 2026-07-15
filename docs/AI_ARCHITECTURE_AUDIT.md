# Raya AI Architecture Audit

**Date:** 2026-07-15  
**Version:** 1.0  
**Status:** Complete

---

## 1. Current Architecture Overview

### 1.1 System Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  AIChatProvider → ChatWindow → ChatInput → MessageBubble                │  │
│  │  ├── FloatingButton (triggers chat)                                    │  │
│  │  ├── SuggestedQuestions (quick actions)                                │  │
│  │  └── MarkdownRenderer (response formatting)                            │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│                                    ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                     API Route: /api/chat (POST)                         │  │
│  │  ├── Rate Limiting (20 req/min per IP)                                  │  │
│  │  ├── Request Validation                                                 │  │
│  │  └── Response Source: AI Provider or Firebase Fallback                   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Backend Processing                                   │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    AI Provider Layer                                     │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │   │
│  │  │ OpenAI  │  │ Gemini  │  │ Claude  │  │OpenRouter│                 │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘                 │   │
│  │                                                                              │
│  │  [lib/ai/provider.ts] - Abstract provider with isConfigured() check     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Knowledge Layer                                      │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │   │
│  │  │ System Prompt    │  │ Knowledge Base   │  │ Firebase Chat   │    │   │
│  │  │ (Hardcoded)      │  │ (lib/knowledge) │  │ Training Data   │    │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Firebase                                         │
│                                                                               │
│  Collections:                                                                │
│  ├── chat_sessions      - Session management                                  │
│  ├── messages           - Message history                                    │
│  ├── testimonials       - User testimonials                                   │
│  ├── volunteer_requests  - Volunteer signups                                  │
│  ├── feedback            - Response ratings                                   │
│  ├── events              - Temple events                                      │
│  ├── sevas               - Available sevas                                    │
│  ├── announcements       - Temple announcements                              │
│  ├── settings            - Site settings                                      │
│  ├── chatTraining        - Keyword-based responses (unused fallback)           │
│  └── trust               - Trust committee members                            │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Architecture

```
components/ai/
├── AIChatProvider.tsx       - Context provider (useAIChat hook)
├── ChatWidget.tsx           - Widget container
├── FloatingButton.tsx       - FAB trigger
├── ChatWindow.tsx           - Main chat interface
├── MessageBubble.tsx        - Message display with regenerate
├── TypingIndicator.tsx      - Loading animation
├── ChatInput.tsx            - Text input with send
├── SuggestedQuestions.tsx   - Quick question chips
└── MarkdownRenderer.tsx     - Markdown content renderer
```

### 1.3 Files Involved in Current AI Implementation

| File | Purpose | Status |
|------|---------|--------|
| `app/api/chat/route.ts` | API endpoint | Needs refactoring |
| `lib/ai/provider.ts` | AI provider abstraction | Works correctly |
| `lib/ai/systemPrompt.ts` | System prompt & messages | **Needs major changes** |
| `lib/ai/settings.ts` | AI settings from Firebase | Works correctly |
| `lib/ai/firebaseChat.ts` | Firebase fallback responses | **Needs replacement** |
| `lib/ai/languageDetector.ts` | Language detection | Works correctly |
| `lib/knowledge/index.ts` | Static knowledge base | **Needs enhancement** |
| `components/ai/*.tsx` | Frontend components | Works correctly |
| `services/chat.service.ts` | Firebase chat operations | Works correctly |
| `services/event.service.ts` | Event data access | Works correctly |
| `services/seva.service.ts` | Seva data access | Works correctly |
| `services/announcement.service.ts` | Announcement access | Works correctly |
| `services/settings.service.ts` | Settings access | Works correctly |
| `services/donation.service.ts` | Donation data access | Works correctly |
| `types/ai.ts` | AI type definitions | **Needs updates** |

---

## 2. Weaknesses Analysis

### 2.1 Critical Issues

#### 🔴 **HIGH: Hallucination Risk**

**Problem:** The system prompt contains hardcoded temple facts:
- Temple timings (Morning: 6:00 AM – 12:00 PM, Evening: 5:00 PM – 8:30 PM)
- Temple address
- Phone number
- Event information
- Seva descriptions
- Panchanga instructions

**Impact:** LLM may hallucinate incorrect information when:
- Temple timings change for festivals
- Contact information is updated
- New events are added
- Sevas are modified or added

**Evidence from code:**
```typescript
// lib/ai/systemPrompt.ts - Lines 50-54
## Temple Timings
**Morning:** 6:00 AM – 12:00 PM
**Evening:** 5:00 PM – 8:30 PM
Festival timings may vary. Always advise devotees to check the official website...
```

#### 🔴 **HIGH: No Intent Detection**

**Problem:** User queries go directly to LLM without classification.

**Impact:**
- Inconsistent responses
- No structured data retrieval
- Cannot guarantee accuracy for factual queries
- No routing to appropriate data sources

#### 🟠 **MEDIUM: Firebase Fallback Limitations**

**Problem:** `lib/ai/firebaseChat.ts` has hardcoded response templates with some Firebase data.

**Impact:**
- Limited response flexibility
- No confidence scoring
- No source attribution
- Duplicated logic with knowledge base

#### 🟠 **MEDIUM: Out-of-Scope Handling Missing**

**Problem:** No explicit handling for off-topic questions.

**Impact:**
- LLM may respond to unrelated queries
- No consistent deflection messaging
- Potential for misuse

#### 🟡 **LOW: Language Detection Complexity**

**Problem:** Language detection exists but is mixed into response generation.

**Impact:**
- Hard to test in isolation
- No separate intent + language pipeline

### 2.2 Missing Features

1. **Confidence Scoring** - No metadata about response reliability
2. **Source Attribution** - No indication of data origin
3. **Unknown Question Logging** - No tracking of unanswerable questions
4. **Knowledge Repository** - No structured admin-editable knowledge base
5. **Intent Classification** - No routing layer for queries

---

## 3. Hallucination Risk Assessment

| Information Type | Current Source | Hallucination Risk | Mitigation Required |
|-----------------|----------------|-------------------|-------------------|
| Temple Timings | System Prompt (hardcoded) | **HIGH** | Repository retrieval |
| Temple Address | System Prompt (hardcoded) | **HIGH** | Repository retrieval |
| Contact Phone | System Prompt (hardcoded) | **HIGH** | Repository retrieval |
| Contact Email | System Prompt (hardcoded) | **HIGH** | Repository retrieval |
| Upcoming Events | Firebase (dynamic) | LOW | Already good |
| Sevas | Firebase (dynamic) | LOW | Already good |
| Announcements | Firebase (dynamic) | LOW | Already good |
| Panchanga | External file (dynamic) | LOW | Already good |
| Temple History | System Prompt (static) | MEDIUM | Knowledge Base |
| Religious Info | System Prompt (static) | MEDIUM | Knowledge Base |
| FAQs | Knowledge Base (static) | LOW | Already good |

---

## 4. Recommended Improvements

### 4.1 High Priority

1. **Implement Intent Detection Engine**
   - Create `lib/ai/intentDetector.ts`
   - Classify queries before LLM processing
   - Route to appropriate retrieval path

2. **Implement Structured Retrieval**
   - Create `lib/ai/retrieval/` module
   - Settings Repository → Temple timings, contact, address
   - Event Repository → Upcoming events
   - Announcement Repository → Current announcements
   - Seva Repository → Available sevas
   - Donation Repository → Donation options
   - Panchanga Service → Daily panchanga

3. **Refactor System Prompt**
   - Remove all hardcoded temple facts
   - Keep only: Identity, Tone, Safety, Formatting, Restrictions
   - Add context injection from structured retrieval

4. **Create Knowledge Repository**
   - Structured articles with categories
   - Admin-editable via Firebase
   - Keywords for matching
   - Approval workflow

### 4.2 Medium Priority

5. **Implement Hybrid Response Generator**
   - Structured data + LLM = Natural response
   - Never fabricate missing values
   - Graceful degradation when data unavailable

6. **Add Confidence & Source Metadata**
   - Internal confidence scores (0-100)
   - Source attribution (Repository, Knowledge, LLM)
   - Retrieval type (structured, semantic, fallback)

7. **Create Unknown Question Logger**
   - Store: question, timestamp, session, intent, confidence, language
   - Admin review dashboard
   - Periodic knowledge base updates

8. **Implement Out-of-Scope Handler**
   - Polite deflection for unrelated queries
   - Clear scope definition
   - Helpful redirects to temple topics

### 4.3 Low Priority

9. **Enhance Kannada Support**
   - Unified language detection
   - Intent detection in both languages
   - Mixed language query handling

10. **Add Comprehensive Testing**
    - Unit tests for intent detection
    - Integration tests for retrieval
    - E2E tests for common queries

---

## 5. Migration Plan

### Phase 1: Foundation (Current)
- [x] Codebase audit
- [ ] Create this audit document

### Phase 2: Intent Detection
- [ ] Create intent types enum
- [ ] Implement keyword-based classifier
- [ ] Add LLM-based classifier for ambiguous cases
- [ ] Test intent detection accuracy

### Phase 3: Structured Retrieval
- [ ] Create Settings Retrieval
- [ ] Create Event Retrieval
- [ ] Create Announcement Retrieval
- [ ] Create Seva Retrieval
- [ ] Create Donation Retrieval
- [ ] Integrate Panchanga Service

### Phase 4: Knowledge Repository
- [ ] Define Knowledge Article schema
- [ ] Create Knowledge Retrieval service
- [ ] Seed with initial articles
- [ ] Create admin CRUD for knowledge

### Phase 5: Hybrid Response
- [ ] Refactor response generation
- [ ] Inject structured context
- [ ] Add confidence scoring
- [ ] Add source attribution

### Phase 6: Safety & Logging
- [ ] Implement out-of-scope handler
- [ ] Create unknown question logger
- [ ] Build admin review interface

### Phase 7: Prompt Refactor
- [ ] Remove hardcoded facts from system prompt
- [ ] Update identity definition
- [ ] Add safety guidelines

### Phase 8: Testing & Documentation
- [ ] Write comprehensive tests
- [ ] Update documentation
- [ ] Verify all checks pass

---

## 6. Success Criteria

After refactoring, the system should:

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Hallucination Rate | 0% for temple facts | All temple facts from repositories |
| Intent Classification | >95% accuracy | Test suite |
| Response Latency | <2s average | Monitoring |
| Unknown Question Capture | 100% of failures | Logging system |
| Test Coverage | >90% for chatbot | Code coverage tool |
| Build Success | 100% | CI/CD pipeline |

---

## 7. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing functionality | Medium | High | Comprehensive regression testing |
| Performance degradation | Low | Medium | Caching and optimization |
| Data inconsistency | Low | High | Single source of truth |
| Test coverage gaps | Medium | Medium | Incremental test writing |

---

## 8. Appendix

### A. Firebase Collections Schema

```typescript
// settings collection
interface SiteSettings {
  templeName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  footerText?: string;
  welcomeMessage?: string;
}

// events collection
interface TempleEvent {
  title: string;
  description: string;
  startDate: Timestamp;
  endDate: Timestamp;
  featured: boolean;
  published: boolean;
}

// sevas collection
interface Seva {
  name: string;
  description: string;
  category: string;
  amount: number;
  active: boolean;
}

// announcements collection
interface Announcement {
  title: string;
  message: string;
  isActive: boolean;
}
```

### B. Existing Services

| Service | Location | Methods |
|---------|----------|---------|
| Settings | services/settings.service.ts | getSettings, createSettings, updateSettings |
| Events | services/event.service.ts | getEvents, getPublishedEvents, getUpcomingEvents |
| Sevas | services/seva.service.ts | getAllSevas, getSevaById |
| Announcements | services/announcement.service.ts | getAnnouncements, getActiveAnnouncements |
| Donations | services/donation.service.ts | createDonation, getDonations |
| Aaradhane | services/aaradhane.service.ts | getAaradhanes, getUpcoming |
| Chat | services/chat.service.ts | createChatSession, saveMessage, getSessionMessages |

### C. Panchanga Data Location

- **Path:** `public/data/panchanga/{year}/{year}-{month}-{day}.json`
- **Format:** `{ tithi, nakshatra, yoga, karana, sunrise, sunset }`
- **Service:** `lib/panchanga-cache.ts`

---

*Document generated as part of Raya AI refactoring project.*
*Next step: Proceed to Phase 2 - Intent Detection Implementation*
