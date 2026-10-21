// Hard guard: refuse to continue unless the configured Supabase URL resolves to
// the one approved production project.
//
// The Firestore migration workflows authenticate to Supabase with a raw service
// role key plus a URL, not a project ref. A stale or wrong `NEXT_PUBLIC_SUPABASE_URL`
// would silently target a different project, so this step runs BEFORE any
// database-changing script and fails closed on a missing, malformed or
// mismatched URL.
//
// It reads the URL from the environment (never from an argument, so it cannot be
// overridden on a command line) and reuses the same ref extractor as the
// project-ref guard, so the two guards cannot drift. Prints fingerprints, never
// the URL or the key.

import { APPROVED_PROJECT_REF, fingerprint, isApprovedRef, refFromSupabaseUrl } from "./approved-project.mjs";

const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();

if (!url) {
  console.error(
    "REFUSING: NEXT_PUBLIC_SUPABASE_URL is not set. Cannot verify the target project, so no " +
      "database-changing command may run."
  );
  process.exit(1);
}

const ref = refFromSupabaseUrl(url);

if (!ref) {
  console.error(
    "REFUSING: NEXT_PUBLIC_SUPABASE_URL does not resolve to a Supabase project ref " +
      "(fingerprint " +
      fingerprint(url) +
      ")."
  );
  process.exit(1);
}

if (!isApprovedRef(ref)) {
  console.error(
    "REFUSING: NEXT_PUBLIC_SUPABASE_URL is not the approved production project. " +
      `expected fingerprint ${fingerprint(APPROVED_PROJECT_REF)}, got ${fingerprint(ref)}. ` +
      "Nothing has been written."
  );
  process.exit(1);
}

console.log(
  `Supabase URL guard passed: resolves to the approved production project ` +
    `(fingerprint ${fingerprint(APPROVED_PROJECT_REF)}).`
);
process.exit(0);
