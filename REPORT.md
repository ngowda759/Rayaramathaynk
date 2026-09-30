# Batch 2 Migration Investigation Report

## 1. Failed Document IDs in `sevas`
The batched migration failed on the `sevas` collection due to 4 document validation errors. Based on the migration logs, the 4 failing Document IDs and their details are:

| Document ID | Missing/Invalid Field | Exact Error | Mapper Field |
| ----------- | --------------------- | ----------- | ------------ |
| 4DHeHmD9L6l3L5zMIdyV | description | Missing required field: description | data.description |
| 8StLxBcPNcrfaRcWpGyY | description | Missing required field: description | data.description |
| CscrL8SF2AUcS1coYjcS | description | Missing required field: description | data.description |
| McbK0jzPSqOjsfWG13r0 | description | Missing required field: description | data.description |

## 2. Validation Logic Evidence
The batched migration utilizes `mapSeva` mapped in `scripts/migrate-all-batched.ts` -> `lib/supabase/migration-mappers.ts`.
The `mapSeva` function does the following:
```typescript
export function mapSeva(id: string, data: any): Record<string, any> {
  const row: Record<string, any> = {
    firestore_id: id,
    name: requireString(data.name, "name"),
    description: requireString(data.description, "description"),
```

Where `requireString` is:
```typescript
function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`Missing required field: ${field}`);
  }
  return value;
}
```
This is the exact validation logic rejecting the records, not allowing empty or non-string descriptions.

## 3. Destination Schema Evidence
Checking `supabase/migrations/20260908120000_create_sevas_table.sql`:
```sql
        CREATE TABLE sevas (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            firestore_id text UNIQUE,
            name text NOT NULL,
            description text NOT NULL,
```
The exact nullability constraint for `sevas.description` is `NOT NULL`.

## 4. Confirmation of Successful Records
We have confirmed via a direct Supabase SQL query that 9 successfully mapped records were indeed inserted into the `sevas` table in Supabase.
`SELECT count(*) FROM sevas WHERE firestore_id NOT LIKE 'seed_aradhana_seva_%';` returns `9`.

## 5. Root Cause Analysis
The failure is caused by **source data quality** conflicting with **strict mapper handling**.
The 4 records in Firestore lack a valid, non-empty description. Since the `description` column in Supabase is defined as `NOT NULL`, the mapper function correctly enforces this constraint using `requireString(data.description, "description")`, which blocks documents where `description` is missing or is an empty string.

## 6. Other Fields
No other fields in these four documents are invalid, as the migration dry-run and logs halt at the first validation error per document, which is `description`.

## 7. Recommended Minimal Safe Fix
To safely allow these legacy records to migrate without changing the DB schema or inventing semantic data:
Change the `mapSeva` mapper to handle missing descriptions by falling back to an empty string `""` (since Postgres `text NOT NULL` allows empty strings, just not `NULL`). Because `requireString` rejects empty strings via `.trim()`, we should use `optionalString(data.description) ?? ""` or bypass `requireString`.
