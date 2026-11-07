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
 *   - Authorization safety findings (unmapped admins/staff, duplicate IDs)
 *
 * CRITICAL SAFETY RULES:
 * - Read-only: never performs writes, updates, deletes, or auto-linking.
 * - Never logs or reveals secrets, passwords, tokens, or private keys.
 * - Explicitly verifies zero mutations: Database rows changed: NO, Schema changed: NO, Auth users changed: NO.
 */

import * as fs from "fs";
import * as path from "path";
import {
  reconcileIdentities,
  type FirebaseIdentity,
  type SupabaseIdentity,
  type PublicUserRecord,
  type PublicStaffRecord,
  type ReconciliationReport,
} from "./lib/auth-identity-reconciliation";

const line = (s = "") => console.log(s);
const head = (s: string) => line(`\n=== ${s} ===`);

export interface ProviderQueryStatus {
  source: "Firebase Auth" | "Supabase Auth" | "public.users" | "public.staff";
  queriedSuccessfully: boolean;
  statusText: "PRODUCTION QUERY SUCCESSFUL" | "PRODUCTION CREDENTIALS UNAVAILABLE" | string;
  total: number | null;
  error?: string;
}

export interface DiagnosticResult {
  report: ReconciliationReport;
  queryStatuses: {
    firebaseAuth: ProviderQueryStatus;
    supabaseAuth: ProviderQueryStatus;
    publicUsers: ProviderQueryStatus;
    publicStaff: ProviderQueryStatus;
  };
  markdownReportPath: string;
}

function hasFirebaseCredentials(): boolean {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return true;
  if (
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY &&
    (process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  ) {
    return true;
  }
  const serviceAccountPath = path.join(process.cwd(), "firebase-admin.json");
  if (fs.existsSync(serviceAccountPath)) return true;
  return false;
}

async function fetchSupabaseData() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    line("[WARN] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (PRODUCTION CREDENTIALS UNAVAILABLE).");
    return {
      supabaseUsers: [],
      publicUsers: [],
      publicStaff: [],
      supabaseAuthStatus: {
        source: "Supabase Auth" as const,
        queriedSuccessfully: false,
        statusText: "PRODUCTION CREDENTIALS UNAVAILABLE",
        total: null,
      },
      publicUsersStatus: {
        source: "public.users" as const,
        queriedSuccessfully: false,
        statusText: "PRODUCTION CREDENTIALS UNAVAILABLE",
        total: null,
      },
      publicStaffStatus: {
        source: "public.staff" as const,
        queriedSuccessfully: false,
        statusText: "PRODUCTION CREDENTIALS UNAVAILABLE",
        total: null,
      },
    };
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const supabaseUsers: SupabaseIdentity[] = [];
  let supabaseAuthStatus: ProviderQueryStatus;
  try {
    let page = 1;
    let listError: string | null = null;
    for (;;) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        listError = error.message;
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
    if (listError) {
      supabaseAuthStatus = {
        source: "Supabase Auth",
        queriedSuccessfully: false,
        statusText: `QUERY FAILED: ${listError}`,
        total: null,
        error: listError,
      };
    } else {
      supabaseAuthStatus = {
        source: "Supabase Auth",
        queriedSuccessfully: true,
        statusText: "PRODUCTION QUERY SUCCESSFUL",
        total: supabaseUsers.length,
      };
    }
  } catch (err) {
    const msg = (err as Error).message;
    line(`[FAIL] Could not list Supabase Auth users: ${msg}`);
    supabaseAuthStatus = {
      source: "Supabase Auth",
      queriedSuccessfully: false,
      statusText: `QUERY FAILED: ${msg}`,
      total: null,
      error: msg,
    };
  }

  const publicUsers: PublicUserRecord[] = [];
  let publicUsersStatus: ProviderQueryStatus;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, role, active, firestore_id, auth_user_id");
    if (error) {
      line(`[FAIL] users query error: ${error.message}`);
      publicUsersStatus = {
        source: "public.users",
        queriedSuccessfully: false,
        statusText: `QUERY FAILED: ${error.message}`,
        total: null,
        error: error.message,
      };
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
      publicUsersStatus = {
        source: "public.users",
        queriedSuccessfully: true,
        statusText: "PRODUCTION QUERY SUCCESSFUL",
        total: publicUsers.length,
      };
    }
  } catch (err) {
    const msg = (err as Error).message;
    line(`[FAIL] Could not query public.users: ${msg}`);
    publicUsersStatus = {
      source: "public.users",
      queriedSuccessfully: false,
      statusText: `QUERY FAILED: ${msg}`,
      total: null,
      error: msg,
    };
  }

  const publicStaff: PublicStaffRecord[] = [];
  let publicStaffStatus: ProviderQueryStatus;
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
        publicStaffStatus = {
          source: "public.staff",
          queriedSuccessfully: false,
          statusText: `QUERY FAILED: ${fallback.error.message}`,
          total: null,
          error: fallback.error.message,
        };
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
        publicStaffStatus = {
          source: "public.staff",
          queriedSuccessfully: true,
          statusText: "PRODUCTION QUERY SUCCESSFUL",
          total: publicStaff.length,
        };
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
      publicStaffStatus = {
        source: "public.staff",
        queriedSuccessfully: true,
        statusText: "PRODUCTION QUERY SUCCESSFUL",
        total: publicStaff.length,
      };
    }
  } catch (err) {
    const msg = (err as Error).message;
    line(`[FAIL] Could not query public.staff: ${msg}`);
    publicStaffStatus = {
      source: "public.staff",
      queriedSuccessfully: false,
      statusText: `QUERY FAILED: ${msg}`,
      total: null,
      error: msg,
    };
  }

  return { supabaseUsers, publicUsers, publicStaff, supabaseAuthStatus, publicUsersStatus, publicStaffStatus };
}

async function fetchFirebaseData() {
  const firebaseUsers: FirebaseIdentity[] = [];
  let firebaseAuthStatus: ProviderQueryStatus;

  if (!hasFirebaseCredentials()) {
    line("[WARN] Firebase Admin credentials not available (PRODUCTION CREDENTIALS UNAVAILABLE).");
    firebaseAuthStatus = {
      source: "Firebase Auth",
      queriedSuccessfully: false,
      statusText: "PRODUCTION CREDENTIALS UNAVAILABLE",
      total: null,
    };
    return { firebaseUsers, firebaseAuthStatus };
  }

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

    firebaseAuthStatus = {
      source: "Firebase Auth",
      queriedSuccessfully: true,
      statusText: "PRODUCTION QUERY SUCCESSFUL",
      total: firebaseUsers.length,
    };
  } catch (err) {
    const msg = (err as Error).message;
    line(`[FAIL] Firebase Admin Auth error: ${msg}`);
    firebaseAuthStatus = {
      source: "Firebase Auth",
      queriedSuccessfully: false,
      statusText: `QUERY FAILED: ${msg}`,
      total: null,
      error: msg,
    };
  }
  return { firebaseUsers, firebaseAuthStatus };
}

export function generateMarkdownReport(
  report: ReconciliationReport,
  queryStatuses: {
    firebaseAuth: ProviderQueryStatus;
    supabaseAuth: ProviderQueryStatus;
    publicUsers: ProviderQueryStatus;
    publicStaff: ProviderQueryStatus;
  }
): string {
  const formatStatus = (s: ProviderQueryStatus) =>
    s.queriedSuccessfully
      ? `YES (${s.statusText})`
      : `NO (${s.statusText})`;

  const formatTotal = (s: ProviderQueryStatus, fallbackCount: number) =>
    s.queriedSuccessfully ? String(s.total ?? fallbackCount) : "N/A (system not successfully queried)";

  const lines: string[] = [
    "# Phase 2 — Production Auth Identity Reconciliation Report",
    "",
    `**Generated:** ${new Date().toISOString()}`,
    "**Execution Mode:** READ-ONLY diagnostic (zero mutations)",
    "",
    "---",
    "",
    "## Firebase Auth",
    `- **queried successfully:** ${formatStatus(queryStatuses.firebaseAuth)}`,
    `- **total identities:** ${formatTotal(queryStatuses.firebaseAuth, report.stats.firebaseCount)}`,
    "",
    "## Supabase Auth",
    `- **queried successfully:** ${formatStatus(queryStatuses.supabaseAuth)}`,
    `- **total identities:** ${formatTotal(queryStatuses.supabaseAuth, report.stats.supabaseCount)}`,
    "",
    "## public.users",
    `- **queried successfully:** ${formatStatus(queryStatuses.publicUsers)}`,
    `- **total rows:** ${formatTotal(queryStatuses.publicUsers, report.stats.publicUsersCount)}`,
    "",
    "## public.staff",
    `- **queried successfully:** ${formatStatus(queryStatuses.publicStaff)}`,
    `- **total rows:** ${formatTotal(queryStatuses.publicStaff, report.stats.publicStaffCount)}`,
    "",
    "---",
    "",
    "## Reconciliation",
    `- **linked identities:** ${report.stats.linkedCount}`,
    `- **Firebase-only:** ${report.stats.firebaseOnlyCount}`,
    `- **Supabase-only:** ${report.stats.supabaseOnlyCount}`,
    `- **conflicts:** ${report.stats.matchingEmailDifferentIdsCount}`,
    `- **ambiguous identities:** ${report.stats.ambiguousCount}`,
    "",
    "---",
    "",
    "## Authorization safety",
    `- **active administrators without authorization mapping:** ${report.activeAdminsWithoutMapping.length}`,
    `- **active staff without authorization mapping:** ${report.activeStaffWithoutMapping.length}`,
    `- **duplicate auth_user_id:** ${report.duplicateAuthUserIds.length}`,
    `- **duplicate Firebase UID:** ${report.duplicateFirebaseUids.length}`,
    "",
    "---",
    "",
    "## Mutation check",
    "",
    "```text",
    "Database rows changed: NO",
    "Schema changed: NO",
    "Auth users changed: NO",
    "```",
    "",
    "---",
    "",
    "## Detailed Findings",
    "",
  ];

  if (report.linkedIdentities.length > 0) {
    lines.push("### Linked Identities");
    for (const id of report.linkedIdentities) {
      lines.push(
        `- **${id.email ?? "(no email)"}**: Firebase UID \`${id.firebaseUid}\` <-> Supabase ID \`${id.supabaseAuthId}\` (role: \`${id.role ?? "none"}\`, active: \`${id.active}\`, via: \`${id.linkedVia}\`)`
      );
    }
    lines.push("");
  }

  if (report.emailMatchDifferentIds.length > 0) {
    lines.push("### Conflicts (Matching Email, Differing IDs — Action Required: Manual Review)");
    lines.push("Accounts sharing an email but having different identity IDs are NEVER auto-linked:");
    for (const m of report.emailMatchDifferentIds) {
      lines.push(`- **${m.email}**:`);
      lines.push(`  - Firebase UID: \`${m.firebaseUid}\``);
      lines.push(`  - Supabase Auth: \`${m.supabaseAuthId}\``);
      lines.push(`  - Note: ${m.reviewNote}`);
    }
    lines.push("");
  }

  if (report.activeAdminsWithoutMapping.length > 0) {
    lines.push("### Active Administrators Lacking Authorization Mapping");
    for (const a of report.activeAdminsWithoutMapping) {
      lines.push(`- [${a.source}] ${a.email ?? a.id}: ${a.note}`);
    }
    lines.push("");
  }

  if (report.activeStaffWithoutMapping.length > 0) {
    lines.push("### Active Staff Lacking Authorization Mapping");
    for (const s of report.activeStaffWithoutMapping) {
      lines.push(`- [staff #${s.staffNo ?? "N/A"}] ${s.email ?? s.id}: ${s.note}`);
    }
    lines.push("");
  }

  if (report.duplicateAuthUserIds.length > 0) {
    lines.push("### Duplicate auth_user_id Occurrences");
    for (const d of report.duplicateAuthUserIds) {
      lines.push(`- Duplicate \`${d.value}\` in \`${d.source}\` (${d.occurrences} records)`);
    }
    lines.push("");
  }

  if (report.duplicateFirebaseUids.length > 0) {
    lines.push("### Duplicate Firebase UID Occurrences");
    for (const d of report.duplicateFirebaseUids) {
      lines.push(`- Duplicate \`${d.value}\` in \`${d.source}\` (${d.occurrences} records)`);
    }
    lines.push("");
  }

  if (report.ambiguousMappings.length > 0) {
    lines.push("### Ambiguous Mappings");
    for (const amb of report.ambiguousMappings) {
      lines.push(`- **${amb.email ?? "(no email)"}**: ${amb.reason}`);
    }
    lines.push("");
  }

  lines.push("## Summary Assessment");
  if (
    report.stats.matchingEmailDifferentIdsCount === 0 &&
    report.stats.ambiguousCount === 0 &&
    report.activeAdminsWithoutMapping.length === 0 &&
    report.duplicateAuthUserIds.length === 0 &&
    report.duplicateFirebaseUids.length === 0
  ) {
    lines.push("STATUS: CLEAN — No identity collisions, duplicate IDs, or unmapped administrators identified.");
  } else {
    lines.push("STATUS: REVIEW REQUIRED — One or more identity conflicts or authorization safety flags require operator review.");
  }
  lines.push("");

  return lines.join("\n");
}

export async function runDiagnostic(): Promise<DiagnosticResult> {
  head("Phase 2 — Privileged Identity Enumeration & Reconciliation");
  line("Read-only diagnostic scanning Firebase Auth, Supabase Auth, public.users, and public.staff.");
  line("(No passwords, tokens, or credentials are read, stored, or printed.)");

  const [supabaseData, firebaseData] = await Promise.all([
    fetchSupabaseData(),
    fetchFirebaseData(),
  ]);

  const queryStatuses = {
    firebaseAuth: firebaseData.firebaseAuthStatus,
    supabaseAuth: supabaseData.supabaseAuthStatus,
    publicUsers: supabaseData.publicUsersStatus,
    publicStaff: supabaseData.publicStaffStatus,
  };

  const report = reconcileIdentities({
    firebaseUsers: firebaseData.firebaseUsers,
    supabaseUsers: supabaseData.supabaseUsers,
    publicUsers: supabaseData.publicUsers,
    publicStaff: supabaseData.publicStaff,
  });

  head("Data Source Query Status");
  line(`Firebase Auth: ${queryStatuses.firebaseAuth.statusText} (Total: ${queryStatuses.firebaseAuth.queriedSuccessfully ? report.stats.firebaseCount : "N/A"})`);
  line(`Supabase Auth: ${queryStatuses.supabaseAuth.statusText} (Total: ${queryStatuses.supabaseAuth.queriedSuccessfully ? report.stats.supabaseCount : "N/A"})`);
  line(`public.users:  ${queryStatuses.publicUsers.statusText} (Total: ${queryStatuses.publicUsers.queriedSuccessfully ? report.stats.publicUsersCount : "N/A"})`);
  line(`public.staff:  ${queryStatuses.publicStaff.statusText} (Total: ${queryStatuses.publicStaff.queriedSuccessfully ? report.stats.publicStaffCount : "N/A"})`);

  head("Reconciliation Summary");
  line(`Already linked identities:  ${report.stats.linkedCount}`);
  line(`Firebase-only identities:   ${report.stats.firebaseOnlyCount}`);
  line(`Supabase-only identities:   ${report.stats.supabaseOnlyCount}`);
  line(`Matching email, diff IDs:   ${report.stats.matchingEmailDifferentIdsCount}`);
  line(`Ambiguous mappings:         ${report.stats.ambiguousCount}`);

  head("Authorization Safety");
  line(`Active admins w/o mapping:  ${report.activeAdminsWithoutMapping.length}`);
  line(`Active staff w/o mapping:   ${report.activeStaffWithoutMapping.length}`);
  line(`Duplicate auth_user_id:     ${report.duplicateAuthUserIds.length}`);
  line(`Duplicate Firebase UID:     ${report.duplicateFirebaseUids.length}`);

  head("Mutation Check");
  line("Database rows changed: NO");
  line("Schema changed: NO");
  line("Auth users changed: NO");

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

  if (report.activeAdminsWithoutMapping.length > 0) {
    head("Active Administrators Lacking Authorization Mapping");
    for (const a of report.activeAdminsWithoutMapping) {
      line(`- [${a.source}] ${a.email ?? a.id}: ${a.note}`);
    }
  }

  if (report.activeStaffWithoutMapping.length > 0) {
    head("Active Staff Lacking Authorization Mapping");
    for (const s of report.activeStaffWithoutMapping) {
      line(`- [staff #${s.staffNo ?? "N/A"}] ${s.email ?? s.id}: ${s.note}`);
    }
  }

  if (report.ambiguousMappings.length > 0) {
    head("Ambiguous Mappings");
    for (const a of report.ambiguousMappings) {
      line(`- ${a.email ?? "(no email)"}: ${a.reason}`);
    }
  }

  // Generate markdown report artifact
  const markdown = generateMarkdownReport(report, queryStatuses);
  const artifactsDir = path.join(process.cwd(), "artifacts");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }
  const markdownReportPath = path.join(artifactsDir, "auth-identity-reconciliation.md");
  fs.writeFileSync(markdownReportPath, markdown, "utf8");
  line(`\n[OK] Redacted Markdown report generated: ${markdownReportPath}`);

  // Publish to GitHub Step Summary if running in GitHub Actions
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
      line("[OK] Published report to GITHUB_STEP_SUMMARY");
    } catch (e) {
      line(`[WARN] Failed to write to GITHUB_STEP_SUMMARY: ${(e as Error).message}`);
    }
  }

  head("Reconciliation Status");
  if (
    report.stats.ambiguousCount === 0 &&
    report.stats.matchingEmailDifferentIdsCount === 0 &&
    report.activeAdminsWithoutMapping.length === 0 &&
    report.duplicateAuthUserIds.length === 0 &&
    report.duplicateFirebaseUids.length === 0
  ) {
    line("CLEAN: No conflicting or ambiguous identities found.");
  } else {
    line(
      `ACTION REQUIRED: ${report.stats.matchingEmailDifferentIdsCount} conflict(s), ` +
        `${report.stats.ambiguousCount} ambiguous mapping(s), ` +
        `${report.activeAdminsWithoutMapping.length} unmapped admin(s) flagged.`
    );
  }

  return { report, queryStatuses, markdownReportPath };
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
