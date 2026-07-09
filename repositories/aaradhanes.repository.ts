/**
 * Repository for managing aaradhanes.
 * This repository provides CRUD operations for aaradhanes using JSON storage.
 */

import { Aaradhane } from "@/types/aaradhane";
import { readJson, writeJson, generateId } from "@/lib/storage";

const STORAGE_FILE = "aaradhanes.json";

interface AaradhanesData {
  items: Aaradhane[];
}

export const aaradhanesRepository = {
  /**
   * Get all aaradhanes, sorted by display order
   */
  async getAll(): Promise<Aaradhane[]> {
    const data = await readJson<AaradhanesData>(STORAGE_FILE);
    if (!data) return [];

    return [...data.items].sort((a, b) => {
      const orderA = a.displayOrder ?? 0;
      const orderB = b.displayOrder ?? 0;
      return orderA - orderB;
    });
  },

  /**
   * Get aaradhane by ID
   */
  async getById(id: string): Promise<Aaradhane | null> {
    const data = await readJson<AaradhanesData>(STORAGE_FILE);
    if (!data) return null;

    return data.items.find((item) => item.id === id) || null;
  },

  /**
   * Create a new aaradhane
   */
  async create(
    aaradhane: Omit<Aaradhane, "id" | "createdAt" | "createdBy">
  ): Promise<Aaradhane> {
    const data = await readJson<AaradhanesData>(STORAGE_FILE) || { items: [] };

    const newAaradhane: Aaradhane = {
      ...aaradhane,
      id: generateId(),
      createdAt: new Date().toISOString(),
      createdBy: aaradhane.createdBy || "",
    };

    data.items.push(newAaradhane);
    await writeJson(STORAGE_FILE, data);

    return newAaradhane;
  },

  /**
   * Update an existing aaradhane
   */
  async update(
    id: string,
    updates: Partial<Omit<Aaradhane, "id" | "createdAt" | "createdBy">>
  ): Promise<Aaradhane | null> {
    const data = await readJson<AaradhanesData>(STORAGE_FILE);
    if (!data) return null;

    const index = data.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated: Aaradhane = {
      ...data.items[index],
      ...updates,
      id: data.items[index].id,
      createdAt: data.items[index].createdAt,
      createdBy: data.items[index].createdBy,
    };

    data.items[index] = updated;
    await writeJson(STORAGE_FILE, data);

    return updated;
  },

  /**
   * Delete an aaradhane
   */
  async delete(id: string): Promise<boolean> {
    const data = await readJson<AaradhanesData>(STORAGE_FILE);
    if (!data) return false;

    const initialLength = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);

    if (data.items.length === initialLength) return false;

    await writeJson(STORAGE_FILE, data);
    return true;
  },

  /**
   * Get aaradhane statistics
   */
  async getStats() {
    const items = await this.getAll();
    return {
      total: items.length,
      upcoming: items.filter((i) => i.isUpcoming).length,
      past: items.filter((i) => !i.isUpcoming).length,
    };
  },

  /**
   * Get the count of all aaradhanes
   */
  async count(): Promise<number> {
    const data = await readJson<AaradhanesData>(STORAGE_FILE);
    return data?.items.length || 0;
  },
};
