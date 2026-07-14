"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { X, ChevronDown, LayoutDashboard, Calendar, Heart, Clock, Flower2, BookOpen, Images, Bell, Users, Settings, Sparkles, Receipt, ClipboardList, FileText, Info } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
      { title: "Facilities", href: "/admin/settings/facilities", icon: "info" },
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
      { title: "Homepage Settings", href: "/admin/settings/homepage", icon: "settings" },
      { title: "Finance Settings", href: "/admin/settings/finance", icon: "donation" },
      { title: "Trust Committee", href: "/admin/settings/trust-committee", icon: "users" },
      { title: "AI Assistant", href: "/admin/assistant", icon: "sparkles" },
      { title: "AI Settings", href: "/admin/ai/settings", icon: "settings" },
    ],
  },
];

// Filter navigation based on user permissions
function getFilteredNavigation(canManageUsers: boolean, canAccessAdministration: boolean, canAccessSettings: boolean, canAccessFinance: boolean) {
  const filtered = allNavigation.map((section) => {
    // Filter items based on permissions
    const filteredItems = section.items;
    
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

  // Get filtered navigation based on user permissions (memoized to prevent infinite loops)
  const navigation = useMemo(() => 
    getFilteredNavigation(canManageUsers || false, canAccessAdministration || false, canAccessSettings || false, canAccessFinance || false),
    [canManageUsers, canAccessAdministration, canAccessSettings, canAccessFinance]
  );

  // Initialize expanded state - show all groups
  useEffect(() => {
    const expanded: Record<string, boolean> = {};
    navigation.forEach((group) => {
      expanded[group.title] = true; // Show all groups expanded
    });
    // Use setTimeout to avoid synchronous state update during effect
    setTimeout(() => setExpandedGroups(expanded), 0);
  }, [navigation]);

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-68 bg-gradient-to-b from-white via-amber-50/50 to-orange-50/40 lg:border-r lg:border-amber-200/60 shadow-xl shadow-amber-500/10">
        {/* Decorative top border */}
        <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
        
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-amber-200/50 bg-gradient-to-r from-amber-50/50 to-orange-50/30 px-5 py-5">
          <div className="relative">
            <Image
              src="/images/logos/ynk_matha_logo.png"
              alt="Sri Raghavendra Swamy Matha"
              width={40}
              height={40}
              className="rounded-full shadow-lg ring-2 ring-amber-200"
            />
            <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold text-stone-800">Temple Admin</h1>
            <p className="text-xs text-amber-600 font-medium">Administration Panel</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          {navigation.map((group) => (
            <div key={group.title} className="mb-5">
              <button
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider text-amber-700 hover:text-amber-900 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-amber-500" />
                  {group.title}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    expandedGroups[group.title] ? "rotate-180" : ""
                  )}
                />
              </button>
              
              <AnimatePresence>
                {expandedGroups[group.title] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1.5 space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = iconMap[item.icon] || LayoutDashboard;
                        const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                        return (
                          <a
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer",
                              isActive
                                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25"
                                : "text-stone-600 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 hover:text-amber-800"
                            )}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-white" />
                            )}
                            <Icon className={cn(
                              "h-4 w-4 transition-transform group-hover:scale-110",
                              isActive ? "" : "text-amber-600"
                            )} />
                            <span>{item.title}</span>
                            {isActive && (
                              <div className="ml-auto">
                                <div className="h-1.5 w-1.5 rounded-full bg-white/80" />
                              </div>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>
        
        {/* Footer */}
        <div className="border-t border-amber-200/50 p-4">
          <p className="text-center text-xs text-stone-400">ॐ Sri Raghavendraya Namaha ॐ</p>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Drawer */}
      <motion.aside
        initial={{ x: -288 }}
        animate={{ x: isOpen ? 0 : -288 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed inset-y-0 left-0 z-[70] w-72 bg-white shadow-2xl lg:hidden flex flex-col overflow-hidden"
        style={{ height: "100dvh" }}
      >
        {/* Decorative top border */}
        <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-200/50 bg-gradient-to-r from-amber-50/50 to-orange-50/30 px-5 py-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Image
                src="/images/logos/ynk_matha_logo.png"
                alt="Temple"
                width={40}
                height={40}
                className="rounded-full shadow-lg ring-2 ring-amber-200"
              />
              <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-bold text-stone-800">Temple Admin</h1>
              <p className="text-xs text-amber-600 font-medium">Administration</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-amber-100 cursor-pointer transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-stone-600" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navigation.map((group) => (
            <div key={group.title} className="mb-3">
              <button
                type="button"
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-xl cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-amber-500" />
                  {group.title}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    expandedGroups[group.title] ? "rotate-180" : ""
                  )}
                />
              </button>
              
              <AnimatePresence>
                {expandedGroups[group.title] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1.5 space-y-0.5">
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
                              "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer",
                              isActive
                                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg"
                                : "text-stone-600 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 hover:text-amber-800"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>
        
        {/* Footer */}
        <div className="border-t border-amber-200/50 p-4">
          <p className="text-center text-xs text-stone-400">ॐ Sri Raghavendraya Namaha ॐ</p>
        </div>
      </motion.aside>
    </>
  );
}
