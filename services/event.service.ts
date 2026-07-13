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

// Helper function to convert date to timestamp for sorting
function toTimestamp(date: any): number {
  if (!date) return 0;
  if (typeof date === 'string') {
    return new Date(date).getTime();
  }
  if (typeof date === 'number') {
    return date;
  }
  if (date.toDate && typeof date.toDate === 'function') {
    return date.toDate().getTime();
  }
  return 0;
}

class EventService {
  async getEvents(): Promise<TempleEvent[]> {
    console.log("[EventService] getEvents called");
    console.log("[EventService] db is:", db ? "defined" : "null/undefined");
    
    if (!db) {
      console.log("[EventService] Firebase not configured, returning empty array");
      return [];
    }
    
    try {
      const snapshot = await getDocs(collection(db, COLLECTION));
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as TempleEvent[];
    } catch (error) {
      console.error("[EventService] Error fetching events:", error);
      return [];
    }
  }

  async getEvent(id: string): Promise<TempleEvent | null> {
    if (!db) return null;
    try {
      const snap = await getDoc(doc(db, COLLECTION, id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as TempleEvent;
    } catch (error) {
      console.error("[EventService] Error fetching event:", error);
      return null;
    }
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
    return events.filter((event) => event.published !== false).sort((a, b) => toTimestamp(a.startDate) - toTimestamp(b.startDate));
  }

  async getUpcomingEvents(max = 3): Promise<TempleEvent[]> {
    const now = new Date();
    const events = await this.getPublishedEvents();
    return events.filter((event) => toTimestamp(event.endDate) >= now.getTime()).slice(0, max);
  }

  async getPastEvents(): Promise<TempleEvent[]> {
    const now = new Date();
    const events = await this.getPublishedEvents();
    return events.filter((event) => toTimestamp(event.endDate) < now.getTime()).sort((a, b) => toTimestamp(b.startDate) - toTimestamp(a.startDate));
  }

  async getFeaturedEvent(): Promise<TempleEvent | null> {
    const events = await this.getPublishedEvents();
    return events.find((event) => event.featured) ?? null;
  }
}

export const eventService = new EventService();
