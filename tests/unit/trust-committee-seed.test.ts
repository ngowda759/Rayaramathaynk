/**
 * Trust Committee Supabase initialization — pure logic and source guards.
 *
 * The production bug was a missing `settings_documents` row
 * (`document_key = 'trustCommittee'`), not a reader defect. These tests pin the
 * canonical data, the classification/plan logic, the port-driven runner, and the
 * "Supabase only, no Firestore" property of the two new files. The database write
 * path itself is proven in `tests/db/trust-committee-seed.test.ts` against a real
 * (PGlite) Postgres.
 */
import fs from "fs";
import path from "path";

import {
  TRUST_COMMITTEE_DATA,
  TRUST_COMMITTEE_DOCUMENT_KEY,
  TRUST_COMMITTEE_MEMBER_COUNT,
  classifyExistingDocument,
  countActiveMembers,
  countMembers,
  matchesCanonicalDocument,
  planTrustCommitteeInitialization,
  runTrustCommitteeInitialization,
  validateTrustCommitteeData,
  type TrustCommitteeData,
  type TrustCommitteeSeedPort,
} from "@/lib/supabase/seed-data/trust-committee";
import { projectPublicSettingsDocument } from "@/lib/settings/public-projections";

const repoRoot = path.resolve(__dirname, "../..");

describe("canonical Trust Committee data", () => {
  it("is keyed to the trustCommittee settings document", () => {
    expect(TRUST_COMMITTEE_DOCUMENT_KEY).toBe("trustCommittee");
    expect(TRUST_COMMITTEE_MEMBER_COUNT).toBe(13);
  });

  it("carries exactly 13 members, all active, ordered 1–13", () => {
    expect(TRUST_COMMITTEE_DATA.members).toHaveLength(13);
    const orders = TRUST_COMMITTEE_DATA.members.map((m) => m.order);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(TRUST_COMMITTEE_DATA.members.every((m) => m.isActive === true)).toBe(true);
    expect(countMembers(TRUST_COMMITTEE_DATA)).toBe(13);
    expect(countActiveMembers(TRUST_COMMITTEE_DATA)).toBe(13);
  });

  it("gives every member only the fields the UI reads (no phone/address)", () => {
    const allowed = new Set([
      "id",
      "name",
      "nameKannada",
      "role",
      "roleKannada",
      "imageUrl",
      "order",
      "isActive",
    ]);
    for (const member of TRUST_COMMITTEE_DATA.members) {
      expect(Object.keys(member).sort()).toEqual([...allowed].sort());
    }
  });

  it("references committee images that all exist in public/images/committee", () => {
    for (const member of TRUST_COMMITTEE_DATA.members) {
      expect(member.imageUrl.startsWith("/images/committee/")).toBe(true);
      const onDisk = path.resolve(repoRoot, "public", member.imageUrl.replace(/^\//, ""));
      expect(fs.existsSync(onDisk)).toBe(true);
    }
  });

  it("passes full validation, including the on-disk image check", () => {
    const issues = validateTrustCommitteeData(TRUST_COMMITTEE_DATA, {
      imageExists: (p) => fs.existsSync(path.resolve(repoRoot, "public", p.replace(/^\//, ""))),
    });
    expect(issues).toEqual([]);
  });
});

describe("validateTrustCommitteeData", () => {
  const clone = (): TrustCommitteeData => JSON.parse(JSON.stringify(TRUST_COMMITTEE_DATA));

  it("reports the wrong member count", () => {
    const data = clone();
    data.members.pop();
    expect(validateTrustCommitteeData(data)).toContain("expected 13 members, found 12");
  });

  it("reports an inactive member", () => {
    const data = clone();
    data.members[4].isActive = false;
    expect(validateTrustCommitteeData(data).join("\n")).toMatch(/isActive must be true/);
  });

  it("reports a missing order value", () => {
    const data = clone();
    data.members[9].order = 12; // duplicates 12, leaves 10 missing
    const issues = validateTrustCommitteeData(data).join("\n");
    expect(issues).toMatch(/order 12 is duplicated/);
    expect(issues).toMatch(/no member has order 10/);
  });

  it("reports a missing image", () => {
    const issues = validateTrustCommitteeData(TRUST_COMMITTEE_DATA, { imageExists: () => false });
    expect(issues.join("\n")).toMatch(/does not exist on disk/);
  });

  it("reports a blank name", () => {
    const data = clone();
    data.members[0].name = "";
    expect(validateTrustCommitteeData(data).join("\n")).toMatch(/name must be a non-empty string/);
  });
});

describe("classifyExistingDocument", () => {
  it("treats null/undefined as missing", () => {
    expect(classifyExistingDocument(null)).toBe("missing");
    expect(classifyExistingDocument(undefined)).toBe("missing");
  });

  it("treats the canonical document (even with extra keys) as matching", () => {
    expect(classifyExistingDocument(TRUST_COMMITTEE_DATA)).toBe("matches");
    expect(classifyExistingDocument({ ...TRUST_COMMITTEE_DATA, updatedAt: "2026-01-01" })).toBe(
      "matches"
    );
    expect(matchesCanonicalDocument({ ...TRUST_COMMITTEE_DATA, updatedAt: null })).toBe(true);
  });

  it("treats a document with no members as empty", () => {
    expect(classifyExistingDocument({ heading: "Trust Committee", members: [] })).toBe("empty");
    expect(classifyExistingDocument({ heading: "Trust Committee" })).toBe("empty");
  });

  it("treats a document with different members as populated", () => {
    const other = {
      ...TRUST_COMMITTEE_DATA,
      members: [{ ...TRUST_COMMITTEE_DATA.members[0], name: "Someone Else" }],
    };
    expect(classifyExistingDocument(other)).toBe("populated");
  });
});

describe("planTrustCommitteeInitialization", () => {
  it("creates when the row is missing", () => {
    expect(planTrustCommitteeInitialization(null, { force: false }).action).toBe("create");
  });

  it("is a no-op when the row already matches (idempotent re-run)", () => {
    expect(planTrustCommitteeInitialization(TRUST_COMMITTEE_DATA, { force: false }).action).toBe(
      "noop"
    );
  });

  it("refuses an empty document without --force", () => {
    const plan = planTrustCommitteeInitialization({ members: [] }, { force: false });
    expect(plan.action).toBe("refused");
    expect(plan.state).toBe("empty");
  });

  it("refuses a populated document without --force", () => {
    const populated = { members: [{ ...TRUST_COMMITTEE_DATA.members[0] }] };
    const plan = planTrustCommitteeInitialization(populated, { force: false });
    expect(plan.action).toBe("refused");
    expect(plan.state).toBe("populated");
  });

  it("replaces an empty or populated document with --force", () => {
    expect(planTrustCommitteeInitialization({ members: [] }, { force: true }).action).toBe("replace");
    expect(
      planTrustCommitteeInitialization({ members: [{ id: "x" }] }, { force: true }).action
    ).toBe("replace");
  });
});

/** An in-memory port that records writes. */
function memoryPort(initial: unknown | null) {
  let stored = initial;
  const writes: unknown[] = [];
  const port: TrustCommitteeSeedPort = {
    async readDocument() {
      return stored;
    },
    async writeDocument(data) {
      writes.push(data);
      stored = data;
    },
  };
  return {
    port,
    writes,
    get stored() {
      return stored;
    },
  };
}

describe("runTrustCommitteeInitialization", () => {
  it("creates the document when missing and reports before/after", async () => {
    const mem = memoryPort(null);
    const result = await runTrustCommitteeInitialization(mem.port, { execute: true, force: false });
    expect(result.action).toBe("create");
    expect(result.wrote).toBe(true);
    expect(result.before).toEqual({ present: false, memberCount: 0, activeCount: 0 });
    expect(result.after).toEqual({ present: true, memberCount: 13, activeCount: 13 });
    expect(mem.writes).toHaveLength(1);
    expect(mem.stored).toEqual(TRUST_COMMITTEE_DATA);
  });

  it("is idempotent: a second execute run writes nothing", async () => {
    const mem = memoryPort(null);
    await runTrustCommitteeInitialization(mem.port, { execute: true, force: false });
    const second = await runTrustCommitteeInitialization(mem.port, { execute: true, force: false });
    expect(second.action).toBe("noop");
    expect(second.wrote).toBe(false);
    expect(mem.writes).toHaveLength(1);
  });

  it("dry run reads and classifies but never writes", async () => {
    const mem = memoryPort(null);
    const result = await runTrustCommitteeInitialization(mem.port, { execute: false, force: false });
    expect(result.action).toBe("create");
    expect(result.wrote).toBe(false);
    expect(mem.writes).toHaveLength(0);
    expect(mem.stored).toBeNull();
  });

  it("refuses to overwrite a populated document without --force", async () => {
    const populated = { members: [{ ...TRUST_COMMITTEE_DATA.members[0], name: "Owner Edit" }] };
    const mem = memoryPort(populated);
    const result = await runTrustCommitteeInitialization(mem.port, { execute: true, force: false });
    expect(result.action).toBe("refused");
    expect(result.wrote).toBe(false);
    expect(mem.writes).toHaveLength(0);
    expect(mem.stored).toEqual(populated);
  });

  it("replaces a populated document only with --force", async () => {
    const populated = { members: [{ ...TRUST_COMMITTEE_DATA.members[0], name: "Owner Edit" }] };
    const mem = memoryPort(populated);
    const result = await runTrustCommitteeInitialization(mem.port, { execute: true, force: true });
    expect(result.action).toBe("replace");
    expect(result.wrote).toBe(true);
    expect(mem.stored).toEqual(TRUST_COMMITTEE_DATA);
  });
});

describe("reader path serves the 13 members with no Firestore", () => {
  it("the public projection passes the trustCommittee document through unchanged", () => {
    const projected = projectPublicSettingsDocument("trustCommittee", TRUST_COMMITTEE_DATA);
    expect(projected).toEqual(TRUST_COMMITTEE_DATA);
    expect(countMembers(projected)).toBe(13);
  });

  it("the settings-document read/write modules contain no Firestore/Firebase import", () => {
    const readPath = [
      "hooks/useSettingsDocument.ts",
      "app/api/admin/settings/[key]/route.ts",
      "app/api/public/settings/[key]/route.ts",
      "services/settings-document.service.ts",
      "lib/settings/public-projections.ts",
    ];
    for (const relative of readPath) {
      const source = fs.readFileSync(path.resolve(repoRoot, relative), "utf8");
      expect(source).not.toMatch(/firebase-admin/i);
      expect(source).not.toMatch(/getFirestore|firestore\.google|from ["']firebase/i);
    }
  });
});

describe("Supabase-only: no Firestore in the new files", () => {
  const files = [
    "lib/supabase/seed-data/trust-committee.ts",
    "scripts/seed-trust-committee-supabase.ts",
  ];

  it.each(files)("%s imports no Firestore/Firebase client", (relative) => {
    const source = fs.readFileSync(path.resolve(repoRoot, relative), "utf8");
    expect(source).not.toMatch(/firebase-admin/i);
    expect(source).not.toMatch(/getFirestore|firestore\.google|from ["']firebase/i);
    // It must use the existing Supabase admin client.
    expect(source).toMatch(/supabase/i);
  });

  it("the initialization script targets only the trustCommittee document", () => {
    const source = fs.readFileSync(
      path.resolve(repoRoot, "scripts/seed-trust-committee-supabase.ts"),
      "utf8"
    );
    expect(source).toContain('TRUST_COMMITTEE_DOCUMENT_KEY');
    expect(source).toMatch(/settings_documents/);
    // No other document keys are written.
    expect(source).not.toMatch(/document_key["']?\s*:\s*["'](?!trustCommittee)/);
  });
});
