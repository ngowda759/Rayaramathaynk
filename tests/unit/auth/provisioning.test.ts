/**
 * `provisionDevoteeRow` — the shared self-provisioning sequence (docs/auth/GOOGLE-SIGNIN.md §5, §8).
 *
 * These are the Phase 0 / PR 1 invariants restated for the OAuth path, which now calls the same helper
 * as GET /api/auth/me:
 *
 *  A — a row already carrying this `auth_user_id` is the caller's row; no write.
 *  B — no row at all: exactly one devotee row is created, with a server-chosen role.
 *  C — an unlinked row holding the same email is NOT claimed, and no duplicate is created.
 *  D — a row owned by a different `auth_user_id` is NOT returned.
 *  + — a 23505 race resolves only to a caller-owned row; ambiguity and DB errors fail closed.
 *  + — `id` is never used as an identity key.
 */

const mockFrom = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

import { provisionDevoteeRow } from "@/lib/auth/provisioning";

const UID = "8f1a2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b";
const EMAIL = "devotee@example.test";
const COLUMNS = "id, auth_user_id";

type Row = { id: string; auth_user_id: string | null; email?: string };

/** Column names used as an identity key by every lookup, so `id` can never sneak in. */
const identityColumns: unknown[] = [];

/** `.select(cols).eq("auth_user_id", uid).maybeSingle()` */
function ownRowQuery(data: Row | null, error: unknown = null) {
  const eq = jest.fn((column: unknown) => {
    identityColumns.push(column);
    return { maybeSingle: jest.fn().mockResolvedValue({ data, error }) };
  });
  return { select: jest.fn().mockReturnValue({ eq }) };
}

/** `.select(cols).or(...)` used by findEmailConflicts */
function emailQuery(data: Row[] | null, error: unknown = null) {
  return { select: jest.fn().mockReturnValue({ or: jest.fn().mockResolvedValue({ data, error }) }) };
}

/** `.insert(row).select(cols).single()` */
function insertQuery(data: Row | null, error: unknown = null) {
  return {
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data, error }) }),
    }),
  };
}

function provision() {
  return provisionDevoteeRow<Row>({ from: (...args: unknown[]) => mockFrom(...args) } as never, {
    uid: UID,
    email: EMAIL,
    displayName: "Devotee",
    columns: COLUMNS,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Case A — a row already linked to this auth_user_id", () => {
  it("returns it without writing", async () => {
    mockFrom.mockReturnValueOnce(ownRowQuery({ id: "row-1", auth_user_id: UID }));

    const outcome = await provision();

    expect(outcome).toEqual({ status: "linked", row: { id: "row-1", auth_user_id: UID } });
    // One read, no insert, no email query.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

describe("Case B — no existing row", () => {
  it("creates exactly one devotee row with a server-chosen role", async () => {
    mockFrom.mockReturnValueOnce(ownRowQuery(null));
    mockFrom.mockReturnValueOnce(emailQuery([]));
    const insert = insertQuery({ id: "row-new", auth_user_id: UID });
    mockFrom.mockReturnValueOnce(insert);

    const outcome = await provision();

    expect(outcome).toEqual({ status: "created", row: { id: "row-new", auth_user_id: UID } });
    const payload = insert.insert.mock.calls[0][0];
    expect(payload).toMatchObject({ role: "devotee", active: true, auth_user_id: UID, email: EMAIL });
    // No privileged field can be supplied by the caller of this helper.
    expect(payload).not.toHaveProperty("is_approved");
  });
});

describe("Case C — an unlinked row holding the same email", () => {
  it("refuses and writes nothing", async () => {
    mockFrom.mockReturnValueOnce(ownRowQuery(null));
    mockFrom.mockReturnValueOnce(
      emailQuery([{ id: "row-legacy", auth_user_id: null, email: EMAIL }])
    );

    const outcome = await provision();

    expect(outcome).toEqual({ status: "conflict" });
    // The read and the conflict check only: no insert was attempted.
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it("does not treat the legacy row as the caller's, even though its id could look like one", async () => {
    mockFrom.mockReturnValueOnce(ownRowQuery(null));
    mockFrom.mockReturnValueOnce(emailQuery([{ id: UID, auth_user_id: null, email: EMAIL }]));

    const outcome = await provision();

    expect(outcome).toEqual({ status: "conflict" });
  });
});

describe("Case D — a row owned by a different auth_user_id", () => {
  it("is never returned", async () => {
    mockFrom.mockReturnValueOnce(ownRowQuery(null));
    mockFrom.mockReturnValueOnce(
      emailQuery([{ id: "row-other", auth_user_id: "someone-else", email: EMAIL }])
    );

    const outcome = await provision();

    expect(outcome).toEqual({ status: "conflict" });
    expect(JSON.stringify(outcome)).not.toContain("row-other");
  });
});

describe("unique-violation race (23505)", () => {
  it("returns the caller's own row when it won the race", async () => {
    mockFrom.mockReturnValueOnce(ownRowQuery(null));
    mockFrom.mockReturnValueOnce(emailQuery([]));
    mockFrom.mockReturnValueOnce(insertQuery(null, { code: "23505", message: "duplicate key value" }));
    mockFrom.mockReturnValueOnce(ownRowQuery({ id: "row-winner", auth_user_id: UID }));

    const outcome = await provision();

    expect(outcome).toEqual({ status: "linked", row: { id: "row-winner", auth_user_id: UID } });
  });

  it("returns a conflict when the race winner is unlinked", async () => {
    mockFrom.mockReturnValueOnce(ownRowQuery(null));
    mockFrom.mockReturnValueOnce(emailQuery([]));
    mockFrom.mockReturnValueOnce(insertQuery(null, { code: "23505" }));
    mockFrom.mockReturnValueOnce(ownRowQuery(null));

    const outcome = await provision();

    expect(outcome).toEqual({ status: "conflict" });
  });

  it("fails closed when the race re-check errors", async () => {
    mockFrom.mockReturnValueOnce(ownRowQuery(null));
    mockFrom.mockReturnValueOnce(emailQuery([]));
    mockFrom.mockReturnValueOnce(insertQuery(null, { code: "23505" }));
    mockFrom.mockReturnValueOnce(ownRowQuery(null, { message: "db down" }));

    const outcome = await provision();

    expect(outcome).toEqual({ status: "error" });
  });
});

describe("fail-closed behaviour", () => {
  it("errors when the own-row read fails", async () => {
    mockFrom.mockReturnValueOnce(ownRowQuery(null, { message: "db down" }));

    await expect(provision()).resolves.toEqual({ status: "error" });
  });

  it("errors when the email conflict check fails", async () => {
    mockFrom.mockReturnValueOnce(ownRowQuery(null));
    mockFrom.mockReturnValueOnce(emailQuery(null, { message: "db down" }));

    await expect(provision()).resolves.toEqual({ status: "error" });
  });

  it("errors on a non-unique insert failure", async () => {
    mockFrom.mockReturnValueOnce(ownRowQuery(null));
    mockFrom.mockReturnValueOnce(emailQuery([]));
    mockFrom.mockReturnValueOnce(insertQuery(null, { code: "23503", message: "foreign key" }));

    await expect(provision()).resolves.toEqual({ status: "error" });
  });
});

describe("identity keys", () => {
  it("resolves the caller only by auth_user_id, never by id", async () => {
    identityColumns.length = 0;
    mockFrom.mockReturnValueOnce(ownRowQuery(null));
    mockFrom.mockReturnValueOnce(emailQuery([]));
    mockFrom.mockReturnValueOnce(insertQuery({ id: "row-new", auth_user_id: UID }));

    await provision();

    expect(identityColumns).toEqual(["auth_user_id"]);
  });
});
