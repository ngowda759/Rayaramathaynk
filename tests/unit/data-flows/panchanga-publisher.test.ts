/**
 * @jest-environment node
 */
import {
  PanchangaPublishError,
  publishPanchangaRecord,
  publishPanchangaYearDataset,
} from "@/lib/data-flows/panchanga-publisher";
import {
  panchangaCurrentPath,
  panchangaDailyPath,
  panchangaYearPath,
} from "@/lib/data-flows/paths";
import { calendarDatesForYear } from "@/lib/data-flows/time";
import { MemoryStorage, panchangaDataset, panchangaRecord } from "./fixtures";

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

describe("Panchanga historical publication", () => {
  it("refuses an incomplete normal year before writing anything", async () => {
    const storage = new MemoryStorage();
    const dates = calendarDatesForYear(2026).filter((date) => date !== "2026-06-15");

    await expect(
      publishPanchangaYearDataset(storage, panchangaDataset(2026, dates))
    ).rejects.toThrow(/incomplete year 2026: 1 of 365 calendar dates are missing/);

    expect(storage.writes).toEqual([]);
  });

  it("refuses a leap year missing 29 February before writing anything", async () => {
    const storage = new MemoryStorage();
    const dates = calendarDatesForYear(2028).filter((date) => date !== "2028-02-29");

    await expect(
      publishPanchangaYearDataset(storage, panchangaDataset(2028, dates))
    ).rejects.toThrow(/2028-02-29/);

    expect(storage.writes).toEqual([]);
  });

  it("accepts and publishes a complete normal year", async () => {
    const storage = new MemoryStorage();
    const dataset = panchangaDataset(2026, calendarDatesForYear(2026));
    const result = await publishPanchangaYearDataset(storage, dataset, {
      updateCurrent: false,
    });

    expect(result.dayCount).toBe(365);
    expect(storage.objects.has(panchangaYearPath(2026))).toBe(true);
    expect(storage.objects.has(panchangaCurrentPath())).toBe(false);
  });

  it("refuses out-of-year records before writing anything", async () => {
    const storage = new MemoryStorage();
    const dataset = panchangaDataset(2026, ["2026-01-01"]);
    dataset.days["2026-01-01"] = panchangaRecord("2027-01-01");

    await expect(publishPanchangaYearDataset(storage, dataset)).rejects.toThrow(
      /outside the dataset year/
    );
    expect(storage.writes).toEqual([]);
  });

  it("aborts before the first write when the last daily object conflicts", async () => {
    const storage = new MemoryStorage();
    const dates = ["2026-01-01", "2026-01-02", "2026-01-03"];
    const dataset = panchangaDataset(2026, dates);
    const last = dates.at(-1)!;
    storage.seed(
      panchangaDailyPath(last),
      panchangaRecord(last, {
        tithi: {
          ...panchangaRecord(last).tithi,
          name: "Conflicting Tithi",
        },
      })
    );

    await expect(
      publishPanchangaYearDataset(storage, dataset, { requireCompleteYear: false })
    ).rejects.toMatchObject({ step: "daily" });
    expect(storage.writes).toEqual([]);
  });

  it("aborts before the first write when the yearly object conflicts", async () => {
    const storage = new MemoryStorage();
    const dataset = panchangaDataset(2026, ["2026-01-01", "2026-01-02", "2026-01-03"]);
    storage.seed(panchangaYearPath(2026), panchangaDataset(2026, ["2026-01-01"]));

    await expect(
      publishPanchangaYearDataset(storage, dataset, { requireCompleteYear: false })
    ).rejects.toMatchObject({ step: "yearly" });
    expect(storage.writes).toEqual([]);
  });

  it("skips a yearly object that differs only in metadata.generated_at", async () => {
    // A re-run of the historical import rebuilds the same dataset with a fresh
    // wall-clock stamp. Refusing it would make a partially completed import
    // impossible to resume without deleting published objects.
    const storage = new MemoryStorage();
    const dates = ["2026-01-01", "2026-01-02"];
    await publishPanchangaYearDataset(storage, panchangaDataset(2026, dates), {
      requireCompleteYear: false,
    });
    storage.writes.length = 0;

    const rebuilt = panchangaDataset(2026, dates);
    rebuilt.metadata.generated_at = "2027-01-01T00:00:00+05:30";
    const result = await publishPanchangaYearDataset(storage, rebuilt, {
      requireCompleteYear: false,
    });

    expect(storage.writes).toEqual([]);
    expect(result.dayCount).toBe(2);
    const stored = JSON.parse(storage.objects.get(panchangaYearPath(2026))!);
    expect(stored.metadata.generated_at).toBe("2026-01-01T00:00:00+05:30");
  });

  it("aborts before the first write when a daily object is invalid JSON", async () => {
    const storage = new MemoryStorage();
    const dates = ["2026-01-01", "2026-01-02"];
    const last = dates.at(-1)!;
    storage.objects.set(panchangaDailyPath(last), "{not json");

    await expect(
      publishPanchangaYearDataset(storage, panchangaDataset(2026, dates), {
        requireCompleteYear: false,
      })
    ).rejects.toMatchObject({ step: "daily" });
    expect(storage.writes).toEqual([]);
  });

  it("aborts before the first write when a daily object is unreadable", async () => {
    const storage = new MemoryStorage();
    const dates = ["2026-01-01", "2026-01-02"];
    const last = dates.at(-1)!;
    storage.readFailures.add(panchangaDailyPath(last));

    await expect(
      publishPanchangaYearDataset(storage, panchangaDataset(2026, dates), {
        requireCompleteYear: false,
      })
    ).rejects.toMatchObject({ step: "daily" });
    expect(storage.writes).toEqual([]);
  });
});
