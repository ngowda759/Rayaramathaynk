/**
 * Seva Entry - staff and roles DTOs (wire format; DB §3.2, §3.4, §13.6).
 *
 * Built by the staff routes (`app/api/seva/staff/**`, Task A3-5) from the Supabase `staff` row plus the role held in
 * Firestore `users/{uid}` - the single source of roles (DB §3.2). Times are ISO-8601 strings. No phone number is ever
 * part of a staff answer.
 */
import type { SevaRole } from '@/types/seva';

export type StaffStatus = 'invited' | 'active' | 'inactive' | 'deleted';

/** 'active' lists active and invited people; 'inactive' lists inactive and deleted ones (both cannot sign in). */
export type StaffListFilter = 'all' | 'active' | 'inactive';

export interface StaffMember {
  id: string;
  staffNo: number;
  fullName: string;
  email: string;
  /** The Firestore role mapped to a seva role; null for a legacy or missing role (C-62). */
  role: SevaRole | null;
  viewOnly: boolean;
  status: StaffStatus;
  /** Latest of first sign-in, an audited action and a receipt issued; null when none is known. */
  lastActiveAt: string | null;
  invitedAt: string | null;
  firstSignedInAt: string | null;
}

export interface StaffListResponse {
  staff: StaffMember[];
}

export interface NextStaffNoResponse {
  nextStaffNo: number;
}

export interface StaffOnboardResponse {
  staffId: string;
  staffNo: number;
  /** An existing website account was linked: no new login, so no set-password email (they keep their password). */
  linkedExisting?: true;
}

/**
 * The 400 `validation` detail when the email already has a website account and the request did not confirm linking
 * it (`linkExisting`). Nothing was written; the office confirms and sends the request again with `linkExisting: true`.
 */
export interface StaffExistingAccountDetail {
  field: "email";
  reason: "existing_account";
  /** Their Firestore role as stored (e.g. 'admin', 'devotee'), or null when they have no profile. */
  currentRole: string | null;
  /** Their Firestore `isActive`; false shows "currently inactive; linking makes it active"; null with no profile. */
  currentlyActive: boolean | null;
  displayName: string | null;
  message: string;
}

/**
 * Why an email's existing website account can never be linked, as the 400 `validation` detail `reason` (with
 * `field: 'email'` and a `message`): its email is not verified (anyone can register a login for any email), or its
 * sign-in is switched off. Nothing was written.
 */
export type StaffUnlinkableReason = "unverified_account" | "disabled_account";

/**
 * The stores a staff change writes, in this order (DB §3.2): the sign-in store (Firebase Auth login and Firestore
 * profile), the Supabase `staff` row, then the audit row.
 */
export type StaffChangeStep = 'identity' | 'staff' | 'audit';

/**
 * `error.detail` of a 502 `partial_failure`: a step failed after an earlier write had already gone through.
 * `done` lists the steps that finished; `failed` names the one that did not; `partly` lists the writes of the failed
 * step that did go through ('login', 'profile'); `cause` is the error code of the failure. When an existing website
 * account was being linked, `previous_role` and `previous_active` say what its profile held before the link overwrote
 * it (named as in the staff.onboard audit row), so a retry or the office can put it back.
 */
export interface StaffPartialFailure {
  done: StaffChangeStep[];
  failed: StaffChangeStep;
  partly?: string[];
  cause?: string;
  previous_role?: string | null;
  previous_active?: boolean | null;
}
