// Knowledge Workflow Types for Sprint B
// Defines types for Draft → Review → Publish workflow, version history, committee approval, audit trail

import { KnowledgeCategory, KnowledgeLanguage } from "@/lib/ai/knowledge/types";

/**
 * Article Workflow Status
 */
export type WorkflowStatus = 
  | "draft"           // Initial creation, not submitted
  | "pending_review"  // Submitted for review
  | "in_review"       // Being actively reviewed
  | "changes_requested" // Reviewer requested changes
  | "pending_approval" // Approved by reviewer, awaiting committee
  | "approved"        // Approved by committee, ready to publish
  | "published"       // Live in the knowledge base
  | "archived";       // Removed from live, archived

/**
 * User roles in the workflow
 */
export type WorkflowRole = 
  | "contributor"     // Can create drafts
  | "reviewer"        // Can review and approve for committee
  | "committee_member" // Can approve/reject articles
  | "admin";          // Full access

/**
 * Article Version
 */
export interface ArticleVersion {
  id: string;
  articleId: string;
  version: number;
  title: string;
  content: string;
  keywords: string[];
  category: KnowledgeCategory;
  language: KnowledgeLanguage;
  createdAt: Date;
  createdBy: string;
  changeDescription: string;
}

/**
 * Workflow Action
 */
export interface WorkflowAction {
  id: string;
  articleId: string;
  action: WorkflowActionType;
  fromStatus: WorkflowStatus;
  toStatus: WorkflowStatus;
  performedBy: string;
  performedAt: Date;
  comment?: string;
  previousVersionId?: string;
  newVersionId?: string;
}

export type WorkflowActionType =
  | "create"
  | "submit_for_review"
  | "start_review"
  | "approve_for_committee"
  | "request_changes"
  | "approve"
  | "reject"
  | "publish"
  | "unpublish"
  | "archive"
  | "restore";

/**
 * Review Comment
 */
export interface ReviewComment {
  id: string;
  articleId: string;
  versionId?: string;
  content: string;
  createdBy: string;
  createdAt: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
}

/**
 * Committee Approval
 */
export interface CommitteeApproval {
  id: string;
  articleId: string;
  requiredApprovals: number;
  currentApprovals: number;
  approvals: CommitteeMemberApproval[];
  status: "pending" | "approved" | "rejected";
  deadline?: Date;
  createdAt: Date;
  completedAt?: Date;
}

export interface CommitteeMemberApproval {
  memberId: string;
  memberName: string;
  decision: "approve" | "reject" | "abstain";
  comment?: string;
  votedAt: Date;
}

/**
 * Audit Log Entry
 */
export interface AuditLogEntry {
  id: string;
  entityType: "article" | "version" | "workflow" | "comment" | "approval";
  entityId: string;
  action: string;
  performedBy: string;
  performedAt: Date;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Article with Workflow metadata
 */
export interface WorkflowArticle {
  id: string;
  slug: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  keywords: string[];
  language: KnowledgeLanguage;
  
  // Workflow fields
  status: WorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  
  // Metadata
  createdBy: string;
  updatedBy: string;
  lastReviewedBy?: string;
  lastReviewedAt?: Date;
  
  // Version info
  currentVersion: number;
  versionId: string;
  
  // Committee info
  committeeApprovals?: CommitteeApproval;
  
  // Flags
  isFeatured: boolean;
  isArchived: boolean;
}

/**
 * Workflow Query Filters
 */
export interface WorkflowQueryParams {
  status?: WorkflowStatus[];
  category?: KnowledgeCategory[];
  language?: KnowledgeLanguage[];
  createdBy?: string;
  reviewedBy?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

/**
 * Workflow Statistics
 */
export interface WorkflowStatistics {
  totalArticles: number;
  byStatus: Record<WorkflowStatus, number>;
  pendingReviewCount: number;
  pendingApprovalCount: number;
  averageReviewTime: number; // in hours
  averageApprovalTime: number; // in hours
  articlesPublishedThisWeek: number;
  articlesPublishedThisMonth: number;
}

/**
 * Draft Article (before submission)
 */
export interface DraftArticle {
  id: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  keywords: string[];
  language: KnowledgeLanguage;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastSavedAt: Date;
}

/**
 * Article History (timeline view)
 */
export interface ArticleHistory {
  articleId: string;
  entries: ArticleHistoryEntry[];
}

export interface ArticleHistoryEntry {
  type: "created" | "updated" | "submitted" | "reviewed" | "approved" | "published" | "commented" | "archived";
  description: string;
  performedBy: string;
  performedAt: Date;
  details?: Record<string, unknown>;
}
