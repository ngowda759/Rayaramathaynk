/**
 * Identity-provisioning invariants shared by the sign-up and session routes.
 *
 * Per docs/auth/PHASE-2-IDENTITY-UNIFICATION.md §3, an email address is never
 * proof of account ownership. A matching email may therefore only be used to
 * DETECT a conflict and refuse — never to bind an existing `public.users` row to
 * a new Supabase Auth identity. That rule holds even when the address is
 * verified, because verification proves control of the mailbox, not ownership of
 * the temple account behind the row.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeLikePattern, quoteFilterValue } from "@/lib/supabase/filters";

/**
 * Deliberately neutral: it must not reveal whether the existing row is
 * privileged, unlinked, or inactive. Reconciliation is an administrative act.
 */
export const EMAIL_CONFLICT_MESSAGE =
  "An account with this email already exists and cannot be claimed automatically. Please contact the temple office.";

/** Denial for an authenticated identity whose address Supabase has not confirmed (or has none). */
export const EMAIL_NOT_VERIFIED_MESSAGE =
  "Email verification is required before this account can be provisioned";

/**
 * True only when Supabase reports a confirmed address. A valid sign-in is not enough: provisioning
 * requires proof of mailbox ownership, and phone-only identities are deliberately not admitted.
 */
export function isConfirmedEmail(emailConfirmedAt: string | null | undefined): boolean {
  return typeof emailConfirmedAt === "string" && emailConfirmedAt.trim().length > 0;
}

/** PostgreSQL unique-violation (SQLSTATE 23505), plus the PostgREST text fallback. */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  return code === "23505" || /duplicate key|already exists/i.test(message || "");
}

/** Canonical stored/looked-up address: trimmed and lower-cased. */
export function normalizeEmailAddress(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

/** `email.ilike."<escaped>"` — case-insensitive equality with no wildcards. */
export function emailEqualsFilter(email: string): string {
  return `email.ilike.${quoteFilterValue(escapeLikePattern(normalizeEmailAddress(email)))}`;
}

export interface EmailConflictRow {
  id: string;
  auth_user_id: string | null;
}

/**
 * Rows that already carry `email` and are **not** owned by `callerUid`.
 *
 * A non-empty result means the caller must not be provisioned: inserting would
 * create a duplicate account, and linking would be the prohibited email-based
 * adoption. `ok: false` means the check itself failed, which callers must treat
 * as fail-closed rather than "no conflict".
 *
 * The SQL pattern may match more rows than intended (`_` and `%` are LIKE
 * wildcards, and PostgREST unescapes the quoted value), so the result is
 * re-compared exactly in JS. Widening can therefore never invent a conflict.
 */
export async function findEmailConflicts(
  supabase: SupabaseClient,
  email: string | null | undefined,
  callerUid: string
): Promise<{ ok: true; conflicts: EmailConflictRow[] } | { ok: false }> {
  const normalized = normalizeEmailAddress(email);
  if (!normalized) return { ok: true, conflicts: [] };

  const { data, error } = await supabase
    .from("users")
    .select("id, auth_user_id, email")
    .or(emailEqualsFilter(normalized));

  if (error) return { ok: false };

  const rows = (Array.isArray(data) ? data : []) as (EmailConflictRow & { email?: string | null })[];
  return {
    ok: true,
    conflicts: rows.filter(
      (row) =>
        typeof row.email === "string" &&
        row.email.trim().toLowerCase() === normalized &&
        row.auth_user_id !== callerUid
    ),
  };
}

/**
 * Re-read the caller's own row after a unique-violation race.
 *
 * A row that is not linked to `callerUid` is never returned: adopting whatever
 * row happens to exist after a conflict is how an unlinked or foreign-owned
 * account gets silently taken over.
 */
export async function findOwnedRowAfterConflict<Row extends { auth_user_id: string | null }>(
  supabase: SupabaseClient,
  callerUid: string,
  columns: string
): Promise<{ ok: true; row: Row | null } | { ok: false }> {
  const { data, error } = await supabase
    .from("users")
    .select(columns)
    .eq("auth_user_id", callerUid)
    .maybeSingle();

  if (error) return { ok: false };

  const row = (data ?? null) as Row | null;
  if (row && row.auth_user_id !== callerUid) return { ok: true, row: null };
  return { ok: true, row };
}

/**
 * Resolve or create the caller's own `public.users` row, applying the rules above in one place so
 * that every self-provisioning entry point (the session route and the OAuth callback) behaves the
 * same way.
 *
 * - `linked`     — a row already carries this `auth_user_id`. No write; the caller's own row.
 * - `created`    — no row existed and none held this address, so a `devotee` row was inserted.
 * - `conflict`   — the address is held by an unlinked or foreign-owned row. No write; nothing is
 *                  returned, because returning that row would be the prohibited email-based link.
 * - `unverified` — the identity has no confirmed email. No read and no write.
 * - `error`      — the check or the write failed. Callers fail closed.
 */
export type DevoteeProvisionOutcome<Row> =
  | { status: "linked"; row: Row }
  | { status: "created"; row: Row }
  | { status: "conflict" }
  | { status: "unverified" }
  | { status: "error" };

export async function provisionDevoteeRow<Row extends { auth_user_id: string | null }>(
  supabase: SupabaseClient,
  params: {
    uid: string;
    email: string | null;
    emailConfirmedAt: string | null | undefined;
    displayName: string;
    columns: string;
  }
): Promise<DevoteeProvisionOutcome<Row>> {
  const { uid, email, emailConfirmedAt, displayName, columns } = params;

  // A confirmed address is required before any identity-dependent read. This mirrors every
  // provisioning route and keeps the rule in one place for future callers.
  if (!email || !isConfirmedEmail(emailConfirmedAt)) {
    return { status: "unverified" };
  }

  const normalizedEmail = normalizeEmailAddress(email);

  const { data: own, error: ownError } = await supabase
    .from("users")
    .select(columns)
    .eq("auth_user_id", uid)
    .maybeSingle();

  if (ownError) return { status: "error" };
  if (own && (own as unknown as { auth_user_id: string | null }).auth_user_id === uid) {
    return { status: "linked", row: own as unknown as Row };
  }

  const conflictCheck = await findEmailConflicts(supabase, normalizedEmail, uid);
  if (!conflictCheck.ok) return { status: "error" };
  if (conflictCheck.conflicts.length > 0) return { status: "conflict" };

  const { data: created, error: insertError } = await supabase
    .from("users")
    .insert({
      email: normalizedEmail,
      role: "devotee",
      active: true,
      display_name: displayName,
      auth_user_id: uid,
    })
    .select(columns)
    .single();

  if (insertError || !created) {
    if (!isUniqueViolation(insertError)) return { status: "error" };

    // A concurrent insert won the race. Only a row demonstrably owned by this caller is success.
    const recheck = await findOwnedRowAfterConflict<Row>(supabase, uid, columns);
    if (!recheck.ok) return { status: "error" };
    if (recheck.row) return { status: "linked", row: recheck.row };
    return { status: "conflict" };
  }

  return { status: "created", row: created as unknown as Row };
}
