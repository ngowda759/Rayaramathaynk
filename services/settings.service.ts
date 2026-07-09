import { SiteSettings, SiteSettingsPayload } from "@/types/settings";

import { settingsRepository } from "@/repositories";

class SettingsService {
  async getSettings(): Promise<SiteSettings | null> {
    return settingsRepository.getSiteSettings();
  }

  async createSettings(data: SiteSettingsPayload): Promise<string> {
    const result = await settingsRepository.updateSiteSettings("site-config", data);
    return result.id;
  }

  async updateSettings(id: string, data: Partial<SiteSettingsPayload>) {
    return settingsRepository.updateSiteSettings(id, data);
  }
}

export const settingsService = new SettingsService();
