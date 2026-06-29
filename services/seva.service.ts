import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { Seva, SevaRequest } from "@/types/seva";

const COLLECTION = "sevas";

class SevaService {
  async getAllSevas(): Promise<Seva[]> {
    const snapshot = await getDocs(collection(db, COLLECTION));

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Seva[];
  }

  async getSevaById(id: string): Promise<Seva | null> {
    const snapshot = await getDoc(doc(db, COLLECTION, id));

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as Seva;
  }

  async createSeva(data: SevaRequest) {
    return addDoc(collection(db, COLLECTION), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async updateSeva(
    id: string,
    data: Partial<SevaRequest>
  ) {
    return updateDoc(doc(db, COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteSeva(id: string) {
    return deleteDoc(doc(db, COLLECTION, id));
  }
}

export const sevaService = new SevaService();
