import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  addDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SiteSettings, SiteSettingsPayload } from "@/types/settings";

const COLLECTION = "settings";

function docToSettings(docSnap: any): SiteSettings {
  const data = docSnap.data();

  return {
    id: docSnap.id,
    templeName: data.templeName || "Sri Raghavendra Swamy Temple",
    contactEmail: data.contactEmail || "info@example.com",
    contactPhone: data.contactPhone || "",
    address: data.address || "",
    footerText: data.footerText || "",
    welcomeMessage: data.welcomeMessage || "",
    updatedAt: data.updatedAt,
  };
}

class SettingsService {
  async getSettings(): Promise<SiteSettings | null> {
    if (!db) throw new Error("Firebase not configured");
    const q = query(collection(db, COLLECTION), orderBy("updatedAt", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    return docToSettings(snapshot.docs[0]);
  }

  async createSettings(data: SiteSettingsPayload): Promise<string> {
    if (!db) throw new Error("Firebase not configured");
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateSettings(id: string, data: Partial<SiteSettingsPayload>) {
    if (!db) throw new Error("Firebase not configured");
    const settingsRef = doc(db, COLLECTION, id);
    return updateDoc(settingsRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }
}

export const settingsService = new SettingsService();
