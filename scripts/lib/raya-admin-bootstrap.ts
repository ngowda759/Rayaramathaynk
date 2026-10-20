/**
 * Pure decision logic for the Raya AI administrator bootstrap.
 *
 * The CLI (`scripts/bootstrap-raya-admin.ts`) does the I/O; every safety rule
 * lives here so it can be unit-tested without a database or credentials.
 *
 * Safety contract, in order of precedence:
 *
 * 1. Identity is never inferred from email alone. Linking an existing
 *    `public.users` row to a Supabase Auth user requires the operator to pass
 *    `RAYA_ADMIN_LINK_LEGACY_EMAIL=1`, and an ambiguous email match (two or more
 *    unlinked rows) always fails closed.
 * 2. An existing role is never overwritten, and an inactive account is never
 *    reactivated, without the matching explicit opt-in flag.
 * 3. Re-running with the same inputs is a no-op once the row is in the desired
 *    state, so the script can be retried safely.
 * 4. A conflicting or duplicate mapping fails closed rather than guessing.
 */

export interface AuthUserLike {
  id: string;
  email?: string | null;
}

export interface ProfileRow {
  id: string;
  email: string | null;
  role: string | null;
  active: boolean | null;
  auth_user_id: string | null;
}

export interface BootstrapPlanInput {
  /** Normalized (trimmed, lower-cased) operator-supplied email. */
  email: string;
  /** Validated, normalized target role. */
  role: string;
  /** Resolved Supabase Auth user id (existing or newly created). */
  authUserId: string;
  /** The `public.users` row already linked to `authUserId`, if any. */
  linkedProfile: ProfileRow | null;
  /** Unlinked (`auth_user_id IS NULL`) rows whose email matches, case-insensitively. */
  legacyProfiles: ProfileRow[];
  forceRole: boolean;
  reactivate: boolean;
  linkLegacy: boolean;
}

export type BootstrapFailureCode =
  | "ambiguous_legacy_email"
  | "legacy_link_requires_opt_in"
  | "inactive_profile_requires_opt_in"
  | "role_change_requires_opt_in";

export type BootstrapPlan =
  | { ok: true; kind: "noop"; profileId: string; warnings: string[] }
  | { ok: true; kind: "insert"; role: string; warnings: string[] }
  | { ok: true; kind: "update"; profileId: string; set: Record<string, unknown>; changes: string[]; warnings: string[] }
  | { ok: true; kind: "link"; profileId: string; set: Record<string, unknown>; changes: string[]; warnings: string[] }
  | { ok: false; code: BootstrapFailureCode; message: string };

/** Trims, lower-cases and joins words with `_`; anything not a string becomes "". */
export function normalizeRole(role: unknown): string {
  if (typeof role !== "string") return "";
  return role.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Lower-cased, trimmed email. The only normalization applied to operator input. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Escape the LIKE metacharacters in a user-supplied email so an `ilike` lookup
 * cannot be widened by a `%` or `_` inside an address. Postgres treats `\` as the
 * default escape character, so this is a faithful literal match.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * Pick the single Supabase Auth user whose email matches. More than one match is
 * ambiguous and fails closed rather than picking one arbitrarily.
 */
export function selectAuthUserByEmail(
  users: AuthUserLike[],
  email: string
): { ok: true; user: AuthUserLike } | { ok: false; count: number } {
  const matches = users.filter((u) => normalizeEmail(u.email ?? "") === email);
  if (matches.length !== 1) return { ok: false, count: matches.length };
  return { ok: true, user: matches[0] };
}

/** Rows that are not yet linked to a Supabase Auth identity but share the email. */
export function filterLegacyProfilesByEmail(
  rows: ProfileRow[],
  email: string
): ProfileRow[] {
  return rows.filter(
    (r) => r.auth_user_id === null && normalizeEmail(r.email ?? "") === email
  );
}

function fail(code: BootstrapFailureCode, message: string): BootstrapPlan {
  return { ok: false, code, message };
}

/**
 * Decide what to write for the resolved Auth user. See the module header for the
 * safety contract; every branch either converges to the desired state or refuses
 * with an explicit, non-sensitive reason.
 */
export function planBootstrap(input: BootstrapPlanInput): BootstrapPlan {
  const { email, role, authUserId, linkedProfile, legacyProfiles } = input;

  if (linkedProfile) {
    const warnings: string[] = [];
    if (legacyProfiles.length > 0) {
      warnings.push(
        `${legacyProfiles.length} unlinked public.users row(s) share the email ${email}; they are left untouched.`
      );
    }

    const currentRole = typeof linkedProfile.role === "string" ? linkedProfile.role : "";
    const roleDiffers = normalizeRole(currentRole) !== role;
    const isInactive = linkedProfile.active === false;

    if (roleDiffers && !input.forceRole) {
      return fail(
        "role_change_requires_opt_in",
        `The authorization row for ${email} already has role "${currentRole}". ` +
          `Refusing to change it. Re-run with RAYA_ADMIN_FORCE_ROLE=1 to set "${role}".`
      );
    }
    if (isInactive && !input.reactivate) {
      return fail(
        "inactive_profile_requires_opt_in",
        `The authorization row for ${email} is inactive. Refusing to reactivate it. ` +
          `Re-run with RAYA_ADMIN_REACTIVATE=1 if this account should be re-enabled.`
      );
    }

    const set: Record<string, unknown> = {};
    const changes: string[] = [];
    if (roleDiffers) {
      set.role = role;
      changes.push("role");
    }
    if (isInactive) {
      set.active = true;
      changes.push("active");
    }

    if (changes.length === 0) {
      return { ok: true, kind: "noop", profileId: linkedProfile.id, warnings };
    }
    return { ok: true, kind: "update", profileId: linkedProfile.id, set, changes, warnings };
  }

  if (legacyProfiles.length > 1) {
    return fail(
      "ambiguous_legacy_email",
      `${legacyProfiles.length} unlinked public.users rows match ${email}. ` +
        `Refusing to guess which one to link. Resolve the duplicates in public.users first.`
    );
  }

  if (legacyProfiles.length === 1) {
    const row = legacyProfiles[0];

    if (!input.linkLegacy) {
      return fail(
        "legacy_link_requires_opt_in",
        `An existing public.users row (${row.id}) has the email ${email} but no Supabase Auth link. ` +
          `Refusing to infer the identity from the email. Re-run with RAYA_ADMIN_LINK_LEGACY_EMAIL=1 ` +
          `to link it to Supabase Auth user ${authUserId} deliberately.`
      );
    }

    const currentRole = typeof row.role === "string" ? row.role : "";
    const roleDiffers = normalizeRole(currentRole) !== role;
    const isInactive = row.active === false;

    if (roleDiffers && !input.forceRole) {
      return fail(
        "role_change_requires_opt_in",
        `The existing row for ${email} has role "${currentRole}". Refusing to change it. ` +
          `Re-run with RAYA_ADMIN_FORCE_ROLE=1 to set "${role}".`
      );
    }
    if (isInactive && !input.reactivate) {
      return fail(
        "inactive_profile_requires_opt_in",
        `The existing row for ${email} is inactive. Refusing to reactivate it. ` +
          `Re-run with RAYA_ADMIN_REACTIVATE=1 if this account should be re-enabled.`
      );
    }

    const set: Record<string, unknown> = { auth_user_id: authUserId };
    const changes: string[] = ["auth_user_id"];
    if (roleDiffers) {
      set.role = role;
      changes.push("role");
    }
    if (isInactive) {
      set.active = true;
      changes.push("active");
    }
    return { ok: true, kind: "link", profileId: row.id, set, changes, warnings: [] };
  }

  return { ok: true, kind: "insert", role, warnings: [] };
}
