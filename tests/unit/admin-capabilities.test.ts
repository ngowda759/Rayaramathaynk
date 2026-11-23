/**
 * @jest-environment node
 *
 * F-04.3: centralized administrative capability model.
 *
 * These tests pin the role→capability map and prove `requireAdminCapability`
 * reuses the trusted identity verification, keeps 401/403/503 semantics, denies
 * unknown roles/capabilities, and never reads a caller-supplied role.
 */

jest.mock("server-only", () => ({}), { virtual: true });

import { NextRequest } from "next/server";

const mockVerifyAdminUserResult = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => ({
  verifyAdminUserResult: (...args: unknown[]) => mockVerifyAdminUserResult(...args),
}));

import {
  ADMIN_CAPABILITIES,
  adminCan,
  isAdminCapability,
  isAdminConsoleRole,
  requireAdminCapabilities,
  requireAdminCapability,
  type AdminCapability,
} from "@/lib/auth/admin-capabilities";

function request(extraHeaders: Record<string, string> = {}, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/thing", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function verified(role: string) {
  mockVerifyAdminUserResult.mockResolvedValue({
    ok: true,
    provider: "supabase",
    user: { uid: "uid-1", email: "admin@example.com", role, provider: "supabase" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("adminCan — role map", () => {
  test("super_admin may perform every capability", () => {
    for (const capability of ADMIN_CAPABILITIES) {
      expect(adminCan("super_admin", capability)).toBe(true);
    }
  });

  test("temple_admin may write general settings but not the super-admin-only operations", () => {
    for (const capability of [
      "settings.general.write",
      "users.create",
      "users.role.assign",
      "donations.update",
      "events.delete",
      "gallery.delete",
      "ai.settings.write",
      "ai.knowledge.import",
      "knowledge.approve",
      "knowledge.publish",
      "administration.revalidate",
      "administration.seed_ai_settings",
    ] as AdminCapability[]) {
      expect(adminCan("temple_admin", capability)).toBe(true);
    }
    for (const capability of [
      "settings.finance.write",
      "settings.device.write",
      "donations.delete",
      "members.delete",
      "volunteers.delete",
      "users.delete",
    ] as AdminCapability[]) {
      expect(adminCan("temple_admin", capability)).toBe(false);
    }
  });

  test("the legacy `admin` alias has temple_admin capabilities", () => {
    for (const capability of ADMIN_CAPABILITIES) {
      expect(adminCan("admin", capability)).toBe(adminCan("temple_admin", capability));
    }
  });

  test("billing is finance-read only", () => {
    expect(adminCan("billing", "donations.read")).toBe(true);
    expect(adminCan("billing", "settings.finance.read")).toBe(true);
    expect(adminCan("billing", "settings.general.write")).toBe(false);
    expect(adminCan("billing", "donations.update")).toBe(false);
    expect(adminCan("billing", "ai.settings.write")).toBe(false);
    expect(adminCan("billing", "users.create")).toBe(false);
  });

  test("priest may read settings/donations/AI but not write them", () => {
    expect(adminCan("priest", "settings.general.read")).toBe(true);
    expect(adminCan("priest", "donations.read")).toBe(true);
    expect(adminCan("priest", "ai.settings.read")).toBe(true);
    expect(adminCan("priest", "events.write")).toBe(true);
    expect(adminCan("priest", "settings.general.write")).toBe(false);
    expect(adminCan("priest", "donations.update")).toBe(false);
    expect(adminCan("priest", "ai.settings.write")).toBe(false);
    expect(adminCan("priest", "members.delete")).toBe(false);
  });

  test("staff may read and edit events but not settings or AI", () => {
    expect(adminCan("staff", "users.directory.read")).toBe(true);
    expect(adminCan("staff", "donations.read")).toBe(true);
    expect(adminCan("staff", "events.write")).toBe(true);
    expect(adminCan("staff", "settings.general.read")).toBe(false);
    expect(adminCan("staff", "ai.settings.read")).toBe(false);
    expect(adminCan("staff", "members.delete")).toBe(false);
  });

  test("office_staff and unknown roles have no capabilities", () => {
    for (const capability of ADMIN_CAPABILITIES) {
      expect(adminCan("office_staff", capability)).toBe(false);
      expect(adminCan("volunteer", capability)).toBe(false);
      expect(adminCan("devotee", capability)).toBe(false);
      expect(adminCan("", capability)).toBe(false);
    }
  });

  test("role matching is case/space insensitive", () => {
    expect(adminCan(" Super Admin ", "settings.finance.write")).toBe(true);
    expect(adminCan("Temple Admin", "settings.general.write")).toBe(true);
  });
});

describe("capability and role guards", () => {
  test("every declared capability is recognised; junk is not", () => {
    for (const capability of ADMIN_CAPABILITIES) expect(isAdminCapability(capability)).toBe(true);
    for (const junk of ["", "nope", "settings.finance.delete", null, 42, {}]) {
      expect(isAdminCapability(junk)).toBe(false);
    }
  });

  test("only console roles are recognised", () => {
    for (const role of [
      "super_admin",
      "temple_admin",
      "admin",
      "billing",
      "priest",
      "staff",
      "office_staff",
    ]) {
      expect(isAdminConsoleRole(role)).toBe(true);
    }
    for (const role of ["volunteer", "devotee", "receptionist", "prasadam_counter", ""]) {
      expect(isAdminConsoleRole(role)).toBe(false);
    }
  });
});

describe("requireAdminCapability", () => {
  test("refuses an unknown capability without verifying identity", async () => {
    const result = await requireAdminCapability(request(), "not.a.capability" as AdminCapability);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
    expect(mockVerifyAdminUserResult).not.toHaveBeenCalled();
  });

  test("keeps 401 for an unauthenticated caller", async () => {
    mockVerifyAdminUserResult.mockResolvedValue({
      ok: false,
      reason: "missing_token",
      status: 401,
      message: "Missing token",
    });
    const result = await requireAdminCapability(request(), "settings.general.read");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  test("keeps 403 for an inactive profile", async () => {
    mockVerifyAdminUserResult.mockResolvedValue({
      ok: false,
      reason: "inactive_user",
      status: 403,
      message: "Inactive",
    });
    const result = await requireAdminCapability(request(), "settings.general.read");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  test("keeps 503 when authentication infrastructure is unavailable", async () => {
    mockVerifyAdminUserResult.mockResolvedValue({
      ok: false,
      reason: "auth_unavailable",
      status: 503,
      message: "Unavailable",
    });
    const result = await requireAdminCapability(request(), "settings.general.read");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(503);
  });

  test("allows super_admin", async () => {
    verified("super_admin");
    const result = await requireAdminCapability(request(), "settings.finance.write");
    expect(result.ok).toBe(true);
  });

  test("denies temple_admin the finance write and reports the capability", async () => {
    verified("temple_admin");
    const result = await requireAdminCapability(request(), "settings.finance.write");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = (await result.response.json()) as { reason: string; capability: string };
      expect(body.reason).toBe("insufficient_capability");
      expect(body.capability).toBe("settings.finance.write");
    }
  });

  test("ignores a caller-supplied role header or body", async () => {
    verified("staff");
    const result = await requireAdminCapability(
      request({ "x-role": "super_admin" }, { role: "super_admin", uid: "someone-else" }),
      "settings.finance.write",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  test("office_staff is denied a read capability", async () => {
    verified("office_staff");
    const result = await requireAdminCapability(request(), "donations.read");
    expect(result.ok).toBe(false);
  });
});

describe("requireAdminCapabilities", () => {
  test("checks every requested capability with one identity verification", async () => {
    verified("super_admin");
    const result = await requireAdminCapabilities(request(), [
      "settings.general.write",
      "settings.finance.write",
    ]);
    expect(result.ok).toBe(true);
    expect(mockVerifyAdminUserResult).toHaveBeenCalledTimes(1);
  });

  test("fails on the first missing capability", async () => {
    verified("temple_admin");
    const result = await requireAdminCapabilities(request(), [
      "settings.general.write",
      "settings.finance.write",
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = (await result.response.json()) as { capability: string };
      expect(body.capability).toBe("settings.finance.write");
    }
  });

  test("refuses an empty capability list", async () => {
    const result = await requireAdminCapabilities(request(), []);
    expect(result.ok).toBe(false);
    expect(mockVerifyAdminUserResult).not.toHaveBeenCalled();
  });
});

