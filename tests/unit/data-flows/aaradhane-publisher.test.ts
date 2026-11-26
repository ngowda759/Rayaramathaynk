/**
 * @jest-environment node
 */
import {
  AaradhanePublishError,
  publishAaradhaneYearDataset,
} from "@/lib/data-flows/aaradhane-publisher";
import {
  aaradhaneCurrentPath,
  aaradhaneSnapshotPath,
  aaradhaneYearPath,
} from "@/lib/data-flows/paths";
import {
  MemoryStorage,
  aaradhaneDataset,
  aaradhaneEvent,
  raghavendraEvents,
} from "./fixtures";

const YEAR = 2027;

describe("Aaradhane publisher", () => {
  it("publishes a yearly dataset and preserves current by default", async () => {
    const storage = new MemoryStorage();
    const dataset = aaradhaneDataset(YEAR, raghavendraEvents(YEAR));

    const result = await publishAaradhaneYearDataset(storage, dataset);

    expect(result.eventCount).toBe(3);
    expect(result.currentUpdated).toBe(false);
    expect(storage.writes).toEqual([aaradhaneYearPath(YEAR)]);
    expect(storage.objects.has(aaradhaneYearPath(YEAR))).toBe(true);
    expect(storage.objects.has(aaradhaneCurrentPath())).toBe(false);
  });

  it("advances current only when explicitly requested", async () => {
    const storage = new MemoryStorage();
    const dataset = aaradhaneDataset(YEAR, raghavendraEvents(YEAR));

    const result = await publishAaradhaneYearDataset(storage, dataset, {
      advanceCurrent: true,
    });

    expect(result.currentUpdated).toBe(true);
    expect(storage.writes).toEqual([aaradhaneYearPath(YEAR), aaradhaneCurrentPath()]);
    expect(JSON.parse(storage.objects.get(aaradhaneCurrentPath())!).year).toBe(YEAR);
  });

  it("keeps current unchanged when regenerating a historical year", async () => {
    const storage = new MemoryStorage();
    const current = aaradhaneDataset(2026, raghavendraEvents(2026));
    storage.seed(aaradhaneCurrentPath(), current);
    const before = storage.objects.get(aaradhaneCurrentPath());

    const first = aaradhaneDataset(YEAR, raghavendraEvents(YEAR));
    storage.seed(aaradhaneYearPath(YEAR), first);

    const regenerated = aaradhaneDataset(YEAR, [
      ...raghavendraEvents(YEAR),
      aaradhaneEvent(YEAR),
    ]);
    const result = await publishAaradhaneYearDataset(storage, regenerated);

    expect(result.currentUpdated).toBe(false);
    expect(result.snapshotPath).toBe(
      aaradhaneSnapshotPath(YEAR, first.metadata.generated_at)
    );
    expect(storage.objects.has(result.snapshotPath!)).toBe(true);
    expect(storage.objects.get(aaradhaneCurrentPath())).toBe(before);
    expect(storage.writes).toEqual([result.snapshotPath, aaradhaneYearPath(YEAR)]);
  });

  it("snapshots the previous dataset before replacing it", async () => {
    const storage = new MemoryStorage();
    const first = aaradhaneDataset(YEAR, raghavendraEvents(YEAR));
    await publishAaradhaneYearDataset(storage, first);

    const second = aaradhaneDataset(YEAR, [
      ...raghavendraEvents(YEAR),
      aaradhaneEvent(YEAR),
    ]);
    const result = await publishAaradhaneYearDataset(storage, second);

    expect(result.snapshotPath).toBe(aaradhaneSnapshotPath(YEAR, first.metadata.generated_at));
    expect(storage.objects.has(result.snapshotPath!)).toBe(true);
    expect(JSON.parse(storage.objects.get(result.snapshotPath!)!).events).toHaveLength(3);
  });

  it("refuses to overwrite an existing invalid dataset", async () => {
    const storage = new MemoryStorage();
    storage.seed(aaradhaneYearPath(YEAR), { broken: true });

    await expect(
      publishAaradhaneYearDataset(storage, aaradhaneDataset(YEAR, raghavendraEvents(YEAR)))
    ).rejects.toBeInstanceOf(AaradhanePublishError);
    expect(storage.writes).toEqual([]);
  });

  it("keeps the previous yearly dataset when the new upload fails", async () => {
    const storage = new MemoryStorage();
    const first = aaradhaneDataset(YEAR, raghavendraEvents(YEAR));
    await publishAaradhaneYearDataset(storage, first);
    const before = storage.objects.get(aaradhaneYearPath(YEAR));

    storage.putFailures.add(aaradhaneYearPath(YEAR));
    await expect(
      publishAaradhaneYearDataset(
        storage,
        aaradhaneDataset(YEAR, [...raghavendraEvents(YEAR), aaradhaneEvent(YEAR)])
      )
    ).rejects.toMatchObject({ step: "yearly" });

    expect(storage.objects.get(aaradhaneYearPath(YEAR))).toBe(before);
  });

  it("does not rewrite an unchanged yearly dataset", async () => {
    const storage = new MemoryStorage();
    const dataset = aaradhaneDataset(YEAR, raghavendraEvents(YEAR));
    await publishAaradhaneYearDataset(storage, dataset);
    storage.writes.length = 0;

    const result = await publishAaradhaneYearDataset(storage, dataset);

    expect(result.unchanged).toBe(true);
    expect(result.currentUpdated).toBe(false);
    expect(storage.writes).toEqual([]);
  });

  it("can advance current for an unchanged yearly dataset when requested", async () => {
    const storage = new MemoryStorage();
    const dataset = aaradhaneDataset(YEAR, raghavendraEvents(YEAR));
    await publishAaradhaneYearDataset(storage, dataset);
    storage.writes.length = 0;

    const result = await publishAaradhaneYearDataset(storage, dataset, {
      advanceCurrent: true,
    });

    expect(result.unchanged).toBe(true);
    expect(result.currentUpdated).toBe(true);
    expect(storage.writes).toEqual([aaradhaneCurrentPath()]);
  });

  it("rejects a dataset missing a Raghavendra phase", async () => {
    const storage = new MemoryStorage();
    await expect(
      publishAaradhaneYearDataset(
        storage,
        aaradhaneDataset(YEAR, raghavendraEvents(YEAR).slice(0, 2))
      )
    ).rejects.toBeInstanceOf(AaradhanePublishError);
    expect(storage.writes).toEqual([]);
  });
});
