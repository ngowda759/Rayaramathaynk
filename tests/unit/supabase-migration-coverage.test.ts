import fs from "fs";
import path from "path";
import {
  extractDeclaredTables,
  diffTableCoverage,
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
});
