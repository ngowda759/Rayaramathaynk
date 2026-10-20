// Verifies the AI analytics service maps the ACTUAL Supabase columns, and that
// a failed/missing table surfaces as an error instead of silently reporting
// zero metrics.

jest.mock("server-only", () => ({}), { virtual: true });

/** Chainable Supabase query-builder stub. */
function makeQueryBuilder(result: { data: unknown; error: unknown; count?: number | null }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder;
  builder.select = jest.fn(chain);
  builder.insert = jest.fn(chain);
  builder.update = jest.fn(chain);
  builder.gte = jest.fn(chain);
  builder.lte = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(chain);
  builder.limit = jest.fn(chain);
  builder.single = jest.fn(() => Promise.resolve(result));
  // Awaiting the builder itself resolves to the result (PostgREST thenable).
  builder.then = jest.fn((resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve));
  return builder;
}

const tableResults = new Map<string, { data: unknown; error: unknown; count?: number | null }>();
const tableBuilders = new Map<string, ReturnType<typeof makeQueryBuilder>>();

const mockFrom = jest.fn((table: string) => {
  if (!tableBuilders.has(table)) {
    tableBuilders.set(table, makeQueryBuilder(tableResults.get(table) ?? { data: [], error: null }));
  }
  return tableBuilders.get(table);
});

const mockSupabase = { from: mockFrom };
jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockSupabase,
}));
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

import {
  getLatencyMetrics,
  getIntentDistribution,
  getUnknownQuestions,
  getTokenUsage,
  recordTokenUsage,
  recordLatency,
  checkAIHealth,
  getAnalyticsDashboard,
} from "../../services/ai-analytics.service";

function setTableResult(
  table: string,
  result: { data: unknown; error: unknown; count?: number | null }
) {
  tableResults.set(table, result);
  tableBuilders.set(table, makeQueryBuilder(result));
}

beforeEach(() => {
  jest.clearAllMocks();
  tableResults.clear();
  tableBuilders.clear();
  tableResults.set("ai_latency_records", { data: [], error: null });
  tableResults.set("ai_intent_distribution", { data: [], error: null });
  tableResults.set("unknown_questions", { data: [], error: null });
  tableResults.set("chat_sessions", { data: null, error: null, count: 0 });
  tableResults.set("chat_messages", { data: null, error: null, count: 0 });
});

describe("AI analytics — schema compatibility", () => {
  it("maps ai_latency_records rows using the real column names", async () => {
    setTableResult("ai_latency_records", {
      data: [
        {
          id: "l1",
          session_id: "s1",
          total_latency: 120,
          intent_detection_time: 10,
          retrieval_time: 30,
          generation_time: 80,
          timestamp: "2026-01-01T00:00:00.000Z",
          success: true,
          error_type: null,
          model: "gpt-4o-mini",
        },
      ],
      error: null,
    });

    const response = await getLatencyMetrics({ limit: 10 });
    expect(response.records).toHaveLength(1);
    const record = response.records[0];
    expect(record.sessionId).toBe("s1");
    expect(record.totalLatency).toBe(120);
    expect(record.intentDetectionTime).toBe(10);
    expect(record.retrievalTime).toBe(30);
    expect(record.generationTime).toBe(80);
    expect(record.success).toBe(true);
    // The service must query the real table, never a fabricated one.
    expect(mockFrom).toHaveBeenCalledWith("ai_latency_records");
  });

  it("maps ai_intent_distribution rows using the real column names", async () => {
    setTableResult("ai_intent_distribution", {
      data: [
        {
          id: "i1",
          session_id: "s1",
          message_id: "m1",
          intent: "TEMPLE_TIMINGS",
          category: "information",
          language: "kn",
          confidence: 88,
          timestamp: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const response = await getIntentDistribution({ limit: 10 });
    expect(response.records).toHaveLength(1);
    expect(response.records[0].intent).toBe("TEMPLE_TIMINGS");
    expect(response.records[0].language).toBe("kn");
    expect(response.records[0].messageId).toBe("m1");
    expect(mockFrom).toHaveBeenCalledWith("ai_intent_distribution");
  });

  it("maps unknown_questions rows, deriving reviewed state from status", async () => {
    setTableResult("unknown_questions", {
      data: [
        {
          id: "u1",
          session_id: "s1",
          question: "When is the next aaradhane?",
          detected_intent: "NEXT_AARADHANE",
          confidence: 40,
          language: "en",
          timestamp: "2026-01-01T00:00:00.000Z",
          status: "reviewed",
          reviewed_by: "admin-1",
          reviewed_at: "2026-01-02T00:00:00.000Z",
          added_to_knowledge_article_id: "k1",
        },
      ],
      error: null,
    });

    const response = await getUnknownQuestions({ limit: 10 });
    expect(response.records).toHaveLength(1);
    expect(response.records[0].question).toBe("When is the next aaradhane?");
    expect(response.records[0].reviewed).toBe(true);
    expect(response.records[0].addedToKnowledge).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("unknown_questions");
  });
});

describe("AI analytics — no silent zeros", () => {
  it("getLatencyMetrics rethrows a query failure instead of returning zero metrics", async () => {
    setTableResult("ai_latency_records", {
      data: null,
      error: { message: 'relation "ai_latency_records" does not exist' },
    });

    await expect(getLatencyMetrics({ limit: 10 })).rejects.toBeDefined();
  });

  it("getIntentDistribution rethrows a query failure", async () => {
    setTableResult("ai_intent_distribution", {
      data: null,
      error: { message: 'relation "ai_intent_distribution" does not exist' },
    });

    await expect(getIntentDistribution({ limit: 10 })).rejects.toBeDefined();
  });

  it("getUnknownQuestions rethrows a query failure", async () => {
    setTableResult("unknown_questions", {
      data: null,
      error: { message: 'relation "unknown_questions" does not exist' },
    });

    await expect(getUnknownQuestions({ limit: 10 })).rejects.toBeDefined();
  });

  it("getAnalyticsDashboard rethrows when the chat_sessions count query fails", async () => {
    setTableResult("chat_sessions", {
      data: null,
      error: { message: 'relation "chat_sessions" does not exist' },
      count: null,
    });

    await expect(getAnalyticsDashboard()).rejects.toBeDefined();
  });

  it("checkAIHealth reports an explicit issue (not a healthy zero) when metrics fail", async () => {
    setTableResult("ai_latency_records", {
      data: null,
      error: { message: "datastore unavailable" },
    });

    const health = await checkAIHealth();
    expect(health.status.status).toBe("unhealthy");
    expect(health.status.issues).toHaveLength(1);
    expect(health.status.issues[0].message).toMatch(/unavailable, not zero/i);
  });
});

describe("AI analytics — token usage has no destination table", () => {
  it("getTokenUsage reports itself unavailable rather than fabricating zeros", async () => {
    const response = await getTokenUsage();
    expect(response.available).toBe(false);
    expect(response.unavailableReason).toMatch(/ai_token_usage/);
    expect(mockFrom).not.toHaveBeenCalledWith("ai_token_usage");
  });

  it("recordTokenUsage refuses to write instead of silently discarding the record", async () => {
    await expect(
      recordTokenUsage({
        sessionId: "s1",
        messageId: "m1",
        intent: "TEMPLE_TIMINGS",
        model: "gpt-4o-mini",
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        estimatedCost: 0.001,
      })
    ).rejects.toThrow(/ai_token_usage/);
    expect(mockFrom).not.toHaveBeenCalledWith("ai_token_usage");
  });
});

describe("AI analytics — latency writes use real columns", () => {
  it("recordLatency inserts the SQL columns (including model)", async () => {
    const builder = makeQueryBuilder({ data: { id: "l1" }, error: null });
    tableBuilders.set("ai_latency_records", builder);
    mockFrom.mockImplementation((table: string) =>
      table === "ai_latency_records" ? builder : tableBuilders.get(table)
    );

    await recordLatency({
      sessionId: "s1",
      totalLatency: 100,
      intentDetectionTime: 5,
      retrievalTime: 20,
      generationTime: 75,
      success: true,
      model: "gpt-4o-mini",
    });

    expect(builder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        total_latency: 100,
        intent_detection_time: 5,
        retrieval_time: 20,
        generation_time: 75,
        model: "gpt-4o-mini",
        session_id: "s1",
      }),
    ]);
  });
});
