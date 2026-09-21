/**
 * Pure helpers for analysing Supabase migration coverage.
 *
 * These functions intentionally do not touch any database so they can be unit
 * tested deterministically. They translate raw migration SQL into the set of
 * tables the schema is expected to create.
 */

const CREATE_TABLE_REGEX =
  /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:(?:"?public"?)\s*\.\s*)?"?([A-Za-z_][A-Za-z0-9_]*)"?/gi;

/**
 * Extract the set of table names declared via `CREATE TABLE` across the given
 * migration file contents. Names are lower-cased, de-duplicated and sorted so
 * the output is stable regardless of migration ordering.
 */
export function extractDeclaredTables(sqlContents: string[]): string[] {
  const tables = new Set<string>();

  for (const sql of sqlContents) {
    const withoutComments = stripSqlComments(sql);
    let match: RegExpExecArray | null;
    CREATE_TABLE_REGEX.lastIndex = 0;
    while ((match = CREATE_TABLE_REGEX.exec(withoutComments)) !== null) {
      tables.add(match[1].toLowerCase());
    }
  }

  return [...tables].sort();
}

/**
 * Compare the expected table set against the tables that actually exist in the
 * target database.
 */
export function diffTableCoverage(expected: string[], existing: string[]) {
  const expectedSet = new Set(expected.map((t) => t.toLowerCase()));
  const existingSet = new Set(existing.map((t) => t.toLowerCase()));

  const missing = [...expectedSet].filter((t) => !existingSet.has(t)).sort();
  const extra = [...existingSet].filter((t) => !expectedSet.has(t)).sort();

  return { missing, extra };
}

/**
 * Remove `--` line comments and `/* ... *\/` block comments so that table names
 * mentioned in prose are not mistaken for declarations.
 */
function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n\r]*/g, " ");
}

/** Constraint keywords that terminate a column's type in a CREATE TABLE body. */
const TYPE_TERMINATORS =
  /\b(PRIMARY|NOT|NULL|DEFAULT|UNIQUE|REFERENCES|CHECK|CONSTRAINT|GENERATED|COLLATE)\b/i;

/** Normalise a raw type fragment to just the base type (e.g. `numeric(10,2)`). */
function normaliseColumnType(raw: string): string {
  let text = raw.split(TYPE_TERMINATORS)[0].trim().toLowerCase();
  text = text.replace(/\s+/g, " ");
  return text || raw.trim().toLowerCase();
}

export interface ExpectedColumn {
  table: string;
  column: string;
  type: string;
  notNull: boolean;
}

/**
 * Extract `column type ...` declarations from each `CREATE TABLE` block.
 *
 * Best-effort static parsing: constraint clauses and table-level constraints are
 * ignored, but column name, base type and NOT NULL are captured. This is used
 * to state static schema expectations without a live connection.
 */
export function extractDeclaredColumns(sqlContents: string[]): ExpectedColumn[] {
  const columns: ExpectedColumn[] = [];

  for (const sql of sqlContents) {
    const withoutComments = stripSqlComments(sql);

    const tableRegex =
      /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:(?:"?public"?)\s*\.\s*)?"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\(([\s\S]*?)\)\s*;/gi;

    let tableMatch: RegExpExecArray | null;
    while ((tableMatch = tableRegex.exec(withoutComments)) !== null) {
      const table = tableMatch[1].toLowerCase();
      const body = tableMatch[2];

      const lines = body.split(/,(?![^()]*\))/);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const constraintMatch = /^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT|EXCLUDE)\b/i;
        if (constraintMatch.test(line)) continue;

        const colMatch = line.match(/^"?([A-Za-z_][A-Za-z0-9_]*)"?\s+(.+)$/);
        if (!colMatch) continue;

        const column = colMatch[1].toLowerCase();
        const type = normaliseColumnType(colMatch[2]);
        const notNull = /\bNOT\s+NULL\b/i.test(line);

        columns.push({ table, column, type, notNull });
      }
    }
  }

  return columns.sort((a, b) =>
    a.table === b.table ? a.column.localeCompare(b.column) : a.table.localeCompare(b.table)
  );
}

/**
 * Tables whose migrations explicitly enable Row Level Security. Used to assert
 * that every migrated table is protected, without touching the database.
 */
export function extractRlsEnabledTables(sqlContents: string[]): string[] {
  const tables = new Set<string>();
  const regex =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:(?:"?public"?)\s*\.\s*)?"?([A-Za-z_][A-Za-z0-9_]*)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;

  for (const sql of sqlContents) {
    const withoutComments = stripSqlComments(sql);
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(withoutComments)) !== null) {
      tables.add(match[1].toLowerCase());
    }
  }

  return [...tables].sort();
}

export interface StaticSchemaReport {
  tables: string[];
  columns: ExpectedColumn[];
  /** Column types after applying ALTER COLUMN ... TYPE, in migration order. */
  effectiveColumns: ExpectedColumn[];
  rlsEnabledTables: string[];
  /** Declared tables that never enable RLS. */
  tablesMissingRls: string[];
}

/**
 * Extract `ALTER TABLE ... ALTER COLUMN ... TYPE <type>` statements, in file
 * order. Migrations are append-only, so the last alteration of a column is its
 * effective type - e.g. `campaign_id` is declared uuid then widened to text.
 */
export function extractColumnTypeAlterations(
  sqlContents: string[]
): { table: string; column: string; type: string }[] {
  const alterations: { table: string; column: string; type: string }[] = [];
  const regex =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:(?:"?public"?)\s*\.\s*)?"?([A-Za-z_][A-Za-z0-9_]*)"?\s+ALTER\s+COLUMN\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s+TYPE\s+([A-Za-z_][A-Za-z0-9_]*(?:\s*\([^)]*\))?)/gi;

  for (const sql of sqlContents) {
    const withoutComments = stripSqlComments(sql);
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(withoutComments)) !== null) {
      alterations.push({
        table: match[1].toLowerCase(),
        column: match[2].toLowerCase(),
        type: normaliseColumnType(match[3]),
      });
    }
  }

  return alterations;
}

/**
 * Apply ALTER COLUMN TYPE statements over the columns declared by CREATE TABLE,
 * yielding the schema that actually exists after every migration has run.
 */
export function applyColumnTypeAlterations(
  columns: ExpectedColumn[],
  alterations: { table: string; column: string; type: string }[]
): ExpectedColumn[] {
  const result = columns.map((c) => ({ ...c }));

  for (const alteration of alterations) {
    const target = result.find(
      (c) => c.table === alteration.table && c.column === alteration.column
    );
    if (target) {
      target.type = alteration.type;
    } else {
      // The column was introduced by an ALTER rather than the CREATE block.
      result.push({
        table: alteration.table,
        column: alteration.column,
        type: alteration.type,
        notNull: false,
      });
    }
  }

  return result.sort((a, b) =>
    a.table === b.table ? a.column.localeCompare(b.column) : a.table.localeCompare(b.table)
  );
}

/**
 * Build the complete static schema expectation from migration SQL alone. This
 * requires no credentials and can run in CI.
 */
export function buildStaticSchemaReport(sqlContents: string[]): StaticSchemaReport {
  const tables = extractDeclaredTables(sqlContents);
  const columns = extractDeclaredColumns(sqlContents);
  const effectiveColumns = applyColumnTypeAlterations(
    columns,
    extractColumnTypeAlterations(sqlContents)
  );
  const rlsEnabledTables = extractRlsEnabledTables(sqlContents);
  const rlsSet = new Set(rlsEnabledTables);

  return {
    tables,
    columns,
    effectiveColumns,
    rlsEnabledTables,
    tablesMissingRls: tables.filter((t) => !rlsSet.has(t)),
  };
}

/**
 * Result of checking the Supabase CLI migration ledger.
 *
 * Table existence is NOT equivalent to migration history: a table can exist from
 * a manual `create table`, while the migration that declares it was never
 * recorded as applied. The ledger is the authoritative mechanism.
 */
export type LedgerStatus = "available" | "unavailable" | "unrecognized";

export interface MigrationLedgerReport {
  status: LedgerStatus;
  /** Migration ledger schema, when discovered. */
  schema: string | null;
  table: string | null;
  /** Versions recorded as applied, when the ledger is readable. */
  appliedVersions: string[];
  /** Migration file versions with no ledger entry. */
  pendingVersions: string[];
  note: string;
}

/** Extract the version prefix (the leading digits) from a migration filename. */
export function migrationVersionFromFilename(filename: string): string {
  const match = filename.match(/^(\d+)/);
  return match ? match[1] : filename.replace(/\.sql$/i, "");
}

/**
 * Decide which migration files are not yet recorded in the ledger.
 *
 * Returns `null` when the ledger is unavailable, so callers can avoid claiming
 * "all migrations applied" without evidence.
 */
export function diffMigrationLedger(
  migrationFiles: string[],
  appliedVersions: string[] | null
): string[] | null {
  if (appliedVersions === null) return null;

  const applied = new Set(appliedVersions.map((v) => String(v)));
  return migrationFiles
    .map(migrationVersionFromFilename)
    .filter((version) => !applied.has(version))
    .sort();
}
