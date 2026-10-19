"use client";

import Link from "next/link";
import { useId, type JSX } from "react";

import { sevaControlClass } from "@/components/ui/input";
import { AnimatedNumber } from "@/components/seva/motion/AnimatedNumber";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Chip } from "@/components/seva/ui/Chip";
import { formatRupees } from "@/lib/seva/money";
import { DAYCLOSE, countOfLabel, extraBy, shortBy } from "@/lib/seva/strings/dayclose";
import type { DayClosePrep } from "@/types/seva-dayclose";
import { SEVA_ROUTES } from "@/lib/seva/routes";

/**
 * Close day, steps 1 and 2 (DB §9.10): the drawer counted by denomination (notes, then coins by value, both from
 * settings), each row value x count = amount, the counted total against the expected cash, and the note a difference
 * needs (D23). Controlled: the page keeps the counts and the note, because the close request and the summary use them.
 * Plan A4P-2: each row's amount, the counted total and the difference count to their new values as counts are typed.
 */

export type Denomination = DayClosePrep["denominations"][number];

/** The most of one denomination the server accepts (dayCloseSchema). */
export const MAX_COUNT = 100_000;

export type CashDifference = { kind: "balanced" | "short" | "extra"; paise: number };

export function denominationKey(kind: Denomination["kind"], valuePaise: number): string {
  return `${kind}:${valuePaise}`;
}

/** A typed count: '' is 0; anything but whole numbers 0..100000 is null (invalid). */
export function parseCount(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  if (!/^\d{1,6}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n <= MAX_COUNT ? n : null;
}

/** Rupees without paise when there are none ('Rs 1,520'), with them otherwise ('Rs 10.50'). */
export function formatAmount(paise: number): string {
  return formatRupees(paise, { decimals: paise % 100 !== 0 });
}

/**
 * The rupee text of an amount that counts up to `finalPaise` (AnimatedNumber): whole rupees while it counts, exactly
 * `formatAmount(finalPaise)` once it lands.
 */
export function countingAmount(finalPaise: number): (paise: number) => string {
  return (paise) => formatAmount(paise === finalPaise ? finalPaise : Math.round(paise / 100) * 100);
}

/** An amount that counts to its new value (plan A4P-2); screen readers hear only the final amount. */
function CountingAmount({ paise }: { paise: number }): JSX.Element {
  return <AnimatedNumber value={paise} format={countingAmount(paise)} />;
}

/** The counted cash: the sum of value x count over the shown denominations; invalid counts count as 0. */
export function countedPaise(denominations: readonly Denomination[], counts: Readonly<Record<string, string>>): number {
  return denominations.reduce((sum, d) => {
    const count = parseCount(counts[denominationKey(d.kind, d.valuePaise)] ?? "") ?? 0;
    return sum + d.valuePaise * count;
  }, 0);
}

/** True when any typed count is not a whole number in range. */
export function hasInvalidCount(denominations: readonly Denomination[], counts: Readonly<Record<string, string>>): boolean {
  return denominations.some((d) => parseCount(counts[denominationKey(d.kind, d.valuePaise)] ?? "") === null);
}

/** Counted minus expected, as a kind and a positive amount. */
export function cashDifference(countedTotal: number, expectedPaise: number): CashDifference {
  const diff = countedTotal - expectedPaise;
  if (diff === 0) return { kind: "balanced", paise: 0 };
  return diff < 0 ? { kind: "short", paise: -diff } : { kind: "extra", paise: diff };
}

/** The note the SQL function accepts for a difference: at least 3 characters (difference_note_required). */
export function noteIsEnough(note: string): boolean {
  return note.trim().length >= 3;
}

/** Where the amount goes in the difference words. */
const AMOUNT_MARK = "{amount}";

/**
 * The chip for a difference: 'Matches', 'Short Rs 80' or 'Extra Rs 20'. While it stays short (or extra) the amount
 * counts to its new value (plan A4P-2); a change of kind shows the new words at once, and the chip's dot pops.
 */
export function DifferenceChip({ diff, testId }: { diff: CashDifference; testId?: string }): JSX.Element {
  const words = diff.kind === "short" ? shortBy(AMOUNT_MARK) : diff.kind === "extra" ? extraBy(AMOUNT_MARK) : null;
  return (
    <span data-testid={testId}>
      <Chip tone={diff.kind === "balanced" ? "ok" : diff.kind === "short" ? "critical" : "attention"}>
        {words ? (
          <span key={diff.kind}>
            <AmountWords text={words.en} paise={diff.paise} />
            <span className="kn" lang="kn">
              <AmountWords text={words.kn} paise={diff.paise} />
            </span>
          </span>
        ) : (
          <Bilingual en={DAYCLOSE.matches.en} kn={DAYCLOSE.matches.kn} />
        )}
      </Chip>
    </span>
  );
}

/** Words with the amount in its place (AMOUNT_MARK): 'Short <Rs 80>', '<Rs 80> ಕಡಿಮೆ'. */
function AmountWords({ text, paise }: { text: string; paise: number }): JSX.Element {
  const [before, after = ""] = text.split(AMOUNT_MARK);
  return (
    <>
      {before}
      <CountingAmount paise={paise} />
      {after}
    </>
  );
}

export interface CashCountProps {
  denominations: readonly Denomination[];
  expectedPaise: number;
  counts: Readonly<Record<string, string>>;
  onCountChange(key: string, value: string): void;
  note: string;
  onNoteChange(value: string): void;
  /** Temple admins and super admins see the "Manage denominations" link (settings). */
  canManageDenominations: boolean;
  /** A UPI difference also needs the note; the page passes it so the note asks for itself. */
  otherDifference?: boolean;
  disabled?: boolean;
}

function DenominationRows({
  rows,
  counts,
  onCountChange,
  disabled,
}: {
  rows: readonly Denomination[];
  counts: Readonly<Record<string, string>>;
  onCountChange(key: string, value: string): void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <>
      {rows.map((d) => {
        const key = denominationKey(d.kind, d.valuePaise);
        const text = counts[key] ?? "";
        const count = parseCount(text);
        const value = formatAmount(d.valuePaise);
        return (
          <tr key={key} className="border-b border-(--border)">
            <td className="py-2 pr-2 font-semibold">
              {value}
              {d.kind === "coin" ? <span className="ml-1 text-(length:--text-meta) font-normal text-(--muted-foreground)">coin</span> : null}
            </td>
            <td className="px-1 text-(--muted-foreground)" aria-hidden="true">
              x
            </td>
            <td className="py-1.5">
              <input
                className={`${sevaControlClass} h-10 w-24 text-right tabular-nums`}
                inputMode="numeric"
                autoComplete="off"
                value={text}
                disabled={disabled}
                aria-label={countOfLabel(d.kind, value)}
                aria-invalid={count === null ? true : undefined}
                onChange={(e) => onCountChange(key, e.target.value)}
              />
            </td>
            <td className="py-2 pl-2 text-right tabular-nums" data-testid={`dc-row-${key}`}>
              <CountingAmount paise={d.valuePaise * (count ?? 0)} />
            </td>
          </tr>
        );
      })}
    </>
  );
}

export function CashCount({
  denominations,
  expectedPaise,
  counts,
  onCountChange,
  note,
  onNoteChange,
  canManageDenominations,
  otherDifference = false,
  disabled = false,
}: CashCountProps): JSX.Element {
  const noteId = useId();
  const noteHintId = useId();
  const notes = denominations.filter((d) => d.kind === "note");
  const coins = denominations.filter((d) => d.kind === "coin");
  const counted = countedPaise(denominations, counts);
  const diff = cashDifference(counted, expectedPaise);
  const needsNote = (diff.kind !== "balanced" || otherDifference) && !noteIsEnough(note);

  return (
    <section aria-label={DAYCLOSE.cash.en} className="flex flex-col gap-4 rounded-(--radius-card) border border-(--border) bg-(--card) p-5 shadow-(--shadow-card)">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Bilingual as="h2" en={DAYCLOSE.cash.en} kn={DAYCLOSE.cash.kn} className="text-(length:--text-h2) font-semibold" />
        {canManageDenominations ? (
          <Link href={SEVA_ROUTES.settingsDenominations} className="text-(length:--text-meta) text-(--link) underline">
            {DAYCLOSE.manageDenominations.en}
          </Link>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Bilingual en={DAYCLOSE.expectedInDrawer.en} kn={DAYCLOSE.expectedInDrawer.kn} className="text-(--muted-foreground)" />
        <span className="text-(length:--text-h2) font-bold tabular-nums" data-testid="dc-cash-expected">
          {formatAmount(expectedPaise)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-(length:--text-body)">
          <thead>
            <tr className="border-b border-(--border-strong) text-left text-(length:--text-meta) text-(--muted-foreground)">
              <Bilingual as="th" en={DAYCLOSE.denomination.en} kn={DAYCLOSE.denomination.kn} className="py-2 font-semibold" />
              <th aria-hidden="true" />
              <Bilingual as="th" en={DAYCLOSE.count.en} kn={DAYCLOSE.count.kn} className="py-2 font-semibold" />
              <Bilingual as="th" en={DAYCLOSE.amount.en} kn={DAYCLOSE.amount.kn} className="py-2 text-right font-semibold" />
            </tr>
          </thead>
          <tbody>
            {notes.length > 0 ? (
              <tr>
                <td colSpan={4} className="pt-3 pb-1 text-(length:--text-meta) font-semibold text-(--muted-foreground)">
                  <Bilingual en={DAYCLOSE.notes.en} kn={DAYCLOSE.notes.kn} />
                </td>
              </tr>
            ) : null}
            <DenominationRows rows={notes} counts={counts} onCountChange={onCountChange} disabled={disabled} />
            {coins.length > 0 ? (
              <tr>
                <td colSpan={4} className="pt-3 pb-1 text-(length:--text-meta) font-semibold text-(--muted-foreground)">
                  <Bilingual en={DAYCLOSE.coinsByValue.en} kn={DAYCLOSE.coinsByValue.kn} />
                </td>
              </tr>
            ) : null}
            <DenominationRows rows={coins} counts={counts} onCountChange={onCountChange} disabled={disabled} />
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-3 font-semibold">
                <Bilingual en={DAYCLOSE.counted.en} kn={DAYCLOSE.counted.kn} />
              </td>
              <td className="pt-3 text-right text-(length:--text-h3) font-bold tabular-nums" data-testid="dc-counted">
                <CountingAmount paise={counted} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Bilingual en={DAYCLOSE.difference.en} kn={DAYCLOSE.difference.kn} className="text-(--muted-foreground)" />
        <DifferenceChip diff={diff} testId="dc-cash-diff" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Bilingual as="label" htmlFor={noteId} en={DAYCLOSE.noteLabel.en} kn={DAYCLOSE.noteLabel.kn} className="text-(length:--text-meta) font-semibold" />
        <textarea
          id={noteId}
          className={`${sevaControlClass} h-auto min-h-20 py-2.5`}
          placeholder={DAYCLOSE.notePlaceholder.en}
          value={note}
          maxLength={1000}
          disabled={disabled}
          aria-invalid={needsNote ? true : undefined}
          aria-describedby={needsNote ? noteHintId : undefined}
          onChange={(e) => onNoteChange(e.target.value)}
        />
        {needsNote ? (
          <p id={noteHintId} className="text-(length:--text-meta) text-(--destructive)">
            {DAYCLOSE.noteNeeded.en}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default CashCount;
