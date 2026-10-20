/**
 * Every address of the Seva Entry module (plan A4S-1). The module lives at `/seva` inside the website, with its own
 * frames; the old Receipt Book and Prasadam addresses under the website admin forward here from `next.config.ts` (a
 * unit test pins those rules to this file). Only Staff, the website admin and sign-in stay outside `/seva`.
 *
 * No runtime imports, so server files (loading.tsx, redirects in pages) and client components can both use it.
 */
import type { SevaRole } from '@/types/seva';

const ROOT = '/seva';

export const SEVA_ROUTES = {
  dashboard: ROOT,
  counter: `${ROOT}/counter`,
  today: `${ROOT}/counter/today`,
  dayClose: `${ROOT}/day-close`,
  dayCloses: `${ROOT}/day-closes`,
  register: `${ROOT}/register`,
  reports: `${ROOT}/reports`,
  reportsFestival: `${ROOT}/reports/festival`,
  reportsAudit: `${ROOT}/reports/audit`,
  reportsExport: `${ROOT}/reports/export`,
  reportsSummary: `${ROOT}/reports/summary`,
  sevaSettings: `${ROOT}/seva-settings`,
  settings: `${ROOT}/settings`,
  settingsReceipt: `${ROOT}/settings/receipt`,
  settingsCounters: `${ROOT}/settings/counters`,
  settingsRules: `${ROOT}/settings/rules`,
  settingsDenominations: `${ROOT}/settings/denominations`,
  settingsFestivalDays: `${ROOT}/settings/festival-days`,
  settingsLists: `${ROOT}/settings/lists`,
  prasadam: `${ROOT}/prasadam`,
  create: `${ROOT}/create`,
  /** Staff and roles open in the website admin's Users page (one implementation). */
  staff: '/admin/users',
  websiteAdmin: '/admin',
  signIn: '/login',
} as const;

/** One receipt's page. */
export function receiptPath(receiptId: string): string {
  return `${SEVA_ROUTES.dashboard}/${encodeURIComponent(receiptId)}`;
}

/** One receipt's print page. */
export function receiptPrintPath(receiptId: string): string {
  return `${receiptPath(receiptId)}/print`;
}

/** The prasadam page opened on one slip's token. */
export function prasadamTokenPath(token: string): string {
  return `${SEVA_ROUTES.prasadam}?token=${encodeURIComponent(token)}`;
}

/** True for `/seva` and the pages below it; false for look-alikes such as `/sevas` (the public seva page). */
export function isSevaPath(pathname: string): boolean {
  return pathname === ROOT || pathname.startsWith(`${ROOT}/`);
}

/** Where a person lands when they open Seva Entry: the counter, the prasadam page, or the dashboard. */
export function sevaHomePath(role: SevaRole | null | undefined): string {
  if (role === 'receptionist') return SEVA_ROUTES.counter;
  if (role === 'prasadam_counter') return SEVA_ROUTES.prasadam;
  return SEVA_ROUTES.dashboard;
}

/** The sign-in page, returning to `returnTo` (path and query) afterwards. */
export function signInPath(returnTo: string): string {
  return `${SEVA_ROUTES.signIn}?redirect=${encodeURIComponent(returnTo)}`;
}
