/**
 * @jest-environment node
 */
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { sha256Hex, verifyDeviceHeader } from "@/lib/seva/server/device";
import { getIdentityAdapter, setIdentityAdapterForTests, type IdentityAdapter } from "@/lib/seva/server/identity";
import { firebaseIdentityAdapter } from "@/lib/seva/server/identity-firebase";
import { businessDate } from "@/lib/seva/time";

jest.mock("server-only", () => ({}), { virtual: true });

// ---- Supabase: an in-memory stand-in for from(table).select().eq().maybeSingle() ----------------------------------
type Row = Record<string, unknown>;
const mockTables: Record<string, Row[]> = { staff: [], counter_devices: [] };
const mockFailing = { table: null as string | null };
const mockQueries: { table: string; columns: string; filters: [string, unknown][] }[] = [];

function mockFakeSupabase() {
  return {
    from(table: string) {
      const call = { table, columns: "", filters: [] as [string, unknown][] };
      const query = {
        select(columns: string) {
          call.columns = columns;
          return query;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          return query;
        },
        async maybeSingle() {
          mockQueries.push(call);
          if (mockFailing.table === table) {
            return { data: null, error: { message: "connection refused for ramesh@example.org", code: "XX000" } };
          }
          const rows = (mockTables[table] ?? []).filter((row) => call.filters.every(([c, v]) => row[c] === v));
          return { data: rows[0] ?? null, error: null };
        },
      };
      return query;
    },
  };
}

jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockFakeSupabase() }));

// ---- Firebase Admin (used only by the real Firebase adapter tests at the bottom) -----------------------------------
const mockAuth = {
  verifyIdToken: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  revokeRefreshTokens: jest.fn(),
  deleteUser: jest.fn(),
};
const mockUserDocs: Record<string, Row | undefined> = {};
const mockUserSet = jest.fn();

jest.mock("firebase-admin/auth", () => ({ getAuth: () => mockAuth }));
jest.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } }));
jest.mock("@/lib/admin-firebase", () => ({
  getAdminApp: async () => ({}),
  getAdminFirestore: async () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = name === "users" ? mockUserDocs[id] : undefined;
          return { exists: data !== undefined, data: () => data };
        },
        set: (...args: unknown[]) => mockUserSet(name, id, ...args),
      }),
    }),
  }),
}));

// ---- Fixtures ------------------------------------------------------------------------------------------------------
const DEVICE_ID = "6f9619ff-8b86-4d11-b42d-00c04fc964ff";
const SECRET = "x3Jd9_vQ-2mN8pLr5sT7uW1yZ4aB6cE0fG2hJ4kM6nP";
const RETIRED_ID = "0e8e0d52-55f5-4a63-9b7e-2a1f3c4d5e6f";

function hashOf(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

const fakeIdentity: jest.Mocked<IdentityAdapter> = {
  verifyRequest: jest.fn(),
  getAccessProfile: jest.fn(),
  createLogin: jest.fn(),
  setAccessProfile: jest.fn(),
  setLoginEnabled: jest.fn(),
  deleteLogin: jest.fn(),
};

function staffRow(over: Row = {}): Row {
  return {
    id: "staff-ramesh",
    firebase_uid: "uid-ramesh",
    staff_no: 23,
    full_name: "Ramesh",
    email: "ramesh@example.org",
    view_only: false,
    status: "active",
    ...over,
  };
}

function request(headers: Record<string, string> = { authorization: "Bearer good-token" }): NextRequest {
  return new NextRequest("http://localhost/api/seva/counter/orders", { headers });
}

function withDevice(header = `${DEVICE_ID}.${SECRET}`): NextRequest {
  return request({ authorization: "Bearer good-token", "x-seva-device": header });
}

async function denial(result: Awaited<ReturnType<typeof requireSevaActor>>): Promise<{ status: number; code: string }> {
  if (result.ok) throw new Error("expected a denial");
  const body = (await result.response.json()) as { error: { code: string; message: string } };
  expect(typeof body.error.message).toBe("string");
  return { status: result.response.status, code: body.error.code };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQueries.length = 0;
  mockFailing.table = null;
  mockTables.staff = [staffRow()];
  mockTables.counter_devices = [
    { id: DEVICE_ID, counter_id: 1, secret_hash: hashOf(SECRET), retired_at: null },
    { id: RETIRED_ID, counter_id: 1, secret_hash: hashOf(SECRET), retired_at: "2026-10-01T05:00:00Z" },
  ];
  fakeIdentity.verifyRequest.mockImplementation(async (req: Request) =>
    req.headers.get("authorization") === "Bearer good-token" ? { externalUid: "uid-ramesh", email: "ramesh@example.org" } : null,
  );
  fakeIdentity.getAccessProfile.mockResolvedValue({ role: "receptionist", isActive: true });
  setIdentityAdapterForTests(fakeIdentity);
});

afterAll(() => {
  setIdentityAdapterForTests(null);
});

// ---- The guard -----------------------------------------------------------------------------------------------------
describe("requireSevaActor", () => {
  it("401 unauthenticated without a token", async () => {
    expect(await denial(await requireSevaActor(request({}), "me"))).toEqual({ status: 401, code: "unauthenticated" });
    expect(await denial(await requireSevaActor(request({ authorization: "Bearer forged" }), "me"))).toEqual({
      status: 401,
      code: "unauthenticated",
    });
    expect(fakeIdentity.getAccessProfile).not.toHaveBeenCalled();
  });

  it("403 staff_inactive when Firestore isActive is false", async () => {
    fakeIdentity.getAccessProfile.mockResolvedValue({ role: "receptionist", isActive: false });
    expect(await denial(await requireSevaActor(request(), "me"))).toEqual({ status: 403, code: "staff_inactive" });
  });

  it("403 staff_inactive when Firestore isActive is missing or not exactly true", async () => {
    for (const isActive of [undefined, null, "true", 1]) {
      fakeIdentity.getAccessProfile.mockResolvedValue({ role: "receptionist", isActive: isActive as unknown as boolean });
      expect(await denial(await requireSevaActor(request(), "me"))).toEqual({ status: 403, code: "staff_inactive" });
    }
  });

  it("403 forbidden when there is no Firestore profile", async () => {
    fakeIdentity.getAccessProfile.mockResolvedValue(null);
    expect(await denial(await requireSevaActor(request(), "me"))).toEqual({ status: 403, code: "forbidden" });
  });

  it("403 forbidden for a legacy role such as billing", async () => {
    for (const role of ["billing", "priest", "staff", "", undefined]) {
      fakeIdentity.getAccessProfile.mockResolvedValue({ role, isActive: true });
      expect(await denial(await requireSevaActor(request(), "me"))).toEqual({ status: 403, code: "forbidden" });
    }
    expect(mockQueries.filter((q) => q.table === "staff")).toHaveLength(0);
  });

  it("403 forbidden when no staff row exists", async () => {
    mockTables.staff = [];
    expect(await denial(await requireSevaActor(request(), "me"))).toEqual({ status: 403, code: "forbidden" });
    expect(mockQueries[0]).toMatchObject({ table: "staff", filters: [["firebase_uid", "uid-ramesh"]] });
  });

  it("403 staff_inactive when Firestore says active but staff says inactive", async () => {
    for (const status of ["inactive", "deleted", "something_else"]) {
      mockTables.staff = [staffRow({ status })];
      expect(await denial(await requireSevaActor(request(), "me"))).toEqual({ status: 403, code: "staff_inactive" });
    }
  });

  it("allows invited staff only for the me action", async () => {
    mockTables.staff = [staffRow({ status: "invited" })];
    const me = await requireSevaActor(request(), "me");
    expect(me.ok).toBe(true);
    expect(await denial(await requireSevaActor(request(), "sevas.read"))).toEqual({ status: 403, code: "staff_inactive" });
    expect(await denial(await requireSevaActor(withDevice(), "counter.issue", { device: "required" }))).toEqual({
      status: 403,
      code: "staff_inactive",
    });
  });

  it("403 view_only for a view-only temple admin on a write action", async () => {
    fakeIdentity.getAccessProfile.mockResolvedValue({ role: "temple_admin", isActive: true });
    mockTables.staff = [staffRow({ view_only: true })];
    expect(await denial(await requireSevaActor(request(), "sevas.edit"))).toEqual({ status: 403, code: "view_only" });
    expect((await requireSevaActor(request(), "reports.view")).ok).toBe(true);
    // A read the view-only switch also closes (phone numbers, C-16) is refused as forbidden.
    expect(await denial(await requireSevaActor(request(), "export.with_phones"))).toEqual({ status: 403, code: "forbidden" });
  });

  it("403 forbidden when the role does not allow the action", async () => {
    expect(await denial(await requireSevaActor(request(), "reports.view"))).toEqual({ status: 403, code: "forbidden" });
  });

  it("403 device_required without the device header when required", async () => {
    expect(await denial(await requireSevaActor(request(), "counter.issue", { device: "required" }))).toEqual({
      status: 403,
      code: "device_required",
    });
  });

  it("403 device_unknown for a wrong secret or a retired device", async () => {
    for (const header of [
      `${DEVICE_ID}.wrong-secret-value-0000000000000000`,
      `${RETIRED_ID}.${SECRET}`,
      `11111111-2222-4333-8444-555555555555.${SECRET}`,
      `not-a-uuid.${SECRET}`,
      `${DEVICE_ID}.`,
      DEVICE_ID,
      "",
    ]) {
      const result = await requireSevaActor(withDevice(header), "counter.issue", { device: "required" });
      expect(await denial(result)).toEqual({ status: 403, code: header === "" ? "device_required" : "device_unknown" });
    }
  });

  it("returns the actor with staff number and the device counter on success", async () => {
    const result = await requireSevaActor(withDevice(), "counter.issue", { device: "required" });
    expect(result).toEqual({
      ok: true,
      actor: { staffId: "staff-ramesh", uid: "uid-ramesh", role: "receptionist", viewOnly: false, staffNo: 23, name: "Ramesh" },
      device: { id: DEVICE_ID, counterId: 1 },
    });
  });

  it("takes identity from the token and staff row, never the Firestore email", async () => {
    fakeIdentity.verifyRequest.mockResolvedValue({ externalUid: "uid-ramesh", email: "ramesh@example.org" });
    fakeIdentity.getAccessProfile.mockResolvedValue({
      role: "receptionist",
      isActive: true,
      email: "edited-by-user@example.org",
    } as unknown as { role: unknown; isActive: boolean });
    const result = await requireSevaActor(request(), "me");
    expect(JSON.stringify(result)).not.toContain("edited-by-user");
  });

  it("gives a receptionist the own-counter context only from a verified device", async () => {
    const today = businessDate(new Date());
    const ctx = { receiptCounterId: 1, receiptBusinessDate: today };
    const listed = await requireSevaActor(withDevice(), "receipts.list", { device: "optional", ctx });
    expect(listed.ok).toBe(true);
    // A counter id handed in by the caller is not trusted; only the verified device sets it.
    const spoofed = await requireSevaActor(request(), "receipts.list", {
      device: "optional",
      ctx: { ...ctx, counterIdOfDevice: 1, todayBusinessDate: today },
    });
    expect(await denial(spoofed)).toEqual({ status: 403, code: "forbidden" });
    // A stale header on an optional-device call is ignored rather than refused...
    const stale = await requireSevaActor(withDevice(`${RETIRED_ID}.${SECRET}`), "me", { device: "optional" });
    expect(stale).toMatchObject({ ok: true, device: null });
    // ...so it still cannot open a receptionist's own-counter list.
    const staleList = await requireSevaActor(withDevice(`${RETIRED_ID}.${SECRET}`), "receipts.list", { device: "optional", ctx });
    expect(await denial(staleList)).toEqual({ status: 403, code: "forbidden" });
  });

  it("does not look at the device header unless the route asks for a device", async () => {
    const result = await requireSevaActor(withDevice(), "me");
    expect(result).toMatchObject({ ok: true, device: null });
    expect(mockQueries.some((q) => q.table === "counter_devices")).toBe(false);
  });

  it("answers 500 internal without leaking when a store fails", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockFailing.table = "staff";
    const result = await requireSevaActor(request(), "me");
    expect(await denial(result)).toEqual({ status: 500, code: "internal" });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("ramesh@example.org");
    fakeIdentity.getAccessProfile.mockRejectedValue(new Error("firestore down for ramesh@example.org"));
    mockFailing.table = null;
    expect(await denial(await requireSevaActor(request(), "me"))).toEqual({ status: 500, code: "internal" });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("ramesh@example.org");
    errorSpy.mockRestore();
  });
});

// ---- Device check --------------------------------------------------------------------------------------------------
describe("verifyDeviceHeader and sha256Hex", () => {
  it("hashes text as lower-case SHA-256 hex", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("accepts the live device with the right secret and nothing else", async () => {
    expect(await verifyDeviceHeader(`${DEVICE_ID}.${SECRET}`)).toEqual({ id: DEVICE_ID, counterId: 1 });
    expect(await verifyDeviceHeader(`${DEVICE_ID.toUpperCase()}.${SECRET}`)).toEqual({ id: DEVICE_ID, counterId: 1 });
    expect(await verifyDeviceHeader(`${DEVICE_ID}.${SECRET}x`)).toBeNull();
    expect(await verifyDeviceHeader(`${RETIRED_ID}.${SECRET}`)).toBeNull();
    expect(await verifyDeviceHeader(null)).toBeNull();
    expect(await verifyDeviceHeader(`${DEVICE_ID}.${"a".repeat(600)}`)).toBeNull();
  });

  it("never queries the database for a malformed header", async () => {
    await verifyDeviceHeader("not-a-uuid.secret");
    await verifyDeviceHeader("no-dot-at-all");
    expect(mockQueries).toHaveLength(0);
  });
});

// ---- The Firebase implementation of the identity adapter -----------------------------------------------------------
describe("Firebase identity adapter", () => {
  function bearer(token: string): Request {
    return new Request("http://localhost/api/seva/me", { headers: { authorization: `Bearer ${token}` } });
  }

  it("is the adapter used when no test adapter is set", () => {
    setIdentityAdapterForTests(null);
    expect(getIdentityAdapter()).toBe(firebaseIdentityAdapter);
  });

  it("verifies the ID token with checkRevoked and takes the email from the token", async () => {
    mockAuth.verifyIdToken.mockResolvedValue({ uid: "uid-ramesh", email: "ramesh@example.org" });
    expect(await firebaseIdentityAdapter.verifyRequest(bearer("tok-1"))).toEqual({
      externalUid: "uid-ramesh",
      email: "ramesh@example.org",
    });
    expect(mockAuth.verifyIdToken).toHaveBeenCalledWith("tok-1", true);
  });

  it("treats a revoked token, a disabled login or no token as signed out", async () => {
    for (const code of ["auth/id-token-revoked", "auth/user-disabled", "auth/id-token-expired"]) {
      mockAuth.verifyIdToken.mockRejectedValue(Object.assign(new Error("refused"), { code }));
      expect(await firebaseIdentityAdapter.verifyRequest(bearer("tok-2"))).toBeNull();
    }
    expect(await firebaseIdentityAdapter.verifyRequest(new Request("http://localhost/api/seva/me"))).toBeNull();
  });

  it("reads role and isActive from users/{uid} and never the users email", async () => {
    mockUserDocs["uid-ramesh"] = { role: "receptionist", isActive: true, email: "edited-by-user@example.org", name: "R" };
    expect(await firebaseIdentityAdapter.getAccessProfile("uid-ramesh")).toEqual({ role: "receptionist", isActive: true });
  });

  it("reads a missing or non-boolean isActive as inactive", async () => {
    for (const doc of [{ role: "receptionist" }, { role: "receptionist", isActive: "true" }, { role: "receptionist", isActive: 1 }]) {
      mockUserDocs["uid-x"] = doc;
      expect(await firebaseIdentityAdapter.getAccessProfile("uid-x")).toEqual({ role: "receptionist", isActive: false });
    }
  });

  it("returns null when there is no users doc", async () => {
    mockUserDocs["uid-none"] = undefined;
    expect(await firebaseIdentityAdapter.getAccessProfile("uid-none")).toBeNull();
  });

  it("creates a login and returns its uid", async () => {
    mockAuth.createUser.mockResolvedValue({ uid: "uid-new" });
    expect(await firebaseIdentityAdapter.createLogin({ email: "new@example.org", displayName: "New Person" })).toEqual({
      externalUid: "uid-new",
    });
    expect(mockAuth.createUser).toHaveBeenCalledWith({
      email: "new@example.org",
      displayName: "New Person",
      emailVerified: false,
      disabled: false,
    });
  });

  it("merges only the given access fields into users/{uid}", async () => {
    await firebaseIdentityAdapter.setAccessProfile("uid-ramesh", { role: "temple_admin", isActive: true });
    expect(mockUserSet).toHaveBeenCalledWith(
      "users",
      "uid-ramesh",
      { uid: "uid-ramesh", role: "temple_admin", isActive: true, updatedAt: "SERVER_TIMESTAMP" },
      { merge: true },
    );
    await firebaseIdentityAdapter.setAccessProfile("uid-new", { email: "new@example.org", displayName: "New Person" });
    expect(mockUserSet).toHaveBeenLastCalledWith(
      "users",
      "uid-new",
      { uid: "uid-new", email: "new@example.org", name: "New Person", updatedAt: "SERVER_TIMESTAMP" },
      { merge: true },
    );
  });

  it("disabling a login also revokes its refresh tokens; enabling does not", async () => {
    await firebaseIdentityAdapter.setLoginEnabled("uid-ramesh", false);
    expect(mockAuth.updateUser).toHaveBeenCalledWith("uid-ramesh", { disabled: true });
    expect(mockAuth.revokeRefreshTokens).toHaveBeenCalledWith("uid-ramesh");
    jest.clearAllMocks();
    await firebaseIdentityAdapter.setLoginEnabled("uid-ramesh", true);
    expect(mockAuth.updateUser).toHaveBeenCalledWith("uid-ramesh", { disabled: false });
    expect(mockAuth.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it("deletes a login and treats one that is already gone as deleted", async () => {
    await firebaseIdentityAdapter.deleteLogin("uid-ramesh");
    expect(mockAuth.deleteUser).toHaveBeenCalledWith("uid-ramesh");
    mockAuth.deleteUser.mockRejectedValueOnce(Object.assign(new Error("gone"), { code: "auth/user-not-found" }));
    await expect(firebaseIdentityAdapter.deleteLogin("uid-gone")).resolves.toBeUndefined();
    mockAuth.deleteUser.mockRejectedValueOnce(Object.assign(new Error("quota"), { code: "auth/quota-exceeded" }));
    await expect(firebaseIdentityAdapter.deleteLogin("uid-busy")).rejects.toThrow("quota");
  });
});
