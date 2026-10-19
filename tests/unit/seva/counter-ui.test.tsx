import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { DevoteeStep } from "@/components/seva/counter/DevoteeStep";
import { OfflineBanner } from "@/components/seva/counter/OfflineBanner";
import { PayStep } from "@/components/seva/counter/PayStep";
import { ReceiptSummary } from "@/components/seva/counter/ReceiptSummary";
import {
  counterReducer,
  indexCatalogue,
  initialCounterState,
  selectCanSave,
  selectGroups,
  type CounterAction,
  type CounterState,
} from "@/lib/seva/counter/state";
import { orderSummaryText } from "@/lib/seva/strings/counter";
import type { CatalogueSeva } from "@/types/seva";

/** Counter screens (plan A4-1): the summary line, the offline strip text and the UPI switch-off. */

const TODAY = "2026-10-18";

function seva(p: Partial<CatalogueSeva> & Pick<CatalogueSeva, "id" | "key" | "nameEn">): CatalogueSeva {
  return {
    code: null,
    nameKn: null,
    ratePaise: 10000,
    multiDate: false,
    allowAmountChange: true,
    prasadamGiven: true,
    prasadamItems: null,
    visibility: "both",
    active: true,
    category: "Pooja",
    incomeLedger: null,
    ...p,
  };
}

const CATALOGUE: CatalogueSeva[] = [
  seva({ id: "seva-pn", key: 1, code: "PN", nameEn: "Panchamrutha Abhisheka", nameKn: "ಪಂಚಾಮೃತ ಅಭಿಷೇಕ", ratePaise: 10500, multiDate: true }),
  seva({ id: "seva-pp", key: 2, code: "PP", nameEn: "Paaduka Pooja", nameKn: "ಪಾದುಕಾ ಪೂಜೆ", ratePaise: 50500 }),
];
const CAT = indexCatalogue(CATALOGUE);
const reduce = counterReducer(CAT, 365);

function run(actions: CounterAction[]): CounterState {
  return actions.reduce(reduce, initialCounterState(TODAY));
}

/** Design Book 9.3: Panchamrutha Rs 105 on 28, 29 and 30 Aug and Paaduka Pooja Rs 505 on 28 Aug - Rs 820. */
function bookExample(): CounterState {
  const s = run([{ type: "setDevotee", patch: { name: "Venkatesh Rao" } }, { type: "addByKey", key: 1 }, { type: "addByKey", key: 2 }]);
  const [pn, pp] = s.lines;
  return [
    { type: "setDates", lineKey: pn.key, dates: ["2027-08-28", "2027-08-29", "2027-08-30"] },
    { type: "setDates", lineKey: pp.key, dates: ["2027-08-28"] },
  ].reduce((acc: CounterState, a) => reduce(acc, a as CounterAction), s);
}

afterEach(cleanup);

describe("counter screens", () => {
  it("summarises a group in one line", () => {
    const s = bookExample();
    const groups = selectGroups(s);
    const line = "3 receipts: Sat 28 Aug Rs 610, Sun 29 Aug Rs 105, Mon 30 Aug Rs 105. Total Rs 820.";
    expect(orderSummaryText(groups)).toBe(line);

    render(
      <ReceiptSummary
        devotee={s.devotee}
        groups={groups}
        catalogue={CAT}
        step={2}
        canSave={selectCanSave(s)}
        submitting={false}
        onNext={() => undefined}
        onSave={() => undefined}
      />,
    );
    expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.getByText("Venkatesh Rao")).toBeInTheDocument();
    // One card per receipt date, the seva names with Kannada under them.
    expect(screen.getAllByText("Panchamrutha Abhisheka")).toHaveLength(3);
    expect(screen.getAllByText("ಪಾದುಕಾ ಪೂಜೆ")).toHaveLength(1);
  });

  it("shows the offline strip text with the waiting count", () => {
    // 04:42 UTC is 10:12 AM in IST.
    render(<OfflineBanner since="2026-10-18T04:42:00.000Z" waiting={3} series="OF1" />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(
      /Working offline since 10:12 AM\. Receipts still save and print, cash and UPI\..*OF1.*3 are waiting\. They send themselves when the line is back\./,
    );

    cleanup();
    render(<OfflineBanner since="2026-10-18T04:42:00.000Z" waiting={1} series="OF1" />);
    expect(screen.getByRole("status")).toHaveTextContent(/1 is waiting\./);
  });

  it("disables UPI with a reason when the counter has no UPI id", () => {
    const s = bookExample();
    render(
      <PayStep
        totalPaise={82000}
        receiptCount={3}
        payment={s.payment}
        onPayment={() => undefined}
        upi={null}
        upiDisabledReason="not_configured"
        upiNote="Seva receipt"
        largeCash={{ required: false, confirmed: false, onConfirm: () => undefined }}
      />,
    );
    expect(screen.getByRole("radio", { name: /UPI/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Cash/ })).toBeEnabled();
    expect(screen.getByText(/UPI is not set up for this counter/)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /QR/ })).not.toBeInTheDocument();
  });

  it("shows the UPI QR, the last six digits and the tick when UPI is set up", () => {
    const s = reduce(bookExample(), { type: "setPayment", patch: { mode: "upi" } });
    render(
      <PayStep
        totalPaise={82000}
        receiptCount={3}
        payment={s.payment}
        onPayment={() => undefined}
        upi={{ vpa: "temple@upi", payeeName: "Temple" }}
        upiDisabledReason={null}
        upiNote="Seva receipt"
        largeCash={{ required: false, confirmed: false, onConfirm: () => undefined }}
      />,
    );
    expect(screen.getByRole("radio", { name: /UPI/ })).toBeEnabled();
    expect(screen.getByLabelText(/last 6 digits/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /I saw the payment succeed/ })).toBeInTheDocument();
    expect(screen.getByText("temple@upi")).toBeInTheDocument();
  });

  it("Save and print shows Saving... before the API answers and blocks a double save", async () => {
    const s = reduce(reduce(bookExample(), { type: "goStep", step: 3 }), { type: "setPayment", patch: { cashReceived: "820" } });
    expect(selectCanSave(s).ok).toBe(true);
    let answer: () => void = () => undefined;
    const office = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const onSave = jest.fn(() => office);
    render(
      <ReceiptSummary
        devotee={s.devotee}
        groups={selectGroups(s)}
        catalogue={CAT}
        step={3}
        canSave={selectCanSave(s)}
        submitting={false}
        onNext={() => undefined}
        onSave={onSave}
      />,
    );
    const save = screen.getByRole("button", { name: /Save and print 3 receipts/ });

    // The office has not answered yet: the button already says so and cannot be pressed again.
    fireEvent.click(save);
    expect(save).toHaveAttribute("aria-busy", "true");
    expect(save).toBeDisabled();
    expect(save).toHaveTextContent(/Saving/);
    expect(save.querySelector("[data-spinner]")).not.toBeNull();
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer();
      await office;
    });
    await waitFor(() => expect(save).not.toHaveAttribute("aria-busy"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows a small spinner in the name field while the returning-devotee search runs", () => {
    const props = {
      devotee: initialCounterState(TODAY).devotee,
      onDevotee: () => undefined,
      nameRef: { current: null },
      onEnterNext: () => undefined,
      suggestion: null,
      onUseSuggestion: () => undefined,
      onRejectSuggestion: () => undefined,
      filledFrom: null,
      onUndo: () => undefined,
    };
    const { rerender } = render(<DevoteeStep {...props} searching={false} />);
    expect(screen.queryByTestId("devotee-searching")).toBeNull();
    rerender(<DevoteeStep {...props} searching />);
    const spinner = screen.getByTestId("devotee-searching");
    expect(spinner).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByLabelText(/Name/)).toHaveAttribute("aria-busy", "true");
  });
});
