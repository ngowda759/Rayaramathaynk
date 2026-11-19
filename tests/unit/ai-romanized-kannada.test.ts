// Tests for romanized-Kannada detection (P4.7).
//
// `isRomanizedKannada` anchored its check on `^[a-zA-Z]+$`, so any message with a
// space returned false. Romanized Kannada detection was therefore dead for real
// sentences, and `Temple volunteer aagbekadre enu madbeku?` was reported as
// English — the assistant answered in the wrong language.

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

import { looksRomanizedKannada } from "@/lib/ai/intent/transliteration";
import { generateResponse } from "@/lib/ai/generator";
import { clearSettingsCache } from "@/lib/ai/retrieval/settings";

const row = {
  temple_information: {
    name: "Sri Raghavendra Swamy Matha",
    contact: { address: "Yelahanka New Town, Bengaluru", phone: "+91-80-0000-0000", email: "temple@example.org" },
    timings: { morningOpen: "6:00 AM", eveningOpen: "5:00 PM" },
  },
  visitor_information: { volunteerInfo: "Contact temple office to join volunteer program." },
  temple_policies: {},
};

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

beforeEach(() => {
  jest.clearAllMocks();
  clearSettingsCache();
  getAISettings.mockResolvedValue(aiSettings());
  settingsRow = row;
  mockSupabase.from.mockImplementation(() => makeQuery({ data: settingsRow, error: null }));
});

describe("looksRomanizedKannada (P4.7)", () => {
  it("detects multi-word romanized Kannada sentences", () => {
    // These all failed under the anchored single-token check.
    expect(looksRomanizedKannada("Temple volunteer aagbekadre enu madbeku?")).toBe(true);
    expect(looksRomanizedKannada("Sri Rayara Matha alli upcoming events yavuvu?")).toBe(true);
  });

  it("does not flag ordinary English as romanized Kannada", () => {
    expect(looksRomanizedKannada("Where is the temple located?")).toBe(false);
    expect(looksRomanizedKannada("How can I contact the temple?")).toBe(false);
    expect(looksRomanizedKannada("")).toBe(false);
  });

  it("does not flag plain Unicode Kannada", () => {
    expect(looksRomanizedKannada("ದೇವಸ್ಥಾನದ ಸಮಯವೇನು?")).toBe(false);
  });

  it("does not flag English carrying Kannada-like letter pairs", () => {
    // The digraph heuristic (th/sh/ee/oo/ai) matched these and answered in
    // Kannada; the marker list is what distinguishes the two.
    expect(looksRomanizedKannada("thank you")).toBe(false);
    expect(looksRomanizedKannada("This temple is beautiful")).toBe(false);
    expect(looksRomanizedKannada("I would like to see the festival schedule")).toBe(false);
    expect(looksRomanizedKannada("The temple is open on Thursday")).toBe(false);
  });
});

describe("language reporting for mixed input (P4.8)", () => {
  it("reports romanized Kannada as mixed, not English", async () => {
    const result = await generateResponse("Temple volunteer aagbekadre enu madbeku?");
    expect(result.language).toBe("mixed");
  });

  it("still reports plain English as English", async () => {
    const result = await generateResponse("Where is Sri Rayara Matha located?");
    expect(result.language).toBe("en");
  });

  it("reports Unicode Kannada with a little English as mixed", async () => {
    const result = await generateResponse("Temple timings ಏನು?");
    expect(result.language).toBe("mixed");
  });

  it("reports pure Unicode Kannada as kn", async () => {
    const result = await generateResponse("ದೇವಸ್ಥಾನದ ಸಮಯವೇನು?");
    expect(result.language).toBe("kn");
  });
});
