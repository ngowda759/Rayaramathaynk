import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Seva, SevaRequest } from "@/types/seva";

const COLLECTION = "sevas";

class SevaService {
  async getAllSevas(): Promise<Seva[]> {
    if (!db) return [];
    try {
      const snapshot = await getDocs(collection(db, COLLECTION));
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Seva[];
    } catch (error) {
      console.error("[SevaService] Error:", error);
      return [];
    }
  }

  async getSevaById(id: string): Promise<Seva | null> {
    if (!db) return null;
    try {
      const snapshot = await getDoc(doc(db, COLLECTION, id));
      if (!snapshot.exists()) return null;
      return { id: snapshot.id, ...snapshot.data() } as Seva;
    } catch (error) {
      console.error("[SevaService] Error:", error);
      return null;
    }
  }

  async createSeva(data: SevaRequest) {
    if (!db) throw new Error("Firebase not configured");
    return addDoc(collection(db, COLLECTION), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  async updateSeva(id: string, data: Partial<SevaRequest>) {
    if (!db) throw new Error("Firebase not configured");
    return updateDoc(doc(db, COLLECTION, id), { ...data, updatedAt: serverTimestamp() });
  }

  async deleteSeva(id: string) {
    if (!db) throw new Error("Firebase not configured");
    return deleteDoc(doc(db, COLLECTION, id));
  }
}

export const sevaService = new SevaService();
