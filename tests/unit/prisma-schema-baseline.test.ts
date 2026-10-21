/**
 * Prisma schema baseline tests.
 *
 * These run without any database credentials: they read files from disk and
 * compare structures. The central assertion is that `prisma/schema.prisma`
 * mirrors the authoritative SQL migrations, so the Prisma models cannot silently
 * drift from the real database or claim parity that does not exist.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..", "..");
const SCHEMA_PATH = join(ROOT, "prisma", "schema.prisma");
const CONFIG_PATH = join(ROOT, "prisma.config.ts");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

const schema = readFileSync(SCHEMA_PATH, "utf8");
const config = readFileSync(CONFIG_PATH, "utf8");

/** Schema with `//` line comments removed, so tests assert on real declarations. */
const schemaCode = schema
  .split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");

/** Every CREATE TABLE statement across the Supabase migrations, as SQL text. */
function readMigrationSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

const migrationSql = readMigrationSql();

/**
 * Extract the column names of a table from SQL DDL.
 * Returns null when the table is not defined in the migrations.
 */
function sqlColumns(table: string): Set<string> | null {
  const re = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?"?${table}"?\\s*\\(`,
    "i"
  );
  const match = re.exec(migrationSql);
  if (!match) return null;

  // Walk forward to the matching close paren, tracking nesting for CHECK(...) etc.
  const start = match.index + match[0].length;
  let depth = 1;
  let end = start;
  for (let i = start; i < migrationSql.length; i++) {
    const ch = migrationSql[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const body = migrationSql.slice(start, end);
  const columns = new Set<string>();

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim().replace(/,$/, "");
    if (!line) continue;
    // Skip table-level constraints.
    if (/^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK|EXCLUDE)\b/i.test(line)) {
      continue;
    }
    // First token is the column name, quoted or bare.
    const m = /^"([^"]+)"|^([A-Za-z_][A-Za-z0-9_]*)/.exec(line);
    if (!m) continue;
    const name = m[1] ?? m[2];
    // Ignore anything that is not followed by a type-ish token.
    if (/^(CREATE|ALTER|DROP|INDEX|COMMENT|GRANT|REVOKE)$/i.test(name)) continue;
    columns.add(name);
  }

  // Columns added by later, additive migrations (`ALTER TABLE ... ADD COLUMN`).
  const addRe = new RegExp(
    `ALTER\\s+TABLE\\s+(?:public\\.)?"?${table}"?\\s+ADD\\s+COLUMN\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?"?([A-Za-z_][A-Za-z0-9_]*)"?`,
    "gi"
  );
  for (const add of migrationSql.matchAll(addRe)) {
    columns.add(add[1]);
  }

  return columns;
}

interface PrismaModel {
  name: string;
  table: string;
  columns: Set<string>;
}

/** Parse `model X { ... }` blocks, resolving @map and @@map. */
function prismaModels(): PrismaModel[] {
  const models: PrismaModel[] = [];
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;

  let match: RegExpExecArray | null;
  while ((match = modelRe.exec(schema)) !== null) {
    const name = match[1];
    const body = match[2];

    const tableMap = /@@map\("([^"]+)"\)/.exec(body);
    const table = tableMap ? tableMap[1] : name;

    const columns = new Set<string>();
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;

      const field = /^(\w+)\s+([\w[\]?]+)/.exec(line);
      if (!field) continue;

      const fieldName = field[1];
      const fieldType = field[2];

      // Relation fields are typed as another model (capitalized). They are not
      // columns. Scalar types in this schema are lowercase or String/Int/...
      if (/^[A-Z]/.test(fieldType) && !/^(String|Int|Boolean|DateTime|Json|Decimal|Float|BigInt|Bytes)$/.test(fieldType.replace(/[?[\]]/g, ""))) {
        continue;
      }

      const colMap = /@map\("([^"]+)"\)/.exec(line);
      columns.add(colMap ? colMap[1] : fieldName);
    }

    models.push({ name, table, columns });
  }

  return models;
}

const models = prismaModels();

describe("prisma schema baseline", () => {
  it("parses the expected number of models", () => {
    expect(models.length).toBeGreaterThanOrEqual(8);
  });

  it("uses the postgresql provider", () => {
    expect(schema).toMatch(/datasource\s+db\s*\{[^}]*provider\s*=\s*"postgresql"/);
  });

  it("does not hardcode a connection URL in the schema", () => {
    // Prisma 7 reads the URL from prisma.config.ts, sourced from the environment.
    const datasourceBlock = /datasource\s+db\s*\{([\s\S]*?)\}/.exec(schema);
    expect(datasourceBlock).not.toBeNull();
    expect(datasourceBlock![1]).not.toMatch(/url\s*=/);
  });

  it("maps every model to an explicit table name", () => {
    for (const model of models) {
      const body = new RegExp(`model\\s+${model.name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(schema)![1];
      expect(body).toMatch(/@@map\("/);
    }
  });

  it("does not let Prisma own updated_at, which the DB trigger maintains", () => {
    // A client-side @updatedAt would compete with update_*_updated_at() triggers.
    expect(schemaCode).not.toMatch(/@updatedAt/);
  });

  it("declares no enum types that the database does not have", () => {
    // The SQL uses text columns for role/status/language, not Postgres enums.
    expect(schema).not.toMatch(/\benum\s+\w+\s*\{/);
  });

  it("keeps a single-row ai_settings table keyed by id", () => {
    const ai = models.find((m) => m.table === "ai_settings");
    expect(ai).toBeDefined();
    expect(ai!.columns.has("id")).toBe(true);
    expect(schema).toMatch(/@default\("main"\)/);
  });

  it("declares no relations the database does not enforce", () => {
    // chat_messages.session_id has NO foreign key in the SQL, so the schema must
    // not invent one. Verified against a database built from the migrations with
    // `prisma migrate diff`, which reported no difference once the relation was
    // removed. A Prisma @relation here would make migrate try to add the FK.
    expect(schemaCode).not.toMatch(/@relation/);
  });

  it("marks times_asked nullable, matching the SQL", () => {
    // The DDL declares `times_asked integer DEFAULT 1` with no NOT NULL.
    expect(schemaCode).toMatch(/timesAsked\s+Int\?\s+@default\(1\)/);
  });

  it("names indexes exactly as the SQL migrations do", () => {
    // Prisma would otherwise auto-name these (e.g. `ai_knowledge_slug_idx`) and
    // report permanent drift against the real database.
    for (const name of [
      "idx_ai_knowledge_category",
      "idx_ai_knowledge_approved",
      "idx_ai_knowledge_slug",
      "idx_chat_sessions_user_id",
      "idx_chat_messages_session_id",
      "idx_chat_messages_timestamp",
      "idx_unknown_questions_timestamp",
      "idx_ai_intent_dist_timestamp",
      "idx_ai_latency_records_timestamp",
    ]) {
      expect(schemaCode).toContain(`map: "${name}"`);
    }
  });
});

describe("prisma schema mirrors the SQL migrations", () => {
  // Only the AI domain plus the role source is in scope for the baseline PR.
  const inScope = models.filter((m) =>
    [
      "ai_settings",
      "ai_knowledge",
      "chat_sessions",
      "chat_messages",
      "unknown_questions",
      "ai_intent_distribution",
      "ai_latency_records",
      "users",
      "profiles",
    ].includes(m.table)
  );

  it("covers the whole AI domain", () => {
    expect(inScope.map((m) => m.table).sort()).toEqual([
      "ai_intent_distribution",
      "ai_knowledge",
      "ai_latency_records",
      "ai_settings",
      "chat_messages",
      "chat_sessions",
      "profiles",
      "unknown_questions",
      "users",
    ]);
  });

  it.each(inScope.map((m) => [m.table, m] as const))(
    "table %s: every SQL column is modelled",
    (table, model) => {
      const fromSql = sqlColumns(table);
      expect(fromSql).not.toBeNull();

      const missing = [...fromSql!].filter((c) => !model.columns.has(c));
      expect(missing).toEqual([]);
    }
  );

  it.each(inScope.map((m) => [m.table, m] as const))(
    "table %s: the model invents no columns",
    (table, model) => {
      const fromSql = sqlColumns(table);
      expect(fromSql).not.toBeNull();

      const invented = [...model.columns].filter((c) => !fromSql!.has(c));
      expect(invented).toEqual([]);
    }
  );
});

describe("prisma configuration is credential-safe", () => {
  it("reads the datasource URL from the environment", () => {
    expect(config).toMatch(/process\.env\[/);
  });

  it("prefers a dedicated migration URL over the runtime pooler", () => {
    expect(config).toMatch(/PRISMA_DATABASE_URL/);
  });

  it("contains no literal connection string", () => {
    expect(config).not.toMatch(/postgres(ql)?:\/\//);
    expect(schema).not.toMatch(/postgres(ql)?:\/\//);
  });

  it("contains no JWT or service-role key", () => {
    for (const text of [schema, config]) {
      expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
      expect(text).not.toMatch(/service_role/i);
    }
  });

  it("ignores the generated client directory", () => {
    const gitignore = readFileSync(join(ROOT, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/generated\/prisma/);
  });

  it("ignores local env files", () => {
    const gitignore = readFileSync(join(ROOT, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/\.env/);
  });
});

describe("baseline migration", () => {
  const baselineDir = join(ROOT, "prisma", "migrations", "20261015000000_baseline_raya_ai");

  it("ships a baseline migration script", () => {
    const sql = readFileSync(join(baselineDir, "migration.sql"), "utf8");
    for (const table of [
      "ai_settings",
      "ai_knowledge",
      "chat_sessions",
      "chat_messages",
      "unknown_questions",
      "ai_intent_distribution",
      "ai_latency_records",
      "users",
      "profiles",
    ]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE "${table}"`));
    }
  });

  it("records the postgresql provider in the migration lock", () => {
    const lock = readFileSync(join(ROOT, "prisma", "migrations", "migration_lock.toml"), "utf8");
    expect(lock).toMatch(/provider\s*=\s*"postgresql"/);
  });

  it("is additive only: no destructive statements", () => {
    const sql = readFileSync(join(baselineDir, "migration.sql"), "utf8");
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
    expect(sql).not.toMatch(/DROP\s+COLUMN/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
  });
});
