import { existsSync, readFileSync } from "fs";
import path from "path";

const FILE = path.join(__dirname, "..", "..", "..", "styles", "seva", "tokens.css");

function readCss(): string {
  if (!existsSync(FILE)) throw new Error(`missing ${FILE}`);
  return readFileSync(FILE, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Innermost `selector { declarations }` blocks; at-rule wrappers such as @layer are skipped. */
function rules(css: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) out.push({ selector: m[1].trim(), body: m[2] });
  return out;
}

function pxValues(value: string): number[] {
  return Array.from(value.matchAll(/(-?\d*\.?\d+)px/g), (x) => Number(x[1]));
}

// Every custom property of the approved proto.css v2 (desk/mockups/proto.css, 2026-10-18).
const PROTO_TOKENS = [
  "--background", "--foreground", "--card", "--primary", "--primary-hover", "--primary-press", "--primary-ink",
  "--primary-soft", "--primary-strong", "--primary-foreground", "--secondary", "--secondary-foreground", "--muted",
  "--muted-foreground", "--accent", "--accent-foreground", "--destructive", "--destructive-soft", "--border",
  "--border-strong", "--input", "--focus", "--gold-light", "--saffron", "--link", "--maroon", "--cream", "--sidebar",
  "--ok", "--ok-soft", "--attn-soft", "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5",
  "--shadow-card", "--shadow-raise", "--shadow-overlay", "--scrim", "--font-ui", "--font-serif", "--font-kn",
  "--font-mono", "--text-display", "--text-h1", "--text-h2", "--text-h3", "--text-body-lg", "--text-body",
  "--text-ui", "--text-meta", "--text-micro", "--space-1", "--space-2", "--space-3", "--space-4", "--space-5",
  "--space-6", "--space-8", "--space-10", "--space-12", "--space-16", "--radius-control", "--radius-surface",
  "--radius-pill", "--motion-instant", "--motion-enter",
];

describe("styles/seva/tokens.css", () => {
  it("scopes every token under .seva", () => {
    const css = readCss();
    expect(css).not.toMatch(/:root/);
    const all = rules(css);
    expect(all.length).toBeGreaterThan(0);
    for (const r of all) {
      for (const sel of r.selector.split(",")) expect(sel.trim()).toMatch(/^\.seva\b/);
    }
    const base = all.find((r) => r.selector === ".seva");
    expect(base).toBeDefined();
    for (const name of PROTO_TOKENS) expect(base?.body).toMatch(new RegExp(`${name}\\s*:`));
  });

  it("never sets a font size below 13px", () => {
    const css = readCss();
    const checked: number[] = [];
    for (const r of rules(css)) {
      for (const decl of r.body.split(";")) {
        const i = decl.indexOf(":");
        if (i < 0) continue;
        const prop = decl.slice(0, i).trim();
        if (prop === "font-size" || prop.startsWith("--text-")) {
          for (const px of pxValues(decl.slice(i + 1))) {
            checked.push(px);
            expect(`${prop}: ${px}px`).toBe(px >= 13 ? `${prop}: ${px}px` : `${prop}: >= 13px`);
          }
        }
      }
    }
    expect(checked.length).toBeGreaterThan(0);
  });

  it("keeps the dark set ready but off by default", () => {
    const css = readCss();
    expect(css).toMatch(/\.seva\[data-theme="dark"\]\s*\{/);
    expect(css).not.toMatch(/prefers-color-scheme/);
  });
});
