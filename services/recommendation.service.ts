/**
 * Recommendation Service
 * Smart content recommendations based on user behavior and content relationships
 */

import {
  RecommendationItem,
  RecommendationType,
  RecommendationReason,
  RecommendationConfig,
  DEFAULT_RECOMMENDATION_CONFIG,
  UserBehavior,
} from "@/types/recommendation";
import { GURU_BIOGRAPHIES } from "@/types/guru";
import { getAllFestivals } from "@/lib/festival-utils";
import { knowledgeService } from "./knowledge.service";

/**
 * Content pool interfaces
 */
interface KnowledgeArticle {
  id: string;
  slug: string;
  title: string;
  content: string;
  category: string;
  tags?: string[];
}

interface EventItem {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string;
}

/**
 * Get recommendations for a user based on their behavior
 */
export async function getRecommendationsForUser(
  userBehavior: UserBehavior,
  config: Partial<RecommendationConfig> = {}
): Promise<RecommendationItem[]> {
  const finalConfig = { ...DEFAULT_RECOMMENDATION_CONFIG, ...config };
  const recommendations: RecommendationItem[] = [];

  // Get content pools
  const knowledgeArticles = await getKnowledgeArticles();
  const festivals = getAllFestivals();
  const events = await getUpcomingEvents();

  // 1. Get recommendations based on recently viewed (same category)
  const viewedRecommendations = getViewedBasedRecommendations(
    userBehavior.viewedArticles,
    knowledgeArticles,
    festivals,
    events,
    finalConfig
  );
  recommendations.push(...viewedRecommendations);

  // 2. Get recommendations based on bookmarked articles
  const bookmarkRecommendations = getBookmarkBasedRecommendations(
    userBehavior.bookmarkedArticles,
    knowledgeArticles,
    finalConfig
  );
  recommendations.push(...bookmarkRecommendations);

  // 3. Get popular recommendations
  const popularRecommendations = getPopularRecommendations(
    knowledgeArticles,
    festivals,
    events,
    userBehavior.viewedArticles,
    finalConfig
  );
  recommendations.push(...popularRecommendations);

  // 4. Get complementary recommendations
  const complementaryRecommendations = getComplementaryRecommendations(
    userBehavior.visitedCategories,
    knowledgeArticles,
    events,
    finalConfig
  );
  recommendations.push(...complementaryRecommendations);

  // Deduplicate and sort by relevance
  const uniqueRecommendations = deduplicateRecommendations(recommendations);
  
  // Sort by relevance score
  uniqueRecommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Apply filters
  const filtered = uniqueRecommendations
    .filter(r => r.relevanceScore >= (finalConfig.minRelevanceScore || 0))
    .filter(r => !finalConfig.excludeIds?.includes(r.id))
    .slice(0, finalConfig.maxRecommendations);

  return filtered;
}

/**
 * Get recommendations for a specific article/page
 */
export async function getRecommendationsForPage(
  currentId: string,
  currentType: RecommendationType,
  currentCategory?: string,
  config: Partial<RecommendationConfig> = {}
): Promise<RecommendationItem[]> {
  const finalConfig = { ...DEFAULT_RECOMMENDATION_CONFIG, ...config };
  const recommendations: RecommendationItem[] = [];

  const knowledgeArticles = await getKnowledgeArticles();
  const festivals = getAllFestivals();

  // Same category recommendations
  if (currentCategory && currentType === "knowledge") {
    const sameCategory = knowledgeArticles
      .filter(a => a.category === currentCategory && a.id !== currentId)
      .slice(0, 3)
      .map(a => ({
        id: a.id,
        type: "knowledge" as RecommendationType,
        title: a.title,
        description: a.content.slice(0, 100) + "...",
        url: `/knowledge/article/${a.slug}`,
        category: a.category,
        relevanceScore: 0.9,
        reason: "similar_category" as RecommendationReason,
      }));
    recommendations.push(...sameCategory);
  }

  // Related topics (tag-based)
  if (currentType === "knowledge") {
    const current = knowledgeArticles.find(a => a.id === currentId);
    if (current?.tags) {
      const tagRelated = knowledgeArticles
        .filter(a => a.id !== currentId && a.tags?.some(t => current.tags!.includes(t)))
        .slice(0, 2)
        .map(a => ({
          id: a.id,
          type: "knowledge" as RecommendationType,
          title: a.title,
          description: a.content.slice(0, 100) + "...",
          url: `/knowledge/article/${a.slug}`,
          category: a.category,
          relevanceScore: 0.7,
          reason: "related_topic" as RecommendationReason,
        }));
      recommendations.push(...tagRelated);
    }
  }

  // Guru-related recommendations
  if (currentType === "guru" || currentType === "knowledge") {
    const guruRecommendations = getGuruRecommendations(currentId);
    recommendations.push(...guruRecommendations);
  }

  // Festival recommendations (for spiritual content)
  if (currentType === "knowledge" || currentType === "guru") {
    const upcomingFestival = festivals
      .filter(f => new Date(f.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
    
    if (upcomingFestival) {
      recommendations.push({
        id: upcomingFestival.id,
        type: "festival",
        title: upcomingFestival.name,
        description: upcomingFestival.description,
        url: "/calendar/festivals",
        category: "Festival",
        relevanceScore: 0.5,
        reason: "complementary",
      });
    }
  }

  // Deduplicate and sort
  const uniqueRecommendations = deduplicateRecommendations(recommendations);
  uniqueRecommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return uniqueRecommendations.slice(0, finalConfig.maxRecommendations);
}

// Helper functions

async function getKnowledgeArticles(): Promise<KnowledgeArticle[]> {
  try {
    // Use popular and recent articles as a pool
    const [popular, recent] = await Promise.all([
      knowledgeService.getPopularArticles(10),
      knowledgeService.getRecentArticles(10),
    ]);
    
    // Combine and deduplicate
    const seen = new Set<string>();
    const combined: KnowledgeArticle[] = [];
    
    [...popular, ...recent].forEach(a => {
      if (!seen.has(a.id)) {
        seen.add(a.id);
        combined.push({
          id: a.id,
          slug: a.slug,
          title: a.title,
          content: a.content,
          category: a.category,
          tags: a.keywords,
        });
      }
    });
    
    return combined;
  } catch {
    return [];
  }
}

async function getUpcomingEvents(): Promise<EventItem[]> {
  // This would typically come from the event service
  return [];
}

function getViewedBasedRecommendations(
  viewedIds: string[],
  knowledgeArticles: KnowledgeArticle[],
  festivals: ReturnType<typeof getAllFestivals>,
  events: EventItem[],
  config: RecommendationConfig
): RecommendationItem[] {
  if (viewedIds.length === 0) return [];

  const recommendations: RecommendationItem[] = [];
  const viewedCategories = new Set<string>();

  // Get categories from viewed articles
  viewedIds.forEach(id => {
    const article = knowledgeArticles.find(a => a.id === id);
    if (article) {
      viewedCategories.add(article.category);
    }
  });

  // Recommend from same categories
  viewedCategories.forEach(category => {
    const sameCategory = knowledgeArticles
      .filter(a => a.category === category && !viewedIds.includes(a.id))
      .slice(0, 2)
      .map(a => ({
        id: a.id,
        type: "knowledge" as RecommendationType,
        title: a.title,
        description: a.content.slice(0, 100) + "...",
        url: `/knowledge/article/${a.slug}`,
        category: a.category,
        relevanceScore: 0.8,
        reason: "similar_category" as RecommendationReason,
      }));
    recommendations.push(...sameCategory);
  });

  return recommendations;
}

function getBookmarkBasedRecommendations(
  bookmarkedIds: string[],
  knowledgeArticles: KnowledgeArticle[],
  config: RecommendationConfig
): RecommendationItem[] {
  if (bookmarkedIds.length === 0) return [];

  const recommendations: RecommendationItem[] = [];

  // Get tags from bookmarked articles
  const bookmarkTags = new Set<string>();
  bookmarkedIds.forEach(id => {
    const article = knowledgeArticles.find(a => a.id === id);
    article?.tags?.forEach(tag => bookmarkTags.add(tag));
  });

  // Find related articles by tags
  const tagRelated = knowledgeArticles
    .filter(a => !bookmarkedIds.includes(a.id))
    .filter(a => a.tags?.some(t => bookmarkTags.has(t)))
    .slice(0, 3)
    .map(a => ({
      id: a.id,
      type: "knowledge" as RecommendationType,
      title: a.title,
      description: a.content.slice(0, 100) + "...",
      url: `/knowledge/article/${a.slug}`,
      category: a.category,
      relevanceScore: 0.7,
      reason: "related_topic" as RecommendationReason,
    }));

  recommendations.push(...tagRelated);

  return recommendations;
}

function getPopularRecommendations(
  knowledgeArticles: KnowledgeArticle[],
  festivals: ReturnType<typeof getAllFestivals>,
  events: EventItem[],
  excludeIds: string[],
  config: RecommendationConfig
): RecommendationItem[] {
  const recommendations: RecommendationItem[] = [];

  // Popular knowledge articles (would normally come from analytics)
  const popularKnowledge = knowledgeArticles
    .filter(a => !excludeIds.includes(a.id))
    .slice(0, 2)
    .map(a => ({
      id: a.id,
      type: "knowledge" as RecommendationType,
      title: a.title,
      description: a.content.slice(0, 100) + "...",
      url: `/knowledge/article/${a.slug}`,
      category: a.category,
      relevanceScore: 0.6,
      reason: "popular" as RecommendationReason,
    }));
  recommendations.push(...popularKnowledge);

  // Upcoming festivals
  const upcomingFestivals = festivals
    .filter(f => new Date(f.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 1)
    .map(f => ({
      id: f.id,
      type: "festival" as RecommendationType,
      title: f.name,
      description: f.description,
      url: "/calendar/festivals",
      category: "Festival",
      relevanceScore: 0.5,
      reason: "trending" as RecommendationReason,
    }));
  recommendations.push(...upcomingFestivals);

  return recommendations;
}

function getComplementaryRecommendations(
  visitedCategories: string[],
  knowledgeArticles: KnowledgeArticle[],
  events: EventItem[],
  config: RecommendationConfig
): RecommendationItem[] {
  const recommendations: RecommendationItem[] = [];

  // Recommend from complementary categories
  const complementaryCategories = ["faq", "visitor_guide", "dress_code"];
  const complementary = knowledgeArticles
    .filter(a => complementaryCategories.includes(a.category))
    .slice(0, 2)
    .map(a => ({
      id: a.id,
      type: "knowledge" as RecommendationType,
      title: a.title,
      description: a.content.slice(0, 100) + "...",
      url: `/knowledge/article/${a.slug}`,
      category: a.category,
      relevanceScore: 0.4,
      reason: "complementary" as RecommendationReason,
    }));
  recommendations.push(...complementary);

  return recommendations;
}

function getGuruRecommendations(
  currentGuruId: string
): RecommendationItem[] {
  const recommendations: RecommendationItem[] = [];

  // Find adjacent gurus in parampara
  const currentGuru = GURU_BIOGRAPHIES.find(g => g.id === currentGuruId);
  if (currentGuru) {
    const currentIndex = GURU_BIOGRAPHIES.findIndex(g => g.id === currentGuruId);
    
    // Previous guru
    if (currentIndex > 0) {
      const prevGuru = GURU_BIOGRAPHIES[currentIndex - 1];
      recommendations.push({
        id: prevGuru.id,
        type: "guru",
        title: prevGuru.name,
        description: prevGuru.description,
        url: "/guruparampara",
        category: "Guru Parampara",
        relevanceScore: 0.9,
        reason: "same_guru",
      });
    }

    // Next guru
    if (currentIndex < GURU_BIOGRAPHIES.length - 1) {
      const nextGuru = GURU_BIOGRAPHIES[currentIndex + 1];
      recommendations.push({
        id: nextGuru.id,
        type: "guru",
        title: nextGuru.name,
        description: nextGuru.description,
        url: "/guruparampara",
        category: "Guru Parampara",
        relevanceScore: 0.9,
        reason: "same_guru",
      });
    }
  }

  return recommendations;
}

function deduplicateRecommendations(
  recommendations: RecommendationItem[]
): RecommendationItem[] {
  const seen = new Map<string, RecommendationItem>();
  
  recommendations.forEach(rec => {
    const existing = seen.get(rec.id);
    if (!existing || existing.relevanceScore < rec.relevanceScore) {
      seen.set(rec.id, rec);
    }
  });

  return Array.from(seen.values());
}

/**
 * Get personalized homepage recommendations
 */
export async function getHomepageRecommendations(): Promise<RecommendationItem[]> {
  const recommendations: RecommendationItem[] = [];

  // Featured festival
  const festivals = getAllFestivals();
  const upcomingFestival = festivals
    .filter(f => new Date(f.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  if (upcomingFestival) {
    recommendations.push({
      id: upcomingFestival.id,
      type: "festival",
      title: upcomingFestival.name,
      description: upcomingFestival.description,
      url: "/calendar/festivals",
      category: "Festival",
      relevanceScore: 1.0,
      reason: "trending",
    });
  }

  // Featured guru
  const raghavendra = GURU_BIOGRAPHIES.find(g => g.id === "raghavendra-teertha");
  if (raghavendra) {
    recommendations.push({
      id: raghavendra.id,
      type: "guru",
      title: raghavendra.name,
      description: raghavendra.description,
      url: "/guruparampara",
      category: "Guru Parampara",
      relevanceScore: 0.95,
      reason: "popular",
    });
  }

  // Popular knowledge articles
  const knowledgeArticles = await getKnowledgeArticles();
  const popularArticles = knowledgeArticles.slice(0, 4).map(a => ({
    id: a.id,
    type: "knowledge" as RecommendationType,
    title: a.title,
    description: a.content.slice(0, 100) + "...",
    url: `/knowledge/article/${a.slug}`,
    category: a.category,
    relevanceScore: 0.8,
    reason: "popular" as RecommendationReason,
  }));
  recommendations.push(...popularArticles);

  return recommendations;
}
