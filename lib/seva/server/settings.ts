/**
 * The seva settings repository (DB §13.2-13.4): slip template, counter rules, cash denominations, festival days and
 * counters. Writes go through the A2-3 SQL functions (each writes its own audit row); reads use the service-role
 * client. The switches `cash_difference_note_required` and `amount_change_reason_required` are never read or written
 * here: the owner decided both are always required and the table checks enforce it.
 */

import "server-only";
import { z } from "zod";
import { SevaError } from "@/lib/seva/errors";
import { fromPaise } from "@/lib/seva/money";
import type { CounterRequest, DenominationsRequest, FestivalRequest, SettingsPatch } from "@/lib/seva/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SlipSettings } from "@/types/seva";
import { numericToPaise, parseSevaInput } from "./catalogue";
import { callRpc } from "./rpc";

type Row = Record<string, unknown>;

function rowsOf(result: { data: unknown; error: unknown }): Row[] {
  if (result.error) throw new SevaError("internal");
  return Array.isArray(result.data) ? (result.data as Row[]) : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function int(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new SevaError("internal");
  return value;
}

// ---------------------------------------------------------------------------------------------------------------
// Settings row: the slip template and the counter rules are two pages over the one seva_settings row
// ---------------------------------------------------------------------------------------------------------------

/** Wire key -> column. A wire key not listed for a page is refused on that page. */
export const TEMPLATE_KEYS = {
  templeNameEn: "temple_name_en",
  templeNameKn: "temple_name_kn",
  addressLine1: "address_line1",
  addressLine2: "address_line2",
  registrationLine: "registration_line",
  photoLeftUrl: "photo_left_url",
  photoRightUrl: "photo_right_url",
  footerLine1: "footer_line1",
  footerLine2: "footer_line2",
  footerBlessing: "footer_blessing",
  printGotra: "print_gotra",
  printNakshatra: "print_nakshatra",
  printRashi: "print_rashi",
} as const satisfies Partial<Record<keyof SettingsPatch, string>>;

export const RULES_KEYS = {
  cancelWindowMinutes: "cancel_window_minutes",
  counterDaysAhead: "counter_days_ahead",
  onlineDaysAhead: "online_days_ahead",
  onlineSameDayCutoff: "online_same_day_cutoff",
  prasadamUndoSeconds: "prasadam_undo_seconds",
  dayCloseFlagThresholdPaise: "day_close_flag_threshold",
  tallyCashLedger: "tally_cash_ledger",
  tallyUpiLedger: "tally_upi_ledger",
  tallyOnlineLedger: "tally_online_ledger",
  tallyColumns: "tally_columns",
} as const satisfies Partial<Record<keyof SettingsPatch, string>>;

export type SettingsPage = "template" | "rules";

export interface CounterRules {
  cancelWindowMinutes: number;
  counterDaysAhead: number;
  onlineDaysAhead: number;
  onlineSameDayCutoff: string;
  prasadamUndoSeconds: number;
  dayCloseFlagThresholdPaise: number;
  tallyCashLedger: string;
  tallyUpiLedger: string;
  tallyOnlineLedger: string;
  tallyColumns: Record<string, string> | null;
}

async function readSettingsRow(columns: string): Promise<Row> {
  const result = await createAdminClient().from("seva_settings").select(columns).eq("id", 1).maybeSingle();
  if (result.error) throw new SevaError("internal");
  if (!result.data) throw new SevaError("not_found", { entity: "seva_settings" });
  return result.data as unknown as Row;
}

export async function getTemplate(): Promise<SlipSettings> {
  const row = await readSettingsRow(Object.values(TEMPLATE_KEYS).join(", "));
  return {
    templeNameEn: str(row.temple_name_en) ?? "",
    templeNameKn: str(row.temple_name_kn) ?? "",
    addressLine1: str(row.address_line1) ?? "",
    addressLine2: str(row.address_line2) ?? "",
    registrationLine: str(row.registration_line),
    photoLeftUrl: str(row.photo_left_url),
    photoRightUrl: str(row.photo_right_url),
    footerLine1: str(row.footer_line1) ?? "",
    footerLine2: str(row.footer_line2) ?? "",
    footerBlessing: str(row.footer_blessing) ?? "",
    printGotra: row.print_gotra === true,
    printNakshatra: row.print_nakshatra === true,
    printRashi: row.print_rashi === true,
  };
}

function tallyColumns(value: unknown): Record<string, string> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, text] of Object.entries(value as Row)) if (typeof text === "string") out[key] = text;
  return out;
}

export async function getRules(): Promise<CounterRules> {
  const row = await readSettingsRow(Object.values(RULES_KEYS).join(", "));
  return {
    cancelWindowMinutes: int(row.cancel_window_minutes),
    counterDaysAhead: int(row.counter_days_ahead),
    onlineDaysAhead: int(row.online_days_ahead),
    // Postgres `time` reads as 'HH:MM:SS'; the wire form is 'HH:MM'.
    onlineSameDayCutoff: (str(row.online_same_day_cutoff) ?? "").slice(0, 5),
    prasadamUndoSeconds: int(row.prasadam_undo_seconds),
    dayCloseFlagThresholdPaise: numericToPaise(row.day_close_flag_threshold),
    tallyCashLedger: str(row.tally_cash_ledger) ?? "",
    tallyUpiLedger: str(row.tally_upi_ledger) ?? "",
    tallyOnlineLedger: str(row.tally_online_ledger) ?? "",
    tallyColumns: tallyColumns(row.tally_columns),
  };
}

/** Saves a settings patch from one page; a key that belongs to the other page is refused. */
export async function saveSettings(page: SettingsPage, patch: SettingsPatch, staffId: string): Promise<void> {
  const columns: Record<string, string> = page === "template" ? TEMPLATE_KEYS : RULES_KEYS;
  const p_patch: Row = {};
  for (const [key, value] of Object.entries(patch)) {
    const column = columns[key];
    if (!column) throw new SevaError("validation", { field: key, message: "This setting is not on this page." });
    p_patch[column] = key === "dayCloseFlagThresholdPaise" && typeof value === "number" ? fromPaise(value) : value;
  }
  await callRpc<unknown>("seva_update_settings", { p_patch, p_staff_id: staffId });
}

// ---------------------------------------------------------------------------------------------------------------
// Cash denominations
// ---------------------------------------------------------------------------------------------------------------

export async function getDenominations(): Promise<DenominationsRequest> {
  const result = await createAdminClient()
    .from("cash_denominations")
    .select("kind, value, display_order, shown")
    .order("display_order", { ascending: true });
  return {
    items: rowsOf(result).map((row) => {
      if (row.kind !== "note" && row.kind !== "coin") throw new SevaError("internal");
      return { kind: row.kind, valuePaise: numericToPaise(row.value), displayOrder: int(row.display_order), shown: row.shown === true };
    }),
  };
}

/** Replaces the denominations; the SQL function takes them in display order. */
export async function saveDenominations(input: DenominationsRequest, staffId: string): Promise<void> {
  const p_rows = [...input.items]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((item) => ({ kind: item.kind, value: fromPaise(item.valuePaise), shown: item.shown }));
  await callRpc<unknown>("seva_save_denominations", { p_rows, p_staff_id: staffId });
}

// ---------------------------------------------------------------------------------------------------------------
// Festival days
// ---------------------------------------------------------------------------------------------------------------

export interface FestivalItem {
  id: string;
  nameEn: string;
  nameKn: string | null;
  active: boolean;
  dates: string[];
}

export async function listFestivals(): Promise<FestivalItem[]> {
  const result = await createAdminClient()
    .from("festival_days")
    .select("id, name_en, name_kn, active, festival_day_dates(day)")
    .order("name_en", { ascending: true });
  return rowsOf(result).map((row) => {
    if (typeof row.id !== "string") throw new SevaError("internal");
    const days = Array.isArray(row.festival_day_dates) ? (row.festival_day_dates as Row[]) : [];
    return {
      id: row.id,
      nameEn: str(row.name_en) ?? "",
      nameKn: str(row.name_kn),
      active: row.active === true,
      dates: days.map((d) => str(d.day)).filter((d): d is string => d !== null).sort(),
    };
  });
}

export async function saveFestival(input: FestivalRequest, id: string | undefined, staffId: string): Promise<{ id: string }> {
  const p_festival: Row = {};
  if (id) p_festival.id = id;
  p_festival.name_en = input.nameEn;
  p_festival.name_kn = input.nameKn;
  p_festival.active = input.active;
  p_festival.days = input.dates;
  const saved = await callRpc<unknown>("seva_save_festival", { p_festival, p_staff_id: staffId });
  if (typeof saved !== "string") throw new SevaError("internal");
  return { id: saved };
}

// ---------------------------------------------------------------------------------------------------------------
// Counters
// ---------------------------------------------------------------------------------------------------------------

export interface CounterItem {
  id: number;
  name: string;
  place: string | null;
  openingFloatPaise: number;
  active: boolean;
  onlineSeries: string | null;
  offlineSeries: string | null;
}

/** Counter ids in a path: 1..99. */
export const counterIdSchema = z.coerce.number().int().min(1).max(99);

export function parseCounterId(raw: string): number {
  return parseSevaInput(counterIdSchema, raw.trim() === "" ? Number.NaN : raw);
}

export async function listCounters(): Promise<CounterItem[]> {
  const supabase = createAdminClient();
  const [counters, series] = await Promise.all([
    supabase.from("counters").select("id, name, place, opening_float, active").order("id", { ascending: true }),
    supabase.from("receipt_series").select("code, kind, counter_id"),
  ]);
  const seriesRows = rowsOf(series);
  const seriesOf = (counterId: number, kind: string) =>
    str(seriesRows.find((s) => s.counter_id === counterId && s.kind === kind)?.code);
  return rowsOf(counters).map((row) => {
    const id = int(row.id);
    return {
      id,
      name: str(row.name) ?? "",
      place: str(row.place),
      openingFloatPaise: numericToPaise(row.opening_float),
      active: row.active === true,
      onlineSeries: seriesOf(id, "counter_online"),
      offlineSeries: seriesOf(id, "counter_offline"),
    };
  });
}

export interface NewCounter {
  id: number;
  onlineSeries: string;
  offlineSeries: string;
}

/** Adds the next counter with its series C<n> (online) and OF<n> (offline). */
export async function addCounter(input: Pick<CounterRequest, "name" | "place">, staffId: string): Promise<NewCounter> {
  const id = await callRpc<unknown>("seva_add_counter", { p_name: input.name, p_place: input.place, p_staff_id: staffId });
  if (typeof id !== "number" || !Number.isInteger(id)) throw new SevaError("internal");
  return { id, onlineSeries: `C${id}`, offlineSeries: `OF${id}` };
}

export async function updateCounter(counterId: number, patch: Partial<CounterRequest>, staffId: string): Promise<void> {
  const p_patch: Row = {};
  if (patch.name !== undefined) p_patch.name = patch.name;
  if (patch.place !== undefined) p_patch.place = patch.place;
  if (patch.openingFloatPaise !== undefined) p_patch.opening_float = fromPaise(patch.openingFloatPaise);
  if (patch.active !== undefined) p_patch.active = patch.active;
  await callRpc<unknown>("seva_update_counter", { p_counter_id: counterId, p_patch, p_staff_id: staffId });
}
