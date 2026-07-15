// Intent Detection Engine for Raya AI
// Classifies user queries into intents before LLM processing

import {
  Intent,
  IntentCategory,
  IntentDetectionResult,
  RetrievalType,
} from "./types";
import {
  INTENT_PATTERNS,
  OUT_OF_SCOPE_PATTERNS,
  OUT_OF_SCOPE_KEYWORDS,
  containsKannada,
  normalizeText,
} from "./patterns";

export class IntentDetector {
  private minConfidence: number;
  private maxKeywords: number;

  constructor(minConfidence = 20, maxKeywords = 10) {
    this.minConfidence = minConfidence;
    this.maxKeywords = maxKeywords;
  }

  /**
   * Detect intent from user message
   */
  detect(message: string): IntentDetectionResult {
    const normalizedMessage = normalizeText(message);
    const hasKannada = containsKannada(message);
    
    // Sort patterns by priority (higher first)
    const sortedPatterns = [...INTENT_PATTERNS].sort(
      (a, b) => b.priority - a.priority
    );

    // Try to match patterns
    let bestMatch: IntentDetectionResult | null = null;
    let highestScore = 0;

    for (const pattern of sortedPatterns) {
      const result = this.matchPattern(pattern, normalizedMessage, hasKannada);
      
      if (result && result.confidence > highestScore) {
        highestScore = result.confidence;
        bestMatch = result;
      }
    }

    // Check for out-of-scope first
    if (this.isOutOfScope(normalizedMessage, hasKannada)) {
      return {
        intent: Intent.OUT_OF_SCOPE,
        category: IntentCategory.OUT_OF_SCOPE,
        confidence: 100,
        source: RetrievalType.FALLBACK,
        matchedKeywords: [],
        requiresStructuredData: false,
      };
    }

    // Return best match if confidence is sufficient
    if (bestMatch && bestMatch.confidence >= this.minConfidence) {
      return bestMatch;
    }

    // Low confidence or no match - mark as unknown
    return {
      intent: Intent.UNKNOWN,
      category: IntentCategory.UNKNOWN,
      confidence: bestMatch?.confidence ?? 0,
      source: RetrievalType.LLM,
      matchedKeywords: bestMatch?.matchedKeywords ?? [],
      requiresStructuredData: false,
      fallbackIntent: Intent.FAQ,
    };
  }

  /**
   * Match a single pattern against the message
   */
  private matchPattern(
    pattern: typeof INTENT_PATTERNS[0],
    normalizedMessage: string,
    hasKannada: boolean
  ): IntentDetectionResult | null {
    const matchedKeywords: string[] = [];
    let score = 0;

    // Check English keywords
    for (const keyword of pattern.keywords.en) {
      const normalizedKeyword = normalizeText(keyword);
      if (normalizedMessage.includes(normalizedKeyword)) {
        matchedKeywords.push(keyword);
        score += 20; // Base score per match
      }
    }

    // Check Kannada keywords if message contains Kannada
    if (hasKannada && pattern.keywords.kn) {
      for (const keyword of pattern.keywords.kn) {
        if (normalizedMessage.includes(keyword)) {
          // Avoid duplicates
          if (!matchedKeywords.includes(keyword)) {
            matchedKeywords.push(keyword);
            score += 25; // Slightly higher for Kannada match
          }
        }
      }
    }

    // No matches
    if (matchedKeywords.length === 0) {
      return null;
    }

    // Calculate confidence based on:
    // - Number of keyword matches (up to maxKeywords)
    // - Message length (longer messages = more specific)
    const effectiveMatches = Math.min(matchedKeywords.length, this.maxKeywords);
    const keywordScore = Math.min((effectiveMatches / this.maxKeywords) * 60, 60);
    const contextScore = Math.min(normalizedMessage.length / 100 * 10, 20);
    const baseScore = 20;

    const confidence = Math.min(
      Math.round(baseScore + keywordScore + contextScore),
      95 // Cap at 95 to leave room for uncertainty
    );

    return {
      intent: pattern.intent,
      category: pattern.category,
      confidence,
      source: pattern.requiresStructuredData 
        ? RetrievalType.REPOSITORY 
        : RetrievalType.KNOWLEDGE_BASE,
      matchedKeywords: matchedKeywords.slice(0, this.maxKeywords),
      requiresStructuredData: pattern.requiresStructuredData,
    };
  }

  /**
   * Check if message is out of scope
   */
  private isOutOfScope(normalizedMessage: string, hasKannada: boolean): boolean {
    // Check regex patterns
    for (const pattern of OUT_OF_SCOPE_PATTERNS) {
      if (pattern.test(normalizedMessage)) {
        return true;
      }
    }

    // Check out-of-scope keywords
    for (const keyword of OUT_OF_SCOPE_KEYWORDS.en) {
      if (normalizedMessage.includes(keyword.toLowerCase())) {
        return true;
      }
    }

    // Check Kannada out-of-scope keywords
    if (hasKannada && OUT_OF_SCOPE_KEYWORDS.kn) {
      for (const keyword of OUT_OF_SCOPE_KEYWORDS.kn) {
        if (normalizedMessage.includes(keyword)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Batch detect intents for multiple messages
   */
  detectBatch(messages: string[]): IntentDetectionResult[] {
    return messages.map((msg) => this.detect(msg));
  }

  /**
   * Get all available intents
   */
  getAvailableIntents(): Intent[] {
    return Object.values(Intent);
  }

  /**
   * Get intents by category
   */
  getIntentsByCategory(category: IntentCategory): Intent[] {
    return INTENT_PATTERNS
      .filter((p) => p.category === category)
      .map((p) => p.intent);
  }
}

// Singleton instance for easy use
let detectorInstance: IntentDetector | null = null;

export function getIntentDetector(): IntentDetector {
  if (!detectorInstance) {
    detectorInstance = new IntentDetector();
  }
  return detectorInstance;
}

/**
 * Simple intent detection function
 */
export function detectIntent(message: string): IntentDetectionResult {
  const detector = getIntentDetector();
  return detector.detect(message);
}
