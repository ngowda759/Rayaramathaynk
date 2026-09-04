export interface ReceiptSeva {
  id: string;
  name: string;
  description: string;
  amount: number;
  active: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type ReceiptSevaInput = Omit<
  ReceiptSeva,
  "id" | "createdAt" | "updatedAt"
>;