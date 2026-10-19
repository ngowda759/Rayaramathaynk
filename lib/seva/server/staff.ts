/**
 * Staff and roles (DB §3.2, §3.4, §13.6) - the only code that changes a person's sign-in (the login and the Firestore
 * profile, through the identity adapter) or their Supabase `staff` row. The staff routes and the older
 * /api/admin/users routes both call it, so all of them answer to the same rules.
 *
 * Who may do what (DB §3.3 rows 18-23, C-17). The route guard (`requireStaffAdmin`) first admits the people who may
 * onboard at all: an active temple admin who is not view-only, or a super admin. Each change is then judged with its
 * full context - the person's current Firestore role, their staff id and the new role. On top of the matrix:
 * - nobody changes their own role, view-only switch or status here (row 20 reads "another person's"; a super admin
 *   deactivating or deleting themself could lock the module out);
 * - a deleted person stays deleted (DB §3.4);
 * - the view-only switch is for temple admins; a role change that moves someone off temple admin clears it, so it
 *   can never block a receptionist's counter.
 *
 * Order of writes (DB §3.2): identity first, then the staff row, then the audit row. A deactivation disables the login
 * and revokes its sessions before anything else; a deletion removes the login last within the identity step. When a
 * step fails after an earlier write went through, the answer is 502 partial_failure whose detail
 * (StaffPartialFailure) names what was done and what failed - never silent. Nothing is rolled back: the detail says
 * exactly where the person now stands, and the office finishes the change from there.
 */

import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { SevaError } from "@/lib/seva/errors";
import { can, mapFirestoreRole, type PermissionContext, type SevaActor } from "@/lib/seva/permissions";
import type { StaffOnboardRequest, StaffUpdateRequest } from "@/lib/seva/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SevaAction, SevaRole } from "@/types/seva";
import type {
  StaffChangeStep,
  StaffListFilter,
  StaffMember,
  StaffOnboardResponse,
  StaffPartialFailure,
  StaffStatus,
} from "@/types/seva-staff";
import { requireSevaActor, type ActorResult } from "./auth";
import { getIdentityAdapter } from "./identity";
import { callRpc } from "./rpc";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * The guard of every staff route: may onboard at least a receptionist (row 18) - an active temple admin who is not
 * view-only, or a super admin. Everything finer is checked per change below.
 */
export function requireStaffAdmin(req: NextRequest): Promise<ActorResult> {
  return requireSevaActor(req, "staff.onboard", { ctx: { newRole: "receptionist" } });
}

export const staffListQuerySchema = z.object({
  filter: z.enum(["all", "active", "inactive"]).default("all"),
  view: z.enum(["list", "next-staff-no"]).default("list"),
});

// ---------------------------------------------------------------------------------------------------------------------
// Reading staff rows
// ---------------------------------------------------------------------------------------------------------------------

const STAFF_COLUMNS = "id, firebase_uid, staff_no, full_name, email, view_only, status, invited_at, first_signed_in_at";
const STATUSES: readonly StaffStatus[] = ["invited", "active", "inactive", "deleted"];
const FILTER_STATUSES: Record<StaffListFilter, readonly StaffStatus[] | null> = {
  all: null,
  active: ["active", "invited"],
  inactive: ["inactive", "deleted"],
};

interface StaffRow {
  id: string;
  firebaseUid: string;
  staffNo: number;
  fullName: string;
  email: string;
  viewOnly: boolean;
  status: StaffStatus;
  invitedAt: string | null;
  firstSignedInAt: string | null;
}

function isStatus(value: unknown): value is StaffStatus {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new SevaError("internal");
  return value;
}

function toStaffRow(raw: unknown): StaffRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.firebase_uid !== "string" ||
    typeof row.staff_no !== "number" ||
    typeof row.full_name !== "string" ||
    typeof row.email !== "string" ||
    typeof row.view_only !== "boolean" ||
    !isStatus(row.status)
  ) {
    throw new SevaError("internal");
  }
  return {
    id: row.id,
    firebaseUid: row.firebase_uid,
    staffNo: row.staff_no,
    fullName: row.full_name,
    email: row.email,
    viewOnly: row.view_only,
    status: row.status,
    invitedAt: optionalText(row.invited_at),
    firstSignedInAt: optionalText(row.first_signed_in_at),
  };
}

/** The rows of a Supabase answer; a database error becomes SevaError('internal') (its text is not logged). */
function rowsOf(result: { data: unknown; error: unknown }): unknown[] {
  if (result.error) throw new SevaError("internal");
  return Array.isArray(result.data) ? result.data : [];
}

async function findStaff(
  db: AdminClient,
  column: "id" | "firebase_uid" | "email" | "staff_no",
  value: string | number,
): Promise<StaffRow | null> {
  const { data, error } = await db.from("staff").select(STAFF_COLUMNS).eq(column, value).maybeSingle();
  if (error) throw new SevaError("internal");
  return data ? toStaffRow(data) : null;
}

/** A timestamptz from PostgREST as an ISO-8601 UTC string; null when missing or unreadable. */
function toIso(value: string | null): string | null {
  if (value === null) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

function latest(values: readonly (string | null)[]): string | null {
  let best: string | null = null;
  for (const value of values) {
    const iso = toIso(value);
    if (iso !== null && (best === null || iso > best)) best = iso;
  }
  return best;
}

function firstText(rows: unknown[], key: string): string | null {
  const first = rows[0] as Record<string, unknown> | undefined;
  return typeof first?.[key] === "string" ? (first[key] as string) : null;
}

/**
 * When the person last did something in the seva module: their latest audited action or receipt issued (both read
 * through an index on staff id and time), or else their first sign-in.
 */
async function lastActivity(db: AdminClient, row: StaffRow): Promise<string | null> {
  const [audit, receipt] = await Promise.all([
    db.from("audit_log").select("at").eq("actor_staff_id", row.id).order("at", { ascending: false }).limit(1),
    db
      .from("seva_receipts")
      .select("issued_at")
      .eq("issued_by_staff_id", row.id)
      .order("issued_at", { ascending: false })
      .limit(1),
  ]);
  return latest([row.firstSignedInAt, firstText(rowsOf(audit), "at"), firstText(rowsOf(receipt), "issued_at")]);
}

/** The staff list, in staff-number order, with each person's role from Firestore. Never carries a phone number. */
export async function listStaff(filter: StaffListFilter): Promise<StaffMember[]> {
  const db = createAdminClient();
  const statuses = FILTER_STATUSES[filter];
  const query = db.from("staff").select(STAFF_COLUMNS);
  const filtered = statuses ? query.in("status", [...statuses]) : query;
  const rows = rowsOf(await filtered.order("staff_no", { ascending: true })).map(toStaffRow);

  const identity = getIdentityAdapter();
  return Promise.all(
    rows.map(async (row): Promise<StaffMember> => {
      const [profile, lastActiveAt] = await Promise.all([identity.getAccessProfile(row.firebaseUid), lastActivity(db, row)]);
      return {
        id: row.id,
        staffNo: row.staffNo,
        fullName: row.fullName,
        email: row.email,
        role: mapFirestoreRole(profile?.role),
        viewOnly: row.viewOnly,
        status: row.status,
        lastActiveAt,
        invitedAt: toIso(row.invitedAt),
        firstSignedInAt: toIso(row.firstSignedInAt),
      };
    }),
  );
}

/** The next free staff number (max + 1; numbers are never reused). */
export async function nextStaffNo(): Promise<number> {
  const value = await callRpc<unknown>("seva_next_staff_no", {});
  const no = typeof value === "string" ? Number(value) : value;
  if (typeof no !== "number" || !Number.isInteger(no) || no < 1 || no > 999) throw new SevaError("internal");
  return no;
}

// ---------------------------------------------------------------------------------------------------------------------
// Writing: rules and the ordered steps
// ---------------------------------------------------------------------------------------------------------------------

function allow(actor: SevaActor, action: SevaAction, ctx?: PermissionContext): void {
  if (!can(actor, action, ctx)) throw new SevaError("forbidden");
}

function invalid(field: string, message: string): SevaError {
  return new SevaError("validation", { field, message });
}

function staffNoText(no: number): string {
  return String(no).padStart(3, "0");
}

interface Write {
  /** What this write changes, for the partial-failure detail: 'login', 'profile', 'row'. */
  name: string;
  run: () => Promise<unknown>;
}

interface Step {
  step: StaffChangeStep;
  writes: Write[];
}

/**
 * Runs the steps in order. A failure before anything was written throws that error as it is; a failure after any
 * write went through throws SevaError('partial_failure') with StaffPartialFailure as its detail.
 */
async function runSteps(steps: readonly Step[]): Promise<void> {
  const done: StaffChangeStep[] = [];
  for (const { step, writes } of steps) {
    if (writes.length === 0) continue;
    const partly: string[] = [];
    for (const write of writes) {
      try {
        await write.run();
      } catch (error) {
        if (done.length === 0 && partly.length === 0) throw error;
        const detail: StaffPartialFailure = {
          done: [...done],
          failed: step,
          ...(partly.length > 0 ? { partly } : {}),
          cause: error instanceof SevaError ? error.code : "internal",
        };
        throw new SevaError("partial_failure", { ...detail });
      }
      partly.push(write.name);
    }
    done.push(step);
  }
}

export interface OnboardOptions {
  /**
   * Makes the login. Left out, the identity adapter's `createLogin` is used (no password: the client then sends
   * Firebase's own set-password email, C-56). The older create-admin route passes its own, which sets a password.
   */
  createLogin?: (login: { email: string; displayName: string }) => Promise<{ externalUid: string }>;
}

/**
 * Onboards a person (row 18; super admin needs row 19): login -> profile (role, active) -> `seva_staff_onboard`
 * (status invited, the staff.onboard audit row inside). The staff number is the one asked for, else the next free one.
 */
export async function onboardStaff(
  actor: SevaActor,
  input: StaffOnboardRequest,
  opts: OnboardOptions = {},
): Promise<StaffOnboardResponse> {
  allow(actor, "staff.onboard", { newRole: input.role });
  if (input.role === "super_admin") allow(actor, "staff.grant_super_admin");
  if (input.viewOnly && input.role !== "temple_admin") throw invalid("viewOnly", "View-only is for temple admins only");

  const db = createAdminClient();
  const staffNo = input.staffNo ?? (await nextStaffNo());
  // Checked before any write so that a taken number or email never leaves a login behind. The SQL function checks
  // both again under its table lock; losing that race to another onboarding answers partial_failure.
  const [sameNo, sameEmail] = await Promise.all([findStaff(db, "staff_no", staffNo), findStaff(db, "email", input.email)]);
  if (sameNo) throw invalid("staffNo", `Staff no. ${staffNoText(staffNo)} is already taken`);
  if (sameEmail) throw invalid("email", "This email already belongs to a staff member");

  const identity = getIdentityAdapter();
  const createLogin = opts.createLogin ?? ((login) => identity.createLogin(login));
  let externalUid = "";
  let staffId = "";
  await runSteps([
    {
      step: "identity",
      writes: [
        {
          name: "login",
          run: async () => {
            externalUid = (await createLogin({ email: input.email, displayName: input.fullName })).externalUid;
          },
        },
        {
          name: "profile",
          run: () =>
            identity.setAccessProfile(externalUid, {
              role: input.role,
              isActive: true,
              email: input.email,
              displayName: input.fullName,
            }),
        },
      ],
    },
    {
      step: "staff",
      writes: [
        {
          name: "row",
          run: async () => {
            const id = await callRpc<unknown>("seva_staff_onboard", {
              p_staff: {
                firebase_uid: externalUid,
                full_name: input.fullName,
                email: input.email,
                staff_no: staffNo,
                view_only: input.viewOnly,
              },
              p_actor: actor.staffId,
            });
            if (typeof id !== "string" || id === "") throw new SevaError("internal");
            staffId = id;
          },
        },
      ],
    },
  ]);
  return { staffId, staffNo };
}

const STATUS_ACTION: Record<NonNullable<StaffUpdateRequest["status"]>, SevaAction> = {
  active: "staff.reactivate",
  inactive: "staff.deactivate",
  deleted: "staff.delete",
};

function roleAuditWrite(actor: SevaActor, staffId: string, before: string | null, after: string, reason: string | null): Write {
  return {
    name: "row",
    run: () =>
      callRpc<unknown>("seva_audit", {
        p_action: "staff.role_change",
        p_entity: "staff",
        p_entity_id: staffId,
        p_receipt_no: null,
        p_reason: reason,
        p_before: { role: before },
        p_after: { role: after },
        p_staff_id: actor.staffId,
      }),
  };
}

function clearViewOnlyWrite(actor: SevaActor, staffId: string, reason: string | null): Write {
  return {
    name: "row",
    run: () =>
      callRpc<unknown>("seva_staff_update", {
        p_staff_id: staffId,
        p_patch: { view_only: false },
        p_reason: reason,
        p_actor: actor.staffId,
      }),
  };
}

const staffIdSchema = z.guid();

/**
 * Changes another person's role (row 20, or 19 for super admin), view-only switch (row 20) and/or status (rows 21-23).
 * Identity first (deactivate: login off and sessions revoked, then the profile; delete: profile off, then the login is
 * removed; reactivate: profile on, then the login), then `seva_staff_update`, then the staff.role_change audit row.
 */
export async function updateStaff(actor: SevaActor, staffId: string, patch: StaffUpdateRequest): Promise<void> {
  if (!staffIdSchema.safeParse(staffId).success) throw new SevaError("not_found", { entity: "staff" });
  const db = createAdminClient();
  const target = await findStaff(db, "id", staffId);
  if (!target) throw new SevaError("not_found", { entity: "staff" });
  if (target.status === "deleted") {
    throw invalid("status", "A deleted staff member stays deleted. Onboard them again as a new staff member.");
  }
  if (target.id === actor.staffId) throw new SevaError("forbidden");

  const identity = getIdentityAdapter();
  const profile = await identity.getAccessProfile(target.firebaseUid);
  const rawRole = typeof profile?.role === "string" ? profile.role : null;
  const currentRole: SevaRole | undefined = mapFirestoreRole(profile?.role) ?? undefined;

  if (patch.role !== undefined || patch.viewOnly !== undefined) {
    allow(actor, "staff.change_role", { targetRole: currentRole, targetStaffId: target.id, newRole: patch.role });
  }
  if (patch.role === "super_admin") allow(actor, "staff.grant_super_admin");
  if (patch.status !== undefined) allow(actor, STATUS_ACTION[patch.status]);

  const newRole = patch.role !== undefined && patch.role !== currentRole ? patch.role : undefined;
  const resultingRole = patch.role ?? currentRole;
  if (patch.viewOnly === true && resultingRole !== "temple_admin") {
    throw invalid("viewOnly", "View-only is for temple admins only");
  }
  const viewOnly = newRole && resultingRole !== "temple_admin" && target.viewOnly ? false : patch.viewOnly;
  const change =
    patch.status === "inactive" && target.status !== "inactive"
      ? "deactivate"
      : patch.status === "deleted"
        ? "delete"
        : patch.status === "active" && target.status === "inactive"
          ? "reactivate"
          : null;
  const reason = patch.reason ? patch.reason : null;
  const uid = target.firebaseUid;

  const profilePatch: { role?: string; isActive?: boolean } = {};
  if (newRole) profilePatch.role = newRole;
  if (change) profilePatch.isActive = change === "reactivate";

  const identityWrites: Write[] = [];
  if (change === "deactivate") identityWrites.push({ name: "login", run: () => identity.setLoginEnabled(uid, false) });
  if (Object.keys(profilePatch).length > 0) {
    identityWrites.push({ name: "profile", run: () => identity.setAccessProfile(uid, profilePatch) });
  }
  if (change === "reactivate") identityWrites.push({ name: "login", run: () => identity.setLoginEnabled(uid, true) });
  if (change === "delete") identityWrites.push({ name: "login", run: () => identity.deleteLogin(uid) });

  const staffPatch: { view_only?: boolean; status?: string } = {};
  if (viewOnly !== undefined && viewOnly !== target.viewOnly) staffPatch.view_only = viewOnly;
  if (change && patch.status) staffPatch.status = patch.status;
  const staffWrites: Write[] =
    Object.keys(staffPatch).length > 0
      ? [
          {
            name: "row",
            run: () =>
              callRpc<unknown>("seva_staff_update", {
                p_staff_id: target.id,
                p_patch: staffPatch,
                p_reason: reason,
                p_actor: actor.staffId,
              }),
          },
        ]
      : [];

  await runSteps([
    { step: "identity", writes: identityWrites },
    { step: "staff", writes: staffWrites },
    { step: "audit", writes: newRole ? [roleAuditWrite(actor, target.id, rawRole, newRole, reason)] : [] },
  ]);
}

/**
 * The older set-role route: writes a role (one of that route's own role names) to a person's Firestore profile under
 * the same rules - super admin only by a super admin (row 19); a temple admin only for another person who has a staff
 * row and is below super admin (row 20, C-17; legacy roles are a super admin's call, C-62). An account without a
 * profile has never signed in and is not found, as before. A person with a staff row gets the staff.role_change audit
 * row (and loses a view-only switch that no longer applies).
 */
export async function setAccountRole(
  actor: SevaActor,
  input: { externalUid: string; role: string },
): Promise<{ audited: boolean }> {
  const db = createAdminClient();
  const identity = getIdentityAdapter();
  const [profile, target] = await Promise.all([
    identity.getAccessProfile(input.externalUid),
    findStaff(db, "firebase_uid", input.externalUid),
  ]);
  if (!profile) throw new SevaError("not_found", { entity: "user" });
  if (input.externalUid === actor.uid || target?.id === actor.staffId) throw new SevaError("forbidden");
  if (target?.status === "deleted") {
    throw invalid("status", "A deleted staff member stays deleted. Onboard them again as a new staff member.");
  }

  const currentRole = mapFirestoreRole(profile.role) ?? undefined;
  const newRole = mapFirestoreRole(input.role) ?? undefined;
  if (newRole === "super_admin") allow(actor, "staff.grant_super_admin");
  allow(actor, "staff.change_role", { targetRole: currentRole, targetStaffId: target?.id, newRole });

  const rawRole = typeof profile.role === "string" ? profile.role : null;
  if (rawRole === input.role) return { audited: false };

  await runSteps([
    {
      step: "identity",
      writes: [{ name: "profile", run: () => identity.setAccessProfile(input.externalUid, { role: input.role }) }],
    },
    {
      step: "staff",
      writes: target && target.viewOnly && newRole !== "temple_admin" ? [clearViewOnlyWrite(actor, target.id, null)] : [],
    },
    { step: "audit", writes: target ? [roleAuditWrite(actor, target.id, rawRole, input.role, null)] : [] },
  ]);
  return { audited: target !== null };
}
