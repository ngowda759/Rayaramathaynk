/**
 * @jest-environment node
 */
jest.mock("server-only", () => ({}), { virtual: true });

type Row = Record<string, unknown>;
interface Call {
  table: string;
  columns: string;
  ops: unknown[][];
}
const mockCalls: Call[] = [];
let mockTables: Record<string, Row[]> = {};

function mockSupabase() {
  return {
    from(table: string) {
      const call: Call = { table, columns: "", ops: [] };
      mockCalls.push(call);
      const builder: Record<string, unknown> = {};
      for (const op of ["eq", "in", "order", "limit"]) {
        builder[op] = (...args: unknown[]) => {
          call.ops.push([op, ...args]);
          return builder;
        };
      }
      builder.select = (columns: string) => {
        call.columns = columns;
        return builder;
      };
      builder.maybeSingle = () => Promise.resolve({ data: (mockTables[table] ?? [])[0] ?? null, error: null });
      return builder;
    },
  };
}
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockSupabase() }));

import { getPublicReceiptByToken } from "@/lib/seva/server/public-receipt";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUv";

const settings: Row = {
  temple_name_en: "Sri Raghavendra Swamy Matha",
  temple_name_kn: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ",
  print_gotra: true,
  print_nakshatra: true,
};

function receipt(overrides: Row = {}): Row {
  return {
    receipt_no: "C1-023-10-2026/000124",
    seva_date: "2026-10-20",
    total: 1220,
    status: "issued",
    prasadam_state: "pending",
    seva_orders: {
      devotee_name: "Venkatesh Rao",
      gotra: "Bharadwaja",
      nakshatra_id: 4,
      nakshatra_text: null,
      payment_mode: "upi",
      phone_e164: "+919845012345",
    },
    lines: [
      { line_no: 2, seva_name_en: "Archane", seva_name_kn: null, quantity: 1, amount: 10 },
      { line_no: 1, seva_name_en: "Paaduka Pooja", seva_name_kn: "ಪಾದುಕಾ ಪೂಜೆ", quantity: 2, amount: 1210 },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  mockCalls.length = 0;
  mockTables = { seva_settings: [settings] };
});

describe("getPublicReceiptByToken", () => {
  it("public reader returns slip details without the phone and null for an unknown token", async () => {
    mockTables.seva_receipts = [receipt()];
    const found = await getPublicReceiptByToken(TOKEN);

    expect(found).toEqual({
      templeNameEn: "Sri Raghavendra Swamy Matha",
      templeNameKn: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ",
      receiptNo: "C1-023-10-2026/000124",
      sevaDate: "2026-10-20",
      devoteeName: "Venkatesh Rao",
      gotra: "Bharadwaja",
      nakshatra: "Rohini",
      lines: [
        { nameEn: "Paaduka Pooja", nameKn: "ಪಾದುಕಾ ಪೂಜೆ", quantity: 2, amountPaise: 121000 },
        { nameEn: "Archane", nameKn: null, quantity: 1, amountPaise: 1000 },
      ],
      totalPaise: 122000,
      mode: "upi",
      status: "valid",
      prasadam: "pending",
    });
    expect(JSON.stringify(found)).not.toContain("9845012345");
    const query = mockCalls.find((c) => c.table === "seva_receipts");
    expect(query?.columns).not.toContain("phone");
    expect(query?.ops).toContainEqual(["eq", "qr_token", TOKEN]);

    mockTables.seva_receipts = [];
    await expect(getPublicReceiptByToken("ZZZZZZZZZZZZZZZZZZZZZZ")).resolves.toBeNull();
  });

  it("answers null without reading the database for a value that is not a token", async () => {
    await expect(getPublicReceiptByToken("../../etc/passwd")).resolves.toBeNull();
    await expect(getPublicReceiptByToken("")).resolves.toBeNull();
    expect(mockCalls).toHaveLength(0);
  });

  it("shows Cancelled and leaves out what the slip does not print", async () => {
    mockTables.seva_receipts = [receipt({ status: "cancelled" })];
    mockTables.seva_settings = [{ ...settings, print_gotra: false, print_nakshatra: false }];
    const found = await getPublicReceiptByToken(TOKEN);
    expect(found).toMatchObject({ status: "cancelled", gotra: null, nakshatra: null });
  });
});
