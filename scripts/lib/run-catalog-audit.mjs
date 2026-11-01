// F-A16 — read-only production catalog audit runner.
//
// Executes docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql against the approved
// production Supabase project and prints a structured, read-only evidence report.
//
// Safety, in order of enforcement:
//   1. The caller (the workflow) has already run scripts/lib/guard-approved-db-url.mjs
//      against the connection string; this script re-checks the ref itself so it
//      cannot be pointed at another project.
//   2. The session is forced read-only: `default_transaction_read_only=on` is sent
//      as a startup parameter, and every statement runs inside an explicit
//      `BEGIN READ ONLY; ... ROLLBACK;` transaction.
//   3. Every statement is checked against a read-only allowlist before it is sent.
//      Anything that is not SELECT/WITH/SHOW aborts the run before it executes.
//   4. A per-statement timeout and a connection timeout bound the run.
//
// This script never prints a credential, a connection string, a project ref value,
// or any application table row content. It prints catalog metadata only.
//
// Usage: node scripts/lib/run-catalog-audit.mjs <sql-file> <out-file>
//
// The catalog rows are written ONLY to <out-file> (the runner temp dir). stdout
// carries the session-safety proof and the aggregate summary, which are
// non-sensitive. This keeps policy text, function definitions and ACLs out of the
// workflow log entirely.

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { Client } from "pg";
import { APPROVED_PROJECT_REF, analyzeDbUrlRef, fingerprint } from "./approved-project.mjs";

const SQL_FILE = process.argv[2];
const OUT_FILE = process.argv[3];
if (!SQL_FILE || !OUT_FILE) {
  console.error("usage: run-catalog-audit.mjs <sql-file> <out-file>");
  process.exit(2);
}

const DB_URL = String(process.env.F_A16_DB_URL ?? "").trim();
if (!DB_URL) {
  console.error("REFUSING: F_A16_DB_URL is not set.");
  process.exit(1);
}

// --- Destination re-check (fail closed) ------------------------------------
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

// --- Parse the audit file into statements ----------------------------------
// Split on semicolons that terminate a statement, drop full-line comments, and
// keep only the executable statements. The file is SELECT/SHOW only by design.
const rawSql = readFileSync(SQL_FILE, "utf8");
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

function classify(sql) {
  const first = sql.split(/\s+/)[0].toUpperCase();
  if (!ALLOWED_FIRST.has(first)) return { ok: false, reason: `first keyword is ${first}` };
  // A mutation keyword anywhere in the statement body is rejected too, except
  // inside a quoted string literal (e.g. the 'EXECUTE' argument to
  // has_function_privilege) and except as an identifier substring (e.g. the
  // column `security_definer`).
  const noStrings = sql.replace(/'(?:[^']|'')*'/g, "''");
  for (const kw of DISALLOWED) {
    const re = new RegExp(`(?<![A-Za-z0-9_])${kw}(?![A-Za-z0-9_])`, "i");
    if (re.test(noStrings)) {
      // `SET`/`ANALYZE` etc. as identifiers is unlikely in this file; be strict.
      return { ok: false, reason: `contains forbidden keyword ${kw}` };
    }
  }
  return { ok: true };
}

const checked = statements.map((sql, i) => ({ i: i + 1, sql, verdict: classify(sql) }));
const blocked = checked.filter((c) => !c.verdict.ok);
if (blocked.length) {
  console.error("REFUSING: the audit file contains statements that are not provably read-only:");
  for (const b of blocked) console.error(`  statement ${b.i}: ${b.verdict.reason}`);
  process.exit(1);
}

// --- Connect (read-only at the session level) ------------------------------
let connectUrl = DB_URL;
try {
  const u = new URL(DB_URL);
  u.searchParams.delete("sslmode"); // else pg forces cert verification against Supavisor
  connectUrl = u.toString();
} catch {}

const client = new Client({
  connectionString: connectUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  statement_timeout: 20000,
  query_timeout: 25000,
  application_name: "f-a16-catalog-audit",
  // Sent as a startup parameter so the session itself defaults to read-only.
  options: "-c default_transaction_read_only=on",
});

const redact = (s) =>
  String(s ?? "").replace(/postgres\.[a-z0-9]+/g, "postgres.<ref>").slice(0, 300);

function emit(title, rows) {
  appendFileSync(OUT_FILE, `\n=== ${title} ===\n`);
  if (!rows.length) {
    appendFileSync(OUT_FILE, "(no rows)\n");
    return;
  }
  for (const r of rows) {
    appendFileSync(OUT_FILE, "  " + JSON.stringify(r) + "\n");
  }
}

async function main() {
  await client.connect();

  // Session safety proof. This must show read-only on, or the run aborts.
  const ro = await client.query("show transaction_read_only");
  const defRo = await client.query("show default_transaction_read_only");
  const sess = await client.query(
    "select current_user as role, current_database() as db, " +
      "inet_server_addr()::text as server_addr, version() as version"
  );
  const txnReadOnly = ro.rows[0]?.transaction_read_only;
  const defReadOnly = defRo.rows[0]?.default_transaction_read_only;
  console.log("### SESSION SAFETY ###");
  console.log(`  transaction_read_only         = ${txnReadOnly}`);
  console.log(`  default_transaction_read_only = ${defReadOnly}`);
  console.log(`  current_user                  = ${sess.rows[0]?.role}`);
  console.log(`  current_database              = ${sess.rows[0]?.db}`);
  console.log(`  server_addr                   = ${sess.rows[0]?.server_addr}`);
  console.log(`  approved_ref_fingerprint      = ${fingerprint(APPROVED_PROJECT_REF)}`);
  if (String(defReadOnly).toLowerCase() !== "on" || String(txnReadOnly).toLowerCase() !== "on") {
    console.error("ABORT: the session is not read-only. No audit query was run.");
    await client.end();
    process.exit(1);
  }

  // Run the whole audit inside one explicit READ ONLY transaction.
  await client.query("BEGIN READ ONLY");

  writeFileSync(
    OUT_FILE,
    `F-A16 read-only production catalog audit\n` +
      `generated_at_utc = ${new Date().toISOString()}\n` +
      `approved_ref_fingerprint = ${fingerprint(APPROVED_PROJECT_REF)}\n` +
      `session_role = ${sess.rows[0]?.role}\n` +
      `transaction_read_only = ${txnReadOnly}\n` +
      `default_transaction_read_only = ${defReadOnly}\n` +
      `server_addr = ${sess.rows[0]?.server_addr}\n` +
      `server_version = ${String(sess.rows[0]?.version ?? "").slice(0, 80)}\n`
  );

  let ok = 0;
  const failed = [];
  for (const { i, sql } of checked) {
    try {
      const res = await client.query(sql);
      emit(`stmt ${i} (${res.rows.length} row(s))`, res.rows);
      ok++;
    } catch (e) {
      failed.push({ i, error: redact(e?.message ?? e) });
      appendFileSync(OUT_FILE, `\n=== stmt ${i} FAILED ===\n  ${redact(e?.message ?? e)}\n`);
    }
  }

  await client.query("ROLLBACK");
  await client.end();

  // stdout only: the aggregate summary. No catalog rows here.
  console.log("### SUMMARY ###");
  console.log(`  statements_total   = ${checked.length}`);
  console.log(`  statements_ok      = ${ok}`);
  console.log(`  statements_failed  = ${failed.length}`);
  for (const f of failed) console.log(`  - stmt ${f.i}: ${f.error}`);

  // A failed statement is a real limitation to report, not a crash: exit 0 so the
  // evidence still uploads, but the summary records exactly what could not be read.
  process.exit(0);
}

main().catch(async (e) => {
  console.error("[audit-error] " + redact(e?.message ?? e));
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
