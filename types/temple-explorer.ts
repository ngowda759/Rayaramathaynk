/**
 * Temple Explorer Types
 * Interactive temple map and facility information
 */

export interface TempleArea {
  id: string;
  name: string;
  nameKannada?: string;
  description: string;
  significance?: string;
  icon: string;
  imageUrl?: string;
  category: TempleAreaCategory;
  features?: string[];
  bestTimeToVisit?: string;
  tips?: string[];
  has360View?: boolean;
}

export type TempleAreaCategory = 
  | "sanctum"
  | "halls"
  | "facilities"
  | "gardens"
  | "historical";

export interface TempleFacility {
  id: string;
  name: string;
  description: string;
  icon: string;
  location: string;
  available: boolean;
  timings?: string;
  charges?: string;
}

export interface TempleTimings {
  day: string;
  openTime: string;
  closeTime: string;
  specialInstructions?: string;
}

export interface Temple360View {
  areaId: string;
  title: string;
  thumbnailUrl: string;
  embedUrl?: string;
}

export const TEMPLE_COORDINATES = {
  latitude: 13.096788188005597,
  longitude: 77.58461022456063,
  address: "428/20, 8th A Cross Rd, Yelahanka Satellite Town, Yelahanka, Bengaluru, Karnataka 560064",
  phone: "+91 80 2332 3456",
};

/**
 * Temple areas with detailed information
 */
export const TEMPLE_AREAS: TempleArea[] = [
  {
    id: "garbhagriha",
    name: "Garbhagriha (Sanctum Sanctorum)",
    nameKannada: "ಗರ್ಭಗೃಹ",
    description: "The innermost sacred chamber housing the presiding deity of Lord Venkateshwara with Lord Rama and Sita",
    significance: "This is the most sacred part of the temple where the main deity is enshrined",
    icon: "🕉️",
    category: "sanctum",
    features: [
      "Main Deity: Lord Venkateshwara",
      "Sri Rama and Sita deities on either side",
      "Golden krubas (garlands) and ornaments",
      "Sacred sandal paste applied daily"
    ],
    bestTimeToVisit: "5:30 AM - 12:00 PM",
    tips: [
      "Maintain silence in the sanctum",
      "Remove footwear before entry",
      "Offerings available at the counter"
    ]
  },
  {
    id: "navagraha-shrine",
    name: "Navagraha Shrine",
    nameKannada: "ನವಗ್ರಹ ಸ್ಥಾನ",
    description: "Nine planetary deities arranged in a semi-circular arrangement representing the nine planets",
    significance: "Worshipping Navagrahas is believed to mitigate planetary afflictions",
    icon: "🌌",
    category: "sanctum",
    features: [
      "Surya (Sun)",
      "Chandra (Moon)",
      "Mangal (Mars)",
      "Budha (Mercury)",
      "Guru (Jupiter)",
      "Shukra (Venus)",
      "Shani (Saturn)",
      "Rahu (North Node)",
      "Ketu (South Node)"
    ],
    bestTimeToVisit: "6:00 AM - 8:00 PM",
    tips: [
      "Special pujas performed on Sundays",
      "Rahu-Ketu dosha pujas available"
    ]
  },
  {
    id: "navaranga-mantapa",
    name: "Navaranga Mantapa",
    nameKannada: "ನವರಂಗ ಮಂಟಪ",
    description: "The inner hall with nine compartments where devotees gather for special poojas and discourses",
    significance: "Used for daily archana, sahasranamarcha, and special sevas",
    icon: "🏛️",
    category: "halls",
    features: [
      "Nine-pillar structure representing nine rasas",
      "Venkataramana deity for archana",
      "Space for 200+ devotees",
      "Sound system for bhajans"
    ],
    bestTimeToVisit: "8:00 AM - 12:00 PM",
    tips: [
      "Join the daily sahasranamarcha at 10 AM",
      "Archana passes available at counter"
    ]
  },
  {
    id: "rathna-mantapa",
    name: "Rathna Mantapa (Assembly Hall)",
    nameKannada: "ರತ್ನ ಮಂಟಪ",
    description: "The grand assembly hall with ornate pillars and intricate carvings",
    significance: "Used for special ceremonies, weddings, and spiritual gatherings",
    icon: "💎",
    category: "halls",
    features: [
      "24 intricately carved pillars",
      "Brass lamps arrangement",
      "Capacity for 500+ devotees",
      "Stage for cultural programs"
    ],
    bestTimeToVisit: "9:00 AM - 6:00 PM",
    tips: [
      "Book in advance for ceremonies",
      "Photography allowed in outer area"
    ]
  },
  {
    id: "kalyana-mantapa",
    name: "Kalyana Mantapa (Marriage Hall)",
    nameKannada: "ಕಲ್ಯಾಣ ಮಂಟಪ",
    description: "Elegant marriage hall for conducting traditional Hindu weddings",
    significance: "Sacred space for conducting weddings following Vedic rituals",
    icon: "💒",
    category: "halls",
    features: [
      "Traditional wedding decorations",
      "Mandapam with 8 pillars",
      "Marriage altar setup",
      "Guest accommodation available"
    ],
    bestTimeToVisit: "By appointment only",
    tips: [
      "Book at least 3 months in advance",
      "Contact office for booking"
    ]
  },
  {
    id: "bhajan-mantapa",
    name: "Bhajan Mantapa",
    nameKannada: "ಭಜನ ಮಂಟಪ",
    description: "Devotional hall for group singing of bhajans and keerthanas",
    significance: "Center for daily bhajan sessions and spiritual gatherings",
    icon: "🎵",
    category: "halls",
    features: [
      "Daily evening bhajans at 6 PM",
      "Musical instruments available",
      "Comfortable seating",
      "AC facility"
    ],
    bestTimeToVisit: "6:00 PM - 8:00 PM (Daily)",
    tips: [
      "Participate in the evening bhajan",
      "Devotees welcome to lead bhajans"
    ]
  },
  {
    id: "dharma-shala",
    name: "Dharma Shala (Guest House)",
    nameKannada: "ಧರ್ಮಶಾಲಾ",
    description: "Free accommodation for visiting devotees and pilgrims",
    significance: "Provides free stay for devotees traveling from afar",
    icon: "🏠",
    category: "facilities",
    features: [
      "Free lodging for devotees",
      "Pure vegetarian meals",
      "Clean rooms with attached bathrooms",
      "24-hour water supply"
    ],
    bestTimeToVisit: "24 hours",
    tips: [
      "Prior registration recommended",
      "Donations welcome for maintenance"
    ]
  },
  {
    id: "anna-dana-shetra",
    name: "Anna Dana Shetra (Free Kitchen)",
    nameKannada: "ಅನ್ನದಾನ ಶೆಟ್ರ",
    description: "Free vegetarian meals served to all devotees daily",
    significance: "Practice of anna daana (food donation) as a sacred virtue",
    icon: "🍲",
    category: "facilities",
    features: [
      "Free lunch daily (12:00 PM - 2:00 PM)",
      "Pure sattvic vegetarian food",
      "Clean dining hall",
      "Takeaway available"
    ],
    bestTimeToVisit: "12:00 PM - 2:00 PM",
    tips: [
      "Donations for anna daana welcome",
      "Volunteers can help in kitchen"
    ]
  },
  {
    id: "pushkarini",
    name: "Pushkarini (Sacred Tank)",
    nameKannada: "ಪುಷ್ಕರಿಣಿ",
    description: "Ancient sacred pond for ritual bathing and ceremonies",
    significance: "Tirtha (pilgrimage) site for ritual purification",
    icon: "💧",
    category: "gardens",
    features: [
      "Sacred water for rituals",
      "Connected to temple well",
      "Sculptures of divine beings",
      "Peaceful surroundings"
    ],
    bestTimeToVisit: "6:00 AM - 6:00 PM",
    tips: [
      "Bathing not allowed",
      "Take holy dip on auspicious days"
    ]
  },
  {
    id: "brindavan",
    name: "Brindavan (Sacred Garden)",
    nameKannada: "ಬೃಂದಾವನ",
    description: "Serene garden with tulasi plants and sacred trees",
    significance: "Represents Vrindavan, Krishna's divine playground",
    icon: "🌿",
    category: "gardens",
    features: [
      "100+ Tulasi plants",
      "Sacred basil collection",
      "Meditation corners",
      "Bird sanctuary"
    ],
    bestTimeToVisit: "6:00 AM - 6:00 PM",
    tips: [
      "Offer prayers to Tulasi",
      "Photography encouraged"
    ]
  },
  {
    id: "bramhostava-stage",
    name: "Bramhostava Stage",
    nameKannada: "ಬ್ರಹ್ಮೋತ್ಸವ ವೇದಿಕೆ",
    description: "Grand stage for annual festival celebrations and processions",
    significance: "Main venue for the annual Aaradhane festival",
    icon: "🎪",
    category: "historical",
    features: [
      "Canopy for 1000+ devotees",
      "Processional deity display",
      "Sound and light system",
      "Festival decorations"
    ],
    bestTimeToVisit: "During festivals",
    tips: [
      "Best experienced during Aaradhane",
      "Arrive early for good viewing"
    ]
  }
];

/**
 * Temple timings
 */
export const TEMPLE_TIMINGS: TempleTimings[] = [
  { day: "Monday", openTime: "5:30 AM", closeTime: "12:00 PM", specialInstructions: "Special puja at 9 AM" },
  { day: "Tuesday", openTime: "5:30 AM", closeTime: "12:00 PM", specialInstructions: "Special puja at 9 AM" },
  { day: "Wednesday", openTime: "5:30 AM", closeTime: "12:00 PM", specialInstructions: "Special puja at 9 AM" },
  { day: "Thursday", openTime: "5:30 AM", closeTime: "12:00 PM", specialInstructions: "Special puja at 9 AM" },
  { day: "Friday", openTime: "5:30 AM", closeTime: "12:00 PM", specialInstructions: "Special puja at 9 AM" },
  { day: "Saturday", openTime: "5:30 AM", closeTime: "12:00 PM", specialInstructions: "Special puja at 9 AM" },
  { day: "Sunday", openTime: "5:30 AM", closeTime: "12:30 PM", specialInstructions: "Extended darshan" },
];

export const EVENING_TIMINGS = {
  openTime: "4:00 PM",
  closeTime: "8:30 PM",
  specialInstructions: "Evening bhajan at 6 PM"
};

/**
 * Get area by ID
 */
export function getTempleAreaById(id: string): TempleArea | undefined {
  return TEMPLE_AREAS.find(area => area.id === id);
}

/**
 * Get areas by category
 */
export function getAreasByCategory(category: TempleAreaCategory): TempleArea[] {
  return TEMPLE_AREAS.filter(area => area.category === category);
}

/**
 * Category labels
 */
export const CATEGORY_LABELS: Record<TempleAreaCategory, string> = {
  sanctum: "Sacred Sanctuaries",
  halls: "Halls & Mantapas",
  facilities: "Facilities",
  gardens: "Gardens & Ponds",
  historical: "Historical Sites",
};

/**
 * Category colors
 */
export const CATEGORY_COLORS: Record<TempleAreaCategory, { bg: string; text: string }> = {
  sanctum: { bg: "bg-orange-100", text: "text-orange-700" },
  halls: { bg: "bg-amber-100", text: "text-amber-700" },
  facilities: { bg: "bg-blue-100", text: "text-blue-700" },
  gardens: { bg: "bg-green-100", text: "text-green-700" },
  historical: { bg: "bg-purple-100", text: "text-purple-700" },
};
