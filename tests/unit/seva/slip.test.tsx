import { act, render } from "@testing-library/react";
import QRCode from "qrcode";

import { PrintRoot } from "@/components/seva/slip/PrintRoot";
import { ReceiptSlip } from "@/components/seva/slip/ReceiptSlip";
import { SlipQr } from "@/components/seva/slip/SlipQr";
import { printSlips } from "@/lib/seva/print/printSlips";
import { toSlipModel } from "@/lib/seva/print/slip-model";
import type { IssuedReceipt, SlipSettings } from "@/types/seva";

jest.mock("qrcode", () => ({
  __esModule: true,
  default: {
    // A 21 x 21 symbol with only the top-left module dark is enough to check the SVG frame.
    create: jest.fn(() => ({ modules: { size: 21, data: Uint8Array.from({ length: 441 }, (_, i) => (i === 0 ? 1 : 0)) } })),
  },
}));

const qrcode = QRCode as unknown as { create: jest.Mock };

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
  printRashi: true,
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
    { lineNo: 1, sevaId: "s-pan", code: "PAN", nameEn: "Panchamrutha Abhisheka", nameKn: "ಪಂಚಾಮೃತ ಅಭಿಷೇಕ", quantity: 1,
      unitRatePaise: 10500, amountPaise: 10500, changed: false, prasadamItems: "Panchamrutha" },
    { lineNo: 2, sevaId: "s-paa", code: "PAA", nameEn: "Paaduka Pooja", nameKn: "ಪಾದುಕಾ ಪೂಜೆ", quantity: 1,
      unitRatePaise: 50500, amountPaise: 50500, changed: true, prasadamItems: null },
  ],
  payment: { mode: "cash" },
  devotee: { name: "Venkatesh Rao", gotra: "Bharadwaja", gotraKn: "ಭಾರದ್ವಾಜ", nakshatra: "Rohini", nakshatraKn: "ರೋಹಿಣಿ" },
  qrToken: TOKEN,
  issuedAt: "2026-10-18T05:12:00.000Z",
  issuedBy: { name: "Ramesh", staffNo: 23 },
  counterName: "Counter 1",
  channel: "counter",
  issuedOffline: false,
  status: "issued",
  printCount: 0,
  prasadam: "pending",
  ...over,
});

const model = (r: IssuedReceipt = receipt(), s: SlipSettings = settings(), reprint?: { at: Date; byStaffNo: number }) =>
  toSlipModel(r, s, { siteUrl: SITE, reprint });

beforeEach(() => qrcode.create.mockClear());

describe("ReceiptSlip", () => {
  it("slip never contains the phone", () => {
    // The order behind this receipt carried a phone; a careless mapper could pass it through.
    const devotee = { ...receipt().devotee, phone: "+919845012345" };
    const m = model(receipt({ devotee }));
    expect(Object.keys(m)).not.toContain("phone");
    expect(JSON.stringify(m)).not.toContain("9845012345");
    const { container } = render(<ReceiptSlip model={m} />);
    const text = container.textContent ?? "";
    expect(text).not.toContain("9845012345");
    expect(text).not.toContain("2345");
    expect(container.innerHTML).not.toContain("2345");
  });

  it("follows the Design Book order and carries the slip class", () => {
    const { container } = render(<ReceiptSlip model={model()} />);
    const slip = container.querySelector(".slip");
    expect(slip).not.toBeNull();
    const text = slip?.textContent ?? "";
    const order = [
      "Sri Raghavendra Swamy Matha",
      "Regd. Trust No.",
      "C1-023-10-2026/000124",
      "Issued 18-10-2026, 10:42 AM",
      "Sat 28 Aug 2027",
      "1 of 3 - paid together - group G-2610-0042",
      "Venkatesh Rao",
      "Bharadwaja",
      "Rohini",
      "Panchamrutha Abhisheka",
      "Rs 610.00",
      "Rupees Six Hundred Ten only",
      "Paid in cash - Rs 820 together for 3 receipts",
      "Show this at the prasadam counter on Sat 28 Aug 2027",
      "Issued by: Ramesh (023) - Counter 1",
      "Please keep this receipt for prasadam.",
      "ಶ್ರೀ ಗುರುರಾಜೋ ವಿಜಯತೇ",
    ];
    const positions = order.map((s) => text.indexOf(s));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(slip?.querySelector(".s-date b")?.textContent).toBe("Sat 28 Aug 2027");
  });

  it("marks a changed line", () => {
    const m = model();
    expect(m.lines[1].changed).toBe(true);
    const { container } = render(<ReceiptSlip model={m} />);
    const rows = container.querySelectorAll(".sl");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).not.toContain("Changed");
    expect(rows[1].textContent).toContain("Changed");
  });

  it("shows the DUPLICATE band only on a reprint", () => {
    const original = render(<ReceiptSlip model={model()} />);
    expect(original.container.textContent).not.toContain("DUPLICATE");
    expect(original.container.textContent).not.toContain("ನಕಲು");
    expect(original.container.textContent).not.toContain("Reprinted");
    original.unmount();

    const m = model(receipt({ printCount: 1 }), settings(), { at: new Date("2026-10-18T05:35:00.000Z"), byStaffNo: 23 });
    const { container } = render(<ReceiptSlip model={m} />);
    const band = container.querySelector(".s-dup");
    expect(band?.textContent).toContain("DUPLICATE");
    expect(band?.textContent).toContain("ನಕಲು");
    expect(container.textContent).toContain("Reprinted 18-10-2026, 11:05 AM by 023");
  });

  it("drops the prasadam line but keeps the QR when no seva gives prasadam", () => {
    const r = receipt({ prasadam: "none", lines: [{ ...receipt().lines[1], changed: false }], totalPaise: 50500 });
    const { container } = render(<ReceiptSlip model={model(r)} />);
    expect(container.textContent).not.toContain("prasadam counter");
    expect(container.textContent).not.toContain("ಪ್ರಸಾದ ಕೌಂಟರ್‌ನಲ್ಲಿ ತೋರಿಸಿ");
    expect(container.querySelector(".s-qr svg")).not.toBeNull();
    expect(qrcode.create).toHaveBeenCalledWith(`${SITE}/r/${TOKEN}`, { errorCorrectionLevel: "M", margin: 4 });
  });

  it("prints the English temple name before the Kannada one", () => {
    const { container } = render(<ReceiptSlip model={model()} />);
    const head = container.querySelector(".s-head .nm");
    const text = head?.textContent ?? "";
    expect(text.indexOf("Sri Raghavendra Swamy Matha")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("Sri Raghavendra Swamy Matha")).toBeLessThan(text.indexOf("ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ"));
    expect(head?.querySelector('[lang="kn"]')?.textContent).toBe("ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ");
  });

  it("shows the header photos when they are set", () => {
    const s = settings({ photoLeftUrl: "https://site.example/left.jpg", photoRightUrl: "https://site.example/right.jpg" });
    const { container } = render(<ReceiptSlip model={model(receipt(), s)} />);
    const imgs = Array.from(container.querySelectorAll(".s-head img")).map((i) => i.getAttribute("src"));
    expect(imgs).toEqual(["https://site.example/left.jpg", "https://site.example/right.jpg"]);
  });
});

describe("SlipQr", () => {
  it("encodes the /r/<token> URL with error correction M", () => {
    const { container } = render(<SlipQr url={`${SITE}/r/${TOKEN}`} />);
    expect(qrcode.create).toHaveBeenCalledWith(`${SITE}/r/${TOKEN}`, { errorCorrectionLevel: "M", margin: 4 });
    const svg = container.querySelector("svg");
    // 21 modules plus a 4-module quiet zone on each side.
    expect(svg?.getAttribute("viewBox")).toBe("0 0 29 29");
    expect(svg?.getAttribute("width")).toBe("26mm");
    expect(svg?.getAttribute("height")).toBe("26mm");
    expect(container.querySelector("path")?.getAttribute("d")).toBe("M4 4h1v1h-1z");
  });
});

describe("printSlips", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders every slip into the print root, waits for the photos, prints, and clears after print", async () => {
    const print = jest.spyOn(window, "print").mockImplementation(() => undefined);
    render(<PrintRoot />);
    const root = document.getElementById("seva-print-root");
    expect(root).not.toBeNull();

    const withPhoto = model(receipt(), settings({ photoLeftUrl: "https://site.example/left.jpg" }));
    const second = model(receipt({ receiptNo: "C1-023-10-2026/000125", sevaDate: "2027-08-29", position: 2 }));
    let done = false;
    let job: Promise<void> = Promise.resolve();
    act(() => {
      job = printSlips([withPhoto, second]).then(() => {
        done = true;
      });
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(root?.querySelectorAll(".slip")).toHaveLength(2);
    expect(print).not.toHaveBeenCalled();

    await act(async () => {
      root?.querySelector("img")?.dispatchEvent(new Event("load"));
      await job;
    });
    expect(done).toBe(true);
    expect(print).toHaveBeenCalledTimes(1);
    expect(root?.textContent).toContain("C1-023-10-2026/000125");

    await act(async () => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(root?.querySelectorAll(".slip")).toHaveLength(0);
  });

  it("clears the previous job at the start of the next print", async () => {
    jest.spyOn(window, "print").mockImplementation(() => undefined);
    render(<PrintRoot />);
    const root = document.getElementById("seva-print-root");

    await act(async () => {
      await printSlips([model()]);
    });
    expect(root?.querySelectorAll(".slip")).toHaveLength(1);

    const next = model(receipt({ receiptNo: "C1-023-10-2026/000126" }));
    await act(async () => {
      await printSlips([next]);
    });
    expect(root?.querySelectorAll(".slip")).toHaveLength(1);
    expect(root?.textContent).toContain("C1-023-10-2026/000126");
    expect(root?.textContent).not.toContain("C1-023-10-2026/000124");
  });
});
