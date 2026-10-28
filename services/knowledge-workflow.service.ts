// Knowledge Workflow Service
// Handles Draft → Review → Publish workflow, versioning, committee approval, and audit trail

import { createAdminClient } from "@/lib/supabase/admin";
import { ilikeContainsFilter } from "@/lib/supabase/filters";
import { resolveRowUuid, rowIdFilter } from "@/lib/supabase/identifier";
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
} from "@/types/knowledge-workflow";
import {
  KnowledgeCategory,
  KnowledgeLanguage,
} from "@/lib/ai/knowledge/types";

/**
 * The knowledge workflow pipeline (draft → review → committee → publish).
 *
 * Supabase-only. Seven tables back this module — `knowledge_workflow`,
 * `knowledge_versions`, `knowledge_workflow_actions`, `knowledge_review_comments`,
 * `knowledge_committee_approvals`, `knowledge_audit_log` and `knowledge_drafts` (see
 * `supabase/migrations/20261113000000_knowledge_workflow_tables.sql`). All seven are
 * deny-all under RLS, so every statement here uses the service-role client, which is
 * reachable only from the server behind the guarded `/api/knowledge/workflow/**` routes.
 * There is no Firestore path and no fallback: a failed write throws.
 */
const TABLES = {
  ARTICLES: "knowledge_workflow",
  VERSIONS: "knowledge_versions",
  WORKFLOW_ACTIONS: "knowledge_workflow_actions",
  REVIEW_COMMENTS: "knowledge_review_comments",
  COMMITTEE_APPROVALS: "knowledge_committee_approvals",
  AUDIT_LOG: "knowledge_audit_log",
  DRAFTS: "knowledge_drafts",
} as const;

/** Postgres returns timestamptz as a string; the public types are Date. */
function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  return new Date(value as string);
}

function toOptionalDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  return toDate(value);
}

function rowToArticle(row: any): WorkflowArticle {
  return {
    id: row.firestore_id || row.id,
    slug: row.slug,
    title: row.title,
    content: row.content ?? "",
    category: row.category as KnowledgeCategory,
    keywords: row.keywords ?? [],
    language: row.language as KnowledgeLanguage,
    status: row.status as WorkflowStatus,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    publishedAt: toOptionalDate(row.published_at),
    createdBy: row.created_by ?? "",
    updatedBy: row.updated_by ?? "",
    lastReviewedBy: row.reviewed_by || undefined,
    lastReviewedAt: toOptionalDate(row.reviewed_at),
    currentVersion: row.current_version ?? 1,
    versionId: row.version_id ?? "",
    isFeatured: row.is_featured ?? false,
    isArchived: row.is_archived ?? false,
  };
}

function rowToVersion(row: any): ArticleVersion {
  return {
    id: row.firestore_id || row.id,
    articleId: row.article_id,
    version: row.version,
    title: row.title,
    content: row.content ?? "",
    keywords: row.keywords ?? [],
    category: row.category as KnowledgeCategory,
    language: row.language as KnowledgeLanguage,
    createdAt: toDate(row.created_at),
    createdBy: row.created_by ?? "",
    changeDescription: row.change_description ?? "",
  };
}

// ============ VERSION MANAGEMENT ============

/** Create a new version of an article. */
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
  const supabase = createAdminClient();
  const articleUuid = await resolveRowUuid(supabase, TABLES.ARTICLES, articleId);
  if (!articleUuid) throw new Error("Article not found");

  const { data: latest, error: latestError } = await supabase
    .from(TABLES.VERSIONS)
    .select("version")
    .eq("article_id", articleUuid)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error(`Could not read article versions: ${latestError.message}`);
  const nextVersion = (latest?.version ?? 0) + 1;

  const previousUuid = data.previousVersionId
    ? await resolveRowUuid(supabase, TABLES.VERSIONS, data.previousVersionId)
    : null;

  const { data: row, error } = await supabase
    .from(TABLES.VERSIONS)
    .insert({
      article_id: articleUuid,
      version: nextVersion,
      title: data.title,
      content: data.content,
      keywords: data.keywords ?? [],
      category: data.category,
      language: data.language,
      created_by: data.createdBy,
      change_description: data.changeDescription,
      previous_version_id: previousUuid,
    })
    .select("firestore_id, id")
    .single();
  if (error) throw new Error(`Could not create version: ${error.message}`);

  const versionId = row.firestore_id || row.id;
  await createAuditEntry({
    entityType: "version",
    entityId: versionId,
    action: "create_version",
    performedBy: data.createdBy,
    newState: { version: nextVersion, articleId },
  });
  return versionId;
}

/** Get all versions of an article, newest first. */
export async function getArticleVersions(articleId: string): Promise<ArticleVersion[]> {
  const supabase = createAdminClient();
  const articleUuid = await resolveRowUuid(supabase, TABLES.ARTICLES, articleId);
  if (!articleUuid) return [];

  const { data, error } = await supabase
    .from(TABLES.VERSIONS)
    .select("*")
    .eq("article_id", articleUuid)
    .order("version", { ascending: false });
  if (error) throw new Error(`Could not read article versions: ${error.message}`);
  return (data ?? []).map(rowToVersion);
}

/** Get a specific version by ID. */
export async function getVersionById(versionId: string): Promise<ArticleVersion | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLES.VERSIONS)
    .select("*")
    .or(rowIdFilter(versionId))
    .maybeSingle();
  if (error) throw new Error(`Could not read version: ${error.message}`);
  return data ? rowToVersion(data) : null;
}

/** Restore an article to a specific version. */
export async function restoreToVersion(
  articleId: string,
  versionId: string,
  performedBy: string
): Promise<void> {
  const version = await getVersionById(versionId);
  if (!version) throw new Error("Version not found");

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

/** Perform a workflow action on an article and record the transition. */
export async function performWorkflowAction(
  articleId: string,
  action: WorkflowActionType,
  performedBy: string,
  comment?: string
): Promise<WorkflowAction> {
  const supabase = createAdminClient();
  const article = await getWorkflowArticleById(articleId);
  if (!article) throw new Error("Article not found");

  const articleUuid = await resolveRowUuid(supabase, TABLES.ARTICLES, articleId);
  if (!articleUuid) throw new Error("Article not found");

  const fromStatus = article.status;
  const toStatus = getNextStatus(fromStatus, action);

  const { data: actionRow, error: actionError } = await supabase
    .from(TABLES.WORKFLOW_ACTIONS)
    .insert({
      article_id: articleUuid,
      action,
      from_status: fromStatus,
      to_status: toStatus,
      performed_by: performedBy,
      comment: comment ?? null,
    })
    .select("firestore_id, id")
    .single();
  if (actionError) throw new Error(`Could not record workflow action: ${actionError.message}`);

  const update: Record<string, unknown> = {
    status: toStatus,
    updated_at: new Date().toISOString(),
    updated_by: performedBy,
  };

  switch (action) {
    case "submit_for_review":
      update.submitted_at = new Date().toISOString();
      update.submitted_by = performedBy;
      break;
    case "approve_for_committee":
      update.reviewed_at = new Date().toISOString();
      update.reviewed_by = performedBy;
      await createCommitteeApproval(articleId);
      break;
    case "publish":
      update.published_at = new Date().toISOString();
      update.published_by = performedBy;
      break;
    case "archive":
      update.archived_at = new Date().toISOString();
      update.archived_by = performedBy;
      update.is_archived = true;
      break;
  }

  const { error: updateError } = await supabase
    .from(TABLES.ARTICLES)
    .update(update)
    .eq("id", articleUuid);
  if (updateError) throw new Error(`Could not update article status: ${updateError.message}`);

  await createAuditEntry({
    entityType: "workflow",
    entityId: actionRow.firestore_id || actionRow.id,
    action,
    performedBy,
    previousState: { status: fromStatus },
    newState: { status: toStatus },
    metadata: { articleId },
  });

  return {
    id: actionRow.firestore_id || actionRow.id,
    articleId,
    action,
    fromStatus,
    toStatus,
    performedBy,
    performedAt: new Date(),
    comment,
  };
}

/** The state machine for the review pipeline. */
function getNextStatus(current: WorkflowStatus, action: WorkflowActionType): WorkflowStatus {
  const transitions: Record<WorkflowStatus, Partial<Record<WorkflowActionType, WorkflowStatus>>> = {
    draft: { submit_for_review: "pending_review" },
    pending_review: { start_review: "in_review", reject: "draft" },
    in_review: {
      approve_for_committee: "pending_approval",
      request_changes: "changes_requested",
      reject: "draft",
    },
    changes_requested: { submit_for_review: "pending_review" },
    pending_approval: { approve: "approved", reject: "draft" },
    approved: { publish: "published" },
    published: { unpublish: "approved", archive: "archived" },
    archived: { restore: "draft" },
  };

  return transitions[current]?.[action] || current;
}

/** Get the status-transition history for an article. */
export async function getWorkflowHistory(articleId: string): Promise<WorkflowAction[]> {
  const supabase = createAdminClient();
  const articleUuid = await resolveRowUuid(supabase, TABLES.ARTICLES, articleId);
  if (!articleUuid) return [];

  const { data, error } = await supabase
    .from(TABLES.WORKFLOW_ACTIONS)
    .select("*")
    .eq("article_id", articleUuid)
    .order("performed_at", { ascending: false });
  if (error) throw new Error(`Could not read workflow history: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.firestore_id || row.id,
    articleId,
    action: row.action as WorkflowActionType,
    fromStatus: row.from_status as WorkflowStatus,
    toStatus: row.to_status as WorkflowStatus,
    performedBy: row.performed_by ?? "",
    performedAt: toDate(row.performed_at),
    comment: row.comment ?? undefined,
  }));
}

// ============ REVIEW COMMENTS ============

/** Add a review comment to an article. */
export async function addReviewComment(
  articleId: string,
  content: string,
  createdBy: string,
  versionId?: string
): Promise<string> {
  const supabase = createAdminClient();
  const articleUuid = await resolveRowUuid(supabase, TABLES.ARTICLES, articleId);
  if (!articleUuid) throw new Error("Article not found");
  const versionUuid = versionId
    ? await resolveRowUuid(supabase, TABLES.VERSIONS, versionId)
    : null;

  const { data: row, error } = await supabase
    .from(TABLES.REVIEW_COMMENTS)
    .insert({
      article_id: articleUuid,
      version_id: versionUuid,
      content,
      created_by: createdBy,
    })
    .select("firestore_id, id")
    .single();
  if (error) throw new Error(`Could not add comment: ${error.message}`);

  const commentId = row.firestore_id || row.id;
  await createAuditEntry({
    entityType: "comment",
    entityId: commentId,
    action: "add_comment",
    performedBy: createdBy,
    newState: { articleId, content },
  });
  return commentId;
}

/** Get the review comments on an article, oldest first. */
export async function getArticleComments(articleId: string): Promise<ReviewComment[]> {
  const supabase = createAdminClient();
  const articleUuid = await resolveRowUuid(supabase, TABLES.ARTICLES, articleId);
  if (!articleUuid) return [];

  const { data, error } = await supabase
    .from(TABLES.REVIEW_COMMENTS)
    .select("*")
    .eq("article_id", articleUuid)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not read comments: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.firestore_id || row.id,
    articleId,
    versionId: row.version_id ?? undefined,
    content: row.content,
    createdBy: row.created_by ?? "",
    createdAt: toDate(row.created_at),
    resolved: row.resolved ?? false,
    resolvedBy: row.resolved_by || undefined,
    resolvedAt: toOptionalDate(row.resolved_at),
  }));
}

/** Mark a review comment resolved. */
export async function resolveComment(commentId: string, resolvedBy: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from(TABLES.REVIEW_COMMENTS)
    .update({ resolved: true, resolved_by: resolvedBy, resolved_at: new Date().toISOString() })
    .or(rowIdFilter(commentId));
  if (error) throw new Error(`Could not resolve comment: ${error.message}`);
}

// ============ COMMITTEE APPROVALS ============

/** Open a committee approval round for an article. */
export async function createCommitteeApproval(
  articleId: string,
  requiredApprovals: number = 2
): Promise<string> {
  const supabase = createAdminClient();
  const articleUuid = await resolveRowUuid(supabase, TABLES.ARTICLES, articleId);
  if (!articleUuid) throw new Error("Article not found");

  const { data: row, error } = await supabase
    .from(TABLES.COMMITTEE_APPROVALS)
    .insert({
      article_id: articleUuid,
      required_approvals: requiredApprovals,
      current_approvals: 0,
      approvals: [],
      status: "pending",
    })
    .select("firestore_id, id")
    .single();
  if (error) throw new Error(`Could not create committee approval: ${error.message}`);

  const approvalId = row.firestore_id || row.id;
  await createAuditEntry({
    entityType: "approval",
    entityId: approvalId,
    action: "create_committee_approval",
    newState: { articleId, requiredApprovals },
  });
  return approvalId;
}

/** Record one committee member's vote and settle the round when it is decided. */
export async function submitCommitteeVote(
  approvalId: string,
  memberId: string,
  memberName: string,
  decision: "approve" | "reject" | "abstain",
  comment?: string
): Promise<void> {
  const supabase = createAdminClient();
  const { data: approvalRow, error: readError } = await supabase
    .from(TABLES.COMMITTEE_APPROVALS)
    .select("*")
    .or(rowIdFilter(approvalId))
    .maybeSingle();
  if (readError) throw new Error(`Could not read approval: ${readError.message}`);
  if (!approvalRow) throw new Error("Approval not found");

  const existing: CommitteeMemberApproval[] = approvalRow.approvals ?? [];
  const updatedApprovals = [...existing];
  const vote: CommitteeMemberApproval = { memberId, memberName, decision, comment, votedAt: new Date() };
  const index = updatedApprovals.findIndex((a) => a.memberId === memberId);
  if (index >= 0) updatedApprovals[index] = vote;
  else updatedApprovals.push(vote);

  const approvalCount = updatedApprovals.filter((a) => a.decision === "approve").length;
  const rejectionCount = updatedApprovals.filter((a) => a.decision === "reject").length;

  let status: "pending" | "approved" | "rejected" = "pending";
  if (rejectionCount >= approvalRow.required_approvals - rejectionCount + 1) {
    status = "rejected";
  } else if (approvalCount >= approvalRow.required_approvals) {
    status = "approved";
  }

  const { error: updateError } = await supabase
    .from(TABLES.COMMITTEE_APPROVALS)
    .update({
      approvals: updatedApprovals,
      current_approvals: approvalCount,
      status,
      completed_at: status !== "pending" ? new Date().toISOString() : null,
    })
    .eq("id", approvalRow.id);
  if (updateError) throw new Error(`Could not record committee vote: ${updateError.message}`);

  if (status === "approved") {
    const { error: articleError } = await supabase
      .from(TABLES.ARTICLES)
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", approvalRow.article_id);
    if (articleError) throw new Error(`Could not approve article: ${articleError.message}`);
  }

  await createAuditEntry({
    entityType: "approval",
    entityId: approvalId,
    action: `committee_${decision}`,
    performedBy: memberId,
    newState: { memberId, decision },
  });
}

/** Get the latest committee approval round for an article. */
export async function getArticleCommitteeApproval(
  articleId: string
): Promise<CommitteeApproval | null> {
  const supabase = createAdminClient();
  const articleUuid = await resolveRowUuid(supabase, TABLES.ARTICLES, articleId);
  if (!articleUuid) return null;

  const { data, error } = await supabase
    .from(TABLES.COMMITTEE_APPROVALS)
    .select("*")
    .eq("article_id", articleUuid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not read committee approval: ${error.message}`);
  if (!data) return null;

  return {
    id: data.firestore_id || data.id,
    articleId,
    requiredApprovals: data.required_approvals,
    currentApprovals: data.current_approvals,
    approvals: data.approvals ?? [],
    status: data.status,
    deadline: toOptionalDate(data.deadline),
    createdAt: toDate(data.created_at),
    completedAt: toOptionalDate(data.completed_at),
  };
}

// ============ AUDIT LOG ============

/**
 * Append an audit entry. Failures are logged, never thrown: an audit write must not
 * roll back the operation it is recording.
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
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLES.AUDIT_LOG).insert({
      entity_type: data.entityType,
      entity_id: data.entityId,
      action: data.action,
      performed_by: data.performedBy ?? "",
      previous_state: data.previousState ?? null,
      new_state: data.newState ?? null,
      metadata: data.metadata ?? null,
    });
    if (error) throw error;
  } catch (error) {
    console.error("[Audit Log] Failed to create entry:", error);
  }
}

/** Get the audit log for one entity, newest first. */
export async function getAuditLog(
  entityType: AuditLogEntry["entityType"],
  entityId: string
): Promise<AuditLogEntry[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLES.AUDIT_LOG)
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("performed_at", { ascending: false });
  if (error) throw new Error(`Could not read audit log: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.firestore_id || row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    performedBy: row.performed_by ?? "",
    performedAt: toDate(row.performed_at),
    previousState: row.previous_state ?? undefined,
    newState: row.new_state ?? undefined,
    metadata: row.metadata ?? undefined,
  }));
}

// ============ ARTICLE CRUD WITH WORKFLOW ============

/** Create an article as a draft, with its first version. */
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
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from(TABLES.ARTICLES)
    .insert({
      slug: data.slug,
      title: data.title,
      content: data.content,
      category: data.category,
      keywords: data.keywords ?? [],
      language: data.language,
      status: "draft",
      created_by: createdBy,
      updated_by: createdBy,
      current_version: 1,
      is_featured: false,
      is_archived: false,
    })
    .select("firestore_id, id")
    .single();
  if (error) throw new Error(`Could not create article: ${error.message}`);

  const articleId = row.firestore_id || row.id;

  const versionId = await createVersion(articleId, {
    ...data,
    createdBy,
    changeDescription: "Initial creation",
  });

  const articleUuid = await resolveRowUuid(supabase, TABLES.ARTICLES, articleId);
  const versionUuid = await resolveRowUuid(supabase, TABLES.VERSIONS, versionId);
  if (articleUuid) {
    const { error: linkError } = await supabase
      .from(TABLES.ARTICLES)
      .update({ version_id: versionUuid, updated_at: new Date().toISOString() })
      .eq("id", articleUuid);
    if (linkError) throw new Error(`Could not link initial version: ${linkError.message}`);
  }

  await createAuditEntry({
    entityType: "article",
    entityId: articleId,
    action: "create",
    performedBy: createdBy,
    newState: { ...data, status: "draft" },
  });

  return articleId;
}

/** Update an article; a title or content change creates a new version. */
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
  const supabase = createAdminClient();
  const article = await getWorkflowArticleById(articleId);
  if (!article) throw new Error("Article not found");
  const articleUuid = await resolveRowUuid(supabase, TABLES.ARTICLES, articleId);
  if (!articleUuid) throw new Error("Article not found");

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };
  if (data.slug !== undefined) update.slug = data.slug;
  if (data.category !== undefined) update.category = data.category;
  if (data.language !== undefined) update.language = data.language;
  if (data.keywords !== undefined) update.keywords = data.keywords;
  if (data.isFeatured !== undefined) update.is_featured = data.isFeatured;

  if (data.content !== undefined || data.title !== undefined) {
    const versionId = await createVersion(articleId, {
      title: data.title ?? article.title,
      content: data.content ?? article.content,
      keywords: data.keywords ?? article.keywords,
      category: data.category ?? article.category,
      language: data.language ?? article.language,
      createdBy: updatedBy,
      changeDescription,
      previousVersionId: article.versionId || undefined,
    });
    update.title = data.title ?? article.title;
    update.content = data.content ?? article.content;
    update.current_version = (article.currentVersion || 1) + 1;
    update.version_id = await resolveRowUuid(supabase, TABLES.VERSIONS, versionId);
  } else if (data.title !== undefined) {
    update.title = data.title;
  }

  const { error } = await supabase.from(TABLES.ARTICLES).update(update).eq("id", articleUuid);
  if (error) throw new Error(`Could not update article: ${error.message}`);

  await createAuditEntry({
    entityType: "article",
    entityId: articleId,
    action: "update",
    performedBy: updatedBy,
    previousState: {
      title: article.title,
      status: article.status,
      currentVersion: article.currentVersion,
    },
    newState: data,
  });
}

/** List articles, newest first, filtered by the given workflow parameters. */
export async function getWorkflowArticles(
  params: WorkflowQueryParams = {}
): Promise<WorkflowArticle[]> {
  const supabase = createAdminClient();
  let builder = supabase.from(TABLES.ARTICLES).select("*");

  if (params.status && params.status.length > 0) builder = builder.in("status", params.status);
  if (params.category && params.category.length > 0) builder = builder.in("category", params.category);
  if (params.language && params.language.length > 0) builder = builder.in("language", params.language);
  if (params.createdBy) builder = builder.eq("created_by", params.createdBy);
  if (params.reviewedBy) builder = builder.eq("reviewed_by", params.reviewedBy);
  if (params.startDate) builder = builder.gte("updated_at", params.startDate.toISOString());
  if (params.endDate) builder = builder.lte("updated_at", params.endDate.toISOString());
  if (params.search) {
    // The term is quoted and escaped for the PostgREST filter expression, so a typed
    // `,` `.` `(` or `%` cannot break the expression or widen the match.
    builder = builder.or(
      [ilikeContainsFilter("title", params.search), ilikeContainsFilter("content", params.search)].join(",")
    );
  }

  const { data, error } = await builder.order("updated_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Could not read articles: ${error.message}`);
  return (data ?? []).map(rowToArticle);
}

/** Get one article with its latest committee approval. */
export async function getWorkflowArticleById(articleId: string): Promise<WorkflowArticle | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLES.ARTICLES)
    .select("*")
    .or(rowIdFilter(articleId))
    .maybeSingle();
  if (error) throw new Error(`Could not read article: ${error.message}`);
  if (!data) return null;

  const article = rowToArticle(data);
  const committeeApproval = await getArticleCommitteeApproval(article.id);
  return { ...article, committeeApprovals: committeeApproval ?? undefined };
}

/** Aggregate counts for the workflow dashboard. */
export async function getWorkflowStatistics(): Promise<WorkflowStatistics> {
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
    averageReviewTime: 0,
    averageApprovalTime: 0,
    articlesPublishedThisWeek: publishedThisWeek,
    articlesPublishedThisMonth: publishedThisMonth,
  };
}

/** Merge versions, transitions and comments into one timeline. */
export async function getArticleHistory(articleId: string): Promise<ArticleHistory> {
  const [versions, workflowActions, comments] = await Promise.all([
    getArticleVersions(articleId),
    getWorkflowHistory(articleId),
    getArticleComments(articleId),
  ]);

  const entries: ArticleHistoryEntry[] = [];

  versions.forEach((v) => {
    entries.push({
      type: v.version === 1 ? "created" : "updated",
      description: v.version === 1 ? "Article created" : `Version ${v.version} created`,
      performedBy: v.createdBy,
      performedAt: v.createdAt,
      details: { version: v.version, changeDescription: v.changeDescription },
    });
  });

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

  workflowActions.forEach((a) => {
    entries.push({
      type:
        a.action === "publish"
          ? "published"
          : a.action === "approve"
            ? "approved"
            : a.action === "request_changes"
              ? "reviewed"
              : "updated",
      description: actionDescriptions[a.action],
      performedBy: a.performedBy,
      performedAt: a.performedAt,
      details: { fromStatus: a.fromStatus, toStatus: a.toStatus, comment: a.comment },
    });
  });

  comments.forEach((c) => {
    entries.push({
      type: "commented",
      description: "Comment added",
      performedBy: c.createdBy,
      performedAt: c.createdAt,
      details: { content: c.content, resolved: c.resolved },
    });
  });

  entries.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
  return { articleId, entries };
}

// ============ DRAFT MANAGEMENT ============

/** Create or update a draft. */
export async function saveDraft(
  data: Omit<DraftArticle, "id" | "createdAt" | "updatedAt" | "lastSavedAt">,
  draftId?: string
): Promise<string> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  if (draftId) {
    const { data: rows, error } = await supabase
      .from(TABLES.DRAFTS)
      .update({
        title: data.title,
        content: data.content,
        category: data.category,
        keywords: data.keywords ?? [],
        language: data.language,
        updated_at: now,
        last_saved_at: now,
      })
      .or(rowIdFilter(draftId))
      .select("firestore_id, id");
    if (error) throw new Error(`Could not save draft: ${error.message}`);
    const row = rows?.[0];
    if (!row) throw new Error("Draft not found");
    return row.firestore_id || row.id;
  }

  const { data: row, error } = await supabase
    .from(TABLES.DRAFTS)
    .insert({
      title: data.title,
      content: data.content,
      category: data.category,
      keywords: data.keywords ?? [],
      language: data.language,
      created_by: data.createdBy,
    })
    .select("firestore_id, id")
    .single();
  if (error) throw new Error(`Could not save draft: ${error.message}`);
  return row.firestore_id || row.id;
}

/** List a contributor's drafts, most recently saved first. */
export async function getUserDrafts(userId: string): Promise<DraftArticle[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLES.DRAFTS)
    .select("*")
    .eq("created_by", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Could not read drafts: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.firestore_id || row.id,
    title: row.title ?? "",
    content: row.content ?? "",
    category: row.category as KnowledgeCategory,
    keywords: row.keywords ?? [],
    language: row.language as KnowledgeLanguage,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    createdBy: row.created_by ?? "",
    lastSavedAt: toDate(row.last_saved_at),
  }));
}

/** Delete a draft. */
export async function deleteDraft(draftId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from(TABLES.DRAFTS).delete().or(rowIdFilter(draftId));
  if (error) throw new Error(`Could not delete draft: ${error.message}`);
}
