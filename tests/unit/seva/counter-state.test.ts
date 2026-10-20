import { initialCounterState, selectCanSave, selectGroups, matchSevas } from "@/lib/seva/counter/state";
import { CAT, IDS, TODAY, bookExample, reduce, run } from "./counter-fixtures";

const named = () => run([{ type: "setDevotee", patch: { name: "Venkatesh Rao" } }]);

describe("counterReducer", () => {
  it("adds the seva whose counter key or code is given, and ignores unknown or hidden ones", () => {
    const s = run([{ type: "addByKey", key: 2 }, { type: "addByCode", code: "pn" }]);
    expect(s.lines.map((l) => l.sevaId)).toEqual([IDS.paaduka, IDS.panchamrutha]);
    expect(new Set(s.lines.map((l) => l.key)).size).toBe(2);
    expect(run([{ type: "addByKey", key: 9 }]).lines).toEqual([]);
    expect(run([{ type: "addByKey", key: 4 }]).lines).toEqual([]); // online only
    expect(run([{ type: "addByCode", code: "OF" }]).lines).toEqual([]); // switched off
    expect(run([{ type: "addByCode", code: "3" }]).lines.map((l) => l.sevaId)).toEqual([IDS.karnike]);
    expect(run([{ type: "addByCode", code: "paad" }]).lines.map((l) => l.sevaId)).toEqual([IDS.paaduka]);
  });

  it("clears the search after adding", () => {
    const s = run([{ type: "setSearch", text: "PA" }, { type: "addByCode", code: "PA" }]);
    expect(s.search).toBe("");
  });

  it("defaults a new line to today and refuses past dates", () => {
    const s = run([{ type: "addByKey", key: 2 }]);
    const line = s.lines[0];
    expect(line).toMatchObject({ quantity: 1, unitRatePaise: 50500, catalogueRatePaise: 50500, dates: [TODAY] });
    expect(reduce(s, { type: "setDates", lineKey: line.key, dates: ["2026-10-17"] }).lines[0].dates).toEqual([TODAY]);
    expect(reduce(s, { type: "setDates", lineKey: line.key, dates: ["2027-10-19"] }).lines[0].dates).toEqual([TODAY]);
    expect(reduce(s, { type: "setDates", lineKey: line.key, dates: [] }).lines[0].dates).toEqual([TODAY]);
    expect(reduce(s, { type: "setDates", lineKey: line.key, dates: ["2027-10-18"] }).lines[0].dates).toEqual(["2027-10-18"]);
  });

  it("allows several dates only on multi-date sevas", () => {
    const s = run([{ type: "addByKey", key: 1 }, { type: "addByKey", key: 2 }]);
    const [pn, pa] = s.lines;
    const three = ["2027-08-30", "2027-08-28", "2027-08-29", "2027-08-28"];
    expect(reduce(s, { type: "setDates", lineKey: pn.key, dates: three }).lines[0].dates).toEqual([
      "2027-08-28",
      "2027-08-29",
      "2027-08-30",
    ]);
    expect(reduce(s, { type: "setDates", lineKey: pa.key, dates: three }).lines[1].dates).toEqual([TODAY]);
  });

  it("keeps quantity between 1 and 99 and removes lines", () => {
    const s = run([{ type: "addByKey", key: 1 }]);
    const key = s.lines[0].key;
    expect(reduce(s, { type: "setQuantity", lineKey: key, quantity: 3 }).lines[0].quantity).toBe(3);
    expect(reduce(s, { type: "setQuantity", lineKey: key, quantity: 0 }).lines[0].quantity).toBe(1);
    expect(reduce(s, { type: "setQuantity", lineKey: key, quantity: 150 }).lines[0].quantity).toBe(99);
    expect(reduce(s, { type: "removeLine", lineKey: key }).lines).toEqual([]);
  });

  it("jumps between steps", () => {
    expect(run([{ type: "goStep", step: 3 }]).step).toBe(3);
    expect(run([{ type: "goStep", step: 3 }, { type: "goStep", step: 1 }]).step).toBe(1);
  });

  it("clears the order on Esc twice within 2 seconds only", () => {
    const s = bookExample();
    const cleared = run([{ type: "escape", at: 0 }, { type: "escape", at: 1500 }], s);
    expect(cleared).toEqual(initialCounterState(TODAY));
    const kept = run([{ type: "escape", at: 0 }, { type: "escape", at: 2500 }], s);
    expect(kept.lines).toHaveLength(2);
    expect(kept.escArmedAt).toBe(2500);
    const interrupted = run([{ type: "escape", at: 0 }, { type: "setSearch", text: "P" }, { type: "escape", at: 500 }], s);
    expect(interrupted.lines).toHaveLength(2);
  });

  it("refuses an amount change on a seva that does not allow it", () => {
    const s = run([{ type: "addByKey", key: 2 }]);
    const next = reduce(s, { type: "changeAmount", lineKey: s.lines[0].key, unitRatePaise: 60000, reason: "Devotee offered more" });
    expect(next.lines[0].unitRatePaise).toBe(50500);
  });

  it("fills step 1 from a returning devotee and can undo it", () => {
    const s = run([{ type: "setDevotee", patch: { name: "Venk", phone: "98450 12345" } }]);
    const before = s.devotee;
    const profile = {
      name: "Venkatesh Rao",
      gotra: { value: "2", text: "Bharadwaja" },
      nakshatra: { value: "4", text: "Rohini" },
      rashi: null,
      phone: "",
    };
    const applied = reduce(s, { type: "applyProfile", devotee: profile });
    expect(applied.devotee).toEqual({ ...profile, phone: "98450 12345" });
    const undone = reduce(applied, { type: "setDevotee", patch: before });
    expect(undone.devotee).toEqual(before);
  });

  it("reset starts a fresh order on the given day", () => {
    expect(run([{ type: "reset", today: "2026-10-19" }], bookExample())).toEqual(initialCounterState("2026-10-19"));
  });
});

describe("selectGroups", () => {
  it("groups the book example into three receipts totalling Rs 820", () => {
    const g = selectGroups(bookExample());
    expect(g.ok && g.receipts.map((r) => [r.sevaDate, r.totalPaise])).toEqual([
      ["2027-08-28", 61000],
      ["2027-08-29", 10500],
      ["2027-08-30", 10500],
    ]);
    expect(g.ok && g.totalPaise).toBe(82000);
  });
});

describe("matchSevas", () => {
  it("lists counter sevas by key and filters by code or name", () => {
    expect(matchSevas(CAT, "").map((s) => s.key)).toEqual([1, 2, 3]);
    expect(matchSevas(CAT, "pa").map((s) => s.key)).toEqual([2, 1]);
    expect(matchSevas(CAT, "karn").map((s) => s.key)).toEqual([3]);
  });
});

describe("selectCanSave", () => {
  it("needs a name and at least one line", () => {
    expect(selectCanSave(run([{ type: "addByKey", key: 2 }]))).toEqual({ ok: false, block: "no_name" });
    expect(selectCanSave(named())).toEqual({ ok: false, block: "no_lines" });
    expect(selectCanSave(bookExample())).toEqual({ ok: true });
  });

  it("blocks when a date holds more than 8 lines", () => {
    const actions = Array.from({ length: 9 }, () => ({ type: "addByKey" as const, key: 2 }));
    expect(selectCanSave(run(actions, named()))).toEqual({ ok: false, block: "group_error" });
  });

  it("needs a reason for a changed amount and a typed amount for any-amount sevas", () => {
    const s = run([{ type: "addByKey", key: 1 }], named());
    const key = s.lines[0].key;
    const noReason = reduce(s, { type: "changeAmount", lineKey: key, unitRatePaise: 15000, reason: "  " });
    expect(noReason.lines[0].unitRatePaise).toBe(15000);
    expect(selectCanSave(noReason)).toEqual({ ok: false, block: "reason_missing" });
    const withReason = reduce(s, { type: "changeAmount", lineKey: key, unitRatePaise: 15000, reason: "Devotee offered more" });
    expect(selectCanSave(withReason)).toEqual({ ok: true });
    const backToRate = reduce(noReason, { type: "changeAmount", lineKey: key, unitRatePaise: 10500, reason: "" });
    expect(selectCanSave(backToRate)).toEqual({ ok: true });

    const karnike = run([{ type: "addByKey", key: 3 }], named());
    expect(karnike.lines[0]).toMatchObject({ unitRatePaise: 0, catalogueRatePaise: null });
    expect(selectCanSave(karnike)).toEqual({ ok: false, block: "amount_missing" });
    const typed = reduce(karnike, { type: "changeAmount", lineKey: karnike.lines[0].key, unitRatePaise: 25100, reason: "" });
    expect(selectCanSave(typed)).toEqual({ ok: true });
  });

  it("needs six UPI digits and the tick before saving", () => {
    const upi = reduce(bookExample(), { type: "setPayment", patch: { mode: "upi" } });
    expect(selectCanSave(upi)).toEqual({ ok: false, block: "upi_incomplete" });
    const five = reduce(upi, { type: "setPayment", patch: { upiRefLast6: "11904" } });
    expect(selectCanSave(five)).toEqual({ ok: false, block: "upi_incomplete" });
    const six = reduce(five, { type: "setPayment", patch: { upiRefLast6: "119042" } });
    expect(selectCanSave(six)).toEqual({ ok: false, block: "upi_incomplete" });
    const ticked = reduce(six, { type: "setPayment", patch: { upiSeenConfirmed: true } });
    expect(selectCanSave(ticked)).toEqual({ ok: true });
  });

  it("blocks when cash received is below the total", () => {
    const s = bookExample();
    expect(selectCanSave(reduce(s, { type: "setPayment", patch: { cashReceived: "800" } }))).toEqual({
      ok: false,
      block: "cash_short",
    });
    expect(selectCanSave(reduce(s, { type: "setPayment", patch: { cashReceived: "abc" } }))).toEqual({
      ok: false,
      block: "cash_short",
    });
    expect(selectCanSave(reduce(s, { type: "setPayment", patch: { cashReceived: "1000" } }))).toEqual({ ok: true });
    expect(selectCanSave(reduce(s, { type: "setPayment", patch: { cashReceived: "" } }))).toEqual({ ok: true });
  });

  it("asks to confirm cash of Rs 2,00,000 or more", () => {
    const s = run([{ type: "addByKey", key: 3 }], named());
    const key = s.lines[0].key;
    const big = reduce(s, { type: "changeAmount", lineKey: key, unitRatePaise: 20000000, reason: "" });
    expect(selectCanSave(big)).toEqual({ ok: false, block: "large_cash_unconfirmed" });
    const confirmed = reduce(big, { type: "confirmLargeCash" });
    expect(selectCanSave(confirmed)).toEqual({ ok: true });
    const justBelow = reduce(s, { type: "changeAmount", lineKey: key, unitRatePaise: 19999999, reason: "" });
    expect(selectCanSave(justBelow)).toEqual({ ok: true });
    // Changing the total asks again; UPI never asks.
    const changed = reduce(confirmed, { type: "setQuantity", lineKey: key, quantity: 2 });
    expect(selectCanSave(changed)).toEqual({ ok: false, block: "large_cash_unconfirmed" });
    const upi = reduce(big, { type: "setPayment", patch: { mode: "upi", upiRefLast6: "119042", upiSeenConfirmed: true } });
    expect(selectCanSave(upi)).toEqual({ ok: true });
  });

  it("save is blocked while a submit is in flight, and edits are ignored", () => {
    const busy = reduce(bookExample(), { type: "submitStarted" });
    expect(busy.submitting).toBe(true);
    expect(selectCanSave(busy)).toEqual({ ok: false, block: "submitting" });
    expect(reduce(busy, { type: "addByKey", key: 2 })).toBe(busy);
    expect(run([{ type: "escape", at: 0 }, { type: "escape", at: 100 }], busy)).toBe(busy);
  });

  it("keeps the order after a failed save and clears it after a good one", () => {
    const busy = reduce(bookExample(), { type: "submitStarted" });
    const failed = reduce(busy, { type: "submitFinished", ok: false });
    expect(failed.submitting).toBe(false);
    expect(failed.lines).toHaveLength(2);
    expect(reduce(busy, { type: "submitFinished", ok: true })).toEqual(initialCounterState(TODAY));
  });
});
