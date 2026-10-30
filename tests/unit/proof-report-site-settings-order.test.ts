/**
 * The proof-report database export must choose the same deterministic
 * `site_settings` row as `services/settings.service.ts`.
 *
 * `site_settings` can hold two rows that share one `updated_at` value, so an
 * unordered `.limit(1).maybeSingle()` could report the stray
 * `firestore_id = 'trustCommittee'` document instead of the temple identity. The
 * reader now orders by `updated_at` descending then `id` ascending. This test
 * pins that ordering so a future edit cannot reintroduce the ambiguity.
 */
jest.mock("server-only", () => ({}), { virtual: true });

type OrderCall = [column: string, options: { ascending: boolean }];

const orderCalls: OrderCall[] = [];
const siteSettingsRow = {
  id: "00000000-0000-0000-0000-000000000001",
  firestore_id: null,
  temple_name: "Sri Raghavendra Swamy Matha",
  contact_email: "",
  contact_phone: "",
  address: "Yelahanka",
};

function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = jest.fn(chain);
  builder.order = jest.fn((column: string, options: { ascending: boolean }) => {
    if (table === "site_settings") orderCalls.push([column, options]);
    return builder;
  });
  builder.limit = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.maybeSingle = jest.fn(() =>
    Promise.resolve({ data: table === "site_settings" ? siteSettingsRow : null, error: null })
  );
  // `read()` awaits `.select('*')` directly, so the builder must be thenable.
  builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: [], error: null });
  return builder;
}

const client = { from: jest.fn((table: string) => makeBuilder(table)) };
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));

import { DatabaseExportService } from "@/services/proof-report/database-export.service";

beforeEach(() => {
  jest.clearAllMocks();
  orderCalls.length = 0;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

describe("DatabaseExportService site_settings read", () => {
  it("orders by updated_at desc then id asc, matching the settings service", async () => {
    const content = await new DatabaseExportService().exportDatabase();

    expect(orderCalls).toEqual([
      ["updated_at", { ascending: false }],
      ["id", { ascending: true }],
    ]);
    expect(content.settings?.templeName).toBe("Sri Raghavendra Swamy Matha");
  });
});
