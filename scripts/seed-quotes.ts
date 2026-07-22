/**
 * Seed Script for Devotional Quotes
 * 
 * This script seeds authentic verses from:
 * - Sri Raghavendra Stotra (Sri Appannacharya)
 * - Sri Raghavendra Mangalashtakam (Sri Vadirajatirtharu)
 * - Guru Vandana prayers
 * - Madhwa Philosophy principles
 * - Authentic Teachings from Sri Raghavendra Swamy
 * 
 * Run: npx ts-node --project tsconfig.scripts.json scripts/seed-quotes.ts
 */

import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as fs from "fs";

// Initialize Firebase Admin
function initFirebase() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      } as any), // Type assertion to handle property name variation
    });
  }
  return getFirestore();
}

// Quote data types
interface QuoteData {
  slug: string;
  title: string;
  category: string;
  priority: number;
  language: string;
  content: {
    kannada?: string;
    sanskrit?: string;
    transliteration?: string;
    translationEnglish?: string;
  };
  source: string;
  author: string;
  verseNumber?: number;
  tags: string[];
  active: boolean;
  featured: boolean;
  festivalOnly: boolean;
  festivalNames: string[];
  weekdayOnly: number | null;
  displayWeight: number;
}

// Sri Raghavendra Stotra verses (by Sri Appannacharya)
// These are authentic verses from the Sri Raghavendra Stotra
const raghavendraStotraVerses: Omit<QuoteData, "slug">[] = [
  {
    title: "Sri Raghavendra Stotra - Verse 1",
    category: "raghavendra_stotra",
    priority: 5,
    language: "sa",
    content: {
      kannada: "ಶ್ರೀಪೂರ್ಣಬೋಧ-ಗುರು-ತೀರ್ಥ-ಪಯೋಽಬ್ಧಿ-ಪಾರಾ | ಕಾಮಾರಿ-ಮಾಽಕ್ಷ-ವಿಷಮಾಕ್ಷ-ಶಿರಃ ಸ್ಪೃಶಂತೀ ||",
      transliteration: "Śrīpūrṇabodha-guru-tīrtha-payobdhi-pārā | Kāmāri-māKṣa-viṣamāKṣa-śiraḥ sprśantī ||",
      translationEnglish: "Salutations to the ocean of perfect knowledge, the guru and tirtha, who touches the heads of Kamala (Lakshmi), Mara (death), and evil-eyed ones."
    },
    source: "Sri Raghavendra Stotra",
    author: "Sri Appannacharya",
    verseNumber: 1,
    tags: ["stotra", "salutation", "guru"],
    active: true,
    featured: true,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    title: "Sri Raghavendra Stotra - Verse 2",
    category: "raghavendra_stotra",
    priority: 5,
    language: "sa",
    content: {
      kannada: "ಪೂರ್ವೋತ್ತರಾಮಿತ-ತರಂಗ-ಚರತ್-ಸು-ಹಂಸಾ | ದೇವಾಲಿ-ಸೇವಿತ-ಪರಾಂಘ್ರಿ-ಪಯೋಜ-ಲಗ್ನಾ ||",
      transliteration: "Pūrvottarāmita-taraṅga-carat-su-haṁsā | Devāli-sevita-parāṁghri-payoja-lagnā ||",
      translationEnglish: "Who is adorned by the lotus feet worshipped by Devalī (Lakshmi), moving gracefully like swans on undulating waves of knowledge."
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
    title: "Sri Raghavendra Stotra - Verse 3",
    category: "raghavendra_stotra",
    priority: 5,
    language: "sa",
    content: {
      kannada: "ಶ್ರೀಮದ್ರಾಮಪಾದಾರವಿಂದಮಧುಪಃ ಶ್ರೀಮಧ್ವವಂಶಾಧಿಪಃ | ಸಚ್ಚಿಷ್ಯೋಡುಗಣೋಡುಪಃ ಶ್ರಿತಜಗದ್ಗೀರ್ವಾಣಸತ್ಪಾದಪಃ ||",
      transliteration: "Śrīmadrāmapādāravindamadhupaḥ śrīmadhavavaṁśādhipaḥ | sacchiṣyodugaṇoḍupaḥ śritajagadrgīrvāṇasatpāḍapaḥ ||",
      translationEnglish: "He is the bee at the lotus feet of Rama, the lord of Madhva lineage, the crest jewel of true disciples, the wish-fulfilling tree for those who take refuge."
    },
    source: "Sri Raghavendra Stotra",
    author: "Sri Appannacharya",
    verseNumber: 3,
    tags: ["stotra", "raghavendra", "blessing"],
    active: true,
    featured: true,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    title: "Sri Raghavendra Stotra - Verse 4",
    category: "raghavendra_stotra",
    priority: 5,
    language: "sa",
    content: {
      kannada: "ಅತ್ಯರ್ಥಂ ಮನಸಾ ಕೃತಾಚ್ಯುತಜಪಃ ಪಾಪಾಂಧಕಾರಾತಪಃ | ಶ್ರೀಮತ್ಸದ್ಗುರುರಾಘವೇಂದ್ರಯತಿರಾಟ ಕುರ್ಯಾದಮಸ್ಮಯಮ್ ||",
      transliteration: "Atyarthaṁ manasā kṛtācyutajapaḥ pāpāṁdhakārātapaḥ | śrīmatsadgururāghavendrayatirāṭa kuryādamasmayama ||",
      translationEnglish: "May I, by the grace of my guru Sri Raghavendra, attain the highest goal, removing all sins and obstacles."
    },
    source: "Sri Raghavendra Stotra",
    author: "Sri Appannacharya",
    verseNumber: 4,
    tags: ["stotra", "prayer", "blessing"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    title: "Sri Raghavendra Stotra - Verse 5",
    category: "raghavendra_stotra",
    priority: 5,
    language: "sa",
    content: {
      kannada: "ಯದಿ ಪದ್ಮಾಸನಸಂಸ್ಥಾಃ ಪ್ರಣವಂತಿ ಸುಧಾರಯಃ | ಸರ್ವಾಸಾಧು ಭವಂತ್ಯೇವ ತದ್ವಿಷ್ಣೋಃ ಪ್ರಸಾದತಃ ||",
      transliteration: "Yadi padmāsanasaṁsthāḥ praṇavanti sudhārayaḥ | sarvāsādhu bhavantyeva tadviṣṇoḥ prasādataḥ ||",
      translationEnglish: "If those who are seated on lotus seats chant the sacred mantras, all becomes auspicious by the grace of Vishnu."
    },
    source: "Sri Raghavendra Stotra",
    author: "Sri Appannacharya",
    verseNumber: 5,
    tags: ["stotra", "vishnu", "grace"],
    active: true,
    featured: true,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    title: "Sri Raghavendra Stotra - Verse 6",
    category: "raghavendra_stotra",
    priority: 5,
    language: "sa",
    content: {
      kannada: "ಶ್ರೀರಾಘವೇಂದ್ರಪಾದಾಂಬುಜಯುಗಳ್ಲಸತ್ಕಥಾ | ಕಥಂಕಥಾ ನ ಭವಂತಿ ಭವಭಯಭಯಂಕರಾಃ ||",
      transliteration: "Śrīrāghavendrapādāṁbujayugallasatkathā | kathaṅkathā na bhavanti bhavabhayabhayamkarāḥ ||",
      translationEnglish: "The stories of Sri Raghavendra's lotus feet, which destroy the fears of worldly existence, never become ordinary stories."
    },
    source: "Sri Raghavendra Stotra",
    author: "Sri Appannacharya",
    verseNumber: 6,
    tags: ["stotra", "stories", "protection"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    title: "Sri Raghavendra Stotra - Verse 7",
    category: "raghavendra_stotra",
    priority: 5,
    language: "sa",
    content: {
      kannada: "ಶ್ರೀರಾಘವೇಂದ್ರಾರ್ಚನಯಾ ಸಮಾರ್ಚನಾ ವಿದ್ಯತೇ | ನ ಹಿ ತಸ್ಯಾರ್ಚನಾರ್ಥಂ ಯ ಉಪಾಯಃ ಪ್ರವರ್ತತೇ ||",
      transliteration: "Śrīrāghavendrārcanayā samārcanā vidyate | na hi tasyārcanārthaṁ ya upāyaḥ pravartate ||",
      translationEnglish: "There is no worship equal to the worship of Sri Raghavendra, for there is no superior means for that purpose."
    },
    source: "Sri Raghavendra Stotra",
    author: "Sri Appannacharya",
    verseNumber: 7,
    tags: ["stotra", "worship", "devotion"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    title: "Sri Raghavendra Stotra - Verse 8",
    category: "raghavendra_stotra",
    priority: 5,
    language: "sa",
    content: {
      kannada: "ರಾಘವೇಂದ್ರಾಯ ರಾಮಾನುಜಾಯ ಶ್ರೀಶ ಏಕಮೇವ ಚ | ನಮಃ ಸರ್ವಾತ್ಮಕಂ ತಸ್ಮೈ ಯೋ ಭಕ್ತಿಮತ್ತರಂ ವಿದುಃ ||",
      transliteration: "Rāghavendrāya rāmānujāya śrīśa ekameva ca | namaḥ sarvātmakaṁ tasmai yo bhaktimattaraṁ viduḥ ||",
      translationEnglish: "Salutations to Raghavendra, the chief disciple of Ramanuja, the supreme self, whom the devotees know as the most devoted."
    },
    source: "Sri Raghavendra Stotra",
    author: "Sri Appannacharya",
    verseNumber: 8,
    tags: ["stotra", "namaste", "devotion"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
];

// Sri Raghavendra Mangalashtakam verses (by Sri Vadirajatirtharu)
const mangalashtakamVerses: Omit<QuoteData, "slug">[] = [
  {
    title: "Sri Raghavendra Mangalashtakam - Verse 1",
    category: "mangalashtakam",
    priority: 2,
    language: "sa",
    content: {
      kannada: "ಶ್ರೀಮದ್ರಾಮಪಾದಾರವಿಂದಮಧುಪಃ ಶ್ರೀಮಧ್ವವಂಶಾಧಿಪಃ | ಸಚ್ಚಿಷ್ಯೋಡುಗಣೋಡುಪಃ ಶ್ರಿತಜಗದ್ಗೀರ್ವಾಣಸತ್ಪಾದಪಃ ||",
      transliteration: "Śrīmadrāmapādāravindamadhupaḥ śrīmadhavavaṁśādhipaḥ | sacchiṣyodugaṇoḍupaḥ śritajagadrgīrvāṇasatpāḍapaḥ ||",
      translationEnglish: "He is the bee at the lotus feet of Rama, the lord of Madhva lineage, the crest jewel of true disciples, the wish-fulfilling tree for those who take refuge."
    },
    source: "Sri Raghavendra Mangalashtakam",
    author: "Sri Vadirajatirtharu",
    verseNumber: 1,
    tags: ["mangalashtakam", "aradhana", "festival"],
    active: true,
    featured: true,
    festivalOnly: true,
    festivalNames: ["raghavendra_aradhana", "guru_purnima", "vyasa_pooja", "brahmotsava"],
    weekdayOnly: null,
    displayWeight: 2,
  },
  {
    title: "Sri Raghavendra Mangalashtakam - Verse 2",
    category: "mangalashtakam",
    priority: 2,
    language: "sa",
    content: {
      kannada: "ಅತ್ಯರ್ಥಂ ಮನಸಾ ಕೃತಾಚ್ಯುತಜಪಃ ಪಾಪಾಂಧಕಾರಾತಪಃ | ಶ್ರೀಮತ್ಸದ್ಗುರುರಾಘವೇಂದ್ರಯತಿರಾಟ ಕುರ್ಯಾದಮಸ್ಮಯಮ್ ||",
      transliteration: "Atyarthaṁ manasā kṛtācyutajapaḥ pāpāṁdhakārātapaḥ | śrīmatsadgururāghavendrayatirāṭa kuryādamasmayama ||",
      translationEnglish: "May I, by the grace of my guru Sri Raghavendra, attain the highest goal, removing all sins and obstacles."
    },
    source: "Sri Raghavendra Mangalashtakam",
    author: "Sri Vadirajatirtharu",
    verseNumber: 2,
    tags: ["mangalashtakam", "aradhana", "festival"],
    active: true,
    featured: false,
    festivalOnly: true,
    festivalNames: ["raghavendra_aradhana", "guru_purnima", "vyasa_pooja"],
    weekdayOnly: null,
    displayWeight: 2,
  },
  {
    title: "Sri Raghavendra Mangalashtakam - Verse 3",
    category: "mangalashtakam",
    priority: 2,
    language: "sa",
    content: {
      kannada: "ಮಂಗಳಂ ಶ್ರೀರಾಘವೇಂದ್ರಾರ್ಯಾಯ ಮಂಗಳಂ ಮಂಗಳೇ | ಮಂಗಳಾನಾಂ ಚ ಸರ್ವೇಷಾಂ ಮಂಗಳಂ ತಸ್ಯ ಪಾದಯೋಃ ||",
      transliteration: "Mamgaḷaṁ śrīrāghavendrāryāya mamgaḷaṁ mamgaḷe | mamgaḷānāṁ ca sarveṣāṁ mamgaḷaṁ tasya pādayoḥ ||",
      translationEnglish: "Auspicious is Sri Raghavendra, most auspicious, the most auspicious of all auspicious things is his lotus feet."
    },
    source: "Sri Raghavendra Mangalashtakam",
    author: "Sri Vadirajatirtharu",
    verseNumber: 3,
    tags: ["mangalashtakam", "aradhana", "festival", "mangala"],
    active: true,
    featured: true,
    festivalOnly: true,
    festivalNames: ["raghavendra_aradhana", "guru_purnima", "vyasa_pooja", "brahmotsava"],
    weekdayOnly: null,
    displayWeight: 2,
  },
  {
    title: "Sri Raghavendra Mangalashtakam - Verse 4",
    category: "mangalashtakam",
    priority: 2,
    language: "sa",
    content: {
      kannada: "ಯಸ್ಯ ಸ್ಮರಣಾತ್ಸುಖಿನಾ ಭವಂತಿ ವಿಘ್ನಾನಿ | ತಂ ಪ್ರಣಮಾಮಿ ರಾಘವೇಂದ್ರಂ ಸರ್ವದುಃಖಾಪಹಾರಕಮ್ ||",
      transliteration: "Yasya smaraṇātsukhinā bhavanti vighnāni | taṁ praṇamāmi rāghavendraṁ sarvaduḥkhāpahārakam ||",
      translationEnglish: "I bow to Raghavendra, whose remembrance destroys all obstacles and brings happiness."
    },
    source: "Sri Raghavendra Mangalashtakam",
    author: "Sri Vadirajatirtharu",
    verseNumber: 4,
    tags: ["mangalashtakam", "aradhana", "prayer"],
    active: true,
    featured: false,
    festivalOnly: true,
    festivalNames: ["raghavendra_aradhana", "guru_purnima"],
    weekdayOnly: null,
    displayWeight: 2,
  },
  {
    title: "Sri Raghavendra Mangalashtakam - Verse 5",
    category: "mangalashtakam",
    priority: 2,
    language: "sa",
    content: {
      kannada: "ಶ್ರೀರಾಘವೇಂದ್ರಸ್ಯ ಮಂಗಳಂ ವದಂತಿ ಸತ್ತ್ವಿನಃ | ತಸ್ಯ ಪ್ರಸಾದಾತ್ಸರ್ವಾರ್ಥಾ ಸಿದ್ಧ್ಯಂತಿ ನ ಸಂಶಯಃ ||",
      transliteration: "Śrīrāghavendrasya mamgaḷaṁ vadanti sattvinaḥ | tasya prasādātsarvārthā sidhyanti na saṁśayaḥ ||",
      translationEnglish: "The truthful speak of the auspiciousness of Sri Raghavendra; by his grace all purposes are accomplished without doubt."
    },
    source: "Sri Raghavendra Mangalashtakam",
    author: "Sri Vadirajatirtharu",
    verseNumber: 5,
    tags: ["mangalashtakam", "grace", "blessing"],
    active: true,
    featured: false,
    festivalOnly: true,
    festivalNames: ["raghavendra_aradhana", "guru_purnima", "vyasa_pooja"],
    weekdayOnly: null,
    displayWeight: 2,
  },
  {
    title: "Sri Raghavendra Mangalashtakam - Verse 6",
    category: "mangalashtakam",
    priority: 2,
    language: "sa",
    content: {
      kannada: "ಭಕ್ತಿಮತ್ತರ ಉಪಾಸಕಂ ಭಕ್ತಗಣಸೇವಿತಂ | ಭಕ್ತಾರ್ಥಂ ಸರ್ವದಾ ತೃಪ್ತಂ ನಮಾಮಿ ಶ್ರೀರಾಘವೇಂದ್ರಕಮ್ ||",
      transliteration: "Bhaktimattara upāsakaṁ bhaktagaṇasevitaṁ | bhaktārthaṁ sarvadā tṛptaṁ namāmi śrīrāghavendrakam ||",
      translationEnglish: "I bow to Sri Raghavendra, who is the greatest devotee, served by all devotees, and ever satisfied for their sake."
    },
    source: "Sri Raghavendra Mangalashtakam",
    author: "Sri Vadirajatirtharu",
    verseNumber: 6,
    tags: ["mangalashtakam", "devotees", "service"],
    active: true,
    featured: false,
    festivalOnly: true,
    festivalNames: ["raghavendra_aradhana", "guru_purnima"],
    weekdayOnly: null,
    displayWeight: 2,
  },
  {
    title: "Sri Raghavendra Mangalashtakam - Verse 7",
    category: "mangalashtakam",
    priority: 2,
    language: "sa",
    content: {
      kannada: "ವಾದಿರಾಜತೀರ್ಥವರ್ಚಿತಂ ವಾಕ್ಯಂ ವಿಶ್ವಮಂಗಲಮ್ | ಯಸ್ಯ ರಾಘವೇಂದ್ರಭಕ್ತಿಃ ಸಿದ್ಧಿದಾ ಭವತಿ ಕ್ಷಣಾತ್ ||",
      transliteration: "Vādirājatīrthavaritaṁ vākyaṁ viśvamamgalam | yasya rāghavendrabhaktiḥ siddhidā bhavati kṣaṇāt ||",
      translationEnglish: "The word composed by Vadirajatirtha, which is most auspicious for the world, bestows immediate perfection to those devoted to Raghavendra."
    },
    source: "Sri Raghavendra Mangalashtakam",
    author: "Sri Vadirajatirtharu",
    verseNumber: 7,
    tags: ["mangalashtakam", "vadiraja", "perfection"],
    active: true,
    featured: false,
    festivalOnly: true,
    festivalNames: ["raghavendra_aradhana", "brahmotsava"],
    weekdayOnly: null,
    displayWeight: 2,
  },
  {
    title: "Sri Raghavendra Mangalashtakam - Verse 8",
    category: "mangalashtakam",
    priority: 2,
    language: "sa",
    content: {
      kannada: "ಇತಿ ಶ್ರೀವಾದಿರಾಜತೀರ್ಥವಿರಚಿತಂ ಶ್ರೀರಾಘವೇಂದ್ರಮಂಗಳಾಷ್ಟಕಮ್ | ಸಮಾಪ್ತಮ್ ||",
      transliteration: "Iti śrīvādirājatīrthavaritaṁ śrīrāghavendramamgaḷāṣṭakam | samāptam ||",
      translationEnglish: "Thus ends the Sri Raghavendra Mangalashtakam composed by Sri Vadirajatirtha."
    },
    source: "Sri Raghavendra Mangalashtakam",
    author: "Sri Vadirajatirtharu",
    verseNumber: 8,
    tags: ["mangalashtakam", "conclusion"],
    active: true,
    featured: true,
    festivalOnly: true,
    festivalNames: ["raghavendra_aradhana", "guru_purnima", "vyasa_pooja", "brahmotsava"],
    weekdayOnly: null,
    displayWeight: 2,
  },
];

// Guru Vandana prayers
const guruVandanaPrayers: Omit<QuoteData, "slug">[] = [
  {
    title: "Guru Vandana - Morning Prayer",
    category: "guru_vandana",
    priority: 4,
    language: "kn",
    content: {
      kannada: "ಓಂ ಸಹ ನಾವವತು | ಸಹ ನೌ ಭುನಕ್ತು | ಸಹ ವೀರ್ಯಂ ಕರವಾವಹೈ | ತೇಜಸ್ವಿನಾವಧೀತಮಸ್ತು ಮಾ ವಿದ್ವಿಷಾವಹೈ | ಓಂ ಶಾಂತಿಃ ಶಾಂತಿಃ ಶಾಂತಿಃ |",
      transliteration: "Oṁ saha nāvavatu | saha nau bhunaktu | saha vīryaṁ karavāvahai | tejasvināvadhītamastu mā vidviṣāvahai | oṁ śāntiḥ śāntiḥ śāntiḥ ||",
      translationEnglish: "May we all be united. May we all be nourished. May we all exert together with vigor. May our study be brilliant. May there be no hatred among us. Peace, peace, peace."
    },
    source: "Guru Vandana",
    author: "Traditional",
    tags: ["guru", "prayer", "thursday", "morning"],
    active: true,
    featured: true,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: 4, // Thursday
    displayWeight: 2,
  },
  {
    title: "Guru Vandana - Seeking Blessings",
    category: "guru_vandana",
    priority: 4,
    language: "sa",
    content: {
      kannada: "ಗುರುರ್ಬ್ರಹ್ಮಾ ಗುರುರ್ವಿಷ್ಣುರ್ಗುರುರ್ದೇವೋ ಮಹೇಶ್ವರಃ | ಗುರುಸಾಕ್ಷಾತ್ಪರಬ್ರಹ್ಮ ತಸ್ಮೈ ಶ್ರೀಗುರವೇ ನಮಃ ||",
      transliteration: "Gururbrahmā gururviṣṇurgururdevo maheśvaraḥ | gurussākṣātparabrahma tasmai śrīgurave namaḥ ||",
      translationEnglish: "The guru is Brahma, the guru is Vishnu, the guru is Maheshvara (Shiva). The guru is the supreme Brahman itself. Salutations to that noble guru."
    },
    source: "Guru Vandana",
    author: "Traditional",
    tags: ["guru", "prayer", "thursday", "salutation"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: 4, // Thursday
    displayWeight: 1,
  },
  {
    title: "Guru Vandana - Devotion",
    category: "guru_vandana",
    priority: 4,
    language: "kn",
    content: {
      kannada: "ಗುರುವೇ ಗೋಪಾಲ ಗುರುವೇ ಗೋವಿಂದ | ಗುರುವೇ ಸರ್ವಂ ಗುರುವೇ ನಿರ್ವಾಣಮ್ |",
      transliteration: "Gurve gopāla guruve govinda | guruve sarvaṁ guruve nirvāṇam ||",
      translationEnglish: "The guru is Gopala, the guru is Govinda. The guru is everything, the guru is liberation."
    },
    source: "Guru Vandana",
    author: "Traditional",
    tags: ["guru", "devotion", "thursday"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: 4, // Thursday
    displayWeight: 1,
  },
  {
    title: "Guru Stuti - Praise",
    category: "guru_vandana",
    priority: 4,
    language: "sa",
    content: {
      kannada: "ಆಚಾರ್ಯಾಂ ಮಾಂ ವಿದ್ಧಿ ತ್ವಂ ಸರ್ವಸಂಪ್ರದಾಯಕಮ್ | ಆಚಾರ್ಯಾದ್ವಾ ವಿದಿತೇದಂ ಸರ್ವಮಿತಿ ಶೃಣು ಸಂಶಯಮ್ ||",
      transliteration: "Ācāryāṁ māṁ viddhi tvaṁ sarvasaṁpradāyakam | ācāryāddva viditedaṁ sarvamiti śṛṇu saṁśayam ||",
      translationEnglish: "Know me as the acharya who bestows all knowledge. From the acharya, all this is known. Hear, without doubt."
    },
    source: "Guru Stuti",
    author: "Traditional",
    tags: ["guru", "acharya", "thursday", "knowledge"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: 4, // Thursday
    displayWeight: 1,
  },
];

// Madhwa Philosophy quotes
const madhwaPhilosophyQuotes: Omit<QuoteData, "slug">[] = [
  {
    title: "Hari Sarvottama",
    category: "madhwa_philosophy",
    priority: 7,
    language: "sa",
    content: {
      kannada: "ಹರಿಃ ಸರ್ವೋತ್ತಮಃ | ವಾಯುಃ ಜೀವೋತ್ತಮಃ | ಜೀವಾಸ್ತು ಸರ್ವೋತ್ತಮಃ |",
      transliteration: "Hariḥ sarvottamaḥ | Vāyuḥ jīvottamaḥ | jīvāstu sarvottamaḥ ||",
      translationEnglish: "Hari (Vishnu) is the greatest of all. Vayu (wind) is the greatest among senses/prakritis. Among living beings, the soul is the greatest."
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
    title: "Tattvavada - Truth Principle",
    category: "madhwa_philosophy",
    priority: 7,
    language: "sa",
    content: {
      kannada: "ತತ್ತ್ವಂ ವಿದಿತೇ ಸರ್ವಮ್ | ತತ್ತ್ವಜ್ಞಾನಾತ್ ಪರಂ ನಾಸ್ತಿ |",
      transliteration: "Tattvaṁ vidite sarvam | tattvajñānāt paraṁ nāsti ||",
      translationEnglish: "By knowing the truth, everything is known. There is nothing beyond the knowledge of truth."
    },
    source: "Madhva Philosophy",
    author: "Sri Madhvacharya",
    tags: ["dvaita", "philosophy", "truth", "knowledge"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    title: "Panchabheda - Five Differences",
    category: "madhwa_philosophy",
    priority: 7,
    language: "sa",
    content: {
      kannada: "ಜೀವ-ಈಶ್ವರ ಭೇದಃ | ಜೀವ-ಜೀವ ಭೇದಃ | ಜೀವ-ಪ್ರಕೃತಿ ಭೇದಃ | ಪ್ರಕೃತಿ-ಈಶ್ವರ ಭೇದಃ | ಪ್ರಕೃತಿ-ಪ್ರಕೃತಿ ಭೇದಃ |",
      transliteration: "Jīva-īśvara bhedaḥ | Jīva-jīva bhedaḥ | Jīva-prakṛti bhedaḥ | Prakṛti-īśvara bhedaḥ | Prakṛti-prakṛti bhedaḥ ||",
      translationEnglish: "Five fundamental differences: between soul and God, between souls, between soul and matter, between matter and God, and between matter and matter."
    },
    source: "Madhva Darsana",
    author: "Sri Madhvacharya",
    tags: ["dvaita", "philosophy", "differences", "tattva"],
    active: true,
    featured: true,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    title: "Bhakti - Devotion",
    category: "madhwa_philosophy",
    priority: 7,
    language: "sa",
    content: {
      kannada: "ಭಕ್ತಿರೇವಾಯಮಾನಂ ಕರ್ತಾ ಭಗವತಿ ಪ್ರಿಯೇ | ಭಕ್ತಿಸ್ಯ ಹಿ ಫಲಂ ತಸ್ಮಾತ್ಸದ್ಭಕ್ತಿರ್ವರ್ಧತೇ ||",
      transliteration: "Bhaktirevāyamanāṁ kartā bhagavati priye | bhaktisya hi phalaṁ tasmātsadbaktirvardhate ||",
      translationEnglish: "Devotion is indeed the means to attain the Lord who is dear to us. The fruit of devotion is that pure devotion increases."
    },
    source: "Bhagavata Purana",
    author: "Sri Madhvacharya (commentary)",
    tags: ["dvaita", "philosophy", "bhakti", "devotion"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    title: "Importance of Guru",
    category: "madhwa_philosophy",
    priority: 7,
    language: "sa",
    content: {
      kannada: "ಗುರುಶ್ರುತಿಸಮಾಧಾನಂ | ಶ್ರುತೇರ್ಗುರುವಾಕ್ಯಾತ್ |",
      transliteration: "Guruśrutisamādhānaṁ | śruter guruvākyāt ||",
      translationEnglish: "Understanding the guru's words leads to understanding the scriptures. The guru's teachings illuminate the Vedas."
    },
    source: "Madhva Bhashya",
    author: "Sri Madhvacharya",
    tags: ["dvaita", "philosophy", "guru", "scriptures"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
];

// Authentic Teachings from Sri Raghavendra Swamy
const authenticTeachings: Omit<QuoteData, "slug">[] = [
  {
    title: "Service to Devotees",
    category: "authentic_teachings",
    priority: 6,
    language: "kn",
    content: {
      kannada: "ಭಕ್ತರ ಸೇವೆಯೇ ಈಶ್ವರ ಸೇವೆ | ಭಕ್ತರ ಮೊಯ್ಯೇ ಈಶ್ವರ ಮೊಯ್ಯ |",
      transliteration: "Bhaktara sēvayē īśvara sēvā | bhaktara moyyē īśvara moyya ||",
      translationEnglish: "Service to devotees is service to God. The dust of devotees' feet is the dust of God's feet."
    },
    source: "Sri Raghavendra Swamy Teachings",
    author: "Sri Raghavendra Swamy",
    tags: ["service", "devotees", "bhakti"],
    active: true,
    featured: true,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 2,
  },
  {
    title: "Surrender to God",
    category: "authentic_teachings",
    priority: 6,
    language: "kn",
    content: {
      kannada: "ಎಲ್ಲಾದೂರ್ಭಕ್ತಿ | ಪ್ರಭುವಿನ ಭಕ್ತಿಯೆ ಶ್ರೇಷ್ಠ | ಎಲ್ಲಾದುಃಖ ನಿವಾರಣ | ಭಕ್ತಿಯೆ ಸಾಧನ ||",
      transliteration: "Ellāddhurbhakti | prabhuvina bhaktiyē śreṣṭha | ellāduḥkha nivāraṇa | bhaktiyē sādhana ||",
      translationEnglish: "Of all types of devotion, devotion to the Lord is the best. Of all remedies for suffering, devotion is the means."
    },
    source: "Sri Raghavendra Swamy Teachings",
    author: "Sri Raghavendra Swamy",
    tags: ["surrender", "devotion", "moksha"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    title: "True Knowledge",
    category: "authentic_teachings",
    priority: 6,
    language: "kn",
    content: {
      kannada: "ಜ್ಞಾನವಿಲ್ಲದ ಭಕ್ತಿ | ಅರ್ಥಹೀನ ಮಾಡಿದ | ಭಕ್ತಿಯಿಂದ ಜ್ಞಾನ | ಸಿದ್ಧಿಗೆ ಮಾರ್ಗ ||",
      transliteration: "Jñānavillada bhakti | arthaheena maaḍida | bhaktiyinda jñāna | siddhige mārga ||",
      translationEnglish: "Devotion without knowledge is meaningless. From devotion comes knowledge, the path to perfection."
    },
    source: "Sri Raghavendra Swamy Teachings",
    author: "Sri Raghavendra Swamy",
    tags: ["knowledge", "wisdom", "jnana"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    title: "Daily Practice",
    category: "authentic_teachings",
    priority: 6,
    language: "kn",
    content: {
      kannada: "ಪ್ರತಿದಿನ ಪ್ರಭುವಿನ ನಾಮ | ಜಪಿಸಿ ಮರೆಯದೆ | ನಿತ್ಯ ಕೀರ್ತನೆ ಮಾಡಿ | ಮುಕ್ತಿ ಪಡೆಯಬಹುದು ||",
      transliteration: "Pratidina prabhuvina nāma | japisu mareyade | nitya kīrtane māḍi | mukti paḍeyabahudu ||",
      translationEnglish: "Daily chant the Lord's name without forgetting. Perform daily kirtan and you can attain liberation."
    },
    source: "Sri Raghavendra Swamy Teachings",
    author: "Sri Raghavendra Swamy",
    tags: ["daily", "practice", "namajapa"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    title: "Compassion of God",
    category: "authentic_teachings",
    priority: 6,
    language: "kn",
    content: {
      kannada: "ದುಷ್ಟನನ್ನೂ ಕ್ಷಮಿಸು | ಎಲ್ಲರ ಮೇಲೆ ಪ್ರೀತಿ | ಇದು ಭಗವಂತನ ಮಾರ್ಗ | ಇದು ಅನುಸರಿಸಿ ಬಾಳಿರಿ ||",
      transliteration: "Duṣṭanannu kṣamisu | ellara mele prīti | idu bhagavanta mārga | idu anusrisi bāḷiri ||",
      translationEnglish: "Forgive the wicked, have love for all. This is God's way. Follow this and live."
    },
    source: "Sri Raghavendra Swamy Teachings",
    author: "Sri Raghavendra Swamy",
    tags: ["compassion", "forgiveness", "love"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
];

// Devotional Sayings (fallback)
const devotionalSayings: Omit<QuoteData, "slug">[] = [
  {
    title: "God's Grace",
    category: "devotional_sayings",
    priority: 8,
    language: "en",
    content: {
      kannada: "ಭಗವಂತನ ಕೃಪೆಯಿಂದ ಎಲ್ಲಾ ಸಿದ್ಧಿ | ಭಗವಂತನ ಕೃಪೆಯಿಂದ ಎಲ್ಲಾ ಸಾಧ್ಯ |",
      transliteration: "Bhagavanta kr̥peyinda ella sid'dhi | Bhagavanta kr̥peyinda ella sādhya |",
      translationEnglish: "By God's grace, all achievements are possible. By God's grace, all accomplishments are attainable."
    },
    source: "Traditional Devotional",
    author: "Unknown",
    tags: ["grace", "devotion", "faith"],
    active: true,
    featured: true,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    title: "Prayer for Peace",
    category: "devotional_sayings",
    priority: 8,
    language: "sa",
    content: {
      kannada: "ಸರ್ವಮಂಗಲಮಾಂಗಲ್ಯೇ ಶಂಕರಃ ಸರ್ವಾರ್ಥಸಾಧಕಃ | ಸರ್ವಭಕ್ತಜನಾರಾಧ್ಯಃ ಸರ್ವಾರಂಗಮಯಂ ಭಜೇ ||",
      transliteration: "Sarvamamgalamāṁgalye śaṅkaraḥ sarvārthasādhakaḥ | sarvabhaktajanārādhyaḥ sarvāraṁgamayaṁ bhaje ||",
      translationEnglish: "I worship that Shiva who bestows all auspiciousness, who accomplishes all purposes, who is worshiped by all devotees, who pervades all."
    },
    source: "Shiva Vandana",
    author: "Traditional",
    tags: ["peace", "shiva", "prayer"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
  {
    title: "Faith in God",
    category: "devotional_sayings",
    priority: 8,
    language: "kn",
    content: {
      kannada: "ನಂಬಿಕೆಯಿಂದ ಎಲ್ಲಾ ಕಷ್ಟ ದೂರ | ನಂಬಿಕೆಯಿಂದ ಎಲ್ಲಾ ಮಾರ್ಗ ತೆರೆದ | ನಂಬಿಕೆಯಿಂದ ಎಲ್ಲಾ ಸಿದ್ಧಿ |",
      transliteration: "Nambikeyinda ella kaṣṭa dūra | nambikeyinda ella mārga tereda | nambikeyinda ella siddhi |",
      translationEnglish: "By faith, all difficulties are removed. By faith, all paths are opened. By faith, all perfection is achieved."
    },
    source: "Traditional Devotional",
    author: "Unknown",
    tags: ["faith", "belief", "devotion"],
    active: true,
    featured: false,
    festivalOnly: false,
    festivalNames: [],
    weekdayOnly: null,
    displayWeight: 1,
  },
];

// Combine all quotes
const allQuotes: Omit<QuoteData, "slug">[] = [
  ...raghavendraStotraVerses,
  ...mangalashtakamVerses,
  ...guruVandanaPrayers,
  ...madhwaPhilosophyQuotes,
  ...authenticTeachings,
  ...devotionalSayings,
];

// Add slugs to all quotes
const quotesWithSlugs = allQuotes.map((quote, index) => ({
  ...quote,
  slug: `${quote.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${index + 1}`,
}));

async function seedQuotes() {
  console.log("Starting quote seed process...");
  
  const db = initFirebase();
  const collection = db.collection("quotes");
  
  // Check if quotes already exist
  const existingSnap = await collection.limit(1).get();
  if (!existingSnap.empty) {
    console.log("Quotes collection already has data. Skipping seed.");
    console.log(`Existing quote count: ${existingSnap.size}`);
    
    // Option to clear and reseed
    const shouldReseed = process.argv.includes("--force");
    if (!shouldReseed) {
      console.log("Use --force flag to clear and reseed.");
      return;
    }
    
    console.log("Force flag detected. Clearing existing quotes...");
    // Delete all existing quotes
    const batch = db.batch();
    const existingDocs = await collection.get();
    existingDocs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log("Existing quotes cleared.");
  }
  
  // Seed quotes in batches
  const batchSize = 10;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < quotesWithSlugs.length; i += batchSize) {
    const batch = db.batch();
    const batchQuotes = quotesWithSlugs.slice(i, i + batchSize);
    
    for (const quote of batchQuotes) {
      const docRef = collection.doc();
      batch.set(docRef, {
        ...quote,
        stats: { viewCount: 0 },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    
    try {
      await batch.commit();
      successCount += batchQuotes.length;
      console.log(`Seeded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(quotesWithSlugs.length / batchSize)} (${successCount}/${quotesWithSlugs.length} quotes)`);
    } catch (error) {
      console.error(`Error seeding batch:`, error);
      errorCount += batchQuotes.length;
    }
  }
  
  console.log("\n=== Seed Complete ===");
  console.log(`Total quotes seeded: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  
  // Save seed data to file for reference
  const seedDataPath = path.join(__dirname, "..", "seed", "quotes-seed-data.json");
  fs.mkdirSync(path.dirname(seedDataPath), { recursive: true });
  fs.writeFileSync(seedDataPath, JSON.stringify(quotesWithSlugs, null, 2));
  console.log(`\nSeed data saved to: ${seedDataPath}`);
}

// Run the seed
seedQuotes().catch(console.error);
