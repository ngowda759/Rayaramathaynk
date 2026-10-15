// Shared health-check classification for the AI Health dashboard.
//
// The dashboard must never confuse an authentication failure with a
// connectivity failure, nor report inaccessible data as "missing". This module
// centralises that classification so both the UI and the tests agree.

export type HealthStatus = "healthy" | "warning" | "error";

export type HealthCategory =
  | "ok"
  | "auth"
  | "forbidden"
  | "server"
  | "connectivity"
  | "missing-data"
  | "partial-data";

export interface HealthClassification {
  status: HealthStatus;
  category: HealthCategory;
  message: string;
  /** Short, safe diagnostic detail (never contains tokens or secrets). */
  details?: string;
}

const AUTH_REASONS = new Set([
  "no_user",
  "token_failed",
  "missing_token",
  "expired_token",
  "invalid_token",
  "auth_initializing",
]);

const ROLE_REASONS = new Set([
  "user_not_found",
  "inactive_user",
  "insufficient_role",
]);

/**
 * Classify an HTTP response for the health dashboard.
 *
 * @param httpStatus HTTP status code returned by the endpoint.
 * @param reason     Optional machine-readable reason from the API body.
 * @param latencyMs  Measured round-trip latency.
 */
export function classifyHttpResult(
  httpStatus: number,
  reason: string | undefined,
  latencyMs: number
): HealthClassification {
  const latency = `Latency: ${latencyMs}ms`;

  if (httpStatus === 0) {
    return {
      status: "error",
      category: "connectivity",
      message: "Could not reach the endpoint (authentication not ready or network error).",
      details: latency,
    };
  }

  if (httpStatus === 401 || AUTH_REASONS.has(reason || "")) {
    return {
      status: "error",
      category: "auth",
      message: "Authentication failed (HTTP 401). The request was not authorized.",
      details: `HTTP 401 · ${reason ?? "unauthorized"} · ${latency}`,
    };
  }

  if (httpStatus === 403 || ROLE_REASONS.has(reason || "")) {
    return {
      status: "error",
      category: "forbidden",
      message: "Permission denied (HTTP 403). The account lacks administrator access.",
      details: `HTTP 403 · ${reason ?? "forbidden"} · ${latency}`,
    };
  }

  if (httpStatus === 503 || reason === "auth_unavailable") {
    return {
      status: "error",
      category: "server",
      message: "Server authentication is unavailable (server credentials not configured).",
      details: `HTTP ${httpStatus} · ${latency}`,
    };
  }

  if (httpStatus >= 500) {
    return {
      status: "error",
      category: "server",
      message: `Server error (HTTP ${httpStatus}).`,
      details: latency,
    };
  }

  if (httpStatus === 408) {
    return {
      status: "error",
      category: "connectivity",
      message: "Request timed out.",
      details: latency,
    };
  }

  if (httpStatus >= 400) {
    return {
      status: "error",
      category: "server",
      message: `Request failed (HTTP ${httpStatus}).`,
      details: latency,
    };
  }

  return {
    status: "healthy",
    category: "ok",
    message: `OK (${latencyMs}ms)`,
    details: latency,
  };
}

/** Classify a thrown fetch error (network failure / timeout / abort). */
export function classifyFetchError(error: unknown): HealthClassification {
  const message = error instanceof Error ? error.message : "Unknown error";
  const isTimeout =
    (error as { name?: string })?.name === "AbortError" ||
    /timeout/i.test(message);
  return {
    status: "error",
    category: "connectivity",
    message: isTimeout
      ? "Request timed out before the endpoint responded."
      : "Could not reach the endpoint (network error).",
    details: message,
  };
}

export interface SettingsPresenceInput {
  /** True when the HTTP request for the section succeeded. */
  ok: boolean;
  /** HTTP status (0 when the request never completed). */
  httpStatus: number;
  /** Parsed payload, when available. */
  payload?: unknown;
}

export interface DataIntegrityResult {
  status: HealthStatus;
  category: HealthCategory;
  message: string;
  details: string;
}

/**
 * Distinguish genuinely missing data from data that simply could not be read
 * because the request was unauthorized or failed.
 */
export function classifyDataIntegrity(
  sections: Record<string, SettingsPresenceInput>
): DataIntegrityResult {
  const names = Object.keys(sections);
  const inaccessible = names.filter(
    (n) => !sections[n].ok || sections[n].httpStatus >= 400
  );
  const missing = names.filter(
    (n) => sections[n].ok && isEmptyPayload(sections[n].payload)
  );
  const present = names.filter(
    (n) => sections[n].ok && !isEmptyPayload(sections[n].payload)
  );

  if (inaccessible.length > 0) {
    const unauthorized = inaccessible.some(
      (n) => sections[n].httpStatus === 401 || sections[n].httpStatus === 403
    );
    return {
      status: "error",
      category: unauthorized ? "auth" : "server",
      message: unauthorized
        ? "Settings data could not be read because the requests were unauthorized."
        : "Settings data could not be read because some requests failed.",
      details: `Unreadable: ${inaccessible.join(", ")}`,
    };
  }

  if (missing.length > 0 && present.length > 0) {
    return {
      status: "warning",
      category: "partial-data",
      message: `${missing.length} of ${names.length} settings sections are empty.`,
      details: `Missing: ${missing.join(", ")}`,
    };
  }

  if (missing.length > 0) {
    return {
      status: "warning",
      category: "missing-data",
      message: "No settings data found. Use Initialize Data on the AI Settings page.",
      details: `Missing: ${missing.join(", ")}`,
    };
  }

  return {
    status: "healthy",
    category: "ok",
    message: "All settings data loaded",
    details: names.join(", "),
  };
}

function isEmptyPayload(payload: unknown): boolean {
  if (payload === null || payload === undefined) return true;
  if (typeof payload === "string") return payload.trim().length === 0;
  if (Array.isArray(payload)) return payload.length === 0;
  if (typeof payload === "object") return Object.keys(payload as object).length === 0;
  return false;
}

export { isEmptyPayload };
