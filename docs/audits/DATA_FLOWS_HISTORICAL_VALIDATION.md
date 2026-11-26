# Panchanga and Aaradhane Historical Validation

**Date:** 2026-11-26
**Command:** `npx tsx scripts/migrate-data-flows-to-storage.ts --report /tmp/historical-validation.json`
**Mode:** dry run (no Storage object was written)

## Panchanga

| Year | Files | Valid | Invalid | Range | Missing days |
|------|-------|-------|---------|-------|--------------|
| 2026 | 365 | 365 | 0 | 2026-01-01 .. 2026-12-31 | 0 |
| 2027 | 365 | 365 | 0 | 2027-01-01 .. 2027-12-31 | 0 |

The 730 source files predate two metadata fields, which the validator fills in
without changing anything astronomical:

- `metadata.valid_for` = the record date
- `metadata.timezone` = `Asia/Kolkata`

`metadata.generated_at` is a naive local timestamp in the historical files; the
schema accepts that marker without an offset. All astronomical timestamps
(`sunrise`, `tithi.start`, `rahu_kalam.start`, ...) retain their `+05:30` offset.

## Aaradhane

| Year | Generated events | Legacy export count | Valid |
|------|------------------|---------------------|-------|
| 2026 | 19 | 11 | yes |
| 2027 | 19 | 11 | yes |

The legacy `data/exports/aaradhane-events-YYYY.json` files are incomplete
(11 events, legacy field names). The regenerated datasets contain the full Guru
Parampara set and the complete event schema, including the three Sri Raghavendra
Swamy phases.

## Totals

- Years: 2
- Panchanga records: 730 (730 valid, 0 invalid)
- Aaradhane years: 2
- Aaradhane events: 38

## Notes

- After preflight, the 2026 file count (`365`) differs from the earlier
  `ls data/panchanga/*` output (`733`) because that count included directory
  entries and non-record files. The validator scans only `*.json` files whose
  filename is a valid date in the matching year.
- No upload was performed. Import still requires owner approval plus
  `--publish --confirm-production` and
  `DATA_FLOWS_HISTORICAL_UPLOAD_APPROVED=true`.
