/**
 * The seva catalogue repository (DB §7.1, §13.1): the list, create and edit, counter-key order and rate history.
 * Writes go through the A2-3 SQL functions; reads use the service-role client. After every successful
 * `seva_upsert_seva` the public fields are mirrored to Firestore `sevas/{firestore_id}` for the readers that have not
 * moved to Supabase yet (C-39). A mirror failure never undoes the Supabase save: the caller gets `mirror: 'failed'`
 * and the log carries the seva id only.
 */

import "server-only";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/admin-firebase";
import { SevaError } from "@/lib/seva/errors";
import { fromPaise, toPaise } from "@/lib/seva/money";
import type { SevaUpsert } from "@/lib/seva/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CatalogueSeva } from "@/types/seva";
import type { RateHistoryEntry, SaveSevaResult } from "@/types/seva-settings";
import { callRpc } from "./rpc";

export type { RateHistoryEntry, SaveSevaResult };

/** Ids the database made (any 8-4-4-4-12 hex form, as the shared schemas accept). */
export const sevaDbIdSchema = z.guid();

/**
 * The zod check and the JSON body, under the names the catalogue and settings routes import. One implementation, in
 * read.ts: the schema's first issue, and a body that is not JSON, are SevaError('validation') naming the field.
 */
export { parseInput as parseSevaInput, readJson as readJsonBody } from "./read";

/** Reads one Supabase result, turning a database error into SevaError('internal') (the details are not logged). */
function rowsOf(result: { data: unknown; error: unknown }): Record<string, unknown>[] {
  if (result.error) throw new SevaError("internal");
  return Array.isArray(result.data) ? (result.data as Record<string, unknown>[]) : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** A numeric column (PostgREST answers numbers, or strings for very large values) to paise. */
export function numericToPaise(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") throw new SevaError("internal");
  try {
    return toPaise(value);
  } catch {
    throw new SevaError("internal");
  }
}

const CATALOGUE_COLUMNS =
  "id, code, display_order, name, name_kn, amount, any_amount, multi_date, allow_amount_change, prasadam_given, " +
  "prasadam_items, visibility, active, category, income_ledger";

function toCatalogueSeva(row: Record<string, unknown>): CatalogueSeva {
  const visibility = row.visibility;
  if (typeof row.id !== "string" || (visibility !== "counter" && visibility !== "online" && visibility !== "both")) {
    throw new SevaError("internal");
  }
  return {
    id: row.id,
    code: str(row.code),
    key: typeof row.display_order === "number" ? row.display_order : 0,
    nameEn: str(row.name) ?? "",
    nameKn: str(row.name_kn),
    ratePaise: row.any_amount === true ? null : numericToPaise(row.amount),
    multiDate: row.multi_date === true,
    allowAmountChange: row.allow_amount_change === true,
    prasadamGiven: row.prasadam_given === true,
    prasadamItems: str(row.prasadam_items),
    visibility,
    active: row.active === true,
    category: str(row.category) ?? "",
    incomeLedger: str(row.income_ledger),
  };
}

/** Every seva, switched-off ones included, in counter-key order. */
export async function listCatalogue(): Promise<CatalogueSeva[]> {
  const result = await createAdminClient()
    .from("sevas")
    .select(CATALOGUE_COLUMNS)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  return rowsOf(result).map(toCatalogueSeva);
}

/** The wire seva to the `p_seva` payload of seva_upsert_seva (snake_case, rupee strings). */
function toUpsertPayload(seva: SevaUpsert, id: string | undefined): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (id) payload.id = id;
  payload.code = seva.code;
  payload.name_en = seva.nameEn;
  payload.name_kn = seva.nameKn;
  // An any-amount seva has no rate; the function keeps 0 for a new one and the stored value for an existing one.
  if (seva.ratePaise !== null) payload.amount = fromPaise(seva.ratePaise);
  payload.visibility = seva.visibility;
  payload.multi_date = seva.multiDate;
  payload.allow_amount_change = seva.allowAmountChange;
  payload.any_amount = seva.anyAmount;
  payload.prasadam_given = seva.prasadamGiven;
  payload.prasadam_items = seva.prasadamItems;
  payload.category = seva.category;
  payload.income_ledger = seva.incomeLedger;
  payload.active = seva.active;
  if (seva.key !== undefined) payload.display_order = seva.key;
  return payload;
}

/**
 * The public fields other Firestore readers use (R3 2.1). A counter-only seva is not offered on the website, so it is
 * mirrored as not active there.
 */
function toMirrorDoc(row: Record<string, unknown>): Record<string, unknown> {
  const amount = typeof row.amount === "string" ? Number(row.amount) : row.amount;
  return {
    name: str(row.name) ?? "",
    description: str(row.description) ?? "",
    amount: typeof amount === "number" && Number.isFinite(amount) ? amount : 0,
    active: row.active === true && row.visibility !== "counter",
    displayOrder: typeof row.display_order === "number" ? row.display_order : 0,
    category: str(row.category) ?? "",
    duration: typeof row.duration === "number" ? row.duration : 0,
    imageUrl: str(row.image_url) ?? "",
    updatedAt: str(row.updated_at) ?? new Date().toISOString(),
  };
}

/**
 * Writes the seva's public fields to Firestore `sevas/{firestore_id}`. The Firestore id is set by seva_upsert_seva
 * (a new seva takes its own id), so this never writes the table. Answers false, after logging the seva id, when any
 * step fails - a saved seva without a Firestore id included.
 */
async function mirrorToFirestore(id: string): Promise<boolean> {
  try {
    const read = await createAdminClient()
      .from("sevas")
      .select("id, firestore_id, name, description, amount, active, visibility, display_order, category, duration, image_url, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (read.error || !read.data) throw new Error("seva row not readable");
    const row = read.data as Record<string, unknown>;
    const firestoreId = str(row.firestore_id);
    if (!firestoreId) throw new Error("seva has no firestore_id");

    const firestore = await getAdminFirestore();
    await firestore.collection("sevas").doc(firestoreId).set(toMirrorDoc(row), { merge: true });
    return true;
  } catch {
    console.error("[seva] Firestore sevas mirror failed for seva", id);
    return false;
  }
}

/** Creates (no id) or updates one seva, then mirrors it to Firestore. `reason` is required by SQL for a rate change. */
export async function saveSeva(seva: SevaUpsert, id: string | undefined, staffId: string): Promise<SaveSevaResult> {
  const reason = seva.reason && seva.reason.length > 0 ? seva.reason : null;
  const savedId = await callRpc<unknown>("seva_upsert_seva", {
    p_seva: toUpsertPayload(seva, id),
    p_reason: reason,
    p_staff_id: staffId,
  });
  if (typeof savedId !== "string") throw new SevaError("internal");
  const mirrored = await mirrorToFirestore(savedId);
  return { id: savedId, mirror: mirrored ? "ok" : "failed" };
}

/** Renumbers the counter keys 1..n in the given order (sevas not listed follow). */
export async function reorderSevas(ids: string[], staffId: string): Promise<void> {
  await callRpc<unknown>("seva_reorder_sevas", { p_ids: ids, p_staff_id: staffId });
}

/** The seva's rate changes, newest first; `by` is the staff member's name ('' when not recorded). */
export async function rateHistory(sevaId: string): Promise<RateHistoryEntry[]> {
  const result = await createAdminClient()
    .from("seva_rate_history")
    .select("old_amount, new_amount, reason, changed_at, staff(full_name)")
    .eq("seva_id", sevaId)
    .order("changed_at", { ascending: false });
  return rowsOf(result).map((row) => {
    const staff = row.staff as { full_name?: unknown } | null | undefined;
    return {
      oldPaise: row.old_amount === null || row.old_amount === undefined ? null : numericToPaise(row.old_amount),
      newPaise: numericToPaise(row.new_amount),
      reason: str(row.reason) ?? "",
      by: staff && typeof staff.full_name === "string" ? staff.full_name : "",
      at: str(row.changed_at) ?? "",
    };
  });
}
