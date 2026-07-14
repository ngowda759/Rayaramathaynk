"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Image,
  BookOpen,
  HandCoins,
  Bell,
  Users,
  Settings,
  Flame,
  ChevronRight,
} from "lucide-react";

type MenuItem = {
  title: string;
  href: string;
  icon: React.ElementType;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

const sections: MenuSection[] = [
  {
    title: "Dashboard",
    items: [
      {
        title: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Temple Management",
    items: [
      {
        title: "Events",
        href: "/admin/events",
        icon: CalendarDays,
      },
      {
        title: "Gallery",
        href: "/admin/gallery",
        icon: Image,
      },
      {
        title: "Daily Pooja",
        href: "/admin/pooja",
        icon: Flame,
      },
      {
        title: "Special Sevas",
        href: "/admin/seva-bookings",
        icon: HandCoins,
      },
      {
        title: "Aaradhane",
        href: "/admin/aaradhane",
        icon: BookOpen,
      },
    ],
  },
  {
    title: "Content",
    items: [
      {
        title: "Announcements",
        href: "/admin/announcements",
        icon: Bell,
      },
      {
        title: "Donations",
        href: "/admin/donations",
        icon: HandCoins,
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        title: "Users",
        href: "/admin/users",
        icon: Users,
      },
      {
        title: "Homepage Settings",
        href: "/admin/settings/homepage",
        icon: Settings,
      },
      {
        title: "Admin Assistant",
        href: "/admin/assistant",
        icon: Bell,
      },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-72 flex-col border-r bg-white">
      <div className="border-b p-6">
        <h1 className="text-2xl font-bold text-orange-600">
          🛕 Temple Admin
        </h1>

        <p className="mt-1 text-sm text-stone-500">
          Sri Raghavendra Swamy Temple
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-8">
            <h2 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-stone-400">
              {section.title}
            </h2>

            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;

                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 transition-all ${
                      active
                        ? "bg-orange-100 text-orange-700 font-semibold"
                        : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </div>

                    {active && (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-4 text-center text-xs text-stone-500">
        Temple Management Portal
        <br />
        Version 1.0
      </div>
    </aside>
  );
}
