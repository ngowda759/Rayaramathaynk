import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useSupabaseSession } from "@/hooks/useSupabaseSession";

jest.mock("@/hooks/useSupabaseSession");

jest.mock("@/components/admin/common/AdminPageHeader", () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import PromptManagerPage from "@/app/admin/ai/prompts/page";

/**
 * Regression coverage for the prompt manager list.
 *
 * The page loads its list from `/api/ai/settings/prompts` through
 * `useAdminFetch`, which refuses to issue a request until Supabase Auth has
 * finished initializing (it answers a synthetic 503 while `loading` is true).
 * Because `loadPrompts` omitted `adminFetch` from its `useCallback` dependencies,
 * the effect kept calling the fetcher captured on the first render — the one
 * belonging to the still-initializing auth state. Every load therefore returned
 * the synthetic 503, `data.versions` was `undefined`, and the page rendered
 * "Prompts (0) / No prompts yet" even though the prompt existed in the database.
 */

interface PromptRow {
  id: string;
  name: string;
  version: number;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

function promptRow(overrides: Partial<PromptRow> = {}): PromptRow {
  return {
    id: "prompt_v1_1",
    name: "Production system prompt",
    version: 1,
    content: "# New Prompt",
    status: "draft",
    createdAt: "2026-11-20T05:57:26.875Z",
    updatedAt: "2026-11-20T05:57:26.875Z",
    createdBy: "admin-uid",
    ...overrides,
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The in-memory prompt table the fake API reads from and appends to. */
let storedPrompts: PromptRow[] = [];

function installFetchMock() {
  const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();

    if (method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { name?: string };
      const created = promptRow({
        id: `prompt_v${storedPrompts.length + 1}_new`,
        name: body.name ?? "New Prompt",
        version: storedPrompts.length + 1,
      });
      storedPrompts = [...storedPrompts, created];
      return jsonResponse({
        versionId: created.id,
        name: created.name,
        message: `Prompt "${created.name}" created successfully`,
      });
    }

    return jsonResponse({ versions: storedPrompts, currentPrompt: "", currentPromptId: "" });
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const originalFetch = global.fetch;
const originalPrompt = window.prompt;

beforeEach(() => {
  jest.clearAllMocks();
  storedPrompts = [];
  installFetchMock();
  // `handleCreateNew` collects the name through `window.prompt`.
  window.prompt = jest.fn(() => "Production system prompt") as unknown as typeof window.prompt;
});

afterAll(() => {
  global.fetch = originalFetch;
  window.prompt = originalPrompt;
});

describe("Prompt Manager list", () => {
  it("shows prompts once authentication resolves (not a permanent empty list)", async () => {
    storedPrompts = [promptRow()];

    // Start in the pre-auth state, exactly like a first render before
    // `supabase.auth.getSession()` has resolved.
    (useSupabaseSession as jest.Mock).mockReturnValue({ session: null, loading: true });

    const { rerender } = render(<PromptManagerPage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Prompt Manager" })).toBeInTheDocument()
    );

    // Auth resolves; `useAdminFetch` now returns a fetcher that can send a token.
    (useSupabaseSession as jest.Mock).mockReturnValue({
      session: { access_token: "supabase-token-123" },
      loading: false,
    });
    rerender(<PromptManagerPage />);

    await waitFor(() => expect(screen.getByText("(1)")).toBeInTheDocument());
    expect(screen.getAllByText("Production system prompt").length).toBeGreaterThan(0);
    expect(screen.queryByText("No prompts yet")).not.toBeInTheDocument();
  });

  it("lists a newly created prompt after the refetch", async () => {
    (useSupabaseSession as jest.Mock).mockReturnValue({
      session: { access_token: "supabase-token-123" },
      loading: false,
    });

    render(<PromptManagerPage />);

    // Empty to start with.
    await waitFor(() => expect(screen.getByText("No prompts yet")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /new/i }));

    await waitFor(() => expect(screen.getByText("(1)")).toBeInTheDocument());
    expect(screen.getAllByText("Production system prompt").length).toBeGreaterThan(0);
    expect(screen.queryByText("No prompts yet")).not.toBeInTheDocument();
  });
});
