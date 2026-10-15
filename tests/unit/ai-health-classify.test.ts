import {
  classifyHttpResult,
  classifyFetchError,
  classifyDataIntegrity,
  isEmptyPayload,
} from "../../lib/ai/health-classify";

describe("classifyHttpResult", () => {
  it("reports a 2xx response as healthy", () => {
    const result = classifyHttpResult(200, undefined, 42);
    expect(result.status).toBe("healthy");
    expect(result.category).toBe("ok");
    expect(result.message).toContain("42ms");
  });

  it("reports a 401 as an authentication failure, never connectivity", () => {
    const result = classifyHttpResult(401, undefined, 10);
    expect(result.status).toBe("error");
    expect(result.category).toBe("auth");
    expect(result.message).toMatch(/authentication/i);
  });

  it("reports a token-failure reason as authentication even with an odd status", () => {
    const result = classifyHttpResult(500, "token_failed", 5);
    expect(result.category).toBe("auth");
  });

  it("reports a 403 / role reason as a permission failure", () => {
    expect(classifyHttpResult(403, undefined, 5).category).toBe("forbidden");
    expect(classifyHttpResult(200, "insufficient_role", 5).category).toBe(
      "forbidden"
    );
  });

  it("reports a 503 as a server failure (server credentials unavailable)", () => {
    const result = classifyHttpResult(503, "auth_unavailable", 5);
    expect(result.category).toBe("server");
  });

  it("reports a 500 as a server error", () => {
    const result = classifyHttpResult(500, undefined, 5);
    expect(result.category).toBe("server");
  });

  it("reports a 408 as a connectivity failure", () => {
    const result = classifyHttpResult(408, undefined, 5);
    expect(result.category).toBe("connectivity");
  });

  it("never labels a 401 as a connectivity failure", () => {
    const result = classifyHttpResult(401, undefined, 5);
    expect(result.message).not.toMatch(/connect/i);
    expect(result.category).not.toBe("connectivity");
  });
});

describe("classifyFetchError", () => {
  it("classifies a timeout/abort as connectivity", () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    expect(classifyFetchError(abort).category).toBe("connectivity");
    expect(classifyFetchError(abort).message).toMatch(/timed out/i);
  });

  it("classifies a network error as connectivity", () => {
    expect(classifyFetchError(new Error("Failed to fetch")).category).toBe(
      "connectivity"
    );
  });
});

describe("isEmptyPayload", () => {
  it("treats null/undefined/empty containers as empty", () => {
    expect(isEmptyPayload(null)).toBe(true);
    expect(isEmptyPayload(undefined)).toBe(true);
    expect(isEmptyPayload("")).toBe(true);
    expect(isEmptyPayload([])).toBe(true);
    expect(isEmptyPayload({})).toBe(true);
  });

  it("treats populated values as non-empty", () => {
    expect(isEmptyPayload({ a: 1 })).toBe(false);
    expect(isEmptyPayload("x")).toBe(false);
    expect(isEmptyPayload([1])).toBe(false);
  });
});

describe("classifyDataIntegrity", () => {
  it("reports healthy when every section loaded with data", () => {
    const result = classifyDataIntegrity({
      Temple: { ok: true, httpStatus: 200, payload: { timings: {} } },
      Visitor: { ok: true, httpStatus: 200, payload: { guidelines: "x" } },
    });
    expect(result.status).toBe("healthy");
    expect(result.category).toBe("ok");
  });

  it("distinguishes inaccessible (401) data from genuinely missing data", () => {
    const result = classifyDataIntegrity({
      Temple: { ok: false, httpStatus: 401 },
      Visitor: { ok: false, httpStatus: 401 },
    });
    expect(result.status).toBe("error");
    expect(result.category).toBe("auth");
    expect(result.message).toMatch(/unauthorized/i);
    expect(result.message).not.toMatch(/missing/i);
  });

  it("distinguishes a server failure from missing data", () => {
    const result = classifyDataIntegrity({
      Temple: { ok: false, httpStatus: 500 },
      Visitor: { ok: true, httpStatus: 200, payload: { guidelines: "x" } },
    });
    expect(result.category).toBe("server");
  });

  it("warns when data is genuinely missing (all sections empty)", () => {
    const result = classifyDataIntegrity({
      Temple: { ok: true, httpStatus: 200, payload: null },
      Visitor: { ok: true, httpStatus: 200, payload: {} },
    });
    expect(result.status).toBe("warning");
    expect(result.category).toBe("missing-data");
  });

  it("warns when only some sections are missing", () => {
    const result = classifyDataIntegrity({
      Temple: { ok: true, httpStatus: 200, payload: { timings: {} } },
      Visitor: { ok: true, httpStatus: 200, payload: null },
    });
    expect(result.status).toBe("warning");
    expect(result.category).toBe("partial-data");
  });
});
