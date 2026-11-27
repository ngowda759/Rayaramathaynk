/** Read-only Aaradhane dataset access over Supabase Storage. */

import { isValidYear } from "./time";
import { parseJson } from "./json";
import { aaradhaneCurrentPath, aaradhaneYearPath } from "./paths";
import {
  validateAaradhaneYearDataset,
  type AaradhaneYearDataset,
} from "./schemas";
import { isStorageNotFound, type ObjectStorage } from "./storage";

export interface AaradhaneDatasetRead {
  status: "ok" | "unavailable";
  source: "supabase-storage";
  dataset: AaradhaneYearDataset | null;
  year: number | null;
  error?: string;
}

export async function readCurrentAaradhaneDataset(
  storage: ObjectStorage
): Promise<AaradhaneDatasetRead> {
  const result = await storage.getText(aaradhaneCurrentPath());
  if (!result.ok || result.text === null) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      dataset: null,
      year: null,
      error: isStorageNotFound(result)
        ? "Aaradhane current.json has not been published"
        : result.error ?? "Storage read failed",
    };
  }

  const parsed = parseJson(result.text);
  if (!parsed.ok) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      dataset: null,
      year: null,
      error: `Aaradhane current.json is not valid JSON: ${parsed.error}`,
    };
  }

  const validation = validateAaradhaneYearDataset(parsed.value);
  if (!validation.ok || !validation.value) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      dataset: null,
      year: null,
      error: `Aaradhane current.json failed validation: ${validation.errors.join("; ")}`,
    };
  }

  return {
    status: "ok",
    source: "supabase-storage",
    dataset: validation.value,
    year: validation.value.year,
  };
}

export async function readAaradhaneYearDataset(
  storage: ObjectStorage,
  year: number
): Promise<AaradhaneDatasetRead> {
  if (!isValidYear(year)) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      dataset: null,
      year,
      error: "year must be a four-digit year",
    };
  }

  const result = await storage.getText(aaradhaneYearPath(year));
  if (!result.ok || result.text === null) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      dataset: null,
      year,
      error: isStorageNotFound(result)
        ? `No Aaradhane dataset published for ${year}`
        : result.error ?? "Storage read failed",
    };
  }

  const parsed = parseJson(result.text);
  if (!parsed.ok) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      dataset: null,
      year,
      error: `Aaradhane years/${year}.json is not valid JSON: ${parsed.error}`,
    };
  }

  const validation = validateAaradhaneYearDataset(parsed.value, year);
  if (!validation.ok || !validation.value) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      dataset: null,
      year,
      error: `Aaradhane years/${year}.json failed validation: ${validation.errors.join("; ")}`,
    };
  }

  return { status: "ok", source: "supabase-storage", dataset: validation.value, year };
}
