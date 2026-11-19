// Tests for the source-aware confidence policy (P2).
//
// The composer used to require `confidence >= confidenceThreshold * 100`, i.e.
// 85 with the default 0.85 config, while keyword/hybrid detection legitimately
// returns 55-75. Real repository answers were therefore replaced by the generic
// "unknown" fallback. Authoritative repository data must survive; knowledge-base
// answers and unsupported facts must not.

jest.mock("server-only", () => ({}), { virtual: true });

const getAISettings = jest.fn();
jest.mock("@/lib/ai/ai-settings", () => ({
  aiSettingsService: {
    getAISettings: (...args: unknown[]) => getAISettings(...args),
  },
}));

// Break the composer -> generator import cycle (only used for metadata).
jest.mock("@/lib/ai/generator", () => ({
  getResponseMetadata: jest.fn(() => ({})),
}));

import { ResponseComposer } from "@/lib/ai/response/composer";
import { Intent, RetrievalType } from "@/lib/ai/intent/types";
import type { RetrievalResult } from "@/lib/ai/retrieval/registry";
import { AIExtendedBehaviorSettingsSchema } from "@/lib/ai/ai-settings/validation";

function settingsWith(confidenceThreshold: number) {
  return {
    general: { defaultLanguage: "en", botName: "Raya" },
    safety: { retrievalRequired: true, requireSourceForFacts: true, allowLLMOnlyResponse: false },
    extendedBehavior: {
      confidenceThreshold,
      semanticThreshold: 0.7,
      maxRelatedArticles: 3,
      conversationTimeout: 30,
      streaming: false,
      debugMode: false,
      unknownLogging: true,
    },
    aiResponses: {
      unknownQuestion: "UNKNOWN_FALLBACK",
      welcome: "Welcome",
      goodbye: "Bye",
      outOfScope: "Out of scope",
      greeting: "Hi",
      fallback: "Fallback",
    },
  };
}

const templeSettings = {
  name: "Sri Raghavendra Swamy Matha",
  address: "Yelahanka New Town, Bengaluru",
  phone: "+91-80-0000-0000",
  email: "temple@example.org",
  timings: {
    morningOpen: "6:00 AM",
    morningClose: "12:00 PM",
    eveningOpen: "5:00 PM",
    eveningClose: "8:30 PM",
  },
  contact: { phone: "+91-80-0000-0000", email: "temple@example.org", address: "Yelahanka" },
  officeHours: { weekday: "9-5", weekend: "9-12" },
  visitorInfo: {
    guidelines: "Remove footwear.",
    dressCode: "Traditional attire.",
    photographyPolicy: "No flash.",
    parking: "Available.",
  },
};

const events = [
  { id: "e1", title: "Tulasi Habba", description: "", startDate: new Date(), endDate: new Date() },
];

const composer = new ResponseComposer();

function repositoryResult(data: Record<string, unknown>): RetrievalResult {
  return { source: RetrievalType.REPOSITORY, data, sources: [RetrievalType.REPOSITORY] };
}

beforeEach(() => {
  jest.clearAllMocks();
  getAISettings.mockResolvedValue(settingsWith(0.85));
});

describe("threshold scale consistency (P2.1)", () => {
  it.each([55, 60, 70, 71])(
    "returns authoritative events at confidence %i with the default 0.85 config",
    async (confidence) => {
      const out = await composer.compose({
        intent: Intent.UPCOMING_EVENTS,
        confidence,
        language: "en",
        retrievalResult: repositoryResult({ upcomingEvents: events }),
      });

      expect(out.source).toBe(RetrievalType.REPOSITORY);
      expect(out.content).toContain("Tulasi Habba");
      expect(out.content).not.toBe("UNKNOWN_FALLBACK");
    }
  );

  it("returns authoritative settings (location) at confidence 68", async () => {
    const out = await composer.compose({
      intent: Intent.LOCATION,
      confidence: 68,
      language: "en",
      retrievalResult: repositoryResult({ templeSettings }),
    });

    expect(out.source).toBe(RetrievalType.REPOSITORY);
    expect(out.content).toContain("Yelahanka New Town");
    expect(out.content).not.toBe("UNKNOWN_FALLBACK");
  });

  it("treats a legacy percentage config (85) as the percent scale, not a 8500% bar", async () => {
    getAISettings.mockResolvedValue(settingsWith(85));

    const out = await composer.compose({
      intent: Intent.CONTACT_INFORMATION,
      confidence: 100,
      language: "en",
      retrievalResult: repositoryResult({ templeSettings }),
    });

    expect(out.source).toBe(RetrievalType.REPOSITORY);
    expect(out.content).toContain("temple@example.org");
  });

  it("keeps a 0-1 config on the ratio scale (0.6 gate admits 60, rejects 55 without data)", async () => {
    getAISettings.mockResolvedValue(settingsWith(0.6));

    const admitted = await composer.compose({
      intent: Intent.TEMPLE_TIMINGS,
      confidence: 60,
      language: "en",
      retrievalResult: repositoryResult({ templeSettings }),
    });
    expect(admitted.source).toBe(RetrievalType.REPOSITORY);

    const rejected = await composer.compose({
      intent: Intent.FAQ,
      confidence: 55,
      language: "en",
      retrievalResult: {
        source: RetrievalType.KNOWLEDGE_BASE,
        data: {},
        knowledgeArticles: [{ id: "k", title: "t", content: "Knowledge body", category: "faq" }],
        sources: [RetrievalType.KNOWLEDGE_BASE],
      },
    });
    expect(rejected.source).toBe(RetrievalType.FALLBACK);
    expect(rejected.content).toBe("UNKNOWN_FALLBACK");
  });
});

describe("authoritative vs non-authoritative gating (P2.2-P2.4)", () => {
  it("falls back when the authoritative intent has empty data", async () => {
    const out = await composer.compose({
      intent: Intent.UPCOMING_EVENTS,
      confidence: 71,
      language: "en",
      retrievalResult: repositoryResult({ upcomingEvents: [] }),
    });

    expect(out.source).toBe(RetrievalType.FALLBACK);
    expect(out.content).toBe("UNKNOWN_FALLBACK");
  });

  it("falls back for a FALLBACK-sourced result even with data present", async () => {
    const out = await composer.compose({
      intent: Intent.UPCOMING_EVENTS,
      confidence: 71,
      language: "en",
      retrievalResult: {
        source: RetrievalType.FALLBACK,
        data: { upcomingEvents: events },
        sources: [RetrievalType.FALLBACK],
      },
    });

    expect(out.source).toBe(RetrievalType.FALLBACK);
  });

  it("keeps confidence gating for knowledge-base answers", async () => {
    // Knowledge articles are not authoritative temple facts, so a below-threshold
    // classification must not be upgraded into a factual answer.
    const out = await composer.compose({
      intent: Intent.TEMPLE_HISTORY,
      confidence: 56,
      language: "en",
      retrievalResult: {
        source: RetrievalType.KNOWLEDGE_BASE,
        data: {},
        knowledgeArticles: [{ id: "k1", title: "History", content: "Long ago...", category: "temple_history" }],
        sources: [RetrievalType.KNOWLEDGE_BASE],
      },
    });

    expect(out.source).toBe(RetrievalType.FALLBACK);
    expect(out.content).toBe("UNKNOWN_FALLBACK");
  });

  it("returns a knowledge-base answer once it clears the numeric threshold", async () => {
    const out = await composer.compose({
      intent: Intent.TEMPLE_HISTORY,
      confidence: 90,
      language: "en",
      retrievalResult: {
        source: RetrievalType.KNOWLEDGE_BASE,
        data: {},
        knowledgeArticles: [{ id: "k1", title: "History", content: "Long ago...", category: "temple_history" }],
        sources: [RetrievalType.KNOWLEDGE_BASE],
      },
    });

    expect(out.source).toBe(RetrievalType.KNOWLEDGE_BASE);
    expect(out.content).toBe("Long ago...");
  });

  it("does not treat settings as authoritative for an unrelated intent", async () => {
    const out = await composer.compose({
      intent: Intent.TEMPLE_HISTORY,
      confidence: 56,
      language: "en",
      retrievalResult: repositoryResult({ templeSettings }),
    });

    expect(out.source).toBe(RetrievalType.FALLBACK);
    expect(out.content).toBe("UNKNOWN_FALLBACK");
  });
});

describe("settings validation (P2.5-P2.7)", () => {
  const base = {
    confidenceThreshold: 0.85,
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
    maxKnowledgeResults: 3,
  };

  it("accepts a 0-1 confidenceThreshold", () => {
    expect(AIExtendedBehaviorSettingsSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a percentage confidenceThreshold such as 85", () => {
    expect(
      AIExtendedBehaviorSettingsSchema.safeParse({ ...base, confidenceThreshold: 85 }).success
    ).toBe(false);
  });

  it("rejects a negative or out-of-range threshold", () => {
    expect(
      AIExtendedBehaviorSettingsSchema.safeParse({ ...base, confidenceThreshold: -1 }).success
    ).toBe(false);
    expect(
      AIExtendedBehaviorSettingsSchema.safeParse({ ...base, confidenceThreshold: 1.5 }).success
    ).toBe(false);
  });

  it("defaults used by the behavior route are on the 0-1 scale", async () => {
    const { DEFAULT_AI_BEHAVIOR_SETTINGS } = await import("@/types/ai-settings");
    expect(DEFAULT_AI_BEHAVIOR_SETTINGS.confidenceThreshold).toBe(0.85);
    expect(DEFAULT_AI_BEHAVIOR_SETTINGS.semanticThreshold).toBe(0.7);
    expect(AIExtendedBehaviorSettingsSchema.safeParse({
      ...base,
      confidenceThreshold: DEFAULT_AI_BEHAVIOR_SETTINGS.confidenceThreshold,
      semanticThreshold: DEFAULT_AI_BEHAVIOR_SETTINGS.semanticThreshold,
    }).success).toBe(true);
  });
});
