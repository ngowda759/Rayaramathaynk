import { act, fireEvent, render, screen, within } from "@testing-library/react";

import { ContinuityCard } from "@/components/seva/register/ContinuityCard";
import { GapResolveDialog } from "@/components/seva/register/GapResolveDialog";
import { PaperReceiptDialog } from "@/components/seva/register/PaperReceiptDialog";
import type { PaperReceiptRequest } from "@/lib/seva/schemas";
import type { CatalogueSeva } from "@/types/seva";
import type { ContinuityGap, ContinuityRow } from "@/types/seva-reports";

/** A5-FIX M-6: a gap's slips are entered from the paper book, one by one; "declared lost" stays for the rest. */

jest.mock("react-hot-toast", () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));

const GAP: ContinuityGap = { id: 7, series: "OF1", year: 2026, fromNo: 5, toNo: 7, cause: "device_replaced", detectedAt: "2026-10-18T06:00:00.000Z" };

function seva(over: Partial<CatalogueSeva>): CatalogueSeva {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    code: "PAN",
    key: 1,
    nameEn: "Panchamrutha Abhisheka",
    nameKn: null,
    ratePaise: 10500,
    multiDate: false,
    allowAmountChange: true,
    prasadamGiven: true,
    prasadamItems: null,
    visibility: "both",
    active: true,
    category: "Seva",
    incomeLedger: null,
    ...over,
  };
}

const PAN = seva({});
const KARNIKE = seva({ id: "22222222-2222-4222-8222-222222222222", code: "KAR", key: 2, nameEn: "Karnike", ratePaise: null });

function setup() {
  const enter = jest.fn<Promise<{ gapStatus: "open" | "entered_from_paper" }>, [number, PaperReceiptRequest]>();
  enter.mockResolvedValue({ gapStatus: "open" });
  const onEntered = jest.fn();
  const onClose = jest.fn();
  render(<PaperReceiptDialog gap={GAP} sevas={[PAN, KARNIKE]} today="2026-10-20" enter={enter} onEntered={onEntered} onClose={onClose} />);
  return { enter, onEntered, onClose };
}

function type(label: RegExp, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function save(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Enter receipt" }) as HTMLButtonElement;
}

function fillSlip(): void {
  type(/Receipt number as printed/, " OF1-023-10-2026/000006 ");
  type(/Date on the slip/, "2026-10-18");
  type(/Seva date/, "2026-10-19");
  type(/^Name/, "Lakshmi Narayan");
  fireEvent.change(screen.getByLabelText(/^Seva 1$/), { target: { value: PAN.id } });
  type(/Total on the slip/, "105");
  fireEvent.click(screen.getByLabelText(/^Cash/));
  type(/Where the slip was found/, "Paper book page 12");
}

describe("PaperReceiptDialog", () => {
  it("enters one slip as printed and reports whether the gap is still open", async () => {
    const { enter, onEntered } = setup();
    expect(screen.getByRole("heading", { name: /Enter OF1 numbers 000005 - 000007 from the paper book/ })).toBeTruthy();
    expect(save().disabled).toBe(true);

    fillSlip();
    expect(save().disabled).toBe(false);
    await act(async () => {
      fireEvent.click(save());
    });
    expect(enter).toHaveBeenCalledWith(7, {
      receiptNo: "OF1-023-10-2026/000006",
      issuedOn: "2026-10-18",
      sevaDate: "2026-10-19",
      devotee: { name: "Lakshmi Narayan" },
      lines: [{ sevaId: PAN.id, quantity: 1 }],
      totalPaise: 10500,
      payment: { mode: "cash" },
      note: "Paper book page 12",
    });
    expect(onEntered).toHaveBeenCalledWith("open");
  });

  it("an any-amount seva needs the printed amount; UPI needs the last 6 digits; a typed rate is sent in paise", async () => {
    const { enter } = setup();
    fillSlip();
    fireEvent.change(screen.getByLabelText(/^Seva 1$/), { target: { value: KARNIKE.id } });
    expect(screen.getByText("Type the amount: this seva has no fixed rate")).toBeTruthy();
    expect(save().disabled).toBe(true);
    type(/Amount each/, "250.50");
    type(/Quantity/, "2");
    type(/Total on the slip/, "501");
    fireEvent.click(screen.getByLabelText(/^UPI/));
    expect(save().disabled).toBe(true);
    type(/Last 6 digits/, "550912");
    expect(save().disabled).toBe(false);
    await act(async () => {
      fireEvent.click(save());
    });
    expect(enter).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        lines: [{ sevaId: KARNIKE.id, quantity: 2, unitRatePaise: 25050 }],
        totalPaise: 50100,
        payment: { mode: "upi", upiRefLast6: "550912" },
      }),
    );
  });

  it("refuses a number that is not printed form and shows the office's refusal", async () => {
    const { enter, onEntered } = setup();
    fillSlip();
    type(/Receipt number as printed/, "OF1 6");
    expect(save().disabled).toBe(true);
    type(/Receipt number as printed/, "OF1-023-10-2026/000009");
    enter.mockRejectedValueOnce(new Error("This number is not inside the gap."));
    await act(async () => {
      fireEvent.click(save());
    });
    expect(screen.getByRole("alert").textContent).toBe("This number is not inside the gap.");
    expect(onEntered).not.toHaveBeenCalled();
  });
});

describe("ContinuityCard and GapResolveDialog after M-6", () => {
  const ROW: ContinuityRow = {
    series: "OF1",
    year: 2026,
    counterName: "Counter 1",
    firstNo: "OF1-023-10-2026/000001",
    lastNo: "OF1-023-10-2026/000009",
    numbers: 9,
    issued: 6,
    cancelled: 0,
    openGaps: 1,
    gaps: [GAP],
  };

  it("offers Enter from paper book beside Resolve to people who may resolve gaps", () => {
    const onEnterPaper = jest.fn();
    const { rerender } = render(
      <ContinuityCard rows={[ROW]} rangeLabel="today" canResolve onResolve={jest.fn()} onEnterPaper={onEnterPaper} />,
    );
    fireEvent.click(within(screen.getByTestId("continuity-OF1")).getByRole("button", { name: "Enter numbers 000005 - 000007 from the paper book" }));
    expect(onEnterPaper).toHaveBeenCalledWith(GAP);

    rerender(<ContinuityCard rows={[ROW]} rangeLabel="today" canResolve={false} onResolve={jest.fn()} onEnterPaper={onEnterPaper} />);
    expect(screen.queryByRole("button", { name: /paper book/ })).toBeNull();
  });

  it("the resolve dialog offers only Declared lost and points to the paper entry", () => {
    const onConfirm = jest.fn();
    render(<GapResolveDialog gap={GAP} busy={false} error={null} onConfirm={onConfirm} onClose={jest.fn()} />);
    expect(screen.queryByLabelText(/Entered from the paper book/)).toBeNull();
    expect(screen.getByText(/use "Enter from paper book" for each slip/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Declared lost/));
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: "Book lost in the rain" } });
    fireEvent.click(screen.getByRole("button", { name: "Resolve gap" }));
    expect(onConfirm).toHaveBeenCalledWith({ status: "declared_lost", note: "Book lost in the rain" });
  });
});
