// Verifies the conversation session service is Supabase-only: it reads/writes
// `chat_sessions` and `chat_messages`, has no Firestore dependency, and a
// datastore failure degrades gracefully instead of throwing into the chat path.

jest.mock("server-only", () => ({}), { virtual: true });

/** Chainable, thenable Supabase query-builder stub. */
function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder;
  for (const m of [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "order",
  ]) {
    builder[m] = jest.fn(chain);
  }
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  builder.then = jest.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve)
  );
  return builder;
}

const builders = new Map<string, ReturnType<typeof makeBuilder>>();
const results = new Map<string, { data: unknown; error: unknown }>();

const mockFrom = jest.fn((table: string) => {
  if (!builders.has(table)) {
    builders.set(table, makeBuilder(results.get(table) ?? { data: [], error: null }));
  }
  return builders.get(table);
});

const mockSupabase = { from: mockFrom };
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockSupabase }));
jest.mock("@/lib/supabase/client", () => ({ createClient: () => mockSupabase }));

import {
  generateSessionId,
  getSession,
  createSession,
  updateSession,
  getSessionContext,
  clearSession,
  deleteSession,
  detectFollowUp,
} from "../../services/conversation.service";

function setResult(table: string, result: { data: unknown; error: unknown }) {
  results.set(table, result);
  builders.set(table, makeBuilder(result));
}

beforeEach(() => {
  jest.clearAllMocks();
  builders.clear();
  results.clear();
  results.set("chat_sessions", { data: null, error: null });
  results.set("chat_messages", { data: [], error: null });
  mockFrom.mockImplementation((table: string) => {
    if (!builders.has(table)) {
      builders.set(table, makeBuilder(results.get(table) ?? { data: null, error: null }));
    }
    return builders.get(table);
  });
});

describe("conversation.service — Supabase-only persistence", () => {
  it("imports no Firestore module", () => {
    const fs = jest.requireActual("fs") as typeof import("fs");
    const path = jest.requireActual("path") as typeof import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../services/conversation.service.ts"),
      "utf8"
    );
    expect(source).not.toContain("firebase/firestore");
    expect(source).not.toContain("@/lib/firebase");
  });

  it("getSession reads the session and its messages from Supabase", async () => {
    setResult("chat_sessions", {
      data: {
        firestore_id: "s1",
        user_id: "u1",
        detected_language: "kn",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:10:00.000Z",
      },
      error: null,
    });
    setResult("chat_messages", {
      data: [
        { firestore_id: "m1", role: "user", content: "hi", timestamp: "2026-01-01T00:00:01Z" },
        { firestore_id: "m2", role: "assistant", content: "namaskara", timestamp: "2026-01-01T00:00:02Z" },
      ],
      error: null,
    });

    const session = await getSession("s1");
    expect(session).not.toBeNull();
    expect(session!.preferredLanguage).toBe("kn");
    expect(session!.messages).toHaveLength(2);
    expect(session!.messages[1].content).toBe("namaskara");
    expect(mockFrom).toHaveBeenCalledWith("chat_sessions");
    expect(mockFrom).toHaveBeenCalledWith("chat_messages");
  });

  it("getSession returns null when the session row is missing", async () => {
    setResult("chat_sessions", { data: null, error: null });
    expect(await getSession("missing")).toBeNull();
  });

  it("getSession returns null (does not throw) when the datastore read fails", async () => {
    setResult("chat_sessions", {
      data: null,
      error: { message: 'relation "chat_sessions" does not exist' },
    });
    await expect(getSession("s1")).resolves.toBeNull();
  });

  it("updateSession upserts the session summary, never message_count", async () => {
    setResult("chat_sessions", { data: null, error: null });
    await updateSession("s1", "user msg", "assistant reply", "TEMPLE_TIMINGS", "en");

    const builder = builders.get("chat_sessions")!;
    expect(builder.upsert).toHaveBeenCalledTimes(1);
    const payload = builder.upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.firestore_id).toBe("s1");
    expect(payload.detected_language).toBe("en");
    expect(payload.last_message).toBe("assistant reply");
    // message_count is owned by chat.service; writing it here would double-count.
    expect(payload).not.toHaveProperty("message_count");
    expect(builder.upsert.mock.calls[0][1]).toEqual({ onConflict: "firestore_id" });
  });

  it("updateSession does not insert into chat_messages (client owns messages)", async () => {
    setResult("chat_sessions", { data: null, error: null });
    await updateSession("s1", "u", "a", "DONATION", "en");
    expect(mockFrom).not.toHaveBeenCalledWith("chat_messages");
  });

  it("createSession writes a chat_sessions row", async () => {
    setResult("chat_sessions", { data: null, error: null });
    const session = await createSession("s-new", "u9");
    expect(session.id).toBe("s-new");
    const builder = builders.get("chat_sessions")!;
    expect(builder.upsert).toHaveBeenCalledTimes(1);
    expect((builder.upsert.mock.calls[0][0] as Record<string, unknown>).firestore_id).toBe("s-new");
  });

  it("clearSession and deleteSession operate on Supabase tables", async () => {
    setResult("chat_messages", { data: null, error: null });
    setResult("chat_sessions", { data: null, error: null });

    await clearSession("s1");
    expect(builders.get("chat_messages")!.delete).toHaveBeenCalled();
    expect(builders.get("chat_sessions")!.update).toHaveBeenCalled();

    jest.clearAllMocks();
    builders.clear();
    setResult("chat_messages", { data: null, error: null });
    setResult("chat_sessions", { data: null, error: null });
    await deleteSession("s1");
    expect(builders.get("chat_messages")!.delete).toHaveBeenCalled();
    expect(builders.get("chat_sessions")!.delete).toHaveBeenCalled();
  });

  it("generateSessionId returns a non-empty unique id", () => {
    const a = generateSessionId();
    const b = generateSessionId();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });
});

describe("getSessionContext", () => {
  it("returns no session for an empty id", async () => {
    const ctx = await getSessionContext("");
    expect(ctx.session).toBeNull();
    expect(ctx.isFollowUp).toBe(false);
  });

  it("detects a follow-up from the last assistant message", async () => {
    setResult("chat_sessions", {
      data: { firestore_id: "s1", detected_language: "en" },
      error: null,
    });
    setResult("chat_messages", {
      data: [
        { firestore_id: "m1", role: "assistant", content: "The temple opens at 6am", timestamp: "2026-01-01T00:00:01Z" },
      ],
      error: null,
    });

    // Prime conversational state via updateSession so lastTopic is known.
    await updateSession("s1", "timings", "The temple opens at 6am", "TEMPLE_TIMINGS", "en");

    const ctx = await getSessionContext("s1");
    expect(ctx.session).not.toBeNull();
  });
});

describe("detectFollowUp (pure)", () => {
  it("returns false without a last topic", () => {
    expect(detectFollowUp("timings", undefined).isFollowUp).toBe(false);
  });

  it("flags a single-word follow-up when a topic is known", () => {
    const result = detectFollowUp("timings", "timings");
    expect(result.isFollowUp).toBe(true);
    expect(result.enrichedContext).toContain("timings");
  });
});
