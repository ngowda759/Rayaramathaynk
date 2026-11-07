/**
 * @jest-environment node
 *
 * Unit tests for Phase 2 Synchronized Admin and Staff Onboarding.
 * Verifies that:
 *  - Staff onboarding populates auth_user_id when available
 *  - Staff onboarding maintains public.users authorization record
 *  - firebase_uid is preserved
 *  - Idempotent updates succeed
 */

import { onboardStaff } from "@/lib/seva/server/staff";
import type { SevaActor } from "@/lib/seva/permissions";
import type { IdentityAdapter } from "@/lib/seva/server/identity";

jest.mock("server-only", () => ({}), { virtual: true });

const SUPER_ACTOR: SevaActor = {
  staffId: "0f6e2b1a-1c1d-4e5f-8a9b-000000000001",
  uid: "fb-super-admin-uid",
  role: "super_admin",
  viewOnly: false,
  staffNo: 1,
  name: "Super Admin",
};

// In-memory mock database for Supabase
const mockStaffTable: Record<string, unknown>[] = [];
const mockUsersTable: Record<string, unknown>[] = [];

function createTableMock(tableName: string) {
  const table = tableName === "staff" ? mockStaffTable : mockUsersTable;
  const filters: ((r: Record<string, unknown>) => boolean)[] = [];

  const query = {
    select: jest.fn(() => query),
    eq: jest.fn((col: string, val: unknown) => {
      filters.push((r) => r[col] === val);
      return query;
    }),
    maybeSingle: jest.fn(async () => {
      const match = table.find((r) => filters.every((f) => f(r)));
      return { data: match ?? null, error: null };
    }),
    insert: jest.fn(async (row: Record<string, unknown>) => {
      table.push({ ...row, id: row.id ?? `id-${table.length + 1}` });
      return { data: row, error: null };
    }),
    update: jest.fn((patch: Record<string, unknown>) => {
      return {
        eq: jest.fn(async (col: string, val: unknown) => {
          for (const r of table) {
            if (r[col] === val) {
              Object.assign(r, patch);
            }
          }
          return { data: patch, error: null };
        }),
      };
    }),
    in: jest.fn(() => query),
    order: jest.fn(() => query),
  };
  return query;
}

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => createTableMock(table),
    auth: {
      admin: {
        getUserByEmail: jest.fn(async (email: string) => {
          if (email === "supabase.staff@example.com") {
            return { data: { user: { id: "sb-uuid-staff-1" } }, error: null };
          }
          return { data: { user: null }, error: null };
        }),
      },
    },
  }),
}));

const mockRpc = jest.fn<Promise<unknown>, [string, Record<string, unknown>]>(async (fn: string, args: Record<string, unknown>) => {
  if (fn === "seva_next_staff_no") return 42;
  if (fn === "seva_staff_onboard") {
    const pStaff = args.p_staff as Record<string, unknown>;
    if (pStaff?.email === "fail.staff@example.com") {
      throw new Error("DB connection terminated or duplicate staff_no");
    }
    const staffId = "0f6e2b1a-1c1d-4e5f-8a9b-000000000042";
    mockStaffTable.push({
      id: staffId,
      staff_no: pStaff.staff_no,
      email: pStaff.email,
      full_name: pStaff.full_name,
      firebase_uid: pStaff.firebase_uid,
      auth_user_id: null,
      status: "invited",
      view_only: pStaff.view_only ?? false,
      invited_at: new Date().toISOString(),
      first_signed_in_at: null,
    });
    return staffId;
  }
  return null;
});
jest.mock("@/lib/seva/server/rpc", () => ({
  callRpc: (fn: string, args: Record<string, unknown>) => mockRpc(fn, args),
}));

const mockIdentity: jest.Mocked<IdentityAdapter> = {
  verifyRequest: jest.fn(),
  getAccessProfile: jest.fn(async () => null),
  findLoginByEmail: jest.fn(async () => null),
  createLogin: jest.fn(async () => ({ externalUid: "fb-generated-uid-42" })),
  setAccessProfile: jest.fn(async () => undefined),
  setLoginEnabled: jest.fn(async () => undefined),
  deleteLogin: jest.fn(async () => undefined),
};
jest.mock("@/lib/seva/server/identity", () => ({
  getIdentityAdapter: () => mockIdentity,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockStaffTable.length = 0;
  mockUsersTable.length = 0;
});

describe("Synchronized Staff Onboarding", () => {
  it("populates auth_user_id and public.users record when Supabase identity is available", async () => {
    const res = await onboardStaff(
      SUPER_ACTOR,
      { fullName: "Supabase Staff", email: "supabase.staff@example.com", role: "receptionist", viewOnly: false },
      { authUserId: "sb-uuid-staff-1" },
    );

    expect(res.staffId).toBe("0f6e2b1a-1c1d-4e5f-8a9b-000000000042");
    expect(res.staffNo).toBe(42);

    // Verify staff table updated with auth_user_id while preserving firebase_uid
    const staffRow = mockStaffTable.find((r) => r.id === res.staffId);
    expect(staffRow).toBeDefined();
    expect(staffRow?.firebase_uid).toBe("fb-generated-uid-42");
    expect(staffRow?.auth_user_id).toBe("sb-uuid-staff-1");

    // Verify public.users row created with both identities
    const userRow = mockUsersTable.find((r) => r.email === "supabase.staff@example.com");
    expect(userRow).toBeDefined();
    expect(userRow?.role).toBe("receptionist");
    expect(userRow?.active).toBe(true);
    expect(userRow?.firestore_id).toBe("fb-generated-uid-42");
    expect(userRow?.auth_user_id).toBe("sb-uuid-staff-1");
  });

  it("creates public.users authorization row even when Supabase identity is not yet present (Firebase-only)", async () => {
    const res = await onboardStaff(
      SUPER_ACTOR,
      { fullName: "Firebase Staff", email: "firebase.staff@example.com", role: "priest", viewOnly: false },
    );

    expect(res.staffId).toBe("0f6e2b1a-1c1d-4e5f-8a9b-000000000042");

    // public.users should be present with firestore_id
    const userRow = mockUsersTable.find((r) => r.email === "firebase.staff@example.com");
    expect(userRow).toBeDefined();
    expect(userRow?.role).toBe("priest");
    expect(userRow?.active).toBe(true);
    expect(userRow?.firestore_id).toBe("fb-generated-uid-42");
    expect(userRow?.auth_user_id).toBeNull();
  });

  it("is idempotent when public.users row already exists", async () => {
    // Pre-existing public.users row
    mockUsersTable.push({
      id: "existing-user-uuid",
      email: "existing.admin@example.com",
      role: "user",
      active: true,
      firestore_id: null,
      auth_user_id: null,
    });

    await onboardStaff(
      SUPER_ACTOR,
      { fullName: "Existing Admin", email: "existing.admin@example.com", role: "super_admin", viewOnly: false },
      { authUserId: "sb-new-uuid" },
    );

    // Existing user row should be updated, not duplicated
    expect(mockUsersTable.length).toBe(1);
    expect(mockUsersTable[0]).toMatchObject({
      id: "existing-user-uuid",
      email: "existing.admin@example.com",
      role: "super_admin",
      active: true,
      firestore_id: "fb-generated-uid-42",
      auth_user_id: "sb-new-uuid",
    });
  });

  describe("Onboarding Partial Failures & Collision Controls", () => {
    it("reports partial_failure when staff DB insert fails after identity creation", async () => {
      await expect(
        onboardStaff(
          SUPER_ACTOR,
          { fullName: "Failed Staff", email: "fail.staff@example.com", role: "priest", viewOnly: false },
          { authUserId: "sb-fail-uuid" }
        )
      ).rejects.toMatchObject({
        code: "partial_failure",
        detail: expect.objectContaining({
          done: ["identity"],
          failed: "staff",
        }),
      });

      // Staff row was NOT inserted into public.staff
      expect(mockStaffTable.find((s) => s.email === "fail.staff@example.com")).toBeUndefined();
    });

    it("rejects duplicate email before any writes occur", async () => {
      // Pre-existing staff member with this email
      mockStaffTable.push({
        id: "existing-staff-id",
        staff_no: 5,
        email: "taken.email@example.com",
        full_name: "Prior Staff",
        firebase_uid: "fb-taken-uid",
        auth_user_id: null,
        view_only: false,
        status: "active",
        invited_at: null,
        first_signed_in_at: null,
      });

      await expect(
        onboardStaff(
          SUPER_ACTOR,
          { fullName: "Duplicate Staff", email: "taken.email@example.com", role: "priest", viewOnly: false }
        )
      ).rejects.toMatchObject({
        code: "validation",
        detail: expect.objectContaining({
          field: "email",
        }),
      });

      // Identity adapter was never invoked to create a login
      expect(mockIdentity.createLogin).not.toHaveBeenCalled();
    });

    it("rejects duplicate staff number before any writes occur", async () => {
      // Pre-existing staff member with staff_no 10
      mockStaffTable.push({
        id: "existing-staff-10",
        staff_no: 10,
        email: "other@example.com",
        full_name: "Staff Ten",
        firebase_uid: "fb-uid-10",
        auth_user_id: null,
        view_only: false,
        status: "active",
        invited_at: null,
        first_signed_in_at: null,
      });

      await expect(
        onboardStaff(
          SUPER_ACTOR,
          { fullName: "Conflict Staff", email: "new@example.com", staffNo: 10, role: "priest", viewOnly: false }
        )
      ).rejects.toMatchObject({
        code: "validation",
        detail: expect.objectContaining({
          field: "staffNo",
        }),
      });

      // Identity adapter was never invoked
      expect(mockIdentity.createLogin).not.toHaveBeenCalled();
    });
  });
});
