// API Route: /api/knowledge/workflow/articles
// CRUD operations for workflow articles

import { NextRequest, NextResponse } from "next/server";
import {
  createWorkflowArticle,
  getWorkflowArticles,
  getWorkflowArticleById,
  updateWorkflowArticle,
  performWorkflowAction,
} from "@/services/knowledge-workflow.service";
import { KnowledgeCategory, KnowledgeLanguage } from "@/lib/ai/knowledge/types";
import { WorkflowStatus } from "@/types/knowledge-workflow";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const status = searchParams.get("status")?.split(",") as WorkflowStatus[] | undefined;
    const category = searchParams.get("category")?.split(",") as KnowledgeCategory[] | undefined;
    const language = searchParams.get("language") as KnowledgeLanguage | undefined;
    const createdBy = searchParams.get("createdBy") || undefined;
    const search = searchParams.get("search") || undefined;

    const articles = await getWorkflowArticles({
      status,
      category,
      language,
      createdBy,
      search,
    });

    return NextResponse.json({ articles });
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, category, keywords, language, slug, createdBy } = body;

    if (!title || !content || !category || !createdBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const articleId = await createWorkflowArticle(
      { title, content, category, keywords: keywords || [], language: language || "en", slug: slug || title.toLowerCase().replace(/\s+/g, "-") },
      createdBy
    );

    return NextResponse.json({ articleId }, { status: 201 });
  } catch (error) {
    console.error("Error creating article:", error);
    return NextResponse.json(
      { error: "Failed to create article" },
      { status: 500 }
    );
  }
}
