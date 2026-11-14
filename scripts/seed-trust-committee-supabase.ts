/**
 * Supabase-native one-time Trust Committee initialization.
 *
 * Production admin `/admin/settings/trust-committee` and the public `/trust` page
 * both read `settings_documents` where `document_key = 'trustCommittee'` through
 * the existing reader path (admin `GET/PUT /api/admin/settings/[key]`, public
 * `GET /api/public/settings/[key]`, `services/settings-document.service.ts`). The
 * production row is missing, so the page shows "No members added yet". This script
 * creates that one row from the canonical 13-member data.
 *
 * It is Supabase-only: it uses the existing Supabase admin client
 * (`@/lib/supabase/admin`), writes only the `settings_documents` row for
 * `trustCommittee`, never reads or writes Firestore, and never touches any other
 * settings document. It is idempotent — re-running after a successful create is a
 * no-op, and it refuses to overwrite a document that already has members unless
 * `--force` is passed.
 *
 * Usage (dry run is the default; nothing is written without `--execute`):
 *
 *   npx tsx --conditions=react-server scripts/seed-trust-committee-supabase.ts
 *   npx tsx --conditions=react-server scripts/seed-trust-committee-supabase.ts --execute
 *
 * The `--conditions=react-server` flag is required because the Supabase admin
 * client imports `server-only` (the same reason `npm run verify:supabase-migrations`
 * passes it). `npm run seed:trust-committee` wraps this.
 *
 * Flags:
 *   --execute   perform the write (default: dry run, nothing is written)
 *   --force     replace an existing empty or populated trustCommittee document
 *   --help      show this message
 *
 *   DRY_RUN=true in the environment forces a dry run even with --execute.
 *
 * Environment (read from the process, then `.env.local` / `.env`):
 *   NEXT_PUBLIC_SUPABASE_URL     e.g. https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    the service-role key (never printed)
 *
 * The target project ref is printed so the operator can confirm it before writing.
 * No key or secret is ever printed.
 */

import * as fs from "fs";
import * as path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  TRUST_COMMITTEE_DATA,
  TRUST_COMMITTEE_DOCUMENT_KEY,
  TRUST_COMMITTEE_MEMBER_COUNT,
  countActiveMembers,
  countMembers,
  runTrustCommitteeInitialization,
  validateTrustCommitteeData,
  type TrustCommitteeData,
  type TrustCommitteeSeedPort,
} from "../lib/supabase/seed-data/trust-committee";
import { APPROVED_PROJECT_REF, fingerprint, isApprovedRef, refFromSupabaseUrl } from "./lib/approved-project.mjs";

interface Options {
  execute: boolean;
  force: boolean;
  help: boolean;
}

const USAGE = [
  "Usage: npx tsx --conditions=react-server scripts/seed-trust-committee-supabase.ts [--execute] [--force]",
  "",
  "  --execute   perform the write (default: dry run, nothing is written)",
  "  --force     replace an existing empty or populated trustCommittee document",
  "  --help      show this message",
  "",
  "  DRY_RUN=true in the environment forces a dry run even with --execute.",
].join("\n");

export function parseArgs(argv: string[]): Options {
  const options: Options = { execute: false, force: false, help: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--execute") options.execute = true;
    else if (arg === "--force") options.force = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

/** `DRY_RUN=true` (or `1` / `yes`) forces a dry run even with `--execute`. */
export function envIsDryRun(env: NodeJS.ProcessEnv): boolean {
  const value = (env.DRY_RUN ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function loadEnv(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require("dotenv") as typeof import("dotenv");
    dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
    dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  } catch {
    /* dotenv is optional when the environment is already populated */
  }
}

/** True when a public image path exists on disk (relative to the repo root). */
function imageExists(publicPath: string): boolean {
  return fs.existsSync(path.resolve(process.cwd(), "public", publicPath.replace(/^\//, "")));
}

/** The real port: `settings_documents` via the existing Supabase admin client. */
export function supabasePort(supabase: SupabaseClient): TrustCommitteeSeedPort {
  return {
    async readDocument() {
      const { data, error } = await supabase
        .from("settings_documents")
        .select("data")
        .eq("document_key", TRUST_COMMITTEE_DOCUMENT_KEY)
        .maybeSingle();
      if (error) throw new Error(`Could not read ${TRUST_COMMITTEE_DOCUMENT_KEY} settings: ${error.message}`);
      return data ? (data.data as unknown) : null;
    },
    async writeDocument(document: TrustCommitteeData, fieldCount: number) {
      const { error } = await supabase.from("settings_documents").upsert(
        {
          document_key: TRUST_COMMITTEE_DOCUMENT_KEY,
          data: document,
          source_field_count: fieldCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_key" }
      );
      if (error) throw new Error(`Could not write ${TRUST_COMMITTEE_DOCUMENT_KEY} settings: ${error.message}`);
    },
  };
}

function reportSnapshot(label: string, snapshot: { present: boolean; memberCount: number; activeCount: number }): void {
  console.log(
    `  ${label}: ${snapshot.present ? "present" : "absent"}, ` +
      `${snapshot.memberCount} members (${snapshot.activeCount} active)`
  );
}

async function main(): Promise<void> {
  loadEnv();
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const execute = options.execute && !envIsDryRun(process.env);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const ref = refFromSupabaseUrl(url);

  console.log("=== TRUST COMMITTEE INITIALIZATION (Supabase) ===");
  console.log(`Target project : ${ref ? `${ref} (fingerprint ${fingerprint(ref)})` : "(unrecognised URL)"}`);
  if (ref && isApprovedRef(ref)) {
    console.log(`                 this IS the approved production project (fingerprint ${fingerprint(APPROVED_PROJECT_REF)})`);
  }
  console.log(`Document       : settings_documents.document_key = "${TRUST_COMMITTEE_DOCUMENT_KEY}"`);
  console.log(`Mode           : ${execute ? (options.force ? "EXECUTE (with --force)" : "EXECUTE") : "DRY RUN (nothing is written)"}`);

  // Validate the canonical data before touching any database.
  const issues = validateTrustCommitteeData(TRUST_COMMITTEE_DATA, { imageExists });
  if (issues.length > 0) {
    console.error("\n✖ The canonical Trust Committee data is invalid:");
    for (const issue of issues) console.error(`  - ${issue}`);
    process.exit(1);
  }
  console.log(`Data           : ${countMembers(TRUST_COMMITTEE_DATA)} members, all active, images present`);

  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "\n✖ Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "(environment or .env.local)."
    );
    process.exit(1);
  }

  const supabase = createAdminClient();
  const port = supabasePort(supabase);

  const result = await runTrustCommitteeInitialization(port, { execute, force: options.force });

  console.log("\n=== RESULT ===");
  console.log(`  state  : ${result.state}`);
  console.log(`  action : ${result.action} — ${result.reason}`);
  reportSnapshot("before", result.before);
  reportSnapshot("after ", result.after);

  if (result.action === "refused") {
    console.error(
      `\n✖ Refused: ${result.reason}. Re-run with --force if you intend to replace it.`
    );
    process.exit(1);
  }

  if (!execute) {
    console.log("\nDry run complete. Nothing was written. Add --execute to apply.");
    return;
  }

  if (!result.wrote) {
    console.log("\nNo write was needed (the document already matches).");
    return;
  }

  // Verify the write landed as expected.
  const stored = await port.readDocument();
  const members = countMembers(stored);
  const active = countActiveMembers(stored);
  console.log("\n=== VERIFY ===");
  console.log(`  members            : ${members} (expected ${TRUST_COMMITTEE_MEMBER_COUNT})`);
  console.log(`  active members     : ${active} (expected ${TRUST_COMMITTEE_MEMBER_COUNT})`);
  if (members !== TRUST_COMMITTEE_MEMBER_COUNT || active !== TRUST_COMMITTEE_MEMBER_COUNT) {
    console.error("\n✖ Verification failed: the stored document does not match the canonical data.");
    process.exit(1);
  }
  console.log(
    `\n✔ Trust Committee initialized: ${members} members under settings_documents."${TRUST_COMMITTEE_DOCUMENT_KEY}".`
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Trust Committee initialization failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
