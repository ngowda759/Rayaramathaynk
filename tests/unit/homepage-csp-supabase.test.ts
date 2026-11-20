/**
 * The production Content-Security-Policy is set by `proxy.ts` (the Next.js
 * middleware/proxy convention). `next.config.ts` also declares a CSP, but its
 * `headers()` output is overridden by the proxy, so a fix that only touches
 * `next.config.ts` never reaches production. This guards the real source: the
 * public Supabase Storage host must be allowed in `img-src`, otherwise hero
 * images served from Supabase Storage are blocked by the browser.
 */
import proxy from "../../proxy";

const request = { nextUrl: { pathname: "/" } } as never;

describe("proxy.ts Content-Security-Policy", () => {
  it("allows the Supabase Storage host in img-src", async () => {
    const response = await proxy(request);
    const csp = response.headers.get("content-security-policy") ?? "";

    const imgSrc = csp.split(";").find((part) => part.trim().startsWith("img-src")) ?? "";
    expect(imgSrc).toContain("https://kvrkraqjuyxbraccxntk.supabase.co");
  });

  it("keeps the CSP narrow (no wildcard Supabase image source)", async () => {
    const response = await proxy(request);
    const csp = response.headers.get("content-security-policy") ?? "";
    const imgSrc = csp.split(";").find((part) => part.trim().startsWith("img-src")) ?? "";

    expect(imgSrc).not.toContain("https://*.supabase.co");
  });

  // docs/auth/GOOGLE-SIGNIN.md §13: a Google account avatar is served from *.googleusercontent.com,
  // so `img-src` needs that one host or the picture is silently blocked.
  it("allows Google account avatars in img-src", async () => {
    const response = await proxy(request);
    const csp = response.headers.get("content-security-policy") ?? "";
    const imgSrc = csp.split(";").find((part) => part.trim().startsWith("img-src")) ?? "";

    expect(imgSrc).toContain("https://*.googleusercontent.com");
  });

  it("adds no broad wildcard or unrelated Google origin to img-src", async () => {
    const response = await proxy(request);
    const csp = response.headers.get("content-security-policy") ?? "";
    const imgSrc = csp.split(";").find((part) => part.trim().startsWith("img-src")) ?? "";

    expect(imgSrc).not.toMatch(/\s\*(?:\s|;|$)/);
    expect(imgSrc).not.toContain("https://*.google.com");
    expect(imgSrc).not.toContain("https://google.com");
  });
});
