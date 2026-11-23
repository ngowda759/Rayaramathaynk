/**
 * sanitizeReturnPath — the server-safe, origin-parameter form of safeReturnPath (B4).
 *
 * The OAuth callback runs on the server, where `window` does not exist. It therefore cannot use
 * safeReturnPath (which returns the fallback outside a browser) and must not grow a second, weaker
 * copy of the rules. These tests pin the server boundary directly: only a same-origin relative path
 * survives, and every hostile, encoded or malformed value collapses to the documented fallback.
 */
import {
  DEFAULT_SAFE_RETURN_PATH,
  safeReturnPath,
  sanitizeReturnPath,
} from "@/lib/auth/safe-return";

const ORIGIN = "https://www.srsmathaynk.com";

/** The value as `searchParams.get("next")` hands it to the callback (percent-decoded). */
function fromQuery(encoded: string): string | null {
  return new URLSearchParams(`next=${encoded}`).get("next");
}

/** The destination a redirect to `out` would actually reach, checked against the application origin. */
function expectStaysOnOrigin(out: string): void {
  expect(out.startsWith("/")).toBe(true);
  expect(out.startsWith("//")).toBe(false);
  expect(out.startsWith("/\\")).toBe(false);
  const url = new URL(out, ORIGIN);
  expect(url.origin).toBe(ORIGIN);
  // A second parse, the way the sign-in page relays the value, must also stay on this origin.
  expect(new URL(out, `${ORIGIN}/login?redirect=x`).origin).toBe(ORIGIN);
}

describe("sanitizeReturnPath — valid destinations", () => {
  it("keeps a normal internal path", () => {
    expect(sanitizeReturnPath("/profile", "/", ORIGIN)).toBe("/profile");
    expect(sanitizeReturnPath("/admin/events", "/", ORIGIN)).toBe("/admin/events");
  });

  it("keeps an internal path with a query string", () => {
    expect(sanitizeReturnPath("/seva/register?status=changed", "/", ORIGIN)).toBe(
      "/seva/register?status=changed"
    );
    expect(sanitizeReturnPath("/seva/prasadam?token=AB12", "/", ORIGIN)).toBe(
      "/seva/prasadam?token=AB12"
    );
    expect(sanitizeReturnPath("/seva?next=%2Fadmin", "/", ORIGIN)).toBe("/seva?next=%2Fadmin");
  });

  it("keeps an internal path with a fragment", () => {
    expect(sanitizeReturnPath("/profile#bookings", "/", ORIGIN)).toBe("/profile#bookings");
    expect(sanitizeReturnPath("/seva/register?status=changed#x", "/", ORIGIN)).toBe(
      "/seva/register?status=changed#x"
    );
  });

  it("returns the configured safe fallback when no destination is supplied", () => {
    expect(sanitizeReturnPath(null, "/login", ORIGIN)).toBe("/login");
    expect(sanitizeReturnPath(undefined, "/admin", ORIGIN)).toBe("/admin");
    expect(sanitizeReturnPath("", "/", ORIGIN)).toBe("/");
    expect(sanitizeReturnPath(null, "/", ORIGIN)).toBe(DEFAULT_SAFE_RETURN_PATH);
  });

  it("normalises dot segments that stay on this origin", () => {
    expect(sanitizeReturnPath("/seva/./register", "/", ORIGIN)).toBe("/seva/register");
    expect(sanitizeReturnPath("/seva/../admin", "/", ORIGIN)).toBe("/admin");
    expect(sanitizeReturnPath("/seva/register/..", "/", ORIGIN)).toBe("/seva/");
  });

  it("keeps ordinary encoded characters in the path and query", () => {
    expect(sanitizeReturnPath("/seva?name=Ram%20Rao", "/", ORIGIN)).toBe("/seva?name=Ram%20Rao");
    expect(sanitizeReturnPath("/seva?q=100%", "/", ORIGIN)).toBe("/seva?q=100%");
  });
});

describe("sanitizeReturnPath — malicious destinations", () => {
  it.each([
    ["an absolute https URL", "https://evil.example"],
    ["an absolute https URL with a path", "https://evil.example/x"],
    ["an absolute http URL", "http://evil.example/seva"],
    ["a protocol-relative URL", "//evil.example"],
    ["a protocol-relative URL with a path", "//evil.example/x"],
    ["a triple-slash URL", "///evil.example"],
    ["a backslash protocol-relative URL", "/\\evil.example"],
    ["a double-backslash URL", "\\\\evil.example"],
    ["slash, backslash, slash", "/\\/evil.example"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a mixed-case javascript: URL", "JaVaScRiPt:alert(1)"],
    ["a data: URL", "data:text/html,<script>alert(1)</script>"],
    ["a vbscript: URL", "vbscript:msgbox(1)"],
    ["a file: URL", "file:///etc/passwd"],
    ["a relative path with no leading slash", "profile"],
    ["a dot path", "../evil"],
    ["a dot segment that normalises to //host", "/.//evil.example"],
    ["a dot-dot path that escapes via //host", "/seva/../..//evil.example"],
    ["a leading space before //host", " //evil.example"],
    ["a leading space before a path", " /seva"],
  ])("refuses %s", (_label, value) => {
    expect(sanitizeReturnPath(value, "/", ORIGIN)).toBe("/");
  });
});

describe("sanitizeReturnPath — control characters", () => {
  it.each([
    ["a NUL", "/seva\u0000"],
    ["a TAB", "/\t/evil.example"],
    ["a line feed", "/\n/evil.example"],
    ["a carriage return", "/\r/evil.example"],
    ["a DEL", "/\u007f/evil.example"],
    ["a C1 NEL", "/seva\u0085"],
    ["a C1 control", "/seva\u009f"],
    ["a space", "/seva page"],
  ])("refuses %s", (_label, value) => {
    expect(sanitizeReturnPath(value, "/", ORIGIN)).toBe("/");
  });
});

describe("sanitizeReturnPath — encoded and normalisation attempts", () => {
  it.each([
    ["encoded protocol-relative slashes", "/%2F%2Fevil.example"],
    ["encoded backslashes", "/%5C%5Cevil.example"],
    ["encoded slash then backslash", "/%2F%5Cevil.example"],
    ["encoded dot then //", "/%2e//evil.example"],
    ["encoded upper-case dot-dot then //", "/%2E%2E//x"],
    ["mixed encoded dot-dot then //", "/%2e.//x"],
    ["encoded dot-dot and encoded slash", "/%2E%2E%2F%2Fevil.example"],
    ["double-encoded slashes", "/%252F%252Fevil.example"],
    ["encoded TAB between slashes", "/%2F%09%2Fevil.example"],
    ["encoded line feed between slashes", "/%2F%0A%2Fevil.example"],
    ["encoded NUL", "/seva%00"],
    ["encoded C1 control", "/seva%C2%85"],
    ["division slashes", "/\u2215\u2215x"],
    ["encoded division slashes", "/%E2%88%95%E2%88%95x"],
    ["fullwidth slashes", "/\uFF0F\uFF0Fx"],
    ["fraction slashes", "/\u2044\u2044x"],
    ["fullwidth backslash", "/\uFF3C\uFF3Cx"],
  ])("refuses %s", (_label, value) => {
    expect(sanitizeReturnPath(value, "/", ORIGIN)).toBe("/");
  });

  it.each([
    ["%2F%2Fevil.example", "encoded //"],
    ["%2F.%2F%2Fevil.example", "encoded /./ then //"],
    ["%2F..%2F%2Fevil.example", "encoded /../ then //"],
    ["%2F%252e%2F%2Fevil.example", "double-encoded dot"],
    ["%2Fseva%2F..%2F..%2F%2Fevil.example", "encoded path with dot-dots"],
    ["https%3A%2F%2Fevil.example", "encoded absolute URL"],
    ["javascript%3Aalert(1)", "encoded javascript: URL"],
    ["+%2F%2Fevil.example", "a + that decodes to a space"],
  ])("refuses %s (%s) once decoded the way the callback reads it", (encoded) => {
    expect(sanitizeReturnPath(fromQuery(encoded), "/", ORIGIN)).toBe("/");
  });
});

describe("sanitizeReturnPath — malformed and non-string input", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["a number", 42],
    ["NaN", Number.NaN],
    ["a boolean", true],
    ["an object", { path: "/profile" }],
    ["an array", ["/profile"]],
  ])("returns the fallback for %s", (_label, value) => {
    expect(sanitizeReturnPath(value, "/", ORIGIN)).toBe("/");
  });
});

describe("sanitizeReturnPath — origin and fallback guards", () => {
  it("returns the documented default for an invalid origin", () => {
    expect(sanitizeReturnPath("/profile", "/login", "not a url")).toBe(DEFAULT_SAFE_RETURN_PATH);
    expect(sanitizeReturnPath("/profile", "/login", "")).toBe(DEFAULT_SAFE_RETURN_PATH);
    expect(sanitizeReturnPath("/profile", "/login", "ftp://www.srsmathaynk.com")).toBe(
      DEFAULT_SAFE_RETURN_PATH
    );
    expect(sanitizeReturnPath("/profile", "/login", `${ORIGIN}/path`)).toBe(
      DEFAULT_SAFE_RETURN_PATH
    );
    expect(sanitizeReturnPath("/profile", "/login", `${ORIGIN}/?q=1`)).toBe(
      DEFAULT_SAFE_RETURN_PATH
    );
    expect(sanitizeReturnPath("/profile", "/login", "https://user:pass@srsmathaynk.com")).toBe(
      DEFAULT_SAFE_RETURN_PATH
    );
  });

  it("normalises an origin that differs only by case or a trailing slash", () => {
    expect(sanitizeReturnPath("/profile", "/", "https://WWW.SRSMATHANYNK.COM")).toBe("/profile");
    expect(sanitizeReturnPath("/profile", "/", `${ORIGIN}/`)).toBe("/profile");
  });

  it("ignores an unsafe fallback and uses the documented default", () => {
    expect(sanitizeReturnPath("//evil.example", "https://evil.example", ORIGIN)).toBe(
      DEFAULT_SAFE_RETURN_PATH
    );
    expect(sanitizeReturnPath(null, "//evil.example", ORIGIN)).toBe(DEFAULT_SAFE_RETURN_PATH);
    expect(sanitizeReturnPath(null, "/\\evil.example", ORIGIN)).toBe(DEFAULT_SAFE_RETURN_PATH);
  });

  it("keeps a safe fallback when the requested value is refused", () => {
    expect(sanitizeReturnPath("https://evil.example", "/admin", ORIGIN)).toBe("/admin");
    expect(sanitizeReturnPath("//evil.example", "/login?redirect=%2Fadmin", ORIGIN)).toBe(
      "/login?redirect=%2Fadmin"
    );
  });

  it("returns a value that stays on the origin for every accepted input", () => {
    for (const value of ["/profile", "/seva?a=1#b", "/a/b/../c", "/seva?next=%2Fadmin"]) {
      expectStaysOnOrigin(sanitizeReturnPath(value, "/", ORIGIN));
    }
  });
});

describe("sanitizeReturnPath — browser parity", () => {
  it("agrees with safeReturnPath for the same value and origin", () => {
    for (const value of ["/profile", "//evil.example", "/.//evil.example", "/seva?x=1", null]) {
      expect(sanitizeReturnPath(value, "/", ORIGIN)).toBe(safeReturnPath(value, "/"));
    }
  });
});
