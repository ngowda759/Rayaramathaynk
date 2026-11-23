/**
 * @jest-environment node
 *
 * Regression guard for the production-readiness audit security fixes.
 *
 *  C-1  the public `/debug` secret-exposure page is gone, and no page or client
 *       component reads a server-side secret out of `process.env`;
 *  H-1  `POST /api/reports/save` is admin-only;
 *  H-2  `GET /api/reports/list` is admin-only;
 *  H-3  `/api/ai/chat/messages` and `/api/ai/chat/sessions` no longer trust a
 *       caller-supplied identity (IDOR);
 *  M-1  `POST /api/revalidate` is admin-only.
 *
 * The guard tests are stubbed so no Supabase/Firebase credentials are needed;
 * the assertions target the route wiring and the source-level invariants.
 */
import fs from "fs";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

jest.mock("server-only", () => ({}), { virtual: true });

// ---------------------------------------------------------------------------
// Layer 1: static invariants
// ---------------------------------------------------------------------------

const ROOT = process.cwd();

/** Every .ts/.tsx file under a repo-relative directory. */
function walk(dir: string, out: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

describe("C-1: no server secret is exposed to the browser", () => {
  it("the public /debug page and its dead debug component are removed", () => {
    expect(fs.existsSync(path.join(ROOT, "app/debug"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, "components/debug/ClientEnvDebug.tsx"))).toBe(false);
  });

  it("no client-shippable module reads a server-side secret from process.env", () => {
    // A `"use client"` module is still server-rendered, so a value read there
    // lands in the HTML payload. Server route handlers (app/api/**/route.ts) and
    // server-only libs may read these; the browser bundle must not.
    const FORBIDDEN = /process\.env\.(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|OPENROUTER_API_KEY|GOOGLE_GENERATIVE_API_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)\b/;
    const offenders: string[] = [];
    const candidates = [
      ...walk("components"),
      ...walk("app").filter(
        (rel) => /\.tsx$/.test(rel) || /(?:^|\/)(?:page|layout)\.tsx$/.test(rel)
      ),
    ];
    for (const rel of candidates) {
      const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
      const isClient = /^\s*["']use client["']/m.test(source);
      const isPageOrLayout = /(?:^|\/)(?:page|layout)\.tsx$/.test(rel);
      if ((isClient || isPageOrLayout) && FORBIDDEN.test(source)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("nothing links to the removed /debug route", () => {
    const offenders: string[] = [];
    for (const rel of [...walk("app"), ...walk("components")]) {
      const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
      if (/["'`]\/debug["'`]/.test(source)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});

describe("H-1/H-2/M-1: previously-open routes now import an admin guard", () => {
  const GUARDED = [
    "app/api/reports/save/route.ts",
    "app/api/reports/list/route.ts",
    "app/api/revalidate/route.ts",
    "app/api/ai/chat/messages/route.ts",
    "app/api/ai/chat/sessions/route.ts",
    "app/api/ai/chat/session/route.ts",
    "app/api/ai/chat/session/[id]/route.ts",
  ];

  it.each(GUARDED)("%s references a shared authorization guard", (rel) => {
    const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
    expect(source).toMatch(/requireAdminUser|requireAdminCapability|verifyBearerIdToken/);
  });
});

// ---------------------------------------------------------------------------
// Layer 2: behavioural checks
// ---------------------------------------------------------------------------

const mockRequireAdminUser = jest.fn();
jest.mock("@/lib/auth/admin-capabilities", () => ({
  requireAdminCapability: (...args: unknown[]) => mockRequireAdminUser(...args),
}));

const mockVerifyBearerIdToken = jest.fn();
jest.mock("@/lib/auth/verify-id-token", () => ({
  verifyBearerIdToken: (...args: unknown[]) => mockVerifyBearerIdToken(...args),
}));

const mockGetChatSession = jest.fn();
const mockGetSessionMessages = jest.fn();
const mockSaveMessage = jest.fn();
const mockGetUserChatSessions = jest.fn();
const mockCreateChatSession = jest.fn();
const mockUpdateChatSession = jest.fn();
jest.mock("@/services/chat.server", () => ({
  getChatSession: (...a: unknown[]) => mockGetChatSession(...a),
  getSessionMessages: (...a: unknown[]) => mockGetSessionMessages(...a),
  saveMessage: (...a: unknown[]) => mockSaveMessage(...a),
  getUserChatSessions: (...a: unknown[]) => mockGetUserChatSessions(...a),
  createChatSession: (...a: unknown[]) => mockCreateChatSession(...a),
  updateChatSession: (...a: unknown[]) => mockUpdateChatSession(...a),
}));

const mockListReports = jest.fn();
const mockSaveScreenshot = jest.fn();
jest.mock("@/services/storage.service", () => ({
  storageService: {
    listReports: (...a: unknown[]) => mockListReports(...a),
    saveScreenshot: (...a: unknown[]) => mockSaveScreenshot(...a),
    generateReportFilename: jest.fn(() => "report.json"),
    saveReport: jest.fn(async () => ({ url: "u", pathname: "p" })),
  },
}));

const mockRevalidatePath = jest.fn();
jest.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidatePath(...a),
}));

const req = (url: string, init?: RequestInit) =>
  new NextRequest(new URL(url, "http://localhost"), init);

const unauthorized = () =>
  NextResponse.json({ error: "unauthenticated" }, { status: 401 });

const authorized = () => ({
  ok: true as const,
  user: { uid: "admin-1", email: "a@e.org", role: "admin" },
});

beforeEach(() => {
  mockRequireAdminUser.mockReset();
  mockVerifyBearerIdToken.mockReset();
  mockGetChatSession.mockReset();
  mockGetSessionMessages.mockReset();
  mockGetUserChatSessions.mockReset();
  mockCreateChatSession.mockReset();
  mockUpdateChatSession.mockReset();
  mockListReports.mockReset();
  mockRevalidatePath.mockReset();
});

describe("H-1: POST /api/reports/save requires an admin", () => {
  it("rejects an unauthenticated caller before touching storage", async () => {
    mockRequireAdminUser.mockResolvedValue({ ok: false, response: unauthorized() });
    const { POST } = await import("@/app/api/reports/save/route");
    const res = await POST(
      req("/api/reports/save", { method: "POST", body: JSON.stringify({ type: "json", content: "{}" }) })
    );
    expect(res.status).toBe(401);
    expect(mockSaveScreenshot).not.toHaveBeenCalled();
  });

  it("allows an authorized admin", async () => {
    mockRequireAdminUser.mockResolvedValue(authorized());
    mockSaveScreenshot.mockResolvedValue({ url: "https://blob/x.png", pathname: "x.png" });
    const { POST } = await import("@/app/api/reports/save/route");
    const res = await POST(
      req("/api/reports/save", { method: "POST", body: JSON.stringify({ type: "screenshot", content: "abc", name: "n" }) })
    );
    expect(res.status).toBe(200);
  });
});

describe("H-2: GET /api/reports/list requires an admin", () => {
  it("rejects an unauthenticated caller before listing", async () => {
    mockRequireAdminUser.mockResolvedValue({ ok: false, response: unauthorized() });
    const { GET } = await import("@/app/api/reports/list/route");
    const res = await GET(req("/api/reports/list"));
    expect(res.status).toBe(401);
    expect(mockListReports).not.toHaveBeenCalled();
  });
});

describe("M-1: POST /api/revalidate requires an admin", () => {
  it("rejects an unauthenticated caller before revalidating", async () => {
    mockRequireAdminUser.mockResolvedValue({ ok: false, response: unauthorized() });
    const { POST } = await import("@/app/api/revalidate/route");
    const res = await POST(req("/api/revalidate", { method: "POST", body: JSON.stringify({ paths: ["/"] }) }));
    expect(res.status).toBe(401);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates for an authorized admin", async () => {
    mockRequireAdminUser.mockResolvedValue(authorized());
    const { POST } = await import("@/app/api/revalidate/route");
    const res = await POST(req("/api/revalidate", { method: "POST", body: JSON.stringify({ paths: ["/"] }) }));
    expect(res.status).toBe(200);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });
});

describe("H-3: /api/ai/chat/messages ownership", () => {
  it("returns an owned session to its verified owner", async () => {
    mockGetChatSession.mockResolvedValue({ id: "s1", userId: "user-1" });
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "user-1", email: null });
    mockGetSessionMessages.mockResolvedValue([{ id: "m1" }]);
    const { GET } = await import("@/app/api/ai/chat/messages/route");
    const res = await GET(req("/api/ai/chat/messages?session=s1"));
    expect(res.status).toBe(200);
  });

  it("refuses an owned session to a different caller (no IDOR)", async () => {
    mockGetChatSession.mockResolvedValue({ id: "s1", userId: "user-1" });
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "attacker", email: null });
    const { GET } = await import("@/app/api/ai/chat/messages/route");
    const res = await GET(req("/api/ai/chat/messages?session=s1"));
    expect(res.status).toBe(404);
    expect(mockGetSessionMessages).not.toHaveBeenCalled();
  });

  it("refuses an owned session to an anonymous caller", async () => {
    mockGetChatSession.mockResolvedValue({ id: "s1", userId: "user-1" });
    mockVerifyBearerIdToken.mockResolvedValue(null);
    const { GET } = await import("@/app/api/ai/chat/messages/route");
    const res = await GET(req("/api/ai/chat/messages?session=s1"));
    expect(res.status).toBe(404);
  });

  it("still serves an anonymous (ownerless) session by its unguessable id", async () => {
    mockGetChatSession.mockResolvedValue({ id: "s1", userId: null });
    mockGetSessionMessages.mockResolvedValue([]);
    const { GET } = await import("@/app/api/ai/chat/messages/route");
    const res = await GET(req("/api/ai/chat/messages?session=s1"));
    expect(res.status).toBe(200);
  });

  it("POST refuses to append to a session owned by someone else", async () => {
    mockGetChatSession.mockResolvedValue({ id: "s1", userId: "user-1" });
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "attacker", email: null });
    const { POST } = await import("@/app/api/ai/chat/messages/route");
    const res = await POST(
      req("/api/ai/chat/messages", {
        method: "POST",
        body: JSON.stringify({ sessionId: "s1", message: { id: "m", role: "user", content: "hi", timestamp: 1 } }),
      })
    );
    expect(res.status).toBe(404);
    expect(mockSaveMessage).not.toHaveBeenCalled();
  });
});

describe("H-3: /api/ai/chat/session/[id] ownership", () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it("refuses to read another user's session", async () => {
    mockGetChatSession.mockResolvedValue({ id: "s1", userId: "user-1" });
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "attacker", email: null });
    const { GET } = await import("@/app/api/ai/chat/session/[id]/route");
    const res = await GET(req("/api/ai/chat/session/s1"), ctx("s1"));
    expect(res.status).toBe(404);
  });

  it("refuses to update another user's session", async () => {
    mockGetChatSession.mockResolvedValue({ id: "s1", userId: "user-1" });
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "attacker", email: null });
    const { PATCH } = await import("@/app/api/ai/chat/session/[id]/route");
    const res = await PATCH(
      req("/api/ai/chat/session/s1", { method: "PATCH", body: JSON.stringify({ lastMessage: "x" }) }),
      ctx("s1")
    );
    expect(res.status).toBe(404);
  });

  it("lets the owner update their session", async () => {
    mockGetChatSession.mockResolvedValue({ id: "s1", userId: "user-1" });
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "user-1", email: null });
    const { PATCH } = await import("@/app/api/ai/chat/session/[id]/route");
    const res = await PATCH(
      req("/api/ai/chat/session/s1", { method: "PATCH", body: JSON.stringify({ lastMessage: "x" }) }),
      ctx("s1")
    );
    expect(res.status).toBe(200);
  });
});

describe("H-3: /api/ai/chat/session derives the owner from the token", () => {
  it("binds a signed-in caller's session to the verified uid, not the body", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "user-1", email: null });
    mockCreateChatSession.mockResolvedValue("sess-1");
    const { POST } = await import("@/app/api/ai/chat/session/route");
    const res = await POST(
      req("/api/ai/chat/session", { method: "POST", body: JSON.stringify({ userId: "attacker" }) })
    );
    expect(res.status).toBe(201);
    expect(mockCreateChatSession).toHaveBeenCalledWith("user-1");
  });

  it("creates an ownerless session for an anonymous caller", async () => {
    mockVerifyBearerIdToken.mockResolvedValue(null);
    mockCreateChatSession.mockResolvedValue("sess-2");
    const { POST } = await import("@/app/api/ai/chat/session/route");
    const res = await POST(
      req("/api/ai/chat/session", { method: "POST", body: JSON.stringify({ userId: "user-1" }) })
    );
    expect(res.status).toBe(201);
    expect(mockCreateChatSession).toHaveBeenCalledWith(null);
  });
});

describe("H-3: /api/ai/chat/sessions derives the owner from the token", () => {
  it("rejects an anonymous caller", async () => {
    mockVerifyBearerIdToken.mockResolvedValue(null);
    const { GET } = await import("@/app/api/ai/chat/sessions/route");
    const res = await GET(req("/api/ai/chat/sessions?user=user-1"));
    expect(res.status).toBe(401);
  });

  it("refuses to list another user's sessions", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "attacker", email: null });
    const { GET } = await import("@/app/api/ai/chat/sessions/route");
    const res = await GET(req("/api/ai/chat/sessions?user=user-1"));
    expect(res.status).toBe(403);
  });

  it("lists the verified caller's own sessions, ignoring the query value", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "user-1", email: null });
    mockGetUserChatSessions.mockResolvedValue([]);
    const { GET } = await import("@/app/api/ai/chat/sessions/route");
    const res = await GET(req("/api/ai/chat/sessions?user=user-1"));
    expect(res.status).toBe(200);
    expect(mockGetUserChatSessions).toHaveBeenCalledWith("user-1", expect.any(Number));
  });
});
