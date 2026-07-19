// Knowledge Module - Knowledge base for Raya AI
// Provides structured knowledge articles for accurate responses

export * from "./types";
export * from "./seed";
export * from "./repository";

import type {
  KnowledgeArticle,
  KnowledgeSearchResult,
  KnowledgeCategory,
} from "./types";

import {
  CATEGORY_DISPLAY_NAMES,
  CATEGORY_ICONS,
} from "./types";

export { CATEGORY_DISPLAY_NAMES, CATEGORY_ICONS };

import {
  getKnowledgeArticles,
  getArticlesByCategory,
  getArticleBySlug,
  searchArticles,
  clearKnowledgeCache,
} from "./repository";

/**
 * Get knowledge context for AI response
 */
export async function getKnowledgeContext(
  query: string,
  maxResults = 3
): Promise<{
  articles: KnowledgeArticle[];
  searchResults: KnowledgeSearchResult[];
}> {
  const searchResults = await searchArticles(query, maxResults);
  
  return {
    articles: searchResults.map((r) => r.article),
    searchResults,
  };
}

/**
 * Format knowledge article for AI context
 */
export function formatArticleForContext(article: KnowledgeArticle): string {
  return `
Title: ${article.title}
Category: ${CATEGORY_DISPLAY_NAMES[article.category]}

${article.content}
`.trim();
}

/**
 * Format multiple articles for user response
 */
export function formatArticlesForContext(articles: KnowledgeArticle[]): string {
  if (articles.length === 0) {
    return "";
  }

  let context = "";

  articles.forEach((article, index) => {
    // Format each article in a user-friendly way
    context += `**${article.title}**\n\n${article.content}\n\n`;
    
    // Add separator between articles (not after the last one)
    if (index < articles.length - 1) {
      context += `---\n\n`;
    }
  });

  return context.trim();
}

/**
 * Format articles for AI response with source attribution
 */
export function formatArticlesWithSources(
  articles: KnowledgeArticle[],
  language: "en" | "kn" | "mixed"
): {
  content: string;
  sourceAttribution: string;
  relatedLinks: string[];
} {
  if (articles.length === 0) {
    return {
      content: "",
      sourceAttribution: "",
      relatedLinks: [],
    };
  }

  // Build main content
  const content = formatArticlesForContext(articles);

  // Build source attribution
  const sourceTexts = {
    en: "📖 Source: Knowledge Centre",
    kn: "📖 ಮೂಲ: ಜ್ಞಾನ ಕೇಂದ್ರ",
    mixed: "📖 Source / ಮೂಲ: Knowledge Centre",
  };
  const sourceAttribution = sourceTexts[language];

  // Build related links
  const relatedLinks = articles
    .filter((a) => a.slug)
    .slice(0, 3)
    .map((a) => `/knowledge/article/${a.slug}`);

  return {
    content,
    sourceAttribution,
    relatedLinks,
  };
}

/**
 * Generate suggested follow-up questions based on category
 */
export function getSuggestedFollowUps(
  category: KnowledgeCategory | null,
  language: "en" | "kn" | "mixed"
): string[] {
  const suggestions: Record<string, Record<string, string[]>> = {
    history: {
      en: [
        "Tell me about Guru Raghavendra Swamy",
        "What is the Brindavana?",
        "Tell me about Mantralaya",
      ],
      kn: [
        "ಗುರು ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯ ಬಗ್ಗೆ ಹೇಳಿ",
        "ಬೃಂದಾವನದ ಬಗ್ಗೆ ಏನು?",
        "ಮಂತ್ರಾಲಯದ ಬಗ್ಗೆ ಹೇಳಿ",
      ],
      mixed: [
        "Tell me about Guru Raghavendra Swamy",
        "What is Brindavana?",
      ],
    },
    philosophy: {
      en: [
        "What is Madhwa philosophy?",
        "Explain Dvaita Vedanta",
        "What are the key teachings?",
      ],
      kn: [
        "ಮಾಧ್ವ ತತ್ವದ ಬಗ್ಗೆ ಹೇಳಿ",
        "ದ್ವೈತ ವೇದಾಂತವನ್ನು ವಿವರಿಸಿ",
      ],
      mixed: [
        "What is Madhwa philosophy?",
      ],
    },
    festivals: {
      en: [
        "What is the next festival?",
        "Tell me about the Aaradhane",
        "When is Mahabhishekam?",
      ],
      kn: [
        "ಮುಂದಿನ ಹಬ್ಬ ಯಾವುದು?",
        "ಆರಾಧನೆಯ ಬಗ್ಗೆ ಹೇಳಿ",
      ],
      mixed: [
        "What is the next festival?",
      ],
    },
    rituals: {
      en: [
        "What sevas are available?",
        "How to book a seva?",
        "What is the daily schedule?",
      ],
      kn: [
        "ಯಾವ ಸೇವೆಗಳು ಲಭ್ಯ?",
        "ಸೇವೆಯನ್ನು ಹೇಗೆ ಬುಕ್ ಮಾಡಬಹುದು?",
      ],
      mixed: [
        "What sevas are available?",
      ],
    },
    visiting: {
      en: [
        "What are the temple timings?",
        "What is the dress code?",
        "How do I reach the temple?",
      ],
      kn: [
        "ದೇವಸ್ಥಾನದ ಸಮಯಗಳು ಏನು?",
        "ಉಡುಗೆಯ ನಿಯಮ ಏನು?",
      ],
      mixed: [
        "What are temple timings?",
      ],
    },
    guru_parampara: {
      en: [
        "Who are the pontiffs?",
        "Tell me about the lineage",
        "What is the math history?",
      ],
      kn: [
        "ಪೀಠಾಧೀಶರು ಯಾರು?",
        "ಗುರು ಕ್ರಮದ ಬಗ್ಗೆ ಹೇಳಿ",
      ],
      mixed: [
        "Who are the pontiffs?",
      ],
    },
    faq: {
      en: [
        "How do I donate?",
        "Can I volunteer?",
        "Where is the temple located?",
      ],
      kn: [
        "ದೇಣವನ್ನು ಹೇಗೆ ನೀಡಬಹುದು?",
        "ಸ್ವಯಂಸೇವಕರಾಗಬಹುದೇ?",
      ],
      mixed: [
        "How do I donate?",
      ],
    },
  };

  // Default suggestions for unknown category
  const defaultSuggestions = {
    en: [
      "What are the temple timings?",
      "Tell me about the temple history",
      "What events are coming up?",
    ],
    kn: [
      "ದೇವಸ್ಥಾನದ ಸಮಯಗಳು ಏನು?",
      "ದೇವಸ್ಥಾನದ ಇತಿಹಾಸವನ್ನು ಹೇಳಿ",
      "ಯಾವ ಕಾರ್ಯಕ್ರಮಗಳು ಬರುತ್ತಿವೆ?",
    ],
    mixed: [
      "What are temple timings?",
      "Tell me about the temple",
    ],
  };

  const categorySuggestions = category ? suggestions[category]?.[language] : null;
  return categorySuggestions || defaultSuggestions[language];
}

/**
 * Get greeting responses
 */
export function getGreetingResponse(language: "en" | "kn" | "mixed"): string {
  const greetings = {
    en: "🙏 Namaskara! Welcome to Sri Raghavendra Swamy Matha. I am Raya AI, your assistant. How may I help you today?",
    kn: "🙏 ನಮಸ್ಕಾರ! ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠಕ್ಕೆ ಸ್ವಾಗತ. ನಾನು ರಾಯ ಏಐ, ನಿಮ್ಮ ಸಹಾಯಕಿ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
    mixed: "🙏 Namaskara / ನಮಸ್ಕಾರ! Welcome to Sri Raghavendra Swamy Matha. ನಾನು ರಾಯ ಏಐ, ನಿಮ್ಮ ಸಹಾಯಕಿ.",
  };

  return greetings[language] || greetings.en;
}

/**
 * Get closing response
 */
export function getClosingResponse(language: "en" | "kn" | "mixed"): string {
  const closings = {
    en: "🙏 Sri Guru Raghavendraya Namaha. May Sri Guru bless you always.",
    kn: "🙏 ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರಾಯ ನಮಃ. ಶ್ರೀ ಗುರು ಯಾವಾಗಲೂ ನಿಮ್ಮನ್ನು ಆಶೀರ್ವದಿಸಲಿ.",
    mixed: "🙏 Sri Guru Raghavendraya Namaha / ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರಾಯ ನಮಃ.",
  };

  return closings[language] || closings.en;
}

/**
 * Get out-of-scope response
 */
export function getOutOfScopeResponse(language: "en" | "kn" | "mixed"): string {
  const responses = {
    en: `🙏 Namaskara!

I am **Raya AI**, the official assistant of Sri Raghavendra Swamy Math.

I can help you with:

• 🕐 Temple timings and schedule
• 📅 Events and festivals
• 🙏 Sevas and services
• 💝 Donations and contributions
• 📿 Panchanga information
• 📖 Temple history and philosophy
• 📍 Location and directions
• ❓ Frequently asked questions

For other queries, please contact the temple office directly.

🙏 Sri Guru Raghavendraya Namaha.`,

    kn: `🙏 ನಮಸ್ಕಾರ!

ನಾನು **ರಾಯ ಏಐ**, ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠದ ಅಧಿಕೃತ ಸಹಾಯಕಿ.

ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಬಹುದು:

• 🕐 ದೇವಸ್ಥಾನದ ಸಮಯ ಮತ್ತು ಕಾರ್ಯಕ್ರಮ
• 📅 ಕಾರ್ಯಕ್ರಮಗಳು ಮತ್ತು ಹಬ್ಬಗಳು
• 🙏 ಸೇವೆಗಳು
• 💝 ದೇಣಗಳು
• 📿 ಪಂಚಾಂಗ ಮಾಹಿತಿ
• 📖 ದೇವಸ್ಥಾನದ ಇತಿಹಾಸ
• 📍 ಸ್ಥಳ ಮತ್ತು ದಿಕ್ಕುಗಳು

ಇತರ ವಿಚಾರಣೆಗಳಿಗೆ, ದಯವಿಟ್ಟು ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.

🙏 ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರಾಯ ನಮಃ.`,

    mixed: `🙏 Namaskara / ನಮಸ್ಕಾರ!

I am **Raya AI**, ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠದ ಅಧಿಕೃತ ಸಹಾಯಕಿ.

I can help you with / ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಬಹುದು:

• 🕐 Temple timings / ದೇವಸ್ಥಾನದ ಸಮಯ
• 📅 Events / ಕಾರ್ಯಕ್ರಮಗಳು
• 🙏 Sevas / ಸೇವೆಗಳು
• 💝 Donations / ದೇಣಗಳು

🙏 Sri Guru Raghavendraya Namaha / ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರಾಯ ನಮಃ.`,
  };

  return responses[language] || responses.en;
}

/**
 * Get thank you response
 */
export function getThankYouResponse(language: "en" | "kn" | "mixed"): string {
  const responses = {
    en: "🙏 Thank you, dear devotee! It is our privilege to assist you. Please feel free to ask if you have any more questions. Sri Guru Raghavendraya Namaha.",
    kn: "🙏 ಧನ್ಯವಾದಗಳು, ಆತ್ಮೀಯ ಭಕ್ತರೇ! ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು ನಮ್ಮ ಸವಲತ್ತು. ಇನಷ್ಟು ಪ್ರಶ್ನೆಗಳಿದ್ದರೆ ದಯವಿಟ್ಟು ಕೇಳಿ. ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರಾಯ ನಮಃ.",
    mixed: "🙏 Thank you / ಧನ್ಯವಾದಗಳು! ನಮ್ಮ ಸವಲತ್ತು. Sri Guru Raghavendraya Namaha.",
  };

  return responses[language] || responses.en;
}
