/**
 * @jest-environment node
 *
 * Tests for the Supabase-native first super admin bootstrap:
 *   - scripts/lib/first-super-admin-supabase.ts   (pure planner)
 *   - scripts/seva/create-first-super-admin-supabase.ts (orchestration via injected ports)
 *
 * No Supabase, network or credentials are needed: the planner is a pure function
 * and the CLI's I/O is injected as `BootstrapPorts`. Two guard tests prove the two
 * files carry no Firebase/Firestore runtime import; the audit tests drive the real
 * `createSupabasePorts` against a fake Supabase client, so the actor attribution and
 * the conflict handling are exercised on the shipped code, not a mock of it.
 */
import * as fs from "fs";
import * as path from "path";

import {
  FIRST_SUPER_ADMIN_STAFF_NO,
  nameFor,
  normalizeEmail,
  normalizeRole,
  planFirstSuperAdmin,
  type AuthUserLike,
  type StaffRow,
  type UserProfileRow,
} from "../../../scripts/lib/first-super-admin-supabase";
import {
  BootstrapConflictError,
  BootstrapError,
  classificationHeadline,
  createSupabasePorts,
  envIsDryRun,
  isUniqueViolation,
  isWriteMode,
  parseArgs,
  projectRefFromUrl,
  runBootstrap,
  type BootstrapPorts,
  type ResolvedAuthUser,
} from "../../../scripts/seva/create-first-super-admin-supabase";

const UID = "0f6e2b1a-1c1d-4e5f-8a9b-000000000001";
const OTHER_UID = "0f6e2b1a-1c1d-4e5f-8a9b-0000000000ff";
const NOW = "2026-11-14T09:00:00.000Z";

function authUser(over: Partial<AuthUserLike> = {}): AuthUserLike {
  return { id: UID, email: "nikhil@example.org", displayName: "Nikhil N", disabled: false, emailVerified: true, ...over };
}

function resolvedAuthUser(over: Partial<ResolvedAuthUser> = {}): ResolvedAuthUser {
  return { ...authUser(), ...over };
}

function profile(over: Partial<UserProfileRow> = {}): UserProfileRow {
  return {
    id: "user-1",
    email: "nikhil@example.org",
    role: "super_admin",
    active: true,
    auth_user_id: UID,
    firestore_id: null,
    ...over,
  };
}

function staffRow(over: Partial<StaffRow> = {}): StaffRow {
  return {
    id: "staff-2",
    firebase_uid: OTHER_UID,
    auth_user_id: null,
    staff_no: 2,
    full_name: "Prakash Rao",
    email: "prakash@example.org",
    view_only: false,
    status: "active",
    ...over,
  };
}

interface FakeState {
  authUser: ResolvedAuthUser | null;
  staff: StaffRow[];
  profile: UserProfileRow | null;
  profileMatch: "auth_user_id" | "firestore_id" | "email" | "none";
  inserted: unknown[];
  audited: string[];
  failInsert: boolean;
  failAudit: boolean;
}

function freshState(over: Partial<FakeState> = {}): FakeState {
  return {
    authUser: resolvedAuthUser(),
    staff: [],
    profile: profile(),
    profileMatch: "auth_user_id",
    inserted: [],
    audited: [],
    failInsert: false,
    failAudit: false,
    ...over,
  };
}

function fakePorts(state: FakeState): BootstrapPorts {
  return {
    resolveAuthUser: async () => state.authUser,
    readStaff: async () => state.staff.map((row) => ({ ...row })),
    readProfile: async () => ({ profile: state.profile, match: state.profileMatch }),
    insertStaff: async (row) => {
      if (state.failInsert) throw new BootstrapError("connection lost");
      const id = "0f6e2b1a-1c1d-4e5f-8a9b-0000000000aa";
      state.inserted.push(row);
      state.staff.push({ ...row, id });
      return { id };
    },
    writeAudit: async (staffId, reason) => {
      if (state.failAudit) throw new BootstrapError("audit down");
      state.audited.push(`${staffId}:${reason}`);
    },
  };
}

function collect(): { log: (m: string) => void; lines: string[] } {
  const lines: string[] = [];
  return { log: (m: string) => lines.push(m), lines };
}

describe("planFirstSuperAdmin", () => {
  it("plans staff 001 with firebase_uid = auth_user_id = the Supabase Auth UUID and first_signed_in_at set", () => {
    const plan = planFirstSuperAdmin({
      authUser: authUser(),
      profile: profile(),
      profileMatch: "auth_user_id",
      staffRows: [],
      now: NOW,
    });

    expect(plan.action).toBe("create");
    expect(plan.classification).toBe("ready");
    expect(plan.safe).toBe(true);
    expect(plan.blockers).toEqual([]);
    expect(plan.plannedStaffRow).toEqual({
      firebase_uid: UID,
      auth_user_id: UID,
      staff_no: 1,
      full_name: "Nikhil N",
      email: "nikhil@example.org",
      view_only: false,
      status: "active",
      first_signed_in_at: NOW,
    });
    expect(plan.plannedAudit?.action).toBe("staff.onboard");
  });

  it("is idempotent: a staff row already linked to the account makes it a no-op", () => {
    const plan = planFirstSuperAdmin({
      authUser: authUser(),
      profile: profile(),
      profileMatch: "auth_user_id",
      staffRows: [staffRow({ id: "staff-1", staff_no: 1, firebase_uid: UID, auth_user_id: UID, email: "nikhil@example.org" })],
    });
    expect(plan.action).toBe("noop");
    expect(plan.classification).toBe("already_set_up");
    expect(plan.plannedStaffRow).toBeNull();
    expect(plan.existingStaffForUid).toHaveLength(1);
  });

  it("recognises an existing row by firebase_uid even when auth_user_id is null", () => {
    const plan = planFirstSuperAdmin({
      authUser: authUser(),
      profile: profile(),
      profileMatch: "auth_user_id",
      staffRows: [staffRow({ id: "staff-1", staff_no: 1, firebase_uid: UID, auth_user_id: null, email: "nikhil@example.org" })],
    });
    expect(plan.action).toBe("noop");
  });

  // ---- Finding 1: profile prerequisite classification -----------------------
  describe("classification (Finding 1)", () => {
    it("classifies a missing public.users row as profile_repair_required, never not_eligible", () => {
      const plan = planFirstSuperAdmin({ authUser: authUser(), profile: null, profileMatch: "none", staffRows: [] });
      expect(plan.action).toBe("refuse");
      expect(plan.classification).toBe("profile_repair_required");
      expect(plan.safe).toBe(false);
      expect(plan.eligibilityBlockers).toEqual([]);
      expect(plan.profileBlockers.join(" ")).toMatch(/No public\.users row/);
      expect(plan.repair?.reasons).toContain("missing_row");
      expect(plan.repair?.command).toContain("scripts/bootstrap-raya-admin.ts");
      expect(plan.repair?.note).toMatch(/Users page cannot repair this/);
    });

    it("classifies an unlinked row (auth_user_id null) as profile_repair_required with the LINK flag", () => {
      const plan = planFirstSuperAdmin({
        authUser: authUser(),
        profile: profile({ auth_user_id: null }),
        profileMatch: "email",
        staffRows: [],
      });
      expect(plan.classification).toBe("profile_repair_required");
      expect(plan.repair?.reasons).toContain("not_linked");
      expect(plan.repair?.command).toContain("RAYA_ADMIN_LINK_LEGACY_EMAIL=1");
    });

    it("classifies an inactive row as profile_repair_required with the REACTIVATE flag", () => {
      const plan = planFirstSuperAdmin({
        authUser: authUser(),
        profile: profile({ active: false }),
        profileMatch: "auth_user_id",
        staffRows: [],
      });
      expect(plan.classification).toBe("profile_repair_required");
      expect(plan.repair?.reasons).toContain("inactive");
      expect(plan.repair?.command).toContain("RAYA_ADMIN_REACTIVATE=1");
    });

    it("refuses and never changes a non-super_admin role, with the FORCE_ROLE flag", () => {
      const plan = planFirstSuperAdmin({
        authUser: authUser(),
        profile: profile({ role: "temple_admin" }),
        profileMatch: "auth_user_id",
        staffRows: [],
      });
      expect(plan.action).toBe("refuse");
      expect(plan.classification).toBe("profile_repair_required");
      expect(plan.plannedStaffRow).toBeNull();
      expect(plan.profileBlockers.join(" ")).toMatch(/not super_admin/);
      expect(plan.repair?.reasons).toContain("not_super_admin");
      expect(plan.repair?.command).toContain("RAYA_ADMIN_FORCE_ROLE=1");
      // The planner reports the role but never proposes a value to write itself.
      expect(plan.profile?.role).toBe("temple_admin");
    });

    it("flags a row linked to a different identity for manual review", () => {
      const plan = planFirstSuperAdmin({
        authUser: authUser(),
        profile: profile({ auth_user_id: OTHER_UID }),
        profileMatch: "email",
        staffRows: [],
      });
      expect(plan.classification).toBe("profile_repair_required");
      expect(plan.repair?.reasons).toContain("linked_to_another_identity");
    });

    it("accepts the display form 'Super Admin' as super_admin", () => {
      const plan = planFirstSuperAdmin({
        authUser: authUser(),
        profile: profile({ role: "Super Admin" }),
        profileMatch: "auth_user_id",
        staffRows: [],
      });
      expect(plan.action).toBe("create");
    });

    it("lets an ineligible account/staff table dominate the classification", () => {
      const plan = planFirstSuperAdmin({
        authUser: authUser(),
        profile: null,
        profileMatch: "none",
        staffRows: [staffRow()],
      });
      expect(plan.classification).toBe("not_eligible");
      expect(plan.repair).toBeNull();
    });
  });

  // ---- Finding 4: Supabase Auth eligibility --------------------------------
  describe("Auth account eligibility (Finding 4)", () => {
    it("refuses a banned/disabled account by default", () => {
      const plan = planFirstSuperAdmin({
        authUser: authUser({ disabled: true }),
        profile: profile(),
        profileMatch: "auth_user_id",
        staffRows: [],
      });
      expect(plan.action).toBe("refuse");
      expect(plan.classification).toBe("not_eligible");
      expect(plan.eligibilityBlockers.join(" ")).toMatch(/banned or disabled/);
    });

    it("refuses an unconfirmed email by default", () => {
      const plan = planFirstSuperAdmin({
        authUser: authUser({ emailVerified: false }),
        profile: profile(),
        profileMatch: "auth_user_id",
        staffRows: [],
      });
      expect(plan.action).toBe("refuse");
      expect(plan.classification).toBe("not_eligible");
      expect(plan.eligibilityBlockers.join(" ")).toMatch(/not confirmed/);
    });

    it("allows a disabled account only with the explicit owner opt-in", () => {
      const plan = planFirstSuperAdmin({
        authUser: authUser({ disabled: true }),
        profile: profile(),
        profileMatch: "auth_user_id",
        staffRows: [],
        allowDisabledAccount: true,
      });
      expect(plan.action).toBe("create");
    });

    it("allows an unconfirmed email only with the explicit owner opt-in", () => {
      const plan = planFirstSuperAdmin({
        authUser: authUser({ emailVerified: false }),
        profile: profile(),
        profileMatch: "auth_user_id",
        staffRows: [],
        allowUnverifiedEmail: true,
      });
      expect(plan.action).toBe("create");
    });
  });

  it("refuses once the staff table is not empty", () => {
    const plan = planFirstSuperAdmin({
      authUser: authUser(),
      profile: profile(),
      profileMatch: "auth_user_id",
      staffRows: [staffRow()],
    });
    expect(plan.action).toBe("refuse");
    expect(plan.blockers.join(" ")).toMatch(/only creates the very first staff row/);
  });

  it("refuses when staff 001 already belongs to another account", () => {
    const plan = planFirstSuperAdmin({
      authUser: authUser(),
      profile: profile(),
      profileMatch: "auth_user_id",
      staffRows: [staffRow({ id: "staff-1", staff_no: 1, email: "other@example.org" })],
    });
    expect(plan.action).toBe("refuse");
    expect(plan.blockers.join(" ")).toMatch(/Staff no\. 001 already belongs to another account/);
  });

  it("warns when the profile email differs from the Auth email", () => {
    const plan = planFirstSuperAdmin({
      authUser: authUser(),
      profile: profile({ email: "old@example.org" }),
      profileMatch: "auth_user_id",
      staffRows: [],
    });
    expect(plan.action).toBe("create");
    expect(plan.warnings.join(" ")).toMatch(/public\.users\.email/);
  });

  // ---- Finding 2: audit attribution ----------------------------------------
  describe("audit attribution (Finding 2)", () => {
    it("attributes the planned audit to the system/bootstrap, never to the new staff member", () => {
      const plan = planFirstSuperAdmin({
        authUser: authUser(),
        profile: profile(),
        profileMatch: "auth_user_id",
        staffRows: [],
      });
      expect(plan.plannedAudit?.actorStaffId).toBeNull();
      expect(plan.plannedAudit?.reason).toMatch(/system bootstrap/);
    });
  });
});

describe("runBootstrap - dry run (default)", () => {
  it("reports the plan and writes nothing", async () => {
    const state = freshState();
    const { log, lines } = collect();
    const result = await runBootstrap(fakePorts(state), { email: "nikhil@example.org", execute: false, dryRunEnv: false, now: NOW }, log);

    expect(result.mode).toBe("dry-run");
    expect(result.action).toBe("create");
    expect(result.safe).toBe(true);
    expect(result.wrote).toBe(false);
    expect(state.inserted).toEqual([]);
    expect(state.audited).toEqual([]);
    const output = lines.join("\n");
    expect(output).toContain("DRY RUN");
    expect(output).toContain("READY TO CREATE STAFF 001");
    expect(output).toContain(UID);
    expect(output).toContain("first_signed_in_at");
    expect(output).toContain("safe to write       : YES");
    expect(output).toContain("email confirmed    : yes");
  });

  it("prints the repair path and writes nothing when the profile is missing", async () => {
    const state = freshState({ profile: null, profileMatch: "none" });
    const { log, lines } = collect();
    const result = await runBootstrap(fakePorts(state), { email: "nikhil@example.org", execute: false, dryRunEnv: false }, log);
    expect(result.action).toBe("refuse");
    const output = lines.join("\n");
    expect(output).toContain("PROFILE NEEDS A SEPARATELY AUTHORIZED REPAIR");
    expect(output).toContain("scripts/bootstrap-raya-admin.ts");
    expect(state.inserted).toEqual([]);
  });

  it("DRY_RUN=true forces dry-run even when --execute is passed", async () => {
    const state = freshState();
    const { log } = collect();
    const result = await runBootstrap(fakePorts(state), { email: "nikhil@example.org", execute: true, dryRunEnv: true }, log);
    expect(result.mode).toBe("dry-run");
    expect(state.inserted).toEqual([]);
  });

  it("fails closed with a clear error when there is no Auth user", async () => {
    const state = freshState({ authUser: null });
    const { log } = collect();
    await expect(
      runBootstrap(fakePorts(state), { email: "nobody@example.org", execute: false, dryRunEnv: false }, log),
    ).rejects.toThrow(BootstrapError);
    expect(state.inserted).toEqual([]);
  });

  it("refuses (writes nothing) when the staff table is not empty", async () => {
    const state = freshState({ staff: [staffRow()] });
    const { log } = collect();
    const result = await runBootstrap(fakePorts(state), { email: "nikhil@example.org", execute: false, dryRunEnv: false }, log);
    expect(result.action).toBe("refuse");
    expect(state.inserted).toEqual([]);
  });

  it("refuses when staff 001 already belongs to another account", async () => {
    const state = freshState({ staff: [staffRow({ id: "staff-1", staff_no: 1, email: "other@example.org" })] });
    const { log } = collect();
    const result = await runBootstrap(fakePorts(state), { email: "nikhil@example.org", execute: false, dryRunEnv: false }, log);
    expect(result.action).toBe("refuse");
    expect(state.inserted).toEqual([]);
  });
});

describe("runBootstrap - execute", () => {
  it("inserts exactly one staff 001 row and writes the audit row", async () => {
    const state = freshState();
    const { log } = collect();
    const result = await runBootstrap(fakePorts(state), { email: "nikhil@example.org", execute: true, dryRunEnv: false, now: NOW }, log);

    expect(result.mode).toBe("execute");
    expect(result.wrote).toBe(true);
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toEqual({
      firebase_uid: UID,
      auth_user_id: UID,
      staff_no: FIRST_SUPER_ADMIN_STAFF_NO,
      full_name: "Nikhil N",
      email: "nikhil@example.org",
      view_only: false,
      status: "active",
      first_signed_in_at: NOW,
    });
    expect(state.audited).toHaveLength(1);
    expect(state.audited[0]).toMatch(/^0f6e2b1a-1c1d-4e5f-8a9b-0000000000aa:/);
  });

  it("is idempotent: a second execute writes nothing", async () => {
    const state = freshState();
    const ports = fakePorts(state);
    const { log } = collect();
    await runBootstrap(ports, { email: "nikhil@example.org", execute: true, dryRunEnv: false, now: NOW }, log);
    state.inserted.length = 0;
    state.audited.length = 0;
    const again = await runBootstrap(ports, { email: "nikhil@example.org", execute: true, dryRunEnv: false, now: NOW }, log);
    expect(again.action).toBe("noop");
    expect(again.wrote).toBe(false);
    expect(state.inserted).toEqual([]);
    expect(state.audited).toEqual([]);
  });

  it("refuses to write when the plan is unsafe (no public.users row)", async () => {
    const state = freshState({ profile: null, profileMatch: "none" });
    const { log } = collect();
    await expect(
      runBootstrap(fakePorts(state), { email: "nikhil@example.org", execute: true, dryRunEnv: false }, log),
    ).rejects.toThrow(/Refusing to write/);
    expect(state.inserted).toEqual([]);
  });

  it("refuses to write when the staff table is not empty", async () => {
    const state = freshState({ staff: [staffRow()] });
    const { log } = collect();
    await expect(
      runBootstrap(fakePorts(state), { email: "nikhil@example.org", execute: true, dryRunEnv: false }, log),
    ).rejects.toThrow(/Refusing to write/);
    expect(state.inserted).toEqual([]);
  });

  it("keeps the staff row and reports when only the audit write fails", async () => {
    const state = freshState({ failAudit: true });
    const { log, lines } = collect();
    const result = await runBootstrap(fakePorts(state), { email: "nikhil@example.org", execute: true, dryRunEnv: false, now: NOW }, log);
    expect(result.wrote).toBe(true);
    expect(state.inserted).toHaveLength(1);
    expect(lines.join("\n")).toMatch(/audit row failed/);
  });

  it("can be run again after a failed insert", async () => {
    const state = freshState({ failInsert: true });
    const { log } = collect();
    await expect(
      runBootstrap(fakePorts(state), { email: "nikhil@example.org", execute: true, dryRunEnv: false, now: NOW }, log),
    ).rejects.toThrow("connection lost");
    state.failInsert = false;
    const result = await runBootstrap(fakePorts(state), { email: "nikhil@example.org", execute: true, dryRunEnv: false, now: NOW }, log);
    expect(result.action).toBe("create");
    expect(result.wrote).toBe(true);
  });

  // ---- Finding 3: concurrency / idempotency --------------------------------
  it("reports a safe conflict when a concurrent bootstrap wins the race (Finding 3)", async () => {
    // Simulate a racing writer: the last-moment empty re-read still sees an empty
    // table, but the insert hits the database's uniqueness constraint.
    const state = freshState();
    let reads = 0;
    const ports: BootstrapPorts = {
      ...fakePorts(state),
      readStaff: async () => {
        reads += 1;
        // First read (plan): empty. Second read (last-moment guard): empty. Third read
        // (after the conflict): the racing writer's row is now visible.
        return reads >= 3 ? [{ ...staffRow({ id: "staff-1", staff_no: 1, firebase_uid: UID, auth_user_id: UID, email: "nikhil@example.org" }) }] : [];
      },
      insertStaff: async () => {
        throw new BootstrapConflictError("duplicate key value violates unique constraint \"staff_staff_no_key\"", "staff_staff_no_key");
      },
    };
    const { log, lines } = collect();
    const result = await runBootstrap(ports, { email: "nikhil@example.org", execute: true, dryRunEnv: false, now: NOW }, log);
    expect(result.action).toBe("noop");
    expect(result.wrote).toBe(false);
    expect(lines.join("\n")).toMatch(/concurrent write won/);
  });

  it("refuses safely when a uniqueness conflict leaves no visible row for this account", async () => {
    const state = freshState();
    const ports: BootstrapPorts = {
      ...fakePorts(state),
      insertStaff: async () => {
        throw new BootstrapConflictError("duplicate key value violates unique constraint \"staff_email_key\"", "staff_email_key");
      },
    };
    const { log } = collect();
    await expect(
      runBootstrap(ports, { email: "nikhil@example.org", execute: true, dryRunEnv: false, now: NOW }, log),
    ).rejects.toThrow(/uniqueness constraint rejected the staff row/);
    expect(state.inserted).toEqual([]);
  });
});

// ---- Finding 2: the real audit port writes a system actor ------------------
describe("createSupabasePorts.writeAudit (Finding 2)", () => {
  it("passes p_staff_id: null (system/bootstrap actor) and a truthful after payload", async () => {
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const fakeSupabase = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { error: null };
      },
    } as unknown as Parameters<typeof createSupabasePorts>[0];

    await createSupabasePorts(fakeSupabase).writeAudit("staff-1", "a reason");

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("seva_audit");
    expect(calls[0].args.p_action).toBe("staff.onboard");
    expect(calls[0].args.p_entity).toBe("staff");
    expect(calls[0].args.p_staff_id).toBeNull();
    expect(calls[0].args.p_reason).toBe("a reason");
    expect(calls[0].args.p_after).toMatchObject({ actor: "system_bootstrap" });
  });
});

describe("createSupabasePorts.insertStaff (Finding 3)", () => {
  it("turns a uniqueness violation into a BootstrapConflictError with the constraint name", async () => {
    const fakeSupabase = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint", constraint: "staff_pkey" } }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof createSupabasePorts>[0];

    const ports = createSupabasePorts(fakeSupabase);
    await expect(
      ports.insertStaff({
        firebase_uid: UID,
        auth_user_id: UID,
        staff_no: 1,
        full_name: "N",
        email: "n@example.org",
        view_only: false,
        status: "active",
        first_signed_in_at: NOW,
      }),
    ).rejects.toBeInstanceOf(BootstrapConflictError);
  });

  it("surfaces a non-uniqueness insert error as a plain BootstrapError", async () => {
    const fakeSupabase = {
      from: () => ({
        insert: () => ({
          select: () => ({ single: async () => ({ data: null, error: { code: "42501", message: "permission denied" } }) }),
        }),
      }),
    } as unknown as Parameters<typeof createSupabasePorts>[0];
    const ports = createSupabasePorts(fakeSupabase);
    await expect(
      ports.insertStaff({
        firebase_uid: UID,
        auth_user_id: UID,
        staff_no: 1,
        full_name: "N",
        email: "n@example.org",
        view_only: false,
        status: "active",
        first_signed_in_at: NOW,
      }),
    ).rejects.toThrow(/Staff insert failed/);
  });
});

describe("parseArgs", () => {
  it("reads --email and --uuid in both spellings and refuses anything else", () => {
    expect(parseArgs(["--email", "Nikhil@Example.org"])).toEqual({
      email: "Nikhil@Example.org",
      execute: false,
      help: false,
      allowUnverifiedEmail: false,
      allowDisabledAccount: false,
    });
    expect(parseArgs(["--email=nikhil@example.org", "--execute"])).toEqual({
      email: "nikhil@example.org",
      execute: true,
      help: false,
      allowUnverifiedEmail: false,
      allowDisabledAccount: false,
    });
    expect(parseArgs(["--uuid", UID])).toEqual({
      uuid: UID,
      execute: false,
      help: false,
      allowUnverifiedEmail: false,
      allowDisabledAccount: false,
    });
    expect(parseArgs(["--help"])).toEqual({ execute: false, help: true, allowUnverifiedEmail: false, allowDisabledAccount: false });
    expect(() => parseArgs([])).toThrow(BootstrapError);
    expect(() => parseArgs(["--email", "not-an-email"])).toThrow(BootstrapError);
    expect(() => parseArgs(["--uuid", "not-a-uuid"])).toThrow(BootstrapError);
    expect(() => parseArgs(["--email", "a@b.org", "--uuid", UID])).toThrow(BootstrapError);
    expect(() => parseArgs(["--email", "a@b.org", "--force"])).toThrow(BootstrapError);
  });

  it("reads the owner opt-in flags", () => {
    expect(parseArgs(["--email", "a@b.org", "--allow-unverified-email", "--allow-disabled-account"])).toMatchObject({
      allowUnverifiedEmail: true,
      allowDisabledAccount: true,
    });
  });
});

describe("helpers", () => {
  it("envIsDryRun recognises the truthy spellings", () => {
    expect(envIsDryRun({ DRY_RUN: "true" })).toBe(true);
    expect(envIsDryRun({ DRY_RUN: "1" })).toBe(true);
    expect(envIsDryRun({ DRY_RUN: "YES" })).toBe(true);
    expect(envIsDryRun({ DRY_RUN: "false" })).toBe(false);
    expect(envIsDryRun({})).toBe(false);
  });

  it("isWriteMode requires --execute and no DRY_RUN", () => {
    expect(isWriteMode({ execute: true, dryRunEnv: false })).toBe(true);
    expect(isWriteMode({ execute: true, dryRunEnv: true })).toBe(false);
    expect(isWriteMode({ execute: false, dryRunEnv: false })).toBe(false);
  });

  it("isUniqueViolation recognises the PostgREST uniqueness signal", () => {
    expect(isUniqueViolation({ code: "23505", message: "x" })).toBe(true);
    expect(isUniqueViolation({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isUniqueViolation({ code: null, message: "duplicate key value violates unique constraint" })).toBe(true);
    expect(isUniqueViolation(null)).toBe(false);
  });

  it("projectRefFromUrl shows only the ref", () => {
    expect(projectRefFromUrl("https://kvrkraqjuyxbraccxntk.supabase.co")).toBe("kvrkraqjuyxbraccxntk");
    expect(projectRefFromUrl("nonsense")).toBe("(unrecognised URL)");
  });

  it("classificationHeadline maps each classification to a plain headline", () => {
    const base = planFirstSuperAdmin({ authUser: authUser(), profile: profile(), profileMatch: "auth_user_id", staffRows: [] });
    expect(classificationHeadline(base)).toBe("READY TO CREATE STAFF 001");
    expect(classificationHeadline(planFirstSuperAdmin({ authUser: authUser(), profile: null, profileMatch: "none", staffRows: [] }))).toBe(
      "PROFILE NEEDS A SEPARATELY AUTHORIZED REPAIR",
    );
    expect(classificationHeadline(planFirstSuperAdmin({ authUser: authUser(), profile: profile(), profileMatch: "auth_user_id", staffRows: [staffRow()] }))).toBe(
      "ACCOUNT NOT ELIGIBLE",
    );
    expect(
      classificationHeadline(
        planFirstSuperAdmin({
          authUser: authUser(),
          profile: profile(),
          profileMatch: "auth_user_id",
          staffRows: [staffRow({ id: "s1", staff_no: 1, auth_user_id: UID, firebase_uid: UID })],
        }),
      ),
    ).toBe("ALREADY SET UP — nothing to do");
  });

  it("normalizeRole / normalizeEmail / nameFor behave", () => {
    expect(normalizeRole("Super Admin")).toBe("super_admin");
    expect(normalizeRole(undefined)).toBe("");
    expect(normalizeEmail("  Nikhil@Example.ORG ")).toBe("nikhil@example.org");
    expect(nameFor({ email: "nikhil@example.org", displayName: null })).toBe("nikhil");
    expect(nameFor({ email: "a@b.org", displayName: "  Nikhil N  " })).toBe("Nikhil N");
    expect(nameFor({ email: null, displayName: null })).toBe("");
    expect(nameFor({ email: "a@b.org", displayName: "x".repeat(120) })).toHaveLength(80);
  });
});

describe("no Firebase/Firestore runtime import", () => {
  const files = [
    "scripts/lib/first-super-admin-supabase.ts",
    "scripts/seva/create-first-super-admin-supabase.ts",
  ];

  it.each(files)("%s has no firebase import or admin-firebase reference", (rel) => {
    const source = fs.readFileSync(path.resolve(__dirname, "../../..", rel), "utf8");
    expect(source).not.toMatch(/from\s+["'][^"']*firebase/i);
    expect(source).not.toMatch(/require\(\s*["'][^"']*firebase/i);
    expect(source).not.toMatch(/import\(\s*["'][^"']*firebase/i);
    expect(source).not.toMatch(/admin-firebase/);
    expect(source).not.toMatch(/loadServiceAccount/);
  });

  it("the new CLI imports neither Firestore nor firebase-admin (comments may mention them)", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../../scripts/seva/create-first-super-admin-supabase.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["'][^"']*firestore/i);
    expect(source).not.toMatch(/require\(\s*["'][^"']*firestore/i);
    expect(source).not.toMatch(/import\(\s*["'][^"']*firestore/i);
    expect(source).not.toMatch(/firebase-admin/);
  });
});
