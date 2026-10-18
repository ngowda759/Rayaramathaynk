/**
 * @jest-environment node
 */
import { unzipSync, strFromU8 } from "fflate";
import { RECEIPT_COLUMNS, receiptSheetRows } from "@/lib/seva/export/columns";
import { buildCsv, lineCsv } from "@/lib/seva/export/csv";
import { zipFiles } from "@/lib/seva/export/zip";
import { line, receipt } from "./export-fixtures";

describe("seva CSV export", () => {
  it("quotes commas, quotes and new lines, keeps Kannada and starts with a BOM", () => {
    const csv = buildCsv(["Devotee", "Amount"], [['Rao, "Venkatesh"\n', 610], ["ವೆಂಕಟೇಶ", "plain"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('Devotee,Amount\r\n"Rao, ""Venkatesh""\n",610\r\nವೆಂಕಟೇಶ,plain\r\n');
  });

  it("leaves the phone column out unless includePhones", () => {
    expect(RECEIPT_COLUMNS).not.toContain("Phone");
    const without = receiptSheetRows([receipt()], { includePhones: false });
    const withPhones = receiptSheetRows([receipt()], { includePhones: true });
    expect(without[0]).toHaveLength(RECEIPT_COLUMNS.length);
    expect(without[0]).not.toContain("9876543210");
    expect(withPhones[0]).toHaveLength(RECEIPT_COLUMNS.length + 1);
    expect(withPhones[0][RECEIPT_COLUMNS.length]).toBe("9876543210");

    const noPhoneCsv = lineCsv([line()], { includePhones: false });
    const phoneCsv = lineCsv([line()], { includePhones: true });
    expect(noPhoneCsv).not.toContain("9876543210");
    expect(noPhoneCsv).not.toContain("phone");
    expect(phoneCsv).toContain("phone");
    expect(phoneCsv).toContain("9876543210");
    expect(noPhoneCsv.slice(1).startsWith("receipt_no,series,date,seva_code,amount,mode,status")).toBe(true);
    expect(noPhoneCsv).toContain("C1-023-10-2026/000124,C1,18-10-2026,PP,610.00,cash,issued");
  });

  it("zips several CSV parts", () => {
    const a = buildCsv(["a"], [[1]]);
    const b = buildCsv(["b"], [["ವ"]]);
    const zipped = zipFiles([
      { name: "receipts.csv", content: a },
      { name: "lines.csv", content: b },
    ]);
    const out = unzipSync(zipped);
    expect(Object.keys(out).sort()).toEqual(["lines.csv", "receipts.csv"]);
    // strFromU8 decodes with a TextDecoder that drops the BOM, so compare the raw bytes as well.
    expect(Array.from(out["receipts.csv"].slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(Buffer.from(out["receipts.csv"]).equals(Buffer.from(a, "utf8"))).toBe(true);
    expect(Buffer.from(out["lines.csv"]).equals(Buffer.from(b, "utf8"))).toBe(true);
    expect(strFromU8(out["lines.csv"])).toBe(b.slice(1));
  });
});
