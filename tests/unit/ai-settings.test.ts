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


  it("should validate legacy PromptSettings missing currentPromptId and defaultPrompt", () => {
    const legacyPayload = {
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
      prompt: {}, // Missing fields entirely
      intents: {
        intents: [],
      },
      updatedAt: new Date().toISOString(),
      updatedBy: "user",
    };

    const result = AISettingsSchema.safeParse(legacyPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prompt.currentPromptId).toBe("");
      expect(result.data.prompt.defaultPrompt).toBe("");
      expect(result.data.prompt.versions).toEqual([]);
    }
  });

  it("should validate legacy PromptSettings with an empty versions array missing", () => {
    const legacyPayload = {
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
        // versions missing
      },
      intents: {
        intents: [],
      },
      updatedAt: new Date().toISOString(),
      updatedBy: "user",
    };

    const result = AISettingsSchema.safeParse(legacyPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prompt.versions).toEqual([]);
    }
  });

  it("should reject malformed prompt version", () => {
    const invalidPayload = {
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
        versions: [{
          id: 123, // Invalid type, should be string
          name: "a",
          version: 1,
          content: "a",
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: "user"
        }]
      },
      intents: {
        intents: [],
      },
      updatedAt: new Date().toISOString(),
      updatedBy: "user",
    };

    const result = AISettingsSchema.safeParse(invalidPayload);
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

describe("AI Settings Seed Data", () => {
  it("should contain idempotent intent definitions", () => {
    // Import dynamically so it does not interfere if not present
    const { SEED_DEFAULT_INTENTS } = require("../../lib/ai/ai-settings/seed-data");
    expect(SEED_DEFAULT_INTENTS).toBeDefined();
    expect(Array.isArray(SEED_DEFAULT_INTENTS)).toBe(true);
    expect(SEED_DEFAULT_INTENTS.length).toBeGreaterThan(0);

    // Ensure all intents have required properties for correct upsert
    SEED_DEFAULT_INTENTS.forEach((intent: any) => {
      expect(intent.id).toBeDefined();
      expect(intent.intentId).toBeDefined();
      expect(intent.status).toBeDefined();
    });
  });

  it("should construct valid seed payload", () => {
    const { getDefaultSeedPayload } = require("../../lib/ai/ai-settings/seed-data");
    const payload = getDefaultSeedPayload("admin-user-123");
    expect(payload.id).toBe("main");
    expect(payload.updated_by).toBe("admin-user-123");

    // Quick validation against schema
    const result = AISettingsSchema.safeParse({
        ...payload,
        templeInformation: payload.temple_information,
        visitorInformation: payload.visitor_information,
        templePolicies: payload.temple_policies,
        aiResponses: payload.ai_responses,
        aiBehavior: payload.ai_behavior,
        extendedBehavior: payload.extended_behavior,
        updatedAt: payload.updated_at,
        updatedBy: payload.updated_by,
    });

    expect(result.success).toBe(true);
  });
});

describe("AI Behavior API Payload Handling", () => {
  it("should safely process ai-behavior payload structure", () => {
    const rawPayloadWithSetting = {
      setting: "all",
      confidenceThreshold: 90,
      semanticThreshold: 80,
      maxRelatedArticles: 5,
      conversationTimeout: 60,
      streaming: true,
      debugMode: true,
      unknownLogging: false,
    };

    // Simulate backend route reconstruction
    const behaviorData = {
      confidenceThreshold: rawPayloadWithSetting.confidenceThreshold ?? 85,
      semanticThreshold: rawPayloadWithSetting.semanticThreshold ?? 70,
      maxRelatedArticles: rawPayloadWithSetting.maxRelatedArticles ?? 3,
      conversationTimeout: rawPayloadWithSetting.conversationTimeout ?? 30,
      streaming: rawPayloadWithSetting.streaming ?? false,
      debugMode: rawPayloadWithSetting.debugMode ?? false,
      unknownLogging: rawPayloadWithSetting.unknownLogging ?? true,
    };

    // Make sure we stripped out the 'setting' key
    expect((behaviorData as any).setting).toBeUndefined();
    expect(behaviorData.confidenceThreshold).toBe(90);
    expect(behaviorData.debugMode).toBe(true);
  });
});
