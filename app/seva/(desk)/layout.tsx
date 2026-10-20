import type { JSX, ReactNode } from "react";

import { DeskFrame } from "@/components/seva/shell/DeskFrame";

/** Seva Entry's desk pages: the module header, the section rail and the phone bar (plan A4S-2). */
export default function SevaDeskLayout({ children }: { children: ReactNode }): JSX.Element {
  return <DeskFrame>{children}</DeskFrame>;
}
