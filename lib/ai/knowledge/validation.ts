import { z } from "zod";
import { KnowledgeLanguage, KnowledgeCategory } from "./types";

// Base validators
export const knowledgeLanguageSchema = z.enum(["en", "kn", "mixed"]) as z.ZodType<KnowledgeLanguage>;
export const knowledgeCategorySchema = z.string() as z.ZodType<KnowledgeCategory>;

/**
 * Zod schema for full KnowledgeArticle
 */
export const knowledgeArticleSchema = z.object({
  id: z.string(),
  slug: z.string().min(1),
  title: z.string().min(1),
  kannadaTitle: z.string().optional(),
  category: knowledgeCategorySchema,
  keywords: z.array(z.string()),
  content: z.string().min(1),
  kannadaContent: z.string().optional(),
  language: knowledgeLanguageSchema,
  lastReviewed: z.date().optional(),
  approved: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Zod schema for KnowledgeArticleRequest
 */
export const knowledgeArticleRequestSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  kannadaTitle: z.string().optional(),
  category: knowledgeCategorySchema,
  keywords: z.array(z.string()),
  content: z.string().min(1),
  kannadaContent: z.string().optional(),
  language: knowledgeLanguageSchema,
});

/**
 * Zod schema for KnowledgeArticleUpdate
 */
export const knowledgeArticleUpdateSchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  kannadaTitle: z.string().optional(),
  category: knowledgeCategorySchema.optional(),
  keywords: z.array(z.string()).optional(),
  content: z.string().min(1).optional(),
  kannadaContent: z.string().optional(),
  language: knowledgeLanguageSchema.optional(),
  lastReviewed: z.date().optional(),
  approved: z.boolean().optional(),
});
