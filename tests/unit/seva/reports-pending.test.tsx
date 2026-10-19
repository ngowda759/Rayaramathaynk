import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import SevaSummaryPage from "@/app/admin/receipts/reports/page";
import FestivalPage from "@/app/admin/receipts/reports/festival/page";
import AuditPage from "@/app/admin/receipts/reports/audit/page";
import BoardSummaryPage from "@/app/admin/receipts/reports/summary/page";
import type { AuditEntry } from "@/services/seva/reports.service";

/**
 * Reports loading states (A4P-FIX item 5, after the register of plan A4P-3): the seva summary, festival, audit trail and
 * board summary pages show skeleton blocks on first load, never only a line of "Loading the report..." text; a later
 * change keeps the earlier report on screen, marked busy, with the inline pending line above it.
 */

type Deferred = { args: unknown[]; resolve(value: unknown): void; reject(err: unknown): void };
const mockCalls: Record<string, Deferred[]> = {};

function mockDeferred(name: string) {
  return (...args: unknown[]) =>
    new Promise((resolve, reject) => {
      (mockCalls[name] ??= []).push({ args, resolve, reject });
    });
}

const mockUser = { getIdToken: async (): Promise<string> => "token" };
const mockParams = { current: new URLSearchParams("from=2026-10-01&to=2026-10-19") };

jest.mock("@/components/seva/shell/SevaGate", () => ({
  SevaGate: ({ children }: { children: unknown }) => children,
}));
jest.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mockUser }) }));
const mockMe = { me: { name: "Prakash", staffNo: 8 }, can: () => true };
jest.mock("@/hooks/seva/useSevaMe", () => ({ useSevaMe: () => mockMe }));
jest.mock("next/navigation", () => ({
  useSearchParams: () => mockParams.current,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/admin/receipts/reports",
}));
jest.mock("@/services/seva/reports.service", () => ({
  reportsApi: () => ({
    sevaSummary: mockDeferred("sevaSummary"),
    festival: mockDeferred("festival"),
    audit: mockDeferred("audit"),
    dayCloses: async () => [],
    continuity: async () => [],
    exportAudit: async () => undefined,
  }),
}));
jest.mock("@/services/seva/settings.service", () => ({
  settingsApi: () => ({
    listFestivals: mockDeferred("listFestivals"),
    getTemplate: async () => ({ templeNameEn: "Temple", templeNameKn: "ಮಠ", footerBlessing: "" }),
  }),
}));
// The report views are drawn by their own tests; here a stub names the report shown.
jest.mock("@/components/seva/reports/SevaSummary", () => ({
  ...jest.requireActual("@/components/seva/reports/SevaSummary"),
  SevaSummary: ({ report }: { report: { label: string } }) => <p data-testid="report">{report.label}</p>,
}));
jest.mock("@/components/seva/reports/FestivalView", () => ({
  FestivalView: ({ report }: { report: { label: string } }) => <p data-testid="report">{report.label}</p>,
}));
jest.mock("@/components/seva/export/BoardSummary", () => ({
  BoardSummary: ({ model }: { model: { range: { from: string; to: string } } }) => (
    <p data-testid="report">{`${model.range.from}..${model.range.to}`}</p>
  ),
}));
jest.mock("@/lib/seva/export/collect", () => ({
  ...jest.requireActual("@/lib/seva/export/collect"),
  collectExportData: mockDeferred("collectExportData"),
  collectChangeReasons: async () => [],
}));

async function answer(name: string, value: unknown, index = -1): Promise<void> {
  await waitFor(() => expect(mockCalls[name]?.length ?? 0).toBeGreaterThan(0));
  const list = mockCalls[name];
  await act(async () => {
    list[index < 0 ? list.length + index : index].resolve(value);
  });
}

function skeleton(): Element | null {
  return document.querySelector("[data-report-skeleton]");
}

function pendingLine(): Element | null {
  return document.querySelector('[data-report-pending="true"]');
}

function expectNoLoadingText(): void {
  expect(screen.queryByText(/Loading the report/)).toBeNull();
  expect(screen.queryByText(/Preparing the summary/)).toBeNull();
}

function entry(id: number, action: string): AuditEntry {
  return {
    id,
    at: "2026-10-19T05:30:00.000Z",
    action,
    entity: "receipt",
    entityId: null,
    receiptNo: `C1-023-10-2026/${String(100 + id).padStart(6, "0")}`,
    reason: `reason ${id}`,
    by: { staffId: "staff-8", name: "Prakash", staffNo: 8 },
    before: null,
    after: null,
  };
}

beforeEach(() => {
  for (const key of Object.keys(mockCalls)) delete mockCalls[key];
  mockParams.current = new URLSearchParams("from=2026-10-01&to=2026-10-19");
});

afterEach(cleanup);

describe("reports loading states", () => {
  it("seva summary: skeleton first, then the earlier report stays with the pending line while a new range loads", async () => {
    render(<SevaSummaryPage />);
    await waitFor(() => expect(mockCalls.sevaSummary).toHaveLength(1));
    expect(skeleton()).toHaveAttribute("aria-busy", "true");
    expect(pendingLine()).toBeNull();
    expectNoLoadingText();

    await answer("sevaSummary", { label: "October" });
    expect(skeleton()).toBeNull();
    expect(screen.getByTestId("report")).toHaveTextContent("October");
    expect(pendingLine()).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /This year/ }));
    await waitFor(() => expect(mockCalls.sevaSummary).toHaveLength(2));
    expect(pendingLine()).not.toBeNull();
    expect(screen.getByRole("status", { name: "Loading the report..." })).toBe(pendingLine());
    expect(screen.getByTestId("report")).toHaveTextContent("October");
    expect(screen.getByTestId("report-content")).toHaveAttribute("aria-busy", "true");
    expect(skeleton()).toBeNull();
    expectNoLoadingText();

    await answer("sevaSummary", { label: "2026" });
    expect(screen.getByTestId("report")).toHaveTextContent("2026");
    expect(pendingLine()).toBeNull();
    expect(screen.getByTestId("report-content")).not.toHaveAttribute("aria-busy");
  });

  it("festival: skeleton while the festivals and the first report load, pending line on a new compare year", async () => {
    render(<FestivalPage />);
    await waitFor(() => expect(mockCalls.listFestivals).toHaveLength(1));
    expect(skeleton()).toHaveAttribute("aria-busy", "true");
    expectNoLoadingText();

    await answer("listFestivals", [{ id: "f1", nameEn: "Aradhana", nameKn: null, active: true, dates: ["2026-08-20"] }]);
    await waitFor(() => expect(mockCalls.festival).toHaveLength(1));
    expect(skeleton()).toHaveAttribute("aria-busy", "true");
    expect(pendingLine()).toBeNull();
    expectNoLoadingText();

    await answer("festival", { label: "Aradhana vs 2025" });
    expect(skeleton()).toBeNull();
    expect(screen.getByTestId("report")).toHaveTextContent("Aradhana vs 2025");

    const year = screen.getByLabelText(/^Compare with/) as HTMLSelectElement;
    fireEvent.change(year, { target: { value: year.options[1].value } });
    await waitFor(() => expect(mockCalls.festival).toHaveLength(2));
    expect(pendingLine()).not.toBeNull();
    expect(screen.getByTestId("report")).toHaveTextContent("Aradhana vs 2025");
    expect(screen.getByTestId("report-content")).toHaveAttribute("aria-busy", "true");
    expect(skeleton()).toBeNull();
    expectNoLoadingText();

    await answer("festival", { label: "Aradhana vs 2024" });
    expect(screen.getByTestId("report")).toHaveTextContent("Aradhana vs 2024");
    expect(pendingLine()).toBeNull();
  });

  it("audit trail: skeleton rows under the filters first, then the entries stay with the pending line on a new filter", async () => {
    render(<AuditPage />);
    await waitFor(() => expect(mockCalls.audit).toHaveLength(1));
    expect(skeleton()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("radiogroup", { name: /Type/ })).toBeInTheDocument();
    expectNoLoadingText();

    await answer("audit", { rows: [entry(1, "receipt.cancel")], nextCursor: null });
    expect(skeleton()).toBeNull();
    expect(screen.getByText("C1-023-10-2026/000101")).toBeInTheDocument();
    expect(pendingLine()).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Rate changes/ }));
    await waitFor(() => expect(mockCalls.audit).toHaveLength(2));
    expect(pendingLine()).not.toBeNull();
    expect(screen.getByText("C1-023-10-2026/000101")).toBeInTheDocument();
    expect(screen.getByTestId("audit-list")).toHaveAttribute("aria-busy", "true");
    expect(skeleton()).toBeNull();
    expectNoLoadingText();

    await answer("audit", { rows: [entry(2, "seva.rate_change")], nextCursor: null });
    expect(screen.queryByText("C1-023-10-2026/000101")).toBeNull();
    expect(screen.getByText("C1-023-10-2026/000102")).toBeInTheDocument();
    expect(pendingLine()).toBeNull();
  });

  it("board summary: a page skeleton first, then the earlier sheets stay with the pending line for a new range", async () => {
    const { rerender } = render(<BoardSummaryPage />);
    await waitFor(() => expect(mockCalls.collectExportData).toHaveLength(2));
    expect(document.querySelector("[data-page-skeleton]")).toHaveAttribute("aria-busy", "true");
    expect(skeleton()).not.toBeNull();
    expectNoLoadingText();

    await answer("collectExportData", { receipts: [], cancelledChanged: [] }, 0);
    await answer("collectExportData", { receipts: [], cancelledChanged: [] }, 1);
    await answer("sevaSummary", { sevas: [], totals: null, rateChanges: [] });
    await waitFor(() => expect(screen.getByTestId("report")).toHaveTextContent("2026-10-01..2026-10-19"));
    expect(skeleton()).toBeNull();
    expect(pendingLine()).toBeNull();

    mockParams.current = new URLSearchParams("from=2026-09-01&to=2026-09-30");
    rerender(<BoardSummaryPage />);
    await waitFor(() => expect(mockCalls.collectExportData).toHaveLength(4));
    expect(pendingLine()).not.toBeNull();
    expect(screen.getByRole("status", { name: "Preparing the summary..." })).toBe(pendingLine());
    expect(screen.getByTestId("report")).toHaveTextContent("2026-10-01..2026-10-19");
    expect(screen.getByTestId("report-content")).toHaveAttribute("aria-busy", "true");
    expect(skeleton()).toBeNull();

    await answer("collectExportData", { receipts: [], cancelledChanged: [] }, 2);
    await answer("collectExportData", { receipts: [], cancelledChanged: [] }, 3);
    await answer("sevaSummary", { sevas: [], totals: null, rateChanges: [] });
    await waitFor(() => expect(screen.getByTestId("report")).toHaveTextContent("2026-09-01..2026-09-30"));
    expect(pendingLine()).toBeNull();
  });
});
