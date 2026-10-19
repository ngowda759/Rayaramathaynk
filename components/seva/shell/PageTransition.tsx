"use client";

import type { JSX, ReactNode } from "react";
import { m } from "framer-motion";

import { RoutePending } from "@/components/seva/motion/RouteProgress";
import { pageVariants } from "@/lib/seva/motion";

/**
 * The page transition of Seva Entry (plans A4P-1, A4S-2), used as the template of both route groups, inside the frame,
 * so the header and rail never remount. A template remounts on each move between pages, so every page (and its
 * loading outline) arrives with the module spring. While a seva link is still loading, RoutePending shows the outline
 * of the page being opened in place of this one, so a click always answers at once.
 */
export function PageTransition({ children }: { children: ReactNode }): JSX.Element {
  return (
    <RoutePending>
      <m.div variants={pageVariants} initial="hidden" animate="shown">
        {children}
      </m.div>
    </RoutePending>
  );
}

export default PageTransition;
