"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "./navigation";
import { icons } from "./icons";
import { cn } from "@/lib/utils";

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-72 border-r bg-white flex-col">
      <div className="border-b p-6">
        <h1 className="text-xl font-bold">🏛 Temple Portal</h1>
        <p className="text-sm text-muted-foreground">
          Administration
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        {navigation.map((group) => (
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
  );
}
