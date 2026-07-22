// Intent Detection Engine for Raya AI
// Classifies user queries into intents using keyword + semantic matching

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
import { 
  transliterateToKannada, 
  enhanceWithTransliteration,
  ROMANIZED_KANNADA_PHRASES 
} from "./transliteration";

// Import ML service for semantic matching and fuzzy correction
import {
  calculateIntentSimilarity,
  autoCorrectMessage,
  getCorrectedIntent,
  getBestSemanticMatch,
  type SemanticMatch
} from "@/services/ml.service";

// Intent examples for semantic matching (paraphrases)
const INTENT_EXAMPLES: Record<Intent, string[]> = {
  [Intent.TEMPLE_TIMINGS]: [
    "when does temple open", "when does temple close", "temple timings",
    "what time is the temple open", "morning schedule", "evening schedule",
    "what are the temple timings", "opening hours", "closing time", "temple open",
    "i want to visit tomorrow", "is the matha open now", "when can i have darshana",
    "ಮಠ ಯಾವಾಗ ತೆರೆಯಲು", "ಸಮಯ ಏನು", "ಬೆಳಗಿನ ಸಮಯ", "ಸಂಜೆ ಮುಚ್ಚುವ ಸಮಯ"
  ],
  [Intent.CONTACT_INFORMATION]: [
    "phone number", "contact details", "how to reach", "email address",
    "call temple", "ಫೋನ್ ನಂಬರ", "ಸಂಪರ್ಕ ಏರಿಸಿ"
  ],
  [Intent.LOCATION]: [
    "where is temple", "temple address", "how to get there", "directions",
    "nearest station", "ಠಾಣೆ ಎಲ್ಲಿದೆ", "ವಿಳಾಸ"
  ],
  [Intent.ADDRESS]: [
    "address", "full address", "temple address", "ವಿಳಾಸ"
  ],
  [Intent.UPCOMING_EVENTS]: [
    "any events", "festivals", "what events are coming", "special occasions",
    "ಉತ್ಸವ ಯಾವಾಗ", "ಕಾರ್ಯಕ್ರಮ"
  ],
  [Intent.NEXT_AARADHANE]: [
    "aaradhane", "aradhana", "annual festival", "swamy festival",
    "ಆರಾಧನಾ", "ಮಹೋತ್ಸವ"
  ],
  [Intent.FESTIVAL_INFO]: [
    "festival", "festivals", "celebration", "ಉತ್ಸವ"
  ],
  [Intent.DAILY_QUOTE]: [
    "today's quote", "quote of the day", "daily quote", "give me today's quote",
    "devotional quote", "spiritual quote", "rayaru quote", "guru quote",
    "verse for today", "today's verse", "daily verse", "today's blessing",
    "bless me rayaru", "today's prayer", "daily prayer", "daily inspiration",
    "raghavendra quote", "mangalashtakam", "another quote", "one more quote",
    "next verse", "different quote", "give me a sloka",
    "ಇಂದಿನ ಸಂದೇಶ", "ಇಂದಿನ ಶ್ಲೋಕ", "ಇಂದಿನ ಉಲ್ಲೇಖ",
    "ರಾಯರ ಸಂದೇಶ", "ರಾಯರ ವಾಕ್ಯ", "ಗುರು ಸಂದೇಶ",
    "ಇಂದಿನ ಆಶೀರ್ವಾದ", "ಇಂದಿನ ಪ್ರಾರ್ಥನೆ",
    "ರಾಯರ ಶ್ಲೋಕ", "ಮತ್ತೊಂದು ಉಲ್ಲೇಖ", "ಇನ್ನೊಂದು ಶ್ಲೋಕ"
  ],
  [Intent.SPECIAL_SEVAS]: [
    "what sevas are available", "special sevas", "how to book a seva",
    "seva charges", "seva prices", "different sevas",
    "ಸೇವೆಗಳು", "ವಿಶೇಷ ಸೇವೆಗಳು", "ಸೇವೆ ಬೆಲೆ"
  ],
  [Intent.DAILY_POOJA]: [
    "daily poojas", "morning pooja", "evening aarti", "pooja time",
    "daily puja", "morning puja", "when is pooja", "pooja schedule",
    "ದೈನಿಕ ಪೂಜೆ", "ಪೂಜೆ ಸಮಯ", "ಬೆಳಗಿನ ಪೂಜೆ"
  ],
  [Intent.SEVA_BOOKING]: [
    "book seva", "booking", "reserve", "schedule", "ಸೇವೆ ಬುಕಿಂಗ್"
  ],
  [Intent.DONATION]: [
    "donate", "donation", "contribute", "support temple", "ದೇಣ ಮಾಡಬೇಕು"
  ],
  [Intent.DONATION_PURPOSE]: [
    "donation purpose", "where does money go", "donation uses"
  ],
  [Intent.DONATION_80G]: [
    "80g", "tax benefit", "tax deduction", "tax receipt"
  ],
  [Intent.BOOKING]: [
    "book", "booking", "reserve", "appointment"
  ],
  [Intent.ANNOUNCEMENTS]: [
    "announcement", "notice", "important update", "ಘೋಷಣೆ"
  ],
  [Intent.PANCHANGA]: [
    "panchanga", "today's tithi", "nakshatra", "rahu kalam",
    "ಇಂದು ಯಾವ ತಿಥಿ", "ನಕ್ಷತ್ರ"
  ],
  [Intent.TEMPLE_HISTORY]: [
    "history of temple", "when was temple built", "about matha",
    "ಮಠದ ಇತಿಹಾಸ"
  ],
  [Intent.SRI_RAGHAVENDRA]: [
    "raghavendra swamiji", "about swamiji", "swamy life",
    "ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ"
  ],
  [Intent.MADHWA_PHILOSOPHY]: [
    "madhwa philosophy", "dvaita vedanta", "madhvacharya", "ಮಾಧ್ವ ತತ್ವ"
  ],
  [Intent.GURU_PARAMPARA]: [
    "guru parampara", "guru lineage", "spiritual lineage", "ಗುರು ಪರಂಪರೆ"
  ],
  [Intent.BRINDAVANA]: [
    "brindavana", "brindavan", "samadhi", "ಬೃಂದಾವನ"
  ],
  [Intent.MANTRALAYA]: [
    "mantralaya", "mantralaya location", "where is mantralaya"
  ],
  [Intent.VISITOR_GUIDELINES]: [
    "rules", "guidelines", "what to wear", "dress code", "ಉಡುಗೆ ಏನು"
  ],
  [Intent.DRESS_CODE]: [
    "dress code", "what to wear", "wear", "clothing", "dress"
  ],
  [Intent.GALLERY]: [
    "gallery", "photos", "images", "see photos", "photo gallery",
    "picture gallery", "browse gallery", "view images"
  ],
  [Intent.PHOTOGRAPHY]: [
    "photography", "photo", "camera", "can i take pictures"
  ],
  [Intent.PARKING]: [
    "parking", "where to park", "car parking", "vehicle parking",
    "is there parking", "parking facility", "bike parking",
    "ಪಾರ್ಕಿಂಗ್", "ಕಾರು ಪಾರ್ಕ್"
  ],
  [Intent.SHARE_EXPERIENCE]: [
    "share experience", "share my experience", "write testimonial",
    "tell my experience", "submit testimonial", "my review"
  ],
  [Intent.COMMITTEE]: [
    "committee", "trust committee", "who manages", "board members",
    "trustees", "governing body", "management members"
  ],
  [Intent.OFFICE_HOURS]: [
    "office hours", "office timing", "admin office", "administrative hours",
    "when is office open", "office schedule"
  ],
  [Intent.ANNADANA]: [
    "annadana", "free meals", "free food", "lunch", "dinner",
    "food service", "ಅನ್ನದಾನ", "ಉಚಿತ ಊಟ"
  ],
  [Intent.PRASADA]: [
    "prasada", "prasad", "sacred food", "blessed food", "theertha",
    "tirtha", "holy water", "charanamrut"
  ],
  [Intent.FAQ]: [
    "faq", "common questions", "help", "ಪ್ರಶ್ನೆ"
  ],
  [Intent.TESTIMONIAL]: [
    "testimonial", "share experience", "feedback", "review"
  ],
  [Intent.VOLUNTEER]: [
    "volunteer", "volunteering", "help", "join", "ಸ್ಚಛಂದನ"
  ],
  [Intent.CONTACT_REQUEST]: [
    "contact", "reach", "talk to someone", "talk to priest"
  ],
  [Intent.GENERAL_GREETING]: [
    "hello", "namaste", "namaskara", "hi", "ನಮಸ್ಕಾರ"
  ],
  [Intent.THANKS]: [
    "thank you", "thanks", "grateful", "appreciate"
  ],
  [Intent.GOODBYE]: [
    "bye", "goodbye", "see you", "take care"
  ],
  [Intent.OUT_OF_SCOPE]: [
    "weather", "stock market", "politics", "movies", "sports"
  ],
  [Intent.UNKNOWN]: []
};

export class IntentDetector {
  private minConfidence: number;
  private maxKeywords: number;

  constructor(minConfidence = 20, maxKeywords = 10) {
    this.minConfidence = minConfidence;
    this.maxKeywords = maxKeywords;
  }

  /**
   * Detect intent using hybrid approach (keyword + semantic)
   */
  detect(message: string): IntentDetectionResult {
    // Enhance message with transliteration if Romanized Kannada detected
    const { original, transliterated, isTransliterated } = enhanceWithTransliteration(message);
    const enhancedMessage = isTransliterated ? `${original} ${transliterated}` : original;
    
    const normalizedMessage = normalizeText(enhancedMessage);
    const hasKannada = containsKannada(enhancedMessage);

    // Debug logging
    console.log(`[IntentDetector] Detecting: "${message}" (transliterated: ${isTransliterated})`);

    // Check out-of-scope first
    if (this.isOutOfScope(normalizedMessage, hasKannada)) {
      console.log(`[IntentDetector] OUT_OF_SCOPE`);
      return {
        intent: Intent.OUT_OF_SCOPE,
        category: IntentCategory.OUT_OF_SCOPE,
        confidence: 100,
        source: RetrievalType.FALLBACK,
        matchedKeywords: [],
        requiresStructuredData: false,
      };
    }

    // Step 1: Keyword matching (exact matches)
    const keywordResult = this.detectByKeywords(normalizedMessage, hasKannada);
    console.log(`[IntentDetector] Keyword: ${keywordResult.intent} (${keywordResult.confidence}%)`);
    
    // Step 2: Semantic matching (handles paraphrases)
    const semanticResult = this.detectBySemantic(normalizedMessage);
    console.log(`[IntentDetector] Semantic: ${semanticResult.intent} (${semanticResult.confidence}%)`);

    // Step 3: Combine results
    const bestResult = this.combineResults(keywordResult, semanticResult);
    console.log(`[IntentDetector] Combined: ${bestResult.intent} (${bestResult.confidence}%)`);

    // Fallback to FAQ if low confidence
    if (bestResult.confidence < this.minConfidence) {
      console.log(`[IntentDetector] Low confidence, falling back to FAQ`);
      return {
        ...bestResult,
        intent: Intent.FAQ,
        fallbackIntent: Intent.FAQ,
      };
    }

    return bestResult;
  }

  /**
   * Detect intent using keyword matching
   */
  private detectByKeywords(message: string, hasKannada: boolean): IntentDetectionResult {
    const sortedPatterns = [...INTENT_PATTERNS].sort((a, b) => b.priority - a.priority);

    let bestMatch: IntentDetectionResult | null = null;
    let highestScore = 0;

    for (const pattern of sortedPatterns) {
      const result = this.matchPattern(pattern, message, hasKannada);
      if (result && result.confidence > highestScore) {
        highestScore = result.confidence;
        bestMatch = result;
      }
    }

    return bestMatch || {
      intent: Intent.UNKNOWN,
      category: IntentCategory.UNKNOWN,
      confidence: 0,
      source: RetrievalType.KEYWORD_MATCH,
      matchedKeywords: [],
      requiresStructuredData: false,
    };
  }

  /**
   * Detect intent using semantic similarity (handles paraphrases)
   * Gives higher weight to specific domain keywords
   * Now also uses ML service for enhanced matching
   */
  private detectBySemantic(message: string): IntentDetectionResult {
    const lowerMessage = message.toLowerCase();
    
    // Step 1: Check for learned corrections first
    const correctedIntent = getCorrectedIntent(message);
    if (correctedIntent) {
      console.log(`[IntentDetector] Using learned correction: ${correctedIntent}`);
      return {
        intent: correctedIntent,
        category: this.getCategoryForIntent(correctedIntent),
        confidence: 95,
        source: RetrievalType.LEARNED,
        matchedKeywords: [],
        requiresStructuredData: false,
      };
    }
    
    // Step 2: Auto-correct typos
    const { corrected: correctedMessage, corrections } = autoCorrectMessage(message);
    if (corrections.some(c => c.confidence < 100)) {
      console.log(`[IntentDetector] Auto-corrected typos:`, corrections.filter(c => c.confidence < 100));
    }
    
    // Use corrected message for matching if corrections were made
    const matchingMessage = corrections.some(c => c.confidence < 100) 
      ? correctedMessage.toLowerCase() 
      : lowerMessage;
    
    const messageWords = new Set(
      matchingMessage.split(/\s+/).filter(w => w.length > 2)
    );

    // Domain-specific keywords that should have higher weight
    // Order matters: more specific first (using array to preserve order)
    const domainKeywords: [string, Intent][] = [
      // Temple Timings (high priority)
      ["temple timings", Intent.TEMPLE_TIMINGS],
      ["temple timing", Intent.TEMPLE_TIMINGS],
      ["matha timings", Intent.TEMPLE_TIMINGS],
      ["math timings", Intent.TEMPLE_TIMINGS],
      ["what are the timings", Intent.TEMPLE_TIMINGS],
      ["timmings", Intent.TEMPLE_TIMINGS],
      // Pooja-related (daily first)
      ["daily pooja", Intent.DAILY_POOJA],
      ["pooja", Intent.DAILY_POOJA],
      ["puja", Intent.DAILY_POOJA],
      // Donation (more specific first)
      ["80g", Intent.DONATION_80G],
      ["80 g", Intent.DONATION_80G],
      ["tax deductible", Intent.DONATION_80G],
      ["tax benefit", Intent.DONATION_80G],
      ["tax exemption", Intent.DONATION_80G],
      ["donation receipt", Intent.DONATION_80G],
      ["donate", Intent.DONATION],
      ["donation", Intent.DONATION],
      ["contributions", Intent.DONATION],
      // Sevas
      ["sevas", Intent.SPECIAL_SEVAS],
      ["seva", Intent.SPECIAL_SEVAS],
      // Events
      ["aaradhane", Intent.NEXT_AARADHANE],
      ["aradhana", Intent.NEXT_AARADHANE],
      // Panchanga
      ["panchanga", Intent.PANCHANGA],
      ["tithi", Intent.PANCHANGA],
      ["nakshatra", Intent.PANCHANGA],
      // Sri Raghavendra
      ["raghavendra", Intent.SRI_RAGHAVENDRA],
      ["swamiji", Intent.SRI_RAGHAVENDRA],
      // Madhwa
      ["madhwa", Intent.MADHWA_PHILOSOPHY],
      ["madhvacharya", Intent.MADHWA_PHILOSOPHY],
      // Sevas - Annadana and Prasada before Volunteer
      ["annadana", Intent.ANNADANA],
      ["prasada", Intent.PRASADA],
      ["prasad", Intent.PRASADA],
      // Website Navigation - Share Experience before Testimonial
      ["share experience", Intent.SHARE_EXPERIENCE],
      ["share my experience", Intent.SHARE_EXPERIENCE],
      // Committee
      ["trust committee", Intent.COMMITTEE],
    ];

    // Check for domain-specific keywords first (order preserved, using corrected message)
    for (const [keyword, intent] of domainKeywords) {
      if (matchingMessage.includes(keyword)) {
        // Look up requiresStructuredData from INTENT_PATTERNS
        const pattern = INTENT_PATTERNS.find(p => p.intent === intent);
        return {
          intent,
          category: this.getCategoryForIntent(intent),
          confidence: 100, // Direct match gets highest confidence
          source: RetrievalType.SEMANTIC_MATCH,
          matchedKeywords: [keyword],
          requiresStructuredData: pattern?.requiresStructuredData ?? true,
        };
      }
    }

    let bestIntent = Intent.UNKNOWN;
    let highestSimilarity = 0;

    for (const [intent, examples] of Object.entries(INTENT_EXAMPLES)) {
      if (intent === Intent.UNKNOWN || intent === Intent.OUT_OF_SCOPE) continue;

      let maxExampleScore = 0;

      for (const example of examples) {
        const exampleWords = new Set(
          example.toLowerCase().split(/\s+/).filter(w => w.length > 2)
        );

        // Jaccard similarity
        const intersection = [...messageWords].filter(
          w => exampleWords.has(w) || this.fuzzyMatch(w, exampleWords)
        );
        const union = new Set([...messageWords, ...exampleWords]);
        const jaccard = union.size > 0 ? intersection.length / union.size : 0;

        // Bonus for substring matches (reduced weight)
        let substringBonus = 0;
        for (const msgWord of messageWords) {
          for (const exWord of exampleWords) {
            if (msgWord.includes(exWord) || exWord.includes(msgWord)) {
              substringBonus += 0.1;
            }
          }
        }

        maxExampleScore = Math.max(maxExampleScore, jaccard + substringBonus);
      }

      if (maxExampleScore > highestSimilarity) {
        highestSimilarity = maxExampleScore;
        bestIntent = intent as Intent;
      }
    }

    // Convert similarity to confidence (0-1 -> 20-75, lower cap for semantic)
    const confidence = Math.min(20 + highestSimilarity * 55, 75);

    // Step 3: Use ML semantic matching for additional confidence boost
    // This uses weighted keyword matching for better paraphrase handling
    // Use corrected message if there were corrections
    const mlInputMessage = corrections.some(c => c.confidence < 100) 
      ? correctedMessage 
      : message;
    const mlMatches = calculateIntentSimilarity(mlInputMessage);
    
    let finalIntent = bestIntent;
    let finalConfidence = confidence;
    let mlBoost = false;
    
    if (mlMatches.length > 0) {
      const bestMlMatch = mlMatches[0];
      
      // If ML finds a better match with higher confidence
      if (bestMlMatch.similarity > confidence && bestIntent !== bestMlMatch.intent) {
        finalIntent = bestMlMatch.intent;
        finalConfidence = Math.min(bestMlMatch.similarity, 80);
        mlBoost = true;
      }
    }

    return {
      intent: finalIntent,
      category: this.getCategoryForIntent(finalIntent),
      confidence: Math.round(finalConfidence),
      source: mlBoost ? RetrievalType.LEARNED : RetrievalType.SEMANTIC_MATCH,
      matchedKeywords: [],
      requiresStructuredData: true,
    };
  }

  /**
   * Simple fuzzy matching for word variations
   */
  private fuzzyMatch(word: string, wordSet: Set<string>): boolean {
    for (const target of wordSet) {
      if (word.length < 3 || target.length < 3) continue;
      // Same prefix check
      if (word.slice(0, 3) === target.slice(0, 3)) return true;
      // Same suffix check
      if (word.slice(-3) === target.slice(-3)) return true;
    }
    return false;
  }

  /**
   * Combine keyword and semantic results
   */
  private combineResults(
    keywordResult: IntentDetectionResult,
    semanticResult: IntentDetectionResult
  ): IntentDetectionResult {
    // If semantic detection found a direct domain keyword match (100% confidence),
    // it should override keyword detection to ensure specific terms win
    if (semanticResult.confidence === 100 && semanticResult.source === RetrievalType.SEMANTIC_MATCH) {
      return semanticResult;
    }

    // If both agree, boost confidence
    if (keywordResult.intent === semanticResult.intent) {
      return {
        ...keywordResult,
        confidence: Math.min(keywordResult.confidence + 10, 100),
        source: RetrievalType.HYBRID_MATCH,
      };
    }

    // If semantic has higher confidence, prefer it
    // This handles cases like typo corrections where semantic does better
    if (semanticResult.confidence > keywordResult.confidence) {
      return semanticResult;
    }

    // If keyword detection has matched keywords, prioritize it
    // This prevents generic words like "about", "tell" from overriding domain matches
    if (keywordResult.matchedKeywords.length > 0) {
      if (keywordResult.confidence >= 25) {
        return keywordResult;
      }
    }

    // Take higher confidence
    return keywordResult.confidence >= semanticResult.confidence
      ? keywordResult
      : semanticResult;
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

    // Check English keywords
    for (const keyword of pattern.keywords.en) {
      const normalizedKeyword = normalizeText(keyword);
      if (normalizedMessage.includes(normalizedKeyword)) {
        matchedKeywords.push(keyword);
      }
    }

    // Check Kannada keywords
    if (hasKannada && pattern.keywords.kn) {
      for (const keyword of pattern.keywords.kn) {
        if (normalizedMessage.includes(keyword) && !matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }
    }

    if (matchedKeywords.length === 0) return null;

    // Calculate confidence - factor in priority (0-100 scaled to 0-30)
    const effectiveMatches = Math.min(matchedKeywords.length, this.maxKeywords);
    const keywordScore = Math.min((effectiveMatches / this.maxKeywords) * 60, 60);
    // Normalize priority (0-100 range) to a 0-30 bonus
    const priorityBonus = Math.min((pattern.priority / 100) * 30, 30);
    const confidence = Math.min(Math.round(20 + keywordScore + priorityBonus), 95);

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
   * Get category for intent
   */
  private getCategoryForIntent(intent: Intent): IntentCategory {
    switch (intent) {
      case Intent.TEMPLE_TIMINGS:
      case Intent.CONTACT_INFORMATION:
      case Intent.LOCATION:
      case Intent.VISITOR_GUIDELINES:
      case Intent.DRESS_CODE:
      case Intent.ADDRESS:
      case Intent.OFFICE_HOURS:
        return IntentCategory.TEMPLE_INFO;
      case Intent.UPCOMING_EVENTS:
      case Intent.NEXT_AARADHANE:
      case Intent.FESTIVAL_INFO:
        return IntentCategory.EVENTS;
      case Intent.DAILY_QUOTE:
        return IntentCategory.DEVOTIONAL;
      case Intent.SPECIAL_SEVAS:
      case Intent.DAILY_POOJA:
      case Intent.ANNADANA:
      case Intent.PRASADA:
        return IntentCategory.SEVAS;
      case Intent.DONATION:
      case Intent.DONATION_PURPOSE:
      case Intent.DONATION_80G:
        return IntentCategory.DONATIONS;
      case Intent.PANCHANGA:
        return IntentCategory.PANCHANGA;
      case Intent.TEMPLE_HISTORY:
      case Intent.SRI_RAGHAVENDRA:
      case Intent.MADHWA_PHILOSOPHY:
      case Intent.GURU_PARAMPARA:
      case Intent.BRINDAVANA:
        return IntentCategory.KNOWLEDGE;
      case Intent.VISITOR_GUIDELINES:
      case Intent.DRESS_CODE:
      case Intent.PHOTOGRAPHY:
      case Intent.PARKING:
        return IntentCategory.VISITOR;
      case Intent.SHARE_EXPERIENCE:
      case Intent.COMMITTEE:
        return IntentCategory.WEBSITE_NAVIGATION;
      case Intent.FAQ:
      case Intent.GENERAL_GREETING:
        return IntentCategory.GENERAL;
      case Intent.ANNOUNCEMENTS:
        return IntentCategory.ANNOUNCEMENTS;
      case Intent.OUT_OF_SCOPE:
        return IntentCategory.OUT_OF_SCOPE;
      default:
        return IntentCategory.UNKNOWN;
    }
  }

  /**
   * Check if message is out of scope
   */
  private isOutOfScope(normalizedMessage: string, hasKannada: boolean): boolean {
    for (const pattern of OUT_OF_SCOPE_PATTERNS) {
      if (pattern.test(normalizedMessage)) return true;
    }

    for (const keyword of OUT_OF_SCOPE_KEYWORDS.en) {
      if (normalizedMessage.includes(keyword.toLowerCase())) return true;
    }

    if (hasKannada && OUT_OF_SCOPE_KEYWORDS.kn) {
      for (const keyword of OUT_OF_SCOPE_KEYWORDS.kn) {
        if (normalizedMessage.includes(keyword)) return true;
      }
    }

    return false;
  }

  /**
   * Batch detect intents
   */
  detectBatch(messages: string[]): IntentDetectionResult[] {
    return messages.map(msg => this.detect(msg));
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
      .filter(p => p.category === category)
      .map(p => p.intent);
  }
}

// Singleton instance
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
