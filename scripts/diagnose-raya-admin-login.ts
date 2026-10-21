// Read-only diagnosis of a Raya AI administrator sign-in failure.
//
// Run with (server-side only; requires the service-role key):
//   RAYA_ADMIN_EMAIL="ngowda759@gmail.com" \
//   NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="<service role key>" \
//   npx tsx scripts/diagnose-raya-admin-login.ts
//
// It performs SELECTs and read-only Auth Admin list calls only. It never writes,
// never signs in, and never reads or prints a password, token, hash or key. The
// email is normalized and printed because it is the subject of the diagnosis;
// everything else reported is structural (counts, booleans, role, timestamps).
//
// Exit code is always 0: this is a diagnostic, and its value is the report.

import { createClient } from "@supabase/supabase-js";
import {
  diagnoseRayaAdminLogin,
  type AuthUserLike,
  type AuthorizationRowLike,
} from "./lib/raya-login-diagnosis";

const line = (s = "") => console.log(s);
const head = (s: string) => line(`\n=== ${s} ===`);

function requireEnv(name: string): string | null {
  const value = (process.env[name] || "").trim();
  if (!value) {
    line(`[FAIL] Missing required environment variable: ${name}`);
    return null;
  }
  return value;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = (process.env.RAYA_ADMIN_EMAIL || "").trim().toLowerCase();

  if (!url || !serviceKey) return;
  if (!email) {
    line("[FAIL] Set RAYA_ADMIN_EMAIL to the address being diagnosed.");
    return;
  }

  head("Subject");
  line(`Email: ${email}`);
  line("(No password, token or key is read or printed by this diagnostic.)");

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  head("Supabase Auth accounts");
  const authUsers: AuthUserLike[] = [];
  try {
    let page = 1;
    for (;;) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        line(`[FAIL] listUsers failed: ${error.message}`);
        return;
      }
      for (const u of data.users) {
        authUsers.push({
          id: u.id,
          email: u.email ?? null,
          providers: (u.identities ?? []).map((i) => i.provider),
          recovery_sent_at: u.recovery_sent_at ?? null,
          email_confirmed_at: u.email_confirmed_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
      if (data.users.length < 200) break;
      page += 1;
    }
    line(`[ok]   Listed ${authUsers.length} Auth account(s).`);
  } catch (e) {
    line(`[FAIL] listUsers threw: ${(e as Error).message}`);
    return;
  }

  head("public.users authorization rows");
  const profiles: AuthorizationRowLike[] = [];
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, role, active, auth_user_id");
    if (error) {
      line(`[FAIL] users query failed: ${error.message}`);
      return;
    }
    for (const row of data ?? []) {
      profiles.push({
        id: String((row as { id: unknown }).id),
        email: ((row as { email?: string | null }).email ?? null),
        role: ((row as { role?: string | null }).role ?? null),
        active: ((row as { active?: boolean | null }).active ?? null),
        auth_user_id: ((row as { auth_user_id?: string | null }).auth_user_id ?? null),
      });
    }
    line(`[ok]   Read ${profiles.length} authorization row(s).`);
  } catch (e) {
    line(`[FAIL] users query threw: ${(e as Error).message}`);
    return;
  }

  const diagnosis = diagnoseRayaAdminLogin({ email, authUsers, profiles });

  head("Diagnosis");
  line(`Verdict: ${diagnosis.verdict}`);
  line(diagnosis.summary);
  for (const fact of diagnosis.facts) line(`  - ${fact}`);

  head("Next steps");
  line("No password is ever read here, so a wrong password cannot be proven directly.");
  line("If the verdict is `ok`, set a new password with the Supabase-native reset flow");
  line("(the /admin/ai/forgot-password page) rather than creating or re-roleing the account.");
  line("If the verdict names a structural problem, fix that specific fact.");
}

main()
  .catch((e) => line(`Diagnostic crashed: ${(e as Error).message}`))
  .finally(() => process.exit(0));
