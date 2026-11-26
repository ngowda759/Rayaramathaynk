# Quick Reference - Aaradhane Generator

## One-Line Commands

```bash
# 1. Check the Storage Panchanga source for a year
npx ts-node --project tsconfig.scripts.json scripts/generate-aaradhane.ts --year YEAR --check

# 2. Preview events
npm run generate:aaradhane -- --year YEAR --dry-run

# 3. Publish the generated dataset to Supabase Storage
npx ts-node --project tsconfig.scripts.json scripts/generate-aaradhane.ts --year YEAR --publish

# 4. Export to JSON (legacy local export)
npm run export:aaradhane -- --year YEAR
```

## Required Setup

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (write) or a read key for previews
- [ ] The yearly Panchanga object at `Data_flows/Panchanga/years/YEAR.json`

## Typical Yearly Workflow

```bash
# January - Generate for upcoming year
YEAR=$(date -d "+1 year" +%Y)

# Step 1: Confirm the Storage Panchanga source
npx ts-node --project tsconfig.scripts.json scripts/generate-aaradhane.ts --year $YEAR --check

# Step 2: Preview, then publish to Storage
npm run generate:aaradhane -- --year $YEAR --dry-run
npx ts-node --project tsconfig.scripts.json scripts/generate-aaradhane.ts --year $YEAR --publish

# Optional: export a local JSON copy for review
npm run export:aaradhane -- --year $YEAR
```

## Example Years

```bash
# 2026
npm run generate:aaradhane -- --year 2026 --dry-run

# 2027
npm run generate:aaradhane -- --year 2027 --dry-run
```

## Output Locations

| Output | Location |
|--------|----------|
| Panchanga source | `Data_flows/Panchanga/years/{year}.json` |
| Aaradhane dataset | `Data_flows/Aaradhane/years/{year}.json` |
| Current dataset | `Data_flows/Aaradhane/current.json` (only advanced by an explicit request) |
| Snapshots | `Data_flows/Aaradhane/snapshots/{year}/` |
| Legacy export | `data/exports/aaradhane-events-{year}.json` |

## GitHub Actions

Runs automatically on **January 1st** each year.

Manual trigger: GitHub > Actions > "Generate Aaradhane Events" > Run workflow
