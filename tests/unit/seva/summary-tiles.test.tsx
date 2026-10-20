import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";

import { SummaryTiles } from "@/components/seva/dashboard/SummaryTiles";
import { changeLabel } from "@/lib/seva/dashboard/format";
import type { DashboardData } from "@/types/seva-reports";

/** Summary tiles (DB §12.1): Total collected, Receipts, Cash, UPI and a quiet Online tile, each against the previous period. */

function tiles(prev: DashboardData["tiles"]["prev"]): DashboardData["tiles"] {
  return { totalPaise: 1120, receipts: 95, cashPaise: 700, upiPaise: 420, onlinePaise: 0, prev };
}

describe("SummaryTiles", () => {
  it("shows change against the previous period or no data", () => {
    expect(changeLabel(1120, 1000)).toBe("+12%");
    expect(changeLabel(95, 100)).toBe("-5%");
    expect(changeLabel(100, 100)).toBe("0%");
    expect(changeLabel(500, 0)).toBe("no data");
    expect(changeLabel(500, null)).toBe("no data");

    const { unmount } = render(
      <SummaryTiles period="today" tiles={tiles({ totalPaise: 1000, receipts: 100, cashPaise: 700, upiPaise: 0, onlinePaise: 0 })} />,
    );
    const total = screen.getByTestId("tile-total");
    expect(total).toHaveTextContent("Total collected");
    expect(total).toHaveTextContent("+12%");
    expect(total).toHaveTextContent("vs yesterday");
    expect(screen.getByTestId("tile-receipts")).toHaveTextContent("-5%");
    expect(screen.getByTestId("tile-cash")).toHaveTextContent("0%");
    // UPI had nothing yesterday: no percentage to show.
    expect(screen.getByTestId("tile-upi")).toHaveTextContent("no data");
    const online = screen.getByTestId("tile-online");
    expect(online).toHaveTextContent("starts in Phase 2");
    unmount();

    render(<SummaryTiles period="year" tiles={tiles(null)} />);
    for (const id of ["tile-total", "tile-receipts", "tile-cash", "tile-upi"]) {
      expect(within(screen.getByTestId(id)).getByText("no data")).toBeInTheDocument();
    }
    expect(screen.queryByText(/[+-]\d+%/)).toBeNull();
  });
});
