/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

import { sevaE2EServerEnv } from "../../e2e/seva/server-env";

/**
 * A4P-FIX item 6: the seva e2e dev server must never reach a real Supabase project, even when the owner's git-ignored
 * `.env.local` holds real keys. Playwright merges `webServer.env` over process.env, and Next only fills a variable from
 * `.env*` files when it is not set at all, so every server-side Supabase variable the app reads is set here to a local
 * or inert value. The list of variables is found by scanning the app's code.
 *
 * There is no Firebase any more: the suite runs against a local Supabase stack, so no `FIREBASE_*` variable is set,
 * read or required. The one-time Firebase retirement is guarded separately (no-firebase-runtime.test.ts).
 */

const ROOT = path.resolve(__dirname, "..", "..", "..");
const SOURCE_DIRS = ["app", "lib", "services", "hooks", "components"];
const SOURCE_FILES = ["proxy.ts", "next.config.ts"];
// Supabase credentials. The NEXT_PUBLIC_SUPABASE_* browser settings are the local stack's own keys.
const SENSITIVE = /^(?:NEXT_PUBLIC_SUPABASE_\w+|SUPABASE_\w+|PRISMA_DATABASE_URL)$/;
// Every other secret the app reads (A4S-FIX item 6): the AI providers, WhatsApp, e-mail, the admin API key, and any
// variable whose name says it is a key, secret, token, password or credential.
const OTHER_SECRET =
  /^(?:OPENAI_\w*KEY\w*|ANTHROPIC_\w*KEY\w*|GOOGLE_GENERATIVE_\w+|OPENROUTER_\w*KEY\w*|WHATSAPP_\w+|EMAIL_\w+|ADMIN_API_KEY|\w*(?:_KEY|_SECRET|_TOKEN|_PASSWORD|_CREDENTIALS)(?:_\w+)?)$/;
// Secrets a library reads from the environment itself, so the scan cannot see them: @vercel/blob reads its token.
const IMPLICIT_SECRETS = ["BLOB_READ_WRITE_TOKEN"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

/** Every `process.env.X` / `process.env["X"]` name in the app's code that `keep` accepts, sorted. */
function envNamesTheAppReads(keep: (name: string) => boolean): string[] {
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
      if (keep(name)) names.add(name);
    }
  }
  return [...names].sort();
}

function variablesTheAppReads(): string[] {
  return envNamesTheAppReads((name) => SENSITIVE.test(name));
}

/** The other secrets the app reads. */
function otherSecretsTheAppReads(): string[] {
  return envNamesTheAppReads((name) => OTHER_SECRET.test(name) && !SENSITIVE.test(name));
}

/** The dev-server environment the Playwright config builds, with a fake local stack. */
function serverEnv(): Record<string, string> {
  return sevaE2EServerEnv({
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-placeholder-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "e2e-placeholder-service-role-key",
  });
}

describe("seva e2e isolation", () => {
  it("finds the Supabase variables the app reads", () => {
    const names = variablesTheAppReads();
    for (const expected of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("reads no Firebase variable anywhere in the app", () => {
    const names = envNamesTheAppReads(() => true);
    expect(names.filter((name) => /FIREBASE|FIRESTORE|GCLOUD_PROJECT|GOOGLE_APPLICATION_CREDENTIALS/.test(name))).toEqual([]);
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

  it("sets no Firebase variable at all", () => {
    const env = serverEnv();
    expect(Object.keys(env).filter((name) => /FIREBASE|FIRESTORE|GCLOUD_PROJECT/.test(name))).toEqual([]);
  });

  it("finds the AI, admin-key and other secrets the app reads", () => {
    const names = otherSecretsTheAppReads();
    for (const expected of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_GENERATIVE_API_KEY", "OPENROUTER_API_KEY", "ADMIN_API_KEY"]) {
      expect(names).toContain(expected);
    }
  });

  it("blanks every other secret the app reads, and the ones a library reads itself", () => {
    const env = serverEnv();
    for (const name of [...otherSecretsTheAppReads(), ...IMPLICIT_SECRETS]) {
      expect({ name, value: env[name] }).toEqual({ name, value: "" });
    }
  });
});
