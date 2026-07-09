/**
 * Repository for managing events.
 * This repository provides CRUD operations for events using JSON storage.
 */

import { TempleEvent } from "@/types/event";
import { readJson, writeJson, generateId } from "@/lib/storage";

const STORAGE_FILE = "events.json";

interface EventsData {
  items: TempleEvent[];
}

export const eventsRepository = {
  /**
   * Get all events
   */
  async getAll(): Promise<TempleEvent[]> {
    const data = await readJson<EventsData>(STORAGE_FILE);
    return data?.items || [];
  },

  /**
   * Get event by ID
   */
  async getById(id: string): Promise<TempleEvent | null> {
    const data = await readJson<EventsData>(STORAGE_FILE);
    if (!data) return null;

    return data.items.find((item) => item.id === id) || null;
  },

  /**
   * Get published events (sorted by start date)
   */
  async getPublished(): Promise<TempleEvent[]> {
    const items = await this.getAll();
    return items
      .filter((event) => event.published !== false)
      .sort((a, b) => {
        const aDate = a.startDate instanceof Date 
          ? a.startDate.getTime() 
          : new Date(a.startDate).getTime();
        const bDate = b.startDate instanceof Date 
          ? b.startDate.getTime() 
          : new Date(b.startDate).getTime();
        return aDate - bDate;
      });
  },

  /**
   * Get upcoming published events
   */
  async getUpcoming(max = 3): Promise<TempleEvent[]> {
    const now = new Date();
    const items = await this.getPublished();

    return items
      .filter((event) => {
        const endDate = event.endDate instanceof Date 
          ? event.endDate 
          : new Date(event.endDate);
        return endDate >= now;
      })
      .slice(0, max);
  },

  /**
   * Get past events
   */
  async getPast(): Promise<TempleEvent[]> {
    const now = new Date();
    const items = await this.getPublished();

    return items
      .filter((event) => {
        const endDate = event.endDate instanceof Date 
          ? event.endDate 
          : new Date(event.endDate);
        return endDate < now;
      })
      .sort((a, b) => {
        const aDate = a.startDate instanceof Date 
          ? a.startDate.getTime() 
          : new Date(a.startDate).getTime();
        const bDate = b.startDate instanceof Date 
          ? b.startDate.getTime() 
          : new Date(b.startDate).getTime();
        return bDate - aDate;
      });
  },

  /**
   * Get featured event
   */
  async getFeatured(): Promise<TempleEvent | null> {
    const items = await this.getPublished();
    return items.find((event) => event.featured) || null;
  },

  /**
   * Create a new event
   */
  async create(event: Omit<TempleEvent, "id">): Promise<TempleEvent> {
    const data = await readJson<EventsData>(STORAGE_FILE) || { items: [] };
    const now = Date.now();

    const newEvent: TempleEvent = {
      ...event,
      id: generateId(),
      createdAt: now as any,
      updatedAt: now as any,
    };

    data.items.push(newEvent);
    await writeJson(STORAGE_FILE, data);

    return newEvent;
  },

  /**
   * Update an existing event
   */
  async update(
    id: string,
    updates: Partial<Omit<TempleEvent, "id">>
  ): Promise<TempleEvent | null> {
    const data = await readJson<EventsData>(STORAGE_FILE);
    if (!data) return null;

    const index = data.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated: TempleEvent = {
      ...data.items[index],
      ...updates,
      id: data.items[index].id,
      createdAt: data.items[index].createdAt,
      updatedAt: Date.now() as any,
    };

    data.items[index] = updated;
    await writeJson(STORAGE_FILE, data);

    return updated;
  },

  /**
   * Delete an event
   */
  async delete(id: string): Promise<boolean> {
    const data = await readJson<EventsData>(STORAGE_FILE);
    if (!data) return false;

    const initialLength = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);

    if (data.items.length === initialLength) return false;

    await writeJson(STORAGE_FILE, data);
    return true;
  },

  /**
   * Get the count of all events
   */
  async count(): Promise<number> {
    const data = await readJson<EventsData>(STORAGE_FILE);
    return data?.items.length || 0;
  },
};
