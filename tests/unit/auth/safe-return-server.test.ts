/**
 * sanitizeReturnPath — the origin-parameter form of safeReturnPath.
 *
 * The OAuth callback runs on the server, where `window` does not exist. It therefore cannot use
 * safeReturnPath (which returns the fallback outside a browser) and must not grow a second, weaker
 * copy of the rules. This pins that both forms agree on the hostile values.
 */
import { safeReturnPath, sanitizeReturnPath } from "@/lib/auth/safe-return";

const ORIGIN = "https://www.srsmathaynk.com";

describe("sanitizeReturnPath", () => {
  it("keeps a same-origin path with its query and hash", () => {
    expect(sanitizeReturnPath("/profile", "/", ORIGIN)).toBe("/profile");
    expect(sanitizeReturnPath("/seva/register?status=changed#x", "/", ORIGIN)).toBe(
      "/seva/register?status=changed#x"
    );
  });

  it("returns the fallback for a missing or empty value", () => {
    expect(sanitizeReturnPath(null, "/", ORIGIN)).toBe("/");
    expect(sanitizeReturnPath(undefined, "/login", ORIGIN)).toBe("/login");
    expect(sanitizeReturnPath("", "/", ORIGIN)).toBe("/");
  });

  it.each([
    ["an absolute external URL", "https://evil.example/x"],
    ["an http URL", "http://evil.example"],
    ["a protocol-relative URL", "//evil.example"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a data: URL", "data:text/html,<script>alert(1)</script>"],
    ["a backslash trick", "/\\evil.example"],
    ["a leading space", " //evil.example"],
    ["a relative path with no leading slash", "profile"],
    ["a dot segment that normalises to //host", "/.//evil.example"],
    ["a path that escapes via dot-dots", "/seva/../..//evil.example"],
    ["encoded protocol-relative slashes", "/%2F%2Fevil.example"],
    ["a NUL", "/seva\u0000"],
  ])("refuses %s", (_label, value) => {
    expect(sanitizeReturnPath(value, "/", ORIGIN)).toBe("/");
  });

  it("normalises dot segments that stay on this origin", () => {
    expect(sanitizeReturnPath("/seva/../admin", "/", ORIGIN)).toBe("/admin");
  });

  it("agrees with safeReturnPath for the same value and origin", () => {
    for (const value of ["/profile", "//evil.example", "/.//evil.example", "/seva?x=1", null]) {
      expect(sanitizeReturnPath(value, "/", ORIGIN)).toBe(safeReturnPath(value, "/"));
    }
  });
});
