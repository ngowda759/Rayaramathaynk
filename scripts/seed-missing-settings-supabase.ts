/**
 * Consolidated Supabase-only initialization of missing `settings_documents` rows.
 *
 * Production was found to be missing several `settings_documents` keys the application
 * reads. This one command fills the missing rows from the canonical seed data already
 * in this repository (`SETTINGS_DOCUMENT_SEEDS`) and never touches a row that already
 * exists. It is the single reviewed replacement for the earlier per-key one-offs.
 *
 * It is Supabase-only: it uses the existing Supabase admin client
 * (`@/lib/supabase/admin`), writes only the allowlisted `settings_documents` keys,
 * never reads or writes Firestore, and never creates or alters schema. It is
 * insert-only — there is deliberately no `--force`/overwrite path, so an owner-edited
 * document can never be clobbered.
 *
 * Usage (dry run is the default; nothing is written without `--execute`):
 *
 *   npx tsx --conditions=react-server scripts/seed-missing-settings-supabase.ts
 *   npx tsx --conditions=react-server scripts/seed-missing-settings-supabase.ts \
 *     --execute --confirm initialize-missing-settings
 *
 * The `--conditions=react-server` flag is required because the Supabase admin client
 * imports `server-only` (the same reason `npm run seed:trust-committee` passes it).
 * `npm run seed:missing-settings` wraps this.
 *
 * Flags:
 *   --execute                          perform the writes (default: dry run)
 *   --confirm <phrase>                 required with --execute; must be exactly
 *                                      "initialize-missing-settings"
 *   --project-ref <ref>                the target ref; must match NEXT_PUBLIC_SUPABASE_URL
 *   --yes-this-is-a-test-project       allow a NON-approved ref with --execute
 *   --help                             show this message
 *
 *   DRY_RUN=true in the environment forces a dry run even with --execute.
 *
 * Target guard (fail closed): the project ref is read from NEXT_PUBLIC_SUPABASE_URL.
 * An unrecognised or unverifiable ref is refused. The approved production project is
 * the intended target and is allowed with the explicit confirmation phrase; any other
 * ref needs `--yes-this-is-a-test-project` and must not look like production. CI and
 * VERCEL refuse the run so it can never fire automatically.
 *
 * Environment (read from the process, then `.env.local` / `.env`):
 *   NEXT_PUBLIC_SUPABASE_URL     e.g. https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    the service-role key (never printed)
 *
 * The target project ref and a non-reversible fingerprint are printed so the operator
 * can confirm the target before writing. No key or secret is ever printed.
 */

import * as path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  EXCLUDED_SETTINGS_KEYS,
  SETTINGS_INITIALIZATION_KEYS,
  runSettingsInitialization,
  validateSettingsInitialization,
  verifySettingsInitialization,
  type SettingsInitPort,
} from "../lib/supabase/seed-data/settings-initialization";
import { APPROVED_PROJECT_REF, fingerprint, isApprovedRef, refFromSupabaseUrl } from "./lib/approved-project.mjs";

const CONFIRM_PHRASE = "initialize-missing-settings";

interface Options {
  execute: boolean;
  confirm?: string;
  projectRef?: string;
  testProject: boolean;
  help: boolean;
}

const USAGE = [
  "Usage: npx tsx --conditions=react-server scripts/seed-missing-settings-supabase.ts [--execute --confirm initialize-missing-settings]",
  "",
  "  --execute                     perform the writes (default: dry run)",
  "  --dry-run                     force a dry run (the default)",
  `  --confirm <phrase>            required with --execute; must be "${CONFIRM_PHRASE}"`,
  "  --project-ref <ref>           the target ref; must match NEXT_PUBLIC_SUPABASE_URL",
  "  --yes-this-is-a-test-project  allow a NON-approved ref with --execute",
  "  --help                        show this message",
  "",
  "  DRY_RUN=true in the environment forces a dry run even with --execute.",
].join("\n");

export function parseArgs(argv: string[]): Options {
  const options: Options = { execute: false, testProject: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--execute") options.execute = true;
    else if (arg === "--dry-run") options.execute = false;
    else if (arg === "--yes-this-is-a-test-project") options.testProject = true;
    else if (arg === "--confirm") options.confirm = argv[(i += 1)];
    else if (arg === "--project-ref") options.projectRef = argv[(i += 1)];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

/** `DRY_RUN=true` (or `1` / `yes`) forces a dry run even with `--execute`. */
export function envIsDryRun(env: NodeJS.ProcessEnv): boolean {
  const value = (env.DRY_RUN ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/**
 * Decide whether the run may proceed against the resolved target. Returns a refusal
 * message, or `null` when the target is acceptable. `execute` is the effective mode
 * (after `DRY_RUN`), so a dry run is only refused when the target cannot be resolved.
 */
export function checkTargetGuard(
  options: { execute: boolean; projectRef?: string; testProject: boolean },
  env: NodeJS.ProcessEnv
): string | null {
  if (env.CI || env.VERCEL) {
    return "Refusing to run: CI or VERCEL is set. Production initialization is a manual, owner-approved action.";
  }

  const ref = refFromSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (!ref) {
    return "NEXT_PUBLIC_SUPABASE_URL does not resolve to a <ref>.supabase.co project. Refusing an unverifiable target.";
  }
  if (options.projectRef && options.projectRef !== ref) {
    return "--project-ref does not match NEXT_PUBLIC_SUPABASE_URL. Refusing an unexpected target.";
  }

  // The approved production project is the intended target: it needs the confirmation
  // phrase (checked by the caller) but no test flag. Any other ref must be explicitly
  // confirmed as a test project before a write, and must never look like production.
  if (!isApprovedRef(ref)) {
    if (/prod|production|live/i.test(ref)) {
      return "Refusing to run: the project ref looks like production but is not the approved project.";
    }
    if (options.execute && !options.testProject) {
      return `Refusing to write to a non-approved project (fingerprint ${fingerprint(ref)}). Pass --yes-this-is-a-test-project to confirm it is a test project.`;
    }
  }

  return null;
}

function loadEnv(): void {
  try {
    const dotenv = require("dotenv") as typeof import("dotenv");
    dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
    dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  } catch {
    /* dotenv is optional when the environment is already populated */
  }
}

/**
 * The real port: `settings_documents` via the existing Supabase admin client.
 *
 * The insert uses `upsert(..., { ignoreDuplicates: true })`, which PostgREST applies
 * as `ON CONFLICT (document_key) DO NOTHING`. A row that appears between the read and
 * the insert is therefore never overwritten, even under a race.
 */
export function supabasePort(supabase: SupabaseClient): SettingsInitPort {
  return {
    async readRow(documentKey: string) {
      const { data, error } = await supabase
        .from("settings_documents")
        .select("data")
        .eq("document_key", documentKey)
        .maybeSingle();
      if (error) throw new Error(`Could not read ${documentKey} settings: ${error.message}`);
      return data ? (data.data as unknown) : null;
    },
    async insertRow(documentKey: string, data: Record<string, unknown>, fieldCount: number) {
      const { error } = await supabase.from("settings_documents").upsert(
        {
          document_key: documentKey,
          data,
          source_field_count: fieldCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_key", ignoreDuplicates: true }
      );
      if (error) throw new Error(`Could not insert ${documentKey} settings: ${error.message}`);
    },
  };
}

async function main(): Promise<void> {
  loadEnv();
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const execute = options.execute && !envIsDryRun(process.env);

  if (execute && options.confirm !== CONFIRM_PHRASE) {
    console.error(
      `✖ --execute requires --confirm ${CONFIRM_PHRASE} (got ${options.confirm ? `"${options.confirm}"` : "nothing"}).`
    );
    process.exit(1);
  }

  const refusal = checkTargetGuard({ execute, projectRef: options.projectRef, testProject: options.testProject }, process.env);
  if (refusal) {
    console.error(`✖ ${refusal}`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const ref = refFromSupabaseUrl(url);

  console.log("=== MISSING SETTINGS INITIALIZATION (Supabase) ===");
  console.log(`Target project : fingerprint ${fingerprint(ref)} (ref value not printed)`);
  if (isApprovedRef(ref)) {
    console.log(`                 this IS the approved production project (fingerprint ${fingerprint(APPROVED_PROJECT_REF)})`);
  } else {
    console.log("                 this is NOT the approved production project");
  }
  console.log(`Mode           : ${execute ? "EXECUTE" : "DRY RUN (nothing is written)"}`);

  // Validate the initialization set before touching any database.
  const issues = validateSettingsInitialization();
  if (issues.length > 0) {
    console.error("\n✖ The settings initialization set is invalid:");
    for (const issue of issues) console.error(`  - ${issue}`);
    process.exit(1);
  }
  console.log(`Keys           : ${SETTINGS_INITIALIZATION_KEYS.join(", ")}`);

  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "\n✖ Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "(environment or .env.local)."
    );
    process.exit(1);
  }

  const supabase = createAdminClient();
  const port = supabasePort(supabase);

  const result = await runSettingsInitialization(port, { execute });

  console.log("\n=== RESULT ===");
  for (const entry of result.entries) {
    console.log(`  ${entry.documentKey.padEnd(16)} ${entry.state.padEnd(8)} ${entry.action.padEnd(6)} — ${entry.reason}`);
  }
  console.log(`\n  will insert   : ${result.inserted.length > 0 ? result.inserted.join(", ") : "(none)"}`);
  console.log(`  left untouched: ${result.untouched.length > 0 ? result.untouched.join(", ") : "(none)"}`);

  console.log("\n=== EXCLUDED (deliberately not seeded) ===");
  for (const entry of EXCLUDED_SETTINGS_KEYS) {
    console.log(`  ${entry.key.padEnd(18)} ${entry.reason}`);
  }

  if (!execute) {
    console.log("\nDry run complete. Nothing was written. Add --execute --confirm " + CONFIRM_PHRASE + " to apply.");
    return;
  }

  if (!result.wrote) {
    console.log("\nNo write was needed (every target row already exists).");
    return;
  }

  // Verify the write landed as expected.
  const failures = await verifySettingsInitialization(port);
  console.log("\n=== VERIFY ===");
  if (failures.length > 0) {
    for (const failure of failures) console.error(`  ✖ ${failure}`);
    console.error("\n✖ Verification failed: a target document is missing or does not match the canonical seed.");
    process.exit(1);
  }
  console.log(`  ✔ canonical documents verified for: ${SETTINGS_INITIALIZATION_KEYS.join(", ")}`);
  console.log(`\n✔ Settings initialized: ${result.inserted.join(", ")} under settings_documents.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Settings initialization failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
