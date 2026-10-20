import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

import type { SevaMe } from "@/types/seva";

/**
 * The /seva no-access screen for a signed-in person whose email is not verified: a bilingual notice and a "Send
 * verification email" button (the website's resendVerification), so an unverified website account has a way to become
 * linkable as staff (onboarding refuses `unverified_account`). Everyone else sees the no-access screen as before.
 */

type FakeUser = { uid: string; emailVerified: boolean };
let mockUser: FakeUser | null = null;
let mockMe: SevaMe | null = null;
const mockResend = jest.fn();

jest.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("@/lib/auth", () => ({ resendVerification: (...args: unknown[]) => mockResend(...args) }));
jest.mock("@/hooks/seva/useSevaMe", () => ({
  useSevaMe: () => ({
    me: mockMe,
    loading: false,
    error: null,
    can: () => mockMe !== null,
    reload: () => Promise.resolve(),
  }),
}));

import { SevaGate } from "@/components/seva/shell/SevaGate";

const NOTICE = "Your email address is not verified yet. Staff access needs a verified email.";
const SEND = /^Send verification email/;
const SENT = /^Sent - open the email and click the link, then sign out and in again/;

function renderGate(): void {
  render(
    <SevaGate action="reports.view">
      <p>Reports body</p>
    </SevaGate>,
  );
}

beforeEach(() => {
  mockUser = null;
  mockMe = null;
  mockResend.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("SevaGate: unverified email on the no-access screen", () => {
  it("shows the notice and the button only to a signed-in person whose email is not verified", () => {
    mockUser = { uid: "uid-1", emailVerified: false };
    renderGate();
    expect(screen.getByText("You do not have access to this page.")).toBeInTheDocument();
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    expect(screen.getByText("ನಿಮ್ಮ ಇಮೇಲ್ ವಿಳಾಸ ಇನ್ನೂ ದೃಢೀಕರಿಸಲಾಗಿಲ್ಲ. ಸಿಬ್ಬಂದಿ ಅನುಮತಿಗೆ ದೃಢೀಕರಿಸಿದ ಇಮೇಲ್ ಬೇಕು.")).toHaveAttribute(
      "lang",
      "kn",
    );
    expect(screen.getByRole("button", { name: SEND })).toBeEnabled();
  });

  it("a verified person without access sees the old screen, and so does a signed-out one", () => {
    mockUser = { uid: "uid-2", emailVerified: true };
    const { unmount } = render(
      <SevaGate action="reports.view">
        <p>Reports body</p>
      </SevaGate>,
    );
    expect(screen.getByText("You do not have access to this page.")).toBeInTheDocument();
    expect(screen.getByText("If you need it, ask the temple office to change your role.")).toBeInTheDocument();
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    unmount();

    mockUser = null;
    renderGate();
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("a person with access sees the page, never the notice", () => {
    mockUser = { uid: "uid-3", emailVerified: false };
    mockMe = { staffId: "s", staffNo: 1, name: "N", role: "super_admin", viewOnly: false, actions: [], counter: null };
    renderGate();
    expect(screen.getByText("Reports body")).toBeInTheDocument();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it("sends the verification email for the signed-in user, says so, and waits 60 seconds before another", async () => {
    jest.useFakeTimers();
    mockUser = { uid: "uid-4", emailVerified: false };
    mockResend.mockResolvedValue(undefined);
    renderGate();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: SEND }));
    });
    expect(mockResend).toHaveBeenCalledTimes(1);
    expect(mockResend).toHaveBeenCalledWith(mockUser);
    const sent = screen.getByRole("button", { name: SENT });
    expect(sent).toBeDisabled();
    expect(sent).toHaveTextContent("ಕಳುಹಿಸಲಾಗಿದೆ");

    fireEvent.click(sent);
    expect(mockResend).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(59_000);
    });
    expect(screen.getByRole("button", { name: SENT })).toBeDisabled();

    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    const again = screen.getByRole("button", { name: SEND });
    expect(again).toBeEnabled();
    await act(async () => {
      fireEvent.click(again);
    });
    expect(mockResend).toHaveBeenCalledTimes(2);
  });

  it("is pending while sending, and a failure shows a safe message, not the provider's error", async () => {
    mockUser = { uid: "uid-5", emailVerified: false };
    let fail: (reason: unknown) => void = () => undefined;
    mockResend.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: SEND }));
    expect(screen.getByRole("button", { name: /Sending/ })).toBeDisabled();

    await act(async () => {
      fail(Object.assign(new Error("Firebase: Error (auth/too-many-requests)."), { code: "auth/too-many-requests" }));
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The email could not be sent. Try again in a minute.");
    expect(alert).not.toHaveTextContent("auth/");
    expect(screen.getByRole("button", { name: SEND })).toBeEnabled();
  });
});
