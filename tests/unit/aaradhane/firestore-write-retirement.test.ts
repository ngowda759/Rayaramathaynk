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
 * The remaining Firestore writer on the Aaradhane *feature* (not the generated
 * `events` execution path).
 *
 * `services/aaradhane.service.ts` is the admin CRUD surface for the separate
 * `aaradhane` / `aaradhanes` collections. It cannot be moved to Supabase in this
 * PR: the destination table `aaradhanes` is deny-all under RLS
 * (`20261001000000_create_content_tables.sql:194-196`) and needs a policy, which
 * is RLS work and belongs to the separately reviewed reader/cutover phase.
 *
 * It is therefore *tracked*, not silently left: the list below is an explicit
 * allowlist that must shrink, never grow. A new Firestore-writing Aaradhane file
 * fails the suite, so the surface cannot widen unnoticed.
 */
describe("remaining Aaradhane Firestore writers are tracked, not forgotten", () => {
  const TRACKED_FOLLOWUPS: Array<{ file: string; reason: string }> = [
    {
      file: "services/aaradhane.service.ts",
      reason:
        "admin CRUD for the aaradhane/aaradhanes collections; needs an RLS policy on the " +
        "aaradhanes table, so it moves with the reader/cutover phase (PR-D4c follow-up)",
    },
  ];

  it("every tracked file still writes Firestore, so the list cannot go stale silently", () => {
    for (const { file } of TRACKED_FOLLOWUPS) {
      const lines = codeLines(file);
      const writes = lines.filter((line) =>
        FIRESTORE_WRITE_CALL_PATTERNS.some((re) => re.test(line)),
      );
      // If this fails the file was migrated: remove it from TRACKED_FOLLOWUPS.
      expect(`${file}:${writes.length > 0}`).toBe(`${file}:true`);
    }
  });

  it("no Firestore writer on the Aaradhane feature exists outside the tracked list", () => {
    // A repo-wide scan for Firestore write *calls* in files whose path mentions
    // aaradhane. Anything found must be in TRACKED_FOLLOWUPS (or the retired
    // execution path, which is asserted write-free above).
    const trackedFiles = new Set(TRACKED_FOLLOWUPS.map((t) => t.file));
    const untracked: string[] = [];
    for (const rel of aaradhaneSourceFiles()) {
      if (trackedFiles.has(rel)) continue;
      if (AARADHANE_EXECUTION_PATH.includes(rel)) continue;
      const writes = codeLines(rel).filter((line) =>
        FIRESTORE_WRITE_CALL_PATTERNS.some((re) => re.test(line)),
      );
      if (writes.length > 0) untracked.push(rel);
    }
    expect(untracked).toEqual([]);
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
