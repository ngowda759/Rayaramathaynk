# Guru Aaradhane Event Generator - Setup Guide

This guide explains how to generate Guru Aaradhane events based on the Hindu Panchanga lunar calendar.

## Prerequisites

### 1. Install Dependencies

```bash
# Install Python dependencies for Panchanga generation
pip install panchang

# Install Node.js dependencies
npm install
```

### 2. Firebase Setup (Required for Firestore Updates)

To enable automatic Firestore updates, you need a Firebase Admin service account:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: **sri-raghavendra-mutt**
3. Go to **⚙️ Settings** > **Service accounts**
4. Click **"Generate new private key"**
5. Save the file as `firebase-admin.json` in the project root

---

## Workflow

### Step 1: Generate Panchanga Data (One-time per year)

The Panchanga data contains daily lunar calendar information needed to calculate tithi dates.

```bash
# Generate Panchanga for a specific year
python scripts/panchanga.py --year 2027 --output data/panchanga/2027

# Generate Panchanga for current year
python scripts/panchanga.py --year $(date +%Y) --output data/panchanga/$(date +%Y)
```

This creates 365/366 JSON files in `data/panchanga/{year}/`.

---

### Step 2: Generate Aaradhane Events

#### Option A: Preview (Dry Run)

```bash
# Preview events for a year without saving
npm run generate:aaradhane -- --year 2027 --dry-run
```

#### Option B: Export to JSON

```bash
# Export events to JSON file for manual import
npm run export:aaradhane -- --year 2027
```

Output: `data/exports/aaradhane-events-2027.json`

#### Option C: Update Firestore Directly

```bash
# Requires firebase-admin.json
npm run generate:aaradhane -- --year 2027 --firestore
```

---

### Step 3: Import to Firestore (If using Option B)

#### Via Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: **sri-raghavendra-mutt**
3. Go to **Firestore Database** > **Data** tab
4. Click **"Start collection"**
5. Enter collection ID: `aaradhanes`
6. For each event, click **"Add document"** and paste fields from the JSON

#### Via Firebase CLI:

```bash
# Install Firebase CLI (one-time)
npm install -g firebase-tools

# Login
firebase login

# Import events
firebase firestore:import data/exports/aaradhane-events-2027.json --project sri-raghavendra-mutt
```

---

## Automatic Yearly Generation (GitHub Actions)

The project includes a GitHub Actions workflow that automatically generates events every January.

### Setup:

1. Add the following secrets to your GitHub repository:
   - `FIREBASE_PROJECT_ID`: `sri-raghavendra-mutt`
   - `FIREBASE_CLIENT_EMAIL`: (from service account JSON)
   - `FIREBASE_PRIVATE_KEY`: (from service account JSON - encode newlines as `\n`)

2. The workflow runs automatically on January 1st each year

### Manual Trigger:

```bash
# Go to GitHub Actions tab and run "Generate Aaradhane Events" workflow
```

---

## Command Reference

### Panchanga Generation

```bash
# Single date (today)
python scripts/panchanga.py

# Pretty print
python scripts/panchanga.py --pretty

# Full year
python scripts/panchanga.py --year 2027 --output data/panchanga/2027
```

### Event Generation

```bash
# Generate for current year + 1 (default)
npm run generate:aaradhane

# Generate for specific year
npm run generate:aaradhane -- --year 2027

# Dry run (preview only)
npm run generate:aaradhane -- --dry-run
npm run generate:aaradhane -- --year 2027 --dry-run

# Export to JSON
npm run export:aaradhane -- --year 2027

# Update Firestore (requires firebase-admin.json)
npm run generate:aaradhane -- --firestore
npm run generate:aaradhane -- --firestore --year 2027
```

### Seed Guru Parampara Data

```bash
# Seed the lunar calendar configuration to Firestore
npm run seed:guru-parampara
```

---

## File Structure

```
data/
├── panchanga/
│   └── {year}/
│       ├── 2026-01-01.json
│       ├── 2026-01-02.json
│       └── ...
├── aaradhane/
│   └── gurus.ts          # Master data with tithi information
└── exports/
    ├── aaradhane-events-2026.json
    └── aaradhane-events-2027.json
```

---

## Troubleshooting

### "ModuleNotFoundError: No module named 'panchang'"

```bash
pip install panchang
```

### "Firestore data not found"

Run the seed script first:
```bash
npm run seed:guru-parampara
```

### "Cannot find module '@/lib/firebase'"

Use `tsx` instead of `ts-node`:
```bash
npx tsx scripts/generate-aaradhane.ts --year 2027
```

### Permission denied errors

1. Check `firebase-admin.json` exists
2. Verify the service account has Firestore permissions
3. Ensure Firestore rules allow writes

---

## FAQ

### Q: How are the dates calculated?

A: Dates are calculated by matching the lunar calendar data (masa, paksha, tithi) from the Panchanga with each guru's stored tithi information.

### Q: What happens to existing events?

A: The system is idempotent - running multiple times won't create duplicates. Events with the same `eventKey` (e.g., `madhvacharya-2026`) will be updated.

### Q: Can I generate events for past years?

A: Yes, but the Panchanga data must exist for that year:
```bash
python scripts/panchanga.py --year 2025 --output data/panchanga/2025
npm run generate:aaradhane -- --year 2025
```

### Q: What about Sri Raghavendra Swamy?

A: Sri Raghavendra Swamy generates 3 separate events:
- Poorva Aaradhane
- Madhya Aaradhane  
- Uttara Aaradhane

### Q: Manual vs Auto-generated events?

A: Only events with `autoGenerated: true` will be updated. Manual events remain untouched.

---

## Support

For issues or questions, check:
1. Firestore security rules in `firestore.rules`
2. GitHub Actions logs for automation failures
3. Console errors during generation
