"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type JSX, type ReactNode } from "react";
import { m } from "framer-motion";

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
 * Each page checks its own action with SevaGate; the tabs only move between them. One indicator marks the open tab and
 * slides with the module spring to a tab the moment it is clicked, before its report has loaded (plan A4P-3);
 * `aria-current` stays on the page actually open.
 */
export default function ReportsLayout({ children }: ReportsLayoutProps): JSX.Element {
  const pathname = usePathname() ?? "";
  const active = activeHref(pathname);
  // The tab just clicked, for the path it was clicked on: once the path changes, the open page decides again.
  const [clicked, setClicked] = useState<{ href: string; on: string } | null>(null);
  const marked = clicked && clicked.on === pathname ? clicked.href : active;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <Bilingual as="h1" en={REPORTS.title.en} kn={REPORTS.title.kn} className="text-(length:--text-h2) font-semibold text-(--foreground)" />
      <nav aria-label={REPORTS.tabsLabel} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-(--border)">
          {REPORTS.tabs.map((tab) => {
            const current = tab.href === active;
            const isMarked = tab.href === marked;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={current ? "page" : undefined}
                  onClick={() => {
                    if (!current) setClicked({ href: tab.href, on: pathname });
                  }}
                  className={cn(
                    "relative -mb-px inline-flex min-h-11 flex-col justify-center px-3 py-2 text-(length:--text-ui) font-semibold",
                    isMarked ? "text-(--foreground)" : "text-(--muted-foreground) hover:text-(--foreground)",
                  )}
                >
                  <Bilingual en={tab.en} kn={tab.kn} />
                  {isMarked ? (
                    <m.span
                      layoutId="reports-tab-indicator"
                      data-tab-indicator=""
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-(--primary-press)"
                    />
                  ) : null}
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
