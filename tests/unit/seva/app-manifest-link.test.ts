/**
 * One installable Seva Entry app for every role (owner, 2026-10-20): the module layout links the install manifest, so
 * the app can be installed from any /seva page, and the counter layout no longer links its own copy.
 */
import fs from "fs";
import path from "path";

jest.mock("@/styles/seva/tokens.css", () => ({}));
jest.mock("@/styles/seva/print.css", () => ({}));
jest.mock("@/lib/firebase", () => ({
  getFirebaseConfigStatus: () => ({ isValid: true, missingFields: [] }),
}));

const MANIFEST = "/seva-counter.webmanifest";

describe("the Seva Entry install manifest is linked from every /seva page", () => {
  it("the module layout's metadata names the manifest", async () => {
    const mod = (await import("@/app/seva/layout")) as { metadata?: { manifest?: unknown } };
    expect(mod.metadata?.manifest).toBe(MANIFEST);
  });

  it("the module layout is a server layout (metadata is read only from server components)", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "app/seva/layout.tsx"), "utf8");
    expect(src).not.toMatch(/^\s*["']use client["']/m);
  });

  it("the counter layout does not link a second manifest", async () => {
    const mod = (await import("@/app/seva/(counter)/counter/layout")) as { metadata?: { manifest?: unknown } };
    expect(mod.metadata?.manifest).toBeUndefined();
  });

  it("the file the layout links exists in public/", () => {
    expect(fs.existsSync(path.join(process.cwd(), "public", MANIFEST))).toBe(true);
  });
});
