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
import { DailyPooja, PoojaStats } from "@/types/pooja";

const COLLECTION_NAME = "dailyPoojas";

function docToPooja(docSnap: any): DailyPooja {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    title: data.title || "",
    description: data.description || "",
    startTime: data.startTime || "",
    duration: data.duration || "",
    category: data.category || "Morning",
    sevaAmount: data.sevaAmount ?? 0,
    isActive: data.isActive ?? true,
    displayOrder: data.displayOrder ?? 0,
    days: data.days || ["All"],
    notes: data.notes || "",
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || new Date().toISOString(),
    createdBy: data.createdBy || "",
  };
}

export const poojaService = {
  async getPoojas(): Promise<DailyPooja[]> {
      if (!db) throw new Error("Firebase not configured");
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("displayOrder", "asc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToPooja);
  },

  async getPoojaById(id: string): Promise<DailyPooja | null> {
      if (!db) throw new Error("Firebase not configured");
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docToPooja(docSnap);
  },

  async createPooja(
    data: Omit<DailyPooja, "id" | "createdAt" | "createdBy">,
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

  async updatePooja(
    id: string,
    data: Partial<Omit<DailyPooja, "id" | "createdAt" | "createdBy">>
  ): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  },

  async deletePooja(id: string): Promise<void> {
      if (!db) throw new Error("Firebase not configured");
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  async getStats(): Promise<PoojaStats> {
      if (!db) throw new Error("Firebase not configured");
    const poojas = await this.getPoojas();
    const byCategory: Record<string, number> = {};
    poojas.forEach((p) => {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    });
    return {
      total: poojas.length,
      active: poojas.filter((p) => p.isActive).length,
      byCategory,
      withSeva: poojas.filter((p) => p.sevaAmount > 0).length,
    };
  },
};
