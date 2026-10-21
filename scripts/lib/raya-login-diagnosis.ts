/**
 * Pure diagnosis of a Raya AI administrator sign-in failure.
 *
 * `signInWithPassword` answers the same `invalid_credentials` for an unknown
 * email and a wrong password, so the client cannot tell the two apart - by
 * design. An operator with the service-role key can, and this module turns the
 * facts into one of a small set of actionable verdicts.
 *
 * It reports *structure*, never a secret: how many Auth users share the address,
 * whether the account has an email/password identity, whether an authorization
 * row is linked to that Auth user id, and the role/active flags. No password, no
 * token, no hash is ever read or returned. The CLI (`scripts/diagnose-raya-admin-login.ts`)
 * does the I/O; every decision lives here so it is unit-tested.
 */

export interface AuthUserLike {
  id: string;
  email?: string | null;
  /** Identity providers linked to the account, e.g. ["email"]. */
  providers?: string[] | null;
  /** ISO timestamp of the last recovery email, if any. Structural, not a secret. */
  recovery_sent_at?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
}

export interface AuthorizationRowLike {
  id: string;
  email: string | null;
  role: string | null;
  active: boolean | null;
  auth_user_id: string | null;
}

export type DiagnosisVerdict =
  | "ok"
  | "no-auth-user"
  | "ambiguous-auth-user"
  | "no-password-identity"
  | "no-profile"
  | "profile-not-linked"
  | "profile-linked-elsewhere"
  | "inactive"
  | "role-not-allowed";

export interface Diagnosis {
  verdict: DiagnosisVerdict;
  /** One line an operator can act on. Contains no secret. */
  summary: string;
  /** Non-sensitive supporting facts. */
  facts: string[];
}

export const ALLOWED_ROLES: ReadonlySet<string> = new Set([
  "super_admin",
  "temple_admin",
  "admin",
  "billing",
  "priest",
  "staff",
  "office_staff",
]);

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeRole(role: unknown): string {
  if (typeof role !== "string") return "";
  return role.trim().toLowerCase().replace(/\s+/g, "_");
}

export interface DiagnoseInput {
  email: string;
  authUsers: AuthUserLike[];
  profiles: AuthorizationRowLike[];
}

/**
 * Decide why sign-in fails, from the account's structural facts.
 *
 * Order matters: an ambiguous email is reported before anything else because
 * every later conclusion would be a guess, and a missing Auth user is reported
 * before the profile checks because no session can ever be obtained.
 */
export function diagnoseRayaAdminLogin(input: DiagnoseInput): Diagnosis {
  const email = normalizeEmail(input.email);
  const facts: string[] = [];

  const authMatches = input.authUsers.filter((u) => normalizeEmail(u.email) === email);

  if (authMatches.length === 0) {
    return {
      verdict: "no-auth-user",
      summary:
        `No Supabase Auth account exists for ${email}. ` +
        "The password can never match: the account must be created (bootstrap script).",
      facts: [`Auth accounts scanned: ${input.authUsers.length}`],
    };
  }

  if (authMatches.length > 1) {
    return {
      verdict: "ambiguous-auth-user",
      summary:
        `${authMatches.length} Supabase Auth accounts share ${email}. ` +
        "Sign-in is not deterministic until the duplicates are resolved.",
      facts: [`Auth account ids differ: ${authMatches.length} matches`],
    };
  }

  const authUser = authMatches[0];
  facts.push(`Auth account found (id present: ${Boolean(authUser.id)})`);

  const providers = (authUser.providers ?? []).map((p) => p.toLowerCase());
  if (providers.length > 0) {
    facts.push(`Identity providers: ${providers.join(", ")}`);
  }
  if (!providers.includes("email")) {
    return {
      verdict: "no-password-identity",
      summary:
        `${email} has no email/password identity, so password sign-in cannot succeed. ` +
        "Set a password on the account (or add the email identity) first.",
      facts,
    };
  }

  if (authUser.email_confirmed_at === null) {
    facts.push("Email is NOT confirmed (sign-in will fail with email_not_confirmed).");
  }
  if (authUser.recovery_sent_at) {
    facts.push(`A recovery email was sent at ${authUser.recovery_sent_at}.`);
  }

  const linked = input.profiles.filter((p) => p.auth_user_id === authUser.id);
  if (linked.length > 1) {
    // The partial unique index should make this impossible; report rather than guess.
    return {
      verdict: "ambiguous-auth-user",
      summary: `${linked.length} authorization rows are linked to the same Auth account.`,
      facts,
    };
  }

  const profile =
    linked[0] ?? input.profiles.find((p) => normalizeEmail(p.email) === email) ?? null;

  if (!profile) {
    return {
      verdict: "no-profile",
      summary:
        `No public.users authorization row exists for ${email}. ` +
        "Even with a correct password, every /api/ai request would answer 403.",
      facts,
    };
  }

  if (!profile.auth_user_id) {
    return {
      verdict: "profile-not-linked",
      summary:
        `The authorization row for ${email} exists but its auth_user_id is NULL. ` +
        "It must be linked to the Auth account (bootstrap link step) before sign-in grants access.",
      facts: [...facts, `profile role=${normalizeRole(profile.role) || "(empty)"} active=${profile.active}`],
    };
  }

  if (profile.auth_user_id !== authUser.id) {
    return {
      verdict: "profile-linked-elsewhere",
      summary:
        `The authorization row for ${email} is linked to a different Auth account id. ` +
        "Sign-in as this account would be treated as a different person.",
      facts,
    };
  }

  const role = normalizeRole(profile.role);
  facts.push(`profile role=${role || "(empty)"} active=${profile.active}`);

  if (profile.active === false) {
    return {
      verdict: "inactive",
      summary: `The authorization row for ${email} is inactive; sign-in would be refused (403).`,
      facts,
    };
  }

  if (!ALLOWED_ROLES.has(role)) {
    return {
      verdict: "role-not-allowed",
      summary:
        `Role "${role || "(empty)"}" is not on the Raya AI allow-list; access would be refused (403).`,
      facts,
    };
  }

  return {
    verdict: "ok",
    summary:
      `Account structure is correct for ${email} (role=${role}, active, linked). ` +
      "If sign-in still fails with invalid_credentials, the stored password does not match. " +
      "Use the Supabase-native reset flow to set a new one; no password is ever read here.",
    facts,
  };
}
