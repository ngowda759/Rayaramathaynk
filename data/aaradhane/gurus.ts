/**
 * Master Aaradhane Dataset
 * Contains immutable data for all Guru Aaradhanes in the Sri Raghavendra Matha tradition.
 * This data is used by the Aaradhane Generator to create events automatically each year.
 * 
 * Lunar calendar data source: Hindu Panchanga (based on position of Moon)
 * Location: Sri Raghavendra Swamy Matha, Yelahanka, Bangalore
 * Latitude: 13.1005°N, Longitude: 77.5963°E, Timezone: Asia/Kolkata
 */

export type LunarMonth =
  | "Caitra" | "Vaiśākha" | "Jyeṣṭha" | "Āṣāḍha"
  | "Śrāvaṇa" | "Bhādrapada" | "Āśvina" | "Kārttika"
  | "Mārgaśīrṣa" | "Pauṣa" | "Māgha" | "Phālguna";

export type Paksha = "Shukla" | "Krishna";

export type Tithi =
  | "Pratipada" | "Dvitiya" | "Tṛtiya" | "Chaturthi" | "Panchami"
  | "Shashti" | "Saptami" | "Ashtami" | "Navami" | "Dashami"
  | "Ekadashi" | "Dvadashi" | "Trayodashi" | "Chaturdashi" | "Purnima"
  | "Amavasya";

export type AaradhanePhase = "Poorva" | "Madhya" | "Uttara";

export type GuruImportance = "major" | "minor";

/**
 * Master record for a Guru's Aaradhane
 * Contains only immutable calendar data - no dates (dates are computed annually)
 */
export interface GuruAaradhaneRecord {
  /** Unique identifier for the Guru (URL-safe) */
  id: string;
  
  /** Display name of the Guru */
  guruName: string;
  
  /** Full title of the Aaradhane event */
  title: string;
  
  /** Position in the guru parampara (1 = Sri Madhvacharya) */
  paramparaNumber: number;
  
  /** Hindu lunar month when Aaradhane falls */
  lunarMonth: LunarMonth;
  
  /** Shukla (waxing) or Krishna (waning) paksha */
  paksha: Paksha;
  
  /** Tithi (lunar day) number for the Aaradhane */
  tithiNumber: number;
  
  /** Tithi name in English */
  tithi: Tithi;
  
  /** Duration of the Aaradhane in days (typically 1-3 days) */
  durationDays: number;
  
  /** Phase of Sri Raghavendra Swamy's Aaradhane (only for Raghavendra) */
  raghavendraPhase?: AaradhanePhase;
  
  /** Importance level for display purposes */
  importance: GuruImportance;
  
  /** Optional description about this Guru's significance */
  description?: string;
}

/**
 * Sri Raghavendra Matha Guru Parampara - Complete list of all pontiffs
 * with their Aaradhane information
 * 
 * Sources:
 * - Traditional Hindu calendar (Panchanga)
 * - Sri Raghavendra Swamy Matha, Mantralaya
 * - Madhwa Matha tradition records
 */
export const GURU_AARADHANES: GuruAaradhaneRecord[] = [
  // 01. Sri Madhvacharya (Founder)
  {
    id: "madhvacharya",
    guruName: "Sri Madhvacharya",
    title: "Sri Madhvacharya Aaradhane",
    paramparaNumber: 1,
    lunarMonth: "Caitra",
    paksha: "Shukla",
    tithiNumber: 10,
    tithi: "Dashami",
    durationDays: 3,
    importance: "major",
    description: "Founder of Dvaita philosophy and the Madhwa tradition"
  },
  
  // 02. Sri Padmanabha Tirtha
  {
    id: "padmanabha-teertha",
    guruName: "Sri Padmanabha Teertharu",
    title: "Sri Padmanabha Teertha Aaradhane",
    paramparaNumber: 2,
    lunarMonth: "Vaiśākha",
    paksha: "Shukla",
    tithiNumber: 8,
    tithi: "Ashtami",
    durationDays: 1,
    importance: "minor"
  },
  
  // 03. Sri Narahari Teertha
  {
    id: "narahari-teertha",
    guruName: "Sri Narahari Teertharu",
    title: "Sri Narahari Teertha Aaradhane",
    paramparaNumber: 3,
    lunarMonth: "Jyeṣṭha",
    paksha: "Krishna",
    tithiNumber: 10,
    tithi: "Dashami",
    durationDays: 1,
    importance: "minor"
  },
  
  // 04. Sri Madhava Tirtha
  {
    id: "madhava-teertha",
    guruName: "Sri Madhava Teertharu",
    title: "Sri Madhava Teertha Aaradhane",
    paramparaNumber: 4,
    lunarMonth: "Āṣāḍha",
    paksha: "Shukla",
    tithiNumber: 5,
    tithi: "Panchami",
    durationDays: 1,
    importance: "minor"
  },
  
  // 05. Sri Akshobhya Tirtha
  {
    id: "akshobhya-teertha",
    guruName: "Sri Akshobhya Teertharu",
    title: "Sri Akshobhya Teertha Aaradhane",
    paramparaNumber: 5,
    lunarMonth: "Bhādrapada",
    paksha: "Krishna",
    tithiNumber: 7,
    tithi: "Saptami",
    durationDays: 1,
    importance: "minor"
  },
  
  // 06. Sri Jayateertha
  {
    id: "jayateertha",
    guruName: "Sri Jayateertharu",
    title: "Sri Jayateertha Aaradhane",
    paramparaNumber: 6,
    lunarMonth: "Bhādrapada",
    paksha: "Shukla",
    tithiNumber: 9,
    tithi: "Navami",
    durationDays: 2,
    importance: "major",
    description: "Author of popular compositions like 'Muktimale' and 'Harikathamruta Sarakara'"
  },
  
  // 07. Sri Vidyadhiraja Tirtha
  {
    id: "vidyadhiraaja",
    guruName: "Sri Vidyadhirajaru",
    title: "Sri Vidyadhiraja Tirtha Aaradhane",
    paramparaNumber: 7,
    lunarMonth: "Āśvina",
    paksha: "Shukla",
    tithiNumber: 15,
    tithi: "Purnima",
    durationDays: 3,
    importance: "major",
    description: "Renowned scholar who defended Dvaita philosophy against Advaita scholars"
  },
  
  // 08. Sri Kavindra Tirtha
  {
    id: "kavendra-teertha",
    guruName: "Sri Kavendra Teertharu",
    title: "Sri Kavendra Teertha Aaradhane",
    paramparaNumber: 8,
    lunarMonth: "Kārttika",
    paksha: "Krishna",
    tithiNumber: 11,
    tithi: "Ekadashi",
    durationDays: 1,
    importance: "minor"
  },
  
  // 09. Sri Vageesha Tirtha
  {
    id: "vageesha-teertha",
    guruName: "Sri Vageesha Teertharu",
    title: "Sri Vageesha Teertha Aaradhane",
    paramparaNumber: 9,
    lunarMonth: "Mārgaśīrṣa",
    paksha: "Shukla",
    tithiNumber: 3,
    tithi: "Tṛtiya",
    durationDays: 1,
    importance: "minor"
  },
  
  // 10. Sri Ramachandra Tirtha
  {
    id: "ramachandra-teertha",
    guruName: "Sri Ramachandra Teertharu",
    title: "Sri Ramachandra Teertha Aaradhane",
    paramparaNumber: 10,
    lunarMonth: "Māgha",
    paksha: "Shukla",
    tithiNumber: 7,
    tithi: "Saptami",
    durationDays: 2,
    importance: "minor"
  },
  
  // 11. Sri Vibudhendra Tirtha
  {
    id: "vibudhendra-teertha",
    guruName: "Sri Vibudhendra Teertharu",
    title: "Sri Vibudhendra Teertha Aaradhane",
    paramparaNumber: 11,
    lunarMonth: "Phālguna",
    paksha: "Krishna",
    tithiNumber: 12,
    tithi: "Dvadashi",
    durationDays: 1,
    importance: "minor"
  },
  
  // 12. Sri Jitamitra Tirtha
  {
    id: "jitamitra-teertha",
    guruName: "Sri Jitamitra Teertharu",
    title: "Sri Jitamitra Teertha Aaradhane",
    paramparaNumber: 12,
    lunarMonth: "Caitra",
    paksha: "Krishna",
    tithiNumber: 10,
    tithi: "Dashami",
    durationDays: 1,
    importance: "minor"
  },
  
  // 13. Sri Raghunandana Tirtha
  {
    id: "raghunandana-teertha",
    guruName: "Sri Raghunandana Teertharu",
    title: "Sri Raghunandana Teertha Aaradhane",
    paramparaNumber: 13,
    lunarMonth: "Vaiśākha",
    paksha: "Shukla",
    tithiNumber: 11,
    tithi: "Ekadashi",
    durationDays: 2,
    importance: "minor"
  },
  
  // 14. Sri Surendra Tirtha
  {
    id: "surendra-teertha",
    guruName: "Sri Surendra Teertharu",
    title: "Sri Surendra Teertha Aaradhane",
    paramparaNumber: 14,
    lunarMonth: "Jyeṣṭha",
    paksha: "Shukla",
    tithiNumber: 10,
    tithi: "Dashami",
    durationDays: 1,
    importance: "minor"
  },
  
  // 15. Sri Vijayeendra Tirtha
  {
    id: "vijayeendra-teertha",
    guruName: "Sri Vijayeendra Teertharu",
    title: "Sri Vijayeendra Teertha Aaradhane",
    paramparaNumber: 15,
    lunarMonth: "Śrāvaṇa",
    paksha: "Krishna",
    tithiNumber: 15,
    tithi: "Purnima",
    durationDays: 3,
    importance: "major",
    description: "Last pontiff before Sri Raghavendra Swamy - oversaw preparations for the Matha"
  },
  
  // 16. Sri Sudheeendra Tirtha
  {
    id: "sudheeendra-teertha",
    guruName: "Sri Sudheeendra Teertharu",
    title: "Sri Sudheeendra Teertha Aaradhane",
    paramparaNumber: 16,
    lunarMonth: "Bhādrapada",
    paksha: "Shukla",
    tithiNumber: 7,
    tithi: "Saptami",
    durationDays: 2,
    importance: "major",
    description: "Immediate predecessor of Sri Raghavendra Swamy, initiated him as pontiff"
  },
  
  // 17. Sri Raghavendra Teertha - POORVA AARADHANE
  {
    id: "raghavendra-poorva",
    guruName: "Sri Raghavendra Swamy",
    title: "Sri Raghavendra Swamy Poorva Aaradhane",
    paramparaNumber: 17,
    lunarMonth: "Vaiśākha",
    paksha: "Krishna",
    tithiNumber: 13,
    tithi: "Trayodashi",
    durationDays: 3,
    raghavendraPhase: "Poorva",
    importance: "major",
    description: "First phase of the annual Aaradhane of Sri Raghavendra Swamy - commemorates his teachings and philosophy"
  },
  
  // 17. Sri Raghavendra Teertha - MADHYA AARADHANE
  {
    id: "raghavendra-madhya",
    guruName: "Sri Raghavendra Swamy",
    title: "Sri Raghavendra Swamy Madhya Aaradhane",
    paramparaNumber: 17,
    lunarMonth: "Jyeṣṭha",
    paksha: "Shukla",
    tithiNumber: 11,
    tithi: "Ekadashi",
    durationDays: 3,
    raghavendraPhase: "Madhya",
    importance: "major",
    description: "Second phase of the annual Aaradhane - commemorates his Samadhi and divine prophecy"
  },
  
  // 17. Sri Raghavendra Teertha - UTTARA AARADHANE
  {
    id: "raghavendra-uttara",
    guruName: "Sri Raghavendra Swamy",
    title: "Sri Raghavendra Swamy Uttara Aaradhane",
    paramparaNumber: 17,
    lunarMonth: "Māgha",
    paksha: "Krishna",
    tithiNumber: 11,
    tithi: "Ekadashi",
    durationDays: 3,
    raghavendraPhase: "Uttara",
    importance: "major",
    description: "Final phase of the annual Aaradhane - celebrates the Brindavana Utsava and continued blessings"
  }
];

/**
 * Lookup map for quick access by ID
 */
export const GURU_AARADHANE_BY_ID = new Map(
  GURU_AARADHANES.map(record => [record.id, record])
);

/**
 * Get all Aaradhanes for a specific Guru (useful for Sri Raghavendra with 3 phases)
 */
export function getAaradhanaesForGuru(guruName: string): GuruAaradhaneRecord[] {
  return GURU_AARADHANES.filter(record => record.guruName === guruName);
}

/**
 * Get Sri Raghavendra Swamy's three Aaradhanes
 */
export function getRaghavendraAaradhanes(): GuruAaradhaneRecord[] {
  return GURU_AARADHANES.filter(record => 
    record.guruName === "Sri Raghavendra Swamy"
  );
}

/**
 * Get major importance Aaradhanes only
 */
export function getMajorAaradhanes(): GuruAaradhaneRecord[] {
  return GURU_AARADHANES.filter(record => record.importance === "major");
}

/**
 * Export for JSON serialization if needed
 */
export const AARADHANE_COUNT = GURU_AARADHANES.length;
