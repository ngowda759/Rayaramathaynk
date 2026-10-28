/**
 * @jest-environment node
 */
/**
 * Public seva readers offer only sevas whose visibility is online or both (DB §17.1, C-38; plan Task A5-1).
 *
 * The public server action filters the Supabase query (`active = true` AND
 * `visibility in (online, both)`) and there is no Firestore fallback: if Supabase
 * fails the action throws, so an empty result can only mean "no sevas" and never a
 * swallowed permission or connectivity failure.
 */
import { getAllSevasAction } from "@/app/actions/sevas";
import { sevaService } from "@/services/seva.service";

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

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      calls.push(["from", table]);
      return builder();
    },
  }),
}));

beforeEach(() => {
  calls.length = 0;
  result = { data: [], error: null };
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("public sevas follow visibility", () => {
  it("the public seva action returns only online and both sevas", async () => {
    result = { data: [{ id: "1", firestore_id: "fs-1" }], error: null };
    await getAllSevasAction();
    expect(calls).toContainEqual(["in", "visibility", ["online", "both"]]);
    expect(calls).toContainEqual(["eq", "active", true]);
  });

  it("surfaces a Supabase failure instead of returning a Firestore fallback", async () => {
    result = { data: null, error: new Error("supabase down") };
    await expect(sevaService.getAllSevas()).rejects.toThrow("supabase down");
  });

  it("does not fall back to Firestore when a single seva read fails", async () => {
    result = { data: null, error: new Error("supabase down") };
    await expect(sevaService.getSevaById("counter")).rejects.toThrow("supabase down");
  });

  it("returns null only for a genuinely missing row (PGRST116)", async () => {
    const notFound = Object.assign(new Error("no rows"), { code: "PGRST116" });
    result = { data: null, error: notFound };
    await expect(sevaService.getSevaById("missing")).resolves.toBeNull();
  });
});
