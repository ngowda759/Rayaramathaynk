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
/** What the fake API reports as `prompt.currentPromptId`. */
let activePromptId = "";

function installFetchMock() {
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();

    if (method === "DELETE") {
      const versionId = new URL(String(url), "http://localhost").searchParams.get("versionId");
      storedPrompts = storedPrompts.filter((p) => p.id !== versionId);
      return jsonResponse({ versions: storedPrompts, message: "Prompt version deleted successfully" });
    }

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

    return jsonResponse({ versions: storedPrompts, currentPrompt: "", currentPromptId: activePromptId });
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const originalFetch = global.fetch;
const originalPrompt = window.prompt;

beforeEach(() => {
  jest.clearAllMocks();
  storedPrompts = [];
  activePromptId = "";
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

describe("Prompt Manager delete", () => {
  const originalConfirm = window.confirm;

  function signedIn() {
    (useSupabaseSession as jest.Mock).mockReturnValue({
      session: { access_token: "supabase-token-123" },
      loading: false,
    });
  }

  /** Select the prompt in the list, then return the Delete action. */
  async function openDeleteAction(name: string) {
    fireEvent.click(screen.getAllByText(name)[0]);
    return waitFor(() => screen.getByRole("button", { name: /^delete$/i }));
  }

  beforeEach(() => {
    window.confirm = jest.fn(() => true) as unknown as typeof window.confirm;
  });

  afterEach(() => {
    window.confirm = originalConfirm;
  });

  it("asks for confirmation and sends DELETE for only the selected version", async () => {
    storedPrompts = [
      promptRow({ id: "prompt_active", name: "Active prompt", version: 1, status: "published" }),
      promptRow({ id: "prompt_old", name: "Old draft", version: 2 }),
    ];
    signedIn();
    const fetchMock = installFetchMock();

    render(<PromptManagerPage />);
    await waitFor(() => expect(screen.getByText("(2)")).toBeInTheDocument());

    const deleteButton = await openDeleteAction("Old draft");
    fireEvent.click(deleteButton);

    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    const deleteCall = fetchMock.mock.calls.find(
      ([, init]) => (init?.method ?? "").toUpperCase() === "DELETE"
    );
    expect(deleteCall?.[0]).toBe("/api/ai/settings/prompts?versionId=prompt_old");
  });

  it("refreshes the list through adminFetch after a successful delete", async () => {
    storedPrompts = [
      promptRow({ id: "prompt_active", name: "Active prompt", version: 1, status: "published" }),
      promptRow({ id: "prompt_old", name: "Old draft", version: 2 }),
    ];
    signedIn();
    const fetchMock = installFetchMock();

    render(<PromptManagerPage />);
    await waitFor(() => expect(screen.getByText("(2)")).toBeInTheDocument());

    fireEvent.click(await openDeleteAction("Old draft"));

    await waitFor(() => expect(screen.getByText("(1)")).toBeInTheDocument());
    expect(screen.queryByText("Old draft")).not.toBeInTheDocument();

    // The refresh is a real GET on the same adminFetch instance, carrying the
    // bearer token the hook attaches.
    const getCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init?.method ?? "GET").toUpperCase() === "GET"
    );
    expect(getCalls.length).toBeGreaterThanOrEqual(2);
    expect(getCalls[getCalls.length - 1][0]).toBe("/api/ai/settings/prompts");
    const headers = new Headers(getCalls[getCalls.length - 1][1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer supabase-token-123");
  });

  it("does nothing when the confirmation is dismissed", async () => {
    storedPrompts = [promptRow({ id: "prompt_old", name: "Old draft" })];
    signedIn();
    window.confirm = jest.fn(() => false) as unknown as typeof window.confirm;
    const fetchMock = installFetchMock();

    render(<PromptManagerPage />);
    await waitFor(() => expect(screen.getByText("(1)")).toBeInTheDocument());

    fireEvent.click(await openDeleteAction("Old draft"));

    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(
      fetchMock.mock.calls.some(([, init]) => (init?.method ?? "").toUpperCase() === "DELETE")
    ).toBe(false);
    expect(screen.getByText("(1)")).toBeInTheDocument();
  });

  it("keeps the prompt and reports the error when the API rejects the delete", async () => {
    storedPrompts = [promptRow({ id: "prompt_old", name: "Old draft" })];
    signedIn();
    global.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? "").toUpperCase() === "DELETE") {
        return jsonResponse({ error: "This is the active prompt.", reason: "in_use" }, 409);
      }
      return jsonResponse({ versions: storedPrompts, currentPromptId: activePromptId });
    }) as unknown as typeof fetch;

    render(<PromptManagerPage />);
    await waitFor(() => expect(screen.getByText("(1)")).toBeInTheDocument());

    fireEvent.click(await openDeleteAction("Old draft"));

    await waitFor(() =>
      expect(screen.getByText("This is the active prompt.")).toBeInTheDocument()
    );
    expect(screen.getByText("(1)")).toBeInTheDocument();
    expect(screen.getAllByText("Old draft").length).toBeGreaterThan(0);
  });

  it("does not delete the active prompt from the UI", async () => {
    storedPrompts = [promptRow({ id: "prompt_active", name: "Active prompt" })];
    activePromptId = "prompt_active";
    signedIn();
    const fetchMock = installFetchMock();

    render(<PromptManagerPage />);
    await waitFor(() => expect(screen.getByText("(1)")).toBeInTheDocument());

    const deleteButton = await openDeleteAction("Active prompt");
    expect(deleteButton).toBeDisabled();

    fireEvent.click(deleteButton);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some(([, init]) => (init?.method ?? "").toUpperCase() === "DELETE")
    ).toBe(false);
  });
});
