import type { SupabaseClient } from "@supabase/supabase-js";

// These helpers are pure id handling and take a caller-supplied client, so they are
// safe in either bundle. The `server-only` guard lives on the service-role client
// module itself (`lib/supabase/admin.ts`), which is what must never reach a browser.

/** A UUID, including the all-zero UUID some legacy rows carry. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * The public API hands out a row's `firestore_id` when it has one and its primary key
 * otherwise, so an id arriving from a browser may be either. A fresh Supabase dataset
 * has no `firestore_id` at all, so matching on `firestore_id` alone silently updates
 * nothing.
 *
 * Use this in a `.or()` filter to match whichever column actually holds the id.
 */
export function rowIdFilter(id: string): string {
  return isUuid(id) ? `id.eq.${id}` : `firestore_id.eq.${id}`;
}

/**
 * Look up a single row by a public id that may be either the primary key or the
 * nullable `firestore_id`. Returns `null` when the row does not exist.
 */
export async function findRowByPublicId<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  id: string,
  columns = "*"
): Promise<T | null> {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .or(rowIdFilter(id))
    .maybeSingle();
  if (error) throw new Error(`Could not read ${table}: ${error.message}`);
  return (data as T | null) ?? null;
}

/**
 * Resolve a public id to the row's primary key. Callers that write a foreign key
 * (or that must target exactly one row) need the uuid, not the public id.
 */
export async function resolveRowUuid(
  supabase: SupabaseClient,
  table: string,
  id: string
): Promise<string | null> {
  const row = await findRowByPublicId<{ id: string }>(supabase, table, id, "id");
  return row?.id ?? null;
}
