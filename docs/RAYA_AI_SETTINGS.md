# Raya AI Settings

## Settings Architecture
AI settings configure the behavior, thresholds, and fallback defaults for the chatbot.

### Security
All configurations are exposed via `/api/ai/settings/*`.
- **Authentication**: Endpoints strictly require admin privileges.
- **Verification**: Enforced securely on both GET and POST requests using `verifyAdminUser` (`lib/auth/admin-auth.ts`). `x-user-id` passing has been completely removed to prevent unauthorized state manipulation.

### Sections
- **General Settings**: Bot naming, language preferences.
- **Safety**: Configuration for Retrieval requirements and LLM blocking.
- **Behavior**: Confidence thresholds, debug modes.
- **Temple Data Fallbacks**: Information returned when dynamic fetching fails or requires augmentation.

### Migration Status
- **Completed**:
  - Intent Engine
  - Retrieval Registry
  - Response Composer
  - Retrieval-first safety
  - LLM-only fallback disabled
  - Typed response pipeline
  - Admin settings security

- **Migration Pending**:
  - Complete AI settings database migration to Supabase.
  - Complete Knowledge base migration to Supabase.
  - Complete AI analytics migration to Supabase.
  - Removal of all remaining legacy Firestore dependencies in AI modules.
