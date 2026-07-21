// Panchanga Retrieval - Daily panchanga information
// Single source of truth for panchanga data

import { PanchangaData, RetrievedData } from "./types";
import { RetrievalType } from "../intent/types";
import { getCachedPanchanga, PanchangaData as CachedPanchanga } from "@/lib/panchanga-cache";
import * as fs from 'fs';
import * as path from 'path';

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
function loadFromJsonFile(date: string): PanchangaData | null {
  try {
    // Try current.json first (contains today's panchanga)
    const currentPath = path.join(process.cwd(), 'public', 'data', 'panchanga', 'current.json');
    
    if (fs.existsSync(currentPath)) {
      const content = fs.readFileSync(currentPath, 'utf-8');
      const data = JSON.parse(content);
      
      // Extract and format times from ISO strings (with India timezone)
      const formatTime = (isoString: string | undefined) => {
        if (!isoString) return "—";
        const d = new Date(isoString);
        return d.toLocaleTimeString('en-IN', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
      };
      
      return {
        date: data.date || date,
        tithi: data.tithi?.name || "—",
        nakshatra: data.nakshatra?.name ? `${data.nakshatra.name} (Pada ${data.nakshatra.pada})` : "—",
        yoga: data.yoga?.name || "—",
        karana: data.karana?.name || "—",
        sunrise: formatTime(data.sun?.sunrise),
        sunset: formatTime(data.sun?.sunset),
      };
    }
    
    return null;
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
    let panchanga = loadFromJsonFile(today);
    
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
    let panchanga = loadFromJsonFile(dateStr);
    
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
