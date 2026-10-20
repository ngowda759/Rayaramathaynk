import type { ExportData, ExportLineRow, ExportReceiptRow } from "@/types/seva-export";

export function receipt(overrides: Partial<ExportReceiptRow> = {}): ExportReceiptRow {
  return {
    receiptNo: "C1-023-10-2026/000124",
    series: "C1",
    date: "2026-10-18",
    time: "09:41",
    devoteeName: "Venkatesh Rao",
    sevas: "Paaduka Pooja",
    amountPaise: 61000,
    mode: "cash",
    status: "issued",
    gotra: "Kashyapa",
    nakshatra: "Rohini",
    rashi: "Vrishabha",
    sevaCodes: "PP",
    upiRefLast6: "",
    issuedBy: "Counter 1",
    prasadam: "pending",
    changed: false,
    cancelReason: "",
    incomeLedgers: [{ ledger: "Seva Income - Paaduka Pooja", amountPaise: 61000 }],
    phone: "9876543210",
    ...overrides,
  };
}

export function line(overrides: Partial<ExportLineRow> = {}): ExportLineRow {
  return {
    receiptNo: "C1-023-10-2026/000124",
    series: "C1",
    date: "2026-10-18",
    sevaCode: "PP",
    sevaName: "Paaduka Pooja",
    quantity: 1,
    unitRatePaise: 61000,
    amountPaise: 61000,
    mode: "cash",
    status: "issued",
    incomeLedger: "Seva Income - Paaduka Pooja",
    phone: "9876543210",
    ...overrides,
  };
}

export function exportData(overrides: Partial<ExportData> = {}): ExportData {
  return {
    range: { from: "2026-10-01", to: "2026-10-18", label: "This month" },
    preparedBy: "Temple admin",
    preparedAt: "2026-10-18T10:00:00+05:30",
    summary: [
      { label: "Receipts", value: "1" },
      { label: "Total", value: "Rs 610.00" },
    ],
    receipts: [receipt()],
    lines: [line()],
    sevas: [{ name: "Paaduka Pooja", count: 1, amountPaise: 61000, lastYearCount: null, lastYearAmountPaise: null }],
    cancelledChanged: [],
    dayCloses: [{ Date: "18-10-2026", Counter: "C1", Expected: 610, Counted: 610 }],
    prasadam: [{ Date: "18-10-2026", Given: 1, Pending: 0 }],
    rateChanges: [
      { seva: "Paaduka Pooja", oldPaise: 50000, newPaise: 61000, reason: "Board decision", by: "Admin", at: "2026-10-01T09:00:00+05:30" },
    ],
    ...overrides,
  };
}
