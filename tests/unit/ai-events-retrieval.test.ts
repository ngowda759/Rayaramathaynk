// Unit tests for upcoming-event retrieval (P1).
//
// The retriever used to order ascending by start_date, limit, and only then
// filter past events in memory. With a long event history the first page was
// entirely historical, so "upcoming events" reported nothing while upcoming
// rows existed. These tests assert the date boundary is applied by the query
// (before the limit) and that the defensive in-memory filter still holds.

jest.mock("server-only", () => ({}), { virtual: true });

interface Row {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  featured: boolean | null;
  category: string | null;
}

let allRows: Row[] = [];
let lastGte: { column: string; value: string } | null = null;
let lastLimit: number | null = null;

/**
 * Minimal PostgREST-style builder that records the filters the retriever
 * applies and evaluates them against an in-memory row set. This proves the
 * query itself constrains by `end_date` (not merely the in-memory filter).
 */
function makeBuilder() {
  const state = {
    publishedOnly: false,
    gte: null as { column: string; value: string } | null,
    ascending: true,
    limit: null as number | null,
  };

  const resolve = () => {
    let rows = [...allRows];
    if (state.publishedOnly) {
      rows = rows.filter((row) => row.end_date !== null);
    }
    if (state.gte) {
      const threshold = new Date(state.gte.value).getTime();
      rows = rows.filter((row) => {
        if (!row.end_date) return false;
        return new Date(row.end_date).getTime() >= threshold;
      });
    }
    rows.sort((a, b) => {
      const at = a.start_date ? new Date(a.start_date).getTime() : 0;
      const bt = b.start_date ? new Date(b.start_date).getTime() : 0;
      return state.ascending ? at - bt : bt - at;
    });
    if (state.limit !== null) {
      rows = rows.slice(0, state.limit);
    }
    lastGte = state.gte;
    lastLimit = state.limit;
    return { data: rows, error: null };
  };

  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => {
    state.publishedOnly = true;
    return builder;
  });
  builder.gte = jest.fn((column: string, value: string) => {
    state.gte = { column, value };
    return builder;
  });
  builder.order = jest.fn((_column: string, options?: { ascending?: boolean }) => {
    state.ascending = options?.ascending ?? true;
    return builder;
  });
  builder.limit = jest.fn((count: number) => {
    state.limit = count;
    return builder;
  });
  // PostgREST query builders are thenable; awaiting the builder runs the query.
  builder.then = jest.fn((onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve(resolve()).then(onFulfilled)
  );
  return builder;
}

const mockSupabase = { from: jest.fn(() => makeBuilder()) };
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockSupabase }));
jest.mock("@/lib/supabase/client", () => ({ createClient: () => mockSupabase }));

import { getUpcomingEvents, clearEventsCache } from "../../lib/ai/retrieval/events";
import { RetrievalType } from "../../lib/ai/intent/types";

const DAY = 24 * 60 * 60 * 1000;

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function row(partial: Partial<Row> & { id: string; title: string }): Row {
  return {
    description: "",
    start_date: null,
    end_date: null,
    start_time: null,
    end_time: null,
    location: "",
    featured: false,
    category: null,
    ...partial,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  clearEventsCache();
  lastGte = null;
  lastLimit = null;
  allRows = [];
});

describe("getUpcomingEvents — database-level date boundary", () => {
  it("applies the end_date >= now constraint in the query before the limit", async () => {
    allRows = [row({ id: "1", title: "Future", start_date: iso(5 * DAY), end_date: iso(6 * DAY) })];

    await getUpcomingEvents(5);

    expect(lastGte).not.toBeNull();
    expect(lastGte!.column).toBe("end_date");
    // The boundary must be "now"-ish, not a hard-coded date.
    const boundary = new Date(lastGte!.value).getTime();
    expect(Math.abs(boundary - Date.now())).toBeLessThan(60 * 1000);
    expect(lastLimit).toBe(20);
  });

  it("excludes historical events even when they dominate the earliest rows", async () => {
    // 30 historical events (oldest first) + 3 upcoming. A limit-before-filter
    // implementation would return only historical rows and yield nothing.
    allRows = [
      ...Array.from({ length: 30 }, (_, i) =>
        row({
          id: `past-${i}`,
          title: `Past ${i}`,
          start_date: iso(-(365 - i) * DAY),
          end_date: iso(-(364 - i) * DAY),
        })
      ),
      row({ id: "up-1", title: "Upcoming One", start_date: iso(2 * DAY), end_date: iso(2 * DAY) }),
      row({ id: "up-2", title: "Upcoming Two", start_date: iso(10 * DAY), end_date: iso(11 * DAY) }),
      row({ id: "up-3", title: "Upcoming Three", start_date: iso(40 * DAY), end_date: iso(40 * DAY) }),
    ];

    const result = await getUpcomingEvents(10);

    expect(result.source).toBe(RetrievalType.REPOSITORY);
    const titles = (result.data ?? []).map((event) => event.title);
    expect(titles).toContain("Upcoming One");
    expect(titles).toContain("Upcoming Two");
    expect(titles).toContain("Upcoming Three");
    expect(titles.some((title) => title.startsWith("Past"))).toBe(false);
  });

  it("retains an ongoing event (started already, has not ended)", async () => {
    allRows = [row({ id: "ongoing", title: "Ongoing", start_date: iso(-1 * DAY), end_date: iso(1 * DAY) })];

    const result = await getUpcomingEvents(5);

    expect((result.data ?? []).map((event) => event.id)).toContain("ongoing");
  });

  it("retains future events", async () => {
    allRows = [row({ id: "future", title: "Future", start_date: iso(3 * DAY), end_date: iso(4 * DAY) })];

    const result = await getUpcomingEvents(5);

    expect((result.data ?? []).map((event) => event.id)).toContain("future");
  });

  it("orders results by ascending start_date", async () => {
    allRows = [
      row({ id: "b", title: "Second", start_date: iso(20 * DAY), end_date: iso(20 * DAY) }),
      row({ id: "a", title: "First", start_date: iso(2 * DAY), end_date: iso(2 * DAY) }),
      row({ id: "c", title: "Third", start_date: iso(45 * DAY), end_date: iso(45 * DAY) }),
    ];

    const result = await getUpcomingEvents(10);

    expect((result.data ?? []).map((event) => event.id)).toEqual(["a", "b", "c"]);
  });

  it("applies maxEvents after the date filtering, returning the soonest events", async () => {
    allRows = [
      ...Array.from({ length: 5 }, (_, i) =>
        row({
          id: `past-${i}`,
          title: `Past ${i}`,
          start_date: iso(-(10 - i) * DAY),
          end_date: iso(-(9 - i) * DAY),
        })
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        row({
          id: `up-${i}`,
          title: `Up ${i}`,
          start_date: iso((i + 1) * DAY),
          end_date: iso((i + 1) * DAY),
        })
      ),
    ];

    const result = await getUpcomingEvents(2);

    expect((result.data ?? []).map((event) => event.id)).toEqual(["up-0", "up-1"]);
  });

  it("returns an empty list (not an error) when there are no upcoming events", async () => {
    allRows = [
      row({ id: "old", title: "Old", start_date: iso(-30 * DAY), end_date: iso(-29 * DAY) }),
    ];

    const result = await getUpcomingEvents(5);

    expect(result.source).toBe(RetrievalType.REPOSITORY);
    expect(result.data).toEqual([]);
  });

  it("skips rows with malformed dates instead of fabricating them", async () => {
    allRows = [
      row({ id: "bad", title: "Bad", start_date: "not-a-date", end_date: "not-a-date" }),
      row({ id: "good", title: "Good", start_date: iso(2 * DAY), end_date: iso(2 * DAY) }),
    ];

    const result = await getUpcomingEvents(5);

    const ids = (result.data ?? []).map((event) => event.id);
    expect(ids).toContain("good");
    expect(ids).not.toContain("bad");
  });

  it("does not refetch within the cache window but still filters by the boundary", async () => {
    allRows = [row({ id: "cached", title: "Cached", start_date: iso(2 * DAY), end_date: iso(2 * DAY) })];

    await getUpcomingEvents(5);
    const callsAfterFirst = mockSupabase.from.mock.calls.length;
    const second = await getUpcomingEvents(5);

    expect(mockSupabase.from.mock.calls.length).toBe(callsAfterFirst);
    expect((second.data ?? []).map((event) => event.id)).toContain("cached");
    expect(second.fromCache).toBe(true);
  });
});
