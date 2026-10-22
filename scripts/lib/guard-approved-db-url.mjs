// Hard guard: refuse to continue unless a PostgreSQL connection string resolves
// to the one approved production project.
//
// The Seva backup and maintenance workflows authenticate with a raw connection
// string (`SEVA_BACKUP_DB_URL`) rather than a project ref, and run on a schedule.
// A stale or wrong secret would silently point `pg_dump` or a destructive purge
// at a different database, so this step runs BEFORE the first `psql` command and
// fails closed on a missing, malformed, ambiguous or mismatched URL.
//
// It reads the URL from the environment (never from an argument, so it cannot be
// overridden on a command line) and reuses the same ref extractor as the
// project-ref and URL guards, so the three guards cannot drift. Prints
// fingerprints, never the URL or any credential.

import {
  APPROVED_PROJECT_REF,
  analyzeDbUrlRef,
  fingerprint,
  isApprovedRef,
} from "./approved-project.mjs";

const VAR = process.env.GUARD_DB_URL_VAR || "SEVA_BACKUP_DB_URL";
const url = String(process.env[VAR] ?? "").trim();

if (!url) {
  console.error(
    `REFUSING: ${VAR} is not set. Cannot verify the target database, so no ` +
      "database-changing command may run."
  );
  process.exit(1);
}

const { ref, ambiguous, malformed } = analyzeDbUrlRef(url);

if (malformed) {
  console.error(
    `REFUSING: ${VAR} is not a well-formed PostgreSQL connection string ` +
      `(fingerprint ${fingerprint(url)}).`
  );
  process.exit(1);
}

if (ambiguous) {
  console.error(
    `REFUSING: ${VAR} names two different projects (the username and the host disagree), ` +
      `so the target cannot be verified (fingerprint ${fingerprint(url)}).`
  );
  process.exit(1);
}

if (!ref) {
  console.error(
    `REFUSING: ${VAR} does not resolve to a Supabase project ref ` +
      `(fingerprint ${fingerprint(url)}).`
  );
  process.exit(1);
}

if (!isApprovedRef(ref)) {
  console.error(
    `REFUSING: ${VAR} is not the approved production project. ` +
      `expected fingerprint ${fingerprint(APPROVED_PROJECT_REF)}, got ${fingerprint(ref)}. ` +
      "Nothing has been read or written."
  );
  process.exit(1);
}

console.log(
  `Database URL guard passed: resolves to the approved production project ` +
    `(fingerprint ${fingerprint(APPROVED_PROJECT_REF)}).`
);
process.exit(0);
