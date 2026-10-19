/**
 * Words of the Close day page (DB §9.10), English with Kannada under it (C-49). Kannada is to be proof-read by the
 * temple office (O-03). Lines that carry a number are built by the small functions at the end.
 */
import type { Bi } from './common';

export const DAYCLOSE: {
  title: Bi;
  backToCounter: Bi;
  cash: Bi;
  manageDenominations: Bi;
  expectedInDrawer: Bi;
  denomination: Bi;
  count: Bi;
  amount: Bi;
  notes: Bi;
  coinsByValue: Bi;
  counted: Bi;
  difference: Bi;
  matches: Bi;
  noteLabel: Bi;
  notePlaceholder: Bi;
  noteNeeded: Bi;
  upi: Bi;
  upiExpected: Bi;
  upiBankTotal: Bi;
  upiBankHint: Bi;
  upiBankNeeded: Bi;
  upiNoteHint: Bi;
  sent: Bi;
  nothingWaiting: Bi;
  sendNow: Bi;
  sendFromCounter: Bi;
  checking: Bi;
  numbers: Bi;
  noReceipts: Bi;
  noGaps: Bi;
  closeButton: Bi;
  closing: Bi;
  reopening: Bi;
  sending: Bi;
  dayClosed: Bi;
  dayClosedHint: Bi;
  reopen: Bi;
  reopenReason: Bi;
  reopenReasonHint: Bi;
  reopenConfirm: Bi;
  cancel: Bi;
  reopened: Bi;
  reopenNotFound: Bi;
  whyNote: Bi;
  whyUpi: Bi;
  whyWaiting: Bi;
  whyOffline: Bi;
  whyCounts: Bi;
  noCounter: Bi;
  excelWritten: Bi;
  excelDownloaded: Bi;
  excelFailed: Bi;
  excelNone: Bi;
  excelNeedsPermission: Bi;
  excelNotToday: Bi;
  printFailed: Bi;
  summaryTitle: Bi;
  summaryClosedBy: Bi;
  summaryReceipts: Bi;
  summaryCancelled: Bi;
  summaryChanged: Bi;
  summaryNote: Bi;
  summarySignature: Bi;
  summaryUpiReceipts: Bi;
  loadFailed: Bi;
  tryAgain: Bi;
  loading: Bi;
} = {
  title: { en: 'Close day', kn: 'ದಿನ ಮುಕ್ತಾಯ' },
  backToCounter: { en: 'Back to counter', kn: 'ಕೌಂಟರ್‌ಗೆ ಹಿಂತಿರುಗಿ' },
  cash: { en: 'Cash', kn: 'ನಗದು' },
  manageDenominations: { en: 'Manage denominations', kn: 'ನೋಟು ಮತ್ತು ನಾಣ್ಯಗಳನ್ನು ನಿರ್ವಹಿಸಿ' },
  expectedInDrawer: { en: 'Expected in the drawer', kn: 'ಡ್ರಾಯರ್‌ನಲ್ಲಿ ಇರಬೇಕಾದದ್ದು' },
  denomination: { en: 'Denomination', kn: 'ಮುಖಬೆಲೆ' },
  count: { en: 'Count', kn: 'ಎಣಿಕೆ' },
  amount: { en: 'Amount', kn: 'ಮೊತ್ತ' },
  notes: { en: 'Notes', kn: 'ನೋಟುಗಳು' },
  coinsByValue: { en: 'Coins, by value', kn: 'ನಾಣ್ಯಗಳು, ಮುಖಬೆಲೆಯಂತೆ' },
  counted: { en: 'Counted', kn: 'ಎಣಿಸಿದ್ದು' },
  difference: { en: 'Difference', kn: 'ವ್ಯತ್ಯಾಸ' },
  matches: { en: 'Matches', kn: 'ಸರಿಹೊಂದುತ್ತದೆ' },
  noteLabel: { en: 'Note about the difference', kn: 'ವ್ಯತ್ಯಾಸದ ಬಗ್ಗೆ ಟಿಪ್ಪಣಿ' },
  notePlaceholder: {
    en: 'Needed when the difference is not zero. A short line is enough.',
    kn: 'ವ್ಯತ್ಯಾಸ ಇದ್ದಾಗ ಬೇಕು. ಒಂದು ಸಣ್ಣ ಸಾಲು ಸಾಕು.',
  },
  noteNeeded: {
    en: 'Write a note about the difference before closing.',
    kn: 'ಮುಕ್ತಾಯಗೊಳಿಸುವ ಮೊದಲು ವ್ಯತ್ಯಾಸದ ಬಗ್ಗೆ ಟಿಪ್ಪಣಿ ಬರೆಯಿರಿ.',
  },
  upi: { en: 'UPI', kn: 'ಯುಪಿಐ' },
  upiExpected: { en: 'Expected', kn: 'ಇರಬೇಕಾದದ್ದು' },
  upiBankTotal: { en: 'Total today in the bank app', kn: 'ಬ್ಯಾಂಕ್ ಆ್ಯಪ್‌ನಲ್ಲಿ ಇಂದಿನ ಒಟ್ಟು' },
  upiBankHint: {
    en: "Read today's total in the temple's bank or merchant app",
    kn: 'ದೇವಸ್ಥಾನದ ಬ್ಯಾಂಕ್ ಅಥವಾ ಮರ್ಚೆಂಟ್ ಆ್ಯಪ್‌ನಲ್ಲಿ ಇಂದಿನ ಒಟ್ಟು ನೋಡಿ',
  },
  upiBankNeeded: { en: "Type today's UPI total from the bank app.", kn: 'ಬ್ಯಾಂಕ್ ಆ್ಯಪ್‌ನಿಂದ ಇಂದಿನ ಯುಪಿಐ ಒಟ್ಟು ಬರೆಯಿರಿ.' },
  upiNoteHint: {
    en: 'Explain the UPI difference in the note under Cash.',
    kn: 'ಯುಪಿಐ ವ್ಯತ್ಯಾಸವನ್ನು ನಗದು ಕೆಳಗಿನ ಟಿಪ್ಪಣಿಯಲ್ಲಿ ವಿವರಿಸಿ.',
  },
  sent: { en: 'Sent to the office', kn: 'ಕಚೇರಿಗೆ ಕಳುಹಿಸಲಾಗಿದೆ' },
  nothingWaiting: { en: 'Nothing is waiting to send', kn: 'ಕಳುಹಿಸಲು ಏನೂ ಬಾಕಿ ಇಲ್ಲ' },
  sendNow: { en: 'Send now', kn: 'ಈಗ ಕಳುಹಿಸಿ' },
  sendFromCounter: {
    en: 'Open the counter page on that PC so they send themselves.',
    kn: 'ಅವು ತಾನಾಗಿ ಕಳುಹಿಸಲು ಆ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ ಕೌಂಟರ್ ಪುಟ ತೆರೆಯಿರಿ.',
  },
  checking: { en: 'Checking with the office...', kn: 'ಕಚೇರಿಯೊಂದಿಗೆ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...' },
  numbers: { en: 'Receipt numbers today', kn: 'ಇಂದಿನ ರಸೀದಿ ಸಂಖ್ಯೆಗಳು' },
  noReceipts: { en: 'No receipts in this series today.', kn: 'ಇಂದು ಈ ಸರಣಿಯಲ್ಲಿ ರಸೀದಿಗಳಿಲ್ಲ.' },
  noGaps: { en: 'No gaps', kn: 'ಯಾವುದೇ ಅಂತರವಿಲ್ಲ' },
  closeButton: { en: 'Close day and print summary', kn: 'ದಿನ ಮುಕ್ತಾಯಗೊಳಿಸಿ ಮತ್ತು ಸಾರಾಂಶ ಮುದ್ರಿಸಿ' },
  closing: { en: 'Closing the day...', kn: 'ದಿನ ಮುಕ್ತಾಯಗೊಳಿಸಲಾಗುತ್ತಿದೆ...' },
  reopening: { en: 'Reopening...', kn: 'ಮತ್ತೆ ತೆರೆಯಲಾಗುತ್ತಿದೆ...' },
  sending: { en: 'Sending...', kn: 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ...' },
  dayClosed: { en: 'Day closed', kn: 'ದಿನ ಮುಕ್ತಾಯವಾಗಿದೆ' },
  dayClosedHint: {
    en: 'No more receipts can be made on this counter today. A temple admin can reopen the day with a reason.',
    kn: 'ಇಂದು ಈ ಕೌಂಟರ್‌ನಲ್ಲಿ ಇನ್ನು ರಸೀದಿ ಮಾಡಲಾಗದು. ದೇವಸ್ಥಾನದ ಆಡಳಿತಗಾರರು ಕಾರಣ ನೀಡಿ ದಿನವನ್ನು ಮತ್ತೆ ತೆರೆಯಬಹುದು.',
  },
  reopen: { en: 'Reopen', kn: 'ಮತ್ತೆ ತೆರೆಯಿರಿ' },
  reopenReason: { en: 'Reason for reopening', kn: 'ಮತ್ತೆ ತೆರೆಯಲು ಕಾರಣ' },
  reopenReasonHint: { en: 'At least 3 characters.', kn: 'ಕನಿಷ್ಠ 3 ಅಕ್ಷರಗಳು.' },
  reopenConfirm: { en: 'Reopen the day', kn: 'ದಿನವನ್ನು ಮತ್ತೆ ತೆರೆಯಿರಿ' },
  cancel: { en: 'Cancel', kn: 'ರದ್ದುಮಾಡಿ' },
  reopened: { en: 'The day is open again.', kn: 'ದಿನವನ್ನು ಮತ್ತೆ ತೆರೆಯಲಾಗಿದೆ.' },
  reopenNotFound: {
    en: 'Could not find this day close. Open it from Reports - Day closes.',
    kn: 'ಈ ದಿನ ಮುಕ್ತಾಯ ಸಿಗಲಿಲ್ಲ. ವರದಿಗಳು - ದಿನ ಮುಕ್ತಾಯಗಳಿಂದ ತೆರೆಯಿರಿ.',
  },
  whyNote: { en: 'Add a note about the difference first.', kn: 'ಮೊದಲು ವ್ಯತ್ಯಾಸದ ಬಗ್ಗೆ ಟಿಪ್ಪಣಿ ಸೇರಿಸಿ.' },
  whyUpi: { en: "Type today's UPI total from the bank app first.", kn: 'ಮೊದಲು ಬ್ಯಾಂಕ್ ಆ್ಯಪ್‌ನಿಂದ ಇಂದಿನ ಯುಪಿಐ ಒಟ್ಟು ಬರೆಯಿರಿ.' },
  whyWaiting: {
    en: 'Wait until nothing is waiting to send.',
    kn: 'ಕಳುಹಿಸಲು ಏನೂ ಬಾಕಿ ಇಲ್ಲದವರೆಗೆ ಕಾಯಿರಿ.',
  },
  whyOffline: {
    en: 'Closing the day needs the office connection. Check the line and try again.',
    kn: 'ದಿನ ಮುಕ್ತಾಯಕ್ಕೆ ಕಚೇರಿ ಸಂಪರ್ಕ ಬೇಕು. ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  },
  whyCounts: { en: 'Check the counts: whole numbers only.', kn: 'ಎಣಿಕೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ: ಪೂರ್ಣ ಸಂಖ್ಯೆಗಳು ಮಾತ್ರ.' },
  noCounter: {
    en: 'Open Close day on the counter PC, or from Reports - Day closes for another counter.',
    kn: 'ಕೌಂಟರ್ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ ದಿನ ಮುಕ್ತಾಯ ತೆರೆಯಿರಿ, ಅಥವಾ ಬೇರೆ ಕೌಂಟರ್‌ಗಾಗಿ ವರದಿಗಳು - ದಿನ ಮುಕ್ತಾಯಗಳಿಂದ ತೆರೆಯಿರಿ.',
  },
  excelWritten: { en: 'Excel copy saved in the chosen folder.', kn: 'ಎಕ್ಸೆಲ್ ಪ್ರತಿಯನ್ನು ಆಯ್ಕೆಮಾಡಿದ ಫೋಲ್ಡರ್‌ನಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ.' },
  excelDownloaded: {
    en: 'No Excel folder is set on this PC, so the Excel copy was downloaded.',
    kn: 'ಈ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ ಎಕ್ಸೆಲ್ ಫೋಲ್ಡರ್ ಇಲ್ಲ, ಆದ್ದರಿಂದ ಎಕ್ಸೆಲ್ ಪ್ರತಿಯನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಲಾಗಿದೆ.',
  },
  excelFailed: {
    en: 'The day is closed, but the Excel copy could not be saved. Use Download Excel on the counter page.',
    kn: 'ದಿನ ಮುಕ್ತಾಯವಾಗಿದೆ, ಆದರೆ ಎಕ್ಸೆಲ್ ಪ್ರತಿ ಉಳಿಸಲಾಗಲಿಲ್ಲ. ಕೌಂಟರ್ ಪುಟದಲ್ಲಿ ಎಕ್ಸೆಲ್ ಡೌನ್‌ಲೋಡ್ ಬಳಸಿ.',
  },
  excelNone: {
    en: 'This PC keeps no receipts of this counter, so no Excel copy was made here.',
    kn: 'ಈ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ ಈ ಕೌಂಟರ್‌ನ ರಸೀದಿಗಳಿಲ್ಲ, ಆದ್ದರಿಂದ ಇಲ್ಲಿ ಎಕ್ಸೆಲ್ ಪ್ರತಿ ಮಾಡಲಿಲ್ಲ.',
  },
  excelNeedsPermission: {
    en: "The Excel folder needs permission again, so the copy was downloaded. Use 'Allow saving' on the counter page.",
    kn: "ಎಕ್ಸೆಲ್ ಫೋಲ್ಡರ್‌ಗೆ ಮತ್ತೆ ಅನುಮತಿ ಬೇಕು, ಆದ್ದರಿಂದ ಪ್ರತಿಯನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಲಾಗಿದೆ. ಕೌಂಟರ್ ಪುಟದಲ್ಲಿ 'ಉಳಿಸಲು ಅನುಮತಿಸಿ' ಬಳಸಿ.",
  },
  excelNotToday: {
    en: 'The Excel copy is made only when closing today on the counter PC, so the earlier copy was kept.',
    kn: 'ಕೌಂಟರ್ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ ಇಂದಿನ ದಿನ ಮುಕ್ತಾಯಗೊಳಿಸುವಾಗ ಮಾತ್ರ ಎಕ್ಸೆಲ್ ಪ್ರತಿ ಮಾಡಲಾಗುತ್ತದೆ, ಆದ್ದರಿಂದ ಹಿಂದಿನ ಪ್ರತಿಯನ್ನು ಉಳಿಸಲಾಗಿದೆ.',
  },
  printFailed: {
    en: 'The day is closed, but the summary could not be printed.',
    kn: 'ದಿನ ಮುಕ್ತಾಯವಾಗಿದೆ, ಆದರೆ ಸಾರಾಂಶ ಮುದ್ರಿಸಲಾಗಲಿಲ್ಲ.',
  },
  summaryTitle: { en: 'Day close summary', kn: 'ದಿನ ಮುಕ್ತಾಯ ಸಾರಾಂಶ' },
  summaryClosedBy: { en: 'Closed by', kn: 'ಮುಕ್ತಾಯಗೊಳಿಸಿದವರು' },
  summaryReceipts: { en: 'Receipts issued', kn: 'ನೀಡಿದ ರಸೀದಿಗಳು' },
  summaryCancelled: { en: 'Receipts cancelled', kn: 'ರದ್ದಾದ ರಸೀದಿಗಳು' },
  summaryChanged: { en: 'Amounts changed', kn: 'ಮೊತ್ತ ಬದಲಾದವು' },
  summaryNote: { en: 'Note', kn: 'ಟಿಪ್ಪಣಿ' },
  summarySignature: { en: 'Signature', kn: 'ಸಹಿ' },
  summaryUpiReceipts: { en: 'UPI receipts', kn: 'ಯುಪಿಐ ರಸೀದಿಗಳು' },
  loadFailed: { en: 'Could not load the day. Try again.', kn: 'ದಿನದ ವಿವರ ತೆರೆಯಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' },
  tryAgain: { en: 'Try again', kn: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' },
  loading: { en: 'Loading...', kn: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...' },
};

/** 'Short Rs 80' / 'Extra Rs 20' with the rupee text already formatted. */
export function shortBy(rupees: string): Bi {
  return { en: `Short ${rupees}`, kn: `${rupees} ಕಡಿಮೆ` };
}

export function extraBy(rupees: string): Bi {
  return { en: `Extra ${rupees}`, kn: `${rupees} ಹೆಚ್ಚು` };
}

export function countOfLabel(kind: 'note' | 'coin', rupees: string): string {
  return `Count of ${rupees} ${kind === 'coin' ? 'coins' : 'notes'}`;
}

export function upiReceiptsLine(n: number): Bi {
  return { en: `${n} UPI ${n === 1 ? 'receipt' : 'receipts'}`, kn: `${n} ಯುಪಿಐ ರಸೀದಿಗಳು` };
}

export function waitingLine(n: number): Bi {
  return {
    en: `${n} ${n === 1 ? 'receipt is' : 'receipts are'} waiting to send`,
    kn: `${n} ರಸೀದಿಗಳು ಕಳುಹಿಸಲು ಬಾಕಿ ಇವೆ`,
  };
}

export function seriesLine(p: { issued: number; cancelled: number }): Bi {
  return {
    en: `${p.issued} issued, ${p.cancelled} cancelled`,
    kn: `${p.issued} ನೀಡಲಾಗಿದೆ, ${p.cancelled} ರದ್ದು`,
  };
}

export function gapsLine(n: number): Bi {
  return { en: `${n} open ${n === 1 ? 'gap' : 'gaps'} in this series`, kn: `ಈ ಸರಣಿಯಲ್ಲಿ ${n} ಬಗೆಹರಿಯದ ಅಂತರ` };
}

export function dayLine(p: { counter: string; date: string; receipts: number }): Bi {
  return {
    en: `${p.counter} - ${p.date} - ${p.receipts} ${p.receipts === 1 ? 'receipt' : 'receipts'}`,
    kn: `${p.counter} - ${p.date} - ${p.receipts} ರಸೀದಿಗಳು`,
  };
}

export function closedAtLine(time: string): Bi {
  return { en: `Day closed at ${time}.`, kn: `ದಿನ ${time} ಕ್ಕೆ ಮುಕ್ತಾಯವಾಯಿತು.` };
}
