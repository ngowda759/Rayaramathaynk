"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type JSX } from "react";
import { m } from "framer-motion";

import { SevaLink } from "@/components/seva/motion/SevaLink";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { SHELL_FRAME } from "@/lib/seva/strings/shell";

import type { SevaSection, SevaSectionId } from "./sections";

export interface SectionRailProps {
  sections: SevaSection[];
  /** The section of the page actually open. */
  current: SevaSectionId | null;
}

const ITEM =
  "relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2 text-(length:--text-ui) leading-tight font-semibold text-(--foreground) no-underline hover:bg-(--secondary)";

/**
 * Seva Entry's section menu from `md` up (plan A4S-2): 220 px, one item per section the person may open, English with
 * Kannada under it. One highlight marks the open section and slides to an item the moment it is clicked, before its
 * page has loaded, as the reports tabs do; `aria-current` stays on the page actually open. Staff opens in the website
 * admin and says so. Not drawn for a person with one section or none, and hidden when printing.
 */
export function SectionRail({ sections, current }: SectionRailProps): JSX.Element | null {
  const pathname = usePathname() ?? "";
  // The item just clicked, for the path it was clicked on: once the path changes, the open page decides again.
  const [clicked, setClicked] = useState<{ id: SevaSectionId; on: string } | null>(null);
  if (sections.length <= 1) return null;
  const marked = clicked && clicked.on === pathname ? clicked.id : current;

  return (
    <nav
      data-seva-rail=""
      aria-label={SHELL_FRAME.sectionsLabel.en}
      className="hidden w-[220px] shrink-0 flex-col gap-0.5 border-r border-(--border) bg-(--card) px-2 py-3 md:flex print:hidden"
    >
      {sections.map((section) => {
        const Icon = section.icon;
        const isCurrent = section.id === current;
        const content = (
          <>
            {section.id === marked ? (
              <m.span
                layoutId="seva-rail-indicator"
                data-rail-indicator=""
                aria-hidden="true"
                className="absolute inset-0 rounded-[10px] bg-(--primary-soft) shadow-[inset_3px_0_0_var(--primary-press)]"
              />
            ) : null}
            <Icon aria-hidden="true" className="relative size-[18px] shrink-0 text-(--muted-foreground)" />
            <Bilingual en={section.label.en} kn={section.label.kn} className="relative min-w-0" />
          </>
        );
        const common = {
          href: section.href,
          "aria-current": isCurrent ? ("page" as const) : undefined,
          className: ITEM,
          onClick: () => {
            if (!isCurrent && !section.leavesModule) setClicked({ id: section.id, on: pathname });
          },
        };
        return section.leavesModule ? (
          <Link key={section.id} {...common} title={SHELL_FRAME.opensWebsiteAdmin.en}>
            {content}
          </Link>
        ) : (
          <SevaLink key={section.id} {...common}>
            {content}
          </SevaLink>
        );
      })}
    </nav>
  );
}

export default SectionRail;
