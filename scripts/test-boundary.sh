#!/bin/bash

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

npx next build > build-test-output.log 2>&1

if grep -q "This module cannot be imported from a Client Component module" build-test-output.log || grep -q "server-only" build-test-output.log; then
    echo "SUCCESS: Build successfully blocked client component from importing server-only module."
    rm -rf app/test-boundary-client build-test-output.log
else
    echo "FAILURE: Build did not block client component appropriately, or error message wasn't found."
    cat build-test-output.log
    rm -rf app/test-boundary-client build-test-output.log
fi
