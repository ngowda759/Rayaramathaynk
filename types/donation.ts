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
