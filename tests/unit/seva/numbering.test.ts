import {
  formatGroupNo,
  formatOfflineGroupNo,
  formatReceiptNo,
  parseLookupInput,
  parseReceiptNo,
  type LookupQuery,
  type ReceiptNoParts,
} from "@/lib/seva/numbering";

describe("receipt numbers", () => {
  it("formats counter and online numbers", () => {
    expect(formatReceiptNo({ series: "C1", staffNo: 23, channel: null, month: 10, year: 2026, running: 124 })).toBe(
      "C1-023-10-2026/000124",
    );
    expect(formatReceiptNo({ series: "W", staffNo: null, channel: "APP", month: 10, year: 2026, running: 46 })).toBe(
      "W-APP-10-2026/000046",
    );
  });

  it("parses numbers after trim and upper-case", () => {
    expect(parseReceiptNo(" c1-023-10-2026/000124 ")?.running).toBe(124);
    expect(parseReceiptNo(" c1-023-10-2026/000124 ")).toEqual({
      series: "C1",
      staffNo: 23,
      channel: null,
      month: 10,
      year: 2026,
      running: 124,
    });
    expect(parseReceiptNo("wt-web-01-2027/000001")).toEqual({
      series: "WT",
      staffNo: null,
      channel: "WEB",
      month: 1,
      year: 2027,
      running: 1,
    });
    expect(parseReceiptNo("C1-23-10-2026/000124")).toBeNull();
    expect(parseReceiptNo("X1-023-10-2026/000124")).toBeNull();
  });

  it("round-trips a formatted number", () => {
    const parts: ReceiptNoParts = { series: "OF2", staffNo: 7, channel: null, month: 3, year: 2027, running: 9 };
    expect(parseReceiptNo(formatReceiptNo(parts))).toEqual(parts);
  });

  test.each<[string, LookupQuery]>([
    ["https://site.example/r/AbCdEfGhIjKlMnOpQrStUv\n", { kind: "token", token: "AbCdEfGhIjKlMnOpQrStUv" }],
    ["AbCdEfGhIjKlMnOpQrStUv", { kind: "token", token: "AbCdEfGhIjKlMnOpQrStUv" }],
    [" of1-023-10-2026/000007", { kind: "number", receiptNo: "OF1-023-10-2026/000007" }],
    ["C1 124", { kind: "short", series: "C1", running: 124, year: 2026 }],
    ["c1/124", { kind: "short", series: "C1", running: 124, year: 2026 }],
    ["124", { kind: "short", series: null, running: 124, year: 2026 }],
    ["hello", { kind: "invalid" }],
    ["", { kind: "invalid" }],
  ])("parseLookupInput(%j)", (raw, want) => expect(parseLookupInput(raw, { year: 2026 })).toEqual(want));

  it("formats group numbers", () => {
    expect(formatGroupNo({ yymm: "2610", n: 42 })).toBe("G-2610-0042");
    expect(formatOfflineGroupNo({ yymm: "2610", series: "OF1", n: 7 })).toBe("G-2610-OF1-007");
  });
});
