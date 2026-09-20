// Hybrid AI Response Generator
// Orchestrates intent detection, retrieval, and response composition

import { Intent, IntentDetectionResult, RetrievalType, detectIntent } from "./intent";
import { retrieve } from "./retrieval/registry";
import { responseComposer } from "./response/composer";
import { containsKannada } from "./intent/patterns";
import { logUnknownQuestion } from "@/services/analytics.service";
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
 * Detect language from message
 */
function detectLanguage(message: string): "en" | "kn" | "mixed" {
  const hasKannada = containsKannada(message);
  
  if (hasKannada) {
    const englishPattern = /\b(the|is|are|what|when|how|where|temple|seva|donation)\b/gi;
    const englishMatches = message.match(englishPattern);
    
    if (englishMatches && englishMatches.length > 2) {
      return "mixed";
    }
    return "kn";
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

  // 1. Check for low confidence / unknown questions
  if (intentResult.confidence < LOW_CONFIDENCE_THRESHOLD && 
      intentResult.intent !== Intent.OUT_OF_SCOPE &&
      intentResult.intent !== Intent.GENERAL_GREETING &&
      intentResult.intent !== Intent.THANKS &&
      intentResult.intent !== Intent.GOODBYE) {

    console.log(`[AI Generator] Low confidence (${intentResult.confidence}%), redirecting to FAQ`);
    
    // Log unknown question safely
    if (behavior.enableUnknownQuestionLogging) {
       try {
         await logUnknownQuestion({
           question: message,
           detectedIntent: intentResult.intent,
           confidence: intentResult.confidence,
           sessionId,
           language,
         });
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
  }

  // Handle conversational intents separately if needed (greetings, thanks)
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


  // 2. Perform Authoritative Retrieval
  const retrievalResult = await retrieve(intentResult.intent, message);

  // Enforce Retrieval-First Safety
  const requiresSource = safety.requireSourceForFacts;
  const hasAuthoritativeSource =
    retrievalResult.source !== RetrievalType.FALLBACK &&
    (Object.keys(retrievalResult.data).length > 0 || retrievalResult.knowledgeArticles?.length);

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
  // Enforce authoritative retrieval safety rules
  if (safety.requireSourceForFacts && retrievalResult.authority === "FALLBACK") {
      console.log(`[AI Generator] Factual query requires source, but only fallback available. Applying safety constraints.`);
      return {
          content: settings.aiResponses.unknownQuestion,
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          source: RetrievalType.FALLBACK,
          usesLLM: false,
          language
      };
  }

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
