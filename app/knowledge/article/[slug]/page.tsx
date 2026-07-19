import { Metadata } from "next";
import { notFound } from "next/navigation";
import KnowledgeArticleClient from "@/components/knowledge/KnowledgeArticleClient";
import { knowledgeService } from "@/services/knowledge.service";
import { KNOWLEDGE_CATEGORY_CONFIG } from "@/types/knowledge";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: ArticlePageProps): Promise<Metadata> {
  const params = await props.params;
  const data = await knowledgeService.getArticlePageData(params.slug);
  
  if (!data) {
    return {
      title: "Article Not Found | Rayaramathaynk",
    };
  }

  const categoryName = KNOWLEDGE_CATEGORY_CONFIG[data.article.category]?.name || "Knowledge";

  return {
    title: `${data.article.title} | ${categoryName} | Rayaramathaynk`,
    description: data.article.content.slice(0, 160),
    keywords: data.article.keywords,
  };
}

export default async function ArticlePage(props: ArticlePageProps) {
  const params = await props.params;
  const data = await knowledgeService.getArticlePageData(params.slug);

  if (!data) {
    notFound();
  }

  return <KnowledgeArticleClient articleData={data} />;
}
