/**
 * Knowledge Centre Types
 * Extended types for the public-facing Knowledge Centre
 */

import { 
  KnowledgeCategory,
  KnowledgeArticle,
} from "@/lib/ai/knowledge/types";

// Re-export existing types
export type {
  KnowledgeLanguage,
  KnowledgeCategory,
  KnowledgeArticle,
  KnowledgeArticleRequest,
  KnowledgeArticleUpdate,
  KnowledgeSearchResult,
} from "@/lib/ai/knowledge/types";

export {
  CATEGORY_DISPLAY_NAMES,
  CATEGORY_ICONS,
} from "@/lib/ai/knowledge/types";

/**
 * Knowledge article with additional metadata for public display
 */
export type KnowledgeArticlePublic = KnowledgeArticle & {
  relatedArticles?: KnowledgeArticle[];
  readingTime?: number;
  viewCount?: number;
};

/**
 * Knowledge category with metadata
 */
export interface KnowledgeCategoryInfo {
  id: KnowledgeCategory;
  name: string;
  description: string;
  icon: string;
  articleCount: number;
  slug: string;
}

/**
 * Knowledge centre homepage data
 */
export interface KnowledgeCentreData {
  categories: KnowledgeCategoryInfo[];
  popularArticles: KnowledgeArticle[];
  recentArticles: KnowledgeArticle[];
  featuredArticle: KnowledgeArticle | null;
}

/**
 * Bookmark for local storage
 */
export interface KnowledgeBookmark {
  id: string;
  slug: string;
  title: string;
  category: KnowledgeCategory;
  bookmarkedAt: string;
}

/**
 * Recently viewed article
 */
export interface RecentlyViewed {
  id: string;
  slug: string;
  title: string;
  category: KnowledgeCategory;
  viewedAt: string;
}

/**
 * Search suggestions
 */
export interface SearchSuggestion {
  text: string;
  type: "article" | "category" | "faq";
  slug?: string;
  category?: KnowledgeCategory;
}

/**
 * Knowledge article page data
 */
export interface ArticlePageData {
  article: KnowledgeArticlePublic;
  relatedArticles: KnowledgeArticle[];
  breadcrumbs: BreadcrumbItem[];
  nextArticle?: KnowledgeArticle;
  previousArticle?: KnowledgeArticle;
}

/**
 * Breadcrumb navigation item
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Category display configuration
 */
export const KNOWLEDGE_CATEGORY_CONFIG: Record<KnowledgeCategory, {
  name: string;
  description: string;
  icon: string;
  slug: string;
  order: number;
}> = {
  sri_raghavendra: {
    name: "Sri Raghavendra Swamy",
    description: "Learn about the life, miracles, and legacy of Sri Raghavendra Swamy",
    icon: "🙏",
    slug: "sri-raghavendra-swamy",
    order: 1,
  },
  guru_parampara: {
    name: "Guru Parampara",
    description: "The lineage of spiritual masters and their teachings",
    icon: "👤",
    slug: "guru-parampara",
    order: 2,
  },
  temple_history: {
    name: "Temple History",
    description: "History and heritage of the Sri Raghavendra Swamy Matha",
    icon: "🏛️",
    slug: "temple-history",
    order: 3,
  },
  madhwa_philosophy: {
    name: "Madhwa Philosophy",
    description: "Dvaita philosophy and its principles",
    icon: "📿",
    slug: "madhwa-philosophy",
    order: 4,
  },
  rituals: {
    name: "Rituals",
    description: "Daily rituals and special ceremonies",
    icon: "🪔",
    slug: "rituals",
    order: 5,
  },
  visitor_guidelines: {
    name: "Visitor Guide",
    description: "Guidelines for visiting the temple",
    icon: "📋",
    slug: "visitor-guide",
    order: 6,
  },
  dress_code: {
    name: "Dress Code",
    description: "Appropriate attire for temple visits",
    icon: "👔",
    slug: "dress-code",
    order: 7,
  },
  faq: {
    name: "Frequently Asked Questions",
    description: "Common questions and answers about the temple",
    icon: "❓",
    slug: "faq",
    order: 8,
  },
  // Legacy categories (for backwards compatibility)
  sri_madhvacharya: {
    name: "Sri Madhvacharya",
    description: "Life and teachings of Sri Madhvacharya",
    icon: "📖",
    slug: "sri-madhvacharya",
    order: 9,
  },
  brindavana: {
    name: "Brindavana",
    description: "The sacred brindavana of Sri Raghavendra Swamy",
    icon: "🌿",
    slug: "brindavana",
    order: 10,
  },
  mantralaya: {
    name: "Mantralaya",
    description: "About Mantralaya and its significance",
    icon: "🛕",
    slug: "mantralaya",
    order: 11,
  },
  daily_pooja: {
    name: "Daily Pooja",
    description: "Daily pooja schedule and procedures",
    icon: "🕉️",
    slug: "daily-pooja",
    order: 12,
  },
  special_sevas: {
    name: "Special Sevas",
    description: "Special sevas and their significance",
    icon: "✨",
    slug: "special-sevas",
    order: 13,
  },
  donation_info: {
    name: "Donation Information",
    description: "How to donate and where your contributions go",
    icon: "💝",
    slug: "donation-info",
    order: 14,
  },
  stotras: {
    name: "Stotras",
    description: "Sacred hymns, stotrams, and devotional songs",
    icon: "📜",
    slug: "stotras",
    order: 15,
  },
  general: {
    name: "General",
    description: "General information and miscellaneous topics",
    icon: "💬",
    slug: "general",
    order: 99,
  },
};
