import {
  IST,
  addDays,
  businessDate,
  cancelDeadline,
  formatSevaDate,
  hourBuckets,
  istParts,
  istStartOfDay,
  periodRange,
  sevaDateBounds,
} from "@/lib/seva/time";

// now = 2026-10-18T12:30+05:30 (a Sunday)
const now = new Date("2026-10-18T07:00:00Z");

describe("IST time", () => {
  it("names the zone", () => {
    expect(IST).toBe("Asia/Kolkata");
  });

  it("splits a date into IST parts", () => {
    expect(istParts(now)).toEqual({ year: 2026, month: 10, day: 18, hour: 12, minute: 30, weekday: 7 });
  });

  it("businessDate switches at 18:30 UTC", () => {
    expect(businessDate(new Date("2026-10-18T18:29:59Z"))).toBe("2026-10-18");
    expect(businessDate(new Date("2026-10-18T18:30:00Z"))).toBe("2026-10-19");
  });

  it("finds the start of an IST day", () => {
    expect(istStartOfDay("2026-10-18")).toEqual(new Date("2026-10-17T18:30:00.000Z"));
  });

  it("computes like-for-like period ranges", () => {
    expect(periodRange("today", now)).toEqual({
      from: new Date("2026-10-17T18:30:00Z"),
      to: now,
      prevFrom: new Date("2026-10-16T18:30:00Z"),
      prevTo: new Date("2026-10-17T07:00:00Z"),
      bucket: "hour",
    });
    expect(periodRange("week", now).from).toEqual(new Date("2026-10-11T18:30:00Z")); // Monday 12 Oct 00:00 IST
    expect(periodRange("week", now).prevTo).toEqual(new Date("2026-10-11T07:00:00Z")); // last Sunday 12:30 IST
    expect(periodRange("week", now).bucket).toBe("day");
    expect(periodRange("month", now).prevFrom).toEqual(new Date("2026-08-31T18:30:00Z")); // 1 Sep 00:00 IST
    expect(periodRange("month", now).prevTo).toEqual(new Date("2026-09-18T07:00:00Z"));
    expect(periodRange("year", now).from).toEqual(new Date("2025-12-31T18:30:00Z"));
    expect(periodRange("year", now).prevTo).toEqual(new Date("2025-10-18T07:00:00Z"));
    expect(periodRange("year", now).bucket).toBe("month");
    // capped at month end
    expect(periodRange("month", new Date("2026-03-31T04:30:00Z")).prevTo).toEqual(new Date("2026-02-28T18:30:00Z"));
  });

  it("handles a Monday, January and a leap day", () => {
    const mon = new Date("2026-10-11T19:00:00Z"); // Mon 12 Oct 00:30 IST
    expect(periodRange("week", mon).from).toEqual(new Date("2026-10-11T18:30:00Z"));
    expect(periodRange("month", new Date("2027-01-10T00:00:00Z")).prevFrom).toEqual(new Date("2026-11-30T18:30:00Z"));
    // 29 Feb 2028 10:00 IST -> last year capped at the end of 28 Feb 2027
    expect(periodRange("year", new Date("2028-02-29T04:30:00Z")).prevTo).toEqual(new Date("2027-02-28T18:30:00Z"));
  });

  it("lists hour buckets 05..22", () => {
    expect(hourBuckets()).toHaveLength(18);
    expect(hourBuckets()[0]).toBe("05");
    expect(hourBuckets()[17]).toBe("22");
  });

  it("computes seva date bounds and adds days", () => {
    expect(sevaDateBounds("2026-10-18", 365)).toEqual({ min: "2026-10-18", max: "2027-10-18" });
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("formats a seva date", () => {
    expect(formatSevaDate("2027-08-28")).toBe("Sat 28 Aug 2027");
    expect(formatSevaDate("2026-10-05")).toBe("Mon 5 Oct 2026");
  });

  it("computes the cancel deadline", () => {
    expect(cancelDeadline("2026-10-18T05:12:00.000Z", 30)).toEqual(new Date("2026-10-18T05:42:00.000Z"));
  });
});
