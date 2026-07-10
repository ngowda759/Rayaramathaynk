"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { navigation } from "./navigation";
import { icons } from "./icons";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { canAccessSettings, canManageUsers, canAccessBilling } = useAuthContext();

  const filteredNavigation = navigation.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      // Filter based on permissions
      if (item.href.includes("/users") && !canManageUsers) {
        return false;
      }
      if (
        (item.href.includes("/settings") || item.href.includes("/finance")) &&
        !canAccessSettings
      ) {
        return false;
      }
      // Filter billing menu - only show for super_admin or billing users
      if (item.href.includes("/billing")) {
        return canAccessBilling;
      }
      return true;
    }),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 border-r bg-white flex-col fixed h-full">
        <div className="border-b p-6">
          <h1 className="text-xl font-bold">🏛 Temple Portal</h1>
          <p className="text-sm text-muted-foreground">
            Administration
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8">
          {filteredNavigation.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = icons[item.icon as keyof typeof icons];

                  const active =
                    pathname === item.href ||
                    (item.href !== "/admin" &&
                      pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                        active
                          ? "bg-orange-100 text-orange-700"
                          : "hover:bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {item.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 border-r bg-white flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile Header with Close Button */}
        <div className="flex-none border-b p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">🏛 Temple Portal</h1>
              <p className="text-sm text-muted-foreground">
                Administration
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-orange-400"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation - Scrollable */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {filteredNavigation.map((group) => (
              <div key={group.title}>
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </p>

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = icons[item.icon as keyof typeof icons];

                    const active =
                      pathname === item.href ||
                      (item.href !== "/admin" &&
                        pathname.startsWith(item.href));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                          active
                            ? "bg-orange-100 text-orange-700"
                            : "hover:bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {item.title}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>
      </aside>
    </>
  );
}
