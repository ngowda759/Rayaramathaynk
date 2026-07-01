// Simple panchanga cache for fallback when external API is unavailable
// In production, this could be populated from a database or external service

import { Timestamp } from "firebase/firestore";

export interface PanchangaData {
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  sunrise: string;
  sunset: string;
  date: string; // YYYY-MM-DD format
}

// Sample panchanga data (cycling through common values)
const SAMPLE_PANCHANGAS: PanchangaData[] = [
  {
    tithi: "Krishna Trayodashi",
    nakshatra: "Ashwini",
    yoga: "Ashwini Yoga",
    karana: "Kaulava",
    sunrise: "06:15 AM",
    sunset: "06:30 PM",
    date: "",
  },
  {
    tithi: "Krishna Chaturdashi",
    nakshatra: "Bharani",
    yoga: "Brahma Yoga",
    karana: "Taitila",
    sunrise: "06:16 AM",
    sunset: "06:29 PM",
    date: "",
  },
  {
    tithi: "Shukla Pratipad",
    nakshatra: "Krittika",
    yoga: "Soma Yoga",
    karana: "Gara",
    sunrise: "06:17 AM",
    sunset: "06:28 PM",
    date: "",
  },
  {
    tithi: "Shukla Dvitiya",
    nakshatra: "Rohini",
    yoga: "Siddhi Yoga",
    karana: "Vanij",
    sunrise: "06:18 AM",
    sunset: "06:27 PM",
    date: "",
  },
  {
    tithi: "Shukla Tritiya",
    nakshatra: "Mrigashirsha",
    yoga: "Sukha Yoga",
    karana: "Vishti",
    sunrise: "06:19 AM",
    sunset: "06:26 PM",
    date: "",
  },
];

/**
 * Get cached panchanga for a given date.
 * Uses a deterministic algorithm to select from sample data based on date.
 */
export function getCachedPanchanga(date?: string): PanchangaData {
  const dateStr = date ?? new Date().toISOString().slice(0, 10);

  // Use date hash to deterministically select a panchanga
  const hash = dateStr.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const index = hash % SAMPLE_PANCHANGAS.length;

  return {
    ...SAMPLE_PANCHANGAS[index],
    date: dateStr,
  };
}

/**
 * Get panchanga with fallback to cached data
 */
export function getPanchangaWithFallback(
  liveData?: Partial<PanchangaData>
): PanchangaData {
  if (
    liveData?.tithi &&
    liveData.nakshatra &&
    liveData.sunrise &&
    liveData.sunset
  ) {
    return {
      tithi: liveData.tithi,
      nakshatra: liveData.nakshatra,
      yoga: liveData.yoga ?? "—",
      karana: liveData.karana ?? "—",
      sunrise: liveData.sunrise,
      sunset: liveData.sunset,
      date: liveData.date ?? new Date().toISOString().slice(0, 10),
    };
  }

  return getCachedPanchanga(liveData?.date);
}
