import { render, waitFor } from "@testing-library/react";
import ReceiptDetailPage from "@/app/seva/(desk)/[receiptId]/page";
import ReceiptPrintPage from "@/app/seva/(desk)/[receiptId]/print/page";

// The pages were rebuilt on Supabase in Task A4-4; this keeps the original check that the folder's id arrives as
// params.receiptId. The full page behaviour is in receipt-detail.test.tsx.

const mockGet = jest.fn();
// A stable user object, so the pages' effects do not re-run on every render.
const mockUser = { uid: "u1", getIdToken: () => Promise.resolve("id-token") };

jest.mock("next/navigation", () => ({
  useParams: () => ({ receiptId: "r1" }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, loading: false, sevaRole: "temple_admin" }),
}));

jest.mock("@/hooks/seva/useSevaMe", () => ({
  useSevaMe: () => ({
    me: { staffId: "s1", staffNo: 1, name: "Admin", role: "temple_admin", viewOnly: false, actions: [], counter: null },
    loading: false,
    error: null,
    can: () => true,
    reload: jest.fn(),
  }),
}));

jest.mock("@/services/seva/receipts.service", () => ({
  receiptsApi: () => ({ get: (...args: unknown[]) => mockGet(...args) }),
}));

jest.mock("@/lib/seva/offline/db", () => ({
  openSevaDb: () => Promise.reject(new Error("no indexeddb in this test")),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Never resolve: the tests only check which id the page asks for.
  mockGet.mockReturnValue(new Promise(() => undefined));
});

describe("receipt pages under app/seva/(desk)/[receiptId]", () => {
  it("detail page loads the receipt from params.receiptId", async () => {
    render(<ReceiptDetailPage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("r1"));
  });

  it("print page loads the receipt from params.receiptId", async () => {
    render(<ReceiptPrintPage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("r1"));
  });
});
