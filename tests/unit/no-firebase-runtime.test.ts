/**
 * @jest-environment node
 *
 * Firebase retirement guard: no Firebase SDK, Firebase Admin SDK or Firebase API call may be
 * reachable through any production application path.
 *
 * This is the acceptance test for the Firebase retirement. It walks the application runtime
 * (`app/`, `lib/`, `services/`, `components/`, `hooks/`, `context/`, the middleware, the Next config
 * and `types/`) and fails if any of the following appears there:
 *
 *   - an import or dynamic `import()` of `firebase`, `firebase-admin`, `firebase/*`,
 *     `@/lib/firebase`, `@/lib/admin-firebase`, `lib/firebase` or `lib/admin-firebase`;
 *   - a call to a Firebase entry point (`getAdminFirestore`, `getAdminApp`, `getFirebaseConfigStatus`,
 *     `onAuthStateChanged`, `initializeApp`, `getApps`, `getAuth`, `getFirestore`, `getStorage`);
 *   - a `NEXT_PUBLIC_FIREBASE*`, `FIREBASE_*` or `FIREBASE_SERVICE_ACCOUNT_JSON` environment read;
 *   - a `firebaseapp.com`, `firebaseio.com`, `firebasestorage.googleapis.com`,
 *     `identitytoolkit.googleapis.com` or `*.googleapis.com/identitytoolkit` endpoint;
 *   - a `firebase_uid` / `firestore_id` *column* read that would only make sense against Firestore
 *     (the two legacy columns are allowed to remain as inert provenance keys, so this checks the
 *     Firebase SDK/endpoint surface, not the column names).
 *
 * The deleted modules must stay deleted, and the Firebase dependencies must stay out of
 * `package.json`.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");

const RUNTIME_DIRS = ["app", "lib", "services", "components", "hooks", "context", "types"];
const RUNTIME_FILES = ["proxy.ts", "middleware.ts", "next.config.ts", "next.config.js"];

/**
 * Tooling and CI surfaces that must also be free of a *reachable* Firebase dependency: the maintenance
 * scripts and the GitHub Actions workflows. These legitimately mention the inert `firebase_uid` *column*
 * (a Supabase-issued UUID in a legacy-named column), which is why only the SDK/endpoint/env surface is
 * checked here, not the column name.
 */
const TOOLING_DIRS = ["scripts", ".github"];

/** Deployment and environment manifests, where a Firebase *variable declaration* would re-introduce a dependency. */
const MANIFEST_FILES = [".env.example", ".env.local.example", "vercel.json", "supabase/config.toml", "package.json"];

/** A bare `FIREBASE_*`-style assignment (dotenv style), as opposed to a `process.env` read. */
const MANIFEST_FIREBASE_ENV =
  /^[ \t]*(?:export[ \t]+)?(?:NEXT_PUBLIC_FIREBASE\w*|FIREBASE_\w+|GCLOUD_PROJECT|GOOGLE_APPLICATION_CREDENTIALS)[ \t]*=/m;

/** Files that are explicitly NOT part of the runtime, so the scan skips them. */
const RUNTIME_EXCLUDES = [
  // Documentation of the (historical) Firebase migration, kept for the audit trail.
  /^docs\//,
  // The retirement audit itself and the historical Firestore audits.
  /^scripts\//,
];

const FORBIDDEN_IMPORT = /(?:from|require\(|import\()\s*["'`](firebase(?:-admin)?(?:\/[^"'`]*)?|@\/lib\/(?:admin-)?firebase|(?:\.\.?\/)*(?:lib\/)?(?:admin-)?firebase)["'`]/;

const FORBIDDEN_CALL = new RegExp(
  String.raw`\b(?:getAdminFirestore|getAdminApp|getFirebaseConfigStatus|onAuthStateChanged|initializeApp|getApps|getAuth|getFirestore|getStorage)\s*\(`,
);

const FORBIDDEN_ENV = /process\.env(?:\.([A-Z0-9_]+)|\[\s*["']([A-Z0-9_]+)["']\s*\])/g;

const FIREBASE_ENV = /^(?:NEXT_PUBLIC_FIREBASE\w*|FIREBASE_\w+|GCLOUD_PROJECT|GOOGLE_APPLICATION_CREDENTIALS)$/;

const FORBIDDEN_ENDPOINT = /(?:firebaseapp\.com|firebaseio\.com|firebasestorage\.googleapis\.com|identitytoolkit\.googleapis\.com|firebaseinstallations\.googleapis\.com)/;

/** Every runtime source file, excluding the explicit non-runtime paths. */
function runtimeFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = path.relative(ROOT, full);
      if (RUNTIME_EXCLUDES.some((re) => re.test(rel))) continue;
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) out.push(full);
    }
  };
  for (const dir of RUNTIME_DIRS) {
    const full = path.join(ROOT, dir);
    if (fs.existsSync(full)) walk(full);
  }
  for (const file of RUNTIME_FILES) {
    const full = path.join(ROOT, file);
    if (fs.existsSync(full)) out.push(full);
  }
  return out;
}

function offenders(predicate: (text: string) => boolean): string[] {
  return runtimeFiles()
    .filter((file) => predicate(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(ROOT, file))
    .sort();
}

/** Every file under the tooling directories (`scripts/`, `.github/`) with a source or workflow extension. */
function toolingFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx|mjs|cjs|ya?ml)$/.test(name)) out.push(full);
    }
  };
  for (const dir of TOOLING_DIRS) {
    const full = path.join(ROOT, dir);
    if (fs.existsSync(full)) walk(full);
  }
  return out;
}

function toolingOffenders(predicate: (text: string) => boolean): string[] {
  return toolingFiles()
    .filter((file) => predicate(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(ROOT, file))
    .sort();
}

/** The manifest files that exist on disk. */
function manifestFiles(): string[] {
  return MANIFEST_FILES.map((name) => path.join(ROOT, name)).filter((full) => fs.existsSync(full));
}

describe("Firebase retirement: no Firebase reachable from the application runtime", () => {
  it("scans a non-trivial number of runtime files", () => {
    expect(runtimeFiles().length).toBeGreaterThan(100);
  });

  it("has no import or dynamic import of the Firebase SDK, the Admin SDK, or the deleted lib modules", () => {
    expect(offenders((text) => FORBIDDEN_IMPORT.test(text))).toEqual([]);
  });

  it("calls no Firebase entry point (getAdminFirestore, getAdminApp, onAuthStateChanged, initializeApp, ...)", () => {
    expect(offenders((text) => FORBIDDEN_CALL.test(text))).toEqual([]);
  });

  it("reads no Firebase environment variable", () => {
    const found = offenders((text) => {
      for (const match of text.matchAll(FORBIDDEN_ENV)) {
        const name = match[1] ?? match[2];
        if (FIREBASE_ENV.test(name)) return true;
      }
      return false;
    });
    expect(found).toEqual([]);
  });

  it("points at no Firebase endpoint", () => {
    expect(offenders((text) => FORBIDDEN_ENDPOINT.test(text))).toEqual([]);
  });

  it("keeps the retired Firebase modules deleted", () => {
    for (const file of ["lib/firebase.ts", "lib/admin-firebase.ts", "lib/seva/server/identity-firebase.ts"]) {
      expect(fs.existsSync(path.join(ROOT, file))).toBe(false);
    }
  });

  it("keeps the Firebase packages out of package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    const firebaseDeps = Object.keys(all).filter(
      (name) => name === "firebase" || name === "firebase-admin" || name === "firebase-tools" || name.startsWith("@firebase/") || name === "google-auth-library",
    );
    expect(firebaseDeps).toEqual([]);
  });

  it("has no Firebase script wired into package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};
    const firebaseScripts = Object.entries(scripts).filter(
      ([, command]) => /firebase|firestore|emulators:exec/.test(command),
    );
    expect(firebaseScripts).toEqual([]);
  });

  it("keeps no Firebase configuration or rules file", () => {
    for (const file of ["firebase.json", ".firebaserc", "firestore.rules", "firestore.indexes.json", "storage.rules"]) {
      expect(fs.existsSync(path.join(ROOT, file))).toBe(false);
    }
  });

  it("lists no tracked file whose name still says firebase or firestore except the retirement docs", () => {
    const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => /firebase|firestore/i.test(path.basename(line)));

    // A small, reviewed allow-list: the historical migration/audit documents and the JSON exports.
    // Nothing here is executable runtime code.
    const allowed = /^(?:docs\/|FIREBASE_MIGRATION_PHASE1_AUDIT\.md$|FIRESTORE_\w+\.md$|data\/exports\/.*firestore\.json$|supabase\/migrations\/.*firestore\w*\.sql$|tests\/unit\/.*firestore.*\.test\.ts$|tests\/unit\/.*no-firebase.*\.test\.ts$)/;
    const unexpected = tracked.filter((file) => !allowed.test(file));
    expect(unexpected).toEqual([]);
  });

  it("scans a non-trivial number of tooling and workflow files", () => {
    expect(toolingFiles().length).toBeGreaterThan(50);
  });

  it("has no Firebase import, entry point, environment read or endpoint in scripts/ or .github/", () => {
    const byImport = toolingOffenders((text) => FORBIDDEN_IMPORT.test(text));
    const byCall = toolingOffenders((text) => FORBIDDEN_CALL.test(text));
    const byEndpoint = toolingOffenders((text) => FORBIDDEN_ENDPOINT.test(text));
    const byEnv = toolingOffenders((text) => {
      for (const match of text.matchAll(FORBIDDEN_ENV)) {
        const name = match[1] ?? match[2];
        if (FIREBASE_ENV.test(name)) return true;
      }
      return false;
    });
    expect({ byImport, byCall, byEndpoint, byEnv }).toEqual({
      byImport: [],
      byCall: [],
      byEndpoint: [],
      byEnv: [],
    });
  });

  it("declares no Firebase environment variable in any deployment or environment manifest", () => {
    const offenders = manifestFiles()
      .filter((full) => MANIFEST_FIREBASE_ENV.test(fs.readFileSync(full, "utf8")))
      .map((full) => path.relative(ROOT, full));
    expect(offenders).toEqual([]);
  });
});
