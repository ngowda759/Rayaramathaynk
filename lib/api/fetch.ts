/**
 * Browser JSON client for the application's own route handlers.
 *
 * The browser never talks to Supabase with the service role. Service modules that
 * used to read/write deny-all tables directly now call the matching `/api/...`
 * route, which re-verifies the caller. Every call attaches the signed-in user's
 * Firebase ID token as a Bearer header so the route guard can verify it.
 *
 * A non-2xx answer becomes an {@link ApiError} carrying the status and the
 * server's message, so callers can distinguish a real failure from an empty
 * result instead of silently swallowing it.
 */

import { getAuthToken } from "./auth-token";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface ApiFetchInit {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** When false, no Authorization header is sent (public endpoints). */
  auth?: boolean;
}

export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (init.auth !== false) {
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const hasBody = init.body !== undefined;
  if (hasBody) headers["Content-Type"] = "application/json";

  const response = await fetch(path, {
    method: init.method ?? "GET",
    headers,
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const parsed = (await response.json()) as { error?: unknown; message?: unknown };
      const raw = parsed.error ?? parsed.message;
      if (typeof raw === "string" && raw) message = raw;
    } catch {
      // Non-JSON error body; keep the status-based message.
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
