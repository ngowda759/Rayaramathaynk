/**
 * F-01 regression: `requireSevaActor` must resolve the access profile through
 * `users.auth_user_id` only. A row whose `users.id` equals the Supabase Auth UID
 * (with a NULL or different `auth_user_id`) must never be treated as linked.
 *
 * These tests drive the real `supabaseIdentityAdapter` through the real
 * `requireSevaActor`; only the Supabase client and the token verifier are faked.
 */

import { NextRequest } from "next/server";

jest.mock("@/lib/supabase/admin", () => {
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = { users: [], staff: [], counter_devices: [] };
  const eqCalls: Array<{ table: string; column: string; value: unknown }> = [];

  const client = {
    from: (table: string) => {
      const rows = tables[table] ?? [];
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          eqCalls.push({ table, column, value });
          const matched = rows.filter((row) => row[column] === value);
          return {
            eq: () => builder,
            maybeSingle: async () => ({ data: matched[0] ?? null, error: null }),
            single: async () => ({ data: matched[0] ?? null, error: null }),
          };
        },
        or: (filter: string) => {
          // Emulate the old OR query so a regression to it fails this suite instead of passing.
          const clauses = filter.split(",").map((part) => part.split("."));
          const matched = rows.filter((row) =>
            clauses.some(([column, op, value]) => op === "eq" && String(row[column]) === value),
          );
          return { maybeSingle: async () => ({ data: matched[0] ?? null, error: null }) };
        },
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return builder;
    },
    auth: { admin: {} },
  };

  return {
    createAdminClient: () => client,
    __tables: tables,
    __eqCalls: eqCalls,
  };
});

jest.mock("@/lib/auth/verify-id-token", () => ({
  checkBearerIdToken: jest.fn(),
}));

import { checkBearerIdToken } from "@/lib/auth/verify-id-token";
import { requireSevaActor } from "@/lib/seva/server/auth";

const mockCheckBearerIdToken = checkBearerIdToken as jest.Mock;
const adminMock = jest.requireMock("@/lib/supabase/admin") as {
  __tables: {
    users: Record<string, unknown>[];
    staff: Record<string, unknown>[];
    counter_devices: Record<string, unknown>[];
  };
  __eqCalls: Array<{ table: string; column: string; value: unknown }>;
};

const UID = "550e8400-e29b-41d4-a716-4466554400aa";

function request() {
  return new NextRequest("http://localhost/api/seva/me", {
    headers: { authorization: "Bearer valid-token" },
  });
}

function activeStaffRow(authUserId: string) {
  return {
    id: "staff-row-1",
    auth_user_id: authUserId,
    staff_no: 1,
    full_name: "Test Staff",
    view_only: false,
    status: "active",
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  adminMock.__tables.users.length = 0;
  adminMock.__tables.staff.length = 0;
  adminMock.__tables.counter_devices.length = 0;
  adminMock.__eqCalls.length = 0;
  mockCheckBearerIdToken.mockResolvedValue({
    status: "ok",
    caller: { uid: UID, email: "staff@example.com", emailConfirmedAt: "2026-01-01T00:00:00Z" },
  });
});

describe("requireSevaActor - auth_user_id-only profile resolution (F-01)", () => {
  it("denies when only users.id equals the Auth UID (auth_user_id NULL)", async () => {
    adminMock.__tables.users.push({ id: UID, auth_user_id: null, role: "super_admin", active: true });
    adminMock.__tables.staff.push(activeStaffRow(UID));

    const result = await requireSevaActor(request(), "me");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
    expect(adminMock.__eqCalls.some((call) => call.table === "users" && call.column === "id")).toBe(false);
    expect(
      adminMock.__eqCalls.some(
        (call) => call.table === "users" && call.column === "auth_user_id" && call.value === UID,
      ),
    ).toBe(true);
  });

  it("denies when users.id equals the Auth UID but auth_user_id is a different UUID", async () => {
    adminMock.__tables.users.push({
      id: UID,
      auth_user_id: "550e8400-e29b-41d4-a716-4466554400ff",
      role: "super_admin",
      active: true,
    });
    adminMock.__tables.staff.push(activeStaffRow(UID));

    const result = await requireSevaActor(request(), "me");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("admits when auth_user_id matches the Auth UID", async () => {
    adminMock.__tables.users.push({
      id: "an-independent-row-id",
      auth_user_id: UID,
      role: "receptionist",
      active: true,
    });
    adminMock.__tables.staff.push(activeStaffRow(UID));

    const result = await requireSevaActor(request(), "me");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.actor.uid).toBe(UID);
      expect(result.actor.role).toBe("receptionist");
    }
  });

  it("still denies an inactive profile even when auth_user_id matches", async () => {
    adminMock.__tables.users.push({
      id: "an-independent-row-id",
      auth_user_id: UID,
      role: "receptionist",
      active: false,
    });
    adminMock.__tables.staff.push(activeStaffRow(UID));

    const result = await requireSevaActor(request(), "me");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("still denies a missing profile", async () => {
    adminMock.__tables.staff.push(activeStaffRow(UID));

    const result = await requireSevaActor(request(), "me");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });
});
