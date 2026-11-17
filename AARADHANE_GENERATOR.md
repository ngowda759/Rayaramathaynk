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

### Step 1: Generate Panchanga Data (One-time per year)

The Panchanga data contains daily lunar calendar information needed to calculate tithi dates.

```bash
# Generate Panchanga for a specific year
python scripts/generate_panchanga.py --year 2027 --output data/panchanga/2027

# Generate Panchanga for current year
python scripts/generate_panchanga.py --year $(date +%Y) --output data/panchanga/$(date +%Y)
```

This creates 365/366 JSON files in `data/panchanga/{year}/`.

---

### Step 2: Generate Aaradhane Events

#### Option A: Preview (Dry Run - default)

```bash
# Preview events for a year without saving
npm run generate:aaradhane -- --year 2027
```

#### Option B: Apply to Supabase

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
