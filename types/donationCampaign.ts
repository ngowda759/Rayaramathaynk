export interface DonationCampaign {
  id: string;

  title: string;

  description: string;

  imageUrl: string;

  suggestedAmount: number;

  active: boolean;

  displayOrder: number;

  createdAt: string;

  updatedAt: string;
}

export type DonationCampaignRequest = Omit<
  DonationCampaign,
  "id" | "createdAt" | "updatedAt"
>;
