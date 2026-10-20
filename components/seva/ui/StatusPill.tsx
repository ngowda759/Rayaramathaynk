"use client";

import type { JSX, ReactNode } from "react";
import { AnimatePresence, m } from "framer-motion";

import { PRESS } from "@/lib/seva/motion";

export type StatusPillTone = "online" | "offline" | "closed";

export interface StatusPillProps {
  tone: StatusPillTone;
  children: ReactNode;
}

const DOTS: Record<StatusPillTone, string> = {
  online: "bg-(--ok) shadow-[0_0_0_3px_var(--ok-soft)]",
  offline: "bg-(--primary-press) shadow-[0_0_0_3px_var(--attn-soft)]",
  closed: "bg-(--muted-foreground) shadow-[0_0_0_3px_var(--secondary)]",
};

/**
 * Counter connection / day state ("Online", "Offline - 3 waiting", "Day closed").
 * A polite live region, so a change is read out without moving focus. The region itself is never replaced; only its
 * dot pops with the module spring when the state changes (not on first show), and the pill gives under a press.
 */
export function StatusPill({ tone, children }: StatusPillProps): JSX.Element {
  return (
    <m.span
      role="status"
      data-tone={tone}
      whileTap={PRESS}
      className="relative inline-flex h-[34px] items-center gap-2 rounded-full border border-(--border) bg-(--card) px-3.5 text-(length:--text-meta) font-semibold whitespace-nowrap text-(--foreground)"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <m.span
          key={tone}
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${DOTS[tone]}`}
          initial={{ scale: 0.2 }}
          animate={{ scale: 1 }}
        />
      </AnimatePresence>
      {children}
    </m.span>
  );
}

export default StatusPill;
