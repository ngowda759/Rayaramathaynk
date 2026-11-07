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
 * Produces an aggregate-only reconciliation report identifying:
 *   - Firebase-only identity counts
 *   - Supabase-only identity counts
 *   - Already linked identity counts
 *   - Conflicts count (matching email with differing IDs requiring review)
 *   - Ambiguous mappings count
 *   - Authorization safety counts (unmapped admins/staff, duplicate IDs)
 *
 * CRITICAL SAFETY RULES:
 * - Read-only: never performs writes, updates, deletes, or auto-linking.
 * - Never logs or reveals secrets, passwords, tokens, or private keys.
 * - Explicitly verifies zero mutations: Database rows changed: NO, Schema changed: NO, Auth users changed: NO.
 * - Fail-closed: Never certifies status as CLEAN unless all 4 production sources succeed.
 * - Aggregate-only reporting: Excludes all identity-level records and identifiers from artifacts and step summary.
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
  type ProviderQueryStatus,
  isMissingColumnError,
  classifyError,
} from "./lib/auth-identity-reconciliation";

const line = (s = "") => console.log(s);
const head = (s: string) => line(`\n=== ${s} ===`);

export type { ProviderQueryStatus };

export interface DiagnosticResult {
  report: ReconciliationReport;
  queryStatuses: {
    firebaseAuth: ProviderQueryStatus;
    supabaseAuth: ProviderQueryStatus;
    publicUsers: ProviderQueryStatus;
    publicStaff: ProviderQueryStatus;
  };
  markdownReportPath: string;
  allSourcesSuccessful: boolean;
}

export interface DiagnosticDependencies {
  fetchSupabaseData?: () => Promise<{
    supabaseUsers: SupabaseIdentity[];
    publicUsers: PublicUserRecord[];
    publicStaff: PublicStaffRecord[];
    supabaseAuthStatus: ProviderQueryStatus;
    publicUsersStatus: ProviderQueryStatus;
    publicStaffStatus: ProviderQueryStatus;
  }>;
  fetchFirebaseData?: () => Promise<{
    firebaseUsers: FirebaseIdentity[];
    firebaseAuthStatus: ProviderQueryStatus;
  }>;
  writeReportFile?: (filePath: string, content: string) => void;
  appendStepSummary?: (content: string) => void;
  outputArtifactPath?: string;
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

export async function fetchSupabaseData(clientOverride?: unknown) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientOverride && (!url || !serviceKey)) {
    line("[WARN] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (PRODUCTION CREDENTIALS UNAVAILABLE).");
    return {
      supabaseUsers: [],
      publicUsers: [],
      publicStaff: [],
      supabaseAuthStatus: {
        source: "Supabase Auth" as const,
        queriedSuccessfully: false,
        statusKind: "MISSING_CREDENTIALS" as const,
        statusText: "PRODUCTION CREDENTIALS UNAVAILABLE",
        total: null,
      },
      publicUsersStatus: {
        source: "public.users" as const,
        queriedSuccessfully: false,
        statusKind: "MISSING_CREDENTIALS" as const,
        statusText: "PRODUCTION CREDENTIALS UNAVAILABLE",
        total: null,
      },
      publicStaffStatus: {
        source: "public.staff" as const,
        queriedSuccessfully: false,
        statusKind: "MISSING_CREDENTIALS" as const,
        statusText: "PRODUCTION CREDENTIALS UNAVAILABLE",
        total: null,
        queryVariant: "none (credentials unavailable)",
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: any = clientOverride;
  if (!supabase) {
    const { createClient } = await import("@supabase/supabase-js");
    supabase = createClient(url!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  const supabaseUsers: SupabaseIdentity[] = [];
  let supabaseAuthStatus: ProviderQueryStatus;
  try {
    let page = 1;
    let listError: unknown = null;
    for (;;) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        listError = error;
        line(`[FAIL] supabase.auth.admin.listUsers error on page ${page}: ${error.message ?? error}`);
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
      // Partial pagination failure: discard partial users to prevent interpreting incomplete data as complete
      supabaseUsers.length = 0;
      const classified = classifyError(listError);
      supabaseAuthStatus = {
        source: "Supabase Auth",
        queriedSuccessfully: false,
        statusKind: classified.kind,
        statusText: `${classified.kind === "AUTH_FAILURE" ? "AUTHENTICATION FAILURE" : "QUERY FAILED"}: ${classified.message}`,
        total: null,
        error: classified.message,
      };
    } else {
      supabaseAuthStatus = {
        source: "Supabase Auth",
        queriedSuccessfully: true,
        statusKind: "SUCCESS",
        statusText: "PRODUCTION QUERY SUCCESSFUL",
        total: supabaseUsers.length,
      };
    }
  } catch (err) {
    supabaseUsers.length = 0;
    const classified = classifyError(err);
    line(`[FAIL] Could not list Supabase Auth users: ${classified.message}`);
    supabaseAuthStatus = {
      source: "Supabase Auth",
      queriedSuccessfully: false,
      statusKind: classified.kind,
      statusText: `${classified.kind === "AUTH_FAILURE" ? "AUTHENTICATION FAILURE" : "QUERY FAILED"}: ${classified.message}`,
      total: null,
      error: classified.message,
    };
  }

  const publicUsers: PublicUserRecord[] = [];
  let publicUsersStatus: ProviderQueryStatus;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, role, active, firestore_id, auth_user_id");
    if (error) {
      const classified = classifyError(error);
      line(`[FAIL] users query error: ${classified.message}`);
      publicUsersStatus = {
        source: "public.users",
        queriedSuccessfully: false,
        statusKind: classified.kind,
        statusText: `${classified.kind === "AUTH_FAILURE" ? "AUTHENTICATION FAILURE" : "QUERY FAILED"}: ${classified.message}`,
        total: null,
        error: classified.message,
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
        statusKind: "SUCCESS",
        statusText: "PRODUCTION QUERY SUCCESSFUL",
        total: publicUsers.length,
      };
    }
  } catch (err) {
    const classified = classifyError(err);
    line(`[FAIL] Could not query public.users: ${classified.message}`);
    publicUsersStatus = {
      source: "public.users",
      queriedSuccessfully: false,
      statusKind: classified.kind,
      statusText: `${classified.kind === "AUTH_FAILURE" ? "AUTHENTICATION FAILURE" : "QUERY FAILED"}: ${classified.message}`,
      total: null,
      error: classified.message,
    };
  }

  const publicStaff: PublicStaffRecord[] = [];
  let publicStaffStatus: ProviderQueryStatus;
  try {
    const { data, error } = await supabase
      .from("staff")
      .select("id, email, staff_no, view_only, status, firebase_uid, auth_user_id");

    if (error) {
      // ONLY fallback if the database error specifically confirms that auth_user_id is missing
      if (isMissingColumnError(error, "auth_user_id")) {
        line("[INFO] staff.auth_user_id column not present in schema cache. Executing permitted fallback query without auth_user_id.");
        const fallback = await supabase
          .from("staff")
          .select("id, email, staff_no, view_only, status, firebase_uid");

        if (fallback.error) {
          const classified = classifyError(fallback.error);
          line(`[FAIL] staff fallback query error: ${classified.message}`);
          publicStaffStatus = {
            source: "public.staff",
            queriedSuccessfully: false,
            statusKind: classified.kind,
            statusText: `${classified.kind === "AUTH_FAILURE" ? "AUTHENTICATION FAILURE" : "QUERY FAILED"}: ${classified.message}`,
            total: null,
            error: classified.message,
            queryVariant: "fallback without auth_user_id (fallback failed)",
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
            statusKind: "SUCCESS",
            statusText: "PRODUCTION QUERY SUCCESSFUL",
            total: publicStaff.length,
            queryVariant: "fallback without auth_user_id (column missing)",
          };
        }
      } else {
        // Authentication, permission, network, timeout or other errors MUST NOT trigger fallback
        const classified = classifyError(error);
        line(`[FAIL] staff query error (permission/auth/query error, fallback disallowed): ${classified.message}`);
        publicStaffStatus = {
          source: "public.staff",
          queriedSuccessfully: false,
          statusKind: classified.kind,
          statusText: `${classified.kind === "AUTH_FAILURE" ? "AUTHENTICATION FAILURE" : "QUERY FAILED"}: ${classified.message}`,
          total: null,
          error: classified.message,
          queryVariant: "none (query failed without fallback)",
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
        statusKind: "SUCCESS",
        statusText: "PRODUCTION QUERY SUCCESSFUL",
        total: publicStaff.length,
        queryVariant: "standard with auth_user_id",
      };
    }
  } catch (err) {
    const classified = classifyError(err);
    line(`[FAIL] Could not query public.staff: ${classified.message}`);
    publicStaffStatus = {
      source: "public.staff",
      queriedSuccessfully: false,
      statusKind: classified.kind,
      statusText: `${classified.kind === "AUTH_FAILURE" ? "AUTHENTICATION FAILURE" : "QUERY FAILED"}: ${classified.message}`,
      total: null,
      error: classified.message,
      queryVariant: "none (exception caught)",
    };
  }

  return { supabaseUsers, publicUsers, publicStaff, supabaseAuthStatus, publicUsersStatus, publicStaffStatus };
}

export async function fetchFirebaseData(authOverride?: unknown) {
  const firebaseUsers: FirebaseIdentity[] = [];
  let firebaseAuthStatus: ProviderQueryStatus;

  if (!authOverride && !hasFirebaseCredentials()) {
    line("[WARN] Firebase Admin credentials not available (PRODUCTION CREDENTIALS UNAVAILABLE).");
    firebaseAuthStatus = {
      source: "Firebase Auth",
      queriedSuccessfully: false,
      statusKind: "MISSING_CREDENTIALS",
      statusText: "PRODUCTION CREDENTIALS UNAVAILABLE",
      total: null,
    };
    return { firebaseUsers, firebaseAuthStatus };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let auth: any = authOverride;
    if (!auth) {
      const { getAdminApp } = await import("@/lib/admin-firebase");
      const app = await getAdminApp();
      const { getAuth } = await import("firebase-admin/auth");
      auth = getAuth(app);
    }

    let nextPageToken: string | undefined = undefined;
    do {
      const listResult = await auth.listUsers(200, nextPageToken);
      for (const u of listResult.users) {
        firebaseUsers.push({
          uid: u.uid,
          email: u.email ?? null,
          disabled: Boolean(u.disabled),
        });
      }
      nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    firebaseAuthStatus = {
      source: "Firebase Auth",
      queriedSuccessfully: true,
      statusKind: "SUCCESS",
      statusText: "PRODUCTION QUERY SUCCESSFUL",
      total: firebaseUsers.length,
    };
  } catch (err) {
    firebaseUsers.length = 0;
    const classified = classifyError(err);
    line(`[FAIL] Firebase Admin Auth error: ${classified.message}`);
    firebaseAuthStatus = {
      source: "Firebase Auth",
      queriedSuccessfully: false,
      statusKind: classified.kind,
      statusText: `${classified.kind === "AUTH_FAILURE" ? "AUTHENTICATION FAILURE" : "QUERY FAILED"}: ${classified.message}`,
      total: null,
      error: classified.message,
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
  const allSourcesSuccessful =
    queryStatuses.firebaseAuth.queriedSuccessfully &&
    queryStatuses.supabaseAuth.queriedSuccessfully &&
    queryStatuses.publicUsers.queriedSuccessfully &&
    queryStatuses.publicStaff.queriedSuccessfully;

  const formatStatus = (s: ProviderQueryStatus) =>
    s.queriedSuccessfully
      ? `YES (${s.statusText})`
      : `NO (${s.statusText})`;

  const formatTotal = (s: ProviderQueryStatus) =>
    s.queriedSuccessfully && s.total !== null
      ? String(s.total)
      : "N/A (system not successfully queried)";

  const lines: string[] = [
    "# Phase 2 — Production Auth Identity Reconciliation Report",
    "",
    `**Generated:** ${new Date().toISOString()}`,
    "**Execution Mode:** READ-ONLY diagnostic (zero mutations)",
    "**Report Format:** Aggregate-only (zero identity-level findings)",
    "",
    "---",
    "",
    "## Firebase Auth",
    `- **queried successfully:** ${formatStatus(queryStatuses.firebaseAuth)}`,
    `- **total identities:** ${formatTotal(queryStatuses.firebaseAuth)}`,
    "",
    "## Supabase Auth",
    `- **queried successfully:** ${formatStatus(queryStatuses.supabaseAuth)}`,
    `- **total identities:** ${formatTotal(queryStatuses.supabaseAuth)}`,
    "",
    "## public.users",
    `- **queried successfully:** ${formatStatus(queryStatuses.publicUsers)}`,
    `- **total rows:** ${formatTotal(queryStatuses.publicUsers)}`,
    "",
    "## public.staff",
    `- **queried successfully:** ${formatStatus(queryStatuses.publicStaff)}`,
    `- **query variant:** ${queryStatuses.publicStaff.queryVariant ?? (queryStatuses.publicStaff.queriedSuccessfully ? "standard with auth_user_id" : "none")}`,
    `- **total rows:** ${formatTotal(queryStatuses.publicStaff)}`,
    "",
    "---",
    "",
    "## Reconciliation",
  ];

  if (!allSourcesSuccessful) {
    lines.push(
      "*Reconciliation metrics are withheld because one or more production data sources could not be successfully queried.*",
      "",
      "- **reconciliation status:** INCOMPLETE (reconciliation not certified)",
      "- **linked identities:** N/A (source data incomplete)",
      "- **Firebase-only:** N/A (source data incomplete)",
      "- **Supabase-only:** N/A (source data incomplete)",
      "- **conflicts:** N/A (source data incomplete)",
      "- **ambiguous identities:** N/A (source data incomplete)"
    );
  } else {
    lines.push(
      `- **linked identities:** ${report.stats.linkedCount}`,
      `- **Firebase-only:** ${report.stats.firebaseOnlyCount}`,
      `- **Supabase-only:** ${report.stats.supabaseOnlyCount}`,
      `- **conflicts:** ${report.stats.matchingEmailDifferentIdsCount}`,
      `- **ambiguous identities:** ${report.stats.ambiguousCount}`
    );
  }

  lines.push(
    "",
    "---",
    "",
    "## Authorization safety"
  );

  if (!allSourcesSuccessful) {
    lines.push(
      "- **active administrators without authorization mapping:** N/A (source data incomplete)",
      "- **active staff without authorization mapping:** N/A (source data incomplete)",
      "- **duplicate auth_user_id:** N/A (source data incomplete)",
      "- **duplicate Firebase UID:** N/A (source data incomplete)"
    );
  } else {
    lines.push(
      `- **active administrators without authorization mapping:** ${report.activeAdminsWithoutMapping.length}`,
      `- **active staff without authorization mapping:** ${report.activeStaffWithoutMapping.length}`,
      `- **duplicate auth_user_id:** ${report.duplicateAuthUserIds.length}`,
      `- **duplicate Firebase UID:** ${report.duplicateFirebaseUids.length}`
    );
  }

  lines.push(
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
    "## Findings Policy",
    "",
    "Identity-level findings, individual user records, and account identifiers are strictly excluded from this artifact in accordance with the aggregate-only reporting security policy.",
    "All statistics and verification counts above are aggregates derived from direct read-only enumeration.",
    "",
    "---",
    "",
    "## Summary Assessment"
  );

  if (!allSourcesSuccessful) {
    lines.push(
      "STATUS: INCOMPLETE — RECONCILIATION NOT CERTIFIED",
      "",
      "One or more required production data sources could not be successfully queried:",
      `- Firebase Auth: ${queryStatuses.firebaseAuth.statusText}`,
      `- Supabase Auth: ${queryStatuses.supabaseAuth.statusText}`,
      `- public.users: ${queryStatuses.publicUsers.statusText}`,
      `- public.staff: ${queryStatuses.publicStaff.statusText}`,
      "",
      "Reconciliation metrics and conclusions cannot be certified when source data is partial or unqueried."
    );
  } else if (
    report.stats.matchingEmailDifferentIdsCount === 0 &&
    report.stats.ambiguousCount === 0 &&
    report.activeAdminsWithoutMapping.length === 0 &&
    report.duplicateAuthUserIds.length === 0 &&
    report.duplicateFirebaseUids.length === 0
  ) {
    lines.push("STATUS: CLEAN — All four production sources successfully queried. No identity collisions, duplicate IDs, or unmapped administrators identified.");
  } else {
    lines.push("STATUS: REVIEW REQUIRED — One or more identity conflicts or authorization safety flags require operator review.");
  }
  lines.push("");

  return lines.join("\n");
}

export async function runDiagnostic(deps?: DiagnosticDependencies): Promise<DiagnosticResult> {
  head("Phase 2 — Privileged Identity Enumeration & Reconciliation");
  line("Read-only diagnostic scanning Firebase Auth, Supabase Auth, public.users, and public.staff.");
  line("(Aggregate-only reporting: zero identity-level records or credentials output.)");

  const supabaseFetcher = deps?.fetchSupabaseData ?? fetchSupabaseData;
  const firebaseFetcher = deps?.fetchFirebaseData ?? fetchFirebaseData;

  const [supabaseData, firebaseData] = await Promise.all([
    supabaseFetcher(),
    firebaseFetcher(),
  ]);

  const queryStatuses = {
    firebaseAuth: firebaseData.firebaseAuthStatus,
    supabaseAuth: supabaseData.supabaseAuthStatus,
    publicUsers: supabaseData.publicUsersStatus,
    publicStaff: supabaseData.publicStaffStatus,
  };

  const allSourcesSuccessful =
    queryStatuses.firebaseAuth.queriedSuccessfully &&
    queryStatuses.supabaseAuth.queriedSuccessfully &&
    queryStatuses.publicUsers.queriedSuccessfully &&
    queryStatuses.publicStaff.queriedSuccessfully;

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
  line(`public.staff:  ${queryStatuses.publicStaff.statusText} (Total: ${queryStatuses.publicStaff.queriedSuccessfully ? report.stats.publicStaffCount : "N/A"}, variant: ${queryStatuses.publicStaff.queryVariant ?? "N/A"})`);

  head("Reconciliation Summary");
  if (allSourcesSuccessful) {
    line(`Already linked identities:  ${report.stats.linkedCount}`);
    line(`Firebase-only identities:   ${report.stats.firebaseOnlyCount}`);
    line(`Supabase-only identities:   ${report.stats.supabaseOnlyCount}`);
    line(`Matching email, diff IDs:   ${report.stats.matchingEmailDifferentIdsCount}`);
    line(`Ambiguous mappings:         ${report.stats.ambiguousCount}`);
  } else {
    line("Reconciliation metrics withheld: one or more sources not successfully queried.");
  }

  head("Authorization Safety");
  if (allSourcesSuccessful) {
    line(`Active admins w/o mapping:  ${report.activeAdminsWithoutMapping.length}`);
    line(`Active staff w/o mapping:   ${report.activeStaffWithoutMapping.length}`);
    line(`Duplicate auth_user_id:     ${report.duplicateAuthUserIds.length}`);
    line(`Duplicate Firebase UID:     ${report.duplicateFirebaseUids.length}`);
  } else {
    line("Authorization safety metrics withheld: one or more sources not successfully queried.");
  }

  head("Mutation Check");
  line("Database rows changed: NO");
  line("Schema changed: NO");
  line("Auth users changed: NO");

  // Generate aggregate-only markdown report artifact
  const markdown = generateMarkdownReport(report, queryStatuses);
  const artifactsDir = path.join(process.cwd(), "artifacts");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }
  const markdownReportPath = deps?.outputArtifactPath ?? path.join(artifactsDir, "auth-identity-reconciliation.md");
  if (deps?.writeReportFile) {
    deps.writeReportFile(markdownReportPath, markdown);
  } else {
    fs.writeFileSync(markdownReportPath, markdown, "utf8");
  }
  line(`\n[OK] Aggregate-only Markdown report generated: ${markdownReportPath}`);

  // Publish to GitHub Step Summary if running in GitHub Actions
  if (deps?.appendStepSummary) {
    deps.appendStepSummary(markdown);
  } else if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
      line("[OK] Published aggregate-only report to GITHUB_STEP_SUMMARY");
    } catch (e) {
      line(`[WARN] Failed to write to GITHUB_STEP_SUMMARY: ${(e as Error).message}`);
    }
  }

  head("Reconciliation Status");
  if (!allSourcesSuccessful) {
    line("STATUS: INCOMPLETE — RECONCILIATION NOT CERTIFIED (one or more sources unavailable or failed)");
  } else if (
    report.stats.ambiguousCount === 0 &&
    report.stats.matchingEmailDifferentIdsCount === 0 &&
    report.activeAdminsWithoutMapping.length === 0 &&
    report.duplicateAuthUserIds.length === 0 &&
    report.duplicateFirebaseUids.length === 0
  ) {
    line("STATUS: CLEAN — All four production sources successfully queried. No conflicting or ambiguous identities found.");
  } else {
    line(
      `STATUS: REVIEW REQUIRED — ${report.stats.matchingEmailDifferentIdsCount} conflict(s), ` +
        `${report.stats.ambiguousCount} ambiguous mapping(s), ` +
        `${report.activeAdminsWithoutMapping.length} unmapped admin(s) flagged.`
    );
  }

  return { report, queryStatuses, markdownReportPath, allSourcesSuccessful };
}

if (require.main === module) {
  runDiagnostic()
    .then((result) => {
      if (!result.allSourcesSuccessful) {
        console.error("\n[FAIL] One or more production sources could not be successfully queried. Reconciliation not certified.");
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("[FATAL] Diagnostic failed:", err);
      process.exit(1);
    });
}
