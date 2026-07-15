// AI Module - Central exports for AI functionality
// Refactored with hybrid retrieval architecture

// Intent Detection
export * from "./intent";

// Structured Retrieval
export * from "./retrieval";

// Knowledge Base
export {
  getKnowledgeContext,
  formatArticleForContext,
  formatArticlesForContext,
  getGreetingResponse,
  getClosingResponse,
  getOutOfScopeResponse,
  getThankYouResponse,
} from "./knowledge";

// Response Generator
export {
  generateResponse,
  detectIntent,
  getResponseMetadata,
} from "./generator";
export type { AIResponseResult } from "./generator";

// Unknown Question Logger
export {
  logUnknownQuestion,
  logLowConfidenceQuestion,
  logFailedKnowledgeLookup,
  getRecentUnknownQuestions,
  getUnknownQuestionStats,
} from "./unknown-logger";

// Refactored Prompts (for LLM when needed)
export {
  SYSTEM_PROMPT_V2,
  WELCOME_MESSAGE_V2,
  SUGGESTED_QUESTIONS_V2,
} from "./prompt-refactored";

// Legacy exports for backward compatibility
export { detectLanguage } from "./languageDetector";
export type { DetectedLanguage } from "@/types/ai";
