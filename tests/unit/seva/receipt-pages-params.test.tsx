import { render, waitFor } from "@testing-library/react";
import ReceiptDetailPage from "@/app/admin/receipts/[receiptId]/page";
import ReceiptPrintPage from "@/app/admin/receipts/[receiptId]/print/page";

const mockGetReceipt = jest.fn();
// A stable user object, so the pages' effects do not re-run on every render.
const mockUser = { getIdToken: () => Promise.resolve("id-token") };

jest.mock("next/navigation", () => ({
  useParams: () => ({ receiptId: "r1" }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

jest.mock("@/services/receipt.service", () => ({
  receiptService: {
    getReceipt: (...args: unknown[]) => mockGetReceipt(...args),
    getReceiptPdf: jest.fn(),
  },
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Resolve nothing: the tests only check which id the page asks for.
  mockGetReceipt.mockResolvedValue(null);
});

describe("receipt pages under app/admin/receipts/[receiptId]", () => {
  it("detail page loads the receipt from params.receiptId", async () => {
    render(<ReceiptDetailPage />);
    await waitFor(() => expect(mockGetReceipt).toHaveBeenCalledWith("r1", "id-token"));
  });

  it("print page loads the receipt from params.receiptId", async () => {
    render(<ReceiptPrintPage />);
    await waitFor(() => expect(mockGetReceipt).toHaveBeenCalledWith("r1", "id-token"));
  });
});
