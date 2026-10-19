import "@testing-library/jest-dom";
import { cleanup, render, screen } from "@testing-library/react";

import type { PublicReceipt } from "@/types/seva-receipts";

/* ---------- mocks ---------- */

const mockGetPublic = jest.fn();
const mockRateLimit = jest.fn();
const mockHeaders = jest.fn();
const mockCan = jest.fn();

class NotFoundSignal extends Error {}

jest.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundSignal("NEXT_NOT_FOUND");
  },
}));

jest.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}));

jest.mock("@/lib/seva/server/public-receipt", () => ({
  getPublicReceiptByToken: (...args: unknown[]) => mockGetPublic(...args),
}));

jest.mock("@/lib/seva/server/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

jest.mock("@/hooks/seva/useSevaMe", () => ({
  useSevaMe: () => ({ me: null, loading: false, error: null, can: mockCan, reload: jest.fn() }),
}));

import PublicReceiptPage from "@/app/r/[token]/page";
import NotFoundPage from "@/app/r/[token]/not-found";
import { PublicReceiptView } from "@/components/seva/receipt/PublicReceiptView";

/* ---------- fixtures ---------- */

const TOKEN = "AbCdEfGhIjKlMnOpQrStUv";
const PHONE = "9876543210";

const RECEIPT: PublicReceipt = {
  templeNameEn: "Sri Raghavendra Swamy Matha",
  templeNameKn: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ",
  receiptNo: "C1-023-10-2026/000124",
  sevaDate: "2026-08-28",
  devoteeName: "Venkatesh Rao",
  gotra: "Bharadwaja",
  nakshatra: "Rohini",
  lines: [
    { nameEn: "Panchamrutha Abhisheka", nameKn: "ಪಂಚಾಮೃತ ಅಭಿಷೇಕ", quantity: 1, amountPaise: 10500 },
    { nameEn: "Paaduka Pooja", nameKn: null, quantity: 2, amountPaise: 50500 },
  ],
  totalPaise: 61000,
  mode: "cash",
  status: "valid",
  prasadam: "pending",
};

function headersWith(ip: string | null): Headers {
  const h = new Headers();
  if (ip) h.set("x-forwarded-for", `${ip}, 10.0.0.1`);
  return h;
}

async function renderPage(token: string = TOKEN): Promise<void> {
  const element = await PublicReceiptPage({ params: Promise.resolve({ token }) });
  render(element);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHeaders.mockResolvedValue(headersWith("203.0.113.9"));
  mockRateLimit.mockReturnValue(true);
  mockGetPublic.mockResolvedValue(RECEIPT);
  mockCan.mockReturnValue(false);
});

afterEach(cleanup);

/* ---------- tests ---------- */

describe("public receipt page /r/<token>", () => {
  it("public view shows the slip details and Valid, and never a phone", async () => {
    // Even if a phone ever reached the view by mistake, it is not printed: only named fields are shown.
    mockGetPublic.mockResolvedValue({ ...RECEIPT, phone: PHONE });
    await renderPage();

    expect(mockGetPublic).toHaveBeenCalledWith(TOKEN);
    expect(screen.getByText("C1-023-10-2026/000124")).toBeInTheDocument();
    expect(screen.getByText("Venkatesh Rao")).toBeInTheDocument();
    expect(screen.getByText("Bharadwaja")).toBeInTheDocument();
    expect(screen.getByText("Rohini")).toBeInTheDocument();
    expect(screen.getByText("Panchamrutha Abhisheka")).toBeInTheDocument();
    expect(screen.getByText("Paaduka Pooja")).toBeInTheDocument();
    expect(screen.getByText("Rs 610.00")).toBeInTheDocument();
    expect(screen.getByTestId("public-receipt-status")).toHaveTextContent("Valid");
    expect(screen.getByTestId("public-receipt-prasadam")).toHaveTextContent("Not given yet");
    expect(document.body.textContent ?? "").not.toContain(PHONE);
    expect(document.body.textContent ?? "").not.toMatch(/phone/i);
  });

  it("public view shows Cancelled for a cancelled receipt", () => {
    render(<PublicReceiptView receipt={{ ...RECEIPT, status: "cancelled", prasadam: "none" }} />);
    expect(screen.getByTestId("public-receipt-status")).toHaveTextContent("Cancelled");
    expect(screen.getByTestId("public-receipt-status")).not.toHaveTextContent("Valid");
  });

  it("shows prasadam given", () => {
    render(<PublicReceiptView receipt={{ ...RECEIPT, prasadam: "given" }} />);
    expect(screen.getByTestId("public-receipt-prasadam")).toHaveTextContent("Given");
  });

  it("answers not found for an unknown token", async () => {
    mockGetPublic.mockResolvedValue(null);
    await expect(renderPage("unknown")).rejects.toBeInstanceOf(NotFoundSignal);

    render(<NotFoundPage />);
    expect(screen.getByText("This receipt was not found.")).toBeInTheDocument();
  });

  it("limits each IP to 30 requests a minute and reads nothing once over", async () => {
    await renderPage();
    expect(mockRateLimit).toHaveBeenCalledWith("r:203.0.113.9", { limit: 30, windowMs: 60_000 });

    cleanup();
    mockRateLimit.mockReturnValue(false);
    mockGetPublic.mockClear();
    await renderPage();
    expect(mockGetPublic).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Too many requests");
  });

  it("offers the prasadam counter only to people who may give prasadam", async () => {
    await renderPage();
    expect(screen.queryByRole("link", { name: /Open in the prasadam counter/ })).not.toBeInTheDocument();

    cleanup();
    mockCan.mockImplementation((action: string) => action === "prasadam.give");
    await renderPage();
    expect(screen.getByRole("link", { name: /Open in the prasadam counter/ })).toHaveAttribute(
      "href",
      `/admin/prasadam?token=${TOKEN}`,
    );
  });
});
