"use client";

import type { JSX } from "react";

import { Chip } from "@/components/seva/ui/Chip";
import { formatRupees } from "@/lib/seva/money";
import { MODE_LABEL, REGISTER, RECEIPT_STATUS } from "@/lib/seva/strings/reports";
import { formatSevaDate, istParts, businessDate } from "@/lib/seva/time";
import type { ReceiptListItem } from "@/types/seva-receipts";

/** 'Rs 820' for whole rupees, 'Rs 610.50' otherwise. */
export function rupees(paise: number): string {
  return formatRupees(paise, { decimals: paise % 100 !== 0 });
}

/** IST time of issue, '11:12 AM', with the date in front when it is not `today`. */
export function issuedWhen(issuedAt: string, today: string): string {
  const d = new Date(issuedAt);
  if (Number.isNaN(d.getTime())) return issuedAt;
  const p = istParts(d);
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const clock = `${hour12}:${String(p.minute).padStart(2, "0")} ${p.hour < 12 ? "AM" : "PM"}`;
  const day = businessDate(d);
  return day === today ? clock : `${formatSevaDate(day)}, ${clock}`;
}

/** Status first, then the facts the register filters on: changed amount, duplicate printed, prasadam, refund. */
export function ReceiptStatusChips({ row }: { row: ReceiptListItem }): JSX.Element {
  return (
    <span className="flex flex-wrap gap-1.5">
      {row.status === "cancelled" ? (
        <Chip tone="critical">{RECEIPT_STATUS.cancelled.en}</Chip>
      ) : (
        <Chip tone="ok">{RECEIPT_STATUS.issued.en}</Chip>
      )}
      {row.changed ? <Chip tone="attention">{RECEIPT_STATUS.changed.en}</Chip> : null}
      {row.printCount > 1 ? <Chip tone="neutral">{RECEIPT_STATUS.duplicate.en}</Chip> : null}
      {row.status === "issued" && row.prasadam === "pending" ? <Chip tone="neutral">{RECEIPT_STATUS.prasadamPending.en}</Chip> : null}
      {row.refundState === "due" || row.refundState === "failed" ? (
        <Chip tone="attention">{RECEIPT_STATUS.refundDue.en}</Chip>
      ) : null}
    </span>
  );
}

export interface RegisterTableProps {
  rows: ReceiptListItem[];
  today: string;
  onOpen(row: ReceiptListItem): void;
}

const th = "px-3 py-2.5 text-left text-(length:--text-meta) font-semibold text-(--muted-foreground)";
const td = "px-3 py-2.5 align-top text-(length:--text-ui) text-(--foreground)";

/** The register as a table from 768 px up (DB §12.3); below that `ReceiptCards` shows the same rows. */
export function RegisterTable({ rows, today, onOpen }: RegisterTableProps): JSX.Element {
  return (
    <div data-testid="register-table" className="hidden overflow-x-auto rounded-(--radius-surface) border border-(--border) bg-(--card) md:block">
      <table className="w-full border-collapse">
        <thead className="border-b border-(--border) bg-(--secondary)">
          <tr>
            <th scope="col" className={th}>
              {REGISTER.columns.receiptNo}
            </th>
            <th scope="col" className={th}>
              {REGISTER.columns.time}
            </th>
            <th scope="col" className={th}>
              {REGISTER.columns.devotee}
            </th>
            <th scope="col" className={th}>
              {REGISTER.columns.sevas}
            </th>
            <th scope="col" className={`${th} text-right`}>
              {REGISTER.columns.amount}
            </th>
            <th scope="col" className={th}>
              {REGISTER.columns.mode}
            </th>
            <th scope="col" className={th}>
              {REGISTER.columns.status}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--border)">
          {rows.map((row) => (
            <tr key={row.id} data-status={row.status} className="hover:bg-(--secondary)">
              <td className={td}>
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  aria-label={REGISTER.open(row.receiptNo)}
                  className="font-mono font-semibold text-(--link) tabular-nums underline-offset-4 hover:underline focus-visible:underline"
                >
                  {row.receiptNo}
                </button>
              </td>
              <td className={`${td} whitespace-nowrap tabular-nums`}>{issuedWhen(row.issuedAt, today)}</td>
              <td className={td}>{row.devoteeName}</td>
              <td className={td}>{row.sevas}</td>
              <td className={`${td} text-right tabular-nums ${row.status === "cancelled" ? "line-through" : ""}`}>
                {rupees(row.totalPaise)}
              </td>
              <td className={td}>{MODE_LABEL[row.mode]}</td>
              <td className={td}>
                <ReceiptStatusChips row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RegisterTable;
