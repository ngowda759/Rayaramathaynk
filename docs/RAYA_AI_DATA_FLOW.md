# Raya AI Data Flow

## 1. Request Handling
Users submit a query to `/api/chat`. The message string, language, and session metadata are passed down.

## 2. Intent Detection
The string is analyzed by `lib/ai/intent/detector.ts`, yielding an `IntentDetectionResult`. The result includes a primary intent enum (`Intent.TEMPLE_TIMINGS`, `Intent.DONATION`, etc.) and a confidence score.

## 3. Data Retrieval
If confidence surpasses the threshold, `lib/ai/retrieval/registry.ts` identifies the required sources using `INTENT_RETRIEVAL_MAP`. It queries:
- **Repositories**: Standard service files retrieving configuration (timings, policies, sevas, panchangas).
- **Knowledge Base**: Fetches detailed articles using RAG methodologies if basic structured data doesn't suffice or is explicitly requested.

## 4. Response Composition
Data obtained (e.g. `TempleSettings`) is passed to `ResponseComposer`. The Composer uses precise types defined in `lib/ai/retrieval/types.ts` to output formatted Markdown or text.

## 5. Security & Analytics
- The generator ensures debug info contains no secrets.
- `logUnknownQuestion` asynchronously logs low-confidence queries for further manual triage without disrupting the user flow.
