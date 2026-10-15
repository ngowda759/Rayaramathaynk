#!/bin/bash
set -e

# Ensure robust cleanup regardless of how script terminates
cleanup() {
    rm -rf app/test-boundary-client build-test-output.log
}
trap cleanup EXIT

echo "Setting up boundary test..."
mkdir -p app/test-boundary-client
cat << 'APP_EOF' > app/test-boundary-client/page.tsx
"use client";
import { createAdminClient } from "@/lib/supabase/admin";

export default function Page() {
  console.log(createAdminClient);
  return <div>Test</div>;
}
APP_EOF

echo "Running Next.js build (expecting failure due to server-only)..."

set +e
npx next build > build-test-output.log 2>&1
BUILD_EXIT_CODE=$?
set -e

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo "FAILURE: Build succeeded but it should have failed due to server-only boundary violation."
    exit 1
fi

if grep -q "This module cannot be imported from a Client Component module" build-test-output.log || grep -q "server-only" build-test-output.log; then
    echo "SUCCESS: Build successfully blocked client component from importing server-only module."
else
    echo "FAILURE: Build failed, but the error message for server-only was not found. Unexpected error occurred."
    cat build-test-output.log
    exit 1
fi
