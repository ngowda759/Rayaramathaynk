/**
 * @jest-environment node
 */
/**
 * Public seva readers offer only sevas whose visibility is online or both (DB §17.1, C-38; plan Task A5-1). The server
 * action filters the Supabase query; when Supabase fails, the service's Firestore fallback reads the mirror (C-39),
 * where a counter-only seva is written as not active, so the fallback keeps only active sevas offered online.
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
  createAdminClient: () => ({ from: (table: string) => {
    calls.push(["from", table]);
    return builder();
  } }),
}));

interface FakeDoc {
  id: string;
  data: Record<string, unknown>;
}

let firestoreDocs: FakeDoc[] = [];

jest.mock("@/lib/firebase", () => ({ db: {} }));

jest.mock("firebase/firestore", () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  doc: (_db: unknown, _name: string, id: string) => ({ id }),
  getDocs: async () => ({
    docs: firestoreDocs.map((d) => ({ id: d.id, data: () => d.data })),
  }),
  getDoc: async (ref: { id: string }) => {
    const found = firestoreDocs.find((d) => d.id === ref.id);
    return { id: ref.id, exists: () => Boolean(found), data: () => found?.data };
  },
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  serverTimestamp: () => "now",
}));

beforeEach(() => {
  calls.length = 0;
  result = { data: [], error: null };
  firestoreDocs = [];
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

  it("the Firestore fallback lists only active sevas offered online", async () => {
    result = { data: null, error: new Error("supabase down") };
    firestoreDocs = [
      { id: "online", data: { name: "Online", active: true, visibility: "online" } },
      { id: "both", data: { name: "Both", active: true, visibility: "both" } },
      { id: "legacy", data: { name: "Legacy", active: true } },
      { id: "counter", data: { name: "Counter only", active: true, visibility: "counter" } },
      { id: "mirrored-counter", data: { name: "Mirrored counter only", active: false } },
    ];
    const sevas = await sevaService.getAllSevas();
    expect(sevas.map((s) => s.id)).toEqual(["online", "both", "legacy"]);
  });

  it("the Firestore fallback does not open a counter-only or inactive seva by id", async () => {
    result = { data: null, error: new Error("supabase down") };
    firestoreDocs = [
      { id: "counter", data: { name: "Counter only", active: true, visibility: "counter" } },
      { id: "mirrored-counter", data: { name: "Mirrored counter only", active: false } },
      { id: "both", data: { name: "Both", active: true, visibility: "both" } },
    ];
    await expect(sevaService.getSevaById("counter")).resolves.toBeNull();
    await expect(sevaService.getSevaById("mirrored-counter")).resolves.toBeNull();
    await expect(sevaService.getSevaById("both")).resolves.toMatchObject({ id: "both", name: "Both" });
  });
});
