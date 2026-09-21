import {
  mapUser,
  mapProfile,
  mapDonation,
  mapGalleryMedia,
  mapGalleryAlbum,
  mapTestimonial,
  mapEvent,
  mapSeva,
  mapDailyPooja,
  mapChatSession,
  mapChatMessage,
  mapUnknownQuestion,
  mapLatencyRecord,
  mapIntentDistribution,
  mapSettingsDocument,
  isSiteSettingsDoc,
  toJsonSafe,
  CONTENT_FIELD_SPECS,
  AI_FIELD_SPECS,
  CORE_FIELD_SPECS,
} from "@/lib/supabase/migration-mappers";
import { auditFieldCoverage, ValidationError } from "@/lib/supabase/migration-helpers";

const ts = (seconds: number) => ({ _seconds: seconds, _nanoseconds: 0 });

// ---------------------------------------------------------------------------
// B. Arbitrary Firestore IDs in seva_id / campaign_id / album_id
// ---------------------------------------------------------------------------

describe("arbitrary Firestore document IDs (B)", () => {
  it("preserves a non-UUID campaignId verbatim in donations", () => {
    const row = mapDonation("don-1", {
      donorName: "Rama",
      email: "rama@example.org",
      phone: "9999999999",
      address: "Bengaluru",
      amount: 5001,
      purpose: "Annadanam",
      campaignId: "campaign_annadanam_2026",
      message: "Dhanyavada",
      paymentMode: "upi",
      status: "completed",
      receiptNumber: "R-001",
      adminRemarks: "",
      collectedBy: "admin",
    });
    expect(row.campaign_id).toBe("campaign_annadanam_2026");
  });

  it("preserves a Firestore-random-style campaignId", () => {
    const id = "aB3xY9zQ1wErTyUiOp";
    const row = mapDonation("don-2", {
      donorName: "Sita",
      email: "sita@example.org",
      phone: "8888888888",
      address: "Mysuru",
      amount: 100,
      purpose: "Goshala",
      campaignId: id,
      message: "",
      paymentMode: "cash",
      status: "completed",
      receiptNumber: "R-002",
      adminRemarks: "",
      collectedBy: "admin",
    });
    expect(row.campaign_id).toBe(id);
  });

  it("keeps campaign_id null when the source has no campaign", () => {
    const row = mapDonation("don-3", {
      donorName: "Lakshmi",
      email: "l@example.org",
      phone: "7777777777",
      address: "Hubli",
      amount: 250,
      purpose: "Seva",
      message: "",
      paymentMode: "cash",
      status: "completed",
      receiptNumber: "R-003",
      adminRemarks: "",
      collectedBy: "admin",
    });
    expect(row.campaign_id).toBeNull();
  });

  it("preserves a non-UUID albumId verbatim in gallery_media", () => {
    const row = mapGalleryMedia("media-1", {
      albumId: "aaradhane-2026-album",
      title: "Aaradhane",
      description: "Photos",
      category: "events",
      type: "photo",
      imagePath: "gallery/a.jpg",
      altText: "Aaradhane photo",
      uploadedBy: "admin",
    });
    expect(row.album_id).toBe("aaradhane-2026-album");
  });

  it("does not generate or coerce a UUID for album_id", () => {
    const row = mapGalleryMedia("media-2", {
      albumId: "42",
      title: "T",
      description: "D",
      category: "events",
      type: "photo",
      imagePath: "p.jpg",
      altText: "",
      uploadedBy: "admin",
    });
    expect(row.album_id).toBe("42");
  });

  it("keeps album_id null for standalone media", () => {
    const row = mapGalleryMedia("media-3", {
      title: "T",
      description: "D",
      category: "events",
      type: "photo",
      imagePath: "p.jpg",
      altText: "",
      uploadedBy: "admin",
    });
    expect(row.album_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// D. Timestamp preservation / missing timestamp behaviour
// ---------------------------------------------------------------------------

describe("content mapper timestamp handling (C + D)", () => {
  it("preserves real createdAt instead of substituting now()", () => {
    const row = mapUser("u1", {
      email: "a@b.org",
      name: "Devotee",
      createdAt: ts(1600000000),
      updatedAt: ts(1600000100),
    });
    expect(row.created_at).toBe(new Date(1600000000 * 1000).toISOString());
    expect(row.updated_at).toBe(new Date(1600000100 * 1000).toISOString());
  });

  it("omits created_at entirely when the source lacks it", () => {
    const row = mapUser("u2", { email: "a@b.org" });
    expect(row).not.toHaveProperty("created_at");
    expect(row).not.toHaveProperty("updated_at");
  });

  it("does not add a timestamp that was absent in a testimonial", () => {
    const row = mapTestimonial("t1", {
      name: "N",
      location: "L",
      quote: "Q",
      years: "10",
    });
    expect(row).not.toHaveProperty("created_at");
  });

  it("rejects a present-but-unparseable timestamp rather than dropping it", () => {
    expect(() => mapUser("u3", { email: "a@b.org", createdAt: "not-a-date" })).toThrow(
      ValidationError
    );
  });

  it("leaves nullable collected_at/uploaded_at as null when absent", () => {
    const donation = mapDonation("d1", {
      donorName: "N",
      email: "e@x.org",
      phone: "1",
      address: "A",
      amount: 1,
      purpose: "P",
      message: "",
      paymentMode: "cash",
      status: "completed",
      receiptNumber: "R",
      adminRemarks: "",
      collectedBy: "admin",
    });
    expect(donation.collected_at).toBeNull();

    const media = mapGalleryMedia("m1", {
      title: "T",
      description: "D",
      category: "c",
      type: "photo",
      imagePath: "p",
      altText: "",
      uploadedBy: "admin",
    });
    expect(media.uploaded_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// E. Synthetic-default rejection
// ---------------------------------------------------------------------------

describe("synthetic default rejection (E)", () => {
  it("rejects an AI latency record with a missing component instead of using 0", () => {
    expect(() =>
      mapLatencyRecord("l1", {
        totalLatency: 1200,
        intentDetectionTime: 100,
        retrievalTime: 300,
        // generationTime missing
        timestamp: ts(1700000000),
        success: true,
      })
    ).toThrow(/generationTime/);
  });

  it("rejects a latency record with a missing success flag instead of assuming true", () => {
    expect(() =>
      mapLatencyRecord("l2", {
        totalLatency: 1200,
        intentDetectionTime: 100,
        retrievalTime: 300,
        generationTime: 800,
        timestamp: ts(1700000000),
      })
    ).toThrow(/success/);
  });

  it("rejects a chat message without a timestamp instead of stamping now()", () => {
    expect(() =>
      mapChatMessage("m1", { sessionId: "s1", role: "user", content: "hi" })
    ).toThrow(/timestamp/);
  });

  it("rejects an unknown question without a timestamp", () => {
    expect(() => mapUnknownQuestion("q1", { question: "Who is Rayaru?" })).toThrow(/timestamp/);
  });

  it("rejects an intent distribution record without a timestamp", () => {
    expect(() => mapIntentDistribution("i1", { intent: "greeting" })).toThrow(/timestamp/);
  });

  it("rejects an event missing required startDate instead of inventing a date", () => {
    expect(() =>
      mapEvent("e1", {
        title: "T",
        description: "D",
        location: "L",
        status: "published",
      })
    ).toThrow(/startDate/);
  });

  it("rejects documents missing other required fields", () => {
    expect(() => mapUser("u", {})).toThrow(/email/);
    expect(() => mapProfile("p", { uid: "u", name: "n" })).toThrow(/email/);
    expect(() => mapSeva("s", { name: "n", description: "d", category: "c", amount: 1 })).toThrow(
      /duration/
    );
    expect(() =>
      mapDailyPooja("d", {
        title: "t",
        startTime: "06:00",
        duration: "30",
        category: "c",
        sevaAmount: 1,
        days: ["Mon"],
      })
    ).toThrow(/description/);
    expect(() =>
      mapGalleryAlbum("a", { title: "t", slug: "s", description: "d" })
    ).toThrow(/coverImage/);
  });

  it("keeps genuine domain defaults that do not mask source data", () => {
    // A question's first sighting really is 1; unassigned is the real initial state.
    const row = mapUnknownQuestion("q2", { question: "Where is the temple?", timestamp: ts(1) });
    expect(row.times_asked).toBe(1);
    expect(row.assigned_to).toBe("unassigned");
    expect(row.status).toBe("pending");

    // A session with no recorded count genuinely has zero messages.
    expect(mapChatSession("s1", {}).message_count).toBe(0);

    // New content is inactive/unfeatured until published.
    expect(mapGalleryMedia("m", { title: "t", description: "d", category: "c", type: "photo", imagePath: "p", altText: "", uploadedBy: "a" }).is_featured).toBe(false);
  });

  it("still preserves real values when they are present", () => {
    const row = mapUnknownQuestion("q3", {
      question: "Q",
      timestamp: ts(1),
      timesAsked: 9,
      assignedTo: "priya",
      status: "resolved",
    });
    expect(row.times_asked).toBe(9);
    expect(row.assigned_to).toBe("priya");
    expect(row.status).toBe("resolved");
  });
});

// ---------------------------------------------------------------------------
// A. Settings document preservation
// ---------------------------------------------------------------------------

describe("settings document preservation (A)", () => {
  const financeSettings = {
    enabled: true,
    billingEnabled: false,
    billing: {
      invoicePrefix: "INV",
      invoiceNumber: 1000,
      defaultDueDays: 15,
      taxRate: 0,
      currency: "INR",
      notes: "Thank you",
    },
    upi: { enabled: true, id: "srs@upi", displayName: "Sri Rayara Matha" },
    bankTransfer: {
      enabled: true,
      accountName: "Temple Trust",
      accountNumber: "1234567890",
      ifscCode: "SBIN0001234",
    },
    specialSevas: [
      { id: "1", title: "Annadanam", amount: 501, isActive: true, order: 1 },
      { id: "2", title: "Goshala", amount: 1001, isActive: true, order: 2 },
    ],
  };

  it("preserves a deeply nested financeSettings document intact", () => {
    const row = mapSettingsDocument("financeSettings", financeSettings);
    expect(row.document_key).toBe("financeSettings");
    expect(row.data).toEqual(financeSettings);
    expect(row.data.billing.invoicePrefix).toBe("INV");
    expect(row.data.upi.id).toBe("srs@upi");
    expect(row.data.bankTransfer.ifscCode).toBe("SBIN0001234");
  });

  it("preserves arrays of nested objects without flattening", () => {
    const row = mapSettingsDocument("financeSettings", financeSettings);
    expect(Array.isArray(row.data.specialSevas)).toBe(true);
    expect(row.data.specialSevas).toHaveLength(2);
    expect(row.data.specialSevas[1]).toEqual({
      id: "2",
      title: "Goshala",
      amount: 1001,
      isActive: true,
      order: 2,
    });
  });

  it("preserves every one of the six previously-ignored settings documents", () => {
    const docs: Record<string, unknown> = {
      financeSettings,
      poojaSchedule: {
        heading: "Daily Pooja Schedule",
        morningSchedule: ["Suprabhata Seva", "Alankara"],
        eveningSchedule: ["Darshan"],
        isTempleOpen: true,
      },
      festivalCalendar: {
        heading: "Festival Calendar",
        samvatsara: "Parabhava",
        entries: [
          { id: "entry-0", date: "2026-01-01", festival: "X", festivalKannada: "Y" },
        ],
      },
      aboutUs: { heading: "About", history: "Long history", sections: [{ title: "A" }] },
      trustCommittee: { members: [{ name: "Pandit", role: "President" }] },
      guruParampara: { gurus: [{ name: "Sri Raghavendra", order: 1 }] },
    };

    for (const [key, value] of Object.entries(docs)) {
      const row = mapSettingsDocument(key, value);
      expect(row.document_key).toBe(key);
      expect(row.data).toEqual(value);
    }
  });

  it("counts top-level source fields for coverage assertions", () => {
    const row = mapSettingsDocument("financeSettings", financeSettings);
    expect(row.source_field_count).toBe(Object.keys(financeSettings).length);
  });

  it("converts embedded Firestore timestamps without dropping sibling fields", () => {
    const row = mapSettingsDocument("aboutUs", {
      heading: "About",
      updatedAt: ts(1710500000),
      nested: { inner: "value" },
    });
    expect(row.data.heading).toBe("About");
    expect(row.data.nested).toEqual({ inner: "value" });
    expect(row.data.updatedAt).toBe(new Date(1710500000 * 1000).toISOString());
    expect(row.updated_at).toBe(new Date(1710500000 * 1000).toISOString());
  });

  it("keeps nulls and empty collections rather than removing them", () => {
    const row = mapSettingsDocument("aboutUs", {
      heading: "About",
      description: null,
      tags: [],
      nested: {},
    });
    expect(row.data).toHaveProperty("description", null);
    expect(row.data.tags).toEqual([]);
    expect(row.data.nested).toEqual({});
  });

  it("does not fabricate created_at/updated_at for settings documents", () => {
    const row = mapSettingsDocument("trustCommittee", { members: [] });
    expect(row).not.toHaveProperty("created_at");
    expect(row).not.toHaveProperty("updated_at");
  });

  it("identifies the site settings document by signature and others as generic", () => {
    expect(isSiteSettingsDoc({ templeName: "Temple", contactEmail: "a@b.org" })).toBe(true);
    expect(isSiteSettingsDoc({ templeName: "Temple" })).toBe(true);
    expect(isSiteSettingsDoc(financeSettings)).toBe(false);
    expect(isSiteSettingsDoc({ heading: "About" })).toBe(false);
  });

  it("toJsonSafe walks nested arrays and objects recursively", () => {
    const result = toJsonSafe({
      a: ts(100),
      list: [ts(200), { deep: ts(300) }],
      plain: "x",
    });
    expect(result.a).toBe(new Date(100000).toISOString());
    expect(result.list[0]).toBe(new Date(200000).toISOString());
    expect(result.list[1].deep).toBe(new Date(300000).toISOString());
    expect(result.plain).toBe("x");
  });
});

// ---------------------------------------------------------------------------
// J. Field coverage of the real mapper specs
// ---------------------------------------------------------------------------

describe("field coverage of real mappers (J)", () => {
  it("accounts for every field of a realistic users document", () => {
    const observed = new Set([
      "uid",
      "name",
      "email",
      "phone",
      "role",
      "templeId",
      "profileImage",
      "isApproved",
      "isActive",
      "emailVerified",
      "lastLogin",
      "createdAt",
      "updatedAt",
    ]);
    const result = auditFieldCoverage("users", observed, CONTENT_FIELD_SPECS.users);
    expect(result.unmapped).toEqual([]);
  });

  it("accounts for every field of a realistic unknown_questions document", () => {
    const observed = new Set([
      "question",
      "questionLower",
      "timestamp",
      "sessionId",
      "detectedIntent",
      "confidence",
      "language",
      "userAgent",
      "ip",
      "expectedIntent",
      "error",
      "reviewed",
      "reviewedBy",
      "reviewedAt",
      "addedToKnowledge",
      "addedToKnowledgeArticleId",
    ]);
    const result = auditFieldCoverage("unknown_questions", observed, AI_FIELD_SPECS.unknown_questions);
    expect(result.unmapped).toEqual([]);
  });

  it("accounts for every field of a realistic latency record", () => {
    const observed = new Set([
      "sessionId",
      "messageId",
      "totalLatency",
      "intentDetectionTime",
      "retrievalTime",
      "generationTime",
      "timestamp",
      "intent",
      "success",
      "errorType",
      "model",
    ]);
    const result = auditFieldCoverage("ai_latency_records", observed, AI_FIELD_SPECS.ai_latency_records);
    expect(result.unmapped).toEqual([]);
  });

  it("accounts for every field of a realistic chat session", () => {
    const observed = new Set([
      "userId",
      "lastIntent",
      "lastTopic",
      "preferredLanguage",
      "messages",
      "createdAt",
      "updatedAt",
    ]);
    const result = auditFieldCoverage("chat_sessions", observed, AI_FIELD_SPECS.chat_sessions);
    expect(result.unmapped).toEqual([]);
  });

  it("would flag a newly added source field that the mapper ignores", () => {
    const observed = new Set([
      "name",
      "description",
      "category",
      "amount",
      "duration",
      "brandNewField",
    ]);
    const result = auditFieldCoverage("sevas", observed, CORE_FIELD_SPECS.sevas);
    expect(result.unmapped).toEqual(["brandNewField"]);
  });
});

// ---------------------------------------------------------------------------
// Mapper output shape checks for core collections
// ---------------------------------------------------------------------------

describe("core mapper output shapes (F)", () => {
  it("maps a valid seva without inventing image_url", () => {
    const row = mapSeva("s1", {
      name: "Annadanam",
      description: "Meals",
      category: "seva",
      amount: 501,
      duration: 30,
    });
    expect(row.image_url).toBeNull();
    expect(row).not.toHaveProperty("active");
  });

  it("maps a valid event preserving exact dates", () => {
    const row = mapEvent("e1", {
      title: "Aaradhane",
      description: "Annual",
      location: "Yelahanka",
      startDate: ts(1710500000),
      endDate: ts(1710586400),
      status: "published",
    });
    expect(row.start_date).toBe(new Date(1710500000 * 1000).toISOString());
    expect(row.end_date).toBe(new Date(1710586400 * 1000).toISOString());
  });

  it("maps a valid daily pooja preserving the days array", () => {
    const row = mapDailyPooja("p1", {
      title: "Suprabhata",
      description: "Morning",
      startTime: "06:00",
      duration: "30 min",
      category: "pooja",
      sevaAmount: 100,
      days: ["Mon", "Tue"],
    });
    expect(row.days).toEqual(["Mon", "Tue"]);
  });
});
