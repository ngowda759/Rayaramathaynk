import {
  DEFAULT_RECEIPT_PREFIX,
  DEFAULT_STARTING_SEQUENCE,
  formatReceiptNumber,
  nextSequenceForYear,
  parseReceiptYear,
} from "@/lib/receipt/numbering";

describe("receipt numbering", () => {
  it("formats a receipt number with zero-padded 6-digit sequence", () => {
    expect(formatReceiptNumber("RM", "2026", 1)).toBe("RM-2026-000001");
    expect(formatReceiptNumber("RM", "2026", 2)).toBe("RM-2026-000002");
    expect(formatReceiptNumber("RM", "2026", 123456)).toBe("RM-2026-123456");
  });

  it("uses RM prefix by default", () => {
    expect(DEFAULT_RECEIPT_PREFIX).toBe("RM");
  });

  it("starts sequence at one for a new year", () => {
    expect(DEFAULT_STARTING_SEQUENCE).toBe(1);
  });

  it("parses the year out of an issued receipt number", () => {
    expect(parseReceiptYear("RM-2026-000001")).toBe("2026");
    expect(parseReceiptYear("RM-2025-000123")).toBe("2025");
  });

  it("returns null for malformed receipt numbers", () => {
    expect(parseReceiptYear("RM-2026-1")).toBeNull();
    expect(parseReceiptYear("not-a-number")).toBeNull();
  });

  it("continues the sequence within the same year", () => {
    const previous = { year: "2026", lastNumber: 5 };
    expect(nextSequenceForYear("2026", previous)).toBe(6);
  });

  it("resets the sequence when the year changes", () => {
    const previous = { year: "2025", lastNumber:  999 };
    expect(nextSequenceForYear("2026", previous)).toBe(1);
  });

  it("starts at one when there is no counter document", () => {
    expect(nextSequenceForYear("2026", null)).toBe(1);
  });
});