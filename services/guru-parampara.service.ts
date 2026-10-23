import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Guru Parampara settings, stored in Supabase `settings_documents`.
 *
 * The Firestore `settings/guruParampara` document is deeply nested (a heading
 * pair plus an ordered array of guru objects), so it is preserved in full as
 * JSONB under `document_key = 'guruParampara'` rather than normalised into
 * columns. This is the same lossless-container approach
 * `scripts/migrate-settings.ts` already uses for every non-normalised settings
 * document, and `20260922000000_create_settings_documents.sql` names
 * `guruParampara` explicitly as one of them. No new table is introduced.
 *
 * Server-only: `settings_documents` is deny-all under RLS, so this service runs
 * behind an admin-guarded route handler using the service-role client.
 */

export const GURU_PARAMPARA_DOCUMENT_KEY = "guruParampara";

export interface GuruParamparaGuru {
  id: string;
  number: string;
  name: string;
  kannada: string;
  description: string;
}

export interface GuruParamparaData {
  heading: string;
  headingKannada: string;
  subheading: string;
  subheadingKannada: string;
  gurus: GuruParamparaGuru[];
}

export class GuruParamparaValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new GuruParamparaValidationError(`${field} must be a string`);
  }
  return value;
}

function requireGuru(value: unknown, index: number): GuruParamparaGuru {
  if (!isRecord(value)) {
    throw new GuruParamparaValidationError(`gurus[${index}] must be an object`);
  }
  return {
    id: requireString(value.id, `gurus[${index}].id`),
    number: requireString(value.number, `gurus[${index}].number`),
    name: requireString(value.name, `gurus[${index}].name`),
    kannada: requireString(value.kannada, `gurus[${index}].kannada`),
    description: requireString(value.description, `gurus[${index}].description`),
  };
}

/**
 * Validate and narrow an untrusted payload into `GuruParamparaData`.
 *
 * Throws `GuruParamparaValidationError` rather than silently coercing, so a
 * malformed save is rejected at the boundary instead of being stored and
 * breaking every later read.
 */
export function parseGuruParamparaData(input: unknown): GuruParamparaData {
  if (!isRecord(input)) {
    throw new GuruParamparaValidationError("payload must be an object");
  }
  if (!Array.isArray(input.gurus)) {
    throw new GuruParamparaValidationError("gurus must be an array");
  }
  return {
    heading: requireString(input.heading, "heading"),
    headingKannada: requireString(input.headingKannada, "headingKannada"),
    subheading: requireString(input.subheading, "subheading"),
    subheadingKannada: requireString(input.subheadingKannada, "subheadingKannada"),
    gurus: input.gurus.map(requireGuru),
  };
}

/** The revision reported for a document that has never been written. */
export const ABSENT_REVISION = "absent";

/**
 * Raised when a save would overwrite content that changed since the caller read
 * it, or would create the row from a reader that never saw a stored document.
 * The route maps this to 409 so the admin reloads instead of silently losing data.
 */
export class GuruParamparaConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuruParamparaConflictError";
  }
}

/** Key-sorted JSON, so two structurally equal payloads hash the same. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/**
 * Content revision of a stored document.
 *
 * This is a *change token*, not a security control: it lets a save prove which
 * version it was derived from. The value is exposed to an already-authenticated
 * admin and reveals nothing an admin cannot read anyway.
 */
export function computeRevision(data: GuruParamparaData): string {
  return createHash("sha256").update(canonicalJson(data)).digest("hex").slice(0, 32);
}

export interface GuruParamparaReadResult {
  data: GuruParamparaData | null;
  /** `ABSENT_REVISION` when no row exists, else `computeRevision(data)`. */
  revision: string;
}

export interface SaveOptions {
  /**
   * The revision the caller read. Required: a save without it cannot prove it is
   * not overwriting a row that appeared or changed since the read, which is
   * exactly how a page showing built-in defaults would clobber live content.
   */
  expectedRevision: string;
  /**
   * Permit creating the row when the caller read `ABSENT_REVISION`.
   *
   * Defaults to `false`. Creating the row from a reader that saw nothing is the
   * "missing Supabase data" hazard: the payload is then the page's in-file
   * defaults, not migrated content. The route enables this only once the settings
   * data migration has run (owner-gated), so an accidental first save fails closed.
   */
  allowCreate?: boolean;
}

export class GuruParamparaService {
  /**
   * Read the stored document, or `null` when none has been saved yet.
   *
   * Returns `null` only for "no row". A datastore failure throws, so the caller
   * can distinguish "nothing saved" from "the read failed" - the distinction the
   * event reader previously collapsed (see `services/event.service.ts`).
   */
  async get(): Promise<GuruParamparaData | null> {
    return (await this.getWithRevision()).data;
  }

  /** `get()` plus the revision a subsequent save must present. */
  async getWithRevision(): Promise<GuruParamparaReadResult> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("settings_documents")
      .select("data")
      .eq("document_key", GURU_PARAMPARA_DOCUMENT_KEY)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read ${GURU_PARAMPARA_DOCUMENT_KEY}: ${error.message}`);
    }
    if (!data) return { data: null, revision: ABSENT_REVISION };

    const parsed = parseGuruParamparaData((data as { data: unknown }).data);
    return { data: parsed, revision: computeRevision(parsed) };
  }

  /**
   * Upsert the document, but only when the caller's revision still matches the
   * stored one and — for a create — when creating is explicitly permitted.
   *
   * The check reads then writes, so it is a *guard*, not a compare-and-swap: it
   * closes the "missing row → defaults overwrite" hazard and the ordinary
   * "edited a stale copy" hazard, but two saves issued in the same instant could
   * still interleave. Closing that fully needs a `revision` column or an RPC
   * (`... WHERE data = expected`), which is schema work and out of scope here.
   */
  async save(input: unknown, options: SaveOptions): Promise<GuruParamparaData> {
    const payload = parseGuruParamparaData(input);
    const expected = options.expectedRevision;

    if (typeof expected !== "string" || expected.length === 0) {
      throw new GuruParamparaConflictError(
        "A save must include the revision it was derived from.",
      );
    }

    const supabase = createAdminClient();
    const current = await this.getWithRevision();

    if (current.revision !== expected) {
      throw new GuruParamparaConflictError(
        `The stored ${GURU_PARAMPARA_DOCUMENT_KEY} document changed since it was read ` +
          `(expected revision ${expected}, found ${current.revision}). Reload before saving.`,
      );
    }

    if (current.data === null && options.allowCreate !== true) {
      throw new GuruParamparaConflictError(
        `No ${GURU_PARAMPARA_DOCUMENT_KEY} document exists yet. Run the settings data ` +
          "migration before saving, so the built-in defaults cannot become the stored content.",
      );
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from("settings_documents").upsert(
      {
        document_key: GURU_PARAMPARA_DOCUMENT_KEY,
        firestore_id: GURU_PARAMPARA_DOCUMENT_KEY,
        data: payload,
        source_field_count: Object.keys(payload).length,
        updated_at: now,
      },
      { onConflict: "document_key" },
    );

    if (error) {
      throw new Error(`Failed to save ${GURU_PARAMPARA_DOCUMENT_KEY}: ${error.message}`);
    }
    return payload;
  }
}

export const guruParamparaService = new GuruParamparaService();
