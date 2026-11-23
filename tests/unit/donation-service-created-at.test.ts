/**
 * @jest-environment node
 *
 * Regression tests for the donation list HTTP 400 caused by ordering on a column
 * that does not exist.
 *
 * Production logs showed `GET /rest/v1/donations?select=*&order=created_at.desc`
 * returning 400 because `donations.created_at` was never declared; only
 * `updated_at` existed. `getDonations()` now orders by the real `created_at`
 * column (added by `20261203000000_donations_created_at.sql`), newest first, with
 * unknown legacy timestamps last.
 *
 * The Supabase client is stubbed: no database, no network.
 */
jest.mock("server-only", () => ({}), { virtual: true });

jest.mock("@/lib/supabase/admin", () => {
  const orderCalls: Array<[string, unknown]> = [];
  const state: { data: unknown; error: { message: string } | null } = {
    data: null,
    error: null,
  };

  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of [
    "select",
    "eq",
    "or",
    "limit",
    "in",
    "insert",
    "update",
    "delete",
    "upsert",
  ]) {
    builder[method] = jest.fn(chain);
  }
  builder.order = jest.fn((column: string, options: unknown) => {
    orderCalls.push([column, options]);
    return builder;
  });
  builder.single = jest.fn(() => Promise.resolve(state));
  builder.maybeSingle = jest.fn(() => Promise.resolve(state));
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(state).then(resolve);

  return {
    createAdminClient: () => ({ from: () => builder }),
    __state: state,
    __orderCalls: orderCalls,
  };
});

import fs from "fs";
import path from "path";

import { extractDeclaredColumns } from "@/lib/supabase/migration-coverage";
import { donationService } from "@/services/donation.server";

const mock = jest.requireMock("@/lib/supabase/admin") as {
  __state: { data: unknown; error: { message: string } | null };
  __orderCalls: Array<[string, unknown]>;
};

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

function readMigrations(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8"));
}

/** Columns the `donations` table has after every migration, including ALTER ADD COLUMN. */
function donationsColumns(): Set<string> {
  const migrations = readMigrations();
  const columns = new Set(
    extractDeclaredColumns(migrations)
      .filter((column) => column.table === "donations")
      .map((column) => column.column)
  );

  const addColumn =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:"?public"?\s*\.\s*)?"?donations"?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z_][a-z0-9_]*)"?/gi;
  for (const sql of migrations) {
    let match: RegExpExecArray | null;
    addColumn.lastIndex = 0;
    while ((match = addColumn.exec(sql)) !== null) {
      columns.add(match[1].toLowerCase());
    }
  }
  return columns;
}

const donationRow = {
  id: "00000000-0000-0000-0000-000000000001",
  firestore_id: null,
  donor_name: "Rama",
  email: "rama@example.org",
  phone: "9999999999",
  address: "Bengaluru",
  amount: 501,
  purpose: "Annadanam",
  campaign_id: null,
  message: "",
  payment_mode: "upi",
  status: "pending",
  receipt_number: "",
  admin_remarks: "",
  collected_by: "",
  collected_at: null,
  created_at: "2026-11-01T10:00:00.000Z",
  updated_at: "2026-11-02T10:00:00.000Z",
};

describe("donationService.getDonations", () => {
  beforeEach(() => {
    mock.__orderCalls.length = 0;
    mock.__state.data = null;
    mock.__state.error = null;
  });

  it("orders by the real created_at column, newest first, nulls last", async () => {
    mock.__state.data = [donationRow];

    const donations = await donationService.getDonations();

    expect(mock.__orderCalls).toEqual([
      ["created_at", { ascending: false, nullsFirst: false }],
    ]);
    expect(donations).toHaveLength(1);
    expect(donations[0].createdAt).toBe("2026-11-01T10:00:00.000Z");
    expect(donations[0].updatedAt).toBe("2026-11-02T10:00:00.000Z");
  });

  it("surfaces a read failure instead of returning an empty list", async () => {
    mock.__state.error = { message: 'column "created_at" does not exist' };

    await expect(donationService.getDonations()).rejects.toThrow(
      'Could not read donations: column "created_at" does not exist'
    );
  });
});

describe("donationService.getDonationById (admin details view)", () => {
  beforeEach(() => {
    mock.__state.data = null;
    mock.__state.error = null;
  });

  it("maps a stored donation, including its creation timestamp", async () => {
    mock.__state.data = donationRow;

    const donation = await donationService.getDonationById(donationRow.id);

    expect(donation).not.toBeNull();
    expect(donation!.createdAt).toBe("2026-11-01T10:00:00.000Z");
    expect(donation!.donorName).toBe("Rama");
  });
});

describe("donation queries reference only existing columns", () => {
  const serviceSource = fs.readFileSync(
    path.join(process.cwd(), "services", "donation.server.ts"),
    "utf8"
  );
  const columns = donationsColumns();

  it("declares created_at on the donations table", () => {
    expect(columns.has("created_at")).toBe(true);
  });

  it("orders only by columns that exist", () => {
    const ordered = [...serviceSource.matchAll(/\.order\(\s*["'`]([a-z_][a-z0-9_]*)["'`]/g)];
    expect(ordered.length).toBeGreaterThan(0);
    for (const match of ordered) {
      expect(`${match[1]}:${columns.has(match[1])}`).toBe(`${match[1]}:true`);
    }
  });

  it("selects only columns that exist", () => {
    const selects = [...serviceSource.matchAll(/\.select\(\s*["'`]([^"'`]+)["'`]/g)];
    expect(selects.length).toBeGreaterThan(0);
    for (const match of selects) {
      const requested = match[1]
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part && part !== "*");
      for (const column of requested) {
        expect(`${column}:${columns.has(column)}`).toBe(`${column}:true`);
      }
    }
  });

  it("reads only row fields that exist", () => {
    const reads = [...serviceSource.matchAll(/row\.([a-z_][a-z0-9_]*)/g)];
    expect(reads.length).toBeGreaterThan(0);
    for (const match of reads) {
      expect(`${match[1]}:${columns.has(match[1])}`).toBe(`${match[1]}:true`);
    }
  });
});

describe("the created_at migration", () => {
  const file = fs
    .readdirSync(MIGRATIONS_DIR)
    .find((name) => name.endsWith("_donations_created_at.sql"));

  it("exists exactly once", () => {
    expect(file).toBeDefined();
  });

  it("adds the column with a default and a descending ordering index", () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file!), "utf8");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS created_at timestamptz/i);
    expect(sql).toMatch(/ALTER COLUMN created_at SET DEFAULT now\(\)/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_donations_created_at/i);
    expect(sql).toMatch(/created_at DESC NULLS LAST/i);
  });

  it("backfills only from timestamps the row already has", () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file!), "utf8");
    expect(sql).toMatch(/SET created_at = LEAST\(updated_at, collected_at\)/i);
    // Never invent a creation time for a row with no known timestamp.
    expect(sql).not.toMatch(/SET created_at = now\(\)/i);
  });
});
