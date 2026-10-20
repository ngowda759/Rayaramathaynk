import { fromPaise, formatRupees, toPaise } from "@/lib/seva/money";

describe("money", () => {
  it("converts rupees to integer paise", () => {
    expect(toPaise("105")).toBe(10500);
    expect(toPaise("105.5")).toBe(10550);
    expect(toPaise(105.55)).toBe(10555);
    expect(toPaise(" 0.05 ")).toBe(5);
  });

  it("rejects invalid amounts", () => {
    expect(() => toPaise("1.005")).toThrow(RangeError);
    expect(() => toPaise(-1)).toThrow("invalid_amount");
    expect(() => toPaise("abc")).toThrow("invalid_amount");
    expect(() => toPaise("")).toThrow("invalid_amount");
    expect(() => toPaise(Number.NaN)).toThrow("invalid_amount");
  });

  it("converts paise back to a SQL numeric string", () => {
    expect(fromPaise(10550)).toBe("105.50");
    expect(fromPaise(5)).toBe("0.05");
    expect(fromPaise(0)).toBe("0.00");
  });

  it("formats rupees with Indian grouping", () => {
    expect(formatRupees(61000)).toBe("Rs 610.00");
    expect(formatRupees(82000, { decimals: false })).toBe("Rs 820");
    expect(formatRupees(20000000, { decimals: false })).toBe("Rs 2,00,000");
    expect(formatRupees(12345678)).toBe("Rs 1,23,456.78");
  });
});
