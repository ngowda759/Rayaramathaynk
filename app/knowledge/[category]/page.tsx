import { Metadata } from "next";
import { notFound } from "next/navigation";
import KnowledgeCategoryClient from "@/components/knowledge/KnowledgeCategoryClient";
import { knowledgeService } from "@/services/knowledge.service";
import { KNOWLEDGE_CATEGORY_CONFIG, KnowledgeCategory } from "@/types/knowledge";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata(props: CategoryPageProps): Promise<Metadata> {
  const params = await props.params;
  // Find category by slug
  const categoryEntry = Object.entries(KNOWLEDGE_CATEGORY_CONFIG).find(
    ([, config]) => config.slug === params.category
  );

  if (!categoryEntry) {
    return { title: "Category Not Found | Rayaramathaynk" };
  }

  const [, config] = categoryEntry;

  return {
    title: `${config.name} | Knowledge Centre | Rayaramathaynk`,
    description: config.description,
  };
}

export default async function CategoryPage(props: CategoryPageProps) {
  const params = await props.params;
  // Find category by slug
  const categoryEntry = Object.entries(KNOWLEDGE_CATEGORY_CONFIG).find(
    ([, config]) => config.slug === params.category
  );

  if (!categoryEntry) {
    notFound();
  }

  const [categoryId, categoryConfig] = categoryEntry;

  const articles = await knowledgeService.getPublicArticlesByCategory(categoryId as KnowledgeCategory);
  const categories = await knowledgeService.getKnowledgeCategories();

  return (
    <KnowledgeCategoryClient
      category={categoryId as KnowledgeCategory}
      categoryConfig={categoryConfig}
      articles={articles}
      categories={categories}
    />
  );
}
