/**
 * @jest-environment node
 */
import {
  readAaradhaneYearDataset,
  readCurrentAaradhaneDataset,
} from "@/lib/data-flows/aaradhane-reader";
import { aaradhaneCurrentPath, aaradhaneYearPath } from "@/lib/data-flows/paths";
import { MemoryStorage, aaradhaneDataset, raghavendraEvents } from "./fixtures";

const dataset = () => aaradhaneDataset(2027, raghavendraEvents(2027));

describe("Aaradhane readers", () => {
  it("reads current and yearly datasets", async () => {
    const storage = new MemoryStorage();
    storage.seed(aaradhaneCurrentPath(), dataset());
    storage.seed(aaradhaneYearPath(2027), dataset());

    const current = await readCurrentAaradhaneDataset(storage);
    expect(current.status).toBe("ok");
    expect(current.dataset?.events).toHaveLength(3);

    const yearly = await readAaradhaneYearDataset(storage, 2027);
    expect(yearly.status).toBe("ok");
    expect(yearly.year).toBe(2027);
  });

  it("returns unavailable for a missing or invalid dataset", async () => {
    const storage = new MemoryStorage();
    expect((await readAaradhaneYearDataset(storage, 2027)).status).toBe("unavailable");

    storage.seed(aaradhaneYearPath(2027), { bad: true });
    const invalid = await readAaradhaneYearDataset(storage, 2027);
    expect(invalid.status).toBe("unavailable");
    expect(invalid.error).toMatch(/failed validation/);
  });

  it("rejects an invalid year without reading", async () => {
    const storage = new MemoryStorage();
    const result = await readAaradhaneYearDataset(storage, 20);
    expect(result.status).toBe("unavailable");
    expect(storage.writes).toEqual([]);
  });
});
