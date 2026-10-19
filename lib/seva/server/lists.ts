/**
 * The devotee lists repository (plan A4P-5): the gotra, nakshatra and rashi lists temple admins keep, in table
 * seva_list_items. Reads and writes go through the SQL functions seva_list_items_get() and seva_list_item_save(),
 * which check the rules (nakshatra and rashi names are fixed, no duplicate gotra names, nothing deleted) and write the
 * audit row. Which role may call what is checked by the route.
 */

import "server-only";
import { SevaError } from "@/lib/seva/errors";
import type { ListItemSaveRequest } from "@/lib/seva/schemas";
import type { SevaListItem, SevaListKind, SevaLists } from "@/types/seva";
import { callRpc } from "./rpc";

type Row = Record<string, unknown>;

const LIST_OF: Record<SevaListKind, keyof SevaLists> = { gotra: "gotras", nakshatra: "nakshatras", rashi: "rashis" };

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function kindOf(value: unknown): SevaListKind {
  if (value === "gotra" || value === "nakshatra" || value === "rashi") return value;
  throw new SevaError("internal");
}

function intOf(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new SevaError("internal");
  return value;
}

/** One row as the SQL functions return it (snake_case) to the wire shape. */
function toItem(row: Row): { kind: SevaListKind; item: SevaListItem } {
  if (typeof row.name_en !== "string") throw new SevaError("internal");
  return {
    kind: kindOf(row.kind),
    item: {
      id: intOf(row.item_id),
      nameEn: row.name_en,
      nameKn: typeof row.name_kn === "string" ? row.name_kn : null,
      knChecked: row.kn_checked === true,
      active: row.active !== false,
      displayOrder: intOf(row.display_order),
    },
  };
}

/** Every list item, grouped by list, in display order (hidden gotras included; the counter leaves them out). */
export async function readLists(): Promise<SevaLists> {
  const answer = await callRpc<unknown>("seva_list_items_get", {});
  if (!Array.isArray(answer)) throw new SevaError("internal");
  const lists: SevaLists = { gotras: [], nakshatras: [], rashis: [] };
  for (const value of answer) {
    if (!isRow(value)) throw new SevaError("internal");
    const { kind, item } = toItem(value);
    lists[LIST_OF[kind]].push(item);
  }
  return lists;
}

/** Adds a gotra or changes one list item as `staffId`; returns the saved item. */
export async function saveListItem(
  input: ListItemSaveRequest,
  staffId: string,
): Promise<{ kind: SevaListKind; item: SevaListItem }> {
  const p_item: Row = { kind: input.kind };
  if (input.id !== undefined) p_item.item_id = input.id;
  if (input.kind === "gotra") {
    if (input.nameEn !== undefined) p_item.name_en = input.nameEn;
    if (input.nameKn !== undefined) p_item.name_kn = input.nameKn;
    if (input.active !== undefined) p_item.active = input.active;
  } else {
    p_item.name_kn = input.nameKn;
  }
  const saved = await callRpc<unknown>("seva_list_item_save", { p_item, p_staff_id: staffId });
  if (!isRow(saved)) throw new SevaError("internal");
  return toItem(saved);
}
