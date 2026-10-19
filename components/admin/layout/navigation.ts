import type { Bi } from "@/lib/seva/strings/common";
import { SHELL_NAV } from "@/lib/seva/strings/shell";
import type { SevaRole } from "@/types/seva";

import type { NavigationGroup, NavigationItem } from "./types";

export const navigation: NavigationGroup[] = [
  {
    title: "Dashboard",
    items: [
      {
        title: "Dashboard",
        href: "/admin",
        icon: "dashboard",
      },
    ],
  },

  {
    title: "Temple Operations",
    items: [
      {
        title: "Events",
        href: "/admin/events",
        icon: "calendar",
      },
      {
        title: "Ekadashi Calendar",
        href: "/admin/calendar/ekadashi",
        icon: "calendar",
      },
      {
        title: "Festival Calendar",
        href: "/admin/calendar/festivals",
        icon: "calendar",
      },
      {
        title: "Member / Volunteer",
        href: "/admin/sevas",
        icon: "heart",
      },
      {
        title: "Aaradhane",
        href: "/admin/aaradhane",
        icon: "flower",
      },
    ],
  },

  {
    title: "Finance",
    items: [
      {
        title: "Billing",
        href: "/admin/billing",
        icon: "billing",
      },
      {
        // Sub-items per role come from withSevaNavigation() below.
        title: "Receipt Book",
        href: "/admin/receipts",
        icon: "receipt",
      },
      {
        title: "Bookings",
        href: "/admin/bookings",
        icon: "bookings",
      },
      {
        title: "Daily Pooja",
        href: "/admin/pooja",
        icon: "book",
      },
      {
        title: "Donations",
        href: "/admin/donations",
        icon: "donation",
      },
      {
        title: "Reports",
        href: "/admin/reports",
        icon: "reports",
      },
    ],
  },

  {
    title: "Content",
    items: [
      {
        title: "Gallery",
        href: "/admin/gallery",
        icon: "image",
      },
      {
        title: "Shlokas",
        href: "/admin/shlokas",
        icon: "book",
      },
      {
        title: "Announcements",
        href: "/admin/announcements",
        icon: "bell",
      },
    ],
  },

  {
    title: "Administration",
    items: [
      {
        title: "Users",
        href: "/admin/users",
        icon: "users",
      },
      {
        title: "Homepage Settings",
        href: "/admin/settings/homepage",
        icon: "settings",
      },
      {
        title: "Finance Settings",
        href: "/admin/settings/finance",
        icon: "donation",
      },
      {
        title: "Future Plans",
        href: "/admin/settings/future-plans",
        icon: "calendar",
      },
      {
        title: "Trust Committee",
        href: "/admin/settings/trust-committee",
        icon: "users",
      },
      {
        title: "Knowledge Base",
        href: "/admin/knowledge",
        icon: "book",
      },
      {
        title: "AI Assistant",
        href: "/admin/assistant",
        icon: "sparkles",
      },
    ],
  },
];

/* ------------------------------------------------------------------------------------------------------------------
 * Seva Entry: Receipt Book sub-items and the Prasadam page per role (DB §3.3; plan A3-6).
 * The columns are those of the role x action matrix: R = Receptionist, P = Prasadam counter, TA = Temple admin,
 * TV = Temple admin with view-only, SA = Super admin. The browser only hides; every page and API call checks again.
 * ------------------------------------------------------------------------------------------------------------------ */

export type SevaNavColumn = "R" | "P" | "TA" | "TV" | "SA";

interface SevaNavEntry {
  label: Bi;
  href: string;
  icon: string;
  columns: readonly SevaNavColumn[];
}

const RECEIPT_BOOK_HREF = "/admin/receipts";
const STAFF_HREF = "/admin/users";

/** Receipt Book's pages, in sidebar order. Pages built by later tasks link correctly once they merge. */
export const RECEIPT_BOOK_PAGES: readonly SevaNavEntry[] = [
  { label: SHELL_NAV.dashboard, href: "/admin/receipts", icon: "dashboard", columns: ["TA", "TV", "SA"] },
  { label: SHELL_NAV.counter, href: "/admin/receipts/counter", icon: "receipt", columns: ["R", "TA", "SA"] },
  { label: SHELL_NAV.todayReceipts, href: "/admin/receipts/counter/today", icon: "bookings", columns: ["R", "TA", "SA"] },
  { label: SHELL_NAV.closeDay, href: "/admin/receipts/day-close", icon: "clock", columns: ["R", "TA", "SA"] },
  { label: SHELL_NAV.register, href: "/admin/receipts/register", icon: "book", columns: ["TA", "TV", "SA"] },
  { label: SHELL_NAV.reports, href: "/admin/receipts/reports", icon: "chart", columns: ["TA", "TV", "SA"] },
  { label: SHELL_NAV.dayCloses, href: "/admin/receipts/day-closes", icon: "calendar", columns: ["TA", "TV", "SA"] },
  { label: SHELL_NAV.sevaSettings, href: "/admin/receipts/seva-settings", icon: "settings", columns: ["TA", "TV", "SA"] },
  { label: SHELL_NAV.receiptSettings, href: "/admin/receipts/settings", icon: "settings", columns: ["TA", "TV", "SA"] },
];

export const PRASADAM_PAGE: SevaNavEntry = {
  label: SHELL_NAV.prasadam,
  href: "/admin/prasadam",
  icon: "flower",
  columns: ["P", "TA", "SA"],
};

/** Staff and roles stays at the existing Users page. */
export const STAFF_PAGE: SevaNavEntry = {
  label: SHELL_NAV.staffRoles,
  href: STAFF_HREF,
  icon: "users",
  columns: ["TA", "SA"],
};

/**
 * The matrix column for the sidebar. `viewOnly` is null while the seva profile is unknown; a temple admin then gets
 * the view-only column (fail closed) until /api/seva/me says otherwise. No seva role (billing, priest, staff) -> null.
 */
export function sevaNavColumn(role: SevaRole | null | undefined, viewOnly: boolean | null): SevaNavColumn | null {
  switch (role) {
    case "receptionist":
      return "R";
    case "prasadam_counter":
      return "P";
    case "temple_admin":
      return viewOnly === false ? "TA" : "TV";
    case "super_admin":
      return "SA";
    default:
      return null;
  }
}

/** Where a seva-only role lands when it opens /admin; null keeps the admin dashboard. */
export function sevaLandingPath(role: SevaRole | null | undefined): string | null {
  if (role === "receptionist") return "/admin/receipts/counter";
  if (role === "prasadam_counter") return "/admin/prasadam";
  return null;
}

function toItem(entry: SevaNavEntry): NavigationItem {
  return { title: entry.label.en, titleKn: entry.label.kn, href: entry.href, icon: entry.icon };
}

function visible(entries: readonly SevaNavEntry[], column: SevaNavColumn): NavigationItem[] {
  return entries.filter((entry) => entry.columns.includes(column)).map(toItem);
}

/**
 * The admin sidebar with the seva items for one person.
 * - No seva role: the groups are returned unchanged (existing users keep exactly what they had).
 * - Receptionist and prasadam volunteer: only their seva pages.
 * - Temple admin and super admin: every existing group; Receipt Book keeps its place in Finance and gets its
 *   sub-items, followed by Prasadam and, when the Administration section (with Users) is hidden, Staff and roles.
 */
export function withSevaNavigation(
  groups: NavigationGroup[],
  input: { column: SevaNavColumn | null; administrationShown: boolean },
): NavigationGroup[] {
  const { column } = input;
  if (column === null) return groups;

  const pages = visible(RECEIPT_BOOK_PAGES, column);
  const prasadam = visible([PRASADAM_PAGE], column);

  if (column === "R" || column === "P") {
    return [
      { title: SHELL_NAV.receiptBook.en, items: pages },
      { title: SHELL_NAV.prasadam.en, items: prasadam },
    ].filter((group) => group.items.length > 0);
  }

  const staff = input.administrationShown ? [] : visible([STAFF_PAGE], column);
  return groups.map((group) => ({
    ...group,
    items: group.items.flatMap((item) =>
      item.href === RECEIPT_BOOK_HREF
        ? [{ ...item, titleKn: SHELL_NAV.receiptBook.kn, children: pages }, ...prasadam, ...staff]
        : [item],
    ),
  }));
}
