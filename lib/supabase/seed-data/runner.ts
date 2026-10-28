/**
 * Fresh-initialization runner.
 *
 * Applies `SEED_PLAN` through a small `SeedPort` so the same logic runs against
 * Supabase (the real seeder) and PGlite (the seed tests) without a network.
 *
 * Every write is an upsert with `ignoreDuplicates` — `ON CONFLICT DO NOTHING`. That
 * is what makes the run idempotent (a second run creates no duplicate rows) and
 * non-destructive (an owner's edit to a seeded row is never overwritten by a later
 * run). Rows the owner has never touched are (re)created if missing.
 */

import { SEED_PLAN, REQUIRED_TABLES, type SeedOperation } from "./plan";

export interface SeedPort {
  /** Insert rows unless a row already exists on `conflict`. Returns the number inserted. */
  upsert(table: string, rows: Record<string, unknown>[], conflict: string): Promise<number>;
  /** True when the table exists in the destination schema. */
  tableExists(table: string): Promise<boolean>;
}

export interface SeedSummary {
  /** table -> number of rows inserted by this run. */
  inserted: Record<string, number>;
  /** Tables that must exist but received no rows (analytics/visitor data). */
  skipped: string[];
  /** Tables from the plan that are missing from the database. */
  missingTables: string[];
  totalInserted: number;
}

export class SeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedError";
  }
}

/** Verify every required table exists before writing anything. */
export async function assertRequiredTables(port: SeedPort): Promise<string[]> {
  const missing: string[] = [];
  for (const table of REQUIRED_TABLES) {
    if (!(await port.tableExists(table))) missing.push(table);
  }
  return missing;
}

export async function runSeedPlan(port: SeedPort, plan: SeedOperation[] = SEED_PLAN): Promise<SeedSummary> {
  const missingTables = await assertRequiredTables(port);
  if (missingTables.length > 0) {
    throw new SeedError(
      `Missing required tables: ${missingTables.join(", ")}. ` +
        "Apply the Supabase migrations before seeding.",
    );
  }

  const inserted: Record<string, number> = {};
  const skipped: string[] = [];
  let totalInserted = 0;

  for (const operation of plan) {
    if (operation.insertOnly || operation.rows.length === 0) {
      skipped.push(operation.table);
      continue;
    }
    const count = await port.upsert(operation.table, operation.rows, operation.conflict);
    inserted[operation.table] = count;
    totalInserted += count;
  }

  return { inserted, skipped, missingTables, totalInserted };
}
