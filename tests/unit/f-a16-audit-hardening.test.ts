/**
 * @jest-environment node
 *
 * F-A16 audit hardening. These tests exercise the read-only catalog audit's safety
 * logic without a database: the age-recipient validator is spawned as a CLI, and
 * the runner/identity modules are imported inside a Node harness (they are ESM
 * `.mjs`, which ts-jest cannot import directly — the repository's convention is to
 * spawn `node`). Every fake is injected at a module boundary; no `pg` driver and no
 * network are involved.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const APPROVED = "kvrkraqjuyxbraccxntk";
const OTHER = "zzzzzzzzzzzzzzzzzzzz";
const PW_SENTINEL = "sup3rs3cret-pw-must-not-leak";

const AGE_RECIPIENT_CLI = path.join(ROOT, "scripts/lib/age-recipient.mjs");
const RUNNER = path.join(ROOT, "scripts/lib/run-catalog-audit.mjs");
const IDENTITY = path.join(ROOT, "scripts/lib/verify-production-identity.mjs");
const WORKFLOW = path.join(ROOT, ".github/workflows/f-a16-production-catalog-audit.yml");
const SQL_FILE = path.join(ROOT, "docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql");

/**
 * A deterministic, structurally valid age recipient (bech32 `age` + valid
 * checksum) generated from fixed bytes. It is NOT anyone's key material: nothing
 * holds the matching private key, so it can only ever validate, never decrypt.
 */
const VALID_RECIPIENT = "age1qv9pzxqlyckngw6zf9g9whn9d3eh4qvg37tfmf9tk2uup37w6hwqg0ha8h";

const agePresent = spawnSync("age", ["--version"], { encoding: "utf8" }).status === 0;

/** Run the age-recipient CLI with a controlled environment. */
function runAgeRecipient(env: Record<string, string | undefined>) {
  const base: Record<string, string> = { ...(process.env as Record<string, string>) };
  delete base.F_A16_AUDIT_AGE_RECIPIENT;
  delete base.SEVA_BACKUP_AGE_RECIPIENT;
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete base[k];
    else base[k] = v;
  }
  return spawnSync("node", [AGE_RECIPIENT_CLI], { cwd: ROOT, encoding: "utf8", env: base });
}

/**
 * Import one of the ESM modules in a Node harness and print the JSON it returns.
 * The harness writes a temp `.mjs` next to nothing — it lives in the OS temp dir
 * and imports the repository module by absolute path.
 */
function runHarness<T = unknown>(body: string, env: Record<string, string> = {}): {
  status: number | null;
  stdout: string;
  stderr: string;
  result: T | null;
} {
  const dir = mkdtempSync(path.join(tmpdir(), "f-a16-harness-"));
  const file = path.join(dir, "harness.mjs");
  writeFileSync(
    file,
    `import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";\n` +
      `const APPROVED = ${JSON.stringify(APPROVED)};\n` +
      `const OTHER = ${JSON.stringify(OTHER)};\n` +
      `const PW_SENTINEL = ${JSON.stringify(PW_SENTINEL)};\n` +
      body +
      `\n`,
    "utf8"
  );
  try {
    const r = spawnSync("node", [file], { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...env } });
    let result: T | null = null;
    const line = r.stdout.split("\n").find((l) => l.startsWith("__RESULT__"));
    if (line) result = JSON.parse(line.slice("__RESULT__".length)) as T;
    return { status: r.status, stdout: r.stdout, stderr: r.stderr, result };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A stand-in for a connected `pg` client. Records queries; never touches a socket. */
const FAKE_CLIENT = `
function fakeClient(opts) {
  opts = opts || {};
  const state = { n: 0, queries: [] };
  return {
    state,
    async connect() {},
    async end() {},
    async query(sql, params) {
      const s = String(sql);
      state.queries.push(s);
      if (s === "show transaction_read_only") return { rows: [{ transaction_read_only: opts.ro || "on" }] };
      if (s === "show default_transaction_read_only") return { rows: [{ default_transaction_read_only: opts.defRo || "on" }] };
      if (s.startsWith("select current_setting")) {
        const name = params && params[0];
        return { rows: [{ value: (opts.settings || {})[name] ?? null }] };
      }
      if (s.startsWith("select rolname from pg_roles")) {
        const roles = opts.roles || ["anon", "authenticated", "service_role"];
        return { rows: roles.map((r) => ({ rolname: r })) };
      }
      if (s.startsWith("select current_database()")) {
        return { rows: [{ db: "postgres", role: "postgres", server_addr: "10.0.0.1", version: "PostgreSQL 15.1" }] };
      }
      if (s === "BEGIN READ ONLY" || s === "ROLLBACK") return { rows: [] };
      state.n += 1;
      if (opts.failStmt && state.n === opts.failStmt) {
        throw new Error(opts.failMessage || "permission denied for relation secret_table");
      }
      return { rows: [{ x: 1 }] };
    },
  };
}
`;

describe("F-A16 age recipient validation", () => {
  it("accepts a structurally valid age recipient", () => {
    const r = runAgeRecipient({ F_A16_AUDIT_AGE_RECIPIENT: VALID_RECIPIENT });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/validation passed/);
    // The key value itself is never echoed.
    expect(r.stdout).not.toContain(VALID_RECIPIENT);
  });

  it("refuses when no recipient is set at all", () => {
    const r = runAgeRecipient({});
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/no age recipient is set/);
  });

  it("refuses a string that merely contains 'age1'", () => {
    for (const bad of ["not-an-age1-key", "xxage1yy", "AGE1ABCDEF", "age1"]) {
      const r = runAgeRecipient({ F_A16_AUDIT_AGE_RECIPIENT: bad });
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/REFUSING/);
    }
  });

  it("refuses an age recipient whose checksum is wrong", () => {
    const corrupted = VALID_RECIPIENT.slice(0, -1) + (VALID_RECIPIENT.endsWith("x") ? "q" : "x");
    const r = runAgeRecipient({ F_A16_AUDIT_AGE_RECIPIENT: corrupted });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/checksum/);
  });

  it("refuses an upper-case recipient", () => {
    const r = runAgeRecipient({ F_A16_AUDIT_AGE_RECIPIENT: VALID_RECIPIENT.toUpperCase() });
    expect(r.status).toBe(1);
  });

  it("refuses when one of several recipients is invalid, and never echoes the secret", () => {
    const r = runAgeRecipient({
      F_A16_AUDIT_AGE_RECIPIENT: `${VALID_RECIPIENT} AGE-SECRET-KEY-1ABC`,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).not.toContain("AGE-SECRET-KEY");
    expect(r.stderr).not.toContain(VALID_RECIPIENT);
  });

  it("falls back to SEVA_BACKUP_AGE_RECIPIENT", () => {
    const r = runAgeRecipient({ SEVA_BACKUP_AGE_RECIPIENT: VALID_RECIPIENT });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/SEVA_BACKUP_AGE_RECIPIENT/);
  });

  (agePresent ? it : it.skip)("agrees with the real age tooling on a generated key", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "f-a16-agekey-"));
    try {
      const keyFile = path.join(dir, "k.txt");
      const gen = spawnSync("age-keygen", ["-o", keyFile], { encoding: "utf8" });
      expect(gen.status).toBe(0);
      const key = /age1[a-z0-9]+/.exec(readFileSync(keyFile, "utf8"))?.[0];
      expect(key).toBeTruthy();
      const r = runAgeRecipient({ F_A16_AUDIT_AGE_RECIPIENT: key as string });
      expect(r.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("F-A16 workflow ordering and output confidentiality", () => {
  const workflow = readFileSync(WORKFLOW, "utf8");
  const lines = workflow.split("\n");

  it("validates the age recipient before deriving or probing the production connection", () => {
    const ageIdx = lines.findIndex((l) => /name: Install age and validate the encryption recipient/.test(l));
    const deriveIdx = lines.findIndex((l) => /name: Derive and verify target connection/.test(l));
    const auditIdx = lines.findIndex((l) => /name: Run read-only catalog audit/.test(l));
    expect(ageIdx).toBeGreaterThan(-1);
    expect(deriveIdx).toBeGreaterThan(-1);
    expect(auditIdx).toBeGreaterThan(-1);
    expect(ageIdx).toBeLessThan(deriveIdx);
    expect(ageIdx).toBeLessThan(auditIdx);
  });

  it("never prints the catalog output file to the log or the job summary", () => {
    // The only permitted references to the audit log are the runner writing it,
    // encrypting it, and existence checks — never cat/echo/tee into a public log.
    expect(workflow).not.toMatch(/\bcat\b[^\n]*f-a16-audit\.log/);
    expect(workflow).not.toMatch(/\btee\b/);
    expect(workflow).not.toMatch(/echo\s+"\$\(cat/);
    // The summary must not read the catalog log.
    const summary = workflow.slice(workflow.indexOf("Write a non-sensitive job summary"));
    expect(summary).not.toContain("f-a16-audit.log");
  });

  it("uploads only the encrypted artifact", () => {
    const uploadIdx = workflow.indexOf("actions/upload-artifact");
    const upload = workflow.slice(uploadIdx, uploadIdx + 500);
    // The uploaded path is the encrypt step's output, never the plaintext log.
    expect(upload).toContain("steps.encrypt.outputs.file");
    expect(upload).not.toContain("f-a16-audit.log");
    expect(upload).toMatch(/retention-days/);
  });

  it("gates the upload on the encrypted file existing and always encrypts", () => {
    expect(workflow).toMatch(/name: Encrypt the audit output\n\s+id: encrypt\n\s+if: always\(\)/);
    expect(workflow).toMatch(/name: Upload the encrypted audit artifact\n\s+if: steps\.encrypt\.outputs\.file != ''/);
  });

  it("fails the job when the audit was incomplete", () => {
    expect(workflow).toMatch(/name: Fail when the audit was incomplete/);
    expect(workflow).toMatch(/AUDIT_EXIT_CODE/);
  });

  it("keeps the production project allowlist and SELECT-only SQL unchanged", () => {
    // The file's comments describe the prohibitions; only the executable statements
    // must be free of them. Strip `--` comments before checking.
    const sql = readFileSync(SQL_FILE, "utf8")
      .split("\n")
      .map((l) => l.replace(/--.*$/, ""))
      .join("\n");
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE|CREATE|ALTER|DROP)\b/i);
    // The approved ref lives in exactly one place in the repository guard module.
    const approved = readFileSync(path.join(ROOT, "scripts/lib/approved-project.mjs"), "utf8");
    expect(approved).toContain(APPROVED);
  });
});

describe("F-A16 identity verification (pure decision function)", () => {
  const harness = `
    const { evaluateIdentity, regionFromPoolerHost } = await import(${JSON.stringify(IDENTITY)});
    const base = {
      settings: {},
      roles: ["anon", "authenticated", "service_role"],
      database: "postgres",
      role: "postgres",
    };
    const apiOk = { ok: true, ref: APPROVED, region: "ap-south-1" };
    const out = {
      regionParse: regionFromPoolerHost("aws-0-ap-south-1.pooler.supabase.com"),
      happy: evaluateIdentity({ ...base, managementApi: apiOk, connectedHostRegion: "ap-south-1" }),
      wrongSettingRef: evaluateIdentity({
        ...base,
        settings: { "supabase.url": "https://" + OTHER + ".supabase.co" },
        managementApi: apiOk,
        connectedHostRegion: "ap-south-1",
      }),
      apiMissing: evaluateIdentity({ ...base, managementApi: { ok: false, reason: "no token" }, connectedHostRegion: "ap-south-1" }),
      apiWrongRef: evaluateIdentity({ ...base, managementApi: { ok: true, ref: OTHER, region: "ap-south-1" }, connectedHostRegion: "ap-south-1" }),
      regionMismatch: evaluateIdentity({ ...base, managementApi: apiOk, connectedHostRegion: "us-east-1" }),
      noRegion: evaluateIdentity({ ...base, managementApi: apiOk, connectedHostRegion: "" }),
      notSupabase: evaluateIdentity({ ...base, roles: ["postgres"], managementApi: apiOk, connectedHostRegion: "ap-south-1" }),
    };
    console.log("__RESULT__" + JSON.stringify(out));
  `;

  it("accepts only when control-plane, region and Supabase roles all agree", () => {
    const { result } = runHarness<Record<string, { ok: boolean; reason: string }>>(harness);
    expect(result).toBeTruthy();
    const r = result as Record<string, { ok: boolean; reason: string }>;
    expect(r.regionParse).toBe("ap-south-1");
    expect(r.happy.ok).toBe(true);
  });

  it("fails closed when the control plane cannot confirm identity", () => {
    const { result } = runHarness<Record<string, { ok: boolean }>>(harness);
    const r = result as Record<string, { ok: boolean }>;
    expect(r.apiMissing.ok).toBe(false);
    expect(r.apiWrongRef.ok).toBe(false);
    expect(r.noRegion.ok).toBe(false);
  });

  it("rejects a different project, a region mismatch, or a non-Supabase look-alike", () => {
    const { result } = runHarness<Record<string, { ok: boolean }>>(harness);
    const r = result as Record<string, { ok: boolean }>;
    expect(r.wrongSettingRef.ok).toBe(false);
    expect(r.regionMismatch.ok).toBe(false);
    expect(r.notSupabase.ok).toBe(false);
  });
});

describe("F-A16 runner safety seams", () => {
  it("classifies a partial audit as a non-zero exit code", () => {
    const { result } = runHarness<{ incomplete: number; complete: number }>(`
      const m = await import(${JSON.stringify(RUNNER)});
      console.log("__RESULT__" + JSON.stringify({ incomplete: m.exitCodeFor(true), complete: m.exitCodeFor(false) }));
    `);
    expect(result).toEqual({ incomplete: 3, complete: 0 });
  });

  it("aborts when the session is not read-only", () => {
    const { result } = runHarness<{ ok: boolean }>(`
      const m = await import(${JSON.stringify(RUNNER)});
      let ok = true;
      try { await m.assertReadOnlySession(async () => ({ rows: [{ transaction_read_only: "off", default_transaction_read_only: "off" }] })); }
      catch { ok = false; }
      console.log("__RESULT__" + JSON.stringify({ ok }));
    `);
    expect(result?.ok).toBe(false);
  });

  it("aborts when identity cannot be established, before any catalog query", () => {
    const { result } = runHarness<{ threw: boolean; catalogRan: boolean }>(`
      ${FAKE_CLIENT}
      const m = await import(${JSON.stringify(RUNNER)});
      const client = fakeClient({ settings: { "supabase.url": "https://" + OTHER + ".supabase.co" } });
      let threw = false;
      try {
        await m.runAudit({
          client,
          outFile: "/dev/null",
          checked: [{ i: 1, sql: "select 1" }],
          managementApi: { ok: true, ref: APPROVED, region: "ap-south-1" },
          hostRegion: "ap-south-1",
        });
      } catch { threw = true; }
      const catalogRan = client.state.queries.some((q) => q === "select 1");
      console.log("__RESULT__" + JSON.stringify({ threw, catalogRan }));
    `);
    expect(result?.threw).toBe(true);
    expect(result?.catalogRan).toBe(false);
  });

  it("completes with exit 0 when every statement runs", () => {
    const { result } = runHarness<{ exitCode: number; complete: boolean }>(`
      ${FAKE_CLIENT}
      const m = await import(${JSON.stringify(RUNNER)});
      const client = fakeClient({});
      const outFile = "/tmp/f-a16-happy-" + process.pid + ".log";
      const r = await m.runAudit({
        client,
        outFile,
        checked: [{ i: 1, sql: "select 1" }, { i: 2, sql: "select 2" }],
        managementApi: { ok: true, ref: APPROVED, region: "ap-south-1" },
        hostRegion: "ap-south-1",
      });
      const body = readFileSync(outFile, "utf8");
      rmSync(outFile, { force: true });
      console.log("__RESULT__" + JSON.stringify({ exitCode: r.exitCode, complete: body.includes("AUDIT INCOMPLETE") === false }));
    `);
    expect(result).toEqual({ exitCode: 0, complete: true });
  });

  it("marks the audit incomplete, preserves partial rows, and exits non-zero on a failed statement", () => {
    const { result } = runHarness<{
      exitCode: number;
      failed: number;
      incomplete: boolean;
      marked: boolean;
      preserved: boolean;
      leaked: boolean;
    }>(`
      ${FAKE_CLIENT}
      const m = await import(${JSON.stringify(RUNNER)});
      const client = fakeClient({ failStmt: 2 });
      const outFile = "/tmp/f-a16-partial-" + process.pid + ".log";
      const r = await m.runAudit({
        client,
        outFile,
        checked: [{ i: 1, sql: "select 1" }, { i: 2, sql: "select 2" }, { i: 3, sql: "select 3" }],
        managementApi: { ok: true, ref: APPROVED, region: "ap-south-1" },
        hostRegion: "ap-south-1",
      });
      const body = readFileSync(outFile, "utf8");
      rmSync(outFile, { force: true });
      console.log("__RESULT__" + JSON.stringify({
        exitCode: r.exitCode,
        failed: r.failed.length,
        incomplete: r.incomplete,
        marked: body.includes("AUDIT INCOMPLETE"),
        preserved: body.includes("stmt 1 (1 row(s))") && body.includes("stmt 3 (1 row(s))"),
        leaked: body.includes(PW_SENTINEL),
      }));
    `);
    expect(result?.exitCode).toBe(3);
    expect(result?.failed).toBe(1);
    expect(result?.incomplete).toBe(true);
    expect(result?.marked).toBe(true);
    expect(result?.preserved).toBe(true);
  });

  it("redacts credentials from a failing statement's recorded error", () => {
    const dbUrl = `postgresql://postgres.${APPROVED}:${PW_SENTINEL}@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`;
    const { result } = runHarness<{ body: string; summaryLeaks: boolean }>(
      `
      ${FAKE_CLIENT}
      const m = await import(${JSON.stringify(RUNNER)});
      const client = fakeClient({
        failStmt: 1,
        // The password appears bare, not only after password=, so the literal
        // redaction path (seeded from F_A16_DB_URL) is what must catch it.
        failMessage: "auth failed for postgres." + APPROVED + " with secret " + PW_SENTINEL,
      });
      const outFile = "/tmp/f-a16-redact-" + process.pid + ".log";
      const r = await m.runAudit({
        client,
        outFile,
        checked: [{ i: 1, sql: "select 1" }],
        managementApi: { ok: true, ref: APPROVED, region: "ap-south-1" },
        hostRegion: "ap-south-1",
      });
      const body = readFileSync(outFile, "utf8");
      rmSync(outFile, { force: true });
      console.log("__RESULT__" + JSON.stringify({
        body,
        summaryLeaks: body.includes(PW_SENTINEL) || body.includes("postgres." + APPROVED),
      }));
    `,
      { F_A16_DB_URL: dbUrl }
    );
    expect(result?.summaryLeaks).toBe(false);
    // Prove the redaction was not vacuous: the password was in the message.
    expect(result?.body).toContain("stmt 1 FAILED");
  });

  it("redact() removes a password and the pooler username from arbitrary text", () => {
    const { result } = runHarness<{ redacted: string }>(`
      const m = await import(${JSON.stringify(RUNNER)});
      const url = "postgresql://postgres." + APPROVED + ":" + PW_SENTINEL + "@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
      console.log("__RESULT__" + JSON.stringify({ redacted: m.redact("failed: " + url) }));
    `);
    expect(result?.redacted).not.toContain(PW_SENTINEL);
    expect(result?.redacted).not.toContain(APPROVED);
  });
});

describe("F-A16 runner destination guard (CLI)", () => {
  it("refuses to run without a connection string", () => {
    const r = spawnSync("node", [RUNNER, SQL_FILE, "/tmp/never.log"], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, F_A16_DB_URL: "" },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/F_A16_DB_URL is not set/);
  });

  it("refuses a connection string for a different project, leaking nothing", () => {
    const url = `postgresql://postgres.${OTHER}:${PW_SENTINEL}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;
    const r = spawnSync("node", [RUNNER, SQL_FILE, "/tmp/never.log"], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, F_A16_DB_URL: url },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/not the approved production project/);
    expect(r.stderr).not.toContain(PW_SENTINEL);
    expect(r.stderr).not.toContain(OTHER);
  });
});
