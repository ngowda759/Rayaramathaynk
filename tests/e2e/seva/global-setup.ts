import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { E2E_PASSWORD, E2E_ROLES, e2eEmail, type E2ERole } from "./fixtures/auth";
import { E2E_STAFF } from "./fixtures/data";

/**
 * Seeds the five e2e accounts in the LOCAL Supabase stack the runner started:
 *   - a Supabase Auth user per role (email + password),
 *   - its `public.users` row (the authorization record `lib/auth/admin-auth.ts` and the seva identity
 *     adapter read: `role` and `active`), and
 *   - its `public.staff` row (the identity `lib/seva/server/auth.ts` matches by `auth_user_id`).
 *
 * There is no Firebase: no Auth emulator, no Firestore emulator, no `demo-seva` project. It talks
 * only to the `127.0.0.1` Supabase URL from the environment and refuses any other host, so a real
 * project can never be seeded.
 *
 * The rows are written with the service-role key (RLS on `users` and `staff` is deny-all for the
 * anon/authenticated roles). `staff` rows are inserted, never updated, because `seva_staff_guard`
 * makes `firebase_uid` immutable; the Auth user id is stored in both `auth_user_id` and
 * `firebase_uid`, so the columns stay consistent (see `scripts/seva/create-first-super-admin-supabase.ts`).
 */

const PASSWORD = E2E_PASSWORD;

function localUrl(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; run the seva e2e suite through \`npm run test:e2e:seva\``);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a URL`);
  }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error(`${name} must point at the local stack, got "${url.hostname}"`);
  }
  return value;
}

/** The `users.role` stored for each e2e account; the view-only flag is a staff setting, not a role. */
function usersRole(role: E2ERole): string {
  return role === "temple_admin_view_only" ? "temple_admin" : role;
}

/** The staff status: an invited person may only reach `me`, so the seeded rows are active. */
const STAFF_STATUS = "active";

async function deleteExistingAccount(admin: SupabaseClient, email: string): Promise<void> {
  // A rerun must not meet accounts from an earlier run. `listUsers` is paged; the e2e project is tiny.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  const existing = data.users.find((user) => user.email?.toLowerCase() === email);
  if (existing) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(existing.id);
    if (deleteError) throw new Error(`deleteUser(${email}) failed: ${deleteError.message}`);
  }
}

export default async function globalSetup(): Promise<void> {
  const url = localUrl("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set; run the seva e2e suite through `npm run test:e2e:seva`");
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const role of E2E_ROLES) {
    const email = e2eEmail(role);
    const staff = E2E_STAFF[role];
    const appRole = usersRole(role);

    await deleteExistingAccount(admin, email);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: staff.name },
    });
    if (createError || !created.user) {
      throw new Error(`createUser(${email}) failed: ${createError?.message ?? "no user returned"}`);
    }
    const uid = created.user.id;

    const { error: usersError } = await admin.from("users").upsert(
      {
        auth_user_id: uid,
        email,
        display_name: staff.name,
        role: appRole,
        active: true,
      },
      { onConflict: "auth_user_id" },
    );
    if (usersError) throw new Error(`users upsert(${email}) failed: ${usersError.message}`);

    const { error: staffError } = await admin.from("staff").insert({
      firebase_uid: uid,
      auth_user_id: uid,
      staff_no: staff.staffNo,
      full_name: staff.name,
      email,
      view_only: staff.viewOnly,
      status: STAFF_STATUS,
    });
    if (staffError) throw new Error(`staff insert(${email}) failed: ${staffError.message}`);
  }
}
