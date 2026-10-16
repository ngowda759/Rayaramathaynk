# Security task — rotate the Supabase access token

Status: **open, not performed.** Tracked here so it is a first-class security item,
separate from the Raya AI verification work. This document contains no secret values.

## Why

The repository secret `SUPABASE_ACCESS_TOKEN` is used by the guarded AI-migration
tooling (`.github/workflows/ai-knowledge-migration-apply.yml`,
`.github/workflows/resolve-raya-ai-baseline.yml`) to ask the Supabase Management API
for the project region. During the 2026-10-16 verification runs the Management API
call **failed** and the tooling fell back to scanning known Supavisor region hosts:

```
Management API unavailable (region unknown). Falling back to a read-only
scan of known Supavisor region hostnames for this tenant.
Reachable via aws-1-ap-south-1.pooler.supabase.com:5432 (session pooler).
```

The fallback works, so this is **not currently blocking** the migration path. It is
still worthwhile security maintenance: either the token is expired (benign) or it is
no longer valid for the project (needs a fresh, least-privilege token). Rotating
removes ambiguity and restores the fast, deterministic region lookup.

## Impact / exposure assessment

- The token is a **repository secret**, not committed, not in any workflow log (the
  tooling redacts the project ref and never prints credentials).
- If it is merely expired, there is no exposure. If it was shared or is broader than
  needed, rotation closes that window.
- The token is used only for a read-only Management API `GET /v1/projects/{ref}`.

## Procedure (owner action; requires Supabase account access)

1. In the Supabase dashboard, create a **new** personal access token scoped to the
   minimum needed (project read). Do not reuse an existing broad token.
2. Update the repository secret:
   ```bash
   gh secret set SUPABASE_ACCESS_TOKEN --repo ngowda759/Rayaramathaynk
   ```
3. Revoke the old token in the Supabase dashboard.
4. Verify recovery by dispatching a read-only gate with the Management API path:
   ```bash
   gh workflow run prisma-baseline-drift-gate.yml \
     --repo ngowda759/Rayaramathaynk --ref main -f mode=catalog
   ```
   The run log should now say the region came from the Management API (no scan
   fallback). The gate result must remain PASS.

## Acceptance

- The Management API region lookup succeeds (no scan fallback in the log).
- The old token is revoked.
- The guarded workflows still complete with the same results.
- No secret value appears in any log, commit, or this document.

## Notes

- This task does **not** modify the database or deploy anything.
- It is independent of the Raya AI pages; the region-scan fallback means it can be
  scheduled on its own cadence.
