import {
  DonationCampaign,
  DonationCampaignRequest,
} from "@/types/donationCampaign";

import { donationCampaignsRepository } from "@/repositories";

class DonationCampaignService {
  async getCampaigns(): Promise<
    DonationCampaign[]
  > {
    return donationCampaignsRepository.getAll();
  }

  async getActiveCampaigns(): Promise<
    DonationCampaign[]
  > {
    return donationCampaignsRepository.getActive();
  }

  async getCampaignById(
    id: string
  ): Promise<DonationCampaign | null> {
    return donationCampaignsRepository.getById(id);
  }

  async createCampaign(
    data: DonationCampaignRequest
  ) {
    const result = await donationCampaignsRepository.create(data);
    return result.id;
  }

  async updateCampaign(
    id: string,
    data: Partial<DonationCampaignRequest>
  ) {
    await donationCampaignsRepository.update(id, data);
  }

  async deleteCampaign(id: string) {
    await donationCampaignsRepository.delete(id);
  }
}

export const donationCampaignService =
  new DonationCampaignService();
