"use client";

import type { JSX, ReactNode } from "react";

import { SevaHeader } from "./SevaHeader";

/**
 * The full-screen counter frame at /seva (plan A4S-2): the maroon counter header with Today's receipts, Close day and
 * Sign out, then the page across the whole width. No section rail and no phone bar at any width, so nothing takes
 * space from the receipt. The page is the one `main#main-content`, the skip link's target.
 */
export function FocusFrame({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-(--background)">
      <SevaHeader variant="focus" sections={[]} />
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
        {children}
      </main>
    </div>
  );
}

export default FocusFrame;
