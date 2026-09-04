export type PaymentMode = "upi";

export interface ReceiptItem {
  sevaId: string;
  sevaName: string;
  rate: number;
  quantity: number;
  amount: number;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  devoteeName: string;
  devoteePhone?: string;
  devoteeEmail?: string;
  devoteeAddress?: string;
  items: ReceiptItem[];
  subtotal: number;
  totalAmount: number;
  paymentMode: PaymentMode;
  paymentReference?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

/**
 * Payload accepted from the admin UI. Rates/totals are deliberately excluded:
 * the server resolves the current catalogue rate for each seva and computes totals,
 * so a browser can never supply a tampered price or total.
 */
export interface ReceiptCreateInput {
  devoteeName: string;
  devoteePhone?: string;
  devoteeEmail?: string;
  devoteeAddress?: string;
  items: { sevaId: string; quantity: number }[];
  paymentMode: PaymentMode;
  paymentReference?: string;
  notes?: string;
}