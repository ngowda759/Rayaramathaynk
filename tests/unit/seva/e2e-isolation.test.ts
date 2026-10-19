/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

import config from "../../e2e/seva/playwright.config";

/**
 * A4P-FIX item 6: the seva e2e dev server must never reach a real Supabase or Firebase project, even when the owner's
 * git-ignored `.env.local` holds real keys. Playwright merges `webServer.env` over process.env, and Next only fills a
 * variable from `.env*` files when it is not set at all, so every server-side Supabase and Firebase-admin variable the
 * app reads is set here to a local or inert value. The list of variables is found by scanning the app's code.
 */

const ROOT = path.resolve(__dirname, "..", "..", "..");
const SOURCE_DIRS = ["app", "lib", "services", "hooks", "components"];
const SOURCE_FILES = ["proxy.ts", "next.config.ts"];
// Supabase, Firebase Admin credentials and Google credentials. The NEXT_PUBLIC_FIREBASE_* browser settings other than
// the private key are already the demo-seva values.
const SENSITIVE = /^(?:NEXT_PUBLIC_SUPABASE_\w+|SUPABASE_\w+|PRISMA_DATABASE_URL|FIREBASE_\w+|NEXT_PUBLIC_FIREBASE_PRIVATE_KEY|GOOGLE_APPLICATION_CREDENTIALS)$/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

function variablesTheAppReads(): string[] {
  const files = [
    ...SOURCE_DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d))),
    ...SOURCE_FILES.map((f) => path.join(ROOT, f)),
  ];
  const names = new Set<string>();
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const match of text.matchAll(/process\.env(?:\.([A-Z0-9_]+)|\[\s*["']([A-Z0-9_]+)["']\s*\])/g)) {
      const name = match[1] ?? match[2];
      if (SENSITIVE.test(name)) names.add(name);
    }
  }
  return [...names].sort();
}

function serverEnv(): Record<string, string> {
  const server = config.webServer;
  if (!server || Array.isArray(server)) throw new Error("expected one webServer");
  return server.env ?? {};
}

describe("seva e2e isolation", () => {
  it("finds the Supabase and Firebase-admin variables the app reads", () => {
    const names = variablesTheAppReads();
    for (const expected of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "FIREBASE_CLIENT_EMAIL",
      "FIREBASE_PRIVATE_KEY",
      "FIREBASE_PROJECT_ID",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("overrides every one of them in webServer.env, so .env.local can never supply a real key", () => {
    const env = serverEnv();
    for (const name of variablesTheAppReads()) {
      expect(env).toHaveProperty(name);
    }
  });

  it("points Supabase at an unreachable local address with inert keys", () => {
    const env = serverEnv();
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    expect(url.hostname).toBe("127.0.0.1");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).not.toMatch(/supabase\.(co|in)/);
    for (const key of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
      // Not empty (the server would then fall back to nothing and crash differently), and never JWT-shaped.
      expect(env[key]).toMatch(/^e2e-placeholder-/);
    }
  });

  it("blanks the Firebase Admin credentials and keeps the emulator project", () => {
    const env = serverEnv();
    for (const key of ["FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "FIREBASE_SERVICE_ACCOUNT_JSON", "NEXT_PUBLIC_FIREBASE_PRIVATE_KEY", "GOOGLE_APPLICATION_CREDENTIALS"]) {
      expect(env[key]).toBe("");
    }
    expect(env.FIREBASE_PROJECT_ID).toBe("demo-seva");
    expect(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe("demo-seva");
    expect(env.FIREBASE_AUTH_EMULATOR_HOST).toBe("127.0.0.1:9099");
    expect(env.FIRESTORE_EMULATOR_HOST).toBe("127.0.0.1:8080");
  });
});
