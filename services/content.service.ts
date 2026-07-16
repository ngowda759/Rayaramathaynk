/**
 * Content Management Service for Raya AI
 * Provides auto-tagging, freshness tracking, and related questions features
 */

import type { KnowledgeArticle, KnowledgeCategory } from "@/lib/ai/knowledge/types";

/**
 * Content Freshness Info
 */
export interface ContentFreshness {
  articleId: string;
  lastUpdated: Date;
  daysSinceUpdate: number;
  freshnessLabel: "fresh" | "stale" | "outdated";
  reviewRecommended: boolean;
}

/**
 * Related Question
 */
export interface RelatedQuestion {
  id: string;
  question: string;
  questionKn?: string; // Kannada version
  answerArticleId?: string;
  intent?: string;
}

/**
 * Auto-tag result
 */
export interface AutoTagResult {
  suggestedCategory: KnowledgeCategory;
  confidence: number;
  alternativeCategories: Array<{ category: KnowledgeCategory; confidence: number }>;
  suggestedKeywords: string[];
}

// Category keywords for auto-tagging
const CATEGORY_KEYWORDS: Record<KnowledgeCategory, string[]> = {
  temple_history: [
    "history", "established", "founded", "built", "construction", 
    "heritage", "ancient", "century", "old", "legacy", "historical",
    "ಇತಿಹಾಸ", "ಮಠ"
  ],
  sri_raghavendra: [
    "raghavendra", "swamy", "guru", "madhwa", "brindavana", "mantralaya",
    "miracle", "blessing", "grace", "ರಾಘವೇಂದ್ರ", "ಸ್ವಾಮಿ"
  ],
  sri_madhvacharya: [
    "madhva", "madhwacharya", "dwaita", "philosophy", "dvaita",
    "predestination", "ಮಾಧವ", "ದ್ವೈತ"
  ],
  guru_parampara: [
    "guru", "parampara", "lineage", "succession", "teacher", "disciple",
    "pondhe", "vijaya", "ಗುರು", "ಪರಂಪರೆ"
  ],
  brindavana: [
    "brindavana", "brindavan", "mantralaya", "tomb", "samadhi",
    "ಬೃಂದಾವನ"
  ],
  mantralaya: [
    "mantralaya", "mantra", "prayer", "mantra", "lord", "rukhmini",
    "ಮಂತ್ರಾಲಯ"
  ],
  daily_pooja: [
    "pooja", "puja", "ritual", "worship", "ceremony", "schedule",
    "morning", "evening", "suprabhata", "ಪೂಜೆ", "ಮಾಡುವುದು"
  ],
  special_sevas: [
    "seva", "archana", "aarti", "kakda", "根據", "mahamant",
    "abhisheka", "tripradipthi", "ಸೇವೆ"
  ],
  dress_code: [
    "dress", "wear", "clothing", "clothes", "traditional", "saree",
    "dhoti", "shirt", "pants", "ಉಡುಗೆ", "ತುಂಡು"
  ],
  donation_info: [
    "donate", "donation", "contribution", "charity", "tax", "80g",
    "bank", "account", "upi", "neft", "rtgs", "ದಾನ", "ಕೊಡುವುದು"
  ],
  visitor_guidelines: [
    "visitor", "guidelines", "rules", "guidelines", "things to know",
    "注意事项", "respectful", "ಭೇಟಿ", "ಮಾರ್ಗದರ್ಶಿ"
  ],
  faq: [
    "faq", "question", "answer", "help", "common", "frequently",
    "ಪ್ರಶ್ನೆ", "ಉತ್ತರ"
  ],
  madhwa_philosophy: [
    "philosophy", "belief", "doctrine", "vedanta", "text", "scripture",
    "bhagavatha", "brahma", "ತತ್ವ", "ತತ್ವಶಾಸ್ತ್ರ"
  ],
  general: [
    "general", "miscellaneous", "other", "information", "details"
  ]
};

/**
 * Auto-tag an article based on its content
 */
export function autoTagArticle(
  title: string,
  content: string,
  existingKeywords: string[] = []
): AutoTagResult {
  const combinedText = `${title} ${content}`.toLowerCase();
  const scores: Record<KnowledgeCategory, number> = {} as Record<KnowledgeCategory, number>;
  
  // Calculate score for each category
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    const categoryKey = category as KnowledgeCategory;
    
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'gi');
      const matches = combinedText.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    
    scores[categoryKey] = score;
  }
  
  // Sort categories by score
  const sortedCategories = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score > 0);
  
  if (sortedCategories.length === 0) {
    return {
      suggestedCategory: "general",
      confidence: 0,
      alternativeCategories: [],
      suggestedKeywords: [],
    };
  }
  
  const [topCategory, topScore] = sortedCategories[0];
  const maxPossibleScore = Object.values(CATEGORY_KEYWORDS).flat().length / 2;
  const confidence = Math.min(100, (topScore / maxPossibleScore) * 100);
  
  const alternativeCategories = sortedCategories
    .slice(1, 4)
    .map(([cat, score]) => ({
      category: cat as KnowledgeCategory,
      confidence: Math.min(100, (score / maxPossibleScore) * 100),
    }));
  
  // Generate suggested keywords from content
  const suggestedKeywords = generateKeywordsFromContent(combinedText, existingKeywords);
  
  return {
    suggestedCategory: topCategory as KnowledgeCategory,
    confidence,
    alternativeCategories,
    suggestedKeywords,
  };
}

/**
 * Generate keywords from content
 */
function generateKeywordsFromContent(text: string, existingKeywords: string[]): string[] {
  // Common stop words to exclude
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
    'we', 'they', 'what', 'which', 'who', 'whom', 'when', 'where', 'why',
    'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because',
    'as', 'until', 'while', 'about', 'against', 'between', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'between'
  ]);
  
  // Extract words
  const words = text.match(/[a-zA-Z]{3,}/g) || [];
  const wordCounts: Record<string, number> = {};
  
  for (const word of words) {
    const lower = word.toLowerCase();
    if (!stopWords.has(lower) && !existingKeywords.includes(lower)) {
      wordCounts[lower] = (wordCounts[lower] || 0) + 1;
    }
  }
  
  // Get top keywords
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Calculate content freshness
 */
export function getContentFreshness(article: KnowledgeArticle): ContentFreshness {
  const now = new Date();
  const lastUpdated = article.updatedAt instanceof Date ? article.updatedAt : new Date(article.updatedAt);
  const daysSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
  
  let freshnessLabel: "fresh" | "stale" | "outdated";
  let reviewRecommended = false;
  
  if (daysSinceUpdate <= 30) {
    freshnessLabel = "fresh";
  } else if (daysSinceUpdate <= 90) {
    freshnessLabel = "stale";
    reviewRecommended = true;
  } else {
    freshnessLabel = "outdated";
    reviewRecommended = true;
  }
  
  return {
    articleId: article.id,
    lastUpdated,
    daysSinceUpdate,
    freshnessLabel,
    reviewRecommended,
  };
}

/**
 * Get freshness label for display
 */
export function getFreshnessLabel(daysSinceUpdate: number): string {
  if (daysSinceUpdate === 0) {
    return "Updated today";
  } else if (daysSinceUpdate === 1) {
    return "Updated yesterday";
  } else if (daysSinceUpdate < 7) {
    return `Updated ${daysSinceUpdate} days ago`;
  } else if (daysSinceUpdate < 30) {
    const weeks = Math.floor(daysSinceUpdate / 7);
    return `Updated ${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else if (daysSinceUpdate < 365) {
    const months = Math.floor(daysSinceUpdate / 30);
    return `Updated ${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(daysSinceUpdate / 365);
    return `Updated ${years} year${years > 1 ? 's' : ''} ago`;
  }
}

/**
 * Related questions mapping
 * Maps common questions to knowledge articles
 */
const RELATED_QUESTIONS_MAP: Record<string, RelatedQuestion[]> = {
  // Temple Timings related
  temple_timings: [
    { id: "tt-1", question: "What time does the temple open?", questionKn: "ದೇವಸ್ಥಾನ ಯಾವಾಗ ತೆರೆಯುತ್ತದೆ?", intent: "TEMPLE_TIMINGS" },
    { id: "tt-2", question: "When does morning pooja start?", questionKn: "ಬೆಳಗಿನ ಪೂಜೆ ಯಾವಾಗ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ?", intent: "TEMPLE_TIMINGS" },
    { id: "tt-3", question: "What are the evening timings?", questionKn: "ಸಂಜೆ ಸಮಯ ಏನು?", intent: "TEMPLE_TIMINGS" },
    { id: "tt-4", question: "When does the temple close?", questionKn: "ದೇವಸ್ಥಾನ ಯಾವಾಗ ಮುಚ್ಚುತ್ತದೆ?", intent: "TEMPLE_TIMINGS" },
  ],
  // Donation related
  donation: [
    { id: "dn-1", question: "How can I donate?", questionKn: "ನಾನು ಹೇಗೆ ದಾನ ಮಾಡಬಹುದು?", intent: "DONATION" },
    { id: "dn-2", question: "Do you accept online donations?", questionKn: "ಆನ್‌ಲೈನ್ ದಾನ ಅಂಗೀಕರಿಸುತ್ತೀರಾ?", intent: "DONATION" },
    { id: "dn-3", question: "Can I get 80G certificate?", questionKn: "ನಾನು 80ಜಿ ಪ್ರಮಾಣಪತ್ರ ಪಡೆಯಬಹುದೇ?", intent: "DONATION_80G" },
    { id: "dn-4", question: "What are the bank details?", questionKn: "ಬ್ಯಾಂಕ್ ವಿವರಗಳು ಏನು?", intent: "DONATION" },
  ],
  // Events related
  events: [
    { id: "ev-1", question: "When is the next aaradhane?", questionKn: "ಮುಂದಿನ ಆರಾಧನೆ ಯಾವಾಗ?", intent: "NEXT_AARADHANE" },
    { id: "ev-2", question: "What festivals are celebrated?", questionKn: "ಯಾವ ಹಬ್ಬಗಳನ್ನು ಆಚರಿಸಲಾಗುತ್ತದೆ?", intent: "FESTIVAL_INFO" },
    { id: "ev-3", question: "Is there a special program today?", questionKn: "ಇಂದು ವಿಶೇಷ ಕಾರ್ಯಕ್ರಮವಿದೆಯೇ?", intent: "UPCOMING_EVENTS" },
  ],
  // Sevas related
  sevas: [
    { id: "sv-1", question: "What sevas are available?", questionKn: "ಯಾವ ಸೇವೆಗಳು ಲಭ್ಯವಿವೆ?", intent: "SPECIAL_SEVAS" },
    { id: "sv-2", question: "How do I book a seva?", questionKn: "ಸೇವೆ ಹೇಗೆ ಬುಕ್ ಮಾಡಬಹುದು?", intent: "SEVA_BOOKING" },
    { id: "sv-3", question: "What is the cost of Archana?", questionKn: "ಆರ್ಚನೆಯ ಖರ್ಚು ಏನು?", intent: "SPECIAL_SEVAS" },
    { id: "sv-4", question: "What is Annadanam?", questionKn: "ಅನ್ನದಾನಂ ಏನು?", intent: "ANNADANA" },
  ],
  // Location related
  location: [
    { id: "lc-1", question: "How do I get to the temple?", questionKn: "ದೇವಸ್ಥಾನಕ್ಕೆ ಹೇಗೆ ಹೋಗಬಹುದು?", intent: "LOCATION" },
    { id: "lc-2", question: "Is parking available?", questionKn: "ಪಾರ್ಕಿಂಗ್ ಲಭ್ಯವಿದೆಯೇ?", intent: "PARKING" },
    { id: "lc-3", question: "What is the temple address?", questionKn: "ದೇವಸ್ಥಾನದ ವಿಳಾಸ ಏನು?", intent: "ADDRESS" },
  ],
  // Dress code related
  dress_code: [
    { id: "dc-1", question: "What should I wear?", questionKn: "ನಾನು ಏನು ಧರಿಸಬೇಕು?", intent: "DRESS_CODE" },
    { id: "dc-2", question: "Is there a dress code?", questionKn: "ಉಡುಗೆ ನಿಯಮವಿದೆಯೇ?", intent: "DRESS_CODE" },
    { id: "dc-3", question: "Can I wear jeans?", questionKn: "ಜೀನ್ಸ್ ಧರಿಸಬಹುದೇ?", intent: "DRESS_CODE" },
  ],
};

/**
 * Get related questions for an intent/topic
 */
export function getRelatedQuestions(
  intent?: string,
  language: "en" | "kn" | "mixed" = "en"
): RelatedQuestion[] {
  // Map intent to question group
  const intentToGroup: Record<string, string> = {
    TEMPLE_TIMINGS: "temple_timings",
    OFFICE_HOURS: "temple_timings",
    CONTACT_INFORMATION: "location",
    LOCATION: "location",
    ADDRESS: "location",
    PARKING: "location",
    DONATION: "donation",
    DONATION_80G: "donation",
    UPCOMING_EVENTS: "events",
    NEXT_AARADHANE: "events",
    FESTIVAL_INFO: "events",
    SPECIAL_SEVAS: "sevas",
    SEVA_BOOKING: "sevas",
    ANNADANA: "sevas",
    DRESS_CODE: "dress_code",
    VISITOR_GUIDELINES: "dress_code",
    PHOTOGRAPHY: "dress_code",
  };
  
  const group = intent ? intentToGroup[intent] : undefined;
  
  if (group && RELATED_QUESTIONS_MAP[group]) {
    return RELATED_QUESTIONS_MAP[group];
  }
  
  // Return general related questions
  return [
    { id: "gen-1", question: "What are the temple timings?", questionKn: "ದೇವಸ್ಥಾನದ ಸಮಯ ಏನು?", intent: "TEMPLE_TIMINGS" },
    { id: "gen-2", question: "How can I donate?", questionKn: "ಹೇಗೆ ದಾನ ಮಾಡಬಹುದು?", intent: "DONATION" },
    { id: "gen-3", question: "What sevas are available?", questionKn: "ಯಾವ ಸೇವೆಗಳು ಲಭ್ಯ?", intent: "SPECIAL_SEVAS" },
    { id: "gen-4", question: "When is the next event?", questionKn: "ಮುಂದಿನ ಕಾರ್ಯಕ್ರಮ ಯಾವಾಗ?", intent: "UPCOMING_EVENTS" },
  ];
}

/**
 * Get articles that need review (outdated content)
 */
export function getArticlesNeedingReview(articles: KnowledgeArticle[]): KnowledgeArticle[] {
  return articles.filter((article) => {
    const freshness = getContentFreshness(article);
    return freshness.reviewRecommended;
  }).sort((a, b) => {
    // Sort by oldest first
    const freshnessA = getContentFreshness(a);
    const freshnessB = getContentFreshness(b);
    return freshnessB.daysSinceUpdate - freshnessA.daysSinceUpdate;
  });
}

/**
 * Batch content freshness check
 */
export function batchFreshnessCheck(articles: KnowledgeArticle[]): ContentFreshness[] {
  return articles.map((article) => getContentFreshness(article));
}
