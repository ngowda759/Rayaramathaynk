/**
 * Words of the counter screens (Design Book 9.1-9.6, 9.11), English with Kannada under it (C-49).
 * Kannada is to be proof-read by the temple office (O-03). The privacy line under step 1 is sample text for the
 * owner's approval (O-19).
 */
import type { GroupResult } from '@/lib/seva/grouping';
import type { SaveBlock } from '@/lib/seva/counter/state';
import { formatRupees } from '@/lib/seva/money';
import { formatSevaDate, istParts } from '@/lib/seva/time';
import type { Bi } from './common';

/** 'Rs 820' for whole rupees, 'Rs 105.50' otherwise. */
export function rupees(paise: number): string {
  return formatRupees(paise, { decimals: paise % 100 !== 0 });
}

/**
 * The rupee text of an amount that counts up to `finalPaise` (AnimatedNumber): whole rupees while it counts, so no
 * stray paise flicker past, and exactly `rupees(finalPaise)` once it lands.
 */
export function countingRupees(finalPaise: number): (paise: number) => string {
  return (paise) => (paise === finalPaise ? rupees(finalPaise) : rupees(Math.round(paise / 100) * 100));
}

/** 'Sat 28 Aug' - the seva date without the year, as the summary line reads it. */
export function shortSevaDate(date: string): string {
  return formatSevaDate(date).split(' ').slice(0, 3).join(' ');
}

/** IST clock time as the counter shows it: '10:12 AM'. */
export function clockTime(iso: string): string {
  const p = istParts(new Date(iso));
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${hour12}:${String(p.minute).padStart(2, '0')} ${p.hour < 12 ? 'AM' : 'PM'}`;
}

/** '1 receipt' / '3 receipts'. */
export function receiptCount(n: number): string {
  return n === 1 ? '1 receipt' : `${n} receipts`;
}

/** Design Book 9.3: '3 receipts: Sat 28 Aug Rs 610, Sun 29 Aug Rs 105, Mon 30 Aug Rs 105. Total Rs 820.' */
export function orderSummaryText(groups: GroupResult): string {
  if (!groups.ok) return '';
  const parts = groups.receipts.map((g) => `${shortSevaDate(g.sevaDate)} ${rupees(g.totalPaise)}`);
  return `${receiptCount(groups.receipts.length)}: ${parts.join(', ')}. Total ${rupees(groups.totalPaise)}.`;
}

/** The amber offline strip (Design Book 9.11). */
export function offlineBannerText(p: { sinceIso: string | null; waiting: number; series: string }): string {
  const since = p.sinceIso ? ` since ${clockTime(p.sinceIso)}` : '';
  const waiting = p.waiting === 1 ? '1 is waiting.' : `${p.waiting} are waiting.`;
  return (
    `Working offline${since}. Receipts still save and print, cash and UPI. They use ${p.series} numbers. ` +
    `${waiting} They send themselves when the line is back.`
  );
}

export const OFFLINE_BANNER_KN =
  'ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತಿದೆ. ರಸೀದಿಗಳು ಉಳಿಯುತ್ತವೆ ಮತ್ತು ಮುದ್ರಣವಾಗುತ್ತವೆ. ಸಂಪರ್ಕ ಬಂದಾಗ ತಾವಾಗಿಯೇ ಕಳುಹಿಸಲ್ಪಡುತ್ತವೆ.';

/** 'This PC clock is 4 minutes off' when the heartbeat skew is above 2 minutes (Design Book 8.3, 9.1). */
export const CLOCK_SKEW_LIMIT_MS = 2 * 60 * 1000;
export function clockSkewText(skewMs: number): string | null {
  if (Math.abs(skewMs) <= CLOCK_SKEW_LIMIT_MS) return null;
  const minutes = Math.round(Math.abs(skewMs) / 60_000);
  return `This PC clock is ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} off`;
}

export function saveButtonText(receipts: number): string {
  return receipts > 0 ? `Save and print ${receiptCount(receipts)}` : 'Save and print';
}

export function toPayText(totalPaise: number, receipts: number): string {
  return receipts > 1
    ? `for ${receiptCount(receipts)}, paid together`
    : receipts === 1
      ? 'for 1 receipt'
      : `${rupees(totalPaise)}`;
}

export function printedTitle(n: number): string {
  return `${receiptCount(n)} printed`;
}

export function waitingText(n: number): string {
  return `${n} waiting`;
}

/** Why Save is not ready yet, in the order the screen asks for things. */
export const SAVE_BLOCK_TEXT: Record<SaveBlock, Bi> = {
  no_name: { en: 'Type the devotee name.', kn: 'ಭಕ್ತರ ಹೆಸರನ್ನು ಬರೆಯಿರಿ.' },
  no_lines: { en: 'Add at least one seva.', kn: 'ಕನಿಷ್ಠ ಒಂದು ಸೇವೆಯನ್ನು ಸೇರಿಸಿ.' },
  group_error: {
    en: 'Too many sevas: at most 8 on one date and 31 dates in one order.',
    kn: 'ಹೆಚ್ಚು ಸೇವೆಗಳು: ಒಂದು ದಿನಾಂಕಕ್ಕೆ ಗರಿಷ್ಠ 8, ಒಂದು ಆದೇಶದಲ್ಲಿ ಗರಿಷ್ಠ 31 ದಿನಾಂಕಗಳು.',
  },
  reason_missing: { en: 'Give a reason for each changed amount.', kn: 'ಬದಲಿಸಿದ ಮೊತ್ತಕ್ಕೆ ಕಾರಣ ಬರೆಯಿರಿ.' },
  amount_missing: { en: 'Type the amount for "Any amount" sevas.', kn: 'ಯಾವುದೇ ಮೊತ್ತದ ಸೇವೆಗೆ ಮೊತ್ತ ಬರೆಯಿರಿ.' },
  upi_incomplete: {
    en: 'Type the last 6 digits of the UPI reference and tick that you saw the payment succeed.',
    kn: 'UPI ಉಲ್ಲೇಖದ ಕೊನೆಯ 6 ಅಂಕೆಗಳನ್ನು ಬರೆದು, ಪಾವತಿ ಯಶಸ್ವಿಯಾಗಿದ್ದನ್ನು ಗುರುತಿಸಿ.',
  },
  cash_short: { en: 'The cash received is less than the total.', kn: 'ಪಡೆದ ನಗದು ಒಟ್ಟು ಮೊತ್ತಕ್ಕಿಂತ ಕಡಿಮೆ ಇದೆ.' },
  large_cash_unconfirmed: {
    en: 'Cash of Rs 2,00,000 or more: confirm before saving.',
    kn: 'ರೂ 2,00,000 ಅಥವಾ ಹೆಚ್ಚಿನ ನಗದು: ಉಳಿಸುವ ಮೊದಲು ದೃಢೀಕರಿಸಿ.',
  },
  submitting: { en: 'Saving...', kn: 'ಉಳಿಸಲಾಗುತ್ತಿದೆ...' },
};

/** Why an order could not be printed offline (lib/seva/offline/submitter.ts OfflineIssueCode). */
export const OFFLINE_ISSUE_TEXT: Record<string, string> = {
  offline_unknown_seva: 'A seva on this order is not in the saved catalogue. Remove it, or wait for the line to come back.',
  offline_amount_missing: 'An amount is missing. Check the sevas and try again.',
  offline_total_mismatch: 'The total does not match the saved catalogue. Check the sevas and try again.',
  offline_clock_invalid: 'This PC clock looks wrong, so offline numbers cannot be made. Fix the date and time first.',
  offline_empty_order: 'Add at least one seva.',
};

export const COUNTER_TEXT: {
  steps: { devotee: Bi; sevas: Bi; pay: Bi };
  stepsLabel: string;
  stepOf(n: number): string;
  keysStep1: string;
  keysStep2: string;
  keysStep3: string;
  devoteeTitle: Bi;
  onlyName: Bi;
  name: Bi;
  phone: Bi;
  phoneHint: Bi;
  privacy: Bi;
  searchGotra: string;
  searchNakshatra: string;
  searchRashi: string;
  notKnown: Bi;
  returning: Bi;
  useDetails: Bi;
  notThisPerson: Bi;
  undo: Bi;
  filledFrom(date: string): string;
  phoneEnding(last4: string): string;
  lastVisit(date: string): string;
  next: Bi;
  nextSevas: Bi;
  nextPay: Bi;
  back: Bi;
  sevasTitle: Bi;
  sevasHint: Bi;
  findSeva: Bi;
  findSevaPlaceholder: string;
  onThisReceipt: Bi;
  noLinesYet: Bi;
  allSevas: Bi;
  tilesLabel: string;
  tilesHint: Bi;
  anyAmount: Bi;
  noMatch: Bi;
  quantity: Bi;
  less: string;
  more: string;
  remove: Bi;
  changeAmount: Bi;
  changed: Bi;
  amount: Bi;
  dates: Bi;
  datesFor(seva: string): string;
  chooseDates: Bi;
  done: Bi;
  previousMonth: string;
  nextMonth: string;
  festivalDays: Bi;
  multiDateHint: Bi;
  singleDateHint: Bi;
  amountDialogTitle: Bi;
  newRate: Bi;
  catalogueRate(r: string): string;
  reason: Bi;
  reasonHint: Bi;
  apply: Bi;
  cancel: Bi;
  amountInvalid: string;
  reasonTooShort: string;
  payTitle: Bi;
  payHint: Bi;
  toPay: Bi;
  paymentMode: string;
  cash: Bi;
  upi: Bi;
  received: Bi;
  receivedHint: Bi;
  returnChange: Bi;
  short: Bi;
  largeCash: Bi;
  confirmLargeCash: Bi;
  largeCashConfirmed: Bi;
  upiNotSetUp: Bi;
  upiScan: Bi;
  upiRef: Bi;
  upiSeen: Bi;
  upiQrLabel: string;
  summaryTitle: Bi;
  summaryEmptyStep1: Bi;
  summaryEmpty: Bi;
  total: Bi;
  saving: Bi;
  statusLabel: string;
  online: string;
  offline: string;
  nextNumber: Bi;
  today: Bi;
  waiting: Bi;
  workOffline: Bi;
  closeDay: Bi;
  printedSub(name: string, total: string, mode: string, together: boolean, group: string): string;
  of(position: number, count: number): string;
  sevaCount(n: number): string;
  todaysReceipts: Bi;
  printedOffline: Bi;
  printFailed: string;
  offlineSaved: string;
  inDoubtTitle: Bi;
  inDoubtBody: Bi;
  inDoubtYes: Bi;
  inDoubtNo: Bi;
  cancelledNothingSaved: string;
  inDoubtFirstVersionKept: string;
  inDoubtOrderOpen: Bi;
  inDoubtOrderCleared: Bi;
  inDoubtOrderDismiss: string;
  registerTitle: Bi;
  registerAdmin: Bi;
  registerAdminLink: Bi;
  registerAsk: Bi;
  dayClosedTitle: Bi;
  dayClosedBody: Bi;
  loading: Bi;
  loadFailed: Bi;
  tryAgain: Bi;
  noStorage: string;
  catalogueReloaded: string;
  excelTitle: Bi;
  excelUnsupported: string;
  excelNotSet: string;
  excelNeedsPermission: string;
  excelReady: string;
  excelWritten: string;
  excelFailed: string;
  chooseFolder: Bi;
  allowSaving: Bi;
  saveExcelNow: Bi;
  downloadExcel: Bi;
  refused(n: number): string;
} = {
  steps: {
    devotee: { en: 'Devotee', kn: 'ಭಕ್ತರು' },
    sevas: { en: 'Sevas and dates', kn: 'ಸೇವೆಗಳು ಮತ್ತು ದಿನಾಂಕಗಳು' },
    pay: { en: 'Pay and print', kn: 'ಪಾವತಿ ಮತ್ತು ಮುದ್ರಣ' },
  },
  stepsLabel: 'Steps',
  stepOf: (n) => `Step ${n} of 3`,
  keysStep1: 'Enter: next - Alt+1, 2, 3: jump - Ctrl+Enter: save - Esc twice: clear',
  keysStep2: 'Enter on an empty search: next - 1 to 9 on the tiles: add - Esc twice: clear',
  keysStep3: 'Ctrl+Enter: save and print - Alt+2: back to sevas - Esc twice: clear',
  devoteeTitle: { en: 'Devotee', kn: 'ಭಕ್ತರ ವಿವರ' },
  onlyName: { en: 'Only the name is needed.', kn: 'ಹೆಸರು ಮಾತ್ರ ಕಡ್ಡಾಯ.' },
  name: { en: 'Name', kn: 'ಹೆಸರು' },
  phone: { en: 'Phone', kn: 'ದೂರವಾಣಿ' },
  phoneHint: { en: 'Optional. Finds a returning devotee. Never printed.', kn: 'ಐಚ್ಛಿಕ. ಹಿಂದಿನ ಭಕ್ತರನ್ನು ಹುಡುಕುತ್ತದೆ. ಮುದ್ರಿಸುವುದಿಲ್ಲ.' },
  privacy: {
    en: 'The phone number is kept only to find this devotee next time. It is never printed or shared.',
    kn: 'ದೂರವಾಣಿ ಸಂಖ್ಯೆಯನ್ನು ಮುಂದಿನ ಬಾರಿ ಭಕ್ತರನ್ನು ಹುಡುಕಲು ಮಾತ್ರ ಇಡಲಾಗುತ್ತದೆ. ಮುದ್ರಿಸುವುದಿಲ್ಲ, ಹಂಚುವುದಿಲ್ಲ.',
  },
  searchGotra: 'Search gotra',
  searchNakshatra: 'Search nakshatra',
  searchRashi: 'Search rashi',
  notKnown: { en: 'Not known', kn: 'ಗೊತ್ತಿಲ್ಲ' },
  returning: { en: 'Returning devotee?', kn: 'ಹಿಂದೆ ಬಂದ ಭಕ್ತರೇ?' },
  useDetails: { en: 'Use these details', kn: 'ಈ ವಿವರ ಬಳಸಿ' },
  notThisPerson: { en: 'Not this person', kn: 'ಇವರಲ್ಲ' },
  undo: { en: 'Undo', kn: 'ರದ್ದುಮಾಡಿ' },
  filledFrom: (date) => `Details from the visit on ${date}.`,
  phoneEnding: (last4) => `phone ending ${last4}`,
  lastVisit: (date) => `last visit ${date}`,
  next: { en: 'Next', kn: 'ಮುಂದಿನ' },
  nextSevas: { en: 'Next: sevas and dates', kn: 'ಮುಂದೆ: ಸೇವೆಗಳು ಮತ್ತು ದಿನಾಂಕಗಳು' },
  nextPay: { en: 'Next: pay', kn: 'ಮುಂದೆ: ಪಾವತಿ' },
  back: { en: 'Back', kn: 'ಹಿಂದೆ' },
  sevasTitle: { en: 'Sevas and dates', kn: 'ಸೇವೆಗಳು ಮತ್ತು ದಿನಾಂಕಗಳು' },
  sevasHint: {
    en: 'Each date gets its own receipt. Several sevas on one date share a receipt.',
    kn: 'ಪ್ರತಿ ದಿನಾಂಕಕ್ಕೆ ಪ್ರತ್ಯೇಕ ರಸೀದಿ. ಒಂದೇ ದಿನಾಂಕದ ಸೇವೆಗಳು ಒಂದೇ ರಸೀದಿಯಲ್ಲಿ.',
  },
  findSeva: { en: 'Find a seva - number, code or name', kn: 'ಸೇವೆ ಹುಡುಕಿ - ಸಂಖ್ಯೆ, ಸಂಕೇತ ಅಥವಾ ಹೆಸರು' },
  findSevaPlaceholder: 'Type 2 or PA, then Enter',
  onThisReceipt: { en: 'On this receipt', kn: 'ಈ ರಸೀದಿಯಲ್ಲಿ' },
  noLinesYet: { en: 'No sevas yet. Type a number or code and press Enter.', kn: 'ಇನ್ನೂ ಸೇವೆಗಳಿಲ್ಲ. ಸಂಖ್ಯೆ ಅಥವಾ ಸಂಕೇತ ಬರೆದು Enter ಒತ್ತಿ.' },
  allSevas: { en: 'All sevas', kn: 'ಎಲ್ಲಾ ಸೇವೆಗಳು' },
  tilesLabel: 'Sevas - press 1 to 9 to add',
  tilesHint: { en: 'Numbers follow the display order set in Seva settings.', kn: 'ಸಂಖ್ಯೆಗಳು ಸೇವಾ ಸೆಟ್ಟಿಂಗ್‌ಗಳ ಕ್ರಮದಂತೆ.' },
  anyAmount: { en: 'Any amount', kn: 'ಯಾವುದೇ ಮೊತ್ತ' },
  noMatch: { en: 'No seva matches this search.', kn: 'ಈ ಹುಡುಕಾಟಕ್ಕೆ ಯಾವುದೇ ಸೇವೆ ಸಿಗಲಿಲ್ಲ.' },
  quantity: { en: 'Quantity', kn: 'ಪ್ರಮಾಣ' },
  less: 'One less',
  more: 'One more',
  remove: { en: 'Remove', kn: 'ತೆಗೆಯಿರಿ' },
  changeAmount: { en: 'Change amount', kn: 'ಮೊತ್ತ ಬದಲಿಸಿ' },
  changed: { en: 'Changed', kn: 'ಬದಲಿಸಲಾಗಿದೆ' },
  amount: { en: 'Amount', kn: 'ಮೊತ್ತ' },
  dates: { en: 'Dates', kn: 'ದಿನಾಂಕಗಳು' },
  datesFor: (seva) => `Dates for ${seva}`,
  chooseDates: { en: 'Choose dates', kn: 'ದಿನಾಂಕ ಆಯ್ಕೆಮಾಡಿ' },
  done: { en: 'Done', kn: 'ಆಯಿತು' },
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  festivalDays: { en: 'Festival days', kn: 'ಹಬ್ಬದ ದಿನಗಳು' },
  multiDateHint: {
    en: 'Pick one or more days. Arrow keys move, Enter picks, Esc closes.',
    kn: 'ಒಂದು ಅಥವಾ ಹೆಚ್ಚು ದಿನಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ.',
  },
  singleDateHint: { en: 'Pick the day. Arrow keys move, Enter picks, Esc closes.', kn: 'ದಿನವನ್ನು ಆಯ್ಕೆಮಾಡಿ.' },
  amountDialogTitle: { en: 'Change amount', kn: 'ಮೊತ್ತ ಬದಲಿಸಿ' },
  newRate: { en: 'New price for one (Rs)', kn: 'ಒಂದಕ್ಕೆ ಹೊಸ ಬೆಲೆ (ರೂ)' },
  catalogueRate: (r) => `Price in Seva settings: ${r}`,
  reason: { en: 'Reason', kn: 'ಕಾರಣ' },
  reasonHint: { en: 'Needed. Shown to the temple admin.', kn: 'ಕಡ್ಡಾಯ. ದೇವಸ್ಥಾನದ ನಿರ್ವಾಹಕರಿಗೆ ತೋರಿಸಲಾಗುತ್ತದೆ.' },
  apply: { en: 'Change amount', kn: 'ಮೊತ್ತ ಬದಲಿಸಿ' },
  cancel: { en: 'Cancel', kn: 'ರದ್ದು' },
  amountInvalid: 'Type a price above zero, for example 250 or 250.50.',
  reasonTooShort: 'Write a reason of at least 3 letters.',
  payTitle: { en: 'Pay and print', kn: 'ಪಾವತಿ ಮತ್ತು ಮುದ್ರಣ' },
  payHint: { en: 'One payment for the whole order.', kn: 'ಸಂಪೂರ್ಣ ಆದೇಶಕ್ಕೆ ಒಂದೇ ಪಾವತಿ.' },
  toPay: { en: 'To pay', kn: 'ಪಾವತಿಸಬೇಕಾದದ್ದು' },
  paymentMode: 'Payment mode',
  cash: { en: 'Cash', kn: 'ನಗದು' },
  upi: { en: 'UPI', kn: 'ಯುಪಿಐ' },
  received: { en: 'Received', kn: 'ಪಡೆದದ್ದು' },
  receivedHint: { en: 'Optional. Shows the change to return.', kn: 'ಐಚ್ಛಿಕ. ಹಿಂದಿರುಗಿಸಬೇಕಾದ ಚಿಲ್ಲರೆ ತೋರಿಸುತ್ತದೆ.' },
  returnChange: { en: 'Return change', kn: 'ಹಿಂದಿರುಗಿಸಬೇಕಾದ ಚಿಲ್ಲರೆ' },
  short: { en: 'Short by', kn: 'ಕಡಿಮೆ' },
  largeCash: {
    en: 'Cash of Rs 2,00,000 or more in one order. Check the amount and confirm.',
    kn: 'ಒಂದೇ ಆದೇಶದಲ್ಲಿ ರೂ 2,00,000 ಅಥವಾ ಹೆಚ್ಚು ನಗದು. ಮೊತ್ತ ಪರಿಶೀಲಿಸಿ ದೃಢೀಕರಿಸಿ.',
  },
  confirmLargeCash: { en: 'Confirm the cash amount', kn: 'ನಗದು ಮೊತ್ತ ದೃಢೀಕರಿಸಿ' },
  largeCashConfirmed: { en: 'Cash amount confirmed.', kn: 'ನಗದು ಮೊತ್ತ ದೃಢೀಕರಿಸಲಾಗಿದೆ.' },
  upiNotSetUp: {
    en: "UPI is not set up for this counter. Ask a temple admin to add the temple's UPI id in Settings. Take cash for now.",
    kn: 'ಈ ಕೌಂಟರ್‌ಗೆ UPI ಹೊಂದಿಸಿಲ್ಲ. ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ UPI ಐಡಿ ಸೇರಿಸಲು ನಿರ್ವಾಹಕರನ್ನು ಕೇಳಿ. ಸದ್ಯಕ್ಕೆ ನಗದು ಪಡೆಯಿರಿ.',
  },
  upiScan: { en: 'The devotee scans this. The amount is inside the QR.', kn: 'ಭಕ್ತರು ಇದನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡುತ್ತಾರೆ. ಮೊತ್ತ QR ಒಳಗಿದೆ.' },
  upiRef: { en: 'UPI reference - last 6 digits', kn: 'UPI ಉಲ್ಲೇಖ - ಕೊನೆಯ 6 ಅಂಕೆಗಳು' },
  upiSeen: { en: "I saw the payment succeed on the devotee's phone", kn: 'ಭಕ್ತರ ಫೋನ್‌ನಲ್ಲಿ ಪಾವತಿ ಯಶಸ್ವಿಯಾದುದನ್ನು ನೋಡಿದ್ದೇನೆ' },
  upiQrLabel: 'UPI payment QR with the amount',
  summaryTitle: { en: 'This receipt', kn: 'ಈ ರಸೀದಿ' },
  summaryEmptyStep1: { en: 'Sevas and dates come next', kn: 'ಮುಂದೆ ಸೇವೆಗಳು ಮತ್ತು ದಿನಾಂಕಗಳು' },
  summaryEmpty: { en: 'Ready for the next devotee', kn: 'ಮುಂದಿನ ಭಕ್ತರಿಗೆ ಸಿದ್ಧ' },
  total: { en: 'Total', kn: 'ಒಟ್ಟು' },
  saving: { en: 'Saving and printing...', kn: 'ಉಳಿಸಿ ಮುದ್ರಿಸಲಾಗುತ್ತಿದೆ...' },
  statusLabel: 'Counter status',
  online: 'Online',
  offline: 'Offline',
  nextNumber: { en: 'Next', kn: 'ಮುಂದಿನ ಸಂಖ್ಯೆ' },
  today: { en: 'today', kn: 'ಇಂದು' },
  waiting: { en: 'waiting', kn: 'ಕಾಯುತ್ತಿವೆ' },
  workOffline: { en: 'Work offline', kn: 'ಆಫ್‌ಲೈನ್ ಕೆಲಸ' },
  closeDay: { en: 'Close day', kn: 'ದಿನ ಮುಕ್ತಾಯ' },
  printedSub: (name, total, mode, together, group) =>
    `${name} - ${total} ${mode === 'upi' ? 'by UPI' : 'in cash'}${together ? ', paid together' : ''} - group ${group}`,
  of: (position, count) => `${position} of ${count}`,
  sevaCount: (n) => (n === 1 ? '1 seva' : `${n} sevas`),
  todaysReceipts: { en: "Today's receipts", kn: 'ಇಂದಿನ ರಸೀದಿಗಳು' },
  printedOffline: {
    en: 'Saved on this PC with offline numbers. They send themselves when the line is back.',
    kn: 'ಆಫ್‌ಲೈನ್ ಸಂಖ್ಯೆಗಳೊಂದಿಗೆ ಈ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ.',
  },
  printFailed: "Saved, but the slips did not print. Reprint them from Today's receipts.",
  offlineSaved: 'Saved offline.',
  inDoubtTitle: { en: 'The office did not answer. Print as an offline receipt?', kn: 'ಕಚೇರಿ ಉತ್ತರಿಸಲಿಲ್ಲ. ಆಫ್‌ಲೈನ್ ರಸೀದಿಯಾಗಿ ಮುದ್ರಿಸಬೇಕೆ?' },
  inDoubtBody: {
    en: 'The receipt gets an offline number from this PC. If the office did save it, the office cancels its copy, so the money is counted once.',
    kn: 'ರಸೀದಿಗೆ ಈ ಕಂಪ್ಯೂಟರ್‌ನಿಂದ ಆಫ್‌ಲೈನ್ ಸಂಖ್ಯೆ ಸಿಗುತ್ತದೆ. ಹಣವನ್ನು ಒಮ್ಮೆ ಮಾತ್ರ ಎಣಿಸಲಾಗುತ್ತದೆ.',
  },
  inDoubtYes: { en: 'Yes, print offline', kn: 'ಹೌದು, ಆಫ್‌ಲೈನ್ ಮುದ್ರಿಸಿ' },
  inDoubtNo: { en: 'No, keep the order', kn: 'ಬೇಡ, ಆದೇಶ ಉಳಿಸಿಕೊಳ್ಳಿ' },
  cancelledNothingSaved:
    'Nothing was printed. The office may already have saved this order, so do not take the money again. Press Save again when ready: the office is asked about this same order first.',
  inDoubtFirstVersionKept:
    "The office had already saved this order before your change, so the slips show it as first saved. To change it, cancel it in Today's receipts and make it again.",
  inDoubtOrderOpen: {
    en: 'This order may already be saved at the office. Save it again (even after a change): the office is asked first, so it is never saved twice.',
    kn: 'ಈ ಆದೇಶ ಈಗಾಗಲೇ ಕಚೇರಿಯಲ್ಲಿ ಉಳಿದಿರಬಹುದು. ಮತ್ತೆ ಉಳಿಸಿ: ಮೊದಲು ಕಚೇರಿಯನ್ನು ಕೇಳಲಾಗುತ್ತದೆ.',
  },
  inDoubtOrderCleared: {
    en: "An order the office may have saved was cleared without a slip. Check Today's receipts: if it is there unprinted, reprint or cancel it.",
    kn: 'ಕಚೇರಿಯಲ್ಲಿ ಉಳಿದಿರಬಹುದಾದ ಒಂದು ಆದೇಶವನ್ನು ರಸೀದಿ ಇಲ್ಲದೆ ತೆರವುಗೊಳಿಸಲಾಗಿದೆ. ಇಂದಿನ ರಸೀದಿಗಳನ್ನು ನೋಡಿ.',
  },
  inDoubtOrderDismiss: 'Checked',
  registerTitle: { en: 'This PC is not a registered counter', kn: 'ಈ ಕಂಪ್ಯೂಟರ್ ನೋಂದಾಯಿತ ಕೌಂಟರ್ ಅಲ್ಲ' },
  registerAdmin: {
    en: 'Receipts can be made only on a registered counter PC. Register this PC in Receipt settings, then come back.',
    kn: 'ನೋಂದಾಯಿತ ಕೌಂಟರ್ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ ಮಾತ್ರ ರಸೀದಿ ಮಾಡಬಹುದು. ರಸೀದಿ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಈ ಕಂಪ್ಯೂಟರ್ ನೋಂದಾಯಿಸಿ.',
  },
  registerAdminLink: { en: 'Register this PC', kn: 'ಈ ಕಂಪ್ಯೂಟರ್ ನೋಂದಾಯಿಸಿ' },
  registerAsk: { en: 'Ask a temple admin to register this PC.', kn: 'ಈ ಕಂಪ್ಯೂಟರ್ ನೋಂದಾಯಿಸಲು ದೇವಸ್ಥಾನದ ನಿರ್ವಾಹಕರನ್ನು ಕೇಳಿ.' },
  dayClosedTitle: { en: 'Day closed', kn: 'ದಿನ ಮುಕ್ತಾಯವಾಗಿದೆ' },
  dayClosedBody: {
    en: 'Today is closed for this counter, so no new receipts can be saved. A temple admin can reopen the day with a reason.',
    kn: 'ಈ ಕೌಂಟರ್‌ಗೆ ಇಂದಿನ ದಿನ ಮುಕ್ತಾಯವಾಗಿದೆ. ಹೊಸ ರಸೀದಿ ಉಳಿಸಲಾಗುವುದಿಲ್ಲ. ನಿರ್ವಾಹಕರು ಕಾರಣದೊಂದಿಗೆ ಮತ್ತೆ ತೆರೆಯಬಹುದು.',
  },
  loading: { en: 'Opening the counter...', kn: 'ಕೌಂಟರ್ ತೆರೆಯುತ್ತಿದೆ...' },
  loadFailed: { en: 'The counter could not open.', kn: 'ಕೌಂಟರ್ ತೆರೆಯಲಾಗಲಿಲ್ಲ.' },
  tryAgain: { en: 'Try again', kn: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' },
  noStorage:
    'This browser cannot keep receipts on this PC (private window or blocked storage). Open the counter in a normal Edge or Chrome window.',
  catalogueReloaded: 'The seva list was reloaded from the office. Check the total, then save again.',
  excelTitle: { en: 'Excel copy on this PC', kn: 'ಈ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ ಎಕ್ಸೆಲ್ ಪ್ರತಿ' },
  excelUnsupported: 'This browser cannot save to a folder. Use Download Excel.',
  excelNotSet: 'No folder chosen yet.',
  excelNeedsPermission: 'The browser needs your permission again to save in the chosen folder.',
  excelReady: 'Saved by itself every 30 seconds while receipts are made.',
  excelWritten: 'Saved just now.',
  excelFailed: 'The Excel copy could not be saved (is the file open in Excel?). It tries again by itself.',
  chooseFolder: { en: 'Choose folder', kn: 'ಫೋಲ್ಡರ್ ಆಯ್ಕೆಮಾಡಿ' },
  allowSaving: { en: 'Allow saving', kn: 'ಉಳಿಸಲು ಅನುಮತಿಸಿ' },
  saveExcelNow: { en: 'Save Excel now', kn: 'ಈಗ ಎಕ್ಸೆಲ್ ಉಳಿಸಿ' },
  downloadExcel: { en: 'Download Excel', kn: 'ಎಕ್ಸೆಲ್ ಡೌನ್‌ಲೋಡ್' },
  refused: (n) =>
    `${n === 1 ? '1 offline receipt was' : `${n} offline receipts were`} refused by the office. It stays on this PC; ask a temple admin.`,
};
