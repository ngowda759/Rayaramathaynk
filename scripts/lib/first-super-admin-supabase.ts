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
 *    the plan refuses and the CLI reports it. The repair of a missing, unlinked,
 *    inactive or wrongly-roled row is a SEPARATE, separately authorized step
 *    (`scripts/bootstrap-raya-admin.ts`, the only writer of
 *    `public.users.auth_user_id`/`role`); this script never repairs it, and the
 *    website admin Users page cannot repair it because its own authorization
 *    guard reads the same broken profile.
 * 3. The Supabase Auth account itself must be eligible: its email address must be
 *    confirmed and it must not be banned/disabled. Either may be overridden only
 *    by an explicit owner opt-in (`allowUnverifiedEmail` / `allowDisabledAccount`).
 * 4. The staff table must be empty. Once anyone is on it, people are onboarded on
 *    the Staff and roles page; this bootstrap is only for the very first row.
 * 5. Idempotent: when a staff row already belongs to this account the plan is a
 *    no-op and nothing is written, so a rerun is safe.
 * 6. A refusal always carries at least one blocker, and a plan with any blocker is
 *    never safe to write. Every refusal is classified so the dry-run report can
 *    say plainly whether the account is ready, needs a profile repair, or is not
 *    eligible.
 */

/** The Supabase Auth account, reduced to what the plan needs. */
export interface AuthUserLike {
  id: string;
  email: string | null;
  displayName?: string | null;
  /** The Supabase Auth account is banned (`banned_until` in the future) or disabled. */
  disabled: boolean;
  /** The Supabase Auth email address is confirmed (`email_confirmed_at` set). */
  emailVerified: boolean;
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
  /**
   * null = the system/bootstrap wrote it, not a person in the app. This is the
   * established convention for an out-of-band script (see
   * `scripts/seva/create-first-super-admin.ts` and `scripts/seva/seed-demo-data.ts`,
   * which both pass `p_staff_id: null`). The new staff member did not perform the
   * action, so attributing it to them would be a lie.
   */
  actorStaffId: null;
}

export type FirstSuperAdminAction = "create" | "noop" | "refuse";

/**
 * The headline a dry-run report leads with:
 *  - `ready`                    all prerequisites met; safe to create staff 001.
 *  - `already_set_up`           a staff row already belongs to this account; nothing to do.
 *  - `profile_repair_required`  the `public.users` authorization profile is missing,
 *                               unlinked, inactive or not super_admin; repair it first
 *                               through the separately authorized bootstrap.
 *  - `not_eligible`             the account or the staff table makes this bootstrap
 *                               inapplicable (Auth account banned/unverified, staff
 *                               table not empty, staff 001 or the email already taken).
 */
export type FirstSuperAdminClassification =
  | "ready"
  | "already_set_up"
  | "profile_repair_required"
  | "not_eligible";

/** Why the `public.users` authorization profile needs a separately authorized repair. */
export type ProfileRepairReason =
  | "missing_row"
  | "not_linked"
  | "linked_to_another_identity"
  | "not_super_admin"
  | "inactive";

/** The owner-approved repair path for a broken authorization profile. */
export interface ProfileRepair {
  reasons: ProfileRepairReason[];
  /** A copy-pasteable, secret-free command that repairs the profile. */
  command: string;
  /** Why the website admin Users page cannot perform this repair. */
  note: string;
}

export interface FirstSuperAdminPlan {
  /** `create` writes one staff row; `noop` writes nothing (already set up); `refuse` writes nothing. */
  action: FirstSuperAdminAction;
  /** The headline for the dry-run report (see FirstSuperAdminClassification). */
  classification: FirstSuperAdminClassification;
  /** True only when there are no blockers: the CLI may write when the caller also confirms. */
  safe: boolean;
  /** Every blocker (the union of the two groups below), so nothing is hidden. */
  blockers: string[];
  /** The subset of blockers that a separately authorized profile repair would clear. */
  profileBlockers: string[];
  /** The subset of blockers that make the account or the staff table ineligible. */
  eligibilityBlockers: string[];
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
  /** Set only when `classification` is `profile_repair_required`. */
  repair: ProfileRepair | null;
}

export const FIRST_SUPER_ADMIN_AUDIT_REASON =
  "First super admin, made by scripts/seva/create-first-super-admin-supabase.ts (system bootstrap; no acting staff member)";
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
export function nameFor(authUser: Pick<AuthUserLike, "email" | "displayName">): string {
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
  /** Owner opt-in: allow an unconfirmed Supabase Auth email address. */
  allowUnverifiedEmail?: boolean;
  /** Owner opt-in: allow a banned/disabled Supabase Auth account. */
  allowDisabledAccount?: boolean;
}

/** The repair command for the reasons found. Flags map 1:1 to the Raya bootstrap's own opt-ins. */
function repairCommand(reasons: readonly ProfileRepairReason[]): string {
  const flags: string[] = [];
  if (reasons.includes("not_linked")) flags.push("RAYA_ADMIN_LINK_LEGACY_EMAIL=1");
  if (reasons.includes("inactive")) flags.push("RAYA_ADMIN_REACTIVATE=1");
  if (reasons.includes("not_super_admin")) flags.push("RAYA_ADMIN_FORCE_ROLE=1");
  const flagLine = flags.length > 0 ? `${flags.join(" ")} \\\n  ` : "";
  return (
    `RAYA_ADMIN_EMAIL="<the account's email>" \\\n  ` +
    `RAYA_ADMIN_PASSWORD="<only needed if the Auth user is missing>" \\\n  ` +
    `RAYA_ADMIN_ROLE="super_admin" \\\n  ` +
    `${flagLine}npx tsx scripts/bootstrap-raya-admin.ts`
  );
}

const REPAIR_NOTE =
  "The website admin Users page cannot repair this: its own authorization guard reads the same broken profile, so " +
  "it denies access. Run the separately authorized bootstrap above (it is the only writer of public.users.auth_user_id/role).";

export function planFirstSuperAdmin(input: PlanInput): FirstSuperAdminPlan {
  const { authUser, profile, profileMatch, staffRows, now = new Date().toISOString() } = input;
  const uid = authUser.id;
  const email = normalizeEmail(authUser.email);
  const warnings: string[] = [];
  const profileBlockers: string[] = [];
  const eligibilityBlockers: string[] = [];
  const repairReasons: ProfileRepairReason[] = [];

  // ---- Supabase Auth account eligibility (never changed here, only verified) ---
  if (authUser.disabled && !input.allowDisabledAccount) {
    eligibilityBlockers.push(
      "The Supabase Auth account is banned or disabled. Re-enable it in Supabase Auth, or re-run with " +
        "--allow-disabled-account if the owner explicitly authorizes making a disabled account staff 001.",
    );
  }
  if (!authUser.emailVerified && !input.allowUnverifiedEmail) {
    eligibilityBlockers.push(
      "The Supabase Auth email address is not confirmed. Confirm it, or re-run with --allow-unverified-email if " +
        "the owner explicitly authorizes it.",
    );
  }

  // ---- public.users authorization checks (never changed, only verified) -------
  if (!profile) {
    repairReasons.push("missing_row");
    profileBlockers.push(
      "No public.users row matches this account (looked up by auth_user_id, firestore_id and email). It needs a " +
        "separately authorized repair before this bootstrap can run.",
    );
  } else {
    const role = normalizeRole(profile.role);
    if (role !== "super_admin") {
      repairReasons.push("not_super_admin");
      profileBlockers.push(
        `public.users.role is "${String(profile.role)}" (reads as "${role || "(empty)"}"), not super_admin. This ` +
          "script never changes an existing role; it needs a separately authorized repair.",
      );
    }
    if (profile.active !== true) {
      repairReasons.push("inactive");
      profileBlockers.push(
        `public.users.active is ${String(profile.active)}, not true. It needs a separately authorized repair.`,
      );
    }
    if (profile.auth_user_id !== uid) {
      if (profile.auth_user_id === null) {
        repairReasons.push("not_linked");
        profileBlockers.push(
          "public.users.auth_user_id is null: the row is not linked to this Supabase Auth UUID. It needs a " +
            "separately authorized repair.",
        );
      } else {
        repairReasons.push("linked_to_another_identity");
        profileBlockers.push(
          `public.users.auth_user_id is "${profile.auth_user_id}", not this account's Supabase Auth UUID (${uid}). ` +
            "The row is linked to a different identity; review it manually before repairing.",
        );
      }
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
    // Idempotent: already set up, write nothing. Any profile problem is surfaced but does not change the action.
    const blockers = [...eligibilityBlockers, ...profileBlockers];
    return {
      action: "noop",
      classification: "already_set_up",
      safe: blockers.length === 0,
      blockers,
      profileBlockers,
      eligibilityBlockers,
      warnings,
      authUser: { id: uid, email: authUser.email ?? null },
      profileMatch,
      profile,
      existingStaffForUid,
      staff001,
      staffRows,
      plannedStaffRow: null,
      plannedAudit: null,
      repair: null,
    };
  }

  if (staff001) {
    eligibilityBlockers.push(
      `Staff no. 001 already belongs to another account (${staff001.email}). This script only makes the first ` +
        "super admin; nothing was changed.",
    );
  }
  if (staffRows.length > 0) {
    eligibilityBlockers.push(
      `The staff table already has ${staffRows.length} row(s). Onboard people on the Staff and roles page; this ` +
        "bootstrap only creates the very first staff row.",
    );
  }
  if (email && staffRows.some((row) => normalizeEmail(row.email) === email)) {
    eligibilityBlockers.push(`A staff row already uses the email ${email}.`);
  }

  const blockers = [...eligibilityBlockers, ...profileBlockers];

  if (blockers.length > 0) {
    // An ineligible account/staff table dominates: this bootstrap simply does not apply. Otherwise the fix is the
    // separately authorized profile repair.
    const classification: FirstSuperAdminClassification =
      eligibilityBlockers.length > 0 ? "not_eligible" : "profile_repair_required";
    return {
      action: "refuse",
      classification,
      safe: false,
      blockers,
      profileBlockers,
      eligibilityBlockers,
      warnings,
      authUser: { id: uid, email: authUser.email ?? null },
      profileMatch,
      profile,
      existingStaffForUid,
      staff001,
      staffRows,
      plannedStaffRow: null,
      plannedAudit: null,
      repair:
        classification === "profile_repair_required"
          ? { reasons: repairReasons, command: repairCommand(repairReasons), note: REPAIR_NOTE }
          : null,
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
    classification: "ready",
    safe: true,
    blockers,
    profileBlockers,
    eligibilityBlockers,
    warnings,
    authUser: { id: uid, email: authUser.email ?? null },
    profileMatch,
    profile,
    existingStaffForUid,
    staff001,
    staffRows,
    plannedStaffRow,
    plannedAudit: {
      action: "staff.onboard",
      entity: "staff",
      reason: FIRST_SUPER_ADMIN_AUDIT_REASON,
      actorStaffId: null,
    },
    repair: null,
  };
}

export const FIRST_SUPER_ADMIN_STAFF_NO = FIRST_STAFF_NO;
