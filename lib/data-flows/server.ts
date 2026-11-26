import "server-only";

/**
 * Server-side entry point for the Storage data flows.
 *
 * This module is the only place that reads the Supabase credentials for a
 * request. It is imported by API routes and AI retrieval code, never by a client
 * component, so the service-role key cannot reach a browser bundle.
 */

import { describeStorageConfig, resolveReadSettings } from "./config";
import { createSupabaseStorage, type ObjectStorage } from "./storage";
import {
  readCurrentPanchanga,
  readDailyPanchanga,
  readYearlyPanchanga,
  type CurrentPanchangaRead,
  type DailyPanchangaRead,
  type YearlyPanchangaRead,
} from "./panchanga-reader";
import {
  readAaradhaneYearDataset,
  readCurrentAaradhaneDataset,
  type AaradhaneDatasetRead,
} from "./aaradhane-reader";
import { getIstDateString } from "./time";

let cachedReadStorage: ObjectStorage | null | undefined;

export function getReadStorage(): ObjectStorage | null {
  if (cachedReadStorage === undefined) {
    const settings = resolveReadSettings();
    cachedReadStorage = settings ? createSupabaseStorage(settings) : null;
  }
  return cachedReadStorage;
}

/** Configuration state for diagnostics. Contains variable names, never values. */
export function dataFlowStorageStatus(): ReturnType<typeof describeStorageConfig>[] {
  return [describeStorageConfig("read"), describeStorageConfig("write")];
}

function unavailablePanchanga(now: Date, error: string): CurrentPanchangaRead {
  return {
    status: "unavailable",
    source: "supabase-storage",
    record: null,
    expectedDate: getIstDateString(now),
    error,
  };
}

export async function getCurrentPanchanga(
  now: Date = new Date()
): Promise<CurrentPanchangaRead> {
  const storage = getReadStorage();
  if (!storage) {
    return unavailablePanchanga(now, "Supabase Storage is not configured for this deployment");
  }
  return readCurrentPanchanga(storage, now);
}

export async function getDailyPanchanga(date: string): Promise<DailyPanchangaRead> {
  const storage = getReadStorage();
  if (!storage) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      record: null,
      date,
      error: "Supabase Storage is not configured for this deployment",
    };
  }
  return readDailyPanchanga(storage, date);
}

export async function getYearlyPanchanga(year: number): Promise<YearlyPanchangaRead> {
  const storage = getReadStorage();
  if (!storage) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      dataset: null,
      year,
      error: "Supabase Storage is not configured for this deployment",
    };
  }
  return readYearlyPanchanga(storage, year);
}

export async function getCurrentAaradhaneDataset(): Promise<AaradhaneDatasetRead> {
  const storage = getReadStorage();
  if (!storage) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      dataset: null,
      year: null,
      error: "Supabase Storage is not configured for this deployment",
    };
  }
  return readCurrentAaradhaneDataset(storage);
}

export async function getAaradhaneYearDataset(year: number): Promise<AaradhaneDatasetRead> {
  const storage = getReadStorage();
  if (!storage) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      dataset: null,
      year,
      error: "Supabase Storage is not configured for this deployment",
    };
  }
  return readAaradhaneYearDataset(storage, year);
}
