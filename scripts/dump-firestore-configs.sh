#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Firestore Config Dump (Firebase CLI only — no Admin SDK, no REST API(
# Dumps every non-auth collection to data/firestore-export/ (Firestore
# export format(,then converts to review-friendly JSON in data/firestore-dump/.
# =============================================================================

PROJECT="${FIREBASE_PROJECT_ID:-sri-raghavendra-mutt}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPORT_DIR="$ROOT/data/firestore-export"
DUMP_DIR="$ROOT/data/firestore-dump"

cd "$ROOT"

echo "=== Firestore Config Dump ==="
echo "Project: $PROJECT"
echo

# firebase-tools v15 removed firestore:export; the canonical dump path is the
# live REST dumper (scripts/dump-firestore-live.ts( — auth-owned collections
# (users, profiles, bookmarks, sessions( are excluded there and migrate via
# Supabase Auth. This wrapper therefore proxies it for legacy compat.
exec npm run --silent firestore:dump