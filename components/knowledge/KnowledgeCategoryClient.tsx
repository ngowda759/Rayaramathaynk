"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Search } from "lucide-react";
import {
  KnowledgeCategoryInfo,
  KnowledgeArticlePublic,
  KNOWLEDGE_CATEGORY_CONFIG,
} from "@/types/knowledge";

interface KnowledgeCategoryClientProps {
  category: string;
  categoryConfig: {
    name: string;
    description: string;
    icon: string;
    slug: string;
  };
  articles: KnowledgeArticlePublic[];
  categories: KnowledgeCategoryInfo[];
}

export default function KnowledgeCategoryClient({
  category,
  categoryConfig,
  articles,
  categories,
}: KnowledgeCategoryClientProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/30 to-white">
      {/* Header */}
      <section className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs */}
          <nav className="mb-6 flex items-center gap-2 text-sm text-white/80">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link href="/knowledge" className="hover:text-white">
              Knowledge Centre
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-white">{categoryConfig.name}</span>
          </nav>

          <div className="flex items-center gap-4">
            <span className="text-6xl">{categoryConfig.icon}</span>
            <div>
              <h1 className="text-3xl font-bold text-white sm:text-4xl">{categoryConfig.name}</h1>
              <p className="mt-2 text-lg text-white/90">{categoryConfig.description}</p>
              <p className="mt-2 text-sm text-white/70">
                {articles.length} article{articles.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-4 lg:gap-12">
            {/* Sidebar - Other Categories */}
            <aside className="mb-8 lg:col-span-1">
              <div className="sticky top-24">
                <h3 className="mb-4 text-lg font-semibold text-stone-900">Other Categories</h3>
                <div className="space-y-2">
                  {categories
                    .filter((cat) => cat.id !== category && cat.articleCount > 0)
                    .slice(0, 8)
                    .map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/knowledge/${cat.slug}`}
                        className="flex items-center gap-3 rounded-lg p-3 text-stone-600 hover:bg-amber-50 transition-colors"
                      >
                        <span className="text-xl">{cat.icon}</span>
                        <div>
                          <p className="font-medium">{cat.name}</p>
                          <p className="text-xs text-stone-500">{cat.articleCount} articles</p>
                        </div>
                      </Link>
                    ))}
                  <Link
                    href="/knowledge"
                    className="flex items-center gap-2 rounded-lg p-3 text-sm text-amber-600 hover:bg-amber-50 transition-colors"
                  >
                    View all categories
                  </Link>
                </div>
              </div>
            </aside>

            {/* Articles */}
            <div className="lg:col-span-3">
              {articles.length === 0 ? (
                <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-stone-200">
                  <Search className="mx-auto h-12 w-12 text-stone-300" />
                  <h3 className="mt-4 text-lg font-semibold text-stone-900">No articles yet</h3>
                  <p className="mt-2 text-stone-500">
                    Articles for this category are coming soon. Check back later!
                  </p>
                  <Link
                    href="/knowledge"
                    className="mt-4 inline-flex items-center gap-2 text-amber-600 hover:text-amber-700"
                  >
                    Back to Knowledge Centre
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {articles.map((article, index) => (
                    <motion.article
                      key={article.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group rounded-2xl bg-white p-6 shadow-md ring-1 ring-stone-200 hover:shadow-lg hover:ring-amber-200 transition-all"
                    >
                      <Link href={`/knowledge/article/${article.slug}`}>
                        <h2 className="text-xl font-bold text-stone-900 group-hover:text-amber-600 transition-colors">
                          {article.title}
                        </h2>
                        <p className="mt-2 line-clamp-3 text-stone-600">{article.content}</p>
                      </Link>
                      <div className="mt-4 flex items-center gap-4">
                        <div className="flex flex-wrap gap-2">
                          {article.keywords.slice(0, 4).map((keyword) => (
                            <span
                              key={keyword}
                              className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                        <Link
                          href={`/knowledge/article/${article.slug}`}
                          className="ml-auto text-sm font-medium text-amber-600 hover:text-amber-700"
                        >
                          Read more →
                        </Link>
                      </div>
                    </motion.article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
