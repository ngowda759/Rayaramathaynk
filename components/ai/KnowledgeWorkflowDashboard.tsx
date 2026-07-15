"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit3,
  History,
  Users,
  Eye,
  Send,
  Archive,
  RotateCcw,
  ChevronRight,
  MessageSquare,
  GitBranch,
  BarChart3,
} from "lucide-react";
import type {
  WorkflowArticle,
  WorkflowStatus,
  WorkflowStatistics,
  ArticleVersion,
  WorkflowAction,
  ReviewComment,
  CommitteeApproval,
  ArticleHistory,
} from "@/types/knowledge-workflow";
import { CATEGORY_DISPLAY_NAMES } from "@/lib/ai/knowledge/types";

interface KnowledgeWorkflowDashboardProps {
  currentUserId?: string;
  currentUserRole?: "contributor" | "reviewer" | "committee_member" | "admin";
  className?: string;
}

// Status Badge Component
function StatusBadge({ status }: { status: WorkflowStatus }) {
  const config: Record<WorkflowStatus, { color: string; icon: React.ElementType; label: string }> = {
    draft: { color: "bg-gray-100 text-gray-700", icon: Edit3, label: "Draft" },
    pending_review: { color: "bg-yellow-100 text-yellow-700", icon: Clock, label: "Pending Review" },
    in_review: { color: "bg-blue-100 text-blue-700", icon: Eye, label: "In Review" },
    changes_requested: { color: "bg-orange-100 text-orange-700", icon: AlertCircle, label: "Changes Requested" },
    pending_approval: { color: "bg-purple-100 text-purple-700", icon: Users, label: "Pending Approval" },
    approved: { color: "bg-green-100 text-green-700", icon: CheckCircle, label: "Approved" },
    published: { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle, label: "Published" },
    archived: { color: "bg-slate-100 text-slate-700", icon: Archive, label: "Archived" },
  };

  const { color, icon: Icon, label } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// Workflow Timeline Component
function WorkflowTimeline({ status }: { status: WorkflowStatus }) {
  const steps = [
    { key: "draft", label: "Draft" },
    { key: "pending_review", label: "Submit" },
    { key: "in_review", label: "Review" },
    { key: "pending_approval", label: "Committee" },
    { key: "approved", label: "Approve" },
    { key: "published", label: "Publish" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === status);
  const isArchived = status === "archived";
  const isChangesRequested = status === "changes_requested";

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, index) => {
        const isComplete = index < currentIndex && !isChangesRequested;
        const isCurrent = index === currentIndex;
        const isRejected = isChangesRequested && step.key === "in_review";

        return (
          <div key={step.key} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                isComplete
                  ? "bg-green-500 text-white"
                  : isCurrent
                  ? "bg-blue-500 text-white"
                  : isRejected
                  ? "bg-orange-500 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {isComplete ? (
                <CheckCircle className="w-4 h-4" />
              ) : isRejected ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            {index < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 text-gray-300 mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Article Card Component
function ArticleCard({
  article,
  onClick,
}: {
  article: WorkflowArticle;
  onClick: () => void;
}) {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-gray-900 line-clamp-1">{article.title}</h3>
        <StatusBadge status={article.status} />
      </div>
      <p className="text-sm text-gray-500 mb-3">
        {CATEGORY_DISPLAY_NAMES[article.category] || article.category}
      </p>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>v{article.currentVersion}</span>
        <span>{new Date(article.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

// Article Detail Panel
function ArticleDetailPanel({
  article,
  versions,
  history,
  comments,
  committeeApproval,
  onClose,
  onAction,
  currentUserRole,
}: {
  article: WorkflowArticle;
  versions?: ArticleVersion[];
  history?: ArticleHistory;
  comments?: ReviewComment[];
  committeeApproval?: CommitteeApproval;
  onClose: () => void;
  onAction: (action: string, comment?: string) => void;
  currentUserRole: string;
}) {
  const [activeTab, setActiveTab] = useState<"content" | "history" | "comments">("content");
  const [commentText, setCommentText] = useState("");

  const handleSubmitComment = () => {
    if (commentText.trim()) {
      onAction("comment", commentText);
      setCommentText("");
    }
  };

  const canReview = currentUserRole === "reviewer" || currentUserRole === "admin";
  const canApprove = currentUserRole === "committee_member" || currentUserRole === "admin";
  const isAuthor = article.createdBy === "currentUser";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{article.title}</h2>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={article.status} />
                <span className="text-sm text-gray-500">v{article.currentVersion}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <XCircle className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          {/* Workflow Progress */}
          <div className="mt-4">
            <WorkflowTimeline status={article.status} />
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-4">
            {["content", "history", "comments"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as typeof activeTab)}
                className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "content" && (
            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap">{article.content}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {article.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {activeTab === "history" && history && (
            <div className="space-y-4">
              {history.entries.map((entry, index) => (
                <div key={index} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    {entry.type === "created" && <FileText className="w-4 h-4 text-gray-500" />}
                    {entry.type === "updated" && <Edit3 className="w-4 h-4 text-gray-500" />}
                    {entry.type === "submitted" && <Send className="w-4 h-4 text-gray-500" />}
                    {entry.type === "reviewed" && <Eye className="w-4 h-4 text-gray-500" />}
                    {entry.type === "approved" && <CheckCircle className="w-4 h-4 text-green-500" />}
                    {entry.type === "published" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    {entry.type === "commented" && <MessageSquare className="w-4 h-4 text-gray-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{entry.description}</p>
                    <p className="text-xs text-gray-500">
                      {entry.performedBy} • {new Date(entry.performedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "comments" && (
            <div className="space-y-4">
              {comments && comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-900">{comment.content}</p>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>{comment.createdBy}</span>
                      <span>{new Date(comment.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No comments yet</p>
              )}
              
              {/* Add Comment */}
              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSubmitComment}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {article.status === "draft" && isAuthor && (
                <button
                  onClick={() => onAction("submit_for_review")}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  Submit for Review
                </button>
              )}
              {article.status === "pending_review" && canReview && (
                <>
                  <button
                    onClick={() => onAction("start_review")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    Start Review
                  </button>
                  <button
                    onClick={() => onAction("reject")}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                  >
                    Reject
                  </button>
                </>
              )}
              {article.status === "in_review" && canReview && (
                <>
                  <button
                    onClick={() => onAction("approve_for_committee")}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                  >
                    Approve for Committee
                  </button>
                  <button
                    onClick={() => onAction("request_changes")}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700"
                  >
                    Request Changes
                  </button>
                </>
              )}
              {article.status === "pending_approval" && canApprove && (
                <>
                  <button
                    onClick={() => onAction("approve")}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onAction("reject")}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                  >
                    Reject
                  </button>
                </>
              )}
              {article.status === "approved" && canApprove && (
                <button
                  onClick={() => onAction("publish")}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                >
                  Publish
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KnowledgeWorkflowDashboard({
  currentUserId = "user",
  currentUserRole = "admin",
  className = "",
}: KnowledgeWorkflowDashboardProps) {
  const [articles, setArticles] = useState<WorkflowArticle[]>([]);
  const [statistics, setStatistics] = useState<WorkflowStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<WorkflowArticle | null>(null);
  const [articleDetails, setArticleDetails] = useState<{
    versions?: ArticleVersion[];
    history?: ArticleHistory;
    comments?: ReviewComment[];
    committeeApproval?: CommitteeApproval;
  } | null>(null);
  const [filterStatus, setFilterStatus] = useState<WorkflowStatus | "all">("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [articlesRes, statsRes] = await Promise.all([
        fetch("/api/knowledge/workflow/articles"),
        fetch("/api/knowledge/workflow/statistics"),
      ]);

      if (articlesRes.ok) {
        const data = await articlesRes.json();
        setArticles(data.articles || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStatistics(data.statistics);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const fetchArticleDetails = async (articleId: string) => {
    try {
      const res = await fetch(
        `/api/knowledge/workflow/articles/${articleId}?includeHistory=true&includeVersions=true&includeComments=true&includeApprovals=true`
      );
      if (res.ok) {
        const data = await res.json();
        setArticleDetails({
          versions: data.versions,
          history: data.history,
          comments: data.comments,
          committeeApproval: data.committeeApproval,
        });
      }
    } catch (err) {
      console.error("Failed to fetch article details:", err);
    }
  };

  const handleAction = async (action: string, comment?: string) => {
    if (!selectedArticle) return;

    try {
      const res = await fetch(`/api/knowledge/workflow/articles/${selectedArticle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          updatedBy: currentUserId,
          comment,
        }),
      });

      if (res.ok) {
        fetchData();
        fetchArticleDetails(selectedArticle.id);
        setSelectedArticle(null);
      }
    } catch (err) {
      console.error("Action failed:", err);
    }
  };

  const filteredArticles = filterStatus === "all"
    ? articles
    : articles.filter((a) => a.status === filterStatus);

  const statusFilters: WorkflowStatus[] = [
    "draft",
    "pending_review",
    "in_review",
    "changes_requested",
    "pending_approval",
    "approved",
    "published",
  ];

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Knowledge Workflow</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage article drafts, reviews, and approvals
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2"
        >
          <BarChart3 className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Articles</p>
            <p className="text-2xl font-bold text-gray-900">{statistics.totalArticles}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Pending Review</p>
            <p className="text-2xl font-bold text-yellow-600">{statistics.pendingReviewCount}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Pending Approval</p>
            <p className="text-2xl font-bold text-purple-600">{statistics.pendingApprovalCount}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Published</p>
            <p className="text-2xl font-bold text-green-600">{statistics.byStatus.published || 0}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterStatus("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filterStatus === "all"
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All ({articles.length})
        </button>
        {statusFilters.map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterStatus === status
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {status.replace(/_/g, " ")} ({articles.filter((a) => a.status === status).length})
          </button>
        ))}
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredArticles.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            onClick={() => {
              setSelectedArticle(article);
              fetchArticleDetails(article.id);
            }}
          />
        ))}
      </div>

      {filteredArticles.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No articles found</p>
        </div>
      )}

      {/* Article Detail Modal */}
      {selectedArticle && articleDetails && (
        <ArticleDetailPanel
          article={selectedArticle}
          versions={articleDetails.versions}
          history={articleDetails.history}
          comments={articleDetails.comments}
          committeeApproval={articleDetails.committeeApproval}
          onClose={() => {
            setSelectedArticle(null);
            setArticleDetails(null);
          }}
          onAction={handleAction}
          currentUserRole={currentUserRole}
        />
      )}
    </div>
  );
}
