"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Search,
  CheckCircle,
  XCircle,
  Eye,
  HelpCircle,
  Clock,
  User,
  MessageSquare,
  Filter,
  BookOpen,
  Send,
  AlertCircle,
  RefreshCw,
  X,
  Save,
  Sparkles,
  Loader2,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import type { UnknownQuestion, UnknownQuestionStatus } from "@/types/ai-settings";
import type { KnowledgeCategory } from "@/lib/ai/knowledge/types";

const STATUS_COLORS: Record<UnknownQuestionStatus, { bg: string; text: string; badge: string }> = {
  pending: { bg: "bg-yellow-50", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-800" },
  in_review: { bg: "bg-blue-50", text: "text-blue-700", badge: "bg-blue-100 text-blue-800" },
  resolved: { bg: "bg-green-50", text: "text-green-700", badge: "bg-green-100 text-green-800" },
  added_to_knowledge: { bg: "bg-purple-50", text: "text-purple-700", badge: "bg-purple-100 text-purple-800" },
};

const STATUS_OPTIONS: { value: UnknownQuestionStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In Review" },
  { value: "resolved", label: "Resolved" },
  { value: "added_to_knowledge", label: "Added to Knowledge" },
];

// Categories based on public pages
const KNOWLEDGE_CATEGORIES: { value: KnowledgeCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "aaradhane", label: "Aaradhane" },
  { value: "about", label: "About" },
  { value: "donation", label: "Donation" },
  { value: "events", label: "Events" },
  { value: "facilities", label: "Facilities" },
  { value: "future-plans", label: "Future Plans" },
  { value: "gallery", label: "Gallery" },
  { value: "guruparampara", label: "Guru Parampara" },
  { value: "journey", label: "Temple Journey" },
  { value: "pooja", label: "Pooja Services" },
  { value: "sevas", label: "Sevas" },
  { value: "shlokas", label: "Shlokas" },
  { value: "temple-explorer", label: "Temple Explorer" },
  { value: "testimonials", label: "Testimonials" },
  { value: "trust", label: "Trust" },
  { value: "volunteer", label: "Volunteer" },
  { value: "faq", label: "FAQ" },
  { value: "contact", label: "Contact" },
  { value: "dress-code", label: "Dress Code" },
  { value: "parking", label: "Parking" },
  { value: "history", label: "History" },
  { value: "raghavendra-swamy", label: "Sri Raghavendra Swamy" },
  { value: "brindavana", label: "Brindavana" },
  { value: "madhvacharya", label: "Sri Madhvacharya" },
  { value: "mantralaya", label: "Mantralaya" },
  { value: "photography", label: "Photography" },
  { value: "accommodation", label: "Accommodation" },
];

export default function UnknownQuestionsPage() {
  const [questions, setQuestions] = useState<UnknownQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<UnknownQuestionStatus | "all">("all");
  const [selectedQuestion, setSelectedQuestion] = useState<UnknownQuestion | null>(null);

  // Knowledge modal state
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [knowledgeForm, setKnowledgeForm] = useState({
    title: "",
    content: "",
    keywords: "",
    category: "general" as KnowledgeCategory,
  });
  const [savingKnowledge, setSavingKnowledge] = useState(false);

  const showMsg = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/ai/settings/unknown-questions");
      const data = await response.json();
      setQuestions(data.questions || data || []);
    } catch (error) {
      console.error("Error loading questions:", error);
      showMsg("error", "Failed to load unknown questions");
    } finally {
      setLoading(false);
    }
  }, [showMsg]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleStatusChange = async (question: UnknownQuestion, newStatus: UnknownQuestionStatus) => {
    try {
      const response = await fetch(`/api/ai/settings/unknown-questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          questionId: question.id,
          action: "update",
          status: newStatus
        }),
      });
      
      if (response.ok) {
        showMsg("success", "Status updated successfully");
        loadQuestions();
      } else {
        const error = await response.json();
        showMsg("error", error.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      showMsg("error", "Failed to update status");
    }
  };

  const handleDelete = async (question: UnknownQuestion) => {
    if (!confirm("Delete this question?")) return;
    
    try {
      const response = await fetch(`/api/ai/settings/unknown-questions?questionId=${question.id}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        showMsg("success", "Question deleted");
        if (selectedQuestion?.id === question.id) {
          setSelectedQuestion(null);
        }
        loadQuestions();
      } else {
        const error = await response.json();
        showMsg("error", error.error || "Failed to delete question");
      }
    } catch (error) {
      console.error("Error deleting question:", error);
      showMsg("error", "Failed to delete question");
    }
  };

  // Open knowledge modal with question pre-filled
  const openKnowledgeModal = (question: UnknownQuestion) => {
    setKnowledgeForm({
      title: question.question,
      content: "",
      keywords: question.intent?.toLowerCase() || "",
      category: "general",
    });
    setShowKnowledgeModal(true);
  };

  // Save to knowledge base and mark as added
  const handleAddToKnowledge = async () => {
    if (!selectedQuestion) return;
    
    if (!knowledgeForm.content.trim()) {
      showMsg("error", "Please provide an answer/content for the AI to learn");
      return;
    }

    setSavingKnowledge(true);
    try {
      // Create knowledge article
      const response = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: knowledgeForm.title,
          content: knowledgeForm.content,
          keywords: knowledgeForm.keywords.split(",").map(k => k.trim()).filter(Boolean),
          category: knowledgeForm.category,
          slug: `uq-${Date.now()}`,
        }),
      });

      if (response.ok) {
        // Update unknown question status
        await fetch(`/api/ai/settings/unknown-questions`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: selectedQuestion.id,
            action: "update",
            status: "added_to_knowledge",
          }),
        });

        showMsg("success", "Added to Knowledge Base! AI can now answer this question.");
        setShowKnowledgeModal(false);
        setSelectedQuestion(null);
        loadQuestions();
      } else {
        const error = await response.json();
        showMsg("error", error.error || "Failed to add to knowledge");
      }
    } catch (error) {
      console.error("Error adding to knowledge:", error);
      showMsg("error", "Failed to add to knowledge");
    } finally {
      setSavingKnowledge(false);
    }
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = 
      q.question?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.intent?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || (q.status || "pending") === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeSince = (date: string | Date) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
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
        title="Unknown Questions"
        description="Review and manage unrecognized questions to improve AI responses."
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATUS_OPTIONS.map((status) => {
          const count = questions.filter(q => (q.status || "pending") === status.value).length;
          const colors = STATUS_COLORS[status.value];
          return (
            <button
              key={status.value}
              onClick={() => setStatusFilter(status.value)}
              className={`p-4 rounded-xl border transition-all ${
                statusFilter === status.value
                  ? "border-amber-500 bg-amber-50"
                  : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <p className={`text-2xl font-bold ${colors.text}`}>{count}</p>
              <p className="text-sm text-stone-600">{status.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions or intents..."
              className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-stone-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UnknownQuestionStatus | "all")}
              className="px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All Status</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={loadQuestions}
              className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Questions List */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-200 bg-stone-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-stone-600" />
                <h2 className="font-semibold text-stone-900">Questions</h2>
                <span className="text-xs text-stone-500">({filteredQuestions.length})</span>
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-stone-100 max-h-[500px] overflow-y-auto">
            {filteredQuestions.length === 0 ? (
              <div className="p-8 text-center text-stone-500">
                <HelpCircle className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                <p className="text-sm">No questions found</p>
              </div>
            ) : (
              filteredQuestions.map((question) => {
                const questionStatus = question.status || "pending";
                const colors = STATUS_COLORS[questionStatus];
                return (
                  <div
                    key={question.id}
                    onClick={() => setSelectedQuestion(question)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedQuestion?.id === question.id ? "bg-amber-50" : "hover:bg-stone-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-stone-900 line-clamp-2">
                          {question.question}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>
                            {questionStatus.replace("_", " ")}
                          </span>
                          {question.intent && (
                            <span className="text-xs text-stone-500">
                              Intent: {question.intent}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-stone-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getTimeSince(question.timestamp)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {question.timesAsked || 1}x
                          </span>
                          {question.language && (
                            <span className="uppercase">{question.language}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Question Details */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          {selectedQuestion ? (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-stone-200 bg-stone-50">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-stone-900">Question Details</h2>
                  <button
                    onClick={() => handleDelete(selectedQuestion)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 space-y-6">
                {/* Question */}
                <div>
                  <h3 className="text-sm font-medium text-stone-700 mb-2">Question</h3>
                  <p className="text-lg text-stone-900 bg-amber-50 p-4 rounded-lg border border-amber-100">
                    {selectedQuestion.question}
                  </p>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-stone-50 p-3 rounded-lg">
                    <p className="text-xs text-stone-500 mb-1">Status</p>
                    <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedQuestion.status || "pending"].badge}`}>
                      {(selectedQuestion.status || "pending").replace("_", " ")}
                    </span>
                  </div>
                  <div className="bg-stone-50 p-3 rounded-lg">
                    <p className="text-xs text-stone-500 mb-1">Times Asked</p>
                    <p className="text-lg font-bold text-stone-900">{selectedQuestion.timesAsked || 1}</p>
                  </div>
                  <div className="bg-stone-50 p-3 rounded-lg">
                    <p className="text-xs text-stone-500 mb-1">Language</p>
                    <p className="text-sm font-medium text-stone-900 uppercase">
                      {selectedQuestion.language || "N/A"}
                    </p>
                  </div>
                  <div className="bg-stone-50 p-3 rounded-lg">
                    <p className="text-xs text-stone-500 mb-1">Confidence</p>
                    <p className="text-lg font-bold text-stone-900">
                      {selectedQuestion.confidence !== undefined 
                        ? `${(selectedQuestion.confidence * 100).toFixed(0)}%`
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {/* Intent */}
                {selectedQuestion.intent && (
                  <div>
                    <h3 className="text-sm font-medium text-stone-700 mb-2">Detected Intent</h3>
                    <p className="text-sm text-stone-600 bg-stone-50 p-3 rounded-lg">
                      {selectedQuestion.intent}
                    </p>
                  </div>
                )}

                {/* Assigned To */}
                {selectedQuestion.assignedTo && (
                  <div>
                    <h3 className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Assigned To
                    </h3>
                    <p className="text-sm text-stone-600 bg-stone-50 p-3 rounded-lg">
                      {selectedQuestion.assignedTo}
                    </p>
                  </div>
                )}

                {/* Timestamps */}
                <div className="pt-4 border-t border-stone-200 text-xs text-stone-500">
                  <p>First asked: {formatDate(selectedQuestion.timestamp)}</p>
                  {selectedQuestion.lastAsked && (
                    <p>Last asked: {formatDate(selectedQuestion.lastAsked)}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-stone-200 space-y-3">
                  <h3 className="text-sm font-medium text-stone-700">Quick Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    {/* Add to Knowledge Button */}
                    <button
                      onClick={() => openKnowledgeModal(selectedQuestion)}
                      className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg transition-colors bg-purple-100 text-purple-700 hover:bg-purple-200"
                    >
                      <Sparkles className="w-4 h-4" />
                      Add to Knowledge
                    </button>
                    
                    {/* Status Buttons */}
                    {STATUS_OPTIONS.filter(s => s.value !== "added_to_knowledge" && s.value !== (selectedQuestion.status || "pending")).map((status) => (
                      <button
                        key={status.value}
                        onClick={() => handleStatusChange(selectedQuestion, status.value)}
                        className={`flex items-center gap-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                          status.value === "resolved"
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : status.value === "in_review"
                            ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                            : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        }`}
                      >
                        {status.value === "resolved" && <CheckCircle className="w-4 h-4" />}
                        Mark as {status.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-stone-500">
              <HelpCircle className="w-12 h-12 mb-4 text-stone-300" />
              <p className="text-lg font-medium">Select a question</p>
              <p className="text-sm">Choose a question from the list to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Add to Knowledge Modal */}
      {showKnowledgeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-stone-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-stone-900">Add to Knowledge Base</h2>
                    <p className="text-sm text-stone-500">Train the AI to answer this question</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowKnowledgeModal(false)}
                  className="p-2 hover:bg-stone-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-stone-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Question (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Question</label>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-stone-900">
                  {knowledgeForm.title}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Category</label>
                <select
                  value={knowledgeForm.category}
                  onChange={(e) => setKnowledgeForm({ ...knowledgeForm, category: e.target.value as KnowledgeCategory })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  {KNOWLEDGE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Answer/Content */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Answer <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={knowledgeForm.content}
                  onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                  placeholder="Enter the answer that the AI should learn..."
                  rows={6}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <p className="text-xs text-stone-500 mt-1">
                  This content will be used by the AI to answer similar questions in the future.
                </p>
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Keywords</label>
                <input
                  type="text"
                  value={knowledgeForm.keywords}
                  onChange={(e) => setKnowledgeForm({ ...knowledgeForm, keywords: e.target.value })}
                  placeholder="temple, pooja, timings (comma separated)"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-stone-200 flex justify-end gap-3">
              <button
                onClick={() => setShowKnowledgeModal(false)}
                className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg"
                disabled={savingKnowledge}
              >
                Cancel
              </button>
              <button
                onClick={handleAddToKnowledge}
                disabled={savingKnowledge || !knowledgeForm.content.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingKnowledge ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Add to Knowledge & Mark Complete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
