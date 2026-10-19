/**
 * @jest-environment node
 */
import {
  boardAttention,
  collectExportData,
  collectionsChart,
  csvFiles,
  exportFileName,
  partsFor,
  quickRange,
  summaryItems,
  type ExportApi,
} from "@/lib/seva/export/collect";
import { EXPORT_SHEET_NAMES } from "@/lib/seva/excel/workbook";
import type { ExportPart } from "@/lib/seva/schemas";
import { SHEET_NAMES_PREVIEW } from "@/lib/seva/strings/export";
import type { ExportPage } from "@/services/seva/reports.service";
import { exportData, line, receipt } from "./export-fixtures";

type Call = { part: ExportPart; from: string; to: string; cursor?: string; includePhones: boolean };

/** A fake `reportsApi().export` that answers each part from a list of pages, keyed by cursor. */
function fakeApi(pages: Partial<Record<ExportPart, ExportPage[]>>): { api: ExportApi; calls: Call[] } {
  const calls: Call[] = [];
  const api: ExportApi = {
    async export(p) {
      calls.push({ ...p });
      const list = pages[p.part] ?? [{ rows: [], nextCursor: null }];
      const index = p.cursor ? Number(p.cursor) / 1000 : 0;
      return list[index] ?? { rows: [], nextCursor: null };
    },
  };
  return { api, calls };
}

describe("collectExportData", () => {
  it("pages through every part until nextCursor is null", async () => {
    const { api, calls } = fakeApi({
      receipts: [
        { rows: [receipt({ receiptNo: "A" })], nextCursor: "1000" },
        { rows: [receipt({ receiptNo: "B" })], nextCursor: "2000" },
        { rows: [receipt({ receiptNo: "C" })], nextCursor: null },
      ],
      lines: [
        { rows: [line()], nextCursor: "1000" },
        { rows: [], nextCursor: null },
      ],
      rateChanges: [{ rows: [{ seva: "PP", oldPaise: 100, newPaise: 200, reason: "r", by: "b", at: "x" }], nextCursor: null }],
    });

    const data = await collectExportData(
      { from: "2026-10-01", to: "2026-10-18", parts: ["receipts", "lines", "rateChanges"], includePhones: false },
      api,
    );

    expect(data.receipts.map((r) => r.receiptNo)).toEqual(["A", "B", "C"]);
    expect(data.lines).toHaveLength(1);
    expect(data.rateChanges).toHaveLength(1);
    expect(data.sevas).toEqual([]);
    expect(calls.filter((c) => c.part === "receipts").map((c) => c.cursor)).toEqual([undefined, "1000", "2000"]);
    expect(calls.filter((c) => c.part === "lines").map((c) => c.cursor)).toEqual([undefined, "1000"]);
    expect(calls.every((c) => c.from === "2026-10-01" && c.to === "2026-10-18" && c.includePhones === false)).toBe(true);
    expect(data.range).toMatchObject({ from: "2026-10-01", to: "2026-10-18" });
  });

  it("stops with an error when the API answers the same cursor twice", async () => {
    const api: ExportApi = { export: async () => ({ rows: [receipt()], nextCursor: "1000" }) };
    await expect(
      collectExportData({ from: "2026-10-01", to: "2026-10-18", parts: ["receipts"], includePhones: false }, api),
    ).rejects.toThrow("export_paging");
  });

  it("refuses a part it does not know", async () => {
    const { api } = fakeApi({});
    await expect(
      collectExportData({ from: "2026-10-01", to: "2026-10-18", parts: ["phones"], includePhones: false }, api),
    ).rejects.toThrow("unknown_part");
  });

  it("passes the phone flag on to every page", async () => {
    const { api, calls } = fakeApi({});
    await collectExportData({ from: "2026-10-01", to: "2026-10-01", parts: ["receipts", "cancelled"], includePhones: true }, api);
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.includePhones)).toBe(true);
  });

  it("totals only issued receipts in the summary", async () => {
    const { api } = fakeApi({
      receipts: [
        {
          rows: [
            receipt({ amountPaise: 61000, mode: "cash" }),
            receipt({ amountPaise: 10500, mode: "upi" }),
            receipt({ amountPaise: 5000, mode: "cash", status: "cancelled" }),
            receipt({ amountPaise: 30000, mode: "cash", changed: true }),
          ],
          nextCursor: null,
        },
      ],
    });
    const data = await collectExportData({ from: "2026-10-01", to: "2026-10-18", parts: ["receipts"], includePhones: false }, api);
    const byLabel = Object.fromEntries(data.summary.map((s) => [s.label, s.value]));
    expect(byLabel["Total collected"]).toBe("Rs 1,015.00");
    expect(byLabel["Receipts issued"]).toBe("3");
    expect(byLabel["Cash"]).toBe("Rs 910.00");
    expect(byLabel["UPI"]).toBe("Rs 105.00");
    expect(byLabel["Cancelled"]).toBe("1");
    expect(byLabel["Changed amounts"]).toBe("1");
  });
});

describe("export choices", () => {
  it("maps the ticked items to the API parts for each format", () => {
    const all = ["summary", "receipts", "sevas", "cancelled", "dayCloses", "prasadam", "rateChanges"] as const;
    expect(partsFor("xlsx", [...all])).toEqual(["receipts", "sevas", "cancelled", "dayCloses", "prasadam", "rateChanges"]);
    expect(partsFor("xlsx", ["summary", "sevas"])).toEqual(["receipts", "sevas"]);
    expect(partsFor("csv", ["receipts", "sevas"])).toEqual(["lines", "sevas"]);
    expect(partsFor("csv", ["summary", "receipts"])).toEqual(["receipts", "lines"]);
    expect(partsFor("tally", ["sevas"])).toEqual(["receipts"]);
  });

  it("works out the quick ranges in IST", () => {
    const now = new Date("2026-01-10T20:00:00.000Z"); // 11 Jan 2026, 01:30 IST
    expect(quickRange("today", now)).toEqual({ from: "2026-01-11", to: "2026-01-11" });
    expect(quickRange("month", now)).toEqual({ from: "2026-01-01", to: "2026-01-11" });
    expect(quickRange("lastMonth", now)).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(quickRange("year", now)).toEqual({ from: "2026-01-01", to: "2026-01-11" });
  });

  it("makes one CSV file per ticked part, the receipts as seva lines", () => {
    const files = csvFiles(exportData(), ["summary", "receipts", "sevas", "rateChanges"], { includePhones: false });
    expect(files.map((f) => f.name)).toEqual([
      "summary-2026-10-01-to-2026-10-18.csv",
      "receipts-2026-10-01-to-2026-10-18.csv",
      "sevas-2026-10-01-to-2026-10-18.csv",
      "rate-changes-2026-10-01-to-2026-10-18.csv",
    ]);
    const receipts = files[1].content as string;
    expect(receipts.split("\r\n")[0]).toBe("﻿receipt_no,series,date,seva_code,amount,mode,status,seva_name,quantity,unit_rate,income_ledger");
    expect(receipts).not.toContain("9876543210");
  });

  it("previews the same sheet names the workbook writes", () => {
    expect([...SHEET_NAMES_PREVIEW]).toEqual([...EXPORT_SHEET_NAMES]);
  });

  it("names the files by format and range", () => {
    expect(exportFileName("xlsx", "2026-10-01", "2026-10-18")).toBe("seva-export-2026-10-01-to-2026-10-18.xlsx");
    expect(exportFileName("csv", "2026-10-01", "2026-10-18")).toBe("seva-export-2026-10-01-to-2026-10-18.zip");
    expect(exportFileName("tally", "2026-10-01", "2026-10-18")).toBe("tally-receipts-2026-10-01-to-2026-10-18.csv");
  });
});

describe("board summary helpers", () => {
  it("buckets collections by day for a month and by month for a year, with the previous span", () => {
    const current = [
      receipt({ date: "2026-10-01", amountPaise: 10000, mode: "cash" }),
      receipt({ date: "2026-10-03", amountPaise: 5000, mode: "upi" }),
      receipt({ date: "2026-10-03", amountPaise: 7000, mode: "cash", status: "cancelled" }),
    ];
    const prev = [receipt({ date: "2026-09-30", amountPaise: 2000 })];
    const byDay = collectionsChart(current, prev, { from: "2026-10-01", to: "2026-10-03" }, { from: "2026-09-28", to: "2026-09-30" });
    expect(byDay.buckets.map((b) => b.label)).toEqual(["1 Oct", "2 Oct", "3 Oct"]);
    expect(byDay.buckets.map((b) => [b.cashPaise, b.upiPaise])).toEqual([[10000, 0], [0, 0], [0, 5000]]);
    expect(byDay.prev).toEqual([
      { key: byDay.buckets[0].key, totalPaise: 0 },
      { key: byDay.buckets[1].key, totalPaise: 0 },
      { key: byDay.buckets[2].key, totalPaise: 2000 },
    ]);

    const byMonth = collectionsChart([receipt({ date: "2026-03-15" })], [], { from: "2026-01-01", to: "2026-04-10" }, null);
    expect(byMonth.buckets.map((b) => b.label)).toEqual(["Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026"]);
    expect(byMonth.prev).toEqual([]);
  });

  it("lists what needs attention in the range", () => {
    const items = boardAttention({
      receipts: [
        receipt({ changed: true }),
        receipt({ status: "cancelled" }),
        receipt({ status: "cancelled" }),
        receipt({ prasadam: "pending" }),
      ],
      dayCloseDifferences: 1,
      openGaps: 0,
    });
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId.changed_amounts.count).toBe(1);
    expect(byId.cancellations.count).toBe(2);
    expect(byId.day_close_difference).toMatchObject({ count: 1, level: "critical" });
    expect(byId.number_gaps).toMatchObject({ count: 0, level: "ok" });
    expect(byId.prasadam_pending.count).toBe(2);
  });

  it("summary items follow the money rules", () => {
    const items = summaryItems([receipt({ amountPaise: 100, mode: "online" })]);
    expect(items.find((i) => i.label === "Online")?.value).toBe("Rs 1.00");
  });
});
