/**
 * The Raya AI sign-in form's behaviour, with the Supabase client stubbed.
 *
 * These are the reported production symptoms: a rejected credential, an
 * unconfirmed email, an unconfigured deployment, and a transport failure. Each
 * must produce a *different* message - the bug was that all of them read
 * "Invalid email or password."
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockReplace = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockGetSession = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}));

import RayaAiLoginPage from "@/app/admin/ai/login/page";

const REAL_URL = "https://abcdefghijklmnop.supabase.co";
const REAL_KEY = "eyJhbGciOi.real.key";
const originalEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

function configureSupabase() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = REAL_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = REAL_KEY;
}

beforeEach(() => {
  mockReplace.mockReset();
  mockSignInWithPassword.mockReset();
  mockGetSession.mockReset().mockResolvedValue({ data: { session: null } });
  configureSupabase();
});

afterEach(() => {
  if (originalEnv.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.url;
  if (originalEnv.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.key;
});

async function submitCredentials() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.org" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter2hunter2" } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("Raya AI login — credential failure", () => {
  it("shows the shared message for invalid credentials", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { code: "invalid_credentials", message: "Invalid login credentials", status: 400 },
    });
    render(<RayaAiLoginPage />);
    await submitCredentials();
    expect(await screen.findByTestId("raya-auth-error")).toHaveTextContent("Invalid email or password.");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not call the server when the deployment is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    render(<RayaAiLoginPage />);
    await submitCredentials();
    expect(await screen.findByTestId("raya-auth-error")).toHaveTextContent(/not configured/i);
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("does not report an unconfirmed email as a bad password", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { code: "email_not_confirmed", message: "Email not confirmed", status: 400 },
    });
    render(<RayaAiLoginPage />);
    await submitCredentials();
    const alert = await screen.findByTestId("raya-auth-error");
    expect(alert).toHaveTextContent(/not been confirmed/i);
    expect(alert).not.toHaveTextContent("Invalid email or password.");
  });

  it("reports a rate limit distinctly", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { code: "over_request_rate_limit", message: "Too many requests", status: 429 },
    });
    render(<RayaAiLoginPage />);
    await submitCredentials();
    expect(await screen.findByTestId("raya-auth-error")).toHaveTextContent(/too many attempts/i);
  });

  it("reports a transport failure instead of blaming the password", async () => {
    mockSignInWithPassword.mockRejectedValue(
      Object.assign(new Error("Failed to fetch"), { name: "AuthRetryableFetchError", status: 0 })
    );
    render(<RayaAiLoginPage />);
    await submitCredentials();
    const alert = await screen.findByTestId("raya-auth-error");
    expect(alert).toHaveTextContent(/could not reach/i);
    expect(alert).not.toHaveTextContent("Invalid email or password.");
  });
});

describe("Raya AI login — success and recovery entry", () => {
  it("navigates to the console on success", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: { access_token: "t" } },
      error: null,
    });
    render(<RayaAiLoginPage />);
    await submitCredentials();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/admin/ai"));
  });

  it("links to the password-recovery page", () => {
    render(<RayaAiLoginPage />);
    expect(screen.getByRole("link", { name: /forgot password/i })).toHaveAttribute(
      "href",
      "/admin/ai/forgot-password"
    );
  });
});
