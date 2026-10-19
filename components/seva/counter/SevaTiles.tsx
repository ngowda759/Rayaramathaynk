"use client";

import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { COUNTER_TEXT, rupees } from "@/lib/seva/strings/counter";
import type { CatalogueSeva } from "@/types/seva";

export interface SevaTilesProps {
  sevas: CatalogueSeva[];
  /** Sevas already on this order (their tiles look picked). */
  pickedIds: ReadonlySet<string>;
  onAdd(key: number): void;
}

/**
 * The seva tiles (Design Book 9.3, counter mockup `#counter-sevas`): a roomy grid, tiles at least 150 px wide, each
 * with its number badge (display order), letter code, English name, Kannada under it and the price ("Any amount" for
 * Other Seva / Karnike). Pressing 1-9 while focus is in the grid adds the nth seva (the counter's key map).
 */
export function SevaTiles({ sevas, pickedIds, onAdd }: SevaTilesProps): JSX.Element {
  if (sevas.length === 0) {
    return <Bilingual as="div" en={COUNTER_TEXT.noMatch.en} kn={COUNTER_TEXT.noMatch.kn} className="meta" />;
  }
  return (
    <div
      role="group"
      aria-label={COUNTER_TEXT.tilesLabel}
      data-zone="tiles"
      className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4"
    >
      {sevas.map((s) => {
        const picked = pickedIds.has(s.id);
        return (
          <button
            key={s.id}
            type="button"
            data-seva-key={s.key}
            aria-pressed={picked}
            aria-keyshortcuts={s.key <= 9 ? String(s.key) : undefined}
            onClick={() => onAdd(s.key)}
            className={`flex min-h-[146px] cursor-pointer flex-col items-stretch gap-1 rounded-[16px] border p-4 text-left text-(--foreground) shadow-(--shadow-card) transition-colors duration-[120ms] hover:border-(--primary-press) ${
              picked ? "border-(--primary-press) bg-(--primary-soft)" : "border-(--border) bg-(--card)"
            }`}
          >
            <span className="mb-2 flex items-center justify-between">
              <span
                aria-hidden="true"
                className={`grid size-[30px] shrink-0 place-items-center rounded-full border text-[14px] font-bold tabular-nums ${
                  picked ? "border-(--primary) bg-(--primary) text-(--primary-ink)" : "border-(--border-strong) bg-(--secondary)"
                }`}
              >
                {s.key}
              </span>
              {s.code ? (
                <span className="rounded-[6px] border border-(--border-strong) px-1.5 text-(length:--text-meta) font-semibold">
                  {s.code}
                </span>
              ) : null}
            </span>
            <span className="text-(length:--text-ui) leading-snug font-semibold">{s.nameEn}</span>
            {s.nameKn ? (
              <span className="kn" lang="kn">
                {s.nameKn}
              </span>
            ) : null}
            <span className="amount mt-auto pt-2 text-[17px] font-semibold">
              {s.ratePaise === null ? COUNTER_TEXT.anyAmount.en : rupees(s.ratePaise)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default SevaTiles;
