/**
 * Words of Settings - Devotee lists (plan A4P-5): the gotra, nakshatra and rashi lists the counter offers.
 * Labels are English with Kannada under it (C-49); longer hints and messages are English.
 * Kannada is to be proof-read by the temple office (O-03).
 */
import type { SevaListKind } from '@/types/seva';
import { COMMON, type Bi } from './common';

export const LIST_TABS: readonly { kind: SevaListKind; label: Bi }[] = [
  { kind: 'gotra', label: COMMON.gotra },
  { kind: 'nakshatra', label: COMMON.nakshatra },
  { kind: 'rashi', label: COMMON.rashi },
];

export const LISTS_TEXT = {
  title: { en: 'Devotee lists', kn: 'ಭಕ್ತರ ಪಟ್ಟಿಗಳು' } as Bi,
  intro:
    'The gotras, nakshatras and rashis offered at the counter. Nothing is ever deleted, and every change is logged in the audit trail.',
  fixedNote: 'Nakshatra and rashi names are fixed. Only the Kannada spelling can be corrected.',
  gotraNote: 'Add a gotra, correct its name, or hide it. A hidden gotra stays on old receipts but is not offered at the counter.',
  viewOnly: 'You can see these lists but not change them (view-only).',
  tabsLabel: 'Devotee lists',
  loading: { en: 'Loading...', kn: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...' } as Bi,
  loadFailed: { en: 'The lists could not be loaded.', kn: 'ಪಟ್ಟಿಗಳನ್ನು ತರಲಾಗಲಿಲ್ಲ.' } as Bi,
  tryAgain: 'Try again',

  uncheckedBadge: { en: 'Not yet checked', kn: 'ಇನ್ನೂ ಪರಿಶೀಲಿಸಿಲ್ಲ' } as Bi,
  checked: 'Checked',
  /** The count on each tab. */
  uncheckedCount: (n: number): string => (n === 1 ? '1 Kannada name not yet checked' : `${n} Kannada names not yet checked`),
  checkHint: 'Saving a Kannada name marks it checked. Open one, read it, and save it as it is if it is right.',

  search: (label: string): string => `Search ${label.toLowerCase()}s`,
  noMatch: 'Nothing matches the search.',
  addGotra: { en: '+ Add gotra', kn: 'ಗೋತ್ರ ಸೇರಿಸಿ' } as Bi,

  colId: { en: 'No.', kn: 'ಸಂ.' } as Bi,
  colName: { en: 'Name', kn: 'ಹೆಸರು' } as Bi,
  colStatus: { en: 'Status', kn: 'ಸ್ಥಿತಿ' } as Bi,
  hiddenChip: 'Hidden',
  edit: 'Edit',
  editLabel: (name: string): string => `Edit ${name}`,
  editKannada: 'Edit Kannada',
  editKannadaLabel: (name: string): string => `Edit Kannada of ${name}`,
  hide: 'Hide',
  show: 'Show',
  hideLabel: (name: string): string => `Hide ${name}`,
  showLabel: (name: string): string => `Show ${name}`,
  hiding: 'Hiding...',
  showing: 'Showing...',

  // The dialog
  addTitle: { en: 'Add a gotra', kn: 'ಗೋತ್ರ ಸೇರಿಸಿ' } as Bi,
  editTitle: (name: string): Bi => ({ en: `Edit ${name}`, kn: 'ಬದಲಿಸಿ' }),
  englishName: { en: 'English name', kn: 'ಇಂಗ್ಲಿಷ್ ಹೆಸರು' } as Bi,
  kannadaName: { en: 'Kannada name', kn: 'ಕನ್ನಡ ಹೆಸರು' } as Bi,
  englishFixed: (name: string): string => `English name: ${name} (fixed)`,
  kannadaHintNew: 'Optional. You can add it later.',
  kannadaHint: 'Saving marks this spelling checked.',
  nameNeeded: 'Write the English name.',
  kannadaNeeded: 'Write the Kannada name.',
  duplicate: 'A gotra with this name is already in the list (it may be hidden).',
  save: 'Save',
  saving: 'Saving...',
  cancel: 'Cancel',
  added: (name: string): string => `${name} added. The counter offers it the next time its page is opened.`,
  saved: (name: string): string => `${name} saved.`,
  hidden: (name: string): string => `${name} is hidden. The counter no longer offers it.`,
  shown: (name: string): string => `${name} is offered at the counter again.`,
  saveFailed: { en: 'The change could not be saved.', kn: 'ಬದಲಾವಣೆಯನ್ನು ಉಳಿಸಲಾಗಲಿಲ್ಲ.' } as Bi,
} as const;
