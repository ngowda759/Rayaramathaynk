import "server-only";

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

export class GuruParamparaService {
  /**
   * Read the stored document, or `null` when none has been saved yet.
   *
   * Returns `null` only for "no row". A datastore failure throws, so the caller
   * can distinguish "nothing saved" from "the read failed" - the distinction the
   * event reader previously collapsed (see `services/event.service.ts`).
   */
  async get(): Promise<GuruParamparaData | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("settings_documents")
      .select("data")
      .eq("document_key", GURU_PARAMPARA_DOCUMENT_KEY)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read ${GURU_PARAMPARA_DOCUMENT_KEY}: ${error.message}`);
    }
    if (!data) return null;

    return parseGuruParamparaData((data as { data: unknown }).data);
  }

  /** Upsert the document. Idempotent on `document_key`. */
  async save(input: unknown): Promise<GuruParamparaData> {
    const payload = parseGuruParamparaData(input);
    const now = new Date().toISOString();
    const supabase = createAdminClient();

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
