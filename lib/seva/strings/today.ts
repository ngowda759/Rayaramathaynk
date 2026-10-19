/**
 * Words of the counter's Today's receipts page, its cancel dialog and the spoiled-print reissue (Design Book 9.8,
 * 9.9). English first, Kannada on its own line under it (C-49). The Kannada is to be proof-read by the temple office
 * (O-03); the eight cancel reasons are a sample to confirm (C-60, O-22).
 */
import type { CancelReasonCode } from '@/types/seva';
import { COMMON, type Bi } from './common';

/** The reasons a person may choose; 'not_printed_connection_lost' and 'refunded' are set by the system only. */
export type ChosenCancelReason = Extract<
  CancelReasonCode,
  'wrong_seva' | 'wrong_date' | 'wrong_amount' | 'wrong_devotee' | 'changed_mind' | 'entered_twice' | 'spoiled_print' | 'other'
>;

export const CANCEL_REASONS: readonly { code: ChosenCancelReason; label: Bi }[] = [
  { code: 'wrong_seva', label: { en: 'Wrong seva entered', kn: 'ತಪ್ಪು ಸೇವೆ ನಮೂದಾಗಿದೆ' } },
  { code: 'wrong_date', label: { en: 'Wrong date', kn: 'ತಪ್ಪು ದಿನಾಂಕ' } },
  { code: 'wrong_amount', label: { en: 'Wrong amount', kn: 'ತಪ್ಪು ಮೊತ್ತ' } },
  { code: 'wrong_devotee', label: { en: 'Wrong devotee details', kn: 'ಭಕ್ತರ ವಿವರ ತಪ್ಪಾಗಿದೆ' } },
  { code: 'changed_mind', label: { en: 'Devotee changed their mind', kn: 'ಭಕ್ತರು ಮನಸ್ಸು ಬದಲಿಸಿದರು' } },
  { code: 'entered_twice', label: { en: 'Entered twice', kn: 'ಎರಡು ಬಾರಿ ನಮೂದಾಗಿದೆ' } },
  { code: 'spoiled_print', label: { en: 'Spoiled print (paper jam or misprint)', kn: 'ಮುದ್ರಣ ಹಾಳಾಗಿದೆ (ಕಾಗದ ಸಿಕ್ಕಿಕೊಂಡಿದೆ)' } },
  { code: 'other', label: { en: 'Other', kn: 'ಇತರೆ' } },
];

/** A note for "Other" needs at least this many characters (the same rule as the server's cancel schema). */
export const OTHER_NOTE_MIN = 3;

export const TODAY = {
  title: { en: "Today's receipts", kn: 'ಇಂದಿನ ರಸೀದಿಗಳು' },
  backToCounter: { en: 'Back to the counter', kn: 'ಕೌಂಟರ್‌ಗೆ ಹಿಂತಿರುಗಿ' },
  searchLabel: { en: 'Search by number, name or seva', kn: 'ಸಂಖ್ಯೆ, ಹೆಸರು ಅಥವಾ ಸೇವೆಯಿಂದ ಹುಡುಕಿ' },
  searchPlaceholder: 'e.g. 000123 or Lakshmi',
  loading: { en: "Loading today's receipts...", kn: 'ಇಂದಿನ ರಸೀದಿಗಳನ್ನು ತರಲಾಗುತ್ತಿದೆ...' },
  empty: { en: 'No receipts yet today.', kn: 'ಇಂದು ಇನ್ನೂ ರಸೀದಿಗಳಿಲ್ಲ.' },
  noMatch: { en: 'No receipt matches this search.', kn: 'ಈ ಹುಡುಕಾಟಕ್ಕೆ ಯಾವ ರಸೀದಿಯೂ ಹೊಂದುವುದಿಲ್ಲ.' },
  tryAgain: 'Try again',
  showMore: 'Show more',
  offline: {
    en: 'Working offline: showing the receipts kept on this PC. A cancel waits here and goes to the office when the connection is back.',
    kn: 'ಆಫ್‌ಲೈನ್: ಈ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿರುವ ರಸೀದಿಗಳು. ರದ್ದತಿ ಸಂಪರ್ಕ ಬಂದಾಗ ಕಚೇರಿಗೆ ಹೋಗುತ್ತದೆ.',
  },
  footer: {
    en: 'Reprints always say DUPLICATE. Cancelled receipts stay in the register; their numbers are never reused.',
    kn: 'ಮರುಮುದ್ರಣದಲ್ಲಿ ಯಾವಾಗಲೂ ನಕಲು ಎಂದಿರುತ್ತದೆ. ರದ್ದಾದ ರಸೀದಿಗಳ ಸಂಖ್ಯೆ ಮತ್ತೆ ಬಳಕೆಯಾಗುವುದಿಲ್ಲ.',
  },
  cancelled: COMMON.cancelled,
  waitingBadge: { en: 'Waiting to send', kn: 'ಕಳುಹಿಸಲು ಬಾಕಿ' },
  cancelWaiting: { en: 'Cancel waiting to send to the office', kn: 'ರದ್ದತಿ ಕಚೇರಿಗೆ ಕಳುಹಿಸಲು ಬಾಕಿ ಇದೆ' },
  paidTogether: { en: 'paid together', kn: 'ಒಟ್ಟಿಗೆ ಪಾವತಿ' },
  group: (groupNo: string): string => `Group ${groupNo}`,
  issuedBySomeoneElse: {
    en: 'Issued by someone else: a temple admin can cancel',
    kn: 'ಬೇರೆಯವರು ನೀಡಿದ ರಸೀದಿ: ದೇವಸ್ಥಾನದ ಆಡಳಿತಾಧಿಕಾರಿ ರದ್ದುಮಾಡಬಹುದು',
  },
  /** Buttons are English only, like the rest of the module's buttons. */
  reprint: 'Reprint',
  cancel: 'Cancel',
  spoiled: 'Spoiled - cancel and reissue',
  waitingCount: (n: number): Bi => ({
    en: `${n} waiting to send to the office`,
    kn: `${n} ಕಚೇರಿಗೆ ಕಳುಹಿಸಲು ಬಾಕಿ`,
  }),
  cancelUntil: (time: string): Bi => ({ en: `Cancel until ${time}`, kn: `${time} ರವರೆಗೆ ರದ್ದುಮಾಡಬಹುದು` }),
  pastWindow: (minutes: number): Bi => ({
    en: `Past ${minutes} minutes: a temple admin can cancel`,
    kn: `${minutes} ನಿಮಿಷ ಕಳೆದಿದೆ: ದೇವಸ್ಥಾನದ ಆಡಳಿತಾಧಿಕಾರಿ ರದ್ದುಮಾಡಬಹುದು`,
  }),
} as const;

export const MONEY = {
  giveBack: (amount: string, slips: number): Bi => ({
    en: `Give back ${amount} in cash. Take back the printed ${slips > 1 ? 'slips' : 'slip'} if you can.`,
    kn: `${amount} ನಗದು ಹಿಂತಿರುಗಿಸಿ. ಸಾಧ್ಯವಾದರೆ ಮುದ್ರಿತ ರಸೀದಿ ಹಿಂಪಡೆಯಿರಿ.`,
  }),
  giveBackOffline: (amount: string): Bi => ({
    en: `Give back ${amount} in cash. The office checks this cancel when this PC is back online.`,
    kn: `${amount} ನಗದು ಹಿಂತಿರುಗಿಸಿ. ಸಂಪರ್ಕ ಬಂದಾಗ ಕಚೇರಿ ಈ ರದ್ದತಿಯನ್ನು ಪರಿಶೀಲಿಸುತ್ತದೆ.`,
  }),
  refundDueUpi: {
    en: 'Refund due - the office refunds from the bank app',
    kn: 'ಮರುಪಾವತಿ ಬಾಕಿ - ಕಚೇರಿ ಬ್ಯಾಂಕ್ ಆ್ಯಪ್‌ನಿಂದ ಹಿಂತಿರುಗಿಸುತ್ತದೆ',
  },
  refundDueCash: {
    en: "Refund due - the office refunds this cash; nothing from today's drawer",
    kn: 'ಮರುಪಾವತಿ ಬಾಕಿ - ಕಚೇರಿ ಹಿಂತಿರುಗಿಸುತ್ತದೆ; ಇಂದಿನ ಡ್ರಾಯರ್‌ನಿಂದ ಬೇಡ',
  },
  cashGivenBack: { en: 'Cash given back from the drawer', kn: 'ಡ್ರಾಯರ್‌ನಿಂದ ನಗದು ಹಿಂತಿರುಗಿಸಲಾಗಿದೆ' },
  refundProcessing: { en: 'Refund in progress at the office', kn: 'ಕಚೇರಿಯಲ್ಲಿ ಮರುಪಾವತಿ ನಡೆಯುತ್ತಿದೆ' },
  refundFailed: { en: 'Refund failed - the office will check it', kn: 'ಮರುಪಾವತಿ ವಿಫಲ - ಕಚೇರಿ ಪರಿಶೀಲಿಸುತ್ತದೆ' },
} as const;

export const CANCEL_DIALOG = {
  titleGroup: (groupNo: string): string => `Cancel group ${groupNo}?`,
  titleOne: (shortNo: string): string => `Cancel receipt ${shortNo}?`,
  subtitle: (name: string, amount: string, mode: string, time: string): string => `${name} - ${amount} ${mode} - printed ${time}`,
  scope: { en: 'What to cancel', kn: 'ಯಾವುದನ್ನು ರದ್ದುಮಾಡಬೇಕು' },
  all: (n: number, amount: string): string => `All ${n} receipts - ${amount}`,
  only: (shortNo: string, date: string | null, amount: string): string =>
    `Only ${shortNo}${date ? `, ${date}` : ''} - ${amount}`,
  reason: { en: 'Reason (needed)', kn: 'ಕಾರಣ (ಅಗತ್ಯ)' },
  chooseReason: 'Choose a reason',
  note: { en: 'Say what happened', kn: 'ಏನಾಯಿತು ಎಂದು ಬರೆಯಿರಿ' },
  noteHint: `At least ${OTHER_NOTE_MIN} characters`,
  keep: 'Keep',
  goMany: 'Cancel receipts',
  goOne: 'Cancel receipt',
  inCash: 'in cash',
  byUpi: 'by UPI',
  online: 'paid online',
} as const;

export const CANCEL_DONE = {
  online: (what: string): Bi => ({
    en: `${what} cancelled. It stays in the register marked CANCELLED, with your reason; the number is never reused.`,
    kn: 'ರದ್ದಾಗಿದೆ. ನಿಮ್ಮ ಕಾರಣದೊಂದಿಗೆ ದಾಖಲೆಯಲ್ಲಿ ಉಳಿಯುತ್ತದೆ; ಸಂಖ್ಯೆ ಮತ್ತೆ ಬಳಕೆಯಾಗುವುದಿಲ್ಲ.',
  }),
  offline: (what: string): Bi => ({
    en: `${what} cancelled on this PC. The cancel goes to the office when the connection is back.`,
    kn: 'ಈ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ ರದ್ದಾಗಿದೆ. ಸಂಪರ್ಕ ಬಂದಾಗ ಕಚೇರಿಗೆ ಹೋಗುತ್ತದೆ.',
  }),
  receipts: (n: number): string => (n === 1 ? 'Receipt' : `${n} receipts`),
} as const;

export const SPOILED = {
  title: (shortNo: string): string => `Spoiled print: cancel ${shortNo} and print a new number?`,
  body: {
    en: 'For a paper jam or misprint. The spoiled number stays in the register as cancelled (Spoiled print) and the same payment gets the next number. No money changes hands.',
    kn: 'ಕಾಗದ ಸಿಕ್ಕಿಕೊಂಡಾಗ ಅಥವಾ ತಪ್ಪು ಮುದ್ರಣವಾದಾಗ. ಹಾಳಾದ ಸಂಖ್ಯೆ ರದ್ದಾಗಿ ಉಳಿಯುತ್ತದೆ; ಅದೇ ಪಾವತಿಗೆ ಮುಂದಿನ ಸಂಖ್ಯೆ ಸಿಗುತ್ತದೆ. ಹಣದ ವ್ಯವಹಾರವಿಲ್ಲ.',
  },
  keep: 'Keep',
  go: 'Cancel and reissue',
  done: (newNo: string, oldShort: string): Bi => ({
    en: `New receipt ${newNo} printed. ${oldShort} is cancelled as a spoiled print.`,
    kn: `ಹೊಸ ರಸೀದಿ ${newNo} ಮುದ್ರಣವಾಗಿದೆ. ${oldShort} ಹಾಳಾದ ಮುದ್ರಣವಾಗಿ ರದ್ದಾಗಿದೆ.`,
  }),
  onlyToday: {
    en: "Only today's receipts get a new number. Use Reprint for a DUPLICATE slip.",
    kn: 'ಇಂದಿನ ರಸೀದಿಗಳಿಗೆ ಮಾತ್ರ ಹೊಸ ಸಂಖ್ಯೆ. ನಕಲು ಪ್ರತಿಗೆ ಮರುಮುದ್ರಣ ಬಳಸಿ.',
  },
} as const;

export const REPRINT = {
  done: (shortNo: string): Bi => ({
    en: `Reprinted ${shortNo} as a DUPLICATE.`,
    kn: `${shortNo} ನಕಲು ಪ್ರತಿಯಾಗಿ ಮರುಮುದ್ರಣವಾಗಿದೆ.`,
  }),
  printed: (shortNo: string): Bi => ({ en: `Printed ${shortNo}.`, kn: `${shortNo} ಮುದ್ರಣವಾಗಿದೆ.` }),
  noSlipSettings: {
    en: 'The receipt layout could not be loaded. Check the connection and try again.',
    kn: 'ರಸೀದಿ ವಿನ್ಯಾಸ ತರಲಾಗಲಿಲ್ಲ. ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  },
} as const;

export const TODAY_ERRORS = {
  unreachable: {
    en: 'The office did not answer. Check the connection and try again.',
    kn: 'ಕಚೇರಿ ಉತ್ತರಿಸಲಿಲ್ಲ. ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  },
  offlineNotAllowed: {
    en: 'Offline, only your own receipts inside the cancel window can be cancelled. Try again when the connection is back.',
    kn: 'ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿ ನಿಮ್ಮದೇ ರಸೀದಿಗಳನ್ನು ಸಮಯದೊಳಗೆ ಮಾತ್ರ ರದ್ದುಮಾಡಬಹುದು.',
  },
  generic: { en: 'Something went wrong. Try again.', kn: 'ಏನೋ ತಪ್ಪಾಗಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' },
} as const;
