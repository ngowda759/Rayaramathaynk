"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X, ChevronDown, LayoutDashboard, Calendar, Heart, Clock, Flower2, BookOpen, Images, Bell, Users, Settings, Sparkles, Receipt, ClipboardList, FileText, Info } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  flower: Flower2,
  book: BookOpen,
  heart: Heart,
  donation: Heart,
  calendar: Calendar,
  clock: Clock,
  image: Images,
  bell: Bell,
  users: Users,
  settings: Settings,
  sparkles: Sparkles,
  reports: Receipt,
  bookings: ClipboardList,
  billing: FileText,
  info: Info,
};

// Navigation data
const navigation = [
  {
    title: "Dashboard",
    items: [
      { title: "Dashboard", href: "/admin", icon: "dashboard" },
    ],
  },
  {
    title: "Temple Operations",
    items: [
      { title: "Events", href: "/admin/events", icon: "calendar" },
      { title: "Member / Volunteer", href: "/admin/sevas", icon: "heart" },
      { title: "Temple Timings", href: "/admin/timings", icon: "clock" },
      { title: "Aaradhane", href: "/admin/aaradhane", icon: "flower" },
    ],
  },
  {
    title: "Finance",
    items: [
      { title: "Billing", href: "/admin/billing", icon: "billing" },
      { title: "Bookings", href: "/admin/bookings", icon: "bookings" },
      { title: "Daily Pooja", href: "/admin/pooja", icon: "book" },
      { title: "Donations", href: "/admin/donations", icon: "donation" },
      { title: "Reports", href: "/admin/reports", icon: "reports" },
    ],
  },
  {
    title: "Content",
    items: [
      { title: "Gallery", href: "/admin/gallery", icon: "image" },
      { title: "Announcements", href: "/admin/announcements", icon: "bell" },
      { title: "About Us", href: "/admin/settings/about", icon: "info" },
      { title: "Guru Parampara", href: "/admin/settings/guru-parampara", icon: "book" },
      { title: "Shlokas", href: "/admin/settings/shlokas", icon: "book" },
      { title: "Footer Settings", href: "/admin/settings/footer", icon: "settings" },
      { title: "Social Links", href: "/admin/settings/social-links", icon: "settings" },
      { title: "Pooja Schedule", href: "/admin/settings/puja-schedule", icon: "calendar" },
      { title: "Future Plans", href: "/admin/settings/future-plans", icon: "calendar" },
      { title: "Ekadashi Calendar", href: "/admin/settings/ekadashi-calendar", icon: "calendar" },
      { title: "Festival Calendar", href: "/admin/settings/festival-calendar", icon: "calendar" },
    ],
  },
  {
    title: "Administration",
    items: [
      { title: "Users", href: "/admin/users", icon: "users" },
      { title: "General Settings", href: "/admin/settings", icon: "settings" },
      { title: "Homepage Settings", href: "/admin/settings/homepage", icon: "settings" },
      { title: "Finance Settings", href: "/admin/settings/finance", icon: "donation" },
      { title: "Trust Committee", href: "/admin/settings/trust-committee", icon: "users" },
      { title: "AI Assistant", href: "/admin/assistant", icon: "sparkles" },
    ],
  },
];

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isExpanded, setIsExpanded] = useState(true); // Sidebar expanded by default

  // Initialize expanded state - show Dashboard and current section
  useEffect(() => {
    const expanded: Record<string, boolean> = {};
    navigation.forEach((group) => {
      const isActive = group.items.some(
        (item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
      );
      expanded[group.title] = isActive || group.title === "Dashboard" || group.title === "Temple Operations";
    });
    setExpandedGroups(expanded);
  }, [pathname]);

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const NavItem = ({ href, title, icon, onClick }: { href: string; title: string; icon: string; onClick?: () => void }) => {
    const Icon = iconMap[icon] || LayoutDashboard;
    const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(href));

    return (
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-orange-50 text-orange-600 font-semibold"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{title}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:bg-white lg:border-r lg:border-gray-200">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-4">
          <Image
            src="/images/logos/ynk_matha_logo.png"
            alt="Sri Raghavendra Swamy Matha"
            width={36}
            height={36}
            className="rounded-full"
          />
          <div>
            <h1 className="text-sm font-semibold text-gray-900">Temple Portal</h1>
            <p className="text-xs text-gray-500">Administration</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navigation.map((group) => (
            <div key={group.title} className="mb-4">
              <button
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600"
              >
                <span>{group.title}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    expandedGroups[group.title] ? "rotate-180" : ""
                  )}
                />
              </button>
              
              {expandedGroups[group.title] && (
                <div className="mt-1 space-y-1">
                  {group.items.map((item) => (
                    <NavItem key={item.href} {...item} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile Sidebar Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transition-transform duration-300 lg:hidden flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          height: "100dvh",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Header - fixed at top, not part of scroll */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-gray-200 px-4 py-4">
          <Link href="/admin" onClick={onClose} className="flex items-center gap-3">
            <Image
              src="/images/logos/ynk_matha_logo.png"
              alt="Sri Raghavendra Swamy Matha"
              width={36}
              height={36}
              className="rounded-full"
            />
            <div>
              <h1 className="text-sm font-semibold text-gray-900">Temple Portal</h1>
              <p className="text-xs text-gray-500">Administration</p>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Navigation - this is the scroll container */}
        <nav 
          className="flex-1 overflow-y-auto px-3 py-4"
          style={{
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {navigation.map((group) => (
            <div key={group.title} className="mb-4">
              <button
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600"
              >
                <span>{group.title}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    expandedGroups[group.title] ? "rotate-180" : ""
                  )}
                />
              </button>
              
              {expandedGroups[group.title] && (
                <div className="mt-1 space-y-1">
                  {group.items.map((item) => (
                    <NavItem key={item.href} {...item} onClick={onClose} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}
