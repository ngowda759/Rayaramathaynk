/**
 * Repository for managing temple timings.
 * This repository provides CRUD operations for timings using JSON storage.
 */

import { TempleTiming, TimingRequest } from "@/types/timing";
import { readJson, writeJson, generateId } from "@/lib/storage";

const STORAGE_FILE = "timings.json";

interface TimingsData {
  items: TempleTiming[];
}

export const timingsRepository = {
  /**
   * Get all timings, sorted by order
   */
  async getAll(): Promise<TempleTiming[]> {
    const data = await readJson<TimingsData>(STORAGE_FILE);
    if (!data) return [];

    return [...data.items].sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      return orderA - orderB;
    });
  },

  /**
   * Get timing by ID
   */
  async getById(id: string): Promise<TempleTiming | null> {
    const data = await readJson<TimingsData>(STORAGE_FILE);
    if (!data) return null;

    return data.items.find((item) => item.id === id) || null;
  },

  /**
   * Create a new timing
   */
  async create(timing: TimingRequest): Promise<TempleTiming> {
    const data = await readJson<TimingsData>(STORAGE_FILE) || { items: [] };
    const now = new Date().toISOString();

    const newTiming: TempleTiming = {
      ...timing,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    data.items.push(newTiming);
    await writeJson(STORAGE_FILE, data);

    return newTiming;
  },

  /**
   * Update an existing timing
   */
  async update(
    id: string,
    updates: Partial<TimingRequest>
  ): Promise<TempleTiming | null> {
    const data = await readJson<TimingsData>(STORAGE_FILE);
    if (!data) return null;

    const index = data.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated: TempleTiming = {
      ...data.items[index],
      ...updates,
      id: data.items[index].id,
      createdAt: data.items[index].createdAt,
      updatedAt: new Date().toISOString(),
    };

    data.items[index] = updated;
    await writeJson(STORAGE_FILE, data);

    return updated;
  },

  /**
   * Delete a timing
   */
  async delete(id: string): Promise<boolean> {
    const data = await readJson<TimingsData>(STORAGE_FILE);
    if (!data) return false;

    const initialLength = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);

    if (data.items.length === initialLength) return false;

    await writeJson(STORAGE_FILE, data);
    return true;
  },

  /**
   * Get the count of all timings
   */
  async count(): Promise<number> {
    const data = await readJson<TimingsData>(STORAGE_FILE);
    return data?.items.length || 0;
  },
};
