/**
 * Words of the module shell: navigation labels and the access / loading messages, English with Kannada under it
 * (C-49). Kannada is to be proof-read by the temple office (O-03).
 */
import type { Bi } from './common';

export const SHELL_NAV: {
  sevaEntry: Bi;
  /** The counter header's way back to the rest of the module (temple admins, view-only too, and super admins). */
  sevaEntryMenu: Bi;
  receiptBook: Bi;
  dashboard: Bi;
  counter: Bi;
  todayReceipts: Bi;
  closeDay: Bi;
  register: Bi;
  reports: Bi;
  dayCloses: Bi;
  sevaSettings: Bi;
  settings: Bi;
  prasadam: Bi;
  staffRoles: Bi;
} = {
  sevaEntry: { en: 'Seva Entry', kn: 'ಸೇವಾ ನಮೂದು' },
  sevaEntryMenu: { en: 'Seva Entry menu', kn: 'ಸೇವಾ ನಮೂದು ಮೆನು' },
  receiptBook: { en: 'Receipt Book', kn: 'ರಸೀದಿ ಪುಸ್ತಕ' },
  dashboard: { en: 'Dashboard', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' },
  counter: { en: 'Counter', kn: 'ಕೌಂಟರ್' },
  todayReceipts: { en: "Today's receipts", kn: 'ಇಂದಿನ ರಸೀದಿಗಳು' },
  closeDay: { en: 'Close day', kn: 'ದಿನ ಮುಕ್ತಾಯ' },
  register: { en: 'Register', kn: 'ರಸೀದಿ ದಾಖಲೆ' },
  reports: { en: 'Reports', kn: 'ವರದಿಗಳು' },
  dayCloses: { en: 'Day closes', kn: 'ದಿನ ಮುಕ್ತಾಯಗಳು' },
  sevaSettings: { en: 'Seva settings', kn: 'ಸೇವಾ ಸೆಟ್ಟಿಂಗ್‌ಗಳು' },
  settings: { en: 'Settings', kn: 'ಸಂಯೋಜನೆಗಳು' },
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
  verifyNotice: Bi;
  verifySend: Bi;
  verifySending: Bi;
  verifySent: Bi;
  verifyFailed: Bi;
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
  // The no-access screen, for a signed-in person whose email is not verified (only a verified account becomes staff).
  verifyNotice: {
    en: 'Your email address is not verified yet. Staff access needs a verified email.',
    kn: 'ನಿಮ್ಮ ಇಮೇಲ್ ವಿಳಾಸ ಇನ್ನೂ ದೃಢೀಕರಿಸಲಾಗಿಲ್ಲ. ಸಿಬ್ಬಂದಿ ಅನುಮತಿಗೆ ದೃಢೀಕರಿಸಿದ ಇಮೇಲ್ ಬೇಕು.',
  },
  verifySend: { en: 'Send verification email', kn: 'ದೃಢೀಕರಣ ಇಮೇಲ್ ಕಳುಹಿಸಿ' },
  verifySending: { en: 'Sending...', kn: 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ...' },
  verifySent: {
    en: 'Sent - open the email and click the link, then sign out and in again',
    kn: 'ಕಳುಹಿಸಲಾಗಿದೆ - ಇಮೇಲ್ ತೆರೆದು ಲಿಂಕ್ ಒತ್ತಿ, ನಂತರ ಸೈನ್ ಔಟ್ ಮಾಡಿ ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ',
  },
  verifyFailed: {
    en: 'The email could not be sent. Try again in a minute.',
    kn: 'ಇಮೇಲ್ ಕಳುಹಿಸಲಾಗಲಿಲ್ಲ. ಒಂದು ನಿಮಿಷದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  },
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
