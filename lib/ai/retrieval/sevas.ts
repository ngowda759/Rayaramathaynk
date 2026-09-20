// Sevas Retrieval - Temple sevas and services
// Single source of truth for seva information

import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, DocumentData } from "firebase/firestore";
import { TempleSeva, RetrievedData } from "./types";
import { RetrievalType } from "../intent/types";

// Cache for sevas
let cachedSevas: TempleSeva[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Seed data for sevas (used when Firebase is not configured or has no sevas)
 */
const SEED_SEVAS: TempleSeva[] = [
  {
    id: "seva-1",
    name: "Supahara Seva",
    description: "General offering to the deity",
    category: "Daily",
    amount: 51,
    duration: 15,
    active: true,
  },
  {
    id: "seva-2",
    name: "Sundaraarchane",
    description: "Special puja with flowers and camphor",
    category: "Daily",
    amount: 101,
    duration: 30,
    active: true,
  },
  {
    id: "seva-3",
    name: "Mahapuja",
    description: "Grand puja with all ritual items",
    category: "Special",
    amount: 501,
    duration: 60,
    active: true,
  },
  {
    id: "seva-4",
    name: "Sahasranamarchane",
    description: "Recitation of 1000 names of the deity",
    category: "Special",
    amount: 251,
    duration: 45,
    active: true,
  },
  {
    id: "seva-5",
    name: "Namaparayana",
    description: "Collective recitation of divine names",
    category: "Daily",
    amount: 0,
    duration: 30,
    active: true,
  },
  {
    id: "seva-6",
    name: "Archane",
    description: "Individual puja with priest chanting your name",
    category: "Daily",
    amount: 25,
    duration: 15,
    active: true,
  },
  {
    id: "seva-7",
    name: "Tirthe Prasada",
    description: "Sacred water and prasada distribution",
    category: "Daily",
    amount: 0,
    duration: 5,
    active: true,
  },
  {
    id: "seva-8",
    name: "Astothara Seva",
    description: "108 names puja with special offerings",
    category: "Special",
    amount: 151,
    duration: 45,
    active: true,
  },
];

/**
 * Convert Firebase doc to TempleSeva
 */
function docToSeva(doc: DocumentData): TempleSeva | null {
  try {
    const data = doc.data();
    if (!data) return null;

    return {
      id: doc.id,
      name: data.name || "Seva",
      description: data.description || "",
      category: data.category || "General",
      amount: Number(data.amount) || 0,
      duration: Number(data.duration) || 30,
      active: data.active !== false, // Default to active if not specified
    };
  } catch {
    return null;
  }
}

/**
 * Fetch active sevas from Firebase
 */
async function fetchFromFirebase(): Promise<TempleSeva[]> {
  if (!isFirebaseConfigured() || !db) {
    // Return seed data when Firebase is not configured
    return SEED_SEVAS;
  }

  try {
    const q = query(
      collection(db, "sevas"),
      where("active", "==", true),
      orderBy("displayOrder", "asc")
    );
    
    const snapshot = await getDocs(q);
    const sevas: TempleSeva[] = [];
    
    snapshot.docs.forEach((doc) => {
      const seva = docToSeva(doc);
      if (seva) {
        sevas.push(seva);
      }
    });
    
    // Return seed data if Firebase has no sevas
    return sevas.length > 0 ? sevas : SEED_SEVAS;
  } catch (error) {
    console.error("[Sevas Retrieval] Error fetching sevas:", error);
    // Return seed data on error
    return SEED_SEVAS;
  }
}

/**
 * Get all active sevas with caching
 */
export async function getActiveSevas(): Promise<RetrievedData<TempleSeva[]>> {
  const now = Date.now();
  const fromCache = cachedSevas.length > 0 && now - lastFetchTime < CACHE_DURATION;

  if (fromCache) {
    return {
      data: cachedSevas,
      source: RetrievalType.REPOSITORY,
      confidence: 95,
      retrievedAt: lastFetchTime,
      fromCache: true,
    };
  }

  try {
    const sevas = await fetchFromFirebase();
    cachedSevas = sevas;
    lastFetchTime = now;

    return {
      data: sevas,
      source: RetrievalType.REPOSITORY,
      confidence: 95,
      retrievedAt: now,
      fromCache: false,
    };
  } catch (error) {
    console.error("[Sevas Retrieval] Error:", error);
    return {
      data: cachedSevas,
      source: RetrievalType.FALLBACK,
      confidence: 50,
      retrievedAt: now,
      fromCache: false,
    };
  }
}

/**
 * Get sevas by category
 */
export async function getSevasByCategory(
  category: string
): Promise<RetrievedData<TempleSeva[]>> {
  const result = await getActiveSevas();
  
  const filtered = (result.data || []).filter(
    (seva) => seva.category.toLowerCase() === category.toLowerCase()
  );
  
  return {
    data: filtered,
    source: result.source,
    confidence: filtered.length > 0 ? 90 : 0,
    retrievedAt: result.retrievedAt,
    fromCache: result.fromCache,
  };
}

/**
 * Get common/daily sevas
 */
export async function getDailySevas(): Promise<RetrievedData<TempleSeva[]>> {
  return getSevasByCategory("daily");
}

/**
 * Get special sevas
 */
export async function getSpecialSevas(): Promise<RetrievedData<TempleSeva[]>> {
  return getSevasByCategory("special");
}

/**
 * Get all available categories
 */
export async function getSevaCategories(): Promise<RetrievedData<string[]>> {
  const result = await getActiveSevas();
  
  const categories = [...new Set((result.data || []).map((seva) => seva.category))];
  
  return {
    data: categories,
    source: result.source,
    confidence: categories.length > 0 ? 90 : 0,
    retrievedAt: result.retrievedAt,
    fromCache: result.fromCache,
  };
}

/**
 * Format sevas list for display
 */
export function formatSevasListForDisplay(sevas: TempleSeva[]): string {
  if (!sevas || sevas.length === 0) {
    return "No sevas available at the moment.";
  }
  
  let text = "🙏 **Available Sevas:**\n\n";
  
  // Group by category
  const grouped = sevas.reduce((acc, seva) => {
    if (!acc[seva.category]) {
      acc[seva.category] = [];
    }
    acc[seva.category].push(seva);
    return acc;
  }, {} as Record<string, TempleSeva[]>);
  
  for (const [category, categorySevas] of Object.entries(grouped)) {
    text += `**${category}:**\n`;
    
    categorySevas.forEach((seva) => {
      const price = seva.amount > 0 ? ` - ₹${seva.amount}` : " - Free";
      const duration = seva.duration ? ` (${seva.duration} min)` : "";
      text += `• ${seva.name}${price}${duration}\n`;
    });
    
    text += "\n";
  }
  
  return text.trim();
}

/**
 * Format single seva for display
 */
export function formatSevaForDisplay(seva: TempleSeva): string {
  let text = `🙏 **${seva.name}**\n\n`;
  
  if (seva.description) {
    text += `${seva.description}\n\n`;
  }
  
  text += `📁 Category: ${seva.category}\n`;
  
  if (seva.amount > 0) {
    text += `💰 Amount: ₹${seva.amount}\n`;
  } else {
    text += `💰 Free service\n`;
  }
  
  if (seva.duration) {
    text += `⏱️ Duration: ${seva.duration} minutes\n`;
  }
  
  return text.trim();
}

/**
 * Clear sevas cache
 */
export function clearSevasCache(): void {
  cachedSevas = [];
  lastFetchTime = 0;
}
