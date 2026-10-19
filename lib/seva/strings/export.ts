/**
 * Words of the Export page and the board print summary (DB §12.6, C-42), English with Kannada under it (C-49). The
 * Kannada is to be proof-read by the temple office (O-03). Lines that carry a number are built by the functions at
 * the end.
 */
import type { BoardAttentionId, ExportFormat, ExportTick, QuickRange } from '@/lib/seva/export/collect';
import type { Bi } from './common';

export const EXPORT = {
  title: { en: 'Export', kn: 'ರಫ್ತು' },
  intro: {
    en: 'Pick a format, the dates and what goes in. The file is prepared on this computer and saved to your downloads.',
    kn: 'ವಿಧ, ದಿನಾಂಕಗಳು ಮತ್ತು ಏನು ಸೇರಬೇಕು ಎಂಬುದನ್ನು ಆರಿಸಿ. ಫೈಲ್ ಈ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲೇ ಸಿದ್ಧವಾಗಿ ಡೌನ್‌ಲೋಡ್‌ಗಳಿಗೆ ಉಳಿಯುತ್ತದೆ.',
  },
  backToReports: { en: 'Back to reports', kn: 'ವರದಿಗಳಿಗೆ ಹಿಂತಿರುಗಿ' },
  format: { en: 'Format', kn: 'ವಿಧ' },
  from: { en: 'From', kn: 'ಇಂದ' },
  to: { en: 'To', kn: 'ವರೆಗೆ' },
  quickRange: { en: 'Quick range', kn: 'ತ್ವರಿತ ಅವಧಿ' },
  included: { en: 'What is included', kn: 'ಏನು ಸೇರಿದೆ' },
  phones: { en: 'Devotee phone numbers', kn: 'ಭಕ್ತರ ದೂರವಾಣಿ ಸಂಖ್ಯೆಗಳು' },
  phonesHint: {
    en: 'Off unless needed. Phone numbers are private; every export that includes them is recorded.',
    kn: 'ಅಗತ್ಯವಿಲ್ಲದಿದ್ದರೆ ಬೇಡ. ದೂರವಾಣಿ ಸಂಖ್ಯೆಗಳು ಖಾಸಗಿ; ಅವು ಸೇರಿದ ಪ್ರತಿಯೊಂದು ರಫ್ತು ದಾಖಲಾಗುತ್ತದೆ.',
  },
  previewXlsx: { en: 'Preview: one workbook, 7 sheets', kn: 'ಮುನ್ನೋಟ: ಒಂದು ವರ್ಕ್‌ಬುಕ್, 7 ಹಾಳೆಗಳು' },
  previewXlsxNote: {
    en: 'Receipts sheet: receipt no., series, date, time, devotee, seva(s), amount, mode, status, gotra, nakshatra, rashi, seva code, UPI ref (last 6), issued by, prasadam.',
    kn: 'ರಸೀದಿ ಹಾಳೆ: ರಸೀದಿ ಸಂಖ್ಯೆ, ಸರಣಿ, ದಿನಾಂಕ, ಸಮಯ, ಭಕ್ತರು, ಸೇವೆ(ಗಳು), ಮೊತ್ತ, ವಿಧಾನ, ಸ್ಥಿತಿ, ಗೋತ್ರ, ನಕ್ಷತ್ರ, ರಾಶಿ, ಸೇವಾ ಕೋಡ್, UPI ಉಲ್ಲೇಖ, ನೀಡಿದವರು, ಪ್ರಸಾದ.',
  },
  previewCsv: { en: 'Preview: each ticked part a separate CSV file, in one zip', kn: 'ಮುನ್ನೋಟ: ಗುರುತಿಸಿದ ಪ್ರತಿ ಭಾಗ ಪ್ರತ್ಯೇಕ CSV, ಒಂದೇ zip ನಲ್ಲಿ' },
  previewCsvNote: {
    en: 'The receipts file has one row per seva line. Opens in Excel or Google Sheets.',
    kn: 'ರಸೀದಿ ಫೈಲ್‌ನಲ್ಲಿ ಪ್ರತಿ ಸೇವಾ ಸಾಲಿಗೆ ಒಂದು ಸಾಲು. Excel ಅಥವಾ Google Sheets ನಲ್ಲಿ ತೆರೆಯುತ್ತದೆ.',
  },
  previewTally: { en: 'Receipt vouchers for Tally import', kn: 'Tally ಆಮದಿಗಾಗಿ ರಸೀದಿ ವೋಚರ್‌ಗಳು' },
  previewTallyNote: {
    en: "Cash, UPI or online is debited and the seva's income ledger credited. Cancelled receipts are left out. Ledger names must already exist in Tally.",
    kn: 'ನಗದು, UPI ಅಥವಾ ಆನ್‌ಲೈನ್ ಖಾತೆಗೆ ಖರ್ಚು, ಸೇವೆಯ ಆದಾಯ ಖಾತೆಗೆ ಜಮೆ. ರದ್ದಾದ ರಸೀದಿಗಳು ಸೇರುವುದಿಲ್ಲ. ಖಾತೆ ಹೆಸರುಗಳು Tally ನಲ್ಲಿ ಮೊದಲೇ ಇರಬೇಕು.',
  },
  previewPrint: { en: 'Summary for the trust board: 2 pages, A4, large type', kn: 'ಟ್ರಸ್ಟ್ ಮಂಡಳಿಗೆ ಸಾರಾಂಶ: 2 ಪುಟ, A4, ದೊಡ್ಡ ಅಕ್ಷರ' },
  previewPrintPage1: {
    en: 'Page 1: total collected, cash, UPI, online; the Collections chart against the previous period; needs-attention items.',
    kn: 'ಪುಟ 1: ಒಟ್ಟು ಸಂಗ್ರಹ, ನಗದು, UPI, ಆನ್‌ಲೈನ್; ಹಿಂದಿನ ಅವಧಿಯೊಂದಿಗೆ ಸಂಗ್ರಹ ಚಾರ್ಟ್; ಗಮನಿಸಬೇಕಾದವು.',
  },
  previewPrintPage2: {
    en: 'Page 2: seva table with last year; day-close differences; cancellations and changed amounts with reasons; rate changes.',
    kn: 'ಪುಟ 2: ಕಳೆದ ವರ್ಷದೊಂದಿಗೆ ಸೇವಾ ಪಟ್ಟಿ; ದಿನಾಂತ್ಯ ವ್ಯತ್ಯಾಸಗಳು; ಕಾರಣ ಸಹಿತ ರದ್ದು ಮತ್ತು ಬದಲಾದ ಮೊತ್ತಗಳು; ದರ ಬದಲಾವಣೆಗಳು.',
  },
  previewPrintNote: {
    en: 'Use "Save as PDF" in the print window to keep a PDF.',
    kn: 'PDF ಬೇಕಿದ್ದರೆ ಮುದ್ರಣ ಕಿಟಕಿಯಲ್ಲಿ "Save as PDF" ಆರಿಸಿ.',
  },
  audited: { en: 'Who exported what, and when, is recorded in the audit trail.', kn: 'ಯಾರು ಏನನ್ನು ಯಾವಾಗ ರಫ್ತು ಮಾಡಿದರು ಎಂಬುದು ದಾಖಲಾಗುತ್ತದೆ.' },
  preparing: { en: 'Preparing the file...', kn: 'ಫೈಲ್ ಸಿದ್ಧವಾಗುತ್ತಿದೆ...' },
  preparingShort: { en: 'Preparing...', kn: 'ಸಿದ್ಧವಾಗುತ್ತಿದೆ...' },
  progress: { en: 'Export progress', kn: 'ರಫ್ತಿನ ಪ್ರಗತಿ' },
  building: { en: 'Putting the file together...', kn: 'ಫೈಲ್ ಜೋಡಿಸಲಾಗುತ್ತಿದೆ...' },
  saved: { en: 'The file is ready and saved to your downloads.', kn: 'ಫೈಲ್ ಸಿದ್ಧವಾಗಿ ಡೌನ್‌ಲೋಡ್‌ಗಳಿಗೆ ಉಳಿದಿದೆ.' },
  failed: { en: 'The file could not be prepared. Please try again.', kn: 'ಫೈಲ್ ಸಿದ್ಧಪಡಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' },
  badRange: { en: 'The end date is before the start date.', kn: 'ಕೊನೆಯ ದಿನಾಂಕ ಆರಂಭದ ದಿನಾಂಕಕ್ಕಿಂತ ಮೊದಲಿದೆ.' },
  nothingTicked: { en: 'Tick at least one part to include.', kn: 'ಸೇರಿಸಲು ಕನಿಷ್ಠ ಒಂದು ಭಾಗವನ್ನು ಗುರುತಿಸಿ.' },
  missingLedger: {
    en: 'A receipt with several sevas needs an income ledger for each seva. Set them in Seva settings, then try again.',
    kn: 'ಹಲವು ಸೇವೆಗಳ ರಸೀದಿಗೆ ಪ್ರತಿ ಸೇವೆಯ ಆದಾಯ ಖಾತೆ ಬೇಕು. ಸೇವಾ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಹೊಂದಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  },
  printOpened: { en: 'The print summary opened in a new tab.', kn: 'ಮುದ್ರಣ ಸಾರಾಂಶ ಹೊಸ ಟ್ಯಾಬ್‌ನಲ್ಲಿ ತೆರೆಯಿತು.' },
  cancel: { en: 'Cancel', kn: 'ರದ್ದುಮಾಡಿ' },
} satisfies Record<string, Bi>;

export const FORMAT_LABELS: Record<ExportFormat, Bi> = {
  xlsx: { en: 'Excel (.xlsx)', kn: 'ಎಕ್ಸೆಲ್' },
  csv: { en: 'CSV', kn: 'CSV' },
  tally: { en: 'Tally import', kn: 'Tally ಆಮದು' },
  print: { en: 'Print summary', kn: 'ಮುದ್ರಣ ಸಾರಾಂಶ' },
};

/**
 * The workbook's sheet names for the preview. The same list as EXPORT_SHEET_NAMES in lib/seva/excel/workbook.ts
 * (pinned by tests/unit/seva/export-collect.test.ts); kept here so the page does not load the Excel library to show it.
 */
export const SHEET_NAMES_PREVIEW: readonly string[] = [
  'Summary',
  'Receipts',
  'Sevas',
  'Cancelled and changed',
  'Day closes',
  'Prasadam',
  'Rate changes',
];

export const PREPARE_LABELS: Record<ExportFormat, string> = {
  xlsx: 'Prepare Excel file',
  csv: 'Prepare CSV files',
  tally: 'Prepare Tally file',
  print: 'Open print summary',
};

export const RANGE_LABELS: Record<QuickRange | 'custom', Bi> = {
  today: { en: 'Today', kn: 'ಇಂದು' },
  month: { en: 'This month', kn: 'ಈ ತಿಂಗಳು' },
  lastMonth: { en: 'Last month', kn: 'ಕಳೆದ ತಿಂಗಳು' },
  year: { en: 'This year', kn: 'ಈ ವರ್ಷ' },
  custom: { en: 'Custom range', kn: 'ಆಯ್ದ ಅವಧಿ' },
};

export const TICK_LABELS: Record<ExportTick, Bi> = {
  summary: { en: 'Summary (totals, cash, UPI)', kn: 'ಸಾರಾಂಶ (ಒಟ್ಟು, ನಗದು, UPI)' },
  receipts: { en: 'Receipts (every number, all series)', kn: 'ರಸೀದಿಗಳು (ಎಲ್ಲಾ ಸಂಖ್ಯೆಗಳು, ಎಲ್ಲಾ ಸರಣಿ)' },
  sevas: { en: 'Seva summary with last year', kn: 'ಕಳೆದ ವರ್ಷದೊಂದಿಗೆ ಸೇವಾ ಸಾರಾಂಶ' },
  cancelled: { en: 'Cancelled and changed amounts', kn: 'ರದ್ದು ಮತ್ತು ಬದಲಾದ ಮೊತ್ತಗಳು' },
  dayCloses: { en: 'Day closes with differences', kn: 'ವ್ಯತ್ಯಾಸ ಸಹಿತ ದಿನಾಂತ್ಯಗಳು' },
  prasadam: { en: 'Prasadam given or pending', kn: 'ಪ್ರಸಾದ ನೀಡಿದ್ದು ಅಥವಾ ಬಾಕಿ' },
  rateChanges: { en: 'Rate changes', kn: 'ದರ ಬದಲಾವಣೆಗಳು' },
};

/** The board print summary (C-42). */
export const BOARD = {
  title: { en: 'Seva collections - summary for the trust board', kn: 'ಸೇವಾ ಸಂಗ್ರಹ - ಟ್ರಸ್ಟ್ ಮಂಡಳಿಗೆ ಸಾರಾಂಶ' },
  print: { en: 'Print or save as PDF', kn: 'ಮುದ್ರಿಸಿ ಅಥವಾ PDF ಆಗಿ ಉಳಿಸಿ' },
  printHint: {
    en: 'Choose "Save as PDF" as the printer to keep a PDF. Paper: A4, portrait.',
    kn: 'PDF ಬೇಕಿದ್ದರೆ ಮುದ್ರಕವಾಗಿ "Save as PDF" ಆರಿಸಿ. ಕಾಗದ: A4, ನೇರ.',
  },
  backToExport: { en: 'Back to export', kn: 'ರಫ್ತಿಗೆ ಹಿಂತಿರುಗಿ' },
  loading: { en: 'Preparing the summary...', kn: 'ಸಾರಾಂಶ ಸಿದ್ಧವಾಗುತ್ತಿದೆ...' },
  failed: { en: 'The summary could not be prepared.', kn: 'ಸಾರಾಂಶ ಸಿದ್ಧಪಡಿಸಲಾಗಲಿಲ್ಲ.' },
  badRange: { en: 'Open this page from Export with a start and end date.', kn: 'ಆರಂಭ ಮತ್ತು ಕೊನೆಯ ದಿನಾಂಕದೊಂದಿಗೆ ರಫ್ತು ಪುಟದಿಂದ ತೆರೆಯಿರಿ.' },
  tryAgain: { en: 'Try again', kn: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' },
  totalCollected: { en: 'Total collected', kn: 'ಒಟ್ಟು ಸಂಗ್ರಹ' },
  receipts: { en: 'Receipts', kn: 'ರಸೀದಿಗಳು' },
  cash: { en: 'Cash', kn: 'ನಗದು' },
  upi: { en: 'UPI', kn: 'UPI' },
  online: { en: 'Online', kn: 'ಆನ್‌ಲೈನ್' },
  previous: { en: 'Previous period', kn: 'ಹಿಂದಿನ ಅವಧಿ' },
  collections: { en: 'Collections', kn: 'ಸಂಗ್ರಹ' },
  attention: { en: 'Needs attention', kn: 'ಗಮನಿಸಬೇಕಾದವು' },
  sevas: { en: 'Sevas, with the same days last year', kn: 'ಸೇವೆಗಳು, ಕಳೆದ ವರ್ಷದ ಅದೇ ದಿನಗಳೊಂದಿಗೆ' },
  seva: { en: 'Seva', kn: 'ಸೇವೆ' },
  count: { en: 'Count', kn: 'ಸಂಖ್ಯೆ' },
  amount: { en: 'Amount', kn: 'ಮೊತ್ತ' },
  lastYear: { en: 'Last year', kn: 'ಕಳೆದ ವರ್ಷ' },
  quantity: { en: 'Quantity', kn: 'ಪ್ರಮಾಣ' },
  noData: { en: 'no data', kn: 'ಮಾಹಿತಿ ಇಲ್ಲ' },
  sevaTotal: { en: 'All sevas', kn: 'ಎಲ್ಲಾ ಸೇವೆಗಳು' },
  sevaBasis: {
    en: 'Sevas are counted by seva date; the totals on page 1 are by the day the receipt was issued, so the two can differ.',
    kn: 'ಸೇವೆಗಳನ್ನು ಸೇವಾ ದಿನಾಂಕದಂತೆ ಎಣಿಸಲಾಗಿದೆ; ಪುಟ 1ರ ಮೊತ್ತಗಳು ರಸೀದಿ ನೀಡಿದ ದಿನದಂತೆ, ಆದ್ದರಿಂದ ಎರಡೂ ಬೇರೆಯಾಗಬಹುದು.',
  },
  reasonNotRecorded: { en: 'reason not recorded', kn: 'ಕಾರಣ ದಾಖಲಾಗಿಲ್ಲ' },
  noSevas: { en: 'No sevas in this range.', kn: 'ಈ ಅವಧಿಯಲ್ಲಿ ಸೇವೆಗಳಿಲ್ಲ.' },
  dayCloses: { en: 'Day-close differences', kn: 'ದಿನಾಂತ್ಯ ವ್ಯತ್ಯಾಸಗಳು' },
  noDayCloseDifferences: { en: 'Every day close matched.', kn: 'ಎಲ್ಲಾ ದಿನಾಂತ್ಯಗಳು ಸರಿಹೊಂದಿವೆ.' },
  cancelledChanged: { en: 'Cancellations and changed amounts', kn: 'ರದ್ದು ಮತ್ತು ಬದಲಾದ ಮೊತ್ತಗಳು' },
  noCancelledChanged: { en: 'None in this range.', kn: 'ಈ ಅವಧಿಯಲ್ಲಿ ಯಾವುದೂ ಇಲ್ಲ.' },
  rateChanges: { en: 'Rate changes', kn: 'ದರ ಬದಲಾವಣೆಗಳು' },
  noRateChanges: { en: 'No rate changes in this range.', kn: 'ಈ ಅವಧಿಯಲ್ಲಿ ದರ ಬದಲಾವಣೆ ಇಲ್ಲ.' },
  cancelled: { en: 'Cancelled', kn: 'ರದ್ದು' },
  changed: { en: 'Changed amount', kn: 'ಬದಲಾದ ಮೊತ್ತ' },
  short: { en: 'Short', kn: 'ಕಡಿಮೆ' },
  extra: { en: 'Extra', kn: 'ಹೆಚ್ಚು' },
  page: { en: 'Page', kn: 'ಪುಟ' },
  defaultBlessing: { en: 'Sri Gururajo Vijayate', kn: 'ಶ್ರೀ ಗುರುರಾಜೋ ವಿಜಯತೇ' },
} satisfies Record<string, Bi>;

export const ATTENTION_LABELS: Record<BoardAttentionId, Bi> = {
  day_close_difference: { en: 'Day closes short or extra', kn: 'ಕಡಿಮೆ ಅಥವಾ ಹೆಚ್ಚು ಇದ್ದ ದಿನಾಂತ್ಯಗಳು' },
  number_gaps: { en: 'Receipt number gaps', kn: 'ರಸೀದಿ ಸಂಖ್ಯೆಯ ಅಂತರಗಳು' },
  changed_amounts: { en: 'Changed amounts', kn: 'ಬದಲಾದ ಮೊತ್ತಗಳು' },
  cancellations: { en: 'Cancellations', kn: 'ರದ್ದತಿಗಳು' },
  prasadam_pending: { en: 'Prasadam not yet collected', kn: 'ಇನ್ನೂ ಪಡೆಯದ ಪ್ರಸಾದ' },
};

/** 'Part 2 of 6' while the export pages through its parts (plan A4P-3). */
export function partOf(n: number, of: number): Bi {
  return { en: `Part ${n} of ${of}`, kn: `ಭಾಗ ${n} / ${of}` };
}

/** 'and 4 more - see the Excel export' under a list cut to fit the page. */
export function moreLine(n: number): Bi {
  return { en: `and ${n} more - see the Excel export`, kn: `ಇನ್ನೂ ${n} - ಎಕ್ಸೆಲ್ ರಫ್ತಿನಲ್ಲಿ ನೋಡಿ` };
}

/** Footer: range, who prepared it and when. */
export function preparedLine(p: { range: string; by: string; at: string }): Bi {
  return {
    en: `${p.range} · Prepared by ${p.by} on ${p.at}`,
    kn: `${p.range} · ಸಿದ್ಧಪಡಿಸಿದವರು ${p.by}, ${p.at}`,
  };
}

/** The change against the previous period: '+12% against the previous period' or 'no earlier data'. */
export function changeLine(current: number, prev: number): Bi {
  if (prev <= 0) return { en: 'No data for the previous period', kn: 'ಹಿಂದಿನ ಅವಧಿಯ ಮಾಹಿತಿ ಇಲ್ಲ' };
  const pct = Math.round(((current - prev) / prev) * 100);
  const sign = pct > 0 ? '+' : '';
  return { en: `${sign}${pct}% against the previous period`, kn: `ಹಿಂದಿನ ಅವಧಿಗಿಂತ ${sign}${pct}%` };
}
