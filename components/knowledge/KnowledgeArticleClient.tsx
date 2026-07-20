"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  Bookmark,
  BookmarkCheck,
  Share2,
  Printer,
  Clock,
  Eye,
  Calendar,
  ArrowLeft,
  Globe,
} from "lucide-react";
import {
  ArticlePageData,
  KnowledgeBookmark,
  KnowledgeLanguage,
  KNOWLEDGE_CATEGORY_CONFIG,
} from "@/types/knowledge";

interface KnowledgeArticleClientProps {
  articleData: ArticlePageData;
}

const BOOKMARKS_KEY = "rayaramathaynk_bookmarks";
const LANGUAGE_KEY = "rayaramathaynk_language";

export default function KnowledgeArticleClient({ articleData }: KnowledgeArticleClientProps) {
  const { article, relatedArticles, breadcrumbs, nextArticle, previousArticle } = articleData;
  const [bookmarks, setBookmarks] = useState<KnowledgeBookmark[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [language, setLanguage] = useState<KnowledgeLanguage>("en");

  const categoryConfig = KNOWLEDGE_CATEGORY_CONFIG[article.category];

  // Load language preference from localStorage
  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem(LANGUAGE_KEY) as KnowledgeLanguage;
      if (savedLanguage && ["en", "kn", "mixed"].includes(savedLanguage)) {
        setLanguage(savedLanguage);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Load bookmarks from localStorage
  useEffect(() => {
    try {
      const savedBookmarks = localStorage.getItem(BOOKMARKS_KEY);
      if (savedBookmarks) {
        const parsed = JSON.parse(savedBookmarks);
        setBookmarks(parsed);
        setIsBookmarked(parsed.some((b: KnowledgeBookmark) => b.id === article.id));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [article.id]);

  const toggleLanguage = () => {
    const newLanguage = language === "en" ? "kn" : "en";
    setLanguage(newLanguage);
    localStorage.setItem(LANGUAGE_KEY, newLanguage);
  };

  // Get article title based on language
  const getArticleTitle = () => {
    if (language === "kn" && article.kannadaTitle) {
      return article.kannadaTitle;
    }
    return article.title;
  };

  // Get article content based on language
  const getArticleContent = () => {
    if (language === "kn" && article.kannadaContent) {
      return article.kannadaContent;
    }
    return article.content;
  };

  const toggleBookmark = () => {
    const newBookmarks = isBookmarked
      ? bookmarks.filter((b) => b.id !== article.id)
      : [
          ...bookmarks,
          {
            id: article.id,
            slug: article.slug,
            title: article.title,
            category: article.category,
            bookmarkedAt: new Date().toISOString(),
          },
        ];

    setBookmarks(newBookmarks);
    setIsBookmarked(!isBookmarked);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(newBookmarks));
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: `Learn about ${article.title}`,
        url,
      });
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/30 to-white">
      {/* Article Header */}
      <section className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs */}
          <nav className="mb-6 flex items-center gap-2 text-sm text-white/80">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight className="h-4 w-4" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-white">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-white">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>

          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <span className="text-5xl">{categoryConfig?.icon || "📖"}</span>
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-medium text-white">
                  {categoryConfig?.name}
                </div>
                <h1 className="text-3xl font-bold text-white sm:text-4xl">{getArticleTitle()}</h1>
              </div>
            </div>
            {/* Language Toggle */}
            {(article.kannadaTitle || article.kannadaContent) && (
              <button
                onClick={toggleLanguage}
                className="rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors"
                title={language === "en" ? "ಕನ್ನಡದಲ್ಲಿ ಓದಿ" : "Read in English"}
              >
                <Globe className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-white/80">
            {article.readingTime && (
              <span className="flex items-center gap-1 text-sm">
                <Clock className="h-4 w-4" />
                {article.readingTime} min read
              </span>
            )}
            <span className="flex items-center gap-1 text-sm">
              <Calendar className="h-4 w-4" />
              Updated {formatDate(article.updatedAt)}
            </span>
          </div>
        </div>
      </section>

      {/* Article Content */}
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-4 lg:gap-12">
            {/* Sidebar */}
            <aside className="mb-8 lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                {/* Actions */}
                <div className="rounded-2xl bg-white p-4 shadow-md ring-1 ring-stone-200">
                  <h3 className="mb-3 text-sm font-semibold text-stone-900">Actions</h3>
                  <div className="space-y-2">
                    <button
                      onClick={toggleBookmark}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isBookmarked
                          ? "bg-amber-100 text-amber-700"
                          : "text-stone-600 hover:bg-stone-100"
                      }`}
                    >
                      {isBookmarked ? (
                        <BookmarkCheck className="h-4 w-4" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                      {isBookmarked ? "Bookmarked" : "Bookmark"}
                    </button>
                    <button
                      onClick={handleShare}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </button>
                  </div>
                </div>

                {/* Keywords */}
                <div className="rounded-2xl bg-white p-4 shadow-md ring-1 ring-stone-200">
                  <h3 className="mb-3 text-sm font-semibold text-stone-900">Keywords</h3>
                  <div className="flex flex-wrap gap-2">
                    {article.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Back to Knowledge Centre */}
                <Link
                  href="/knowledge"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Knowledge Centre
                </Link>
              </div>
            </aside>

            {/* Main Content */}
            <article className="lg:col-span-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white p-8 shadow-md ring-1 ring-stone-200"
              >
                <div
                  className="prose prose-stone max-w-none prose-headings:text-stone-900 prose-p:text-stone-700 prose-a:text-amber-600 prose-a:no-underline hover:prose-a:underline"
                  dangerouslySetInnerHTML={{ __html: formatContent(getArticleContent()) }}
                />
              </motion.div>

              {/* Navigation */}
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {previousArticle ? (
                  <Link
                    href={`/knowledge/${previousArticle.slug}`}
                    className="group flex items-center gap-4 rounded-2xl bg-white p-4 shadow-md ring-1 ring-stone-200 hover:ring-amber-200 transition-all"
                  >
                    <ChevronLeft className="h-5 w-5 text-stone-400 group-hover:text-amber-600" />
                    <div>
                      <p className="text-xs text-stone-500">Previous</p>
                      <p className="font-medium text-stone-900 group-hover:text-amber-600">
                        {previousArticle.title}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div />
                )}
                {nextArticle && (
                  <Link
                    href={`/knowledge/${nextArticle.slug}`}
                    className="group flex items-center justify-end gap-4 rounded-2xl bg-white p-4 shadow-md ring-1 ring-stone-200 hover:ring-amber-200 transition-all"
                  >
                    <div className="text-right">
                      <p className="text-xs text-stone-500">Next</p>
                      <p className="font-medium text-stone-900 group-hover:text-amber-600">
                        {nextArticle.title}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-amber-600" />
                  </Link>
                )}
              </div>
            </article>
          </div>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <section className="mt-16">
              <h2 className="mb-6 text-2xl font-bold text-stone-900">Related Articles</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {relatedArticles.map((relatedArticle) => (
                  <Link
                    key={relatedArticle.id}
                    href={`/knowledge/article/${relatedArticle.slug}`}
                    className="group rounded-2xl bg-white p-4 shadow-md ring-1 ring-stone-200 hover:shadow-lg hover:ring-amber-200 transition-all"
                  >
                    <span className="text-3xl">
                      {KNOWLEDGE_CATEGORY_CONFIG[relatedArticle.category]?.icon || "📖"}
                    </span>
                    <h3 className="mt-3 font-semibold text-stone-900 group-hover:text-amber-600 line-clamp-2">
                      {relatedArticle.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-stone-500">
                      {relatedArticle.content.slice(0, 100)}...
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

// Simple content formatter
function formatContent(content: string): string {
  // Convert line breaks to paragraphs
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs
    .map((p) => {
      // Check if it's a heading
      if (p.match(/^#\s/)) {
        return `<h2>${p.replace(/^#\s/, "")}</h2>`;
      }
      // Check if it's a list
      if (p.match(/^[-*]\s/m)) {
        const items = p
          .split(/\n/)
          .filter((line) => line.match(/^[-*]\s/))
          .map((line) => `<li>${line.replace(/^[-*]\s/, "")}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      // Regular paragraph
      return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}
