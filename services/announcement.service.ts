import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { Announcement, AnnouncementRequest } from "@/types/announcement";

const COLLECTION = "announcements";

function docToAnnouncement(docSnap: any): Announcement {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    title: data.title || "",
    message: data.message || "",
    link: data.link || "",
    isActive: data.isActive ?? true,
    createdAt: data.createdAt?.toMillis?.() ?? null,
    updatedAt: data.updatedAt?.toMillis?.() ?? null,
  };
}

class AnnouncementService {
  async getAnnouncements(): Promise<Announcement[]> {
    if (!db) return [];
    try {
      const snapshot = await getDocs(query(collection(db, COLLECTION), orderBy("createdAt", "desc")));
      return snapshot.docs.map(docToAnnouncement);
    } catch (error) {
      console.error("[AnnouncementService] Error:", error);
      return [];
    }
  }
  
  async getActiveAnnouncements(): Promise<Announcement[]> {
    if (!db) return [];
    try {
      const snapshot = await getDocs(query(collection(db, COLLECTION), where("isActive", "==", true), orderBy("createdAt", "desc")));
      return snapshot.docs.map(docToAnnouncement);
    } catch (error) {
      console.error("[AnnouncementService] Error:", error);
      return [];
    }
  }

  async addAnnouncement(announcement: AnnouncementRequest) {
    if (!db) throw new Error("Firebase not configured");
    return addDoc(collection(db, COLLECTION), { ...announcement, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  async updateAnnouncement(id: string, announcement: Partial<AnnouncementRequest>) {
    if (!db) throw new Error("Firebase not configured");
    return updateDoc(doc(db, COLLECTION, id), { ...announcement, updatedAt: serverTimestamp() });
  }

  async deleteAnnouncement(id: string) {
    if (!db) throw new Error("Firebase not configured");
    return deleteDoc(doc(db, COLLECTION, id));
  }

  async getAnnouncement(id: string) {
    if (!db) return null;
    try {
      const snap = await getDoc(doc(db, COLLECTION, id));
      if (!snap.exists()) return null;
      return docToAnnouncement(snap);
    } catch (error) {
      console.error("[AnnouncementService] Error:", error);
      return null;
    }
  }
}

export const announcementService = new AnnouncementService();
