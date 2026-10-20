/**
 * @jest-environment node
 */
import { getAllSevasAction, getSevaByIdAction } from "@/app/actions/sevas";

jest.mock("server-only", () => ({}), { virtual: true });

type Call = [method: string, ...args: unknown[]];

const calls: Call[] = [];
let result: { data: unknown; error: unknown } = { data: [], error: null };

function builder() {
  const chain = {
    select: (...args: unknown[]) => record("select", args),
    eq: (...args: unknown[]) => record("eq", args),
    in: (...args: unknown[]) => record("in", args),
    single: (...args: unknown[]) => record("single", args),
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  function record(method: string, args: unknown[]) {
    calls.push([method, ...args]);
    return chain;
  }
  return chain;
}

const mockFrom = jest.fn((table: string) => {
  calls.push(["from", table]);
  return builder();
});

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => mockFrom(table) }),
}));

const PUBLIC_COLUMNS =
  "id, name, name_kn, description, category, amount, any_amount, duration, image_url, display_order, firestore_id, " +
  "active, created_at, updated_at";

beforeEach(() => {
  calls.length = 0;
  mockFrom.mockClear();
  result = { data: [], error: null };
});

describe("public seva actions", () => {
  it("lists only active online sevas with the public column list", async () => {
    result = { data: [{ id: "1", name: "Panchamrita Abhisheka" }], error: null };
    await expect(getAllSevasAction()).resolves.toEqual([{ id: "1", name: "Panchamrita Abhisheka" }]);
    expect(calls).toEqual([
      ["from", "sevas"],
      ["select", PUBLIC_COLUMNS],
      ["eq", "active", true],
      ["in", "visibility", ["online", "both"]],
    ]);
  });

  it("never selects * or the internal catalogue columns", async () => {
    await getAllSevasAction();
    await getSevaByIdAction("fs-1");
    const selects = calls.filter((c) => c[0] === "select").map((c) => String(c[1]));
    expect(selects).toHaveLength(2);
    for (const cols of selects) {
      expect(cols).not.toContain("*");
      for (const internal of [
        "income_ledger",
        "updated_by_staff_id",
        "visibility",
        "allow_amount_change",
        "prasadam_items",
        "code",
      ]) {
        expect(cols.split(", ")).not.toContain(internal);
      }
    }
  });

  it("reads one seva by firestore id with the same column list and filters", async () => {
    result = { data: { id: "1" }, error: null };
    await expect(getSevaByIdAction("fs-1")).resolves.toEqual({ id: "1" });
    expect(calls).toEqual([
      ["from", "sevas"],
      ["select", PUBLIC_COLUMNS],
      ["eq", "active", true],
      ["in", "visibility", ["online", "both"]],
      ["eq", "firestore_id", "fs-1"],
      ["single"],
    ]);
  });

  it("throws the Supabase error", async () => {
    result = { data: null, error: new Error("boom") };
    await expect(getAllSevasAction()).rejects.toThrow("boom");
  });
});
