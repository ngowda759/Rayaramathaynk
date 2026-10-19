"use client";

import type { JSX } from "react";

import { MODE_LABEL, REGISTER } from "@/lib/seva/strings/reports";
import type { ReceiptListItem } from "@/types/seva-receipts";

import { ReceiptStatusChips, issuedWhen, rupees } from "./RegisterTable";

export interface ReceiptCardsProps {
  rows: ReceiptListItem[];
  today: string;
  onOpen(row: ReceiptListItem): void;
}

/** Below 768 px each register row is a card; tapping it opens the same details (DB §12.3, mockup register phone). */
export function ReceiptCards({ rows, today, onOpen }: ReceiptCardsProps): JSX.Element {
  return (
    <ul data-testid="register-cards" className="flex flex-col gap-2 md:hidden">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => onOpen(row)}
            aria-label={REGISTER.open(row.receiptNo)}
            className="flex w-full flex-col gap-1.5 rounded-(--radius-surface) border border-(--border) bg-(--card) p-4 text-left focus-visible:outline-2 focus-visible:outline-(--primary-press)"
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-(length:--text-meta) font-semibold text-(--foreground) tabular-nums">{row.receiptNo}</span>
              <span className={`text-(length:--text-ui) font-semibold tabular-nums ${row.status === "cancelled" ? "line-through" : ""}`}>
                {rupees(row.totalPaise)}
              </span>
            </span>
            <span className="text-(length:--text-ui) font-semibold text-(--foreground)">{row.devoteeName}</span>
            <span className="text-(length:--text-meta) text-(--muted-foreground)">
              {row.sevas} · {MODE_LABEL[row.mode]} · {issuedWhen(row.issuedAt, today)}
            </span>
            <ReceiptStatusChips row={row} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export default ReceiptCards;
