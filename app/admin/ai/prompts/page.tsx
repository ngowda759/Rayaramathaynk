"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Save, 
  Plus, 
  History,
  Eye,
  Send,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  Trash2,
  Edit
} from "lucide-react";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import type { PromptVersion, PromptVersionStatus } from "@/types/ai-settings";

const STATUS_COLORS: Record<PromptVersionStatus, { bg: string; text: string; badge: string }> = {
  draft: { bg: "bg-stone-100", text: "text-stone-700", badge: "bg-stone-200 text-stone-800" },
  review: { bg: "bg-yellow-100", text: "text-yellow-700", badge: "bg-yellow-200 text-yellow-800" },
  published: { bg: "bg-green-100", text: "text-green-700", badge: "bg-green-200 text-green-800" },
  archived: { bg: "bg-red-100", text: "text-red-700", badge: "bg-red-200 text-red-800" },
};

export default function PromptManagerPage() {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptVersion | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", content: "" });

  const showMsg = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const loadPrompts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/ai/settings/prompts");
      const data = await response.json();
      const versions = data.versions || [];
      setPrompts(versions);
      
      // Auto-select published prompt
      const published = versions.find((p: PromptVersion) => p.status === "published");
      if (published) {
        setSelectedPrompt(published);
      } else if (versions.length > 0) {
        setSelectedPrompt(versions[0]);
      }
    } catch (error) {
      console.error("Error loading prompts:", error);
      showMsg("error", "Failed to load prompts");
    } finally {
      setLoading(false);
    }
  }, [showMsg]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const handleCreateNew = async () => {
    const name = prompt("Enter prompt name:");
    if (!name) return;
    
    try {
      const response = await fetch("/api/ai/settings/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          content: "# New Prompt\n\nEnter your prompt content here...",
          status: "draft",
        }),
      });
      
      if (response.ok) {
        showMsg("success", "Prompt created successfully");
        loadPrompts();
      }
    } catch (error) {
      showMsg("error", "Failed to create prompt");
    }
  };

  const handleEdit = (prompt: PromptVersion) => {
    setSelectedPrompt(prompt);
    setEditForm({ name: prompt.name, content: prompt.content });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedPrompt) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/ai/settings/prompts?id=${selectedPrompt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          content: editForm.content,
        }),
      });
      
      if (response.ok) {
        showMsg("success", "Prompt saved successfully");
        setIsEditing(false);
        loadPrompts();
      }
    } catch (error) {
      showMsg("error", "Failed to save prompt");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (prompt: PromptVersion, newStatus: PromptVersionStatus) => {
    if (newStatus === "published" && !confirm("Publishing will make this prompt active. Continue?")) return;
    if (newStatus === "archived" && !confirm("Archiving will disable this prompt. Continue?")) return;
    
    try {
      const response = await fetch(`/api/ai/settings/prompts?id=${prompt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.ok) {
        showMsg("success", `Prompt ${newStatus === "published" ? "published" : newStatus === "archived" ? "archived" : "updated"} successfully`);
        loadPrompts();
      }
    } catch (error) {
      showMsg("error", "Failed to update prompt status");
    }
  };

  const handleDelete = async (prompt: PromptVersion) => {
    if (!confirm(`Delete prompt "${prompt.name}"? This cannot be undone.`)) return;
    
    try {
      const response = await fetch(`/api/ai/settings/prompts?id=${prompt.id}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        showMsg("success", "Prompt deleted successfully");
        if (selectedPrompt?.id === prompt.id) {
          setSelectedPrompt(null);
        }
        loadPrompts();
      }
    } catch (error) {
      showMsg("error", "Failed to delete prompt");
    }
  };

  const handleRollback = async (prompt: PromptVersion) => {
    if (!confirm(`Rollback "${prompt.name}" to this version?`)) return;
    
    try {
      const response = await fetch(`/api/ai/settings/prompts?id=${prompt.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rollback" }),
      });
      
      if (response.ok) {
        showMsg("success", "Prompt rolled back successfully");
        loadPrompts();
      }
    } catch (error) {
      showMsg("error", "Failed to rollback prompt");
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
        title="Prompt Manager"
        description="Create, edit, and manage AI prompt versions with draft, review, and publish workflow."
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prompt List */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-stone-600" />
              <h2 className="font-semibold text-stone-900">Prompts</h2>
              <span className="text-xs text-stone-500">({prompts.length})</span>
            </div>
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              <Plus className="w-3 h-3" />
              New
            </button>
          </div>
          
          <div className="divide-y divide-stone-100 max-h-[600px] overflow-y-auto">
            {prompts.length === 0 ? (
              <div className="p-8 text-center text-stone-500">
                <FileText className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                <p className="text-sm">No prompts yet</p>
                <p className="text-xs">Create your first prompt</p>
              </div>
            ) : (
              prompts.map((prompt) => {
                const colors = STATUS_COLORS[prompt.status];
                return (
                  <div
                    key={prompt.id}
                    onClick={() => { setSelectedPrompt(prompt); setIsEditing(false); }}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedPrompt?.id === prompt.id ? "bg-amber-50" : "hover:bg-stone-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-stone-900 truncate">{prompt.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>
                            {prompt.status}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-1">
                          v{prompt.version} • {formatDate(prompt.createdAt)}
                        </p>
                        {prompt.createdBy && (
                          <p className="text-xs text-stone-400">by {prompt.createdBy}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Prompt Details / Editor */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 overflow-hidden">
          {selectedPrompt ? (
            isEditing ? (
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0"
                    placeholder="Prompt name..."
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 text-sm text-stone-600 hover:text-stone-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1 px-4 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                    >
                      {saving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save
                    </button>
                  </div>
                </div>
                <div className="flex-1 p-4">
                  <textarea
                    value={editForm.content}
                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                    rows={20}
                    className="w-full h-full px-4 py-3 border border-stone-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                    placeholder="Enter prompt content..."
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-stone-200 bg-stone-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-stone-900">{selectedPrompt.name}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedPrompt.status].badge}`}>
                        {selectedPrompt.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(selectedPrompt)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-stone-500">
                    <span>Version {selectedPrompt.version}</span>
                    <span>•</span>
                    <span>Created {formatDate(selectedPrompt.createdAt)}</span>
                    {selectedPrompt.publishedAt && (
                      <>
                        <span>•</span>
                        <span>Published {formatDate(selectedPrompt.publishedAt)}</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 p-4 overflow-auto">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-stone-700 bg-stone-50 p-4 rounded-lg border border-stone-200">
                    {selectedPrompt.content}
                  </pre>
                </div>
                
                {/* Actions */}
                <div className="p-4 border-t border-stone-200 bg-stone-50">
                  <div className="flex items-center gap-2">
                    {selectedPrompt.status === "draft" && (
                      <button
                        onClick={() => handleStatusChange(selectedPrompt, "review")}
                        className="flex items-center gap-1 px-4 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                      >
                        <Send className="w-4 h-4" />
                        Submit for Review
                      </button>
                    )}
                    {selectedPrompt.status === "review" && (
                      <button
                        onClick={() => handleStatusChange(selectedPrompt, "published")}
                        className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Publish
                      </button>
                    )}
                    {selectedPrompt.status === "published" && (
                      <button
                        onClick={() => handleStatusChange(selectedPrompt, "archived")}
                        className="flex items-center gap-1 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                        Archive
                      </button>
                    )}
                    {selectedPrompt.status === "archived" && (
                      <button
                        onClick={() => handleStatusChange(selectedPrompt, "draft")}
                        className="flex items-center gap-1 px-4 py-2 text-sm bg-stone-600 text-white rounded-lg hover:bg-stone-700"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restore to Draft
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-stone-500">
              <FileText className="w-12 h-12 mb-4 text-stone-300" />
              <p className="text-lg font-medium">Select a prompt</p>
              <p className="text-sm">Choose a prompt from the list to view or edit</p>
            </div>
          )}
        </div>
      </div>

      {/* Version History */}
      {selectedPrompt && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center gap-2">
            <History className="w-4 h-4 text-stone-600" />
            <h2 className="font-semibold text-stone-900">Version History</h2>
          </div>
          <div className="divide-y divide-stone-100">
            {prompts
              .filter(p => p.name === selectedPrompt.name)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((prompt, index) => (
                <div key={prompt.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${index === 0 ? "bg-green-500" : "bg-stone-300"}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Version {prompt.version}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[prompt.status].badge}`}>
                          {prompt.status}
                        </span>
                      </div>
                      <p className="text-sm text-stone-500">
                        {formatDate(prompt.createdAt)}
                        {prompt.createdBy && ` by ${prompt.createdBy}`}
                      </p>
                    </div>
                  </div>
                  {index > 0 && (
                    <button
                      onClick={() => handleRollback(prompt)}
                      className="flex items-center gap-1 text-sm text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-lg"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restore
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
