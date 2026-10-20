/**
 * Browser HTTP client for the seva API. Every call carries the Firebase ID token as a Bearer header and, from a
 * registered counter PC, the `x-seva-device` header. Every failure becomes a SevaClientError:
 * - the server's `{ error: { code, message, detail? } }` keeps its code and HTTP status;
 * - no answer in time -> code 'timeout', status 0; no connection -> 'network', status 0; the caller's own abort
 *   -> 'aborted', status 0 (the counter's submitter retries only timeout, network and 5xx).
 * Only same-origin `/api/seva/` paths are called, so the token never leaves the site.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const SEVA_API_PREFIX = "/api/seva/";

export class SevaClientError extends Error {
  code: string;
  status: number;
  detail?: Record<string, unknown>;

  constructor(code: string, status: number, message: string, detail?: Record<string, unknown>) {
    super(message);
    this.name = "SevaClientError";
    this.code = code;
    this.status = status;
    if (detail) this.detail = detail;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorFromBody(text: string, status: number): SevaClientError {
  try {
    const parsed: unknown = JSON.parse(text);
    const error = isRecord(parsed) ? parsed.error : undefined;
    if (isRecord(error) && typeof error.code === "string" && typeof error.message === "string") {
      return new SevaClientError(error.code, status, error.message, isRecord(error.detail) ? error.detail : undefined);
    }
  } catch {
    // Not our JSON error shape; fall through.
  }
  return new SevaClientError("http_error", status, `The office server answered with an error (${status}). Try again.`);
}

export async function sevaFetch<T>(
  path: string,
  init: {
    method?: "GET" | "POST" | "PUT";
    body?: unknown;
    token: string;
    deviceHeader?: string | null;
    timeoutMs?: number;
    signal?: AbortSignal;
  },
): Promise<T> {
  if (!path.startsWith(SEVA_API_PREFIX)) {
    throw new Error(`sevaFetch only calls ${SEVA_API_PREFIX} routes.`);
  }

  const headers: Record<string, string> = { Accept: "application/json", Authorization: `Bearer ${init.token}` };
  if (init.deviceHeader) headers["x-seva-device"] = init.deviceHeader;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, init.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  else init.signal?.addEventListener("abort", forwardAbort, { once: true });

  try {
    let response: Response;
    let text: string;
    try {
      response = await fetch(path, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        cache: "no-store",
        signal: controller.signal,
      });
      text = await response.text();
    } catch {
      if (timedOut) throw new SevaClientError("timeout", 0, "The office server took too long to answer.");
      if (init.signal?.aborted) throw new SevaClientError("aborted", 0, "The request was stopped.");
      throw new SevaClientError("network", 0, "No connection to the office server.");
    }

    if (!response.ok) throw errorFromBody(text, response.status);
    if (text.trim() === "") return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new SevaClientError("bad_response", response.status, "The office server sent an answer that could not be read.");
    }
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", forwardAbort);
  }
}
