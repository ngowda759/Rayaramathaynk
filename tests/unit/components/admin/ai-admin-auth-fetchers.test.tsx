import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useSupabaseSession } from "@/hooks/useSupabaseSession";

jest.mock("@/hooks/useSupabaseSession");

jest.mock("@/components/admin/common/AdminPageHeader", () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/services/chat.service", () => ({
  getPendingTestimonials: jest.fn(async () => []),
  getVolunteerRequests: jest.fn(async () => []),
}));

import AdminAIPage from "@/app/admin/ai/page";
import IntentManagerPage from "@/app/admin/ai/intents/page";
import UnknownQuestionsPage from "@/app/admin/ai/unknown-questions/page";
import KnowledgeCoveragePage from "@/app/admin/ai/knowledge/page";

/**
 * Regression coverage for the admin AI loaders that run on mount.
 *
 * `useAdminFetch` returns a fetcher whose identity is `[session, loading]`, and
 * it answers a synthetic 503 (`auth_initializing`) without touching the network
 * while Supabase Auth is still resolving. A loader memoized with an incomplete
 * dependency array captures the fetcher from the first render and keeps calling
 * it forever, so the page settles on its empty state even after the session
 * arrives.
 *
 * Every test below mounts the page in the pre-auth state, then resolves the
 * session. Against the old implementations the data never appears.
 */

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Routes requests to a per-endpoint handler and records the auth headers. */
function installFetchMock(routes: Record<string, unknown>) {
  const fetchMock = jest.fn(async (url: string) => {
    const path = String(url).split("?")[0];
    const body = routes[path];
    if (body === undefined) return jsonResponse({ error: "not found" }, 404);
    return jsonResponse(typeof body === "function" ? (body as () => unknown)() : body);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const originalFetch = global.fetch;

const AUTHENTICATED = { session: { access_token: "supabase-token-123" }, loading: false };
const INITIALIZING = { session: null, loading: true };

/**
 * Mounts pre-auth, then resolves the session, mirroring a real page load.
 * A fresh element is rendered on the second pass: re-rendering the identical
 * element object lets React bail out, so the session change would be ignored.
 */
async function renderThenAuthenticate(Page: () => React.ReactElement) {
  (useSupabaseSession as jest.Mock).mockReturnValue(INITIALIZING);
  const { rerender } = render(<Page />);

  // Let the pre-auth load settle (it resolves to the synthetic 503) before the
  // session arrives, exactly as a real `getSession()` round trip would.
  await act(async () => {
    await Promise.resolve();
  });

  (useSupabaseSession as jest.Mock).mockReturnValue(AUTHENTICATED);
  await act(async () => {
    rerender(<Page />);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("admin AI loaders refresh after auth initialization", () => {
  it("admin dashboard: knowledge coverage appears once the session resolves", async () => {
    installFetchMock({
      "/api/ai/knowledge/coverage": {
        success: true,
        data: { summary: { total: 12, present: 12, missing: 0, percentage: 100 } },
      },
      "/api/ai/analytics/conversations": { totalConversations: 42, todayConversations: 3 },
    });

    await renderThenAuthenticate(AdminAIPage);

    await waitFor(() =>
      expect(screen.getByText(/Knowledge Base: 100% Complete/)).toBeInTheDocument()
    );
    expect(screen.getByText("12 of 12 categories configured")).toBeInTheDocument();
  });

  it("intents: the intent list appears once the session resolves", async () => {
    installFetchMock({
      "/api/ai/settings/intents": {
        intents: [
          {
            id: "temple_timings",
            name: "Temple Timings",
            description: "Opening hours",
            status: "enabled",
            keywords: [{ keyword: "timings", weight: 1 }],
            examples: [],
            confidence: 0.9,
            usageCount: 4,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    });

    await renderThenAuthenticate(IntentManagerPage);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Temple Timings" })).toBeInTheDocument()
    );
    expect(screen.queryByText("No intents found")).not.toBeInTheDocument();
  });

  it("unknown questions: the question list appears once the session resolves", async () => {
    installFetchMock({
      "/api/ai/settings/unknown-questions": {
        questions: [
          {
            id: "q1",
            question: "Where can I park my car?",
            status: "pending",
            count: 2,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    });

    await renderThenAuthenticate(UnknownQuestionsPage);

    await waitFor(() =>
      expect(screen.getByText("Where can I park my car?")).toBeInTheDocument()
    );
    expect(screen.queryByText("No questions found")).not.toBeInTheDocument();
  });

  it("knowledge coverage: summary renders once the session resolves", async () => {
    installFetchMock({
      "/api/ai/knowledge/coverage": {
        success: true,
        data: {
          coverage: [
            { id: "temple", title: "Temple", status: "present" },
          ],
          summary: { total: 12, present: 9, missing: 3, percentage: 75 },
          lastChecked: "2026-11-20T00:00:00.000Z",
        },
      },
    });

    await renderThenAuthenticate(KnowledgeCoveragePage);

    await waitFor(() => expect(screen.getByText("Total Categories")).toBeInTheDocument());
    expect(screen.getByText("9")).toBeInTheDocument();
  });
});
