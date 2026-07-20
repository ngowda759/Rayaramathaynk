"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  Loader2,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import toast from "react-hot-toast";
import {
  KnowledgeArticle,
  KnowledgeCategory,
  CATEGORY_DISPLAY_NAMES,
} from "@/lib/ai/knowledge/types";

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<KnowledgeCategory | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    keywords: "",
    category: "general" as KnowledgeCategory,
    language: "en" as "en" | "kn" | "mixed",
    slug: "",
  });

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/knowledge");
      const data = await response.json();
      
      if (data.success && data.articles) {
        // Deduplicate articles by ID
        const uniqueArticles = data.articles.filter(
          (article: KnowledgeArticle, index: number, self: KnowledgeArticle[]) =>
            index === self.findIndex((a) => a.id === article.id)
        );
        setArticles(uniqueArticles);
      } else {
        console.error("Failed to load articles:", data.error);
        toast.error(data.error || "Failed to load articles");
      }
    } catch (error) {
      console.error("Failed to load articles:", error);
      toast.error("Failed to load articles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesSearch = 
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.keywords.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = filterCategory === "all" || article.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [articles, searchTerm, filterCategory]);

  const categories = useMemo(() => 
    Object.keys(CATEGORY_DISPLAY_NAMES) as KnowledgeCategory[], 
  []);

  const startEditing = (article: KnowledgeArticle) => {
    setEditingId(article.id);
    setExpandedId(article.id);
    setEditForm({
      title: article.title,
      content: article.content,
      keywords: article.keywords.join(", "),
      category: article.category,
      language: article.language,
      slug: article.slug,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({
      title: "",
      content: "",
      keywords: "",
      category: "general",
      language: "en",
      slug: "",
    });
  };

  const saveArticle = async () => {
    if (!editingId) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/knowledge/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          content: editForm.content,
          keywords: editForm.keywords.split(",").map(k => k.trim()).filter(Boolean),
          category: editForm.category,
          language: editForm.language,
          slug: editForm.slug,
        }),
      });

      const data = await response.json();
      console.log("Save response:", data);

      if (data.success) {
        toast.success("Article saved successfully!");
        cancelEditing();
        loadArticles();
      } else {
        toast.error(data.error || "Failed to save article");
      }
    } catch (error) {
      console.error("Failed to save article:", error);
      toast.error("Failed to save article");
    } finally {
      setSaving(false);
    }
  };

  const deleteArticle = async (id: string) => {
    if (!confirm("Are you sure you want to delete this article?")) return;

    try {
      const response = await fetch(`/api/admin/knowledge/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      console.log("Delete response:", data);

      if (data.success) {
        toast.success("Article deleted");
        loadArticles();
      } else {
        toast.error(data.error || "Failed to delete article");
      }
    } catch (error) {
      console.error("Failed to delete article:", error);
      toast.error("Failed to delete article");
    }
  };

  const createArticle = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Article",
          content: "Enter content here...",
          keywords: [],
          category: "general",
          language: "en",
          slug: `article-${Date.now()}`,
        }),
      });

      const data = await response.json();
      console.log("Create response:", data);

      if (data.success && data.id) {
        toast.success("Article created!");
        loadArticles();
      } else {
        toast.error(data.error || "Failed to create article");
      }
    } catch (error) {
      console.error("Failed to create article:", error);
      toast.error("Failed to create article");
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Knowledge Base"
        description="Manage knowledge articles for the AI assistant and public website"
      />

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-stone-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as KnowledgeCategory | "all")}
              className="px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_DISPLAY_NAMES[cat]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={createArticle}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          New Article
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-stone-500">
        <span>{filteredArticles.length} articles</span>
        {searchTerm && <span>matching "{searchTerm}"</span>}
        {filterCategory !== "all" && <span>in {CATEGORY_DISPLAY_NAMES[filterCategory]}</span>}
      </div>

      {/* Articles List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-stone-300 mb-4" />
          <h3 className="text-lg font-medium text-stone-900 mb-2">No articles found</h3>
          <p className="text-stone-500 mb-6">
            {searchTerm || filterCategory !== "all"
              ? "Try adjusting your search or filter"
              : "Create your first knowledge article"}
          </p>
          {!searchTerm && filterCategory === "all" && (
            <button
              onClick={createArticle}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
            >
              Create Article
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredArticles.map((article) => (
            <div 
              key={article.id} 
              className={`bg-white rounded-xl shadow overflow-hidden transition-all ${
                editingId === article.id ? "ring-2 ring-amber-500" : ""
              }`}
            >
              {/* Article Header - Always Visible */}
              <div 
                className="p-4 cursor-pointer hover:bg-stone-50 transition-colors"
                onClick={() => !editingId && toggleExpand(article.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                        {CATEGORY_DISPLAY_NAMES[article.category]}
                      </span>
                      {article.approved ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          Published
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertCircle className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                      <span className="text-xs text-stone-400">
                        {article.language.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-stone-900 truncate">{article.title}</h3>
                    <p className="text-stone-500 text-sm mt-1 line-clamp-1">
                      {article.content.substring(0, 100)}...
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {editingId === article.id ? (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); cancelEditing(); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); saveArticle(); }}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditing(article); }}
                          className="p-2 text-stone-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteArticle(article.id); }}
                          className="p-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {article.slug && (
                          <a
                            href={`/knowledge/article/${article.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-stone-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View on Site"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button className="p-2 text-stone-400">
                          {expandedId === article.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded/Edit Content */}
              {(expandedId === article.id || editingId === article.id) && (
                <div className="border-t border-stone-200 p-4 bg-stone-50">
                  {editingId === article.id ? (
                    /* Edit Mode */
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1">Title</label>
                          <input
                            type="text"
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1">Slug (URL)</label>
                          <input
                            type="text"
                            value={editForm.slug}
                            onChange={(e) => setEditForm({ ...editForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                            placeholder="article-url-slug"
                            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1">Category</label>
                          <select
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value as KnowledgeCategory })}
                            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          >
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>
                                {CATEGORY_DISPLAY_NAMES[cat]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1">Language</label>
                          <select
                            value={editForm.language}
                            onChange={(e) => setEditForm({ ...editForm, language: e.target.value as "en" | "kn" | "mixed" })}
                            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          >
                            <option value="en">English</option>
                            <option value="kn">Kannada</option>
                            <option value="mixed">Mixed</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1">
                          Keywords (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={editForm.keywords}
                          onChange={(e) => setEditForm({ ...editForm, keywords: e.target.value })}
                          placeholder="keyword1, keyword2, keyword3"
                          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1">Content</label>
                        <textarea
                          value={editForm.content}
                          onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                          rows={8}
                          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    /* View Mode - Expanded */
                    <div className="space-y-3">
                      {article.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {article.keywords.map((keyword, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-stone-200 text-stone-600 text-xs rounded"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="prose prose-sm max-w-none">
                        <p className="text-stone-600 whitespace-pre-wrap">{article.content}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
