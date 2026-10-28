/**
 * Authentication-isolation regression tests for the Raya AI admin surface.
 *
 * These assert the properties that must hold no matter how the code is
 * refactored: the service-role key stays server-side, the guard never trusts a
 * client-supplied identity, the non-AI admin path keeps its Firebase behaviour,
 * and the two auth providers stay separated.
 */

import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/** Walk every .ts/.tsx file under the given repo-relative directories. */
function walk(dir: string, out: string[] = []): string[] {
  const abs = path.join(process.cwd(), dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

/**
 * True when a module reaches Firebase Admin, Firestore or the admin helper —
 * whether it does so through a static `import`/`require` or a dynamic
 * `await import(...)` (lib/auth/admin-auth.ts uses the dynamic form).
 */
function reachesFirebase(source: string): boolean {
  const targets = [
    String.raw`firebase-admin`,
    String.raw`firebase/firestore`,
    String.raw`@/lib/admin-firebase`,
    String.raw`@/lib/firebase`,
  ];
  return targets.some((t) => {
    const staticImport = new RegExp(`from\\s+["']${t}["']`);
    const dynamicImport = new RegExp(`import\\(\\s*["']${t}["']\\s*\\)`);
    const requireCall = new RegExp(`require\\(\\s*["']${t}["']\\s*\\)`);
    return staticImport.test(source) || dynamicImport.test(source) || requireCall.test(source);
  });
}

describe("service-role key isolation", () => {
  it("the admin client is server-only", () => {
    expect(read("lib/supabase/admin.ts")).toContain("import 'server-only'");
  });

  it("the service-role key is only ever read from the non-public env var", () => {
    const offenders: string[] = [];
    for (const rel of [...walk("app"), ...walk("lib"), ...walk("services"), ...walk("hooks")]) {
      const source = read(rel);
      // A public (NEXT_PUBLIC_) variable must never carry the service-role key.
      if (/NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE/i.test(source)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("no client component imports the service-role admin client", () => {
    const offenders: string[] = [];
    for (const rel of [...walk("components"), ...walk("hooks")]) {
      const source = read(rel);
      if (source.includes("@/lib/supabase/admin")) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("no 'use client' module imports the admin client", () => {
    const offenders: string[] = [];
    for (const rel of [...walk("app"), ...walk("lib"), ...walk("components"), ...walk("hooks")]) {
      const source = read(rel);
      if (!/^\s*["']use client["']/m.test(source)) continue;
      if (source.includes("@/lib/supabase/admin")) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});

describe("the Raya AI guard trusts only the database record", () => {
  const source = read("lib/auth/raya-admin-auth.ts");

  it("is server-only and reads authorization from public.users keyed by auth_user_id", () => {
    expect(source).toContain('import "server-only"');
    expect(source).toContain('.eq("auth_user_id", uid)');
    expect(source).toContain('from("users")');
  });

  it("verifies the Supabase identity server-side rather than decoding the token itself", () => {
    expect(source).toContain("supabase.auth.getUser(token)");
    expect(source).toContain("supabase.auth.getUser()");
    // A hand-rolled JWT decode would mean the signature is not verified.
    expect(source).not.toMatch(/jwt\.decode|jwtDecode|verifyJwt/);
  });

  it("never reads a role, email or admin flag out of the request body or query", () => {
    expect(source).not.toMatch(/searchParams\.get\(["']role/);
    expect(source).not.toMatch(/searchParams\.get\(["']admin/);
    expect(source).not.toMatch(/request\.json\(\)/);
    expect(source).not.toMatch(/body\.role|body\.isAdmin|body\.admin/);
  });

  it("enforces an allow-list and denies an unknown or empty role", () => {
    expect(source).toContain("ADMIN_CONSOLE_ROLES");
    expect(source).toMatch(/!ADMIN_CONSOLE_ROLES\.has\(role\)/);
  });
});

describe("auth-provider separation", () => {
  it("the AI guard does not import the Firebase admin path", () => {
    const source = read("lib/auth/raya-admin-auth.ts");
    expect(source).not.toMatch(/from ["']@\/lib\/auth\/admin-auth["']/);
    expect(source).not.toContain("admin-firebase");
    expect(source).not.toContain("firebase");
  });

  it("the Firebase admin path is untouched and still its own module", () => {
    const source = read("lib/auth/admin-auth.ts");
    expect(source).toContain("requireAdminUser");
    // It must not have been repointed at the Supabase guard.
    expect(source).not.toContain("raya-admin-auth");
  });

  it("AdminAuthGuard keeps the Firebase gate for every non-AI admin path", () => {
    const source = read("components/admin/layout/AdminAuthGuard.tsx");
    // The Firebase decision must still be present and still gate on the Firebase user.
    expect(source).toContain("useAuth");
    expect(source).toContain("getFirebaseConfigStatus");
    expect(source).toContain("canAccessAdmin");
    // And the Supabase session may only satisfy the Raya AI subtree.
    expect(source).toContain("isRayaAiPath");
    // The three unauthenticated Raya AI pages are exempted through the shared
    // predicate, so the guard and the pages cannot drift apart.
    expect(source).toContain("isRayaAiPublicAuthPath");
  });

  it("the Supabase session hook is client-only and never the security boundary", () => {
    const source = read("hooks/useSupabaseSession.ts");
    expect(source).toMatch(/^\s*["']use client["']/m);
    expect(source).not.toContain("server-only");
    expect(source).toContain("onAuthStateChange");
  });

  it("useAdminFetch attaches the Supabase token and waits for initialization", () => {
    const source = read("hooks/useAdminFetch.ts");
    expect(source).toContain("useSupabaseSession");
    expect(source).toContain("Bearer");
    expect(source).toContain("AUTH_INITIALIZING");
    // It must not fall back to a Firebase token.
    expect(source).not.toContain("getIdToken");
    expect(source).not.toContain("useAuth");
  });
});

describe("Raya AI login page redirect safety", () => {
  const source = read("app/admin/ai/login/page.tsx");

  it("validates the return path instead of using it raw", () => {
    expect(source).toContain("safeReturnPath");
    expect(source).not.toMatch(/router\.(replace|push)\(\s*searchParams\.get/);
    expect(source).not.toMatch(/window\.location\.(assign|href)\s*=\s*searchParams/);
  });

  it("establishes the session with Supabase, not Firebase", () => {
    expect(source).toContain("signInWithPassword");
    expect(source).not.toContain("firebase");
  });
});

describe("middleware does not gate admin authentication", () => {
  it("proxy.ts performs no redirect-based auth decision for /admin", () => {
    const source = read("proxy.ts");
    // Security headers and page-view tracking only; auth is enforced in the route.
    expect(source).not.toMatch(/redirect\(.*admin/i);
    expect(source).not.toContain("raya-admin-auth");
  });
});

describe("no Firestore fallback in the approved Raya AI paths", () => {
  // Files that legitimately still reach Firebase/Firestore. Each is documented
  // in docs/RAYA_AI_SUPABASE_NATIVE_AUTH.md §1.3 as outside the approved scope.
  // A new entry here is a deliberate scope decision, not a silent regression.
  const OUT_OF_SCOPE_FIREBASE_FILES = new Set([
    // Non-AI admin authentication (the temple's other admin pages).
    path.join("lib", "auth", "admin-auth.ts"),
    // Non-AI admin helper used by app/actions/settings.ts and seva receipts.
    path.join("lib", "auth", "admin.ts"),
    // Firebase ID-token verification for public receipts and seva (non-AI).
    path.join("lib", "auth", "verify-id-token.ts"),
  ]);

  it("no in-scope AI module imports Firestore or Firebase Admin", () => {
    const offenders: string[] = [];
    for (const rel of [
      ...walk("app/api/ai"),
      ...walk("app/admin/ai"),
      ...walk("lib/ai"),
      ...walk("lib/auth"),
    ]) {
      if (reachesFirebase(read(rel))) offenders.push(rel);
    }
    expect(offenders.filter((f) => !OUT_OF_SCOPE_FIREBASE_FILES.has(f))).toEqual([]);
  });

  it("the documented out-of-scope allowlist matches reality exactly", () => {
    // Guards the guard: if one of these is ported to Supabase, this fails and the
    // allowlist must be tightened rather than left stale.
    const stillOnFirebase = [...OUT_OF_SCOPE_FIREBASE_FILES].filter((rel) =>
      reachesFirebase(read(rel))
    );
    expect(stillOnFirebase.sort()).toEqual([...OUT_OF_SCOPE_FIREBASE_FILES].sort());
  });

  it("the AI settings repository reads Supabase, not Firestore", () => {
    const source = read("lib/ai/ai-settings/repository.ts");
    expect(source).toContain("@/lib/supabase/admin");
    expect(source).not.toContain("firestore");
  });
});
