/**
 * @jest-environment node
 *
 * F-A14 — public API security regression tests.
 *
 * Covers the write endpoints outside `/api/admin/`:
 *   /api/events, /api/donations, /api/bookings, /api/testimonials, /api/profile/*
 *
 * Two layers, mirroring the F-A13 admin census:
 *
 *  1. A static census over the in-scope route files. Every exported HTTP method
 *     must be either guarded (an admin guard or a verified-token check) or a
 *     documented public read; every public write must be body-validated and
 *     rate-limited. This is the part that cannot silently regress when a new
 *     method is added.
 *
 *  2. Behavioural checks: anonymous access, authenticated user, admin
 *     authorization, cross-user ownership, invalid payloads, mass assignment,
 *     rate limiting, and the legitimate public read/submission paths.
 *
 * The auth guards and services are stubbed so the assertions target the route
 * wiring, not Firebase/Supabase.
 */
import fs from "fs";
import path from "path";

import { NextRequest } from "next/server";

jest.mock("server-only", () => ({}), { virtual: true });

const mockRequireAdminUser = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => ({
  requireAdminUser: (...args: unknown[]) => mockRequireAdminUser(...args),
}));

const mockVerifyBearerIdToken = jest.fn();
jest.mock("@/lib/auth/verify-id-token", () => ({
  verifyBearerIdToken: (...args: unknown[]) => mockVerifyBearerIdToken(...args),
}));

const mockGetPublishedEvents = jest.fn();
const mockGetPublishedEvent = jest.fn();
const mockGetEvent = jest.fn();
const mockAddEvent = jest.fn();
const mockUpdateEvent = jest.fn();
const mockDeleteEvent = jest.fn();
jest.mock("@/services/event.service", () => ({
  eventService: {
    getPublishedEvents: (...a: unknown[]) => mockGetPublishedEvents(...a),
    getPublishedEvent: (...a: unknown[]) => mockGetPublishedEvent(...a),
    getEvent: (...a: unknown[]) => mockGetEvent(...a),
    addEvent: (...a: unknown[]) => mockAddEvent(...a),
    updateEvent: (...a: unknown[]) => mockUpdateEvent(...a),
    deleteEvent: (...a: unknown[]) => mockDeleteEvent(...a),
  },
}));

const mockCreateDonation = jest.fn();
const mockGetDonationById = jest.fn();
const mockUpdateDonation = jest.fn();
const mockDeleteDonation = jest.fn();
jest.mock("@/services/donation.server", () => ({
  donationService: {
    createDonation: (...a: unknown[]) => mockCreateDonation(...a),
    getDonationById: (...a: unknown[]) => mockGetDonationById(...a),
    updateDonation: (...a: unknown[]) => mockUpdateDonation(...a),
    deleteDonation: (...a: unknown[]) => mockDeleteDonation(...a),
  },
}));

const mockCreateBooking = jest.fn();
const mockGetBookingsByUser = jest.fn();
const mockGetBookingById = jest.fn();
const mockUpdateBookingStatus = jest.fn();
const mockUpdatePayment = jest.fn();
const mockRecordPaymentClaim = jest.fn();
const mockDeleteBooking = jest.fn();
jest.mock("@/services/sevaBooking.server", () => ({
  SevaBookingError: class SevaBookingError extends Error {},
  sevaBookingService: {
    createBooking: (...a: unknown[]) => mockCreateBooking(...a),
    getBookingsByUser: (...a: unknown[]) => mockGetBookingsByUser(...a),
    getBookingById: (...a: unknown[]) => mockGetBookingById(...a),
    updateBookingStatus: (...a: unknown[]) => mockUpdateBookingStatus(...a),
    updatePayment: (...a: unknown[]) => mockUpdatePayment(...a),
    recordPaymentClaim: (...a: unknown[]) => mockRecordPaymentClaim(...a),
    deleteBooking: (...a: unknown[]) => mockDeleteBooking(...a),
  },
}));

const mockSubmitAiTestimonial = jest.fn();
const mockGetApprovedAiTestimonials = jest.fn();
jest.mock("@/services/chat.server", () => ({
  submitTestimonial: (...a: unknown[]) => mockSubmitAiTestimonial(...a),
  getApprovedTestimonials: (...a: unknown[]) => mockGetApprovedAiTestimonials(...a),
}));

const mockCreateTestimonial = jest.fn();
const mockGetApprovedDevoteeTestimonials = jest.fn();
jest.mock("@/services/testimonial.server", () => ({
  createTestimonial: (...a: unknown[]) => mockCreateTestimonial(...a),
  getApprovedTestimonials: (...a: unknown[]) => mockGetApprovedDevoteeTestimonials(...a),
}));

const mockGetProfile = jest.fn();
const mockSaveProfile = jest.fn();
const mockUpdateProfile = jest.fn();
const mockUpdatePreferences = jest.fn();
const mockUploadProfileImage = jest.fn();
const mockDeleteProfileImage = jest.fn();
const mockAddFavorite = jest.fn();
const mockRemoveFavorite = jest.fn();
const mockAddRecentlyViewed = jest.fn();
const mockAddBookmark = jest.fn();
const mockRemoveBookmark = jest.fn();
const mockGetBookmarks = jest.fn();
jest.mock("@/services/profile.server", () => ({
  profileService: {
    getProfile: (...a: unknown[]) => mockGetProfile(...a),
    saveProfile: (...a: unknown[]) => mockSaveProfile(...a),
    updateProfile: (...a: unknown[]) => mockUpdateProfile(...a),
    updatePreferences: (...a: unknown[]) => mockUpdatePreferences(...a),
    uploadProfileImage: (...a: unknown[]) => mockUploadProfileImage(...a),
    deleteProfileImage: (...a: unknown[]) => mockDeleteProfileImage(...a),
    addFavorite: (...a: unknown[]) => mockAddFavorite(...a),
    removeFavorite: (...a: unknown[]) => mockRemoveFavorite(...a),
    addRecentlyViewed: (...a: unknown[]) => mockAddRecentlyViewed(...a),
    addBookmark: (...a: unknown[]) => mockAddBookmark(...a),
    removeBookmark: (...a: unknown[]) => mockRemoveBookmark(...a),
    getBookmarks: (...a: unknown[]) => mockGetBookmarks(...a),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let ipSeq = 0;
/** A unique client IP per call, so rate-limit buckets never bleed between tests. */
const uniqueIp = () => `f-a14-${++ipSeq}`;

const params = (id: string) => ({ params: Promise.resolve({ id }) });

interface RequestOptions {
  method?: string;
  body?: unknown;
  ip?: string;
  token?: string;
}

function request(url: string, options: RequestOptions = {}): NextRequest {
  const headers: Record<string, string> = { "x-forwarded-for": options.ip ?? uniqueIp() };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  let body: string | undefined;
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }
  return new NextRequest(new URL(url, "http://localhost"), {
    method: options.method ?? "GET",
    headers,
    body,
  });
}

const adminOk = (uid = "admin-1") => ({ ok: true, user: { uid, email: "a@e.org", role: "admin" } });
const adminDenied = (status = 401) => ({
  ok: false,
  response: new Response(JSON.stringify({ error: "unauthenticated" }), { status }) as never,
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: nobody is authenticated. Individual tests opt in.
  mockRequireAdminUser.mockResolvedValue(adminDenied(401));
  mockVerifyBearerIdToken.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// Layer 1: static census
// ---------------------------------------------------------------------------

const IN_SCOPE_FILES = [
  "app/api/events/route.ts",
  "app/api/events/[id]/route.ts",
  "app/api/donations/route.ts",
  "app/api/donations/[id]/route.ts",
  "app/api/bookings/route.ts",
  "app/api/bookings/[id]/route.ts",
  "app/api/testimonials/route.ts",
  "app/api/testimonials/devotee/route.ts",
  "app/api/profile/route.ts",
  "app/api/profile/bookmarks/route.ts",
  "app/api/profile/favorites/route.ts",
  "app/api/profile/image/route.ts",
  "app/api/profile/preferences/route.ts",
  "app/api/profile/recently-viewed/route.ts",
];

/** Public read handlers that intentionally carry no caller identity. */
const PUBLIC_READ_EXCEPTIONS = new Set([
  "app/api/events/route.ts GET",
  "app/api/events/[id]/route.ts GET",
  "app/api/testimonials/route.ts GET",
  "app/api/testimonials/devotee/route.ts GET",
]);

const AUTH_GUARDS = ["requireAdminUser", "verifyBearerIdToken", "callerUid"];

/** Methods whose request carries a body that must be validated. */
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

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

describe("F-A14: public API static census", () => {
  it("enumerates the in-scope route files", () => {
    for (const file of IN_SCOPE_FILES) {
      expect(fs.existsSync(path.join(process.cwd(), file))).toBe(true);
    }
  });

  it("every handler is guarded or a documented public read, and every write is validated + rate-limited", () => {
    const violations: string[] = [];
    const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

    for (const file of IN_SCOPE_FILES) {
      const bodies = methodBodies(fs.readFileSync(path.join(process.cwd(), file), "utf8"));
      for (const [method, body] of Object.entries(bodies)) {
        const key = `${file} ${method}`;
        const guarded = AUTH_GUARDS.some((g) => body.includes(g));
        const publicWrite = body.includes("allowPublicWrite");

        if (!guarded && !publicWrite && !PUBLIC_READ_EXCEPTIONS.has(key)) {
          violations.push(`${key}: no auth guard and not a documented public read`);
        }
        // Every mutating handler (public or admin) must be rate-limited.
        if (!READ_METHODS.has(method) && !publicWrite) {
          violations.push(`${key}: write is not rate-limited`);
        }
        if (publicWrite && BODY_METHODS.has(method)) {
          const validated = body.includes("parseJsonBody") || body.includes("formData");
          if (!validated) violations.push(`${key}: public write is not body-validated`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("no in-scope route imports Firestore or the admin Firebase SDK directly", () => {
    const offenders: string[] = [];
    for (const file of IN_SCOPE_FILES) {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      if (/firebase\/firestore|firebase-admin|@\/lib\/admin-firebase/.test(source)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// /api/events
// ---------------------------------------------------------------------------

describe("F-A14: /api/events", () => {
  it("GET returns only published events (public read)", async () => {
    mockGetPublishedEvents.mockResolvedValue([{ id: "e1", published: true }]);
    const { GET } = await import("@/app/api/events/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "e1", published: true }]);
  });

  it("POST rejects an anonymous caller with 401 before touching the service", async () => {
    mockRequireAdminUser.mockResolvedValue(adminDenied(401));
    const { POST } = await import("@/app/api/events/route");
    const res = await POST(request("/api/events", { method: "POST", body: { title: "X", date: "2027-01-01" } }));
    expect(res.status).toBe(401);
    expect(mockAddEvent).not.toHaveBeenCalled();
  });

  it("POST rejects an authenticated non-admin with 403", async () => {
    mockRequireAdminUser.mockResolvedValue(adminDenied(403));
    const { POST } = await import("@/app/api/events/route");
    const res = await POST(request("/api/events", { method: "POST", body: { title: "X", date: "2027-01-01" } }));
    expect(res.status).toBe(403);
    expect(mockAddEvent).not.toHaveBeenCalled();
  });

  it("POST as admin rejects an invalid payload with 400", async () => {
    mockRequireAdminUser.mockResolvedValue(adminOk());
    const { POST } = await import("@/app/api/events/route");
    const res = await POST(request("/api/events", { method: "POST", body: { title: "" } }));
    expect(res.status).toBe(400);
    expect(mockAddEvent).not.toHaveBeenCalled();
  });

  it("POST as admin creates an event", async () => {
    mockRequireAdminUser.mockResolvedValue(adminOk());
    mockAddEvent.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/events/route");
    const res = await POST(
      request("/api/events", { method: "POST", body: { title: "Aaradhane", startDate: "2027-08-15", endDate: "2027-08-17" } })
    );
    expect(res.status).toBe(201);
    expect(mockAddEvent).toHaveBeenCalledTimes(1);
  });

  it("[id] GET returns 404 for an unpublished event", async () => {
    mockGetPublishedEvent.mockResolvedValue(null);
    const { GET } = await import("@/app/api/events/[id]/route");
    const res = await GET(request("/api/events/e1"), params("e1"));
    expect(res.status).toBe(404);
  });

  it("[id] PATCH and DELETE reject an anonymous caller", async () => {
    mockRequireAdminUser.mockResolvedValue(adminDenied(401));
    const mod = await import("@/app/api/events/[id]/route");
    expect((await mod.PATCH(request("/api/events/e1", { method: "PATCH", body: { title: "X" } }), params("e1"))).status).toBe(401);
    expect((await mod.DELETE(request("/api/events/e1", { method: "DELETE" }), params("e1"))).status).toBe(401);
    expect(mockUpdateEvent).not.toHaveBeenCalled();
    expect(mockDeleteEvent).not.toHaveBeenCalled();
  });

  it("[id] PATCH as admin updates the event", async () => {
    mockRequireAdminUser.mockResolvedValue(adminOk());
    mockUpdateEvent.mockResolvedValue({ id: "e1" });
    const { PATCH } = await import("@/app/api/events/[id]/route");
    const res = await PATCH(request("/api/events/e1", { method: "PATCH", body: { title: "Updated" } }), params("e1"));
    expect(res.status).toBe(200);
    expect(mockUpdateEvent).toHaveBeenCalledWith("e1", expect.objectContaining({ title: "Updated" }));
  });
});

// ---------------------------------------------------------------------------
// /api/donations
// ---------------------------------------------------------------------------

describe("F-A14: /api/donations", () => {
  it("POST records a valid public donation", async () => {
    mockCreateDonation.mockResolvedValue("d1");
    const { POST } = await import("@/app/api/donations/route");
    const res = await POST(
      request("/api/donations", { method: "POST", body: { donorName: "Rama", amount: 501, paymentMode: "upi" } })
    );
    expect(res.status).toBe(201);
    expect(mockCreateDonation).toHaveBeenCalledTimes(1);
  });

  it("POST rejects a missing/negative amount with 400", async () => {
    const { POST } = await import("@/app/api/donations/route");
    expect((await POST(request("/api/donations", { method: "POST", body: { donorName: "Rama", amount: -5 } }))).status).toBe(400);
    expect((await POST(request("/api/donations", { method: "POST", body: { donorName: "Rama" } }))).status).toBe(400);
    expect(mockCreateDonation).not.toHaveBeenCalled();
  });

  it("POST does not let a caller set privileged fields (mass assignment)", async () => {
    mockCreateDonation.mockResolvedValue("d2");
    const { POST } = await import("@/app/api/donations/route");
    await POST(
      request("/api/donations", {
        method: "POST",
        body: { donorName: "Rama", amount: 100, status: "received", receiptNumber: "REC-1", collectedBy: "me" },
      })
    );
    const payload = mockCreateDonation.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("receiptNumber");
    expect(payload).not.toHaveProperty("collectedBy");
  });

  it("[id] GET/PATCH/DELETE reject an anonymous caller", async () => {
    mockRequireAdminUser.mockResolvedValue(adminDenied(401));
    const mod = await import("@/app/api/donations/[id]/route");
    expect((await mod.GET(request("/api/donations/d1"), params("d1"))).status).toBe(401);
    expect((await mod.PATCH(request("/api/donations/d1", { method: "PATCH", body: { status: "received" } }), params("d1"))).status).toBe(401);
    expect((await mod.DELETE(request("/api/donations/d1", { method: "DELETE" }), params("d1"))).status).toBe(401);
    expect(mockGetDonationById).not.toHaveBeenCalled();
    expect(mockDeleteDonation).not.toHaveBeenCalled();
  });

  it("[id] GET as admin returns the donation", async () => {
    mockRequireAdminUser.mockResolvedValue(adminOk());
    mockGetDonationById.mockResolvedValue({ id: "d1", amount: 100 });
    const { GET } = await import("@/app/api/donations/[id]/route");
    const res = await GET(request("/api/donations/d1"), params("d1"));
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// /api/bookings
// ---------------------------------------------------------------------------

describe("F-A14: /api/bookings", () => {
  const validBooking = {
    sevaId: "seva-1",
    preferredDate: "2099-01-01",
    userName: "Rama",
    userEmail: "rama@example.com",
  };

  it("POST rejects an invalid payload with 400", async () => {
    const { POST } = await import("@/app/api/bookings/route");
    expect((await POST(request("/api/bookings", { method: "POST", body: {} }))).status).toBe(400);
    expect(mockCreateBooking).not.toHaveBeenCalled();
  });

  it("POST records an anonymous booking under the reserved key", async () => {
    mockCreateBooking.mockResolvedValue("b1");
    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(request("/api/bookings", { method: "POST", body: validBooking }));
    expect(res.status).toBe(201);
    expect(mockCreateBooking).toHaveBeenCalledWith(expect.objectContaining({ userId: "anonymous" }));
  });

  it("POST binds ownership to the verified token and ignores a spoofed userId", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "real-user", email: "r@e.org" });
    mockCreateBooking.mockResolvedValue("b2");
    const { POST } = await import("@/app/api/bookings/route");
    await POST(request("/api/bookings", { method: "POST", body: { ...validBooking, userId: "victim" } }));
    expect(mockCreateBooking).toHaveBeenCalledWith(expect.objectContaining({ userId: "real-user" }));
  });

  it("GET rejects an anonymous caller", async () => {
    mockVerifyBearerIdToken.mockResolvedValue(null);
    const { GET } = await import("@/app/api/bookings/route");
    expect((await GET(request("/api/bookings"))).status).toBe(401);
  });

  it("GET returns only the caller's own bookings", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "u1", email: null });
    mockGetBookingsByUser.mockResolvedValue([{ id: "b1" }]);
    const { GET } = await import("@/app/api/bookings/route");
    const res = await GET(request("/api/bookings?user=someone-else"));
    expect(res.status).toBe(200);
    expect(mockGetBookingsByUser).toHaveBeenCalledWith("u1");
  });

  it("[id] GET forbids cross-user access (403) and allows the owner", async () => {
    const mod = await import("@/app/api/bookings/[id]/route");
    mockGetBookingById.mockResolvedValue({ id: "b1", userId: "owner" });

    mockRequireAdminUser.mockResolvedValue(adminDenied(403));
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "intruder", email: null });
    expect((await mod.GET(request("/api/bookings/b1"), params("b1"))).status).toBe(403);

    mockVerifyBearerIdToken.mockResolvedValue({ uid: "owner", email: null });
    expect((await mod.GET(request("/api/bookings/b1"), params("b1"))).status).toBe(200);
  });

  it("[id] PATCH lets the owner declare a payment reference, but only as pending verification", async () => {
    const mod = await import("@/app/api/bookings/[id]/route");
    mockRequireAdminUser.mockResolvedValue(adminDenied(403));
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "owner", email: null });
    mockGetBookingById.mockResolvedValue({ id: "b1", userId: "owner" });

    // A status change by a non-admin is not accepted by the self-service schema.
    const statusRes = await mod.PATCH(
      request("/api/bookings/b1", { method: "PATCH", body: { status: "completed" } }),
      params("b1")
    );
    expect(statusRes.status).toBe(400);
    expect(mockUpdateBookingStatus).not.toHaveBeenCalled();

    // A payment reference is recorded as a *claim*: never completed by the devotee.
    const payRes = await mod.PATCH(
      request("/api/bookings/b1", { method: "PATCH", body: { payment: { paymentReference: "UPI-123" } } }),
      params("b1")
    );
    expect(payRes.status).toBe(200);
    expect(mockRecordPaymentClaim).toHaveBeenCalledWith("b1", {
      paymentReference: "UPI-123",
      paymentMethod: "UPI",
    });
    expect(mockUpdatePayment).not.toHaveBeenCalled();
  });

  it("[id] PATCH forbids a non-owner from recording a payment", async () => {
    const mod = await import("@/app/api/bookings/[id]/route");
    mockRequireAdminUser.mockResolvedValue(adminDenied(403));
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "intruder", email: null });
    mockGetBookingById.mockResolvedValue({ id: "b1", userId: "owner" });

    const res = await mod.PATCH(
      request("/api/bookings/b1", { method: "PATCH", body: { payment: { paymentReference: "X" } } }),
      params("b1")
    );
    expect(res.status).toBe(403);
    expect(mockUpdatePayment).not.toHaveBeenCalled();
  });

  it("[id] DELETE rejects a non-admin (owner cannot delete)", async () => {
    mockRequireAdminUser.mockResolvedValue(adminDenied(403));
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "owner", email: null });
    const { DELETE } = await import("@/app/api/bookings/[id]/route");
    expect((await DELETE(request("/api/bookings/b1", { method: "DELETE" }), params("b1"))).status).toBe(403);
    expect(mockDeleteBooking).not.toHaveBeenCalled();
  });

  it("[id] PATCH as admin may change status", async () => {
    mockRequireAdminUser.mockResolvedValue(adminOk());
    const { PATCH } = await import("@/app/api/bookings/[id]/route");
    const res = await PATCH(request("/api/bookings/b1", { method: "PATCH", body: { status: "confirmed" } }), params("b1"));
    expect(res.status).toBe(200);
    expect(mockUpdateBookingStatus).toHaveBeenCalledWith("b1", "confirmed");
  });
});

// ---------------------------------------------------------------------------
// /api/testimonials
// ---------------------------------------------------------------------------

describe("F-A14: /api/testimonials", () => {
  it("POST rejects an out-of-range rating with 400", async () => {
    const { POST } = await import("@/app/api/testimonials/route");
    const res = await POST(
      request("/api/testimonials", { method: "POST", body: { name: "Rama", experience: "Great", rating: 9 } })
    );
    expect(res.status).toBe(400);
    expect(mockSubmitAiTestimonial).not.toHaveBeenCalled();
  });

  it("POST submits a valid testimonial and cannot self-approve", async () => {
    mockSubmitAiTestimonial.mockResolvedValue("t1");
    const { POST } = await import("@/app/api/testimonials/route");
    const res = await POST(
      request("/api/testimonials", {
        method: "POST",
        body: { name: "Rama", experience: "Great", rating: 5, approved: true },
      })
    );
    expect(res.status).toBe(200);
    const payload = mockSubmitAiTestimonial.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("approved");
  });

  it("GET returns approved testimonials (public read)", async () => {
    mockGetApprovedAiTestimonials.mockResolvedValue([{ id: "t1" }]);
    const { GET } = await import("@/app/api/testimonials/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ testimonials: [{ id: "t1" }] });
  });

  it("devotee POST forces submittedBy=public and approved=false", async () => {
    mockCreateTestimonial.mockResolvedValue("t2");
    const { POST } = await import("@/app/api/testimonials/devotee/route");
    const res = await POST(
      request("/api/testimonials/devotee", {
        method: "POST",
        body: { name: "Rama", quote: "Blessed", submittedBy: "admin", approved: true },
      })
    );
    expect(res.status).toBe(201);
    expect(mockCreateTestimonial).toHaveBeenCalledWith(
      expect.objectContaining({ submittedBy: "public", approved: false, rejected: false })
    );
  });

  it("devotee POST rejects a missing quote with 400", async () => {
    const { POST } = await import("@/app/api/testimonials/devotee/route");
    expect((await POST(request("/api/testimonials/devotee", { method: "POST", body: { name: "Rama" } }))).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// /api/profile/*
// ---------------------------------------------------------------------------

describe("F-A14: /api/profile", () => {
  it("every profile write rejects an anonymous caller", async () => {
    mockVerifyBearerIdToken.mockResolvedValue(null);
    const root = await import("@/app/api/profile/route");
    const bookmarks = await import("@/app/api/profile/bookmarks/route");
    const favorites = await import("@/app/api/profile/favorites/route");
    const prefs = await import("@/app/api/profile/preferences/route");
    const recent = await import("@/app/api/profile/recently-viewed/route");

    expect((await root.GET(request("/api/profile"))).status).toBe(401);
    expect((await root.POST(request("/api/profile", { method: "POST", body: { name: "X" } }))).status).toBe(401);
    expect((await root.PUT(request("/api/profile", { method: "PUT", body: { name: "X" } }))).status).toBe(401);
    expect((await bookmarks.GET(request("/api/profile/bookmarks"))).status).toBe(401);
    expect((await favorites.POST(request("/api/profile/favorites", { method: "POST", body: { itemId: "1" } }))).status).toBe(401);
    expect((await prefs.PUT(request("/api/profile/preferences", { method: "PUT", body: { theme: "dark" } }))).status).toBe(401);
    expect((await recent.POST(request("/api/profile/recently-viewed", { method: "POST", body: { itemId: "1" } }))).status).toBe(401);
    expect(mockSaveProfile).not.toHaveBeenCalled();
  });

  it("profile write targets the token uid and drops a spoofed uid (mass assignment)", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "real-user", email: null });
    mockSaveProfile.mockResolvedValue({ uid: "real-user" });
    const { POST } = await import("@/app/api/profile/route");
    const res = await POST(request("/api/profile", { method: "POST", body: { uid: "victim", name: "Rama" } }));
    expect(res.status).toBe(200);
    const [uid, data] = mockSaveProfile.mock.calls[0] as [string, Record<string, unknown>];
    expect(uid).toBe("real-user");
    expect(data).not.toHaveProperty("uid");
  });

  it("favorites act on the caller's own uid", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "u1", email: null });
    const { POST } = await import("@/app/api/profile/favorites/route");
    const res = await POST(request("/api/profile/favorites", { method: "POST", body: { itemId: "event-1" } }));
    expect(res.status).toBe(200);
    expect(mockAddFavorite).toHaveBeenCalledWith("u1", "event-1");
  });

  it("favorites reject a missing itemId with 400", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "u1", email: null });
    const { POST } = await import("@/app/api/profile/favorites/route");
    expect((await POST(request("/api/profile/favorites", { method: "POST", body: {} }))).status).toBe(400);
  });

  it("bookmarks reject an unknown type on read and a bad body on create", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "u1", email: null });
    const { GET, POST } = await import("@/app/api/profile/bookmarks/route");
    expect((await GET(request("/api/profile/bookmarks?type=nonsense"))).status).toBe(400);
    expect((await POST(request("/api/profile/bookmarks", { method: "POST", body: { type: "event" } }))).status).toBe(400);
    expect(mockAddBookmark).not.toHaveBeenCalled();
  });

  it("bookmarks create strips a client-supplied id", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "u1", email: null });
    mockAddBookmark.mockResolvedValue({ id: "server-1" });
    const { POST } = await import("@/app/api/profile/bookmarks/route");
    const res = await POST(
      request("/api/profile/bookmarks", {
        method: "POST",
        body: { type: "event", itemId: "e1", title: "Event", url: "/events/e1", id: "attacker", createdAt: "2000-01-01" },
      })
    );
    expect(res.status).toBe(200);
    const payload = mockAddBookmark.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("createdAt");
  });

  it("profile image rejects a non-image upload with 400", async () => {
    mockVerifyBearerIdToken.mockResolvedValue({ uid: "u1", email: null });
    const { POST } = await import("@/app/api/profile/image/route");
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3])], "evil.txt", { type: "text/plain" }));
    const res = await POST(
      new NextRequest(new URL("/api/profile/image", "http://localhost"), {
        method: "POST",
        headers: { "x-forwarded-for": uniqueIp() },
        body: form,
      })
    );
    expect(res.status).toBe(400);
    expect(mockUploadProfileImage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("F-A14: public write rate limiting", () => {
  it("POST /api/donations answers 429 after the bucket is exhausted", async () => {
    mockCreateDonation.mockResolvedValue("d1");
    const { POST } = await import("@/app/api/donations/route");
    const ip = uniqueIp();

    let sawTooMany = false;
    for (let i = 0; i < 25; i++) {
      const res = await POST(request("/api/donations", { method: "POST", body: { donorName: "Rama", amount: 10 }, ip }));
      if (res.status === 429) {
        sawTooMany = true;
        break;
      }
    }
    expect(sawTooMany).toBe(true);
  });

  it("POST /api/testimonials answers 429 after the bucket is exhausted", async () => {
    mockSubmitAiTestimonial.mockResolvedValue("t1");
    const { POST } = await import("@/app/api/testimonials/route");
    const ip = uniqueIp();

    let sawTooMany = false;
    for (let i = 0; i < 15; i++) {
      const res = await POST(
        request("/api/testimonials", { method: "POST", body: { name: "Rama", experience: "Great", rating: 5 }, ip })
      );
      if (res.status === 429) {
        sawTooMany = true;
        break;
      }
    }
    expect(sawTooMany).toBe(true);
  });
});
