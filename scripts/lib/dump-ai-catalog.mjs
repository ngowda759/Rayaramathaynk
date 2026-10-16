import { Client } from "pg";

// Read-only catalog dump for reconciliation. Never writes and never prints a
// credential. Usage: node scripts/lib/dump-ai-catalog.mjs <postgres-url> [table...]
const url = process.argv[2];
const tables = process.argv.slice(3);
if (!url) {
  console.error("usage: dump-ai-catalog.mjs <postgres-url> [table ...]");
  process.exit(2);
}
const wanted = tables.length ? tables : ["ai_knowledge"];

let probeUrl = url;
try {
  const u = new URL(url);
  u.searchParams.delete("sslmode"); // else pg forces cert verification against Supavisor
  probeUrl = u.toString();
} catch {}

const c = new Client({
  connectionString: probeUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const q = (text, params) => c.query(text, params);

try {
  await c.connect();

  const pub = await q(
    `select tablename from pg_tables where schemaname='public' order by tablename`,
  );
  console.log("=== public tables (" + pub.rowCount + ") ===");
  console.log(pub.rows.map((r) => r.tablename).join(", "));
  console.log();

  // Supabase CLI migration history, if present. Read-only.
  try {
    const hist = await q(
      `select version, name from supabase_migrations.schema_migrations order by version`,
    );
    console.log("=== applied migrations (" + hist.rowCount + ") ===");
    for (const r of hist.rows) console.log(`  ${r.version}  ${r.name ?? ""}`);
  } catch (e) {
    console.log("=== applied migrations === (no supabase_migrations.schema_migrations)");
  }
  console.log();

  for (const t of wanted) {
    const exists = await q(
      `select 1 from pg_tables where schemaname='public' and tablename=$1`,
      [t],
    );
    console.log(`=== ${t} ===`);
    if (exists.rowCount === 0) {
      console.log(`(absent from schema 'public')`);
      const like = await q(
        `select table_schema, table_name from information_schema.tables
         where table_name ilike $1 or table_name ilike $2 order by 1,2`,
        [`%${t}%`, `%knowledge%`],
      );
      console.log(
        "similar tables: " +
          (like.rows.map((r) => `${r.table_schema}.${r.table_name}`).join(", ") || "(none)"),
      );
      console.log();
      continue;
    }

    const cols = await q(
      `select ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
       from information_schema.columns
       where table_schema='public' and table_name=$1 order by ordinal_position`,
      [t],
    );
    console.log("-- columns");
    for (const r of cols.rows) {
      console.log(
        `  ${String(r.ordinal_position).padStart(2)}  ${r.column_name}  ${r.data_type}` +
          `${r.data_type === "ARRAY" ? "[" + r.udt_name.replace(/^_/, "") + "]" : ""}  ` +
          `null=${r.is_nullable}  default=${r.column_default ?? "-"}`,
      );
    }

    const cons = await q(
      `select con.conname, con.contype, pg_get_constraintdef(con.oid) as definition
       from pg_constraint con
       join pg_class tbl on tbl.oid = con.conrelid
       join pg_namespace ns on ns.oid = tbl.relnamespace
       where ns.nspname='public' and tbl.relname=$1 order by con.conname`,
      [t],
    );
    console.log("-- constraints");
    for (const r of cons.rows) {
      console.log(`  ${r.conname} [${r.contype}] ${r.definition}`);
    }

    const idx = await q(
      `select indexname, indexdef from pg_indexes
       where schemaname='public' and tablename=$1 order by indexname`,
      [t],
    );
    console.log("-- indexes");
    for (const r of idx.rows) console.log(`  ${r.indexname}: ${r.indexdef}`);

    const trg = await q(
      `select tgname from pg_trigger tg
       join pg_class tbl on tbl.oid = tg.tgrelid
       join pg_namespace ns on ns.oid = tbl.relnamespace
       where ns.nspname='public' and tbl.relname=$1 and not tg.tgisinternal
       order by tgname`,
      [t],
    );
    console.log("-- triggers");
    console.log("  " + (trg.rows.map((r) => r.tgname).join(", ") || "(none)"));
    console.log();
  }

  await c.end();
  process.exit(0);
} catch (e) {
  const raw = String(e?.message ?? e).replace(/postgres\.[a-z0-9]+/g, "postgres.<ref>");
  console.error("[catalog-error] " + raw.slice(0, 200));
  try { await c.end(); } catch {}
  process.exit(1);
}
