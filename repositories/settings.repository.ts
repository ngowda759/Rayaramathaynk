/**
 * Repository for managing site and finance settings.
 * This repository provides CRUD operations for settings using JSON storage.
 */

import { SiteSettings, SiteSettingsPayload } from "@/types/settings";
import { FinanceSettings, defaultFinanceSettings } from "@/types/finance";
import { readJson, writeJson } from "@/lib/storage";

const STORAGE_FILE = "settings.json";

interface SettingsData {
  site: SiteSettings;
  finance: FinanceSettings;
}

const defaultSiteSettings: SiteSettings = {
  id: "site-config",
  templeName: "Sri Raghavendra Swamy Temple",
  contactEmail: "info@example.com",
  contactPhone: "",
  address: "",
  footerText: "",
  welcomeMessage: "",
};

export const settingsRepository = {
  /**
   * Get site settings
   */
  async getSiteSettings(): Promise<SiteSettings> {
    const data = await readJson<SettingsData>(STORAGE_FILE);
    if (!data?.site) return defaultSiteSettings;

    return {
      ...defaultSiteSettings,
      ...data.site,
    };
  },

  /**
   * Get finance settings
   */
  async getFinanceSettings(): Promise<FinanceSettings> {
    const data = await readJson<SettingsData>(STORAGE_FILE);
    if (!data?.finance) return defaultFinanceSettings;

    return {
      ...defaultFinanceSettings,
      ...data.finance,
    };
  },

  /**
   * Get all settings
   */
  async getAll(): Promise<SettingsData> {
    const data = await readJson<SettingsData>(STORAGE_FILE);
    if (!data) {
      return {
        site: defaultSiteSettings,
        finance: defaultFinanceSettings,
      };
    }

    return {
      site: {
        ...defaultSiteSettings,
        ...data.site,
      },
      finance: {
        ...defaultFinanceSettings,
        ...data.finance,
      },
    };
  },

  /**
   * Update site settings
   */
  async updateSiteSettings(
    id: string,
    updates: Partial<SiteSettingsPayload>
  ): Promise<SiteSettings> {
    const data = await readJson<SettingsData>(STORAGE_FILE) || {
      site: defaultSiteSettings,
      finance: defaultFinanceSettings,
    };

    const updated: SiteSettings = {
      ...data.site,
      ...updates,
      id: data.site.id,
      updatedAt: new Date().toISOString(),
    };

    await writeJson(STORAGE_FILE, {
      ...data,
      site: updated,
    });

    return updated;
  },

  /**
   * Update finance settings
   */
  async updateFinanceSettings(
    updates: Partial<FinanceSettings>
  ): Promise<FinanceSettings> {
    const data = await readJson<SettingsData>(STORAGE_FILE) || {
      site: defaultSiteSettings,
      finance: defaultFinanceSettings,
    };

    const updated: FinanceSettings = {
      ...data.finance,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await writeJson(STORAGE_FILE, {
      ...data,
      finance: updated,
    });

    return updated;
  },

  /**
   * Save all settings
   */
  async saveAll(settings: SettingsData): Promise<void> {
    await writeJson(STORAGE_FILE, {
      ...settings,
      site: {
        ...settings.site,
        updatedAt: new Date().toISOString(),
      },
      finance: {
        ...settings.finance,
        updatedAt: new Date().toISOString(),
      },
    });
  },
};
