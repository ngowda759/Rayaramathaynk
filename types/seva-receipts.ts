/**
 * Receipt register, receipt detail and public receipt DTOs (DB §9.9, §10.3, §12.3; plan Task A3-2).
 * Wire format: camelCase, money in integer paise, dates 'YYYY-MM-DD', times ISO-8601. Types only - no runtime code.
 * None of these ever carries the devotee's phone number (C-16, C-31, C-50).
 */

import type { CancelReasonCode, IssuedReceipt, PaymentMode } from './seva';

export type RefundState = 'none' | 'due' | 'processing' | 'done' | 'failed';

/** Register filters for `status` (DB §12.3). */
export type ReceiptStatusFilter = 'issued' | 'cancelled' | 'changed' | 'duplicate' | 'prasadam_pending';

export interface ReceiptListItem {
  id: string;
  receiptNo: string;
  series: string;
  businessDate: string;
  issuedAt: string;
  devoteeName: string;
  /** The receipt's sevas in line order, e.g. 'Paaduka Pooja x2, Archane'. */
  sevas: string;
  totalPaise: number;
  mode: PaymentMode;
  status: 'issued' | 'cancelled';
  changed: boolean;
  printCount: number;
  prasadam: 'none' | 'pending' | 'given';
  groupNo: string;
  position: number;
  count: number;
  issuedByStaffId: string | null;
  /** issued_at + the cancel window while the receipt is issued; null once cancelled. */
  cancelDeadline: string | null;
  refundState: RefundState;
}

export interface ReceiptDetail extends IssuedReceipt {
  /** Newest first: issue, first print, audit rows (reprints, cancel, amount changes, prasadam) and the prasadam give. */
  history: { at: string; action: string; by: string | null; reason: string | null }[];
  cancel: { at: string; by: string; reasonCode: CancelReasonCode; note: string | null } | null;
  refundState: ReceiptListItem['refundState'];
}

/** What `/r/<token>` shows without sign-in: the printed slip's details, never the phone (C-50). */
export interface PublicReceipt {
  templeNameEn: string;
  templeNameKn: string;
  receiptNo: string;
  sevaDate: string;
  devoteeName: string;
  gotra: string | null;
  nakshatra: string | null;
  lines: { nameEn: string; nameKn: string | null; quantity: number; amountPaise: number }[];
  totalPaise: number;
  mode: PaymentMode;
  status: 'valid' | 'cancelled';
  prasadam: 'none' | 'pending' | 'given';
}

/** One returning-devotee match from `devotees/search` (DB §9.2): only the last four digits of the phone. */
export interface DevoteeMatch {
  name: string;
  gotra: string | null;
  gotraId: number | null;
  nakshatraId: number | null;
  rashiId: number | null;
  phoneLast4: string | null;
  lastVisit: string;
}
