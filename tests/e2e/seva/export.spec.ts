import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { strFromU8, unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import type { SevaSummaryReport } from "../../../lib/seva/server/reports";
import type { ExportLineRow, ExportReceiptRow } from "../../../types/seva-export";
import { signInAs, type E2ERole } from "./fixtures/auth";
import { createFakeSevaApi, type FakeSevaApi } from "./fixtures/fake-api";

/**
 * Export page and the board print summary (plan A4-8, DB §12.6). Every /api/seva/** call is answered by the fake API;
 * this file answers the export pages (receipts in two pages, to exercise paging), the seva summary and the day
 * closes in their real wire shapes. The export audit uses the fake's built-in route, so its role checks apply.
 */

const PAGE = "/admin/receipts/reports/export";
const SUMMARY = "/admin/receipts/reports/summary?from=2026-10-01&to=2026-10-18";

function receipt(over: Partial<ExportReceiptRow>): ExportReceiptRow {
  return {
    receiptNo: "C1-023-10-2026/000101",
    series: "C1",
    date: "2026-10-02",
    time: "06:32",
    devoteeName: "Raghavendra Joshi",
    sevas: "Archane with Arati",
    amountPaise: 5_000,
    mode: "cash",
    status: "issued",
    gotra: "Bharadwaja",
    nakshatra: "Ashwini",
    rashi: "Mesha",
    sevaCodes: "AR",
    upiRefLast6: "",
    issuedBy: "Lakshmi R",
    prasadam: "given",
    changed: false,
    cancelReason: "",
    incomeLedgers: [{ ledger: "Seva Income - Archane with Arati", amountPaise: 5_000 }],
    ...over,
  };
}

const RECEIPT_PAGES: ExportReceiptRow[][] = [
  [
    receipt({}),
    receipt({
      receiptNo: "C1-023-10-2026/000102",
      devoteeName: "Sudha Rao",
      sevas: "Paaduka Pooja",
      sevaCodes: "PP",
      amountPaise: 50_500,
      mode: "upi",
      upiRefLast6: "402991",
      incomeLedgers: [{ ledger: "Seva Income - Paaduka Pooja", amountPaise: 50_500 }],
    }),
  ],
  [
    receipt({
      receiptNo: "C1-023-10-2026/000103",
      date: "2026-10-03",
      status: "cancelled",
      cancelReason: "Wrong seva - devotee wanted Pushpalankara",
      prasadam: "none",
    }),
  ],
];

const LINES: ExportLineRow[] = [
  {
    receiptNo: "C1-023-10-2026/000101",
    series: "C1",
    date: "2026-10-02",
    sevaCode: "AR",
    sevaName: "Archane with Arati",
    quantity: 1,
    unitRatePaise: 5_000,
    amountPaise: 5_000,
    mode: "cash",
    status: "issued",
    incomeLedger: "Seva Income - Archane with Arati",
  },
];

const SEVA_SUMMARY: SevaSummaryReport = {
  from: "2026-10-01",
  to: "2026-10-18",
  lastYearFrom: "2025-10-01",
  lastYearTo: "2025-10-18",
  sevas: [
    {
      sevaId: "seva-pp",
      nameEn: "Paaduka Pooja",
      nameKn: "ಪಾದುಕಾ ಪೂಜೆ",
      category: null,
      receipts: 1,
      quantity: 1,
      amountPaise: 50_500,
      lastYear: { receipts: 2, quantity: 2, amountPaise: 101_000 },
    },
    {
      sevaId: "seva-ar",
      nameEn: "Archane with Arati",
      nameKn: null,
      category: null,
      receipts: 1,
      quantity: 1,
      amountPaise: 5_000,
      lastYear: { receipts: 0, quantity: 0, amountPaise: 0 },
    },
  ],
  totals: { receipts: 2, amountPaise: 55_500, lastYearReceipts: 2, lastYearAmountPaise: 101_000 },
  rateChanges: [
    { sevaId: "seva-pp", nameEn: "Paaduka Pooja", oldPaise: 30_500, newPaise: 50_500, changedAt: "2026-10-05T04:30:00.000Z", reason: "Board decision" },
  ],
};

function exportAnswer(path: string): { rows: unknown[]; nextCursor: string | null } {
  const query = new URL(path, "http://x").searchParams;
  const part = query.get("part");
  const cursor = query.get("cursor");
  if (part === "receipts") {
    return cursor === "1000" ? { rows: RECEIPT_PAGES[1], nextCursor: null } : { rows: RECEIPT_PAGES[0], nextCursor: "1000" };
  }
  if (part === "cancelled") return { rows: [RECEIPT_PAGES[1][0]], nextCursor: null };
  if (part === "lines") return { rows: LINES, nextCursor: null };
  if (part === "sevas") {
    return { rows: [{ name: "Paaduka Pooja", count: 1, amountPaise: 50_500, lastYearCount: 2, lastYearAmountPaise: 101_000 }], nextCursor: null };
  }
  return { rows: [], nextCursor: null };
}

async function openAs(page: Page, role: E2ERole, target = PAGE): Promise<FakeSevaApi> {
  const fake = createFakeSevaApi();
  fake.extend({
    "GET reports/export": (req) => exportAnswer(req.path),
    "GET reports/seva-summary": () => SEVA_SUMMARY,
    "GET reports/day-closes": () => [],
    "GET reports/continuity": () => [],
  });
  await fake.install(page);
  await signInAs(page, role, { redirect: target });
  return fake;
}

function auditBodies(fake: FakeSevaApi): { format: string; includePhones: boolean; parts: string[] }[] {
  return fake.requests
    .filter((r) => r.method === "POST" && r.path.includes("/reports/export/audit"))
    .map((r) => r.body as { format: string; includePhones: boolean; parts: string[] });
}

async function download(page: Page, label: RegExp): Promise<{ file: Download; bytes: Buffer }> {
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: label }).click()]);
  const path = await file.path();
  return { file, bytes: await readFile(path) };
}

test("the phone checkbox is hidden for a view-only temple admin", async ({ page }) => {
  await openAs(page, "temple_admin_view_only");
  await expect(page.getByRole("button", { name: /Prepare Excel file/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /^Receipts/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Devotee phone numbers/ })).toHaveCount(0);
});

test("a temple admin sees the phone checkbox, off by default", async ({ page }) => {
  await openAs(page, "temple_admin");
  const phones = page.getByRole("checkbox", { name: /Devotee phone numbers/ });
  await expect(phones).toBeVisible();
  await expect(phones).not.toBeChecked();
});

test("Excel download has seven sheets", async ({ page }) => {
  await openAs(page, "temple_admin");
  const { file, bytes } = await download(page, /Prepare Excel file/);
  expect(file.suggestedFilename()).toMatch(/^seva-export-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.xlsx$/);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(bytes).buffer);
  expect(workbook.worksheets.map((ws) => ws.name)).toEqual([
    "Summary",
    "Receipts",
    "Sevas",
    "Cancelled and changed",
    "Day closes",
    "Prasadam",
    "Rate changes",
  ]);
  // Both pages of receipts arrived (header + 3 rows), and no phone column.
  const receipts = workbook.getWorksheet("Receipts");
  expect(receipts?.rowCount).toBe(4);
  expect(receipts?.getRow(1).values).not.toContain("Phone");
  await expect(page.getByText("The file is ready and saved to your downloads.")).toBeVisible();
});

test("CSV parts download as one zip; Tally has its header row", async ({ page }) => {
  await openAs(page, "temple_admin");

  await page.getByRole("radio", { name: /^CSV/ }).click();
  await page.getByRole("checkbox", { name: /Prasadam given or pending/ }).uncheck();
  const csv = await download(page, /Prepare CSV files/);
  expect(csv.file.suggestedFilename()).toMatch(/\.zip$/);
  const files = unzipSync(new Uint8Array(csv.bytes));
  const names = Object.keys(files);
  expect(names).toHaveLength(6);
  expect(names.some((n) => n.startsWith("prasadam-"))).toBe(false);
  const receiptsName = names.find((n) => n.startsWith("receipts-"));
  expect(receiptsName).toBeDefined();
  const receiptsCsv = strFromU8(files[receiptsName as string]);
  expect(receiptsCsv.split("\r\n")[0]).toBe("﻿receipt_no,series,date,seva_code,amount,mode,status,seva_name,quantity,unit_rate,income_ledger");

  await page.getByRole("radio", { name: /^Tally import/ }).click();
  const tally = await download(page, /Prepare Tally file/);
  expect(tally.file.suggestedFilename()).toMatch(/^tally-receipts-.*\.csv$/);
  const lines = tally.bytes.toString("utf8").split("\r\n");
  expect(lines[0]).toBe("﻿Voucher Date,Voucher Type,Voucher Number,Ledger Name,Amount");
  // Two issued receipts, a debit and a credit each; the cancelled one is left out.
  expect(lines.filter((l) => l.trim() !== "")).toHaveLength(5);
  expect(tally.bytes.toString("utf8")).not.toContain("000103");
});

test("every download writes the export audit", async ({ page }) => {
  const fake = await openAs(page, "temple_admin");
  await download(page, /Prepare Excel file/);
  await page.getByRole("radio", { name: /^CSV/ }).click();
  await download(page, /Prepare CSV files/);
  await page.getByRole("radio", { name: /^Tally import/ }).click();
  await download(page, /Prepare Tally file/);

  await expect.poll(() => auditBodies(fake).map((b) => b.format)).toEqual(["xlsx", "csv", "tally"]);
  for (const body of auditBodies(fake)) expect(body.includePhones).toBe(false);
  expect(auditBodies(fake)[1].parts).toContain("lines");

  await page.goto(SUMMARY);
  await expect(page.getByTestId("board-preview")).toBeVisible();
  await expect.poll(() => auditBodies(fake).map((b) => b.format)).toEqual(["xlsx", "csv", "tally", "print"]);
});

test("the board summary prints on two A4 pages", async ({ page }) => {
  await openAs(page, "temple_admin", SUMMARY);
  const preview = page.getByTestId("board-preview");
  await expect(preview).toBeVisible();
  await expect(preview.getByText("Paaduka Pooja").first()).toBeVisible();
  await expect(preview.getByText("Wrong seva - devotee wanted Pushpalankara")).toBeVisible();
  await expect(preview.getByTestId("board-chart")).toBeVisible();

  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const doc = await PDFDocument.load(pdf);
  const pages = doc.getPages();
  expect(pages).toHaveLength(2);
  for (const p of pages) {
    const { width, height } = p.getSize();
    expect(width).toBeCloseTo(595.3, 0);
    expect(height).toBeCloseTo(841.9, 0);
  }
});
