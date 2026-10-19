/**
 * Words of Settings - Receipts, Counters and Counter rules (DB §13.2, §8.1, §8.4), English with Kannada under it
 * (C-49). Kannada is to be proof-read by the temple office (O-03). Lines that carry a number or a name are built by
 * the small functions at the end.
 */
import type { Bi } from './common';

export const RS: {
  receiptsTitle: Bi;
  countersTitle: Bi;
  rulesTitle: Bi;
  appliesAfterSave: Bi;
  viewOnly: Bi;
  loading: Bi;
  loadFailed: Bi;
  tryAgain: Bi;
  save: Bi;
  saving: Bi;
  discard: Bi;
  saved: Bi;
  nothingChanged: Bi;
  // Numbering
  numbersTitle: Bi;
  calendarYear: Bi;
  partSeries: Bi;
  partStaffNo: Bi;
  partMonthYear: Bi;
  partRunning: Bi;
  formatOnline: Bi;
  formatOnlineHint: Bi;
  formatOffline: Bi;
  formatOfflineHint: Bi;
  formatWeb: Bi;
  formatWebHint: Bi;
  formatApp: Bi;
  formatAppHint: Bi;
  yearlyRestart: Bi;
  neverSkip: Bi;
  // Header and footer
  headerTitle: Bi;
  headerHint: Bi;
  templeNameEn: Bi;
  templeNameKn: Bi;
  addressLine1: Bi;
  addressLine2: Bi;
  registrationLine: Bi;
  photoLeft: Bi;
  photoRight: Bi;
  noPhoto: Bi;
  removePhoto: Bi;
  footerLine1: Bi;
  footerLine2: Bi;
  footerBlessing: Bi;
  devoteeDetails: Bi;
  devoteeDetailsHint: Bi;
  printGotra: Bi;
  printNakshatra: Bi;
  printRashi: Bi;
  paper: Bi;
  paperHint: Bi;
  nameRequired: Bi;
  // Slip preview
  previewTitle: Bi;
  previewHint: Bi;
  // Counters
  counterOnline: Bi;
  counterOffline: Bi;
  lastNumbers: Bi;
  noNumbersYet: Bi;
  thisPc: Bi;
  openingFloat: Bi;
  openingFloatHint: Bi;
  saveFloat: Bi;
  floatInvalid: Bi;
  addCounterName: Bi;
  addCounterPlace: Bi;
  addCounterCancel: Bi;
  addCounterNameNeeded: Bi;
  counterAdded: Bi;
  noCounters: Bi;
  // Register this PC
  register: Bi;
  registerHint: Bi;
  pcLabel: Bi;
  pcLabelHint: Bi;
  registerConfirm: Bi;
  registering: Bi;
  registerNotKept: Bi;
  alreadyRegistered: Bi;
  pcNotRead: Bi;
  cancel: Bi;
  // Replace this PC
  replace: Bi;
  replaceHint: Bi;
  lastSlip: Bi;
  lastSlipHint: Bi;
  lastSlipInvalid: Bi;
  reason: Bi;
  reasonHint: Bi;
  reasonTooShort: Bi;
  gapWarning: Bi;
  replacing: Bi;
  confirmLastSlip: Bi;
  // Counter rules
  cancelWindow: Bi;
  cancelWindowHint: Bi;
  minutes: Bi;
  cashNote: Bi;
  cashNoteHint: Bi;
  amountReason: Bi;
  amountReasonHint: Bi;
  alwaysRequired: Bi;
  daysAhead: Bi;
  daysAheadHint: Bi;
  days: Bi;
  flagThreshold: Bi;
  flagThresholdHint: Bi;
  cancelWindowInvalid: Bi;
  daysAheadInvalid: Bi;
  thresholdInvalid: Bi;
} = {
  receiptsTitle: { en: 'Receipts', kn: 'ರಸೀದಿಗಳು' },
  countersTitle: { en: 'Counters', kn: 'ಕೌಂಟರ್‌ಗಳು' },
  rulesTitle: { en: 'Counter rules', kn: 'ಕೌಂಟರ್ ನಿಯಮಗಳು' },
  appliesAfterSave: { en: 'Changes apply to receipts made after you save.', kn: 'ಉಳಿಸಿದ ನಂತರ ಮಾಡುವ ರಸೀದಿಗಳಿಗೆ ಬದಲಾವಣೆಗಳು ಅನ್ವಯಿಸುತ್ತವೆ.' },
  viewOnly: { en: 'You can see these settings but not change them.', kn: 'ನೀವು ಈ ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ನೋಡಬಹುದು, ಬದಲಿಸಲಾಗುವುದಿಲ್ಲ.' },
  loading: { en: 'Loading settings...', kn: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ತರಲಾಗುತ್ತಿದೆ...' },
  loadFailed: { en: 'The settings could not be loaded.', kn: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ತರಲಾಗಲಿಲ್ಲ.' },
  tryAgain: { en: 'Try again', kn: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' },
  save: { en: 'Save settings', kn: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ಉಳಿಸಿ' },
  saving: { en: 'Saving...', kn: 'ಉಳಿಸಲಾಗುತ್ತಿದೆ...' },
  discard: { en: 'Discard', kn: 'ಬದಲಾವಣೆ ಬಿಡಿ' },
  saved: { en: 'Saved. Changes apply to receipts made after now.', kn: 'ಉಳಿಸಲಾಗಿದೆ. ಈಗಿನಿಂದ ಮಾಡುವ ರಸೀದಿಗಳಿಗೆ ಅನ್ವಯಿಸುತ್ತದೆ.' },
  nothingChanged: { en: 'Nothing has changed.', kn: 'ಏನೂ ಬದಲಾಗಿಲ್ಲ.' },

  numbersTitle: { en: 'Receipt numbers', kn: 'ರಸೀದಿ ಸಂಖ್ಯೆಗಳು' },
  calendarYear: { en: 'Calendar year', kn: 'ಕ್ಯಾಲೆಂಡರ್ ವರ್ಷ' },
  partSeries: { en: 'Series', kn: 'ಸರಣಿ' },
  partStaffNo: { en: 'Staff no.', kn: 'ಸಿಬ್ಬಂದಿ ಸಂಖ್ಯೆ' },
  partMonthYear: { en: 'Month and year', kn: 'ತಿಂಗಳು ಮತ್ತು ವರ್ಷ' },
  partRunning: { en: 'Running no.', kn: 'ಕ್ರಮ ಸಂಖ್ಯೆ' },
  formatOnline: { en: 'Counter, online', kn: 'ಕೌಂಟರ್, ಆನ್‌ಲೈನ್' },
  formatOnlineHint: { en: 'One series per counter PC', kn: 'ಪ್ರತಿ ಕೌಂಟರ್ ಕಂಪ್ಯೂಟರ್‌ಗೆ ಒಂದು ಸರಣಿ' },
  formatOffline: { en: 'Counter, offline', kn: 'ಕೌಂಟರ್, ಆಫ್‌ಲೈನ್' },
  formatOfflineHint: { en: 'Own series per counter; stands out at audit', kn: 'ಪ್ರತಿ ಕೌಂಟರ್‌ಗೆ ಪ್ರತ್ಯೇಕ ಸರಣಿ; ಲೆಕ್ಕಪರಿಶೋಧನೆಯಲ್ಲಿ ಎದ್ದು ಕಾಣುತ್ತದೆ' },
  formatWeb: { en: 'Website', kn: 'ವೆಬ್‌ಸೈಟ್' },
  formatWebHint: { en: 'Phase 2', kn: 'ಹಂತ 2' },
  formatApp: { en: 'Temple app', kn: 'ದೇವಸ್ಥಾನದ ಆ್ಯಪ್' },
  formatAppHint: { en: 'Shares the W running number with the website', kn: 'ವೆಬ್‌ಸೈಟ್‌ನೊಂದಿಗೆ W ಕ್ರಮ ಸಂಖ್ಯೆಯನ್ನು ಹಂಚಿಕೊಳ್ಳುತ್ತದೆ' },
  yearlyRestart: {
    en: 'The running number continues all year and starts again on 1 January',
    kn: 'ಕ್ರಮ ಸಂಖ್ಯೆ ವರ್ಷವಿಡೀ ಮುಂದುವರಿಯುತ್ತದೆ ಮತ್ತು ಜನವರಿ 1 ರಂದು ಮತ್ತೆ ಆರಂಭವಾಗುತ್ತದೆ',
  },
  neverSkip: {
    en: 'Numbers never repeat or skip; a spoiled print is cancelled with a reason and keeps its number.',
    kn: 'ಸಂಖ್ಯೆಗಳು ಪುನರಾವರ್ತನೆಯಾಗುವುದಿಲ್ಲ ಅಥವಾ ಬಿಟ್ಟುಹೋಗುವುದಿಲ್ಲ; ಹಾಳಾದ ಮುದ್ರಣವನ್ನು ಕಾರಣದೊಂದಿಗೆ ರದ್ದುಮಾಡಲಾಗುತ್ತದೆ.',
  },

  headerTitle: { en: 'Receipt header and footer', kn: 'ರಸೀದಿಯ ಮೇಲ್ಭಾಗ ಮತ್ತು ಕೆಳಭಾಗ' },
  headerHint: {
    en: 'Printed on every receipt and shown as a band on the counter screen.',
    kn: 'ಪ್ರತಿ ರಸೀದಿಯಲ್ಲಿ ಮುದ್ರಿಸಲಾಗುತ್ತದೆ ಮತ್ತು ಕೌಂಟರ್ ಪರದೆಯಲ್ಲಿ ಪಟ್ಟಿಯಾಗಿ ತೋರಿಸಲಾಗುತ್ತದೆ.',
  },
  templeNameEn: { en: 'Temple name, English', kn: 'ದೇವಸ್ಥಾನದ ಹೆಸರು, ಇಂಗ್ಲಿಷ್' },
  templeNameKn: { en: 'Temple name, Kannada', kn: 'ದೇವಸ್ಥಾನದ ಹೆಸರು, ಕನ್ನಡ' },
  addressLine1: { en: 'Address line 1', kn: 'ವಿಳಾಸ ಸಾಲು 1' },
  addressLine2: { en: 'Address line 2', kn: 'ವಿಳಾಸ ಸಾಲು 2' },
  registrationLine: { en: 'Registration line (optional)', kn: 'ನೋಂದಣಿ ಸಾಲು (ಐಚ್ಛಿಕ)' },
  photoLeft: { en: 'Photo 1 (left)', kn: 'ಚಿತ್ರ 1 (ಎಡ)' },
  photoRight: { en: 'Photo 2 (right)', kn: 'ಚಿತ್ರ 2 (ಬಲ)' },
  noPhoto: { en: 'No photo yet', kn: 'ಇನ್ನೂ ಚಿತ್ರವಿಲ್ಲ' },
  removePhoto: { en: 'Remove photo', kn: 'ಚಿತ್ರ ತೆಗೆಯಿರಿ' },
  footerLine1: { en: 'Footer line 1', kn: 'ಕೆಳಗಿನ ಸಾಲು 1' },
  footerLine2: { en: 'Footer line 2', kn: 'ಕೆಳಗಿನ ಸಾಲು 2' },
  footerBlessing: { en: 'Footer blessing', kn: 'ಆಶೀರ್ವಚನ' },
  devoteeDetails: { en: 'Devotee details printed', kn: 'ಮುದ್ರಿಸುವ ಭಕ್ತರ ವಿವರಗಳು' },
  devoteeDetailsHint: { en: 'The name always prints. The phone number never prints.', kn: 'ಹೆಸರು ಯಾವಾಗಲೂ ಮುದ್ರಣವಾಗುತ್ತದೆ. ದೂರವಾಣಿ ಸಂಖ್ಯೆ ಎಂದಿಗೂ ಮುದ್ರಣವಾಗುವುದಿಲ್ಲ.' },
  printGotra: { en: 'Gotra', kn: 'ಗೋತ್ರ' },
  printNakshatra: { en: 'Nakshatra', kn: 'ನಕ್ಷತ್ರ' },
  printRashi: { en: 'Rashi', kn: 'ರಾಶಿ' },
  paper: { en: 'Paper: one-third A4 slip, portrait (99 x 210 mm)', kn: 'ಕಾಗದ: A4 ನ ಮೂರನೇ ಒಂದು ಭಾಗ, ಉದ್ದವಾಗಿ (99 x 210 ಮಿಮೀ)' },
  paperHint: { en: 'One receipt per slip.', kn: 'ಪ್ರತಿ ಚೀಟಿಗೆ ಒಂದು ರಸೀದಿ.' },
  nameRequired: { en: 'Type the temple name in English and in Kannada.', kn: 'ದೇವಸ್ಥಾನದ ಹೆಸರನ್ನು ಇಂಗ್ಲಿಷ್ ಮತ್ತು ಕನ್ನಡದಲ್ಲಿ ಬರೆಯಿರಿ.' },

  previewTitle: { en: 'Slip preview', kn: 'ರಸೀದಿ ಮುನ್ನೋಟ' },
  previewHint: {
    en: 'A sample receipt with your header and footer, at true width. It changes as you type.',
    kn: 'ನಿಮ್ಮ ಮೇಲ್ಭಾಗ ಮತ್ತು ಕೆಳಭಾಗದೊಂದಿಗೆ ಮಾದರಿ ರಸೀದಿ. ನೀವು ಬರೆದಂತೆ ಬದಲಾಗುತ್ತದೆ.',
  },

  counterOnline: { en: 'Online', kn: 'ಆನ್‌ಲೈನ್' },
  counterOffline: { en: 'Offline', kn: 'ಆಫ್‌ಲೈನ್' },
  lastNumbers: { en: 'Last numbers this year', kn: 'ಈ ವರ್ಷದ ಕೊನೆಯ ಸಂಖ್ಯೆಗಳು' },
  noNumbersYet: { en: 'No receipts yet this year', kn: 'ಈ ವರ್ಷ ಇನ್ನೂ ರಸೀದಿಗಳಿಲ್ಲ' },
  thisPc: { en: 'This PC', kn: 'ಈ ಕಂಪ್ಯೂಟರ್' },
  openingFloat: { en: 'Opening float (Rs)', kn: 'ಆರಂಭಿಕ ಚಿಲ್ಲರೆ ಹಣ (ರೂ)' },
  openingFloatHint: { en: 'Cash kept in the drawer at the start of each day.', kn: 'ಪ್ರತಿ ದಿನದ ಆರಂಭದಲ್ಲಿ ಡ್ರಾಯರ್‌ನಲ್ಲಿ ಇಡುವ ನಗದು.' },
  saveFloat: { en: 'Save float', kn: 'ಚಿಲ್ಲರೆ ಹಣ ಉಳಿಸಿ' },
  floatInvalid: { en: 'Type the float in rupees, for example 500.', kn: 'ಚಿಲ್ಲರೆ ಹಣವನ್ನು ರೂಪಾಯಿಗಳಲ್ಲಿ ಬರೆಯಿರಿ, ಉದಾ. 500.' },
  addCounterName: { en: 'Counter name', kn: 'ಕೌಂಟರ್ ಹೆಸರು' },
  addCounterPlace: { en: 'Where it is (optional)', kn: 'ಎಲ್ಲಿದೆ (ಐಚ್ಛಿಕ)' },
  addCounterCancel: { en: 'Cancel', kn: 'ರದ್ದುಮಾಡಿ' },
  addCounterNameNeeded: { en: 'Give the counter a name.', kn: 'ಕೌಂಟರ್‌ಗೆ ಹೆಸರು ಕೊಡಿ.' },
  counterAdded: { en: 'Counter added.', kn: 'ಕೌಂಟರ್ ಸೇರಿಸಲಾಗಿದೆ.' },
  noCounters: { en: 'No counters yet.', kn: 'ಇನ್ನೂ ಕೌಂಟರ್‌ಗಳಿಲ್ಲ.' },

  register: { en: 'Register this PC', kn: 'ಈ ಕಂಪ್ಯೂಟರ್ ನೋಂದಾಯಿಸಿ' },
  registerHint: {
    en: 'This PC makes its own secret key and keeps it. The office stores only a fingerprint of it.',
    kn: 'ಈ ಕಂಪ್ಯೂಟರ್ ತನ್ನದೇ ರಹಸ್ಯ ಕೀಲಿಯನ್ನು ಮಾಡಿ ಇಟ್ಟುಕೊಳ್ಳುತ್ತದೆ. ಕಚೇರಿ ಅದರ ಗುರುತನ್ನು ಮಾತ್ರ ಇಡುತ್ತದೆ.',
  },
  pcLabel: { en: 'Name for this PC', kn: 'ಈ ಕಂಪ್ಯೂಟರ್‌ನ ಹೆಸರು' },
  pcLabelHint: { en: 'For example: Office PC', kn: 'ಉದಾಹರಣೆ: ಕಚೇರಿ ಕಂಪ್ಯೂಟರ್' },
  registerConfirm: { en: 'Register', kn: 'ನೋಂದಾಯಿಸಿ' },
  registering: { en: 'Registering...', kn: 'ನೋಂದಾಯಿಸಲಾಗುತ್ತಿದೆ...' },
  registerNotKept: {
    en: 'The office registered this PC, but the PC could not keep its key. Register it again.',
    kn: 'ಕಚೇರಿ ನೋಂದಾಯಿಸಿದೆ, ಆದರೆ ಕಂಪ್ಯೂಟರ್ ತನ್ನ ಕೀಲಿಯನ್ನು ಇಡಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ನೋಂದಾಯಿಸಿ.',
  },
  alreadyRegistered: {
    en: 'This PC already keeps a counter key. The office allows one PC per counter and refuses a second registration. To give a counter a new PC or a new key, use Replace this PC on that counter.',
    kn: 'ಈ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ ಈಗಾಗಲೇ ಕೌಂಟರ್ ಕೀಲಿ ಇದೆ. ಕಚೇರಿ ಒಂದು ಕೌಂಟರ್‌ಗೆ ಒಂದೇ ಕಂಪ್ಯೂಟರ್ ಒಪ್ಪುತ್ತದೆ, ಎರಡನೇ ನೋಂದಣಿಯನ್ನು ನಿರಾಕರಿಸುತ್ತದೆ. ಕೌಂಟರ್‌ಗೆ ಹೊಸ ಕಂಪ್ಯೂಟರ್ ಅಥವಾ ಹೊಸ ಕೀಲಿ ಬೇಕಿದ್ದರೆ, ಆ ಕೌಂಟರ್‌ನಲ್ಲಿ "ಈ ಕಂಪ್ಯೂಟರ್ ಬದಲಿಸಿ" ಬಳಸಿ.',
  },
  pcNotRead: {
    en: "This PC's counter storage could not be read, so nothing was sent. Try again.",
    kn: 'ಈ ಕಂಪ್ಯೂಟರ್‌ನ ಕೌಂಟರ್ ಸಂಗ್ರಹವನ್ನು ಓದಲಾಗಲಿಲ್ಲ, ಆದ್ದರಿಂದ ಏನನ್ನೂ ಕಳುಹಿಸಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  },
  cancel: { en: 'Cancel', kn: 'ರದ್ದುಮಾಡಿ' },

  replace: { en: 'Replace this PC', kn: 'ಈ ಕಂಪ್ಯೂಟರ್ ಬದಲಿಸಿ' },
  replaceHint: {
    en: 'Type the number on the last offline slip that came out of the old PC\'s printer. This PC carries on from the next number.',
    kn: 'ಹಳೆಯ ಕಂಪ್ಯೂಟರ್‌ನ ಮುದ್ರಕದಿಂದ ಬಂದ ಕೊನೆಯ ಆಫ್‌ಲೈನ್ ರಸೀದಿಯ ಸಂಖ್ಯೆಯನ್ನು ಬರೆಯಿರಿ. ಈ ಕಂಪ್ಯೂಟರ್ ಮುಂದಿನ ಸಂಖ್ಯೆಯಿಂದ ಮುಂದುವರಿಯುತ್ತದೆ.',
  },
  lastSlip: { en: 'Last printed offline receipt number', kn: 'ಕೊನೆಯದಾಗಿ ಮುದ್ರಿಸಿದ ಆಫ್‌ಲೈನ್ ರಸೀದಿ ಸಂಖ್ಯೆ' },
  lastSlipHint: {
    en: 'The full number or just its running number. If the old PC printed no offline slips this year, type 0.',
    kn: 'ಪೂರ್ಣ ಸಂಖ್ಯೆ ಅಥವಾ ಕ್ರಮ ಸಂಖ್ಯೆ ಮಾತ್ರ. ಈ ವರ್ಷ ಆಫ್‌ಲೈನ್ ರಸೀದಿ ಮುದ್ರಿಸದಿದ್ದರೆ 0 ಬರೆಯಿರಿ.',
  },
  lastSlipInvalid: {
    en: "Check the number: it must be this counter's offline series for this year, or just its running number.",
    kn: 'ಸಂಖ್ಯೆ ಪರಿಶೀಲಿಸಿ: ಇದು ಈ ವರ್ಷದ ಈ ಕೌಂಟರ್‌ನ ಆಫ್‌ಲೈನ್ ಸರಣಿ ಅಥವಾ ಕ್ರಮ ಸಂಖ್ಯೆ ಮಾತ್ರ ಆಗಿರಬೇಕು.',
  },
  reason: { en: 'Reason', kn: 'ಕಾರಣ' },
  reasonHint: { en: 'For example: old PC stopped working', kn: 'ಉದಾಹರಣೆ: ಹಳೆಯ ಕಂಪ್ಯೂಟರ್ ಕೆಟ್ಟುಹೋಗಿದೆ' },
  reasonTooShort: { en: 'Give a reason (at least 3 characters).', kn: 'ಕಾರಣ ನೀಡಿ (ಕನಿಷ್ಠ 3 ಅಕ್ಷರಗಳು).' },
  gapWarning: {
    en: 'Any offline receipts the old PC printed but never sent become a gap. An admin must enter them from the paper slips or declare them lost.',
    kn: 'ಹಳೆಯ ಕಂಪ್ಯೂಟರ್ ಮುದ್ರಿಸಿ ಕಳುಹಿಸದ ಆಫ್‌ಲೈನ್ ರಸೀದಿಗಳು ಅಂತರವಾಗುತ್ತವೆ. ನಿರ್ವಾಹಕರು ಅವನ್ನು ಕಾಗದದಿಂದ ನಮೂದಿಸಬೇಕು ಅಥವಾ ಕಳೆದುಹೋಗಿವೆ ಎಂದು ಘೋಷಿಸಬೇಕು.',
  },
  replacing: { en: 'Moving the counter...', kn: 'ಕೌಂಟರ್ ವರ್ಗಾಯಿಸಲಾಗುತ್ತಿದೆ...' },
  confirmLastSlip: { en: 'Yes, that is the last slip', kn: 'ಹೌದು, ಅದೇ ಕೊನೆಯ ರಸೀದಿ' },

  cancelWindow: { en: 'Cancel window', kn: 'ರದ್ದತಿ ಸಮಯ' },
  cancelWindowHint: {
    en: 'A receptionist can cancel their own receipt for this long, with a reason. After that, only a temple admin.',
    kn: 'ಸ್ವಾಗತಕಾರರು ಈ ಸಮಯದೊಳಗೆ ಕಾರಣದೊಂದಿಗೆ ತಮ್ಮ ರಸೀದಿ ರದ್ದುಮಾಡಬಹುದು. ನಂತರ ದೇವಸ್ಥಾನ ನಿರ್ವಾಹಕರು ಮಾತ್ರ.',
  },
  minutes: { en: 'minutes', kn: 'ನಿಮಿಷಗಳು' },
  cashNote: { en: 'Note for a cash difference at day close', kn: 'ದಿನದ ಮುಕ್ತಾಯದಲ್ಲಿ ನಗದು ವ್ಯತ್ಯಾಸಕ್ಕೆ ಟಿಪ್ಪಣಿ' },
  cashNoteHint: { en: 'Required whenever counted cash and receipts differ.', kn: 'ಎಣಿಸಿದ ನಗದು ಮತ್ತು ರಸೀದಿಗಳು ಬೇರೆಯಾದಾಗ ಕಡ್ಡಾಯ.' },
  amountReason: { en: 'Reason for a changed amount', kn: 'ಬದಲಾದ ಮೊತ್ತಕ್ಕೆ ಕಾರಣ' },
  amountReasonHint: { en: "When the counter changes a seva's amount, it must type why.", kn: 'ಕೌಂಟರ್ ಸೇವೆಯ ಮೊತ್ತ ಬದಲಿಸಿದಾಗ ಕಾರಣ ಬರೆಯಬೇಕು.' },
  alwaysRequired: { en: 'Always required', kn: 'ಯಾವಾಗಲೂ ಕಡ್ಡಾಯ' },
  daysAhead: { en: 'Days ahead for counter dates', kn: 'ಕೌಂಟರ್ ದಿನಾಂಕಗಳಿಗೆ ಮುಂಚಿತ ದಿನಗಳು' },
  daysAheadHint: { en: 'How far ahead the counter may book a seva date.', kn: 'ಕೌಂಟರ್ ಎಷ್ಟು ದಿನ ಮುಂಚಿತವಾಗಿ ಸೇವಾ ದಿನಾಂಕ ಕಾಯ್ದಿರಿಸಬಹುದು.' },
  days: { en: 'days', kn: 'ದಿನಗಳು' },
  flagThreshold: { en: 'Day-close flag threshold (Rs)', kn: 'ದಿನದ ಮುಕ್ತಾಯ ಎಚ್ಚರಿಕೆ ಮಿತಿ (ರೂ)' },
  flagThresholdHint: {
    en: 'A cash or UPI difference above this is shown under Needs attention.',
    kn: 'ಇದಕ್ಕಿಂತ ಹೆಚ್ಚಿನ ನಗದು ಅಥವಾ UPI ವ್ಯತ್ಯಾಸವನ್ನು "ಗಮನಿಸಬೇಕಾದವು" ಅಡಿಯಲ್ಲಿ ತೋರಿಸಲಾಗುತ್ತದೆ.',
  },
  cancelWindowInvalid: { en: 'Type whole minutes from 0 to 240.', kn: '0 ರಿಂದ 240 ರವರೆಗಿನ ಪೂರ್ಣ ನಿಮಿಷಗಳನ್ನು ಬರೆಯಿರಿ.' },
  daysAheadInvalid: { en: 'Type whole days from 0 to 999.', kn: '0 ರಿಂದ 999 ರವರೆಗಿನ ಪೂರ್ಣ ದಿನಗಳನ್ನು ಬರೆಯಿರಿ.' },
  thresholdInvalid: { en: 'Type the threshold in rupees, for example 100.', kn: 'ಮಿತಿಯನ್ನು ರೂಪಾಯಿಗಳಲ್ಲಿ ಬರೆಯಿರಿ, ಉದಾ. 100.' },
};

/** '+ Add a counter (C2 and OF2)' for the next counter number. */
export function addCounterLabel(n: number): Bi {
  return { en: `+ Add a counter (C${n} and OF${n})`, kn: `+ ಕೌಂಟರ್ ಸೇರಿಸಿ (C${n} ಮತ್ತು OF${n})` };
}

/** 'Move Counter 1 to this PC'. */
export function moveCounterLabel(counterName: string): Bi {
  return { en: `Move ${counterName} to this PC`, kn: `${counterName} ಅನ್ನು ಈ ಕಂಪ್ಯೂಟರ್‌ಗೆ ವರ್ಗಾಯಿಸಿ` };
}

/** 'Replace the PC for Counter 1'. */
export function replaceTitle(counterName: string): Bi {
  return { en: `Replace the PC for ${counterName}`, kn: `${counterName} ಗಾಗಿ ಕಂಪ್ಯೂಟರ್ ಬದಲಿಸಿ` };
}

/** 'This PC is now Counter 1.' */
export function nowThisPc(counterName: string): Bi {
  return { en: `This PC is now ${counterName}.`, kn: `ಈ ಕಂಪ್ಯೂಟರ್ ಈಗ ${counterName}.` };
}

/** 'OF1 numbers 6 to 9 will be listed as a gap until an admin explains them.' */
export function gapRangeLine(series: string, from: number, to: number): Bi {
  const range = from === to ? `${from}` : `${from} to ${to}`;
  return {
    en: `${series} numbers ${range} will be listed as a gap until an admin explains them.`,
    kn: `${series} ಸಂಖ್ಯೆಗಳು ${range} ನಿರ್ವಾಹಕರು ವಿವರಿಸುವವರೆಗೆ ಅಂತರವಾಗಿ ಪಟ್ಟಿಯಾಗುತ್ತವೆ.`,
  };
}

/** 'The office has OF1 up to 5.' */
export function officeHasLine(series: string, last: number): Bi {
  return { en: `The office has ${series} up to ${last}.`, kn: `ಕಚೇರಿಯಲ್ಲಿ ${series} ${last} ರವರೆಗೆ ಇದೆ.` };
}

/** Register and Replace refuse while this PC's outbox still holds unsent items. */
export function sendWaitingFirst(waiting: number): Bi {
  return {
    en: `This PC still has ${waiting} waiting to be sent. Send the waiting receipts first.`,
    kn: `ಈ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ ಇನ್ನೂ ${waiting} ಕಳುಹಿಸಲು ಕಾಯುತ್ತಿವೆ. ಮೊದಲು ಕಾಯುತ್ತಿರುವ ರಸೀದಿಗಳನ್ನು ಕಳುಹಿಸಿ.`,
  };
}

/** On another counter's row when this PC is already a counter: 'This PC is already Counter 1. ...' */
export function alreadyOtherCounter(counterName: string): Bi {
  return {
    en: `This PC is already ${counterName}. A PC is one counter only.`,
    kn: `ಈ ಕಂಪ್ಯೂಟರ್ ಈಗಾಗಲೇ ${counterName}. ಒಂದು ಕಂಪ್ಯೂಟರ್ ಒಂದೇ ಕೌಂಟರ್.`,
  };
}

/** The second confirmation before Replace when the gap is large. */
export function largeGapConfirm(series: string, from: number, to: number): Bi {
  const count = to - from + 1;
  return {
    en: `That leaves ${count} numbers, ${series} ${from} to ${to}, as a gap. Check the last slip again before you go on.`,
    kn: `ಇದರಿಂದ ${count} ಸಂಖ್ಯೆಗಳು, ${series} ${from} ರಿಂದ ${to}, ಅಂತರವಾಗುತ್ತವೆ. ಮುಂದುವರಿಯುವ ಮೊದಲು ಕೊನೆಯ ರಸೀದಿಯನ್ನು ಮತ್ತೆ ಪರಿಶೀಲಿಸಿ.`,
  };
}

/** The second confirmation before Replace when the office's last number is not known. */
export function unknownLastConfirm(series: string, typed: number): Bi {
  return {
    en: `The office cannot tell its last ${series} number this year, so it cannot show the gap. Any ${series} numbers up to ${typed} it never received will be listed as a gap. Check the last slip again before you go on.`,
    kn: `ಕಚೇರಿಗೆ ಈ ವರ್ಷದ ಕೊನೆಯ ${series} ಸಂಖ್ಯೆ ತಿಳಿಯದು, ಆದ್ದರಿಂದ ಅಂತರ ತೋರಿಸಲಾಗದು. ${typed} ರವರೆಗೆ ಕಚೇರಿಗೆ ಬಾರದ ${series} ಸಂಖ್ಯೆಗಳು ಅಂತರವಾಗಿ ಪಟ್ಟಿಯಾಗುತ್ತವೆ. ಮುಂದುವರಿಯುವ ಮೊದಲು ಕೊನೆಯ ರಸೀದಿಯನ್ನು ಮತ್ತೆ ಪರಿಶೀಲಿಸಿ.`,
  };
}
