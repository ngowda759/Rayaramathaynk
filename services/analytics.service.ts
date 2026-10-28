/**
 * Analytics Service for Raya AI
 *
 * Logs unknown questions, conversation metrics, intent usage and admin feedback in
 * Supabase (`unknown_questions`, `chat_metrics`, `intent_metrics`, `intent_feedback`).
 * These tables are deny-all under RLS, so every read and write uses the service-role
 * admin client. There is no Firestore path.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { UnknownQuestion } from "@/types/analytics";

const UNKNOWN_QUESTIONS_TABLE = "unknown_questions";
const METRICS_TABLE = "chat_metrics";
const INTENT_METRICS_TABLE = "intent_metrics";
const INTENT_FEEDBACK_TABLE = "intent_feedback";

/** Log an unknown question with low confidence. */
export async function logUnknownQuestion(data: {
  question: string;
  detectedIntent: string;
  confidence: number;
  language: "en" | "kn" | "mixed";
  sessionId?: string;
  userAgent?: string;
}): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from(UNKNOWN_QUESTIONS_TABLE)
      .insert({
        question: data.question,
        question_lower: data.question.toLowerCase(),
        detected_intent: data.detectedIntent,
        confidence: data.confidence,
        language: data.language,
        session_id: data.sessionId ?? null,
        notes: data.userAgent ?? null,
        status: "new",
        times_asked: 1,
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(error.message);
    return row.firestore_id || row.id;
  } catch (error) {
    console.error("[Analytics] Failed to log unknown question:", error);
    return null;
  }
}

/** Log a conversation metric. */
export async function logConversationMetric(data: Record<string, unknown>): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from(METRICS_TABLE).insert({
      metric_date: new Date().toISOString().split("T")[0],
      ...data,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("[Analytics] Failed to log conversation metric:", error);
  }
}

/** Get recent unknown questions for review. */
export async function getRecentUnknownQuestions(count = 20): Promise<UnknownQuestion[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(UNKNOWN_QUESTIONS_TABLE)
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(count);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({
      id: row.firestore_id || row.id,
      question: row.question,
      detectedIntent: row.detected_intent,
      confidence: row.confidence,
      language: row.language,
      sessionId: row.session_id,
      timestamp: row.timestamp ? new Date(row.timestamp) : new Date(),
    })) as UnknownQuestion[];
  } catch (error) {
    console.error("[Analytics] Failed to get unknown questions:", error);
    return [];
  }
}

/** Get unknown question statistics. */
export async function getUnknownQuestionStats(): Promise<{
  total: number;
  today: number;
  thisWeek: number;
  topIntents: Array<{ intent: string; count: number }>;
}> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(UNKNOWN_QUESTIONS_TABLE)
      .select("detected_intent, timestamp")
      .order("timestamp", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const docs = (data ?? []).map((row: any) => ({
      detectedIntent: row.detected_intent,
      timestamp: row.timestamp ? new Date(row.timestamp) : new Date(),
    }));

    const total = docs.length;
    const today = docs.filter((d) => d.timestamp >= todayStart).length;
    const thisWeek = docs.filter((d) => d.timestamp >= weekStart).length;

    const intentCounts: Record<string, number> = {};
    docs.forEach((d) => {
      const intent = d.detectedIntent || "UNKNOWN";
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    });
    const topIntents = Object.entries(intentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([intent, count]) => ({ intent, count }));

    return { total, today, thisWeek, topIntents };
  } catch (error) {
    console.error("[Analytics] Failed to get stats:", error);
    return { total: 0, today: 0, thisWeek: 0, topIntents: [] };
  }
}

/** Log intent usage for analytics. */
export async function logIntentUsage(
  intent: string,
  confidence: number,
  usedFallback: boolean
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from(INTENT_METRICS_TABLE).insert({
      intent,
      confidence,
      used_fallback: usedFallback,
      metric_date: new Date().toISOString().split("T")[0],
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("[Analytics] Failed to log intent usage:", error);
  }
}

export interface IntentFeedback {
  id?: string;
  question: string;
  detectedIntent: string;
  correctIntent: string;
  isCorrect: boolean;
  sessionId?: string;
  timestamp?: Date;
  adminId?: string;
  notes?: string;
}

/** Log intent feedback (admin correction). */
export async function logIntentFeedback(feedback: IntentFeedback): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from(INTENT_FEEDBACK_TABLE)
      .insert({
        question: feedback.question,
        detected_intent: feedback.detectedIntent,
        correct_intent: feedback.correctIntent,
        is_correct: feedback.isCorrect,
        session_id: feedback.sessionId ?? null,
        admin_id: feedback.adminId || "system",
        notes: feedback.notes || "",
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(error.message);
    return row.firestore_id || row.id;
  } catch (error) {
    console.error("[Analytics] Failed to log intent feedback:", error);
    return null;
  }
}

/** Get intent feedback statistics. */
export async function getIntentFeedbackStats(): Promise<{
  totalFeedback: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  topCorrections: Array<{ detectedIntent: string; correctIntent: string; count: number }>;
}> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(INTENT_FEEDBACK_TABLE)
      .select("detected_intent, correct_intent, is_correct")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const docs = (data ?? []).map((row: any) => ({
      detectedIntent: row.detected_intent,
      correctIntent: row.correct_intent,
      isCorrect: row.is_correct,
    }));

    const totalFeedback = docs.length;
    const correctCount = docs.filter((d) => d.isCorrect).length;
    const incorrectCount = docs.filter((d) => !d.isCorrect).length;
    const accuracy = totalFeedback > 0 ? (correctCount / totalFeedback) * 100 : 0;

    const correctionCounts: Record<string, { detectedIntent: string; correctIntent: string; count: number }> = {};
    docs.filter((d) => !d.isCorrect).forEach((d) => {
      const key = `${d.detectedIntent}->${d.correctIntent}`;
      if (!correctionCounts[key]) {
        correctionCounts[key] = { detectedIntent: d.detectedIntent, correctIntent: d.correctIntent, count: 0 };
      }
      correctionCounts[key].count++;
    });

    const topCorrections = Object.values(correctionCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { totalFeedback, correctCount, incorrectCount, accuracy, topCorrections };
  } catch (error) {
    console.error("[Analytics] Failed to get feedback stats:", error);
    return { totalFeedback: 0, correctCount: 0, incorrectCount: 0, accuracy: 0, topCorrections: [] };
  }
}

/** Get fallback rate metrics. */
export async function getFallbackRateMetrics(): Promise<{
  totalResponses: number;
  fallbackResponses: number;
  fallbackRate: number;
  byDay: Array<{ date: string; total: number; fallback: number; rate: number }>;
}> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(INTENT_METRICS_TABLE)
      .select("metric_date, used_fallback")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);

    const docs = (data ?? []).map((row: any) => ({
      date: row.metric_date,
      usedFallback: row.used_fallback,
    }));

    const totalResponses = docs.length;
    const fallbackResponses = docs.filter((d) => d.usedFallback).length;
    const fallbackRate = totalResponses > 0 ? (fallbackResponses / totalResponses) * 100 : 0;

    const byDayMap: Record<string, { total: number; fallback: number }> = {};
    docs.forEach((d) => {
      const date = d.date;
      if (!byDayMap[date]) byDayMap[date] = { total: 0, fallback: 0 };
      byDayMap[date].total++;
      if (d.usedFallback) byDayMap[date].fallback++;
    });

    const byDay = Object.entries(byDayMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 14)
      .map(([date, data]) => ({
        date,
        total: data.total,
        fallback: data.fallback,
        rate: data.total > 0 ? (data.fallback / data.total) * 100 : 0,
      }));

    return { totalResponses, fallbackResponses, fallbackRate, byDay };
  } catch (error) {
    console.error("[Analytics] Failed to get fallback metrics:", error);
    return { totalResponses: 0, fallbackResponses: 0, fallbackRate: 0, byDay: [] };
  }
}

/** Get complete analytics summary for the admin dashboard. */
export async function getAnalyticsSummary(): Promise<{
  unknownQuestions: { total: number; today: number; thisWeek: number };
  intentAccuracy: { total: number; correct: number; accuracy: number };
  fallbackRate: { total: number; fallback: number; rate: number };
  topIntents: Array<{ intent: string; count: number }>;
  topCorrections: Array<{ detectedIntent: string; correctIntent: string; count: number }>;
}> {
  const [unknownStats, feedbackStats, fallbackStats] = await Promise.all([
    getUnknownQuestionStats(),
    getIntentFeedbackStats(),
    getFallbackRateMetrics(),
  ]);

  return {
    unknownQuestions: {
      total: unknownStats.total,
      today: unknownStats.today,
      thisWeek: unknownStats.thisWeek,
    },
    intentAccuracy: {
      total: feedbackStats.totalFeedback,
      correct: feedbackStats.correctCount,
      accuracy: feedbackStats.accuracy,
    },
    fallbackRate: {
      total: fallbackStats.totalResponses,
      fallback: fallbackStats.fallbackResponses,
      rate: fallbackStats.fallbackRate,
    },
    topIntents: unknownStats.topIntents,
    topCorrections: feedbackStats.topCorrections,
  };
}
