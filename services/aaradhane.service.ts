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

function docToAaradhane(docSnap: any): Aaradhane {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    title: data.title || "",
    guruName: data.guruName || "",
    date: data.date || "",
    description: data.description || "",
    significance: data.significance || "",
    rituals: data.rituals || [],
    offerings: data.offerings || [],
    isUpcoming: data.isUpcoming ?? false,
    displayOrder: data.displayOrder ?? 0,
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || new Date().toISOString(),
    createdBy: data.createdBy || "",
  };
}

export const aaradhaneService = {
  async getAaradhanes(): Promise<Aaradhane[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("displayOrder", "asc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToAaradhane);
  },

  async getAaradhaneById(id: string): Promise<Aaradhane | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docToAaradhane(docSnap);
  },

  async createAaradhane(
    data: Omit<Aaradhane, "id" | "createdAt" | "createdBy">,
    userEmail: string
  ): Promise<string> {
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
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  },

  async deleteAaradhane(id: string): Promise<void> {
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
