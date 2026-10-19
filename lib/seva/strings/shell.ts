/**
 * Words of the module shell: navigation labels and the access / loading messages, English with Kannada under it
 * (C-49). Kannada is to be proof-read by the temple office (O-03).
 */
import type { Bi } from './common';

export const SHELL_NAV: {
  sevaEntry: Bi;
  receiptBook: Bi;
  dashboard: Bi;
  counter: Bi;
  todayReceipts: Bi;
  closeDay: Bi;
  register: Bi;
  reports: Bi;
  dayCloses: Bi;
  sevaSettings: Bi;
  receiptSettings: Bi;
  prasadam: Bi;
  staffRoles: Bi;
} = {
  sevaEntry: { en: 'Seva Entry', kn: 'ಸೇವಾ ನಮೂದು' },
  receiptBook: { en: 'Receipt Book', kn: 'ರಸೀದಿ ಪುಸ್ತಕ' },
  dashboard: { en: 'Dashboard', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' },
  counter: { en: 'Counter', kn: 'ಕೌಂಟರ್' },
  todayReceipts: { en: "Today's receipts", kn: 'ಇಂದಿನ ರಸೀದಿಗಳು' },
  closeDay: { en: 'Close day', kn: 'ದಿನ ಮುಕ್ತಾಯ' },
  register: { en: 'Register', kn: 'ರಸೀದಿ ದಾಖಲೆ' },
  reports: { en: 'Reports', kn: 'ವರದಿಗಳು' },
  dayCloses: { en: 'Day closes', kn: 'ದಿನ ಮುಕ್ತಾಯಗಳು' },
  sevaSettings: { en: 'Seva settings', kn: 'ಸೇವಾ ಸೆಟ್ಟಿಂಗ್‌ಗಳು' },
  receiptSettings: { en: 'Receipt settings', kn: 'ರಸೀದಿ ಸೆಟ್ಟಿಂಗ್‌ಗಳು' },
  prasadam: { en: 'Prasadam', kn: 'ಪ್ರಸಾದ' },
  staffRoles: { en: 'Staff and roles', kn: 'ಸಿಬ್ಬಂದಿ ಮತ್ತು ಪಾತ್ರಗಳು' },
};

export const SHELL: {
  noAccess: Bi;
  noAccessHint: Bi;
  loading: Bi;
  loadFailed: Bi;
  tryAgain: Bi;
  opening: Bi;
} = {
  noAccess: { en: 'You do not have access to this page.', kn: 'ಈ ಪುಟವನ್ನು ತೆರೆಯಲು ನಿಮಗೆ ಅನುಮತಿ ಇಲ್ಲ.' },
  noAccessHint: {
    en: 'If you need it, ask the temple office to change your role.',
    kn: 'ಬೇಕಿದ್ದರೆ, ನಿಮ್ಮ ಪಾತ್ರವನ್ನು ಬದಲಿಸಲು ದೇವಸ್ಥಾನದ ಕಚೇರಿಯನ್ನು ಕೇಳಿ.',
  },
  loading: { en: 'Loading...', kn: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...' },
  loadFailed: { en: 'Could not load your seva access. Try again.', kn: 'ನಿಮ್ಮ ಸೇವಾ ಅನುಮತಿ ತೆರೆಯಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' },
  tryAgain: { en: 'Try again', kn: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' },
  opening: { en: 'Opening your page...', kn: 'ನಿಮ್ಮ ಪುಟ ತೆರೆಯುತ್ತಿದೆ...' },
};

/** Parts of the module frames at /seva (plan A4S-1 adds them; A4S-2 draws the header, rail and phone bar). */
export type ShellFrameKey =
  | 'templeName'
  | 'counterTitle'
  | 'signOut'
  | 'signingOut'
  | 'websiteAdmin'
  | 'more'
  | 'sectionsLabel'
  | 'opensWebsiteAdmin';

export const SHELL_FRAME: Record<ShellFrameKey, Bi> = {
  templeName: { en: 'Sri Raghavendra Swamy Matha', kn: 'ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ' },
  counterTitle: { en: 'Seva Counter', kn: 'ಸೇವಾ ಕೌಂಟರ್' },
  signOut: { en: 'Sign out', kn: 'ಸೈನ್ ಔಟ್' },
  signingOut: { en: 'Signing out...', kn: 'ಸೈನ್ ಔಟ್ ಆಗುತ್ತಿದೆ...' },
  websiteAdmin: { en: 'Website admin', kn: 'ವೆಬ್‌ಸೈಟ್ ನಿರ್ವಹಣೆ' },
  more: { en: 'More', kn: 'ಇನ್ನಷ್ಟು' },
  sectionsLabel: { en: 'Seva Entry sections', kn: 'ಸೇವಾ ನಮೂದು ವಿಭಾಗಗಳು' },
  opensWebsiteAdmin: { en: 'Opens in the website admin', kn: 'ವೆಬ್‌ಸೈಟ್ ನಿರ್ವಹಣೆಯಲ್ಲಿ ತೆರೆಯುತ್ತದೆ' },
};
