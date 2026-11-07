/**
 * Pure, deterministic identity enumeration and reconciliation logic.
 *
 * Compares identities across:
 *  1. Firebase Authentication
 *  2. Supabase Authentication
 *  3. public.users (PostgreSQL)
 *  4. public.staff (PostgreSQL)
 *
 * CRITICAL SAFETY RULES:
 * - Read-only: never alters, writes, or links any data.
 * - Never auto-links accounts based solely on email.
 * - Conflicting or ambiguous identities are explicitly flagged for manual review.
 * - Exposes no passwords, hashes, tokens, or private keys.
 */

export type QueryStatusKind =
  | "SUCCESS"
  | "MISSING_CREDENTIALS"
  | "AUTH_FAILURE"
  | "QUERY_FAILURE";

export interface ProviderQueryStatus {
  source: "Firebase Auth" | "Supabase Auth" | "public.users" | "public.staff";
  queriedSuccessfully: boolean;
  statusKind: QueryStatusKind;
  statusText: string;
  total: number | null;
  error?: string;
  queryVariant?: string;
}

/**
 * Masks an email address to protect PII while preserving domain context.
 * e.g. "admin@example.com" -> "a***n@e***.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "(no email)";
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return trimmed.length <= 4 ? "***" : `${trimmed.slice(0, 2)}***${trimmed.slice(-1)}`;
  }
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  const maskedLocal =
    local.length <= 2
      ? `${local[0]}***`
      : `${local[0]}***${local.slice(-1)}`;

  const dotIndex = domain.lastIndexOf(".");
  if (dotIndex > 0) {
    const dName = domain.slice(0, dotIndex);
    const tld = domain.slice(dotIndex + 1);
    const maskedDomain = dName.length <= 2 ? `${dName[0]}***` : `${dName[0]}***`;
    return `${maskedLocal}@${maskedDomain}.${tld}`;
  }
  return `${maskedLocal}@${domain.slice(0, 1)}***`;
}

/**
 * Masks an identifier (UUID, Firebase UID, etc.) while preserving prefix/suffix for correlation.
 * e.g. "c9e12345-6789-4abc-def0-123456789701" -> "c9e...701"
 */
export function maskId(id: string | null | undefined): string {
  if (!id) return "(none)";
  const str = String(id).trim();
  if (str.length <= 6) return `${str.slice(0, 1)}***`;
  return `${str.slice(0, 3)}...${str.slice(-3)}`;
}

/**
 * Masks a staff number for privacy while preserving the final digit.
 * e.g. 42 -> "*2", 105 -> "**5"
 */
export function maskStaffNo(staffNo: number | string | null | undefined): string {
  if (staffNo === null || staffNo === undefined) return "N/A";
  const str = String(staffNo).trim();
  if (str.length <= 1) return `*${str}`;
  return `*`.repeat(str.length - 1) + str.slice(-1);
}

/**
 * Redacts any raw email addresses or UUIDs inside a free-form string or note.
 */
export function redactSensitiveText(text: string): string {
  if (!text) return "";
  let result = text.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    (match) => maskEmail(match)
  );
  result = result.replace(
    /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
    (match) => maskId(match)
  );
  return result;
}

/**
 * Determines whether a database error specifically indicates that a column is missing.
 * Postgres code 42703: undefined_column.
 * PostgREST schema cache error referencing the column.
 * Never returns true for authentication, permission, timeout, or general network errors.
 */
export function isMissingColumnError(error: unknown, columnName = "auth_user_id"): boolean {
  if (!error) return false;
  const errObj = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const code = typeof errObj.code === "string" ? errObj.code : "";
  const msg = typeof errObj.message === "string" ? errObj.message : String(error);
  const details = typeof errObj.details === "string" ? errObj.details : "";
  const combined = `${code} ${msg} ${details}`.toLowerCase();
  const col = columnName.toLowerCase();

  // Postgres 42703 is undefined_column
  if (code === "42703") {
    return true;
  }

  // PostgREST column missing from schema cache or column does not exist
  if (
    (code === "PGRST204" || combined.includes("schema cache") || combined.includes("does not exist")) &&
    combined.includes(col)
  ) {
    return true;
  }

  if (
    combined.includes(`column "${col}" does not exist`) ||
    combined.includes(`column ${col} does not exist`) ||
    combined.includes(`could not find the '${col}' column`)
  ) {
    return true;
  }

  return false;
}

/**
 * Classifies a query or database error into AUTH_FAILURE or QUERY_FAILURE.
 */
export function classifyError(error: unknown): { kind: "AUTH_FAILURE" | "QUERY_FAILURE"; message: string } {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);

  const lower = msg.toLowerCase();
  const errObj = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const code = typeof errObj.code === "string" ? errObj.code.toLowerCase() : "";

  if (
    code === "42501" || // postgres permission_denied
    code === "pgrst301" || // postgrest jwt invalid / expired
    lower.includes("jwt") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("permission denied") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("invalid api key") ||
    lower.includes("auth/") ||
    lower.includes("credential")
  ) {
    return { kind: "AUTH_FAILURE", message: redactSensitiveText(msg) };
  }
  return { kind: "QUERY_FAILURE", message: redactSensitiveText(msg) };
}

export interface FirebaseIdentity {
  uid: string;
  email: string | null;
  disabled: boolean;
}

export interface SupabaseIdentity {
  id: string;
  email: string | null;
  disabled: boolean;
  emailConfirmedAt?: string | null;
}

export interface PublicUserRecord {
  id: string;
  email: string | null;
  role: string | null;
  active: boolean | null;
  firestore_id: string | null;
  auth_user_id: string | null;
}

export interface PublicStaffRecord {
  id: string;
  email: string | null;
  staff_no: number;
  role?: string | null;
  department?: string | null;
  active: boolean | null;
  status?: string | null;
  firebase_uid: string | null;
  auth_user_id?: string | null;
}

export interface ReconcileInput {
  firebaseUsers: FirebaseIdentity[];
  supabaseUsers: SupabaseIdentity[];
  publicUsers: PublicUserRecord[];
  publicStaff: PublicStaffRecord[];
}

export interface LinkedIdentity {
  email: string | null;
  firebaseUid: string;
  supabaseAuthId: string;
  publicUserId: string | null;
  staffId: string | null;
  role: string | null;
  active: boolean;
  linkedVia: "users" | "staff" | "both";
}

export interface FirebaseOnlyIdentity {
  uid: string;
  email: string | null;
  disabled: boolean;
  hasPublicUser: boolean;
  hasStaff: boolean;
}

export interface SupabaseOnlyIdentity {
  id: string;
  email: string | null;
  disabled: boolean;
  hasPublicUser: boolean;
  hasStaff: boolean;
}

export interface EmailMatchDifferentId {
  email: string;
  firebaseUid: string;
  supabaseAuthId: string;
  publicUsersFirestoreId: string | null;
  publicUsersAuthUserId: string | null;
  staffFirebaseUid: string | null;
  staffAuthUserId: string | null;
  reviewNote: string;
}

export interface OrphanedActiveIdentity {
  source: "firebase" | "supabase" | "staff" | "users";
  id: string;
  email: string | null;
  staffNo?: number | null;
  note: string;
}

export interface DuplicateIdFinding {
  type: "auth_user_id" | "firebase_uid";
  value: string;
  source: "public.users" | "public.staff";
  occurrences: number;
  records: Array<{ id: string; email: string | null; role?: string | null; staffNo?: number | null }>;
}

export interface AmbiguousMapping {
  email: string | null;
  reason: string;
  details: Record<string, unknown>;
}

export interface ReconciliationReport {
  stats: {
    firebaseCount: number;
    supabaseCount: number;
    publicUsersCount: number;
    publicStaffCount: number;
    linkedCount: number;
    firebaseOnlyCount: number;
    supabaseOnlyCount: number;
    matchingEmailDifferentIdsCount: number;
    orphanedActiveIdentitiesCount: number;
    ambiguousCount: number;
  };
  linkedIdentities: LinkedIdentity[];
  firebaseOnlyIdentities: FirebaseOnlyIdentity[];
  supabaseOnlyIdentities: SupabaseOnlyIdentity[];
  emailMatchDifferentIds: EmailMatchDifferentId[];
  activeWithoutPublicUser: OrphanedActiveIdentity[];
  ambiguousMappings: AmbiguousMapping[];
  duplicateAuthUserIds: DuplicateIdFinding[];
  duplicateFirebaseUids: DuplicateIdFinding[];
  activeAdminsWithoutMapping: OrphanedActiveIdentity[];
  activeStaffWithoutMapping: OrphanedActiveIdentity[];
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Reconciles authentication identities across providers and database tables.
 */
export function reconcileIdentities(input: ReconcileInput): ReconciliationReport {
  const { firebaseUsers, supabaseUsers, publicUsers, publicStaff } = input;

  const linkedIdentities: LinkedIdentity[] = [];
  const firebaseOnlyIdentities: FirebaseOnlyIdentity[] = [];
  const supabaseOnlyIdentities: SupabaseOnlyIdentity[] = [];
  const emailMatchDifferentIds: EmailMatchDifferentId[] = [];
  const activeWithoutPublicUser: OrphanedActiveIdentity[] = [];
  const ambiguousMappings: AmbiguousMapping[] = [];

  // Indexing
  const fbByUid = new Map<string, FirebaseIdentity>();
  const fbByEmail = new Map<string, FirebaseIdentity[]>();
  for (const u of firebaseUsers) {
    fbByUid.set(u.uid, u);
    const em = normalizeEmail(u.email);
    if (em) {
      const list = fbByEmail.get(em) || [];
      list.push(u);
      fbByEmail.set(em, list);
    }
  }

  const sbById = new Map<string, SupabaseIdentity>();
  const sbByEmail = new Map<string, SupabaseIdentity[]>();
  for (const u of supabaseUsers) {
    sbById.set(u.id, u);
    const em = normalizeEmail(u.email);
    if (em) {
      const list = sbByEmail.get(em) || [];
      list.push(u);
      sbByEmail.set(em, list);
    }
  }

  const usersByFirestoreId = new Map<string, PublicUserRecord>();
  const usersByAuthUserId = new Map<string, PublicUserRecord>();
  const usersByEmail = new Map<string, PublicUserRecord[]>();
  for (const u of publicUsers) {
    if (u.firestore_id) usersByFirestoreId.set(u.firestore_id, u);
    if (u.auth_user_id) usersByAuthUserId.set(u.auth_user_id, u);
    const em = normalizeEmail(u.email);
    if (em) {
      const list = usersByEmail.get(em) || [];
      list.push(u);
      usersByEmail.set(em, list);
    }
  }

  const staffByFirebaseUid = new Map<string, PublicStaffRecord>();
  const staffByAuthUserId = new Map<string, PublicStaffRecord>();
  const staffByEmail = new Map<string, PublicStaffRecord[]>();
  for (const s of publicStaff) {
    if (s.firebase_uid) staffByFirebaseUid.set(s.firebase_uid, s);
    if (s.auth_user_id) staffByAuthUserId.set(s.auth_user_id, s);
    const em = normalizeEmail(s.email);
    if (em) {
      const list = staffByEmail.get(em) || [];
      list.push(s);
      staffByEmail.set(em, list);
    }
  }

  // 1. Check for ambiguous email records in any provider or table
  for (const [em, list] of fbByEmail.entries()) {
    if (list.length > 1) {
      ambiguousMappings.push({
        email: em,
        reason: `Multiple Firebase accounts share email ${maskEmail(em)}`,
        details: { count: list.length, uids: list.map((x) => maskId(x.uid)) },
      });
    }
  }
  for (const [em, list] of sbByEmail.entries()) {
    if (list.length > 1) {
      ambiguousMappings.push({
        email: em,
        reason: `Multiple Supabase Auth accounts share email ${maskEmail(em)}`,
        details: { count: list.length, ids: list.map((x) => maskId(x.id)) },
      });
    }
  }
  for (const [em, list] of usersByEmail.entries()) {
    if (list.length > 1) {
      ambiguousMappings.push({
        email: em,
        reason: `Multiple public.users rows share email ${maskEmail(em)}`,
        details: { count: list.length, ids: list.map((x) => maskId(x.id)) },
      });
    }
  }
  for (const [em, list] of staffByEmail.entries()) {
    if (list.length > 1) {
      ambiguousMappings.push({
        email: em,
        reason: `Multiple public.staff rows share email ${maskEmail(em)}`,
        details: { count: list.length, ids: list.map((x) => maskId(x.id)), staff_nos: list.map((x) => maskStaffNo(x.staff_no)) },
      });
    }
  }

  // 2. Discover identities linked via public.users or public.staff
  const linkedFbUids = new Set<string>();
  const linkedSbIds = new Set<string>();

  // Check public.users where both firestore_id and auth_user_id are populated
  for (const u of publicUsers) {
    if (u.firestore_id && u.auth_user_id) {
      const fbUser = fbByUid.get(u.firestore_id);
      const sbUser = sbById.get(u.auth_user_id);
      const staff = staffByFirebaseUid.get(u.firestore_id) ?? staffByAuthUserId.get(u.auth_user_id) ?? null;

      linkedIdentities.push({
        email: u.email ?? fbUser?.email ?? sbUser?.email ?? null,
        firebaseUid: u.firestore_id,
        supabaseAuthId: u.auth_user_id,
        publicUserId: u.id,
        staffId: staff?.id ?? null,
        role: u.role ?? staff?.role ?? null,
        active: u.active !== false && !fbUser?.disabled && !sbUser?.disabled,
        linkedVia: staff?.auth_user_id && staff.firebase_uid ? "both" : "users",
      });
      linkedFbUids.add(u.firestore_id);
      linkedSbIds.add(u.auth_user_id);
    }
  }

  // Check public.staff where both firebase_uid and auth_user_id are populated but not already in linkedIdentities
  for (const s of publicStaff) {
    if (s.firebase_uid && s.auth_user_id && !linkedFbUids.has(s.firebase_uid)) {
      const fbUser = fbByUid.get(s.firebase_uid);
      const sbUser = sbById.get(s.auth_user_id);
      const userRec = usersByFirestoreId.get(s.firebase_uid) ?? usersByAuthUserId.get(s.auth_user_id) ?? null;

      linkedIdentities.push({
        email: s.email ?? fbUser?.email ?? sbUser?.email ?? null,
        firebaseUid: s.firebase_uid,
        supabaseAuthId: s.auth_user_id,
        publicUserId: userRec?.id ?? null,
        staffId: s.id,
        role: s.role ?? userRec?.role ?? null,
        active: s.active !== false && !fbUser?.disabled && !sbUser?.disabled,
        linkedVia: "staff",
      });
      linkedFbUids.add(s.firebase_uid);
      linkedSbIds.add(s.auth_user_id);
    }
  }

  // 3. Find matching emails with different IDs that are NOT linked in the DB
  for (const [em, fbList] of fbByEmail.entries()) {
    const sbList = sbByEmail.get(em);
    if (sbList && fbList.length === 1 && sbList.length === 1) {
      const fb = fbList[0];
      const sb = sbList[0];
      if (!linkedFbUids.has(fb.uid) || !linkedSbIds.has(sb.id)) {
        const userByFb = usersByFirestoreId.get(fb.uid);
        const userBySb = usersByAuthUserId.get(sb.id);
        const staffByFb = staffByFirebaseUid.get(fb.uid);
        const staffBySb = staffByAuthUserId.get(sb.id);

        emailMatchDifferentIds.push({
          email: em,
          firebaseUid: fb.uid,
          supabaseAuthId: sb.id,
          publicUsersFirestoreId: userByFb?.firestore_id ?? null,
          publicUsersAuthUserId: userBySb?.auth_user_id ?? null,
          staffFirebaseUid: staffByFb?.firebase_uid ?? null,
          staffAuthUserId: staffBySb?.auth_user_id ?? null,
          reviewNote:
            "Same email exists in both Firebase Auth and Supabase Auth with distinct IDs, " +
            "but accounts are not explicitly linked in the database. Requires manual review before linking.",
        });
      }
    }
  }

  // 4. Identify Firebase-only identities
  for (const fb of firebaseUsers) {
    if (!linkedFbUids.has(fb.uid)) {
      const em = normalizeEmail(fb.email);
      const hasSb = em ? (sbByEmail.get(em)?.length ?? 0) > 0 : false;
      if (!hasSb) {
        firebaseOnlyIdentities.push({
          uid: fb.uid,
          email: fb.email,
          disabled: fb.disabled,
          hasPublicUser: usersByFirestoreId.has(fb.uid),
          hasStaff: staffByFirebaseUid.has(fb.uid),
        });
      }
    }
  }

  // 5. Identify Supabase-only identities
  for (const sb of supabaseUsers) {
    if (!linkedSbIds.has(sb.id)) {
      const em = normalizeEmail(sb.email);
      const hasFb = em ? (fbByEmail.get(em)?.length ?? 0) > 0 : false;
      if (!hasFb) {
        supabaseOnlyIdentities.push({
          id: sb.id,
          email: sb.email,
          disabled: sb.disabled,
          hasPublicUser: usersByAuthUserId.has(sb.id),
          hasStaff: staffByAuthUserId.has(sb.id),
        });
      }
    }
  }

  // 6. Find active staff/admin without a corresponding public.users authorization record
  for (const s of publicStaff) {
    const isStaffActive = s.active !== false && s.status !== "inactive" && s.status !== "deleted";
    if (isStaffActive) {
      const hasUser =
        (s.firebase_uid && usersByFirestoreId.has(s.firebase_uid)) ||
        (s.auth_user_id && usersByAuthUserId.has(s.auth_user_id)) ||
        (s.email && (usersByEmail.get(normalizeEmail(s.email))?.length ?? 0) > 0);

      if (!hasUser) {
        activeWithoutPublicUser.push({
          source: "staff",
          id: s.id,
          email: s.email,
          staffNo: s.staff_no,
          note: `Active staff member (staff_no: ${maskStaffNo(s.staff_no)}) has no public.users authorization record.`,
        });
      }
    }
  }

  for (const fb of firebaseUsers) {
    if (!fb.disabled) {
      const hasUser = usersByFirestoreId.has(fb.uid);
      const staff = staffByFirebaseUid.get(fb.uid);
      const isStaff = staff && staff.status !== "inactive" && staff.status !== "deleted";
      // If user is staff or has an admin-looking email, check if public.users is missing
      if (!hasUser && isStaff) {
        activeWithoutPublicUser.push({
          source: "firebase",
          id: fb.uid,
          email: fb.email,
          staffNo: staff?.staff_no ?? null,
          note: `Active Firebase user with staff record lacks public.users authorization record.`,
        });
      }
    }
  }

  for (const sb of supabaseUsers) {
    if (!sb.disabled) {
      const hasUser = usersByAuthUserId.has(sb.id);
      const staff = staffByAuthUserId.get(sb.id);
      const isStaff = staff && staff.status !== "inactive" && staff.status !== "deleted";
      if (!hasUser && isStaff) {
        activeWithoutPublicUser.push({
          source: "supabase",
          id: sb.id,
          email: sb.email,
          staffNo: staff?.staff_no ?? null,
          note: `Active Supabase user with staff record lacks public.users authorization record.`,
        });
      }
    }
  }

  // 7. Authorization Safety Checks
  // 7a. Active administrators without authorization mapping
  const activeAdminsWithoutMapping: OrphanedActiveIdentity[] = [];
  for (const u of publicUsers) {
    const isAdmin = u.role === "super_admin" || u.role === "temple_admin" || u.role === "admin";
    const isActive = u.active !== false;
    if (isAdmin && isActive && !u.auth_user_id && !u.firestore_id) {
      activeAdminsWithoutMapping.push({
        source: "users",
        id: u.id,
        email: u.email,
        note: `Active administrator (role: ${u.role}) lacks both auth_user_id and firestore_id mapping.`,
      });
    }
  }

  // 7b. Active staff without authorization mapping (neither auth_user_id nor firebase_uid)
  const activeStaffWithoutMapping: OrphanedActiveIdentity[] = [];
  for (const s of publicStaff) {
    const isStaffActive = s.active !== false && s.status !== "inactive" && s.status !== "deleted";
    if (isStaffActive && !s.auth_user_id && !s.firebase_uid) {
      activeStaffWithoutMapping.push({
        source: "staff",
        id: s.id,
        email: s.email,
        staffNo: s.staff_no,
        note: `Active staff member (staff_no: ${maskStaffNo(s.staff_no)}) lacks both auth_user_id and firebase_uid mapping.`,
      });
    }
  }

  // 7c. Duplicate auth_user_id across public.users or public.staff
  const usersByAuthIdList = new Map<string, PublicUserRecord[]>();
  for (const u of publicUsers) {
    if (u.auth_user_id) {
      const list = usersByAuthIdList.get(u.auth_user_id) || [];
      list.push(u);
      usersByAuthIdList.set(u.auth_user_id, list);
    }
  }

  const staffByAuthIdList = new Map<string, PublicStaffRecord[]>();
  for (const s of publicStaff) {
    if (s.auth_user_id) {
      const list = staffByAuthIdList.get(s.auth_user_id) || [];
      list.push(s);
      staffByAuthIdList.set(s.auth_user_id, list);
    }
  }

  const duplicateAuthUserIds: DuplicateIdFinding[] = [];
  for (const [val, list] of usersByAuthIdList.entries()) {
    if (list.length > 1) {
      duplicateAuthUserIds.push({
        type: "auth_user_id",
        value: val,
        source: "public.users",
        occurrences: list.length,
        records: list.map((r) => ({ id: r.id, email: r.email, role: r.role })),
      });
    }
  }
  for (const [val, list] of staffByAuthIdList.entries()) {
    if (list.length > 1) {
      duplicateAuthUserIds.push({
        type: "auth_user_id",
        value: val,
        source: "public.staff",
        occurrences: list.length,
        records: list.map((r) => ({ id: r.id, email: r.email, staffNo: r.staff_no })),
      });
    }
  }

  // 7d. Duplicate Firebase UID across public.users (firestore_id) or public.staff (firebase_uid)
  const usersByFbUidList = new Map<string, PublicUserRecord[]>();
  for (const u of publicUsers) {
    if (u.firestore_id) {
      const list = usersByFbUidList.get(u.firestore_id) || [];
      list.push(u);
      usersByFbUidList.set(u.firestore_id, list);
    }
  }

  const staffByFbUidList = new Map<string, PublicStaffRecord[]>();
  for (const s of publicStaff) {
    if (s.firebase_uid) {
      const list = staffByFbUidList.get(s.firebase_uid) || [];
      list.push(s);
      staffByFbUidList.set(s.firebase_uid, list);
    }
  }

  const duplicateFirebaseUids: DuplicateIdFinding[] = [];
  for (const [val, list] of usersByFbUidList.entries()) {
    if (list.length > 1) {
      duplicateFirebaseUids.push({
        type: "firebase_uid",
        value: val,
        source: "public.users",
        occurrences: list.length,
        records: list.map((r) => ({ id: r.id, email: r.email, role: r.role })),
      });
    }
  }
  for (const [val, list] of staffByFbUidList.entries()) {
    if (list.length > 1) {
      duplicateFirebaseUids.push({
        type: "firebase_uid",
        value: val,
        source: "public.staff",
        occurrences: list.length,
        records: list.map((r) => ({ id: r.id, email: r.email, staffNo: r.staff_no })),
      });
    }
  }

  return {
    stats: {
      firebaseCount: firebaseUsers.length,
      supabaseCount: supabaseUsers.length,
      publicUsersCount: publicUsers.length,
      publicStaffCount: publicStaff.length,
      linkedCount: linkedIdentities.length,
      firebaseOnlyCount: firebaseOnlyIdentities.length,
      supabaseOnlyCount: supabaseOnlyIdentities.length,
      matchingEmailDifferentIdsCount: emailMatchDifferentIds.length,
      orphanedActiveIdentitiesCount: activeWithoutPublicUser.length,
      ambiguousCount: ambiguousMappings.length,
    },
    linkedIdentities,
    firebaseOnlyIdentities,
    supabaseOnlyIdentities,
    emailMatchDifferentIds,
    activeWithoutPublicUser,
    ambiguousMappings,
    duplicateAuthUserIds,
    duplicateFirebaseUids,
    activeAdminsWithoutMapping,
    activeStaffWithoutMapping,
  };
}
