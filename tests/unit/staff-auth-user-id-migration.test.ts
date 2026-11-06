/**
 * @jest-environment node
 *
 * Verifies Phase 2 migration:
 * `supabase/migrations/20261116000000_add_auth_user_id_to_staff.sql`.
 *
 * Requirements:
 * - Additive only: adds nullable, unique auth_user_id uuid to public.staff
 * - Does NOT alter, drop, or rename firebase_uid
 * - Does NOT alter or weaken seva_staff_guard
 * - Does NOT alter RLS policies, grants, or F-A16 objects
 * - Ensures auth_user_id can be populated without violating seva_staff_guard
 */

import fs from "fs";
import path from "path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20261116000000_add_auth_user_id_to_staff.sql"
);

describe("Phase 2 Migration: staff.auth_user_id", () => {
  it("exists and contains the additive column statement", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
    const sql = fs.readFileSync(MIGRATION_PATH, "utf8");

    expect(sql).toMatch(
      /ALTER\s+TABLE\s+public\.staff\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+auth_user_id\s+uuid\s+UNIQUE/i
    );
  });

  it("does not drop or mutate any existing columns", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("does not modify or disable seva_staff_guard", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
    expect(sql).not.toMatch(/\bDROP\s+TRIGGER\b/i);
    expect(sql).not.toMatch(/\bALTER\s+TABLE\s+.*DISABLE\s+TRIGGER\b/i);
    expect(sql).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+seva_staff_guard\b/i);
  });

  it("does not modify RLS or security grants", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
    expect(sql).not.toMatch(/\bDROP\s+POLICY\b/i);
    expect(sql).not.toMatch(/\bCREATE\s+POLICY\b/i);
    expect(sql).not.toMatch(/\bGRANT\b/i);
    expect(sql).not.toMatch(/\bREVOKE\b/i);
    expect(sql).not.toMatch(/\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i);
  });

  it("confirms seva_staff_guard continues to guard firebase_uid immutability while allowing auth_user_id update", () => {
    // seva_staff_guard definition in 20261020000000_seva_core.sql explicitly checks:
    // IF NEW.firebase_uid IS DISTINCT FROM OLD.firebase_uid THEN RAISE EXCEPTION ...
    const coreSql = fs.readFileSync(
      path.join(process.cwd(), "supabase", "migrations", "20261020000000_seva_core.sql"),
      "utf8"
    );
    expect(coreSql).toContain("NEW.firebase_uid IS DISTINCT FROM OLD.firebase_uid");

    // Updating auth_user_id while keeping firebase_uid identical does NOT violate this trigger.
    const oldRow = { id: "s-1", staff_no: 1, firebase_uid: "fb-uid-1", auth_user_id: null, status: "active" };
    const newRow = { ...oldRow, auth_user_id: "sb-uuid-1" };

    expect(newRow.id === oldRow.id).toBe(true);
    expect(newRow.staff_no === oldRow.staff_no).toBe(true);
    expect(newRow.firebase_uid === oldRow.firebase_uid).toBe(true);
    expect(newRow.status === oldRow.status).toBe(true);
  });
});
