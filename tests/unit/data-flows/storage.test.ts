/**
 * @jest-environment node
 */
import {
  createSupabaseStorage,
  isStorageNotFound,
  type FetchLike,
} from "@/lib/data-flows/storage";

const config = {
  url: "https://example.supabase.co",
  key: "service-role-secret-value",
  bucket: "RayaramathaYNK",
};

function response(status: number, body: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

function recordingFetch(status: number, body: string) {
  const calls: { url: string; init?: Parameters<FetchLike>[1] }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return response(status, body);
  };
  return { calls, fetchImpl };
}

describe("Supabase Storage REST adapter", () => {
  it("reads an object with the bucket and encoded path", async () => {
    const { calls, fetchImpl } = recordingFetch(200, '{"ok":true}');
    const storage = createSupabaseStorage(config, fetchImpl);

    const result = await storage.getText("Data_flows/Panchanga/current.json");

    expect(result).toEqual({ ok: true, text: '{"ok":true}', status: 200 });
    expect(calls[0].url).toBe(
      "https://example.supabase.co/storage/v1/object/RayaramathaYNK/Data_flows/Panchanga/current.json"
    );
    expect(calls[0].init?.method).toBe("GET");
    expect(calls[0].init?.headers?.apikey).toBe(config.key);
    expect(calls[0].init?.headers?.Authorization).toBe(`Bearer ${config.key}`);
  });

  it("maps a 404 to a not-found read", async () => {
    const { fetchImpl } = recordingFetch(404, '{"message":"not found"}');
    const storage = createSupabaseStorage(config, fetchImpl);
    const result = await storage.getText("missing.json");
    expect(result.ok).toBe(false);
    expect(isStorageNotFound(result)).toBe(true);
  });

  it("uploads with upsert enabled and verifies nothing about the response body", async () => {
    const { calls, fetchImpl } = recordingFetch(200, "");
    const storage = createSupabaseStorage(config, fetchImpl);

    const result = await storage.putText("Data_flows/Panchanga/daily/2026-11-24.json", "{}\n");

    expect(result.ok).toBe(true);
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.headers?.["x-upsert"]).toBe("true");
    expect(calls[0].init?.body).toBe("{}\n");
  });

  it("lists objects and ignores malformed entries", async () => {
    const { fetchImpl } = recordingFetch(
      200,
      JSON.stringify([{ name: "2026.json", id: "1" }, { nope: true }])
    );
    const storage = createSupabaseStorage(config, fetchImpl);
    const result = await storage.list("Data_flows/Panchanga/years");
    expect(result.ok).toBe(true);
    expect(result.entries).toEqual([{ name: "2026.json", id: "1" }]);
  });

  it("never puts the key in an error message", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("network unavailable");
    };
    const storage = createSupabaseStorage(config, fetchImpl);
    const result = await storage.getText("x.json");
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain(config.key);
  });

  it("refuses to construct in a browser", () => {
    const globalWithWindow = globalThis as { window?: unknown };
    globalWithWindow.window = {};
    try {
      expect(() => createSupabaseStorage(config)).toThrow(/server-only/);
    } finally {
      delete globalWithWindow.window;
    }
  });
});
