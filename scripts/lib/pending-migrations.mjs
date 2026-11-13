// Pending-migration parser and reviewed allowlist for the production migration
// workflow (`.github/workflows/supabase-migrations.yml`).
//
// Two jobs:
//
//   1. PARSE the migrations a `supabase db push --dry-run --include-all` would apply.
//      The pinned Supabase CLI (1.200.0) prints, to stderr:
//
//          Would push these migrations:
//           • 20261116000000_add_auth_user_id_to_staff.sql
//           • 20261201000000_add_is_approved_to_users.sql
//
//      The bullet lines are parsed from *inside that section only* (never by fixed
//      line number, and never from the box-drawn `supabase migration list` output,
//      whose format differs and is not a stable contract). `db push` in 1.200.0 has
//      no `--output-format`/`--output json` machine-readable mode for this command
//      (its global `--output` only controls "status variables"), so the bullet
//      parser is the supported path.
//
//   2. GATE application behind an explicit, reviewed ALLOWLIST. Any pending
//      migration that is not on the allowlist fails the run BEFORE the apply
//      command, so an unreviewed migration can never be pushed to production.
//
// Nothing here opens a database, the network, or a workflow: it is pure string
// handling plus two frozen constants, so it is safe to unit-test offline.

/** The literal header the CLI prints immediately before the pending-migration bullets. */
export const PENDING_HEADER = "Would push these migrations:";

/**
 * A pending-migration bullet: an optional leading space, the `•` bullet, then a
 * 14-digit version, `_`, a migration name and `.sql`. The CLI wraps the bullets in
 * `utils.Bold`, which emits ANSI escapes only on a colour-capable TTY; CI is not a
 * TTY, but the escapes are stripped before matching so the parse is TTY-independent.
 */
const BULLET_RE = /^\s*•\s+(\d{14})_[A-Za-z0-9_-]+\.sql\s*$/;
const ANSI_RE = /\x1b\[[0-9;]*m/g;

/**
 * Migration versions this workflow is permitted to apply to production.
 *
 * This is an explicit approval, not a discovered set: a version is added here only
 * after a human has reviewed the migration and confirmed it is safe to apply. The
 * workflow fails closed on any pending version absent from this list.
 *
 * Keep this list small and obvious. Every entry is a deliberate decision.
 */
export const APPROVED_PENDING_MIGRATIONS = Object.freeze([
  // 2026-11-09 obsolete markers (PR #404). Comment-only no-op ledger entries that
  // retain their version so the historical record is preserved; they execute nothing.
  "20261109000000", // create_members_table — no-op ledger marker
  "20261109000001", // create_volunteers_table — no-op ledger marker
  // 2026-11-16 Phase 2 identity unification. Additive and non-destructive: it only
  // adds a nullable, unique `auth_user_id` column to public.staff.
  "20261116000000", // add_auth_user_id_to_staff
]);

/**
 * Known pending migrations that are deliberately NOT approved, listed so that a
 * failure names the exact reason instead of reporting a bare "unexpected version".
 *
 * Being here is NOT approval: a pending version in this list still fails the run
 * closed. `20261201000000_add_is_approved_to_users` is withheld because production
 * catalog verification of `public.users.is_approved` is still outstanding — do not
 * move it to APPROVED_PENDING_MIGRATIONS until that verification has been done and
 * reviewed.
 */
export const AWAITING_VERIFICATION = Object.freeze([
  "20261201000000", // add_is_approved_to_users — needs production catalog verification
]);

function stripAnsi(line) {
  return String(line).replace(ANSI_RE, "");
}

/**
 * Extract the pending migration versions from the raw output of
 * `supabase db push --dry-run --include-all`.
 *
 * Reads the bullets between the `Would push these migrations:` header and the end
 * of that block. `headerSeen` distinguishes "the CLI reported no pending migrations"
 * (up to date, no header) from "the CLI printed a header but the bullets did not
 * parse" — the latter is a format drift and must fail closed rather than be read as
 * "nothing to do".
 *
 * @param {string} output combined stdout+stderr of the dry-run command
 * @returns {{ headerSeen: boolean, versions: string[] }} 14-digit versions, in the
 *   order printed, de-duplicated
 */
export function parsePendingOutput(output) {
  const lines = String(output ?? "").split(/\r?\n/);
  const versions = [];
  let headerSeen = false;
  let inSection = false;
  for (const raw of lines) {
    const line = stripAnsi(raw);
    if (!inSection) {
      if (line.trim() === PENDING_HEADER) {
        inSection = true;
        headerSeen = true;
      }
      continue;
    }
    const match = BULLET_RE.exec(line);
    if (match) {
      versions.push(match[1]);
      continue;
    }
    // Blank lines belong to the block; the first other line ends it.
    if (line.trim() === "") continue;
    break;
  }
  return { headerSeen, versions: [...new Set(versions)] };
}

/**
 * Convenience wrapper returning only the parsed versions.
 *
 * @param {string} output combined stdout+stderr of the dry-run command
 * @returns {string[]} 14-digit versions
 */
export function parsePendingVersions(output) {
  return parsePendingOutput(output).versions;
}

/**
 * Classify the pending versions against the reviewed allowlist.
 *
 * @param {string[]} versions versions returned by {@link parsePendingVersions}
 * @returns {{
 *   versions: string[],
 *   approved: string[],
 *   unapproved: string[],
 *   awaitingVerification: string[],
 *   unexpected: string[],
 *   ok: boolean,
 * }}
 *   `ok` is true only when every pending version is on the allowlist. A version in
 *   AWAITING_VERIFICATION is still unapproved, so it fails closed.
 */
export function evaluatePendingMigrations(versions) {
  const approvedSet = new Set(APPROVED_PENDING_MIGRATIONS);
  const awaitingSet = new Set(AWAITING_VERIFICATION);
  const list = [...new Set(versions ?? [])];
  const approved = list.filter((v) => approvedSet.has(v));
  const unapproved = list.filter((v) => !approvedSet.has(v));
  return {
    versions: list,
    approved,
    unapproved,
    awaitingVerification: unapproved.filter((v) => awaitingSet.has(v)),
    unexpected: unapproved.filter((v) => !awaitingSet.has(v)),
    ok: unapproved.length === 0,
  };
}
