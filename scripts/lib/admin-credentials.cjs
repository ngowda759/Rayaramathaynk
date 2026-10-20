/**
 * CommonJS twin of scripts/lib/admin-credentials.ts, for the plain .js scripts. Same behaviour; keep both in step.
 *
 * Reads the Firebase service account from, in order:
 *   1. the FIREBASE_SERVICE_ACCOUNT_JSON environment variable (the JSON text of the key file), then
 *   2. the git-ignored .firebase-adminsdk.json at the repository root.
 * Throws when neither is present. Error messages name variables and fields only, never their values.
 */
"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS module for the plain .js scripts */

const fs = require("fs");
const path = require("path");

const ENV_VAR = "FIREBASE_SERVICE_ACCOUNT_JSON";
const DEFAULT_KEY_FILE = path.resolve(__dirname, "..", "..", ".firebase-adminsdk.json");
const MISSING_MESSAGE = "Set FIREBASE_SERVICE_ACCOUNT_JSON or add .firebase-adminsdk.json (git-ignored).";

/**
 * @param {Record<string, unknown>} raw
 * @param {string} snake
 * @param {string} camel
 * @returns {string}
 */
function pickString(raw, snake, camel) {
  const value = raw[snake] ?? raw[camel];
  return typeof value === "string" ? value : "";
}

/**
 * @param {string} text
 * @param {string} source
 * @returns {{ projectId: string, clientEmail: string, privateKey: string }}
 */
function toCredentials(text, source) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`${source} is not valid JSON.`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${source} must hold a service-account JSON object.`);
  }

  const projectId = pickString(raw, "project_id", "projectId").trim();
  const clientEmail = pickString(raw, "client_email", "clientEmail").trim();
  // Keys pasted with escaped newlines ("\\n") are turned back into real line breaks.
  const privateKey = pickString(raw, "private_key", "privateKey").replace(/\\n/g, "\n");

  const missing = [
    projectId ? null : "project_id",
    clientEmail ? null : "client_email",
    privateKey.trim() ? null : "private_key",
  ].filter((field) => field !== null);
  if (missing.length > 0) {
    throw new Error(`${source} is missing: ${missing.join(", ")}.`);
  }

  return { projectId, clientEmail, privateKey };
}

/**
 * @param {{ env?: Record<string, string | undefined>, keyFile?: string }} [options]
 * @returns {{ projectId: string, clientEmail: string, privateKey: string }}
 */
function loadServiceAccount(options = {}) {
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

module.exports = { loadServiceAccount };
