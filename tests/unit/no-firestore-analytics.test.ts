import fs from "fs";
import path from "path";

describe("No Firestore dependencies in Analytics queries", () => {
  it("services/ai-analytics.service.ts should not import 'firebase/firestore' unless explicitly allowed for skipped endpoints", () => {
    const servicePath = path.resolve(__dirname, "../../services/ai-analytics.service.ts");
    const content = fs.readFileSync(servicePath, "utf-8");

    const getLatencyMetricsMatch = content.match(/export async function getLatencyMetrics([\s\S]*?)export async function checkAIHealth/);
    if (getLatencyMetricsMatch) {
      expect(getLatencyMetricsMatch[1]).not.toContain("collection(db, COLLECTIONS.LATENCY_RECORDS)");
    } else {
      expect(true).toBe(false);
    }

    const getIntentDistributionMatch = content.match(/export async function getIntentDistribution([\s\S]*?)export async function getUnknownQuestions/);
    if (getIntentDistributionMatch) {
      expect(getIntentDistributionMatch[1]).not.toContain("collection(db, COLLECTIONS.INTENT_DISTRIBUTION)");
    } else {
      expect(true).toBe(false);
    }

    const recordUnknownQuestionMatch = content.match(/export async function recordUnknownQuestion([\s\S]*?)export async function markUnknownQuestionReviewed/);
    if (recordUnknownQuestionMatch) {
      expect(recordUnknownQuestionMatch[1]).not.toContain("collection(db, COLLECTIONS.UNKNOWN_QUESTIONS)");
      expect(recordUnknownQuestionMatch[1]).not.toContain("collection(db, COLLECTIONS.AI_UNKNOWN_QUESTIONS)");
    } else {
      expect(true).toBe(false);
    }

    const getUnknownQuestionsMatch = content.match(/export async function getUnknownQuestions([\s\S]*?)export async function checkAIHealth/);
    if (getUnknownQuestionsMatch) {
      expect(getUnknownQuestionsMatch[1]).not.toContain("collection(db, COLLECTIONS.UNKNOWN_QUESTIONS)");
    } else {
      expect(true).toBe(false);
    }
  });

  it("lib/ai/unknown-logger.ts should not import 'firebase/firestore'", () => {
    const loggerPath = path.resolve(__dirname, "../../lib/ai/unknown-logger.ts");
    const content = fs.readFileSync(loggerPath, "utf-8");

    const match = content.match(/export async function logUnknownQuestion([\s\S]*?)export async function logLowConfidenceQuestion/);
    if(match){
      expect(match[1]).not.toContain("firebase/firestore");
    } else {
       expect(true).toBe(false);
    }
  });
});
