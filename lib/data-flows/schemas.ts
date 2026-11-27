/**
 * Typed contracts for the two Supabase Storage data flows.
 *
 * The Panchanga schema is deliberately the full record the Python generator
 * emits. It is not reduced to the handful of fields the home widget renders:
 * the Aaradhane generator consumes `tithi`, `masa` and `nakshatra`, and the AI
 * retrieval path consumes `yoga`, `karana`, sunrise and sunset. Dropping a field
 * here would silently break one of those consumers.
 */

import { z } from "zod";

import {
  IST_TIME_ZONE,
  calendarDatesForYear,
  isDateInYear,
  isIsoDateTime,
  isIsoTimestamp,
  isValidDateString,
  isValidYear,
  yearOfDate,
} from "./time";

const nonEmpty = z.string().trim().min(1);

const isoDateTime = nonEmpty.refine(isIsoTimestamp, {
  message: "must be an ISO 8601 timestamp with an offset",
});

const isoGenerationTime = nonEmpty.refine(isIsoDateTime, {
  message: "must be an ISO 8601 timestamp",
});

const dateString = nonEmpty.refine(isValidDateString, {
  message: "must be a real YYYY-MM-DD calendar date",
});

const istTimeZone = z.literal(IST_TIME_ZONE);

export const TimeWindowSchema = z.object({
  name: nonEmpty,
  start: isoDateTime,
  end: isoDateTime,
  is_auspicious: z.boolean(),
});

export const PanchangaMetadataSchema = z.object({
  generator: nonEmpty,
  version: nonEmpty,
  generated_at: isoGenerationTime,
  valid_for: dateString,
  timezone: istTimeZone,
});

export const PanchangaLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: istTimeZone,
});

export const PanchangaWeekdaySchema = z.object({
  english: nonEmpty,
  sanskrit: nonEmpty,
  number: z.number().int().min(0).max(7),
});

export const PanchangaSunSchema = z.object({
  sunrise: isoDateTime,
  sunset: isoDateTime,
  day_duration_hours: z.number().positive(),
});

export const PanchangaTithiSchema = z.object({
  number: z.number().int().min(1).max(30),
  name: nonEmpty,
  paksha: z.enum(["Shukla", "Krishna"]),
  start: isoDateTime,
  end: isoDateTime,
});

export const PanchangaNakshatraSchema = z.object({
  number: z.number().int().min(1).max(28),
  name: nonEmpty,
  pada: z.number().int().min(1).max(4),
  lord: nonEmpty,
  start: isoDateTime,
  end: isoDateTime,
});

export const PanchangaYogaSchema = z.object({
  number: z.number().int().min(1).max(27),
  name: nonEmpty,
  start: isoDateTime,
  end: isoDateTime,
});

export const PanchangaKaranaSchema = z.object({
  number: z.number().int().min(1).max(60),
  name: nonEmpty,
  start: isoDateTime,
  end: isoDateTime,
});

export const PanchangaMasaSchema = z.object({
  number: z.number().int().min(1).max(13),
  name: nonEmpty,
  is_adhik: z.boolean(),
  paksha: z.enum(["Shukla", "Krishna"]),
});

export const PanchangaSamvatSchema = z.object({
  vikram: z.number().int().positive(),
  shaka: z.number().int().positive(),
  samvatsara: nonEmpty,
});

export const PanchangaRecordSchema = z
  .object({
    metadata: PanchangaMetadataSchema,
    date: dateString,
    location: PanchangaLocationSchema,
    weekday: PanchangaWeekdaySchema,
    sun: PanchangaSunSchema,
    tithi: PanchangaTithiSchema,
    nakshatra: PanchangaNakshatraSchema,
    yoga: PanchangaYogaSchema,
    karana: PanchangaKaranaSchema,
    masa: PanchangaMasaSchema.nullable(),
    samvat: PanchangaSamvatSchema.nullable(),
    rahu_kalam: TimeWindowSchema.nullable(),
    yama_gandam: TimeWindowSchema.nullable(),
    gulika_kalam: TimeWindowSchema.nullable(),
    abhijit_muhurat: TimeWindowSchema.nullable(),
    durmuhurta: z.array(TimeWindowSchema),
    varjyam: z.array(TimeWindowSchema),
    amrita_kalam: z.array(TimeWindowSchema),
  })
  .refine((record) => record.metadata.valid_for === record.date, {
    message: "metadata.valid_for must equal date",
    path: ["metadata", "valid_for"],
  });

export type PanchangaRecord = z.infer<typeof PanchangaRecordSchema>;

export const PanchangaYearDatasetSchema = z
  .object({
    metadata: z.object({
      generator: nonEmpty,
      version: nonEmpty,
      generated_at: isoGenerationTime,
      timezone: istTimeZone,
      year: z.number().int(),
      count: z.number().int().nonnegative(),
    }),
    year: z.number().int(),
    /** Keyed by `YYYY-MM-DD` so a duplicate date is structurally impossible. */
    days: z.record(z.string(), PanchangaRecordSchema),
  })
  .superRefine((dataset, ctx) => {
    if (!isValidYear(dataset.year)) {
      ctx.addIssue({ code: "custom", message: "year is not a valid year", path: ["year"] });
    }
    if (dataset.metadata.year !== dataset.year) {
      ctx.addIssue({
        code: "custom",
        message: "metadata.year must equal year",
        path: ["metadata", "year"],
      });
    }
    const entries = Object.entries(dataset.days);
    if (entries.length !== dataset.metadata.count) {
      ctx.addIssue({
        code: "custom",
        message: "metadata.count must equal the number of days",
        path: ["metadata", "count"],
      });
    }
    for (const [key, record] of entries) {
      if (!isValidDateString(key)) {
        ctx.addIssue({ code: "custom", message: `invalid day key ${key}`, path: ["days", key] });
        continue;
      }
      if (key !== record.date) {
        ctx.addIssue({
          code: "custom",
          message: "day key must equal record.date",
          path: ["days", key, "date"],
        });
      }
      if (!isDateInYear(record.date, dataset.year)) {
        ctx.addIssue({
          code: "custom",
          message: "record date is outside the dataset year",
          path: ["days", key, "date"],
        });
      }
    }
  });

export type PanchangaYearDataset = z.infer<typeof PanchangaYearDatasetSchema>;

export const AaradhaneEventSchema = z.object({
  eventKey: nonEmpty,
  title: nonEmpty,
  description: z.string(),
  guru: nonEmpty,
  category: z.literal("Aaradhane"),
  date: dateString,
  endDate: dateString,
  allDay: z.boolean(),
  featured: z.boolean(),
  published: z.boolean(),
  autoGenerated: z.boolean(),
  year: z.number().int(),
  paramparaNumber: z.number().int().positive(),
  raghavendraPhase: z.enum(["Poorva", "Madhya", "Uttara"]).optional(),
  lunarCalendar: z.object({
    lunarMonth: nonEmpty,
    paksha: nonEmpty,
    tithi: nonEmpty,
    tithiNumber: z.number().int().min(1).max(30),
  }),
  importance: z.enum(["major", "minor"]),
  rituals: z.array(z.string()).optional(),
  offerings: z.array(z.string()).optional(),
  significance: z.string().optional(),
  guruName: z.string().optional(),
});

export type AaradhaneEvent = z.infer<typeof AaradhaneEventSchema>;

export const AaradhaneYearDatasetSchema = z
  .object({
    metadata: z.object({
      generator: nonEmpty,
      version: nonEmpty,
      generated_at: isoGenerationTime,
      timezone: istTimeZone,
      year: z.number().int(),
      eventCount: z.number().int().nonnegative(),
      panchangaObjectPath: nonEmpty,
    }),
    year: z.number().int(),
    events: z.array(AaradhaneEventSchema),
  })
  .superRefine((dataset, ctx) => {
    if (!isValidYear(dataset.year)) {
      ctx.addIssue({ code: "custom", message: "year is not a valid year", path: ["year"] });
      return;
    }
    if (dataset.metadata.year !== dataset.year) {
      ctx.addIssue({
        code: "custom",
        message: "metadata.year must equal year",
        path: ["metadata", "year"],
      });
    }
    if (dataset.metadata.eventCount !== dataset.events.length) {
      ctx.addIssue({
        code: "custom",
        message: "metadata.eventCount must equal the number of events",
        path: ["metadata", "eventCount"],
      });
    }

    const seen = new Set<string>();
    for (const [index, event] of dataset.events.entries()) {
      if (seen.has(event.eventKey)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate eventKey ${event.eventKey}`,
          path: ["events", index, "eventKey"],
        });
      }
      seen.add(event.eventKey);

      if (event.year !== dataset.year) {
        ctx.addIssue({
          code: "custom",
          message: "event.year must equal dataset.year",
          path: ["events", index, "year"],
        });
      }
      if (yearOfDate(event.date) !== dataset.year) {
        ctx.addIssue({
          code: "custom",
          message: "event.date must fall in the dataset year",
          path: ["events", index, "date"],
        });
      }
      if (event.endDate < event.date) {
        ctx.addIssue({
          code: "custom",
          message: "event.endDate must not precede event.date",
          path: ["events", index, "endDate"],
        });
      }
    }

    const raghavendra = dataset.events.filter((event) => event.guru === "Sri Raghavendra Swamy");
    if (raghavendra.length > 0) {
      const phases = new Set(raghavendra.map((event) => event.raghavendraPhase));
      for (const phase of ["Poorva", "Madhya", "Uttara"] as const) {
        if (!phases.has(phase)) {
          ctx.addIssue({
            code: "custom",
            message: `missing ${phase} Aaradhane for Sri Raghavendra Swamy`,
            path: ["events"],
          });
        }
      }
    }
  });

export type AaradhaneYearDataset = z.infer<typeof AaradhaneYearDatasetSchema>;

export interface ValidationResult<T> {
  ok: boolean;
  value: T | null;
  errors: string[];
}

function toResult<T>(parsed: z.ZodSafeParseResult<T>): ValidationResult<T> {
  if (parsed.success) return { ok: true, value: parsed.data, errors: [] };
  return {
    ok: false,
    value: null,
    errors: parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    }),
  };
}

export function validatePanchangaRecord(
  input: unknown,
  expectedDate?: string
): ValidationResult<PanchangaRecord> {
  const parsed = PanchangaRecordSchema.safeParse(input);
  const result = toResult(parsed);
  if (result.ok && result.value && expectedDate) {
    if (!isValidDateString(expectedDate)) {
      return { ok: false, value: null, errors: ["expectedDate is not a valid date"] };
    }
    if (result.value.date !== expectedDate) {
      return {
        ok: false,
        value: null,
        errors: [`record.date ${result.value.date} does not match expected date ${expectedDate}`],
      };
    }
  }
  return result;
}

export function validatePanchangaYearDataset(
  input: unknown,
  expectedYear?: number
): ValidationResult<PanchangaYearDataset> {
  const parsed = PanchangaYearDatasetSchema.safeParse(input);
  const result = toResult(parsed);
  if (result.ok && result.value && expectedYear !== undefined) {
    if (!isValidYear(expectedYear)) {
      return { ok: false, value: null, errors: ["expectedYear is not a valid year"] };
    }
    if (result.value.year !== expectedYear) {
      return {
        ok: false,
        value: null,
        errors: [`dataset.year ${result.value.year} does not match expected year ${expectedYear}`],
      };
    }
  }
  return result;
}

/**
 * A complete-year dataset has exactly one record for every calendar date in its
 * year, including 29 February in leap years.
 *
 * This is separate from `validatePanchangaYearDataset` because the daily
 * publisher builds a partial year as the year progresses. Only bulk imports and
 * historical publication must satisfy full coverage; missing days are never
 * filled with placeholder astronomy.
 */
export function validateCompletePanchangaYear(
  input: unknown,
  expectedYear?: number
): ValidationResult<PanchangaYearDataset> {
  const base = validatePanchangaYearDataset(input, expectedYear);
  if (!base.ok || !base.value) return base;

  const dataset = base.value;
  const expectedDates = calendarDatesForYear(dataset.year);
  const expected = new Set(expectedDates);
  const missing = expectedDates.filter((date) => !(date in dataset.days));
  const unexpected = Object.keys(dataset.days).filter((date) => !expected.has(date));

  const errors: string[] = [];
  if (missing.length > 0) {
    const preview = missing.slice(0, 10).join(", ");
    errors.push(
      `incomplete year ${dataset.year}: ${missing.length} of ${expectedDates.length} calendar dates are missing (${preview}${missing.length > 10 ? ", ..." : ""})`
    );
  }
  if (unexpected.length > 0) {
    const preview = unexpected.slice(0, 10).join(", ");
    errors.push(
      `year ${dataset.year} contains ${unexpected.length} date(s) outside its calendar (${preview}${unexpected.length > 10 ? ", ..." : ""})`
    );
  }

  if (errors.length > 0) return { ok: false, value: null, errors };
  return base;
}

export function validateAaradhaneYearDataset(
  input: unknown,
  expectedYear?: number
): ValidationResult<AaradhaneYearDataset> {
  const parsed = AaradhaneYearDatasetSchema.safeParse(input);
  const result = toResult(parsed);
  if (result.ok && result.value && expectedYear !== undefined) {
    if (!isValidYear(expectedYear)) {
      return { ok: false, value: null, errors: ["expectedYear is not a valid year"] };
    }
    if (result.value.year !== expectedYear) {
      return {
        ok: false,
        value: null,
        errors: [`dataset.year ${result.value.year} does not match expected year ${expectedYear}`],
      };
    }
  }
  return result;
}

/** True when a current record belongs to the Asia/Kolkata day `expectedDate`. */
export function isCurrentPanchangaRecord(
  record: PanchangaRecord,
  expectedDate: string
): boolean {
  return record.date === expectedDate && record.metadata.valid_for === expectedDate;
}

/** Build a yearly dataset from already-validated records. */
export function buildPanchangaYearDataset(
  year: number,
  records: PanchangaRecord[],
  generatedAt: string,
  generator = "Rayara Panchanga Engine",
  version = "1.0.0"
): PanchangaYearDataset {
  const days: Record<string, PanchangaRecord> = {};
  for (const record of records) {
    if (days[record.date]) {
      throw new Error(`Duplicate Panchanga record for ${record.date}`);
    }
    days[record.date] = record;
  }
  return {
    metadata: {
      generator,
      version,
      generated_at: generatedAt,
      timezone: IST_TIME_ZONE,
      year,
      count: Object.keys(days).length,
    },
    year,
    days,
  };
}

/** Build an Aaradhane yearly dataset from generated events. */
export function buildAaradhaneYearDataset(
  year: number,
  events: AaradhaneEvent[],
  panchangaObjectPath: string,
  generatedAt: string,
  generator = "Aaradhane Generator",
  version = "1.0.0"
): AaradhaneYearDataset {
  return {
    metadata: {
      generator,
      version,
      generated_at: generatedAt,
      timezone: IST_TIME_ZONE,
      year,
      eventCount: events.length,
      panchangaObjectPath,
    },
    year,
    events,
  };
}

/**
 * A yearly dataset embeds the wall-clock `metadata.generated_at` of the run that
 * produced it, so re-importing unchanged source data yields a dataset that
 * differs only in that field. Publishers compare this stripped form when they
 * decide whether a published object is already up to date, so a re-run after a
 * partial import neither refuses the existing object nor rewrites it (and, for
 * Aaradhane, does not create a pointless snapshot).
 */
export function withoutGeneratedAt(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const metadata = record.metadata;
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) return value;
  const { generated_at: _generatedAt, ...rest } = metadata as Record<string, unknown>;
  return { ...record, metadata: rest };
}
