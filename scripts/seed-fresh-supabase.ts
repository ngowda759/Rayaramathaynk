/**
 * Fresh Supabase-native initialization.
 *
 * Creates the starter dataset for every in-scope application module directly in
 * Supabase PostgreSQL. It does NOT read Firebase, a Firestore export, or any legacy
 * migration artifact, and it requires no Firebase credentials or network access.
 *
 * Local / test initialization (safe, the default):
 *   npx tsx scripts/seed-fresh-supabase.ts --local
 *   # against a throwaway Postgres reached by DATABASE_URL (e.g. a local Supabase
 *   # stack or the PGlite-backed test harness). Writes only to that database.
 *
 * Target a Supabase project explicitly (test project only):
 *   npx tsx scripts/seed-fresh-supabase.ts --project-ref <ref> --yes-this-is-a-test-project
 *   # reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
 *   # environment or .env.local / .env, exactly like create-first-super-admin.ts.
 *
 * Production initialization is deliberately NOT supported by this command. A future
 * production run is a separately reviewed change with its own approval; see
 * docs/FRESH_SUPABASE_INITIALIZATION.md.
 *
 * Flags:
 *   --local                     initialize DATABASE_URL (local/test). Mutually exclusive
 *                               with --project-ref.
 *   --project-ref <ref>         the <ref>.supabase.co project to write to.
 *   --yes-this-is-a-test-project  required with --project-ref; refuses production refs.
 *   --dry-run                   print the plan and write nothing.
 *
 * Guards (each refuses with a plain message and exit code 1): NODE_ENV=production,
 * VERCEL or CI refuse the run; the approved production project is always refused
 * (matched through the shared `scripts/lib/approved-project.mjs` constant, so it cannot
 * drift); a project-ref run must be confirmed; --local requires DATABASE_URL and refuses
 * a DATABASE_URL that resolves to the approved project. No key or secret is ever printed.
 */

import * as path from "path";
import { Client } from "pg";

import { runSeedPlan, SeedError, type SeedPort, type SeedSummary } from "../lib/supabase/seed-data/runner";
import { SEED_PLAN } from "../lib/supabase/seed-data/plan";
import { analyzeDbUrlRef, APPROVED_PROJECT_REF, fingerprint, isApprovedRef, refFromSupabaseUrl } from "./lib/approved-project.mjs";

interface Options {
  local: boolean;
  projectRef?: string;
  confirmed: boolean;
  dryRun: boolean;
}

const USAGE =
  "Usage: npx tsx scripts/seed-fresh-supabase.ts (--local | --project-ref <ref> --yes-this-is-a-test-project) [--dry-run]";

function parseArgs(argv: string[]): Options {
  const local = argv.includes("--local");
  const dryRun = argv.includes("--dry-run");
  const confirmed = argv.includes("--yes-this-is-a-test-project");
  const refIndex = argv.indexOf("--project-ref");
  const projectRef = refIndex >= 0 ? argv[refIndex + 1] : undefined;
  return { local, projectRef, confirmed, dryRun };
}

/** Refuse before touching any database when the target is not clearly a test target. */
export function checkGuards(options: Options, env: NodeJS.ProcessEnv): string | null {
  if (env.NODE_ENV === "production" || env.VERCEL || env.CI) {
    return "Refusing to seed: NODE_ENV=production, VERCEL or CI is set. Production initialization is a separate, approved step.";
  }
  if (options.local && options.projectRef) {
    return "Choose one target: --local or --project-ref, not both.";
  }
  if (!options.local && !options.projectRef) {
    return `No target given. ${USAGE}`;
  }
  if (options.projectRef) {
    if (!options.confirmed) {
      return "A --project-ref run needs --yes-this-is-a-test-project to confirm the target is a test project.";
    }
    if (isApprovedRef(options.projectRef)) {
      return `Refusing to seed: --project-ref is the approved production project (fingerprint ${fingerprint(APPROVED_PROJECT_REF)}). This command has no supported production seed path.`;
    }
    const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (refFromSupabaseUrl(url) !== options.projectRef) {
      return "NEXT_PUBLIC_SUPABASE_URL does not match --project-ref. Refusing to write to an unexpected project.";
    }
    if (/prod|production|live/i.test(options.projectRef)) {
      return "Refusing to seed: the project ref looks like production.";
    }
  }
  if (options.local) {
    if (!env.DATABASE_URL) {
      return "--local needs DATABASE_URL pointing at the local/test Postgres.";
    }
    const { ref, userRef, hostRef, ambiguous } = analyzeDbUrlRef(env.DATABASE_URL);
    // Fail closed. Supavisor routes the tenant from the username, so either
    // location naming the approved project is enough to refuse, and an ambiguous
    // string (two conflicting refs) cannot be proven safe.
    if (ambiguous || isApprovedRef(ref) || isApprovedRef(userRef) || isApprovedRef(hostRef)) {
      return `Refusing to seed: DATABASE_URL resolves to the approved production project (fingerprint ${fingerprint(APPROVED_PROJECT_REF)}). Use a local/test Postgres.`;
    }
  }
  return null;
}

/** The plan runner over a Postgres connection (`pg`), used for the local/test target. */
export function pgPort(client: Client): SeedPort {
  // `pg` serialises a JS array to a Postgres array literal. A `jsonb` column needs
  // JSON text instead, so the column type decides how a value is encoded.
  const jsonbColumns = new Map<string, Set<string>>();

  async function jsonbColumnsOf(table: string): Promise<Set<string>> {
    const cached = jsonbColumns.get(table);
    if (cached) return cached;
    const result = await client.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = $1 and data_type = 'jsonb'`,
      [table],
    );
    const set = new Set(result.rows.map((r) => r.column_name));
    jsonbColumns.set(table, set);
    return set;
  }

  return {
    async upsert(table, rows, conflict) {
      if (rows.length === 0) return 0;
      const jsonb = await jsonbColumnsOf(table);
      const columns = Object.keys(rows[0]);
      const values: unknown[] = [];
      const tuples = rows.map((row) => {
        const placeholders = columns.map((column) => {
          values.push(encode(row[column], jsonb.has(column)));
          return `$${values.length}`;
        });
        return `(${placeholders.join(", ")})`;
      });
      const sql =
        `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) ` +
        `VALUES ${tuples.join(", ")} ON CONFLICT (${quoteIdent(conflict)}) DO NOTHING`;
      const result = await client.query(sql, values);
      return result.rowCount ?? 0;
    },
    async tableExists(table) {
      const result = await client.query<{ exists: boolean }>(
        "select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = $1)",
        [table],
      );
      return result.rows[0]?.exists === true;
    },
    async tableHasRows(table) {
      const result = await client.query<{ has_rows: boolean }>(
        `select exists (select 1 from ${quoteIdent(table)} limit 1) as has_rows`,
      );
      return result.rows[0]?.has_rows === true;
    },
  };
}

/** A `jsonb` value is sent as JSON text; everything else is passed through to `pg`. */
function encode(value: unknown, isJsonb: boolean): unknown {
  if (isJsonb && value !== null && value !== undefined) return JSON.stringify(value);
  return value;
}

function quoteIdent(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) throw new SeedError(`Unsafe identifier: ${identifier}`);
  return `"${identifier}"`;
}

function loadEnv(): void {
  // Loaded the way the other scripts do (create-first-super-admin.ts).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require("dotenv") as typeof import("dotenv");
    dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
    dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  } catch {
    /* dotenv is optional when the environment is already populated */
  }
}

async function main(): Promise<void> {
  loadEnv();
  const options = parseArgs(process.argv.slice(2));
  const refusal = checkGuards(options, process.env);
  if (refusal) {
    console.error(`✖ ${refusal}`);
    process.exit(1);
  }

  console.log("=== FRESH SUPABASE INITIALIZATION ===");
  console.log(`Target: ${options.local ? "DATABASE_URL (local/test)" : `project ${options.projectRef}`}`);
  console.log(`Mode: ${options.dryRun ? "DRY RUN (no writes)" : "WRITE"}`);

  const plannedRows = SEED_PLAN.reduce((sum, op) => sum + (op.insertOnly ? 0 : op.rows.length), 0);
  console.log(`Plan: ${SEED_PLAN.length} tables, ${plannedRows} rows to upsert (conflict-safe).`);

  if (options.dryRun) {
    for (const op of SEED_PLAN) {
      const mode = op.insertOnly
        ? "(no rows; table only)"
        : `${op.rows.length} rows on ${op.conflict}${(op.seedWhen ?? "empty") === "empty" ? " (only if the table is empty)" : ""}${op.dependsOn ? ` (only if ${op.dependsOn} is seeded this run)` : ""}`;
      console.log(`  ${op.table.padEnd(20)} ${mode}`);
    }
    console.log("Dry run complete. Nothing was written.");
    return;
  }

  const connectionString = options.local ? process.env.DATABASE_URL : buildServiceConnection();
  const client = new Client({ connectionString, ssl: options.local ? undefined : { rejectUnauthorized: false } });
  await client.connect();
  try {
    const summary: SeedSummary = await runSeedPlan(pgPort(client));
    console.log("\n=== SUMMARY ===");
    for (const [table, count] of Object.entries(summary.inserted)) {
      console.log(`  ${table.padEnd(20)} +${count}`);
    }
    if (summary.alreadyPopulated.length > 0) {
      console.log(`  (already populated, left untouched): ${summary.alreadyPopulated.join(", ")}`);
    }
    if (summary.dependencySkipped.length > 0) {
      console.log(`  (dependency not seeded, left untouched): ${summary.dependencySkipped.join(", ")}`);
    }
    if (summary.skipped.length > 0) {
      console.log(`  (no rows seeded, table ensured): ${summary.skipped.join(", ")}`);
    }
    console.log(`Total rows inserted this run: ${summary.totalInserted}`);
    console.log("Re-running is safe: existing rows are left untouched.");
  } finally {
    await client.end();
  }
}

/** The service-role Postgres connection for a --project-ref run, without printing secrets. */
function buildServiceConnection(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const password = process.env.SUPABASE_DB_PASSWORD;
  const host = process.env.SUPABASE_POOLER_HOST;
  if (!url || !password || !host) {
    throw new SeedError(
      "A --project-ref run needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_DB_PASSWORD and SUPABASE_POOLER_HOST.",
    );
  }
  const ref = new URL(url).hostname.split(".")[0];
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:5432/postgres`;
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Seeding failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
