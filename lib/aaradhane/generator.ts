/**
 * Aaradhane Event Generator Service
 * 
 * Generates Guru Aaradhane events for a given year based on Hindu Panchanga.
 * Reads lunar calendar data from Firestore (guruParampara collection).
 * Automatically creates or updates events in Firestore.
 */

import { Timestamp } from "firebase/firestore";
import {
  loadYearlyPanchanga,
  hasYearlyPanchanga,
  findDatesForLunarDate,
  getDateRangeString,
  YearlyPanchanga,
} from "./panchanga";
import {
  getGuruParamparaRecords,
  hasGuruParamparaData,
} from "./firestore-source";
import {
  GeneratedAaradhaneEvent,
  GenerateResult,
  GeneratorConfig,
  FirestoreEventDocument,
  GuruParamparaRecord,
} from "@/types/aaradhane-generator";

// Default configuration
const DEFAULT_CONFIG: Partial<GeneratorConfig> = {
  updateExisting: true,
  autoPublish: true,
  autoFeature: false,
  location: "Sri Raghavendra Swamy Matha, Yelahanka, Bangalore",
};

/**
 * Generate all Aaradhane events for a given year
 * Reads Guru Parampara data from Firestore
 */
export async function generateAaradhanaeEvents(
  year: number,
  config?: Partial<GeneratorConfig>
): Promise<GenerateResult> {
  const finalConfig: GeneratorConfig = {
    year,
    updateExisting: config?.updateExisting ?? DEFAULT_CONFIG.updateExisting!,
    autoPublish: config?.autoPublish ?? DEFAULT_CONFIG.autoPublish!,
    autoFeature: config?.autoFeature ?? DEFAULT_CONFIG.autoFeature!,
    location: config?.location ?? DEFAULT_CONFIG.location!,
  };
  
  // Check if Guru Parampara data exists in Firestore
  const hasSourceData = await hasGuruParamparaData();
  if (!hasSourceData) {
    throw new Error(
      `Guru Parampara Aaradhane data not found in Firestore. ` +
      `Please run 'npm run seed:guru-parampara' to initialize the data.`
    );
  }
  
  // Check if Panchanga data exists
  if (!hasYearlyPanchanga(year)) {
    throw new Error(
      `Panchanga data not found for year ${year}. ` +
      `Please ensure data exists in data/panchanga/${year}/ directory. ` +
      `Run 'python scripts/generate_panchanga.py' to generate the data.`
    );
  }
  
  // Load Guru Parampara data from Firestore
  const guruRecords = await getGuruParamparaRecords();
  
  if (guruRecords.length === 0) {
    throw new Error(
      "No enabled Guru Parampara records found in Firestore. " +
      "Please add Guru records with lunar calendar data."
    );
  }
  
  // Load Panchanga data
  const yearlyPanchanga = loadYearlyPanchanga(year);
  
  // Generate events for each Guru
  const events: GeneratedAaradhaneEvent[] = [];
  let raghavendraCount = 0;
  let majorCount = 0;
  let minorCount = 0;
  
  for (const guru of guruRecords) {
    const generatedEvent = generateSingleEvent(guru, yearlyPanchanga, year, finalConfig);
    
    if (generatedEvent) {
      events.push(generatedEvent);
      
      if (guru.guruName === "Sri Raghavendra Swamy") {
        raghavendraCount++;
      }
      if (guru.importance === "major") {
        majorCount++;
      } else {
        minorCount++;
      }
    }
  }
  
  return {
    events,
    summary: {
      total: events.length,
      raghavendraCount,
      majorCount,
      minorCount,
    },
  };
}

/**
 * Generate events from a list of Guru records (without Firestore dependency)
 * This is useful for local development and testing
 */
export function generateEventsFromGurus(
  guruRecords: GuruParamparaRecord[],
  yearlyPanchanga: YearlyPanchanga,
  year: number,
  config?: Partial<GeneratorConfig>
): GenerateResult {
  const finalConfig: GeneratorConfig = {
    year,
    updateExisting: config?.updateExisting ?? DEFAULT_CONFIG.updateExisting!,
    autoPublish: config?.autoPublish ?? DEFAULT_CONFIG.autoPublish!,
    autoFeature: config?.autoFeature ?? DEFAULT_CONFIG.autoFeature!,
    location: config?.location ?? DEFAULT_CONFIG.location!,
  };
  
  // Filter enabled Gurus
  const enabledGurus = guruRecords.filter(g => g.enabled);
  
  if (enabledGurus.length === 0) {
    throw new Error(
      "No enabled Guru records found. " +
      "Please check the input data."
    );
  }
  
  // Generate events for each Guru
  const events: GeneratedAaradhaneEvent[] = [];
  let raghavendraCount = 0;
  let majorCount = 0;
  let minorCount = 0;
  
  for (const guru of enabledGurus) {
    const generatedEvent = generateSingleEvent(guru, yearlyPanchanga, year, finalConfig);
    
    if (generatedEvent) {
      events.push(generatedEvent);
      
      if (guru.guruName === "Sri Raghavendra Swamy") {
        raghavendraCount++;
      }
      if (guru.importance === "major") {
        majorCount++;
      } else {
        minorCount++;
      }
    }
  }
  
  return {
    events,
    summary: {
      total: events.length,
      raghavendraCount,
      majorCount,
      minorCount,
    },
  };
}

/**
 * Generate a single Aaradhane event
 */
function generateSingleEvent(
  guru: GuruParamparaRecord,
  yearlyPanchanga: YearlyPanchanga,
  year: number,
  config: GeneratorConfig
): GeneratedAaradhaneEvent | null {
  // Find the Gregorian dates for this lunar calendar date
  const dates = findDatesForLunarDate(
    yearlyPanchanga,
    guru.lunarMonth,
    guru.paksha,
    guru.tithiNumber,
    guru.durationDays
  );
  
  // If no date found, skip this Guru for this year
  if (dates.length === 0) {
    console.warn(
      `Warning: Could not find matching date for ${guru.guruName} ` +
      `(${guru.lunarMonth} ${guru.paksha} ${guru.tithi}) in year ${year}`
    );
    return null;
  }
  
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  
  // Generate unique event key for deduplication
  const eventKey = `${guru.id}-${year}`;
  
  // Build description
  const description = buildEventDescription(guru, dates, year);
  
  // Determine if this should be featured (major events get featured by default)
  const featured = config.autoFeature && guru.importance === "major";
  
  // Default rituals and offerings for Aaradhane events
  const defaultRituals = [
    "ಪಂಚಾಮೃತ ಅಭಿಷೇಕ ಪೂಜೆ",
    "ಅಲಂಕಾರ ಬ್ರಾಹ್ಮಣ ಸೇವಾ ಮಹಾಮಂಗಳಾರತಿ",
    "ಸೇವಾರ್ಥಿಗಳಿಗೆ ತೀರ್ಥ ಪ್ರಸಾದ"
  ];
  
  const defaultOfferings = [
    "ತೀರ್ಥ ಪ್ರಸಾದ",
    "ಬೆಳ್ಳಿ ಹೂವು",
    "ಕರ್ಪೂರ",
    "ಸಂತೆ"
  ];
  
  return {
    eventKey,
    title: guru.aaradhaneTitle,
    description,
    guru: guru.guruName,
    category: "Aaradhane",
    date: startDate,
    endDate,
    allDay: true,
    featured,
    published: config.autoPublish,
    autoGenerated: true,
    year,
    paramparaNumber: guru.paramparaNumber,
    lunarCalendar: {
      lunarMonth: guru.lunarMonth,
      paksha: guru.paksha,
      tithi: guru.tithi,
      tithiNumber: guru.tithiNumber,
    },
    raghavendraPhase: guru.raghavendraPhase,
    importance: guru.importance,
    rituals: guru.rituals || defaultRituals,
    offerings: guru.offerings || defaultOfferings,
  };
}

/**
 * Build a detailed description for the event
 */
function buildEventDescription(
  guru: GuruParamparaRecord,
  dates: string[],
  year: number
): string {
  const dateRange = getDateRangeString(dates[0], dates.length);
  
  let description = `${guru.aaradhaneTitle} falls on ${dateRange} in ${year}.\n\n`;
  
  // Add lunar calendar details
  description += `Lunar Calendar: ${guru.lunarMonth} ${guru.paksha} ${guru.tithi} (Tithi ${guru.tithiNumber})\n`;
  
  // Add parampara info
  description += `\nThis is the ${ordinal(guru.paramparaNumber)} pontiff in the Sri Raghavendra Matha Guru Parampara.`;
  
  // Add phase info for Sri Raghavendra Swamy
  if (guru.raghavendraPhase) {
    const phaseDescriptions = {
      Poorva: "Poorva Aaradhane commemorates the beginning of Sri Raghavendra Swamy's spiritual journey and teachings.",
      Madhya: "Madhya Aaradhane marks the time of his Samadhi and divine prophecy, when he declared he would remain in Brindavana for the welfare of devotees.",
      Uttara: "Uttara Aaradhane celebrates the Brindavana Utsava and the continued blessings of Sri Raghavendra Swamy to his devotees worldwide.",
    };
    description += `\n\n${phaseDescriptions[guru.raghavendraPhase]}`;
  }
  
  // Add duration info
  if (guru.durationDays > 1) {
    description += `\n\nThe Aaradhane is observed for ${guru.durationDays} days with special pujas and rituals.`;
  }
  
  // Add Guru description if available
  if (guru.description) {
    description += `\n\n${guru.description}`;
  }
  
  return description;
}

/**
 * Convert number to ordinal (1st, 2nd, 3rd, etc.)
 */
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Convert GeneratedAaradhaneEvent to Firestore document
 */
export function eventToFirestoreDocument(
  event: GeneratedAaradhaneEvent
): Omit<FirestoreEventDocument, "createdAt" | "updatedAt"> {
  const startDate = new Date(event.date);
  const endDate = new Date(event.endDate);
  
  return {
    title: event.title,
    description: event.description,
    location: "Sri Raghavendra Swamy Matha, Yelahanka, Bangalore",
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(endDate),
    featured: event.featured,
    published: event.published,
    status: determineEventStatus(startDate, endDate),
    category: event.category,
    guru: event.guru,
    autoGenerated: event.autoGenerated,
    year: event.year,
    paramparaNumber: event.paramparaNumber,
    raghavendraPhase: event.raghavendraPhase,
    lunarCalendar: event.lunarCalendar,
    rituals: event.rituals || [],
    offerings: event.offerings || [],
    significance: event.description || "",
    guruName: event.guru,
  };
}

/**
 * Determine event status based on dates
 */
function determineEventStatus(
  startDate: Date,
  endDate: Date
): "Upcoming" | "Ongoing" | "Completed" {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  if (end < now) {
    return "Completed";
  }
  if (start <= now && end >= now) {
    return "Ongoing";
  }
  return "Upcoming";
}

/**
 * Print a summary of generated events
 */
export function printGenerateSummary(result: GenerateResult, year: number): void {
  console.log("\n" + "=".repeat(60));
  console.log(`AARADHANE EVENTS GENERATION SUMMARY - ${year}`);
  console.log("=".repeat(60));
  console.log(`\nTotal Events Generated: ${result.summary.total}`);
  console.log(`  - Sri Raghavendra Swamy: ${result.summary.raghavendraCount} events`);
  console.log(`  - Major Importance: ${result.summary.majorCount}`);
  console.log(`  - Minor Importance: ${result.summary.minorCount}`);
  console.log("\n" + "-".repeat(60));
  console.log("\nGenerated Events:");
  console.log("-".repeat(60));
  
  // Group by importance
  const majorEvents = result.events.filter(e => e.importance === "major");
  const minorEvents = result.events.filter(e => e.importance === "minor");
  
  console.log("\nMajor Events:");
  for (const event of majorEvents) {
    const phase = event.raghavendraPhase ? ` [${event.raghavendraPhase}]` : "";
    console.log(`  • ${event.title}${phase}`);
    console.log(`    Date: ${getDateRangeString(event.date, event.lunarCalendar.tithiNumber > 0 ? 3 : 1)}`);
    console.log(`    Lunar: ${event.lunarCalendar.lunarMonth} ${event.lunarCalendar.paksha} ${event.lunarCalendar.tithi}`);
  }
  
  console.log("\nMinor Events:");
  for (const event of minorEvents) {
    console.log(`  • ${event.title}`);
    console.log(`    Date: ${event.date}`);
    console.log(`    Lunar: ${event.lunarCalendar.lunarMonth} ${event.lunarCalendar.paksha} ${event.lunarCalendar.tithi}`);
  }
  
  console.log("\n" + "=".repeat(60));
}

/**
 * Validate generated events
 */
export function validateGeneratedEvents(
  result: GenerateResult,
  year: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for Sri Raghavendra's three events
  const raghavendraEvents = result.events.filter(
    e => e.guru === "Sri Raghavendra Swamy"
  );
  
  if (raghavendraEvents.length !== 3) {
    errors.push(
      `Expected 3 Sri Raghavendra Swamy events, got ${raghavendraEvents.length}`
    );
  }
  
  // Check for Poorva, Madhya, Uttara phases
  const phases = raghavendraEvents.map(e => e.raghavendraPhase);
  if (!phases.includes("Poorva")) {
    errors.push("Missing Poorva Aaradhane for Sri Raghavendra Swamy");
  }
  if (!phases.includes("Madhya")) {
    errors.push("Missing Madhya Aaradhane for Sri Raghavendra Swamy");
  }
  if (!phases.includes("Uttara")) {
    errors.push("Missing Uttara Aaradhane for Sri Raghavendra Swamy");
  }
  
  // Check that all events have valid dates
  for (const event of result.events) {
    const eventDate = new Date(event.date);
    if (isNaN(eventDate.getTime())) {
      errors.push(`Invalid date for ${event.title}: ${event.date}`);
    }
    if (eventDate.getFullYear() !== year) {
      errors.push(
        `Year mismatch for ${event.title}: expected ${year}, got ${eventDate.getFullYear()}`
      );
    }
  }
  
  // Check for duplicates
  const keys = result.events.map(e => e.eventKey);
  const uniqueKeys = new Set(keys);
  if (keys.length !== uniqueKeys.size) {
    errors.push("Duplicate event keys found");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
