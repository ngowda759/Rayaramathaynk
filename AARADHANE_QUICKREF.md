# Quick Reference - Aaradhane Generator

## One-Line Commands

```bash
# 1. Generate Panchanga data (first time per year)
python scripts/panchanga.py --year YEAR --output data/panchanga/YEAR

# 2. Preview events
npm run generate:aaradhane -- --year YEAR --dry-run

# 3. Export to JSON
npm run export:aaradhane -- --year YEAR

# 4. Update Firestore (requires firebase-admin.json)
npm run generate:aaradhane -- --firestore --year YEAR
```

## Required Setup

- [ ] Python: `pip install panchang`
- [ ] Firebase: Create `firebase-admin.json` from Firebase Console

## Typical Yearly Workflow

```bash
# January - Generate for upcoming year
YEAR=$(date -d "+1 year" +%Y)

# Step 1: Generate Panchanga
python scripts/panchanga.py --year $YEAR --output data/panchanga/$YEAR

# Step 2: Generate events
npm run generate:aaradhane -- --year $YEAR --dry-run    # Preview
npm run generate:aaradhane -- --year $YEAR --firestore  # Update Firestore

# OR export and import manually
npm run export:aaradhane -- --year $YEAR
# Then: Firebase Console > Import JSON
```

## Example Years

```bash
# 2026
python scripts/panchanga.py --year 2026 --output data/panchanga/2026
npm run generate:aaradhane -- --year 2026

# 2027
python scripts/panchanga.py --year 2027 --output data/panchanga/2027
npm run generate:aaradhane -- --year 2027
```

## Output Locations

| Output | Location |
|--------|----------|
| Panchanga | `data/panchanga/{year}/` |
| Events JSON | `data/exports/aaradhane-events-{year}.json` |
| Firestore | Collection: `aaradhanes` |

## GitHub Actions

Runs automatically on **January 1st** each year.

Manual trigger: GitHub > Actions > "Generate Aaradhane Events" > Run workflow
