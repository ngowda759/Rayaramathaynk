// Tests for VOLUNTEER retrieval wiring (P3).
//
// VOLUNTEER had no entry in INTENT_RETRIEVAL_MAP, so `getContextForIntent`
// returned `{}` and the composer fell back. The authoritative content already
// exists in `ai_settings.visitor_information.volunteerInfo`; these tests assert
// it reaches the answer (EN + KN) and that missing content fails safely.

jest.mock("server-only", () => ({}), { virtual: true });

const getAISettings = jest.fn();
jest.mock("@/lib/ai/ai-settings", () => ({
  aiSettingsService: {
    getAISettings: (...args: unknown[]) => getAISettings(...args),
    logUnknownQuestion: jest.fn(() => Promise.resolve(undefined)),
  },
}));

// A single in-memory `ai_settings` "main" row that the retrieval module reads.
let settingsRow: Record<string, unknown> | null = null;

function makeQuery(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder;
  builder.select = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  return builder;
}

const mockSupabase = { from: jest.fn(() => makeQuery({ data: settingsRow, error: null })) };
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockSupabase }));
jest.mock("@/lib/supabase/client", () => ({ createClient: () => mockSupabase }));
jest.mock("@/lib/ai/knowledge/repository", () => ({
  searchArticles: jest.fn(() => Promise.resolve([])),
}));

import { getContextForIntent, INTENT_RETRIEVAL_MAP } from "@/lib/ai/retrieval";
import { clearSettingsCache } from "@/lib/ai/retrieval/settings";
import { detectIntent, Intent, RetrievalType } from "@/lib/ai/intent";
import { ResponseComposer } from "@/lib/ai/response/composer";

function aiSettings(confidenceThreshold = 0.85) {
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

const VOLUNTEER_TEXT = "Contact temple office to join volunteer program.";

function populatedRow() {
  return {
    temple_information: {
      name: "Sri Raghavendra Swamy Matha",
      contact: { address: "Yelahanka New Town, Bengaluru", phone: "+91-80-0000-0000", email: "t@example.org" },
      timings: { morningOpen: "6:00 AM", eveningOpen: "5:00 PM" },
    },
    visitor_information: { volunteerInfo: VOLUNTEER_TEXT },
    temple_policies: {},
  };
}

const composer = new ResponseComposer();

beforeEach(() => {
  jest.clearAllMocks();
  clearSettingsCache();
  getAISettings.mockResolvedValue(aiSettings());
  settingsRow = populatedRow();
  mockSupabase.from.mockImplementation(() => makeQuery({ data: settingsRow, error: null }));
});

describe("VOLUNTEER retrieval map (P3)", () => {
  it("routes VOLUNTEER to the settings retriever", () => {
    const mapping = INTENT_RETRIEVAL_MAP.find((m) => m.intent === Intent.VOLUNTEER);
    expect(mapping).toBeDefined();
    expect(mapping!.retrievers.map((r) => r.name)).toContain("settings");
  });

  it("returns volunteer info from ai_settings.visitor_information", async () => {
    const { context, sources } = await getContextForIntent(Intent.VOLUNTEER);

    expect(sources).toContain(RetrievalType.REPOSITORY);
    expect(context.templeSettings?.visitorInfo.volunteerInfo).toBe(VOLUNTEER_TEXT);
  });

  it("marks VOLUNTEER as requiring structured data", () => {
    expect(detectIntent("How can I volunteer at the temple?").requiresStructuredData).toBe(true);
  });
});

describe("VOLUNTEER answers (P3)", () => {
  it("English: authoritative retrieval yields a non-fallback volunteer answer", async () => {
    const detection = detectIntent("How can I volunteer at the temple?");
    expect(detection.intent).toBe(Intent.VOLUNTEER);

    const { context, sources } = await getContextForIntent(detection.intent);
    const out = await composer.compose({
      intent: detection.intent,
      confidence: detection.confidence,
      language: "en",
      retrievalResult: { source: sources[0], data: context, sources },
    });

    expect(out.source).toBe(RetrievalType.REPOSITORY);
    expect(out.content).toContain(VOLUNTEER_TEXT);
    expect(out.content).toContain("/volunteer");
    expect(out.content).not.toBe("UNKNOWN_FALLBACK");
  });

  it("Kannada: authoritative retrieval yields a non-fallback volunteer answer", async () => {
    const detection = detectIntent("ದೇವಸ್ಥಾನದಲ್ಲಿ ಸ್ವಯಂಸೇವಕರಾಗಿ ಹೇಗೆ ಭಾಗವಹಿಸಬಹುದು?");
    expect(detection.intent).toBe(Intent.VOLUNTEER);

    const { context, sources } = await getContextForIntent(detection.intent);
    const out = await composer.compose({
      intent: detection.intent,
      confidence: detection.confidence,
      language: "kn",
      retrievalResult: { source: sources[0], data: context, sources },
    });

    expect(out.source).toBe(RetrievalType.REPOSITORY);
    expect(out.content).toContain(VOLUNTEER_TEXT);
    expect(out.content).not.toBe("UNKNOWN_FALLBACK");
  });

  it("falls back safely when volunteer data is missing (no invented instructions)", async () => {
    settingsRow = {
      temple_information: {
        name: "Matha",
        contact: { address: "Yelahanka", phone: "+91-80-0000-0000", email: "t@example.org" },
      },
      visitor_information: {},
      temple_policies: {},
    };
    mockSupabase.from.mockImplementation(() => makeQuery({ data: settingsRow, error: null }));
    clearSettingsCache();

    const detection = detectIntent("How can I volunteer at the temple?");
    const { context, sources } = await getContextForIntent(detection.intent);
    const out = await composer.compose({
      intent: detection.intent,
      confidence: detection.confidence,
      language: "en",
      retrievalResult: { source: sources[0] ?? RetrievalType.REPOSITORY, data: context, sources },
    });

    expect(out.source).toBe(RetrievalType.FALLBACK);
    expect(out.content).toBe("UNKNOWN_FALLBACK");
  });
});
