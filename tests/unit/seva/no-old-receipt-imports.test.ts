/** @jest-environment node */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { SEVA_ROUTES } from "@/lib/seva/routes";

/**
 * The Firestore Receipt Book is retired in the pull request that switches its consumers to Seva Entry (DB §17.2, C-40;
 * plan Task A5-1). Nothing may import the removed modules, the files are gone, the old create page forwards to the
 * counter and the website admin's reports page sends receipts to the seva reports.
 */

const ROOT = path.resolve(__dirname, "../../..");
const SCAN_DIRS = ["app", "components", "services", "lib", "hooks", "types", "tests", "scripts"];
const SELF = "tests/unit/seva/no-old-receipt-imports.test.ts";

/** An import, dynamic import, require or jest.mock of a retired module. `lib/receipt/upi` stays (the counter uses it). */
const RETIRED_IMPORT =
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*|jest\.mock\s*\(\s*)["']@\/(?:lib\/receipt\/(?:admin|numbering|validation|pdf)|services\/receipt(?:Seva)?\.service|types\/receipt(?:Seva|-extensions)?)["']/;

const RETIRED_FILES = [
  "app/api/admin/receipts",
  "app/api/admin/receipt-sevas",
  "lib/receipt/admin.ts",
  "lib/receipt/numbering.ts",
  "lib/receipt/validation.ts",
  "lib/receipt/pdf.ts",
  "services/receipt.service.ts",
  "services/receiptSeva.service.ts",
  "types/receipt.ts",
  "types/receiptSeva.ts",
  "types/receipt-extensions.ts",
  "scripts/seed-receipt-sevas.ts",
  "tests/unit/receipt-numbering.test.ts",
  "tests/unit/receipt-validation.test.ts",
];

function rel(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(name)) out.push(full);
  }
  return out;
}

jest.mock("next/navigation", () => ({
  redirect: jest.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
}));

describe("retired Firestore Receipt Book", () => {
  it("no file imports the retired Receipt Book modules", () => {
    const offenders = SCAN_DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d)))
      .filter((file) => rel(file) !== SELF)
      .filter((file) => RETIRED_IMPORT.test(readFileSync(file, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("the import check recognises each retired module", () => {
    for (const spec of [
      'import { x } from "@/lib/receipt/pdf";',
      "import { x } from '@/services/receiptSeva.service';",
      'import type { Receipt } from "@/types/receipt";',
      'jest.mock("@/lib/receipt/numbering", () => ({}));',
    ]) {
      expect(spec).toMatch(RETIRED_IMPORT);
    }
    expect('import { buildUpiPaymentUrl } from "@/lib/receipt/upi";').not.toMatch(RETIRED_IMPORT);
    expect('import type { X } from "@/types/seva-receipts";').not.toMatch(RETIRED_IMPORT);
  });

  it("the retired files are gone", () => {
    expect(RETIRED_FILES.filter((f) => existsSync(path.join(ROOT, f)))).toEqual([]);
  });

  it("package.json no longer seeds the unread receiptSevas collection", () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts["seed-receipt-sevas"]).toBeUndefined();
  });

  it("the old create page forwards to the counter", async () => {
    const { default: CreatePage } = (await import("@/app/seva/(desk)/create/page")) as { default: () => unknown };
    expect(() => CreatePage()).toThrow(`NEXT_REDIRECT ${SEVA_ROUTES.counter}`);
  });

  it("the website admin's reports page links receipts to the seva reports", () => {
    const page = readFileSync(path.join(ROOT, "app/admin/reports/page.tsx"), "utf8");
    expect(page).toContain("href={SEVA_ROUTES.reports}");
    expect(page).not.toMatch(/receipt_report_|exportReceiptsToCSV/);
  });
});
