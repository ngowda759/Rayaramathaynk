// Hard guard: refuse to continue unless the configured project ref is the one
// approved production project.
//
// The migration workflow runs this BEFORE `supabase link` or any `db push`, so a
// stale or wrong secret can never reach a database-changing command. It reads the
// ref from the environment (never from an argument, so it cannot be overridden on
// a command line) and compares it against the approved constant.
//
// Exits 0 only when the ref matches; exits 1 on missing, malformed or mismatched
// ref. Prints fingerprints, never the ref value - GitHub masks the ref anyway.

import { APPROVED_PROJECT_REF, fingerprint, isApprovedRef } from "./approved-project.mjs";

const ref = String(process.env.SUPABASE_PROJECT_REF ?? "").trim();

if (!ref) {
  console.error(
    "REFUSING: SUPABASE_PROJECT_REF is not set. Cannot verify the target project, so no " +
      "database-changing command may run."
  );
  process.exit(1);
}

if (!/^[a-z0-9]{20}$/.test(ref)) {
  console.error(
    `REFUSING: SUPABASE_PROJECT_REF is not a valid 20-character project ref (fingerprint ${fingerprint(ref)}).`
  );
  process.exit(1);
}

if (!isApprovedRef(ref)) {
  console.error(
    "REFUSING: SUPABASE_PROJECT_REF is not the approved production project. " +
      `expected fingerprint ${fingerprint(APPROVED_PROJECT_REF)}, got ${fingerprint(ref)}. ` +
      "Nothing has been applied."
  );
  process.exit(1);
}

console.log(
  `Project ref guard passed: matches the approved production project ` +
    `(fingerprint ${fingerprint(APPROVED_PROJECT_REF)}).`
);
process.exit(0);
