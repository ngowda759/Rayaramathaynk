import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Aaradhane, AaradhaneStats } from "@/types/aaradhane";

const COLLECTION_NAME = "aaradhane";
const AARADHANES_COLLECTION = "aaradhanes"; // With 's' - alternative collection name
const EVENTS_COLLECTION = "events";

function isAaradhaneUpcoming(dates: string[]): boolean {
  if (!dates || dates.length === 0) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  return dates.some(dateStr => {
    const eventDate = new Date(dateStr);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate >= now;
  });
}

function isEventUpcoming(startDate: any): boolean {
  if (!startDate) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  let eventDate: Date;
  if (startDate.toDate && typeof startDate.toDate === "function") {
    eventDate = startDate.toDate();
  } else if (startDate.seconds) {
    eventDate = new Date(startDate.seconds * 1000);
  } else {
    eventDate = new Date(startDate);
  }
  
  eventDate.setHours(0, 0, 0, 0);
  return eventDate >= now;
}

function docToAaradhane(docSnap: any): Aaradhane {
  const data = docSnap.data();
  const dates = data.dates || [];
  
  return {
    id: docSnap.id,
    title: data.title || "",
    guruName: data.guruName || "",
    dates: dates,
    description: data.description || "",
    significance: data.significance || "",
    rituals: data.rituals || [],
    offerings: data.offerings || [],
    imageUrl: data.imageUrl || "",
    sevaDetails: data.sevaDetails || [],
    isUpcoming: isAaradhaneUpcoming(dates),
    displayOrder: data.displayOrder ?? 0,
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || new Date().toISOString(),
    createdBy: data.createdBy || "",
  };
}

/**
 * Convert events collection document to Aaradhane format
 */
function eventDocToAaradhane(docSnap: any): Aaradhane {
  const data = docSnap.data();
  
  // Try multiple field name variations
  const title = data.title || data.name || data.eventTitle || data.aaradhaneTitle || `Event ${docSnap.id}`;
  const guruName = data.guru || data.guruName || data.guru || data.name || "";
  
  // Convert startDate/endDate to dates array (formatted as "DD Month YYYY")
  let dates: string[] = [];
  if (data.startDate) {
    let startDate: Date;
    if (data.startDate.toDate && typeof data.startDate.toDate === "function") {
      startDate = data.startDate.toDate();
    } else if (data.startDate.seconds) {
      startDate = new Date(data.startDate.seconds * 1000);
    } else {
      startDate = new Date(data.startDate);
    }
    dates.push(formatDateDisplay(startDate));
    
    // Add end date if different
    if (data.endDate) {
      let endDate: Date;
      if (data.endDate.toDate && typeof data.endDate.toDate === "function") {
        endDate = data.endDate.toDate();
      } else if (data.endDate.seconds) {
        endDate = new Date(data.endDate.seconds * 1000);
      } else {
        endDate = new Date(data.endDate);
      }
      const endDateStr = formatDateDisplay(endDate);
      if (endDateStr !== dates[0]) {
        dates.push(endDateStr);
      }
    }
  }
  
  // For auto-generated events, set default rituals and offerings
  const rituals = data.rituals || [
    "ಪಂಚಾಮೃತ ಅಭಿಷೇಕ ಪೂಜೆ",
    "ಅಲಂಕಾರ ಬ್ರಾಹ್ಮಣ ಸೇವಾ ಮಹಾಮಂಗಳಾರತಿ"
  ];
  const offerings = data.offerings || [
    "ತೀರ್ಥ ಪ್ರಸಾದ",
    "ಬೆಳ್ಳಿ ಹೂವು",
    "ಕರ್ಪೂರ",
    "ಸಂತೆ"
  ];
  
  return {
    id: docSnap.id,
    title: title,
    guruName: guruName,
    dates: dates,
    description: data.description || "",
    significance: data.significance || data.description || "",
    rituals: rituals,
    offerings: offerings,
    imageUrl: data.imageUrl || "",
    sevaDetails: data.sevaDetails || [],
    isUpcoming: isEventUpcoming(data.startDate),
    displayOrder: data.paramparaNumber || data.year ? (1000 - (data.year || 0)) : 0,
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || new Date().toISOString(),
    createdBy: data.createdBy || "auto-generated",
  };
}

/**
 * Format date as "DD Month YYYY" (e.g., "29 August 2026")
 */
function formatDateDisplay(date: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export const aaradhaneService = {
  async getAaradhanes(): Promise<Aaradhane[]> {
    if (!db) throw new Error("Firebase not configured");
    
    // Try to get events from "events" collection (auto-generated)
    let events: Aaradhane[] = [];
    try {
      const allEventsQ = query(collection(db, EVENTS_COLLECTION));
      const allEventsSnapshot = await getDocs(allEventsQ);
      console.log(`[Aaradhane] events collection: ${allEventsSnapshot.size}`);
      
      events = allEventsSnapshot.docs
        .map(eventDocToAaradhane)
        .filter(e => e.title);
    } catch (error) {
      console.warn("[Aaradhane] events collection error:", error);
    }
    
    // Try "aaradhane" collection
    let fromAaradhane: Aaradhane[] = [];
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy("displayOrder", "asc"));
      const snapshot = await getDocs(q);
      fromAaradhane = snapshot.docs.map(docToAaradhane);
      console.log(`[Aaradhane] aaradhane collection: ${fromAaradhane.length}`);
    } catch (error) {
      console.warn("[Aaradhane] aaradhane collection error:", error);
    }
    
    // Try "aaradhanes" collection (with 's')
    let fromAaradhanes: Aaradhane[] = [];
    try {
      const q = query(collection(db, AARADHANES_COLLECTION), orderBy("displayOrder", "asc"));
      const snapshot = await getDocs(q);
      fromAaradhanes = snapshot.docs.map(docToAaradhane);
      console.log(`[Aaradhane] aaradhanes collection: ${fromAaradhanes.length}`);
    } catch (error) {
      console.warn("[Aaradhane] aaradhanes collection error:", error);
    }
    
    // Merge from all collections
    const merged = [...events];
    for (const a of fromAaradhane) {
      if (!merged.find(e => e.id === a.id)) merged.push(a);
    }
    for (const a of fromAaradhanes) {
      if (!merged.find(e => e.id === a.id)) merged.push(a);
    }
    
    merged.sort((a, b) => a.displayOrder - b.displayOrder);
    console.log(`[Aaradhane] Total merged: ${merged.length}`);
    return merged;
  },

  async getAaradhaneById(id: string): Promise<Aaradhane | null> {
    if (!db) throw new Error("Firebase not configured");
    
    // First check events collection
    try {
      const eventDocRef = doc(db, EVENTS_COLLECTION, id);
      const eventDocSnap = await getDoc(eventDocRef);
      if (eventDocSnap.exists()) {
        return eventDocToAaradhane(eventDocSnap);
      }
    } catch (error) {
      console.warn("[Aaradhane] Error checking events collection:", error);
    }
    
    // Then check aaradhane collection
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docToAaradhane(docSnap);
      }
    } catch (error) {
      console.warn("[Aaradhane] Error checking aaradhane collection:", error);
    }
    
    return null;
  },

  async createAaradhane(
    data: Omit<Aaradhane, "id" | "createdAt" | "createdBy">,
    userEmail: string
  ): Promise<string> {
    if (!db) throw new Error("Firebase not configured");
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      createdBy: userEmail,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateAaradhane(
    id: string,
    data: Partial<Omit<Aaradhane, "id" | "createdAt" | "createdBy">>
  ): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  },

  async deleteAaradhane(id: string): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    
    // First try to delete from aaradhane collection
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
      console.log(`[Aaradhane] Deleted from aaradhane collection: ${id}`);
      return;
    } catch (error) {
      console.warn("[Aaradhane] Could not delete from aaradhane collection:", error);
    }
    
    // Then try events collection
    try {
      const eventDocRef = doc(db, EVENTS_COLLECTION, id);
      await deleteDoc(eventDocRef);
      console.log(`[Aaradhane] Deleted from events collection: ${id}`);
      return;
    } catch (error) {
      console.warn("[Aaradhane] Could not delete from events collection:", error);
    }
  },

  async getStats(): Promise<AaradhaneStats> {
    const items = await this.getAaradhanes();
    return {
      total: items.length,
      upcoming: items.filter((i) => i.isUpcoming).length,
      past: items.filter((i) => !i.isUpcoming).length,
    };
  },
};
