/**
 * `settingsService.getSettings()` must choose a deterministic row.
 *
 * `site_settings` can hold two rows that share one `updated_at` value, so an
 * `order(updated_at).limit(1).single()` read picked an arbitrary one. The reader
 * now adds `id` ascending as a stable tiebreaker. This test pins that ordering so
 * a future edit cannot silently drop the tiebreaker and reintroduce the
 * non-deterministic read.
 */
jest.mock("server-only", () => ({}), { virtual: true });

type OrderCall = [column: string, options: { ascending: boolean }];

let orderCalls: OrderCall[] = [];
let nextResult: { data: unknown; error: unknown } = { data: null, error: null };

function makeQuery() {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder;
  builder.select = jest.fn(chain);
  builder.order = jest.fn((column: string, options: { ascending: boolean }) => {
    orderCalls.push([column, options]);
    return builder;
  });
  builder.limit = jest.fn(chain);
  builder.single = jest.fn(() => Promise.resolve(nextResult));
  return builder;
}

const mockFrom = jest.fn(() => makeQuery());
jest.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: mockFrom }) }));

import { settingsService } from "@/services/settings.service";

beforeEach(() => {
  jest.clearAllMocks();
  orderCalls = [];
  nextResult = { data: null, error: null };
});

describe("settingsService.getSettings — deterministic row selection", () => {
  it("orders by updated_at desc and then id asc as a stable tiebreaker", async () => {
    nextResult = {
      data: {
        id: "00000000-0000-0000-0000-000000000001",
        temple_name: "Sri Raghavendra Swamy Matha",
        contact_email: "",
        contact_phone: "",
        address: "Yelahanka",
        footer_text: "",
        welcome_message: "",
        updated_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    };

    const settings = await settingsService.getSettings();

    expect(orderCalls).toEqual([
      ["updated_at", { ascending: false }],
      ["id", { ascending: true }],
    ]);
    expect(settings?.templeName).toBe("Sri Raghavendra Swamy Matha");
  });

  it("returns null (not a fabricated default) when no row exists", async () => {
    nextResult = { data: null, error: { code: "PGRST116", message: "no rows" } };
    expect(await settingsService.getSettings()).toBeNull();
  });
});
