// Verifies the temple-settings reader is transparent: a missing `ai_settings`
// row, an empty `temple_information`, or a datastore failure must yield "no
// data" (source FALLBACK) instead of fabricated temple facts (phone, address,
// timings). A wrong phone number served as verified is worse than an honest
// "unavailable".

jest.mock("server-only", () => ({}), { virtual: true });

function makeQuery(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder;
  builder.select = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  return builder;
}

let nextResult: { data: unknown; error: unknown } = { data: null, error: null };
const mockFrom = jest.fn(() => makeQuery(nextResult));

const mockSupabase = { from: mockFrom };
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockSupabase }));
jest.mock("@/lib/supabase/client", () => ({ createClient: () => mockSupabase }));

import { getTempleSettings, clearSettingsCache } from "../../lib/ai/retrieval/settings";
import { RetrievalType } from "../../lib/ai/intent/types";

beforeEach(() => {
  jest.clearAllMocks();
  clearSettingsCache();
  nextResult = { data: null, error: null };
});

describe("getTempleSettings — transparent failure handling", () => {
  it("returns no data (FALLBACK) when the ai_settings 'main' row is missing", async () => {
    nextResult = { data: null, error: null };
    const result = await getTempleSettings();
    expect(result.data).toBeNull();
    expect(result.source).toBe(RetrievalType.FALLBACK);
    expect(result.confidence).toBe(0);
  });

  it("returns no data when the datastore query fails, not fabricated facts", async () => {
    nextResult = { data: null, error: { message: "relation does not exist" } };
    const result = await getTempleSettings();
    expect(result.data).toBeNull();
    expect(result.source).toBe(RetrievalType.FALLBACK);
  });

  it("treats an empty temple_information object as unavailable", async () => {
    nextResult = {
      data: { temple_information: {}, visitor_information: {}, temple_policies: {} },
      error: null,
    };
    const result = await getTempleSettings();
    expect(result.data).toBeNull();
    expect(result.source).toBe(RetrievalType.FALLBACK);
  });

  it("returns the row's real facts when temple_information is populated", async () => {
    nextResult = {
      data: {
        temple_information: {
          timings: { morningOpen: "6:00 AM", eveningOpen: "5:00 PM" },
          contact: { phone: "+91-80-0000-0000", email: "temple@example.org", address: "Yelahanka" },
        },
        visitor_information: { guidelines: "Remove footwear." },
        temple_policies: {},
      },
      error: null,
    };

    const result = await getTempleSettings();
    expect(result.source).toBe(RetrievalType.REPOSITORY);
    expect(result.data).not.toBeNull();
    // Facts must come from the row verbatim, never invented.
    expect(result.data!.phone).toBe("+91-80-0000-0000");
    expect(result.data!.email).toBe("temple@example.org");
    expect(result.data!.address).toBe("Yelahanka");
    expect(result.data!.timings.morningOpen).toBe("6:00 AM");
  });

  it("does not invent a phone number when the row omits contact details", async () => {
    nextResult = {
      data: {
        temple_information: { contact: { address: "Yelahanka" } },
        visitor_information: {},
        temple_policies: {},
      },
      error: null,
    };

    const result = await getTempleSettings();
    // The row has an address so it is usable, but the missing phone stays empty.
    expect(result.data).not.toBeNull();
    expect(result.data!.phone).toBe("");
  });
});
