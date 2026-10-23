/**
 * @jest-environment node
 *
 * Unit tests for the Guru Parampara Supabase service.
 *
 * The admin page previously read and wrote `settings/guruParampara` in Firestore
 * directly from the browser. It now goes through this service behind an
 * admin-guarded route. These tests pin the parts that make that safe: the
 * document key matches the migration container, the read distinguishes "not
 * saved yet" from "read failed", the save is an idempotent upsert, and a
 * malformed payload is rejected at the boundary rather than stored.
 */

import {
  GURU_PARAMPARA_DOCUMENT_KEY,
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

describe("get", () => {
  it("returns null when no document has been saved yet", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(guruParamparaService.get()).resolves.toBeNull();
  });

  it("returns the parsed document when present", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { data: validPayload }, error: null });
    await expect(guruParamparaService.get()).resolves.toEqual(validPayload);
  });

  it("throws on a read failure instead of returning null", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "rls denied" } });
    await expect(guruParamparaService.get()).rejects.toThrow(/rls denied/);
  });
});

describe("save", () => {
  it("upserts on document_key so a re-save updates rather than duplicates", async () => {
    mockUpsert.mockResolvedValue({ error: null });
    await guruParamparaService.save(validPayload);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [row, options] = mockUpsert.mock.calls[0];
    expect(options).toEqual({ onConflict: "document_key" });
    expect(row.document_key).toBe(GURU_PARAMPARA_DOCUMENT_KEY);
    expect(row.data).toEqual(validPayload);
    expect(row.source_field_count).toBe(Object.keys(validPayload).length);
  });

  it("refuses to write a malformed payload, so the row cannot be corrupted", async () => {
    await expect(
      guruParamparaService.save({ ...validPayload, gurus: [{ id: "1" }] }),
    ).rejects.toThrow(GuruParamparaValidationError);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("throws on a write failure rather than reporting success", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "write denied" } });
    await expect(guruParamparaService.save(validPayload)).rejects.toThrow(/write denied/);
  });
});
