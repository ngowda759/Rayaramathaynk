/**
 * @jest-environment node
 *
 * AUTHZ-01 — the admin user directory is read-only.
 *
 * `/api/admin/users` and `/api/admin/users/[id]` used to export POST/PUT/DELETE that wrote a
 * client-supplied `role` (and `active`) through the service-role client, gated only by
 * `requireAdminUser`. Any console role (`staff`, `office_staff`, `priest`, `billing`,
 * `temple_admin`, `admin`) could therefore grant `super_admin` to themselves or to another
 * account, delete another account, or flip its active flag.
 *
 * The write verbs are retired. Identity and privilege changes belong to the staff module
 * (`requireStaffAdmin` + the DB §3.3 matrix + audit) and to the legacy `set-role` /
 * `create-admin` routes. The legitimate path's matrix — a temple admin cannot grant
 * `super_admin`, cannot change themself, and only a super admin deletes or deactivates — is
 * pinned by `tests/unit/seva/permissions.test.ts` and `tests/unit/seva/seva-auth.test.ts`.
 *
 * These tests pin the read-only contract and the absence of any client-controlled
 * privilege write. They exercise the route modules, not the UI.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { NextRequest } from "next/server";

type DbResult = { data: unknown; error: unknown };

const mockRequireAdminUser = jest.fn();

jest.mock("@/lib/auth/admin-capabilities", () => ({
  requireAdminCapability: (...args: unknown[]) => mockRequireAdminUser(...args),
}));

const mockFrom = jest.fn();
const mockCreateAdminClient = jest.fn(() => ({ from: mockFrom }));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

import * as collectionRoute from "@/app/api/admin/users/route";
import * as itemRoute from "@/app/api/admin/users/[id]/route";
import { userService as browserUserService } from "@/services/user.service";
import { userService as serverUserService } from "@/services/user.server";

const { GET } = collectionRoute;
const { GET: GET_BY_ID } = itemRoute;

const ROOT = process.cwd();

const ADMIN = { uid: "admin-uuid", email: "admin@example.test", role: "super_admin", provider: "supabase" as const };

/** Every role `lib/auth/admin-auth.ts` admits to the console. */
const CONSOLE_ROLES = ["super_admin", "temple_admin", "admin", "billing", "priest", "staff", "office_staff"] as const;

/** The lower-privileged console roles AUTHZ-01 was exploitable from. */
const LOWER_ROLES = ["staff", "office_staff", "priest", "billing"] as const;

const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;

const ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  firestore_id: "fs-1",
  display_name: "Ramesh",
  email: "ramesh@example.org",
  phone_number: "9000000000",
  role: "temple_admin",
  active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

const MAPPED = {
  id: "fs-1",
  name: "Ramesh",
  email: "ramesh@example.org",
  phone: "9000000000",
  role: "temple_admin",
  active: true,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

/** A thenable, chainable stand-in for the postgrest query builder. */
function createQuery(result: DbResult) {
  const calls: string[] = [];
  const query: Record<string, unknown> = {};
  for (const name of ["select", "or", "insert", "update", "delete", "eq"]) {
    query[name] = jest.fn(() => {
      calls.push(name);
      return query;
    });
  }
  query.single = jest.fn(async () => {
    calls.push("single");
    return result;
  });
  query.maybeSingle = jest.fn(async () => {
    calls.push("maybeSingle");
    return result;
  });
  query.then = (resolve: (value: DbResult) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return { query, calls };
}

let fetchSpy: jest.SpyInstance;

function request(path: string, init: { method?: string; body?: unknown } = {}) {
  return new NextRequest(`http://localhost${path}`, {
    method: init.method ?? "GET",
    headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

/**
 * What the framework does with a method a route module does not export: it answers 405 and
 * never calls a handler. Modelled here so a re-added write verb fails the test.
 */
function dispatch(
  routeModule: Record<string, unknown>,
  method: string,
  req: NextRequest
): { status: number; handlerRan: boolean } {
  const handler = routeModule[method];
  if (typeof handler !== "function") return { status: 405, handlerRan: false };
  return { status: 200, handlerRan: true };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAdminUser.mockResolvedValue({ ok: true, user: ADMIN });
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe("GET /api/admin/users (the read path is preserved)", () => {
  it("does not call /api/admin/users recursively (no outbound fetch at all)", async () => {
    const { query } = createQuery({ data: [ROW], error: null });
    mockFrom.mockReturnValue(query);

    const res = await GET(request("/api/admin/users"));

    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reads through the service-role Supabase path and maps rows for the UI", async () => {
    const { query, calls } = createQuery({ data: [ROW], error: null });
    mockFrom.mockReturnValue(query);

    const res = await GET(request("/api/admin/users"));

    expect(mockCreateAdminClient).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(calls).toContain("select");
    await expect(res.json()).resolves.toEqual([MAPPED]);
  });

  it("returns an empty list (not an error) when the directory has no rows", async () => {
    const { query } = createQuery({ data: [], error: null });
    mockFrom.mockReturnValue(query);

    const res = await GET(request("/api/admin/users"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([]);
  });

  it("enforces admin authorization before touching the database", async () => {
    const denied = Response.json({ error: "Unauthorized" }, { status: 401 });
    mockRequireAdminUser.mockResolvedValue({ ok: false, response: denied });

    const res = await GET(request("/api/admin/users"));

    expect(res.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("keeps the 500 contract when the read fails", async () => {
    const { query } = createQuery({ data: null, error: { message: "boom" } });
    mockFrom.mockReturnValue(query);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(request("/api/admin/users"));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Failed to fetch users" });
    errorSpy.mockRestore();
  });

  it("reads one row through the per-id route", async () => {
    const { query } = createQuery({ data: ROW, error: null });
    mockFrom.mockReturnValue(query);

    const res = await GET_BY_ID(request("/api/admin/users/fs-1"), {
      params: Promise.resolve({ id: "fs-1" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(MAPPED);
    expect(mockFrom).toHaveBeenCalledWith("users");
  });

  it("answers 404 for a missing row", async () => {
    const { query } = createQuery({ data: null, error: null });
    mockFrom.mockReturnValue(query);

    const res = await GET_BY_ID(request("/api/admin/users/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "User not found" });
  });
});

describe("AUTHZ-01 — the directory exports no write verb", () => {
  it("the collection route exports GET only", () => {
    for (const method of WRITE_METHODS) {
      expect((collectionRoute as Record<string, unknown>)[method]).toBeUndefined();
    }
  });

  it("the per-id route exports GET only", () => {
    for (const method of WRITE_METHODS) {
      expect((itemRoute as Record<string, unknown>)[method]).toBeUndefined();
    }
  });

  it.each(CONSOLE_ROLES)("a %s caller cannot create, update, deactivate or delete", async (role) => {
    mockRequireAdminUser.mockResolvedValue({ ok: true, user: { ...ADMIN, role } });
    const body = { role: "super_admin", active: true };

    for (const method of WRITE_METHODS) {
      const collection = dispatch(collectionRoute as unknown as Record<string, unknown>, method, request("/api/admin/users", { method, body }));
      const item = dispatch(itemRoute as unknown as Record<string, unknown>, method, request("/api/admin/users/fs-1", { method, body }));
      expect(collection).toEqual({ status: 405, handlerRan: false });
      expect(item).toEqual({ status: 405, handlerRan: false });
    }

    // No request body is read and nothing reaches the database.
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("the service exposes no mutation method that a handler could call", () => {
    for (const name of ["addUser", "updateUser", "deleteUser"]) {
      expect((serverUserService as unknown as Record<string, unknown>)[name]).toBeUndefined();
      expect((browserUserService as unknown as Record<string, unknown>)[name]).toBeUndefined();
    }
  });

  it("the route sources contain no service-role write call", () => {
    for (const path of ["app/api/admin/users/route.ts", "app/api/admin/users/[id]/route.ts"]) {
      const source = readFileSync(join(ROOT, path), "utf8");
      expect(source).not.toMatch(/\.insert\s*\(/);
      expect(source).not.toMatch(/\.update\s*\(/);
      expect(source).not.toMatch(/\.delete\s*\(/);
      expect(source).not.toMatch(/addUser|updateUser|deleteUser/);
    }
  });
});

describe("AUTHZ-01 — self-promotion, cross-user promotion, deactivation and delete", () => {
  /** The four write attempts AUTHZ-01 covered, as the raw bodies an attacker would send. */
  const ATTACKS = [
    { name: "self-promotion to super_admin", method: "PUT", path: "/api/admin/users/self-id", body: { role: "super_admin" } },
    { name: "cross-user promotion to super_admin", method: "PUT", path: "/api/admin/users/victim-id", body: { role: "super_admin" } },
    { name: "self-deactivation", method: "PUT", path: "/api/admin/users/self-id", body: { active: false } },
    { name: "cross-user deactivation", method: "PUT", path: "/api/admin/users/victim-id", body: { active: false } },
    { name: "delete another user", method: "DELETE", path: "/api/admin/users/victim-id", body: { id: "victim-id" } },
    { name: "create a super admin", method: "POST", path: "/api/admin/users", body: { email: "new@example.org", role: "super_admin", active: true } },
  ] as const;

  it.each(LOWER_ROLES)("a %s caller cannot self-promote", async (role) => {
    mockRequireAdminUser.mockResolvedValue({ ok: true, user: { ...ADMIN, uid: "self-id", role } });

    const attempt = dispatch(
      itemRoute as unknown as Record<string, unknown>,
      "PUT",
      request("/api/admin/users/self-id", { method: "PUT", body: { role: "super_admin" } })
    );

    expect(attempt).toEqual({ status: 405, handlerRan: false });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it.each(LOWER_ROLES)("a %s caller cannot promote another user", async (role) => {
    mockRequireAdminUser.mockResolvedValue({ ok: true, user: { ...ADMIN, uid: "caller-id", role } });

    const attempt = dispatch(
      itemRoute as unknown as Record<string, unknown>,
      "PUT",
      request("/api/admin/users/victim-id", { method: "PUT", body: { role: "super_admin" } })
    );

    expect(attempt).toEqual({ status: 405, handlerRan: false });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it.each(LOWER_ROLES)("a %s caller cannot deactivate or delete a user", async (role) => {
    mockRequireAdminUser.mockResolvedValue({ ok: true, user: { ...ADMIN, role } });

    const deactivate = dispatch(
      itemRoute as unknown as Record<string, unknown>,
      "PUT",
      request("/api/admin/users/victim-id", { method: "PUT", body: { active: false } })
    );
    const remove = dispatch(
      itemRoute as unknown as Record<string, unknown>,
      "DELETE",
      request("/api/admin/users/victim-id", { method: "DELETE" })
    );

    expect(deactivate).toEqual({ status: 405, handlerRan: false });
    expect(remove).toEqual({ status: 405, handlerRan: false });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it.each(ATTACKS)("$name is refused with no database access", async ({ method, path, body }) => {
    mockRequireAdminUser.mockResolvedValue({ ok: true, user: { ...ADMIN, uid: "self-id", role: "staff" } });
    const target = path === "/api/admin/users" ? collectionRoute : itemRoute;

    const attempt = dispatch(target as unknown as Record<string, unknown>, method, request(path, { method, body }));

    expect(attempt).toEqual({ status: 405, handlerRan: false });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("AUTHZ-01 — the UI offers no privileged write control", () => {
  it("the accounts table has no edit link and no delete dialog", () => {
    const source = readFileSync(join(ROOT, "components/admin/users/UserTable.tsx"), "utf8");
    expect(source).not.toContain("/edit");
    expect(source).not.toContain("DeleteUserDialog");
  });

  it("the retired write components are gone", () => {
    expect(existsSync(join(ROOT, "components/admin/users/UserForm.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/admin/users/DeleteUserDialog.tsx"))).toBe(false);
  });

  it("the edit address redirects to the staff tab instead of rendering a role form", () => {
    const source = readFileSync(join(ROOT, "app/admin/users/[id]/edit/page.tsx"), "utf8");
    expect(source).toContain("redirect(");
    expect(source).not.toContain("UserForm");
  });

  it("the accounts tab still renders the read-only list", () => {
    const source = readFileSync(join(ROOT, "app/admin/users/page.tsx"), "utf8");
    expect(source).toContain("UserTable");
    expect(source).toContain("userService.getUsers");
  });
});

describe("route source wiring", () => {
  it("collection route imports the server-side service and never the browser client", () => {
    const source = readFileSync(join(ROOT, "app/api/admin/users/route.ts"), "utf8");
    expect(source).toContain('from "@/services/user.server"');
    expect(source).not.toContain("@/services/user.service");
  });

  it("per-id route imports the server-side service and never the browser client", () => {
    const source = readFileSync(join(ROOT, "app/api/admin/users/[id]/route.ts"), "utf8");
    expect(source).toContain('from "@/services/user.server"');
    expect(source).not.toContain("@/services/user.service");
  });

  it("documents the recursion this guards against: the browser client targets the same path", () => {
    const source = readFileSync(join(ROOT, "services/user.service.ts"), "utf8");
    expect(source).toContain('apiFetch<TempleUser[]>("/api/admin/users")');
  });
});
