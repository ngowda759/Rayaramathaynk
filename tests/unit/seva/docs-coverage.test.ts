/**
 * @jest-environment node
 *
 * The Seva Entry documentation (plan A5-2, with the A5-2 carry list of 2026-10-20) is read as text and checked against
 * the code it describes: every seva table and function, every `/api/seva/*` route and method, every seva migration
 * file. The docs must also carry the runbook, the hand-over notes and the "Changes after sign-off" record, keep the
 * plans pointing at the rewritten setup guide's section ids, and never name the office company or its theme.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..", "..", "..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");
const API_ROOT = path.join(ROOT, "app", "api", "seva");

function read(relative: string): string {
  const file = path.join(ROOT, relative);
  if (!existsSync(file)) throw new Error(`missing ${relative}`);
  return readFileSync(file, "utf8");
}

/**
 * The Seva Entry migrations: `<timestamp>_seva_<name>.sql`. The older `..._create_seva_bookings.sql` and
 * `..._align_seva_bookings_seva_id.sql` belong to the website's booking table, not to this module.
 */
function sevaMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((name) => /^\d{14}_seva_[a-z0-9_]+\.sql$/.test(name))
    .sort();
}

function sevaSql(): string {
  return sevaMigrationFiles()
    .map((name) => readFileSync(path.join(MIGRATIONS, name), "utf8"))
    .join("\n");
}

function names(pattern: RegExp, text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(pattern)) found.add(match[1].toLowerCase());
  return [...found].sort();
}

/** Every route.ts under app/api/seva as its public path, e.g. `/api/seva/gaps/[id]`. */
function routeFiles(dir = API_ROOT): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out.sort();
}

function routePath(file: string): string {
  const relative = path.relative(path.join(ROOT, "app"), path.dirname(file)).split(path.sep).join("/");
  return `/${relative}`;
}

function routeMethods(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return names(/export\s+(?:async\s+function|const|function)\s+(GET|POST|PUT|PATCH|DELETE)\b/g, text).map((m) =>
    m.toUpperCase(),
  );
}

/** Body of a level-2 or level-3 section: from the heading line that matches to the next heading of the same level. */
function section(text: string, heading: RegExp): string {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) throw new Error(`missing heading ${heading}`);
  const level = (lines[start].match(/^#+/) ?? ["##"])[0].length;
  const end = lines.findIndex((line, i) => i > start && new RegExp(`^#{1,${level}} `).test(line));
  return lines.slice(start, end < 0 ? undefined : end).join("\n");
}

const CHANGED_DOCS = [
  "docs/ARCHITECTURE.md",
  "docs/DATA-MODEL.md",
  "docs/API.md",
  "docs/SECURITY.md",
  "docs/UI-GUIDELINES.md",
  "docs/ADMIN-GUIDELINES.md",
  "docs/SUPABASE_MIGRATIONS.md",
  "docs/CHANGELOG.md",
  "docs/seva/README.md",
  "docs/seva/HANDOVER-NOTES.md",
  "docs/seva/DESIGN-BOOK.md",
  "docs/seva/SETUP-GUIDE.md",
];

describe("Seva Entry documentation covers the built code", () => {
  it("DATA-MODEL.md names every seva table", () => {
    const tables = names(/create table if not exists\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi, sevaSql());
    expect(tables.length).toBeGreaterThan(15);
    const doc = read("docs/DATA-MODEL.md");
    const missing = tables.filter((table) => !doc.includes(`\`${table}\``));
    expect(missing).toEqual([]);
  });

  it("DATA-MODEL.md names every seva SQL function", () => {
    const functions = names(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi, sevaSql());
    expect(functions.length).toBeGreaterThan(50);
    const doc = read("docs/DATA-MODEL.md");
    const missing = functions.filter((fn) => !doc.includes(`\`${fn}\``));
    expect(missing).toEqual([]);
  });

  it("API.md names every seva route with each of its methods", () => {
    const files = routeFiles();
    expect(files.length).toBeGreaterThan(30);
    const doc = read("docs/API.md");
    const missing: string[] = [];
    for (const file of files) {
      const route = routePath(file);
      const methods = routeMethods(file);
      expect({ route, methods: methods.length > 0 }).toEqual({ route, methods: true });
      for (const method of methods) {
        if (!doc.includes(`\`${method} ${route}\``)) missing.push(`${method} ${route}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("SUPABASE_MIGRATIONS.md names every seva migration file", () => {
    const files = sevaMigrationFiles();
    expect(files.length).toBeGreaterThanOrEqual(9);
    const doc = read("docs/SUPABASE_MIGRATIONS.md");
    expect(files.filter((name) => !doc.includes(name))).toEqual([]);
    expect(doc).toMatch(/npx supabase db push/);
    expect(doc).toMatch(/Postgres 15/);
    expect(doc).toMatch(/PGlite/);
  });

  it("names the newest file pushed to the owner's test project as frozen", () => {
    // Pushed 2026-10-20 (BUILD-RULES); move this when the next file is pushed.
    const lastPushed = "20261031000000_seva_paper_size.sql";
    expect(sevaMigrationFiles()).toContain(lastPushed);
    const flat = (text: string): string => text.replace(/\s*\r?\n\s*/g, " ");
    const migrations = flat(read("docs/SUPABASE_MIGRATIONS.md")).match(/\*\*Frozen files\.\*\* Every file up to and including `[^`]+`/);
    expect(migrations?.[0]).toBe(`**Frozen files.** Every file up to and including \`${lastPushed}\``);
    const book = flat(read("docs/seva/DESIGN-BOOK.md")).match(/Files up to and including `[^`]+` are frozen/);
    expect(book?.[0]).toBe(`Files up to and including \`${lastPushed}\` are frozen`);
  });

  it("docs name no office company or its theme", () => {
    const banned = [/coreflex/i, /\bcfs\b/i, /\bcfx\b/i, /architect rulings/i, /\bcona\b/i, /\blifecycle (app|application)\b/i];
    for (const file of CHANGED_DOCS) {
      const text = read(file);
      for (const word of banned) expect({ file, hit: word.test(text) }).toEqual({ file, hit: false });
    }
  });

  it("ARCHITECTURE.md describes the lanes, flows, server-only access and identity adapter", () => {
    const doc = section(read("docs/ARCHITECTURE.md"), /^## Seva Entry/);
    for (const word of ["F1", "F2", "F3", "F4", "createAdminClient", "lib/seva/server/identity.ts", "/seva", "service worker"]) {
      expect({ word, found: doc.includes(word) }).toEqual({ word, found: true });
    }
  });

  it("SECURITY.md covers the seva controls", () => {
    const doc = section(read("docs/SECURITY.md"), /^## Seva Entry/);
    for (const word of [/allow-list/i, /device token/i, /row level security|RLS/i, /audit_log/, /export\.phones_read/, /backup/i, /revoke/i, /rate limit/i, /retired/i]) {
      expect({ word: String(word), found: word.test(doc) }).toEqual({ word: String(word), found: true });
    }
  });

  it("UI-GUIDELINES.md and ADMIN-GUIDELINES.md cover the module", () => {
    const ui = section(read("docs/UI-GUIDELINES.md"), /^## Seva Entry/);
    for (const word of [".seva", "13 px", "Kannada", "prefers-reduced-motion", "380"]) {
      expect({ word, found: ui.includes(word) }).toEqual({ word, found: true });
    }
    const admin = section(read("docs/ADMIN-GUIDELINES.md"), /^## Seva Entry/);
    for (const word of ["/seva", "/seva/counter", "/seva/settings/lists", "/admin/users", "Receptionist", "Prasadam counter", "Temple admin", "Super admin"]) {
      expect({ word, found: admin.includes(word) }).toEqual({ word, found: true });
    }
  });

  it("CHANGELOG.md records Seva Entry", () => {
    const doc = read("docs/CHANGELOG.md");
    expect(doc).toMatch(/Seva Entry/);
    expect(doc).toMatch(/2026-10-\d\d/);
  });
});

describe("docs/seva/README.md runbook", () => {
  const doc = (): string => read("docs/seva/README.md");

  it("has a module map naming the module's folders", () => {
    const map = section(doc(), /^## Module map/);
    for (const folder of ["app/seva", "app/api/seva", "components/seva", "lib/seva", "supabase/migrations", "scripts/seva"]) {
      expect({ folder, found: map.includes(folder) }).toEqual({ folder, found: true });
    }
  });

  it("has every runbook entry", () => {
    const text = doc();
    const headings = [
      /^### .*number gap/im,
      /^### .*Replace a counter PC/im,
      /^### .*Reopen a (closed )?day/im,
      /^### .*Restore drill/im,
      /^### .*printer jams/im,
      /^### .*new migration/im,
      /^### .*demo data/im,
      /^### .*Install the app/im,
      /^### .*paper size/im,
    ];
    for (const heading of headings) expect({ heading: String(heading), found: heading.test(text) }).toEqual({ heading: String(heading), found: true });
    expect(text).toContain("scripts/seva/seed-demo-data.ts");
    expect(text).toMatch(/close the counter page/i);
    expect(text).toContain("npx supabase db push");
  });
});

describe("docs/seva/HANDOVER-NOTES.md", () => {
  const doc = (): string => read("docs/seva/HANDOVER-NOTES.md");

  it("lists every Kannada text the temple office must proof-read, with existing file paths", () => {
    const list = section(doc(), /^## Kannada proof-read list \(O-03\)/);
    for (const word of [/gotra/i, /nakshatra/i, /25/, /26/, /ನಕಲು/, /prasadam/i, /Kanike/, /Karnike/, /receipt/i]) {
      expect({ word: String(word), found: word.test(list) }).toEqual({ word: String(word), found: true });
    }
    const paths = names(/`((?:lib|components|app|scripts|supabase)\/[^`\s]+\.[a-z]+)`/g, list);
    expect(paths.length).toBeGreaterThan(4);
    expect(paths.filter((p) => !existsSync(path.join(ROOT, p)))).toEqual([]);
  });

  it("lists the site owner's issues that also exist on main", () => {
    const issues = section(doc(), /^## Issues for the site owner/);
    for (const word of [/`profiles`/, /connect-src/, /https:\/\/\*\.supabase\.co/, /composite index/i, /zod/i, /applicationDefault\(\)/, /sign-out|sign out/i, /\bmain\b/]) {
      expect({ word: String(word), found: word.test(issues) }).toEqual({ word: String(word), found: true });
    }
  });
});

describe("docs/seva/DESIGN-BOOK.md is brought to the built state", () => {
  const book = (): string => read("docs/seva/DESIGN-BOOK.md");

  it("records the changes after sign-off before section 1", () => {
    const text = book();
    const changes = text.indexOf("## Changes after sign-off");
    expect(changes).toBeGreaterThan(0);
    expect(changes).toBeLessThan(text.indexOf("## 1. Purpose and why"));
    const body = section(text, /^## Changes after sign-off/);
    for (const word of [
      "counter_upi_",
      "settings.upi_changed",
      "export.phones_read",
      "settings.list_item",
      "late_sync",
      "status_changed_at",
      "givenNow",
      "offline_cancels",
      "upi_changed",
      "firestore_id",
      "seva_list_items",
      "/seva",
      "start_url",
      "A6",
      "58 mm",
      "backup.sh",
      "scripts/seva/seed-demo-data.ts",
      "380",
    ]) {
      expect({ word, found: body.includes(word) }).toEqual({ word, found: true });
    }
    expect(body).toMatch(/2026-10-\d\d/);
  });

  it("puts the module's pages at /seva in the sections themselves", () => {
    const text = book();
    expect(text).toMatch(/^### 12\.1 Dashboard \(`\/seva`/m);
    expect(text).toMatch(/^### 12\.3 Receipts register \(`\/seva\/register`\)/m);
    expect(text).toMatch(/^### 12\.4 Reports \(`\/seva\/reports`\)/m);
    // C-40 used to say the pages keep /admin/receipts/*; the old addresses now only forward.
    const c40 = text.split(/\r?\n/).find((line) => line.startsWith("| C-40 "));
    expect(c40).toBeDefined();
    expect(c40).toContain("/seva");
    // The fixed 99 x 210 mm slip is replaced by the configurable paper size.
    expect(section(text, /^## 10\. The printed receipt/)).toMatch(/A5/);
    expect(section(text, /^## 18\. UI system/)).toMatch(/prefers-reduced-motion|reduced motion/);
  });
});

describe("plans and scripts point at the rewritten setup guide", () => {
  it("cite the new section ids, not the old numbers", () => {
    const files = [
      "docs/superpowers/plans/2026-10-18-seva-entry-plan-A-phase1.md",
      "docs/superpowers/plans/2026-10-18-seva-entry-plan-A-phase1-part2.md",
      "docs/superpowers/plans/2026-10-18-seva-entry-plan-C-android.md",
      "scripts/seva/verify-backup.sh",
    ];
    for (const file of files) {
      const stale = read(file)
        .split(/\r?\n/)
        // "SETUP-GUIDE section 3", or a gate checklist line that says only "Read section 4" / "Open section 5".
        .filter((line) => /SETUP-GUIDE(?:\.md`?)? section \d/.test(line) || /\b(?:Read|Open) section \d/i.test(line));
      expect({ file, stale }).toEqual({ file, stale: [] });
    }
  });

  it("Plan B has no stray END OF REPORT line", () => {
    expect(read("docs/superpowers/plans/2026-10-18-seva-entry-plan-B-phase2-web.md")).not.toMatch(/^END OF REPORT\s*$/m);
  });
});
