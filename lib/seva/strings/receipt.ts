/**
 * Words for the receipt detail and print pages and the public `/r/<token>` page (DB §9.9, §10.3), English with
 * Kannada under it (C-49). Kannada is to be proof-read by the temple office (O-03).
 */
import type { CancelReasonCode, PaymentMode } from "@/types/seva";
import type { RefundState } from "@/types/seva-receipts";

import { COMMON, type Bi } from "./common";

export const RECEIPT = {
  title: { en: "Receipt", kn: "ರಸೀದಿ" },
  backToList: { en: "Back to receipts", kn: "ರಸೀದಿಗಳಿಗೆ ಹಿಂತಿರುಗಿ" },
  backToReceipt: { en: "Back to the receipt", kn: "ರಸೀದಿಗೆ ಹಿಂತಿರುಗಿ" },
  loading: { en: "Loading the receipt...", kn: "ರಸೀದಿ ತೆರೆಯುತ್ತಿದೆ..." },
  loadFailed: {
    en: "The receipt could not be loaded. Check the connection and try again.",
    kn: "ರಸೀದಿ ತೆರೆಯಲಾಗಲಿಲ್ಲ. ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  },
  notFound: { en: "This receipt was not found.", kn: "ಈ ರಸೀದಿ ಸಿಗಲಿಲ್ಲ." },
  notFoundHint: {
    en: "Check the QR code or the receipt number with the temple office.",
    kn: "QR ಕೋಡ್ ಅಥವಾ ರಸೀದಿ ಸಂಖ್ಯೆಯನ್ನು ದೇವಸ್ಥಾನದ ಕಚೇರಿಯಲ್ಲಿ ಪರಿಶೀಲಿಸಿ.",
  },
  tooMany: {
    en: "Too many requests. Wait a minute and try again.",
    kn: "ತುಂಬಾ ವಿನಂತಿಗಳು. ಒಂದು ನಿಮಿಷ ಕಾದು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  },
  valid: { en: "Valid", kn: "ಮಾನ್ಯ" },
  cancelled: COMMON.cancelled,
  changed: { en: "Changed", kn: "ಬದಲಾಗಿದೆ" },
  offline: { en: "Made offline", kn: "ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿ ಮಾಡಲಾಗಿದೆ" },
  slip: { en: "Slip", kn: "ಚೀಟಿ" },
  slipUnavailable: {
    en: "The slip preview could not be loaded. The details below are complete.",
    kn: "ಚೀಟಿಯ ಮುನ್ನೋಟ ತೆರೆಯಲಿಲ್ಲ. ಕೆಳಗಿನ ವಿವರಗಳು ಪೂರ್ಣವಾಗಿವೆ.",
  },
  payment: { en: "Payment", kn: "ಪಾವತಿ" },
  upiRef: { en: "UPI ref ending", kn: "UPI ಉಲ್ಲೇಖದ ಕೊನೆಯ ಅಂಕಿಗಳು" },
  paidTogether: { en: "Paid together for the group", kn: "ಗುಂಪಿಗೆ ಒಟ್ಟಿಗೆ ಪಾವತಿಸಲಾಗಿದೆ" },
  refund: { en: "Refund", kn: "ಹಣ ವಾಪಸ್" },
  prasadam: { en: "Prasadam", kn: "ಪ್ರಸಾದ" },
  prasadamGiven: { en: "Given", kn: "ನೀಡಲಾಗಿದೆ" },
  prasadamPending: { en: "Not given yet", kn: "ಇನ್ನೂ ನೀಡಿಲ್ಲ" },
  prasadamNone: { en: "No prasadam with this seva", kn: "ಈ ಸೇವೆಗೆ ಪ್ರಸಾದ ಇಲ್ಲ" },
  cancelHeading: { en: "Cancelled", kn: "ರದ್ದು ಮಾಡಲಾಗಿದೆ" },
  cancelBy: { en: "by", kn: "ಅವರಿಂದ" },
  history: { en: "History", kn: "ಇತಿಹಾಸ" },
  historyEmpty: { en: "Nothing has happened to this receipt yet.", kn: "ಈ ರಸೀದಿಗೆ ಇನ್ನೂ ಏನೂ ಆಗಿಲ್ಲ." },
  printedTimes: { en: "Printed", kn: "ಮುದ್ರಿಸಲಾಗಿದೆ" },
  print: { en: "Print", kn: "ಮುದ್ರಿಸಿ" },
  printDuplicate: { en: "Print a duplicate", kn: "ನಕಲು ಮುದ್ರಿಸಿ" },
  printing: { en: "Sending the slip to the printer...", kn: "ಚೀಟಿಯನ್ನು ಮುದ್ರಕಕ್ಕೆ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ..." },
  printed: { en: "The slip was sent to the printer.", kn: "ಚೀಟಿಯನ್ನು ಮುದ್ರಕಕ್ಕೆ ಕಳುಹಿಸಲಾಗಿದೆ." },
  printAgain: { en: "Print again", kn: "ಮತ್ತೆ ಮುದ್ರಿಸಿ" },
  tryAgain: { en: "Try again", kn: "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ" },
  printNeedsCounter: {
    en: "Printing needs a registered counter PC. Open this receipt on the counter PC.",
    kn: "ಮುದ್ರಿಸಲು ನೋಂದಾಯಿತ ಕೌಂಟರ್ ಕಂಪ್ಯೂಟರ್ ಬೇಕು. ಈ ರಸೀದಿಯನ್ನು ಕೌಂಟರ್ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ ತೆರೆಯಿರಿ.",
  },
  cancelledNoPrint: {
    en: "A cancelled receipt is not printed again.",
    kn: "ರದ್ದಾದ ರಸೀದಿಯನ್ನು ಮತ್ತೆ ಮುದ್ರಿಸುವುದಿಲ್ಲ.",
  },
  printFailed: { en: "The slip could not be printed.", kn: "ಚೀಟಿಯನ್ನು ಮುದ್ರಿಸಲಾಗಲಿಲ್ಲ." },
  openPrasadam: { en: "Open in the prasadam counter", kn: "ಪ್ರಸಾದ ಕೌಂಟರ್‌ನಲ್ಲಿ ತೆರೆಯಿರಿ" },
  sevas: { en: "Sevas", kn: "ಸೇವೆಗಳು" },
  issuedBy: { en: "Issued by", kn: "ನೀಡಿದವರು" },
} satisfies Record<string, Bi>;

export const PAYMENT_MODE_LABEL: Record<PaymentMode, Bi> = {
  cash: COMMON.cash,
  upi: { en: "UPI", kn: "ಯುಪಿಐ" },
  online: { en: "Online (UPI)", kn: "ಆನ್‌ಲೈನ್ (ಯುಪಿಐ)" },
};

export const REFUND_STATE_LABEL: Record<RefundState, Bi> = {
  none: { en: "No refund", kn: "ಹಣ ವಾಪಸ್ ಇಲ್ಲ" },
  due: { en: "Refund due - the office refunds", kn: "ಹಣ ವಾಪಸ್ ಬಾಕಿ - ಕಚೇರಿ ನೀಡುತ್ತದೆ" },
  processing: { en: "Refund in progress", kn: "ಹಣ ವಾಪಸ್ ಪ್ರಗತಿಯಲ್ಲಿದೆ" },
  done: { en: "Refunded", kn: "ಹಣ ವಾಪಸ್ ನೀಡಲಾಗಿದೆ" },
  failed: { en: "Refund failed - the office will check", kn: "ಹಣ ವಾಪಸ್ ವಿಫಲ - ಕಚೇರಿ ಪರಿಶೀಲಿಸುತ್ತದೆ" },
};

export const CANCEL_REASON_LABEL: Record<CancelReasonCode, Bi> = {
  wrong_seva: { en: "Wrong seva", kn: "ತಪ್ಪು ಸೇವೆ" },
  wrong_date: { en: "Wrong date", kn: "ತಪ್ಪು ದಿನಾಂಕ" },
  wrong_amount: { en: "Wrong amount", kn: "ತಪ್ಪು ಮೊತ್ತ" },
  wrong_devotee: { en: "Wrong devotee details", kn: "ತಪ್ಪು ಭಕ್ತರ ವಿವರ" },
  changed_mind: { en: "Devotee changed their mind", kn: "ಭಕ್ತರು ಮನಸ್ಸು ಬದಲಾಯಿಸಿದರು" },
  entered_twice: { en: "Entered twice", kn: "ಎರಡು ಬಾರಿ ನಮೂದಿಸಲಾಗಿದೆ" },
  spoiled_print: { en: "Spoiled print", kn: "ಹಾಳಾದ ಮುದ್ರಣ" },
  other: { en: "Other", kn: "ಇತರೆ" },
  not_printed_connection_lost: { en: "Not printed - connection lost", kn: "ಮುದ್ರಣವಾಗಲಿಲ್ಲ - ಸಂಪರ್ಕ ಕಡಿತ" },
  refunded: { en: "Refunded", kn: "ಹಣ ವಾಪಸ್ ನೀಡಲಾಗಿದೆ" },
};

/** History rows by their action (receipt detail, DB §12.3). An action not listed here shows as it is stored. */
export const HISTORY_ACTION_LABEL: Record<string, Bi> = {
  "receipt.issue": { en: "Issued", kn: "ನೀಡಲಾಗಿದೆ" },
  "receipt.print": { en: "First print", kn: "ಮೊದಲ ಮುದ್ರಣ" },
  "receipt.reprint": { en: "Reprinted (DUPLICATE)", kn: "ಮತ್ತೆ ಮುದ್ರಿಸಲಾಗಿದೆ (ನಕಲು)" },
  "receipt.cancel": { en: "Cancelled", kn: "ರದ್ದು ಮಾಡಲಾಗಿದೆ" },
  "receipt.amount_changed": { en: "Amount changed", kn: "ಮೊತ್ತ ಬದಲಾಯಿಸಲಾಗಿದೆ" },
  "receipt.reissue_spoiled": { en: "Spoiled - reissued with a new number", kn: "ಹಾಳಾಗಿದೆ - ಹೊಸ ಸಂಖ್ಯೆಯೊಂದಿಗೆ ಮರು ನೀಡಲಾಗಿದೆ" },
  "receipt.superseded": { en: "Replaced by a new number", kn: "ಹೊಸ ಸಂಖ್ಯೆಯಿಂದ ಬದಲಾಯಿಸಲಾಗಿದೆ" },
  "receipt.issuer_inactive_at_sync": {
    en: "Sent after the issuer left",
    kn: "ನೀಡಿದವರು ಬಿಟ್ಟ ನಂತರ ಕಳುಹಿಸಲಾಗಿದೆ",
  },
  "prasadam.given": { en: "Prasadam given", kn: "ಪ್ರಸಾದ ನೀಡಲಾಗಿದೆ" },
  "prasadam.given_off_date": { en: "Prasadam given on another day", kn: "ಬೇರೆ ದಿನ ಪ್ರಸಾದ ನೀಡಲಾಗಿದೆ" },
  "prasadam.undo": { en: "Prasadam give undone", kn: "ಪ್ರಸಾದ ನೀಡಿಕೆ ರದ್ದು" },
  "prasadam.reversed": { en: "Prasadam give reversed", kn: "ಪ್ರಸಾದ ನೀಡಿಕೆ ಹಿಂಪಡೆಯಲಾಗಿದೆ" },
};

export function historyActionLabel(action: string): Bi {
  return HISTORY_ACTION_LABEL[action] ?? { en: action, kn: "" };
}

export function prasadamLabel(state: "none" | "pending" | "given"): Bi {
  if (state === "given") return RECEIPT.prasadamGiven;
  if (state === "pending") return RECEIPT.prasadamPending;
  return RECEIPT.prasadamNone;
}
