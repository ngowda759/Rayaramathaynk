/**
 * Festival Data Transformers
 * Convert raw calendar data to Festival types
 */

import { Festival } from "@/types/festival";
import { calendar } from "@/data/calendar";

/**
 * Major festivals that are especially important
 */
const MAJOR_FESTIVALS = [
  "Navaratri",
  "Durgashtami",
  "Mahanavami",
  "Vijayadashami",
  "Deepavali",
  "Makara Sankramana",
  "Mahashivaratri",
  "Sri Madhwa Navami",
  "Anantha Chaturdashi",
  "Ratha Saptami",
];

/**
 * Festival descriptions
 */
const FESTIVAL_DESCRIPTIONS: Record<string, string> = {
  "Naga Chaturthi": "Worship of Lord Naga (serpent deity) for protection and prosperity",
  "Naga Panchami": "Traditional worship of serpents, especially Cobra",
  "Rig Upakarma": "Sacred thread ceremony for Rigvedic practitioners",
  "Varamahalakshmi": "Worship of Goddess Lakshmi on the Friday before full moon",
  "Yajur Upakarma": "Sacred thread ceremony for Yajurvedic practitioners",
  "Krishna Jayanti": "Birth celebration of Lord Krishna",
  "Gowri & Ganesha": "Festival honoring Goddess Gowri and Lord Ganesha",
  "Rishi Panchami": "Worship of sages and ancestors",
  "Anantha Chaturdashi": "Worship of Lord Anantha (infinite)",
  "Navaratri Begins": "Nine nights of divine mother worship",
  "Saraswati Pooja": "Worship of Goddess Saraswati, goddess of knowledge",
  "Durgashtami": "Worship of Goddess Durga",
  "Mahanavami": "Final day of Navaratri celebrations",
  "Vijayadashami": "Day of victory - marks the triumph of good over evil",
  "Jalapoorna Trayodashi": "Sacred bathing day",
  "Naraka Chaturdashi": "Day commemorating Lord Krishna's victory over Narakasura",
  "Deepavali Amavasya": "Festival of lights celebrating Lakshmi puja",
  "Balipadya": "Worship of Bali (Vishnu's devotee)",
  "Tulasi Habba & Uthana Dvadashi": "Wedding ceremony of Tulasi and Lord Vishnu",
  "Hanumad Vratha": "Observance in honor of Hanuman",
  "Makara Sankramana": "Sun's transition to Capricorn - major auspicious day",
  "Ratha Saptami": "Sun god Surya's birthday celebrated",
  "Bheeshmashtami": "Worship of Bhishma Pitamaha",
  "Sri Madhwa Navami": "Celebration of Sri Madhvacharya's teachings",
  "Mahashivaratri": "Night of Lord Shiva's worship",
  "Holi": "Festival of colors celebrating spring",
};

/**
 * Festival deities
 */
const FESTIVAL_DEITIES: Record<string, string> = {
  "Naga Chaturthi": "Lord Naga",
  "Naga Panchami": "Naga Devatas",
  "Krishna Jayanti": "Lord Krishna",
  "Gowri & Ganesha": "Goddess Gowri & Lord Ganesha",
  "Navaratri Begins": "Goddess Durga",
  "Saraswati Pooja": "Goddess Saraswati",
  "Durgashtami": "God Goddess Durga",
  "Mahanavami": "Goddess Durga",
  "Vijayadashami": "Goddess Durga",
  "Deepavali Amavasya": "Goddess Lakshmi",
  "Balipadya": "Lord Vishnu (as Bali)",
  "Tulasi Habba & Uthana Dvadashi": "Lord Vishnu",
  "Makara Sankramana": "Lord Surya",
  "Ratha Saptami": "Lord Surya",
  "Sri Madhwa Navami": "Sri Madhvacharya",
  "Mahashivaratri": "Lord Shiva",
  "Holi": "Lord Krishna",
};

/**
 * Get season based on month
 */
function getSeason(month: number): Festival["season"] {
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "monsoon";
  if (month >= 8 && month <= 9) return "autumn";
  if (month >= 10 && month <= 11) return "winter";
  return "winter"; // Dec-Jan
}

/**
 * Convert calendar festivals to Festival type
 */
export function transformFestivals(calendars: typeof calendar): Festival[] {
  return calendars.festivals.map((festival) => {
    const date = new Date(festival.date);
    const month = date.getMonth();
    const dayOfWeek = date.toLocaleDateString("en-IN", { weekday: "long" });
    
    const name = festival.festival;
    const isMajor = MAJOR_FESTIVALS.some(m => 
      name.toLowerCase().includes(m.toLowerCase())
    );

    return {
      id: name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      name,
      date: festival.date,
      dayOfWeek,
      description: FESTIVAL_DESCRIPTIONS[name] || `Celebration of ${name}`,
      details: FESTIVAL_DESCRIPTIONS[name] || undefined,
      significance: getSignificance(name),
      practices: getPractices(name),
      deity: FESTIVAL_DEITIES[name],
      isMajor,
      month: MONTH_NAMES[month],
      season: getSeason(month),
    };
  });
}

/**
 * Get significance for a festival
 */
function getSignificance(name: string): string | undefined {
  const significances: Record<string, string> = {
    "Navaratri Begins": "Nine nights dedicated to the divine feminine energy",
    "Vijayadashami": "Marks the victory of dharma over adharma",
    "Deepavali Amavasya": "Festival of lights celebrating inner light and prosperity",
    "Mahashivaratri": "Night of Lord Shiva's divine dance",
    "Makara Sankramana": "Transition of sun into Capricorn - highly auspicious",
    "Sri Madhwa Navami": "Honoring the birth of Sri Madhvacharya",
  };
  return significances[name];
}

/**
 * Get traditional practices for a festival
 */
function getPractices(name: string): string[] | undefined {
  const practices: Record<string, string[]> = {
    "Navaratri Begins": ["Goddess Durga worship", "Koluvu (display of dolls)", "Traditional music and dance"],
    "Vijayadashami": ["Vidyarambham (children's first learning)", "Ayudha Puja", "Seemar Rebbalu"],
    "Deepavali Amavasya": ["Lakshmi Puja", "Lighting diyas", "Home cleaning"],
    "Mahashivaratri": ["Night vigil", "Rudrabhishekam", "Fasting"],
  };
  return practices[name];
}

const MONTH_NAMES: Record<number, string> = {
  0: "January",
  1: "February",
  2: "March",
  3: "April",
  4: "May",
  5: "June",
  6: "July",
  7: "August",
  8: "September",
  9: "October",
  10: "November",
  11: "December",
};

/**
 * Get all transformed festivals
 */
export function getAllFestivals(): Festival[] {
  return transformFestivals(calendar);
}
