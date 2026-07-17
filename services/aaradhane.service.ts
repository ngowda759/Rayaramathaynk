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
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Aaradhane, AaradhaneStats } from "@/types/aaradhane";

const COLLECTION_NAME = "aaradhane";
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
  
  // Convert startDate/endDate to dates array
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
    dates.push(startDate.toISOString().split("T")[0]);
    
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
      const endDateStr = endDate.toISOString().split("T")[0];
      if (endDateStr !== dates[0]) {
        dates.push(endDateStr);
      }
    }
  }
  
  return {
    id: docSnap.id,
    title: data.title || "",
    guruName: data.guru || "",
    dates: dates,
    description: data.description || "",
    significance: data.description || "", // Use description as significance for generated events
    rituals: [],
    offerings: [],
    imageUrl: data.imageUrl || "",
    sevaDetails: [],
    isUpcoming: isEventUpcoming(data.startDate),
    displayOrder: data.year ? (1000 - data.year) : data.paramparaNumber || 0, // Sort by year desc, then parampara
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || new Date().toISOString(),
    createdBy: data.createdBy || "auto-generated",
  };
}

export const aaradhaneService = {
  async getAaradhanes(): Promise<Aaradhane[]> {
    if (!db) throw new Error("Firebase not configured");
    
    // Try to get events from "events" collection (auto-generated)
    let events: Aaradhane[] = [];
    try {
      // Query without requiring composite index - get all events and filter in memory
      const eventsQ = query(
        collection(db, EVENTS_COLLECTION),
        where("category", "==", "Aaradhane")
      );
      const eventsSnapshot = await getDocs(eventsQ);
      events = eventsSnapshot.docs.map(eventDocToAaradhane);
      console.log(`[Aaradhane] Found ${events.length} events from events collection`);
    } catch (error) {
      console.warn("[Aaradhane] Could not read from events collection:", error);
    }
    
    // Also try to get from "aaradhane" collection (manually created)
    let aaradhanes: Aaradhane[] = [];
    try {
      const aaradhanaQ = query(
        collection(db, COLLECTION_NAME),
        orderBy("displayOrder", "asc")
      );
      const aaradhanaSnapshot = await getDocs(aaradhanaQ);
      aaradhanes = aaradhanaSnapshot.docs.map(docToAaradhane);
      console.log(`[Aaradhane] Found ${aaradhanes.length} from aaradhane collection`);
    } catch (error) {
      console.warn("[Aaradhane] Could not read from aaradhane collection:", error);
    }
    
    // Merge and deduplicate by ID (prefer events collection data)
    const merged = [...events];
    for (const a of aaradhanes) {
      if (!merged.find(e => e.id === a.id)) {
        merged.push(a);
      }
    }
    
    // Sort by displayOrder
    merged.sort((a, b) => a.displayOrder - b.displayOrder);
    
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
