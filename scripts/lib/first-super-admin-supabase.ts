/**
 * Pure decision logic for the Supabase-native first super admin bootstrap
 * (`scripts/seva/create-first-super-admin-supabase.ts`).
 *
 * The CLI does the I/O (Supabase Auth Admin reads, `public.users` / `public.staff`
 * reads, and - only when explicitly confirmed - the staff insert and audit row);
 * every safety rule lives here so it can be unit-tested without a database, a
 * network or any credentials. This module performs no I/O and imports nothing
 * from Firebase or Firestore.
 *
 * What it builds: staff no. 001 - the first super admin - for an existing
 * Supabase Auth account. It is the Supabase-native replacement for
 * `scripts/seva/create-first-super-admin.ts`, which is Firebase-bound (it reads a
 * Firebase service account and writes the Firestore profile) and cannot run
 * against the Supabase-native production database.
 *
 * Safety contract, in order of precedence:
 *
 * 1. The account must already exist in Supabase Auth; this script never creates a
 *    login. The caller resolves the Auth user (by email or UUID) before planning.
 * 2. The account's `public.users` row must already say `role = super_admin` and
 *    `active = true`, and must already be linked to this Supabase Auth UUID
 *    (`auth_user_id = uid`). A role that is not super_admin is NEVER changed -
 *    the plan refuses and the CLI reports it.
 * 3. The staff table must be empty. Once anyone is on it, people are onboarded on
 *    the Staff and roles page; this bootstrap is only for the very first row.
 * 4. Idempotent: when a staff row already belongs to this account the plan is a
 *    no-op and nothing is written, so a rerun is safe.
 * 5. A refusal always carries at least one blocker, and a plan with any blocker is
 *    never safe to write.
 */

/** The Supabase Auth account, reduced to what the plan needs. */
export interface AuthUserLike {
  id: string;
  email: string | null;
  displayName?: string | null;
}

/** The `public.users` authorization row, as the CLI reads it. */
export interface UserProfileRow {
  id: string;
  email: string | null;
  role: unknown;
  active: boolean | null;
  auth_user_id: string | null;
  firestore_id: string | null;
}

/** The `public.staff` row, as the CLI reads it. */
export interface StaffRow {
  id: string;
  firebase_uid: string;
  auth_user_id: string | null;
  staff_no: number;
  full_name: string;
  email: string;
  view_only: boolean;
  status: string;
}

/** The exact row the bootstrap would insert. */
export interface PlannedStaffRow {
  firebase_uid: string;
  auth_user_id: string;
  staff_no: number;
  full_name: string;
  email: string;
  view_only: boolean;
  status: string;
  /** The account already signed in to reach this page, so the row is active from the start. */
  first_signed_in_at: string;
}

/** The audit row the bootstrap would write after the insert. */
export interface PlannedAudit {
  action: "staff.onboard";
  entity: "staff";
  reason: string;
}

export type FirstSuperAdminAction = "create" | "noop" | "refuse";

export interface FirstSuperAdminPlan {
  /** `create` writes one staff row; `noop` writes nothing (already set up); `refuse` writes nothing. */
  action: FirstSuperAdminAction;
  /** True only when there are no blockers: the CLI may write when the caller also confirms. */
  safe: boolean;
  blockers: string[];
  warnings: string[];
  authUser: { id: string; email: string | null };
  /** How the `public.users` row was matched, for the dry-run report. */
  profileMatch: "auth_user_id" | "firestore_id" | "email" | "none";
  profile: UserProfileRow | null;
  /** Existing staff rows that already reference this account (by auth_user_id or firebase_uid). */
  existingStaffForUid: StaffRow[];
  /** The row that currently holds staff no. 001, whoever it belongs to. */
  staff001: StaffRow | null;
  /** Every staff row, so the report can show the table is empty. */
  staffRows: StaffRow[];
  plannedStaffRow: PlannedStaffRow | null;
  plannedAudit: PlannedAudit | null;
}

export const FIRST_SUPER_ADMIN_AUDIT_REASON =
  "First super admin, made by scripts/seva/create-first-super-admin-supabase.ts";
const FIRST_STAFF_NO = 1;
const NAME_MAX = 80;

/** Trims, lower-cases and joins words with `_`; anything not a string becomes "". Mirrors lib/auth/admin-auth.ts. */
export function normalizeRole(role: unknown): string {
  if (typeof role !== "string") return "";
  return role.trim().toLowerCase().replace(/\s+/g, "_");
}

export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

/** The display name: the Auth display name, else the email's local part; trimmed and cut to 80 characters. */
export function nameFor(authUser: AuthUserLike): string {
  const email = normalizeEmail(authUser.email);
  const name = (authUser.displayName ?? "").trim() || (email ? email.split("@")[0] : "");
  return Array.from(name).slice(0, NAME_MAX).join("").trim();
}

/** The first free name when the account has neither a display name nor an email local part. */
function fallbackName(): string {
  return "Super Admin";
}

export interface PlanInput {
  authUser: AuthUserLike;
  profile: UserProfileRow | null;
  profileMatch: FirstSuperAdminPlan["profileMatch"];
  staffRows: StaffRow[];
  /** The write timestamp for `first_signed_in_at`; defaults to now. Injected so tests are deterministic. */
  now?: string;
}

export function planFirstSuperAdmin(input: PlanInput): FirstSuperAdminPlan {
  const { authUser, profile, profileMatch, staffRows, now = new Date().toISOString() } = input;
  const uid = authUser.id;
  const email = normalizeEmail(authUser.email);
  const blockers: string[] = [];
  const warnings: string[] = [];

  // ---- public.users authorization checks (never changed, only verified) -------
  if (!profile) {
    blockers.push(
      "No public.users row matches this account (looked up by auth_user_id, firestore_id and email). " +
        "Set the account's role to Super Admin on the Website admin Users page first.",
    );
  } else {
    const role = normalizeRole(profile.role);
    if (role !== "super_admin") {
      blockers.push(
        `public.users.role is "${String(profile.role)}" (reads as "${role || "(empty)"}"), not super_admin. ` +
          "This script never changes an existing role; set it to Super Admin first.",
      );
    }
    if (profile.active !== true) {
      blockers.push(`public.users.active is ${String(profile.active)}, not true. Activate the account first.`);
    }
    if (profile.auth_user_id !== uid) {
      blockers.push(
        `public.users.auth_user_id is ${profile.auth_user_id ? `"${profile.auth_user_id}"` : "null"}, ` +
          `not this account's Supabase Auth UUID (${uid}). The account must be linked to this identity first.`,
      );
    }
    if (email && normalizeEmail(profile.email) !== email) {
      warnings.push(
        `public.users.email is "${String(profile.email)}" while the Auth account's email is "${email}". ` +
          "Check these are the same person.",
      );
    }
  }

  // ---- staff checks ----------------------------------------------------------
  const existingStaffForUid = staffRows.filter((row) => row.auth_user_id === uid || row.firebase_uid === uid);
  const staff001 = staffRows.find((row) => row.staff_no === FIRST_STAFF_NO) ?? null;

  if (existingStaffForUid.length > 0) {
    if (existingStaffForUid.length > 1) {
      warnings.push(`${existingStaffForUid.length} staff rows already reference this account; review them.`);
    }
    // Idempotent: already set up, write nothing.
    return {
      action: "noop",
      safe: blockers.length === 0,
      blockers,
      warnings,
      authUser: { id: uid, email: authUser.email ?? null },
      profileMatch,
      profile,
      existingStaffForUid,
      staff001,
      staffRows,
      plannedStaffRow: null,
      plannedAudit: null,
    };
  }

  if (staff001) {
    blockers.push(
      `Staff no. 001 already belongs to another account (${staff001.email}). This script only makes the first ` +
        "super admin; nothing was changed.",
    );
  }
  if (staffRows.length > 0) {
    blockers.push(
      `The staff table already has ${staffRows.length} row(s). Onboard people on the Staff and roles page; this ` +
        "bootstrap only creates the very first staff row.",
    );
  }
  if (email && staffRows.some((row) => normalizeEmail(row.email) === email)) {
    blockers.push(`A staff row already uses the email ${email}.`);
  }

  if (blockers.length > 0) {
    return {
      action: "refuse",
      safe: false,
      blockers,
      warnings,
      authUser: { id: uid, email: authUser.email ?? null },
      profileMatch,
      profile,
      existingStaffForUid,
      staff001,
      staffRows,
      plannedStaffRow: null,
      plannedAudit: null,
    };
  }

  const fullName = nameFor(authUser) || fallbackName();
  const plannedStaffRow: PlannedStaffRow = {
    // firebase_uid is the same Supabase Auth UUID: the column is NOT NULL in the
    // current schema and the code only ever treats it as an opaque "external login
    // id" (it is fed straight back into getAccessProfile, which already accepts a
    // UUID). It is never parsed as a Firebase UID.
    firebase_uid: uid,
    auth_user_id: uid,
    staff_no: FIRST_STAFF_NO,
    full_name: fullName,
    email,
    view_only: false,
    status: "active",
    first_signed_in_at: now,
  };

  return {
    action: "create",
    safe: true,
    blockers,
    warnings,
    authUser: { id: uid, email: authUser.email ?? null },
    profileMatch,
    profile,
    existingStaffForUid,
    staff001,
    staffRows,
    plannedStaffRow,
    plannedAudit: { action: "staff.onboard", entity: "staff", reason: FIRST_SUPER_ADMIN_AUDIT_REASON },
  };
}

export const FIRST_SUPER_ADMIN_STAFF_NO = FIRST_STAFF_NO;
