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

import {
  Announcement,
  AnnouncementRequest,
} from "@/types/announcement";

const COLLECTION = "announcements";

function docToAnnouncement(docSnap: any): Announcement {
  const data = docSnap.data();

  return {
    id: docSnap.id,
    title: data.title || "",
    message: data.message || "",
    link: data.link || "",
    isActive: data.isActive ?? true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

class AnnouncementService {
  async getAnnouncements(): Promise<Announcement[]> {
    const snapshot = await getDocs(
      query(collection(db, COLLECTION), orderBy("createdAt", "desc"))
    );

    return snapshot.docs.map(docToAnnouncement);
  }

  async getActiveAnnouncements(): Promise<Announcement[]> {
    const snapshot = await getDocs(
      query(collection(db, COLLECTION), orderBy("createdAt", "desc"))
    );

    return snapshot.docs
      .map(docToAnnouncement)
      .filter((announcement) => announcement.isActive);
  }

  async addAnnouncement(announcement: AnnouncementRequest) {
    return addDoc(collection(db, COLLECTION), {
      ...announcement,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async updateAnnouncement(id: string, announcement: Partial<AnnouncementRequest>) {
    return updateDoc(doc(db, COLLECTION, id), {
      ...announcement,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteAnnouncement(id: string) {
    return deleteDoc(doc(db, COLLECTION, id));
  }

  async getAnnouncement(id: string) {
    const snap = await getDoc(doc(db, COLLECTION, id));

    if (!snap.exists()) return null;

    return docToAnnouncement(snap);
  }
}

export const announcementService = new AnnouncementService();
