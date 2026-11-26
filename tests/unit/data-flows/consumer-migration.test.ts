/**
 * @jest-environment node
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../../..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

describe("Panchanga workflow", () => {
  const yaml = read(".github/workflows/panchanga.yml");

  it("no longer creates or merges a pull request", () => {
    expect(yaml).not.toMatch(/create-pull-request/);
    expect(yaml).not.toMatch(/pull-requests:\s*write/);
    expect(yaml).not.toMatch(/gh pr merge/);
    expect(yaml).not.toMatch(/--auto/);
  });

  it("generates for the Asia/Kolkata date and validates before publishing", () => {
    expect(yaml).toMatch(/TZ=Asia\/Kolkata date \+%F/);
    expect(yaml).toMatch(/publish-panchanga\.ts/);
    expect(yaml).toMatch(/--dry-run/);
    expect(yaml).toMatch(/PANCHANGA_STORAGE_PUBLISH_ENABLED/);
    expect(yaml).toMatch(/guard-approved-supabase-url\.mjs/);
  });

  it("keeps the four existing daily schedules", () => {
    for (const cron of ["30 23 * * *", "30 21 * * *", "30 6 * * *", "30 8 * * *"]) {
      expect(yaml).toContain(cron);
    }
  });

  it("never writes to the database", () => {
    expect(yaml).not.toMatch(/--apply\b/);
    expect(yaml).not.toMatch(/\bpg_|psql|supabase db push/);
  });
});

describe("Aaradhane workflow", () => {
  const yaml = read(".github/workflows/aaradhane.yml");

  it("has a separately gated storage publication job", () => {
    expect(yaml).toMatch(/publish-aaradhane:/);
    expect(yaml).toMatch(/AARADHANE_STORAGE_PUBLISH_ENABLED/);
    expect(yaml).toMatch(/--publish/);
    expect(yaml).toMatch(/guard-approved-supabase-url\.mjs/);
  });

  it("has no database write flag in any step", () => {
    expect(yaml).not.toMatch(/--apply\b/);
  });

  it("binds both jobs that run the generator to the production environment", () => {
    expect((yaml.match(/environment:\s*production/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("Application consumers", () => {
  const files = [
    "components/home/Panchanga.tsx",
    "app/(public)/display/page.tsx",
    "lib/ai/retrieval/panchanga.ts",
    "lib/aaradhane/panchanga.ts",
    "lib/aaradhane/generator.ts",
  ];

  function codeOnly(source: string): string {
    return source
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return (
          !trimmed.startsWith("*") &&
          !trimmed.startsWith("//") &&
          !trimmed.startsWith("/*")
        );
      })
      .join("\n");
  }

  it.each(files)("%s no longer reads the local Panchanga files", (file) => {
    const source = codeOnly(read(file));
    expect(source).not.toMatch(/data\/panchanga/);
    expect(source).not.toMatch(/from ["']fs["']|require\(["']fs["']\)/);
  });

  it("the home widget and display board use the server endpoint", () => {
    for (const file of ["components/home/Panchanga.tsx", "app/(public)/display/page.tsx"]) {
      expect(read(file)).toContain("/api/panchanga/current");
      expect(read(file)).not.toContain("/data/panchanga/current.json");
    }
  });

  it("the AI retrieval path uses the Storage reader", () => {
    const source = read("lib/ai/retrieval/panchanga.ts");
    expect(source).toContain("@/lib/data-flows/server");
    expect(source).toContain("getIstDateString");
    expect(source).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
  });

  it("never imports the service-role client into browser-facing code", () => {
    const browserFacing = [
      "components/home/Panchanga.tsx",
      "app/(public)/display/page.tsx",
    ];
    for (const file of browserFacing) {
      const source = read(file);
      expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(source).not.toContain("@/lib/supabase/admin");
    }
  });
});
