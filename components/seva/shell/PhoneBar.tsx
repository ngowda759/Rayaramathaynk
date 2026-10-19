"use client";

import Link from "next/link";
import { useState, type JSX, type ReactNode } from "react";
import { Ellipsis, ExternalLink } from "lucide-react";

import { MotionDialog } from "@/components/seva/motion/MotionDialog";
import { Pressable } from "@/components/seva/motion/Pressable";
import { SevaLink } from "@/components/seva/motion/SevaLink";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { DialogTitle } from "@/components/ui/dialog";
import { SEVA_ROUTES } from "@/lib/seva/routes";
import { SHELL_FRAME } from "@/lib/seva/strings/shell";
import { cn } from "@/lib/utils";

import type { SevaSection, SevaSectionId } from "./sections";

export interface PhoneBarProps {
  sections: SevaSection[];
  /** The section of the page actually open. */
  current: SevaSectionId | null;
  /** Whether the person sees the Website admin link (last under More). */
  showWebsiteAdmin: boolean;
}

/** Whether the bar is drawn at all: only for a person with more than one section. */
export function phoneBarShown(sections: SevaSection[]): boolean {
  return sections.length > 1;
}

const BAR_ITEM =
  "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-2 pb-2.5 text-center text-(length:--text-micro) leading-tight font-semibold no-underline";

function barItemClass(on: boolean): string {
  return cn(
    BAR_ITEM,
    on ? "text-(--primary-strong) shadow-[inset_0_3px_0_var(--primary-press)]" : "text-(--muted-foreground)",
  );
}

const SHEET_ITEM =
  "flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2 text-(length:--text-ui) leading-tight font-semibold text-(--foreground) no-underline hover:bg-(--secondary)";

interface SheetEntry {
  key: string;
  href: string;
  label: { en: string; kn: string };
  icon: ReactNode;
  leaves: boolean;
  current: boolean;
}

/**
 * Seva Entry's bottom bar below `md` (plan A4S-2), in place of the section rail: the person's phone sections, and More
 * when anything else is left, which opens a sheet with the rest and Website admin last. Not drawn for a person with
 * one section or none, and hidden when printing.
 */
export function PhoneBar({ sections, current, showWebsiteAdmin }: PhoneBarProps): JSX.Element | null {
  const [open, setOpen] = useState(false);
  if (!phoneBarShown(sections)) return null;

  const onBar = sections.filter((section) => section.phone);
  const rest = sections.filter((section) => !section.phone);
  const sheet: SheetEntry[] = rest.map((section) => {
    const Icon = section.icon;
    return {
      key: section.id,
      href: section.href,
      label: section.label,
      icon: <Icon aria-hidden="true" className="size-[18px] shrink-0 text-(--muted-foreground)" />,
      leaves: section.leavesModule === true,
      current: section.id === current,
    };
  });
  if (showWebsiteAdmin) {
    sheet.push({
      key: "websiteAdmin",
      href: SEVA_ROUTES.websiteAdmin,
      label: SHELL_FRAME.websiteAdmin,
      icon: <ExternalLink aria-hidden="true" className="size-[18px] shrink-0 text-(--muted-foreground)" />,
      leaves: true,
      current: false,
    });
  }
  const moreCurrent = sheet.some((entry) => entry.current);

  return (
    <nav
      data-seva-phonebar=""
      aria-label={SHELL_FRAME.sectionsLabel.en}
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-(--border) bg-(--card) pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      {onBar.map((section) => {
        const Icon = section.icon;
        const on = section.id === current;
        return (
          <SevaLink key={section.id} href={section.href} aria-current={on ? "page" : undefined} className={barItemClass(on)}>
            <Icon aria-hidden="true" className="size-5 shrink-0" />
            <Bilingual en={section.label.en} kn={section.label.kn} />
          </SevaLink>
        );
      })}
      {sheet.length > 0 ? (
        <>
          <Pressable
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-current={moreCurrent ? "page" : undefined}
            onClick={() => setOpen(true)}
            className={cn(barItemClass(moreCurrent), "cursor-pointer border-0 bg-transparent")}
          >
            <Ellipsis aria-hidden="true" className="size-5 shrink-0" />
            <Bilingual en={SHELL_FRAME.more.en} kn={SHELL_FRAME.more.kn} />
          </Pressable>
          <MotionDialog open={open} onOpenChange={setOpen}>
            <DialogTitle variant="seva">
              <Bilingual en={SHELL_FRAME.more.en} kn={SHELL_FRAME.more.kn} />
            </DialogTitle>
            <ul className="flex flex-col gap-0.5">
              {sheet.map((entry) => {
                const props = {
                  href: entry.href,
                  "aria-current": entry.current ? ("page" as const) : undefined,
                  className: cn(SHEET_ITEM, entry.current && "bg-(--primary-soft)"),
                  onClick: () => setOpen(false),
                };
                const body = (
                  <>
                    {entry.icon}
                    <Bilingual en={entry.label.en} kn={entry.label.kn} />
                  </>
                );
                return (
                  <li key={entry.key}>
                    {entry.leaves ? <Link {...props}>{body}</Link> : <SevaLink {...props}>{body}</SevaLink>}
                  </li>
                );
              })}
            </ul>
          </MotionDialog>
        </>
      ) : null}
    </nav>
  );
}

export default PhoneBar;
