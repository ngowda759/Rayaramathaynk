/**
 * @jest-environment node
 *
 * F-A16-04 (`seva_list_items`) and F-A16-05 (Supabase Storage) — source guards.
 *
 * Both findings are about access that must stay closed:
 *
 *   - F-A16-04: the audit found `seva_list_items` with RLS enabled and zero policies.
 *     The repository evidence (migration + application code) shows that is
 *     *intentional*: every read and write goes through `service_role` functions, so
 *     the correct remediation is "document and pin", not "add a permissive policy".
 *     These tests pin the closed posture so a later edit cannot open the table.
 *   - F-A16-05: the audit found one private Storage bucket with no policies and no
 *     objects. The repository uses Vercel Blob for all media (`services/storage.
 *     service.ts`), never `supabase.storage`, so there is no application requirement
 *     that would justify a Storage policy. These tests pin that no Supabase Storage
 *     API is used, so a bucket policy cannot be "needed" later without this failing.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");

/** Every file under `dir`, recursively, with the given extensions. */
function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, exts, acc);
    else if (exts.some((e) => entry.endsWith(e))) acc.push(full);
  }
  return acc;
}

describe("F-A16-04 seva_list_items is intentionally backend-only", () => {
  const listsSql = readFileSync(
    path.join(MIGRATIONS_DIR, "20261030000000_seva_lists.sql"),
    "utf8"
  );

  it("enables RLS on the table", () => {
    expect(listsSql).toMatch(/ALTER TABLE seva_list_items ENABLE ROW LEVEL SECURITY/i);
  });

  it("creates NO policy on the table (the audit's zero-policy finding is by design)", () => {
    // A permissive policy must never be added just to make the table reachable. The
    // functions below are the only access path.
    expect(listsSql).not.toMatch(/CREATE POLICY[\s\S]{0,200}?ON\s+seva_list_items/i);
  });

  it("grants anon/authenticated nothing on the table", () => {
    expect(listsSql).toMatch(
      /REVOKE ALL ON TABLE seva_list_items FROM PUBLIC, anon, authenticated, service_role/i
    );
    // The only GRANT names service_role.
    const grants = listsSql.match(/GRANT [^;]*ON TABLE seva_list_items[^;]*;/gi) ?? [];
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatch(/TO service_role/i);
    expect(grants[0]).not.toMatch(/anon|authenticated|PUBLIC/i);
  });

  it("does not grant TRIGGER or REFERENCES to any role on the table", () => {
    expect(listsSql).toMatch(
      /REVOKE TRIGGER, REFERENCES ON TABLE seva_list_items FROM service_role, anon, authenticated/i
    );
  });

  it("keeps every access function executable only by service_role", () => {
    for (const fn of ["seva_list_items_guard", "seva_list_items_get"]) {
      expect(listsSql).toMatch(
        new RegExp(`REVOKE EXECUTE ON FUNCTION ${fn}\\(\\) FROM PUBLIC, anon, authenticated`, "i")
      );
      expect(listsSql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION ${fn}\\(\\) TO service_role`, "i"));
    }
    expect(listsSql).toMatch(
      /REVOKE EXECUTE ON FUNCTION seva_list_item_save\(jsonb, uuid\) FROM PUBLIC, anon, authenticated/i
    );
    expect(listsSql).toMatch(
      /GRANT EXECUTE ON FUNCTION seva_list_item_save\(jsonb, uuid\) TO service_role/i
    );
  });

  it("no migration anywhere creates a policy on seva_list_items", () => {
    const offenders = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .filter((f) =>
        /CREATE POLICY[\s\S]{0,300}?ON\s+seva_list_items/i.test(
          readFileSync(path.join(MIGRATIONS_DIR, f), "utf8")
        )
      );
    expect(offenders).toEqual([]);
  });

  it("application code reaches the table only through the service-role RPC layer", () => {
    const appFiles = walk(path.join(ROOT, "app"), [".ts", ".tsx"]).concat(
      walk(path.join(ROOT, "services"), [".ts", ".tsx"]),
      walk(path.join(ROOT, "lib"), [".ts", ".tsx"]),
      walk(path.join(ROOT, "components"), [".ts", ".tsx"])
    );
    const directTableRefs = appFiles.filter((f) =>
      /from\(\s*["']seva_list_items["']\s*\)/.test(readFileSync(f, "utf8"))
    );
    expect(directTableRefs).toEqual([]);
  });
});

describe("F-A16-05 no Supabase Storage usage (media is on Vercel Blob)", () => {
  it("no application file calls the Supabase Storage API", () => {
    const files = [
      ...walk(path.join(ROOT, "app"), [".ts", ".tsx"]),
      ...walk(path.join(ROOT, "services"), [".ts", ".tsx"]),
      ...walk(path.join(ROOT, "lib"), [".ts", ".tsx"]),
      ...walk(path.join(ROOT, "components"), [".ts", ".tsx"]),
      ...walk(path.join(ROOT, "scripts"), [".ts", ".mjs"]),
    ];
    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return /\.storage\s*\.\s*from\(/.test(src) || /createBucket\s*\(/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it("media upload/display goes through the Vercel Blob storage service", () => {
    const storage = readFileSync(path.join(ROOT, "services", "storage.service.ts"), "utf8");
    expect(storage).toMatch(/from\s+["']@vercel\/blob["']/);
  });
});
