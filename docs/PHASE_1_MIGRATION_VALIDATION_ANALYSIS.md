# Phase 1 Migration Validation Analysis

## 1. Problem Summary
The staged Phase 1 dry-run reached the LIVE production Firestore successfully, but halted due to validation failures. Specifically, out of 10 settings documents, 2 failed validation. Out of 36 event documents, 34 failed validation. No writes were executed in the Supabase database. The objective is to evaluate why these failures occurred without modifying any migration logic or inventing default values.

## 2. Exact Dry-Run Observations
- **Live Settings Documents:** 10
- **Live Event Documents:** 36
- **Existing Supabase Events:** 38 (seed/test data, ignored for this mapping comparison)
- **Dry-Run Writes:** 0
- **Settings Validation Failures:** 2 (`aboutUs`, `footer`)
- **Event Validation Failures:** 34

## 3. Root Causes

### 3.1. Settings Mapper Issue (`isSiteSettingsDoc`)
- **Observation:** Validation errors indicated `Missing required field: contactEmail` on `aboutUs` and `footer`.
- **Root Cause:** The `isSiteSettingsDoc` function uses `.some(["templeName", "contactEmail"])`. Because it checks if *any* of the two properties exist, it is falsely identifying standard settings documents (like `footer` which might have a `contactEmail` or `templeName` mention) as the primary "site settings" document. Once identified as the main site settings document, the mapper strictly requires **both** `contactEmail` and `templeName` to be present and non-empty.
- **Inferred Issue vs Fact:**
  - *Fact*: The mapper uses `.some()`.
  - *Fact*: `aboutUs` and `footer` fail validation because they are treated as site settings but lack `contactEmail`.
  - *Inferred Issue*: The `.some()` method is too loose for identification, capturing documents it shouldn't.

### 3.2. Events Mapper Issue (`mapEvent`)
- **Observation:** Validation errors indicated `many documents missing required fields: status, location, description`.
- **Root Cause:** The `mapEvent` function maps Firestore data using `requireString(data.location, "location")`, `requireString(data.description, "description")`, and `requireString(data.status, "status")`. This enforces a strict requirement that these fields exist in Firestore and are non-empty strings.
- **Inferred Issue vs Fact:**
  - *Fact*: Firestore event documents frequently lack `status`, `location`, and `description` (34 out of 36).
  - *Fact*: The mapper enforces their presence.
  - *Fact*: The Supabase target schema strictly defines these fields as `NOT NULL`.
  - *Inferred Issue*: This is a genuine schema mismatch where the legacy system did not guarantee these fields, but the new strict relational schema does.

## 4. Firestore → Mapper → Supabase Schema Comparison

### Settings
| Firestore Field | Mapper Expectation | Supabase Postgres Field |
| --- | --- | --- |
| `templeName` | `typeof data.templeName === "string" && !empty` | `temple_name` |
| `contactEmail` | `typeof data.contactEmail === "string" && !empty` | `contact_email` |

### Events
| Firestore Field | Mapper Expectation | Supabase Postgres Field |
| --- | --- | --- |
| `location` | `requireString(data.location, "location")` | `location` (`NOT NULL`) |
| `status` | `requireString(data.status, "status")` | `status` (`NOT NULL`) |
| `description` | `requireString(data.description, "description")` | `description` (`NOT NULL`) |

## 5. Fields For Which No Safe Value Can Be Derived
Because we do not want to invent defaults or fabricate missing data:
- `events.status`
- `events.location`
- `events.description`

## 6. Recommended Minimal Safe Fix

1. **Settings Mapper (`isSiteSettingsDoc`)**:
   - Update `isSiteSettingsDoc` to rely on `.every(["templeName", "contactEmail"])` to positively confirm it is the site settings document, or explicitly check for a known document ID (e.g., `id === 'website-settings'`). This ensures documents like `aboutUs` route to the lossless JSONB table `settings_documents`.
2. **Events Schema & Mapper (`mapEvent`)**:
   - Because no safe default can be invented for `location`, `status`, and `description`, the strictness of the Postgres schema must be downgraded for these fields.
   - Alter the Supabase `events` table to drop the `NOT NULL` constraints on `location`, `status`, and `description`.
   - Change `mapEvent` to use `optionalString(data.location)`, `optionalString(data.status)`, and `optionalString(data.description)`.

## 7. Migration Status
- **Production Migration:** NOT RUN.
- **Source-Code Modifications:** None. This branch only contains this analysis report. No application code or migration scripts were modified.
