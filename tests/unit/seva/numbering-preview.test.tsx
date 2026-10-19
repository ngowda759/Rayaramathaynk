import "@testing-library/jest-dom";
import { createHash } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { CounterList, type CounterListApi } from "@/components/seva/settings/CounterList";
import { CounterRulesForm } from "@/components/seva/settings/CounterRulesForm";
import { HeaderFooterEditor } from "@/components/seva/settings/HeaderFooterEditor";
import { NumberingPreview } from "@/components/seva/settings/NumberingPreview";
import { RegisterThisPc } from "@/components/seva/settings/RegisterThisPc";
import { LARGE_GAP, ReplaceThisPc, lastSlipYear, parseLastSlip, secondLookLine } from "@/components/seva/settings/ReplaceThisPc";
import { SlipPreview } from "@/components/seva/settings/SlipPreview";
import { openSevaDb } from "@/lib/seva/offline/db";
import { getDeviceCredentials, saveDeviceCredentials } from "@/lib/seva/offline/device";
import { pendingCount } from "@/lib/seva/offline/outbox";
import { SevaClientError } from "@/services/seva/http";
import type { SlipSettings } from "@/types/seva";
import type { CounterItem, CounterRules } from "@/types/seva-settings";

/**
 * Settings - receipt template and numbering, counters and devices, counter rules (plan A4-10; DB §13.2, §8.1, §8.4).
 * The browser specs (tests/e2e/seva/settings-receipt.spec.ts) run at the wave gate; these pin the same behaviour now.
 */

const SECRET = "S".repeat(20) + "ecret-0123456789_abcdefg";

jest.mock("@/lib/seva/offline/db", () => ({ openSevaDb: jest.fn() }));
jest.mock("@/lib/seva/offline/device", () => {
  const { createHash: hash } = jest.requireActual<typeof import("node:crypto")>("node:crypto");
  return {
    newDeviceSecret: jest.fn(() => "S".repeat(20) + "ecret-0123456789_abcdefg"),
    sha256HexBrowser: jest.fn(async (text: string) => hash("sha256").update(text, "utf8").digest("hex")),
    saveDeviceCredentials: jest.fn(async () => undefined),
    getDeviceCredentials: jest.fn(async () => null),
  };
});
jest.mock("@/lib/seva/offline/outbox", () => ({ pendingCount: jest.fn(async () => 0) }));
jest.mock("@/components/ui/ImageUploader", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    __esModule: true,
    default: (p: { label?: string; onChange(url: string): void }) =>
      React.createElement("button", { type: "button", onClick: () => p.onChange("https://example.test/photo.png") }, p.label || "Upload"),
  };
});

const SLIP: SlipSettings = {
  templeNameEn: "Sri Raghavendra Swamy Matha",
  templeNameKn: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ",
  addressLine1: "Yelahanka New Town",
  addressLine2: "Bengaluru 560064",
  registrationLine: null,
  photoLeftUrl: null,
  photoRightUrl: null,
  footerLine1: "Sevas are performed on the date shown.",
  footerLine2: "Please keep this receipt for prasadam.",
  footerBlessing: "Sri Gururajo Vijayate",
  printGotra: true,
  printNakshatra: true,
  printRashi: true,
};

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

const db = { close: jest.fn() };

beforeEach(() => {
  (openSevaDb as jest.Mock).mockResolvedValue(db);
  (getDeviceCredentials as jest.Mock).mockResolvedValue(null);
  (pendingCount as jest.Mock).mockResolvedValue(0);
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe("NumberingPreview", () => {
  it("previews the four numbering formats and the yearly restart line", () => {
    render(<NumberingPreview staffNo={23} month={10} year={2026} />);

    const parts = screen.getByRole("list", { name: /Parts of a receipt number/ });
    for (const [value, label] of [
      ["C1", /Series/],
      ["023", /Staff no\./],
      ["10-2026", /Month and year/],
      ["000124", /Running no\./],
    ] as const) {
      const part = within(parts).getByText(value).closest("li");
      expect(part).not.toBeNull();
      expect(part).toHaveTextContent(label);
    }

    expect(screen.getByText("C1-023-10-2026/000124")).toBeInTheDocument();
    expect(screen.getByText("OF1-023-10-2026/000007")).toBeInTheDocument();
    expect(screen.getByText("W-WEB-10-2026/000045")).toBeInTheDocument();
    expect(screen.getByText("W-APP-10-2026/000046")).toBeInTheDocument();
    expect(screen.getByText(/The running number continues all year and starts again on 1 January/)).toBeInTheDocument();
  });

  it("uses the signed-in person's staff number and the given month", () => {
    render(<NumberingPreview staffNo={5} month={1} year={2027} />);
    expect(screen.getByText("C1-005-01-2027/000124")).toBeInTheDocument();
  });
});

describe("SlipPreview and HeaderFooterEditor", () => {
  function Harness({ initial }: { initial: SlipSettings }) {
    const [value, setValue] = jest.requireActual<typeof import("react")>("react").useState(initial);
    return (
      <>
        <HeaderFooterEditor value={value} onChange={setValue} />
        <SlipPreview settings={value} staffNo={23} now={new Date("2026-10-18T05:12:00.000Z")} siteUrl="https://example.test" />
      </>
    );
  }

  it("the slip preview follows the header fields", () => {
    const { container } = render(<Harness initial={SLIP} />);
    const slip = () => container.querySelector("article.slip") as HTMLElement;
    expect(slip()).toHaveTextContent("Sri Raghavendra Swamy Matha");
    expect(slip()).toHaveTextContent("C1-023-10-2026/000124");

    fireEvent.change(screen.getByLabelText(/Temple name, English/), { target: { value: "Rayara Matha" } });
    fireEvent.change(screen.getByLabelText(/Footer line 1/), { target: { value: "Sevas begin at 7 am." } });
    fireEvent.change(screen.getByLabelText(/Registration line/), { target: { value: "Regd. Trust No. 42" } });
    expect(slip()).toHaveTextContent("Rayara Matha");
    expect(slip()).toHaveTextContent("Sevas begin at 7 am.");
    expect(slip()).toHaveTextContent("Regd. Trust No. 42");
    expect(slip()).toHaveTextContent("Kashyapa");

    fireEvent.click(screen.getByRole("checkbox", { name: /Gotra/ }));
    expect(slip()).not.toHaveTextContent("Kashyapa");
    expect(slip()).toHaveTextContent("Rohini");

    fireEvent.click(within(screen.getByRole("group", { name: /Photo 1 \(left\)/ })).getByRole("button"));
    expect(slip().querySelector('img[data-side="left"]')).toHaveAttribute("src", "https://example.test/photo.png");
  });

  it("never puts a phone number on the preview slip", () => {
    const { container } = render(<Harness initial={SLIP} />);
    expect(container.querySelector("article.slip")?.textContent ?? "").not.toMatch(/\d{10}/);
  });

  it("shows the fields read-only for a view-only temple admin", () => {
    render(<HeaderFooterEditor value={SLIP} onChange={jest.fn()} readOnly />);
    expect(screen.getByLabelText(/Temple name, English/)).toHaveAttribute("readonly");
    expect(screen.getByRole("checkbox", { name: /Gotra/ })).toBeDisabled();
    expect(screen.queryByRole("group", { name: /Photo 1/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("No photo yet")).toHaveLength(2);
  });
});

describe("RegisterThisPc", () => {
  it("register this PC sends only the hash and stores the secret locally", async () => {
    const register = jest.fn().mockResolvedValue({ deviceId: "device-123" });
    const onRegistered = jest.fn();
    render(<RegisterThisPc counter={COUNTER} register={register} onRegistered={onRegistered} />);

    fireEvent.click(screen.getByRole("button", { name: /Register this PC/ }));
    fireEvent.change(screen.getByLabelText(/Name for this PC/), { target: { value: "Office PC" } });
    fireEvent.click(screen.getByRole("button", { name: /^Register/ }));

    await waitFor(() => expect(onRegistered).toHaveBeenCalledWith(1));
    expect(register).toHaveBeenCalledTimes(1);
    const body = register.mock.calls[0][0] as Record<string, unknown>;
    expect(body.secretHash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.secretHash).toBe(createHash("sha256").update(SECRET, "utf8").digest("hex"));
    expect(body).not.toHaveProperty("secret");
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(body).toEqual({ counterId: 1, secretHash: body.secretHash, label: "Office PC" });

    expect(saveDeviceCredentials).toHaveBeenCalledWith(db, { deviceId: "device-123", secret: SECRET });
    expect(db.close).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("This PC is now Counter 1.");
  });

  it("says so when the PC could not keep its key", async () => {
    (saveDeviceCredentials as jest.Mock).mockRejectedValueOnce(new Error("quota"));
    const onRegistered = jest.fn();
    render(
      <RegisterThisPc counter={COUNTER} register={jest.fn().mockResolvedValue({ deviceId: "d" })} onRegistered={onRegistered} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Register this PC/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Register/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not keep its key/);
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it("shows the server's message when registration is refused", async () => {
    const register = jest.fn().mockRejectedValue(new SevaClientError("forbidden", 403, "You may not register counters."));
    render(<RegisterThisPc counter={COUNTER} register={register} onRegistered={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Register this PC/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Register/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You may not register counters.");
    expect(saveDeviceCredentials).not.toHaveBeenCalled();
  });

  it("refuses while this PC still has receipts waiting to be sent", async () => {
    (pendingCount as jest.Mock).mockResolvedValue(3);
    const register = jest.fn().mockResolvedValue({ deviceId: "device-123" });
    render(<RegisterThisPc counter={COUNTER} register={register} onRegistered={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Register this PC/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Register/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This PC still has 3 waiting to be sent. Send the waiting receipts first.");
    // Items the office refused stay counted and no screen clears them, so the message says so and names who can.
    expect(alert).toHaveTextContent("If the counter says the office refused some of them, sending again will not clear those");
    expect(alert).toHaveTextContent("Only the person who looks after this site can clear them from this PC");
    expect(register).not.toHaveBeenCalled();
    expect(saveDeviceCredentials).not.toHaveBeenCalled();
    expect(db.close).toHaveBeenCalled();
  });

  it("refuses a PC that already keeps a counter key, as the office would", async () => {
    (getDeviceCredentials as jest.Mock).mockResolvedValue({ deviceId: "device-old", secret: "A".repeat(43) });
    const register = jest.fn().mockResolvedValue({ deviceId: "device-123" });
    render(<RegisterThisPc counter={COUNTER} register={register} onRegistered={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Register this PC/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Register/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The office allows one PC per counter and refuses a second registration.");
    expect(alert).toHaveTextContent("use Replace this PC on that counter");
    expect(register).not.toHaveBeenCalled();
    expect(saveDeviceCredentials).not.toHaveBeenCalled();
  });

  it("refuses when this PC's counter storage cannot be read", async () => {
    (openSevaDb as jest.Mock).mockRejectedValueOnce(new Error("blocked"));
    const register = jest.fn();
    render(<RegisterThisPc counter={COUNTER} register={register} onRegistered={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Register this PC/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Register/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be read, so nothing was sent/);
    expect(register).not.toHaveBeenCalled();
  });
});

describe("ReplaceThisPc", () => {
  it("reads the last slip as a full OF number or a running number", () => {
    expect(parseLastSlip("OF1-023-10-2026/000007", "OF1", 2026)).toBe(7);
    expect(parseLastSlip(" of1-023-10-2026/000012 ", "OF1", 2026)).toBe(12);
    expect(parseLastSlip("7", "OF1", 2026)).toBe(7);
    expect(parseLastSlip("0", "OF1", 2026)).toBe(0);
    expect(parseLastSlip("C1-023-10-2026/000227", "OF1", 2026)).toBeNull();
    expect(parseLastSlip("OF2-023-10-2026/000007", "OF1", 2026)).toBeNull();
    expect(parseLastSlip("", "OF1", 2026)).toBeNull();
    expect(parseLastSlip("abc", "OF1", 2026)).toBeNull();
    expect(parseLastSlip("1000000", "OF1", 2026)).toBeNull();
  });

  it("refuses a full slip number of another year", () => {
    // Last year's slip would set this year's running number to 500: the number restarts on 1 January.
    expect(parseLastSlip("OF1-023-12-2025/000500", "OF1", 2026)).toBeNull();
    expect(parseLastSlip("OF1-023-01-2027/000001", "OF1", 2026)).toBeNull();
    expect(parseLastSlip("OF1-023-12-2025/000500", "OF1", 2025)).toBe(500);
  });

  it("takes last year's slip with its year, so its unsent numbers become a gap of that year (A5-FIX M-4)", () => {
    expect(parseLastSlip("OF1-023-12-2026/000345", "OF1", 2027)).toBe(345);
    expect(lastSlipYear("OF1-023-12-2026/000345", "OF1", 2027)).toBe(2026);
    expect(lastSlipYear("OF1-023-01-2027/000004", "OF1", 2027)).toBe(2027);
    expect(lastSlipYear("345", "OF1", 2027)).toBe(2027);
    // Two years back, or a year before Seva Entry began, is still refused.
    expect(parseLastSlip("OF1-023-12-2026/000345", "OF1", 2028)).toBeNull();
    expect(parseLastSlip("OF1-023-12-2025/000500", "OF1", 2026)).toBeNull();
  });

  it("asks for a second look when the gap is large or the office's last number is unknown", () => {
    expect(LARGE_GAP).toBe(200);
    expect(secondLookLine("OF1", 9, 5)).toBeNull();
    expect(secondLookLine("OF1", 5 + LARGE_GAP, 5)).toBeNull();
    expect(secondLookLine("OF1", 6 + LARGE_GAP, 5)?.en).toBe(
      "That leaves 201 numbers, OF1 6 to 206, as a gap. Check the last slip again before you go on.",
    );
    expect(secondLookLine("OF1", 7, null)?.en).toMatch(/cannot tell its last OF1 number this year/);
    expect(secondLookLine("OF1", 0, null)).toBeNull();
  });

  it("a large gap is sent only after the second confirmation, which shows the range", async () => {
    const replace = jest.fn().mockResolvedValue({ deviceId: "device-new" });
    const onReplaced = jest.fn();
    render(<ReplaceThisPc counter={COUNTER} lastOfNo={5} year={2026} replace={replace} onReplaced={onReplaced} />);
    fireEvent.click(screen.getByRole("button", { name: /Replace this PC/ }));
    const last = screen.getByLabelText(/Last printed offline receipt number/);
    fireEvent.change(last, { target: { value: "1270" } });
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: "Old PC stopped working" } });
    fireEvent.click(screen.getByRole("button", { name: /Move Counter 1 to this PC/ }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That leaves 1265 numbers, OF1 6 to 1270, as a gap.");
    expect(replace).not.toHaveBeenCalled();

    // A changed number needs its own look: the confirmation goes away until the form is sent again.
    fireEvent.change(last, { target: { value: "127" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.change(last, { target: { value: "1270" } });
    fireEvent.click(screen.getByRole("button", { name: /Move Counter 1 to this PC/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes, that is the last slip" }));
    await waitFor(() => expect(onReplaced).toHaveBeenCalledWith(1));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][0]).toMatchObject({ counterId: 1, lastPrintedOfNo: 1270 });
  });

  it("asks for a second look when the office's last number is unknown", async () => {
    const replace = jest.fn().mockResolvedValue({ deviceId: "device-new" });
    render(<ReplaceThisPc counter={COUNTER} lastOfNo={null} year={2026} replace={replace} onReplaced={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Replace this PC/ }));
    fireEvent.change(screen.getByLabelText(/Last printed offline receipt number/), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: "Old PC stopped working" } });
    fireEvent.click(screen.getByRole("button", { name: /Move Counter 1 to this PC/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot tell its last OF1 number this year/);
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, that is the last slip" }));
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    expect(replace.mock.calls[0][0]).toMatchObject({ lastPrintedOfNo: 7 });
  });

  it("checks the reason again at the second confirmation", async () => {
    const replace = jest.fn().mockResolvedValue({ deviceId: "device-new" });
    render(<ReplaceThisPc counter={COUNTER} lastOfNo={5} year={2026} replace={replace} onReplaced={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Replace this PC/ }));
    fireEvent.change(screen.getByLabelText(/Last printed offline receipt number/), { target: { value: "1270" } });
    const reason = screen.getByLabelText(/^Reason/);
    fireEvent.change(reason, { target: { value: "Old PC stopped working" } });
    fireEvent.click(screen.getByRole("button", { name: /Move Counter 1 to this PC/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That leaves 1265 numbers");

    // The reason is emptied while the second look is open: Yes must not send it.
    fireEvent.change(reason, { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Yes, that is the last slip" }));
    expect(await screen.findByText(/Give a reason/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(saveDeviceCredentials).not.toHaveBeenCalled();
  });

  it("refuses while this PC still has receipts waiting to be sent", async () => {
    (pendingCount as jest.Mock).mockResolvedValue(2);
    const replace = jest.fn().mockResolvedValue({ deviceId: "device-new" });
    render(<ReplaceThisPc counter={COUNTER} lastOfNo={5} year={2026} replace={replace} onReplaced={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Replace this PC/ }));
    fireEvent.change(screen.getByLabelText(/Last printed offline receipt number/), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: "Old PC stopped working" } });
    fireEvent.click(screen.getByRole("button", { name: /Move Counter 1 to this PC/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Send the waiting receipts first.");
    expect(replace).not.toHaveBeenCalled();
    expect(saveDeviceCredentials).not.toHaveBeenCalled();
  });

  it("replace this PC needs the last slip number and a reason", async () => {
    const replace = jest.fn().mockResolvedValue({ deviceId: "device-new" });
    const onReplaced = jest.fn();
    render(<ReplaceThisPc counter={COUNTER} lastOfNo={5} year={2026} replace={replace} onReplaced={onReplaced} />);

    fireEvent.click(screen.getByRole("button", { name: /Replace this PC/ }));
    expect(screen.getByText(/never sent become a gap/)).toBeInTheDocument();
    const move = screen.getByRole("button", { name: /Move Counter 1 to this PC/ });

    fireEvent.click(move);
    expect(await screen.findByText(/Check the number/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Last printed offline receipt number/), { target: { value: "OF1-023-10-2026/000009" } });
    expect(screen.getByText(/OF1 numbers 6 to 9 will be listed as a gap/)).toBeInTheDocument();
    fireEvent.click(move);
    expect(await screen.findByText(/Give a reason/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: "Old PC stopped working" } });
    fireEvent.click(move);

    await waitFor(() => expect(onReplaced).toHaveBeenCalledWith(1));
    const body = replace.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toMatchObject({ counterId: 1, lastPrintedOfNo: 9, reason: "Old PC stopped working" });
    expect(body.secretHash).toMatch(/^[0-9a-f]{64}$/);
    expect(body).not.toHaveProperty("secret");
    expect(saveDeviceCredentials).toHaveBeenCalledWith(db, { deviceId: "device-new", secret: SECRET });
  });
});

describe("CounterRulesForm", () => {
  it("counter rules save only the counter fields and keep the two notes always required", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    render(<CounterRulesForm value={RULES} readOnly={false} save={save} />);

    expect(screen.getByRole("switch", { name: /Note for a cash difference/ })).toBeDisabled();
    expect(screen.getByRole("switch", { name: /Note for a cash difference/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /Reason for a changed amount/ })).toHaveAttribute("aria-checked", "true");

    fireEvent.change(screen.getByLabelText(/Cancel window/), { target: { value: "45" } });
    fireEvent.change(screen.getByLabelText(/Days ahead/), { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText(/flag threshold/), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: /Save settings/ }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({ cancelWindowMinutes: 45, counterDaysAhead: 180, dayCloseFlagThresholdPaise: 25_000 });
    expect(await screen.findByRole("status")).toHaveTextContent(/Saved/);
  });

  it("refuses a cancel window above 240 minutes", async () => {
    const save = jest.fn();
    render(<CounterRulesForm value={RULES} readOnly={false} save={save} />);
    fireEvent.change(screen.getByLabelText(/Cancel window/), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: /Save settings/ }));
    expect(await screen.findByText(/from 0 to 240/)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it("shows view-only temple admins the rules without a save button", () => {
    render(<CounterRulesForm value={RULES} readOnly save={jest.fn()} />);
    expect(screen.getByLabelText(/Cancel window/)).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: /Save settings/ })).not.toBeInTheDocument();
  });
});

describe("CounterList", () => {
  function api(over: Partial<Record<keyof CounterListApi, jest.Mock>> = {}): CounterListApi & Record<keyof CounterListApi, jest.Mock> {
    return {
      listCounters: jest.fn().mockResolvedValue([COUNTER]),
      addCounter: jest.fn().mockResolvedValue({ id: 2, onlineSeries: "C2", offlineSeries: "OF2" }),
      updateCounter: jest.fn().mockResolvedValue(undefined),
      continuity: jest.fn().mockResolvedValue([
        { series: "C1", year: 2026, counterName: "Counter 1", firstNo: "C1-023-01-2026/000001", lastNo: "C1-023-10-2026/000227", numbers: 227, issued: 220, cancelled: 7, openGaps: 0 },
        { series: "OF1", year: 2026, counterName: "Counter 1", firstNo: "OF1-023-03-2026/000001", lastNo: "OF1-023-10-2026/000007", numbers: 7, issued: 7, cancelled: 0, openGaps: 0 },
      ]),
      registerDevice: jest.fn().mockResolvedValue({ deviceId: "device-1" }),
      replaceDevice: jest.fn().mockResolvedValue({ deviceId: "device-2" }),
      ...over,
    };
  }

  it("lists counters with their series and last numbers and adds the next one", async () => {
    const a = api();
    render(<CounterList api={a} canEdit canRegister thisPcCounterId={1} year={2026} today="2026-10-18" />);

    expect(await screen.findByText("C1-023-10-2026/000227")).toBeInTheDocument();
    expect(screen.getByText("OF1-023-10-2026/000007")).toBeInTheDocument();
    expect(a.continuity).toHaveBeenCalledWith("2026-01-01", "2026-10-18");
    expect(screen.getByText(/^This PC/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /\+ Add a counter \(C2 and OF2\)/ }));
    fireEvent.change(screen.getByLabelText(/Counter name/), { target: { value: "Counter 2" } });
    fireEvent.click(screen.getByRole("button", { name: /^\+ Add a counter \(C2 and OF2\)/ }));
    await waitFor(() => expect(a.addCounter).toHaveBeenCalledWith({ name: "Counter 2", place: null }));
    await waitFor(() => expect(a.listCounters).toHaveBeenCalledTimes(2));
  });

  it("saves an opening float in paise", async () => {
    const a = api();
    render(<CounterList api={a} canEdit canRegister thisPcCounterId={null} year={2026} today="2026-10-18" />);
    const float = await screen.findByLabelText(/Opening float/);
    expect(float).toHaveValue("500");
    fireEvent.change(float, { target: { value: "750" } });
    fireEvent.click(screen.getByRole("button", { name: /Save float/ }));
    await waitFor(() => expect(a.updateCounter).toHaveBeenCalledWith(1, { openingFloatPaise: 75_000 }));
  });

  it("offers nothing to change to a view-only temple admin", async () => {
    render(<CounterList api={api()} canEdit={false} canRegister={false} thisPcCounterId={null} year={2026} today="2026-10-18" />);
    expect(await screen.findByText("C1-023-10-2026/000227")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add a counter/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Register this PC/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Replace this PC/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Opening float/)).toHaveAttribute("readonly");
  });

  it("a view-only opening float sends nothing when its form is submitted with Enter", async () => {
    const a = api();
    render(<CounterList api={a} canEdit={false} canRegister={false} thisPcCounterId={null} year={2026} today="2026-10-18" />);
    const float = await screen.findByLabelText(/Opening float/);
    const form = float.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(a.updateCounter).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a PC that is already a counter is offered only Replace, and only on its own counter", async () => {
    const second: CounterItem = { ...COUNTER, id: 2, name: "Counter 2", place: null, onlineSeries: "C2", offlineSeries: "OF2" };
    const a = api({ listCounters: jest.fn().mockResolvedValue([COUNTER, second]) });
    const { container } = render(<CounterList api={a} canEdit canRegister thisPcCounterId={1} year={2026} today="2026-10-18" />);
    await screen.findByText("C1-023-10-2026/000227");
    const own = container.querySelector('li[data-counter="1"]') as HTMLElement;
    const other = container.querySelector('li[data-counter="2"]') as HTMLElement;
    expect(within(own).queryByRole("button", { name: /Register this PC/ })).not.toBeInTheDocument();
    expect(within(own).getByRole("button", { name: /Replace this PC/ })).toBeInTheDocument();
    expect(within(other).queryByRole("button", { name: /Register this PC/ })).not.toBeInTheDocument();
    expect(within(other).queryByRole("button", { name: /Replace this PC/ })).not.toBeInTheDocument();
    expect(other).toHaveTextContent("This PC is already Counter 1.");
  });

  it("a PC that is not a counter yet may register as or take over any counter", async () => {
    render(<CounterList api={api()} canEdit canRegister thisPcCounterId={null} year={2026} today="2026-10-18" />);
    await screen.findByText("C1-023-10-2026/000227");
    expect(screen.getByRole("button", { name: /Register this PC/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Replace this PC/ })).toBeInTheDocument();
  });

  it("after registering, the list says so and offers only Replace on that counter", async () => {
    const a = api();
    render(<CounterList api={a} canEdit canRegister thisPcCounterId={null} year={2026} today="2026-10-18" />);
    fireEvent.click(await screen.findByRole("button", { name: /Register this PC/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Register/ }));
    expect(await screen.findByText("This PC is now Counter 1.")).toBeInTheDocument();
    expect(a.registerDevice).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Register this PC/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Replace this PC/ })).toBeInTheDocument();
  });
});
