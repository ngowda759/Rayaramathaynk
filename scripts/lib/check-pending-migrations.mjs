#!/usr/bin/env node

// Enforce the reviewed pending-migration allowlist for the production migration
// workflow.
//
// Reads the combined output of `supabase db push --dry-run --include-all` from the
// file named by DRY_RUN_OUTPUT_FILE, parses it into an explicit outcome
// (`pending` / `up-to-date` / `unrecognized`), and exits non-zero unless the output
// is positively recognized AND (when pending) every version is on the reviewed
// allowlist. The workflow runs this BEFORE the apply step, so an unreviewed migration
// can never be pushed to production.
//
// It fails closed on anything it does not positively recognize: a missing output
// file, empty/arbitrary/banner-only/truncated output, an altered or missing pending
// header, a pending header with zero bullets, or malformed bullet lines.
//
// It opens no database and no network: it only reads a file and compares strings.
//
// Exit codes:
//   0 - explicitly recognized up-to-date output, OR a valid pending section whose
//       every version is on the allowlist
//   1 - unrecognized/incomplete output, or a pending version that is not approved
//
// Step outputs (written to $GITHUB_OUTPUT when set):
//   status      - "pending" | "up-to-date" | "unrecognized"
//   pending     - newline-separated approved+unapproved versions ("" when not pending)
//   has_pending - "true" when at least one version is pending, else "false"

import { appendFileSync, readFileSync } from "node:fs";

import {
  AWAITING_VERIFICATION,
  APPROVED_PENDING_MIGRATIONS,
  evaluatePendingMigrations,
  parsePendingOutput,
} from "./pending-migrations.mjs";

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

function fail(message) {
  console.error(`ERROR: ${message}`);
  setOutput("status", "unrecognized");
  setOutput("pending", "");
  setOutput("has_pending", "false");
  process.exit(1);
}

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

const parsed = parsePendingOutput(raw);
const { status, versions, malformedBulletLines, reason } = parsed;

console.log(`Approved pending migrations (allowlist): ${APPROVED_PENDING_MIGRATIONS.join(", ") || "(none)"}`);
console.log(`Withheld pending migrations (awaiting verification): ${AWAITING_VERIFICATION.join(", ") || "(none)"}`);
console.log(`Dry-run output status: ${status}`);

if (status === "unrecognized") {
  console.error("");
  console.error(
    "ERROR: the dry-run output was not recognized as either a pending-migrations " +
      "section or the CLI's explicit up-to-date line. Refusing to continue rather than " +
      "guessing. This usually means the CLI output format changed, the command failed, " +
      "or the captured output is empty, truncated, or incomplete.",
  );
  if (reason) console.error(`  Reason: ${reason}`);
  if (malformedBulletLines.length > 0) {
    console.error("  Malformed bullet line(s):");
    for (const line of malformedBulletLines) console.error(`    ${line.trim()}`);
  }
  fail("unrecognized dry-run output; refusing to continue.");
}

if (status === "up-to-date") {
  console.log("The dry-run reported no pending migrations (remote database is up to date).");
  setOutput("status", "up-to-date");
  setOutput("pending", "");
  setOutput("has_pending", "false");
  process.exit(0);
}

// status === "pending": a valid section with at least one bullet.
const result = evaluatePendingMigrations(versions);

console.log(`Pending migrations detected (${versions.length}):`);
for (const version of versions) {
  const verdict = result.approved.includes(version) ? "APPROVED" : "NOT APPROVED";
  console.log(`  - ${version} [${verdict}]`);
}

setOutput("status", "pending");
setOutput("pending", versions.join("\n"));
setOutput("has_pending", "true");

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
