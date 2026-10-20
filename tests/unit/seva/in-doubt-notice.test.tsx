import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { InDoubtNotice } from "@/components/seva/counter/InDoubtNotice";
import { COUNTER_TEXT } from "@/lib/seva/strings/counter";

afterEach(cleanup);

describe("InDoubtNotice (H-3)", () => {
  it("shows an open in-doubt order as needing attention, with no way to wave it off", () => {
    render(<InDoubtNotice state="open" onDismiss={() => undefined} />);
    expect(screen.getByRole("alert")).toHaveTextContent(COUNTER_TEXT.inDoubtOrderOpen.en);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("a cleared in-doubt order points at Today's receipts until it is marked checked", () => {
    const onDismiss = jest.fn();
    render(<InDoubtNotice state="cleared" onDismiss={onDismiss} />);
    expect(screen.getByRole("alert")).toHaveTextContent(COUNTER_TEXT.inDoubtOrderCleared.en);
    fireEvent.click(screen.getByRole("button", { name: COUNTER_TEXT.inDoubtOrderDismiss }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
