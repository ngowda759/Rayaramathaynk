/**
 * @jest-environment node
 */
import { tallyRows } from "@/lib/seva/export/tally";
import { receipt } from "./export-fixtures";

const ledgers = { cash: "Cash", upi: "UPI Collections", online: "Online Collections" };

describe("seva Tally export", () => {
  it("writes Tally lines: debit cash, credit the seva income ledger", () => {
    const rows = tallyRows([receipt()], ledgers);
    expect(rows[0]).toEqual(["Voucher Date", "Voucher Type", "Voucher Number", "Ledger Name", "Amount"]);
    expect(rows.slice(1)).toEqual([
      ["18-10-2026", "Receipt", "C1-023-10-2026/000124", "Cash", "610.00"],
      ["18-10-2026", "Receipt", "C1-023-10-2026/000124", "Seva Income - Paaduka Pooja", "-610.00"],
    ]);
  });

  it("writes one credit per income ledger on a multi-seva receipt", () => {
    const r = receipt({
      mode: "upi",
      amountPaise: 161500,
      incomeLedgers: [
        { ledger: "Seva Income - Paaduka Pooja", amountPaise: 61000 },
        { ledger: "Seva Income - Kanakabhisheka", amountPaise: 100500 },
      ],
    });
    const rows = tallyRows([r], ledgers).slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(["18-10-2026", "Receipt", r.receiptNo, "UPI Collections", "1615.00"]);
    expect(rows[1][3]).toBe("Seva Income - Paaduka Pooja");
    expect(rows[1][4]).toBe("-610.00");
    expect(rows[2][3]).toBe("Seva Income - Kanakabhisheka");
    expect(rows[2][4]).toBe("-1005.00");
  });

  it("merges repeated income ledgers on one receipt into a single credit", () => {
    const r = receipt({
      amountPaise: 122000,
      incomeLedgers: [
        { ledger: "Seva Income - Paaduka Pooja", amountPaise: 61000 },
        { ledger: "Seva Income - Paaduka Pooja", amountPaise: 61000 },
      ],
    });
    const rows = tallyRows([r], ledgers).slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[1][4]).toBe("-1220.00");
  });

  it("leaves cancelled receipts out of Tally and applies custom column names", () => {
    const rows = tallyRows(
      [receipt({ status: "cancelled" }), receipt({ receiptNo: "C1-023-10-2026/000125", mode: "online" })],
      ledgers,
      { date: "Date", ledger: "Particulars" },
    );
    expect(rows[0]).toEqual(["Date", "Voucher Type", "Voucher Number", "Particulars", "Amount"]);
    expect(rows.slice(1)).toHaveLength(2);
    expect(rows.slice(1).every((row) => row[2] === "C1-023-10-2026/000125")).toBe(true);
    expect(rows[1][3]).toBe("Online Collections");
  });
});
