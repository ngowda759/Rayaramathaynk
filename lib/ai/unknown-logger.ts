// Unknown Question Logger
// Logs questions that couldn't be answered for admin review

import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { UnknownQuestionLog } from "./retrieval/types";
import { Intent, RetrievalType } from "./intent/types";

const COLLECTION_NAME = "unknown_questions";

/**
 * Log an unknown or unanswerable question
 */
export async function logUnknownQuestion(
  question: string,
  sessionId: string,
  detectedIntent: Intent,
  confidence: number,
  language: "en" | "kn" | "mixed",
  options?: {
    userAgent?: string;
    ip?: string;
    expectedIntent?: Intent;
    error?: string;
  }
): Promise<string | null> {
  if (!isFirebaseConfigured() || !db) {
    console.log("[Unknown Question Logger] Firebase not configured, skipping log");
    return null;
  }

  try {
    const logEntry = {
      question: question.substring(0, 1000), // Limit length
      questionLower: question.toLowerCase().substring(0, 500),
      timestamp: serverTimestamp(),
      sessionId: sessionId.substring(0, 100),
      detectedIntent,
      confidence,
      language,
      userAgent: options?.userAgent?.substring(0, 500) || null,
      ip: options?.ip || null,
      expectedIntent: options?.expectedIntent || null,
      error: options?.error?.substring(0, 500) || null,
      reviewed: false,
      reviewedBy: null,
      reviewedAt: null,
      addedToKnowledge: false,
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), logEntry);
    console.log(`[Unknown Question Logger] Logged question: ${question.substring(0, 50)}...`);
    
    return docRef.id;
  } catch (error) {
    console.error("[Unknown Question Logger] Error logging question:", error);
    return null;
  }
}

/**
 * Log a low-confidence response
 */
export async function logLowConfidenceQuestion(
  question: string,
  sessionId: string,
  intent: Intent,
  confidence: number,
  source: RetrievalType,
  language: "en" | "kn" | "mixed"
): Promise<string | null> {
  // Only log if confidence is below threshold
  const LOW_CONFIDENCE_THRESHOLD = 50;
  
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) {
    return null;
  }

  return logUnknownQuestion(
    question,
    sessionId,
    intent,
    confidence,
    language,
    {
      expectedIntent: intent,
      error: `Low confidence response (${confidence}%) from ${source}`,
    }
  );
}

/**
 * Log when knowledge base lookup fails
 */
export async function logFailedKnowledgeLookup(
  question: string,
  sessionId: string,
  language: "en" | "kn" | "mixed"
): Promise<string | null> {
  return logUnknownQuestion(
    question,
    sessionId,
    Intent.UNKNOWN,
    0,
    language,
    {
      error: "No matching articles found in knowledge base",
    }
  );
}

/**
 * Get recent unknown questions for admin review
 */
export async function getRecentUnknownQuestions(
  limit = 20
): Promise<Array<{
  id: string;
  question: string;
  timestamp: Date;
  detectedIntent: string;
  confidence: number;
  language: string;
  reviewed: boolean;
}>> {
  if (!isFirebaseConfigured() || !db) {
    return [];
  }

  try {
    const { getDocs, query, collection, orderBy, limit: fbLimit } = await import("firebase/firestore");
    
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("timestamp", "desc"),
      fbLimit(limit)
    );

    const snapshot = await getDocs(q);
    const results: Array<{
      id: string;
      question: string;
      timestamp: Date;
      detectedIntent: string;
      confidence: number;
      language: string;
      reviewed: boolean;
    }> = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      results.push({
        id: doc.id,
        question: data.question,
        timestamp: data.timestamp?.toDate?.() || new Date(),
        detectedIntent: data.detectedIntent,
        confidence: data.confidence,
        language: data.language,
        reviewed: data.reviewed || false,
      });
    });

    return results;
  } catch (error) {
    console.error("[Unknown Question Logger] Error fetching questions:", error);
    return [];
  }
}

/**
 * Get question statistics
 */
export async function getUnknownQuestionStats(): Promise<{
  total: number;
  reviewed: number;
  unreviewed: number;
  byIntent: Record<string, number>;
  byLanguage: Record<string, number>;
}> {
  if (!isFirebaseConfigured() || !db) {
    return {
      total: 0,
      reviewed: 0,
      unreviewed: 0,
      byIntent: {},
      byLanguage: {},
    };
  }

  try {
    const { getDocs, query, collection } = await import("firebase/firestore");
    
    const q = query(collection(db, COLLECTION_NAME));
    const snapshot = await getDocs(q);

    let total = 0;
    let reviewed = 0;
    let unreviewed = 0;
    const byIntent: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      total++;
      
      if (data.reviewed) {
        reviewed++;
      } else {
        unreviewed++;
      }

      const intent = data.detectedIntent || "unknown";
      byIntent[intent] = (byIntent[intent] || 0) + 1;

      const lang = data.language || "en";
      byLanguage[lang] = (byLanguage[lang] || 0) + 1;
    });

    return { total, reviewed, unreviewed, byIntent, byLanguage };
  } catch (error) {
    console.error("[Unknown Question Logger] Error getting stats:", error);
    return {
      total: 0,
      reviewed: 0,
      unreviewed: 0,
      byIntent: {},
      byLanguage: {},
    };
  }
}
