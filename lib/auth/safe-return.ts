/**
 * Where a person may be sent after signing in (A4S security gate, H-1).
 *
 * `/login?redirect=` and the admin guard's relay of a page's own `?redirect=` are attacker-controlled. Only a path on
 * this site is followed: anything else (`//host`, backslash tricks, whitespace or control characters the URL parser
 * strips, `https:`, `javascript:` and their encoded forms once decoded) gives the fallback. The caller passes the
 * value as `searchParams.get` returns it, already percent-decoded, so `%2F%2F` cannot slip past.
 *
 * URL parsing collapses dot segments (`/.//host`, `/%2e//host` and `/seva/../..//host` all parse to the path
 * `//host`), so the RESULT is checked again after parsing. A value whose decoded form would normalise to `//host`
 * (encoded or double-encoded slashes, look-alike Unicode slashes) is refused as well (review finding H-1, 2026-10-20).
 */

/** Control characters, whitespace (space and below) and DEL, all of which the URL parser strips or ignores. */
const CONTROL_OR_SPACE = /[\u0000- \u007f]/;

/** Control characters and DEL, removed when reading the decoded form (the URL parser strips them). */
const CONTROL = /[\u0000-\u001f\u007f]/g;

/** Characters that look like, or fold to, a slash or backslash: division, fraction, fullwidth and small forms. */
const SLASH_LOOKALIKE = /[\u2215\u2044\u29f8\u29f9\u2216\ufe68\uff0f\uff3c]/g;

/** How many times a value is percent-decoded when its decoded form is checked. */
const MAX_DECODE_ROUNDS = 3;

/** Percent sequences decoded where they form valid UTF-8; a stray `%` (as in `100%`) is left as it is. */
function decodeLeniently(value: string): string {
  return value.replace(/(?:%[0-9a-f]{2})+/gi, (run) => {
    try {
      return decodeURIComponent(run);
    } catch {
      return run;
    }
  });
}

/** True when `path`, parsed against `origin`, stays on `origin` with a pathname that is not `//...` or `/\...`. */
function staysOnOrigin(path: string, origin: string): boolean {
  let url: URL;
  try {
    url = new URL(path, origin);
  } catch {
    return false;
  }
  return url.origin === origin && !url.pathname.startsWith("//") && !url.pathname.startsWith("/\\");
}

/**
 * True when a decoded form of `raw` (percent-decoded up to three times, NFKC-folded, look-alike slashes and
 * backslashes read as `/`, control characters removed) would normalise to a path off this site.
 */
function decodedFormLeavesSite(raw: string, origin: string): boolean {
  let current = raw;
  for (let round = 0; round <= MAX_DECODE_ROUNDS; round += 1) {
    const folded = current.normalize("NFKC").replace(SLASH_LOOKALIKE, "/").replace(/\\/g, "/").replace(CONTROL, "");
    const path = folded.split(/[?#]/, 1)[0];
    if (!path.startsWith("/") || path.startsWith("//") || !staysOnOrigin(path, origin)) return true;
    const next = decodeLeniently(current);
    if (next === current) return false;
    current = next;
  }
  return true; // still changing after three decodes: no page of this site produces such a value
}

/**
 * The same-origin path to go to, or `fallback`.
 * Returns `pathname + search + hash` of the parsed URL, never the raw string. Outside a browser it returns `fallback`.
 */
export function safeReturnPath(raw: string | null | undefined, fallback: string): string {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  if (CONTROL_OR_SPACE.test(raw) || raw.includes("\\")) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (typeof window === "undefined") return fallback;
  const origin = window.location.origin;
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return fallback;
  }
  if (url.origin !== origin) return fallback;
  if (decodedFormLeavesSite(raw, origin)) return fallback;
  const result = `${url.pathname}${url.search}${url.hash}`;
  // Re-check the normalised result: dot segments can collapse `/.//host` to `//host`.
  if (!result.startsWith("/") || result.startsWith("//") || result.startsWith("/\\")) return fallback;
  if (!staysOnOrigin(result, origin)) return fallback;
  return result;
}

/**
 * A full page load of `path` (`window.location.assign`), used after sign-in so the whole app starts with the new
 * session. Pass only a value from `safeReturnPath`. Kept here, one function, so tests can observe the navigation
 * (jsdom's `location.assign` cannot be replaced).
 */
export function assignLocation(path: string): void {
  window.location.assign(path);
}
