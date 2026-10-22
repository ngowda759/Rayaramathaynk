/**
 * Words of the Staff and roles page (DB §3.4, §13.6): the list, the onboard dialog and the staff drawer. Labels are
 * English with Kannada under it (C-49); longer hints and messages are English. Kannada is to be proof-read by the
 * temple office (O-03).
 */
import type { SevaRole } from '@/types/seva';
import type { StaffChangeStep, StaffStatus } from '@/types/seva-staff';
import type { Bi } from './common';

/** The four seva roles in the order they are offered. */
export const STAFF_ROLES: readonly SevaRole[] = ['receptionist', 'prasadam_counter', 'temple_admin', 'super_admin'];

export const STAFF_ROLE_LABEL: Record<SevaRole, Bi> = {
  receptionist: { en: 'Receptionist', kn: 'ಸ್ವಾಗತಕಾರ' },
  prasadam_counter: { en: 'Prasadam counter', kn: 'ಪ್ರಸಾದ ಕೌಂಟರ್' },
  temple_admin: { en: 'Temple admin', kn: 'ದೇವಸ್ಥಾನ ನಿರ್ವಾಹಕ' },
  super_admin: { en: 'Super admin', kn: 'ಮುಖ್ಯ ನಿರ್ವಾಹಕ' },
};

/** What each role does (DB §3.1), shown under the role in the drawer. */
export const STAFF_ROLE_HINT: Record<SevaRole, string> = {
  receptionist: 'Makes receipts, cancels own within 30 minutes, closes the day.',
  prasadam_counter: 'Scans or types a receipt number; marks prasadam given.',
  temple_admin: 'Dashboard, reports, sevas, settings; onboards staff.',
  super_admin: 'Everything, including offboarding and deleting users.',
};

export const STAFF_STATUS_LABEL: Record<StaffStatus, Bi> = {
  invited: { en: 'Invited', kn: 'ಆಹ್ವಾನಿತ' },
  active: { en: 'Active', kn: 'ಸಕ್ರಿಯ' },
  inactive: { en: 'Inactive', kn: 'ನಿಷ್ಕ್ರಿಯ' },
  deleted: { en: 'Deleted', kn: 'ಅಳಿಸಲಾಗಿದೆ' },
};

/**
 * The steps of a staff change, for a partial failure (StaffPartialFailure): the three server steps in their order
 * (DB §3.2) and the set-password email the page sends after an onboarding (C-56).
 */
export type StaffStepName = StaffChangeStep | 'email';

export const STAFF_STEP_LABEL: Record<StaffStepName, string> = {
  identity: 'Sign-in account (login and role)',
  staff: 'Staff record',
  audit: 'Audit trail entry',
  email: 'Set-password email',
};

/** The writes inside a step that `partly` can name. */
export const STAFF_WRITE_LABEL: Record<string, string> = {
  login: 'login',
  profile: 'role and active flag',
  row: 'record',
};

export const STAFF_TEXT = {
  tabStaff: { en: 'Staff and roles', kn: 'ಸಿಬ್ಬಂದಿ ಮತ್ತು ಪಾತ್ರಗಳು' } as Bi,
  tabAccounts: { en: 'All accounts', kn: 'ಎಲ್ಲಾ ಖಾತೆಗಳು' } as Bi,
  pageTitle: { en: 'Staff and roles', kn: 'ಸಿಬ್ಬಂದಿ ಮತ್ತು ಪಾತ್ರಗಳು' } as Bi,
  onboardButton: { en: 'Onboard staff', kn: 'ಸಿಬ್ಬಂದಿ ಸೇರಿಸಿ' } as Bi,
  searchLabel: 'Search staff',
  searchPlaceholder: 'Search name or staff no.',
  filterLabel: 'Status',
  filterAll: { en: 'All', kn: 'ಎಲ್ಲಾ' } as Bi,
  filterActive: { en: 'Active', kn: 'ಸಕ್ರಿಯ' } as Bi,
  filterInactive: { en: 'Inactive', kn: 'ನಿಷ್ಕ್ರಿಯ' } as Bi,
  inactiveLine: 'Inactive staff cannot sign in and stay for the audit trail.',
  colStaffNo: { en: 'Staff no.', kn: 'ಸಿಬ್ಬಂದಿ ಸಂಖ್ಯೆ' } as Bi,
  colName: { en: 'Name', kn: 'ಹೆಸರು' } as Bi,
  colRole: { en: 'Role', kn: 'ಪಾತ್ರ' } as Bi,
  colStatus: { en: 'Status', kn: 'ಸ್ಥಿತಿ' } as Bi,
  colLastActive: { en: 'Last active', kn: 'ಕೊನೆಯ ಚಟುವಟಿಕೆ' } as Bi,
  colActions: 'Actions',
  viewOnly: { en: 'View-only', kn: 'ನೋಡಲು ಮಾತ್ರ' } as Bi,
  noRole: 'No seva role',
  you: 'You',
  superAdminOnly: 'Super admin only',
  open: 'Open',
  reactivate: { en: 'Reactivate', kn: 'ಮತ್ತೆ ಸಕ್ರಿಯಗೊಳಿಸಿ' } as Bi,
  loading: 'Loading staff...',
  loadFailed: 'Could not load the staff list.',
  tryAgain: 'Try again',
  empty: 'No staff match.',
  never: 'Not yet',
  invitedNotSignedIn: (when: string): string => `Invited ${when}, not signed in yet`,
  peopleCount: (total: number, active: number): string =>
    `${total} ${total === 1 ? 'person' : 'people'} · ${active} active`,
  rowActionsFor: (name: string): string => `Open ${name}`,
  reactivateFor: (name: string): string => `Reactivate ${name}`,

  // Onboard dialog
  onboardTitle: { en: 'Onboard staff', kn: 'ಸಿಬ್ಬಂದಿ ಸೇರಿಸಿ' } as Bi,
  staffNo: 'Staff no.',
  staffNoHint: 'The next free number. Numbers are never reused.',
  fullName: 'Full name',
  fullNamePlaceholder: 'e.g. Meera Bhat',
  email: 'Email',
  emailPlaceholder: 'name@example.com',
  role: { en: 'Role', kn: 'ಪಾತ್ರ' } as Bi,
  viewOnlyOnboardHint: 'For temple admins who only need to look.',
  viewOnlyDrawerHint: 'Sees everything, changes nothing. For temple admins.',
  viewOnlyTempleAdminsOnly: 'View-only is for temple admins only.',
  signInLine: 'They get an email and sign in with Google, or with this email and a password.',
  sendInvite: 'Send invite',
  sending: 'Sending...',
  cancel: 'Cancel',
  close: 'Close',
  superAdminRoleNote: 'Only a super admin can give the Super admin role.',
  needName: 'Enter the full name',
  needEmail: 'Enter a valid email address',
  needStaffNo: 'Enter a staff no. from 1 to 999',
  inviteSent: (staffNo: string): string => `Invite sent · staff no. ${staffNo}`,
  inviteSentHint: 'They can sign in once they open the email.',
  emailNotSent: (staffNo: string): string =>
    `Staff no. ${staffNo} is onboarded, but the set-password email was not sent.`,
  sendEmailAgain: 'Send the email again',

  // Onboard dialog: the email already has a website account (link it instead of making a new login)
  linkTitle: { en: 'Existing website account', kn: 'ಈಗಿರುವ ವೆಬ್‌ಸೈಟ್ ಖಾತೆ' } as Bi,
  linkQuestion: (who: string, currentRole: string, newRole: string): Bi => ({
    en: `${who} already has a website account (current role: ${currentRole}). Add them as staff and set their role to ${newRole}? They keep their password.`,
    kn: `${who} ಅವರಿಗೆ ಈಗಾಗಲೇ ವೆಬ್‌ಸೈಟ್ ಖಾತೆ ಇದೆ (ಈಗಿನ ಪಾತ್ರ: ${currentRole}). ಅವರನ್ನು ಸಿಬ್ಬಂದಿಯಾಗಿ ಸೇರಿಸಿ, ಪಾತ್ರವನ್ನು ${newRole} ಎಂದು ಬದಲಿಸಬೇಕೆ? ಅವರ ಪಾಸ್‌ವರ್ಡ್ ಬದಲಾಗುವುದಿಲ್ಲ.`,
  }),
  linkNoRole: 'none',
  linkConfirm: { en: 'Link this account', kn: 'ಈ ಖಾತೆಯನ್ನು ಜೋಡಿಸಿ' } as Bi,
  linkCancel: { en: 'Cancel', kn: 'ರದ್ದುಮಾಡಿ' } as Bi,
  linking: 'Linking...',
  linked: (staffNo: string): string => `Account linked · staff no. ${staffNo}`,
  linkedHint: 'They can sign in with their existing password.',
  linkInactive: {
    en: 'This account is currently inactive; linking makes it active.',
    kn: 'ಈ ಖಾತೆ ಈಗ ನಿಷ್ಕ್ರಿಯವಾಗಿದೆ; ಜೋಡಿಸಿದರೆ ಅದು ಸಕ್ರಿಯವಾಗುತ್ತದೆ.',
  } as Bi,
  /**
   * Anyone can register a login for any email, so only a verified one is linked. The person sends themselves the
   * verification email again from the /seva no-access screen (components/seva/shell/VerifyEmailNotice.tsx).
   */
  linkUnverified: {
    en: "This person's email is not verified. Ask them to sign in at the website, open /seva and click Send verification email, then click the link in that email. Then try again.",
    kn: 'ಈ ವ್ಯಕ್ತಿಯ ಇಮೇಲ್ ದೃಢೀಕರಿಸಲಾಗಿಲ್ಲ. ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ಸೈನ್ ಇನ್ ಮಾಡಿ, /seva ತೆರೆದು "Send verification email" ಒತ್ತಲು ಅವರಿಗೆ ಹೇಳಿ, ನಂತರ ಆ ಇಮೇಲ್‌ನ ಲಿಂಕ್ ಒತ್ತಲು ಹೇಳಿ. ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  } as Bi,
  linkDisabled: {
    en: 'This email has a website account, but its sign-in is switched off, so it cannot be linked. Ask the site owner to switch it on first (Firebase console, Authentication, Users), or use a different email.',
    kn: 'ಈ ಇಮೇಲ್‌ಗೆ ವೆಬ್‌ಸೈಟ್ ಖಾತೆ ಇದೆ, ಆದರೆ ಅದರ ಸೈನ್ ಇನ್ ನಿಲ್ಲಿಸಲಾಗಿದೆ, ಆದ್ದರಿಂದ ಜೋಡಿಸಲು ಆಗುವುದಿಲ್ಲ. ಮೊದಲು ಅದನ್ನು ಆನ್ ಮಾಡಲು ಸೈಟ್ ಮಾಲೀಕರಿಗೆ ಹೇಳಿ, ಅಥವಾ ಬೇರೆ ಇಮೇಲ್ ಬಳಸಿ.',
  } as Bi,
  /** 403 `needs_super_admin`: the existing account holds a website admin-console role or is inactive (C-62). */
  linkNeedsSuperAdmin: {
    en: 'Only a super admin can add this account: it already has a website admin role or is switched off.',
    kn: 'ಈ ಖಾತೆಯನ್ನು ಮುಖ್ಯ ನಿರ್ವಾಹಕರು ಮಾತ್ರ ಸೇರಿಸಬಹುದು: ಇದಕ್ಕೆ ಈಗಾಗಲೇ ವೆಬ್‌ಸೈಟ್ ನಿರ್ವಾಹಕ ಪಾತ್ರ ಇದೆ ಅಥವಾ ಇದು ನಿಷ್ಕ್ರಿಯವಾಗಿದೆ.',
  } as Bi,

  // Drawer
  staffNoLine: (staffNo: string, email: string): string => `Staff no. ${staffNo} · ${email}`,
  save: 'Save',
  saving: 'Saving...',
  saved: (name: string): string => `${name} is updated`,
  roleReadOnly: 'You cannot change this person\'s role.',
  selfNote: 'You cannot change your own role or status here.',
  deletedNote: 'Deleted. The record, name and staff no. stay for the audit trail.',
  invitedNote: 'Invited - has not signed in yet.',
  inactiveNote: 'Inactive - cannot sign in.',
  reactivateSuperAdminNote: 'Only a super admin can reactivate a super admin.',
  reactivated: (name: string): string => `${name} is active again`,
  reactivatedHint: (staffNo: string): string => `Same staff no. ${staffNo}. No new onboarding needed.`,
  superActionsTitle: 'Super admin actions',
  superActionsHint: 'Both need a reason and go into the audit trail.',
  superActionsByOthers: 'Offboarding and deleting a user are done by a super admin.',
  offboard: 'Offboard (deactivate)',
  offboardReason: (name: string): string => `Why is ${name} being offboarded? (required)`,
  offboardPlaceholder: 'e.g. stepped down from the committee',
  offboardHint: (staffNo: string): string =>
    `They can no longer sign in. Their records and staff no. ${staffNo} stay; they can be reactivated later.`,
  offboardConfirm: (name: string): string => `Deactivate ${name}`,
  offboarded: (name: string): string => `${name} is offboarded`,
  remove: 'Delete user',
  removeWarnTitle: 'Deactivating is usually right.',
  removeWarn: 'Past receipts keep the name and staff no. Deleting removes the login for good and cannot be undone.',
  removeReason: 'Why delete rather than deactivate? (required)',
  removePlaceholder: 'e.g. account created by mistake',
  removeConfirm: 'Delete user',
  removed: (name: string): string => `${name} is deleted`,
  reasonMin: 'Give a reason (at least 3 characters)',

  // Partial failure (DB §3.2: never silent)
  partialTitle: 'The change went only part of the way',
  partialDone: 'Done',
  partialFailed: 'Failed at',
  partialNothingDone: 'nothing',
  partialPartly: (writes: string): string => `only the ${writes} went through`,
  partialHint: 'Nothing was undone. Check this person in the list and finish the change, or ask the super admin.',

  noAccess: { en: 'You do not have access to Staff and roles.', kn: 'ಸಿಬ್ಬಂದಿ ಮತ್ತು ಪಾತ್ರಗಳನ್ನು ತೆರೆಯಲು ನಿಮಗೆ ಅನುಮತಿ ಇಲ್ಲ.' } as Bi,
  noAccessHint: 'Temple admins and super admins manage staff. The All accounts tab still lists every account.',
};

/** Staff numbers are shown with three digits: 7 -> '007'. */
export function staffNoText(no: number): string {
  return String(no).padStart(3, '0');
}
