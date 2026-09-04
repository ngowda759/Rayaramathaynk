import {
  computeItemAmount,
  computeReceiptTotals,
  RECEIPT_PAYMENT_MODE,
  sanitizeReceiptCreateInput,
  sanitizeReceiptSevaInput,
  validateReceiptCreateInput,
  validateReceiptSevaInput,
} from "@/lib/receipt/validation";
import { ReceiptCreateInput, ReceiptItem } from "@/types/receipt";

const validInput: ReceiptCreateInput = {
  devoteeName: "Rama Rao",
  devoteePhone: "+91 98765 43210",
  devoteeEmail: "rama@example.com",
  devoteeAddress: "Yelahanka, Bengaluru",
  items: [
    { sevaId: "seva1", quantity: 2 },
  ],
  paymentMode: "upi",
  paymentReference: "UPI12345",
  notes: "Temple receipt",
};

describe("receipt validation", () => {
  it("computes the item amount as quantity times rate", () => {
    expect(computeItemAmount(2, 105)).toBe(210);
    expect(computeItemAmount(1, 505)).toBe(505);
  });

  it("computes totals as the sum of item amounts", () => {
    const items: ReceiptItem[] = [
      { sevaId: "a", sevaName: "A", rate: 105, quantity: 1, amount: 105 },
      { sevaId: "b", sevaName: "B", rate: 505, quantity: 2, amount: 1010 },
    ];
    expect(computeReceiptTotals(items)).toEqual({ subtotal: 1115, totalAmount:  1115 });
  });

  it("accepts a valid receipt payload", () => {
    expect(validateReceiptCreateInput(validInput)).toEqual([]);
  });

  it("rejects an empty devotee name", () => {
    expect(validateReceiptCreateInput({ ...validInput, devoteeName: "  " })).not.toEqual([]);
  });

  it("rejects receipts with no items", () => {
    expect(validateReceiptCreateInput({ ...validInput, items: [] })).not.toEqual([]);
  });

  it("rejects a zero or negative quantity", () => {
    expect(validateReceiptCreateInput({
      ...validInput,
      items: [{ sevaId: "seva1", quantity: 0 }],
    })).not.toEqual([]);
    expect(validateReceiptCreateInput({
      ...validInput,
      items: [{ sevaId: "seva1", quantity: -2 }],
    })).not.toEqual([]);
  });

  it("rejects a missing seva id", () => {
    expect(validateReceiptCreateInput({
      ...validInput,
      items: [{ sevaId: "", quantity: 1 }],
    })).not.toEqual([]);
  });

  it("rejects payment modes other than upi", () => {
    expect(validateReceiptCreateInput({
      ...validInput,
      paymentMode: "cash" as "upi",
    })).not.toEqual([]);
  });

  it("rejects an invalid email address", () => {
    expect(validateReceiptCreateInput({
      ...validInput,
      devoteeEmail: "not-an-email",
    })).not.toEqual([]);
  });

  it("trims string fields when sanitizing", () => {
    const sanitized = sanitizeReceiptCreateInput({
      ...validInput,
      devoteeName: "  Rama Rao  ",
      notes: "  note ",
    });
    expect(sanitized.devoteeName).toBe("Rama Rao");
    expect(sanitized.notes).toBe("note");
  });

  it("normalizes payment mode to UPI only", () => {
    expect(RECEIPT_PAYMENT_MODE).toBe("upi");
  });

  it("accepts a valid seva catalogue input", () => {
    expect(validateReceiptSevaInput({
      name: "Panchamrutha Seva",
      amount: 105,
      active: true,
      displayOrder:  1,
      description: "",
    })).toEqual([]);
  });

  it("rejects an empty seva name", () => {
    expect(validateReceiptSevaInput({
      name: "   ",
      amount: 105,
      active: true,
      displayOrder: 1,
      description: "",
    })).not.toEqual([]);
  });

  it("rejects a negative seva price", () => {
    expect(validateReceiptSevaInput({
      name: "Seva",
      amount: -10,
      active: true,
      displayOrder: 1,
      description: "",
    })).not.toEqual([]);
  });

  it("allows a zero seva price (only negatives are banned)", () => {
    expect(validateReceiptSevaInput({
      name: "Free Seva",
      amount: 0,
      active: true,
      displayOrder:  1,
      description: "",
    })).toEqual([]);
  });

  it("sanitizes seva catalogue input", () => {
    const sanitized = sanitizeReceiptSevaInput({
      name: "  Panchamrutha Seva  ",
      description: "  desc  ",
      amount: 105,
      active: true,
      displayOrder:  1,
    });
    expect(sanitized.name).toBe("Panchamrutha Seva");
    expect(sanitized.description).toBe("desc");
  });
});