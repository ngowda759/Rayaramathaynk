/**
 * The setup guide (docs/seva/SETUP-GUIDE.md, Plan A task A2-9, rewritten in GUIDE-FIX on 2026-10-19) is read as text.
 * Part A is the developer's own free test accounts; Part B is for the site owner after the pull request is merged.
 * Both readers have never used these platforms, so the guide must be click-by-click: numbered steps, "What you should
 * see now" lines, a way to say each section is done, and never a request to paste a secret into chat.
 */
import { existsSync, readFileSync } from "fs";
import path from "path";

const FILE = path.join(__dirname, "..", "..", "..", "docs", "seva", "SETUP-GUIDE.md");

const HEADINGS: Record<string, string> = {
  "0": "## 0. Start here",
  A: "## Part A - Your own test setup (you do these)",
  A1: "## A1. Your Supabase test project",
  A2: "## A2. Your Firebase test project",
  A3: "## A3. Seeing the test site: on this PC or on your phone",
  A4: "## A4. Cashfree test account and Expo account (later)",
  A5: "## A5. The counter PC (for go-live at the temple)",
  B: "## Part B - For the site owner (after the pull request is merged)",
  B1: "## B1. Supabase: add the new tables",
  B2: "## B2. Firebase: publish the new rules",
  B3: "## B3. Replace and revoke the old Firebase key",
  B4: "## B4. Vercel settings for the live website",
  B5: "## B5. Make yourself staff 001",
  B6: "## B6. The backup key",
  B7: "## B7. GitHub secrets on your repository",
  B8: "## B8. Restore drill (once a month)",
  B9: "## B9. Cashfree live (later)",
};
const ORDER = Object.keys(HEADINGS);

/** Sections with click-by-click steps; A4 and B9 are outlines that Plans B and C write in full. */
const HANDS_ON = ["A1", "A2", "A3", "A5", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8"];

function readGuide(): string {
  if (!existsSync(FILE)) throw new Error(`missing ${FILE}`);
  return readFileSync(FILE, "utf8");
}

/** Body of a section: from its heading to the next level-2 heading (or the end). */
function section(text: string, id: string): string {
  const heading = HEADINGS[id];
  const start = text.indexOf(heading);
  if (start < 0) throw new Error(`missing heading ${heading}`);
  const rest = text.slice(start + heading.length);
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
}

describe("docs/seva/SETUP-GUIDE.md", () => {
  it("has Start here, Part A and Part B sections in order", () => {
    const text = readGuide();
    const level2 = text.split(/\r?\n/).filter((line) => /^## /.test(line));
    expect(level2.slice(0, ORDER.length)).toEqual(ORDER.map((id) => HEADINGS[id]));
  });

  it("gives exactly one next step in Start here, and it is A1", () => {
    const s0 = section(readGuide(), "0");
    const next = s0.slice(s0.indexOf("### 0.2 Do this next"), s0.indexOf("### 0.3"));
    expect(next).toContain("A1. Your Supabase test project");
    expect(next).not.toMatch(/\b(A[2-5]|B\d)\b/);
  });

  it("says who does every section in the Start here table", () => {
    const s0 = section(readGuide(), "0");
    for (const id of ORDER.filter((key) => /^[AB]\d$/.test(key))) {
      expect(s0).toMatch(new RegExp(`^\\| ${id}\\. [^|]+\\| (You|Site owner|Whoever)`, "m"));
    }
  });

  it("cites a checked vendor source in every account section", () => {
    const text = readGuide();
    for (const id of ["A1", "A2", "A3", "A5", "B1", "B2", "B3", "B4", "B6", "B7", "B8"]) {
      expect(section(text, id)).toMatch(/\(source: https?:\/\/[^)]+, checked 2026-\d\d-\d\d\)/);
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

  it("states the writing rules and the secrets rule in Start here", () => {
    const s0 = section(readGuide(), "0");
    expect(s0).toContain("UNVERIFIED");
    expect(s0).toContain("What you should see now");
    expect(s0).toMatch(/never paste/i);
    expect(s0).toContain("D:\\Onboarding\\Repos\\POCs\\seva-entry");
    expect(s0).toContain(".env.local");
  });

  it("never assumes access to the site owner's accounts in Part A", () => {
    const text = readGuide();
    const partA = ["A1", "A2", "A3", "A5"].map((id) => section(text, id)).join("\n");
    expect(partA).not.toMatch(/ngowda759/);
    expect(partA).not.toMatch(/\blive (temple )?project\b/i);
  });

  it("writes every hands-on section as numbered steps with what the reader should see", () => {
    const text = readGuide();
    for (const id of HANDS_ON) {
      const body = section(text, id);
      expect(body).toMatch(/^\s*1\. /m);
      expect(body).toMatch(/^\s*2\. /m);
      expect(body).toContain("What you should see now");
      expect(body).toMatch(/\*\*[^*]+\*\*/); // button and menu names in bold
    }
  });

  it("ends every hands-on section with how the reader says it is done", () => {
    const text = readGuide();
    for (const id of HANDS_ON) {
      const body = section(text, id).trimEnd();
      const tail = body.slice(body.lastIndexOf("### "));
      const heading = id.startsWith("A") ? /^### Tell me it is done/ : /^### Tell Nikhil it is done/;
      expect(tail).toMatch(heading);
      expect(tail).toMatch(new RegExp(`Section ${id} done`));
    }
  });

  it("never asks the reader to paste a secret into chat", () => {
    const lines = readGuide().split(/\r?\n/);
    // A line that mentions chat together with pasting, copying, sending or typing must either say never/not, or be the
    // fixed "Section ... done" message (which carries no secret).
    const askingToPasteInChat = lines.filter(
      (line) =>
        /\b(paste|copy|send|share|type)\b/i.test(line) &&
        /\bchat\b/i.test(line) &&
        !/\b(never|not|no)\b/i.test(line) &&
        !/Section [AB]?\d done/.test(line),
    );
    expect(askingToPasteInChat).toEqual([]);
  });

  it("keeps the Cashfree and Expo parts as outlines for Plans B and C", () => {
    const text = readGuide();
    expect(section(text, "A4")).toContain("Written in Plan B");
    expect(section(text, "A4")).toContain("Written in Plan C");
    expect(section(text, "B9")).toContain("Written in Plan B");
  });
});
