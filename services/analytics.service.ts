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
    const docId = `${intent}_${today}`;

    // Simple increment using addDoc with timestamp
    // In production, use a transaction for atomic updates
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
