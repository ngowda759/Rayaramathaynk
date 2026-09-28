import { execSync } from "child_process";

describe("Phase 1 Migration Scripts (Hardened)", () => {
  describe("dump-firestore-staged.ts", () => {
    it("should fail if no collections provided", () => {
      try {
        execSync("npx tsx scripts/dump-firestore-staged.ts", { stdio: "ignore" });
        fail("Should have thrown an error");
      } catch (err: unknown) {
        expect((err as {status?: number}).status).toBe(1);
      }
    });

    it("should fail if invalid collections requested", () => {
      try {
        execSync("npx tsx scripts/dump-firestore-staged.ts users", { stdio: "ignore" });
        fail("Should have thrown an error");
      } catch (err: unknown) {
        expect((err as {status?: number}).status).toBe(1);
      }
    });
  });

  describe("migrate-staged-phase1.ts", () => {
    it("should fail if no mode flags provided", () => {
      try {
        execSync("npx tsx scripts/migrate-staged-phase1.ts", { stdio: "ignore" });
        fail("Should have thrown an error");
      } catch (err: unknown) {
        expect((err as {status?: number}).status).toBe(1);
      }
    });

    it("should fail if both mode flags provided", () => {
      try {
        execSync("npx tsx scripts/migrate-staged-phase1.ts --dry-run --confirm-production", { stdio: "ignore" });
        fail("Should have thrown an error");
      } catch (err: unknown) {
        expect((err as {status?: number}).status).toBe(1);
      }
    });

    it("should fail if manifest is missing", () => {
      try {
        execSync("npx tsx scripts/migrate-staged-phase1.ts --dry-run", { stdio: "ignore" });
        fail("Should have thrown an error");
      } catch (err: unknown) {
        expect((err as {status?: number}).status).toBe(1); // Will fail because manifest doesn't exist
      }
    });
  });
});
