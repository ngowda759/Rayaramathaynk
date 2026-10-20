"use client";

import { useAuth } from "@/hooks/useAuth";
import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

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
 * Admin fetch that attaches a fresh Firebase ID token to every request.
 *
 * - Waits for the auth context to finish initializing before firing a request,
 *   so a protected call is never sent without a token.
 * - Retrieves the ID token from Supabase session (which transparently refreshes
 *   an expired token) and sends it as `Authorization: Bearer <token>`.
 * - Preserves the caller's method, headers and body.
 * - Always returns a real `Response` (including for pre-network failures) so
 *   callers can inspect `status`/`ok` uniformly.
 * - Enforces a bounded timeout to prevent indefinite loading states.
 */
export function useAdminFetch() {
  const { user, loading } = useAuth();

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

      if (!user) {
        return jsonResponse(ADMIN_FETCH_STATUS.NO_USER, {
          error: "No authenticated user found.",
          reason: "no_user",
        });
      }

      let token: string;
      try {
        const supabase = createClient();
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          throw error || new Error("No active session");
        }
        token = session.access_token;
      } catch (error) {
        console.error("Failed to get session token for adminFetch:", error);
        return jsonResponse(ADMIN_FETCH_STATUS.TOKEN_FAILED, {
          error: "Failed to retrieve authentication token.",
          reason: "token_failed",
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
    [user, loading]
  );

  return adminFetch;
}
