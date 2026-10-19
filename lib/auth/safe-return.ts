/**
 * Where a person may be sent after signing in (A4S security gate, H-1).
 *
 * `/login?redirect=` and the admin guard's relay of a page's own `?redirect=` are attacker-controlled. Only a path on
 * this site is followed: anything else (`//host`, backslash tricks, whitespace or control characters the URL parser
 * strips, `https:`, `javascript:` and their encoded forms once decoded) gives the fallback. The caller passes the
 * value as `searchParams.get` returns it, already percent-decoded, so `%2F%2F` cannot slip past.
 */

/** Control characters, whitespace (space and below) and DEL, all of which the URL parser strips or ignores. */
const CONTROL_OR_SPACE = /[\u0000- \u007f]/;

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
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * A full page load of `path` (`window.location.assign`), used after sign-in so the whole app starts with the new
 * session. Pass only a value from `safeReturnPath`. Kept here, one function, so tests can observe the navigation
 * (jsdom's `location.assign` cannot be replaced).
 */
export function assignLocation(path: string): void {
  window.location.assign(path);
}
