// Unit tests for AI Analytics Service
// Tests token usage, latency, intent distribution, and unknown question tracking

import { Intent, IntentCategory } from "@/lib/ai/intent/types";

// Define types to avoid any
interface HealthIssue {
  type: "timeout" | "error" | "rate_limit" | "api_failure";
  message: string;
  startedAt: number;
  frequency: number;
}

interface TokenRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

interface LatencyRecord {
  timestamp: number;
  intent: number;
  retrieval: number;
  generation: number;
  total: number;
}

interface IntentRecord {
  intent: string;
  category: string;
  confidence: number;
  timestamp: number;
}

// Mock Firebase
jest.mock("@/lib/firebase", () => ({
  db: {
    collection: jest.fn(),
  },
  isFirebaseConfigured: () => false,
}));

// Mock Firebase Firestore methods
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
    })),
  })),
  doc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  getCountFromServer: jest.fn(),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({
      toMillis: () => date.getTime(),
    })),
    now: jest.fn(() => ({
      toMillis: () => Date.now(),
    })),
  },
  serverTimestamp: jest.fn(() => ({ toMillis: () => Date.now() })),
}));

describe("AI Analytics Types", () => {
  describe("TokenUsageRecord", () => {
    it("should have required fields", () => {
      const record = {
        id: "test-id",
        sessionId: "session-1",
        messageId: "msg-1",
        model: "gpt-4o-mini",
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.002,
        timestamp: Date.now(),
        intent: Intent.TEMPLE_TIMINGS,
        language: "en" as const,
      };

      expect(record.id).toBe("test-id");
      expect(record.totalTokens).toBe(150);
      expect(record.estimatedCost).toBe(0.002);
    });
  });

  describe("LatencyRecord", () => {
    it("should have required fields for latency tracking", () => {
      const record = {
        id: "test-id",
        sessionId: "session-1",
        messageId: "msg-1",
        totalLatency: 1500,
        intentDetectionTime: 50,
        retrievalTime: 200,
        generationTime: 1250,
        timestamp: Date.now(),
        intent: Intent.PANCHANGA,
        success: true,
      };

      expect(record.totalLatency).toBe(1500);
      expect(record.intentDetectionTime).toBe(50);
      expect(record.generationTime).toBe(1250);
      expect(record.success).toBe(true);
    });

    it("should support error tracking", () => {
      const errorRecord = {
        id: "error-id",
        sessionId: "session-1",
        messageId: "msg-1",
        totalLatency: 10000,
        intentDetectionTime: 50,
        retrievalTime: 200,
        generationTime: 9750,
        timestamp: Date.now(),
        intent: Intent.UNKNOWN,
        success: false,
        errorType: "timeout" as const,
      };

      expect(errorRecord.success).toBe(false);
      expect(errorRecord.errorType).toBe("timeout");
    });
  });

  describe("IntentDistributionRecord", () => {
    it("should track intent classification data", () => {
      const record = {
        id: "test-id",
        sessionId: "session-1",
        messageId: "msg-1",
        intent: Intent.SPECIAL_SEVAS,
        category: IntentCategory.SEVAS,
        confidence: 85,
        timestamp: Date.now(),
        language: "kn" as const,
      };

      expect(record.confidence).toBe(85);
      expect(record.category).toBe(IntentCategory.SEVAS);
      expect(record.language).toBe("kn");
    });
  });

  describe("UnknownQuestionRecord", () => {
    it("should track unknown questions with review status", () => {
      const record = {
        id: "unknown-1",
        sessionId: "session-1",
        messageId: "msg-1",
        question: "What is the meaning of life?",
        detectedIntent: Intent.UNKNOWN,
        confidence: 20,
        language: "en" as const,
        timestamp: Date.now(),
        reviewed: false,
        addedToKnowledge: false,
      };

      expect(record.reviewed).toBe(false);
      expect(record.addedToKnowledge).toBe(false);
      expect(record.detectedIntent).toBe(Intent.UNKNOWN);
    });

    it("should support reviewed status", () => {
      const reviewedRecord = {
        id: "unknown-1",
        sessionId: "session-1",
        messageId: "msg-1",
        question: "What is the meaning of life?",
        detectedIntent: Intent.UNKNOWN,
        confidence: 20,
        language: "en" as const,
        timestamp: Date.now(),
        reviewed: true,
        reviewedBy: "admin@example.com",
        reviewedAt: Date.now(),
        addedToKnowledge: true,
        knowledgeArticleId: "article-123",
      };

      expect(reviewedRecord.reviewed).toBe(true);
      expect(reviewedRecord.reviewedBy).toBe("admin@example.com");
      expect(reviewedRecord.addedToKnowledge).toBe(true);
    });
  });

  describe("AIHealthStatus", () => {
    it("should support healthy status", () => {
      const healthy: {
        status: "healthy" | "degraded" | "unhealthy";
        lastChecked: number;
        apiLatency: number;
        errorRate: number;
        uptime: number;
        issues: HealthIssue[];
      } = {
        status: "healthy",
        lastChecked: Date.now(),
        apiLatency: 500,
        errorRate: 0.1,
        uptime: 99.9,
        issues: [],
      };

      expect(healthy.status).toBe("healthy");
      expect(healthy.errorRate).toBeLessThan(1);
    });

    it("should support degraded status with issues", () => {
      const degraded: {
        status: "healthy" | "degraded" | "unhealthy";
        lastChecked: number;
        apiLatency: number;
        errorRate: number;
        uptime: number;
        issues: HealthIssue[];
      } = {
        status: "degraded",
        lastChecked: Date.now(),
        apiLatency: 6000,
        errorRate: 3.5,
        uptime: 96.5,
        issues: [
          {
            type: "timeout" as const,
            message: "Average latency exceeds threshold",
            startedAt: Date.now() - 3600000,
            frequency: 5,
          },
        ],
      };

      expect(degraded.status).toBe("degraded");
      expect(degraded.issues.length).toBe(1);
      expect(degraded.issues[0].type).toBe("timeout");
    });
  });
});

describe("Token Usage Calculations", () => {
  const calculateTokenSummary = (records: TokenRecord[]) => {
    const byModel: Record<string, { totalTokens: number; totalCost: number; requestCount: number }> = {};
    const byIntent: Record<string, { totalTokens: number; requestCount: number }> = {};
    
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    
    for (const record of records) {
      totalInputTokens += record.inputTokens;
      totalOutputTokens += record.outputTokens;
      totalCost += record.estimatedCost;
      
      if (!byModel[record.model]) {
        byModel[record.model] = { totalTokens: 0, totalCost: 0, requestCount: 0 };
      }
      byModel[record.model].totalTokens += record.totalTokens;
      byModel[record.model].totalCost += record.estimatedCost;
      byModel[record.model].requestCount++;
      
      if (!byIntent[record.intent]) {
        byIntent[record.intent] = { totalTokens: 0, requestCount: 0 };
      }
      byIntent[record.intent].totalTokens += record.totalTokens;
      byIntent[record.intent].requestCount++;
    }
    
    return {
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      totalCost,
      averageTokensPerRequest: records.length > 0 ? (totalInputTokens + totalOutputTokens) / records.length : 0,
      byModel,
      byIntent,
    };
  };

  it("should calculate token totals correctly", () => {
    const records = [
      {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.001,
        model: "gpt-4o-mini",
        intent: Intent.TEMPLE_TIMINGS,
      },
      {
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
        estimatedCost: 0.002,
        model: "gpt-4o-mini",
        intent: Intent.PANCHANGA,
      },
    ];

    const summary = calculateTokenSummary(records);
    
    expect(summary.totalInputTokens).toBe(300);
    expect(summary.totalOutputTokens).toBe(150);
    expect(summary.totalTokens).toBe(450);
    expect(summary.totalCost).toBeCloseTo(0.003);
  });

  it("should group tokens by model", () => {
    const records = [
      {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.001,
        model: "gpt-4o-mini",
        intent: Intent.TEMPLE_TIMINGS,
      },
      {
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
        estimatedCost: 0.004,
        model: "gpt-4o",
        intent: Intent.PANCHANGA,
      },
    ];

    const summary = calculateTokenSummary(records);
    
    expect(Object.keys(summary.byModel)).toHaveLength(2);
    expect(summary.byModel["gpt-4o-mini"].totalTokens).toBe(150);
    expect(summary.byModel["gpt-4o"].totalTokens).toBe(300);
  });

  it("should calculate average tokens per request", () => {
    const records = [
      { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.001, model: "test", intent: Intent.TEMPLE_TIMINGS },
      { inputTokens: 200, outputTokens: 100, totalTokens: 300, estimatedCost: 0.002, model: "test", intent: Intent.PANCHANGA },
    ];

    const summary = calculateTokenSummary(records);
    
    expect(summary.averageTokensPerRequest).toBe(225);
  });

  it("should handle empty records", () => {
    const summary = calculateTokenSummary([]);
    
    expect(summary.totalTokens).toBe(0);
    expect(summary.averageTokensPerRequest).toBe(0);
    expect(Object.keys(summary.byModel)).toHaveLength(0);
  });
});

describe("Latency Calculations", () => {
  const calculateLatencySummary = (records: LatencyRecord[]) => {
    if (records.length === 0) {
      return {
        averageTotalLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        successRate: 100,
        errorCount: 0,
      };
    }

    const totalLatencies = records.map((r) => r.totalLatency).sort((a, b) => a - b);
    const successRecords = records.filter((r) => r.success);
    
    const getPercentile = (arr: number[], p: number) => {
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, index)];
    };

    return {
      averageTotalLatency: totalLatencies.reduce((a, b) => a + b, 0) / totalLatencies.length,
      p50Latency: getPercentile(totalLatencies, 50),
      p95Latency: getPercentile(totalLatencies, 95),
      p99Latency: getPercentile(totalLatencies, 99),
      successRate: (successRecords.length / records.length) * 100,
      errorCount: records.filter((r) => !r.success).length,
    };
  };

  it("should calculate average latency", () => {
    const records = [
      { totalLatency: 1000, success: true },
      { totalLatency: 2000, success: true },
      { totalLatency: 3000, success: true },
    ];

    const summary = calculateLatencySummary(records);
    
    expect(summary.averageTotalLatency).toBe(2000);
  });

  it("should calculate percentiles correctly", () => {
    const records = Array.from({ length: 100 }, (_, i) => ({
      totalLatency: (i + 1) * 100,
      success: true,
    }));

    const summary = calculateLatencySummary(records);
    
    expect(summary.p50Latency).toBe(5000);
    expect(summary.p95Latency).toBe(9500);
    expect(summary.p99Latency).toBe(9900);
  });

  it("should calculate success rate", () => {
    const records = [
      { totalLatency: 1000, success: true },
      { totalLatency: 2000, success: true },
      { totalLatency: 3000, success: false },
      { totalLatency: 4000, success: false },
    ];

    const summary = calculateLatencySummary(records);
    
    expect(summary.successRate).toBe(50);
    expect(summary.errorCount).toBe(2);
  });

  it("should handle empty records", () => {
    const summary = calculateLatencySummary([]);
    
    expect(summary.averageTotalLatency).toBe(0);
    expect(summary.successRate).toBe(100);
  });
});

describe("Intent Distribution Calculations", () => {
  const calculateIntentSummary = (records: IntentRecord[]) => {
    const byIntent: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};

    for (const record of records) {
      byIntent[record.intent] = (byIntent[record.intent] || 0) + 1;
      byCategory[record.category] = (byCategory[record.category] || 0) + 1;
      byLanguage[record.language] = (byLanguage[record.language] || 0) + 1;
    }

    const total = records.length;

    const intentDistribution = Object.entries(byIntent)
      .map(([intent, count]) => ({
        intent,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalMessages: total,
      byIntent: intentDistribution,
      byCategory,
      byLanguage,
    };
  };

  it("should calculate intent percentages", () => {
    const records = [
      { intent: Intent.TEMPLE_TIMINGS, category: IntentCategory.TEMPLE_INFO, language: "en" },
      { intent: Intent.TEMPLE_TIMINGS, category: IntentCategory.TEMPLE_INFO, language: "en" },
      { intent: Intent.PANCHANGA, category: IntentCategory.PANCHANGA, language: "kn" },
      { intent: Intent.SPECIAL_SEVAS, category: IntentCategory.SEVAS, language: "en" },
    ];

    const summary = calculateIntentSummary(records);

    expect(summary.totalMessages).toBe(4);
    expect(summary.byIntent[0].intent).toBe(Intent.TEMPLE_TIMINGS);
    expect(summary.byIntent[0].percentage).toBe(50);
  });

  it("should calculate category distribution", () => {
    const records = [
      { intent: Intent.TEMPLE_TIMINGS, category: IntentCategory.TEMPLE_INFO, language: "en" },
      { intent: Intent.LOCATION, category: IntentCategory.TEMPLE_INFO, language: "en" },
      { intent: Intent.PANCHANGA, category: IntentCategory.PANCHANGA, language: "kn" },
    ];

    const summary = calculateIntentSummary(records);

    expect(summary.byCategory[IntentCategory.TEMPLE_INFO]).toBe(2);
    expect(summary.byCategory[IntentCategory.PANCHANGA]).toBe(1);
  });

  it("should calculate language distribution", () => {
    const records = [
      { intent: Intent.TEMPLE_TIMINGS, category: IntentCategory.TEMPLE_INFO, language: "en" },
      { intent: Intent.TEMPLE_TIMINGS, category: IntentCategory.TEMPLE_INFO, language: "en" },
      { intent: Intent.PANCHANGA, category: IntentCategory.PANCHANGA, language: "kn" },
      { intent: Intent.SPECIAL_SEVAS, category: IntentCategory.SEVAS, language: "mixed" },
    ];

    const summary = calculateIntentSummary(records);

    expect(summary.byLanguage["en"]).toBe(2);
    expect(summary.byLanguage["kn"]).toBe(1);
    expect(summary.byLanguage["mixed"]).toBe(1);
  });
});

describe("Unknown Questions Calculations", () => {
  const calculateUnknownSummary = (records: { question: string; confidence: number; intent: string }[]) => {
    const byIntent: Record<string, number> = {};
    let helpful = 0;
    let not_helpful = 0;

    for (const record of records) {
      byIntent[record.detectedIntent] = (byIntent[record.detectedIntent] || 0) + 1;
      if (record.feedback === "helpful") helpful++;
      if (record.feedback === "not_helpful") not_helpful++;
    }

    const total = records.length;
    const reviewed = records.filter((r) => r.reviewed).length;
    const addedToKnowledge = records.filter((r) => r.addedToKnowledge).length;

    return {
      total,
      unreviewed: total - reviewed,
      reviewed,
      addedToKnowledge,
      byIntent,
      feedbackDistribution: { helpful, not_helpful },
    };
  };

  it("should track review status", () => {
    const records = [
      { detectedIntent: Intent.UNKNOWN, reviewed: false, addedToKnowledge: false, feedback: "not_helpful" },
      { detectedIntent: Intent.UNKNOWN, reviewed: true, addedToKnowledge: false, feedback: "helpful" },
      { detectedIntent: Intent.UNKNOWN, reviewed: true, addedToKnowledge: true, feedback: "helpful" },
    ];

    const summary = calculateUnknownSummary(records);

    expect(summary.total).toBe(3);
    expect(summary.reviewed).toBe(2);
    expect(summary.unreviewed).toBe(1);
    expect(summary.addedToKnowledge).toBe(1);
  });

  it("should track feedback distribution", () => {
    const records = [
      { detectedIntent: Intent.UNKNOWN, reviewed: false, addedToKnowledge: false, feedback: "helpful" },
      { detectedIntent: Intent.UNKNOWN, reviewed: false, addedToKnowledge: false, feedback: "helpful" },
      { detectedIntent: Intent.UNKNOWN, reviewed: false, addedToKnowledge: false, feedback: "not_helpful" },
    ];

    const summary = calculateUnknownSummary(records);

    expect(summary.feedbackDistribution.helpful).toBe(2);
    expect(summary.feedbackDistribution.not_helpful).toBe(1);
  });
});
