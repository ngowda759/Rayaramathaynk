"use client";

import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Chip, type ChipTone } from "@/components/seva/ui/Chip";
import { formatRupees } from "@/lib/seva/money";
import { DAY_CLOSES } from "@/lib/seva/strings/reports";
import { formatSevaDate } from "@/lib/seva/time";
import type { DayCloseListRow } from "@/services/seva/reports.service";

export function rupees(paise: number): string {
  return formatRupees(paise, { decimals: paise % 100 !== 0 });
}

/** 'Balanced', 'Rs 50 short' or 'Rs 20 extra': the short side wins when cash and UPI differ in opposite directions. */
export function differenceText(row: DayCloseListRow): string {
  if (row.badge === "balanced") return DAY_CLOSES.balanced;
  const diffs = [row.cashDifferencePaise, row.upiDifferencePaise];
  if (row.badge === "short") return DAY_CLOSES.short(rupees(-diffs.filter((d) => d < 0).reduce((a, b) => a + b, 0)));
  return DAY_CLOSES.extra(rupees(diffs.filter((d) => d > 0).reduce((a, b) => a + b, 0)));
}

export const BADGE_TONE: Record<DayCloseListRow["badge"], ChipTone> = { balanced: "ok", short: "critical", extra: "attention" };

export function counterLabel(row: DayCloseListRow): string {
  return row.counterName ?? `Counter ${row.counterId}`;
}

export interface DayCloseListProps {
  rows: DayCloseListRow[];
  onOpen(row: DayCloseListRow): void;
}

const head = "text-(length:--text-meta) font-semibold text-(--muted-foreground)";
const grid = "grid grid-cols-2 gap-x-3 gap-y-1 md:grid-cols-[1.4fr_0.7fr_1fr_1fr_1fr_1fr_1.1fr_1fr] md:items-center";

/**
 * Day closes (DB §12.4): one row per counter per day with receipts, cash expected and counted, UPI expected and
 * confirmed, the difference badge and who closed; a row opens the detail. Columns on wide screens, cards on a phone.
 */
export function DayCloseList({ rows, onOpen }: DayCloseListProps): JSX.Element {
  const balanced = rows.filter((r) => r.badge === "balanced").length;
  const short = rows.filter((r) => r.badge === "short").length;
  const extra = rows.filter((r) => r.badge === "extra").length;

  return (
    <div className="flex flex-col gap-3">
      <p data-testid="day-close-summary" className="text-(length:--text-meta) text-(--muted-foreground)">
        {DAY_CLOSES.summary(rows.length, balanced, short, extra)}
      </p>
      <div data-testid="day-close-list" className="flex flex-col gap-2">
        <div aria-hidden="true" className={`hidden px-4 md:grid ${grid}`}>
          <span className={head}>{DAY_CLOSES.columns.day}</span>
          <span className={`${head} text-right`}>{DAY_CLOSES.columns.receipts}</span>
          <span className={`${head} text-right`}>{DAY_CLOSES.columns.cashExpected}</span>
          <span className={`${head} text-right`}>{DAY_CLOSES.columns.cashCounted}</span>
          <span className={`${head} text-right`}>{DAY_CLOSES.columns.upiExpected}</span>
          <span className={`${head} text-right`}>{DAY_CLOSES.columns.upiConfirmed}</span>
          <span className={head}>{DAY_CLOSES.columns.difference}</span>
          <span className={head}>{DAY_CLOSES.columns.closedBy}</span>
        </div>
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const diff = differenceText(row);
            const day = formatSevaDate(row.businessDate);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  aria-label={`${counterLabel(row)}, ${day}: ${diff}`}
                  className={`w-full rounded-(--radius-surface) border border-(--border) bg-(--card) p-4 text-left text-(length:--text-ui) tabular-nums hover:bg-(--secondary) focus-visible:outline-2 focus-visible:outline-(--primary-press) ${grid}`}
                >
                  <span className="col-span-2 flex flex-col md:col-span-1">
                    <span className="font-semibold text-(--foreground)">{day}</span>
                    <span className="text-(length:--text-meta) text-(--muted-foreground)">
                      {counterLabel(row)}
                      {row.status === "reopened" ? ` · ${DAY_CLOSES.reopened}` : ""}
                    </span>
                  </span>
                  <span className="md:text-right">
                    <span className="text-(--muted-foreground) md:hidden">{DAY_CLOSES.columns.receipts}: </span>
                    {row.receipts.toLocaleString("en-IN")}
                  </span>
                  <span className="md:text-right">
                    <span className="text-(--muted-foreground) md:hidden">{DAY_CLOSES.columns.cashExpected}: </span>
                    {rupees(row.cashExpectedPaise)}
                  </span>
                  <span className="md:text-right">
                    <span className="text-(--muted-foreground) md:hidden">{DAY_CLOSES.columns.cashCounted}: </span>
                    {rupees(row.cashCountedPaise)}
                  </span>
                  <span className="md:text-right">
                    <span className="text-(--muted-foreground) md:hidden">{DAY_CLOSES.columns.upiExpected}: </span>
                    {rupees(row.upiExpectedPaise)}
                  </span>
                  <span className="md:text-right">
                    <span className="text-(--muted-foreground) md:hidden">{DAY_CLOSES.columns.upiConfirmed}: </span>
                    {row.upiBankTotalPaise === null ? DAY_CLOSES.notConfirmed : rupees(row.upiBankTotalPaise)}
                  </span>
                  <span>
                    <Chip tone={BADGE_TONE[row.badge]}>{diff}</Chip>
                  </span>
                  <span className="text-(--muted-foreground)">{row.closedBy ?? "-"}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {rows.length === 0 ? (
          <Bilingual as="div" en={DAY_CLOSES.empty.en} kn={DAY_CLOSES.empty.kn} className="py-6 text-center text-(--muted-foreground)" />
        ) : null}
      </div>
    </div>
  );
}

export default DayCloseList;
