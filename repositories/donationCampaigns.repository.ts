/**
 * Repository for managing donation campaigns.
 * This repository provides CRUD operations for campaigns using JSON storage.
 */

import { DonationCampaign, DonationCampaignRequest } from "@/types/donationCampaign";
import { readJson, writeJson, generateId } from "@/lib/storage";

const STORAGE_FILE = "donationCampaigns.json";

interface CampaignsData {
  items: DonationCampaign[];
}

export const donationCampaignsRepository = {
  /**
   * Get all campaigns, sorted by display order
   */
  async getAll(): Promise<DonationCampaign[]> {
    const data = await readJson<CampaignsData>(STORAGE_FILE);
    if (!data) return [];

    return [...data.items].sort((a, b) => {
      const orderA = a.displayOrder ?? 0;
      const orderB = b.displayOrder ?? 0;
      return orderA - orderB;
    });
  },

  /**
   * Get active campaigns
   */
  async getActive(): Promise<DonationCampaign[]> {
    const items = await this.getAll();
    return items.filter((item) => item.active);
  },

  /**
   * Get campaign by ID
   */
  async getById(id: string): Promise<DonationCampaign | null> {
    const data = await readJson<CampaignsData>(STORAGE_FILE);
    if (!data) return null;

    return data.items.find((item) => item.id === id) || null;
  },

  /**
   * Create a new campaign
   */
  async create(campaign: DonationCampaignRequest): Promise<DonationCampaign> {
    const data = await readJson<CampaignsData>(STORAGE_FILE) || { items: [] };
    const now = new Date().toISOString();

    const newCampaign: DonationCampaign = {
      ...campaign,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    data.items.push(newCampaign);
    await writeJson(STORAGE_FILE, data);

    return newCampaign;
  },

  /**
   * Update an existing campaign
   */
  async update(
    id: string,
    updates: Partial<DonationCampaignRequest>
  ): Promise<DonationCampaign | null> {
    const data = await readJson<CampaignsData>(STORAGE_FILE);
    if (!data) return null;

    const index = data.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated: DonationCampaign = {
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
   * Delete a campaign
   */
  async delete(id: string): Promise<boolean> {
    const data = await readJson<CampaignsData>(STORAGE_FILE);
    if (!data) return false;

    const initialLength = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);

    if (data.items.length === initialLength) return false;

    await writeJson(STORAGE_FILE, data);
    return true;
  },

  /**
   * Get the count of all campaigns
   */
  async count(): Promise<number> {
    const data = await readJson<CampaignsData>(STORAGE_FILE);
    return data?.items.length || 0;
  },
};
