/**
 * @jest-environment node
 *
 * Consolidated missing-settings initialization — pure logic, guards and source checks.
 *
 * The production investigation found several `settings_documents` keys missing. This
 * suite pins the allowlisted initialization set, the insert-only planning/runner, the
 * target guards of the script, and the "Supabase only, no Firestore" property. The
 * database write path itself is proven against a real (PGlite) Postgres in
 * `tests/db/settings-initialization.test.ts`.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  EXCLUDED_SETTINGS_KEYS,
  SETTINGS_INITIALIZATION_KEYS,
  classifySettingRow,
  matchesSeed,
  planSettingInitialization,
  runSettingsInitialization,
  settingsSeedFor,
  validateSettingsInitialization,
  verifySettingsInitialization,
  type SettingsInitPort,
} from "@/lib/supabase/seed-data/settings-initialization";
import { SETTINGS_DOCUMENT_SEEDS } from "@/lib/supabase/seed-data/settings-documents";

const repoRoot = path.resolve(__dirname, "../..");
const script = path.resolve(repoRoot, "scripts/seed-missing-settings-supabase.ts");
const approvedLib = path.resolve(repoRoot, "scripts/lib/approved-project.mjs");

/** Read the approved ref from the shared library (ts-jest cannot import an `.mjs`). */
const APPROVED_PROJECT_REF = (() => {
  const r = spawnSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `import * as m from ${JSON.stringify(pathToFileURL(approvedLib).href)}; process.stdout.write(m.APPROVED_PROJECT_REF)`,
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`could not read the approved ref: ${r.stderr}`);
  return r.stdout.trim();
})();

/** An in-memory `SettingsInitPort` that records every write. */
function memoryPort(initial: Record<string, unknown> = {}) {
  const rows = new Map<string, unknown>(Object.entries(initial));
  const writes: string[] = [];
  const port: SettingsInitPort = {
    async readRow(key) {
      return rows.has(key) ? rows.get(key) : null;
    },
    async insertRow(key, data, fieldCount) {
      writes.push(`${key}:${fieldCount}`);
      // Insert-only: never overwrite an existing row.
      if (!rows.has(key)) rows.set(key, data);
    },
  };
  return { port, rows, writes };
}

describe("initialization set", () => {
  it("initializes exactly the homepage document", () => {
    expect(SETTINGS_INITIALIZATION_KEYS).toEqual(["homepage"]);
  });

  it("only lists keys that have a canonical seed document", () => {
    for (const key of SETTINGS_INITIALIZATION_KEYS) {
      expect(settingsSeedFor(key)).toBeDefined();
    }
  });

  it("passes validation", () => {
    expect(validateSettingsInitialization()).toEqual([]);
  });

  it("documents every deliberately excluded key with a reason", () => {
    const keys = EXCLUDED_SETTINGS_KEYS.map((entry) => entry.key).sort();
    expect(keys).toEqual(
      ["device", "ekadashiCalendar", "festivalCalendar", "guruParampara", "shlokas", "socialLinks"].sort(),
    );
    for (const entry of EXCLUDED_SETTINGS_KEYS) {
      expect(entry.reason.length).toBeGreaterThan(0);
      // A key is never both initialized and excluded.
      expect(SETTINGS_INITIALIZATION_KEYS).not.toContain(entry.key);
    }
  });

  it("never initializes an admin-only or canonical-less key", () => {
    for (const key of ["shlokas", "festivalCalendar", "ekadashiCalendar", "device", "socialLinks", "guruParampara"]) {
      expect(SETTINGS_INITIALIZATION_KEYS).not.toContain(key);
    }
  });
});

describe("classification and planning", () => {
  const homepage = settingsSeedFor("homepage")!;

  it("treats null/undefined as missing (to be inserted)", () => {
    expect(classifySettingRow(null, homepage)).toBe("missing");
    expect(classifySettingRow(undefined, homepage)).toBe("missing");
    expect(planSettingInitialization("homepage", null).action).toBe("insert");
  });

  it("treats the canonical document as a match (no-op)", () => {
    expect(matchesSeed(homepage.data, homepage)).toBe(true);
    expect(classifySettingRow(homepage.data, homepage)).toBe("matches");
    expect(planSettingInitialization("homepage", homepage.data).action).toBe("noop");
  });

  it("treats a differing stored document as present (no-op, never overwritten)", () => {
    const ownerEdit = { ...homepage.data, heroTitle: "Owner Edited Title" };
    expect(classifySettingRow(ownerEdit, homepage)).toBe("present");
    const plan = planSettingInitialization("homepage", ownerEdit);
    expect(plan.action).toBe("noop");
    expect(plan.reason).toMatch(/left untouched/i);
  });
});

describe("runSettingsInitialization", () => {
  const homepageSeed = settingsSeedFor("homepage")!.data;

  it("inserts a missing homepage row on execute", async () => {
    const { port, rows, writes } = memoryPort();
    const result = await runSettingsInitialization(port, { execute: true });
    expect(result.wrote).toBe(true);
    expect(result.inserted).toEqual(["homepage"]);
    expect(rows.get("homepage")).toEqual(homepageSeed);
    expect(writes).toHaveLength(1);
  });

  it("performs zero writes on a dry run", async () => {
    const { port, rows, writes } = memoryPort();
    const result = await runSettingsInitialization(port, { execute: false });
    expect(result.wrote).toBe(false);
    expect(result.inserted).toEqual([]);
    expect(writes).toEqual([]);
    expect(rows.size).toBe(0);
    // The plan still reports what would happen.
    expect(result.entries[0].state).toBe("missing");
    expect(result.entries[0].action).toBe("insert");
  });

  it("is idempotent: a second execute run writes nothing", async () => {
    const { port, writes } = memoryPort();
    await runSettingsInitialization(port, { execute: true });
    const second = await runSettingsInitialization(port, { execute: true });
    expect(second.wrote).toBe(false);
    expect(second.inserted).toEqual([]);
    expect(second.untouched).toEqual(["homepage"]);
    expect(writes).toHaveLength(1);
  });

  it("does not overwrite an existing homepage row (owner edit preserved)", async () => {
    const ownerEdit = { heroTitle: "Owner Edited Title" };
    const { port, rows, writes } = memoryPort({ homepage: ownerEdit });
    const result = await runSettingsInitialization(port, { execute: true });
    expect(result.wrote).toBe(false);
    expect(writes).toEqual([]);
    expect(rows.get("homepage")).toEqual(ownerEdit);
  });

  it("leaves every other populated settings document untouched", async () => {
    const existing = {
      trustCommittee: { members: [{ id: "1" }] },
      aboutUs: { templeName: "Owner Value" },
      facilities: { facilities: [] },
      footer: { copyright: "Owner" },
    };
    const { port, rows } = memoryPort(existing);
    await runSettingsInitialization(port, { execute: true });
    for (const [key, value] of Object.entries(existing)) {
      expect(rows.get(key)).toEqual(value);
    }
    expect(rows.size).toBe(Object.keys(existing).length + 1); // + homepage
  });
});

describe("verifySettingsInitialization", () => {
  it("passes when the canonical document is present", async () => {
    const { port } = memoryPort({ homepage: settingsSeedFor("homepage")!.data });
    expect(await verifySettingsInitialization(port)).toEqual([]);
  });

  it("detects a still-missing document", async () => {
    const { port } = memoryPort();
    const failures = await verifySettingsInitialization(port);
    expect(failures.join("\n")).toMatch(/homepage: still missing/);
  });

  it("detects an incorrect document", async () => {
    const { port } = memoryPort({ homepage: { heroTitle: "wrong" } });
    const failures = await verifySettingsInitialization(port);
    expect(failures.join("\n")).toMatch(/homepage: stored document does not match/);
  });
});

describe("Supabase-only: no Firestore in the new files", () => {
  const files = [
    "lib/supabase/seed-data/settings-initialization.ts",
    "scripts/seed-missing-settings-supabase.ts",
  ];

  it.each(files)("%s imports no Firestore/Firebase client", (relative) => {
    const source = fs.readFileSync(path.resolve(repoRoot, relative), "utf8");
    expect(source).not.toMatch(/firebase-admin/i);
    expect(source).not.toMatch(/getFirestore|firestore\.google|from ["']firebase/i);
    expect(source).toMatch(/supabase/i);
  });
});

describe("target guards (executed as a real child process)", () => {
  function run(args: string[], env: Record<string, string | undefined> = {}) {
    const base: Record<string, string | undefined> = { ...process.env };
    for (const key of [
      "CI",
      "VERCEL",
      "DRY_RUN",
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      delete base[key];
    }
    return spawnSync("npx", ["--no-install", "tsx", "--conditions=react-server", script, ...args], {
      cwd: repoRoot,
      env: { ...base, ...env } as NodeJS.ProcessEnv,
      encoding: "utf8",
    });
  }

  it("refuses an unverifiable target", () => {
    const r = run(["--dry-run"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/unverifiable target/i);
  });

  it("refuses --execute without the confirmation phrase", () => {
    const r = run(["--execute"], {
      NEXT_PUBLIC_SUPABASE_URL: `https://${APPROVED_PROJECT_REF}.supabase.co`,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--confirm initialize-missing-settings/);
  });

  it("refuses a non-approved target on --execute without the test flag", () => {
    const r = run(["--execute", "--confirm", "initialize-missing-settings"], {
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/non-approved project/i);
  });

  it("refuses a ref that looks like production but is not the approved project", () => {
    const r = run(["--dry-run"], {
      NEXT_PUBLIC_SUPABASE_URL: "https://prodxyzabcdefghijklm.supabase.co",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/looks like production/i);
  });

  it("refuses when CI or VERCEL is set", () => {
    for (const key of ["CI", "VERCEL"] as const) {
      const r = run(["--dry-run"], {
        NEXT_PUBLIC_SUPABASE_URL: `https://${APPROVED_PROJECT_REF}.supabase.co`,
        [key]: "1",
      });
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/CI or VERCEL/i);
    }
  });

  it("accepts the approved production target in dry-run and prints the fingerprint only", () => {
    const r = run(["--dry-run"], {
      NEXT_PUBLIC_SUPABASE_URL: `https://${APPROVED_PROJECT_REF}.supabase.co`,
    });
    // Reaches the credentials check (guard passed), and never prints the ref itself.
    expect(r.stdout).toMatch(/MISSING SETTINGS INITIALIZATION/);
    expect(r.stdout).toMatch(/DRY RUN/);
    expect(r.stdout).not.toContain(APPROVED_PROJECT_REF);
  });
});

describe("canonical seed coverage", () => {
  it("the homepage seed exists in the canonical seed set", () => {
    expect(SETTINGS_DOCUMENT_SEEDS.map((s) => s.documentKey)).toContain("homepage");
  });
});
