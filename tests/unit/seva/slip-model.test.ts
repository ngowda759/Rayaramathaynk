import { toSlipModel } from "@/lib/seva/print/slip-model";
import type { IssuedLine, IssuedReceipt, SlipSettings } from "@/types/seva";

const SITE = "https://site.example";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUv";

const settings = (over: Partial<SlipSettings> = {}): SlipSettings => ({
  templeNameEn: "Sri Raghavendra Swamy Matha",
  templeNameKn: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ",
  addressLine1: "Yelahanka New Town",
  addressLine2: "Bengaluru 560064",
  registrationLine: "Regd. Trust No. SAMPLE/0000/2001",
  photoLeftUrl: null,
  photoRightUrl: null,
  footerLine1: "Please keep this receipt for prasadam.",
  footerLine2: "",
  footerBlessing: "ಶ್ರೀ ಗುರುರಾಜೋ ವಿಜಯತೇ",
  printGotra: true,
  printNakshatra: true,
  printRashi: false,
  ...over,
});

const line = (over: Partial<IssuedLine> = {}): IssuedLine => ({
  lineNo: 1,
  sevaId: "s-pan",
  code: "PAN",
  nameEn: "Panchamrutha Abhisheka",
  nameKn: "ಪಂಚಾಮೃತ ಅಭಿಷೇಕ",
  quantity: 1,
  unitRatePaise: 10500,
  amountPaise: 10500,
  changed: false,
  prasadamItems: "Panchamrutha",
  ...over,
});

const receipt = (over: Partial<IssuedReceipt> = {}): IssuedReceipt => ({
  id: "r-1",
  clientReceiptId: "c-1",
  receiptNo: "C1-023-10-2026/000124",
  seriesCode: "C1",
  sevaDate: "2027-08-28",
  groupNo: "G-2610-0042",
  position: 1,
  count: 3,
  orderTotalPaise: 82000,
  totalPaise: 61000,
  lines: [
    line(),
    line({ lineNo: 2, sevaId: "s-paa", code: "PAA", nameEn: "Paaduka Pooja", nameKn: "ಪಾದುಕಾ ಪೂಜೆ", unitRatePaise: 50500, amountPaise: 50500 }),
  ],
  payment: { mode: "cash" },
  devotee: {
    name: "Venkatesh Rao",
    gotra: "Bharadwaja",
    gotraKn: "ಭಾರದ್ವಾಜ",
    nakshatra: "Rohini",
    nakshatraKn: "ರೋಹಿಣಿ",
    rashi: "Vrishabha",
    rashiKn: "ವೃಷಭ",
  },
  qrToken: TOKEN,
  issuedAt: "2026-10-18T05:12:00.000Z", // 10:42 AM IST
  issuedBy: { name: "Ramesh", staffNo: 23 },
  counterName: "Counter 1",
  channel: "counter",
  issuedOffline: false,
  status: "issued",
  printCount: 0,
  prasadam: "pending",
  ...over,
});

describe("toSlipModel", () => {
  it("builds the group line for 1 of 3", () => {
    const m = toSlipModel(receipt(), settings(), { siteUrl: SITE });
    expect(m.groupLine).toBe("1 of 3 - paid together - group G-2610-0042");
    const single = toSlipModel(receipt({ position: 1, count: 1, orderTotalPaise: 61000 }), settings(), { siteUrl: SITE });
    expect(single.groupLine).toBeNull();
  });

  it("makes the seva date the big line", () => {
    const m = toSlipModel(receipt(), settings(), { siteUrl: SITE });
    expect(m.sevaDateLine).toBe("Sat 28 Aug 2027");
    expect(m.receiptNo).toBe("C1-023-10-2026/000124");
    expect(m.issuedLine).toBe("Issued 18-10-2026, 10:42 AM");
  });

  it("writes the total in words", () => {
    const m = toSlipModel(receipt(), settings(), { siteUrl: SITE });
    expect(m.total).toBe("Rs 610.00");
    expect(m.totalWords).toBe("Rupees Six Hundred Ten only");
  });

  it("describes cash for a group and UPI by its last six digits", () => {
    expect(toSlipModel(receipt(), settings(), { siteUrl: SITE }).paymentLine).toBe(
      "Paid in cash - Rs 820 together for 3 receipts",
    );
    const upi = receipt({ count: 1, orderTotalPaise: 61000, payment: { mode: "upi", upiRefLast6: "119042" } });
    expect(toSlipModel(upi, settings(), { siteUrl: SITE }).paymentLine).toBe("Paid by UPI - ref ending 119042");
    const online = receipt({ count: 1, orderTotalPaise: 61000, channel: "web", payment: { mode: "online" } });
    expect(toSlipModel(online, settings(), { siteUrl: SITE }).paymentLine).toBe("Paid online by UPI");
    const singleCash = receipt({ count: 1, orderTotalPaise: 61000 });
    expect(toSlipModel(singleCash, settings(), { siteUrl: SITE }).paymentLine).toBe("Paid in cash - Rs 610");
  });

  it("leaves rashi out unless print_rashi is on", () => {
    const off = toSlipModel(receipt(), settings(), { siteUrl: SITE });
    expect(off.devotee.map((d) => d.label.en)).toEqual(["Name", "Gotra", "Nakshatra"]);
    expect(JSON.stringify(off)).not.toContain("Vrishabha");
    const on = toSlipModel(receipt(), settings({ printRashi: true }), { siteUrl: SITE });
    expect(on.devotee.map((d) => d.label.en)).toEqual(["Name", "Gotra", "Nakshatra", "Rashi"]);
    expect(on.devotee[3]).toEqual({ label: { en: "Rashi", kn: "ರಾಶಿ" }, value: "Vrishabha", valueKn: "ವೃಷಭ" });
    expect(on.devotee[1]).toEqual({ label: { en: "Gotra", kn: "ಗೋತ್ರ" }, value: "Bharadwaja", valueKn: "ಭಾರದ್ವಾಜ" });
  });

  it("follows the gotra and nakshatra switches and skips empty details", () => {
    const m = toSlipModel(
      receipt({ devotee: { name: "Venkatesh Rao", nakshatra: "Rohini" } }),
      settings({ printNakshatra: false }),
      { siteUrl: SITE },
    );
    expect(m.devotee).toEqual([{ label: { en: "Name", kn: "ಹೆಸರು" }, value: "Venkatesh Rao" }]);
  });

  it("marks a changed line", () => {
    const r = receipt({ lines: [line({ unitRatePaise: 15100, amountPaise: 30200, quantity: 2, changed: true })], totalPaise: 30200 });
    const m = toSlipModel(r, settings(), { siteUrl: SITE });
    expect(m.lines).toEqual([
      { nameEn: "Panchamrutha Abhisheka", nameKn: "ಪಂಚಾಮೃತ ಅಭಿಷೇಕ", qtyRate: "2 x 151", amount: "302.00", changed: true },
    ]);
  });

  it("formats large rates and amounts with Indian grouping", () => {
    const r = receipt({ lines: [line({ unitRatePaise: 10000050, amountPaise: 10000050 })], totalPaise: 10000050 });
    const m = toSlipModel(r, settings(), { siteUrl: SITE });
    expect(m.lines[0].qtyRate).toBe("1 x 1,00,000.50");
    expect(m.lines[0].amount).toBe("1,00,000.50");
    expect(m.total).toBe("Rs 1,00,000.50");
  });

  it("shows the DUPLICATE band only on a reprint", () => {
    expect(toSlipModel(receipt(), settings(), { siteUrl: SITE }).duplicate).toBeNull();
    const m = toSlipModel(receipt({ printCount: 1 }), settings(), {
      siteUrl: SITE,
      reprint: { at: new Date("2026-10-18T05:35:00.000Z"), byStaffNo: 23 },
    });
    expect(m.duplicate).toEqual({ at: "18-10-2026, 11:05 AM", byStaffNo: "023" });
    expect(m.receiptNo).toBe("C1-023-10-2026/000124");
    expect(m.qrUrl).toBe(`${SITE}/r/${TOKEN}`);
  });

  it("drops the prasadam line but keeps the QR when no seva gives prasadam", () => {
    const withPrasadam = toSlipModel(receipt(), settings(), { siteUrl: SITE });
    expect(withPrasadam.prasadamLine).toEqual({
      en: "Show this at the prasadam counter on Sat 28 Aug 2027",
      kn: "ಪ್ರಸಾದ ಕೌಂಟರ್‌ನಲ್ಲಿ ತೋರಿಸಿ",
      date: "Sat 28 Aug 2027",
    });
    const none = toSlipModel(
      receipt({ prasadam: "none", lines: [line({ prasadamItems: null })] }),
      settings(),
      { siteUrl: SITE },
    );
    expect(none.prasadamLine).toBeNull();
    expect(none.qrUrl).toBe(`${SITE}/r/${TOKEN}`);
  });

  it("prints the English temple name before the Kannada one", () => {
    const m = toSlipModel(receipt(), settings(), { siteUrl: SITE });
    expect(m.header).toEqual({
      nameEn: "Sri Raghavendra Swamy Matha",
      nameKn: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ",
      address: ["Yelahanka New Town", "Bengaluru 560064"],
      registration: "Regd. Trust No. SAMPLE/0000/2001",
      photoLeft: null,
      photoRight: null,
    });
    expect(m.footer).toEqual(["Please keep this receipt for prasadam."]);
    expect(m.blessing).toBe("ಶ್ರೀ ಗುರುರಾಜೋ ವಿಜಯತೇ");
  });

  it("issued-by line names the counter or the online channel", () => {
    expect(toSlipModel(receipt(), settings(), { siteUrl: SITE }).issuedBy).toBe("Issued by: Ramesh (023) - Counter 1");
    expect(toSlipModel(receipt({ channel: "web" }), settings(), { siteUrl: SITE }).issuedBy).toBe("Booked online - website");
    expect(toSlipModel(receipt({ channel: "app" }), settings(), { siteUrl: SITE }).issuedBy).toBe("Booked online - temple app");
  });
});
