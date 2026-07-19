/**
 * Knowledge Service
 * Public-facing service for Knowledge Centre
 */

import {
  getKnowledgeArticles,
  getArticlesByCategory,
  getArticleBySlug,
  searchArticles,
  getCategoriesWithCounts,
} from "@/lib/ai/knowledge/repository";
import {
  KnowledgeArticle,
  KnowledgeCategory,
  KnowledgeSearchResult,
} from "@/lib/ai/knowledge/types";
import {
  KnowledgeCentreData,
  KnowledgeArticlePublic,
  KnowledgeCategoryInfo,
  ArticlePageData,
  BreadcrumbItem,
  KNOWLEDGE_CATEGORY_CONFIG,
} from "@/types/knowledge";

// View count cache (in-memory, would be Firestore in production)
const viewCounts = new Map<string, number>();

/**
 * Get all categories with article counts
 */
export async function getKnowledgeCategories(): Promise<KnowledgeCategoryInfo[]> {
  const counts = await getCategoriesWithCounts();
  const countMap = new Map(counts.map((c) => [c.category, c.count]));

  const categories: KnowledgeCategoryInfo[] = Object.entries(KNOWLEDGE_CATEGORY_CONFIG)
    .filter(([key]) => key !== "general" || countMap.has(key as KnowledgeCategory))
    .map(([key, config]) => ({
      id: key as KnowledgeCategory,
      name: config.name,
      description: config.description,
      icon: config.icon,
      slug: config.slug,
      articleCount: countMap.get(key as KnowledgeCategory) || 0,
    }))
    .sort((a, b) => {
      const orderA = KNOWLEDGE_CATEGORY_CONFIG[a.id]?.order || 99;
      const orderB = KNOWLEDGE_CATEGORY_CONFIG[b.id]?.order || 99;
      return orderA - orderB;
    });

  return categories;
}

/**
 * Get popular articles (most viewed)
 */
export async function getPopularArticles(limit = 5): Promise<KnowledgeArticle[]> {
  const articles = await getKnowledgeArticles();
  
  return articles
    .map((article) => ({
      ...article,
      viewCount: viewCounts.get(article.id) || 0,
    }))
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    .slice(0, limit)
    .map(({ viewCount, ...article }: KnowledgeArticle & { viewCount?: number }) => article);
}

/**
 * Get recent articles
 */
export async function getRecentArticles(limit = 5): Promise<KnowledgeArticle[]> {
  const articles = await getKnowledgeArticles();
  
  return [...articles]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

/**
 * Get featured article
 */
export async function getFeaturedArticle(): Promise<KnowledgeArticle | null> {
  const articles = await getKnowledgeArticles();
  
  // Return the most recently updated article as featured
  return articles.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0] || null;
}

/**
 * Get complete Knowledge Centre data
 */
export async function getKnowledgeCentreData(): Promise<KnowledgeCentreData> {
  const [categories, popularArticles, recentArticles, featuredArticle] = await Promise.all([
    getKnowledgeCategories(),
    getPopularArticles(5),
    getRecentArticles(5),
    getFeaturedArticle(),
  ]);

  return {
    categories,
    popularArticles,
    recentArticles,
    featuredArticle,
  };
}

/**
 * Calculate reading time for article content
 */
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Convert article to public format with metadata
 */
function toPublicArticle(article: KnowledgeArticle): KnowledgeArticlePublic {
  return {
    ...article,
    readingTime: calculateReadingTime(article.content),
    viewCount: viewCounts.get(article.id) || 0,
  };
}

/**
 * Get article by slug with full metadata
 */
export async function getPublicArticleBySlug(slug: string): Promise<KnowledgeArticlePublic | null> {
  const article = await getArticleBySlug(slug);
  if (!article) return null;

  // Increment view count
  const currentViews = viewCounts.get(article.id) || 0;
  viewCounts.set(article.id, currentViews + 1);

  return toPublicArticle(article);
}

/**
 * Get articles by category
 */
export async function getPublicArticlesByCategory(
  category: KnowledgeCategory
): Promise<KnowledgeArticlePublic[]> {
  const articles = await getArticlesByCategory(category);
  return articles.map(toPublicArticle);
}

/**
 * Search articles with suggestions
 */
export async function searchKnowledge(
  query: string,
  maxResults = 10
): Promise<KnowledgeSearchResult[]> {
  return searchArticles(query, maxResults);
}

/**
 * Get related articles based on category and keywords
 */
export async function getRelatedArticles(
  article: KnowledgeArticle,
  limit = 4
): Promise<KnowledgeArticle[]> {
  const allArticles = await getKnowledgeArticles();
  
  // Filter out current article
  const others = allArticles.filter((a) => a.id !== article.id);
  
  // Score by relevance
  const scored = others.map((a) => {
    let score = 0;
    
    // Same category = high score
    if (a.category === article.category) score += 10;
    
    // Shared keywords = higher score
    const sharedKeywords = a.keywords.filter((k) =>
      article.keywords.includes(k)
    );
    score += sharedKeywords.length * 5;
    
    return { article: a, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.article);
}

/**
 * Get article page data including navigation
 */
export async function getArticlePageData(
  slug: string
): Promise<ArticlePageData | null> {
  const article = await getPublicArticleBySlug(slug);
  if (!article) return null;

  const [relatedArticles, allInCategory] = await Promise.all([
    getRelatedArticles(article, 4),
    getArticlesByCategory(article.category),
  ]);

  // Sort by title for next/prev navigation
  const sortedInCategory = [...allInCategory].sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  const currentIndex = sortedInCategory.findIndex((a) => a.id === article.id);
  const nextArticle = currentIndex < sortedInCategory.length - 1
    ? sortedInCategory[currentIndex + 1]
    : undefined;
  const previousArticle = currentIndex > 0
    ? sortedInCategory[currentIndex - 1]
    : undefined;

  // Build breadcrumbs
  const categoryConfig = KNOWLEDGE_CATEGORY_CONFIG[article.category];
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Knowledge Centre", href: "/knowledge" },
  ];

  if (categoryConfig) {
    breadcrumbs.push({
      label: categoryConfig.name,
      href: `/knowledge/${categoryConfig.slug}`,
    });
  }

  breadcrumbs.push({ label: article.title });

  return {
    article,
    relatedArticles,
    breadcrumbs,
    nextArticle,
    previousArticle,
  };
}

/**
 * Get all article slugs for static generation
 */
export async function getAllArticleSlugs(): Promise<string[]> {
  const articles = await getKnowledgeArticles();
  return articles.map((a) => a.slug);
}

/**
 * Get all category slugs
 */
export function getAllCategorySlugs(): string[] {
  return Object.values(KNOWLEDGE_CATEGORY_CONFIG)
    .map((c) => c.slug);
}

// Export service instance
export const knowledgeService = {
  getKnowledgeCentreData,
  getKnowledgeCategories,
  getPopularArticles,
  getRecentArticles,
  getFeaturedArticle,
  getPublicArticleBySlug,
  getPublicArticlesByCategory,
  searchKnowledge,
  getRelatedArticles,
  getArticlePageData,
  getAllArticleSlugs,
  getAllCategorySlugs,
};
