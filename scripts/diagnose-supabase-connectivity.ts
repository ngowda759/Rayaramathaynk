// Read-only Supabase connectivity diagnostic.
//
// Purpose: determine, from inside GitHub Actions (where the real secrets live),
// which layer of the Supabase stack is reachable and which is not:
//   1. REST/PostgREST data path  (what the running app uses)
//   2. Supabase Auth             (whether the project has Auth enabled)
//   3. Raw PostgreSQL            (what Prisma migrations will use)
//
// This script performs SELECTs and capability probes only. It never writes,
// never mutates schema and never prints a credential, key or password. Hostnames
// are printed because they are public (NEXT_PUBLIC_SUPABASE_URL is shipped to
// browsers); secrets are reduced to presence plus length.

import { createClient } from "@supabase/supabase-js";

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

/** Hostnames are public; credentials are not. */
function hostOf(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return "(unparseable)";
  }
}

function refFromHost(u: string): string {
  try {
    const h = new URL(u).hostname;
    return h.endsWith(".supabase.co") ? h.split(".")[0] : "";
  } catch {
    return "";
  }
}

async function main() {
  head("Environment presence (no values)");
  info(`NEXT_PUBLIC_SUPABASE_URL: ${url ? "present" : "MISSING"}`);
  info(`NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anonKey ? `present (len ${anonKey.length})` : "absent"}`);
  info(`SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? `present (len ${serviceKey.length})` : "MISSING"}`);
  info(`SUPABASE_DB_URL: ${dbUrl ? "present" : "absent (migration path untested)"}`);
  info(`SUPABASE_PROJECT_REF: ${projectRef ? `present (len ${projectRef.length})` : "absent"}`);

  head("Project identity");
  if (!url) {
    fail("NEXT_PUBLIC_SUPABASE_URL is missing; cannot identify the project.");
  } else {
    const host = hostOf(url);
    const urlRef = refFromHost(url);
    info(`API host: ${host}`);
    info(`ref derived from host: ${urlRef || "(host is not *.supabase.co)"}`);
    if (projectRef) {
      const match = urlRef === projectRef;
      info(`host ref == SUPABASE_PROJECT_REF: ${match}`);
      if (!match) {
        fail(
          "The API URL and SUPABASE_PROJECT_REF point at different projects. " +
            "The workflow computes the API URL from the ref, so one of them is stale."
        );
      }
    }
  }

  if (dbUrl) {
    const dbHost = hostOf(dbUrl);
    const isPooler = /\.pooler\.supabase\.com$/.test(dbHost);
    info(`DB host: ${dbHost}`);
    info(`DB is a Supavisor pooler: ${isPooler}`);
    if (isPooler) {
      // Shape: aws-0-<region>.pooler.supabase.com -> region is labels[1]
      const labels = dbHost.split(".");
      info(`pooler region: ${labels[1] || "(unknown)"}`);
      info(
        "NOTE: for a pooler URL the project ref lives in the USERNAME " +
          "(postgres.<ref>), not in the hostname. The hostname carries the region."
      );
    }
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
      const { count, error } = await sb
        .from(t)
        .select("*", { count: "exact", head: true });
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
    line("All probed layers are reachable.");
  } else {
    line(`${failures} layer(s) failed. See [FAIL] entries above.`);
  }
  line(
    "\nNo credentials were printed. Hostnames shown are public " +
      "(NEXT_PUBLIC_SUPABASE_URL is exposed to browsers by design)."
  );

  // Never fail the workflow: this is a diagnostic, and its value is the report.
  process.exit(0);
}

main().catch((e) => {
  console.error("Diagnostic crashed:", (e as Error).message);
  process.exit(0);
});
