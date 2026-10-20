import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { ResultCard, type ResultCardProps } from "@/components/seva/prasadam/ResultCard";
import { CameraError, SCAN_INTERVAL_MS, startScanner } from "@/lib/seva/prasadam/camera";
import type { PrasadamLookupResult, PrasadamReceipt } from "@/types/seva-prasadam";

/**
 * Prasadam counter result card (plan Task A4-5, DB §11): each lookup state with its colour and actions, never an
 * amount; "Marked given" with Undo only on the caller's own give (`givenNow`, A3-FIX); and the camera scanner.
 */

jest.mock("jsqr", () => ({ __esModule: true, default: jest.fn() }));

const TODAY = "2026-10-18";

const RECEIPT: PrasadamReceipt = {
  id: "rcpt-124",
  receiptNo: "C1-023-10-2026/000124",
  devoteeName: "Venkatesh Rao",
  sevaDate: TODAY,
  // 10:42 AM IST
  issuedAt: "2026-10-18T05:12:00.000Z",
  groupLine: null,
  lines: [
    { nameEn: "Paaduka Pooja", nameKn: "ಪಾದುಕಾ ಪೂಜೆ", quantity: 1, prasadamItems: "Phala-mantrakshate" },
    { nameEn: "Panchamrutha Abhisheka", nameKn: "ಪಂಚಾಮೃತ ಅಭಿಷೇಕ", quantity: 2, prasadamItems: "Panchamrutha, mantrakshate" },
  ],
};

// 11:05 AM IST
const GIVEN_AT = "2026-10-18T05:35:00.000Z";

type Tone = "ok" | "attn" | "crit" | "neutral";

interface StateCase {
  name: string;
  result: PrasadamLookupResult;
  tone: Tone;
  buttons: string[];
  text: RegExp[];
}

const STATES: StateCase[] = [
  {
    name: "ready",
    result: { state: "ready", receipt: RECEIPT },
    tone: "ok",
    buttons: ["Mark given", "Not now"],
    text: [/Give prasadam/, /Venkatesh Rao/, /Paaduka Pooja/, /ಪಾದುಕಾ ಪೂಜೆ/, /Phala-mantrakshate/, /× 2/],
  },
  {
    name: "another_day",
    result: {
      state: "another_day",
      receipt: { ...RECEIPT, sevaDate: "2026-10-19", groupLine: "2 of 3 · paid together · group G-2610-0317" },
      offDate: "before",
      days: 1,
      todaysSlip: { receiptNo: "C1-023-10-2026/000123", position: 1, count: 3 },
    },
    tone: "attn",
    buttons: ["Give anyway", "Scan next"],
    text: [/Not today/, /Mon 19 Oct 2026/, /2 of 3 · paid together/, /1 of 3/, /000123/],
  },
  {
    name: "already_given",
    result: { state: "already_given", receipt: RECEIPT, givenAt: GIVEN_AT, givenBy: "Suresh" },
    tone: "attn",
    buttons: ["Scan next"],
    text: [/Already given/, /11:05 AM/, /Suresh/, /Do not give again/],
  },
  {
    name: "cancelled",
    result: {
      state: "cancelled",
      receipt: RECEIPT,
      cancelledAt: "2026-10-18T04:50:00.000Z",
      cancelledBy: "Ramesh",
      reason: "Wrong seva entered.",
    },
    tone: "crit",
    buttons: ["Scan next"],
    text: [/Receipt cancelled/, /10:20 AM/, /Ramesh/, /Wrong seva entered\./, /newer slip/],
  },
  {
    name: "no_prasadam",
    result: { state: "no_prasadam", receipt: RECEIPT },
    tone: "neutral",
    buttons: ["Scan next"],
    text: [/This seva has no prasadam/],
  },
  {
    name: "choose",
    result: {
      state: "choose",
      options: [
        { receiptId: "a", receiptNo: "C1-023-10-2026/000124", sevaDate: TODAY, devoteeName: "Venkatesh Rao" },
        { receiptId: "b", receiptNo: "C2-024-10-2026/000124", sevaDate: TODAY, devoteeName: "Sudha Rao" },
      ],
    },
    tone: "neutral",
    buttons: ["C1-023-10-2026/000124", "C2-024-10-2026/000124"],
    text: [/more than one receipt/],
  },
  {
    name: "not_found",
    result: { state: "not_found", query: "C1-023-10-2026/009999" },
    tone: "neutral",
    buttons: ["Type again", "Scan QR instead"],
    text: [/Nothing matches/, /C1-023-10-2026\/009999/],
  },
];

function handlers(): Omit<ResultCardProps, "result"> {
  return {
    today: TODAY,
    busy: false,
    undoOpen: false,
    onMarkGiven: jest.fn(),
    onGiveAnyway: jest.fn(),
    onNotNow: jest.fn(),
    onScanNext: jest.fn(),
    onUndo: jest.fn(),
    onChoose: jest.fn(),
    onTypeAgain: jest.fn(),
    onScanInstead: jest.fn(),
  };
}

function renderCard(result: PrasadamLookupResult, extra: Partial<ResultCardProps> = {}) {
  const props = { ...handlers(), ...extra, result };
  const view = render(<ResultCard {...props} />);
  return { ...view, props, card: screen.getByTestId("prasadam-result") };
}

afterEach(cleanup);

describe("ResultCard", () => {
  it("renders each lookup state with its colour and actions", () => {
    expect(STATES.map((s) => s.name).sort()).toEqual(
      ["already_given", "another_day", "cancelled", "choose", "no_prasadam", "not_found", "ready"].sort(),
    );
    for (const c of STATES) {
      const { card } = renderCard(c.result);
      expect({ state: c.name, tone: card.getAttribute("data-tone") }).toEqual({ state: c.name, tone: c.tone });
      expect(card.getAttribute("data-state")).toBe(c.name);
      const names = within(card)
        .queryAllByRole("button")
        .map((b) => b.getAttribute("data-action") ?? b.textContent ?? "");
      for (const label of c.buttons) {
        expect({ state: c.name, has: names.some((n) => n.includes(label)) }).toEqual({ state: c.name, has: true });
      }
      for (const pattern of c.text) {
        expect({ state: c.name, pattern: String(pattern), found: pattern.test(card.textContent ?? "") }).toEqual({
          state: c.name,
          pattern: String(pattern),
          found: true,
        });
      }
      cleanup();
    }
  });

  it("never renders an amount", () => {
    const all: PrasadamLookupResult[] = [
      ...STATES.map((s) => s.result),
      { state: "already_given", receipt: RECEIPT, givenAt: GIVEN_AT, givenBy: "Suresh", givenNow: true },
    ];
    for (const result of all) {
      const { container } = renderCard(result, { undoOpen: true });
      expect(container.textContent ?? "").not.toMatch(/Rs\.?\s?\d/);
      expect(container.textContent ?? "").not.toMatch(/₹/);
      cleanup();
    }
  });

  it("calls the actions of each state", () => {
    let r = renderCard({ state: "ready", receipt: RECEIPT });
    fireEvent.click(screen.getByRole("button", { name: /Mark given/ }));
    fireEvent.click(screen.getByRole("button", { name: /Not now/ }));
    expect(r.props.onMarkGiven).toHaveBeenCalledTimes(1);
    expect(r.props.onNotNow).toHaveBeenCalledTimes(1);
    cleanup();

    r = renderCard(STATES[5].result);
    fireEvent.click(screen.getByRole("button", { name: /C2-024-10-2026\/000124/ }));
    expect(r.props.onChoose).toHaveBeenCalledWith("C2-024-10-2026/000124");
    cleanup();

    r = renderCard({ state: "not_found", query: "x" });
    fireEvent.click(screen.getByRole("button", { name: /Type again/ }));
    fireEvent.click(screen.getByRole("button", { name: /Scan QR instead/ }));
    expect(r.props.onTypeAgain).toHaveBeenCalledTimes(1);
    expect(r.props.onScanInstead).toHaveBeenCalledTimes(1);
  });

  it("needs a second tap on Give anyway for another day", () => {
    const { props } = renderCard(STATES[1].result);
    fireEvent.click(screen.getByRole("button", { name: /Give anyway/ }));
    expect(props.onGiveAnyway).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Tap again to give/ }));
    expect(props.onGiveAnyway).toHaveBeenCalledTimes(1);
  });

  it("says how many days ago a past seva was", () => {
    renderCard({
      state: "another_day",
      receipt: { ...RECEIPT, sevaDate: "2026-10-17" },
      offDate: "after",
      days: 1,
      todaysSlip: null,
    });
    expect(screen.getByTestId("prasadam-result").textContent).toMatch(/This seva was on Sat 17 Oct 2026 \(1 day ago\)/);
  });

  it("shows Marked given with Undo after the caller's own give", () => {
    const { card, props } = renderCard(
      { state: "already_given", receipt: RECEIPT, givenAt: GIVEN_AT, givenBy: "Govinda P", givenNow: true },
      { undoOpen: true },
    );
    expect(card.getAttribute("data-tone")).toBe("ok");
    expect(card.getAttribute("data-state")).toBe("marked");
    expect(card.textContent).toMatch(/Marked given · 11:05 AM/);
    expect(card.textContent).toMatch(/Venkatesh Rao · C1-023-10-2026\/000124/);
    expect(card.textContent).not.toMatch(/Do not give again/);
    fireEvent.click(within(card).getByRole("button", { name: /Undo/ }));
    expect(props.onUndo).toHaveBeenCalledTimes(1);
  });

  it("drops Undo from the marked card once the undo time has passed", () => {
    const { card } = renderCard(
      { state: "already_given", receipt: RECEIPT, givenAt: GIVEN_AT, givenBy: "Govinda P", givenNow: true },
      { undoOpen: false },
    );
    expect(card.textContent).toMatch(/Marked given/);
    expect(within(card).queryByRole("button", { name: /Undo/ })).toBeNull();
  });

  it("shows who gave it and when, with no Undo, when someone else gave it", () => {
    for (const givenNow of [undefined, false]) {
      const { card } = renderCard(
        { state: "already_given", receipt: RECEIPT, givenAt: GIVEN_AT, givenBy: "Suresh", ...(givenNow === false ? { givenNow } : {}) },
        { undoOpen: true },
      );
      expect(card.getAttribute("data-state")).toBe("already_given");
      expect(card.textContent).toMatch(/Given at 11:05 AM by Suresh\./);
      expect(card.textContent).toMatch(/Do not give again\. If the devotee disagrees, ask the receptionist\./);
      expect(card.textContent).not.toMatch(/Marked given/);
      expect(within(card).queryByRole("button", { name: /Undo/ })).toBeNull();
      cleanup();
    }
  });

  it("names the day when it was given on an earlier day", () => {
    renderCard({ state: "already_given", receipt: RECEIPT, givenAt: "2026-10-17T05:35:00.000Z", givenBy: "Suresh" });
    expect(screen.getByTestId("prasadam-result").textContent).toMatch(/Given on Sat 17 Oct 2026 at 11:05 AM by Suresh\./);
  });

  it("disables the actions while a request is running", () => {
    renderCard({ state: "ready", receipt: RECEIPT }, { busy: true });
    expect(screen.getByRole("button", { name: /Mark given/ })).toBeDisabled();
  });
});

/* ---------- camera ---------- */

interface FakeTrack {
  stop: jest.Mock;
}

function fakeVideo(): HTMLVideoElement {
  const video = document.createElement("video");
  Object.defineProperty(video, "readyState", { configurable: true, get: () => 4 });
  Object.defineProperty(video, "videoWidth", { configurable: true, get: () => 320 });
  Object.defineProperty(video, "videoHeight", { configurable: true, get: () => 240 });
  video.play = jest.fn(() => Promise.resolve());
  return video;
}

function installCamera(): { track: FakeTrack; getUserMedia: jest.Mock } {
  const track: FakeTrack = { stop: jest.fn() };
  const stream = { getTracks: () => [track] };
  const getUserMedia = jest.fn(() => Promise.resolve(stream));
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  return { track, getUserMedia };
}

describe("startScanner", () => {
  const g = globalThis as unknown as { BarcodeDetector?: unknown };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete g.BarcodeDetector;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    jest.restoreAllMocks();
  });

  it("uses BarcodeDetector for QR codes where the browser has it, and stops the camera", async () => {
    const { track, getUserMedia } = installCamera();
    const detect = jest.fn(() => Promise.resolve([{ rawValue: "https://site/r/abcdefghijklmnopqrstuv" }]));
    class FakeDetector {
      static getSupportedFormats = jest.fn(() => Promise.resolve(["qr_code", "ean_13"]));
      constructor(public opts: { formats: string[] }) {}
      detect = detect;
    }
    g.BarcodeDetector = FakeDetector;

    const onCode = jest.fn();
    const stop = await startScanner(fakeVideo(), onCode);
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
    await jest.advanceTimersByTimeAsync(SCAN_INTERVAL_MS);
    expect(onCode).toHaveBeenCalledWith("https://site/r/abcdefghijklmnopqrstuv");

    stop();
    expect(track.stop).toHaveBeenCalled();
    onCode.mockClear();
    await jest.advanceTimersByTimeAsync(SCAN_INTERVAL_MS * 3);
    expect(onCode).not.toHaveBeenCalled();
  });

  it("falls back to jsqr on canvas frames every 200 ms", async () => {
    expect(SCAN_INTERVAL_MS).toBe(200);
    installCamera();
    const jsqr = (jest.requireMock("jsqr") as { default: jest.Mock }).default;
    jsqr.mockReset();
    jsqr.mockReturnValueOnce(null).mockReturnValue({ data: "C1-023-10-2026/000124" });
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          drawImage: jest.fn(),
          getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
        }) as unknown as CanvasRenderingContext2D,
    );

    const onCode = jest.fn();
    const stop = await startScanner(fakeVideo(), onCode);
    await jest.advanceTimersByTimeAsync(SCAN_INTERVAL_MS);
    expect(onCode).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(SCAN_INTERVAL_MS);
    expect(onCode).toHaveBeenCalledWith("C1-023-10-2026/000124");
    expect(jsqr).toHaveBeenCalledTimes(2);
    stop();
  });

  it("fails with 'unsupported' when the page has no camera access (needs HTTPS)", async () => {
    await expect(startScanner(fakeVideo(), jest.fn())).rejects.toMatchObject({ code: "unsupported" });
    await expect(startScanner(fakeVideo(), jest.fn())).rejects.toBeInstanceOf(CameraError);
  });

  it("fails with 'denied' when the camera is not allowed", async () => {
    const getUserMedia = jest.fn(() => Promise.reject(Object.assign(new Error("no"), { name: "NotAllowedError" })));
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    await expect(startScanner(fakeVideo(), jest.fn())).rejects.toMatchObject({ code: "denied" });
  });
});

/* ---------- page: own give vs someone else's (A3-FIX givenNow) ---------- */

const mockApi = { lookup: jest.fn(), give: jest.fn(), undo: jest.fn() };

jest.mock("@/services/seva/prasadam.service", () => ({ prasadamApi: () => mockApi }));
jest.mock("@/hooks/useAuth", () => {
  const user = { uid: "u-prasadam", getIdToken: () => Promise.resolve("token") };
  return { useAuth: () => ({ user, loading: false, sevaRole: "prasadam_counter" }) };
});
jest.mock("@/hooks/seva/useSevaMe", () => {
  const value = {
    me: { staffId: "staff-prasadam", staffNo: 31, name: "Govinda P", role: "prasadam_counter", viewOnly: false, actions: ["prasadam.give"], counter: null },
    loading: false,
    error: null,
    can: () => true,
    reload: () => Promise.resolve(),
  };
  return { useSevaMe: () => value };
});

describe("prasadam page", () => {
  // Imported here so the mocks above apply.
  const PrasadamPage = (require("@/app/seva/(desk)/prasadam/page") as typeof import("@/app/seva/(desk)/prasadam/page")).default;
  const own: PrasadamLookupResult = { state: "already_given", receipt: RECEIPT, givenAt: GIVEN_AT, givenBy: "Govinda P", givenNow: true };

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("seva.prasadam.mode", "type");
    mockApi.lookup.mockReset().mockResolvedValue({ state: "ready", receipt: RECEIPT });
    mockApi.give.mockReset();
    mockApi.undo.mockReset().mockResolvedValue(undefined);
  });

  async function findReady(): Promise<void> {
    render(<PrasadamPage />);
    fireEvent.change(await screen.findByLabelText(/Receipt number, as printed/), { target: { value: RECEIPT.receiptNo } });
    fireEvent.click(screen.getByRole("button", { name: /Find receipt/ }));
    await screen.findByRole("button", { name: /Mark given/ });
  }

  it("after the caller's own give shows Marked given with Undo, counts it, and Undo puts it back", async () => {
    mockApi.give.mockResolvedValue(own);
    await findReady();
    fireEvent.click(screen.getByRole("button", { name: /Mark given/ }));

    const marked = await screen.findByText(/Marked given · 11:05 AM/);
    expect(mockApi.give).toHaveBeenCalledWith({ receiptId: RECEIPT.id, confirmOffDate: false });
    expect(screen.getByTestId("prasadam-given-today")).toHaveTextContent("Given 1");
    expect(screen.queryByText(/Do not give again/)).toBeNull();

    fireEvent.click(within(marked.closest("section") as HTMLElement).getByRole("button", { name: /Undo/ }));
    await screen.findByRole("button", { name: /Mark given/ });
    expect(mockApi.undo).toHaveBeenCalledWith({ receiptId: RECEIPT.id });
    expect(screen.queryByText(/Marked given/)).toBeNull();
    expect(screen.getByTestId("prasadam-given-today")).toHaveTextContent("Given 0");
  });

  it("Mark given shows Marking given... at once, blocks a second tap, then pops the tick", async () => {
    let answer: (value: PrasadamLookupResult) => void = () => undefined;
    mockApi.give.mockImplementation(() => new Promise<PrasadamLookupResult>((resolve) => (answer = resolve)));
    await findReady();
    const give = screen.getByRole("button", { name: /Mark given/ });
    fireEvent.click(give);

    // In the same tick as the tap, before the office answers.
    expect(give).toHaveAttribute("aria-busy", "true");
    expect(give).toBeDisabled();
    expect(give.querySelector("[data-spinner]")).not.toBeNull();
    expect(give).toHaveTextContent(/Marking given\.\.\./);
    // The other actions wait, but only the tapped one says it is working.
    const notNow = screen.getByRole("button", { name: /Not now/ });
    expect(notNow).toBeDisabled();
    expect(notNow.querySelector("[data-spinner]")).toBeNull();
    fireEvent.click(give);
    expect(mockApi.give).toHaveBeenCalledTimes(1);

    await act(async () => answer(own));
    const marked = (await screen.findByText(/Marked given · 11:05 AM/)).closest("section") as HTMLElement;
    expect(marked.querySelector("[data-tick]")).not.toBeNull();
  });

  it("Undo shows Undoing... while it runs", async () => {
    mockApi.give.mockResolvedValue(own);
    let undone: () => void = () => undefined;
    mockApi.undo.mockImplementation(() => new Promise<void>((resolve) => (undone = resolve)));
    await findReady();
    fireEvent.click(screen.getByRole("button", { name: /Mark given/ }));
    const marked = (await screen.findByText(/Marked given · 11:05 AM/)).closest("section") as HTMLElement;

    const undo = within(marked).getByRole("button", { name: /Undo/ });
    fireEvent.click(undo);
    expect(undo).toHaveAttribute("aria-busy", "true");
    expect(undo.querySelector("[data-spinner]")).not.toBeNull();
    expect(undo).toHaveTextContent(/Undoing\.\.\./);
    fireEvent.click(undo);
    expect(mockApi.undo).toHaveBeenCalledTimes(1);

    await act(async () => undone());
    await screen.findByRole("button", { name: /Mark given/ });
  });

  it("a give answered already_given without givenNow shows who and when, with no Undo and no count", async () => {
    mockApi.give.mockResolvedValue({ state: "already_given", receipt: RECEIPT, givenAt: GIVEN_AT, givenBy: "Srinivas T" });
    await findReady();
    fireEvent.click(screen.getByRole("button", { name: /Mark given/ }));

    // GIVEN_AT is a fixed day, so against the real clock the card names it: "Given on ... at 11:05 AM by ...".
    await screen.findByText(/at 11:05 AM by Srinivas T\./);
    expect(screen.queryByText(/Marked given/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Undo/ })).toBeNull();
    expect(screen.getByTestId("prasadam-given-today")).toHaveTextContent("Given 0");
  });

  it("shows the check-by-eye message when the office does not answer", async () => {
    const { SevaClientError } = jest.requireActual("@/services/seva/http") as typeof import("@/services/seva/http");
    mockApi.lookup.mockReset().mockRejectedValue(new SevaClientError("network", 0, "No connection to the office server."));
    render(<PrasadamPage />);
    fireEvent.change(await screen.findByLabelText(/Receipt number, as printed/), { target: { value: "124" } });
    fireEvent.click(screen.getByRole("button", { name: /Find receipt/ }));
    expect(await screen.findByTestId("prasadam-offline")).toHaveTextContent(
      "No connection. Check the date on the slip by eye and mark it later.",
    );
  });
});
