export type DonationStatus =
  | "pending"
  | "received"
  | "failed";

export type PaymentMode =
  | "cash"
  | "upi"
  | "bank_transfer"
  | "cheque"
  | "other";

export interface DonationRecord {
  id: string;

  donorName: string;
  email: string;
  phone: string;
  address: string;

  amount: number;

  purpose: string;
  campaignId: string;

  message: string;

  paymentMode: PaymentMode;

  status: DonationStatus;

  receiptNumber: string;

  adminRemarks: string;

  collectedBy: string;

  collectedAt: string;

  createdAt: string;
  updatedAt: string;
}

export type DonationRequest = Omit<
  DonationRecord,
  | "id"
  | "status"
  | "receiptNumber"
  | "adminRemarks"
  | "collectedBy"
  | "collectedAt"
  | "createdAt"
  | "updatedAt"
>;

export const paymentModeOptions = [
  {
    label: "Cash",
    value: "cash",
  },
  {
    label: "UPI",
    value: "upi",
  },
  {
    label: "Bank Transfer",
    value: "bank_transfer",
  },
  {
    label: "Cheque",
    value: "cheque",
  },
  {
    label: "Other",
    value: "other",
  },
];

// Donation purposes configuration
export interface DonationPurpose {
  id: string;
  title: string;
  description: string;
  suggestedAmount: number;
  icon: string;
  isActive: boolean;
  order: number;
}

export const defaultDonationPurposes: DonationPurpose[] = [
  {
    id: "1",
    title: "Annadanam",
    description: "Sponsor prasada and meals for devotees visiting the temple.",
    suggestedAmount: 501,
    icon: "heart",
    isActive: true,
    order: 1,
  },
  {
    id: "2",
    title: "Goshala",
    description: "Support the care and maintenance of our sacred cows.",
    suggestedAmount: 1001,
    icon: "cows",
    isActive: true,
    order: 2,
  },
  {
    id: "3",
    title: "Temple Development",
    description: "Contribute towards renovation and future development projects.",
    suggestedAmount: 5001,
    icon: "building",
    isActive: true,
    order: 3,
  },
];
