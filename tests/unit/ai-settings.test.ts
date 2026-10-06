import { describe, it, expect } from "@jest/globals";
import { AISettingsSchema, AIGeneralSettingsSchema } from "../../lib/ai/ai-settings/validation";

describe("AI Settings Validation", () => {
  it("should validate a correct general settings object", () => {
    const validData = {
      enabled: true,
      botName: "Raya AI",
      botSubtitle: "Official Temple Assistant",
      welcomeMessage: "Namaskara!",
      closingMessage: "Goodbye!",
      defaultLanguage: "en",
      supportedLanguages: ["en", "kn"],
    };

    const result = AIGeneralSettingsSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject invalid general settings (missing fields)", () => {
    const invalidData = {
      enabled: true,
      botName: "Raya AI",
      // missing botSubtitle etc.
    };

    const result = AIGeneralSettingsSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should validate full AISettings payload", () => {
    const fullPayload = {
      id: "main",
      general: {
        enabled: true,
        botName: "Raya AI",
        botSubtitle: "Assistant",
        welcomeMessage: "Hello",
        closingMessage: "Bye",
        defaultLanguage: "en",
        supportedLanguages: ["en"],
      },
      safety: {
        retrievalRequired: true,
        allowLLMOnlyResponse: false,
        requireSourceForFacts: true,
        unknownQuestionBehaviour: "fallback",
        outOfScopeBehaviour: "fallback",
      },
      extendedBehavior: {
        confidenceThreshold: 0.8,
        semanticThreshold: 0.7,
        maxRelatedArticles: 3,
        conversationTimeout: 30,
        streaming: false,
        debugMode: false,
        unknownLogging: true,
        enableFollowUpContext: true,
        enableSuggestedQuestions: true,
        enableAnalytics: true,
        enableUnknownQuestionLogging: true,
        enableDebugMode: false,
        maxKnowledgeResults: 3,
      },
      templeInformation: {
        timings: { morningOpen: "6", morningClose: "12", eveningOpen: "5", eveningClose: "8" },
        contact: { phone: "123", email: "e@e.com", address: "abc" },
        officeHours: { weekday: "9-5", weekend: "10-4" },
      },
      visitorInformation: {
        guidelines: "a", dressCode: "a", photographyPolicy: "a", parking: "a",
        facilities: "a", wheelchairAccess: "a", drinkingWater: "a", restrooms: "a",
        prasada: "a", annadanam: "a", accommodation: "a", volunteerInfo: "a",
        testimonials: "a", contact: "a",
      },
      templePolicies: {
        donations: "a", information80G: "a", sevaBooking: "a", onlineServices: "a",
        childrenPolicy: "a", queueGuidelines: "a",
      },
      aiResponses: {
        greeting: "a", welcome: "a", fallback: "a", unknownQuestion: "a",
        outOfScope: "a", goodbye: "a",
      },
      aiBehavior: {},
      prompt: {
        currentPromptId: "1",
        defaultPrompt: "a",
        versions: [],
      },
      intents: {
        intents: [],
      },
      updatedAt: new Date().toISOString(),
      updatedBy: "user",
    };

    const result = AISettingsSchema.safeParse(fullPayload);
    expect(result.success).toBe(true);
  });
});
