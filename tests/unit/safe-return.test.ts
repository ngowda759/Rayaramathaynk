/**
 * safeReturnPath (A4S security gate, H-1): the page a person is sent to after signing in must be a path on this site.
 * Every hostile value from the gate's proof table gives the fallback; same-origin paths come back as path + query + hash.
 */
import { safeReturnPath } from "@/lib/auth/safe-return";

/** The value as `searchParams.get("redirect")` hands it to the caller (percent-decoded). */
function fromQuery(encoded: string): string | null {
  return new URLSearchParams(`redirect=${encoded}`).get("redirect");
}

describe("safeReturnPath", () => {
  it("refuses an empty, missing or non-string value", () => {
    expect(safeReturnPath(null, "/")).toBe("/");
    expect(safeReturnPath(undefined, "/admin")).toBe("/admin");
    expect(safeReturnPath("", "/")).toBe("/");
  });

  it.each([
    ["protocol-relative", "//evil.example"],
    ["protocol-relative with a path", "//evil.example/x"],
    ["slash then backslash", "/\\evil.example"],
    ["two backslashes", "\\\\evil.example"],
    ["slash, backslash, slash", "/\\/evil.example"],
    ["leading space", " //evil.example"],
    ["leading space before a path", " /seva"],
    ["tab between the slashes", "/\t/evil.example"],
    ["line feed between the slashes", "/\n/evil.example"],
    ["carriage return between the slashes", "/\r/evil.example"],
    ["NUL", "/seva\u0000"],
    ["DEL", "/\u007f/evil.example"],
    ["absolute https URL", "https://evil.example"],
    ["absolute http URL", "http://evil.example/seva"],
    ["javascript: URL", "javascript:alert(document.domain)"],
    ["mixed-case javascript: URL", "JaVaScRiPt:alert(1)"],
    ["data: URL", "data:text/html,<script>alert(1)</script>"],
    ["relative path without a leading slash", "seva/register"],
    ["dot path", "../evil"],
  ])("refuses %s", (_label, value) => {
    expect(safeReturnPath(value, "/")).toBe("/");
  });

  it.each([
    ["%2F%2Fevil.example", "encoded //"],
    ["%2F%5Cevil.example", "encoded /\\"],
    ["%5C%5Cevil.example", "encoded \\\\"],
    ["%20%2F%2Fevil.example", "encoded leading space"],
    ["%2F%09%2Fevil.example", "encoded TAB"],
    ["%2F%0A%2Fevil.example", "encoded LF"],
    ["https%3A%2F%2Fevil.example", "encoded https URL"],
    ["javascript%3Aalert(1)", "encoded javascript: URL"],
    ["+%2F%2Fevil.example", "a + that decodes to a space"],
  ])("refuses %s (%s) once decoded the way searchParams.get decodes it", (encoded) => {
    expect(safeReturnPath(fromQuery(encoded), "/")).toBe("/");
  });

  // Review finding H-1 (2026-10-20): URL parsing collapses dot segments, so a value that starts with one slash can
  // still come out as `//host`. The parsed result is re-checked, and the decoded form is checked as well.
  it.each([
    ["dot segment then //", "/.//evil.example"],
    ["dot-dot segment then //", "/..//evil.example"],
    ["encoded dot then //", "/%2e//evil.example"],
    ["encoded upper-case dot-dot then //", "/%2E%2E//x"],
    ["mixed encoded dot-dot then //", "/%2e.//x"],
    ["path, two dot-dots, then //", "/seva/../..//evil.example"],
    ["dot-dot chain then //", "/a/b/../../..//evil.example"],
    ["dot then encoded slash", "/./%2F/x"],
    ["dot then encoded lower-case slash", "/./%2f/x"],
    ["encoded slashes after one slash", "/%2F%2Fevil.example"],
    ["dot followed by an encoded slash", "/.%2F/evil.example"],
    ["encoded dot-dot and encoded slash", "/%2E%2E%2F%2Fevil.example"],
    ["double-encoded slashes", "/%252F%252Fevil.example"],
    ["encoded backslash after a dot", "/./%5C/x"],
    ["division slashes", "/\u2215\u2215x"],
    ["encoded division slashes", "/%E2%88%95%E2%88%95x"],
    ["fullwidth slashes", "/\uFF0F\uFF0Fx"],
    ["dot then fullwidth slash", "/./\uFF0Fx"],
    ["fraction slashes", "/\u2044\u2044x"],
    ["fullwidth backslash", "/\uFF3C\uFF3Cx"],
  ])("refuses %s (%s), which normalises to //host", (_label, value) => {
    const out = safeReturnPath(value, "/");
    expect(out).toBe("/");
  });

  it.each([
    ["%2F.%2F%2Fevil.example", "encoded /./ then //"],
    ["%2F..%2F%2Fevil.example", "encoded /../ then //"],
    ["%2F%252e%2F%2Fevil.example", "double-encoded dot"],
    ["%2Fseva%2F..%2F..%2F%2Fevil.example", "encoded path with dot-dots"],
  ])("refuses %s (%s) once decoded the way searchParams.get decodes it", (encoded) => {
    expect(safeReturnPath(fromQuery(encoded), "/")).toBe("/");
  });

  it("keeps dot segments that stay on this site, and ordinary encoded characters", () => {
    expect(safeReturnPath("/seva/./register", "/")).toBe("/seva/register");
    expect(safeReturnPath("/seva/register/..", "/")).toBe("/seva/");
    expect(safeReturnPath("/seva?name=Ram%20Rao", "/")).toBe("/seva?name=Ram%20Rao");
    expect(safeReturnPath("/seva?next=%2Fadmin", "/")).toBe("/seva?next=%2Fadmin");
    expect(safeReturnPath("/seva?q=100%", "/")).toBe("/seva?q=100%");
  });

  it("keeps same-origin paths with their query and hash", () => {
    expect(safeReturnPath("/seva/register?status=changed#x", "/")).toBe("/seva/register?status=changed#x");
    expect(safeReturnPath("/seva/prasadam?token=AB12", "/")).toBe("/seva/prasadam?token=AB12");
    expect(safeReturnPath("/seva", "/")).toBe("/seva");
    expect(safeReturnPath("/admin/events", "/")).toBe("/admin/events");
    expect(safeReturnPath(fromQuery("%2Fseva%2Fcounter%3Fx%3D1"), "/admin")).toBe("/seva/counter?x=1");
  });


  it("returns the parsed path, never the raw string", () => {
    expect(safeReturnPath("/seva/../admin", "/")).toBe("/admin");
  });
});

describe("safeReturnPath, property-style (FINAL-FIX N-8, H-1)", () => {
  const ORIGIN = "https://temple.example";
  const PARTS = [
    "/", "/", "/", ".", "..", "%2e", "%2E", "%2e%2e", "%2f", "%2F", "%252f", "%252e", "\\", "%5c", "%5C",
    "∕", "／", "⁄", "＼", "．", "。", "%E2%88%95", "%EF%BC%8F",
    "evil.example", "@evil.example", "evil.example:443", "seva", "admin", "?", "#", ";", ":", "%09", "\t", "​",
  ];

  /** A small seeded generator (mulberry32), so a failure can be replayed. */
  function generator(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomPath(next: () => number): string {
    const length = 1 + Math.floor(next() * 7);
    let out = next() < 0.85 ? "/" : "";
    for (let i = 0; i < length; i += 1) out += PARTS[Math.floor(next() * PARTS.length)];
    return out;
  }

  /** The fallback, or a same-origin path that does not start with // (or /\), also once the sign-in page reads it. */
  function expectSafe(input: string | null, out: string): void {
    if (out === "/admin") return;
    const ok =
      out.startsWith("/") &&
      !out.startsWith("//") &&
      !out.startsWith("/\\") &&
      new URL(out, ORIGIN).origin === ORIGIN &&
      new URL(out, `${ORIGIN}/login?redirect=x`).origin === ORIGIN;
    expect({ input, out, ok }).toEqual({ input, out, ok: true });
  }

  it("never leaves the site for a few thousand random paths, raw and query-decoded", () => {
    const next = generator(20261020);
    for (let i = 0; i < 4000; i += 1) {
      const value = randomPath(next);
      expectSafe(value, safeReturnPath(value, "/admin"));
      const decoded = fromQuery(value);
      expectSafe(decoded, safeReturnPath(decoded, "/admin"));
      // The guard's relay: the result is encoded into /login?redirect= and read back there.
      const relayed = safeReturnPath(fromQuery(encodeURIComponent(safeReturnPath(value, "/admin"))), "/admin");
      expectSafe(value, relayed);
    }
  });
});
