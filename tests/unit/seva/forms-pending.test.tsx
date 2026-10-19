import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState, type JSX } from "react";

import { PrintLink } from "@/components/seva/receipt/PrintLink";
import { PublicReceiptView } from "@/components/seva/receipt/PublicReceiptView";
import { CounterRulesForm } from "@/components/seva/settings/CounterRulesForm";
import { RegisterThisPc } from "@/components/seva/settings/RegisterThisPc";
import { OnboardDialog } from "@/components/seva/staff/OnboardDialog";
import { StaffDrawer, type StaffCan } from "@/components/seva/staff/StaffDrawer";
import { can as matrixCan } from "@/lib/seva/permissions";
import type { StaffApi } from "@/services/seva/staff.service";
import type { SevaMe } from "@/types/seva";
import type { CounterItem, CounterRules } from "@/types/seva-settings";
import type { StaffMember } from "@/types/seva-staff";

/**
 * Pending states and motion on the settings, staff and receipt screens (plan A4P-4): every Save answers the click at
 * once ("Saving..." with a spinner, aria-busy, no second send) and then shows a saved line; the staff drawer and the
 * onboard dialog animate out; the receipt's Print link shows that the print page is opening.
 */

const mockLinkStatus = { pending: false };

jest.mock("next/link", () => {
  const actual = jest.requireActual("next/link") as typeof import("next/link");
  return { ...actual, __esModule: true, default: actual.default, useLinkStatus: () => mockLinkStatus };
});

/** A promise the test settles by hand. */
function deferred<T = void>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const RULES: CounterRules = {
  cancelWindowMinutes: 30,
  counterDaysAhead: 365,
  onlineDaysAhead: 90,
  onlineSameDayCutoff: "12:00",
  prasadamUndoSeconds: 60,
  dayCloseFlagThresholdPaise: 10_000,
  tallyCashLedger: "Cash",
  tallyUpiLedger: "Bank",
  tallyOnlineLedger: "Bank",
  tallyColumns: null,
};

const COUNTER: CounterItem = {
  id: 1,
  name: "Counter 1",
  place: "Office PC",
  openingFloatPaise: 50_000,
  active: true,
  onlineSeries: "C1",
  offlineSeries: "OF1",
};

const SA: SevaMe = { staffId: "me-super", staffNo: 8, name: "Prakash Rao", role: "super_admin", viewOnly: false, actions: [], counter: null };
const canSA: StaffCan = (action, ctx) => matrixCan(SA, action, ctx);

const RAMESH: StaffMember = {
  id: "11111111-1111-4111-8111-111111111111",
  staffNo: 23,
  fullName: "Ramesh K",
  email: "ramesh.k@example.com",
  role: "receptionist",
  viewOnly: false,
  status: "active",
  lastActiveAt: "2026-10-18T05:35:00.000Z",
  invitedAt: "2026-10-01T05:00:00.000Z",
  firstSignedInAt: "2026-10-02T05:00:00.000Z",
};

function staffApi(over: Partial<Record<keyof StaffApi, jest.Mock>> = {}): StaffApi & Record<keyof StaffApi, jest.Mock> {
  return {
    list: jest.fn().mockResolvedValue([]),
    nextStaffNo: jest.fn().mockResolvedValue(35),
    onboard: jest.fn().mockResolvedValue({ staffId: "new-id", staffNo: 35 }),
    update: jest.fn().mockResolvedValue(undefined),
    ...over,
  };
}

/** A pending button: busy, disabled, with its spinner and the pending words. */
function expectPending(button: HTMLElement, words: RegExp): void {
  expect(button).toHaveAttribute("aria-busy", "true");
  expect(button).toBeDisabled();
  expect(button.querySelector("[data-spinner]")).not.toBeNull();
  expect(button).toHaveTextContent(words);
}

afterEach(() => {
  cleanup();
  mockLinkStatus.pending = false;
  jest.clearAllMocks();
});

describe("settings saves", () => {
  it("a settings save shows Saving... and then the saved line", async () => {
    const gate = deferred();
    const save = jest.fn(() => gate.promise);
    render(<CounterRulesForm value={RULES} readOnly={false} save={save} />);

    const button = screen.getByRole("button", { name: "Save settings" });
    fireEvent.click(button);
    // In the same tick as the click, before the office answers.
    expectPending(button, /Saving\.\.\./);
    fireEvent.click(button);
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();

    await act(async () => {
      gate.resolve();
      await gate.promise;
    });
    const saved = await screen.findByRole("status");
    expect(saved).toHaveTextContent(/Saved\. Changes apply to receipts made after now\./);
    expect(saved.closest("[data-testid=\"saved-line\"]")).not.toBeNull();
    await waitFor(() => expect(screen.getByRole("button", { name: "Save settings" })).not.toHaveAttribute("aria-busy"));
  });

  it("Register this PC shows Registering... with a spinner while it works", async () => {
    render(<RegisterThisPc counter={COUNTER} register={jest.fn()} onRegistered={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Register this PC" }));
    const button = screen.getByRole("button", { name: "Register" });
    fireEvent.click(button);
    expectPending(button, /Registering\.\.\./);
    // This test PC has no counter database, so the check refuses and the form says why.
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("staff", () => {
  it("the drawer's Save shows Saving... and the drawer animates out after the save", async () => {
    const gate = deferred();
    const api = staffApi({ update: jest.fn(() => gate.promise) });
    const onChanged = jest.fn();

    function Host(): JSX.Element {
      const [open, setOpen] = useState<StaffMember | null>(RAMESH);
      return (
        <StaffDrawer member={open} meStaffId={SA.staffId} can={canSA} api={api} onClose={() => setOpen(null)} onChanged={onChanged} />
      );
    }
    render(<Host />);

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: /^Prasadam counter/ }));
    const save = within(dialog).getByRole("button", { name: "Save" });
    fireEvent.click(save);
    expectPending(save, /Saving\.\.\./);

    await act(async () => {
      gate.resolve();
      await gate.promise;
    });
    expect(onChanged).toHaveBeenCalledWith({ title: "Ramesh K is updated" });
    // It leaves with its exit animation, then is gone.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
  });

  it("onboarding's Send invite shows Sending... at once", async () => {
    const gate = deferred<{ staffId: string; staffNo: number }>();
    const api = staffApi({ onboard: jest.fn(() => gate.promise) });
    render(<OnboardDialog open onClose={jest.fn()} api={api} sendInvite={jest.fn().mockResolvedValue(undefined)} can={canSA} onOnboarded={jest.fn()} />);

    await waitFor(() => expect(screen.getByLabelText("Staff no.")).toHaveValue(35));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Meera Bhat" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "meera.bhat@example.com" } });
    const send = screen.getByRole("button", { name: "Send invite" });
    fireEvent.click(send);
    expectPending(send, /Sending\.\.\./);

    await act(async () => {
      gate.resolve({ staffId: "new-id", staffNo: 35 });
      await gate.promise;
    });
  });
});

describe("public QR page", () => {
  it("reveals once, gently, without script and only for people who allow motion", () => {
    render(
      <PublicReceiptView
        receipt={{
          receiptNo: "C1-023-10-2026/000124",
          status: "valid",
          templeNameEn: "Sri Raghavendra Swamy Matha",
          templeNameKn: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ",
          devoteeName: "Venkatesh Rao",
          gotra: null,
          nakshatra: null,
          sevaDate: "2026-10-19",
          mode: "cash",
          totalPaise: 5000,
          prasadam: "pending",
          lines: [{ nameEn: "Archana", nameKn: "ಅರ್ಚನೆ", quantity: 1, amountPaise: 5000 }],
        }}
      />,
    );
    const card = screen.getByRole("article");
    // A CSS entrance (no motion script on the public page): it starts at paint and is skipped under reduced motion.
    expect(card.className).toMatch(/motion-safe:animate-in/);
    expect(card.className).toMatch(/motion-safe:fade-in-0/);
    expect(card.className).not.toMatch(/(^|\s)animate-in/);
    expect(card.closest("[style*='opacity']")).toBeNull();
  });
});

describe("receipt detail", () => {
  it("the Print link shows that the print page is opening", () => {
    const { rerender } = render(<PrintLink href="/seva/r1/print" label={{ en: "Print", kn: "ಮುದ್ರಿಸಿ" }} />);
    const link = screen.getByRole("link", { name: /Print/ });
    expect(link).toHaveAttribute("href", "/seva/r1/print");
    expect(link.querySelector("[data-spinner]")).toBeNull();

    mockLinkStatus.pending = true;
    rerender(<PrintLink href="/seva/r1/print" label={{ en: "Print", kn: "ಮುದ್ರಿಸಿ" }} />);
    expect(link.querySelector("[data-spinner]")).not.toBeNull();
    expect(link).toHaveTextContent(/Opening the print page\.\.\./);
  });
});
