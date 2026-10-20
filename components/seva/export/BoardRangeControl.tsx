"use client";

import { useId, useState, type JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Segmented } from "@/components/seva/ui/Segmented";
import { sevaControlClass } from "@/components/ui/input";
import { quickRange, type QuickRange } from "@/lib/seva/export/collect";
import { BOARD, EXPORT, RANGE_LABELS } from "@/lib/seva/strings/export";
import { businessDate } from "@/lib/seva/time";

/**
 * The board summary's own range (owner's fix, 2026-10-20): This month, Last month, This year, Last year, or Custom
 * with a from and a to date. A quick choice hands its IST range up at once; a custom range is handed up only when both
 * dates are set, from is on or before to, and neither is after today. Hidden in print.
 */

type BoardRangeKind = Exclude<QuickRange, "today"> | "custom";
type Range = { from: string; to: string };

const KINDS: readonly BoardRangeKind[] = ["month", "lastMonth", "year", "lastYear", "custom"];
const QUICK_KINDS: readonly Exclude<BoardRangeKind, "custom">[] = ["month", "lastMonth", "year", "lastYear"];

/** The quick range these dates are, or 'custom'. */
function kindOf(range: Range, now: Date): BoardRangeKind {
  for (const kind of QUICK_KINDS) {
    const q = quickRange(kind, now);
    if (q.from === range.from && q.to === range.to) return kind;
  }
  return "custom";
}

/** Why a custom range cannot be used, or null when it can. Empty dates are not an error yet, only not ready. */
function customProblem(range: Range, today: string): "order" | "future" | null {
  if (range.from > today || range.to > today) return "future";
  if (range.from && range.to && range.from > range.to) return "order";
  return null;
}

export interface BoardRangeControlProps {
  from: string;
  to: string;
  onChange(range: Range): void;
}

export function BoardRangeControl({ from, to, onChange }: BoardRangeControlProps): JSX.Element {
  const ids = useId();
  const now = new Date();
  const today = businessDate(now);
  // The custom dates being typed; null while a quick range (or the URL's own dates) is shown.
  const [draft, setDraft] = useState<Range | null>(null);
  const kind: BoardRangeKind = draft ? "custom" : kindOf({ from, to }, now);
  const shown = draft ?? { from, to };
  const problem = draft ? customProblem(draft, today) : null;

  const choose = (next: BoardRangeKind): void => {
    if (next === "custom") {
      setDraft({ from, to });
      return;
    }
    setDraft(null);
    onChange(quickRange(next, new Date()));
  };

  const setDate = (which: keyof Range, value: string): void => {
    const next = { ...shown, [which]: value };
    setDraft(next);
    if (next.from && next.to && customProblem(next, today) === null) onChange(next);
  };

  return (
    <section
      data-board-range=""
      className="flex flex-col gap-3 rounded-(--radius-surface) border border-(--border) bg-(--card) p-4 shadow-(--shadow-card) print:hidden"
    >
      <Bilingual as="div" en={BOARD.range.en} kn={BOARD.range.kn} className="text-(length:--text-meta) font-semibold" />
      <div className="overflow-x-auto">
        <Segmented
          name={`${ids}-range`}
          label={BOARD.range.en}
          options={KINDS.map((k) => ({ value: k, en: RANGE_LABELS[k].en, kn: RANGE_LABELS[k].kn }))}
          value={kind}
          onChange={choose}
        />
      </div>
      {kind === "custom" ? (
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex w-full flex-col gap-1 sm:w-48">
            <Bilingual as="label" htmlFor={`${ids}-from`} en={EXPORT.from.en} kn={EXPORT.from.kn} className="text-(length:--text-meta) font-semibold" />
            <input
              id={`${ids}-from`}
              type="date"
              className={sevaControlClass}
              value={shown.from}
              max={today}
              aria-invalid={problem !== null || undefined}
              onChange={(e) => setDate("from", e.target.value)}
            />
          </div>
          <div className="flex w-full flex-col gap-1 sm:w-48">
            <Bilingual as="label" htmlFor={`${ids}-to`} en={EXPORT.to.en} kn={EXPORT.to.kn} className="text-(length:--text-meta) font-semibold" />
            <input
              id={`${ids}-to`}
              type="date"
              className={sevaControlClass}
              value={shown.to}
              max={today}
              aria-invalid={problem !== null || undefined}
              onChange={(e) => setDate("to", e.target.value)}
            />
          </div>
        </div>
      ) : null}
      {problem ? (
        <div role="alert" className="text-(length:--text-meta) text-(--destructive)">
          <Bilingual
            en={problem === "order" ? EXPORT.badRange.en : BOARD.futureDate.en}
            kn={problem === "order" ? EXPORT.badRange.kn : BOARD.futureDate.kn}
          />
        </div>
      ) : null}
    </section>
  );
}

export default BoardRangeControl;
