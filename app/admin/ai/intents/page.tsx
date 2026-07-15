"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Search,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Eye,
  BarChart3,
  Tag,
  Key,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import type { IntentMetadata, IntentStatus, IntentKeyword, IntentExample } from "@/types/ai-settings";

interface IntentEditForm {
  name?: string;
  description?: string;
  keywords?: string[];
  examples?: string[];
}

const STATUS_COLORS: Record<IntentStatus, { bg: string; text: string; badge: string }> = {
  enabled: { bg: "bg-green-50", text: "text-green-700", badge: "bg-green-100 text-green-800" },
  disabled: { bg: "bg-red-50", text: "text-red-700", badge: "bg-red-100 text-red-800" },
};

export default function IntentManagerPage() {
  const [intents, setIntents] = useState<IntentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIntent, setSelectedIntent] = useState<IntentMetadata | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<IntentEditForm>({});

  const showMsg = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const loadIntents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/ai/settings/intents");
      const data = await response.json();
      setIntents(data.data || []);
    } catch (error) {
      console.error("Error loading intents:", error);
      showMsg("error", "Failed to load intents");
    } finally {
      setLoading(false);
    }
  }, [showMsg]);

  useEffect(() => {
    loadIntents();
  }, [loadIntents]);

  const handleToggleStatus = async (intent: IntentMetadata) => {
    const newStatus: IntentStatus = intent.status === "enabled" ? "disabled" : "enabled";
    
    try {
      const response = await fetch(`/api/ai/settings/intents?id=${intent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.ok) {
        showMsg("success", `Intent ${newStatus === "enabled" ? "enabled" : "disabled"}`);
        loadIntents();
      }
    } catch (error) {
      showMsg("error", "Failed to update intent");
    }
  };

  const handleEdit = (intent: IntentMetadata) => {
    setSelectedIntent(intent);
    setEditForm({
      name: intent.name,
      description: intent.description,
      keywords: intent.keywords.map(k => typeof k === 'string' ? k : k.keyword),
      examples: intent.examples.map(e => typeof e === 'string' ? e : e.text),
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedIntent) return;
    
    try {
      const response = await fetch(`/api/ai/settings/intents?id=${selectedIntent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          keywords: editForm.keywords?.map(k => ({ keyword: k, language: "en" as const, isActive: true })),
          examples: editForm.examples?.map(e => ({ text: e, language: "en" as const })),
        }),
      });
      
      if (response.ok) {
        showMsg("success", "Intent updated successfully");
        setIsEditing(false);
        loadIntents();
      }
    } catch (error) {
      showMsg("error", "Failed to update intent");
    }
  };

  const handleAddKeyword = (keyword: string) => {
    if (!keyword.trim()) return;
    setEditForm({
      ...editForm,
      keywords: [...(editForm.keywords || []), keyword.trim().toLowerCase()],
    });
  };

  const handleRemoveKeyword = (index: number) => {
    setEditForm({
      ...editForm,
      keywords: (editForm.keywords || []).filter((_, i) => i !== index),
    });
  };

  const handleAddExample = (example: string) => {
    if (!example.trim()) return;
    setEditForm({
      ...editForm,
      examples: [...(editForm.examples || []), example.trim()],
    });
  };

  const handleRemoveExample = (index: number) => {
    setEditForm({
      ...editForm,
      examples: (editForm.examples || []).filter((_, i) => i !== index),
    });
  };

  const filteredIntents = intents.filter(intent => {
    const query = searchQuery.toLowerCase();
    return (
      intent.name.toLowerCase().includes(query) ||
      intent.description?.toLowerCase().includes(query) ||
      intent.keywords.some(k => {
        const keyword = typeof k === 'string' ? k : k.keyword;
        return keyword.toLowerCase().includes(query);
      })
    );
  });

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Intent Mapping"
        description="Manage AI chatbot intents, keywords, and examples for better response matching."
      />

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
          message.type === "success" 
            ? "bg-green-50 text-green-700 border border-green-200" 
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search intents by name, description, or keywords..."
            className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Intent List */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-200 bg-stone-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-stone-600" />
                <h2 className="font-semibold text-stone-900">Intents</h2>
                <span className="text-xs text-stone-500">({filteredIntents.length})</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-stone-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {intents.filter(i => i.status === "enabled").length} enabled
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {intents.filter(i => i.status === "disabled").length} disabled
                </span>
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-stone-100 max-h-[500px] overflow-y-auto">
            {filteredIntents.length === 0 ? (
              <div className="p-8 text-center text-stone-500">
                <Tag className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                <p className="text-sm">No intents found</p>
              </div>
            ) : (
              filteredIntents.map((intent) => {
                const colors = STATUS_COLORS[intent.status];
                return (
                  <div
                    key={intent.id}
                    onClick={() => { setSelectedIntent(intent); setIsEditing(false); }}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedIntent?.id === intent.id ? "bg-amber-50" : "hover:bg-stone-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-stone-900">{intent.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>
                            {intent.status}
                          </span>
                        </div>
                        <p className="text-sm text-stone-600 mt-1 line-clamp-2">
                          {intent.description || "No description"}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {intent.keywords.slice(0, 5).map((keyword, i) => {
                            const kw = typeof keyword === 'string' ? keyword : keyword.keyword;
                            return (
                              <span key={i} className="text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded">
                                {kw}
                              </span>
                            );
                          })}
                          {intent.keywords.length > 5 && (
                            <span className="text-xs text-stone-400">+{intent.keywords.length - 5} more</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleStatus(intent); }}
                        className={`p-2 rounded-lg transition-colors ${
                          intent.status === "enabled"
                            ? "text-green-600 hover:bg-green-50"
                            : "text-red-600 hover:bg-red-50"
                        }`}
                        title={intent.status === "enabled" ? "Disable" : "Enable"}
                      >
                        {intent.status === "enabled" ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Intent Details / Editor */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          {selectedIntent ? (
            isEditing ? (
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                  <h2 className="font-semibold text-stone-900">Edit Intent</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 text-sm text-stone-600 hover:text-stone-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1 px-4 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Save
                    </button>
                  </div>
                </div>
                
                <div className="p-4 space-y-6 overflow-auto max-h-[500px]">
                  {/* Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Intent Name
                    </label>
                    <input
                      type="text"
                      value={editForm.name || ""}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">
                      Description
                    </label>
                    <textarea
                      value={editForm.description || ""}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="Brief description of what this intent handles..."
                    />
                  </div>

                  {/* Keywords */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Keywords
                    </label>
                    <div className="flex flex-wrap gap-2 p-2 min-h-[60px] bg-stone-50 rounded-lg border border-stone-200">
                      {(editForm.keywords || []).map((keyword, i) => (
                        <span
                          key={i}
                          className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded text-sm"
                        >
                          {keyword}
                          <button
                            onClick={() => handleRemoveKeyword(i)}
                            className="hover:text-amber-900"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        placeholder="Add keyword..."
                        className="flex-1 min-w-[100px] bg-transparent border-none focus:outline-none text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddKeyword((e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = "";
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-stone-500">Press Enter to add a keyword</p>
                  </div>

                  {/* Examples */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Example Phrases
                    </label>
                    <div className="space-y-2">
                      {(editForm.examples || []).map((example, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-stone-400 text-sm">{i + 1}.</span>
                          <span className="flex-1 px-3 py-2 bg-stone-50 rounded-lg border border-stone-200 text-sm">
                            {example}
                          </span>
                          <button
                            onClick={() => handleRemoveExample(i)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <input
                        type="text"
                        placeholder="Add example phrase..."
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddExample((e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = "";
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-stone-500">Press Enter to add an example</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-stone-200 bg-stone-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-stone-900">{selectedIntent.name}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedIntent.status].badge}`}>
                        {selectedIntent.status}
                      </span>
                    </div>
                    <button
                      onClick={() => handleEdit(selectedIntent)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                  </div>
                </div>
                
                <div className="p-4 space-y-6">
                  {/* Description */}
                  <div>
                    <h3 className="text-sm font-medium text-stone-700 mb-2">Description</h3>
                    <p className="text-sm text-stone-600 bg-stone-50 p-3 rounded-lg">
                      {selectedIntent.description || "No description provided"}
                    </p>
                  </div>

                  {/* Keywords */}
                  <div>
                    <h3 className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Keywords ({selectedIntent.keywords.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedIntent.keywords.map((keyword, i) => {
                        const kw = typeof keyword === 'string' ? keyword : keyword.keyword;
                        return (
                          <span
                            key={i}
                            className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm"
                          >
                            {kw}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Examples */}
                  <div>
                    <h3 className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Example Phrases ({selectedIntent.examples.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedIntent.examples.map((example, i) => {
                        const ex = typeof example === 'string' ? example : example.text;
                        return (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-stone-400">{i + 1}.</span>
                            <span className="text-stone-600">{ex}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Statistics */}
                  <div>
                    <h3 className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Statistics
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-stone-50 p-3 rounded-lg">
                        <p className="text-2xl font-bold text-stone-900">
                          {selectedIntent.usageCount || 0}
                        </p>
                        <p className="text-xs text-stone-500">Total Uses</p>
                      </div>
                      <div className="bg-stone-50 p-3 rounded-lg">
                        <p className="text-2xl font-bold text-stone-900">
                          {selectedIntent.successRate !== undefined 
                            ? `${(selectedIntent.successRate * 100).toFixed(1)}%`
                            : "N/A"}
                        </p>
                        <p className="text-xs text-stone-500">Success Rate</p>
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="pt-4 border-t border-stone-200">
                    <p className="text-xs text-stone-500">
                      Created: {formatDate(selectedIntent.createdAt)}
                      {selectedIntent.updatedAt && ` • Updated: ${formatDate(selectedIntent.updatedAt)}`}
                    </p>
                    {selectedIntent.knowledgeSource && (
                      <p className="text-xs text-stone-500 mt-1">
                        Knowledge Source: {selectedIntent.knowledgeSource}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-stone-500">
              <Tag className="w-12 h-12 mb-4 text-stone-300" />
              <p className="text-lg font-medium">Select an intent</p>
              <p className="text-sm">Choose an intent from the list to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
