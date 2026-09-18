# Task Blocked: Missing Credentials for Data Migration

The task required migrating tables and data from Firestore to Supabase.
However, live database credentials are required to extract data from the Firestore database and load it into Supabase PostgreSQL.

As per the memory guidelines:
> "During data migration tasks, if live database credentials (e.g., `firebase-admin.json` or Supabase environment variables) are missing, strictly abort the process and report the task as BLOCKED rather than fabricating successful results."

Since neither `firebase-admin.json` is present nor `process.env.FIREBASE_PRIVATE_KEY` / `process.env.SUPABASE_SERVICE_ROLE_KEY` are provided in the environment, the data migration script (`scripts/migrate-content-to-supabase.ts`) could not connect to the databases.

The task is reported as BLOCKED.
