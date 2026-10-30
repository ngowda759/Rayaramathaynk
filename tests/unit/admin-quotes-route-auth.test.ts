/**
 * @jest-environment node
 *
 * Admin quote routes must reject unauthenticated callers.
 *
 * `/api/admin/*` is not protected by `proxy.ts` (the middleware only sets security
 * headers and tracks page views), so each handler has to verify the caller itself.
 * `app/api/admin/quotes/route.ts` already did; the bulk, cache, seed and [id]
 * routes did not, which left seeding, bulk import, update and delete reachable
 * without a token. These tests pin the guard on every handler.
 */

jest.mock("server-only", () => ({}), { virtual: true });

import { NextRequest } from "next/server";

const mockVerifyAdminUser = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => ({
  verifyAdminUser: (...args: unknown[]) => mockVerifyAdminUser(...args),
}));

// The service is replaced wholesale: these tests are about the route guard, not
// about what the service does once authorized.
const mockSeed = jest.fn(async () => 0);
const mockClearCache = jest.fn();
const mockBulkImport = jest.fn(async () => ({ imported: 0, errors: [] }));
const mockGetQuotes = jest.fn(async () => []);
const mockUpdateQuote = jest.fn(async () => undefined);
const mockDeleteQuote = jest.fn(async () => undefined);
const mockGetQuoteById = jest.fn(async () => null);

jest.mock("@/services/quote.server", () => ({
  quoteService: {
    seedDefaultQuotes: (...a: unknown[]) => mockSeed(...a),
    clearCache: (...a: unknown[]) => mockClearCache(...a),
    bulkImport: (...a: unknown[]) => mockBulkImport(...a),
    getQuotes: (...a: unknown[]) => mockGetQuotes(...a),
    updateQuote: (...a: unknown[]) => mockUpdateQuote(...a),
    deleteQuote: (...a: unknown[]) => mockDeleteQuote(...a),
    getQuoteById: (...a: unknown[]) => mockGetQuoteById(...a),
  },
}));

import { POST as seedPost } from "../../app/api/admin/quotes/seed/route";
import { POST as cachePost } from "../../app/api/admin/quotes/cache/route";
import { GET as bulkGet, POST as bulkPost } from "../../app/api/admin/quotes/bulk/route";
import {
  GET as idGet,
  PUT as idPut,
  DELETE as idDelete,
} from "../../app/api/admin/quotes/[id]/route";

const params = Promise.resolve({ id: "quote-1" });

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/quotes", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyAdminUser.mockResolvedValue(null);
});

describe("admin quote routes reject unauthenticated callers", () => {
  const cases: Array<[string, () => Promise<Response>]> = [
    ["seed POST", () => seedPost(req("POST"))],
    ["cache POST", () => cachePost(req("POST"))],
    ["bulk GET", () => bulkGet(req("GET"))],
    ["bulk POST", () => bulkPost(req("POST", { quotes: [] }))],
    ["[id] GET", () => idGet(req("GET"), { params })],
    ["[id] PUT", () => idPut(req("PUT", { title: "t", category: "raghavendra_stotra", source: "s" }), { params })],
    ["[id] DELETE", () => idDelete(req("DELETE"), { params })],
  ];

  it.each(cases)("%s returns 401 and performs no write", async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(mockSeed).not.toHaveBeenCalled();
    expect(mockBulkImport).not.toHaveBeenCalled();
    expect(mockUpdateQuote).not.toHaveBeenCalled();
    expect(mockDeleteQuote).not.toHaveBeenCalled();
  });

  it("seed POST performs the seed once authorized", async () => {
    mockVerifyAdminUser.mockResolvedValue({ uid: "admin-1", email: "a@b.c" });
    const res = await seedPost(req("POST"));
    expect(res.status).toBe(200);
    expect(mockSeed).toHaveBeenCalledTimes(1);
  });
});
