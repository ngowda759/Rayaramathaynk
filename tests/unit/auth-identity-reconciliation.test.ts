/**
 * @jest-environment node
 *
 * Unit tests for Phase 2 identity enumeration and reconciliation.
 */

import {
  reconcileIdentities,
  type FirebaseIdentity,
  type SupabaseIdentity,
  type PublicUserRecord,
  type PublicStaffRecord,
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
});
