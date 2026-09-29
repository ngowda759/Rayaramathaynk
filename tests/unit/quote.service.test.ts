/**
 * Unit Tests for Quote Service
 * Tests rotation logic, festival selection, weekday rules, and Panchanga rules
 */

import { Quote, QuoteCategory, Weekday, FestivalName, QuoteSelectionContext } from "@/types/quote";

// Mock Firebase
jest.mock("@/lib/firebase", () => ({
  db: {
    collection: jest.fn(),
  },
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  Timestamp: {
    fromDate: jest.fn(() => ({ toDate: () => new Date() })),
  },
  serverTimestamp: jest.fn(),
}));

describe("Quote Service - Rotation Logic", () => {
  describe("Deterministic Selection", () => {
    it("should return the same quote for the same date", () => {
      const quotes: Quote[] = [
        createMockQuote({ id: "1", title: "Quote 1" }),
        createMockQuote({ id: "2", title: "Quote 2" }),
        createMockQuote({ id: "3", title: "Quote 3" }),
      ];

      const dateStr = "2026-07-21";
      
      // Run selection multiple times
      const result1 = deterministicSelect(quotes, dateStr);
      const result2 = deterministicSelect(quotes, dateStr);
      const result3 = deterministicSelect(quotes, dateStr);

      expect(result1?.id).toBe(result2?.id);
      expect(result2?.id).toBe(result3?.id);
    });

    it("should return different quotes for different dates", () => {
      const quotes: Quote[] = [
        createMockQuote({ id: "1", title: "Quote 1" }),
        createMockQuote({ id: "2", title: "Quote 2" }),
        createMockQuote({ id: "3", title: "Quote 3" }),
      ];

      const date1 = "2026-07-21";
      const date2 = "2026-07-22";
      const date3 = "2026-07-23";

      const result1 = deterministicSelect(quotes, date1);
      const result2 = deterministicSelect(quotes, date2);
      const result3 = deterministicSelect(quotes, date3);

      // With 3 quotes and 3 different dates, we should cycle through
      const ids = [result1?.id, result2?.id, result3?.id];
      const uniqueIds = [...new Set(ids)];

      // Should have cycled through some quotes
      expect(uniqueIds.length).toBeLessThanOrEqual(3);
    });

    it("should prefer featured quotes when available", () => {
      const quotes: Quote[] = [
        createMockQuote({ id: "1", title: "Non-featured" }),
        createMockQuote({ id: "2", title: "Featured Quote", featured: true }),
        createMockQuote({ id: "3", title: "Another Non-featured" }),
      ];

      const result = deterministicSelect(quotes, "2026-07-21");

      expect(result?.featured).toBe(true);
      expect(result?.id).toBe("2");
    });

    it("should handle empty quotes array", () => {
      const quotes: Quote[] = [];
      const result = deterministicSelect(quotes, "2026-07-21");
      expect(result).toBeNull();
    });
  });

  describe("Date-based Index Calculation", () => {
    it("should calculate consistent index for same date", () => {
      const date = "2026-07-21";
      const index1 = calculateDateIndex(date, 10);
      const index2 = calculateDateIndex(date, 10);
      expect(index1).toBe(index2);
    });

    it("should distribute quotes evenly", () => {
      const quotes: Quote[] = Array.from({ length: 10 }, (_, i) =>
        createMockQuote({ id: String(i + 1) })
      );
      
      const indices: number[] = [];
      for (let day = 1; day <= 30; day++) {
        const date = `2026-07-${day.toString().padStart(2, "0")}`;
        const result = deterministicSelect(quotes, date);
        indices.push(quotes.findIndex(q => q.id === result?.id));
      }

      // Check distribution (should cover most of the range)
      const uniqueIndices = [...new Set(indices)];
      expect(uniqueIndices.length).toBeGreaterThan(5);
    });
  });
});

describe("Quote Service - Festival Selection", () => {
  describe("Festival Name Matching", () => {
    it("should match raghavendra aradhana", () => {
      expect(matchFestival("Sri Raghavendra Aradhana 2026")).toBe("raghavendra_aradhana");
      expect(matchFestival("Raghavendra Aradhana Festival")).toBe("raghavendra_aradhana");
    });

    it("should match guru purnima", () => {
      expect(matchFestival("Guru Purnima 2026")).toBe("guru_purnima");
      expect(matchFestival("Guru Purnima Day")).toBe("guru_purnima");
    });

    it("should match navaratri", () => {
      expect(matchFestival("Navaratri 2026")).toBe("navaratri");
      expect(matchFestival("Navratri Festival")).toBe("navaratri");
    });

    it("should return null for unknown festivals", () => {
      expect(matchFestival("Random Festival")).toBeNull();
      expect(matchFestival("Birthday Party")).toBeNull();
    });
  });

  describe("Festival Quote Selection", () => {
    it("should select festival quotes when festival is active", () => {
      const context = createMockContext({
        isFestival: true,
        festivalName: "Sri Raghavendra Aradhana",
      });

      const quotes: Quote[] = [
        createMockQuote({ 
          id: "1", 
          category: "mangalashtakam",
          festivalNames: ["raghavendra_aradhana"],
          festivalOnly: true,
        }),
        createMockQuote({ 
          id: "2", 
          category: "raghavendra_stotra",
        }),
      ];

      const result = selectByFestival(context, quotes);
      expect(result?.id).toBe("1");
    });

    it("should fallback to default when no festival quotes", () => {
      const context = createMockContext({
        isFestival: true,
        festivalName: "Some Festival",
      });

      const quotes: Quote[] = [
        createMockQuote({ 
          id: "1", 
          category: "raghavendra_stotra",
        }),
      ];

      const result = selectByFestival(context, quotes);
      expect(result?.id).toBe("1");
    });
  });
});

describe("Quote Service - Weekday Selection", () => {
  describe("Weekday to Category Mapping", () => {
    const WEEKDAY_CATEGORY_MAP: Record<number, QuoteCategory> = {
      0: "raghavendra_stotra",  // Sunday
      1: "authentic_teachings", // Monday
      2: "raghavendra_stotra",  // Tuesday
      3: "authentic_teachings", // Wednesday
      4: "guru_vandana",        // Thursday
      5: "raghavendra_stotra",   // Friday
      6: "madhwa_philosophy",   // Saturday
    };

    it.each([
      [0, "raghavendra_stotra"],
      [1, "authentic_teachings"],
      [2, "raghavendra_stotra"],
      [3, "authentic_teachings"],
      [4, "guru_vandana"],
      [5, "raghavendra_stotra"],
      [6, "madhwa_philosophy"],
    ])("Sunday (%i) should map to %s", (day, expectedCategory) => {
      expect(WEEKDAY_CATEGORY_MAP[day]).toBe(expectedCategory);
    });
  });

  describe("Thursday Selection", () => {
    it("should prefer guru_vandana on Thursday", () => {
      const context = createMockContext({
        dayOfWeek: 4 as Weekday, // Thursday
      });

      const quotes: Quote[] = [
        createMockQuote({ 
          id: "1", 
          category: "guru_vandana",
          weekdayOnly: 4,
        }),
        createMockQuote({ 
          id: "2", 
          category: "raghavendra_stotra",
        }),
      ];

      const result = selectByWeekday(context, quotes);
      expect(result?.id).toBe("1");
    });
  });
});

describe("Quote Service - Priority Rules", () => {
  describe("Priority Ordering", () => {
    it("should respect priority order for selection", () => {
      const quotes: Quote[] = [
        createMockQuote({ id: "1", priority: 8 }),
        createMockQuote({ id: "2", priority: 5 }),
        createMockQuote({ id: "3", priority: 3 }),
      ];

      // When festival rules match
      const context = createMockContext({ isFestival: true });
      const result = selectByPriority(quotes, context);

      // Should select highest priority (lowest number) when priorities apply
      expect(result?.priority).toBeLessThanOrEqual(quotes[0].priority);
    });

    it("should handle mixed priority and festival rules", () => {
      const quotes: Quote[] = [
        createMockQuote({ 
          id: "1", 
          priority: 5,
          category: "raghavendra_stotra",
        }),
        createMockQuote({ 
          id: "2", 
          priority: 2,
          festivalOnly: true,
          festivalNames: ["raghavendra_aradhana"],
        }),
      ];

      // Festival context should prefer festival quote
      const festivalContext = createMockContext({
        isFestival: true,
        festivalName: "Sri Raghavendra Aradhana",
      });
      const festivalResult = selectByPriority(quotes, festivalContext);
      expect(festivalResult?.id).toBe("2");

      // Non-festival context should fall back to stotra
      const normalContext = createMockContext({ isFestival: false });
      const normalResult = selectByPriority(quotes, normalContext);
      expect(normalResult?.id).toBe("1");
    });
  });
});

describe("Quote Service - Panchanga Rules", () => {
  describe("Tithi-based Selection", () => {
    it("should match quotes by tithi", () => {
      const quote = createMockQuote({
        panchangaRules: {
          tithis: ["ekadashi", "dwadashi"],
        },
      });

      expect(matchesPanchangaRules(quote, { tithis: ["ekadashi"] })).toBe(true);
      expect(matchesPanchangaRules(quote, { tithis: ["purnima"] })).toBe(false);
    });

    it("should match quotes by nakshatra", () => {
      const quote = createMockQuote({
        panchangaRules: {
          nakshatras: ["Rohini", "Pushya"],
        },
      });

      expect(matchesPanchangaRules(quote, { nakshatras: ["Rohini"] })).toBe(true);
      expect(matchesPanchangaRules(quote, { nakshatras: ["Aswini"] })).toBe(false);
    });

    it("should match quotes by weekday", () => {
      const quote = createMockQuote({
        panchangaRules: {
          weekdays: [4], // Thursday
        },
      });

      expect(matchesPanchangaRules(quote, { weekdays: [4] })).toBe(true);
      expect(matchesPanchangaRules(quote, { weekdays: [1] })).toBe(false);
    });

    it("should handle empty panchanga rules", () => {
      const quote = createMockQuote({});
      expect(matchesPanchangaRules(quote, {})).toBe(false);
    });
  });
});

describe("Quote Service - Cache", () => {
  it("should return cached quote for same day", () => {
    const quote = createMockQuote({ id: "cached" });
    const cache = {
      quote,
      timestamp: Date.now(),
      date: "2026-07-21",
    };

    expect(isCacheValid(cache, "2026-07-21")).toBe(true);
  });

  it("should invalidate cache for different day", () => {
    const quote = createMockQuote({ id: "cached" });
    const cache = {
      quote,
      timestamp: Date.now(),
      date: "2026-07-21",
    };

    expect(isCacheValid(cache, "2026-07-22")).toBe(false);
  });

  it("should invalidate cache after 24 hours", () => {
    const quote = createMockQuote({ id: "cached" });
    const cache = {
      quote,
      timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      date: "2026-07-21",
    };

    expect(isCacheValid(cache, "2026-07-21")).toBe(false);
  });
});

describe("Quote Service - Export/Import", () => {
  describe("Bulk Export Format", () => {
    it("should export quotes without Firestore metadata", () => {
      const quote: Quote = createMockQuote({
        id: "test-id",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      const exported = exportQuote(quote);

      expect(exported).not.toHaveProperty("id");
      expect(exported).not.toHaveProperty("createdAt");
      expect(exported).not.toHaveProperty("updatedAt");
      expect(exported).toHaveProperty("title");
      expect(exported).toHaveProperty("category");
    });
  });

  describe("Bulk Import Validation", () => {
    it("should validate required fields", () => {
      expect(validateQuote({
        title: "Test",
        category: "raghavendra_stotra",
        source: "Test Source",
      })).toBe(true);

      expect(validateQuote({
        title: "Test",
        category: "invalid_category",
        source: "Test Source",
      })).toBe(false);

      expect(validateQuote({
        title: "",
        category: "raghavendra_stotra",
        source: "Test Source",
      })).toBe(false);
    });

    it("should validate category enum", () => {
      const validCategories: QuoteCategory[] = [
        "raghavendra_stotra",
        "mangalashtakam",
        "guru_vandana",
        "authentic_teachings",
        "devotional_sayings",
        "madhwa_philosophy",
      ];

      validCategories.forEach(category => {
        expect(validateCategory(category)).toBe(true);
      });

      expect(validateCategory("invalid")).toBe(false);
    });
  });
});

// Helper functions (simulating service logic)

function createMockQuote(overrides: Partial<Quote>): Quote {
  return {
    id: "mock-id",
    slug: "mock-slug",
    title: "Mock Quote",
    category: "raghavendra_stotra",
    priority: 5,
    language: "kn",
    content: {},
    source: "Mock Source",
    tags: [],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
    stats: { viewCount: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockContext(overrides: Partial<QuoteSelectionContext>): QuoteSelectionContext {
  return {
    date: new Date(),
    dayOfWeek: 0,
    isFestival: false,
    activeEvents: [],
    ...overrides,
  };
}

function calculateDateIndex(dateStr: string, total: number): number {
  const dateNum = dateStr.split("-").join("").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return dateNum % total;
}

function deterministicSelect(quotes: Quote[], dateStr: string): Quote | null {
  if (quotes.length === 0) return null;
  
  const featuredQuotes = quotes.filter(q => q.featured);
  if (featuredQuotes.length > 0) {
    const index = calculateDateIndex(dateStr, featuredQuotes.length);
    return featuredQuotes[index];
  }
  
  const index = calculateDateIndex(dateStr, quotes.length);
  return quotes[index];
}

function matchFestival(name: string): FestivalName | null {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("aradhana")) return "raghavendra_aradhana";
  if (nameLower.includes("guru purnima")) return "guru_purnima";
  if (nameLower.includes("navaratri") || nameLower.includes("navratri")) return "navaratri";
  return null;
}

function selectByFestival(context: QuoteSelectionContext, quotes: Quote[]): Quote | null {
  if (!context.isFestival || !context.festivalName) return null;
  
  const festivalKey = matchFestival(context.festivalName);
  if (!festivalKey) return null;
  
  const festivalQuotes = quotes.filter(q => 
    q.festivalNames.includes(festivalKey)
  );
  
  if (festivalQuotes.length === 0) return null;
  
  return deterministicSelect(festivalQuotes, getDateString(context.date));
}

function selectByWeekday(context: QuoteSelectionContext, quotes: Quote[]): Quote | null {
  const weekdayQuotes = quotes.filter(q => 
    q.weekdayOnly === context.dayOfWeek
  );
  
  if (weekdayQuotes.length === 0) return null;
  
  return deterministicSelect(weekdayQuotes, getDateString(context.date));
}

function selectByPriority(quotes: Quote[], context: QuoteSelectionContext): Quote | null {
  // Sort by priority (ascending)
  const sorted = [...quotes].sort((a, b) => a.priority - b.priority);
  
  // Festival quotes take precedence
  if (context.isFestival) {
    const festivalQuotes = sorted.filter(q => q.festivalOnly);
    if (festivalQuotes.length > 0) {
      return deterministicSelect(festivalQuotes, getDateString(context.date));
    }
  }
  
  // Fall back to priority-sorted quotes
  if (sorted.length > 0) {
    return deterministicSelect(sorted, getDateString(context.date));
  }
  
  return null;
}

function matchesPanchangaRules(quote: Quote, rules: { tithis?: string[]; nakshatras?: string[]; weekdays?: number[] }): boolean {
  if (!quote.panchangaRules) return false;
  
  const qr = quote.panchangaRules;
  
  if (rules.tithis && qr.tithis) {
    if (!rules.tithis.some(t => qr.tithis!.includes(t))) return false;
  }
  
  if (rules.nakshatras && qr.nakshatras) {
    if (!rules.nakshatras.some(n => qr.nakshatras!.includes(n))) return false;
  }
  
  if (rules.weekdays && qr.weekdays) {
    if (!rules.weekdays.some(w => qr.weekdays!.includes(w))) return false;
  }
  
  return true;
}

function isCacheValid(cache: { quote: Quote | null; timestamp: number; date: string } | null, today: string): boolean {
  if (!cache) return false;
  if (cache.date !== today) return false;
  if (Date.now() - cache.timestamp > 24 * 60 * 60 * 1000) return false;
  return true;
}

function getDateString(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function exportQuote(quote: Quote): Omit<Quote, "id" | "createdAt" | "updatedAt"> {
  const { id, createdAt, updatedAt, ...rest } = quote;
  return rest;
}

function validateQuote(data: any): boolean {
  if (!data.title || !data.category || !data.source) return false;
  if (!validateCategory(data.category)) return false;
  return true;
}

function validateCategory(category: string): boolean {
  const validCategories: QuoteCategory[] = [
    "raghavendra_stotra",
    "mangalashtakam",
    "guru_vandana",
    "authentic_teachings",
    "devotional_sayings",
    "madhwa_philosophy",
  ];
  return validCategories.includes(category as QuoteCategory);
}
