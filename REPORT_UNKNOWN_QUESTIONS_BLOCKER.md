# Investigation Report: Batch 2 Migration Blocker for `unknown_questions`

This report investigates a validation failure that blocked the Batch 2 migration during the mapping phase for the `unknown_questions` collection.

## Failure Details
* **Collection**: `unknown_questions`
* **Firestore document**: `1cMSdGgkHf1gtgkGxn3z`
* **Error**: `Missing required field: question`
* **Batch 2 results context**: 44 documents migrated successfully, 1 failed validation, 0 write failures, process exited with code 1.

## 1. Investigation of Firestore Document `1cMSdGgkHf1gtgkGxn3z`
We have attempted to locate the exact contents of this document in the local workspace (e.g. `data/exports/` and local seed scripts). The document `1cMSdGgkHf1gtgkGxn3z` does not exist in any local development dumps, testing fixtures, or cached exports. Accessing it directly requires the production credentials (which are strictly forbidden/unavailable in this environment) or the raw GitHub Actions export artifact.

## 2. Nullability of the `question` Field (Document State)
Because the document cannot be fetched locally, we must rely on the exact error signature from the GitHub Actions log and the code path.
The validation function used is `requireString` (`lib/supabase/migration-helpers.ts`):
```typescript
function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`Missing required field: ${field}`);
  }
  return value;
}
```
Given the error `Missing required field: question`, we can unequivocally confirm that the value of `question` in document `1cMSdGgkHf1gtgkGxn3z` is exactly one of the following:
1. `undefined` (missing entirely)
2. `null`
3. A non-string type (like a boolean or number)
4. An empty string `""` or a string containing exclusively whitespace spaces (`!value.trim()` evaluates to `true`).

## 3. Exact Mapper Used for `unknown_questions`
The exact mapper used is `mapUnknownQuestion`, located in `lib/supabase/migration-mappers.ts`:
```typescript
export function mapUnknownQuestion(id: string, data: any): Record<string, any> {
  const question = requireString(data.question, "question");
  return {
    firestore_id: id,
    question,
    question_lower: optionalString(data.questionLower) ?? question.toLowerCase(),
    // ...
```

## 4. Exact Validation Logic Rejecting `question`
The field is rejected on line 543 of `lib/supabase/migration-mappers.ts`:
```typescript
const question = requireString(data.question, "question");
```
It fails specifically inside `requireString`'s guard: `if (typeof value !== "string" || !value.trim())`.

## 5. Supabase Schema Constraints for `unknown_questions.question`
The destination table `unknown_questions` is defined in `supabase/migrations/20260930000000_create_ai_tables.sql`.
The `question` column has a strict `NOT NULL` constraint:
```sql
CREATE TABLE unknown_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    question text NOT NULL,
    question_lower text,
    -- ...
);
```
As per the user's explicit instructions, the schema must **not** be modified, meaning `question` cannot be made nullable.

## 6. Invalidity of Other Fields
Because `data.question` is the very first field evaluated in `mapUnknownQuestion`, the validation immediately throws `ValidationError`, halting execution for this document before the remaining fields (like `timestamp`, which uses `requireTimestamp`) are evaluated. It is impossible to confirm if other fields are valid without the raw document data, but fixing `question` is the mandatory first step.

## Next Steps
As instructed:
- No code has been modified.
- Batch 2 has not been rerun.
- The database schema has not been altered.
- The 44 successfully migrated records have not been altered.

The investigation is complete. Without production credentials to fetch `1cMSdGgkHf1gtgkGxn3z` directly, this is the maximum possible analysis. We are awaiting operator instructions regarding whether an empty string fallback (e.g. `optionalString(data.question) || "[Missing Question]"`) is appropriate given the strict `NOT NULL` constraint.
