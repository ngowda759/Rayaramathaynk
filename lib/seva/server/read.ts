/**
 * Reading what arrives at the receipt, devotee, prasadam and gap routes: request input checked with zod, and
 * PostgREST rows checked field by field (an unexpected shape is SevaError('internal'), never trusted), plus the two
 * small shared reads (staff names, the cancel and prasadam-undo times). No heavy imports, so the public receipt reader
 * can use it without the route guard.
 */

import "server-only";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { SevaError } from "@/lib/seva/errors";
import { toPaise } from "@/lib/seva/money";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------------------------------------------
// Request input
// ---------------------------------------------------------------------------------------------------------------

/**
 * Parses a request value with a zod schema; the first issue becomes SevaError('validation') whose detail names the
 * field and carries the schema's plain-English message.
 */
export function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue && issue.path.length > 0 ? issue.path.map(String).join(".") : "body";
  throw new SevaError("validation", { field, message: issue?.message ?? "Check the form and try again." });
}

/** The JSON body of a request; a body that is not JSON is a validation error. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return (await req.json()) as unknown;
  } catch {
    throw new SevaError("validation", { field: "body", message: "The request body is not valid JSON." });
  }
}

/** The named query parameters that carry a value; blank ones are left out. */
export function queryOf(req: NextRequest, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = req.nextUrl.searchParams.get(key);
    if (value !== null && value.trim() !== "") out[key] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Database rows
// ---------------------------------------------------------------------------------------------------------------

export type Row = Record<string, unknown>;

export function isRow(value: unknown): value is Row {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function rowsOf(result: { data: unknown; error: unknown }): Row[] {
  if (result.error) throw new SevaError("internal");
  if (result.data === null || result.data === undefined) return [];
  if (!Array.isArray(result.data) || !result.data.every(isRow)) throw new SevaError("internal");
  return result.data;
}

export function rowOf(result: { data: unknown; error: unknown }): Row | null {
  if (result.error) throw new SevaError("internal");
  if (result.data === null || result.data === undefined) return null;
  if (!isRow(result.data)) throw new SevaError("internal");
  return result.data;
}

export function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new SevaError("internal");
  return value;
}

export function textOrNull(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new SevaError("internal");
  return value;
}

export function int(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isInteger(value)) throw new SevaError("internal");
  return value;
}

export function intOrNull(row: Row, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) throw new SevaError("internal");
  return value;
}

/** A numeric(…, 2) column (PostgREST answers a number, or a string for very large values) to paise. */
export function paise(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number" && typeof value !== "string") throw new SevaError("internal");
  try {
    return toPaise(value);
  } catch {
    throw new SevaError("internal");
  }
}

/** One of a fixed list of text values. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new SevaError("internal");
  return value as T;
}

/** An embedded many-to-one resource (`seva_orders!inner(...)`). */
export function embedded(row: Row, key: string): Row {
  const value = row[key];
  if (!isRow(value)) throw new SevaError("internal");
  return value;
}

/** An embedded one-to-many resource (`lines:seva_receipt_lines(...)`), sorted by `line_no`. */
export function embeddedLines(row: Row, key: string): Row[] {
  const value = row[key] ?? [];
  if (!Array.isArray(value) || !value.every(isRow)) throw new SevaError("internal");
  return [...value].sort((a, b) => int(a, "line_no") - int(b, "line_no"));
}

// ---------------------------------------------------------------------------------------------------------------
// Shared reads
// ---------------------------------------------------------------------------------------------------------------

/** Full names by staff id, read once for every id that is not null. */
export async function staffNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === "string" && id !== ""))];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  const rows = rowsOf(await createAdminClient().from("staff").select("id, full_name").in("id", unique));
  for (const row of rows) names.set(text(row, "id"), text(row, "full_name"));
  return names;
}

/** The cancel window in minutes and the prasadam undo time in seconds (seva_settings, id 1; defaults 30 and 120). */
export async function readTimeRules(): Promise<{ cancelWindowMinutes: number; prasadamUndoSeconds: number }> {
  const row = rowOf(
    await createAdminClient()
      .from("seva_settings")
      .select("cancel_window_minutes, prasadam_undo_seconds")
      .eq("id", 1)
      .maybeSingle(),
  );
  return {
    cancelWindowMinutes: (row && intOrNull(row, "cancel_window_minutes")) ?? 30,
    prasadamUndoSeconds: (row && intOrNull(row, "prasadam_undo_seconds")) ?? 120,
  };
}
