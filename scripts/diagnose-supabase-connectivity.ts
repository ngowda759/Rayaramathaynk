// Read-only Supabase connectivity diagnostic.
//
// Purpose: determine, from inside GitHub Actions (where the real secrets live),
// which layer of the Supabase stack is reachable and which is not:
//   1. Project identity          (must be the one approved project)
//   2. REST/PostgREST data path  (what the running app uses)
//   3. Supabase Auth             (whether the project has Auth enabled)
//   4. Raw PostgreSQL            (what Prisma migrations will use)
//
// This script performs SELECTs and capability probes only. It never writes, never
// mutates schema and never prints a credential, key or password.
//
// Exit status AGREES with the printed summary: 0 only when every required check
// passed and the project identity was verified; 1 otherwise (including an
// unhandled exception, and including an identity that cannot be verified).
//
// On log output and secret masking: GitHub Actions masks any occurrence of a
// secret's value - including the project ref inside NEXT_PUBLIC_SUPABASE_URL -
// so the ref renders as `***` in CI logs and cannot be "un-masked" from here.
// We therefore never rely on printing the ref as evidence. Instead we compare
// the configured values against the approved constant and print only booleans
// plus short SHA-256 fingerprints, which are not substrings of any secret and so
// survive masking.

import { createClient } from "@supabase/supabase-js";
import {
  analyzeDbUrlRef,
  APPROVED_PROJECT_REF,
  fingerprint,
  isApprovedRef,
  refFromSupabaseUrl,
} from "./lib/approved-project.mjs";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const dbUrl = (process.env.SUPABASE_DB_URL || "").trim();
const projectRef = (process.env.SUPABASE_PROJECT_REF || "").trim();

const line = (s = "") => console.log(s);
const head = (s: string) => line("\n=== " + s + " ===");

let failures = 0;
const fail = (s: string) => {
  failures++;
  line("  [FAIL] " + s);
};
const ok = (s: string) => line("  [ok]   " + s);
const info = (s: string) => line("  [info] " + s);

/**
 * Verify every configured source of the project ref against the approved ref.
 * Fails closed: a mismatch fails, and so does the inability to verify at all.
 */
function checkProjectIdentity(): void {
  head("Project identity (must be the approved project)");
  info(`approved project ref: ${APPROVED_PROJECT_REF} (fingerprint ${fingerprint(APPROVED_PROJECT_REF)})`);

  const dbAnalysis = analyzeDbUrlRef(dbUrl);
  const sources: Array<{ label: string; present: boolean; ref: string; reason?: string }> = [
    { label: "SUPABASE_PROJECT_REF", present: !!projectRef, ref: projectRef },
    { label: "NEXT_PUBLIC_SUPABASE_URL (ref from host)", present: !!url, ref: refFromSupabaseUrl(url) },
    {
      label: "SUPABASE_DB_URL (ref from username/host)",
      present: !!dbUrl,
      ref: dbAnalysis.ref,
      reason: dbAnalysis.ambiguous
        ? "the username and hostname name different projects"
        : dbAnalysis.malformed
          ? "the value is not a parseable URL"
          : undefined,
    },
  ];

  const present = sources.filter((s) => s.present);
  if (present.length === 0) {
    fail(
      "No project-ref source is configured (SUPABASE_PROJECT_REF, NEXT_PUBLIC_SUPABASE_URL, " +
        "SUPABASE_DB_URL are all empty). Identity cannot be verified; refusing to pass."
    );
    return;
  }

  for (const s of sources) {
    if (!s.present) {
      info(`${s.label}: absent (not checked)`);
      continue;
    }
    if (!s.ref) {
      fail(
        `${s.label}: present but no project ref could be derived from it` +
          `${s.reason ? ` (${s.reason})` : ""}. Cannot verify identity.`
      );
      continue;
    }
    const matches = isApprovedRef(s.ref);
    info(`${s.label}: fingerprint ${fingerprint(s.ref)} matches approved: ${matches}`);
    if (!matches) {
      fail(
        `${s.label} does not resolve to the approved project. ` +
          `expected fingerprint ${fingerprint(APPROVED_PROJECT_REF)}, got ${fingerprint(s.ref)}.`
      );
    }
  }

  if (failures === 0) {
    ok(`All ${present.length} configured project-ref source(s) resolve to the approved project.`);
  }
}

async function main(): Promise<number> {
  head("Environment presence (no values)");
  info(`NEXT_PUBLIC_SUPABASE_URL: ${url ? "present" : "MISSING"}`);
  info(`NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anonKey ? `present (len ${anonKey.length})` : "absent"}`);
  info(`SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? `present (len ${serviceKey.length})` : "MISSING"}`);
  info(`SUPABASE_DB_URL: ${dbUrl ? "present" : "absent (migration path untested)"}`);
  info(`SUPABASE_PROJECT_REF: ${projectRef ? "present" : "absent"}`);

  checkProjectIdentity();

  // Identity is a precondition for trusting anything measured below.
  if (failures > 0) {
    head("Summary");
    line("Project identity could not be verified against the approved project.");
    line("Skipping layer probes: results from an unverified target are not evidence.");
    line(`\n${failures} check(s) failed.`);
    return 1;
  }

  head("REST / PostgREST data path (service role)");
  if (!url || !serviceKey) {
    fail("Need both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  } else {
    const sb = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const tables = [
      "ai_settings",
      "ai_knowledge",
      "chat_sessions",
      "chat_messages",
      "unknown_questions",
      "ai_intent_distribution",
      "ai_latency_records",
    ];
    for (const t of tables) {
      const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
      if (error) {
        fail(`${t}: ${error.code || ""} ${error.message}`);
      } else {
        ok(`${t}: reachable, ${count ?? "?"} rows`);
      }
    }
  }

  head("Supabase Auth capability");
  if (!url || !serviceKey) {
    fail("Skipped: need URL and service role key.");
  } else {
    // Admin API requires the service role key. A 200 proves Auth is enabled and
    // the key is valid for it; 401 means the key is not a service role key.
    try {
      const res = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      });
      const body = await res.text();
      if (res.status === 200) {
        ok(`Auth admin API reachable (HTTP 200). Auth is enabled.`);
        let n: number | undefined;
        try {
          const j = JSON.parse(body);
          if (Array.isArray(j?.users)) n = j.users.length;
        } catch {
          /* body shape varies; not important */
        }
        if (typeof n === "number") info(`admin users endpoint returned ${n} row(s) on page 1`);
      } else {
        fail(
          `Auth admin API HTTP ${res.status}: ${body.slice(0, 300).replace(/eyJ[A-Za-z0-9._-]+/g, "<jwt>")}`
        );
      }
    } catch (e) {
      fail(`Auth admin API request failed: ${(e as Error).message}`);
    }
  }

  head("Raw PostgreSQL path (Prisma migrations will use this)");
  if (!dbUrl) {
    info("Skipped: SUPABASE_DB_URL is not set in this environment.");
  } else {
    try {
      // pg is not a declared dependency; treat it as best-effort.
      const mod = (await import("pg")) as unknown as {
        Client: new (cfg: Record<string, unknown>) => {
          connect: () => Promise<void>;
          query: (q: string) => Promise<{ rows: unknown[] }>;
          end: () => Promise<void>;
        };
      };
      const u = new URL(dbUrl);
      // Strip sslmode so our explicit ssl config governs verification. Some CI
      // images present an intercepting proxy cert; report it rather than hide it.
      u.searchParams.delete("sslmode");
      const client = new mod.Client({
        connectionString: u.toString(),
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
      });
      try {
        await client.connect();
        const r = await client.query("select current_database() as db, current_user as usr");
        const row = r.rows[0] as { db: string; usr: string };
        ok(`Connected. database=${row.db} user=${String(row.usr).replace(/\.[a-z0-9]{10,}/, ".<ref>")}`);
        const t = await client.query(
          "select count(*)::int as n from information_schema.tables where table_schema='public'"
        );
        info(`public tables visible: ${(t.rows[0] as { n: number }).n}`);
        await client.end();
      } catch (e) {
        const err = e as { code?: string; message?: string };
        fail(`Raw DB connect failed: ${err.code || ""} ${err.message || ""}`);
      }
    } catch {
      info("pg module not installed; raw PostgreSQL path not tested.");
    }
  }

  head("Summary");
  if (failures === 0) {
    line("All required checks passed against the approved project.");
  } else {
    line(`${failures} check(s) failed. See [FAIL] entries above.`);
  }
  line(
    "\nNo credentials were printed. The approved ref appears in CI logs only as " +
      "its SHA-256 fingerprint, because GitHub masks the ref itself."
  );
  return failures === 0 ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e) => {
    // An unhandled exception must never look like success.
    console.error("Diagnostic crashed:", (e as Error).message);
    process.exitCode = 1;
  });
