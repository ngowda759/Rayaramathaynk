/**
 * @jest-environment node
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const SEVA_ROUTE_ROOTS = ["app/seva"];

/** Every folder under `dir` (itself included) that holds a page.tsx: a route someone can open. */
function routeFolders(dir: string): string[] {
  const found: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  if (entries.some((e) => e.isFile() && e.name === "page.tsx")) found.push(dir);
  for (const e of entries) {
    if (e.isDirectory()) found.push(...routeFolders(path.join(dir, e.name)));
  }
  return found;
}

describe("seva loading states", () => {
  it("every route folder under app/seva has a loading.tsx", () => {
    const folders = SEVA_ROUTE_ROOTS.flatMap((root) => routeFolders(path.join(ROOT, root)));
    // The scan itself must see the known screens, so an empty result can never pass.
    expect(folders.length).toBeGreaterThan(15);
    const missing = folders
      .filter((dir) => !fs.existsSync(path.join(dir, "loading.tsx")))
      .map((dir) => path.relative(ROOT, dir).split(path.sep).join("/"));
    expect(missing).toEqual([]);
  });

  it("each loading.tsx shows the module's page skeleton", () => {
    const folders = SEVA_ROUTE_ROOTS.flatMap((root) => routeFolders(path.join(ROOT, root)));
    for (const dir of folders) {
      const file = path.join(dir, "loading.tsx");
      if (!fs.existsSync(file)) continue;
      expect(fs.readFileSync(file, "utf8")).toContain("PageSkeleton");
    }
  });
});
