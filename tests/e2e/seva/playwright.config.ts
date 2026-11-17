import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { sevaE2EServerEnv } from "./server-env";

/**
 * Seva browser tests. Run through `npm run test:e2e:seva`, which starts a LOCAL Supabase stack
 * (`scripts/e2e/run-seva-e2e.mjs`) and passes its API URL and keys in the environment. There is no
 * Firebase emulator: accounts and their `public.users` / `public.staff` rows live in the local
 * Supabase stack (seeded by `global-setup.ts`), and every `/api/seva/**` call is answered by the fake
 * in `fixtures/fake-api.ts`. The site's own Playwright config (`tests/playwright.config.ts`) is
 * separate and unchanged.
 *
 * Isolation: Playwright merges `webServer.env` over `process.env`, and Next fills a variable from
 * `.env*` files only when it is not set at all (an empty string counts as set). The Supabase values
 * are taken from the environment the runner set (a local `127.0.0.1` URL); every other secret the app
 * reads is pinned to an empty string here, so a git-ignored `.env.local` with real keys can never
 * reach the dev server. `tests/unit/seva/e2e-isolation.test.ts` scans the app's code and fails if one
 * is missing.
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
    // The site's Content-Security-Policy (next.config.ts, proxy.ts) allows only `https://*.supabase.co`;
    // the browser must reach the local stack at `http://127.0.0.1:54321` instead. Test-only; the policy
    // itself is unchanged.
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
    env: sevaE2EServerEnv(),
  },
});
