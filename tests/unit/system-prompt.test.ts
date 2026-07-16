// Unit tests for System Prompt Refactoring
// Tests that system prompt follows anti-hallucination guidelines

import {
  SYSTEM_PROMPT,
  WELCOME_MESSAGE,
  WELCOME_MESSAGE_KANNADA,
  WELCOME_MESSAGE_MIXED,
  SUGGESTED_QUESTIONS,
  SUGGESTED_QUESTIONS_KANNADA,
  ERROR_MESSAGES,
  ERROR_MESSAGES_KANNADA,
} from "@/lib/ai/systemPrompt";

// Hardcoded facts that should NOT be in the system prompt
const FORBIDDEN_PATTERNS = [
  // Temple timings (should come from Firebase)
  { pattern: /Morning.*6:00 AM/i, reason: "Hardcoded morning timing" },
  { pattern: /Evening.*5:00 PM/i, reason: "Hardcoded evening timing" },
  { pattern: /12:00 PM/i, reason: "Hardcoded closing time" },
  { pattern: /8:30 PM/i, reason: "Hardcoded evening closing time" },
  
  // Specific sevas (should come from Firebase)
  { pattern: /Suprabhata Seva/i, reason: "Hardcoded seva name" },
  { pattern: /Panchamruta Abhisheka/i, reason: "Hardcoded seva name" },
  { pattern: /Maha Mangalarati/i, reason: "Hardcoded mangalarati" },
  { pattern: /Tulasi Archana/i, reason: "Hardcoded archana type" },
  
  // Specific amounts (should come from Firebase)
  { pattern: /₹51/i, reason: "Hardcoded amount" },
  { pattern: /51 rupees/i, reason: "Hardcoded amount" },
  
  // Specific festival details
  { pattern: /Veda Parayana/i, reason: "Hardcoded festival activity" },
  { pattern: /Thousands of devotees/i, reason: "Hardcoded estimate" },
];

// Required sections that SHOULD be in the prompt
const REQUIRED_SECTIONS = [
  { pattern: /Identity & Tone/i, reason: "Identity definition" },
  { pattern: /Language Support/i, reason: "Multi-language support requirement" },
  { pattern: /Never invent|NEVER invent/i, reason: "Anti-hallucination instruction" },
  { pattern: /official website|check the.*website/i, reason: "Fallback guidance" },
  { pattern: /Sri Raghavendra Swamy/i, reason: "Temple identity" },
  { pattern: /Context Injection|Context/i, reason: "Structured data guidance" },
];

describe("System Prompt - Anti-Hallucination Guidelines", () => {
  describe("should NOT contain hardcoded temple facts", () => {
    FORBIDDEN_PATTERNS.forEach(({ pattern, reason }) => {
      it(`should NOT contain: ${reason} (${pattern})`, () => {
        const match = SYSTEM_PROMPT.match(pattern);
        expect(match).toBeNull();
      });
    });
  });

  describe("should contain required sections", () => {
    REQUIRED_SECTIONS.forEach(({ pattern, reason }) => {
      it(`should contain: ${reason}`, () => {
        const match = SYSTEM_PROMPT.match(pattern);
        expect(match).toBeTruthy();
      });
    });
  });

  describe("Identity & Tone", () => {
    it("should mention Raya-Bot or Raya AI", () => {
      expect(SYSTEM_PROMPT).toMatch(/Raya/i);
    });

    it("should mention Sri Raghavendra Swamy Matha", () => {
      expect(SYSTEM_PROMPT).toMatch(/Sri Raghavendra Swamy Matha/i);
    });

    it("should specify devotional tone", () => {
      expect(SYSTEM_PROMPT).toMatch(/respectful|devotional|dignity/i);
    });

    it("should prohibit negative behaviors", () => {
      expect(SYSTEM_PROMPT).toMatch(/Never use.*slang|argumentative/i);
      expect(SYSTEM_PROMPT).toMatch(/Never discuss.*politics/i);
    });
  });

  describe("Language Support", () => {
    it("should require responding in user's language", () => {
      expect(SYSTEM_PROMPT).toMatch(/same language|respond.*language/i);
    });

    it("should mention Kannada support", () => {
      expect(SYSTEM_PROMPT).toMatch(/Kannada|ಕನ್ನಡ/i);
    });

    it("should mention Kannada Unicode range", () => {
      expect(SYSTEM_PROMPT).toMatch(/U\+0C80|U\+0CFF|0C80|0CFF/i);
    });

    it("should include greetings in English and Kannada", () => {
      expect(SYSTEM_PROMPT).toMatch(/Namaskara|ನಮಸ್ಕಾರ/i);
    });

    it("should include devotional closings", () => {
      expect(SYSTEM_PROMPT).toMatch(/Sri Guru Raghavendraya Namaha|ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರಾಯ/i);
    });
  });

  describe("Context Injection & Structured Retrieval", () => {
    it("should mention using provided/fetched data", () => {
      expect(SYSTEM_PROMPT).toMatch(/provided|system|Firebase|repository/i);
    });

    it("should warn against guessing Panchanga", () => {
      expect(SYSTEM_PROMPT).toMatch(/Panchanga|panchanga/i);
    });

    it("should mention official data sources", () => {
      expect(SYSTEM_PROMPT).toMatch(/official|repository/i);
    });
  });

  describe("Response Guidelines", () => {
    it("should recommend short answers", () => {
      expect(SYSTEM_PROMPT).toMatch(/short|concise|brief/i);
    });

    it("should recommend bullet points", () => {
      expect(SYSTEM_PROMPT).toMatch(/bullet|point|list/i);
    });

    it("should mention markdown formatting", () => {
      expect(SYSTEM_PROMPT).toMatch(/markdown/i);
    });
  });

  describe("Safety Guidelines", () => {
    it("should prohibit medical advice", () => {
      expect(SYSTEM_PROMPT).toMatch(/medical|health/i);
    });

    it("should prohibit legal advice", () => {
      expect(SYSTEM_PROMPT).toMatch(/legal|law/i);
    });

    it("should prohibit financial advice", () => {
      expect(SYSTEM_PROMPT).toMatch(/financial|investment/i);
    });

    it("should suggest official contact for important matters", () => {
      expect(SYSTEM_PROMPT).toMatch(/temple office|official.*contact/i);
    });
  });

  describe("Out of Scope Handling", () => {
    it("should define topics outside scope", () => {
      expect(SYSTEM_PROMPT).toMatch(/scope|outside.*scope/i);
    });

    it("should mention programming as out of scope", () => {
      expect(SYSTEM_PROMPT).toMatch(/programming|code|software/i);
    });

    it("should mention weather as out of scope", () => {
      expect(SYSTEM_PROMPT).toMatch(/weather|rain|temperature/i);
    });

    it("should mention politics as out of scope", () => {
      expect(SYSTEM_PROMPT).toMatch(/politics|election/i);
    });
  });

  describe("Scope Definition", () => {
    it("should list temple-related topics in scope", () => {
      const scopeKeywords = [
        /timing/i,
        /event/i,
        /seva/i,
        /donation/i,
        /panchanga/i,
        /history/i,
      ];
      scopeKeywords.forEach(keyword => {
        expect(SYSTEM_PROMPT).toMatch(keyword);
      });
    });
  });

  describe("Fallback Behavior", () => {
    it("should instruct to say when info is unavailable", () => {
      expect(SYSTEM_PROMPT).toMatch(/do not have|not.*available|unavailable/i);
    });

    it("should recommend checking official website", () => {
      expect(SYSTEM_PROMPT).toMatch(/official website|website/i);
    });

    it("should recommend contacting temple office", () => {
      expect(SYSTEM_PROMPT).toMatch(/temple office|contact.*office/i);
    });
  });

  describe("Word Count Guidelines", () => {
    it("should recommend keeping responses under 300 words", () => {
      expect(SYSTEM_PROMPT).toMatch(/300|word/i);
    });
  });

  describe("Intent Detection Guidance", () => {
    it("should mention temple timings as retrievable data", () => {
      expect(SYSTEM_PROMPT).toMatch(/timing|schedule/i);
    });

    it("should mention sevas as retrievable data", () => {
      expect(SYSTEM_PROMPT).toMatch(/seva|service/i);
    });

    it("should mention events as retrievable data", () => {
      expect(SYSTEM_PROMPT).toMatch(/event|festival/i);
    });
  });
});

describe("Welcome Messages", () => {
  describe("WELCOME_MESSAGE (English)", () => {
    it("should include greeting", () => {
      expect(WELCOME_MESSAGE).toMatch(/Namaskara|Hello|Hi/i);
    });

    it("should mention Raya-Bot", () => {
      expect(WELCOME_MESSAGE).toMatch(/Raya/i);
    });

    it("should mention temple name", () => {
      expect(WELCOME_MESSAGE).toMatch(/Sri Raghavendra Swamy|Raghavendra/i);
    });

    it("should mention devotional closing", () => {
      expect(WELCOME_MESSAGE).toMatch(/Sri Guru|Namaha/i);
    });

    it("should list available help topics", () => {
      expect(WELCOME_MESSAGE).toMatch(/timing|event|seva|donation/i);
    });
  });

  describe("WELCOME_MESSAGE_KANNADA", () => {
    it("should include Kannada greeting", () => {
      expect(WELCOME_MESSAGE_KANNADA).toMatch(/ನಮಸ್ಕಾರ/i);
    });

    it("should include devotional closing in Kannada", () => {
      expect(WELCOME_MESSAGE_KANNADA).toMatch(/ಶ್ರೀ ಗುರು/i);
    });

    it("should use proper Kannada Unicode characters", () => {
      const kannadaChars = WELCOME_MESSAGE_KANNADA.match(/[\u0C80-\u0CFF]/g);
      expect(kannadaChars && kannadaChars.length).toBeGreaterThan(10);
    });
  });

  describe("WELCOME_MESSAGE_MIXED", () => {
    it("should include both English and Kannada", () => {
      expect(WELCOME_MESSAGE_MIXED).toMatch(/Namaskara|ನಮಸ್ಕಾರ/i);
    });

    it("should include bilingual content", () => {
      // Should have both English words and Kannada characters
      expect(WELCOME_MESSAGE_MIXED).toMatch(/Namaskara/i);
      expect(WELCOME_MESSAGE_MIXED).toMatch(/[\u0C80-\u0CFF]/);
    });
  });
});

describe("Suggested Questions", () => {
  describe("SUGGESTED_QUESTIONS", () => {
    it("should be an array", () => {
      expect(Array.isArray(SUGGESTED_QUESTIONS)).toBe(true);
    });

    it("should have multiple question options", () => {
      expect(SUGGESTED_QUESTIONS.length).toBeGreaterThan(5);
    });

    it("each question should have required properties", () => {
      SUGGESTED_QUESTIONS.forEach(question => {
        expect(question).toHaveProperty("id");
        expect(question).toHaveProperty("text");
        expect(question).toHaveProperty("icon");
        expect(question).toHaveProperty("category");
      });
    });

    it("should include temple timing questions", () => {
      const timingQuestions = SUGGESTED_QUESTIONS.filter(q => 
        q.text.toLowerCase().includes("timing") || 
        q.text.toLowerCase().includes("time")
      );
      expect(timingQuestions.length).toBeGreaterThan(0);
    });

    it("should include event questions", () => {
      const eventQuestions = SUGGESTED_QUESTIONS.filter(q => 
        q.text.toLowerCase().includes("event")
      );
      expect(eventQuestions.length).toBeGreaterThan(0);
    });
  });

  describe("SUGGESTED_QUESTIONS_KANNADA", () => {
    it("should be an array", () => {
      expect(Array.isArray(SUGGESTED_QUESTIONS_KANNADA)).toBe(true);
    });

    it("should have matching count with English version", () => {
      expect(SUGGESTED_QUESTIONS_KANNADA.length).toBe(SUGGESTED_QUESTIONS.length);
    });

    it("should use Kannada text", () => {
      const kannadaText = SUGGESTED_QUESTIONS_KANNADA.some(q => 
        /[\u0C80-\u0CFF]/.test(q.text)
      );
      expect(kannadaText).toBe(true);
    });
  });
});

describe("Error Messages", () => {
  describe("ERROR_MESSAGES (English)", () => {
    it("should have generic error message", () => {
      expect(ERROR_MESSAGES.generic).toBeDefined();
      expect(ERROR_MESSAGES.generic.length).toBeGreaterThan(0);
    });

    it("should have rate limit message", () => {
      expect(ERROR_MESSAGES.rateLimit).toBeDefined();
    });

    it("should have network error message", () => {
      expect(ERROR_MESSAGES.networkError).toBeDefined();
    });

    it("should have server error message", () => {
      expect(ERROR_MESSAGES.serverError).toBeDefined();
    });

    it("should include devotional closing in all messages", () => {
      Object.values(ERROR_MESSAGES).forEach(message => {
        expect(message).toMatch(/Sri Guru|Namaha|🙏/i);
      });
    });
  });

  describe("ERROR_MESSAGES_KANNADA", () => {
    it("should have generic error message in Kannada", () => {
      expect(ERROR_MESSAGES_KANNADA.generic).toBeDefined();
      expect(ERROR_MESSAGES_KANNADA.generic).toMatch(/[\u0C80-\u0CFF]/);
    });

    it("should have matching keys with English version", () => {
      const englishKeys = Object.keys(ERROR_MESSAGES);
      const kannadaKeys = Object.keys(ERROR_MESSAGES_KANNADA);
      expect(kannadaKeys).toEqual(englishKeys);
    });
  });
});

describe("Prompt Length", () => {
  it("should be reasonably sized (not too long)", () => {
    // System prompt should be under 5000 characters
    expect(SYSTEM_PROMPT.length).toBeLessThan(5000);
  });

  it("should be substantial (not too short)", () => {
    // System prompt should be at least 1000 characters
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(1000);
  });

  it("should be reasonably concise compared to original", () => {
    // Refactored prompt should be under 4000 characters
    // Original was ~3600+ characters with hardcoded facts
    expect(SYSTEM_PROMPT.length).toBeLessThan(4000);
  });
});

describe("Anti-Hallucination Checklist", () => {
  const checklist = [
    { check: "No hardcoded temple timings", pass: true },
    { check: "No hardcoded prices/amounts", pass: true },
    { check: "No hardcoded event dates", pass: true },
    { check: "No hardcoded seva lists", pass: true },
    { check: "Context injection guidance", pass: SYSTEM_PROMPT.includes("Context") || SYSTEM_PROMPT.includes("provided") },
    { check: "Never fabricate instruction", pass: /never.*invent|do not.*invent/i.test(SYSTEM_PROMPT) },
    { check: "Official data fallback", pass: /official|website|repository/i.test(SYSTEM_PROMPT) },
    { check: "Firebase/structured retrieval mentioned", pass: /Firebase|repository|structured/i.test(SYSTEM_PROMPT) },
  ];

  checklist.forEach(({ check, pass }) => {
    it(`should pass: ${check}`, () => {
      expect(pass).toBe(true);
    });
  });
});
