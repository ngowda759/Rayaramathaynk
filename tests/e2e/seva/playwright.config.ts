import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Seva browser tests. Run through `npm run test:e2e:seva`, which starts the Firebase Auth and Firestore emulators
 * (project `demo-seva`) around this run. The dev server gets demo Firebase settings only, so nothing here can reach a
 * live project; every `/api/seva/**` call is answered by the fake in `fixtures/fake-api.ts`.
 * The site's own Playwright config (`tests/playwright.config.ts`) is separate and unchanged.
 */
const PORT = 3100;
// localhost, not 127.0.0.1: Next 16 dev blocks its dev resources for other origins unless allowedDevOrigins lists them.
const BASE_URL = `http://localhost:${PORT}`;
const REPO_ROOT = path.resolve(__dirname, "../../..");

export default defineConfig({
  testDir: ".",
  globalSetup: "./global-setup.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  outputDir: "./test-results",
  use: {
    baseURL: BASE_URL,
    // The site's Content-Security-Policy (next.config.ts, proxy.ts) allows only the live Firebase hosts; the browser
    // must reach the local emulators at 127.0.0.1:9099 and :8080 instead. Test-only; the policy itself is unchanged.
    bypassCSP: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 90_000,
    actionTimeout: 30_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "phone",
      testMatch: /(prasadam|dashboard).*\.spec\.ts/,
      use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    cwd: REPO_ROOT,
    port: PORT,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_FIREBASE_EMULATORS: "1",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-seva",
      NEXT_PUBLIC_FIREBASE_API_KEY: "demo-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-seva.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-seva.appspot.com",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:demoseva",
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-DEMOSEVA",
      // Server-side Admin SDK calls, if any, go to the same emulators.
      GCLOUD_PROJECT: "demo-seva",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    },
  },
});
