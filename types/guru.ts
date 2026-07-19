/**
 * Guru Parampara Types
 * Enhanced types for the interactive Guru Parampara feature
 */

export interface GuruBiography {
  /** Unique identifier */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Name in Kannada script */
  kannadaName: string;
  
  /** Parampara number (1-17) */
  paramparaNumber: number;
  
  /** Devanagari number for display */
  number: string;
  
  /** Mantra/sloka in Kannada */
  mantra: string;
  
  /** English description */
  description: string;
  
  /** Extended biography */
  biography?: string;
  
  /** Key teachings or contributions */
  teachings?: string[];
  
  /** Notable works/compositions */
  works?: string[];
  
  /** Associated Aaradhane info */
  aaradhane?: {
    month: string;
    paksha: string;
    tithi: string;
    duration: number;
  };
  
  /** Importance level */
  importance: "founder" | "major" | "minor";
  
  /** Whether featured in timeline */
  featured: boolean;
}

export type GuruFilterType = "all" | "major" | "minor" | "founder";
export type GuruViewMode = "cards" | "timeline" | "list";

export interface GuruSearchResult {
  guru: GuruBiography;
  matchedFields: ("name" | "description" | "works")[];
  relevanceScore: number;
}

/**
 * Extended guru data with biographies
 */
export const GURU_BIOGRAPHIES: GuruBiography[] = [
  {
    id: "madhvacharya",
    name: "Sri Madhvacharya",
    kannadaName: "ಶ್ರೀ ಮಾಧ್ವಾಚಾರ್ಯರು",
    paramparaNumber: 1,
    number: "01",
    mantra: "ಬ್ರಹ್ಮಾಂತಾಗುರವ: ಸಾಕ್ಷಾದಿಷ್ಟಂ ದೈವಂ ಶ್ರೀಯ:ಪತಿ: ಆಚಾರ್ಯಾ: ಶ್ರೀಮದಾಚಾರ್ಯಾ: ಸಂತುಮೇ ಜನ್ಮ ಜನ್ಮನಿ ||",
    description: "The great preceptor who is the very essence of the Vedas, the divine master of all, the supreme teacher - Sri Madhvacharya",
    biography: "Born in 1238 CE at Uddhanda Matha near Pajaka, Karnataka, Sri Madhvacharya founded the Dvaita (dualistic) school of Hindu philosophy. He wrote extensive commentaries on the Brahma Sutras, Bhagavata Gita, and Upanishads, establishing the philosophical foundation of the Madhwa tradition.",
    teachings: [
      "The world is real and distinct from Brahman",
      "Jivas (souls) are eternally subordinate to God",
      "Moksha (liberation) is achieved through surrender to God",
      "The Vedas are the eternal, infallible source of knowledge"
    ],
    works: [
      "Brahma Sutra Bhashya",
      "Bhagavata Gita Bhashya", 
      "Rig Bhashya",
      "Tattva Prakasha",
      "Anu Vyakhya"
    ],
    aaradhane: {
      month: "Caitra",
      paksha: "Shukla",
      tithi: "Dashami",
      duration: 3
    },
    importance: "founder",
    featured: true
  },
  {
    id: "padmanabha-teertha",
    name: "Sri Padmanabha Teertharu",
    kannadaName: "ಶ್ರೀ ಪದ್ಮನಾಭ ತೀರ್ಥರು",
    paramparaNumber: 2,
    number: "02",
    mantra: "ಪೂರ್ಣಪ್ರಜ್ಞ ಕೃತಂ ಭಾಷ್ಯಾಮಾದೌ ತದ್ಭಾವಪೂರ್ವಕಂ ಯೋ ವ್ಯಾಕರೋನ್ನಮಸ್ಮೈ ಪದ್ಮನಾಭಾಖ್ಯ ಯೋಗಿನೇ ||",
    description: "The learned scholar who composed the bhashya (commentary) with complete knowledge and understanding",
    importance: "minor",
    featured: true
  },
  {
    id: "narahari-teertha",
    name: "Sri Narahari Teertharu",
    kannadaName: "ಶ್ರೀ ನರಹರಿ ತೀರ್ಥರು",
    paramparaNumber: 3,
    number: "03",
    mantra: "ಸಸೀತಾ ಮೂಲರಾಮಾರ್ಚಾ ಕೋಶೇ ಗಜಪತೇ ಸ್ಥಿತಾ ಯೇನಾನೀತಾ ನಮಸ್ತಸ್ಮೈ ಶ್ರೀಮನ್ ನೃಹರಿ ಭಿಕ್ಷವೇ ||",
    description: "The saint who tended to the Lord like a devotee, carrying the essence of devotion",
    importance: "minor",
    featured: false
  },
  {
    id: "madhava-teertha",
    name: "Sri Madhava Teertharu",
    kannadaName: "ಶ್ರೀ ಮಾಧವ ತೀರ್ಥರು",
    paramparaNumber: 4,
    number: "04",
    mantra: "ಸಾಧಿತಾಖಿಲ ಸತ್ತತ್ವಂ ಬಾಧಿತಾಖಿಲ ದುರ್ಮತಂ ಬೊಧಿತಾಖಿಲ ಸನ್ಮಾರ್ಗಂ ಮಾಧವಾಖ್ಯ ಗುರುಂ ಭಜೇ ||",
    description: "The guru who established all truths, refuted all false doctrines, and illuminated the path of righteousness",
    importance: "minor",
    featured: false
  },
  {
    id: "akshobhya-teertha",
    name: "Sri Akshobhya Teertharu",
    kannadaName: "ಶ್ರೀ ಅಕ್ಷೋಭ್ಯ ತೀರ್ಥರು",
    paramparaNumber: 5,
    number: "05",
    mantra: "ಯೋ ವಿದ್ಯಾರಣ್ಯ ವಿಪಿನಂ ತತ್ವಮಸ್ಸಿನಾಛ್ಛಿನತ ಶ್ರೀಮದಕ್ಷೋಭ್ಯತೀರ್ಥಾಯ ನಮಸ್ತಸ್ಮೈ ಮಹಾತ್ಮನೇ ||",
    description: "The great soul who cut through the forest of ignorance with the sword of knowledge",
    importance: "minor",
    featured: false
  },
  {
    id: "jayateertha",
    name: "Sri Jayateertharu",
    kannadaName: "ಶ್ರೀ ಜಯತೀರ್ಥರು",
    paramparaNumber: 6,
    number: "06",
    mantra: "ಯಸ್ಯ ವಾಕ್ಕಾಮಧೇನುರ್ನ: ಕಾಮಿತಾರ್ಥನ್ ಪ್ರಯಚ್ಛತಿ ಸೇವೇ ತಂ ಜಯಯೋಗೀಂದ್ರಂ ಕಾಮಬಾಣಚ್ಚಿದಂ ಸದಾ ||",
    description: "The victorious one whose words shower desired fruits upon devotees like the flow of honey",
    biography: "Sri Jayateertha (also known as Jayatirtha) was a prolific writer and defender of Dvaita philosophy. His works systematically refuted the arguments of Advaita Vedanta.",
    teachings: [
      "Logical analysis as a tool for understanding scripture",
      "Importance of pramanas (means of knowledge)",
      "Distinction between intrinsic and attributive identity"
    ],
    works: [
      "Tarka Tandava",
      "Krama Dipika",
      "Muktimale",
      "Harikathamruta Sarakara"
    ],
    aaradhane: {
      month: "Bhādrapada",
      paksha: "Shukla",
      tithi: "Navami",
      duration: 2
    },
    importance: "major",
    featured: true
  },
  {
    id: "vidyadhiraaja",
    name: "Sri Vidyadhirajaru",
    kannadaName: "ಶ್ರೀ ವಿದ್ಯಾಧಿರಾಜರು",
    paramparaNumber: 7,
    number: "07",
    mantra: "ಮಾದ್ಯದದ್ವೈತ್ಯಂಧಕಾರ ಪ್ರದ್ಯೋತನಮಹರ್ನಿಶಂ ವಿದ್ಯಾಧಿರಾಜ ಸುಗುರೂಂ ಹೃದ್ಯಾಮಿತ ಗುರೂಂ ಭಜೇ ||",
    description: "The king of knowledge who illuminates the darkness of duality, the beloved guru of all scholars",
    biography: "Sri Vidyadhiraja was renowned for his scholarly debates and successfully defended Dvaita philosophy against Advaita scholars. He was known for his humility and dedication to Guru Paduka worship.",
    importance: "major",
    featured: true
  },
  {
    id: "kavendra-teertha",
    name: "Sri Kavendra Teertharu",
    kannadaName: "ಶ್ರೀ ಕವೀಂದ್ರ ತೀರ್ಥರು",
    paramparaNumber: 8,
    number: "08",
    mantra: "ವೀಂದ್ರಾರೂಢ ಪದಾಸಕ್ತಂ ರಾಜೇಂದ್ರ ಮುನಿಸೇವಿತಂ ಶ್ರೀ ಕವೀಂದ್ರ ಮುನಿಂ ವಂದೇ ಭಜತಾಂ ಚಂದ್ರ ಸನ್ನಿಭಂ ||",
    description: "The poet-king among saints, served by great devotees, like the moon among stars",
    importance: "minor",
    featured: false
  },
  {
    id: "vageesha-teertha",
    name: "Sri Vageesha Teertharu",
    kannadaName: "ಶ್ರೀ ವಾಗೀಶ ತೀರ್ಥರು",
    paramparaNumber: 9,
    number: "09",
    mantra: "ವಾಸುದೇವ ಪದದ್ವಂದ್ವ ವಾರಿಜಾಸಕ್ತ ಮಾನಸಂ ಪದ ವ್ಯಾಖ್ಯಾನ ಕುಶಲಂ ವಾಗೀಶ ಯತಿಮಾಶ್ರಯೇ ||",
    description: "The master of speech who is devoted to Vasudeva's feet and excels in explaining divine truths",
    importance: "minor",
    featured: false
  },
  {
    id: "ramachandra-teertha",
    name: "Sri Ramachandra Teertharu",
    kannadaName: "ಶ್ರೀ ರಾಮಚಂದ್ರ ತೀರ್ಥರು",
    paramparaNumber: 10,
    number: "10",
    mantra: "ದ್ಯುಮಣ್ಯಬೀಜನಾಬ್ದಿಂದುಂ ರಾಮವ್ಯಾಸಪದಾರ್ಚಕ: ರಾಮಚಂದ್ರ ಗುರುರ್ಭ್ರುಯಾತ್ ಕಾಮಿತಾರ್ಥ ಪ್ರದಾಯಕ: ||",
    description: "The guru born from the lineage of Ramanuja, like the moon from the ocean of nectar, fulfilling all desires",
    importance: "minor",
    featured: false
  },
  {
    id: "vibudhendra-teertha",
    name: "Sri Vibudhendra Teertharu",
    kannadaName: "ಶ್ರೀ ವಿಭುದೇಂದ್ರ ತೀರ್ಥರು",
    paramparaNumber: 11,
    number: "11",
    mantra: "ಅಕೇರಲಂ ತಥಾ ಸೇತುಂ ಮಾಗಂಗಂ ಚ ಹಿಮಾಲಯಂ ನಿರಾಕೃತಾದ್ವೈತ ಶೈವಂ ವಿಭುದೇಂದ್ರ ಗುರೂಂ ಭಜೇ ||",
    description: "The wise guru who crossed the oceans, bridges, rivers and mountains, worshipping the non-dual Shaiva doctrine",
    importance: "minor",
    featured: false
  },
  {
    id: "jitamitra-teertha",
    name: "Sri Jitamitra Teertharu",
    kannadaName: "ಶ್ರೀ ಜಿತಾಮಿತ್ರ ತೀರ್ಥರು",
    paramparaNumber: 12,
    number: "12",
    mantra: "ಸಪ್ತರಾತ್ರದ ಕೃಷ್ಣವೇಣ್ಯಾ ಮುಶಿತ್ವಾ ಪುನರುತ್ಥಿತದ ಜಿತಾಮಿತ್ರ ಗುರು ವಂದೇ ವಿಭುದೇಂದ್ರ ಕರೋದ್ಭವದ ||",
    description: "The victorious friend who conquered all enemies of knowledge",
    importance: "minor",
    featured: false
  },
  {
    id: "raghunandana-teertha",
    name: "Sri Raghunandana Teertharu",
    kannadaName: "ಶ್ರೀ ರಘುನಂದನ ತೀರ್ಥರು",
    paramparaNumber: 13,
    number: "13",
    mantra: "ಪರೈರಪಹೃತಾ ಮೂಲರಾಮಾರ್ಚಾ ಗುರ್ವನುಗ್ರಹಾತ್ ಯೇನಾನೀತಾ ನಮಸ್ತಸ್ಮೈ ರಘುನಂದನ ಭಿಕ್ಷವೇ ||",
    description: "The one who received the essence of service to the Lord's feet through the guru's grace",
    importance: "minor",
    featured: false
  },
  {
    id: "surendra-teertha",
    name: "Sri Surendra Teertharu",
    kannadaName: "ಶ್ರೀ ಸುರೇಂದ್ರ ತೀರ್ಥರು",
    paramparaNumber: 14,
    number: "14",
    mantra: "ಯಶ್ಚಕಾರೋಪವಾಸೇನ ತ್ರಿವಾರದ ಭೂ ಪ್ರದಕ್ಷಿಣದ ತಸ್ಮೈ ನಮೋ ಯತೀಂದ್ರಾಯ ಶ್ರೀ ಸುರೇಂದ್ರ ತಪಸ್ವಿನೇ ||",
    description: "The austere practitioner who worshipped with three daily circuits of the earth through renunciation",
    importance: "minor",
    featured: false
  },
  {
    id: "vijayeendra-teertha",
    name: "Sri Vijayeendra Teertharu",
    kannadaName: "ಶ್ರೀ ವಿಜಯೀಂದ್ರ ತೀರ್ಥರು",
    paramparaNumber: 15,
    number: "15",
    mantra: "ಭಕ್ತಾನಾಂ ಮಾನಸಾಂ ಭೋಜಭಾನವೇ ಕಾಮಧೇನವೇ ಭಜತಾಂ ಕಲ್ಪತರವೇ ಜಯೀಂದ್ರ ಗುರವೇ ನಮಃ ||",
    description: "The lord of victory who is the wish-fulfilling tree for devotees, fulfilling all desires",
    biography: "Sri Vijayeendra Teertha was the 15th pontiff and the last before Sri Raghavendra Swamy. He prepared the Matha for the arrival of the divine pontiff who was prophesied to appear.",
    aaradhane: {
      month: "Śrāvaṇa",
      paksha: "Krishna",
      tithi: "Purnima",
      duration: 3
    },
    importance: "major",
    featured: true
  },
  {
    id: "sudheeendra-teertha",
    name: "Sri Sudheeendra Teertharu",
    kannadaName: "ಶ್ರೀ ಸುಧೀಂದ್ರ ತೀರ್ಥರು",
    paramparaNumber: 16,
    number: "16",
    mantra: "ಕುಶಾಗ್ರಮತಯೇ ಭಾನುದ್ಯುತಯೇ ವಾದಿ ಭೀತಯೇ ಆರಾಧಿತ ಶ್ರೀಪತಯೇ ಶ್ರೀಸುಧೀಂದ್ರ ಯತಯೇ ನಮಃ ||",
    description: "The excellent one who is the crest-jewel of scholars, radiant like the sun, worshipped by the learned",
    biography: "Sri Sudheeendra Teertha was the immediate predecessor of Sri Raghavendra Swamy. He initiated the young Venkata as the next pontiff and prophesied his divine stature.",
    aaradhane: {
      month: "Bhādrapada",
      paksha: "Shukla",
      tithi: "Saptami",
      duration: 2
    },
    importance: "major",
    featured: true
  },
  {
    id: "raghavendra-teertha",
    name: "Sri Raghavendra Swamy",
    kannadaName: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಗಳು",
    paramparaNumber: 17,
    number: "17",
    mantra: "ದುರ್ವಾದಿಧ್ವಾಂತರವಯೇ ವೈಷ್ಣವೇಂದೀವರೇಂದವೇ ಶ್ರೀ ರಾಘವೇಂದ್ರ ಗುರವೇ ನಮೋ ಅತ್ಯಂತ ದಯಾಳವೇ ||",
    description: "The presiding deity of our Matha, the great saint who is the embodiment of Lord Rama's grace, extremely compassionate",
    biography: "Born in 1595 CE at Baskal Gram, Sri Raghavendra Swamy is the 17th pontiff of the lineage. At age 12, he was initiated as pontiff by Sri Sudheeendra Teertha, who prophesied that he would be the presiding deity of the Matha. He entered Brindavana in 1671 CE at Mantralaya, promising to remain till the end of Kali Yuga.",
    teachings: [
      "Surrender (Sharanagati) to Lord Rama as the path to liberation",
      "Daily worship and recitation of Rama Nama",
      "Faith in Guru's words as equivalent to Vedic testimony",
      "Service to devotees as service to God"
    ],
    works: [
      "Rajagopala Sthuti",
      "Muktimale (Muktimale Sutradi KalangaLellu)",
      "Ramapriya Prashna"
    ],
    importance: "major",
    featured: true
  }
];

/**
 * Get guru by ID
 */
export function getGuruById(id: string): GuruBiography | undefined {
  return GURU_BIOGRAPHIES.find(g => g.id === id);
}

/**
 * Get featured gurus for timeline
 */
export function getFeaturedGurus(): GuruBiography[] {
  return GURU_BIOGRAPHIES.filter(g => g.featured);
}

/**
 * Get major gurus
 */
export function getMajorGurus(): GuruBiography[] {
  return GURU_BIOGRAPHIES.filter(g => g.importance === "major" || g.importance === "founder");
}

/**
 * Search gurus by query
 */
export function searchGurus(query: string): GuruSearchResult[] {
  const normalizedQuery = query.toLowerCase();
  
  return GURU_BIOGRAPHIES
    .map(guru => {
      const matchedFields: GuruSearchResult["matchedFields"] = [];
      let score = 0;
      
      if (guru.name.toLowerCase().includes(normalizedQuery)) {
        matchedFields.push("name");
        score += 30;
      }
      
      if (guru.description.toLowerCase().includes(normalizedQuery)) {
        matchedFields.push("description");
        score += 10;
      }
      
      if (guru.works?.some(w => w.toLowerCase().includes(normalizedQuery))) {
        matchedFields.push("works");
        score += 20;
      }
      
      return { guru, matchedFields, relevanceScore: score };
    })
    .filter(result => result.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
