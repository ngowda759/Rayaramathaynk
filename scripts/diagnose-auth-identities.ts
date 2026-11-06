#!/usr/bin/env node

/**
 * Read-only diagnostic tool for Phase 2: Supabase Authentication Identity Unification.
 *
 * Enumerates privileged identities across:
 *   - Firebase Authentication
 *   - Supabase Authentication
 *   - public.users
 *   - public.staff
 *
 * Produces a reconciliation report identifying:
 *   - Firebase-only identities
 *   - Supabase-only identities
 *   - Already linked identities
 *   - Identities with matching email but different IDs (manual review required)
 *   - Active admin/staff identities without public.users authorization records
 *   - Ambiguous mappings
 *
 * CRITICAL SAFETY RULES:
 * - Read-only: never performs writes, updates, deletes, or auto-linking.
 * - Never logs or reveals secrets, passwords, tokens, or private keys.
 */

import {
  reconcileIdentities,
  type FirebaseIdentity,
  type SupabaseIdentity,
  type PublicUserRecord,
  type PublicStaffRecord,
} from "./lib/auth-identity-reconciliation";

const line = (s = "") => console.log(s);
const head = (s: string) => line(`\n=== ${s} ===`);

async function fetchSupabaseData() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    line("[WARN] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    return { supabaseUsers: [], publicUsers: [], publicStaff: [] };
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const supabaseUsers: SupabaseIdentity[] = [];
  try {
    let page = 1;
    for (;;) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        line(`[FAIL] supabase.auth.admin.listUsers error: ${error.message}`);
        break;
      }
      for (const u of data.users) {
        supabaseUsers.push({
          id: u.id,
          email: u.email ?? null,
          disabled: Boolean(u.banned_until && new Date(u.banned_until) > new Date()),
          emailConfirmedAt: u.email_confirmed_at ?? null,
        });
      }
      if (data.users.length < 200) break;
      page += 1;
    }
  } catch (err) {
    line(`[FAIL] Could not list Supabase Auth users: ${(err as Error).message}`);
  }

  const publicUsers: PublicUserRecord[] = [];
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, role, active, firestore_id, auth_user_id");
    if (error) {
      line(`[FAIL] users query error: ${error.message}`);
    } else {
      for (const row of data ?? []) {
        const r = row as Record<string, unknown>;
        publicUsers.push({
          id: String(r.id),
          email: typeof r.email === "string" ? r.email : null,
          role: typeof r.role === "string" ? r.role : null,
          active: typeof r.active === "boolean" ? r.active : null,
          firestore_id: typeof r.firestore_id === "string" ? r.firestore_id : null,
          auth_user_id: typeof r.auth_user_id === "string" ? r.auth_user_id : null,
        });
      }
    }
  } catch (err) {
    line(`[FAIL] Could not query public.users: ${(err as Error).message}`);
  }

  const publicStaff: PublicStaffRecord[] = [];
  try {
    // Attempt to select auth_user_id if column exists (Phase 2), else fallback to base columns
    const { data, error } = await supabase
      .from("staff")
      .select("id, email, staff_no, view_only, status, firebase_uid, auth_user_id");
    if (error) {
      // If auth_user_id column is not yet present, query without it
      const fallback = await supabase
        .from("staff")
        .select("id, email, staff_no, view_only, status, firebase_uid");
      if (fallback.error) {
        line(`[FAIL] staff query error: ${fallback.error.message}`);
      } else {
        for (const row of fallback.data ?? []) {
          const r = row as Record<string, unknown>;
          publicStaff.push({
            id: String(r.id),
            email: typeof r.email === "string" ? r.email : null,
            staff_no: Number(r.staff_no),
            role: null,
            active: r.status === "active",
            status: typeof r.status === "string" ? r.status : null,
            firebase_uid: typeof r.firebase_uid === "string" ? r.firebase_uid : null,
            auth_user_id: null,
          });
        }
      }
    } else {
      for (const row of data ?? []) {
        const r = row as Record<string, unknown>;
        publicStaff.push({
          id: String(r.id),
          email: typeof r.email === "string" ? r.email : null,
          staff_no: Number(r.staff_no),
          role: null,
          active: r.status === "active",
          status: typeof r.status === "string" ? r.status : null,
          firebase_uid: typeof r.firebase_uid === "string" ? r.firebase_uid : null,
          auth_user_id: typeof r.auth_user_id === "string" ? r.auth_user_id : null,
        });
      }
    }
  } catch (err) {
    line(`[FAIL] Could not query public.staff: ${(err as Error).message}`);
  }

  return { supabaseUsers, publicUsers, publicStaff };
}

async function fetchFirebaseData() {
  const firebaseUsers: FirebaseIdentity[] = [];
  try {
    const { getAdminApp } = await import("@/lib/admin-firebase");
    const app = await getAdminApp();
    const { getAuth } = await import("firebase-admin/auth");
    const auth = getAuth(app);

    let nextPageToken: string | undefined = undefined;
    do {
      const listResult = await auth.listUsers(200, nextPageToken);
      for (const u of listResult.users) {
        firebaseUsers.push({
          uid: u.uid,
          email: u.email ?? null,
          disabled: u.disabled,
        });
      }
      nextPageToken = listResult.pageToken;
    } while (nextPageToken);
  } catch (err) {
    line(`[INFO] Firebase Admin Auth unavailable or unconfigured: ${(err as Error).message}`);
  }
  return { firebaseUsers };
}

export async function runDiagnostic() {
  head("Phase 2 — Privileged Identity Enumeration & Reconciliation");
  line("Read-only diagnostic scanning Firebase Auth, Supabase Auth, public.users, and public.staff.");
  line("(No passwords, tokens, or credentials are read, stored, or printed.)");

  const [supabaseData, firebaseData] = await Promise.all([
    fetchSupabaseData(),
    fetchFirebaseData(),
  ]);

  const report = reconcileIdentities({
    firebaseUsers: firebaseData.firebaseUsers,
    supabaseUsers: supabaseData.supabaseUsers,
    publicUsers: supabaseData.publicUsers,
    publicStaff: supabaseData.publicStaff,
  });

  head("Identity Counts Summary");
  line(`Firebase Auth identities:   ${report.stats.firebaseCount}`);
  line(`Supabase Auth identities:   ${report.stats.supabaseCount}`);
  line(`public.users records:       ${report.stats.publicUsersCount}`);
  line(`public.staff records:       ${report.stats.publicStaffCount}`);
  line(`Already linked identities:  ${report.stats.linkedCount}`);
  line(`Firebase-only identities:   ${report.stats.firebaseOnlyCount}`);
  line(`Supabase-only identities:   ${report.stats.supabaseOnlyCount}`);
  line(`Matching email, diff IDs:   ${report.stats.matchingEmailDifferentIdsCount}`);
  line(`Active staff w/o user rec:  ${report.stats.orphanedActiveIdentitiesCount}`);
  line(`Ambiguous mappings:         ${report.stats.ambiguousCount}`);

  if (report.linkedIdentities.length > 0) {
    head("Already Linked Identities");
    for (const id of report.linkedIdentities) {
      line(`- ${id.email ?? "(no email)"} (Firebase UID: ${id.firebaseUid} <-> Supabase ID: ${id.supabaseAuthId}, role: ${id.role ?? "none"}, active: ${id.active})`);
    }
  }

  if (report.emailMatchDifferentIds.length > 0) {
    head("Matching Email With Different IDs (Action Required: Manual Review)");
    line("IMPORTANT: Never auto-linked based solely on email. The following accounts require operator review:");
    for (const m of report.emailMatchDifferentIds) {
      line(`- Email: ${m.email}`);
      line(`  Firebase UID:    ${m.firebaseUid}`);
      line(`  Supabase Auth:   ${m.supabaseAuthId}`);
      line(`  Review Note:     ${m.reviewNote}`);
    }
  }

  if (report.activeWithoutPublicUser.length > 0) {
    head("Active Staff/Identities Lacking public.users Authorization Records");
    for (const o of report.activeWithoutPublicUser) {
      line(`- [${o.source}] ${o.email ?? o.id}: ${o.note}`);
    }
  }

  if (report.ambiguousMappings.length > 0) {
    head("Ambiguous Mappings");
    for (const a of report.ambiguousMappings) {
      line(`- ${a.email ?? "(no email)"}: ${a.reason}`);
    }
  }

  head("Reconciliation Status");
  if (report.stats.ambiguousCount === 0 && report.stats.matchingEmailDifferentIdsCount === 0) {
    line("CLEAN: No conflicting or ambiguous identities found.");
  } else {
    line(`ACTION REQUIRED: ${report.stats.matchingEmailDifferentIdsCount} email match(es) with differing IDs and ${report.stats.ambiguousCount} ambiguous mapping(s) flagged.`);
  }

  return report;
}

if (require.main === module) {
  runDiagnostic()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("[FATAL] Diagnostic failed:", err);
      process.exit(1);
    });
}
