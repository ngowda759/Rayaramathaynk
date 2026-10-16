import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveTargetConnection, redact } from "./lib/target-connection.mjs";

// Guarded `prisma migrate resolve --applied` for the Raya AI baseline.
//
// Why this exists: the Prisma baseline (20261015000000_baseline_raya_ai) models the
// nine AI/user tables. It is *marked applied* rather than executed (production already
// has those objects; Prisma cannot own the triggers/RLS — see the baseline doc). Marking
// it applied requires writing one row to supabase_migrations.schema_migrations.
//
// This command must never be used to suppress unresolved drift, so it refuses to run
// unless the READ-ONLY scoped drift gate passes first. The gate (the same checker the
// CI gate uses) compares the declared schema against the live database; if any in-scope
// table is missing, added, or changed, this script aborts and writes nothing.
//
// Guard rails, mirroring the ai_knowledge apply:
//   - requires an exact confirmation phrase in the environment (defence in depth; the
//     workflow checks it too);
//   - requires SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD;
//   - reads no table data and writes exactly one history row (INSERT ... ON CONFLICT
//     DO NOTHING); it never runs a migration and never runs `db push`;
//   - idempotent: if the version is already recorded it is a no-op;
//   - fails closed; never prints a credential; redacts the project ref in errors.

const BASELINE_VERSION = "20261015000000";
const BASELINE_NAME = "baseline_raya_ai";
const CONFIRM_PHRASE = "resolve-baseline-raya-ai";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "";
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || "";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || "";
const OVERRIDE = process.env.PGURL_OVERRIDE || "";
const CONFIRM = process.env.RESOLVE_CONFIRM || "";

const log = (...a) => console.log(...a);
const die = (msg) => { console.error(redact(msg)); process.exit(1); };

/** In-scope (declared) table names, from the schema's @@map() declarations. */
function inScopeTables() {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  return [...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((m) => m[1]);
}

/** URL for the prisma sub-process: Supavisor needs SSL. */
function prismaUrl(url) {
  if (url.includes("sslmode=")) return url;
  return url + (url.includes("?") ? "&" : "?") + "sslmode=require";
}

/** Run the read-only scoped drift gate. Returns its exit code. */
function scopedGate(url) {
  const r = spawnSync("node", ["scripts/lib/check-baseline-drift-scope.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PRISMA_DATABASE_URL: prismaUrl(url) },
    encoding: "utf8",
    stdio: "inherit",
  });
  return r.status ?? 1;
}

async function snapshot(c) {
  const histExists = (await c.query(
    `select 1 from information_schema.tables
     where table_schema='supabase_migrations' and table_name='schema_migrations'`,
  )).rowCount > 0;
  const existing = histExists
    ? (await c.query(
        `select version, name from supabase_migrations.schema_migrations where version=$1`,
        [BASELINE_VERSION],
      )).rows
    : [];
  const scope = inScopeTables();
  const present = scope.length
    ? (await c.query(
        `select tablename from pg_tables where schemaname='public' and tablename = any($1)`,
        [scope],
      )).rows.map((r) => r.tablename)
    : [];
  const missing = scope.filter((t) => !present.includes(t));
  const historyCount = histExists
    ? (await c.query(`select count(*)::int as n from supabase_migrations.schema_migrations`)).rows[0].n
    : 0;
  return { histExists, existing, scope, present, missing, historyCount };
}

try {
  if (CONFIRM !== CONFIRM_PHRASE) {
    die(`Refusing to run: RESOLVE_CONFIRM did not equal the required phrase.`);
  }

  let client, url;
  try {
    ({ client, url } = await resolveTargetConnection({
      projectRef: PROJECT_REF,
      dbPassword: DB_PASSWORD,
      accessToken: ACCESS_TOKEN,
      override: OVERRIDE,
      log,
    }));
  } catch (e) {
    die(redact(e?.message ?? e));
  }
  const c = client;

  const before = await snapshot(c);
  log("");
  log("=== catalog preconditions ===");
  log(`  migration history table: ${before.histExists}`);
  log(`  in-scope tables present: ${before.present.length}/${before.scope.length}`);
  if (before.missing.length) log(`  MISSING in-scope tables: ${before.missing.join(", ")}`);
  log(`  history rows: ${before.historyCount}`);
  log(`  baseline ${BASELINE_VERSION} already recorded: ${before.existing.length > 0}`);

  if (!before.histExists) {
    die("ABORT: supabase_migrations.schema_migrations is missing; cannot record a baseline.");
  }
  if (before.missing.length) {
    die(`ABORT: declared tables are missing (${before.missing.join(", ")}); resolving would suppress unresolved drift.`);
  }
  if (before.existing.length) {
    await c.end();
    log("");
    log(`NO-OP: ${BASELINE_VERSION}_${BASELINE_NAME} is already recorded as applied.`);
    process.exit(0);
  }

  log("");
  log("=== read-only scoped drift gate (must pass before we write anything) ===");
  const code = scopedGate(url);
  log(`scoped gate exit code: ${code}`);
  if (code !== 0) {
    await c.end();
    die("ABORT: the scoped drift gate did not pass. Refusing to resolve; this command must not suppress unresolved drift.");
  }

  log("");
  log(`=== marking ${BASELINE_VERSION}_${BASELINE_NAME} as applied ===`);
  try {
    await c.query("begin");
    await c.query(
      `insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)
       on conflict (version) do nothing`,
      [BASELINE_VERSION, BASELINE_NAME],
    );
    await c.query("commit");
  } catch (e) {
    try { await c.query("rollback"); } catch {}
    die(`[RESOLVE_FAILED] rolled back: ${redact(e?.message ?? e)}`);
  }

  const after = await snapshot(c);
  log("");
  log("=== verification ===");
  log(`  baseline ${BASELINE_VERSION} recorded: ${after.existing.length > 0}`);
  log(`  history rows: ${before.historyCount} -> ${after.historyCount}`);
  if (after.existing.length === 0) die("RESOLVE reported success but the version is not recorded.");

  await c.end();
  log("");
  log("DONE: the baseline is marked applied. The scoped drift gate remains the source of truth.");
  process.exit(0);
} catch (e) {
  die(`[UNEXPECTED] ${redact(e?.message ?? e)}`);
}
