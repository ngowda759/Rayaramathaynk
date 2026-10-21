/**
 * Public Supabase configuration status.
 *
 * `lib/supabase/client.ts` falls back to a placeholder URL/key when the public
 * environment variables are absent. That fallback is what let a deployment
 * without Supabase report "Invalid email or password." The status helper must
 * recognize the placeholder (and a missing/invalid URL) as *not configured* so
 * the auth screens can say so instead.
 */
import {
  getSupabaseConfigStatus,
  validateSupabasePublicConfig,
  supabaseConfigMessage,
  SUPABASE_PLACEHOLDER_URL,
  SUPABASE_PLACEHOLDER_KEY,
} from "@/lib/supabase/config";

const REAL = { url: "https://abcdefghijklmnop.supabase.co", anonKey: "eyJhbGciOi.real.key" };

describe("validateSupabasePublicConfig", () => {
  it("accepts a real URL and key", () => {
    const status = validateSupabasePublicConfig(REAL);
    expect(status.isConfigured).toBe(true);
    expect(status.missing).toEqual([]);
    expect(status.url).toBe("https://abcdefghijklmnop.supabase.co");
  });

  it("rejects the placeholder pair that the client falls back to", () => {
    const status = validateSupabasePublicConfig({
      url: SUPABASE_PLACEHOLDER_URL,
      anonKey: SUPABASE_PLACEHOLDER_KEY,
    });
    expect(status.isConfigured).toBe(false);
    expect(status.usingPlaceholder).toBe(true);
    expect(status.missing).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]);
  });

  it("names both variables when both are absent", () => {
    const status = validateSupabasePublicConfig({});
    expect(status.isConfigured).toBe(false);
    expect(status.missing).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(status.missing).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(status.url).toBeNull();
  });

  it("rejects a URL that is not http(s)", () => {
    const status = validateSupabasePublicConfig({ url: "ftp://x.supabase.co", anonKey: "k" });
    expect(status.isConfigured).toBe(false);
    expect(status.missing).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("rejects an unparseable URL", () => {
    const status = validateSupabasePublicConfig({ url: "not a url", anonKey: "k" });
    expect(status.isConfigured).toBe(false);
  });

  it("treats whitespace-only values as absent", () => {
    const status = validateSupabasePublicConfig({ url: "   ", anonKey: "  " });
    expect(status.isConfigured).toBe(false);
    expect(status.missing).toHaveLength(2);
  });

  it("never returns the key value, only the variable name", () => {
    const status = validateSupabasePublicConfig(REAL);
    expect(JSON.stringify(status)).not.toContain(REAL.anonKey);
  });
});

describe("supabaseConfigMessage", () => {
  it("names the missing variables and no value", () => {
    const message = supabaseConfigMessage(validateSupabasePublicConfig({}));
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });
});

describe("getSupabaseConfigStatus", () => {
  const original = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  afterEach(() => {
    if (original.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = original.url;
    if (original.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = original.key;
  });

  it("reads the live environment and reports configured when both are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = REAL.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = REAL.anonKey;
    expect(getSupabaseConfigStatus().isConfigured).toBe(true);
  });

  it("reports not configured when the variables are removed", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(getSupabaseConfigStatus().isConfigured).toBe(false);
  });
});
