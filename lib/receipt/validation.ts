import { PaymentMode, ReceiptCreateInput, ReceiptItem } from "@/types/receipt";
import { ReceiptSevaInput } from "@/types/receiptSeva";

export const RECEIPT_PAYMENT_MODE: PaymentMode = "upi";

export function computeItemAmount(quantity: number, rate: number): number {
  return quantity * rate;
}

export function computeReceiptTotals(items: ReceiptItem[]): {
  subtotal: number;
  totalAmount: number;
} {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  return { subtotal, totalAmount: subtotal };
}

/**
 * Validate a receipt payload received from the admin UI.
 * Returns an array of human-readable validation errors (empty when valid).
 * Runs on both client and server.
 */
export function validateReceiptCreateInput(
  input: Partial<ReceiptCreateInput>
): string[] {
  const errors: string[] = [];

  if (!input.devoteeName || typeof input.devoteeName !== "string" || input.devoteeName.trim() === "") {
    errors.push("Devotee name is required.");
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.push("At least one seva is required.");
  } else {
    input.items.forEach((item, index) => {
      if (typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        errors.push(`Item ${index + 1}: quantity must be a positive whole number.`);
      }
      if (typeof item.sevaId !== "string" || item.sevaId.trim() === "") {
        errors.push(`Item ${index + 1}: seva must be selected.`);
      }
    });
  }

  if (input.paymentMode !== RECEIPT_PAYMENT_MODE) {
    errors.push("Payment mode must be UPI.");
  }

  if (
    input.devoteeEmail &&
    typeof input.devoteeEmail === "string" &&
    input.devoteeEmail.trim() !== ""
  ) {
    const email = input.devoteeEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Enter a valid email address.");
    }
  }

  return errors;
}

/**
 * Validate a seva catalogue payload from the admin UI.
 * Negative prices and empty names are rejected; sevas already used in
 * receipts are never physically deleted (only disabled) so no delete input exists.
 */
export function validateReceiptSevaInput(
  input: Partial<ReceiptSevaInput>
): string[] {
  const errors: string[] = [];

  if (!input.name || typeof input.name !== "string" || input.name.trim() === "") {
    errors.push("Seva name is required.");
  } else if (input.name.trim().length > 120) {
    errors.push("Seva name must be 120 characters or fewer.");
  }

  if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount < 0) {
    errors.push("Seva amount must be a non-negative number.");
  }

  if (
    input.displayOrder !== undefined &&
    (typeof input.displayOrder !== "number" || !Number.isInteger(input.displayOrder) || input.displayOrder < 0)
  ) {
    errors.push("Display order must be a non-negative whole number.");
  }

  return errors;
}

/**
 * Trim whitespace from string fields before storing.
 */
export function sanitizeReceiptCreateInput(
  input: ReceiptCreateInput
): ReceiptCreateInput {
  return {
    devoteeName: input.devoteeName.trim(),
    devoteePhone: input.devoteePhone?.trim() || undefined,
    devoteeEmail: input.devoteeEmail?.trim() || undefined,
    devoteeAddress: input.devoteeAddress?.trim() || undefined,
    items: input.items,
    paymentMode: RECEIPT_PAYMENT_MODE,
    paymentReference: input.paymentReference?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  };
}

export function sanitizeReceiptSevaInput(
  input: ReceiptSevaInput
): ReceiptSevaInput {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || "",
    amount: input.amount,
    active: Boolean(input.active),
    displayOrder: input.displayOrder ?? 0,
  };
}