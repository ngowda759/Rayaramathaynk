// Hard guard: refuse to continue unless the configured project ref is an
// explicitly allow-listed TEST project and is NOT the approved production project.
//
// This is the destination guard for the test-only migration verification workflow
// (.github/workflows/supabase-migrations-test.yml). It reuses the same shared
// `approved-project.mjs` library as the production guards, so the production ref it
// refuses can never drift from the value `guard-approved-project.mjs` requires.
//
// It reads only TEST_-prefixed variables. It never reads SUPABASE_PROJECT_REF,
// never falls back to a production credential, and never infers a project from a
// URL substring (the ref is extracted with the shared, fail-closed exact-host
// matcher).
//
// Fail-closed rules (exit 1, plain message, fingerprints only — never a ref value):
//   - TEST_SUPABASE_PROJECT_REF is missing or not a valid 20-character ref;
//   - TEST_SUPABASE_PROJECT_REF is the approved production project;
//   - TEST_SUPABASE_PROJECT_REFS (the allowlist) is missing or empty;
//   - any allowlist entry is malformed;
//   - any allowlist entry is the approved production project;
//   - TEST_SUPABASE_PROJECT_REF is not in the allowlist;
//   - TEST_SUPABASE_URL is set but does not resolve to TEST_SUPABASE_PROJECT_REF.

import {
  APPROVED_PROJECT_REF,
  fingerprint,
  isApprovedRef,
  refFromSupabaseUrl,
} from "./approved-project.mjs";

/** A Supabase project ref is exactly 20 lowercase alphanumerics. */
const REF_RE = /^[a-z0-9]{20}$/;

const target = String(process.env.TEST_SUPABASE_PROJECT_REF ?? "").trim();
const allowRaw = String(process.env.TEST_SUPABASE_PROJECT_REFS ?? "").trim();
const url = String(process.env.TEST_SUPABASE_URL ?? "").trim();

function refuse(message) {
  console.error(`REFUSING: ${message}`);
  process.exit(1);
}

if (!target) {
  refuse(
    "TEST_SUPABASE_PROJECT_REF is not set. Cannot verify the target project, so no " +
      "Supabase command may run."
  );
}

if (!REF_RE.test(target)) {
  refuse(
    `TEST_SUPABASE_PROJECT_REF is not a valid 20-character project ref ` +
      `(fingerprint ${fingerprint(target)}).`
  );
}

if (isApprovedRef(target)) {
  refuse(
    "TEST_SUPABASE_PROJECT_REF is the approved production project " +
      `(fingerprint ${fingerprint(APPROVED_PROJECT_REF)}). This workflow is for a ` +
      "dedicated TEST project only; the production project is refused unconditionally."
  );
}

const allow = allowRaw.split(/[\s,]+/).filter(Boolean);

if (allow.length === 0) {
  refuse(
    "TEST_SUPABASE_PROJECT_REFS is empty. Set the repository variable to a " +
      "comma-separated allowlist of test project refs. No project is assumed."
  );
}

const malformed = allow.filter((r) => !REF_RE.test(r));
if (malformed.length > 0) {
  refuse(
    `TEST_SUPABASE_PROJECT_REFS contains ${malformed.length} malformed ` +
      `entr${malformed.length === 1 ? "y" : "ies"} (fingerprints ` +
      `${malformed.map(fingerprint).join(", ")}). Refusing rather than ignoring them.`
  );
}

if (allow.some(isApprovedRef)) {
  refuse(
    "TEST_SUPABASE_PROJECT_REFS contains the approved production project " +
      `(fingerprint ${fingerprint(APPROVED_PROJECT_REF)}). The allowlist must contain ` +
      "test project refs only."
  );
}

if (!allow.includes(target)) {
  refuse(
    `TEST_SUPABASE_PROJECT_REF (fingerprint ${fingerprint(target)}) is not in the ` +
      "TEST_SUPABASE_PROJECT_REFS allowlist. Add it to the allowlist or target an " +
      "approved test project."
  );
}

if (url) {
  const ref = refFromSupabaseUrl(url);
  if (ref !== target) {
    refuse(
      "TEST_SUPABASE_URL does not resolve to TEST_SUPABASE_PROJECT_REF " +
        `(expected fingerprint ${fingerprint(target)}, got ${fingerprint(ref)}). ` +
        "Refusing to infer the project from a URL substring."
    );
  }
}

console.log(
  `Test project guard passed: ${fingerprint(target)} is an allow-listed, ` +
    "non-production test project."
);
process.exit(0);
