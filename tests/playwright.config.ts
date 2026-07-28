import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration - Sprint 5
 * 
 * Optimized for parallel execution and CI/CD integration
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  // Parallel execution settings
  fullyParallel: true,
  workers: process.env.CI ? parseInt(process.env.PW_WORKERS || '2') : undefined,
  
  // Test retries
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'reports/html' }],
    ['json', { outputFile: 'reports/playwright-test-results.json' }],
    ['junit', { outputFile: 'reports/test-results.xml' }],
    ['list'],
  ],
  
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    actionTimeout: 15000,
    navigationTimeout: 30000,
    
    // Launch options for stability
    launchOptions: {
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    },
  },
  
  // Project configuration
  projects: [
    // Desktop browsers - critical path tests
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [
        '**/home/**/*.spec.ts',
        '**/events/**/*.spec.ts',
        '**/gallery/**/*.spec.ts',
        '**/auth/**/*.spec.ts',
        '**/sprint3/authenticated.spec.ts',
      ],
    },
    
    // Firefox for compatibility
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: ['**/home/**/*.spec.ts'],
    },
    
    // Webkit for Safari compatibility
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: ['**/home/**/*.spec.ts'],
    },
    
    // Mobile tests
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: [
        '**/sprint4/mobile-specific.spec.ts',
        '**/sprint5/accessibility.spec.ts',
      ],
    },
    
    // Mobile Safari
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      testMatch: ['**/sprint4/mobile-specific.spec.ts'],
    },
  ],
  
  // Timeouts
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  
  // Global setup/teardown
  globalSetup: undefined,
  globalTeardown: undefined,
  
  // Sharding configuration (used via CLI)
  // shardedWorkers: parseInt(process.env.PW_SHARD || '1'),
  // totalShards: parseInt(process.env.PW_TOTAL_SHARDS || '1'),
});

/*
 * Test Sharding Usage:
 * 
 * To run tests in parallel across multiple machines or workers:
 * 
 * # Split tests into 4 shards
 * npx playwright test --shard=1/4
 * npx playwright test --shard=2/4
 * npx playwright test --shard=3/4
 * npx playwright test --shard=4/4
 * 
 * # CI/CD Example (GitHub Actions)
 * jobs:
 *   test:
 *     strategy:
 *       matrix:
 *         shard: [1, 2, 3, 4]
 *     steps:
 *       - run: npx playwright test --shard=${{ matrix.shard }}/4
 * 
 * Environment Variables:
 * - BASE_URL: Application URL
 * - PW_WORKERS: Number of parallel workers
 * - PW_SHARD: Current shard number
 * - PW_TOTAL_SHARDS: Total number of shards
 */
