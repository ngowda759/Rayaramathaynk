import { HomepageConfig } from "@/types/homepage";

import { homepageRepository } from "@/repositories";

class HomepageService {
  async getHomepage(): Promise<HomepageConfig> {
    return homepageRepository.get();
  }

  async saveHomepage(data: HomepageConfig): Promise<void> {
    return homepageRepository.save(data);
  }

  getDefaultConfig(): HomepageConfig {
    return homepageRepository.getDefault();
  }
}

export const homepageService = new HomepageService();
