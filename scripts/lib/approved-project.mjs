// The single approved production Supabase project for this repository.
//
// This module is deliberately credential-free and side-effect-free: it only names
// the approved project and provides pure helpers for comparing a configured value
// against it. Anything that needs the approved ref (the connectivity diagnostic,
// the migration workflow's guard, and their tests) reads it from here so the value
// cannot drift between call sites.
//
// Never add a password, token, key or connection string to this file.

import { createHash } from "node:crypto";

/** The only production Supabase project this repository may target. */
export const APPROVED_PROJECT_REF = "kvrkraqjuyxbraccxntk";

/** Public API base URL for the approved project (safe to log; it ships to browsers). */
export const APPROVED_PROJECT_URL = `https://${APPROVED_PROJECT_REF}.supabase.co`;

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

/** Extract the project ref from a `https://<ref>.supabase.co` URL. */
export function refFromSupabaseUrl(url) {
  try {
    const host = new URL(String(url ?? "")).hostname;
    return host.endsWith(".supabase.co") ? host.split(".")[0] : "";
  } catch {
    return "";
  }
}

/**
 * Extract the project ref from a PostgreSQL connection string.
 *
 * Supavisor pooler URLs carry the ref in the USERNAME (`postgres.<ref>`) and the
 * region in the hostname, so the host is not a reliable source. A direct
 * (`db.<ref>.supabase.co`) URL carries it in the hostname instead.
 */
export function refFromDbUrl(dbUrl) {
  const raw = String(dbUrl ?? "");
  if (!raw) return "";
  const fromUser = /postgres\.([a-z0-9]{20})/.exec(raw);
  if (fromUser) return fromUser[1];
  const fromHost = /db\.([a-z0-9]{20})\.supabase\.co/.exec(raw);
  if (fromHost) return fromHost[1];
  return "";
}

/** True when `value` is exactly the approved project ref. */
export function isApprovedRef(value) {
  return String(value ?? "").trim() === APPROVED_PROJECT_REF;
}
