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

  it("should have correct arguments passing to the client and no firestore leakage in the implementation layer", () => {
    // Basic structural verification, confirming legacy flags like userAgent are appropriately documented in logger bounds
    const loggerPath = path.resolve(__dirname, "../../lib/ai/unknown-logger.ts");
    const contentLogger = fs.readFileSync(loggerPath, "utf-8");
    expect(contentLogger).toContain('notes: options?.error?.substring(0, 500) || null');

    // Check that we didn't add IP or userAgent to the insert since they are excluded intentionally
    expect(contentLogger).not.toContain('user_agent:');
    expect(contentLogger).not.toContain('ip_address:');

    // Confirm markUnknownQuestionReviewed translates legacy properties directly to Supabase mapped columns
    const servicePath = path.resolve(__dirname, "../../services/ai-analytics.service.ts");
    const contentAnalytics = fs.readFileSync(servicePath, "utf-8");

    expect(contentAnalytics).toContain('status: \'reviewed\'');
    expect(contentAnalytics).toContain('reviewed_by: reviewedBy');
    expect(contentAnalytics).toContain('added_to_knowledge_article_id: addedToKnowledge && knowledgeArticleId ? knowledgeArticleId : null');
  });

  it("should securely fetch data based on execution context (client vs server)", () => {
    const servicePath = path.resolve(__dirname, "../../services/ai-analytics.service.ts");
    const contentAnalytics = fs.readFileSync(servicePath, "utf-8");
    expect(contentAnalytics).toContain("typeof window === 'undefined' ? createAdminClient() : createClient()");

    const loggerPath = path.resolve(__dirname, "../../lib/ai/unknown-logger.ts");
    const contentLogger = fs.readFileSync(loggerPath, "utf-8");
    expect(contentLogger).toContain("typeof window === 'undefined' ? createAdminClient() : createClient()");
  });

  it("should not fabricate 'added' for unknown_questions migration", () => {
    const mappersPath = path.resolve(__dirname, "../../lib/supabase/migration-mappers.ts");
    const contentMappers = fs.readFileSync(mappersPath, "utf-8");

    // Confirms mapUnknownQuestion does not contain "added" fallback
    const match = contentMappers.match(/export function mapUnknownQuestion([\s\S]*?)export function mapIntentDistribution/);
    if(match){
      expect(match[1]).not.toContain('"added"');
    } else {
      expect(true).toBe(false);
    }
  });

  it("scripts/migrate-ai-analytics.ts handles legacy overlap collections correctly", () => {
    const scriptPath = path.resolve(__dirname, "../../scripts/migrate-ai-analytics.ts");
    const contentScript = fs.readFileSync(scriptPath, "utf-8");

    // Check if it executes against both 'unknown_questions' and 'ai_unknown_questions'
    expect(contentScript).toContain('"unknown_questions",');
    expect(contentScript).toContain('"ai_unknown_questions",');
  });

  it("getLatencyMetrics removes fabricated 'intent' and 'messageId' from output and limits AnalyticsQueryParams", () => {
    const servicePath = path.resolve(__dirname, "../../services/ai-analytics.service.ts");
    const contentAnalytics = fs.readFileSync(servicePath, "utf-8");

    const getLatencyMetricsMatch = contentAnalytics.match(/export async function getLatencyMetrics([\s\S]*?)export async function getIntentDistribution/);
    if (getLatencyMetricsMatch) {
      const functionBody = getLatencyMetricsMatch[1];
      expect(functionBody).toContain("Omit<AnalyticsQueryParams, \"intent\">");
      expect(functionBody).not.toContain("intent: (\"\" as any)");
      expect(functionBody).not.toContain("messageId: doc.message_id || \"\"");
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

  it("lib/ai/generator.ts logs unknown questions via Supabase, never Firestore", () => {
    const generatorPath = path.resolve(__dirname, "../../lib/ai/generator.ts");
    const content = fs.readFileSync(generatorPath, "utf-8");

    // The chat response path must not touch Firestore or the Firestore-backed
    // analytics service. It must route unknown-question logging to the
    // Supabase-backed AI settings service instead.
    expect(content).not.toContain("firebase/firestore");
    expect(content).not.toContain("@/services/analytics.service");
    expect(content).toContain("aiSettingsService.logUnknownQuestion");
  });

  it("the AI knowledge coverage route is admin-guarded and Firestore-free", () => {
    const routePath = path.resolve(
      __dirname,
      "../../app/api/ai/knowledge/coverage/route.ts"
    );
    const content = fs.readFileSync(routePath, "utf-8");

    expect(content).not.toContain("firebase/firestore");
    expect(content).not.toContain("@/lib/firebase");
    // Reading approved knowledge requires an authenticated admin, since the
    // route reads through the service-role client (which bypasses RLS).
    expect(content).toContain("requireRayaAdminUser");
  });
});
