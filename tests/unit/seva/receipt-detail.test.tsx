import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { SevaClientError } from "@/services/seva/http";
import type { SevaMe, SlipSettings } from "@/types/seva";
import type { ReceiptDetail } from "@/types/seva-receipts";

/* ---------- mocks ---------- */

const mockGet = jest.fn();
const mockPrints = jest.fn();
const mockBootstrap = jest.fn();
const mockGetTemplate = jest.fn();
const mockPrintSlips = jest.fn();
const mockCan = jest.fn();
const mockReceiptsApi = jest.fn();
let mockCredentials: { deviceId: string; secret: string } | null = null;
let mockMe: SevaMe | null = null;
// A stable user object, so the pages' effects do not re-run on every render.
const mockUser = { uid: "u1", getIdToken: () => Promise.resolve("id-token") };

jest.mock("next/navigation", () => ({
  useParams: () => ({ receiptId: "r1" }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/admin/receipts/r1",
}));

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, loading: false, sevaRole: "temple_admin" }),
}));

jest.mock("@/hooks/seva/useSevaMe", () => ({
  useSevaMe: () => ({ me: mockMe, loading: false, error: null, can: mockCan, reload: jest.fn() }),
}));

jest.mock("@/services/seva/receipts.service", () => ({
  receiptsApi: (...args: unknown[]) => {
    mockReceiptsApi(...args);
    return { get: (...a: unknown[]) => mockGet(...a) };
  },
}));

jest.mock("@/services/seva/counter.service", () => ({
  counterApi: () => ({
    prints: (...a: unknown[]) => mockPrints(...a),
    bootstrap: (...a: unknown[]) => mockBootstrap(...a),
  }),
}));

jest.mock("@/services/seva/settings.service", () => ({
  settingsApi: () => ({ getTemplate: (...a: unknown[]) => mockGetTemplate(...a) }),
}));

jest.mock("@/lib/seva/offline/db", () => ({
  openSevaDb: () => Promise.resolve({ close: () => undefined }),
}));

jest.mock("@/lib/seva/offline/device", () => ({
  getDeviceCredentials: () => Promise.resolve(mockCredentials),
  deviceHeader: (c: { deviceId: string; secret: string }) => `${c.deviceId}.${c.secret}`,
}));

jest.mock("@/lib/seva/print/printSlips", () => ({
  PRINT_ROOT_ID: "seva-print-root",
  printSlips: (...a: unknown[]) => mockPrintSlips(...a),
}));

import ReceiptDetailPage from "@/app/admin/receipts/[receiptId]/page";
import ReceiptPrintPage from "@/app/admin/receipts/[receiptId]/print/page";
import { PrasadamShortcut } from "@/components/seva/receipt/PrasadamShortcut";
import { ReceiptHistory } from "@/components/seva/receipt/ReceiptHistory";

/* ---------- fixtures ---------- */

const SLIP: SlipSettings = {
  templeNameEn: "Sri Raghavendra Swamy Matha",
  templeNameKn: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ",
  addressLine1: "Yelahanka New Town",
  addressLine2: "Bengaluru 560064",
  registrationLine: null,
  photoLeftUrl: null,
  photoRightUrl: null,
  footerLine1: "",
  footerLine2: "",
  footerBlessing: "",
  printGotra: true,
  printNakshatra: true,
  printRashi: false,
};

const ME: SevaMe = {
  staffId: "s1",
  staffNo: 23,
  name: "Ramesh",
  role: "receptionist",
  viewOnly: false,
  actions: [],
  counter: { id: 1, name: "Counter 1", onlineSeries: "C1", offlineSeries: "OF1" },
};

function detail(over: Partial<ReceiptDetail> = {}): ReceiptDetail {
  return {
    id: "r1",
    clientReceiptId: "c1",
    receiptNo: "C1-023-10-2026/000124",
    seriesCode: "C1",
    sevaDate: "2026-10-19",
    groupNo: "G-2610-0042",
    position: 1,
    count: 1,
    orderTotalPaise: 10500,
    totalPaise: 10500,
    lines: [
      {
        lineNo: 1,
        sevaId: "sv1",
        code: "PA",
        nameEn: "Panchamrutha Abhisheka",
        nameKn: "ಪಂಚಾಮೃತ ಅಭಿಷೇಕ",
        quantity: 1,
        unitRatePaise: 10500,
        amountPaise: 10500,
        changed: false,
        prasadamItems: null,
      },
    ],
    payment: { mode: "cash" },
    devotee: { name: "Venkatesh Rao", gotra: "Bharadwaja" },
    qrToken: "AbCdEfGhIjKlMnOpQrStUv",
    issuedAt: "2026-10-19T04:30:00.000Z",
    issuedBy: { name: "Ramesh", staffNo: 23 },
    counterName: "Counter 1",
    channel: "counter",
    issuedOffline: false,
    status: "issued",
    printCount: 1,
    prasadam: "pending",
    // Deliberately not in time order: the page shows newest first.
    history: [
      { at: "2026-10-19T04:30:00.000Z", action: "receipt.issue", by: "Ramesh", reason: null },
      { at: "2026-10-19T06:00:00.000Z", action: "receipt.reprint", by: "Suresh", reason: null },
      { at: "2026-10-19T04:31:00.000Z", action: "receipt.print", by: null, reason: null },
    ],
    cancel: null,
    refundState: "none",
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMe = ME;
  mockCredentials = { deviceId: "11111111-1111-4111-8111-111111111111", secret: "s".repeat(43) };
  mockCan.mockReturnValue(true);
  mockGet.mockResolvedValue(detail());
  mockBootstrap.mockResolvedValue({ slip: SLIP, siteUrl: "https://temple.example" });
  mockGetTemplate.mockResolvedValue(SLIP);
  mockPrints.mockResolvedValue({ receipts: [{ id: "r1", printCount: 2, duplicate: true }] });
  mockPrintSlips.mockResolvedValue(undefined);
});

afterEach(cleanup);

/* ---------- detail page ---------- */

describe("receipt detail page", () => {
  it("detail page loads by params.receiptId and lists the history newest first", async () => {
    render(<ReceiptDetailPage />);

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("r1"));
    const list = await screen.findByRole("list", { name: /History/ });
    const items = within(list).getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(items).toHaveLength(3);
    expect(items[0]).toContain("Reprinted");
    expect(items[0]).toContain("Suresh");
    expect(items[1]).toContain("First print");
    expect(items[2]).toContain("Issued");

    // The slip, payment and prasadam state are shown.
    expect(screen.getAllByText("C1-023-10-2026/000124").length).toBeGreaterThan(0);
    expect(screen.getByTestId("receipt-payment")).toHaveTextContent("Cash");
    expect(screen.getByTestId("receipt-prasadam")).toHaveTextContent("Not given yet");
  });

  it("calls the receipts API with the device header when this PC is registered", async () => {
    render(<ReceiptDetailPage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const [, device] = mockReceiptsApi.mock.calls[0] as [() => Promise<string>, () => string | null];
    expect(device()).toBe(`${mockCredentials?.deviceId}.${"s".repeat(43)}`);
  });

  it("shows the API message when the receipt cannot be loaded", async () => {
    mockGet.mockRejectedValue(new SevaClientError("not_found", 404, "This receipt was not found."));
    render(<ReceiptDetailPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This receipt was not found.");
  });

  it("shows the cancel and refund for a cancelled receipt and offers no print", async () => {
    mockGet.mockResolvedValue(
      detail({
        status: "cancelled",
        cancel: { at: "2026-10-19T05:00:00.000Z", by: "Ramesh", reasonCode: "wrong_seva", note: null },
        refundState: "done",
      }),
    );
    render(<ReceiptDetailPage />);
    expect(await screen.findByTestId("receipt-cancel")).toHaveTextContent("Wrong seva");
    expect(screen.queryByRole("link", { name: /Print/ })).not.toBeInTheDocument();
  });
});

describe("receipt history", () => {
  it("shows a reason when there is one", () => {
    render(
      <ReceiptHistory
        history={[{ at: "2026-10-19T05:00:00.000Z", action: "receipt.amount_changed", by: "Ramesh", reason: "Old rate" }]}
      />,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("Amount changed");
    expect(screen.getByRole("listitem")).toHaveTextContent("Old rate");
  });
});

describe("prasadam shortcut", () => {
  it("shows the prasadam shortcut only to people who may give prasadam", () => {
    mockCan.mockImplementation((action: string) => action === "prasadam.give");
    const { unmount } = render(<PrasadamShortcut token="AbCdEfGhIjKlMnOpQrStUv" />);
    expect(screen.getByRole("link", { name: /Open in the prasadam counter/ })).toHaveAttribute(
      "href",
      "/admin/prasadam?token=AbCdEfGhIjKlMnOpQrStUv",
    );
    unmount();

    mockCan.mockReturnValue(false);
    render(<PrasadamShortcut token="AbCdEfGhIjKlMnOpQrStUv" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

/* ---------- print page ---------- */

describe("receipt print page", () => {
  it("records the print, then prints a DUPLICATE slip for a reprint", async () => {
    render(<ReceiptPrintPage />);

    await waitFor(() => expect(mockPrintSlips).toHaveBeenCalledTimes(1));
    expect(mockGet).toHaveBeenCalledWith("r1");
    expect(mockPrints).toHaveBeenCalledWith(["r1"]);
    const [models] = mockPrintSlips.mock.calls[0] as [{ receiptNo: string; duplicate: unknown }[]];
    expect(models).toHaveLength(1);
    expect(models[0].receiptNo).toBe("C1-023-10-2026/000124");
    expect(models[0].duplicate).toEqual(expect.objectContaining({ byStaffNo: "023" }));
  });

  it("prints a first print without the DUPLICATE band", async () => {
    mockGet.mockResolvedValue(detail({ printCount: 0 }));
    mockPrints.mockResolvedValue({ receipts: [{ id: "r1", printCount: 1, duplicate: false }] });
    render(<ReceiptPrintPage />);
    await waitFor(() => expect(mockPrintSlips).toHaveBeenCalledTimes(1));
    const [models] = mockPrintSlips.mock.calls[0] as [{ duplicate: unknown }[]];
    expect(models[0].duplicate).toBeNull();
  });

  it("a first print of another counter's receipt shows the API message and keeps the page usable", async () => {
    mockGet.mockResolvedValue(detail({ printCount: 0 }));
    const message = "Only this counter's receipts can be printed here for the first time.";
    mockPrints.mockRejectedValue(new SevaClientError("forbidden", 403, message));
    render(<ReceiptPrintPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(mockPrintSlips).not.toHaveBeenCalled();
    // Still usable: the receipt is on screen, the person can go back or try again.
    expect(screen.getAllByText("C1-023-10-2026/000124").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Back to the receipt/ })).toHaveAttribute("href", "/admin/receipts/r1");

    mockPrints.mockResolvedValue({ receipts: [{ id: "r1", printCount: 1, duplicate: false }] });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    });
    await waitFor(() => expect(mockPrintSlips).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not print a cancelled receipt", async () => {
    mockGet.mockResolvedValue(detail({ status: "cancelled" }));
    render(<ReceiptPrintPage />);
    expect(await screen.findByText(/A cancelled receipt is not printed again/)).toBeInTheDocument();
    expect(mockPrints).not.toHaveBeenCalled();
    expect(mockPrintSlips).not.toHaveBeenCalled();
  });

  it("asks for a registered counter PC when this PC has no device", async () => {
    mockCredentials = null;
    mockMe = { ...ME, counter: null };
    render(<ReceiptPrintPage />);
    expect(await screen.findByText(/Printing needs a registered counter PC/)).toBeInTheDocument();
    expect(mockPrints).not.toHaveBeenCalled();
  });
});
