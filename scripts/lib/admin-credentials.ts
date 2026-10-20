/**
 * Service-account loader for the maintenance scripts under scripts/.
 *
 * Reads the Firebase service account from, in order:
 *   1. the FIREBASE_SERVICE_ACCOUNT_JSON environment variable (the JSON text of the key file), then
 *   2. the git-ignored .firebase-adminsdk.json at the repository root.
 * Throws when neither is present. Error messages name variables and fields only, never their values.
 *
 * scripts/lib/admin-credentials.cjs is the CommonJS twin used by the plain .js scripts; keep both in step.
 */
import * as fs from "fs";
import * as path from "path";

export interface ServiceAccountCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export interface LoadServiceAccountOptions {
  /** Environment to read; defaults to process.env. */
  env?: Record<string, string | undefined>;
  /** Key file to fall back to; defaults to .firebase-adminsdk.json at the repository root. */
  keyFile?: string;
}

const ENV_VAR = "FIREBASE_SERVICE_ACCOUNT_JSON";
const DEFAULT_KEY_FILE = path.resolve(__dirname, "..", "..", ".firebase-adminsdk.json");
const MISSING_MESSAGE = "Set FIREBASE_SERVICE_ACCOUNT_JSON or add .firebase-adminsdk.json (git-ignored).";

function pickString(raw: Record<string, unknown>, snake: string, camel: string): string {
  const value = raw[snake] ?? raw[camel];
  return typeof value === "string" ? value : "";
}

function toCredentials(text: string, source: string): ServiceAccountCredentials {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`${source} is not valid JSON.`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${source} must hold a service-account JSON object.`);
  }

  const record = raw as Record<string, unknown>;
  const projectId = pickString(record, "project_id", "projectId").trim();
  const clientEmail = pickString(record, "client_email", "clientEmail").trim();
  // Keys pasted with escaped newlines ("\\n") are turned back into real line breaks.
  const privateKey = pickString(record, "private_key", "privateKey").replace(/\\n/g, "\n");

  const missing = [
    projectId ? null : "project_id",
    clientEmail ? null : "client_email",
    privateKey.trim() ? null : "private_key",
  ].filter((field): field is string => field !== null);
  if (missing.length > 0) {
    throw new Error(`${source} is missing: ${missing.join(", ")}.`);
  }

  return { projectId, clientEmail, privateKey };
}

export function loadServiceAccount(options: LoadServiceAccountOptions = {}): ServiceAccountCredentials {
  const env = options.env ?? process.env;
  const keyFile = options.keyFile ?? DEFAULT_KEY_FILE;

  const fromEnv = env[ENV_VAR];
  if (fromEnv && fromEnv.trim() !== "") {
    return toCredentials(fromEnv, ENV_VAR);
  }

  if (fs.existsSync(keyFile)) {
    return toCredentials(fs.readFileSync(keyFile, "utf8"), path.basename(keyFile));
  }

  throw new Error(MISSING_MESSAGE);
}
