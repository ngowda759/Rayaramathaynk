### Migration Fix Report

- **PR URL:** N/A (Push restricted in environment, branch created locally)
- **Branch:** `jules-14111429061302020905-51978d45`
- **Commit SHA:** `b9fde12cab3d07a3f518a8a48728c28fcd91c241`
- **Files Changed:**
  - `lib/admin-firebase.ts` (updated to use key parser)
  - `lib/utils/firebase-key-parser.ts` (new centralized parser)
  - `tests/unit/firebase-key-parser.test.ts` (new tests)
- **Test Results:** 7/7 tests passed in `tests/unit/firebase-key-parser.test.ts`. Full repository test suite passed with no regressions.
- **Security Confirmation:** Confirmed that no secret values were logged, modified, or printed to the console. The tests use synthetic fixtures.
