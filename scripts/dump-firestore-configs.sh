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

# --- 1. Auth check -----------------------------------------------------
if ! command -v firebase >/dev/null 2>&1; then
  echo "❌ Firebase CLI not found. Install it first:"
  echo "   npm install -g firebase-tools"
  exit 1
fi

if [ -n "${FIREBASE_TOKEN:-}" ]; then
  echo "Using FIREBASE_TOKEN for authentication."
  AUTH=(--token "$FIREBASE_TOKEN")
elif firebase projects:list >/dev/null 2>&1; then
  echo "Using existing 'firebase login' session."
  AUTH=()
else
  echo "❌ No Firebase authentication found."
  echo
  echo "   Run:  firebase login"
  echo "   ...or set FIREBASE_TOKEN (CI/service-account:)"
  echo "     export FIREBASE_TOKEN=..."
  exit 1
fi

# --- 2. Collection list (ALL non-auth collections in the codebase( ------
# Auth-related collections (users, profiles, bookmarks, sessions( are excluded;
# Firebase Auth user records live in Auth, not Firestore, so they are not dumped.
COLLECTIONS=(
  # Content & public info
  aaradhane aaradhanes announcements events gallery galleryAlbums galleryMedia
  homepage timings sevas testimonials temple_areas dailyPoojas poojas panchanga quotes
  # Settings & config (the "configs")
  settings futurePlans trustCommittee trust knowledge knowledge_articles knowledge_categories
  # Seva booking / donations / billing
  sevaBookings donations donationCampaigns bills receiptSevas receipts system
  # Volunteers & members
  volunteers volunteer_requests members
  # AI & chat (incl. ephemeral logging collections(
  ai_settings ai_token_usage ai_latency_records ai_intent_distribution unknown_questions
  chat_sessions messages chatTraining chat_metrics intent_metrics intent_feedback
  page_views daily_page_stats feedback notifications
)

echo "=== Exporting $((${#COLLECTIONS[@]})) collections to $EXPORT_DIR ==="
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"

# --collection-ids only exports top-level collections (all of ours are top-level(
COLLECTION_IDS="$(IFS=,; echo "${COLLECTIONS[*]}")"
firebase "${AUTH[@]+"${AUTH[@]}"}" firestore:export \
  --project "$PROJECT" \
  --collection-ids "$COLLECTION_IDS" \
  --output "$EXPORT_DIR"

echo
echo "=== Converting to review-friendly JSON in $DUMP_DIR ==="
mkdir -p "$DUMP_DIR"
npm run --silent firestore:convert -- --project "$PROJECT"

echo
echo "✅ Done."
echo "  Raw export:      $EXPORT_DIR"
echo "  Review JSON:     $DUMP_DIR/<collection>.json"
echo "  Inventory:        $DUMP_DIR/MANIFEST.json"