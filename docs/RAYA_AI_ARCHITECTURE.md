# Raya AI Architecture

## Overview
The Raya AI chatbot implements a structured, hybrid architecture focusing on safety, deterministic responses, and type safety for temple information.

```text
Chat API (/api/chat)
   ↓
Conversation / Session Context
   ↓
Intent Engine (Intent Detection & Mapping)
   ↓
Retrieval Registry (Data Retrieval)
   ↓
Response Composer (Data formatting and final string creation)
   ↓
Safety / Fallback Enforcement (No LLM hallucinations)
   ↓
Response (Sent back to user)
   ↓
Analytics (Asynchronous logging of metrics)
```

## Key Modules

### Intent Engine
Detects intents using a combination of keyword and semantic matching, prioritizing temple-specific queries (Timings, Sevas, Donations). Handles Kannada, English, and transliterated queries.

### Retrieval Registry
Maps specific intents to authoritative data sources (e.g., `settings`, `events`, `donations`).

### Response Composer
Responsible for taking retrieved data (which matches strictly typed definitions such as `TempleSettings` and `DonationInfo`) and formatting it into localized responses.

### Safety Defaults
- **retrievalRequired**: `true` (Factual queries must be backed by retrieved structured data).
- **allowLLMOnlyResponse**: `false` (Unsafe, unverified LLM fallback is strictly disabled to prevent hallucination of facts like seva prices and donation numbers).

## Database Layers
The architecture interacts with backend services through defined repositories.
- **Firebase Status**: The transition from Firebase to Supabase PostgreSQL is in progress. Currently, `lib/ai/knowledge/repository.ts` still connects to Firestore for knowledge articles. Wait for the comprehensive migration before removing this.
- **AI Settings**: Fully integrated and secured through verified `admin` endpoints (via `verifyAdminUser`).
