import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

import { DEFAULT_FOOTER_SETTINGS } from "@/lib/settings/footer";

const ROOT = process.cwd();

// Assembled from parts so this guard itself never reintroduces the literal.
const OLD_NUMBER = ["98863", "64462"].join("");
const OLD_VPA = `${OLD_NUMBER}@ptsbi`;
const OLD_VPA_ENCODED = `${OLD_NUMBER}%40ptsbi`;
const NEW_NUMBER_DISPLAY = "+91 81234 70770";

/**
 * Runtime source only. Historical audit records under `docs/` and `.claude/state/`
 * keep the old value as evidence of what was true at the time (marked resolved);
 * they are not active configuration and are not scanned here.
 */
const SOURCE_ROOTS = ["app", "components", "lib", "services", "hooks", "types", "scripts", "public", "supabase"];

function walk(dir: string, offenders: string[], needles: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, offenders, needles);
    } else if (/\.(tsx?|jsx?|json|sql|md|css|ya?ml)$/.test(entry)) {
      const source = readFileSync(full, "utf8");
      if (needles.some((needle) => source.includes(needle))) offenders.push(full);
    }
  }
}

describe("temple contact number", () => {
  it("publishes the new number in the shared footer settings", () => {
    expect(DEFAULT_FOOTER_SETTINGS.phone).toBe(NEW_NUMBER_DISPLAY);
  });

  it("renders the new number without spaces in tel: links", () => {
    expect(DEFAULT_FOOTER_SETTINGS.phone.replace(/\s/g, "")).toBe("+918123470770");
  });

  it("uses the new number as the admin editor placeholder", () => {
    const admin = readFileSync(join(ROOT, "app", "admin", "settings", "footer", "page.tsx"), "utf8");
    expect(admin).toContain(NEW_NUMBER_DISPLAY);
  });

  it("keeps the contact details editable through the stored settings document", () => {
    const footer = readFileSync(join(ROOT, "components", "layout", "Footer.tsx"), "utf8");
    expect(footer).toContain('useSettingsDocument(\n    "footer"');
    const hook = readFileSync(join(ROOT, "hooks", "useSettingsDocument.ts"), "utf8");
    expect(hook).toContain("/api/public/settings/${key}");
  });
});

describe("obsolete contact number", () => {
  it("appears nowhere in the runtime source tree", () => {
    const offenders: string[] = [];
    for (const root of SOURCE_ROOTS) walk(join(ROOT, root), offenders, [OLD_NUMBER]);
    expect(offenders).toEqual([]);
  });

  it("leaves no old UPI VPA in any source file", () => {
    const offenders: string[] = [];
    for (const root of SOURCE_ROOTS) walk(join(ROOT, root), offenders, [OLD_VPA, OLD_VPA_ENCODED]);
    expect(offenders).toEqual([]);
  });
});

describe("UPI payment configuration", () => {
  const seva = readFileSync(join(ROOT, "components", "home", "SevaBooking.tsx"), "utf8");
  const donation = readFileSync(join(ROOT, "components", "home", "DonationForm.tsx"), "utf8");
  const upi = readFileSync(join(ROOT, "lib", "receipt", "upi.ts"), "utf8");

  it("has no built-in default UPI id", () => {
    expect(upi).not.toMatch(/DEFAULT_UPI_ID/);
    expect(upi).not.toContain(OLD_VPA);
  });

  it("seva payment copies the UPI id from the finance settings", () => {
    expect(seva).toContain("configuredUpiId(upiDetails?.id)");
    expect(seva).not.toMatch(/upiDetails\?\.id \|\|/);
    expect(seva).toContain("UPI is not configured yet");
  });

  it("donation payment builds its link from the finance settings", () => {
    expect(donation).toContain("configuredUpiId(upiDetails?.id)");
    expect(donation).toContain("buildUpiPaymentUrl({");
    expect(donation).not.toMatch(/upiDetails\?\.id \|\|/);
    expect(donation).toContain("UPI is not configured yet");
  });

  it("tells the devotee when UPI is enabled but not configured", () => {
    expect(seva).toContain("UPI payments are not configured yet");
    expect(donation).toContain("UPI payments are not configured yet");
  });
});
