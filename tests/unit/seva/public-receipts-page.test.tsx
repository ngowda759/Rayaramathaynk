import { render, screen, waitFor } from "@testing-library/react";
import PublicReceiptsPage from "@/app/(public)/receipts/page";
import { formatCurrency, formatDate } from "@/lib/format";

// A stable user object, so the page's effect does not re-run on every render.
const mockUser = { getIdToken: () => Promise.resolve("id-token") };

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

jest.mock("@/components/layout/Navbar", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/layout/Footer", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/home/SevaBooking", () => ({ __esModule: true, default: () => null }));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        receipts: [
          {
            id: "b1",
            sevaTitle: "Panchamrutha Abhisheka",
            preferredDate: "2026-10-25",
            status: "confirmed",
            paymentStatus: "paid",
            amount: 251,
          },
        ],
      }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("public receipts page (signed in)", () => {
  it("loads the caller's bookings on open and renders the row fields", async () => {
    render(<PublicReceiptsPage />);

    await waitFor(() => expect(screen.getByText("Panchamrutha Abhisheka")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/public/receipts", {
      headers: { Authorization: "Bearer id-token" },
    });
    expect(screen.getByText(formatDate("2026-10-25"))).toBeTruthy();
    expect(screen.getByText("confirmed")).toBeTruthy();
    expect(screen.getByText("paid")).toBeTruthy();
    expect(screen.getByText(formatCurrency(251))).toBeTruthy();
  });

  it("offers no search box and no receipt pop-up", async () => {
    render(<PublicReceiptsPage />);

    await waitFor(() => expect(screen.getByText("Panchamrutha Abhisheka")).toBeTruthy());
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByText(/View Receipt/i)).toBeNull();
  });
});
