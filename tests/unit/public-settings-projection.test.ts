/**
 * F-A15.2 — public settings projection.
 *
 * `GET /api/public/settings/[key]` used to serialize the whole stored document for
 * `financeSettings` (billing block, GSTIN, invoice counter) and `device`
 * (notification/calendar/share/QR defaults). These tests pin the allow-listed
 * projection, the unchanged content-document behaviour, the 404 for unapproved
 * keys, the admin route's unchanged full-document access, and the absence of any
 * Firestore path.
 */

import { readFileSync } from "fs";
import { join } from "path";

jest.mock("server-only", () => ({}), { virtual: true });

// ---------------------------------------------------------------------------
// Fake Supabase admin client: one row per document key, read-only.
// ---------------------------------------------------------------------------

let storedDocument: unknown = null;
let storedError: { message: string } | null = null;

const mockMaybeSingle = jest.fn(() =>
  Promise.resolve({ data: storedDocument === null ? null : { data: storedDocument }, error: storedError })
);
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

const mockRequireAdminUser = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => ({
  requireAdminUser: (...args: unknown[]) => mockRequireAdminUser(...args),
}));

import { GET as publicGet } from "@/app/api/public/settings/[key]/route";
import { GET as adminGet } from "@/app/api/admin/settings/[key]/route";
import {
  projectPublicFinanceSettings,
  projectPublicSettingsDocument,
} from "@/lib/settings/public-projections";

/** A stored finance document containing every internal field the projection must drop. */
const SENSITIVE_FINANCE_DOC = {
  enabled: true,
  billingEnabled: true,
  billing: {
    invoicePrefix: "INV",
    invoiceNumber: 4242,
    defaultDueDays: 15,
    taxRate: 18,
    currency: "INR",
    companyName: "Sri Rayara Matha Trust",
    companyAddress: "428/20, Yelahanka",
    companyPhone: "+91 80 2332 3456",
    companyEmail: "accounts@temple.example",
    companyGstin: "29AAAAA0000A1Z5",
    notes: "internal billing note",
  },
  upi: { enabled: true, id: "temple@upi", displayName: "Sri Rayara Matha" },
  bankTransfer: {
    enabled: true,
    accountName: "Sri Rayara Matha Trust",
    accountNumber: "1234567890123",
    bankName: "State Bank of India",
    ifscCode: "SBIN0001234",
    branch: "Yelahanka",
  },
  specialSevas: [
    { id: "1", title: "Annadanam", description: "Meals", amount: 501, icon: "heart", isActive: true, order: 1 },
    { id: "2", title: "Hidden", description: "x", amount: 1, icon: "star", isActive: false, order: 2 },
  ],
  updatedAt: "2026-10-31T00:00:00Z",
  internalNote: "should never be public",
};

/**
 * A stored device document. The public endpoint no longer serves `device` at all, so
 * this fixture only exercises the 404 regression: it must never be returned.
 */
const SENSITIVE_DEVICE_DOC = {
  templeLocation: {
    latitude: 13.0967,
    longitude: 77.5846,
    name: "Sri Raghavendra Swamy Matha",
    address: "Yelahanka, Bengaluru",
    phone: "+91 80 2332 3456",
  },
  defaultNavigationApp: "waze",
  notificationDefaults: {
    dailyPanchangaReminder: true,
    dailyPanchangaTime: "05:30",
    festivalReminderOffset: 3,
    eventReminderOffset: 45,
  },
  calendarDefaults: { defaultProvider: "google", eventDuration: 90, reminderTime: 20 },
  shareTemplates: { event: "internal", seva: "internal", gallery: "g", donation: "d", quote: "q", panchanga: "p" },
  qrScannerDefaults: { continuous: true, cameraDirection: "environment" },
};

function financeResponseBody(body: unknown): Record<string, any> {
  return (body as any).data;
}

beforeEach(() => {
  jest.clearAllMocks();
  storedDocument = null;
  storedError = null;
});

// ---------------------------------------------------------------------------
// Direct projection unit tests
// ---------------------------------------------------------------------------

describe("projectPublicFinanceSettings", () => {
  it("keeps only the donation fields and drops the billing block and internal keys", () => {
    const projected = projectPublicFinanceSettings(SENSITIVE_FINANCE_DOC)!;

    // Required donation fields survive.
    expect(projected.enabled).toBe(true);
    expect(projected.upi).toEqual({ enabled: true, id: "temple@upi", displayName: "Sri Rayara Matha" });
    expect(projected.bankTransfer).toEqual({
      enabled: true,
      accountName: "Sri Rayara Matha Trust",
      accountNumber: "1234567890123",
      bankName: "State Bank of India",
      ifscCode: "SBIN0001234",
      branch: "Yelahanka",
    });
    expect(projected.specialSevas).toHaveLength(1);
    expect(projected.specialSevas[0].title).toBe("Annadanam");

    // Excluded.
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain("billing");
    expect(serialized).not.toContain("billingEnabled");
    expect(serialized).not.toContain("invoicePrefix");
    expect(serialized).not.toContain("invoiceNumber");
    expect(serialized).not.toContain("4242");
    expect(serialized).not.toContain("Gstin");
    expect(serialized).not.toContain("29AAAAA0000A1Z5");
    expect(serialized).not.toContain("accounts@temple.example");
    expect(serialized).not.toContain("internalNote");
    expect(serialized).not.toContain("updatedAt");
    expect(Object.keys(projected).sort()).toEqual(
      ["bankTransfer", "enabled", "specialSevas", "upi"].sort()
    );
  });

  it("returns null for a missing document so the caller keeps its defaults", () => {
    expect(projectPublicFinanceSettings(null)).toBeNull();
    expect(projectPublicFinanceSettings(undefined)).toBeNull();
  });

  it("defends against malformed nested objects without throwing", () => {
    const projected = projectPublicFinanceSettings({
      enabled: "yes",
      upi: "not-an-object",
      bankTransfer: 42,
      specialSevas: "nope",
    })!;
    expect(projected.enabled).toBe(true); // non-boolean falls back to the default
    expect(projected.upi).toEqual({ enabled: false, id: "", displayName: "" });
    expect(projected.bankTransfer.accountNumber).toBe("");
    expect(projected.specialSevas).toEqual([]);
  });

  it("drops inactive special sevas and keeps only the published ones", () => {
    const projected = projectPublicFinanceSettings({
      specialSevas: [
        { id: "1", title: "Annadanam", isActive: true, order: 1 },
        { id: "2", title: "Unpublished", isActive: false, order: 2 },
        { id: "3", title: "Also published", isActive: true, order: 3 },
      ],
    })!;
    expect(projected.specialSevas.map((s) => s.title)).toEqual(["Annadanam", "Also published"]);
  });

  it("treats a missing or non-boolean isActive as unpublished", () => {
    const projected = projectPublicFinanceSettings({
      specialSevas: [
        { id: "1", title: "No flag" },
        { id: "2", title: "String flag", isActive: "true" },
        { id: "3", title: "Real flag", isActive: true },
      ],
    })!;
    expect(projected.specialSevas.map((s) => s.id)).toEqual(["3"]);
  });

  it("coerces non-string special-seva fields and drops non-object entries", () => {
    const projected = projectPublicFinanceSettings({
      specialSevas: [null, { id: 7, title: 9, amount: "x", isActive: true }],
    })!;
    expect(projected.specialSevas).toHaveLength(1);
    expect(projected.specialSevas[0]).toEqual({
      id: "",
      title: "",
      description: "",
      amount: 0,
      icon: "",
      isActive: true,
      order: 0,
    });
  });
});

describe("projectPublicSettingsDocument", () => {
  it("passes content documents through unchanged", () => {
    const aboutUs = { history: "long", sections: [1, 2, 3] };
    expect(projectPublicSettingsDocument("aboutUs", aboutUs)).toBe(aboutUs);
    expect(projectPublicSettingsDocument("footer", { text: "x" })).toEqual({ text: "x" });
  });
});

// ---------------------------------------------------------------------------
// Public route behaviour
// ---------------------------------------------------------------------------

function publicRequest(key: string) {
  return [{} as any, { params: Promise.resolve({ key }) }] as const;
}

describe("GET /api/public/settings/[key]", () => {
  it("returns the projected finance document and never serializes billing data", async () => {
    storedDocument = SENSITIVE_FINANCE_DOC;
    const response = await publicGet(...publicRequest("financeSettings"));
    expect(response.status).toBe(200);

    const data = financeResponseBody(await response.json());
    expect(data.upi.id).toBe("temple@upi");
    expect(data.bankTransfer.accountNumber).toBe("1234567890123");
    // The stored document has one active and one inactive special seva.
    expect(data.specialSevas).toHaveLength(1);
    expect(data.specialSevas[0].title).toBe("Annadanam");

    const raw = JSON.stringify(data);
    expect(raw).not.toContain("billing");
    expect(raw).not.toContain("Gstin");
    expect(raw).not.toContain("29AAAAA0000A1Z5");
    expect(raw).not.toContain("invoiceNumber");
    expect(raw).not.toContain("Hidden");
  });

  it("returns 404 for the device document (no public consumer)", async () => {
    storedDocument = SENSITIVE_DEVICE_DOC;
    const response = await publicGet(...publicRequest("device"));
    expect(response.status).toBe(404);
    // The read never happens: the key is rejected before the service is called.
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns data: null when the document does not exist yet", async () => {
    storedDocument = null;
    const response = await publicGet(...publicRequest("financeSettings"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, data: null });
  });

  it("returns 404 for a settings key that is not public", async () => {
    const response = await publicGet(...publicRequest("notARealKey"));
    expect(response.status).toBe(404);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("still serves content documents in full", async () => {
    storedDocument = { history: "temple history" };
    const response = await publicGet(...publicRequest("aboutUs"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({ history: "temple history" });
  });

  it("keeps the existing 500 behaviour when the read fails", async () => {
    storedError = { message: "db down" };
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const response = await publicGet(...publicRequest("financeSettings"));
    expect(response.status).toBe(500);
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility with the public donation hook
// ---------------------------------------------------------------------------

describe("public donation compatibility", () => {
  it("exposes the fields useFinanceSettings derives from the response", async () => {
    storedDocument = SENSITIVE_FINANCE_DOC;
    const response = await publicGet(...publicRequest("financeSettings"));
    const data = financeResponseBody(await response.json());

    // Mirrors hooks/useFinanceSettings.ts: enabled, upi.enabled, bankTransfer.enabled,
    // upi, bankTransfer, and the active specialSevas sorted by order. The API already
    // filters inactive sevas, so the hook's own filter is a no-op on this payload.
    expect(typeof data.enabled).toBe("boolean");
    expect(data.upi.enabled).toBe(true);
    expect(data.bankTransfer.enabled).toBe(true);
    expect(data.specialSevas.every((s: any) => s.isActive)).toBe(true);
    const activeSevas = data.specialSevas
      .filter((s: any) => s.isActive)
      .sort((a: any, b: any) => a.order - b.order);
    expect(activeSevas.map((s: any) => s.title)).toEqual(["Annadanam"]);
  });

  it("does not import or call Firestore in the changed modules", () => {
    const files = [
      "app/api/public/settings/[key]/route.ts",
      "lib/settings/public-projections.ts",
      "lib/device/settings.ts",
    ];
    // Match real module imports / SDK calls, not the word "Firestore" in prose comments.
    const firestoreUsage = /(?:from|require\()\s*['"](?:firebase|firebase\/[\w-]+|@firebase\/[\w-]+|firebase-admin)['"]|getFirestore|getDocs|getDoc\(|setDoc\(|collection\(/;
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source).not.toMatch(firestoreUsage);
    }
  });
});

// ---------------------------------------------------------------------------
// Admin access is unchanged
// ---------------------------------------------------------------------------

describe("GET /api/admin/settings/[key] (unchanged)", () => {
  it("returns the complete finance document, including billing, for an authorized admin", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: true,
      user: { uid: "admin-1", email: "a@b.c", role: "super_admin" },
    });
    storedDocument = SENSITIVE_FINANCE_DOC;

    const request = { headers: { get: () => "Bearer token" } } as any;
    const response = await adminGet(request, { params: Promise.resolve({ key: "financeSettings" }) });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.billing.companyGstin).toBe("29AAAAA0000A1Z5");
    expect(body.data.billing.invoiceNumber).toBe(4242);
    expect(body.data.billingEnabled).toBe(true);
    // The inactive-seva filter and projection are public-only: admins still edit
    // unpublished sevas, so both entries must come back here.
    expect(body.data.specialSevas).toHaveLength(2);
  });

  it("rejects an unauthorized caller before any read", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const request = { headers: { get: () => null } } as any;
    const response = await adminGet(request, { params: Promise.resolve({ key: "financeSettings" }) });
    expect(response.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
