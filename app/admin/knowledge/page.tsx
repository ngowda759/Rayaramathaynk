"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
  Eye,
  PlusCircle,
  Settings
} from "lucide-react";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import toast from "react-hot-toast";
import {
  KnowledgeArticle,
  KnowledgeCategory,
  CATEGORY_DISPLAY_NAMES,
} from "@/lib/ai/knowledge/types";
import { cn } from "@/lib/utils";

// Default categories from public pages
const DEFAULT_CATEGORIES: { id: KnowledgeCategory; name: string }[] = [
  { id: "aaradhane", name: "Aaradhane" },
  { id: "about", name: "About" },
  { id: "donation", name: "Donation" },
  { id: "events", name: "Events" },
  { id: "facilities", name: "Facilities" },
  { id: "future-plans", name: "Future Plans" },
  { id: "gallery", name: "Gallery" },
  { id: "guruparampara", name: "Guru Parampara" },
  { id: "journey", name: "Temple Journey" },
  { id: "pooja", name: "Pooja Services" },
  { id: "sevas", name: "Sevas" },
  { id: "shlokas", name: "Shlokas" },
  { id: "temple-explorer", name: "Temple Explorer" },
  { id: "testimonials", name: "Testimonials" },
  { id: "trust", name: "Trust" },
  { id: "volunteer", name: "Volunteer" },
  { id: "faq", name: "FAQ" },
  { id: "contact", name: "Contact" },
  { id: "dress-code", name: "Dress Code" },
  { id: "parking", name: "Parking" },
  { id: "history", name: "Temple History" },
  { id: "raghavendra-swamy", name: "Sri Raghavendra Swamy" },
  { id: "brindavana", name: "Brindavana" },
  { id: "madhvacharya", name: "Sri Madhvacharya" },
  { id: "mantralaya", name: "Mantralaya" },
  { id: "photography", name: "Photography" },
  { id: "accommodation", name: "Accommodation" },
  { id: "general", name: "General" },
];

interface KnowledgeArticleWithActions extends KnowledgeArticle {
  isEditing?: boolean;
}

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<KnowledgeArticleWithActions[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<KnowledgeCategory | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string }[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    keywords: "",
    category: "general" as KnowledgeCategory,
    language: "en" as "en" | "kn" | "mixed",
    slug: "",
  });

  // Combine default and custom categories
  const allCategories = [
    ...DEFAULT_CATEGORIES,
    ...customCategories.filter(c => !DEFAULT_CATEGORIES.find(d => d.id === c.id))
  ];

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/knowledge");
      const data = await response.json();
      if (data.success && data.articles) {
        setArticles(data.articles);
        // Extract custom categories from articles
        const categorySet = new Set<string>();
        data.articles.forEach((a: KnowledgeArticle) => {
          if (a.category) categorySet.add(a.category);
        });
        const existingCategories = Array.from(categorySet);
        const customs = existingCategories
          .filter((c) => !DEFAULT_CATEGORIES.find(d => d.id === c))
          .map((c) => ({ 
            id: c, 
            name: c.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) 
          }));
        setCustomCategories(customs);
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

  const filteredArticles = articles.filter((article) => {
    const matchesSearch = 
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.keywords.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === "all" || article.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const startEditing = (article: KnowledgeArticle) => {
    setEditingId(article.id);
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

  const saveArticle = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
      
      if (data.success) {
        toast.success("Article saved successfully");
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
      
      if (data.success && data.id) {
        toast.success("Article created and published");
        // Start editing the new article directly using the returned ID
        startEditingWithId(data.id);
        loadArticles(); // Refresh the list in background
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

  const startEditingWithId = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/knowledge/${id}`);
      const data = await response.json();
      
      if (data.success && data.article) {
        startEditing(data.article);
      } else {
        // Fallback: create a minimal article object with just the ID
        startEditing({
          id,
          title: "New Article",
          content: "Enter content here...",
          keywords: [],
          category: "general",
          language: "en",
          slug: `article-${id}`,
          approved: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error("Failed to fetch article:", error);
      // Fallback: create a minimal article object with just the ID
      startEditing({
        id,
        title: "New Article",
        content: "Enter content here...",
        keywords: [],
        category: "general",
        language: "en",
        slug: `article-${id}`,
        approved: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error("Please enter a category name");
      return;
    }
    
    const slugId = newCategoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    if (allCategories.find(c => c.id === slugId)) {
      toast.error("Category already exists");
      return;
    }
    
    setCustomCategories([...customCategories, { id: slugId, name: newCategoryName.trim() }]);
    setNewCategoryName("");
    setShowCategoryModal(false);
    toast.success(`Category "${newCategoryName.trim()}" added`);
  };

  const categories = allCategories;

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
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="p-2 text-stone-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              title="Add Category"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
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
        <div className="space-y-4 overflow-x-hidden">
          {filteredArticles.map((article) => (
            <div key={article.id} className="bg-white rounded-xl shadow overflow-hidden">
              {editingId === article.id ? (
                /* Edit Mode */
                <form onSubmit={saveArticle} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                  <div className="flex items-center justify-between sticky top-0 bg-white pb-3 border-b border-stone-100 -mx-6 px-6">
                    <h3 className="text-lg font-semibold text-stone-900">Edit Article</h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="flex items-center gap-1 px-3 py-1.5 text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Save
                      </button>
                    </div>
                  </div>

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
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
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
                      rows={10}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono text-sm"
                    />
                  </div>
                </form>
              ) : (
                /* View Mode */
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                          {allCategories.find(c => c.id === article.category)?.name || article.category}
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
                        {article.slug && (
                          <a
                            href={`/knowledge/article/${article.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Eye className="w-3 h-3" />
                            View on Site
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-stone-900 mb-2">{article.title}</h3>
                      <p className="text-stone-600 text-sm line-clamp-2 mb-3">
                        {article.content.substring(0, 200)}...
                      </p>
                      {article.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {article.keywords.slice(0, 5).map((keyword, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs rounded"
                            >
                              {keyword}
                            </span>
                          ))}
                          {article.keywords.length > 5 && (
                            <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs rounded">
                              +{article.keywords.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditing(article)}
                        className="p-2 text-stone-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteArticle(article.id)}
                        className="p-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-stone-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-stone-900">Add Category</h2>
                    <p className="text-sm text-stone-500">Create a new knowledge category</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="p-2 hover:bg-stone-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-stone-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Category Name
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Special Events, Festival Guide"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                />
                <p className="text-xs text-stone-500 mt-1">
                  Category ID will be: {newCategoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || "category-name"}
                </p>
              </div>

              {customCategories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Custom Categories ({customCategories.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {customCategories.map((cat) => (
                      <span
                        key={cat.id}
                        className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-lg"
                      >
                        {cat.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-stone-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                <PlusCircle className="w-4 h-4" />
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
