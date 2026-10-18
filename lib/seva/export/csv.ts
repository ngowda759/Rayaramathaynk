/**
 * RFC 4180 CSV for the seva exports: CRLF line ends, fields quoted when they hold a comma, quote or line break, and a
 * UTF-8 byte-order mark so Excel opens Kannada text correctly (DESIGN-BOOK 12.6). Text fields that would start a
 * formula get a leading single quote.
 */
import { fromPaise } from "@/lib/seva/money";
import { toDayMonthYear } from "@/lib/seva/export/columns";
import type { ExportLineRow, ExportOptions, SheetCell } from "@/types/seva-export";

const BOM = "﻿";
const CRLF = "\r\n";
const NEEDS_QUOTES = /[",\r\n]/;
/** A leading character that makes Excel or Sheets read the field as a formula (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;
/** Plain signed decimals (e.g. Tally credits like -610.00) are data, not formulas, and stay unchanged. */
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export const LINE_COLUMNS: readonly string[] = [
  "receipt_no",
  "series",
  "date",
  "seva_code",
  "amount",
  "mode",
  "status",
  "seva_name",
  "quantity",
  "unit_rate",
  "income_ledger",
];

/**
 * Text typed at the counter or online (names, gotra, reasons) can start with = + - @; prefixing a single quote stops a
 * spreadsheet from running it as a formula when an admin opens the file.
 */
function neutraliseFormula(value: SheetCell): string {
  const text = String(value);
  if (typeof value === "number" || PLAIN_NUMBER.test(text) || !FORMULA_START.test(text)) {
    return text;
  }
  return `'${text}`;
}

function csvField(value: SheetCell): string {
  const text = neutraliseFormula(value);
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRecord(cells: readonly SheetCell[]): string {
  return cells.map(csvField).join(",") + CRLF;
}

/** Builds a CSV document: BOM, the header record, then one record per row, every record ending in CRLF. */
export function buildCsv(header: readonly string[], rows: SheetCell[][]): string {
  return BOM + csvRecord(header) + rows.map(csvRecord).join("");
}

/** One CSV row per seva line; the phone column only when includePhones (C-16). */
export function lineCsv(rows: ExportLineRow[], opts: ExportOptions): string {
  const header = opts.includePhones ? [...LINE_COLUMNS, "phone"] : [...LINE_COLUMNS];
  const records = rows.map((row) => {
    const cells: SheetCell[] = [
      row.receiptNo,
      row.series,
      toDayMonthYear(row.date),
      row.sevaCode,
      fromPaise(row.amountPaise),
      row.mode,
      row.status,
      row.sevaName,
      row.quantity,
      fromPaise(row.unitRatePaise),
      row.incomeLedger,
    ];
    if (opts.includePhones) {
      cells.push(row.phone ?? "");
    }
    return cells;
  });
  return buildCsv(header, records);
}
