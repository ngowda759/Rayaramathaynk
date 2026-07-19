"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bookmark, BookmarkCheck, Share2, Printer, Clock, Eye, ChevronRight, X, Sparkles } from "lucide-react";
import Link from "next/link";
import {
  KnowledgeCentreData,
  KnowledgeCategoryInfo,
  KnowledgeArticle,
  KnowledgeBookmark,
  RecentlyViewed,
  KNOWLEDGE_CATEGORY_CONFIG,
} from "@/types/knowledge";

interface KnowledgeCentreClientProps {
  initialData: KnowledgeCentreData;
}

const BOOKMARKS_KEY = "rayaramathaynk_bookmarks";
const RECENTLY_VIEWED_KEY = "rayaramathaynk_recently_viewed";
const MAX_RECENT = 5;

export default function KnowledgeCentreClient({ initialData }: KnowledgeCentreClientProps) {
  const [data] = useState(initialData);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeArticle[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<KnowledgeBookmark[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewed[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showRecent, setShowRecent] = useState(false);

  // Load bookmarks and recently viewed from localStorage
  useEffect(() => {
    try {
      const savedBookmarks = localStorage.getItem(BOOKMARKS_KEY);
      if (savedBookmarks) {
        setBookmarks(JSON.parse(savedBookmarks));
      }

      const savedRecent = localStorage.getItem(RECENTLY_VIEWED_KEY);
      if (savedRecent) {
        setRecentlyViewed(JSON.parse(savedRecent));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Search handler with debounce
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/knowledge/search?q=${encodeURIComponent(query)}&limit=10`);
      const results = await response.json();
      setSearchResults(results.map((r: { article: KnowledgeArticle }) => r.article));
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Bookmark handlers
  const toggleBookmark = (article: KnowledgeArticle) => {
    const exists = bookmarks.find((b) => b.id === article.id);
    let updatedBookmarks: KnowledgeBookmark[];
    
    if (exists) {
      updatedBookmarks = bookmarks.filter((b) => b.id !== article.id);
      setBookmarks(updatedBookmarks);
    } else {
      const newBookmark: KnowledgeBookmark = {
        id: article.id,
        slug: article.slug,
        title: article.title,
        category: article.category,
        bookmarkedAt: new Date().toISOString(),
      };
      updatedBookmarks = [...bookmarks, newBookmark];
      setBookmarks(updatedBookmarks);
    }
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updatedBookmarks));
  };

  const isBookmarked = (articleId: string) => bookmarks.some((b) => b.id === articleId);

  // Add to recently viewed
  const addToRecentlyViewed = (article: KnowledgeArticle) => {
    const newRecent: RecentlyViewed = {
      id: article.id,
      slug: article.slug,
      title: article.title,
      category: article.category,
      viewedAt: new Date().toISOString(),
    };
    const filtered = recentlyViewed.filter((r) => r.id !== article.id);
    const updated = [newRecent, ...filtered].slice(0, MAX_RECENT);
    setRecentlyViewed(updated);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  };

  // Share handler
  const handleShare = (article: KnowledgeArticle) => {
    const url = `${window.location.origin}/knowledge/article/${article.slug}`;
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

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // Get filtered articles
  const getFilteredArticles = () => {
    if (searchResults.length > 0) {
      return searchResults;
    }
    if (selectedCategory) {
      return data.popularArticles.filter((a) => a.category === selectedCategory);
    }
    return data.popularArticles;
  };

  const filteredArticles = getFilteredArticles();

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/30 to-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 py-16">
        <div className="absolute inset-0 bg-[url('/patterns/mandala.svg')] opacity-10" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white">
              <Sparkles className="h-4 w-4" />
              Rayara Knowledge Centre
            </div>
            <h1 className="text-4xl font-bold text-white sm:text-5xl">
              Explore Spiritual Wisdom
            </h1>
            <p className="mt-4 text-lg text-white/90 max-w-2xl mx-auto">
              Discover the rich heritage, philosophy, and traditions of Sri Raghavendra Swamy Matha through our comprehensive knowledge base.
            </p>

            {/* Search Bar */}
            <div className="mt-8 max-w-2xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
              <input
                type="text"
                placeholder="Search articles, topics, or questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border-0 bg-white py-4 pl-12 pr-12 text-stone-900 shadow-lg placeholder:text-stone-400 focus:ring-2 focus:ring-amber-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
              {isSearching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowBookmarks(!showBookmarks); setShowRecent(false); }}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  showBookmarks
                    ? "bg-amber-100 text-amber-700"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                <Bookmark className="h-4 w-4" />
                Bookmarks ({bookmarks.length})
              </button>
              <button
                onClick={() => { setShowRecent(!showRecent); setShowBookmarks(false); }}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  showRecent
                    ? "bg-amber-100 text-amber-700"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                <Clock className="h-4 w-4" />
                Recently Viewed ({recentlyViewed.length})
              </button>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>
      </section>

      {/* Bookmarks Panel */}
      <AnimatePresence>
        {showBookmarks && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-stone-200 bg-amber-50/50 overflow-hidden"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
              <h3 className="mb-4 text-lg font-semibold text-stone-900">Your Bookmarks</h3>
              {bookmarks.length === 0 ? (
                <p className="text-stone-500">No bookmarks yet. Click the bookmark icon on any article to save it.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {bookmarks.map((bookmark) => (
                    <Link
                      key={bookmark.id}
                      href={`/knowledge/${bookmark.slug}`}
                      className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <BookmarkCheck className="h-5 w-5 text-amber-500" />
                      <div>
                        <p className="font-medium text-stone-900">{bookmark.title}</p>
                        <p className="text-sm text-stone-500">{KNOWLEDGE_CATEGORY_CONFIG[bookmark.category]?.name}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recently Viewed Panel */}
      <AnimatePresence>
        {showRecent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-stone-200 bg-amber-50/50 overflow-hidden"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
              <h3 className="mb-4 text-lg font-semibold text-stone-900">Recently Viewed</h3>
              {recentlyViewed.length === 0 ? (
                <p className="text-stone-500">No recently viewed articles.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {recentlyViewed.map((item) => (
                    <Link
                      key={item.id}
                      href={`/knowledge/${item.slug}`}
                      className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <Clock className="h-5 w-5 text-stone-400" />
                      <div>
                        <p className="font-medium text-stone-900">{item.title}</p>
                        <p className="text-sm text-stone-500">{KNOWLEDGE_CATEGORY_CONFIG[item.category]?.name}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Categories */}
      {!searchQuery && (
        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-8 text-2xl font-bold text-stone-900">Browse by Category</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.categories
                .filter((cat) => cat.articleCount > 0)
                .map((category) => (
                  <Link
                    key={category.id}
                    href={`/knowledge/${category.slug}`}
                    className={`group relative overflow-hidden rounded-2xl bg-white p-6 shadow-md ring-1 ring-stone-200 transition-all hover:shadow-lg hover:ring-amber-200 ${
                      selectedCategory === category.id ? "ring-amber-400" : ""
                    }`}
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    <div className="text-4xl mb-3">{category.icon}</div>
                    <h3 className="font-semibold text-stone-900 group-hover:text-amber-600 transition-colors">
                      {category.name}
                    </h3>
                    <p className="mt-1 text-sm text-stone-500 line-clamp-2">
                      {category.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs font-medium text-amber-600">
                        {category.articleCount} article{category.articleCount !== 1 ? "s" : ""}
                      </span>
                      <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-amber-600 transition-colors" />
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* Search Results or Articles */}
      <section className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-stone-900">
              {searchQuery
                ? `Search Results for "${searchQuery}"`
                : selectedCategory
                ? KNOWLEDGE_CATEGORY_CONFIG[selectedCategory as keyof typeof KNOWLEDGE_CATEGORY_CONFIG]?.name || "Articles"
                : "Popular Articles"}
            </h2>
            {(searchQuery || selectedCategory) && (
              <button
                onClick={() => { setSearchQuery(""); setSelectedCategory(null); setSearchResults([]); }}
                className="text-sm text-amber-600 hover:text-amber-700"
              >
                Clear filters
              </button>
            )}
          </div>

          {filteredArticles.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-stone-200">
              <Search className="mx-auto h-12 w-12 text-stone-300" />
              <h3 className="mt-4 text-lg font-semibold text-stone-900">No articles found</h3>
              <p className="mt-2 text-stone-500">
                {searchQuery
                  ? `No articles match "${searchQuery}". Try different keywords.`
                  : "No articles in this category yet."}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {filteredArticles.map((article, index) => (
                <motion.article
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-stone-200 hover:shadow-lg hover:ring-amber-200"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">
                          {KNOWLEDGE_CATEGORY_CONFIG[article.category]?.icon || "📖"}
                        </span>
                        <span className="text-sm font-medium text-amber-600">
                          {KNOWLEDGE_CATEGORY_CONFIG[article.category]?.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.preventDefault(); toggleBookmark(article); }}
                          className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-amber-500 transition-colors"
                          title={isBookmarked(article.id) ? "Remove bookmark" : "Add bookmark"}
                        >
                          {isBookmarked(article.id) ? (
                            <BookmarkCheck className="h-5 w-5 text-amber-500" />
                          ) : (
                            <Bookmark className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); handleShare(article); }}
                          className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
                          title="Share article"
                        >
                          <Share2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <Link href={`/knowledge/article/${article.slug}`} onClick={() => addToRecentlyViewed(article)}>
                      <h3 className="mt-4 text-xl font-bold text-stone-900 group-hover:text-amber-600 transition-colors">
                        {article.title}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-stone-600">
                        {article.content.slice(0, 200)}...
                      </p>
                    </Link>

                    <div className="mt-4 flex items-center gap-4 text-sm text-stone-500">
                      {article.keywords.slice(0, 3).map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded-full bg-stone-100 px-2 py-1 text-xs"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>

                    <Link
                      href={`/knowledge/article/${article.slug}`}
                      onClick={() => addToRecentlyViewed(article)}
                      className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700"
                    >
                      Read more
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
