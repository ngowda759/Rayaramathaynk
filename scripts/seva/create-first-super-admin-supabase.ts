/**
 * Supabase-native first super admin bootstrap.
 *
 * Creates staff no. 001 - the first super admin - for an account that ALREADY
 * exists in Supabase Auth, using only Supabase Auth Admin and the Supabase
 * service role. It reads no Firebase service account and writes no Firestore
 * document; it is the Supabase-native replacement for
 * `scripts/seva/create-first-super-admin.ts` (which is Firebase-bound and cannot
 * run against the Supabase-native production database).
 *
 * Why it exists: `public.staff` must contain the first super admin before anyone
 * can be onboarded, but the Staff and roles page and `/api/admin/users/create-admin`
 * both require an existing active staff actor, so neither can create that first
 * row. This script breaks the deadlock. See the diagnosis in
 * `.openhands/memory/2026-11-14.md`.
 *
 * Usage (dry run is the default; nothing is written without `--execute`):
 *
 *   npx tsx scripts/seva/create-first-super-admin-supabase.ts --email owner@example.org
 *   npx tsx scripts/seva/create-first-super-admin-supabase.ts --uuid <auth-uuid> --execute
 *
 * Dry-run mode prints the account, the `public.users` row, any matching
 * `public.staff` rows, the exact row that would be inserted, whether the write is
 * safe, and every conflict found. It reads only.
 *
 * `DRY_RUN=true` (or `1` / `yes`) forces dry-run even when `--execute` is passed.
 *
 * Environment (read from the process, then `.env.local` / `.env`):
 *   NEXT_PUBLIC_SUPABASE_URL     e.g. https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    the service-role key (never printed)
 *
 * Guards: both variables are required; a project ref is derived from the URL and
 * printed so the operator can confirm the target; a write needs `--execute`; the
 * staff table must be empty and the account's `public.users` row must already be
 * `super_admin` + `active` + linked to this Auth UUID. No key or secret is ever
 * printed. All safety rules live in `../lib/first-super-admin-supabase.ts` and are
 * unit-tested; the orchestration below is unit-tested through injected ports.
 */

import * as path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  FIRST_SUPER_ADMIN_STAFF_NO,
  planFirstSuperAdmin,
  type AuthUserLike,
  type FirstSuperAdminPlan,
  type PlannedStaffRow,
  type StaffRow,
  type UserProfileRow,
} from "../lib/first-super-admin-supabase";

export class BootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapError";
  }
}

export interface Options {
  email?: string;
  uuid?: string;
  execute: boolean;
  help: boolean;
}

const USAGE = [
  "Usage: npx tsx scripts/seva/create-first-super-admin-supabase.ts (--email <address> | --uuid <uuid>) [--execute]",
  "",
  "  --email <address>   the existing Supabase Auth account's email",
  "  --uuid <uuid>       the existing Supabase Auth account's UUID",
  "  --execute           perform the write (default: dry run, nothing is written)",
  "  --help              show this message",
  "",
  "  DRY_RUN=true in the environment forces a dry run even with --execute.",
].join("\n");

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseArgs(argv: string[]): Options {
  const options: Options = { execute: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--execute") {
      options.execute = true;
    } else if (arg === "--email") {
      options.email = argv[++i];
    } else if (arg.startsWith("--email=")) {
      options.email = arg.slice("--email=".length);
    } else if (arg === "--uuid") {
      options.uuid = argv[++i];
    } else if (arg.startsWith("--uuid=")) {
      options.uuid = arg.slice("--uuid=".length);
    } else {
      throw new BootstrapError(`Unknown argument: ${arg}`);
    }
  }
  if (options.help) return options;
  if (options.email && options.uuid) throw new BootstrapError("Pass either --email or --uuid, not both.");
  if (!options.email && !options.uuid) throw new BootstrapError("Pass --email <address> or --uuid <uuid>.");
  if (options.email && !EMAIL_RE.test(options.email.trim())) {
    throw new BootstrapError(`--email is not a valid address: ${options.email}`);
  }
  if (options.uuid && !UUID_RE.test(options.uuid.trim())) {
    throw new BootstrapError(`--uuid is not a valid UUID: ${options.uuid}`);
  }
  return options;
}

export function envIsDryRun(env: NodeJS.ProcessEnv): boolean {
  const value = (env.DRY_RUN ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/** The <ref> from a Supabase URL, for the target banner only. Never a secret. */
export function projectRefFromUrl(url: string): string {
  const match = /^https?:\/\/([a-z0-9]+)\.supabase\./i.exec(url.trim());
  return match ? match[1] : "(unrecognised URL)";
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** The Supabase Auth account, reduced to what the plan needs. */
export interface ResolvedAuthUser extends AuthUserLike {
  disabled: boolean;
}

/**
 * The I/O the bootstrap needs, injected so the orchestration can be unit-tested
 * without a database. `createSupabasePorts` supplies the real implementation.
 */
export interface BootstrapPorts {
  resolveAuthUser(target: { email?: string; uuid?: string }): Promise<ResolvedAuthUser | null>;
  readStaff(): Promise<StaffRow[]>;
  readProfile(
    uid: string,
    email: string | null,
  ): Promise<{ profile: UserProfileRow | null; match: FirstSuperAdminPlan["profileMatch"] }>;
  insertStaff(row: PlannedStaffRow): Promise<{ id: string }>;
  writeAudit(staffId: string, reason: string): Promise<void>;
}

export interface RunOptions {
  email?: string;
  uuid?: string;
  execute: boolean;
  dryRunEnv: boolean;
  /** Injectable clock for `first_signed_in_at`; tests pass a fixed value. */
  now?: string;
}

export interface RunResult {
  mode: "dry-run" | "execute";
  action: FirstSuperAdminPlan["action"];
  safe: boolean;
  wrote: boolean;
  plan: FirstSuperAdminPlan;
}

export type Logger = (message: string) => void;

/** True when the operator asked for a write: `--execute` and no `DRY_RUN` override. */
export function isWriteMode(options: RunOptions): boolean {
  return options.execute && !options.dryRunEnv;
}

export function reportPlan(
  plan: FirstSuperAdminPlan,
  authUser: ResolvedAuthUser,
  mode: "dry-run" | "execute",
  log: Logger,
): void {
  log("");
  log(mode === "dry-run" ? "=== DRY RUN — nothing will be written ===" : "=== EXECUTE — a write is planned ===");
  log(`1. Supabase Auth UUID : ${plan.authUser.id}`);
  log(`2. email              : ${plan.authUser.email ?? "(none)"}`);
  log(`   display name       : ${authUser.displayName ?? "(none)"}`);
  log(`   account disabled   : ${authUser.disabled ? "YES" : "no"}`);

  log("3. public.users matching row:");
  if (plan.profile) {
    log(`   matched by         : ${plan.profileMatch}`);
    log(`   id                 : ${plan.profile.id}`);
    log(`   email              : ${plan.profile.email ?? "(none)"}`);
    log(`   role               : ${String(plan.profile.role)}`);
    log(`   active             : ${String(plan.profile.active)}`);
    log(`   auth_user_id       : ${plan.profile.auth_user_id ?? "(null)"}`);
    log(`   firestore_id       : ${plan.profile.firestore_id ?? "(null)"}`);
  } else {
    log("   (no row matches by auth_user_id, firestore_id or email)");
  }

  log("4. existing public.staff matching rows:");
  if (plan.existingStaffForUid.length === 0) {
    log("   (none)");
  } else {
    for (const row of plan.existingStaffForUid) {
      log(
        `   id=${row.id} staff_no=${row.staff_no} status=${row.status} auth_user_id=${row.auth_user_id ?? "(null)"} firebase_uid=${row.firebase_uid}`,
      );
    }
  }
  log(`   staff table size   : ${plan.staffRows.length} row(s)`);
  if (plan.staff001) {
    log(`   staff no. 001      : held by ${plan.staff001.email} (id ${plan.staff001.id})`);
  }

  log("5. exact INSERT that would be performed:");
  if (plan.plannedStaffRow) {
    log(`   INSERT INTO public.staff (${Object.keys(plan.plannedStaffRow).join(", ")})`);
    log(`   VALUES (${Object.values(plan.plannedStaffRow).map((v) => sqlLiteral(String(v))).join(", ")});`);
    log(`   -- planned row: ${JSON.stringify(plan.plannedStaffRow)}`);
    log(
      `   -- followed by: SELECT seva_audit('staff.onboard', 'staff', '<new id>', NULL, ${sqlLiteral(plan.plannedAudit?.reason ?? "")}, NULL, <after>, '<new id>');`,
    );
  } else {
    log("   (none — no write is planned)");
  }

  log(`6. safe to write       : ${plan.safe && plan.action === "create" ? "YES" : "NO"}`);
  log("7. conflicts / blockers:");
  if (plan.blockers.length === 0 && plan.warnings.length === 0) {
    log("   (none)");
  } else {
    for (const blocker of plan.blockers) log(`   BLOCKER: ${blocker}`);
    for (const warning of plan.warnings) log(`   warning: ${warning}`);
  }
}

/**
 * Resolve the account, read the profile and the staff table, plan, and (only in
 * write mode and only when the plan is safe) insert the row and audit it.
 *
 * Fails closed: a missing account, or any plan that is not a safe `create`,
 * throws without writing.
 */
export async function runBootstrap(
  ports: BootstrapPorts,
  options: RunOptions,
  log: Logger = console.log,
): Promise<RunResult> {
  const mode: RunResult["mode"] = isWriteMode(options) ? "execute" : "dry-run";

  const authUser = await ports.resolveAuthUser({ email: options.email, uuid: options.uuid });
  if (!authUser) {
    throw new BootstrapError(
      `No Supabase Auth account found for ${options.uuid ?? options.email}. Create the account first; this script never creates a login.`,
    );
  }

  const staffRows = await ports.readStaff();
  const { profile, match } = await ports.readProfile(authUser.id, authUser.email);
  const plan = planFirstSuperAdmin({ authUser, profile, profileMatch: match, staffRows, now: options.now });

  if (mode === "dry-run") {
    reportPlan(plan, authUser, "dry-run", log);
    log("");
    if (plan.action === "create" && plan.safe) {
      log("Dry run complete. Re-run with --execute to create staff 001.");
    } else if (plan.action === "noop") {
      log("Dry run complete. Staff 001 already belongs to this account — nothing to do.");
    } else {
      log("Dry run complete. The write is refused (see blockers above).");
    }
    return { mode, action: plan.action, safe: plan.safe, wrote: false, plan };
  }

  // Write mode. Re-check and insert inside the same guard so a rerun is safe.
  if (!plan.safe || plan.action !== "create" || !plan.plannedStaffRow) {
    reportPlan(plan, authUser, "execute", log);
    if (plan.action === "noop") {
      log("Staff 001 already belongs to this account — nothing to write.");
      return { mode, action: plan.action, safe: plan.safe, wrote: false, plan };
    }
    throw new BootstrapError("Refusing to write: the plan is not safe (see blockers above).");
  }

  // Last-moment idempotency guard: the staff table must still be empty.
  const current = await ports.readStaff();
  const mine = current.filter(
    (r) => r.auth_user_id === plan.plannedStaffRow!.auth_user_id || r.firebase_uid === plan.plannedStaffRow!.firebase_uid,
  );
  if (mine.length > 0) {
    log(`Staff 001 already belongs to this account (id ${mine[0].id}). Nothing written.`);
    return { mode, action: "noop", safe: true, wrote: false, plan };
  }
  if (current.length > 0) {
    throw new BootstrapError(
      `The staff table is no longer empty (${current.length} row(s)). Onboard people on the Staff and roles page; ` +
        "this bootstrap only creates the very first staff row. Nothing written.",
    );
  }

  const { id: staffId } = await ports.insertStaff(plan.plannedStaffRow);
  log(`Created staff 001 (id ${staffId}).`);
  try {
    await ports.writeAudit(staffId, plan.plannedAudit?.reason ?? "");
    log("Wrote the staff.onboard audit row.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Warning: the staff row was created but the audit row failed: ${message}`);
    log(`Record it manually: staff.onboard on staff ${staffId}.`);
  }
  log(`Done. ${plan.authUser.email ?? plan.authUser.id} is now staff no. ${FIRST_SUPER_ADMIN_STAFF_NO}.`);
  return { mode, action: "create", safe: true, wrote: true, plan };
}

// ---------------------------------------------------------------------------
// Real Supabase ports
// ---------------------------------------------------------------------------

const STAFF_SELECT = "id, firebase_uid, auth_user_id, staff_no, full_name, email, view_only, status";
const USER_SELECT = "id, email, role, active, auth_user_id, firestore_id";

async function findAuthUserByUuid(supabase: SupabaseClient, uuid: string): Promise<ResolvedAuthUser | null> {
  const { data, error } = await supabase.auth.admin.getUserById(uuid);
  if (error) throw new BootstrapError(`Supabase Auth lookup failed: ${error.message}`);
  return data?.user ? toResolvedAuthUser(data.user) : null;
}

async function findAuthUserByEmail(supabase: SupabaseClient, email: string): Promise<ResolvedAuthUser | null> {
  const admin = supabase.auth.admin as unknown as {
    getUserByEmail?: (e: string) => Promise<{ data?: { user?: unknown } | null; error?: { message: string } | null }>;
  };
  if (typeof admin.getUserByEmail === "function") {
    const { data, error } = await admin.getUserByEmail(email);
    if (error && !/not found/i.test(error.message)) throw new BootstrapError(`Supabase Auth lookup failed: ${error.message}`);
    const user = data?.user as { id?: string } | undefined;
    return user ? toResolvedAuthUser(user) : null;
  }

  // Fallback: paginate the Auth user list and match on email (case-insensitive).
  // The pinned SDK (@supabase/supabase-js 2.116.0) has no getUserByEmail.
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new BootstrapError(`Supabase Auth list failed: ${error.message}`);
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").trim().toLowerCase() === target);
    if (match) return toResolvedAuthUser(match);
    if (users.length < 1000) break;
  }
  return null;
}

function toResolvedAuthUser(user: unknown): ResolvedAuthUser {
  const u = user as {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
    disabled?: boolean;
    banned_until?: string | null;
  };
  const meta = u.user_metadata ?? {};
  const displayName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;
  const banned = typeof u.banned_until === "string" && u.banned_until !== "" && new Date(u.banned_until) > new Date();
  return {
    id: u.id,
    email: u.email ?? null,
    displayName,
    disabled: u.disabled === true || banned,
  };
}

export function createSupabasePorts(supabase: SupabaseClient): BootstrapPorts {
  return {
    resolveAuthUser: async (target) =>
      target.uuid
        ? findAuthUserByUuid(supabase, target.uuid.trim())
        : findAuthUserByEmail(supabase, (target.email ?? "").trim()),

    readStaff: async () => {
      const { data, error } = await supabase.from("staff").select(STAFF_SELECT).order("staff_no", { ascending: true });
      if (error) throw new BootstrapError(`Could not read public.staff: ${error.message}`);
      return (data ?? []) as StaffRow[];
    },

    readProfile: async (uid, email) => {
      async function by(column: string, value: string): Promise<UserProfileRow | null> {
        const { data, error } = await supabase.from("users").select(USER_SELECT).eq(column, value).limit(1);
        if (error) throw new BootstrapError(`Could not read public.users by ${column}: ${error.message}`);
        return ((data ?? [])[0] as UserProfileRow | undefined) ?? null;
      }
      const byAuthId = await by("auth_user_id", uid);
      if (byAuthId) return { profile: byAuthId, match: "auth_user_id" };
      const byFirestore = await by("firestore_id", uid);
      if (byFirestore) return { profile: byFirestore, match: "firestore_id" };
      if (email) {
        const byEmail = await by("email", email.trim().toLowerCase());
        if (byEmail) return { profile: byEmail, match: "email" };
      }
      return { profile: null, match: "none" };
    },

    insertStaff: async (row) => {
      const { data, error } = await supabase.from("staff").insert(row).select("id").single();
      if (error) throw new BootstrapError(`Staff insert failed: ${error.message}`);
      return { id: (data as { id: string }).id };
    },

    writeAudit: async (staffId, reason) => {
      const { error } = await supabase.rpc("seva_audit", {
        p_action: "staff.onboard",
        p_entity: "staff",
        p_entity_id: staffId,
        p_receipt_no: null,
        p_reason: reason,
        p_before: null,
        p_after: { staff_no: FIRST_SUPER_ADMIN_STAFF_NO, role: "super_admin" },
        p_staff_id: staffId,
      });
      if (error) throw new BootstrapError(error.message);
    },
  };
}

function loadEnv(): void {
  try {
    const dotenv = require("dotenv") as typeof import("dotenv");
    dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
    dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  } catch {
    /* dotenv is optional when the environment is already populated */
  }
}

async function main(): Promise<void> {
  loadEnv();
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new BootstrapError(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment or .env.local.",
    );
  }

  const runOptions: RunOptions = {
    email: options.email,
    uuid: options.uuid,
    execute: options.execute,
    dryRunEnv: envIsDryRun(process.env),
  };
  const writeMode = isWriteMode(runOptions);

  console.log("=== SUPABASE-NATIVE FIRST SUPER ADMIN BOOTSTRAP ===");
  console.log(`Target project : ${projectRefFromUrl(url)}`);
  console.log(`Mode           : ${writeMode ? "EXECUTE (will write one staff row)" : "DRY RUN (reads only, no writes)"}`);
  if (options.execute && !writeMode) {
    console.log("Note           : DRY_RUN is set in the environment; ignoring --execute.");
  }

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await runBootstrap(createSupabasePorts(supabase), runOptions);

  if (!writeMode && result.action === "refuse") process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✖ ${message}`);
    process.exit(1);
  });
}
