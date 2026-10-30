/**
 * @jest-environment node
 *
 * The quote read path must never write.
 *
 * `getTodaysQuote` is reached from the public homepage render
 * (`app/(public)/page.tsx` -> `dailySpiritualService` -> `quoteService`) and from
 * `GET /api/quotes/today`. It used to auto-seed `DEFAULT_QUOTES_DATA` when the
 * `quotes` table was empty and to fire a `viewCount` update on every render, so a
 * page view or a build-time prerender could mutate the database. Both writes were
 * removed; seeding is now the explicit `POST /api/admin/quotes/seed` operation.
 *
 * These tests drive the real service against a mocked Supabase client and fail if
 * any write reaches it during a read.
 */

jest.mock("server-only", () => ({}), { virtual: true });

import { quoteService } from "@/services/quote.server";

// Every query built by the service records its operation here. A read path is only
// allowed to run `select`.
const operations: Array<{ op: string; args: unknown[] }> = [];

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  const chain = (op: string) =>
    jest.fn((...args: unknown[]) => {
      operations.push({ op, args });
      return builder;
    });

  for (const op of ["select", "eq", "neq", "or", "in", "order", "limit", "range"]) {
    builder[op] = chain(op);
  }
  // Writes, so a regression is recorded rather than throwing a confusing TypeError.
  for (const op of ["insert", "update", "upsert", "delete"]) {
    builder[op] = chain(op);
  }

  // Terminal results. Both `await builder` and `.maybeSingle()` must resolve.
  builder.maybeSingle = jest.fn(async () => {
    operations.push({ op: "maybeSingle", args: [] });
    return { data: null, error: null };
  });
  builder.single = jest.fn(async () => {
    operations.push({ op: "single", args: [] });
    return { data: null, error: null };
  });
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);

  return builder;
}

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => makeBuilder() }),
}));

// `buildSelectionContext` reads published events; keep it empty and offline.
jest.mock("@/services/event.service", () => ({
  eventService: { getPublishedEvents: jest.fn(async () => []) },
}));

const WRITE_OPS = ["insert", "update", "upsert", "delete"];

describe("QuoteService read path", () => {
  beforeEach(() => {
    operations.length = 0;
    quoteService.clearCache();
  });

  it("getTodaysQuote never issues a write", async () => {
    await quoteService.getTodaysQuote(new Date("2026-01-02T12:00:00.000Z"));

    const writes = operations.filter((o) => WRITE_OPS.includes(o.op));
    expect(writes).toEqual([]);
  });

  it("getTodaysQuote does not auto-seed when the table is empty", async () => {
    await quoteService.getTodaysQuote(new Date("2026-01-02T12:00:00.000Z"));

    // The old code called createQuote() (an insert) whenever no active quote was
    // found. With the table empty, only reads may have happened.
    expect(operations.some((o) => o.op === "insert")).toBe(false);
    // ...and it must not touch the `stats` view counter either.
    expect(operations.some((o) => o.op === "update")).toBe(false);
  });

  it("a repeated read stays read-only (cache hit included)", async () => {
    const day = new Date("2026-01-02T12:00:00.000Z");
    await quoteService.getTodaysQuote(day);
    operations.length = 0;
    await quoteService.getTodaysQuote(day); // served from the in-memory cache

    expect(operations.filter((o) => WRITE_OPS.includes(o.op))).toEqual([]);
  });

  it("still exposes explicit write operations for admin use", () => {
    // Seeding and view counting remain available; they are just no longer invoked
    // from a read.
    expect(typeof quoteService.seedDefaultQuotes).toBe("function");
    expect(typeof quoteService.incrementViewCount).toBe("function");
    expect(typeof quoteService.createQuote).toBe("function");
  });
});
