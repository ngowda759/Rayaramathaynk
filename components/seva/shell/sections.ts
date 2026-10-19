/**
 * The sections of Seva Entry's own frame at /seva (plan A4S-2): what the section rail, the phone bar and the header
 * offer each person. The columns are those of the role x action matrix (`SevaNavColumn`: R = Receptionist,
 * P = Prasadam counter, TA = Temple admin, TV = Temple admin with view-only, SA = Super admin), the same as the admin
 * sidebar's Receipt Book, Prasadam and Staff entries. The frame only hides; every page and API call checks again.
 */
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CalendarCheck,
  ChartColumn,
  Flower2,
  LayoutDashboard,
  Receipt,
  Settings,
  SlidersHorizontal,
  Users,
} from 'lucide-react';

import { sevaNavColumn, type SevaNavColumn } from '@/components/admin/layout/navigation';
import { isSevaPath, SEVA_ROUTES } from '@/lib/seva/routes';
import type { Bi } from '@/lib/seva/strings/common';
import { SHELL_NAV } from '@/lib/seva/strings/shell';
import type { SevaMe, SevaRole } from '@/types/seva';

export type SevaSectionId =
  | 'dashboard'
  | 'counter'
  | 'prasadam'
  | 'register'
  | 'dayCloses'
  | 'reports'
  | 'sevaSettings'
  | 'settings'
  | 'staff';

export interface SevaSection {
  id: SevaSectionId;
  label: Bi;
  href: string;
  icon: LucideIcon;
  columns: readonly SevaNavColumn[];
  /** Shown in the phone bar itself; the others go under More. */
  phone: boolean;
  /** Opens outside the module (the website admin's Users page). */
  leavesModule?: true;
}

const DESK: readonly SevaNavColumn[] = ['TA', 'TV', 'SA'];

/** Every section, in rail order. */
export const SEVA_SECTIONS: readonly SevaSection[] = [
  { id: 'dashboard', label: SHELL_NAV.dashboard, href: SEVA_ROUTES.dashboard, icon: LayoutDashboard, columns: DESK, phone: true },
  { id: 'counter', label: SHELL_NAV.counter, href: SEVA_ROUTES.counter, icon: Receipt, columns: ['R', 'TA', 'SA'], phone: false },
  { id: 'prasadam', label: SHELL_NAV.prasadam, href: SEVA_ROUTES.prasadam, icon: Flower2, columns: ['P', 'TA', 'SA'], phone: false },
  { id: 'register', label: SHELL_NAV.register, href: SEVA_ROUTES.register, icon: BookOpen, columns: DESK, phone: true },
  { id: 'dayCloses', label: SHELL_NAV.dayCloses, href: SEVA_ROUTES.dayCloses, icon: CalendarCheck, columns: DESK, phone: false },
  { id: 'reports', label: SHELL_NAV.reports, href: SEVA_ROUTES.reports, icon: ChartColumn, columns: DESK, phone: true },
  {
    id: 'sevaSettings',
    label: SHELL_NAV.sevaSettings,
    href: SEVA_ROUTES.sevaSettings,
    icon: SlidersHorizontal,
    columns: DESK,
    phone: false,
  },
  { id: 'settings', label: SHELL_NAV.receiptSettings, href: SEVA_ROUTES.settings, icon: Settings, columns: DESK, phone: false },
  {
    id: 'staff',
    label: SHELL_NAV.staffRoles,
    href: SEVA_ROUTES.staff,
    icon: Users,
    columns: ['TA', 'SA'],
    phone: false,
    leavesModule: true,
  },
];

/** The sections one matrix column may open, in rail order. No seva role (null) gets none. */
export function sectionsFor(column: SevaNavColumn | null): SevaSection[] {
  if (column === null) return [];
  return SEVA_SECTIONS.filter((section) => section.columns.includes(column));
}

/**
 * The column the frame draws for, by the admin sidebar's rule: the seva profile once it is known, otherwise the seva
 * role with view-only unknown, so a temple admin gets the view-only column until the profile says otherwise.
 */
export function frameColumn(me: SevaMe | null, sevaRole: SevaRole | null | undefined): SevaNavColumn | null {
  return me ? sevaNavColumn(me.role, me.viewOnly) : sevaNavColumn(sevaRole, null);
}

/** The columns that see the website admin link. */
export const WEBSITE_ADMIN_COLUMNS: readonly SevaNavColumn[] = DESK;

/**
 * The section the open page belongs to:
 * - `/seva` itself is the dashboard;
 * - the counter's pages and Close day belong to the counter;
 * - otherwise the longest section address the path equals or sits under;
 * - any other page under `/seva` (one receipt, its print page, the old create page) belongs to the register;
 * - a path outside `/seva` belongs to none.
 */
export function currentSectionId(pathname: string): SevaSectionId | null {
  if (!isSevaPath(pathname)) return null;
  if (pathname === SEVA_ROUTES.dashboard) return 'dashboard';
  if (pathname === SEVA_ROUTES.dayClose || pathname.startsWith(`${SEVA_ROUTES.dayClose}/`)) return 'counter';
  const match = SEVA_SECTIONS.filter(
    (section) =>
      section.href !== SEVA_ROUTES.dashboard && (pathname === section.href || pathname.startsWith(`${section.href}/`)),
  ).sort((a, b) => b.href.length - a.href.length)[0];
  return match ? match.id : 'register';
}
