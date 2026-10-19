/**
 * Makes staff no. 001 - the first super admin - for an existing sign-in account (DB §3.4, §7.9, §20.1). It is run once,
 * before anyone else is onboarded; everyone after that is onboarded on the Staff and roles page, which needs an active
 * staff member to do it.
 *
 * Usage, from the repository root:
 *   npx tsx scripts/seva/create-first-super-admin.ts --email you@example.com
 * Credentials: the Firebase service account through loadServiceAccount() (FIREBASE_SERVICE_ACCOUNT_JSON or the
 * git-ignored .firebase-adminsdk.json); Supabase from NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, taken from
 * the environment or from .env.local / .env. No secret value is ever printed.
 *
 * The account must already exist in Firebase Authentication (sign in to the site once). In the staff API's order
 * (DB §3.2) the script then writes:
 *   1. Firestore users/{uid}: role super_admin, isActive true;
 *   2. Supabase staff: row 001 for that login, status active (the owner's own account, so no invitation step);
 *   3. audit_log: staff.onboard, with no acting staff member (a script, not a person in the app).
 *
 * Safe to run again, and never a way to grant anything twice:
 * - a run that stopped part-way is finished (before the staff row: start again; after it: the missing audit row);
 * - once staff 001 exists the script changes nothing else - not the profile, the role or the status, so a later
 *   demotion or deactivation of 001 stays as it is;
 * - it refuses for any other account, and as soon as anyone is on the staff table.
 */

import * as path from "path";
import { loadServiceAccount } from "../lib/admin-credentials";

export class FirstSuperAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirstSuperAdminError";
  }
}

export interface LoginInfo {
  uid: string;
  displayName: string | null;
  disabled: boolean;
}

export interface StaffSummary {
  id: string;
  firebaseUid: string;
  staffNo: number;
  fullName: string;
  email: string;
  status: string;
}

/** Everything the script reads and writes; main() wires Firebase Admin and Supabase, tests pass a fake. */
export interface FirstSuperAdminStore {
  findLoginByEmail(email: string): Promise<LoginInfo | null>;
  setSuperAdminProfile(uid: string, profile: { email: string; name: string }): Promise<void>;
  listStaff(): Promise<StaffSummary[]>;
  /** Inserts staff no. 001, status active. */
  insertStaff(row: { firebaseUid: string; fullName: string; email: string }): Promise<{ id: string }>;
  hasOnboardAudit(staffId: string): Promise<boolean>;
  writeOnboardAudit(staffId: string, after: Record<string, unknown>): Promise<void>;
}

export interface FirstSuperAdminResult {
  outcome: "created" | "audit_completed" | "already_set_up";
  staffId: string;
  status: string;
}

const FIRST_STAFF_NO = 1;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const AUDIT_REASON = "First super admin, made by scripts/seva/create-first-super-admin.ts";
const USAGE = "Usage: npx tsx scripts/seva/create-first-super-admin.ts --email <address>";

export function parseArgs(argv: readonly string[]): { email: string } | { help: true } {
  let email: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--email") {
      email = argv[i + 1] ?? "";
      i += 1;
    } else if (arg.startsWith("--email=")) {
      email = arg.slice("--email=".length);
    } else {
      throw new FirstSuperAdminError(`Unknown argument "${arg}". ${USAGE}`);
    }
  }
  const normalised = (email ?? "").trim().toLowerCase();
  if (!EMAIL.test(normalised)) throw new FirstSuperAdminError(`Give the account's email. ${USAGE}`);
  return { email: normalised };
}

/** The display name of the login, else the part of the email before @; at most 80 characters (staff.full_name). */
function nameFor(login: LoginInfo, email: string): string {
  const name = (login.displayName ?? "").trim() || email.split("@")[0];
  return Array.from(name).slice(0, 80).join("").trim();
}

function onboardAfter(fullName: string): Record<string, unknown> {
  return { staff_no: FIRST_STAFF_NO, full_name: fullName, view_only: false, status: "active", role: "super_admin" };
}

export async function createFirstSuperAdmin(rawEmail: string, store: FirstSuperAdminStore): Promise<FirstSuperAdminResult> {
  const email = rawEmail.trim().toLowerCase();
  const login = await store.findLoginByEmail(email);
  if (!login) {
    throw new FirstSuperAdminError(
      `No sign-in account uses ${email}. Sign in to the site once with it, then run this again. Nothing was changed.`,
    );
  }
  if (login.disabled) {
    throw new FirstSuperAdminError(
      `The sign-in account for ${email} is disabled in Firebase Authentication. Enable it first. Nothing was changed.`,
    );
  }

  const staff = await store.listStaff();
  const first = staff.find((row) => row.staffNo === FIRST_STAFF_NO);
  if (first) {
    if (first.firebaseUid !== login.uid) {
      throw new FirstSuperAdminError(
        "Staff no. 001 already belongs to another account. This script only makes the first super admin. Nothing was changed.",
      );
    }
    if (await store.hasOnboardAudit(first.id)) return { outcome: "already_set_up", staffId: first.id, status: first.status };
    await store.writeOnboardAudit(first.id, onboardAfter(first.fullName));
    return { outcome: "audit_completed", staffId: first.id, status: first.status };
  }
  if (staff.length > 0) {
    throw new FirstSuperAdminError(
      "The staff table already has people on it, so the first super admin cannot be made here. " +
        "Onboard people on the Staff and roles page. Nothing was changed.",
    );
  }

  const fullName = nameFor(login, email);
  await store.setSuperAdminProfile(login.uid, { email, name: fullName });
  const { id } = await store.insertStaff({ firebaseUid: login.uid, fullName, email });
  await store.writeOnboardAudit(id, onboardAfter(fullName));
  return { outcome: "created", staffId: id, status: "active" };
}

// ---------------------------------------------------------------------------------------------------------------------
// Wiring to Firebase Admin and Supabase (only when run as a script)
// ---------------------------------------------------------------------------------------------------------------------

function databaseError(what: string, error: { code?: unknown; message?: unknown }): FirstSuperAdminError {
  const code = typeof error.code === "string" ? error.code : "unknown";
  const message = typeof error.message === "string" ? error.message : "";
  return new FirstSuperAdminError(`Could not ${what} (database code ${code}). ${message}`.trim());
}

/** The live store, and `close` to shut the Firebase app down so the process can end. */
async function openStore(): Promise<{ store: FirstSuperAdminStore; close: () => Promise<void> }> {
  const dotenv = await import("dotenv");
  for (const file of [".env.local", ".env"]) dotenv.config({ path: path.resolve(process.cwd(), file), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new FirstSuperAdminError("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (for example in .env.local).");
  }
  let account: ReturnType<typeof loadServiceAccount>;
  try {
    account = loadServiceAccount();
  } catch (error) {
    // The loader's messages name variables and fields only, never their values.
    throw new FirstSuperAdminError(error instanceof Error ? error.message : "The Firebase service account could not be read.");
  }

  const { cert, deleteApp, initializeApp } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const { FieldValue, getFirestore } = await import("firebase-admin/firestore");
  const { createClient } = await import("@supabase/supabase-js");

  const app = initializeApp({ credential: cert(account), projectId: account.projectId }, "seva-first-super-admin");
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const store: FirstSuperAdminStore = {
    async findLoginByEmail(email) {
      try {
        const user = await auth.getUserByEmail(email);
        return { uid: user.uid, displayName: user.displayName ?? null, disabled: user.disabled };
      } catch (error) {
        if ((error as { code?: unknown } | null)?.code === "auth/user-not-found") return null;
        throw error;
      }
    },

    async setSuperAdminProfile(uid, profile) {
      const ref = firestore.collection("users").doc(uid);
      const now = FieldValue.serverTimestamp();
      const existing = await ref.get();
      // A profile the site made at sign-in keeps its own fields; only the access fields change.
      await ref.set(
        existing.exists
          ? { role: "super_admin", isActive: true, updatedAt: now }
          : { uid, name: profile.name, email: profile.email, role: "super_admin", isActive: true, createdAt: now, updatedAt: now },
        { merge: true },
      );
    },

    async listStaff() {
      const { data, error } = await db
        .from("staff")
        .select("id, firebase_uid, staff_no, full_name, email, status")
        .order("staff_no", { ascending: true });
      if (error) throw databaseError("read the staff table", error);
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        firebaseUid: String(row.firebase_uid),
        staffNo: Number(row.staff_no),
        fullName: String(row.full_name),
        email: String(row.email),
        status: String(row.status),
      }));
    },

    async insertStaff(row) {
      const { data, error } = await db
        .from("staff")
        .insert({
          firebase_uid: row.firebaseUid,
          staff_no: FIRST_STAFF_NO,
          full_name: row.fullName,
          email: row.email,
          view_only: false,
          status: "active",
          status_changed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw databaseError("add staff no. 001", error);
      const id = (data as Record<string, unknown> | null)?.id;
      if (typeof id !== "string") throw new FirstSuperAdminError("Staff no. 001 was added but its id did not come back.");
      return { id };
    },

    async hasOnboardAudit(staffId) {
      const { data, error } = await db
        .from("audit_log")
        .select("id")
        .eq("action", "staff.onboard")
        .eq("entity", "staff")
        .eq("entity_id", staffId)
        .limit(1);
      if (error) throw databaseError("read the audit trail", error);
      return (data ?? []).length > 0;
    },

    async writeOnboardAudit(staffId, after) {
      const { error } = await db.rpc("seva_audit", {
        p_action: "staff.onboard",
        p_entity: "staff",
        p_entity_id: staffId,
        p_receipt_no: null,
        p_reason: AUDIT_REASON,
        p_before: null,
        p_after: after,
        p_staff_id: null,
      });
      if (error) throw databaseError("write the audit row", error);
    },
  };
  return { store, close: () => deleteApp(app) };
}

const OUTCOME_TEXT: Record<FirstSuperAdminResult["outcome"], string> = {
  created: "Staff no. 001 is now an active super admin for this account.",
  audit_completed: "Staff no. 001 already existed for this account; its missing audit row was written.",
  already_set_up: "Staff no. 001 already exists for this account. Nothing was changed.",
};

async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);
  if ("help" in args) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const { store, close } = await openStore();
  try {
    const result = await createFirstSuperAdmin(args.email, store);
    process.stdout.write(`${OUTCOME_TEXT[result.outcome]} (status: ${result.status})\n`);
    return 0;
  } finally {
    await close();
  }
}

if (typeof require !== "undefined" && require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      // Our own messages are written for the owner; anything else is named only, so no credential text is echoed.
      const text =
        error instanceof FirstSuperAdminError
          ? error.message
          : `Stopped by an unexpected ${error instanceof Error ? error.name : "error"}` +
            `${typeof (error as { code?: unknown } | null)?.code === "string" ? ` (${(error as { code: string }).code})` : ""}.`;
      process.stderr.write(`${text}\n`);
      process.exitCode = 1;
    },
  );
}
