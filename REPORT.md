# Batch 2 Migration Investigation Report

## 1. Failed Document IDs in `sevas`
The batched migration failed on the `sevas` collection due to 4 document validation errors. Based on the migration logs, the 4 failing Document IDs and their details are:

| Document ID | Missing/Invalid Field | Exact Error | Mapper Field |
| ----------- | --------------------- | ----------- | ------------ |
| 4DHeHmD9L6l3L5zMIdyV | description | Missing required field: description | data.description |
| 8StLxBcPNcrfaRcWpGyY | description | Missing required field: description | data.description |
| CscrL8SF2AUcS1coYjcS | description | Missing required field: description | data.description |
| McbK0jzPSqOjsfWG13r0 | description | Missing required field: description | data.description |

## 2. Confirmation of Successful Records
We have confirmed via a direct Supabase SQL query that 9 successfully mapped records were indeed inserted into the `sevas` table in Supabase. These records correspond to 9 of the 10 daily sevas (e.g., Madhu Abhisheka, Annadana Seve, etc.) that did have valid descriptions.

## 3. Root Cause Analysis
- **Root Cause**: The failure is caused by **source data quality** coupled with strict **mapper handling**.
- The mapper script (`scripts/migrate-sevas.ts`) enforces the following validation logic:
  ```typescript
  if (typeof data.description !== "string" || !data.description) throw new Error("Missing required field: description");
  ```
- These 4 specific Firestore documents lack a valid string value for `description`.
- Since the destination PostgreSQL schema likely requires `description` to be `NOT NULL` (or the mapper explicitly strictly enforces it regardless), the migration correctly halted to avoid inserting default/fake data into a required field.
