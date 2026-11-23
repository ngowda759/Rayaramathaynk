/**
 * Phase 0 — identity-provisioning security remediation (findings S2/S3/S4).
 *
 * Regression coverage for docs/auth/PHASE-2-IDENTITY-UNIFICATION.md §3 and the
 * findings recorded in docs/SECURITY.md:
 *
 *  S2 — /api/auth/register must not bind an unlinked pre-existing row to the
 *       caller's Auth UID on an email match.
 *  S3 — /api/auth/me (and /api/auth/profile) must not adopt a row by email, and
 *       must not resolve the caller through `id.eq.<auth uid>`.
 *  S4 — 23505 race recovery must only ever return a row owned by the caller.
 *
 * The invariant under test: an email address is never proof of account
 * ownership, verified or not.
 */

import { NextRequest } from "next/server";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { GET as meHandler } from "@/app/api/auth/me/route";
import { GET as profileGetHandler, POST as profileHandler } from "@/app/api/auth/profile/route";

const mockGetUserById = jest.fn();
const mockGetUser = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        getUserById: (...args: unknown[]) => mockGetUserById(...args),
        getUserByEmail: jest.fn(),
        createUser: jest.fn(),
        listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }),
      },
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

const mockServerCreateClient = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockServerCreateClient(...args),
}));

const CALLER_UID = "33333333-3333-3333-3333-333333333333";
const EMAIL = "devotee@example.test";

/** Identity lookup used by /api/auth/register. */
function stubIdentity(emailConfirmedAt: string | null, email = EMAIL) {
  mockGetUserById.mockResolvedValueOnce({
    data: { user: { id: CALLER_UID, email, email_confirmed_at: emailConfirmedAt } },
    error: null,
  });
}

/** Bearer-token verification used by every route here. */
function stubCaller(
  email: string | null = EMAIL,
  emailConfirmedAt: string | null = "2026-01-01T00:00:00Z"
) {
  mockGetUser.mockResolvedValueOnce({
    data: { user: { id: CALLER_UID, email, email_confirmed_at: emailConfirmedAt } },
    error: null,
  });
}

function registerRequest(body: Record<string, unknown> = { userId: CALLER_UID, email: EMAIL, name: "Devotee" }) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
    body: JSON.stringify(body),
  });
}

function unauthenticatedRegisterRequest() {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: CALLER_UID, email: EMAIL, name: "Devotee" }),
  });
}

function profilePostRequest(body: Record<string, unknown> = { email: EMAIL, name: "Devotee" }) {
  return new NextRequest("http://localhost/api/auth/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
    body: JSON.stringify(body),
  });
}

function authedRequest(path: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: { Authorization: "Bearer token" },
  });
}

function anonymousRequest(path: string, init?: RequestInit) {
  return new NextRequest(`http://localhost${path}`, init);
}

/** `.select(...).or(...)` returning a fixed row list. */
function selectOrReturns(data: unknown[] | null, error: unknown = null) {
  return {
    select: jest.fn().mockReturnValue({
      or: jest.fn().mockResolvedValue({ data, error }),
    }),
  };
}

/** `.select(...).or(...).maybeSingle()` returning one row or none. */
function selectOrMaybeSingle(data: unknown, error: unknown = null) {
  return {
    select: jest.fn().mockReturnValue({
      or: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

/** `.select(...).eq(...).maybeSingle()` returning one row or none. */
function selectEqMaybeSingle(data: unknown, error: unknown = null) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockServerCreateClient.mockReset();
  mockServerCreateClient.mockRejectedValue(new Error("no cookie session in test"));
});

describe("S2 — register never links an existing row by email", () => {
  it("refuses an unlinked row even though the email is verified", async () => {
    stubCaller();
    stubIdentity("2026-01-01T00:00:00Z");
    mockFrom.mockReturnValueOnce(
      selectOrReturns([{ id: "row-1", auth_user_id: null, email: EMAIL, role: "super_admin" }])
    );

    const res = await registerHandler(registerRequest());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/cannot be claimed automatically/i);
    // No write may follow a refused link.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("rejects an unverified identity before reading the database", async () => {
    stubCaller();
    stubIdentity(null);

    const res = await registerHandler(registerRequest());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/verification is required/i);
    // The gate precedes every read, so an unverified caller cannot probe for rows.
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("is idempotent when the row already belongs to this identity", async () => {
    stubCaller();
    stubIdentity("2026-01-01T00:00:00Z");
    mockFrom.mockReturnValueOnce(
      selectOrReturns([{ id: "row-1", auth_user_id: CALLER_UID, email: EMAIL, role: "devotee" }])
    );

    const res = await registerHandler(registerRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("creates a devotee row when no row exists", async () => {
    stubCaller();
    stubIdentity("2026-01-01T00:00:00Z");
    mockFrom.mockReturnValueOnce(selectOrReturns([]));
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValueOnce({ insert });

    const res = await registerHandler(registerRequest());

    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toMatchObject({
      auth_user_id: CALLER_UID,
      email: EMAIL,
      role: "devotee",
    });
  });

  it("fails closed when the verification state cannot be read", async () => {
    stubCaller();
    mockGetUserById.mockResolvedValueOnce({ data: { user: null }, error: { message: "boom" } });

    const res = await registerHandler(registerRequest());

    expect(res.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("S3 — /api/auth/me resolves only by auth_user_id", () => {
  it("does not adopt a row whose id equals the Auth UID but is unlinked", async () => {
    stubCaller();
    // Row lookup by auth_user_id finds nothing ...
    mockFrom.mockReturnValueOnce(selectEqMaybeSingle(null));
    // ... but a row with id = callerUid and this email exists.
    mockFrom.mockReturnValueOnce(
      selectOrReturns([{ id: CALLER_UID, auth_user_id: null, email: EMAIL }])
    );

    const res = await meHandler(authedRequest("/api/auth/me"));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/cannot be claimed automatically/i);
    // The legacy id-based row was never returned as the caller's profile.
    expect(body.role).toBeUndefined();
  });

  it("refuses to duplicate a row that already holds this email", async () => {
    stubCaller();
    mockFrom.mockReturnValueOnce(selectEqMaybeSingle(null));
    mockFrom.mockReturnValueOnce(
      selectOrReturns([{ id: "row-other", auth_user_id: "other-uid", email: EMAIL }])
    );

    const res = await meHandler(authedRequest("/api/auth/me"));

    expect(res.status).toBe(409);
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it("returns the caller's own linked profile", async () => {
    stubCaller();
    mockFrom.mockReturnValueOnce(
      selectEqMaybeSingle({
        id: "row-1",
        auth_user_id: CALLER_UID,
        email: EMAIL,
        display_name: "Devotee",
        role: "devotee",
        active: true,
      })
    );

    const res = await meHandler(authedRequest("/api/auth/me"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("devotee");
    expect(body.email).toBe(EMAIL);
    expect(body.emailVerified).toBe(true);
  });

  it("fails closed when the email conflict check errors", async () => {
    stubCaller();
    mockFrom.mockReturnValueOnce(selectEqMaybeSingle(null));
    mockFrom.mockReturnValueOnce(selectOrReturns(null, { message: "db down" }));

    const res = await meHandler(authedRequest("/api/auth/me"));

    expect(res.status).toBe(500);
  });
});

describe("S4 — 23505 race recovery never adopts a foreign row", () => {
  it("/api/auth/me returns 409 when the raced row belongs to another identity", async () => {
    stubCaller();
    mockFrom.mockReturnValueOnce(selectEqMaybeSingle(null));
    mockFrom.mockReturnValueOnce(selectOrReturns([]));
    mockFrom.mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
          }),
        }),
      }),
    });
    // Recheck finds a row that is NOT this caller's.
    mockFrom.mockReturnValueOnce(
      selectEqMaybeSingle({ id: "row-other", auth_user_id: "other-uid", email: EMAIL })
    );

    const res = await meHandler(authedRequest("/api/auth/me"));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/cannot be claimed automatically/i);
  });

  it("/api/auth/me returns the row when the race winner is this caller", async () => {
    stubCaller();
    mockFrom.mockReturnValueOnce(selectEqMaybeSingle(null));
    mockFrom.mockReturnValueOnce(selectOrReturns([]));
    mockFrom.mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
          }),
        }),
      }),
    });
    mockFrom.mockReturnValueOnce(
      selectEqMaybeSingle({
        id: "row-1",
        auth_user_id: CALLER_UID,
        email: EMAIL,
        display_name: "Devotee",
        role: "devotee",
        active: true,
      })
    );

    const res = await meHandler(authedRequest("/api/auth/me"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("devotee");
  });

  it("/api/auth/register returns 409 when the raced row is unlinked", async () => {
    stubCaller();
    stubIdentity("2026-01-01T00:00:00Z");
    mockFrom.mockReturnValueOnce(selectOrReturns([]));
    mockFrom.mockReturnValueOnce({
      insert: jest.fn().mockResolvedValue({
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      }),
    });
    mockFrom.mockReturnValueOnce(
      selectOrMaybeSingle({ id: "row-legacy", auth_user_id: null, email: EMAIL })
    );

    const res = await registerHandler(registerRequest());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/cannot be claimed automatically/i);
  });
});

describe("B3 — verified Supabase identity is required for provisioning", () => {
  const OTHER_UID = "44444444-4444-4444-4444-444444444444";

  it("rejects unauthenticated registration even with a valid UUID and email", async () => {
    const res = await registerHandler(unauthenticatedRegisterRequest());

    expect(res.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects a caller that supplies another user's UUID", async () => {
    stubCaller();

    const res = await registerHandler(
      registerRequest({ userId: OTHER_UID, email: EMAIL, name: "Attacker" })
    );

    expect(res.status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects an unverified register identity before any database read", async () => {
    stubCaller();
    stubIdentity(null);

    const res = await registerHandler(registerRequest());

    expect(res.status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects an unverified /api/auth/me caller before any database read", async () => {
    stubCaller(EMAIL, null);

    const res = await meHandler(authedRequest("/api/auth/me"));

    expect(res.status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects an unverified /api/auth/profile read before any database read", async () => {
    stubCaller(EMAIL, null);

    const res = await profileGetHandler(authedRequest("/api/auth/profile"));

    expect(res.status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects an unverified /api/auth/profile write before any database read", async () => {
    stubCaller(EMAIL, null);

    const res = await profileHandler(profilePostRequest());

    expect(res.status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects a confirmed identity that has no email address", async () => {
    stubCaller(null);
    stubIdentity("2026-01-01T00:00:00Z", null);

    const res = await registerHandler(registerRequest());

    expect(res.status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("does not let a request-body email override the verified address", async () => {
    stubCaller();

    const res = await registerHandler(
      registerRequest({ userId: CALLER_UID, email: "someone.else@example.test", name: "Attacker" })
    );

    expect(res.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("provisions a verified identity with the authenticated uid and email", async () => {
    stubCaller();
    stubIdentity("2026-01-01T00:00:00Z");
    mockFrom.mockReturnValueOnce(selectOrReturns([]));
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValueOnce({ insert });

    const res = await registerHandler(registerRequest());

    expect(res.status).toBe(200);
    expect(insert.mock.calls[0][0]).toMatchObject({
      auth_user_id: CALLER_UID,
      email: EMAIL,
      role: "devotee",
    });
  });

  it("remains idempotent for the same authenticated uid", async () => {
    stubCaller();
    stubIdentity("2026-01-01T00:00:00Z");
    mockFrom.mockReturnValueOnce(
      selectOrReturns([{ id: "row-1", auth_user_id: CALLER_UID, email: EMAIL, role: "devotee" }])
    );

    const res = await registerHandler(registerRequest());

    expect(res.status).toBe(200);
    expect((await res.json()).message).toMatch(/already provisioned/i);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("does not let a different uid claim an existing profile", async () => {
    stubCaller();
    stubIdentity("2026-01-01T00:00:00Z");
    mockFrom.mockReturnValueOnce(
      selectOrReturns([{ id: "row-other", auth_user_id: OTHER_UID, email: EMAIL }])
    );

    const res = await registerHandler(registerRequest());

    expect(res.status).toBe(409);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("does not touch the database when identity verification is unavailable", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("auth down"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await registerHandler(registerRequest());

    expect(res.status).toBe(503);
    expect(mockFrom).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("cookie-session verification failures never provision", () => {
  function cookieClient(getUser: jest.Mock) {
    mockServerCreateClient.mockResolvedValueOnce({ auth: { getUser } });
  }

  it("an invalid cookie session returns 401 and performs no DB read on /api/auth/me", async () => {
    cookieClient(
      jest.fn().mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Auth session missing!", name: "AuthSessionMissingError", status: 400 },
      })
    );

    const res = await meHandler(anonymousRequest("/api/auth/me"));

    expect(res.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("a cookie-session 5xx returns 503 and performs no DB read on /api/auth/me", async () => {
    cookieClient(
      jest.fn().mockResolvedValueOnce({
        data: { user: null },
        error: { message: "down", status: 503 },
      })
    );
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await meHandler(anonymousRequest("/api/auth/me"));

    expect(res.status).toBe(503);
    expect(mockFrom).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("a cookie-session verification exception returns 503 and performs no DB write on register", async () => {
    cookieClient(jest.fn().mockRejectedValueOnce(new Error("fetch failed")));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await registerHandler(unauthenticatedRegisterRequest());

    expect(res.status).toBe(503);
    expect(mockFrom).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("an invalid cookie session returns 401 and performs no DB write on register", async () => {
    cookieClient(
      jest.fn().mockResolvedValueOnce({
        data: { user: null },
        error: { message: "invalid JWT", status: 401 },
      })
    );

    const res = await registerHandler(unauthenticatedRegisterRequest());

    expect(res.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("a cookie-session 5xx returns 503 and performs no DB write on profile POST", async () => {
    cookieClient(
      jest.fn().mockResolvedValueOnce({
        data: { user: null },
        error: { message: "down", status: 503 },
      })
    );
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await profileHandler(
      anonymousRequest("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    );

    expect(res.status).toBe(503);
    expect(mockFrom).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("lib/auth/provisioning helpers", () => {
  const { findEmailConflicts, emailEqualsFilter, isUniqueViolation } = jest.requireActual(
    "@/lib/auth/provisioning"
  ) as typeof import("@/lib/auth/provisioning");

  function fakeClient(data: unknown[] | null, error: unknown = null) {
    const or = jest.fn().mockResolvedValue({ data, error });
    return { from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ or }) }) } as never;
  }

  it("treats a LIKE-widened match as no conflict after exact comparison", async () => {
    // `_` in the pattern could match any character in SQL; the exact compare rejects it.
    const client = fakeClient([{ id: "row-1", auth_user_id: null, email: "someoneelse@example.test" }]);

    const result = await findEmailConflicts(client, "devotee@example.test", CALLER_UID);

    expect(result).toEqual({ ok: true, conflicts: [] });
  });

  it("matches case-insensitively on the stored address", async () => {
    const client = fakeClient([{ id: "row-1", auth_user_id: null, email: "Devotee@Example.Test" }]);

    const result = await findEmailConflicts(client, "devotee@example.test", CALLER_UID);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.conflicts).toHaveLength(1);
  });

  it("ignores rows already owned by the caller", async () => {
    const client = fakeClient([
      { id: "row-1", auth_user_id: CALLER_UID, email: "devotee@example.test" },
    ]);

    const result = await findEmailConflicts(client, "devotee@example.test", CALLER_UID);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.conflicts).toHaveLength(0);
  });

  it("reports failure rather than 'no conflict' when the query errors", async () => {
    const client = fakeClient(null, { message: "boom" });

    await expect(findEmailConflicts(client, EMAIL, CALLER_UID)).resolves.toEqual({ ok: false });
  });

  it("quotes and escapes the email in the PostgREST filter", () => {
    expect(emailEqualsFilter(' a"b,c@example.test ')).toBe('email.ilike."a\\"b,c@example.test"');
  });

  it("recognises 23505 by code and by message", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ message: "duplicate key value violates unique constraint" })).toBe(true);
    expect(isUniqueViolation({ code: "23503", message: "foreign key" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe("/api/auth/profile applies the same invariants", () => {
  function profileRequest() {
    return new NextRequest("http://localhost/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: JSON.stringify({ email: EMAIL, name: "Devotee" }),
    });
  }

  it("refuses to create a second row for an address another row already holds", async () => {
    stubCaller();
    mockFrom.mockReturnValueOnce(selectEqMaybeSingle(null));
    mockFrom.mockReturnValueOnce(
      selectOrReturns([{ id: "row-other", auth_user_id: "other-uid", email: EMAIL }])
    );

    const res = await profileHandler(profileRequest());

    expect(res.status).toBe(409);
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it("refuses an unlinked row that holds the caller's address", async () => {
    // Same shape as the register S2 case: the row exists but was never linked to
    // any Auth identity, so binding it would be the prohibited email-based adoption.
    stubCaller();
    mockFrom.mockReturnValueOnce(selectEqMaybeSingle(null));
    mockFrom.mockReturnValueOnce(
      selectOrReturns([{ id: "row-1", auth_user_id: null, email: EMAIL }])
    );

    const res = await profileHandler(profileRequest());

    expect(res.status).toBe(409);
    // A refusal must never be followed by an insert.
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it("checks conflicts against the authenticated address, not the request body", async () => {
    // The body is client-controlled. If the conflict lookup used `payload.email`,
    // a caller could pass an address no row holds, skip the conflict check, and
    // still insert a row carrying a victim's address.
    stubCaller();
    mockFrom.mockReturnValueOnce(selectEqMaybeSingle(null));
    const conflictLookup = selectOrReturns([{ id: "row-1", auth_user_id: null, email: EMAIL }]);
    mockFrom.mockReturnValueOnce(conflictLookup);

    const res = await profileHandler(
      new NextRequest("http://localhost/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({ email: "someone.else@example.test", name: "Devotee" }),
      })
    );

    expect(res.status).toBe(409);
    const filter = (conflictLookup.select as jest.Mock).mock.results[0].value.or as jest.Mock;
    expect(filter.mock.calls[0][0]).toContain(EMAIL.toLowerCase());
  });

  it("stores the authenticated address rather than the client-supplied one", async () => {
    stubCaller();
    mockFrom.mockReturnValueOnce(selectEqMaybeSingle(null));
    mockFrom.mockReturnValueOnce(selectOrReturns([]));
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValueOnce({ insert });

    const res = await profileHandler(
      new NextRequest("http://localhost/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
        body: JSON.stringify({ email: "someone.else@example.test", name: "Devotee" }),
      })
    );

    expect(res.status).toBe(200);
    expect(insert.mock.calls[0][0].email).toBe(EMAIL);
  });
});
