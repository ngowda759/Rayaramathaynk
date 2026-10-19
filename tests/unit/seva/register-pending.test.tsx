import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import RegisterPage from "@/app/admin/receipts/register/page";
import type { ReceiptListParams } from "@/services/seva/receipts.service";
import type { ReceiptListItem } from "@/types/seva-receipts";

/**
 * Receipts register loading states (plan A4P-3, owner's review): the first load shows skeleton rows shaped like the
 * list, never only a line of text; a later filter, search or page change keeps the rows on screen with an inline
 * pending line above them.
 */

type Page = { rows: ReceiptListItem[]; nextCursor: string | null };

const mockUser = { getIdToken: async (): Promise<string> => "token" };
const mockCalls: { params: ReceiptListParams; resolve(p: Page): void }[] = [];
const mockReceipts = {
  list: jest.fn(
    (params: ReceiptListParams) =>
      new Promise<Page>((resolve) => {
        mockCalls.push({ params, resolve });
      }),
  ),
  get: jest.fn(),
  resolveGap: jest.fn(),
};

jest.mock("@/components/seva/shell/SevaGate", () => ({
  SevaGate: ({ children }: { children: unknown }) => children,
}));
jest.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("@/hooks/seva/useSevaMe", () => ({ useSevaMe: () => ({ me: null, can: () => true }) }));
jest.mock("@/services/seva/receipts.service", () => ({ receiptsApi: () => mockReceipts }));
jest.mock("@/services/seva/reports.service", () => ({ reportsApi: () => ({ continuity: async () => [] }) }));
jest.mock("@/services/seva/catalogue.service", () => ({ catalogueApi: () => ({ list: async () => [] }) }));
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/admin/receipts/register",
}));

function item(n: number): ReceiptListItem {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    receiptNo: `C1-023-10-2026/${String(100 + n).padStart(6, "0")}`,
    series: "C1",
    businessDate: "2026-10-19",
    issuedAt: "2026-10-19T05:30:00.000Z",
    devoteeName: `Devotee ${n}`,
    sevas: "Paaduka Pooja",
    totalPaise: 50_500,
    mode: "cash",
    status: "issued",
    changed: false,
    printCount: 1,
    prasadam: "pending",
    groupNo: `G-2610-${String(n).padStart(4, "0")}`,
    position: 1,
    count: 1,
    issuedByStaffId: null,
    cancelDeadline: null,
    refundState: "none",
  };
}

async function answerLast(p: Page): Promise<void> {
  await act(async () => {
    mockCalls[mockCalls.length - 1].resolve(p);
  });
}

function pendingLine(): Element | null {
  return document.querySelector('[data-register-pending="true"]');
}

beforeEach(() => {
  mockCalls.length = 0;
  mockReceipts.list.mockClear();
});

afterEach(cleanup);

describe("receipts register loading", () => {
  it("shows skeleton rows on first load, then keeps the rows with an inline pending line on later changes", async () => {
    render(<RegisterPage />);

    // First load: skeleton rows, announced once, and no bare "Loading receipts" text.
    await waitFor(() => expect(mockCalls).toHaveLength(1));
    const skeleton = document.querySelector("[data-register-skeleton]");
    expect(skeleton).not.toBeNull();
    expect(skeleton).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(/Loading receipts/)).toBeNull();

    await answerLast({ rows: [item(1), item(2)], nextCursor: "c2" });
    expect(document.querySelector("[data-register-skeleton]")).toBeNull();
    expect(screen.getAllByRole("button", { name: /Open C1-023-10-2026\/000101/ }).length).toBeGreaterThan(0);
    expect(pendingLine()).toBeNull();

    // A filter change: the rows stay, dimmed, with the pending line; never a blank list or a skeleton.
    fireEvent.change(screen.getByLabelText(/^Payment/), { target: { value: "upi" } });
    await waitFor(() => expect(mockCalls).toHaveLength(2));
    expect(mockCalls[1].params.mode).toBe("upi");
    expect(pendingLine()).not.toBeNull();
    expect(screen.getByRole("status", { name: "Loading receipts..." })).toBe(pendingLine());
    expect(screen.getAllByRole("button", { name: /Open C1-023-10-2026\/000101/ }).length).toBeGreaterThan(0);
    expect(screen.getByTestId("register-list")).toHaveAttribute("aria-busy", "true");
    expect(document.querySelector("[data-register-skeleton]")).toBeNull();
    expect(screen.queryByText(/Loading receipts/)).toBeNull();

    await answerLast({ rows: [item(3)], nextCursor: "c3" });
    expect(screen.queryAllByRole("button", { name: /Open C1-023-10-2026\/000101/ })).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: /Open C1-023-10-2026\/000103/ }).length).toBeGreaterThan(0);
    expect(pendingLine()).toBeNull();
    expect(screen.getByTestId("register-list")).not.toHaveAttribute("aria-busy", "true");

    // Typing a search: the pending line shows at once, before the search settles and is sent.
    fireEvent.change(screen.getByLabelText(/^Search by number or name/), { target: { value: "Dev" } });
    expect(pendingLine()).not.toBeNull();
    expect(mockCalls).toHaveLength(2);
    await waitFor(() => expect(mockCalls).toHaveLength(3));
    expect(mockCalls[2].params.q).toBe("Dev");
    await answerLast({ rows: [item(3)], nextCursor: "c3" });
    expect(pendingLine()).toBeNull();

    // The next page: the button and the line both show it is loading; the rows stay.
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    await waitFor(() => expect(mockCalls).toHaveLength(4));
    expect(mockCalls[3].params.cursor).toBe("c3");
    expect(pendingLine()).not.toBeNull();
    expect(screen.getByRole("button", { name: /Loading more/ })).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("button", { name: /Open C1-023-10-2026\/000103/ }).length).toBeGreaterThan(0);
    await answerLast({ rows: [item(4)], nextCursor: null });
    expect(screen.getAllByRole("button", { name: /Open C1-023-10-2026\/000104/ }).length).toBeGreaterThan(0);
    await waitFor(() => expect(pendingLine()).toBeNull());
  });
});
