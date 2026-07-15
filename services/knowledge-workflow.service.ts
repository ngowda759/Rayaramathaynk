// Knowledge Workflow Service
// Handles Draft → Review → Publish workflow, versioning, committee approval, and audit trail

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  increment,
  writeBatch,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import {
  WorkflowArticle,
  WorkflowStatus,
  WorkflowAction,
  WorkflowActionType,
  ArticleVersion,
  ReviewComment,
  CommitteeApproval,
  CommitteeMemberApproval,
  AuditLogEntry,
  WorkflowQueryParams,
  WorkflowStatistics,
  DraftArticle,
  ArticleHistory,
  ArticleHistoryEntry,
  WorkflowRole,
} from "@/types/knowledge-workflow";
import {
  KnowledgeArticleRequest,
  KnowledgeArticleUpdate,
  KnowledgeCategory,
  KnowledgeLanguage,
} from "@/lib/ai/knowledge/types";

const COLLECTIONS = {
  ARTICLES: "knowledge_workflow",
  VERSIONS: "knowledge_versions",
  WORKFLOW_ACTIONS: "knowledge_workflow_actions",
  REVIEW_COMMENTS: "knowledge_review_comments",
  COMMITTEE_APPROVALS: "knowledge_committee_approvals",
  AUDIT_LOG: "knowledge_audit_log",
  DRAFTS: "knowledge_drafts",
};

// Helper to convert timestamps
function toDate(value: any): Date {
  if (!value) return new Date();
  if (value.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value);
}

// ============ VERSION MANAGEMENT ============

/**
 * Create a new version of an article
 */
export async function createVersion(
  articleId: string,
  data: {
    title: string;
    content: string;
    keywords: string[];
    category: KnowledgeCategory;
    language: KnowledgeLanguage;
    createdBy: string;
    changeDescription: string;
    previousVersionId?: string;
  }
): Promise<string> {
  if (!isFirebaseConfigured() || !db) {
    throw new Error("Firebase not configured");
  }

  // Get current version number
  const versionsQuery = query(
    collection(db, COLLECTIONS.VERSIONS),
    where("articleId", "==", articleId),
    orderBy("version", "desc"),
    limit(1)
  );
  const versionsSnap = await getDocs(versionsQuery);
  const currentVersion = versionsSnap.empty ? 0 : (versionsSnap.docs[0].data().version || 0);

  const versionRef = await addDoc(collection(db, COLLECTIONS.VERSIONS), {
    articleId,
    version: currentVersion + 1,
    ...data,
    createdAt: serverTimestamp(),
  });

  // Log audit entry
  await createAuditEntry({
    entityType: "version",
    entityId: versionRef.id,
    action: "create_version",
    newState: { version: currentVersion + 1, articleId },
  });

  return versionRef.id;
}

/**
 * Get all versions of an article
 */
export async function getArticleVersions(articleId: string): Promise<ArticleVersion[]> {
  if (!isFirebaseConfigured() || !db) {
    return [];
  }

  const q = query(
    collection(db, COLLECTIONS.VERSIONS),
    where("articleId", "==", articleId),
    orderBy("version", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    articleId: doc.data().articleId,
    version: doc.data().version,
    title: doc.data().title,
    content: doc.data().content,
    keywords: doc.data().keywords || [],
    category: doc.data().category,
    language: doc.data().language,
    createdAt: toDate(doc.data().createdAt),
    createdBy: doc.data().createdBy,
    changeDescription: doc.data().changeDescription || "",
  }));
}

/**
 * Get a specific version by ID
 */
export async function getVersionById(versionId: string): Promise<ArticleVersion | null> {
  if (!isFirebaseConfigured() || !db) {
    return null;
  }

  const docRef = doc(db, COLLECTIONS.VERSIONS, versionId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    articleId: data.articleId,
    version: data.version,
    title: data.title,
    content: data.content,
    keywords: data.keywords || [],
    category: data.category,
    language: data.language,
    createdAt: toDate(data.createdAt),
    createdBy: data.createdBy,
    changeDescription: data.changeDescription || "",
  };
}

/**
 * Restore an article to a specific version
 */
export async function restoreToVersion(
  articleId: string,
  versionId: string,
  performedBy: string
): Promise<void> {
  const version = await getVersionById(versionId);
  if (!version) throw new Error("Version not found");

  // Create a new version with the restored content
  await createVersion(articleId, {
    title: version.title,
    content: version.content,
    keywords: version.keywords,
    category: version.category,
    language: version.language,
    createdBy: performedBy,
    changeDescription: `Restored to version ${version.version}`,
    previousVersionId: versionId,
  });
}

// ============ WORKFLOW ACTIONS ============

/**
 * Perform a workflow action on an article
 */
export async function performWorkflowAction(
  articleId: string,
  action: WorkflowActionType,
  performedBy: string,
  comment?: string
): Promise<WorkflowAction> {
  if (!isFirebaseConfigured() || !db) {
    throw new Error("Firebase not configured");
  }

  const articleRef = doc(db, COLLECTIONS.ARTICLES, articleId);
  const articleSnap = await getDoc(articleRef);

  if (!articleSnap.exists()) {
    throw new Error("Article not found");
  }

  const currentData = articleSnap.data();
  const fromStatus = currentData.status as WorkflowStatus;
  const toStatus = getNextStatus(fromStatus, action);

  // Create workflow action record
  const actionRef = await addDoc(collection(db, COLLECTIONS.WORKFLOW_ACTIONS), {
    articleId,
    action,
    fromStatus,
    toStatus,
    performedBy,
    performedAt: serverTimestamp(),
    comment,
  });

  // Update article status
  const updateData: Record<string, any> = {
    status: toStatus,
    updatedAt: serverTimestamp(),
    updatedBy: performedBy,
  };

  // Handle specific action effects
  switch (action) {
    case "submit_for_review":
      updateData.submittedAt = serverTimestamp();
      updateData.submittedBy = performedBy;
      break;
    case "approve_for_committee":
      updateData.reviewedAt = serverTimestamp();
      updateData.reviewedBy = performedBy;
      // Create committee approval record
      await createCommitteeApproval(articleId);
      break;
    case "publish":
      updateData.publishedAt = serverTimestamp();
      updateData.publishedBy = performedBy;
      break;
    case "archive":
      updateData.archivedAt = serverTimestamp();
      updateData.archivedBy = performedBy;
      break;
  }

  await updateDoc(articleRef, updateData);

  // Log audit entry
  await createAuditEntry({
    entityType: "workflow",
    entityId: actionRef.id,
    action,
    previousState: { status: fromStatus },
    newState: { status: toStatus },
    metadata: { articleId },
  });

  return {
    id: actionRef.id,
    articleId,
    action,
    fromStatus,
    toStatus,
    performedBy,
    performedAt: new Date(),
    comment,
  };
}

/**
 * Get next status based on action
 */
function getNextStatus(current: WorkflowStatus, action: WorkflowActionType): WorkflowStatus {
  const transitions: Record<WorkflowStatus, Partial<Record<WorkflowActionType, WorkflowStatus>>> = {
    draft: { submit_for_review: "pending_review" },
    pending_review: { start_review: "in_review", reject: "draft" },
    in_review: { 
      approve_for_committee: "pending_approval", 
      request_changes: "changes_requested",
      reject: "draft"
    },
    changes_requested: { submit_for_review: "pending_review" },
    pending_approval: { approve: "approved", reject: "draft" },
    approved: { publish: "published" },
    published: { unpublish: "approved", archive: "archived" },
    archived: { restore: "draft" },
  };

  return transitions[current]?.[action] || current;
}

/**
 * Get workflow history for an article
 */
export async function getWorkflowHistory(articleId: string): Promise<WorkflowAction[]> {
  if (!isFirebaseConfigured() || !db) {
    return [];
  }

  const q = query(
    collection(db, COLLECTIONS.WORKFLOW_ACTIONS),
    where("articleId", "==", articleId),
    orderBy("performedAt", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    articleId: doc.data().articleId,
    action: doc.data().action,
    fromStatus: doc.data().fromStatus,
    toStatus: doc.data().toStatus,
    performedBy: doc.data().performedBy,
    performedAt: toDate(doc.data().performedAt),
    comment: doc.data().comment,
  }));
}

// ============ REVIEW COMMENTS ============

/**
 * Add a review comment to an article
 */
export async function addReviewComment(
  articleId: string,
  content: string,
  createdBy: string,
  versionId?: string
): Promise<string> {
  if (!isFirebaseConfigured() || !db) {
    throw new Error("Firebase not configured");
  }

  const commentRef = await addDoc(collection(db, COLLECTIONS.REVIEW_COMMENTS), {
    articleId,
    versionId,
    content,
    createdBy,
    createdAt: serverTimestamp(),
    resolved: false,
  });

  await createAuditEntry({
    entityType: "comment",
    entityId: commentRef.id,
    action: "add_comment",
    newState: { articleId, content },
  });

  return commentRef.id;
}

/**
 * Get comments for an article
 */
export async function getArticleComments(articleId: string): Promise<ReviewComment[]> {
  if (!isFirebaseConfigured() || !db) {
    return [];
  }

  const q = query(
    collection(db, COLLECTIONS.REVIEW_COMMENTS),
    where("articleId", "==", articleId),
    orderBy("createdAt", "asc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    articleId: doc.data().articleId,
    versionId: doc.data().versionId,
    content: doc.data().content,
    createdBy: doc.data().createdBy,
    createdAt: toDate(doc.data().createdAt),
    resolved: doc.data().resolved || false,
    resolvedBy: doc.data().resolvedBy,
    resolvedAt: doc.data().resolvedAt ? toDate(doc.data().resolvedAt) : undefined,
  }));
}

/**
 * Resolve a comment
 */
export async function resolveComment(
  commentId: string,
  resolvedBy: string
): Promise<void> {
  if (!isFirebaseConfigured() || !db) {
    throw new Error("Firebase not configured");
  }

  const commentRef = doc(db, COLLECTIONS.REVIEW_COMMENTS, commentId);
  await updateDoc(commentRef, {
    resolved: true,
    resolvedBy,
    resolvedAt: serverTimestamp(),
  });
}

// ============ COMMITTEE APPROVALS ============

/**
 * Create committee approval record
 */
export async function createCommitteeApproval(
  articleId: string,
  requiredApprovals: number = 2
): Promise<string> {
  if (!isFirebaseConfigured() || !db) {
    throw new Error("Firebase not configured");
  }

  const approvalRef = await addDoc(collection(db, COLLECTIONS.COMMITTEE_APPROVALS), {
    articleId,
    requiredApprovals,
    currentApprovals: 0,
    approvals: [],
    status: "pending",
    createdAt: serverTimestamp(),
  });

  await createAuditEntry({
    entityType: "approval",
    entityId: approvalRef.id,
    action: "create_committee_approval",
    newState: { articleId, requiredApprovals },
  });

  return approvalRef.id;
}

/**
 * Submit committee member vote
 */
export async function submitCommitteeVote(
  approvalId: string,
  memberId: string,
  memberName: string,
  decision: "approve" | "reject" | "abstain",
  comment?: string
): Promise<void> {
  if (!isFirebaseConfigured() || !db) {
    throw new Error("Firebase not configured");
  }

  const approvalRef = doc(db, COLLECTIONS.COMMITTEE_APPROVALS, approvalId);
  const approvalSnap = await getDoc(approvalRef);

  if (!approvalSnap.exists()) {
    throw new Error("Approval not found");
  }

  const approval = approvalSnap.data();
  const existingVote = approval.approvals?.find((a: any) => a.memberId === memberId);

  // Update or add vote
  const updatedApprovals = [...(approval.approvals || [])];
  if (existingVote) {
    const index = updatedApprovals.findIndex((a: any) => a.memberId === memberId);
    updatedApprovals[index] = {
      memberId,
      memberName,
      decision,
      comment,
      votedAt: new Date(),
    };
  } else {
    updatedApprovals.push({
      memberId,
      memberName,
      decision,
      comment,
      votedAt: new Date(),
    });
  }

  // Count approvals
  const approvalCount = updatedApprovals.filter((a: any) => a.decision === "approve").length;
  const rejectionCount = updatedApprovals.filter((a: any) => a.decision === "reject").length;
  const totalVotes = updatedApprovals.filter((a: any) => a.decision !== "abstain").length;

  // Determine status
  let status: "pending" | "approved" | "rejected" = "pending";
  if (rejectionCount >= approval.requiredApprovals - rejectionCount + 1) {
    status = "rejected";
  } else if (approvalCount >= approval.requiredApprovals) {
    status = "approved";
  }

  await updateDoc(approvalRef, {
    approvals: updatedApprovals,
    currentApprovals: approvalCount,
    status,
    completedAt: status !== "pending" ? serverTimestamp() : null,
  });

  // If approved, update article status
  if (status === "approved") {
    const articleQuery = query(
      collection(db, COLLECTIONS.ARTICLES),
      where("__name__", "==", approval.articleId)
    );
    const articleSnap = await getDocs(articleQuery);
    if (!articleSnap.empty) {
      await updateDoc(articleSnap.docs[0].ref, {
        status: "approved",
        updatedAt: serverTimestamp(),
      });
    }
  }

  await createAuditEntry({
    entityType: "approval",
    entityId: approvalId,
    action: `committee_${decision}`,
    newState: { memberId, decision },
  });
}

/**
 * Get committee approval for an article
 */
export async function getArticleCommitteeApproval(
  articleId: string
): Promise<CommitteeApproval | null> {
  if (!isFirebaseConfigured() || !db) {
    return null;
  }

  const q = query(
    collection(db, COLLECTIONS.COMMITTEE_APPROVALS),
    where("articleId", "==", articleId),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const data = snapshot.docs[0].data();
  return {
    id: snapshot.docs[0].id,
    articleId: data.articleId,
    requiredApprovals: data.requiredApprovals,
    currentApprovals: data.currentApprovals,
    approvals: data.approvals || [],
    status: data.status,
    deadline: data.deadline ? toDate(data.deadline) : undefined,
    createdAt: toDate(data.createdAt),
    completedAt: data.completedAt ? toDate(data.completedAt) : undefined,
  };
}

// ============ AUDIT LOG ============

/**
 * Create an audit log entry
 */
async function createAuditEntry(data: {
  entityType: AuditLogEntry["entityType"];
  entityId: string;
  action: string;
  performedBy?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;

  try {
    await addDoc(collection(db, COLLECTIONS.AUDIT_LOG), {
      ...data,
      performedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[Audit Log] Failed to create entry:", error);
  }
}

/**
 * Get audit log for an entity
 */
export async function getAuditLog(
  entityType: AuditLogEntry["entityType"],
  entityId: string
): Promise<AuditLogEntry[]> {
  if (!isFirebaseConfigured() || !db) {
    return [];
  }

  const q = query(
    collection(db, COLLECTIONS.AUDIT_LOG),
    where("entityType", "==", entityType),
    where("entityId", "==", entityId),
    orderBy("performedAt", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    entityType: doc.data().entityType,
    entityId: doc.data().entityId,
    action: doc.data().action,
    performedBy: doc.data().performedBy,
    performedAt: toDate(doc.data().performedAt),
    previousState: doc.data().previousState,
    newState: doc.data().newState,
    metadata: doc.data().metadata,
  }));
}

// ============ ARTICLE CRUD WITH WORKFLOW ============

/**
 * Create a new article (starts as draft)
 */
export async function createWorkflowArticle(
  data: {
    title: string;
    content: string;
    category: KnowledgeCategory;
    keywords: string[];
    language: KnowledgeLanguage;
    slug: string;
  },
  createdBy: string
): Promise<string> {
  if (!isFirebaseConfigured() || !db) {
    throw new Error("Firebase not configured");
  }

  const now = serverTimestamp();

  const articleRef = await addDoc(collection(db, COLLECTIONS.ARTICLES), {
    ...data,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    createdBy,
    updatedBy: createdBy,
    currentVersion: 1,
    versionId: "",
    isFeatured: false,
    isArchived: false,
  });

  // Create first version
  const versionId = await createVersion(articleRef.id, {
    ...data,
    createdBy,
    changeDescription: "Initial creation",
  });

  // Update article with version ID
  await updateDoc(articleRef, { versionId });

  await createAuditEntry({
    entityType: "article",
    entityId: articleRef.id,
    action: "create",
    newState: { ...data, status: "draft" },
  });

  return articleRef.id;
}

/**
 * Update an article (creates new version)
 */
export async function updateWorkflowArticle(
  articleId: string,
  data: {
    title?: string;
    content?: string;
    category?: KnowledgeCategory;
    keywords?: string[];
    language?: KnowledgeLanguage;
    slug?: string;
    isFeatured?: boolean;
  },
  updatedBy: string,
  changeDescription: string = "Content update"
): Promise<void> {
  if (!isFirebaseConfigured() || !db) {
    throw new Error("Firebase not configured");
  }

  const articleRef = doc(db, COLLECTIONS.ARTICLES, articleId);
  const articleSnap = await getDoc(articleRef);

  if (!articleSnap.exists()) {
    throw new Error("Article not found");
  }

  const currentData = articleSnap.data();

  // Create new version if content changed
  if (data.content || data.title) {
    const versionId = await createVersion(articleId, {
      title: data.title || currentData.title,
      content: data.content || currentData.content,
      keywords: data.keywords || currentData.keywords,
      category: data.category || currentData.category,
      language: data.language || currentData.language,
      createdBy: updatedBy,
      changeDescription,
      previousVersionId: currentData.versionId,
    });

    // Update version number
    data as any;
    await updateDoc(articleRef, {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy,
      currentVersion: (currentData.currentVersion || 1) + 1,
      versionId,
    });
  } else {
    await updateDoc(articleRef, {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy,
    });
  }

  await createAuditEntry({
    entityType: "article",
    entityId: articleId,
    action: "update",
    previousState: currentData,
    newState: data,
  });
}

/**
 * Get articles with workflow status
 */
export async function getWorkflowArticles(
  params: WorkflowQueryParams = {}
): Promise<WorkflowArticle[]> {
  if (!isFirebaseConfigured() || !db) {
    return [];
  }

  const q = collection(db, COLLECTIONS.ARTICLES);
  const constraints: any[] = [];

  if (params.status && params.status.length > 0) {
    constraints.push(where("status", "in", params.status));
  }

  if (params.category && params.category.length > 0) {
    constraints.push(where("category", "in", params.category));
  }

  if (params.createdBy) {
    constraints.push(where("createdBy", "==", params.createdBy));
  }

  constraints.push(orderBy("updatedAt", "desc"));

  const finalQuery = query(q, ...constraints, limit(100));

  const snapshot = await getDocs(finalQuery);
  let articles = snapshot.docs.map((doc) => ({
    id: doc.id,
    slug: doc.data().slug,
    title: doc.data().title,
    content: doc.data().content,
    category: doc.data().category,
    keywords: doc.data().keywords || [],
    language: doc.data().language,
    status: doc.data().status as WorkflowStatus,
    createdAt: toDate(doc.data().createdAt),
    updatedAt: toDate(doc.data().updatedAt),
    publishedAt: doc.data().publishedAt ? toDate(doc.data().publishedAt) : undefined,
    createdBy: doc.data().createdBy,
    updatedBy: doc.data().updatedBy,
    lastReviewedBy: doc.data().reviewedBy,
    lastReviewedAt: doc.data().reviewedAt ? toDate(doc.data().reviewedAt) : undefined,
    currentVersion: doc.data().currentVersion || 1,
    versionId: doc.data().versionId,
    isFeatured: doc.data().isFeatured || false,
    isArchived: doc.data().isArchived || false,
  })) as WorkflowArticle[];

  // Filter by search if provided
  if (params.search) {
    const searchLower = params.search.toLowerCase();
    articles = articles.filter(
      (a) =>
        a.title.toLowerCase().includes(searchLower) ||
        a.content.toLowerCase().includes(searchLower)
    );
  }

  return articles;
}

/**
 * Get single article by ID with workflow data
 */
export async function getWorkflowArticleById(articleId: string): Promise<WorkflowArticle | null> {
  if (!isFirebaseConfigured() || !db) {
    return null;
  }

  const docRef = doc(db, COLLECTIONS.ARTICLES, articleId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data();

  // Get committee approval if exists
  const committeeApproval = await getArticleCommitteeApproval(articleId);

  return {
    id: docSnap.id,
    slug: data.slug,
    title: data.title,
    content: data.content,
    category: data.category,
    keywords: data.keywords || [],
    language: data.language,
    status: data.status as WorkflowStatus,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    publishedAt: data.publishedAt ? toDate(data.publishedAt) : undefined,
    createdBy: data.createdBy,
    updatedBy: data.updatedBy,
    lastReviewedBy: data.reviewedBy,
    lastReviewedAt: data.reviewedAt ? toDate(data.reviewedAt) : undefined,
    currentVersion: data.currentVersion || 1,
    versionId: data.versionId,
    isFeatured: data.isFeatured || false,
    isArchived: data.isArchived || false,
    committeeApprovals: committeeApproval || undefined,
  };
}

/**
 * Get workflow statistics
 */
export async function getWorkflowStatistics(): Promise<WorkflowStatistics> {
  if (!isFirebaseConfigured() || !db) {
    return {
      totalArticles: 0,
      byStatus: {} as Record<WorkflowStatus, number>,
      pendingReviewCount: 0,
      pendingApprovalCount: 0,
      averageReviewTime: 0,
      averageApprovalTime: 0,
      articlesPublishedThisWeek: 0,
      articlesPublishedThisMonth: 0,
    };
  }

  const articles = await getWorkflowArticles();

  const byStatus: Record<WorkflowStatus, number> = {
    draft: 0,
    pending_review: 0,
    in_review: 0,
    changes_requested: 0,
    pending_approval: 0,
    approved: 0,
    published: 0,
    archived: 0,
  };

  articles.forEach((a) => {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
  });

  // Calculate time-based stats
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const publishedThisWeek = articles.filter(
    (a) => a.publishedAt && new Date(a.publishedAt) >= oneWeekAgo
  ).length;

  const publishedThisMonth = articles.filter(
    (a) => a.publishedAt && new Date(a.publishedAt) >= oneMonthAgo
  ).length;

  return {
    totalArticles: articles.length,
    byStatus,
    pendingReviewCount: byStatus.pending_review + byStatus.in_review,
    pendingApprovalCount: byStatus.pending_approval,
    averageReviewTime: 0, // Would need historical data
    averageApprovalTime: 0,
    articlesPublishedThisWeek: publishedThisWeek,
    articlesPublishedThisMonth: publishedThisMonth,
  };
}

/**
 * Get article history (timeline)
 */
export async function getArticleHistory(articleId: string): Promise<ArticleHistory> {
  const [versions, workflowActions, comments] = await Promise.all([
    getArticleVersions(articleId),
    getWorkflowHistory(articleId),
    getArticleComments(articleId),
  ]);

  const entries: ArticleHistoryEntry[] = [];

  // Add version entries
  versions.forEach((v) => {
    entries.push({
      type: v.version === 1 ? "created" : "updated",
      description: v.version === 1 ? "Article created" : `Version ${v.version} created`,
      performedBy: v.createdBy,
      performedAt: v.createdAt,
      details: {
        version: v.version,
        changeDescription: v.changeDescription,
      },
    });
  });

  // Add workflow action entries
  workflowActions.forEach((a) => {
    const actionDescriptions: Record<WorkflowActionType, string> = {
      create: "Article created",
      submit_for_review: "Submitted for review",
      start_review: "Review started",
      approve_for_committee: "Approved for committee review",
      request_changes: "Changes requested",
      approve: "Approved",
      reject: "Rejected",
      publish: "Published",
      unpublish: "Unpublished",
      archive: "Archived",
      restore: "Restored",
    };

    entries.push({
      type: a.action === "publish" ? "published" : 
            a.action === "approve" ? "approved" :
            a.action === "request_changes" ? "reviewed" : "updated",
      description: actionDescriptions[a.action],
      performedBy: a.performedBy,
      performedAt: a.performedAt,
      details: {
        fromStatus: a.fromStatus,
        toStatus: a.toStatus,
        comment: a.comment,
      },
    });
  });

  // Add comment entries
  comments.forEach((c) => {
    entries.push({
      type: "commented",
      description: "Comment added",
      performedBy: c.createdBy,
      performedAt: c.createdAt,
      details: {
        content: c.content,
        resolved: c.resolved,
      },
    });
  });

  // Sort by date descending
  entries.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());

  return { articleId, entries };
}

// ============ DRAFT MANAGEMENT ============

/**
 * Save a draft
 */
export async function saveDraft(
  data: Omit<DraftArticle, "id" | "createdAt" | "updatedAt" | "lastSavedAt">,
  draftId?: string
): Promise<string> {
  if (!isFirebaseConfigured() || !db) {
    throw new Error("Firebase not configured");
  }

  const now = serverTimestamp();

  if (draftId) {
    const draftRef = doc(db, COLLECTIONS.DRAFTS, draftId);
    await updateDoc(draftRef, {
      ...data,
      updatedAt: now,
      lastSavedAt: now,
    });
    return draftId;
  } else {
    const draftRef = await addDoc(collection(db, COLLECTIONS.DRAFTS), {
      ...data,
      createdAt: now,
      updatedAt: now,
      lastSavedAt: now,
    });
    return draftRef.id;
  }
}

/**
 * Get drafts for a user
 */
export async function getUserDrafts(userId: string): Promise<DraftArticle[]> {
  if (!isFirebaseConfigured() || !db) {
    return [];
  }

  const q = query(
    collection(db, COLLECTIONS.DRAFTS),
    where("createdBy", "==", userId),
    orderBy("updatedAt", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    title: doc.data().title,
    content: doc.data().content,
    category: doc.data().category,
    keywords: doc.data().keywords || [],
    language: doc.data().language,
    createdAt: toDate(doc.data().createdAt),
    updatedAt: toDate(doc.data().updatedAt),
    createdBy: doc.data().createdBy,
    lastSavedAt: toDate(doc.data().lastSavedAt),
  }));
}

/**
 * Delete a draft
 */
export async function deleteDraft(draftId: string): Promise<void> {
  if (!isFirebaseConfigured() || !db) {
    throw new Error("Firebase not configured");
  }

  await deleteDoc(doc(db, COLLECTIONS.DRAFTS, draftId));
}
