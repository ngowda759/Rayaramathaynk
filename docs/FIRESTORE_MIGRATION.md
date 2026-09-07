# Firestore to Supabase Migration Guide

This document describes how to safely migrate core application data (Sevas, Daily Poojas, Events) from the existing Firebase Firestore database into the new Supabase PostgreSQL database.

## Principles
- **No application downtime**: The migration runs purely in the backend.
- **Firestore remains active**: Existing Next.js API routes and UI components will continue to read/write to Firestore.
- **Idempotent writes**: The script uses `firestore_id` to `upsert` records into Supabase. You can safely run this migration script multiple times to sync updates without duplicating rows.
- **Zero modification to Source Data**: The script performs read-only operations against Firestore.
- **Strict Validation**: Documents missing required schema fields (like titles, start dates, or correct amounts) will be explicitly rejected as Validation Failures instead of migrated with fake default data.

## Prerequisites

You must provide credentials for both systems via environment variables:

1. **Firebase Admin Credentials**
   Set these to allow the script to bypass Firestore Security Rules and read the entire database.
   ```bash
   FIREBASE_PROJECT_ID="your-project-id"
   FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com"
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKeyHere\n-----END PRIVATE KEY-----\n"
   ```

2. **Supabase Admin Credentials**
   Set these to allow the script to insert/update rows overriding Row Level Security (RLS).
   ```bash
   NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

## Running the Migration Script

### 1. Dry Run (Recommended first step)

The dry run will fetch the actual data from Firestore, map and validate the values against the Supabase schema, and perform a lookup query against Supabase to see what already exists. It will then print the counts and any errors, but it **will not perform any writes** to Supabase.

```bash
npx tsx scripts/migrate-core-to-supabase.ts --dry-run
```

### 2. Normal Migration

Once you have verified the mappings and counts in the dry-run output, execute the actual migration:

```bash
npx tsx scripts/migrate-core-to-supabase.ts
```

## Expected Output & Reconciliation

The script will produce a comprehensive report at the end of each collection run detailing exactly what was skipped and why:

```
REPORT FOR: SEVAS
Firestore documents: X
Mapped successfully: X
Validation failures: Y
Inserted: X
Updated: 0
Supabase write failures: Z
Total successful: X
✅ Reconciliation passed.
```

### Validating counts
- **Source Reconciliation**: `Firestore documents` must equal `Mapped successfully` + `Validation failures`.
- **Write Reconciliation**: `Total successful` must equal `Inserted` + `Updated`.
- **Duplicate Check**: The script assumes the `firestore_id` UNIQUE constraint in Supabase is enforced.

### Handling Failures
If individual documents fail, they will be logged under "Failures details:" along with the document ID and a type (either `[VALIDATION]` or `[WRITE]`).
- **Validation failures** mean the Firestore document was missing a required field or contained an invalid data type (e.g., missing an amount). You must fix the data in Firestore or update the schema before it can be migrated.
- **Write failures** occur when Supabase rejects the insertion (e.g., constraint error). The migration script isolates batch errors and will continue processing other documents.

## Next Steps

This migration phase **does not** cut over the application to use Supabase. Once the migration has been verified and data looks accurate, a subsequent phase will modify the repository services (`services/seva.service.ts`, etc.) to point to Supabase.