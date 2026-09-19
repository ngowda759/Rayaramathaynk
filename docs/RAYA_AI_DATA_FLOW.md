# Raya AI Data Flow

This document details how data moves through the Raya AI architecture, ensuring safety, accuracy, and performance.

## 1. Chat Initialization
1. User opens the chat widget.
2. The UI checks the \`GeneralSettings.enabled\` flag.
3. The UI displays the \`welcomeMessage\`.

## 2. Message Submission
1. The user sends a message.
2. The UI sends a POST request to \`/api/chat\`.
3. The API invokes \`generateResponse(message, sessionId)\` in \`lib/ai/generator.ts\`.

## 3. Orchestration (\`lib/ai/generator.ts\`)
1. **Language Detection**: Determines if the message is English, Kannada, or Mixed.
2. **Intent Detection**: The \`detectIntent\` engine matches keywords and evaluates semantic similarities to classify the intent (e.g., \`TEMPLE_TIMINGS\`).
3. **Safety Check**: Checks the intent confidence against \`BehaviorSettings.confidenceThreshold\`. If it's too low, the query is routed to the Fallback/Unknown Question flow.
4. **Retrieval**: If confidence is high enough, \`retrieve(intent, query)\` is called.

## 4. Retrieval (\`lib/ai/retrieval/registry.ts\`)
1. The Registry maps the intent to a specific structured data repository (e.g., the \`getTempleSettings()\` function).
2. It fetches the authoritative facts from the database.
3. If no structured data is found, or if the intent is heavily textual (like \`TEMPLE_HISTORY\`), it queries the Knowledge Base (\`searchArticles\`).
4. Returns a \`RetrievalResult\` payload containing the raw structured data and source attribution.

## 5. Composition (\`lib/ai/response/composer.ts\`)
1. Receives the \`RetrievalResult\` and the detected \`intent\`.
2. Uses strict mapping functions to format the structured data into human-readable strings (English or Kannada).
3. If \`SafetySettings.allowLLMOnlyResponse\` is true (not recommended), it may format the data via an LLM. Otherwise, it uses deterministic templating.
4. Returns the final \`ComposerOutput\`.

## 6. Analytics & Logging
1. The orchestrator takes the \`ComposerOutput\` and returns it to the API layer.
2. Background tasks log the interaction (intent detected, confidence score, source used, latency) to the Analytics repository.
3. If the query hit a fallback, it is logged to the \`Unknown Questions\` repository for admin review.
