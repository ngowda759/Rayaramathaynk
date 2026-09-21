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
