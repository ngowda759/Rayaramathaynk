/**
 * Repository for managing donations.
 * This repository provides CRUD operations for donations using JSON storage.
 */

import { DonationRecord, DonationRequest, DonationStatus } from "@/types/donation";
import { readJson, writeJson, generateId } from "@/lib/storage";

const STORAGE_FILE = "donations.json";

interface DonationsData {
  items: DonationRecord[];
}

export const donationsRepository = {
  /**
   * Get all donations, sorted by creation date (newest first)
   */
  async getAll(): Promise<DonationRecord[]> {
    const data = await readJson<DonationsData>(STORAGE_FILE);
    if (!data) return [];

    return [...data.items].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  },

  /**
   * Get donations from the last N days
   */
  async getRecent(days: number): Promise<DonationRecord[]> {
    const items = await this.getAll();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    
    return items.filter((item) => {
      const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      return createdAt >= cutoff;
    });
  },

  /**
   * Get donation by ID
   */
  async getById(id: string): Promise<DonationRecord | null> {
    const data = await readJson<DonationsData>(STORAGE_FILE);
    if (!data) return null;

    return data.items.find((item) => item.id === id) || null;
  },

  /**
   * Create a new donation
   */
  async create(donation: DonationRequest): Promise<DonationRecord> {
    const data = await readJson<DonationsData>(STORAGE_FILE) || { items: [] };
    const now = new Date().toISOString();

    const newDonation: DonationRecord = {
      ...donation,
      id: generateId(),
      status: "pending",
      receiptNumber: "",
      adminRemarks: "",
      collectedBy: "",
      collectedAt: "",
      createdAt: now,
      updatedAt: now,
    };

    data.items.push(newDonation);
    await writeJson(STORAGE_FILE, data);

    return newDonation;
  },

  /**
   * Update donation status
   */
  async updateStatus(
    id: string,
    status: DonationStatus
  ): Promise<DonationRecord | null> {
    const data = await readJson<DonationsData>(STORAGE_FILE);
    if (!data) return null;

    const index = data.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const now = new Date().toISOString();
    const updates: Partial<DonationRecord> = {
      status,
      updatedAt: now,
    };

    if (status === "received") {
      updates.collectedAt = now;
    }

    data.items[index] = { ...data.items[index], ...updates };
    await writeJson(STORAGE_FILE, data);

    return data.items[index];
  },

  /**
   * Update a donation record
   */
  async update(
    id: string,
    updates: Partial<DonationRecord>
  ): Promise<DonationRecord | null> {
    const data = await readJson<DonationsData>(STORAGE_FILE);
    if (!data) return null;

    const index = data.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated: DonationRecord = {
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
   * Delete a donation
   */
  async delete(id: string): Promise<boolean> {
    const data = await readJson<DonationsData>(STORAGE_FILE);
    if (!data) return false;

    const initialLength = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);

    if (data.items.length === initialLength) return false;

    await writeJson(STORAGE_FILE, data);
    return true;
  },

  /**
   * Get the count of all donations
   */
  async count(): Promise<number> {
    const data = await readJson<DonationsData>(STORAGE_FILE);
    return data?.items.length || 0;
  },
};
