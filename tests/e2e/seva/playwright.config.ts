import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Seva browser tests. Run through `npm run test:e2e:seva`, which starts the Firebase Auth and Firestore emulators
 * (project `demo-seva`) around this run. The dev server gets demo Firebase settings, no Firebase Admin credentials and
 * an unreachable local Supabase address with inert keys, even when a `.env.local` exists, so nothing here can reach a
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
      // Isolation from real projects (A4P-FIX): a git-ignored .env.local may hold the owner's real keys. Playwright
      // merges this env over process.env, and Next fills a variable from .env* files only when it is not set at all
      // (an empty string counts as set), so every Supabase and Firebase-admin variable the app reads is pinned here.
      // tests/unit/seva/e2e-isolation.test.ts scans the app's code and fails if one is missing.
      // Supabase: an unreachable local address and inert keys; seva calls are answered by fixtures/fake-api.ts.
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54399",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-placeholder-anon-key",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "e2e-placeholder-publishable-key",
      SUPABASE_SERVICE_ROLE_KEY: "e2e-placeholder-service-role-key",
      SUPABASE_DB_URL: "",
      PRISMA_DATABASE_URL: "",
      // Firebase Admin: no credentials, the emulator project only.
      FIREBASE_PROJECT_ID: "demo-seva",
      FIREBASE_CLIENT_EMAIL: "",
      FIREBASE_PRIVATE_KEY: "",
      FIREBASE_SERVICE_ACCOUNT_JSON: "",
      FIREBASE_API_KEY: "",
      NEXT_PUBLIC_FIREBASE_PRIVATE_KEY: "",
      GOOGLE_APPLICATION_CREDENTIALS: "",
      // Every other secret the app reads (A4S-FIX item 6): the AI providers, the admin API key and the blob store
      // token (@vercel/blob reads it itself). Blank, so a test can never call a paid or live service.
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      GOOGLE_GENERATIVE_API_KEY: "",
      OPENROUTER_API_KEY: "",
      ADMIN_API_KEY: "",
      BLOB_READ_WRITE_TOKEN: "",
    },
  },
});
