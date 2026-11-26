/**
 * Panchanga utilities for Aaradhane event generation
 * 
 * Loads Panchanga data for a given year and provides functions to match
 * lunar calendar dates (tithi, paksha, lunar month) to Gregorian dates.
 */

import type { PanchangaYearDataset } from "@/lib/data-flows/schemas";

// Location constants for Panchanga calculation
export const LOCATION = {
  latitude: 13.1005,
  longitude: 77.5963,
  timezone: "Asia/Kolkata",
} as const;

/**
 * Tithi representation from Panchanga data
 */
export interface PanchangaTithi {
  number: number;
  name: string;
  paksha: "Shukla" | "Krishna";
  start: string;
  end: string;
}

/**
 * Lunar month representation from Panchanga data
 */
export interface PanchangaMasa {
  number: number;
  name: string;
  is_adhik: boolean;
  paksha: "Shukla" | "Krishna";
}

/**
 * Single day's Panchanga data
 */
export interface DailyPanchanga {
  date: string; // YYYY-MM-DD format
  tithi: PanchangaTithi;
  masa: PanchangaMasa;
  nakshatra: {
    number: number;
    name: string;
    pada: number;
    lord: string;
    start: string;
    end: string;
  };
}

/**
 * Yearly Panchanga cache - maps date string to daily data
 */
export type YearlyPanchanga = Map<string, DailyPanchanga>;

/**
 * Convert a validated yearly Storage dataset into the map the Aaradhane
 * generator consumes.
 *
 * This is the only adapter between the two flows: Aaradhane generation never
 * reads `data/panchanga/**` or `public/data/panchanga/**`. The yearly dataset is
 * loaded from Supabase Storage by the caller and passed in here.
 */
export function yearlyPanchangaFromDataset(
  dataset: PanchangaYearDataset
): YearlyPanchanga {
  const yearlyData = new Map<string, DailyPanchanga>();

  for (const [date, data] of Object.entries(dataset.days)) {
    if (!data.masa) continue;
    yearlyData.set(date, {
      date: data.date,
      tithi: data.tithi,
      masa: data.masa,
      nakshatra: data.nakshatra,
    });
  }

  return yearlyData;
}

/**
 * Find Gregorian dates that match a specific lunar calendar date
 * 
 * @param yearlyData - Yearly Panchanga data
 * @param lunarMonth - Hindu lunar month name
 * @param paksha - Shukla (waxing) or Krishna (waning)
 * @param tithiNumber - Tithi number (1-30)
 * @param durationDays - Number of days for the event (default 1)
 * @returns Array of Gregorian dates
 */
export function findDatesForLunarDate(
  yearlyData: YearlyPanchanga,
  lunarMonth: string,
  paksha: "Shukla" | "Krishna",
  tithiNumber: number,
  durationDays: number = 1
): string[] {
  const matchingDates: string[] = [];
  
  for (const [, dailyData] of yearlyData) {
    // Skip if masa data is missing
    if (!dailyData.masa) {
      continue;
    }
    
    // Normalize masa names for comparison (handle unicode variations)
    const normalizedMasaName = normalizeMasaName(dailyData.masa.name);
    const normalizedLunarMonth = normalizeMasaName(lunarMonth);
    
    // Check if masa (lunar month) matches
    if (normalizedMasaName !== normalizedLunarMonth) {
      continue;
    }
    
    // Check if paksha matches
    if (dailyData.tithi.paksha !== paksha) {
      continue;
    }
    
    // Tithi matching with paksha consideration
    // The tithi.number in Panchanga data uses continuous numbering:
    // - Shukla: 1-15 (Pratipada to Purnima)
    // - Krishna: 16-30 (Pratipada to Amavasya)
    // 
    // The guru data uses simplified tithi numbers (1-15) regardless of paksha
    // We need to convert for Krishna paksha
    let expectedTithiNumber = tithiNumber;
    if (paksha === "Krishna") {
      // For Krishna paksha, add 15 to get the actual tithi number
      expectedTithiNumber = 15 + tithiNumber;
    }
    
    if (dailyData.tithi.number === expectedTithiNumber) {
      matchingDates.push(dailyData.date);
    }
  }
  
  // If duration > 1 and we found a match, return consecutive days starting from first match
  if (durationDays > 1 && matchingDates.length > 0) {
    const result: string[] = [];
    const firstDate = matchingDates[0];
    
    if (firstDate) {
      result.push(firstDate);
      
      // Add subsequent days
      for (let i = 1; i < durationDays; i++) {
        const date = new Date(firstDate);
        date.setDate(date.getDate() + i);
        result.push(date.toISOString().slice(0, 10));
      }
      
      return result;
    }
  }
  
  // For single day events, return just the first matching date
  return matchingDates.slice(0, 1);
}

/**
 * Normalize masa (lunar month) names for comparison
 * Handles unicode variations like 'Āṣāḍha' vs 'Ashadha'
 */
function normalizeMasaName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .trim();
}

/**
 * Get the full date range string for an event
 */
export function getDateRangeString(startDate: string, durationDays: number): string {
  if (durationDays === 1) {
    return formatDate(startDate);
  }
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays - 1);
  
  return `${formatDate(startDate)} - ${formatDate(endDate.toISOString().slice(0, 10))}`;
}

/**
 * Format a date string to human-readable format
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * Get tithi display name
 * 
 * Note: Tithi numbers are 1-30 for Shukla (1-15) and Krishna (16-30)
 * Shukla: 1=Pratipada to 15=Purnima
 * Krishna: 16=Pratipada to 30=Amavasya
 */
export function getTithiDisplayName(paksha: "Shukla" | "Krishna", tithiNumber: number): string {
  // Validate tithi number is within valid range
  if (tithiNumber < 1 || tithiNumber > 30) {
    return `Tithi ${tithiNumber}`;
  }
  
  const shuklaNames = [
    "Pratipada", "Dvitiya", "Tṛtiya", "Chaturthi", "Panchami",
    "Shashti", "Saptami", "Ashtami", "Navami", "Dashami",
    "Ekadashi", "Dvadashi", "Trayodashi", "Chaturdashi", "Purnima"
  ];
  
  const krishnaNames = [
    "Pratipada", "Dvitiya", "Tṛtiya", "Chaturthi", "Panchami",
    "Shashti", "Saptami", "Ashtami", "Navami", "Dashami",
    "Ekadashi", "Dvadashi", "Trayodashi", "Chaturdashi", "Amavasya"
  ];
  
  const names = paksha === "Shukla" ? shuklaNames : krishnaNames;
  // Normalize to 0-based index within paksha
  // Shukla: 1-15 maps to 0-14
  // Krishna: 16-30 maps to 0-14
  const indexWithinPaksha = (tithiNumber - 1) % 15;
  
  return names[indexWithinPaksha] || `Tithi ${tithiNumber}`;
}
