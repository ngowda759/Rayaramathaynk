#!/usr/bin/env node
/**
 * Runs the seva browser tests against a LOCAL Supabase stack.
 *
 * This replaces the old `firebase-tools emulators:exec --only auth,firestore` wrapper. There is no
 * Firebase emulator, no Firestore, and no `demo-seva` project any more: authentication, the `users`
 * role rows and the `staff` rows all come from the local Supabase stack that `supabase start` runs.
 *
 * What it does:
 *   1. Refuses to run outside the repository root.
 *   2. Starts the local stack (`supabase start`) if it is not already up.
 *   3. Reads the stack's API URL and keys from `supabase status -o json`.
 *   4. Hands those to Playwright as environment variables. `tests/e2e/seva/playwright.config.ts`
 *      forwards them to the dev server; `global-setup.ts` seeds the five e2e accounts in the local
 *      Supabase Auth and their `public.users` / `public.staff` rows.
 *
 * Every value here is a *local* one: the API URL is `http://127.0.0.1:<port>` and the keys are the
 * stack's own throwaway keys. Nothing in this file can reach a hosted Supabase project.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

function fail(message) {
  console.error(`run-seva-e2e: ${message}`);
  process.exit(1);
}

if (!existsSync(path.join(REPO_ROOT, "supabase", "config.toml"))) {
  fail(`refusing to run outside the repository root (looked in ${REPO_ROOT})`);
}

/** Prefer the `supabase` binary; fall back to the pinned CLI through npx when it is not on PATH. */
function supabaseCommand(args) {
  const direct = spawnSync("supabase", args, { cwd: REPO_ROOT, encoding: "utf8" });
  if (direct.error && direct.error.code === "ENOENT") {
    return spawnSync("npx", ["--yes", "supabase", ...args], { cwd: REPO_ROOT, encoding: "utf8" });
  }
  return direct;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: REPO_ROOT, stdio: "inherit", env: process.env });
  if (result.error) fail(`could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** Start the stack; `supabase start` is a no-op when it is already running. */
function ensureStack() {
  const start = supabaseCommand(["start"]);
  if (start.status !== 0) {
    fail(
      "could not start the local Supabase stack. Install the Supabase CLI and Docker, then run " +
        "`supabase start` by hand to see the error."
    );
  }
}

/** The local stack's API URL and keys, as JSON, or null when `supabase status` cannot answer. */
function stackStatus() {
  const status = supabaseCommand(["status", "-o", "json"]);
  if (status.status !== 0 || !status.stdout) return null;
  try {
    return JSON.parse(status.stdout);
  } catch {
    return null;
  }
}

ensureStack();

const status = stackStatus();
if (!status) fail("`supabase status -o json` did not return usable JSON; is the local stack running?");

const apiUrl = status.API_URL ?? status.api_url ?? "";
const anonKey = status.ANON_KEY ?? status.anon_key ?? "";
const serviceKey = status.SERVICE_ROLE_KEY ?? status.service_role_key ?? "";
const dbUrl = status.DB_URL ?? status.db_url ?? "";

if (!apiUrl || !anonKey || !serviceKey) {
  fail("the local stack did not report an API URL, anon key and service-role key");
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(apiUrl)) {
  fail(`refusing a non-local Supabase URL (${apiUrl}); the seva e2e suite is local-only`);
}

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  SUPABASE_DB_URL: dbUrl,
  PRISMA_DATABASE_URL: "",
  NEXT_TELEMETRY_DISABLED: "1",
  // Every other secret the app reads stays blank, so a test can never call a paid or live service.
  OPENAI_API_KEY: "",
  ANTHROPIC_API_KEY: "",
  GOOGLE_GENERATIVE_API_KEY: "",
  OPENROUTER_API_KEY: "",
  ADMIN_API_KEY: "",
  BLOB_READ_WRITE_TOKEN: "",
};

const playwright = path.join(REPO_ROOT, "node_modules", ".bin", "playwright");
const args = ["test", "-c", "tests/e2e/seva/playwright.config.ts", ...process.argv.slice(2)];
const result = spawnSync(playwright, args, { cwd: REPO_ROOT, stdio: "inherit", env });
if (result.error) fail(`could not run Playwright: ${result.error.message}`);
process.exit(result.status ?? 1);
