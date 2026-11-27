/**
 * @jest-environment node
 */
import {
  buildPanchangaYearDataset,
  validateAaradhaneYearDataset,
  validateCompletePanchangaYear,
  validatePanchangaRecord,
  validatePanchangaYearDataset,
} from "@/lib/data-flows/schemas";
import {
  calendarDatesForYear,
  getIstDateString,
  isIsoTimestamp,
} from "@/lib/data-flows/time";
import {
  aaradhaneDataset,
  aaradhaneEvent,
  panchangaDataset,
  panchangaRecord,
  raghavendraEvents,
} from "./fixtures";

describe("IST date handling", () => {
  it("uses the Asia/Kolkata day, not the UTC day", () => {
    expect(getIstDateString(new Date("2026-11-24T20:00:00Z"))).toBe("2026-11-25");
    expect(getIstDateString(new Date("2026-11-24T18:00:00Z"))).toBe("2026-11-24");
    expect(getIstDateString(new Date("2026-11-24T23:59:00+05:30"))).toBe("2026-11-24");
  });

  it("requires an offset for astronomical timestamps", () => {
    expect(isIsoTimestamp("2026-11-24T06:26:08.024097+05:30")).toBe(true);
    expect(isIsoTimestamp("2026-11-24T06:26:08")).toBe(false);
  });
});

describe("Panchanga record validation", () => {
  it("accepts a complete record", () => {
    const result = validatePanchangaRecord(panchangaRecord("2026-11-24"), "2026-11-24");
    expect(result.ok).toBe(true);
    expect(result.value?.tithi.name).toBe("Shukla Dashami");
  });

  it("rejects a record whose date does not match the expected date", () => {
    const result = validatePanchangaRecord(panchangaRecord("2026-11-24"), "2026-11-25");
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/does not match expected date/);
  });

  it("rejects metadata.valid_for that disagrees with date", () => {
    const record = panchangaRecord("2026-11-24");
    record.metadata.valid_for = "2026-11-23";
    const result = validatePanchangaRecord(record);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/valid_for/);
  });

  it("rejects missing astronomical fields", () => {
    const record = panchangaRecord("2026-11-24") as unknown as Record<string, unknown>;
    delete record.yoga;
    const result = validatePanchangaRecord(record);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/yoga/);
  });

  it("rejects malformed timestamps and impossible dates", () => {
    const record = panchangaRecord("2026-11-24");
    record.sun.sunrise = "2026-11-24 06:26";
    expect(validatePanchangaRecord(record).ok).toBe(false);

    const impossible = panchangaRecord("2026-02-31");
    expect(validatePanchangaRecord(impossible).ok).toBe(false);
  });
});

describe("Panchanga year dataset validation", () => {
  it("accepts a complete year", () => {
    const result = validatePanchangaYearDataset(
      panchangaDataset(2026, ["2026-01-01", "2026-01-02"]),
      2026
    );
    expect(result.ok).toBe(true);
    expect(result.value?.metadata.count).toBe(2);
  });

  it("rejects a count that does not match the number of days", () => {
    const dataset = panchangaDataset(2026, ["2026-01-01"]);
    dataset.metadata.count = 2;
    const result = validatePanchangaYearDataset(dataset);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/count/);
  });

  it("rejects a day key that does not match the record date", () => {
    const dataset = panchangaDataset(2026, ["2026-01-01"]);
    const record = dataset.days["2026-01-01"];
    dataset.days["2026-01-02"] = record;
    delete dataset.days["2026-01-01"];
    dataset.metadata.count = 1;
    const result = validatePanchangaYearDataset(dataset);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/day key must equal record.date/);
  });

  it("rejects a record outside the dataset year", () => {
    const dataset = panchangaDataset(2026, ["2026-01-01"]);
    dataset.days["2026-01-01"] = panchangaRecord("2027-01-01");
    const result = validatePanchangaYearDataset(dataset);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/outside the dataset year/);
  });
});

describe("Panchanga calendar coverage", () => {
  it("enumerates every date, including leap days", () => {
    expect(calendarDatesForYear(2026)).toHaveLength(365);
    expect(calendarDatesForYear(2027)).toHaveLength(365);
    expect(calendarDatesForYear(2028)).toHaveLength(366);
    expect(calendarDatesForYear(2028)).toContain("2028-02-29");
    expect(calendarDatesForYear(2000)).toHaveLength(366);
    expect(calendarDatesForYear(2100)).toHaveLength(365);
    expect(calendarDatesForYear(2026)[0]).toBe("2026-01-01");
    expect(calendarDatesForYear(2026)[364]).toBe("2026-12-31");
  });

  it("accepts a complete normal year", () => {
    const year = 2026;
    const dataset = panchangaDataset(year, calendarDatesForYear(year));
    const result = validateCompletePanchangaYear(dataset, year);
    expect(result.ok).toBe(true);
    expect(result.value?.metadata.count).toBe(365);
  });

  it("rejects a normal year with one missing date", () => {
    const year = 2026;
    const dates = calendarDatesForYear(year).filter((date) => date !== "2026-06-15");
    const dataset = panchangaDataset(year, dates);
    const result = validateCompletePanchangaYear(dataset, year);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("1 of 365 calendar dates are missing");
    expect(result.errors.join(" ")).toContain("2026-06-15");
  });

  it("accepts a complete leap year", () => {
    const year = 2028;
    const dataset = panchangaDataset(year, calendarDatesForYear(year));
    const result = validateCompletePanchangaYear(dataset, year);
    expect(result.ok).toBe(true);
    expect(result.value?.metadata.count).toBe(366);
  });

  it("rejects a leap year missing 29 February", () => {
    const year = 2028;
    const dates = calendarDatesForYear(year).filter((date) => date !== "2028-02-29");
    const dataset = panchangaDataset(year, dates);
    const result = validateCompletePanchangaYear(dataset, year);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("2028-02-29");
  });

  it("rejects duplicate records instead of silently overwriting one", () => {
    const record = panchangaRecord("2026-01-01");
    expect(() =>
      buildPanchangaYearDataset(2026, [record, record], "2026-01-01T00:00:00+05:30")
    ).toThrow(/Duplicate Panchanga record for 2026-01-01/);
  });

  it("keeps invalid and out-of-year rejection in the base validator", () => {
    const invalidKey = panchangaDataset(2026, ["2026-01-01"]);
    invalidKey.days["2026-02-31"] = panchangaRecord("2026-01-01");
    invalidKey.metadata.count = 2;
    expect(validatePanchangaYearDataset(invalidKey).ok).toBe(false);

    const outOfYear = panchangaDataset(2026, ["2026-01-01"]);
    outOfYear.days["2026-01-01"] = panchangaRecord("2027-01-01");
    expect(validatePanchangaYearDataset(outOfYear).ok).toBe(false);
  });
});

describe("Aaradhane dataset validation", () => {
  it("accepts a dataset with all three Raghavendra phases", () => {
    const dataset = aaradhaneDataset(2027, [
      ...raghavendraEvents(2027),
      aaradhaneEvent(2027),
    ]);
    expect(validateAaradhaneYearDataset(dataset, 2027).ok).toBe(true);
  });

  it("rejects duplicate event keys", () => {
    const event = aaradhaneEvent(2027);
    const dataset = aaradhaneDataset(2027, [event, event]);
    const result = validateAaradhaneYearDataset(dataset);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/duplicate eventKey/);
  });

  it("rejects a missing Sri Raghavendra phase", () => {
    const dataset = aaradhaneDataset(2027, raghavendraEvents(2027).slice(0, 2));
    const result = validateAaradhaneYearDataset(dataset);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/missing Uttara/);
  });

  it("rejects an event date outside the dataset year", () => {
    const dataset = aaradhaneDataset(2027, [
      ...raghavendraEvents(2027),
      aaradhaneEvent(2027, { date: "2026-12-31", endDate: "2026-12-31" }),
    ]);
    const result = validateAaradhaneYearDataset(dataset);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/must fall in the dataset year/);
  });
});
