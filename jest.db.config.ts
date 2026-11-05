import type { Config } from "jest";

/**
 * Database tests (tests/db/**): run the Supabase migrations against an
 * in-process PGlite Postgres. Run with `npm run test:db` (always --runInBand).
 *
 * PGlite loads its WebAssembly through dynamic `import()`, which Jest only
 * supports under `node --experimental-vm-modules`, so these tests run as native
 * ES modules (`useESM`) - see the `test:db` script.
 */
const config: Config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/tests/db/**/*.test.ts"],
  // The real-PostgreSQL integration suite (tests/db/integration/**) connects over the
  // wire with `pg` and must NOT run under the in-process PGlite config. It has its own
  // config and `npm run test:db:integration`.
  testPathIgnorePatterns: ["<rootDir>/tests/db/integration/"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      useESM: true,
      tsconfig: {
        module: "esnext",
        target: "es2022",
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testTimeout: 30000,
};

export default config;
