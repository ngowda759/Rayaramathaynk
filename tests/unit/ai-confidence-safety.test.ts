// Safety tests for the source-aware confidence policy, exercised end to end
// through `generateResponse` (P2.5: `requireSourceForFacts` still blocks
// unsupported factual answers; P2.8: conversational intents are unaffected).

jest.mock("server-only", () => ({}), { virtual: true });

const mockSettings = {
  general: { defaultLanguage: "en", botName: "Raya" },
  safety: { retrievalRequired: true, requireSourceForFacts: true, allowLLMOnlyResponse: false },
  extendedBehavior: {
    confidenceThreshold: 0.85,
    semanticThreshold: 0.7,
    maxRelatedArticles: 3,
    conversationTimeout: 30,
    streaming: false,
    debugMode: false,
    unknownLogging: false,
    enableUnknownQuestionLogging: false,
  },
  aiResponses: {
    greeting: "Namaskara",
    welcome: "WELCOME_MESSAGE",
    fallback: "Fallback",
    unknownQuestion: "UNKNOWN_FALLBACK",
    outOfScope: "OUT_OF_SCOPE_MESSAGE",
    goodbye: "GOODBYE_MESSAGE",
  },
};

jest.mock("@/lib/ai/ai-settings", () => ({
  aiSettingsService: {
    getAISettings: jest.fn(() => Promise.resolve(mockSettings)),
    logUnknownQuestion: jest.fn(() => Promise.resolve(undefined)),
  },
}));

const getContextForIntent = jest.fn();
const searchArticles = jest.fn();
const getTempleSettings = jest.fn();

jest.mock("@/lib/ai/retrieval", () => ({
  getContextForIntent: (...args: unknown[]) => getContextForIntent(...args),
  getTempleSettings: (...args: unknown[]) => getTempleSettings(...args),
}));

jest.mock("@/lib/ai/knowledge/repository", () => ({
  searchArticles: (...args: unknown[]) => searchArticles(...args),
}));

jest.mock("@/lib/ai/generator", () => {
  const actual = jest.requireActual("@/lib/ai/generator");
  return actual;
});

import { generateResponse } from "@/lib/ai/generator";
import { Intent, RetrievalType } from "@/lib/ai/intent/types";

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

beforeEach(() => {
  jest.clearAllMocks();
  searchArticles.mockResolvedValue([]);
  getTempleSettings.mockResolvedValue({ data: null, source: RetrievalType.FALLBACK, confidence: 0 });
  getContextForIntent.mockResolvedValue({ context: {}, sources: [] });
});

describe("generateResponse — conversational intents unchanged (P2.8)", () => {
  it("answers a greeting with the welcome message and no retrieval", async () => {
    const result = await generateResponse("Hello");
    expect(result.intent).toBe(Intent.GENERAL_GREETING);
    expect(result.content).toBe("WELCOME_MESSAGE");
    expect(getContextForIntent).not.toHaveBeenCalled();
  });

  it("answers thanks with the goodbye/closing message", async () => {
    const result = await generateResponse("Thank you");
    expect(result.intent).toBe(Intent.THANKS);
    expect(result.content).toBe("GOODBYE_MESSAGE");
  });

  it("answers out-of-scope questions with the out-of-scope message", async () => {
    const result = await generateResponse("What is the stock price of TCS?");
    expect(result.intent).toBe(Intent.OUT_OF_SCOPE);
    expect(result.content).toBe("OUT_OF_SCOPE_MESSAGE");
  });
});

describe("generateResponse — requireSourceForFacts (P2.5)", () => {
  it("returns the unknown fallback when a factual intent has no authoritative source", async () => {
    // Timings require structured data; settings read yields nothing.
    getContextForIntent.mockResolvedValue({ context: {}, sources: [] });

    const result = await generateResponse("What are the temple timings?");

    expect(result.source).toBe(RetrievalType.FALLBACK);
    expect(result.content).toBe("UNKNOWN_FALLBACK");
  });

  it("still returns the authoritative settings answer when data is available", async () => {
    getContextForIntent.mockResolvedValue({
      context: { templeSettings },
      sources: [RetrievalType.REPOSITORY],
    });

    const result = await generateResponse("What are the temple timings?");

    expect(result.source).toBe(RetrievalType.REPOSITORY);
    expect(result.content).toContain("6:00 AM");
  });
});
