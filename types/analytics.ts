/**
 * Analytics Types for Raya AI
 */

export interface UnknownQuestion {
  id?: string;
  question: string;
  detectedIntent: string;
  confidence: number;
  language: "en" | "kn" | "mixed";
  sessionId?: string;
  timestamp: Date;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationMetric {
  date: string;
  totalQueries: number;
  successfulQueries: number;
  fallbackQueries: number;
  unknownQuestions: number;
  averageConfidence: number;
  languageBreakdown: {
    en: number;
    kn: number;
    mixed: number;
  };
}

export interface IntentMetric {
  intent: string;
  count: number;
  averageConfidence: number;
  fallbackRate: number;
}
