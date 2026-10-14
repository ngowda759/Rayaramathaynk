// Unknown Question Logger
// Logs questions that couldn't be answered for admin review

import { UnknownQuestionLog } from "./retrieval/types";
import { Intent, RetrievalType } from "./intent/types";
import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";

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
  try {
    const supabase = typeof window === 'undefined' ? createAdminClient() : createClient();
    const { data: insertedData, error } = await supabase
      .from('unknown_questions')
      .insert([{
        question: question.substring(0, 1000),
        question_lower: question.toLowerCase().substring(0, 500),
        detected_intent: detectedIntent,
        confidence,
        language,
        session_id: sessionId.substring(0, 100),
        times_asked: 1,
        status: 'pending',
        assigned_to: 'unassigned',
        timestamp: new Date().toISOString(),
        notes: options?.error?.substring(0, 500) || null
      }])
      .select('id')
      .single();

    if (error) {
      console.error("[Unknown Question Logger] Error recording unknown question in Supabase:", error);
      return null;
    }

    console.log(`[Unknown Question Logger] Logged question: ${question.substring(0, 50)}...`);
    return insertedData.id;
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
  try {
    const supabase = typeof window === 'undefined' ? createAdminClient() : createClient();
    
    const { data: snapshot, error } = await supabase
      .from('unknown_questions')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[Unknown Question Logger] Error fetching from Supabase:", error);
      return [];
    }

    const results: Array<{
      id: string;
      question: string;
      timestamp: Date;
      detectedIntent: string;
      confidence: number;
      language: string;
      reviewed: boolean;
    }> = [];

    (snapshot || []).forEach((doc: any) => {
      results.push({
        id: doc.id,
        question: doc.question,
        timestamp: new Date(doc.timestamp),
        detectedIntent: doc.detected_intent,
        confidence: doc.confidence,
        language: doc.language,
        reviewed: doc.status !== 'pending' && doc.status !== 'unassigned',
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
  try {
    const supabase = typeof window === 'undefined' ? createAdminClient() : createClient();
    
    const { data: snapshot, error } = await supabase
      .from('unknown_questions')
      .select('*');

    if (error) {
      console.error("[Unknown Question Logger] Error querying stats from Supabase:", error);
      return { total: 0, reviewed: 0, unreviewed: 0, byIntent: {}, byLanguage: {} };
    }

    let total = 0;
    let reviewed = 0;
    let unreviewed = 0;
    const byIntent: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};

    (snapshot || []).forEach((doc: any) => {
      total++;
      
      const isReviewed = doc.status !== 'pending' && doc.status !== 'unassigned';
      if (isReviewed) {
        reviewed++;
      } else {
        unreviewed++;
      }

      const intent = doc.detected_intent || "unknown";
      byIntent[intent] = (byIntent[intent] || 0) + 1;

      const lang = doc.language || "en";
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
