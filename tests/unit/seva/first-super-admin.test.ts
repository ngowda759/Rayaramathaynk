/**
 * @jest-environment node
 *
 * scripts/seva/create-first-super-admin.ts - staff no. 001 for an existing sign-in account, once (DB §7.9, §20.1).
 * The script's work runs against an injected store, so these tests need no Firebase or Supabase.
 */
import {
  createFirstSuperAdmin,
  FirstSuperAdminError,
  parseArgs,
  type FirstSuperAdminStore,
  type StaffSummary,
} from "../../../scripts/seva/create-first-super-admin";

interface FakeState {
  logins: Record<string, { uid: string; displayName: string | null; disabled: boolean }>;
  staff: StaffSummary[];
  audited: Set<string>;
  calls: string[];
  failInsert: boolean;
}

function fakeStore(state: FakeState): FirstSuperAdminStore {
  return {
    findLoginByEmail: async (email) => state.logins[email] ?? null,
    setSuperAdminProfile: async (uid, profile) => {
      state.calls.push(`profile:${uid}:${profile.email}:${profile.name}`);
    },
    listStaff: async () => state.staff.map((row) => ({ ...row })),
    insertStaff: async (row) => {
      state.calls.push(`staff:${row.firebaseUid}:${row.fullName}:${row.email}`);
      if (state.failInsert) throw new Error("connection lost");
      const id = "0f6e2b1a-1c1d-4e5f-8a9b-000000000001";
      state.staff.push({ id, firebaseUid: row.firebaseUid, staffNo: 1, fullName: row.fullName, email: row.email, status: "active" });
      return { id };
    },
    hasOnboardAudit: async (staffId) => state.audited.has(staffId),
    writeOnboardAudit: async (staffId, after) => {
      state.calls.push(`audit:${staffId}:${JSON.stringify(after)}`);
      state.audited.add(staffId);
    },
  };
}

function freshState(): FakeState {
  return {
    logins: { "nikhil@example.org": { uid: "uid-nikhil", displayName: " Nikhil N ", disabled: false } },
    staff: [],
    audited: new Set(),
    calls: [],
    failInsert: false,
  };
}

describe("create-first-super-admin", () => {
  it("makes staff 001 as an active super admin: profile, then staff row, then audit", async () => {
    const state = freshState();
    const result = await createFirstSuperAdmin("Nikhil@Example.org", fakeStore(state));
    expect(result).toEqual({ outcome: "created", staffId: "0f6e2b1a-1c1d-4e5f-8a9b-000000000001", status: "active" });
    expect(state.calls).toEqual([
      "profile:uid-nikhil:nikhil@example.org:Nikhil N",
      "staff:uid-nikhil:Nikhil N:nikhil@example.org",
      `audit:0f6e2b1a-1c1d-4e5f-8a9b-000000000001:${JSON.stringify({
        staff_no: 1,
        full_name: "Nikhil N",
        view_only: false,
        status: "active",
        role: "super_admin",
      })}`,
    ]);
  });

  it("is idempotent: a second run for the same account writes nothing", async () => {
    const state = freshState();
    const store = fakeStore(state);
    await createFirstSuperAdmin("nikhil@example.org", store);
    state.calls.length = 0;
    const again = await createFirstSuperAdmin("nikhil@example.org", store);
    expect(again.outcome).toBe("already_set_up");
    expect(state.calls).toEqual([]);
  });

  it("finishes a run that stopped before its audit row, without touching the profile again", async () => {
    const state = freshState();
    state.staff.push({ id: "0f6e2b1a-1c1d-4e5f-8a9b-000000000001", firebaseUid: "uid-nikhil", staffNo: 1, fullName: "Nikhil N", email: "nikhil@example.org", status: "active" });
    const result = await createFirstSuperAdmin("nikhil@example.org", fakeStore(state));
    expect(result.outcome).toBe("audit_completed");
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]).toMatch(/^audit:/);
  });

  it("never re-grants: staff 001 that was later deactivated stays as it is", async () => {
    const state = freshState();
    state.staff.push({ id: "0f6e2b1a-1c1d-4e5f-8a9b-000000000001", firebaseUid: "uid-nikhil", staffNo: 1, fullName: "Nikhil N", email: "nikhil@example.org", status: "inactive" });
    state.audited.add("0f6e2b1a-1c1d-4e5f-8a9b-000000000001");
    const result = await createFirstSuperAdmin("nikhil@example.org", fakeStore(state));
    expect(result).toMatchObject({ outcome: "already_set_up", status: "inactive" });
    expect(state.calls).toEqual([]);
  });

  it("refuses when staff 001 belongs to another account", async () => {
    const state = freshState();
    state.logins["other@example.org"] = { uid: "uid-other", displayName: "Other", disabled: false };
    state.staff.push({ id: "0f6e2b1a-1c1d-4e5f-8a9b-000000000001", firebaseUid: "uid-nikhil", staffNo: 1, fullName: "Nikhil N", email: "nikhil@example.org", status: "active" });
    await expect(createFirstSuperAdmin("other@example.org", fakeStore(state))).rejects.toThrow(FirstSuperAdminError);
    expect(state.calls).toEqual([]);
  });

  it("refuses once anyone is on the staff table", async () => {
    const state = freshState();
    state.staff.push({ id: "0f6e2b1a-1c1d-4e5f-8a9b-000000000002", firebaseUid: "uid-prakash", staffNo: 2, fullName: "Prakash Rao", email: "prakash@example.org", status: "active" });
    await expect(createFirstSuperAdmin("nikhil@example.org", fakeStore(state))).rejects.toThrow(/Staff and roles/);
    expect(state.calls).toEqual([]);
  });

  it("needs an existing, enabled sign-in account", async () => {
    const state = freshState();
    await expect(createFirstSuperAdmin("nobody@example.org", fakeStore(state))).rejects.toThrow(FirstSuperAdminError);
    state.logins["nikhil@example.org"].disabled = true;
    await expect(createFirstSuperAdmin("nikhil@example.org", fakeStore(state))).rejects.toThrow(/disabled/);
    expect(state.calls).toEqual([]);
  });

  it("uses the email's name part when the account has no display name", async () => {
    const state = freshState();
    state.logins["nikhil@example.org"].displayName = null;
    await createFirstSuperAdmin("nikhil@example.org", fakeStore(state));
    expect(state.calls[1]).toBe("staff:uid-nikhil:nikhil:nikhil@example.org");
  });

  it("can be run again after a failed staff insert", async () => {
    const state = freshState();
    state.failInsert = true;
    await expect(createFirstSuperAdmin("nikhil@example.org", fakeStore(state))).rejects.toThrow("connection lost");
    state.failInsert = false;
    state.calls.length = 0;
    const result = await createFirstSuperAdmin("nikhil@example.org", fakeStore(state));
    expect(result.outcome).toBe("created");
    expect(state.calls.map((call) => call.split(":")[0])).toEqual(["profile", "staff", "audit"]);
  });
});

describe("parseArgs", () => {
  it("reads --email in both spellings and refuses anything else", () => {
    expect(parseArgs(["--email", "Nikhil@Example.org"])).toEqual({ email: "nikhil@example.org" });
    expect(parseArgs(["--email=nikhil@example.org"])).toEqual({ email: "nikhil@example.org" });
    expect(parseArgs(["--help"])).toEqual({ help: true });
    expect(() => parseArgs([])).toThrow(FirstSuperAdminError);
    expect(() => parseArgs(["--email", "not-an-email"])).toThrow(FirstSuperAdminError);
    expect(() => parseArgs(["--email", "a@b.org", "--force"])).toThrow(FirstSuperAdminError);
  });
});
