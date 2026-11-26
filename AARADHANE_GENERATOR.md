# Guru Aaradhane Event Generator - Setup Guide

This guide explains how to generate Guru Aaradhane events based on the Hindu Panchanga lunar calendar.

The generator persists events to **Supabase** (the `events` table, keyed by `firestore_id`). It has no
Firestore dependency and no Firestore fallback: if Supabase is unavailable the run stops.

## Prerequisites

### 1. Install Dependencies

```bash
# Install Python dependencies for Panchanga generation
pip install panchang

# Install Node.js dependencies
npm install
```

### 2. Supabase Setup

The generator reads the standard Supabase environment variables (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Both must be present for an `--apply` run.

---

## Workflow

### Step 1: Ensure the Panchanga year is in Supabase Storage

The generator reads `Data_flows/Panchanga/years/YYYY.json` from Storage; it no
longer reads a local `data/panchanga/YYYY/` directory.

```bash
# Validate and optionally import the historical local files (dry run by default)
npx tsx scripts/migrate-data-flows-to-storage.ts --report /tmp/historical.json

# Owner-approved import only:
# npx tsx scripts/migrate-data-flows-to-storage.ts \
#   --publish --confirm-production
```

The scheduled Panchanga workflow keeps `years/YYYY.json` current. If a year is
missing, the generator exits with a clear error instead of falling back to disk.

---

### Step 2: Generate Aaradhane Events

#### Option A: Preview (Dry Run - default)

```bash
# Preview events for a year without saving
npm run generate:aaradhane -- --year 2027
```

#### Option B: Publish the generated dataset to Storage

```bash
# Generates from the Storage Panchanga source and writes
# Data_flows/Aaradhane/years/YYYY.json plus current.json
npx ts-node --project tsconfig.scripts.json scripts/generate-aaradhane.ts --year 2027 --publish
```

#### Option C: Apply to the Supabase events table (legacy)

```bash
# Upsert the planned events into the Supabase `events` table
npm run generate:aaradhane -- --year 2027 --apply
```

If Supabase is unreachable or the environment variables are missing, the run fails; no Firestore
fallback is attempted.

---

## Automatic Yearly Generation (GitHub Actions)

The project includes a GitHub Actions workflow (`.github/workflows/aaradhane.yml`) that runs the
generator and writes to Supabase. It uses the repository's Supabase secrets and a project-URL guard
before any write.

### Manual Trigger:

```bash
# Go to the GitHub Actions tab and run the "Generate Aaradhane Events" workflow
```
