import { act, fireEvent, render, screen } from "@testing-library/react";

import { ReceiptDrawer } from "@/components/seva/register/ReceiptDrawer";
import { MarkRefundedButton } from "@/components/seva/today/MarkRefundedButton";
import type { RefundSettleRequest } from "@/lib/seva/schemas";
import type { ReceiptDetail, ReceiptListItem } from "@/types/seva-receipts";

/** A5-FIX M-3: "Mark refunded" on a refund-due receipt, for people who may cancel any receipt. */

jest.mock("react-hot-toast", () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));

const DUE = { id: "11111111-1111-4111-8111-111111111111", receiptNo: "C1-023-10-2026/000124", totalPaise: 10500, refundState: "due" as const };

function setup(over: Partial<{ allowed: boolean; receipt: typeof DUE | { id: string | null; receiptNo: string; totalPaise: number; refundState: "none" | "done" | null } }> = {}) {
  const settle = jest.fn<Promise<unknown>, [RefundSettleRequest]>().mockResolvedValue({ receipts: [] });
  const onDone = jest.fn();
  render(<MarkRefundedButton receipt={over.receipt ?? DUE} allowed={over.allowed ?? true} settle={settle} onDone={onDone} />);
  return { settle, onDone };
}

describe("MarkRefundedButton", () => {
  it("shows nothing unless the refund is due, the office knows the receipt and the person may settle it", () => {
    const { unmount } = render(
      <MarkRefundedButton receipt={DUE} allowed={false} settle={jest.fn()} onDone={jest.fn()} />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    unmount();
    for (const receipt of [
      { ...DUE, refundState: "done" as const },
      { ...DUE, refundState: "none" as const },
      { ...DUE, refundState: null },
      { ...DUE, id: null },
    ]) {
      const view = render(<MarkRefundedButton receipt={receipt} allowed settle={jest.fn()} onDone={jest.fn()} />);
      expect(screen.queryByRole("button")).toBeNull();
      view.unmount();
    }
  });

  it("asks for the mode, a reference unless cash, and a note, then settles the one receipt", async () => {
    const { settle, onDone } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Mark C1-023-10-2026/000124 as refunded" }));
    expect(screen.getByText("Amount to pay back: Rs 105")).toBeTruthy();

    const save = () => screen.getByRole("button", { name: "Mark refunded" });
    expect((save() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText(/^UPI/));
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: "Paid back from the bank app" } });
    expect((save() as HTMLButtonElement).disabled).toBe(true); // no reference yet
    fireEvent.change(screen.getByLabelText(/reference/i), { target: { value: " UTR 6021 " } });
    expect((save() as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      fireEvent.click(save());
    });
    expect(settle).toHaveBeenCalledWith({
      receiptIds: [DUE.id],
      mode: "upi",
      reference: "UTR 6021",
      note: "Paid back from the bank app",
    });
    expect(onDone).toHaveBeenCalled();
  });

  it("a cash refund needs no reference; a refusal is shown and nothing closes", async () => {
    const { settle, onDone } = setup();
    settle.mockRejectedValueOnce(new Error("This receipt's refund is not due."));
    fireEvent.click(screen.getByRole("button", { name: /as refunded/ }));
    fireEvent.click(screen.getByLabelText(/^Cash at the office/));
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: "Handed over" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark refunded" }));
    });
    expect(settle).toHaveBeenCalledWith({ receiptIds: [DUE.id], mode: "cash", note: "Handed over" });
    expect(screen.getByRole("alert").textContent).toBe("This receipt's refund is not due.");
    expect(onDone).not.toHaveBeenCalled();
  });
});

const ROW: ReceiptListItem = {
  id: DUE.id,
  receiptNo: DUE.receiptNo,
  series: "C1",
  businessDate: "2026-10-18",
  issuedAt: "2026-10-18T05:30:00Z",
  devoteeName: "Venkatesh Rao",
  sevas: "Panchamrutha Abhisheka",
  totalPaise: 10500,
  mode: "upi",
  status: "cancelled",
  changed: false,
  printCount: 1,
  prasadam: "none",
  groupNo: "G-2610-0042",
  position: 1,
  count: 1,
  issuedByStaffId: null,
  cancelDeadline: null,
  refundState: "due",
};

function detail(refundState: ReceiptDetail["refundState"]): ReceiptDetail {
  return {
    id: DUE.id,
    clientReceiptId: "c1",
    receiptNo: DUE.receiptNo,
    seriesCode: "C1",
    sevaDate: "2026-10-18",
    groupNo: "G-2610-0042",
    position: 1,
    count: 1,
    orderTotalPaise: 10500,
    totalPaise: 10500,
    lines: [],
    payment: { mode: "upi", upiRefLast6: "119042" },
    devotee: { name: "Venkatesh Rao" },
    qrToken: "AbCdEfGhIjKlMnOpQrStUv",
    issuedAt: "2026-10-18T05:30:00Z",
    issuedBy: { name: "Ramesh", staffNo: 23 },
    counterName: "Counter 1",
    channel: "counter",
    issuedOffline: false,
    status: "cancelled",
    printCount: 1,
    prasadam: "none",
    history: [],
    cancel: { at: "2026-10-18T05:40:00Z", by: "Temple Admin", reasonCode: "changed_mind", note: null },
    refundState,
  } as unknown as ReceiptDetail;
}

describe("ReceiptDrawer refund action (A5-FIX M-3)", () => {
  it("shows Refund due with Mark refunded; after settling it reads the receipt again and tells the register", async () => {
    const load = jest.fn<Promise<ReceiptDetail>, [string]>().mockResolvedValueOnce(detail("due")).mockResolvedValueOnce(detail("done"));
    const settle = jest.fn<Promise<unknown>, [RefundSettleRequest]>().mockResolvedValue({ receipts: [] });
    const onSettled = jest.fn();
    render(<ReceiptDrawer row={ROW} today="2026-10-18" load={load} onClose={() => undefined} refunds={{ allowed: true, settle, onSettled }} />);

    expect((await screen.findByTestId("drawer-refund")).textContent).toContain("Refund due");
    fireEvent.click(screen.getByRole("button", { name: `Mark ${DUE.receiptNo} as refunded` }));
    fireEvent.click(screen.getByLabelText(/^Bank transfer/));
    fireEvent.change(screen.getByLabelText(/reference/i), { target: { value: "NEFT 77120" } });
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: "Sent to the devotee's account" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark refunded" }));
    });

    expect(settle).toHaveBeenCalledWith({ receiptIds: [DUE.id], mode: "bank_transfer", reference: "NEFT 77120", note: "Sent to the devotee's account" });
    expect(onSettled).toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(2);
    expect((await screen.findByTestId("drawer-refund")).textContent).toContain("Refunded");
    expect(screen.queryByRole("button", { name: /as refunded/ })).toBeNull();
  });

  it("a view-only person sees the state but no action", async () => {
    render(
      <ReceiptDrawer
        row={ROW}
        today="2026-10-18"
        load={() => Promise.resolve(detail("due"))}
        onClose={() => undefined}
        refunds={{ allowed: false, settle: jest.fn(), onSettled: jest.fn() }}
      />,
    );
    expect((await screen.findByTestId("drawer-refund")).textContent).toContain("Refund due");
    expect(screen.queryByRole("button", { name: /as refunded/ })).toBeNull();
  });
});
