/**
 * Where a person may be sent after signing in (A4S security gate, H-1).
 *
 * This module is the single redirect-destination boundary for both the browser (sign-in pages and the admin
 * guard) and the server (the OAuth callback route and `lib/auth/oauth.ts`). The server form,
 * `sanitizeReturnPath`, takes an explicit origin and reads no browser global, so a route handler applies exactly
 * the same rules instead of a second, weaker copy.
 *
 * `/login?redirect=` and the admin guard's relay of a page's own `?redirect=` are attacker-controlled. Only a path
 * on this site is followed: anything else (`//host`, backslash tricks, whitespace or control characters the URL
 * parser strips, `https:`, `javascript:`, `data:` and their encoded forms once decoded) gives the fallback. The
 * caller passes the value as `searchParams.get` returns it, already percent-decoded, so `%2F%2F` cannot slip past.
 *
 * URL parsing collapses dot segments (`/.//host`, `/%2e//host` and `/seva/../..//host` all parse to the path
 * `//host`), so the RESULT is checked again after parsing. A value whose decoded form would normalise to `//host`
 * (encoded or double-encoded slashes, look-alike Unicode slashes) is refused as well (review finding H-1, 2026-10-20).
 */

/** The same-origin path used when neither the requested destination nor the caller's fallback is safe. */
export const DEFAULT_SAFE_RETURN_PATH = "/";

/** C0 controls, space, DEL and C1 controls, all of which the URL parser strips, ignores or misreads. */
const CONTROL_OR_SPACE = /[\u0000- \u007f-\u009f]/;

/** Control characters (C0, DEL and C1), removed when reading the decoded form (the URL parser strips them). */
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

/** The same control characters, non-global, for a stateless "does this form contain one?" test. */
const CONTROL_ONLY = /[\u0000-\u001f\u007f-\u009f]/;

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
 * backslashes read as `/`, control characters removed) would normalise to a path off this site, or when a
 * decoded form carries a control character at all (a legitimate application path never does).
 */
function decodedFormLeavesSite(raw: string, origin: string): boolean {
  let current = raw;
  for (let round = 0; round <= MAX_DECODE_ROUNDS; round += 1) {
    const unfolded = current.normalize("NFKC");
    if (CONTROL_ONLY.test(unfolded)) return true;
    const folded = unfolded.replace(SLASH_LOOKALIKE, "/").replace(/\\/g, "/").replace(CONTROL, "");
    const path = folded.split(/[?#]/, 1)[0];
    if (!path.startsWith("/") || path.startsWith("//") || !staysOnOrigin(path, origin)) return true;
    const next = decodeLeniently(current);
    if (next === current) return false;
    current = next;
  }
  return true; // still changing after three decodes: no page of this site produces such a value
}

/**
 * `origin` as a bare `scheme://host[:port]`, or `null` when it is not a well-formed http(s) origin.
 *
 * Callers usually pass a value that is already an origin, but normalising here means an origin carrying a
 * path, query, fragment or userinfo cannot shift the comparison base and make every request look external.
 */
function normalizeOrigin(origin: string): string | null {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.pathname !== "/" || url.search || url.hash) return null;
  return url.origin;
}

/** The same-origin path `raw` names, or `null` when it is not a safe relative application path. */
function sanitizeRelative(raw: unknown, origin: string): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (CONTROL_OR_SPACE.test(raw) || raw.includes("\\")) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (decodedFormLeavesSite(raw, origin)) return null;
  const result = `${url.pathname}${url.search}${url.hash}`;
  // Re-check the normalised result: dot segments can collapse `/.//host` to `//host`.
  if (!result.startsWith("/") || result.startsWith("//") || result.startsWith("/\\")) return null;
  if (!staysOnOrigin(result, origin)) return null;
  return result;
}

/**
 * The same-origin path to go to, or a safe fallback, resolved against an explicit `origin`.
 *
 * Server-safe: no browser global is read, so the OAuth callback route and `lib/auth/oauth.ts` can call it
 * directly. An invalid `origin` yields `DEFAULT_SAFE_RETURN_PATH`, and a `fallback` that is itself not a safe
 * same-origin path is ignored in favour of that constant. Returns `pathname + search + hash` of the parsed URL,
 * never the raw string.
 */
export function sanitizeReturnPath(raw: unknown, fallback: string, origin: string): string {
  const base = normalizeOrigin(origin);
  if (!base) return DEFAULT_SAFE_RETURN_PATH;
  const safeRaw = sanitizeRelative(raw, base);
  if (safeRaw !== null) return safeRaw;
  return sanitizeRelative(fallback, base) ?? DEFAULT_SAFE_RETURN_PATH;
}

/**
 * The same-origin path to go to, or `fallback`.
 * Returns `pathname + search + hash` of the parsed URL, never the raw string. Outside a browser it returns `fallback`.
 */
export function safeReturnPath(raw: string | null | undefined, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return sanitizeReturnPath(raw, fallback, window.location.origin);
}

/**
 * A full page load of `path` (`window.location.assign`), used after sign-in so the whole app starts with the new
 * session. Pass only a value from `safeReturnPath`. Kept here, one function, so tests can observe the navigation
 * (jsdom's `location.assign` cannot be replaced).
 */
export function assignLocation(path: string): void {
  window.location.assign(path);
}
