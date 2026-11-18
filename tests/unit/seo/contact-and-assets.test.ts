import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

import { DEFAULT_FOOTER_SETTINGS } from "@/lib/settings/footer";

const ROOT = process.cwd();

/** Files that must never link to the removed `/images/temple-hero.jpg` asset again. */
const ASSET_SOURCE_FILES = [
  join(ROOT, "app", "(public)", "live", "page.tsx"),
  join(ROOT, "components", "festival", "FestivalLiveUpdates.tsx"),
];

describe("shared footer settings", () => {
  it("carries the contact fields the public contact page renders", () => {
    expect(DEFAULT_FOOTER_SETTINGS.address).toBeTruthy();
    expect(DEFAULT_FOOTER_SETTINGS.phone).toBeTruthy();
    expect(DEFAULT_FOOTER_SETTINGS.email).toMatch(/@/);
  });

  it("is the single source the Footer component imports", () => {
    const footer = readFileSync(join(ROOT, "components", "layout", "Footer.tsx"), "utf8");
    expect(footer).toContain("DEFAULT_FOOTER_SETTINGS");
    // The old inline copy of the defaults must be gone.
    expect(footer).not.toMatch(/const defaultData/);
  });

  it("is the single source the admin footer editor imports", () => {
    const admin = readFileSync(join(ROOT, "app", "admin", "settings", "footer", "page.tsx"), "utf8");
    expect(admin).toContain("DEFAULT_FOOTER_SETTINGS");
    // The admin page must not keep its own inline copy of the contact data.
    expect(admin).not.toMatch(/ngowda759@gmail\.com/);
  });
});

describe("public /contact route", () => {
  it("exists as a page under the public route group", () => {
    expect(existsSync(join(ROOT, "app", "(public)", "contact", "page.tsx"))).toBe(true);
  });

  it("reuses the footer settings document and the existing /api/contact route", () => {
    const client = readFileSync(join(ROOT, "components", "contact", "ContactClient.tsx"), "utf8");
    expect(client).toContain('"footer"');
    expect(client).toContain("/api/contact");
  });
});

describe("temple hero asset", () => {
  it("points every reference at an existing repository asset", () => {
    for (const file of ASSET_SOURCE_FILES) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("/images/temple-hero.jpg");
      expect(source).toContain("/images/Hero.jpg");
    }
    expect(existsSync(join(ROOT, "public", "images", "Hero.jpg"))).toBe(true);
  });

  it("leaves no reference to the missing asset anywhere in tracked source", () => {
    const roots = ["app", "components", "lib", "services", "hooks"].map((dir) => join(ROOT, dir));
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (/\.(tsx?|jsx?)$/.test(entry)) {
          if (readFileSync(full, "utf8").includes("/images/temple-hero.jpg")) offenders.push(full);
        }
      }
    };
    roots.forEach(walk);
    expect(offenders).toEqual([]);
  });
});
