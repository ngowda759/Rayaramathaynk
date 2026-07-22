// Knowledge Article Types
// Defines the structure for knowledge base articles

export type KnowledgeLanguage = "en" | "kn" | "mixed";

// Knowledge category type - includes default + custom categories
export type KnowledgeCategory =
  // Default categories (matching public pages)
  | "aaradhane"
  | "about"
  | "donation"
  | "events"
  | "facilities"
  | "future-plans"
  | "gallery"
  | "guruparampara"
  | "journey"
  | "pooja"
  | "sevas"
  | "shlokas"
  | "temple-explorer"
  | "testimonials"
  | "trust"
  | "volunteer"
  | "faq"
  | "contact"
  | "history"
  | "raghavendra-swamy"
  | "brindavana"
  | "madhvacharya"
  | "mantralaya"
  | "photography"
  | "accommodation"
  // Legacy categories
  | "temple_history"
  | "sri_raghavendra"
  | "sri_madhvacharya"
  | "guru_parampara"
  | "daily_pooja"
  | "special_sevas"
  | "dress_code"
  | "donation_info"
  | "visitor_guidelines"
  | "madhwa_philosophy"
  | "rituals"
  | "stotras"
  | "general"
  // Custom categories (any string)
  | string;

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
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  // Public page categories
  aaradhane: "Aaradhane",
  about: "About",
  donation: "Donation",
  events: "Events",
  facilities: "Facilities",
  "future-plans": "Future Plans",
  gallery: "Gallery",
  guruparampara: "Guru Parampara",
  journey: "Temple Journey",
  pooja: "Pooja Services",
  sevas: "Sevas",
  shlokas: "Shlokas",
  "temple-explorer": "Temple Explorer",
  testimonials: "Testimonials",
  trust: "Trust",
  volunteer: "Volunteer",
  faq: "FAQ",
  contact: "Contact",
  history: "History",
  "raghavendra-swamy": "Sri Raghavendra Swamy",
  brindavana: "Brindavana",
  madhvacharya: "Sri Madhvacharya",
  mantralaya: "Mantralaya",
  photography: "Photography",
  accommodation: "Accommodation",
  // Legacy categories
  temple_history: "Temple History",
  sri_raghavendra: "Sri Raghavendra Swamy",
  sri_madhvacharya: "Sri Madhvacharya",
  guru_parampara: "Guru Parampara",
  daily_pooja: "Daily Pooja",
  special_sevas: "Special Sevas",
  dress_code: "Dress Code",
  donation_info: "Donation Information",
  visitor_guidelines: "Visitor Guidelines",
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
