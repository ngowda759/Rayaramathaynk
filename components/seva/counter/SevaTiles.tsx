"use client";

import { useEffect, useRef, type JSX } from "react";
import { m, useAnimate, useReducedMotionConfig } from "framer-motion";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { PRESS, enterVariants, staggerChildren } from "@/lib/seva/motion";
import { COUNTER_TEXT, rupees } from "@/lib/seva/strings/counter";
import type { CatalogueSeva } from "@/types/seva";

export interface SevaTilesProps {
  sevas: CatalogueSeva[];
  /** Sevas already on this order (their tiles look picked). */
  pickedIds: ReadonlySet<string>;
  onAdd(key: number): void;
}

/** The whole entrance stays short however many sevas there are (elderly-friendly: readable within about 450 ms). */
const STAGGER_BUDGET_S = 0.3;

/**
 * Whether the tiles already made their entrance on this page. They stagger in once, when the counter first shows
 * them; after that (the next devotee, or tiles a search brings back) they are simply there, so nothing moves while a
 * person types.
 */
let tilesEntered = false;

function Tile({ seva: s, picked, onAdd }: { seva: CatalogueSeva; picked: boolean; onAdd(key: number): void }): JSX.Element {
  const [scope, animate] = useAnimate<HTMLButtonElement>();
  const reduce = useReducedMotionConfig() === true;
  const wasPicked = useRef(picked);

  useEffect(() => {
    // A tile that becomes picked pops once (a quick grow and settle); unpicking does not move it.
    if (picked && !wasPicked.current && !reduce && scope.current) {
      void animate(scope.current, { scale: [1, 1.06, 1] }, { duration: 0.32, ease: "easeOut" });
    }
    wasPicked.current = picked;
  }, [picked, reduce, animate, scope]);

  return (
    <m.button
      ref={scope}
      type="button"
      variants={enterVariants}
      initial={tilesEntered ? false : undefined}
      whileTap={PRESS}
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
    </m.button>
  );
}

/**
 * The seva tiles (Design Book 9.3, counter mockup `#counter-sevas`): a roomy grid, tiles at least 150 px wide, each
 * with its number badge (display order), letter code, English name, Kannada under it and the price ("Any amount" for
 * Other Seva / Karnike). Pressing 1-9 while focus is in the grid adds the nth seva (the counter's key map).
 * Plan A4P-2: the tiles stagger in the first time they show, a picked tile pops, and every tile gives under a press.
 */
export function SevaTiles({ sevas, pickedIds, onAdd }: SevaTilesProps): JSX.Element {
  if (sevas.length === 0) {
    return <Bilingual as="div" en={COUNTER_TEXT.noMatch.en} kn={COUNTER_TEXT.noMatch.kn} className="meta" />;
  }
  const step = Math.min(0.055, STAGGER_BUDGET_S / sevas.length);
  return (
    <m.div
      role="group"
      aria-label={COUNTER_TEXT.tilesLabel}
      data-zone="tiles"
      variants={staggerChildren(step)}
      initial={tilesEntered ? false : "hidden"}
      animate="shown"
      onAnimationComplete={() => {
        tilesEntered = true;
      }}
      className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4"
    >
      {sevas.map((s) => (
        <Tile key={s.id} seva={s} picked={pickedIds.has(s.id)} onAdd={onAdd} />
      ))}
    </m.div>
  );
}

export default SevaTiles;
