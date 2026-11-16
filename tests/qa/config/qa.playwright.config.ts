import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * QA Playwright configuration extending the root config.
 * Uses QA_BASE_URL env var (defaults to localhost:3000) and includes custom fixtures.
 */
const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const REPO_ROOT = path.resolve(__dirname, '../../..');

export default defineConfig({
  testDir: './',
  // Inherit reporters from root config for consistency
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/qa/playwright-results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    // Enable console and network capture via fixtures
    // Custom fixtures are added in ./fixtures folder
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  timeout: 60000,
  expect: { timeout: 10000 },
});
