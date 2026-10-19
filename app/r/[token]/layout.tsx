import type { JSX, ReactNode } from "react";

import "@/styles/seva/tokens.css";

/** The public receipt page's frame: the module's tokens (`.seva`) on a plain page, phone first. */
export default function PublicReceiptLayout({ children }: { children: ReactNode }): JSX.Element {
  return <main className="seva min-h-screen bg-(--background) px-4 py-8 text-(--foreground)">{children}</main>;
}
