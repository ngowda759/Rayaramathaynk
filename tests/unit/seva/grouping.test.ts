import { groupLinesByDate, type CounterLine } from "@/lib/seva/grouping";

let seq = 0;
function line(sevaId: string, ratePaise: number, dates: string[]): CounterLine {
  seq += 1;
  return { key: `k${seq}`, sevaId, quantity: 1, unitRatePaise: ratePaise, catalogueRatePaise: ratePaise, dates };
}
const pan = (dates: string[]): CounterLine => line("panchamrutha", 10500, dates);
const paa = (dates: string[]): CounterLine => line("paaduka", 50500, dates);
const nineLinesOn = (date: string): CounterLine[] => Array.from({ length: 9 }, () => pan([date]));
const thirtyTwoDates = Array.from({ length: 32 }, (_, i) => new Date(Date.UTC(2027, 7, 1 + i)).toISOString().slice(0, 10));

describe("groupLinesByDate", () => {
  it("groups the book's example into three receipts", () => {
    // Panchamrutha 105 on 28, 29, 30 Aug and Paaduka Pooja 505 on 28 Aug
    const r = groupLinesByDate([pan(["2027-08-30", "2027-08-28", "2027-08-29"]), paa(["2027-08-28"])]);
    expect(r.ok && r.receipts.map((g) => [g.sevaDate, g.totalPaise])).toEqual([
      ["2027-08-28", 61000],
      ["2027-08-29", 10500],
      ["2027-08-30", 10500],
    ]);
    expect(r.ok && r.totalPaise).toBe(82000);
    expect(r.ok && r.receipts[0].lines.map((l) => l.sevaId)).toEqual(["panchamrutha", "paaduka"]);
    expect(r.ok && "dates" in r.receipts[0].lines[0]).toBe(false);
  });

  it("multiplies quantity by the unit rate", () => {
    const r = groupLinesByDate([{ ...pan(["2027-08-28"]), quantity: 3 }]);
    expect(r.ok && r.receipts[0].lines[0].amountPaise).toBe(31500);
  });

  it("refuses an empty order", () => {
    expect(groupLinesByDate([])).toEqual({ ok: false, code: "no_lines" });
  });

  it("refuses more than 8 lines on one date", () => {
    expect(groupLinesByDate(nineLinesOn("2027-08-28"))).toEqual({
      ok: false,
      code: "too_many_lines_on_date",
      date: "2027-08-28",
    });
    expect(groupLinesByDate(nineLinesOn("2027-08-28").slice(0, 8)).ok).toBe(true);
  });

  it("refuses more than 31 receipts", () => {
    expect(groupLinesByDate([pan(thirtyTwoDates)])).toEqual({ ok: false, code: "too_many_receipts" });
    expect(groupLinesByDate([pan(thirtyTwoDates.slice(0, 31))]).ok).toBe(true);
  });
});
