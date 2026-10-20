/**
 * Words of the receipts register, the number continuity card, the reports (seva summary, festival view, audit trail)
 * and the day-close list (Design Book 12.3-12.4). English first, Kannada on its own line under it (C-49). The Kannada
 * is to be proof-read by the temple office (O-03). Buttons are English only, like the rest of the module.
 */
import { SEVA_ROUTES } from '@/lib/seva/routes';
import type { AuditType } from '@/lib/seva/server/reports';
import type { PaymentMode } from '@/types/seva';
import type { ReceiptStatusFilter } from '@/types/seva-receipts';
import type { ContinuityGap } from '@/types/seva-reports';
import { COMMON, type Bi } from './common';

const COUNT = new Intl.NumberFormat('en-IN');

/** 1234 -> '1,234' (Indian grouping). */
export function countText(n: number): string {
  return COUNT.format(n);
}

function plural(n: number, one: string, many: string): string {
  return `${countText(n)} ${n === 1 ? one : many}`;
}

export const REGISTER = {
  title: { en: 'Receipts register', kn: 'ರಸೀದಿ ದಾಖಲೆ' },
  subtitle: { en: 'Every receipt number, newest first, with its status.', kn: 'ಪ್ರತಿ ರಸೀದಿ ಸಂಖ್ಯೆ, ಹೊಸದು ಮೊದಲು, ಅದರ ಸ್ಥಿತಿಯೊಂದಿಗೆ.' },
  export: 'Export',
  filters: { en: 'Filters', kn: 'ಆಯ್ಕೆಗಳು' },
  from: { en: 'From', kn: 'ಇಂದ' },
  to: { en: 'To', kn: 'ವರೆಗೆ' },
  seva: { en: 'Seva', kn: 'ಸೇವೆ' },
  allSevas: 'All sevas',
  payment: { en: 'Payment', kn: 'ಪಾವತಿ' },
  status: { en: 'Status', kn: 'ಸ್ಥಿತಿ' },
  search: { en: 'Search by number or name', kn: 'ಸಂಖ್ಯೆ ಅಥವಾ ಹೆಸರಿನಿಂದ ಹುಡುಕಿ' },
  searchPlaceholder: 'e.g. 000124 or Lakshmi',
  loading: { en: 'Loading receipts...', kn: 'ರಸೀದಿಗಳನ್ನು ತರಲಾಗುತ್ತಿದೆ...' },
  empty: { en: 'No receipt matches these filters.', kn: 'ಈ ಆಯ್ಕೆಗಳಿಗೆ ಯಾವ ರಸೀದಿಯೂ ಹೊಂದುವುದಿಲ್ಲ.' },
  showMore: 'Show more',
  loadingMore: 'Loading more...',
  tryAgain: 'Try again',
  shown: (n: number): string => `Showing ${plural(n, 'receipt', 'receipts')}`,
  columns: {
    receiptNo: 'Receipt no',
    time: 'Time',
    devotee: 'Devotee',
    sevas: 'Seva(s)',
    amount: 'Amount',
    mode: 'Mode',
    status: 'Status',
  },
  open: (receiptNo: string): string => `Open ${receiptNo}`,
} as const;

export const PAYMENT_FILTERS: readonly { value: '' | PaymentMode; label: string }[] = [
  { value: '', label: 'Cash and UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'online', label: 'Online (Phase 2)' },
];

export const STATUS_FILTERS: readonly { value: '' | ReceiptStatusFilter; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'issued', label: 'Issued' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'changed', label: 'Changed amount' },
  { value: 'duplicate', label: 'Duplicate printed' },
  { value: 'prasadam_pending', label: 'Prasadam pending' },
];

export const MODE_LABEL: Record<PaymentMode, string> = { cash: 'Cash', upi: 'UPI', online: 'Online' };

export const RECEIPT_STATUS = {
  issued: { en: 'Issued', kn: 'ನೀಡಲಾಗಿದೆ' },
  cancelled: COMMON.cancelled,
  changed: { en: 'Changed amount', kn: 'ಮೊತ್ತ ಬದಲಾಗಿದೆ' },
  duplicate: { en: 'Duplicate printed', kn: 'ನಕಲು ಮುದ್ರಿತ' },
  prasadamPending: { en: 'Prasadam pending', kn: 'ಪ್ರಸಾದ ಬಾಕಿ' },
  refundDue: { en: 'Refund due', kn: 'ಹಣ ವಾಪಸ್ ಬಾಕಿ' },
} as const;

export const DRAWER = {
  title: { en: 'Receipt details', kn: 'ರಸೀದಿ ವಿವರ' },
  loading: { en: 'Loading the receipt...', kn: 'ರಸೀದಿ ತೆರೆಯುತ್ತಿದೆ...' },
  devotee: COMMON.name,
  sevaDate: COMMON.sevaDate,
  total: COMMON.total,
  payment: { en: 'Payment', kn: 'ಪಾವತಿ' },
  issued: { en: 'Issued', kn: 'ನೀಡಿದ್ದು' },
  prasadam: { en: 'Prasadam', kn: 'ಪ್ರಸಾದ' },
  cancelled: { en: 'Cancelled', kn: 'ರದ್ದು' },
  open: 'Open the receipt',
  close: 'Close',
  groupOf: (position: number, count: number): string => `${position} of ${count} paid together`,
  by: (name: string, when: string): string => `${name}, ${when}`,
} as const;

export const CONTINUITY = {
  title: (rangeLabel: string): string => `Number continuity, ${rangeLabel}`,
  titleKn: 'ಸಂಖ್ಯೆಗಳ ನಿರಂತರತೆ',
  allContinuous: 'No gaps in any series',
  someGaps: (n: number): string => `${plural(n, 'open gap', 'open gaps')} to resolve`,
  someMissing: 'Numbers to check',
  continuous: 'Continuous',
  openGap: (n: number): string => plural(n, 'open gap', 'open gaps'),
  missing: (n: number): string => `${plural(n, 'number', 'numbers')} not in the register`,
  online: 'online',
  offline: 'offline',
  noReceipts: 'no receipts in this range',
  web: { code: 'W', line: 'W Website and app, starts in Phase 2', badge: 'Phase 2' },
  gapLine: (from: string, to: string, cause: ContinuityGap['cause']): string =>
    `${from === to ? `Number ${from}` : `Numbers ${from} - ${to}`} missing (${cause === 'device_replaced' ? 'counter PC replaced' : 'not received from the counter PC'})`,
  resolve: 'Resolve',
  resolveLabel: (from: string, to: string): string => `Resolve gap ${from === to ? from : `${from} - ${to}`}`,
  enterPaper: 'Enter from paper book',
  enterPaperLabel: (from: string, to: string): string =>
    `Enter ${from === to ? `number ${from}` : `numbers ${from} - ${to}`} from the paper book`,
  adminResolves: {
    en: 'A missing number stays on this card until a temple admin resolves it.',
    kn: 'ಕಾಣೆಯಾದ ಸಂಖ್ಯೆ ದೇವಸ್ಥಾನದ ಆಡಳಿತಾಧಿಕಾರಿ ಪರಿಹರಿಸುವವರೆಗೆ ಇಲ್ಲಿರುತ್ತದೆ.',
  },
  format: {
    en: 'Format: series - staff no. - month-year / running number. The running number continues all year.',
    kn: 'ಸ್ವರೂಪ: ಸರಣಿ - ಸಿಬ್ಬಂದಿ ಸಂಖ್ಯೆ - ತಿಂಗಳು-ವರ್ಷ / ಸರದಿ ಸಂಖ್ಯೆ.',
  },
  loading: { en: 'Checking the numbers...', kn: 'ಸಂಖ್ಯೆಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...' },
} as const;

export const GAP_DIALOG = {
  title: (series: string, from: string, to: string): string =>
    `Resolve ${series} ${from === to ? `number ${from}` : `numbers ${from} - ${to}`}`,
  description: {
    en: 'Say what happened to these numbers. The note is kept in the audit trail.',
    kn: 'ಈ ಸಂಖ್ಯೆಗಳಿಗೆ ಏನಾಯಿತು ಎಂದು ತಿಳಿಸಿ. ಟಿಪ್ಪಣಿ ಲೆಕ್ಕಪರಿಶೋಧನೆ ದಾಖಲೆಯಲ್ಲಿ ಉಳಿಯುತ್ತದೆ.',
  },
  what: { en: 'What happened', kn: 'ಏನಾಯಿತು' },
  paperHint: {
    en: 'Slips found in the paper book? Close this and use "Enter from paper book" for each slip; the gap closes when every number is entered.',
    kn: 'ಕಾಗದದ ಪುಸ್ತಕದಲ್ಲಿ ರಸೀದಿಗಳು ಸಿಕ್ಕಿವೆಯೇ? ಇದನ್ನು ಮುಚ್ಚಿ, ಪ್ರತಿ ರಸೀದಿಗೆ "Enter from paper book" ಬಳಸಿ; ಎಲ್ಲಾ ಸಂಖ್ಯೆಗಳು ನಮೂದಾದಾಗ ಅಂತರ ಮುಚ್ಚುತ್ತದೆ.',
  },
  lost: { en: 'Declared lost', kn: 'ಕಳೆದುಹೋಗಿದೆ ಎಂದು ಘೋಷಿಸಲಾಗಿದೆ' },
  note: { en: 'Note (at least 3 letters)', kn: 'ಟಿಪ್ಪಣಿ (ಕನಿಷ್ಠ 3 ಅಕ್ಷರ)' },
  save: 'Resolve gap',
  saving: 'Saving...',
  cancel: 'Cancel',
  done: 'Gap resolved.',
} as const;

/** A gap note needs at least this many characters (the server's gapResolveSchema). */
export const GAP_NOTE_MIN = 3;

/** One slip of a gap typed in from the paper book (C-52, A5-FIX M-6): the register's continuity card. */
export const PAPER_DIALOG = {
  title: (series: string, from: string, to: string): string =>
    `Enter ${series} ${from === to ? `number ${from}` : `numbers ${from} - ${to}`} from the paper book`,
  description: {
    en: 'Type one slip exactly as printed. The gap closes when every number in it is entered; declare the rest lost if a slip cannot be found.',
    kn: 'ಒಂದು ರಸೀದಿಯನ್ನು ಮುದ್ರಿತವಾದಂತೆಯೇ ನಮೂದಿಸಿ. ಎಲ್ಲಾ ಸಂಖ್ಯೆಗಳು ನಮೂದಾದಾಗ ಅಂತರ ಮುಚ್ಚುತ್ತದೆ.',
  },
  receiptNo: { en: 'Receipt number as printed', kn: 'ಮುದ್ರಿತ ರಸೀದಿ ಸಂಖ್ಯೆ' },
  receiptNoHint: (series: string): string => `For example ${series}-023-10-2026/000007`,
  issuedOn: { en: 'Date on the slip', kn: 'ರಸೀದಿಯ ದಿನಾಂಕ' },
  sevaDate: COMMON.sevaDate,
  name: COMMON.name,
  phone: { en: 'Phone (optional)', kn: 'ದೂರವಾಣಿ (ಐಚ್ಛಿಕ)' },
  gotra: { en: 'Gotra (optional)', kn: 'ಗೋತ್ರ (ಐಚ್ಛಿಕ)' },
  seva: { en: 'Seva', kn: 'ಸೇವೆ' },
  chooseSeva: 'Choose the seva',
  quantity: { en: 'Quantity', kn: 'ಸಂಖ್ಯೆ' },
  rate: { en: 'Amount each, as printed (Rs)', kn: 'ಪ್ರತಿಯೊಂದರ ಮೊತ್ತ (ರೂ)' },
  rateHint: (rate: string): string => `Leave empty for the catalogue rate (${rate})`,
  rateNeeded: 'Type the amount: this seva has no fixed rate',
  addLine: 'Add a seva',
  removeLine: (n: number): string => `Remove seva ${n}`,
  total: { en: 'Total on the slip (Rs)', kn: 'ರಸೀದಿಯ ಒಟ್ಟು (ರೂ)' },
  mode: { en: 'Paid by', kn: 'ಪಾವತಿ ವಿಧಾನ' },
  cash: { en: 'Cash', kn: 'ನಗದು' },
  upi: { en: 'UPI', kn: 'ಯುಪಿಐ' },
  upiRef: { en: 'Last 6 digits of the UPI reference', kn: 'ಯುಪಿಐ ಉಲ್ಲೇಖದ ಕೊನೆಯ 6 ಅಂಕೆಗಳು' },
  note: { en: 'Where the slip was found (at least 3 letters)', kn: 'ರಸೀದಿ ಎಲ್ಲಿ ಸಿಕ್ಕಿತು (ಕನಿಷ್ಠ 3 ಅಕ್ಷರ)' },
  badAmount: 'Type an amount like 105 or 105.50',
  save: 'Enter receipt',
  cancel: 'Cancel',
  doneOpen: 'Receipt entered. The rest of the gap is still open.',
  doneClosed: 'Receipt entered. The gap is closed.',
} as const;

/** Marking a due refund as paid back (DB §9.9, A5-FIX M-3): the register drawer and today's receipts. */
export const REFUND_SETTLE = {
  open: 'Mark refunded',
  openLabel: (receiptNo: string): string => `Mark ${receiptNo} as refunded`,
  title: (receiptNo: string): string => `Mark ${receiptNo} as refunded`,
  description: {
    en: 'Record how the office paid this money back. It is kept in the audit trail and clears "Refund due".',
    kn: 'ಕಚೇರಿ ಈ ಹಣವನ್ನು ಹೇಗೆ ಹಿಂತಿರುಗಿಸಿತು ಎಂದು ದಾಖಲಿಸಿ. ಇದು ಲೆಕ್ಕಪರಿಶೋಧನೆ ದಾಖಲೆಯಲ್ಲಿ ಉಳಿಯುತ್ತದೆ.',
  },
  amount: (rupees: string): string => `Amount to pay back: ${rupees}`,
  mode: { en: 'Paid back by', kn: 'ಹಿಂತಿರುಗಿಸಿದ ವಿಧಾನ' },
  modes: {
    upi: { en: 'UPI', kn: 'ಯುಪಿಐ' },
    bank_transfer: { en: 'Bank transfer', kn: 'ಬ್ಯಾಂಕ್ ವರ್ಗಾವಣೆ' },
    cash: { en: 'Cash at the office', kn: 'ಕಚೇರಿಯಲ್ಲಿ ನಗದು' },
  },
  reference: { en: 'Bank or UPI reference', kn: 'ಬ್ಯಾಂಕ್ ಅಥವಾ ಯುಪಿಐ ಉಲ್ಲೇಖ' },
  referenceOptional: { en: 'Reference (optional for cash)', kn: 'ಉಲ್ಲೇಖ (ನಗದಿಗೆ ಐಚ್ಛಿಕ)' },
  note: { en: 'Note (at least 3 letters)', kn: 'ಟಿಪ್ಪಣಿ (ಕನಿಷ್ಠ 3 ಅಕ್ಷರ)' },
  save: 'Mark refunded',
  cancel: 'Cancel',
  done: 'Refund recorded.',
  state: {
    due: { en: 'Refund due', kn: 'ಮರುಪಾವತಿ ಬಾಕಿ' },
    done: { en: 'Refunded', kn: 'ಮರುಪಾವತಿಯಾಗಿದೆ' },
  },
} as const;

/** The server's refundSettleSchema: a note of 3 visible characters, a reference of 4 unless cash. */
export const REFUND_NOTE_MIN = 3;
export const REFUND_REFERENCE_MIN = 4;

export const REPORTS = {
  title: { en: 'Reports', kn: 'ವರದಿಗಳು' },
  tabs: [
    { href: SEVA_ROUTES.reports, en: 'Seva summary', kn: 'ಸೇವಾ ಸಾರಾಂಶ' },
    { href: SEVA_ROUTES.reportsFestival, en: 'Festival view', kn: 'ಹಬ್ಬದ ನೋಟ' },
    { href: SEVA_ROUTES.reportsAudit, en: 'Audit trail', kn: 'ಲೆಕ್ಕಪರಿಶೋಧನೆ ದಾಖಲೆ' },
    { href: SEVA_ROUTES.reportsExport, en: 'Export', kn: 'ರಫ್ತು' },
    { href: SEVA_ROUTES.reportsSummary, en: 'Board summary', kn: 'ಮಂಡಳಿ ಸಾರಾಂಶ' },
  ],
  tabsLabel: 'Report pages',
  loading: { en: 'Loading the report...', kn: 'ವರದಿ ತರಲಾಗುತ್ತಿದೆ...' },
  tryAgain: 'Try again',
  noData: 'no data',
} as const;

export type SummaryRange = 'today' | 'month' | 'last_month' | 'year' | 'custom';

export const SUMMARY = {
  heading: { en: 'Seva summary', kn: 'ಸೇವಾ ಸಾರಾಂಶ' },
  ranges: [
    { value: 'today', en: 'Today' },
    { value: 'month', en: 'This month' },
    { value: 'last_month', en: 'Last month' },
    { value: 'year', en: 'This year' },
    { value: 'custom', en: 'Choose dates' },
  ] as readonly { value: SummaryRange; en: string }[],
  rangeLabel: 'Range',
  bySevaDate: {
    en: 'Counted by seva date, for planning. Cancelled receipts are not counted; changed amounts count at the amount paid.',
    kn: 'ಯೋಜನೆಗಾಗಿ ಸೇವಾ ದಿನಾಂಕದ ಪ್ರಕಾರ ಎಣಿಕೆ. ರದ್ದಾದ ರಸೀದಿಗಳನ್ನು ಎಣಿಸುವುದಿಲ್ಲ.',
  },
  amount: { en: 'Amount', kn: 'ಮೊತ್ತ' },
  receipts: { en: 'Receipts', kn: 'ರಸೀದಿಗಳು' },
  sevasPerformed: { en: 'Sevas performed', kn: 'ನಡೆದ ಸೇವೆಗಳು' },
  from: { en: 'From', kn: 'ಇಂದ' },
  to: { en: 'To', kn: 'ವರೆಗೆ' },
  lastYear:(from: string, to: string, value: string): string => `${from} - ${to} last year: ${value}`,
  share: { en: 'Where the money comes from', kn: 'ಸೇವಾ ಪಾಲು' },
  table: {
    seva: 'Seva',
    count: 'Count',
    amount: 'Amount',
    countLastYear: 'Count last year',
    amountLastYear: 'Amount last year',
    change: 'Change in amount',
    total: 'Total',
  },
  rateChange: (oldRate: string | null, newRate: string, from: string): string =>
    oldRate ? `Rate ${oldRate} -> ${newRate} from ${from}` : `Rate set to ${newRate} from ${from}`,
  empty: { en: 'No receipts in this range.', kn: 'ಈ ಅವಧಿಯಲ್ಲಿ ರಸೀದಿಗಳಿಲ್ಲ.' },
  otherCategory: 'Other',
} as const;

export const FESTIVAL = {
  heading: { en: 'Festival view', kn: 'ಹಬ್ಬದ ನೋಟ' },
  festival: { en: 'Festival', kn: 'ಹಬ್ಬ' },
  compareWith: { en: 'Compare with the year', kn: 'ಹೋಲಿಸುವ ವರ್ಷ' },
  noFestivals: {
    en: 'No festival days are set up yet. Add them in Settings - Festival days.',
    kn: 'ಇನ್ನೂ ಹಬ್ಬದ ದಿನಗಳನ್ನು ಸೇರಿಸಿಲ್ಲ. ಸೆಟ್ಟಿಂಗ್ಸ್‌ನಲ್ಲಿ ಸೇರಿಸಿ.',
  },
  sevas: (year: number): Bi => ({ en: `Sevas, ${year}`, kn: `ಸೇವೆಗಳು, ${year}` }),
  amount: (year: number): Bi => ({ en: `Amount, ${year}`, kn: `ಮೊತ್ತ, ${year}` }),
  prasadam: { en: 'Prasadam handed over', kn: 'ಪ್ರಸಾದ ನೀಡಲಾಗಿದೆ' },
  prasadamLine: (given: number, receipts: number): string =>
    `${countText(given)} of ${plural(receipts, 'receipt', 'receipts')}, ${countText(Math.max(0, receipts - given))} not collected`,
  perDay: { en: 'Receipts per festival day', kn: 'ಹಬ್ಬದ ದಟ್ಟಣೆ' },
  dayN: (n: number): string => `Day ${n}`,
  planning: (year: number, packets: number, receipts: number, growth: string): string =>
    `Prasadam planning: for ${year}, plan about ${countText(packets)} packets (${plural(receipts, 'receipt', 'receipts')} with prasadam this year${growth}).`,
  growth: (pct: number): string => `, ${pct >= 0 ? 'up' : 'down'} ${Math.abs(pct)}% on the compare year`,
  table: { seva: 'Seva', difference: 'Difference', total: 'Total sevas' },
  vs: (value: string): string => `compare year: ${value}`,
  noCompare: 'no data for the compare year',
} as const;

export const AUDIT = {
  heading: { en: 'Audit trail', kn: 'ಲೆಕ್ಕಪರಿಶೋಧನೆ ದಾಖಲೆ' },
  intro: {
    en: 'Everything that changed money or rules, newest first. Every entry says who, when and why.',
    kn: 'ಹಣ ಅಥವಾ ನಿಯಮ ಬದಲಿಸಿದ ಎಲ್ಲವೂ, ಹೊಸದು ಮೊದಲು. ಯಾರು, ಯಾವಾಗ, ಏಕೆ ಎಂದು ಪ್ರತಿ ನಮೂದು ಹೇಳುತ್ತದೆ.',
  },
  type: 'Type',
  person: { en: 'Person', kn: 'ವ್ಯಕ್ತಿ' },
  everyone: 'Everyone',
  types: [
    { value: 'all', en: 'All' },
    { value: 'rate_changes', en: 'Rate changes' },
    { value: 'cancellations', en: 'Cancellations' },
    { value: 'changed_amounts', en: 'Changed amounts' },
    { value: 'day_closes', en: 'Day closes' },
    { value: 'staff', en: 'Staff' },
  ] as readonly { value: AuditType | 'all'; en: string }[],
  empty: { en: 'Nothing of this type for this person.', kn: 'ಈ ವ್ಯಕ್ತಿಗೆ ಈ ಬಗೆಯ ನಮೂದು ಇಲ್ಲ.' },
  system: 'The system',
  noReason: 'No reason given',
  openReceipt: 'Open receipt',
  openDayClose: 'Open day closes',
  showMore: 'Show more',
} as const;

/** Plain names of audited actions not covered by the receipt history labels. */
export const AUDIT_ACTION: Record<string, Bi> = {
  'seva.rate_change': { en: 'Rate change', kn: 'ದರ ಬದಲಾವಣೆ' },
  'seva.create': { en: 'Seva added', kn: 'ಸೇವೆ ಸೇರಿಸಲಾಗಿದೆ' },
  'seva.update': { en: 'Seva changed', kn: 'ಸೇವೆ ಬದಲಿಸಲಾಗಿದೆ' },
  'dayclose.close': { en: 'Day closed', kn: 'ದಿನ ಮುಕ್ತಾಯ' },
  'dayclose.reopen': { en: 'Day reopened', kn: 'ದಿನ ಮತ್ತೆ ತೆರೆಯಲಾಗಿದೆ' },
  'staff.onboard': { en: 'Staff onboarded', kn: 'ಸಿಬ್ಬಂದಿ ಸೇರ್ಪಡೆ' },
  'staff.role_change': { en: 'Staff role changed', kn: 'ಸಿಬ್ಬಂದಿ ಪಾತ್ರ ಬದಲಾವಣೆ' },
  'staff.view_only_change': { en: 'View-only changed', kn: 'ವೀಕ್ಷಣೆ ಮಾತ್ರ ಬದಲಾವಣೆ' },
  'staff.deactivate': { en: 'Staff deactivated', kn: 'ಸಿಬ್ಬಂದಿ ನಿಷ್ಕ್ರಿಯ' },
  'staff.reactivate': { en: 'Staff reactivated', kn: 'ಸಿಬ್ಬಂದಿ ಮತ್ತೆ ಸಕ್ರಿಯ' },
  'staff.delete': { en: 'Staff removed', kn: 'ಸಿಬ್ಬಂದಿ ತೆಗೆದುಹಾಕಲಾಗಿದೆ' },
  'gap.resolve': { en: 'Number gap resolved', kn: 'ಸಂಖ್ಯೆ ಅಂತರ ಪರಿಹಾರ' },
};

export const DAY_CLOSES = {
  heading: { en: 'Day closes', kn: 'ದಿನ ಮುಕ್ತಾಯಗಳು' },
  intro: {
    en: 'One row per counter per day: cash expected against counted, UPI expected against confirmed, and the difference.',
    kn: 'ಪ್ರತಿ ಕೌಂಟರ್‌ಗೆ ದಿನಕ್ಕೊಂದು ಸಾಲು: ನಿರೀಕ್ಷಿತ ಮತ್ತು ಎಣಿಸಿದ ನಗದು, UPI ಮತ್ತು ವ್ಯತ್ಯಾಸ.',
  },
  summary: (n: number, balanced: number, short: number, extra: number): string =>
    `${plural(n, 'close', 'closes')}: ${countText(balanced)} balanced, ${countText(short)} short, ${countText(extra)} extra`,
  columns: {
    day: 'Day',
    counter: 'Counter',
    receipts: 'Receipts',
    cashExpected: 'Cash expected',
    cashCounted: 'Cash counted',
    upiExpected: 'UPI expected',
    upiConfirmed: 'UPI confirmed',
    difference: 'Difference',
    closedBy: 'Closed by',
  },
  balanced: 'Balanced',
  short: (amount: string): string => `${amount} short`,
  extra: (amount: string): string => `${amount} extra`,
  reopened: 'Reopened',
  empty: { en: 'No day was closed in this range.', kn: 'ಈ ಅವಧಿಯಲ್ಲಿ ಯಾವ ದಿನವೂ ಮುಕ್ತಾಯವಾಗಿಲ್ಲ.' },
  loading: { en: 'Loading day closes...', kn: 'ದಿನ ಮುಕ್ತಾಯಗಳನ್ನು ತರಲಾಗುತ್ತಿದೆ...' },
  notConfirmed: 'not confirmed',
  detail: {
    title: (counter: string, date: string): string => `${counter}, ${date}`,
    counts: { en: 'Counted by value', kn: 'ಮೌಲ್ಯದ ಪ್ರಕಾರ ಎಣಿಕೆ' },
    note: { en: 'Note', kn: 'ಟಿಪ್ಪಣಿ' },
    noNote: 'No note',
    receipts: (n: number, cancelled: number, changed: number): string =>
      `${plural(n, 'receipt', 'receipts')}, ${countText(cancelled)} cancelled, ${countText(changed)} with a changed amount`,
    cash: (expected: string, counted: string): string => `Cash expected ${expected}, counted ${counted}`,
    upi: (count: number, expected: string, confirmed: string): string =>
      `UPI ${plural(count, 'payment', 'payments')}: expected ${expected}, confirmed ${confirmed}`,
    closed: (by: string, when: string): string => `Closed by ${by} at ${when}`,
    reopened: (by: string, when: string, reason: string): string => `Reopened by ${by} at ${when}: "${reason}"`,
    denomination: (kind: 'note' | 'coin', value: string, count: number): string => `${value} ${kind} x ${countText(count)}`,
    close: 'Close',
  },
} as const;
