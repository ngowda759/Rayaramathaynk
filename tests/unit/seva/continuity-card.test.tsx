import { fireEvent, render, screen, within } from "@testing-library/react";

import { ContinuityCard, continuityLine, continuityState } from "@/components/seva/register/ContinuityCard";
import type { ContinuityRow } from "@/types/seva-reports";

/** Number continuity card of the receipts register (DB §12.3, §8.5): one line per series, open gaps are critical. */

const CONTINUOUS: ContinuityRow = {
  series: "C1",
  year: 2026,
  counterName: "Counter 1",
  firstNo: "C1-023-10-2026/000101",
  lastNo: "C1-023-10-2026/000227",
  numbers: 127,
  issued: 125,
  cancelled: 2,
  openGaps: 0,
};

const WITH_GAP: ContinuityRow = {
  series: "OF1",
  year: 2026,
  counterName: "Counter 1",
  firstNo: "OF1-023-10-2026/000001",
  lastNo: "OF1-023-10-2026/000009",
  numbers: 9,
  issued: 6,
  cancelled: 0,
  openGaps: 1,
  gaps: [
    { id: 7, series: "OF1", year: 2026, fromNo: 7, toNo: 9, cause: "device_replaced", detectedAt: "2026-10-18T06:00:00.000Z" },
  ],
};

describe("ContinuityCard", () => {
  it("writes the continuity line for a continuous series and flags an open gap", () => {
    expect(continuityLine(CONTINUOUS)).toBe(
      "C1 Counter 1 online, C1-023-10-2026/000101 - 000227, 127 numbers, 125 issued, 2 cancelled, Continuous",
    );
    expect(continuityState(CONTINUOUS)).toBe("continuous");
    expect(continuityState(WITH_GAP)).toBe("open_gap");
    expect(continuityLine(WITH_GAP)).toBe(
      "OF1 Counter 1 offline, OF1-023-10-2026/000001 - 000009, 9 numbers, 6 issued, 0 cancelled, 1 open gap",
    );

    const onResolve = jest.fn();
    render(<ContinuityCard rows={[CONTINUOUS, WITH_GAP]} rangeLabel="today" canResolve onResolve={onResolve} />);

    const c1 = screen.getByTestId("continuity-C1");
    expect(c1.textContent).toContain("C1-023-10-2026/000101 - 000227");
    expect(within(c1).getByText("Continuous").closest("[data-tone]")?.getAttribute("data-tone")).toBe("ok");
    expect(within(c1).queryByRole("button", { name: /Resolve/ })).toBeNull();

    const of1 = screen.getByTestId("continuity-OF1");
    expect(within(of1).getByText("1 open gap").closest("[data-tone]")?.getAttribute("data-tone")).toBe("critical");
    expect(of1.textContent).toContain("000007 - 000009");
    fireEvent.click(within(of1).getByRole("button", { name: /Resolve/ }));
    expect(onResolve).toHaveBeenCalledWith(WITH_GAP.gaps?.[0]);

    // The card's own badge says something is wrong; W is always listed and starts in Phase 2.
    expect(screen.getByTestId("continuity-summary").getAttribute("data-tone")).toBe("critical");
    expect(screen.getByTestId("continuity-W").textContent).toContain("starts in Phase 2");
  });

  it("hides Resolve from people who may not resolve gaps and says so when every series is continuous", () => {
    const { rerender } = render(
      <ContinuityCard rows={[CONTINUOUS, WITH_GAP]} rangeLabel="today" canResolve={false} onResolve={jest.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /Resolve/ })).toBeNull();
    expect(screen.getByText(/a temple admin resolves it/i)).toBeTruthy();

    rerender(<ContinuityCard rows={[CONTINUOUS]} rangeLabel="today" canResolve onResolve={jest.fn()} />);
    expect(screen.getByTestId("continuity-summary").textContent).toContain("No gaps in any series");
    expect(screen.getByTestId("continuity-summary").getAttribute("data-tone")).toBe("ok");
  });

  it("flags numbers missing from the register even when no gap is recorded", () => {
    const missing: ContinuityRow = { ...CONTINUOUS, issued: 120, cancelled: 2 };
    expect(continuityState(missing)).toBe("missing");
    expect(continuityLine(missing)).toBe(
      "C1 Counter 1 online, C1-023-10-2026/000101 - 000227, 127 numbers, 120 issued, 2 cancelled, 5 numbers not in the register",
    );
  });

  it("keeps the full last number when its month or staff part differs from the first", () => {
    const acrossMonths: ContinuityRow = { ...CONTINUOUS, lastNo: "C1-031-11-2026/000227" };
    expect(continuityLine(acrossMonths)).toContain("C1-023-10-2026/000101 - C1-031-11-2026/000227");
  });

  it("says when a series has no receipts in the range", () => {
    const empty: ContinuityRow = { ...WITH_GAP, firstNo: null, lastNo: null, numbers: 0, issued: 0 };
    expect(continuityLine(empty)).toBe("OF1 Counter 1 offline, no receipts in this range, 1 open gap");
  });
});
