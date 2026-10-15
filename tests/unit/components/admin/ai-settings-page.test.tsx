import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockAdminFetch = jest.fn();

jest.mock("@/hooks/useAdminFetch", () => ({
  useAdminFetch: () => mockAdminFetch,
  ADMIN_FETCH_STATUS: {
    AUTH_INITIALIZING: 503,
    NO_USER: 401,
    TOKEN_FAILED: 401,
    TIMEOUT: 408,
  },
}));

jest.mock("@/components/admin/common/AdminPageHeader", () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import AISettingsPage from "@/app/admin/ai/settings/page";

const SECTION_PAYLOAD: Record<string, unknown> = {
  "/api/ai/settings/temple-information": { timings: { morning: "6am" } },
  "/api/ai/settings/visitor-information": { guidelines: "welcome" },
  "/api/ai/settings/policies": { dressCode: "traditional" },
  "/api/ai/settings/ai-responses": { greeting: "Namaste" },
  "/api/ai/settings/ai-behavior": { confidence: 0.7 },
};

function okResponse(payload: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AI Settings page", () => {
  it("renders settings once all five endpoints succeed", async () => {
    mockAdminFetch.mockImplementation((url: string) => okResponse(SECTION_PAYLOAD[url]));

    render(<AISettingsPage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "AI Settings" })).toBeInTheDocument()
    );
    expect(mockAdminFetch).toHaveBeenCalledTimes(5);
    // No error banner when everything loads.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stops loading and shows an actionable error when an endpoint fails", async () => {
    mockAdminFetch.mockImplementation((url: string) => {
      if (url === "/api/ai/settings/policies") {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Unauthorized", reason: "expired_token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      return okResponse(SECTION_PAYLOAD[url]);
    });

    render(<AISettingsPage />);

    // Loading must end (no infinite spinner) and an error must be visible.
    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/session has expired/i);
    expect(alert.textContent).toMatch(/policies/i);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("shows a full-page error with Retry when every endpoint fails", async () => {
    mockAdminFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "No authenticated user", reason: "no_user" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    render(<AISettingsPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/not signed in/i);
    const retry = screen.getByRole("button", { name: /retry/i });

    // Retry should re-issue the requests.
    mockAdminFetch.mockClear();
    fireEvent.click(retry);
    await waitFor(() => expect(mockAdminFetch).toHaveBeenCalledTimes(5));
  });

  it("recovers when Retry succeeds after a failure", async () => {
    let fail = true;
    mockAdminFetch.mockImplementation((url: string) => {
      if (fail) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Server error", reason: "auth_unavailable" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      return okResponse(SECTION_PAYLOAD[url]);
    });

    render(<AISettingsPage />);
    await screen.findByRole("alert");

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    );
    expect(screen.getByRole("heading", { name: "AI Settings" })).toBeInTheDocument();
  });
});
