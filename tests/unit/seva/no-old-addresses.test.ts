/** @jest-environment node */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Seva Entry moved from `/admin/receipts` and `/admin/prasadam` to `/seva` (plan A4S). Only two places may still name
 * the old addresses: the forwarding rules in `next.config.ts` and the clean-up of the counter's old service worker.
 * `/api/admin/receipts` is the old Firestore API (removed in A5-1), not a page address, so it is ignored here.
 */

const ROOT = path.resolve(__dirname, "../../..");
const SCANNED_DIRS = ["app", "components", "lib", "hooks", "services", "context", "types", "public"];
const ALLOWED = new Set(["next.config.ts", "components/seva/counter/RegisterServiceWorker.tsx"]);
const TEXT_FILE = /\.(tsx?|jsx?|mjs|cjs|json|webmanifest|css|html|md|txt|svg|xml)$/;
const OLD_ADDRESS = /\/admin\/(receipts|prasadam)/;
const FIRESTORE_API = /\/api\/admin\/receipts/g;

function trackedFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "-z", "--", ...SCANNED_DIRS], { cwd: ROOT, encoding: "utf8" });
  return out.split("\0").filter((file) => file.length > 0 && TEXT_FILE.test(file));
}

describe("no old Seva Entry addresses", () => {
  it("no source file names /admin/receipts or /admin/prasadam except the forwarding rules and the old worker clean-up", () => {
    const files = trackedFiles();
    expect(files.length).toBeGreaterThan(100);
    const offenders: string[] = [];
    for (const file of files) {
      if (ALLOWED.has(file)) continue;
      const lines = readFileSync(path.join(ROOT, file), "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (OLD_ADDRESS.test(line.replace(FIRESTORE_API, ""))) offenders.push(`${file}:${index + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("the check finds an old address when one is present", () => {
    expect(OLD_ADDRESS.test("href='/admin/receipts/register'".replace(FIRESTORE_API, ""))).toBe(true);
    expect(OLD_ADDRESS.test("router.push('/admin/prasadam')".replace(FIRESTORE_API, ""))).toBe(true);
    expect(OLD_ADDRESS.test('const BASE_URL = "/api/admin/receipts";'.replace(FIRESTORE_API, ""))).toBe(false);
  });
});
