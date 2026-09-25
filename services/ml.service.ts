/**
 * ML Service for Raya AI
 * Provides semantic similarity, fuzzy matching, and learning from corrections
 */

import type { Intent } from "@/lib/ai/intent/types";
import { logIntentFeedback } from "@/services/analytics.service";

/**
 * Semantic similarity result
 */
export interface SemanticMatch {
  intent: Intent;
  similarity: number;
  matchedWords: string[];
}

/**
 * Fuzzy match result
 */
export interface FuzzyMatch {
  original: string;
  corrected: string;
  confidence: number;
  distance: number;
}

/**
 * Learning correction entry
 */
export interface CorrectionEntry {
  question: string;
  originalIntent: Intent;
  correctedIntent: Intent;
  frequency: number;
  lastUpdated: Date;
}

// In-memory correction cache (in production, use Firestore)
const correctionCache: Map<string, CorrectionEntry> = new Map();
const MAX_CACHE_SIZE = 1000;

// ============ Semantic Similarity ============

/**
 * Word tokenization and normalization
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1);
}

/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Calculate weighted word overlap similarity
 */
function weightedOverlap(tokens1: string[], tokens2: string[], weights: Map<string, number>): number {
  if (tokens1.length === 0 && tokens2.length === 0) return 0;
  
  let score = 0;
  let maxScore = 0;
  
  const seen = new Set<string>();
  
  for (const token of tokens1) {
    const weight = weights.get(token) || 1;
    maxScore += weight;
    if (tokens2.includes(token) && !seen.has(token)) {
      score += weight;
      seen.add(token);
    }
  }
  
  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Intent-specific keywords with weights
 * Higher weight = more important for that intent
 */
const INTENT_WEIGHTS: Record<string, Map<string, number>> = {
  TEMPLE_TIMINGS: new Map([
    ['timing', 3], ['timings', 3], ['time', 2], ['open', 2], ['close', 2],
    ['morning', 2], ['evening', 2], ['schedule', 2], ['hour', 1],
    ['ಸಮಯ', 3], ['ತೆರೆಯಲು', 2], ['ಮುಚ್ಚಲು', 2]
  ]),
  DONATION: new Map([
    ['donate', 3], ['donation', 3], ['contribute', 3], ['contribution', 3],
    ['bank', 2], ['account', 2], ['upi', 2], ['online', 1],
    ['ದಾನ', 3], ['ಕೊಡುವುದು', 2]
  ]),
  SPECIAL_SEVAS: new Map([
    ['seva', 3], ['sevas', 3], ['service', 2], ['pooja', 2], ['puja', 2],
    ['archana', 3], ['booking', 2], ['register', 2],
    ['ಸೇವೆ', 3], ['ಪೂಜೆ', 2]
  ]),
  UPCOMING_EVENTS: new Map([
    ['event', 3], ['events', 3], ['upcoming', 3], ['next', 2], ['schedule', 2],
    ['happening', 2], ['program', 2],
    ['ಕಾರ್ಯಕ್ರಮ', 3], ['ಹಬ್ಬ', 2]
  ]),
  LOCATION: new Map([
    ['location', 3], ['where', 3], ['located', 2], ['directions', 3],
    ['reach', 2], ['map', 2], ['address', 2],
    ['ಎಲ್ಲಿ', 3], ['ಸ್ಥಳ', 2]
  ]),
};

/**
 * Calculate semantic similarity to intents
 */
export function calculateIntentSimilarity(message: string): SemanticMatch[] {
  const tokens = tokenize(message);
  if (tokens.length === 0) return [];
  
  const results: SemanticMatch[] = [];
  
  for (const [intentName, weights] of Object.entries(INTENT_WEIGHTS)) {
    const intent = intentName as Intent;
    const weightKeys = Array.from(weights.keys());
    
    // Calculate weighted overlap between message tokens and intent keywords
    const weightedScore = weightedOverlap(tokens, weightKeys, weights);
    const jaccardScore = jaccardSimilarity(
      new Set(tokens),
      new Set(weightKeys)
    );
    
    // Combined score (weighted more heavily on intent-specific terms)
    const similarity = (weightedScore * 0.7) + (jaccardScore * 0.3);
    
    if (similarity > 0) {
      results.push({
        intent,
        similarity: similarity * 100,
        matchedWords: tokens.filter(t => weights.has(t)),
      });
    }
  }
  
  return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Get best semantic match for a message
 */
export function getBestSemanticMatch(message: string): SemanticMatch | null {
  const matches = calculateIntentSimilarity(message);
  return matches.length > 0 ? matches[0] : null;
}

// ============ Fuzzy Matching ============

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return dp[m][n];
}

/**
 * Calculate similarity ratio from distance
 */
function distanceToSimilarity(distance: number, maxLength: number): number {
  if (maxLength === 0) return 100;
  return Math.max(0, (1 - distance / maxLength) * 100);
}

/**
 * Common typo dictionary for temple-related terms
 */
const TYPO_CORRECTIONS: Record<string, string> = {
  // English typos
  'timings': 'timings',
  'timing': 'timings',
  'timmings': 'timings',
  'timmimg': 'timings',
  'pooja': 'pooja',
  'puja': 'pooja',
  'poojas': 'poojas',
  'seva': 'seva',
  'sevas': 'sevas',
  'sewav': 'seva',
  'donation': 'donation',
  'donate': 'donate',
  'donat': 'donate',
  'donatton': 'donation',
  'aradhana': 'aaradhane',
  'aaradhana': 'aaradhane',
  'aradhane': 'aaradhane',
  'raghavendra': 'raghavendra',
  'raghavendhra': 'raghavendra',
  'raghavendray': 'raghavendra',
  'mantralaya': 'mantralaya',
  'mantralya': 'mantralaya',
  'darshan': 'darshan',
  'darsana': 'darshan',
  'darsanam': 'darshan',
  'prashad': 'prasada',
  'prasadam': 'prasada',
  'prasada': 'prasada',
  'swamy': 'swami',
  'swami': 'swami',
  'guru': 'guru',
  'guruv': 'guru',
  'bangalore': 'bengaluru',
  'bengalore': 'bengaluru',
};

/**
 * Find fuzzy match for a word
 */
export function fuzzyMatch(word: string): FuzzyMatch {
  const lowerWord = word.toLowerCase();
  
  // Check typo dictionary first
  if (TYPO_CORRECTIONS[lowerWord]) {
    const isCorrected = lowerWord !== TYPO_CORRECTIONS[lowerWord];
    return {
      original: word,
      corrected: TYPO_CORRECTIONS[lowerWord],
      confidence: isCorrected ? 80 : 100, // Lower confidence for actual corrections
      distance: isCorrected ? 1 : 0,
    };
  }
  
  // Find closest match
  let bestMatch = lowerWord;
  let bestDistance = Infinity;
  let bestConfidence = 0;
  
  for (const [typo, correction] of Object.entries(TYPO_CORRECTIONS)) {
    const distance = levenshteinDistance(lowerWord, typo);
    const similarity = distanceToSimilarity(distance, Math.max(lowerWord.length, typo.length));
    
    if (distance < bestDistance && distance <= Math.ceil(lowerWord.length / 3)) {
      bestDistance = distance;
      bestMatch = correction;
      bestConfidence = similarity;
    }
  }
  
  // If no good match found, return original
  if (bestConfidence < 50) {
    return {
      original: word,
      corrected: word,
      confidence: 100,
      distance: 0,
    };
  }
  
  return {
    original: word,
    corrected: bestMatch,
    confidence: bestConfidence,
    distance: bestDistance,
  };
}

/**
 * Auto-correct typos in a message
 */
export function autoCorrectMessage(message: string): {
  corrected: string;
  corrections: FuzzyMatch[];
} {
  const words = message.split(/\s+/);
  const corrections: FuzzyMatch[] = [];
  const correctedWords: string[] = [];
  
  for (const word of words) {
    const cleanWord = word.replace(/[^\w]/g, '');
    if (cleanWord.length < 3) {
      correctedWords.push(word);
      continue;
    }
    
    const match = fuzzyMatch(cleanWord);
    corrections.push(match);
    
    if (match.confidence < 100) {
      // Replace with correction, preserving original punctuation
      correctedWords.push(word.replace(cleanWord, match.corrected));
    } else {
      correctedWords.push(word);
    }
  }
  
  return {
    corrected: correctedWords.join(' '),
    corrections,
  };
}

// ============ Learning from Corrections ============

/**
 * Normalize question for matching
 */
function normalizeQuestion(question: string): string {
  return question.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Generate cache key for a question
 */
function getQuestionKey(question: string): string {
  return normalizeQuestion(question);
}

/**
 * Learn from an intent correction
 * Stores the corrected intent for future reference
 */
export async function learnFromCorrection(
  question: string,
  originalIntent: Intent,
  correctedIntent: Intent
): Promise<void> {
  const key = getQuestionKey(question);
  
  // Check if already exists
  const existing = correctionCache.get(key);
  
  if (existing) {
    // Update frequency and potentially change intent if consistently corrected
    existing.frequency++;
    existing.lastUpdated = new Date();
    
    // If corrected more than twice, adopt the correction
    if (existing.frequency >= 2 && existing.correctedIntent !== correctedIntent) {
      existing.correctedIntent = correctedIntent;
    }
  } else {
    // Add new entry
    if (correctionCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry
      const oldestKey = correctionCache.keys().next().value;
      if (oldestKey) correctionCache.delete(oldestKey);
    }
    
    correctionCache.set(key, {
      question,
      originalIntent,
      correctedIntent,
      frequency: 1,
      lastUpdated: new Date(),
    });
  }
  
  // Also log to analytics for persistence
  try {
    await logIntentFeedback({
      question,
      detectedIntent: originalIntent,
      correctIntent: correctedIntent,
      isCorrect: false,
    });
  } catch (error) {
    console.warn("[ML Service] Failed to log correction to analytics:", error);
  }
}

/**
 * Get corrected intent for a question
 * Returns the learned intent if available
 */
export function getCorrectedIntent(question: string): Intent | null {
  const key = getQuestionKey(question);
  const entry = correctionCache.get(key);
  
  if (entry && entry.frequency >= 2) {
    return entry.correctedIntent;
  }
  
  return null;
}

/**
 * Get all learned corrections
 */
export function getLearnedCorrections(): CorrectionEntry[] {
  return Array.from(correctionCache.values())
    .filter(entry => entry.frequency >= 2)
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Clear learned corrections (for testing/reset)
 */
export function clearLearnedCorrections(): void {
  correctionCache.clear();
}

/**
 * Get correction count
 */
export function getCorrectionCount(): number {
  return correctionCache.size;
}

/**
 * Export corrections for training data
 */
export function exportCorrections(): Array<{
  question: string;
  intent: string;
  frequency: number;
}> {
  return getLearnedCorrections().map(entry => ({
    question: entry.question,
    intent: entry.correctedIntent,
    frequency: entry.frequency,
  }));
}
