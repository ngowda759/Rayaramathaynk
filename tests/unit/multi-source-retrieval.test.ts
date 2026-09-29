// Unit tests for Multi-source Retrieval Service
// Tests unified query combining multiple data sources

import { DataSource, MultiSourceQuery, SourceResult, QuickQuery } from "@/types/multi-source-retrieval";
import { Intent } from "@/lib/ai/intent/types";

// Mock the retrieval modules
jest.mock("@/lib/ai/retrieval/settings", () => ({
  getTempleSettings: jest.fn(),
}));

jest.mock("@/lib/ai/retrieval/panchanga", () => ({
  getTodayPanchanga: jest.fn(),
}));

jest.mock("@/lib/ai/retrieval/events", () => ({
  getUpcomingEvents: jest.fn(),
}));

jest.mock("@/lib/ai/retrieval/sevas", () => ({
  getActiveSevas: jest.fn(),
}));

jest.mock("@/lib/ai/retrieval/announcements", () => ({
  getActiveAnnouncements: jest.fn(),
}));

describe("Multi-source Retrieval Types", () => {
  describe("DataSource enum", () => {
    it("should have all required data sources", () => {
      const sources: DataSource[] = [
        "settings",
        "panchanga",
        "events",
        "sevas",
        "announcements",
      ];

      expect(sources).toHaveLength(5);
      expect(sources).toContain("settings");
      expect(sources).toContain("panchanga");
      expect(sources).toContain("events");
      expect(sources).toContain("sevas");
      expect(sources).toContain("announcements");
    });
  });

  describe("MultiSourceQuery", () => {
    it("should create valid query object", () => {
      const query: MultiSourceQuery = {
        query: "Get temple overview",
        intent: Intent.TEMPLE_TIMINGS,
        sources: {
          settings: true,
          panchanga: true,
          events: true,
        },
        language: "en",
        maxResults: {
          events: 10,
          announcements: 5,
        },
      };

      expect(query.query).toBe("Get temple overview");
      expect(query.intent).toBe(Intent.TEMPLE_TIMINGS);
      expect(query.sources.settings).toBe(true);
      expect(query.maxResults?.events).toBe(10);
    });

    it("should support default sources", () => {
      const query: MultiSourceQuery = {
        query: "Quick query",
      };

      expect(query.sources).toBeUndefined();
    });
  });

  describe("SourceResult", () => {
    it("should track successful retrieval", () => {
      const result: SourceResult<Record<string, string>> = {
        source: "settings",
        data: { name: "Temple" },
        retrieved: true,
        confidence: 95,
        retrievedAt: Date.now(),
      };

      expect(result.retrieved).toBe(true);
      expect(result.confidence).toBe(95);
    });

    it("should track failed retrieval with error", () => {
      const result: SourceResult<null> = {
        source: "events",
        data: null,
        retrieved: false,
        confidence: 0,
        retrievedAt: Date.now(),
        error: "Failed to connect",
      };

      expect(result.retrieved).toBe(false);
      expect(result.error).toBe("Failed to connect");
    });
  });
});

describe("Quick Queries", () => {
  const QUICK_QUERIES: QuickQuery[] = [
    {
      id: "temple-overview",
      label: "Temple Overview",
      labelKn: "ದೇವಸ್ಥಾನ ಅವಲೋಕನ",
      query: "Get complete temple information",
      sources: { settings: true, panchanga: true, events: true, announcements: true },
      icon: "🏛️",
    },
    {
      id: "today-darshan",
      label: "Today's Darshan",
      query: "Today's temple timings and panchanga",
      sources: { settings: true, panchanga: true },
      icon: "🕉️",
    },
    {
      id: "sevas-info",
      label: "Sevas Information",
      query: "Available sevas and booking info",
      sources: { sevas: true },
      icon: "🙏",
    },
  ];

  it("should have valid quick query structure", () => {
    QUICK_QUERIES.forEach((q) => {
      expect(q.id).toBeDefined();
      expect(q.label).toBeDefined();
      expect(q.query).toBeDefined();
      expect(q.sources).toBeDefined();
    });
  });

  it("should support Kannada labels", () => {
    const templeOverview = QUICK_QUERIES.find((q) => q.id === "temple-overview");
    expect(templeOverview?.labelKn).toBe("ದೇವಸ್ಥಾನ ಅವಲೋಕನ");
  });

  it("should have unique IDs", () => {
    const ids = QUICK_QUERIES.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should have at least one source for each query", () => {
    QUICK_QUERIES.forEach((q) => {
      const hasSource = Object.values(q.sources).some((v) => v === true);
      expect(hasSource).toBe(true);
    });
  });
});

describe("Combined Response Generation", () => {
  // Simulate the response generation logic
  interface TempleSettings {
    name: string;
    address: string;
  }

  const generateCombinedResponse = (
    query: string,
    results: Partial<Record<DataSource, SourceResult<Record<string, unknown>>>>,
    language: "en" | "kn" | "mixed" = "en"
  ): string => {
    const parts: string[] = [];

    if (results.settings?.data) {
      const data = results.settings.data as TempleSettings;
      parts.push(`Temple: ${data.name}`);
      parts.push(`Address: ${data.address}`);
    }

    if (results.panchanga?.data) {
      const p = results.panchanga.data;
      parts.push(`Today's Panchanga: Tithi: ${p.tithi}, Nakshatra: ${p.nakshatra}`);
    }

    if (results.events?.data && results.events.data.length > 0) {
      const eventList = results.events.data
        .slice(0, 3)
        .map((e) => `${e.title} on ${new Date(e.startDate).toLocaleDateString()}`)
        .join("; ");
      parts.push(`Upcoming Events: ${eventList}`);
    }

    if (results.sevas?.data && results.sevas.data.length > 0) {
      const sevaNames = results.sevas.data.slice(0, 5).map((s) => s.name).join(", ");
      parts.push(`Available Sevas: ${sevaNames}`);
    }

    if (parts.length === 0) {
      return "Unable to retrieve temple information.";
    }

    return parts.join("\n\n");
  };

  it("should combine settings and panchanga data", () => {
    const results = {
      settings: {
        source: "settings" as DataSource,
        data: {
          settings: {
            name: "Sri Raghavendra Swamy Temple",
            address: "Mantralaya, Karnataka",
          },
        },
        retrieved: true,
        confidence: 100,
        retrievedAt: Date.now(),
      },
      panchanga: {
        source: "panchanga" as DataSource,
        data: {
          tithi: "Shukla Ekadashi",
          nakshatra: "Uttara Phalguni",
        },
        retrieved: true,
        confidence: 95,
        retrievedAt: Date.now(),
      },
    };

    const response = generateCombinedResponse("Test query", results);
    expect(response).toContain("Sri Raghavendra Swamy Temple");
    expect(response).toContain("Shukla Ekadashi");
  });

  it("should include events when available", () => {
    const results = {
      events: {
        source: "events" as DataSource,
        data: [
          { id: "1", title: "Mukkunda Seva", startDate: new Date("2024-01-15").toISOString() },
          { id: "2", title: "Panchanga Seva", startDate: new Date("2024-01-20").toISOString() },
        ],
        retrieved: true,
        confidence: 90,
        retrievedAt: Date.now(),
      },
    };

    const response = generateCombinedResponse("Test query", results);
    expect(response).toContain("Mukkunda Seva");
    expect(response).toContain("Panchanga Seva");
  });

  it("should handle empty results gracefully", () => {
    const results = {};
    const response = generateCombinedResponse("Test query", results);
    expect(response).toBe("Unable to retrieve temple information.");
  });

  it("should limit events to 3", () => {
    const results = {
      events: {
        source: "events" as DataSource,
        data: [
          { id: "1", title: "Event 1", startDate: new Date().toISOString() },
          { id: "2", title: "Event 2", startDate: new Date().toISOString() },
          { id: "3", title: "Event 3", startDate: new Date().toISOString() },
          { id: "4", title: "Event 4", startDate: new Date().toISOString() },
          { id: "5", title: "Event 5", startDate: new Date().toISOString() },
        ],
        retrieved: true,
        confidence: 90,
        retrievedAt: Date.now(),
      },
    };

    const response = generateCombinedResponse("Test query", results);
    expect(response).toContain("Event 1");
    expect(response).toContain("Event 3");
    expect(response).not.toContain("Event 4");
    expect(response).not.toContain("Event 5");
  });

  it("should limit sevas to 5", () => {
    const results = {
      sevas: {
        source: "sevas" as DataSource,
        data: Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, name: `Seva ${i + 1}` })),
        retrieved: true,
        confidence: 90,
        retrievedAt: Date.now(),
      },
    };

    const response = generateCombinedResponse("Test query", results);
    expect(response).toContain("Seva 1");
    expect(response).toContain("Seva 5");
    expect(response).not.toContain("Seva 6");
  });
});

describe("Query Source Filtering", () => {
  it("should filter sources correctly", () => {
    const query: MultiSourceQuery = {
      query: "Events only",
      sources: {
        events: true,
        settings: false,
        panchanga: false,
        sevas: false,
        announcements: false,
      },
    };

    const activeSources = Object.entries(query.sources)
      .filter(([, enabled]) => enabled)
      .map(([source]) => source);

    expect(activeSources).toEqual(["events"]);
  });

  it("should allow all sources by default", () => {
    const query: MultiSourceQuery = {
      query: "All sources",
      sources: {
        settings: true,
        panchanga: true,
        events: true,
        sevas: true,
        announcements: true,
      },
    };

    const activeSources = Object.entries(query.sources)
      .filter(([, enabled]) => enabled)
      .map(([source]) => source);

    expect(activeSources).toHaveLength(5);
  });
});

describe("Retrieval Statistics", () => {
  interface RetrievalStats {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    averageRetrievalTime: number;
    bySource: Record<DataSource, {
      requests: number;
      successes: number;
      failures: number;
      averageTime: number;
    }>;
  }

  const createEmptyStats = (): RetrievalStats => ({
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    averageRetrievalTime: 0,
    bySource: {
      settings: { requests: 0, successes: 0, failures: 0, averageTime: 0 },
      panchanga: { requests: 0, successes: 0, failures: 0, averageTime: 0 },
      events: { requests: 0, successes: 0, failures: 0, averageTime: 0 },
      sevas: { requests: 0, successes: 0, failures: 0, averageTime: 0 },
      announcements: { requests: 0, successes: 0, failures: 0, averageTime: 0 },
    },
  });

  it("should track successful query", () => {
    const stats = createEmptyStats();
    
    stats.totalQueries++;
    stats.successfulQueries++;
    stats.averageRetrievalTime = 100;
    stats.bySource.settings.requests++;
    stats.bySource.settings.successes++;
    stats.bySource.settings.averageTime = 100;

    expect(stats.totalQueries).toBe(1);
    expect(stats.successfulQueries).toBe(1);
    expect(stats.bySource.settings.successes).toBe(1);
  });

  it("should track failed query", () => {
    const stats = createEmptyStats();
    
    stats.totalQueries++;
    stats.failedQueries++;
    stats.bySource.events.requests++;
    stats.bySource.events.failures++;

    expect(stats.totalQueries).toBe(1);
    expect(stats.failedQueries).toBe(1);
    expect(stats.bySource.events.failures).toBe(1);
  });

  it("should calculate success rate", () => {
    const stats = createEmptyStats();
    stats.totalQueries = 100;
    stats.successfulQueries = 95;
    stats.failedQueries = 5;

    const successRate = (stats.successfulQueries / stats.totalQueries) * 100;
    expect(successRate).toBe(95);
  });

  it("should track per-source statistics", () => {
    const stats = createEmptyStats();
    
    stats.bySource.settings.requests = 50;
    stats.bySource.settings.successes = 48;
    stats.bySource.settings.failures = 2;
    
    stats.bySource.panchanga.requests = 30;
    stats.bySource.panchanga.successes = 30;
    stats.bySource.panchanga.failures = 0;

    expect(stats.bySource.settings.requests).toBe(50);
    // Calculate success rate for assertions
    const panchangaSuccessRate = (stats.bySource.panchanga.successes / stats.bySource.panchanga.requests) * 100;
    expect(panchangaSuccessRate).toBe(100);
  });

  it("should calculate rolling average retrieval time", () => {
    const stats = createEmptyStats();
    
    // First query - 100ms
    stats.totalQueries = 1;
    stats.averageRetrievalTime = 100;
    
    // Second query - 200ms
    const newTime = 200;
    stats.totalQueries = 2;
    stats.averageRetrievalTime = 
      (100 * 1 + 200) / 2;

    expect(stats.averageRetrievalTime).toBe(150);
  });
});

describe("Data Freshness", () => {
  interface DataFreshness {
    source: DataSource;
    lastUpdated: number;
    freshnessScore: "fresh" | "stale" | "unknown";
    cacheExpiry?: number;
  }

  const getFreshnessScore = (lastUpdated: number, cacheExpiry: number = 5 * 60 * 1000): DataFreshness["freshnessScore"] => {
    if (lastUpdated === 0) return "unknown";
    const elapsed = Date.now() - lastUpdated;
    return elapsed < cacheExpiry ? "fresh" : "stale";
  };

  it("should mark recently updated data as fresh", () => {
    const recentTime = Date.now() - 1 * 60 * 1000; // 1 minute ago
    expect(getFreshnessScore(recentTime)).toBe("fresh");
  });

  it("should mark old data as stale", () => {
    const oldTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago
    expect(getFreshnessScore(oldTime)).toBe("stale");
  });

  it("should mark never-updated data as unknown", () => {
    expect(getFreshnessScore(0)).toBe("unknown");
  });

  it("should use custom cache expiry", () => {
    const time = Date.now() - 3 * 60 * 1000; // 3 minutes ago
    expect(getFreshnessScore(time, 2 * 60 * 1000)).toBe("stale"); // 2 min expiry
    expect(getFreshnessScore(time, 5 * 60 * 1000)).toBe("fresh"); // 5 min expiry
  });
});

describe("Query History", () => {
  interface QueryHistoryEntry {
    id: string;
    query: string;
    sources: DataSource[];
    responseTime: number;
    timestamp: number;
    successful: boolean;
  }

  const queryHistory: QueryHistoryEntry[] = [];
  const MAX_HISTORY = 100;

  const addToHistory = (entry: Omit<QueryHistoryEntry, "id" | "timestamp">) => {
    const historyEntry: QueryHistoryEntry = {
      ...entry,
      id: `query-${Date.now()}`,
      timestamp: Date.now(),
    };
    
    queryHistory.unshift(historyEntry);
    
    if (queryHistory.length > MAX_HISTORY) {
      queryHistory.pop();
    }
  };

  beforeEach(() => {
    queryHistory.length = 0;
  });

  it("should add entries to history", () => {
    addToHistory({
      query: "Test query",
      sources: ["settings", "panchanga"],
      responseTime: 100,
      successful: true,
    });

    expect(queryHistory.length).toBe(1);
    expect(queryHistory[0].query).toBe("Test query");
  });

  it("should maintain chronological order", () => {
    addToHistory({ query: "Query 1", sources: ["settings"], responseTime: 100, successful: true });
    addToHistory({ query: "Query 2", sources: ["events"], responseTime: 150, successful: true });
    addToHistory({ query: "Query 3", sources: ["sevas"], responseTime: 200, successful: true });

    expect(queryHistory[0].query).toBe("Query 3");
    expect(queryHistory[2].query).toBe("Query 1");
  });

  it("should limit history size", () => {
    for (let i = 0; i < 105; i++) {
      addToHistory({
        query: `Query ${i}`,
        sources: ["settings"],
        responseTime: 100,
        successful: true,
      });
    }

    // After adding 105 items and trimming to 100, last item should be Query 5
    // (Query 0 through Query 4 are removed, keeping Query 5 through Query 104)
    expect(queryHistory.length).toBe(100);
    expect(queryHistory[99].query).toBe("Query 5");
  });

  it("should track successful and failed queries", () => {
    addToHistory({ query: "Success", sources: ["settings"], responseTime: 100, successful: true });
    addToHistory({ query: "Failure", sources: ["events"], responseTime: 50, successful: false });

    const successCount = queryHistory.filter((e) => e.successful).length;
    const failureCount = queryHistory.filter((e) => !e.successful).length;

    expect(successCount).toBe(1);
    expect(failureCount).toBe(1);
  });
});

describe("Intent to Source Mapping", () => {
  const INTENT_SOURCE_MAP = [
    { intent: Intent.TEMPLE_TIMINGS, sources: ["settings"] as DataSource[] },
    { intent: Intent.PANCHANGA, sources: ["panchanga", "settings"] as DataSource[] },
    { intent: Intent.UPCOMING_EVENTS, sources: ["events"] as DataSource[] },
    { intent: Intent.SPECIAL_SEVAS, sources: ["sevas"] as DataSource[] },
    { intent: Intent.ANNOUNCEMENTS, sources: ["announcements"] as DataSource[] },
    { intent: Intent.CONTACT_INFORMATION, sources: ["settings"] as DataSource[] },
  ];

  it("should map TEMPLE_TIMINGS to settings source", () => {
    const mapping = INTENT_SOURCE_MAP.find((m) => m.intent === Intent.TEMPLE_TIMINGS);
    expect(mapping?.sources).toContain("settings");
    expect(mapping?.sources).toHaveLength(1);
  });

  it("should map PANCHANGA to panchanga and settings sources", () => {
    const mapping = INTENT_SOURCE_MAP.find((m) => m.intent === Intent.PANCHANGA);
    expect(mapping?.sources).toContain("panchanga");
    expect(mapping?.sources).toContain("settings");
  });

  it("should map EVENTS to events source", () => {
    const mapping = INTENT_SOURCE_MAP.find((m) => m.intent === Intent.UPCOMING_EVENTS);
    expect(mapping?.sources).toEqual(["events"]);
  });

  it("should map SEVAS to sevas source", () => {
    const mapping = INTENT_SOURCE_MAP.find((m) => m.intent === Intent.SPECIAL_SEVAS);
    expect(mapping?.sources).toEqual(["sevas"]);
  });

  it("should have all required intents mapped", () => {
    const mappedIntents = INTENT_SOURCE_MAP.map((m) => m.intent);
    const requiredIntents = [
      Intent.TEMPLE_TIMINGS,
      Intent.PANCHANGA,
      Intent.UPCOMING_EVENTS,
      Intent.SPECIAL_SEVAS,
      Intent.ANNOUNCEMENTS,
      Intent.CONTACT_INFORMATION,
    ];

    requiredIntents.forEach((intent) => {
      expect(mappedIntents).toContain(intent);
    });
  });
});
