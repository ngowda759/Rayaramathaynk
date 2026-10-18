/**
 * @jest-environment node
 */
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadServiceAccount as loadServiceAccountTs } from "../../../scripts/lib/admin-credentials";

type Loader = typeof loadServiceAccountTs;

// The .js scripts load the CommonJS twin; both must behave the same.
const { loadServiceAccount: loadServiceAccountCjs } = require("../../../scripts/lib/admin-credentials.cjs") as {
  loadServiceAccount: Loader;
};

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const KEY_PATTERNS: RegExp[] = [/PRIVATE KEY-----/, /"private_key"\s*:\s*"-----/];
const MISSING_MESSAGE = "Set FIREBASE_SERVICE_ACCOUNT_JSON or add .firebase-adminsdk.json (git-ignored).";

function trackedScripts(): string[] {
  const out = execFileSync("git", ["ls-files", "scripts"], { cwd: REPO_ROOT, encoding: "utf8" });
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

describe("committed service-account key", () => {
  it("no tracked script embeds a private key", () => {
    const files = trackedScripts();
    expect(files.length).toBeGreaterThan(0);

    // Only file names are reported, never the matching text.
    const offenders = files.filter((file) => {
      const fullPath = path.join(REPO_ROOT, file);
      if (!fs.existsSync(fullPath)) return false;
      const text = fs.readFileSync(fullPath, "utf8");
      return KEY_PATTERNS.some((pattern) => pattern.test(text));
    });

    expect(offenders).toEqual([]);
  });
});

describe.each([
  ["scripts/lib/admin-credentials.ts", loadServiceAccountTs],
  ["scripts/lib/admin-credentials.cjs", loadServiceAccountCjs],
])("loadServiceAccount from %s", (_name, loadServiceAccount) => {
  let tempDir: string;
  let keyFile: string;

  const fileAccount = {
    type: "service_account",
    project_id: "file-project",
    client_email: "file@example.iam.gserviceaccount.com",
    private_key: "file-line-1\nfile-line-2\n",
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "seva-sa-"));
    keyFile = path.join(tempDir, ".firebase-adminsdk.json");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("reads FIREBASE_SERVICE_ACCOUNT_JSON first, even when the key file exists", () => {
    fs.writeFileSync(keyFile, JSON.stringify(fileAccount));
    const env = {
      FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        project_id: "env-project",
        client_email: "env@example.iam.gserviceaccount.com",
        private_key: "env-line-1\\nenv-line-2\\n",
      }),
    };

    expect(loadServiceAccount({ env, keyFile })).toEqual({
      projectId: "env-project",
      clientEmail: "env@example.iam.gserviceaccount.com",
      privateKey: "env-line-1\nenv-line-2\n",
    });
  });

  it("falls back to the git-ignored key file when the variable is not set", () => {
    fs.writeFileSync(keyFile, JSON.stringify(fileAccount));

    expect(loadServiceAccount({ env: {}, keyFile })).toEqual({
      projectId: "file-project",
      clientEmail: "file@example.iam.gserviceaccount.com",
      privateKey: "file-line-1\nfile-line-2\n",
    });
  });

  it("throws the setup message when neither source is present", () => {
    expect(() => loadServiceAccount({ env: {}, keyFile })).toThrow(MISSING_MESSAGE);
  });

  it("never echoes the variable's text when it is not valid JSON", () => {
    const secretText = "not-json-secret-text";
    let message = "";
    try {
      loadServiceAccount({ env: { FIREBASE_SERVICE_ACCOUNT_JSON: secretText }, keyFile });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("FIREBASE_SERVICE_ACCOUNT_JSON");
    expect(message).not.toContain(secretText);
  });

  it("names the missing fields without printing any value", () => {
    const env = { FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: "p-only" }) };
    let message = "";
    try {
      loadServiceAccount({ env, keyFile });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("client_email");
    expect(message).toContain("private_key");
    expect(message).not.toContain("p-only");
  });
});
