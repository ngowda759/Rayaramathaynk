# Firestore → Supabase Migration Backlog

Follow-up plan for the revision 2 gap audit (PR #352, branch
`audit/firestore-supabase-migration-gap`). Findings here were revalidated against
`main` at `e6f8491` on 2026-10-21.

This document is **planning only**. It authorises no migration batch, no schema
change, no RLS change, no workflow dispatch, and no deployment.

Related documents:

- `docs/RAYA_AI_SUPABASE_MIGRATION_PLAN.md` — Raya AI cutover plan
- `docs/SUPABASE_MIGRATIONS.md` — migration mechanics
- `docs/SECURITY_SUPABASE_ACCESS_TOKEN_ROTATION.md` — token rotation runbook
- `MIGRATION_VERIFICATION_REPORT.md` — stale (see C-6 below)

---

## 1. Revalidated findings, and corrections to PR #352

Confirmed against `main` `e6f8491`. "Rev-2" means the revision 2 audit text.

| # | Finding | Verdict |
|---|---------|---------|
| 1 | Scheduled Aaradhane workflow writes to Firestore | **Confirmed** — `events` |
| 2 | Raya AI still reads Firestore through `/api/chat` | **Confirmed** |
| 3 | No `announcements` table exists in Supabase | **Confirmed** |
| 4 | 41 tables are effectively service-role-only | **Confirmed** (40 deny-only + `seva_list_items`) |
| 5 | 59 migration inventory entries | **Corrected to 61** (see C-3) |
| 6 | Root-level reports claim 14 MIGRATE | **Confirmed wrong** |

### 1.1 Aaradhane scheduled writer

`.github/workflows/aaradhane.yml` runs on `schedule` (cron `30 3 1 1 *`, i.e.
3:30 UTC on 1 January) and on `workflow_dispatch`.

- The scheduled run hits the **non-dry-run** step "Generate and Update Aaradhane
  Events", because the step's guard is
  `if: inputs.dry_run != 'true' && steps.check_panchanga.outputs.exists == 'true'`
  and `inputs.dry_run` is empty on a schedule.
- That step runs `scripts/generate-aaradhane.ts` without `--dry-run`, which reaches
  `lib/aaradhane/firestore-admin.ts` `updateFirestoreWithAdmin(client)` →
  `docRef.set()` / `docRef.update()`.
- Affected documents: the **`events`** collection only, at deterministic IDs
  `generated-<year>-<slug>` (one per Aaradhane event for the target year). All
  writes are idempotent by ID for a given year.
- Trigger: cron, plus manual dispatch with `dry_run=false`.

### 1.2 Raya AI Firestore dependencies

| Call site | Operation | Data | Supabase destination |
|-----------|-----------|------|----------------------|
| `lib/ai/retrieval/announcements.ts` | read (`getDocs`) | active announcements | **missing** — no `announcements` table |
| `services/chat.service.ts` | read/write (`addDoc`, `updateDoc`, `deleteDoc`, `getDocs`) | chat sessions, messages, feedback | `chat_sessions`, `chat_messages` (mixed file) |
| `services/knowledge-workflow.service.ts` | read/write | 7 `knowledge_*` collections | `ai_knowledge` (partial) |
| `app/api/admin/knowledge/**` | read/write via REST | knowledge articles | `ai_knowledge` |
| `app/admin/ai/training/page.tsx` | read | `chatTraining` | none (EXCLUDE_SYSTEM) |

`/api/chat` still reaches Firestore: `app/api/chat/route.ts:130-131` selects HYBRID
mode, which calls the retrieval registry, which dispatches the `announcements`
retriever (`lib/ai/retrieval/index.ts:222`) — a Firebase client-SDK read. **Raya
AI is therefore not Supabase-only.**

### 1.3 RLS

44 of 45 tables have at least one `CREATE POLICY`; there are **56** policy
statements in total (51 named `Deny …`, 5 permissive). Breakdown:

- 40 tables: `Deny all …` to `public`, `anon`, `authenticated` only — reachable
  exclusively with the service-role key.
- 4 tables with a public-read policy: `temple_areas` (two duplicate policies),
  `site_settings`, `social_links`, `ai_knowledge` (approved articles only).
- 1 table with **no policy at all**: `seva_list_items` → with RLS enabled this
  denies all non-service-role access.
- `users` carries only `Deny all public access to users`; no `GRANT`/`REVOKE`
  statement anywhere in the migrations touches `users`.
- `seva_privilege_hardening.sql` revokes `TRIGGER, REFERENCES` (only those two
  privileges) from `service_role, anon, authenticated` on `audit_log`, `staff`,
  `seva_rate_history`, `seva_orders`, `seva_receipts`, `seva_receipt_lines`,
  `day_closes`.

### 1.4 Corrections to PR #352 and to the earlier audit text

- **C-1 (corrects an earlier claim).** `supabase/.temp/` is **already gitignored**
  by the nested `supabase/.gitignore` line 3 (`.temp`). No `.gitignore` change is
  needed; the "repository-config" item was a false positive.
- **C-2 (revalidates rev-2; corrects an earlier draft of this document).** Rev-2's
  "41 service-role-only tables" is **correct**: 40 tables have deny-only policies
  and `seva_list_items` has no policy, while 4 tables carry a permissive
  public-read policy (44 = 40 + 4). Note the rev-2 *split* ("48 deny / 8
  permissive") does not match the file: the exact counts are **51 deny / 5
  permissive**. Rev-2's claim that `users` has an `authenticated` SELECT grant is
  **not supported** — no `GRANT`/`REVOKE` on `users` exists.
- **C-3 (corrects rev-2 — the headline count is wrong).** The migration inventory
  holds **61** entries, not 59. Verified by importing the module, not by regex:

  ```text
  MIGRATION_INVENTORY.length = 61
  { EXCLUDE_AUTH: 2, EXCLUDE_SYSTEM: 2, MIGRATE: 15, REVIEW: 42 }
  EXCLUDED_AUTH_COLLECTIONS = ["users","sessions"]
  ```

  Rev-2 said "59 entries … 0 EXCLUDE_AUTH — the EXCLUDE_AUTH spread is outside the
  array". That is wrong: the spread is **inside** the array
  (`lib/supabase/migration-inventory.ts:13-19`) and contributes 2 entries, so the
  `EXCLUDE_AUTH` classification is 2, not 0. Rev-2's count of 59 came from the same
  regex trap: a text search for `collection: "…"` misses the two spread-built
  entries (`collection: col`) and matches 59, while the in-array
  `classification:` occurrences number 60. Only the runtime length is authoritative.
- **C-4 (confirms rev-2, and explains it).** Root-level `migration_report.md` claims
  "exactly 14 collections marked MIGRATE". There are **15 MIGRATE** entries, but
  only **14 have a `destinationTable`** — see C-7. The report counted the
  destination-bearing subset and mislabelled it. The root reports are unreliable.
- **C-5.** `docs/FIRESTORE_SUPABASE_MIGRATION_STATUS.md` is a one-line stub
  (`# Firestore -> Supabase Migration Status`). It is not a status document.
- **C-6 (new — a real blocker).** `MIGRATION_VERIFICATION_REPORT.md` asserts "NO
  migrations are pending" and that "local and remote histories match exactly".
  Its own recorded remote ledger stops at `20261010000000`; `20261103000000_add_auth_user_id_to_users.sql`
  was committed later (2026-10-20 18:12 UTC, commit `bbce117`). The report is
  **stale** and cannot speak to the new migration. Live ledger state is unverified.
- **C-7 (new — silent data-loss defect).** `knowledge` is classified `MIGRATE` but
  carries **no `destinationTable`**. `scripts/migrate-all-batched.ts:298-301` logs
  "Skipping knowledge (no destination table mapped)" and `continue`s **without**
  setting `overallSuccess = false` and without a FAILED manifest record (contrast
  the missing-mapper branch at :310-311, which does fail). Batch 1 therefore
  reports success while silently omitting all AI knowledge. Fix by mapping
  `knowledge` → `ai_knowledge` or reclassifying it. Pinned by
  `tests/unit/migration-inventory-census.test.ts`.

- **C-7 fix (implemented in this PR, code side).** The silent skip is now fail-closed
  (`scripts/migrate-all-batched.ts:298-319`): a `MIGRATE` entry with no
  `destinationTable` logs `::error::FATAL: … Refusing to report success.`
  (`:303`), sets `overallSuccess = false` (`:304`), writes a `FAILED` manifest record
  (`:309`, `failureReason: "MIGRATE collection has no destinationTable mapped"` at
  `:318`), and `continue`s. The run can therefore never report `SUCCESS`:
  `:496-497` maps a non-`SUCCESS` `overallStatus` to `process.exitCode = 1`. Pinned by
  three new tests in `tests/unit/migrate-all-batched.test.ts` (`:244`, `:257`, `:285`).
  The `knowledge` **mapping itself** (`knowledge` -> `ai_knowledge`, or reclassify to
  `REVIEW`) is left to a reviewed PR (B-5); this PR only removes the silent-loss failure
  mode.

#### C-8 to C-10 (final security review of this PR, 2026-10-21)

Three guard-coverage defects found by verifying the *tests* rather than trusting them. All
three are fixed in this PR; each fix is pinned by a regression test that was mutation-checked
(revert the fix -> the new test fails).

- **C-8 (test false negative - workflow injection detector).** The `run:` injection detector in
  `tests/unit/workflow-shell-injection.test.ts` matched expressions with `\$\{\{[^}]*...`, which
  stops at the first `}`. Any expression whose nested braces precede the untrusted token was
  therefore truncated and missed: `format('{0}', inputs.confirm)`, `toJSON(steps)`,
  `fromJSON(inputs.x).field`, `join(needs.x, ',')`. The token list also omitted
  `github.head_ref`, `github.ref_name`, `github.base_ref`, `github.actor`,
  `github.triggering_actor`, `github.event_path` and `github.event.ref`, all of which carry
  author-controlled text. Fixed by brace-depth expression extraction (`extractExpressions`)
  plus a broadened token list. No workflow in the repository currently contains such an
  expression (independent scan: 0 hits, before and after), so this was a latent detector gap,
  not a live vulnerability - but it made the repository-wide "every workflow is clean"
  assertion weaker than it claimed.
- **C-9 (missing destination guard - destructive writer).**
  `.github/workflows/resolve-raya-ai-baseline.yml` `INSERT`s a row into
  `supabase_migrations.schema_migrations` (via `scripts/resolve-baseline-raya-ai.mjs`, `:142`)
  but ran no destination guard, unlike the two sibling apply workflows. A stale
  `SUPABASE_PROJECT_REF` could therefore have written the baseline row to an unapproved project.
  Fixed by adding the `guard-approved-project.mjs` step before the resolve step, and by adding
  this workflow to the guarded-workflow list. A new repository-wide completeness test now fails
  if any workflow invokes a known database writer without a preceding guard.
- **C-10 (test false negative - export PII containment).** The raw-export sweep detector in
  `tests/unit/firestore-export-artifact-safety.test.ts` matched only a bare
  `data/firestore-dump/` line, so `path: data/firestore-dump/**`, `path: data/firestore-dump`,
  `path: data/firestore-export/*` and a nested `path: data/firestore-export/records/` all
  bypassed the un-gated-upload assertion while still sweeping raw documents. Fixed by parsing
  every `path:` value (inline and block) and treating any raw-export-root directory or glob as a
  sweep, while still allowing a targeted single file such as `.../MANIFEST.json`. The workflow's
  actual gating was already correct; only the check was blind to these forms.

Owner-only, not a code defect: the GitHub environment `Production` currently has
`protection_rules: []`, so `environment: production` does not by itself require a human
approval. The workflows that rely on that approval (`ai-knowledge-migration-apply.yml`,
`supabase-migrations.yml`, `resolve-raya-ai-baseline.yml`) need required reviewers configured
before they are treated as human-gated. Environment names are case-insensitive, so the lowercase
`production` binding itself is correct.

#### N-3 to N-5 (verifying the *tests*, second pass, 2026-10-21)

Found by mutating the real workflows rather than trusting the suite's green result. N-3 and N-4 are
fixed in this PR; N-5 is documented and deliberately out of scope.

- **N-3 (test false negative — guard *ordering*).** Every ordering assertion in
  `tests/unit/supabase-diagnostics-migration-safety.test.ts` compared raw `indexOf` text offsets.
  A text offset cannot tell "the guard runs" from "the guard's text is present", so a guard step
  that was `if: false`, `continue-on-error: true`, or `run: echo "node …/guard-approved-project.mjs"`
  still **passed**. Only a guard physically moved after the push failed. Fixed by parsing the
  workflow into steps per job and comparing **(step index, statement index)**; a guard that is
  disabled, continue-on-error, not actually invoked, or ordered after the command is now reported.
  `stepIsDisabled()` is deliberately narrow (only a literal `false`) so legitimate conditions such
  as `!cancelled()` or `${{ inputs.dry_run == false }}` are not false positives.
- **N-4 (test false negative — completeness check matched nothing).** The repo-wide
  "every migration writer is guarded" test used one shared marker list
  (`npx tsx scripts/migrate-*.ts`, …) that matches **no** command in `supabase-migrations.yml`,
  whose writer is `npm run supabase:migrations:push` → `supabase db push`. That workflow was
  therefore never checked. Fixed by listing the database-changing command(s) per workflow and by
  resolving `npm run <script>` through `package.json` to the underlying command. Each check also
  asserts the guard and the command are genuinely *present*, so it cannot pass by finding nothing.
- **N-5 (real defect, out of scope — unguarded `psql` writers).** `seva-backup.yml` and
  `seva-maintenance.yml` run `psql` against `SEVA_BACKUP_DB_URL` and have no destination guard.
  This is a different secret and not a migration, so it is excluded from the migration-writer check
  rather than allowlisted: adding `psql` to the denylist makes the suite fail, which is the correct
  signal. Tracked as **B-7** in §6.

Mutation evidence (real `.github/workflows/supabase-migrations.yml`, not a fixture): before the fix
3 of 5 mutations slipped through; after the fix all 5 are caught — guard moved after the push, push
moved before the guard, `if: false`, `continue-on-error: true`, and guard replaced by `echo`.

**C-10 extension (same pass).** The export sweep detector also exempted anything ending in a file
extension, so `data/firestore-dump/*.ndjson` and `*.json` counted as a "targeted single file" and
bypassed the un-gated-upload assertion. Fixed: any `*`, `?`, `[]` or `{}` path is a sweep; only a
literal `NAME.ext` stays targeted.



### 1.5 Previously reported counts and tests

Revalidated 2026-10-21 (this PR revision):

- Full suite: **191 suites / 2691 tests, all passing** (`npx jest`). Rev-2's 2614 and the
  earlier 2629/2683/2689 are all stale.
- New suites added by this PR:
  - `tests/unit/firestore-export-artifact-safety.test.ts` (37 tests) — export PII containment.
  - `tests/unit/migrate-all-batched.test.ts` +3 tests — fail-closed on a destination-less
    `MIGRATE` entry.
  - `tests/unit/supabase-diagnostics-migration-safety.test.ts` (57 tests) — destination guard
    for write-capable migration workflows, plus the writer/guard completeness check. The
    guard-ordering assertions are step-aware and non-vacuous (see §1.4, N-3/N-4).
  - `tests/unit/workflow-shell-injection.test.ts` (18 tests) — repo-wide `run:` injection guard,
    including the nested-brace and ref/actor regression cases (C-8).
- `npm run typecheck` EXIT=0; `npm run lint` 0 errors; `npm run build` EXIT=0;
  `node .ai/scripts/validate-workflows.mjs` validates 24 files;
  `node .ai/scripts/assert-trusted-review.mjs` passes for 4 workflows.
- Local DB tests (`npm run test:db`) **do** run: 16 suites / 234 tests pass against an
  in-process **PGlite** instance (`tests/db/harness.ts`), which replays the committed SQL.
  This validates the migration files parse and apply; it says nothing about the hosted
  destination. Live verification against the hosted project was **not** run (§3).
  Policy/RLS counts in §1.3 are from the committed migrations, not a live `pg_policies` read.

---

## 2. Export workflow safety assessment

`.github/workflows/firestore-production-export.yml`, `workflow_dispatch` only.

**Credentials** (by name only): `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
`FIREBASE_PRIVATE_KEY`.

**Read-only:** yes. `scripts/dump-firestore-live.ts` issues only
`GET …/documents/<col>` and `POST …:listCollectionIds` (a read RPC). No
`:commit`, no `PATCH`, no `DELETE`.

**Scope:** the **top-level** collections listed in `EXPECTED` (~59 names) minus
`EXCLUDED = [users, profiles, bookmarks, sessions]`. Only `listCollectionIds`
(root) is used; **nested subcollections are not enumerated or exported**.

**Pagination / retries / consistency:**

- pagination: `FIRESTORE_PAGE_SIZE = 100`, follows `nextPageToken`, verified.
- retries: `FIRESTORE_MAX_RETRIES = 10` with exponential backoff capped at
  `FIRESTORE_MAX_BACKOFF_MS = 120000`, plus a global request pacer. **A failed
  collection is skipped, and `totalFailed` is set.**
- consistency: the REST `documents` API sets no `readTime`; there is **no
  snapshot or read-time consistency**. Mid-run writes can yield a torn export.
- completeness: MANIFEST-recorded `docCount` per collection is asserted against
  the file's real line count; a mismatch and any `totalFailed > 0` fail the job.

**Output and exposure — the important finding:**

- Written to the runner workspace: `data/firestore-export/*.ndjson` (raw wire
  form) **and `data/firestore-dump/<col>.json` (decoded document bodies)**.
- Uploaded as artifact **`firestore-production-export`**, `retention-days: 7`.
  The workflow then `rm -rf`s the workspace copies (`if: always()`).
- **This repository is public.** Actions artifacts on a public repository are
  downloadable by anyone with read access to the repository. The decoded bodies
  include `donations`, `sevaBookings`, `messages`, `feedback`, `volunteers`,
  `members` — receipts, names, contact details and prayer/support messages. **This
  is a personal-data exposure and must be closed before the next export run.**

**Status: containment implemented in this PR (B-2, code side).** The upload is now
policy-gated rather than unconditional:

- a `publish_artifact` `workflow_dispatch` input, default **false**;
- a policy step that emits `allow=true` only when the repository is private **and**
  an access-controlled destination token is configured. On a public repository it
  always emits `allow=false`;
- a hard-fail step (`exit 1`) when `publish_artifact=true` but publication is not
  allowed, so the workflow fails loudly instead of leaking;
- an always-run upload of **only `data/firestore-dump/MANIFEST.json`** (counts and
  file names, no document bodies), retention 7 days;
- the raw-data upload now requires
  `if: steps.upload_policy.outputs.allow == 'true'`.

Pinned by `tests/unit/firestore-export-artifact-safety.test.ts` (35 tests, static +
behavioral). **Still owner-gated:** the workflow may only be dispatched after the
owner approves the exact target environment and destination.

**Verifying completeness without logging contents:** the MANIFEST records
`{collection, status, docCount, file, reason}` only. The `Validate generated
export` step already checks per-collection `docCount` against the file line count
and asserts `totalCollections`/`totalDocs`, printing only counts. Operators should
read the MANIFEST and the `collection_count`/`total_docs` step outputs — never
document bodies.

**Owner-gated run:** do not dispatch. Before any run: add a non-public destination
(private artifact or encrypted upload), or split so that only the raw NDJSON with
PII redaction is uploaded; and confirm `production` environment reviewers.

---

## 3. Destination verification

Approved production project (given by the owner, do not re-confirm against
others): **ref `kvrkraqjuyxbraccxntk`**. CI `Supabase Preview` previously resolved
its URL independently; that is treated as corroboration. The value is centralised in
`scripts/lib/approved-project.mjs`; it is **not** duplicated in workflow YAML or in
any other script.

`supabase/config.toml` carries `project_id = "rayaramathaynk"`, which is the
**local CLI project name**, not the hosted ref. It must not be read as the target.

**Destination guard added in this PR (code side).** Three write-capable workflows now
verify the destination before any database-changing command:

- `supabase-migrations.yml` and `ai-knowledge-migration-apply.yml` run
  `scripts/lib/guard-approved-project.mjs` (project-ref guard);
- `firestore-batched-migration.yml` and `firestore-staged-migration.yml` run the new
  `scripts/lib/guard-approved-supabase-url.mjs` (URL guard), because they authenticate
  with `NEXT_PUBLIC_SUPABASE_URL` + a service-role key rather than a ref.

Both guards read the value from the environment (never `argv`), fail closed on a
missing/malformed/mismatched value, and print only a SHA-256 fingerprint. Pinned by
`tests/unit/supabase-diagnostics-migration-safety.test.ts`.

Live state (ledger, tables, counts, RLS) is **UNVERIFIED and remains a blocker** — there is no
`psql`, and the database reachable from this environment is **not** the production project.

**Read-only identity check performed 2026-10-21** (credentials used only in-process; only
non-secret facts recorded):

| Value | SHA-256 prefix of ref |
|---|---|
| Approved production ref, from `scripts/lib/approved-project.mjs` | `233ede17c9c7` |
| Sandbox `SUPABASE_PROJECT_REF` | `72b54d98a3dc` |
| Sandbox `SUPABASE_DB_URL` (ref parsed from pooler username) | `72b54d98a3dc` |

The two differ, so the sandbox credential does **not** point at the approved production
project. A read-only query of the sandbox database returned `public` tables
`teams`, `matches`, `players`, `tournaments`, `courts`, … and **no** `events`,
`seva_bookings` or `announcements` — confirming it is an unrelated project. Nothing was
written; `set_session(readonly=True)` was set before any query.

Consequence: **no in-scope table can be reported `MIGRATED_VERIFIED` from this environment**,
and destination row counts must be reported `UNKNOWN`, never `0`. The approved ref itself is
still only *asserted* by the owner in this document; it is corroborated by CI, not
independently proven here. See A-1/A-2 for the read-only verification the owner must run.

---

## 4. Aaradhane cutover design

- **Current writer:** `.github/workflows/aaradhane.yml`, cron `30 3 1 1 *` plus
  `workflow_dispatch`; reaches `lib/aaradhane/firestore-admin.ts`.
- **Destination schema:** the `events` table (`supabase/migrations/20261011000000_alter_events_nullable.sql`
  and predecessors).
- **Deterministic IDs:** reuse the existing Firestore document ID as the Supabase
  primary key / `firestore_id` provenance column, so a re-run cannot duplicate a
  row. Preferred key form `generated-<year>-<slug>`.
- **Idempotency:** `INSERT … ON CONFLICT (id) DO UPDATE` keyed on the deterministic
  ID; never insert-then-insert.
- **Time zone / dates:** the job runs 03:30 UTC. Aaradhane dates are Indian civil
  dates; compute the event date in `Asia/Kolkata` and store a plain `date`. Do not
  derive the year from a UTC timestamp.
- **Retry / recovery:** the generator is idempotent, so a failed run may simply be
  re-dispatched. Wrap writes in a transaction per event so a partial year cannot
  be committed.
- **Monitoring / alerting:** the workflow already fails the job on error. Add a
  step that fails when `events` gains zero rows for a non-empty expected set.
- **Prevent dual writes:** the cutover PR must delete the Firestore
  `updateFirestoreWithAdmin` call and the `firebase-admin-key.json` step in the
  same change that enables the Supabase writer. Until then, do not enable the
  Supabase writer.
- **Rollback / reconciliation:** keep the Firestore writer behind a
  workflow_dispatch-only manual fallback for one cycle; reconcile by counting
  `events` for the target year against the generated expected count before
  retiring Firestore.
- **Minimum implementation change:** one PR that (a) replaces the Firestore write
  with a Supabase upsert, (b) removes the Firestore dependency and credential, and
  (c) adds an acceptance test. **Acceptance tests:** deterministic IDs are stable
  across two runs; a second run changes no row count; a cancelled run leaves no
  partial year; a non-Supabase-available run fails loudly without writing.

---

## 5. Raya AI cutover design

Per call site in §1.2:

- **`announcements.ts`** — operation read; affected data: active announcements.
  **Destination missing:** add an `announcements` table (id/title/body/active/
  start/end timestamps) with a public-read policy limited to `active` + in-window.
  Field map: Firestore `isActive`→`active`, `publishedAt`→`published_at`,
  `expiresAt`→`expires_at`. Access control: public read, service-role write.
  Fail-safe: on Supabase error the retriever must return an empty result and the
  chat route must return the existing "safe" fallback (`app/api/chat/route.ts:212-222`),
  never a Firestore read.
- **`chat.service.ts`** — split the remaining Firebase half onto the existing
  `chat_sessions`/`chat_messages` tables; keep `firestore_id` as provenance.
- **`knowledge-workflow.service.ts`** and `app/api/admin/knowledge/**` — map the
  seven `knowledge_*` collections onto `ai_knowledge` (or document an explicit
  EXCLUDE). Admin-only, service-role access.
- **`app/admin/ai/training/page.tsx`** — `chatTraining` is EXCLUDE_SYSTEM; remove
  the read or mark the page as Firestore-dependent.

**Tests required before any "Supabase-only" claim:** a runtime assertion that no
`firebase/firestore` import is reachable from the `/api/chat` dependency graph; a
test that each retriever returns a safe empty result when Supabase is stubbed to
throw; and a test that no Firestore fallback branch exists. `tests/unit/raya-ai-auth-isolation.test.ts`
currently *allow-lists* two of these offenders, so it must be tightened, not cited.

---

## 6. Prioritised backlog

Phases: **A** read-only verification · **B** export/data-quality prep ·
**C** schema and RLS (reviewed) · **D** application cutover ·
**E** dry-run and reconciliation · **F** approved production migration.

| ID | Phase | Task | Depends on | Risk | Acceptance criteria | Approval |
|----|-------|------|-----------|------|--------------------|----------|
| A-1 | A | Independently confirm the production project identity (ref `kvrkraqjuyxbraccxntk`) via the Supabase dashboard / MCP against trusted config | — | High: wrong project = data loss | Identity matched by an owner-approved channel; recorded without printing secrets | Owner |
| A-2 | A | Read the live `supabase_migrations.schema_migrations` ledger, `information_schema.tables`, per-table row counts, and `pg_policies` | A-1 | Medium | Ledger shows whether `20261103000000` is applied; output is counts/names only | Owner |
| A-3 | A | Re-audit all Firestore read/write call sites on `main` (Raya AI + Aaradhane + any admin route) | — | Low | All call sites enumerated with file:line | — |
| B-1 | B | Retire/re-point the Aaradhane scheduled Firestore writer, or gate it behind `dry_run` so cron cannot write | A-3 | **Critical** | Cron no longer writes Firestore; `--dry-run` on schedule | Owner |
| B-2 | B | **Code side done in this PR:** export raw upload policy-gated (default refuse; public repo always refuses). **Owner side remains:** set `production` reviewers and approve destination | — | **Critical (PII)** | No decoded bodies externally readable; retention ≤7d; `publish_artifact=false` on public repo | Owner |
| B-3 | B | Fix export completeness: enumerate nested subcollections, add `readTime` snapshot consistency, fail instead of skip, record per-path results, preflight quota check | — | Medium | MANIFEST covers nested paths; a missing collection fails the run | Owner (to run) |
| B-4 | B | `20261103000000_add_auth_user_id_to_users.sql` — decide apply vs revert; if kept, confirm ordering after `20261102000300` | A-2 | Medium | A1-2 confirms ledger vs file; ordering decided | Owner |
| B-4b | B | Move `20261006101759_seed_ai_settings.sql` out of the migration sequence | — | Low | Seed is not applied as a migration | — |
| B-5 | B | Map `knowledge` → `ai_knowledge` (or reclassify). **Fail-closed half done in this PR:** a destination-less `MIGRATE` entry now fails the run instead of silently skipping | — | **High (silent data loss)** | No `MIGRATE` entry lacks a destination; a missing destination sets `overallSuccess=false`; census test updated | Reviewed PR |
| B-2b | B | **Done in this PR:** destination guard added to write-capable migration workflows (URL guard for the two Firestore workflows, ref guard for ai-knowledge) | — | High: wrong project = data loss | Every DB-changing workflow runs a guard before its first migration command; pinned by tests | Reviewed PR |
| B-2c | B | **Done in this PR (C-9):** destination guard added to `resolve-raya-ai-baseline.yml`, which `INSERT`s into `supabase_migrations.schema_migrations` | — | High: wrong project = bad ledger | Every writer runs a guard before its first DB command; completeness test enumerates all workflows | Reviewed PR |
| C-5 | C | Configure required reviewers on the `Production` GitHub environment | — | High: `environment: production` is currently not a human gate (`protection_rules: []`) | Environment blocks until a reviewer approves | Owner |
| B-6 | B | Rotate the exposed Firebase service-account key and purge it from Git history | — | **Critical** | New key live; old key revoked; history rewritten | Owner + security |
| B-7 | B | Add a destination guard to the `psql` writers `seva-backup.yml` and `seva-maintenance.yml` (they authenticate with `SEVA_BACKUP_DB_URL`, a different secret) | — | Medium: wrong DB = bad backup/restore | Both workflows verify their destination before any `psql` write; pinned by a test that includes `psql` in the writer denylist | Reviewed PR |
| C-1 | C | Create the `announcements` table + public-read policy | A-1 | Medium | `announcements` exists; policy limited to active/in-window | Reviewed PR |
| C-2 | C | Add the missing policy for `seva_list_items` (service-role only, explicit) | A-2 | Medium | RLS policy present; no widening | Reviewed PR |
| C-3 | C | Consolidate the duplicate `temple_areas` policies (`20240523000000`, `20240915`) | A-2 | Low | One policy; no behaviour change | Reviewed PR |
| C-4 | C | Document the least-privilege roles per in-scope table (see §7) — no policy weakening | A-2 | High | Matrix reviewed and signed off | Owner |
| D-1 | D | Raya AI `announcements` retriever → Supabase; remove Firestore fallback | C-1 | High | Tests in §5 pass; no Firestore in `/api/chat` graph | Reviewed PR |
| D-2 | D | Split `chat.service.ts` Firebase half onto Supabase | A-2 | Medium | No `firebase/firestore` import remains | Reviewed PR |
| D-3 | D | `knowledge-workflow.service.ts` + `app/api/admin/knowledge/**` → Supabase | A-2 | Medium | Admin paths use Supabase only | Reviewed PR |
| D-4 | D | Aaradhane writer → Supabase upsert (see §4) | B-1 | High | Acceptance tests in §4 pass | Reviewed PR |
| E-1 | E | Dry-run the full batch migration against production (no writes) | A-2, C-*, D-* | Medium | Dry-run report reviewed; 0 unexpected failures | Owner |
| E-2 | E | Reconciliation: compare Firestore vs Supabase counts per collection | E-1 | Medium | Differences explained and accepted | Owner |
| F-1 | F | Apply schema/RLS migrations | C-* | High | Ledger matches; rollback rehearsed | Owner + reviewers |
| F-2 | F | Run the approved production migration batch | F-1, E-2 | **Critical** | MANIFEST clean; post-migration verification passes | Owner + approval |
| F-3 | F | Final cutover: remove all Firestore reads/writes and the credential | F-2 | High | No Firestore reference remains | Owner |

**Freeze note (updated in this PR).** The migration git-tracked workflows now carry a
destination guard: `firestore-batched-migration.yml` and `firestore-staged-migration.yml`
run `scripts/lib/guard-approved-supabase-url.mjs` before any migration script;
`ai-knowledge-migration-apply.yml`, `supabase-migrations.yml` and
`resolve-raya-ai-baseline.yml` run `scripts/lib/guard-approved-project.mjs`. A wrong
destination now fails closed instead of writing. The workflows are still **not** to be
dispatched until the owner approves the target environment (see §9), and the `Production`
environment itself must gain required reviewers (C-5).

---

## 7. RLS blockers and proposed least-privilege requirements

No policy may be weakened. Requirements per in-scope table:

| Table | Public (`anon`) | `authenticated` | Service role | Notes |
|-------|-----------------|-----------------|--------------|-------|
| `temple_areas`, `site_settings`, `social_links` | SELECT | SELECT | ALL | existing public-read policy kept |
| `ai_knowledge` | SELECT (approved only) | SELECT (approved only) | ALL | policy exists; do not broaden |
| `seva_list_items` | none | none | ALL | **blocker:** no policy today; add explicit service-role-only |
| `events` | SELECT | SELECT | ALL | required for Aaradhane cutover + public calendar |
| `seva_*` | none | none | ALL | keep `seva_privilege_hardening.sql` |
| `chat_sessions`, `chat_messages`, `announcements` | none | none | ALL | written only by the chat backend |
| `users` | none | none | ALL | deny-only today; role resolution via `auth_user_id` |

**Blocker:** 41 tables are service-role-only. Any runtime feature that must read
one of them as `anon`/`authenticated` will fail silently after cutover. Each such
feature needs a reviewed, least-privilege policy before cutover — not a blanket
grant.

---

## 8. Evidence and commands

```bash
# export PII containment: raw upload must be policy-gated everywhere
npx jest tests/unit/firestore-export-artifact-safety.test.ts

# migrator must not report success while omitting a collection
npx jest tests/unit/migrate-all-batched.test.ts

# destination guard for write-capable workflows (static + behavioral)
npx jest tests/unit/supabase-diagnostics-migration-safety.test.ts

# full suite, types
npx jest
npm run typecheck

# repository workflow validators
node .ai/scripts/validate-workflows.mjs
node .ai/scripts/assert-trusted-review.mjs

# injection detector: nested-brace and ref/actor regression cases (C-8)
npx jest tests/unit/workflow-shell-injection.test.ts

# writer/guard completeness across all workflows (C-9)
npx jest tests/unit/supabase-diagnostics-migration-safety.test.ts

# inventory count (expect length 61; 15 MIGRATE / 42 REVIEW / 2 EXCLUDE_SYSTEM / 2 EXCLUDE_AUTH)
npx tsx -e 'import {MIGRATION_INVENTORY,EXCLUDED_AUTH_COLLECTIONS} from "./lib/supabase/migration-inventory";
const c={};for(const i of MIGRATION_INVENTORY)c[i.classification]=(c[i.classification]||0)+1;
console.log(MIGRATION_INVENTORY.length, c, EXCLUDED_AUTH_COLLECTIONS)'
```

Executed results (2026-10-21, second pass): export safety **37 passed**; migrate-all-batched
18 passed; diagnostics safety **57 passed**; workflow-shell-injection 18 passed; inventory census 5
passed; full suite **191 suites / 2691 tests passed**; typecheck EXIT=0; lint 0 errors; build EXIT=0;
`test:db` 16 suites / 234 tests passed (PGlite); both workflow validators pass.

Mutation checks confirmed each guard test detects its defect. Recorded results:

- Real `.github/workflows/supabase-migrations.yml`, five mutations — guard moved after the push
  (2 failed), push moved before the guard (2 failed), `if: false` (2 failed),
  `continue-on-error: true` (2 failed), guard replaced by `echo` (3 failed). Before the N-3 fix the
  middle three passed, i.e. were not detected.
- Weak export sweep matcher (`*.ndjson` treated as a targeted file) → the new glob test fails.
- Earlier rev: restored silent skip → failures; removed URL guard → failures; fail-open export
  policy → failures; reverted injection token list → 2 failures; removed baseline guard → 2 failures.

---

## 9. Exact next owner action

1. **Confirm the production export workflow before it is ever dispatched.** The exact
   workflow is `.github/workflows/firestore-production-export.yml` (`workflow_dispatch`
   only; reads Firestore, writes to the runner + artifact). Approve the target
   environment (`production`) and the output destination; keep `publish_artifact=false`
   unless a private, access-controlled destination is configured. Manual steps if
   approval is needed: (a) set the `production` environment required reviewers;
   (b) decide whether any raw export may leave the runner at all; (c) dispatch with
   `publish_artifact=false` and inspect only the MANIFEST.
2. **Approve or reject A-1**: give an owner-approved channel (Supabase dashboard
   screenshot or MCP session) confirming ref `kvrkraqjuyxbraccxntk` is the production
   project, so live ledger/schema/RLS verification (A-2) can proceed.
3. **Authorise B-6**: rotate `FIREBASE_PRIVATE_KEY` and purge it from Git history.
4. **Decide B-1**: whether cron may keep writing Firestore until D-4 lands (B-1 stays
   critical until then; this PR does **not** change the Aaradhane workflow).
5. **Review B-5 mapping**: decide `knowledge` → `ai_knowledge` vs reclassify to `REVIEW`.
6. **Configure the `Production` environment (C-5).** It currently has
   `protection_rules: []`, so `environment: production` does not pause for a human. Add
   required reviewers before any of `ai-knowledge-migration-apply.yml`,
   `supabase-migrations.yml` or `resolve-raya-ai-baseline.yml` is treated as human-gated.

No production write, export run, migration batch, schema change, RLS change,
deployment, or merge is performed by this document.
