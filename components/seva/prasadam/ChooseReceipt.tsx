"use client";

import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { PRASADAM } from "@/lib/seva/strings/prasadam";
import { formatSevaDate } from "@/lib/seva/time";
import type { PrasadamLookupResult } from "@/types/seva-prasadam";

export type ChooseOption = Extract<PrasadamLookupResult, { state: "choose" }>["options"][number];

export interface ChooseReceiptProps {
  options: ChooseOption[];
  disabled?: boolean;
  /** Called with the full receipt number of the chosen option; the page looks it up again. */
  onChoose(receiptNo: string): void;
}

/** The pick list for a short receipt number that matches several series (DB §11, C-51). No amounts. */
export function ChooseReceipt({ options, disabled = false, onChoose }: ChooseReceiptProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <Bilingual as="h2" en={PRASADAM.chooseTitle.en} kn={PRASADAM.chooseTitle.kn} className="text-(length:--text-h2) leading-tight font-bold" />
      <Bilingual as="div" en={PRASADAM.chooseHint.en} kn={PRASADAM.chooseHint.kn} className="text-(--muted-foreground)" />
      <ul className="flex flex-col gap-2">
        {options.map((o) => (
          <li key={o.receiptId}>
            <button
              type="button"
              disabled={disabled}
              data-action={o.receiptNo}
              onClick={() => onChoose(o.receiptNo)}
              className="flex min-h-14 w-full cursor-pointer flex-col items-start gap-0.5 rounded-(--radius-control) border border-(--border-strong) bg-(--card) px-4 py-3 text-left hover:bg-(--secondary) focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus) disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="font-mono text-(length:--text-ui) font-semibold tabular-nums">{o.receiptNo}</span>
              <span className="text-(length:--text-meta) text-(--muted-foreground)">
                {o.devoteeName} · {formatSevaDate(o.sevaDate)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ChooseReceipt;
