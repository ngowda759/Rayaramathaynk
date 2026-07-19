/**
 * Recommendation Types
 * Smart content recommendations for the Digital Spiritual Hub
 */

export interface RecommendationItem {
  id: string;
  type: RecommendationType;
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
  category?: string;
  tags?: string[];
  relevanceScore: number;
  reason: RecommendationReason;
}

export type RecommendationType = 
  | "knowledge"
  | "event"
  | "festival"
  | "guru"
  | "pooja"
  | "gallery";

export type RecommendationReason = 
  | "similar_category"
  | "same_guru"
  | "related_topic"
  | "popular"
  | "recent"
  | "trending"
  | "complementary";

export interface UserBehavior {
  viewedArticles: string[];
  bookmarkedArticles: string[];
  searchQueries: string[];
  visitedCategories: string[];
  lastVisit: Date;
}

export interface RecommendationConfig {
  maxRecommendations: number;
  includeCategories: RecommendationType[];
  excludeIds?: string[];
  minRelevanceScore?: number;
}

export const DEFAULT_RECOMMENDATION_CONFIG: RecommendationConfig = {
  maxRecommendations: 6,
  includeCategories: ["knowledge", "event", "festival", "guru"],
  minRelevanceScore: 0.3,
};

/**
 * Reason display names
 */
export const REASON_LABELS: Record<RecommendationReason, string> = {
  similar_category: "Same Category",
  same_guru: "Same Guru",
  related_topic: "Related Topic",
  popular: "Popular",
  recent: "Recently Added",
  trending: "Trending",
  complementary: "You Might Also Like",
};

/**
 * Type display names
 */
export const TYPE_LABELS: Record<RecommendationType, string> = {
  knowledge: "Article",
  event: "Event",
  festival: "Festival",
  guru: "Guru",
  pooja: "Pooja",
  gallery: "Gallery",
};

/**
 * Type icons
 */
export const TYPE_ICONS: Record<RecommendationType, string> = {
  knowledge: "📚",
  event: "📅",
  festival: "🎉",
  guru: "🙏",
  pooja: "🕉️",
  gallery: "🖼️",
};
