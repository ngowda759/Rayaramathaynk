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

/** PostgreSQL unique-violation (SQLSTATE 23505), plus the PostgREST text fallback. */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  return code === "23505" || /duplicate key|already exists/i.test(message || "");
}

/** `email.ilike."<escaped>"` — case-insensitive equality with no wildcards. */
export function emailEqualsFilter(email: string): string {
  return `email.ilike.${quoteFilterValue(escapeLikePattern(email.trim().toLowerCase()))}`;
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
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
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
