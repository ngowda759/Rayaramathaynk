// Behavioural test: the chat response generator must persist unknown questions
// through the Supabase-backed AI settings service, never through Firestore.
//
// A low-confidence question previously wrote to Firestore via
// `services/analytics.service.logUnknownQuestion` (a live in-scope Raya AI
// runtime path). This asserts the Supabase-only routing instead.

jest.mock("server-only", () => ({}), { virtual: true });

const mockLogUnknownQuestion = jest.fn().mockResolvedValue(undefined);
const mockGetAISettings = jest.fn().mockResolvedValue({
  general: { defaultLanguage: "en", botName: "Raya" },
  safety: { retrievalRequired: true, requireSourceForFacts: false },
  extendedBehavior: {
    confidenceThreshold: 0.6,
    maxKnowledgeResults: 3,
    enableUnknownQuestionLogging: true,
  },
  aiResponses: {
    unknownQuestion: "I don't know",
    welcome: "Hello",
    goodbye: "Bye",
    outOfScope: "Out of scope",
  },
});

jest.mock("@/lib/ai/ai-settings", () => ({
  aiSettingsService: {
    getAISettings: (...args: unknown[]) => mockGetAISettings(...args),
    logUnknownQuestion: (...args: unknown[]) => mockLogUnknownQuestion(...args),
  },
}));

// Keep the generator's other collaborators inert; they are not under test here.
jest.mock("@/lib/ai/retrieval", () => ({
  getContextForIntent: jest.fn().mockResolvedValue({ context: {}, sources: [] }),
}));

jest.mock("@/lib/ai/knowledge", () => ({
  getKnowledgeContext: jest.fn().mockResolvedValue({ articles: [] }),
}));

import { generateResponse } from "@/lib/ai/generator";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("generateResponse — unknown-question logging is Supabase-only", () => {
  it("logs a low-confidence question via the AI settings service", async () => {
    // "asdfghjkl" is detected as FAQ with very low confidence, which triggers
    // the FAQ fallback path where unknown questions are logged.
    const result = await generateResponse("asdfghjkl", "session-123");

    expect(result.content).toBe("I don't know");
    expect(mockLogUnknownQuestion).toHaveBeenCalledTimes(1);
    const [question, intent, confidence, language, sessionId] =
      mockLogUnknownQuestion.mock.calls[0];
    expect(question).toBe("asdfghjkl");
    expect(intent).toBe(result.intent);
    expect(typeof confidence).toBe("number");
    expect(language).toBe("en");
    expect(sessionId).toBe("session-123");
  });

  it("falls back to a non-empty session id when none is supplied", async () => {
    await generateResponse("asdfghjkl");
    expect(mockLogUnknownQuestion).toHaveBeenCalledTimes(1);
    const sessionId = mockLogUnknownQuestion.mock.calls[0][4];
    expect(sessionId).toBe("anonymous");
  });

  it("does not log when unknown-question logging is disabled", async () => {
    mockGetAISettings.mockResolvedValueOnce({
      general: { defaultLanguage: "en", botName: "Raya" },
      safety: { retrievalRequired: true, requireSourceForFacts: false },
      extendedBehavior: {
        confidenceThreshold: 0.6,
        maxKnowledgeResults: 3,
        enableUnknownQuestionLogging: false,
      },
      aiResponses: {
        unknownQuestion: "I don't know",
        welcome: "Hello",
        goodbye: "Bye",
        outOfScope: "Out of scope",
      },
    });

    await generateResponse("asdfghjkl", "session-123");
    expect(mockLogUnknownQuestion).not.toHaveBeenCalled();
  });
});
