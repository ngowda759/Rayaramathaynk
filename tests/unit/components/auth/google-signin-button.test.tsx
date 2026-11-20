/**
 * components/auth/GoogleSignInButton.tsx — presentation only.
 *
 * The component must not render when the flag is off, must call the centralized helper exactly once,
 * and must show a failure message without exposing anything from the provider.
 */
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

const mockSignInWithGoogle = jest.fn();

jest.mock("@/lib/auth/oauth", () => ({
  ...jest.requireActual("@/lib/auth/oauth"),
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
}));

import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GoogleSignInButton", () => {
  it("renders nothing when the feature flag is off", () => {
    render(<GoogleSignInButton enabled={false} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders an accessible button when enabled", () => {
    render(<GoogleSignInButton enabled next="/profile" />);
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeEnabled();
  });

  it("calls the centralized helper once with the next path", async () => {
    mockSignInWithGoogle.mockResolvedValue({ ok: true });

    render(<GoogleSignInButton enabled next="/profile" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    });

    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    expect(mockSignInWithGoogle).toHaveBeenCalledWith("/profile");
  });

  it("does not double-start a flow while the first click is pending", async () => {
    let resolve: (value: unknown) => void = () => {};
    mockSignInWithGoogle.mockReturnValue(new Promise((r) => (resolve = r)));

    render(<GoogleSignInButton enabled />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    });

    const pendingButton = screen.getByRole("button", { name: /connecting to google/i });
    expect(pendingButton).toBeDisabled();
    await act(async () => {
      fireEvent.click(pendingButton);
      resolve({ ok: true });
    });

    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it("shows the helper's message when the flow cannot start", async () => {
    mockSignInWithGoogle.mockResolvedValue({
      ok: false,
      reason: "not_configured",
      message: "Supabase authentication is not configured in this deployment.",
    });

    render(<GoogleSignInButton enabled />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/not configured/i);
    // The button is usable again so a later, working deployment is one click away.
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeEnabled();
  });

  it("shows a fixed message when the helper throws", async () => {
    mockSignInWithGoogle.mockRejectedValue(new Error("network detail that must not surface"));

    render(<GoogleSignInButton enabled />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/could not be started/i);
    expect(alert).not.toHaveTextContent(/network detail/);
  });
});
