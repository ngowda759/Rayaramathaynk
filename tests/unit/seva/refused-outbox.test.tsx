import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { RefusedOutbox } from "@/components/seva/counter/RefusedOutbox";
import type { RefusedItem } from "@/lib/seva/offline/refused";
import { COUNTER_TEXT } from "@/lib/seva/strings/counter";

afterEach(cleanup);

const ITEM: RefusedItem = {
  seq: 2,
  kind: "order",
  code: "number_conflict",
  refusedAt: "2026-10-20T06:00:00.000Z",
  receiptNos: ["OF1-023-10-2026/000002"],
  totalPaise: 10500,
};

describe("RefusedOutbox (M-5)", () => {
  it("shows nothing when the office refused nothing", () => {
    const { container } = render(<RefusedOutbox items={[]} canSetAside onSetAside={async () => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the refused receipt and what to do next; a receptionist cannot set it aside", () => {
    render(<RefusedOutbox items={[ITEM]} canSetAside={false} onSetAside={async () => undefined} />);
    const panel = screen.getByRole("alert", { name: COUNTER_TEXT.refusedTitle.en });
    expect(panel).toHaveTextContent("OF1-023-10-2026/000002");
    expect(panel).toHaveTextContent(COUNTER_TEXT.refusedNext.en);
    expect(screen.queryByRole("button", { name: COUNTER_TEXT.refusedSetAside })).not.toBeInTheDocument();
  });

  it("an admin sets it aside with a reason of at least 3 characters (two emoji are not enough)", async () => {
    const onSetAside = jest.fn(async () => undefined);
    render(<RefusedOutbox items={[ITEM]} canSetAside onSetAside={onSetAside} />);
    fireEvent.click(screen.getByRole("button", { name: COUNTER_TEXT.refusedSetAside }));
    const confirm = screen.getByRole("button", { name: COUNTER_TEXT.refusedConfirm });
    const reason = screen.getByLabelText(COUNTER_TEXT.refusedReasonLabel);

    fireEvent.change(reason, { target: { value: "\u{1F64F}\u{1F64F}" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(reason, { target: { value: " Paper book p.14 " } });
    expect(confirm).toBeEnabled();
    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(onSetAside).toHaveBeenCalledWith(2, "Paper book p.14");
  });
});
