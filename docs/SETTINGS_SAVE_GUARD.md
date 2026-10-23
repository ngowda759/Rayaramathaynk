# `guruParampara` — safe migration, reconciliation and save guard

Status: **save guard implemented** (this branch); **migration and reconciliation designed,
not run.** `npm run migrate:settings` is an owner action and is not executed here.

Related: `services/guru-parampara.service.ts`, `app/api/admin/settings/guru-parampara/route.ts`,
`app/admin/settings/guru-parampara/page.tsx`, `scripts/migrate-settings.ts`,
`supabase/migrations/20260922000000_create_settings_documents.sql`.

---

## 1. The hazard

`app/admin/settings/guru-parampara/page.tsx` was cut over to Supabase in PR #360: it now
calls an admin-guarded route over `services/guru-parampara.service.ts`, which reads and
writes one `settings_documents` row (`document_key = "guruParampara"`). The Firestore
document is copied into that row only by `npm run migrate:settings`.

Before this change the cutover had a silent data-loss path:

1. The row does not exist yet (migration not run).
2. `get()` returns `null`; the page falls back to its in-file `defaultData`.
3. An admin opens the page, sees plausible-looking defaults, clicks **Save**.
4. The upsert writes those defaults as the stored document — over content that the
   temple had curated. It looks like a successful save.

A database-URL guard or an environment binding does not help here: the write is
*legitimate* and *authorized*. The problem is that the payload is the wrong content. So the
guard has to be about **what** is written, not **who** may write.

## 2. The save guard (implemented)

The save now requires proof that the caller is updating content it actually read.

- **GET** returns `{ data, revision }`. `revision` is `computeRevision(data)` — a SHA-256
  over the key-sorted JSON, truncated to 32 hex chars — or the sentinel `absent` when no
  row exists. It is a change token, not a security control: it is shown to an
  already-authenticated admin and reveals nothing they cannot read anyway.
- **PUT** requires `{ expectedRevision, data }`. The service re-reads the row and:
  - refuses if `expectedRevision` is missing or does not match the stored revision
    (a concurrent edit is not silently lost) → `409`;
  - refuses to **create** the row when the caller read `absent`, unless the caller
    explicitly passes `allowCreate: true` → `409`. This is the missing-data guard: the
    first save from a page showing defaults fails closed.
- The route **does not accept `allowCreate` from the request body**, so an admin cannot
  opt into creation per call; enabling it is an owner/code decision.
- The page disables **Save** while the revision is not yet loaded, and shows a banner when
  the document is missing ("run `npm run migrate:settings`"), so the admin is told *why*
  rather than shown a failed save.

This closes the silent-overwrite path and the ordinary lost-update path. It is a *guard*,
not a compare-and-swap: the check reads then writes, so two saves issued in the same
instant could still interleave. Closing that fully needs a `revision` column or an RPC
(`... where data = expected`), which is schema work and out of scope for this PR. The
residual window is far narrower than the bug it replaces (a save must now present a
revision that was current moments ago), and it is recorded as a follow-up in §5.

## 3. Migration (designed, not run)

`npm run migrate:settings` → `scripts/migrate-settings.ts` reads the Firestore `settings`
collection and writes three Supabase targets: `site_settings`, `social_links`, and
`settings_documents` (via `mapSettingsDocument`, which preserves the whole document as
JSONB and sets `firestore_id = document_key = id`). `guruParampara` is one of the
`settings_documents` rows.

Safe sequence, all owner-run:

1. **Dry run first:** `npm run migrate:settings -- --dry-run`. The script's dry-run path
   only *selects* existing `firestore_id`s and prints "would insert/update"; it writes
   nothing. Confirm `guruParampara` is in the `settings_documents` list and reported as an
   insert (not an update over unexpected content).
2. **Apply:** run without `--dry-run`. The script upserts on `firestore_id` and prints a
   reconciliation report (`reconcileCounts`); it exits non-zero if any document is
   unaccounted for or any write failed.
3. **Verify (read-only):** `select document_key, source_field_count, updated_at from
   settings_documents where document_key = 'guruParampara';` — expect one row with a
   non-zero `source_field_count`.
4. **Only then** is the admin page safe to save from, because GET will now return a
   revision rather than `absent`.

The migration is idempotent (upsert on `firestore_id`), so a re-run updates the row rather
than duplicating it. It does not delete anything.

## 4. Reconciliation

Three independent checks, because each catches a different failure:

1. **Count reconciliation** (already in the script): every source document is accounted
   for as an insert or a validation/write failure; the script exits non-zero otherwise.
2. **Field-shape reconciliation:** compare `source_field_count` for the `guruParampara`
   row against the Firestore document's top-level field count. `mapSettingsDocument` sets
   it from `Object.keys(data).length`, so a mismatch means the document was reshaped.
   Because the container is lossless JSONB, a mismatch is a red flag, not a normal state.
3. **Content reconciliation:** the guard's own `computeRevision` gives a cheap equality
   check — read the row through the service and confirm the parsed `GuruParamparaData`
   equals the Firestore document's mapped shape (`heading`, `headingKannada`,
   `subheading`, `subheadingKannada`, `gurus[]`). `parseGuruParamparaData` already rejects
   a row that does not have that shape, so a malformed migration fails loudly on first read
   instead of rendering a broken page.

If Firestore is ever *ahead* of Supabase (a doc edited in Firestore after the migration),
the count check will not see it. That is expected: after the cutover Firestore is frozen
for this document, and the fix is to re-run the migration, not to write to both stores.

## 5. Follow-ups (not in this PR)

- **Atomic compare-and-swap:** add a `revision` column (or an RPC doing
  `update ... where data = expected`) so concurrent saves cannot interleave. Schema work.
- **`allowCreate` policy:** the create path exists in the service but is off in the route.
  Decide whether an owner ever wants it (e.g. a deliberate "seed from defaults" action),
  and if so, gate it behind an owner-only route rather than a request-body flag.
- **Retire the Firestore source:** once the migration has run and been verified, the
  Firestore `settings/guruParampara` document is dead; confirm before deleting anything in
  Firestore, which this repository no longer writes.

## 6. What this PR does and does not do

- **Does:** add the revision round-trip (service + route + page), the missing-data guard,
  the banner, and the tests that pin all of it.
- **Does not:** run `npm run migrate:settings`, touch Firestore, change any schema, or
  change RLS. The migration remains an owner action gated on §3.
