import { Client } from "pg";

// Shared target-connection resolution for the Raya AI Supabase tooling.
//
// The target project's direct host is IPv6-only and GitHub-hosted runners have no
// IPv6 egress, so we reach it through Supavisor's session pooler (port 5432, IPv4).
// The pooler host is resolved from the project region, which we prefer to read from
// the Management API and otherwise discover by scanning the known region hosts.
//
// Never logs or returns a credential value; redacts the project ref from any error.

export const REGIONS = [
  "ap-south-1", "ap-northeast-1", "ap-northeast-2", "ap-southeast-1", "ap-southeast-2",
  "us-east-1", "us-east-2", "us-west-1", "us-west-2", "eu-west-1", "eu-west-2",
  "eu-central-1", "ca-central-1", "sa-east-1", "ap-east-1",
];

/** Redact the project ref (which appears in the pooler username) from any text. */
export const redact = (s) => String(s ?? "").replace(/postgres\.[a-z0-9]+/g, "postgres.<ref>");

function clientFor(url) {
  let clean = url;
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode"); // else pg forces cert verification before auth
    clean = u.toString();
  } catch {}
  return new Client({
    connectionString: clean,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
}

async function tryConnect(url) {
  const c = clientFor(url);
  try {
    await c.connect();
    await c.query("select 1");
    return c;
  } catch (e) {
    try { await c.end(); } catch {}
    return { err: redact(String(e?.message ?? e)) };
  }
}

/**
 * Resolve a connection to the target database.
 * @returns {Promise<{client: import("pg").Client, url: string}>} a connected client
 *   and the URL it used. The URL is returned so callers can run sub-processes that
 *   need it; it must never be logged or written to workflow outputs.
 * @throws {Error} with a redacted message when no host is reachable.
 */
export async function resolveTargetConnection({ projectRef, dbPassword, accessToken, override, log = () => {} }) {
  if (override) {
    const c = await tryConnect(override);
    if (c.err) throw new Error(`[OVERRIDE] ${c.err}`);
    log("Connected via operator-supplied override URL.");
    return { client: c, url: override };
  }
  if (!projectRef) throw new Error("SUPABASE_PROJECT_REF is not set.");
  if (!dbPassword) throw new Error("SUPABASE_DB_PASSWORD is not set.");

  let hosts = [];
  if (accessToken) {
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const j = await res.json();
        if (j.region) {
          hosts = [`aws-0-${j.region}.pooler.supabase.com`, `aws-1-${j.region}.pooler.supabase.com`];
          log(`Region from Management API: ${j.region}`);
        }
      } else {
        log(`Management API HTTP ${res.status}; falling back to a region scan.`);
      }
    } catch (e) {
      log(`Management API unreachable (${redact(e?.message ?? e)}); falling back to a region scan.`);
    }
  } else {
    log("No SUPABASE_ACCESS_TOKEN; using a region scan.");
  }
  if (!hosts.length) {
    for (const r of REGIONS) hosts.push(`aws-0-${r}.pooler.supabase.com`, `aws-1-${r}.pooler.supabase.com`);
  }

  const pw = encodeURIComponent(dbPassword);
  for (const h of hosts) {
    const url = `postgresql://postgres.${projectRef}:${pw}@${h}:5432/postgres`;
    const c = await tryConnect(url);
    if (!c.err) {
      log(`Connected via ${h}:5432 (session pooler).`);
      return { client: c, url };
    }
  }
  throw new Error("Could not reach the target through any known pooler host.");
}
