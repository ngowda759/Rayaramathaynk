/**
 * Reconciles a `public.users` authorization row with a Supabase Auth identity during staff onboarding.
 *
 * `users.auth_user_id` is the authoritative identity mapping. An email may only *find* a legacy row that has
 * no identity yet, and only when the office explicitly confirms the link (`linkExisting`). It never
 * establishes or replaces a link on its own: a row already linked to another Auth user is never overwritten,
 * several rows for one email are never resolved by guessing, and a stored address that differs only by
 * case or spacing is treated as a different account rather than silently normalized.
 */

import { tryNormalizeEmailAddress } from "@/lib/auth/email-normalization";

export interface UsersIdentityRow {
  id: string;
  email: string | null;
  auth_user_id: string | null;
  role: string | null;
  active: boolean | null;
  display_name: string | null;
}

export type UsersIdentityRefusal = "ambiguous" | "foreign" | "non-normalized";

export type UsersIdentityLinkPlan =
  | { kind: "none" }
  | { kind: "already-linked"; row: UsersIdentityRow }
  | { kind: "link"; row: UsersIdentityRow }
  | { kind: "needs-confirmation"; row: UsersIdentityRow }
  | { kind: "refuse"; reason: UsersIdentityRefusal };

export interface UsersIdentityLinkInput {
  /** The resolved Supabase Auth UUID, or null while a new login is still to be created. */
  authUserId: string | null;
  /** The onboarding email, already trimmed and lower-cased by the request schema. */
  email: string;
  /** The office confirmed that an existing website account may be linked. */
  linkExisting: boolean;
  /** Candidate `public.users` rows whose stored email contains this address (case-insensitive). */
  rows: readonly UsersIdentityRow[];
}

/** Canonical form under the shared contract; "" when the value cannot be normalized. */
export function normalizeUsersEmail(value: string): string {
  const result = tryNormalizeEmailAddress(value);
  return result.ok ? result.email : "";
}

/** True only when the value is a valid, canonicalizable address under the shared contract. */
export function isNormalizableUsersEmail(value: string): boolean {
  return tryNormalizeEmailAddress(value).ok;
}

export function planUsersIdentityLink(input: UsersIdentityLinkInput): UsersIdentityLinkPlan {
  const { authUserId, email, linkExisting, rows } = input;
  const normalized = normalizeUsersEmail(email);
  if (!normalized) return { kind: "refuse", reason: "non-normalized" };

  // The Auth identity already owns a row: that row is authoritative and nothing is linked by email.
  if (authUserId) {
    const linked = rows.find((row) => row.auth_user_id === authUserId);
    if (linked) return { kind: "already-linked", row: linked };
  }

  // A row that already carries an identity is never overwritten, and a second row is never created for it.
  if (rows.some((row) => row.email === email && row.auth_user_id !== null)) {
    return { kind: "refuse", reason: "foreign" };
  }

  // A malformed stored address cannot be proven different safely: refuse rather than ignore it.
  if (rows.some((row) => !isNormalizableUsersEmail(row.email ?? ""))) {
    return { kind: "refuse", reason: "non-normalized" };
  }

  // A stored address that differs only by case or spacing is a different account: refuse rather than guess.
  if (rows.some((row) => row.email !== email && normalizeUsersEmail(row.email ?? "") === normalized)) {
    return { kind: "refuse", reason: "non-normalized" };
  }

  const unlinked = rows.filter((row) => row.email === email && row.auth_user_id === null);
  if (unlinked.length > 1) return { kind: "refuse", reason: "ambiguous" };
  if (unlinked.length === 1) {
    return linkExisting ? { kind: "link", row: unlinked[0] } : { kind: "needs-confirmation", row: unlinked[0] };
  }
  return { kind: "none" };
}
