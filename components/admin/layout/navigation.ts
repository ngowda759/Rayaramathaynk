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
        title: "Aaradhane",
        href: "/admin/aaradhane",
        icon: "flower",
      },
      {
        title: "Poojas",
        href: "/admin/pooja",
        icon: "book",
      },
      {
        title: "Sevas",
        href: "/admin/sevas",
        icon: "heart",
      },
      {
        title: "Donations",
        href: "/admin/donations",
        icon: "donation",
      },
      {
        title: "Events",
        href: "/admin/events",
        icon: "calendar",
      },
      {
        title: "Temple Timings",
        href: "/admin/timings",
        icon: "clock",
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
        title: "Settings",
        href: "/admin/settings",
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
