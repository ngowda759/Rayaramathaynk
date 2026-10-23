/**
 * @jest-environment node
 *
 * Unit tests for the Guru Parampara Supabase service.
 *
 * The admin page previously read and wrote `settings/guruParampara` in Firestore
 * directly from the browser. It now goes through this service behind an
 * admin-guarded route. These tests pin the parts that make that safe: the
 * document key matches the migration container, the read distinguishes "not
 * saved yet" from "read failed", a malformed payload is rejected at the boundary,
 * and — the reason this file grew — a save cannot overwrite content it did not
 * read, nor create the row from a reader that saw nothing.
 */

import {
  ABSENT_REVISION,
  computeRevision,
  GURU_PARAMPARA_DOCUMENT_KEY,
  GuruParamparaConflictError,
  GuruParamparaValidationError,
  parseGuruParamparaData,
} from "@/services/guru-parampara.service";

// `server-only` throws outside a React Server Component context; the module under
// test imports it deliberately, so stub it the same way the other server-side
// service tests do.
jest.mock("server-only", () => ({}), { virtual: true });

const mockUpsert = jest.fn();
const mockMaybeSingle = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
      upsert: mockUpsert,
    }),
  }),
}));

import { guruParamparaService } from "@/services/guru-parampara.service";

const validPayload = {
  heading: "Guru Parampara",
  headingKannada: "ಗುರು ಪರಂಪರೆ",
  subheading: "The sacred lineage",
  subheadingKannada: "ವಂಶಾವಳಿ",
  gurus: [
    { id: "1", number: "01", name: "Madwacharyaru", kannada: "ಮಧ್ವಾಚಾರ್ಯರು", description: "d" },
  ],
};

/** The stored revision for `validPayload`, as `getWithRevision` would report it. */
const storedRevision = computeRevision(validPayload);

beforeEach(() => {
  mockUpsert.mockReset();
  mockMaybeSingle.mockReset();
});

describe("document key", () => {
  it("matches the settings_documents container the migration writes", () => {
    // scripts/migrate-settings.ts and the settings_documents migration both key
    // this document as `guruParampara`; a different key would orphan the row.
    expect(GURU_PARAMPARA_DOCUMENT_KEY).toBe("guruParampara");
  });
});

describe("parseGuruParamparaData", () => {
  it("accepts a well-formed payload", () => {
    expect(parseGuruParamparaData(validPayload).gurus).toHaveLength(1);
  });

  it("rejects a non-object payload", () => {
    expect(() => parseGuruParamparaData("nope")).toThrow(GuruParamparaValidationError);
  });

  it("rejects a payload whose gurus is not an array", () => {
    expect(() => parseGuruParamparaData({ ...validPayload, gurus: {} })).toThrow(
      GuruParamparaValidationError,
    );
  });

  it("rejects a guru entry with a non-string field rather than coercing it", () => {
    expect(() =>
      parseGuruParamparaData({
        ...validPayload,
        gurus: [{ ...validPayload.gurus[0], name: 42 }],
      }),
    ).toThrow(/gurus\[0\]\.name must be a string/);
  });
});

describe("computeRevision", () => {
  it("is stable for structurally equal payloads regardless of key order", () => {
    const reordered = {
      gurus: validPayload.gurus,
      subheadingKannada: validPayload.subheadingKannada,
      heading: validPayload.heading,
      headingKannada: validPayload.headingKannada,
      subheading: validPayload.subheading,
    };
    expect(computeRevision(reordered as typeof validPayload)).toBe(storedRevision);
  });

  it("changes when the content changes", () => {
    expect(computeRevision({ ...validPayload, heading: "Other" })).not.toBe(storedRevision);
  });
});

describe("get / getWithRevision", () => {
  it("returns null and the absent revision when no document has been saved yet", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(guruParamparaService.get()).resolves.toBeNull();
    await expect(guruParamparaService.getWithRevision()).resolves.toEqual({
      data: null,
      revision: ABSENT_REVISION,
    });
  });

  it("returns the parsed document and its revision when present", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { data: validPayload }, error: null });
    await expect(guruParamparaService.getWithRevision()).resolves.toEqual({
      data: validPayload,
      revision: storedRevision,
    });
  });

  it("throws on a read failure instead of returning null", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "rls denied" } });
    await expect(guruParamparaService.get()).rejects.toThrow(/rls denied/);
  });
});

describe("save", () => {
  it("upserts on document_key when the caller presents the current revision", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { data: validPayload }, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    await guruParamparaService.save(validPayload, { expectedRevision: storedRevision });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [row, options] = mockUpsert.mock.calls[0];
    expect(options).toEqual({ onConflict: "document_key" });
    expect(row.document_key).toBe(GURU_PARAMPARA_DOCUMENT_KEY);
    expect(row.data).toEqual(validPayload);
    expect(row.source_field_count).toBe(Object.keys(validPayload).length);
  });

  it("refuses to write a malformed payload, so the row cannot be corrupted", async () => {
    await expect(
      guruParamparaService.save(
        { ...validPayload, gurus: [{ id: "1" }] },
        { expectedRevision: storedRevision },
      ),
    ).rejects.toThrow(GuruParamparaValidationError);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("throws on a write failure rather than reporting success", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { data: validPayload }, error: null });
    mockUpsert.mockResolvedValue({ error: { message: "write denied" } });
    await expect(
      guruParamparaService.save(validPayload, { expectedRevision: storedRevision }),
    ).rejects.toThrow(/write denied/);
  });

  it("refuses a save with no revision, so it cannot overwrite blindly", async () => {
    await expect(
      guruParamparaService.save(validPayload, { expectedRevision: "" }),
    ).rejects.toThrow(GuruParamparaConflictError);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("refuses a save whose revision is stale, so a concurrent edit is not lost", async () => {
    // The stored document changed after the caller read it: same shape, new heading.
    const changed = { ...validPayload, heading: "Changed elsewhere" };
    mockMaybeSingle.mockResolvedValue({ data: { data: changed }, error: null });

    await expect(
      guruParamparaService.save(validPayload, { expectedRevision: storedRevision }),
    ).rejects.toThrow(/changed since it was read/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("refuses to create the row from a reader that saw nothing (missing-data guard)", async () => {
    // This is the guruParampara hazard: no `settings_documents` row exists, the
    // page shows built-in defaults, and a save would make those defaults the
    // stored content. It must fail closed instead.
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      guruParamparaService.save(validPayload, { expectedRevision: ABSENT_REVISION }),
    ).rejects.toThrow(/Run the settings data migration/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("creates the row only when the caller explicitly permits it (owner-gated)", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    await guruParamparaService.save(validPayload, {
      expectedRevision: ABSENT_REVISION,
      allowCreate: true,
    });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0][0].data).toEqual(validPayload);
  });
});
