/**
 * The owner's setup guide (docs/seva/SETUP-GUIDE.md, Plan A task A2-9) is read as text.
 * The owner has never used these platforms, so besides the plan's four checks the guide must be click-by-click:
 * numbered steps, "You should now see" lines, a way to tell the builder each section is done, and never a request
 * to paste a secret into chat.
 */
import { existsSync, readFileSync } from "fs";
import path from "path";

const FILE = path.join(__dirname, "..", "..", "..", "docs", "seva", "SETUP-GUIDE.md");

const HEADINGS = [
  "## 0. How to use this guide",
  "## 1. Supabase test project for the build",
  "## 2. Vercel access and settings",
  "## 3. Revoke the old Firebase key",
  "## 4. Backup secrets and the age key",
  "## 5. Restore drill (once a month)",
  "## 6. Local database tests need no set-up",
  "## 7. The counter PC",
  "## 8. Cashfree test account (Phase 2)",
  "## 9. Expo account (Android app)",
];

/** Sections the owner works through now (Plan A); 8 and 9 are placeholders for Plans B and C. */
const HANDS_ON = [1, 2, 3, 4, 5, 7];

function readGuide(): string {
  if (!existsSync(FILE)) throw new Error(`missing ${FILE}`);
  return readFileSync(FILE, "utf8");
}

/** Body of section n: from its heading to the next level-2 heading (or the end). */
function section(text: string, n: number): string {
  const start = text.indexOf(HEADINGS[n]);
  if (start < 0) throw new Error(`missing heading ${HEADINGS[n]}`);
  const rest = text.slice(start + HEADINGS[n].length);
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
}

describe("docs/seva/SETUP-GUIDE.md", () => {
  it("has the ten sections in order", () => {
    const text = readGuide();
    const level2 = text.split(/\r?\n/).filter((line) => /^## /.test(line));
    expect(level2.slice(0, HEADINGS.length)).toEqual(HEADINGS);
  });

  it("cites a checked vendor source in sections 1 to 4", () => {
    const text = readGuide();
    for (const n of [1, 2, 3, 4]) {
      expect(section(text, n)).toMatch(/\(source: https?:\/\/[^)]+, checked 2026-\d\d-\d\d\)/);
    }
  });

  it("contains no secret material", () => {
    const text = readGuide();
    expect(text).not.toContain("PRIVATE KEY");
    expect(text).not.toContain("AGE-SECRET-KEY");
    expect(text).not.toContain("eyJ");
  });

  it("names no office company or its theme", () => {
    const text = readGuide();
    // Boundary words from $STATE/briefs/RULES.md.
    const banned = [/coreflex/i, /\bcfs\b/i, /\bcfx\b/i, /architect rulings/i, /\bcona\b/i, /lifecycle/i];
    for (const word of banned) expect(text).not.toMatch(word);
  });

  it("states the writing rules in section 0", () => {
    const s0 = section(readGuide(), 0);
    expect(s0).toContain("UNVERIFIED");
    expect(s0).toContain("You should now see");
    expect(s0).toMatch(/never paste/i);
  });

  it("writes every hands-on section as numbered steps with what the owner should see", () => {
    const text = readGuide();
    for (const n of HANDS_ON) {
      const body = section(text, n);
      expect(body).toMatch(/^\s*1\. /m);
      expect(body).toMatch(/^\s*2\. /m);
      expect(body).toContain("You should now see");
      expect(body).toMatch(/\*\*[^*]+\*\*/); // button and menu names in bold
    }
  });

  it("ends every hands-on section with how the owner tells the builder it is done", () => {
    const text = readGuide();
    for (const n of [...HANDS_ON, 6]) {
      const body = section(text, n).trimEnd();
      const tail = body.slice(body.lastIndexOf("### "));
      expect(tail).toMatch(/^### Tell me it is done/);
      expect(tail).toMatch(new RegExp(`Section ${n} done`));
    }
  });

  it("never asks the owner to paste a secret into chat", () => {
    const lines = readGuide().split(/\r?\n/);
    // A line that mentions chat together with pasting, copying, sending or typing must either say never/not, or be the
    // fixed "Section n done" message (which carries no secret).
    const askingToPasteInChat = lines.filter(
      (line) =>
        /\b(paste|copy|send|share|type)\b/i.test(line) &&
        /\bchat\b/i.test(line) &&
        !/\b(never|not|no)\b/i.test(line) &&
        !/Section \d done/.test(line),
    );
    expect(askingToPasteInChat).toEqual([]);
  });

  it("keeps sections 8 and 9 as placeholders for Plans B and C", () => {
    const text = readGuide();
    expect(section(text, 8)).toContain("Written in Plan B");
    expect(section(text, 9)).toContain("Written in Plan C");
  });
});
