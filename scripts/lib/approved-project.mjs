// The single approved production Supabase project for this repository.
//
// This module is deliberately credential-free and side-effect-free: it only names
// the approved project and provides pure helpers for comparing a configured value
// against it. Anything that needs the approved ref (the connectivity diagnostic,
// the migration workflow's guard, and their tests) reads it from here so the value
// cannot drift between call sites.
//
// Never add a password, token, key or connection string to this file.
//
// The ref extractors below are fail-closed by design: anything malformed,
// ambiguous or unrecognised yields "" (which every caller treats as "cannot
// verify"). A ref is only returned when exactly one interpretation of the input
// agrees with itself.

import { createHash } from "node:crypto";

/** The only production Supabase project this repository may target. */
export const APPROVED_PROJECT_REF = "kvrkraqjuyxbraccxntk";

/** Public API base URL for the approved project (safe to log; it ships to browsers). */
export const APPROVED_PROJECT_URL = `https://${APPROVED_PROJECT_REF}.supabase.co`;

/** A Supabase project ref is exactly 20 lowercase alphanumerics. */
const REF_RE = /^[a-z0-9]{20}$/;

/**
 * A short, non-reversible fingerprint of a value.
 *
 * Used to compare a configured secret or ref against the approved value in logs
 * without printing the value itself. A SHA-256 prefix is not a secret: it cannot be
 * reversed, and for a 20-character project ref it is an equality check, not a
 * disclosure of anything not already public in the API URL.
 */
export function fingerprint(value) {
  const v = String(value ?? "");
  if (!v) return "(empty)";
  return createHash("sha256").update(v).digest("hex").slice(0, 12);
}

/**
 * Extract the project ref from a `https://<ref>.supabase.co` URL.
 *
 * Returns "" unless the hostname is exactly `<ref>.supabase.co` for a well-formed
 * ref. Hostname suffixes such as `<ref>.supabase.co.evil.com` and userinfo tricks
 * such as `https://<ref>.supabase.co@evil.com` are therefore rejected: the parsed
 * hostname must both end with the literal `.supabase.co` and have exactly one
 * label before it.
 */
export function refFromSupabaseUrl(url) {
  let host;
  try {
    host = new URL(String(url ?? "")).hostname;
  } catch {
    return "";
  }
  const suffix = ".supabase.co";
  if (!host.endsWith(suffix)) return "";
  const label = host.slice(0, -suffix.length);
  // Exactly one label, no dots, and a well-formed ref.
  return REF_RE.test(label) ? label : "";
}

/**
 * Extract the project ref from a PostgreSQL connection string.
 *
 * Supavisor pooler URLs carry the ref in the USERNAME (`postgres.<ref>`) and the
 * region in the hostname. Direct URLs carry it in the hostname
 * (`db.<ref>.supabase.co`). Some connection strings legitimately present both.
 *
 * Fail-closed rules:
 *   - the string must parse as a URL;
 *   - a ref found in the username must be well-formed;
 *   - a ref found in the hostname must be well-formed;
 *   - if BOTH are present they must be EQUAL. A conflict means the string is
 *     ambiguous (e.g. an approved username pointed at another project's host) and
 *     "" is returned rather than picking a winner.
 *
 * When neither location carries a recognisable ref, "" is returned.
 */
export function refFromDbUrl(dbUrl) {
  return analyzeDbUrlRef(dbUrl).ref;
}

/**
 * Explain how a PostgreSQL connection string resolves to a project ref.
 *
 * Returns `{ ref, userRef, hostRef, ambiguous, malformed }` so callers can report
 * *why* a value failed to resolve (malformed URL, no recognisable ref, or two
 * conflicting refs) rather than only that it did. `ref` is "" whenever the input
 * cannot be resolved unambiguously, which is what every caller treats as
 * "cannot verify".
 */
export function analyzeDbUrlRef(dbUrl) {
  const out = { ref: "", userRef: "", hostRef: "", ambiguous: false, malformed: false };
  const raw = String(dbUrl ?? "");
  if (!raw) return out;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    out.malformed = true;
    return out;
  }

  // Username form: postgres.<ref>, decoded and anchored at the end.
  const user = parsed.username || "";
  const decodedUser = (() => {
    try {
      return decodeURIComponent(user);
    } catch {
      return user;
    }
  })();
  if (decodedUser.startsWith("postgres.")) {
    const candidate = decodedUser.slice("postgres.".length);
    if (REF_RE.test(candidate)) out.userRef = candidate;
  }

  // Hostname form: db.<ref>.supabase.co, exactly three labels.
  const host = parsed.hostname || "";
  const hostSuffix = ".supabase.co";
  if (host.startsWith("db.") && host.endsWith(hostSuffix)) {
    const candidate = host.slice("db.".length, -hostSuffix.length);
    if (REF_RE.test(candidate)) out.hostRef = candidate;
  }

  if (out.userRef && out.hostRef) {
    if (out.userRef === out.hostRef) {
      out.ref = out.userRef;
    } else {
      // Conflicting sources: refuse to pick a winner.
      out.ambiguous = true;
    }
    return out;
  }

  out.ref = out.userRef || out.hostRef || "";
  return out;
}

/** True when `value` is exactly the approved project ref. */
export function isApprovedRef(value) {
  return String(value ?? "").trim() === APPROVED_PROJECT_REF;
}
