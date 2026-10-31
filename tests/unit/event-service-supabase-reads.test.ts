/**
 * @jest-environment node
 *
 * Regression tests for the Supabase `events` reader cutover.
 *
 * These pin the defect the migration-readiness audit found: `getEvents()` caught
 * every Supabase error and returned `[]`, so the deny-all RLS policy on `events`
 * left the public events list and the homepage strip empty with nothing in the UI
 * to explain it. A read failure must now be *surfaced*, and only a genuinely
 * absent row may be reported as `null`.
 *
 * The client is stubbed: no database, no network. The tests assert the service's
 * behaviour, not a live policy.
 */

const queryResult: { data: unknown; error: { message: string; code?: string } | null } = {
  data: null,
  error: null,
};

function makeBuilder() {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder;
  for (const m of ["select", "eq", "or", "order", "limit", "in", "insert", "update", "delete", "upsert"]) {
    builder[m] = jest.fn(chain);
  }
  builder.maybeSingle = jest.fn(() => Promise.resolve(queryResult));
  builder.single = jest.fn(() => Promise.resolve(queryResult));
  builder.then = jest.fn((resolve: (v: unknown) => unknown) =>
    Promise.resolve(queryResult).then(resolve),
  );
  return builder;
}

const builder = makeBuilder();

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => builder,
  }),
}));

import { eventService, EventReadError } from "@/services/event.service";

function reset() {
  queryResult.data = null;
  queryResult.error = null;
  for (const fn of Object.values(builder)) (fn as jest.Mock).mockClear?.();
}

describe("event.service reads from Supabase and surfaces failures", () => {
  beforeEach(reset);

  it("returns the mapped rows on a successful read", async () => {
    queryResult.data = [
      {
        firestore_id: "raghavendra-2027",
        title: "Sri Raghavendra Swamy Aaradhane",
        description: "Aaradhane",
        location: "Matha",
        start_date: "2027-08-15T00:00:00.000Z",
        end_date: "2027-08-17T00:00:00.000Z",
        start_time: null,
        end_time: null,
        featured: true,
        published: true,
        category: "Aaradhane",
        image_url: null,
        status: "Upcoming",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ];

    const events = await eventService.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("raghavendra-2027");
    expect(events[0].title).toBe("Sri Raghavendra Swamy Aaradhane");
  });

  it("returns an empty array only when the read genuinely returned no rows", async () => {
    queryResult.data = [];
    queryResult.error = null;
    await expect(eventService.getEvents()).resolves.toEqual([]);
  });

  it("throws instead of returning [] when the read is denied", async () => {
    // The RLS denial. Previously this produced `[]` and a blank list.
    queryResult.data = null;
    queryResult.error = { message: "permission denied for table events", code: "42501" };

    await expect(eventService.getEvents()).rejects.toBeInstanceOf(EventReadError);
    await expect(eventService.getEvents()).rejects.toThrow(/permission denied/);
  });

  it("carries the database's own error text and code, so the cause is visible", async () => {
    queryResult.error = { message: "connection refused", code: "ECONNREFUSED" };
    await expect(eventService.getEvents()).rejects.toThrow(/connection refused \(code ECONNREFUSED\)/);
  });

  it("treats a missing single row as null, but a failed read as an error", async () => {
    queryResult.data = null;
    queryResult.error = null;
    await expect(eventService.getEvent("does-not-exist")).resolves.toBeNull();

    queryResult.error = { message: "permission denied", code: "42501" };
    await expect(eventService.getEvent("raghavendra-2027")).rejects.toBeInstanceOf(EventReadError);
  });

  it("propagates a read failure through the derived readers rather than hiding it", async () => {
    queryResult.error = { message: "permission denied", code: "42501" };
    await expect(eventService.getPublishedEvents()).rejects.toBeInstanceOf(EventReadError);
    await expect(eventService.getUpcomingEvents()).rejects.toBeInstanceOf(EventReadError);
    await expect(eventService.getFeaturedEvent()).rejects.toBeInstanceOf(EventReadError);
  });
});
