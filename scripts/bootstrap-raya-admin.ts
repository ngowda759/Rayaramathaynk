// Bootstrap the first Raya AI administrator (operator-only, server-side).
//
// Run with:
//   RAYA_ADMIN_EMAIL="admin@example.org" \
//   RAYA_ADMIN_PASSWORD="<a strong password>" \
//   RAYA_ADMIN_ROLE="super_admin" \
//   npx tsx scripts/bootstrap-raya-admin.ts
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. It is the
// only writer of `public.users.auth_user_id`/`role`, so no public user can
// self-assign administrator privileges.
//
// Idempotent: creating the auth user or the authorization row twice produces the
// same end state. Re-running never downgrades an existing role unless
// RAYA_ADMIN_FORCE_ROLE=1 is set.

import { createClient } from "@supabase/supabase-js";

const VALID_ROLES = new Set([
  "super_admin",
  "temple_admin",
  "admin",
  "billing",
  "priest",
  "staff",
  "office_staff",
]);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requireEnv("RAYA_ADMIN_EMAIL").trim().toLowerCase();
  const password = requireEnv("RAYA_ADMIN_PASSWORD");
  const role = (process.env.RAYA_ADMIN_ROLE || "super_admin").trim().toLowerCase();
  const forceRole = process.env.RAYA_ADMIN_FORCE_ROLE === "1";

  if (!VALID_ROLES.has(role)) {
    console.error(
      `Invalid RAYA_ADMIN_ROLE "${role}". Expected one of: ${[...VALID_ROLES].join(", ")}`
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("RAYA_ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Find an existing auth user by email (paginated), or create one.
  let authUserId: string | null = null;
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("Failed to list Supabase Auth users:", error.message);
      process.exit(1);
    }
    const match = data.users.find((u) => (u.email || "").toLowerCase() === email);
    if (match) {
      authUserId = match.id;
      break;
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  if (authUserId) {
    console.log(`Found existing Supabase Auth user for ${email}.`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data?.user) {
      console.error("Failed to create Supabase Auth user:", error?.message);
      process.exit(1);
    }
    authUserId = data.user.id;
    console.log(`Created Supabase Auth user for ${email}.`);
  }

  // 2. Upsert the authorization row keyed by auth_user_id.
  const { data: existing, error: readError } = await supabase
    .from("users")
    .select("id, role, active")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (readError) {
    console.error("Failed to read authorization row:", readError.message);
    process.exit(1);
  }

  if (existing) {
    const nextRole = forceRole ? role : (existing.role as string);
    const { error } = await supabase
      .from("users")
      .update({ role: nextRole, active: true })
      .eq("id", existing.id);
    if (error) {
      console.error("Failed to update authorization row:", error.message);
      process.exit(1);
    }
    console.log(
      `Authorization row updated (role=${nextRole}, active=true)${
        forceRole ? "" : " — existing role preserved (set RAYA_ADMIN_FORCE_ROLE=1 to change it)"
      }.`
    );
  } else {
    const { error } = await supabase.from("users").insert({
      auth_user_id: authUserId,
      email,
      role,
      active: true,
    });
    if (error) {
      console.error("Failed to insert authorization row:", error.message);
      process.exit(1);
    }
    console.log(`Authorization row created (role=${role}, active=true).`);
  }

  console.log(`\nDone. Sign in at /admin/ai/login with ${email}.`);
}

main().catch((error) => {
  console.error("Bootstrap failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
