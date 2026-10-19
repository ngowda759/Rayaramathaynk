/**
 * Words of the seva dashboard (DB §12.1-12.2), English with Kannada under it (C-49). Kannada is to be proof-read by
 * the temple office (O-03). Lines that carry a number are built in lib/seva/dashboard/attention-text.ts and format.ts.
 */
import type { Period } from '@/lib/seva/time';

import type { Bi } from './common';

export const DASHBOARD: {
  title: Bi;
  asOf: string;
  periodLabel: string;
  export: Bi;
  needsAttention: Bi;
  nothingToLookAt: string;
  summary: string;
  total: Bi;
  receipts: Bi;
  cash: Bi;
  upi: Bi;
  online: Bi;
  onlineLater: string;
  collections: Bi;
  topSevas: Bi;
  paymentMode: Bi;
  rush: Bi;
  festivalPeaks: Bi;
  details: string;
  rankBy: string;
  byAmount: Bi;
  byCount: Bi;
  showCalendar: (year: number) => string;
  hideCalendar: (year: number) => string;
  calendarLoading: (year: number) => string;
  calendarFailed: Bi;
  rushNote: string;
  modeNote: string;
  festivalNote: string;
  noReceipts: Bi;
  loading: Bi;
  refreshing: string;
  loadFailed: Bi;
  tryAgain: string;
  openingCounter: Bi;
  badAnswer: string;
  seva: string;
  amount: string;
  count: string;
  when: string;
  date: string;
  festivalDay: string;
  receiptsCol: string;
  weekday: string;
  hour: string;
  share: string;
  mode: string;
} = {
  title: { en: 'Dashboard', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' },
  asOf: 'as of',
  periodLabel: 'Period shown',
  export: { en: 'Export', kn: 'ರಫ್ತು' },
  needsAttention: { en: 'Needs attention', kn: 'ಗಮನಿಸಬೇಕಾದವು' },
  nothingToLookAt: 'Nothing to look at',
  summary: 'Summary for the period',
  total: { en: 'Total collected', kn: 'ಒಟ್ಟು ಸಂಗ್ರಹ' },
  receipts: { en: 'Receipts', kn: 'ರಸೀದಿಗಳು' },
  cash: { en: 'Cash', kn: 'ನಗದು' },
  upi: { en: 'UPI', kn: 'ಯುಪಿಐ' },
  online: { en: 'Online', kn: 'ಆನ್‌ಲೈನ್' },
  onlineLater: 'starts in Phase 2',
  collections: { en: 'Collections', kn: 'ಸಂಗ್ರಹ' },
  topSevas: { en: 'Top sevas', kn: 'ಪ್ರಮುಖ ಸೇವೆಗಳು' },
  paymentMode: { en: 'Payment mode', kn: 'ಪಾವತಿ ವಿಧಾನ' },
  rush: { en: 'Counter rush hours', kn: 'ಕೌಂಟರ್ ದಟ್ಟಣೆ ಸಮಯ' },
  festivalPeaks: { en: 'Festival peaks', kn: 'ಹಬ್ಬದ ದಟ್ಟಣೆ' },
  details: 'Charts for the period',
  rankBy: 'Rank by',
  byAmount: { en: 'Amount', kn: 'ಮೊತ್ತ' },
  byCount: { en: 'Count', kn: 'ಸಂಖ್ಯೆ' },
  showCalendar: (year) => `Show the ${year} calendar`,
  hideCalendar: (year) => `Hide the ${year} calendar`,
  calendarLoading: (year) => `Loading the ${year} calendar...`,
  calendarFailed: { en: 'The year calendar could not be loaded.', kn: 'ವರ್ಷದ ಕ್ಯಾಲೆಂಡರ್ ತೆರೆಯಲಾಗಲಿಲ್ಲ.' },
  rushNote: 'Receipts by hour and weekday. Darker = busier.',
  modeNote: 'Online starts in Phase 2. Cash is counted and UPI matched at day close.',
  festivalNote: 'Every day of the year; festival days are outlined.',
  noReceipts: { en: 'No receipts in this period yet.', kn: 'ಈ ಅವಧಿಯಲ್ಲಿ ಇನ್ನೂ ರಸೀದಿಗಳಿಲ್ಲ.' },
  loading: { en: 'Loading the dashboard...', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ತೆರೆಯುತ್ತಿದೆ...' },
  refreshing: 'Updating...',
  loadFailed: { en: 'The dashboard could not be loaded.', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ತೆರೆಯಲಾಗಲಿಲ್ಲ.' },
  tryAgain: 'Try again',
  openingCounter: { en: 'Opening the counter...', kn: 'ಕೌಂಟರ್ ತೆರೆಯುತ್ತಿದೆ...' },
  badAnswer: 'The office server sent an answer the dashboard cannot read. Try again.',
  seva: 'Seva',
  amount: 'Amount',
  count: 'Count',
  when: 'When',
  date: 'Date',
  festivalDay: 'Festival day',
  receiptsCol: 'Receipts',
  weekday: 'Weekday',
  hour: 'Hour',
  share: 'Share',
  mode: 'Mode',
};

/** The period switch; phone labels are short so four fit on a 390 px screen (mockup `home-phone`). */
export const PERIODS: { value: Period; en: string; short: string; kn: string }[] = [
  { value: 'today', en: 'Today', short: 'Today', kn: 'ಇಂದು' },
  { value: 'week', en: 'This week', short: 'Week', kn: 'ಈ ವಾರ' },
  { value: 'month', en: 'This month', short: 'Month', kn: 'ಈ ತಿಂಗಳು' },
  { value: 'year', en: 'This year', short: 'Year', kn: 'ಈ ವರ್ಷ' },
];

/** What each period is compared with (DB §12.1 period rules, like-for-like). */
export const PREVIOUS: Record<Period, { short: string; name: string }> = {
  today: { short: 'yesterday', name: 'Yesterday' },
  week: { short: 'last week', name: 'Last week, same days' },
  month: { short: 'last month', name: 'Last month, same days' },
  year: { short: 'last year', name: 'Last year, same dates' },
};

/** How the hero chart is bucketed, and the period in words. */
export const PERIOD_WORDS: Record<Period, { by: string; when: string }> = {
  today: { by: 'By hour', when: 'Today' },
  week: { by: 'By day', when: 'This week' },
  month: { by: 'By day', when: 'This month' },
  year: { by: 'By month', when: 'This year' },
};

/** Needs-attention card titles in Kannada (the English title carries the number). */
export const ATTENTION_KN: Record<string, string> = {
  changed_amounts: 'ಬದಲಾದ ಮೊತ್ತಗಳು',
  cancellations: 'ರದ್ದತಿಗಳು',
  day_close_difference: 'ದಿನ ಮುಕ್ತಾಯ ವ್ಯತ್ಯಾಸ',
  day_not_closed: 'ಮುಕ್ತಾಯವಾಗದ ದಿನಗಳು',
  waiting_to_sync: 'ಕಳುಹಿಸಲು ಬಾಕಿ',
  number_gaps: 'ಸಂಖ್ಯೆ ಅಂತರ',
  prasadam_pending: 'ಪ್ರಸಾದ ಬಾಕಿ',
  upi_refunds_due: 'ಯುಪಿಐ ಹಣ ವಾಪಸ್ ಬಾಕಿ',
  clock_skew: 'ಗಡಿಯಾರ ವ್ಯತ್ಯಾಸ',
  backup: 'ಬ್ಯಾಕಪ್',
  database_size: 'ಡೇಟಾಬೇಸ್ ಗಾತ್ರ',
  in_doubt_duplicates: 'ಸಂಭವನೀಯ ನಕಲು ರಸೀದಿ',
  future_offline: 'ಮುಂದಿನ ಸಮಯದ ಆಫ್‌ಲೈನ್ ರಸೀದಿ',
  offline_cancels: 'ಆಫ್‌ಲೈನ್ ರದ್ದತಿಗಳು',
  upi_changed: 'ಯುಪಿಐ ಐಡಿ ಬದಲಾವಣೆ',
};
