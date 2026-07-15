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
