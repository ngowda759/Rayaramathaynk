// Wiring guard: every protected AI API route must authenticate via the shared
// `requireRayaAdminUser` helper (Supabase Auth) and must not reintroduce ad-hoc
// checks that return a blanket 401 without diagnostics.
//
// Raya AI administration uses Supabase Auth. The temple's other admin pages
// still use Firebase (`lib/auth/admin-auth.ts`); this guard exists so the AI
// routes cannot silently drift back onto the Firebase path.

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
  "app/api/ai/analytics/route.ts",
  "app/api/ai/analytics/health/route.ts",
  "app/api/ai/analytics/latency/route.ts",
  "app/api/ai/analytics/intent-distribution/route.ts",
  "app/api/ai/analytics/token-usage/route.ts",
  "app/api/ai/analytics/conversations/route.ts",
  "app/api/ai/analytics/unknown-questions/route.ts",
  "app/api/ai/knowledge/import/route.ts",
  "app/api/ai/knowledge/coverage/route.ts",
  "app/api/ai/multi-source/overview/route.ts",
  "app/api/ai/multi-source/query/route.ts",
  "app/api/ai/multi-source/quick-queries/route.ts",
  "app/api/ai/multi-source/statistics/route.ts",
  "app/api/ai/multi-source/today/route.ts",
  "app/api/seed-ai-settings/route.ts",
  "app/api/ai/health/route.ts",
];

describe("protected AI API route authentication wiring", () => {
  it.each(PROTECTED_ROUTES)("%s uses requireRayaAdminUser", (route) => {
    const fullPath = path.join(process.cwd(), route);
    const source = fs.readFileSync(fullPath, "utf8");
    expect(source).toContain("requireRayaAdminUser");
    expect(source).toContain('from "@/lib/auth/raya-admin-auth"');
    // No hand-rolled unauthorized responses.
    expect(source).not.toMatch(/error: "Unauthorized"/);
    // No Firebase Admin dependency and no Firebase-token guard in the AI path.
    expect(source).not.toContain("lib/auth/admin-auth");
    expect(source).not.toContain("admin-firebase");
  });

  it("no in-scope Raya AI path imports Firebase Admin or Firestore", () => {
    const scopes = ["app/api/ai", "app/admin/ai", "lib/ai/ai-settings"];
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(process.cwd(), dir), {
        withFileTypes: true,
      })) {
        const rel = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(rel);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          const source = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
          if (
            /from ["']@\/lib\/admin-firebase["']/.test(source) ||
            /from ["']firebase-admin/.test(source)
          ) {
            offenders.push(rel);
          }
        }
      }
    };

    for (const scope of scopes) walk(scope);
    expect(offenders).toEqual([]);
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

  it("the admin bootstrap script is idempotent and never downgrades a role by default", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "scripts/bootstrap-raya-admin.ts"),
      "utf8"
    );
    // Reads the existing row before writing, so re-runs converge.
    expect(source).toContain("maybeSingle");
    // Only changes an existing role when explicitly forced.
    expect(source).toContain("RAYA_ADMIN_FORCE_ROLE");
    // Authorization writes require the server-only service-role key.
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
    // It must not be importable into the browser bundle.
    expect(source).not.toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("the browser CSP permits the Supabase Auth and realtime origins", () => {
    const config = fs.readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    expect(config).toContain("https://*.supabase.co");
    expect(config).toContain("wss://*.supabase.co");
  });

  it("the Raya AI login page authenticates with Supabase, not Firebase", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/admin/ai/login/page.tsx"),
      "utf8"
    );
    expect(source).toContain("signInWithPassword");
    expect(source).toContain("@/lib/supabase/client");
    expect(source).not.toContain("firebase");
  });
});

