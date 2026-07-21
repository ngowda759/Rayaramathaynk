/**
 * Quote Types for Devotional Quote Engine
 * Epic: Intelligent Devotional Quote Engine for Sri Raghavendra Swamy Temple
 */

/**
 * Quote categories with priority levels
 */
export type QuoteCategory =
  | "raghavendra_stotra"      // Sri Raghavendra Stotra - Highest priority
  | "mangalashtakam"          // Sri Raghavendra Mangalashtakam - Festival Days
  | "guru_vandana"            // Guru Vandana - Thursday & Guru celebrations
  | "authentic_teachings"     // Daily rotation from authentic sources
  | "devotional_sayings"      // Fallback category
  | "madhwa_philosophy";      // Alternate-day Dvaita philosophy

/**
 * Supported languages for quote content
 */
export type QuoteLanguage = "en" | "kn" | "sa" | "mixed";

/**
 * Priority levels for quote selection (lower = higher priority)
 */
export enum QuotePriority {
  FESTIVAL = 1,           // Festival-specific quotes
  EVENT = 2,              // Event-specific quotes
  GURU_PURNIMA = 3,       // Guru Purnima quotes
  THURSDAY = 4,           // Thursday Guru Vandana
  RAGHAVENDRA_STOTRA = 5, // Sri Raghavendra Stotra
  AUTHENTIC_TEACHING = 6, // Authentic teachings
  MADHWA_PHILOSOPHY = 7,  // Madhwa philosophy
  DEVOTIONAL = 8,         // Devotional sayings (fallback)
  RANDOM = 9,             // Random active quote
}

/**
 * Tithis (lunar days) for Panchanga rules
 */
export type Tithi =
  | "purnima"      // Full moon
  | "amavasya"     // New moon
  | "ekadashi"     // 11th day
  | "dwadashi"     // 12th day
  | "prathama"     // 1st day
  | "dashami"      // 10th day
  | "chaturdashi"; // 14th day

/**
 * Weekdays for schedule rules
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Festival names for quote assignment
 */
export type FestivalName =
  | "raghavendra_aradhana"
  | "guru_purnima"
  | "madhwa_navami"
  | "vyasa_pooja"
  | "rama_navami"
  | "krishna_janmashtami"
  | "narasimha_jayanti"
  | "hanuman_jayanti"
  | "deepavali"
  | "vaikuntha_ekadashi"
  | "brahmotsava"
  | "navaratri"
  | "mahashivaratri"
  | "ratha_saptami"
  | "makara_sankramana";

/**
 * Panchanga rules for automatic quote selection
 */
export interface PanchangaRules {
  /** Match specific tithis */
  tithis?: Tithi[];
  /** Match specific nakshatras */
  nakshatras?: string[];
  /** Match specific weekdays (0=Sunday, 6=Saturday) */
  weekdays?: Weekday[];
  /** Match if it's a festival day */
  isFestival?: boolean;
  /** Match specific festivals */
  festivals?: FestivalName[];
}

/**
 * Quote content in multiple languages
 */
export interface QuoteContent {
  /** Kannada text */
  kannada?: string;
  /** Sanskrit/Devanagari text */
  sanskrit?: string;
  /** IAST transliteration */
  transliteration?: string;
  /** English translation */
  translationEnglish?: string;
}

/**
 * Main Quote interface
 */
export interface Quote {
  /** Firestore document ID */
  id: string;
  
  /** URL-friendly identifier */
  slug: string;
  
  /** Quote title */
  title: string;
  
  /** Quote category */
  category: QuoteCategory;
  
  /** Priority level (1-10, lower = higher priority) */
  priority: number;
  
  /** Primary language */
  language: QuoteLanguage;
  
  /** Quote content in multiple languages */
  content: QuoteContent;
  
  /** Source attribution */
  source: string;
  
  /** Author name */
  author?: string;
  
  /** Verse/stanza number if applicable */
  verseNumber?: number;
  
  /** Tags for search and categorization */
  tags: string[];
  
  /** Whether quote is active and available */
  active: boolean;
  
  /** Featured quotes appear first */
  featured: boolean;
  
  /** Only show during festivals */
  festivalOnly: boolean;
  
  /** Festivals this quote is associated with */
  festivalNames: FestivalName[];
  
  /** Restrict to specific weekdays */
  weekdayOnly: Weekday | null;
  
  /** Panchanga-based selection rules */
  panchangaRules?: PanchangaRules;
  
  /** Event-specific rules */
  eventRules?: {
    /** Match specific event IDs */
    eventIds?: string[];
    /** Match specific event categories */
    eventCategories?: string[];
  };
  
  /** Display date range */
  displayFrom?: string;  // ISO date string
  displayTo?: string;    // ISO date string
  
  /** Weight for random selection (higher = more likely) */
  displayWeight: number;
  
  /** Rotation group for non-repetition */
  rotationGroup?: string;
  
  /** Usage statistics */
  stats?: {
    viewCount: number;
    lastViewedAt?: string;
  };
  
  /** Metadata */
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Quote selection context for intelligent engine
 */
export interface QuoteSelectionContext {
  /** Current date for selection */
  date: Date;
  /** Day of week (0=Sunday) */
  dayOfWeek: Weekday;
  /** Current tithi if available */
  tithi?: Tithi;
  /** Current nakshatra if available */
  nakshatra?: string;
  /** Whether today is a festival */
  isFestival: boolean;
  /** Festival name if known */
  festivalName?: string;
  /** Active events today */
  activeEvents?: Array<{
    id: string;
    title: string;
    category: string;
  }>;
  /** Panchanga data if available */
  panchanga?: {
    tithi: string;
    nakshatra: string;
    isEkadashi: boolean;
    isPurnima: boolean;
    isAmavasya: boolean;
  };
}

/**
 * Quote API response
 */
export interface QuoteResponse {
  quote: Quote | null;
  context: {
    category: QuoteCategory;
    reason: string;
  };
  metadata: {
    cached: boolean;
    timestamp: string;
  };
}

/**
 * Quote search filters
 */
export interface QuoteFilters {
  category?: QuoteCategory;
  language?: QuoteLanguage;
  active?: boolean;
  featured?: boolean;
  festivalOnly?: boolean;
  weekdayOnly?: Weekday;
  search?: string;
  tags?: string[];
}

/**
 * Bulk import/export format
 */
export interface QuoteBulkData {
  version: string;
  exportedAt: string;
  quotes: Omit<Quote, "id" | "createdAt" | "updatedAt">[];
}

/**
 * Category metadata for admin display
 */
export interface QuoteCategoryInfo {
  id: QuoteCategory;
  label: string;
  description: string;
  priority: QuotePriority;
  defaultPriority: number;
  icon: string;
}

/**
 * Default quote categories with metadata
 */
export const QUOTE_CATEGORIES: QuoteCategoryInfo[] = [
  {
    id: "raghavendra_stotra",
    label: "Sri Raghavendra Stotra",
    description: "Authentic verses from Sri Appannacharya's Sri Raghavendra Stotra - Primary daily quote source",
    priority: QuotePriority.RAGHAVENDRA_STOTRA,
    defaultPriority: 5,
    icon: "star",
  },
  {
    id: "mangalashtakam",
    label: "Sri Raghavendra Mangalashtakam",
    description: "Eight verses for festival days - Aradhana, Guru Purnima, Vyasa Pooja, etc.",
    priority: QuotePriority.EVENT,
    defaultPriority: 2,
    icon: "temple",
  },
  {
    id: "guru_vandana",
    label: "Guru Vandana",
    description: "Traditional Guru prayers for Thursdays and Guru celebrations",
    priority: QuotePriority.THURSDAY,
    defaultPriority: 4,
    icon: "user",
  },
  {
    id: "authentic_teachings",
    label: "Authentic Teachings",
    description: "Teachings from Sri Raghavendra's works, Dvaita philosophy, and Madhwa literature",
    priority: QuotePriority.AUTHENTIC_TEACHING,
    defaultPriority: 6,
    icon: "book",
  },
  {
    id: "devotional_sayings",
    label: "Devotional Sayings",
    description: "General devotional content - used as fallback when no higher-priority quote applies",
    priority: QuotePriority.DEVOTIONAL,
    defaultPriority: 8,
    icon: "heart",
  },
  {
    id: "madhwa_philosophy",
    label: "Madhwa Philosophy",
    description: "Dvaita principles - Hari Sarvottama, Vayu Jeevottama, Panchabheda, etc.",
    priority: QuotePriority.MADHWA_PHILOSOPHY,
    defaultPriority: 7,
    icon: "lightbulb",
  },
];

/**
 * Festival to quote category mapping
 */
export const FESTIVAL_QUOTE_MAP: Record<FestivalName, QuoteCategory> = {
  raghavendra_aradhana: "mangalashtakam",
  guru_purnima: "mangalashtakam",
  vyasa_pooja: "mangalashtakam",
  brahmotsava: "mangalashtakam",
  madhwa_navami: "mangalashtakam",
  rama_navami: "devotional_sayings",
  krishna_janmashtami: "devotional_sayings",
  narasimha_jayanti: "devotional_sayings",
  hanuman_jayanti: "devotional_sayings",
  deepavali: "devotional_sayings",
  vaikuntha_ekadashi: "madhwa_philosophy",
  navaratri: "mangalashtakam",
  mahashivaratri: "devotional_sayings",
  ratha_saptami: "madhwa_philosophy",
  makara_sankramana: "madhwa_philosophy",
};

/**
 * Weekday to quote category mapping
 */
export const WEEKDAY_QUOTE_MAP: Record<Weekday, QuoteCategory> = {
  0: "raghavendra_stotra",  // Sunday - Primary stotra
  1: "authentic_teachings", // Monday
  2: "raghavendra_stotra",  // Tuesday
  3: "authentic_teachings",  // Wednesday
  4: "guru_vandana",         // Thursday - Guru Vandana
  5: "raghavendra_stotra",   // Friday
  6: "madhwa_philosophy",    // Saturday - Philosophy
};

/**
 * Default quotes for initial setup
 */
export const DEFAULT_QUOTES_DATA: Omit<Quote, "id" | "createdAt" | "updatedAt">[] = [
  // Sri Raghavendra Stotra verses
  {
    slug: "raghavendra-stotra-1",
    title: "Sri Raghavendra Stotra - Verse 1",
    category: "raghavendra_stotra",
    priority: 5,
    language: "sa",
    content: {
      sanskrit: "ಶ್ರೀಪೂರ್ಣಬೋಧ-ಗುರು-ತೀರ್ಥ-ಪಯೋಽಬ್ಧಿ-ಪಾರಾ | ಕಾಮಾರಿ-ಮಾಽಕ್ಷ-ವಿಷಮಾಕ್ಷ-ಶಿರಃ ಸ್ಪೃಶಂತೀ ||",
      transliteration: "Śrīpūrṇabodha-guru-tīrtha-payobdhi-pārā | KāMāri-māKṣa-viṣamāKṣa-śiraḥ sprśantī ||",
      translationEnglish: "Salutations to the ocean of perfect knowledge, the guru and tirtha, who touches the heads of Kamala (Lakshmi), Mara (death), and evil-eyed ones.",
    },
    source: "Sri Raghavendra Stotra",
    author: "Sri Appannacharya",
    verseNumber: 1,
    tags: ["stotra", "salutation", "guru"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    slug: "raghavendra-stotra-2",
    title: "Sri Raghavendra Stotra - Verse 2",
    category: "raghavendra_stotra",
    priority: 5,
    language: "sa",
    content: {
      sanskrit: "ಪೂರ್ವೋತ್ತರಾಮಿತ-ತರಂಗ-ಚರತ್-ಸು-ಹಂಸಾ | ದೇವಾಲಿ-ಸೇವಿತ-ಪರಾಂಘ್ರಿ-ಪಯೋಜ-ಲಗ್ನಾ ||",
      transliteration: "Pūrvottarāmita-taraṅga-carat-su-haṁsā | Devāli-sevita-parāṁghri-payoja-lagnā ||",
      translationEnglish: "Who is adorned by the lotus feet worshipped by Devalī (Lakshmi), moving gracefully like swans on undulating waves.",
    },
    source: "Sri Raghavendra Stotra",
    author: "Sri Appannacharya",
    verseNumber: 2,
    tags: ["stotra", "lotus feet", "devotion"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    slug: "mangalashtakam-1",
    title: "Sri Raghavendra Mangalashtakam - Verse 1",
    category: "mangalashtakam",
    priority: 2,
    language: "sa",
    content: {
      sanskrit: "ಶ್ರೀಮದ್ರಾಮಪಾದಾರವಿಂದಮಧುಪಃ ಶ್ರೀಮಧ್ವವಂಶಾಧಿಪಃ | ಸಚ್ಚಿಷ್ಯೋಡುಗಣೋಡುಪಃ ಶ್ರಿತಜಗದ್ಗೀರ್ವಾಣಸತ್ಪಾದಪಃ ||",
      transliteration: "Śrīmadrāmapādāravindamadhupaḥ śrīmadhavavaṁśādhipaḥ | sacchiṣyodugaṇoḍupaḥ śritajagadrgīrvāṇasatpāḍapaḥ ||",
      translationEnglish: "He is the bee at the lotus feet of Rama, the lord of Madhva lineage, the crest jewel of true disciples, the wish-fulfilling tree for those who take refuge.",
    },
    source: "Sri Raghavendra Mangalashtakam",
    author: "Sri Vadirajatirtharu",
    verseNumber: 1,
    tags: ["mangalashtakam", "aradhana", "festival"],
    active: true,
    featured: true,
    festivalOnly: true,
    festivalNames: ["raghavendra_aradhana", "guru_purnima", "vyasa_pooja"],
    weekdayOnly: null,
    displayWeight: 2,
  },
  {
    slug: "guru-vandana-1",
    title: "Guru Vandana - Morning Prayer",
    category: "guru_vandana",
    priority: 4,
    language: "kn",
    content: {
      kannada: "ಓಂ ಸಹ ನಾವವತು | ಸಹ ನೌ ಭುನಕ್ತು | ಸಹ ವೀರ್ಯಂ ಕರವಾವಹೈ |",
      transliteration: "Oṁ saha nāvavatu | saha nau bhunaktu | saha vīryaṁ karavāvahai |",
      translationEnglish: "May we all be united. May we all be nourished. May we all exert together with vigor.",
    },
    source: "Guru Vandana",
    author: "Traditional",
    tags: ["guru", "prayer", "thursday"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: 4, // Thursday
    displayWeight: 1,
  },
  {
    slug: "madhwa-philosophy-1",
    title: "Hari Sarvottama",
    category: "madhwa_philosophy",
    priority: 7,
    language: "sa",
    content: {
      sanskrit: "ಹರಿಃ ಸರ್ವೋತ್ತಮಃ | ವಾಯುಃ ಜೀವೋತ್ತಮಃ | ಜೀವಾಸ್ತು ಸರ್ವೋತ್ತಮಃ |",
      transliteration: "Hariḥ sarvottamaḥ | Vāyuḥ jīvottamaḥ | jīvāstu sarvottamaḥ |",
      translationEnglish: "Hari (Vishnu) is the greatest of all. Vayu (wind) is the greatest among senses. Among living beings, the soul is the greatest.",
    },
    source: "Dattatreya Yamaka",
    author: "Sri Madhvacharya",
    tags: ["dvaita", "philosophy", "hari", "vayu"],
    active: true,
    featured: true,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    slug: "authentic-teaching-1",
    title: "Service to Devotees",
    category: "authentic_teachings",
    priority: 6,
    language: "kn",
    content: {
      kannada: "ಭಕ್ತರ ಸೇವೆಯೇ ಈಶ್ವರ ಸೇವೆ | ಭಕ್ತರ ಮೊಯ್ಯೇ ಈಶ್ವರ ಮೊಯ್ಯ |",
      transliteration: "Bhaktara sēvayē īśvara sēvā | bhaktara moyyē īśvara moyya |",
      translationEnglish: "Service to devotees is service to God. The dust of devotees' feet is the dust of God's feet.",
    },
    source: "Sri Raghavendra Swamy Teachings",
    author: "Sri Raghavendra Swamy",
    tags: ["service", "devotion", "bhakti"],
    active: true,
    featured: true,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
];
