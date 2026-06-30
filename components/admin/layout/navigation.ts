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
        title: "Sevas",
        href: "/admin/sevas",
        icon: "heart",
      },
      {
        title: "Bookings",
        href: "/admin/bookings",
        icon: "bookings",
      },
      {
        title: "Temple Timings",
        href: "/admin/timings",
        icon: "clock",
      },
      {
        title: "Daily Pooja",
        href: "/admin/pooja",
        icon: "book",
      },
      {
        title: "Aaradhane",
        href: "/admin/aaradhane",
        icon: "flower",
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
        title: "Announcements",
        href: "/admin/announcements",
        icon: "bell",
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
    title: "Administration",
    items: [
      {
        title: "Users",
        href: "/admin/users",
        icon: "users",
      },
      {
        title: "General Settings",
        href: "/admin/settings",
        icon: "settings",
      },
      {
        title: "Homepage Settings",
        href: "/admin/settings/homepage",
        icon: "settings",
      },
      {
        title: "AI Assistant",
        href: "/admin/assistant",
        icon: "sparkles",
      },
    ],
  },
];
