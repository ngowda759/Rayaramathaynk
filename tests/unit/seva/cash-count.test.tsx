import { fireEvent, render, screen } from "@testing-library/react";
import { useState, type JSX } from "react";

import { CashCount, cashDifference, countedPaise, denominationKey } from "@/components/seva/dayclose/CashCount";
import type { DayClosePrep } from "@/types/seva-dayclose";

/** Close day, step 1 and 2 (DB §9.10): count by denomination, compare with the expected cash, a difference needs a note. */

const DENOMINATIONS: DayClosePrep["denominations"] = [
  { kind: "note", valuePaise: 50_000 },
  { kind: "note", valuePaise: 1_000 },
  { kind: "coin", valuePaise: 1_000 },
  { kind: "coin", valuePaise: 100 },
];

function Harness({ expectedPaise }: { expectedPaise: number }): JSX.Element {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  return (
    <CashCount
      denominations={DENOMINATIONS}
      expectedPaise={expectedPaise}
      counts={counts}
      onCountChange={(key, value) => setCounts((c) => ({ ...c, [key]: value }))}
      note={note}
      onNoteChange={setNote}
      canManageDenominations={false}
    />
  );
}

function typeCount(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("CashCount", () => {
  it("adds up notes and coins by value", () => {
    render(<Harness expectedPaise={152_000} />);

    // Coins are listed by value, separately from notes of the same value.
    expect(screen.getByLabelText("Count of Rs 10 notes")).toBeTruthy();
    expect(screen.getByLabelText("Count of Rs 10 coins")).toBeTruthy();

    typeCount("Count of Rs 500 notes", "3");
    typeCount("Count of Rs 10 coins", "2");

    expect(screen.getByTestId("dc-counted").textContent).toBe("Rs 1,520");
    expect(screen.getByTestId("dc-row-note:50000").textContent).toBe("Rs 1,500");
    expect(screen.getByTestId("dc-row-coin:1000").textContent).toBe("Rs 20");
    expect(screen.getByTestId("dc-cash-diff").textContent).toContain("Matches");

    // The same sums as pure helpers, for the page.
    const counts = { [denominationKey("note", 50_000)]: "3", [denominationKey("coin", 1_000)]: "2", bogus: "9" };
    expect(countedPaise(DENOMINATIONS, counts)).toBe(152_000);
  });

  it("shows short or extra against the expected cash and needs a note", () => {
    render(<Harness expectedPaise={160_000} />);

    typeCount("Count of Rs 500 notes", "3");
    typeCount("Count of Rs 10 coins", "2");
    expect(screen.getByTestId("dc-cash-diff").textContent).toContain("Short Rs 80");
    expect(screen.getByText("Write a note about the difference before closing.")).toBeTruthy();
    const note = screen.getByLabelText(/Note about the difference/);
    expect(note.getAttribute("aria-invalid")).toBe("true");

    typeCount("Count of Rs 10 coins", "12");
    expect(screen.getByTestId("dc-cash-diff").textContent).toContain("Extra Rs 20");

    fireEvent.change(note, { target: { value: "Rs 20 found under the tray" } });
    expect(screen.queryByText("Write a note about the difference before closing.")).toBeNull();
    expect(note.getAttribute("aria-invalid")).toBeNull();

    expect(cashDifference(152_000, 160_000)).toEqual({ kind: "short", paise: 8_000 });
    expect(cashDifference(162_000, 160_000)).toEqual({ kind: "extra", paise: 2_000 });
    expect(cashDifference(160_000, 160_000)).toEqual({ kind: "balanced", paise: 0 });
  });
});
