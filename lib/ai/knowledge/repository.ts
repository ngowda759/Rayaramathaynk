// Knowledge Repository - Firebase operations for knowledge base
// Handles CRUD operations for knowledge articles

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  DocumentData,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import {
  KnowledgeArticle,
  KnowledgeArticleRequest,
  KnowledgeArticleUpdate,
  KnowledgeSearchResult,
  KnowledgeCategory,
} from "./types";
import { SEED_ARTICLES } from "./seed";

const COLLECTION_NAME = "knowledge";

// Cache for knowledge articles
let cachedArticles: KnowledgeArticle[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Convert Firestore doc to KnowledgeArticle
 */
function docToArticle(docSnap: DocumentData): KnowledgeArticle | null {
  try {
    const data = docSnap.data();
    if (!data) return null;

    let createdAt = new Date();
    if (data.createdAt) {
      if (typeof data.createdAt.toDate === "function") {
        createdAt = data.createdAt.toDate();
      } else if (data.createdAt instanceof Date) {
        createdAt = data.createdAt;
      }
    }

    let updatedAt = new Date();
    if (data.updatedAt) {
      if (typeof data.updatedAt.toDate === "function") {
        updatedAt = data.updatedAt.toDate();
      } else if (data.updatedAt instanceof Date) {
        updatedAt = data.updatedAt;
      }
    }

    return {
      id: docSnap.id,
      slug: data.slug || "",
      title: data.title || "",
      category: data.category || "general",
      keywords: data.keywords || [],
      content: data.content || "",
      language: data.language || "en",
      lastReviewed: data.lastReviewed?.toDate?.() || undefined,
      approved: data.approved ?? true,
      createdAt,
      updatedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Get all approved knowledge articles
 */
export async function getKnowledgeArticles(): Promise<KnowledgeArticle[]> {
  if (!isFirebaseConfigured() || !db) {
    return SEED_ARTICLES as unknown as KnowledgeArticle[];
  }

  const now = Date.now();
  if (cachedArticles.length > 0 && now - lastFetchTime < CACHE_DURATION) {
    return cachedArticles;
  }

  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("approved", "==", true),
      orderBy("category", "asc"),
      orderBy("title", "asc")
    );

    const snapshot = await getDocs(q);
    const articles: KnowledgeArticle[] = [];

    snapshot.docs.forEach((doc) => {
      const article = docToArticle(doc);
      if (article) {
        articles.push(article);
      }
    });

    // If no articles in Firebase, use seed data
    if (articles.length === 0) {
      cachedArticles = SEED_ARTICLES as unknown as KnowledgeArticle[];
    } else {
      cachedArticles = articles;
    }
    lastFetchTime = now;

    return cachedArticles;
  } catch (error) {
    console.error("[Knowledge Repository] Error fetching articles:", error);
    return cachedArticles.length > 0 ? cachedArticles : (SEED_ARTICLES as unknown as KnowledgeArticle[]);
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
  if (!isFirebaseConfigured() || !db) {
    return null; // Seed articles don't have IDs
  }

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return docToArticle(docSnap);
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
    .filter((r) => r.relevanceScore > 0)
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
  if (!isFirebaseConfigured() || !db) {
    throw new Error("Firebase not configured");
  }

  const now = new Date();
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...data,
    approved: false,
    createdAt: now,
    updatedAt: now,
  });

  // Clear cache
  cachedArticles = [];
  lastFetchTime = 0;

  return docRef.id;
}

/**
 * Update knowledge article
 */
export async function updateArticle(
  id: string,
  data: KnowledgeArticleUpdate
): Promise<void> {
  if (!isFirebaseConfigured() || !db) {
    throw new Error("Firebase not configured");
  }

  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date(),
  });

  // Clear cache
  cachedArticles = [];
  lastFetchTime = 0;
}

/**
 * Delete knowledge article
 */
export async function deleteArticle(id: string): Promise<void> {
  if (!isFirebaseConfigured() || !db) {
    throw new Error("Firebase not configured");
  }

  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);

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
  if (!isFirebaseConfigured() || !db) {
    return [];
  }

  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("approved", "==", false)
    );

    const snapshot = await getDocs(q);
    const articles: KnowledgeArticle[] = [];

    snapshot.docs.forEach((doc) => {
      const article = docToArticle(doc);
      if (article) {
        articles.push(article);
      }
    });

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
