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

  it("keeps same-origin paths with their query and hash", () => {
    expect(safeReturnPath("/seva/register?status=changed#x", "/")).toBe("/seva/register?status=changed#x");
    expect(safeReturnPath("/seva/prasadam?token=AB12", "/")).toBe("/seva/prasadam?token=AB12");
    expect(safeReturnPath("/seva", "/")).toBe("/seva");
    expect(safeReturnPath("/admin/events", "/")).toBe("/admin/events");
    expect(safeReturnPath(fromQuery("%2Fseva%2Fcounter%3Fx%3D1"), "/admin")).toBe("/seva/counter?x=1");
  });

  it("keeps an encoded // inside the path on this site", () => {
    const out = safeReturnPath("/%2F%2Fevil.example", "/");
    expect(out).toBe("/%2F%2Fevil.example");
    expect(new URL(out, window.location.origin).origin).toBe(window.location.origin);
  });

  it("returns the parsed path, never the raw string", () => {
    expect(safeReturnPath("/seva/../admin", "/")).toBe("/admin");
  });
});
