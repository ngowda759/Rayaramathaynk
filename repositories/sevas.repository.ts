/**
 * Repository for managing sevas.
 * This repository provides CRUD operations for sevas using JSON storage.
 */

import { Seva, SevaRequest } from "@/types/seva";
import { readJson, writeJson, generateId } from "@/lib/storage";

const STORAGE_FILE = "sevas.json";

interface SevasData {
  items: Seva[];
}

export const sevasRepository = {
  /**
   * Get all sevas
   */
  async getAll(): Promise<Seva[]> {
    const data = await readJson<SevasData>(STORAGE_FILE);
    return data?.items || [];
  },

  /**
   * Get seva by ID
   */
  async getById(id: string): Promise<Seva | null> {
    const data = await readJson<SevasData>(STORAGE_FILE);
    if (!data) return null;

    return data.items.find((item) => item.id === id) || null;
  },

  /**
   * Create a new seva
   */
  async create(seva: SevaRequest): Promise<Seva> {
    const data = await readJson<SevasData>(STORAGE_FILE) || { items: [] };
    const now = new Date().toISOString();

    const newSeva: Seva = {
      ...seva,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    data.items.push(newSeva);
    await writeJson(STORAGE_FILE, data);

    return newSeva;
  },

  /**
   * Update an existing seva
   */
  async update(
    id: string,
    updates: Partial<SevaRequest>
  ): Promise<Seva | null> {
    const data = await readJson<SevasData>(STORAGE_FILE);
    if (!data) return null;

    const index = data.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated: Seva = {
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
   * Delete a seva
   */
  async delete(id: string): Promise<boolean> {
    const data = await readJson<SevasData>(STORAGE_FILE);
    if (!data) return false;

    const initialLength = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);

    if (data.items.length === initialLength) return false;

    await writeJson(STORAGE_FILE, data);
    return true;
  },

  /**
   * Get the count of all sevas
   */
  async count(): Promise<number> {
    const data = await readJson<SevasData>(STORAGE_FILE);
    return data?.items.length || 0;
  },
};
