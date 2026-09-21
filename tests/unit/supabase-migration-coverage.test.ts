import fs from "fs";
import path from "path";
import {
  extractDeclaredTables,
  diffTableCoverage,
  buildStaticSchemaReport,
  extractDeclaredColumns,
  extractRlsEnabledTables,
} from "@/lib/supabase/migration-coverage";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

function readMigrations(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
}

describe("extractDeclaredTables", () => {
  it("extracts table names from CREATE TABLE statements", () => {
    const tables = extractDeclaredTables([
      "CREATE TABLE sevas (id uuid);",
      "CREATE TABLE IF NOT EXISTS daily_poojas (id uuid);",
      'CREATE TABLE public."social_links" (id uuid);',
    ]);
    expect(tables).toEqual(["daily_poojas", "sevas", "social_links"]);
  });

  it("ignores table names that only appear in comments or prose", () => {
    const tables = extractDeclaredTables([
      "-- Mapped from sevas collection\n/* mentions gallery_media */\nCREATE TABLE events (id uuid);",
    ]);
    expect(tables).toEqual(["events"]);
  });

  it("de-duplicates tables declared across multiple migrations", () => {
    const tables = extractDeclaredTables([
      "CREATE TABLE sevas (id uuid);",
      "CREATE TABLE IF NOT EXISTS sevas (id uuid);",
    ]);
    expect(tables).toEqual(["sevas"]);
  });

  it("declares a seva_bookings table in the migrations directory", () => {
    expect(extractDeclaredTables(readMigrations())).toContain("seva_bookings");
  });
});

describe("diffTableCoverage", () => {
  it("reports missing and extra tables", () => {
    const { missing, extra } = diffTableCoverage(
      ["sevas", "events", "seva_bookings"],
      ["sevas", "events", "legacy_table"]
    );
    expect(missing).toEqual(["seva_bookings"]);
    expect(extra).toEqual(["legacy_table"]);
  });

  it("reports no gaps when every declared table exists", () => {
    const { missing, extra } = diffTableCoverage(["sevas"], ["sevas"]);
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });

  it("is case-insensitive", () => {
    const { missing } = diffTableCoverage(["Seva_Bookings"], ["seva_bookings"]);
    expect(missing).toEqual([]);
  });
});

describe("declared table set", () => {
  it("covers the documented core, content, AI, settings and temple_areas tables", () => {
    const tables = extractDeclaredTables(readMigrations());
    const documented = [
      "sevas",
      "daily_poojas",
      "events",
      "users",
      "profiles",
      "donations",
      "donation_campaigns",
      "gallery_albums",
      "gallery_media",
      "testimonials",
      "aaradhanes",
      "seva_bookings",
      "volunteer_requests",
      "chat_sessions",
      "chat_messages",
      "unknown_questions",
      "ai_intent_distribution",
      "ai_latency_records",
      "site_settings",
      "social_links",
      "temple_areas",
    ];
    for (const table of documented) {
      expect(tables).toContain(table);
    }
  });

  it("declares the settings_documents table used for lossless settings storage", () => {
    expect(extractDeclaredTables(readMigrations())).toContain("settings_documents");
  });
});

// ---------------------------------------------------------------------------
// Static schema expectations (no credentials required)
// ---------------------------------------------------------------------------

describe("static schema expectations (I)", () => {
  const report = buildStaticSchemaReport(readMigrations());

  it("enables RLS on every declared table", () => {
    expect(report.tablesMissingRls).toEqual([]);
  });

  it("declares the key columns of the settings_documents table", () => {
    const columns = extractDeclaredColumns(readMigrations()).filter(
      (c) => c.table === "settings_documents"
    );
    const names = columns.map((c) => c.column);
    expect(names).toEqual(
      expect.arrayContaining([
        "firestore_id",
        "document_key",
        "data",
        "created_at",
        "updated_at",
      ])
    );
  });

  it("resolves donations.campaign_id and gallery_media.album_id to text after ALTERs", () => {
    const columns = report.effectiveColumns;

    const campaign = columns.find(
      (c) => c.table === "donations" && c.column === "campaign_id"
    );
    const album = columns.find(
      (c) => c.table === "gallery_media" && c.column === "album_id"
    );

    expect(campaign).toBeDefined();
    expect(album).toBeDefined();
    expect(campaign!.type).toBe("text");
    expect(album!.type).toBe("text");
  });

  it("resolves seva_bookings.seva_id to text after the alignment migration", () => {
    const sevaId = report.effectiveColumns.find(
      (c) => c.table === "seva_bookings" && c.column === "seva_id"
    );
    expect(sevaId).toBeDefined();
    expect(sevaId!.type).toBe("text");

    const files = fs.readdirSync(MIGRATIONS_DIR);
    expect(files.some((f) => f.includes("align_seva_bookings_seva_id"))).toBe(true);
  });

  it("keeps genuine uuid primary keys as uuid", () => {
    const id = report.effectiveColumns.find((c) => c.table === "sevas" && c.column === "id");
    expect(id).toBeDefined();
    expect(id!.type).toBe("uuid");
  });

  it("marks firestore_id NOT NULL-free but unique-indexed per table", () => {
    const sql = readMigrations().join("\n");
    expect(sql).toMatch(/firestore_id\s+text\s+UNIQUE/i);
  });

  it("exposes RLS helper for expected tables", () => {
    const rls = extractRlsEnabledTables(readMigrations());
    expect(rls).toContain("settings_documents");
    expect(rls).toContain("sevas");
    expect(rls).toContain("donations");
  });
});

describe("migrationVersionFromFilename", () => {
  const { migrationVersionFromFilename } = require("../../lib/supabase/migration-coverage"); // eslint-disable-line @typescript-eslint/no-require-imports

  it("extracts the 14-digit version prefix from a canonical filename", () => {
    expect(migrationVersionFromFilename("20260907112632_create_core_tables.sql")).toBe("20260907112632");
  });

  it("returns null for non-canonical (e.g., 8-digit) legacy filenames", () => {
    expect(migrationVersionFromFilename("20240915_create_temple_areas.sql")).toBeNull();
  });
});
