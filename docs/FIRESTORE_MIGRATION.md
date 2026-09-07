# Firestore to Supabase Migration Guide

This document describes how to safely migrate core application data (Sevas, Daily Poojas, Events) from the existing Firebase Firestore database into the new Supabase PostgreSQL database.

## Principles
- **No application downtime**: The migration runs purely in the backend.
- **Firestore remains active**: Existing Next.js API routes and UI components will continue to read/write to Firestore.
- **Idempotent writes**: The script uses `firestore_id` to `upsert` records into Supabase. You can safely run this migration script multiple times to sync updates without duplicating rows.
- **Zero modification to Source Data**: The script performs read-only operations against Firestore.

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

The dry run will fetch the actual data from Firestore, validate the mappings against the Supabase schema, print the counts and any errors, but it **will not perform any writes** to Supabase.

```bash
npx tsx scripts/migrate-core-to-supabase.ts --dry-run
```

### 2. Normal Migration

Once you have verified the mappings and counts in the dry-run output, execute the actual migration:

```bash
npx tsx scripts/migrate-core-to-supabase.ts
```

## Expected Output & Reconciliation

The script will produce a report at the end of each collection run:

```
REPORT FOR: SEVAS
Firestore documents: 15
Successfully migrated/updated: 15
Failed: 0
```

### Validating counts
You can verify the totals matching the Firestore dashboard counts with the Supabase dashboard counts. Alternatively, query the Supabase database:
```sql
SELECT count(*) FROM sevas;
SELECT count(*) FROM daily_poojas;
SELECT count(*) FROM events;
```

### Handling Failures
If individual documents fail (e.g., due to schema mismatches, type errors, or constraints), they will be logged under "Failures details:" along with the document ID.
The migration script will continue processing other documents. You can inspect the skipped Firestore document, fix the data in Firestore (if invalid) or adjust the script, and then re-run the script safely.

## Next Steps

This migration phase **does not** cut over the application to use Supabase. Once the migration has been verified and data looks accurate, a subsequent phase will modify the repository services (`services/seva.service.ts`, etc.) to point to Supabase.