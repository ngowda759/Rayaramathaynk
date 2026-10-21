"use client";

import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useCallback } from "react";

export interface AdminFetchOptions extends RequestInit {
  /**
   * Maximum time (ms) to wait for the request before aborting.
   * Defaults to 15s so a stalled endpoint can never leave the UI spinning
   * forever. Set to 0 to disable the timeout.
   */
  timeoutMs?: number;
}

/** Synthetic status codes for failures that happen before/around the network.
 *  Statuses must stay within the valid `Response` range (200–599). */
export const ADMIN_FETCH_STATUS = {
  AUTH_INITIALIZING: 503,
  NO_USER: 401,
  TOKEN_FAILED: 401,
  TIMEOUT: 408,
} as const;

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Admin fetch that attaches a fresh Supabase Auth access token to every request.
 *
 * Raya AI administration authenticates with Supabase Auth (the temple's other
 * admin pages still use Firebase). The session cookie set by `@supabase/ssr` is
 * sent automatically to same-origin route handlers; the access token is also
 * attached as `Authorization: Bearer` so the server guard can verify it
 * explicitly and so non-cookie callers work the same way.
 *
 * - Waits for the session to finish initializing before firing a request, so a
 *   protected call is never sent without a token.
 * - Preserves the caller's method, headers and body.
 * - Always returns a real `Response` (including for pre-network failures) so
 *   callers can inspect `status`/`ok` uniformly.
 * - Enforces a bounded timeout to prevent indefinite loading states.
 */
export function useAdminFetch() {
  const { session, loading } = useSupabaseSession();

  const adminFetch = useCallback(
    async (input: RequestInfo | URL, init?: AdminFetchOptions): Promise<Response> => {
      // Authentication has not finished initializing yet. Do not issue the
      // request unauthenticated; report it as a retryable "initializing" state.
      if (loading) {
        return jsonResponse(ADMIN_FETCH_STATUS.AUTH_INITIALIZING, {
          error: "Authentication is still initializing. Please retry.",
          reason: "auth_initializing",
        });
      }

      const token = session?.access_token;
      if (!session || !token) {
        return jsonResponse(ADMIN_FETCH_STATUS.NO_USER, {
          error: "No authenticated user found.",
          reason: "no_user",
        });
      }

      const { timeoutMs = 15000, ...requestInit } = init ?? {};
      const headers = new Headers(requestInit.headers);
      headers.set("Authorization", `Bearer ${token}`);

      const controller = new AbortController();
      let timedOut = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      if (timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);
      }

      // Propagate an externally supplied abort signal to our controller.
      const externalSignal = requestInit.signal;
      const onExternalAbort = () => controller.abort();
      if (externalSignal) {
        if (externalSignal.aborted) {
          controller.abort();
        } else {
          externalSignal.addEventListener("abort", onExternalAbort, { once: true });
        }
      }

      try {
        return await fetch(input, {
          ...requestInit,
          headers,
          signal: controller.signal,
        });
      } catch (error) {
        if (timedOut) {
          return jsonResponse(ADMIN_FETCH_STATUS.TIMEOUT, {
            error: `Request timed out after ${timeoutMs}ms.`,
            reason: "timeout",
          });
        }
        // Re-throw genuine aborts so callers can distinguish cancellation.
        throw error;
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (externalSignal) {
          externalSignal.removeEventListener("abort", onExternalAbort);
        }
      }
    },
    [session, loading]
  );

  return adminFetch;
}
