// Wiring guard: every protected AI API route must authenticate via the shared
// `requireAdminUser` helper and must not reintroduce ad-hoc `verifyAdminUser`
// checks that return a blanket 401 without diagnostics.

import fs from "fs";
import path from "path";

const PROTECTED_ROUTES = [
  "app/api/ai/settings/route.ts",
  "app/api/ai/settings/temple-information/route.ts",
  "app/api/ai/settings/visitor-information/route.ts",
  "app/api/ai/settings/policies/route.ts",
  "app/api/ai/settings/ai-responses/route.ts",
  "app/api/ai/settings/ai-behavior/route.ts",
  "app/api/ai/settings/prompts/route.ts",
  "app/api/ai/settings/intents/route.ts",
  "app/api/ai/settings/unknown-questions/route.ts",
  "app/api/seed-ai-settings/route.ts",
  "app/api/ai/health/route.ts",
];

describe("protected AI API route authentication wiring", () => {
  it.each(PROTECTED_ROUTES)("%s uses requireAdminUser", (route) => {
    const fullPath = path.join(process.cwd(), route);
    const source = fs.readFileSync(fullPath, "utf8");
    expect(source).toContain("requireAdminUser");
    expect(source).toContain('from "@/lib/auth/admin-auth"');
    // No hand-rolled unauthorized responses.
    expect(source).not.toMatch(/error: "Unauthorized"/);
    expect(source).not.toContain("verifyAdminUser");
  });

  it("the AI health endpoint is read-only and performs no writes", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/api/ai/health/route.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/\.insert\(/);
    expect(source).not.toMatch(/\.update\(/);
    expect(source).not.toMatch(/\.upsert\(/);
    expect(source).not.toMatch(/\.delete\(/);
  });

  it("the seed endpoint preserves existing values (only updates missing columns)", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/api/seed-ai-settings/route.ts"),
      "utf8"
    );
    // It must read the existing row before deciding what to repair.
    expect(source).toContain("maybeSingle");
    expect(source).toContain("isEmptyValue");
  });

  it("the authenticated temple-information GET is not publicly cacheable", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/api/ai/settings/temple-information/route.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/Cache-Control":\s*"public/);
    expect(source).not.toMatch(/s-maxage/);
  });
});
