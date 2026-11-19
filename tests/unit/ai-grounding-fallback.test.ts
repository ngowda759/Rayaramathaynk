// P5 — answer grounding, honest fallback and false-positive cleanup.
//
// These fixes are independent of P1-P4 and are verified against `main` alone:
//  1. `hi` matched as a substring inside "Which", "this", "history" and "hire",
//     so the greeting pattern (priority 100) claimed real questions.
//  2. A settings row holding an address but no phone number produced an
//     "authoritative" contact answer rendering "Phone: ".
//  3. Event answers listed bare titles, discarding date/time/venue that the
//     event row already carried.

jest.mock("server-only", () => ({}), { virtual: true });

const getAISettings = jest.fn();
jest.mock("@/lib/ai/ai-settings", () => ({
  aiSettingsService: {
    getAISettings: (...args: unknown[]) => getAISettings(...args),
    logUnknownQuestion: jest.fn(() => Promise.resolve(undefined)),
  },
}));

import { detectIntent } from "@/lib/ai/intent";
import { Intent, RetrievalType } from "@/lib/ai/intent/types";
import { containsKeyword } from "@/lib/ai/intent/patterns";
import { ResponseComposer } from "@/lib/ai/response/composer";
import type { TempleSettings } from "@/lib/ai/retrieval/types";

const composer = new ResponseComposer();

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

/** Build a settings document with every field present unless overridden. */
function templeSettings(overrides: Partial<TempleSettings> = {}): TempleSettings {
  return {
    name: "Sri Raghavendra Swamy Matha",
    address: "Yelahanka New Town, Bengaluru",
    phone: "+91-80-0000-0000",
    email: "temple@example.org",
    timings: {
      morningOpen: "6:00 AM",
      morningClose: "12:30 PM",
      eveningOpen: "5:00 PM",
      eveningClose: "8:30 PM",
    },
    contact: { phone: "", email: "", address: "" },
    officeHours: { weekday: "9:00 AM - 5:00 PM", weekend: "9:00 AM - 12:00 PM", notes: "" },
    visitorInfo: {
      guidelines: "Remove footwear before entering.",
      dressCode: "Traditional attire.",
      photographyPolicy: "Photography allowed in outer areas.",
      parking: "Free parking available.",
      facilities: "",
      wheelchairAccess: "",
      drinkingWater: "",
      restrooms: "",
      prasada: "",
      annadanam: "",
      accommodation: "",
      volunteerInfo: "Contact the temple office to join the volunteer program.",
      testimonials: "",
      contact: "",
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getAISettings.mockResolvedValue(aiSettings());
});

describe("word-boundary keyword matching (P5.1)", () => {
  it("does not match a short keyword inside a longer word", () => {
    // All of these were false positives before the boundary check.
    expect(containsKeyword("which festivals are celebrated", "hi")).toBe(false);
    expect(containsKeyword("this temple is beautiful", "hi")).toBe(false);
    expect(containsKeyword("tell me about the history", "hi")).toBe(false);
    expect(containsKeyword("should i hire a guide", "hi")).toBe(false);
  });

  it("still matches a short keyword as a standalone word", () => {
    expect(containsKeyword("hi", "hi")).toBe(true);
    expect(containsKeyword("hi there", "hi")).toBe(true);
    expect(containsKeyword("hello hi", "hi")).toBe(true);
  });

  it("keeps prefix families working for longer keywords", () => {
    expect(containsKeyword("i want to book a seva", "book")).toBe(true);
    expect(containsKeyword("booking details", "book")).toBe(true);
    expect(containsKeyword("seva booking", "booking")).toBe(true);
    expect(containsKeyword("parking available", "park")).toBe(true);
  });

  it("does not treat greetings as the intent for unrelated questions", () => {
    for (const question of [
      "Which festivals are celebrated here?",
      "This temple is beautiful",
      "Tell me about the history",
      "Should I hire a guide",
    ]) {
      expect(detectIntent(question).intent).not.toBe(Intent.GENERAL_GREETING);
    }
  });

  it("keeps real greetings working", () => {
    expect(detectIntent("hi").intent).toBe(Intent.GENERAL_GREETING);
    expect(detectIntent("hello").intent).toBe(Intent.GENERAL_GREETING);
  });

  it("still classifies genuine domain questions", () => {
    expect(detectIntent("What are the temple timings?").intent).toBe(Intent.TEMPLE_TIMINGS);
    expect(detectIntent("How can I contact the temple?").intent).toBe(Intent.CONTACT_INFORMATION);
  });
});

describe("settings answers require the specific field (P5.3)", () => {
  it("does not answer contact questions when phone and email are empty", async () => {
    const out = await composer.compose({
      intent: Intent.CONTACT_INFORMATION,
      confidence: 90,
      language: "en",
      retrievalResult: {
        source: RetrievalType.REPOSITORY,
        data: { templeSettings: templeSettings({ phone: "", email: "" }) },
        sources: [],
      },
    });

    expect(out.source).toBe(RetrievalType.FALLBACK);
    expect(out.content).toBe("UNKNOWN_FALLBACK");
    expect(out.content).not.toContain("Phone:");
  });

  it("still answers contact questions when a phone number exists", async () => {
    const out = await composer.compose({
      intent: Intent.CONTACT_INFORMATION,
      confidence: 90,
      language: "en",
      retrievalResult: {
        source: RetrievalType.REPOSITORY,
        data: { templeSettings: templeSettings({ email: "" }) },
        sources: [],
      },
    });

    expect(out.source).toBe(RetrievalType.REPOSITORY);
    expect(out.content).toContain("+91-80-0000-0000");
    // The empty email must not render as a blank "Email:" line.
    expect(out.content).not.toContain("Email:");
  });

  it("falls back to the nested contact phone when the top-level field is empty", async () => {
    const out = await composer.compose({
      intent: Intent.CONTACT_INFORMATION,
      confidence: 90,
      language: "en",
      retrievalResult: {
        source: RetrievalType.REPOSITORY,
        data: {
          templeSettings: templeSettings({
            phone: "",
            email: "",
            contact: { phone: "+91-80-1111-1111", email: "", address: "" },
          }),
        },
        sources: [],
      },
    });

    expect(out.source).toBe(RetrievalType.REPOSITORY);
    expect(out.content).toContain("+91-80-1111-1111");
  });

  it("does not answer timings questions when timings are empty", async () => {
    const out = await composer.compose({
      intent: Intent.TEMPLE_TIMINGS,
      confidence: 90,
      language: "en",
      retrievalResult: {
        source: RetrievalType.REPOSITORY,
        data: {
          templeSettings: templeSettings({
            timings: { morningOpen: "", morningClose: "", eveningOpen: "", eveningClose: "" },
          }),
        },
        sources: [],
      },
    });

    expect(out.source).toBe(RetrievalType.FALLBACK);
    expect(out.content).toBe("UNKNOWN_FALLBACK");
  });

  it("does not answer volunteer questions when volunteerInfo is empty", async () => {
    const out = await composer.compose({
      intent: Intent.VOLUNTEER,
      confidence: 90,
      language: "en",
      retrievalResult: {
        source: RetrievalType.REPOSITORY,
        data: {
          templeSettings: templeSettings({
            visitorInfo: { ...templeSettings().visitorInfo, volunteerInfo: "   " },
          }),
        },
        sources: [],
      },
    });

    expect(out.source).toBe(RetrievalType.FALLBACK);
    expect(out.content).toBe("UNKNOWN_FALLBACK");
  });

  it("still answers when the settings field is present", async () => {
    const out = await composer.compose({
      intent: Intent.TEMPLE_TIMINGS,
      confidence: 90,
      language: "en",
      retrievalResult: {
        source: RetrievalType.REPOSITORY,
        data: { templeSettings: templeSettings() },
        sources: [],
      },
    });

    expect(out.source).toBe(RetrievalType.REPOSITORY);
    expect(out.content).toContain("6:00 AM");
  });
});

describe("event answers include real event details (P5.4)", () => {
  it("renders date, time and venue, not just the title", async () => {
    const out = await composer.compose({
      intent: Intent.UPCOMING_EVENTS,
      confidence: 90,
      language: "en",
      retrievalResult: {
        source: RetrievalType.REPOSITORY,
        data: {
          upcomingEvents: [
            {
              id: "e1",
              title: "Tulasi Habba",
              description: "Annual tulasi festival",
              startDate: new Date("2026-12-01T00:00:00.000Z"),
              endDate: new Date("2026-12-02T00:00:00.000Z"),
              startTime: "9:00 AM",
              endTime: "12:00 PM",
              location: "Main Hall",
              featured: true,
              category: "festival",
            },
          ],
        },
        sources: [],
      },
    });

    expect(out.source).toBe(RetrievalType.REPOSITORY);
    expect(out.content).toContain("Tulasi Habba");
    expect(out.content).toContain("9:00 AM");
    expect(out.content).toContain("12:00 PM");
    expect(out.content).toContain("Main Hall");
  });

  it("degrades gracefully when an event has no optional details", async () => {
    const out = await composer.compose({
      intent: Intent.UPCOMING_EVENTS,
      confidence: 90,
      language: "en",
      retrievalResult: {
        source: RetrievalType.REPOSITORY,
        data: {
          upcomingEvents: [
            {
              id: "e2",
              title: "Aaradhane",
              description: "",
              startDate: new Date("2026-12-05T00:00:00.000Z"),
              endDate: new Date("2026-12-05T00:00:00.000Z"),
              location: "",
              featured: false,
            },
          ],
        },
        sources: [],
      },
    });

    expect(out.content).toContain("Aaradhane");
    expect(out.content).not.toContain("undefined");
    expect(out.content).not.toContain("null");
  });

  it("falls back when the event list is empty", async () => {
    const out = await composer.compose({
      intent: Intent.UPCOMING_EVENTS,
      confidence: 90,
      language: "en",
      retrievalResult: {
        source: RetrievalType.REPOSITORY,
        data: { upcomingEvents: [] },
        sources: [],
      },
    });

    expect(out.source).toBe(RetrievalType.FALLBACK);
    expect(out.content).toBe("UNKNOWN_FALLBACK");
  });
});
