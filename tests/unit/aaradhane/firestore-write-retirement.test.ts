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
import { readFileSync } from "node:fs";
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

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
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
