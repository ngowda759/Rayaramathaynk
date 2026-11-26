/**
 * @jest-environment node
 */
import { readCurrentPanchanga, readDailyPanchanga, readYearlyPanchanga } from "@/lib/data-flows/panchanga-reader";
import { panchangaCurrentPath, panchangaDailyPath, panchangaYearPath } from "@/lib/data-flows/paths";
import { MemoryStorage, panchangaDataset, panchangaRecord } from "./fixtures";

const IST_NOON = new Date("2026-11-24T12:00:00+05:30");

describe("Panchanga readers", () => {
  it("returns ok for a current record on the same IST day", async () => {
    const storage = new MemoryStorage();
    storage.seed(panchangaCurrentPath(), panchangaRecord("2026-11-24"));

    const result = await readCurrentPanchanga(storage, IST_NOON);

    expect(result.status).toBe("ok");
    expect(result.expectedDate).toBe("2026-11-24");
    expect(result.record?.date).toBe("2026-11-24");
  });

  it("marks yesterday's record as stale, not current", async () => {
    const storage = new MemoryStorage();
    storage.seed(panchangaCurrentPath(), panchangaRecord("2026-11-23"));

    const result = await readCurrentPanchanga(storage, IST_NOON);

    expect(result.status).toBe("stale");
    expect(result.record?.date).toBe("2026-11-23");
  });

  it("returns unavailable when current.json is missing", async () => {
    const result = await readCurrentPanchanga(new MemoryStorage(), IST_NOON);
    expect(result.status).toBe("unavailable");
    expect(result.record).toBeNull();
  });

  it("returns unavailable for invalid JSON", async () => {
    const storage = new MemoryStorage();
    storage.objects.set(panchangaCurrentPath(), "{not json");
    const result = await readCurrentPanchanga(storage, IST_NOON);
    expect(result.status).toBe("unavailable");
    expect(result.error).toMatch(/not valid JSON/);
  });

  it("returns unavailable for a record that fails the schema", async () => {
    const storage = new MemoryStorage();
    storage.seed(panchangaCurrentPath(), { date: "2026-11-24" });
    const result = await readCurrentPanchanga(storage, IST_NOON);
    expect(result.status).toBe("unavailable");
    expect(result.error).toMatch(/failed validation/);
  });

  it("reads a historical daily record and enforces the requested date", async () => {
    const storage = new MemoryStorage();
    storage.seed(panchangaDailyPath("2026-11-20"), panchangaRecord("2026-11-20"));

    const ok = await readDailyPanchanga(storage, "2026-11-20");
    expect(ok.status).toBe("ok");

    storage.seed(panchangaDailyPath("2026-11-21"), panchangaRecord("2026-11-20"));
    const mismatch = await readDailyPanchanga(storage, "2026-11-21");
    expect(mismatch.status).toBe("unavailable");
    expect(mismatch.error).toMatch(/does not match expected date/);
  });

  it("rejects an impossible date before reading Storage", async () => {
    const storage = new MemoryStorage();
    const result = await readDailyPanchanga(storage, "2026-02-31");
    expect(result.status).toBe("unavailable");
    expect(storage.writes).toEqual([]);
  });

  it("reads a valid yearly dataset and rejects an invalid one", async () => {
    const storage = new MemoryStorage();
    storage.seed(panchangaYearPath(2026), panchangaDataset(2026, ["2026-01-01"]));
    expect((await readYearlyPanchanga(storage, 2026)).status).toBe("ok");

    storage.seed(panchangaYearPath(2027), { year: 2027, days: {} });
    const invalid = await readYearlyPanchanga(storage, 2027);
    expect(invalid.status).toBe("unavailable");
    expect(invalid.error).toMatch(/failed validation/);
  });
});
