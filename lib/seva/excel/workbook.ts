/**
 * Excel workbooks for the seva module, built in the browser with one library (C-41):
 * - the Export workbook, seven sheets in the order of DESIGN-BOOK 12.6;
 * - the counter's day workbook (Summary and Receipts).
 * Amounts are numbers shown with two decimals; dates are real spreadsheet dates shown as DD-MM-YYYY.
 */
import ExcelJS from "exceljs";
import {
  RECEIPT_AMOUNT_COLUMN,
  RECEIPT_DATE_COLUMN,
  modeLabel,
  paiseToRupees,
  receiptColumns,
  receiptSheetRows,
  statusLabel,
  toDayMonthYear,
  toSheetDate,
} from "@/lib/seva/export/columns";
import type { PaymentMode } from "@/types/seva";
import type { ExportData, ExportOptions, ExportReceiptRow, SheetCell } from "@/types/seva-export";

export const EXPORT_SHEET_NAMES = [
  "Summary",
  "Receipts",
  "Sevas",
  "Cancelled and changed",
  "Day closes",
  "Prasadam",
  "Rate changes",
] as const;

const AMOUNT_FORMAT = "0.00";
const DATE_FORMAT = "dd-mm-yyyy";
const PAYMENT_MODES: readonly PaymentMode[] = ["cash", "upi", "online"];

type Cell = SheetCell | Date | null;

interface SheetSpec {
  header: readonly string[];
  rows: Cell[][];
  amountColumns?: readonly number[];
  dateColumns?: readonly number[];
}

function addSheet(workbook: ExcelJS.Workbook, name: string, spec: SheetSpec): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  if (spec.header.length > 0) {
    const headerRow = sheet.addRow([...spec.header]);
    headerRow.font = { bold: true };
  }
  for (const cells of spec.rows) {
    sheet.addRow(cells);
  }
  for (const col of spec.amountColumns ?? []) {
    sheet.getColumn(col).numFmt = AMOUNT_FORMAT;
  }
  for (const col of spec.dateColumns ?? []) {
    sheet.getColumn(col).numFmt = DATE_FORMAT;
  }
  spec.header.forEach((title, index) => {
    sheet.getColumn(index + 1).width = Math.max(12, title.length + 4);
  });
  return sheet;
}

/** Receipt rows with the Date column turned into a real date. */
function receiptRowsWithDates(rows: ExportReceiptRow[], opts: ExportOptions): Cell[][] {
  const sheetRows = receiptSheetRows(rows, opts);
  return sheetRows.map((cells, index) => {
    const out: Cell[] = [...cells];
    const date = toSheetDate(rows[index].date);
    if (date) {
      out[RECEIPT_DATE_COLUMN - 1] = date;
    }
    return out;
  });
}

function receiptsSpec(rows: ExportReceiptRow[], opts: ExportOptions): SheetSpec {
  return {
    header: receiptColumns(opts),
    rows: receiptRowsWithDates(rows, opts),
    amountColumns: [RECEIPT_AMOUNT_COLUMN],
    dateColumns: [RECEIPT_DATE_COLUMN],
  };
}

/** Header from the keys of free-form rows, in first-seen order. */
function recordSpec(records: Record<string, string | number>[]): SheetSpec {
  const header: string[] = [];
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!header.includes(key)) {
        header.push(key);
      }
    }
  }
  return { header, rows: records.map((record) => header.map((key) => record[key] ?? null)) };
}

function cancelledChangedSpec(rows: ExportReceiptRow[], opts: ExportOptions): SheetSpec {
  const header = ["Receipt no.", "Date", "Devotee", "Seva(s)", "Amount", "Mode", "Status", "Changed amount", "Reason", "Issued by"];
  if (opts.includePhones) {
    header.push("Phone");
  }
  return {
    header,
    rows: rows.map((row) => {
      const cells: Cell[] = [
        row.receiptNo,
        toSheetDate(row.date) ?? row.date,
        row.devoteeName,
        row.sevas,
        paiseToRupees(row.amountPaise),
        modeLabel(row.mode),
        statusLabel(row.status),
        row.changed ? "Yes" : "No",
        row.cancelReason,
        row.issuedBy,
      ];
      if (opts.includePhones) {
        cells.push(row.phone ?? "");
      }
      return cells;
    }),
    amountColumns: [5],
    dateColumns: [2],
  };
}

async function toArrayBuffer(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
  const written = await workbook.xlsx.writeBuffer();
  // Node returns a Buffer, the browser an ArrayBuffer; copying through a Uint8Array gives a plain ArrayBuffer in both.
  return new Uint8Array(written).buffer;
}

function newWorkbook(creator: string): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = creator;
  workbook.created = new Date();
  return workbook;
}

/** The Export dialog's workbook: Summary, Receipts, Sevas, Cancelled and changed, Day closes, Prasadam, Rate changes. */
export async function buildExportWorkbook(data: ExportData, opts: ExportOptions): Promise<ArrayBuffer> {
  const workbook = newWorkbook(data.preparedBy);
  const [summary, receipts, sevas, cancelled, dayCloses, prasadam, rateChanges] = EXPORT_SHEET_NAMES;

  addSheet(workbook, summary, {
    header: ["Item", "Value"],
    rows: [
      ["Range", `${data.range.label} (${toDayMonthYear(data.range.from)} to ${toDayMonthYear(data.range.to)})`],
      ["Prepared by", data.preparedBy],
      ["Prepared at", data.preparedAt],
      ...data.summary.map((item): Cell[] => [item.label, item.value]),
    ],
  });

  addSheet(workbook, receipts, receiptsSpec(data.receipts, opts));

  addSheet(workbook, sevas, {
    header: ["Seva", "Count", "Amount", "Last year count", "Last year amount"],
    rows: data.sevas.map((seva): Cell[] => [
      seva.name,
      seva.count,
      paiseToRupees(seva.amountPaise),
      seva.lastYearCount,
      seva.lastYearAmountPaise === null ? null : paiseToRupees(seva.lastYearAmountPaise),
    ]),
    amountColumns: [3, 5],
  });

  addSheet(workbook, cancelled, cancelledChangedSpec(data.cancelledChanged, opts));
  addSheet(workbook, dayCloses, recordSpec(data.dayCloses));
  addSheet(workbook, prasadam, recordSpec(data.prasadam));

  addSheet(workbook, rateChanges, {
    header: ["Seva", "Old rate", "New rate", "Reason", "Changed by", "Changed at"],
    rows: data.rateChanges.map((change): Cell[] => [
      change.seva,
      change.oldPaise === null ? null : paiseToRupees(change.oldPaise),
      paiseToRupees(change.newPaise),
      change.reason,
      change.by,
      change.at,
    ]),
    amountColumns: [2, 3],
  });

  return toArrayBuffer(workbook);
}

/** The counter's day copy: a Summary of the day's totals and the Receipts sheet (never with phone numbers). */
export async function buildDayWorkbook(
  rows: ExportReceiptRow[],
  meta: { date: string; counterName: string },
): Promise<ArrayBuffer> {
  const workbook = newWorkbook(meta.counterName);
  const issued = rows.filter((row) => row.status === "issued");
  const totalFor = (mode: PaymentMode): number =>
    issued.filter((row) => row.mode === mode).reduce((sum, row) => sum + row.amountPaise, 0);
  const totalPaise = issued.reduce((sum, row) => sum + row.amountPaise, 0);

  const summarySheet = addSheet(workbook, "Summary", {
    header: ["Item", "Value"],
    rows: [
      ["Date", toSheetDate(meta.date) ?? meta.date],
      ["Counter", meta.counterName],
      ["Receipts issued", issued.length],
      ["Receipts cancelled", rows.length - issued.length],
      ...PAYMENT_MODES.map((mode): Cell[] => [`${modeLabel(mode)} total`, paiseToRupees(totalFor(mode))]),
      ["Total", paiseToRupees(totalPaise)],
    ],
  });
  // Row 1 is the header: B2 is the date, B6..B9 the three mode totals and the grand total.
  summarySheet.getCell("B2").numFmt = DATE_FORMAT;
  for (let row = 6; row <= 9; row += 1) {
    summarySheet.getCell(`B${row}`).numFmt = AMOUNT_FORMAT;
  }

  addSheet(workbook, "Receipts", receiptsSpec(rows, { includePhones: false }));
  return toArrayBuffer(workbook);
}
