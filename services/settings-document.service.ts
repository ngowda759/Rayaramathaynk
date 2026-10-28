import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Website settings documents, stored in Supabase `settings_documents`.
 *
 * Every admin-editable website settings page (About Us, Facilities, Trust
 * Committee, Future Plans, Pooja Schedule, Festival Calendar, Ekadashi Calendar,
 * Footer, Homepage) previously read and wrote the Firestore `settings` collection
 * with one document per key. Those documents are deeply nested, so they are kept
 * whole as JSONB under `document_key` rather than normalised into columns — the
 * same lossless container `services/guru-parampara.service.ts` and
 * `services/homepage.service.ts` already use. No new table is introduced.
 *
 * `settings_documents` is deny-all under RLS, so this module is server-only and
 * runs behind an admin-guarded route handler with the service-role client. There
 * is no Firestore path.
 */

/** The document keys the application reads, matching each admin page's `DOCUMENT`. */
export const SETTINGS_DOCUMENT_KEYS = [
  "aboutUs",
  "facilities",
  "trustCommittee",
  "futurePlans",
  "poojaSchedule",
  "festivalCalendar",
  "ekadashiCalendar",
  "footer",
  "socialLinks",
  "shlokas",
  "financeSettings",
  "device",
] as const;

export type SettingsDocumentKey = (typeof SETTINGS_DOCUMENT_KEYS)[number];

export function isSettingsDocumentKey(value: string): value is SettingsDocumentKey {
  return (SETTINGS_DOCUMENT_KEYS as readonly string[]).includes(value);
}

/** Read a settings document. Returns `null` when the row has not been created yet. */
export async function getSettingsDocument<T = Record<string, unknown>>(
  key: SettingsDocumentKey
): Promise<T | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("settings_documents")
    .select("data")
    .eq("document_key", key)
    .maybeSingle();

  if (error) throw new Error(`Could not read ${key} settings: ${error.message}`);
  return data ? (data.data as T) : null;
}

/** Upsert a settings document, preserving any keys the caller does not send. */
export async function saveSettingsDocument(
  key: SettingsDocumentKey,
  data: Record<string, unknown>
): Promise<void> {
  const existing = await getSettingsDocument<Record<string, unknown>>(key);
  const merged = { ...(existing ?? {}), ...data };

  const supabase = createAdminClient();
  const { error } = await supabase.from("settings_documents").upsert(
    {
      document_key: key,
      data: merged,
      source_field_count: Object.keys(merged).length,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "document_key" }
  );
  if (error) throw new Error(`Could not save ${key} settings: ${error.message}`);
}
