"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX, ReactNode } from "react";

import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { SETTINGS_TABS, SETTINGS_TEXT as T } from "@/lib/seva/strings/settings";
import { cn } from "@/lib/utils";

/**
 * Settings (DB §13, mockup `settings-devotee.html` tabs): one heading and the tabs Receipts, Counters, Counter rules,
 * Denominations and Festival days. Every settings page reads through `/api/seva/settings/*`, which temple admins,
 * view-only temple admins and super admins may read (`reports.view`); each page decides itself whether it may edit
 * (`settings.edit`). The tabs are links, so each section has its own address.
 */
export default function SettingsLayout({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname();

  return (
    <SevaGate action="reports.view">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 p-4 sm:p-6">
        <div className="flex flex-col gap-1">
          <Bilingual as="h1" en={T.settingsTitle.en} kn={T.settingsTitle.kn} className="text-(length:--text-h1) font-semibold" />
          <p className="text-(length:--text-meta) text-(--muted-foreground)">{T.appliesAfterSave}</p>
        </div>
        <nav aria-label={T.settingsTabsLabel} className="overflow-x-auto border-b border-(--border)">
          <ul className="flex min-w-max gap-1">
            {SETTINGS_TABS.map((tab) => {
              const current = pathname === tab.href || pathname?.startsWith(`${tab.href}/`) === true;
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "-mb-px block border-b-[3px] px-4 py-2.5 text-(length:--text-ui) font-semibold",
                      current
                        ? "border-(--primary-press) text-(--foreground)"
                        : "border-transparent text-(--muted-foreground) hover:text-(--foreground)",
                    )}
                  >
                    <Bilingual en={tab.label.en} kn={tab.label.kn} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div>{children}</div>
      </div>
    </SevaGate>
  );
}
