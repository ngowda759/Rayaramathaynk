/**
 * Words of the prasadam counter (DB §11), English with Kannada under it (C-49). No amounts anywhere on this screen.
 * Kannada is to be proof-read by the temple office (O-03).
 */
import { istParts } from '../time';
import type { Bi } from './common';

export const PRASADAM: {
  title: Bi;
  givenCount: (n: number) => Bi;
  givenCountHint: Bi;
  howToFind: Bi;
  scanQr: Bi;
  typeNumber: Bi;
  numberLabel: Bi;
  numberHint: Bi;
  numberPlaceholder: string;
  find: Bi;
  finding: Bi;
  cameraHold: Bi;
  cameraReady: Bi;
  cameraStarting: Bi;
  cameraUnsupported: Bi;
  cameraDenied: Bi;
  cameraMissing: Bi;
  cameraFailed: Bi;
  offline: Bi;
  giveTitle: Bi;
  sevaDateToday: (date: string) => Bi;
  made: (time: string) => string;
  markGiven: Bi;
  notNow: Bi;
  notToday: Bi;
  prasadamIsFor: Bi;
  notTodaySuffix: Bi;
  sevaWasOn: (date: string, days: number) => Bi;
  todaysSlip: (position: number, count: number, ending: string) => Bi;
  giveAnyway: Bi;
  giveAnywayConfirm: Bi;
  scanNext: Bi;
  markedGiven: (time: string) => Bi;
  undo: Bi;
  undoing: Bi;
  alreadyGiven: Bi;
  givenAtBy: (time: string, by: string) => Bi;
  givenOnAtBy: (date: string, time: string, by: string) => Bi;
  doNotGiveAgain: Bi;
  cancelledTitle: Bi;
  cancelledAtBy: (time: string, by: string) => Bi;
  cancelledReason: (reason: string) => Bi;
  newerSlip: Bi;
  doNotGiveCancelled: Bi;
  noPrasadamTitle: Bi;
  noPrasadam: Bi;
  chooseTitle: Bi;
  chooseHint: Bi;
  notFoundTitle: Bi;
  nothingMatches: Bi;
  notFoundHint: Bi;
  typeAgain: Bi;
  scanInstead: Bi;
  failed: Bi;
} = {
  title: { en: 'Prasadam counter', kn: 'ಪ್ರಸಾದ ಕೌಂಟರ್' },
  givenCount: (n) => ({ en: `Given ${n.toLocaleString('en-IN')}`, kn: `ನೀಡಿದ್ದು ${n.toLocaleString('en-IN')}` }),
  givenCountHint: { en: 'Prasadam you marked given today on this phone or PC', kn: 'ಇಂದು ಈ ಸಾಧನದಲ್ಲಿ ನೀವು ನೀಡಿದ ಪ್ರಸಾದ' },
  howToFind: { en: 'How to find the receipt', kn: 'ರಸೀದಿಯನ್ನು ಹುಡುಕುವ ವಿಧಾನ' },
  scanQr: { en: 'Scan QR', kn: 'QR ಸ್ಕ್ಯಾನ್' },
  typeNumber: { en: 'Type receipt number', kn: 'ರಸೀದಿ ಸಂಖ್ಯೆ ಬರೆಯಿರಿ' },
  numberLabel: { en: 'Receipt number, as printed', kn: 'ರಸೀದಿ ಸಂಖ್ಯೆ, ಮುದ್ರಿಸಿದಂತೆ' },
  numberHint: { en: 'A USB scanner types here and presses Enter for you.', kn: 'USB ಸ್ಕ್ಯಾನರ್ ಇಲ್ಲಿ ಬರೆದು ತಾನೇ Enter ಒತ್ತುತ್ತದೆ.' },
  numberPlaceholder: 'C1-023-10-2026/000124',
  find: { en: 'Find receipt', kn: 'ರಸೀದಿ ಹುಡುಕಿ' },
  finding: { en: 'Finding the receipt...', kn: 'ರಸೀದಿ ಹುಡುಕುತ್ತಿದೆ...' },
  cameraHold: { en: "Hold the slip's QR inside the frame", kn: 'ರಸೀದಿಯ QR ಅನ್ನು ಚೌಕಟ್ಟಿನೊಳಗೆ ಹಿಡಿಯಿರಿ' },
  cameraReady: { en: 'Ready for the next slip', kn: 'ಮುಂದಿನ ರಸೀದಿಗೆ ಸಿದ್ಧ' },
  cameraStarting: { en: 'Starting the camera...', kn: 'ಕ್ಯಾಮೆರಾ ಆರಂಭವಾಗುತ್ತಿದೆ...' },
  cameraUnsupported: {
    en: 'This browser cannot use the camera here. The page must be opened over https. Type the receipt number instead.',
    kn: 'ಈ ಬ್ರೌಸರ್ ಇಲ್ಲಿ ಕ್ಯಾಮೆರಾ ಬಳಸಲಾಗದು. ಪುಟ https ಮೂಲಕ ತೆರೆಯಬೇಕು. ಬದಲಿಗೆ ರಸೀದಿ ಸಂಖ್ಯೆ ಬರೆಯಿರಿ.',
  },
  cameraDenied: {
    en: 'The camera is not allowed. Allow it in the browser settings, or type the receipt number instead.',
    kn: 'ಕ್ಯಾಮೆರಾಗೆ ಅನುಮತಿ ಇಲ್ಲ. ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್‌ನಲ್ಲಿ ಅನುಮತಿಸಿ, ಅಥವಾ ರಸೀದಿ ಸಂಖ್ಯೆ ಬರೆಯಿರಿ.',
  },
  cameraMissing: {
    en: 'No camera was found on this device. Type the receipt number instead.',
    kn: 'ಈ ಸಾಧನದಲ್ಲಿ ಕ್ಯಾಮೆರಾ ಸಿಗಲಿಲ್ಲ. ಬದಲಿಗೆ ರಸೀದಿ ಸಂಖ್ಯೆ ಬರೆಯಿರಿ.',
  },
  cameraFailed: {
    en: 'The camera could not start. Try again, or type the receipt number instead.',
    kn: 'ಕ್ಯಾಮೆರಾ ಆರಂಭವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ, ಅಥವಾ ರಸೀದಿ ಸಂಖ್ಯೆ ಬರೆಯಿರಿ.',
  },
  offline: {
    en: 'No connection. Check the date on the slip by eye and mark it later.',
    kn: 'ಸಂಪರ್ಕ ಇಲ್ಲ. ರಸೀದಿಯ ದಿನಾಂಕವನ್ನು ಕಣ್ಣಿನಿಂದ ಪರಿಶೀಲಿಸಿ, ನಂತರ ಗುರುತಿಸಿ.',
  },
  giveTitle: { en: 'Give prasadam', kn: 'ಪ್ರಸಾದ ನೀಡಿ' },
  sevaDateToday: (date) => ({ en: `Seva date: today, ${date}`, kn: `ಸೇವಾ ದಿನಾಂಕ: ಇಂದು, ${date}` }),
  made: (time) => `made ${time}`,
  markGiven: { en: 'Mark given', kn: 'ನೀಡಲಾಗಿದೆ ಎಂದು ಗುರುತಿಸಿ' },
  notNow: { en: 'Not now', kn: 'ಈಗ ಬೇಡ' },
  notToday: { en: 'Not today', kn: 'ಇಂದಲ್ಲ' },
  prasadamIsFor: { en: 'This prasadam is for', kn: 'ಈ ಪ್ರಸಾದ ಈ ದಿನಕ್ಕೆ' },
  notTodaySuffix: { en: 'not today', kn: 'ಇಂದಲ್ಲ' },
  sevaWasOn: (date, days) => ({
    en: `This seva was on ${date} (${days} ${days === 1 ? 'day' : 'days'} ago)`,
    kn: `ಈ ಸೇವೆ ${date} ರಂದು ಆಗಿತ್ತು (${days} ದಿನಗಳ ಹಿಂದೆ)`,
  }),
  todaysSlip: (position, count, ending) => ({
    en: `Today's slip is ${position} of ${count}, ending ${ending}. Ask for that one.`,
    kn: `ಇಂದಿನ ರಸೀದಿ ${count} ರಲ್ಲಿ ${position}, ಕೊನೆಯ ಅಂಕಿಗಳು ${ending}. ಅದನ್ನು ಕೇಳಿ.`,
  }),
  giveAnyway: { en: 'Give anyway', kn: 'ಆದರೂ ನೀಡಿ' },
  giveAnywayConfirm: { en: 'Tap again to give for another day', kn: 'ಬೇರೆ ದಿನದ ಪ್ರಸಾದ ನೀಡಲು ಮತ್ತೆ ಒತ್ತಿ' },
  scanNext: { en: 'Scan next', kn: 'ಮುಂದಿನದು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ' },
  markedGiven: (time) => ({ en: `Marked given · ${time}`, kn: `ನೀಡಲಾಗಿದೆ ಎಂದು ಗುರುತಿಸಲಾಗಿದೆ · ${time}` }),
  undo: { en: 'Undo', kn: 'ರದ್ದುಮಾಡಿ' },
  undoing: { en: 'Undoing...', kn: 'ರದ್ದುಮಾಡುತ್ತಿದೆ...' },
  alreadyGiven: { en: 'Already given', kn: 'ಈಗಾಗಲೇ ನೀಡಲಾಗಿದೆ' },
  givenAtBy: (time, by) => ({ en: `Given at ${time} by ${by}.`, kn: `${time} ಕ್ಕೆ ${by} ಅವರು ನೀಡಿದ್ದಾರೆ.` }),
  givenOnAtBy: (date, time, by) => ({
    en: `Given on ${date} at ${time} by ${by}.`,
    kn: `${date} ರಂದು ${time} ಕ್ಕೆ ${by} ಅವರು ನೀಡಿದ್ದಾರೆ.`,
  }),
  doNotGiveAgain: {
    en: 'Do not give again. If the devotee disagrees, ask the receptionist.',
    kn: 'ಮತ್ತೆ ನೀಡಬೇಡಿ. ಭಕ್ತರು ಒಪ್ಪದಿದ್ದರೆ, ಸ್ವಾಗತಕಾರರನ್ನು ಕೇಳಿ.',
  },
  cancelledTitle: { en: 'Receipt cancelled', kn: 'ರಸೀದಿ ರದ್ದಾಗಿದೆ' },
  cancelledAtBy: (time, by) => ({ en: `Cancelled ${time} by ${by}`, kn: `${time} ಕ್ಕೆ ${by} ಅವರು ರದ್ದುಮಾಡಿದ್ದಾರೆ` }),
  cancelledReason: (reason) => ({ en: `Reason: "${reason}"`, kn: `ಕಾರಣ: "${reason}"` }),
  newerSlip: { en: 'If the devotee has a newer slip, scan that one.', kn: 'ಭಕ್ತರ ಬಳಿ ಹೊಸ ರಸೀದಿ ಇದ್ದರೆ, ಅದನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.' },
  doNotGiveCancelled: { en: 'Do not give prasadam for this receipt.', kn: 'ಈ ರಸೀದಿಗೆ ಪ್ರಸಾದ ನೀಡಬೇಡಿ.' },
  noPrasadamTitle: { en: 'No prasadam', kn: 'ಪ್ರಸಾದ ಇಲ್ಲ' },
  noPrasadam: { en: 'This seva has no prasadam', kn: 'ಈ ಸೇವೆಗೆ ಪ್ರಸಾದ ಇಲ್ಲ' },
  chooseTitle: { en: 'Which receipt?', kn: 'ಯಾವ ರಸೀದಿ?' },
  chooseHint: {
    en: 'This number matches more than one receipt. Pick the one printed on the slip.',
    kn: 'ಈ ಸಂಖ್ಯೆ ಒಂದಕ್ಕಿಂತ ಹೆಚ್ಚು ರಸೀದಿಗಳಿಗೆ ಹೊಂದುತ್ತದೆ. ರಸೀದಿಯಲ್ಲಿ ಮುದ್ರಿಸಿರುವುದನ್ನು ಆರಿಸಿ.',
  },
  notFoundTitle: { en: 'No receipt found', kn: 'ರಸೀದಿ ಸಿಗಲಿಲ್ಲ' },
  nothingMatches: { en: 'Nothing matches', kn: 'ಈ ಸಂಖ್ಯೆಗೆ ಯಾವ ರಸೀದಿಯೂ ಹೊಂದುವುದಿಲ್ಲ.' },
  notFoundHint: {
    en: 'Check the number on the slip and type it again. If it still does not match, send the devotee to the receptionist.',
    kn: 'ರಸೀದಿಯ ಸಂಖ್ಯೆ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಬರೆಯಿರಿ. ಆಗಲೂ ಹೊಂದದಿದ್ದರೆ, ಭಕ್ತರನ್ನು ಸ್ವಾಗತಕಾರರ ಬಳಿ ಕಳುಹಿಸಿ.',
  },
  typeAgain: { en: 'Type again', kn: 'ಮತ್ತೆ ಬರೆಯಿರಿ' },
  scanInstead: { en: 'Scan QR instead', kn: 'ಬದಲಿಗೆ QR ಸ್ಕ್ಯಾನ್ ಮಾಡಿ' },
  failed: { en: 'Something went wrong. Try again.', kn: 'ಏನೋ ತಪ್ಪಾಗಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' },
};

/** An instant as IST clock time on this screen: '11:05 AM'. */
export function formatIstTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const { hour, minute } = istParts(d);
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
