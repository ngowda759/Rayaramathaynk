/**
 * @jest-environment node
 *
 * Regression coverage for the "All Accounts shows 0 users" defect.
 *
 * The collection route used to import the BROWSER client (`@/services/user.service`),
 * whose `getUsers()` resolves the relative path `/api/admin/users` through
 * `apiFetch`. On a server runtime that call cannot be parsed, so `GET /api/admin/users`
 * answered 500 and the page rendered an empty list. These tests pin the fix:
 *
 * 1. `GET /api/admin/users` performs NO outbound `fetch` (no self-call / recursion).
 * 2. It reads through the service-role Supabase client (`@/services/user.server`).
 * 3. `requireAdminUser` is still enforced before any data access.
 * 4. The per-id endpoint (`[id]`) drives the same server-side path.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { NextRequest } from "next/server";

type DbResult = { data: unknown; error: unknown };

const mockRequireAdminUser = jest.fn();

jest.mock("@/lib/auth/admin-auth", () => ({
  requireAdminUser: (...args: unknown[]) => mockRequireAdminUser(...args),
}));

const mockFrom = jest.fn();
const mockCreateAdminClient = jest.fn(() => ({ from: mockFrom }));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

import { GET, POST, PUT, DELETE } from "@/app/api/admin/users/route";
import {
  GET as GET_BY_ID,
  PUT as PUT_BY_ID,
  DELETE as DELETE_BY_ID,
} from "@/app/api/admin/users/[id]/route";

const ADMIN = { uid: "admin-uuid", email: "admin@example.test", role: "super_admin", provider: "supabase" as const };

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
  // Awaiting the builder itself resolves to the result, exactly like postgrest.
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

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAdminUser.mockResolvedValue({ ok: true, user: ADMIN });
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe("GET /api/admin/users", () => {
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
});

describe("POST /api/admin/users", () => {
  it("creates through the service-role path without any outbound fetch", async () => {
    const { query } = createQuery({ data: { firestore_id: "fs-9", id: "uuid-9" }, error: null });
    mockFrom.mockReturnValue(query);

    const res = await POST(
      request("/api/admin/users", {
        method: "POST",
        body: { name: "New", email: "new@example.org", phone: "", role: "Volunteer", active: true },
      })
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ id: "fs-9" });
    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("collection PUT/DELETE (body id, kept for compatibility)", () => {
  it("PUT updates through the service-role path", async () => {
    const { query } = createQuery({ data: null, error: null });
    mockFrom.mockReturnValue(query);

    const res = await PUT(request("/api/admin/users", { method: "PUT", body: { id: "fs-1", name: "Renamed" } }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("DELETE removes through the service-role path", async () => {
    const { query } = createQuery({ data: null, error: null });
    mockFrom.mockReturnValue(query);

    const res = await DELETE(request("/api/admin/users", { method: "DELETE", body: { id: "fs-1" } }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("GET/PUT/DELETE /api/admin/users/[id]", () => {
  const params = Promise.resolve({ id: "fs-1" });

  it("GET reads one row through the service-role path", async () => {
    const { query } = createQuery({ data: ROW, error: null });
    mockFrom.mockReturnValue(query);

    const res = await GET_BY_ID(request("/api/admin/users/fs-1"), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(MAPPED);
    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("GET answers 404 when the row does not exist", async () => {
    const { query } = createQuery({ data: null, error: null });
    mockFrom.mockReturnValue(query);

    const res = await GET_BY_ID(request("/api/admin/users/missing"), { params });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "User not found" });
  });

  it("PUT updates one row through the service-role path", async () => {
    const { query } = createQuery({ data: null, error: null });
    mockFrom.mockReturnValue(query);

    const res = await PUT_BY_ID(request("/api/admin/users/fs-1", { method: "PUT", body: { role: "Volunteer" } }), {
      params,
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("DELETE removes one row through the service-role path", async () => {
    const { query } = createQuery({ data: null, error: null });
    mockFrom.mockReturnValue(query);

    const res = await DELETE_BY_ID(request("/api/admin/users/fs-1", { method: "DELETE" }), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("enforces admin authorization on the per-id routes", async () => {
    const denied = Response.json({ error: "Unauthorized" }, { status: 401 });
    mockRequireAdminUser.mockResolvedValue({ ok: false, response: denied });

    expect((await GET_BY_ID(request("/api/admin/users/fs-1"), { params })).status).toBe(401);
    expect((await PUT_BY_ID(request("/api/admin/users/fs-1", { method: "PUT", body: {} }), { params })).status).toBe(401);
    expect((await DELETE_BY_ID(request("/api/admin/users/fs-1", { method: "DELETE" }), { params })).status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });
});

describe("route source wiring", () => {
  const root = process.cwd();

  it("collection route imports the server-side service and never the browser client", () => {
    const source = readFileSync(join(root, "app/api/admin/users/route.ts"), "utf8");
    expect(source).toContain('from "@/services/user.server"');
    expect(source).not.toContain("@/services/user.service");
  });

  it("per-id route imports the server-side service and never the browser client", () => {
    const source = readFileSync(join(root, "app/api/admin/users/[id]/route.ts"), "utf8");
    expect(source).toContain('from "@/services/user.server"');
    expect(source).not.toContain("@/services/user.service");
  });

  it("documents the recursion this guards against: the browser client targets the same path", () => {
    const source = readFileSync(join(root, "services/user.service.ts"), "utf8");
    expect(source).toContain('apiFetch<TempleUser[]>("/api/admin/users")');
  });
});
