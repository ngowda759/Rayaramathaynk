import { Timestamp, FieldValue } from "firebase/firestore";

export type BillStatus = "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "partial" | "refunded";

export interface BillItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
}

export interface BillPayment {
  id: string;
  amount: number;
  date: Timestamp | Date;
  method: "cash" | "bank_transfer" | "upi" | "card" | "other";
  reference?: string;
  notes?: string;
}

export interface Bill {
  id: string;
  invoiceNumber: string;
  billDate: Timestamp | Date;
  dueDate: Timestamp | Date;
  
  // Customer Details
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerGstin?: string;
  
  // Items
  items: BillItem[];
  
  // Totals
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  
  // Status
  status: BillStatus;
  paymentStatus: PaymentStatus;
  
  // Payments
  payments: BillPayment[];
  
  // Notes
  notes?: string;
  
  // Metadata
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  createdBy: string;
}

export interface BillCreateInput {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerGstin?: string;
  billDate?: Date;
  dueDate?: Date;
  items: Omit<BillItem, "id">[];
  discountAmount?: number;
  notes?: string;
}

export interface BillUpdateInput {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerGstin?: string;
  billDate?: Date;
  dueDate?: Date;
  items?: BillItem[];
  discountAmount?: number;
  status?: BillStatus;
  paymentStatus?: PaymentStatus;
  notes?: string;
}
