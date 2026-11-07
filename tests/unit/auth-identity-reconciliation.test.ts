/**
 * @jest-environment node
 *
 * Unit and regression tests for Phase 2 identity enumeration, reconciliation, and workflow safety.
 */

import * as fs from "fs";
import * as path from "path";
import {
  reconcileIdentities,
  type FirebaseIdentity,
  type SupabaseIdentity,
  type PublicUserRecord,
  type PublicStaffRecord,
  isMissingColumnError,
  maskEmail,
  maskId,
} from "../../scripts/lib/auth-identity-reconciliation";

describe("reconcileIdentities", () => {
  it("identifies already linked identities when public.users has both firestore_id and auth_user_id", () => {
    const firebaseUsers: FirebaseIdentity[] = [
      { uid: "fb-1", email: "admin@example.com", disabled: false },
    ];
    const supabaseUsers: SupabaseIdentity[] = [
      { id: "sb-uuid-1", email: "admin@example.com", disabled: false },
    ];
    const publicUsers: PublicUserRecord[] = [
      {
        id: "user-1",
        email: "admin@example.com",
        role: "super_admin",
        active: true,
        firestore_id: "fb-1",
        auth_user_id: "sb-uuid-1",
      },
    ];
    const publicStaff: PublicStaffRecord[] = [
      {
        id: "staff-1",
        email: "admin@example.com",
        staff_no: 1,
        role: "super_admin",
        active: true,
        firebase_uid: "fb-1",
        auth_user_id: "sb-uuid-1",
      },
    ];

    const report = reconcileIdentities({
      firebaseUsers,
      supabaseUsers,
      publicUsers,
      publicStaff,
    });

    expect(report.stats.linkedCount).toBe(1);
    expect(report.linkedIdentities[0]).toMatchObject({
      email: "admin@example.com",
      firebaseUid: "fb-1",
      supabaseAuthId: "sb-uuid-1",
      publicUserId: "user-1",
      staffId: "staff-1",
      role: "super_admin",
      active: true,
      linkedVia: "both",
    });
    expect(report.stats.matchingEmailDifferentIdsCount).toBe(0);
    expect(report.stats.firebaseOnlyCount).toBe(0);
    expect(report.stats.supabaseOnlyCount).toBe(0);
  });

  it("flags matching email with different IDs when accounts exist in both but are not linked in DB", () => {
    const firebaseUsers: FirebaseIdentity[] = [
      { uid: "fb-legacy-1", email: "temple@example.com", disabled: false },
    ];
    const supabaseUsers: SupabaseIdentity[] = [
      { id: "sb-new-uuid-2", email: "temple@example.com", disabled: false },
    ];
    const publicUsers: PublicUserRecord[] = [
      {
        id: "user-2",
        email: "temple@example.com",
        role: "temple_admin",
        active: true,
        firestore_id: "fb-legacy-1",
        auth_user_id: null, // NOT linked to Supabase Auth!
      },
    ];
    const publicStaff: PublicStaffRecord[] = [
      {
        id: "staff-2",
        email: "temple@example.com",
        staff_no: 2,
        role: "temple_admin",
        active: true,
        firebase_uid: "fb-legacy-1",
        auth_user_id: null,
      },
    ];

    const report = reconcileIdentities({
      firebaseUsers,
      supabaseUsers,
      publicUsers,
      publicStaff,
    });

    // CRITICAL: Must not automatically link them!
    expect(report.stats.linkedCount).toBe(0);
    expect(report.stats.matchingEmailDifferentIdsCount).toBe(1);
    expect(report.emailMatchDifferentIds[0]).toMatchObject({
      email: "temple@example.com",
      firebaseUid: "fb-legacy-1",
      supabaseAuthId: "sb-new-uuid-2",
    });
    expect(report.emailMatchDifferentIds[0].reviewNote).toContain("Requires manual review before linking");
  });

  it("identifies Firebase-only users correctly", () => {
    const firebaseUsers: FirebaseIdentity[] = [
      { uid: "fb-only-1", email: "firebase.only@example.com", disabled: false },
    ];
    const report = reconcileIdentities({
      firebaseUsers,
      supabaseUsers: [],
      publicUsers: [
        {
          id: "u-fb",
          email: "firebase.only@example.com",
          role: "billing",
          active: true,
          firestore_id: "fb-only-1",
          auth_user_id: null,
        },
      ],
      publicStaff: [],
    });

    expect(report.stats.firebaseOnlyCount).toBe(1);
    expect(report.firebaseOnlyIdentities[0]).toMatchObject({
      uid: "fb-only-1",
      email: "firebase.only@example.com",
      hasPublicUser: true,
      hasStaff: false,
    });
    expect(report.stats.supabaseOnlyCount).toBe(0);
  });

  it("identifies Supabase-only users correctly", () => {
    const supabaseUsers: SupabaseIdentity[] = [
      { id: "sb-only-1", email: "supabase.only@example.com", disabled: false },
    ];
    const report = reconcileIdentities({
      firebaseUsers: [],
      supabaseUsers,
      publicUsers: [
        {
          id: "u-sb",
          email: "supabase.only@example.com",
          role: "priest",
          active: true,
          firestore_id: null,
          auth_user_id: "sb-only-1",
        },
      ],
      publicStaff: [],
    });

    expect(report.stats.supabaseOnlyCount).toBe(1);
    expect(report.supabaseOnlyIdentities[0]).toMatchObject({
      id: "sb-only-1",
      email: "supabase.only@example.com",
      hasPublicUser: true,
      hasStaff: false,
    });
    expect(report.stats.firebaseOnlyCount).toBe(0);
  });

  it("detects ambiguous identities when multiple accounts share an email in a single provider", () => {
    const supabaseUsers: SupabaseIdentity[] = [
      { id: "sb-dup-1", email: "duplicate@example.com", disabled: false },
      { id: "sb-dup-2", email: "duplicate@example.com", disabled: false },
    ];
    const report = reconcileIdentities({
      firebaseUsers: [],
      supabaseUsers,
      publicUsers: [],
      publicStaff: [],
    });

    expect(report.stats.ambiguousCount).toBe(1);
    expect(report.ambiguousMappings[0].reason).toContain("Multiple Supabase Auth accounts share email");
  });

  it("detects active staff without a public.users authorization record", () => {
    const publicStaff: PublicStaffRecord[] = [
      {
        id: "staff-orphan",
        email: "orphan.staff@example.com",
        staff_no: 42,
        active: true,
        status: "active",
        firebase_uid: "fb-orphan",
        auth_user_id: null,
      },
    ];

    const report = reconcileIdentities({
      firebaseUsers: [
        { uid: "fb-orphan", email: "orphan.staff@example.com", disabled: false },
      ],
      supabaseUsers: [],
      publicUsers: [], // Empty public.users!
      publicStaff,
    });

    expect(report.stats.orphanedActiveIdentitiesCount).toBeGreaterThanOrEqual(1);
    expect(report.activeWithoutPublicUser.some((x) => x.source === "staff" && x.staffNo === 42)).toBe(true);
  });

  it("handles empty datasets safely without crashing", () => {
    const report = reconcileIdentities({
      firebaseUsers: [],
      supabaseUsers: [],
      publicUsers: [],
      publicStaff: [],
    });

    expect(report.stats).toEqual({
      firebaseCount: 0,
      supabaseCount: 0,
      publicUsersCount: 0,
      publicStaffCount: 0,
      linkedCount: 0,
      firebaseOnlyCount: 0,
      supabaseOnlyCount: 0,
      matchingEmailDifferentIdsCount: 0,
      orphanedActiveIdentitiesCount: 0,
      ambiguousCount: 0,
    });
  });

  it("detects duplicate auth_user_id across public.users or public.staff", () => {
    const report = reconcileIdentities({
      firebaseUsers: [],
      supabaseUsers: [],
      publicUsers: [
        { id: "u-1", email: "a@test.com", role: "admin", active: true, firestore_id: null, auth_user_id: "shared-sb-uuid" },
        { id: "u-2", email: "b@test.com", role: "user", active: true, firestore_id: null, auth_user_id: "shared-sb-uuid" },
      ],
      publicStaff: [
        { id: "s-1", email: "c@test.com", staff_no: 10, active: true, firebase_uid: null, auth_user_id: "shared-staff-uuid" },
        { id: "s-2", email: "d@test.com", staff_no: 11, active: true, firebase_uid: null, auth_user_id: "shared-staff-uuid" },
      ],
    });

    expect(report.duplicateAuthUserIds).toHaveLength(2);
    expect(report.duplicateAuthUserIds.some((d) => d.value === "shared-sb-uuid" && d.source === "public.users")).toBe(true);
    expect(report.duplicateAuthUserIds.some((d) => d.value === "shared-staff-uuid" && d.source === "public.staff")).toBe(true);
  });

  it("detects duplicate Firebase UID across public.users or public.staff", () => {
    const report = reconcileIdentities({
      firebaseUsers: [],
      supabaseUsers: [],
      publicUsers: [
        { id: "u-1", email: "a@test.com", role: "admin", active: true, firestore_id: "shared-fb-uid", auth_user_id: null },
        { id: "u-2", email: "b@test.com", role: "user", active: true, firestore_id: "shared-fb-uid", auth_user_id: null },
      ],
      publicStaff: [
        { id: "s-1", email: "c@test.com", staff_no: 20, active: true, firebase_uid: "shared-staff-fb", auth_user_id: null },
        { id: "s-2", email: "d@test.com", staff_no: 21, active: true, firebase_uid: "shared-staff-fb", auth_user_id: null },
      ],
    });

    expect(report.duplicateFirebaseUids).toHaveLength(2);
    expect(report.duplicateFirebaseUids.some((d) => d.value === "shared-fb-uid" && d.source === "public.users")).toBe(true);
    expect(report.duplicateFirebaseUids.some((d) => d.value === "shared-staff-fb" && d.source === "public.staff")).toBe(true);
  });

  it("detects active administrators lacking authorization mapping", () => {
    const report = reconcileIdentities({
      firebaseUsers: [],
      supabaseUsers: [],
      publicUsers: [
        {
          id: "admin-orphan-1",
          email: "superadmin@example.com",
          role: "super_admin",
          active: true,
          firestore_id: null,
          auth_user_id: null,
        },
      ],
      publicStaff: [],
    });

    expect(report.activeAdminsWithoutMapping).toHaveLength(1);
    expect(report.activeAdminsWithoutMapping[0]).toMatchObject({
      id: "admin-orphan-1",
      email: "superadmin@example.com",
    });
  });

  it("detects active staff lacking authorization mapping", () => {
    const report = reconcileIdentities({
      firebaseUsers: [],
      supabaseUsers: [],
      publicUsers: [],
      publicStaff: [
        {
          id: "staff-unmapped-1",
          email: "unmapped@example.com",
          staff_no: 99,
          active: true,
          status: "active",
          firebase_uid: null,
          auth_user_id: null,
        },
      ],
    });

    expect(report.activeStaffWithoutMapping).toHaveLength(1);
    expect(report.activeStaffWithoutMapping[0].staffNo).toBe(99);
  });
});

describe("Phase 2 Diagnostic and Workflow Regression Suite", () => {
  // Test 1: All four sources successful and no conflicts = CLEAN
  it("certifies STATUS: CLEAN when all four sources succeed with no conflicts", async () => {
    const { generateMarkdownReport } = await import("../../scripts/diagnose-auth-identities");
    const report = reconcileIdentities({
      firebaseUsers: [{ uid: "fb-1", email: "admin@example.com", disabled: false }],
      supabaseUsers: [{ id: "sb-1", email: "admin@example.com", disabled: false }],
      publicUsers: [
        { id: "u-1", email: "admin@example.com", role: "super_admin", active: true, firestore_id: "fb-1", auth_user_id: "sb-1" },
      ],
      publicStaff: [
        { id: "s-1", email: "admin@example.com", staff_no: 1, role: "super_admin", active: true, firebase_uid: "fb-1", auth_user_id: "sb-1" },
      ],
    });

    const markdown = generateMarkdownReport(report, {
      firebaseAuth: { source: "Firebase Auth", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 1 },
      supabaseAuth: { source: "Supabase Auth", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 1 },
      publicUsers: { source: "public.users", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 1 },
      publicStaff: { source: "public.staff", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 1, queryVariant: "standard with auth_user_id" },
    });

    expect(markdown).toContain("STATUS: CLEAN");
    expect(markdown).not.toContain("STATUS: INCOMPLETE");
    expect(markdown).toContain("YES (PRODUCTION QUERY SUCCESSFUL)");
    expect(markdown).toContain("Database rows changed: NO");
    expect(markdown).toContain("Schema changed: NO");
    expect(markdown).toContain("Auth users changed: NO");
  });

  // Test 2: Missing Firebase credentials = INCOMPLETE
  it("reports STATUS: INCOMPLETE — RECONCILIATION NOT CERTIFIED when Firebase credentials are missing", async () => {
    const { generateMarkdownReport } = await import("../../scripts/diagnose-auth-identities");
    const report = reconcileIdentities({
      firebaseUsers: [],
      supabaseUsers: [{ id: "sb-1", email: "admin@example.com", disabled: false }],
      publicUsers: [{ id: "u-1", email: "admin@example.com", role: "super_admin", active: true, firestore_id: null, auth_user_id: "sb-1" }],
      publicStaff: [{ id: "s-1", email: "admin@example.com", staff_no: 1, role: "super_admin", active: true, firebase_uid: null, auth_user_id: "sb-1" }],
    });

    const markdown = generateMarkdownReport(report, {
      firebaseAuth: { source: "Firebase Auth", queriedSuccessfully: false, statusKind: "MISSING_CREDENTIALS", statusText: "PRODUCTION CREDENTIALS UNAVAILABLE", total: null },
      supabaseAuth: { source: "Supabase Auth", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 1 },
      publicUsers: { source: "public.users", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 1 },
      publicStaff: { source: "public.staff", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 1 },
    });

    expect(markdown).toContain("STATUS: INCOMPLETE — RECONCILIATION NOT CERTIFIED");
    expect(markdown).not.toContain("STATUS: CLEAN");
    expect(markdown).toContain("Firebase Auth: PRODUCTION CREDENTIALS UNAVAILABLE");
    expect(markdown).toContain("- **total identities:** N/A (system not successfully queried)");
    expect(markdown).toContain("reconciliation status:** INCOMPLETE (reconciliation not certified)");
  });

  // Test 3: Supabase Auth query failure = INCOMPLETE
  it("reports STATUS: INCOMPLETE — RECONCILIATION NOT CERTIFIED when Supabase Auth query fails", async () => {
    const { generateMarkdownReport } = await import("../../scripts/diagnose-auth-identities");
    const report = reconcileIdentities({
      firebaseUsers: [{ uid: "fb-1", email: "admin@example.com", disabled: false }],
      supabaseUsers: [],
      publicUsers: [{ id: "u-1", email: "admin@example.com", role: "super_admin", active: true, firestore_id: "fb-1", auth_user_id: null }],
      publicStaff: [],
    });

    const markdown = generateMarkdownReport(report, {
      firebaseAuth: { source: "Firebase Auth", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 1 },
      supabaseAuth: { source: "Supabase Auth", queriedSuccessfully: false, statusKind: "QUERY_FAILURE", statusText: "QUERY FAILED: Network timeout", total: null },
      publicUsers: { source: "public.users", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 1 },
      publicStaff: { source: "public.staff", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 0 },
    });

    expect(markdown).toContain("STATUS: INCOMPLETE — RECONCILIATION NOT CERTIFIED");
    expect(markdown).not.toContain("STATUS: CLEAN");
    expect(markdown).toContain("Supabase Auth: QUERY FAILED: Network timeout");
  });

  // Test 4: public.users query failure = INCOMPLETE
  it("reports STATUS: INCOMPLETE — RECONCILIATION NOT CERTIFIED when public.users query fails", async () => {
    const { generateMarkdownReport } = await import("../../scripts/diagnose-auth-identities");
    const report = reconcileIdentities({
      firebaseUsers: [{ uid: "fb-1", email: "admin@example.com", disabled: false }],
      supabaseUsers: [{ id: "sb-1", email: "admin@example.com", disabled: false }],
      publicUsers: [],
      publicStaff: [],
    });

    const markdown = generateMarkdownReport(report, {
      firebaseAuth: { source: "Firebase Auth", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 1 },
      supabaseAuth: { source: "Supabase Auth", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 1 },
      publicUsers: { source: "public.users", queriedSuccessfully: false, statusKind: "QUERY_FAILURE", statusText: "QUERY FAILED: table does not exist", total: null },
      publicStaff: { source: "public.staff", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 0 },
    });

    expect(markdown).toContain("STATUS: INCOMPLETE — RECONCILIATION NOT CERTIFIED");
    expect(markdown).not.toContain("STATUS: CLEAN");
    expect(markdown).toContain("public.users: QUERY FAILED: table does not exist");
  });

  // Test 5: public.staff permission error = INCOMPLETE, without fallback
  it("fails closed without attempting fallback when staff query encounters permission error", async () => {
    const { fetchSupabaseData } = await import("../../scripts/diagnose-auth-identities");

    const permissionError = { code: "42501", message: "permission denied for table staff" };
    expect(isMissingColumnError(permissionError, "auth_user_id")).toBe(false);

    let fallbackAttempted = false;
    const mockSupabase = {
      auth: {
        admin: {
          listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }),
        },
      },
      from: jest.fn((table: string) => {
        if (table === "users") {
          return {
            select: jest.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === "staff") {
          return {
            select: jest.fn((cols: string) => {
              if (cols.includes("auth_user_id")) {
                return Promise.resolve({ data: null, error: permissionError });
              }
              fallbackAttempted = true;
              return Promise.resolve({ data: [], error: null });
            }),
          };
        }
        return { select: jest.fn() };
      }),
    };

    const res = await fetchSupabaseData(mockSupabase);
    expect(fallbackAttempted).toBe(false);
    expect(res.publicStaffStatus.queriedSuccessfully).toBe(false);
    expect(res.publicStaffStatus.statusKind).toBe("AUTH_FAILURE");
    expect(res.publicStaffStatus.queryVariant).toBe("none (query failed without fallback)");
    expect(res.publicStaffStatus.total).toBeNull();
  });

  // Test 6: Missing auth_user_id column = permitted fallback
  it("executes permitted fallback query when staff.auth_user_id column is missing", async () => {
    const { fetchSupabaseData } = await import("../../scripts/diagnose-auth-identities");

    const missingColumnError = {
      code: "42703",
      message: 'column "auth_user_id" does not exist',
    };
    expect(isMissingColumnError(missingColumnError, "auth_user_id")).toBe(true);

    let fallbackAttempted = false;
    const mockSupabase = {
      auth: {
        admin: {
          listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }),
        },
      },
      from: jest.fn((table: string) => {
        if (table === "users") {
          return {
            select: jest.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === "staff") {
          return {
            select: jest.fn((cols: string) => {
              if (cols.includes("auth_user_id")) {
                return Promise.resolve({ data: null, error: missingColumnError });
              }
              fallbackAttempted = true;
              return Promise.resolve({
                data: [
                  { id: "s-1", email: "priest@example.com", staff_no: 7, view_only: false, status: "active", firebase_uid: "fb-p-1" },
                ],
                error: null,
              });
            }),
          };
        }
        return { select: jest.fn() };
      }),
    };

    const res = await fetchSupabaseData(mockSupabase);
    expect(fallbackAttempted).toBe(true);
    expect(res.publicStaffStatus.queriedSuccessfully).toBe(true);
    expect(res.publicStaffStatus.statusKind).toBe("SUCCESS");
    expect(res.publicStaffStatus.queryVariant).toBe("fallback without auth_user_id (column missing)");
    expect(res.publicStaff).toHaveLength(1);
    expect(res.publicStaff[0].auth_user_id).toBeNull();
  });

  // Test 7: Partial pagination failure = INCOMPLETE
  it("treats partial pagination failure as query failure and discards partial users", async () => {
    const { fetchSupabaseData } = await import("../../scripts/diagnose-auth-identities");

    const mockUsers = Array.from({ length: 200 }, (_, i) => ({
      id: `sb-uuid-${i}`,
      email: `user${i}@example.com`,
      banned_until: null,
      email_confirmed_at: "2026-01-01",
    }));

    const mockSupabase = {
      auth: {
        admin: {
          listUsers: jest.fn(({ page }: { page: number }) => {
            if (page === 1) {
              return Promise.resolve({ data: { users: mockUsers }, error: null });
            }
            return Promise.resolve({ data: null, error: new Error("Connection reset on page 2") });
          }),
        },
      },
      from: jest.fn(() => ({
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };

    const res = await fetchSupabaseData(mockSupabase);
    expect(res.supabaseAuthStatus.queriedSuccessfully).toBe(false);
    expect(res.supabaseAuthStatus.total).toBeNull();
    expect(res.supabaseUsers).toHaveLength(0); // Discarded!
    expect(res.supabaseAuthStatus.statusKind).toBe("QUERY_FAILURE");
  });

  // Test 8: Failed diagnostic exits non-zero
  it("computes allSourcesSuccessful false when any source fails, leading to non-zero exit", async () => {
    const { runDiagnostic } = await import("../../scripts/diagnose-auth-identities");

    let writtenContent = "";
    const mockDeps = {
      fetchSupabaseData: jest.fn().mockResolvedValue({
        supabaseUsers: [],
        publicUsers: [],
        publicStaff: [],
        supabaseAuthStatus: { source: "Supabase Auth" as const, queriedSuccessfully: false, statusKind: "QUERY_FAILURE" as const, statusText: "QUERY FAILED", total: null },
        publicUsersStatus: { source: "public.users" as const, queriedSuccessfully: true, statusKind: "SUCCESS" as const, statusText: "PRODUCTION QUERY SUCCESSFUL", total: 0 },
        publicStaffStatus: { source: "public.staff" as const, queriedSuccessfully: true, statusKind: "SUCCESS" as const, statusText: "PRODUCTION QUERY SUCCESSFUL", total: 0 },
      }),
      fetchFirebaseData: jest.fn().mockResolvedValue({
        firebaseUsers: [],
        firebaseAuthStatus: { source: "Firebase Auth" as const, queriedSuccessfully: true, statusKind: "SUCCESS" as const, statusText: "PRODUCTION QUERY SUCCESSFUL", total: 0 },
      }),
      writeReportFile: jest.fn((_path: string, content: string) => {
        writtenContent = content;
      }),
    };

    const result = await runDiagnostic(mockDeps);
    expect(result.allSourcesSuccessful).toBe(false);
    expect(writtenContent).toContain("STATUS: INCOMPLETE — RECONCILIATION NOT CERTIFIED");
  });

  // Test 9: Report contains no raw emails or identity IDs
  it("ensures the generated report contains no raw email addresses or full UUIDs", async () => {
    const { generateMarkdownReport } = await import("../../scripts/diagnose-auth-identities");

    const sensitiveEmail = "priest.raghavendra@matha-temple.org";
    const sensitiveUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const sensitiveFbUid = "FIREBASE_UID_SECRET_987654";

    const report = reconcileIdentities({
      firebaseUsers: [{ uid: sensitiveFbUid, email: sensitiveEmail, disabled: false }],
      supabaseUsers: [{ id: sensitiveUuid, email: sensitiveEmail, disabled: false }],
      publicUsers: [
        { id: "u-1", email: sensitiveEmail, role: "super_admin", active: true, firestore_id: sensitiveFbUid, auth_user_id: sensitiveUuid },
      ],
      publicStaff: [
        { id: "s-1", email: sensitiveEmail, staff_no: 77, role: "super_admin", active: true, firebase_uid: sensitiveFbUid, auth_user_id: sensitiveUuid },
      ],
    });

    const markdown = generateMarkdownReport(report, {
      firebaseAuth: { source: "Firebase Auth", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 1 },
      supabaseAuth: { source: "Supabase Auth", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 1 },
      publicUsers: { source: "public.users", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 1 },
      publicStaff: { source: "public.staff", queriedSuccessfully: true, statusKind: "SUCCESS", statusText: "PRODUCTION QUERY SUCCESSFUL", total: 1 },
    });

    // Verify raw sensitive identifiers are NOT present
    expect(markdown).not.toContain(sensitiveEmail);
    expect(markdown).not.toContain(sensitiveUuid);
    expect(markdown).not.toContain(sensitiveFbUid);

    // Verify masked forms ARE present
    expect(markdown).toContain(maskEmail(sensitiveEmail));
    expect(markdown).toContain(maskId(sensitiveUuid));
    expect(markdown).toContain(maskId(sensitiveFbUid));
  });

  // Test 10: Failed workflow still uploads the diagnostic report
  it("verifies that the GitHub Actions workflow uploads the report artifact even on failure", () => {
    const workflowPath = path.join(process.cwd(), ".github/workflows/auth-identity-reconciliation.yml");
    const content = fs.readFileSync(workflowPath, "utf8");

    // Workflow must only trigger on workflow_dispatch
    expect(content).toContain("workflow_dispatch:");
    expect(content).not.toMatch(/^\s*push:/m);
    expect(content).not.toMatch(/^\s*pull_request:/m);

    // Permissions must be contents: read
    expect(content).toContain("permissions:\n  contents: read");

    // Both publish summary and upload artifact steps MUST have if: always()
    expect(content).toMatch(/name:\s*Publish step summary\s*\n\s*if:\s*always\(\)/);
    expect(content).toMatch(/name:\s*Upload reconciliation report artifact\s*\n\s*if:\s*always\(\)/);

    // Artifact name and path
    expect(content).toContain("name: auth-identity-reconciliation-report");
    expect(content).toContain("path: artifacts/auth-identity-reconciliation.md");
  });
});
