import { Client } from "pg";

// Read-only connectivity probe for a Postgres URL. Exit 0 if a SELECT succeeds.
// Used by .github/workflows/prisma-baseline-drift-gate.yml to find the reachable
// session-pooler host before running the Prisma drift diff. Never writes.
const url = process.argv[2];
if (!url) {
  console.error("usage: probe-pg-url.mjs <postgres-url>");
  process.exit(2);
}

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
try {
  await client.connect();
  await client.query("select 1");
  console.log("connected");
  await client.end();
  process.exit(0);
} catch (e) {
  // Redact the project ref in the username from any error we surface.
  const msg = String(e?.message ?? e).replace(/postgres\.[a-z0-9]+/g, "postgres.<ref>");
  console.error(msg.slice(0, 200));
  try { await client.end(); } catch {}
  process.exit(1);
}
