// F-A16 — read-only production catalog audit runner.
//
// Executes docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql against the approved
// production Supabase project and writes a structured, read-only evidence report.
//
// Safety, in order of enforcement:
//   1. The connection string's project ref must be the approved ref (destination
//      guard). This is necessary but not sufficient — see (2).
//   2. Identity is independently verified before any audit statement: the Supabase
//      Management API (control plane) must report the approved ref, the region of
//      the pooler host actually connected to must match, and the session must carry
//      the Supabase-managed roles. If identity cannot be established, the run
//      aborts before any catalog query.
//   3. The session is forced read-only two ways and then proven:
//      (a) `SET default_transaction_read_only = on` is sent as ordinary SQL right
//          after connect. This is the pooler-reliable mechanism: Supavisor (the
//          Supabase pooler) does NOT forward the startup `options` packet, so the
//          `-c default_transaction_read_only=on` client option never reaches the
//          server through the session pooler and the session comes up writable.
//          Ordinary SQL *is* forwarded, so the SET takes effect.
//      (b) every statement runs inside an explicit `BEGIN READ ONLY; ... ROLLBACK;`
//          transaction, which the backend enforces per transaction and which
//          cannot leak across a pooled connection.
//      The read-only state is then read back; the run aborts unless BOTH
//      `transaction_read_only` and `default_transaction_read_only` read `on`, so a
//      dropped SET fails closed rather than silently running writable.
//   4. Every statement is checked against a read-only allowlist before it is sent.
//      Anything that is not SELECT/WITH/SHOW aborts the run before it executes.
//   5. A per-statement timeout and a connection timeout bound the run.
//
// Exit codes:
//   0  every statement ran and every safety check passed
//   1  a safety check failed (destination, identity, read-only, allowlist)
//   3  the audit is INCOMPLETE: one or more catalog statements failed
//
// The catalog rows are written ONLY to <out-file>. stdout carries the session
// safety proof and the aggregate summary — never catalog rows, function
// definitions, policy text, ACLs or credentials. On an incomplete audit the
// partial rows are preserved in <out-file> and marked as incomplete.
//
// Usage: node scripts/lib/run-catalog-audit.mjs <sql-file> <out-file>

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { Client } from "pg";
import { APPROVED_PROJECT_REF, analyzeDbUrlRef, fingerprint } from "./approved-project.mjs";
import { assertProductionIdentity, fetchProjectDetails } from "./verify-production-identity.mjs";

const SQL_FILE = process.argv[2];
const OUT_FILE = process.argv[3];
const IS_CLI = Boolean(process.argv[1] && process.argv[1].endsWith("run-catalog-audit.mjs"));
if (IS_CLI && (!SQL_FILE || !OUT_FILE)) {
  console.error("usage: run-catalog-audit.mjs <sql-file> <out-file>");
  process.exit(2);
}

const DB_URL = String(process.env.F_A16_DB_URL ?? "").trim();
const HOST_REGION = String(process.env.F_A16_HOST_REGION ?? "").trim();
const ACCESS_TOKEN = String(process.env.SUPABASE_ACCESS_TOKEN ?? "").trim();

/** Pull the user and password out of the connection string, for literal redaction. */
function credentialsFromUrl(url) {
  try {
    const u = new URL(url);
    return {
      user: decodeURIComponent(u.username || ""),
      pass: decodeURIComponent(u.password || ""),
    };
  } catch {
    return { user: "", pass: "" };
  }
}

const { user: DB_USER, pass: DB_PASS } = credentialsFromUrl(DB_URL);

/**
 * Redact anything that could carry a credential or a project identifier from text
 * that may reach the log. Errors can echo the password in several shapes — inside
 * a URL, after `password=`, or bare — so all are handled, plus the literal secret
 * values parsed from the connection string as a backstop.
 */
export function redact(s) {
  let out = String(s ?? "");
  if (DB_PASS && DB_PASS.length >= 4) out = out.split(DB_PASS).join("***");
  if (DB_USER && DB_USER.length >= 4) out = out.split(DB_USER).join("postgres.<ref>");
  out = out.replace(/(postgres(?:ql)?:\/\/[^:@/\s]+:)[^@/\s]+(@)/gi, "$1***$2");
  out = out.replace(/password\s*=\s*\S+/gi, "password=***");
  out = out.replace(/postgres\.[a-z0-9]+/g, "postgres.<ref>");
  return out.slice(0, 300);
}

// --- Destination re-check (necessary, not sufficient) ----------------------
// Runs only when invoked as a CLI; importers use the exported helpers directly.
if (IS_CLI) {
  if (!DB_URL) {
    console.error("REFUSING: F_A16_DB_URL is not set.");
    process.exit(1);
  }
  const { ref, ambiguous, malformed } = analyzeDbUrlRef(DB_URL);
  if (malformed || ambiguous || !ref) {
    console.error(
      `REFUSING: the connection string does not resolve to exactly one project ` +
        `(fingerprint ${fingerprint(DB_URL)}). Nothing was read.`
    );
    process.exit(1);
  }
  if (ref !== APPROVED_PROJECT_REF) {
    console.error(
      `REFUSING: target is not the approved production project ` +
        `(expected ${fingerprint(APPROVED_PROJECT_REF)}, got ${fingerprint(ref)}). Nothing was read.`
    );
    process.exit(1);
  }
}

// --- Parse the audit file into statements ----------------------------------
const rawSql = IS_CLI && SQL_FILE ? readFileSync(SQL_FILE, "utf8") : "";
const withoutLineComments = rawSql
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");
const statements = withoutLineComments
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const ALLOWED_FIRST = new Set(["SELECT", "WITH", "SHOW"]);
const DISALLOWED = [
  "INSERT", "UPDATE", "DELETE", "UPSERT", "TRUNCATE", "CREATE", "ALTER", "DROP",
  "GRANT", "REVOKE", "COMMENT", "CALL", "DO", "COPY", "VACUUM", "ANALYZE",
  "REINDEX", "CLUSTER", "MERGE", "LOCK", "SET", "RESET", "EXECUTE", "PERFORM",
];

export function classify(sql) {
  const first = sql.split(/\s+/)[0].toUpperCase();
  if (!ALLOWED_FIRST.has(first)) return { ok: false, reason: `first keyword is ${first}` };
  const noStrings = sql.replace(/'(?:[^']|'')*'/g, "''");
  for (const kw of DISALLOWED) {
    const re = new RegExp(`(?<![A-Za-z0-9_])${kw}(?![A-Za-z0-9_])`, "i");
    if (re.test(noStrings)) return { ok: false, reason: `contains forbidden keyword ${kw}` };
  }
  return { ok: true };
}

/** The process exit code for an audit result. A partial audit is a failure. */
export function exitCodeFor(incomplete) {
  return incomplete ? 3 : 0;
}

/**
 * Prove the session rejects writes. `query` is injected so the check can be
 * exercised without a database. Throws when the session is not read-only.
 */
export async function assertReadOnlySession(query) {
  const ro = await query("show transaction_read_only");
  const defRo = await query("show default_transaction_read_only");
  const txnReadOnly = ro.rows[0]?.transaction_read_only;
  const defReadOnly = defRo.rows[0]?.default_transaction_read_only;
  if (String(defReadOnly).toLowerCase() !== "on" || String(txnReadOnly).toLowerCase() !== "on") {
    throw new Error(
      `session is not read-only (transaction_read_only=${txnReadOnly}, default_transaction_read_only=${defReadOnly})`
    );
  }
  return { txnReadOnly, defReadOnly };
}

/**
 * Force the session read-only through ordinary SQL, then prove it.
 *
 * The Supabase pooler (Supavisor) drops the startup `options` packet, so the
 * `-c default_transaction_read_only=on` client option cannot be relied on: the
 * session arrives writable. An ordinary `SET` IS forwarded, so we send it here and
 * then verify the result with `assertReadOnlySession`. A session that is still
 * writable — the SET silently dropped, or a server that refuses it — throws before
 * any catalog statement is sent, so the audit fails closed instead of running
 * writable.
 *
 * `query` is injected so the sequence can be tested without a database.
 */
export async function enforceReadOnly(query) {
  await query("SET default_transaction_read_only = on");
  return assertReadOnlySession(query);
}

/**
 * Run every audited statement, recording failures without aborting the loop.
 * `query` is injected (a real `pg` client in production; a fake in tests), so the
 * loop, the redaction and the completeness decision are the real code paths.
 *
 * Returns `{ ok, failed, incomplete }`. Every failure is recorded (with its error
 * redacted) and preserved in `outFile`.
 */
export async function runAuditStatements({ checked, query, outFile, emitRow }) {
  let ok = 0;
  const failed = [];
  for (const { i, sql } of checked) {
    try {
      const res = await query(sql);
      emitRow(`stmt ${i} (${res.rows.length} row(s))`, res.rows);
      ok++;
    } catch (e) {
      const error = redact(e?.message ?? e);
      failed.push({ i, error });
      appendFileSync(outFile, `\n=== stmt ${i} FAILED ===\n  ${error}\n`);
    }
  }
  return { ok, failed, incomplete: failed.length > 0 };
}


const checked = statements.map((sql, i) => ({ i: i + 1, sql, verdict: classify(sql) }));
if (IS_CLI) {
  const blocked = checked.filter((c) => !c.verdict.ok);
  if (blocked.length) {
    console.error("REFUSING: the audit file contains statements that are not provably read-only:");
    for (const b of blocked) console.error(`  statement ${b.i}: ${b.verdict.reason}`);
    process.exit(1);
  }
}

// --- Connect (read-only at the session level) ------------------------------
let connectUrl = DB_URL;
try {
  const u = new URL(DB_URL);
  u.searchParams.delete("sslmode"); // else pg forces cert verification against Supavisor
  connectUrl = u.toString();
} catch {}

// The real client is built only for the CLI; tests inject their own.
const client = IS_CLI
  ? new Client({
      connectionString: connectUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      statement_timeout: 20000,
      query_timeout: 25000,
      application_name: "f-a16-catalog-audit",
      // `options` is kept as belt-and-braces: it works on a direct connection but
      // is NOT forwarded by the Supabase session pooler, so it is not relied on.
      // The effective enforcement is the explicit `SET` in `enforceReadOnly`.
      options: "-c default_transaction_read_only=on",
    })
  : null;

// Injected in tests; the real client in production.
function makeEmit(outFile) {
  return (title, rows) => {
    appendFileSync(outFile, `\n=== ${title} ===\n`);
    if (!rows.length) {
      appendFileSync(outFile, "(no rows)\n");
      return;
    }
    for (const r of rows) appendFileSync(outFile, "  " + JSON.stringify(r) + "\n");
  };
}

/**
 * The audit body, with every external dependency injected so it can be tested
 * end to end without a database. `client` is a `pg` client in production.
 * Returns the summary object; the caller decides the process exit code.
 */
export async function runAudit({ client, outFile, checked, managementApi, hostRegion }) {
  await client.connect();

  const { txnReadOnly, defReadOnly } = await enforceReadOnly((t) => client.query(t));

  console.log("### SESSION SAFETY ###");
  console.log(`  transaction_read_only         = ${txnReadOnly}`);
  console.log(`  default_transaction_read_only = ${defReadOnly}`);
  console.log(`  approved_ref_fingerprint      = ${fingerprint(APPROVED_PROJECT_REF)}`);

  // Independent identity verification, before any catalog query.
  const identity = await assertProductionIdentity(client, {
    managementApi,
    connectedHostRegion: hostRegion,
  });
  console.log("### IDENTITY ###");
  console.log(`  identity              = ${identity.verdict.reason}`);
  console.log(`  connected_host_region = ${hostRegion || "(unknown)"}`);

  await client.query("BEGIN READ ONLY");

  writeFileSync(
    outFile,
    `F-A16 read-only production catalog audit\n` +
      `generated_at_utc = ${new Date().toISOString()}\n` +
      `approved_ref_fingerprint = ${fingerprint(APPROVED_PROJECT_REF)}\n` +
      `identity = ${identity.verdict.reason}\n` +
      `session_role = ${identity.evidence.role}\n` +
      `transaction_read_only = ${txnReadOnly}\n` +
      `default_transaction_read_only = ${defReadOnly}\n` +
      `connected_host_region = ${hostRegion || "(unknown)"}\n` +
      `server_version = ${identity.evidence.serverVersion}\n`
  );

  const { ok, failed, incomplete } = await runAuditStatements({
    checked,
    query: (sql) => client.query(sql),
    outFile,
    emitRow: makeEmit(outFile),
  });

  await client.query("ROLLBACK");
  await client.end();

  if (incomplete) {
    appendFileSync(
      outFile,
      `\n### AUDIT INCOMPLETE ###\n` +
        `statements_total = ${checked.length}\n` +
        `statements_ok = ${ok}\n` +
        `statements_failed = ${failed.length}\n` +
        `This run did not read every catalog category; treat the results as partial.\n`
    );
  }

  // stdout only: the aggregate summary. No catalog rows here.
  console.log("### SUMMARY ###");
  console.log(`  statements_total   = ${checked.length}`);
  console.log(`  statements_ok      = ${ok}`);
  console.log(`  statements_failed  = ${failed.length}`);
  console.log(`  audit_complete     = ${!incomplete}`);
  for (const f of failed) console.log(`  - stmt ${f.i}: ${f.error}`);

  return { ok, failed, incomplete, exitCode: exitCodeFor(incomplete) };
}

async function main() {
  const managementApi = await fetchProjectDetails(APPROVED_PROJECT_REF, ACCESS_TOKEN);
  let result;
  try {
    result = await runAudit({
      client,
      outFile: OUT_FILE,
      checked,
      managementApi,
      hostRegion: HOST_REGION,
    });
  } catch (e) {
    // A safety-check failure (identity, read-only) aborts before evidence exists.
    console.error(`ABORT: ${redact(e?.message ?? e)}`);
    try {
      await client.end();
    } catch {}
    process.exit(1);
  }
  // An incomplete audit is a failure: exit non-zero so the workflow surfaces it,
  // while the partial rows remain in OUT_FILE and are uploaded encrypted.
  process.exit(result.exitCode);
}

if (IS_CLI) {
  main().catch(async (e) => {
    console.error("[audit-error] " + redact(e?.message ?? e));
    try {
      await client.end();
    } catch {}
    process.exit(1);
  });
}
