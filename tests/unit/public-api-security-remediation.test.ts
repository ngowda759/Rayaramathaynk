/**
 * @jest-environment node
 *
 * F-A14 remediation — regression tests for the PR #368 security review.
 *
 * Covers the four corrections:
 *  1. Booking payment verification: a devotee's reference is recorded as *pending*,
 *     never completed, and cannot change the booking status.
 *  2. Seva amount integrity: the seva's title and price are resolved server-side and
 *     a forged request amount cannot change what is stored.
 *  3. Profile image signature validation: the bytes, not the declared MIME, decide.
 *  4. Complete rate-limit coverage on the previously-unlimited DELETE handlers.
 *
 * The service layer is exercised against a stubbed Supabase builder, so these are
 * real code-path tests (no mocking of the logic under test).
 */

jest.mock("server-only", () => ({}), { virtual: true });

// ---------------------------------------------------------------------------
// A minimal Supabase builder shared by the service-layer tests.
// ---------------------------------------------------------------------------

type Result = { data: unknown; error: { message: string; code?: string } | null };

const results = {
  /** The next `.maybeSingle()`/`.single()` read (seva lookup). */
  read: { data: null, error: null } as Result,
  /** The next awaited mutation result. */
  write: { data: null, error: null } as Result,
};

interface Call {
  table: string;
  op: "insert" | "update" | "delete" | "select";
  payload?: unknown;
  filters: string[];
}

const calls: Call[] = [];

function makeBuilder() {
  let current: Call | null = null;

  const builder: Record<string, unknown> = {};
  const chain = () => builder;

  const record = (op: Call["op"]) => (payload?: unknown) => {
    current = { table: "unknown", op, payload, filters: [] };
    calls.push(current);
    return builder;
  };

  builder.from = jest.fn((table: string) => {
    current = { table, op: "select", filters: [] };
    calls.push(current);
    return builder;
  });
  builder.select = jest.fn(chain);
  builder.insert = jest.fn(record("insert"));
  builder.update = jest.fn(record("update"));
  builder.delete = jest.fn(record("delete"));
  builder.eq = jest.fn((column: string, value: unknown) => {
    current?.filters.push(`eq:${column}=${String(value)}`);
    return builder;
  });
  builder.neq = jest.fn((column: string, value: unknown) => {
    current?.filters.push(`neq:${column}=${String(value)}`);
    return builder;
  });
  builder.or = jest.fn((filter: string) => {
    current?.filters.push(`or:${filter}`);
    return builder;
  });
  builder.order = jest.fn(chain);
  builder.limit = jest.fn(chain);
  builder.maybeSingle = jest.fn(() => Promise.resolve(results.read));
  builder.single = jest.fn(() => Promise.resolve(results.write));
  builder.then = jest.fn((resolve: (v: unknown) => unknown) => Promise.resolve(results.write).then(resolve));
  return builder;
}

const builder = makeBuilder();

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => builder.from(table) }),
}));

import { sevaBookingService, SevaBookingError } from "@/services/sevaBooking.server";
import { verifyImageSignature, sniffImageType } from "@/lib/validation/image-signature";

function reset() {
  results.read = { data: null, error: null };
  results.write = { data: null, error: null };
  calls.length = 0;
  for (const fn of Object.values(builder)) (fn as jest.Mock).mockClear?.();
}

/** The last mutation recorded (the insert or update under test). */
const lastWrite = () => [...calls].reverse().find((c) => c.op === "insert" || c.op === "update");

// ---------------------------------------------------------------------------
// 1. Booking payment verification
// ---------------------------------------------------------------------------

describe("F-A14 remediation: booking payment verification", () => {
  beforeEach(reset);

  it("recordPaymentClaim stores the reference as pending, never completed", async () => {
    await sevaBookingService.recordPaymentClaim("b1", { paymentReference: "UPI-123", paymentMethod: "UPI" });

    const write = lastWrite();
    expect(write?.op).toBe("update");
    const payload = write?.payload as Record<string, unknown>;
    expect(payload.payment_reference).toBe("UPI-123");
    expect(payload.payment_status).toBe("pending");
    expect(payload.status).toBe("pending");
    expect(payload.payment_date).toBe("");
  });

  it("recordPaymentClaim cannot un-confirm a booking already confirmed", async () => {
    await sevaBookingService.recordPaymentClaim("b1", { paymentReference: "UPI-123", paymentMethod: "UPI" });

    const filters = lastWrite()?.filters ?? [];
    expect(filters).toContain("neq:status=confirmed");
    expect(filters).toContain("neq:status=completed");
  });

  it("updatePayment (trusted path) is the only one that can mark a payment completed", async () => {
    await sevaBookingService.updatePayment("b1", {
      paymentReference: "GATEWAY-9",
      paymentStatus: "completed",
      paymentMethod: "UPI",
    });

    const payload = lastWrite()?.payload as Record<string, unknown>;
    expect(payload.payment_status).toBe("completed");
    expect(payload.status).toBe("confirmed");
    expect(String(payload.payment_date)).not.toBe("");
  });
});

// ---------------------------------------------------------------------------
// 2. Seva amount integrity
// ---------------------------------------------------------------------------

describe("F-A14 remediation: seva amount integrity", () => {
  beforeEach(reset);

  const bookableSeva = {
    firestore_id: "seva-1",
    id: "11111111-1111-1111-1111-111111111111",
    name: "Annadanam",
    amount: 501,
    active: true,
    visibility: "online",
    any_amount: false,
  };

  const request = (overrides: Record<string, unknown> = {}) => ({
    sevaId: "seva-1",
    sevaTitle: "HACKED TITLE",
    sevaAmount: 1,
    userId: "u1",
    userName: "Rama",
    userEmail: "r@e.org",
    userPhone: "9999999999",
    preferredDate: "2099-01-01",
    notes: "",
    ...overrides,
  });

  it("stores the seva's own price and title, ignoring a forged amount/title", async () => {
    results.read = { data: bookableSeva, error: null };
    results.write = { data: { firestore_id: "b1", id: "b1" }, error: null };

    await sevaBookingService.createBooking(request() as never);

    const payload = lastWrite()?.payload as Record<string, unknown>;
    expect(payload.seva_amount).toBe(501);
    expect(payload.seva_title).toBe("Annadanam");
  });

  it("changing the requested amount cannot change the stored amount", async () => {
    results.read = { data: bookableSeva, error: null };
    results.write = { data: { firestore_id: "b1", id: "b1" }, error: null };

    await sevaBookingService.createBooking(request({ sevaAmount: 999999 }) as never);
    expect((lastWrite()?.payload as Record<string, unknown>).seva_amount).toBe(501);

    reset();
    results.read = { data: bookableSeva, error: null };
    results.write = { data: { firestore_id: "b1", id: "b1" }, error: null };
    await sevaBookingService.createBooking(request({ sevaAmount: 0 }) as never);
    expect((lastWrite()?.payload as Record<string, unknown>).seva_amount).toBe(501);
  });

  it("honours a free/custom-amount seva only when it is offered online", async () => {
    // A custom-amount (Karnike) seva may only be counter-only by DB constraint, so
    // the online path rejects it. A free seva that is offered online books at its
    // stored price (0), never at a client-chosen amount.
    results.read = { data: { ...bookableSeva, any_amount: true, amount: 0, visibility: "counter" }, error: null };
    await expect(
      sevaBookingService.createBooking(request({ sevaAmount: 250 }) as never)
    ).rejects.toBeInstanceOf(SevaBookingError);

    reset();
    results.read = { data: { ...bookableSeva, any_amount: true, amount: 0, visibility: "both" }, error: null };
    results.write = { data: { firestore_id: "b1", id: "b1" }, error: null };
    await sevaBookingService.createBooking(request({ sevaAmount: 250 }) as never);
    expect((lastWrite()?.payload as Record<string, unknown>).seva_amount).toBe(0);
  });

  it("rejects an unknown seva", async () => {
    results.read = { data: null, error: null };
    await expect(sevaBookingService.createBooking(request() as never)).rejects.toBeInstanceOf(SevaBookingError);
  });

  it("rejects an inactive seva", async () => {
    results.read = { data: { ...bookableSeva, active: false }, error: null };
    await expect(sevaBookingService.createBooking(request() as never)).rejects.toBeInstanceOf(SevaBookingError);
  });

  it("rejects a counter-only seva (not offered online)", async () => {
    results.read = { data: { ...bookableSeva, visibility: "counter" }, error: null };
    await expect(sevaBookingService.createBooking(request() as never)).rejects.toBeInstanceOf(SevaBookingError);
  });
});

// ---------------------------------------------------------------------------
// 3. Profile image signature validation
// ---------------------------------------------------------------------------

describe("F-A14 remediation: image signature validation", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00]);
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);

  it("accepts each allow-listed format", () => {
    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(gif)).toBe("image/gif");
    expect(sniffImageType(webp)).toBe("image/webp");
  });

  it("rejects a script renamed to .png with a spoofed image/png type", () => {
    const script = new TextEncoder().encode("#!/bin/sh\nrm -rf /");
    const result = verifyImageSignature(script, "image/png");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not a valid/i);
  });

  it("rejects a PNG whose bytes claim to be a JPEG (mismatched declared type)", () => {
    const result = verifyImageSignature(png, "image/jpeg");
    expect(result.ok).toBe(false);
    expect(result.detected).toBe("image/png");
  });

  it("accepts a matching declared type and a missing declared type", () => {
    expect(verifyImageSignature(png, "image/png").ok).toBe(true);
    expect(verifyImageSignature(png).ok).toBe(true);
  });

  it("rejects a truncated or empty file", () => {
    expect(verifyImageSignature(new Uint8Array([]), "image/png").ok).toBe(false);
    expect(verifyImageSignature(new Uint8Array([0x89, 0x50]), "image/png").ok).toBe(false);
  });

  it("rejects a WebP whose RIFF container is not WEBP", () => {
    const riffWave = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    expect(verifyImageSignature(riffWave, "image/webp").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Rate-limit coverage (route-level)
// ---------------------------------------------------------------------------

jest.mock("@/lib/auth/verify-id-token", () => ({
  verifyBearerIdToken: jest.fn(),
}));

jest.mock("@/lib/auth/admin-auth", () => ({
  requireAdminUser: jest.fn(),
}));

const mockUploadProfileImage = jest.fn();
const mockDeleteProfileImage = jest.fn();
const mockRemoveBookmark = jest.fn();
const mockRemoveFavorite = jest.fn();
jest.mock("@/services/profile.server", () => ({
  profileService: {
    uploadProfileImage: (...a: unknown[]) => mockUploadProfileImage(...a),
    deleteProfileImage: (...a: unknown[]) => mockDeleteProfileImage(...a),
    removeBookmark: (...a: unknown[]) => mockRemoveBookmark(...a),
    removeFavorite: (...a: unknown[]) => mockRemoveFavorite(...a),
  },
}));

import { NextRequest } from "next/server";
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";

let ipSeq = 0;
const uniqueIp = () => `f-a14r-${++ipSeq}`;

function jsonRequest(url: string, method: string, body: unknown, ip: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("F-A14 remediation: profile image upload rejects a spoofed file", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyBearerIdToken as jest.Mock).mockResolvedValue({ uid: "u1", email: null });
  });

  function uploadRequest(file: File): NextRequest {
    const form = new FormData();
    form.append("file", file);
    return new NextRequest(new URL("/api/profile/image", "http://localhost"), {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
      body: form,
    });
  }

  it("rejects a script renamed to .png with a spoofed image/png type", async () => {
    const { POST } = await import("@/app/api/profile/image/route");
    const script = new File([new TextEncoder().encode("#!/bin/sh\necho pwned")], "avatar.png", {
      type: "image/png",
    });
    const res = await POST(uploadRequest(script));
    expect(res.status).toBe(400);
    expect(mockUploadProfileImage).not.toHaveBeenCalled();
  });

  it("accepts a real PNG and stores the sniffed type", async () => {
    mockUploadProfileImage.mockResolvedValue("https://blob.example/avatar.png");
    const { POST } = await import("@/app/api/profile/image/route");
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const png = new File([pngBytes], "avatar.png", { type: "image/png" });
    const res = await POST(uploadRequest(png));
    expect(res.status).toBe(200);
    const passed = mockUploadProfileImage.mock.calls[0][1] as File;
    expect(passed.type).toBe("image/png");
  });
});

describe("F-A14 remediation: rate-limit coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyBearerIdToken as jest.Mock).mockResolvedValue({ uid: "u1", email: null });
  });

  it("DELETE /api/profile/bookmarks answers 429 after the bucket is exhausted", async () => {
    const { DELETE } = await import("@/app/api/profile/bookmarks/route");
    const ip = uniqueIp();
    let sawTooMany = false;
    for (let i = 0; i < 65; i++) {
      const res = await DELETE(jsonRequest("/api/profile/bookmarks", "DELETE", { bookmarkId: "b1" }, ip));
      if (res.status === 429) {
        sawTooMany = true;
        break;
      }
    }
    expect(sawTooMany).toBe(true);
  });

  it("DELETE /api/profile/favorites answers 429 after the bucket is exhausted", async () => {
    const { DELETE } = await import("@/app/api/profile/favorites/route");
    const ip = uniqueIp();
    let sawTooMany = false;
    for (let i = 0; i < 65; i++) {
      const res = await DELETE(jsonRequest("/api/profile/favorites", "DELETE", { itemId: "e1" }, ip));
      if (res.status === 429) {
        sawTooMany = true;
        break;
      }
    }
    expect(sawTooMany).toBe(true);
  });

  it("DELETE /api/profile/image answers 429 after the bucket is exhausted", async () => {
    const { DELETE } = await import("@/app/api/profile/image/route");
    const ip = uniqueIp();
    let sawTooMany = false;
    for (let i = 0; i < 15; i++) {
      const req = new NextRequest(new URL("/api/profile/image", "http://localhost"), {
        method: "DELETE",
        headers: { "x-forwarded-for": ip },
      });
      const res = await DELETE(req);
      if (res.status === 429) {
        sawTooMany = true;
        break;
      }
    }
    expect(sawTooMany).toBe(true);
  });

  it("DELETE /api/bookings/[id] is rate-limited for an admin", async () => {
    const { requireAdminUser } = await import("@/lib/auth/admin-auth");
    (requireAdminUser as jest.Mock).mockResolvedValue({ ok: true, user: { uid: "admin-1" } });
    const { DELETE } = await import("@/app/api/bookings/[id]/route");
    const ip = uniqueIp();
    let sawTooMany = false;
    for (let i = 0; i < 65; i++) {
      const req = new NextRequest(new URL("/api/bookings/b1", "http://localhost"), {
        method: "DELETE",
        headers: { "x-forwarded-for": ip },
      });
      const res = await DELETE(req, params("b1"));
      if (res.status === 429) {
        sawTooMany = true;
        break;
      }
    }
    expect(sawTooMany).toBe(true);
  });
});
