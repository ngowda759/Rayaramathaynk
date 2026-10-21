/**
 * The Raya AI password-recovery request page.
 *
 * The page must always answer the same way, whether or not the address has an
 * account, so it cannot be used to enumerate administrators. The one exception
 * is a rate limit, which the person can act on. It must also send Supabase the
 * absolute reset address, because a `redirectTo` that is not on the project's
 * allow-list is what makes the emailed link fall back to the site homepage.
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockResetPasswordForEmail = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { resetPasswordForEmail: mockResetPasswordForEmail },
  }),
}));

import RayaAiForgotPasswordPage from "@/app/admin/ai/forgot-password/page";

const REAL_URL = "https://abcdefghijklmnop.supabase.co";
const REAL_KEY = "eyJhbGciOi.real.key";
const originalEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

beforeEach(() => {
  mockResetPasswordForEmail.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = REAL_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = REAL_KEY;
});

afterEach(() => {
  if (originalEnv.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.url;
  if (originalEnv.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.key;
});

function requestReset(email = "admin@example.org") {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
}

describe("Raya AI recovery request", () => {
  it("sends the absolute reset address as redirectTo", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    render(<RayaAiForgotPasswordPage />);
    requestReset();
    await waitFor(() =>
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "admin@example.org",
        expect.objectContaining({
          redirectTo: `${window.location.origin}/admin/ai/reset-password`,
        })
      )
    );
  });

  it("acknowledges a known address", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    render(<RayaAiForgotPasswordPage />);
    requestReset();
    expect(await screen.findByRole("status")).toHaveTextContent(/reset link is on its way/i);
  });

  it("gives the same acknowledgement for an unknown address, so it cannot enumerate", async () => {
    // Supabase answers 200 for an unknown address; the wording must not differ.
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    render(<RayaAiForgotPasswordPage />);
    requestReset("nobody@example.org");
    expect(await screen.findByRole("status")).toHaveTextContent(/If that email belongs/i);
    expect(screen.queryByTestId("raya-auth-error")).not.toBeInTheDocument();
  });

  it("reports a rate limit, the one actionable failure", async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { code: "over_email_send_rate_limit", message: "Email rate limit exceeded", status: 429 },
    });
    render(<RayaAiForgotPasswordPage />);
    requestReset();
    expect(await screen.findByTestId("raya-auth-error")).toHaveTextContent(/too many attempts/i);
  });

  it("reports a transport failure rather than claiming an email was sent", async () => {
    mockResetPasswordForEmail.mockRejectedValue(
      Object.assign(new Error("Failed to fetch"), { name: "AuthRetryableFetchError", status: 0 })
    );
    render(<RayaAiForgotPasswordPage />);
    requestReset();
    expect(await screen.findByTestId("raya-auth-error")).toHaveTextContent(/could not reach/i);
  });

  it("does not call the server when the deployment is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    render(<RayaAiForgotPasswordPage />);
    requestReset();
    expect(await screen.findByTestId("raya-auth-error")).toHaveTextContent(/not configured/i);
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("points back to the sign-in page", () => {
    render(<RayaAiForgotPasswordPage />);
    expect(screen.getAllByRole("link", { name: /sign in/i })[0]).toHaveAttribute(
      "href",
      "/admin/ai/login"
    );
  });
});
