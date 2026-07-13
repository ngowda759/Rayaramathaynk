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

export const aaradhaneService = {
  async getAaradhanes(): Promise<Aaradhane[]> {
    if (!db) throw new Error("Firebase not configured");
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("displayOrder", "asc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToAaradhane);
  },

  async getAaradhaneById(id: string): Promise<Aaradhane | null> {
    if (!db) throw new Error("Firebase not configured");
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docToAaradhane(docSnap);
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
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
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
