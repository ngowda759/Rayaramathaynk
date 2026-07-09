/**
 * Repository for managing poojas.
 * This repository provides CRUD operations for poojas using JSON storage.
 */

import { DailyPooja } from "@/types/pooja";
import { readJson, writeJson, generateId } from "@/lib/storage";

const STORAGE_FILE = "poojas.json";

interface PoojasData {
  items: DailyPooja[];
}

export const poojasRepository = {
  /**
   * Get all poojas, sorted by display order
   */
  async getAll(): Promise<DailyPooja[]> {
    const data = await readJson<PoojasData>(STORAGE_FILE);
    if (!data) return [];

    return [...data.items].sort((a, b) => {
      const orderA = a.displayOrder ?? 0;
      const orderB = b.displayOrder ?? 0;
      return orderA - orderB;
    });
  },

  /**
   * Get pooja by ID
   */
  async getById(id: string): Promise<DailyPooja | null> {
    const data = await readJson<PoojasData>(STORAGE_FILE);
    if (!data) return null;

    return data.items.find((item) => item.id === id) || null;
  },

  /**
   * Create a new pooja
   */
  async create(
    pooja: Omit<DailyPooja, "id" | "createdAt" | "createdBy">
  ): Promise<DailyPooja> {
    const data = await readJson<PoojasData>(STORAGE_FILE) || { items: [] };

    const newPooja: DailyPooja = {
      ...pooja,
      id: generateId(),
      createdAt: new Date().toISOString(),
      createdBy: pooja.createdBy || "",
    };

    data.items.push(newPooja);
    await writeJson(STORAGE_FILE, data);

    return newPooja;
  },

  /**
   * Update an existing pooja
   */
  async update(
    id: string,
    updates: Partial<Omit<DailyPooja, "id" | "createdAt" | "createdBy">>
  ): Promise<DailyPooja | null> {
    const data = await readJson<PoojasData>(STORAGE_FILE);
    if (!data) return null;

    const index = data.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated: DailyPooja = {
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
   * Delete a pooja
   */
  async delete(id: string): Promise<boolean> {
    const data = await readJson<PoojasData>(STORAGE_FILE);
    if (!data) return false;

    const initialLength = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);

    if (data.items.length === initialLength) return false;

    await writeJson(STORAGE_FILE, data);
    return true;
  },

  /**
   * Get the count of all poojas
   */
  async count(): Promise<number> {
    const data = await readJson<PoojasData>(STORAGE_FILE);
    return data?.items.length || 0;
  },
};
