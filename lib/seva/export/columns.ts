/**
 * Column sets and row shaping shared by the CSV and Excel exports (DESIGN-BOOK 12.6). Amounts become rupee numbers
 * with two decimals; the phone column is added only when the caller allows it (C-16).
 */
import { fromPaise } from "@/lib/seva/money";
import type { PaymentMode } from "@/types/seva";
import type {
  ExportOptions,
  ExportPrasadamState,
  ExportReceiptRow,
  ExportReceiptStatus,
  SheetCell,
} from "@/types/seva-export";

export const RECEIPT_COLUMNS: readonly string[] = [
  "Receipt no.",
  "Series",
  "Date",
  "Time",
  "Devotee",
  "Seva(s)",
  "Amount",
  "Mode",
  "Status",
  "Gotra",
  "Nakshatra",
  "Rashi",
  "Seva code",
  "UPI ref (last 6)",
  "Issued by",
  "Prasadam",
];

export const PHONE_COLUMN = "Phone";

/** 1-based positions in RECEIPT_COLUMNS that the Excel builder formats as a date and as an amount. */
export const RECEIPT_DATE_COLUMN = RECEIPT_COLUMNS.indexOf("Date") + 1;
export const RECEIPT_AMOUNT_COLUMN = RECEIPT_COLUMNS.indexOf("Amount") + 1;

const MODE_LABELS: Record<PaymentMode, string> = { cash: "Cash", upi: "UPI", online: "Online" };
const STATUS_LABELS: Record<ExportReceiptStatus, string> = { issued: "Issued", cancelled: "Cancelled" };
const PRASADAM_LABELS: Record<ExportPrasadamState, string> = { none: "None", pending: "Pending", given: "Given" };

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Integer paise to a rupee number with two decimals: 61050 -> 610.5 (shown as 610.50 by the sheet format). */
export function paiseToRupees(paise: number): number {
  return Number(fromPaise(paise));
}

/** ISO `YYYY-MM-DD` (optionally followed by a time) to `DD-MM-YYYY`; any other text is returned unchanged. */
export function toDayMonthYear(date: string): string {
  const match = ISO_DATE.exec(date);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : date;
}

/** ISO `YYYY-MM-DD` to a UTC-midnight Date for a real spreadsheet date; null when the text is not an ISO date. */
export function toSheetDate(date: string): Date | null {
  const match = ISO_DATE.exec(date);
  if (!match) {
    return null;
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function modeLabel(mode: PaymentMode): string {
  return MODE_LABELS[mode];
}

export function statusLabel(status: ExportReceiptStatus): string {
  return STATUS_LABELS[status];
}

export function receiptColumns(opts: ExportOptions): string[] {
  return opts.includePhones ? [...RECEIPT_COLUMNS, PHONE_COLUMN] : [...RECEIPT_COLUMNS];
}

/** One sheet row per receipt in RECEIPT_COLUMNS order (plus Phone when includePhones); dates as DD-MM-YYYY text. */
export function receiptSheetRows(rows: ExportReceiptRow[], opts: ExportOptions): SheetCell[][] {
  return rows.map((row) => {
    const cells: SheetCell[] = [
      row.receiptNo,
      row.series,
      toDayMonthYear(row.date),
      row.time,
      row.devoteeName,
      row.sevas,
      paiseToRupees(row.amountPaise),
      modeLabel(row.mode),
      statusLabel(row.status),
      row.gotra,
      row.nakshatra,
      row.rashi,
      row.sevaCodes,
      row.upiRefLast6,
      row.issuedBy,
      PRASADAM_LABELS[row.prasadam],
    ];
    if (opts.includePhones) {
      cells.push(row.phone ?? "");
    }
    return cells;
  });
}
