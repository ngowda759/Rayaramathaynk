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
}

/**
 * The stores a staff change writes, in this order (DB §3.2): the sign-in store (Firebase Auth login and Firestore
 * profile), the Supabase `staff` row, then the audit row.
 */
export type StaffChangeStep = 'identity' | 'staff' | 'audit';

/**
 * `error.detail` of a 502 `partial_failure`: a step failed after an earlier write had already gone through.
 * `done` lists the steps that finished; `failed` names the one that did not; `partly` lists the writes of the failed
 * step that did go through ('login', 'profile'); `cause` is the error code of the failure.
 */
export interface StaffPartialFailure {
  done: StaffChangeStep[];
  failed: StaffChangeStep;
  partly?: string[];
  cause?: string;
}
