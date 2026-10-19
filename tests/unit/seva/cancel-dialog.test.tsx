import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { CancelDialog, moneyBackLine, type CancelCandidate } from "@/components/seva/today/CancelDialog";
import { cancelledLine, cancelResultLines, rowActions, TodayList, type TodayRow } from "@/components/seva/today/TodayList";
import { connectionStore } from "@/lib/seva/offline/connection";
import { can as matrixCan, type PermissionContext } from "@/lib/seva/permissions";
import { businessDate } from "@/lib/seva/time";
import type { CounterBootstrap, SevaAction, SevaMe } from "@/types/seva";
import type { ReceiptListItem } from "@/types/seva-receipts";

/** 10:42 AM IST on Sun 18 Oct 2026: the receipts below were issued then; the cancel window ends 11:12 AM. */
const ISSUED_AT = "2026-10-18T05:12:00.000Z";
const INSIDE_WINDOW = new Date("2026-10-18T05:20:00.000Z");
const PAST_WINDOW = new Date("2026-10-18T05:50:00.000Z");
const TODAY = "2026-10-18";

const COUNTER_1: CounterBootstrap["counter"] = { id: 1, name: "Counter 1", onlineSeries: "C1", offlineSeries: "OF1" };

function person(role: SevaMe["role"], over: Partial<SevaMe> = {}): SevaMe {
  return {
    staffId: `staff-${role}`,
    staffNo: role === "receptionist" ? 23 : 5,
    name: role === "receptionist" ? "Ramesh" : "Srinivas",
    role,
    viewOnly: false,
    actions: [],
    counter: COUNTER_1,
    ...over,
  };
}

/** The same context facts useSevaMe's can() fills in: the verified PC's counter and today's IST date. */
function canFor(me: SevaMe, now: Date) {
  return (action: SevaAction, ctx?: PermissionContext): boolean =>
    matrixCan(me, action, { ...ctx, counterIdOfDevice: me.counter?.id, todayBusinessDate: businessDate(now) });
}

function row(over: Partial<TodayRow> = {}): TodayRow {
  return {
    key: "r-123",
    id: "00000000-0000-4000-8000-000000000123",
    clientReceiptId: "00000000-0000-4000-8000-000000000923",
    receiptNo: "C1-023-10-2026/000123",
    series: "C1",
    businessDate: TODAY,
    issuedAt: ISSUED_AT,
    sevaDate: TODAY,
    devoteeName: "Lakshmi Narayan",
    sevas: "Paaduka Pooja",
    totalPaise: 50500,
    mode: "cash",
    status: "issued",
    printCount: 1,
    groupNo: "G-2610-0041",
    position: 1,
    count: 1,
    issuedByStaffId: "staff-receptionist",
    issuedByStaffNo: 23,
    refundState: "none",
    waiting: false,
    ...over,
  };
}

function groupOfThree(): CancelCandidate[] {
  const base = { mode: "cash" as const, businessDate: TODAY, devoteeName: "Venkatesh Rao", issuedAt: ISSUED_AT, groupNo: "G-2610-0042" };
  return [
    { ...base, key: "a", receiptNo: "C1-023-10-2026/000124", sevaDate: "2027-08-28", totalPaise: 61000 },
    { ...base, key: "b", receiptNo: "C1-023-10-2026/000125", sevaDate: "2027-08-29", totalPaise: 10500 },
    { ...base, key: "c", receiptNo: "C1-023-10-2026/000126", sevaDate: "2027-08-30", totalPaise: 10500 },
  ];
}

function renderDialog(receipts: CancelCandidate[], onConfirm = jest.fn(), offline = false) {
  render(
    <CancelDialog
      open
      receipts={receipts}
      today={TODAY}
      offline={offline}
      busy={false}
      error={null}
      onConfirm={onConfirm}
      onClose={jest.fn()}
    />,
  );
  return onConfirm;
}

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe("CancelDialog", () => {
  it("offers all receipts of the group or each date alone", () => {
    const onConfirm = renderDialog(groupOfThree());

    const scope = screen.getByRole("group", { name: /What to cancel/ });
    const radios = within(scope).getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(within(scope).getByLabelText("All 3 receipts - Rs 820")).toBeChecked();
    expect(within(scope).getByLabelText("Only 000124, Sat 28 Aug - Rs 610")).toBeInTheDocument();
    expect(within(scope).getByLabelText("Only 000125, Sun 29 Aug - Rs 105")).toBeInTheDocument();
    expect(within(scope).getByLabelText("Only 000126, Mon 30 Aug - Rs 105")).toBeInTheDocument();

    fireEvent.click(within(scope).getByLabelText("Only 000125, Sun 29 Aug - Rs 105"));
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "wrong_date" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel receipts" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [choice] = onConfirm.mock.calls[0] as [{ receipts: CancelCandidate[]; reasonCode: string; note?: string }];
    expect(choice.receipts.map((r) => r.receiptNo)).toEqual(["C1-023-10-2026/000125"]);
    expect(choice.reasonCode).toBe("wrong_date");
  });

  it("lists the eight reasons", () => {
    renderDialog([groupOfThree()[0]]);
    const options = within(screen.getByLabelText(/Reason/)).getAllByRole("option").filter((o) => o.getAttribute("value"));
    expect(options.map((o) => o.textContent)).toEqual([
      "Wrong seva entered",
      "Wrong date",
      "Wrong amount",
      "Wrong devotee details",
      "Devotee changed their mind",
      "Entered twice",
      "Spoiled print (paper jam or misprint)",
      "Other",
    ]);
  });

  it("needs a note when the reason is Other", () => {
    const onConfirm = renderDialog([groupOfThree()[0]]);
    const go = screen.getByRole("button", { name: "Cancel receipt" });
    expect(go).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "other" } });
    expect(go).toBeDisabled();
    const note = screen.getByLabelText(/Say what happened/);
    fireEvent.change(note, { target: { value: "ab" } });
    expect(go).toBeDisabled();
    fireEvent.change(note, { target: { value: "Devotee left before paying" } });
    expect(go).toBeEnabled();

    fireEvent.click(go);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ reasonCode: "other", note: "Devotee left before paying" }),
    );
  });

  it("shows the money-back line for cash and the refund-due line for UPI", () => {
    renderDialog(groupOfThree());
    expect(screen.getByText(/Give back Rs 820 in cash/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Only 000124, Sat 28 Aug - Rs 610"));
    expect(screen.getByText(/Give back Rs 610 in cash/)).toBeInTheDocument();
    cleanup();

    renderDialog(groupOfThree().map((r) => ({ ...r, mode: "upi" as const })));
    expect(screen.getByText("Refund due - the office refunds from the bank app")).toBeInTheDocument();
    expect(screen.queryByText(/Give back/)).not.toBeInTheDocument();
  });

  it("never offers drawer cash for a receipt from an earlier day", () => {
    const line = moneyBackLine([{ ...groupOfThree()[0], businessDate: "2026-10-17" }], { today: TODAY, offline: false });
    expect(line.en).not.toMatch(/Give back/);
    expect(line.en).toMatch(/^Refund due/);
  });
});

describe("Today's receipts rows", () => {
  it("shows the cancel deadline inside the window and the admin note after it", () => {
    const me = person("receptionist");
    const inside = rowActions(row(), { me, can: canFor(me, INSIDE_WINDOW), now: INSIDE_WINDOW, windowMinutes: 30, offline: false });
    expect(inside.cancel).toBe(true);
    expect(inside.note?.en).toBe("Cancel until 11:12 AM");

    const past = rowActions(row(), { me, can: canFor(me, PAST_WINDOW), now: PAST_WINDOW, windowMinutes: 30, offline: false });
    expect(past.cancel).toBe(false);
    expect(past.note?.en).toBe("Past 30 minutes: a temple admin can cancel");

    const admin = person("temple_admin");
    const adminPast = rowActions(row(), { me: admin, can: canFor(admin, PAST_WINDOW), now: PAST_WINDOW, windowMinutes: 30, offline: false });
    expect(adminPast.cancel).toBe(true);
  });

  it("offers Spoiled - cancel and reissue only for today's receipts of this PC's counter", () => {
    const admin = person("temple_admin");
    const ctx = { me: admin, can: canFor(admin, INSIDE_WINDOW), now: INSIDE_WINDOW, windowMinutes: 30, offline: false };
    expect(rowActions(row(), ctx).spoiled).toBe(true);
    expect(rowActions(row({ series: "OF1", receiptNo: "OF1-023-10-2026/000007" }), ctx).spoiled).toBe(true);
    // Another counter's receipt: the server refuses it (validation), so the option is not shown; reprint still is.
    const other = rowActions(row({ series: "C2", receiptNo: "C2-031-10-2026/000050" }), ctx);
    expect(other.spoiled).toBe(false);
    expect(other.cancel).toBe(true);
    // An earlier day's slip gets a DUPLICATE reprint instead (reissue_only_today).
    expect(rowActions(row({ businessDate: "2026-10-17", issuedAt: "2026-10-17T05:12:00.000Z" }), ctx).spoiled).toBe(false);
    // No registered PC: no counter to reissue on.
    const office = person("temple_admin", { counter: null });
    expect(rowActions(row(), { ...ctx, me: office, can: canFor(office, INSIDE_WINDOW) }).spoiled).toBe(false);
    // Cancelled receipts: nothing to reprint or reissue.
    const cancelled = rowActions(row({ status: "cancelled" }), ctx);
    expect(cancelled).toEqual(expect.objectContaining({ cancel: false, reprint: false, spoiled: false }));
  });

  it("offline, offers the cancel only for the person's own receipts inside the window", () => {
    const me = person("receptionist");
    const base = { me, can: canFor(me, INSIDE_WINDOW), now: INSIDE_WINDOW, windowMinutes: 30, offline: true };
    expect(rowActions(row({ issuedByStaffId: null }), base)).toEqual(expect.objectContaining({ cancel: true, reprint: false, spoiled: false }));
    expect(rowActions(row({ issuedByStaffId: null, issuedByStaffNo: 31 }), base).cancel).toBe(false);
    expect(rowActions(row(), { ...base, now: PAST_WINDOW, can: canFor(me, PAST_WINDOW) }).cancel).toBe(false);
    const admin = person("temple_admin");
    expect(rowActions(row({ issuedByStaffNo: 23, issuedByStaffId: null }), { ...base, me: admin, can: canFor(admin, INSIDE_WINDOW) }).cancel).toBe(false);
  });

  it("shows the refund-due line for a cash cancel the office left due (late offline sync or closed day)", () => {
    const due = cancelledLine(row({ status: "cancelled", refundState: "due" }));
    expect(due?.en).toMatch(/^Refund due/);
    expect(due?.en).not.toMatch(/Give back|given back/i);
    expect(cancelledLine(row({ status: "cancelled", refundState: "done" }))?.en).toMatch(/given back/i);
    expect(cancelledLine(row({ status: "cancelled", mode: "upi", refundState: "due" }))?.en).toBe(
      "Refund due - the office refunds from the bank app",
    );

    const lines = cancelResultLines([
      { mode: "cash", totalPaise: 50500, refundState: "done" },
      { mode: "cash", totalPaise: 10500, refundState: "due" },
    ]).map((l) => l.en);
    expect(lines.some((l) => l.startsWith("Give back Rs 505 in cash"))).toBe(true);
    expect(lines.some((l) => l.startsWith("Refund due"))).toBe(true);
    expect(cancelResultLines([{ mode: "cash", totalPaise: 50500, refundState: "due" }]).map((l) => l.en).join(" ")).not.toMatch(
      /Give back/,
    );
  });
});

describe("TodayList", () => {
  const ITEM: ReceiptListItem = {
    id: "00000000-0000-4000-8000-000000000123",
    receiptNo: "C1-023-10-2026/000123",
    series: "C1",
    businessDate: TODAY,
    issuedAt: ISSUED_AT,
    devoteeName: "Lakshmi Narayan",
    sevas: "Paaduka Pooja",
    totalPaise: 50500,
    mode: "cash",
    status: "issued",
    changed: false,
    printCount: 1,
    prasadam: "none",
    groupNo: "G-2610-0041",
    position: 1,
    count: 1,
    issuedByStaffId: "staff-receptionist",
    cancelDeadline: "2026-10-18T05:42:00.000Z",
    refundState: "none",
  };

  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  it("sends a receptionist's cancel with this PC's device header and says to give the cash back", async () => {
    const calls: { path: string; method: string; headers: Record<string, string> }[] = [];
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ path, method: init?.method ?? "GET", headers });
      if (path.startsWith("/api/seva/receipts/cancel")) {
        return json({ receipts: [{ ...ITEM, status: "cancelled", cancelDeadline: null, refundState: "done" }] });
      }
      if (path.startsWith("/api/seva/receipts")) return json({ rows: [ITEM], nextCursor: null });
      return json({ error: { code: "not_found", message: "Not found" } }, 404);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    act(() => connectionStore.markOnline());

    const me = person("receptionist");
    render(
      <TodayList
        me={me}
        can={canFor(me, INSIDE_WINDOW)}
        token={async () => "id-token"}
        deviceHeader="device-1.secret"
        db={null}
        now={() => INSIDE_WINDOW}
      />,
    );

    expect(await screen.findByText("Lakshmi Narayan")).toBeInTheDocument();
    expect(screen.getByText("Cancel until 11:12 AM")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.change(await screen.findByLabelText(/Reason/), { target: { value: "wrong_seva" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel receipt" }));

    await waitFor(() => expect(calls.some((c) => c.path === "/api/seva/receipts/cancel")).toBe(true));
    const cancel = calls.find((c) => c.path === "/api/seva/receipts/cancel");
    expect(cancel?.method).toBe("POST");
    expect(cancel?.headers["x-seva-device"]).toBe("device-1.secret");
    expect(cancel?.headers.Authorization).toBe("Bearer id-token");
    expect(await screen.findByText(/Give back Rs 505 in cash/)).toBeInTheDocument();
  });
});
