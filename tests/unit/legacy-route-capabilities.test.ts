/**
 * @jest-environment node
 *
 * F-05: the legacy admin aliases enforce the F-04 capability policy.
 *
 * These routes (`/api/donations/[id]`, `/api/bookings/[id]`, `/api/temple-areas`)
 * previously used the coarse `requireAdminUser` guard, which admitted every admin
 * console role. They now call `requireAdminCapability` with the capability that
 * matches each operation, so the same role matrix as `/api/admin/**` applies.
 *
 * The identity verifier is stubbed; the real capability map runs underneath.
 * `/api/bookings/[id]` keeps its devotee self-service branch for GET (owner read)
 * and PATCH (owner payment declaration); those paths are covered too.
 */

jest.mock("server-only", () => ({}), { virtual: true });

import { NextRequest } from "next/server";

const mockVerifyAdminUserResult = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => {
  const actual = jest.requireActual("@/lib/auth/admin-auth");
  return {
    ...actual,
    verifyAdminUserResult: (...args: unknown[]) => mockVerifyAdminUserResult(...args),
  };
});

const mockVerifyBearerIdToken = jest.fn();
jest.mock("@/lib/auth/verify-id-token", () => ({
  verifyBearerIdToken: (...args: unknown[]) => mockVerifyBearerIdToken(...args),
}));

jest.mock("@/lib/api/public-rate-limit", () => ({
  allowPublicWrite: () => true,
}));

const mockGetDonationById = jest.fn();
const mockUpdateDonation = jest.fn();
const mockUpdateDonationStatus = jest.fn();
const mockDeleteDonation = jest.fn();
jest.mock("@/services/donation.server", () => ({
  donationService: {
    getDonationById: (...args: unknown[]) => mockGetDonationById(...args),
    updateDonation: (...args: unknown[]) => mockUpdateDonation(...args),
    updateDonationStatus: (...args: unknown[]) => mockUpdateDonationStatus(...args),
    deleteDonation: (...args: unknown[]) => mockDeleteDonation(...args),
  },
}));

const mockGetBookingById = jest.fn();
const mockUpdateBookingStatus = jest.fn();
const mockUpdatePayment = jest.fn();
const mockRecordPaymentClaim = jest.fn();
const mockDeleteBooking = jest.fn();
jest.mock("@/services/sevaBooking.server", () => ({
  sevaBookingService: {
    getBookingById: (...args: unknown[]) => mockGetBookingById(...args),
    updateBookingStatus: (...args: unknown[]) => mockUpdateBookingStatus(...args),
    updatePayment: (...args: unknown[]) => mockUpdatePayment(...args),
    recordPaymentClaim: (...args: unknown[]) => mockRecordPaymentClaim(...args),
    deleteBooking: (...args: unknown[]) => mockDeleteBooking(...args),
  },
}));

const mockGetPublicAreas = jest.fn();
const mockAddArea = jest.fn();
const mockUpdateArea = jest.fn();
const mockDeleteArea = jest.fn();
jest.mock("@/services/temple-areas.service", () => ({
  templeAreasService: {
    getPublicAreas: (...args: unknown[]) => mockGetPublicAreas(...args),
    addArea: (...args: unknown[]) => mockAddArea(...args),
    updateArea: (...args: unknown[]) => mockUpdateArea(...args),
    deleteArea: (...args: unknown[]) => mockDeleteArea(...args),
  },
}));

import {
  GET as donationGet,
  PATCH as donationPatch,
  DELETE as donationDelete,
} from "@/app/api/donations/[id]/route";
import {
  GET as bookingGet,
  PATCH as bookingPatch,
  DELETE as bookingDelete,
} from "@/app/api/bookings/[id]/route";
import { GET as areasList, POST as areasPost } from "@/app/api/temple-areas/route";
import { PUT as areaPut, DELETE as areaDelete } from "@/app/api/temple-areas/[id]/route";

function signedIn(role: string) {
  mockVerifyAdminUserResult.mockResolvedValue({
    ok: true,
    provider: "supabase",
    user: { uid: `uid-${role}`, email: `${role}@example.com`, role, provider: "supabase" },
  });
}

function notSignedIn(status: 401 | 403 = 401) {
  mockVerifyAdminUserResult.mockResolvedValue({
    ok: false,
    reason: status === 401 ? "missing_token" : "insufficient_role",
    status,
    message: "not authorized",
  });
}

function devotee(uid: string | null) {
  mockVerifyBearerIdToken.mockResolvedValue(uid ? { uid } : null);
}

function params(id = "x"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function request(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDonationById.mockResolvedValue({ id: "d1" });
  mockGetBookingById.mockResolvedValue({ id: "b1", userId: "dev-1" });
  mockGetPublicAreas.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Donations: read / update / super-admin-only delete
// ---------------------------------------------------------------------------

describe("GET /api/donations/[id] requires donations.read", () => {
  test.each(["super_admin", "temple_admin", "admin", "billing", "priest", "staff"])(
    "%s may read",
    async (role) => {
      signedIn(role);
      const response = await donationGet(request("/api/donations/d1", "GET"), params("d1"));
      expect(response.status).toBe(200);
      expect(mockGetDonationById).toHaveBeenCalledWith("d1");
    },
  );

  test("office_staff is refused", async () => {
    signedIn("office_staff");
    const response = await donationGet(request("/api/donations/d1", "GET"), params("d1"));
    expect(response.status).toBe(403);
    expect(mockGetDonationById).not.toHaveBeenCalled();
  });

  test("an anonymous caller is refused", async () => {
    notSignedIn(401);
    const response = await donationGet(request("/api/donations/d1", "GET"), params("d1"));
    expect(response.status).toBe(401);
    expect(mockGetDonationById).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/donations/[id] requires donations.update", () => {
  test.each(["super_admin", "temple_admin", "admin"])("%s may update", async (role) => {
    signedIn(role);
    const response = await donationPatch(
      request("/api/donations/d1", "PATCH", { adminRemarks: "verified" }),
      params("d1"),
    );
    expect(response.status).toBe(200);
    expect(mockUpdateDonation).toHaveBeenCalledWith(
      "d1",
      expect.objectContaining({ adminRemarks: "verified" }),
    );
  });

  test.each(["billing", "priest", "staff", "office_staff"])("%s is refused", async (role) => {
    signedIn(role);
    const response = await donationPatch(
      request("/api/donations/d1", "PATCH", { adminRemarks: "verified" }),
      params("d1"),
    );
    expect(response.status).toBe(403);
    expect(mockUpdateDonation).not.toHaveBeenCalled();
    expect(mockUpdateDonationStatus).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/donations/[id] requires donations.delete (super admin only)", () => {
  test("super_admin may delete", async () => {
    signedIn("super_admin");
    const response = await donationDelete(request("/api/donations/d1", "DELETE"), params("d1"));
    expect(response.status).toBe(200);
    expect(mockDeleteDonation).toHaveBeenCalledWith("d1");
  });

  test.each(["temple_admin", "admin", "billing", "priest", "staff", "office_staff"])(
    "%s is refused",
    async (role) => {
      signedIn(role);
      const response = await donationDelete(request("/api/donations/d1", "DELETE"), params("d1"));
      expect(response.status).toBe(403);
      expect(mockDeleteDonation).not.toHaveBeenCalled();
    },
  );
});

// ---------------------------------------------------------------------------
// Bookings: capability-gated admin branch, devotee branch preserved
// ---------------------------------------------------------------------------

describe("bookings admin branch", () => {
  describe("GET requires bookings.read", () => {
    test.each(["super_admin", "temple_admin", "admin", "priest", "staff"])(
      "%s may read",
      async (role) => {
        signedIn(role);
        devotee(null);
        const response = await bookingGet(request("/api/bookings/b1", "GET"), params("b1"));
        expect(response.status).toBe(200);
      },
    );

    test.each(["billing", "office_staff"])("%s is refused", async (role) => {
      signedIn(role);
      devotee(null);
      const response = await bookingGet(request("/api/bookings/b1", "GET"), params("b1"));
      expect(response.status).toBe(403);
    });
  });

  describe("PATCH requires bookings.update", () => {
    test.each(["super_admin", "temple_admin", "admin"])("%s may update", async (role) => {
      signedIn(role);
      const response = await bookingPatch(
        request("/api/bookings/b1", "PATCH", { status: "confirmed" }),
        params("b1"),
      );
      expect(response.status).toBe(200);
      expect(mockUpdateBookingStatus).toHaveBeenCalledWith("b1", "confirmed");
    });

    test.each(["billing", "priest", "staff", "office_staff"])(
      "%s cannot use the admin update path",
      async (role) => {
        signedIn(role);
        devotee(null);
        const response = await bookingPatch(
          request("/api/bookings/b1", "PATCH", { status: "confirmed" }),
          params("b1"),
        );
        expect(response.status).toBe(403);
        expect(mockUpdateBookingStatus).not.toHaveBeenCalled();
      },
    );
  });

  describe("DELETE requires bookings.delete (super admin only)", () => {
    test("super_admin may delete", async () => {
      signedIn("super_admin");
      const response = await bookingDelete(request("/api/bookings/b1", "DELETE"), params("b1"));
      expect(response.status).toBe(200);
      expect(mockDeleteBooking).toHaveBeenCalledWith("b1");
    });

    test.each(["temple_admin", "admin", "billing", "priest", "staff", "office_staff"])(
      "%s is refused",
      async (role) => {
        signedIn(role);
        const response = await bookingDelete(request("/api/bookings/b1", "DELETE"), params("b1"));
        expect(response.status).toBe(403);
        expect(mockDeleteBooking).not.toHaveBeenCalled();
      },
    );
  });
});

describe("bookings devotee branch", () => {
  test("the owner may read their booking", async () => {
    notSignedIn(403);
    devotee("dev-1");
    const response = await bookingGet(request("/api/bookings/b1", "GET"), params("b1"));
    expect(response.status).toBe(200);
  });

  test("another devotee cannot read the booking", async () => {
    notSignedIn(403);
    devotee("dev-2");
    const response = await bookingGet(request("/api/bookings/b1", "GET"), params("b1"));
    expect(response.status).toBe(403);
  });

  test("an anonymous caller is refused", async () => {
    notSignedIn(401);
    devotee(null);
    const response = await bookingGet(request("/api/bookings/b1", "GET"), params("b1"));
    expect(response.status).toBe(401);
  });

  test("the owner may declare a payment reference; it stays pending verification", async () => {
    notSignedIn(403);
    devotee("dev-1");
    const response = await bookingPatch(
      request("/api/bookings/b1", "PATCH", {
        payment: { paymentReference: "REF-1", paymentMethod: "UPI", paymentStatus: "completed" },
      }),
      params("b1"),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).paymentStatus).toBe("pending");
    expect(mockRecordPaymentClaim).toHaveBeenCalledWith("b1", {
      paymentReference: "REF-1",
      paymentMethod: "UPI",
    });
    expect(mockUpdatePayment).not.toHaveBeenCalled();
    expect(mockUpdateBookingStatus).not.toHaveBeenCalled();
  });

  test("another devotee cannot declare a payment for the booking", async () => {
    notSignedIn(403);
    devotee("dev-2");
    const response = await bookingPatch(
      request("/api/bookings/b1", "PATCH", { payment: { paymentReference: "REF-2" } }),
      params("b1"),
    );
    expect(response.status).toBe(403);
    expect(mockRecordPaymentClaim).not.toHaveBeenCalled();
  });

  test("a devotee cannot set a booking status", async () => {
    notSignedIn(403);
    devotee("dev-1");
    const response = await bookingPatch(
      request("/api/bookings/b1", "PATCH", { status: "completed" }),
      params("b1"),
    );
    expect(response.status).toBe(400);
    expect(mockUpdateBookingStatus).not.toHaveBeenCalled();
    expect(mockRecordPaymentClaim).not.toHaveBeenCalled();
  });

  test("an anonymous caller cannot declare a payment", async () => {
    notSignedIn(401);
    devotee(null);
    const response = await bookingPatch(
      request("/api/bookings/b1", "PATCH", { payment: { paymentReference: "REF-3" } }),
      params("b1"),
    );
    expect(response.status).toBe(401);
    expect(mockRecordPaymentClaim).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Temple areas: read stays public; writes and deletes are capability-gated
// ---------------------------------------------------------------------------

describe("temple areas", () => {
  test("GET stays public and never consults the guard", async () => {
    const response = await areasList();
    expect(response.status).toBe(200);
    expect(mockGetPublicAreas).toHaveBeenCalled();
    expect(mockVerifyAdminUserResult).not.toHaveBeenCalled();
  });

  describe("POST requires temple_areas.write", () => {
    test.each(["super_admin", "temple_admin", "admin"])("%s may create", async (role) => {
      signedIn(role);
      const response = await areasPost(
        request("/api/temple-areas", "POST", { name: "Main Hall", category: "hall" }),
      );
      expect(response.status).toBe(201);
      expect(mockAddArea).toHaveBeenCalledWith({ name: "Main Hall", category: "hall" });
    });

    test.each(["billing", "priest", "staff", "office_staff"])("%s is refused", async (role) => {
      signedIn(role);
      const response = await areasPost(
        request("/api/temple-areas", "POST", { name: "Main Hall", category: "hall" }),
      );
      expect(response.status).toBe(403);
      expect(mockAddArea).not.toHaveBeenCalled();
    });

    test("an anonymous caller is refused", async () => {
      notSignedIn(401);
      const response = await areasPost(
        request("/api/temple-areas", "POST", { name: "Main Hall", category: "hall" }),
      );
      expect(response.status).toBe(401);
      expect(mockAddArea).not.toHaveBeenCalled();
    });
  });

  describe("PUT requires temple_areas.write", () => {
    test.each(["super_admin", "temple_admin", "admin"])("%s may update", async (role) => {
      signedIn(role);
      const response = await areaPut(
        request("/api/temple-areas/t1", "PUT", { name: "Renamed" }),
        params("t1"),
      );
      expect(response.status).toBe(200);
      expect(mockUpdateArea).toHaveBeenCalledWith("t1", { name: "Renamed" });
    });

    test.each(["billing", "priest", "staff", "office_staff"])("%s is refused", async (role) => {
      signedIn(role);
      const response = await areaPut(
        request("/api/temple-areas/t1", "PUT", { name: "Renamed" }),
        params("t1"),
      );
      expect(response.status).toBe(403);
      expect(mockUpdateArea).not.toHaveBeenCalled();
    });
  });

  describe("DELETE requires temple_areas.delete (super admin only)", () => {
    test("super_admin may delete", async () => {
      signedIn("super_admin");
      const response = await areaDelete(request("/api/temple-areas/t1", "DELETE"), params("t1"));
      expect(response.status).toBe(200);
      expect(mockDeleteArea).toHaveBeenCalledWith("t1");
    });

    test.each(["temple_admin", "admin", "billing", "priest", "staff", "office_staff"])(
      "%s is refused",
      async (role) => {
        signedIn(role);
        const response = await areaDelete(request("/api/temple-areas/t1", "DELETE"), params("t1"));
        expect(response.status).toBe(403);
        expect(mockDeleteArea).not.toHaveBeenCalled();
      },
    );
  });
});
