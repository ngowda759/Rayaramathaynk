# BOT-001: AI Settings Reconciliation

## Overview
This document records the mapping from the legacy Firestore `ai_settings/main` structure to the new structured PostgreSQL configuration in Supabase.

## Field Reconciliation

| Firestore Setting | Retained / Replaced / Obsolete | Supabase Destination | Reason |
| :--- | :--- | :--- | :--- |
| `general` | Retained | `ai_settings.general` | Essential core config (enabled, name, language). |
| `safety` | Retained | `ai_settings.safety` | Critical for safe AI operations (refusals, out-of-scope). |
| `extendedBehavior` | Retained | `ai_settings.extended_behavior` | Core AI retrieval/pipeline tuning config. |
| `templeInformation` | Retained | `ai_settings.temple_information` | Validated contact details and timings for responses. |
| `visitorInformation` | Retained | `ai_settings.visitor_information` | Validated guidelines and facilities for visitors. |
| `templePolicies` | Retained | `ai_settings.temple_policies` | Important operational policies (donations, sevas). |
| `aiResponses` | Retained | `ai_settings.ai_responses` | Static greeting/fallback strings. |
| `aiBehavior` | Retained | `ai_settings.ai_behavior` | Legacy config block still referenced by type definitions. Maps closely to `extendedBehavior`. |
| `prompt` | Retained | `ai_settings.prompt` | Essential prompt versioning and content. |
| `intents` | Retained | `ai_settings.intents` | Essential intent/classification routing configurations. |

## Post-Migration Validation Notes
- No fields from `types/ai-settings.ts` were marked as strictly obsolete during this phase, as all properties actively correspond to typed properties within the admin interface and application runtime.
- All data has been strongly mapped to `jsonb` columns on the `ai_settings` table where the top-level row represents the configuration.
- Zod validation (`AISettingsSchema`) has been introduced to the `repository.ts` reads to guarantee that the `jsonb` shape from PostgreSQL matches the expected runtime interface (`AISettings`), effectively acting as a schema enforcer over the unstructured columns.
- RLS Policy allows `public` to `SELECT` (read) the `ai_settings` table, since these settings are needed by the unauthenticated chatbot widget for proper operation. Writing is correctly restricted.
- The `test_plan.sh` is active and intact.
