import type { Config } from "jest";

/**
 * Firestore security-rules tests (tests/rules/**): run against the local
 * Firestore emulator with @firebase/rules-unit-testing. Run with
 * `npm run test:rules`, which starts the emulator for the `demo-seva` project
 * (a demo project id, so nothing ever reaches a live Firebase project) and runs
 * Jest in band inside it.
 */
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/tests/rules/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testTimeout: 30000,
};

export default config;
