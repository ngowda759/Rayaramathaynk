/**
 * @jest-environment node
 *
 * Regression guard for audit finding F-A13: every `/api/admin/**` route handler
 * must verify the caller is an authorized admin before it reads or writes data.
 *
 * Two layers:
 *
 *  1. A static census over all 35 route files under `app/api/admin/`. For each
 *     exported HTTP method it asserts the handler body calls one of the shared
 *     authorization guards. This is the part that cannot silently regress when a
 *     new method is added without a guard.
 *
 *  2. Behavioural checks for the priority routes (temple-areas and the analytics,
 *     content and quotes families): an unauthenticated request is rejected with
 *     401 *before* the service layer is touched, an authorized admin request
 *     still succeeds, and the public temple-area read stays open.
 *
 * `requireAdminUser` is stubbed so no Firebase/Supabase credentials are needed;
 * the service layer is stubbed so the assertions target the route wiring.
 */
import fs from "fs";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

jest.mock("server-only", () => ({}), { virtual: true });

const mockRequireAdminUser = jest.fn();
const mockVerifyAdminUser = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => ({
  requireAdminUser: (...args: unknown[]) => mockRequireAdminUser(...args),
  verifyAdminUser: (...args: unknown[]) => mockVerifyAdminUser(...args),
}));

const unauthorized = () =>
  NextResponse.json({ error: "unauthenticated" }, { status: 401 });

beforeEach(() => {
  mockRequireAdminUser.mockReset();
  mockVerifyAdminUser.mockReset();
  // Both guard styles are exercised: `verifyAdminUser` (legacy) returns the
  // admin user or null, `requireAdminUser` returns a structured result.
  mockVerifyAdminUser.mockImplementation(async (...args: unknown[]) => {
    const result = await mockRequireAdminUser(...args);
    return result?.ok ? result.user : null;
  });
});

// ---------------------------------------------------------------------------
// Layer 1: static census
// ---------------------------------------------------------------------------

const GUARDS = [
  "requireAdminUser",
  "verifyAdminUserResult",
  "verifyAdminUser",
  "requireRayaAdminUser",
  "verifyRayaAdminUser",
  "requireStaffAdmin",
];

function adminRouteFiles(): string[] {
  const root = path.join(process.cwd(), "app/api/admin");
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "route.ts") found.push(full);
    }
  };
  walk(root);
  return found.sort();
}

function methodBodies(source: string): Record<string, string> {
  const bodies: Record<string, string> = {};
  const re = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
  const matches = [...source.matchAll(re)];
  matches.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : source.length;
    bodies[m[1]] = source.slice(start, end);
  });
  return bodies;
}

describe("F-A13: admin API route authorization census", () => {
  const files = adminRouteFiles();

  it("enumerates the admin API surface (35 route files)", () => {
    expect(files).toHaveLength(35);
  });

  it("every exported method in every admin route is guarded", () => {
    const unguarded: string[] = [];
    for (const file of files) {
      const rel = path.relative(process.cwd(), file);
      const bodies = methodBodies(fs.readFileSync(file, "utf8"));
      for (const [method, body] of Object.entries(bodies)) {
        const guarded = GUARDS.some((g) => body.includes(g));
        if (!guarded) unguarded.push(`${rel} ${method}`);
      }
    }
    expect(unguarded).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Layer 2: behavioural checks for the priority routes
// ---------------------------------------------------------------------------

const mockGetAreas = jest.fn();
const mockGetArea = jest.fn();
const mockAddArea = jest.fn();
const mockUpdateArea = jest.fn();
const mockDeleteArea = jest.fn();
jest.mock("@/services/temple-areas.service", () => ({
  templeAreasService: {
    getAreas: (...a: unknown[]) => mockGetAreas(...a),
    getPublicAreas: jest.fn().mockResolvedValue([]),
    getArea: (...a: unknown[]) => mockGetArea(...a),
    addArea: (...a: unknown[]) => mockAddArea(...a),
    updateArea: (...a: unknown[]) => mockUpdateArea(...a),
    deleteArea: (...a: unknown[]) => mockDeleteArea(...a),
  },
}));

const mockGetAnalyticsSummary = jest.fn();
const mockLogIntentFeedback = jest.fn();
jest.mock("@/services/analytics.service", () => ({
  getAnalyticsSummary: (...a: unknown[]) => mockGetAnalyticsSummary(...a),
  logIntentFeedback: (...a: unknown[]) => mockLogIntentFeedback(...a),
}));

jest.mock("@/services/content.service", () => ({
  autoTagArticle: jest.fn(),
  getContentFreshness: jest.fn(),
  getFreshnessLabel: jest.fn(),
  getRelatedQuestions: jest.fn(),
  getArticlesNeedingReview: jest.fn(),
  batchFreshnessCheck: jest.fn(),
}));

const mockListQuotes = jest.fn();
const mockGetQuoteById = jest.fn();
const mockCreateQuote = jest.fn();
const mockUpdateQuote = jest.fn();
const mockDeleteQuote = jest.fn();
const mockClearCache = jest.fn();
const mockSeedDefaultQuotes = jest.fn();
jest.mock("@/services/quote.server", () => ({
  quoteService: {
    getQuotes: (...a: unknown[]) => mockListQuotes(...a),
    getQuoteById: (...a: unknown[]) => mockGetQuoteById(...a),
    createQuote: (...a: unknown[]) => mockCreateQuote(...a),
    updateQuote: (...a: unknown[]) => mockUpdateQuote(...a),
    deleteQuote: (...a: unknown[]) => mockDeleteQuote(...a),
    clearCache: (...a: unknown[]) => mockClearCache(...a),
    seedDefaultQuotes: (...a: unknown[]) => mockSeedDefaultQuotes(...a),
    bulkImport: jest.fn().mockResolvedValue({ imported: 0, errors: [] }),
  },
}));

const req = (url: string, init?: RequestInit) =>
  new NextRequest(new URL(url, "http://localhost"), init);

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("F-A13: temple-areas admin routes", () => {
  it("GET rejects an unauthenticated caller before touching the service", async () => {
    mockRequireAdminUser.mockResolvedValue({ ok: false, response: unauthorized() });
    const { GET } = await import("@/app/api/admin/temple-areas/route");
    const res = await GET(req("/api/admin/temple-areas"));
    expect(res.status).toBe(401);
    expect(mockGetAreas).not.toHaveBeenCalled();
  });

  it("GET returns areas for an authorized admin", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: true,
      user: { uid: "u1", email: "a@e.org", role: "admin" },
    });
    mockGetAreas.mockResolvedValue([{ id: "1", name: "Main Hall" }]);
    const { GET } = await import("@/app/api/admin/temple-areas/route");
    const res = await GET(req("/api/admin/temple-areas"));
    expect(res.status).toBe(200);
    expect((await res.json()).areas).toEqual([{ id: "1", name: "Main Hall" }]);
  });

  it("POST rejects an unauthenticated caller", async () => {
    mockRequireAdminUser.mockResolvedValue({ ok: false, response: unauthorized() });
    const { POST } = await import("@/app/api/admin/temple-areas/route");
    const res = await POST(
      req("/api/admin/temple-areas", {
        method: "POST",
        body: JSON.stringify({ name: "X", category: "hall" }),
      })
    );
    expect(res.status).toBe(401);
    expect(mockAddArea).not.toHaveBeenCalled();
  });

  it("[id] GET/PUT/DELETE reject an unauthenticated caller", async () => {
    mockRequireAdminUser.mockResolvedValue({ ok: false, response: unauthorized() });
    const mod = await import("@/app/api/admin/temple-areas/[id]/route");
    expect((await mod.GET(req("/api/admin/temple-areas/1"), params("1"))).status).toBe(401);
    expect(
      (await mod.PUT(
        req("/api/admin/temple-areas/1", { method: "PUT", body: "{}" }),
        params("1")
      )).status
    ).toBe(401);
    expect(
      (await mod.DELETE(req("/api/admin/temple-areas/1", { method: "DELETE" }), params("1")))
        .status
    ).toBe(401);
    expect(mockGetArea).not.toHaveBeenCalled();
    expect(mockUpdateArea).not.toHaveBeenCalled();
    expect(mockDeleteArea).not.toHaveBeenCalled();
  });

  it("the public temple-areas read is not guarded", async () => {
    const { GET } = await import("@/app/api/temple-areas/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mockRequireAdminUser).not.toHaveBeenCalled();
  });
});

describe("F-A13: analytics admin route", () => {
  it("GET rejects an unauthenticated caller before aggregating", async () => {
    mockRequireAdminUser.mockResolvedValue({ ok: false, response: unauthorized() });
    const { GET } = await import("@/app/api/admin/analytics/route");
    const res = await GET(req("/api/admin/analytics"));
    expect(res.status).toBe(401);
    expect(mockGetAnalyticsSummary).not.toHaveBeenCalled();
  });

  it("POST rejects an unauthenticated caller before recording feedback", async () => {
    mockRequireAdminUser.mockResolvedValue({ ok: false, response: unauthorized() });
    const { POST } = await import("@/app/api/admin/analytics/route");
    const res = await POST(
      req("/api/admin/analytics", { method: "POST", body: JSON.stringify({}) })
    );
    expect(res.status).toBe(401);
    expect(mockLogIntentFeedback).not.toHaveBeenCalled();
  });

  it("GET returns the summary for an authorized admin", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: true,
      user: { uid: "u1", email: "a@e.org", role: "admin" },
    });
    mockGetAnalyticsSummary.mockResolvedValue({ unknownQuestions: { total: 0 } });
    const { GET } = await import("@/app/api/admin/analytics/route");
    const res = await GET(req("/api/admin/analytics"));
    expect(res.status).toBe(200);
  });
});

describe("F-A13: content admin route", () => {
  it("GET rejects an unauthenticated caller", async () => {
    mockRequireAdminUser.mockResolvedValue({ ok: false, response: unauthorized() });
    const { GET } = await import("@/app/api/admin/content/route");
    const res = await GET(req("/api/admin/content?action=freshness"));
    expect(res.status).toBe(401);
  });

  it("POST rejects an unauthenticated caller", async () => {
    mockRequireAdminUser.mockResolvedValue({ ok: false, response: unauthorized() });
    const { POST } = await import("@/app/api/admin/content/route");
    const res = await POST(
      req("/api/admin/content", { method: "POST", body: JSON.stringify({ action: "autotag" }) })
    );
    expect(res.status).toBe(401);
  });
});

describe("F-A13: quotes admin routes", () => {
  it("GET/POST/PATCH/DELETE on /api/admin/quotes reject unauthenticated callers", async () => {
    mockRequireAdminUser.mockResolvedValue({ ok: false, response: unauthorized() });
    const mod = await import("@/app/api/admin/quotes/route");
    expect((await mod.GET(req("/api/admin/quotes"))).status).toBe(401);
    expect(
      (await mod.POST(req("/api/admin/quotes", { method: "POST", body: "{}" }))).status
    ).toBe(401);
    expect(
      (await mod.PATCH(req("/api/admin/quotes", { method: "PATCH", body: '{"ids":["1"]}' })))
        .status
    ).toBe(401);
    expect(
      (await mod.DELETE(req("/api/admin/quotes", { method: "DELETE", body: '{"ids":["1"]}' })))
        .status
    ).toBe(401);
    expect(mockListQuotes).not.toHaveBeenCalled();
  });

  it("[id] GET/PUT/DELETE reject unauthenticated callers", async () => {
    mockRequireAdminUser.mockResolvedValue({ ok: false, response: unauthorized() });
    const mod = await import("@/app/api/admin/quotes/[id]/route");
    expect((await mod.GET(req("/api/admin/quotes/1"), params("1"))).status).toBe(401);
    expect(
      (await mod.PUT(req("/api/admin/quotes/1", { method: "PUT", body: "{}" }), params("1")))
        .status
    ).toBe(401);
    expect(
      (await mod.DELETE(req("/api/admin/quotes/1", { method: "DELETE" }), params("1"))).status
    ).toBe(401);
  });

  it("bulk/cache/seed reject unauthenticated callers", async () => {
    mockRequireAdminUser.mockResolvedValue({ ok: false, response: unauthorized() });
    const bulk = await import("@/app/api/admin/quotes/bulk/route");
    const cache = await import("@/app/api/admin/quotes/cache/route");
    const seed = await import("@/app/api/admin/quotes/seed/route");
    expect((await bulk.GET(req("/api/admin/quotes/bulk"))).status).toBe(401);
    expect(
      (await bulk.POST(req("/api/admin/quotes/bulk", { method: "POST", body: "{}" }))).status
    ).toBe(401);
    expect((await cache.POST(req("/api/admin/quotes/cache", { method: "POST" }))).status).toBe(401);
    expect((await seed.POST(req("/api/admin/quotes/seed", { method: "POST" }))).status).toBe(401);
    expect(mockClearCache).not.toHaveBeenCalled();
    expect(mockSeedDefaultQuotes).not.toHaveBeenCalled();
  });
});
