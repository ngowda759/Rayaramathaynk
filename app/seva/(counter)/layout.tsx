import type { JSX, ReactNode } from "react";

import { FocusFrame } from "@/components/seva/shell/FocusFrame";

/** The counter's pages: full screen, the counter header only (plan A4S-2). */
export default function SevaCounterLayout({ children }: { children: ReactNode }): JSX.Element {
  return <FocusFrame>{children}</FocusFrame>;
}
