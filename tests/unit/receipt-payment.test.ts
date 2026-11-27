import { buildUpiPaymentUrl, configuredUpiId, UpiNotConfiguredError } from "@/lib/receipt/upi";

// The Firestore Receipt Book's PDF, totals and numbering cases left with their modules (DB §17.2, plan Task A5-1).
// `lib/receipt/upi.ts` stays: the counter's UPI panel and the public payment forms build their links with it.

describe("receipt UPI payment", () => {
  it("builds a upi://pay deep link with payer, amount and currency", () => {
    const url = buildUpiPaymentUrl({
      upiId: "raghavendra@okhdfcbank",
      payeeName: "Sri Raghavendra Swamy Matha",
      amount: 105,
      note: "Temple seva receipt",
    });
    expect(url.startsWith("upi://pay?")).toBe(true);
    expect(url).toContain("pa=raghavendra%40okhdfcbank");
    expect(url).toContain("am=105");
    expect(url).toContain("cu=INR");
    expect(url).toContain("pn=Sri+Raghavendra+Swamy+Matha");
  });

  it("uses the payee supplied by the caller and falls back to the temple name only for the payee", () => {
    const url = buildUpiPaymentUrl({ upiId: "temple@upi", payeeName: "Sri Rayara Matha", amount: 501 });
    expect(url).toContain("pa=temple%40upi");
    expect(url).toContain("pn=Sri+Rayara+Matha");
  });

  it("refuses to build a link without a configured UPI id", () => {
    expect(() => buildUpiPaymentUrl({ upiId: "", amount: 105 })).toThrow(UpiNotConfiguredError);
    expect(() => buildUpiPaymentUrl({ upiId: "   ", amount: 105 })).toThrow(UpiNotConfiguredError);
  });

  it("never falls back to a built-in VPA", () => {
    expect(() => buildUpiPaymentUrl({ upiId: "", amount: 105 })).toThrow(
      /UPI id is not configured/
    );
  });

  it("treats blank configured ids as not configured", () => {
    expect(configuredUpiId(undefined)).toBeNull();
    expect(configuredUpiId(null)).toBeNull();
    expect(configuredUpiId("")).toBeNull();
    expect(configuredUpiId("  ")).toBeNull();
    expect(configuredUpiId(" temple@upi ")).toBe("temple@upi");
  });
});
