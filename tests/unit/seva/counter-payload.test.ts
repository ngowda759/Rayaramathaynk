import { buildCounterOrderPayload, profileToDraft } from "@/lib/seva/counter/payload";
import { counterOrderSchema } from "@/lib/seva/schemas";
import { IDS, bookExample, reduce, run } from "./counter-fixtures";

const IDS3 = {
  clientOrderId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  clientReceiptIds: [
    "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "550e8400-e29b-41d4-a716-446655440000",
    "9b2d3f4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
  ],
  qrTokens: ["AAAAAAAAAAAAAAAAAAAAAA", "BBBBBBBBBBBBBBBBBBBBBB", "CCCCCCCCCCCCCCCCCCCCCC"],
};

describe("buildCounterOrderPayload", () => {
  it("builds a payload grouped by date with unitRatePaise only on changed or any-amount lines", () => {
    let s = bookExample();
    const pn = s.lines[0].key;
    s = reduce(s, { type: "changeAmount", lineKey: pn, unitRatePaise: 15000, reason: "  Devotee offered more " });
    s = run([{ type: "addByKey", key: 3 }], s);
    const karnike = s.lines[2].key;
    s = run(
      [
        { type: "changeAmount", lineKey: karnike, unitRatePaise: 25100, reason: "ignored" },
        { type: "setDates", lineKey: karnike, dates: ["2027-08-29"] },
      ],
      s,
    );

    const p = buildCounterOrderPayload(s, IDS3);
    expect(p.receipts.map((r) => [r.clientReceiptId, r.sevaDate, r.qrToken])).toEqual([
      [IDS3.clientReceiptIds[0], "2027-08-28", IDS3.qrTokens[0]],
      [IDS3.clientReceiptIds[1], "2027-08-29", IDS3.qrTokens[1]],
      [IDS3.clientReceiptIds[2], "2027-08-30", IDS3.qrTokens[2]],
    ]);
    expect(p.receipts[0].lines).toEqual([
      { sevaId: IDS.panchamrutha, quantity: 1, unitRatePaise: 15000, changeReason: "Devotee offered more" },
      { sevaId: IDS.paaduka, quantity: 1 },
    ]);
    expect(p.receipts[1].lines).toEqual([
      { sevaId: IDS.panchamrutha, quantity: 1, unitRatePaise: 15000, changeReason: "Devotee offered more" },
      { sevaId: IDS.karnike, quantity: 1, unitRatePaise: 25100 },
    ]);
    expect(p.expectedTotalPaise).toBe(15000 * 3 + 50500 + 25100);
    expect(counterOrderSchema.safeParse(p).success).toBe(true);
  });

  it("puts the expected total in the payload", () => {
    const p = buildCounterOrderPayload(bookExample(), IDS3);
    expect(p.expectedTotalPaise).toBe(82000);
    expect(p.clientOrderId).toBe(IDS3.clientOrderId);
    expect(p.receipts[0].lines).toEqual([
      { sevaId: IDS.panchamrutha, quantity: 1 },
      { sevaId: IDS.paaduka, quantity: 1 },
    ]);
    expect(p.payment).toEqual({ mode: "cash" });
    expect(p.devotee).toEqual({ name: "Venkatesh Rao" });
  });

  it("maps the devotee and the payment", () => {
    const s = run(
      [
        {
          type: "setDevotee",
          patch: {
            name: "  Venkatesh Rao ",
            gotra: { value: "2", text: "Bharadwaja" },
            nakshatra: { text: "Rohini star" },
            rashi: { value: "2", text: "Vrishabha" },
            phone: "098450 12345",
          },
        },
        { type: "setPayment", patch: { cashReceived: "1000" } },
      ],
      bookExample(),
    );
    const cash = buildCounterOrderPayload(s, IDS3);
    expect(cash.devotee).toEqual({
      name: "Venkatesh Rao",
      gotra: { text: "Bharadwaja", id: 2 },
      nakshatra: { text: "Rohini star" },
      rashi: { id: 2, text: "Vrishabha" },
      phone: "+919845012345",
    });
    expect(cash.payment).toEqual({ mode: "cash", cashReceivedPaise: 100000 });
    expect(counterOrderSchema.safeParse(cash).success).toBe(true);

    const upi = reduce(s, { type: "setPayment", patch: { mode: "upi", upiRefLast6: "119042", upiSeenConfirmed: true } });
    expect(buildCounterOrderPayload(upi, IDS3).payment).toEqual({ mode: "upi", upiRefLast6: "119042", upiSeenConfirmed: true });
  });

  it("refuses when the ids do not match the receipts or the order cannot be grouped", () => {
    expect(() => buildCounterOrderPayload(bookExample(), { ...IDS3, qrTokens: IDS3.qrTokens.slice(0, 2) })).toThrow(
      "receipt_ids_mismatch",
    );
    expect(() => buildCounterOrderPayload(run([]), IDS3)).toThrow("no_lines");
  });
});

describe("profileToDraft", () => {
  it("fills step 1 from a returning devotee and can undo it", () => {
    const draft = profileToDraft({ name: "Venkatesh Rao", gotra: "Bharadwaja", gotraId: 2, nakshatraId: 4, rashiId: 2, phoneLast4: "2345" });
    expect(draft).toEqual({
      name: "Venkatesh Rao",
      gotra: { value: "2", text: "Bharadwaja" },
      nakshatra: { value: "4", text: "Rohini" },
      rashi: { value: "2", text: "Vrishabha" },
      phone: "",
    });
    const typed = run([{ type: "setDevotee", patch: { name: "Venk" } }]);
    const applied = reduce(typed, { type: "applyProfile", devotee: draft });
    expect(applied.devotee.name).toBe("Venkatesh Rao");
    expect(reduce(applied, { type: "setDevotee", patch: typed.devotee }).devotee).toEqual(typed.devotee);
  });

  it("leaves unknown fields empty and keeps a typed gotra", () => {
    expect(profileToDraft({ name: "Lakshmi", gotra: "Kaundinya (as said)", nakshatraId: 99 })).toEqual({
      name: "Lakshmi",
      gotra: { text: "Kaundinya (as said)" },
      nakshatra: null,
      rashi: null,
      phone: "",
    });
    expect(profileToDraft({ name: "Lakshmi", gotraId: 1 }).gotra).toEqual({ value: "1", text: "Kashyapa" });
  });
});
