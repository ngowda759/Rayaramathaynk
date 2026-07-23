import { NextResponse } from "next/server";
import {
  getKnowledgeArticles,
  getPendingArticles,
  clearKnowledgeCache,
} from "@/lib/ai/knowledge/repository";
import { addDocument, getDocuments } from "@/lib/firebase-admin-rest";
import { SEED_ARTICLES } from "@/lib/ai/knowledge/seed";

const COLLECTION_NAME = "knowledge";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/knowledge
 * Get all knowledge articles (including unpublished)
 * Includes both Firestore articles and seed data
 */
export async function GET() {
  try {
    // Get articles from Firestore
    const documents = await getDocuments(COLLECTION_NAME);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firestoreArticles = documents.map((doc: any) => {
      const data = doc.fields || doc;
      const name: string = doc.name || '';
      return {
        id: name.split('/').pop() || '',
        slug: data.slug?.stringValue || '',
        title: data.title?.stringValue || '',
        kannadaTitle: data.kannadaTitle?.stringValue,
        category: data.category?.stringValue || 'general',
        keywords: data.keywords?.arrayValue?.values?.map((v: { stringValue?: string }) => v.stringValue || '') || [],
        content: data.content?.stringValue || '',
        kannadaContent: data.kannadaContent?.stringValue,
        language: data.language?.stringValue || 'en',
        approved: data.approved?.booleanValue ?? false,
        createdAt: data.createdAt?.timestampValue || new Date().toISOString(),
        updatedAt: data.updatedAt?.timestampValue || new Date().toISOString(),
      };
    });

    // Get seed articles - note: SEED_ARTICLES uses Omit<KnowledgeArticle, "id">
    // so we generate the id from slug
    const seedArticles = SEED_ARTICLES.map((article, index) => ({
      id: (article as unknown as { id?: string }).id || article.slug || `seed-${index}`,
      slug: article.slug || '',
      title: article.title || '',
      kannadaTitle: article.kannadaTitle,
      category: article.category || 'general',
      keywords: article.keywords || [],
      content: article.content || '',
      kannadaContent: article.kannadaContent,
      language: article.language || 'en',
      approved: true,
      createdAt: article.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: article.updatedAt?.toISOString() || new Date().toISOString(),
      isSeed: true,
    }));

    // Combine Firestore articles with seed articles
    const articles = [
      ...firestoreArticles.map(a => ({ ...a, isSeed: false })),
      ...seedArticles
    ];

    return NextResponse.json({
      success: true,
      articles,
      count: articles.length,
      firestoreCount: firestoreArticles.length,
      seedCount: seedArticles.length,
    });
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/knowledge
 * Create a new knowledge article (auto-approved for admin)
 * Uses REST Admin SDK to bypass security rules
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, title, content, keywords, category, language } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 }
      );
    }

    // Use REST Admin SDK for write operations (bypasses security rules)
    const id = await addDocument(COLLECTION_NAME, {
      slug: slug || `article-${Date.now()}`,
      title,
      content: content || "",
      keywords: keywords || [],
      category: category || "general",
      language: language || "en",
      approved: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    clearKnowledgeCache();

    return NextResponse.json({
      success: true,
      id,
      message: "Article created and published successfully",
    });
  } catch (error) {
    console.error("Error creating article:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create article" },
      { status: 500 }
    );
  }
}
