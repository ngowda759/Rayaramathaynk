import { SEVA_ROUTES } from "@/lib/seva/routes";
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
        // The one Seva Entry item; the module's pages live in its own rail at /seva (plan A4S-3).
        title: SHELL_NAV.sevaEntry.en,
        href: SEVA_ROUTES.dashboard,
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
 * Seva Entry in the website admin (DB §3.3; plans A3-6 and A4S-3). The module has its own screens at /seva with its
 * own section rail (components/seva/shell/sections.ts); the website admin shows one "Seva Entry" item that opens it.
 * The columns are those of the role x action matrix: R = Receptionist, P = Prasadam counter, TA = Temple admin,
 * TV = Temple admin with view-only, SA = Super admin. The browser only hides; every page and API call checks again.
 * ------------------------------------------------------------------------------------------------------------------ */

export type SevaNavColumn = "R" | "P" | "TA" | "TV" | "SA";

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
  if (role === "receptionist") return SEVA_ROUTES.counter;
  if (role === "prasadam_counter") return SEVA_ROUTES.prasadam;
  return null;
}

/** The website admin's one Seva Entry item: no sub-items, it opens the module. */
function sevaEntryItem(): NavigationItem {
  return { title: SHELL_NAV.sevaEntry.en, titleKn: SHELL_NAV.sevaEntry.kn, href: SEVA_ROUTES.dashboard, icon: "receipt" };
}

/**
 * The admin sidebar with the Seva Entry item for one person.
 * - No seva role: the groups are returned unchanged (existing users keep exactly what they had).
 * - Receptionist and prasadam volunteer: one group with only the Seva Entry item.
 * - Temple admin and super admin: every existing group; the Seva Entry item keeps its place in Finance, with its
 *   Kannada label and no sub-items (the module's sections, Staff included, live in its own rail).
 */
export function withSevaNavigation(
  groups: NavigationGroup[],
  input: { column: SevaNavColumn | null },
): NavigationGroup[] {
  const { column } = input;
  if (column === null) return groups;

  if (column === "R" || column === "P") {
    return [{ title: SHELL_NAV.sevaEntry.en, items: [sevaEntryItem()] }];
  }

  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => (item.href === SEVA_ROUTES.dashboard ? sevaEntryItem() : item)),
  }));
}
