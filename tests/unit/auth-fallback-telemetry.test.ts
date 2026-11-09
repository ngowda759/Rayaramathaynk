import { recordAuthFallback, FallbackTelemetryPayload } from "@/lib/auth/fallback-telemetry";

describe("Fallback Telemetry Instrumentation", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("emits a structured log prefixed with [telemetry:auth_fallback]", () => {
    recordAuthFallback("admin-auth", "verified");

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logCall = consoleSpy.mock.calls[0][0] as string;
    expect(logCall.startsWith("[telemetry:auth_fallback]")).toBe(true);

    const jsonPart = logCall.replace("[telemetry:auth_fallback] ", "");
    const parsed = JSON.parse(jsonPart) as FallbackTelemetryPayload;

    expect(parsed.event).toBe("auth_fallback_invoked");
    expect(parsed.provider).toBe("firebase");
    expect(parsed.source).toBe("admin-auth");
    expect(parsed.status).toBe("verified");
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("supports set-role and verify-id-token sources", () => {
    recordAuthFallback("verify-id-token", "verified");
    recordAuthFallback("set-role", "identity_resolved");

    expect(consoleSpy).toHaveBeenCalledTimes(2);

    const log1 = (consoleSpy.mock.calls[0][0] as string).replace("[telemetry:auth_fallback] ", "");
    const parsed1 = JSON.parse(log1) as FallbackTelemetryPayload;
    expect(parsed1.source).toBe("verify-id-token");
    expect(parsed1.status).toBe("verified");

    const log2 = (consoleSpy.mock.calls[1][0] as string).replace("[telemetry:auth_fallback] ", "");
    const parsed2 = JSON.parse(log2) as FallbackTelemetryPayload;
    expect(parsed2.source).toBe("set-role");
    expect(parsed2.status).toBe("identity_resolved");
  });

  it("SECURITY GUARANTEE: never contains tokens, passwords, secrets, headers, or PII", () => {
    recordAuthFallback("admin-auth", "verified");

    const logCall = consoleSpy.mock.calls[0][0] as string;
    const jsonPart = logCall.replace("[telemetry:auth_fallback] ", "");
    const parsed = JSON.parse(jsonPart);

    // Forbidden keys
    const forbiddenKeys = [
      "token",
      "accessToken",
      "idToken",
      "refreshToken",
      "password",
      "secret",
      "authorization",
      "cookie",
      "uid",
      "email",
      "phone",
      "name",
    ];

    for (const key of forbiddenKeys) {
      expect(parsed).not.toHaveProperty(key);
    }

    // Verify string representation doesn't contain sensitive markers
    expect(logCall).not.toMatch(/bearer/i);
    expect(logCall).not.toMatch(/password/i);
    expect(logCall).not.toMatch(/@/); // No email format
  });

  it("FAIL-SAFE GUARANTEE: suppresses any logging error without throwing", () => {
    consoleSpy.mockImplementation(() => {
      throw new Error("Console logging failed");
    });

    // Must not throw
    expect(() => {
      recordAuthFallback("admin-auth", "verified");
    }).not.toThrow();
  });
});
