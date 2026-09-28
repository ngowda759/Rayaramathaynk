import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const ROOT = process.cwd();
const DD = path.join(ROOT, "data", "firestore-dump");

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
        expect((err as {status?: number}).status).toBe(1);
      }
    });

    // Helper to generate a valid manifest and json payload
    function setupValidManifest(settings: any[], events: any[]) {
      fs.mkdirSync(DD, { recursive: true });
      const settingsStr = JSON.stringify(settings, null, 2);
      const eventsStr = JSON.stringify(events, null, 2);
      fs.writeFileSync(path.join(DD, "settings.json"), settingsStr);
      fs.writeFileSync(path.join(DD, "events.json"), eventsStr);

      const manifest = {
        success: true,
        collections: {
          settings: { status: "success", hash: crypto.createHash("sha256").update(settingsStr).digest("hex") },
          events: { status: "success", hash: crypto.createHash("sha256").update(eventsStr).digest("hex") }
        }
      };
      fs.writeFileSync(path.join(DD, "manifest.json"), JSON.stringify(manifest));
    }

    afterEach(() => {
       fs.rmSync(DD, { recursive: true, force: true });
       fs.rmSync(path.join(ROOT, "MIGRATION_PHASE_1_REPORT.md"), { force: true });
    });

    it("should process empty successful collections cleanly", () => {
      setupValidManifest([], []);
      // Should not throw, should succeed
      // Note: we can't test --confirm-production locally without real Supabase credentials.
      // But we can test --dry-run expecting an error because the Supabase fetch will fail without creds.
      // We will check that it fails due to Supabase creds missing, NOT manifest validation
      try {
        const out = execSync("npx tsx scripts/migrate-staged-phase1.ts --dry-run", { encoding: "utf8" });
        // Depending on env, it might throw an error from createAdminClient
      } catch (err: unknown) {
        const stderr = (err as any).stderr || (err as any).stdout || "";
        expect(stderr).toContain("Missing Supabase environment variables for admin client");
      }
    });

    it("should fail on malformed JSON", () => {
      setupValidManifest([], []);
      fs.writeFileSync(path.join(DD, "settings.json"), "invalid json");
      try {
        execSync("npx tsx scripts/migrate-staged-phase1.ts --dry-run", { encoding: "utf8" });
        fail("Should have thrown");
      } catch(err: unknown) {
         const stderr = (err as any).stderr || (err as any).stdout || "";
         expect(stderr).toContain("FATAL: Settings file hash mismatch.");
      }
    });

    it("should fail if manifest is missing required collections", () => {
      fs.mkdirSync(DD, { recursive: true });
      fs.writeFileSync(path.join(DD, "manifest.json"), JSON.stringify({ success: true, collections: { settings: {status:"success"} } }));
      try {
        execSync("npx tsx scripts/migrate-staged-phase1.ts --dry-run", { encoding: "utf8" });
        fail("Should have thrown");
      } catch(err: unknown) {
         const stderr = (err as any).stderr || (err as any).stdout || "";
         expect(stderr).toContain("FATAL: Source manifest is missing a successful dump for required collection: events");
      }
    });
  });
});
