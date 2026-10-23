/**
 * @jest-environment node
 *
 * Route tests for the Guru Parampara settings API.
 *
 * These pin the contract the admin page relies on to avoid the missing-data
 * overwrite: GET returns the document's `revision`, PUT requires it back, and a
 * save that would create the row (revision `absent`) is refused with 409 rather
 * than written. The service is stubbed so the test asserts the *route's* wiring,
 * not a database.
 */

import { NextRequest } from "next/server";

jest.mock("server-only", () => ({}), { virtual: true });

const mockRequireAdminUser = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => ({
  requireAdminUser: (...args: unknown[]) => mockRequireAdminUser(...args),
}));

const mockGetWithRevision = jest.fn();
const mockSave = jest.fn();

jest.mock("@/services/guru-parampara.service", () => {
  const actual = jest.requireActual("@/services/guru-parampara.service");
  return {
    ...actual,
    guruParamparaService: {
      getWithRevision: (...args: unknown[]) => mockGetWithRevision(...args),
      save: (...args: unknown[]) => mockSave(...args),
    },
  };
});

import { GET, PUT } from "@/app/api/admin/settings/guru-parampara/route";
import {
  ABSENT_REVISION,
  computeRevision,
  GuruParamparaConflictError,
} from "@/services/guru-parampara.service";

const validPayload = {
  heading: "Guru Parampara",
  headingKannada: "ಗುರು ಪರಂಪರೆ",
  subheading: "The sacred lineage",
  subheadingKannada: "ವಂಶಾವಳಿ",
  gurus: [
    { id: "1", number: "01", name: "Madwacharyaru", kannada: "ಮಧ್ವಾಚಾರ್ಯರು", description: "d" },
  ],
};
const revision = computeRevision(validPayload);

function request(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/settings/guru-parampara", {
    method: body === undefined ? "GET" : "PUT",
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
  });
}

beforeEach(() => {
  mockRequireAdminUser.mockReset();
  mockGetWithRevision.mockReset();
  mockSave.mockReset();
  mockRequireAdminUser.mockResolvedValue({ ok: true, user: { uid: "u1", email: "a@b.c" } });
});

describe("GET", () => {
  it("returns the data and its revision", async () => {
    mockGetWithRevision.mockResolvedValue({ data: validPayload, revision });

    const response = await GET(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: validPayload,
      revision,
    });
  });

  it("returns a null document with the absent revision, not a 404", async () => {
    // The page needs to tell "nothing migrated yet" from "read failed"; a null
    // body plus the absent revision is that signal.
    mockGetWithRevision.mockResolvedValue({ data: null, revision: ABSENT_REVISION });

    const response = await GET(request());
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: null,
      revision: ABSENT_REVISION,
    });
  });

  it("rejects an unauthenticated caller before reading", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: false,
      response: new Response("nope", { status: 401 }),
    });
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mockGetWithRevision).not.toHaveBeenCalled();
  });
});

describe("PUT", () => {
  it("passes the caller's revision to the service and echoes the new one", async () => {
    mockSave.mockResolvedValue(validPayload);

    const response = await PUT(request({ expectedRevision: revision, data: validPayload }));

    expect(response.status).toBe(200);
    expect(mockSave).toHaveBeenCalledWith(validPayload, { expectedRevision: revision });
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: validPayload,
      revision,
    });
  });

  it("maps a conflict (stale revision or would-create) to 409, not 500", async () => {
    mockSave.mockRejectedValue(new GuruParamparaConflictError("changed since it was read"));

    const response = await PUT(request({ expectedRevision: revision, data: validPayload }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ success: false });
  });

  it("sends an empty revision when the caller omits it, so the service refuses", async () => {
    mockSave.mockRejectedValue(new GuruParamparaConflictError("no revision"));

    await PUT(request({ data: validPayload }));
    expect(mockSave).toHaveBeenCalledWith(validPayload, { expectedRevision: "" });
  });

  it("rejects a non-object body before calling the service", async () => {
    const response = await PUT(request("just a string"));
    expect(response.status).toBe(400);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("never forwards an allowCreate flag from the request body", async () => {
    // Creating the row is owner-gated; an admin must not be able to opt in per call.
    mockSave.mockResolvedValue(validPayload);
    await PUT(
      request({ expectedRevision: ABSENT_REVISION, data: validPayload, allowCreate: true }),
    );
    expect(mockSave).toHaveBeenCalledWith(validPayload, { expectedRevision: ABSENT_REVISION });
  });
});
