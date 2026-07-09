/**
 * Repository for managing announcements.
 * This repository provides CRUD operations for announcements using JSON storage.
 */

import { Announcement, AnnouncementRequest } from "@/types/announcement";
import {
  readJson,
  writeJson,
  generateId,
} from "@/lib/storage";

const STORAGE_FILE = "announcements.json";

interface AnnouncementsData {
  items: Announcement[];
}

export const announcementsRepository = {
  /**
   * Get all announcements, sorted by creation date (newest first)
   */
  async getAll(): Promise<Announcement[]> {
    const data = await readJson<AnnouncementsData>(STORAGE_FILE);
    if (!data) return [];

    return [...data.items].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  },

  /**
   * Get all active announcements
   */
  async getActive(): Promise<Announcement[]> {
    const items = await this.getAll();
    return items.filter((item) => item.isActive);
  },

  /**
   * Get announcement by ID
   */
  async getById(id: string): Promise<Announcement | null> {
    const data = await readJson<AnnouncementsData>(STORAGE_FILE);
    if (!data) return null;

    return data.items.find((item) => item.id === id) || null;
  },

  /**
   * Create a new announcement
   */
  async create(announcement: AnnouncementRequest): Promise<Announcement> {
    const data = await readJson<AnnouncementsData>(STORAGE_FILE) || { items: [] };
    const now = Date.now();

    const newAnnouncement: Announcement = {
      id: generateId(),
      ...announcement,
      createdAt: now,
      updatedAt: now,
    };

    data.items.push(newAnnouncement);
    await writeJson(STORAGE_FILE, data);

    return newAnnouncement;
  },

  /**
   * Update an existing announcement
   */
  async update(
    id: string,
    updates: Partial<AnnouncementRequest>
  ): Promise<Announcement | null> {
    const data = await readJson<AnnouncementsData>(STORAGE_FILE);
    if (!data) return null;

    const index = data.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated: Announcement = {
      ...data.items[index],
      ...updates,
      id: data.items[index].id, // Preserve original ID
      createdAt: data.items[index].createdAt, // Preserve original createdAt
      updatedAt: Date.now(),
    };

    data.items[index] = updated;
    await writeJson(STORAGE_FILE, data);

    return updated;
  },

  /**
   * Delete an announcement
   */
  async delete(id: string): Promise<boolean> {
    const data = await readJson<AnnouncementsData>(STORAGE_FILE);
    if (!data) return false;

    const initialLength = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);

    if (data.items.length === initialLength) return false;

    await writeJson(STORAGE_FILE, data);
    return true;
  },

  /**
   * Get the count of all announcements
   */
  async count(): Promise<number> {
    const data = await readJson<AnnouncementsData>(STORAGE_FILE);
    return data?.items.length || 0;
  },
};
