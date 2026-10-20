import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { CameraScannerProps } from "@/components/seva/prasadam/CameraScanner";
import PrasadamPage from "@/app/seva/(desk)/prasadam/page";
import { SevaClientError } from "@/services/seva/http";
import type { PrasadamLookupResult, PrasadamReceipt } from "@/types/seva-prasadam";

/**
 * Prasadam counter page, scan mode (plan Task A4-5, DB §11, C-27): a slip just dealt with is ignored only while it
 * stays in front of the camera; shown again after it was out of view, it is looked up again and gets its card.
 */

const mockCamera: { props: CameraScannerProps | null } = { props: null };
const mockApi = { lookup: jest.fn(), give: jest.fn(), undo: jest.fn() };
const mockUser = { getIdToken: async (): Promise<string> => "token" };
const mockMe = { staffId: "staff-1", staffNo: 7, name: "Suresh" };

jest.mock("@/components/seva/shell/SevaGate", () => ({
  SevaGate: ({ children }: { children: unknown }) => children,
}));
jest.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("@/hooks/seva/useSevaMe", () => ({ useSevaMe: () => ({ me: mockMe }) }));
jest.mock("@/services/seva/prasadam.service", () => ({ prasadamApi: () => mockApi }));
jest.mock("@/components/seva/prasadam/CameraScanner", () => ({
  CameraScanner: (props: CameraScannerProps) => {
    mockCamera.props = props;
    return <div data-testid="camera" />;
  },
}));

const SLIP = "https://example.org/r/slip-a";

const RECEIPT: PrasadamReceipt = {
  id: "rcpt-124",
  receiptNo: "C1-023-10-2026/000124",
  devoteeName: "Venkatesh Rao",
  sevaDate: "2026-10-19",
  issuedAt: "2026-10-19T05:12:00.000Z",
  groupLine: null,
  lines: [{ nameEn: "Paaduka Pooja", nameKn: null, quantity: 1, prasadamItems: "Phala-mantrakshate" }],
};

const READY: PrasadamLookupResult = { state: "ready", receipt: RECEIPT };
const GIVEN_NOW: PrasadamLookupResult = {
  state: "already_given",
  receipt: RECEIPT,
  givenAt: "2026-10-19T05:35:00.000Z",
  givenBy: "Suresh",
  givenNow: true,
};
const ALREADY_GIVEN: PrasadamLookupResult = {
  state: "already_given",
  receipt: RECEIPT,
  givenAt: "2026-10-19T05:35:00.000Z",
  givenBy: "Suresh",
};

let now = 1_000_000;

function cameraProps(): CameraScannerProps {
  if (!mockCamera.props) throw new Error("The camera is not shown.");
  return mockCamera.props;
}

/** One QR frame read by the camera at the given time. */
async function scanAt(at: number, text = SLIP): Promise<void> {
  now = at;
  await act(async () => {
    cameraProps().onCode(text);
  });
}

function cameraRunningAt(at: number): void {
  now = at;
  act(() => cameraProps().onRunning?.());
}

beforeEach(() => {
  now = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  mockCamera.props = null;
  mockApi.lookup.mockReset();
  mockApi.give.mockReset();
  mockApi.undo.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

/** Scans the slip, sees "Give prasadam", taps Mark given and waits for the camera to come back. */
async function scanAndMarkGiven(): Promise<void> {
  mockApi.lookup.mockResolvedValueOnce(READY);
  mockApi.give.mockResolvedValueOnce(GIVEN_NOW);
  render(<PrasadamPage />);
  await scanAt(now);
  fireEvent.click(await screen.findByRole("button", { name: /Mark given/ }));
  await screen.findByTestId("camera");
}

describe("prasadam counter - a handled slip in scan mode", () => {
  it("is ignored while it stays in front of the camera after Mark given", async () => {
    await scanAndMarkGiven();
    const start = now;
    cameraRunningAt(start + 500);
    // Frames every 200 ms for 5 s: the slip never leaves the camera.
    for (let at = start + 700; at <= start + 5_700; at += 200) await scanAt(at);
    expect(mockApi.lookup).toHaveBeenCalledTimes(1);
  });

  it("shows 'Already given' when the same slip comes back after it was out of view for more than 3 s", async () => {
    await scanAndMarkGiven();
    const start = now;
    cameraRunningAt(start + 500);
    await scanAt(start + 700);
    expect(mockApi.lookup).toHaveBeenCalledTimes(1);

    // The devotee walks away and shows the same slip again a minute later.
    mockApi.lookup.mockResolvedValueOnce(ALREADY_GIVEN);
    await scanAt(start + 60_000);
    expect(mockApi.lookup).toHaveBeenCalledTimes(2);
    expect(mockApi.lookup).toHaveBeenLastCalledWith(SLIP);
    expect(await screen.findByText("Already given")).toBeInTheDocument();
    expect(screen.getByText("Do not give again.", { exact: false })).toBeInTheDocument();
  });

  it("looks the slip up again after Not now once it was out of view", async () => {
    mockApi.lookup.mockResolvedValueOnce(READY);
    render(<PrasadamPage />);
    await scanAt(now);
    fireEvent.click(await screen.findByRole("button", { name: /Not now/ }));
    await screen.findByTestId("camera");
    const start = now;
    cameraRunningAt(start + 300);
    await scanAt(start + 500);
    expect(mockApi.lookup).toHaveBeenCalledTimes(1);

    mockApi.lookup.mockResolvedValueOnce(READY);
    await scanAt(start + 4_000);
    expect(mockApi.lookup).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("button", { name: /Mark given/ })).toBeInTheDocument();
  });

  it("does not count a frame dropped while a request runs as a sighting", async () => {
    let fail: (error: unknown) => void = () => undefined;
    mockApi.lookup.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    render(<PrasadamPage />);
    await scanAt(now);
    const start = now;
    // A new slip arrives while the first lookup is still running: dropped.
    await scanAt(start + 200, "https://example.org/r/slip-b");
    expect(mockApi.lookup).toHaveBeenCalledTimes(1);

    await act(async () => {
      fail(new SevaClientError("server", 500, "The office could not answer."));
    });
    await waitFor(() => expect(screen.getByText("The office could not answer.")).toBeInTheDocument());

    mockApi.lookup.mockResolvedValueOnce(READY);
    await scanAt(start + 400, "https://example.org/r/slip-b");
    expect(mockApi.lookup).toHaveBeenCalledTimes(2);
    expect(mockApi.lookup).toHaveBeenLastCalledWith("https://example.org/r/slip-b");
  });
});
