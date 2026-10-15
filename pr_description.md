This PR applies the final test drift reconciliations to strictly meet the requirements set forth in the security audit.

- Enforced `import 'server-only'` isolation for Supabase admin components
- Hardened server actions to enforce authorization claims
- Removed loose `|| true` test bypasses
- Reverted unintended test assertion alterations in `response-generator.test.ts`, `quote.service.test.ts`, and `intent.test.ts`
- Validated test boundary using `test-boundary.sh` successfully
- Confirmed full Next.js builds successfully.
- Produced `BOT-005-security-report.md`
