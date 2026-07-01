import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { TempleEvent } from "@/types/event";

const COLLECTION = "events";

class EventService {
  async getEvents(): Promise<TempleEvent[]> {
    const snapshot = await getDocs(collection(db, COLLECTION));

    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as TempleEvent[];
  }

  async getEvent(id: string) {
    const snap = await getDoc(doc(db, COLLECTION, id));

    if (!snap.exists()) return null;

    return {
      id: snap.id,
      ...snap.data(),
    } as TempleEvent;
  }

  async addEvent(event: TempleEvent) {
    return addDoc(collection(db, COLLECTION), {
      ...event,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async updateEvent(id: string, event: Partial<TempleEvent>) {
    return updateDoc(doc(db, COLLECTION, id), {
      ...event,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteEvent(id: string) {
    return deleteDoc(doc(db, COLLECTION, id));
  }
}
export const eventService = new EventService();
