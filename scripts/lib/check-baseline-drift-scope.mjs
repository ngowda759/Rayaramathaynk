import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Scoped Prisma drift checker for the Raya AI baseline.
//
// Problem it solves: `prisma migrate diff --from-schema prisma/schema.prisma
// --to-config-datasource --exit-code` diffs the WHOLE database. The baseline
// (prisma/migrations/20261015000000_baseline_raya_ai) intentionally models only
// the nine AI/user tables; more than a dozen other tables belong to other modules
// and are deliberately deferred (see docs/PRISMA-SCHEMA-BASELINE.md section 5
// item 5). So the whole-schema diff always exits 2, even when the AI domain is
// perfectly reconciled.
//
// This checker parses that same diff and decides the exit code from the IN-SCOPE
// tables only (the tables the schema declares via @@map). Out-of-scope tables are
// printed and recorded as deferred, never hidden.
//
// It does NOT weaken the check:
//   - a missing/removed/added in-scope table still fails;
//   - any change to an in-scope table still fails;
//   - an "added" table whose name is close to an in-scope name (a probable typo,
//     e.g. `ai_knowledge_extra`) still fails, so a mismapped `@@map` is not excused;
//   - a schema/migration mismatch (nothing in scope but the baseline declares a
//     table the migrations do not) still fails.
// It only affects which tables are considered "the intended schema", and that scope
// is derived from the schema itself, so it cannot silently narrow.

const SCHEMA_PATH = "prisma/schema.prisma";
const MIGRATIONS_DIR = "prisma/migrations";

const log = (...a) => console.log(...a);

/** In-scope table names, taken from the schema's @@map() declarations. */
function inScopeTables() {
  const schema = readFileSync(SCHEMA_PATH, "utf8");
  const names = [...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((m) => m[1]);
  if (names.length === 0) {
    console.error("ERROR: no @@map() table names found in " + SCHEMA_PATH);
    process.exit(3);
  }
  return names;
}

/** Tables the baseline migration itself creates (the authoritative scope). */
function baselineTables() {
  let sql = "";
  for (const d of readdirSync(MIGRATIONS_DIR).filter((n) => n.includes("baseline"))) {
    const dir = join(MIGRATIONS_DIR, d);
    const f = join(dir, "migration.sql");
    try {
      sql += readFileSync(f, "utf8") + "\n";
    } catch {}
  }
  return [...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]);
}

function runDiff() {
  const r = spawnSync(
    "npx",
    ["prisma", "migrate", "diff", "--from-schema", SCHEMA_PATH, "--to-config-datasource", "--exit-code"],
    { encoding: "utf8", env: process.env },
  );
  return { out: (r.stdout || "") + (r.stderr || ""), code: r.status ?? 1 };
}

/** Parse the diff text into { added:[], removed:[], changed:[] }. */
function parseDiff(text) {
  const added = [];
  const removed = [];
  const changed = [];
  const lines = text.split("\n");
  let section = null;
  for (const raw of lines) {
    const line = raw.replace(/\u001b\[[0-9;]*m/g, "").trim();
    if (/^\[\+\] Added tables/.test(line)) { section = "added"; continue; }
    if (/^\[-\] Removed tables/.test(line)) { section = "removed"; continue; }
    if (/^\[\*\] Changed the `([^`]+)` table/.test(line)) {
      changed.push(line.match(/^\[\*\] Changed the `([^`]+)` table/)[1]);
      section = "changedbody";
      continue;
    }
    if (/^No difference detected/.test(line)) { section = null; continue; }
    if (section === "added" || section === "removed") {
      const m = line.match(/^- (.+)$/);
      if (m) { (section === "added" ? added : removed).push(m[1].trim()); continue; }
      if (line === "") section = null;
    }
    if (section === "changedbody") {
      if (line === "") section = null;
    }
  }
  return { added, removed, changed };
}

/** True when `name` is a probable typo/mismap of an in-scope table. */
function looksInScope(name, scope) {
  return scope.some((s) => name === s || name.startsWith(s + "_") || s.startsWith(name + "_"));
}

try {
  const scope = inScopeTables();
  const base = baselineTables();
  log(`In-scope tables (from ${SCHEMA_PATH}): ${scope.length}`);
  log(`  ${scope.join(", ")}`);
  log(`Baseline migration creates: ${base.length} table(s)`);

  // Guard: the schema and the baseline migration must agree on the table set.
  const onlySchema = scope.filter((t) => !base.includes(t));
  const onlyBaseline = base.filter((t) => !scope.includes(t));
  if (onlySchema.length || onlyBaseline.length) {
    log("");
    log("IN-SCOPE MISMATCH: the schema and the baseline migration disagree.");
    if (onlySchema.length) log(`  declared in schema only: ${onlySchema.join(", ")}`);
    if (onlyBaseline.length) log(`  created by baseline only: ${onlyBaseline.join(", ")}`);
    log("");
    log("The intended schema cannot be trusted until this is reconciled.");
    process.exit(2);
  }

  const { out, code } = (() => {
    if (process.env.SCOPED_DIFF_TEXT_FILE) {
      const text = readFileSync(process.env.SCOPED_DIFF_TEXT_FILE, "utf8");
      console.log(`Using supplied diff text (${process.env.SCOPED_DIFF_TEXT_FILE}); prisma not invoked.`);
      return { out: text, code: /No difference detected/.test(text) ? 0 : 2 };
    }
    return runDiff();
  })();
  log("");
  log(`prisma migrate diff raw exit code: ${code}`);

  if (/No difference detected/.test(out)) {
    log("No difference detected against the target.");
    log("SCOPED RESULT: PASS (exit 0) — the declared schema is fully reconciled.");
    process.exit(0);
  }

  const { added, removed, changed } = parseDiff(out);

  const inScopeAdded = added.filter((t) => scope.includes(t) || looksInScope(t, scope));
  const deferredAdded = added.filter((t) => !inScopeAdded.includes(t));
  const inScopeRemoved = removed.filter((t) => scope.includes(t) || looksInScope(t, scope));
  const deferredRemoved = removed.filter((t) => !inScopeRemoved.includes(t));
  const inScopeChanged = changed.filter((t) => scope.includes(t) || looksInScope(t, scope));
  const deferredChanged = changed.filter((t) => !inScopeChanged.includes(t));

  log("");
  log("=== OUT OF SCOPE (deferred to their own changes; not hidden) ===");
  log(`  added tables (${deferredAdded.length}): ${deferredAdded.join(", ") || "(none)"}`);
  log(`  removed tables (${deferredRemoved.length}): ${deferredRemoved.join(", ") || "(none)"}`);
  log(`  changed tables (${deferredChanged.length}): ${deferredChanged.join(", ") || "(none)"}`);
  log("");
  log("=== IN SCOPE (must be reconciled) ===");
  log(`  added tables (${inScopeAdded.length}): ${inScopeAdded.join(", ") || "(none)"}`);
  log(`  removed tables (${inScopeRemoved.length}): ${inScopeRemoved.join(", ") || "(none)"}`);
  log(`  changed tables (${inScopeChanged.length}): ${inScopeChanged.join(", ") || "(none)"}`);

  const fail =
    inScopeAdded.length || inScopeRemoved.length || inScopeChanged.length || code !== 2;

  log("");
  if (fail) {
    log("SCOPED RESULT: FAIL (exit 2) — the declared schema is not reconciled.");
    log("Do not mark the baseline applied.");
    process.exit(2);
  }
  log("SCOPED RESULT: PASS (exit 0) — the declared schema is reconciled.");
  log("Only tables outside the baseline scope differ; those are deferred by design.");
  log("The baseline is eligible for `migrate resolve --applied`.");
  process.exit(0);
} catch (e) {
  console.error(`ERROR: ${String(e?.message ?? e)}`);
  process.exit(3);
}
