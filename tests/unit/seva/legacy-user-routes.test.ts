/**
 * @jest-environment node
 *
 * The older account routes under /api/admin/users answer to the same staff rules as /api/seva/staff (DB §13.6, §17.1):
 * a signed-in, active temple admin or super admin; DB §3.3 rows 18-20 with the full context (C-17); an audit row when
 * the person has a staff row.
 */
import { NextRequest } from "next/server";
import type { IdentityAdapter } from "@/lib/seva/server/identity";
import type { SevaActor } from "@/lib/seva/permissions";

jest.mock("server-only", () => ({}), { virtual: true });

// ---- Route guard: the real permission matrix over the signed-in actor ------------------------------------------------
const mockSession: { actor: SevaActor | null } = { actor: null };
jest.mock("@/lib/seva/server/auth", () => {
  const { can } = jest.requireActual("@/lib/seva/permissions");
  const { NextResponse: Res } = jest.requireActual("next/server");
  const deny = (code: string, status: number) => ({ ok: false, response: Res.json({ error: { code, message: code } }, { status }) });
  return {
    requireSevaActor: jest.fn(async (_req: unknown, action: string, opts?: { ctx?: Record<string, unknown> }) => {
      const actor = mockSession.actor;
      if (!actor) return deny("unauthenticated", 401);
      if (!can(actor, action, opts?.ctx)) return deny(actor.viewOnly ? "view_only" : "forbidden", 403);
      return { ok: true, actor, device: null };
    }),
  };
});

// ---- Supabase staff table --------------------------------------------------------------------------------------------
type Row = Record<string, unknown>;
const mockDb: { tables: Record<string, Row[]> } = { tables: {} };
function mockQuery(table: string) {
  const filters: ((row: Row) => boolean)[] = [];
  const run = () => ({ data: (mockDb.tables[table] ?? []).filter((row) => filters.every((keep) => keep(row))), error: null });
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return query;
    },
    maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(run()).then(resolve, reject),
  };
  return query;
}
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (table: string) => mockQuery(table) }) }));

// ---- SQL functions, identity adapter, Firebase Auth -----------------------------------------------------------------
const mockCalls: string[] = [];
const mockRpc = jest.fn<Promise<unknown>, [string, Record<string, unknown>]>(async (fn: string) => {
  mockCalls.push(`rpc.${fn}`);
  if (fn === "seva_next_staff_no") return 36;
  if (fn === "seva_staff_onboard") return "0f6e2b1a-1c1d-4e5f-8a9b-000000000036";
  return null;
});
jest.mock("@/lib/seva/server/rpc", () => ({ callRpc: (fn: string, args: Record<string, unknown>) => mockRpc(fn, args) }));

const mockProfiles: Record<string, { role: unknown; isActive: boolean }> = {};
const mockIdentity: jest.Mocked<IdentityAdapter> = {
  verifyRequest: jest.fn(),
  getAccessProfile: jest.fn(async (uid: string) => mockProfiles[uid] ?? null),
  findLoginByEmail: jest.fn(async (email: string) => {
    const uid = mockLogins[email];
    return uid ? { externalUid: uid, displayName: null } : null;
  }),
  createLogin: jest.fn(async () => ({ externalUid: "unused" })),
  setAccessProfile: jest.fn(async () => {
    mockCalls.push("identity.setAccessProfile");
  }),
  setLoginEnabled: jest.fn(async () => undefined),
  deleteLogin: jest.fn(async () => undefined),
};
jest.mock("@/lib/seva/server/identity", () => ({ getIdentityAdapter: () => mockIdentity }));

const mockLogins: Record<string, string> = {};
const mockFirebaseAuth = {
  getUserByEmail: jest.fn(async (email: string) => {
    const uid = mockLogins[email];
    if (!uid) throw Object.assign(new Error("no user"), { code: "auth/user-not-found" });
    return { uid, email };
  }),
  createUser: jest.fn(async (input: { email: string }) => {
    mockCalls.push("auth.createUser");
    if (mockLogins[input.email]) throw Object.assign(new Error("exists"), { code: "auth/email-already-exists" });
    return { uid: "uid-new-admin", email: input.email };
  }),
};
jest.mock("firebase-admin/auth", () => ({ getAuth: () => mockFirebaseAuth }));
jest.mock("@/lib/admin-firebase", () => ({ getAdminApp: async () => ({}) }));

import { POST as setRole } from "../../../app/api/admin/users/set-role/route";
import { POST as createAdmin } from "../../../app/api/admin/users/create-admin/route";

// ---- Fixtures -------------------------------------------------------------------------------------------------------
const SUPER: SevaActor = { staffId: "0f6e2b1a-1c1d-4e5f-8a9b-000000000001", uid: "uid-nikhil", role: "super_admin", viewOnly: false, staffNo: 1, name: "Nikhil N" };
const ADMIN: SevaActor = { staffId: "0f6e2b1a-1c1d-4e5f-8a9b-000000000008", uid: "uid-prakash", role: "temple_admin", viewOnly: false, staffNo: 8, name: "Prakash Rao" };
const RAMESH_ID = "0f6e2b1a-1c1d-4e5f-8a9b-000000000023";

let ip = 0;
function request(path: string, body: unknown): NextRequest {
  ip += 1;
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { authorization: "Bearer t", "content-type": "application/json", "x-forwarded-for": `10.0.0.${ip}` },
    body: JSON.stringify(body),
  });
}

async function errorOf(res: Response): Promise<{ status: number; code: string }> {
  const body = (await res.json()) as { error: { code: string; message: string } };
  expect(typeof body.error.message).toBe("string");
  return { status: res.status, code: body.error.code };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCalls.length = 0;
  mockSession.actor = null;
  mockDb.tables = {
    staff: [
      { id: SUPER.staffId, firebase_uid: "uid-nikhil", staff_no: 1, full_name: "Nikhil N", email: "nikhil@example.org", view_only: false, status: "active", invited_at: null, first_signed_in_at: null },
      { id: ADMIN.staffId, firebase_uid: "uid-prakash", staff_no: 8, full_name: "Prakash Rao", email: "prakash@example.org", view_only: false, status: "active", invited_at: null, first_signed_in_at: null },
      { id: RAMESH_ID, firebase_uid: "uid-ramesh", staff_no: 23, full_name: "Ramesh K", email: "ramesh@example.org", view_only: false, status: "active", invited_at: null, first_signed_in_at: null },
    ],
  };
  for (const key of Object.keys(mockProfiles)) delete mockProfiles[key];
  Object.assign(mockProfiles, {
    "uid-nikhil": { role: "super_admin", isActive: true },
    "uid-prakash": { role: "temple_admin", isActive: true },
    "uid-ramesh": { role: "receptionist", isActive: true },
    "uid-devotee": { role: "devotee", isActive: true },
  });
  for (const key of Object.keys(mockLogins)) delete mockLogins[key];
  Object.assign(mockLogins, {
    "nikhil@example.org": "uid-nikhil",
    "prakash@example.org": "uid-prakash",
    "ramesh@example.org": "uid-ramesh",
    "devotee@example.org": "uid-devotee",
    "nobody-signed-in@example.org": "uid-no-profile",
  });
});

describe("POST /api/admin/users/set-role", () => {
  it("needs a signed-in temple admin or super admin", async () => {
    expect((await errorOf(await setRole(request("/api/admin/users/set-role", { email: "ramesh@example.org", role: "admin" })))).status).toBe(401);
    expect(mockIdentity.setAccessProfile).not.toHaveBeenCalled();
  });

  it("legacy set-role refuses a temple admin granting super_admin", async () => {
    mockSession.actor = ADMIN;
    const res = await setRole(request("/api/admin/users/set-role", { email: "ramesh@example.org", role: "super_admin" }));
    expect(await errorOf(res)).toEqual({ status: 403, code: "forbidden" });
    expect(mockIdentity.setAccessProfile).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("legacy set-role audits a change for someone with a staff row", async () => {
    mockSession.actor = SUPER;
    const res = await setRole(request("/api/admin/users/set-role", { email: "Ramesh@Example.org", role: "admin" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, userId: "uid-ramesh" });
    expect(mockCalls).toEqual(["identity.setAccessProfile", "rpc.seva_audit"]);
    expect(mockIdentity.setAccessProfile).toHaveBeenCalledWith("uid-ramesh", { role: "admin" });
    expect(mockRpc).toHaveBeenCalledWith("seva_audit", {
      p_action: "staff.role_change",
      p_entity: "staff",
      p_entity_id: RAMESH_ID,
      p_receipt_no: null,
      p_reason: null,
      p_before: { role: "receptionist" },
      p_after: { role: "admin" },
      p_staff_id: SUPER.staffId,
    });
  });

  it("keeps a temple admin to staff below super admin, never themself (C-17)", async () => {
    mockSession.actor = ADMIN;
    // Someone with no staff row is outside a temple admin's reach.
    expect((await errorOf(await setRole(request("/api/admin/users/set-role", { email: "devotee@example.org", role: "volunteer" })))).status).toBe(403);
    expect((await errorOf(await setRole(request("/api/admin/users/set-role", { email: "prakash@example.org", role: "billing" })))).status).toBe(403);
    expect((await errorOf(await setRole(request("/api/admin/users/set-role", { email: "nikhil@example.org", role: "admin" })))).status).toBe(403);
    expect(mockIdentity.setAccessProfile).not.toHaveBeenCalled();

    const res = await setRole(request("/api/admin/users/set-role", { email: "ramesh@example.org", role: "admin" }));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("seva_audit", expect.objectContaining({ p_staff_id: ADMIN.staffId }));
  });

  it("keeps roles with no seva meaning to a super admin, even for staff within a temple admin's reach (C-17, C-62)", async () => {
    mockSession.actor = ADMIN;
    for (const role of ["billing", "devotee", "volunteer"]) {
      expect(await errorOf(await setRole(request("/api/admin/users/set-role", { email: "ramesh@example.org", role })))).toEqual({
        status: 403,
        code: "forbidden",
      });
    }
    expect(mockIdentity.setAccessProfile).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();

    mockSession.actor = SUPER;
    const res = await setRole(request("/api/admin/users/set-role", { email: "ramesh@example.org", role: "billing" }));
    expect(res.status).toBe(200);
    expect(mockCalls).toEqual(["identity.setAccessProfile", "rpc.seva_audit"]);
    expect(mockIdentity.setAccessProfile).toHaveBeenCalledWith("uid-ramesh", { role: "billing" });
    expect(mockRpc).toHaveBeenCalledWith(
      "seva_audit",
      expect.objectContaining({
        p_entity_id: RAMESH_ID,
        p_before: { role: "receptionist" },
        p_after: { role: "billing" },
        p_staff_id: SUPER.staffId,
      }),
    );
  });

  it("lets a super admin change an account without a staff row, with no audit row", async () => {
    mockSession.actor = SUPER;
    const res = await setRole(request("/api/admin/users/set-role", { email: "devotee@example.org", role: "volunteer" }));
    expect(res.status).toBe(200);
    expect(mockIdentity.setAccessProfile).toHaveBeenCalledWith("uid-devotee", { role: "volunteer" });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("answers not found for an unknown email or an account that never signed in, and 400 for a bad role", async () => {
    mockSession.actor = SUPER;
    expect((await errorOf(await setRole(request("/api/admin/users/set-role", { email: "who@example.org", role: "admin" })))).status).toBe(404);
    expect((await errorOf(await setRole(request("/api/admin/users/set-role", { email: "nobody-signed-in@example.org", role: "admin" })))).status).toBe(404);
    expect(await errorOf(await setRole(request("/api/admin/users/set-role", { email: "ramesh@example.org", role: "owner" })))).toEqual({
      status: 400,
      code: "validation",
    });
    expect(mockIdentity.setAccessProfile).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/users/create-admin", () => {
  const body = { email: "New.Admin@Example.org", password: "long-enough-1", name: "New Admin" };

  it("needs a signed-in super admin (giving the super admin role is row 19)", async () => {
    expect((await errorOf(await createAdmin(request("/api/admin/users/create-admin", body)))).status).toBe(401);
    mockSession.actor = ADMIN;
    expect(await errorOf(await createAdmin(request("/api/admin/users/create-admin", body)))).toEqual({ status: 403, code: "forbidden" });
    expect(mockFirebaseAuth.createUser).not.toHaveBeenCalled();
    expect(mockIdentity.setAccessProfile).not.toHaveBeenCalled();
  });

  it("onboards the new super admin as staff, with the password login first", async () => {
    mockSession.actor = SUPER;
    const res = await createAdmin(request("/api/admin/users/create-admin", body));
    expect(res.status).toBe(200); // as before, for its existing callers
    expect(await res.json()).toMatchObject({ success: true, staffId: "0f6e2b1a-1c1d-4e5f-8a9b-000000000036", staffNo: 36 });
    expect(mockCalls).toEqual(["rpc.seva_next_staff_no", "auth.createUser", "identity.setAccessProfile", "rpc.seva_staff_onboard"]);
    expect(mockFirebaseAuth.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new.admin@example.org", password: "long-enough-1", displayName: "New Admin" }),
    );
    expect(mockIdentity.setAccessProfile).toHaveBeenCalledWith("uid-new-admin", {
      role: "super_admin",
      isActive: true,
      email: "new.admin@example.org",
      displayName: "New Admin",
    });
    expect(mockRpc).toHaveBeenCalledWith("seva_staff_onboard", {
      p_staff: { firebase_uid: "uid-new-admin", full_name: "New Admin", email: "new.admin@example.org", staff_no: 36, view_only: false },
      p_actor: SUPER.staffId,
    });
  });

  it("validates the body and refuses an email that already has a login", async () => {
    mockSession.actor = SUPER;
    expect(await errorOf(await createAdmin(request("/api/admin/users/create-admin", { ...body, password: "short" })))).toEqual({
      status: 400,
      code: "validation",
    });
    expect((await errorOf(await createAdmin(request("/api/admin/users/create-admin", { email: "invalid" })))).status).toBe(400);
    expect(mockFirebaseAuth.createUser).not.toHaveBeenCalled();

    mockLogins["new.admin@example.org"] = "uid-existing";
    expect(await errorOf(await createAdmin(request("/api/admin/users/create-admin", body)))).toEqual({ status: 400, code: "validation" });
    expect(mockIdentity.setAccessProfile).not.toHaveBeenCalled();
  });

  it("still limits how often it can be called from one address", async () => {
    mockSession.actor = SUPER;
    const sameAddress = () =>
      new NextRequest("http://localhost/api/admin/users/create-admin", {
        method: "POST",
        headers: { authorization: "Bearer t", "content-type": "application/json", "x-forwarded-for": "10.9.9.9" },
        body: JSON.stringify({ email: "invalid" }),
      });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await createAdmin(sameAddress())).status);
    expect(statuses).toEqual([400, 400, 400, 400, 400, 429]);
  });
});
