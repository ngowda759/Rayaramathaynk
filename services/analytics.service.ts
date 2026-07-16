/**
 * Analytics Service for Raya AI
 * Logs unknown questions and conversation metrics to Firestore
 */

import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import type { UnknownQuestion, ConversationMetric, IntentMetric } from "@/types/analytics";

const UNKNOWN_QUESTIONS_COLLECTION = "unknown_questions";
const METRICS_COLLECTION = "chat_metrics";
const INTENT_METRICS_COLLECTION = "intent_metrics";

/**
 * Log an unknown question with low confidence
 */
export async function logUnknownQuestion(data: {
  question: string;
  detectedIntent: string;
  confidence: number;
  language: "en" | "kn" | "mixed";
  sessionId?: string;
  userAgent?: string;
}): Promise<string | null> {
  if (!db) {
    console.warn("[Analytics] Firestore not initialized, skipping logging");
    return null;
  }

  try {
    const docRef = await addDoc(collection(db, UNKNOWN_QUESTIONS_COLLECTION), {
      ...data,
      timestamp: serverTimestamp(),
      processed: false,
    });
    console.log(`[Analytics] Logged unknown question: ${data.question.substring(0, 50)}...`);
    return docRef.id;
  } catch (error) {
    console.error("[Analytics] Failed to log unknown question:", error);
    return null;
  }
}

/**
 * Log a conversation metric
 */
export async function logConversationMetric(data: Partial<ConversationMetric>): Promise<void> {
  if (!db) {
    console.warn("[Analytics] Firestore not initialized, skipping metric logging");
    return;
  }

  try {
    await addDoc(collection(db, METRICS_COLLECTION), {
      ...data,
      timestamp: serverTimestamp(),
      date: new Date().toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("[Analytics] Failed to log conversation metric:", error);
  }
}

/**
 * Get recent unknown questions for review
 */
export async function getRecentUnknownQuestions(count = 20): Promise<UnknownQuestion[]> {
  if (!db) {
    console.warn("[Analytics] Firestore not initialized");
    return [];
  }

  try {
    const q = query(
      collection(db, UNKNOWN_QUESTIONS_COLLECTION),
      orderBy("timestamp", "desc"),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    })) as UnknownQuestion[];
  } catch (error) {
    console.error("[Analytics] Failed to get unknown questions:", error);
    return [];
  }
}

/**
 * Get unknown question statistics
 */
export async function getUnknownQuestionStats(): Promise<{
  total: number;
  today: number;
  thisWeek: number;
  topIntents: Array<{ intent: string; count: number }>;
}> {
  if (!db) {
    return { total: 0, today: 0, thisWeek: 0, topIntents: [] };
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const q = query(
      collection(db, UNKNOWN_QUESTIONS_COLLECTION),
      orderBy("timestamp", "desc"),
      limit(1000)
    );
    const snapshot = await getDocs(q);

    interface UnknownQuestionDoc {
  detectedIntent?: string;
  timestamp?: Date;
}

const docs: UnknownQuestionDoc[] = snapshot.docs.map((doc) => ({
  ...doc.data(),
  timestamp: doc.data().timestamp?.toDate() || new Date(),
}));

const total = docs.length;
const today = docs.filter(
  (d) => d.timestamp && d.timestamp >= todayStart
).length;
const thisWeek = docs.filter(
  (d) => d.timestamp && d.timestamp >= weekStart
).length;

// Count by intent
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

/**
 * Log intent usage for analytics
 */
export async function logIntentUsage(
  intent: string,
  confidence: number,
  usedFallback: boolean
): Promise<void> {
  if (!db) return;

  try {
    const today = new Date().toISOString().split("T")[0];

    await addDoc(collection(db, INTENT_METRICS_COLLECTION), {
      intent,
      confidence,
      usedFallback,
      date: today,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("[Analytics] Failed to log intent usage:", error);
  }
}

// ============ Phase 3: Analytics Dashboard Features ============

const INTENT_FEEDBACK_COLLECTION = "intent_feedback";

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

/**
 * Log intent feedback (admin correction)
 */
export async function logIntentFeedback(feedback: IntentFeedback): Promise<string | null> {
  if (!db) {
    console.warn("[Analytics] Firestore not initialized, skipping feedback");
    return null;
  }

  try {
    const docRef = await addDoc(collection(db, INTENT_FEEDBACK_COLLECTION), {
      question: feedback.question,
      detectedIntent: feedback.detectedIntent,
      correctIntent: feedback.correctIntent,
      isCorrect: feedback.isCorrect,
      sessionId: feedback.sessionId,
      timestamp: serverTimestamp(),
      adminId: feedback.adminId || "system",
      notes: feedback.notes || "",
    });

    console.log(`[Analytics] Logged intent feedback: ${feedback.isCorrect ? "correct" : "incorrect"}`);
    return docRef.id;
  } catch (error) {
    console.error("[Analytics] Failed to log intent feedback:", error);
    return null;
  }
}

/**
 * Get intent feedback statistics
 */
export async function getIntentFeedbackStats(): Promise<{
  totalFeedback: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  topCorrections: Array<{ detectedIntent: string; correctIntent: string; count: number }>;
}> {
  if (!db) {
    return { totalFeedback: 0, correctCount: 0, incorrectCount: 0, accuracy: 0, topCorrections: [] };
  }

  try {
    const q = query(
      collection(db, INTENT_FEEDBACK_COLLECTION),
      orderBy("timestamp", "desc"),
      limit(500)
    );
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map((doc) => doc.data());

    const totalFeedback = docs.length;
    const correctCount = docs.filter((d) => d.isCorrect).length;
    const incorrectCount = docs.filter((d) => !d.isCorrect).length;
    const accuracy = totalFeedback > 0 ? (correctCount / totalFeedback) * 100 : 0;

    // Count top corrections (incorrect detections)
    const correctionCounts: Record<string, { detectedIntent: string; correctIntent: string; count: number }> = {};
    docs.filter((d) => !d.isCorrect).forEach((d) => {
      const key = `${d.detectedIntent}->${d.correctIntent}`;
      if (!correctionCounts[key]) {
        correctionCounts[key] = {
          detectedIntent: d.detectedIntent,
          correctIntent: d.correctIntent,
          count: 0,
        };
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

/**
 * Get fallback rate metrics
 */
export async function getFallbackRateMetrics(): Promise<{
  totalResponses: number;
  fallbackResponses: number;
  fallbackRate: number;
  byDay: Array<{ date: string; total: number; fallback: number; rate: number }>;
}> {
  if (!db) {
    return { totalResponses: 0, fallbackResponses: 0, fallbackRate: 0, byDay: [] };
  }

  try {
    const q = query(
      collection(db, INTENT_METRICS_COLLECTION),
      orderBy("timestamp", "desc"),
      limit(1000)
    );
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map((doc) => ({
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    })) as Array<{ date: string; usedFallback: boolean; timestamp?: Date }>;

    const totalResponses = docs.length;
    const fallbackResponses = docs.filter((d) => d.usedFallback).length;
    const fallbackRate = totalResponses > 0 ? (fallbackResponses / totalResponses) * 100 : 0;

    // Group by day
    const byDayMap: Record<string, { total: number; fallback: number }> = {};
    docs.forEach((d) => {
      const date = d.date;
      if (!byDayMap[date]) {
        byDayMap[date] = { total: 0, fallback: 0 };
      }
      byDayMap[date].total++;
      if (d.usedFallback) {
        byDayMap[date].fallback++;
      }
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

/**
 * Get complete analytics summary for admin dashboard
 */
export async function getAnalyticsSummary(): Promise<{
  unknownQuestions: {
    total: number;
    today: number;
    thisWeek: number;
  };
  intentAccuracy: {
    total: number;
    correct: number;
    accuracy: number;
  };
  fallbackRate: {
    total: number;
    fallback: number;
    rate: number;
  };
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
