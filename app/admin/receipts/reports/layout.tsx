"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX, ReactNode } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { REPORTS } from "@/lib/seva/strings/reports";
import { cn } from "@/lib/utils";

interface ReportsLayoutProps {
  children: ReactNode;
}

/** The tab whose page is open: the longest tab path the current path starts with. */
function activeHref(pathname: string): string | null {
  const matches = REPORTS.tabs
    .map((t) => t.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length);
  return matches[0] ?? null;
}

/**
 * Reports (DB §12.4): one heading and the tabs Seva summary, Festival view, Audit trail, Export and Board summary.
 * Each page checks its own action with SevaGate; the tabs only move between them.
 */
export default function ReportsLayout({ children }: ReportsLayoutProps): JSX.Element {
  const pathname = usePathname() ?? "";
  const active = activeHref(pathname);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <Bilingual as="h1" en={REPORTS.title.en} kn={REPORTS.title.kn} className="text-(length:--text-h2) font-semibold text-(--foreground)" />
      <nav aria-label={REPORTS.tabsLabel} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-(--border)">
          {REPORTS.tabs.map((tab) => {
            const current = tab.href === active;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex min-h-11 flex-col justify-center border-b-2 px-3 py-2 text-(length:--text-ui) font-semibold",
                    current
                      ? "border-(--primary-press) text-(--foreground)"
                      : "border-transparent text-(--muted-foreground) hover:text-(--foreground)",
                  )}
                >
                  <Bilingual en={tab.en} kn={tab.kn} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}
