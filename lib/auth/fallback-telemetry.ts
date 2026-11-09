/**
 * Fallback Telemetry Instrumentation
 *
 * Emits structured, aggregate-oriented telemetry log events whenever
 * an authentication fallback path is exercised.
 *
 * Privacy & Security Guarantees:
 * - NO access tokens, ID tokens, or refresh tokens.
 * - NO passwords, client secrets, or service-role keys.
 * - NO cookies or raw Authorization headers.
 * - NO user emails, phone numbers, or user IDs (zero PII).
 * - Format is standardized JSON prefixed with `[telemetry:auth_fallback]` for reliable parsing.
 */

export interface FallbackTelemetryPayload {
  event: "auth_fallback_invoked";
  provider: "firebase";
  source: "verify-id-token" | "admin-auth" | "set-role";
  status: "verified" | "identity_resolved";
  timestamp: string;
}

export function recordAuthFallback(
  source: FallbackTelemetryPayload["source"],
  status: FallbackTelemetryPayload["status"] = "verified"
): void {
  const payload: FallbackTelemetryPayload = {
    event: "auth_fallback_invoked",
    provider: "firebase",
    source,
    status,
    timestamp: new Date().toISOString(),
  };

  // Structured logging for Vercel / log aggregation
  console.info(`[telemetry:auth_fallback] ${JSON.stringify(payload)}`);
}
