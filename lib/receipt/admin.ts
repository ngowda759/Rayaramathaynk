/**
 * Server-only receipt creation service.
 *
 * Receipt numbers are allocated inside a Firestore transaction against a
 * `system/receiptCounter` document, so concurrent requests can never
 * receive the same number. The number is never generated in the browser.
 *
 * Item rates/totals are resolved server-side from the current seva catalogue --
 * a browser can never supply a tampered price or total. The seva name and
 * rate are snapshotted into the receipt item for historical accuracy, so
 * later price changes do not alter old receipts.
 */

import "server-only";
import { Firestore } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/admin-firebase";
import { ReceiptCreateInput, ReceiptItem } from "@/types/receipt";
import { ServerAdminUser } from "@/lib/auth/admin-auth";
import {
  DEFAULT_RECEIPT_PREFIX,
  formatReceiptNumber,
  nextSequenceForYear,
} from "@/lib/receipt/numbering";
import {
  computeItemAmount,
  computeReceiptTotals,
  sanitizeReceiptCreateInput,
  validateReceiptCreateInput,
} from "@/lib/receipt/validation";

const RECEIPTS_COLLECTION = "receipts";
const RECEIPT_SEVAS_COLLECTION = "receiptSevas";
const COUNTER_COLLECTION = "system";
const COUNTER_DOC = "receiptCounter";

export interface CreateReceiptResult {
  id: string;
  receiptNumber: string;
}

/**
 * Allocate the next receipt number for the current year inside a transaction.
 * Atomic: concurrent receipts get distinct, gapless numbers without reuse.
 */
async function allocateNextReceiptNumber(db: Firestore): Promise<string> {
  const counterRef = db.collection(COUNTER_COLLECTION).doc(COUNTER_DOC);
  const year = String(new Date().getFullYear());

  const receiptNumber = await db.runTransaction(async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const previous = counterSnap.exists ? (counterSnap.data() || {}) : null;
    const next = nextSequenceForYear(year, previous as { year?: string; lastNumber?: number } | null);
    await tx.set(counterRef, { year, lastNumber: next, prefix: DEFAULT_RECEIPT_PREFIX }, { merge: false });
    return formatReceiptNumber(DEFAULT_RECEIPT_PREFIX, year, next);
  });

  return receiptNumber;
}

/**
 * Create a receipt as an authenticated admin. Validates input, resolves
 * the current catalogue snapshot for each item, recomputes amounts/totals
 * server-side, allocates a receipt number in a transaction, and writes the
 * document. Returns the Firestore id and the issued receipt number.
 */
export async function createReceiptWithAdmin(
  input: ReceiptCreateInput,
  admin: ServerAdminUser
): Promise<CreateReceiptResult> {
  const validationErrors = validateReceiptCreateInput(input);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid receipt: ${validationErrors.join(" ")}`);
  }

  const sanitized = sanitizeReceiptCreateInput(input);
  const db = await getAdminFirestore();

  const items: ReceiptItem[] = [];
  for (const line of sanitized.items) {
    const sevaSnap = await db
      .collection(RECEIPT_SEVAS_COLLECTION)
      .doc(line.sevaId)
      .get();

    if (!sevaSnap.exists) {
      throw new Error(`Unknown seva: ${line.sevaId}`);
    }

    const seva = sevaSnap.data() || {};
    if (seva.active === false) {
      throw new Error(`Seva is disabled: ${seva.name || line.sevaId}`);
    }

    const rate = Number(seva.amount);
    if (!Number.isFinite(rate) || rate < 0) {
      throw new Error(`Seva has invalid amount: ${seva.name || line.sevaId}`);
    }

    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Invalid seva quantity.");
    }

    items.push({
      sevaId: line.sevaId,
      sevaName: String(seva.name || ""),
      rate,
      quantity,
      amount: computeItemAmount(quantity, rate),
    });
  }

  if (items.length === 0) {
    throw new Error("At least one seva is required.");
  }

  const { subtotal, totalAmount } = computeReceiptTotals(items);
  const receiptNumber = await allocateNextReceiptNumber(db);

  const createdAt = new Date();
  const receiptDoc = {
    receiptNumber,
    devoteeName: sanitized.devoteeName,
    devoteePhone: sanitized.devoteePhone || "" ,
    devoteeEmail: sanitized.devoteeEmail || "" ,
    devoteeAddress: sanitized.devoteeAddress || "" ,
    items,
    sevaIds: items.map((item) => item.sevaId),
    subtotal,
    totalAmount,
    paymentMode: sanitized.paymentMode,
    paymentReference: sanitized.paymentReference || "" ,
    notes: sanitized.notes || "" ,
    createdAt,
    createdBy: admin.email || admin.uid,
  };

  const docRef = db.collection(RECEIPTS_COLLECTION).doc();
  await docRef.set(receiptDoc);

  return { id: docRef.id, receiptNumber };
}