/**
 * Regression tests for the Aaradhane Firestore-write retirement.
 *
 * The owner's decision is that the Aaradhane system must write to Supabase only:
 * Firestore receives no writes. These tests fail if a Firestore write path is
 * reintroduced anywhere on the Aaradhane execution path — source, scripts, or the
 * scheduled workflow — rather than relying on a reviewer to notice.
 *
 * Scope note: this asserts the *absence* of a write. It does not assert that the
 * Supabase cutover has been applied in production; that is PR-D4b and stays on hold.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");

/** Every file that participates in generating or persisting Aaradhane events. */
const AARADHANE_EXECUTION_PATH = [
  "lib/aaradhane/generator.ts",
  "lib/aaradhane/local-generator.ts",
  "lib/aaradhane/supabase-writer.ts",
  "scripts/generate-aaradhane.ts",
  ".github/workflows/aaradhane.yml",
];

/** Firestore Admin SDK entry points. Any of these in a writer is a Firestore write. */
const FIRESTORE_WRITE_PATTERNS = [
  /\bgetFirestore\b/,
  /\bfirebase-admin\/firestore\b/,
  /\bfirebase\/firestore\b/,
  /\bFieldValue\b/,
  /\bTimestamp\b/,
  /\.collection\([^)]*\)\s*\.\s*(?:add|set|update|delete)\b/,
  /\.doc\([^)]*\)\s*\.\s*(?:set|update|delete)\b/,
];

/**
 * Mutating Firestore *calls* only.
 *
 * Distinct from `FIRESTORE_WRITE_PATTERNS`, which also matches the `Timestamp` /
 * `FieldValue` type markers. Those markers are appropriate when the whole file is
 * known to be a writer (the execution path), but not for a repo-wide scan: a file
 * that only does `import type { Timestamp }` declares a shape, it does not write.
 * The allowlist scan therefore matches calls, so a type import is not misreported
 * as a writer.
 */
const FIRESTORE_WRITE_CALL_PATTERNS = [
  /\b(?:addDoc|setDoc|updateDoc|deleteDoc|writeBatch|runTransaction)\s*\(/,
  /\.collection\([^)]*\)\s*\.\s*(?:add|set|update|delete)\b/,
  /\.doc\([^)]*\)\s*\.\s*(?:set|update|delete)\b/,
  /\bFieldValue\s*\.\s*(?:serverTimestamp|delete|arrayUnion|arrayRemove|increment)\b/,
];

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

/**
 * Source files whose path mentions `aaradhane`, excluding tests and docs.
 *
 * Walks the working tree rather than the git index, so an untracked writer is
 * still caught before it is committed. Tests contain Firestore write *samples*
 * (the non-vacuity controls) and docs quote them, so neither is a writer.
 */
function aaradhaneSourceFiles(): string[] {
  const roots = ["app", "components", "services", "lib", "scripts", "types", "hooks"];
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/aaradhane/i.test(entry.name) && /\.(ts|tsx)$/.test(entry.name)) {
        found.push(path.relative(ROOT, full));
      }
    }
  };
  for (const root of roots) {
    const full = path.join(ROOT, root);
    if (existsSync(full)) walk(full);
  }
  return found;
}

/** Lines of `rel` that are not comments, so a note about Firestore does not match. */
function codeLines(rel: string): string[] {
  return read(rel)
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("#") && !t.startsWith("/*");
    });
}

describe("Aaradhane writes to Supabase only", () => {
  it("no file on the execution path imports or calls a Firestore write API", () => {
    const offenders: string[] = [];
    for (const rel of AARADHANE_EXECUTION_PATH) {
      codeLines(rel).forEach((line, i) => {
        for (const re of FIRESTORE_WRITE_PATTERNS) {
          if (re.test(line)) offenders.push(`${rel}:${i + 1} matches ${re}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("the Aaradhane Firestore modules are gone, not merely unreferenced", () => {
    // Leaving a writer on disk invites a later re-import. They are deleted.
    const tracked = execFileSync("git", ["ls-files", "--", "lib/aaradhane", "scripts"], {
      cwd: ROOT,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);

    for (const gone of [
      "lib/aaradhane/firestore.ts",
      "lib/aaradhane/firestore-admin.ts",
      "lib/aaradhane/firestore-rest.ts",
      "lib/aaradhane/firestore-source.ts",
      "scripts/generate-events-firestore.ts",
      "scripts/import-events.ts",
      "scripts/seed-guru-parampara.ts",
      "scripts/seed-guru-to-firestore.ts",
    ]) {
      expect(tracked).not.toContain(gone);
    }
  });

  it("the workflow cannot reach a Firestore write, on cron or on dispatch", () => {
    const yaml = read(".github/workflows/aaradhane.yml");
    // Comments are excluded: the YAML deliberately documents the retired paths, and
    // a note explaining the absence must not itself fail the check.
    const code = codeLines(".github/workflows/aaradhane.yml").join("\n");

    // No credential is materialised, so no Firestore client can authenticate.
    expect(code).not.toMatch(/FIREBASE_SERVICE_ACCOUNT/);
    expect(code).not.toMatch(/GOOGLE_APPLICATION_CREDENTIALS/);
    expect(code).not.toMatch(/firebase-admin-key\.json/);
    // No step may pass the write flag.
    expect(code).not.toMatch(/--apply(?!\w)/);
    // The retired input must not default to a live run.
    expect(yaml).toMatch(/dry_run:[\s\S]*?default:\s*true/);
  });

  it("the generator script has no Firestore fallback branch", () => {
    const src = read("scripts/generate-aaradhane.ts");
    // The only remaining mentions are documentation of the absence.
    expect(src).not.toMatch(/updateFirestoreWithAdmin/);
    expect(src).not.toMatch(/getFirebaseAdmin|initializeApp|cert\(/);
    expect(src).not.toMatch(/--firestore|--seed/);
    // It must reach Supabase through the new writer.
    expect(src).toMatch(/lib\/aaradhane\/supabase-writer/);
  });

  it("the generator module is pure, with persistence left to the caller", () => {
    const src = read("lib/aaradhane/generator.ts");
    const code = codeLines("lib/aaradhane/generator.ts").join("\n");
    // The header deliberately states that Firestore is not used, so only code is checked.
    expect(code).not.toMatch(/firebase|firestore/i);
    expect(code).not.toMatch(/eventToFirestoreDocument/);
    // The export that remains must take its data as an argument.
    expect(src).toMatch(/export function generateAaradhanaeEvents\(\s*year: number,\s*guruRecords/);
  });

  it("keeps a non-vacuity control: the detector matches a real Firestore write", () => {
    // Guards against a regex set that matches nothing and therefore always passes.
    const sample = [
      'import { getFirestore } from "firebase-admin/firestore";',
      "await db.collection('events').add(row);",
      "await docRef.set({ startDate: Timestamp.fromDate(d) });",
      "await ref.update({ x: FieldValue.serverTimestamp() });",
    ];
    for (const line of sample) {
      expect(FIRESTORE_WRITE_PATTERNS.some((re) => re.test(line))).toBe(true);
    }
  });
});

/**
 * The Aaradhane *feature* writer is now retired.
 *
 * `services/aaradhane.service.ts` was the last Firestore writer on the Aaradhane
 * feature: the admin CRUD surface for the separate `aaradhane` / `aaradhanes`
 * collections. It now reads and writes the Supabase `aaradhanes` table, so the
 * allowlist that tracked it is empty. A new Firestore-writing Aaradhane file still
 * fails the scan below, so the surface cannot quietly reopen.
 */
describe("the Aaradhane feature has no Firestore writers", () => {
  it("no Firestore writer exists anywhere on the Aaradhane feature", () => {
    // Repo-wide scan for Firestore write *calls* in files whose path mentions
    // aaradhane. The retired execution path is asserted write-free above, so
    // anything found here is an untracked regression.
    const untracked: string[] = [];
    for (const rel of aaradhaneSourceFiles()) {
      if (AARADHANE_EXECUTION_PATH.includes(rel)) continue;
      const writes = codeLines(rel).filter((line) =>
        FIRESTORE_WRITE_CALL_PATTERNS.some((re) => re.test(line)),
      );
      if (writes.length > 0) untracked.push(rel);
    }
    expect(untracked).toEqual([]);
  });

  it("the Aaradhane feature reads and writes Supabase, not Firestore", () => {
    // The feature is split so the service-role client can never reach a browser
    // bundle: `aaradhane.server.ts` owns the Supabase admin client and the
    // server-only guard, and `aaradhane.service.ts` is the browser-facing module
    // that talks to the guarded `/api/**` routes.
    const server = read("services/aaradhane.server.ts");
    expect(server).toContain("@/lib/supabase/admin");
    expect(server).toContain("server-only");

    const client = read("services/aaradhane.service.ts");
    expect(client).toContain("@/lib/api/fetch");
    expect(client).not.toContain("@/lib/supabase/admin");

    for (const source of [server, client]) {
      // The only surviving "firestore" tokens are the nullable `firestore_id`
      // column name; the Firestore *client* imports are gone.
      expect(source).not.toContain("firebase");
      expect(source).not.toMatch(/from\s+["']firebase\/firestore["']/);
      expect(source).not.toContain("@/lib/firebase");
    }
  });

  it("the destination table is readable by the roles the public page uses", () => {
    // The writer could only be retired once the destination table had a SELECT
    // policy for the public reader; the deny-all policy alone would have left the
    // public /aaradhane page blank. Assert the grant so a future migration cannot
    // silently close it again.
    const migrations = readdirSync(path.join(ROOT, "supabase", "migrations")).filter((f) =>
      f.endsWith(".sql"),
    );
    const grants = migrations.filter((file) => {
      const sql = read(path.join("supabase", "migrations", file));
      return /CREATE\s+POLICY\s+"[^"]*"[\s\S]{0,200}?ON\s+aaradhanes\b[\s\S]{0,200}?FOR\s+SELECT/i.test(
        sql,
      );
    });
    expect(grants.length).toBeGreaterThan(0);
  });

  it("names the decision document that records retire-or-keep", () => {
    // The decision must be written down, not inferred from the allowlist.
    const decision = read("docs/AARADHANE_CUTOVER_READINESS_REVIEW.md");
    expect(decision).toMatch(/services\/aaradhane\.service\.ts/);
    expect(decision).toMatch(/retire|retirement/i);
  });

  it("keeps a non-vacuity control for the call detector", () => {
    // The call detector must match a real mutating call, or the allowlist scan
    // would pass by matching nothing.
    const sample = [
      "await addDoc(collection(db, 'aaradhane'), data);",
      "await updateDoc(docRef, data);",
      "await deleteDoc(docRef);",
      "await db.collection('x').doc('y').set({ a: 1 });",
      "await ref.update({ x: FieldValue.serverTimestamp() });",
    ];
    for (const line of sample) {
      expect(FIRESTORE_WRITE_CALL_PATTERNS.some((re) => re.test(line))).toBe(true);
    }
    // And it must NOT match a pure type import, which is not a write.
    expect(
      FIRESTORE_WRITE_CALL_PATTERNS.some((re) => re.test('import type { Timestamp } from "firebase/firestore";')),
    ).toBe(false);
  });
});
