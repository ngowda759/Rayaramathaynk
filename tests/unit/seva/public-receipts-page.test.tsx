import { render, screen, waitFor } from "@testing-library/react";
import toast from "react-hot-toast";
import PublicReceiptsPage from "@/app/(public)/receipts/page";
import { formatCurrency, formatDate } from "@/lib/format";

// A stable user object, so the page's effect does not re-run on every render.
const mockUser = { getIdToken: () => Promise.resolve("id-token") };
let mockAuthState: { user: typeof mockUser | null; loading: boolean } = { user: mockUser, loading: false };

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockAuthState,
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
  mockAuthState = { user: mockUser, loading: false };
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

  it("shows the API error message through a toast when the request fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { code: "unavailable", message: "Receipts are resting for a moment." } }),
    });
    render(<PublicReceiptsPage />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Receipts are resting for a moment."));
    expect(screen.queryByText("Panchamrutha Abhisheka")).toBeNull();
  });
});

describe("public receipts page (signed out)", () => {
  it("shows the sign-in prompt and never calls the API", async () => {
    mockAuthState = { user: null, loading: false };
    render(<PublicReceiptsPage />);

    expect(screen.getByText("Sign in to see your seva receipts")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
