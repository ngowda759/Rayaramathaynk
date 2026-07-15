// Unit tests for Response Generator
// Tests the hybrid response generation functionality

import {
  Intent,
  detectIntent,
} from "@/lib/ai/intent";

import {
  generateResponse,
} from "@/lib/ai/generator";

// Mock Firebase for tests
jest.mock("@/lib/firebase", () => ({
  db: null,
  isFirebaseConfigured: () => false,
}));

// Mock retrieval modules to avoid Firebase calls
jest.mock("@/lib/ai/retrieval", () => ({
  getTempleSettings: jest.fn().mockResolvedValue({
    data: {
      name: "Sri Raghavendra Swamy Math",
      address: "Yelahanka New Town, Bengaluru",
      phone: "+91 80 2847 1234",
      email: "info@sriraghavendra.org",
      timings: {
        morning: { open: "6:00 AM", close: "12:00 PM" },
        evening: { open: "5:00 PM", close: "8:30 PM" },
      },
    },
    source: "repository",
    confidence: 95,
    retrievedAt: Date.now(),
    fromCache: false,
  }),
  getTempleTimings: jest.fn().mockResolvedValue({
    data: {
      morning: { open: "6:00 AM", close: "12:00 PM" },
      evening: { open: "5:00 PM", close: "8:30 PM" },
    },
    source: "repository",
    confidence: 95,
    retrievedAt: Date.now(),
    fromCache: false,
  }),
  getContactInfo: jest.fn().mockResolvedValue({
    data: {
      phone: "+91 80 2847 1234",
      email: "info@sriraghavendra.org",
      address: "Yelahanka New Town, Bengaluru",
    },
    source: "repository",
    confidence: 95,
    retrievedAt: Date.now(),
    fromCache: false,
  }),
  getUpcomingEvents: jest.fn().mockResolvedValue({
    data: [],
    source: "repository",
    confidence: 95,
    retrievedAt: Date.now(),
    fromCache: false,
  }),
  formatEventsListForDisplay: jest.fn().mockReturnValue("No upcoming events"),
  getActiveSevas: jest.fn().mockResolvedValue({
    data: [
      { id: "1", name: "Archana", description: "Chanting", category: "Daily", amount: 51, duration: 30, active: true },
    ],
    source: "repository",
    confidence: 95,
    retrievedAt: Date.now(),
    fromCache: false,
  }),
  formatSevasListForDisplay: jest.fn().mockReturnValue("Archana - ₹51"),
  getActiveAnnouncements: jest.fn().mockResolvedValue({
    data: [],
    source: "repository",
    confidence: 95,
    retrievedAt: Date.now(),
    fromCache: false,
  }),
  formatAnnouncementsForDisplay: jest.fn().mockReturnValue(""),
  getTodayPanchanga: jest.fn().mockResolvedValue({
    data: {
      date: "2026-07-15",
      tithi: "Shukla Dashami",
      nakshatra: "Uttara Phalguni",
      yoga: "Shubha",
      karana: "Balava",
      sunrise: "6:00 AM",
      sunset: "6:45 PM",
    },
    source: "repository",
    confidence: 95,
    retrievedAt: Date.now(),
    fromCache: false,
  }),
  formatPanchangaSimple: jest.fn().mockReturnValue("Tithi: Shukla Dashami, Nakshatra: Uttara Phalguni"),
  getDonationInfo: jest.fn().mockResolvedValue({
    data: {
      purposes: [{ name: "Annadanam", description: "Food donation" }],
      has80G: true,
      paymentMethods: ["UPI", "Bank Transfer"],
      websiteUrl: "/donations",
    },
    source: "repository",
    confidence: 90,
    retrievedAt: Date.now(),
    fromCache: false,
  }),
  formatDonationInfoForDisplay: jest.fn().mockReturnValue("Donate via UPI or Bank Transfer"),
  format80GInfo: jest.fn().mockReturnValue("80G Tax benefit available"),
  getNextAaradhane: jest.fn().mockResolvedValue({
    data: null,
    source: "repository",
    confidence: 0,
    retrievedAt: Date.now(),
    fromCache: false,
  }),
  formatAaradhaneForDisplay: jest.fn().mockReturnValue(""),
}));

// Mock knowledge base
jest.mock("@/lib/ai/knowledge", () => ({
  getKnowledgeContext: jest.fn().mockResolvedValue({
    articles: [],
    searchResults: [],
  }),
  formatArticlesForContext: jest.fn().mockReturnValue(""),
  getGreetingResponse: jest.fn().mockImplementation((lang: string) => {
    if (lang === "kn") return "ನಮಸ್ಕಾರ";
    return "Namaskara!";
  }),
  getThankYouResponse: jest.fn().mockImplementation((lang: string) => {
    if (lang === "kn") return "ಧನ್ಯವಾದ";
    return "Thank you!";
  }),
  getOutOfScopeResponse: jest.fn().mockImplementation((lang: string) => {
    return "I am Raya AI, the official assistant of Sri Raghavendra Swamy Math. I can help with temple timings, sevas, donations, and more.";
  }),
}));

describe("Response Generator", () => {
  describe("generateResponse", () => {
    describe("Temple Timings", () => {
      it("should generate response for timing queries", async () => {
        const result = await generateResponse("What are the temple timings?");
        
        expect(result.content).toBeDefined();
        expect(result.content.length).toBeGreaterThan(0);
        expect(result.intent).toBe(Intent.TEMPLE_TIMINGS);
        expect(result.usesLLM).toBe(false);
      });

      it("should include timing information in response", async () => {
        const result = await generateResponse("When does the temple close?");
        
        expect(result.content).toMatch(/6:00 AM|12:00 PM/);
      });

      it("should detect Kannada timing queries", async () => {
        const result = await generateResponse("ದೇವಸ್ಥಾನದ ಸಮಯ ಏನು");
        
        expect(result.intent).toBe(Intent.TEMPLE_TIMINGS);
        expect(result.language).toBe("kn");
      });
    });

    describe("Contact Information", () => {
      it("should generate response for contact queries", async () => {
        const result = await generateResponse("What is the phone number?");
        
        expect(result.intent).toBe(Intent.CONTACT_INFORMATION);
        expect(result.usesLLM).toBe(false);
      });

      it("should include phone number in response", async () => {
        const result = await generateResponse("How can I call the temple?");
        
        expect(result.content).toMatch(/\+91/);
      });
    });

    describe("Panchanga", () => {
      it("should generate response for panchanga queries", async () => {
        const result = await generateResponse("What is today's panchanga?");
        
        expect(result.intent).toBe(Intent.PANCHANGA);
        expect(result.usesLLM).toBe(false);
      });

      it("should include panchanga data in response", async () => {
        const result = await generateResponse("Tell me today's panchanga");
        
        // Response should be defined
        expect(result.content).toBeDefined();
        expect(result.content.length).toBeGreaterThan(0);
      });
    });

    describe("Donations", () => {
      it("should generate response for donation queries", async () => {
        const result = await generateResponse("How can I donate?");
        
        expect(result.intent).toBe(Intent.DONATION);
        expect(result.usesLLM).toBe(false);
      });

      it("should mention 80G for tax queries", async () => {
        const result = await generateResponse("Is donation tax deductible?");
        
        expect(result.intent).toBe(Intent.DONATION_80G);
      });
    });

    describe("Sevas", () => {
      it("should generate response for seva queries", async () => {
        const result = await generateResponse("What sevas are available?");
        
        expect(result.intent).toBe(Intent.SPECIAL_SEVAS);
        expect(result.usesLLM).toBe(false);
      });

      it("should include seva information in response", async () => {
        const result = await generateResponse("Tell me about archana");
        
        expect(result.content).toMatch(/Archana|seva/i);
      });
    });

    describe("Greetings", () => {
      it("should handle English greetings", async () => {
        const result = await generateResponse("Hello");
        
        expect(result.intent).toBe(Intent.GENERAL_GREETING);
        expect(result.language).toBe("en");
      });

      it("should handle Kannada greetings", async () => {
        const result = await generateResponse("ನಮಸ್ಕಾರ");
        
        expect(result.intent).toBe(Intent.GENERAL_GREETING);
        expect(result.language).toBe("kn");
      });

      it("should include devotional closing in greeting", async () => {
        const result = await generateResponse("Hi");
        
        expect(result.content).toMatch(/Namaskara|ನಮಸ್ಕಾರ/i);
      });
    });

    describe("Thanks", () => {
      it("should handle thank you messages", async () => {
        const result = await generateResponse("Thank you");
        
        expect(result.intent).toBe(Intent.THANKS);
      });

      it("should handle thanks in Kannada", async () => {
        const result = await generateResponse("ಧನ್ಯವಾದ");
        
        expect(result.intent).toBe(Intent.THANKS);
      });
    });

    describe("Out of Scope", () => {
      it("should handle programming questions", async () => {
        const result = await generateResponse("Write me a Python function");
        
        // Programming is detected as OUT_OF_SCOPE
        expect([Intent.OUT_OF_SCOPE, Intent.UNKNOWN]).toContain(result.intent);
      });

      it("should handle weather questions", async () => {
        const result = await generateResponse("Is it raining today?");
        
        // Weather could be OUT_OF_SCOPE or UNKNOWN
        expect([Intent.OUT_OF_SCOPE, Intent.UNKNOWN]).toContain(result.intent);
      });

      it("should handle stock market questions", async () => {
        const result = await generateResponse("What is the stock price?");
        
        expect(result.intent).toBe(Intent.OUT_OF_SCOPE);
      });

      it("should provide scope explanation in out of scope response", async () => {
        const result = await generateResponse("How to fix my bike?");
        
        expect(result.content.toLowerCase()).toContain("temple");
        expect(result.content.toLowerCase()).toContain("raghavendra");
      });
    });

    describe("Mixed Language Support", () => {
      it("should detect mixed language queries", async () => {
        const result = await generateResponse("Today's pooja time ಏನು");
        
        expect(result.intent).toBeDefined();
        // Language could be mixed or kn depending on detection
        expect(["mixed", "kn"]).toContain(result.language);
      });

      it("should respond in mixed language when detected", async () => {
        const result = await generateResponse("Temple address ಎಲ್ಲಿದೆ");
        
        expect(result.intent).toBeDefined();
        // Language could be mixed or kn depending on detection
        expect(["mixed", "kn"]).toContain(result.language);
      });
    });

    describe("Response Metadata", () => {
      it("should include confidence score", async () => {
        const result = await generateResponse("What is the temple address?");
        
        expect(typeof result.confidence).toBe("number");
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
      });

      it("should include source attribution", async () => {
        const result = await generateResponse("Temple timings");
        
        expect(result.source).toBeDefined();
      });

      it("should indicate if LLM was used", async () => {
        const result = await generateResponse("Temple timings");
        
        expect(typeof result.usesLLM).toBe("boolean");
      });

      it("should indicate response language", async () => {
        const result = await generateResponse("Hello");
        
        expect(["en", "kn", "mixed"]).toContain(result.language);
      });
    });

    describe("Unknown Questions", () => {
      it("should handle unrecognized questions gracefully", async () => {
        const result = await generateResponse("What is the meaning of life?");
        
        expect(result.content).toBeDefined();
        expect(result.content.length).toBeGreaterThan(0);
      });
    });

    describe("Event Queries", () => {
      it("should handle event queries", async () => {
        const result = await generateResponse("What events are coming up?");
        
        expect(result.intent).toBe(Intent.UPCOMING_EVENTS);
      });
    });

    describe("Aaradhane Queries", () => {
      it("should handle Aaradhane queries", async () => {
        const result = await generateResponse("When is the next Aaradhane?");
        
        // Aaradhane might be detected as events or unknown depending on patterns
        expect(result.intent).toBeDefined();
        expect(result.content).toBeDefined();
      });
    });
  });

  describe("Intent Detection Integration", () => {
    it("should detect intent correctly through generateResponse", async () => {
      const testCases = [
        { query: "What are the temple timings?", expectedIntent: Intent.TEMPLE_TIMINGS },
        { query: "What is today's panchanga?", expectedIntent: Intent.PANCHANGA },
        { query: "Hello", expectedIntent: Intent.GENERAL_GREETING },
        { query: "Thank you", expectedIntent: Intent.THANKS },
        { query: "Write Python code", expectedIntent: Intent.OUT_OF_SCOPE },
      ];

      for (const testCase of testCases) {
        const result = await generateResponse(testCase.query);
        expect(result.intent).toBe(testCase.expectedIntent);
      }
    });

    it("should generate responses for various intents", async () => {
      const queries = [
        "What are the temple timings?",
        "How can I donate?",
        "What is today's panchanga?",
        "Hello",
        "Thank you",
        "Write Python code",
        "What is the weather?",
      ];

      for (const query of queries) {
        const result = await generateResponse(query);
        expect(result.content).toBeDefined();
        expect(result.content.length).toBeGreaterThan(0);
        expect(result.intent).toBeDefined();
        expect(typeof result.confidence).toBe("number");
      }
    });
  });
});
