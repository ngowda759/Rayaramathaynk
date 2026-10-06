// Knowledge Repository - Supabase operations for knowledge base
// Handles CRUD operations for knowledge articles

import { createAdminClient } from "@/lib/supabase/admin";
import {
  KnowledgeArticle,
  KnowledgeArticleRequest,
  KnowledgeArticleUpdate,
  KnowledgeSearchResult,
  KnowledgeCategory,
} from "./types";
import { SEED_ARTICLES } from "./seed";
import { knowledgeArticleSchema } from "./validation";

const TABLE_NAME = "ai_knowledge";

// Cache for knowledge articles
let cachedArticles: KnowledgeArticle[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Convert Supabase row to KnowledgeArticle
 */
function rowToArticle(row: any): KnowledgeArticle | null {
  try {
    const article = {
      id: row.id,
      slug: row.slug || "",
      title: row.title || "",
      kannadaTitle: row.kannada_title || undefined,
      category: row.category || "general",
      keywords: row.keywords || [],
      content: row.content || "",
      kannadaContent: row.kannada_content || undefined,
      language: row.language || "en",
      lastReviewed: row.last_reviewed ? new Date(row.last_reviewed) : undefined,
      approved: row.approved ?? false,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };

    // Validate with Zod
    return knowledgeArticleSchema.parse(article);
  } catch (err) {
    console.error("[Knowledge Repository] Error parsing article row:", err);
    return null;
  }
}

/**
 * Get all approved knowledge articles
 */
export async function getKnowledgeArticles(): Promise<KnowledgeArticle[]> {
  const now = Date.now();
  if (cachedArticles.length > 0 && now - lastFetchTime < CACHE_DURATION) {
    return cachedArticles;
  }

  try {
    const supabase = await createAdminClient();

    // Fallback to seed data if supabase client unavailable
    if (!supabase) {
      return SEED_ARTICLES as KnowledgeArticle[];
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("approved", true)
      .order("category", { ascending: true })
      .order("title", { ascending: true });

    if (error) {
      throw error;
    }

    const articles: KnowledgeArticle[] = [];
    if (data) {
      for (const row of data) {
        const article = rowToArticle(row);
        if (article) {
          articles.push(article);
        }
      }
    }

    // If no articles in Supabase, use seed data
    if (articles.length === 0) {
      cachedArticles = SEED_ARTICLES as KnowledgeArticle[];
    } else {
      cachedArticles = articles;
    }
    lastFetchTime = now;

    return cachedArticles;
  } catch (error) {
    console.error("[Knowledge Repository] Error fetching articles:", error);
    return cachedArticles.length > 0 ? cachedArticles : (SEED_ARTICLES as KnowledgeArticle[]);
  }
}

/**
 * Get articles by category
 */
export async function getArticlesByCategory(
  category: KnowledgeCategory
): Promise<KnowledgeArticle[]> {
  const articles = await getKnowledgeArticles();
  return articles.filter((a) => a.category === category);
}

/**
 * Get single article by ID
 */
export async function getArticleById(id: string): Promise<KnowledgeArticle | null> {
  try {
    const supabase = await createAdminClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("id", id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return rowToArticle(data);
  } catch (error) {
    console.error("[Knowledge Repository] Error fetching article:", error);
    return null;
  }
}

/**
 * Get article by slug
 */
export async function getArticleBySlug(slug: string): Promise<KnowledgeArticle | null> {
  const articles = await getKnowledgeArticles();
  return articles.find((a) => a.slug === slug) || null;
}

/**
 * Search knowledge articles
 * Note: Keeps exact JS scoring algorithm as legacy implementation to preserve retrieval behavior
 */
export async function searchArticles(
  queryText: string,
  maxResults = 5
): Promise<KnowledgeSearchResult[]> {
  const articles = await getKnowledgeArticles();
  const normalizedQuery = queryText.toLowerCase().trim();

  if (!normalizedQuery) {
    return [];
  }

  const queryWords = normalizedQuery.split(/\s+/);

  const results: KnowledgeSearchResult[] = articles
    .map((article) => {
      let relevanceScore = 0;
      const matchedKeywords: string[] = [];

      // Check title match
      const titleLower = article.title.toLowerCase();
      queryWords.forEach((word) => {
        if (titleLower.includes(word)) {
          relevanceScore += 10;
        }
      });

      // Check content match
      const contentLower = article.content.toLowerCase();
      queryWords.forEach((word) => {
        if (contentLower.includes(word)) {
          relevanceScore += 5;
        }
      });

      // Check keyword match (highest weight)
      article.keywords.forEach((keyword) => {
        const keywordLower = keyword.toLowerCase();
        queryWords.forEach((word) => {
          if (keywordLower.includes(word) || word.includes(keywordLower)) {
            relevanceScore += 15;
            if (!matchedKeywords.includes(keyword)) {
              matchedKeywords.push(keyword);
            }
          }
        });
      });

      return {
        article,
        relevanceScore,
        matchedKeywords,
      };
    })
    .filter((r) => r.relevanceScore >= 10) // Minimum relevance threshold
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);

  return results;
}

/**
 * Create new knowledge article
 */
export async function createArticle(
  data: KnowledgeArticleRequest
): Promise<string> {
  const supabase = await createAdminClient();
  if (!supabase) {
    throw new Error("Supabase client not configured");
  }

  const insertData = {
    slug: data.slug,
    title: data.title,
    kannada_title: data.kannadaTitle,
    category: data.category,
    keywords: data.keywords,
    content: data.content,
    kannada_content: data.kannadaContent,
    language: data.language,
    approved: false,
  };

  const { data: newRow, error } = await supabase
    .from(TABLE_NAME)
    .insert(insertData)
    .select("id")
    .single();

  if (error || !newRow) {
    throw error || new Error("Failed to create article");
  }

  // Clear cache
  cachedArticles = [];
  lastFetchTime = 0;

  return newRow.id;
}

/**
 * Update knowledge article
 */
export async function updateArticle(
  id: string,
  data: KnowledgeArticleUpdate
): Promise<void> {
  const supabase = await createAdminClient();
  if (!supabase) {
    throw new Error("Supabase client not configured");
  }

  const updateData: any = {};
  if (data.slug !== undefined) updateData.slug = data.slug;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.kannadaTitle !== undefined) updateData.kannada_title = data.kannadaTitle;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.keywords !== undefined) updateData.keywords = data.keywords;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.kannadaContent !== undefined) updateData.kannada_content = data.kannadaContent;
  if (data.language !== undefined) updateData.language = data.language;
  if (data.lastReviewed !== undefined) updateData.last_reviewed = data.lastReviewed?.toISOString();
  if (data.approved !== undefined) updateData.approved = data.approved;

  const { error } = await supabase
    .from(TABLE_NAME)
    .update(updateData)
    .eq("id", id);

  if (error) {
    throw error;
  }

  // Clear cache
  cachedArticles = [];
  lastFetchTime = 0;
}

/**
 * Delete knowledge article
 */
export async function deleteArticle(id: string): Promise<void> {
  const supabase = await createAdminClient();
  if (!supabase) {
    throw new Error("Supabase client not configured");
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }

  // Clear cache
  cachedArticles = [];
  lastFetchTime = 0;
}

/**
 * Approve knowledge article
 */
export async function approveArticle(id: string): Promise<void> {
  return updateArticle(id, { approved: true, lastReviewed: new Date() });
}

/**
 * Mark article as reviewed
 */
export async function markAsReviewed(id: string): Promise<void> {
  return updateArticle(id, { lastReviewed: new Date() });
}

/**
 * Get pending articles (not approved)
 */
export async function getPendingArticles(): Promise<KnowledgeArticle[]> {
  try {
    const supabase = await createAdminClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("approved", false);

    if (error) throw error;

    const articles: KnowledgeArticle[] = [];
    if (data) {
      for (const row of data) {
        const article = rowToArticle(row);
        if (article) {
          articles.push(article);
        }
      }
    }

    return articles;
  } catch (error) {
    console.error("[Knowledge Repository] Error fetching pending articles:", error);
    return [];
  }
}

/**
 * Clear knowledge cache
 */
export function clearKnowledgeCache(): void {
  cachedArticles = [];
  lastFetchTime = 0;
}

/**
 * Get all categories with article counts
 */
export async function getCategoriesWithCounts(): Promise<
  Array<{ category: KnowledgeCategory; count: number }>
> {
  const articles = await getKnowledgeArticles();
  const counts = new Map<KnowledgeCategory, number>();

  articles.forEach((article) => {
    const current = counts.get(article.category) || 0;
    counts.set(article.category, current + 1);
  });

  return Array.from(counts.entries()).map(([category, count]) => ({
    category,
    count,
  }));
}
