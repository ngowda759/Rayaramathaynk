import type { NavigationGroup } from "./types";

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
        title: "AI Assistant",
        href: "/admin/assistant",
        icon: "sparkles",
      },
    ],
  },
];
