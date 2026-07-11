"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { X, ChevronDown, LayoutDashboard, Calendar, Heart, Clock, Flower2, BookOpen, Images, Bell, Users, Settings, Sparkles, Receipt, ClipboardList, FileText, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuthContext } from "@/context/AuthContext";
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
const allNavigation = [
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

// Filter navigation based on user permissions
function getFilteredNavigation(canManageUsers: boolean, canAccessAdministration: boolean, canAccessSettings: boolean, canAccessFinance: boolean) {
  const filtered = allNavigation.map((section) => {
    // Filter items based on permissions
    let filteredItems = section.items;
    
    if (section.title === "Administration") {
      // Only show Administration section to super_admin
      if (!canAccessAdministration) {
        return null;
      }
    }
    
    return {
      ...section,
      items: filteredItems,
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);
  
  return filtered;
}

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { canManageUsers, canAccessAdministration, canAccessSettings, canAccessFinance } = useAuthContext();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isExpanded, setIsExpanded] = useState(true); // Sidebar expanded by default

  // Get filtered navigation based on user permissions
  const navigation = getFilteredNavigation(canManageUsers || false, canAccessAdministration || false, canAccessSettings || false, canAccessFinance || false);

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
  }, [pathname, navigation]);

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:bg-gradient-to-b lg:from-white lg:to-amber-50 lg:border-r lg:border-amber-200">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-4">
          <Image
            src="/images/logos/ynk_matha_logo.png"
            alt="Sri Raghavendra Swamy Matha"
            width={36}
            height={36}
            className="rounded-full shadow-sm"
          />
          <div>
            <h1 className="text-sm font-bold text-stone-800">Temple Admin</h1>
            <p className="text-xs text-amber-600">Administration</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navigation.map((group) => (
            <div key={group.title} className="mb-4">
              <button
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 hover:text-amber-900"
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
                  {group.items.map((item) => {
                    const Icon = iconMap[item.icon] || LayoutDashboard;
                    const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                          isActive
                            ? "bg-amber-100 text-amber-800 font-semibold border-r-2 border-amber-600"
                            : "text-stone-600 hover:bg-amber-50 hover:text-amber-800"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300 lg:hidden",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile Sidebar Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[70] w-72 bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-4 flex-shrink-0">
          <button 
            type="button" 
            onClick={onClose} 
            className="flex items-center gap-3 cursor-pointer"
          >
            <Image
              src="/images/logos/ynk_matha_logo.png"
              alt="Temple"
              width={36}
              height={36}
              className="rounded-full shadow-sm"
            />
            <div className="text-left">
              <h1 className="text-sm font-bold text-stone-800">Temple Admin</h1>
              <p className="text-xs text-amber-600">Administration</p>
            </div>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-amber-100 cursor-pointer"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-stone-600" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navigation.map((group) => (
            <div key={group.title} className="mb-2">
              <button
                type="button"
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center justify-between px-2 py-2 text-xs font-semibold uppercase tracking-wider text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg cursor-pointer"
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
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = iconMap[item.icon] || LayoutDashboard;
                    const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                    return (
                      <button
                        type="button"
                        key={item.href}
                        onClick={() => {
                          onClose();
                          window.location.href = item.href;
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                          isActive
                            ? "bg-amber-100 text-amber-800 font-semibold"
                            : "text-stone-600 hover:bg-amber-50 hover:text-amber-800"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
