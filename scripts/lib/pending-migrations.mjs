// Pending-migration parser and reviewed allowlist for the production migration
// workflow (`.github/workflows/supabase-migrations.yml`).
//
// Two jobs:
//
//   1. PARSE the migrations a `supabase db push --dry-run --include-all` would apply.
//      The pinned Supabase CLI (1.200.0) has exactly three dry-run outcomes, all
//      verified against `internal/db/push/push.go`:
//
//        a. PENDING (stderr): a header line, then one bullet per migration:
//
//             Would push these migrations:
//              • 20261116000000_add_auth_user_id_to_staff.sql
//              • 20261201000000_add_is_approved_to_users.sql
//
//           followed by the completion line `Finished supabase db push.` on stdout.
//           A pending result requires BOTH the bullets and that completion line: the
//           parser never treats bullets alone as a successful run, so output that is
//           truncated or terminated by anything else fails closed.
//        b. UP TO DATE (stdout, early return): a single explicit line, with no header
//           and no bullets:
//
//             Remote database is up to date.
//        c. FAILURE: any other output (empty, banner-only, truncated, a header with
//           no bullets, malformed bullet lines, or a pending section not terminated by
//           the completion line) is NOT a recognized outcome.
//
//      The bullet lines are parsed from *inside the header section only* (never by
//      fixed line number, and never from the box-drawn `supabase migration list`
//      output, whose format differs and is not a stable contract). `db push` in
//      1.200.0 has no `--output-format`/`--output json` machine-readable mode for this
//      command (its global `--output` only controls "status variables"), so the bullet
//      parser is the supported path.
//
//      The parser never infers "up to date" from the absence of the header. It reports
//      an explicit `status` of `"pending"`, `"up-to-date"` or `"unrecognized"`, so the
//      caller can fail closed on anything it does not positively recognize.
//
//   2. GATE application behind an explicit, reviewed ALLOWLIST. Any pending
//      migration that is not on the allowlist fails the run BEFORE the apply
//      command, so an unreviewed migration can never be pushed to production.
//
// Nothing here opens a database, the network, or a workflow: it is pure string
// handling plus two frozen constants, so it is safe to unit-test offline.

/** The literal header the CLI prints immediately before the pending-migration bullets. */
export const PENDING_HEADER = "Would push these migrations:";

/** The literal line the CLI prints (stdout) when there is nothing to push. */
export const UP_TO_DATE_MESSAGE = "Remote database is up to date.";

/**
 * The literal completion line the CLI prints (stdout) after a successful run — in
 * dry-run mode this is the last line after the pending bullets. A pending result is
 * only recognized when this line is present, so truncated output fails closed.
 */
export const FINISHED_MESSAGE = "Finished supabase db push.";

/**
 * A pending-migration bullet: an optional leading space, the `•` bullet, then a
 * 14-digit version, `_`, a migration name and `.sql`. The CLI wraps the bullets in
 * `utils.Bold`, which emits ANSI escapes only on a colour-capable TTY; CI is not a
 * TTY, but the escapes are stripped before matching so the parse is TTY-independent.
 */
const BULLET_RE = /^\s*•\s+(\d{14})_[A-Za-z0-9_-]+\.sql\s*$/;
/** A line that begins a bullet attempt, even if the rest of it is malformed. */
const BULLET_MARKER_RE = /^\s*•/;
/** A 14-digit version-looking token, used to keep a drifted bullet line in-section. */
const VERSION_RE = /\b\d{14}\b/;
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
  // 2026-12-01 user approval flag. VERIFIED against production on 2026-11-13: the
  // column already exists as `boolean NOT NULL DEFAULT false` — exactly the shape this
  // migration declares — so its `ADD COLUMN IF NOT EXISTS` is a no-op schema change
  // that only records the ledger entry.
  "20261201000000", // add_is_approved_to_users — verified no-op on production
]);

/**
 * Known pending migrations that are deliberately NOT approved, listed so that a
 * failure names the exact reason instead of reporting a bare "unexpected version".
 *
 * Being here is NOT approval: a pending version in this list still fails the run
 * closed. It is currently empty — the former entry, `20261201000000_add_is_approved_to_users`,
 * was moved to APPROVED_PENDING_MIGRATIONS on 2026-11-13 once production catalog
 * verification confirmed the column already exists with the intended shape. Add a
 * version here (but do NOT approve it) when a pending migration is already known and
 * still needs review.
 */
export const AWAITING_VERIFICATION = Object.freeze([]);

function stripAnsi(line) {
  return String(line).replace(ANSI_RE, "");
}

/**
 * Parse the raw combined output of `supabase db push --dry-run --include-all` into
 * one of three explicit outcomes. It never infers "up to date" from a missing header,
 * and never treats parsed bullets alone as a successful run.
 *
 *   - `"pending"`      — a `Would push these migrations:` section with one or more
 *                        valid bullets, terminated by the CLI's completion line
 *                        `Finished supabase db push.`. `versions` lists the bullets.
 *   - `"up-to-date"`   — the CLI's explicit up-to-date line was found and no pending
 *                        section was present. `versions` is empty.
 *   - `"unrecognized"` — anything else: empty output, arbitrary text, the dry-run
 *                        banner alone, a truncated section, an altered/missing header,
 *                        a header with zero bullets, a malformed bullet line, or a
 *                        pending section not terminated by the completion line.
 *
 * @param {string} output combined stdout+stderr of the dry-run command
 * @returns {{
 *   status: "pending" | "up-to-date" | "unrecognized",
 *   versions: string[],
 *   upToDateSeen: boolean,
 *   headerSeen: boolean,
 *   finishedSeen: boolean,
 *   unexpectedTerminator: string | null,
 *   malformedBulletLines: string[],
 *   reason: string | null,
 * }}
 *   `versions` holds the 14-digit versions in printed order, de-duplicated.
 */
export function parsePendingOutput(output) {
  const lines = String(output ?? "").split(/\r?\n/);

  let headerSeen = false;
  let upToDateSeen = false;
  let finishedSeen = false;
  let inSection = false;
  let sectionEnded = false;
  let sawNonEmptyLine = false;
  let unexpectedTerminator = null;
  const versions = [];
  const malformedBulletLines = [];
  let reason = null;

  for (const raw of lines) {
    const line = stripAnsi(raw);
    const trimmed = line.trim();
    if (trimmed !== "") sawNonEmptyLine = true;

    if (!inSection) {
      if (trimmed === PENDING_HEADER) {
        inSection = true;
        headerSeen = true;
        continue;
      }
      if (trimmed === UP_TO_DATE_MESSAGE) {
        upToDateSeen = true;
        continue;
      }
      continue;
    }

    // Inside the pending section, before it has ended: collect bullets and malformed
    // bullet lines. The first non-bullet, non-blank line ends the section, and is the
    // candidate terminator that must be the CLI completion line.
    if (!sectionEnded) {
      if (trimmed === "") continue;
      if (BULLET_RE.test(line)) {
        versions.push(BULLET_RE.exec(line)[1]);
        continue;
      }
      // A bullet-looking line that is not a valid bullet is malformed, not the end of
      // the block: keep it in-section so the parser reports it (and fails closed).
      if (BULLET_MARKER_RE.test(line) || VERSION_RE.test(line)) {
        malformedBulletLines.push(line);
        continue;
      }
      sectionEnded = true;
    }

    // After the pending section: the first non-blank line must be the completion line.
    if (trimmed === "") continue;
    if (trimmed === FINISHED_MESSAGE) {
      finishedSeen = true;
    } else if (unexpectedTerminator === null && !finishedSeen) {
      unexpectedTerminator = trimmed;
    }
    continue;
  }

  const uniqueVersions = [...new Set(versions)];

  if (headerSeen) {
    if (malformedBulletLines.length > 0) {
      reason = "pending section contained malformed migration bullet lines";
      return unrecognized(reason, {
        upToDateSeen,
        headerSeen,
        finishedSeen,
        unexpectedTerminator,
        malformedBulletLines,
      });
    }
    if (uniqueVersions.length === 0) {
      reason = "pending header printed but no migration bullets parsed";
      return unrecognized(reason, {
        upToDateSeen,
        headerSeen,
        finishedSeen,
        unexpectedTerminator,
        malformedBulletLines,
      });
    }
    if (unexpectedTerminator !== null) {
      reason = `pending section was terminated by an unexpected line: ${JSON.stringify(unexpectedTerminator)}`;
      return unrecognized(reason, {
        upToDateSeen,
        headerSeen,
        finishedSeen,
        unexpectedTerminator,
        malformedBulletLines,
      });
    }
    if (!finishedSeen) {
      reason = "pending section was not terminated by the CLI completion line";
      return unrecognized(reason, {
        upToDateSeen,
        headerSeen,
        finishedSeen,
        unexpectedTerminator,
        malformedBulletLines,
      });
    }
    return {
      status: "pending",
      versions: uniqueVersions,
      upToDateSeen,
      headerSeen,
      finishedSeen,
      unexpectedTerminator,
      malformedBulletLines,
      reason: null,
    };
  }

  // No header. Only the CLI's explicit up-to-date line is a recognized outcome; the
  // absence of a header on its own means nothing.
  if (upToDateSeen) {
    return {
      status: "up-to-date",
      versions: [],
      upToDateSeen,
      headerSeen,
      finishedSeen,
      unexpectedTerminator,
      malformedBulletLines,
      reason: null,
    };
  }

  if (sectionEnded) {
    reason = "output ended without a recognized pending or up-to-date section";
  } else if (!sawNonEmptyLine) {
    reason = "dry-run output was empty";
  } else {
    reason = "dry-run output did not contain a recognized pending or up-to-date section";
  }
  return unrecognized(reason, { upToDateSeen, headerSeen, malformedBulletLines });
}

function unrecognized(
  reason,
  {
    upToDateSeen = false,
    headerSeen = false,
    finishedSeen = false,
    unexpectedTerminator = null,
    malformedBulletLines = [],
  } = {},
) {
  return {
    status: "unrecognized",
    versions: [],
    upToDateSeen,
    headerSeen,
    finishedSeen,
    unexpectedTerminator,
    malformedBulletLines,
    reason,
  };
}

/**
 * Convenience wrapper returning only the parsed versions of a `"pending"` result.
 * Returns `[]` for `"up-to-date"` and `"unrecognized"` alike, so callers that need
 * to distinguish those outcomes must use {@link parsePendingOutput}.
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
