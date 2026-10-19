/**
 * @jest-environment node
 */
import {
  SEVA_ROUTES,
  isSevaPath,
  prasadamTokenPath,
  receiptPath,
  receiptPrintPath,
  sevaHomePath,
  signInPath,
} from "@/lib/seva/routes";

/** The three addresses that stay outside the module on purpose. */
const OUTSIDE = new Set<keyof typeof SEVA_ROUTES>(["staff", "websiteAdmin", "signIn"]);

describe("Seva Entry addresses (plan A4S-1)", () => {
  it("puts every Seva Entry page under /seva and keeps Staff at /admin/users", () => {
    const entries = Object.entries(SEVA_ROUTES) as [keyof typeof SEVA_ROUTES, string][];
    // The scan must see the module's pages, so an empty object can never pass.
    expect(entries.length).toBeGreaterThan(20);
    for (const [name, href] of entries) {
      if (OUTSIDE.has(name)) continue;
      expect({ name, inside: isSevaPath(href) }).toEqual({ name, inside: true });
    }
    expect(SEVA_ROUTES.dashboard).toBe("/seva");
    expect(SEVA_ROUTES.counter).toBe("/seva/counter");
    expect(SEVA_ROUTES.today).toBe("/seva/counter/today");
    expect(SEVA_ROUTES.dayClose).toBe("/seva/day-close");
    expect(SEVA_ROUTES.dayCloses).toBe("/seva/day-closes");
    expect(SEVA_ROUTES.register).toBe("/seva/register");
    expect(SEVA_ROUTES.reports).toBe("/seva/reports");
    expect(SEVA_ROUTES.reportsFestival).toBe("/seva/reports/festival");
    expect(SEVA_ROUTES.reportsAudit).toBe("/seva/reports/audit");
    expect(SEVA_ROUTES.reportsExport).toBe("/seva/reports/export");
    expect(SEVA_ROUTES.reportsSummary).toBe("/seva/reports/summary");
    expect(SEVA_ROUTES.sevaSettings).toBe("/seva/seva-settings");
    expect(SEVA_ROUTES.settings).toBe("/seva/settings");
    expect(SEVA_ROUTES.settingsReceipt).toBe("/seva/settings/receipt");
    expect(SEVA_ROUTES.settingsCounters).toBe("/seva/settings/counters");
    expect(SEVA_ROUTES.settingsRules).toBe("/seva/settings/rules");
    expect(SEVA_ROUTES.settingsDenominations).toBe("/seva/settings/denominations");
    expect(SEVA_ROUTES.settingsFestivalDays).toBe("/seva/settings/festival-days");
    expect(SEVA_ROUTES.settingsLists).toBe("/seva/settings/lists");
    expect(SEVA_ROUTES.prasadam).toBe("/seva/prasadam");
    expect(SEVA_ROUTES.create).toBe("/seva/create");
    expect(SEVA_ROUTES.staff).toBe("/admin/users");
    expect(SEVA_ROUTES.websiteAdmin).toBe("/admin");
    expect(SEVA_ROUTES.signIn).toBe("/login");
  });

  it("encodes the receipt id in receipt and print addresses", () => {
    expect(receiptPath("a b/c")).toBe("/seva/a%20b%2Fc");
    expect(receiptPrintPath("r1")).toBe("/seva/r1/print");
    expect(receiptPrintPath("a b")).toBe("/seva/a%20b/print");
    expect(prasadamTokenPath("Ab+c/d")).toBe("/seva/prasadam?token=Ab%2Bc%2Fd");
  });

  it("sends a receptionist to the counter, a prasadam volunteer to the prasadam page and everyone else to the dashboard", () => {
    expect(sevaHomePath("receptionist")).toBe("/seva/counter");
    expect(sevaHomePath("prasadam_counter")).toBe("/seva/prasadam");
    expect(sevaHomePath("temple_admin")).toBe("/seva");
    expect(sevaHomePath("super_admin")).toBe("/seva");
    expect(sevaHomePath(null)).toBe("/seva");
    expect(sevaHomePath(undefined)).toBe("/seva");
  });

  it("isSevaPath is true for /seva and below, false for /sevas, /seva-x and /admin/receipts", () => {
    expect(isSevaPath("/seva")).toBe(true);
    expect(isSevaPath("/seva/")).toBe(true);
    expect(isSevaPath("/seva/counter")).toBe(true);
    expect(isSevaPath("/seva/settings/receipt")).toBe(true);
    expect(isSevaPath("/sevas")).toBe(false);
    expect(isSevaPath("/seva-x")).toBe(false);
    expect(isSevaPath("/admin/receipts")).toBe(false);
    expect(isSevaPath("/admin/receipts/counter")).toBe(false);
    expect(isSevaPath("/")).toBe(false);
  });

  it("signInPath carries the page and its query", () => {
    expect(signInPath("/seva/counter?x=1")).toBe("/login?redirect=%2Fseva%2Fcounter%3Fx%3D1");
    expect(signInPath("/seva")).toBe("/login?redirect=%2Fseva");
  });
});
