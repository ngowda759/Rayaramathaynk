# Raya AI Assistant Documentation

## Overview

Raya AI is the custom-built AI assistant for Sri Raghavendra Swamy Math, Yelahanka. It replaces the previous Chatbase integration with a fully owned, customizable solution.

## Implementation Milestones

### Milestone 1: Remove Chatbase & Build Chat UI
- Removed all Chatbase-related code
- Built ChatGPT-style floating chat widget
- Implemented AI provider abstraction (OpenAI, Gemini, Claude, OpenRouter)
- Created system prompt and knowledge base

### Milestone 2: Firebase Integration & Sessions
- Integrated Firebase Firestore for message storage
- Added chat session management
- Support for anonymous and authenticated users
- Session history tracking

### Milestone 3: Temple Knowledge & Actions
- Added testimonial submission API
- Added volunteer request API
- Updated system prompt for special flows
- Donation information handling

### Milestone 4: Admin Dashboard & Analytics
- Admin dashboard at /admin/ai
- Testimonials management at /admin/ai/testimonials
- Volunteer requests at /admin/ai/volunteers
- Analytics at /admin/ai/analytics

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ FloatingBtn  │  │ ChatWindow   │  │ AIChatProvider       │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│         │                 │                      │               │
│         └─────────────────┼──────────────────────┘               │
│                           │                                      │
│  ┌────────────────────────▼────────────────────────────────┐   │
│  │                   API Route (/api/chat)                    │   │
│  └───────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                   AI Provider Layer                         │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │   │
│  │  │ OpenAI  │ │ Gemini  │ │ Claude  │ │OpenRouter│         │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              Knowledge Base / System Prompt                │   │
│  └───────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Firebase                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │chat_sessions │  │  messages    │  │    testimonials     │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │volunteer_req │  │   feedback   │  │                     │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Environment Variables

### Required
```env
# AI Provider Configuration
AI_PROVIDER=openai  # Options: openai, gemini, claude, openrouter

# OpenAI (if AI_PROVIDER=openai)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Gemini (if AI_PROVIDER=gemini)
GOOGLE_GENERATIVE_API_KEY=...
GEMINI_MODEL=gemini-1.5-flash

# Claude (if AI_PROVIDER=claude)
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-3-haiku-20240307

# OpenRouter (if AI_PROVIDER=openrouter)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o-mini
```

## Firestore Schema

### chat_sessions
```typescript
{
  id: string;
  userId: string | null;  // Firebase UID or null for anonymous
  createdAt: Timestamp;
  updatedAt: Timestamp;
  messageCount: number;
  lastMessage: string;  // Last 100 chars for preview
}
```

### messages
```typescript
{
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  model?: string;
  latency?: number;
}
```

### testimonials
```typescript
{
  id: string;
  sessionId: string;
  name: string;
  city: string;
  experience: string;
  rating: number;
  permissionToPublish: boolean;
  approved: boolean;
  createdAt: Timestamp;
}
```

### volunteer_requests
```typescript
{
  id: string;
  sessionId: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  preferredDate?: string;
  status: "pending" | "contacted" | "completed";
  createdAt: Timestamp;
}
```

### feedback
```typescript
{
  id: string;
  sessionId: string;
  messageId: string;
  rating: "helpful" | "not_helpful";
  comment?: string;
  createdAt: Timestamp;
}
```

## API Endpoints

### POST /api/chat
Send a message and receive AI response.

**Request:**
```json
{
  "messages": [
    { "id": "1", "role": "user", "content": "Hello", "timestamp": 1234567890 }
  ],
  "sessionId": "optional-session-id",
  "userId": "optional-firebase-uid"
}
```

**Response:**
```json
{
  "message": {
    "id": "2",
    "role": "assistant",
    "content": "Hello! How can I help you?",
    "timestamp": 1234567891,
    "model": "gpt-4o-mini",
    "latency": 1234
  },
  "sessionId": "generated-or-provided-session-id"
}
```

### GET /api/chat
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "provider": "OpenAI",
  "configured": true,
  "timestamp": 1234567890
}
```

## Switching AI Providers

1. Update `AI_PROVIDER` in environment variables
2. Add the corresponding API key
3. The application will automatically use the correct provider

## Component Structure

```
components/ai/
├── index.ts                 # Exports all components
├── AIChatProvider.tsx       # Context provider for chat state
├── ChatWidget.tsx          # Main widget combining button + window
├── FloatingButton.tsx      # Floating action button
├── ChatWindow.tsx          # Main chat interface
├── MessageBubble.tsx       # Individual message display
├── TypingIndicator.tsx     # Loading animation
├── ChatInput.tsx           # Message input field
├── SuggestedQuestions.tsx  # Quick question chips
└── MarkdownRenderer.tsx    # Markdown content renderer
```

## Features

- [x] Floating chat button (bottom-right)
- [x] Mobile responsive design
- [x] Smooth animations (framer-motion compatible)
- [x] Minimize/Maximize chat window
- [x] Auto-scroll to new messages
- [x] Markdown support
- [x] Typing indicator
- [x] Loading animation
- [x] Copy message functionality
- [x] Regenerate response
- [x] Clear conversation
- [x] Welcome screen
- [x] Suggested questions
- [x] Anonymous user sessions
- [x] Firebase integration
- [x] Multiple AI provider support

## Future Improvements

1. **RAG Integration**: Implement Retrieval-Augmented Generation using temple knowledge base
2. **Voice Input**: Add speech-to-text for accessibility
3. **Multi-language Support**: Hindi, Kannada translations
4. **Analytics Dashboard**: Track conversation patterns and satisfaction
5. **Admin Controls**: Manage AI behavior and knowledge base
6. **Caching**: Redis/memory caching for frequently asked questions
7. **Rate Limiting**: Per-user rate limiting
8. **Webhook Integration**: Connect with temple management system

## Security Considerations

1. API keys stored in environment variables (never in code)
2. Rate limiting on API endpoints
3. Input sanitization
4. Content Security Policy updated (Chatbase domains removed)
5. User sessions tracked for abuse prevention

## Deployment

1. Set environment variables on hosting platform
2. Configure Firebase rules for chat collections
3. Deploy to Vercel or similar platform
4. Monitor API usage and costs
