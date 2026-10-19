/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import type { SevaError } from "@/lib/seva/errors";
import type { can, isWriteAction, SevaActor } from "@/lib/seva/permissions";
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

const mockCallRpc = jest.fn();
jest.mock("@/lib/seva/server/rpc", () => ({ callRpc: (...args: unknown[]) => mockCallRpc(...args) }));

import { GET, POST } from "@/app/api/seva/settings/lists/route";

const ADMIN: SevaActor = { staffId: "s-admin", uid: "u-admin", role: "temple_admin", viewOnly: false, staffNo: 2, name: "Admin" };
const VIEWER: SevaActor = { ...ADMIN, staffId: "s-view", viewOnly: true };
const RECEPTIONIST: SevaActor = { ...ADMIN, staffId: "s-rec", role: "receptionist", staffNo: 23 };

type Row = Record<string, unknown>;

const ROWS: Row[] = [
  { kind: "gotra", item_id: 0, name_en: "Not known", name_kn: "ಗೊತ್ತಿಲ್ಲ", kn_checked: false, active: true, display_order: 0 },
  { kind: "gotra", item_id: 1000, name_en: "Vyaghrapada", name_kn: null, kn_checked: false, active: false, display_order: 57 },
  { kind: "nakshatra", item_id: 1, name_en: "Ashwini", name_kn: "ಅಶ್ವಿನಿ", kn_checked: true, active: true, display_order: 1 },
  { kind: "rashi", item_id: 1, name_en: "Mesha", name_kn: "ಮೇಷ", kn_checked: false, active: true, display_order: 1 },
];

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/seva/settings/lists", {
    method,
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function errorCode(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGuard.actor = ADMIN;
  mockGuard.actions = [];
  mockCallRpc.mockImplementation(async (fn: string, args: Row) => {
    if (fn === "seva_list_items_get") return ROWS;
    if (fn === "seva_list_item_save") {
      const item = args.p_item as Row;
      return { kind: item.kind, item_id: item.item_id ?? 1001, name_en: item.name_en ?? "Ashwini", name_kn: item.name_kn ?? null, kn_checked: "name_kn" in item, active: item.active ?? true, display_order: 58 };
    }
    throw new Error(`unexpected ${fn}`);
  });
});

describe("settings lists route", () => {
  it("reads the three lists for temple admins, view-only included, grouped by kind", async () => {
    mockGuard.actor = VIEWER;
    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    expect(mockGuard.actions).toEqual(["reports.view"]);
    expect(await res.json()).toEqual({
      gotras: [
        { id: 0, nameEn: "Not known", nameKn: "ಗೊತ್ತಿಲ್ಲ", knChecked: false, active: true, displayOrder: 0 },
        { id: 1000, nameEn: "Vyaghrapada", nameKn: null, knChecked: false, active: false, displayOrder: 57 },
      ],
      nakshatras: [{ id: 1, nameEn: "Ashwini", nameKn: "ಅಶ್ವಿನಿ", knChecked: true, active: true, displayOrder: 1 }],
      rashis: [{ id: 1, nameEn: "Mesha", nameKn: "ಮೇಷ", knChecked: false, active: true, displayOrder: 1 }],
    });

    mockGuard.actor = RECEPTIONIST;
    const refused = await GET(req("GET"));
    expect(refused.status).toBe(403);
  });

  it("a view-only temple admin gets 403 on save", async () => {
    mockGuard.actor = VIEWER;
    const res = await POST(req("POST", { kind: "gotra", nameEn: "Vyaghrapada" }));
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe("view_only");
    expect(mockGuard.actions).toEqual(["settings.edit"]);
    expect(mockCallRpc).not.toHaveBeenCalled();
  });

  it("saves a new gotra and a Kannada spelling through the SQL function with the actor's staff id", async () => {
    const added = await POST(req("POST", { kind: "gotra", nameEn: "Vyaghrapada", nameKn: "ವ್ಯಾಘ್ರಪಾದ" }));
    expect(added.status).toBe(200);
    expect(mockCallRpc).toHaveBeenLastCalledWith("seva_list_item_save", {
      p_item: { kind: "gotra", name_en: "Vyaghrapada", name_kn: "ವ್ಯಾಘ್ರಪಾದ" },
      p_staff_id: "s-admin",
    });
    expect(await added.json()).toEqual({
      kind: "gotra",
      item: { id: 1001, nameEn: "Vyaghrapada", nameKn: "ವ್ಯಾಘ್ರಪಾದ", knChecked: true, active: true, displayOrder: 58 },
    });

    const hidden = await POST(req("POST", { kind: "gotra", id: 12, active: false }));
    expect(hidden.status).toBe(200);
    expect(mockCallRpc).toHaveBeenLastCalledWith("seva_list_item_save", { p_item: { kind: "gotra", item_id: 12, active: false }, p_staff_id: "s-admin" });

    const kannada = await POST(req("POST", { kind: "nakshatra", id: 25, nameKn: "ಪೂರ್ವಾಭಾದ್ರಪದ" }));
    expect(kannada.status).toBe(200);
    expect(mockCallRpc).toHaveBeenLastCalledWith("seva_list_item_save", {
      p_item: { kind: "nakshatra", item_id: 25, name_kn: "ಪೂರ್ವಾಭಾದ್ರಪದ" },
      p_staff_id: "s-admin",
    });
  });

  it("refuses bodies the lists do not allow before calling the database", async () => {
    const bad = [
      { kind: "nakshatra", id: 25, nameEn: "Poorva" },
      { kind: "rashi", id: 13, nameKn: "ಹೊಸ" },
      { kind: "rashi", nameKn: "ಹೊಸ" },
      { kind: "gotra" },
      { kind: "gotra", nameKn: "ಹೊಸ" },
      { kind: "gotra", id: 3, nameEn: "   " },
      { kind: "caste", nameEn: "X" },
      { kind: "gotra", nameEn: "X", colour: "red" },
    ];
    for (const body of bad) {
      const res = await POST(req("POST", body));
      expect({ body, status: res.status }).toEqual({ body, status: 400 });
    }
    expect(mockCallRpc).not.toHaveBeenCalled();
  });
});
