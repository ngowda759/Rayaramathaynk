/**
 * Shapes the seva export builders consume (DESIGN-BOOK section 12.6). The Export dialog pages the API into an
 * `ExportData` in the browser (C-41) and hands it to the CSV, Tally, zip and Excel builders in `lib/seva/export` and
 * `lib/seva/excel`. Every amount is integer paise; dates are ISO `YYYY-MM-DD` text.
 */
import type { PaymentMode } from "@/types/seva";

export type ExportReceiptStatus = "issued" | "cancelled";

export type ExportPrasadamState = "none" | "pending" | "given";

export interface ExportIncomeLedger {
  ledger: string;
  amountPaise: number;
}

export interface ExportReceiptRow {
  receiptNo: string;
  series: string;
  date: string;
  time: string;
  devoteeName: string;
  sevas: string;
  amountPaise: number;
  mode: PaymentMode;
  status: ExportReceiptStatus;
  gotra: string;
  nakshatra: string;
  rashi: string;
  sevaCodes: string;
  upiRefLast6: string;
  issuedBy: string;
  prasadam: ExportPrasadamState;
  changed: boolean;
  cancelReason: string;
  incomeLedgers: ExportIncomeLedger[];
  phone?: string;
}

export interface ExportLineRow {
  receiptNo: string;
  series: string;
  date: string;
  sevaCode: string;
  sevaName: string;
  quantity: number;
  unitRatePaise: number;
  amountPaise: number;
  mode: PaymentMode;
  status: ExportReceiptStatus;
  incomeLedger: string;
  phone?: string;
}

export interface ExportSevaRow {
  name: string;
  count: number;
  amountPaise: number;
  lastYearCount: number | null;
  lastYearAmountPaise: number | null;
}

export interface ExportRateChangeRow {
  seva: string;
  oldPaise: number | null;
  newPaise: number;
  reason: string;
  by: string;
  at: string;
}

export interface ExportData {
  range: { from: string; to: string; label: string };
  preparedBy: string;
  preparedAt: string;
  summary: { label: string; value: string }[];
  receipts: ExportReceiptRow[];
  lines: ExportLineRow[];
  sevas: ExportSevaRow[];
  cancelledChanged: ExportReceiptRow[];
  dayCloses: Record<string, string | number>[];
  prasadam: Record<string, string | number>[];
  rateChanges: ExportRateChangeRow[];
}

export interface ExportOptions {
  includePhones: boolean;
}

export type SheetCell = string | number;
