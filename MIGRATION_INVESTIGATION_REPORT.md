### 1. Remote-only migration

```text
20260918143124
```

What evidence exists about what it represents?

- The remote migration is named `create_content_tables`.
- The repository contains `20261001000000_create_content_tables.sql`.
- The repository commit `3a1dc9760226cab8ef5288ef507be698b13b78cb` introduced that migration on September 18, 2026.
- The remote migration timestamp `20260918143124` falls immediately before that commit.
- The available evidence strongly supports that the migration was renamed/re-versioned before repository commit.

### 2. Remote schema differences

It is important to explicitly distinguish between schema equivalence/correspondence, migration-history equivalence, and exact SQL identity. While we cannot prove exact SQL identity without the original remote SQL file, the remote schema objects correspond directly to the local schema objects defined in `20261001000000_create_content_tables.sql` (e.g., users, profiles, donations, etc.). There is schema correspondence, but the migration-history is not equivalent (the ledger entries differ).

### 3. Repository correlation

The commit `3a1dc9760226cab8ef5288ef507be698b13b78cb` ("chore: add remaining content tables and report migration blocked").

This commit occurred on September 18, 2026, which directly correlates with the timestamp of the remote migration (`20260918143124`) prior to it being locally renamed to `20261001000000_create_content_tables.sql`.

### 4. Final Validation

- `supabase migration list` reveals the presence of `20260918143124 | create_content_tables` only in the remote ledger.
- Local migration inventory shows `20261001000000_create_content_tables.sql` mapping to the same conceptual domain, added on September 18, 2026.
- Subsequent migrations (e.g., `20261002000000_align_content_firestore_ids.sql`) depend on the tables created in the content tables migration, confirming the schema is applied.
- Current tests and linters report failures, but these are pre-existing issues (e.g., AI Intent test fallbacks and unused variables in Playwright tests). No changes in this PR affect or cause these failures.

### 5. Recommended action

Based on the available evidence, the repository does not appear to be missing a schema migration. The mismatch appears to be migration-history drift. The next operational step is to repair the stale remote migration-history entry, but that operation should be performed separately and only after recording the migration-list evidence. Note that `supabase migration repair` changes the migration-history ledger; it does not delete the schema objects created by the migration.
