"use client";

import { useId, type JSX } from "react";

import { sevaControlClass } from "@/components/ui/input";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { toPaise } from "@/lib/seva/money";
import { DAYCLOSE, upiReceiptsLine } from "@/lib/seva/strings/dayclose";
import { cashDifference, DifferenceChip, formatAmount, type CashDifference } from "./CashCount";

/**
 * Close day, step 3 (DB §9.10): the count and expected amount of today's UPI receipts, and the total the receptionist
 * reads in the temple's bank or merchant app. A difference also needs the note (kept with the cash note, one per day).
 */

/** A typed rupee amount ('41,606', '41606.50', 'Rs 100') in paise; '' is null, anything else unreadable is NaN. */
export function parseRupeeText(text: string): number | null {
  const cleaned = text.replace(/^\s*(rs\.?|₹)\s*/i, "").replace(/,/g, "").trim();
  if (cleaned === "") return null;
  try {
    return toPaise(cleaned);
  } catch {
    return Number.NaN;
  }
}

/** The bank total against the expected UPI amount; null while nothing (or nothing readable) is typed. */
export function upiDifference(bankText: string, expectedPaise: number): CashDifference | null {
  const bank = parseRupeeText(bankText);
  if (bank === null || Number.isNaN(bank)) return null;
  return cashDifference(bank, expectedPaise);
}

export interface UpiCheckProps {
  upiCount: number;
  expectedPaise: number;
  bankText: string;
  onBankChange(value: string): void;
  disabled?: boolean;
}

export function UpiCheck({ upiCount, expectedPaise, bankText, onBankChange, disabled = false }: UpiCheckProps): JSX.Element {
  const inputId = useId();
  const hintId = useId();
  const bank = parseRupeeText(bankText);
  const unreadable = bank !== null && Number.isNaN(bank);
  const diff = upiDifference(bankText, expectedPaise);
  const countLine = upiReceiptsLine(upiCount);

  return (
    <section aria-label={DAYCLOSE.upi.en} className="flex flex-col gap-4 rounded-(--radius-card) border border-(--border) bg-(--card) p-5 shadow-(--shadow-card)">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Bilingual as="h2" en={DAYCLOSE.upi.en} kn={DAYCLOSE.upi.kn} className="text-(length:--text-h2) font-semibold" />
        <Bilingual en={countLine.en} kn={countLine.kn} className="text-(length:--text-meta) text-(--muted-foreground)" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Bilingual en={DAYCLOSE.upiExpected.en} kn={DAYCLOSE.upiExpected.kn} className="text-(--muted-foreground)" />
        <span className="text-(length:--text-h2) font-bold tabular-nums" data-testid="dc-upi-expected">
          {formatAmount(expectedPaise)}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Bilingual as="label" htmlFor={inputId} en={DAYCLOSE.upiBankTotal.en} kn={DAYCLOSE.upiBankTotal.kn} className="text-(length:--text-meta) font-semibold" />
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-(--muted-foreground)">
            Rs
          </span>
          <input
            id={inputId}
            className={`${sevaControlClass} max-w-48 text-right tabular-nums`}
            inputMode="decimal"
            autoComplete="off"
            value={bankText}
            disabled={disabled}
            aria-invalid={unreadable ? true : undefined}
            aria-describedby={hintId}
            onChange={(e) => onBankChange(e.target.value)}
          />
        </div>
        <span id={hintId} className="text-(length:--text-meta) text-(--muted-foreground)">
          {DAYCLOSE.upiBankHint.en}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Bilingual en={DAYCLOSE.difference.en} kn={DAYCLOSE.difference.kn} className="text-(--muted-foreground)" />
        {diff ? <DifferenceChip diff={diff} testId="dc-upi-diff" /> : <span className="text-(--muted-foreground)">-</span>}
      </div>
      {diff && diff.kind !== "balanced" ? (
        <p className="text-(length:--text-meta) text-(--muted-foreground)">{DAYCLOSE.upiNoteHint.en}</p>
      ) : null}
    </section>
  );
}

export default UpiCheck;
