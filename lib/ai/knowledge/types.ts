// Knowledge Article Types
// Defines the structure for knowledge base articles

export type KnowledgeLanguage = "en" | "kn" | "mixed";

export type KnowledgeCategory =
  | "temple_history"
  | "sri_raghavendra"
  | "sri_madhvacharya"
  | "guru_parampara"
  | "brindavana"
  | "mantralaya"
  | "daily_pooja"
  | "special_sevas"
  | "dress_code"
  | "donation_info"
  | "visitor_guidelines"
  | "faq"
  | "madhwa_philosophy"
  | "rituals"
  | "stotras"
  | "general";

/**
 * Knowledge article for the RAG system
 */
export interface KnowledgeArticle {
  id: string;
  slug: string;
  title: string;
  /** Kannada translation of the title */
  kannadaTitle?: string;
  category: KnowledgeCategory;
  keywords: string[];
  content: string;
  /** Kannada translation of the content */
  kannadaContent?: string;
  language: KnowledgeLanguage;
  lastReviewed?: Date;
  approved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Knowledge article creation request
 */
export interface KnowledgeArticleRequest {
  slug: string;
  title: string;
  kannadaTitle?: string;
  category: KnowledgeCategory;
  keywords: string[];
  content: string;
  kannadaContent?: string;
  language: KnowledgeLanguage;
}

/**
 * Knowledge article update request
 */
export interface KnowledgeArticleUpdate {
  slug?: string;
  title?: string;
  kannadaTitle?: string;
  category?: KnowledgeCategory;
  keywords?: string[];
  content?: string;
  kannadaContent?: string;
  language?: KnowledgeLanguage;
  lastReviewed?: Date;
  approved?: boolean;
}

/**
 * Knowledge search result
 */
export interface KnowledgeSearchResult {
  article: KnowledgeArticle;
  relevanceScore: number;
  matchedKeywords: string[];
}

/**
 * Category display names
 */
export const CATEGORY_DISPLAY_NAMES: Record<KnowledgeCategory, string> = {
  temple_history: "Temple History",
  sri_raghavendra: "Sri Raghavendra Swamy",
  sri_madhvacharya: "Sri Madhvacharya",
  guru_parampara: "Guru Parampara",
  brindavana: "Brindavana",
  mantralaya: "Mantralaya",
  daily_pooja: "Daily Pooja",
  special_sevas: "Special Sevas",
  dress_code: "Dress Code",
  donation_info: "Donation Information",
  visitor_guidelines: "Visitor Guidelines",
  faq: "FAQ",
  madhwa_philosophy: "Madhwa Philosophy",
  rituals: "Rituals",
  stotras: "Stotras",
  general: "General",
};

/**
 * Category icons for display
 */
export const CATEGORY_ICONS: Record<KnowledgeCategory, string> = {
  temple_history: "🏛️",
  sri_raghavendra: "🙏",
  sri_madhvacharya: "📿",
  guru_parampara: "👤",
  brindavana: "🌿",
  mantralaya: "🛕",
  daily_pooja: "🪔",
  special_sevas: "✨",
  dress_code: "👔",
  donation_info: "💝",
  visitor_guidelines: "📋",
  faq: "❓",
  madhwa_philosophy: "📖",
  rituals: "🪔",
  stotras: "📜",
  general: "💬",
};
