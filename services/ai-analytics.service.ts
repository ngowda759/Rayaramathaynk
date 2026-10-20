// AI Analytics Service
// Handles all AI-related analytics operations: token usage, latency, intent distribution

import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { Intent, IntentCategory } from "@/lib/ai/intent/types";
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

/**
 * Real Supabase table names for AI analytics.
 *
 * These are the tables declared in `supabase/migrations/20260930000000_create_ai_tables.sql`
 * and mirrored by `prisma/schema.prisma`. There is deliberately no token-usage
 * entry: no `ai_token_usage` table exists in any migration or Prisma baseline,
 * so token analytics has no destination and must report itself as unavailable
 * rather than querying a relation that does not exist.
 */
const TABLES = {
  LATENCY_RECORDS: "ai_latency_records",
  INTENT_DISTRIBUTION: "ai_intent_distribution",
  UNKNOWN_QUESTIONS: "unknown_questions",
  CHAT_SESSIONS: "chat_sessions",
  CHAT_MESSAGES: "chat_messages",
};

/**
 * Token usage analytics is not implemented: there is no destination table.
 *
 * `recordTokenUsage` has no callers and no migration declares an `ai_token_usage`
 * table, so enabling it requires a reviewed schema addition. Until then the read
 * path returns an explicit `available: false` instead of fabricating zeros, and
 * the write path refuses instead of silently discarding the record.
 */
const TOKEN_USAGE_UNAVAILABLE_MESSAGE =
  "Token usage analytics has no destination table (ai_token_usage). " +
  "Enable it with a reviewed migration before recording token usage.";

/** Raw row shapes for the AI analytics tables, matching the SQL columns. */
interface LatencyRow {
  id: string;
  session_id: string | null;
  total_latency: number | null;
  intent_detection_time: number | null;
  retrieval_time: number | null;
  generation_time: number | null;
  timestamp: string;
  success: boolean | null;
  error_type: string | null;
}

interface IntentDistributionRow {
  id: string;
  session_id: string | null;
  message_id: string | null;
  intent: string;
  category: string | null;
  language: string | null;
  confidence: number | null;
  timestamp: string;
}

interface UnknownQuestionRow {
  id: string;
  session_id: string | null;
  question: string;
  detected_intent: string | null;
  confidence: number | null;
  language: string | null;
  timestamp: string;
  status: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  added_to_knowledge_article_id: string | null;
}

/** Narrow an arbitrary column value to a supported language code. */
function toLanguage(value: unknown): "en" | "kn" | "mixed" {
  return value === "kn" || value === "mixed" ? value : "en";
}

/**
 * Get analytics tracking preferences.
 *
 * Currently returns the documented defaults; see the note in the function body.
 */
export async function getAnalyticsSettings(): Promise<AIAnalyticsSettings> {
  // Analytics tracking preferences are not part of the Supabase schema
  // (ai_settings has no analytics column), and there is no Firestore fallback.
  // The documented defaults apply until a dedicated store exists.
  return getDefaultSettings();
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
 * Record token usage for a message.
 *
 * There is no `ai_token_usage` destination table, so this refuses rather than
 * dropping the record into a nonexistent relation. Wire it up only after a
 * reviewed migration adds the table.
 */
export async function recordTokenUsage(
  data: Omit<TokenUsageRecord, "id" | "timestamp">
): Promise<string> {
  void data;
  const settings = await getAnalyticsSettings();
  if (!settings.enabled || !settings.trackTokenUsage) {
    return "";
  }

  console.error(`[ai-analytics] recordTokenUsage called but ${TOKEN_USAGE_UNAVAILABLE_MESSAGE}`);
  throw new Error(TOKEN_USAGE_UNAVAILABLE_MESSAGE);
}

/**
 * Record latency metrics for a message
 */
export async function recordLatency(
  data: Omit<LatencyRecord, "id" | "timestamp">
): Promise<string> {
  const settings = await getAnalyticsSettings();
  if (!settings.enabled || !settings.trackLatency) {
    return "";
  }

  try {
    const supabase = typeof window === 'undefined' ? createAdminClient() : createClient();
    const { data: insertedData, error } = await supabase
      .from('ai_latency_records')
      .insert([{
        total_latency: data.totalLatency,
        intent_detection_time: data.intentDetectionTime,
        retrieval_time: data.retrievalTime,
        generation_time: data.generationTime,
        success: data.success,
        error_type: data.errorType,
        model: data.model || null,
        session_id: data.sessionId,
        timestamp: new Date().toISOString()
      }])
      .select('id')
      .single();
    if (error) throw error;
    return insertedData.id;
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
  if (!settings.enabled || !settings.trackIntentDistribution) {
    return "";
  }

  try {
    const supabase = typeof window === 'undefined' ? createAdminClient() : createClient();
    const { data: insertedData, error } = await supabase
      .from('ai_intent_distribution')
      .insert([{
        intent: data.intent,
        category: data.category,
        language: data.language,
        confidence: data.confidence,
        session_id: data.sessionId,
        message_id: data.messageId,
        timestamp: new Date().toISOString()
      }])
      .select('id')
      .single();
    if (error) throw error;
    return insertedData.id;
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
  if (!settings.enabled || !settings.trackUnknownQuestions) {
    return "";
  }

  try {
    const supabase = typeof window === 'undefined' ? createAdminClient() : createClient();
    const { data: insertedData, error } = await supabase
      .from('unknown_questions')
      .insert([{
        question: data.question,
        question_lower: data.question.toLowerCase(),
        detected_intent: data.detectedIntent,
        confidence: data.confidence,
        language: data.language,
        session_id: data.sessionId,
        times_asked: 1,
        status: 'pending',
        assigned_to: 'unassigned'
      }])
      .select('id')
      .single();

    if (error) {
      console.error("Error recording unknown question in Supabase:", error);
      throw error;
    }

    return insertedData.id;
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
  try {
    const supabase = typeof window === 'undefined' ? createAdminClient() : createClient();
    const { error } = await supabase
      .from('unknown_questions')
      .update({
        status: 'reviewed',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        // Only set article ID if it was actually provided, do not fabricate "added"
        added_to_knowledge_article_id: addedToKnowledge && knowledgeArticleId ? knowledgeArticleId : null
      })
      .eq('id', questionId);

    if (error) {
      console.error("Error updating Supabase unknown_question:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error marking unknown question as reviewed:", error);
    throw error;
  }
}

/**
 * Get token usage summary and records.
 *
 * Returns `available: false` with an empty summary because no `ai_token_usage`
 * table exists. Callers must not present the empty summary as a real zero.
 */
export async function getTokenUsage(
  params: AnalyticsQueryParams = {}
): Promise<TokenUsageResponse> {
  void params;
  return {
    summary: calculateTokenSummary([]),
    records: [],
    available: false,
    unavailableReason: TOKEN_USAGE_UNAVAILABLE_MESSAGE,
  };
}

/**
 * Get latency metrics summary and records
 */
export async function getLatencyMetrics(
  params: Omit<AnalyticsQueryParams, "intent"> = {}
): Promise<LatencyResponse> {
  try {
    const supabase = typeof window === 'undefined' ? createAdminClient() : createClient();
    const { startDate, endDate, limit: limitCount = 100 } = params;
    
    let queryBuilder = supabase.from('ai_latency_records').select('*');
    
    if (startDate) {
      queryBuilder = queryBuilder.gte('timestamp', new Date(startDate).toISOString());
    }
    if (endDate) {
      queryBuilder = queryBuilder.lte('timestamp', new Date(endDate).toISOString());
    }
    
    queryBuilder = queryBuilder.order('timestamp', { ascending: false }).limit(limitCount);
    
    const { data: snapshot, error } = await queryBuilder;

    if (error) {
      console.error("Error querying Supabase ai_latency_records:", error);
      throw error;
    }

    const records: LatencyRecord[] = ((snapshot || []) as LatencyRow[]).map((doc) => ({
      id: doc.id,
      sessionId: doc.session_id ?? "",
      totalLatency: doc.total_latency ?? 0,
      intentDetectionTime: doc.intent_detection_time ?? 0,
      retrievalTime: doc.retrieval_time ?? 0,
      generationTime: doc.generation_time ?? 0,
      timestamp: new Date(doc.timestamp).getTime(),
      success: doc.success ?? true,
      errorType: (doc.error_type ?? undefined) as LatencyRecord["errorType"],
    }));
    
    return { summary: calculateLatencySummary(records), records };
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
  try {
    const supabase = typeof window === 'undefined' ? createAdminClient() : createClient();
    const { startDate, endDate, language, limit: limitCount = 100 } = params;
    
    let queryBuilder = supabase.from('ai_intent_distribution').select('*');
    
    if (startDate) {
      queryBuilder = queryBuilder.gte('timestamp', new Date(startDate).toISOString());
    }
    if (endDate) {
      queryBuilder = queryBuilder.lte('timestamp', new Date(endDate).toISOString());
    }
    
    if (language) {
      queryBuilder = queryBuilder.eq('language', language);
    }
    
    queryBuilder = queryBuilder.order('timestamp', { ascending: false }).limit(limitCount);
    
    const { data: snapshot, error } = await queryBuilder;

    if (error) {
      console.error("Error querying Supabase ai_intent_distribution:", error);
      throw error;
    }

    const records: IntentDistributionRecord[] = ((snapshot || []) as IntentDistributionRow[]).map((doc) => ({
      id: doc.id,
      sessionId: doc.session_id ?? "",
      messageId: doc.message_id || "",
      intent: doc.intent as Intent,
      category: (doc.category ?? "") as IntentCategory,
      language: toLanguage(doc.language),
      confidence: doc.confidence ?? 0,
      timestamp: new Date(doc.timestamp).getTime(),
    }));
    
    return { summary: calculateIntentSummary(records), records };
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
  try {
    const supabase = typeof window === 'undefined' ? createAdminClient() : createClient();
    const { startDate, endDate, intent, limit: limitCount = 100 } = params;
    
    let queryBuilder = supabase.from('unknown_questions').select('*');
    
    if (startDate) {
      queryBuilder = queryBuilder.gte('timestamp', new Date(startDate).toISOString());
    }
    if (endDate) {
      queryBuilder = queryBuilder.lte('timestamp', new Date(endDate).toISOString());
    }
    
    if (intent) {
      queryBuilder = queryBuilder.eq('detected_intent', intent);
    }
    
    queryBuilder = queryBuilder.order('timestamp', { ascending: false }).limit(limitCount);
    
    const { data: snapshot, error } = await queryBuilder;

    if (error) {
      console.error("Error querying Supabase unknown_questions:", error);
      throw error;
    }

    const records: UnknownQuestionRecord[] = ((snapshot || []) as UnknownQuestionRow[]).map((doc) => ({
      id: doc.id,
      sessionId: doc.session_id ?? "",
      messageId: "",
      question: doc.question,
      detectedIntent: (doc.detected_intent ?? "") as Intent,
      confidence: doc.confidence ?? 0,
      language: toLanguage(doc.language),
      timestamp: new Date(doc.timestamp).getTime(),
      reviewed: doc.status !== 'pending' && doc.status !== 'unassigned',
      reviewedBy: doc.reviewed_by ?? undefined,
      reviewedAt: doc.reviewed_at ? new Date(doc.reviewed_at).getTime() : undefined,
      addedToKnowledge: !!doc.added_to_knowledge_article_id,
    }));
    
    return { summary: calculateUnknownQuestionSummary(records), records };
  } catch (error) {
    console.error("Error fetching unknown questions:", error);
    throw error;
  }
}

/**
 * Check AI health status
 */
export async function checkAIHealth(): Promise<HealthCheckResponse> {
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
        issues,
      },
      timestamp: Date.now(),
    };
    
    return response;
  } catch (error) {
    // A failed health probe is an outage, not a zero. Report it as an explicit
    // issue rather than fabricating a 100% error rate / healthy zero, so the
    // dashboard never renders a query failure as a normal metric.
    console.error("Error checking AI health:", error);
    return {
      status: {
        status: "unhealthy",
        lastChecked: Date.now(),
        apiLatency: 0,
        errorRate: 0,
        uptime: 0,
        issues: [
          {
            type: "retrieval_error",
            message:
              "Health metrics could not be read from the datastore. Values are unavailable, not zero.",
            startedAt: Date.now(),
            frequency: 1,
          },
        ],
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
  
  try {
    // Fetch all metrics in parallel
    const [tokenResponse, latencyResponse, intentResponse, unknownResponse, healthResponse] = await Promise.all([
      getTokenUsage({ startDate: start, endDate: end, limit: 1000 }),
      getLatencyMetrics({ startDate: start, endDate: end, limit: 1000 }),
      getIntentDistribution({ startDate: start, endDate: end, limit: 1000 }),
      getUnknownQuestions({ startDate: start, endDate: end, limit: 100 }),
      checkAIHealth(),
    ]);
    
    // Conversation/message counts from Supabase. A query failure must surface as
    // an error (the route returns 500) rather than a dashboard that silently
    // reports zero conversations.
    const supabase = typeof window === "undefined" ? createAdminClient() : createClient();

    const { count: sessionsCount, error: sessionsError } = await supabase
      .from(TABLES.CHAT_SESSIONS)
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(start).toISOString())
      .lte("created_at", new Date(end).toISOString());
    if (sessionsError) throw sessionsError;
    const totalConversations = sessionsCount || 0;

    const { count: messagesCount, error: messagesError } = await supabase
      .from(TABLES.CHAT_MESSAGES)
      .select("id", { count: "exact", head: true })
      .gte("timestamp", new Date(start).toISOString())
      .lte("timestamp", new Date(end).toISOString());
    if (messagesError) throw messagesError;
    const totalMessages = messagesCount || 0;

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
      tokenUsageAvailable: tokenResponse.available,
      tokenUsageUnavailableReason: tokenResponse.unavailableReason,
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
      category: category as IntentCategory,
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
