# Firestore Rate Limit Diagnostic

## A. Does listCollectionIds return 429?
Yes. The `listCollectionIds` endpoint returns HTTP 429 (Resource Exhausted).

## B. Does direct /events?pageSize=1 return 429?
No. The direct endpoint `/events?pageSize=1` returns HTTP 200 (OK).

## C. Is the problem specific to listCollectionIds or affecting normal document reads as well?
The rate limiting is specifically targeting the `listCollectionIds` endpoint, likely due to excessive polling or scanning, while targeted direct document reads are still permitted within quota limits.

## D. Recommended Next Step
Because the direct `/events?pageSize=1` endpoint succeeded while `listCollectionIds` failed, we should NOT modify the exporter to retry or adjust rate-limits yet.
The next technical step is to bypass the dynamic `listCollectionIds` discovery mechanism and use the hardcoded/known Firestore collection inventory established in `FIREBASE_MIGRATION_PHASE1_AUDIT.md` to directly target collections.
