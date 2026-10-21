/**
 * The Raya AI reset-password page, with the Supabase client stubbed.
 *
 * The page must (a) redeem whichever recovery-link shape arrived without
 * consuming the credential twice, (b) refuse to show the form without a
 * recovery-derived session, and (c) write the new password with
 * `updateUser({ password })`.
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockReplace = jest.fn();
const mockGetSession = jest.fn();
const mockExchangeCodeForSession = jest.fn();
const mockVerifyOtp = jest.fn();
const mockUpdateUser = jest.fn();
const mockSignOut = jest.fn();
const mockUnsubscribe = jest.fn();
let authChangeHandler: ((event: string) => void) | null = null;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      exchangeCodeForSession: mockExchangeCodeForSession,
      verifyOtp: mockVerifyOtp,
      updateUser: mockUpdateUser,
      signOut: mockSignOut,
      onAuthStateChange: (handler: (event: string) => void) => {
        authChangeHandler = handler;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
    },
  }),
}));

import RayaAiResetPasswordPage from "@/app/admin/ai/reset-password/page";

const REAL_URL = "https://abcdefghijklmnop.supabase.co";
const REAL_KEY = "eyJhbGciOi.real.key";
const originalEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};
const originalHref = window.location.href;

function setUrl(url: string) {
  window.history.replaceState(null, "", url);
}

beforeEach(() => {
  mockReplace.mockReset();
  mockGetSession.mockReset().mockResolvedValue({ data: { session: null } });
  mockExchangeCodeForSession.mockReset();
  mockVerifyOtp.mockReset();
  mockUpdateUser.mockReset();
  mockSignOut.mockReset().mockResolvedValue({ error: null });
  mockUnsubscribe.mockReset();
  authChangeHandler = null;
  process.env.NEXT_PUBLIC_SUPABASE_URL = REAL_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = REAL_KEY;
  setUrl("/admin/ai/reset-password");
});

afterEach(() => {
  if (originalEnv.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.url;
  if (originalEnv.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.key;
  setUrl(originalHref);
});

describe("Raya AI reset-password — link redemption", () => {
  it("shows the form when the client already redeemed the code during initialization", async () => {
    // This is the PKCE case: getSession() awaits init, which consumed the code.
    setUrl("/admin/ai/reset-password?code=abc-123");
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    render(<RayaAiResetPasswordPage />);
    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
    // The code must NOT be exchanged a second time.
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("exchanges the code itself when initialization did not", async () => {
    setUrl("/admin/ai/reset-password?code=abc-123");
    mockGetSession
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValueOnce({ data: { session: { access_token: "t" } } });
    mockExchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
    render(<RayaAiResetPasswordPage />);
    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("abc-123");
  });

  it("verifies an OTP token-hash link", async () => {
    setUrl("/admin/ai/reset-password?token_hash=hash-1&type=recovery");
    mockGetSession
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValueOnce({ data: { session: { access_token: "t" } } });
    mockVerifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
    render(<RayaAiResetPasswordPage />);
    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
    expect(mockVerifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "hash-1" });
  });

  it("opens the form when the client reports PASSWORD_RECOVERY for a fragment link", async () => {
    // The fragment is redeemed during initialization, but the event can land
    // after this page has already decided there is no session; the handler is
    // the safety net, so assert it flips the gate on its own.
    setUrl("/admin/ai/reset-password#access_token=tok&refresh_token=r&type=recovery");
    mockGetSession.mockResolvedValue({ data: { session: null } });
    render(<RayaAiResetPasswordPage />);
    expect(await screen.findByTestId("raya-auth-error")).toHaveTextContent(/invalid, has expired/i);
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();

    await waitFor(() => expect(authChangeHandler).not.toBeNull());
    authChangeHandler?.("PASSWORD_RECOVERY");
    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
  });

  it("ignores unrelated auth events", async () => {
    setUrl("/admin/ai/reset-password#access_token=tok&refresh_token=r&type=recovery");
    mockGetSession.mockResolvedValue({ data: { session: null } });
    render(<RayaAiResetPasswordPage />);
    await screen.findByTestId("raya-auth-error");
    await waitFor(() => expect(authChangeHandler).not.toBeNull());
    authChangeHandler?.("TOKEN_REFRESHED");
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(screen.getByTestId("raya-auth-error")).toBeInTheDocument();
  });

  it("unsubscribes from auth events on unmount", async () => {
    const view = render(<RayaAiResetPasswordPage />);
    await waitFor(() => expect(authChangeHandler).not.toBeNull());
    view.unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

describe("Raya AI reset-password — the form is gated on a recovery session", () => {
  it("refuses the form with no session and explains why", async () => {
    setUrl("/admin/ai/reset-password");
    render(<RayaAiResetPasswordPage />);
    expect(await screen.findByTestId("raya-auth-error")).toHaveTextContent(/invalid, has expired/i);
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("refuses the form for an ordinary session that did not come from a reset link", async () => {
    setUrl("/admin/ai/reset-password");
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    render(<RayaAiResetPasswordPage />);
    expect(await screen.findByTestId("raya-auth-error")).toHaveTextContent(
      /from the password reset link/i
    );
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("reports a link error returned by the redirect", async () => {
    setUrl("/admin/ai/reset-password?error=access_denied&error_code=otp_expired");
    render(<RayaAiResetPasswordPage />);
    expect(await screen.findByTestId("raya-auth-error")).toHaveTextContent(/could not be used/i);
  });

  it("reports a failed code exchange instead of showing a broken form", async () => {
    setUrl("/admin/ai/reset-password?code=stale");
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { code: "flow_state_not_found", message: "invalid flow state" },
    });
    render(<RayaAiResetPasswordPage />);
    expect(await screen.findByTestId("raya-auth-error")).toHaveTextContent(/could not be used/i);
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });
});

describe("Raya AI reset-password — updating the password", () => {
  async function openFormWithRecoverySession() {
    setUrl("/admin/ai/reset-password?code=abc-123");
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    render(<RayaAiResetPasswordPage />);
    await screen.findByLabelText("New password");
  }

  it("writes the password with updateUser and returns to sign in", async () => {
    mockUpdateUser.mockResolvedValue({ data: { user: {} }, error: null });
    await openFormWithRecoverySession();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "brandnewpass1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "brandnewpass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ password: "brandnewpass1" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/updated/i);
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });

  it("blocks a mismatch before calling the server", async () => {
    await openFormWithRecoverySession();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "brandnewpass1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "differentpass2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByTestId("raya-auth-error")).toHaveTextContent(/do not match/i);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("blocks a short password before calling the server", async () => {
    await openFormWithRecoverySession();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByTestId("raya-auth-error")).toHaveTextContent(/at least 8/i);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("surfaces a server weak_password rejection", async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { code: "weak_password", message: "Password should be at least 8 characters" },
    });
    await openFormWithRecoverySession();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "brandnewpass1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "brandnewpass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByTestId("raya-auth-error")).toHaveTextContent(/too weak/i);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("reports an expired session when the update finds no session", async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
    });
    await openFormWithRecoverySession();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "brandnewpass1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "brandnewpass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByTestId("raya-auth-error")).toHaveTextContent(/expired or was already used/i);
  });
});
