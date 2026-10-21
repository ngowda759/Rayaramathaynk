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
// Idempotent: re-running converges to the same end state and never overwrites an
// administrator's role, nor reactivates an inactive account, without an explicit
// opt-in flag. Ambiguous identity matches fail closed. See
// docs/RAYA_AI_SUPABASE_NATIVE_AUTH.md for the full operator procedure and the
// scripts/lib/raya-admin-bootstrap.ts module for the decision rules.
//
// Opt-in flags (each documented in the doc above):
//   RAYA_ADMIN_FORCE_ROLE=1           change an existing role to RAYA_ADMIN_ROLE
//   RAYA_ADMIN_REACTIVATE=1           re-enable an inactive authorization row
//   RAYA_ADMIN_LINK_LEGACY_EMAIL=1    link an unlinked row that shares the email
//
// Secrets (RAYA_ADMIN_PASSWORD, SUPABASE_SERVICE_ROLE_KEY) are never logged.

import { createClient } from "@supabase/supabase-js";
import {
  escapeLikePattern,
  filterLegacyProfilesByEmail,
  normalizeEmail,
  normalizeRole,
  planBootstrap,
  selectAuthUserByEmail,
  type AuthUserLike,
  type ProfileRow,
} from "./lib/raya-admin-bootstrap";

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
  const email = normalizeEmail(requireEnv("RAYA_ADMIN_EMAIL"));
  const password = requireEnv("RAYA_ADMIN_PASSWORD");
  const role = normalizeRole(process.env.RAYA_ADMIN_ROLE || "super_admin");
  const forceRole = process.env.RAYA_ADMIN_FORCE_ROLE === "1";
  const reactivate = process.env.RAYA_ADMIN_REACTIVATE === "1";
  const linkLegacy = process.env.RAYA_ADMIN_LINK_LEGACY_EMAIL === "1";

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

  // 1. Resolve the Supabase Auth user: an existing match by email, else create.
  const authUsers: AuthUserLike[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("Failed to list Supabase Auth users:", error.message);
      process.exit(1);
    }
    authUsers.push(...data.users.map((u) => ({ id: u.id, email: u.email })));
    if (data.users.length < 200) break;
    page += 1;
  }

  const match = selectAuthUserByEmail(authUsers, email);
  if (!match.ok && match.count > 1) {
    console.error(
      `Refusing to continue: ${match.count} Supabase Auth users share the email ${email}. ` +
        `Resolve the duplicates in Supabase Auth first.`
    );
    process.exit(1);
  }

  let authUserId: string;
  if (match.ok) {
    authUserId = match.user.id;
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

  // 2. Read the authorization row already linked to this Auth user (if any).
  const { data: linked, error: linkedError } = await supabase
    .from("users")
    .select("id, email, role, active, auth_user_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (linkedError) {
    console.error("Failed to read the linked authorization row:", linkedError.message);
    process.exit(1);
  }

  // 3. Read any *unlinked* rows that share the email. `email` is not unique in
  // public.users, so this can legitimately return more than one row and the
  // planner fails closed in that case. The email is escaped so a `%` or `_` in
  // the address cannot widen the match.
  const { data: candidates, error: candidatesError } = await supabase
    .from("users")
    .select("id, email, role, active, auth_user_id")
    .is("auth_user_id", null)
    .ilike("email", escapeLikePattern(email));

  if (candidatesError) {
    console.error("Failed to read candidate authorization rows:", candidatesError.message);
    process.exit(1);
  }

  const legacyProfiles = filterLegacyProfilesByEmail(
    (candidates ?? []) as ProfileRow[],
    email
  );

  const plan = planBootstrap({
    email,
    role,
    authUserId,
    linkedProfile: (linked as ProfileRow | null) ?? null,
    legacyProfiles,
    forceRole,
    reactivate,
    linkLegacy,
  });

  if (!plan.ok) {
    console.error(`Refusing to continue: ${plan.message}`);
    process.exit(1);
  }

  for (const warning of plan.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  // 4. Apply the plan.
  switch (plan.kind) {
    case "noop": {
      console.log(
        `No change needed: ${email} is already an active ${role} administrator.`
      );
      break;
    }
    case "insert": {
      const { error } = await supabase.from("users").insert({
        auth_user_id: authUserId,
        email,
        role,
        active: true,
      });
      if (error) {
        console.error("Failed to insert the authorization row:", error.message);
        process.exit(1);
      }
      console.log(`Authorization row created (role=${role}, active=true).`);
      break;
    }
    case "update":
    case "link": {
      // Optimistic guard: a `link` must only ever claim a row that is still
      // unlinked, so a concurrent bootstrap cannot be clobbered. The partial
      // unique index on auth_user_id is the second line of defence.
      let query = supabase.from("users").update(plan.set).eq("id", plan.profileId);
      if (plan.kind === "link") {
        query = query.is("auth_user_id", null);
      }
      const { data: updated, error } = await query.select("id");
      if (error) {
        console.error("Failed to update the authorization row:", error.message);
        process.exit(1);
      }
      if (!updated || updated.length === 0) {
        console.error(
          "Failed to update the authorization row: it no longer exists or is already linked elsewhere."
        );
        process.exit(1);
      }
      console.log(
        `Authorization row ${plan.kind === "link" ? "linked to Supabase Auth" : "updated"} ` +
          `(${plan.changes.join(", ")}).`
      );
      break;
    }
  }

  console.log(`\nDone. Sign in at /admin/ai/login with ${email}.`);
}

main().catch((error) => {
  // Only the message is printed; it never contains the password or the key.
  console.error("Bootstrap failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
