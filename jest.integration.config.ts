import type { Config } from "jest";

/**
 * Real-PostgreSQL integration tests (tests/db/integration/**): apply the F-A16
 * migrations against a DISPOSABLE PostgreSQL/Supabase database over the wire with
 * `pg`. Run with `npm run test:db:integration`.
 *
 * These are deliberately separate from `jest.db.config.ts` (PGlite, in-process). PGlite
 * runs as a superuser and cannot reproduce the Supabase role/privilege path, so it cannot
 * prove the event-trigger or `ALTER DEFAULT PRIVILEGES FOR ROLE` behaviour. These tests
 * require an explicitly-named disposable database URL and refuse to run against anything
 * that cannot be positively identified as an isolated test environment (see
 * tests/db/integration/f-a16.integration.test.ts). If the URL is absent they skip.
 *
 * `pg` is CommonJS, so this config does NOT need the ESM/`--experimental-vm-modules` dance
 * the PGlite suite needs.
 */
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/tests/db/integration/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: {
        module: "commonjs",
        target: "es2022",
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testTimeout: 60000,
};

export default config;
