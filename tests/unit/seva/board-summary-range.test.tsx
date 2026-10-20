import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import BoardSummaryPage from "@/app/seva/(desk)/reports/summary/page";
import { quickRange } from "@/lib/seva/export/collect";
import { BOARD, EXPORT } from "@/lib/seva/strings/export";

/**
 * The board summary's own date range (owner's fix, 2026-10-20): This month, Last month, This year, Last year or a
 * custom from/to, above the sheets and hidden in print. A choice updates ?from=&to= with router.replace; a custom
 * range with from after to, or a date after today, is refused. The export audit is still written once per range.
 */

const mockReplace = jest.fn();
const mockParams = { current: new URLSearchParams("") };
const mockAudit = jest.fn<Promise<undefined>, [unknown]>(async () => undefined);
const mockUser = { getIdToken: async (): Promise<string> => "token" };
const mockMe = { me: { name: "Prakash", staffNo: 8 }, can: () => true };

jest.mock("@/components/seva/shell/SevaGate", () => ({
  SevaGate: ({ children }: { children: unknown }) => children,
}));
jest.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("@/hooks/seva/useSevaMe", () => ({ useSevaMe: () => mockMe }));
jest.mock("next/navigation", () => ({
  useSearchParams: () => mockParams.current,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  usePathname: () => "/seva/reports/summary",
}));
jest.mock("@/services/seva/reports.service", () => ({
  reportsApi: () => ({
    sevaSummary: async () => ({ sevas: [], totals: null, rateChanges: [] }),
    dayCloses: async () => [],
    continuity: async () => [],
    exportAudit: (body: unknown) => mockAudit(body),
  }),
}));
jest.mock("@/services/seva/settings.service", () => ({
  settingsApi: () => ({
    getTemplate: async () => ({ templeNameEn: "Temple", templeNameKn: "ಮಠ", footerBlessing: "" }),
  }),
}));
jest.mock("@/components/seva/export/BoardSummary", () => ({
  BoardSummary: ({ model }: { model: { range: { from: string; to: string } } }) => (
    <p data-testid="report">{`${model.range.from}..${model.range.to}`}</p>
  ),
}));
jest.mock("@/lib/seva/export/collect", () => ({
  ...jest.requireActual("@/lib/seva/export/collect"),
  collectExportData: async () => ({ receipts: [], cancelledChanged: [] }),
  collectChangeReasons: async () => [],
}));

// 20 Oct 2026, 10:00 IST. Only Date is faked, so promises and waitFor run as usual.
const NOW = new Date("2026-10-20T04:30:00.000Z");

function radio(name: RegExp): HTMLElement {
  return screen.getByRole("radio", { name });
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, toFake: ["Date"] });
  mockReplace.mockClear();
  mockAudit.mockClear();
  mockParams.current = new URLSearchParams("");
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe("board summary date range", () => {
  it("defaults to This month with no query, above the sheets and hidden in print", async () => {
    render(<BoardSummaryPage />);
    await waitFor(() => expect(screen.getByTestId("report")).toHaveTextContent("2026-10-01..2026-10-20"));
    expect(radio(/This month/)).toHaveAttribute("aria-checked", "true");
    const control = screen.getByRole("radiogroup", { name: BOARD.range.en }).closest("[data-board-range]");
    expect(control).toHaveClass("print:hidden");
    // The control comes before the sheets in the page.
    expect(control?.compareDocumentPosition(screen.getByTestId("report")) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("choosing Last month sets from and to to the previous IST calendar month in the URL", async () => {
    render(<BoardSummaryPage />);
    fireEvent.click(radio(/Last month/));
    expect(quickRange("lastMonth", NOW)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(mockReplace).toHaveBeenCalledWith("/seva/reports/summary?from=2026-09-01&to=2026-09-30", { scroll: false });
  });

  it("offers This year and Last year", async () => {
    render(<BoardSummaryPage />);
    fireEvent.click(radio(/Last year/));
    expect(mockReplace).toHaveBeenLastCalledWith("/seva/reports/summary?from=2025-01-01&to=2025-12-31", { scroll: false });
    fireEvent.click(radio(/This year/));
    expect(mockReplace).toHaveBeenLastCalledWith("/seva/reports/summary?from=2026-01-01&to=2026-10-20", { scroll: false });
  });

  it("marks the range the URL already holds", async () => {
    mockParams.current = new URLSearchParams("from=2026-09-01&to=2026-09-30");
    const { unmount } = render(<BoardSummaryPage />);
    expect(radio(/Last month/)).toHaveAttribute("aria-checked", "true");
    unmount();
    mockParams.current = new URLSearchParams("from=2026-10-05&to=2026-10-12");
    render(<BoardSummaryPage />);
    expect(radio(/Custom/)).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText(/^From/)).toHaveValue("2026-10-05");
    expect(screen.getByLabelText(/^To/)).toHaveValue("2026-10-12");
  });

  it("Custom: a valid from and to update the URL; from after to is refused", async () => {
    render(<BoardSummaryPage />);
    fireEvent.click(radio(/Custom/));
    expect(mockReplace).not.toHaveBeenCalled();
    const from = screen.getByLabelText(/^From/);
    const to = screen.getByLabelText(/^To/);
    expect(to).toHaveAttribute("max", "2026-10-20");
    expect(from).toHaveAttribute("max", "2026-10-20");

    fireEvent.change(from, { target: { value: "2026-10-05" } });
    expect(mockReplace).toHaveBeenLastCalledWith("/seva/reports/summary?from=2026-10-05&to=2026-10-20", { scroll: false });
    fireEvent.change(to, { target: { value: "2026-10-12" } });
    expect(mockReplace).toHaveBeenLastCalledWith("/seva/reports/summary?from=2026-10-05&to=2026-10-12", { scroll: false });

    mockReplace.mockClear();
    fireEvent.change(from, { target: { value: "2026-10-15" } });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(EXPORT.badRange.en);
  });

  it("Custom: a date after today is refused", async () => {
    render(<BoardSummaryPage />);
    fireEvent.click(radio(/Custom/));
    fireEvent.change(screen.getByLabelText(/^To/), { target: { value: "2026-10-25" } });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(BOARD.futureDate.en);
  });

  it("still writes one export audit row per range", async () => {
    const { rerender } = render(<BoardSummaryPage />);
    await waitFor(() => expect(screen.getByTestId("report")).toHaveTextContent("2026-10-01..2026-10-20"));
    expect(mockAudit).toHaveBeenCalledTimes(1);
    mockParams.current = new URLSearchParams("from=2026-09-01&to=2026-09-30");
    await act(async () => {
      rerender(<BoardSummaryPage />);
    });
    await waitFor(() => expect(screen.getByTestId("report")).toHaveTextContent("2026-09-01..2026-09-30"));
    expect(mockAudit).toHaveBeenCalledTimes(2);
    expect(mockAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({ format: "print", from: "2026-09-01", to: "2026-09-30" }),
    );
  });
});
