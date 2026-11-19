// Tests for Kannada / mixed-language intent detection (P4).
//
// The generic interrogative "ಹೇಗೆ" ("how") appeared in the FAQ pattern at
// priority 75, above CONTACT_INFORMATION at 71. A Kannada question like
// "ದೇವಸ್ಥಾನವನ್ನು ಹೇಗೆ ಸಂಪರ್ಕಿಸಬಹುದು?" therefore classified as FAQ (49%), never
// fetched contact data, and returned the generic unknown reply.

jest.mock("server-only", () => ({}), { virtual: true });

const getAISettings = jest.fn();
jest.mock("@/lib/ai/ai-settings", () => ({
  aiSettingsService: {
    getAISettings: (...args: unknown[]) => getAISettings(...args),
    logUnknownQuestion: jest.fn(() => Promise.resolve(undefined)),
  },
}));

let settingsRow: Record<string, unknown> | null = null;

function makeQuery(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder;
  builder.select = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(chain);
  builder.limit = jest.fn(chain);
  builder.gte = jest.fn(chain);
  builder.lte = jest.fn(chain);
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  builder.then = jest.fn((resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve));
  return builder;
}

const mockSupabase = { from: jest.fn(() => makeQuery({ data: settingsRow, error: null })) };
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockSupabase }));
jest.mock("@/lib/supabase/client", () => ({ createClient: () => mockSupabase }));
jest.mock("@/lib/ai/knowledge/repository", () => ({
  searchArticles: jest.fn(() => Promise.resolve([])),
}));

import { detectIntent } from "@/lib/ai/intent";
import { Intent, RetrievalType } from "@/lib/ai/intent/types";
import { isGenericInterrogative } from "@/lib/ai/intent/patterns";
import { clearSettingsCache } from "@/lib/ai/retrieval/settings";
import { getContextForIntent } from "@/lib/ai/retrieval";
import { ResponseComposer } from "@/lib/ai/response/composer";

function aiSettings() {
  return {
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
      unknownQuestion: "UNKNOWN_FALLBACK",
      welcome: "Welcome",
      goodbye: "Bye",
      outOfScope: "Out of scope",
      greeting: "Hi",
      fallback: "Fallback",
    },
  };
}

const row = {
  temple_information: {
    name: "Sri Raghavendra Swamy Matha",
    contact: {
      address: "Yelahanka New Town, Bengaluru 560064",
      phone: "+91-80-0000-0000",
      email: "temple@example.org",
    },
    timings: {
      morningOpen: "6:00 AM",
      morningClose: "12:30 PM",
      eveningOpen: "5:00 PM",
      eveningClose: "8:30 PM",
    },
    officeHours: { weekday: "9:00 AM - 5:00 PM", weekend: "9:00 AM - 12:00 PM" },
  },
  visitor_information: { volunteerInfo: "Contact temple office to join volunteer program." },
  temple_policies: {},
};

const composer = new ResponseComposer();

beforeEach(() => {
  jest.clearAllMocks();
  clearSettingsCache();
  getAISettings.mockResolvedValue(aiSettings());
  settingsRow = row;
  mockSupabase.from.mockImplementation(() => makeQuery({ data: settingsRow, error: null }));
});

describe("generic interrogatives do not outrank domain terms (P4.1)", () => {
  it("classifies Kannada words as generic", () => {
    for (const word of ["ಹೇಗೆ", "ಏನು", "ಯಾವ", "ಯಾರು", "how", "what", "which"]) {
      expect(isGenericInterrogative(word)).toBe(true);
    }
  });

  it("does not treat domain words as generic", () => {
    for (const word of ["ಸಂಪರ್ಕ", "ಸಮಯ", "ಸ್ಥಳ", "ಸ್ವಯಂಸೇವಕ", "timings", "contact", "location"]) {
      expect(isGenericInterrogative(word)).toBe(false);
    }
  });
});

describe("intent detection — Kannada (P4.2)", () => {
  const cases: Array<[string, Intent]> = [
    ["ಶ್ರೀ ರಾಯರ ಮಠದಲ್ಲಿ ಮುಂದಿನ ಕಾರ್ಯಕ್ರಮಗಳು ಯಾವುವು?", Intent.UPCOMING_EVENTS],
    ["ದೇವಸ್ಥಾನದಲ್ಲಿ ಸ್ವಯಂಸೇವಕರಾಗಿ ಹೇಗೆ ಭಾಗವಹಿಸಬಹುದು?", Intent.VOLUNTEER],
    ["ಶ್ರೀ ರಾಯರ ಮಠ ಎಲ್ಲಿದೆ?", Intent.LOCATION],
    ["ದೇವಸ್ಥಾನದ ಸಮಯವೇನು?", Intent.TEMPLE_TIMINGS],
    ["ದೇವಸ್ಥಾನವನ್ನು ಹೇಗೆ ಸಂಪರ್ಕಿಸಬಹುದು?", Intent.CONTACT_INFORMATION],
  ];

  it.each(cases)("%s -> %s", (question, expected) => {
    expect(detectIntent(question).intent).toBe(expected);
  });
});

describe("intent detection — mixed language (P4.3)", () => {
  const cases: Array<[string, Intent]> = [
    ["Sri Rayara Matha alli upcoming events yavuvu?", Intent.UPCOMING_EVENTS],
    ["Temple volunteer aagbekadre enu madbeku?", Intent.VOLUNTEER],
  ];

  it.each(cases)("%s -> %s", (question, expected) => {
    expect(detectIntent(question).intent).toBe(expected);
  });
});

describe("intent detection — English unchanged (P4.4)", () => {
  const cases: Array<[string, Intent]> = [
    ["What are the upcoming events at Sri Rayara Matha?", Intent.UPCOMING_EVENTS],
    ["How can I volunteer at the temple?", Intent.VOLUNTEER],
    ["Where is Sri Rayara Matha located?", Intent.LOCATION],
    ["What are the temple timings?", Intent.TEMPLE_TIMINGS],
    ["How can I contact the temple?", Intent.CONTACT_INFORMATION],
  ];

  it.each(cases)("%s -> %s", (question, expected) => {
    expect(detectIntent(question).intent).toBe(expected);
  });
});

describe("Kannada answers are grounded in settings data (P4.5)", () => {
  it("answers the Kannada contact question from authoritative contact data", async () => {
    const detection = detectIntent("ದೇವಸ್ಥಾನವನ್ನು ಹೇಗೆ ಸಂಪರ್ಕಿಸಬಹುದು?");
    const { context, sources } = await getContextForIntent(detection.intent);

    const out = await composer.compose({
      intent: detection.intent,
      confidence: detection.confidence,
      language: "kn",
      retrievalResult: { source: sources[0], data: context, sources },
    });

    expect(out.source).toBe(RetrievalType.REPOSITORY);
    expect(out.content).toContain("+91-80-0000-0000");
    expect(out.content).not.toBe("UNKNOWN_FALLBACK");
  });

  it("answers the Kannada timings question in Kannada", async () => {
    const detection = detectIntent("ದೇವಸ್ಥಾನದ ಸಮಯವೇನು?");
    const { context, sources } = await getContextForIntent(detection.intent);

    const out = await composer.compose({
      intent: detection.intent,
      confidence: detection.confidence,
      language: "kn",
      retrievalResult: { source: sources[0], data: context, sources },
    });

    expect(out.source).toBe(RetrievalType.REPOSITORY);
    expect(out.content).toContain("6:00 AM");
    expect(out.content).toContain("ದೇವಸ್ಥಾನದ ಸಮಯ");
  });

  it("answers the Kannada location question in Kannada", async () => {
    const detection = detectIntent("ಶ್ರೀ ರಾಯರ ಮಠ ಎಲ್ಲಿದೆ?");
    const { context, sources } = await getContextForIntent(detection.intent);

    const out = await composer.compose({
      intent: detection.intent,
      confidence: detection.confidence,
      language: "kn",
      retrievalResult: { source: sources[0], data: context, sources },
    });

    expect(out.source).toBe(RetrievalType.REPOSITORY);
    expect(out.content).toContain("Yelahanka New Town");
    expect(out.content).not.toBe("UNKNOWN_FALLBACK");
  });
});

describe("FAQ still reachable for genuine generic questions (P4.6)", () => {
  it("keeps a bare generic question out of the structured intents", () => {
    const result = detectIntent("ಹೇಗೆ");
    expect(result.intent).toBe(Intent.FAQ);
  });
});
