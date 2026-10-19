"use client";

import { useState, type DragEvent, type JSX } from "react";
import { AnimatePresence, m } from "framer-motion";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatRupees } from "@/lib/seva/money";
import { SETTINGS_TEXT as T, VISIBILITY_CELL } from "@/lib/seva/strings/settings";
import { cn } from "@/lib/utils";
import type { CatalogueSeva } from "@/types/seva";

import { LIST_ROW } from "./listMotion";

export interface SevaTableProps {
  /** In counter-key order. */
  sevas: CatalogueSeva[];
  /** Temple admins and super admins (sevas.edit); view-only temple admins only look. */
  editable: boolean;
  busy: boolean;
  onEdit(seva: CatalogueSeva): void;
  /** The ids in the new counter-key order 1..n. */
  onReorder(ids: string[]): void;
  onToggleActive(seva: CatalogueSeva, active: boolean): void;
}

/** Moves the item at `from` to `to` and answers the new list (pure). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function rateCell(seva: CatalogueSeva): string {
  if (seva.ratePaise === null) return T.anyAmountCell;
  return formatRupees(seva.ratePaise, { decimals: seva.ratePaise % 100 !== 0 }).replace(/^Rs /, "");
}

const TH = "px-3 py-2.5 text-left text-(length:--text-meta) font-semibold text-(--muted-foreground) align-bottom";
const TD = "px-3 py-3 align-top";

/**
 * The seva list (DB §13.1, mockup `#sevas`): Key (drag to reorder - it is the number pressed at the counter), Code,
 * Seva (English, Kannada under), Rate, Counter / online, Several dates, Prasadam, Active and Edit. Rows also move
 * with the Move up / Move down buttons, so the order can be changed from the keyboard.
 */
export function SevaTable({ sevas, editable, busy, onEdit, onReorder, onToggleActive }: SevaTableProps): JSX.Element {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const canMove = editable && !busy;

  function move(from: number, to: number): void {
    if (!canMove || from === to) return;
    onReorder(moveItem(sevas, from, to).map((s) => s.id));
  }

  function onDragStart(e: DragEvent<HTMLTableRowElement>, index: number): void {
    if (!canMove) return;
    setDragging(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function onDrop(e: DragEvent<HTMLTableRowElement>, index: number): void {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    const from = dragging ?? (raw === "" ? -1 : Number(raw));
    setDragging(null);
    setOver(null);
    if (from >= 0) move(from, index);
  }

  return (
    <div className="flex flex-col gap-2">
      {editable ? <p className="text-(length:--text-meta) text-(--muted-foreground)">{T.dragHint}</p> : null}
      <div className="overflow-x-auto rounded-(--radius-surface) border border-(--border) bg-(--card)">
        <table className="w-full min-w-[860px] border-collapse text-(length:--text-ui)" data-testid="seva-table">
          <thead className="border-b border-(--border)">
            <tr>
              <Bilingual as="th" en={T.colKey.en} kn={T.colKey.kn} className={TH} />
              <Bilingual as="th" en={T.colCode.en} kn={T.colCode.kn} className={TH} />
              <Bilingual as="th" en={T.colSeva.en} kn={T.colSeva.kn} className={TH} />
              <Bilingual as="th" en={T.colRate.en} kn={T.colRate.kn} className={cn(TH, "text-right")} />
              <Bilingual as="th" en={T.colShownOn.en} kn={T.colShownOn.kn} className={TH} />
              <Bilingual as="th" en={T.colSeveralDates.en} kn={T.colSeveralDates.kn} className={TH} />
              <Bilingual as="th" en={T.colPrasadam.en} kn={T.colPrasadam.kn} className={TH} />
              <Bilingual as="th" en={T.colActive.en} kn={T.colActive.kn} className={TH} />
              <th className={TH}>
                <span className="sr-only">{T.edit}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {/* A reordered row slides to its new key; an added seva springs in (plan A4P-4). The native drag start
                and end go on the capture listeners: motion components keep onDragStart / onDragEnd for their own
                drag gesture and would not pass them to the row. */}
            <AnimatePresence initial={false}>
              {sevas.map((seva, index) => (
                <m.tr
                  key={seva.id}
                  {...LIST_ROW}
                  data-testid={`seva-row-${seva.id}`}
                  draggable={canMove}
                  onDragStartCapture={(e) => onDragStart(e, index)}
                  onDragOver={(e) => {
                    if (!canMove) return;
                    e.preventDefault();
                    setOver(index);
                  }}
                  onDragLeave={() => setOver((o) => (o === index ? null : o))}
                  onDragEndCapture={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  onDrop={(e) => onDrop(e, index)}
                  className={cn(
                    "border-b border-(--border) last:border-b-0",
                    !seva.active && "text-(--muted-foreground)",
                    over === index && dragging !== index && "bg-(--primary-soft)",
                  )}
                >
                  <td className={TD}>
                    <div className="flex items-center gap-1">
                      {editable ? (
                        <span
                          aria-label={T.dragHandle(seva.nameEn)}
                          title={T.dragHint}
                          className={cn("text-(--muted-foreground)", canMove && "cursor-grab")}
                          data-testid={`seva-handle-${seva.id}`}
                        >
                          <GripVertical aria-hidden="true" className="size-4" />
                        </span>
                      ) : null}
                      <span className="min-w-6 font-semibold tabular-nums" data-testid={`seva-key-${seva.id}`}>
                        {seva.key}
                      </span>
                      {editable ? (
                        <span className="flex flex-col">
                          <button
                            type="button"
                            aria-label={T.moveUp(seva.nameEn)}
                            disabled={!canMove || index === 0}
                            onClick={() => move(index, index - 1)}
                            className="rounded p-0.5 text-(--muted-foreground) hover:text-(--foreground) disabled:opacity-30"
                          >
                            <ArrowUp aria-hidden="true" className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={T.moveDown(seva.nameEn)}
                            disabled={!canMove || index === sevas.length - 1}
                            onClick={() => move(index, index + 1)}
                            className="rounded p-0.5 text-(--muted-foreground) hover:text-(--foreground) disabled:opacity-30"
                          >
                            <ArrowDown aria-hidden="true" className="size-3.5" />
                          </button>
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className={cn(TD, "font-semibold")}>{seva.code ?? ""}</td>
                  <td className={TD}>
                    <Bilingual en={seva.nameEn} kn={seva.nameKn} className="font-semibold" />
                  </td>
                  <td className={cn(TD, "text-right tabular-nums")}>{rateCell(seva)}</td>
                  <td className={cn(TD, "whitespace-nowrap")}>{VISIBILITY_CELL[seva.visibility]}</td>
                  <td className={TD}>{seva.multiDate ? T.yes : T.no}</td>
                  <td className={cn(TD, "text-(length:--text-meta) text-(--muted-foreground)")}>
                    {seva.prasadamGiven ? (seva.prasadamItems ?? T.yes) : T.none}
                  </td>
                  <td className={TD}>
                    <Switch
                      variant="seva"
                      aria-label={T.activeSwitch(seva.nameEn)}
                      checked={seva.active}
                      disabled={!editable || busy}
                      aria-disabled={!editable || busy}
                      onCheckedChange={(next) => onToggleActive(seva, next)}
                    />
                  </td>
                  <td className={cn(TD, "text-right")}>
                    <Button variant="seva-ghost" size="sm" onClick={() => onEdit(seva)} aria-label={`${editable ? T.edit : T.view} ${seva.nameEn}`}>
                      {editable ? T.edit : T.view}
                    </Button>
                  </td>
                </m.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SevaTable;
