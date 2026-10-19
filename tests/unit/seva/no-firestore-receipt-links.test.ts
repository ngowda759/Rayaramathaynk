/** @jest-environment node */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Receipt pages read Supabase receipts by their uuid (A4-4), so no screen may still link to `/admin/receipts/<id>`
 * with an id from the old Firestore receipt list: such a link opens the Supabase API with a Firestore id and shows an
 * error. `/admin/receipts` no longer shows that list; the receipts register at `/admin/receipts/register` replaces it
 * (DB §12.3, §17.1). Owner's security review, added to Task A4-7.
 */

const ROOT = path.resolve(__dirname, "../../..");
const SCREEN_DIRS = ["app", "components"];
const FIRESTORE_RECEIPT_IMPORTS = ['"@/services/receipt.service"', "'@/services/receipt.service'", '"@/types/receipt"', "'@/types/receipt'"];
/** A link or navigation to one receipt's page built from a variable: `/admin/receipts/${...}`. */
const RECEIPT_LINK = /\/admin\/receipts\/\$\{/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (path.relative(ROOT, full).split(path.sep).join("/") === "app/api") continue;
      out.push(...sourceFiles(full));
    } else if (/\.(tsx|ts)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function rel(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

describe("no screen links to Firestore receipt ids", () => {
  const files = SCREEN_DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d)));

  it("the Receipt Book home no longer lists Firestore receipts", () => {
    const home = readFileSync(path.join(ROOT, "app/seva/(desk)/page.tsx"), "utf8");
    for (const spec of FIRESTORE_RECEIPT_IMPORTS) expect(home).not.toContain(spec);
    expect(home).not.toMatch(RECEIPT_LINK);
  });

  it("no screen that reads Firestore receipts links to a receipt page", () => {
    const offenders = files
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return FIRESTORE_RECEIPT_IMPORTS.some((spec) => text.includes(spec)) && RECEIPT_LINK.test(text);
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("the receipts register exists where the old list's readers are sent", () => {
    expect(files.map(rel)).toContain("app/seva/(desk)/register/page.tsx");
  });
});
