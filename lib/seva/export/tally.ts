/**
 * Tally import rows (DESIGN-BOOK 12.6, C-55). Per issued receipt: one debit line for the receipt total on the cash,
 * UPI or online ledger, then one credit line per distinct income ledger on that receipt (Amount Dr+ / Cr-). Cancelled
 * receipts are left out. The first row is the header, whose names the temple can map to its own Tally import.
 */
import { fromPaise } from "@/lib/seva/money";
import { toDayMonthYear } from "@/lib/seva/export/columns";
import type { ExportIncomeLedger, ExportReceiptRow } from "@/types/seva-export";

export interface TallyLedgers {
  cash: string;
  upi: string;
  online: string;
}

export interface TallyColumnNames {
  date: string;
  type: string;
  number: string;
  ledger: string;
  amount: string;
}

export const DEFAULT_TALLY_COLUMNS: TallyColumnNames = {
  date: "Voucher Date",
  type: "Voucher Type",
  number: "Voucher Number",
  ledger: "Ledger Name",
  amount: "Amount",
};

export const TALLY_VOUCHER_TYPE = "Receipt";

/** Default income ledger name for a seva when settings name none (C-55). */
export function defaultIncomeLedger(sevaName: string): string {
  return `Seva Income - ${sevaName}`;
}

function creditLedgers(row: ExportReceiptRow): ExportIncomeLedger[] {
  if (row.incomeLedgers.length === 0) {
    return [{ ledger: defaultIncomeLedger(row.sevas), amountPaise: row.amountPaise }];
  }
  const totals = new Map<string, number>();
  for (const entry of row.incomeLedgers) {
    totals.set(entry.ledger, (totals.get(entry.ledger) ?? 0) + entry.amountPaise);
  }
  return [...totals].map(([ledger, amountPaise]) => ({ ledger, amountPaise }));
}

export function tallyRows(
  rows: ExportReceiptRow[],
  ledgers: TallyLedgers,
  cols?: Partial<TallyColumnNames>,
): string[][] {
  const names: TallyColumnNames = { ...DEFAULT_TALLY_COLUMNS, ...cols };
  const out: string[][] = [[names.date, names.type, names.number, names.ledger, names.amount]];
  for (const row of rows) {
    if (row.status !== "issued") {
      continue;
    }
    const date = toDayMonthYear(row.date);
    out.push([date, TALLY_VOUCHER_TYPE, row.receiptNo, ledgers[row.mode], fromPaise(row.amountPaise)]);
    for (const credit of creditLedgers(row)) {
      out.push([date, TALLY_VOUCHER_TYPE, row.receiptNo, credit.ledger, fromPaise(-credit.amountPaise)]);
    }
  }
  return out;
}
