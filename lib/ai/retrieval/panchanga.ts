// Panchanga Retrieval - Daily panchanga information
// Single source of truth for panchanga data

import { PanchangaData, RetrievedData } from "./types";
import { RetrievalType } from "../intent/types";
import { getCachedPanchanga, PanchangaData as CachedPanchanga } from "@/lib/panchanga-cache";

// Cache for panchanga
let cachedPanchanga: PanchangaData | null = null;
let cachedDate: string | null = null;

/**
 * Get panchanga date string
 */
function getDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Convert cached panchanga format to our format
 */
function convertPanchanga(cached: CachedPanchanga): PanchangaData {
  return {
    date: cached.date,
    tithi: cached.tithi,
    nakshatra: cached.nakshatra,
    yoga: cached.yoga,
    karana: cached.karana,
    sunrise: cached.sunrise,
    sunset: cached.sunset,
  };
}

/**
 * Try to load panchanga from JSON file
 */
async function loadFromJsonFile(date: string): Promise<PanchangaData | null> {
  try {
    // Expected path: public/data/panchanga/{year}/{year}-{month}-{day}.json
    const [year, month, day] = date.split("-");
    const response = await fetch(`/data/panchanga/${year}/${date}.json`);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return {
      date,
      tithi: data.tithi || "—",
      nakshatra: data.nakshatra || "—",
      yoga: data.yoga || "—",
      karana: data.karana || "—",
      sunrise: data.sunrise || "—",
      sunset: data.sunset || "—",
    };
  } catch (error) {
    console.error("[Panchanga Retrieval] Error loading from JSON:", error);
    return null;
  }
}

/**
 * Get today's panchanga
 */
export async function getTodayPanchanga(): Promise<RetrievedData<PanchangaData>> {
  const today = getDateString();
  const now = Date.now();

  // Check cache
  if (cachedPanchanga && cachedDate === today) {
    return {
      data: cachedPanchanga,
      source: RetrievalType.REPOSITORY,
      confidence: 100,
      retrievedAt: now,
      fromCache: true,
    };
  }

  try {
    // Try to load from JSON file
    let panchanga = await loadFromJsonFile(today);
    
    if (!panchanga) {
      // Use cached/fallback if JSON not available
      const cached = getCachedPanchanga(today);
      panchanga = convertPanchanga(cached);
    }

    cachedPanchanga = panchanga;
    cachedDate = today;

    return {
      data: panchanga,
      source: RetrievalType.REPOSITORY,
      confidence: panchanga.tithi !== "—" ? 95 : 50,
      retrievedAt: now,
      fromCache: false,
    };
  } catch (error) {
    console.error("[Panchanga Retrieval] Error:", error);
    
    // Return cached or default
    const fallback = cachedPanchanga || convertPanchanga(getCachedPanchanga(today));
    
    return {
      data: fallback,
      source: RetrievalType.FALLBACK,
      confidence: 50,
      retrievedAt: now,
      fromCache: false,
    };
  }
}

/**
 * Get panchanga for a specific date
 */
export async function getPanchangaForDate(
  date: Date
): Promise<RetrievedData<PanchangaData>> {
  const dateStr = getDateString(date);
  const now = Date.now();

  // Check cache
  if (cachedPanchanga && cachedDate === dateStr) {
    return {
      data: cachedPanchanga,
      source: RetrievalType.REPOSITORY,
      confidence: 100,
      retrievedAt: now,
      fromCache: true,
    };
  }

  try {
    let panchanga = await loadFromJsonFile(dateStr);
    
    if (!panchanga) {
      const cached = getCachedPanchanga(dateStr);
      panchanga = convertPanchanga(cached);
    }

    cachedPanchanga = panchanga;
    cachedDate = dateStr;

    return {
      data: panchanga,
      source: RetrievalType.REPOSITORY,
      confidence: panchanga.tithi !== "—" ? 95 : 50,
      retrievedAt: now,
      fromCache: false,
    };
  } catch (error) {
    console.error("[Panchanga Retrieval] Error:", error);
    
    return {
      data: cachedPanchanga || convertPanchanga(getCachedPanchanga(dateStr)),
      source: RetrievalType.FALLBACK,
      confidence: 50,
      retrievedAt: now,
      fromCache: false,
    };
  }
}

/**
 * Format panchanga for display
 */
export function formatPanchangaForDisplay(panchanga: PanchangaData): string {
  let text = "📿 **Today's Panchanga:**\n\n";
  
  text += `| Item | Value |\n`;
  text += `|------|-------|\n`;
  text += `| 📅 Date | ${panchanga.date} |\n`;
  text += `| 🌅 Sunrise | ${panchanga.sunrise} |\n`;
  text += `| 🌇 Sunset | ${panchanga.sunset} |\n`;
  text += `| 🪔 Tithi | ${panchanga.tithi} |\n`;
  text += `| ⭐ Nakshatra | ${panchanga.nakshatra} |\n`;
  text += `| 🧘 Yoga | ${panchanga.yoga} |\n`;
  text += `| ⏰ Karana | ${panchanga.karana} |\n`;
  
  return text;
}

/**
 * Format panchanga in simple text
 */
export function formatPanchangaSimple(panchanga: PanchangaData): string {
  let text = `📿 **Today's Panchanga (${panchanga.date})**\n\n`;
  text += `🌅 Sunrise: ${panchanga.sunrise}\n`;
  text += `🌇 Sunset: ${panchanga.sunset}\n`;
  text += `🪔 Tithi: ${panchanga.tithi}\n`;
  text += `⭐ Nakshatra: ${panchanga.nakshatra}\n`;
  
  if (panchanga.yoga && panchanga.yoga !== "—") {
    text += `🧘 Yoga: ${panchanga.yoga}\n`;
  }
  
  if (panchanga.karana && panchanga.karana !== "—") {
    text += `⏰ Karana: ${panchanga.karana}\n`;
  }
  
  return text;
}

/**
 * Clear panchanga cache
 */
export function clearPanchangaCache(): void {
  cachedPanchanga = null;
  cachedDate = null;
}
