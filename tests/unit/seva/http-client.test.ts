import { SevaClientError, sevaFetch } from "@/services/seva/http";

const fetchMock = jest.fn();
const realFetch = global.fetch;

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = realFetch;
});

beforeEach(() => {
  fetchMock.mockReset();
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function caught(promise: Promise<unknown>): Promise<SevaClientError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof SevaClientError) return error;
    throw error;
  }
  throw new Error("expected a SevaClientError");
}

/** A fetch that only settles when its signal aborts, like a server that never answers. */
function hangingFetch(): jest.Mock {
  return fetchMock.mockImplementation(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      }),
  );
}

describe("sevaFetch", () => {
  it("sends Bearer and x-seva-device headers and parses JSON", async () => {
    fetchMock.mockResolvedValue(json({ orderId: "o1" }));
    const result = await sevaFetch<{ orderId: string }>("/api/seva/counter/orders", {
      method: "POST",
      body: { clientOrderId: "c1" },
      token: "id-token",
      deviceHeader: "dev-1.secret",
    });
    expect(result).toEqual({ orderId: "o1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/seva/counter/orders");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ clientOrderId: "c1" }));
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer id-token");
    expect(headers.get("x-seva-device")).toBe("dev-1.secret");
    expect(headers.get("content-type")).toBe("application/json");
    expect(init.cache).toBe("no-store");
  });

  it("sends a GET without a body or device header when none is given", async () => {
    fetchMock.mockResolvedValue(json({ staffId: "s1" }));
    await sevaFetch("/api/seva/me", { token: "id-token", deviceHeader: null });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    const headers = new Headers(init.headers);
    expect(headers.get("x-seva-device")).toBeNull();
    expect(headers.get("content-type")).toBeNull();
  });

  it("returns undefined for an empty answer", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(sevaFetch("/api/seva/counter/heartbeat", { method: "POST", body: {}, token: "t" })).resolves.toBeUndefined();
  });

  it("turns { error: { code, message } } into SevaClientError", async () => {
    fetchMock.mockResolvedValue(json({ error: { code: "price_changed", message: "The rate changed - check the total." } }, 409));
    const error = await caught(sevaFetch("/api/seva/counter/orders", { method: "POST", body: {}, token: "t" }));
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("price_changed");
    expect(error.status).toBe(409);
    expect(error.message).toBe("The rate changed - check the total.");
  });

  it("keeps the detail the server sent with an error", async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: "partial_failure", message: "Only part...", detail: { done: ["identity"], failed: "staff" } } }, 502),
    );
    const error = await caught(sevaFetch("/api/seva/staff", { method: "POST", body: {}, token: "t" }));
    expect(error.detail).toEqual({ done: ["identity"], failed: "staff" });
  });

  it("still answers a SevaClientError with the status when the error body is not ours", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));
    const error = await caught(sevaFetch("/api/seva/me", { token: "t" }));
    expect(error.status).toBe(502);
    expect(error.code).toBe("http_error");
  });

  it("reports an answer that is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));
    const error = await caught(sevaFetch("/api/seva/me", { token: "t" }));
    expect(error.code).toBe("bad_response");
    expect(error.status).toBe(200);
  });

  it("times out with code timeout", async () => {
    hangingFetch();
    const error = await caught(sevaFetch("/api/seva/counter/orders", { method: "POST", body: {}, token: "t", timeoutMs: 20 }));
    expect(error.code).toBe("timeout");
    expect(error.status).toBe(0);
  });

  it("reports a network failure with code network", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await caught(sevaFetch("/api/seva/me", { token: "t" }));
    expect(error.code).toBe("network");
    expect(error.status).toBe(0);
  });

  it("reports a caller abort as aborted, not as a network failure", async () => {
    hangingFetch();
    const controller = new AbortController();
    const pending = sevaFetch("/api/seva/me", { token: "t", signal: controller.signal, timeoutMs: 5_000 });
    controller.abort();
    const error = await caught(pending);
    expect(error.code).toBe("aborted");
    expect(error.status).toBe(0);
  });

  it("refuses to send the token anywhere but the seva API", async () => {
    for (const path of ["https://evil.example/api/seva/me", "//evil.example/api/seva/me", "/api/admin/users", "api/seva/me"]) {
      await expect(sevaFetch(path, { token: "t" })).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
