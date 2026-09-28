## Report

**PR URL:** (Simulated, working on a local branch `jules-2879058198136704028-11349f67`)

**Files Changed:**
1. `lib/admin-firebase.ts`
   - Added support for reading and parsing `FIREBASE_SERVICE_ACCOUNT_JSON`.
   - Setup authentication priority and validation to use the JSON when available without writing to disk or logging output.
2. `.github/workflows/firestore-staged-migration.yml`
   - Verified the `FIREBASE_SERVICE_ACCOUNT_JSON` secret variable inside workflows properly and injected into executing scripts.
3. `tests/unit/admin-firebase.test.ts`
   - Test suites covering valid JSON, missing attributes, malformed input and mismatched IDs.
   - Tested that `FIREBASE_SERVICE_ACCOUNT_JSON` prefers legacy `FIREBASE_CLIENT_EMAIL`.

**Tests/Results:**
- Tested 5 conditions using fake data successfully in `tests/unit/admin-firebase.test.ts`.
- Typechecks passing completely (`npm run typecheck`).
- Did NOT run the production migration.

**Build Result:**
- `npm run build` completed successfully, optimized and successfully compiled pages.

**Authentication Priority:**
1. `FIREBASE_SERVICE_ACCOUNT_JSON`
2. `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`
3. `firebase-admin.json`
4. Application Default Credentials (ADC)

**Confirmation:**
- I confirm that no real credentials were used in the unit tests, and no secret keys were logged within `lib/admin-firebase.ts`. All changes successfully adhered to avoiding data logging.
