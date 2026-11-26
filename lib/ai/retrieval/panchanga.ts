// Panchanga Retrieval - Daily panchanga information
// Single source of truth for panchanga data
//
// Data is read from Supabase Storage through the server-only data-flow layer.
// There is no filesystem read of `public/data/panchanga` and no UTC date
// derivation: "today" is the Asia/Kolkata calendar day.

import { PanchangaData, RetrievedData } from "./types";
import { RetrievalType } from "../intent/types";
import { getCachedPanchanga } from "@/lib/panchanga-cache";
import type { PanchangaRecord } from "@/lib/data-flows/schemas";
import { getIstDateString, isValidDateString } from "@/lib/data-flows/time";
import { getCurrentPanchanga, getDailyPanchanga } from "@/lib/data-flows/server";

let cachedPanchanga: PanchangaData | null = null;
let cachedDate: string | null = null;

function formatTime(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return "\u2014";
  return parsed.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function recordToPanchanga(record: PanchangaRecord): PanchangaData {
  return {
    date: record.date,
    tithi: record.tithi.name,
    nakshatra: `${record.nakshatra.name} (Pada ${record.nakshatra.pada})`,
    yoga: record.yoga.name,
    karana: record.karana.name,
    sunrise: formatTime(record.sun.sunrise),
    sunset: formatTime(record.sun.sunset),
  };
}

function unavailable(date: string): PanchangaData {
  return getCachedPanchanga(date);
}

function cachedResult(now: number): RetrievedData<PanchangaData> {
  return {
    data: cachedPanchanga as PanchangaData,
    source: RetrievalType.REPOSITORY,
    confidence: 100,
    retrievedAt: now,
    fromCache: true,
  };
}

/**
 * Get today's panchanga from Storage.
 *
 * A record from another Asia/Kolkata day is explicitly not used: the reader
 * classifies it as `stale`, and this function returns the placeholder fallback
 * rather than presenting yesterday's Panchanga as today's.
 */
export async function getTodayPanchanga(): Promise<RetrievedData<PanchangaData>> {
  const today = getIstDateString();
  const now = Date.now();

  if (cachedPanchanga && cachedDate === today) {
    return cachedResult(now);
  }

  try {
    const result = await getCurrentPanchanga();
    if (result.status === "ok" && result.record) {
      const panchanga = recordToPanchanga(result.record);
      cachedPanchanga = panchanga;
      cachedDate = today;
      return {
        data: panchanga,
        source: RetrievalType.REPOSITORY,
        confidence: 95,
        retrievedAt: now,
        fromCache: false,
      };
    }

    // stale or unavailable: do not cache, do not fabricate astronomical values.
    return {
      data: unavailable(today),
      source: RetrievalType.FALLBACK,
      confidence: 0,
      retrievedAt: now,
      fromCache: false,
    };
  } catch (error) {
    console.error("[Panchanga Retrieval] Error:", error);
    return {
      data: cachedPanchanga ?? unavailable(today),
      source: RetrievalType.FALLBACK,
      confidence: 0,
      retrievedAt: now,
      fromCache: false,
    };
  }
}

/**
 * Get panchanga for a specific date from the historical daily object.
 */
export async function getPanchangaForDate(
  date: Date
): Promise<RetrievedData<PanchangaData>> {
  const dateStr = getIstDateString(date);
  const now = Date.now();

  if (!isValidDateString(dateStr)) {
    return {
      data: unavailable(dateStr),
      source: RetrievalType.FALLBACK,
      confidence: 0,
      retrievedAt: now,
      fromCache: false,
    };
  }

  if (cachedPanchanga && cachedDate === dateStr) {
    return cachedResult(now);
  }

  try {
    const result = await getDailyPanchanga(dateStr);
    if (result.status === "ok" && result.record) {
      const panchanga = recordToPanchanga(result.record);
      cachedPanchanga = panchanga;
      cachedDate = dateStr;
      return {
        data: panchanga,
        source: RetrievalType.REPOSITORY,
        confidence: 95,
        retrievedAt: now,
        fromCache: false,
      };
    }

    return {
      data: unavailable(dateStr),
      source: RetrievalType.FALLBACK,
      confidence: 0,
      retrievedAt: now,
      fromCache: false,
    };
  } catch (error) {
    console.error("[Panchanga Retrieval] Error:", error);
    return {
      data: cachedPanchanga ?? unavailable(dateStr),
      source: RetrievalType.FALLBACK,
      confidence: 0,
      retrievedAt: now,
      fromCache: false,
    };
  }
}

/**
 * Format panchanga for display
 */
export function formatPanchangaForDisplay(panchanga: PanchangaData): string {
  let text = "\ud83d\udcff **Today's Panchanga:**\n\n";

  text += `| Item | Value |\n`;
  text += `|------|-------|\n`;
  text += `| \ud83d\udcc5 Date | ${panchanga.date} |\n`;
  text += `| \ud83c\udf05 Sunrise | ${panchanga.sunrise} |\n`;
  text += `| \ud83c\udf07 Sunset | ${panchanga.sunset} |\n`;
  text += `| \ud83e\ude94 Tithi | ${panchanga.tithi} |\n`;
  text += `| \u2b50 Nakshatra | ${panchanga.nakshatra} |\n`;
  text += `| \ud83e\uddd8 Yoga | ${panchanga.yoga} |\n`;
  text += `| \u23f0 Karana | ${panchanga.karana} |\n`;

  return text;
}

/**
 * Format panchanga in simple text
 */
export function formatPanchangaSimple(panchanga: PanchangaData): string {
  let text = `\ud83d\udcff **Today's Panchanga (${panchanga.date})**\n\n`;
  text += `\ud83c\udf05 Sunrise: ${panchanga.sunrise}\n`;
  text += `\ud83c\udf07 Sunset: ${panchanga.sunset}\n`;
  text += `\ud83e\ude94 Tithi: ${panchanga.tithi}\n`;
  text += `\u2b50 Nakshatra: ${panchanga.nakshatra}\n`;

  if (panchanga.yoga && panchanga.yoga !== "\u2014") {
    text += `\ud83e\uddd8 Yoga: ${panchanga.yoga}\n`;
  }

  if (panchanga.karana && panchanga.karana !== "\u2014") {
    text += `\u23f0 Karana: ${panchanga.karana}\n`;
  }

  return text;
}

/** Clear panchanga cache */
export function clearPanchangaCache(): void {
  cachedPanchanga = null;
  cachedDate = null;
}
