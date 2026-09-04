import {
  buildUpiPaymentUrl,
  formatPdfAmount,
  DEFAULT_UPI_ID,
} from "@/lib/receipt/upi";
import { computeItemAmount, computeReceiptTotals } from "@/lib/receipt/validation";
import { formatReceiptNumber, parseReceiptYear } from "@/lib/receipt/numbering";

describe("receipt UPI payment", () => {
  it("builds a upi://pay deep link with payer, amount and currency", () => {
    const url = buildUpiPaymentUrl({
      upiId: DEFAULT_UPI_ID,
      payeeName: "Sri Raghavendra Swamy Matha",
      amount: 105,
      note: "Temple seva receipt",
    });
    expect(url.startsWith("upi://pay?")).toBe(true);
    expect(url).toContain("pa=9886364462%40ptsbi");
    expect(url).toContain("am=105");
    expect(url).toContain("cu=INR");
    expect(url).toContain("pn=Sri+Raghavendra+Swamy+Matha");
  });

  it("defaults the UPI id when not supplied", () => {
    expect(DEFAULT_UPI_ID).toBe("9886364462@ptsbi");
  });

  it("formats amounts for PDF receipts without the rupee glyph", () => {
    expect(formatPdfAmount(1110)).toBe("Rs. 1,110");
    expect(formatPdfAmount(105)).toBe("Rs. 105");
  });
});

describe("current receipt catalogue totals", () => {
  it("Panchamrutha Seva x1 = Rs 105", () => {
    expect(computeItemAmount(1,105)).toBe(105);
  });

  it("Panchamrutha Seva x2 = Rs 210", () => {
    expect(computeItemAmount(2,105)).toBe(210);
  });

it("Panchamrutha Seva x1 + Pushpalankara Seva x1 = Rs 1110", () => {
    const items = [
      { sevaId:"p", sevaName:"Panchamrutha Seva", rate:105, quantity:1, amount:105 },
      { sevaId:"pl", sevaName:"Pushpalankara Seva", rate:1005, quantity:1, amount:1005 },
    ];
    expect(computeReceiptTotals(items)).toEqual({ subtotal:1110, totalAmount:1110 });
  });
});

describe("receipt numbering for issued receipts", () => {
  it("formats the next receipt number", () => {
    expect(formatReceiptNumber("RM", "2026", 1)).toBe("RM-2026-000001");
  });

it("parses the year from an issued receipt number", () => {
    expect(parseReceiptYear("RM-2026-000001")).toBe("2026");
  });
});