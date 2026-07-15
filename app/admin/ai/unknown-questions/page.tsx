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
} from "lucide-react";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import type { UnknownQuestion, UnknownQuestionStatus } from "@/types/ai-settings";

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

export default function UnknownQuestionsPage() {
  const [questions, setQuestions] = useState<UnknownQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<UnknownQuestionStatus | "all">("all");
  const [selectedQuestion, setSelectedQuestion] = useState<UnknownQuestion | null>(null);

  const showMsg = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/ai/settings/unknown-questions");
      const data = await response.json();
      setQuestions(data.data || []);
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
      const response = await fetch(`/api/ai/settings/unknown-questions?id=${question.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.ok) {
        showMsg("success", "Status updated successfully");
        loadQuestions();
      }
    } catch (error) {
      showMsg("error", "Failed to update status");
    }
  };

  const handleDelete = async (question: UnknownQuestion) => {
    if (!confirm("Delete this question?")) return;
    
    try {
      const response = await fetch(`/api/ai/settings/unknown-questions?id=${question.id}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        showMsg("success", "Question deleted");
        if (selectedQuestion?.id === question.id) {
          setSelectedQuestion(null);
        }
        loadQuestions();
      }
    } catch (error) {
      showMsg("error", "Failed to delete question");
    }
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = 
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.intent?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || q.status === statusFilter;
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
          const count = questions.filter(q => q.status === status.value).length;
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
                const colors = STATUS_COLORS[question.status];
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
                            {question.status.replace("_", " ")}
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
                    <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedQuestion.status].badge}`}>
                      {selectedQuestion.status.replace("_", " ")}
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
                  <h3 className="text-sm font-medium text-stone-700">Update Status</h3>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.filter(s => s.value !== selectedQuestion.status).map((status) => (
                      <button
                        key={status.value}
                        onClick={() => handleStatusChange(selectedQuestion, status.value)}
                        className={`flex items-center gap-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                          status.value === "resolved"
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : status.value === "added_to_knowledge"
                            ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                            : status.value === "in_review"
                            ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                            : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        }`}
                      >
                        {status.value === "resolved" && <CheckCircle className="w-4 h-4" />}
                        {status.value === "added_to_knowledge" && <BookOpen className="w-4 h-4" />}
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
    </div>
  );
}
