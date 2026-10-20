"use client";

import { usePathname } from "next/navigation";
import type { JSX, ReactNode } from "react";

import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

import { PhoneBar, phoneBarShown } from "./PhoneBar";
import { SectionRail } from "./SectionRail";
import { SevaHeader } from "./SevaHeader";
import { currentSectionId, frameColumn, sectionsFor, WEBSITE_ADMIN_COLUMNS } from "./sections";

/**
 * The frame of Seva Entry's desk pages at /seva (plan A4S-2): the module header, then the section rail beside the
 * page from `md` up, and the phone bar below `md`. The sections follow the person's matrix column; while the seva
 * profile loads, a temple admin gets the view-only column (fail closed). The page itself is the one
 * `main#main-content`, the skip link's target; keyboard order is header, rail, page.
 */
export function DeskFrame({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname() ?? "";
  const { me } = useSevaMe();
  const { sevaRole } = useAuth();
  const column = frameColumn(me, sevaRole);
  const sections = sectionsFor(column);
  const current = currentSectionId(pathname);
  const withRail = sections.length > 1;
  const withBar = phoneBarShown(sections);

  return (
    <div className="flex min-h-screen flex-col bg-(--background)">
      <SevaHeader variant="desk" sections={sections} />
      <div className={cn("flex-1", withRail && "md:grid md:grid-cols-[220px_minmax(0,1fr)]")}>
        <SectionRail sections={sections} current={current} />
        <main id="main-content" tabIndex={-1} className={cn("min-w-0 outline-none", withBar && "pb-20 md:pb-0")}>
          {children}
        </main>
      </div>
      <PhoneBar
        sections={sections}
        current={current}
        showWebsiteAdmin={column !== null && WEBSITE_ADMIN_COLUMNS.includes(column)}
      />
    </div>
  );
}

export default DeskFrame;
