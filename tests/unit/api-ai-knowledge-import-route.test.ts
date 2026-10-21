// Verifies the AI knowledge import route is additive-only: an existing article
// (matched by the UNIQUE `slug` column) must never be replaced, and a
// client-supplied `overwrite: true` must not be honoured.

jest.mock("server-only", () => ({}), { virtual: true });

const mockRequireAdminUser = jest.fn();
jest.mock("@/lib/auth/raya-admin-auth", () => ({
  requireRayaAdminUser: (...args: unknown[]) => mockRequireAdminUser(...args),
}));

// `insert` is the only write the route may perform.
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn(() => ({ select: mockSelect, insert: mockInsert }));
const mockCreateAdminClient = jest.fn(() => ({ from: mockFrom }));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
  readdirSync: jest.fn(() => ["about.json", "faq.json"]),
  readFileSync: jest.fn((filePath: string) =>
    filePath.includes("about")
      ? JSON.stringify({ title: "About", category: "about" })
      : JSON.stringify({ title: "FAQ", category: "faq" })
  ),
}));

import { NextRequest } from "next/server";
import { POST as importPost } from "../../app/api/ai/knowledge/import/route";

function makeRequest(body: unknown = {}) {
  return new NextRequest("http://localhost/api/ai/knowledge/import", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const ADMIN = { ok: true, user: { uid: "admin-1", email: "a@b.c", role: "super_admin" } };

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAdminClient.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert });
  mockRequireAdminUser.mockResolvedValue(ADMIN);
  mockSelect.mockResolvedValue({ data: [], error: null });
  mockInsert.mockResolvedValue({ error: null });
});

describe("POST /api/ai/knowledge/import", () => {
  it("returns 401 and writes nothing when unauthorized", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Unauthorized", reason: "missing_token" }, { status: 401 }),
    });

    const response = await importPost(makeRequest());
    expect(response.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("inserts articles whose slugs do not exist yet", async () => {
    mockSelect.mockResolvedValue({ data: [], error: null });

    const response = await importPost(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.imported).toBe(2);
    expect(body.data.skipped).toBe(0);
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("skips an existing slug instead of replacing the article", async () => {
    mockSelect.mockResolvedValue({
      data: [{ id: "row-1", slug: "faq" }],
      error: null,
    });

    const response = await importPost(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.imported).toBe(1);
    expect(body.data.skipped).toBe(1);
    // Only the non-duplicate "about" article is inserted; "faq" is untouched.
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertedSlug = mockInsert.mock.calls[0][0].slug;
    expect(insertedSlug).toBe("about");
  });

  it("ignores a client-supplied overwrite=true and still skips duplicates", async () => {
    mockSelect.mockResolvedValue({
      data: [{ id: "row-1", slug: "faq" }],
      error: null,
    });

    const response = await importPost(makeRequest({ overwrite: true }));
    const body = await response.json();
    expect(body.data.skipped).toBe(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0].slug).toBe("about");
  });

  it("preserves existing rows: no update/upsert/delete call is made", async () => {
    mockSelect.mockResolvedValue({
      data: [
        { id: "row-1", slug: "faq" },
        { id: "row-2", slug: "about" },
      ],
      error: null,
    });

    const response = await importPost(makeRequest({ overwrite: true }));
    const body = await response.json();
    expect(body.data.imported).toBe(0);
    expect(body.data.skipped).toBe(2);
    expect(mockInsert).not.toHaveBeenCalled();

    const client = mockCreateAdminClient.mock.results[0].value;
    const tableBuilder = client.from.mock.results[0].value;
    expect(tableBuilder.update).toBeUndefined();
    expect(tableBuilder.upsert).toBeUndefined();
    expect(tableBuilder.delete).toBeUndefined();
  });

  it("reports a datastore read failure as 500 and writes nothing", async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: "relation missing" } });

    const response = await importPost(makeRequest());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain("relation missing");
  });

  it("reports an insert failure per file without aborting the batch", async () => {
    mockInsert.mockResolvedValue({ error: { message: "unique violation" } });

    const response = await importPost(makeRequest());
    const body = await response.json();
    expect(body.data.imported).toBe(0);
    expect(body.data.errors).toBe(2);
  });
});
