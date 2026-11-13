#!/usr/bin/env node

// Enforce the reviewed pending-migration allowlist for the production migration
// workflow.
//
// Reads the combined output of `supabase db push --dry-run --include-all` from the
// file named by DRY_RUN_OUTPUT_FILE, parses the pending versions from the
// "Would push these migrations:" bullet section, and exits non-zero if any pending
// version is not on the reviewed allowlist. The workflow runs this BEFORE the apply
// step, so an unreviewed migration can never be pushed to production.
//
// It opens no database and no network: it only reads a file and compares strings.
//
// Exit codes:
//   0 - every pending version is approved (or nothing is pending)
//   1 - a pending version is not approved, or the dry-run output did not parse
//
// Step outputs (written to $GITHUB_OUTPUT when set):
//   pending     - newline-separated approved+unapproved versions
//   has_pending - "true" when at least one version is pending, else "false"

import { appendFileSync, readFileSync } from "node:fs";

import {
  AWAITING_VERIFICATION,
  APPROVED_PENDING_MIGRATIONS,
  evaluatePendingMigrations,
  parsePendingOutput,
} from "./pending-migrations.mjs";

const outputFile = process.env.DRY_RUN_OUTPUT_FILE;
if (!outputFile) {
  console.error("ERROR: DRY_RUN_OUTPUT_FILE is not set; nothing was checked.");
  process.exit(1);
}

let raw;
try {
  raw = readFileSync(outputFile, "utf8");
} catch (error) {
  console.error(`ERROR: could not read the dry-run output at ${outputFile}: ${error.message}`);
  process.exit(1);
}

const { headerSeen, versions } = parsePendingOutput(raw);
const result = evaluatePendingMigrations(versions);

function setOutput(name, value) {
  const target = process.env.GITHUB_OUTPUT;
  if (!target) return;
  const text = String(value);
  if (text.includes("\n")) {
    const delimiter = `EOF_${name}_${process.pid}_${Date.now()}`;
    appendFileSync(target, `${name}<<${delimiter}\n${text}\n${delimiter}\n`);
  } else {
    appendFileSync(target, `${name}=${text}\n`);
  }
}

console.log(`Approved pending migrations (allowlist): ${APPROVED_PENDING_MIGRATIONS.join(", ") || "(none)"}`);
console.log(`Withheld pending migrations (awaiting verification): ${AWAITING_VERIFICATION.join(", ") || "(none)"}`);

if (!headerSeen && versions.length === 0) {
  console.log("The dry-run reported no pending migrations (remote database is up to date).");
  setOutput("pending", "");
  setOutput("has_pending", "false");
  process.exit(0);
}

if (headerSeen && versions.length === 0) {
  console.error(
    "ERROR: the dry-run printed a pending-migration header but no migration bullets parsed. " +
      "The CLI output format may have changed; refusing to continue rather than treating this " +
      "as 'nothing to do'.",
  );
  process.exit(1);
}

console.log(`Pending migrations detected (${versions.length}):`);
for (const version of versions) {
  const verdict = result.approved.includes(version) ? "APPROVED" : "NOT APPROVED";
  console.log(`  - ${version} [${verdict}]`);
}

setOutput("pending", versions.join("\n"));
setOutput("has_pending", versions.length > 0 ? "true" : "false");

if (!result.ok) {
  console.error("");
  console.error("ERROR: unapproved pending migration(s) detected. Refusing to continue.");
  if (result.awaitingVerification.length > 0) {
    console.error(
      `  Awaiting production catalog verification (do NOT approve without it): ${result.awaitingVerification.join(", ")}`,
    );
  }
  if (result.unexpected.length > 0) {
    console.error(`  Unexpected / unreviewed: ${result.unexpected.join(", ")}`);
  }
  console.error("");
  console.error(
    "To proceed, a reviewer must confirm each migration is safe to apply, then add its version to " +
      "APPROVED_PENDING_MIGRATIONS in scripts/lib/pending-migrations.mjs.",
  );
  process.exit(1);
}

console.log("All pending migrations are on the reviewed allowlist.");
process.exit(0);
