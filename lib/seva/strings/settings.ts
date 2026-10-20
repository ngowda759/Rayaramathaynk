/**
 * Words of the settings pages (DB §13): the settings tabs, Seva settings (§13.1), Cash denominations (§13.3) and
 * Festival days (§13.4). Labels are English with Kannada under it (C-49); longer hints and messages are English.
 * Kannada is to be proof-read by the temple office (O-03).
 */
import { formatRupees } from '@/lib/seva/money';
import { SEVA_ROUTES } from '@/lib/seva/routes';
import type { CatalogueSeva } from '@/types/seva';
import type { Bi } from './common';

/**
 * The settings tabs (A4-9 builds the layout; A4-10 builds Receipts, Counters and Counter rules; A4P-5 Devotee lists).
 * Devotee lists comes second, right after Receipts, so it is easy to find (owner's fix, 2026-10-20).
 */
export const SETTINGS_TABS: readonly { href: string; label: Bi }[] = [
  { href: SEVA_ROUTES.settingsReceipt, label: { en: 'Receipts', kn: 'ರಸೀದಿಗಳು' } },
  { href: SEVA_ROUTES.settingsLists, label: { en: 'Devotee lists', kn: 'ಭಕ್ತರ ಪಟ್ಟಿಗಳು' } },
  { href: SEVA_ROUTES.settingsCounters, label: { en: 'Counters', kn: 'ಕೌಂಟರ್‌ಗಳು' } },
  { href: SEVA_ROUTES.settingsRules, label: { en: 'Counter rules', kn: 'ಕೌಂಟರ್ ನಿಯಮಗಳು' } },
  { href: SEVA_ROUTES.settingsDenominations, label: { en: 'Denominations', kn: 'ನೋಟು ಮತ್ತು ನಾಣ್ಯಗಳು' } },
  { href: SEVA_ROUTES.settingsFestivalDays, label: { en: 'Festival days', kn: 'ಹಬ್ಬದ ದಿನಗಳು' } },
];

export const VISIBILITY_LABEL: Record<CatalogueSeva['visibility'], Bi> = {
  counter: { en: 'Counter', kn: 'ಕೌಂಟರ್' },
  online: { en: 'Online', kn: 'ಆನ್‌ಲೈನ್' },
  both: { en: 'Both', kn: 'ಎರಡೂ' },
};

/** The table cell: "Counter only", "Online only", "Both". */
export const VISIBILITY_CELL: Record<CatalogueSeva['visibility'], string> = {
  counter: 'Counter only',
  online: 'Online only',
  both: 'Both',
};

export const SETTINGS_TEXT = {
  settingsTitle: { en: 'Settings', kn: 'ಸಂಯೋಜನೆಗಳು' } as Bi,
  settingsTabsLabel: 'Settings sections',
  appliesAfterSave: 'Changes apply to receipts made after you save.',
  viewOnly: 'You can see these settings but not change them (view-only).',
  loading: { en: 'Loading...', kn: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...' } as Bi,
  loadFailed: 'The settings could not be loaded.',
  tryAgain: 'Try again',
  yes: 'Yes',
  no: 'No',
  cancel: 'Cancel',
  close: 'Close',
  discard: 'Discard',
  saving: 'Saving...',
  rs: 'Rs',

  // Seva settings (§13.1)
  sevasTitle: { en: 'Seva settings', kn: 'ಸೇವಾ ಸಂಯೋಜನೆಗಳು' } as Bi,
  sevasCount: (n: number): string => (n === 1 ? '1 seva' : `${n} sevas`),
  addSeva: { en: '+ Add seva', kn: 'ಸೇವೆ ಸೇರಿಸಿ' } as Bi,
  sevasEmpty: 'No sevas yet. Add the first one.',
  otherSevaNote: 'Other Seva / Karnike is always counter-only and takes any amount. Sevas are switched off, never deleted.',
  colKey: { en: 'Key', kn: 'ಕೀ' } as Bi,
  colCode: { en: 'Code', kn: 'ಸಂಕೇತ' } as Bi,
  colSeva: { en: 'Seva', kn: 'ಸೇವೆ' } as Bi,
  colRate: { en: 'Rate (Rs)', kn: 'ದರ (ರೂ)' } as Bi,
  colShownOn: { en: 'Counter / online', kn: 'ಕೌಂಟರ್ / ಆನ್‌ಲೈನ್' } as Bi,
  colSeveralDates: { en: 'Several dates', kn: 'ಹಲವು ದಿನಾಂಕಗಳು' } as Bi,
  colPrasadam: { en: 'Prasadam', kn: 'ಪ್ರಸಾದ' } as Bi,
  colActive: { en: 'Active', kn: 'ಸಕ್ರಿಯ' } as Bi,
  edit: 'Edit',
  view: 'View',
  anyAmountCell: 'Any amount',
  none: 'None',
  dragHint: 'Drag to reorder. The key is the number pressed at the counter.',
  dragHandle: (name: string): string => `Drag ${name} to change its counter key`,
  moveUp: (name: string): string => `Move ${name} up`,
  moveDown: (name: string): string => `Move ${name} down`,
  activeSwitch: (name: string): string => `${name} active`,
  reordered: 'Counter keys saved.',
  sevaSaved: 'Seva saved. Receipts made from now on use it.',
  sevaSwitchedOff: (name: string): string => `${name} is switched off. It no longer shows at the counter.`,
  sevaSwitchedOn: (name: string): string => `${name} is active again.`,
  mirrorFailed: 'Saved here, but the website copy could not be updated. Save again later to retry.',

  // The drawer
  editSeva: 'Edit seva',
  newSeva: 'Add seva',
  viewSeva: 'Seva details',
  shortCode: { en: 'Short code', kn: 'ಸಂಕ್ಷಿಪ್ತ ಸಂಕೇತ' } as Bi,
  shortCodeHint: '2-3 capital letters',
  counterKey: { en: 'Counter key', kn: 'ಕೌಂಟರ್ ಕೀ' } as Bi,
  counterKeyHint: 'Also the display order',
  nameEn: { en: 'Name in English', kn: 'ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಹೆಸರು' } as Bi,
  nameKn: { en: 'Name in Kannada', kn: 'ಕನ್ನಡದಲ್ಲಿ ಹೆಸರು' } as Bi,
  rate: { en: 'Rate', kn: 'ದರ' } as Bi,
  wasRate: (oldPaise: number): string =>
    `Was ${formatRupees(oldPaise, { decimals: oldPaise % 100 !== 0 })}. Receipts already made keep their rate.`,
  wasAnyAmount: 'Was any amount. Receipts already made keep their amount.',
  reason: { en: 'Why is the rate changing? (required)', kn: 'ದರ ಏಕೆ ಬದಲಾಗುತ್ತಿದೆ? (ಕಡ್ಡಾಯ)' } as Bi,
  reasonPlaceholder: 'e.g. trust board meeting of 22 Mar 2026',
  reasonNeeded: 'A reason is needed because the rate changed.',
  anyAmount: { en: 'Takes any amount (Other Seva / Karnike)', kn: 'ಯಾವುದೇ ಮೊತ್ತ (ಇತರೆ ಸೇವೆ / ಕಾಣಿಕೆ)' } as Bi,
  anyAmountHint: 'Counter only. The receptionist types the amount.',
  shownOn: { en: 'Shown on', kn: 'ಎಲ್ಲಿ ತೋರಿಸಬೇಕು' } as Bi,
  multiDate: { en: 'Can be booked for several dates', kn: 'ಹಲವು ದಿನಾಂಕಗಳಿಗೆ ಬುಕ್ ಮಾಡಬಹುದು' } as Bi,
  multiDateHint: 'Each date gets its own receipt.',
  allowAmountChange: { en: 'Counter may change the amount', kn: 'ಕೌಂಟರ್ ಮೊತ್ತ ಬದಲಿಸಬಹುದು' } as Bi,
  prasadamGiven: { en: 'Prasadam given', kn: 'ಪ್ರಸಾದ ನೀಡಲಾಗುತ್ತದೆ' } as Bi,
  prasadamItems: { en: 'What the prasadam counter gives', kn: 'ಪ್ರಸಾದ ಕೌಂಟರ್ ಏನು ಕೊಡುತ್ತದೆ' } as Bi,
  active: { en: 'Active', kn: 'ಸಕ್ರಿಯ' } as Bi,
  saveChanges: 'Save changes',
  addTheSeva: 'Add seva',
  rateHistory: { en: 'Rate history', kn: 'ದರ ಇತಿಹಾಸ' } as Bi,
  historyEmpty: 'No rate changes yet.',
  historyFailed: 'The rate history could not be loaded.',
  historyAdded: (date: string, rate: string): string => `${date} · Added at ${rate}`,
  historyChanged: (date: string, from: string, to: string): string => `${date} · ${from} to ${to}`,
  errCode: 'Use 2 or 3 capital letters.',
  errKey: 'Type a key from 1 to 999.',
  errKeyTaken: (key: number, name: string): string => `Key ${key} is used by ${name}.`,
  errName: 'Type the name (up to 80 characters).',
  errRate: 'Type the rate in rupees, more than 0.',
  errPrasadam: 'Keep this to 200 characters or fewer.',

  // Cash denominations (§13.3)
  denominationsMeta: 'Changes apply from the next day close.',
  colOrder: { en: 'Order', kn: 'ಕ್ರಮ' } as Bi,
  colValue: { en: 'Value', kn: 'ಮೌಲ್ಯ' } as Bi,
  colKind: { en: 'Kind', kn: 'ಬಗೆ' } as Bi,
  colShown: { en: 'Shown at day close', kn: 'ದಿನದ ಮುಕ್ತಾಯದಲ್ಲಿ ತೋರಿಸಿ' } as Bi,
  note: { en: 'Note', kn: 'ನೋಟು' } as Bi,
  coin: { en: 'Coin', kn: 'ನಾಣ್ಯ' } as Bi,
  addDenomination: { en: 'Add a note or coin', kn: 'ನೋಟು ಅಥವಾ ನಾಣ್ಯ ಸೇರಿಸಿ' } as Bi,
  kind: 'Kind',
  value: 'Value',
  add: 'Add',
  remove: 'Remove',
  denominationRange: 'Type a value from 1 to 2,000.',
  denominationTwice: 'This note or coin is already listed.',
  denominationLast: 'Keep at least one note or coin.',
  saveSettings: 'Save settings',
  denominationsSaved: 'Denominations saved. They apply from the next day close.',
  previewTitle: { en: 'How day close shows it', kn: 'ದಿನದ ಮುಕ್ತಾಯದಲ್ಲಿ ಹೇಗೆ ಕಾಣುತ್ತದೆ' } as Bi,
  previewHint: 'Each row: value x count = amount. Coins are counted by value - how many Rs 10 coins, not the total.',
  previewCount: 'x count',
  previewHidden: 'Hidden rows do not appear here. The full day close is on the counter page.',
  denominationName: (kind: 'note' | 'coin', valuePaise: number): string =>
    `${formatRupees(valuePaise, { decimals: valuePaise % 100 !== 0 })} ${kind}`,
  shownSwitch: (name: string): string => `Show ${name} at day close`,
  unsaved: 'You have changes that are not saved.',

  // Festival days (§13.4)
  festivalsMeta: 'Quick chips for date pickers, shown until the last date passes.',
  addFestival: { en: '+ Add festival days', kn: 'ಹಬ್ಬದ ದಿನಗಳನ್ನು ಸೇರಿಸಿ' } as Bi,
  festivalsEmpty: 'No festival days yet.',
  colFestival: { en: 'Festival', kn: 'ಹಬ್ಬ' } as Bi,
  colDates: { en: 'Dates', kn: 'ದಿನಾಂಕಗಳು' } as Bi,
  colChip: { en: 'Chip', kn: 'ಚಿಪ್' } as Bi,
  chipShowing: 'Showing',
  chipPast: 'Past',
  chipHidden: 'Hidden',
  chipNeedsDates: 'Needs dates',
  notSetYet: 'Not set yet',
  editFestival: (name: string): string => `Edit ${name}`,
  newFestival: 'New festival days',
  festivalName: { en: 'Name in English', kn: 'ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಹೆಸರು' } as Bi,
  festivalNameKn: { en: 'Name in Kannada', kn: 'ಕನ್ನಡದಲ್ಲಿ ಹೆಸರು' } as Bi,
  showAsChip: { en: 'Show as a chip', kn: 'ಚಿಪ್ ಆಗಿ ತೋರಿಸಿ' } as Bi,
  datesPicked: (n: number): string => (n === 1 ? '1 date picked' : `${n} dates picked`),
  pickDatesHint: 'Tap the days in the calendar. Tap again to take a day off.',
  chipPreview: { en: 'The chip in date pickers', kn: 'ದಿನಾಂಕ ಆಯ್ಕೆಯಲ್ಲಿ ಚಿಪ್' } as Bi,
  prevMonth: 'Previous month',
  nextMonth: 'Next month',
  removeDate: (label: string): string => `Remove ${label}`,
  copyFromCalendar: 'Copy from festival calendar',
  copyTitle: "From the website's festival calendar",
  copyEmpty: 'The festival calendar has no dates from today on.',
  copyUse: (n: number): string => (n === 1 ? 'Use this date' : `Use these ${n} dates`),
  aradhaneSample: 'Aradhane dates are samples until the office sends them.',
  festivalNeedsDate: 'Pick at least one date.',
  festivalNeedsName: 'Type the festival name (up to 80 characters).',
  festivalTooMany: 'Pick at most 60 dates.',
  save: 'Save',
  festivalSaved: 'Festival days saved. They show as chips in date pickers.',
};
