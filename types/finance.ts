export interface FinanceSettings {
  enabled: boolean;
  billingEnabled: boolean;
  billing: BillingSettings;
  upi: {
    enabled: boolean;
    id: string;
    displayName: string;
  };
  bankTransfer: {
    enabled: boolean;
    accountName: string;
    accountNumber: string;
    bankName: string;
    ifscCode: string;
    branch: string;
  };
  specialSevas: SpecialSeva[];
  updatedAt?: string;
}

export interface BillingSettings {
  invoicePrefix: string;
  invoiceNumber: number;
  defaultDueDays: number;
  taxRate: number;
  currency: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyGstin: string;
  notes: string;
}

export interface SpecialSeva {
  id: string;
  title: string;
  description: string;
  amount: number;
  icon: string;
  isActive: boolean;
  order: number;
}

export const defaultFinanceSettings: FinanceSettings = {
  enabled: true,
  billingEnabled: false,
  billing: {
    invoicePrefix: "INV",
    invoiceNumber: 1000,
    defaultDueDays: 15,
    taxRate: 0,
    currency: "INR",
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    companyGstin: "",
    notes: "Thank you for your contribution to the temple.",
  },
  upi: {
    enabled: true,
    id: "",
    displayName: "Sri Rayara Matha",
  },
  bankTransfer: {
    enabled: true,
    accountName: "",
    accountNumber: "",
    bankName: "",
    ifscCode: "",
    branch: "",
  },
  specialSevas: [
    {
      id: "1",
      title: "Annadanam",
      description: "Sponsor prasada and meals for devotees visiting the temple.",
      amount: 501,
      icon: "heart",
      isActive: true,
      order: 1,
    },
    {
      id: "2",
      title: "Goshala",
      description: "Support the care and maintenance of our sacred cows.",
      amount: 1001,
      icon: "cows",
      isActive: true,
      order: 2,
    },
    {
      id: "3",
      title: "Temple Development",
      description: "Contribute towards renovation and future development projects.",
      amount: 5001,
      icon: "building",
      isActive: true,
      order: 3,
    },
  ],
};
