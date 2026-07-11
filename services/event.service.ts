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
import { TempleEvent } from "@/types/event";

const COLLECTION = "events";

class EventService {
  async getEvents(): Promise<TempleEvent[]> {
    if (!db) throw new Error("Firebase not configured");
    const snapshot = await getDocs(collection(db, COLLECTION));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as TempleEvent[];
  }

  async getEvent(id: string): Promise<TempleEvent | null> {
    if (!db) throw new Error("Firebase not configured");
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as TempleEvent;
  }

  async addEvent(event: TempleEvent) {
    if (!db) throw new Error("Firebase not configured");
    return addDoc(collection(db, COLLECTION), { ...event, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  async updateEvent(id: string, event: Partial<TempleEvent>) {
    if (!db) throw new Error("Firebase not configured");
    return updateDoc(doc(db, COLLECTION, id), { ...event, updatedAt: serverTimestamp() });
  }

  async deleteEvent(id: string) {
    if (!db) throw new Error("Firebase not configured");
    return deleteDoc(doc(db, COLLECTION, id));
  }

  async getPublishedEvents(): Promise<TempleEvent[]> {
    const events = await this.getEvents();
    return events.filter((event) => event.published !== false).sort((a, b) => a.startDate.toDate().getTime() - b.startDate.toDate().getTime());
  }

  async getUpcomingEvents(max = 3): Promise<TempleEvent[]> {
    const now = new Date();
    const events = await this.getPublishedEvents();
    return events.filter((event) => event.endDate.toDate() >= now).slice(0, max);
  }

  async getPastEvents(): Promise<TempleEvent[]> {
    const now = new Date();
    const events = await this.getPublishedEvents();
    return events.filter((event) => event.endDate.toDate() < now).sort((a, b) => b.startDate.toDate().getTime() - a.startDate.toDate().getTime());
  }

  async getFeaturedEvent(): Promise<TempleEvent | null> {
    const events = await this.getPublishedEvents();
    return events.find((event) => event.featured) ?? null;
  }
}

export const eventService = new EventService();
