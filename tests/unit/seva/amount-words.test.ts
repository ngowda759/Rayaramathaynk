import { amountInWords } from "@/lib/seva/amount-words";

describe("amountInWords", () => {
  it("writes rupees in the Indian system", () => {
    expect(amountInWords(61000)).toBe("Rupees Six Hundred Ten only");
    expect(amountInWords(10000000)).toBe("Rupees One Lakh only");
    expect(amountInWords(25000500)).toBe("Rupees Two Lakh Fifty Thousand Five only");
    expect(amountInWords(1000000000)).toBe("Rupees One Crore only");
    expect(amountInWords(10550)).toBe("Rupees One Hundred Five and Fifty Paise only");
  });

  it("handles small and compound numbers", () => {
    expect(amountInWords(0)).toBe("Rupees Zero only");
    expect(amountInWords(1900)).toBe("Rupees Nineteen only");
    expect(amountInWords(9999999)).toBe(
      "Rupees Ninety Nine Thousand Nine Hundred Ninety Nine and Ninety Nine Paise only",
    );
    expect(amountInWords(12345678900)).toBe(
      "Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine only",
    );
  });

  it("rejects invalid paise", () => {
    expect(() => amountInWords(-1)).toThrow(RangeError);
    expect(() => amountInWords(1.5)).toThrow(RangeError);
  });
});
