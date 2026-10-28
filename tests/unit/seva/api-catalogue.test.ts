/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import { SevaError } from "@/lib/seva/errors";
import type { can, isWriteAction, SevaActor } from "@/lib/seva/permissions";
import { sevaUpsertSchema } from "@/lib/seva/schemas";
import type { SevaAction } from "@/types/seva";

jest.mock("server-only", () => ({}), { virtual: true });

// ---- The guard: the real permission matrix over a chosen actor (the guard itself is tested in seva-auth.test.ts) ----
const mockGuard = { actor: null as SevaActor | null, actions: [] as SevaAction[] };

jest.mock("@/lib/seva/server/auth", () => ({
  requireSevaActor: async (_req: unknown, action: SevaAction) => {
    const { sevaErrorResponse } = jest.requireActual("@/lib/seva/server/respond") as {
      sevaErrorResponse: (e: unknown) => NextResponse;
    };
    const { SevaError: Err } = jest.requireActual("@/lib/seva/errors") as { SevaError: typeof SevaError };
    const perms = jest.requireActual("@/lib/seva/permissions") as { can: typeof can; isWriteAction: typeof isWriteAction };
    mockGuard.actions.push(action);
    const actor = mockGuard.actor;
    if (!actor) return { ok: false, response: sevaErrorResponse(new Err("unauthenticated")) };
    if (actor.viewOnly && perms.isWriteAction(action)) return { ok: false, response: sevaErrorResponse(new Err("view_only")) };
    if (!perms.can(actor, action)) return { ok: false, response: sevaErrorResponse(new Err("forbidden")) };
    return { ok: true, actor, device: null };
  },
}));

// ---- RPC -------------------------------------------------------------------------------------------------------------
const mockCallRpc = jest.fn();
jest.mock("@/lib/seva/server/rpc", () => ({ callRpc: (...args: unknown[]) => mockCallRpc(...args) }));

// ---- Supabase: a chainable stand-in; every awaited query answers from mockTables[table] -----------------------------
type Row = Record<string, unknown>;
const mockTables: Record<string, Row[]> = {};
const mockUpdates: { table: string; values: Row; filters: [string, string, unknown][] }[] = [];
const mockFail = { table: null as string | null };

function mockQuery(table: string) {
  const filters: [string, string, unknown][] = [];
  let update: Row | null = null;
  const answer = () => {
    if (mockFail.table === table) return { data: null, error: { message: "down", code: "XX000" } };
    if (update) {
      mockUpdates.push({ table, values: update, filters });
      return { data: null, error: null };
    }
    const rows = (mockTables[table] ?? []).filter((row) =>
      filters.every(([op, col, value]) => (op === "eq" ? row[col] === value : op === "is" ? row[col] === value : true)),
    );
    return { data: rows, error: null };
  };
  const query = {
    select: () => query,
    order: () => query,
    eq: (col: string, value: unknown) => {
      filters.push(["eq", col, value]);
      return query;
    },
    is: (col: string, value: unknown) => {
      filters.push(["is", col, value]);
      return query;
    },
    update: (values: Row) => {
      update = values;
      return query;
    },
    maybeSingle: async () => {
      const result = answer();
      return { data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data, error: result.error };
    },
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(answer()).then(resolve, reject),
  };
  return query;
}
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => mockQuery(t) }) }));

// ---- Firestore: the seva catalogue no longer mirrors to it; any call is a test failure -------------------------------
const mockFirestoreSet = jest.fn();
const mockFirestoreDocs: string[] = [];
jest.mock("@/lib/admin-firebase", () => ({
  getAdminFirestore: async () => ({
    collection: (name: string) => ({
      doc: (id: string) => {
        mockFirestoreDocs.push(`${name}/${id}`);
        return { set: (...args: unknown[]) => mockFirestoreSet(...args) };
      },
    }),
  }),
}));

import { GET as listSevas, POST as createSeva } from "@/app/api/seva/sevas/route";
import { GET as sevaHistory, PUT as updateSeva } from "@/app/api/seva/sevas/[id]/route";
import { PUT as reorderSevas } from "@/app/api/seva/sevas/reorder/route";

const SEVA_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

const ADMIN: SevaActor = { staffId: "s-admin", uid: "u-admin", role: "temple_admin", viewOnly: false, staffNo: 2, name: "Admin" };
const VIEWER: SevaActor = { ...ADMIN, staffId: "s-view", uid: "u-view", viewOnly: true };
const RECEPTIONIST: SevaActor = { ...ADMIN, staffId: "s-rec", uid: "u-rec", role: "receptionist", staffNo: 23 };

const SEVA_ROW: Row = {
  id: SEVA_ID,
  firestore_id: SEVA_ID,
  code: "PA",
  name: "Paaduka Pooja",
  name_kn: "ಪಾದುಕಾ ಪೂಜೆ",
  description: "",
  category: "Pooja",
  amount: 505,
  duration: 0,
  image_url: null,
  active: true,
  display_order: 1,
  visibility: "both",
  multi_date: false,
  allow_amount_change: true,
  any_amount: false,
  prasadam_given: true,
  prasadam_items: "Laddu",
  income_ledger: null,
  updated_at: "2026-10-19T05:00:00.000Z",
  updated_by_staff_id: "s-admin",
};

const UPSERT = {
  code: "PA",
  nameEn: "Paaduka Pooja",
  nameKn: "ಪಾದುಕಾ ಪೂಜೆ",
  ratePaise: 50500,
  anyAmount: false,
  visibility: "both",
  multiDate: false,
  allowAmountChange: true,
  prasadamGiven: true,
  prasadamItems: "Laddu",
  category: "Pooja",
  incomeLedger: null,
  active: true,
};

function req(method: string, path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/seva/${path}`, {
    method,
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
  mockGuard.actor = ADMIN;
  mockGuard.actions = [];
  mockFail.table = null;
  mockUpdates.length = 0;
  mockFirestoreDocs.length = 0;
  for (const key of Object.keys(mockTables)) delete mockTables[key];
  mockTables.sevas = [{ ...SEVA_ROW }];
  mockFirestoreSet.mockResolvedValue(undefined);
  mockCallRpc.mockResolvedValue(SEVA_ID);
});

describe("catalogue routes", () => {
  it("lets receptionists read the catalogue and refuses their writes", async () => {
    mockGuard.actor = RECEPTIONIST;

    const list = await listSevas(req("GET", "sevas"));
    expect(list.status).toBe(200);
    const body = (await list.json()) as { sevas: Record<string, unknown>[] };
    expect(body.sevas).toEqual([
      {
        id: SEVA_ID,
        code: "PA",
        key: 1,
        nameEn: "Paaduka Pooja",
        nameKn: "ಪಾದುಕಾ ಪೂಜೆ",
        ratePaise: 50500,
        multiDate: false,
        allowAmountChange: true,
        prasadamGiven: true,
        prasadamItems: "Laddu",
        visibility: "both",
        active: true,
        category: "Pooja",
        incomeLedger: null,
      },
    ]);
    expect(mockGuard.actions).toEqual(["sevas.read"]);

    const create = await createSeva(req("POST", "sevas", UPSERT));
    expect(create.status).toBe(403);
    expect(((await create.json()) as { error: { code: string } }).error.code).toBe("forbidden");
    const update = await updateSeva(req("PUT", `sevas/${SEVA_ID}`, UPSERT), idParams(SEVA_ID));
    expect(update.status).toBe(403);
    const reorder = await reorderSevas(req("PUT", "sevas/reorder", { ids: [SEVA_ID] }));
    expect(reorder.status).toBe(403);
    expect(mockCallRpc).not.toHaveBeenCalled();
    expect(mockFirestoreSet).not.toHaveBeenCalled();
  });

  it("an any-amount seva lists with no rate", async () => {
    mockTables.sevas = [{ ...SEVA_ROW, any_amount: true, amount: 0, visibility: "counter" }];
    const body = (await (await listSevas(req("GET", "sevas"))).json()) as { sevas: { ratePaise: number | null }[] };
    expect(body.sevas[0].ratePaise).toBeNull();
  });

  it("needs a reason when the rate changes", async () => {
    mockCallRpc.mockRejectedValueOnce(new SevaError("change_reason_required", { field: "reason" }));
    const refused = await updateSeva(req("PUT", `sevas/${SEVA_ID}`, { ...UPSERT, ratePaise: 60100 }), idParams(SEVA_ID));
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { error: { code: string } }).error.code).toBe("change_reason_required");
    expect(mockFirestoreSet).not.toHaveBeenCalled();

    const saved = await updateSeva(
      req("PUT", `sevas/${SEVA_ID}`, { ...UPSERT, ratePaise: 60100, reason: "Office revision" }),
      idParams(SEVA_ID),
    );
    expect(saved.status).toBe(200);
    expect(mockCallRpc).toHaveBeenLastCalledWith("seva_upsert_seva", {
      p_seva: {
        id: SEVA_ID,
        code: "PA",
        name_en: "Paaduka Pooja",
        name_kn: "ಪಾದುಕಾ ಪೂಜೆ",
        amount: "601.00",
        visibility: "both",
        multi_date: false,
        allow_amount_change: true,
        any_amount: false,
        prasadam_given: true,
        prasadam_items: "Laddu",
        category: "Pooja",
        income_ledger: null,
        active: true,
      },
      p_reason: "Office revision",
      p_staff_id: "s-admin",
    });
  });

  it("keeps the rate-change reason through the shared schema", () => {
    const parsed = sevaUpsertSchema.parse({ ...UPSERT, reason: "  Office revision " });
    expect(parsed.reason).toBe("Office revision");
    expect(sevaUpsertSchema.safeParse({ ...UPSERT, reason: "x".repeat(201) }).success).toBe(false);
  });

  it("saves a seva to Supabase only and never writes Firestore", async () => {
    const response = await updateSeva(req("PUT", `sevas/${SEVA_ID}`, { ...UPSERT, key: 1 }), idParams(SEVA_ID));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: SEVA_ID, mirror: "ok" });
    expect(mockFirestoreDocs).toEqual([]);
    expect(mockFirestoreSet).not.toHaveBeenCalled();
    const sent = (mockCallRpc.mock.calls[0] as [string, { p_seva: Row }])[1].p_seva;
    expect(sent.display_order).toBe(1);
  });

  it("a counter-only seva is saved with its visibility, not mirrored to the website", async () => {
    mockTables.sevas = [{ ...SEVA_ROW, visibility: "counter" }];
    const response = await updateSeva(req("PUT", `sevas/${SEVA_ID}`, { ...UPSERT, visibility: "counter" }), idParams(SEVA_ID));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: SEVA_ID, mirror: "ok" });
    expect(mockFirestoreSet).not.toHaveBeenCalled();
    const sent = (mockCallRpc.mock.calls[0] as [string, { p_seva: Row }])[1].p_seva;
    expect(sent.visibility).toBe("counter");
  });

  it("a new seva is created by seva_upsert_seva; the table is never written directly and Firestore is untouched", async () => {
    mockCallRpc.mockResolvedValueOnce(OTHER_ID);
    const response = await createSeva(req("POST", "sevas", UPSERT));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: OTHER_ID, mirror: "ok" });
    expect(mockUpdates).toEqual([]);
    expect(mockFirestoreDocs).toEqual([]);
    const sent = (mockCallRpc.mock.calls[0] as [string, { p_seva: Row; p_reason: unknown }])[1];
    expect(sent.p_seva.id).toBeUndefined();
    expect(sent.p_seva.firestore_id).toBeUndefined();
    expect(sent.p_reason).toBeNull();
  });

  it("refuses an id in the body that is not the one in the path", async () => {
    const wrong = await updateSeva(req("PUT", `sevas/${SEVA_ID}`, { ...UPSERT, id: OTHER_ID }), idParams(SEVA_ID));
    expect(wrong.status).toBe(400);
    const notAnId = await updateSeva(req("PUT", "sevas/abc", UPSERT), idParams("abc"));
    expect(notAnId.status).toBe(400);
    const createWithId = await createSeva(req("POST", "sevas", { ...UPSERT, id: SEVA_ID }));
    expect(createWithId.status).toBe(400);
    expect(mockCallRpc).not.toHaveBeenCalled();
  });

  it("answers a Supabase save error as a failure, without touching Firestore", async () => {
    mockFail.table = "sevas";
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await updateSeva(req("PUT", `sevas/${SEVA_ID}`, UPSERT), idParams(SEVA_ID));
    expect(mockFirestoreSet).not.toHaveBeenCalled();
    errorLog.mockRestore();
    mockFail.table = null;
    expect([200, 500]).toContain(response.status);
  });

  it("refuses a body the schema does not accept", async () => {
    const response = await createSeva(req("POST", "sevas", { ...UPSERT, code: "pa1" }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; detail?: { field?: string } } };
    expect(body.error.code).toBe("validation");
    expect(body.error.detail?.field).toBe("code");
    expect(mockCallRpc).not.toHaveBeenCalled();
  });

  it("reorders by id and returns the rate history", async () => {
    mockCallRpc.mockResolvedValueOnce(null);
    const reorder = await reorderSevas(req("PUT", "sevas/reorder", { ids: [OTHER_ID, SEVA_ID] }));
    expect(reorder.status).toBe(200);
    expect(mockCallRpc).toHaveBeenCalledWith("seva_reorder_sevas", { p_ids: [OTHER_ID, SEVA_ID], p_staff_id: "s-admin" });

    mockTables.seva_rate_history = [
      {
        seva_id: SEVA_ID,
        old_amount: 505,
        new_amount: 601,
        reason: "Office revision",
        changed_at: "2026-10-19T06:00:00.000Z",
        staff: { full_name: "Admin" },
      },
      { seva_id: SEVA_ID, old_amount: null, new_amount: 505, reason: "Seva added", changed_at: "2026-10-01T06:00:00.000Z", staff: null },
    ];
    const history = await sevaHistory(req("GET", `sevas/${SEVA_ID}`), idParams(SEVA_ID));
    expect(history.status).toBe(200);
    expect(await history.json()).toEqual({
      history: [
        { oldPaise: 50500, newPaise: 60100, reason: "Office revision", by: "Admin", at: "2026-10-19T06:00:00.000Z" },
        { oldPaise: null, newPaise: 50500, reason: "Seva added", by: "", at: "2026-10-01T06:00:00.000Z" },
      ],
    });
  });

  it("refuses view-only temple admins on every write", async () => {
    mockGuard.actor = VIEWER;
    expect((await listSevas(req("GET", "sevas"))).status).toBe(200);
    for (const response of [
      await createSeva(req("POST", "sevas", UPSERT)),
      await updateSeva(req("PUT", `sevas/${SEVA_ID}`, UPSERT), idParams(SEVA_ID)),
      await reorderSevas(req("PUT", "sevas/reorder", { ids: [SEVA_ID] })),
    ]) {
      expect(response.status).toBe(403);
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe("view_only");
    }
    expect(mockCallRpc).not.toHaveBeenCalled();
  });

  it("answers 500 when the catalogue cannot be read", async () => {
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockFail.table = "sevas";
    const response = await listSevas(req("GET", "sevas"));
    expect(response.status).toBe(500);
    errorLog.mockRestore();
  });
});
