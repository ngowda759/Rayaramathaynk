/**
 * Prasadam counter DTOs (DB §11; plan Task A3-2). No amounts and no phone number, ever (C-27, Global Constraints).
 * Types only - no runtime code.
 */

export interface PrasadamReceipt {
  id: string;
  receiptNo: string;
  devoteeName: string;
  sevaDate: string;
  issuedAt: string;
  /** '2 of 3 · paid together · group G-2608-0317' for a receipt paid with others; null for a single receipt. */
  groupLine: string | null;
  lines: { nameEn: string; nameKn: string | null; quantity: number; prasadamItems: string | null }[];
}

export type PrasadamLookupResult =
  | { state: 'ready'; receipt: PrasadamReceipt }
  | {
      state: 'another_day';
      receipt: PrasadamReceipt;
      /** 'before': today is before the seva date; 'after': the seva date has passed. */
      offDate: 'before' | 'after';
      days: number;
      /** The receipt of the same group whose seva date is today, when there is one. */
      todaysSlip: { receiptNo: string; position: number; count: number } | null;
    }
  | { state: 'already_given'; receipt: PrasadamReceipt; givenAt: string; givenBy: string }
  | { state: 'cancelled'; receipt: PrasadamReceipt; cancelledAt: string; cancelledBy: string; reason: string }
  | { state: 'no_prasadam'; receipt: PrasadamReceipt }
  | { state: 'choose'; options: { receiptId: string; receiptNo: string; sevaDate: string; devoteeName: string }[] }
  | { state: 'not_found'; query: string };
