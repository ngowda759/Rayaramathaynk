import {
  DonationRecord,
  DonationRequest,
  DonationStatus,
} from "@/types/donation";

import { donationsRepository } from "@/repositories";

class DonationService {
  async createDonation(
    data: DonationRequest
  ): Promise<string> {
    const result = await donationsRepository.create(data);
    return result.id;
  }

  async getDonations(): Promise<DonationRecord[]> {
    return donationsRepository.getAll();
  }

  async getDonationById(
    donationId: string
  ): Promise<DonationRecord | null> {
    return donationsRepository.getById(donationId);
  }

  async updateDonationStatus(
    donationId: string,
    status: DonationStatus
  ): Promise<void> {
    await donationsRepository.updateStatus(donationId, status);
  }

  async updateDonation(
    donationId: string,
    data: Partial<DonationRecord>
  ): Promise<void> {
    await donationsRepository.update(donationId, data);
  }

  async deleteDonation(
    donationId: string
  ): Promise<void> {
    await donationsRepository.delete(donationId);
  }
}

export const donationService =
  new DonationService();
