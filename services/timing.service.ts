import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TempleTiming, TimingRequest } from "@/types/timing";

const COLLECTION_NAME = "timings";

function docToTiming(docSnap: any): TempleTiming {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    title: data.title || "",
    description: data.description || "",
    startTime: data.startTime || "",
    endTime: data.endTime || "",
    order: data.order ?? 0,
    isActive: data.isActive ?? true,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString(),
  };
}

class TimingService {
  async getTimings(): Promise<TempleTiming[]> {
    if (!db) return [];
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy("order", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docToTiming);
    } catch (error) {
      console.error("[TimingService] Error:", error);
      return [];
    }
  }

  async getTimingById(id: string): Promise<TempleTiming | null> {
    if (!db) return null;
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return docToTiming(docSnap);
    } catch (error) {
      console.error("[TimingService] Error:", error);
      return null;
    }
  }

  async createTiming(data: TimingRequest): Promise<string> {
    if (!db) throw new Error("Firebase not configured");
    const docRef = await addDoc(collection(db, COLLECTION_NAME), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return docRef.id;
  }

  async updateTiming(id: string, data: Partial<TimingRequest>): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
  }

  async deleteTiming(id: string): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }
}

export const timingService = new TimingService();
