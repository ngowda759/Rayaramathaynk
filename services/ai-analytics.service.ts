// AI Analytics Service
// Handles all AI-related analytics operations: token usage, latency, intent distribution

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  serverTimestamp,
  getCountFromServer,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { Intent } from "@/lib/ai/intent/types";
import type {
  TokenUsageRecord,
  LatencyRecord,
  IntentDistributionRecord,
  UnknownQuestionRecord,
  AIHealthStatus,
  AIHealthIssue,
  TokenUsageSummary,
  LatencySummary,
  IntentDistributionSummary,
  UnknownQuestionSummary,
  AIAnalyticsDashboard,
  AnalyticsQueryParams,
  AIAnalyticsSettings,
  HealthCheckResponse,
  TokenUsageResponse,
  LatencyResponse,
  IntentDistributionResponse,
  UnknownQuestionsResponse,
  AnalyticsDashboardResponse,
} from "@/types/ai-analytics";

const COLLECTIONS = {
  TOKEN_USAGE: "ai_token_usage",
  LATENCY_RECORDS: "ai_latency_records",
  INTENT_DISTRIBUTION: "ai_intent_distribution",
  UNKNOWN_QUESTIONS: "ai_unknown_questions",
  AI_SETTINGS: "ai_settings",
  CHAT_SESSIONS: "chat_sessions",
  CHAT_MESSAGES: "chat_messages",
};

/**
 * Get analytics settings from Firestore
 */
export async function getAnalyticsSettings(): Promise<AIAnalyticsSettings> {
  if (!isFirebaseConfigured() || !db) {
    return getDefaultSettings();
  }

  try {
    const settingsSnap = await getDocs(
      query(collection(db, COLLECTIONS.AI_SETTINGS))
    );
    
    if (settingsSnap.empty) {
      return getDefaultSettings();
    }
    
    const settings = settingsSnap.docs[0].data() as AIAnalyticsSettings;
    return settings || getDefaultSettings();
  } catch (error) {
    console.error("Error fetching analytics settings:", error);
    return getDefaultSettings();
  }
}

function getDefaultSettings(): AIAnalyticsSettings {
  return {
    enabled: true,
    trackTokenUsage: true,
    trackLatency: true,
    trackIntentDistribution: true,
    trackUnknownQuestions: true,
    retentionDays: 90,
    alertThresholds: {
      maxLatency: 5000,
      maxErrorRate: 5,
      maxDailyCost: 100,
    },
  };
}

/**
 * Record token usage for a message
 */
export async function recordTokenUsage(
  data: Omit<TokenUsageRecord, "id" | "timestamp">
): Promise<string> {
  const settings = await getAnalyticsSettings();
  if (!settings.enabled || !settings.trackTokenUsage || !isFirebaseConfigured() || !db) {
    return "";
  }

  try {
    const docRef = await addDoc(
      collection(db, COLLECTIONS.TOKEN_USAGE),
      {
        ...data,
        timestamp: serverTimestamp(),
      }
    );
    return docRef.id;
  } catch (error) {
    console.error("Error recording token usage:", error);
    throw error;
  }
}

/**
 * Record latency metrics for a message
 */
export async function recordLatency(
  data: Omit<LatencyRecord, "id" | "timestamp">
): Promise<string> {
  const settings = await getAnalyticsSettings();
  if (!settings.enabled || !settings.trackLatency || !isFirebaseConfigured() || !db) {
    return "";
  }

  try {
    const docRef = await addDoc(
      collection(db, COLLECTIONS.LATENCY_RECORDS),
      {
        ...data,
        timestamp: serverTimestamp(),
      }
    );
    return docRef.id;
  } catch (error) {
    console.error("Error recording latency:", error);
    throw error;
  }
}

/**
 * Record intent distribution for a message
 */
export async function recordIntentDistribution(
  data: Omit<IntentDistributionRecord, "id" | "timestamp">
): Promise<string> {
  const settings = await getAnalyticsSettings();
  if (!settings.enabled || !settings.trackIntentDistribution || !isFirebaseConfigured() || !db) {
    return "";
  }

  try {
    const docRef = await addDoc(
      collection(db, COLLECTIONS.INTENT_DISTRIBUTION),
      {
        ...data,
        timestamp: serverTimestamp(),
      }
    );
    return docRef.id;
  } catch (error) {
    console.error("Error recording intent distribution:", error);
    throw error;
  }
}

/**
 * Record an unknown question
 */
export async function recordUnknownQuestion(
  data: Omit<UnknownQuestionRecord, "id" | "timestamp" | "reviewed" | "addedToKnowledge">
): Promise<string> {
  const settings = await getAnalyticsSettings();
  if (!settings.enabled || !settings.trackUnknownQuestions || !isFirebaseConfigured() || !db) {
    return "";
  }

  try {
    const docRef = await addDoc(
      collection(db, COLLECTIONS.UNKNOWN_QUESTIONS),
      {
        ...data,
        reviewed: false,
        addedToKnowledge: false,
        timestamp: serverTimestamp(),
      }
    );
    return docRef.id;
  } catch (error) {
    console.error("Error recording unknown question:", error);
    throw error;
  }
}

/**
 * Mark an unknown question as reviewed
 */
export async function markUnknownQuestionReviewed(
  questionId: string,
  reviewedBy: string,
  addedToKnowledge: boolean = false,
  knowledgeArticleId?: string
): Promise<void> {
  if (!isFirebaseConfigured() || !db) {
    return;
  }
  try {
    const questionRef = doc(db, COLLECTIONS.UNKNOWN_QUESTIONS, questionId);
    await updateDoc(questionRef, {
      reviewed: true,
      reviewedBy,
      reviewedAt: Timestamp.now(),
      addedToKnowledge,
      knowledgeArticleId: knowledgeArticleId || null,
    });
  } catch (error) {
    console.error("Error marking question as reviewed:", error);
    throw error;
  }
}

/**
 * Get token usage summary and records
 */
export async function getTokenUsage(
  params: AnalyticsQueryParams = {}
): Promise<TokenUsageResponse> {
  if (!isFirebaseConfigured() || !db) {
    return {
      summary: {} as any,
      records: []
    };
  }
  try {
    const { startDate, endDate, intent, limit: limitCount = 100 } = params;
    
    let q = query(collection(db, COLLECTIONS.TOKEN_USAGE));
    
    if (startDate || endDate) {
      const constraints = [];
      if (startDate) {
        constraints.push(where("timestamp", ">=", Timestamp.fromDate(new Date(startDate))));
      }
      if (endDate) {
        constraints.push(where("timestamp", "<=", Timestamp.fromDate(new Date(endDate))));
      }
      q = query(collection(db, COLLECTIONS.TOKEN_USAGE), ...constraints);
    }
    
    if (intent) {
      q = query(q, where("intent", "==", intent));
    }
    
    q = query(q, orderBy("timestamp", "desc"), limit(limitCount));
    
    const snapshot = await getDocs(q);
    const records: TokenUsageRecord[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toMillis?.() || Date.now(),
    })) as TokenUsageRecord[];

    // Calculate summary
    const summary = calculateTokenSummary(records);
    
    return { summary, records };
  } catch (error) {
    console.error("Error fetching token usage:", error);
    throw error;
  }
}

/**
 * Get latency metrics summary and records
 */
export async function getLatencyMetrics(
  params: AnalyticsQueryParams = {}
): Promise<LatencyResponse> {
  if (!isFirebaseConfigured() || !db) {
    return { summary: {} as any, records: [] };
  }
  try {
    const { startDate, endDate, intent, limit: limitCount = 100 } = params;
    
    let q = query(collection(db, COLLECTIONS.LATENCY_RECORDS));
    
    if (startDate || endDate) {
      const constraints = [];
      if (startDate) {
        constraints.push(where("timestamp", ">=", Timestamp.fromDate(new Date(startDate))));
      }
      if (endDate) {
        constraints.push(where("timestamp", "<=", Timestamp.fromDate(new Date(endDate))));
      }
      q = query(collection(db, COLLECTIONS.LATENCY_RECORDS), ...constraints);
    }
    
    if (intent) {
      q = query(q, where("intent", "==", intent));
    }
    
    q = query(q, orderBy("timestamp", "desc"), limit(limitCount));
    
    const snapshot = await getDocs(q);
    const records: LatencyRecord[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toMillis?.() || Date.now(),
    })) as LatencyRecord[];

    // Calculate summary
    const summary = calculateLatencySummary(records);
    
    return { summary, records };
  } catch (error) {
    console.error("Error fetching latency metrics:", error);
    throw error;
  }
}

/**
 * Get intent distribution summary and records
 */
export async function getIntentDistribution(
  params: AnalyticsQueryParams = {}
): Promise<IntentDistributionResponse> {
  if (!isFirebaseConfigured() || !db) {
    return { summary: {} as any, records: [] };
  }
  try {
    const { startDate, endDate, language, limit: limitCount = 100 } = params;
    
    let q = query(collection(db, COLLECTIONS.INTENT_DISTRIBUTION));
    
    if (startDate || endDate) {
      const constraints = [];
      if (startDate) {
        constraints.push(where("timestamp", ">=", Timestamp.fromDate(new Date(startDate))));
      }
      if (endDate) {
        constraints.push(where("timestamp", "<=", Timestamp.fromDate(new Date(endDate))));
      }
      q = query(collection(db, COLLECTIONS.INTENT_DISTRIBUTION), ...constraints);
    }
    
    if (language) {
      q = query(q, where("language", "==", language));
    }
    
    q = query(q, orderBy("timestamp", "desc"), limit(limitCount));
    
    const snapshot = await getDocs(q);
    const records: IntentDistributionRecord[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toMillis?.() || Date.now(),
    })) as IntentDistributionRecord[];

    // Calculate summary
    const summary = calculateIntentSummary(records);
    
    return { summary, records };
  } catch (error) {
    console.error("Error fetching intent distribution:", error);
    throw error;
  }
}

/**
 * Get unknown questions summary and records
 */
export async function getUnknownQuestions(
  params: AnalyticsQueryParams = {}
): Promise<UnknownQuestionsResponse> {
  if (!isFirebaseConfigured() || !db) {
    return { summary: {} as any, records: [] };
  }
  try {
    const { startDate, endDate, intent, limit: limitCount = 100 } = params;
    
    let q = query(collection(db, COLLECTIONS.UNKNOWN_QUESTIONS));
    
    if (startDate || endDate) {
      const constraints = [];
      if (startDate) {
        constraints.push(where("timestamp", ">=", Timestamp.fromDate(new Date(startDate))));
      }
      if (endDate) {
        constraints.push(where("timestamp", "<=", Timestamp.fromDate(new Date(endDate))));
      }
      q = query(collection(db, COLLECTIONS.UNKNOWN_QUESTIONS), ...constraints);
    }
    
    if (intent) {
      q = query(q, where("detectedIntent", "==", intent));
    }
    
    q = query(q, orderBy("timestamp", "desc"), limit(limitCount));
    
    const snapshot = await getDocs(q);
    const records: UnknownQuestionRecord[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toMillis?.() || Date.now(),
      reviewedAt: doc.data().reviewedAt?.toMillis?.() || undefined,
    })) as UnknownQuestionRecord[];

    // Calculate summary
    const summary = calculateUnknownQuestionSummary(records);
    
    return { summary, records };
  } catch (error) {
    console.error("Error fetching unknown questions:", error);
    throw error;
  }
}

/**
 * Check AI health status
 */
export async function checkAIHealth(): Promise<HealthCheckResponse> {
  if (!isFirebaseConfigured() || !db) {
    return {
      status: "healthy",
      timestamp: Date.now(),
    } as any;
  }

  const issues: AIHealthIssue[] = [];
  let status: AIHealthStatus["status"] = "healthy";
  
  try {
    // Check latency (last 100 records)
    const latencyResponse = await getLatencyMetrics({ limit: 100 });
    const settings = await getAnalyticsSettings();
    
    const avgLatency = latencyResponse.summary.averageTotalLatency;
    const errorRate = 100 - latencyResponse.summary.successRate;
    
    if (avgLatency > settings.alertThresholds.maxLatency) {
      issues.push({
        type: "timeout",
        message: `Average latency (${avgLatency}ms) exceeds threshold (${settings.alertThresholds.maxLatency}ms)`,
        startedAt: Date.now(),
        frequency: 1,
      });
      status = "degraded";
    }
    
    if (errorRate > settings.alertThresholds.maxErrorRate) {
      issues.push({
        type: "api_error",
        message: `Error rate (${errorRate.toFixed(1)}%) exceeds threshold (${settings.alertThresholds.maxErrorRate}%)`,
        startedAt: Date.now(),
        frequency: 1,
      });
      status = "unhealthy";
    }
    
    // Check daily token usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tokenResponse = await getTokenUsage({ 
      startDate: today.getTime(),
      limit: 1000 
    });
    
    const dailyCost = tokenResponse.summary.totalCost;
    if (dailyCost > settings.alertThresholds.maxDailyCost) {
      issues.push({
        type: "api_error",
        message: `Daily cost ($${dailyCost.toFixed(2)}) exceeds budget ($${settings.alertThresholds.maxDailyCost})`,
        startedAt: Date.now(),
        frequency: 1,
      });
    }
    
    const response: HealthCheckResponse = {
      status: { 
        status: status,
        lastChecked: Date.now(),
        apiLatency: avgLatency || 0,
        errorRate: errorRate || 0,
        uptime: 100,
        issues: [],
      },
      timestamp: Date.now(),
    };
    
    return response;
  } catch (error) {
    console.error("Error checking AI health:", error);
    return {
      status: {
        status: "unhealthy",
        lastChecked: Date.now(),
        apiLatency: 0,
        errorRate: 100,
        uptime: 0,
        issues: [],
      },
      timestamp: Date.now(),
    };
  }
}

/**
 * Get full analytics dashboard data
 */
export async function getAnalyticsDashboard(
  startDate?: number,
  endDate?: number
): Promise<AnalyticsDashboardResponse> {
  const end = endDate || Date.now();
  const start = startDate || (end - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days
  
  if (!isFirebaseConfigured() || !db) {
    return {
      dashboard: {
        overview: { totalConversations: 0, totalMessages: 0, uniqueUsers: 0, averageResponseTime: 0, satisfactionRate: 0, period: { start, end } },
        tokenUsage: { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, totalCost: 0, averageTokensPerRequest: 0, byModel: {}, byIntent: {} as any, timeSeries: [] },
        latency: { 
          averageTotalLatency: 0, 
          averageIntentDetectionTime: 0, 
          averageRetrievalTime: 0, 
          averageGenerationTime: 0, 
          p50Latency: 0, 
          p95Latency: 0, 
          p99Latency: 0, 
          timeoutCount: 0, 
          errorCount: 0, 
          successRate: 100, 
          timeSeries: [],
          byIntent: {} as any
        },
        intentDistribution: { 
          totalMessages: 0, 
          byIntent: [], 
          byCategory: [], 
          byLanguage: [], 
          timeSeries: [],
          topQuestions: []
        },
        unknownQuestions: { 
          total: 0, 
          unreviewed: 0, 
          reviewed: 0, 
          addedToKnowledge: 0, 
          byIntent: {} as any, 
          recentQuestions: [], 
          feedbackDistribution: { helpful: 0, not_helpful: 0 },
          timeSeries: []
        },
        health: { status: "healthy", lastChecked: Date.now(), apiLatency: 0, errorRate: 0, uptime: 100, issues: [] },
      },
    } as AnalyticsDashboardResponse;
  }
  
  try {
    // Fetch all metrics in parallel
    const [tokenResponse, latencyResponse, intentResponse, unknownResponse, healthResponse] = await Promise.all([
      getTokenUsage({ startDate: start, endDate: end, limit: 1000 }),
      getLatencyMetrics({ startDate: start, endDate: end, limit: 1000 }),
      getIntentDistribution({ startDate: start, endDate: end, limit: 1000 }),
      getUnknownQuestions({ startDate: start, endDate: end, limit: 100 }),
      checkAIHealth(),
    ]);
    
    // Get conversation counts with error handling for missing indexes
    let totalConversations = 0;
    let totalMessages = 0;

    try {
      const sessionsQuery = query(
        collection(db, COLLECTIONS.CHAT_SESSIONS),
        where("createdAt", ">=", Timestamp.fromDate(new Date(start))),
        where("createdAt", "<=", Timestamp.fromDate(new Date(end)))
      );
      const sessionsSnap = await getCountFromServer(sessionsQuery);
      totalConversations = sessionsSnap.data().count;
    } catch (error) {
      console.warn("Could not get sessions count:", error);
    }

    try {
      const messagesQuery = query(
        collection(db, COLLECTIONS.CHAT_MESSAGES),
        where("timestamp", ">=", Timestamp.fromDate(new Date(start))),
        where("timestamp", "<=", Timestamp.fromDate(new Date(end)))
      );
      const messagesSnap = await getCountFromServer(messagesQuery);
      totalMessages = messagesSnap.data().count;
    } catch (error) {
      console.warn("Could not get messages count:", error);
    }

    const dashboard: AIAnalyticsDashboard = {
      overview: {
        totalConversations,
        totalMessages,
        uniqueUsers: 0, // Would need user tracking
        averageResponseTime: latencyResponse.summary.averageTotalLatency,
        satisfactionRate: unknownResponse.summary.feedbackDistribution.helpful > 0
          ? (unknownResponse.summary.feedbackDistribution.helpful / 
             (unknownResponse.summary.feedbackDistribution.helpful + 
              unknownResponse.summary.feedbackDistribution.not_helpful)) * 100
          : 0,
        period: { start, end },
      },
      tokenUsage: tokenResponse.summary,
      latency: latencyResponse.summary,
      intentDistribution: intentResponse.summary,
      unknownQuestions: unknownResponse.summary,
      health: healthResponse.status,
    };
    
    return { dashboard };
  } catch (error) {
    console.error("Error fetching analytics dashboard:", error);
    throw error;
  }
}

// Helper functions for calculating summaries

function calculateTokenSummary(records: TokenUsageRecord[]): TokenUsageSummary {
  const byModel: TokenUsageSummary["byModel"] = {};
  const byIntent: Record<Intent, { totalTokens: number; requestCount: number }> = {} as Record<Intent, { totalTokens: number; requestCount: number }>;
  const timeSeriesMap: Record<string, { tokens: number; cost: number }> = {};
  
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  
  for (const record of records) {
    totalInputTokens += record.inputTokens;
    totalOutputTokens += record.outputTokens;
    totalCost += record.estimatedCost;
    
    // By model
    if (!byModel[record.model]) {
      byModel[record.model] = { totalTokens: 0, totalCost: 0, requestCount: 0 };
    }
    byModel[record.model].totalTokens += record.totalTokens;
    byModel[record.model].totalCost += record.estimatedCost;
    byModel[record.model].requestCount++;
    
    // By intent
    if (!byIntent[record.intent]) {
      byIntent[record.intent] = { totalTokens: 0, requestCount: 0 };
    }
    byIntent[record.intent].totalTokens += record.totalTokens;
    byIntent[record.intent].requestCount++;
    
    // Time series (by day)
    const date = new Date(record.timestamp).toISOString().split("T")[0];
    if (!timeSeriesMap[date]) {
      timeSeriesMap[date] = { tokens: 0, cost: 0 };
    }
    timeSeriesMap[date].tokens += record.totalTokens;
    timeSeriesMap[date].cost += record.estimatedCost;
  }
  
  const timeSeries = Object.entries(timeSeriesMap)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  return {
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCost,
    averageTokensPerRequest: records.length > 0 
      ? (totalInputTokens + totalOutputTokens) / records.length 
      : 0,
    byModel,
    byIntent,
    timeSeries,
  };
}

function calculateLatencySummary(records: LatencyRecord[]): LatencySummary {
  if (records.length === 0) {
    return {
      averageTotalLatency: 0,
      averageIntentDetectionTime: 0,
      averageRetrievalTime: 0,
      averageGenerationTime: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      timeoutCount: 0,
      errorCount: 0,
      successRate: 100,
      timeSeries: [],
    };
  }
  
  const totalLatencies = records.map((r) => r.totalLatency).sort((a, b) => a - b);
  const successRecords = records.filter((r) => r.success);
  
  const getPercentile = (arr: number[], p: number) => {
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  };
  
  const timeSeriesMap: Record<string, { latencies: number[]; successCount: number; totalCount: number }> = {};
  
  for (const record of records) {
    const date = new Date(record.timestamp).toISOString().split("T")[0];
    if (!timeSeriesMap[date]) {
      timeSeriesMap[date] = { latencies: [], successCount: 0, totalCount: 0 };
    }
    timeSeriesMap[date].latencies.push(record.totalLatency);
    timeSeriesMap[date].totalCount++;
    if (record.success) {
      timeSeriesMap[date].successCount++;
    }
  }
  
  const timeSeries = Object.entries(timeSeriesMap)
    .map(([date, data]) => ({
      date,
      averageLatency: data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length,
      successRate: (data.successCount / data.totalCount) * 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  return {
    averageTotalLatency: totalLatencies.reduce((a, b) => a + b, 0) / totalLatencies.length,
    averageIntentDetectionTime: records.reduce((a, r) => a + r.intentDetectionTime, 0) / records.length,
    averageRetrievalTime: records.reduce((a, r) => a + r.retrievalTime, 0) / records.length,
    averageGenerationTime: records.reduce((a, r) => a + r.generationTime, 0) / records.length,
    p50Latency: getPercentile(totalLatencies, 50),
    p95Latency: getPercentile(totalLatencies, 95),
    p99Latency: getPercentile(totalLatencies, 99),
    timeoutCount: records.filter((r) => r.errorType === "timeout").length,
    errorCount: records.filter((r) => !r.success).length,
    successRate: (successRecords.length / records.length) * 100,
    timeSeries,
  };
}

function calculateIntentSummary(records: IntentDistributionRecord[]): IntentDistributionSummary {
  const byIntent: Record<Intent, number> = {} as Record<Intent, number>;
  const byCategory: Record<string, number> = {};
  const byLanguage: Record<string, number> = {};
  const topQuestionsMap: Record<string, { count: number; intent: Intent }> = {};
  const timeSeriesMap: Record<string, Record<Intent, number>> = {};
  
  for (const record of records) {
    // By intent
    byIntent[record.intent] = (byIntent[record.intent] || 0) + 1;
    
    // By category
    byCategory[record.category] = (byCategory[record.category] || 0) + 1;
    
    // By language
    byLanguage[record.language] = (byLanguage[record.language] || 0) + 1;
    
    // Time series
    const date = new Date(record.timestamp).toISOString().split("T")[0];
    if (!timeSeriesMap[date]) {
      timeSeriesMap[date] = {} as Record<Intent, number>;
    }
    timeSeriesMap[date][record.intent] = (timeSeriesMap[date][record.intent] || 0) + 1;
  }
  
  const total = records.length;
  
  const intentDistribution = Object.entries(byIntent)
    .map(([intent, count]) => ({
      intent: intent as Intent,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
  
  const categoryDistribution = Object.entries(byCategory)
    .map(([category, count]) => ({
      category: category as any,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
  
  const languageDistribution = Object.entries(byLanguage)
    .map(([language, count]) => ({
      language: language as "en" | "kn" | "mixed",
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
  
  const timeSeries = Object.entries(timeSeriesMap)
    .map(([date, intents]) => ({ date, intents }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  const topQuestions = Object.entries(topQuestionsMap)
    .map(([question, data]) => ({ question, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  
  return {
    totalMessages: total,
    byIntent: intentDistribution,
    byCategory: categoryDistribution,
    byLanguage: languageDistribution,
    timeSeries,
    topQuestions,
  };
}

function calculateUnknownQuestionSummary(records: UnknownQuestionRecord[]): UnknownQuestionSummary {
  const byIntent: Record<Intent, number> = {} as Record<Intent, number>;
  const timeSeriesMap: Record<string, number> = {};
  
  let helpful = 0;
  let not_helpful = 0;
  
  for (const record of records) {
    byIntent[record.detectedIntent] = (byIntent[record.detectedIntent] || 0) + 1;
    
    if (record.feedback === "helpful") helpful++;
    if (record.feedback === "not_helpful") not_helpful++;
    
    const date = new Date(record.timestamp).toISOString().split("T")[0];
    timeSeriesMap[date] = (timeSeriesMap[date] || 0) + 1;
  }
  
  const total = records.length;
  const reviewed = records.filter((r) => r.reviewed).length;
  const addedToKnowledge = records.filter((r) => r.addedToKnowledge).length;
  
  const timeSeries = Object.entries(timeSeriesMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  return {
    total,
    unreviewed: total - reviewed,
    reviewed,
    addedToKnowledge,
    byIntent,
    recentQuestions: records.slice(0, 20),
    feedbackDistribution: { helpful, not_helpful },
    timeSeries,
  };
}
