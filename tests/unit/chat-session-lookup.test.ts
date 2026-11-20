// Regression coverage for the home-page AI chat session lookup.
//
// `chat_sessions.firestore_id` stores the client-generated session id, which is a
// UUID. `rowIdFilter()` chooses a single column from the id's *shape* and therefore
// emitted `id.eq.<uuid>` for these sessions, so every session lookup missed, the
// messages route answered 404 "Session not found", and per-session history (and the
// follow-up context that depends on it) never loaded.
//
// These tests assert on the filter the services actually emit, so they fail if the
// lookup regresses to matching only one column.

jest.mock("server-only", () => ({}), { virtual: true });

import { publicIdFilter, rowIdFilter } from "@/lib/supabase/identifier";

const SESSION_PUBLIC_ID = "0c534336-2138-4c6a-9545-3447f9a43e78";

/** Records the `.or()` filters passed to the Supabase query builder. */
const orFilters: string[] = [];
const eqFilters: Array<[string, unknown]> = [];

function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const m of ["select", "insert", "update", "upsert", "delete", "order"]) {
    builder[m] = jest.fn(chain);
  }
  builder.eq = jest.fn((column: string, value: unknown) => {
    eqFilters.push([column, value]);
    return builder;
  });
  builder.or = jest.fn((filter: string) => {
    orFilters.push(filter);
    return builder;
  });
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  builder.then = jest.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve)
  );
  return builder;
}

const builders = new Map<string, ReturnType<typeof makeBuilder>>();
const results = new Map<string, { data: unknown; error: unknown }>();

const mockSupabase = {
  from: jest.fn((table: string) => {
    if (!builders.has(table)) {
      builders.set(table, makeBuilder(results.get(table) ?? { data: null, error: null }));
    }
    return builders.get(table);
  }),
};

jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockSupabase }));
jest.mock("@/lib/supabase/client", () => ({ createClient: () => mockSupabase }));

import { getSession } from "../../services/conversation.service";
import { getChatSession } from "../../services/chat.server";

function setResult(table: string, result: { data: unknown; error: unknown }) {
  results.set(table, result);
  builders.set(table, makeBuilder(result));
}

beforeEach(() => {
  jest.clearAllMocks();
  builders.clear();
  results.clear();
  orFilters.length = 0;
  eqFilters.length = 0;
});

describe("publicIdFilter", () => {
  it("matches both the primary key and firestore_id for a UUID public id", () => {
    expect(publicIdFilter(SESSION_PUBLIC_ID)).toBe(
      `id.eq.${SESSION_PUBLIC_ID},firestore_id.eq.${SESSION_PUBLIC_ID}`
    );
  });

  it("omits the uuid column for a non-UUID public id", () => {
    expect(publicIdFilter("session_abc")).toBe("firestore_id.eq.session_abc");
  });

  it("differs from rowIdFilter for UUID-shaped firestore ids", () => {
    // Documents the defect: rowIdFilter picks `id` alone for this shape.
    expect(rowIdFilter(SESSION_PUBLIC_ID)).toBe(`id.eq.${SESSION_PUBLIC_ID}`);
    expect(publicIdFilter(SESSION_PUBLIC_ID)).toContain("firestore_id.eq.");
  });
});

describe("chat session lookup", () => {
  it("getSession matches the session row by firestore_id as well as id", async () => {
    setResult("chat_sessions", {
      data: {
        firestore_id: SESSION_PUBLIC_ID,
        user_id: null,
        detected_language: "en",
        created_at: "2026-11-20T05:57:26.875Z",
        updated_at: "2026-11-20T05:57:26.875Z",
      },
      error: null,
    });
    setResult("chat_messages", { data: [], error: null });

    const session = await getSession(SESSION_PUBLIC_ID);

    expect(session).not.toBeNull();
    expect(orFilters).toContain(
      `id.eq.${SESSION_PUBLIC_ID},firestore_id.eq.${SESSION_PUBLIC_ID}`
    );
  });

  it("getChatSession matches the session row by firestore_id as well as id", async () => {
    setResult("chat_sessions", {
      data: {
        firestore_id: SESSION_PUBLIC_ID,
        user_id: null,
        message_count: 2,
        last_message: "hi",
        detected_language: "en",
        created_at: "2026-11-20T05:57:26.875Z",
        updated_at: "2026-11-20T05:57:26.875Z",
      },
      error: null,
    });

    const session = await getChatSession(SESSION_PUBLIC_ID);

    expect(session).not.toBeNull();
    expect(session!.id).toBe(SESSION_PUBLIC_ID);
    expect(orFilters).toContain(
      `id.eq.${SESSION_PUBLIC_ID},firestore_id.eq.${SESSION_PUBLIC_ID}`
    );
  });
});
