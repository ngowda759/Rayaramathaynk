// Hybrid AI Response Generator
// Orchestrates intent detection, retrieval, and response composition

import { Intent, IntentDetectionResult, RetrievalType, detectIntent } from "./intent";
import { retrieve } from "./retrieval/registry";
import { responseComposer } from "./response/composer";
import { containsKannada } from "./intent/patterns";
import { looksRomanizedKannada } from "./intent/transliteration";
import { aiSettingsService } from "@/lib/ai/ai-settings";

export { detectIntent } from "./intent";

// Confidence threshold for triggering FAQ fallback
const LOW_CONFIDENCE_THRESHOLD = 60;
export { LOW_CONFIDENCE_THRESHOLD };

export interface AIResponseResult {
  content: string;
  intent: Intent;
  confidence: number;
  source: RetrievalType;
  usesLLM: boolean;
  language: "en" | "kn" | "mixed";
  debugInfo?: Record<string, unknown>;
}

/**
 * Detect language from message.
 *
 * Romanized Kannada ("Temple volunteer aagbekadre enu madbeku?") has no Kannada
 * codepoints, so `containsKannada` alone reports it as English. That made the
 * assistant reply in English to a user who wrote Kannada. Messages that are
 * Latin script but contain Kannada-like words are reported as "mixed".
 */
function detectLanguage(message: string): "en" | "kn" | "mixed" {
  const hasKannada = containsKannada(message);

  if (hasKannada) {
    // Any ASCII word alongside Kannada script means the message is mixed. Testing
    // only a fixed word list missed domain nouns ("Temple timings ಏನು?").
    const asciiWords = message.match(/\b[a-zA-Z]{2,}\b/g);

    if (asciiWords && asciiWords.length > 0) {
      return "mixed";
    }
    return "kn";
  }

  if (looksRomanizedKannada(message)) {
    return "mixed";
  }

  return "en";
}

/**
 * Main response generator
 */
export async function generateResponse(
  message: string,
  sessionId?: string
): Promise<AIResponseResult> {
  const language = detectLanguage(message);
  const intentResult = detectIntent(message);
  
  console.log(`[AI Generator] Detected intent: ${intentResult.intent} (${intentResult.confidence}%)`);

  const settings = await aiSettingsService.getAISettings();
  const behavior = settings.extendedBehavior;
  const safety = settings.safety;

  const respondUnknown = async (): Promise<AIResponseResult> => {
    console.log(`[AI Generator] Low confidence (${intentResult.confidence}%), redirecting to FAQ`);

    // Log unknown question safely (Supabase-only; never blocks the response).
    if (behavior.enableUnknownQuestionLogging) {
      try {
        await aiSettingsService.logUnknownQuestion(
          message,
          intentResult.intent,
          intentResult.confidence,
          language,
          sessionId || "anonymous"
        );
      } catch (error) {
        console.error("[AI Generator] Failed to log unknown question (analytics non-blocking):", error);
      }
    }

    return {
      content: settings.aiResponses.unknownQuestion,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      source: RetrievalType.FALLBACK,
      usesLLM: false,
      language,
    };
  };

  // Conversational intents never consult a repository; answer them directly.
  if (intentResult.intent === Intent.GENERAL_GREETING) {
      return {
          content: settings.aiResponses.welcome,
          intent: intentResult.intent,
          confidence: 100,
          source: RetrievalType.KNOWLEDGE_BASE,
          usesLLM: false,
          language
      };
  } else if (intentResult.intent === Intent.THANKS || intentResult.intent === Intent.GOODBYE) {
      return {
          content: settings.aiResponses.goodbye,
          intent: intentResult.intent,
          confidence: 100,
          source: RetrievalType.KNOWLEDGE_BASE,
          usesLLM: false,
          language
      };
  } else if (intentResult.intent === Intent.OUT_OF_SCOPE) {
      return {
          content: settings.aiResponses.outOfScope,
          intent: intentResult.intent,
          confidence: 100,
          source: RetrievalType.FALLBACK,
          usesLLM: false,
          language
      };
  }

  // 1. Authoritative retrieval happens before the confidence gate: keyword and
  // hybrid intent confidence legitimately lands in the 55-75 band, so a real
  // repository answer must not be discarded merely because the classification
  // score is mid-range. The composer applies the same source-aware policy.
  // Intents that do not require structured data (FAQ, knowledge, unknown) keep
  // the plain confidence gate and skip retrieval entirely.
  if (intentResult.confidence < LOW_CONFIDENCE_THRESHOLD && !intentResult.requiresStructuredData) {
    return await respondUnknown();
  }

  const retrievalResult = await retrieve(intentResult.intent, message);

  const hasAuthoritativeSource =
    retrievalResult.source !== RetrievalType.FALLBACK &&
    (Object.keys(retrievalResult.data ?? {}).length > 0 || (retrievalResult.knowledgeArticles?.length ?? 0) > 0);

  if (intentResult.confidence < LOW_CONFIDENCE_THRESHOLD && !hasAuthoritativeSource) {
    return await respondUnknown();
  }

  // 2. Enforce Retrieval-First Safety
  const requiresSource = safety.requireSourceForFacts;

  if (requiresSource && !hasAuthoritativeSource) {
     console.log(`[AI Generator] Enforcing safety: No authoritative source found for ${intentResult.intent}`);
     return {
         content: settings.aiResponses.unknownQuestion,
         intent: intentResult.intent,
         confidence: intentResult.confidence,
         source: RetrievalType.FALLBACK,
         usesLLM: false,
         language
     };
  }

  // 3. Compose Response
  const composerOutput = await responseComposer.compose({
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      language,
      retrievalResult
  });

  // Enforce LLM limits
  if (!safety.allowLLMOnlyResponse && composerOutput.usesLLM && !hasAuthoritativeSource) {
      console.log(`[AI Generator] Enforcing safety: LLM-only response blocked by settings`);
      return {
          content: settings.aiResponses.unknownQuestion,
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          source: RetrievalType.FALLBACK,
          usesLLM: false,
          language
      };
  }

  // Clean debug info
  if (composerOutput.debugInfo) {
      // Create a shallow copy just to be safe
      const cleanDebugInfo = { ...composerOutput.debugInfo };
      // Delete any potential secrets if they accidentally get in
      delete cleanDebugInfo.keys;
      delete cleanDebugInfo.tokens;
      delete cleanDebugInfo.credentials;
      delete cleanDebugInfo.auth;
      composerOutput.debugInfo = cleanDebugInfo;
  }

  return composerOutput;
}

export function getResponseMetadata(result: any, messageLanguage: string): Record<string, unknown> {
  return {
    intent: result?.intent,
    confidence: result?.confidence,
    source: result?.source,
    usesLLM: result?.usesLLM,
    language: messageLanguage,
  };
}
