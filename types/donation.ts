export type DonationStatus =
  | "pending"
  | "received"
  | "failed";

export interface DonationRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  amount: number;
  message: string;
  paymentMethod: string;
  status: DonationStatus;
  createdAt: string;
  updatedAt: string;
}

export type DonationRequest = Omit<
  DonationRecord,
  "id" | "status" | "createdAt" | "updatedAt"
>;
