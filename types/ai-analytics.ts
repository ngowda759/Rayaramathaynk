// AI Analytics Types for Sprint A
// Defines all types for AI operations: analytics, health, token usage, latency, intent distribution

import { Intent, IntentCategory } from "@/lib/ai/intent/types";
import { RetrievalType } from "@/lib/ai/intent/types";

/**
 * Token Usage Tracking
 */
export interface TokenUsageRecord {
  id: string;
  sessionId: string;
  messageId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number; // in cents
  timestamp: number;
  intent: Intent;
  language: "en" | "kn" | "mixed";
}

/**
 * Latency Metrics
 */
export interface LatencyRecord {
  id: string;
  sessionId: string;
  messageId: string;
  totalLatency: number; // Total response time in ms
  intentDetectionTime: number; // Time for intent detection in ms
  retrievalTime: number; // Time for data retrieval in ms
  generationTime: number; // Time for LLM generation in ms
  timestamp: number;
  intent: Intent;
  success: boolean;
  errorType?: "timeout" | "rate_limit" | "api_error" | "retrieval_error";
}

/**
 * Intent Distribution Tracking
 */
export interface IntentDistributionRecord {
  id: string;
  sessionId: string;
  messageId: string;
  intent: Intent;
  category: IntentCategory;
  confidence: number;
  timestamp: number;
  language: "en" | "kn" | "mixed";
}

/**
 * Unknown Question Record
 */
export interface UnknownQuestionRecord {
  id: string;
  sessionId: string;
  messageId: string;
  question: string;
  detectedIntent: Intent;
  confidence: number;
  language: "en" | "kn" | "mixed";
  timestamp: number;
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: number;
  addedToKnowledge: boolean;
  knowledgeArticleId?: string;
  feedback?: "helpful" | "not_helpful";
  userAgent?: string;
}

/**
 * AI Health Status
 */
export interface AIHealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  lastChecked: number;
  apiLatency: number; // Current API latency in ms
  errorRate: number; // Percentage of errors
  uptime: number; // Percentage uptime
  issues: AIHealthIssue[];
}

export interface AIHealthIssue {
  type: "api_error" | "rate_limit" | "timeout" | "retrieval_error";
  message: string;
  startedAt: number;
  resolvedAt?: number;
  frequency: number;
}

/**
 * Analytics Summary Types
 */
export interface TokenUsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  averageTokensPerRequest: number;
  byModel: Record<string, {
    totalTokens: number;
    totalCost: number;
    requestCount: number;
  }>;
  byIntent: Record<Intent, {
    totalTokens: number;
    requestCount: number;
  }>;
  timeSeries: Array<{
    date: string;
    tokens: number;
    cost: number;
  }>;
}

export interface LatencySummary {
  averageTotalLatency: number;
  averageIntentDetectionTime: number;
  averageRetrievalTime: number;
  averageGenerationTime: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  timeoutCount: number;
  errorCount: number;
  successRate: number;
  timeSeries: Array<{
    date: string;
    averageLatency: number;
    successRate: number;
  }>;
}

export interface IntentDistributionSummary {
  totalMessages: number;
  byIntent: Array<{
    intent: Intent;
    count: number;
    percentage: number;
  }>;
  byCategory: Array<{
    category: IntentCategory;
    count: number;
    percentage: number;
  }>;
  byLanguage: Array<{
    language: "en" | "kn" | "mixed";
    count: number;
    percentage: number;
  }>;
  timeSeries: Array<{
    date: string;
    intents: Record<Intent, number>;
  }>;
  topQuestions: Array<{
    question: string;
    count: number;
    intent: Intent;
  }>;
}

export interface UnknownQuestionSummary {
  total: number;
  unreviewed: number;
  reviewed: number;
  addedToKnowledge: number;
  byIntent: Record<Intent, number>;
  recentQuestions: UnknownQuestionRecord[];
  feedbackDistribution: {
    helpful: number;
    not_helpful: number;
  };
  timeSeries: Array<{
    date: string;
    count: number;
  }>;
}

export interface AIAnalyticsDashboard {
  overview: {
    totalConversations: number;
    totalMessages: number;
    uniqueUsers: number;
    averageResponseTime: number;
    satisfactionRate: number;
    period: {
      start: number;
      end: number;
    };
  };
  tokenUsage: TokenUsageSummary;
  latency: LatencySummary;
  intentDistribution: IntentDistributionSummary;
  unknownQuestions: UnknownQuestionSummary;
  health: AIHealthStatus;
}

/**
 * Analytics API Request/Response Types
 */
export interface AnalyticsQueryParams {
  startDate?: number;
  endDate?: number;
  intent?: Intent;
  language?: "en" | "kn" | "mixed";
  sessionId?: string;
  limit?: number;
  offset?: number;
}

export interface HealthCheckResponse {
  status: AIHealthStatus;
  timestamp: number;
}

export interface TokenUsageResponse {
  summary: TokenUsageSummary;
  records: TokenUsageRecord[];
}

export interface LatencyResponse {
  summary: LatencySummary;
  records: LatencyRecord[];
}

export interface IntentDistributionResponse {
  summary: IntentDistributionSummary;
  records: IntentDistributionRecord[];
}

export interface UnknownQuestionsResponse {
  summary: UnknownQuestionSummary;
  records: UnknownQuestionRecord[];
}

export interface AnalyticsDashboardResponse {
  dashboard: AIAnalyticsDashboard;
}

/**
 * AI Settings for Analytics
 */
export interface AIAnalyticsSettings {
  enabled: boolean;
  trackTokenUsage: boolean;
  trackLatency: boolean;
  trackIntentDistribution: boolean;
  trackUnknownQuestions: boolean;
  retentionDays: number;
  alertThresholds: {
    maxLatency: number;
    maxErrorRate: number;
    maxDailyCost: number;
  };
}
