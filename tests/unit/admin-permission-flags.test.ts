/**
 * @jest-environment node
 *
 * F-04.7: the admin UI derives its permission flags from the same client-safe
 * policy the API enforces. These tests pin the derived flags and prove the
 * policy module has no server-only imports, so the browser can use it.
 */

import fs from "fs";
import path from "path";

import {
  adminCan,
  deriveAdminPermissions,
  isAdminConsoleRole,
} from "@/lib/auth/admin-capability-policy";

const ALL_TRUE = {
  canAccessAdmin: true,
  canAccessSettings: true,
  canAccessFinance: true,
  canManageUsers: true,
  canAccessBilling: true,
  canAccessAdministration: true,
};

const ALL_FALSE = {
  canAccessAdmin: false,
  canAccessSettings: false,
  canAccessFinance: false,
  canManageUsers: false,
  canAccessBilling: false,
  canAccessAdministration: false,
};

describe("deriveAdminPermissions", () => {
  test("super_admin gets every flag", () => {
    expect(deriveAdminPermissions("super_admin")).toEqual(ALL_TRUE);
  });

  test("temple_admin and the legacy admin alias get every flag", () => {
    expect(deriveAdminPermissions("temple_admin")).toEqual(ALL_TRUE);
    expect(deriveAdminPermissions("admin")).toEqual(ALL_TRUE);
  });

  test("billing gets the finance flags only", () => {
    expect(deriveAdminPermissions("billing")).toEqual({
      canAccessAdmin: true,
      canAccessSettings: false,
      canAccessFinance: true,
      canManageUsers: false,
      canAccessBilling: true,
      canAccessAdministration: false,
    });
  });

  test("priest gets read-level settings and finance flags", () => {
    expect(deriveAdminPermissions("priest")).toEqual({
      canAccessAdmin: true,
      canAccessSettings: true,
      canAccessFinance: true,
      canManageUsers: false,
      canAccessBilling: true,
      canAccessAdministration: false,
    });
  });

  test("staff gets the admin shell but no module flags", () => {
    expect(deriveAdminPermissions("staff")).toEqual({
      ...ALL_FALSE,
      canAccessAdmin: true,
    });
  });

  test("office_staff gets the admin shell but no module flags", () => {
    expect(deriveAdminPermissions("office_staff")).toEqual({
      ...ALL_FALSE,
      canAccessAdmin: true,
    });
  });

  test("devotee, volunteer and unknown roles get nothing", () => {
    for (const role of ["devotee", "volunteer", "receptionist", "", null, undefined]) {
      expect(deriveAdminPermissions(role)).toEqual(ALL_FALSE);
    }
  });

  test("role matching is case/space insensitive", () => {
    expect(deriveAdminPermissions(" Super Admin ")).toEqual(ALL_TRUE);
    expect(deriveAdminPermissions("Temple Admin")).toEqual(ALL_TRUE);
  });
});

describe("client-safe policy", () => {
  test("the policy module has no server-only or next/server import", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/auth/admin-capability-policy.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["']server-only["']/);
    expect(source).not.toMatch(/from\s+["']next\/server["']/);
  });

  test("the server module re-exports the policy", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/auth/admin-capabilities.ts"),
      "utf8",
    );
    expect(source).toContain('export * from "./admin-capability-policy"');
    expect(source).toContain('import "server-only"');
  });

  test("the derived flags agree with adminCan for representative cells", () => {
    expect(adminCan("billing", "settings.general.write")).toBe(false);
    expect(adminCan("temple_admin", "settings.general.write")).toBe(true);
    expect(adminCan("staff", "users.directory.read")).toBe(true);
    expect(adminCan("office_staff", "users.directory.read")).toBe(false);
    expect(isAdminConsoleRole("temple_admin")).toBe(true);
    expect(isAdminConsoleRole("devotee")).toBe(false);
  });
});
