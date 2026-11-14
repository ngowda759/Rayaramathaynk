/**
 * @jest-environment node
 *
 * Tests for the Supabase-native first super admin bootstrap:
 *   - scripts/lib/first-super-admin-supabase.ts   (pure planner)
 *   - scripts/seva/create-first-super-admin-supabase.ts (orchestration via injected ports)
 *
 * No Supabase, network or credentials are needed: the planner is a pure function
 * and the CLI's I/O is injected as `BootstrapPorts`. A guard test also proves the
 * two files carry no Firebase/Firestore runtime import.
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
  BootstrapError,
  envIsDryRun,
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
  return { id: UID, email: "nikhil@example.org", displayName: "Nikhil N", ...over };
}

function resolvedAuthUser(over: Partial<ResolvedAuthUser> = {}): ResolvedAuthUser {
  return { ...authUser(), disabled: false, ...over };
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

  it("refuses when there is no public.users row", () => {
    const plan = planFirstSuperAdmin({ authUser: authUser(), profile: null, profileMatch: "none", staffRows: [] });
    expect(plan.action).toBe("refuse");
    expect(plan.safe).toBe(false);
    expect(plan.blockers.join(" ")).toMatch(/No public\.users row/);
  });

  it("refuses and never changes a non-super_admin role", () => {
    const plan = planFirstSuperAdmin({
      authUser: authUser(),
      profile: profile({ role: "temple_admin" }),
      profileMatch: "auth_user_id",
      staffRows: [],
    });
    expect(plan.action).toBe("refuse");
    expect(plan.plannedStaffRow).toBeNull();
    expect(plan.blockers.join(" ")).toMatch(/not super_admin/);
    expect(plan.profile?.role).toBe("temple_admin");
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

  it("refuses when the profile is inactive", () => {
    const plan = planFirstSuperAdmin({
      authUser: authUser(),
      profile: profile({ active: false }),
      profileMatch: "auth_user_id",
      staffRows: [],
    });
    expect(plan.action).toBe("refuse");
    expect(plan.blockers.join(" ")).toMatch(/active is false/);
  });

  it("refuses when the profile is not linked to this Auth UUID (wrong identity)", () => {
    const plan = planFirstSuperAdmin({
      authUser: authUser(),
      profile: profile({ auth_user_id: null }),
      profileMatch: "email",
      staffRows: [],
    });
    expect(plan.action).toBe("refuse");
    expect(plan.blockers.join(" ")).toMatch(/auth_user_id is null/);
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
    expect(output).toContain(UID);
    expect(output).toContain("first_signed_in_at");
    expect(output).toContain("safe to write       : YES");
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
});

describe("parseArgs", () => {
  it("reads --email and --uuid in both spellings and refuses anything else", () => {
    expect(parseArgs(["--email", "Nikhil@Example.org"])).toEqual({ email: "Nikhil@Example.org", execute: false, help: false });
    expect(parseArgs(["--email=nikhil@example.org", "--execute"])).toEqual({
      email: "nikhil@example.org",
      execute: true,
      help: false,
    });
    expect(parseArgs(["--uuid", UID])).toEqual({ uuid: UID, execute: false, help: false });
    expect(parseArgs(["--help"])).toEqual({ execute: false, help: true });
    expect(() => parseArgs([])).toThrow(BootstrapError);
    expect(() => parseArgs(["--email", "not-an-email"])).toThrow(BootstrapError);
    expect(() => parseArgs(["--uuid", "not-a-uuid"])).toThrow(BootstrapError);
    expect(() => parseArgs(["--email", "a@b.org", "--uuid", UID])).toThrow(BootstrapError);
    expect(() => parseArgs(["--email", "a@b.org", "--force"])).toThrow(BootstrapError);
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

  it("projectRefFromUrl shows only the ref", () => {
    expect(projectRefFromUrl("https://kvrkraqjuyxbraccxntk.supabase.co")).toBe("kvrkraqjuyxbraccxntk");
    expect(projectRefFromUrl("nonsense")).toBe("(unrecognised URL)");
  });

  it("normalizeRole / normalizeEmail / nameFor behave", () => {
    expect(normalizeRole("Super Admin")).toBe("super_admin");
    expect(normalizeRole(undefined)).toBe("");
    expect(normalizeEmail("  Nikhil@Example.ORG ")).toBe("nikhil@example.org");
    expect(nameFor({ id: UID, email: "nikhil@example.org", displayName: null })).toBe("nikhil");
    expect(nameFor({ id: UID, email: "a@b.org", displayName: "  Nikhil N  " })).toBe("Nikhil N");
    expect(nameFor({ id: UID, email: null, displayName: null })).toBe("");
    expect(nameFor({ id: UID, email: "a@b.org", displayName: "x".repeat(120) })).toHaveLength(80);
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
