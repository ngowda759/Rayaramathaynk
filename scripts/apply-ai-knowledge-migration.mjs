import { readFileSync } from "node:fs";
import { Client } from "pg";

// Guarded, single-migration apply for ai_knowledge. This is the ONE write path in
// the Raya AI Supabase work, and it is deliberately narrow:
//   - it applies exactly one reviewed file (never a blanket `supabase db push`);
//   - it aborts unless the preconditions hold (table absent, settings present,
//     trigger function present);
//   - it runs in a transaction and rolls back on any error;
//   - it records the change in supabase_migrations.schema_migrations so a later
//     `db push` does not try to apply it again;
//   - it never prints a credential and redacts the project ref in errors.
// It does NOT read or modify ai_settings data.

const MIGRATION_FILE = "supabase/migrations/20261013000000_create_ai_knowledge.sql";
const MIGRATION_VERSION = "20261013000000";
const MIGRATION_NAME = "create_ai_knowledge";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "";
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || "";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || "";
const OVERRIDE = process.env.PGURL_OVERRIDE || "";

const REGIONS = [
  "ap-south-1", "ap-northeast-1", "ap-northeast-2", "ap-southeast-1", "ap-southeast-2",
  "us-east-1", "us-east-2", "us-west-1", "us-west-2", "eu-west-1", "eu-west-2",
  "eu-central-1", "ca-central-1", "sa-east-1", "ap-east-1",
];

const redact = (s) => String(s ?? "").replace(/postgres\.[a-z0-9]+/g, "postgres.<ref>");
const log = (...a) => console.log(...a);
const die = (msg) => { console.error(redact(msg)); process.exit(1); };

function clientFor(url) {
  let clean = url;
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode"); // else pg forces cert verification before auth
    clean = u.toString();
  } catch {}
  return new Client({ connectionString: clean, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
}

async function tryConnect(url) {
  const c = clientFor(url);
  try { await c.connect(); await c.query("select 1"); return c; }
  catch (e) { try { await c.end(); } catch {} return { err: redact(String(e?.message ?? e)) }; }
}

async function resolveConnection() {
  if (OVERRIDE) {
    const c = await tryConnect(OVERRIDE);
    if (c.err) die(`[OVERRIDE] ${c.err}`);
    log("Connected via operator-supplied PGURL_OVERRIDE.");
    return c;
  }
  if (!PROJECT_REF) die("SUPABASE_PROJECT_REF is not set.");
  if (!DB_PASSWORD) die("SUPABASE_DB_PASSWORD is not set.");

  let hosts = [];
  if (ACCESS_TOKEN) {
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}`, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
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

  const pw = encodeURIComponent(DB_PASSWORD);
  for (const h of hosts) {
    const url = `postgresql://postgres.${PROJECT_REF}:${pw}@${h}:5432/postgres`;
    const c = await tryConnect(url);
    if (!c.err) { log(`Connected via ${h}:5432 (session pooler).`); return c; }
  }
  die("Could not reach the target through any known pooler host.");
}

async function snapshot(c) {
  const one = async (sql, params) => (await c.query(sql, params)).rows[0];
  const tableExists = (await c.query(
    `select 1 from pg_tables where schemaname='public' and tablename=$1`, ["ai_knowledge"],
  )).rowCount > 0;
  const fnExists = (await c.query(
    `select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where p.proname='update_updated_at_column'`, [],
  )).rowCount > 0;
  const histExists = (await c.query(
    `select 1 from information_schema.tables
     where table_schema='supabase_migrations' and table_name='schema_migrations'`, [],
  )).rowCount > 0;
  const settings = await one(`select count(*)::int as n from ai_settings`);
  const counts = {};
  for (const t of ["ai_settings", "chat_sessions", "chat_messages", "unknown_questions",
                   "ai_intent_distribution", "ai_latency_records", "users", "profiles"]) {
    const r = await one(`select count(*)::int as n from ${t}`);
    counts[t] = r.n;
  }
  return { tableExists, fnExists, histExists, settingsCount: settings.n, counts };
}

try {
  const c = await resolveConnection();
  const before = await snapshot(c);

  log("");
  log("=== preconditions ===");
  log(`  ai_knowledge present: ${before.tableExists}`);
  log(`  update_updated_at_column(): ${before.fnExists}`);
  log(`  ai_settings rows: ${before.settingsCount}`);
  log(`  migration history table: ${before.histExists}`);

  if (before.tableExists) {
    log("");
    log("ABORT: ai_knowledge already exists; nothing to apply (idempotent no-op).");
    await c.end();
    process.exit(0);
  }
  if (!before.fnExists) die("ABORT: update_updated_at_column() is missing; applying would fail.");
  if (before.settingsCount === 0) die("ABORT: ai_settings is empty; refusing to run a schema change on an unexpected target.");

  const sql = readFileSync(MIGRATION_FILE, "utf8");
  log("");
  log(`=== applying ${MIGRATION_VERSION}_${MIGRATION_NAME} (one file, one transaction) ===`);
  try {
    await c.query("begin");
    await c.query(sql);
    if (before.histExists) {
      await c.query(
        `insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)
         on conflict (version) do nothing`,
        [MIGRATION_VERSION, MIGRATION_NAME],
      );
    }
    await c.query("commit");
  } catch (e) {
    try { await c.query("rollback"); } catch {}
    die(`[APPLY_FAILED] rolled back: ${redact(e?.message ?? e)}`);
  }

  const after = await snapshot(c);
  const cols = await c.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='ai_knowledge' order by ordinal_position`,
  );
  const idx = await c.query(
    `select indexname from pg_indexes where schemaname='public' and tablename='ai_knowledge' order by indexname`,
  );
  const trg = await c.query(
    `select tgname from pg_trigger tg join pg_class t on t.oid=tg.tgrelid
     where t.relname='ai_knowledge' and not tg.tgisinternal`,
  );

  log("");
  log("=== verification ===");
  log(`  ai_knowledge present: ${after.tableExists}`);
  log(`  columns (${cols.rowCount}): ${cols.rows.map((r) => r.column_name).join(", ")}`);
  log(`  indexes: ${idx.rows.map((r) => r.indexname).join(", ")}`);
  log(`  triggers: ${trg.rows.map((r) => r.tgname).join(", ") || "(none)"}`);
  log(`  history recorded: ${before.histExists}`);
  log("");
  log("=== ai_settings data unchanged ===");
  log(`  ai_settings rows before/after: ${before.settingsCount}/${after.settingsCount}`);
  log(`  table row counts unchanged: ${
    Object.keys(before.counts).every((k) => before.counts[k] === after.counts[k])}`);

  if (!after.tableExists) die("APPLY reported success but ai_knowledge is still absent.");

  await c.end();
  log("");
  log("DONE: ai_knowledge created. Re-run the read-only drift gate to confirm the AI scope.");
  process.exit(0);
} catch (e) {
  die(`[UNEXPECTED] ${redact(e?.message ?? e)}`);
}
