/**
 * @jest-environment node
 */
import ExcelJS from "exceljs";
import { buildDayWorkbook, buildExportWorkbook } from "@/lib/seva/excel/workbook";
import { exportData, receipt } from "./export-fixtures";

async function load(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

describe("seva Excel workbooks", () => {
  it("builds the export workbook with the seven sheets in order", async () => {
    const wb = await load(await buildExportWorkbook(exportData(), { includePhones: false }));
    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      "Summary",
      "Receipts",
      "Sevas",
      "Cancelled and changed",
      "Day closes",
      "Prasadam",
      "Rate changes",
    ]);
    const receipts = wb.getWorksheet("Receipts");
    expect(receipts?.getRow(1).getCell(1).value).toBe("Receipt no.");
    expect(receipts?.getRow(2).getCell(7).value).toBe(610);
    expect(receipts?.getRow(2).getCell(7).numFmt).toBe("0.00");
    expect(receipts?.getRow(2).getCell(3).value).toBeInstanceOf(Date);
    const values = (receipts?.getRow(2).values ?? []) as unknown[];
    expect(values).not.toContain("9876543210");
  });

  it("round-trips a Kannada devotee name through xlsx", async () => {
    const name = "ವೆಂಕಟೇಶ ರಾವ್";
    const wb = await load(
      await buildExportWorkbook(exportData({ receipts: [receipt({ devoteeName: name })] }), { includePhones: true }),
    );
    const row = wb.getWorksheet("Receipts")?.getRow(2);
    expect(row?.getCell(5).value).toBe(name);
    expect(((row?.values ?? []) as unknown[]).includes("9876543210")).toBe(true);
  });

  it("builds the day workbook with Summary and Receipts sheets", async () => {
    const wb = await load(
      await buildDayWorkbook(
        [receipt(), receipt({ receiptNo: "C1-023-10-2026/000125", mode: "upi", amountPaise: 10500 })],
        { date: "2026-10-18", counterName: "Counter 1" },
      ),
    );
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["Summary", "Receipts"]);
    expect(wb.getWorksheet("Receipts")?.rowCount).toBe(3);
    // The day copy never carries phone numbers (C-16), even though the fixture rows have one.
    for (const sheet of wb.worksheets) {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          expect(String(cell.value)).not.toContain("9876543210");
        });
      });
    }
  });

  it("labels the changed column and writes timestamps as IST text", async () => {
    const changed = receipt({ status: "cancelled", changed: true, cancelReason: "Wrong seva" });
    const wb = await load(await buildExportWorkbook(exportData({ cancelledChanged: [changed] }), { includePhones: false }));
    const cancelled = wb.getWorksheet("Cancelled and changed");
    expect(cancelled?.getRow(1).getCell(8).value).toBe("Changed");
    expect(cancelled?.getRow(2).getCell(8).value).toBe("Yes");
    expect(wb.getWorksheet("Summary")?.getRow(4).getCell(2).value).toBe("18-10-2026 10:00");
    expect(wb.getWorksheet("Rate changes")?.getRow(2).getCell(6).value).toBe("01-10-2026 09:00");
  });
});
