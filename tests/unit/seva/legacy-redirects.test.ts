/**
 * @jest-environment node
 */
import fs from "node:fs";
import path from "node:path";

import nextConfig from "@/next.config";
import { SEVA_ROUTES } from "@/lib/seva/routes";

const ROOT = path.resolve(__dirname, "../../..");

/** Every page the module had before the move (plan A4S-1), with `[receiptId]` as a segment. */
const OLD_PAGES = [
  "/admin/receipts",
  "/admin/receipts/[receiptId]",
  "/admin/receipts/[receiptId]/print",
  "/admin/receipts/counter",
  "/admin/receipts/counter/today",
  "/admin/receipts/create",
  "/admin/receipts/day-close",
  "/admin/receipts/day-closes",
  "/admin/receipts/register",
  "/admin/receipts/reports",
  "/admin/receipts/reports/audit",
  "/admin/receipts/reports/export",
  "/admin/receipts/reports/festival",
  "/admin/receipts/reports/summary",
  "/admin/receipts/settings",
  "/admin/receipts/settings/counters",
  "/admin/receipts/settings/denominations",
  "/admin/receipts/settings/festival-days",
  "/admin/receipts/settings/lists",
  "/admin/receipts/settings/receipt",
  "/admin/receipts/settings/rules",
  "/admin/receipts/seva-settings",
  "/admin/prasadam",
] as const;

interface Rule {
  source: string;
  destination: string;
}

/** Applies the first matching rule the way Next does for these simple patterns (`:path+` is one or more segments). */
function forward(rules: readonly Rule[], pathname: string): string | null {
  for (const rule of rules) {
    const pattern = new RegExp(`^${rule.source.replace(":path+", "(.+)")}$`);
    const match = pattern.exec(pathname);
    if (match) return rule.destination.replace(":path+", match[1] ?? "");
  }
  return null;
}

/** The address of every page.tsx under app/seva, with `(group)` folders dropped. */
function sevaPageAddresses(): Set<string> {
  const found = new Set<string>();
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "page.tsx") {
        const segments = path
          .relative(path.join(ROOT, "app"), dir)
          .split(path.sep)
          .filter((segment) => !/^\(.*\)$/.test(segment));
        found.add(`/${segments.join("/")}`);
      }
    }
  }
  walk(path.join(ROOT, "app", "seva"));
  return found;
}

describe("forwarding from the old Receipt Book addresses (plan A4S-1)", () => {
  it("forwards /admin/receipts and every page below it to the same page under /seva, temporarily", async () => {
    expect(typeof nextConfig.redirects).toBe("function");
    const rules = await nextConfig.redirects!();
    expect(rules).toEqual([
      { source: "/admin/receipts", destination: SEVA_ROUTES.dashboard, permanent: false },
      { source: "/admin/receipts/:path+", destination: `${SEVA_ROUTES.dashboard}/:path+`, permanent: false },
      { source: "/admin/prasadam", destination: SEVA_ROUTES.prasadam, permanent: false },
    ]);
  });

  it("every page that was under /admin/receipts or /admin/prasadam has a page at its forwarded address", async () => {
    const rules = (await nextConfig.redirects!()) as Rule[];
    const pages = sevaPageAddresses();
    // The scan must see the module's pages, so an empty folder can never pass.
    expect(pages.size).toBeGreaterThanOrEqual(OLD_PAGES.length);
    const lost = OLD_PAGES.map((old) => ({ old, forwarded: forward(rules, old) })).filter(
      ({ forwarded }) => forwarded === null || !pages.has(forwarded),
    );
    expect(lost).toEqual([]);
    expect(forward(rules, "/admin/receipts/2b1c9a3e-0000-4000-8000-000000000001/print")).toBe(
      "/seva/2b1c9a3e-0000-4000-8000-000000000001/print",
    );
    expect(forward(rules, "/admin/receiptsx")).toBeNull();
  });

  it("keeps the security headers on every path", async () => {
    expect(typeof nextConfig.headers).toBe("function");
    const groups = await nextConfig.headers!();
    expect(groups).toHaveLength(1);
    expect(groups[0]?.source).toBe("/:path*");
    const keys = (groups[0]?.headers ?? []).map((header) => header.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Strict-Transport-Security",
        "X-Frame-Options",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "Content-Security-Policy",
      ]),
    );
  });
});
