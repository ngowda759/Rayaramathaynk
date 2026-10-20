/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import type { IdentityAdapter } from "@/lib/seva/server/identity";
import { SevaError } from "@/lib/seva/errors";
import type { SevaActor } from "@/lib/seva/permissions";
import type { StaffMember } from "@/types/seva-staff";

jest.mock("server-only", () => ({}), { virtual: true });

// ---- The route guard: the real permission matrix over the actor a test signs in as -----------------------------------
const mockSession: { actor: SevaActor | null } = { actor: null };

jest.mock("@/lib/seva/server/auth", () => {
  const { can } = jest.requireActual("@/lib/seva/permissions");
  const { NextResponse: Res } = jest.requireActual("next/server");
  const deny = (code: string, status: number) => ({
    ok: false,
    response: Res.json({ error: { code, message: code } }, { status }),
  });
  return {
    requireSevaActor: jest.fn(async (_req: unknown, action: string, opts?: { ctx?: Record<string, unknown> }) => {
      const actor = mockSession.actor;
      if (!actor) return deny("unauthenticated", 401);
      if (!can(actor, action, opts?.ctx)) return deny(actor.viewOnly ? "view_only" : "forbidden", 403);
      return { ok: true, actor, device: null };
    }),
  };
});

// ---- Supabase: an in-memory stand-in for from(table).select().eq().in().order().limit() -----------------------------
type Row = Record<string, unknown>;
const mockDb: { tables: Record<string, Row[]> } = { tables: {} };

function mockQuery(table: string) {
  const filters: ((row: Row) => boolean)[] = [];
  let sort: { column: string; ascending: boolean } | null = null;
  let max: number | null = null;
  const run = () => {
    let rows = (mockDb.tables[table] ?? []).filter((row) => filters.every((keep) => keep(row)));
    if (sort) {
      const { column, ascending } = sort;
      const key = (row: Row) => (typeof row[column] === "number" ? (row[column] as number) : String(row[column]));
      rows = [...rows].sort((a, b) => (key(a) < key(b) ? -1 : 1) * (ascending ? 1 : -1));
    }
    if (max !== null) rows = rows.slice(0, max);
    return { data: rows.map((row) => ({ ...row })), error: null };
  };
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return query;
    },
    in: (column: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]));
      return query;
    },
    order: (column: string, options?: { ascending?: boolean }) => {
      sort = { column, ascending: options?.ascending !== false };
      return query;
    },
    limit: (n: number) => {
      max = n;
      return query;
    },
    maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(run()).then(resolve, reject),
  };
  return query;
}

jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (table: string) => mockQuery(table) }) }));

// ---- One log of every write, in the order it happened -------------------------------------------------------------
const mockCalls: string[] = [];

// ---- SQL functions --------------------------------------------------------------------------------------------------
type RpcAnswer = (args: Record<string, unknown>) => unknown;
const mockRpcAnswers: Record<string, RpcAnswer> = {};
const mockRpc = jest.fn(async (fn: string, args: Record<string, unknown>) => {
  mockCalls.push(`rpc.${fn}`);
  const answer = mockRpcAnswers[fn];
  if (!answer) throw new Error(`unexpected rpc ${fn}`);
  return answer(args);
});
jest.mock("@/lib/seva/server/rpc", () => ({
  callRpc: (fn: string, args: Record<string, unknown>) => mockRpc(fn, args),
}));

// ---- The identity adapter (Firebase Auth + Firestore users) ---------------------------------------------------------
const mockProfiles: Record<string, Row | undefined> = {};
/** Sign-in accounts that already exist, by email (website admins, devotees, ...). */
const mockLogins: Record<
  string,
  { externalUid: string; displayName: string | null; emailVerified: boolean; disabled: boolean } | undefined
> = {};
const mockIdentity: jest.Mocked<IdentityAdapter> = {
  verifyRequest: jest.fn(),
  findLoginByEmail: jest.fn(async (email: string) => mockLogins[email] ?? null),
  getAccessProfile: jest.fn(async (uid: string) => (mockProfiles[uid] as { role: unknown; isActive: boolean }) ?? null),
  createLogin: jest.fn(async () => {
    mockCalls.push("identity.createLogin");
    return { externalUid: "uid-lakshmi" };
  }),
  setAccessProfile: jest.fn(async () => {
    mockCalls.push("identity.setAccessProfile");
  }),
  setLoginEnabled: jest.fn(async (_uid: string, enabled: boolean) => {
    mockCalls.push(`identity.setLoginEnabled:${enabled}`);
  }),
  deleteLogin: jest.fn(async () => {
    mockCalls.push("identity.deleteLogin");
  }),
};
jest.mock("@/lib/seva/server/identity", () => ({ getIdentityAdapter: () => mockIdentity }));

// ---- Firebase Admin, for the real Firebase adapter's createLogin -----------------------------------------------------
const mockFirebaseAuth = { createUser: jest.fn(), getUserByEmail: jest.fn() };
jest.mock("firebase-admin/auth", () => ({ getAuth: () => mockFirebaseAuth }));
jest.mock("@/lib/admin-firebase", () => ({ getAdminApp: async () => ({}) }));

import { GET, POST } from "../../../app/api/seva/staff/route";
import { PUT } from "../../../app/api/seva/staff/[id]/route";
import { firebaseIdentityAdapter } from "@/lib/seva/server/identity-firebase";
import { staffApi } from "@/services/seva/staff.service";

// ---- Fixtures -------------------------------------------------------------------------------------------------------
const ID = {
  nikhil: "0f6e2b1a-1c1d-4e5f-8a9b-000000000001",
  prakash: "0f6e2b1a-1c1d-4e5f-8a9b-000000000008",
  kamala: "0f6e2b1a-1c1d-4e5f-8a9b-000000000012",
  girish: "0f6e2b1a-1c1d-4e5f-8a9b-000000000019",
  ramesh: "0f6e2b1a-1c1d-4e5f-8a9b-000000000023",
  shobha: "0f6e2b1a-1c1d-4e5f-8a9b-000000000027",
  lakshmi: "0f6e2b1a-1c1d-4e5f-8a9b-000000000035",
};

const SUPER: SevaActor = { staffId: ID.nikhil, uid: "uid-nikhil", role: "super_admin", viewOnly: false, staffNo: 1, name: "Nikhil N" };
const ADMIN: SevaActor = { staffId: ID.prakash, uid: "uid-prakash", role: "temple_admin", viewOnly: false, staffNo: 8, name: "Prakash Rao" };
const VIEWER: SevaActor = { staffId: ID.kamala, uid: "uid-kamala", role: "temple_admin", viewOnly: true, staffNo: 12, name: "Kamala Iyengar" };
const RECEPTIONIST: SevaActor = { staffId: ID.ramesh, uid: "uid-ramesh", role: "receptionist", viewOnly: false, staffNo: 23, name: "Ramesh K" };

function staffRow(id: string, uid: string, no: number, name: string, over: Row = {}): Row {
  return {
    id,
    firebase_uid: uid,
    staff_no: no,
    full_name: name,
    email: `${uid.slice(4)}@example.org`,
    view_only: false,
    status: "active",
    invited_at: "2026-10-01T04:30:00+00:00",
    first_signed_in_at: "2026-10-02T04:30:00+00:00",
    ...over,
  };
}

function resetFixtures() {
  mockDb.tables = {
    staff: [
      staffRow(ID.nikhil, "uid-nikhil", 1, "Nikhil N", { invited_at: null }),
      staffRow(ID.prakash, "uid-prakash", 8, "Prakash Rao"),
      staffRow(ID.kamala, "uid-kamala", 12, "Kamala Iyengar", { view_only: true }),
      staffRow(ID.girish, "uid-girish", 19, "Girish M", { status: "inactive" }),
      staffRow(ID.ramesh, "uid-ramesh", 23, "Ramesh K"),
      staffRow(ID.shobha, "uid-shobha", 27, "Shobha K", { status: "deleted", first_signed_in_at: null }),
    ],
    audit_log: [
      { actor_staff_id: ID.prakash, at: "2026-10-17T14:10:00+00:00" },
      { actor_staff_id: ID.prakash, at: "2026-10-18T09:00:00+00:00" },
      { actor_staff_id: ID.ramesh, at: "2026-10-15T05:00:00+00:00" },
    ],
    seva_receipts: [
      { issued_by_staff_id: ID.ramesh, issued_at: "2026-10-18T06:35:00+00:00" },
      { issued_by_staff_id: ID.ramesh, issued_at: "2026-10-18T05:35:00+00:00" },
    ],
  };
  for (const key of Object.keys(mockLogins)) delete mockLogins[key];
  Object.assign(mockLogins, {
    // A devotee who signed in on the website, and the site owner (a super admin), neither of them staff.
    "priya.s@example.org": { externalUid: "uid-priya", displayName: "Priya S", emailVerified: true, disabled: false },
    "owner@example.org": { externalUid: "uid-owner", displayName: "Site Owner", emailVerified: true, disabled: false },
    // Ramesh's second email: the login is already a staff member's.
    "ramesh.home@example.org": { externalUid: "uid-ramesh", displayName: "Ramesh K", emailVerified: true, disabled: false },
    // A login that never got a Firestore profile.
    "noprofile@example.org": { externalUid: "uid-noprofile", displayName: null, emailVerified: true, disabled: false },
    // A website account switched off on the website (profile isActive false), still able to sign in.
    "lapsed@example.org": { externalUid: "uid-lapsed", displayName: "Lapsed Admin", emailVerified: true, disabled: false },
    // Anyone can register a login for any email: never verified, so never linked.
    "impostor@example.org": { externalUid: "uid-impostor", displayName: "Nikhil N", emailVerified: false, disabled: false },
    // A login switched off in Firebase Authentication.
    "disabled@example.org": { externalUid: "uid-disabled", displayName: "Old Account", emailVerified: true, disabled: true },
  });
  for (const key of Object.keys(mockProfiles)) delete mockProfiles[key];
  Object.assign(mockProfiles, {
    "uid-nikhil": { role: "super_admin", isActive: true },
    // Legacy 'admin' is a temple admin (C-62); the profile's phone must never reach the answer.
    "uid-prakash": { role: "admin", isActive: true, phone: "+919845012345" },
    "uid-kamala": { role: "temple_admin", isActive: true },
    "uid-girish": { role: "receptionist", isActive: false },
    "uid-ramesh": { role: "receptionist", isActive: true, phone: "+919845000023" },
    "uid-shobha": { role: "billing", isActive: false },
    "uid-priya": { role: "devotee", isActive: true },
    "uid-owner": { role: "super_admin", isActive: true },
    "uid-lapsed": { role: "admin", isActive: false },
    "uid-impostor": { role: "devotee", isActive: true },
    "uid-disabled": { role: "devotee", isActive: true },
  });
  for (const key of Object.keys(mockRpcAnswers)) delete mockRpcAnswers[key];
  Object.assign(mockRpcAnswers, {
    seva_next_staff_no: () => 35,
    seva_staff_onboard: (args: Record<string, unknown>) => {
      const p = args.p_staff as Row;
      mockDb.tables.staff.push(
        staffRow(ID.lakshmi, String(p.firebase_uid), Number(p.staff_no), String(p.full_name), {
          email: p.email,
          view_only: p.view_only,
          status: "invited",
          first_signed_in_at: null,
        }),
      );
      return ID.lakshmi;
    },
    seva_staff_update: () => null,
    seva_audit: () => 1,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCalls.length = 0;
  mockSession.actor = null;
  resetFixtures();
});

function get(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/seva/staff${query}`, { headers: { authorization: "Bearer t" } });
}

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/seva/staff", {
    method: "POST",
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function put(id: string, body: unknown): Promise<NextResponse> {
  const req = new NextRequest(`http://localhost/api/seva/staff/${id}`, {
    method: "PUT",
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return PUT(req, { params: Promise.resolve({ id }) });
}

async function errorOf(res: Response): Promise<{ status: number; code: string; detail?: Record<string, unknown> }> {
  const body = (await res.json()) as { error: { code: string; message: string; detail?: Record<string, unknown> } };
  expect(typeof body.error.message).toBe("string");
  return { status: res.status, code: body.error.code, detail: body.error.detail };
}

function identityWrites(): number {
  return (
    mockIdentity.createLogin.mock.calls.length +
    mockIdentity.setAccessProfile.mock.calls.length +
    mockIdentity.setLoginEnabled.mock.calls.length +
    mockIdentity.deleteLogin.mock.calls.length
  );
}

const MEMBER_KEYS = [
  "email",
  "firstSignedInAt",
  "fullName",
  "id",
  "invitedAt",
  "lastActiveAt",
  "role",
  "staffNo",
  "status",
  "viewOnly",
];

// ---------------------------------------------------------------------------------------------------------------------

describe("GET /api/seva/staff", () => {
  it("lists staff with their Firestore role and no phone", async () => {
    mockSession.actor = ADMIN;
    const res = await GET(get("?filter=all"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toMatch(/phone|98450/);
    const { staff } = JSON.parse(text) as { staff: StaffMember[] };

    expect(staff.map((s) => s.staffNo)).toEqual([1, 8, 12, 19, 23, 27]);
    for (const member of staff) expect(Object.keys(member).sort()).toEqual(MEMBER_KEYS);

    const byNo = new Map(staff.map((s) => [s.staffNo, s]));
    expect(byNo.get(1)?.role).toBe("super_admin");
    expect(byNo.get(8)?.role).toBe("temple_admin"); // legacy 'admin'
    expect(byNo.get(27)?.role).toBeNull(); // 'billing' has no seva role
    expect(byNo.get(12)).toMatchObject({ viewOnly: true, fullName: "Kamala Iyengar", email: "kamala@example.org" });
    expect(byNo.get(19)?.status).toBe("inactive");
    // Last active: the latest of first sign-in, audited actions and receipts issued.
    expect(byNo.get(23)?.lastActiveAt).toBe("2026-10-18T06:35:00.000Z");
    expect(byNo.get(8)?.lastActiveAt).toBe("2026-10-18T09:00:00.000Z");
    expect(byNo.get(27)?.lastActiveAt).toBeNull();
  });

  it("filters active (with invited) and inactive (with deleted) people", async () => {
    mockSession.actor = SUPER;
    const active = (await (await GET(get("?filter=active"))).json()) as { staff: StaffMember[] };
    expect(active.staff.map((s) => s.staffNo)).toEqual([1, 8, 12, 23]);
    const inactive = (await (await GET(get("?filter=inactive"))).json()) as { staff: StaffMember[] };
    expect(inactive.staff.map((s) => s.staffNo)).toEqual([19, 27]);
    const bad = await errorOf(await GET(get("?filter=everyone")));
    expect(bad).toMatchObject({ status: 400, code: "validation" });
  });

  it("gives the next free staff number to those who may onboard", async () => {
    mockSession.actor = ADMIN;
    const res = await GET(get("?view=next-staff-no"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nextStaffNo: 35 });
  });

  it("is only for temple admins and super admins, never view-only or counter staff", async () => {
    expect((await errorOf(await GET(get()))).status).toBe(401);
    mockSession.actor = RECEPTIONIST;
    expect(await errorOf(await GET(get()))).toMatchObject({ status: 403, code: "forbidden" });
    mockSession.actor = VIEWER;
    expect(await errorOf(await GET(get()))).toMatchObject({ status: 403, code: "view_only" });
    expect(mockIdentity.getAccessProfile).not.toHaveBeenCalled();
  });
});

describe("POST /api/seva/staff (onboard)", () => {
  const lakshmi = { fullName: "  Lakshmi Narayan ", email: "Lakshmi.N@Example.com", role: "receptionist", viewOnly: false };

  it("onboards with the next staff number and an invited status", async () => {
    mockSession.actor = ADMIN;
    const res = await POST(post(lakshmi));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ staffId: ID.lakshmi, staffNo: 35 });

    // Identity first (login, then profile), then the staff row; the audit row is written inside seva_staff_onboard.
    expect(mockCalls).toEqual([
      "rpc.seva_next_staff_no",
      "identity.createLogin",
      "identity.setAccessProfile",
      "rpc.seva_staff_onboard",
    ]);
    expect(mockIdentity.findLoginByEmail).toHaveBeenCalledWith("lakshmi.n@example.com");
    expect(mockIdentity.createLogin).toHaveBeenCalledWith({ email: "lakshmi.n@example.com", displayName: "Lakshmi Narayan" });
    expect(mockIdentity.setAccessProfile).toHaveBeenCalledWith("uid-lakshmi", {
      role: "receptionist",
      isActive: true,
      email: "lakshmi.n@example.com",
      displayName: "Lakshmi Narayan",
    });
    expect(mockRpc).toHaveBeenCalledWith("seva_staff_onboard", {
      p_staff: {
        firebase_uid: "uid-lakshmi",
        full_name: "Lakshmi Narayan",
        email: "lakshmi.n@example.com",
        staff_no: 35,
        view_only: false,
      },
      p_actor: ADMIN.staffId,
    });

    const { staff } = (await (await GET(get("?filter=active"))).json()) as { staff: StaffMember[] };
    expect(staff.find((s) => s.staffNo === 35)).toMatchObject({ status: "invited", firstSignedInAt: null });
  });

  it("only a super admin can give the super admin role", async () => {
    mockSession.actor = ADMIN;
    expect(await errorOf(await POST(post({ ...lakshmi, role: "super_admin" })))).toMatchObject({
      status: 403,
      code: "forbidden",
    });
    expect(identityWrites()).toBe(0);
    expect(mockRpc).not.toHaveBeenCalledWith("seva_staff_onboard", expect.anything());

    mockSession.actor = SUPER;
    const res = await POST(post({ ...lakshmi, role: "super_admin", staffNo: 36 }));
    expect(res.status).toBe(201);
    expect(mockIdentity.setAccessProfile).toHaveBeenCalledWith("uid-lakshmi", expect.objectContaining({ role: "super_admin" }));
  });

  it("refuses a taken staff number or email before creating any login", async () => {
    mockSession.actor = SUPER;
    const taken = await errorOf(await POST(post({ ...lakshmi, staffNo: 23 })));
    expect(taken).toMatchObject({ status: 400, code: "validation", detail: { field: "staffNo" } });
    const sameEmail = await errorOf(await POST(post({ ...lakshmi, email: "Ramesh@Example.org" })));
    expect(sameEmail).toMatchObject({ status: 400, code: "validation", detail: { field: "email" } });
    const viewOnlyReceptionist = await errorOf(await POST(post({ ...lakshmi, viewOnly: true })));
    expect(viewOnlyReceptionist).toMatchObject({ status: 400, code: "validation" });
    expect(identityWrites()).toBe(0);
  });

  it("answers 400 on the email field when the email already has a sign-in account, with no other writes", async () => {
    mockSession.actor = ADMIN;
    // The real Firebase adapter behind the route, with Firebase Auth refusing the email.
    mockIdentity.createLogin.mockImplementationOnce((login) => firebaseIdentityAdapter.createLogin(login));
    mockFirebaseAuth.createUser.mockRejectedValueOnce(Object.assign(new Error("exists"), { code: "auth/email-already-exists" }));

    const refused = await errorOf(await POST(post(lakshmi)));
    expect(refused).toMatchObject({
      status: 400,
      code: "validation",
      detail: { field: "email", message: "This email already has a sign-in account." },
    });
    expect(mockFirebaseAuth.createUser).toHaveBeenCalledTimes(1);
    expect(mockIdentity.setAccessProfile).not.toHaveBeenCalled();
    expect(mockCalls).toEqual(["rpc.seva_next_staff_no"]);
  });

  it("reports a partial failure loudly when the staff row cannot be written after the login was made", async () => {
    mockSession.actor = ADMIN;
    mockRpcAnswers.seva_staff_onboard = () => {
      throw new SevaError("internal");
    };
    const failure = await errorOf(await POST(post(lakshmi)));
    expect(failure).toMatchObject({ status: 502, code: "partial_failure", detail: { done: ["identity"], failed: "staff" } });
  });
});

describe("POST /api/seva/staff (an email that already has a website account)", () => {
  const priya = { fullName: "Priya S", email: "Priya.S@Example.org", role: "receptionist", viewOnly: false };

  it("a new email still makes a new login", async () => {
    mockSession.actor = ADMIN;
    const res = await POST(post({ ...priya, email: "new.person@example.org" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ staffId: ID.lakshmi, staffNo: 35 });
    expect(mockIdentity.createLogin).toHaveBeenCalledWith({ email: "new.person@example.org", displayName: "Priya S" });
    expect(mockRpc).not.toHaveBeenCalledWith("seva_audit", expect.anything());
  });

  it("without confirmation answers existing_account with the current role, before any write", async () => {
    mockSession.actor = ADMIN;
    const refused = await errorOf(await POST(post(priya)));
    expect(refused).toMatchObject({
      status: 400,
      code: "validation",
      detail: {
        field: "email",
        reason: "existing_account",
        currentRole: "devotee",
        currentlyActive: true,
        displayName: "Priya S",
      },
    });
    expect(identityWrites()).toBe(0);
    expect(mockCalls).toEqual(["rpc.seva_next_staff_no"]);

    // A login with no profile has no current role.
    const bare = await errorOf(await POST(post({ ...priya, email: "noprofile@example.org" })));
    expect(bare.detail).toMatchObject({ reason: "existing_account", currentRole: null, currentlyActive: null, displayName: null });
    const lapsed = await errorOf(await POST(post({ ...priya, email: "lapsed@example.org" })));
    expect(lapsed.detail).toMatchObject({ reason: "existing_account", currentRole: "admin", currentlyActive: false });
    expect(identityWrites()).toBe(0);
  });

  it("with confirmation links the account: no new login, the profile set, a staff row and the audit row", async () => {
    mockSession.actor = ADMIN;
    const res = await POST(post({ ...priya, linkExisting: true }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ staffId: ID.lakshmi, staffNo: 35, linkedExisting: true });

    expect(mockIdentity.createLogin).not.toHaveBeenCalled();
    expect(mockCalls).toEqual([
      "rpc.seva_next_staff_no",
      "identity.setAccessProfile",
      "rpc.seva_staff_onboard",
      "rpc.seva_audit",
    ]);
    expect(mockIdentity.setAccessProfile).toHaveBeenCalledWith("uid-priya", {
      role: "receptionist",
      isActive: true,
      email: "priya.s@example.org",
      displayName: "Priya S",
    });
    expect(mockRpc).toHaveBeenCalledWith("seva_staff_onboard", {
      p_staff: { firebase_uid: "uid-priya", full_name: "Priya S", email: "priya.s@example.org", staff_no: 35, view_only: false },
      p_actor: ADMIN.staffId,
    });
    expect(mockRpc).toHaveBeenCalledWith("seva_audit", {
      p_action: "staff.onboard",
      p_entity: "staff",
      p_entity_id: ID.lakshmi,
      p_receipt_no: null,
      p_reason: null,
      p_before: null,
      p_after: { linked_existing: true, previous_role: "devotee", previous_active: true, role: "receptionist" },
      p_staff_id: ADMIN.staffId,
    });
  });

  it("never links a login whose email is not verified (anyone can register any email), with no writes", async () => {
    mockSession.actor = SUPER;
    const impostor = { ...priya, fullName: "Nikhil N", email: "impostor@example.org", role: "super_admin" };
    // Reported up front, so the dialog never offers "Link this account" for it.
    for (const body of [impostor, { ...impostor, linkExisting: true }]) {
      const refused = await errorOf(await POST(post(body)));
      expect(refused).toMatchObject({ status: 400, code: "validation", detail: { field: "email", reason: "unverified_account" } });
      expect(String(refused.detail?.message)).toMatch(/verification email/);
      expect(String(refused.detail?.message)).toMatch(/register again or contact the site owner/);
    }
    expect(identityWrites()).toBe(0);
    expect(mockCalls).toEqual(["rpc.seva_next_staff_no", "rpc.seva_next_staff_no"]);
  });

  it("never links a login that is switched off in sign-in, with no writes", async () => {
    mockSession.actor = SUPER;
    for (const body of [{ ...priya, email: "disabled@example.org" }, { ...priya, email: "disabled@example.org", linkExisting: true }]) {
      const refused = await errorOf(await POST(post(body)));
      expect(refused).toMatchObject({ status: 400, code: "validation", detail: { field: "email", reason: "disabled_account" } });
    }
    expect(identityWrites()).toBe(0);
    expect(mockRpc).not.toHaveBeenCalledWith("seva_staff_onboard", expect.anything());
  });

  it("linking an inactive website account makes it active and audits what it was", async () => {
    mockSession.actor = ADMIN;
    const res = await POST(post({ ...priya, fullName: "Lapsed Admin", email: "lapsed@example.org", linkExisting: true }));
    expect(res.status).toBe(201);
    expect(mockIdentity.setAccessProfile).toHaveBeenCalledWith("uid-lapsed", expect.objectContaining({ isActive: true }));
    expect(mockRpc).toHaveBeenCalledWith(
      "seva_audit",
      expect.objectContaining({
        p_after: { linked_existing: true, previous_role: "admin", previous_active: false, role: "receptionist" },
      }),
    );
  });

  it("a partial failure on the link path says what the profile held before", async () => {
    mockSession.actor = ADMIN;
    mockRpcAnswers.seva_staff_onboard = () => {
      throw new SevaError("internal");
    };
    const failure = await errorOf(await POST(post({ ...priya, linkExisting: true })));
    expect(failure).toMatchObject({
      status: 502,
      code: "partial_failure",
      detail: { done: ["identity"], failed: "staff", previous_role: "devotee", previous_active: true },
    });
    // A new login's partial failure has nothing overwritten to report.
    const fresh = await errorOf(await POST(post({ ...priya, email: "new.person@example.org" })));
    expect(fresh.detail).not.toHaveProperty("previous_role");
  });

  it("refuses an account that is already staff", async () => {
    mockSession.actor = SUPER;
    const refused = await errorOf(await POST(post({ ...priya, email: "ramesh.home@example.org", linkExisting: true })));
    expect(refused).toMatchObject({ status: 400, code: "validation", detail: { field: "email" } });
    expect(String(refused.detail?.message)).toMatch(/already staff/);
    expect(identityWrites()).toBe(0);
    expect(mockRpc).not.toHaveBeenCalledWith("seva_staff_onboard", expect.anything());
  });

  it("a temple admin cannot link an existing super admin account; a super admin can", async () => {
    const owner = { ...priya, fullName: "Site Owner", email: "owner@example.org", role: "temple_admin", linkExisting: true };
    mockSession.actor = ADMIN;
    expect(await errorOf(await POST(post(owner)))).toMatchObject({ status: 403, code: "forbidden" });
    expect(identityWrites()).toBe(0);
    expect(mockRpc).not.toHaveBeenCalledWith("seva_staff_onboard", expect.anything());

    mockSession.actor = SUPER;
    const res = await POST(post({ ...owner, role: "super_admin" }));
    expect(res.status).toBe(201);
    expect(mockIdentity.setAccessProfile).toHaveBeenCalledWith("uid-owner", expect.objectContaining({ role: "super_admin" }));
    expect(mockRpc).toHaveBeenCalledWith(
      "seva_audit",
      expect.objectContaining({
        p_after: { linked_existing: true, previous_role: "super_admin", previous_active: true, role: "super_admin" },
      }),
    );
  });

  it("a temple admin cannot give the super admin role to a linked account", async () => {
    mockSession.actor = ADMIN;
    expect(await errorOf(await POST(post({ ...priya, role: "super_admin", linkExisting: true })))).toMatchObject({
      status: 403,
      code: "forbidden",
    });
    expect(identityWrites()).toBe(0);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("a view-only temple admin cannot link anyone", async () => {
    mockSession.actor = VIEWER;
    expect(await errorOf(await POST(post({ ...priya, linkExisting: true })))).toMatchObject({ status: 403, code: "view_only" });
    expect(identityWrites()).toBe(0);
    expect(mockIdentity.findLoginByEmail).not.toHaveBeenCalled();
  });

  it("reports a partial failure when the audit row cannot be written after the link", async () => {
    mockSession.actor = ADMIN;
    mockRpcAnswers.seva_audit = () => {
      throw new SevaError("internal");
    };
    const failure = await errorOf(await POST(post({ ...priya, linkExisting: true })));
    expect(failure).toMatchObject({
      status: 502,
      code: "partial_failure",
      detail: { done: ["identity", "staff"], failed: "audit" },
    });
  });
});

describe("PUT /api/seva/staff/[id]", () => {
  it("a temple admin cannot change their own role or a super admin's", async () => {
    mockSession.actor = ADMIN;
    expect((await errorOf(await put(ID.prakash, { role: "receptionist" }))).status).toBe(403); // self
    expect((await errorOf(await put(ID.nikhil, { role: "temple_admin" }))).status).toBe(403); // a super admin
    expect((await errorOf(await put(ID.nikhil, { viewOnly: true }))).status).toBe(403);
    expect((await errorOf(await put(ID.ramesh, { role: "super_admin" }))).status).toBe(403); // granting super admin
    expect(identityWrites()).toBe(0);
    expect(mockRpc).not.toHaveBeenCalled();

    // Another person below super admin is within reach: Firestore first, then the audit row.
    const res = await put(ID.ramesh, { role: "prasadam_counter", reason: "Moved to the prasadam counter" });
    expect(res.status).toBe(200);
    expect(mockCalls).toEqual(["identity.setAccessProfile", "rpc.seva_audit"]);
    expect(mockIdentity.setAccessProfile).toHaveBeenCalledWith("uid-ramesh", { role: "prasadam_counter" });
    expect(mockRpc).toHaveBeenCalledWith("seva_audit", {
      p_action: "staff.role_change",
      p_entity: "staff",
      p_entity_id: ID.ramesh,
      p_receipt_no: null,
      p_reason: "Moved to the prasadam counter",
      p_before: { role: "receptionist" },
      p_after: { role: "prasadam_counter" },
      p_staff_id: ADMIN.staffId,
    });
  });

  it("only a super admin can deactivate or delete, and a reason is required", async () => {
    mockSession.actor = ADMIN;
    expect(await errorOf(await put(ID.ramesh, { status: "inactive", reason: "Left the temple" }))).toMatchObject({
      status: 403,
      code: "forbidden",
    });
    expect((await errorOf(await put(ID.ramesh, { status: "deleted", reason: "Entered twice" }))).status).toBe(403);

    mockSession.actor = SUPER;
    expect(await errorOf(await put(ID.ramesh, { status: "inactive" }))).toMatchObject({ status: 400, code: "validation" });
    expect(await errorOf(await put(ID.ramesh, { status: "deleted", reason: "no" }))).toMatchObject({
      status: 400,
      code: "validation",
    });
    expect(identityWrites()).toBe(0);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("deactivation disables the login and revokes sessions before marking inactive", async () => {
    mockSession.actor = SUPER;
    const res = await put(ID.ramesh, { status: "inactive", reason: "Left the temple" });
    expect(res.status).toBe(200);
    expect(mockCalls).toEqual(["identity.setLoginEnabled:false", "identity.setAccessProfile", "rpc.seva_staff_update"]);
    expect(mockIdentity.setLoginEnabled).toHaveBeenCalledWith("uid-ramesh", false);
    expect(mockIdentity.setAccessProfile).toHaveBeenCalledWith("uid-ramesh", { isActive: false });
    expect(mockRpc).toHaveBeenCalledWith("seva_staff_update", {
      p_staff_id: ID.ramesh,
      p_patch: { status: "inactive" },
      p_reason: "Left the temple",
      p_actor: SUPER.staffId,
    });
  });

  it("delete removes the login for good after closing the profile, then marks the row deleted", async () => {
    mockSession.actor = SUPER;
    const res = await put(ID.girish, { status: "deleted", reason: "Asked to be removed" });
    expect(res.status).toBe(200);
    expect(mockCalls).toEqual(["identity.setAccessProfile", "identity.deleteLogin", "rpc.seva_staff_update"]);
    // A deleted person stays deleted; their email stays on the row, so only a different email can come back.
    expect(await errorOf(await put(ID.shobha, { status: "active" }))).toMatchObject({
      status: 400,
      code: "validation",
      detail: { field: "status", message: expect.stringContaining("different email") },
    });
  });

  it("a temple admin can reactivate", async () => {
    mockSession.actor = ADMIN;
    const res = await put(ID.girish, { status: "active" });
    expect(res.status).toBe(200);
    expect(mockCalls).toEqual(["identity.setAccessProfile", "identity.setLoginEnabled:true", "rpc.seva_staff_update"]);
    expect(mockIdentity.setAccessProfile).toHaveBeenCalledWith("uid-girish", { isActive: true });
    expect(mockRpc).toHaveBeenCalledWith("seva_staff_update", {
      p_staff_id: ID.girish,
      p_patch: { status: "active" },
      p_reason: null,
      p_actor: ADMIN.staffId,
    });
  });

  it("only a super admin can reactivate a super admin (A3 security gate M-1)", async () => {
    // Lakshmi was a super admin and has been offboarded; her Firestore role is still super_admin.
    mockDb.tables.staff.push(staffRow(ID.lakshmi, "uid-lakshmi", 35, "Lakshmi S", { status: "inactive" }));
    mockProfiles["uid-lakshmi"] = { role: "super_admin", isActive: false };

    mockSession.actor = ADMIN;
    expect(await errorOf(await put(ID.lakshmi, { status: "active" }))).toMatchObject({ status: 403, code: "forbidden" });
    expect(identityWrites()).toBe(0);
    expect(mockRpc).not.toHaveBeenCalled();

    mockSession.actor = SUPER;
    const res = await put(ID.lakshmi, { status: "active" });
    expect(res.status).toBe(200);
    expect(mockCalls).toEqual(["identity.setAccessProfile", "identity.setLoginEnabled:true", "rpc.seva_staff_update"]);
    expect(mockIdentity.setAccessProfile).toHaveBeenCalledWith("uid-lakshmi", { isActive: true });
  });

  it("a view-only switch is for temple admins and changes only the staff row", async () => {
    mockSession.actor = ADMIN;
    expect(await errorOf(await put(ID.ramesh, { viewOnly: true }))).toMatchObject({ status: 400, code: "validation" });
    const res = await put(ID.kamala, { viewOnly: false });
    expect(res.status).toBe(200);
    expect(mockCalls).toEqual(["rpc.seva_staff_update"]);
    expect(mockRpc).toHaveBeenCalledWith("seva_staff_update", expect.objectContaining({ p_patch: { view_only: false } }));
  });

  it("reports a partial failure loudly", async () => {
    mockSession.actor = SUPER;
    mockRpcAnswers.seva_staff_update = () => {
      throw new SevaError("internal");
    };
    const failure = await errorOf(await put(ID.ramesh, { status: "inactive", reason: "Left the temple" }));
    expect(failure).toMatchObject({ status: 502, code: "partial_failure", detail: { done: ["identity"], failed: "staff" } });
    expect(mockIdentity.setLoginEnabled).toHaveBeenCalledWith("uid-ramesh", false);
  });

  it("answers not found for an unknown or malformed staff id", async () => {
    mockSession.actor = SUPER;
    expect((await errorOf(await put("0f6e2b1a-1c1d-4e5f-8a9b-000000000999", { status: "active" }))).status).toBe(404);
    expect((await errorOf(await put("not-an-id", { status: "active" }))).status).toBe(404);
  });
});

describe("Firebase identity adapter: createLogin", () => {
  const login = { email: "ramesh@example.org", displayName: "Ramesh K" };

  it("turns an email Firebase refuses into a validation error on the email field", async () => {
    for (const code of ["auth/email-already-exists", "auth/invalid-email"]) {
      mockFirebaseAuth.createUser.mockRejectedValueOnce(Object.assign(new Error("refused"), { code }));
      const error: unknown = await firebaseIdentityAdapter.createLogin(login).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(SevaError);
      expect(error).toMatchObject({ code: "validation", detail: { field: "email" } });
    }
  });

  it("passes any other Firebase failure through, so the route answers 500", async () => {
    const outage = Object.assign(new Error("down"), { code: "auth/internal-error" });
    mockFirebaseAuth.createUser.mockRejectedValueOnce(outage);
    await expect(firebaseIdentityAdapter.createLogin(login)).rejects.toBe(outage);
  });
});

describe("Firebase identity adapter: findLoginByEmail", () => {
  it("returns the existing login's uid and display name", async () => {
    mockFirebaseAuth.getUserByEmail.mockResolvedValueOnce({
      uid: "uid-priya",
      displayName: "Priya S",
      emailVerified: true,
      disabled: false,
    });
    expect(await firebaseIdentityAdapter.findLoginByEmail("priya.s@example.org")).toEqual({
      externalUid: "uid-priya",
      displayName: "Priya S",
      emailVerified: true,
      disabled: false,
    });
    expect(mockFirebaseAuth.getUserByEmail).toHaveBeenCalledWith("priya.s@example.org");
    // Anything but a plain true is read as not verified, and as disabled.
    mockFirebaseAuth.getUserByEmail.mockResolvedValueOnce({ uid: "uid-x", disabled: "yes" });
    expect(await firebaseIdentityAdapter.findLoginByEmail("x@example.org")).toEqual({
      externalUid: "uid-x",
      displayName: null,
      emailVerified: false,
      disabled: true,
    });
  });

  it("answers null when no login has the email, and passes any other failure through", async () => {
    mockFirebaseAuth.getUserByEmail.mockRejectedValueOnce(Object.assign(new Error("none"), { code: "auth/user-not-found" }));
    expect(await firebaseIdentityAdapter.findLoginByEmail("new@example.org")).toBeNull();
    const outage = Object.assign(new Error("down"), { code: "auth/internal-error" });
    mockFirebaseAuth.getUserByEmail.mockRejectedValueOnce(outage);
    await expect(firebaseIdentityAdapter.findLoginByEmail("new@example.org")).rejects.toBe(outage);
  });
});

describe("staffApi (browser client)", () => {
  it("calls the staff routes with the sign-in token", async () => {
    const seen: { url: string; method: string; auth: string | null; body: unknown }[] = [];
    const fetchMock = jest.fn(async (url: string, init: RequestInit) => {
      seen.push({
        url,
        method: init.method ?? "GET",
        auth: new Headers(init.headers).get("authorization"),
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      });
      const answer = url.includes("next-staff-no")
        ? { nextStaffNo: 35 }
        : init.method === "POST"
          ? { staffId: ID.lakshmi, staffNo: 35 }
          : init.method === "PUT"
            ? { ok: true }
            : { staff: [] };
      return new Response(JSON.stringify(answer), { status: 200 });
    });
    const realFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const api = staffApi(async () => "token-1");
      expect(await api.list("inactive")).toEqual([]);
      expect(await api.nextStaffNo()).toBe(35);
      expect(await api.onboard({ fullName: "Lakshmi", email: "l@example.org", role: "receptionist", viewOnly: false })).toEqual({
        staffId: ID.lakshmi,
        staffNo: 35,
      });
      await api.update(ID.ramesh, { status: "inactive", reason: "Left the temple" });
    } finally {
      global.fetch = realFetch;
    }
    expect(seen.map((s) => [s.method, s.url])).toEqual([
      ["GET", "/api/seva/staff?filter=inactive"],
      ["GET", "/api/seva/staff?view=next-staff-no"],
      ["POST", "/api/seva/staff"],
      ["PUT", `/api/seva/staff/${ID.ramesh}`],
    ]);
    expect(seen.every((s) => s.auth === "Bearer token-1")).toBe(true);
    expect(seen[3].body).toEqual({ status: "inactive", reason: "Left the temple" });
  });
});
