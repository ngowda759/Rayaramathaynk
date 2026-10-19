import { buildUpiPaymentUrl, DEFAULT_UPI_ID } from "@/lib/receipt/upi";

// The Firestore Receipt Book's PDF, totals and numbering cases left with their modules (DB §17.2, plan Task A5-1).
// `lib/receipt/upi.ts` stays: the counter's UPI panel builds its payment link with it.

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
});
