npm run start > app.log 2>&1 &
sleep 10
npx playwright test tests/e2e/user-journeys/user-journeys.spec.ts
kill %1
