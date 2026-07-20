import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { TempleArea, TempleAreaCategory } from "@/types/temple-explorer";

const COLLECTION = "temple_areas";

class TempleAreasService {
  /**
   * Get all temple areas from Firestore
   * Does NOT fall back to defaults - admin should only see what's in the database
   */
  async getAreas(): Promise<TempleArea[]> {
    if (!db) {
      return [];
    }
    
    try {
      const q = query(collection(db, COLLECTION), orderBy("order", "asc"));
      const snapshot = await getDocs(q);
      const areas = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as TempleArea[];
      
      return areas;
    } catch (error) {
      console.error("[TempleAreasService] Error fetching areas:", error);
      return [];
    }
  }

  async getArea(id: string): Promise<TempleArea | null> {
    if (!db) {
      return null;
    }
    try {
      const snap = await getDoc(doc(db, COLLECTION, id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as TempleArea;
    } catch (error) {
      console.error("[TempleAreasService] Error fetching area:", error);
      return null;
    }
  }

  /**
   * Get areas for public display - uses defaults if Firestore is empty
   */
  async getPublicAreas(): Promise<TempleArea[]> {
    const areas = await this.getAreas();
    
    // If no areas in Firestore, return defaults for public display
    if (areas.length === 0) {
      return getDefaultAreas();
    }
    
    return areas;
  }

  /**
   * Get a single area for public display - tries Firestore first, then defaults
   */
  async getPublicArea(id: string): Promise<TempleArea | null> {
    // First try Firestore
    const area = await this.getArea(id);
    if (area) return area;
    
    // Fall back to defaults
    return getDefaultAreas().find(a => a.id === id) || null;
  }

  async addArea(area: Omit<TempleArea, "id">) {
    if (!db) throw new Error("Firebase not configured");
    return addDoc(collection(db, COLLECTION), { 
      ...area, 
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp() 
    });
  }

  async updateArea(id: string, area: Partial<TempleArea>) {
    if (!db) throw new Error("Firebase not configured");
    return updateDoc(doc(db, COLLECTION, id), { ...area, updatedAt: serverTimestamp() });
  }

  async deleteArea(id: string) {
    if (!db) throw new Error("Firebase not configured");
    return deleteDoc(doc(db, COLLECTION, id));
  }

  async getAreasByCategory(category: TempleAreaCategory): Promise<TempleArea[]> {
    const areas = await this.getAreas();
    return areas.filter((area) => area.category === category);
  }

  /**
   * Restore all default areas to Firestore
   * Returns the count of areas restored
   */
  async restoreDefaults(): Promise<number> {
    if (!db) throw new Error("Firebase not configured");
    
    const defaults = getDefaultAreas();
    let restored = 0;
    
    for (const area of defaults) {
      try {
        // Check if area with same id already exists
        const existing = await getDoc(doc(db, COLLECTION, area.id));
        if (!existing.exists()) {
          // Set with specific ID for predictable document IDs
          const { id, ...areaData } = area;
          await setDoc(doc(db, COLLECTION, area.id), {
            ...areaData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          restored++;
        }
      } catch (error) {
        console.error(`[TempleAreasService] Error restoring area ${area.id}:`, error);
      }
    }
    
    return restored;
  }
}

// Default areas - exported for admin use
export function getDefaultAreas(): TempleArea[] {
  return [
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
      ],
      order: 1
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
        "Surya (Sun)", "Chandra (Moon)", "Mangal (Mars)", "Budha (Mercury)",
        "Guru (Jupiter)", "Shukra (Venus)", "Shani (Saturn)", "Rahu (North Node)", "Ketu (South Node)"
      ],
      bestTimeToVisit: "6:00 AM - 8:00 PM",
      tips: ["Special pujas performed on Sundays", "Rahu-Ketu dosha pujas available"],
      order: 2
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
      tips: ["Join the daily sahasranamarcha at 10 AM", "Archana passes available at counter"],
      order: 3
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
      tips: ["Book in advance for ceremonies", "Photography allowed in outer area"],
      order: 4
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
      tips: ["Book at least 3 months in advance", "Contact office for booking"],
      order: 5
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
      tips: ["Participate in the evening bhajan", "Devotees welcome to lead bhajans"],
      order: 6
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
      tips: ["Prior registration recommended", "Donations welcome for maintenance"],
      order: 7
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
      tips: ["Donations for anna daana welcome", "Volunteers can help in kitchen"],
      order: 8
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
      tips: ["Bathing not allowed", "Take holy dip on auspicious days"],
      order: 9
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
      tips: ["Offer prayers to Tulasi", "Photography encouraged"],
      order: 10
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
      tips: ["Best experienced during Aaradhane", "Arrive early for good viewing"],
      order: 11
    }
  ];
}

export const templeAreasService = new TempleAreasService();
