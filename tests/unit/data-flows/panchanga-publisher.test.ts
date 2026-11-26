/**
 * @jest-environment node
 */
import {
  PanchangaPublishError,
  publishPanchangaRecord,
} from "@/lib/data-flows/panchanga-publisher";
import {
  panchangaCurrentPath,
  panchangaDailyPath,
  panchangaYearPath,
} from "@/lib/data-flows/paths";
import { MemoryStorage, panchangaRecord } from "./fixtures";

const DAY1 = "2026-11-24";
const DAY2 = "2026-11-25";

describe("Panchanga publisher", () => {
  it("writes daily, then yearly, then current", async () => {
    const storage = new MemoryStorage();
    const result = await publishPanchangaRecord(storage, panchangaRecord(DAY1), {
      expectedDate: DAY1,
      generatedAt: "2026-11-24T00:00:00+05:30",
    });

    expect(storage.writes).toEqual([
      panchangaDailyPath(DAY1),
      panchangaYearPath(2026),
      panchangaCurrentPath(),
    ]);
    expect(result.yearlyDayCount).toBe(1);
    expect(storage.objects.has(panchangaDailyPath(DAY1))).toBe(true);
    expect(storage.objects.has(panchangaCurrentPath())).toBe(true);
  });

  it("merges a second day into the existing yearly dataset", async () => {
    const storage = new MemoryStorage();
    await publishPanchangaRecord(storage, panchangaRecord(DAY1), { expectedDate: DAY1 });
    const result = await publishPanchangaRecord(storage, panchangaRecord(DAY2), {
      expectedDate: DAY2,
    });

    expect(result.yearlyDayCount).toBe(2);
    const yearly = JSON.parse(storage.objects.get(panchangaYearPath(2026))!);
    expect(Object.keys(yearly.days).sort()).toEqual([DAY1, DAY2]);
  });

  it("refuses an invalid record before writing anything", async () => {
    const storage = new MemoryStorage();
    const record = panchangaRecord(DAY1) as unknown as Record<string, unknown>;
    delete record.karana;

    await expect(
      publishPanchangaRecord(storage, record, { expectedDate: DAY1 })
    ).rejects.toBeInstanceOf(PanchangaPublishError);
    expect(storage.writes).toEqual([]);
  });

  it("refuses to overwrite an existing invalid yearly dataset", async () => {
    const storage = new MemoryStorage();
    storage.seed(panchangaYearPath(2026), { broken: true });
    storage.seed(panchangaCurrentPath(), panchangaRecord("2026-11-23"));

    await expect(
      publishPanchangaRecord(storage, panchangaRecord(DAY1), { expectedDate: DAY1 })
    ).rejects.toMatchObject({ step: "verify-existing-year" });

    // Preflight happens before any write, so the last valid current is untouched.
    expect(storage.writes).toEqual([]);
    expect(JSON.parse(storage.objects.get(panchangaCurrentPath())!).date).toBe("2026-11-23");
  });

  it("keeps the previous current.json when the yearly upload fails", async () => {
    const storage = new MemoryStorage();
    await publishPanchangaRecord(storage, panchangaRecord(DAY1), { expectedDate: DAY1 });
    const before = storage.objects.get(panchangaCurrentPath());

    storage.putFailures.add(panchangaYearPath(2026));
    await expect(
      publishPanchangaRecord(storage, panchangaRecord(DAY2), { expectedDate: DAY2 })
    ).rejects.toMatchObject({ step: "yearly" });

    expect(storage.objects.get(panchangaCurrentPath())).toBe(before);
  });

  it("fails verification when the read-back does not match", async () => {
    const storage = new MemoryStorage();
    storage.corruptReads.set(panchangaCurrentPath(), '{"date":"wrong"}\n');

    await expect(
      publishPanchangaRecord(storage, panchangaRecord(DAY1), {
        expectedDate: DAY1,
        verifyAttempts: 1,
      })
    ).rejects.toMatchObject({ step: "current" });
  });

  it("is idempotent on a repeated publish", async () => {
    const storage = new MemoryStorage();
    await publishPanchangaRecord(storage, panchangaRecord(DAY1), { expectedDate: DAY1 });
    await publishPanchangaRecord(storage, panchangaRecord(DAY1), { expectedDate: DAY1 });

    const yearly = JSON.parse(storage.objects.get(panchangaYearPath(2026))!);
    expect(Object.keys(yearly.days)).toEqual([DAY1]);
  });
});
