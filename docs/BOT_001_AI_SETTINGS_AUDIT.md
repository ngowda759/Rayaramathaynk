# BOT-001: AI Settings Audit

## Overview
This document outlines the findings of the AI settings audit. The application currently relies on a single Firestore document `ai_settings/main` for AI configuration. The objective is to migrate this functionality to Supabase.

## Findings

### General Settings (`AIGeneralSettings`)
*   `enabled`: REQUIRED - Controls if the bot responds.
*   `botName`: REQUIRED - Identity of the assistant.
*   `botSubtitle`: REQUIRED - UI description.
*   `welcomeMessage`: REQUIRED - Initial message shown to users.
*   `closingMessage`: REQUIRED - Final message on conversation end.
*   `defaultLanguage`: REQUIRED - Fallback language ('en').
*   `supportedLanguages`: REQUIRED - List of valid languages (e.g., ['en', 'kn', 'mixed']).

### Safety Settings (`AISafetySettings`)
*   `retrievalRequired`: REQUIRED - Guards against hallucinations.
*   `allowLLMOnlyResponse`: REQUIRED - Can answer without context.
*   `requireSourceForFacts`: REQUIRED - Citation enforcement.
*   `unknownQuestionBehaviour`: REQUIRED - Defines action for unanswerable questions.
*   `outOfScopeBehaviour`: REQUIRED - Defines action for off-topic questions.

### Extended Behavior Settings (`AIExtendedBehaviorSettings`)
*   `confidenceThreshold`: REQUIRED - Minimum confidence for intent match.
*   `semanticThreshold`: REQUIRED - Minimum semantic similarity score.
*   `maxRelatedArticles`: REQUIRED - Number of KB articles to retrieve.
*   `conversationTimeout`: REQUIRED - Session timeout in minutes.
*   `streaming`: REQUIRED - Enable streaming responses.
*   `debugMode`: REQUIRED - Extra logging for administrators.
*   `unknownLogging`: REQUIRED - Log unknown questions.
*   `enableFollowUpContext`: REQUIRED - Remember previous turns.
*   `enableSuggestedQuestions`: REQUIRED - Show clickable suggestions.
*   `enableAnalytics`: REQUIRED - Log telemetry.
*   `enableUnknownQuestionLogging`: REQUIRED - Store unknown questions.
*   `maxKnowledgeResults`: REQUIRED - Max KB results.

### Temple Information (`TempleInformation`)
*   `timings` (`morningOpen`, `morningClose`, `eveningOpen`, `eveningClose`): REQUIRED - Critical facts.
*   `contact` (`phone`, `email`, `address`, `googleMapsUrl`): REQUIRED - Support avenues.
*   `officeHours` (`weekday`, `weekend`, `notes`): REQUIRED - Administrative info.

### Visitor Information (`VisitorInformation`)
*   `guidelines`: REQUIRED
*   `dressCode`: REQUIRED
*   `photographyPolicy`: REQUIRED
*   `parking`: REQUIRED
*   `facilities`: REQUIRED
*   `wheelchairAccess`: REQUIRED
*   `drinkingWater`: REQUIRED
*   `restrooms`: REQUIRED
*   `prasada`: REQUIRED
*   `annadanam`: REQUIRED
*   `accommodation`: REQUIRED
*   `volunteerInfo`: REQUIRED
*   `testimonials`: REQUIRED
*   `contact`: REQUIRED

### Temple Policies (`TemplePolicies`)
*   `donations`: REQUIRED
*   `information80G`: REQUIRED
*   `sevaBooking`: REQUIRED
*   `onlineServices`: REQUIRED
*   `childrenPolicy`: REQUIRED
*   `queueGuidelines`: REQUIRED

### AI Responses (`AIResponses`)
*   `greeting`: REQUIRED
*   `welcome`: REQUIRED
*   `fallback`: REQUIRED
*   `unknownQuestion`: REQUIRED
*   `outOfScope`: REQUIRED
*   `goodbye`: REQUIRED

### Prompt Configuration (`PromptSettings`)
*   `currentPromptId`: REQUIRED
*   `versions`: REQUIRED - Array of PromptVersion objects.
*   `defaultPrompt`: CODE_DEFAULT - Needs to become a DB record.

### Intent Configuration (`IntentSettings`)
*   `intents`: REQUIRED - Array of IntentMetadata objects. Includes intent matching rules.

## Dependencies to Remove
*   `lib/ai/ai-settings/repository.ts`: Direct Firestore `getFirestore()` calls.
*   `lib/ai/ai-settings/admin-repository.ts`: Direct `getAdminFirestore()` calls.
*   `app/api/seed-ai-settings/route.ts`: API using Firebase to seed settings.

## Summary
The migration involves replacing a complex nested JSON document in Firestore with a structured PostgreSQL representation in Supabase. The `ai_settings` table should likely contain the simple properties and use JSONB for the complex, deeply nested objects like `intents` and `prompt_versions`, or separate them into relational tables if they require individual querying/versioning. Given the prompt states "Prefer a strongly structured top-level model while retaining JSONB for configuration sections that naturally evolve", a single row table `ai_settings` with JSONB columns for the nested objects is the best fit.
