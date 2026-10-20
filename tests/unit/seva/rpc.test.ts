/**
 * @jest-environment node
 */
import { SevaError } from "@/lib/seva/errors";
import { rateLimit } from "@/lib/seva/server/rate-limit";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";
import { callRpc } from "@/lib/seva/server/rpc";

jest.mock("server-only", () => ({}), { virtual: true });

const mockRpc = jest.fn();
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }) }));

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  errorSpy.mockRestore();
});

async function caught(promise: Promise<unknown>): Promise<SevaError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof SevaError) return error;
    throw error;
  }
  throw new Error("expected a SevaError");
}

describe("callRpc", () => {
  it("returns the data and passes the function name and arguments", async () => {
    mockRpc.mockResolvedValue({ data: { order_id: "o1" }, error: null });
    await expect(callRpc<{ order_id: string }>("seva_issue_counter_order", { p_order: { a: 1 } })).resolves.toEqual({
      order_id: "o1",
    });
    expect(mockRpc).toHaveBeenCalledWith("seva_issue_counter_order", { p_order: { a: 1 } });
  });

  it("maps SEVA:price_changed with DETAIL json to SevaError(price_changed, detail)", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "SEVA:price_changed", details: '{"expected":"820.00","actual":"850.00"}', hint: null, code: "P0001" },
    });
    const error = await caught(callRpc("seva_issue_counter_order", {}));
    expect(error.code).toBe("price_changed");
    expect(error.detail).toEqual({ expected: "820.00", actual: "850.00" });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("keeps a business code without a usable DETAIL and drops a DETAIL that is not a JSON object", async () => {
    for (const details of [null, "", "not json", "[1,2]", '"text"', "42"]) {
      mockRpc.mockResolvedValue({ data: null, error: { message: "SEVA:day_closed", details, hint: null, code: "P0001" } });
      const error = await caught(callRpc("seva_issue_counter_order", {}));
      expect(error.code).toBe("day_closed");
      expect(error.detail).toBeUndefined();
    }
  });

  it("maps an unknown database error to internal without leaking its text", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: 'duplicate key value violates unique constraint "staff_email_key"',
        details: "Key (email)=(ramesh@example.org) already exists.",
        hint: null,
        code: "23505",
      },
    });
    const error = await caught(callRpc("seva_staff_onboard", {}));
    expect(error.code).toBe("internal");
    expect(error.detail).toBeUndefined();
    expect(error.message).not.toContain("duplicate");
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain("23505");
    expect(logged).not.toContain("ramesh@example.org");
    expect(logged).not.toContain("duplicate key");
  });

  it("treats an unknown SEVA code as internal", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "SEVA:made_up_code", details: null, hint: null, code: "P0001" } });
    expect((await caught(callRpc("seva_issue_counter_order", {}))).code).toBe("internal");
  });

  it("turns a thrown client error into internal", async () => {
    mockRpc.mockRejectedValue(new Error("fetch failed for ramesh@example.org"));
    expect((await caught(callRpc("seva_issue_counter_order", {}))).code).toBe("internal");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("ramesh@example.org");
  });

  it("calls only seva functions", async () => {
    await expect(callRpc("pg_sleep", {})).rejects.toThrow();
    await expect(callRpc("seva_x; drop table staff", {})).rejects.toThrow();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("sevaErrorResponse and sevaJson", () => {
  it("answers { error: { code, message } } with the code's status", async () => {
    const response = sevaErrorResponse(new SevaError("price_changed"));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "price_changed", message: "The rate changed - check the total." } });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("builds the message from the detail and passes the detail on", async () => {
    const response = sevaErrorResponse(new SevaError("seva_inactive", { name: "Paaduka Pooja" }));
    expect(await response.json()).toEqual({
      error: {
        code: "seva_inactive",
        message: "Paaduka Pooja was switched off in Seva settings a moment ago.",
        detail: { name: "Paaduka Pooja" },
      },
    });
    const partial = sevaErrorResponse(new SevaError("partial_failure", { done: ["identity"], failed: "staff" }));
    expect(partial.status).toBe(502);
    expect(await partial.json()).toMatchObject({ error: { code: "partial_failure", detail: { done: ["identity"], failed: "staff" } } });
  });

  it("answers internal for an unexpected error and logs only the code and a request id", async () => {
    const response = sevaErrorResponse(new Error("boom for devotee Ramesh 9845012345"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: { code: "internal", message: "Something went wrong on the server. Try again." } });
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain("internal");
    expect(logged).toContain(response.headers.get("x-request-id"));
    expect(logged).not.toContain("Ramesh");
    expect(logged).not.toContain("9845012345");
  });

  it("never sends a detail with internal", async () => {
    const body = await sevaErrorResponse(new SevaError("internal", { sql: "select secret" })).json();
    expect(body).toEqual({ error: { code: "internal", message: "Something went wrong on the server. Try again." } });
  });

  it("sevaJson answers no-store JSON by default and takes a status and headers", async () => {
    const plain = sevaJson({ ok: 1 });
    expect(plain.status).toBe(200);
    expect(plain.headers.get("cache-control")).toBe("no-store");
    expect(await plain.json()).toEqual({ ok: 1 });
    const cached = sevaJson([1], { status: 201, headers: { "Cache-Control": "private, max-age=60" } });
    expect(cached.status).toBe(201);
    expect(cached.headers.get("cache-control")).toBe("private, max-age=60");
  });
});

describe("rateLimit", () => {
  it("allows up to the limit in the window, then refuses", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    expect([1, 2, 3, 4].map(() => rateLimit("test:ip-1", opts))).toEqual([true, true, true, false]);
    expect(rateLimit("test:ip-2", opts)).toBe(true);
  });

  it("opens again when the window has passed", () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    const opts = { limit: 1, windowMs: 1_000 };
    expect(rateLimit("test:ip-3", opts)).toBe(true);
    expect(rateLimit("test:ip-3", opts)).toBe(false);
    now.mockReturnValue(1_002_000);
    expect(rateLimit("test:ip-3", opts)).toBe(true);
    now.mockRestore();
  });
});
