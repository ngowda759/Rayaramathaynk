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
  source: "firebase" | "supabase" | "staff";
  id: string;
  email: string | null;
  staffNo?: number | null;
  note: string;
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
        reason: `Multiple Firebase accounts share email ${em}`,
        details: { count: list.length, uids: list.map((x) => x.uid) },
      });
    }
  }
  for (const [em, list] of sbByEmail.entries()) {
    if (list.length > 1) {
      ambiguousMappings.push({
        email: em,
        reason: `Multiple Supabase Auth accounts share email ${em}`,
        details: { count: list.length, ids: list.map((x) => x.id) },
      });
    }
  }
  for (const [em, list] of usersByEmail.entries()) {
    if (list.length > 1) {
      ambiguousMappings.push({
        email: em,
        reason: `Multiple public.users rows share email ${em}`,
        details: { count: list.length, ids: list.map((x) => x.id) },
      });
    }
  }
  for (const [em, list] of staffByEmail.entries()) {
    if (list.length > 1) {
      ambiguousMappings.push({
        email: em,
        reason: `Multiple public.staff rows share email ${em}`,
        details: { count: list.length, ids: list.map((x) => x.id), staff_nos: list.map((x) => x.staff_no) },
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
          note: `Active staff member (staff_no: ${s.staff_no}) has no public.users authorization record.`,
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
  };
}
