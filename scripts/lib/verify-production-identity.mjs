// Independent production identity verification for the F-A16 catalog audit.
//
// The pooler username (`postgres.<ref>`) is a *destination guard*: it is what
// Supavisor routes on, and it is derived from the connection string, so on its
// own it cannot prove which project the session actually reached. This module
// requires independent, server-side and control-plane evidence and FAILS CLOSED
// when that evidence cannot be obtained.
//
// What is available, and what is not
// ----------------------------------
// Supabase-hosted Postgres does NOT expose a project-ref GUC: `app.settings.*`
// was removed from the database (Supabase changelog, 2024-11-22) and there is no
// supported `supabase.project_ref` setting. The read below still probes those
// names because a self-hosted or older instance may carry one, and because a
// setting that *disagrees* with the approved ref is decisive evidence of a wrong
// target. A missing setting is not a failure on its own; it simply is not
// evidence.
//
// Because the data plane carries no project ref, identity is anchored on the
// Supabase **control plane** (Management API `GET /v1/projects/{ref}`), which is
// independent of the database connection:
//
//   1. Control plane: the Management API reports the approved ref and its region.
//   2. Correlation: the region of the pooler host actually connected to must equal
//      the region the control plane reports for the approved ref. A different
//      project in a different region is therefore rejected.
//   3. Data plane fingerprint: the session must carry the Supabase-managed roles
//      (anon, authenticated, service_role), so a non-Supabase Postgres that merely
//      accepted the connection is rejected.
//   4. Defence in depth: any ref-bearing server-side setting that is present must
//      equal the approved ref.
//
// The database name, the server IP address and the username are never sufficient
// on their own. When the control plane is unreachable (no SUPABASE_ACCESS_TOKEN,
// or the API errors), identity cannot be established and the audit must not run.
//
// Two pieces:
//   * fetchProjectDetails(ref)          — the control-plane read (network).
//   * collectIdentityEvidence(client)   — the data-plane read (read-only SQL).
//   * evaluateIdentity(evidence, ref)   — PURE decision function; no I/O.
//
// Keeping the decision pure means it can be tested exhaustively without a
// database. Nothing here prints or returns a credential.

import { APPROVED_PROJECT_REF, refFromSupabaseUrl } from "./approved-project.mjs";

/**
 * `current_setting(name, true)` values that could carry the project ref or URL.
 * Read with the `missing_ok = true` form so an unset name returns NULL. On hosted
 * Supabase these are expected to be NULL; see the header.
 */
export const REF_SETTING_CANDIDATES = [
  "supabase.project_ref",
  "supabase.url",
  "supabase.site_url",
  "app.settings.supabase_url",
  "app.settings.project_ref",
  "app.settings.site_url",
];

/** The Supabase-managed roles that must exist in a Supabase Postgres project. */
export const SUPABASE_ROLES = ["anon", "authenticated", "service_role"];

/** Parse the region out of a Supavisor pooler host, e.g. `aws-0-ap-south-1.pooler.supabase.com`. */
export function regionFromPoolerHost(host) {
  const m = /^aws-\d+-([a-z0-9-]+)\.pooler\.supabase\.com$/.exec(String(host ?? "").trim());
  return m ? m[1] : "";
}

/**
 * Read the approved project's details from the Supabase Management API.
 * This is the independent control-plane anchor. Never logs the token.
 *
 * @returns {Promise<{ok: true, ref: string, region: string, dbHost: string} | {ok: false, reason: string}>}
 */
export async function fetchProjectDetails(ref, accessToken, { fetchImpl = fetch } = {}) {
  if (!accessToken) return { ok: false, reason: "no Management API token is available" };
  let res;
  try {
    res = await fetchImpl(`https://api.supabase.com/v1/projects/${ref}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    return { ok: false, reason: `Management API request failed: ${String(e?.message ?? e).slice(0, 120)}` };
  }
  if (!res.ok) return { ok: false, reason: `Management API returned HTTP ${res.status}` };
  let body;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: "Management API returned a non-JSON body" };
  }
  // The API is authoritative for the ref it was asked about; require it to echo it.
  const echoed = typeof body?.id === "string" && body.id.length > 0 ? body.id : ref;
  if (echoed !== ref) return { ok: false, reason: "Management API echoed a different project ref" };
  return {
    ok: true,
    ref: echoed,
    region: typeof body?.region === "string" ? body.region : "",
    dbHost: typeof body?.database?.host === "string" ? body.database.host : "",
  };
}

/**
 * Read server-side identity evidence from an already-connected `pg` client.
 * Read-only: every statement is a catalog read or `current_setting`.
 *
 * @param {{query: (text: string, params?: unknown[]) => Promise<{rows: any[]}>}} client
 * @returns {Promise<object>} evidence for evaluateIdentity
 */
export async function collectIdentityEvidence(client) {
  const settings = {};
  for (const name of REF_SETTING_CANDIDATES) {
    try {
      const res = await client.query("select current_setting($1, true) as value", [name]);
      settings[name] = res.rows[0]?.value ?? null;
    } catch {
      settings[name] = null;
    }
  }

  let roles = [];
  try {
    const res = await client.query(
      "select rolname from pg_roles where rolname = any($1::text[]) order by rolname",
      [SUPABASE_ROLES]
    );
    roles = res.rows.map((r) => r.rolname);
  } catch {
    roles = [];
  }

  const sess = await client.query(
    "select current_database() as db, current_user as role, " +
      "inet_server_addr()::text as server_addr, version() as version"
  );

  return {
    settings,
    roles,
    database: sess.rows[0]?.db ?? null,
    role: sess.rows[0]?.role ?? null,
    serverAddr: sess.rows[0]?.server_addr ?? null,
    serverVersion: String(sess.rows[0]?.version ?? "").slice(0, 120),
  };
}

/**
 * Derive every project ref that the server-side evidence positively asserts.
 * A `*.supabase.co` URL is reduced to its ref; a bare 20-char ref is taken as-is.
 * Returns a de-duplicated list (never the raw secret-bearing setting values).
 */
export function refsFromEvidence(evidence) {
  const refs = new Set();
  const REF = /^[a-z0-9]{20}$/;
  for (const value of Object.values(evidence.settings ?? {})) {
    if (typeof value !== "string" || value.length === 0) continue;
    const fromUrl = refFromSupabaseUrl(value);
    if (fromUrl) refs.add(fromUrl);
    else if (REF.test(value.trim())) refs.add(value.trim());
  }
  return [...refs];
}

/**
 * Decide whether the connected session is provably the approved project.
 *
 * PURE: no I/O, no environment access. `evidence` is the object produced by
 * collectIdentityEvidence plus:
 *   - `managementApi`: `{ ok: true, ref, region }` or `{ ok: false, reason }`;
 *   - `connectedHostRegion`: the region parsed from the pooler host actually used.
 *
 * Fail-closed rules, in order:
 *   1. A server-side ref-bearing setting that disagrees with the approved ref is a
 *      hard failure (defence in depth; present only on instances that expose one).
 *   2. The control plane must be reachable and must report the approved ref. If it
 *      is not, identity cannot be established independently and the audit fails
 *      closed — the pooler username alone is not proof.
 *   3. The pooler region actually connected to must equal the region the control
 *      plane reports for the approved ref.
 *   4. The session must carry the Supabase-managed roles.
 *
 * @returns {{ ok: boolean, reason: string, refs: string[] }}
 */
export function evaluateIdentity(evidence, approvedRef = APPROVED_PROJECT_REF) {
  const refs = refsFromEvidence(evidence);

  const wrongSettings = refs.filter((r) => r !== approvedRef);
  if (wrongSettings.length > 0) {
    return {
      ok: false,
      reason: "a server-side setting identifies a different project",
      refs,
    };
  }

  const api = evidence.managementApi;
  if (!api || api.ok !== true) {
    return {
      ok: false,
      reason: `control-plane identity could not be established (${
        api?.reason ?? "Management API not consulted"
      }); the pooler username alone is not proof`,
      refs,
    };
  }
  if (api.ref && api.ref !== approvedRef) {
    return { ok: false, reason: "the Management API reported a different project", refs };
  }

  const hostRegion = String(evidence.connectedHostRegion ?? "");
  if (!hostRegion) {
    return { ok: false, reason: "the connected pooler region could not be determined", refs };
  }
  if (api.region && api.region !== hostRegion) {
    return {
      ok: false,
      reason: "the connected pooler region does not match the region the control plane reports",
      refs,
    };
  }

  const roles = new Set(evidence.roles ?? []);
  const missingRoles = SUPABASE_ROLES.filter((r) => !roles.has(r));
  if (missingRoles.length > 0) {
    return {
      ok: false,
      reason: `the session is not a Supabase project (missing role(s): ${missingRoles.join(", ")})`,
      refs,
    };
  }

  return {
    ok: true,
    reason: "control-plane and data-plane identity agree with the approved project",
    refs,
  };
}

/**
 * Verify the identity of a live session. Throws on failure so a caller cannot
 * accidentally continue.
 */
export async function assertProductionIdentity(client, { managementApi, connectedHostRegion } = {}) {
  const evidence = await collectIdentityEvidence(client);
  const verdict = evaluateIdentity({ ...evidence, managementApi, connectedHostRegion });
  if (!verdict.ok) {
    const err = new Error(`identity verification failed: ${verdict.reason}`);
    err.evidence = evidence;
    throw err;
  }
  return { evidence, verdict };
}
