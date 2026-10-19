import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import ReceiptsDashboardPage from "@/app/admin/receipts/page";
import type { Period } from "@/lib/seva/time";
import type { DashboardData, NeedsAttentionCard } from "@/types/seva-reports";

/**
 * Dashboard period switch (plan A4P-3): while the next period's answer loads, the previous tiles stay on screen,
 * dimmed and marked pending, with a small spinner beside the switch. Never a blank dashboard.
 */

type Answer = { data: DashboardData; attention: NeedsAttentionCard[] };

const mockUser = { getIdToken: async (): Promise<string> => "token" };
const mockMe = { role: "temple_admin" };
const mockNav = { search: new URLSearchParams(""), replace: jest.fn() };
const mockCalls: { period: Period; resolve(a: Answer): void }[] = [];
const mockApi = {
  dashboard: jest.fn(
    (period: Period) =>
      new Promise<Answer>((resolve) => {
        mockCalls.push({ period, resolve });
      }),
  ),
};

jest.mock("@/components/seva/shell/SevaGate", () => ({
  SevaGate: ({ children }: { children: unknown }) => children,
}));
jest.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("@/hooks/seva/useSevaMe", () => ({ useSevaMe: () => ({ me: mockMe, can: () => true }) }));
jest.mock("@/services/seva/reports.service", () => ({ reportsApi: () => mockApi }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockNav.replace, push: jest.fn() }),
  useSearchParams: () => mockNav.search,
  usePathname: () => "/admin/receipts",
}));
// The charts draw with ECharts in a browser; here a marker shows they stay mounted.
jest.mock("@/components/seva/dashboard/HeroChart", () => ({ HeroChart: () => <div data-testid="hero-chart" /> }));
jest.mock("@/components/seva/dashboard/DetailCharts", () => ({ DetailCharts: () => <div data-testid="detail-charts" /> }));

function answer(period: Period, totalPaise: number, receipts: number): Answer {
  return {
    data: {
      period,
      asOf: "2026-10-19T05:30:00.000Z",
      tiles: { totalPaise, receipts, cashPaise: totalPaise, upiPaise: 0, onlinePaise: 0, prev: null },
      hero: { buckets: [], prev: [] },
      topSevas: [],
      mode: { cashPaise: totalPaise, upiPaise: 0, onlinePaise: 0 },
      rush: [],
      calendar: [],
      festivalDates: [],
    },
    attention: [{ id: "changed_amounts", level: "attention", count: 2, detail: {} }],
  };
}

async function answerLast(a: Answer): Promise<void> {
  await waitFor(() => expect(mockCalls.length).toBeGreaterThan(0));
  await act(async () => {
    mockCalls[mockCalls.length - 1].resolve(a);
  });
}

beforeEach(() => {
  mockCalls.length = 0;
  mockApi.dashboard.mockClear();
  mockNav.replace.mockReset();
  mockNav.search = new URLSearchParams("");
});

afterEach(cleanup);

describe("dashboard period switch", () => {
  it("switching the period keeps the previous tiles visible and marks them pending", async () => {
    render(<ReceiptsDashboardPage />);

    // First load: the outline of the dashboard, not a line of text.
    expect(document.querySelector("[data-page-skeleton]")).not.toBeNull();
    await answerLast(answer("today", 6_119_600, 125));
    await waitFor(() => expect(screen.getByTestId("tile-total")).toHaveTextContent("Rs 61,196"));
    const content = screen.getByTestId("dashboard-content");
    expect(content).toHaveAttribute("data-pending", "false");
    expect(screen.queryByTestId("period-pending")).toBeNull();

    // Pick This week: the switch moves at once; the old tiles and charts stay, dimmed and marked pending.
    fireEvent.click(screen.getAllByRole("radio", { name: /week/i })[0]);
    expect(screen.getAllByRole("radio", { name: /week/i })[0]).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(mockCalls.at(-1)?.period).toBe("week"));
    expect(screen.getByTestId("tile-total")).toHaveTextContent("Rs 61,196");
    expect(screen.getByTestId("hero-chart")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-content")).toHaveAttribute("data-pending", "true");
    expect(screen.getByTestId("dashboard-content")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("period-pending")).toHaveAccessibleName("Updating...");
    expect(document.querySelector("[data-page-skeleton]")).toBeNull();

    // The week's answer arrives: new numbers, no longer pending.
    await answerLast(answer("week", 38_412_000, 811));
    await waitFor(() => expect(screen.getByTestId("tile-total")).toHaveTextContent("Rs 3,84,120"));
    expect(screen.getByTestId("tile-receipts")).toHaveTextContent("811");
    await waitFor(() => expect(screen.getByTestId("dashboard-content")).toHaveAttribute("data-pending", "false"));
    expect(screen.queryByTestId("period-pending")).toBeNull();
    expect(mockNav.replace).toHaveBeenCalledWith("/admin/receipts?period=week", { scroll: false });
  });
});
