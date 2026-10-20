import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CounterOfflineClose, counterNotSeen } from "@/components/seva/dayclose/CounterOfflineClose";
import { DAYCLOSE_OFFLINE } from "@/lib/seva/strings/dayclose";
import { SevaClientError } from "@/services/seva/http";

afterEach(cleanup);

/**
 * A5-FIX F5-3: Close day refused with outbox_not_empty / counter_not_seen. Everyone sees what it means; a temple admin
 * (not view-only) gets "Close anyway" with a required reason; a receptionist sees the message only.
 */
function renderIt(over: Partial<Parameters<typeof CounterOfflineClose>[0]> = {}) {
  const onCloseAnyway = jest.fn(async () => undefined);
  const onReasonChange = jest.fn();
  const props = {
    lastSeenAt: "2026-10-20T11:22:00.000Z",
    canOverride: true,
    reason: "",
    onReasonChange,
    closing: false,
    blocked: false,
    onCloseAnyway,
    ...over,
  };
  const view = render(<CounterOfflineClose {...props} />);
  return { ...view, onCloseAnyway, onReasonChange };
}

describe("counterNotSeen", () => {
  it("picks out only the counter_not_seen refusal, with the last report time", () => {
    const notSeen = new SevaClientError("outbox_not_empty", 409, "x", { reason: "counter_not_seen", last_seen_at: "2026-10-20T11:22:00Z" });
    expect(counterNotSeen(notSeen)).toEqual({ lastSeenAt: "2026-10-20T11:22:00Z" });
    expect(counterNotSeen(new SevaClientError("outbox_not_empty", 409, "x", { reason: "counter_not_seen" }))).toEqual({ lastSeenAt: null });
    expect(counterNotSeen(new SevaClientError("outbox_not_empty", 409, "x", { outbox_pending: 2 }))).toBeNull();
    expect(counterNotSeen(new SevaClientError("forbidden", 403, "x"))).toBeNull();
    expect(counterNotSeen(new Error("boom"))).toBeNull();
  });
});

describe("CounterOfflineClose", () => {
  it("explains the refusal with the PC's last report time, for everyone", () => {
    renderIt({ canOverride: false });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(DAYCLOSE_OFFLINE.title.en);
    expect(alert).toHaveTextContent(DAYCLOSE_OFFLINE.why.en);
    expect(alert).toHaveTextContent("It last reported at 4:52 PM.");
    expect(alert).toHaveTextContent(DAYCLOSE_OFFLINE.whatToDo.en);
  });

  it("a receptionist sees the message only, and is told to ask a temple admin", () => {
    renderIt({ canOverride: false });
    expect(screen.getByRole("alert")).toHaveTextContent(DAYCLOSE_OFFLINE.askAdmin.en);
    expect(screen.queryByRole("button", { name: DAYCLOSE_OFFLINE.closeAnyway.en })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("an admin closes anyway only with a reason of 3 visible characters", async () => {
    const { rerender, onCloseAnyway, onReasonChange } = renderIt({ reason: "" });
    const button = screen.getByRole("button", { name: DAYCLOSE_OFFLINE.closeAnyway.en });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(new RegExp(DAYCLOSE_OFFLINE.reasonLabel.en)), { target: { value: "PC off" } });
    expect(onReasonChange).toHaveBeenCalledWith("PC off");

    const props = { lastSeenAt: null, canOverride: true, onReasonChange, closing: false, blocked: false, onCloseAnyway };
    rerender(<CounterOfflineClose {...props} reason={" ​​ "} />);
    expect(screen.getByRole("button", { name: DAYCLOSE_OFFLINE.closeAnyway.en })).toBeDisabled();

    // Another blocker on the page (a count, the UPI total, the note) keeps it waiting.
    rerender(<CounterOfflineClose {...props} reason="Counter PC switched off" blocked />);
    expect(screen.getByRole("button", { name: DAYCLOSE_OFFLINE.closeAnyway.en })).toBeDisabled();

    rerender(<CounterOfflineClose {...props} reason="Counter PC switched off" />);
    const ready = screen.getByRole("button", { name: DAYCLOSE_OFFLINE.closeAnyway.en });
    expect(ready).toBeEnabled();
    await act(async () => {
      fireEvent.click(ready);
    });
    expect(onCloseAnyway).toHaveBeenCalledTimes(1);
  });
});
