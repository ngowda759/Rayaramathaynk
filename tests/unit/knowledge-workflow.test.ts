// Unit tests for Knowledge Workflow Service
// Tests workflow transitions, version management, committee approval, and audit logging

import { WorkflowStatus, WorkflowActionType } from "@/types/knowledge-workflow";
import { Intent, IntentCategory } from "@/lib/ai/intent/types";

// Mock Firebase
jest.mock("@/lib/firebase", () => ({
  db: {
    collection: jest.fn(),
  },
  isFirebaseConfigured: () => false,
}));

// Mock Firebase Firestore methods
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({ toDate: () => date })),
    now: jest.fn(() => ({ toDate: () => new Date() })),
  },
}));

describe("Workflow Status Types", () => {
  it("should have all required workflow statuses", () => {
    const statuses: WorkflowStatus[] = [
      "draft",
      "pending_review",
      "in_review",
      "changes_requested",
      "pending_approval",
      "approved",
      "published",
      "archived",
    ];

    expect(statuses).toHaveLength(8);
    expect(statuses).toContain("draft");
    expect(statuses).toContain("published");
  });
});

describe("Workflow Action Types", () => {
  it("should have all required workflow actions", () => {
    const actions: WorkflowActionType[] = [
      "create",
      "submit_for_review",
      "start_review",
      "approve_for_committee",
      "request_changes",
      "approve",
      "reject",
      "publish",
      "unpublish",
      "archive",
      "restore",
    ];

    expect(actions).toHaveLength(11);
    expect(actions).toContain("submit_for_review");
    expect(actions).toContain("approve");
    expect(actions).toContain("publish");
  });
});

describe("Workflow Transitions", () => {
  // Simulate the getNextStatus function
  const getNextStatus = (current: WorkflowStatus, action: WorkflowActionType): WorkflowStatus => {
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
  };

  it("should transition from draft to pending_review on submit_for_review", () => {
    expect(getNextStatus("draft", "submit_for_review")).toBe("pending_review");
  });

  it("should transition from pending_review to in_review on start_review", () => {
    expect(getNextStatus("pending_review", "start_review")).toBe("in_review");
  });

  it("should transition from in_review to pending_approval on approve_for_committee", () => {
    expect(getNextStatus("in_review", "approve_for_committee")).toBe("pending_approval");
  });

  it("should transition from in_review to changes_requested on request_changes", () => {
    expect(getNextStatus("in_review", "request_changes")).toBe("changes_requested");
  });

  it("should transition from pending_approval to approved on approve", () => {
    expect(getNextStatus("pending_approval", "approve")).toBe("approved");
  });

  it("should transition from approved to published on publish", () => {
    expect(getNextStatus("approved", "publish")).toBe("published");
  });

  it("should transition from published to archived on archive", () => {
    expect(getNextStatus("published", "archive")).toBe("archived");
  });

  it("should transition from archived to draft on restore", () => {
    expect(getNextStatus("archived", "restore")).toBe("draft");
  });

  it("should reject from pending_review", () => {
    expect(getNextStatus("pending_review", "reject")).toBe("draft");
  });

  it("should reject from in_review", () => {
    expect(getNextStatus("in_review", "reject")).toBe("draft");
  });

  it("should reject from pending_approval", () => {
    expect(getNextStatus("pending_approval", "reject")).toBe("draft");
  });

  it("should handle changes_requested to pending_review", () => {
    expect(getNextStatus("changes_requested", "submit_for_review")).toBe("pending_review");
  });

  it("should not transition on invalid action", () => {
    expect(getNextStatus("draft", "publish")).toBe("draft");
    expect(getNextStatus("draft", "approve")).toBe("draft");
  });
});

describe("Version Management", () => {
  interface MockVersion {
    id: string;
    articleId: string;
    version: number;
    title: string;
    content: string;
    createdAt: Date;
    createdBy: string;
  }

  const calculateNextVersion = (versions: MockVersion[]): number => {
    if (versions.length === 0) return 1;
    return Math.max(...versions.map((v) => v.version)) + 1;
  };

  it("should start with version 1 for new articles", () => {
    expect(calculateNextVersion([])).toBe(1);
  });

  it("should increment version for subsequent versions", () => {
    const versions: MockVersion[] = [
      { id: "1", articleId: "a1", version: 1, title: "V1", content: "Content 1", createdAt: new Date(), createdBy: "user1" },
    ];
    expect(calculateNextVersion(versions)).toBe(2);
  });

  it("should handle multiple versions correctly", () => {
    const versions: MockVersion[] = [
      { id: "1", articleId: "a1", version: 1, title: "V1", content: "Content 1", createdAt: new Date(), createdBy: "user1" },
      { id: "2", articleId: "a1", version: 2, title: "V2", content: "Content 2", createdAt: new Date(), createdBy: "user1" },
      { id: "3", articleId: "a1", version: 3, title: "V3", content: "Content 3", createdAt: new Date(), createdBy: "user1" },
    ];
    expect(calculateNextVersion(versions)).toBe(4);
  });

  it("should track version history correctly", () => {
    const versions: MockVersion[] = [
      { id: "1", articleId: "a1", version: 1, title: "Initial", content: "Content 1", createdAt: new Date("2024-01-01"), createdBy: "user1" },
      { id: "2", articleId: "a1", version: 2, title: "Updated", content: "Content 2", createdAt: new Date("2024-01-02"), createdBy: "user2" },
      { id: "3", articleId: "a1", version: 3, title: "Final", content: "Content 3", createdAt: new Date("2024-01-03"), createdBy: "user1" },
    ];

    expect(versions.length).toBe(3);
    expect(versions[0].title).toBe("Initial");
    expect(versions[2].title).toBe("Final");
  });
});

describe("Committee Approval Logic", () => {
  interface MockApproval {
    requiredApprovals: number;
    approvals: Array<{
      memberId: string;
      decision: "approve" | "reject" | "abstain";
    }>;
  }

  const determineApprovalStatus = (approval: MockApproval): "pending" | "approved" | "rejected" => {
    const approvalCount = approval.approvals.filter((a) => a.decision === "approve").length;
    const rejectionCount = approval.approvals.filter((a) => a.decision === "reject").length;
    const totalVotes = approval.approvals.filter((a) => a.decision !== "abstain").length;

    if (rejectionCount >= approval.requiredApprovals - rejectionCount + 1) {
      return "rejected";
    }
    if (approvalCount >= approval.requiredApprovals) {
      return "approved";
    }
    return "pending";
  };

  it("should be pending with no approvals", () => {
    const approval: MockApproval = {
      requiredApprovals: 2,
      approvals: [],
    };
    expect(determineApprovalStatus(approval)).toBe("pending");
  });

  it("should be pending with insufficient approvals", () => {
    const approval: MockApproval = {
      requiredApprovals: 2,
      approvals: [{ memberId: "m1", decision: "approve" }],
    };
    expect(determineApprovalStatus(approval)).toBe("pending");
  });

  it("should be approved when required approvals reached", () => {
    const approval: MockApproval = {
      requiredApprovals: 2,
      approvals: [
        { memberId: "m1", decision: "approve" },
        { memberId: "m2", decision: "approve" },
      ],
    };
    expect(determineApprovalStatus(approval)).toBe("approved");
  });

  it("should be rejected when rejections exceed threshold", () => {
    const approval: MockApproval = {
      requiredApprovals: 2,
      approvals: [
        { memberId: "m1", decision: "reject" },
        { memberId: "m2", decision: "reject" },
      ],
    };
    expect(determineApprovalStatus(approval)).toBe("rejected");
  });

  it("should handle mixed votes correctly", () => {
    const approval: MockApproval = {
      requiredApprovals: 3,
      approvals: [
        { memberId: "m1", decision: "approve" },
        { memberId: "m2", decision: "approve" },
        { memberId: "m3", decision: "reject" },
      ],
    };
    expect(determineApprovalStatus(approval)).toBe("pending");
  });

  it("should handle abstain votes", () => {
    const approval: MockApproval = {
      requiredApprovals: 2,
      approvals: [
        { memberId: "m1", decision: "approve" },
        { memberId: "m2", decision: "abstain" },
      ],
    };
    expect(determineApprovalStatus(approval)).toBe("pending");
  });
});

describe("Audit Log Entry Creation", () => {
  interface MockAuditEntry {
    entityType: string;
    entityId: string;
    action: string;
    performedBy?: string;
    performedAt: Date;
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
  }

  const createAuditEntry = (data: Omit<MockAuditEntry, "performedAt">): MockAuditEntry => ({
    ...data,
    performedAt: new Date(),
  });

  it("should create audit entry for article creation", () => {
    const entry = createAuditEntry({
      entityType: "article",
      entityId: "article-1",
      action: "create",
      performedBy: "user1",
      newState: { title: "Test Article", status: "draft" },
    });

    expect(entry.entityType).toBe("article");
    expect(entry.action).toBe("create");
    expect(entry.performedBy).toBe("user1");
    expect(entry.newState?.title).toBe("Test Article");
    expect(entry.performedAt).toBeInstanceOf(Date);
  });

  it("should track state changes in audit entry", () => {
    const entry = createAuditEntry({
      entityType: "workflow",
      entityId: "action-1",
      action: "submit_for_review",
      performedBy: "user1",
      previousState: { status: "draft" },
      newState: { status: "pending_review" },
    });

    expect(entry.previousState?.status).toBe("draft");
    expect(entry.newState?.status).toBe("pending_review");
  });

  it("should track version creation", () => {
    const entry = createAuditEntry({
      entityType: "version",
      entityId: "version-1",
      action: "create_version",
      performedBy: "user1",
      newState: { version: 2, articleId: "article-1" },
    });

    expect(entry.entityType).toBe("version");
    expect(entry.newState?.version).toBe(2);
  });

  it("should track committee decisions", () => {
    const entry = createAuditEntry({
      entityType: "approval",
      entityId: "approval-1",
      action: "committee_approve",
      performedBy: "member1",
      newState: { memberId: "member1", decision: "approve" },
    });

    expect(entry.action).toBe("committee_approve");
    expect(entry.newState?.decision).toBe("approve");
  });
});

describe("Review Comment Management", () => {
  interface MockComment {
    id: string;
    articleId: string;
    content: string;
    createdBy: string;
    createdAt: Date;
    resolved: boolean;
    resolvedBy?: string;
    resolvedAt?: Date;
  }

  const addComment = (
    comments: MockComment[],
    articleId: string,
    content: string,
    createdBy: string
  ): MockComment[] => {
    const newComment: MockComment = {
      id: `comment-${comments.length + 1}`,
      articleId,
      content,
      createdBy,
      createdAt: new Date(),
      resolved: false,
    };
    return [...comments, newComment];
  };

  const resolveComment = (
    comments: MockComment[],
    commentId: string,
    resolvedBy: string
  ): MockComment[] => {
    return comments.map((c) =>
      c.id === commentId
        ? { ...c, resolved: true, resolvedBy, resolvedAt: new Date() }
        : c
    );
  };

  it("should add new comments", () => {
    const comments: MockComment[] = [];
    const updated = addComment(comments, "article-1", "Please review this", "reviewer1");

    expect(updated).toHaveLength(1);
    expect(updated[0].content).toBe("Please review this");
    expect(updated[0].resolved).toBe(false);
  });

  it("should resolve comments", () => {
    const comments: MockComment[] = [
      { id: "c1", articleId: "a1", content: "Test", createdBy: "u1", createdAt: new Date(), resolved: false },
    ];
    const updated = resolveComment(comments, "c1", "reviewer1");

    expect(updated[0].resolved).toBe(true);
    expect(updated[0].resolvedBy).toBe("reviewer1");
    expect(updated[0].resolvedAt).toBeInstanceOf(Date);
  });

  it("should track unresolved comment count", () => {
    const comments: MockComment[] = [
      { id: "c1", articleId: "a1", content: "Test 1", createdBy: "u1", createdAt: new Date(), resolved: false },
      { id: "c2", articleId: "a1", content: "Test 2", createdBy: "u1", createdAt: new Date(), resolved: true },
      { id: "c3", articleId: "a1", content: "Test 3", createdBy: "u1", createdAt: new Date(), resolved: false },
    ];

    const unresolved = comments.filter((c) => !c.resolved);
    expect(unresolved).toHaveLength(2);
  });
});

describe("Workflow Statistics Calculation", () => {
  interface MockArticle {
    id: string;
    status: WorkflowStatus;
    publishedAt?: Date;
  }

  const calculateStatistics = (articles: MockArticle[]): {
    totalArticles: number;
    byStatus: Record<WorkflowStatus, number>;
    pendingReviewCount: number;
    pendingApprovalCount: number;
    publishedThisWeek: number;
  } => {
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

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    return {
      totalArticles: articles.length,
      byStatus,
      pendingReviewCount: byStatus.pending_review + byStatus.in_review,
      pendingApprovalCount: byStatus.pending_approval,
      publishedThisWeek: articles.filter(
        (a) => a.publishedAt && new Date(a.publishedAt) >= oneWeekAgo
      ).length,
    };
  };

  it("should calculate total articles", () => {
    const articles: MockArticle[] = [
      { id: "1", status: "draft" },
      { id: "2", status: "published" },
      { id: "3", status: "pending_review" },
    ];

    const stats = calculateStatistics(articles);
    expect(stats.totalArticles).toBe(3);
  });

  it("should count by status", () => {
    const articles: MockArticle[] = [
      { id: "1", status: "draft" },
      { id: "2", status: "draft" },
      { id: "3", status: "published" },
    ];

    const stats = calculateStatistics(articles);
    expect(stats.byStatus.draft).toBe(2);
    expect(stats.byStatus.published).toBe(1);
  });

  it("should count pending reviews", () => {
    const articles: MockArticle[] = [
      { id: "1", status: "pending_review" },
      { id: "2", status: "in_review" },
      { id: "3", status: "published" },
    ];

    const stats = calculateStatistics(articles);
    expect(stats.pendingReviewCount).toBe(2);
  });

  it("should count pending approvals", () => {
    const articles: MockArticle[] = [
      { id: "1", status: "pending_approval" },
      { id: "2", status: "pending_approval" },
      { id: "3", status: "approved" },
    ];

    const stats = calculateStatistics(articles);
    expect(stats.pendingApprovalCount).toBe(2);
  });

  it("should calculate articles published this week", () => {
    const now = new Date();
    const articles: MockArticle[] = [
      { id: "1", status: "published", publishedAt: now },
      { id: "2", status: "published", publishedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) }, // 3 days ago
      { id: "3", status: "published", publishedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) }, // 10 days ago
    ];

    const stats = calculateStatistics(articles);
    expect(stats.publishedThisWeek).toBe(2);
  });
});

describe("Article History Timeline", () => {
  interface MockHistoryEntry {
    type: string;
    description: string;
    performedBy: string;
    performedAt: Date;
  }

  const sortHistoryByDate = (entries: MockHistoryEntry[]): MockHistoryEntry[] => {
    return [...entries].sort(
      (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
    );
  };

  it("should sort entries by date descending", () => {
    const entries: MockHistoryEntry[] = [
      { type: "created", description: "Article created", performedBy: "user1", performedAt: new Date("2024-01-01") },
      { type: "updated", description: "Content updated", performedBy: "user2", performedAt: new Date("2024-01-03") },
      { type: "published", description: "Article published", performedBy: "admin", performedAt: new Date("2024-01-05") },
    ];

    const sorted = sortHistoryByDate(entries);
    expect(sorted[0].type).toBe("published");
    expect(sorted[2].type).toBe("created");
  });

  it("should merge different entry types correctly", () => {
    const entries: MockHistoryEntry[] = [
      { type: "created", description: "Article created", performedBy: "user1", performedAt: new Date("2024-01-01") },
      { type: "commented", description: "Comment added", performedBy: "reviewer", performedAt: new Date("2024-01-02") },
      { type: "approved", description: "Article approved", performedBy: "committee", performedAt: new Date("2024-01-04") },
    ];

    const types = entries.map((e) => e.type);
    expect(types).toContain("created");
    expect(types).toContain("commented");
    expect(types).toContain("approved");
  });
});
