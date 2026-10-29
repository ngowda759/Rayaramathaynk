/**
 * Fresh-initialization runner.
 *
 * Applies `SEED_PLAN` through a small `SeedPort` so the same logic runs against
 * Supabase (the real seeder) and PGlite (the seed tests) without a network.
 *
 * Every write is a conflict-safe insert:
 *
 *  - `seedWhen: "always"` (only `settings_documents`) upserts on the row's natural
 *    key with `ON CONFLICT DO NOTHING`, so a missing document is added and an
 *    existing one is left byte-for-byte.
 *  - `seedWhen: "empty"` (every content table) seeds its starter rows only when the
 *    table holds no rows. A table that already has rows is skipped entirely, so the
 *    starter content can never be added as a parallel copy next to real rows.
 *  - `dependsOn` (a child table) runs only when the parent table it references was
 *    seeded earlier in the same run. A skipped parent skips the child too, so a
 *    child row can never reference a seed-only parent identifier that was never
 *    inserted.
 *
 * Either way a second run inserts nothing new and an owner's edit is never
 * overwritten. A table the owner has never populated is (re)created if missing.
 */

import { SEED_PLAN, REQUIRED_TABLES, type SeedOperation } from "./plan";

export interface SeedPort {
  /** Insert rows unless a row already exists on `conflict`. Returns the number inserted. */
  upsert(table: string, rows: Record<string, unknown>[], conflict: string): Promise<number>;
  /** True when the table exists in the destination schema. */
  tableExists(table: string): Promise<boolean>;
  /** True when the table holds at least one row. */
  tableHasRows(table: string): Promise<boolean>;
}

export interface SeedSummary {
  /** table -> number of rows inserted by this run. */
  inserted: Record<string, number>;
  /** Tables that must exist but received no rows (analytics/visitor data). */
  skipped: string[];
  /** Tables left untouched because they already held owner-curated rows. */
  alreadyPopulated: string[];
  /** Tables left untouched because a table they depend on was not seeded this run. */
  dependencySkipped: string[];
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
  const alreadyPopulated: string[] = [];
  const dependencySkipped: string[] = [];
  // Tables seeded (or determined seedable) earlier in this run. A `dependsOn` parent
  // that is absent here was skipped, so the child must be skipped too.
  const seeded = new Set<string>();
  let totalInserted = 0;

  for (const operation of plan) {
    if (operation.insertOnly || operation.rows.length === 0) {
      skipped.push(operation.table);
      continue;
    }
    if (operation.dependsOn && !seeded.has(operation.dependsOn)) {
      // The parent this table references was not seeded this run (it was skipped
      // because it already holds rows). Seeding the child would leave rows pointing
      // at a seed-only parent identifier that was never inserted.
      dependencySkipped.push(operation.table);
      continue;
    }
    if ((operation.seedWhen ?? "empty") === "empty" && (await port.tableHasRows(operation.table))) {
      // The owner (or a prior import) already populated this table. Leave it alone so
      // the starter rows are never added as a parallel copy.
      alreadyPopulated.push(operation.table);
      continue;
    }
    const count = await port.upsert(operation.table, operation.rows, operation.conflict);
    inserted[operation.table] = count;
    seeded.add(operation.table);
    totalInserted += count;
  }

  return { inserted, skipped, alreadyPopulated, dependencySkipped, missingTables, totalInserted };
}
